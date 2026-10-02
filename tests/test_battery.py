"""Batterie-Warnung: Push (einmal, Hysterese, Sammelmeldung), anhaltende Benachrichtigung, Push-Ziele."""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.components import persistent_notification
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.device_panel.battery import BatteryWatch
from custom_components.device_panel.const import DATA_AVAILABILITY, DATA_BATTERY, DOMAIN, PERSISTENT_BATTERY_ID
from custom_components.device_panel.devices import async_list_devices
from custom_components.device_panel.options_api import notify_targets


@pytest.fixture
async def watch(hass: HomeAssistant) -> BatteryWatch:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return hass.data[DATA_BATTERY]


def _device(hass: HomeAssistant, name: str, **kwargs: Any) -> dr.DeviceEntry:
    source = MockConfigEntry(domain="test", title=f"{name} Eintrag")
    source.add_to_hass(hass)
    return dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={("test", name)}, name=name, **kwargs)


def _battery(hass: HomeAssistant, device: dr.DeviceEntry, state: str, domain: str = "sensor") -> str:
    entry = er.async_get(hass).async_get_or_create(domain, "test", f"{device.id}-bat", device_id=device.id, original_device_class="battery")
    hass.states.async_set(entry.entity_id, state)
    return entry.entity_id


async def _options(hass: HomeAssistant, **values: Any) -> None:
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    hass.config_entries.async_update_entry(entry, options={**entry.options, **values})
    await hass.async_block_till_done()


def _persistent(hass: HomeAssistant) -> dict | None:
    return persistent_notification._async_get_or_create_notifications(hass).get(PERSISTENT_BATTERY_ID)


async def test_push_once_rearm_and_persistent(hass: HomeAssistant, watch: BatteryWatch) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    dev = _device(hass, "Sensor Keller")
    bat = _battery(hass, dev, "50")
    await _options(hass, battery_push=True, battery_persistent=True, notify_service="notify.handy")
    await watch.async_check()
    assert calls == [] and _persistent(hass) is None

    hass.states.async_set(bat, "10")
    await watch.async_check()
    assert len(calls) == 1
    assert calls[0].data["title"] == "Low battery: Sensor Keller"
    assert calls[0].data["message"] == "10 %"
    assert calls[0].data["data"]["url"] == f"/device-panel?device={dev.id}"
    assert calls[0].data["data"]["clickAction"] == f"/device-panel?device={dev.id}"
    assert calls[0].data["data"]["tag"] == f"{DOMAIN}_battery_{dev.id}"
    note = _persistent(hass)
    assert note is not None and "Sensor Keller" in note["message"] and "(up to 15 %)" in note["message"]

    await watch.async_check()
    assert len(calls) == 1  # einmal pro Gerät
    # 18 % liegt in der Hysterese (15 + 5): weiter schwach, keine neue Meldung
    hass.states.async_set(bat, "18")
    await watch.async_check()
    assert len(calls) == 1 and dev.id in watch.low and "18 %" in _persistent(hass)["message"]
    # Neue Batterie: nicht mehr schwach, Benachrichtigung verschwindet
    hass.states.async_set(bat, "100")
    await watch.async_check()
    assert watch.low == {} and _persistent(hass) is None
    # Wieder schwach: neue Meldung
    hass.states.async_set(bat, "12")
    await watch.async_check()
    assert len(calls) == 2


async def test_unavailable_keeps_state(hass: HomeAssistant, watch: BatteryWatch) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, battery_push=True, notify_service="notify.handy")
    dev = _device(hass, "Fenster")
    bat = _battery(hass, dev, "8")
    await watch.async_check()
    assert len(calls) == 1
    # Kurz nicht erreichbar: kein Zurücksetzen, die Rückkehr meldet nicht erneut
    hass.states.async_set(bat, "unavailable")
    await watch.async_check()
    assert dev.id in watch.low
    hass.states.async_set(bat, "7")
    await watch.async_check()
    assert len(calls) == 1


async def test_many_at_once_one_push(hass: HomeAssistant, watch: BatteryWatch) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, battery_push=True, notify_service="notify.handy")
    for i in range(5):
        _battery(hass, _device(hass, f"Gerät {i}"), str(5 + i))
    await watch.async_check()
    assert len(calls) == 1
    assert calls[0].data["title"] == "Low battery: 5 devices"
    assert calls[0].data["message"].startswith("Gerät 0 5 %, Gerät 1 6 %")
    assert calls[0].data["data"]["url"] == "/device-panel"


async def test_binary_sensor_and_click_target(hass: HomeAssistant, watch: BatteryWatch) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, battery_push=True, notify_service="notify.handy", notify_click_target="device")
    dev = _device(hass, "Rauchmelder")
    _battery(hass, dev, "on", domain="binary_sensor")
    await watch.async_check()
    assert calls[0].data["message"] == "low"
    assert calls[0].data["data"]["url"] == f"/config/devices/device/{dev.id}"


async def test_dismissed_stays_away_until_new_device(hass: HomeAssistant, watch: BatteryWatch) -> None:
    await _options(hass, battery_persistent=True)
    _battery(hass, _device(hass, "A"), "10")
    await watch.async_check()
    assert _persistent(hass) is not None
    persistent_notification.async_dismiss(hass, PERSISTENT_BATTERY_ID)
    await watch.async_check()
    assert _persistent(hass) is None  # weggeklickt: Ruhe
    _battery(hass, _device(hass, "B"), "9")
    await watch.async_check()
    note = _persistent(hass)
    assert note is not None and "[A]" in note["message"] and "[B]" in note["message"]


async def test_switching_push_on_reports_current(hass: HomeAssistant, watch: BatteryWatch, hass_ws_client) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    _battery(hass, _device(hass, "A"), "10")
    await watch.async_check()
    assert calls == [] and watch.low  # ohne Push: still, aber gemerkt
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_options", "values": {"battery_push": True, "notify_service": "notify.handy"}})
    assert (await client.receive_json())["result"] == {"changed": True}
    await hass.async_block_till_done()
    assert len(calls) == 1  # eingeschaltet: die aktuell schwachen einmal melden
    await watch.async_check()
    assert len(calls) == 1


async def test_restart_does_not_repeat(hass: HomeAssistant, hass_storage: dict[str, Any]) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    dev = _device(hass, "A")
    _battery(hass, dev, "10")
    hass_storage[f"{DOMAIN}.battery"] = {"version": 1, "minor_version": 1, "key": f"{DOMAIN}.battery", "data": {"low": {dev.id: {"name": "A", "level": 11, "area": None}}}}
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options={"battery_push": True, "notify_service": "notify.handy", "battery_persistent": True})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    await hass.data[DATA_BATTERY].async_check()
    assert calls == []
    # Die anhaltende Benachrichtigung lebt nicht über den Neustart: neu aufbauen.
    assert _persistent(hass) is not None


async def test_threshold_in_list(hass: HomeAssistant, watch: BatteryWatch) -> None:
    _battery(hass, _device(hass, "A"), "25")
    log = hass.data[DATA_AVAILABILITY]
    assert (await async_list_devices(hass, log))["devices"][0]["battery"] == {"level": 25, "low": False}
    await _options(hass, battery_low=30)
    result = await async_list_devices(hass, log)
    assert result["devices"][0]["battery"]["low"] is True and result["battery_low"] == 30


async def test_notify_targets_and_entity_push(hass: HomeAssistant, watch: BatteryWatch) -> None:
    async_mock_service(hass, "notify", "handy")
    async_mock_service(hass, "notify", "persistent_notification")
    sent = async_mock_service(hass, "notify", "send_message")
    hass.states.async_set("notify.fernseher", "unknown")
    targets = notify_targets(hass, "notify.alt")
    assert targets == [
        {"value": "none", "kind": "none"},
        {"value": "notify.handy", "kind": "service"},
        {"value": "notify.fernseher", "kind": "entity"},
        {"value": "notify.alt", "kind": "missing"},
    ]
    await _options(hass, battery_push=True, notify_service="notify.fernseher")
    _battery(hass, _device(hass, "A"), "3")
    await watch.async_check()
    # Entität: nur Titel und Text über send_message
    assert len(sent) == 1 and sent[0].data == {"title": "Low battery: A", "message": "3 %", "entity_id": "notify.fernseher"}


async def test_target_rejecting_data_gets_plain_message(hass: HomeAssistant, watch: BatteryWatch) -> None:
    received: list[dict] = []

    async def handler(call: ServiceCall) -> None:
        if "data" in call.data:
            raise ValueError("extra keys not allowed")
        received.append(dict(call.data))

    hass.services.async_register("notify", "mail", handler)
    await _options(hass, battery_push=True, notify_service="notify.mail")
    _battery(hass, _device(hass, "A"), "3")
    await watch.async_check()
    assert received == [{"title": "Low battery: A", "message": "3 %"}]


async def test_push_options_are_checked(hass: HomeAssistant, watch: BatteryWatch, hass_ws_client) -> None:
    client = await hass_ws_client(hass)
    for i, values in enumerate(({"notify_service": "light.kueche"}, {"notify_service": 5}, {"notify_click_target": "irgendwo"}, {"battery_low": 51}), 1):
        await client.send_json({"id": i, "type": f"{DOMAIN}/set_options", "values": values})
        assert (await client.receive_json())["error"]["code"] == "invalid_format", values
    await client.send_json({"id": 9, "type": f"{DOMAIN}/get_options"})
    result = (await client.receive_json())["result"]
    assert result["values"]["notify_service"] == "none" and result["values"]["notify_click_target"] == "panel"
    assert result["notify_targets"][0] == {"value": "none", "kind": "none"}
    assert result["limits"]["battery_low"] == [5, 50]


async def test_threshold_per_integration(hass: HomeAssistant, watch: BatteryWatch, hass_ws_client) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    dev = _device(hass, "Fenster")  # Integration "test"
    _battery(hass, dev, "25")
    log = hass.data[DATA_AVAILABILITY]
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/get_options"})
    battery_list = (await client.receive_json())["result"]["catalog"]["battery"]
    # Nur Integrationen mit Batteriegeräten, mit Zahl und schwächster Batterie
    assert battery_list == [{"domain": "test", "name": "test", "devices": 1, "weakest": 25}]

    await client.send_json({"id": 2, "type": f"{DOMAIN}/set_options", "values": {
        "battery_push": True, "battery_persistent": True, "notify_service": "notify.handy",
        "battery_low_integrations": {"test": 30, "zha": 20},
    }})
    assert (await client.receive_json())["result"] == {"changed": True}
    await hass.async_block_till_done()
    # 25 % liegt unter der eigenen Schwelle 30 %, nicht unter der allgemeinen 15 %
    assert (await async_list_devices(hass, log))["devices"][0]["battery"]["low"] is True
    assert len(calls) == 1 and calls[0].data["title"] == "Low battery: Fenster"
    assert "(threshold per integration or device)" in _persistent(hass)["message"]
    # Eigene Schwelle ohne Geräte bleibt in der Liste (zum Zurücksetzen)
    await client.send_json({"id": 3, "type": f"{DOMAIN}/get_options"})
    domains = {b["domain"]: b["devices"] for b in (await client.receive_json())["result"]["catalog"]["battery"]}
    assert domains == {"test": 1, "zha": 0}
    # Wiederscharf nach der eigenen Schwelle: 33 % (30 + 5 - 2) bleibt schwach
    hass.states.async_set(next(iter(e.entity_id for e in er.async_entries_for_device(er.async_get(hass), dev.id))), "33")
    await watch.async_check()
    assert dev.id in watch.low


async def test_battery_map_is_checked(hass: HomeAssistant, watch: BatteryWatch, hass_ws_client) -> None:
    client = await hass_ws_client(hass)
    bad = ({"zha": 60}, {"zha": 4}, {"zha": True}, {"Böse Domain": 20}, {"zha": "20"}, ["zha"])
    for i, value in enumerate(bad, 1):
        await client.send_json({"id": i, "type": f"{DOMAIN}/set_options", "values": {"battery_low_integrations": value}})
        assert (await client.receive_json())["error"]["code"] == "invalid_format", value
    await client.send_json({"id": 20, "type": f"{DOMAIN}/set_options", "values": {"battery_low_integrations": {}}})
    assert (await client.receive_json())["result"]["changed"] is True
