"""KI-Einschätzung 2.42.0: der Grund eines Fehlers wird sichtbar, leere Antworten bekommen einen zweiten Versuch, keine Adressen, mehr Fakten."""

from __future__ import annotations

import time
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel import activity, ai_assessment
from custom_components.device_panel.ai_assessment import AiError, build_facts, clean
from custom_components.device_panel.ai_prompt import FACT_GROUPS
from custom_components.device_panel.const import DATA_AVAILABILITY, DATA_SIGNAL, DOMAIN
from custom_components.device_panel.signal_history import SignalLog


@pytest.fixture
async def setup(hass: HomeAssistant):
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return hass.data[DATA_AVAILABILITY]


def _lamp(hass: HomeAssistant) -> dr.DeviceEntry:
    source = MockConfigEntry(domain="test", title="Lampe Eintrag")
    source.add_to_hass(hass)
    dev = dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={("test", "lampe")}, name="Lampe")
    entry = er.async_get(hass).async_get_or_create("light", "test", f"{dev.id}-l", device_id=dev.id)
    hass.states.async_set(entry.entity_id, "on")
    return dev


async def _enable(hass: HomeAssistant, hass_ws_client) -> Any:
    client = await hass_ws_client(hass)
    hass.states.async_set("ai_task.test", "unknown")
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_options", "values": {"ai_assessment": True, "ai_task_entity": "ai_task.test"}})
    assert (await client.receive_json())["success"]
    return client


def test_clean_removes_bluetooth_addresses() -> None:
    assert clean("Licht Keller (B0:A7:32:46:E3:C2)") == "Licht Keller"
    assert clean("Shelly Eingang (E4:B3:23:17:F5:3A) (Sitzplatz)") == "Shelly Eingang (Sitzplatz)"
    assert clean("b0-a7-32-46-e3-c2") == "b0-a7-32-46-e3-c2"  # nur Adresse: lieber unverändert als leer
    assert clean("Küche") == "Küche" and clean(None) is None


def test_facts_without_addresses_and_with_new_groups() -> None:
    device = {"id": "d", "name": "Pflanze", "online": True, "has_battery": False, "via": "Licht Keller (B0:A7:32:46:E3:C2)", "signal": {"kind": "dbm", "value": -80}}
    result = {"devices": [device], "integrations": {}, "incidents": []}
    extra = {
        "recent_outages": [{"started_minutes_ago": 90, "duration_minutes": 5, "still_offline": False, "local_start_time": "03:00", "weekday": "Monday"}],
        "signal_trend": {"last_24h": {"median": -78.0, "worst": -97.0, "best": -66.0}},
        "bluetooth_path": {"receivers": [{"name": "Licht Keller", "share_percent": 100}], "switches": 0, "gaps_not_received": False},
    }
    facts = build_facts(device, result, time.time(), extra)
    import json
    import re

    assert facts["connected_via"] == "Licht Keller" and not re.search(r"(?:[0-9A-Fa-f]{2}:){5}", json.dumps(facts))
    assert facts["recent_outages_7d"][0]["local_start_time"] == "03:00"
    assert facts["signal"]["last_24h"]["worst"] == -97.0
    assert facts["bluetooth_receivers_24h"]["receivers"][0]["name"] == "Licht Keller"
    allowed = {key for keys in FACT_GROUPS.values() for key in keys}
    assert set(facts) <= allowed


async def test_extras_signal_path_and_outages(hass: HomeAssistant, setup) -> None:
    sig = SignalLog(hass)
    hass.data[DATA_SIGNAL] = sig
    now = time.time()
    for i in range(4):
        sig.record("dev", "dbm", -70.0 - i, now - 600 + i * 60)
    sig.note_via("dev", ("aa:bb:cc:dd:ee:01", "Proxy Garage (AA:BB:CC:DD:EE:01)"), now - 3000)
    sig.note_via("dev", ("aa:bb:cc:dd:ee:02", "Küche"), now - 1500)
    extra = ai_assessment._signal_extras(hass, "dev", now)
    assert extra["signal_trend"]["last_24h"]["worst"] <= extra["signal_trend"]["last_24h"]["median"]
    path = extra["bluetooth_path"]
    assert [r["name"] for r in path["receivers"]] == ["Proxy Garage", "Küche"] and path["switches"] == 1

    class Log:
        @staticmethod
        def history(_dev: str, _range: str, _now: float) -> dict[str, Any]:
            return {"outages": [[now - 7200, now - 7000], [now - 400, now]]}

    outages = ai_assessment._recent_outages(Log, "dev", now)
    assert [o["still_offline"] for o in outages] == [True, False]  # neueste zuerst
    assert outages[1]["duration_minutes"] == 3 and len(outages[0]["local_start_time"]) == 5


async def test_failure_shows_the_reason_in_the_log(hass: HomeAssistant, setup, hass_ws_client, monkeypatch) -> None:
    lamp = _lamp(hass)
    client = await _enable(hass, hass_ws_client)

    async def boom(*_args: Any) -> Any:
        raise AiError("failed", "Error talking to OpenAI: 429 quota exceeded")

    monkeypatch.setattr(ai_assessment, "_generate", boom)
    await client.send_json({"id": 2, "type": f"{DOMAIN}/ai_assess", "device_id": lamp.id, "language": "en"})
    msg = await client.receive_json()
    assert msg["error"]["code"] == "failed" and "429" in msg["error"]["message"]
    entry = next(e for e in activity.get(hass).entries if e["text"].startswith("AI assessment failed"))
    assert "429 quota exceeded" in entry["text"] and entry["level"] == "warning" and "characters" in entry["detail"]


async def test_empty_answer_gets_a_second_try(hass: HomeAssistant, setup, hass_ws_client, monkeypatch) -> None:
    lamp = _lamp(hass)
    client = await _enable(hass, hass_ws_client)
    answers = ["", "Titel\n\nText"]
    calls = []

    async def fake(*_args: Any) -> Any:
        calls.append(1)
        return answers[len(calls) - 1] if len(calls) <= len(answers) else ""

    monkeypatch.setattr(ai_assessment, "_generate", fake)
    await client.send_json({"id": 2, "type": f"{DOMAIN}/ai_assess", "device_id": lamp.id, "language": "en"})
    msg = await client.receive_json()
    assert msg["success"] and msg["result"]["title"] == "Titel" and len(calls) == 2
    # Zweimal leer: eigener Fehlercode
    answers[:] = ["", ""]
    calls.clear()
    await client.send_json({"id": 3, "type": f"{DOMAIN}/ai_assess", "device_id": lamp.id, "language": "en"})
    msg = await client.receive_json()
    assert msg["error"]["code"] == "empty" and len(calls) == 2
