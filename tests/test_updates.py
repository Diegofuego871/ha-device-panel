"""Update-Erinnerung (1.29.0): sofort mit Sammelfenster, täglich/wöchentlich, Arten, Merker, Erinnerung."""

from __future__ import annotations

import time
from datetime import timedelta
from typing import Any

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed, async_mock_service

from custom_components.device_panel.const import DATA_UPDATES, DOMAIN
from custom_components.device_panel.options_api import update_kinds, values_from


async def _setup(hass: HomeAssistant, **options: Any) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options={"notify_service": "notify.handy", "notify_updates": True, **options})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def _update(hass: HomeAssistant, object_id: str, platform: str, title: str, old: str, new: str, state: str = "on") -> str:
    ent = er.async_get(hass).async_get_or_create("update", platform, object_id, suggested_object_id=object_id)
    hass.states.async_set(ent.entity_id, state, {"title": title, "installed_version": old, "latest_version": new})
    return ent.entity_id


async def _wait(hass: HomeAssistant, freezer, minutes: float) -> None:
    freezer.tick(timedelta(minutes=minutes, seconds=1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()


async def test_instant_collects_in_one_message(hass: HomeAssistant, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    await _setup(hass, updates_mode="instant")
    _update(hass, "home_assistant_core_update", "hassio", "Home Assistant Core", "2026.10.2", "2026.10.3")
    await hass.async_block_till_done()
    await _wait(hass, freezer, 2)
    _update(hass, "mosquitto_update", "hassio", "Mosquitto broker", "6.5.0", "6.5.1")
    await hass.async_block_till_done()
    assert not calls
    await _wait(hass, freezer, 4)
    assert len(calls) == 1
    data = calls[0].data
    assert data["title"] == "Home Assistant update"
    assert data["message"] == "2 available:\n• Home Assistant Core 2026.10.2 → 2026.10.3\n• Mosquitto broker 6.5.0 → 6.5.1"
    assert data["data"]["url"] == "/config/updates"
    # Dasselbe Update nicht noch einmal
    hass.states.async_set("update.home_assistant_core_update", "on", {"title": "Home Assistant Core", "installed_version": "2026.10.2", "latest_version": "2026.10.3", "x": 1})
    await hass.async_block_till_done()
    await _wait(hass, freezer, 6)
    assert len(calls) == 1


async def test_kinds_and_skipped(hass: HomeAssistant, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    await _setup(hass, updates_mode="instant")
    # Geräte-Firmware ist standardmässig aus, übersprungene (off) zählen nie
    _update(hass, "shelly_fw", "shelly", "Shelly Plug", "1.0", "1.1")
    _update(hass, "hacs_x", "hacs", "Device Panel", "1.27.0", "1.28.0", state="off")
    await hass.async_block_till_done()
    await _wait(hass, freezer, 6)
    assert not calls
    _update(hass, "hacs_y", "hacs", "Beispiel-Karte", "2.0", "2.1")
    await hass.async_block_till_done()
    await _wait(hass, freezer, 6)
    assert [c.data["message"] for c in calls] == ["1 available:\n• Beispiel-Karte 2.0 → 2.1"]


async def test_disabled_sends_nothing(hass: HomeAssistant, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    await _setup(hass, notify_updates=False, updates_mode="instant")
    _update(hass, "home_assistant_core_update", "hassio", "Home Assistant Core", "1", "2")
    await hass.async_block_till_done()
    await _wait(hass, freezer, 6)
    assert not calls


async def test_daily_at_time(hass: HomeAssistant, freezer) -> None:
    await hass.config.async_set_time_zone("UTC")
    freezer.move_to("2026-10-13 08:58:00+00:00")  # Dienstag
    calls = async_mock_service(hass, "notify", "handy")
    await _setup(hass)  # Standard: täglich 09:00
    _update(hass, "addon_a_update", "hassio", "Add-on A", "1", "2")
    await hass.async_block_till_done()
    assert not calls
    await _wait(hass, freezer, 2)
    assert len(calls) == 1 and calls[0].data["message"] == "1 available:\n• Add-on A 1 → 2"
    # Am nächsten Tag nichts Neues: keine Meldung
    await _wait(hass, freezer, 24 * 60)
    assert len(calls) == 1


async def test_weekly_only_on_monday(hass: HomeAssistant, freezer) -> None:
    await hass.config.async_set_time_zone("UTC")
    freezer.move_to("2026-10-13 08:58:00+00:00")  # Dienstag
    calls = async_mock_service(hass, "notify", "handy")
    await _setup(hass, updates_mode="weekly")
    _update(hass, "addon_a_update", "hassio", "Add-on A", "1", "2")
    await hass.async_block_till_done()
    await _wait(hass, freezer, 2)
    assert not calls  # Dienstag
    freezer.move_to("2026-10-19 08:58:00+00:00")  # Montag
    await _wait(hass, freezer, 2)
    assert len(calls) == 1


async def test_report_tracks_versions_and_repeat(hass: HomeAssistant) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    await _setup(hass, updates_repeat="3d")
    notifier = hass.data[DATA_UPDATES]
    eid = _update(hass, "addon_a_update", "hassio", "Add-on A", "1", "2")
    await notifier.async_report()
    await notifier.async_report()
    assert len(calls) == 1
    # Neue Version: wieder melden
    hass.states.async_set(eid, "on", {"title": "Add-on A", "installed_version": "1", "latest_version": "3"})
    await notifier.async_report()
    assert len(calls) == 2
    # Offen gebliebene: erst nach 3 Tagen erneut
    notifier._known[eid]["at"] = time.time() - 2 * 86400
    await notifier.async_report()
    assert len(calls) == 2
    notifier._known[eid]["at"] = time.time() - 4 * 86400
    await notifier.async_report()
    assert len(calls) == 3
    # Installiert (nicht mehr "on"): vergessen, ein späteres neues Update kommt wieder
    hass.states.async_set(eid, "off", {"title": "Add-on A", "installed_version": "3", "latest_version": "3"})
    await notifier.async_report()
    assert eid not in notifier._known


def test_option_values() -> None:
    values = values_from({})
    assert values["notify_updates"] is False
    assert (values["updates_mode"], values["updates_time"], values["updates_window"], values["updates_repeat"]) == ("daily", "09:00", 5, "never")
    assert values["updates_kinds"] == ["core", "addons", "hacs"]
    bad = values_from({"updates_mode": "x", "updates_time": "25:00", "updates_window": 99, "updates_repeat": "x", "updates_kinds": "x"})
    assert (bad["updates_mode"], bad["updates_time"], bad["updates_window"], bad["updates_repeat"], bad["updates_kinds"]) == ("daily", "09:00", 5, "never", ["core", "addons", "hacs"])
    assert update_kinds(["hacs", "core"]) == ["core", "hacs"]
    with pytest.raises(vol.Invalid):
        update_kinds(["firmware"])
