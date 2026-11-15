"""Empfang von Thread-Geräten (devices._thread_signal, seit 2.229.0): Nachbartabelle des Matter-Knotens, stärkster Nachbar, eigene Aufzeichnung."""

from __future__ import annotations

import sys
import time
import types
from types import SimpleNamespace
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel import devices, signal_history
from custom_components.device_panel.const import DATA_AVAILABILITY, DATA_SIGNAL, DOMAIN
from custom_components.device_panel.signal_history import SignalLog

HELPERS = "homeassistant.components.matter.helpers"


def _fake_matter(monkeypatch: pytest.MonkeyPatch, nodes: dict[str, Any]) -> None:
    """Die Matter-Hilfsfunktion, die ein Knotenobjekt zur Geräte-Kennung liefert (die Matter-Bibliothek ist im Test nicht geladen)."""
    module = types.ModuleType(HELPERS)

    def node_from_ha_device_id(_hass, device_id):
        node = nodes[device_id]
        if isinstance(node, Exception):
            raise node
        return node

    module.node_from_ha_device_id = node_from_ha_device_id  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, HELPERS, module)


def _node(table: Any, available: bool = True) -> SimpleNamespace:
    return SimpleNamespace(node_data=SimpleNamespace(attributes={} if table is None else {devices.THREAD_NEIGHBORS: table}), available=available)


def test_strongest_neighbour_wins_with_average_before_last(hass: HomeAssistant, monkeypatch) -> None:
    hass.config.components.add("matter")
    table = [
        {"0": 1, "6": -88, "7": -85},  # Nachbar 1: mittlerer RSSI -88
        {"0": 2, "6": -61, "7": -90},  # Nachbar 2: -61 (mittlerer vor letztem)
        {"0": 3, "6": None, "7": -70},  # ohne Mittelwert: der letzte
        {"0": 4, "6": 0, "7": 127},  # kein Messwert
    ]
    _fake_matter(monkeypatch, {"a": _node(table)})
    assert devices._thread_signal(hass, "a") == {"kind": "dbm", "value": -61}


def test_objects_with_names_are_read_too(hass: HomeAssistant, monkeypatch) -> None:
    hass.config.components.add("matter")
    _fake_matter(monkeypatch, {"a": _node([SimpleNamespace(averageRssi=-72, lastRssi=-70)])})
    assert devices._thread_signal(hass, "a") == {"kind": "dbm", "value": -72}


def test_no_value_for_unreachable_or_without_valid_neighbours_but_still_a_thread_device(hass: HomeAssistant, monkeypatch) -> None:
    hass.config.components.add("matter")
    _fake_matter(monkeypatch, {"off": _node([{"6": -60}], available=False), "none": _node([{"6": 0, "7": 127}]), "empty": _node([])})
    # Wert None, die Art bleibt: der Reiter "Empfang" mit dem Verlauf bleibt
    for key in ("off", "none", "empty"):
        assert devices._thread_signal(hass, key) == {"kind": "dbm", "value": None}, key


def test_not_a_thread_device_or_broken_interface(hass: HomeAssistant, monkeypatch) -> None:
    # Matter nicht geladen
    assert devices._thread_signal(hass, "a") is None
    hass.config.components.add("matter")
    _fake_matter(monkeypatch, {"wifi": _node(None), "nonode": None, "broken": RuntimeError("Schnittstelle geändert"), "text": _node("kaputt")})
    for key in ("wifi", "nonode", "broken", "text"):
        assert devices._thread_signal(hass, key) is None, key


async def _setup(hass: HomeAssistant) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()


async def test_source_is_thread_and_recorded_but_wifi_matter_keeps_its_sensor(hass: HomeAssistant, monkeypatch) -> None:
    await _setup(hass)
    hass.config.components.add("matter")
    matter = MockConfigEntry(domain="matter")
    matter.add_to_hass(hass)
    reg = dr.async_get(hass)
    thread = reg.async_get_or_create(config_entry_id=matter.entry_id, identifiers={("matter", "t")}, name="Fensterkontakt")
    wifi = reg.async_get_or_create(config_entry_id=matter.entry_id, identifiers={("matter", "w")}, name="Steckdose")
    contact = er.async_get(hass).async_get_or_create("binary_sensor", "matter", "t-c", device_id=thread.id)
    hass.states.async_set(contact.entity_id, "off")
    rssi = er.async_get(hass).async_get_or_create("sensor", "matter", "w-rssi", device_id=wifi.id, original_device_class="signal_strength")
    hass.states.async_set(rssi.entity_id, "-55", {"device_class": "signal_strength", "unit_of_measurement": "dBm"})
    _fake_matter(monkeypatch, {thread.id: _node([{"6": -64}]), wifi.id: _node(None)})

    def source_of(device):
        entries = er.async_entries_for_device(er.async_get(hass), device.id)
        return devices.signal_source(hass, device, entries, {"matter"}, smooth=False)

    signal, via, source = source_of(thread)
    assert signal == {"kind": "dbm", "value": -64} and source == "thread" and via is None
    # Matter über WLAN: keine Nachbartabelle, der Sensor des Geräts gilt wie bisher
    signal, _via, source = source_of(wifi)
    assert signal and signal["value"] == -55 and source == rssi.entity_id

    # Die Aufzeichnung schreibt den Thread-Wert (Quelle "thread"), der Verlauf beginnt
    monkeypatch.setattr(signal_history, "recorded", lambda _hass, _entity: True)
    hass.data[DATA_AVAILABILITY].evaluate()
    log: SignalLog = hass.data[DATA_SIGNAL]
    log.sample()
    assert log._open[thread.id][1] == [-64.0]
    result = await signal_history.async_signal_history(hass, log, thread, "24h", time.time() + 3600)
    assert result["source"] == "log" and result["kind"] == "dbm" and result["current"] == -64
