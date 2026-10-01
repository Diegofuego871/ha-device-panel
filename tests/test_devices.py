"""Gerätedaten für das Panel mit echtem Home Assistant: Status, Verbindung, Empfang, Batterie."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import pytest
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel.const import DATA_STARTED_AT, DOMAIN
from custom_components.device_panel.devices import async_list_devices


@pytest.fixture
async def setup(hass: HomeAssistant) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()


def _device(hass: HomeAssistant, name: str, domain: str = "test", **kwargs: Any) -> dr.DeviceEntry:
    source = MockConfigEntry(domain=domain)
    source.add_to_hass(hass)
    return dr.async_get(hass).async_get_or_create(
        config_entry_id=source.entry_id, identifiers={(domain, name)}, name=name, **kwargs
    )


def _entity(hass: HomeAssistant, device: dr.DeviceEntry, domain: str, key: str, state: str, attrs: dict | None = None, **kwargs: Any) -> str:
    entry = er.async_get(hass).async_get_or_create(domain, "test", f"{device.id}-{key}", device_id=device.id, **kwargs)
    hass.states.async_set(entry.entity_id, state, attrs or {})
    return entry.entity_id


async def _by_name(hass: HomeAssistant) -> dict[str, dict[str, Any]]:
    return {d["name"]: d for d in (await async_list_devices(hass))["devices"]}


async def test_offline_only_after_two_minutes(hass: HomeAssistant, setup, freezer) -> None:
    lamp = _device(hass, "Lampe")
    _entity(hass, lamp, "light", "l", "unavailable")
    assert (await _by_name(hass))["Lampe"]["online"] is True  # kurzer Aussetzer
    freezer.tick(timedelta(minutes=3))
    lamp_data = (await _by_name(hass))["Lampe"]
    assert lamp_data["online"] is False
    since = dt_util.parse_datetime(lamp_data["offline_since"])
    assert timedelta(minutes=2) < dt_util.utcnow() - since < timedelta(minutes=4)
    assert lamp_data["since_restart"] is False


async def test_one_live_entity_keeps_device_online(hass: HomeAssistant, setup, freezer) -> None:
    sensor = _device(hass, "Sensor")
    _entity(hass, sensor, "sensor", "a", "unavailable")
    _entity(hass, sensor, "sensor", "b", "21.5")
    freezer.tick(timedelta(minutes=5))
    assert (await _by_name(hass))["Sensor"]["online"] is True


async def test_diagnostic_entities_do_not_count(hass: HomeAssistant, setup, freezer) -> None:
    plug = _device(hass, "Steckdose")
    _entity(hass, plug, "switch", "sw", "unavailable")
    _entity(hass, plug, "sensor", "uptime", "123", entity_category=EntityCategory.DIAGNOSTIC)
    freezer.tick(timedelta(minutes=5))
    assert (await _by_name(hass))["Steckdose"]["online"] is False


async def test_connectivity_sensor_wins(hass: HomeAssistant, setup, freezer) -> None:
    cam = _device(hass, "Kamera")
    _entity(hass, cam, "sensor", "temp", "20")
    _entity(hass, cam, "binary_sensor", "conn", "off", original_device_class="connectivity")
    freezer.tick(timedelta(minutes=5))
    assert (await _by_name(hass))["Kamera"]["online"] is False


async def test_connectivity_unknown_is_not_offline(hass: HomeAssistant, setup, freezer) -> None:
    cam = _device(hass, "Kamera 2")
    _entity(hass, cam, "binary_sensor", "conn", "unknown", original_device_class="connectivity")
    freezer.tick(timedelta(minutes=5))
    assert (await _by_name(hass))["Kamera 2"]["online"] is True


async def test_no_states_means_no_data(hass: HomeAssistant, setup) -> None:
    _device(hass, "Leer")
    assert (await _by_name(hass))["Leer"]["online"] is None


async def test_offline_before_restart_is_marked(hass: HomeAssistant, setup, freezer) -> None:
    hass.data[DATA_STARTED_AT] = dt_util.utcnow()
    old = _device(hass, "Alt")
    _entity(hass, old, "light", "l", "unavailable")
    freezer.tick(timedelta(minutes=10))
    data = (await _by_name(hass))["Alt"]
    assert data["online"] is False
    assert data["since_restart"] is True


async def test_battery_signal_update_and_wifi(hass: HomeAssistant, setup) -> None:
    dev = _device(hass, "Melder", connections={(dr.CONNECTION_NETWORK_MAC, "aa:bb:cc:dd:ee:01")})
    _entity(hass, dev, "sensor", "bat", "8", {"unit_of_measurement": "%"}, original_device_class="battery")
    _entity(hass, dev, "sensor", "rssi", "-84", {"unit_of_measurement": "dBm"}, original_device_class="signal_strength")
    _entity(hass, dev, "update", "fw", "on", {"latest_version": "2.2.0", "installed_version": "2.1.4"})
    data = (await _by_name(hass))["Melder"]
    assert data["battery"] == {"level": 8, "low": True}
    assert data["signal"] == {"kind": "dbm", "value": -84}
    assert data["connection"] == "wifi"
    assert data["update"] == "2.2.0"


async def test_battery_binary_low(hass: HomeAssistant, setup) -> None:
    dev = _device(hass, "Fenster")
    _entity(hass, dev, "binary_sensor", "batlow", "off", original_device_class="battery")
    assert (await _by_name(hass))["Fenster"]["battery"] == {"level": None, "low": False}


async def test_lqi_from_zigbee2mqtt_sensor(hass: HomeAssistant, setup) -> None:
    dev = _device(hass, "Taster", domain="mqtt")
    dr.async_get(hass).async_update_device(dev.id, new_identifiers={("mqtt", "zigbee2mqtt_0x00158d0001")})
    _entity(hass, dev, "sensor", "linkquality", "61", {"unit_of_measurement": "lqi"})
    data = (await _by_name(hass))["Taster"]
    assert data["signal"] == {"kind": "lqi", "value": 61}
    assert data["connection"] == "zigbee"


@pytest.mark.parametrize(
    ("domain", "kwargs", "expected"),
    [
        ("zha", {}, "zigbee"),
        ("zwave_js", {}, "zwave"),
        ("matter", {}, "matter"),
        ("test", {"connections": {(dr.CONNECTION_ZIGBEE, "00:15:8d:00:0a:41:7c:22")}}, "zigbee"),
        ("test", {"connections": {(dr.CONNECTION_BLUETOOTH, "A4:C1:38:00:00:01")}}, "ble"),
        ("met", {}, "cloud"),
        ("test", {"connections": {(dr.CONNECTION_NETWORK_MAC, "aa:bb:cc:dd:ee:02")}}, "network"),
        ("test", {}, None),
    ],
)
async def test_connection_type(hass: HomeAssistant, setup, domain: str, kwargs: dict, expected: str | None) -> None:
    _device(hass, "Gerät", domain=domain, **kwargs)
    assert (await _by_name(hass))["Gerät"]["connection"] == expected


async def test_hue_bridge_and_lights(hass: HomeAssistant, setup) -> None:
    bridge = _device(hass, "Bridge", domain="hue", connections={(dr.CONNECTION_NETWORK_MAC, "aa:bb:cc:dd:ee:03")})
    source = MockConfigEntry(domain="hue")
    source.add_to_hass(hass)
    dr.async_get(hass).async_get_or_create(
        config_entry_id=source.entry_id, identifiers={("hue", "bulb")}, name="Birne", via_device=("hue", "Bridge")
    )
    data = await _by_name(hass)
    assert bridge.name == "Bridge"
    assert data["Bridge"]["connection"] == "network"
    assert data["Birne"]["connection"] == "zigbee"
    assert data["Birne"]["via"] == "Bridge"


async def test_response_has_names_and_time(hass: HomeAssistant, setup) -> None:
    _device(hass, "Wetter", domain="met")
    result = await async_list_devices(hass)
    assert result["integrations"]["met"].startswith("Meteorologisk")
    assert result["offline_after"] == 120
    assert result["battery_low"] == 15
    assert dt_util.parse_datetime(result["now"]) is not None
