"""Ruhezeit (2.95.0): Fenster je Wochentag, Zurückhalten nach Art, Zusammenfassung oder einzeln, kritische Meldungen, Neustart."""

from __future__ import annotations

import time
from datetime import datetime, timedelta
from typing import Any

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed, async_mock_service

from custom_components.device_panel import push, quiet
from custom_components.device_panel.const import DATA_AVAILABILITY, DATA_QUIET, DOMAIN


def _day(on: bool = True, begin: str = "22:00", end: str = "07:00") -> dict[str, Any]:
    return {"on": on, "from": begin, "to": end}


def _local(year: int, month: int, day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=dt_util.get_default_time_zone())


# 2026-10-19 ist ein Montag
def test_window_over_midnight_and_weekdays() -> None:
    days = [_day() for _ in range(7)]
    assert quiet.window_end(days, _local(2026, 10, 19, 12)) is None
    assert quiet.window_end(days, _local(2026, 10, 19, 23)) == _local(2026, 10, 20, 7)
    # Nach Mitternacht gilt das Fenster vom Vortag
    assert quiet.window_end(days, _local(2026, 10, 20, 3)) == _local(2026, 10, 20, 7)
    # Montag aus: die Nacht Montag auf Dienstag ist ruhig nicht, die von Sonntag auf Montag schon
    days[0] = _day(on=False)
    assert quiet.window_end(days, _local(2026, 10, 19, 23)) is None
    assert quiet.window_end(days, _local(2026, 10, 19, 3)) == _local(2026, 10, 19, 7)


def test_window_same_day_and_chained() -> None:
    days = [_day(begin="13:00", end="15:00") for _ in range(7)]
    assert quiet.window_end(days, _local(2026, 10, 19, 14)) == _local(2026, 10, 19, 15)
    assert quiet.window_end(days, _local(2026, 10, 19, 16)) is None
    # Nahtlos anschliessende Fenster zählen als eines: Montag 22:00 bis 07:00, Dienstag ab 07:00 bis 09:00
    days = [_day() for _ in range(7)]
    days[1] = _day(begin="07:00", end="09:00")
    assert quiet.window_end(days, _local(2026, 10, 20, 3)) == _local(2026, 10, 20, 9)


def test_validators() -> None:
    assert quiet.quiet_days([_day()] * 7)
    for bad in ([], [_day()] * 6, [{"on": 1, "from": "22:00", "to": "07:00"}] * 7, [_day(begin="24:00")] * 7, [_day(end="7:00")] * 7, "x"):
        with pytest.raises(vol.Invalid):
            quiet.quiet_days(bad)
    assert quiet.quiet_topics(["status", "outage"]) == ["outage", "status"]
    with pytest.raises(vol.Invalid):
        quiet.quiet_topics(["outage", "gibtsnicht"])
    assert quiet.quiet_mode("single") == "single"
    with pytest.raises(vol.Invalid):
        quiet.quiet_mode("x")


def _utc(local_text: str) -> datetime:
    """Lokale Zeit "JJJJ-MM-TT HH:MM:SS" (die Zeitzone der Tests ist nicht UTC) als UTC."""
    return dt_util.as_utc(datetime.fromisoformat(local_text).replace(tzinfo=dt_util.get_default_time_zone()))


@pytest.fixture
async def setup(hass: HomeAssistant, freezer):
    freezer.move_to(_utc("2026-10-19 12:00:00"))
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options={"status_notify": False})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    hass.data[DATA_AVAILABILITY]._started = time.time() - 3600
    return entry


async def _options(hass: HomeAssistant, **values: Any) -> None:
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    hass.config_entries.async_update_entry(entry, options={**entry.options, **values})
    await hass.async_block_till_done()


async def _send(hass: HomeAssistant, title: str, topic: str, tag: str | None = None, label: str | None = None, critical: bool = False, **extra: Any) -> bool:
    data: dict[str, Any] = {"tag": tag} if tag else {}
    if critical:
        data.update(push.critical_data(5))
    return await push.async_push(hass, "notify.handy", title, f"Text zu {title}", data or None, topic=topic, quiet={"label": label or title, **extra})


async def _at(hass: HomeAssistant, freezer, when: str) -> None:
    freezer.move_to(_utc(when))
    async_fire_time_changed(hass)
    await hass.async_block_till_done(wait_background_tasks=True)


async def test_nothing_held_outside_or_when_off(hass: HomeAssistant, setup, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    # Aus: sofort
    await _send(hass, "A", "outage")
    assert len(calls) == 1
    # Ein, aber ausserhalb der Ruhezeit (12:00): sofort
    await _options(hass, quiet_enabled=True)
    await _send(hass, "B", "outage")
    assert len(calls) == 2


async def test_held_and_delivered_as_summary(hass: HomeAssistant, setup, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, quiet_enabled=True)
    await _at(hass, freezer, "2026-10-19 23:00:00")
    assert await _send(hass, "🔴 Offline: Wetterstation", "outage", "t_wetter", "Wetterstation", since=time.time() - 600)
    assert await _send(hass, "🔴 Offline: Steckdose", "outage", "t_steckdose", "Steckdose")
    assert await _send(hass, "🟢 Back: Steckdose", "online", "t_steckdose", "Steckdose")
    assert await _send(hass, "🪫 Batterie: Rauchmelder", "battery", "t_bat", "Rauchmelder Flur (12 %)")
    assert await _send(hass, "✨ Neu: Display", "new", "t_new", "Display Büro")
    # Status ist standardmässig nicht gewählt: sofort
    assert await _send(hass, "Status: Panel", "status")
    assert [c.data["title"] for c in calls] == ["Status: Panel"]
    # Kritisch: immer sofort
    assert await _send(hass, "KRITISCH", "magic", critical=True)
    assert len(calls) == 2
    assert len(hass.data[DATA_QUIET].items) == 4 or len(hass.data[DATA_QUIET].items) == 5
    # Ende der Ruhezeit: eine Zusammenfassung
    await _at(hass, freezer, "2026-10-20 07:01:30")
    assert len(calls) == 3
    summary = calls[2].data
    assert summary["title"].startswith("🌙 Quiet time is over: ")
    assert "Outages 2" in summary["title"] and "Battery 1" in summary["title"]
    lines = summary["message"].split("\n")
    assert lines[0].startswith("Still open: Wetterstation (since ")
    assert "Was briefly gone: Steckdose" in lines[1]
    assert "Battery: Rauchmelder Flur (12 %)" in summary["message"]
    assert "New devices: Display Büro" in summary["message"]
    assert hass.data[DATA_QUIET].items == []


async def test_single_mode_keeps_last_per_tag(hass: HomeAssistant, setup, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, quiet_enabled=True, quiet_mode="single")
    await _at(hass, freezer, "2026-10-19 23:00:00")
    await _send(hass, "🔴 Offline: Steckdose", "outage", "t_steckdose")
    await _send(hass, "🟢 Back: Steckdose", "online", "t_steckdose")
    await _send(hass, "🔴 Offline: Wetterstation", "outage", "t_wetter")
    assert calls == []
    await _at(hass, freezer, "2026-10-20 07:01:30")
    assert [c.data["title"] for c in calls] == ["🟢 Back: Steckdose", "🔴 Offline: Wetterstation"]


async def test_topic_selection_and_weekdays(hass: HomeAssistant, setup, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    days = [_day() for _ in range(7)]
    days[0] = _day(on=False)  # Montagabend ohne Ruhezeit
    await _options(hass, quiet_enabled=True, quiet_topics=["status"], quiet_days=days)
    await _at(hass, freezer, "2026-10-19 23:00:00")
    # Montag 23:00: Montag aus, also keine Ruhezeit (das Fenster Sonntag auf Montag ist vorbei)
    await _send(hass, "Status: Panel", "status")
    assert len(calls) == 1
    # Dienstag 23:00: Ruhezeit; nur "Status" wird gehalten, Ausfälle kommen sofort
    await _at(hass, freezer, "2026-10-20 23:00:00")
    await _send(hass, "Status: Panel 2", "status")
    await _send(hass, "🔴 Offline: X", "outage")
    assert [c.data["title"] for c in calls] == ["Status: Panel", "🔴 Offline: X"]
    assert len(hass.data[DATA_QUIET].items) == 1


async def test_options_change_releases(hass: HomeAssistant, setup, freezer) -> None:
    """Ausschalten oder eine Art abwählen stellt Gehaltenes sofort zu."""
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, quiet_enabled=True)
    await _at(hass, freezer, "2026-10-19 23:00:00")
    await _send(hass, "🪫 Batterie: A", "battery", "t_a", "A")
    await _send(hass, "✨ Neu: B", "new", "t_b", "B")
    assert calls == []
    # "Batterie" abwählen: nur diese geht hinaus (als Zusammenfassung mit nur dieser Art)
    await _options(hass, quiet_topics=["outage", "online", "charge", "new", "updates", "panelupdate", "routines", "magic"])
    assert len(calls) == 1 and "Battery" in calls[0].data["title"]
    # Ausschalten: der Rest
    await _options(hass, quiet_enabled=False)
    assert len(calls) == 2 and "New devices" in calls[1].data["title"]
    assert hass.data[DATA_QUIET].items == []


async def test_survives_restart(hass: HomeAssistant, setup, freezer, hass_storage: dict[str, Any]) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, quiet_enabled=True)
    await _at(hass, freezer, "2026-10-19 23:00:00")
    await _send(hass, "🪫 Batterie: A", "battery", "t_a", "A")
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert hass_storage[f"{DOMAIN}.quiet"]["data"]["items"][0]["title"] == "🪫 Batterie: A"
    # Neustart nach dem Ende der Ruhezeit: Gehaltenes geht beim Start hinaus
    freezer.move_to(_utc("2026-10-20 08:00:00"))
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)
    assert len(calls) == 1 and "Battery" in calls[0].data["title"]
