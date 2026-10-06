"""Warnschwelle des Empfangs pro Funkart, global und pro Integration (seit 1.17.0)."""

from __future__ import annotations

import pytest
import voluptuous as vol

from custom_components.device_panel.options_api import signal_default, signal_integrations_map, signal_map

DBM = {"kind": "dbm", "value": -70}
LQI = {"kind": "lqi", "value": 50}
OPTS = {
    "signal_low": {"wifi": -85, "zigbee": 40, "ble": "off"},
    "signal_low_integrations": {"shelly": {"wifi": -90, "ble": -95}},
}


def test_integration_before_global_before_standard() -> None:
    assert signal_default(OPTS, "shelly", "wifi", DBM) == {"value": -90, "source": "integration"}
    assert signal_default(OPTS, "esphome", "wifi", DBM) == {"value": -85, "source": "global"}
    # Eine Funkart ohne Eintrag und ohne Integration: fester Standard
    assert signal_default(OPTS, "esphome", "thread", DBM) == {"value": None, "source": None}
    assert signal_default({}, None, None, None) == {"value": None, "source": None}


def test_off_and_integration_beats_global_off() -> None:
    assert signal_default(OPTS, "esphome", "ble", DBM) == {"value": "off", "source": "global"}
    # Die Integration geht vor, auch gegen das globale "off"
    assert signal_default(OPTS, "shelly", "ble", DBM) == {"value": -95, "source": "integration"}


def test_unit_must_match_the_device() -> None:
    # Zigbee-Schwelle ist LQI (40); meldet das Gerät dBm, gilt sie nicht: nächste Stufe, sonst Standard
    assert signal_default(OPTS, "zha", "zigbee", LQI) == {"value": 40, "source": "global"}
    assert signal_default(OPTS, "zha", "zigbee", DBM) == {"value": None, "source": None}
    # "off" gilt für jede Einheit
    assert signal_default({"signal_low": {"zigbee": "off"}}, "zha", "zigbee", DBM) == {"value": "off", "source": "global"}


def test_signal_map_validation() -> None:
    assert signal_map(None) == {}
    assert signal_map({"zigbee": 40, "wifi": -85, "ble": False, "thread": "OFF"}) == {"ble": "off", "thread": "off", "wifi": -85, "zigbee": 40}
    for bad in ([], {"funk": -85}, {"wifi": -20}, {"wifi": 0}, {"zigbee": 300}, {"wifi": "schwach"}):
        with pytest.raises(vol.Invalid):
            signal_map(bad)


def test_signal_integrations_map_validation() -> None:
    assert signal_integrations_map({"shelly": {"wifi": -88, "ble": "off"}, "zha": {}}) == {"shelly": {"ble": "off", "wifi": -88}}
    assert signal_integrations_map(None) == {}
    for bad in ([], {"Shelly!": {"wifi": -88}}, {"shelly": {"funk": -88}}, {"shelly": {"wifi": 0}}, {"shelly": -88}):
        with pytest.raises(vol.Invalid):
            signal_integrations_map(bad)
