"""Einrichtung, Panel und WebSocket-Befehl mit echtem Home Assistant."""

from __future__ import annotations

from datetime import timedelta

from homeassistant.const import STATE_UNAVAILABLE
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed

from custom_components.device_panel.const import DATA_AVAILABILITY, DOMAIN, NEW_INSTALL_OPTIONS
from custom_components.device_panel.options_api import values_from


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_list_devices_status_and_software(hass: HomeAssistant, hass_ws_client, freezer) -> None:
    await _setup(hass)
    source = MockConfigEntry(domain="test")
    source.add_to_hass(hass)
    dev_reg = dr.async_get(hass)
    ent_reg = er.async_get(hass)
    up = dev_reg.async_get_or_create(
        config_entry_id=source.entry_id, identifiers={("test", "a")}, name="Licht Küche",
        manufacturer="Beispiel AG", model="L1", sw_version="1.4.2",
    )
    down = dev_reg.async_get_or_create(
        config_entry_id=source.entry_id, identifiers={("test", "b")}, name="Sensor Garten",
    )
    e1 = ent_reg.async_get_or_create("light", "test", "a1", device_id=up.id)
    e2 = ent_reg.async_get_or_create("sensor", "test", "b1", device_id=down.id)
    hass.states.async_set(e1.entity_id, "on")
    hass.states.async_set(e2.entity_id, STATE_UNAVAILABLE)
    # Ausgefallen erst nach 2 Min. ohne Lebenszeichen (Standard der Überwachung).
    freezer.tick(timedelta(minutes=3))

    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/list_devices"})
    result = (await client.receive_json())["result"]["devices"]
    by_name = {d["name"]: d for d in result}
    assert by_name["Licht Küche"]["online"] is True
    assert by_name["Licht Küche"]["sw_version"] == "1.4.2"
    assert by_name["Licht Küche"]["integrations"] == ["test"]
    assert by_name["Sensor Garten"]["online"] is False
    assert by_name["Sensor Garten"]["offline_since"]


async def test_single_instance(hass: HomeAssistant) -> None:
    await _setup(hass)
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    assert result["type"] == "abort"
    assert result["reason"] == "single_instance_allowed"


async def test_new_install_starts_with_start_values(hass: HomeAssistant, hass_ws_client) -> None:
    """Eine neue Installation bekommt die Startwerte (1.18.0); sie gelten nur dort, nicht für bestehende."""
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    assert result["type"] == "form"
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] == "create_entry"
    entry = result["result"]
    await hass.async_block_till_done()
    assert entry.options == NEW_INSTALL_OPTIONS
    # Das Panel bekommt sie wie jede andere Option
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/get_options"})
    values = (await client.receive_json())["result"]["values"]
    assert values["notify_fields"] == ["area", "integration", "connection", "since", "battery"]
    assert values["battery_fields"] == ["battery", "area", "integration"]
    assert values["hide_chips"] == ["override"]
    assert values["hide_connections"] == []
    # Die Vorlage bleibt unverändert, auch wenn die Optionen geändert werden
    hass.config_entries.async_update_entry(entry, options={**entry.options, "hide_chips": []})
    assert NEW_INSTALL_OPTIONS["hide_chips"] == ["override"]
    # Eine bestehende Installation ohne gespeicherte Werte behält den bisherigen Standard
    other = MockConfigEntry(domain=DOMAIN, title="Device Panel 2")
    assert other.options == {}
    assert values_from(other.options)["notify_fields"] == ["area", "integration", "since"]
    assert values_from(other.options)["hide_chips"] == []


async def test_remove_deletes_own_files(hass: HomeAssistant, hass_ws_client, hass_storage, freezer) -> None:
    entry = await _setup(hass)
    source = MockConfigEntry(domain="test")
    source.add_to_hass(hass)
    dev = dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={("test", "a")}, name="Lampe")
    light = er.async_get(hass).async_get_or_create("light", "test", "a1", device_id=dev.id)
    hass.states.async_set(light.entity_id, "on")
    hass.data[DATA_AVAILABILITY]._started -= 3600  # Anlaufphase überspringen
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_device_settings", "device_id": dev.id, "notify": False})
    assert (await client.receive_json())["success"]
    await client.send_json({"id": 2, "type": f"{DOMAIN}/set_panel", "prerelease": True})
    assert (await client.receive_json())["success"]
    # Ausfall: Meldungen planen ein verzögertes Schreiben
    hass.data[DATA_AVAILABILITY].evaluate()
    hass.states.async_set(light.entity_id, STATE_UNAVAILABLE)
    freezer.tick(timedelta(minutes=3))
    hass.data[DATA_AVAILABILITY].evaluate()
    await hass.async_block_till_done()
    keys = [f"{DOMAIN}.{k}" for k in ("availability", "devices", "notify", "battery", "signal", "panel")]
    await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert all(k in hass_storage for k in keys), [k for k in keys if k not in hass_storage]
    assert await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert [k for k in keys if k in hass_storage] == []
    # Kein verspätetes Schreiben legt eine Datei neu an
    freezer.tick(timedelta(minutes=10))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert [k for k in keys if k in hass_storage] == []
    # Neu eingerichtet ohne Neustart: leer, nichts aus dem Speicher
    await _setup(hass)
    from custom_components.device_panel.devices import device_settings  # noqa: PLC0415

    assert device_settings(hass)["notify_off"] == set()
    assert hass.data[DATA_AVAILABILITY].events(dev.id) == []  # Protokoll beginnt neu (Anlaufphase)
