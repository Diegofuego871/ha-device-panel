"""
Routine (seit 2.21.0): schaltet eine schaltbare Entität eines Geräts zu einer bestimmten Zeit, ohne Automation.

Eine Routine gehört zu einem Gerät und schaltet eine seiner Entitäten (Einschalten, Ausschalten, Umschalten; bei Rollläden
und Ventilen Öffnen und Schliessen, bei Schlössern Ab- und Aufschliessen). Optional schaltet er nach einer Dauer wieder
zurück ("20:00 ein, nach 3 Std. 30 Min. wieder aus"). Der Zeitpunkt hat drei Arten:

* countdown: einmal, in X Minuten ab jetzt ("delay_s")
* once: einmal, an einem Datum zu einer Uhrzeit ("date", "time"); ohne Datum beim nächsten Eintreffen der Uhrzeit (heute
  oder morgen)
* repeat: wiederholt zu einer Uhrzeit: täglich, wöchentlich (Wochentage) oder monatlich (Tag des Monats, -1 = letzter)

Auslöser (seit 2.54.0): Statt zu einer Zeit kann eine Routine durch Entitäten ausgelöst werden (kind "trigger"): Bedingungen wie bei
Magic Push (über, unter, ist, ändert sich; Und/Oder mit einer Ebene Gruppen; optional "mindestens so lange erfüllt"). Er schaltet nur,
wenn die Bedingung NEU eintritt (Wechsel auf "erfüllt"); ist sie beim Speichern, nach einem Neustart oder beim Beginn des Zeitfensters
schon erfüllt, schaltet er nicht. Dazu ein Zeitfenster (auch über Mitternacht; ausserhalb wird ein Auslöser übergangen, nicht
verschoben), eine Mindestpause zwischen zwei Auslösungen und der Schutz, dass eine Entität nicht ihr eigener Auslöser ist. Auch das
Zurückschalten kennt vier Arten (back_kind): none, duration (back_s), time (back_time, die nächste Uhrzeit nach dem Schalten) und
trigger (back_conditions, ebenfalls nur beim Eintreten, mit optionalem "spätestens nach" back_max_s als Sicherung). Start und Ende
lassen sich beliebig kombinieren. Das Zeitfenster gilt nur für den Start.

Einmalige Routinen sind nach der Ausführung automatisch aus (bleiben aber in der Liste, "erledigt"); wiederholte laufen weiter.
Die Uhrzeit gilt in der Zeitzone von Home Assistant. Pro Routine wird nur der nächste Zeitpunkt geplant (kein Abfragen im
Minutentakt); er liegt zusammen mit dem Stand im Speicher .storage/device_panel.routines und übersteht einen Neustart. Was
während eines Neustarts fällig wurde, holt die Routine innerhalb der eingestellten Zeit nach (routines_catch_up), sonst wird es
übersprungen und im Protokoll vermerkt. Nicht erreichbare Entitäten: zwei weitere Versuche im Abstand von 5 Minuten, dann
Fehlermeldung. Der Text der Push-Meldung ist fest (push.py), mit Vorschau; Empfänger pro Routine, sonst das Standard-Ziel.

Schaltoptionen (seit 2.52.0): Beim Einschalten (bei Rollläden Öffnen) lässt sich einstellen, wie geschaltet wird: Licht mit
Helligkeit, Farbtemperatur oder Farbe, Rollladen auf eine Position, Klima mit Soll-Temperatur und Modus, Medien mit Lautstärke,
Ventilator mit Stufe. Was einstellbar ist, liest das Panel aus dem Zustand der Entität (option_specs); ohne Angabe bleibt alles
wie bisher ("wie zuletzt"). Beim Zurückschalten gibt es zwei Wege: das Gegenstück (aus, zu …) oder "wie vorher": Dann merkt sich
die Routine unmittelbar vor dem Schalten die Szene der Entität (snapshot_of) und stellt sie danach wieder her (restore_calls).
"""

from __future__ import annotations

import asyncio
import calendar
import logging
import math
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
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_call_later, async_track_point_in_utc_time, async_track_state_change_event
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from . import activity, magic, push, push_icon
from .const import (
    CONF_NOTIFY_CLICK,
    CONF_ROUTINES_CATCH_UP,
    CONF_ROUTINES_NOTIFY_ERROR,
    CONF_ROUTINES_PAUSE,
    CONF_ROUTINES_PAUSE_UNTIL,
    DATA_PROTOCOL,
    SIGNAL_ROUTINES,
    DOMAIN,
    NOTIFY_NONE,
    STORAGE_VERSION,
)
from .devices import primary_domain
from .magic import entity_label, targets_payload
from .options_api import effective, notify_target

_LOGGER = logging.getLogger(__name__)

STORE_KEY = f"{DOMAIN}.routines"
# Umbenennung Timer → Routine (2.55.0): so hiess die Speicherdatei vorher (mit "timers" statt "routines" darin)
LEGACY_STORE_KEY = f"{DOMAIN}.timers"
MAX_PER_DEVICE = 20
MAX_TOTAL = 200
NAME_MAX = 60
BACK_MIN = 10
BACK_MAX = 7 * 86400
DELAY_MIN = 10
DELAY_MAX = 7 * 86400
KINDS = ("countdown", "once", "repeat", "trigger")
BACK_KINDS = ("none", "duration", "time", "trigger")
# Auslöser: Mindestpause zwischen zwei Auslösungen (Sekunden) und "mindestens so lange erfüllt"
PAUSE_MIN = 10
PAUSE_MAX = 86400
PAUSE_DEFAULT = 60
HOLD_MAX = magic.FOR_MAX
REPEATS = ("daily", "weekly", "monthly")
# Wiederholungen bei nicht erreichbarer Entität: zwei weitere Versuche im Abstand von 5 Minuten
RETRY_S = 300
MAX_RETRY = 2
# So lange zeigt das Panel einen Fehlschlag mit der Sternschnuppe, wenn niemand das Routinen-Protokoll öffnet (seit 2.172.0)
FAIL_HOURS = 24
# Erledigte Countdowns räumen sich nach 24 Stunden selbst auf; erledigte "einmal"-Routinen bleiben.
COUNTDOWN_KEEP_S = 86400
# Toleranz: eine Routine, der später als das (mindestens) ausgeführt würde, gilt als verpasst
LATE_MIN_S = 90

# Entitäten, die eine Routine schalten kann, und die Dienste je Aktion (on, off, toggle)
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
    # Szene (seit 2.61.0): nur auslösen, es gibt weder Aus noch Zurückschalten
    "scene": {"activate": ("scene", "turn_on")},
    # Zahl und Auswahl (seit 2.80.0): nur setzen (Wert in den Schaltoptionen), zurück geht über "wie vorher"
    "number": {"set": ("number", "set_value")},
    "select": {"set": ("select", "select_option")},
}
ACTIONS = ("on", "off", "toggle", "activate", "set")
# Sammelstellen für Szenen und Gruppen ohne Gerät (seit 2.61.0): stehen dort, wo sonst die Geräte-ID steht, und beginnen mit "@",
# damit sie nie mit einer echten Geräte-ID zusammenfallen.
HOLDER_SCENES = "@scenes"
HOLDER_GROUPS = "@groups"
HOLDERS = (HOLDER_SCENES, HOLDER_GROUPS)
BACK_MODES = ("opposite", "restore")
# Pause zwischen zwei Diensten eines Schaltens (Klima: einschalten, dann Temperatur; Medien: einschalten, dann Lautstärke):
# Manche Geräte nehmen die zweite Angabe erst an, wenn sie wirklich laufen.
CALL_GAP_S = 1.0
# Höchste Wartezeit auf die Antwort eines Schaltbefehls (seit 2.80.0): Antwortet ein Gerät nicht, hielte der Befehl sonst die Sperre
# für alle Routinen fest. Danach gilt er als fehlgeschlagen (Grund "timeout"), die Wiederholung nach 5 Minuten folgt wie bei jedem Fehler.
CALL_TIMEOUT_S = 45
# Wort der Meldung nach dem Schalten (push.py: routine_res_*)
RESULT = {
    ("cover", "on"): "open", ("cover", "off"): "closed", ("valve", "on"): "open", ("valve", "off"): "closed",
    ("lock", "on"): "locked", ("lock", "off"): "unlocked", ("scene", "activate"): "activated",
}

_ID_RE = re.compile(r"^[0-9a-f]{12}$")
_ENTITY_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")
_NOTIFY_RE = re.compile(r"^notify\.[a-z0-9_]+$")
_DEVICE_RE = re.compile(r"^(@scenes|@groups|[A-Za-z0-9_-]{1,64})$")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def actions_for(domain: str) -> list[str]:
    """Aktionen, die eine Routine für diese Art Entität kennt (Schlösser haben kein Umschalten)."""
    return [a for a in ACTIONS if a in SERVICES.get(domain, {})]


def is_holder(device_id: str) -> bool:
    """Sammelstelle für Szenen oder Gruppen statt eines Geräts."""
    return device_id in HOLDERS


def log_device(routine: dict[str, Any]) -> str | None:
    """Gerät für das Protokoll (zum Öffnen aus dem Eintrag); Szenen und Gruppen haben keines."""
    return None if is_holder(routine["device_id"]) else routine["device_id"]


def _no_device(entry: er.RegistryEntry | None) -> bool:
    """Entität ohne Gerät (auch ohne Registry-Eintrag, etwa eine Szene aus YAML)."""
    return entry is None or entry.device_id is None


def is_group_state(state: State | None, entry: er.RegistryEntry | None = None) -> bool:
    """
    Gruppe von Entitäten: eine schaltbare Entität (ausser Szene), die Mitglieder in "entity_id" führt (Licht-, Schalter-Gruppe …) oder von der
    Gruppen-Integration stammt (Plattform "group"; deren Mitgliederliste fehlt, solange die Gruppe nicht erreichbar ist).
    """
    domain = state.domain if state is not None else (entry.domain if entry is not None else "")
    if domain not in SERVICES or domain == "scene":
        return False
    if entry is not None and entry.platform == "group":
        return True
    if state is None:
        return False
    members = state.attributes.get("entity_id")
    return isinstance(members, (list, tuple)) and bool(members)


def in_holder(hass: HomeAssistant, holder: str, entity_id: str) -> bool:
    """
    Gehört die Entität in diese Sammelstelle? Alle Szenen stehen bei "Szenen" (auch die eines Geräts, etwa Hue-Szenen: sonst wären sie
    zwischen vielen Geräten schwer zu finden; sie stehen zusätzlich bei ihrem Gerät). Gruppen nur ohne Gerät.
    """
    entry = er.async_get(hass).async_get(entity_id)
    if entry is None and hass.states.get(entity_id) is None:
        return False
    if holder == HOLDER_SCENES:
        return entity_id.split(".", 1)[0] == "scene"
    return holder == HOLDER_GROUPS and _no_device(entry) and is_group_state(hass.states.get(entity_id), entry)


def opposite(action: str) -> str | None:
    """Gegenteil zum Zurückschalten (Umschalten hat keines)."""
    return {"on": "off", "off": "on"}.get(action)


def can_back(action: str) -> bool:
    """Lässt sich nach dieser Aktion zurückschalten? Ein/Aus mit dem Gegenstück, "setzen" nur mit "wie vorher"."""
    return opposite(action) is not None or action == "set"


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


def _number(value: Any) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not -1e9 <= value <= 1e9 or value != value:
        raise vol.Invalid("Wert: Zahl erwartet")
    return float(value)


def _option(value: Any) -> str:
    if not isinstance(value, str) or not 1 <= len(value) <= 255:
        raise vol.Invalid("Auswahl: Text erwartet")
    return value


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
    # Zahl und Auswahl (seit 2.80.0): der Wert ist Pflicht und gehört zur Aktion "set"
    "number": vol.Schema({vol.Required("value"): _number}),
    "select": vol.Schema({vol.Required("option"): _option}),
}


def clean_options(domain: str, action: str, raw: Any) -> dict[str, Any]:
    """Schaltoptionen prüfen (Form und Wertebereich, ohne die Entität zu kennen); leer bleibt leer."""
    if action == "set" and not raw:
        raise vol.Invalid("Es fehlt der Wert, der gesetzt werden soll")
    if not raw:
        return {}
    if not isinstance(raw, dict):
        raise vol.Invalid("Schaltoptionen ungültig")
    schema = OPTION_SCHEMAS.get(domain)
    if schema is None:
        raise vol.Invalid("Diese Entität hat keine Schaltoptionen")
    if action != ("set" if domain in ("number", "select") else "on"):
        raise vol.Invalid("Schaltoptionen gibt es nur beim Einschalten" if domain not in ("number", "select") else "Diese Entität kennt nur das Setzen")
    out = schema(raw)
    if "color_temp_kelvin" in out and "rgb_color" in out:
        raise vol.Invalid("Farbtemperatur und Farbe schliessen sich aus")
    return out


def _features(state: State) -> int:
    value = state.attributes.get("supported_features")
    return int(value) if isinstance(value, int) and not isinstance(value, bool) else 0


def _finite(value: Any, default: float) -> float:
    """Endliche Zahl aus einem Attribut; Text, Wahrheitswerte, NaN und unendlich zählen nicht (dann gilt default)."""
    if isinstance(value, bool):
        return default
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return number if math.isfinite(number) else default


def _bounds(low: Any, high: Any, default_low: float, default_high: float) -> tuple[float, float]:
    """Untere und obere Grenze; ist eine Angabe unbrauchbar oder min nicht kleiner als max, gelten beide Standardwerte."""
    lo, hi = _finite(low, default_low), _finite(high, default_high)
    return (lo, hi) if lo < hi else (default_low, default_high)


def _step(value: Any, default: float, span: float) -> float:
    """Schrittweite; null, negativ oder grösser als der ganze Bereich ergibt keinen brauchbaren Regler (dann default)."""
    step = _finite(value, default)
    return step if 0 < step <= span else default


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
            low, high = _bounds(attrs.get("min_color_temp_kelvin"), attrs.get("max_color_temp_kelvin"), 2000, 6500)
            specs.append({"key": "color_temp_kelvin", "type": "kelvin", "min": int(low), "max": int(high)})
        if modes & {"hs", "xy", "rgb", "rgbw", "rgbww"}:
            specs.append({"key": "rgb_color", "type": "colour"})
    elif state.domain == "cover":
        if feats & CoverEntityFeature.SET_POSITION:
            specs.append({"key": "position", "type": "percent", "min": 0, "max": 100})
    elif state.domain == "climate":
        if feats & ClimateEntityFeature.TARGET_TEMPERATURE:
            celsius = temperature_unit == "°C"
            low, high = _bounds(attrs.get("min_temp"), attrs.get("max_temp"), 7 if celsius else 45, 35 if celsius else 95)
            step = _step(attrs.get("target_temp_step"), 0.5 if celsius else 1, high - low)
            specs.append({"key": "temperature", "type": "temperature", "unit": temperature_unit, "step": step, "min": low, "max": high})
        modes = [m for m in attrs.get("hvac_modes") or [] if m in _HVAC_MODES]
        if modes:
            specs.append({"key": "hvac_mode", "type": "choice", "values": modes})
    elif state.domain == "media_player":
        if feats & MediaPlayerEntityFeature.VOLUME_SET:
            specs.append({"key": "volume_pct", "type": "percent", "min": 0, "max": 100})
    elif state.domain == "fan":
        if feats & FanEntityFeature.SET_SPEED:
            specs.append({"key": "percentage", "type": "percent", "min": 1, "max": 100})
    elif state.domain == "number":
        low, high = _bounds(attrs.get("min"), attrs.get("max"), 0.0, 100.0)
        specs.append({
            "key": "value", "type": "number", "unit": str(attrs.get("unit_of_measurement") or ""),
            "min": low, "max": high, "step": _step(attrs.get("step"), 1.0, high - low),
        })
    elif state.domain == "select":
        values = [str(o) for o in attrs.get("options") or [] if isinstance(o, str)]
        if values:
            specs.append({"key": "option", "type": "pick", "values": values})
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
        if spec["type"] == "number" and not spec["min"] <= value <= spec["max"]:
            raise vol.Invalid(f"Wert ausserhalb des Bereichs ({spec['min']:g} bis {spec['max']:g})")
        if spec["type"] == "pick" and value not in spec["values"]:
            raise vol.Invalid("Diese Auswahl gibt es bei der Entität nicht")
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
    if action == "set":
        if domain == "number" and options and "value" in options:
            return [("number", "set_value", {**base, "value": options["value"]})]
        if domain == "select" and options and "option" in options:
            return [("select", "select_option", {**base, "option": options["option"]})]
        return []
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
    if domain == "number":
        try:
            return [("number", "set_value", {**base, "value": float(state)})]
        except (TypeError, ValueError):
            return None
    if domain == "select":
        return [("select", "select_option", {**base, "option": state})] if isinstance(state, str) and state else None
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


def occurrence_after(routine: dict[str, Any], after: datetime, tz: Any) -> datetime | None:
    """
    Nächster Zeitpunkt eines wiederholten Routines streng nach "after" (Ortszeit in der Zeitzone tz); None bei einem anderen
    Routine. Monatlich: ein Tag, den der Monat nicht hat (31.), fällt auf den letzten Tag des Monats.
    """
    if routine.get("kind") != "repeat":
        return None
    hour, minute = _hm(routine["time"])
    start = after.astimezone(tz)
    if routine["repeat"] == "monthly":
        year, month = start.year, start.month
        for _ in range(26):
            last = calendar.monthrange(year, month)[1]
            wanted = routine["mday"]
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
        if routine["repeat"] == "weekly" and day.weekday() not in routine["weekdays"]:
            continue
        candidate = _local(tz, day.year, day.month, day.day, hour, minute)
        if candidate > after:
            return candidate
    return None


def once_at(routine: dict[str, Any], tz: Any, after: datetime | None = None) -> datetime | None:
    """
    Zeitpunkt eines einmaligen Routines. Ohne Datum (seit 2.22.0) gilt das nächste Eintreffen der Uhrzeit nach "after"
    (heute, sonst morgen); das gilt nur für die Planung, danach schaltet sich die Routine aus. Ohne "after" und ohne Datum: None.
    """
    hour, minute = _hm(routine["time"])
    if not routine.get("date"):
        if after is None:
            return None
        return occurrence_after({"kind": "repeat", "repeat": "daily", "time": routine["time"]}, after, tz)
    year, month, day = (int(p) for p in routine["date"].split("-"))
    return _local(tz, year, month, day, hour, minute)


def first_due(routine: dict[str, Any], now: float, tz: Any) -> float | None:
    """Erster Zeitpunkt (Sekunden) einer Routine ab jetzt; None, wenn keiner mehr kommt (auch bei einem Auslöser: er wartet auf Ereignisse)."""
    if routine["kind"] == "trigger":
        return None
    if routine["kind"] == "countdown":
        return now + float(routine["delay_s"])
    after = dt_util.utc_from_timestamp(now).astimezone(tz)
    if routine["kind"] == "once":
        at = once_at(routine, tz, after)
        return at.timestamp() if at is not None and at > after else None
    nxt = occurrence_after(routine, after, tz)
    return nxt.timestamp() if nxt else None


def local_parts(ts: float, tz: Any) -> dict[str, Any]:
    """Zeitpunkt als Ortszeit der Instanz (Datum, Uhrzeit, Wochentag 0 = Montag), damit das Panel nicht die Zeitzone des Browsers nimmt."""
    d = dt_util.utc_from_timestamp(ts).astimezone(tz)
    return {"ts": d.timestamp(), "date": d.strftime("%Y-%m-%d"), "time": d.strftime("%H:%M"), "weekday": d.weekday()}


def next_runs(routine: dict[str, Any], now: float, tz: Any, count: int = 3) -> list[dict[str, Any]]:
    """Die nächsten Ausführungen für die Vorschau, als Ortszeit mit Wochentag (das Panel formatiert selbst)."""
    if routine["kind"] == "trigger":
        return []
    out: list[datetime] = []
    after = dt_util.utc_from_timestamp(now).astimezone(tz)
    if routine["kind"] == "countdown":
        out.append(after + timedelta(seconds=float(routine["delay_s"])))
    elif routine["kind"] == "once":
        at = once_at(routine, tz, after)
        if at is not None:
            out.append(at)
    else:
        cursor = after
        while len(out) < count:
            nxt = occurrence_after(routine, cursor, tz)
            if nxt is None:
                break
            out.append(nxt)
            cursor = nxt
    # Mit "danach wieder zurückschalten" (seit 2.26.0) steht zu jeder Ausführung auch der Zeitpunkt des Zurückschaltens: nach einer
    # Dauer oder (seit 2.54.0) zu einer Uhrzeit; beim Zurückschalten durch einen Auslöser gibt es keinen festen Zeitpunkt
    kind = routine.get("back_kind") or ("duration" if routine.get("back_s") else "none")

    def back_of(d: datetime) -> dict[str, Any]:
        if kind == "duration" and routine.get("back_s"):
            return {"back": local_parts(d.timestamp() + float(routine["back_s"]), tz)}
        if kind == "time" and routine.get("back_time"):
            at = occurrence_after({"kind": "repeat", "repeat": "daily", "time": routine["back_time"]}, d, tz)
            return {"back": local_parts(at.timestamp(), tz)} if at else {}
        return {}

    return [{**local_parts(d.timestamp(), tz), **back_of(d)} for d in out]


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


ROUTINE_SCHEMA = vol.Schema(
    {
        vol.Optional("id"): vol.All(str, vol.Match(_ID_RE)),
        vol.Required("device_id"): vol.All(str, vol.Match(_DEVICE_RE)),
        vol.Required("entity_id"): vol.All(str, vol.Match(_ENTITY_RE)),
        vol.Optional("name", default=""): _name,
        vol.Required("action"): vol.In(ACTIONS),
        vol.Optional("options", default=dict): vol.Any(None, dict),
        vol.Optional("back_mode", default="opposite"): vol.In(BACK_MODES),
        vol.Optional("back_s", default=None): vol.Any(None, _int_in(BACK_MIN, BACK_MAX, "Zurückschalten"), msg=f"Zurückschalten: ganze Zahl von {BACK_MIN} bis {BACK_MAX} erwartet"),
        # Zurückschalten (seit 2.54.0): none, duration (back_s), time (back_time) oder trigger (back_conditions); None = aus back_s abgeleitet
        vol.Optional("back_kind", default=None): vol.Any(None, vol.In(BACK_KINDS)),
        vol.Optional("back_time", default=None): vol.Any(None, vol.All(str, vol.Match(_TIME_RE)), msg="Uhrzeit ungültig"),
        vol.Optional("back_conditions", default=None): vol.Any(None, dict),
        vol.Optional("back_hold_s", default=0): vol.All(vol.Coerce(int), vol.Range(min=0, max=HOLD_MAX)),
        vol.Optional("back_max_s", default=None): vol.Any(None, _int_in(BACK_MIN, BACK_MAX, "Spätestens nach"), msg=f"Spätestens nach: ganze Zahl von {BACK_MIN} bis {BACK_MAX} erwartet"),
        # Auslöser (seit 2.54.0)
        vol.Optional("conditions", default=None): vol.Any(None, dict),
        vol.Optional("hold_s", default=0): vol.All(vol.Coerce(int), vol.Range(min=0, max=HOLD_MAX)),
        vol.Optional("window", default=None): vol.Any(None, dict),
        vol.Optional("pause_s", default=PAUSE_DEFAULT): _int_in(PAUSE_MIN, PAUSE_MAX, "Pause"),
        vol.Optional("once_trigger", default=False): bool,
        vol.Required("kind"): vol.In(KINDS),
        vol.Optional("delay_s", default=None): vol.Any(None, _int_in(DELAY_MIN, DELAY_MAX, "Dauer"), msg=f"Dauer: ganze Zahl von {DELAY_MIN} bis {DELAY_MAX} erwartet"),
        vol.Optional("date", default=None): vol.Any(None, "", vol.All(str, vol.Match(_DATE_RE)), msg="Datum ungültig"),
        vol.Optional("time", default=None): vol.Any(None, vol.All(str, vol.Match(_TIME_RE)), msg="Uhrzeit ungültig"),
        vol.Optional("repeat", default=None): vol.Any(None, vol.In(REPEATS)),
        vol.Optional("weekdays", default=None): vol.Any(None, [vol.All(int, vol.Range(min=0, max=6))], msg="Wochentage ungültig"),
        vol.Optional("mday", default=None): vol.Any(None, vol.All(int, vol.Range(min=-1, max=31)), msg="Tag des Monats ungültig"),
        vol.Optional("enabled", default=True): bool,
        vol.Optional("push", default=False): bool,
        # Schalter in Home Assistant (seit 2.177.0): die Routine als Entität ein- und ausschalten
        vol.Optional("ha_switch", default=False): bool,
        vol.Optional("target", default=None): vol.Any(None, "", vol.All(str, vol.Match(_NOTIFY_RE)), msg="Empfänger ungültig"),
        vol.Optional("created"): vol.Coerce(float),
    },
    extra=vol.REMOVE_EXTRA,
)


# -- Auslöser: Bedingungen, Zeitfenster, Zurückschalten (seit 2.54.0) ------------------------------


_LEAF_KINDS_ALL = ("above", "below", "is", "change")


def _leaf_shape(raw: Any) -> dict[str, Any]:
    """Eine Bedingung beim Laden prüfen, nur die Form (ob es die Entität gerade gibt, ist beim Start noch offen)."""
    if not isinstance(raw, dict) or not isinstance(raw.get("entity_id"), str) or not _ENTITY_RE.match(raw["entity_id"]):
        raise vol.Invalid("Bedingung ungültig")
    kind = raw.get("kind")
    if kind not in _LEAF_KINDS_ALL:
        raise vol.Invalid("Art der Bedingung unbekannt")
    return {"entity_id": raw["entity_id"], "kind": kind, "value": raw.get("value"), "reset_value": None}


def tree_shape(raw: Any) -> dict[str, Any]:
    """Bedingungsbaum beim Laden: Form prüfen und bereinigen, ohne die Entitäten zu kennen."""
    magic._raw_leaves(raw)  # noqa: SLF001 - gleiche Formprüfung wie bei Magic Push
    items: list[dict[str, Any]] = []
    for item in raw["items"]:
        if isinstance(item, dict) and "items" in item:
            items.append({"op": item.get("op", "and") if item.get("op") in magic.OPS else "and", "items": [_leaf_shape(x) for x in item["items"]]})
        else:
            items.append(_leaf_shape(item))
    return {"op": raw.get("op") if raw.get("op") in magic.OPS else "and", "items": items}


def clean_tree(hass: HomeAssistant, raw: Any) -> dict[str, Any]:
    """
    Bedingungen eines Auslösers prüfen: wie bei Magic Push (Entität gibt es, über/unter mit Zahl, ist mit Zustand, Und/Oder mit
    einer Ebene Gruppen). "Ändert sich" gibt es nur als einzige Bedingung.
    """
    if isinstance(raw, dict) and isinstance(raw.get("items"), list) and len(raw["items"]) == 1:
        only = raw["items"][0]
        if isinstance(only, dict) and "items" not in only and only.get("kind") == "change":
            return {"op": "and", "items": [magic._clean_leaf(hass, only, alone=True)]}  # noqa: SLF001
    tree = magic.clean_conditions(hass, raw)
    for leaf in magic.tree_leaves(tree):
        leaf["reset_value"] = None  # der Rücksetzwert von Magic Push gilt bei Routinen nicht
    return tree


def sole_change(tree: dict[str, Any]) -> dict[str, Any] | None:
    """Die Bedingung, wenn der Baum nur aus "ändert sich" besteht (löst bei jedem Wechsel des Zustands aus)."""
    leaves = magic.tree_leaves(tree)
    return leaves[0] if len(leaves) == 1 and leaves[0]["kind"] == "change" else None


def tree_entities(tree: dict[str, Any] | None) -> list[str]:
    """Entitäten eines Bedingungsbaums ohne Wiederholung."""
    return list(dict.fromkeys(leaf["entity_id"] for leaf in magic.tree_leaves(tree))) if tree else []


def clean_window(raw: Any) -> dict[str, str] | None:
    """Zeitfenster {"from": "22:00", "to": "06:00"} (auch über Mitternacht); leer = ganzer Tag."""
    if not raw:
        return None
    if not isinstance(raw, dict) or not all(isinstance(raw.get(k), str) and _TIME_RE.match(raw[k]) for k in ("from", "to")):
        raise vol.Invalid("Zeitfenster ungültig")
    if raw["from"] == raw["to"]:
        raise vol.Invalid("Das Zeitfenster hat keine Dauer: Beginn und Ende sind gleich")
    return {"from": raw["from"], "to": raw["to"]}


def in_window(window: dict[str, str] | None, now_local: datetime) -> bool:
    """Liegt die Ortszeit im Zeitfenster? Beginn gilt, das Ende nicht mehr; Fenster über Mitternacht (22:00 bis 06:00) gelten für die Nacht."""
    if not window:
        return True
    start, end = (int(a) * 60 + int(b) for a, b in (window["from"].split(":"), window["to"].split(":")))
    current = now_local.hour * 60 + now_local.minute
    return start <= current < end if start < end else current >= start or current < end


def normalize_back(routine: dict[str, Any]) -> dict[str, Any]:
    """
    Zurückschalten nach Art ordnen (none, duration, time, trigger); Nicht-Passendes wird gelöscht. Ohne Angabe der Art gilt wie bisher
    "duration", wenn back_s gesetzt ist. Die Bedingungen des Zurückschaltens prüft clean(), hier nur Pflichtangaben.
    """
    kind = routine.get("back_kind") or ("duration" if routine.get("back_s") else "none")
    routine["back_kind"] = kind
    if kind != "duration":
        routine["back_s"] = None
    elif routine.get("back_s") is None:
        raise vol.Invalid("Zurückschalten: Dauer fehlt")
    if kind != "time":
        routine["back_time"] = None
    elif not routine.get("back_time"):
        raise vol.Invalid("Zurückschalten: Uhrzeit fehlt")
    if kind != "trigger":
        routine.update(back_conditions=None, back_hold_s=0, back_max_s=None)
    elif not routine.get("back_conditions"):
        raise vol.Invalid("Zurückschalten: Bedingungen fehlen")
    return routine


def clean_when(routine: dict[str, Any], tz: Any, *, check_future: bool = True) -> dict[str, Any]:
    """Zeitangaben nach Art prüfen; nicht Passendes wird auf None gesetzt."""
    kind = routine["kind"]
    if kind == "trigger":
        if not routine.get("conditions"):
            raise vol.Invalid("Bedingungen fehlen")
        routine["window"] = clean_window(routine.get("window"))
        routine.update(delay_s=None, date=None, time=None, repeat=None, weekdays=None, mday=None)
        return routine
    # Auslöser-Angaben gelten nur für kind "trigger"
    routine.update(conditions=None, hold_s=0, window=None, once_trigger=False)
    if kind == "countdown":
        if routine["delay_s"] is None:
            raise vol.Invalid("Dauer fehlt")
        routine.update(date=None, time=None, repeat=None, weekdays=None, mday=None)
    elif kind == "once":
        if not routine["time"]:
            raise vol.Invalid("Uhrzeit fehlt")
        # Ohne Datum: nächstes Eintreffen der Uhrzeit, kann nie in der Vergangenheit liegen
        if routine["date"]:
            try:
                at = once_at(routine, tz)
            except ValueError as err:
                raise vol.Invalid("Datum ungültig") from err
            if check_future and routine["enabled"] and at <= dt_util.now(tz):
                raise vol.Invalid("Der Zeitpunkt liegt in der Vergangenheit")
        else:
            routine["date"] = None
        routine.update(delay_s=None, repeat=None, weekdays=None, mday=None)
    else:
        if not routine["time"] or routine["repeat"] is None:
            raise vol.Invalid("Uhrzeit und Wiederholung fehlen")
        if routine["repeat"] == "weekly":
            days = sorted(set(routine["weekdays"] or []))
            if not days:
                raise vol.Invalid("Mindestens ein Wochentag")
            routine["weekdays"] = days
            routine["mday"] = None
        elif routine["repeat"] == "monthly":
            if routine["mday"] is None or routine["mday"] == 0:
                raise vol.Invalid("Tag des Monats fehlt")
            routine["weekdays"] = None
        else:
            routine["weekdays"] = None
            routine["mday"] = None
        routine.update(delay_s=None, date=None)
    return routine


def _trace_step(trace: list[dict[str, Any]] | None, step: str, **values: Any) -> None:
    """Schritt im Ablauf (Trace) festhalten; Angaben ohne Wert entfallen. Das Panel macht daraus die Sätze."""
    if trace is not None:
        trace.append({"s": step, "v": {k: v for k, v in values.items() if v is not None}})


class RoutineManager:
    """Alle Routinen: Speicher, Planung (ein Aufruf je Routine), Ausführen, Zurückschalten, Neustart."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORE_KEY)
        self._routines: dict[str, dict[str, Any]] = {}
        self._runtime: dict[str, dict[str, Any]] = {}
        self._handles: dict[str, CALLBACK_TYPE] = {}
        self._lock = asyncio.Lock()
        self._unsubs: list[CALLBACK_TYPE] = []
        # Ende einer befristeten Pause (seit 2.175.0)
        self._resume_unsub: CALLBACK_TYPE | None = None
        # Auslöser (seit 2.54.0): zuletzt gesehener Stand der Bedingungen (gilt sie, kann sie nicht "neu eintreten"), laufende
        # "mindestens so lange"-Zeiten und die Beobachtung der Entitäten. Nichts davon wird gespeichert: nach einem Neustart
        # gilt der dann herrschende Stand als Ausgangslage, ein schon erfüllter Auslöser schaltet also nicht.
        self._met: dict[str, bool | None] = {}
        self._end_met: dict[str, bool | None] = {}
        self._holds: dict[tuple[str, str], CALLBACK_TYPE] = {}
        self._tracked: frozenset[str] = frozenset()
        self._track: CALLBACK_TYPE | None = None
        # Schalter in HA (seit 2.177.0): Funktion zum Hinzufügen (kommt von der Plattform "switch") und die angelegten Schalter
        self._add_switches: Any = None
        self._switch_entry_id: str | None = None
        self._switches: dict[str, Any] = {}

    # -- Start, Stopp -------------------------------------------------------------

    async def _async_load_stored(self) -> Any:
        """Gespeicherte Routinen; fehlt die neue Datei, wird die alte (Timer) einmal übernommen und gelöscht."""
        stored = await self._store.async_load()
        if stored is not None:
            return stored
        legacy = Store(self.hass, STORAGE_VERSION, LEGACY_STORE_KEY)
        old = await legacy.async_load()
        if not isinstance(old, dict):
            return None
        stored = {"routines": old.get("timers"), "runtime": old.get("runtime")}
        await self._store.async_save(stored)
        await legacy.async_remove()
        return stored

    async def async_start(self) -> None:
        stored = await self._async_load_stored() or {}
        raw = stored.get("routines") if isinstance(stored, dict) else None
        for routine_id, item in (raw.items() if isinstance(raw, dict) else []):
            try:
                routine = self._clean_stored(item)
            except vol.Invalid:
                _LOGGER.warning("Routine: gespeicherte Routine %s ist ungültig und wird ignoriert", routine_id)
                continue
            self._routines[routine["id"]] = routine
        runtime = stored.get("runtime") if isinstance(stored, dict) else None
        for routine_id in self._routines:
            rt = runtime.get(routine_id) if isinstance(runtime, dict) else None
            self._runtime[routine_id] = self._clean_runtime(rt if isinstance(rt, dict) else {})
        self._unsubs.append(self.hass.bus.async_listen(dr.EVENT_DEVICE_REGISTRY_UPDATED, self._on_device_registry))
        async_at_started(self.hass, self._on_started)
        self._plan_resume()

    async def async_stop(self) -> None:
        if self._resume_unsub is not None:
            self._resume_unsub()
            self._resume_unsub = None
        for unsub in self._unsubs:
            unsub()
        self._unsubs = []
        for cancel in self._handles.values():
            cancel()
        self._handles = {}
        for cancel in self._holds.values():
            cancel()
        self._holds = {}
        if self._track is not None:
            self._track()
            self._track = None
            self._tracked = frozenset()
        await self._store.async_save(self._data())

    def _data(self) -> dict[str, Any]:
        return {"routines": self._routines, "runtime": self._runtime}

    def _save(self) -> None:
        self._store.async_delay_save(self._data, 2)

    def _save_now(self) -> None:
        """Sofort schreiben: nach dem Schalten darf ein Absturz nicht vergessen lassen, dass es schon geschehen ist."""
        self.hass.async_create_task(self._store.async_save(self._data()))

    @staticmethod
    def _clean_stored(raw: Any) -> dict[str, Any]:
        routine = ROUTINE_SCHEMA(raw)
        if "id" not in routine:
            raise vol.Invalid("id fehlt")
        # Form prüfen; die Register-Prüfung läuft nur beim Anlegen. Datum in der Vergangenheit ist hier erlaubt.
        clean_when(routine, dt_util.get_default_time_zone(), check_future=False)
        routine["target"] = routine.get("target") or None
        routine["options"] = clean_options(routine["entity_id"].split(".", 1)[0], routine["action"], routine["options"])
        if routine["conditions"]:
            routine["conditions"] = tree_shape(routine["conditions"])
        normalize_back(routine)
        if routine["back_conditions"]:
            routine["back_conditions"] = tree_shape(routine["back_conditions"])
        return routine

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
            # Wann der Auslöser zuletzt geschaltet hat (für die Mindestpause, übersteht einen Neustart)
            "last_trigger": num("last_trigger"),
            "done": num("done"),
            "retry": int(raw["retry"]) if isinstance(raw.get("retry"), int) else 0,
            "rretry": int(raw["rretry"]) if isinstance(raw.get("rretry"), int) else 0,
            "last": last if isinstance(last, dict) else None,
            # Letzter endgültiger Fehlschlag und wann ihn jemand im Routinen-Protokoll gesehen hat (seit 2.172.0, für die Sternschnuppe)
            "fail_at": num("fail_at"),
            "fail_ack": num("fail_ack"),
        }

    @callback
    def _on_started(self, _hass: HomeAssistant) -> None:
        """Nach dem Start: Fälliges nachholen oder überspringen, alles planen."""
        self.hass.async_create_task(self._async_resync())

    async def _async_resync(self) -> None:
        for routine_id in list(self._routines):
            await self._async_process(routine_id)
            # Ausgangslage der Auslöser: der Stand jetzt (was schon gilt, löst nicht aus)
            self._init_met(routine_id)
            if self._waits_for_end(routine_id):
                self._end_met[routine_id] = self._eval(self._routines[routine_id]["back_conditions"])
        self._retrack()
        self._cleanup()

    @callback
    def _on_device_registry(self, event: Event) -> None:
        if event.data.get("action") != "remove":
            return
        gone = event.data.get("device_id")
        for routine in [t for t in self._routines.values() if t["device_id"] == gone]:
            self._forget(routine["id"])
        self._retrack()
        self._save()

    # -- Routine --------------------------------------------------------------------

    def routines(self, device_id: str | None = None) -> list[dict[str, Any]]:
        self._cleanup()
        out = [t for t in self._routines.values() if device_id is None or t["device_id"] == device_id]
        return sorted(out, key=lambda t: (t["name"].casefold(), t["id"]))

    def overdue_s(self, now: float) -> float:
        """Seit wie vielen Sekunden die am längsten überfällige Ausführung oder Rückstellung fällig wäre (0 = nichts überfällig; für die Status-App)."""
        worst = 0.0
        for routine in self._routines.values():
            if not routine["enabled"]:
                continue
            rt = self.runtime(routine["id"])
            for due in (rt["due"], rt["revert_due"]):
                if due is not None:
                    worst = max(worst, now - float(due))
        return worst

    def missed_since(self, since: float) -> int:
        """Zahl der Routinen, deren letzter Lauf seit "since" verpasst wurde (für die Zeile "Letzter Start" der Status-App)."""
        return sum(1 for r in self._routines if (last := self.runtime(r).get("last")) and last.get("what") == "missed" and last.get("at", 0) >= since)

    def paused(self, now: float | None = None) -> bool:
        """Alle Routinen pausiert (Option routines_pause), mit "pausieren bis" nur bis dahin (seit 2.175.0)."""
        opts = effective(self.hass)
        if not opts[CONF_ROUTINES_PAUSE]:
            return False
        until = opts[CONF_ROUTINES_PAUSE_UNTIL]
        return not until or (now if now is not None else time.time()) < until

    def paused_until(self) -> float | None:
        """Bis wann die Pause gilt (Unix-Zeit), None ohne Ende oder ohne Pause."""
        opts = effective(self.hass)
        until = opts[CONF_ROUTINES_PAUSE_UNTIL]
        return float(until) if opts[CONF_ROUTINES_PAUSE] and until else None

    # -- Schalter in Home Assistant (seit 2.177.0) ----------------------------------------------

    @callback
    def attach_switches(self, entry_id: str, add: Any) -> None:
        """Die Plattform "switch" meldet sich an: ab jetzt legt der Manager die Schalter der Routinen an und entfernt sie."""
        self._switch_entry_id = entry_id
        self._add_switches = add
        self._switches = {}
        self._sync_switches()

    @callback
    def detach_switches(self) -> None:
        self._add_switches = None
        self._switches = {}

    @staticmethod
    def switch_unique_id(entry_id: str, routine_id: str) -> str:
        return f"{entry_id}_routine_{routine_id}"

    def switch_entity_id(self, routine_id: str) -> str | None:
        """Entity-ID des Schalters einer Routine (für das Panel); None, wenn es keinen gibt."""
        if self._switch_entry_id is None:
            return None
        return er.async_get(self.hass).async_get_entity_id("switch", DOMAIN, self.switch_unique_id(self._switch_entry_id, routine_id))

    @callback
    def _sync_switches(self) -> None:
        """Schalter anlegen für Routinen mit Haken; entfernen für gelöschte oder abgewählte (samt Eintrag in der Registry)."""
        if self._add_switches is None or self._switch_entry_id is None:
            return
        from .switch import RoutineSwitch  # noqa: PLC0415 - switch.py importiert diese Datei

        wanted = {r["id"] for r in self._routines.values() if r.get("ha_switch")}
        new = [RoutineSwitch(self, self._switch_entry_id, rid) for rid in sorted(wanted - set(self._switches))]
        for entity in new:
            self._switches[entity.routine_id] = entity
        if new:
            self._add_switches(new)
        registry = er.async_get(self.hass)
        prefix = self.switch_unique_id(self._switch_entry_id, "")
        for entry in er.async_entries_for_config_entry(registry, self._switch_entry_id):
            unique = str(entry.unique_id)
            if entry.domain == "switch" and unique.startswith(prefix) and unique[len(prefix) :] not in wanted:
                self._switches.pop(unique[len(prefix) :], None)
                registry.async_remove(entry.entity_id)

    @callback
    def changed(self, routine_id: str | None = None) -> None:
        """Eine Routine (oder die Pause) hat sich geändert: Schalter nachführen und ihren Stand neu schreiben lassen."""
        self._sync_switches()
        async_dispatcher_send(self.hass, SIGNAL_ROUTINES, routine_id)

    @callback
    def async_options_changed(self) -> None:
        """Optionen geändert: das Ende einer befristeten Pause neu planen, den Pause-Schalter in HA nachführen."""
        self._plan_resume()
        self.changed(None)

    @callback
    def _plan_resume(self) -> None:
        """Am Ende der befristeten Pause schaltet sich alles von selbst wieder ein (die Option wird zurückgesetzt, damit man es sieht)."""
        if self._resume_unsub is not None:
            self._resume_unsub()
            self._resume_unsub = None
        until = self.paused_until()
        if until is None:
            return
        if until <= time.time():
            self.hass.async_create_task(self._async_resume())
            return
        self._resume_unsub = async_track_point_in_utc_time(self.hass, self._on_resume_time, dt_util.utc_from_timestamp(until))

    @callback
    def _on_resume_time(self, _now: datetime) -> None:
        self._resume_unsub = None
        self.hass.async_create_task(self._async_resume())

    async def _async_resume(self) -> None:
        entry = next(iter(self.hass.config_entries.async_entries(DOMAIN)), None)
        if entry is None or not effective(self.hass)[CONF_ROUTINES_PAUSE]:
            return
        self.hass.config_entries.async_update_entry(entry, options={**entry.options, CONF_ROUTINES_PAUSE: False, CONF_ROUTINES_PAUSE_UNTIL: 0})
        activity.record(self.hass, "info", "routine", "routines_resumed")

    def failures(self, now: float | None = None) -> dict[str, Any]:
        """
        Routinen mit einem Fehlschlag, den noch niemand im Protokoll gesehen hat und der höchstens FAIL_HOURS Stunden zurückliegt (seit 2.172.0):
        {"at": jüngster Zeitpunkt oder None, "devices": {Geräte-ID: jüngster Zeitpunkt}}. Das Panel zeigt dafür die Sternschnuppe.
        """
        now = now if now is not None else time.time()
        devices: dict[str, float] = {}
        for routine in self._routines.values():
            rt = self.runtime(routine["id"])
            at = rt.get("fail_at")
            if at is None or now - at > FAIL_HOURS * 3600 or at <= (rt.get("fail_ack") or 0):
                continue
            key = routine["device_id"] or ""
            devices[key] = max(devices.get(key, 0.0), at)
        return {"at": max(devices.values(), default=None), "devices": devices}

    def ack_failures(self, device_id: str | None = None, now: float | None = None) -> None:
        """Fehlschläge als gesehen vermerken (das Routinen-Protokoll wurde geöffnet): eines Geräts, ohne Angabe aller Routinen."""
        now = now if now is not None else time.time()
        changed = False
        for routine in self._routines.values():
            if device_id is not None and routine["device_id"] != device_id:
                continue
            rt = self.runtime(routine["id"])
            if rt.get("fail_at") is not None and (rt.get("fail_ack") or 0) < rt["fail_at"]:
                rt["fail_ack"] = max(now, rt["fail_at"])
                changed = True
        if changed:
            self._save()

    def get(self, routine_id: str) -> dict[str, Any] | None:
        return self._routines.get(routine_id)

    def runtime(self, routine_id: str) -> dict[str, Any]:
        return self._runtime.setdefault(routine_id, self._clean_runtime({}))

    @property
    def tz(self) -> Any:
        return dt_util.get_default_time_zone()

    def clean(self, raw: dict[str, Any], *, existing: dict[str, Any] | None = None) -> dict[str, Any]:
        """Entwurf prüfen (gegen Gerät, Entität, Aktion und Zeitangaben); gibt die bereinigte Routine zurück."""
        routine = ROUTINE_SCHEMA(raw)
        registry = er.async_get(self.hass)
        if is_holder(routine["device_id"]):
            if not in_holder(self.hass, routine["device_id"], routine["entity_id"]):
                raise vol.Invalid("Diese Entität gehört nicht zu den Szenen oder Gruppen")
        else:
            if dr.async_get(self.hass).async_get(routine["device_id"]) is None:
                raise vol.Invalid("Gerät nicht gefunden")
            entry = registry.async_get(routine["entity_id"])
            if entry is None or entry.device_id != routine["device_id"]:
                raise vol.Invalid("Die Entität gehört nicht zu diesem Gerät")
        domain = routine["entity_id"].split(".", 1)[0]
        own = registry.async_get(routine["entity_id"])
        if domain not in SERVICES or (own is not None and own.platform == DOMAIN):
            raise vol.Invalid("Diese Entität lässt sich nicht schalten")
        if routine["action"] not in SERVICES[domain]:
            raise vol.Invalid("Diese Aktion gibt es für diese Entität nicht")
        normalize_back(routine)
        if routine["back_kind"] != "none" and not can_back(routine["action"]):
            raise vol.Invalid("Umschalten lässt sich nicht zurückschalten")
        routine["options"] = validate_options(self.hass, routine["entity_id"], routine["action"], routine["options"])
        # "Wie vorher" gilt nur, wenn überhaupt zurückgeschaltet wird; nach "setzen" gibt es kein Gegenstück, nur "wie vorher"
        if routine["back_kind"] == "none":
            routine["back_mode"] = "opposite"
        elif routine["action"] == "set":
            routine["back_mode"] = "restore"
        # Bedingungen des Auslösers und des Zurückschaltens prüfen; die geschaltete Entität darf nicht ihr eigener Auslöser sein
        if routine["kind"] == "trigger" and routine["conditions"]:
            routine["conditions"] = clean_tree(self.hass, routine["conditions"])
        if routine["back_kind"] == "trigger":
            routine["back_conditions"] = clean_tree(self.hass, routine["back_conditions"])
        if routine["entity_id"] in tree_entities(routine["conditions"]) + tree_entities(routine["back_conditions"]):
            raise vol.Invalid("Die geschaltete Entität darf nicht ihr eigener Auslöser sein")
        clean_when(routine, self.tz, check_future=existing is None or not self._same_when(existing, routine))
        routine["target"] = routine.get("target") or None
        if not routine["name"]:
            routine["name"] = self.default_name(routine)
        return routine

    @staticmethod
    def _same_when(old: dict[str, Any], new: dict[str, Any]) -> bool:
        keys = ("kind", "delay_s", "date", "time", "repeat", "weekdays", "mday", "conditions", "hold_s", "window", "pause_s", "once_trigger")
        return all(old.get(k) == new.get(k) for k in keys)

    def default_name(self, routine: dict[str, Any]) -> str:
        state = self.hass.states.get(routine["entity_id"])
        entry = er.async_get(self.hass).async_get(routine["entity_id"])
        device = None if is_holder(routine["device_id"]) else dr.async_get(self.hass).async_get(routine["device_id"])
        return entity_label(routine["entity_id"], entry, device, state)[:NAME_MAX]

    async def async_save_routine(self, raw: dict[str, Any], *, adopt_id: bool = False) -> dict[str, Any]:
        """Routine anlegen oder ändern (mit id). adopt_id: eine unbekannte id bei einer neuen Routine übernehmen (Wiederherstellung einer Sicherung)."""
        existing = self._routines.get(raw.get("id", ""))
        if raw.get("id") and existing is None and not (adopt_id and _ID_RE.match(str(raw["id"]))):
            raise vol.Invalid("Routine nicht gefunden")
        routine = self.clean(raw, existing=existing)
        if existing is not None and existing["device_id"] != routine["device_id"]:
            raise vol.Invalid("Die Routine gehört zu einem anderen Gerät")
        if existing is None:
            if len(self._routines) >= MAX_TOTAL:
                raise vol.Invalid(f"Höchstens {MAX_TOTAL} Routinen insgesamt")
            if not is_holder(routine["device_id"]) and len(self.routines(routine["device_id"])) >= MAX_PER_DEVICE:
                raise vol.Invalid(f"Höchstens {MAX_PER_DEVICE} Routinen pro Gerät")
            routine["id"] = str(raw["id"]) if adopt_id and raw.get("id") else uuid.uuid4().hex[:12]
        routine["created"] = existing["created"] if existing and "created" in existing else time.time()
        self._routines[routine["id"]] = routine
        rt = self.runtime(routine["id"])
        # Neu oder anderer Zeitpunkt: neu planen; sonst bleibt der laufende Stand (zum Beispiel der Countdown)
        if existing is None or not self._same_when(existing, routine) or (routine["enabled"] and not existing["enabled"]):
            self._rearm_runtime(routine, rt)
        elif not routine["enabled"]:
            rt["due"] = None
        self._arm(routine["id"])
        self._init_met(routine["id"])
        self._retrack()
        await self._store.async_save(self._data())
        self.changed(routine["id"])
        return routine

    def _rearm_runtime(self, routine: dict[str, Any], rt: dict[str, Any]) -> None:
        rt.update(retry=0, done=None)
        rt["due"] = first_due(routine, time.time(), self.tz) if routine["enabled"] else None

    async def async_delete_routine(self, routine_id: str) -> bool:
        if routine_id not in self._routines:
            return False
        self._forget(routine_id)
        self._retrack()
        await self._store.async_save(self._data())
        self.changed(routine_id)
        if (proto := self.hass.data.get(DATA_PROTOCOL)) is not None:
            await proto.async_forget(routine_id)
        return True

    async def async_set_enabled(self, routine_id: str, enabled: bool) -> dict[str, Any] | None:
        routine = self._routines.get(routine_id)
        if routine is None:
            return None
        rt = self.runtime(routine_id)
        if enabled:
            if routine["kind"] == "once" and routine.get("date") and once_at(routine, self.tz) <= dt_util.now(self.tz):
                raise vol.Invalid("Der Zeitpunkt liegt in der Vergangenheit")
            routine["enabled"] = True
            self._rearm_runtime(routine, rt)
        else:
            routine["enabled"] = False
            rt.update(due=None, retry=0)
        self._arm(routine_id)
        self._init_met(routine_id)
        self._retrack()
        await self._store.async_save(self._data())
        self.changed(routine_id)
        return routine

    def _forget(self, routine_id: str) -> None:
        if (cancel := self._handles.pop(routine_id, None)) is not None:
            cancel()
        self._routines.pop(routine_id, None)
        self._runtime.pop(routine_id, None)
        self._met.pop(routine_id, None)
        self._end_met.pop(routine_id, None)
        for which in ("start", "end"):
            self._cancel_hold(routine_id, which)

    def _cleanup(self) -> None:
        """Erledigte Countdowns nach 24 Stunden entfernen."""
        now = time.time()
        for routine in [t for t in self._routines.values() if t["kind"] == "countdown"]:
            done = self._runtime.get(routine["id"], {}).get("done")
            if done is not None and now - done > COUNTDOWN_KEEP_S:
                self._forget(routine["id"])
                self._save()
                self.changed(routine["id"])

    # -- Planen -------------------------------------------------------------------

    def _arm(self, routine_id: str) -> None:
        """Einen Aufruf zum nächsten Ereignis (Ausführen, Zurückschalten oder Wiederholen) planen."""
        if (cancel := self._handles.pop(routine_id, None)) is not None:
            cancel()
        routine = self._routines.get(routine_id)
        if routine is None:
            return
        rt = self.runtime(routine_id)
        points = [p for p in (rt["due"] if routine["enabled"] else None, rt["revert_due"]) if p is not None]
        if not points:
            return
        when = max(min(points), time.time() + 1)
        if activity.get(self.hass).debug:
            revert = rt["revert_due"] is not None and min(points) == rt["revert_due"]
            activity.record(self.hass, "debug", "routine", "routine_armed_revert" if revert else "routine_armed", routine["name"], log_device(routine), when=dt_util.as_local(dt_util.utc_from_timestamp(when)).strftime("%d.%m. %H:%M:%S"))
        self._handles[routine_id] = async_track_point_in_utc_time(
            self.hass, partial(self._on_routine, routine_id), dt_util.utc_from_timestamp(when)
        )

    @callback
    def _on_routine(self, routine_id: str, _now: datetime) -> None:
        self._handles.pop(routine_id, None)
        self.hass.async_create_task(self._async_process(routine_id))

    async def _async_process(self, routine_id: str) -> None:
        # Verspätung ab hier messen, nicht erst nach der Sperre: Hängt der Schaltbefehl einer anderen Routine, wartet diese hier,
        # ohne dass sie deshalb als "verpasst" gilt (sie läuft dann spät, statt nie)
        queued = time.time()
        async with self._lock:
            routine = self._routines.get(routine_id)
            if routine is None:
                return
            rt = self.runtime(routine_id)
            now = time.time()
            if rt["revert_due"] is not None and rt["revert_due"] <= now:
                await self._async_revert(routine, rt, now)
            if routine["enabled"] and rt["due"] is not None and rt["due"] <= now:
                await self._async_fire(routine, rt, now, queued)
            self._arm(routine_id)
            self._save_now()

    # -- Ausführen ----------------------------------------------------------------

    def _grace(self) -> float:
        return max(float(effective(self.hass)[CONF_ROUTINES_CATCH_UP]) * 60.0, float(LATE_MIN_S))

    async def _async_call(
        self,
        routine: dict[str, Any],
        action: str,
        *,
        options: dict[str, Any] | None = None,
        snapshot: dict[str, Any] | None = None,
        trace: list[dict[str, Any]] | None = None,
    ) -> tuple[bool, str | None]:
        """
        Entität schalten. Rückgabe (geschafft, Grund): Grund "unavailable" oder "error". Mit "options" wird eingeschaltet wie
        eingestellt, mit "snapshot" die gemerkte Szene wiederhergestellt (ist daraus nichts herzustellen, gilt "action").
        """
        state = self.hass.states.get(routine["entity_id"])
        if state is None or state.state == "unavailable":
            reason = "missing" if state is None else "unavailable"
            _trace_step(trace, "call", ent=routine["entity_id"], state=None if state is None else state.state, err=reason)
            return False, reason
        domain = routine["entity_id"].split(".", 1)[0]
        feats = _features(state)
        calls = restore_calls(domain, routine["entity_id"], snapshot, feats) if snapshot is not None else None
        if calls is None:
            calls = service_calls(domain, routine["entity_id"], action, options, feats)
            if not calls:
                _trace_step(trace, "call", ent=routine["entity_id"], err="error")
                return False, "error"
        names = [f"{call_domain}.{service}" for call_domain, service, _data in calls]
        started = time.monotonic()
        try:
            async with asyncio.timeout(CALL_TIMEOUT_S):
                for i, (call_domain, service, data) in enumerate(calls):
                    if i:
                        await asyncio.sleep(CALL_GAP_S)
                    await self.hass.services.async_call(call_domain, service, data, blocking=True)
        except TimeoutError:
            # Das Gerät antwortet nicht: die Sperre frei geben, damit die anderen Routinen nicht mit hängen
            _LOGGER.warning("Routine '%s': %s antwortet nach %s Sekunden nicht", routine["name"], routine["entity_id"], CALL_TIMEOUT_S)
            _trace_step(trace, "call", ent=routine["entity_id"], svc=names, ms=round((time.monotonic() - started) * 1000), err="timeout")
            return False, "timeout"
        except Exception as err:  # noqa: BLE001 - eine Routine darf nie etwas anderes stören
            _LOGGER.exception("Routine '%s': Schalten von %s fehlgeschlagen", routine["name"], routine["entity_id"])
            _trace_step(trace, "call", ent=routine["entity_id"], svc=names, ms=round((time.monotonic() - started) * 1000), err=f"{type(err).__name__}: {err}")
            return False, "error"
        _trace_step(trace, "call", ent=routine["entity_id"], svc=names, ms=round((time.monotonic() - started) * 1000), state=getattr(self.hass.states.get(routine["entity_id"]), "state", None))
        return True, None

    def _log(self, routine: dict[str, Any], k: str, src: str, *, ok: bool, act: str | None = None, err: str | None = None, late: float | None = None, trace: list[dict[str, Any]] | None = None) -> None:
        """Eintrag im Protokoll der Routine (seit 2.104.0); ein Fehler hier stört die Routine nie."""
        # Nach jedem Lauf den Schalter in HA nachführen (letztes Ergebnis, nächster Lauf); der Lauf hat "last" schon gesetzt
        self.changed(routine.get("id"))
        proto = self.hass.data.get(DATA_PROTOCOL)
        if proto is None or not routine.get("id"):
            return
        proto.add(routine["id"], {"k": k, "src": src, "ok": ok, "act": act, "ent": routine["entity_id"], "err": err, "late": round(late, 1) if late else None, "trace": trace})

    def _entity_name(self, routine: dict[str, Any]) -> str:
        return self.default_name(routine)

    def _action_text(self, routine: dict[str, Any], action: str) -> str:
        """Aktion als Wort für das Protokoll (ein, aus, offen, geschlossen, abgeschlossen, umgeschaltet …)."""
        if action == "restore":
            return push.text(self.hass, "routine_res_restored")
        if action == "set":
            return push.text(self.hass, "routine_res_set", value=self.set_value_text(routine))
        return push.text(self.hass, f"routine_res_{result_word(routine['entity_id'].split('.', 1)[0], action)}")

    def set_value_text(self, routine: dict[str, Any]) -> str:
        """Der Wert, auf den "setzen" stellt, als Text: Zahl mit Einheit der Entität oder die gewählte Auswahl."""
        options = routine.get("options") or {}
        if "option" in options:
            return str(options["option"])
        value = options.get("value")
        if value is None:
            return ""
        state = self.hass.states.get(routine["entity_id"])
        unit = state.attributes.get("unit_of_measurement") if state is not None else None
        return f"{value:g} {unit}" if unit else f"{value:g}"

    def _device_name(self, routine: dict[str, Any]) -> str:
        if is_holder(routine["device_id"]):
            return ""  # das Panel nennt die Sammelstelle selbst ("Szenen", "Gruppen")
        device = dr.async_get(self.hass).async_get(routine["device_id"])
        return (device.name_by_user or device.name or "") if device is not None else ""

    async def _async_fire(self, routine: dict[str, Any], rt: dict[str, Any], now: float, queued: float | None = None) -> None:
        hass = self.hass
        name, device = routine["name"], log_device(routine)
        late = min(now, queued if queued is not None else now) - float(rt["due"])
        src = "trigger" if routine["kind"] == "trigger" else "time"
        trace: list[dict[str, Any]] = []
        _trace_step(trace, "trigger", src=src, due=rt["due"], late=round(late, 1), grace=self._grace())
        if late > self._grace():
            _trace_step(trace, "result", what="missed")
            self._log(routine, "missed", src, ok=False, late=late, trace=trace)
            activity.record(hass, "warning", "routine", "routine_missed", name, device, minutes=int(late // 60))
            rt["last"] = {"at": now, "ok": False, "what": "missed", "reason": None}
            self._finish(routine, rt, now)
            return
        if self.paused():
            _trace_step(trace, "result", what="paused")
            self._log(routine, "paused", src, ok=False, trace=trace)
            activity.record(hass, "info", "routine", "routine_paused", name, device)
            rt["last"] = {"at": now, "ok": False, "what": "paused", "reason": None}
            self._finish(routine, rt, now)
            return
        if routine["window"]:
            _trace_step(trace, "window", window=routine["window"])
        scene = self._take_snapshot(routine, rt)
        if scene is not None:
            _trace_step(trace, "snapshot", state=scene.get("state"))
        ok, reason = await self._async_call(routine, routine["action"], options=routine["options"], trace=trace)
        if ok:
            rt["retry"] = 0
            rt["last"] = {"at": now, "ok": True, "what": "run", "reason": None}
            activity.record(hass, "info", "routine", "routine_run_scene" if routine["action"] == "activate" else "routine_run", name, device, entity=self._entity_name(routine), action=self._action_text(routine, routine["action"]))
            self._plan_revert(routine, rt, now, scene)
            _trace_step(trace, "revert_plan", kind=routine["back_kind"] if rt["revert_action"] else "none", due=rt["revert_due"], back=rt["revert_action"])
            await self._async_notify(routine, ok=True, action=routine["action"], trace=trace)
            _trace_step(trace, "result", what="run")
            self._log(routine, "run", src, ok=True, act=routine["action"], late=late, trace=trace)
            self._finish(routine, rt, now)
            return
        if rt["retry"] < MAX_RETRY:
            rt["retry"] += 1
            rt["due"] = now + RETRY_S
            rt["last"] = {"at": now, "ok": False, "what": "retry", "reason": reason}
            _trace_step(trace, "result", what="retry", count=rt["retry"], next=rt["due"])
            self._log(routine, "retry", src, ok=False, act=routine["action"], err=reason, late=late, trace=trace)
            activity.record(hass, "warning", "routine", "routine_retry", name, device, entity=self._entity_name(routine), minutes=RETRY_S // 60, count=rt["retry"], max=MAX_RETRY)
            return
        rt["last"] = {"at": now, "ok": False, "what": "failed", "reason": reason}
        activity.record(hass, "error", "routine", "routine_failed", name, device, entity=self._entity_name(routine))
        rt["fail_at"] = now
        await self._async_notify(routine, ok=False, action=routine["action"], reason=reason or "error", trace=trace)
        _trace_step(trace, "result", what="failed")
        self._log(routine, "failed", src, ok=False, act=routine["action"], err=reason, late=late, trace=trace)
        self._finish(routine, rt, now)

    def _take_snapshot(self, routine: dict[str, Any], rt: dict[str, Any]) -> dict[str, Any] | None:
        """Die Szene vor dem Schalten, wenn danach "wie vorher" gilt. Wartet noch ein Zurückschalten, gilt dessen Szene weiter."""
        if routine["back_mode"] != "restore" or routine["back_kind"] == "none" or not can_back(routine["action"]):
            return None
        if rt["revert_action"] is not None:
            return rt["snapshot"]
        return snapshot_of(self.hass.states.get(routine["entity_id"]))

    def _plan_revert(self, routine: dict[str, Any], rt: dict[str, Any], now: float, scene: dict[str, Any] | None = None) -> None:
        """
        Das Zurückschalten planen: nach einer Dauer, zur nächsten Uhrzeit oder (durch einen Auslöser) sobald die Bedingung neu
        eintritt, dann mit "spätestens nach" als Sicherung. Das Gegenstück gilt, solange revert_action gesetzt ist.
        """
        back = "set" if routine["action"] == "set" else opposite(routine["action"])
        kind = routine["back_kind"]
        if kind == "none" or not back:
            return
        # Nach "setzen" gibt es nur "wie vorher": war der Wert vorher nicht bekannt, ist nichts zurückzusetzen
        if routine["action"] == "set" and scene is None:
            return
        rt["revert_action"] = back
        rt["rretry"] = 0
        rt["snapshot"] = scene
        if kind == "duration":
            rt["revert_due"] = now + float(routine["back_s"])
        elif kind == "time":
            at = occurrence_after({"kind": "repeat", "repeat": "daily", "time": routine["back_time"]}, dt_util.utc_from_timestamp(now).astimezone(self.tz), self.tz)
            rt["revert_due"] = at.timestamp() if at else None
        else:
            rt["revert_due"] = now + float(routine["back_max_s"]) if routine["back_max_s"] else None
            # Ausgangslage: was beim Einschalten schon gilt, beendet nichts; erst das nächste Eintreten
            self._end_met[routine["id"]] = self._eval(routine["back_conditions"])
            self._retrack()

    def _finish(self, routine: dict[str, Any], rt: dict[str, Any], now: float) -> None:
        """Nach dem Ausführen (oder Verpassen): wiederholte Routinen planen den nächsten, einmalige sind erledigt und aus."""
        rt["retry"] = 0
        if routine["kind"] == "trigger":
            # Ein Auslöser bleibt aktiv und wartet auf das nächste Eintreten; "nur einmal" schaltet ihn danach aus
            rt["due"] = None
            if routine["once_trigger"]:
                rt["done"] = now
                routine["enabled"] = False
                self._retrack()
                self.changed(routine["id"])
            return
        if routine["kind"] == "repeat":
            nxt = occurrence_after(routine, dt_util.utc_from_timestamp(max(now, rt["due"] or now)).astimezone(self.tz), self.tz)
            rt["due"] = nxt.timestamp() if nxt else None
        else:
            rt["due"] = None
            rt["done"] = now
            routine["enabled"] = False
            self.changed(routine["id"])

    async def _async_revert(self, routine: dict[str, Any], rt: dict[str, Any], now: float) -> None:
        hass = self.hass
        name, device = routine["name"], log_device(routine)
        action = rt["revert_action"]
        if action is None:
            rt["revert_due"] = None
            return
        scene = rt["snapshot"] if routine["back_mode"] == "restore" else None
        trace: list[dict[str, Any]] = []
        _trace_step(trace, "trigger", src="revert", due=rt["revert_due"], kind=routine["back_kind"])
        if scene is not None:
            _trace_step(trace, "snapshot", state=scene.get("state"))
        ok, reason = await self._async_call(routine, action, snapshot=scene, trace=trace)
        if ok:
            rt.update(revert_due=None, revert_action=None, rretry=0, snapshot=None)
            self._end_done(routine)
            # Wurde die Szene wiederhergestellt, steht im Protokoll und in der Meldung "wie vorher" statt des Gegenstücks
            shown = "restore" if scene is not None and restore_calls(routine["entity_id"].split(".", 1)[0], routine["entity_id"], scene) is not None else action
            activity.record(hass, "info", "routine", "routine_revert", name, device, entity=self._entity_name(routine), action=self._action_text(routine, shown))
            await self._async_notify(routine, ok=True, action=shown, trace=trace)
            _trace_step(trace, "result", what="revert")
            self._log(routine, "revert", "revert", ok=True, act=shown, trace=trace)
            return
        if rt["rretry"] < MAX_RETRY:
            rt["rretry"] += 1
            rt["revert_due"] = now + RETRY_S
            _trace_step(trace, "result", what="retry", count=rt["rretry"], next=rt["revert_due"])
            self._log(routine, "retry", "revert", ok=False, act=action, err=reason, trace=trace)
            activity.record(hass, "warning", "routine", "routine_retry", name, device, entity=self._entity_name(routine), minutes=RETRY_S // 60, count=rt["rretry"], max=MAX_RETRY)
            return
        rt.update(revert_due=None, revert_action=None, rretry=0, snapshot=None)
        self._end_done(routine)
        activity.record(hass, "error", "routine", "routine_failed", name, device, entity=self._entity_name(routine))
        rt["fail_at"] = now
        await self._async_notify(routine, ok=False, action=action, reason=reason or "error", trace=trace)
        _trace_step(trace, "result", what="failed")
        self._log(routine, "failed", "revert", ok=False, act=action, err=reason, trace=trace)

    async def async_run_now(self, routine_id: str) -> tuple[bool, str | None] | None:
        """Jetzt ausführen (Knopf): schaltet sofort, der Zeitplan bleibt wie er ist; ein Zurückschalten wird geplant."""
        routine = self._routines.get(routine_id)
        if routine is None:
            return None
        async with self._lock:
            rt = self.runtime(routine_id)
            now = time.time()
            trace: list[dict[str, Any]] = []
            _trace_step(trace, "trigger", src="manual")
            scene = self._take_snapshot(routine, rt)
            if scene is not None:
                _trace_step(trace, "snapshot", state=scene.get("state"))
            ok, reason = await self._async_call(routine, routine["action"], options=routine["options"], trace=trace)
            if ok:
                activity.record(self.hass, "info", "routine", "routine_run_scene_manual" if routine["action"] == "activate" else "routine_run_manual", routine["name"], log_device(routine), entity=self._entity_name(routine), action=self._action_text(routine, routine["action"]))
                rt["last"] = {"at": now, "ok": True, "what": "run", "reason": None}
                self._plan_revert(routine, rt, now, scene)
                _trace_step(trace, "revert_plan", kind=routine["back_kind"] if rt["revert_action"] else "none", due=rt["revert_due"], back=rt["revert_action"])
                await self._async_notify(routine, ok=True, action=routine["action"], trace=trace)
                _trace_step(trace, "result", what="run")
                self._log(routine, "run", "manual", ok=True, act=routine["action"], trace=trace)
            else:
                activity.record(self.hass, "error", "routine", "routine_failed", routine["name"], log_device(routine), entity=self._entity_name(routine))
                rt["fail_at"] = now
                rt["last"] = {"at": now, "ok": False, "what": "failed", "reason": reason}
                await self._async_notify(routine, ok=False, action=routine["action"], reason=reason or "error", trace=trace)
                _trace_step(trace, "result", what="failed")
                self._log(routine, "failed", "manual", ok=False, act=routine["action"], err=reason, trace=trace)
            self._arm(routine_id)
            self._save_now()
            return ok, reason

    # -- Auslöser (seit 2.54.0) ----------------------------------------------------

    def _eval(self, tree: dict[str, Any] | None) -> bool | None:
        """Gilt die Bedingung jetzt? None: nicht beurteilbar (nicht erreichbar); wie bei Magic Push."""
        if not tree:
            return None

        def leaf(item: dict[str, Any]) -> bool | None:
            state = self.hass.states.get(item["entity_id"])
            return magic.leaf_met(item, state.state if state is not None else None)

        return magic.eval_tree(tree, leaf)

    def _waits_for_end(self, routine_id: str) -> bool:
        """Wartet die Routine darauf, dass ein Auslöser sie zurückschaltet?"""
        routine = self._routines.get(routine_id)
        return bool(routine and routine["back_kind"] == "trigger" and self.runtime(routine_id)["revert_action"] is not None)

    def _init_met(self, routine_id: str) -> None:
        """Ausgangslage eines Auslösers: der Stand jetzt. Was schon gilt, löst nicht aus; erst ein neues Eintreten."""
        routine = self._routines.get(routine_id)
        self._cancel_hold(routine_id, "start")
        if routine is not None and routine["kind"] == "trigger":
            self._met[routine_id] = self._eval(routine["conditions"])
        else:
            self._met.pop(routine_id, None)

    def _retrack(self) -> None:
        """Die Entitäten beobachten, auf die ein Auslöser oder ein Zurückschalten gerade wartet (ein Abonnement für alle)."""
        wanted: set[str] = set()
        for routine in self._routines.values():
            if routine["kind"] == "trigger" and routine["enabled"]:
                wanted.update(tree_entities(routine["conditions"]))
            if self._waits_for_end(routine["id"]):
                wanted.update(tree_entities(routine["back_conditions"]))
        if frozenset(wanted) == self._tracked:
            return
        if self._track is not None:
            self._track()
            self._track = None
        self._tracked = frozenset(wanted)
        if wanted:
            self._track = async_track_state_change_event(self.hass, sorted(wanted), self._on_state)

    @callback
    def _on_state(self, event: Event) -> None:
        entity_id = event.data["entity_id"]
        old, new = event.data.get("old_state"), event.data.get("new_state")
        for routine in list(self._routines.values()):
            if routine["kind"] == "trigger" and routine["enabled"] and entity_id in tree_entities(routine["conditions"]):
                self._on_tree_event(routine, "start", routine["conditions"], routine["hold_s"], old, new)
            if self._waits_for_end(routine["id"]) and entity_id in tree_entities(routine["back_conditions"]):
                self._on_tree_event(routine, "end", routine["back_conditions"], routine["back_hold_s"], old, new)

    def _on_tree_event(self, routine: dict[str, Any], which: str, tree: dict[str, Any], hold_s: int, old: State | None, new: State | None) -> None:
        """Eine Entität der Bedingung hat sich geändert: tritt die Bedingung NEU ein, ist es ein Auslöser."""
        routine_id = routine["id"]
        if sole_change(tree) is not None:
            # "Ändert sich": bei jedem Wechsel des Zustands (nicht bei blossen Attributen und nicht von oder nach "nicht erreichbar")
            if old is not None and new is not None and old.state != new.state and old.state not in magic.IGNORED and new.state not in magic.IGNORED:
                self._entered(routine, which)
            return
        met = self._eval(tree)
        memory = self._met if which == "start" else self._end_met
        before = memory.get(routine_id)
        if met is None:
            return
        memory[routine_id] = met
        if not met:
            self._cancel_hold(routine_id, which)
        elif before is not True:
            if hold_s:
                self._schedule_hold(routine, which, hold_s)
            else:
                self._entered(routine, which)

    def _schedule_hold(self, routine: dict[str, Any], which: str, seconds: int) -> None:
        self._cancel_hold(routine["id"], which)
        self._holds[(routine["id"], which)] = async_call_later(self.hass, seconds, partial(self._on_hold, routine["id"], which))

    def _cancel_hold(self, routine_id: str, which: str) -> None:
        if (cancel := self._holds.pop((routine_id, which), None)) is not None:
            cancel()

    @callback
    def _on_hold(self, routine_id: str, which: str, _now: datetime) -> None:
        """"Mindestens so lange erfüllt" ist um: gilt die Bedingung noch, löst sie aus."""
        self._holds.pop((routine_id, which), None)
        routine = self._routines.get(routine_id)
        if routine is None:
            return
        tree = routine["conditions"] if which == "start" else routine["back_conditions"]
        if self._eval(tree) is True:
            self._entered(routine, which)

    def _entered(self, routine: dict[str, Any], which: str) -> None:
        if which == "start":
            self._trigger_fire(routine)
        else:
            self._end_fire(routine)

    def _skip(self, routine: dict[str, Any], key: str) -> None:
        if activity.get(self.hass).debug:
            activity.record(self.hass, "debug", "routine", key, routine["name"], log_device(routine))

    def _trigger_fire(self, routine: dict[str, Any]) -> None:
        """Der Auslöser ist eingetreten: schalten, wenn Zeitfenster und Mindestpause es erlauben und die Routine nicht schon eingeschaltet wartet."""
        if not routine["enabled"]:
            return
        rt = self.runtime(routine["id"])
        now = time.time()
        if rt["revert_action"] is not None:
            self._skip(routine, "routine_skip_busy")
            return
        if not in_window(routine["window"], dt_util.now(self.tz)):
            self._skip(routine, "routine_skip_window")
            return
        if rt["last_trigger"] is not None and now - rt["last_trigger"] < routine["pause_s"]:
            self._skip(routine, "routine_skip_pause")
            return
        rt["last_trigger"] = now
        rt["due"] = now
        self.hass.async_create_task(self._async_process(routine["id"]))

    def _end_fire(self, routine: dict[str, Any]) -> None:
        """Die Bedingung des Zurückschaltens ist eingetreten: jetzt zurückschalten."""
        rt = self.runtime(routine["id"])
        if rt["revert_action"] is None:
            return
        rt["revert_due"] = time.time()
        self.hass.async_create_task(self._async_process(routine["id"]))

    def _end_done(self, routine: dict[str, Any]) -> None:
        """Zurückgeschaltet (oder aufgegeben): die Beobachtung des Endes ist vorbei."""
        self._end_met.pop(routine["id"], None)
        self._cancel_hold(routine["id"], "end")
        self._retrack()

    # -- Meldung ------------------------------------------------------------------

    def target(self, routine: dict[str, Any]) -> str:
        """Ziel dieser Routine: das eigene, sonst das Standard-Ziel aus den Einstellungen."""
        return routine.get("target") or notify_target(effective(self.hass), "routines")

    def texts(self, routine: dict[str, Any], *, action: str, ok: bool = True, reason: str = "error", now: float | None = None) -> tuple[str, str]:
        """Titel und Zeile der Meldung; fest vorgegeben (push.py), mit echten Namen und Uhrzeit."""
        hass = self.hass
        clock = dt_util.as_local(dt_util.utc_from_timestamp(now if now is not None else time.time())).strftime("%H:%M")
        domain = routine["entity_id"].split(".", 1)[0]
        entity = self._entity_name(routine)
        if not ok:
            return push.text(hass, "routine_fail_title", name=routine["name"]), push.text(
                hass, "routine_fail_text", entity=entity, reason=push.text(hass, f"routine_reason_{reason}"), time=clock
            )
        if action == "restore":
            return push.text(hass, "routine_title", name=routine["name"]), push.text(hass, "routine_text_restored", entity=entity, time=clock)
        word = result_word(domain, action)
        if word == "set":
            return push.text(hass, "routine_title", name=routine["name"]), push.text(hass, "routine_text_set", entity=entity, value=self.set_value_text(routine), time=clock)
        key = {"toggled": "routine_text_toggled", "activated": "routine_text_activated"}.get(word, "routine_text")
        return push.text(hass, "routine_title", name=routine["name"]), push.text(hass, key, entity=entity, result=push.text(hass, f"routine_res_{word}") if word != "toggled" else "", time=clock)

    async def _async_notify(self, routine: dict[str, Any], *, ok: bool, action: str, reason: str = "error", trace: list[dict[str, Any]] | None = None) -> None:
        """Push nach dem Schalten (nur mit "Per Push melden") oder bei einem Fehler (auch ohne, wenn in den Einstellungen an)."""
        opts = effective(self.hass)
        if (ok and not routine["push"]) or (not ok and not routine["push"] and not opts[CONF_ROUTINES_NOTIFY_ERROR]):
            _trace_step(trace, "notify", res="off")
            return
        title, message = self.texts(routine, action=action, ok=ok, reason=reason)
        outcome: dict[str, Any] = {}
        sent = await self._async_send(routine, title, message, outcome)
        _trace_step(trace, "notify", res="held" if outcome.get("held") else "sent" if sent else "failed", target=self.target(routine), title=title, err=outcome.get("err"))

    async def _async_send(self, routine: dict[str, Any], title: str, message: str, outcome: dict[str, Any] | None = None) -> bool:
        hass = self.hass
        opts = effective(hass)
        target = self.target(routine)
        holder = is_holder(routine["device_id"])
        device = None if holder else dr.async_get(hass).async_get(routine["device_id"])
        if target == NOTIFY_NONE or (device is None and not holder):
            activity.record(hass, "info", "routine", "routine_no_target", routine["name"], log_device(routine))
            if outcome is not None:
                outcome["err"] = "no_target"
            return False
        # Ohne Gerät (Szene, Gruppe) öffnet die Meldung das Panel, ohne Integrationsbild
        icon = await push_icon.async_integration_icon(hass, primary_domain(hass, device)) if device is not None else None
        url = push.device_url(opts[CONF_NOTIFY_CLICK], device.id) if device is not None else push.panel_url()
        data = push.notification_data(hass, f"{DOMAIN}_routine_{routine.get('id', 'test')}", url, icon=icon)
        return await push.async_push(hass, target, title, message, data, topic="routines", outcome=outcome)

    def preview_raw(self, raw: dict[str, Any]) -> dict[str, Any]:
        """Vorschau für einen Entwurf: Meldungstext, nächste Ausführungen und der Satz; Name darf fehlen."""
        routine = self.clean({**raw, "enabled": True}, existing=None)
        title, message = self.texts(routine, action=routine["action"])
        return {
            "title": title,
            "message": message,
            "name": routine["name"],
            "target": self.target(routine),
            "next_runs": next_runs(routine, time.time(), self.tz),
        }

    async def async_try(self, entity_id: str, action: str, options: Any = None) -> tuple[bool, str | None]:
        """
        Jetzt ausführen im Assistenten (seit 2.28.0): schaltet einmal, ohne Routine, Zurückschalten, Protokoll und Meldung.
        Mit Schaltoptionen (seit 2.52.0) in genau der eingestellten Stärke, damit sich prüfen lässt, wie es wirklich wirkt.
        """
        domain = entity_id.split(".", 1)[0]
        if domain not in SERVICES or action not in SERVICES[domain]:
            raise vol.Invalid("action not possible for this entity")
        clean = validate_options(self.hass, entity_id, action, options)
        return await self._async_call({"entity_id": entity_id, "action": action, "name": entity_id}, action, options=clean)

    async def async_test(self, raw: dict[str, Any]) -> bool:
        """Test: die echte Meldung (ohne zu schalten) an den gewählten Empfänger."""
        routine = self.clean({**raw, "enabled": True}, existing=None)
        title, message = self.texts(routine, action=routine["action"])
        activity.record(self.hass, "info", "routine", "routine_test", routine["name"], log_device(routine))
        return await self._async_send(routine, title, message)


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


def holder_entity_ids(hass: HomeAssistant, holder: str) -> list[str]:
    """Entitäten einer Sammelstelle (Szenen oder Gruppen ohne Gerät), nach Namen sortiert; deaktivierte und ausgeblendete bleiben weg."""
    registry = er.async_get(hass)
    found = []
    for state in hass.states.async_all():
        entry = registry.async_get(state.entity_id)
        if entry is not None and (entry.disabled_by is not None or entry.hidden_by is not None):
            continue
        if in_holder(hass, holder, state.entity_id):
            found.append((str(state.attributes.get("friendly_name") or state.entity_id).casefold(), state.entity_id))
    return [eid for _, eid in sorted(found)]


def switchable_entities(hass: HomeAssistant, device_id: str) -> list[dict[str, Any]]:
    """
    Entitäten des Geräts, die eine Routine schalten kann (ohne deaktivierte). Ausgeblendete zählen mit (seit 2.52.0): "Versteckt" heisst
    nur, dass Home Assistant sie nicht in automatischen Dashboards zeigt, so versteckt es zum Beispiel einzelne Hue-Lampen einer Gruppe.
    """
    if is_holder(device_id):
        payloads = [entity_payload(hass, eid) for eid in holder_entity_ids(hass, device_id)]
        return [p for p in payloads if p["actions"]]
    entries = er.async_entries_for_device(er.async_get(hass), device_id)
    # Die eigenen Schalter (Pause, Routinen) schaltet keine Routine: sonst würde eine Routine die Routinen anhalten oder sich selbst schalten
    wanted = [e for e in entries if e.domain in SERVICES and e.disabled_by is None and e.platform != DOMAIN]
    payloads = [entity_payload(hass, e.entity_id) for e in sorted(wanted, key=lambda e: (e.entity_category is not None, e.entity_id))]
    # Klima und Medien ohne jede Aktion (Gerät kann weder ein noch aus noch etwas einstellen) sind nicht schaltbar
    return [p for p in payloads if p["actions"]]


def switchable_devices(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Geräte mit mindestens einer Entität, die eine Routine schalten kann (für "Routine hinzufügen" im Fenster aller Routinen, seit 2.27.0)."""
    counts: dict[str, int] = {}
    names: dict[str, list[str]] = {}
    devices = dr.async_get(hass)
    for entry in er.async_get(hass).entities.values():
        state = hass.states.get(entry.entity_id)
        if entry.device_id and entry.domain in SERVICES and entry.platform != DOMAIN and entry.disabled_by is None and actions_for_state(entry.domain, state):
            counts[entry.device_id] = counts.get(entry.device_id, 0) + 1
            # Namen der Entitäten, damit die Suche im Assistenten auch eine Szene oder Lampe in einem Gerät findet (seit 2.63.0)
            names.setdefault(entry.device_id, []).append(entity_label(entry.entity_id, entry, devices.async_get(entry.device_id), state))
    out = []
    for device_id, n in counts.items():
        device = devices.async_get(device_id)
        if device is None or device.disabled_by is not None:
            continue
        out.append({"id": device_id, "name": device.name_by_user or device.name or device_id, "entities": n, "names": names.get(device_id, [])})
    out.sort(key=lambda d: d["name"].casefold())
    # Szenen und Gruppen ohne Gerät (seit 2.61.0) zuletzt, nur wenn es welche gibt
    registry = er.async_get(hass)
    for holder in HOLDERS:
        if ids := holder_entity_ids(hass, holder):
            # items: jede Szene und Gruppe einzeln, damit der Assistent sie bei der Suche direkt als eigene Zeile zeigt (seit 2.65.0)
            items = [{"id": e, "name": entity_label(e, registry.async_get(e), None, hass.states.get(e))} for e in ids]
            out.append({"id": holder, "name": "", "entities": len(ids), "holder": True, "names": [i["name"] for i in items], "items": items})
    return out


def routine_payload(hass: HomeAssistant, manager: RoutineManager, routine: dict[str, Any]) -> dict[str, Any]:
    """Routine mit Stand für das Panel: nächster Lauf, Zurückschalten, zuletzt, erledigt, Entität."""
    rt = manager.runtime(routine["id"])
    registry = er.async_get(hass)
    entity = entity_payload(hass, routine["entity_id"])
    exists = registry.async_get(routine["entity_id"]) is not None or hass.states.get(routine["entity_id"]) is not None
    return {
        **{k: v for k, v in routine.items() if not k.startswith("_")},
        "due": rt["due"] if routine["enabled"] else None,
        "due_local": local_parts(rt["due"], manager.tz) if routine["enabled"] and rt["due"] is not None else None,
        "revert_due": rt["revert_due"],
        "revert_local": local_parts(rt["revert_due"], manager.tz) if rt["revert_due"] is not None else None,
        "last": rt["last"],
        "done": rt["done"],
        "running": routine["kind"] == "countdown" and routine["enabled"] and rt["due"] is not None,
        # Wartet auf das Zurückschalten (seit 2.26.0): die Routine ist geschaltet, die Rückstellung steht noch aus; zählt für den Reiter "Läuft"
        "reverting": rt["revert_action"] is not None,
        # Auslöser (seit 2.54.0): wartet auf das Zurückschalten durch einen Auslöser; Sätze der Bedingungen und die Entitäten dazu
        "waiting_end": rt["revert_action"] is not None and routine["back_kind"] == "trigger",
        "last_trigger": rt["last_trigger"],
        "condition_text": magic.condition_text(hass, {"conditions": routine["conditions"]}) if routine["conditions"] else "",
        "back_condition_text": magic.condition_text(hass, {"conditions": routine["back_conditions"]}) if routine["back_conditions"] else "",
        "condition_entities": {
            eid: magic.entity_descriptor(hass, eid) for eid in dict.fromkeys(tree_entities(routine["conditions"]) + tree_entities(routine["back_conditions"]))
        },
        "entity_name": entity["name"],
        "entity_state": entity["state"],
        "entity_missing": not exists,
        "domain": entity["domain"],
        "actions": entity["actions"],
        # Wert, auf den "setzen" stellt (Zahl mit Einheit oder Auswahl), für den Satz im Panel (seit 2.80.0)
        "set_text": manager.set_value_text(routine) if routine["action"] == "set" else "",
        "next_runs": next_runs(routine, time.time(), manager.tz) if routine["enabled"] and routine["kind"] != "countdown" else [],
        "device_name": manager._device_name(routine),
        # Entity-ID des Schalters in HA (seit 2.177.0), sobald der Haken gesetzt und der Schalter angelegt ist
        "ha_entity": manager.switch_entity_id(routine["id"]) if routine.get("ha_switch") else None,
    }


def targets(hass: HomeAssistant, current: list[str]) -> list[dict[str, Any]]:
    """Empfänger zur Wahl (wie bei Magic Push)."""
    return targets_payload(hass, current)
