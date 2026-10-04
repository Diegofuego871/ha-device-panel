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
from homeassistant.util import dt as dt_util

from .ai_prompt import DEFAULT_PROMPT, render_prompt
from .const import AI_TIMEOUT, CONF_AI_ASSESSMENT, CONF_AI_PROMPT, CONF_AI_TASK
from .devices import async_list_devices
from .options_api import effective

LANGUAGES = {"de": "German (Swiss spelling: always 'ss', never the sharp s)", "en": "English"}


class AiError(Exception):
    """Fehler mit Code für das Panel: disabled, not_found, no_ai_task, timeout, failed."""

    def __init__(self, code: str, message: str = "") -> None:
        super().__init__(message or code)
        self.code = code


def _minutes(seconds: float | None) -> int | None:
    return None if seconds is None else int(round(seconds / 60))


def build_facts(device: dict[str, Any], result: dict[str, Any], now: float) -> dict[str, Any]:
    """
    Fakten zu einem Gerät aus der Geräteliste (async_list_devices), ohne IDs,
    Adressen oder Entitätsnamen. Fehlende Angaben fehlen im Ergebnis.
    """
    devices = result["devices"]
    integ = device.get("integration") or {}
    domain = integ.get("domain")
    names = result.get("integrations", {})
    status = (
        "not monitored" if device.get("unmonitored")
        else "disabled" if device.get("disabled")
        else "no data" if device.get("online") is None
        else "offline" if device["online"] is False
        else "unstable (online, but often interrupted)" if device.get("flaky")
        else "online"
    )
    facts: dict[str, Any] = {
        "name": device["name"],
        "status": status,
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
    if device.get("online") is False and device.get("offline_since"):
        since = dt_util.parse_datetime(device["offline_since"])
        if since is not None:
            facts["offline_for_minutes"] = max(0, _minutes(now - since.timestamp()) or 0)
            facts["offline_start_is_lower_bound"] = bool(device.get("since_at_least"))
    avail = device.get("avail24")
    if avail:
        facts["last_24h"] = {
            "availability_percent": avail.get("pct"),
            "interruptions": avail.get("outages"),
            "longest_interruption_minutes": _minutes(avail.get("longest")),
        }
    if (battery := device.get("battery")) and battery.get("level") is not None:
        facts["battery_percent"] = battery["level"]
        facts["battery_low"] = bool(battery.get("low"))
    if (signal := device.get("signal")) and signal.get("value") is not None:
        facts["signal"] = {"kind": signal.get("kind"), "value": signal["value"]}
    # Hub (Verbindung über ...) im selben Bild: fällt er selbst aus?
    if device.get("via"):
        hub = next((d for d in devices if d["name"] == device["via"]), None)
        if hub is not None:
            facts["hub_online"] = hub.get("online")
    # Lage bei der Integration: sind andere Geräte derselben gerade auch weg?
    if domain:
        same = [d for d in devices if (d.get("integration") or {}).get("domain") == domain and d["id"] != device["id"] and not d.get("unmonitored")]
        facts["same_integration_other_devices"] = {"total": len(same), "offline_now": sum(1 for d in same if d.get("online") is False)}
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
    facts = build_facts(device, result, now.timestamp())
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
    facts = build_facts(device, result, dt_util.utcnow().timestamp())
    chosen = template.strip() or effective(hass)[CONF_AI_PROMPT]
    return {"text": build_instructions(facts, language, chosen)}
