"""Zähler des Panels als Sensoren (seit 2.122.0), siehe summary.py."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from homeassistant.components.sensor import SensorEntity, SensorEntityDescription, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_SUMMARY
from .summary import SummaryCoordinator


@dataclass(frozen=True, kw_only=True)
class PanelSensorDescription(SensorEntityDescription):
    """key ist der Schlüssel in den Daten des Koordinators (summary.async_summary)."""


SENSORS = (
    PanelSensorDescription(key="active", translation_key="devices_active", icon="mdi:devices", state_class=SensorStateClass.MEASUREMENT),
    PanelSensorDescription(key="hidden", translation_key="devices_hidden", icon="mdi:eye-off", state_class=SensorStateClass.MEASUREMENT),
    PanelSensorDescription(key="offline", translation_key="devices_offline", icon="mdi:close-circle", state_class=SensorStateClass.MEASUREMENT),
    PanelSensorDescription(key="warning", translation_key="devices_warning", icon="mdi:alert", state_class=SensorStateClass.MEASUREMENT),
    PanelSensorDescription(key="battery", translation_key="devices_battery", icon="mdi:battery", state_class=SensorStateClass.MEASUREMENT),
    PanelSensorDescription(key="battery_low", translation_key="devices_battery_low", icon="mdi:battery-alert", state_class=SensorStateClass.MEASUREMENT),
    PanelSensorDescription(key="charging", translation_key="devices_charging", icon="mdi:battery-charging", state_class=SensorStateClass.MEASUREMENT),
    PanelSensorDescription(key="signal_weak", translation_key="devices_signal_weak", icon="mdi:signal-cellular-1", state_class=SensorStateClass.MEASUREMENT),
    PanelSensorDescription(key="new", translation_key="devices_new", icon="mdi:new-box", state_class=SensorStateClass.MEASUREMENT),
    PanelSensorDescription(key="updates", translation_key="devices_updates", icon="mdi:update", state_class=SensorStateClass.MEASUREMENT),
    PanelSensorDescription(
        key="errors", translation_key="errors", icon="mdi:alert-octagon", state_class=SensorStateClass.MEASUREMENT, entity_category=EntityCategory.DIAGNOSTIC
    ),
)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    coordinator: SummaryCoordinator = hass.data[DATA_SUMMARY]
    async_add_entities(PanelSensor(coordinator, entry, description) for description in SENSORS)


class PanelSensor(CoordinatorEntity[SummaryCoordinator], SensorEntity):
    _attr_has_entity_name = True
    entity_description: PanelSensorDescription

    def __init__(self, coordinator: SummaryCoordinator, entry: ConfigEntry, description: PanelSensorDescription) -> None:
        super().__init__(coordinator)
        self.entity_description = description
        self._attr_unique_id = f"{entry.entry_id}_{description.key}"
        self._attr_device_info = coordinator.device_info

    @property
    def _part(self) -> dict[str, Any]:
        return (self.coordinator.data or {}).get(self.entity_description.key) or {}

    @property
    def native_value(self) -> int | None:
        return self._part.get("count")

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        part = self._part
        if self.entity_description.key == "errors":
            return {k: part.get(k) for k in ("last", "last_category", "last_at")} | {"status_problems": (self.coordinator.data or {}).get("status_problems", 0)}
        return {k: part[k] for k in ("names", "more") if k in part} or None
