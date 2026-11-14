"""Push-Aktion "Sofort zurückschalten" in der Meldung einer Routine (2.221.0)."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_mock_service

from custom_components.device_panel.const import DATA_ROUTINES, ROUTINE_BACK_ACTION_PREFIX

from .test_outage_notify import _device, _options, setup  # noqa: F401, F811
from .test_routines import _raw, _switch, _zurich  # noqa: F401, F811


async def _routine(hass: HomeAssistant, **extra: Any):
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    manager = hass.data[DATA_ROUTINES]
    routine = await manager.async_save_routine(_raw(device, plug, name="Licht", kind="countdown", delay_s=86400, push=True, **extra))
    return calls, manager, routine


def _tap(hass: HomeAssistant, routine_id: str) -> None:
    hass.bus.async_fire("mobile_app_notification_action", {"action": f"{ROUTINE_BACK_ACTION_PREFIX}{routine_id}"})


async def test_push_back_is_only_kept_with_push_and_a_switch_back(hass: HomeAssistant, setup) -> None:  # noqa: F811
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    manager = hass.data[DATA_ROUTINES]
    both = await manager.async_save_routine(_raw(device, plug, name="A", kind="countdown", delay_s=600, push=True, back_s=300, push_back=True))
    no_back = await manager.async_save_routine(_raw(device, plug, name="B", kind="countdown", delay_s=600, push=True, push_back=True))
    no_push = await manager.async_save_routine(_raw(device, plug, name="C", kind="countdown", delay_s=600, back_s=300, push_back=True))
    assert (both["push_back"], no_back["push_back"], no_push["push_back"]) == (True, False, False)
    # ohne Angabe aus
    plain = await manager.async_save_routine(_raw(device, plug, name="D", kind="countdown", delay_s=600, push=True, back_s=300))
    assert plain["push_back"] is False


async def test_the_run_notification_carries_the_action_and_the_revert_does_not(hass: HomeAssistant, setup) -> None:  # noqa: F811
    calls, manager, routine = await _routine(hass, back_s=1800, push_back=True)
    async_mock_service(hass, "switch", "turn_on")
    off = async_mock_service(hass, "switch", "turn_off")
    await manager.async_run_now(routine["id"])
    await hass.async_block_till_done()
    actions = calls[-1].data["data"].get("actions")
    assert actions == [{"action": f"{ROUTINE_BACK_ACTION_PREFIX}{routine['id']}", "title": "Sofort zurückschalten"}] or actions[0]["action"] == f"{ROUTINE_BACK_ACTION_PREFIX}{routine['id']}"
    _tap(hass, routine["id"])
    await hass.async_block_till_done()
    assert len(off) == 1 and not manager._pending(manager.runtime(routine["id"]))
    # Die Meldung über das Zurückschalten trägt keine Push-Aktion mehr (es wartet nichts), und es kommt keine zusätzliche Folge-Meldung
    assert "actions" not in calls[-1].data["data"]
    assert len(calls) == 2


async def test_no_action_without_the_option(hass: HomeAssistant, setup) -> None:  # noqa: F811
    calls, manager, routine = await _routine(hass, back_s=1800)
    async_mock_service(hass, "switch", "turn_on")
    await manager.async_run_now(routine["id"])
    await hass.async_block_till_done()
    assert "actions" not in calls[-1].data["data"]


async def test_tap_without_anything_waiting_says_so(hass: HomeAssistant, setup) -> None:  # noqa: F811
    hass.config.language = "de"
    calls, manager, routine = await _routine(hass, back_s=1800, push_back=True)
    off = async_mock_service(hass, "switch", "turn_off")
    _tap(hass, routine["id"])
    await hass.async_block_till_done()
    assert off == []
    assert calls[-1].data["title"].startswith("⚠️") and "nichts zurückzuschalten" in calls[-1].data["message"]


async def test_forged_taps_do_nothing(hass: HomeAssistant, setup) -> None:  # noqa: F811
    calls, manager, routine = await _routine(hass, back_s=1800)  # ohne push_back
    async_mock_service(hass, "switch", "turn_on")
    off = async_mock_service(hass, "switch", "turn_off")
    await manager.async_run_now(routine["id"])
    await hass.async_block_till_done()
    n = len(calls)
    for action in (f"{ROUTINE_BACK_ACTION_PREFIX}{routine['id']}", f"{ROUTINE_BACK_ACTION_PREFIX}gibtsnicht", ROUTINE_BACK_ACTION_PREFIX, "ANDERE"):
        hass.bus.async_fire("mobile_app_notification_action", {"action": action})
    await hass.async_block_till_done()
    assert off == [] and len(calls) == n
