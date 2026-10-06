"""Gerät im Popup umbenennen (1.21.0): name_by_user im Geräte-Register."""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel.const import DOMAIN


@pytest.fixture
async def setup(hass: HomeAssistant) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()


async def _ws(client, msg_id: int, **msg: Any) -> dict[str, Any]:
    await client.send_json({"id": msg_id, **msg})
    return await client.receive_json()


async def test_rename_and_reset(hass: HomeAssistant, setup, hass_ws_client) -> None:
    source = MockConfigEntry(domain="test")
    source.add_to_hass(hass)
    reg = dr.async_get(hass)
    lamp = reg.async_get_or_create(config_entry_id=source.entry_id, identifiers={("test", "a")}, name="Lampe")
    # Ohne Entität listet das Panel das Gerät nicht
    light = er.async_get(hass).async_get_or_create("light", "test", "a1", device_id=lamp.id)
    hass.states.async_set(light.entity_id, "on")
    client = await hass_ws_client(hass)
    ids = iter(range(1, 20))

    res = await _ws(client, next(ids), type=f"{DOMAIN}/rename_device", device_id=lamp.id, name="  Stehlampe Wohnzimmer ")
    assert res["success"] and res["result"] == {"name": "Stehlampe Wohnzimmer", "name_custom": "Stehlampe Wohnzimmer"}
    # In HA umbenannt, der Name der Integration bleibt erhalten
    assert reg.async_get(lamp.id).name_by_user == "Stehlampe Wohnzimmer"
    assert reg.async_get(lamp.id).name == "Lampe"
    listed = (await _ws(client, next(ids), type=f"{DOMAIN}/list_devices"))["result"]["devices"]
    mine = next(d for d in listed if d["id"] == lamp.id)
    assert (mine["name"], mine["name_original"], mine["name_custom"]) == ("Stehlampe Wohnzimmer", "Lampe", "Stehlampe Wohnzimmer")

    # Leer: zurück auf den Namen der Integration
    res = await _ws(client, next(ids), type=f"{DOMAIN}/rename_device", device_id=lamp.id, name="   ")
    assert res["result"] == {"name": "Lampe", "name_custom": None}
    assert reg.async_get(lamp.id).name_by_user is None
    mine = next(d for d in (await _ws(client, next(ids), type=f"{DOMAIN}/list_devices"))["result"]["devices"] if d["id"] == lamp.id)
    assert (mine["name"], mine["name_custom"]) == ("Lampe", None)


async def test_rename_errors_and_admin(hass: HomeAssistant, setup, hass_ws_client, hass_admin_user) -> None:
    client = await hass_ws_client(hass)
    res = await _ws(client, 1, type=f"{DOMAIN}/rename_device", device_id="gibt-es-nicht", name="X")
    assert not res["success"] and res["error"]["code"] == "not_found"
    res = await _ws(client, 2, type=f"{DOMAIN}/rename_device", device_id="x", name="a" * 256)
    assert not res["success"] and res["error"]["code"] == "invalid_format"
    # Nur Administratoren
    hass_admin_user.groups = []
    client = await hass_ws_client(hass)
    res = await _ws(client, 3, type=f"{DOMAIN}/rename_device", device_id="x", name="X")
    assert not res["success"] and res["error"]["code"] == "unauthorized"
