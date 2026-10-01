"""Einrichtung, Panel und WebSocket-Befehl mit echtem Home Assistant."""

from __future__ import annotations

from homeassistant.const import STATE_UNAVAILABLE
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel.const import DOMAIN


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_list_devices_status_and_software(hass: HomeAssistant, hass_ws_client) -> None:
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

    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/list_devices"})
    result = (await client.receive_json())["result"]["devices"]
    by_name = {d["name"]: d for d in result}
    assert by_name["Licht Küche"]["online"] is True
    assert by_name["Licht Küche"]["sw_version"] == "1.4.2"
    assert by_name["Licht Küche"]["integrations"] == ["test"]
    assert by_name["Sensor Garten"]["online"] is False


async def test_single_instance(hass: HomeAssistant) -> None:
    await _setup(hass)
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    assert result["type"] == "abort"
    assert result["reason"] == "single_instance_allowed"
