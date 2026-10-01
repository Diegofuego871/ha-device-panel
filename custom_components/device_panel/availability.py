"""
Verfügbarkeitsprotokoll: Wechsel online/ausgefallen pro Gerät, 31 Tage.

Eigene Datei (.storage/device_panel.availability), nicht der Recorder (siehe
docs/CONCEPT.md, "Verfügbarkeitsprotokoll"). Pro Gerät eine Liste von
Ereignissen [Zeit in Epoch-Sekunden, Zustand]: 1 online, 0 ausgefallen,
None keine Daten (Home Assistant lief nicht). "Keine Daten" ist nie ein
Ausfall (Lehre aus unifi_dynamic).

Bewertet wird alle 30 s mit derselben Regel wie die Liste
(devices.device_status): Ausfälle unter der Schwelle erscheinen gar nicht,
der Beginn eines Ausfalls ist der echte Zeitpunkt (last_changed), nicht der
der Erkennung.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta
from typing import Any

from homeassistant.const import EVENT_HOMEASSISTANT_STARTED, EVENT_HOMEASSISTANT_STOP
from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import CONF_OFFLINE_AFTER, CONF_STARTUP_GRACE, DOMAIN
from .devices import device_back_since, device_status, monitored_devices
from .options_api import effective
from .storage_util import PeriodicSaver

_LOGGER = logging.getLogger(__name__)

STORAGE_VERSION = 1
STORAGE_KEY = f"{DOMAIN}.availability"
KEEP_DAYS = 31
EVAL_INTERVAL = timedelta(seconds=30)
# Spätestens alle 5 Min. schreiben; das gespeicherte Lebenszeichen zeigt nach
# einem Absturz, bis wann HA sicher lief.
SAVE_DELAY = 300
# Sammelausfall: so viele Geräte innert dieser Zeit.
INCIDENT_MIN = 3
INCIDENT_WINDOW = 120
RANGES = {"24h": 86400, "7d": 7 * 86400, "30d": 30 * 86400}

ONLINE, OFFLINE = 1, 0


def segments(events: list[list[Any]], start: float, end: float) -> list[list[Any]]:
    """
    Abschnitte [von, bis, Zustand] im Zeitraum; vor dem ersten Ereignis und
    ohne Ereignisse "keine Daten" (None).
    """
    out: list[list[Any]] = []
    state: int | None = None
    cursor = start
    for at, st in events:
        if at <= start:
            state = st
            continue
        if at >= end:
            break
        if at > cursor:
            out.append([cursor, at, state])
        cursor, state = at, st
    if end > cursor:
        out.append([cursor, end, state])
    merged: list[list[Any]] = []
    for seg in out:
        if merged and merged[-1][2] == seg[2] and merged[-1][1] == seg[0]:
            merged[-1][1] = seg[1]
        else:
            merged.append(seg)
    return merged


def summarize(segs: list[list[Any]]) -> dict[str, Any] | None:
    """Anteil online, Zahl der Unterbrüche, längster und Summe; ohne Daten None."""
    on = sum(b - a for a, b, s in segs if s == ONLINE)
    off_segs = [(a, b) for a, b, s in segs if s == OFFLINE]
    off = sum(b - a for a, b in off_segs)
    if on + off <= 0:
        return None
    pct = on / (on + off) * 100
    # Nie 100 % zeigen, wenn es einen Unterbruch gab (Rundung).
    if off_segs and pct > 99.9:
        pct = 99.9
    return {
        "pct": round(pct, 1),
        "outages": len(off_segs),
        "longest": round(max((b - a for a, b in off_segs), default=0)),
        "offline": round(off),
        "covered": round(on + off),
    }


def strip(segs: list[list[Any]], start: float, end: float, buckets: int) -> list[int]:
    """Streifen für die Liste: 0 online, 1 mit Unterbruch, 2 keine Daten."""
    size = (end - start) / buckets
    out = []
    for i in range(buckets):
        a, b = start + i * size, start + (i + 1) * size
        off = none = 0.0
        for sa, sb, st in segs:
            overlap = min(b, sb) - max(a, sa)
            if overlap <= 0:
                continue
            if st == OFFLINE:
                off += overlap
            elif st is None:
                none += overlap
        out.append(1 if off > 0 else 2 if none > size / 2 else 0)
    return out


class AvailabilityLog:
    """Protokoll aller überwachten Geräte, einmal pro HA-Instanz."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._saver = PeriodicSaver(self._store, self._data, SAVE_DELAY)
        self._events: dict[str, list[list[Any]]] = {}
        self._started = time.time()
        self._pruned_at = 0.0
        self._unsub_tick: CALLBACK_TYPE | None = None
        # Einmal-Listener: nach dem Auslösen nicht mehr abmelden (HA warnt sonst).
        self._unsub_started: CALLBACK_TYPE | None = None
        self._unsub_stop: CALLBACK_TYPE | None = None

    def _data(self) -> dict[str, Any]:
        return {"heartbeat": time.time(), "devices": self._events}

    async def async_start(self) -> None:
        try:
            stored = await self._store.async_load()
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Verfügbarkeitsprotokoll konnte nicht geladen werden: %s", err)
            stored = None
        now = time.time()
        heartbeat = None
        if isinstance(stored, dict):
            raw = stored.get("devices")
            if isinstance(raw, dict):
                self._events = {
                    str(dev): [[float(e[0]), e[1]] for e in evs if isinstance(e, list) and len(e) == 2 and e[1] in (0, 1, None)]
                    for dev, evs in raw.items()
                    if isinstance(evs, list)
                }
            if isinstance(stored.get("heartbeat"), (int, float)):
                heartbeat = float(stored["heartbeat"])
        # Seit dem letzten Lebenszeichen lief HA nicht (oder stürzte ab):
        # Lücke als "keine Daten" markieren.
        gap = min(heartbeat, now) if heartbeat else now
        for events in self._events.values():
            if events and events[-1][1] is not None:
                events.append([max(gap, events[-1][0]), None])
        self._started = now
        self._unsub_stop = self.hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, self._async_on_stop)
        if self.hass.is_running:
            self._start_ticking()
        else:
            self._unsub_started = self.hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, self._on_started)

    @callback
    def _on_started(self, _event: Event) -> None:
        self._unsub_started = None
        self._start_ticking()

    @callback
    def _start_ticking(self) -> None:
        self._unsub_tick = async_track_time_interval(self.hass, self._async_tick, EVAL_INTERVAL)
        self.evaluate()

    async def _async_tick(self, _now: datetime) -> None:
        self.evaluate()

    async def _async_on_stop(self, _event: Event | None) -> None:
        self._unsub_stop = None
        await self._async_close()

    async def _async_close(self) -> None:
        """Ab jetzt keine Daten; sofort schreiben."""
        now = time.time()
        for events in self._events.values():
            if events and events[-1][1] is not None:
                events.append([now, None])
        await self._saver.async_save()

    async def async_stop(self) -> None:
        """Beim Entladen: Timer und Listener lösen, Lücke ab jetzt, schreiben."""
        for name in ("_unsub_tick", "_unsub_started", "_unsub_stop"):
            unsub = getattr(self, name)
            if unsub is not None:
                unsub()
                setattr(self, name, None)
        await self._async_close()

    @callback
    def evaluate(self, now: float | None = None) -> None:
        """Zustand aller überwachten Geräte prüfen und Wechsel festhalten."""
        now = now if now is not None else time.time()
        now_dt = dt_util.utc_from_timestamp(now)
        opts = effective(self.hass)
        # Anlaufphase nach dem Start (Option): Integrationen brauchen oft
        # Minuten, bis ihre Geräte wieder verfügbar sind. Wer in dieser Zeit
        # zurückkommt, hatte keinen Unterbruch; wer danach noch fehlt, gilt ab
        # dem Start als ausgefallen.
        in_grace = now - self._started < opts[CONF_STARTUP_GRACE] * 60
        offline_after = opts[CONF_OFFLINE_AFTER] * 60
        seen: set[str] = set()
        for device, entries in monitored_devices(self.hass, opts):
            seen.add(device.id)
            online, since = device_status(self.hass, entries, now_dt, offline_after)
            state = None if online is None else ONLINE if online else OFFLINE
            events = self._events.setdefault(device.id, [])
            last = events[-1] if events else None
            if last is not None and last[1] == state:
                continue
            if last is None and state is None:
                continue
            if state == OFFLINE:
                if in_grace:
                    continue
                at = since.timestamp() if since else now
            elif state == ONLINE:
                back = device_back_since(self.hass, entries)
                at = back.timestamp() if back else now
            else:
                at = now
            if last is not None:
                at = max(at, last[0])
            events.append([min(at, now), state])
            self._saver.schedule()
        # Nicht mehr überwacht (ausgeschlossen, deaktiviert, gelöscht): ab
        # jetzt "keine Daten", damit eine spätere Rückkehr nicht als
        # durchgehend online erscheint.
        for dev, events in self._events.items():
            if dev not in seen and events and events[-1][1] is not None:
                events.append([max(now, events[-1][0]), None])
                self._saver.schedule()
        if now - self._pruned_at > 3600:
            self._pruned_at = now
            self._prune(now, seen)
        # Lebenszeichen regelmässig schreiben, auch ohne Wechsel.
        self._saver.schedule()

    def _prune(self, now: float, seen: set[str]) -> None:
        cutoff = now - KEEP_DAYS * 86400
        dev_reg = dr.async_get(self.hass)
        for dev in list(self._events):
            if dev not in seen and dev_reg.async_get(dev) is None:
                del self._events[dev]
                continue
            events = self._events[dev]
            old = [e for e in events if e[0] < cutoff]
            if old:
                self._events[dev] = [[cutoff, old[-1][1]]] + [e for e in events if e[0] >= cutoff]

    # --- Abfragen ----------------------------------------------------------

    def events(self, device_id: str) -> list[list[Any]]:
        return self._events.get(device_id, [])

    def device_summary(self, device_id: str, seconds: float, now: float | None = None) -> dict[str, Any] | None:
        now = now if now is not None else time.time()
        return summarize(segments(self.events(device_id), now - seconds, now))

    def device_strip(self, device_id: str, now: float | None = None, buckets: int = 48) -> list[int]:
        now = now if now is not None else time.time()
        start = now - 86400
        return strip(segments(self.events(device_id), start, now), start, now, buckets)

    def history(self, device_id: str, range_key: str, now: float | None = None) -> dict[str, Any]:
        """Für das Statistik-Fenster: Abschnitte, Kurzfassung, Unterbrüche pro Tag."""
        now = now if now is not None else time.time()
        span = RANGES.get(range_key, RANGES["24h"])
        start = now - span
        events = self.events(device_id)
        segs = segments(events, start, now)
        days: list[dict[str, Any]] = []
        if span > 86400:
            local_now = dt_util.as_local(dt_util.utc_from_timestamp(now))
            midnight = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
            for i in range(int(span // 86400) - 1, -1, -1):
                day_start = (midnight - timedelta(days=i)).timestamp()
                day_end = min(now, (midnight - timedelta(days=i - 1)).timestamp())
                day_segs = segments(events, day_start, day_end)
                off = [(a, b) for a, b, s in day_segs if s == OFFLINE]
                days.append({
                    "start": day_start,
                    # Ein Unterbruch über Mitternacht zählt an beiden Tagen.
                    "outages": len(off),
                    "offline": round(sum(b - a for a, b in off)),
                    "nodata": all(s is None for _a, _b, s in day_segs),
                })
        return {
            "start": start,
            "end": now,
            "first": events[0][0] if events else None,
            "segments": segs,
            "summary": summarize(segs),
            "days": days,
        }

    def pulse(self, now: float | None = None, buckets: int = 48, only: set[str] | None = None) -> list[int]:
        """Zahl der Geräte mit Unterbruch je Abschnitt der letzten 24 Std."""
        now = now if now is not None else time.time()
        start = now - 86400
        size = 86400 / buckets
        counts = [0] * buckets
        for dev, events in self._events.items():
            if only is not None and dev not in only:
                continue
            for a, b, st in segments(events, start, now):
                if st != OFFLINE:
                    continue
                first = max(0, int((a - start) // size))
                last = min(buckets - 1, int((b - start - 1e-6) // size))
                for i in range(first, last + 1):
                    counts[i] += 1
        return counts

    def incidents(self, now: float | None = None, seconds: float = 86400, only: set[str] | None = None) -> list[dict[str, Any]]:
        """
        Sammelausfälle: mindestens INCIDENT_MIN Geräte, die innert
        INCIDENT_WINDOW Sekunden ausfielen. Neueste zuerst.
        """
        now = now if now is not None else time.time()
        start = now - seconds
        starts: list[tuple[float, str]] = []
        for dev, events in self._events.items():
            if only is not None and dev not in only:
                continue
            prev = None
            for at, st in events:
                if st == OFFLINE and prev != OFFLINE and at >= start:
                    starts.append((at, dev))
                prev = st
        starts.sort()
        found: list[dict[str, Any]] = []
        i = 0
        while i < len(starts):
            j = i
            while j + 1 < len(starts) and starts[j + 1][0] - starts[i][0] <= INCIDENT_WINDOW:
                j += 1
            group = starts[i : j + 1]
            if len({d for _a, d in group}) >= INCIDENT_MIN:
                found.append({"at": group[0][0], "devices": sorted({d for _a, d in group})})
                i = j + 1
            else:
                i += 1
        return list(reversed(found))
