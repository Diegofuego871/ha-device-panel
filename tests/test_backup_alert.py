"""Meldung bei Backup-Fehler (2.185.0): Ereignis der Backup-Integration, sofort oder nicht vor einer Uhrzeit, Neustart, Ziel der Status-App."""

from __future__ import annotations

from dataclasses import dataclass
import time
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


# --- Wächter über die öffentlichen Sensoren (2.186.0) ---------------------------------------------------------------------


def _sensors(hass: HomeAssistant) -> dict[str, str]:
    """Die drei Sensoren der Backup-Integration anlegen (ohne die Integration selbst): Eintrag in der Entitätsverwaltung, Zustand gesetzt."""
    from homeassistant.helpers import entity_registry as er  # noqa: PLC0415

    reg = er.async_get(hass)
    ids = {}
    for name, key in backup_alert.SENSOR_KEYS.items():
        ids[name] = reg.async_get_or_create("sensor", "backup", key, suggested_object_id=f"backup_{key}").entity_id
    hass.states.async_set(ids["state"], "idle")
    hass.states.async_set(ids["attempted"], "unknown")
    hass.states.async_set(ids["success"], "unknown")
    return ids


async def _start_run(hass: HomeAssistant, ids: dict[str, str], automatic: bool) -> None:
    if automatic:
        hass.states.async_set(ids["attempted"], dt_util.now().isoformat())
    hass.states.async_set(ids["state"], "create_backup")
    await hass.async_block_till_done()


async def _fire(hass: HomeAssistant, freezer: Any, seconds: float) -> None:
    freezer.move_to(dt_util.utcnow() + timedelta(seconds=seconds))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()


async def test_watch_reports_an_automatic_run_without_success(hass: HomeAssistant, freezer: Any) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    await _setup(hass)
    ids = _sensors(hass)
    await _start_run(hass, ids, automatic=True)
    hass.states.async_set(ids["state"], "idle")
    await hass.async_block_till_done()
    assert handy == []
    await _fire(hass, freezer, 31)
    assert len(handy) == 1 and "fehlgeschlagen" in handy[0].data["message"]


async def test_watch_is_quiet_after_a_successful_run(hass: HomeAssistant, freezer: Any) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    await _setup(hass)
    ids = _sensors(hass)
    await _start_run(hass, ids, automatic=True)
    hass.states.async_set(ids["success"], dt_util.now().isoformat())
    hass.states.async_set(ids["state"], "idle")
    await hass.async_block_till_done()
    await _fire(hass, freezer, 31)
    assert handy == []


async def test_watch_judges_a_manual_run_only_by_the_limit(hass: HomeAssistant, freezer: Any) -> None:
    """Ein Handbackup hat nie "letzter Erfolg" (der Sensor führt nur automatische nach): das Urteil nach dem Lauf entfällt, das Zeitlimit gilt."""
    handy = async_mock_service(hass, "notify", "handy")
    await _setup(hass, status_backup_auto=False, status_backup_minutes=10)
    ids = _sensors(hass)
    await _start_run(hass, ids, automatic=False)
    hass.states.async_set(ids["state"], "idle")
    await hass.async_block_till_done()
    await _fire(hass, freezer, 31)
    assert handy == []  # beendet ohne vermerkten Erfolg: bei einem Handbackup kein Urteil
    await _start_run(hass, ids, automatic=False)
    await _fire(hass, freezer, 11 * 60)
    assert len(handy) == 1 and "nicht fertig" in handy[0].data["message"]


async def test_watch_reports_a_run_over_the_limit_once(hass: HomeAssistant, freezer: Any) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    await _setup(hass, status_backup_auto=False, status_backup_minutes=10)
    ids = _sensors(hass)
    await _start_run(hass, ids, automatic=True)
    await _fire(hass, freezer, 9 * 60)
    assert handy == []
    await _fire(hass, freezer, 2 * 60)
    assert len(handy) == 1 and "nicht fertig" in handy[0].data["message"] and "10 Min." in handy[0].data["message"]
    # später doch noch fertig oder fehlgeschlagen: keine zweite Meldung für denselben Lauf
    hass.states.async_set(ids["state"], "idle")
    await hass.async_block_till_done()
    await _fire(hass, freezer, 31)
    assert len(handy) == 1


async def test_event_and_watch_report_one_run_once(hass: HomeAssistant, freezer: Any) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    alert = await _setup(hass)
    ids = _sensors(hass)
    await _start_run(hass, ids, automatic=True)
    alert._on_event(_Event())
    hass.states.async_set(ids["state"], "idle")
    await hass.async_block_till_done()
    await _fire(hass, freezer, 31)
    assert len(handy) == 1


async def test_failed_event_of_a_manual_run_is_reported(hass: HomeAssistant) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    alert = await _setup(hass)
    ids = _sensors(hass)
    await _start_run(hass, ids, automatic=False)
    alert._on_event(_Event())
    await hass.async_block_till_done()
    assert len(handy) == 1


@dataclass
class _Done:
    manager_state: str = "create_backup"
    state: str = "completed"


async def test_success_after_a_reported_failure_sends_a_second_message(hass: HomeAssistant, freezer: Any) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    alert = await _setup(hass)
    alert._on_event(_Event())
    await hass.async_block_till_done()
    assert len(handy) == 1 and alert._open is not None
    # normaler Erfolg ohne vorherigen Fehler: nichts
    freezer.move_to(dt_util.utcnow() + timedelta(hours=2))
    alert._on_event(_Done())
    await hass.async_block_till_done()
    assert len(handy) == 2 and handy[1].data["title"] == "✅ Backup gelungen" and "2 Std." in handy[1].data["message"]
    assert handy[1].data["data"]["tag"] == handy[0].data["data"]["tag"] and alert._open is None
    alert._on_event(_Done())
    await hass.async_block_till_done()
    assert len(handy) == 2


async def test_success_without_a_failure_sends_nothing(hass: HomeAssistant) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    alert = await _setup(hass)
    alert._on_event(_Done())
    await hass.async_block_till_done()
    assert handy == []


class _Backup:
    """Nur die Backup-Meldungen einer Liste von Dienstaufrufen (die Uhr springt, die Status-Wache meldet dann eigene Dinge)."""

    def __init__(self, calls: list[Any]) -> None:
        self._calls = calls

    def _mine(self) -> list[Any]:
        return [c for c in self._calls if "Backup" in c.data["title"]]

    def __len__(self) -> int:
        return len(self._mine())

    def __getitem__(self, index: int) -> Any:
        return self._mine()[index]


async def test_late_finish_after_a_hang_suggests_a_longer_limit(hass: HomeAssistant, freezer: Any) -> None:
    sent = async_mock_service(hass, "notify", "handy")
    handy = _Backup(sent)  # die Status-Wache meldet beim Vorstellen der Uhr eigene Dinge: nur Backup-Meldungen zählen
    alert = await _setup(hass, status_backup_auto=False, status_backup_minutes=60)
    ids = _sensors(hass)
    await _start_run(hass, ids, automatic=True)
    await _fire(hass, freezer, 61 * 60)
    assert len(handy) == 1 and "nicht fertig" in handy[0].data["message"]
    await _fire(hass, freezer, 29 * 60)  # nach 90 Minuten fertig
    alert._on_event(_Done())
    await hass.async_block_till_done()
    assert len(handy) == 2
    late = handy[1].data
    assert late["title"] == "✅ Backup doch noch fertig" and "1 Std. 30 Min." in late["message"] and "(1 Std. 0 Min.)" in late["message"] and "2 Std. 30 Min." in late["message"]
    assert late["data"]["url"] == "/device-panel?app=status&tab=settings"
    # der Zustandswechsel danach meldet nichts mehr
    hass.states.async_set(ids["state"], "idle")
    await hass.async_block_till_done()
    await _fire(hass, freezer, 31)
    assert len(handy) == 2


async def test_success_before_the_release_time_drops_the_failure(hass: HomeAssistant, freezer: Any) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    freezer.move_to(dt_util.now().replace(hour=3, minute=0, second=0, microsecond=0))
    alert = await _setup(hass, status_backup_time="09:00")
    alert._on_event(_Event())
    await hass.async_block_till_done()
    assert alert._pending is not None
    alert._on_event(_Done())
    await hass.async_block_till_done()
    assert alert._pending is None
    freezer.move_to(dt_util.now().replace(hour=9, minute=1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert handy == []


def test_suggest_minutes() -> None:
    assert backup_alert.suggest_minutes(90 * 60) == 150  # 135 Min. -> auf 30 aufgerundet
    assert backup_alert.suggest_minutes(4 * 3600) == 360
    assert backup_alert.suggest_minutes(20 * 3600) == 1440  # höchstens 24 Stunden


async def test_backup_minutes_option_range(hass: HomeAssistant) -> None:
    import voluptuous as vol  # noqa: PLC0415

    from custom_components.device_panel import options_api  # noqa: PLC0415

    assert options_api.PANEL_SCHEMA({"status_backup_minutes": 180})["status_backup_minutes"] == 180
    for bad in (9, 1441, 0):
        with pytest.raises(vol.Invalid):
            options_api.PANEL_SCHEMA({"status_backup_minutes": bad})


# --- Längste Dauer "Automatisch" (2.187.0) --------------------------------------------------------------------------------


def test_fallback_minutes() -> None:
    assert backup_alert.fallback_minutes([], 180) == 180
    assert backup_alert.fallback_minutes([600], 180) == 180  # ein kurzer Lauf senkt den festen Wert nicht
    assert backup_alert.fallback_minutes([4 * 3600], 180) == 260  # ein langer Lauf hebt ihn gleich an (4 Std. plus 20 Min.)
    assert backup_alert.fallback_minutes([100 * 3600], 180) == 1440


async def test_one_long_run_raises_the_limit_at_once(hass: HomeAssistant) -> None:
    alert = await _setup(hass)
    alert._record(time.time(), 4 * 3600)
    assert alert.minutes() == 260 and alert.info()["minutes"] is None and alert.info()["fallback"] == 260
    alert._record(time.time(), 1800)  # ab zwei Läufen: längster plus 20 Minuten
    assert alert.minutes() == 260
    alert._record(time.time(), 1200)
    assert alert.minutes() == 260  # der lange Lauf zählt weiter, solange er zu den letzten fünf gehört


def test_auto_minutes() -> None:
    assert backup_alert.auto_minutes([]) is None
    assert backup_alert.auto_minutes([3600]) is None  # zu wenige Läufe
    assert backup_alert.auto_minutes([600, 3600]) == 80  # längste 60 Min. plus 20
    assert backup_alert.auto_minutes([61, 62]) == 22  # 62 s + 20 Min. -> aufgerundet auf Minuten
    assert backup_alert.auto_minutes([100 * 3600, 90]) == 1440  # höchstens 24 Stunden


@dataclass
class _St:
    state: str
    last_changed: datetime


def test_runs_from_history() -> None:
    base = datetime(2026, 10, 25, 3, 0, tzinfo=dt_util.UTC)
    at = lambda minutes: base + timedelta(minutes=minutes)  # noqa: E731
    ids = {"state": "sensor.m", "attempted": "sensor.a", "success": "sensor.s"}
    states = {
        "sensor.m": [_St("idle", at(-60)), _St("create_backup", at(0)), _St("idle", at(45)), _St("create_backup", at(600)), _St("idle", at(612)), _St("create_backup", at(1440)), _St("idle", at(1500))],
        # Versuch und Erfolg beim ersten und dritten Lauf; der zweite (von Hand) setzt beides nicht
        "sensor.a": [_St("2026-10-24T03:00:00+00:00", at(-60)), _St("2026-10-25T03:00:00+00:00", at(0)), _St("2026-10-26T03:00:00+00:00", at(1440))],
        "sensor.s": [_St("2026-10-24T03:30:00+00:00", at(-60)), _St("2026-10-25T03:45:00+00:00", at(45)), _St("2026-10-26T04:00:00+00:00", at(1500))],
    }
    runs = backup_alert.runs_from_history(states, ids)
    assert [round(r["secs"] / 60) for r in runs] == [45, 60]


async def test_auto_limit_follows_the_longest_recent_run(hass: HomeAssistant, freezer: Any) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    alert = await _setup(hass)
    assert alert.minutes() == 180 and alert.info() == {"minutes": None, "fallback": 180, "runs": 0}  # zu wenige Läufe: der feste Wert
    for secs in (1800, 3000):
        alert._record(time.time(), secs)
    assert alert.minutes() == 70 and alert.info() == {"minutes": 70, "fallback": 180, "runs": 2}  # 50 Min. plus 20
    ids = _sensors(hass)
    await _start_run(hass, ids, automatic=True)
    await _fire(hass, freezer, 69 * 60)
    assert handy == []
    await _fire(hass, freezer, 2 * 60)
    assert len(handy) == 1 and "1 Std. 10 Min." in handy[0].data["message"]


async def test_fixed_value_when_auto_is_off(hass: HomeAssistant) -> None:
    alert = await _setup(hass, status_backup_auto=False, status_backup_minutes=45)
    for secs in (1800, 3000, 3300):
        alert._record(time.time(), secs)
    assert alert.minutes() == 45


async def test_only_the_last_five_runs_count(hass: HomeAssistant) -> None:
    alert = await _setup(hass)
    for secs in (7200, 600, 600, 600, 600, 600):  # der lange Lauf fällt als sechster zurück heraus
        alert._record(time.time(), secs)
    assert alert.minutes() == 30


async def test_successful_run_is_recorded_and_survives_a_restart(hass: HomeAssistant, freezer: Any) -> None:
    alert = await _setup(hass)
    ids = _sensors(hass)
    await _start_run(hass, ids, automatic=True)
    await _fire(hass, freezer, 20 * 60)
    alert._on_event(_Done())
    await hass.async_block_till_done()
    assert len(alert._runs) == 1 and round(alert._runs[0]["secs"] / 60) == 20
    await alert._store.async_save({"pending": None, "open": None, "runs": alert._runs})
    fresh = backup_alert.BackupAlert(hass)
    await fresh.async_start()
    assert fresh._runs == alert._runs
    await fresh.async_stop()


async def test_late_finish_in_auto_mode_has_no_suggestion(hass: HomeAssistant, freezer: Any) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    alert = await _setup(hass)  # zu wenige Läufe: fest 180 Minuten
    ids = _sensors(hass)
    await _start_run(hass, ids, automatic=True)
    await _fire(hass, freezer, 181 * 60)
    await _fire(hass, freezer, 20 * 60)
    alert._on_event(_Done())
    await hass.async_block_till_done()
    late = [h for h in handy if "doch noch" in h.data["title"]]
    assert len(late) == 1 and "passt sich" in late[0].data["message"] and "stelle sie auf" not in late[0].data["message"]
    assert late[0].data["data"]["url"] == "/config/backup"
