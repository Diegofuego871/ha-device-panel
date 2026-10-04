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
import re
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

from .ai_prompt import DEFAULT_PROMPT, render_prompt
from .const import AI_TIMEOUT, CONF_AI_ASSESSMENT, CONF_AI_PROMPT, CONF_AI_TASK, SIGNAL_OFF, SIGNAL_WEAK_DBM, SIGNAL_WEAK_LQI
from .battery_history import async_battery_history, battery_entity
from .devices import async_list_devices, device_battery_threshold
from .options_api import effective

# Höchstens so viele andere ausgefallene Geräte der Integration in den Fakten.
SAME_OFFLINE_MAX = 10
# Höchstens so viele Geräte des Bereichs mit ihren Werten (seit 1.6.0).
SAME_AREA_MAX = 15
# Ausfälle innerhalb dieser Zeit gelten als gleichzeitig mit dem Gerät.
SAME_TIME_SECONDS = 300

LANGUAGES = {"de": "German (Swiss spelling: always 'ss', never the sharp s)", "en": "English"}


class AiError(Exception):
    """Fehler mit Code für das Panel: disabled, not_found, no_ai_task, timeout, failed."""

    def __init__(self, code: str, message: str = "") -> None:
        super().__init__(message or code)
        self.code = code


def _minutes(seconds: float | None) -> int | None:
    return None if seconds is None else int(round(seconds / 60))


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
        item["signal_weak"] = signal_weak(signal, d.get("signal_setting"))
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
    weak = sig.get("value") is not None and signal_weak(sig, d.get("signal_setting"))
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
        "connected_via": device.get("via"),
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
        if fc := extra.get("forecast"):
            # Prognose aus dem Batterie-Verlauf (seit 1.6.0, wie im Panel).
            if fc.get("status") == "ok":
                facts["battery_forecast"] = {"days_left": round(fc["days"]), "until_percent": fc["target"], "confidence": fc["confidence"], "drop_is_accelerating": bool(fc.get("accelerating"))}
            elif fc.get("status") == "reached":
                facts["battery_forecast"] = {"status": "warning threshold reached"}
            elif fc.get("status") == "flat":
                facts["battery_forecast"] = {"status": "level barely drops"}
    if (signal := device.get("signal")) and signal.get("value") is not None:
        # "weak" wie im Panel, mit der Empfang-Warnung des Geräts (seit 1.4.0):
        # Die KI braucht keine Schwellen, und ein akzeptierter Empfang zählt.
        setting = device.get("signal_setting")
        facts["signal"] = {"kind": signal.get("kind"), "value": signal["value"], "weak": signal_weak(signal, setting)}
        if setting is not None:
            facts["signal"]["own_threshold"] = setting
    # Hub (Verbindung über ...) im selben Bild: fällt er selbst aus?
    if device.get("via"):
        hub = next((d for d in devices if d["name"] == device["via"]), None)
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


def build_instructions(facts: dict[str, Any], language: str, template: str = "") -> str:
    """
    Anweisung an die KI: die Vorlage (eigener Prompt oder Standard) mit der
    Sprache der Antwort und den Fakten als JSON.
    """
    lang = LANGUAGES.get(language, LANGUAGES["en"])
    return render_prompt(template or DEFAULT_PROMPT, json.dumps(facts, ensure_ascii=False, indent=1), lang)


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


def source_name(hass: HomeAssistant, entity_id: str | None) -> str | None:
    """Name der KI-Aufgabe für "Erstellt von …" (gewählte, sonst die Standard-Aufgabe von HA)."""
    if entity_id is None:
        try:
            from homeassistant.components.ai_task.const import DATA_PREFERENCES  # noqa: PLC0415

            entity_id = hass.data[DATA_PREFERENCES].gen_data_entity_id
        except Exception:  # noqa: BLE001 - Interna von ai_task: ohne sie kein Name
            return None
    state = hass.states.get(entity_id) if entity_id else None
    return state.name if state else entity_id


async def _extras(hass: HomeAssistant, device: dict[str, Any], log: Any, now: float) -> dict[str, Any]:
    """Fakten, die nicht in der Geräteliste stehen (seit 1.6.0): Verfügbarkeit 7 Tage, Batterie-Prognose."""
    extra: dict[str, Any] = {}
    if log is not None:
        extra["week"] = log.device_summary(device["id"], 7 * 86400, now)
    if device.get("has_battery") and (device.get("battery") or {}).get("level") is not None:
        reg = dr.async_get(hass).async_get(device["id"])
        entity_id = battery_entity(hass, er.async_entries_for_device(er.async_get(hass), device["id"])) if reg else None
        if reg is not None and entity_id:
            threshold = device_battery_threshold(hass, effective(hass), reg)
            extra["forecast"] = (await async_battery_history(hass, entity_id, "365d", threshold, now))["forecast"]
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
    facts = build_facts(device, result, now.timestamp(), await _extras(hass, device, log, now.timestamp()))
    entity_id = opts[CONF_AI_TASK] or None
    data = await _generate(hass, entity_id, build_instructions(facts, language, opts[CONF_AI_PROMPT]))
    text = data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)
    if not text.strip():
        raise AiError("failed", "empty answer")
    title, body = split_answer(text)
    return {"title": title, "text": body, "source": source_name(hass, entity_id), "at": now.isoformat()}


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
    facts = build_facts(device, result, now, await _extras(hass, device, log, now))
    chosen = template.strip() or effective(hass)[CONF_AI_PROMPT]
    return {"text": build_instructions(facts, language, chosen)}
