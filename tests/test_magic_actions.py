"""Push-Aktionen in Magic Push (2.218.0): Prüfen, Knöpfe in der Meldung, Routine, Erinnern, Erledigt, Öffnen, Neustart, Sicherheit."""

from __future__ import annotations

import time
from datetime import timedelta
from typing import Any

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_fire_time_changed, async_mock_service

from custom_components.device_panel.const import DATA_MAGIC, DATA_ROUTINES, DOMAIN, MAGIC_ACTION_PREFIX

from .test_magic import _rule, _sensor, _tick
from .test_outage_notify import _device, _options, setup  # noqa: F401, F811
from .test_routines import _raw, _switch, _zurich  # noqa: F401, F811


async def _fire_rule(hass: HomeAssistant, freezer, **extra: Any):
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Lüftung")
    temp = _sensor(hass, device, "temp", "14", "temperature", "°C")
    plug = _switch(hass, device)
    routine = await hass.data[DATA_ROUTINES].async_save_routine(_raw(device, plug, name="Filter-Bestellung", kind="repeat", repeat="daily", time="06:30", delay_s=None))
    actions = [
        {"title": "Filter bestellt", "kind": "routine", "routine_id": routine["id"]},
        {"title": "Morgen nochmals", "kind": "remind", "after": "morning", "at": "07:30"},
        {"title": "Im Panel", "kind": "open", "open": "panel"},
    ]
    rule = await hass.data[DATA_MAGIC].async_save_rule(_rule(device, temp, push_actions=actions, **extra))
    hass.states.async_set(temp, "11", {"device_class": "temperature", "unit_of_measurement": "°C"})
    await _tick(hass, freezer, 601)
    return calls, rule, routine, device, temp


def _tap(hass: HomeAssistant, rule: dict, index: int) -> None:
    hass.bus.async_fire("mobile_app_notification_action", {"action": f"{MAGIC_ACTION_PREFIX}{rule['id']}_{index}"})


async def test_validation(hass: HomeAssistant, setup) -> None:  # noqa: F811
    device = _device(hass, "Lüftung")
    temp = _sensor(hass, device, "temp", "14", "temperature", "°C")
    magic = hass.data[DATA_MAGIC]
    ok = await magic.async_save_rule(_rule(device, temp, push_actions=[{"title": "Später", "kind": "remind"}]))
    assert ok["push_actions"] == [{"title": "Später", "kind": "remind", "routine_id": "", "after": "1h", "open": "panel", "at": "08:00", "undo": "opposite"}]
    # Uhrzeit nur bei "morgen"; ungültige Uhrzeit wird abgelehnt
    morning = await magic.async_save_rule(_rule(device, temp, push_actions=[{"title": "M", "kind": "remind", "after": "morning", "at": "06:45"}, {"title": "S", "kind": "remind", "after": "1h", "at": "06:45"}]))
    assert [a["at"] for a in morning["push_actions"]] == ["06:45", "08:00"]
    with pytest.raises(vol.Invalid):
        await magic.async_save_rule(_rule(device, temp, push_actions=[{"title": "M", "kind": "remind", "after": "morning", "at": "25:99"}]))
    for bad in (
        [{"title": "a", "kind": "done"}] * 4,  # höchstens drei
        [{"title": "", "kind": "done"}],  # Titel fehlt
        [{"title": "x" * 41, "kind": "done"}],  # zu lang
        [{"title": "a", "kind": "alles"}],
        [{"title": "a", "kind": "routine"}],  # Routine fehlt
        [{"title": "a", "kind": "routine", "routine_id": "0123456789ab"}],  # gibt es nicht
        [{"title": "a", "kind": "remind", "after": "nie"}],
    ):
        with pytest.raises(vol.Invalid):
            await magic.async_save_rule(_rule(device, temp, push_actions=bad))
    # ohne Angabe: keine Push-Aktionen
    assert (await magic.async_save_rule(_rule(device, temp)))["push_actions"] == []


async def test_actions_are_in_the_notification_but_not_in_recover(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls, rule, _routine, device, temp = await _fire_rule(hass, freezer, recover=True, recover_message="wieder gut")
    actions = calls[0].data["data"]["actions"]
    assert [a["title"] for a in actions] == ["Filter bestellt", "Morgen nochmals", "Im Panel"]
    assert actions[0]["action"] == f"{MAGIC_ACTION_PREFIX}{rule['id']}_0" and actions[1]["action"] == f"{MAGIC_ACTION_PREFIX}{rule['id']}_1"
    # "Öffnen" braucht keine Rückmeldung: die App öffnet die Adresse selbst
    assert actions[2] == {"action": "URI", "title": "Im Panel", "uri": f"/device-panel?device={device.id}"}
    hass.states.async_set(temp, "13", {"device_class": "temperature", "unit_of_measurement": "°C"})
    await hass.async_block_till_done()
    assert len(calls) == 2 and "actions" not in calls[1].data["data"]


async def test_routine_runs_and_follow_up_says_so(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls, rule, routine, _device_, _temp = await _fire_rule(hass, freezer)
    switch_calls = async_mock_service(hass, "switch", "turn_on")
    _tap(hass, rule, 0)
    await hass.async_block_till_done()
    assert switch_calls, "die Routine wurde nicht ausgeführt"
    assert len(calls) == 2
    assert calls[1].data["title"].startswith("✅") and "Filter-Bestellung" in calls[1].data["message"]
    assert calls[1].data["data"]["tag"] == f"{DOMAIN}_magic_{rule['id']}_action"


async def test_follow_up_when_the_routine_is_gone(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls, rule, routine, _d, _t = await _fire_rule(hass, freezer)
    await hass.data[DATA_ROUTINES].async_delete_routine(routine["id"])
    _tap(hass, rule, 0)
    await hass.async_block_till_done()
    assert len(calls) == 2 and calls[1].data["title"].startswith("⚠️") and "nicht mehr" in calls[1].data["message"]


async def test_remind_sends_again_with_the_current_value(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls, rule, _r, _d, temp = await _fire_rule(hass, freezer, repeat_s=0)
    _tap(hass, rule, 1)  # Morgen nochmals
    await hass.async_block_till_done()
    magic = hass.data[DATA_MAGIC]
    assert rule["id"] in magic._reminders and magic._reminders[rule["id"]] > time.time()
    hass.states.async_set(temp, "10", {"device_class": "temperature", "unit_of_measurement": "°C"})
    await _tick(hass, freezer, 2 * 86400)
    assert len(calls) == 2
    assert calls[1].data["title"] == "⏰ Keller ist kalt: 10 °C"
    assert [a["title"] for a in calls[1].data["data"]["actions"]][0] == "Filter bestellt"
    assert rule["id"] not in magic._reminders


async def test_remind_is_dropped_when_the_value_is_normal_again(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls, rule, _r, _d, temp = await _fire_rule(hass, freezer)
    _tap(hass, rule, 1)
    await hass.async_block_till_done()
    hass.states.async_set(temp, "20", {"device_class": "temperature", "unit_of_measurement": "°C"})
    await _tick(hass, freezer, 86400 + 60)
    assert len(calls) == 1


async def test_remind_survives_a_restart(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls, rule, _r, _d, _t = await _fire_rule(hass, freezer)
    _tap(hass, rule, 1)
    await hass.async_block_till_done()
    magic = hass.data[DATA_MAGIC]
    saved = magic._data()
    assert saved["reminders"][rule["id"]] == magic._reminders[rule["id"]]
    await magic.async_stop()
    magic._reminders = {}
    await magic.async_start()
    assert rule["id"] in magic._reminders and rule["id"] in magic._remind_timers


async def test_done_stops_repeats_until_back_to_normal(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls, rule, _r, _d, temp = await _fire_rule(hass, freezer, repeat_s=3600)
    assert len(calls) == 1
    _tap(hass, rule, 1)  # ein Erinnern vormerken
    _tap(hass, {"id": rule["id"]}, 9)  # unbekannte Nummer: nichts
    await hass.async_block_till_done()
    magic = hass.data[DATA_MAGIC]
    await magic._async_do_action(magic.get(rule["id"]), {"title": "Erledigt", "kind": "done"})
    assert rule["id"] not in magic._reminders
    await _tick(hass, freezer, 3 * 3600)
    assert len(calls) == 1, "keine Wiederholung nach Erledigt"
    # wieder normal und erneut kalt: neue Episode, meldet wieder
    hass.states.async_set(temp, "20", {"device_class": "temperature", "unit_of_measurement": "°C"})
    await hass.async_block_till_done()
    hass.states.async_set(temp, "9", {"device_class": "temperature", "unit_of_measurement": "°C"})
    await _tick(hass, freezer, 601)
    assert len(calls) == 2


async def test_forged_actions_do_nothing(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls, rule, _r, _d, _t = await _fire_rule(hass, freezer)
    switch_calls = async_mock_service(hass, "switch", "turn_on")
    for action in (f"{MAGIC_ACTION_PREFIX}gibtsnicht_0", f"{MAGIC_ACTION_PREFIX}{rule['id']}_7", f"{MAGIC_ACTION_PREFIX}{rule['id']}_x", MAGIC_ACTION_PREFIX, "ANDERE_AKTION"):
        hass.bus.async_fire("mobile_app_notification_action", {"action": action})
    await hass.async_block_till_done()
    assert switch_calls == [] and len(calls) == 1


async def test_deleting_the_rule_drops_its_reminder(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls, rule, _r, _d, _t = await _fire_rule(hass, freezer)
    _tap(hass, rule, 1)
    await hass.async_block_till_done()
    magic = hass.data[DATA_MAGIC]
    await magic.async_delete_rule(rule["id"])
    assert magic._reminders == {} and magic._remind_timers == {}
    await _tick(hass, freezer, 2 * 86400)
    assert len(calls) == 1


async def test_preview_titles_with_variables(hass: HomeAssistant, setup, hass_ws_client) -> None:  # noqa: F811
    device = _device(hass, "Lüftung")
    temp = _sensor(hass, device, "temp", "14.2", "temperature", "°C")
    client = await hass_ws_client(hass)
    draft = _rule(device, temp, push_actions=[{"title": "Jetzt {value}", "kind": "done"}, {"title": "", "kind": "done"}, {"title": "Routine?", "kind": "routine"}])
    await client.send_json({"id": 1, "type": f"{DOMAIN}/magic_preview", "rule": draft, "which": "main"})
    result = (await client.receive_json())["result"]
    # Halb ausgefüllte Einträge (leerer Titel) fehlen; die Routine ohne Auswahl ist in der Vorschau erlaubt
    assert result["actions"] == ["Jetzt 14,2", "Routine?"]
    await client.send_json({"id": 2, "type": f"{DOMAIN}/magic_preview", "rule": draft, "which": "recover"})
    assert (await client.receive_json())["result"]["actions"] == []


async def test_remind_tomorrow_at_the_chosen_time(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    from datetime import datetime

    from homeassistant.util import dt as dt_util

    calls, rule, _r, _d, _t = await _fire_rule(hass, freezer)
    magic = hass.data[DATA_MAGIC]
    at = datetime.fromtimestamp(magic._remind_at("morning", "07:30"), dt_util.get_default_time_zone())
    tomorrow = dt_util.now() + timedelta(days=1)
    assert (at.year, at.month, at.day, at.hour, at.minute) == (tomorrow.year, tomorrow.month, tomorrow.day, 7, 30)
    assert 3500 < magic._remind_at("1h") - time.time() < 3700 and 800 < magic._remind_at("15m") - time.time() < 1000


# --- Rückgängig (2.220.0) ---------------------------------------------------------------


async def _undo_rule(hass: HomeAssistant, freezer, mode: str, **routine_extra: Any):
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Lüftung")
    temp = _sensor(hass, device, "temp", "14", "temperature", "°C")
    plug = _switch(hass, device)
    manager = hass.data[DATA_ROUTINES]
    routine = await manager.async_save_routine(_raw(device, plug, name="Licht", kind="countdown", delay_s=86400, **routine_extra))
    actions = [{"title": "Rückgängig", "kind": "undo", "routine_id": routine["id"], "undo": mode}]
    rule = await hass.data[DATA_MAGIC].async_save_rule(_rule(device, temp, push_actions=actions))
    hass.states.async_set(temp, "11", {"device_class": "temperature", "unit_of_measurement": "°C"})
    await _tick(hass, freezer, 601)
    return calls, rule, routine, manager, plug


async def test_undo_validation(hass: HomeAssistant, setup) -> None:  # noqa: F811
    device = _device(hass, "Lüftung")
    temp = _sensor(hass, device, "temp", "14", "temperature", "°C")
    plug = _switch(hass, device)
    manager = hass.data[DATA_ROUTINES]
    plain = await manager.async_save_routine(_raw(device, plug, name="Ohne", kind="countdown", delay_s=600))
    with_back = await manager.async_save_routine(_raw(device, plug, name="Mit", kind="countdown", delay_s=600, back_s=300))
    toggle = await manager.async_save_routine(_raw(device, plug, name="Toggle", kind="countdown", delay_s=600, action="toggle"))
    magic = hass.data[DATA_MAGIC]

    def one(routine, mode):
        return [{"title": "Zurück", "kind": "undo", "routine_id": routine["id"], "undo": mode}]

    await magic.async_save_rule(_rule(device, temp, push_actions=one(plain, "opposite")))
    await magic.async_save_rule(_rule(device, temp, push_actions=one(with_back, "back")))
    with pytest.raises(vol.Invalid, match="kein Zurückschalten"):
        await magic.async_save_rule(_rule(device, temp, push_actions=one(plain, "back")))
    with pytest.raises(vol.Invalid, match="kein Gegenteil"):
        await magic.async_save_rule(_rule(device, temp, push_actions=one(toggle, "opposite")))
    with pytest.raises(vol.Invalid):
        await magic.async_save_rule(_rule(device, temp, push_actions=[{"title": "x", "kind": "undo", "undo": "opposite"}]))  # Routine fehlt
    with pytest.raises(vol.Invalid):
        await magic.async_save_rule(_rule(device, temp, push_actions=[{"title": "x", "kind": "undo", "routine_id": plain["id"], "undo": "nie"}]))


async def test_undo_opposite_switches_back_and_cancels_the_planned_revert(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls, rule, routine, manager, plug = await _undo_rule(hass, freezer, "opposite", back_s=1800)
    off = async_mock_service(hass, "switch", "turn_off")
    on = async_mock_service(hass, "switch", "turn_on")
    # Die Routine einmal laufen lassen: das Zurückschalten wartet
    await manager.async_run_now(routine["id"])
    assert len(on) == 1 and manager._pending(manager.runtime(routine["id"]))
    _tap(hass, rule, 0)
    await hass.async_block_till_done()
    assert len(off) == 1, "Gegenteil wurde nicht geschaltet"
    assert not manager._pending(manager.runtime(routine["id"])) and manager.runtime(routine["id"])["revert_due"] is None
    assert calls[-1].data["title"].startswith("↩️") and "Licht" in calls[-1].data["message"]
    await _tick(hass, freezer, 3600)
    assert len(off) == 1, "das geplante Zurückschalten schaltete ein zweites Mal"


async def test_undo_back_runs_the_routines_switch_back_now(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls, rule, routine, manager, plug = await _undo_rule(hass, freezer, "back", back_s=1800)
    off = async_mock_service(hass, "switch", "turn_off")
    async_mock_service(hass, "switch", "turn_on")
    await manager.async_run_now(routine["id"])
    _tap(hass, rule, 0)
    await hass.async_block_till_done()
    assert len(off) == 1
    assert not manager._pending(manager.runtime(routine["id"])) and calls[-1].data["title"].startswith("↩️")


async def test_undo_back_without_anything_pending_says_so(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls, rule, routine, manager, plug = await _undo_rule(hass, freezer, "back", back_s=1800)
    off = async_mock_service(hass, "switch", "turn_off")
    _tap(hass, rule, 0)
    await hass.async_block_till_done()
    assert off == []
    assert calls[-1].data["title"].startswith("⚠️") and "nichts zurückzuschalten" in calls[-1].data["message"]


async def test_undo_opposite_refuses_without_an_opposite(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls, rule, routine, manager, plug = await _undo_rule(hass, freezer, "opposite")
    # Die Routine wird nach dem Anlegen der Regel auf "Umschalten" geändert: es gibt kein Gegenteil, nichts wird geschaltet
    await manager.async_save_routine({**manager.get(routine["id"]), "action": "toggle"})
    off = async_mock_service(hass, "switch", "turn_off")
    on = async_mock_service(hass, "switch", "turn_on")
    _tap(hass, rule, 0)
    await hass.async_block_till_done()
    assert off == [] and on == []
    assert calls[-1].data["title"].startswith("⚠️") and "kein Gegenteil" in calls[-1].data["message"]
