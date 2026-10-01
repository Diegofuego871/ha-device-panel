"""Verfügbarkeitsprotokoll, Gerätetyp, Integrationseintrag und Popup-Befehle mit echtem Home Assistant."""

from __future__ import annotations

import time
from datetime import timedelta
from typing import Any

import pytest
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel.availability import (
    STORAGE_KEY,
    AvailabilityLog,
    segments,
    strip,
    summarize,
)
from custom_components.device_panel.const import DATA_AVAILABILITY, DOMAIN
from custom_components.device_panel.devices import async_list_devices


# --- reine Rechnung ----------------------------------------------------------

def test_segments_and_summary() -> None:
    events = [[0, 1], [100, 0], [160, 1], [500, None], [600, 1]]
    segs = segments(events, 50, 700)
    assert segs == [[50, 100, 1], [100, 160, 0], [160, 500, 1], [500, 600, None], [600, 700, 1]]
    s = summarize(segs)
    # 490 s online, 60 s offline; die 100 s ohne Daten zählen nicht mit.
    assert s == {"pct": 89.1, "outages": 1, "longest": 60, "offline": 60, "covered": 550}


def test_summary_never_100_with_outage_and_none_without_data() -> None:
    assert summarize([[0, 100000, 1], [100000, 100001, 0]])["pct"] == 99.9
    assert summarize([[0, 10, None]]) is None
    assert summarize(segments([], 0, 10)) is None


def test_strip_marks_outages_and_gaps() -> None:
    segs = [[0, 10, 1], [10, 12, 0], [12, 20, 1], [20, 40, None]]
    assert strip(segs, 0, 40, 4) == [0, 1, 2, 2]


# --- Protokoll mit HA -----------------------------------------------------------

@pytest.fixture
async def setup(hass: HomeAssistant) -> AvailabilityLog:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    log: AvailabilityLog = hass.data[DATA_AVAILABILITY]
    # Anlaufphase in den Tests überspringen (eigener Test unten).
    log._started = time.time() - 3600
    return log


def _device(hass: HomeAssistant, name: str, domain: str = "test", **kwargs: Any) -> dr.DeviceEntry:
    source = MockConfigEntry(domain=domain, title=f"{name} Eintrag")
    source.add_to_hass(hass)
    return dr.async_get(hass).async_get_or_create(
        config_entry_id=source.entry_id, identifiers={(domain, name)}, name=name, **kwargs
    )


def _entity(hass: HomeAssistant, device: dr.DeviceEntry, domain: str, key: str, state: str, attrs: dict | None = None, **kwargs: Any) -> str:
    entry = er.async_get(hass).async_get_or_create(domain, "test", f"{device.id}-{key}", device_id=device.id, **kwargs)
    hass.states.async_set(entry.entity_id, state, attrs or {})
    return entry.entity_id


async def test_outage_is_recorded_with_real_start(hass: HomeAssistant, setup: AvailabilityLog, freezer) -> None:
    lamp = _device(hass, "Lampe")
    light = _entity(hass, lamp, "light", "l", "on")
    setup.evaluate()
    start = time.time()
    hass.states.async_set(light, "unavailable")
    freezer.tick(timedelta(minutes=5))
    setup.evaluate()
    events = setup.events(lamp.id)
    assert events[-1][1] == 0
    assert abs(events[-1][0] - start) < 2  # Beginn = echter Wechsel, nicht die Erkennung
    freezer.tick(timedelta(minutes=5))
    hass.states.async_set(light, "on")
    setup.evaluate()
    assert setup.events(lamp.id)[-1][1] == 1
    summary = setup.device_summary(lamp.id, 86400)
    assert summary["outages"] == 1
    assert 590 <= summary["longest"] <= 610  # 5 + 5 Min. bis zur Rückkehr


async def test_short_outage_is_not_recorded(hass: HomeAssistant, setup: AvailabilityLog, freezer) -> None:
    lamp = _device(hass, "Lampe")
    light = _entity(hass, lamp, "light", "l", "on")
    setup.evaluate()
    hass.states.async_set(light, "unavailable")
    freezer.tick(timedelta(seconds=60))
    setup.evaluate()
    hass.states.async_set(light, "on")
    setup.evaluate()
    assert [e[1] for e in setup.events(lamp.id)] == [1]


async def test_startup_grace(hass: HomeAssistant, setup: AvailabilityLog, freezer) -> None:
    setup._started = time.time()
    lamp = _device(hass, "Lampe")
    light = _entity(hass, lamp, "light", "l", "unavailable")
    freezer.tick(timedelta(minutes=3))
    setup.evaluate()
    assert setup.events(lamp.id) == []  # Anlaufphase: noch kein Ausfall
    hass.states.async_set(light, "on")
    setup.evaluate()
    assert [e[1] for e in setup.events(lamp.id)] == [1]


async def test_restart_gap_is_no_data(hass: HomeAssistant, hass_storage: dict[str, Any]) -> None:
    # Nur Geräte, die es noch gibt, bleiben im Protokoll.
    dev = _device(hass, "Lampe")
    now = time.time()
    hass_storage[STORAGE_KEY] = {
        "version": 1, "minor_version": 1, "key": STORAGE_KEY,
        "data": {"heartbeat": now - 600, "devices": {dev.id: [[now - 7200, 1]], "weg": [[now - 7200, 1]]}},
    }
    log = AvailabilityLog(hass)
    await log.async_start()
    assert log.events(dev.id)[:2] == [[now - 7200, 1], [now - 600, None]]
    assert log.events("weg") == []
    await log.async_stop()


async def test_stop_writes_gap(hass: HomeAssistant, hass_storage: dict[str, Any]) -> None:
    log = AvailabilityLog(hass)
    await log.async_start()
    log._events["dev1"] = [[time.time() - 100, 1]]
    await log.async_stop()
    stored = hass_storage[STORAGE_KEY]["data"]
    assert stored["devices"]["dev1"][-1][1] is None
    assert stored["heartbeat"] > 0


async def test_incident_and_pulse(hass: HomeAssistant, setup: AvailabilityLog, freezer) -> None:
    lights = []
    for i in range(3):
        dev = _device(hass, f"Zigbee {i}", domain="zha")
        lights.append(_entity(hass, dev, "light", "l", "on"))
    setup.evaluate()
    for light in lights:
        hass.states.async_set(light, "unavailable")
    freezer.tick(timedelta(minutes=4))
    setup.evaluate()
    result = await async_list_devices(hass, setup)
    assert result["incidents"][0]["count"] == 3
    assert result["incidents"][0]["integration"] == "zha"
    assert max(result["pulse"]) == 3


async def test_list_has_avail_flaky_type_integration(hass: HomeAssistant, setup: AvailabilityLog, freezer) -> None:
    plug = _device(hass, "Steckdose")
    switch = _entity(hass, plug, "switch", "s", "on", original_device_class="outlet")
    setup.evaluate()
    for _ in range(3):
        hass.states.async_set(switch, "unavailable")
        freezer.tick(timedelta(minutes=3))
        setup.evaluate()
        hass.states.async_set(switch, "on")
        freezer.tick(timedelta(minutes=1))
        setup.evaluate()
    data = {d["name"]: d for d in (await async_list_devices(hass, setup))["devices"]}["Steckdose"]
    assert data["avail24"]["outages"] == 3
    assert len(data["avail24"]["strip"]) == 48
    assert data["flaky"] is True
    assert data["type"] == "outlet"
    assert data["integration"] == {"domain": "test", "title": "Steckdose Eintrag"}


@pytest.mark.parametrize(
    ("entities", "expected"),
    [
        ([("climate", "c", "heat", None), ("sensor", "t", "21", None)], "climate"),
        ([("binary_sensor", "m", "off", "motion"), ("sensor", "lux", "10", None)], "motion"),
        ([("binary_sensor", "w", "off", "window")], "contact"),
        ([("binary_sensor", "s", "off", "smoke")], "safety"),
        ([("switch", "s", "on", None)], "switch"),
        ([("light", "l", "on", None), ("sensor", "p", "5", None)], "light"),
        ([("sensor", "t", "21", None)], "sensor"),
        ([("button", "b", "unknown", None)], "button"),
    ],
)
async def test_device_type(hass: HomeAssistant, setup: AvailabilityLog, entities: list, expected: str) -> None:
    dev = _device(hass, "Gerät")
    for domain, key, state, dclass in entities:
        _entity(hass, dev, domain, key, state, original_device_class=dclass)
    data = {d["name"]: d for d in (await async_list_devices(hass, setup))["devices"]}
    assert data["Gerät"]["type"] == expected


async def test_hub_type(hass: HomeAssistant, setup: AvailabilityLog) -> None:
    hub = _device(hass, "Koordinator", domain="zha")
    _entity(hass, hub, "sensor", "x", "1", entity_category=EntityCategory.DIAGNOSTIC)
    source = MockConfigEntry(domain="zha")
    source.add_to_hass(hass)
    child = dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={("zha", "kind")}, name="Kind", via_device=("zha", "Koordinator"))
    _entity(hass, child, "light", "l", "on")
    data = {d["name"]: d for d in (await async_list_devices(hass, setup))["devices"]}
    assert data["Koordinator"]["type"] == "hub"
    assert data["Kind"]["via"] == "Koordinator"


async def test_ws_device_and_availability(hass: HomeAssistant, setup: AvailabilityLog, hass_ws_client) -> None:
    dev = _device(hass, "Melder")
    _entity(hass, dev, "binary_sensor", "m", "off", original_device_class="motion", has_entity_name=True)
    _entity(hass, dev, "sensor", "bat", "80", {"unit_of_measurement": "%"}, original_device_class="battery", entity_category=EntityCategory.DIAGNOSTIC)
    setup.evaluate()
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/device", "device_id": dev.id})
    detail = (await client.receive_json())["result"]
    by_id = {e["entity_id"]: e for e in detail["entities"]}
    assert len(by_id) == 2
    assert [e["liveness"] for e in detail["entities"]] == [True, False]  # Diagnose zählt nicht
    assert detail["config_entries"][0]["title"] == "Melder Eintrag"
    assert detail["entities"][0]["name"] == "Melder"  # Hauptentität ohne eigenen Namen
    assert detail["stats"]["24h"]["outages"] == 0

    await client.send_json({"id": 2, "type": f"{DOMAIN}/availability", "device_id": dev.id, "range": "7d"})
    hist = (await client.receive_json())["result"]
    assert len(hist["days"]) == 7
    assert hist["summary"]["pct"] == 100.0
    assert hist["end"] - hist["start"] == pytest.approx(7 * 86400)

    await client.send_json({"id": 3, "type": f"{DOMAIN}/device", "device_id": "gibt-es-nicht"})
    assert (await client.receive_json())["error"]["code"] == "not_found"
    await client.send_json({"id": 4, "type": f"{DOMAIN}/availability", "device_id": dev.id, "range": "1y"})
    assert (await client.receive_json())["success"] is False


# --- neue Typen, Typ von Hand, Ausschlüsse -------------------------------------

@pytest.mark.parametrize(
    ("domain", "entities", "expected"),
    [
        ("mobile_app", [("sensor", "bat", "80", "battery"), ("device_tracker", "t", "home", None)], "phone"),
        ("synology_dsm", [("sensor", "cpu", "5", None), ("binary_sensor", "heat", "off", "heat")], "network"),
        ("test", [("valve", "v", "open", None)], "valve"),
        ("test", [("sensor", "p", "120", "power"), ("sensor", "e", "5", "energy"), ("sensor", "t", "20", "temperature")], "energy"),
        ("test", [("sensor", "t", "20", "temperature"), ("sensor", "h", "50", "humidity"), ("sensor", "p", "1", "power")], "sensor"),
    ],
)
async def test_new_device_types(hass: HomeAssistant, setup: AvailabilityLog, domain: str, entities: list, expected: str) -> None:
    dev = _device(hass, "Gerät", domain=domain)
    for edomain, key, state, dclass in entities:
        _entity(hass, dev, edomain, key, state, original_device_class=dclass)
    data = {d["name"]: d for d in (await async_list_devices(hass, setup))["devices"]}
    assert data["Gerät"]["type"] == expected
    assert data["Gerät"]["type_manual"] is False


async def test_type_override(hass: HomeAssistant, setup: AvailabilityLog, hass_ws_client, hass_storage: dict[str, Any]) -> None:
    dev = _device(hass, "Zwischenstecker")
    _entity(hass, dev, "switch", "s", "on")
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_device_type", "device_id": dev.id, "device_type": "outlet"})
    assert (await client.receive_json())["success"]
    data = {d["name"]: d for d in (await async_list_devices(hass, setup))["devices"]}["Zwischenstecker"]
    assert (data["type"], data["type_auto"], data["type_manual"]) == ("outlet", "switch", True)
    assert hass_storage[f"{DOMAIN}.devices"]["data"] == {"types": {dev.id: "outlet"}}
    # Zurück auf die Erkennung
    await client.send_json({"id": 2, "type": f"{DOMAIN}/set_device_type", "device_id": dev.id, "device_type": None})
    assert (await client.receive_json())["success"]
    data = {d["name"]: d for d in (await async_list_devices(hass, setup))["devices"]}["Zwischenstecker"]
    assert (data["type"], data["type_manual"]) == ("switch", False)
    # Ungültiger Typ und unbekanntes Gerät
    await client.send_json({"id": 3, "type": f"{DOMAIN}/set_device_type", "device_id": dev.id, "device_type": "toaster"})
    assert (await client.receive_json())["success"] is False
    await client.send_json({"id": 4, "type": f"{DOMAIN}/set_device_type", "device_id": "gibt-es-nicht", "device_type": "light"})
    assert (await client.receive_json())["error"]["code"] == "not_found"


async def test_exclusions(hass: HomeAssistant, setup: AvailabilityLog, hass_ws_client, freezer) -> None:
    lamp = _device(hass, "Lampe", domain="hue")
    _entity(hass, lamp, "light", "l", "on")
    phone = _device(hass, "Handy", domain="mobile_app")
    _entity(hass, phone, "sensor", "bat", "50", original_device_class="battery")
    plug = _device(hass, "Steckdose")
    _entity(hass, plug, "switch", "s", "on")
    setup.evaluate()
    client = await hass_ws_client(hass)

    # Katalog für die Einstellungen: alle Kandidaten mit Zahl der Geräte
    await client.send_json({"id": 1, "type": f"{DOMAIN}/get_options"})
    result = (await client.receive_json())["result"]
    domains = {i["domain"]: i["devices"] for i in result["catalog"]["integrations"]}
    types = {t["type"]: t["devices"] for t in result["catalog"]["types"]}
    assert domains["hue"] == 1 and domains["mobile_app"] == 1
    assert types["phone"] == 1 and types["light"] == 1 and types["valve"] == 0
    assert result["values"]["exclude_integrations"] == [] and result["values"]["exclude_types"] == []

    await client.send_json({"id": 2, "type": f"{DOMAIN}/set_options", "values": {"exclude_integrations": ["hue"], "exclude_types": ["phone"]}})
    assert (await client.receive_json())["result"] == {"changed": True}
    names = {d["name"] for d in (await async_list_devices(hass, setup))["devices"]}
    assert "Lampe" not in names and "Handy" not in names and "Steckdose" in names

    # Ausgeschlossene werden nicht mehr überwacht: ab jetzt "keine Daten".
    freezer.tick(timedelta(minutes=1))
    setup.evaluate()
    assert setup.events(lamp.id)[-1][1] is None
    assert setup.events(plug.id)[-1][1] == 1
    # Katalog zählt weiterhin alle (sonst liesse sich nichts zurückholen)
    await client.send_json({"id": 3, "type": f"{DOMAIN}/get_options"})
    result = (await client.receive_json())["result"]
    assert {i["domain"] for i in result["catalog"]["integrations"]} >= {"hue", "mobile_app"}
    assert result["values"]["exclude_types"] == ["phone"]

    # Ungültige Werte
    await client.send_json({"id": 4, "type": f"{DOMAIN}/set_options", "values": {"exclude_types": ["toaster"]}})
    assert (await client.receive_json())["error"]["code"] == "invalid_format"
    await client.send_json({"id": 5, "type": f"{DOMAIN}/set_options", "values": {"exclude_integrations": ["Böse Domain"]}})
    assert (await client.receive_json())["error"]["code"] == "invalid_format"


async def test_pulse_and_incidents_only_shown(hass: HomeAssistant, setup: AvailabilityLog, hass_ws_client, freezer) -> None:
    lights = []
    for i in range(3):
        dev = _device(hass, f"Zigbee {i}", domain="zha")
        lights.append(_entity(hass, dev, "light", "l", "on"))
    setup.evaluate()
    for light in lights:
        hass.states.async_set(light, "unavailable")
    freezer.tick(timedelta(minutes=4))
    setup.evaluate()
    assert max((await async_list_devices(hass, setup))["pulse"]) == 3
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_options", "values": {"exclude_integrations": ["zha"]}})
    await client.receive_json()
    result = await async_list_devices(hass, setup)
    assert max(result["pulse"]) == 0
    assert result["incidents"] == []
