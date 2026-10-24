"""Zustände des Panels als binäre Sensoren (seit 2.122.0), siehe summary.py."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from homeassistant.components.binary_sensor import BinarySensorDeviceClass, BinarySensorEntity, BinarySensorEntityDescription
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_SUMMARY
from .summary import SummaryCoordinator


@dataclass(frozen=True, kw_only=True)
class PanelBinaryDescription(BinarySensorEntityDescription):
    is_on: Callable[[dict[str, Any]], bool]


BINARY_SENSORS = (
    PanelBinaryDescription(
        key="outage", translation_key="outage", device_class=BinarySensorDeviceClass.PROBLEM, is_on=lambda d: d["offline"]["count"] > 0
    ),
    # Ein Fehler im Log oder ein Teil der Integration, der nicht läuft (Status-App): Dienst steht, Meldung konnte nicht gesendet werden
    PanelBinaryDescription(
        key="problem",
        translation_key="problem",
        device_class=BinarySensorDeviceClass.PROBLEM,
        is_on=lambda d: d["errors"]["count"] > 0 or d["status_problems"] > 0,
    ),
)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    coordinator: SummaryCoordinator = hass.data[DATA_SUMMARY]
    async_add_entities(PanelBinarySensor(coordinator, entry, description) for description in BINARY_SENSORS)


class PanelBinarySensor(CoordinatorEntity[SummaryCoordinator], BinarySensorEntity):
    _attr_has_entity_name = True
    entity_description: PanelBinaryDescription

    def __init__(self, coordinator: SummaryCoordinator, entry: ConfigEntry, description: PanelBinaryDescription) -> None:
        super().__init__(coordinator)
        self.entity_description = description
        self._attr_unique_id = f"{entry.entry_id}_{description.key}"
        self._attr_device_info = coordinator.device_info

    @property
    def is_on(self) -> bool | None:
        return self.entity_description.is_on(self.coordinator.data) if self.coordinator.data else None

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        data = self.coordinator.data
        if not data:
            return None
        if self.entity_description.key == "outage":
            return {k: data["offline"][k] for k in ("count", "names", "more")}
        return {"errors": data["errors"]["count"], "status_problems": data["status_problems"], "last_error": data["errors"]["last"]}
