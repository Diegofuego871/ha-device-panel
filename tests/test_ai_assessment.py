"""KI-Einschätzung eines Geräts (0.33.0): Option, Fakten ohne Geheimnisse, Antwort, Fehler."""

from __future__ import annotations

import json
import time
from datetime import timedelta
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel import ai_assessment
from custom_components.device_panel.ai_assessment import AiError, build_facts, split_answer
from custom_components.device_panel.const import DATA_AVAILABILITY, DOMAIN
from custom_components.device_panel.devices import async_list_devices


@pytest.fixture
async def setup(hass: HomeAssistant):
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    log = hass.data[DATA_AVAILABILITY]
    log._started = time.time() - 3600
    return log


def _device(hass: HomeAssistant, name: str, domain: str = "test", **kwargs: Any) -> dr.DeviceEntry:
    source = MockConfigEntry(domain=domain, title=f"{name} Eintrag")
    source.add_to_hass(hass)
    return dr.async_get(hass).async_get_or_create(
        config_entry_id=source.entry_id, identifiers={(domain, name)}, name=name, **kwargs
    )


def _entity(hass: HomeAssistant, device: dr.DeviceEntry, domain: str, key: str, state: str) -> str:
    entry = er.async_get(hass).async_get_or_create(domain, "test", f"{device.id}-{key}", device_id=device.id)
    hass.states.async_set(entry.entity_id, state)
    return entry.entity_id


async def _set_options(hass: HomeAssistant, hass_ws_client, values: dict[str, Any]) -> dict[str, Any]:
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_options", "values": values})
    msg = await client.receive_json()
    await hass.async_block_till_done()
    return msg


def test_split_answer() -> None:
    assert split_answer("**Wahrscheinlich Empfang**\n\nDer Melder hatte Unterbrüche.") == ("Wahrscheinlich Empfang", "Der Melder hatte Unterbrüche.")
    assert split_answer("# Router prüfen\nText") == ("Router prüfen", "Text")
    # Keine Überschrift erkennbar: alles ist Text
    assert split_answer("Nur ein langer Satz ohne Überschrift") == ("", "Nur ein langer Satz ohne Überschrift")
    assert split_answer("x" * 100 + "\nText")[0] == ""


async def test_facts_have_no_secrets_and_show_the_situation(hass: HomeAssistant, setup, freezer) -> None:
    hub = _device(hass, "Funkstick", domain="zha")
    _entity(hass, hub, "sensor", "h", "on")
    melder = _device(hass, "Melder", domain="zha", manufacturer="Beispiel AG", model="M1", sw_version="1.2", via_device=("zha", "Funkstick"))
    sensor = _entity(hass, melder, "binary_sensor", "m", "on")
    other = _device(hass, "Schalter", domain="zha")
    other_e = _entity(hass, other, "light", "o", "on")
    setup.evaluate()
    hass.states.async_set(sensor, "unavailable")
    hass.states.async_set(other_e, "unavailable")
    freezer.tick(timedelta(minutes=10))
    setup.evaluate()
    result = await async_list_devices(hass, setup)
    device = next(d for d in result["devices"] if d["name"] == "Melder")
    facts = build_facts(device, result, time.time())
    assert facts["name"] == "Melder" and facts["status"] == "offline"
    assert facts["offline_for_minutes"] >= 9
    assert facts["manufacturer"] == "Beispiel AG" and facts["software_version"] == "1.2"
    # Lage bei der Integration: der andere Zigbee-Schalter ist auch weg
    assert facts["same_integration_other_devices"] == {"total": 2, "offline_now": 1}
    # Keine IDs, Entitäten oder Adressen
    text = json.dumps(facts)
    assert melder.id not in text and sensor not in text and "binary_sensor." not in text
    assert not {"id", "entity_id", "entities", "mac", "ip"} & set(facts)


async def test_assess_needs_option_and_sends_only_on_call(hass: HomeAssistant, setup, hass_ws_client, monkeypatch) -> None:
    lamp = _device(hass, "Lampe")
    _entity(hass, lamp, "light", "l", "on")
    calls: list[tuple[str | None, str]] = []

    async def fake(hass_: HomeAssistant, entity_id: str | None, instructions: str) -> Any:
        calls.append((entity_id, instructions))
        return "Wahrscheinlich Empfang\n\nDie Lampe ist online."

    monkeypatch.setattr(ai_assessment, "_generate", fake)
    client = await hass_ws_client(hass)
    # Option aus (Standard): Fehler, nichts gesendet
    await client.send_json({"id": 1, "type": f"{DOMAIN}/ai_assess", "device_id": lamp.id, "language": "de"})
    msg = await client.receive_json()
    assert msg["error"]["code"] == "disabled" and calls == []
    assert (await async_list_devices(hass, setup))["ai_assessment"] is False
    # Eingeschaltet, mit gewählter KI-Aufgabe
    assert (await _set_options(hass, hass_ws_client, {"ai_assessment": True, "ai_task_entity": "ai_task.test"}))["success"]
    assert (await async_list_devices(hass, setup))["ai_assessment"] is True
    await client.send_json({"id": 2, "type": f"{DOMAIN}/ai_assess", "device_id": lamp.id, "language": "de"})
    msg = await client.receive_json()
    assert msg["success"], msg
    assert msg["result"]["title"] == "Wahrscheinlich Empfang" and msg["result"]["text"] == "Die Lampe ist online."
    assert msg["result"]["at"] and "source" in msg["result"]
    assert len(calls) == 1 and calls[0][0] == "ai_task.test"
    assert "German" in calls[0][1] and '"name": "Lampe"' in calls[0][1]
    # Unbekanntes Gerät
    await client.send_json({"id": 3, "type": f"{DOMAIN}/ai_assess", "device_id": "gibtsnicht", "language": "en"})
    assert (await client.receive_json())["error"]["code"] == "not_found"
    # Sprache wird geprüft
    await client.send_json({"id": 4, "type": f"{DOMAIN}/ai_assess", "device_id": lamp.id, "language": "fr"})
    assert (await client.receive_json())["error"]["code"] == "invalid_format"
    assert len(calls) == 1


@pytest.mark.parametrize("code", ["no_ai_task", "timeout", "failed"])
async def test_assess_errors_reach_the_panel(hass: HomeAssistant, setup, hass_ws_client, monkeypatch, code) -> None:
    lamp = _device(hass, "Lampe")
    _entity(hass, lamp, "light", "l", "on")

    async def fake(*_args: Any) -> Any:
        raise AiError(code, "meldung")

    monkeypatch.setattr(ai_assessment, "_generate", fake)
    await _set_options(hass, hass_ws_client, {"ai_assessment": True})
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/ai_assess", "device_id": lamp.id, "language": "en"})
    msg = await client.receive_json()
    assert msg["error"]["code"] == code and msg["error"]["message"] == "meldung"


async def test_generate_without_ai_task(hass: HomeAssistant, setup) -> None:
    """Ohne geladenes ai_task: Fehler "no_ai_task" statt Absturz."""
    with pytest.raises(AiError) as err:
        await ai_assessment._generate(hass, None, "x")
    assert err.value.code == "no_ai_task"


async def test_option_is_checked_and_listed(hass: HomeAssistant, setup, hass_ws_client) -> None:
    client = await hass_ws_client(hass)
    for i, bad in enumerate(("light.lampe", "ai_task.Gross", 5, "notify.x"), 1):
        await client.send_json({"id": i, "type": f"{DOMAIN}/set_options", "values": {"ai_task_entity": bad}})
        assert (await client.receive_json())["error"]["code"] == "invalid_format", bad
    await client.send_json({"id": 10, "type": f"{DOMAIN}/set_options", "values": {"ai_task_entity": "ai_task.openai", "ai_assessment": True}})
    assert (await client.receive_json())["success"]
    hass.states.async_set("ai_task.openai", "unknown", {"friendly_name": "OpenAI Aufgabe"})
    await client.send_json({"id": 11, "type": f"{DOMAIN}/get_options"})
    result = (await client.receive_json())["result"]
    assert result["values"]["ai_task_entity"] == "ai_task.openai" and result["values"]["ai_assessment"] is True
    assert result["catalog"]["ai_tasks"] == [{"value": "ai_task.openai", "name": "OpenAI Aufgabe"}]
    # Leer = Standard von HA
    await client.send_json({"id": 12, "type": f"{DOMAIN}/set_options", "values": {"ai_task_entity": ""}})
    assert (await client.receive_json())["success"]
    await client.send_json({"id": 13, "type": f"{DOMAIN}/get_options"})
    assert (await client.receive_json())["result"]["values"]["ai_task_entity"] == ""


async def test_real_ai_task_call(hass: HomeAssistant, setup, hass_ws_client) -> None:
    """Echter Aufruf von ai_task.async_generate_data mit einer Ersatz-Entität: Antwort, Quelle, Anweisung."""
    from homeassistant.components import ai_task
    from homeassistant.components.ai_task import AITaskEntity, AITaskEntityFeature
    from homeassistant.setup import async_setup_component

    seen: list[str] = []

    class FakeTask(AITaskEntity):
        _attr_name = "Ersatz-KI"
        _attr_supported_features = AITaskEntityFeature.GENERATE_DATA

        async def _async_generate_data(self, task, chat_log):
            seen.append(task.instructions)
            return ai_task.GenDataTaskResult(conversation_id=chat_log.conversation_id, data="Kurzer Titel\n\nDer Text der Einschätzung.")

    assert await async_setup_component(hass, "homeassistant", {})
    assert await async_setup_component(hass, "ai_task", {})
    entity = FakeTask()
    entity.entity_id = "ai_task.ersatz"
    await hass.data[ai_task.DATA_COMPONENT].async_add_entities([entity])
    lamp = _device(hass, "Lampe")
    _entity(hass, lamp, "light", "l", "on")
    await _set_options(hass, hass_ws_client, {"ai_assessment": True, "ai_task_entity": "ai_task.ersatz"})
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/ai_assess", "device_id": lamp.id, "language": "de"})
    msg = await client.receive_json()
    assert msg["success"], msg
    assert msg["result"]["title"] == "Kurzer Titel" and msg["result"]["text"] == "Der Text der Einschätzung."
    assert msg["result"]["source"] == "Ersatz-KI"
    assert len(seen) == 1 and '"name": "Lampe"' in seen[0] and lamp.id not in seen[0]
    # Entität gibt es nicht: Fehler "no_ai_task"
    await _set_options(hass, hass_ws_client, {"ai_task_entity": "ai_task.weg"})
    await client.send_json({"id": 2, "type": f"{DOMAIN}/ai_assess", "device_id": lamp.id, "language": "de"})
    assert (await client.receive_json())["error"]["code"] == "no_ai_task"
