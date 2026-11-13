"""
Pause der Überwachung eines Geräts (seit 2.214.0, Issue 4): zum Beispiel Geräte aus dem Garten, die über den Winter im Haus liegen.

Während der Pause gilt das Gerät wie "Überwachen aus" (devices.device_offline_after liefert None): es bleibt in der Liste, ohne Ausfälle, Batterie-
Warnung, Statistik und Meldungen. Der Wächter hier beendet die Pause: am Datum oder, bei "bis wieder online", sobald das Gerät wieder erreichbar ist.

"Bis wieder online" endet erst, wenn das Gerät einmal weg war (seen_off) und dann wieder erreichbar ist, und zwar mindestens ONLINE_CONFIRM Sekunden
am Stück, damit ein kurzes Auftauchen (Batterie fast leer) die Pause nicht beendet. Nach der Pause beginnt ein noch laufender Ausfall erst jetzt
(resumed_at), nicht mit dem Beginn der Pause; sonst stünde der ganze Winter als Ausfall in der Statistik.
"""

from __future__ import annotations

import logging
import time
from datetime import timedelta
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.util import dt as dt_util

from . import activity
from .const import PAUSE_DATE, PAUSE_ONLINE
from .devices import (
    async_load_type_overrides,
    async_set_device_settings,
    device_settings,
    device_status,
    liveness_exclude,
)
from .options_api import effective

_LOGGER = logging.getLogger(__name__)

TICK = timedelta(seconds=60)
# So lange muss das Gerät am Stück erreichbar sein, bevor "bis wieder online" endet
ONLINE_CONFIRM = 120.0


class MonitorPauseWatch:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._unsub: Any = None
        self._online_since: dict[str, float] = {}
        # Gerät → Zeit, zu der seine Pause endete (nur im Speicher: gilt bis der Verfügbarkeitslauf den Wechsel festhält)
        self.resumed_at: dict[str, float] = {}

    async def async_start(self) -> None:
        await async_load_type_overrides(self.hass)
        self._unsub = async_track_time_interval(self.hass, self._tick, TICK)
        await self.async_check()

    async def async_stop(self) -> None:
        if self._unsub is not None:
            self._unsub()
            self._unsub = None

    async def _tick(self, _now: Any) -> None:
        await self.async_check()

    async def async_check(self, now: float | None = None) -> None:
        """Pausen prüfen: abgelaufene Daten und wieder erreichbare Geräte beenden die Pause."""
        now = now if now is not None else time.time()
        # Der Verfügbarkeitslauf holt den Wechsel nach spätestens einer Minute ab; was liegen bleibt (Gerät war gleich wieder online), fällt weg
        for dev in [d for d, t in self.resumed_at.items() if now - t > 600]:
            del self.resumed_at[dev]
        pauses = device_settings(self.hass).get("monitor_pause", {})
        if not pauses:
            self._online_since.clear()
            return
        registry = dr.async_get(self.hass)
        ent_reg = er.async_get(self.hass)
        opts = effective(self.hass)
        for dev, pause in list(pauses.items()):
            # Ein Gerät mit Fehler darf die Pausen der anderen nicht aufhalten
            try:
                await self._check_one(dev, pause, now, registry, ent_reg, opts)
            except Exception:  # noqa: BLE001
                _LOGGER.exception("Pause von %s konnte nicht geprüft werden", dev)
        for dev in list(self._online_since):
            if dev not in pauses:
                del self._online_since[dev]

    async def _check_one(self, dev: str, pause: dict[str, Any], now: float, registry: dr.DeviceRegistry, ent_reg: er.EntityRegistry, opts: dict[str, Any]) -> None:
        device = registry.async_get(dev)
        if device is None:
            # Gelöschtes Gerät: nichts zu beenden, der Eintrag bleibt wie die anderen Einstellungen (HA stellt dasselbe Gerät mit gleicher ID wieder her)
            return
        if pause["mode"] == PAUSE_DATE:
            if pause["until"] <= now:
                await self._resume(device, "date", now)
            return
        if pause["mode"] != PAUSE_ONLINE:
            return
        entries = er.async_entries_for_device(ent_reg, dev)
        exclude = liveness_exclude(self.hass, dev, entries, opts, device)
        # Ohne Schwelle ("Ausgefallen nach"): für diese Pause zählt, ob jetzt ein Lebenszeichen da ist; ein kurzes Ausbleiben ist schon "weg"
        reachable, _since = device_status(self.hass, entries, dt_util.utc_from_timestamp(now), 0, exclude)
        if not pause["seen_off"]:
            # Erst muss das Gerät weg gewesen sein, sonst endete die Pause bei einem Gerät, das noch läuft, gleich wieder
            if reachable is False:
                await async_set_device_settings(self.hass, dev, monitor_pause={"mode": PAUSE_ONLINE, "seen_off": True})
            return
        if reachable:
            first = self._online_since.setdefault(dev, now)
            if now - first >= ONLINE_CONFIRM:
                await self._resume(device, "online", now)
        else:
            self._online_since.pop(dev, None)

    async def _resume(self, device: dr.DeviceEntry, reason: str, now: float) -> None:
        self._online_since.pop(device.id, None)
        self.resumed_at[device.id] = now
        await async_set_device_settings(self.hass, device.id, monitor_pause=None)
        activity.record(self.hass, "info", "system", f"monitor_resumed_{reason}", device.name_by_user or device.name or "", device.id)
        _LOGGER.debug("Überwachung von %s wieder aufgenommen (%s)", device.id, reason)


async def async_set_pause(hass: HomeAssistant, device_id: str, pause: dict[str, Any] | None) -> None:
    """Pause setzen oder aufheben und ins Protokoll schreiben (Panel und Aktion "Überwachung pausieren" in der Meldung)."""
    before = device_settings(hass).get("monitor_pause", {}).get(device_id)
    await async_set_device_settings(hass, device_id, monitor_pause=pause)
    device = dr.async_get(hass).async_get(device_id)
    name = (device.name_by_user or device.name or "") if device else ""
    if pause is None:
        if before is not None:
            activity.record(hass, "info", "system", "monitor_pause_cancelled", name, device_id)
    elif pause["mode"] == PAUSE_DATE:
        until = dt_util.as_local(dt_util.utc_from_timestamp(float(pause["until"]))).strftime("%Y-%m-%d %H:%M")
        activity.record(hass, "info", "system", "monitor_paused_date", name, device_id, until=until)
    else:
        activity.record(hass, "info", "system", "monitor_paused_online", name, device_id)
