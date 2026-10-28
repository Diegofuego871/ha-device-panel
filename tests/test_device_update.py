"""Update eines Geräts aus dem Popup starten (2.161.0): nur Administratoren, nur installierbare Updates, Ausfall-Meldungen ruhen währenddessen."""

from __future__ import annotations

import time
from datetime import timedelta

import pytest

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed, async_mock_service

from custom_components.device_panel.const import DATA_AVAILABILITY, DOMAIN
from custom_components.device_panel.device_update import HOLD_SECONDS, held_until, installable_updates

from .test_outage import _device, _entity, _options, _tick


@pytest.fixture
async def setup(hass: HomeAssistant):
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    log = hass.data[DATA_AVAILABILITY]
    log._started = time.time() - 3600  # Anlaufphase überspringen
    return log


def _update(hass: HomeAssistant, device, key: str = "fw", state: str = "on", features: int = 5, platform: str = "test", **attrs) -> str:
    from homeassistant.helpers import entity_registry as er

    entry = er.async_get(hass).async_get_or_create("update", platform, f"{device.id}-{key}", device_id=device.id)
    hass.states.async_set(entry.entity_id, state, {"supported_features": features, "installed_version": "1.0", "latest_version": "1.1", **attrs})
    return entry.entity_id


async def test_installable_updates(hass: HomeAssistant, setup) -> None:
    lamp = _device(hass, "Lampe")
    fw = _update(hass, lamp, features=5)
    assert installable_updates(hass, lamp.id) == [{"entity_id": fw, "features": 5}]
    # Kein Update offen, nicht installierbar oder von Home Assistant selbst: nicht dabei
    hass.states.async_set(fw, "off", {"supported_features": 5})
    assert installable_updates(hass, lamp.id) == []
    hass.states.async_set(fw, "on", {"supported_features": 0})
    assert installable_updates(hass, lamp.id) == []
    core = _device(hass, "Core")
    _update(hass, core, platform="hassio")
    assert installable_updates(hass, core.id) == []


async def test_install_websocket(hass: HomeAssistant, setup, hass_ws_client) -> None:
    calls = async_mock_service(hass, "update", "install")
    lamp = _device(hass, "Lampe")
    fw = _update(hass, lamp, features=5)
    client = await hass_ws_client(hass)

    await client.send_json({"id": 1, "type": f"{DOMAIN}/device", "device_id": lamp.id})
    detail = (await client.receive_json())["result"]
    assert detail["updates"] == [{"entity_id": fw, "features": 5}] and detail["update_hold_until"] is None

    # Fremde Entität und Backup ohne Unterstützung: Fehler, nichts gestartet
    await client.send_json({"id": 2, "type": f"{DOMAIN}/update_install", "device_id": lamp.id, "entity_id": "update.gibt_es_nicht"})
    assert (await client.receive_json())["success"] is False
    await client.send_json({"id": 3, "type": f"{DOMAIN}/update_install", "device_id": lamp.id, "entity_id": fw, "backup": True})
    assert (await client.receive_json())["success"] is False
    assert calls == []

    await client.send_json({"id": 4, "type": f"{DOMAIN}/update_install", "device_id": lamp.id, "entity_id": fw})
    result = (await client.receive_json())["result"]
    await hass.async_block_till_done()
    assert len(calls) == 1 and calls[0].data == {"entity_id": fw}
    assert result["hold_until"] and held_until(hass, lamp.id)

    # Mit Backup, wenn die Entität es kann
    other = _device(hass, "Router")
    fw2 = _update(hass, other, features=13)
    await client.send_json({"id": 5, "type": f"{DOMAIN}/update_install", "device_id": other.id, "entity_id": fw2, "backup": True})
    assert (await client.receive_json())["success"] is True
    await hass.async_block_till_done()
    assert calls[1].data == {"entity_id": fw2, "backup": True}


async def test_install_needs_admin(hass: HomeAssistant, setup, hass_ws_client, hass_admin_user) -> None:
    from homeassistant.auth.const import GROUP_ID_USER

    lamp = _device(hass, "Lampe")
    fw = _update(hass, lamp)
    calls = async_mock_service(hass, "update", "install")
    hass_admin_user.groups = []
    await hass.auth.async_update_user(hass_admin_user, group_ids=[GROUP_ID_USER])
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/update_install", "device_id": lamp.id, "entity_id": fw})
    assert (await client.receive_json())["success"] is False
    assert calls == []


async def test_outage_notification_waits_for_update(hass: HomeAssistant, setup, freezer, hass_ws_client) -> None:
    notify = async_mock_service(hass, "notify", "handy")
    async_mock_service(hass, "update", "install")
    lamp = _device(hass, "Lampe")
    light = _entity(hass, lamp, "light", "l", "on")
    fw = _update(hass, lamp)
    await _options(hass, notify_service="notify.handy", notify_outage=True, notify_online=True, offline_after=2, notify_delay=2)
    setup.evaluate()
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/update_install", "device_id": lamp.id, "entity_id": fw})
    assert (await client.receive_json())["success"] is True

    # Das Gerät startet neu und fehlt: im Panel ausgefallen, aber keine Meldung, solange das Update läuft und kurz danach
    hass.states.async_set(light, "unavailable")
    hass.states.async_set(fw, "unavailable")
    await _tick(hass, setup, freezer, 3)
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert notify == []
    # Das Update meldet weiter Fortschritt (neues Attribut): die Zurückhaltung läuft weiter
    hass.states.async_set(fw, "unavailable", {"update_percentage": 50})
    await _tick(hass, setup, freezer, 4)
    hass.states.async_set(fw, "unavailable", {"update_percentage": 90})
    await _tick(hass, setup, freezer, 2)
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert notify == []  # läuft weiter
    # Update fertig, Gerät kommt zurück: nie ein Ausfall gemeldet, auch keine Rückkehr
    hass.states.async_set(fw, "off", {"supported_features": 5, "in_progress": False, "installed_version": "1.1", "latest_version": "1.1"})
    hass.states.async_set(light, "on")
    await _tick(hass, setup, freezer, 1)
    await hass.async_block_till_done()
    assert notify == []
    assert held_until(hass, lamp.id) is not None
    freezer.tick(timedelta(seconds=HOLD_SECONDS + 5))
    assert held_until(hass, lamp.id) is None


async def test_outage_after_hold_is_notified(hass: HomeAssistant, setup, freezer, hass_ws_client) -> None:
    notify = async_mock_service(hass, "notify", "handy")
    async_mock_service(hass, "update", "install")
    lamp = _device(hass, "Lampe")
    light = _entity(hass, lamp, "light", "l", "on")
    fw = _update(hass, lamp)
    await _options(hass, notify_service="notify.handy", notify_outage=True, offline_after=2, notify_delay=2)
    setup.evaluate()
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/update_install", "device_id": lamp.id, "entity_id": fw})
    assert (await client.receive_json())["success"] is True
    hass.states.async_set(light, "unavailable")
    hass.states.async_set(fw, "unavailable")
    await hass.async_block_till_done()
    await _tick(hass, setup, freezer, 3)
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert notify == []
    # Update ohne Fortschrittsanzeige endet nie von selbst im Test: nach der Wartezeit (5 Min.) kommt die Meldung, weil das Gerät noch fehlt
    await _tick(hass, setup, freezer, 4)
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert [c.data["title"] for c in notify] == ["🔴 Offline: Lampe"]


async def test_update_status_returns_the_integrations_error(hass: HomeAssistant, setup, hass_ws_client) -> None:
    """Lehnt die Integration das Update ab, fragt das Fenster eines Geräts den Fehlertext ab (seit 2.166.0)."""
    from homeassistant.exceptions import HomeAssistantError

    async def refuse(call) -> None:
        raise HomeAssistantError("Device unreachable")

    hass.services.async_register("update", "install", refuse)
    lamp = _device(hass, "Lampe")
    fw = _update(hass, lamp, features=5)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/update_status", "entity_id": fw})
    assert (await client.receive_json())["result"] == {"error": None}
    await client.send_json({"id": 2, "type": f"{DOMAIN}/update_install", "device_id": lamp.id, "entity_id": fw, "backup": False})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    await client.send_json({"id": 3, "type": f"{DOMAIN}/update_status", "entity_id": fw})
    assert (await client.receive_json())["result"] == {"error": "Device unreachable"}
