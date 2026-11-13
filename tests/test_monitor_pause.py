"""Pause der Überwachung eines Geräts (2.214.0, Issue 4): bis Datum oder bis wieder online, Wirkung wie "Überwachen aus", Aktion in der Meldung, Sicherung."""

from __future__ import annotations

import time
from datetime import timedelta
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed, async_mock_service

from custom_components.device_panel import backup
from custom_components.device_panel.availability import OFFLINE
from custom_components.device_panel.const import DATA_AVAILABILITY, DATA_DEVICE_SETTINGS, DOMAIN
from custom_components.device_panel.devices import async_list_devices, async_set_device_settings, device_offline_after, monitor_pause
from custom_components.device_panel.monitor_pause import ONLINE_CONFIRM, async_set_pause
from custom_components.device_panel.options_api import effective


@pytest.fixture
async def setup(hass: HomeAssistant):
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options={"status_notify": False})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    log = hass.data[DATA_AVAILABILITY]
    log._started = time.time() - 3600
    return log


def _device(hass: HomeAssistant, name: str) -> dr.DeviceEntry:
    source = MockConfigEntry(domain="test", title=f"{name} Eintrag")
    source.add_to_hass(hass)
    return dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={("test", name)}, name=name)


def _entity(hass: HomeAssistant, device: dr.DeviceEntry, state: str) -> str:
    entry = er.async_get(hass).async_get_or_create("light", "test", f"{device.id}-l", device_id=device.id)
    hass.states.async_set(entry.entity_id, state)
    return entry.entity_id


async def _listed(hass: HomeAssistant, device: dr.DeviceEntry) -> dict[str, Any]:
    return next(d for d in (await async_list_devices(hass))["devices"] if d["id"] == device.id)


async def _minutes(hass: HomeAssistant, freezer, minutes: float) -> None:
    freezer.tick(timedelta(minutes=minutes))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()


async def test_date_pause_acts_like_monitoring_off_until_it_ends(hass: HomeAssistant, setup, freezer) -> None:
    lamp = _device(hass, "Ventil")
    light = _entity(hass, lamp, "on")
    opts = effective(hass)
    assert device_offline_after(hass, opts, lamp) is not None
    until = time.time() + 3600
    await async_set_pause(hass, lamp.id, {"mode": "date", "until": until})
    # Wie "Überwachen aus": nicht überwacht, aber mit der Pause im Eintrag
    assert device_offline_after(hass, opts, lamp) is None
    assert device_offline_after(hass, opts, lamp, ignore_pause=True) is not None
    listed = await _listed(hass, lamp)
    assert listed["unmonitored"] is True and listed["monitor_pause_setting"] == {"mode": "date", "until": until}
    # Auch ein Ausfall während der Pause bleibt ohne Folgen (kein Status)
    hass.states.async_set(light, "unavailable")
    assert (await _listed(hass, lamp))["online"] is None
    # Das Datum ist erreicht: der Wächter beendet die Pause und schreibt ins Protokoll
    await _minutes(hass, freezer, 61)
    assert monitor_pause(hass, lamp.id) is None
    assert lamp.id not in hass.data[DATA_DEVICE_SETTINGS]["monitor_pause"]
    assert device_offline_after(hass, opts, lamp) is not None


async def test_online_pause_waits_for_the_device_to_be_gone_and_back(hass: HomeAssistant, setup, freezer) -> None:
    lamp = _device(hass, "Bodenfeuchte")
    light = _entity(hass, lamp, "on")
    # Noch online beim Pausieren: die Pause endet nicht gleich, erst nachdem es weg war und wieder da ist
    await async_set_pause(hass, lamp.id, {"mode": "online"})
    assert hass.data[DATA_DEVICE_SETTINGS]["monitor_pause"][lamp.id] == {"mode": "online", "seen_off": False}
    await _minutes(hass, freezer, 5)
    assert monitor_pause(hass, lamp.id) is not None
    hass.states.async_set(light, "unavailable")
    await _minutes(hass, freezer, 1)
    assert hass.data[DATA_DEVICE_SETTINGS]["monitor_pause"][lamp.id]["seen_off"] is True
    # Wieder da, aber noch keine zwei Minuten am Stück: die Pause gilt weiter
    hass.states.async_set(light, "on")
    await _minutes(hass, freezer, 1)
    assert monitor_pause(hass, lamp.id) is not None
    # Kurz weg und wieder da setzt die Zeit zurück
    hass.states.async_set(light, "unavailable")
    await _minutes(hass, freezer, 1)
    hass.states.async_set(light, "on")
    await _minutes(hass, freezer, 1)
    assert monitor_pause(hass, lamp.id) is not None
    await _minutes(hass, freezer, ONLINE_CONFIRM / 60 + 1)
    assert monitor_pause(hass, lamp.id) is None
    assert device_offline_after(hass, effective(hass), lamp) is not None


async def test_pause_started_while_offline_ends_at_the_first_return(hass: HomeAssistant, setup, freezer) -> None:
    lamp = _device(hass, "Gardena")
    light = _entity(hass, lamp, "unavailable")
    await async_set_pause(hass, lamp.id, {"mode": "online"})
    assert hass.data[DATA_DEVICE_SETTINGS]["monitor_pause"][lamp.id]["seen_off"] is True
    await _minutes(hass, freezer, 30)
    assert monitor_pause(hass, lamp.id) is not None
    hass.states.async_set(light, "on")
    await _minutes(hass, freezer, 1)
    await _minutes(hass, freezer, 3)
    assert monitor_pause(hass, lamp.id) is None


async def test_resume_while_still_offline_starts_the_outage_now(hass: HomeAssistant, setup, freezer) -> None:
    lamp = _device(hass, "Gartenlicht")
    light = _entity(hass, lamp, "on")
    setup.evaluate()
    hass.states.async_set(light, "unavailable")
    await _minutes(hass, freezer, 3)
    start = time.time()
    await async_set_pause(hass, lamp.id, {"mode": "date", "until": start + 30 * 86400})
    setup.evaluate()
    # Der Winter vergeht, das Datum kommt, das Gerät ist weiter weg
    await _minutes(hass, freezer, 31 * 24 * 60)
    assert monitor_pause(hass, lamp.id) is None
    setup.evaluate()
    # Der Ausfall steht ab dem Ende der Pause im Protokoll (nicht ab ihrem Beginn: sonst stünde der ganze Winter als Ausfall in der Statistik)
    last = setup._events[lamp.id][-1]
    assert last[1] == OFFLINE and last[0] >= start + 30 * 86400 - 5


async def test_action_in_the_notification_pauses_until_online(hass: HomeAssistant, setup, freezer) -> None:
    async_mock_service(hass, "notify", "handy")
    lamp = _device(hass, "Rasensprenger")
    light = _entity(hass, lamp, "unavailable")
    hass.bus.async_fire("mobile_app_notification_action", {"action": f"DEVICE_PANEL_PAUSE_{lamp.id}"})
    await hass.async_block_till_done()
    assert hass.data[DATA_DEVICE_SETTINGS]["monitor_pause"][lamp.id] == {"mode": "online", "seen_off": True}
    # Unbekanntes Gerät: nichts
    hass.bus.async_fire("mobile_app_notification_action", {"action": "DEVICE_PANEL_PAUSE_gibtsnicht"})
    await hass.async_block_till_done()
    assert set(hass.data[DATA_DEVICE_SETTINGS]["monitor_pause"]) == {lamp.id}
    del light


async def test_pause_in_backup_reset_and_validation(hass: HomeAssistant, setup) -> None:
    a, b, c = _device(hass, "A"), _device(hass, "B"), _device(hass, "C")
    until = time.time() + 86400
    await async_set_pause(hass, a.id, {"mode": "date", "until": until})
    await async_set_pause(hass, b.id, {"mode": "online"})
    file = await backup.async_export(hass, ["devices"])
    assert file["sections"]["devices"]["settings"][a.id] == {"monitor_pause": {"mode": "date", "until": until}}
    assert file["sections"]["devices"]["settings"][b.id]["monitor_pause"]["mode"] == "online"
    await async_set_pause(hass, a.id, None)
    await async_set_pause(hass, b.id, None)
    file["sections"]["devices"]["settings"][c.id] = {"monitor_pause": {"mode": "date", "until": "morgen"}}  # kein gültiges Datum
    report = await backup.async_import(hass, file, ["devices"], dry_run=False)
    assert hass.data[DATA_DEVICE_SETTINGS]["monitor_pause"][a.id]["until"] == until
    assert b.id in hass.data[DATA_DEVICE_SETTINGS]["monitor_pause"]
    assert c.id not in hass.data[DATA_DEVICE_SETTINGS]["monitor_pause"]
    assert any(s["what"] == "monitor_pause" and s["reason"] == "invalid" for s in report["sections"]["devices"]["skipped"])
    # "Ausgefallen nach" zurücksetzen nimmt die Pause mit
    from custom_components.device_panel.devices import async_reset_device_settings

    await async_set_device_settings(hass, a.id, offline=7)
    await async_reset_device_settings(hass, [], [], offline=[a.id])
    assert a.id not in hass.data[DATA_DEVICE_SETTINGS]["monitor_pause"]


async def test_ws_validation_refuses_a_past_end(hass: HomeAssistant, setup, hass_ws_client) -> None:
    client = await hass_ws_client(hass)
    lamp = _device(hass, "WS")
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_device_settings", "device_id": lamp.id, "monitor_pause": {"mode": "date", "until": time.time() - 10}})
    assert (await client.receive_json())["success"] is False
    await client.send_json({"id": 2, "type": f"{DOMAIN}/set_device_settings", "device_id": lamp.id, "monitor_pause": {"mode": "date", "until": time.time() + 600}})
    assert (await client.receive_json())["success"] is True
    assert monitor_pause(hass, lamp.id) is not None
    await client.send_json({"id": 3, "type": f"{DOMAIN}/set_device_settings", "device_id": lamp.id, "monitor_pause": None})
    assert (await client.receive_json())["success"] is True
    assert monitor_pause(hass, lamp.id) is None
