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
    assert signal == {"kind": "dbm", "value": -64} and source == "thread" and via == "Router …?"  # Nachbar ohne Adresse: Name unbekannt
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


# --- Rolle, Elternteil und Nachbarn (2.230.0) -----------------------------------------------------------------------------------------

EXT_ROUTER = 0x00124B0001A1B2C3  # ein Router, den Home Assistant als Matter-Gerät kennt
EXT_BORDER = 0x00124B0002D4E5F6  # ein Border Router der Integration "Thread"
EXT_UNKNOWN = 0x00124B0003FFA1B2  # niemand kennt ihn
ROLE = devices.THREAD_ROLE
EXT = devices.THREAD_EXT


def _thread_node(role: int | None, table: Any, ext: int | None = None, bridge: bool = False, available: bool = True) -> SimpleNamespace:
    attrs: dict[str, Any] = {}
    if role is not None:
        attrs[ROLE] = role
    if table is not None:
        attrs[devices.THREAD_NEIGHBORS] = table
    if ext is not None:
        attrs[EXT] = ext
    return SimpleNamespace(node_data=SimpleNamespace(attributes=attrs), available=available, is_bridge_device=bridge)


def _neighbor(ext: int, avg: int, lqi: int = 3, child: bool = False, idle: bool = False, full: bool = True) -> dict[str, Any]:
    return {"0": ext, "1": 12, "5": lqi, "6": avg, "7": avg, "10": idle, "11": full, "13": child}


async def _thread_devices(hass: HomeAssistant, monkeypatch, nodes: dict[str, Any]) -> dict[str, dr.DeviceEntry]:
    """Je Gerät (Schlüssel) ein Matter-Gerät in Home Assistant; nodes: Schlüssel -> Knoten (die Matter-Bibliothek ist im Test nicht geladen)."""
    hass.config.components.add("matter")
    entry = MockConfigEntry(domain="matter")
    entry.add_to_hass(hass)
    reg = dr.async_get(hass)
    made = {key: reg.async_get_or_create(config_entry_id=entry.entry_id, identifiers={("matter", key)}, name=f"Gerät {key}") for key in nodes}
    _fake_matter(monkeypatch, {made[key].id: node for key, node in nodes.items()})
    # Keine Border Router aus Zeroconf im Test: der Zwischenspeicher ist gefüllt, die Aktualisierung gesperrt
    hass.data[devices.DATA_THREAD_NAMES] = {"routers": {EXT_BORDER: "Google Nest Hub"}, "at": time.monotonic(), "refreshing": True}
    return made


async def test_end_device_knows_its_parent_by_name(hass: HomeAssistant, monkeypatch) -> None:
    made = await _thread_devices(
        hass,
        monkeypatch,
        {
            "kontakt": _thread_node(2, [_neighbor(EXT_ROUTER, -64, 3)]),
            "steckdose": _thread_node(5, [], ext=EXT_ROUTER),  # meldet seine Adresse: so bekommt der Router seinen Namen
        },
    )
    info = devices.thread_info(hass, made["kontakt"])
    assert info and info["role"] == "sleepy" and info["mode"] == "parent" and info["bridge"] is False
    row = info["rows"][0]
    assert row["name"] == "Gerät steckdose" and row["known"] and row["kind"] == "router" and row["rssi"] == -64 and row["lqi"] == 3 and row["used"]
    assert devices.thread_parent(hass, made["kontakt"]) == (f"{EXT_ROUTER:016x}", "Gerät steckdose")
    # Der Router ist ein Gerät in Home Assistant: seine Kennung für den Link im Popup; ein Border Router hat keine
    assert row["device_id"] == made["steckdose"].id and devices.thread_parent_id(hass, made["kontakt"]) == made["steckdose"].id
    assert devices._thread_role_of(hass, made["kontakt"], {"matter"}) == "sleepy"


async def test_border_router_and_unknown_router_names(hass: HomeAssistant, monkeypatch) -> None:
    made = await _thread_devices(
        hass,
        monkeypatch,
        {"a": _thread_node(3, [_neighbor(EXT_BORDER, -58)]), "b": _thread_node(3, [_neighbor(EXT_UNKNOWN, -83, 1)])},
    )
    assert devices.thread_info(hass, made["a"])["rows"][0]["name"] == "Google Nest Hub"
    assert devices.thread_info(hass, made["a"])["rows"][0]["device_id"] is None and devices.thread_parent_id(hass, made["a"]) is None
    unknown = devices.thread_info(hass, made["b"])["rows"][0]
    # Ohne Namen: das Ende der Adresse, in einer Schreibweise, die in jeder Sprache stimmt
    assert unknown["name"] == "Router …A1B2" and unknown["known"] is False


async def test_router_lists_neighbours_children_marked_and_strongest_counts(hass: HomeAssistant, monkeypatch) -> None:
    table = [
        _neighbor(EXT_UNKNOWN, -83, 1),
        _neighbor(0x1111, -64, 3, child=True, idle=False, full=False),  # angehängtes Gerät, schläft
        _neighbor(0x2222, -71, 2, child=True, idle=True, full=False),  # angehängtes Gerät, lauscht
        _neighbor(EXT_BORDER, -58, 3),
    ]
    made = await _thread_devices(hass, monkeypatch, {"router": _thread_node(5, table), "leader": _thread_node(6, [])})
    info = devices.thread_info(hass, made["router"])
    assert info["mode"] == "neighbors" and info["role"] == "router"
    assert [r["rssi"] for r in info["rows"]] == [-58, -64, -71, -83]  # der stärkste zuerst
    assert [r["kind"] for r in info["rows"]] == ["router", "sleepy", "end", "router"]
    assert [r["child"] for r in info["rows"]] == [False, True, True, False]
    assert [r["used"] for r in info["rows"]] == [True, False, False, False]
    # Ein Router hat kein "Verbunden über": nichts wird als Weg aufgezeichnet
    assert devices.thread_parent(hass, made["router"]) is None
    assert devices._thread_role_of(hass, made["leader"], {"matter"}) == "leader"
    assert devices.thread_listeners(hass, made["router"])[0]["name"] == "Google Nest Hub"


async def test_bridge_unknown_role_and_not_thread(hass: HomeAssistant, monkeypatch) -> None:
    made = await _thread_devices(
        hass,
        monkeypatch,
        {
            "bridge": _thread_node(5, [], bridge=True),
            "wifi": _thread_node(None, None),
            "off": _thread_node(3, [_neighbor(EXT_ROUTER, -60)], available=False),
        },
    )
    assert devices._thread_role_of(hass, made["bridge"], {"matter"}) == "bridge"
    # Matter über WLAN: weder Rolle noch Tabelle
    assert devices.thread_info(hass, made["wifi"]) is None and devices._thread_role_of(hass, made["wifi"], {"matter"}) is None
    # Nicht erreichbar: die Rolle bleibt, die Tabelle ist veraltet und bleibt leer
    off = devices.thread_info(hass, made["off"])
    assert off["role"] == "end" and off["rows"] == [] and devices.thread_parent(hass, made["off"]) is None
    assert devices._thread_role_of(hass, made["wifi"], {"zha"}) is None


async def test_via_is_the_parent_and_changes_are_recorded(hass: HomeAssistant, monkeypatch) -> None:
    await _setup(hass)
    made = await _thread_devices(
        hass,
        monkeypatch,
        {"kontakt": _thread_node(2, [_neighbor(EXT_ROUTER, -64)]), "steckdose": _thread_node(5, [], ext=EXT_ROUTER)},
    )
    kontakt = made["kontakt"]
    contact = er.async_get(hass).async_get_or_create("binary_sensor", "matter", "k-c", device_id=kontakt.id)
    hass.states.async_set(contact.entity_id, "off")
    entries = er.async_entries_for_device(er.async_get(hass), kontakt.id)
    signal, via, source = devices.signal_source(hass, kontakt, entries, {"matter"}, smooth=False)
    assert signal == {"kind": "dbm", "value": -64} and via == "Gerät steckdose" and source == "thread"

    monkeypatch.setattr(signal_history, "recorded", lambda _hass, _entity: True)
    hass.data[DATA_AVAILABILITY].evaluate()
    log: SignalLog = hass.data[DATA_SIGNAL]
    log.sample()
    assert [e[1] for e in log._via[kontakt.id]] == [f"{EXT_ROUTER:016x}"]
    # Der Elternteil wechselt (anderer Router): ein Wechsel im Weg
    kontakt_node = _thread_node(2, [_neighbor(EXT_BORDER, -70)])
    _fake_matter(monkeypatch, {kontakt.id: kontakt_node, made["steckdose"].id: _thread_node(5, [], ext=EXT_ROUTER)})
    log.sample(time.time() + 120)
    assert [e[1] for e in log._via[kontakt.id]] == [f"{EXT_ROUTER:016x}", f"{EXT_BORDER:016x}"]
    result = await signal_history.async_signal_history(hass, log, kontakt, "24h", time.time() + 3600)
    assert result["thread_mode"] == "parent" and result["listeners"][0]["name"] == "Google Nest Hub"
    assert [r["name"] for r in result["via"]["receivers"]] == ["Gerät steckdose", "Google Nest Hub"]


async def test_router_name_from_the_hardware_address_of_its_thread_interface(hass: HomeAssistant, monkeypatch) -> None:
    """2.230.1: Geräte ohne eigenes Attribut 0/53/63 (ältere Firmware) melden ihre Thread-Adresse in der allgemeinen Diagnose 0/51/0 (Base64)."""
    import base64

    iface = [
        {"4": base64.b64encode(bytes.fromhex("AABBCCDDEEFF")).decode(), "7": 1, "1": True},  # WLAN (6 Bytes): zählt nicht
        {"4": base64.b64encode(EXT_ROUTER.to_bytes(8, "big")).decode(), "7": 4, "1": True},  # Thread
    ]
    steckdose = _thread_node(5, [])
    steckdose.node_data.attributes[devices.NETWORK_INTERFACES] = iface
    made = await _thread_devices(hass, monkeypatch, {"kontakt": _thread_node(3, [_neighbor(EXT_ROUTER, -19)]), "steckdose": steckdose})
    row = devices.thread_info(hass, made["kontakt"])["rows"][0]
    assert row["name"] == "Gerät steckdose" and row["known"]
    # Kaputte Werte bringen nichts durcheinander
    broken = _thread_node(5, [])
    broken.node_data.attributes[devices.NETWORK_INTERFACES] = [{"4": "###", "7": 4}, "kein Wörterbuch", {"4": b"\x01", "7": 4}]
    assert devices._thread_addresses(broken) == set()
