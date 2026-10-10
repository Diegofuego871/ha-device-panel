"""Einzelne Geräte ausblenden (0.23.0) und Bereiche für den Filter."""

from __future__ import annotations

import time
from datetime import timedelta
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import floor_registry as fr
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed, async_mock_service

from custom_components.device_panel.const import DATA_AVAILABILITY, DATA_OUTAGE, DOMAIN


@pytest.fixture
async def setup(hass: HomeAssistant):
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    log = hass.data[DATA_AVAILABILITY]
    log._started = time.time() - 3600
    return log


def _device(hass: HomeAssistant, name: str, domain: str = "test", **kwargs: Any) -> dr.DeviceEntry:
    source = MockConfigEntry(domain=domain, title=f"{name} Eintrag")
    source.add_to_hass(hass)
    return dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={(domain, name)}, name=name, **kwargs)


def _entity(hass: HomeAssistant, device: dr.DeviceEntry, domain: str, key: str, state: str) -> str:
    entry = er.async_get(hass).async_get_or_create(domain, "test", f"{device.id}-{key}", device_id=device.id)
    hass.states.async_set(entry.entity_id, state)
    return entry.entity_id


async def _ws(client, msg_id: int, **msg: Any) -> dict[str, Any]:
    await client.send_json({"id": msg_id, **msg})
    return await client.receive_json()


async def test_hide_and_show_device(hass: HomeAssistant, setup, hass_ws_client, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    ar.async_get(hass).async_create("Küche")
    lamp = _device(hass, "Lampe", suggested_area="Küche")
    light = _entity(hass, lamp, "light", "l", "on")
    plug = _device(hass, "Steckdose")
    _entity(hass, plug, "switch", "s", "on")
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    hass.config_entries.async_update_entry(entry, options={**entry.options, "notify_service": "notify.handy", "notify_outage": True, "notify_online": True})
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)
    ids = iter(range(1, 100))

    async def names() -> list[str]:
        return sorted(d["name"] for d in (await _ws(client, next(ids), type=f"{DOMAIN}/list_devices"))["result"]["devices"])

    assert await names() == ["Lampe", "Steckdose"]
    # Ausgefallen und gemeldet …
    setup.evaluate()
    hass.states.async_set(light, "unavailable")
    freezer.tick(timedelta(minutes=3))
    setup.evaluate()
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert [c.data["title"] for c in calls] == ["🔴 Offline: Lampe"]
    # … dann ausgeblendet: nicht mehr in der Liste, nicht überwacht, vergessen
    res = await _ws(client, next(ids), type=f"{DOMAIN}/hide_device", device_id=lamp.id, hidden=True)
    assert res["result"] == {"hidden": True, "changed": True}
    assert entry.options["exclude_devices"] == [lamp.id]
    assert await names() == ["Steckdose"]
    freezer.tick(timedelta(seconds=30))
    setup.evaluate()
    await hass.async_block_till_done()
    assert lamp.id not in hass.data[DATA_OUTAGE].offline
    # Zurück online: keine Meldung (nicht überwacht)
    hass.states.async_set(light, "on")
    freezer.tick(timedelta(minutes=1))
    setup.evaluate()
    await hass.async_block_till_done()
    assert len(calls) == 1
    # In den Einstellungen aufgeführt, mit Bereich und Integration
    catalog = (await _ws(client, next(ids), type=f"{DOMAIN}/get_options"))["result"]["catalog"]
    assert catalog["hidden_devices"] == [{"id": lamp.id, "name": "Lampe", "type": "light", "area": "Küche", "integration": "test"}]
    # Nochmals: nichts geändert; Einblenden; Einblenden eines Unbekannten geht
    assert (await _ws(client, next(ids), type=f"{DOMAIN}/hide_device", device_id=lamp.id, hidden=True))["result"]["changed"] is False
    assert (await _ws(client, next(ids), type=f"{DOMAIN}/hide_device", device_id=lamp.id, hidden=False))["result"]["changed"] is True
    assert await names() == ["Lampe", "Steckdose"]
    assert (await _ws(client, next(ids), type=f"{DOMAIN}/hide_device", device_id="weg", hidden=False))["result"]["changed"] is False
    assert (await _ws(client, next(ids), type=f"{DOMAIN}/hide_device", device_id="weg", hidden=True))["error"]["code"] == "not_found"
    # Über die Einstellungen (Speichern) wie die übrigen Ausschlüsse
    assert (await _ws(client, next(ids), type=f"{DOMAIN}/set_options", values={"exclude_devices": [plug.id, plug.id]}))["success"]
    assert entry.options["exclude_devices"] == [plug.id] and await names() == ["Lampe"]
    for bad in ("x", [1], ["a b"]):
        assert (await _ws(client, next(ids), type=f"{DOMAIN}/set_options", values={"exclude_devices": bad}))["error"]["code"] == "invalid_format", bad


async def test_areas_and_floors_in_order(hass: HomeAssistant, setup, hass_ws_client) -> None:
    floors = fr.async_get(hass)
    eg = floors.async_create("Erdgeschoss", level=0)
    og = floors.async_create("Obergeschoss", level=1)
    areas = ar.async_get(hass)
    bad = areas.async_create("Bad", floor_id=og.floor_id)
    kueche = areas.async_create("Küche", floor_id=eg.floor_id)
    garten = areas.async_create("Garten")
    # Eigene Reihenfolge in HA (Einstellungen → Bereiche)
    areas.async_reorder([kueche.id, garten.id, bad.id])
    lamp = _device(hass, "Lampe")
    dr.async_get(hass).async_update_device(lamp.id, area_id=kueche.id)
    _entity(hass, lamp, "light", "l", "on")
    client = await hass_ws_client(hass)
    res = (await _ws(client, 1, type=f"{DOMAIN}/list_devices"))["result"]
    assert [a["name"] for a in res["areas"]] == ["Küche", "Garten", "Bad"]
    assert [a["floor_id"] for a in res["areas"]] == [eg.floor_id, None, og.floor_id]
    assert {f["name"] for f in res["floors"]} == {"Erdgeschoss", "Obergeschoss"}
    assert next(d for d in res["devices"] if d["name"] == "Lampe")["area_id"] == kueche.id
