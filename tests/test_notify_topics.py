"""Eigenes Ziel je Reiter (2.18.0): leer = das globale Ziel aus der Übersicht, sonst ein eigener notify-Dienst."""

from __future__ import annotations

import time
from datetime import timedelta

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_mock_service

from custom_components.device_panel import options_api
from custom_components.device_panel.const import DATA_CHARGE, DOMAIN, NOTIFY_TOPICS

from .test_charge import _bat, _device, _setup
from .test_updates import _setup as _setup_updates
from .test_updates import _update, _wait


def test_default_is_global() -> None:
    values = options_api.values_from({"notify_service": "notify.handy"})
    assert all(values[key] == "" for key in NOTIFY_TOPICS.values())
    assert [options_api.notify_target(values, topic) for topic in NOTIFY_TOPICS] == ["notify.handy"] * 7
    # Ohne globales Ziel: "none", solange ein Reiter kein eigenes hat
    none = options_api.values_from({})
    assert options_api.notify_target(none, "charge") == "none"


def test_own_target_wins_and_invalid_falls_back() -> None:
    values = options_api.values_from({"notify_service": "notify.handy", "notify_service_charge": "notify.tablet", "notify_service_new": "kaputt", "notify_service_updates": None})
    assert options_api.notify_target(values, "charge") == "notify.tablet"
    assert options_api.notify_target(values, "new") == "notify.handy"  # ungültig gespeichert: global
    assert options_api.notify_target(values, "updates") == "notify.handy"
    assert options_api.notify_target(values, "outage") == "notify.handy"
    # Ein eigenes Ziel gilt auch, wenn das globale "keine Meldungen" ist
    only = options_api.values_from({"notify_service_charge": "notify.tablet"})
    assert options_api.notify_target(only, "charge") == "notify.tablet" and options_api.notify_target(only, "battery") == "none"


@pytest.mark.parametrize("key", list(NOTIFY_TOPICS.values()))
def test_schema_accepts_empty_and_notify_but_not_garbage(key: str) -> None:
    for good in ("", None, "notify.tablet", "none"):
        assert options_api.PANEL_SCHEMA({key: good})[key] in ("", "notify.tablet")
    for bad in ("tablet", "light.kueche", "notify.", "notify.A b"):
        with pytest.raises(vol.Invalid):
            options_api.PANEL_SCHEMA({key: bad})


async def test_targets_list_keeps_missing_own_targets(hass: HomeAssistant) -> None:
    async_mock_service(hass, "notify", "handy")
    targets = options_api.notify_targets(hass, "notify.handy", ["", "notify.tablet", "notify.handy"])
    kinds = {t["value"]: t["kind"] for t in targets}
    assert kinds["notify.handy"] == "service" and kinds["notify.tablet"] == "missing" and kinds["none"] == "none"
    assert len([t for t in targets if t["value"] == "notify.tablet"]) == 1


async def test_updates_go_to_their_own_target(hass: HomeAssistant, freezer) -> None:
    """Global "keine Meldungen", nur die Update-Erinnerung hat ein Ziel: sie kommt dort an, nur dort."""
    handy = async_mock_service(hass, "notify", "handy")
    tablet = async_mock_service(hass, "notify", "tablet")
    await _setup_updates(hass, notify_service="none", notify_service_updates="notify.tablet", updates_mode="instant")
    _update(hass, "mosquitto_update", "hassio", "Mosquitto broker", "6.5.0", "6.5.1")
    await hass.async_block_till_done()
    await _wait(hass, freezer, 6)
    assert len(tablet) == 1 and not handy


async def test_updates_follow_global_without_own_target(hass: HomeAssistant, freezer) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    tablet = async_mock_service(hass, "notify", "tablet")
    await _setup_updates(hass, notify_service="notify.handy", notify_service_updates="", updates_mode="instant")
    _update(hass, "mosquitto_update", "hassio", "Mosquitto broker", "6.5.0", "6.5.1")
    await hass.async_block_till_done()
    await _wait(hass, freezer, 6)
    assert len(handy) == 1 and not tablet


async def test_charge_goes_to_its_own_target(hass: HomeAssistant, freezer) -> None:
    """Lademeldung: eigenes Ziel; die übrigen Reiter bleiben beim globalen."""
    handy = async_mock_service(hass, "notify", "handy")
    tablet = async_mock_service(hass, "notify", "tablet")
    device, entity = _device(hass, "Zahnbürste", 30)
    await _setup(hass, notify_charge_stop=True, notify_service_charge="notify.tablet")
    notifier = hass.data[DATA_CHARGE]
    _bat(hass, entity, 55)
    await hass.async_block_till_done()
    freezer.tick(timedelta(minutes=16))
    assert notifier.check_stalls(time.time()) == [device.id]
    await hass.async_block_till_done()
    assert len(tablet) == 1 and not handy


async def test_get_options_lists_own_targets(hass: HomeAssistant, hass_ws_client) -> None:
    async_mock_service(hass, "notify", "handy")
    await _setup(hass, notify_service_charge="notify.weg")
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/get_options"})
    result = (await client.receive_json())["result"]
    assert result["values"]["notify_service_charge"] == "notify.weg"
    assert {t["value"]: t["kind"] for t in result["notify_targets"]}["notify.weg"] == "missing"
    # Speichern und wieder leeren
    await client.send_json({"id": 2, "type": f"{DOMAIN}/set_options", "values": {"notify_service_charge": ""}})
    assert (await client.receive_json())["success"]
    await client.send_json({"id": 3, "type": f"{DOMAIN}/get_options"})
    assert (await client.receive_json())["result"]["values"]["notify_service_charge"] == ""
