"""Routine mit Auslöser (2.54.0): Eintreten, Zeitfenster, Pause, Dauer, Und/Oder, Zurückschalten durch Zeit oder Auslöser, Neustart."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_mock_service

from custom_components.device_panel import routines
from custom_components.device_panel.const import DATA_ROUTINES

from .test_outage_notify import _device, setup  # noqa: F401  (Fixture "setup")
from .test_routines import _raw, _restart, _switch, _tick, _zurich  # noqa: F401  (Fixture "_zurich")

ZURICH = ZoneInfo("Europe/Zurich")
MOTION = "binary_sensor.motion"
DOOR = "binary_sensor.door"
LUX = "sensor.lux"


def _at(hour: int, minute: int = 0, day: int = 12) -> datetime:
    return datetime(2026, 10, day, hour, minute, tzinfo=ZURICH)


def _is(entity_id: str, value: str = "on") -> dict[str, Any]:
    return {"entity_id": entity_id, "kind": "is", "value": value}


def _tree(*items: dict[str, Any], op: str = "and") -> dict[str, Any]:
    return {"op": op, "items": list(items)}


def _trig(device, entity, **kwargs: Any) -> dict[str, Any]:
    base = {"kind": "trigger", "delay_s": None, "conditions": _tree(_is(MOTION)), "name": "Auslöser"}
    return _raw(device, entity, **{**base, **kwargs})


async def _set(hass: HomeAssistant, entity_id: str, value: str) -> None:
    hass.states.async_set(entity_id, value)
    await hass.async_block_till_done()


@pytest.fixture(autouse=True)
def _no_gap(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(routines, "CALL_GAP_S", 0)


@pytest.fixture
async def rig(hass: HomeAssistant, setup):  # noqa: F811
    """Gerät mit Steckdose, dazu Bewegungsmelder, Tür und Helligkeit im Ausgangszustand."""
    await _set(hass, MOTION, "off")
    await _set(hass, DOOR, "off")
    await _set(hass, LUX, "50")
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    return hass.data[DATA_ROUTINES], device, plug


# -- Prüfen -----------------------------------------------------------------------------------------


async def test_validation(hass: HomeAssistant, rig) -> None:
    manager, device, plug = rig
    for raw, message in (
        (_trig(device, plug, conditions=None), "Bedingungen fehlen"),
        (_trig(device, plug, conditions=_tree(_is("binary_sensor.gibtsnicht"))), "Entität gibt es nicht"),
        (_trig(device, plug, conditions=_tree(_is(plug, "on"))), "nicht ihr eigener Auslöser"),
        (_trig(device, plug, back_s=None, back_kind="trigger", back_conditions=_tree(_is(plug))), "nicht ihr eigener Auslöser"),
        (_trig(device, plug, window={"from": "22:00", "to": "22:00"}), "keine Dauer"),
        (_trig(device, plug, window={"from": "25:00", "to": "06:00"}), "Zeitfenster ungültig"),
        (_trig(device, plug, pause_s=1), "Pause"),
        (_trig(device, plug, hold_s=-5), "less than or equal|greater than or equal|value must be at least"),
        (_trig(device, plug, action="toggle", back_kind="duration", back_s=600), "nicht zurückschalten"),
        (_trig(device, plug, back_kind="time"), "Uhrzeit fehlt"),
        (_trig(device, plug, back_kind="trigger"), "Bedingungen fehlen"),
        (_trig(device, plug, back_kind="duration"), "Dauer fehlt"),
        (_trig(device, plug, back_kind="trigger", back_conditions=_tree(_is(DOOR)), back_max_s=1), "Spätestens nach"),
        (_trig(device, plug, conditions=_tree({"entity_id": MOTION, "kind": "change"}, _is(DOOR))), "nur als einzige Bedingung"),
    ):
        with pytest.raises(vol.Invalid) as err:
            await manager.async_save_routine(raw)
        assert any(part in str(err.value) for part in message.split("|")), (raw, str(err.value))
    saved = await manager.async_save_routine(_trig(device, plug, conditions=_tree({"entity_id": MOTION, "kind": "change"})))
    assert saved["conditions"]["items"][0]["kind"] == "change" and saved["pause_s"] == routines.PAUSE_DEFAULT
    assert (await manager.async_save_routine(_trig(device, plug, window={"from": "22:00", "to": "06:00"})))["window"] == {"from": "22:00", "to": "06:00"}


def test_window_and_normalize() -> None:
    night = {"from": "22:00", "to": "06:00"}
    for hour, minute, want in ((21, 59, False), (22, 0, True), (23, 59, True), (0, 0, True), (5, 59, True), (6, 0, False), (12, 0, False)):
        assert routines.in_window(night, _at(hour, minute)) is want, (hour, minute)
    day = {"from": "08:00", "to": "18:30"}
    assert routines.in_window(day, _at(8, 0)) and routines.in_window(day, _at(18, 29)) and not routines.in_window(day, _at(18, 30)) and not routines.in_window(day, _at(7, 59))
    assert routines.in_window(None, _at(3, 0))
    # Altes Routinen-Format: back_s ohne back_kind gilt als "Nach Dauer"
    assert routines.normalize_back({"back_s": 600, "back_kind": None})["back_kind"] == "duration"
    assert routines.normalize_back({"back_s": None, "back_kind": None})["back_kind"] == "none"


# -- Auslösen -----------------------------------------------------------------------------------------


async def test_fires_only_when_condition_newly_enters(hass: HomeAssistant, rig, freezer) -> None:
    on = async_mock_service(hass, "switch", "turn_on")
    manager, device, plug = rig
    await manager.async_save_routine(_trig(device, plug))
    await _set(hass, MOTION, "on")
    await _tick(hass, freezer, 1)
    assert len(on) == 1 and on[0].data["entity_id"] == plug
    # Gilt weiter: kein zweites Mal. Erst nach "aus" und wieder "an" und nach der Pause.
    await _set(hass, DOOR, "on")
    assert len(on) == 1
    await _set(hass, MOTION, "off")
    await _tick(hass, freezer, 61)
    await _set(hass, MOTION, "on")
    await _tick(hass, freezer, 1)
    assert len(on) == 2
    # Die Routine bleibt aktiv (kein "erledigt")
    assert manager.get(manager.routines()[0]["id"])["enabled"] is True


async def test_already_met_when_saved_does_not_fire(hass: HomeAssistant, rig, freezer) -> None:
    on = async_mock_service(hass, "switch", "turn_on")
    manager, device, plug = rig
    await _set(hass, MOTION, "on")
    await manager.async_save_routine(_trig(device, plug))
    await _tick(hass, freezer, 5)
    assert on == []
    await _set(hass, MOTION, "off")
    await _set(hass, MOTION, "on")
    await _tick(hass, freezer, 1)
    assert len(on) == 1


async def test_restart_does_not_fire_for_a_condition_that_already_holds(hass: HomeAssistant, rig, freezer, hass_storage: dict[str, Any]) -> None:
    on = async_mock_service(hass, "switch", "turn_on")
    manager, device, plug = rig
    await manager.async_save_routine(_trig(device, plug))
    await _set(hass, MOTION, "on")
    await _tick(hass, freezer, 1)
    assert len(on) == 1
    manager = await _restart(hass)
    await _tick(hass, freezer, 120)
    assert len(on) == 1
    await _set(hass, MOTION, "off")
    await _set(hass, MOTION, "on")
    await _tick(hass, freezer, 1)
    assert len(on) == 2
    assert manager.routines()[0]["kind"] == "trigger"


async def test_disabled_routine_does_not_fire(hass: HomeAssistant, rig, freezer) -> None:
    on = async_mock_service(hass, "switch", "turn_on")
    manager, device, plug = rig
    saved = await manager.async_save_routine(_trig(device, plug, enabled=False))
    await _set(hass, MOTION, "on")
    await _tick(hass, freezer, 5)
    assert on == []
    await manager.async_set_enabled(saved["id"], True)
    await _set(hass, MOTION, "off")
    await _set(hass, MOTION, "on")
    await _tick(hass, freezer, 1)
    assert len(on) == 1


async def test_and_or_conditions(hass: HomeAssistant, rig, freezer) -> None:
    on = async_mock_service(hass, "switch", "turn_on")
    manager, device, plug = rig
    dark = {"entity_id": LUX, "kind": "below", "value": 20}
    await manager.async_save_routine(_trig(device, plug, name="Und", conditions=_tree(_is(MOTION), dark)))
    await _set(hass, MOTION, "on")
    await _tick(hass, freezer, 1)
    assert on == []  # noch hell
    await _set(hass, LUX, "10")
    await _tick(hass, freezer, 1)
    assert len(on) == 1  # beide gelten: die Bedingung ist neu eingetreten
    for sensor, value in ((MOTION, "off"), (LUX, "50")):
        await _set(hass, sensor, value)
    await _tick(hass, freezer, 61)
    # Oder: eine genügt; eine Gruppe (Tür oder dunkel) und Bewegung
    manager2 = manager
    await manager2.async_delete_routine(manager.routines()[0]["id"])
    on.clear()
    await manager2.async_save_routine(_trig(device, plug, name="Oder", conditions=_tree(_is(MOTION), _is(DOOR), op="or")))
    await _set(hass, DOOR, "on")
    await _tick(hass, freezer, 1)
    assert len(on) == 1


async def test_change_fires_on_every_state_change(hass: HomeAssistant, rig, freezer) -> None:
    on = async_mock_service(hass, "switch", "turn_on")
    manager, device, plug = rig
    await manager.async_save_routine(_trig(device, plug, conditions=_tree({"entity_id": LUX, "kind": "change"}), pause_s=10))
    await _set(hass, LUX, "51")
    await _tick(hass, freezer, 11)
    await _set(hass, LUX, "52")
    await _tick(hass, freezer, 1)
    assert len(on) == 2
    # Nur ein Attribut geändert: kein Wechsel
    hass.states.async_set(LUX, "52", {"unit_of_measurement": "lx"})
    await hass.async_block_till_done()
    await _tick(hass, freezer, 11)
    assert len(on) == 2
    # Nicht erreichbar zählt nicht
    await _set(hass, LUX, "unavailable")
    await _set(hass, LUX, "53")
    await _tick(hass, freezer, 1)
    assert len(on) == 2


async def test_hold_time(hass: HomeAssistant, rig, freezer) -> None:
    on = async_mock_service(hass, "switch", "turn_on")
    manager, device, plug = rig
    await manager.async_save_routine(_trig(device, plug, hold_s=120))
    await _set(hass, MOTION, "on")
    await _tick(hass, freezer, 119)
    assert on == []
    await _tick(hass, freezer, 2)
    assert len(on) == 1
    # Vorher beendet: kein Auslösen
    await _set(hass, MOTION, "off")
    await _tick(hass, freezer, 61)
    await _set(hass, MOTION, "on")
    await _tick(hass, freezer, 60)
    await _set(hass, MOTION, "off")
    await _tick(hass, freezer, 300)
    assert len(on) == 1


async def test_window_skips_outside_and_does_not_postpone(hass: HomeAssistant, rig, freezer) -> None:
    on = async_mock_service(hass, "switch", "turn_on")
    manager, device, plug = rig
    freezer.move_to(_at(12, 0))
    await manager.async_save_routine(_trig(device, plug, window={"from": "22:00", "to": "06:00"}))
    await _set(hass, MOTION, "on")
    await _tick(hass, freezer, 1)
    assert on == []
    # Das Fenster beginnt, die Bedingung gilt schon: nichts (nicht verschoben)
    freezer.move_to(_at(22, 5))
    await _tick(hass, freezer, 1)
    assert on == []
    await _set(hass, MOTION, "off")
    await _set(hass, MOTION, "on")
    await _tick(hass, freezer, 1)
    assert len(on) == 1


async def test_minimum_pause(hass: HomeAssistant, rig, freezer) -> None:
    on = async_mock_service(hass, "switch", "turn_on")
    manager, device, plug = rig
    await manager.async_save_routine(_trig(device, plug, pause_s=300))
    for _ in range(3):
        await _set(hass, MOTION, "on")
        await _tick(hass, freezer, 1)
        await _set(hass, MOTION, "off")
        await _tick(hass, freezer, 10)
    assert len(on) == 1
    await _tick(hass, freezer, 300)
    await _set(hass, MOTION, "on")
    await _tick(hass, freezer, 1)
    assert len(on) == 2


async def test_once_trigger_switches_itself_off(hass: HomeAssistant, rig, freezer) -> None:
    on = async_mock_service(hass, "switch", "turn_on")
    manager, device, plug = rig
    saved = await manager.async_save_routine(_trig(device, plug, once_trigger=True))
    await _set(hass, MOTION, "on")
    await _tick(hass, freezer, 1)
    assert len(on) == 1 and manager.get(saved["id"])["enabled"] is False
    payload = routines.routine_payload(hass, manager, manager.get(saved["id"]))
    assert payload["done"] is not None and payload["next_runs"] == []
    await _set(hass, MOTION, "off")
    await _tick(hass, freezer, 61)
    await _set(hass, MOTION, "on")
    await _tick(hass, freezer, 1)
    assert len(on) == 1


# -- Zurückschalten -----------------------------------------------------------------------------------


async def test_trigger_then_duration_and_busy(hass: HomeAssistant, rig, freezer) -> None:
    on = async_mock_service(hass, "switch", "turn_on")
    off = async_mock_service(hass, "switch", "turn_off")
    manager, device, plug = rig
    await manager.async_save_routine(_trig(device, plug, back_kind="duration", back_s=600))
    await _set(hass, MOTION, "on")
    await _tick(hass, freezer, 1)
    await _set(hass, MOTION, "off")
    await _tick(hass, freezer, 61)
    await _set(hass, MOTION, "on")
    await _tick(hass, freezer, 1)
    assert len(on) == 1  # wartet noch auf das Zurückschalten: übergangen
    await _tick(hass, freezer, 600)
    assert len(off) == 1


async def test_back_by_time_uses_next_clock_time(hass: HomeAssistant, rig, freezer) -> None:
    async_mock_service(hass, "switch", "turn_on")
    off = async_mock_service(hass, "switch", "turn_off")
    manager, device, plug = rig
    saved = await manager.async_save_routine(_trig(device, plug, back_kind="time", back_time="23:30"))
    freezer.move_to(_at(20, 0))
    await _set(hass, MOTION, "on")
    await _tick(hass, freezer, 1)
    assert manager.runtime(saved["id"])["revert_due"] == _at(23, 30).timestamp()
    await _tick(hass, freezer, 3 * 3600 + 30 * 60)
    assert len(off) == 1
    # Nach 23:30 eingeschaltet: morgen
    await _set(hass, MOTION, "off")
    freezer.move_to(_at(23, 45))
    await _tick(hass, freezer, 1)
    await _set(hass, MOTION, "on")
    await _tick(hass, freezer, 1)
    assert manager.runtime(saved["id"])["revert_due"] == _at(23, 30, 13).timestamp()


async def test_time_start_with_trigger_end(hass: HomeAssistant, rig, freezer) -> None:
    on = async_mock_service(hass, "switch", "turn_on")
    off = async_mock_service(hass, "switch", "turn_off")
    manager, device, plug = rig
    raw = _raw(device, plug, name="Terrasse", delay_s=60, back_kind="trigger", back_conditions=_tree(_is(DOOR)), back_max_s=3600)
    saved = await manager.async_save_routine(raw)
    await _tick(hass, freezer, 61)
    assert len(on) == 1 and manager.runtime(saved["id"])["revert_action"] == "off"
    payload = routines.routine_payload(hass, manager, manager.get(saved["id"]))
    assert payload["waiting_end"] is True and payload["reverting"] is True and payload["back_condition_text"]
    assert DOOR in payload["condition_entities"]
    await _set(hass, DOOR, "on")
    await _tick(hass, freezer, 1)
    assert len(off) == 1 and manager.runtime(saved["id"])["revert_action"] is None
    assert manager._end_met == {} and manager._tracked == frozenset()


async def test_end_condition_already_met_waits_for_next_entry(hass: HomeAssistant, rig, freezer) -> None:
    async_mock_service(hass, "switch", "turn_on")
    off = async_mock_service(hass, "switch", "turn_off")
    manager, device, plug = rig
    await _set(hass, DOOR, "on")
    saved = await manager.async_save_routine(_raw(device, plug, delay_s=60, back_kind="trigger", back_conditions=_tree(_is(DOOR))))
    await _tick(hass, freezer, 61)
    await _tick(hass, freezer, 600)
    assert off == []
    await _set(hass, DOOR, "off")
    await _set(hass, DOOR, "on")
    await _tick(hass, freezer, 1)
    assert len(off) == 1 and manager.runtime(saved["id"])["revert_action"] is None


async def test_end_trigger_safety_limit(hass: HomeAssistant, rig, freezer) -> None:
    async_mock_service(hass, "switch", "turn_on")
    off = async_mock_service(hass, "switch", "turn_off")
    manager, device, plug = rig
    await manager.async_save_routine(_raw(device, plug, delay_s=60, back_kind="trigger", back_conditions=_tree(_is(DOOR)), back_max_s=1800))
    await _tick(hass, freezer, 61)
    await _tick(hass, freezer, 1700)
    assert off == []
    await _tick(hass, freezer, 150)
    assert len(off) == 1


async def test_trigger_start_and_trigger_end_with_hold_and_restore(hass: HomeAssistant, rig, freezer) -> None:
    """Bewegung ein, aus nach 5 Minuten ohne Bewegung, danach wie vorher."""
    on = async_mock_service(hass, "switch", "turn_on")
    off = async_mock_service(hass, "switch", "turn_off")
    manager, device, plug = rig
    await _set(hass, plug, "off")
    saved = await manager.async_save_routine(
        _trig(device, plug, back_kind="trigger", back_conditions=_tree(_is(MOTION, "off")), back_hold_s=300, back_mode="restore", back_max_s=7200)
    )
    await _set(hass, MOTION, "on")
    await _tick(hass, freezer, 1)
    assert len(on) == 1 and manager.runtime(saved["id"])["snapshot"]["state"] == "off"
    await _set(hass, MOTION, "off")  # tritt NEU ein (Bewegung war an)
    await _tick(hass, freezer, 299)
    assert off == []
    await _set(hass, MOTION, "on")  # Unterbrechung: die Zeit läuft von vorn
    await _tick(hass, freezer, 200)
    await _set(hass, MOTION, "off")
    await _tick(hass, freezer, 301)
    # Der Zustand vorher war "aus": die Szene stellt es wieder aus
    assert len(off) == 1 and manager.runtime(saved["id"])["revert_action"] is None


async def test_waiting_end_survives_restart(hass: HomeAssistant, rig, freezer, hass_storage: dict[str, Any]) -> None:
    async_mock_service(hass, "switch", "turn_on")
    off = async_mock_service(hass, "switch", "turn_off")
    manager, device, plug = rig
    saved = await manager.async_save_routine(_raw(device, plug, delay_s=60, back_kind="trigger", back_conditions=_tree(_is(DOOR)), back_max_s=3600))
    await _tick(hass, freezer, 61)
    manager = await _restart(hass)
    assert manager.runtime(saved["id"])["revert_action"] == "off" and manager._tracked == frozenset({DOOR})
    await _set(hass, DOOR, "on")
    await _tick(hass, freezer, 1)
    assert len(off) == 1


async def test_preview_and_payload(hass: HomeAssistant, rig) -> None:
    manager, device, plug = rig
    preview = manager.preview_raw(_trig(device, plug, name=""))
    assert preview["next_runs"] == [] and preview["name"]
    saved = await manager.async_save_routine(_trig(device, plug, conditions=_tree(_is(MOTION), {"entity_id": LUX, "kind": "below", "value": 20})))
    payload = routines.routine_payload(hass, manager, manager.get(saved["id"]))
    assert payload["condition_text"] and set(payload["condition_entities"]) == {MOTION, LUX}
    assert payload["due"] is None and payload["next_runs"] == [] and payload["waiting_end"] is False
    # Zeit-Routine mit Uhrzeit-Rückschalten: die Vorschau nennt den Zeitpunkt
    runs = routines.next_runs({"kind": "repeat", "repeat": "daily", "time": "20:00", "weekdays": None, "mday": None, "back_kind": "time", "back_time": "23:30"}, _at(12, 0).timestamp(), ZURICH)
    assert runs[0]["back"]["time"] == "23:30" and runs[0]["back"]["date"] == "2026-10-12"


async def test_old_routines_load_with_derived_back_kind(hass: HomeAssistant, rig) -> None:
    manager, device, plug = rig
    raw = {"id": "0123456789ab", "device_id": device.id, "entity_id": plug, "name": "Alt", "action": "on", "kind": "countdown", "delay_s": 600, "back_s": 1200, "enabled": False}
    routine = routines.RoutineManager._clean_stored(raw)
    assert routine["back_kind"] == "duration" and routine["back_s"] == 1200 and routine["conditions"] is None and routine["once_trigger"] is False
