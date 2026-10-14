"""
KI-Einschätzung eines Geräts (seit 0.33.0, docs/mockups/backlog-v1, Punkt 10 A).

Nur auf Knopfdruck im Geräte-Popup und nur mit eingeschalteter Option: Das
Panel schickt die Fakten eines einzelnen Geräts (Name, Bereich, Werte, Lage
bei der Integration) an eine KI-Aufgabe von Home Assistant (ai_task) und zeigt
die Antwort. Geschickt werden nie Schlüssel, Zugangsdaten, IDs, Adressen oder
Entitätsnamen. Je nach Anbieter verlassen die Fakten das eigene Netz; deshalb
ist die Option standardmässig aus.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from typing import Any

from homeassistant.config_entries import ConfigEntryState
from homeassistant.const import STATE_UNAVAILABLE
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

from . import activity
from .ai_prompt import DEFAULT_PROMPT, GROUP_PLACEHOLDERS, render_prompt
from .const import AI_TIMEOUT, CONF_AI_ASSESSMENT, CONF_AI_PROMPT, CONF_AI_TASK, DATA_SIGNAL, SIGNAL_OFF, SIGNAL_WEAK_DBM, SIGNAL_WEAK_LQI
from .battery_history import async_battery_history, battery_entity
from . import ai_memory
from .battery_guard import get as battery_guard
from .charge import ChargeNotifier
from .compat import device_entry_ids
from .devices import async_list_devices, device_battery_threshold
from .options_api import effective

# Höchstens so viele andere ausgefallene Geräte der Integration in den Fakten.
SAME_OFFLINE_MAX = 10
# Höchstens so viele Geräte des Bereichs mit ihren Werten (seit 1.6.0).
SAME_AREA_MAX = 15
# Batterie der letzten 12 Monate: höchstens so viele Monate und Wechsel (seit 1.8.0).
BATTERY_MONTHS_MAX = 12
BATTERY_CHANGES_MAX = 6
# Ausfälle innerhalb dieser Zeit gelten als gleichzeitig mit dem Gerät.
SAME_TIME_SECONDS = 300
# Die letzten Ausfälle der Woche und die Empfänger der letzten 24 Std. in den Fakten (seit 2.42.0).
OUTAGES_MAX = 6
RECEIVERS_MAX = 4
# Längste Anweisung an die KI in Zeichen (seit 2.45.0); darüber werden die Listen der Fakten gekürzt (etwa 4500 Token).
INSTRUCTIONS_MAX = 18000
PREVIOUS_TEXT_MAX = 800
# Bluetooth-Adressen (aa:bb:cc:dd:ee:ff) gehören nicht in die Fakten; HA nennt Proxys oft "Name (Adresse)".
_MAC_RE = re.compile(r"\s*\(?\b[0-9A-Fa-f]{2}(?:[:-][0-9A-Fa-f]{2}){5}\b\)?")
_LOGGER = logging.getLogger(__name__)

LANGUAGES = {"de": "German (Swiss spelling: always 'ss', never the sharp s)", "en": "English"}


def clean(text: Any) -> Any:
    """Adressen aus einem Namen entfernen ("Küche (B0:A7:32:46:E3:C2)" wird "Küche"); andere Werte bleiben."""
    if not isinstance(text, str):
        return text
    return _MAC_RE.sub("", text).strip() or text


class AiError(Exception):
    """Fehler mit Code für das Panel: disabled, not_found, no_ai_task, timeout, failed, empty."""

    def __init__(self, code: str, message: str = "") -> None:
        super().__init__(message or code)
        self.code = code


def _minutes(seconds: float | None) -> int | None:
    return None if seconds is None else int(round(seconds / 60))


def _signal_limit(d: dict[str, Any]) -> Any:
    """Wirksame Empfang-Warnung (seit 1.17.0): das Gerät, sonst die Integration oder der globale Wert."""
    own = d.get("signal_setting")
    return own if own is not None else (d.get("signal_default") or {}).get("value")


def signal_weak(signal: dict[str, Any], setting: Any) -> bool:
    """
    Schwacher Empfang wie im Panel (devSigLevel): Empfang-Warnung "off" ist nie
    schwach, eine eigene Schwelle heisst "schwach unter X", sonst der Standard.
    """
    value = signal["value"]
    if setting == SIGNAL_OFF:
        return False
    if isinstance(setting, int) and not isinstance(setting, bool):
        return value < setting
    return value < SIGNAL_WEAK_DBM if signal.get("kind") == "dbm" else value <= SIGNAL_WEAK_LQI


def _since(d: dict[str, Any]) -> float | None:
    """Beginn des Ausfalls (Sekunden) oder None."""
    if d.get("online") is not False or not d.get("offline_since"):
        return None
    since = dt_util.parse_datetime(d["offline_since"])
    return since.timestamp() if since is not None else None


def _status(device: dict[str, Any]) -> str:
    return (
        "not monitored" if device.get("unmonitored")
        else "disabled" if device.get("disabled")
        else "no data" if device.get("online") is None
        else "offline" if device["online"] is False
        else "unstable (online, but often interrupted)" if device.get("flaky")
        else "online"
    )


def _offline_list(devices: list[dict[str, Any]], now: float, extra: Any, ref: float | None = None) -> list[dict[str, Any]]:
    """
    Ausgefallene Geräte mit Name, einer weiteren Angabe (extra(d) -> dict) und
    Minuten seit dem Ausfall; die längsten zuerst, höchstens SAME_OFFLINE_MAX.
    Mit ref (Beginn des Ausfalls des eingeschätzten Geräts, seit 1.6.0) steht
    dabei, ob ein Gerät innerhalb von SAME_TIME_SECONDS davon ausfiel.
    """
    gone = [(at, d) for d in devices if (at := _since(d)) is not None]
    gone.sort(key=lambda x: x[0])
    out = []
    for at, d in gone[:SAME_OFFLINE_MAX]:
        item = {"name": d["name"], **extra(d), "offline_minutes": max(0, _minutes(now - at) or 0)}
        if ref is not None:
            item["went_offline_within_5_min_of_this_device"] = abs(at - ref) <= SAME_TIME_SECONDS
        out.append({k: v for k, v in item.items() if v is not None})
    return out


# Typen, die geladen und nicht mit Batterien bestückt werden (seit 2.44.0): Staubsauger- und Mähroboter, Handy und Computer.
RECHARGEABLE_TYPES = ("vacuum", "phone")
# Ab so vielen Anstiegen im Verlauf eines Jahres gilt ein Gerät als wahrscheinlich geladen (Batteriewechsel gibt es höchstens ein bis zwei).
RECHARGEABLE_RISES = 3


def battery_kind(device: dict[str, Any], rechargeable: bool, year: dict[str, Any] | None) -> tuple[str, str] | None:
    """
    Wird das Gerät geladen oder mit neuen Batterien bestückt (seit 2.44.0, Wunsch des Nutzers: das soll erkannt werden)?
    ("rechargeable" | "probably_rechargeable", Grund) oder None, wenn das Panel es nicht belegen kann; dann entscheidet die KI
    nach Typ, Hersteller und Modell. Belege in dieser Reihenfolge: Ladeanzeige des Geräts oder eingerichtete Lademeldung,
    ein Ladevorgang jetzt, ein Typ, der immer geladen wird, viele Anstiege im Verlauf.
    """
    charging = device.get("charging") or {}
    if charging.get("source") == "entity":
        return "rechargeable", "the device has its own charging indicator"
    if rechargeable:
        return "rechargeable", "the charging notification is set up for it (or it has a charging indicator)"
    if charging:
        return "rechargeable", "its battery level is rising right now"
    if device.get("type") in RECHARGEABLE_TYPES:
        return "rechargeable", f"device type {device['type']} is charged, not fitted with new batteries"
    rises = (year or {}).get("battery_changes", 0) + (year or {}).get("battery_charges", 0)
    if rises >= RECHARGEABLE_RISES:
        return "probably_rechargeable", f"{rises} rises of the level in the history (battery changes are rarer)"
    return None


def battery_year(history: dict[str, Any], now: float) -> dict[str, Any] | None:
    """
    Batterie der letzten 12 Monate in Kürze (seit 1.8.0, Wunsch des Nutzers) aus
    dem Batterie-Verlauf: Mittel und Tiefstand je Kalendermonat, die Wechsel mit
    Alter und Stand davor und danach, Tiefstand insgesamt. Ohne Punkte None.
    """
    points = history.get("points") or []
    if not points:
        return None
    months: dict[str, list[float]] = {}
    for at, value in points:
        months.setdefault(dt_util.as_local(dt_util.utc_from_timestamp(at)).strftime("%Y-%m"), []).append(value)
    keys = sorted(months)[-BATTERY_MONTHS_MAX:]
    out: dict[str, Any] = {
        "monthly_percent": {k: {"average": round(sum(months[k]) / len(months[k])), "lowest": round(min(months[k]))} for k in keys},
        "lowest_percent": round(min(v for _t, v in points)),
        "days_covered": max(0, round((now - points[0][0]) / 86400)),
    }
    changes = history.get("changes") or []
    # Ist für das Gerät die Lademeldung aktiv, ist ein Anstieg ein Ladevorgang und kein Batteriewechsel (seit 2.32.0, wie im
    # Fenster "Batterie"): Die KI soll ihn "Laden" nennen und nicht auf einen Wechsel schliessen.
    kind = "charge" if history.get("charging") else "change"
    out[f"battery_{kind}s"] = len(changes)
    if changes:
        out[f"recent_{kind}s"] = [
            {"days_ago": max(0, round((now - c["at"]) / 86400)), "from_percent": c["from"], "to_percent": c["to"]}
            for c in reversed(changes[-BATTERY_CHANGES_MAX:])
        ]
    return out


# Ab so vielen Tagen Verlauf gilt die Prognose nicht mehr als dünn belegt.
FORECAST_DAYS_OK = 30


def battery_forecast_fact(fc: dict[str, Any]) -> dict[str, Any] | None:
    """
    Prognose aus dem Batterie-Verlauf als Fakt (seit 1.6.0, wie im Panel). Seit
    1.10.0 (Wunsch des Nutzers) mit Spanne, Verlaufstagen und dem Vermerk
    "uncertain" samt Gründen: Sicherheit nicht "high", der Rückgang wird
    steiler (Prognose eher zu optimistisch) oder weniger als FORECAST_DAYS_OK
    Tage Verlauf. Die KI soll eine unsichere Prognose nicht als Tatsache nennen.
    """
    status = fc.get("status")
    if status == "reached":
        return {"status": "warning threshold reached"}
    if status == "flat":
        return {"status": "level barely drops"}
    if status == "short":
        return {"status": "too little history for a forecast", "days_of_history": round(fc.get("days_used") or 0), "uncertain": True}
    if status != "ok":
        return None
    days = fc.get("days_used") or 0
    reasons = []
    if fc.get("confidence") != "high":
        reasons.append(f"confidence {fc.get('confidence')}")
    if fc.get("accelerating"):
        reasons.append("the drop is getting steeper, so the forecast is probably too optimistic")
    if days < FORECAST_DAYS_OK:
        reasons.append(f"only {round(days)} days of history")
    item: dict[str, Any] = {
        "days_left": round(fc["days"]),
        "days_range": {"min": round(fc["days_low"]) if fc.get("days_low") is not None else None, "max": round(fc["days_high"]) if fc.get("days_high") is not None else None},
        "until_percent": fc["target"],
        "confidence": fc["confidence"],
        "days_of_history": round(days),
        "drop_is_accelerating": bool(fc.get("accelerating")),
        "uncertain": bool(reasons),
    }
    item["days_range"] = {k: v for k, v in item["days_range"].items() if v is not None}
    if reasons:
        item["uncertain_reasons"] = reasons
    return item


def _peer(d: dict[str, Any], now: float, names: dict[str, str], ref: float | None) -> dict[str, Any]:
    """Ein Gerät des Bereichs mit seinen Werten (seit 1.6.0), ohne IDs und Entitäten."""
    dom = (d.get("integration") or {}).get("domain")
    item: dict[str, Any] = {
        "name": d["name"],
        "type": d.get("type"),
        "integration": names.get(dom, dom) if dom else None,
        "connection_type": d.get("connection"),
        "status": _status(d),
    }
    if (at := _since(d)) is not None:
        item["offline_minutes"] = max(0, _minutes(now - at) or 0)
        if ref is not None:
            item["went_offline_within_5_min_of_this_device"] = abs(at - ref) <= SAME_TIME_SECONDS
    if (signal := d.get("signal")) and signal.get("value") is not None:
        item["signal_value"] = signal["value"]
        item["signal_weak"] = signal_weak(signal, _signal_limit(d))
    if (battery := d.get("battery")) and battery.get("level") is not None:
        item["battery_percent"] = battery["level"]
        item["battery_low"] = bool(battery.get("low"))
    if (avail := d.get("avail24")) and avail.get("outages"):
        item["interruptions_24h"] = avail["outages"]
    return {k: v for k, v in item.items() if v is not None}


def _peer_rank(d: dict[str, Any]) -> tuple[Any, ...]:
    """Auffällige zuerst: ausgefallen (längste zuerst), instabil, schwacher Empfang oder Batterie, dann nach Name."""
    at = _since(d)
    sig = d.get("signal") or {}
    weak = sig.get("value") is not None and signal_weak(sig, _signal_limit(d))
    low = bool((d.get("battery") or {}).get("low"))
    tier = 0 if at is not None else 1 if d.get("flaky") else 2 if weak or low else 3
    return (tier, at if at is not None else 0, d["name"].lower())


def build_facts(device: dict[str, Any], result: dict[str, Any], now: float, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    Fakten zu einem Gerät aus der Geräteliste (async_list_devices), ohne IDs,
    Adressen oder Entitätsnamen. Fehlende Angaben fehlen im Ergebnis. extra
    (seit 1.6.0, aus _extras): "week" (Verfügbarkeit 7 Tage) und "forecast"
    (Batterie-Prognose), beides nicht in der Geräteliste.
    """
    extra = extra or {}
    devices = result["devices"]
    integ = device.get("integration") or {}
    domain = integ.get("domain")
    names = result.get("integrations", {})
    facts: dict[str, Any] = {
        "name": device["name"],
        "status": _status(device),
        "type": device.get("type"),
        "area": device.get("area"),
        "integration": names.get(domain, integ.get("title") or domain) if domain else None,
        "manufacturer": device.get("manufacturer"),
        "model": device.get("model"),
        "software_version": device.get("sw_version"),
        "connection_type": device.get("connection"),
        "connected_via": clean(device.get("via")),
        "update_available": device.get("update"),
    }
    ref = _since(device)
    if ref is not None:
        facts["offline_for_minutes"] = max(0, _minutes(now - ref) or 0)
        facts["offline_start_is_lower_bound"] = bool(device.get("since_at_least"))
    avail = device.get("avail24")
    if avail:
        facts["last_24h"] = {
            "availability_percent": avail.get("pct"),
            "interruptions": avail.get("outages"),
            "longest_interruption_minutes": _minutes(avail.get("longest")),
        }
    # Chronik über 7 Tage (seit 1.6.0): Dauerproblem oder Einzelfall?
    if (week := extra.get("week")) and week.get("pct") is not None:
        facts["last_7d"] = {
            "availability_percent": week.get("pct"),
            "interruptions": week.get("outages"),
            "longest_interruption_minutes": _minutes(week.get("longest")),
        }
    # Batterie- oder Netzgerät (seit 1.4.0): Schlafende Batteriegeräte melden
    # sich seltener; ein Netzgerät fällt eher mit dem Strom aus.
    facts["battery_powered"] = bool(device.get("has_battery"))
    if (battery := device.get("battery")) and battery.get("level") is not None:
        facts["battery_percent"] = battery["level"]
        facts["battery_low"] = bool(battery.get("low"))
        year = extra.get("battery_year")
        if year:
            facts["battery_last_12_months"] = year
        # Geladen oder mit Batterien bestückt (seit 2.44.0): bei einem geladenen Gerät sagt "Tage bis zur Warnschwelle" nichts.
        kind = battery_kind(device, bool(extra.get("rechargeable")), year)
        if kind:
            facts["battery_kind"], facts["battery_kind_reason"] = kind
        if charging := device.get("charging"):
            since = dt_util.parse_datetime(charging["since"]) if charging.get("since") else None
            facts["charging_now"] = {
                k: v
                for k, v in {
                    "since_minutes": _minutes(now - since.timestamp()) if since else None,
                    "from_percent": charging.get("from"),
                    "percent": charging.get("level"),
                }.items()
                if v is not None
            }
        if (fc := extra.get("forecast")) and not (kind and kind[0] == "rechargeable"):
            if forecast_fact := battery_forecast_fact(fc):
                facts["battery_forecast"] = forecast_fact
    if (signal := device.get("signal")) and signal.get("value") is not None:
        # "weak" wie im Panel, mit der Empfang-Warnung des Geräts (seit 1.4.0):
        # Die KI braucht keine Schwellen, und ein akzeptierter Empfang zählt.
        setting = _signal_limit(device)
        facts["signal"] = {"kind": signal.get("kind"), "value": signal["value"], "weak": signal_weak(signal, setting)}
        if setting is not None:
            # Vom Besitzer gesetzt: am Gerät, für die Integration oder global (seit 1.17.0).
            facts["signal"]["own_threshold"] = setting
    # Läuft die Integration überhaupt (seit 2.45.0)? Ein Eintrag, der nicht "loaded" ist (setup_retry, setup_error ...), erklärt den Ausfall aller Geräte.
    if problems := extra.get("integration_problem"):
        facts["integration_problem"] = problems
    # Wie viele Entitäten des Geräts fehlen: alle (Gerät weg) oder nur einzelne (Teilproblem)?
    if entities := extra.get("entities"):
        facts["entities"] = entities
    if (started := extra.get("home_assistant_started_minutes_ago")) is not None:
        facts["home_assistant_started_minutes_ago"] = started
    # Der Batterie-Sensor meldet zwischendurch unmögliche Werte (seit 2.45.0): vom Panel verworfen, aber ein Hinweis auf einen unzuverlässigen Sensor.
    if (glitches := extra.get("battery_glitches")) and "battery_percent" in facts:
        facts["battery_sensor_glitches_7d"] = glitches
    # Die letzte Einschätzung der KI zu diesem Gerät (seit 2.45.0): was hat sich seither geändert?
    if previous := extra.get("previous"):
        facts["previous_assessment"] = previous
    # Die letzten Ausfälle der Woche (seit 2.42.0): zu welcher Tageszeit, wie lange? Zeigt Muster wie "jede Nacht um 3 Uhr".
    if outages := extra.get("recent_outages"):
        facts["recent_outages_7d"] = outages
    # Empfang der letzten 24 Std. und 7 Tage aus der Aufzeichnung des Panels (seit 2.42.0): Schwankt er, oder ist er dauerhaft schlecht?
    if (trend := extra.get("signal_trend")) and "signal" in facts:
        facts["signal"].update(trend)
    # Bluetooth: über welche Empfänger das Gerät in den letzten 24 Std. gehört wurde (seit 2.42.0). Wechselt es oft zwischen weit
    # entfernten Empfängern, erklärt das schwankenden Empfang; fällt der Empfänger aus, erklärt es den Ausfall.
    if path := extra.get("bluetooth_path"):
        facts["bluetooth_receivers_24h"] = path
    # Hub (Verbindung über ...) im selben Bild: fällt er selbst aus?
    if device.get("via"):
        hub = next((d for d in devices if d["name"] == device["via"] or d["name"] == clean(device["via"])), None)
        if hub is not None:
            facts["hub_online"] = hub.get("online")
        # Andere Geräte am selben Hub (seit 1.6.0): wie viele, wie viele fehlen, wie viele im selben Raum.
        at_hub = [d for d in devices if d.get("via") == device["via"] and d["id"] != device["id"] and not d.get("unmonitored") and not d.get("disabled")]
        if at_hub:
            facts["same_hub_other_devices"] = {
                "total": len(at_hub),
                "offline_now": sum(1 for d in at_hub if d.get("online") is False),
                "in_same_area": sum(1 for d in at_hub if device.get("area_id") and d.get("area_id") == device["area_id"]),
            }
            if gone := _offline_list(at_hub, now, lambda d: {"area": d.get("area")}, ref):
                facts["same_hub_offline_devices"] = gone
    # Gleiches Modell (seit 1.6.0): Serienfehler oder fehlerhafte Firmware?
    if device.get("manufacturer") and device.get("model"):
        twins = [
            d for d in devices
            if d["id"] != device["id"] and d.get("manufacturer") == device["manufacturer"] and d.get("model") == device["model"]
            and not d.get("unmonitored") and not d.get("disabled")
        ]
        if twins:
            facts["same_model_other_devices"] = {"total": len(twins), "offline_now": sum(1 for d in twins if d.get("online") is False)}
            if device.get("sw_version"):
                same_sw = [d for d in twins if d.get("sw_version") == device["sw_version"]]
                facts["same_model_other_devices"]["same_software_version"] = {"total": len(same_sw), "offline_now": sum(1 for d in same_sw if d.get("online") is False)}
    # Lage bei der Integration: sind andere Geräte derselben gerade auch weg?
    if domain:
        same = [d for d in devices if (d.get("integration") or {}).get("domain") == domain and d["id"] != device["id"] and not d.get("unmonitored")]
        facts["same_integration_other_devices"] = {"total": len(same), "offline_now": sum(1 for d in same if d.get("online") is False)}
        # Welche davon fehlen (seit 1.3.0, Wunsch des Nutzers): Name, Bereich, Dauer;
        # die längsten zuerst, höchstens SAME_OFFLINE_MAX. Zeigt Muster (derselbe
        # Bereich, derselbe Zeitpunkt), die Zahlen allein nicht zeigen.
        if gone := _offline_list(same, now, lambda d: {"area": d.get("area")}, ref):
            facts["same_integration_offline_devices"] = gone
    # Lage im Bereich, über alle Integrationen (seit 1.4.0): Fallen in einem
    # Raum Geräte verschiedener Funkarten zugleich aus, liegt es eher am Strom
    # oder am Netz dort als an einem Gerät.
    if device.get("area_id"):
        here = [
            d for d in devices
            if d.get("area_id") == device["area_id"] and d["id"] != device["id"] and not d.get("unmonitored") and not d.get("disabled")
        ]
        facts["same_area_other_devices"] = {"total": len(here), "offline_now": sum(1 for d in here if d.get("online") is False)}
        # Dasselbe Funkprotokoll im Raum (seit 1.6.0): Fällt nur Thread oder nur
        # Bluetooth aus, liegt es am Funk, nicht am Raum.
        if conn := device.get("connection"):
            same_conn = [d for d in here if d.get("connection") == conn]
            if same_conn:
                facts["same_area_same_connection"] = {"connection_type": conn, "total": len(same_conn), "offline_now": sum(1 for d in same_conn if d.get("online") is False)}
        # Die Geräte des Bereichs mit ihren Werten (seit 1.6.0, Wunsch des Nutzers),
        # auffällige zuerst, höchstens SAME_AREA_MAX; auch gesunde, als Gegenbeweis.
        if here:
            facts["same_area_devices"] = [_peer(d, now, names, ref) for d in sorted(here, key=_peer_rank)[:SAME_AREA_MAX]]
    # Sammelausfälle der letzten 24 Std., an denen das Gerät beteiligt war.
    mine = [
        {
            "minutes_ago": _minutes(now - inc["at"]),
            "devices_affected": inc["count"],
            "common_integration": names.get(inc.get("integration"), inc.get("integration")),
        }
        for inc in result.get("incidents", [])
        if device["id"] in inc.get("devices", [])
    ]
    if mine:
        facts["mass_outages_24h_involving_this_device"] = mine
    return {k: v for k, v in facts.items() if v is not None}


def _shrink_steps() -> list[tuple[str, Any]]:
    """Schritte, mit denen die Fakten kürzer werden, vom Unwichtigsten zum Wichtigsten; (Name, Funktion auf die Fakten)."""

    def cut(key: str, size: int) -> Any:
        def run(facts: dict[str, Any]) -> bool:
            value = facts.get(key)
            if isinstance(value, list) and len(value) > size:
                facts[key] = value[:size] if size else None
                if size == 0:
                    facts.pop(key, None)
                return True
            return False

        return run

    def months(size: int) -> Any:
        def run(facts: dict[str, Any]) -> bool:
            monthly = (facts.get("battery_last_12_months") or {}).get("monthly_percent")
            if isinstance(monthly, dict) and len(monthly) > size:
                for key in sorted(monthly)[: len(monthly) - size]:
                    del monthly[key]
                return True
            return False

        return run

    def previous(size: int) -> Any:
        def run(facts: dict[str, Any]) -> bool:
            item = facts.get("previous_assessment")
            if isinstance(item, dict) and len(item.get("text", "")) > size:
                item["text"] = item["text"][:size].rstrip() + " …"
                return True
            return False

        return run

    return [
        ("same_area_devices", cut("same_area_devices", 8)), ("same_area_devices", cut("same_area_devices", 4)),
        ("same_integration_offline_devices", cut("same_integration_offline_devices", 5)),
        ("same_hub_offline_devices", cut("same_hub_offline_devices", 5)),
        ("battery_last_12_months", months(6)), ("recent_outages_7d", cut("recent_outages_7d", 3)),
        ("previous_assessment", previous(300)), ("same_area_devices", cut("same_area_devices", 0)),
        ("same_integration_offline_devices", cut("same_integration_offline_devices", 0)),
        ("same_hub_offline_devices", cut("same_hub_offline_devices", 0)), ("battery_last_12_months", months(3)),
    ]


def fit_facts(facts: dict[str, Any], language: str, template: str = "", limit: int = INSTRUCTIONS_MAX) -> tuple[dict[str, Any], list[str]]:
    """
    Die Fakten so kürzen, dass die ganze Anweisung höchstens limit Zeichen hat (seit 2.45.0): zu lange Anweisungen scheitern bei
    manchen Anbietern oder kosten unnötig. Gekürzt werden zuerst die Listen anderer Geräte, zuletzt die Batterie-Monate; die Angaben
    zum Gerät selbst bleiben. Gibt (Fakten, Namen der gekürzten Teile) zurück; die Fakten werden nicht verändert, wenn nichts zu kürzen ist.
    """
    if len(build_instructions(facts, language, template)) <= limit:
        return facts, []
    work = json.loads(json.dumps(facts))
    trimmed: list[str] = []
    for name, step in _shrink_steps():
        if step(work):
            if name not in trimmed:
                trimmed.append(name)
            if len(build_instructions(work, language, template)) <= limit:
                break
    return work, trimmed


def build_instructions(facts: dict[str, Any], language: str, template: str = "") -> str:
    """
    Anweisung an die KI: die Vorlage (eigener Prompt oder Standard) mit der
    Sprache der Antwort und den Fakten als JSON, alle in {facts} oder nur die
    Gruppen, die die Vorlage nennt ({facts_area} usw., seit 1.7.0).
    """
    lang = LANGUAGES.get(language, LANGUAGES["en"])

    def dump(data: dict[str, Any]) -> str:
        return json.dumps(data, ensure_ascii=False, indent=1)

    groups = {name: dump({k: facts[k] for k in keys if k in facts}) for name, keys in GROUP_PLACEHOLDERS.items()}
    return render_prompt(template or DEFAULT_PROMPT, dump(facts), lang, groups)


def split_answer(text: str) -> tuple[str, str]:
    """Erste Zeile als Überschrift, wenn sie kurz ist und Text folgt; sonst nur Text."""
    clean = text.strip()
    head, _, rest = clean.partition("\n")
    head = re.sub(r"^[#*\s]+|[*\s]+$", "", head)
    rest = rest.strip()
    if rest and 0 < len(head) <= 80:
        return head, rest
    return "", clean


async def _generate(hass: HomeAssistant, entity_id: str | None, instructions: str) -> Any:
    """Die KI-Aufgabe von Home Assistant aufrufen; getrennt, damit Tests sie ersetzen können."""
    if "ai_task" not in hass.config.components:
        raise AiError("no_ai_task", "ai_task is not loaded")
    from homeassistant.components.ai_task import async_generate_data  # noqa: PLC0415

    try:
        async with asyncio.timeout(AI_TIMEOUT):
            result = await async_generate_data(
                hass, task_name="Device Panel assessment", entity_id=entity_id, instructions=instructions
            )
    except TimeoutError as err:
        raise AiError("timeout", "the AI task did not answer in time") from err
    except HomeAssistantError as err:
        # Keine Entität gewählt und keine Standard-Aufgabe, Entität weg, Anbieter-Fehler.
        code = "no_ai_task" if "no preferred entity" in str(err) or "not found" in str(err) else "failed"
        raise AiError(code, str(err)) from err
    return result.data


def default_entity(hass: HomeAssistant) -> str | None:
    """Die KI-Aufgabe, die der Benutzer in Home Assistant unter "KI-Vorschläge" bei "Aufgaben zur Datengenerierung" gewählt hat."""
    try:
        from homeassistant.components.ai_task.const import DATA_PREFERENCES  # noqa: PLC0415

        return hass.data[DATA_PREFERENCES].gen_data_entity_id
    except Exception:  # noqa: BLE001 - Interna von ai_task: ohne sie keine Standard-Aufgabe
        return None


def ai_ready(hass: HomeAssistant, entity_id: str | None = None) -> bool:
    """Gibt es eine KI-Aufgabe, die die Einschätzung ausführen kann (seit 2.38.0)?

    Ja, wenn eine gewählte Aufgabe (Einstellung des Panels) existiert oder Home Assistant eine Standard-Aufgabe gewählt hat und diese
    existiert. Ohne beides würde jeder Aufruf mit "no preferred entity" scheitern; dann lässt sich die Funktion nicht einschalten.
    """
    return any(e and hass.states.get(e) is not None for e in (entity_id or None, default_entity(hass)))


def source_name(hass: HomeAssistant, entity_id: str | None) -> str | None:
    """Name der KI-Aufgabe für "Erstellt von …" (gewählte, sonst die Standard-Aufgabe von HA)."""
    if entity_id is None:
        entity_id = default_entity(hass)
    state = hass.states.get(entity_id) if entity_id else None
    return state.name if state else entity_id


def _recent_outages(log: Any, device_id: str, now: float) -> list[dict[str, Any]]:
    """Die letzten Ausfälle der 7 Tage (neueste zuerst): wie lange her, wie lange, Uhrzeit (Ortszeit) und Wochentag des Beginns."""
    try:
        outages = log.history(device_id, "7d", now).get("outages") or []
    except Exception:  # noqa: BLE001 - die Fakten sind eine Zugabe, die Einschätzung geht auch ohne sie
        return []
    out = []
    for start, end in sorted(outages, reverse=True)[:OUTAGES_MAX]:
        local = dt_util.as_local(dt_util.utc_from_timestamp(start))
        still = end >= now - 60
        out.append({
            "started_minutes_ago": _minutes(now - start),
            "duration_minutes": _minutes(end - start),
            "still_offline": still,
            "local_start_time": local.strftime("%H:%M"),
            "weekday": local.strftime("%A"),
        })
    return out


def _context_extras(hass: HomeAssistant, device_id: str, log: Any, now: float) -> dict[str, Any]:
    """Zusammenhang, den die Geräteliste nicht zeigt (seit 2.45.0): Zustand der Integration, Entitäten des Geräts, Start von Home Assistant."""
    extra: dict[str, Any] = {}
    reg = dr.async_get(hass).async_get(device_id)
    if reg is not None:
        problems = sorted({
            entry.state.value
            for eid in device_entry_ids(reg)
            if (entry := hass.config_entries.async_get_entry(eid)) is not None and entry.state is not ConfigEntryState.LOADED
        })
        if problems:
            extra["integration_problem"] = problems
    entries = [e for e in er.async_entries_for_device(er.async_get(hass), device_id) if not e.disabled_by]
    if entries:
        gone = sum(1 for e in entries if (state := hass.states.get(e.entity_id)) is None or state.state == STATE_UNAVAILABLE)
        extra["entities"] = {"total": len(entries), "unavailable": gone}
    started = getattr(log, "_started", None)
    if isinstance(started, (int, float)):
        extra["home_assistant_started_minutes_ago"] = _minutes(now - started)
    return extra


def _signal_extras(hass: HomeAssistant, device_id: str, now: float) -> dict[str, Any]:
    """Verlauf des Empfangs und Weg des Bluetooth-Empfangs aus der Aufzeichnung des Panels (seit 2.42.0); leer ohne beides."""
    sig = hass.data.get(DATA_SIGNAL)
    if sig is None:
        return {}
    extra: dict[str, Any] = {}
    try:
        trend: dict[str, Any] = {}
        points: list[list[float]] = []
        for key, name in (("24h", "last_24h"), ("7d", "last_7d")):
            blocks, bucket = sig.history(device_id, key, now)
            if blocks:
                med = sorted(b[1] for b in blocks)[len(blocks) // 2]
                trend[name] = {"median": round(med, 1), "worst": round(min(b[2] for b in blocks), 1), "best": round(max(b[3] for b in blocks), 1)}
                if key == "24h":
                    points = [[b[0] + bucket / 2, b[1]] for b in blocks]
        if trend:
            extra["signal_trend"] = trend
        via = sig.via_summary(device_id, "24h", now, points)
        if via and via.get("receivers"):
            extra["bluetooth_path"] = {
                "receivers": [
                    {"name": clean(r["name"]), "share_percent": r["share"], **({"average_dbm": r["avg"]} if r.get("avg") is not None else {})}
                    for r in via["receivers"][:RECEIVERS_MAX]
                ],
                "switches": len(via.get("changes") or []),
                "gaps_not_received": any(seg[2] is None for seg in via.get("segments", [])),
            }
    except Exception:  # noqa: BLE001 - nur eine Zugabe
        return {}
    return extra


async def _extras(hass: HomeAssistant, device: dict[str, Any], log: Any, now: float) -> dict[str, Any]:
    """Fakten, die nicht in der Geräteliste stehen (seit 1.6.0): Verfügbarkeit 7 Tage, Batterie-Prognose, Batterie 12 Monate."""
    extra: dict[str, Any] = {}
    if log is not None:
        extra["week"] = log.device_summary(device["id"], 7 * 86400, now)
    if log is not None:
        extra["recent_outages"] = _recent_outages(log, device["id"], now)
    extra.update(_signal_extras(hass, device["id"], now))
    extra.update(_context_extras(hass, device["id"], log, now))
    if device.get("has_battery") and (device.get("battery") or {}).get("level") is not None:
        reg = dr.async_get(hass).async_get(device["id"])
        if reg is not None:
            extra["rechargeable"] = ChargeNotifier.rechargeable(effective(hass), hass, reg)
        if glitch_entity := battery_entity(hass, er.async_entries_for_device(er.async_get(hass), device["id"])):
            extra["battery_glitches"] = battery_guard(hass).ignored(glitch_entity, now)
        entity_id = battery_entity(hass, er.async_entries_for_device(er.async_get(hass), device["id"])) if reg else None
        if reg is not None and entity_id:
            threshold = device_battery_threshold(hass, effective(hass), reg)
            charging = ChargeNotifier.rechargeable(effective(hass), hass, reg)
            history = await async_battery_history(hass, entity_id, "365d", threshold, now, charging=charging)
            extra["forecast"] = history["forecast"]
            extra["battery_year"] = battery_year(history, now)
    return extra


async def async_assess(hass: HomeAssistant, device_id: str, language: str, log: Any = None) -> dict[str, Any]:
    """Einschätzung eines Geräts: {"title", "text", "source", "at"}; wirft AiError."""
    opts = effective(hass)
    if not opts[CONF_AI_ASSESSMENT]:
        raise AiError("disabled", "AI assessment is switched off")
    result = await async_list_devices(hass, log)
    device = next((d for d in result["devices"] if d["id"] == device_id), None)
    if device is None:
        raise AiError("not_found", "device not found")
    now = dt_util.utcnow()
    memory = await ai_memory.async_get(hass)
    extra = await _extras(hass, device, log, now.timestamp())
    if previous := _previous(memory.get(device_id, now.timestamp()), now.timestamp()):
        extra["previous"] = previous
    facts = build_facts(device, result, now.timestamp(), extra)
    facts, trimmed = fit_facts(facts, language, opts[CONF_AI_PROMPT])
    if trimmed:
        activity.record(hass, "info", "system", "ai_trimmed", device["name"], device_id, parts=", ".join(trimmed), limit=INSTRUCTIONS_MAX)
    entity_id = opts[CONF_AI_TASK] or None
    instructions = build_instructions(facts, language, opts[CONF_AI_PROMPT])
    started = time.monotonic()
    text = ""
    try:
        # Eine leere Antwort (zum Beispiel ein Modell, das seine Ausgabe in der Denkphase verbraucht) bekommt einen zweiten Versuch.
        for attempt in (1, 2):
            data = await _generate(hass, entity_id, instructions)
            text = data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)
            if text.strip():
                break
            if attempt == 1:
                activity.record(hass, "info", "system", "ai_empty_retry", device["name"], device_id)
        if not text.strip():
            raise AiError("empty", "the AI task returned an empty answer twice")
    except AiError as err:
        # Der Grund steht sonst nur im Protokoll von Home Assistant: hier mit Prompt-Grösse und Aufgabe, damit er sich finden lässt.
        activity.record(
            hass, "warning", "system", "ai_failed", device["name"], device_id,
            reason=err.code, detail=str(err), chars=len(instructions), task=entity_id or source_name(hass, None) or "-",
        )
        raise
    title, body = split_answer(text)
    activity.record(
        hass, "debug", "system", "ai_done", device["name"], device_id,
        chars=len(instructions), answer=len(text), seconds=round(time.monotonic() - started, 1),
    )
    source = source_name(hass, entity_id)
    memory.set(device_id, title, body, source, facts.get("status"), now.timestamp())
    return {"title": title, "text": body, "source": source, "at": now.isoformat()}


async def async_preview(
    hass: HomeAssistant, device_id: str, language: str, template: str = "", log: Any = None
) -> dict[str, str]:
    """
    Der Text, der an die KI ginge, für ein Gerät (Vorschau im Profi-Modus):
    {"text"}. Schickt nichts. template leer = gespeicherter Prompt, sonst der
    Entwurf aus dem Fenster (geprüft). Wirft AiError("not_found"|"invalid_prompt").
    """
    from .ai_prompt import prompt_problem  # noqa: PLC0415

    if template.strip() and (problem := prompt_problem(template.strip())):
        raise AiError("invalid_prompt", problem)
    result = await async_list_devices(hass, log)
    device = next((d for d in result["devices"] if d["id"] == device_id), None)
    if device is None:
        raise AiError("not_found", "device not found")
    now = dt_util.utcnow().timestamp()
    memory = await ai_memory.async_get(hass)
    extra = await _extras(hass, device, log, now)
    if previous := _previous(memory.get(device_id, now), now):
        extra["previous"] = previous
    chosen = template.strip() or effective(hass)[CONF_AI_PROMPT]
    facts, _trimmed = fit_facts(build_facts(device, result, now, extra), language, chosen)
    return {"text": build_instructions(facts, language, chosen)}


def _previous(item: dict[str, Any] | None, now: float) -> dict[str, Any] | None:
    """Die letzte Einschätzung als Fakt: wie lange her, Überschrift, Text (gekürzt) und der Status damals."""
    if not item:
        return None
    out: dict[str, Any] = {
        "minutes_ago": _minutes(now - item["at"]),
        "headline": item.get("title") or None,
        "text": item["text"][:PREVIOUS_TEXT_MAX],
        "device_status_then": item.get("status"),
    }
    return {k: v for k, v in out.items() if v is not None}


async def async_last(hass: HomeAssistant, device_id: str) -> dict[str, Any] | None:
    """Die gemerkte letzte Einschätzung eines Geräts für das Pop-up ({title, text, source, at}) oder None (Funktion aus, noch keine)."""
    if not effective(hass)[CONF_AI_ASSESSMENT]:
        return None
    item = (await ai_memory.async_get(hass)).get(device_id)
    if item is None:
        return None
    return {"title": item["title"], "text": item["text"], "source": item.get("source"), "at": dt_util.utc_from_timestamp(item["at"]).isoformat()}
