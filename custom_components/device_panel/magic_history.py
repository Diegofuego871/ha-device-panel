"""
Rückblick für Magic Push (seit 2.6.0): Wie oft wäre eine Meldung in den letzten 24 Stunden gekommen?

Der Verlauf kommt aus dem Recorder von Home Assistant (wie bei Batterie und Empfang). Die Regel wird
mit derselben Prüfung (magic.cond_met) über die gespeicherten Zustände gelegt; ein Abschnitt, in dem
sie gilt, löst aus, wenn er mindestens "für" Sekunden dauert. Ohne Recorder oder ohne Verlauf ist das
Ergebnis leer (available False oder empty True): der Rückblick darf fehlen, die Regel geht trotzdem.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

from .magic import IGNORED, NUMERIC_KINDS, _float, cond_met, entity_kind

_LOGGER = logging.getLogger(__name__)

SPAN = 86400
MAX_POINTS = 96
MAX_FIRES = 5
MAX_INTERVALS = 60


def _states(hass: HomeAssistant, entity_id: str, start: datetime, end: datetime) -> list[tuple[float, str]]:
    """Zustände mit Zeit, der Stand zu Beginn als erster. Im Executor des Recorders."""
    from homeassistant.components.recorder import history  # noqa: PLC0415

    rows = history.state_changes_during_period(
        hass, start, end, entity_id, no_attributes=True, include_start_time_state=True
    ).get(entity_id, [])
    return [(max(row.last_changed.timestamp(), start.timestamp()), row.state) for row in rows]


def evaluate(
    rows: list[tuple[float, str]], kind: str, value: Any, for_s: int, now: float
) -> tuple[list[list[Any]], list[dict[str, Any]], int]:
    """
    Abschnitte, in denen die Bedingung galt, und die Auslösungen daraus.

    Gibt (Abschnitte [von, bis oder None, zählt], Auslösungen neueste zuerst, Zahl aller Auslösungen) zurück.
    "ändert sich": jede Änderung, deren neuer Wert mindestens "für" Sekunden blieb, ist eine Auslösung.
    """
    segments: list[tuple[float, float, str]] = []
    for i, (ts, state) in enumerate(rows):
        end = rows[i + 1][0] if i + 1 < len(rows) else now
        if end > ts:
            segments.append((ts, end, state))
    intervals: list[list[Any]] = []
    fires: list[dict[str, Any]] = []
    if kind == "change":
        previous: str | None = None
        for ts, end, state in segments:
            if state in IGNORED:
                previous = None
                continue
            if previous is not None and state != previous:
                held = end - ts
                counts = held >= for_s
                intervals.append([ts, None if end >= now else end, counts])
                if counts:
                    fires.append({"at": ts + for_s, "start": ts, "end": None if end >= now else end, "duration": held, "extreme": None})
            previous = state
    else:
        current: list[Any] | None = None
        values: list[float] = []
        for ts, end, state in segments:
            met = cond_met(kind, value, state)
            if met:
                if current is None:
                    current, values = [ts, end], []
                current[1] = end
                number = _float(state)
                if number is not None:
                    values.append(number)
            elif current is not None:
                _close(current, values, kind, for_s, now, intervals, fires)
                current = None
        if current is not None:
            _close(current, values, kind, for_s, now, intervals, fires)
    count = len(fires)
    fires.sort(key=lambda f: f["start"], reverse=True)
    return intervals[-MAX_INTERVALS:], fires[:MAX_FIRES], count


def _close(
    current: list[Any], values: list[float], kind: str, for_s: int, now: float, intervals: list[list[Any]], fires: list[dict[str, Any]]
) -> None:
    start, end = current
    open_end = end >= now
    held = end - start
    counts = held >= for_s
    intervals.append([start, None if open_end else end, counts])
    if counts:
        extreme = (min(values) if kind == "below" else max(values)) if values and kind in NUMERIC_KINDS else None
        fires.append({"at": start + for_s, "start": start, "end": None if open_end else end, "duration": held, "extreme": extreme})


def points(rows: list[tuple[float, str]], start: float, now: float) -> list[list[float]]:
    """Zahlen für das Diagramm, höchstens MAX_POINTS (Mittel je Abschnitt), mit dem letzten Wert bis jetzt."""
    numbers = [(ts, number) for ts, state in rows if (number := _float(state)) is not None]
    if not numbers:
        return []
    numbers.append((now, numbers[-1][1]))
    if len(numbers) <= MAX_POINTS:
        return [[round(ts, 1), round(v, 3)] for ts, v in numbers]
    size = (now - start) / MAX_POINTS
    buckets: dict[int, list[float]] = {}
    for ts, number in numbers:
        buckets.setdefault(min(MAX_POINTS - 1, int((ts - start) // size)), []).append(number)
    return [[round(start + (i + 0.5) * size, 1), round(sum(v) / len(v), 3)] for i, v in sorted(buckets.items())]


async def async_history(
    hass: HomeAssistant, entity_id: str, kind: str, value: Any, for_s: int, now: float | None = None
) -> dict[str, Any]:
    """Rückblick der letzten 24 Stunden für eine Regel (noch nicht gespeichert)."""
    now = now if now is not None else time.time()
    start = now - SPAN
    result: dict[str, Any] = {
        "available": True,
        "empty": True,
        "start": start,
        "end": now,
        "kind": entity_kind(hass.states.get(entity_id), er.async_get(hass).async_get(entity_id)),
        "points": [],
        "intervals": [],
        "fires": [],
        "count": 0,
    }
    if "recorder" not in hass.config.components:
        result["available"] = False
        return result
    try:
        from homeassistant.components.recorder import get_instance  # noqa: PLC0415

        rows = await get_instance(hass).async_add_executor_job(
            _states, hass, entity_id, dt_util.utc_from_timestamp(start), dt_util.utc_from_timestamp(now)
        )
    except Exception as err:  # noqa: BLE001 - der Rückblick ist nur eine Zugabe
        _LOGGER.warning("Magic Push: Verlauf von %s nicht lesbar: %s", entity_id, err)
        result["available"] = False
        return result
    rows = sorted(rows)
    usable = [r for r in rows if r[1] not in IGNORED]
    if not usable:
        return result
    result["empty"] = False
    result["points"] = points(rows, start, now)
    result["intervals"], result["fires"], result["count"] = evaluate(rows, kind, value, for_s, now)
    return result
