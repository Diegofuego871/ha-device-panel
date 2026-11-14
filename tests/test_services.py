"""Dienst "Überwachung pausieren" (2.217.0): nur für Administratoren, Prüfung der Angaben, Wirkung."""

from __future__ import annotations

import time

import pytest
from homeassistant.core import Context, HomeAssistant
from homeassistant.exceptions import ServiceValidationError, Unauthorized

from custom_components.device_panel.const import DOMAIN
from custom_components.device_panel.devices import device_settings

from .test_outage_notify import _device, _entity, setup  # noqa: F401, F811


async def _call(hass: HomeAssistant, data: dict, user=None) -> None:
    ctx = Context(user_id=user.id) if user else Context()
    await hass.services.async_call(DOMAIN, "pause_monitoring", data, blocking=True, context=ctx)


async def test_pause_until_online(hass: HomeAssistant, setup, hass_admin_user) -> None:  # noqa: F811
    lamp = _device(hass, "Lampe")
    _entity(hass, lamp, "light", "l", "on")
    await _call(hass, {"device_id": lamp.id}, hass_admin_user)
    assert device_settings(hass)["monitor_pause"][lamp.id]["mode"] == "online"


async def test_pause_until_date(hass: HomeAssistant, setup, hass_admin_user) -> None:  # noqa: F811
    lamp = _device(hass, "Lampe")
    until = time.time() + 86400
    await _call(hass, {"device_id": lamp.id, "mode": "date", "until": until}, hass_admin_user)
    assert device_settings(hass)["monitor_pause"][lamp.id] == {"mode": "date", "until": until}
    # auch als Datum mit Zeit (Ortszeit)
    await _call(hass, {"device_id": lamp.id, "mode": "date", "until": "2099-01-01 12:00:00"}, hass_admin_user)
    assert device_settings(hass)["monitor_pause"][lamp.id]["until"] > until


async def test_non_admin_is_refused(hass: HomeAssistant, setup, hass_read_only_user) -> None:  # noqa: F811
    lamp = _device(hass, "Lampe")
    with pytest.raises(Unauthorized):
        await _call(hass, {"device_id": lamp.id}, hass_read_only_user)
    assert lamp.id not in device_settings(hass)["monitor_pause"]


async def test_bad_input_is_refused(hass: HomeAssistant, setup, hass_admin_user) -> None:  # noqa: F811
    lamp = _device(hass, "Lampe")
    with pytest.raises(ServiceValidationError):
        await _call(hass, {"device_id": "gibt-es-nicht"}, hass_admin_user)
    with pytest.raises(ServiceValidationError):
        await _call(hass, {"device_id": lamp.id, "mode": "date"}, hass_admin_user)
    with pytest.raises(ServiceValidationError):
        await _call(hass, {"device_id": lamp.id, "mode": "date", "until": time.time() - 60}, hass_admin_user)
    with pytest.raises(Exception):  # noqa: B017  (Schema: unbekannte Art, Zahl ausserhalb)
        await _call(hass, {"device_id": lamp.id, "mode": "forever"}, hass_admin_user)
    with pytest.raises(Exception):  # noqa: B017
        await _call(hass, {"device_id": lamp.id, "mode": "date", "until": 9e12}, hass_admin_user)
    assert lamp.id not in device_settings(hass)["monitor_pause"]


async def test_service_removed_on_unload(hass: HomeAssistant, setup) -> None:  # noqa: F811
    assert hass.services.has_service(DOMAIN, "pause_monitoring")
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert not hass.services.has_service(DOMAIN, "pause_monitoring")


