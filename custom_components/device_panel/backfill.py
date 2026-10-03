"""
Verfügbarkeitsprotokoll einmal aus dem Recorder nachfüllen.

Nach der Installation kennt das Protokoll nur die Zeit seither. Der Recorder
hat meist mehrere Tage Verlauf (Standard 10): daraus rekonstruiert dieser
Schritt pro Gerät die Zeit vor seinem ersten Ereignis im Protokoll, mit
derselben Regel wie die laufende Bewertung (availability.evaluate):

- ausgefallen, wenn alle lebenden Entitäten weg sind, und erst ab "Ausgefallen
  nach"; kürzere Aussetzer zählen als online;
- Anlaufphase nach jedem Start von HA: wer darin zurückkommt, hatte keinen
  Unterbruch;
- Zeit, in der HA nicht lief (zwischen zwei Läufen des Recorders), als
  "keine Daten".

Bewusste Grenzen, damit grosse Installationen nicht leiden:

- höchstens MAX_ENTITIES Entitäten pro Gerät, ruhige zuerst
  (Verbindungssensor, dann alles ausser Sensoren, Messwerte zuletzt); das
  Gerät gilt als weg, wenn diese weg sind;
- eine Entität mit ROW_LIMIT oder mehr Wechseln im Zeitraum fällt weg
  (Speicher);
- ein Absturz von HA erscheint nicht als Lücke: der Recorder schliesst einen
  solchen Lauf erst beim nächsten Start, mit dessen Startzeit.

Läuft einmal pro Instanz (Merker "backfilled" im Protokoll), im Hintergrund
nach dem Start, über den Executor des Recorders.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from homeassistant.const import STATE_OFF, STATE_UNAVAILABLE
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

from .devices import liveness_entities

_LOGGER = logging.getLogger(__name__)

ONLINE, OFFLINE = 1, 0
MAX_ENTITIES = 3
# Höchstens so viele Kandidaten abfragen, falls ruhige wegen zu vieler
# Wechsel wegfallen.
MAX_TRIES = 6
ROW_LIMIT = 20000
# Messwerte, die oft im Sekundentakt wechseln: zuletzt versuchen.
_CHATTY_CLASSES = {
    "power", "current", "voltage", "apparent_power", "reactive_power", "power_factor", "frequency",
    "energy", "signal_strength", "data_rate", "data_size",
}


def candidates(entries: list[er.RegistryEntry]) -> tuple[list[er.RegistryEntry], bool]:
    """Lebende Entitäten (wie die Bewertung), ruhige zuerst; dazu, ob Verbindungssensor."""
    relevant, is_connectivity = liveness_entities(entries)

    def rank(e: er.RegistryEntry) -> tuple[int, int, str]:
        cls = e.device_class or e.original_device_class
        return (e.domain == "sensor", cls in _CHATTY_CLASSES, e.entity_id)

    return sorted(relevant, key=rank)[:MAX_TRIES], is_connectivity


def reconstruct(
    timelines: list[list[tuple[float, bool]]],
    runs: list[tuple[float, float | None]],
    start: float,
    end: float,
    offline_after: float,
    grace: float,
    end_state: int | None,
) -> list[list[Any]]:
    """
    Ereignisse [Zeit, Zustand] im Zeitraum [start, end) aus den Verläufen der
    Entitäten (Zeit, lebt) und den Läufen des Recorders (Start, Ende).

    end_state ist der Zustand des ersten eigenen Ereignisses bei end: Ein
    Ausfall, der dort weiterläuft, zählt auch, wenn er im Zeitraum kürzer
    als "Ausgefallen nach" ist.
    """
    # 1. Gerät weg, sobald alle bekannten Entitäten weg sind.
    changes = sorted((max(t, start), i, alive) for i, tl in enumerate(timelines) for t, alive in tl if t < end)
    known: dict[int, bool] = {}
    down_at: list[tuple[float, bool]] = []
    for t, i, alive in changes:
        known[i] = alive
        down = not any(known.values())
        if down_at and down_at[-1][0] == t:
            down_at.pop()
        if not down_at or down_at[-1][1] != down:
            down_at.append((t, down))
    if not down_at:
        return []
    first_known = down_at[0][0]

    # 2. Ausfälle: weg mindestens offline_after, nicht in der Anlaufphase
    # zurück.
    starts = [rs for rs, _re in runs]
    outages: list[tuple[float, float]] = []
    for idx, (a, down) in enumerate(down_at):
        if not down:
            continue
        b = down_at[idx + 1][0] if idx + 1 < len(down_at) else end
        tail = b >= end
        if tail and end_state == OFFLINE:
            outages.append((a, b))
            continue
        if b - a < offline_after:
            continue
        if not tail and any(rs <= a < rs + grace and b <= rs + grace for rs in starts):
            continue
        outages.append((a, b))

    # 3. Zeit ohne Lauf des Recorders: keine Daten.
    gaps = [
        (re, runs[i + 1][0])
        for i, (_rs, re) in enumerate(runs[:-1])
        if re is not None and runs[i + 1][0] > re
    ]

    def state_at(t: float) -> int | None:
        if any(ga <= t < gb for ga, gb in gaps) or t < first_known:
            return None
        return OFFLINE if any(a <= t < b for a, b in outages) else ONLINE

    points = sorted(
        {first_known, *(a for a, _b in outages), *(b for _a, b in outages), *(g for gap in gaps for g in gap)}
    )
    events: list[list[Any]] = []
    for t in points:
        if t < first_known or t >= end:
            continue
        state = state_at(t)
        if events and events[-1][1] == state:
            continue
        if not events and state is None:
            continue
        events.append([t, state])
    return events


def _timeline(hass: HomeAssistant, entity_id: str, start: datetime, end: datetime, dead: tuple[str, ...]) -> list[tuple[float, bool]] | None:
    """Verlauf (Zeit, lebt) einer Entität; None bei zu vielen Wechseln. Im Executor."""
    from homeassistant.components.recorder import history  # noqa: PLC0415

    states = history.state_changes_during_period(
        hass, start, end, entity_id, no_attributes=True, limit=ROW_LIMIT, include_start_time_state=True
    ).get(entity_id, [])
    if len(states) >= ROW_LIMIT:
        return None
    return [(s.last_changed.timestamp(), s.state not in dead) for s in states]


def _runs(hass: HomeAssistant, start: datetime, end: datetime) -> list[tuple[float, float | None]]:
    """Läufe des Recorders im Zeitraum (Start, Ende). Im Executor; bei Fehlern leer."""
    try:
        from homeassistant.components.recorder.db_schema import RecorderRuns  # noqa: PLC0415
        from homeassistant.helpers.recorder import session_scope  # noqa: PLC0415

        def ts(value: datetime | None) -> float | None:
            if value is None:
                return None
            return (value if value.tzinfo else value.replace(tzinfo=dt_util.UTC)).timestamp()

        with session_scope(hass=hass, read_only=True) as session:
            rows = (
                session.query(RecorderRuns.start, RecorderRuns.end)
                .filter(RecorderRuns.start < end)
                .filter((RecorderRuns.end.is_(None)) | (RecorderRuns.end > start))
                .order_by(RecorderRuns.start)
                .all()
            )
        return [(ts(rs), ts(re)) for rs, re in rows]
    except Exception as err:  # noqa: BLE001
        # Ohne Läufe: keine Lücken und keine Anlaufphase, sonst gleich.
        _LOGGER.debug("Läufe des Recorders nicht lesbar: %s", err)
        return []


async def async_backfill(
    hass: HomeAssistant,
    devices: list[tuple[str, list[er.RegistryEntry]]],
    first_events: dict[str, list[Any]],
    now: float,
    keep_days: int,
    offline_after: dict[str, float],
    grace: float,
) -> dict[str, list[list[Any]]]:
    """
    Ereignisse vor dem ersten eigenen Ereignis je Gerät (first_events:
    Gerät → [Zeit, Zustand]). offline_after: Gerät → Sekunden, weil es je
    Integration verschieden sein kann. Geräte ohne eigenes Ereignis bleiben aussen
    vor: ohne Gegenstück im Protokoll hiesse der letzte Zustand sonst "bis
    jetzt".
    """
    from homeassistant.components.recorder import get_instance  # noqa: PLC0415

    instance = get_instance(hass)
    start_dt = dt_util.utc_from_timestamp(now - keep_days * 86400)
    end_dt = dt_util.utc_from_timestamp(now)
    runs = await instance.async_add_executor_job(_runs, hass, start_dt, end_dt)
    out: dict[str, list[list[Any]]] = {}
    for device_id, entries in devices:
        first = first_events.get(device_id)
        if not first or first[0] <= start_dt.timestamp():
            continue
        picked, is_connectivity = candidates(entries)
        dead = (STATE_OFF, STATE_UNAVAILABLE) if is_connectivity else (STATE_UNAVAILABLE,)
        until = dt_util.utc_from_timestamp(first[0])
        timelines: list[list[tuple[float, bool]]] = []
        for entry in picked:
            if len(timelines) >= MAX_ENTITIES:
                break
            # Pro Entität ein Auftrag: der Executor des Recorders bleibt für
            # andere Abfragen (Verlauf, Logbuch) frei.
            tl = await instance.async_add_executor_job(_timeline, hass, entry.entity_id, start_dt, until, dead)
            if tl:
                timelines.append(tl)
        if not timelines:
            continue
        events = reconstruct(timelines, runs, start_dt.timestamp(), first[0], offline_after[device_id], grace, first[1])
        if events:
            out[device_id] = events
    return out
