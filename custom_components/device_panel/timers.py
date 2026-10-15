"""
Timer (seit 2.21.0): schaltet eine schaltbare Entität eines Geräts zu einer bestimmten Zeit, ohne Automation.

Ein Timer gehört zu einem Gerät und schaltet eine seiner Entitäten (Einschalten, Ausschalten, Umschalten; bei Rollläden
und Ventilen Öffnen und Schliessen, bei Schlössern Ab- und Aufschliessen). Optional schaltet er nach einer Dauer wieder
zurück ("20:00 ein, nach 3 Std. 30 Min. wieder aus"). Der Zeitpunkt hat drei Arten:

* countdown: einmal, in X Minuten ab jetzt ("delay_s")
* once: einmal, an einem Datum zu einer Uhrzeit ("date", "time"); ohne Datum beim nächsten Eintreffen der Uhrzeit (heute
  oder morgen)
* repeat: wiederholt zu einer Uhrzeit: täglich, wöchentlich (Wochentage) oder monatlich (Tag des Monats, -1 = letzter)

Einmalige Timer sind nach der Ausführung automatisch aus (bleiben aber in der Liste, "erledigt"); wiederholte laufen weiter.
Die Uhrzeit gilt in der Zeitzone von Home Assistant. Pro Timer wird nur der nächste Zeitpunkt geplant (kein Abfragen im
Minutentakt); er liegt zusammen mit dem Stand im Speicher .storage/device_panel.timers und übersteht einen Neustart. Was
während eines Neustarts fällig wurde, holt der Timer innerhalb der eingestellten Zeit nach (timers_catch_up), sonst wird es
übersprungen und im Protokoll vermerkt. Nicht erreichbare Entitäten: zwei weitere Versuche im Abstand von 5 Minuten, dann
Fehlermeldung. Der Text der Push-Meldung ist fest (push.py), mit Vorschau; Empfänger pro Timer, sonst das Standard-Ziel.

Schaltoptionen (seit 2.52.0): Beim Einschalten (bei Rollläden Öffnen) lässt sich einstellen, wie geschaltet wird: Licht mit
Helligkeit, Farbtemperatur oder Farbe, Rollladen auf eine Position, Klima mit Soll-Temperatur und Modus, Medien mit Lautstärke,
Ventilator mit Stufe. Was einstellbar ist, liest das Panel aus dem Zustand der Entität (option_specs); ohne Angabe bleibt alles
wie bisher ("wie zuletzt"). Beim Zurückschalten gibt es zwei Wege: das Gegenstück (aus, zu …) oder "wie vorher": Dann merkt sich
der Timer unmittelbar vor dem Schalten die Szene der Entität (snapshot_of) und stellt sie danach wieder her (restore_calls).
"""

from __future__ import annotations

import asyncio
import calendar
import logging
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from functools import partial
from typing import Any

import voluptuous as vol
from homeassistant.components.climate import ClimateEntityFeature
from homeassistant.components.cover import CoverEntityFeature
from homeassistant.components.fan import FanEntityFeature
from homeassistant.components.media_player import MediaPlayerEntityFeature
from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, State, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_track_point_in_utc_time
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from . import activity, push, push_icon
from .const import (
    CONF_NOTIFY_CLICK,
    CONF_TIMERS_CATCH_UP,
    CONF_TIMERS_NOTIFY_ERROR,
    CONF_TIMERS_PAUSE,
    DOMAIN,
    NOTIFY_NONE,
    STORAGE_VERSION,
)
from .devices import primary_domain
from .magic import entity_label, targets_payload
from .options_api import effective, notify_target

_LOGGER = logging.getLogger(__name__)

STORE_KEY = f"{DOMAIN}.timers"
MAX_PER_DEVICE = 20
MAX_TOTAL = 200
NAME_MAX = 60
BACK_MIN = 10
BACK_MAX = 7 * 86400
DELAY_MIN = 10
DELAY_MAX = 7 * 86400
KINDS = ("countdown", "once", "repeat")
REPEATS = ("daily", "weekly", "monthly")
# Wiederholungen bei nicht erreichbarer Entität: zwei weitere Versuche im Abstand von 5 Minuten
RETRY_S = 300
MAX_RETRY = 2
# Erledigte Countdowns räumen sich nach 24 Stunden selbst auf; erledigte "einmal"-Timer bleiben.
COUNTDOWN_KEEP_S = 86400
# Toleranz: ein Timer, der später als das (mindestens) ausgeführt würde, gilt als verpasst
LATE_MIN_S = 90

# Entitäten, die ein Timer schalten kann, und die Dienste je Aktion (on, off, toggle)
SERVICES: dict[str, dict[str, tuple[str, str]]] = {
    "switch": {"on": ("switch", "turn_on"), "off": ("switch", "turn_off"), "toggle": ("switch", "toggle")},
    "light": {"on": ("light", "turn_on"), "off": ("light", "turn_off"), "toggle": ("light", "toggle")},
    "fan": {"on": ("fan", "turn_on"), "off": ("fan", "turn_off"), "toggle": ("fan", "toggle")},
    "input_boolean": {"on": ("input_boolean", "turn_on"), "off": ("input_boolean", "turn_off"), "toggle": ("input_boolean", "toggle")},
    "siren": {"on": ("siren", "turn_on"), "off": ("siren", "turn_off"), "toggle": ("siren", "toggle")},
    "humidifier": {"on": ("humidifier", "turn_on"), "off": ("humidifier", "turn_off"), "toggle": ("humidifier", "toggle")},
    "cover": {"on": ("cover", "open_cover"), "off": ("cover", "close_cover"), "toggle": ("cover", "toggle")},
    "valve": {"on": ("valve", "open_valve"), "off": ("valve", "close_valve"), "toggle": ("valve", "toggle")},
    "lock": {"on": ("lock", "lock"), "off": ("lock", "unlock")},
    "climate": {"on": ("climate", "turn_on"), "off": ("climate", "turn_off"), "toggle": ("climate", "toggle")},
    "media_player": {"on": ("media_player", "turn_on"), "off": ("media_player", "turn_off"), "toggle": ("media_player", "toggle")},
}
DOMAINS = tuple(SERVICES)
ACTIONS = ("on", "off", "toggle")
BACK_MODES = ("opposite", "restore")
# Pause zwischen zwei Diensten eines Schaltens (Klima: einschalten, dann Temperatur; Medien: einschalten, dann Lautstärke):
# Manche Geräte nehmen die zweite Angabe erst an, wenn sie wirklich laufen.
CALL_GAP_S = 1.0
# Wort der Meldung nach dem Schalten (push.py: timer_res_*)
RESULT = {
    ("cover", "on"): "open", ("cover", "off"): "closed", ("valve", "on"): "open", ("valve", "off"): "closed",
    ("lock", "on"): "locked", ("lock", "off"): "unlocked",
}

_ID_RE = re.compile(r"^[0-9a-f]{12}$")
_ENTITY_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")
_NOTIFY_RE = re.compile(r"^notify\.[a-z0-9_]+$")
_DEVICE_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def actions_for(domain: str) -> list[str]:
    """Aktionen, die ein Timer für diese Art Entität kennt (Schlösser haben kein Umschalten)."""
    return [a for a in ACTIONS if a in SERVICES.get(domain, {})]


def opposite(action: str) -> str | None:
    """Gegenteil zum Zurückschalten (Umschalten hat keines)."""
    return {"on": "off", "off": "on"}.get(action)


def result_word(domain: str, action: str) -> str:
    """Schlüssel des Worts in der Meldung ("on", "off", "open", "closed", "locked", "unlocked", "toggled")."""
    return "toggled" if action == "toggle" else RESULT.get((domain, action), action)


# -- Schaltoptionen --------------------------------------------------------------------------------


def _int_range(low: int, high: int, what: str):
    """Ganze Zahl im Bereich (Wahrheitswerte zählen nicht)."""

    def check(value: Any) -> int:
        if isinstance(value, bool) or not isinstance(value, (int, float)) or value != int(value) or not low <= int(value) <= high:
            raise vol.Invalid(f"{what}: ganze Zahl von {low} bis {high} erwartet")
        return int(value)

    return check


def _temperature(value: Any) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not -50 <= value <= 200:
        raise vol.Invalid("Temperatur: Zahl von -50 bis 200 erwartet")
    return round(float(value), 1)


_HVAC_MODES = ("heat", "cool", "heat_cool", "auto", "dry", "fan_only")

# Erlaubte Angaben je Art der Entität. Gelten nur beim Einschalten (bei Rollläden Öffnen); ohne Angabe bleibt alles wie zuletzt.
OPTION_SCHEMAS: dict[str, vol.Schema] = {
    "light": vol.Schema(
        {
            vol.Optional("brightness_pct"): _int_range(1, 100, "Helligkeit"),
            vol.Optional("color_temp_kelvin"): _int_range(1000, 40000, "Farbtemperatur"),
            vol.Optional("rgb_color"): vol.All([_int_range(0, 255, "Farbe")], vol.Length(min=3, max=3)),
        }
    ),
    "cover": vol.Schema({vol.Optional("position"): _int_range(0, 100, "Position")}),
    "climate": vol.Schema({vol.Optional("temperature"): _temperature, vol.Optional("hvac_mode"): vol.In(_HVAC_MODES)}),
    "media_player": vol.Schema({vol.Optional("volume_pct"): _int_range(0, 100, "Lautstärke")}),
    "fan": vol.Schema({vol.Optional("percentage"): _int_range(1, 100, "Stufe")}),
}


def clean_options(domain: str, action: str, raw: Any) -> dict[str, Any]:
    """Schaltoptionen prüfen (Form und Wertebereich, ohne die Entität zu kennen); leer bleibt leer."""
    if not raw:
        return {}
    if not isinstance(raw, dict):
        raise vol.Invalid("Schaltoptionen ungültig")
    schema = OPTION_SCHEMAS.get(domain)
    if schema is None:
        raise vol.Invalid("Diese Entität hat keine Schaltoptionen")
    if action != "on":
        raise vol.Invalid("Schaltoptionen gibt es nur beim Einschalten")
    out = schema(raw)
    if "color_temp_kelvin" in out and "rgb_color" in out:
        raise vol.Invalid("Farbtemperatur und Farbe schliessen sich aus")
    return out


def _features(state: State) -> int:
    value = state.attributes.get("supported_features")
    return int(value) if isinstance(value, int) and not isinstance(value, bool) else 0


def option_specs(state: State | None, temperature_unit: str = "°C") -> list[dict[str, Any]]:
    """
    Was sich an dieser Entität einstellen lässt, als Beschreibung für das Panel (Schlüssel, Art, Grenzen). Leer, wenn nichts
    einstellbar ist oder die Entität nicht erreichbar ist (dann sind ihre Fähigkeiten nicht bekannt).
    """
    if state is None or state.state == "unavailable":
        return []
    attrs, feats = state.attributes, _features(state)
    specs: list[dict[str, Any]] = []
    if state.domain == "light":
        modes = set(attrs.get("supported_color_modes") or [])
        if modes - {"onoff"}:
            specs.append({"key": "brightness_pct", "type": "percent", "min": 1, "max": 100})
        if "color_temp" in modes:
            low = attrs.get("min_color_temp_kelvin")
            high = attrs.get("max_color_temp_kelvin")
            specs.append({"key": "color_temp_kelvin", "type": "kelvin", "min": int(low) if low else 2000, "max": int(high) if high else 6500})
        if modes & {"hs", "xy", "rgb", "rgbw", "rgbww"}:
            specs.append({"key": "rgb_color", "type": "colour"})
    elif state.domain == "cover":
        if feats & CoverEntityFeature.SET_POSITION:
            specs.append({"key": "position", "type": "percent", "min": 0, "max": 100})
    elif state.domain == "climate":
        if feats & ClimateEntityFeature.TARGET_TEMPERATURE:
            step = attrs.get("target_temp_step") or (0.5 if temperature_unit == "°C" else 1)
            specs.append({
                "key": "temperature", "type": "temperature", "unit": temperature_unit, "step": step,
                "min": attrs.get("min_temp", 7), "max": attrs.get("max_temp", 35),
            })
        modes = [m for m in attrs.get("hvac_modes") or [] if m in _HVAC_MODES]
        if modes:
            specs.append({"key": "hvac_mode", "type": "choice", "values": modes})
    elif state.domain == "media_player":
        if feats & MediaPlayerEntityFeature.VOLUME_SET:
            specs.append({"key": "volume_pct", "type": "percent", "min": 0, "max": 100})
    elif state.domain == "fan":
        if feats & FanEntityFeature.SET_SPEED:
            specs.append({"key": "percentage", "type": "percent", "min": 1, "max": 100})
    return specs


def validate_options(hass: HomeAssistant, entity_id: str, action: str, raw: Any) -> dict[str, Any]:
    """Optionen prüfen und, wenn die Entität erreichbar ist, gegen ihre Fähigkeiten (Grenzen, unterstützte Angaben) halten."""
    domain = entity_id.split(".", 1)[0]
    options = clean_options(domain, action, raw)
    if not options:
        return {}
    state = hass.states.get(entity_id)
    specs = {s["key"]: s for s in option_specs(state, hass.config.units.temperature_unit)}
    if state is None or state.state == "unavailable":
        return options
    for key, value in options.items():
        spec = specs.get(key)
        if spec is None:
            raise vol.Invalid("Diese Einstellung unterstützt die Entität nicht")
        if spec["type"] in ("kelvin", "temperature") and not spec["min"] <= value <= spec["max"]:
            raise vol.Invalid(f"Wert ausserhalb des Bereichs ({spec['min']} bis {spec['max']})")
        if spec["type"] == "choice" and value not in spec["values"]:
            raise vol.Invalid("Diesen Modus unterstützt die Entität nicht")
    return options


def actions_for_state(domain: str, state: State | None) -> list[str]:
    """
    Aktionen für eine bestimmte Entität. Bei Klima und Medien nur, was das Gerät kann (Ein-/Ausschalten ist dort eine
    Fähigkeit); "ein" bleibt auch ohne Einschalten möglich, wenn sich etwas einstellen lässt (Lautstärke eines Lautsprechers).
    """
    actions = actions_for(domain)
    if domain not in ("climate", "media_player") or state is None or state.state == "unavailable":
        return actions
    feats = _features(state)
    on_flag, off_flag = (
        (ClimateEntityFeature.TURN_ON, ClimateEntityFeature.TURN_OFF) if domain == "climate" else (MediaPlayerEntityFeature.TURN_ON, MediaPlayerEntityFeature.TURN_OFF)
    )
    can_on, can_off = bool(feats & on_flag), bool(feats & off_flag)
    out = []
    if can_on or option_specs(state):
        out.append("on")
    if can_off:
        out.append("off")
    if can_on and can_off:
        out.append("toggle")
    return out


def service_calls(domain: str, entity_id: str, action: str, options: dict[str, Any] | None, feats: int = 0) -> list[tuple[str, str, dict[str, Any]]]:
    """Die Dienste, die ein Schalten ausführt (Domäne, Dienst, Daten); leer, wenn es die Aktion nicht gibt."""
    base: dict[str, Any] = {"entity_id": entity_id}
    if action == "on" and options:
        if domain in ("light", "fan"):
            return [(domain, "turn_on", {**base, **options})]
        if domain == "cover":
            return [("cover", "set_cover_position", {**base, "position": options["position"]})]
        calls: list[tuple[str, str, dict[str, Any]]] = []
        if domain == "climate":
            if options.get("hvac_mode"):
                calls.append(("climate", "set_hvac_mode", {**base, "hvac_mode": options["hvac_mode"]}))
            elif feats & ClimateEntityFeature.TURN_ON:
                calls.append(("climate", "turn_on", base))
            if "temperature" in options:
                calls.append(("climate", "set_temperature", {**base, "temperature": options["temperature"]}))
            return calls
        if domain == "media_player":
            if feats & MediaPlayerEntityFeature.TURN_ON:
                calls.append(("media_player", "turn_on", base))
            if "volume_pct" in options:
                calls.append(("media_player", "volume_set", {**base, "volume_level": options["volume_pct"] / 100}))
            return calls
    service = SERVICES.get(domain, {}).get(action)
    return [(service[0], service[1], base)] if service else []


# -- Szene merken und wiederherstellen ("wie vorher") ------------------------------------------------

# Angaben, die für die Wiederherstellung gemerkt werden. Nur diese, damit der Speicher klein und frei von Fremdem bleibt.
SNAPSHOT_ATTRS: dict[str, tuple[str, ...]] = {
    "light": ("brightness", "color_mode", "color_temp_kelvin", "hs_color", "xy_color", "rgb_color", "rgbw_color", "rgbww_color"),
    "cover": ("current_position",),
    "climate": ("temperature",),
    "media_player": ("volume_level",),
    "fan": ("percentage",),
}
# Welche Angabe zum Farbmodus der Lampe gehört (nur diese wird zurückgegeben, sonst widerspricht sich der Aufruf)
_COLOUR_KEY = {"color_temp": "color_temp_kelvin", "hs": "hs_color", "xy": "xy_color", "rgb": "rgb_color", "rgbw": "rgbw_color", "rgbww": "rgbww_color"}


def _plain(value: Any) -> Any:
    """Tupel (Farben) als Liste, damit die Szene im Speicher steht und wieder gelesen werden kann."""
    return [_plain(v) for v in value] if isinstance(value, (list, tuple)) else value


def snapshot_of(state: State | None) -> dict[str, Any] | None:
    """Die Szene einer Entität vor dem Schalten; None, wenn sie nicht bekannt ist (dann bleibt es beim Gegenstück)."""
    if state is None or state.state in ("unavailable", "unknown"):
        return None
    keep = SNAPSHOT_ATTRS.get(state.domain, ())
    return {"state": state.state, "attrs": {k: _plain(state.attributes[k]) for k in keep if state.attributes.get(k) is not None}}


def restore_calls(domain: str, entity_id: str, snapshot: dict[str, Any], feats: int = 0) -> list[tuple[str, str, dict[str, Any]]] | None:
    """
    Dienste, die eine gemerkte Szene wiederherstellen. None: aus dieser Szene lässt sich nichts herstellen (dann gilt das
    Gegenstück). Leere Liste: es ist nichts zu tun.
    """
    state, attrs = snapshot["state"], snapshot["attrs"]
    base: dict[str, Any] = {"entity_id": entity_id}
    if domain == "light":
        if state == "off":
            return [("light", "turn_off", base)]
        if state != "on":
            return None
        data = dict(base)
        if "brightness" in attrs:
            data["brightness"] = attrs["brightness"]
        key = _COLOUR_KEY.get(attrs.get("color_mode", ""))
        if key and key in attrs:
            data[key] = attrs[key]
        return [("light", "turn_on", data)]
    if domain == "cover":
        if state not in ("open", "closed", "opening", "closing"):
            return None
        if attrs.get("current_position") is not None:
            return [("cover", "set_cover_position", {**base, "position": attrs["current_position"]})]
        return [("cover", "open_cover" if state in ("open", "opening") else "close_cover", base)]
    if domain == "climate":
        if state == "off":
            return [("climate", "turn_off", base)]
        if state not in _HVAC_MODES:
            return None
        calls = [("climate", "set_hvac_mode", {**base, "hvac_mode": state})]
        if "temperature" in attrs:
            calls.append(("climate", "set_temperature", {**base, "temperature": attrs["temperature"]}))
        return calls
    if domain == "media_player":
        if state in ("off", "standby"):
            return [("media_player", "turn_off", base)]
        calls = [("media_player", "turn_on", base)] if feats & MediaPlayerEntityFeature.TURN_ON else []
        if "volume_level" in attrs:
            calls.append(("media_player", "volume_set", {**base, "volume_level": attrs["volume_level"]}))
        return calls
    if domain == "fan":
        if state == "off":
            return [("fan", "turn_off", base)]
        if state != "on":
            return None
        return [("fan", "turn_on", {**base, **({"percentage": attrs["percentage"]} if "percentage" in attrs else {})})]
    on_states, off_states = {
        "valve": (("open", "opening"), ("closed", "closing")),
        "lock": (("locked",), ("unlocked",)),
    }.get(domain, (("on",), ("off",)))
    action = "on" if state in on_states else "off" if state in off_states else None
    service = SERVICES.get(domain, {}).get(action) if action else None
    return [(service[0], service[1], base)] if service else None


# -- Zeitberechnung ------------------------------------------------------------------------------


def _local(hass_tz: Any, year: int, month: int, day: int, hour: int, minute: int) -> datetime:
    """Ortszeit als Zeitpunkt; eine Zeit, die es bei der Umstellung auf Sommerzeit nicht gibt, rutscht eine Stunde weiter."""
    naive = datetime(year, month, day, hour, minute, tzinfo=hass_tz)
    return naive.astimezone(timezone.utc).astimezone(hass_tz)


def _hm(text: str) -> tuple[int, int]:
    hour, minute = text.split(":")
    return int(hour), int(minute)


def occurrence_after(timer: dict[str, Any], after: datetime, tz: Any) -> datetime | None:
    """
    Nächster Zeitpunkt eines wiederholten Timers streng nach "after" (Ortszeit in der Zeitzone tz); None bei einem anderen
    Timer. Monatlich: ein Tag, den der Monat nicht hat (31.), fällt auf den letzten Tag des Monats.
    """
    if timer.get("kind") != "repeat":
        return None
    hour, minute = _hm(timer["time"])
    start = after.astimezone(tz)
    if timer["repeat"] == "monthly":
        year, month = start.year, start.month
        for _ in range(26):
            last = calendar.monthrange(year, month)[1]
            wanted = timer["mday"]
            day = last if wanted == -1 else min(wanted, last)
            candidate = _local(tz, year, month, day, hour, minute)
            if candidate > after:
                return candidate
            month += 1
            if month > 12:
                year, month = year + 1, 1
        return None
    for offset in range(0, 9):
        day = (start + timedelta(days=offset)).date()
        if timer["repeat"] == "weekly" and day.weekday() not in timer["weekdays"]:
            continue
        candidate = _local(tz, day.year, day.month, day.day, hour, minute)
        if candidate > after:
            return candidate
    return None


def once_at(timer: dict[str, Any], tz: Any, after: datetime | None = None) -> datetime | None:
    """
    Zeitpunkt eines einmaligen Timers. Ohne Datum (seit 2.22.0) gilt das nächste Eintreffen der Uhrzeit nach "after"
    (heute, sonst morgen); das gilt nur für die Planung, danach schaltet sich der Timer aus. Ohne "after" und ohne Datum: None.
    """
    hour, minute = _hm(timer["time"])
    if not timer.get("date"):
        if after is None:
            return None
        return occurrence_after({"kind": "repeat", "repeat": "daily", "time": timer["time"]}, after, tz)
    year, month, day = (int(p) for p in timer["date"].split("-"))
    return _local(tz, year, month, day, hour, minute)


def first_due(timer: dict[str, Any], now: float, tz: Any) -> float | None:
    """Erster Zeitpunkt (Sekunden) eines Timers ab jetzt; None, wenn keiner mehr kommt."""
    if timer["kind"] == "countdown":
        return now + float(timer["delay_s"])
    after = dt_util.utc_from_timestamp(now).astimezone(tz)
    if timer["kind"] == "once":
        at = once_at(timer, tz, after)
        return at.timestamp() if at is not None and at > after else None
    nxt = occurrence_after(timer, after, tz)
    return nxt.timestamp() if nxt else None


def local_parts(ts: float, tz: Any) -> dict[str, Any]:
    """Zeitpunkt als Ortszeit der Instanz (Datum, Uhrzeit, Wochentag 0 = Montag), damit das Panel nicht die Zeitzone des Browsers nimmt."""
    d = dt_util.utc_from_timestamp(ts).astimezone(tz)
    return {"ts": d.timestamp(), "date": d.strftime("%Y-%m-%d"), "time": d.strftime("%H:%M"), "weekday": d.weekday()}


def next_runs(timer: dict[str, Any], now: float, tz: Any, count: int = 3) -> list[dict[str, Any]]:
    """Die nächsten Ausführungen für die Vorschau, als Ortszeit mit Wochentag (das Panel formatiert selbst)."""
    out: list[datetime] = []
    after = dt_util.utc_from_timestamp(now).astimezone(tz)
    if timer["kind"] == "countdown":
        out.append(after + timedelta(seconds=float(timer["delay_s"])))
    elif timer["kind"] == "once":
        at = once_at(timer, tz, after)
        if at is not None:
            out.append(at)
    else:
        cursor = after
        while len(out) < count:
            nxt = occurrence_after(timer, cursor, tz)
            if nxt is None:
                break
            out.append(nxt)
            cursor = nxt
    # Mit "danach wieder zurückschalten" (seit 2.26.0) steht zu jeder Ausführung auch der Zeitpunkt des Zurückschaltens
    back = timer.get("back_s")
    return [
        {**local_parts(d.timestamp(), tz), **({"back": local_parts(d.timestamp() + float(back), tz)} if back else {})}
        for d in out
    ]


# -- Prüfen --------------------------------------------------------------------------------------


def _int_in(low: int, high: int, what: str):
    def check(value: Any) -> int:
        if isinstance(value, bool) or not isinstance(value, (int, float)) or value != int(value) or not low <= int(value) <= high:
            raise vol.Invalid(f"{what}: ganze Zahl von {low} bis {high} erwartet")
        return int(value)

    return check


def _name(value: Any) -> str:
    text = " ".join(str(value or "").split())
    if len(text) > NAME_MAX:
        raise vol.Invalid(f"Name: höchstens {NAME_MAX} Zeichen")
    return text


TIMER_SCHEMA = vol.Schema(
    {
        vol.Optional("id"): vol.All(str, vol.Match(_ID_RE)),
        vol.Required("device_id"): vol.All(str, vol.Match(_DEVICE_RE)),
        vol.Required("entity_id"): vol.All(str, vol.Match(_ENTITY_RE)),
        vol.Optional("name", default=""): _name,
        vol.Required("action"): vol.In(ACTIONS),
        vol.Optional("options", default=dict): vol.Any(None, dict),
        vol.Optional("back_mode", default="opposite"): vol.In(BACK_MODES),
        vol.Optional("back_s", default=None): vol.Any(None, _int_in(BACK_MIN, BACK_MAX, "Zurückschalten"), msg=f"Zurückschalten: ganze Zahl von {BACK_MIN} bis {BACK_MAX} erwartet"),
        vol.Required("kind"): vol.In(KINDS),
        vol.Optional("delay_s", default=None): vol.Any(None, _int_in(DELAY_MIN, DELAY_MAX, "Dauer"), msg=f"Dauer: ganze Zahl von {DELAY_MIN} bis {DELAY_MAX} erwartet"),
        vol.Optional("date", default=None): vol.Any(None, "", vol.All(str, vol.Match(_DATE_RE)), msg="Datum ungültig"),
        vol.Optional("time", default=None): vol.Any(None, vol.All(str, vol.Match(_TIME_RE)), msg="Uhrzeit ungültig"),
        vol.Optional("repeat", default=None): vol.Any(None, vol.In(REPEATS)),
        vol.Optional("weekdays", default=None): vol.Any(None, [vol.All(int, vol.Range(min=0, max=6))], msg="Wochentage ungültig"),
        vol.Optional("mday", default=None): vol.Any(None, vol.All(int, vol.Range(min=-1, max=31)), msg="Tag des Monats ungültig"),
        vol.Optional("enabled", default=True): bool,
        vol.Optional("push", default=False): bool,
        vol.Optional("target", default=None): vol.Any(None, "", vol.All(str, vol.Match(_NOTIFY_RE)), msg="Empfänger ungültig"),
        vol.Optional("created"): vol.Coerce(float),
    },
    extra=vol.REMOVE_EXTRA,
)


def clean_when(timer: dict[str, Any], tz: Any, *, check_future: bool = True) -> dict[str, Any]:
    """Zeitangaben nach Art prüfen; nicht Passendes wird auf None gesetzt."""
    kind = timer["kind"]
    if kind == "countdown":
        if timer["delay_s"] is None:
            raise vol.Invalid("Dauer fehlt")
        timer.update(date=None, time=None, repeat=None, weekdays=None, mday=None)
    elif kind == "once":
        if not timer["time"]:
            raise vol.Invalid("Uhrzeit fehlt")
        # Ohne Datum: nächstes Eintreffen der Uhrzeit, kann nie in der Vergangenheit liegen
        if timer["date"]:
            try:
                at = once_at(timer, tz)
            except ValueError as err:
                raise vol.Invalid("Datum ungültig") from err
            if check_future and timer["enabled"] and at <= dt_util.now(tz):
                raise vol.Invalid("Der Zeitpunkt liegt in der Vergangenheit")
        else:
            timer["date"] = None
        timer.update(delay_s=None, repeat=None, weekdays=None, mday=None)
    else:
        if not timer["time"] or timer["repeat"] is None:
            raise vol.Invalid("Uhrzeit und Wiederholung fehlen")
        if timer["repeat"] == "weekly":
            days = sorted(set(timer["weekdays"] or []))
            if not days:
                raise vol.Invalid("Mindestens ein Wochentag")
            timer["weekdays"] = days
            timer["mday"] = None
        elif timer["repeat"] == "monthly":
            if timer["mday"] is None or timer["mday"] == 0:
                raise vol.Invalid("Tag des Monats fehlt")
            timer["weekdays"] = None
        else:
            timer["weekdays"] = None
            timer["mday"] = None
        timer.update(delay_s=None, date=None)
    return timer


class TimerManager:
    """Alle Timer: Speicher, Planung (ein Aufruf je Timer), Ausführen, Zurückschalten, Neustart."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORE_KEY)
        self._timers: dict[str, dict[str, Any]] = {}
        self._runtime: dict[str, dict[str, Any]] = {}
        self._handles: dict[str, CALLBACK_TYPE] = {}
        self._lock = asyncio.Lock()
        self._unsubs: list[CALLBACK_TYPE] = []

    # -- Start, Stopp -------------------------------------------------------------

    async def async_start(self) -> None:
        stored = await self._store.async_load() or {}
        raw = stored.get("timers") if isinstance(stored, dict) else None
        for timer_id, item in (raw.items() if isinstance(raw, dict) else []):
            try:
                timer = self._clean_stored(item)
            except vol.Invalid:
                _LOGGER.warning("Timer: gespeicherter Timer %s ist ungültig und wird ignoriert", timer_id)
                continue
            self._timers[timer["id"]] = timer
        runtime = stored.get("runtime") if isinstance(stored, dict) else None
        for timer_id in self._timers:
            rt = runtime.get(timer_id) if isinstance(runtime, dict) else None
            self._runtime[timer_id] = self._clean_runtime(rt if isinstance(rt, dict) else {})
        self._unsubs.append(self.hass.bus.async_listen(dr.EVENT_DEVICE_REGISTRY_UPDATED, self._on_device_registry))
        async_at_started(self.hass, self._on_started)

    async def async_stop(self) -> None:
        for unsub in self._unsubs:
            unsub()
        self._unsubs = []
        for cancel in self._handles.values():
            cancel()
        self._handles = {}
        await self._store.async_save(self._data())

    def _data(self) -> dict[str, Any]:
        return {"timers": self._timers, "runtime": self._runtime}

    def _save(self) -> None:
        self._store.async_delay_save(self._data, 2)

    def _save_now(self) -> None:
        """Sofort schreiben: nach dem Schalten darf ein Absturz nicht vergessen lassen, dass es schon geschehen ist."""
        self.hass.async_create_task(self._store.async_save(self._data()))

    @staticmethod
    def _clean_stored(raw: Any) -> dict[str, Any]:
        timer = TIMER_SCHEMA(raw)
        if "id" not in timer:
            raise vol.Invalid("id fehlt")
        # Form prüfen; die Register-Prüfung läuft nur beim Anlegen. Datum in der Vergangenheit ist hier erlaubt.
        clean_when(timer, dt_util.get_default_time_zone(), check_future=False)
        timer["target"] = timer.get("target") or None
        timer["options"] = clean_options(timer["entity_id"].split(".", 1)[0], timer["action"], timer["options"])
        return timer

    @staticmethod
    def _clean_runtime(raw: dict[str, Any]) -> dict[str, Any]:
        def num(key: str) -> float | None:
            value = raw.get(key)
            return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None

        last = raw.get("last")
        snapshot = raw.get("snapshot")
        if not (isinstance(snapshot, dict) and isinstance(snapshot.get("state"), str) and isinstance(snapshot.get("attrs"), dict)):
            snapshot = None
        return {
            "due": num("due"),
            "revert_due": num("revert_due"),
            "revert_action": raw.get("revert_action") if raw.get("revert_action") in ("on", "off") else None,
            # Die Szene vor dem Schalten, wenn nach dem Zurückschalten "wie vorher" gilt
            "snapshot": snapshot,
            "done": num("done"),
            "retry": int(raw["retry"]) if isinstance(raw.get("retry"), int) else 0,
            "rretry": int(raw["rretry"]) if isinstance(raw.get("rretry"), int) else 0,
            "last": last if isinstance(last, dict) else None,
        }

    @callback
    def _on_started(self, _hass: HomeAssistant) -> None:
        """Nach dem Start: Fälliges nachholen oder überspringen, alles planen."""
        self.hass.async_create_task(self._async_resync())

    async def _async_resync(self) -> None:
        for timer_id in list(self._timers):
            await self._async_process(timer_id)
        self._cleanup()

    @callback
    def _on_device_registry(self, event: Event) -> None:
        if event.data.get("action") != "remove":
            return
        gone = event.data.get("device_id")
        for timer in [t for t in self._timers.values() if t["device_id"] == gone]:
            self._forget(timer["id"])
        self._save()

    # -- Timer --------------------------------------------------------------------

    def timers(self, device_id: str | None = None) -> list[dict[str, Any]]:
        self._cleanup()
        out = [t for t in self._timers.values() if device_id is None or t["device_id"] == device_id]
        return sorted(out, key=lambda t: (t["name"].casefold(), t["id"]))

    def get(self, timer_id: str) -> dict[str, Any] | None:
        return self._timers.get(timer_id)

    def runtime(self, timer_id: str) -> dict[str, Any]:
        return self._runtime.setdefault(timer_id, self._clean_runtime({}))

    @property
    def tz(self) -> Any:
        return dt_util.get_default_time_zone()

    def clean(self, raw: dict[str, Any], *, existing: dict[str, Any] | None = None) -> dict[str, Any]:
        """Entwurf prüfen (gegen Gerät, Entität, Aktion und Zeitangaben); gibt den bereinigten Timer zurück."""
        timer = TIMER_SCHEMA(raw)
        registry = er.async_get(self.hass)
        if dr.async_get(self.hass).async_get(timer["device_id"]) is None:
            raise vol.Invalid("Gerät nicht gefunden")
        entry = registry.async_get(timer["entity_id"])
        if entry is None or entry.device_id != timer["device_id"]:
            raise vol.Invalid("Die Entität gehört nicht zu diesem Gerät")
        domain = timer["entity_id"].split(".", 1)[0]
        if domain not in SERVICES:
            raise vol.Invalid("Diese Entität lässt sich nicht schalten")
        if timer["action"] not in SERVICES[domain]:
            raise vol.Invalid("Diese Aktion gibt es für diese Entität nicht")
        if timer["back_s"] is not None and opposite(timer["action"]) is None:
            raise vol.Invalid("Umschalten lässt sich nicht zurückschalten")
        timer["options"] = validate_options(self.hass, timer["entity_id"], timer["action"], timer["options"])
        # "Wie vorher" gilt nur, wenn überhaupt zurückgeschaltet wird
        if timer["back_s"] is None or opposite(timer["action"]) is None:
            timer["back_mode"] = "opposite"
        clean_when(timer, self.tz, check_future=existing is None or not self._same_when(existing, timer))
        timer["target"] = timer.get("target") or None
        if not timer["name"]:
            timer["name"] = self.default_name(timer)
        return timer

    @staticmethod
    def _same_when(old: dict[str, Any], new: dict[str, Any]) -> bool:
        keys = ("kind", "delay_s", "date", "time", "repeat", "weekdays", "mday")
        return all(old.get(k) == new.get(k) for k in keys)

    def default_name(self, timer: dict[str, Any]) -> str:
        state = self.hass.states.get(timer["entity_id"])
        entry = er.async_get(self.hass).async_get(timer["entity_id"])
        device = dr.async_get(self.hass).async_get(timer["device_id"])
        return entity_label(timer["entity_id"], entry, device, state)[:NAME_MAX]

    async def async_save_timer(self, raw: dict[str, Any]) -> dict[str, Any]:
        """Timer anlegen oder ändern (mit id)."""
        existing = self._timers.get(raw.get("id", ""))
        if raw.get("id") and existing is None:
            raise vol.Invalid("Timer nicht gefunden")
        timer = self.clean(raw, existing=existing)
        if existing is not None and existing["device_id"] != timer["device_id"]:
            raise vol.Invalid("Der Timer gehört zu einem anderen Gerät")
        if existing is None:
            if len(self._timers) >= MAX_TOTAL:
                raise vol.Invalid(f"Höchstens {MAX_TOTAL} Timer insgesamt")
            if len(self.timers(timer["device_id"])) >= MAX_PER_DEVICE:
                raise vol.Invalid(f"Höchstens {MAX_PER_DEVICE} Timer pro Gerät")
            timer["id"] = uuid.uuid4().hex[:12]
        timer["created"] = existing["created"] if existing and "created" in existing else time.time()
        self._timers[timer["id"]] = timer
        rt = self.runtime(timer["id"])
        # Neu oder anderer Zeitpunkt: neu planen; sonst bleibt der laufende Stand (zum Beispiel der Countdown)
        if existing is None or not self._same_when(existing, timer) or (timer["enabled"] and not existing["enabled"]):
            self._rearm_runtime(timer, rt)
        elif not timer["enabled"]:
            rt["due"] = None
        self._arm(timer["id"])
        await self._store.async_save(self._data())
        return timer

    def _rearm_runtime(self, timer: dict[str, Any], rt: dict[str, Any]) -> None:
        rt.update(retry=0, done=None)
        rt["due"] = first_due(timer, time.time(), self.tz) if timer["enabled"] else None

    async def async_delete_timer(self, timer_id: str) -> bool:
        if timer_id not in self._timers:
            return False
        self._forget(timer_id)
        await self._store.async_save(self._data())
        return True

    async def async_set_enabled(self, timer_id: str, enabled: bool) -> dict[str, Any] | None:
        timer = self._timers.get(timer_id)
        if timer is None:
            return None
        rt = self.runtime(timer_id)
        if enabled:
            if timer["kind"] == "once" and timer.get("date") and once_at(timer, self.tz) <= dt_util.now(self.tz):
                raise vol.Invalid("Der Zeitpunkt liegt in der Vergangenheit")
            timer["enabled"] = True
            self._rearm_runtime(timer, rt)
        else:
            timer["enabled"] = False
            rt.update(due=None, retry=0)
        self._arm(timer_id)
        await self._store.async_save(self._data())
        return timer

    def _forget(self, timer_id: str) -> None:
        if (cancel := self._handles.pop(timer_id, None)) is not None:
            cancel()
        self._timers.pop(timer_id, None)
        self._runtime.pop(timer_id, None)

    def _cleanup(self) -> None:
        """Erledigte Countdowns nach 24 Stunden entfernen."""
        now = time.time()
        for timer in [t for t in self._timers.values() if t["kind"] == "countdown"]:
            done = self._runtime.get(timer["id"], {}).get("done")
            if done is not None and now - done > COUNTDOWN_KEEP_S:
                self._forget(timer["id"])
                self._save()

    # -- Planen -------------------------------------------------------------------

    def _arm(self, timer_id: str) -> None:
        """Einen Aufruf zum nächsten Ereignis (Ausführen, Zurückschalten oder Wiederholen) planen."""
        if (cancel := self._handles.pop(timer_id, None)) is not None:
            cancel()
        timer = self._timers.get(timer_id)
        if timer is None:
            return
        rt = self.runtime(timer_id)
        points = [p for p in (rt["due"] if timer["enabled"] else None, rt["revert_due"]) if p is not None]
        if not points:
            return
        when = max(min(points), time.time() + 1)
        if activity.get(self.hass).debug:
            revert = rt["revert_due"] is not None and min(points) == rt["revert_due"]
            activity.record(self.hass, "debug", "timer", "timer_armed_revert" if revert else "timer_armed", timer["name"], timer["device_id"], when=dt_util.as_local(dt_util.utc_from_timestamp(when)).strftime("%d.%m. %H:%M:%S"))
        self._handles[timer_id] = async_track_point_in_utc_time(
            self.hass, partial(self._on_timer, timer_id), dt_util.utc_from_timestamp(when)
        )

    @callback
    def _on_timer(self, timer_id: str, _now: datetime) -> None:
        self._handles.pop(timer_id, None)
        self.hass.async_create_task(self._async_process(timer_id))

    async def _async_process(self, timer_id: str) -> None:
        async with self._lock:
            timer = self._timers.get(timer_id)
            if timer is None:
                return
            rt = self.runtime(timer_id)
            now = time.time()
            if rt["revert_due"] is not None and rt["revert_due"] <= now:
                await self._async_revert(timer, rt, now)
            if timer["enabled"] and rt["due"] is not None and rt["due"] <= now:
                await self._async_fire(timer, rt, now)
            self._arm(timer_id)
            self._save_now()

    # -- Ausführen ----------------------------------------------------------------

    def _grace(self) -> float:
        return max(float(effective(self.hass)[CONF_TIMERS_CATCH_UP]) * 60.0, float(LATE_MIN_S))

    async def _async_call(
        self, timer: dict[str, Any], action: str, *, options: dict[str, Any] | None = None, snapshot: dict[str, Any] | None = None
    ) -> tuple[bool, str | None]:
        """
        Entität schalten. Rückgabe (geschafft, Grund): Grund "unavailable" oder "error". Mit "options" wird eingeschaltet wie
        eingestellt, mit "snapshot" die gemerkte Szene wiederhergestellt (ist daraus nichts herzustellen, gilt "action").
        """
        state = self.hass.states.get(timer["entity_id"])
        if state is None:
            return False, "missing"
        if state.state == "unavailable":
            return False, "unavailable"
        domain = timer["entity_id"].split(".", 1)[0]
        feats = _features(state)
        calls = restore_calls(domain, timer["entity_id"], snapshot, feats) if snapshot is not None else None
        if calls is None:
            calls = service_calls(domain, timer["entity_id"], action, options, feats)
            if not calls:
                return False, "error"
        try:
            for i, (call_domain, service, data) in enumerate(calls):
                if i:
                    await asyncio.sleep(CALL_GAP_S)
                await self.hass.services.async_call(call_domain, service, data, blocking=True)
        except Exception:  # noqa: BLE001 - ein Timer darf nie etwas anderes stören
            _LOGGER.exception("Timer '%s': Schalten von %s fehlgeschlagen", timer["name"], timer["entity_id"])
            return False, "error"
        return True, None

    def _entity_name(self, timer: dict[str, Any]) -> str:
        return self.default_name(timer)

    def _action_text(self, timer: dict[str, Any], action: str) -> str:
        """Aktion als Wort für das Protokoll (ein, aus, offen, geschlossen, abgeschlossen, umgeschaltet …)."""
        if action == "restore":
            return push.text(self.hass, "timer_res_restored")
        return push.text(self.hass, f"timer_res_{result_word(timer['entity_id'].split('.', 1)[0], action)}")

    def _device_name(self, timer: dict[str, Any]) -> str:
        device = dr.async_get(self.hass).async_get(timer["device_id"])
        return (device.name_by_user or device.name or "") if device is not None else ""

    async def _async_fire(self, timer: dict[str, Any], rt: dict[str, Any], now: float) -> None:
        hass = self.hass
        name, device = timer["name"], timer["device_id"]
        late = now - float(rt["due"])
        if late > self._grace():
            activity.record(hass, "warning", "timer", "timer_missed", name, device, minutes=int(late // 60))
            rt["last"] = {"at": now, "ok": False, "what": "missed", "reason": None}
            self._finish(timer, rt, now)
            return
        if effective(hass)[CONF_TIMERS_PAUSE]:
            activity.record(hass, "info", "timer", "timer_paused", name, device)
            rt["last"] = {"at": now, "ok": False, "what": "paused", "reason": None}
            self._finish(timer, rt, now)
            return
        scene = self._take_snapshot(timer, rt)
        ok, reason = await self._async_call(timer, timer["action"], options=timer["options"])
        if ok:
            rt["retry"] = 0
            rt["last"] = {"at": now, "ok": True, "what": "run", "reason": None}
            activity.record(hass, "info", "timer", "timer_run", name, device, entity=self._entity_name(timer), action=self._action_text(timer, timer["action"]))
            self._plan_revert(timer, rt, now, scene)
            await self._async_notify(timer, ok=True, action=timer["action"])
            self._finish(timer, rt, now)
            return
        if rt["retry"] < MAX_RETRY:
            rt["retry"] += 1
            rt["due"] = now + RETRY_S
            rt["last"] = {"at": now, "ok": False, "what": "retry", "reason": reason}
            activity.record(hass, "warning", "timer", "timer_retry", name, device, entity=self._entity_name(timer), minutes=RETRY_S // 60, count=rt["retry"], max=MAX_RETRY)
            return
        rt["last"] = {"at": now, "ok": False, "what": "failed", "reason": reason}
        activity.record(hass, "error", "timer", "timer_failed", name, device, entity=self._entity_name(timer))
        await self._async_notify(timer, ok=False, action=timer["action"], reason=reason or "error")
        self._finish(timer, rt, now)

    def _take_snapshot(self, timer: dict[str, Any], rt: dict[str, Any]) -> dict[str, Any] | None:
        """Die Szene vor dem Schalten, wenn danach "wie vorher" gilt. Wartet noch ein Zurückschalten, gilt dessen Szene weiter."""
        if timer["back_mode"] != "restore" or not timer["back_s"] or opposite(timer["action"]) is None:
            return None
        if rt["revert_due"] is not None:
            return rt["snapshot"]
        return snapshot_of(self.hass.states.get(timer["entity_id"]))

    def _plan_revert(self, timer: dict[str, Any], rt: dict[str, Any], now: float, scene: dict[str, Any] | None = None) -> None:
        back = opposite(timer["action"])
        if timer["back_s"] and back:
            rt["revert_due"] = now + float(timer["back_s"])
            rt["revert_action"] = back
            rt["rretry"] = 0
            rt["snapshot"] = scene

    def _finish(self, timer: dict[str, Any], rt: dict[str, Any], now: float) -> None:
        """Nach dem Ausführen (oder Verpassen): wiederholte Timer planen den nächsten, einmalige sind erledigt und aus."""
        rt["retry"] = 0
        if timer["kind"] == "repeat":
            nxt = occurrence_after(timer, dt_util.utc_from_timestamp(max(now, rt["due"] or now)).astimezone(self.tz), self.tz)
            rt["due"] = nxt.timestamp() if nxt else None
        else:
            rt["due"] = None
            rt["done"] = now
            timer["enabled"] = False

    async def _async_revert(self, timer: dict[str, Any], rt: dict[str, Any], now: float) -> None:
        hass = self.hass
        name, device = timer["name"], timer["device_id"]
        action = rt["revert_action"]
        if action is None:
            rt["revert_due"] = None
            return
        scene = rt["snapshot"] if timer["back_mode"] == "restore" else None
        ok, reason = await self._async_call(timer, action, snapshot=scene)
        if ok:
            rt.update(revert_due=None, revert_action=None, rretry=0, snapshot=None)
            # Wurde die Szene wiederhergestellt, steht im Protokoll und in der Meldung "wie vorher" statt des Gegenstücks
            shown = "restore" if scene is not None and restore_calls(timer["entity_id"].split(".", 1)[0], timer["entity_id"], scene) is not None else action
            activity.record(hass, "info", "timer", "timer_revert", name, device, entity=self._entity_name(timer), action=self._action_text(timer, shown))
            await self._async_notify(timer, ok=True, action=shown)
            return
        if rt["rretry"] < MAX_RETRY:
            rt["rretry"] += 1
            rt["revert_due"] = now + RETRY_S
            activity.record(hass, "warning", "timer", "timer_retry", name, device, entity=self._entity_name(timer), minutes=RETRY_S // 60, count=rt["rretry"], max=MAX_RETRY)
            return
        rt.update(revert_due=None, revert_action=None, rretry=0, snapshot=None)
        activity.record(hass, "error", "timer", "timer_failed", name, device, entity=self._entity_name(timer))
        await self._async_notify(timer, ok=False, action=action, reason=reason or "error")

    async def async_run_now(self, timer_id: str) -> tuple[bool, str | None] | None:
        """Jetzt ausführen (Knopf): schaltet sofort, der Zeitplan bleibt wie er ist; ein Zurückschalten wird geplant."""
        timer = self._timers.get(timer_id)
        if timer is None:
            return None
        async with self._lock:
            rt = self.runtime(timer_id)
            now = time.time()
            scene = self._take_snapshot(timer, rt)
            ok, reason = await self._async_call(timer, timer["action"], options=timer["options"])
            if ok:
                activity.record(self.hass, "info", "timer", "timer_run_manual", timer["name"], timer["device_id"], entity=self._entity_name(timer), action=self._action_text(timer, timer["action"]))
                rt["last"] = {"at": now, "ok": True, "what": "run", "reason": None}
                self._plan_revert(timer, rt, now, scene)
                await self._async_notify(timer, ok=True, action=timer["action"])
            else:
                activity.record(self.hass, "error", "timer", "timer_failed", timer["name"], timer["device_id"], entity=self._entity_name(timer))
                rt["last"] = {"at": now, "ok": False, "what": "failed", "reason": reason}
                await self._async_notify(timer, ok=False, action=timer["action"], reason=reason or "error")
            self._arm(timer_id)
            self._save_now()
            return ok, reason

    # -- Meldung ------------------------------------------------------------------

    def target(self, timer: dict[str, Any]) -> str:
        """Ziel dieses Timers: das eigene, sonst das Standard-Ziel aus den Einstellungen."""
        return timer.get("target") or notify_target(effective(self.hass), "timers")

    def texts(self, timer: dict[str, Any], *, action: str, ok: bool = True, reason: str = "error", now: float | None = None) -> tuple[str, str]:
        """Titel und Zeile der Meldung; fest vorgegeben (push.py), mit echten Namen und Uhrzeit."""
        hass = self.hass
        clock = dt_util.as_local(dt_util.utc_from_timestamp(now if now is not None else time.time())).strftime("%H:%M")
        domain = timer["entity_id"].split(".", 1)[0]
        entity = self._entity_name(timer)
        if not ok:
            return push.text(hass, "timer_fail_title", name=timer["name"]), push.text(
                hass, "timer_fail_text", entity=entity, reason=push.text(hass, f"timer_reason_{reason}"), time=clock
            )
        if action == "restore":
            return push.text(hass, "timer_title", name=timer["name"]), push.text(hass, "timer_text_restored", entity=entity, time=clock)
        word = result_word(domain, action)
        key = "timer_text_toggled" if word == "toggled" else "timer_text"
        return push.text(hass, "timer_title", name=timer["name"]), push.text(hass, key, entity=entity, result=push.text(hass, f"timer_res_{word}") if word != "toggled" else "", time=clock)

    async def _async_notify(self, timer: dict[str, Any], *, ok: bool, action: str, reason: str = "error") -> None:
        """Push nach dem Schalten (nur mit "Per Push melden") oder bei einem Fehler (auch ohne, wenn in den Einstellungen an)."""
        opts = effective(self.hass)
        if ok and not timer["push"]:
            return
        if not ok and not timer["push"] and not opts[CONF_TIMERS_NOTIFY_ERROR]:
            return
        title, message = self.texts(timer, action=action, ok=ok, reason=reason)
        await self._async_send(timer, title, message)

    async def _async_send(self, timer: dict[str, Any], title: str, message: str) -> bool:
        hass = self.hass
        opts = effective(hass)
        target = self.target(timer)
        device = dr.async_get(hass).async_get(timer["device_id"])
        if target == NOTIFY_NONE or device is None:
            activity.record(hass, "info", "timer", "timer_no_target", timer["name"], timer["device_id"])
            return False
        icon = await push_icon.async_integration_icon(hass, primary_domain(hass, device))
        data = push.notification_data(hass, f"{DOMAIN}_timer_{timer.get('id', 'test')}", push.device_url(opts[CONF_NOTIFY_CLICK], device.id), icon=icon)
        return await push.async_push(hass, target, title, message, data)

    def preview_raw(self, raw: dict[str, Any]) -> dict[str, Any]:
        """Vorschau für einen Entwurf: Meldungstext, nächste Ausführungen und der Satz; Name darf fehlen."""
        timer = self.clean({**raw, "enabled": True}, existing=None)
        title, message = self.texts(timer, action=timer["action"])
        return {
            "title": title,
            "message": message,
            "name": timer["name"],
            "target": self.target(timer),
            "next_runs": next_runs(timer, time.time(), self.tz),
        }

    async def async_try(self, entity_id: str, action: str, options: Any = None) -> tuple[bool, str | None]:
        """
        Jetzt ausführen im Assistenten (seit 2.28.0): schaltet einmal, ohne Timer, Zurückschalten, Protokoll und Meldung.
        Mit Schaltoptionen (seit 2.52.0) in genau der eingestellten Stärke, damit sich prüfen lässt, wie es wirklich wirkt.
        """
        domain = entity_id.split(".", 1)[0]
        if domain not in SERVICES or action not in SERVICES[domain]:
            raise vol.Invalid("action not possible for this entity")
        clean = validate_options(self.hass, entity_id, action, options)
        return await self._async_call({"entity_id": entity_id, "action": action, "name": entity_id}, action, options=clean)

    async def async_test(self, raw: dict[str, Any]) -> bool:
        """Test: die echte Meldung (ohne zu schalten) an den gewählten Empfänger."""
        timer = self.clean({**raw, "enabled": True}, existing=None)
        title, message = self.texts(timer, action=timer["action"])
        activity.record(self.hass, "info", "timer", "timer_test", timer["name"], timer["device_id"])
        return await self._async_send(timer, title, message)


# -- Angaben für das Panel ---------------------------------------------------------


def entity_payload(hass: HomeAssistant, entity_id: str) -> dict[str, Any]:
    entry = er.async_get(hass).async_get(entity_id)
    state = hass.states.get(entity_id)
    own = dr.async_get(hass).async_get(entry.device_id) if entry is not None and entry.device_id else None
    domain = entity_id.split(".", 1)[0]
    return {
        "entity_id": entity_id,
        "name": entity_label(entity_id, entry, own, state),
        "domain": domain,
        "state": state.state if state is not None else None,
        "available": state is not None and state.state != "unavailable",
        "actions": actions_for_state(domain, state),
        # Was sich einstellen lässt (seit 2.52.0); leer, wenn nichts oder die Entität gerade nicht erreichbar ist
        "options": option_specs(state, hass.config.units.temperature_unit),
    }


def switchable_entities(hass: HomeAssistant, device_id: str) -> list[dict[str, Any]]:
    """
    Entitäten des Geräts, die ein Timer schalten kann (ohne deaktivierte). Ausgeblendete zählen mit (seit 2.52.0): "Versteckt" heisst
    nur, dass Home Assistant sie nicht in automatischen Dashboards zeigt, so versteckt es zum Beispiel einzelne Hue-Lampen einer Gruppe.
    """
    entries = er.async_entries_for_device(er.async_get(hass), device_id)
    wanted = [e for e in entries if e.domain in SERVICES and e.disabled_by is None]
    payloads = [entity_payload(hass, e.entity_id) for e in sorted(wanted, key=lambda e: (e.entity_category is not None, e.entity_id))]
    # Klima und Medien ohne jede Aktion (Gerät kann weder ein noch aus noch etwas einstellen) sind nicht schaltbar
    return [p for p in payloads if p["actions"]]


def switchable_devices(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Geräte mit mindestens einer Entität, die ein Timer schalten kann (für "Timer hinzufügen" im Fenster aller Timer, seit 2.27.0)."""
    counts: dict[str, int] = {}
    for entry in er.async_get(hass).entities.values():
        if entry.device_id and entry.domain in SERVICES and entry.disabled_by is None and actions_for_state(entry.domain, hass.states.get(entry.entity_id)):
            counts[entry.device_id] = counts.get(entry.device_id, 0) + 1
    devices = dr.async_get(hass)
    out = []
    for device_id, n in counts.items():
        device = devices.async_get(device_id)
        if device is None or device.disabled_by is not None:
            continue
        out.append({"id": device_id, "name": device.name_by_user or device.name or device_id, "entities": n})
    return sorted(out, key=lambda d: d["name"].casefold())


def timer_payload(hass: HomeAssistant, manager: TimerManager, timer: dict[str, Any]) -> dict[str, Any]:
    """Timer mit Stand für das Panel: nächster Lauf, Zurückschalten, zuletzt, erledigt, Entität."""
    rt = manager.runtime(timer["id"])
    registry = er.async_get(hass)
    entity = entity_payload(hass, timer["entity_id"])
    exists = registry.async_get(timer["entity_id"]) is not None or hass.states.get(timer["entity_id"]) is not None
    return {
        **{k: v for k, v in timer.items() if not k.startswith("_")},
        "due": rt["due"] if timer["enabled"] else None,
        "due_local": local_parts(rt["due"], manager.tz) if timer["enabled"] and rt["due"] is not None else None,
        "revert_due": rt["revert_due"],
        "revert_local": local_parts(rt["revert_due"], manager.tz) if rt["revert_due"] is not None else None,
        "last": rt["last"],
        "done": rt["done"],
        "running": timer["kind"] == "countdown" and timer["enabled"] and rt["due"] is not None,
        # Wartet auf das Zurückschalten (seit 2.26.0): der Timer ist geschaltet, die Rückstellung steht noch aus; zählt für den Reiter "Läuft"
        "reverting": rt["revert_due"] is not None,
        "entity_name": entity["name"],
        "entity_state": entity["state"],
        "entity_missing": not exists,
        "domain": entity["domain"],
        "actions": entity["actions"],
        "next_runs": next_runs(timer, time.time(), manager.tz) if timer["enabled"] and timer["kind"] != "countdown" else [],
        "device_name": manager._device_name(timer),
    }


def targets(hass: HomeAssistant, current: list[str]) -> list[dict[str, Any]]:
    """Empfänger zur Wahl (wie bei Magic Push)."""
    return targets_payload(hass, current)
