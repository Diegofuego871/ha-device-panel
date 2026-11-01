"""Meldung bei Backup-Fehler (2.185.0): Ereignis der Backup-Integration, sofort oder nicht vor einer Uhrzeit, Neustart, Ziel der Status-App."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed, async_mock_service

from custom_components.device_panel import backup_alert
from custom_components.device_panel.const import DATA_BACKUP_ALERT, DOMAIN


@dataclass
class _Event:
    manager_state: str = "create_backup"
    state: str = "failed"


@pytest.fixture(autouse=True)
async def _de(hass: HomeAssistant) -> None:
    hass.config.language = "de"


async def _setup(hass: HomeAssistant, **options: Any) -> backup_alert.BackupAlert:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options={"notify_service": "notify.handy", **options})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return hass.data[DATA_BACKUP_ALERT]


def test_release_at() -> None:
    at = lambda h, m=0: datetime(2026, 11, 2, h, m)  # noqa: E731
    assert backup_alert.release_at("", at(3)) is None
    assert backup_alert.release_at("07:00", at(3)) == at(7)
    assert backup_alert.release_at("07:00", at(7)) == at(7) + timedelta(days=1)
    assert backup_alert.release_at("07:00", at(15)) == at(7) + timedelta(days=1)


def test_only_a_failed_create_event_counts() -> None:
    assert backup_alert.is_failure(_Event())
    assert not backup_alert.is_failure(_Event(state="completed"))
    assert not backup_alert.is_failure(_Event(state="in_progress"))
    assert not backup_alert.is_failure(_Event(manager_state="restore_backup"))
    assert not backup_alert.is_failure(object())


async def test_failure_is_sent_at_once_by_default(hass: HomeAssistant) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    alert = await _setup(hass)
    alert._on_event(_Event())
    await hass.async_block_till_done()
    assert len(handy) == 1
    assert handy[0].data["title"] == "⚠️ Backup fehlgeschlagen"
    assert handy[0].data["data"]["url"] == "/config/backup" and handy[0].data["data"]["tag"] == "device_panel_backup_failed"


async def test_other_events_send_nothing(hass: HomeAssistant) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    alert = await _setup(hass)
    alert._on_event(_Event(state="completed"))
    await hass.async_block_till_done()
    assert handy == []


async def test_off_and_no_target_send_nothing(hass: HomeAssistant) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    alert = await _setup(hass, status_backup_alert=False)
    alert._on_event(_Event())
    await hass.async_block_till_done()
    assert handy == []
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    hass.config_entries.async_update_entry(entry, options={**entry.options, "status_backup_alert": True, "notify_service": "none"})
    await hass.async_block_till_done()
    alert._on_event(_Event())
    await hass.async_block_till_done()
    assert handy == []


async def test_own_status_target_is_used(hass: HomeAssistant) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    wache = async_mock_service(hass, "notify", "wache")
    alert = await _setup(hass, notify_service_status="notify.wache")
    alert._on_event(_Event())
    await hass.async_block_till_done()
    assert handy == [] and len(wache) == 1


async def test_night_failure_waits_until_the_time(hass: HomeAssistant, freezer: Any) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    freezer.move_to(dt_util.now().replace(hour=3, minute=0, second=0, microsecond=0))
    alert = await _setup(hass, status_backup_time="07:00")
    alert._on_event(_Event())
    await hass.async_block_till_done()
    assert handy == [] and alert._pending is not None
    freezer.move_to(dt_util.now().replace(hour=7, minute=1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert len(handy) == 1 and alert._pending is None


async def test_failure_after_the_time_waits_for_the_next_day(hass: HomeAssistant, freezer: Any) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    freezer.move_to(dt_util.now().replace(hour=15, minute=0, second=0, microsecond=0))
    alert = await _setup(hass, status_backup_time="07:00")
    alert._on_event(_Event())
    await hass.async_block_till_done()
    assert handy == [] and alert._pending is not None
    freezer.move_to(dt_util.now().replace(hour=15, minute=0) + timedelta(hours=17))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert len(handy) == 1 and alert._pending is None


async def test_two_failures_before_the_time_send_one_message(hass: HomeAssistant, freezer: Any) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    freezer.move_to(dt_util.now().replace(hour=3, minute=0, second=0, microsecond=0))
    alert = await _setup(hass, status_backup_time="07:00")
    alert._on_event(_Event())
    alert._on_event(_Event())
    await hass.async_block_till_done()
    freezer.move_to(dt_util.now().replace(hour=7, minute=1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert len(handy) == 1


async def test_waiting_failure_survives_a_restart_and_off_drops_it(hass: HomeAssistant, freezer: Any) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    freezer.move_to(dt_util.now().replace(hour=3, minute=0, second=0, microsecond=0))
    alert = await _setup(hass, status_backup_time="07:00")
    alert._on_event(_Event())
    await hass.async_block_till_done()
    await alert._store.async_save({"pending": alert._pending})
    fresh = backup_alert.BackupAlert(hass)
    await fresh.async_start()
    assert fresh._pending == alert._pending
    await fresh.async_stop()
    # ausgeschaltet: das Wartende verfällt
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    hass.config_entries.async_update_entry(entry, options={**entry.options, "status_backup_alert": False})
    await hass.async_block_till_done()
    assert alert._pending is None
    freezer.move_to(dt_util.now() + timedelta(hours=6))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert handy == []


async def test_options_validate_the_time(hass: HomeAssistant) -> None:
    from custom_components.device_panel import options_api  # noqa: PLC0415
    import voluptuous as vol  # noqa: PLC0415

    assert options_api.PANEL_SCHEMA({"status_backup_time": ""})["status_backup_time"] == ""
    assert options_api.PANEL_SCHEMA({"status_backup_time": "07:00"})["status_backup_time"] == "07:00"
    with pytest.raises(vol.Invalid):
        options_api.PANEL_SCHEMA({"status_backup_time": "25:00"})
