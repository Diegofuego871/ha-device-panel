"""Ohne Online-Status (2.156.0): das Gerät bleibt überwacht (Batterie, Laden, Empfang), hat aber keinen Status, keine Ausfälle und keine Ausfall-Meldungen."""

from __future__ import annotations

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr

from custom_components.device_panel.const import DATA_AVAILABILITY
from custom_components.device_panel.devices import (
    async_set_device_settings,
    device_offline_after,
    device_status_off,
    monitored_devices,
    status_devices,
    valid_offline_setting,
)
from custom_components.device_panel.options_api import PANEL_SCHEMA, effective, offline_map, offline_setting_for, status_off_for
from custom_components.device_panel.scope import Scope, strictest_time

from .test_labels import _device, _devices, _label, _setup


def test_strictest_time_order() -> None:
    # "off" vor "nostatus" vor einer Zeit
    assert strictest_time([("a", 30), ("b", "nostatus")]) == ("b", "nostatus")
    assert strictest_time([("a", "nostatus"), ("b", "off"), ("c", 90)]) == ("b", "off")
    assert strictest_time([("a", 30), ("b", 90)]) == ("b", 90)


def test_option_values() -> None:
    assert offline_map({"zha": "nostatus", "label:abc": "nostatus", "hue": 10, "x": "off"}) == {"hue": 10, "label:abc": "nostatus", "x": "off", "zha": "nostatus"}
    with pytest.raises(vol.Invalid):
        offline_map({"zha": "weg"})
    assert PANEL_SCHEMA({"offline_after_integrations": {"zha": "nostatus"}})["offline_after_integrations"] == {"zha": "nostatus"}
    assert valid_offline_setting("nostatus") and valid_offline_setting("off") and valid_offline_setting(30)
    assert not valid_offline_setting("weg") and not valid_offline_setting(True)


def test_resolution_in_options() -> None:
    opts = {"offline_after": 2, "offline_after_integrations": {"zha": "nostatus", "label:a": 30, "label:b": "nostatus"}}
    assert offline_setting_for(opts, "zha") == "nostatus" and status_off_for(opts, "zha")
    assert not status_off_for(opts, "hue")
    # Label vor Integration: 30 Minuten gelten, der Status bleibt an
    assert not status_off_for(opts, Scope("zha", ("label:a",))) and offline_setting_for(opts, Scope("zha", ("label:a",))) == 30
    # Mehrere Labels: das strengste
    assert status_off_for(opts, Scope("hue", ("label:a", "label:b")))


async def test_integration_without_status(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass, offline_after_integrations={"test": "nostatus"})
    laptop = _device(hass, "Laptop")
    client = await hass_ws_client(hass)

    d = (await _devices(client, 1))["Laptop"]
    assert d["no_status"] is True and d["unmonitored"] is False
    assert d["online"] is None and d["offline_since"] is None and d["offline_after"] is None
    assert d["offline_default"]["minutes"] == "nostatus" and d["offline_default"]["integration"] == "test"

    opts = effective(hass)
    dev = dr.async_get(hass).async_get(laptop.id)
    assert device_status_off(hass, opts, dev) is True and device_offline_after(hass, opts, dev) == 120
    # Batterie, Laden und Empfang überwachen weiter, das Verfügbarkeitsprotokoll nicht
    assert laptop.id in {x.id for x, _e in monitored_devices(hass, opts)}
    assert laptop.id not in {x.id for x, _e in status_devices(hass, opts)}
    assert hass.data.get(DATA_AVAILABILITY) is not None

    # Eigene Zeit am Gerät geht vor: der Status ist wieder an
    await async_set_device_settings(hass, laptop.id, offline=45)
    d = (await _devices(client, 2))["Laptop"]
    assert d["no_status"] is False and d["offline_after"] == 45 and d["online"] is not None
    assert laptop.id in {x.id for x, _e in status_devices(hass, effective(hass))}
    # Eigenes "nostatus" am Gerät, ohne dass die Integration es hat
    await async_set_device_settings(hass, laptop.id, offline="nostatus")
    assert (await _devices(client, 3))["Laptop"]["no_status"] is True


async def test_label_without_status_strictest(hass: HomeAssistant, hass_ws_client) -> None:
    quiet = _label(hass, "Oft offline")
    slow = _label(hass, "Langsam")
    await _setup(hass, labels=[quiet, slow], offline_after_integrations={f"label:{quiet}": "nostatus", f"label:{slow}": 60})
    _device(hass, "Beides", labels=(quiet, slow))
    _device(hass, "Nur langsam", labels=(slow,))
    client = await hass_ws_client(hass)
    devices = await _devices(client, 1)
    assert devices["Beides"]["no_status"] is True and devices["Beides"]["online"] is None
    assert devices["Nur langsam"]["no_status"] is False and devices["Nur langsam"]["offline_after"] == 60
    assert devices["Beides"]["offline_default"]["integration"] == f"label:{quiet}"


async def test_summary_ignores_no_status_for_warning(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass, offline_after_integrations={"test": "nostatus"})
    _device(hass, "Laptop")
    client = await hass_ws_client(hass)
    from custom_components.device_panel.summary import _warning

    d = (await _devices(client, 1))["Laptop"]
    assert _warning(d) is False
