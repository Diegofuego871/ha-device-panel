"""Schalter in Home Assistant (seit 2.177.0): "Routinen pausiert" immer, dazu je ein Schalter für jede Routine mit Haken "Als Schalter in Home Assistant"."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import CONF_ROUTINES_PAUSE, CONF_ROUTINES_PAUSE_UNTIL, DATA_ROUTINES, DATA_SUMMARY, SIGNAL_ROUTINES
from .options_api import effective
from .routines import RoutineManager
from .summary import SummaryCoordinator


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    coordinator: SummaryCoordinator = hass.data[DATA_SUMMARY]
    async_add_entities([RoutinesPausedSwitch(hass, coordinator, entry)])
    manager: RoutineManager | None = hass.data.get(DATA_ROUTINES)
    if manager is not None:
        manager.attach_switches(entry.entry_id, async_add_entities)
        entry.async_on_unload(manager.detach_switches)


class RoutinesPausedSwitch(SwitchEntity):
    """Alle Routinen pausieren: dasselbe wie der Schalter im Panel (Option "routines_pause"), immer vorhanden."""

    _attr_has_entity_name = True
    _attr_translation_key = "routines_paused"
    _attr_icon = "mdi:pause-circle"
    _attr_should_poll = False

    def __init__(self, hass: HomeAssistant, coordinator: SummaryCoordinator, entry: ConfigEntry) -> None:
        self.hass = hass
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_routines_paused"
        self._attr_device_info = coordinator.device_info

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(async_dispatcher_connect(self.hass, SIGNAL_ROUTINES, self._changed))

    @callback
    def _changed(self, routine_id: str | None) -> None:
        if routine_id is None:
            self.async_write_ha_state()

    @property
    def is_on(self) -> bool:
        manager: RoutineManager | None = self.hass.data.get(DATA_ROUTINES)
        return manager.paused() if manager is not None else bool(effective(self.hass).get(CONF_ROUTINES_PAUSE))

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        manager: RoutineManager | None = self.hass.data.get(DATA_ROUTINES)
        until = manager.paused_until() if manager is not None else None
        return {"paused_until": until} if until else None

    async def _async_set(self, paused: bool) -> None:
        # Wie im Panel: eine Pause von Hand gilt ohne Ende, Ausschalten löscht auch einen alten Zeitpunkt
        self.hass.config_entries.async_update_entry(
            self._entry, options={**self._entry.options, CONF_ROUTINES_PAUSE: paused, CONF_ROUTINES_PAUSE_UNTIL: 0}
        )

    async def async_turn_on(self, **kwargs: Any) -> None:
        await self._async_set(True)

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self._async_set(False)


class RoutineSwitch(SwitchEntity):
    """Eine Routine ein- und ausschalten (wie der Schalter im Panel); Name und Stand folgen der Routine."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:flash"
    _attr_should_poll = False

    def __init__(self, manager: RoutineManager, entry_id: str, routine_id: str) -> None:
        self._manager = manager
        self.routine_id = routine_id
        self._attr_unique_id = manager.switch_unique_id(entry_id, routine_id)
        self._attr_device_info = manager.hass.data[DATA_SUMMARY].device_info

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(async_dispatcher_connect(self.hass, SIGNAL_ROUTINES, self._changed))

    @callback
    def _changed(self, routine_id: str | None) -> None:
        if routine_id in (None, self.routine_id) and self._manager.get(self.routine_id) is not None:
            self.async_write_ha_state()

    @property
    def _routine(self) -> dict[str, Any] | None:
        return self._manager.get(self.routine_id)

    @property
    def name(self) -> str:
        routine = self._routine
        # "Routine: " davor, damit klar ist, dass der Schalter die Routine meint und nicht das Gerät, das sie schaltet
        return f"Routine: {routine['name']}" if routine else f"Routine: {self.routine_id}"

    @property
    def available(self) -> bool:
        return self._routine is not None

    @property
    def is_on(self) -> bool | None:
        routine = self._routine
        return bool(routine["enabled"]) if routine else None

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        routine = self._routine
        if routine is None:
            return None
        rt = self._manager.runtime(self.routine_id)
        last = rt.get("last") or {}
        return {
            "next_run": rt.get("due") if routine["enabled"] else None,
            "last_run": last.get("at"),
            "last_result": last.get("what"),
            "failed": last.get("ok") is False,
        }

    async def _async_set(self, enabled: bool) -> None:
        try:
            await self._manager.async_set_enabled(self.routine_id, enabled)
        except vol.Invalid as err:
            raise HomeAssistantError(str(err)) from err

    async def async_turn_on(self, **kwargs: Any) -> None:
        await self._async_set(True)

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self._async_set(False)
