"""Einstellungen pro Gerät: Übersicht in get_options und Zurücksetzen."""

from __future__ import annotations

import time
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.device_panel.const import DATA_AVAILABILITY, DOMAIN


@pytest.fixture
async def setup(hass: HomeAssistant):
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    hass.data[DATA_AVAILABILITY]._started = time.time() - 3600
    return entry


def _device(hass: HomeAssistant, name: str, domain: str = "test", **kwargs: Any) -> dr.DeviceEntry:
    source = MockConfigEntry(domain=domain, title=f"{name} Eintrag")
    source.add_to_hass(hass)
    return dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={(domain, name)}, name=name, **kwargs)


def _entity(hass: HomeAssistant, device: dr.DeviceEntry, domain: str, key: str, state: str, **kwargs: Any) -> str:
    entry = er.async_get(hass).async_get_or_create(domain, "test", f"{device.id}-{key}", device_id=device.id, **kwargs)
    hass.states.async_set(entry.entity_id, state)
    return entry.entity_id


async def _ws(client, msg_id: int, **msg: Any) -> dict[str, Any]:
    await client.send_json({"id": msg_id, **msg})
    return await client.receive_json()


async def test_overrides_listed_and_reset(hass: HomeAssistant, setup, hass_ws_client) -> None:
    ar.async_get(hass).async_create("Bad")
    bad = _device(hass, "Thermostat", domain="zha", suggested_area="Bad")
    _entity(hass, bad, "sensor", "bat", "40", original_device_class="battery")
    keller = _device(hass, "Wassersensor", domain="hidden_integration")
    _entity(hass, keller, "sensor", "bat", "10", original_device_class="battery")
    lampe = _device(hass, "Lampe")
    _entity(hass, lampe, "light", "l", "on")
    client = await hass_ws_client(hass)
    n = 1
    for payload in (
        {"device_id": bad.id, "battery": 30},
        {"device_id": keller.id, "battery": "off"},
        {"device_id": lampe.id, "notify": False},
        {"device_id": bad.id, "notify": False},
    ):
        assert (await _ws(client, n, type=f"{DOMAIN}/set_device_settings", **payload))["success"]
        n += 1
    # Wassersensor ausgeblendet: Wert bleibt gespeichert, Übersicht zeigt ihn
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    hass.config_entries.async_update_entry(entry, options={**entry.options, "exclude_integrations": ["hidden_integration"]})
    await hass.async_block_till_done()
    result = (await _ws(client, n, type=f"{DOMAIN}/get_options"))["result"]
    n += 1
    over = result["overrides"]
    assert [(i["name"], i["value"], i["hidden"]) for i in over["battery"]] == [("Thermostat", 30, False), ("Wassersensor", "off", True)]
    assert over["battery"][0]["area"] == "Bad"
    assert over["battery"][0]["integration"] == "Zigbee Home Automation"
    assert [i["name"] for i in over["notify"]] == ["Lampe", "Thermostat"]
    # Zurücksetzen: nur die genannten, unbekannte zählen nicht
    res = await _ws(client, n, type=f"{DOMAIN}/reset_device_settings", battery=[bad.id, "gibtsnicht"], notify=[lampe.id])
    n += 1
    assert res["result"] == {"battery": 1, "notify": 1}
    over = (await _ws(client, n, type=f"{DOMAIN}/get_options"))["result"]["overrides"]
    n += 1
    assert [i["name"] for i in over["battery"]] == ["Wassersensor"]
    assert [i["name"] for i in over["notify"]] == ["Thermostat"]
    # Leere Anfrage: nichts zu tun
    assert (await _ws(client, n, type=f"{DOMAIN}/reset_device_settings"))["result"] == {"battery": 0, "notify": 0}


async def test_deleted_device_kept_but_not_listed(hass: HomeAssistant, setup, hass_ws_client, hass_storage: dict[str, Any]) -> None:
    gone = _device(hass, "Weg")
    client = await hass_ws_client(hass)
    assert (await _ws(client, 1, type=f"{DOMAIN}/set_device_settings", device_id=gone.id, notify=False))["success"]
    dr.async_get(hass).async_remove_device(gone.id)
    await hass.async_block_till_done()
    assert (await _ws(client, 2, type=f"{DOMAIN}/get_options"))["result"]["overrides"] == {"battery": [], "notify": []}
    # Gespeichert bleibt er: HA stellt das Gerät mit derselben ID wieder her
    from custom_components.device_panel.devices import device_settings  # noqa: PLC0415

    assert gone.id in device_settings(hass)["notify_off"]


async def test_reset_battery_runs_warning(hass: HomeAssistant, setup, hass_ws_client) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    dev = _device(hass, "Fenster")
    _entity(hass, dev, "sensor", "bat", "10", original_device_class="battery")
    client = await hass_ws_client(hass)
    assert (await _ws(client, 1, type=f"{DOMAIN}/set_device_settings", device_id=dev.id, battery="off"))["success"]
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    hass.config_entries.async_update_entry(entry, options={**entry.options, "battery_push": True, "notify_service": "notify.handy"})
    await hass.async_block_till_done()
    assert calls == []  # Warnung für das Gerät aus
    res = await _ws(client, 2, type=f"{DOMAIN}/reset_device_settings", battery=[dev.id])
    assert res["result"]["battery"] == 1
    await hass.async_block_till_done()
    # Zurück auf den globalen Wert: die Warnung kommt sofort
    assert [c.data["title"] for c in calls] == ["Low battery: Fenster"]
    # Keine Liste: abgelehnt
    assert (await _ws(client, 3, type=f"{DOMAIN}/reset_device_settings", battery=["x"], notify="kein"))["error"]["code"] == "invalid_format"
