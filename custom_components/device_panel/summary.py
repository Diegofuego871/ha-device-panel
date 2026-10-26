"""
Eigene Entitäten (seit 2.122.0): Zahlen und Zustände des Panels für Automationen und Dashboards.

Ein Koordinator rechnet alle 30 Sekunden aus derselben Liste wie das Panel (async_list_devices) nach, wie viele Geräte aktiv, ausgeblendet,
ausgefallen oder in Warnung sind und so weiter. Die Entitäten schreiben nur bei Änderung in den Recorder. Die Zählung der Warnungen folgt
dem Panel (devWarn): instabil, Batterie niedrig, schwacher Empfang oder keine Daten, ohne Ausfälle; deaktivierte und nicht überwachte Geräte zählen nicht.

Fehlerzähler: Einträge der Stufe "error" im Panel-Log der letzten 24 Stunden, seit dem letzten Quittieren (Knopf "Fehler quittieren").
Die Zeit des Quittierens liegt in einer eigenen kleinen Datei.
"""

from __future__ import annotations

import logging
import time
from datetime import timedelta
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.storage import Store
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

from . import activity
from .const import CONF_EXCLUDE_DEVICES, DATA_AVAILABILITY, DATA_STATUS, DOMAIN, STORAGE_VERSION
from .devices import async_list_devices, signal_limit, signal_weak
from .options_api import effective

_LOGGER = logging.getLogger(__name__)

SUMMARY_STORE_KEY = f"{DOMAIN}.summary"
PLATFORMS = ("sensor", "binary_sensor", "button")
UPDATE_SECONDS = 30
ERROR_WINDOW_S = 86400
# Namen im Attribut: HA speichert Attribute im Verlauf, darum nicht beliebig viele
MAX_NAMES = 20


def _names(devices: list[dict[str, Any]]) -> dict[str, Any]:
    names = sorted((str(d["name"]) for d in devices), key=str.casefold)
    return {"names": names[:MAX_NAMES], "more": max(0, len(names) - MAX_NAMES)}


def _warning(d: dict[str, Any]) -> bool:
    """Warnung wie im Panel (devWarn); ausgefallene Geräte zählen als Ausfall, nicht als Warnung."""
    if d["online"] is False:
        return False
    return (
        (d["online"] is not True and not d.get("no_status"))
        or bool(d.get("flaky"))
        or bool((d.get("battery") or {}).get("low"))
        or bool(d.get("signal")) and signal_weak(d["signal"], signal_limit(d))
    )


async def async_summary(hass: HomeAssistant, ack_at: float = 0.0) -> dict[str, Any]:
    """Alle Werte der Entitäten; jede Zahl mit den Namen der betroffenen Geräte."""
    listing = await async_list_devices(hass, hass.data.get(DATA_AVAILABILITY))
    devices = listing["devices"]
    active = [d for d in devices if not d["disabled"] and not d["unmonitored"]]
    groups: dict[str, list[dict[str, Any]]] = {
        "active": active,
        "offline": [d for d in active if d["online"] is False],
        "warning": [d for d in active if _warning(d)],
        "battery": [d for d in active if d.get("has_battery")],
        "battery_low": [d for d in active if (d.get("battery") or {}).get("low")],
        "charging": [d for d in active if d.get("charging")],
        "signal_weak": [d for d in active if d.get("signal") and signal_weak(d["signal"], signal_limit(d))],
        "new": [d for d in devices if d.get("new") and not d["disabled"]],
        "updates": [d for d in active if d.get("update") is not None],
    }
    dev_reg = dr.async_get(hass)
    hidden = sum(1 for dev in effective(hass)[CONF_EXCLUDE_DEVICES] if dev_reg.async_get(dev) is not None)
    since = max(ack_at, time.time() - ERROR_WINDOW_S)
    errors = [e for e in activity.get(hass).entries if e.get("level") == "error" and e.get("at", 0) > since]
    status_watch = hass.data.get(DATA_STATUS)
    problems = int(status_watch.summary()["problems"]) if status_watch is not None else 0
    last = errors[-1] if errors else None
    return {
        **{key: {"count": len(items), **_names(items)} for key, items in groups.items()},
        "hidden": {"count": hidden},
        "errors": {
            "count": len(errors),
            "last": (f"{last.get('title') or last.get('cat')}: {last.get('text')}")[:255] if last else None,
            "last_category": last.get("cat") if last else None,
            "last_at": last.get("at") if last else None,
        },
        "status_problems": problems,
    }


class SummaryCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Holt die Werte für die Entitäten und merkt sich, wann die Fehler quittiert wurden."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(hass, _LOGGER, name=DOMAIN, config_entry=entry, update_interval=timedelta(seconds=UPDATE_SECONDS))
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, SUMMARY_STORE_KEY)
        self.ack_at = 0.0
        self.device_info = DeviceInfo(
            identifiers={(DOMAIN, "panel")},
            name="Device Panel",
            manufacturer="Device Panel",
            entry_type=dr.DeviceEntryType.SERVICE,
        )

    async def async_load(self) -> None:
        stored = await self._store.async_load()
        if isinstance(stored, dict) and isinstance(stored.get("ack_at"), (int, float)):
            self.ack_at = float(stored["ack_at"])

    async def _async_update_data(self) -> dict[str, Any]:
        return await async_summary(self.hass, self.ack_at)

    async def async_acknowledge(self) -> None:
        """Fehler quittieren: der Zähler beginnt bei null, das Log bleibt unberührt."""
        self.ack_at = time.time()
        await self._store.async_save({"ack_at": self.ack_at})
        await self.async_refresh()
