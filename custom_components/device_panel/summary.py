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
PLATFORMS = ("sensor", "binary_sensor", "button", "switch")
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


def _availability(listing: dict[str, Any], active: list[dict[str, Any]]) -> dict[str, Any]:
    """Zahlen der Kacheln "Verfügbarkeit", "Gerade ausgefallen" und "Ausfall-Puls" für die Dashboard-Karten (seit 2.216.0), gerechnet wie das Panel (_heroHtml).

    Nur Zahlen, Zeiten und die Namen der gerade ausgefallenen Geräte (die zeigt schon der Sensor "Geräte ausgefallen"): Karten sehen alle Nutzer des Dashboards.
    """
    monitored = [d for d in active if not d.get("no_status")]
    online = [d for d in monitored if d["online"] is True]
    offline = sorted((d for d in active if d["online"] is False), key=lambda d: d.get("offline_since") or "")
    flaky = sum(1 for d in online if d.get("flaky"))
    share = len(online) / len(monitored) * 100 if monitored else 100.0
    # Nie 100 % zeigen, solange ein Gerät fehlt (Rundung bei vielen Geräten)
    if share > 99.9 and len(online) < len(monitored):
        share = 99.9
    with_avail = [d["avail24"]["pct"] for d in monitored if (d.get("avail24") or {}).get("pct") is not None]
    avg: float | None = None
    if with_avail:
        avg = sum(with_avail) / len(with_avail)
        if avg > 99.9 and any((d.get("avail24") or {}).get("outages") for d in monitored):
            avg = 99.9
    pulse = listing.get("pulse")
    return {
        "share": round(share, 1),
        "avg24": None if avg is None else round(avg, 1),
        "total": len(monitored),
        "online": len(online),
        "stable": len(online) - flaky,
        "flaky": flaky,
        "offline": len(offline),
        "no_data": sum(1 for d in monitored if d["online"] is None),
        "no_status": sum(1 for d in active if d.get("no_status")),
        "paused": sum(1 for d in listing["devices"] if d.get("monitor_pause_setting") and not d["disabled"]),
        "warnings": sum(1 for d in active if _warning(d)),
        "outages": sum((d.get("avail24") or {}).get("outages", 0) for d in monitored),
        "affected": sum(1 for d in monitored if (d.get("avail24") or {}).get("outages")),
        "longest_since": offline[0].get("offline_since") if offline else None,
        "longest_at_least": bool(offline and offline[0].get("since_at_least")),
        "offline_list": [{"id": str(d["id"]), "name": str(d["name"]), "since": d.get("offline_since"), "at_least": bool(d.get("since_at_least"))} for d in offline[:4]],
        "pulse": list(pulse) if pulse else [],
    }


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
        "availability": _availability(listing, active),
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
