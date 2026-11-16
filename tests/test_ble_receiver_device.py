"""Bluetooth: der Empfänger (Proxy oder Adapter) wird, wenn er ein Gerät in Home Assistant ist, mit dessen Namen gezeigt und verlinkt (2.232.0)."""

from __future__ import annotations

import sys
import time
import types
from types import SimpleNamespace

from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel import devices

ADDRESS = "B0:A7:32:47:26:EA"
PROXY_MAC = "AA:BB:CC:00:00:01"  # Quelle eines ESPHome-Proxys (seine MAC-Adresse)
ADAPTER = "11:22:33:44:55:66"  # Adapter des Servers (Verbindung "bluetooth")
STRANGER = "DE:AD:BE:EF:00:01"  # niemand kennt ihn


def _fake_bluetooth(monkeypatch, scanners: list[tuple[str, str, int]]) -> None:
    """Die Bluetooth-Schnittstelle: je Empfänger (Quelle, gemeldeter Name, RSSI)."""
    module = types.ModuleType("homeassistant.components.bluetooth")
    items = [
        SimpleNamespace(scanner=SimpleNamespace(source=src, name=name, discovered_device_timestamps={ADDRESS: time.monotonic()}), advertisement=SimpleNamespace(rssi=rssi))
        for src, name, rssi in scanners
    ]
    module.async_scanner_devices_by_address = lambda _hass, _address, connectable=False: items  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "homeassistant.components.bluetooth", module)
    # "from homeassistant.components import bluetooth" liest das Attribut des Pakets, nicht nur sys.modules
    monkeypatch.setattr(sys.modules["homeassistant.components"], "bluetooth", module, raising=False)


def _devices(hass: HomeAssistant):
    hass.config.components.add("bluetooth")
    entry = MockConfigEntry(domain="test")
    entry.add_to_hass(hass)
    reg = dr.async_get(hass)
    sensor = reg.async_get_or_create(config_entry_id=entry.entry_id, identifiers={("test", "s")}, name="Pflanze", connections={(dr.CONNECTION_BLUETOOTH, ADDRESS)})
    proxy = reg.async_get_or_create(config_entry_id=entry.entry_id, identifiers={("esphome", "p")}, name="bt-proxy-garage", connections={(dr.CONNECTION_NETWORK_MAC, PROXY_MAC)})
    adapter = reg.async_get_or_create(config_entry_id=entry.entry_id, identifiers={("bluetooth", "a")}, name="Bluetooth-Adapter", connections={(dr.CONNECTION_BLUETOOTH, ADAPTER)})
    return sensor, proxy, adapter


def test_receiver_shown_by_the_name_of_its_device_and_linked(hass: HomeAssistant, monkeypatch) -> None:
    sensor, proxy, _adapter = _devices(hass)
    _fake_bluetooth(monkeypatch, [(PROXY_MAC, "esp-garage (AA:BB:CC:00:00:01)", -60), (ADAPTER, "hci0 (11:22:33:44:55:66)", -80)])
    # Der Proxy zählt (der stärkste): Name und Kennung seines Geräts in Home Assistant, nicht der Name des Empfängers
    assert devices.ble_receiver(hass, sensor) == (PROXY_MAC, "bt-proxy-garage")
    assert devices.ble_receiver_device_id(hass, sensor) == proxy.id
    assert [r["name"] for r in devices.ble_listeners(hass, sensor)] == ["bt-proxy-garage", "Bluetooth-Adapter"]
    signal, via = devices._ble_signal(hass, ADDRESS)
    assert signal == {"kind": "dbm", "value": -60} and via == "bt-proxy-garage"


def test_adapter_found_by_its_bluetooth_connection_and_unknown_receiver_keeps_its_name(hass: HomeAssistant, monkeypatch) -> None:
    sensor, _proxy, adapter = _devices(hass)
    _fake_bluetooth(monkeypatch, [(ADAPTER, "hci0 (11:22:33:44:55:66)", -55)])
    assert devices.ble_receiver_device_id(hass, sensor) == adapter.id
    _fake_bluetooth(monkeypatch, [(STRANGER, "Proxy Keller (DE:AD:BE:EF:00:01)", -55)])
    # Kein Gerät dazu: der gemeldete Name (ohne Adresse), kein Link
    assert devices.ble_receiver_device_id(hass, sensor) is None
    assert devices.ble_receiver(hass, sensor) == (STRANGER, "Proxy Keller (DE:AD:BE:EF:00:01)")
    assert devices._ble_scanner_device(hass, "kein-mac") is None
