"""Profi-Modus der KI-Einschätzung (1.2.0): eigener Prompt mit {language} und {facts}."""

from __future__ import annotations

import json
import time
from typing import Any

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel import ai_assessment
from custom_components.device_panel.ai_prompt import DEFAULT_PROMPT, ai_prompt, prompt_problem, render_prompt
from custom_components.device_panel.const import AI_PROMPT_MAX, DATA_AVAILABILITY, DOMAIN


@pytest.fixture
async def setup(hass: HomeAssistant):
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    hass.data[DATA_AVAILABILITY]._started = time.time() - 3600


def _lamp(hass: HomeAssistant) -> dr.DeviceEntry:
    source = MockConfigEntry(domain="test", title="Eintrag")
    source.add_to_hass(hass)
    device = dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={("test", "Lampe")}, name="Lampe")
    entry = er.async_get(hass).async_get_or_create("light", "test", f"{device.id}-l", device_id=device.id)
    hass.states.async_set(entry.entity_id, "on")
    return device


def test_default_prompt_has_both_placeholders_and_is_valid() -> None:
    assert "{language}" in DEFAULT_PROMPT and DEFAULT_PROMPT.rstrip().endswith("{facts}")
    assert prompt_problem(DEFAULT_PROMPT) is None
    # Standard oder leer = Standard (nichts gespeichert)
    assert ai_prompt(DEFAULT_PROMPT) == "" and ai_prompt("") == "" and ai_prompt("  \n") == "" and ai_prompt(None) == ""


@pytest.mark.parametrize(
    ("text", "problem"),
    [
        ("Beurteile das Gerät. Antworte auf {language}.", "no_facts"),
        ("Fakten: {facts} und {name}", "unknown:{name}"),
        ("{facts} {Language}", "unknown:{Language}"),
        ("x" * AI_PROMPT_MAX + "{facts}", "too_long"),
    ],
)
def test_prompt_problems(text: str, problem: str) -> None:
    assert prompt_problem(text) == problem
    with pytest.raises(vol.Invalid):
        ai_prompt(text)


def test_braces_in_normal_text_are_fine() -> None:
    # JSON-Beispiele und Klammern mit Leerzeichen oder Anführungszeichen sind keine Platzhalter
    text = 'Antworte als {"title": "..."} auf {language}.\n{facts}'
    assert prompt_problem(text) is None
    assert ai_prompt(f"  {text}  \r\n") == text


def test_render_replaces_only_the_two_placeholders() -> None:
    facts = json.dumps({"name": "{language}", "note": "{facts}"})
    out = render_prompt("Auf {language}:\n{facts}", facts, "German")
    # Auch Platzhalter-Text in den Fakten bleibt unberührt
    assert out == f"Auf German:\n{facts}"
    assert render_prompt("", "{}", "English").endswith("{}") and "English" in render_prompt("", "{}", "English")


async def test_option_roundtrip_and_default_is_listed(hass: HomeAssistant, setup, hass_ws_client) -> None:
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/get_options"})
    result = (await client.receive_json())["result"]
    assert result["values"]["ai_prompt"] == "" and result["ai_prompt_default"] == DEFAULT_PROMPT
    # Ungültig: Fehler, nichts gespeichert
    await client.send_json({"id": 2, "type": f"{DOMAIN}/set_options", "values": {"ai_prompt": "Ohne Fakten"}})
    assert (await client.receive_json())["error"]["code"] == "invalid_format"
    await client.send_json({"id": 3, "type": f"{DOMAIN}/set_options", "values": {"ai_prompt": 5}})
    assert (await client.receive_json())["error"]["code"] == "invalid_format"
    mine = "Kurz auf {language}:\n{facts}"
    await client.send_json({"id": 4, "type": f"{DOMAIN}/set_options", "values": {"ai_prompt": mine}})
    assert (await client.receive_json())["success"]
    await client.send_json({"id": 5, "type": f"{DOMAIN}/get_options"})
    assert (await client.receive_json())["result"]["values"]["ai_prompt"] == mine
    # Standard zurück: leer
    await client.send_json({"id": 6, "type": f"{DOMAIN}/set_options", "values": {"ai_prompt": DEFAULT_PROMPT}})
    assert (await client.receive_json())["success"]
    await client.send_json({"id": 7, "type": f"{DOMAIN}/get_options"})
    assert (await client.receive_json())["result"]["values"]["ai_prompt"] == ""


async def test_assess_uses_own_prompt(hass: HomeAssistant, setup, hass_ws_client, monkeypatch) -> None:
    lamp = _lamp(hass)
    calls: list[str] = []

    async def fake(hass_: HomeAssistant, entity_id: str | None, instructions: str) -> Any:
        calls.append(instructions)
        return "Titel\n\nText"

    monkeypatch.setattr(ai_assessment, "_generate", fake)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_options", "values": {"ai_assessment": True, "ai_prompt": "Nur kurz auf {language}.\n{facts}"}})
    assert (await client.receive_json())["success"]
    await client.send_json({"id": 2, "type": f"{DOMAIN}/ai_assess", "device_id": lamp.id, "language": "de"})
    assert (await client.receive_json())["success"]
    assert calls[0].startswith("Nur kurz auf German") and '"name": "Lampe"' in calls[0]
    assert "careful assistant" not in calls[0]


async def test_preview_sends_nothing_and_checks_draft(hass: HomeAssistant, setup, hass_ws_client, monkeypatch) -> None:
    lamp = _lamp(hass)

    async def never(*args: Any) -> Any:
        raise AssertionError("die Vorschau darf nichts an die KI schicken")

    monkeypatch.setattr(ai_assessment, "_generate", never)
    client = await hass_ws_client(hass)
    # Ohne Entwurf: gespeicherter Prompt (hier der Standard); funktioniert auch bei ausgeschalteter KI
    await client.send_json({"id": 1, "type": f"{DOMAIN}/ai_prompt_preview", "device_id": lamp.id, "language": "en"})
    msg = await client.receive_json()
    assert msg["success"], msg
    assert "careful assistant" in msg["result"]["text"] and '"name": "Lampe"' in msg["result"]["text"] and "{facts}" not in msg["result"]["text"]
    # Entwurf
    await client.send_json({"id": 2, "type": f"{DOMAIN}/ai_prompt_preview", "device_id": lamp.id, "language": "de", "prompt": "Hallo {language}\n{facts}"})
    text = (await client.receive_json())["result"]["text"]
    assert text.startswith("Hallo German") and '"status"' in text
    # Ungültiger Entwurf, unbekanntes Gerät, zu lang
    await client.send_json({"id": 3, "type": f"{DOMAIN}/ai_prompt_preview", "device_id": lamp.id, "prompt": "ohne"})
    assert (await client.receive_json())["error"]["code"] == "invalid_prompt"
    await client.send_json({"id": 4, "type": f"{DOMAIN}/ai_prompt_preview", "device_id": "gibtsnicht"})
    assert (await client.receive_json())["error"]["code"] == "not_found"
    await client.send_json({"id": 5, "type": f"{DOMAIN}/ai_prompt_preview", "device_id": lamp.id, "prompt": "x" * (AI_PROMPT_MAX + 1)})
    assert (await client.receive_json())["error"]["code"] == "invalid_format"


async def test_facts_list_other_offline_devices_of_the_integration(hass: HomeAssistant, setup, freezer) -> None:
    """1.3.0: Name, Bereich und Dauer der anderen ausgefallenen Geräte derselben Integration, längste zuerst, höchstens 10."""
    from datetime import timedelta  # noqa: PLC0415

    from custom_components.device_panel.ai_assessment import SAME_OFFLINE_MAX, build_facts  # noqa: PLC0415
    from custom_components.device_panel.devices import async_list_devices  # noqa: PLC0415

    log = hass.data[DATA_AVAILABILITY]
    ereg = er.async_get(hass)
    dreg = dr.async_get(hass)
    source = MockConfigEntry(domain="zha", title="ZHA")
    source.add_to_hass(hass)
    entities: dict[str, str] = {}
    for i in range(14):
        dev = dreg.async_get_or_create(config_entry_id=source.entry_id, identifiers={("zha", f"d{i:02d}")}, name=f"Melder {i:02d}")
        entities[dev.id] = ereg.async_get_or_create("binary_sensor", "zha", f"{dev.id}-m", device_id=dev.id).entity_id
        hass.states.async_set(entities[dev.id], "on")
    online = dreg.async_get_or_create(config_entry_id=source.entry_id, identifiers={("zha", "ok")}, name="Heiler Melder")
    hass.states.async_set(ereg.async_get_or_create("binary_sensor", "zha", f"{online.id}-m", device_id=online.id).entity_id, "on")
    log.evaluate()
    ids = list(entities)
    # Gerät 0 fehlt zuerst (am längsten), dann nacheinander die übrigen bis Nr. 12; Nr. 13 bleibt online
    for n, dev_id in enumerate(ids[:13]):
        hass.states.async_set(entities[dev_id], "unavailable")
        log.evaluate()
        freezer.tick(timedelta(minutes=2))
    log.evaluate()
    result = await async_list_devices(hass, log)
    me = next(d for d in result["devices"] if d["name"] == "Melder 12")
    facts = build_facts(me, result, time.time())
    others = facts["same_integration_offline_devices"]
    assert facts["same_integration_other_devices"]["offline_now"] == 12
    # höchstens 10, die am längsten ausgefallenen zuerst, ohne das Gerät selbst
    assert len(others) == SAME_OFFLINE_MAX == 10
    assert others[0]["name"] == "Melder 00" and others[-1]["name"] == "Melder 09"
    assert all("Melder 12" != o["name"] for o in others)
    minutes = [o["offline_minutes"] for o in others]
    assert minutes == sorted(minutes, reverse=True)
    # Nur Name, Bereich (falls vorhanden) und Dauer: keine IDs oder Entitäten
    assert all(set(o) <= {"name", "area", "offline_minutes"} for o in others)
    text = json.dumps(facts)
    assert "binary_sensor." not in text and me["id"] not in text
