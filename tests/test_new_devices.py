"""Push bei neuen Geräten (1.24.0): Sammelfenster, Filter, Inhalt, anhaltende Benachrichtigung."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import pytest
from homeassistant.components import persistent_notification
from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed, async_mock_service

from custom_components.device_panel.const import DATA_NEW, DOMAIN, PERSISTENT_NEW_ID


async def _setup(hass: HomeAssistant, **options: Any) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options={"notify_service": "notify.handy", "notify_new": True, **options})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def _device(hass: HomeAssistant, name: str, domain: str = "test", **kwargs: Any) -> dr.DeviceEntry:
    source = next((e for e in hass.config_entries.async_entries(domain) if e.title == f"{domain} Eintrag"), None)
    if source is None:
        source = MockConfigEntry(domain=domain, title=f"{domain} Eintrag")
        source.add_to_hass(hass)
    device = dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={(domain, name)}, name=name, **kwargs)
    entity = er.async_get(hass).async_get_or_create("light", domain, f"{name}-1", device_id=device.id)
    hass.states.async_set(entity.entity_id, "on")
    return device


async def _wait(hass: HomeAssistant, freezer, minutes: float) -> None:
    freezer.tick(timedelta(minutes=minutes, seconds=1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()


async def test_single_device_after_window(hass: HomeAssistant, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    await _setup(hass)
    area = ar.async_get(hass).async_create("Wohnzimmer")
    lamp = _device(hass, "Stehlampe", manufacturer="Beispiel AG", model="L1")
    dr.async_get(hass).async_update_device(lamp.id, area_id=area.id)
    await hass.async_block_till_done()
    assert not calls
    # Vor dem Ende des Fensters nichts
    await _wait(hass, freezer, 4)
    assert not calls
    await _wait(hass, freezer, 1)
    assert len(calls) == 1
    data = calls[0].data
    assert data["title"] == "New device: Stehlampe"
    # Standardinhalt: Bereich und Integration; Tippen öffnet das Gerät im Panel
    assert data["message"] == "Wohnzimmer · test"
    assert data["data"]["url"] == f"/device-panel?device={lamp.id}"
    assert data["data"]["tag"] == f"{DOMAIN}_new_{lamp.id}"
    # Nichts doppelt
    await _wait(hass, freezer, 10)
    assert len(calls) == 1


async def test_group_and_fields(hass: HomeAssistant, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    await _setup(hass, new_fields=["model"], new_window=3)
    _device(hass, "Lampe A", model="L1")
    await _wait(hass, freezer, 1)
    _device(hass, "Lampe B", model="L2")
    _device(hass, "Lampe C")
    await _wait(hass, freezer, 1.5)
    assert not calls
    await _wait(hass, freezer, 1)
    # Das Fenster beginnt beim ersten Gerät: alle drei in einer Meldung
    assert len(calls) == 1
    assert calls[0].data["title"] == "3 new devices"
    assert calls[0].data["message"] == "Lampe A (L1), Lampe B (L2), Lampe C"
    assert calls[0].data["data"]["tag"] == f"{DOMAIN}_new"


async def test_nothing_when_off_and_only_after_switching_on(hass: HomeAssistant, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    entry = await _setup(hass, notify_new=False)
    _device(hass, "Vorher")
    await _wait(hass, freezer, 6)
    assert not calls
    # Eingeschaltet: nur Geräte ab jetzt, das frühere bleibt unerwähnt
    hass.config_entries.async_update_entry(entry, options={**entry.options, "notify_new": True})
    await hass.async_block_till_done()
    _device(hass, "Nachher")
    await _wait(hass, freezer, 6)
    assert len(calls) == 1 and "Nachher" in calls[0].data["title"]
    # Wieder aus, bevor das Fenster endet: nichts mehr
    _device(hass, "Zu spät")
    hass.config_entries.async_update_entry(entry, options={**entry.options, "notify_new": False})
    await hass.async_block_till_done()
    await _wait(hass, freezer, 6)
    assert len(calls) == 1
    assert not hass.data[DATA_NEW].pending


@pytest.mark.parametrize(
    "options, hide",
    [
        ({"new_exclude_integrations": ["other"]}, False),
        ({"exclude_integrations": ["other"]}, False),
        ({}, True),
    ],
)
async def test_filters(hass: HomeAssistant, freezer, options: dict[str, Any], hide: bool) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    await _setup(hass, **options)
    kept = _device(hass, "Bleibt", domain="test")
    other = _device(hass, "Anderes", domain="other")
    if hide:
        # Einzeln ausgeblendet oder deaktiviert: keine Meldung
        hass.config_entries.async_update_entry(hass.config_entries.async_entries(DOMAIN)[0], options={**hass.config_entries.async_entries(DOMAIN)[0].options, "exclude_devices": [other.id]})
        await hass.async_block_till_done()
    await _wait(hass, freezer, 6)
    assert len(calls) == 1
    assert calls[0].data["title"].endswith("Bleibt")
    assert kept.id in calls[0].data["data"]["url"]


async def test_disabled_device_not_reported(hass: HomeAssistant, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    await _setup(hass)
    dev = _device(hass, "Aus")
    dr.async_get(hass).async_update_device(dev.id, disabled_by=dr.DeviceEntryDisabler.USER)
    await hass.async_block_till_done()
    await _wait(hass, freezer, 6)
    assert not calls


async def test_persistent_notification_and_dismiss(hass: HomeAssistant, freezer) -> None:
    async_mock_service(hass, "notify", "handy")
    await _setup(hass, notify_service="none", new_persistent=True)
    _device(hass, "Erste")
    await _wait(hass, freezer, 6)
    notes = persistent_notification._async_get_or_create_notifications(hass)
    assert PERSISTENT_NEW_ID in notes and "Erste" in notes[PERSISTENT_NEW_ID]["message"]
    _device(hass, "Zweite")
    await _wait(hass, freezer, 6)
    message = persistent_notification._async_get_or_create_notifications(hass)[PERSISTENT_NEW_ID]["message"]
    # Neueste zuerst, die frühere bleibt in der Liste
    assert message.index("Zweite") < message.index("Erste")
    # Weggeklickt: die Liste beginnt neu
    persistent_notification.async_dismiss(hass, PERSISTENT_NEW_ID)
    await hass.async_block_till_done()
    _device(hass, "Dritte")
    await _wait(hass, freezer, 6)
    message = persistent_notification._async_get_or_create_notifications(hass)[PERSISTENT_NEW_ID]["message"]
    assert "Dritte" in message and "Erste" not in message


async def test_new_install_excludes_ibeacon() -> None:
    from custom_components.device_panel.const import NEW_INSTALL_OPTIONS

    assert NEW_INSTALL_OPTIONS["new_exclude_integrations"] == ["ibeacon"]


async def test_options_from_panel(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await _setup(hass, notify_new=False)
    client = await hass_ws_client(hass)

    async def send(i: int, values: dict[str, Any]) -> dict[str, Any]:
        await client.send_json({"id": i, "type": f"{DOMAIN}/set_options", "values": values})
        return await client.receive_json()

    res = await send(1, {"notify_new": True, "new_window": 10, "new_persistent": True, "new_fields": ["model", "area"], "new_exclude_integrations": ["hue", "ibeacon"]})
    assert res["success"]
    assert entry.options["notify_new"] is True and entry.options["new_window"] == 10
    # Inhalt in fester Reihenfolge
    assert entry.options["new_fields"] == ["area", "model"]
    assert entry.options["new_exclude_integrations"] == ["hue", "ibeacon"]
    # Ausserhalb des Bereichs und unbekannte Angabe: abgelehnt
    assert not (await send(2, {"new_window": 0}))["success"]
    assert not (await send(3, {"new_window": 61}))["success"]
    assert not (await send(4, {"new_fields": ["since"]}))["success"]
    await client.send_json({"id": 5, "type": f"{DOMAIN}/get_options"})
    result = (await client.receive_json())["result"]
    assert result["values"]["new_window"] == 10 and result["limits"]["new_window"] == [1, 60]
