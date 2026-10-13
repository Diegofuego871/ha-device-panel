"""Timer (2.21.0): Zeitberechnung, Prüfen, Ausführen, Zurückschalten, Wiederholen, Neustart, Meldung, Befehle."""

from __future__ import annotations

import time
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import async_fire_time_changed, async_mock_service

from custom_components.device_panel import timers
from custom_components.device_panel.const import DATA_TIMERS, DOMAIN

from .test_outage_notify import _device, _options, setup  # noqa: F401  (Fixture "setup")

ZURICH = ZoneInfo("Europe/Zurich")


def _at(year: int, month: int, day: int, hour: int = 0, minute: int = 0) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=ZURICH)


def _timer(**kwargs: Any) -> dict[str, Any]:
    return {"kind": "repeat", "repeat": "daily", "time": "06:30", "weekdays": None, "mday": None, **kwargs}


# -- Zeitberechnung -------------------------------------------------------------------------------


def test_daily_next_occurrence() -> None:
    assert timers.occurrence_after(_timer(), _at(2026, 10, 12, 6, 0), ZURICH) == _at(2026, 10, 12, 6, 30)
    # genau zur Zeit: erst morgen
    assert timers.occurrence_after(_timer(), _at(2026, 10, 12, 6, 30), ZURICH) == _at(2026, 10, 13, 6, 30)


def test_weekly_uses_only_chosen_weekdays() -> None:
    timer = _timer(repeat="weekly", weekdays=[0, 2, 4])  # Mo, Mi, Fr
    # Dienstag, 13.10.2026 -> Mittwoch
    assert timers.occurrence_after(timer, _at(2026, 10, 13, 12, 0), ZURICH) == _at(2026, 10, 14, 6, 30)
    # Freitag nach der Zeit -> Montag
    assert timers.occurrence_after(timer, _at(2026, 10, 16, 7, 0), ZURICH) == _at(2026, 10, 19, 6, 30)


def test_monthly_day_falls_back_to_last_day() -> None:
    timer = _timer(repeat="monthly", mday=31)
    assert timers.occurrence_after(timer, _at(2026, 1, 31, 7, 0), ZURICH) == _at(2026, 2, 28, 6, 30)
    assert timers.occurrence_after(timer, _at(2026, 2, 28, 7, 0), ZURICH) == _at(2026, 3, 31, 6, 30)
    assert timers.occurrence_after(_timer(repeat="monthly", mday=-1), _at(2028, 2, 1), ZURICH) == _at(2028, 2, 29, 6, 30)
    assert timers.occurrence_after(_timer(repeat="monthly", mday=1), _at(2026, 12, 15), ZURICH) == _at(2027, 1, 1, 6, 30)


def test_daylight_saving_keeps_local_time() -> None:
    # Umstellung auf Winterzeit am 25.10.2026: 06:30 bleibt 06:30 Ortszeit
    after = timers.occurrence_after(_timer(), _at(2026, 10, 24, 7, 0), ZURICH)
    assert after == _at(2026, 10, 25, 6, 30) and after.utcoffset() == timedelta(hours=1)
    # Zeit, die es bei der Umstellung auf Sommerzeit nicht gibt (29.3.2026, 02:30): eine Stunde später
    gap = timers.occurrence_after(_timer(time="02:30"), _at(2026, 3, 28, 12, 0), ZURICH)
    assert gap is not None and gap.date().isoformat() == "2026-03-29" and gap.hour == 3


def test_next_runs_preview_lists_three() -> None:
    now = _at(2026, 10, 12, 8, 0).timestamp()
    rows = timers.next_runs(_timer(repeat="weekly", weekdays=[0, 2, 4]), now, ZURICH)
    assert [(r["date"], r["time"], r["weekday"]) for r in rows] == [("2026-10-14", "06:30", 2), ("2026-10-16", "06:30", 4), ("2026-10-19", "06:30", 0)]


def test_next_runs_carry_the_switch_back_time_to_the_minute() -> None:
    now = _at(2026, 10, 12, 8, 0).timestamp()
    # 06:30 + 11 Std. 30 Min. = 18:00, am selben Tag; über Mitternacht in den nächsten Tag
    rows = timers.next_runs(_timer(repeat="weekly", weekdays=[0, 2, 4], back_s=11 * 3600 + 30 * 60), now, ZURICH)
    assert (rows[0]["date"], rows[0]["time"]) == ("2026-10-14", "06:30") and (rows[0]["back"]["date"], rows[0]["back"]["time"]) == ("2026-10-14", "18:00")
    rows = timers.next_runs(_timer(repeat="weekly", weekdays=[0, 2, 4], back_s=20 * 3600 + 45 * 60), now, ZURICH)
    assert (rows[0]["back"]["date"], rows[0]["back"]["time"]) == ("2026-10-15", "03:15")
    # ohne Zurückschalten kein "back"
    assert "back" not in timers.next_runs(_timer(repeat="weekly", weekdays=[0, 2, 4]), now, ZURICH)[0]


# -- Prüfen ---------------------------------------------------------------------------------------


def _switch(hass: HomeAssistant, device: dr.DeviceEntry, key: str = "plug", state: str = "off", domain: str = "switch") -> str:
    entry = er.async_get(hass).async_get_or_create(domain, "test", f"{device.id}-{key}", device_id=device.id, original_name=key)
    hass.states.async_set(entry.entity_id, state)
    return entry.entity_id


def _raw(device: dr.DeviceEntry, entity_id: str, **kwargs: Any) -> dict[str, Any]:
    return {"device_id": device.id, "entity_id": entity_id, "name": "Gartenlicht", "action": "on", "kind": "countdown", "delay_s": 600, **kwargs}


async def _tick(hass: HomeAssistant, freezer, seconds: float) -> None:
    await hass.async_block_till_done()
    freezer.tick(timedelta(seconds=seconds))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()


@pytest.fixture(autouse=True)
async def _zurich(hass: HomeAssistant) -> None:
    await hass.config.async_set_time_zone("Europe/Zurich")
    hass.config.language = "de"


async def test_validation(hass: HomeAssistant, setup) -> None:  # noqa: F811
    manager = hass.data[DATA_TIMERS]
    device, other = _device(hass, "Steckdose"), _device(hass, "Anderes")
    plug = _switch(hass, device)
    foreign = _switch(hass, other, "x")
    lock = _switch(hass, device, "lock", "locked", "lock")
    sensor = _switch(hass, device, "s", "5", "sensor")
    for raw, message in (
        (_raw(device, foreign), "gehört nicht"),
        (_raw(device, sensor), "lässt sich nicht schalten"),
        (_raw(device, lock, action="toggle"), "gibt es für diese Entität nicht"),
        (_raw(device, plug, action="toggle", back_s=60), "nicht zurückschalten"),
        (_raw(device, plug, kind="once", date="2020-01-01", time="10:00"), "Vergangenheit"),
        (_raw(device, plug, kind="once", date="2026-13-40", time="10:00"), "ungültig"),
        (_raw(device, plug, kind="repeat", repeat="weekly", time="06:30", weekdays=[]), "Wochentag"),
        (_raw(device, plug, kind="repeat", repeat="monthly", time="06:30"), "Tag des Monats"),
        (_raw(device, plug, kind="repeat", repeat="daily", time="25:00"), "Uhrzeit ungültig"),
        (_raw(device, plug, delay_s=1), "ganze Zahl"),
        (_raw(device, plug, back_s=5), "Zurückschalten"),
        ({**_raw(device, plug), "device_id": "nichtda"}, "Gerät nicht gefunden"),
    ):
        with pytest.raises(vol.Invalid) as err:
            await manager.async_save_timer(raw)
        assert message in str(err.value), (raw, str(err.value))
    # Name fehlt: der Name der Entität
    saved = await manager.async_save_timer(_raw(device, plug, name=""))
    assert saved["name"] == "plug"


# -- Ausführen ------------------------------------------------------------------------------------


async def test_countdown_runs_once_then_is_done(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    on = async_mock_service(hass, "switch", "turn_on")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    saved = await manager.async_save_timer(_raw(device, plug))
    rt = manager.runtime(saved["id"])
    assert rt["due"] == pytest.approx(time.time() + 600, abs=2)
    await _tick(hass, freezer, 599)
    assert on == []
    await _tick(hass, freezer, 2)
    assert len(on) == 1 and on[0].data["entity_id"] == plug
    payload = timers.timer_payload(hass, manager, manager.get(saved["id"]))
    assert payload["enabled"] is False and payload["done"] is not None and payload["due"] is None
    assert payload["last"]["ok"] is True and payload["running"] is False
    await _tick(hass, freezer, 3600)
    assert len(on) == 1


async def test_repeat_runs_and_advances(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    freezer.move_to(_at(2026, 10, 12, 6, 0))
    off = async_mock_service(hass, "switch", "turn_off")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device, state="on")
    saved = await manager.async_save_timer(_raw(device, plug, action="off", kind="repeat", repeat="daily", time="06:30", delay_s=None))
    assert manager.runtime(saved["id"])["due"] == _at(2026, 10, 12, 6, 30).timestamp()
    await _tick(hass, freezer, 31 * 60)
    assert len(off) == 1
    assert manager.get(saved["id"])["enabled"] is True
    assert manager.runtime(saved["id"])["due"] == _at(2026, 10, 13, 6, 30).timestamp()
    await _tick(hass, freezer, 24 * 3600)
    assert len(off) == 2


async def test_switch_back_after_duration(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    on = async_mock_service(hass, "switch", "turn_on")
    off = async_mock_service(hass, "switch", "turn_off")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    saved = await manager.async_save_timer(_raw(device, plug, delay_s=60, back_s=120))
    await _tick(hass, freezer, 61)
    assert len(on) == 1 and off == []
    rt = manager.runtime(saved["id"])
    assert rt["revert_action"] == "off" and rt["revert_due"] is not None
    # Solange das Zurückschalten aussteht, meldet die Nutzlast "reverting" (Reiter "Läuft", seit 2.26.0), danach nicht mehr
    payload = timers.timer_payload(hass, manager, manager.get(saved["id"]))
    assert payload["reverting"] is True and payload["revert_local"] is not None and payload["running"] is False
    await _tick(hass, freezer, 121)
    assert len(off) == 1 and off[0].data["entity_id"] == plug
    assert manager.runtime(saved["id"])["revert_due"] is None
    assert timers.timer_payload(hass, manager, manager.get(saved["id"]))["reverting"] is False


async def test_unreachable_entity_retries_then_fails(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    on = async_mock_service(hass, "switch", "turn_on")
    handy = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device, state="unavailable")
    saved = await manager.async_save_timer(_raw(device, plug, delay_s=60))
    await _tick(hass, freezer, 61)
    assert on == [] and manager.runtime(saved["id"])["retry"] == 1
    await _tick(hass, freezer, 301)
    assert on == [] and manager.runtime(saved["id"])["retry"] == 2
    await _tick(hass, freezer, 301)
    assert on == [] and len(handy) == 1
    assert "Timer fehlgeschlagen" in handy[0].data["title"] and "nicht erreichbar" in handy[0].data["message"]
    assert manager.runtime(saved["id"])["last"]["what"] == "failed" and manager.get(saved["id"])["enabled"] is False


async def test_retry_succeeds_when_entity_returns(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    on = async_mock_service(hass, "switch", "turn_on")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device, state="unavailable")
    await manager.async_save_timer(_raw(device, plug, delay_s=60))
    await _tick(hass, freezer, 61)
    hass.states.async_set(plug, "off")
    await _tick(hass, freezer, 301)
    assert len(on) == 1


async def test_failure_without_push_follows_option(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    handy = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy", timers_notify_error=False)
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device, state="unavailable")
    await manager.async_save_timer(_raw(device, plug, delay_s=60))
    for seconds in (61, 301, 301):
        await _tick(hass, freezer, seconds)
    assert handy == []


# -- Meldung --------------------------------------------------------------------------------------


async def test_push_goes_to_default_or_own_target(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    async_mock_service(hass, "switch", "turn_on")
    handy = async_mock_service(hass, "notify", "handy")
    familie = async_mock_service(hass, "notify", "familie")
    await _options(hass, notify_service="notify.handy")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose Terrasse")
    plug = _switch(hass, device)
    await manager.async_save_timer(_raw(device, plug, name="Bewässerung", delay_s=60, push=True))
    await manager.async_save_timer(_raw(device, plug, name="Mit Ziel", delay_s=60, push=True, target="notify.familie"))
    await manager.async_save_timer(_raw(device, plug, name="Still", delay_s=60))
    await _tick(hass, freezer, 61)
    assert len(handy) == 1 and len(familie) == 1
    assert handy[0].data["title"] == "⏱️ Timer: Bewässerung"
    assert handy[0].data["message"].startswith("plug ist jetzt ein · ")
    assert familie[0].data["title"] == "⏱️ Timer: Mit Ziel"


async def test_timers_target_overrides_global(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    """Eigenes Ziel der Timer in den Einstellungen: geht vor dem globalen, das Ziel des Timers geht vor beiden."""
    async_mock_service(hass, "switch", "turn_on")
    handy = async_mock_service(hass, "notify", "handy")
    tablet = async_mock_service(hass, "notify", "tablet")
    familie = async_mock_service(hass, "notify", "familie")
    await _options(hass, notify_service="notify.handy", notify_service_timers="notify.tablet")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose Terrasse")
    plug = _switch(hass, device)
    await manager.async_save_timer(_raw(device, plug, name="Standard", delay_s=60, push=True))
    await manager.async_save_timer(_raw(device, plug, name="Mit Ziel", delay_s=60, push=True, target="notify.familie"))
    await _tick(hass, freezer, 61)
    assert len(handy) == 0 and len(tablet) == 1 and len(familie) == 1
    assert tablet[0].data["title"] == "⏱️ Timer: Standard"


async def test_push_texts_for_toggle_and_cover(hass: HomeAssistant, setup) -> None:  # noqa: F811
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Rollo")
    cover = _switch(hass, device, "cover", "open", "cover")
    timer = manager.clean(_raw(device, cover, action="off"))
    assert manager.texts(timer, action="off")[1].startswith("cover ist jetzt geschlossen · ")
    assert manager.texts({**timer, "action": "toggle"}, action="toggle")[1].startswith("cover wurde umgeschaltet · ")


async def test_preview_and_test_send(hass: HomeAssistant, setup) -> None:  # noqa: F811
    handy = async_mock_service(hass, "notify", "handy")
    async_mock_service(hass, "switch", "turn_on")
    await _options(hass, notify_service="notify.handy")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    raw = _raw(device, plug, name="", kind="repeat", repeat="weekly", time="06:30", weekdays=[0, 2, 4], delay_s=None, push=True)
    preview = manager.preview_raw(raw)
    assert preview["title"] == "⏱️ Timer: plug" and preview["target"] == "notify.handy" and len(preview["next_runs"]) == 3
    assert await manager.async_test(raw) is True and len(handy) == 1
    # Testen schaltet nichts und legt nichts an
    assert manager.timers() == []


async def test_no_target_records_and_sends_nothing(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    async_mock_service(hass, "switch", "turn_on")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    await manager.async_save_timer(_raw(device, plug, delay_s=60, push=True))
    await _tick(hass, freezer, 61)
    from custom_components.device_panel import activity

    assert any(e["text"].startswith("Meldung gewünscht") or "no push target" in e["text"] or "kein Push-Ziel" in e["text"] for e in activity.get(hass).entries)


# -- Neustart, Pause, Hand -----------------------------------------------------------------------


async def _restart(hass: HomeAssistant) -> timers.TimerManager:
    await hass.data[DATA_TIMERS].async_stop()
    fresh = timers.TimerManager(hass)
    await fresh.async_start()
    await hass.async_block_till_done()
    hass.data[DATA_TIMERS] = fresh
    await fresh._async_resync()
    return fresh


async def test_countdown_survives_restart(hass: HomeAssistant, setup, freezer, hass_storage: dict[str, Any]) -> None:  # noqa: F811
    on = async_mock_service(hass, "switch", "turn_on")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    await manager.async_save_timer(_raw(device, plug, delay_s=600))
    await _tick(hass, freezer, 300)
    await _restart(hass)
    assert on == []
    await _tick(hass, freezer, 301)
    assert len(on) == 1
    await hass.data[DATA_TIMERS].async_stop()


async def test_missed_during_downtime_is_made_up_within_window(hass: HomeAssistant, setup, freezer, hass_storage: dict[str, Any]) -> None:  # noqa: F811
    on = async_mock_service(hass, "switch", "turn_on")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    await manager.async_save_timer(_raw(device, plug, delay_s=600))
    await manager.async_stop()
    freezer.tick(timedelta(seconds=605))  # 5 Sek. zu spät, Standard: bis 10 Min. nachholen
    await _restart(hass)
    assert len(on) == 1
    await hass.data[DATA_TIMERS].async_stop()


async def test_missed_beyond_window_is_skipped(hass: HomeAssistant, setup, freezer, hass_storage: dict[str, Any]) -> None:  # noqa: F811
    on = async_mock_service(hass, "switch", "turn_on")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    freezer.move_to(_at(2026, 10, 12, 6, 0))
    once = await manager.async_save_timer(_raw(device, plug, delay_s=600))
    daily = await manager.async_save_timer(_raw(device, plug, name="Täglich", kind="repeat", repeat="daily", time="06:30", delay_s=None))
    await manager.async_stop()
    freezer.move_to(_at(2026, 10, 12, 9, 0))  # Stunden später
    fresh = await _restart(hass)
    assert on == []
    assert fresh.runtime(once["id"])["last"]["what"] == "missed" and fresh.get(once["id"])["enabled"] is False
    # der wiederholte Timer überspringt nur diese Ausführung
    assert fresh.runtime(daily["id"])["due"] == _at(2026, 10, 13, 6, 30).timestamp() and fresh.get(daily["id"])["enabled"] is True
    await fresh.async_stop()


async def test_catch_up_off_skips_even_short_delays(hass: HomeAssistant, setup, freezer, hass_storage: dict[str, Any]) -> None:  # noqa: F811
    on = async_mock_service(hass, "switch", "turn_on")
    await _options(hass, timers_catch_up=0)
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    await manager.async_save_timer(_raw(device, plug, delay_s=600))
    await manager.async_stop()
    freezer.tick(timedelta(seconds=840))  # 4 Min. zu spät, Nachholen aus
    await _restart(hass)
    assert on == []
    await hass.data[DATA_TIMERS].async_stop()


async def test_revert_is_made_up_after_restart(hass: HomeAssistant, setup, freezer, hass_storage: dict[str, Any]) -> None:  # noqa: F811
    async_mock_service(hass, "switch", "turn_on")
    off = async_mock_service(hass, "switch", "turn_off")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    await manager.async_save_timer(_raw(device, plug, delay_s=60, back_s=600))
    await _tick(hass, freezer, 61)
    await manager.async_stop()
    freezer.tick(timedelta(hours=3))  # lange nach dem Zurückschalten: trotzdem ausschalten
    await _restart(hass)
    assert len(off) == 1
    await hass.data[DATA_TIMERS].async_stop()


async def test_pause_skips_and_carries_on(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    freezer.move_to(_at(2026, 10, 12, 6, 0))
    on = async_mock_service(hass, "switch", "turn_on")
    await _options(hass, timers_pause=True)
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    saved = await manager.async_save_timer(_raw(device, plug, kind="repeat", repeat="daily", time="06:30", delay_s=None))
    await _tick(hass, freezer, 31 * 60)
    assert on == [] and manager.runtime(saved["id"])["last"]["what"] == "paused"
    await _options(hass, timers_pause=False)
    await _tick(hass, freezer, 24 * 3600)
    assert len(on) == 1


async def test_run_now_keeps_the_schedule(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    freezer.move_to(_at(2026, 10, 12, 6, 0))
    on = async_mock_service(hass, "switch", "turn_on")
    off = async_mock_service(hass, "switch", "turn_off")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    saved = await manager.async_save_timer(_raw(device, plug, kind="repeat", repeat="daily", time="06:30", delay_s=None, back_s=300))
    due = manager.runtime(saved["id"])["due"]
    assert await manager.async_run_now(saved["id"]) == (True, None)
    assert len(on) == 1 and manager.runtime(saved["id"])["due"] == due
    await _tick(hass, freezer, 301)
    assert len(off) == 1
    assert await manager.async_run_now("0" * 12) is None


async def test_enable_disable_and_restart_of_done_timer(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    on = async_mock_service(hass, "switch", "turn_on")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    saved = await manager.async_save_timer(_raw(device, plug, delay_s=60))
    await manager.async_set_enabled(saved["id"], False)
    assert manager.runtime(saved["id"])["due"] is None
    await _tick(hass, freezer, 120)
    assert on == []
    await manager.async_set_enabled(saved["id"], True)
    await _tick(hass, freezer, 61)
    assert len(on) == 1 and manager.get(saved["id"])["enabled"] is False
    # "Erneut starten"
    await manager.async_set_enabled(saved["id"], True)
    await _tick(hass, freezer, 61)
    assert len(on) == 2
    # ein einmaliger Timer in der Vergangenheit lässt sich nicht erneut starten
    once = await manager.async_save_timer(_raw(device, plug, name="Einmal", kind="once", date=(datetime.now(ZURICH) + timedelta(days=1)).strftime("%Y-%m-%d"), time="10:00", delay_s=None))
    freezer.tick(timedelta(days=3))
    await manager._async_resync()
    with pytest.raises(vol.Invalid):
        await manager.async_set_enabled(once["id"], True)


async def test_done_countdown_cleans_up_after_a_day(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    async_mock_service(hass, "switch", "turn_on")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    await manager.async_save_timer(_raw(device, plug, delay_s=60))
    once = await manager.async_save_timer(_raw(device, plug, name="Einmal", kind="once", date=(datetime.now(ZURICH) + timedelta(hours=2)).strftime("%Y-%m-%d"), time=(datetime.now(ZURICH) + timedelta(hours=2)).strftime("%H:%M"), delay_s=None))
    await _tick(hass, freezer, 61)
    assert len(manager.timers()) == 2
    await _tick(hass, freezer, 86400 + 10)
    assert [t["id"] for t in manager.timers()] == [once["id"]]


async def test_device_removal_takes_timers_along(hass: HomeAssistant, setup) -> None:  # noqa: F811
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    await manager.async_save_timer(_raw(device, plug))
    dr.async_get(hass).async_remove_device(device.id)
    await hass.async_block_till_done()
    assert manager.timers() == []


async def test_limits(hass: HomeAssistant, setup, monkeypatch) -> None:  # noqa: F811
    monkeypatch.setattr(timers, "MAX_PER_DEVICE", 2)
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    for n in range(2):
        await manager.async_save_timer(_raw(device, plug, name=f"T{n}"))
    with pytest.raises(vol.Invalid, match="pro Gerät"):
        await manager.async_save_timer(_raw(device, plug, name="zu viel"))


# -- Befehle --------------------------------------------------------------------------------------


async def test_websocket_commands(hass: HomeAssistant, setup, hass_ws_client) -> None:  # noqa: F811
    on = async_mock_service(hass, "switch", "turn_on")
    async_mock_service(hass, "notify", "handy")
    async_mock_service(hass, "notify", "familie")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Steckdose Terrasse")
    plug = _switch(hass, device)
    _switch(hass, device, "diag", "5", "sensor")
    client = await hass_ws_client(hass)

    async def call(command: str, **payload: Any) -> dict[str, Any]:
        call.n += 1
        await client.send_json({"id": call.n, "type": f"{DOMAIN}/{command}", **payload})
        return await client.receive_json()

    call.n = 0
    got = (await call("timer_get", device_id=device.id))["result"]
    assert got["timers"] == [] and got["default_target"] == "notify.handy"
    # nur schaltbare Entitäten dieses Geräts
    assert [e["entity_id"] for e in got["entities"]] == [plug] and got["entities"][0]["actions"] == ["on", "off", "toggle"]
    assert {t["value"] for t in got["targets"]} >= {"notify.handy", "notify.familie"}
    assert not (await call("timer_get", device_id="nichtda"))["success"]

    preview = await call("timer_preview", timer=_raw(device, plug, kind="once", date=(datetime.now(ZURICH) + timedelta(days=2)).strftime("%Y-%m-%d"), time="17:00", delay_s=None))
    assert preview["success"] and preview["result"]["title"] == "⏱️ Timer: Gartenlicht" and len(preview["result"]["next_runs"]) == 1
    assert (await call("timer_test", timer=_raw(device, plug, push=True)))["result"] == {"sent": True}

    saved = await call("timer_save", timer=_raw(device, plug, push=True, target="notify.familie"))
    assert saved["success"]
    timer_id = saved["result"]["timer"]["id"]
    assert saved["result"]["timer"]["entity_name"] == "plug" and saved["result"]["timer"]["running"] is True
    bad = await call("timer_save", timer={**_raw(device, plug), "delay_s": None})
    assert not bad["success"] and bad["error"]["code"] == "invalid_format"
    assert (await call("timer_list"))["result"]["timers"][0]["device_name"] == "Steckdose Terrasse"
    assert (await call("timer_get", device_id=device.id))["result"]["timers"][0]["id"] == timer_id

    disabled = await call("timer_enable", timer_id=timer_id, enabled=False)
    assert disabled["result"]["timer"]["enabled"] is False and disabled["result"]["timer"]["due"] is None
    ran = await call("timer_run", timer_id=timer_id)
    assert ran["result"]["ok"] is True and len(on) == 1
    assert not (await call("timer_run", timer_id="0" * 12))["success"]
    assert (await call("timer_delete", timer_id=timer_id))["success"]
    assert not (await call("timer_delete", timer_id=timer_id))["success"]
    assert (await call("timer_list"))["result"]["timers"] == []


async def test_non_admin_is_refused(hass: HomeAssistant, setup, hass_ws_client, hass_admin_user) -> None:  # noqa: F811
    hass_admin_user.groups = []
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/timer_list"})
    assert (await client.receive_json())["success"] is False


# -- Einmalig ohne Datum (seit 2.22.0) ------------------------------------------------------------


def test_once_without_date_is_next_time_of_day() -> None:
    timer = {"kind": "once", "date": None, "time": "06:30", "delay_s": None}
    morning = _at(2026, 10, 12, 6, 0)
    now = morning.timestamp()
    # Uhrzeit liegt noch vor uns: heute
    assert timers.first_due(timer, now, ZURICH) == _at(2026, 10, 12, 6, 30).timestamp()
    # schon vorbei: morgen
    late = _at(2026, 10, 12, 7, 0).timestamp()
    assert timers.first_due(timer, late, ZURICH) == _at(2026, 10, 13, 6, 30).timestamp()
    # genau zur Zeit: erst morgen
    assert timers.first_due(timer, _at(2026, 10, 12, 6, 30).timestamp(), ZURICH) == _at(2026, 10, 13, 6, 30).timestamp()
    # Vorschau: genau ein Eintrag (nicht wiederholt)
    runs = timers.next_runs(timer, late, ZURICH)
    assert [(r["date"], r["time"]) for r in runs] == [("2026-10-13", "06:30")]


async def test_once_without_date_runs_once_then_is_disabled(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls = async_mock_service(hass, "switch", "turn_on")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    now = datetime.now(ZURICH)
    # Eine Minute später als jetzt (Uhrzeit ohne Datum)
    target = (now + timedelta(minutes=1)).strftime("%H:%M")
    saved = await manager.async_save_timer(_raw(device, plug, kind="once", date="", time=target, delay_s=None))
    assert saved["date"] is None and saved["enabled"] is True
    due = manager.runtime(saved["id"])["due"]
    assert due is not None and 0 < due - time.time() <= 3600 * 24
    freezer.move_to(datetime.fromtimestamp(due + 5, ZURICH))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert len(calls) == 1
    # danach aus; Einschalten plant das nächste Eintreffen der Uhrzeit (kein Fehler "Vergangenheit")
    assert manager.get(saved["id"])["enabled"] is False and manager.runtime(saved["id"])["due"] is None
    again = await manager.async_set_enabled(saved["id"], True)
    assert again["enabled"] is True and manager.runtime(saved["id"])["due"] > time.time()


async def test_once_requires_time_but_not_date(hass: HomeAssistant, setup) -> None:  # noqa: F811
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    with pytest.raises(vol.Invalid, match="Uhrzeit"):
        await manager.async_save_timer(_raw(device, plug, kind="once", date=None, time=None, delay_s=None))


async def test_switchable_devices_lists_only_switchable(hass: HomeAssistant, setup) -> None:  # noqa: F811
    """"Timer hinzufügen" (2.27.0): nur Geräte mit schaltbarer, aktiver, sichtbarer Entität, nach Name sortiert."""
    ent = er.async_get(hass)
    dev_b = _device(hass, "Zeta Steckdose")
    dev_a = _device(hass, "Alpha Lampe")
    dev_s = _device(hass, "Nur Sensor")
    ent.async_get_or_create("switch", "t", "b1", device_id=dev_b.id)
    ent.async_get_or_create("light", "t", "a1", device_id=dev_a.id)
    ent.async_get_or_create("light", "t", "a2", device_id=dev_a.id)
    ent.async_get_or_create("sensor", "t", "s1", device_id=dev_s.id)
    out = timers.switchable_devices(hass)
    assert [(d["name"], d["entities"]) for d in out] == [("Alpha Lampe", 2), ("Zeta Steckdose", 1)]


async def test_try_switches_once_without_timer_or_log(hass: HomeAssistant, setup) -> None:  # noqa: F811
    """Testknopf (2.28.0): schaltet sofort, speichert nichts, plant kein Zurückschalten; ungültige Aktion und fehlende Entität werden abgelehnt."""
    manager = hass.data[DATA_TIMERS]
    calls = async_mock_service(hass, "switch", "turn_off")
    hass.states.async_set("switch.plug", "on")
    assert await manager.async_try("switch.plug", "off") == (True, None)
    assert len(calls) == 1 and calls[0].data["entity_id"] == "switch.plug"
    assert manager.timers() == []
    assert await manager.async_try("switch.gone", "off") == (False, "missing")
    hass.states.async_set("switch.plug", "unavailable")
    assert await manager.async_try("switch.plug", "off") == (False, "unavailable")
    with pytest.raises(vol.Invalid):
        await manager.async_try("switch.plug", "open")
    with pytest.raises(vol.Invalid):
        await manager.async_try("sensor.temp", "off")


async def test_log_and_debug_survive_reload(hass: HomeAssistant, setup) -> None:  # noqa: F811
    """Jedes Speichern der Einstellungen lädt die Integration neu: Debug-Schalter und Protokoll müssen das überstehen (2.28.2)."""
    from custom_components.device_panel import activity

    entry = hass.config_entries.async_entries(DOMAIN)[0]
    activity.set_debug(hass, True)
    activity.record(hass, "debug", "timer", "timer_test", "Vorher")
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    snap = activity.snapshot(hass)
    assert snap["debug"] is True
    assert any(e["title"] == "Vorher" for e in snap["entries"])
    # Entfernen der Integration räumt das Protokoll weg
    assert await hass.config_entries.async_remove(entry.entry_id) is not None
    await hass.async_block_till_done()
    assert activity.snapshot(hass)["debug"] is False


async def test_debug_log_shows_next_run(hass: HomeAssistant, setup) -> None:  # noqa: F811
    """Debug-Protokoll (2.29.0): der geplante nächste Lauf eines Timers steht drin, nur bei eingeschaltetem Schalter."""
    from custom_components.device_panel import activity

    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    await manager.async_save_timer(_raw(device, plug))
    assert not [e for e in activity.snapshot(hass)["entries"] if e["level"] == "debug"]
    activity.set_debug(hass, True)
    await manager.async_save_timer({**_raw(device, plug), "name": "Zweiter"})
    entries = [e for e in activity.snapshot(hass)["entries"] if e["level"] == "debug" and e["cat"] == "timer"]
    assert entries and entries[-1]["title"] == "Zweiter" and ("nächster Lauf" in entries[-1]["text"] or "next run" in entries[-1]["text"])
