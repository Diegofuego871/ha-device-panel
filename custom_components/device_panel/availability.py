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

Ein Ausfall endet erst, wenn HA das Gerät wieder online sieht. Liegt eine
Zeit ohne Daten zwischen zwei Ausfall-Abschnitten (Neustart, Absturz, eine
Weile nicht überwacht), läuft der Ausfall durch: Zahlen und Dauer zählen ihn
einmal, ab dem ersten Abschnitt (bridged). Die Balken zeigen weiter, was HA
beobachtet hat, die Lücke also als "keine Daten".

Einmal pro Instanz füllt backfill.py die Zeit vor dem ersten Ereignis eines
Geräts aus dem Recorder nach (Merker "backfilled").
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any

from homeassistant.const import EVENT_HOMEASSISTANT_STARTED, EVENT_HOMEASSISTANT_STOP
from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.event import async_call_later, async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import CONF_OFFLINE_AFTER, CONF_STARTUP_GRACE, DOMAIN
from .devices import device_back_since, device_down_since, device_status, monitored_devices, primary_domain
from .options_api import effective, offline_after_for
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
# Nachfüllen aus dem Recorder so lange nach dem Start: nicht mitten in die
# Last des Hochfahrens.
BACKFILL_DELAY = 120
# Anteil online erst ab so viel Daten: nach wenigen Minuten hiesse ein kurzer
# Unterbruch sonst "50 %". Gleicher Wert im Panel (PCT_MIN_COVERED).
PCT_MIN_COVERED = 3600

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


def bridged(events: list[list[Any]]) -> list[list[Any]]:
    """
    Ereignisse für Zahlen und Dauer: "keine Daten" zwischen zwei Ausfällen
    fällt weg. HA sah das Gerät in der Lücke nie online; ohne den Schritt
    zählte jeder Neustart einen laufenden Ausfall doppelt.
    """
    out: list[list[Any]] = []
    for i, event in enumerate(events):
        if (
            event[1] is None
            and out
            and out[-1][1] == OFFLINE
            and i + 1 < len(events)
            and events[i + 1][1] == OFFLINE
        ):
            continue
        out.append(event)
    return out


def summarize(segs: list[list[Any]]) -> dict[str, Any] | None:
    """
    Anteil online, Zahl der Unterbrüche, längster und Summe; ohne Daten None.
    Anteil (pct) None, solange weniger als PCT_MIN_COVERED Daten vorliegen.
    """
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
        "pct": round(pct, 1) if on + off >= PCT_MIN_COVERED else None,
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
        # Zuhörer für Wechsel (Meldungen bei Ausfall und Rückkehr).
        self._listeners: list[Callable[[list[tuple[str, Any, float]]], None]] = []
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
        # Nachfüllen aus dem Recorder: wann erledigt (einmal pro Instanz).
        self._backfilled: float | None = None
        self._unsub_backfill: CALLBACK_TYPE | None = None
        self._backfill_task: asyncio.Task[int] | None = None
        self._closed = False

    def _data(self) -> dict[str, Any]:
        data: dict[str, Any] = {"heartbeat": time.time(), "devices": self._events}
        if self._backfilled is not None:
            data["backfilled"] = self._backfilled
        return data

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
            if isinstance(stored.get("backfilled"), (int, float)):
                self._backfilled = float(stored["backfilled"])
        # Frühere Versionen schrieben bei jedem Neustart für ausgefallene
        # Geräte ein "online" ohne Dauer (gleiche Zeit wie der folgende
        # Ausfall); es trennte den Ausfall vor dem Neustart von dem danach.
        for dev, events in self._events.items():
            self._events[dev] = [
                e for i, e in enumerate(events)
                if not (e[1] == ONLINE and i + 1 < len(events) and events[i + 1][1] == OFFLINE and events[i + 1][0] <= e[0])
            ]
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
        if self._backfilled is None and "recorder" in self.hass.config.components:
            self._unsub_backfill = async_call_later(self.hass, BACKFILL_DELAY, self._on_backfill_timer)

    @callback
    def _on_backfill_timer(self, _now: datetime) -> None:
        self._unsub_backfill = None
        self._backfill_task = self.hass.async_create_background_task(self.async_backfill(), f"{DOMAIN} backfill")

    async def async_backfill(self, now: float | None = None) -> int:
        """
        Zeit vor dem ersten Ereignis je Gerät aus dem Recorder nachfüllen,
        einmal. Gibt die Zahl der ergänzten Geräte zurück. Meldet keine
        Wechsel an die Zuhörer: es sind vergangene Ereignisse.
        """
        from homeassistant.helpers.recorder import async_migration_in_progress  # noqa: PLC0415

        from .backfill import async_backfill  # noqa: PLC0415

        if self._backfilled is not None or "recorder" not in self.hass.config.components:
            return 0
        if async_migration_in_progress(self.hass):
            # Datenbank wird umgebaut: beim nächsten Start erneut.
            return 0
        now = now if now is not None else time.time()
        opts = effective(self.hass)
        monitored = list(monitored_devices(self.hass, opts))
        devices = [(device.id, entries) for device, entries in monitored]
        offline_after = {device.id: self._offline_after(opts, device) for device, _entries in monitored}
        firsts = {dev: list(evs[0]) for dev, evs in self._events.items() if evs}
        try:
            found = await async_backfill(
                self.hass, devices, firsts, now, KEEP_DAYS, offline_after, opts[CONF_STARTUP_GRACE] * 60
            )
        except Exception:  # noqa: BLE001
            # Nicht bei jedem Start erneut versuchen: ein Fehler hier wiederholt sich.
            _LOGGER.warning("Nachfüllen aus dem Recorder fehlgeschlagen", exc_info=True)
            found = {}
        if self._closed:
            # Inzwischen entladen (oder entfernt): nichts mehr schreiben.
            return 0
        filled = 0
        for dev, add in found.items():
            events = self._events.get(dev)
            if not events:
                continue
            add = [e for e in add if e[0] < events[0][0]]
            if add:
                self._events[dev] = add + events
                filled += 1
        self._backfilled = now
        _LOGGER.info("Verfügbarkeitsprotokoll aus dem Recorder nachgefüllt: %d Geräte", filled)
        await self._saver.async_save()
        return filled

    async def _async_tick(self, _now: datetime) -> None:
        self.evaluate()

    async def _async_on_stop(self, _event: Event | None) -> None:
        self._unsub_stop = None
        await self._async_close()

    async def _async_close(self) -> None:
        """Ab jetzt keine Daten; sofort schreiben."""
        self._closed = True
        now = time.time()
        for events in self._events.values():
            if events and events[-1][1] is not None:
                events.append([now, None])
        await self._saver.async_save()

    async def async_stop(self) -> None:
        """Beim Entladen: Timer und Listener lösen, Lücke ab jetzt, schreiben."""
        for name in ("_unsub_tick", "_unsub_started", "_unsub_stop", "_unsub_backfill"):
            unsub = getattr(self, name)
            if unsub is not None:
                unsub()
                setattr(self, name, None)
        if self._backfill_task is not None and not self._backfill_task.done():
            self._backfill_task.cancel()
        await self._async_close()

    def _offline_after(self, opts: dict[str, Any], device: Any) -> float:
        """"Ausgefallen nach" des Geräts in Sekunden (eigener Wert der Integration oder global)."""
        # Nicht überwachte Geräte liefert monitored_devices nicht; der globale
        # Wert ist nur der Rückfall.
        return offline_after_for(opts, primary_domain(self.hass, device)) or opts[CONF_OFFLINE_AFTER] * 60

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
        seen: set[str] = set()
        # Wechsel für die Meldungen: (Gerät, Zustand, Zeitpunkt); "gone" =
        # nicht mehr überwacht.
        changes: list[tuple[str, Any, float]] = []
        for device, entries in monitored_devices(self.hass, opts):
            seen.add(device.id)
            online, since = device_status(self.hass, entries, now_dt, self._offline_after(opts, device))
            state = None if online is None else ONLINE if online else OFFLINE
            events = self._events.setdefault(device.id, [])
            last = events[-1] if events else None
            if last is not None and last[1] == state:
                continue
            # Alle Entitäten weg, aber noch unter der Schwelle: weder Ausfall
            # noch Lebenszeichen. Sonst schrieb jeder Neustart für Geräte, die
            # schon vorher fehlten, ein "online" (last_changed = Start), und
            # die Meldung "wieder online" ging hinaus.
            if online and device_down_since(self.hass, entries) is not None:
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
            if state is not None:
                changes.append((device.id, state, min(at, now)))
            self._saver.schedule()
        # Nicht mehr überwacht (ausgeschlossen, deaktiviert, gelöscht): ab
        # jetzt "keine Daten", damit eine spätere Rückkehr nicht als
        # durchgehend online erscheint.
        for dev, events in self._events.items():
            if dev not in seen and events and events[-1][1] is not None:
                events.append([max(now, events[-1][0]), None])
                changes.append((dev, "gone", now))
                self._saver.schedule()
        for listener in list(self._listeners):
            if changes:
                listener(changes)
        if now - self._pruned_at > 3600:
            self._pruned_at = now
            self._prune(now, seen)
        # Lebenszeichen regelmässig schreiben, auch ohne Wechsel.
        self._saver.schedule()

    @callback
    def add_listener(self, listener: Callable[[list[tuple[str, Any, float]]], None]) -> Callable[[], None]:
        """Wechsel nach jedem Durchlauf melden; gibt die Abmeldung zurück."""
        self._listeners.append(listener)
        return lambda: self._listeners.remove(listener)

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

    def open_outage(self, device_id: str) -> tuple[float | None, bool]:
        """
        Laufender Ausfall laut Protokoll: (Beginn, gesehen).

        Beginn ist der erste Ausfall nach der letzten Beobachtung "online";
        Lücken ohne Daten dazwischen beenden ihn nicht. "gesehen": HA sah den
        Wechsel von online zu ausgefallen selbst, der Beginn ist also sicher.
        Ohne Ausfall im Protokoll ist der Beginn None; "gesehen" heisst dann,
        das letzte Ereignis ist "online" (seit dem Start beobachtet), ein
        Wechsel danach also einer im laufenden Betrieb.
        """
        events = self.events(device_id)
        start: float | None = None
        seen = bool(events) and events[-1][1] == ONLINE
        for i in range(len(events) - 1, -1, -1):
            at, state = events[i]
            if state == ONLINE:
                break
            if state == OFFLINE:
                start = at
                seen = i > 0 and events[i - 1][1] == ONLINE
        return start, seen

    def device_summary(self, device_id: str, seconds: float, now: float | None = None) -> dict[str, Any] | None:
        now = now if now is not None else time.time()
        return summarize(segments(bridged(self.events(device_id)), now - seconds, now))

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
        # Balken: was HA beobachtet hat; Zahlen: Ausfall über Lücken als einer.
        segs = segments(events, start, now)
        counted = bridged(events)
        days: list[dict[str, Any]] = []
        if span > 86400:
            local_now = dt_util.as_local(dt_util.utc_from_timestamp(now))
            midnight = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
            for i in range(int(span // 86400) - 1, -1, -1):
                day_start = (midnight - timedelta(days=i)).timestamp()
                day_end = min(now, (midnight - timedelta(days=i - 1)).timestamp())
                off = [(a, b) for a, b, s in segments(counted, day_start, day_end) if s == OFFLINE]
                days.append({
                    "start": day_start,
                    # Ein Unterbruch über Mitternacht zählt an beiden Tagen.
                    "outages": len(off),
                    "offline": round(sum(b - a for a, b in off)),
                    "nodata": all(s is None for _a, _b, s in segments(events, day_start, day_end)),
                })
        counted_segs = segments(counted, start, now)
        return {
            "start": start,
            "end": now,
            "first": events[0][0] if events else None,
            "segments": segs,
            # Liste der Unterbrüche: über Lücken ohne Daten als einer (sonst
            # nach jedem Neustart ein neuer Eintrag, Fehlerbericht 0.20.0).
            "outages": [[a, b] for a, b, s in counted_segs if s == OFFLINE],
            "summary": summarize(counted_segs),
            "days": days,
        }

    def pulse(self, now: float | None = None, buckets: int = 48, only: set[str] | None = None) -> list[int]:
        """
        Zahl der Geräte mit Unterbruch je Abschnitt der letzten 24 Std. Ein
        Bild wie die Balken: was HA beobachtet hat, Lücken ohne Daten zählen
        nicht.
        """
        now = now if now is not None else time.time()
        start = now - 86400
        size = 86400 / buckets
        counts = [0] * buckets
        for dev, events in self._events.items():
            if only is not None and dev not in only:
                continue
            # Pro Gerät jeden Abschnitt nur einmal: mehrere kurze Ausfälle
            # in derselben halben Stunde (oder einer über einen Neustart)
            # sind ein Gerät, wie im Streifen der Liste.
            hit: set[int] = set()
            for a, b, st in segments(events, start, now):
                if st != OFFLINE:
                    continue
                first = max(0, int((a - start) // size))
                last = min(buckets - 1, int((b - start - 1e-6) // size))
                hit.update(range(first, last + 1))
            for i in hit:
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
            # Ein Ausfall, der über einen Neustart läuft, beginnt nicht neu
            # (sonst ein falscher Sammelausfall beim Start).
            for at, st in bridged(events):
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
