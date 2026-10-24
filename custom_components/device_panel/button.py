"""Knopf "Fehler quittieren" (seit 2.122.0): der Fehlerzähler beginnt bei null."""

from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DATA_SUMMARY
from .summary import SummaryCoordinator


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    async_add_entities([AcknowledgeButton(hass.data[DATA_SUMMARY], entry)])


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
