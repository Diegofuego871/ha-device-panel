"""Routine mit mehreren Geräten (2.181.0): ein Ziel je Gerät mit eigener Aktion, gemeinsame Zeit, Zurückschalten und Meldung."""

from __future__ import annotations

from typing import Any

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from pytest_homeassistant_custom_component.common import async_mock_service

from custom_components.device_panel import backup, routines
from custom_components.device_panel.const import DATA_ROUTINES

from .test_outage_notify import _device, setup  # noqa: F401  (Fixture "setup")
from .test_routines import _raw, _switch, _tick, _zurich  # noqa: F401  (Fixture "_zurich")


def _two(hass: HomeAssistant) -> tuple[dr.DeviceEntry, str, dr.DeviceEntry, str]:
    kitchen = _device(hass, "Küche")
    lamp = _switch(hass, kitchen, "lamp")
    bath = _device(hass, "Bad")
    plug = _switch(hass, bath, "plug")
    return kitchen, lamp, bath, plug


def _multi(device: dr.DeviceEntry, entity: str, other: dr.DeviceEntry, other_entity: str, **kwargs: Any) -> dict[str, Any]:
    more = kwargs.pop("more", [{"device_id": other.id, "entity_id": other_entity, "action": "on"}])
    # Standard: täglich um 23:00 (weit weg), damit nur von Hand und über das Zurückschalten geschaltet wird
    values = {"kind": "repeat", "repeat": "daily", "time": "23:00", "delay_s": None, **kwargs}
    return _raw(device, entity, more=more, **values)


async def test_all_targets_are_switched_and_named(hass: HomeAssistant, setup) -> None:  # noqa: F811
    on = async_mock_service(hass, "switch", "turn_on")
    manager = hass.data[DATA_ROUTINES]
    kitchen, lamp, bath, plug = _two(hass)
    saved = await manager.async_save_routine(_multi(kitchen, lamp, bath, plug, name=""))
    # Name ohne Eingabe: die erste Entität, "+1" für das weitere Ziel
    assert saved["name"].endswith("+1")
    assert [t["entity_id"] for t in routines.routine_targets(saved)] == [lamp, plug]
    assert await manager.async_run_now(saved["id"]) == (True, None)
    assert sorted(c.data["entity_id"] for c in on) == sorted([lamp, plug])


async def test_the_routine_shows_at_every_device(hass: HomeAssistant, setup) -> None:  # noqa: F811
    manager = hass.data[DATA_ROUTINES]
    kitchen, lamp, bath, plug = _two(hass)
    other = _device(hass, "Garage")
    saved = await manager.async_save_routine(_multi(kitchen, lamp, bath, plug))
    assert [r["id"] for r in manager.routines(kitchen.id)] == [saved["id"]]
    assert [r["id"] for r in manager.routines(bath.id)] == [saved["id"]]
    assert manager.routines(other.id) == []
    payload = routines.routine_payload(hass, manager, saved)
    assert [t["entity_id"] for t in payload["targets"]] == [lamp, plug]


async def test_each_target_has_its_own_action_and_back_mode(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    on = async_mock_service(hass, "switch", "turn_on")
    off = async_mock_service(hass, "switch", "turn_off")
    manager = hass.data[DATA_ROUTINES]
    kitchen, lamp, bath, plug = _two(hass)
    hass.states.async_set(plug, "on")
    saved = await manager.async_save_routine(
        _multi(kitchen, lamp, bath, plug, back_s=600, more=[{"device_id": bath.id, "entity_id": plug, "action": "off"}])
    )
    assert await manager.async_run_now(saved["id"]) == (True, None)
    assert [c.data["entity_id"] for c in on] == [lamp] and [c.data["entity_id"] for c in off] == [plug]
    # Zurückschalten: jedes Ziel zum Gegenstück seiner Aktion (Lampe aus, Steckdose ein)
    await _tick(hass, freezer, 601)
    assert [c.data["entity_id"] for c in off][-1] == lamp
    assert plug in [c.data["entity_id"] for c in on]


async def test_validation_per_target(hass: HomeAssistant, setup) -> None:  # noqa: F811
    manager = hass.data[DATA_ROUTINES]
    kitchen, lamp, bath, plug = _two(hass)
    # dieselbe Entität zweimal
    with pytest.raises(vol.Invalid, match="mehrfach"):
        await manager.async_save_routine(_multi(kitchen, lamp, kitchen, lamp))
    # Entität gehört nicht zum Gerät
    with pytest.raises(vol.Invalid, match="gehört nicht"):
        await manager.async_save_routine(_multi(kitchen, lamp, kitchen, plug))
    # Zurückschalten braucht ein Ziel, das sich zurückschalten lässt: lauter "Umschalten" geht nicht, eines daneben schon
    toggle = {"device_id": bath.id, "entity_id": plug, "action": "toggle"}
    with pytest.raises(vol.Invalid, match="zurückschalten"):
        await manager.async_save_routine(_multi(kitchen, lamp, bath, plug, back_s=600, action="toggle", more=[toggle]))
    saved = await manager.async_save_routine(_multi(kitchen, lamp, bath, plug, back_s=600, more=[toggle]))
    await manager.async_delete_routine(saved["id"])
    # höchstens zehn Ziele
    many = [{"device_id": bath.id, "entity_id": plug, "action": "on"}] * 10
    with pytest.raises(vol.Invalid):
        await manager.async_save_routine(_multi(kitchen, lamp, bath, plug, more=many))
    # eine geschaltete Entität darf nicht ihr eigener Auslöser sein, auch nicht die eines weiteren Ziels
    with pytest.raises(vol.Invalid, match="Auslöser"):
        await manager.async_save_routine(
            _multi(
                kitchen,
                lamp,
                bath,
                plug,
                kind="trigger",
                delay_s=None,
                conditions={"op": "and", "items": [{"entity_id": plug, "kind": "is", "value": "on"}]},
            )
        )


async def test_one_target_fails_the_others_still_switch(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    on = async_mock_service(hass, "switch", "turn_on")
    manager = hass.data[DATA_ROUTINES]
    kitchen, lamp, bath, plug = _two(hass)
    hass.states.async_set(plug, "unavailable")
    saved = await manager.async_save_routine(_multi(kitchen, lamp, bath, plug, back_s=600))
    assert await manager.async_run_now(saved["id"]) == (False, "unavailable")
    # Die Lampe ist geschaltet und wird zurückgeschaltet, die Steckdose nicht
    assert [c.data["entity_id"] for c in on] == [lamp]
    rt = manager.runtime(saved["id"])
    assert rt["last"]["what"] == "partial" and rt["fail_at"] is not None
    assert rt["revert_action"] == "off" and rt["tgt"].get(plug, {}).get("revert_action") is None


async def test_only_failed_targets_are_retried(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    freezer.move_to("2026-10-12 06:00:00+02:00")
    on = async_mock_service(hass, "switch", "turn_on")
    manager = hass.data[DATA_ROUTINES]
    kitchen, lamp, bath, plug = _two(hass)
    hass.states.async_set(plug, "unavailable")
    saved = await manager.async_save_routine(_multi(kitchen, lamp, bath, plug, kind="countdown", delay_s=60))
    await _tick(hass, freezer, 61)
    assert [c.data["entity_id"] for c in on] == [lamp]
    assert manager.runtime(saved["id"])["retry_ids"] == [plug]
    # Die Steckdose ist wieder da: nur sie wird nachgeholt, die Lampe nicht nochmals
    hass.states.async_set(plug, "off")
    await _tick(hass, freezer, routines.RETRY_S + 1)
    assert [c.data["entity_id"] for c in on] == [lamp, plug]
    rt = manager.runtime(saved["id"])
    assert rt["last"]["what"] == "run" and rt["retry_ids"] == [] and rt["ran"] == 0


async def test_removing_a_device_removes_only_its_target(hass: HomeAssistant, setup) -> None:  # noqa: F811
    manager = hass.data[DATA_ROUTINES]
    kitchen, lamp, bath, plug = _two(hass)
    garage = _device(hass, "Garage")
    door = _switch(hass, garage, "door")
    saved = await manager.async_save_routine(
        _multi(kitchen, lamp, bath, plug, more=[{"device_id": bath.id, "entity_id": plug, "action": "on"}, {"device_id": garage.id, "entity_id": door, "action": "on"}])
    )
    dr.async_get(hass).async_remove_device(kitchen.id)
    await hass.async_block_till_done()
    left = manager.get(saved["id"])
    # Das erste Ziel ist weg, das nächste rückt nach
    assert left is not None and left["device_id"] == bath.id and [t["entity_id"] for t in routines.routine_targets(left)] == [plug, door]
    dr.async_get(hass).async_remove_device(bath.id)
    dr.async_get(hass).async_remove_device(garage.id)
    await hass.async_block_till_done()
    assert manager.get(saved["id"]) is None


async def test_limit_per_device_counts_each_involved_device(hass: HomeAssistant, setup, monkeypatch) -> None:  # noqa: F811
    monkeypatch.setattr(routines, "MAX_PER_DEVICE", 1)
    manager = hass.data[DATA_ROUTINES]
    kitchen, lamp, bath, plug = _two(hass)
    await manager.async_save_routine(_raw(bath, plug, name="eins"))
    with pytest.raises(vol.Invalid, match="pro Gerät"):
        await manager.async_save_routine(_multi(kitchen, lamp, bath, plug, name="zwei"))


async def test_multi_routine_is_part_of_the_backup(hass: HomeAssistant, setup) -> None:  # noqa: F811
    manager = hass.data[DATA_ROUTINES]
    kitchen, lamp, bath, plug = _two(hass)
    saved = await manager.async_save_routine(_multi(kitchen, lamp, bath, plug, name="Abendlicht", back_s=600))
    data = await backup.async_export(hass, ["routines"])
    assert data["sections"]["routines"]["items"][0]["more"][0]["entity_id"] == plug
    # zurücksetzen und wiederherstellen
    await manager.async_delete_routine(saved["id"])
    assert manager.routines() == []
    await backup.async_import(hass, data, ["routines"], dry_run=False)
    restored = manager.get(saved["id"])
    assert restored is not None and [t["entity_id"] for t in routines.routine_targets(restored)] == [lamp, plug]


async def test_push_text_names_all_targets(hass: HomeAssistant, setup) -> None:  # noqa: F811
    manager = hass.data[DATA_ROUTINES]
    kitchen, lamp, bath, plug = _two(hass)
    saved = await manager.async_save_routine(_multi(kitchen, lamp, bath, plug, name="Abendlicht"))
    title, message = manager.texts(saved, action="on")
    assert "Abendlicht" in title and "lamp" in message and "plug" in message and message.count(",") == 1
    title, message = manager.texts(saved, action="on", ok=False, reason="unavailable", failed=[1], done=1)
    assert "1 von 2" in message and "plug" in message
