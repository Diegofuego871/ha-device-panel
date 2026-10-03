"""Ausfall-Meldungen nach Bild 5 (0.20.0): Verzögerung, Inhalt, Aktionen, Stumm, Integrationen, anhaltend."""

from __future__ import annotations

import time
from datetime import timedelta
from typing import Any

import pytest
from homeassistant.components import persistent_notification
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.entity import EntityCategory
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed, async_mock_service

from custom_components.device_panel.const import DATA_AVAILABILITY, DATA_OUTAGE, DOMAIN, PERSISTENT_OUTAGE_ID
from custom_components.device_panel.devices import async_list_devices, async_set_connection_override, async_set_device_settings


@pytest.fixture
async def setup(hass: HomeAssistant):
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    log = hass.data[DATA_AVAILABILITY]
    log._started = time.time() - 3600  # Anlaufphase überspringen
    return log


def _device(hass: HomeAssistant, name: str, domain: str = "test", **kwargs: Any) -> dr.DeviceEntry:
    source = MockConfigEntry(domain=domain, title=f"{name} Eintrag")
    source.add_to_hass(hass)
    return dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={(domain, name)}, name=name, **kwargs)


def _entity(hass: HomeAssistant, device: dr.DeviceEntry, domain: str, key: str, state: str, **kwargs: Any) -> str:
    entry = er.async_get(hass).async_get_or_create(domain, "test", f"{device.id}-{key}", device_id=device.id, **kwargs)
    hass.states.async_set(entry.entity_id, state)
    return entry.entity_id


async def _options(hass: HomeAssistant, **values: Any) -> None:
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    hass.config_entries.async_update_entry(entry, options={**entry.options, **values})
    await hass.async_block_till_done()


async def _tick(hass: HomeAssistant, log, freezer, minutes: float) -> None:
    freezer.tick(timedelta(minutes=minutes))
    log.evaluate()
    async_fire_time_changed(hass)
    await hass.async_block_till_done()


def _persistent(hass: HomeAssistant) -> dict | None:
    return persistent_notification._async_get_or_create_notifications(hass).get(PERSISTENT_OUTAGE_ID)


async def test_delay_skips_short_outage(hass: HomeAssistant, setup, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    lamp = _device(hass, "Lampe")
    light = _entity(hass, lamp, "light", "l", "on")
    await _options(hass, notify_service="notify.handy", notify_outage=True, notify_online=True, notify_delay=5)
    setup.evaluate()
    # 4 Min. weg: ausgefallen (ab 2 Min.), aber kürzer als "Erst melden nach".
    hass.states.async_set(light, "unavailable")
    await _tick(hass, setup, freezer, 3)
    assert lamp.id in hass.data[DATA_OUTAGE].offline and calls == []
    await _tick(hass, setup, freezer, 1)
    hass.states.async_set(light, "on")
    await _tick(hass, setup, freezer, 0.5)
    # Weder Ausfall noch "wieder online".
    assert calls == [] and lamp.id not in hass.data[DATA_OUTAGE].offline
    # Länger weg: Meldung, sobald 5 Min. erreicht sind (Termin, ohne Wechsel).
    hass.states.async_set(light, "unavailable")
    await _tick(hass, setup, freezer, 3)
    assert calls == []
    freezer.tick(timedelta(minutes=2.5))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert [c.data["title"] for c in calls] == ["Offline: Lampe"]
    hass.states.async_set(light, "on")
    await _tick(hass, setup, freezer, 0.5)
    assert [c.data["title"] for c in calls] == ["Offline: Lampe", "Back online: Lampe"]


async def test_pending_outage_survives_restart(hass: HomeAssistant, hass_storage: dict[str, Any], freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    lamp = _device(hass, "Lampe")
    _entity(hass, lamp, "light", "l", "unavailable")
    start = time.time() - 120
    hass_storage[f"{DOMAIN}.notify"] = {"version": 1, "key": f"{DOMAIN}.notify", "data": {"offline": {lamp.id: start}, "notified": []}}
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options={"notify_service": "notify.handy", "notify_outage": True, "notify_delay": 5})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    notifier = hass.data[DATA_OUTAGE]
    assert lamp.id in notifier.offline and lamp.id not in notifier.notified and calls == []
    # Nach dem Start fällig: 5 Min. seit Beginn.
    freezer.tick(timedelta(minutes=4))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert [c.data["title"] for c in calls] == ["Offline: Lampe"] and lamp.id in notifier.notified


async def test_old_store_counts_as_notified(hass: HomeAssistant, hass_storage: dict[str, Any]) -> None:
    lamp = _device(hass, "Lampe")
    hass_storage[f"{DOMAIN}.notify"] = {"version": 1, "key": f"{DOMAIN}.notify", "data": {"offline": {lamp.id: time.time() - 600}}}
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    # Datei aus 0.19.0 ohne "notified": nichts nachmelden.
    assert hass.data[DATA_OUTAGE].notified == {lamp.id}


async def test_fields_and_actions(hass: HomeAssistant, setup, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    sensor = _device(hass, "Melder", manufacturer="Beispiel AG", model="Modell X")
    conn = _entity(hass, sensor, "binary_sensor", "c", "on", original_device_class="connectivity")
    bat = _entity(hass, sensor, "sensor", "b", "8", original_device_class="battery", entity_category=EntityCategory.DIAGNOSTIC)
    hass.states.async_set(bat, "8", {"unit_of_measurement": "%", "device_class": "battery"})
    await async_set_connection_override(hass, sensor.id, "zigbee")
    await _options(hass, notify_service="notify.handy", notify_outage=True, notify_fields=["model", "connection", "battery"])
    setup.evaluate()
    hass.states.async_set(conn, "off")
    await _tick(hass, setup, freezer, 3)
    assert len(calls) == 1
    # Feste Reihenfolge (Verbindung, Batterie, Modell), nicht die gewählte.
    assert calls[0].data["message"] == "Zigbee · battery 8 % · Beispiel AG Modell X"
    assert calls[0].data["data"]["actions"] == [
        {"action": "URI", "title": "Open", "uri": f"/device-panel?device={sensor.id}"},
        {"action": f"DEVICE_PANEL_MUTE_{sensor.id}", "title": "Mute 24 h"},
    ]


async def test_mute_action_and_integration_without_push(hass: HomeAssistant, setup, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    lamp = _device(hass, "Lampe")
    light = _entity(hass, lamp, "light", "l", "on")
    await _options(hass, notify_service="notify.handy", notify_outage=True)
    setup.evaluate()
    # Knopf "24 Std. stumm" unter einer Meldung
    hass.bus.async_fire("mobile_app_notification_action", {"action": f"DEVICE_PANEL_MUTE_{lamp.id}"})
    await hass.async_block_till_done()
    dev = next(d for d in (await async_list_devices(hass))["devices"] if d["id"] == lamp.id)
    assert dev["notify_mute_until"] is not None
    hass.states.async_set(light, "unavailable")
    await _tick(hass, setup, freezer, 3)
    assert calls == []  # stumm
    hass.states.async_set(light, "on")
    await _tick(hass, setup, freezer, 1)
    # Nach 24 Std. wieder
    freezer.tick(timedelta(hours=24))
    hass.states.async_set(light, "unavailable")
    await _tick(hass, setup, freezer, 3)
    assert [c.data["title"] for c in calls] == ["Offline: Lampe"]
    hass.states.async_set(light, "on")
    await _tick(hass, setup, freezer, 1)
    # Stumm per Aktion, "Globale Einstellung" im Popup hebt es auf.
    hass.bus.async_fire("mobile_app_notification_action", {"action": f"DEVICE_PANEL_MUTE_{lamp.id}"})
    await hass.async_block_till_done()
    await async_set_device_settings(hass, lamp.id, notify=True)
    dev = next(d for d in (await async_list_devices(hass))["devices"] if d["id"] == lamp.id)
    assert dev["notify_mute_until"] is None
    # Integration ohne Push (Spalte "Push" aus)
    await _options(hass, notify_exclude_integrations=["test"])
    hass.states.async_set(light, "unavailable")
    await _tick(hass, setup, freezer, 3)
    assert len(calls) == 1


async def test_persistent_outage_notification(hass: HomeAssistant, setup, freezer) -> None:
    lamp = _device(hass, "Lampe")
    light = _entity(hass, lamp, "light", "l", "on")
    plug = _device(hass, "Steckdose", domain="other")
    socket = _entity(hass, plug, "switch", "s", "on")
    await _options(hass, outage_persistent=True)
    setup.evaluate()
    assert _persistent(hass) is None
    hass.states.async_set(light, "unavailable")
    hass.states.async_set(socket, "unavailable")
    await _tick(hass, setup, freezer, 3)
    note = _persistent(hass)
    assert note["title"] == "Device Panel: devices offline"
    assert f"[Lampe](/device-panel?device={lamp.id})" in note["message"] and "Steckdose" in note["message"]
    # Integration ohne "Anhaltend": fällt weg
    await _options(hass, persistent_exclude_integrations=["other"])
    assert "Steckdose" not in _persistent(hass)["message"]
    # Weggeklickt: erst bei einem neuen Ausfall wieder
    persistent_notification.async_dismiss(hass, PERSISTENT_OUTAGE_ID)
    await hass.async_block_till_done()
    await _tick(hass, setup, freezer, 1)
    assert _persistent(hass) is None
    hass.states.async_set(light, "on")
    hass.states.async_set(socket, "on")
    await _tick(hass, setup, freezer, 1)
    hass.states.async_set(light, "unavailable")
    await _tick(hass, setup, freezer, 3)
    assert "Lampe" in _persistent(hass)["message"]
    # Alle zurück: verschwindet
    hass.states.async_set(light, "on")
    await _tick(hass, setup, freezer, 1)
    assert _persistent(hass) is None
