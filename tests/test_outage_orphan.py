"""Verwaiste Ausfälle: Gerät verliert alle Entitäten, wird deaktiviert oder gelöscht (Issue 5)."""

from __future__ import annotations

from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from custom_components.device_panel.const import DATA_OUTAGE

from .test_outage import _device, _entity, _options, _tick, setup  # noqa: F401,F811


async def _outage(hass, setup, freezer):
    dev = _device(hass, "Saareke")
    ent = _entity(hass, dev, "light", "l", "on")
    await _options(hass, outage_persistent=True)
    setup.evaluate()
    hass.states.async_set(ent, "unavailable")
    await _tick(hass, setup, freezer, 3)
    notifier = hass.data[DATA_OUTAGE]
    assert dev.id in notifier.offline
    return dev, ent, notifier


async def test_entities_removed_then_device_disabled(hass: HomeAssistant, setup, freezer) -> None:
    dev, ent, notifier = await _outage(hass, setup, freezer)
    er.async_get(hass).async_remove(ent)
    hass.states.async_remove(ent)
    await _tick(hass, setup, freezer, 3)
    dr.async_get(hass).async_update_device(dev.id, disabled_by=dr.DeviceEntryDisabler.USER)
    await _tick(hass, setup, freezer, 3)
    assert dev.id not in notifier.offline
    assert not [n for n in hass.data.get("persistent_notification", {}).values() if "Saareke" in n.get("message", "")]


async def test_device_disabled_directly(hass: HomeAssistant, setup, freezer) -> None:
    dev, ent, notifier = await _outage(hass, setup, freezer)
    dr.async_get(hass).async_update_device(dev.id, disabled_by=dr.DeviceEntryDisabler.USER)
    await _tick(hass, setup, freezer, 3)
    assert dev.id not in notifier.offline


async def _restart(hass, hass_storage, dev, events, disabled=True):
    import time

    from pytest_homeassistant_custom_component.common import MockConfigEntry

    from custom_components.device_panel.const import DATA_AVAILABILITY, DOMAIN

    began = time.time() - 3600
    if events is not None:
        hass_storage[f"{DOMAIN}.availability"] = {"version": 1, "minor_version": 1, "key": f"{DOMAIN}.availability", "data": {"heartbeat": time.time() - 300, "devices": {dev.id: events(began)}}}
    hass_storage[f"{DOMAIN}.notify"] = {"version": 1, "minor_version": 1, "key": f"{DOMAIN}.notify", "data": {"offline": {dev.id: began}, "notified": [dev.id]}}
    if disabled:
        dr.async_get(hass).async_update_device(dev.id, disabled_by=dr.DeviceEntryDisabler.USER)
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options={"outage_persistent": True})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    log = hass.data[DATA_AVAILABILITY]
    import time as t

    log._started = t.time() - 3600
    return log


async def test_restart_device_disabled_while_outage_known(hass: HomeAssistant, hass_storage, freezer) -> None:
    dev = _device(hass, "Saareke")
    log = await _restart(hass, hass_storage, dev, lambda b: [[b - 60, 1], [b, 0]])
    await _tick(hass, log, freezer, 3)
    assert dev.id not in hass.data[DATA_OUTAGE].offline


async def test_restart_log_already_none(hass: HomeAssistant, hass_storage, freezer) -> None:
    dev = _device(hass, "Saareke")
    log = await _restart(hass, hass_storage, dev, lambda b: [[b - 60, 1], [b, 0], [b + 60, None]])
    await _tick(hass, log, freezer, 3)
    assert dev.id not in hass.data[DATA_OUTAGE].offline


async def test_restart_no_log_entry(hass: HomeAssistant, hass_storage, freezer) -> None:
    dev = _device(hass, "Saareke")
    log = await _restart(hass, hass_storage, dev, None)
    await _tick(hass, log, freezer, 3)
    assert dev.id not in hass.data[DATA_OUTAGE].offline


async def test_sweep_removes_device_deleted_in_between(hass: HomeAssistant, setup, freezer) -> None:
    from datetime import timedelta

    from pytest_homeassistant_custom_component.common import async_fire_time_changed

    dev, ent, notifier = await _outage(hass, setup, freezer)
    # Das Signal "gone" geht verloren: Eintrag von Hand zurücklegen, das Gerät gibt es nicht mehr
    dr.async_get(hass).async_remove_device(dev.id)
    notifier._offline[dev.id] = 1.0
    notifier._notified.add(dev.id)
    freezer.tick(timedelta(minutes=16))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert dev.id not in notifier.offline and dev.id not in notifier.notified
