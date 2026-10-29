"""Knöpfe: "Fehler quittieren" (seit 2.122.0, der Fehlerzähler beginnt bei null) und je Routine mit Haken "Jetzt ausführen" (seit 2.179.0)."""

from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DATA_ROUTINES, DATA_SUMMARY, SIGNAL_ROUTINES
from .routines import RoutineManager
from .summary import SummaryCoordinator


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    async_add_entities([AcknowledgeButton(hass.data[DATA_SUMMARY], entry)])
    manager: RoutineManager | None = hass.data.get(DATA_ROUTINES)
    if manager is not None:
        manager.attach_buttons(entry.entry_id, async_add_entities)
        entry.async_on_unload(manager.detach_buttons)


class AcknowledgeButton(ButtonEntity):
    _attr_has_entity_name = True
    _attr_translation_key = "acknowledge_errors"
    _attr_icon = "mdi:check-all"
    _attr_entity_category = EntityCategory.CONFIG

    def __init__(self, coordinator: SummaryCoordinator, entry: ConfigEntry) -> None:
        self._coordinator = coordinator
        self._attr_unique_id = f"{entry.entry_id}_acknowledge_errors"
        self._attr_device_info = coordinator.device_info

    async def async_press(self) -> None:
        await self._coordinator.async_acknowledge()


class RoutineButton(ButtonEntity):
    """Eine Routine jetzt ausführen (seit 2.179.0), wie "Jetzt ausführen" im Panel: läuft immer, auch bei Pause oder ausgeschalteter Routine."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:play-circle"
    _attr_should_poll = False

    def __init__(self, manager: RoutineManager, entry_id: str, routine_id: str) -> None:
        self._manager = manager
        self.routine_id = routine_id
        self._attr_unique_id = manager.button_unique_id(entry_id, routine_id)
        self._attr_device_info = manager.hass.data[DATA_SUMMARY].device_info

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(async_dispatcher_connect(self.hass, SIGNAL_ROUTINES, self._changed))

    @callback
    def _changed(self, routine_id: str | None) -> None:
        # Der Name folgt der Routine: bei jeder Änderung neu schreiben (der Knopf hat sonst keinen Zustand)
        if routine_id in (None, self.routine_id) and self._manager.get(self.routine_id) is not None:
            self.async_write_ha_state()

    @property
    def name(self) -> str:
        routine = self._manager.get(self.routine_id)
        word = "Routine ausführen" if str(self.hass.config.language).startswith("de") else "Run routine"
        return f"{word}: {routine['name'] if routine else self.routine_id}"

    @property
    def available(self) -> bool:
        return self._manager.get(self.routine_id) is not None

    async def async_press(self) -> None:
        result = await self._manager.async_run_now(self.routine_id)
        if result is None:
            raise HomeAssistantError("Routine nicht gefunden")
        ok, reason = result
        if not ok:
            raise HomeAssistantError(f"Die Routine konnte nicht ausgeführt werden ({reason or 'error'})")
