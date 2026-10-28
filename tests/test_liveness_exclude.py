"""Entitäten als "kein Lebenszeichen" markieren (2.165.0): der Fall aus dem Issue von liblit, ein Gerät mit einem echten Sensor und drei immer verfügbaren Template-Helfern."""

from __future__ import annotations

import time
from datetime import timedelta

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel.const import DATA_AVAILABILITY, DOMAIN
from custom_components.device_panel.devices import device_status, liveness_entities

from .test_outage import _device, _entity


@pytest.fixture
async def setup(hass: HomeAssistant):
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    hass.data[DATA_AVAILABILITY]._started = time.time() - 3600
    return hass.data[DATA_AVAILABILITY]


def _smarthub(hass: HomeAssistant):
    """Ein Gerät mit einem echten Sensor und drei Helfern der Plattform "template"."""
    device = _device(hass, "SmartHub")
    real = _entity(hass, device, "sensor", "usage", "42")
    helpers = []
    for n in range(3):
        entry = er.async_get(hass).async_get_or_create("sensor", "template", f"{device.id}-h{n}", device_id=device.id)
        hass.states.async_set(entry.entity_id, "1.0")
        helpers.append(entry.entity_id)
    return device, real, helpers


async def test_helpers_hide_the_outage_until_excluded(hass: HomeAssistant, setup, freezer) -> None:
    device, real, helpers = _smarthub(hass)
    entries = er.async_entries_for_device(er.async_get(hass), device.id)
    hass.states.async_set(real, "unavailable")
    freezer.tick(timedelta(minutes=5))
    now = dt_util.utcnow()
    # Ohne Markierung: drei Helfer leben, das Gerät gilt als online (das Verhalten bis 2.164.0)
    assert device_status(hass, entries, now, 120)[0] is True
    # Mit Markierung der Helfer zählt nur noch der echte Sensor: das Gerät ist ausgefallen
    online, since = device_status(hass, entries, now, 120, frozenset(helpers))
    assert online is False and since is not None
    # Der Sensor lebt wieder: online
    hass.states.async_set(real, "42")
    assert device_status(hass, entries, dt_util.utcnow(), 120, frozenset(helpers))[0] is True


async def test_exclusion_never_leaves_nothing(hass: HomeAssistant, setup) -> None:
    device, real, helpers = _smarthub(hass)
    entries = er.async_entries_for_device(er.async_get(hass), device.id)
    everything = frozenset([real, *helpers])
    # Alles markiert: die Markierung gilt nicht, statt "keine Daten"
    relevant, _ = liveness_entities(entries, everything)
    assert {e.entity_id for e in relevant} == everything
    # Nur der Sensor markiert: die Helfer zählen
    relevant, _ = liveness_entities(entries, frozenset([real]))
    assert {e.entity_id for e in relevant} == set(helpers)


async def test_websocket_and_persistence(hass: HomeAssistant, setup, hass_ws_client) -> None:
    device, real, helpers = _smarthub(hass)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_device_settings", "device_id": device.id, "liveness_exclude": helpers[:2] + [helpers[0]]})
    assert (await client.receive_json())["success"]
    await client.send_json({"id": 2, "type": f"{DOMAIN}/device", "device_id": device.id})
    detail = (await client.receive_json())["result"]
    by_id = {e["entity_id"]: e for e in detail["entities"]}
    assert by_id[helpers[0]]["liveness_off"] and by_id[helpers[1]]["liveness_off"] and not by_id[helpers[2]]["liveness_off"]
    assert by_id[real]["liveness"] and by_id[helpers[2]]["liveness"] and not by_id[helpers[0]]["liveness"]
    assert by_id[real]["platform"] == "test" and by_id[helpers[0]]["platform"] == "template"
    assert detail["liveness_ignored"] is False
    # In der Liste als eigene Einstellung des Geräts
    await client.send_json({"id": 3, "type": f"{DOMAIN}/list_devices"})
    row = next(d for d in (await client.receive_json())["result"]["devices"] if d["id"] == device.id)
    assert row["liveness_exclude_setting"] == sorted(helpers[:2])
    # Alle markiert: die Markierung gilt nicht, das Popup sagt es
    await client.send_json({"id": 4, "type": f"{DOMAIN}/set_device_settings", "device_id": device.id, "liveness_exclude": [real, *helpers]})
    assert (await client.receive_json())["success"]
    await client.send_json({"id": 5, "type": f"{DOMAIN}/device", "device_id": device.id})
    assert (await client.receive_json())["result"]["liveness_ignored"] is True
    # Zurück auf automatisch
    await client.send_json({"id": 6, "type": f"{DOMAIN}/set_device_settings", "device_id": device.id, "liveness_exclude": []})
    assert (await client.receive_json())["success"]
    await client.send_json({"id": 7, "type": f"{DOMAIN}/list_devices"})
    row = next(d for d in (await client.receive_json())["result"]["devices"] if d["id"] == device.id)
    assert row["liveness_exclude_setting"] is None


async def test_backup_roundtrip(hass: HomeAssistant, setup) -> None:
    """Die Wahl gehört zur Sicherung: sichern, zurücksetzen, wiederherstellen; ungültige Werte werden übersprungen."""
    from custom_components.device_panel import backup
    from custom_components.device_panel.const import DATA_DEVICE_SETTINGS
    from custom_components.device_panel.devices import async_set_device_settings

    device, real, helpers = _smarthub(hass)
    await async_set_device_settings(hass, device.id, liveness_exclude=helpers[:2], offline="nostatus")
    file = await backup.async_export(hass, ["devices"])
    assert file["sections"]["devices"]["settings"][device.id] == {"offline": "nostatus", "liveness_exclude": sorted(helpers[:2])}
    await async_set_device_settings(hass, device.id, liveness_exclude=[], offline=None)
    assert not hass.data[DATA_DEVICE_SETTINGS]["liveness_exclude"]
    # Vorschau schreibt nichts, dann wiederherstellen
    preview = await backup.async_import(hass, file, ["devices"], dry_run=True)
    assert preview["sections"]["devices"]["changed"] == 2
    assert not hass.data[DATA_DEVICE_SETTINGS]["liveness_exclude"]
    await backup.async_import(hass, file, ["devices"], dry_run=False)
    assert hass.data[DATA_DEVICE_SETTINGS]["liveness_exclude"] == {device.id: sorted(helpers[:2])}
    # Ungültig (kein Text, leer): übersprungen, der gespeicherte Wert bleibt
    bad = {**file, "sections": {"devices": {**file["sections"]["devices"], "settings": {device.id: {"liveness_exclude": [1, 2]}}}}}
    rep = await backup.async_import(hass, bad, ["devices"], dry_run=False)
    assert any(s["what"] == "liveness_exclude" and s["reason"] == "invalid" for s in rep["sections"]["devices"]["skipped"])
    assert hass.data[DATA_DEVICE_SETTINGS]["liveness_exclude"] == {device.id: sorted(helpers[:2])}
    # Rückgängig mit "replace": was die Sicherung nicht kennt, fällt weg
    empty = {**file, "sections": {"devices": {**file["sections"]["devices"], "settings": {}}}}
    await backup.async_import(hass, empty, ["devices"], dry_run=False, replace=True)
    assert not hass.data[DATA_DEVICE_SETTINGS]["liveness_exclude"]
