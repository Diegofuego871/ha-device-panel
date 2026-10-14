"""KI-Einschätzung 2.45.0: Prompt-Grösse, mehr Zusammenhang, die letzte Einschätzung wird gemerkt und fliesst ein, Messfehler als Fakt."""

from __future__ import annotations

import time
from typing import Any

import pytest
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant, State
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel import ai_assessment, ai_memory, battery_guard
from custom_components.device_panel.ai_assessment import INSTRUCTIONS_MAX, build_facts, build_instructions, fit_facts
from custom_components.device_panel.ai_prompt import FACT_GROUPS
from custom_components.device_panel.const import DATA_AVAILABILITY, DOMAIN


@pytest.fixture
async def setup(hass: HomeAssistant):
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return hass.data[DATA_AVAILABILITY]


def _device(hass: HomeAssistant, name: str = "Lampe") -> tuple[dr.DeviceEntry, MockConfigEntry]:
    source = MockConfigEntry(domain="test", title=f"{name} Eintrag")
    source.add_to_hass(hass)
    dev = dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={("test", name)}, name=name)
    return dev, source


def test_fit_facts_trims_lists_but_keeps_the_device() -> None:
    peers = [{"name": f"Gerät {i}", "area": "Küche", "status": "online", "detail": "x" * 200} for i in range(15)]
    facts = {
        "name": "Lampe", "status": "offline", "offline_for_minutes": 90,
        "same_area_devices": peers, "same_hub_offline_devices": peers[:10],
        "battery_last_12_months": {"monthly_percent": {f"2026-{m:02d}": {"average": 80, "lowest": 70} for m in range(1, 11)}},
    }
    same, none = fit_facts(facts, "en", limit=10**6)
    assert same is facts and none == []  # nichts zu kürzen
    full = len(build_instructions(facts, "en"))
    fitted, trimmed = fit_facts(facts, "en", limit=full - 3000)
    assert trimmed and len(build_instructions(fitted, "en")) <= full - 3000
    assert fitted["name"] == "Lampe" and fitted["offline_for_minutes"] == 90 and len(facts["same_area_devices"]) == 15  # Original unberührt
    tiny, trimmed_all = fit_facts(facts, "en", limit=len(build_instructions({"name": "Lampe"}, "en")))
    assert "same_area_devices" not in tiny and "same_hub_offline_devices" not in tiny and "same_area_devices" in trimmed_all
    assert INSTRUCTIONS_MAX >= 12000  # der Standard-Prompt allein hat gut 7000 Zeichen


async def test_context_extras(hass: HomeAssistant, setup) -> None:
    dev, source = _device(hass)
    ent = er.async_get(hass)
    a = ent.async_get_or_create("light", "test", f"{dev.id}-a", device_id=dev.id)
    b = ent.async_get_or_create("sensor", "test", f"{dev.id}-b", device_id=dev.id)
    hass.states.async_set(a.entity_id, "unavailable")
    hass.states.async_set(b.entity_id, "5")
    source.mock_state(hass, ConfigEntryState.SETUP_RETRY)
    extra = ai_assessment._context_extras(hass, dev.id, setup, time.time())
    assert extra["integration_problem"] == ["setup_retry"]
    assert extra["entities"] == {"total": 2, "unavailable": 1}
    assert isinstance(extra["home_assistant_started_minutes_ago"], int)
    source.mock_state(hass, ConfigEntryState.LOADED)
    assert "integration_problem" not in ai_assessment._context_extras(hass, dev.id, setup, time.time())


def test_facts_with_the_new_context_stay_inside_the_groups() -> None:
    device = {"id": "d", "name": "Sensor", "online": False, "has_battery": True, "battery": {"level": 70, "low": False}}
    extra = {
        "integration_problem": ["setup_retry"], "entities": {"total": 3, "unavailable": 3}, "home_assistant_started_minutes_ago": 12,
        "battery_glitches": 4, "previous": {"minutes_ago": 300, "headline": "Empfang", "text": "Der Empfang war schwach.", "device_status_then": "offline"},
    }
    facts = build_facts(device, {"devices": [device], "integrations": {}, "incidents": []}, time.time(), extra)
    assert facts["integration_problem"] == ["setup_retry"] and facts["battery_sensor_glitches_7d"] == 4
    assert facts["previous_assessment"]["headline"] == "Empfang" and facts["entities"]["unavailable"] == 3
    assert set(facts) <= {key for keys in FACT_GROUPS.values() for key in keys}
    # Ohne Batteriestand kein Hinweis auf Messfehler des Batterie-Sensors
    nobat = {"id": "d", "name": "Sensor", "online": True}
    assert "battery_sensor_glitches_7d" not in build_facts(nobat, {"devices": [nobat], "integrations": {}, "incidents": []}, time.time(), {"battery_glitches": 2})


async def test_memory_roundtrip_limits_and_age(hass: HomeAssistant, hass_storage: dict[str, Any]) -> None:
    hass_storage[ai_memory.STORE_KEY] = {
        "version": 1, "minor_version": 1, "key": ai_memory.STORE_KEY,
        "data": {"devices": {"a": {"at": time.time() - 60, "title": "T", "text": "Text", "source": "OpenAI", "status": "offline"}, "kaputt": {"at": "x"}}},
    }
    memory = ai_memory.AiMemory(hass)
    await memory.async_load()
    assert memory.get("a")["text"] == "Text" and memory.get("kaputt") is None and memory.get("fehlt") is None
    assert memory.get("a", time.time() + ai_memory.MAX_AGE + 100) is None  # zu alt als Bezug
    for i in range(ai_memory.MAX_DEVICES + 10):
        memory.set(f"d{i}", "T", "x", None, None, now=1000.0 + i)
    assert len(memory._data) == ai_memory.MAX_DEVICES and "d0" not in memory._data and f"d{ai_memory.MAX_DEVICES + 9}" in memory._data


async def test_second_assessment_gets_the_first_and_ai_last_returns_it(hass: HomeAssistant, setup, hass_ws_client, monkeypatch) -> None:
    dev, _source = _device(hass)
    er.async_get(hass).async_get_or_create("light", "test", f"{dev.id}-l", device_id=dev.id)
    hass.states.async_set("ai_task.test", "unknown")
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_options", "values": {"ai_assessment": True, "ai_task_entity": "ai_task.test"}})
    assert (await client.receive_json())["success"]
    prompts: list[str] = []

    async def fake(_hass: HomeAssistant, _entity: str | None, instructions: str) -> Any:
        prompts.append(instructions)
        return "Erste Überschrift\n\nDer Empfang war schwach." if len(prompts) == 1 else "Zweite\n\nUnverändert."

    monkeypatch.setattr(ai_assessment, "_generate", fake)
    await client.send_json({"id": 2, "type": f"{DOMAIN}/ai_last", "device_id": dev.id})
    assert (await client.receive_json())["result"] is None  # noch nichts gemerkt
    await client.send_json({"id": 3, "type": f"{DOMAIN}/ai_assess", "device_id": dev.id, "language": "en"})
    assert (await client.receive_json())["success"]
    assert '"previous_assessment"' not in prompts[0]
    await client.send_json({"id": 4, "type": f"{DOMAIN}/ai_last", "device_id": dev.id})
    last = (await client.receive_json())["result"]
    assert last["title"] == "Erste Überschrift" and last["source"] is not None and last["at"]
    await client.send_json({"id": 5, "type": f"{DOMAIN}/ai_assess", "device_id": dev.id, "language": "en"})
    assert (await client.receive_json())["success"]
    assert '"previous_assessment"' in prompts[1] and "Der Empfang war schwach." in prompts[1] and '"minutes_ago"' in prompts[1]
    # Vorschau enthält sie auch, ohne dass die KI gefragt wird
    await client.send_json({"id": 6, "type": f"{DOMAIN}/ai_prompt_preview", "device_id": dev.id, "language": "en"})
    assert "Unverändert." in (await client.receive_json())["result"]["text"]  # die letzte Antwort (die zweite) steht in der Vorschau
    assert len(prompts) == 2
    # Funktion aus: nichts mehr zurückgeben
    await client.send_json({"id": 7, "type": f"{DOMAIN}/set_options", "values": {"ai_assessment": False}})
    assert (await client.receive_json())["success"]
    await client.send_json({"id": 8, "type": f"{DOMAIN}/ai_last", "device_id": dev.id})
    assert (await client.receive_json())["result"] is None


@pytest.mark.battery_guard
async def test_discarded_glitches_are_counted(hass: HomeAssistant, setup) -> None:
    guard = battery_guard.BatteryGuard(hass)
    from datetime import datetime, timezone  # noqa: PLC0415

    def st(value: float, at: float) -> State:
        stamp = datetime.fromtimestamp(at, tz=timezone.utc)
        return State("sensor.x", str(value), {}, last_changed=stamp, last_reported=stamp, last_updated=stamp)

    t0 = 1_800_000_000.0
    for i in range(3):  # drei Ausreisser
        base = t0 + i * 3600
        guard.level("sensor.x", st(76, base), base)
        guard.level("sensor.x", st(2, base + 300), base + 300)
        guard.level("sensor.x", st(70, base + 600), base + 600)
    now = t0 + 3 * 3600
    assert guard.ignored("sensor.x", now) == 3 and guard.ignored("sensor.x", now + 8 * 86400) == 0 and guard.ignored("sensor.y", now) == 0
