"""App "Geräte-Updates" (2.164.0): offene Geräte-Updates, Warteschlange (höchstens drei gleichzeitig, eines je Integration), Push-Link."""

from __future__ import annotations

import time
from datetime import timedelta

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed, async_mock_service

from custom_components.device_panel.const import DATA_AVAILABILITY, DOMAIN
from custom_components.device_panel.update_queue import MAX_PARALLEL, NO_PROGRESS_SECONDS, SETTLE_SECONDS, available, get_queue

from .test_outage import _device


@pytest.fixture
async def setup(hass: HomeAssistant):
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options={"notify_service": "notify.handy", "notify_updates": True, "status_notify": False, "updates_mode": "instant", "updates_kinds": ["devices"]})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    hass.data[DATA_AVAILABILITY]._started = time.time() - 3600
    return entry


def _update(hass: HomeAssistant, device, platform: str, key: str = "fw", state: str = "on", features: int = 13, **attrs) -> str:
    entry = er.async_get(hass).async_get_or_create("update", platform, f"{device.id}-{key}", device_id=device.id)
    hass.states.async_set(entry.entity_id, state, {"supported_features": features, "installed_version": "1.0", "latest_version": "1.1", "title": device.name, **attrs})
    return entry.entity_id


async def test_available_only_device_updates(hass: HomeAssistant, setup) -> None:
    lamp = _device(hass, "Lampe")
    fw = _update(hass, lamp, "shelly")
    # Kein Update offen, nicht installierbar, von Home Assistant selbst oder von HACS: nicht dabei
    _update(hass, _device(hass, "Aktuell"), "shelly", state="off")
    _update(hass, _device(hass, "Nur Anzeige"), "shelly", features=0)
    _update(hass, _device(hass, "Core"), "hassio")
    _update(hass, _device(hass, "Karte"), "hacs")
    assert [u["entity_id"] for u in available(hass)] == [fw]
    assert available(hass)[0]["platform"] == "shelly" and available(hass)[0]["device_id"] == lamp.id


async def test_queue_limits_and_progress(hass: HomeAssistant, setup) -> None:
    calls = async_mock_service(hass, "update", "install")
    shelly = [_update(hass, _device(hass, f"Shelly {n}"), "shelly") for n in range(3)]
    zha = _update(hass, _device(hass, "Zigbee"), "zha")
    esp = _update(hass, _device(hass, "ESP"), "esphome")
    other = _update(hass, _device(hass, "Matter"), "matter")
    queue = get_queue(hass)
    snap = queue.enqueue([*shelly, zha, esp, other], backup=True)
    await hass.async_block_till_done()
    status = {i["entity_id"]: i["status"] for i in snap}
    # Eines je Integration und höchstens drei: Shelly 0, Zigbee, ESPHome laufen; der Rest wartet
    assert [c.data["entity_id"] for c in calls] == [shelly[0], zha, esp]
    assert sum(1 for s in status.values() if s == "running") == MAX_PARALLEL
    assert status[shelly[1]] == status[other] == "waiting"
    # Backup nur, wo die Entität es kann (Merkmal 8 gehört zu 13)
    assert all(c.data.get("backup") for c in calls)
    # Shelly 0 ist fertig: das nächste Shelly rückt nach
    hass.states.async_set(shelly[0], "off", {"supported_features": 13})
    await hass.async_block_till_done()
    assert calls[-1].data["entity_id"] == shelly[1]
    assert {i["entity_id"]: i["status"] for i in queue.snapshot()}[shelly[0]] == "done"
    # Dasselbe Update nicht doppelt einreihen
    n = len(calls)
    queue.enqueue([shelly[1]], backup=False)
    await hass.async_block_till_done()
    assert len(calls) == n


async def test_failure_and_no_progress(hass: HomeAssistant, setup, freezer) -> None:
    async_mock_service(hass, "update", "install")
    a = _update(hass, _device(hass, "A"), "shelly")
    b = _update(hass, _device(hass, "B"), "zha")
    queue = get_queue(hass)
    queue.enqueue([a, b], backup=False)
    await hass.async_block_till_done()
    # A läuft und fällt wieder auf "Update verfügbar" zurück: fehlgeschlagen
    hass.states.async_set(a, "on", {"supported_features": 13, "in_progress": True})
    await hass.async_block_till_done()
    hass.states.async_set(a, "on", {"supported_features": 13})
    await hass.async_block_till_done()
    # Nicht sofort: die Entität steht oft noch eine Weile auf "verfügbar" (Frist SETTLE_SECONDS), das Panel zeigt "wird abgeschlossen"
    status = {i["entity_id"]: i for i in queue.snapshot()}
    assert status[a]["status"] == "running" and status[a]["settling"] is True
    freezer.tick(timedelta(seconds=SETTLE_SECONDS + 1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    status = {i["entity_id"]: i for i in queue.snapshot()}
    assert status[a]["status"] == "failed" and status[a]["error"]
    # B zeigt nie einen Fortschritt: nach der Frist fehlgeschlagen
    freezer.tick(timedelta(seconds=NO_PROGRESS_SECONDS + 1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert {i["entity_id"]: i["status"] for i in queue.snapshot()}[b] == "failed"
    # Erneut einreihen (Wiederholen) ist möglich
    queue.enqueue([a], backup=False)
    assert {i["entity_id"]: i["status"] for i in queue.snapshot()}[a] == "running"


async def test_websocket(hass: HomeAssistant, setup, hass_ws_client) -> None:
    calls = async_mock_service(hass, "update", "install")
    fw = _update(hass, _device(hass, "Lampe"), "shelly")
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/updates_list"})
    res = (await client.receive_json())["result"]
    assert [u["entity_id"] for u in res["available"]] == [fw] and res["queue"] == []
    await client.send_json({"id": 2, "type": f"{DOMAIN}/updates_start", "entity_ids": [fw, "update.gibts_nicht"], "backup": False})
    res = (await client.receive_json())["result"]
    assert [(i["entity_id"], i["status"]) for i in res["queue"]] == [(fw, "running")]
    assert [c.data["entity_id"] for c in calls] == [fw]


async def test_push_link_for_device_updates(hass: HomeAssistant, setup, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    _update(hass, _device(hass, "Lampe"), "shelly")
    await hass.async_block_till_done()
    freezer.tick(timedelta(minutes=6))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert len(calls) == 1
    assert calls[0].data["data"]["url"] == "/device-panel?app=updates"


async def test_late_success_is_not_a_failure(hass: HomeAssistant, setup, freezer) -> None:
    """Fall aus der Praxis (Shelly): "läuft nicht mehr", bevor das Gerät neu startet; die neue Version kommt erst Minuten später."""
    async_mock_service(hass, "update", "install")
    a = _update(hass, _device(hass, "A"), "shelly")
    b = _update(hass, _device(hass, "B"), "zha")
    queue = get_queue(hass)
    queue.enqueue([a, b], backup=False)
    await hass.async_block_till_done()
    for ent in (a, b):
        hass.states.async_set(ent, "on", {"supported_features": 13, "in_progress": True})
        await hass.async_block_till_done()
        hass.states.async_set(ent, "on", {"supported_features": 13})  # Fortschritt aus, Version noch die alte
        await hass.async_block_till_done()
    # A: nach 2 Minuten "aktuell" (Frist läuft noch): fertig
    freezer.tick(timedelta(minutes=2))
    hass.states.async_set(a, "off", {"supported_features": 13, "installed_version": "1.1"})
    await hass.async_block_till_done()
    # B: Frist abgelaufen, als fehlgeschlagen gemeldet, dann kommt doch die neue Version: wieder fertig
    freezer.tick(timedelta(seconds=SETTLE_SECONDS))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert {i["entity_id"]: i["status"] for i in queue.snapshot()}[b] == "failed"
    hass.states.async_set(b, "on", {"supported_features": 13, "installed_version": "1.1", "latest_version": "1.2"})  # Version geändert
    await hass.async_block_till_done()
    status = {i["entity_id"]: i for i in queue.snapshot()}
    assert status[a]["status"] == "done" and status[b]["status"] == "done" and status[b]["error"] is None


async def test_service_error_is_the_reason(hass: HomeAssistant, setup) -> None:
    """Lehnt die Integration das Update ab, nennt die Zeile den Grund der Integration."""
    from homeassistant.exceptions import HomeAssistantError

    async def refuse(call) -> None:
        raise HomeAssistantError("Device unreachable")

    hass.services.async_register("update", "install", refuse)
    a = _update(hass, _device(hass, "A"), "shelly")
    queue = get_queue(hass)
    queue.enqueue([a], backup=False)
    await hass.async_block_till_done()
    item = queue.snapshot()[0]
    assert item["status"] == "failed" and "Device unreachable" in item["error"]
