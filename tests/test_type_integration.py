"""Gerätetyp pro Integration (1.25.0): Gerät von Hand vor Integration vor Erkennung."""

from __future__ import annotations

from typing import Any

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel.const import DOMAIN
from custom_components.device_panel.options_api import type_map


async def _setup(hass: HomeAssistant, **options: Any) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options=options)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def _light(hass: HomeAssistant, name: str, domain: str = "test") -> dr.DeviceEntry:
    source = next((e for e in hass.config_entries.async_entries(domain) if e.title == f"{domain} Eintrag"), None)
    if source is None:
        source = MockConfigEntry(domain=domain, title=f"{domain} Eintrag")
        source.add_to_hass(hass)
    device = dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={(domain, name)}, name=name)
    entity = er.async_get(hass).async_get_or_create("light", domain, f"{name}-1", device_id=device.id)
    hass.states.async_set(entity.entity_id, "on")
    return device


async def _devices(client, msg_id: int) -> dict[str, dict[str, Any]]:
    await client.send_json({"id": msg_id, "type": f"{DOMAIN}/list_devices"})
    return {d["name"]: d for d in (await client.receive_json())["result"]["devices"]}


async def test_integration_type_between_device_and_detection(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass, type_integrations={"test": "sensor"})
    lamp = _light(hass, "Lampe")
    other = _light(hass, "Fremde Lampe", domain="other")
    client = await hass_ws_client(hass)

    devices = await _devices(client, 1)
    mine, theirs = devices["Lampe"], devices["Fremde Lampe"]
    # Integration "test": festgelegt statt der Erkennung (Licht), die Erkennung bleibt sichtbar
    assert (mine["type"], mine["type_auto"], mine["type_integration"], mine["type_manual"]) == ("sensor", "light", "sensor", False)
    # Andere Integration: Erkennung
    assert (theirs["type"], theirs["type_auto"], theirs["type_integration"], theirs["type_manual"]) == ("light", "light", None, False)

    # Von Hand am Gerät geht vor der Integration
    await client.send_json({"id": 2, "type": f"{DOMAIN}/set_device_type", "device_id": lamp.id, "device_type": "lock"})
    assert (await client.receive_json())["success"]
    mine = (await _devices(client, 3))["Lampe"]
    assert (mine["type"], mine["type_auto"], mine["type_integration"], mine["type_manual"]) == ("lock", "light", "sensor", True)

    # Zurück auf "automatisch": wieder der Typ der Integration
    await client.send_json({"id": 4, "type": f"{DOMAIN}/set_device_type", "device_id": lamp.id, "device_type": None})
    assert (await client.receive_json())["success"]
    mine = (await _devices(client, 5))["Lampe"]
    assert (mine["type"], mine["type_manual"]) == ("sensor", False)
    assert other.id != lamp.id


async def test_integration_type_counts_for_exclusions(hass: HomeAssistant, hass_ws_client) -> None:
    # Die Integration legt "sensor" fest, "sensor" ist ausgeblendet: das Gerät fehlt im Panel
    await _setup(hass, type_integrations={"test": "sensor"}, exclude_types=["sensor"])
    _light(hass, "Lampe")
    _light(hass, "Fremde Lampe", domain="other")
    client = await hass_ws_client(hass)
    assert set(await _devices(client, 1)) == {"Fremde Lampe"}
    # Katalog der Einstellungen zählt nach dem wirksamen Typ
    await client.send_json({"id": 2, "type": f"{DOMAIN}/get_options"})
    types = {t["type"]: t["devices"] for t in (await client.receive_json())["result"]["catalog"]["types"]}
    assert types.get("sensor") == 1 and types.get("light") == 1


async def test_options_from_panel(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await _setup(hass)
    client = await hass_ws_client(hass)

    async def send(i: int, values: dict[str, Any]) -> dict[str, Any]:
        await client.send_json({"id": i, "type": f"{DOMAIN}/set_options", "values": values})
        return await client.receive_json()

    assert (await send(1, {"type_integrations": {"zha": "sensor", "hue": "light"}}))["success"]
    assert entry.options["type_integrations"] == {"hue": "light", "zha": "sensor"}
    assert not (await send(2, {"type_integrations": {"zha": "gibtsnicht"}}))["success"]
    assert not (await send(3, {"type_integrations": {"Z H A": "sensor"}}))["success"]
    assert not (await send(4, {"type_integrations": ["zha"]}))["success"]
    assert (await send(5, {"type_integrations": {}}))["success"]
    assert entry.options["type_integrations"] == {}


def test_type_map_validation() -> None:
    assert type_map(None) == {}
    assert type_map({"zha": " Sensor ", "hue": "light"}) == {"hue": "light", "zha": "sensor"}
    for bad in ([], {"zha": "x"}, {"Z": "sensor"}, {"zha": 5}):
        with pytest.raises(vol.Invalid):
            type_map(bad)
