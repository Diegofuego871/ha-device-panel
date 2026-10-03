"""
Batterie-Verlauf für das Geräte-Popup (seit 0.22.0, docs/mockups/battery-history-v1, A).

Quelle ist der Recorder, kein eigenes Protokoll: 24 Std. und 7 Tage aus dem
Verlauf (jede Änderung), 30 Tage und 3 Monate aus der Langzeitstatistik
(Stundenmittel, bleibt über die Aufbewahrung des Recorders hinaus). Führt der
Sensor keine Statistik (ohne state_class), reicht der Verlauf nur so weit wie
der Recorder; das Panel sagt das.

Ein Batteriewechsel ist ein Sprung um mindestens CHANGE_JUMP Prozentpunkte
nach oben innert CHANGE_WINDOW.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from datetime import datetime
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

_LOGGER = logging.getLogger(__name__)

RANGES = {"24h": 1, "7d": 7, "30d": 30, "90d": 90}
# Ab so vielen Tagen die Langzeitstatistik (Stundenwerte) statt des Verlaufs.
STATS_FROM_DAYS = 30
# Mehr Punkte zeichnet das Panel nicht sinnvoll; darüber Mittel pro Abschnitt.
MAX_POINTS = 1000
CHANGE_JUMP = 30
CHANGE_WINDOW = 3 * 3600


def battery_entity(hass: HomeAssistant, entries: list[er.RegistryEntry]) -> str | None:
    """Prozent-Sensor der Batterie (wie devices.battery), sonst None."""
    from .devices import _device_class  # noqa: PLC0415

    for entry in entries:
        if entry.disabled_by or entry.domain != "sensor":
            continue
        if _device_class(entry, hass.states.get(entry.entity_id)) == "battery":
            return entry.entity_id
    return None


def _value(state: str) -> float | None:
    try:
        value = float(state)
    except (TypeError, ValueError):
        return None
    return value if 0 <= value <= 100 else None


def _history(
    hass: HomeAssistant, entity_id: str, start: datetime, end: datetime, parse: Callable[[str], float | None] = _value
) -> list[tuple[float, float]]:
    """Verlauf (Zeit, Wert) mit dem Stand zu Beginn; parse prüft den Wert (auch für den Empfang). Im Executor."""
    from homeassistant.components.recorder import history  # noqa: PLC0415

    states = history.state_changes_during_period(
        hass, start, end, entity_id, no_attributes=True, include_start_time_state=True
    ).get(entity_id, [])
    out: list[tuple[float, float]] = []
    for state in states:
        value = parse(state.state)
        if value is not None:
            out.append((max(state.last_changed.timestamp(), start.timestamp()), value))
    return out


def _statistics(hass: HomeAssistant, entity_id: str, start: datetime, end: datetime) -> list[tuple[float, float]] | None:
    """Stundenmittel aus der Langzeitstatistik; None ohne Statistik. Im Executor."""
    from homeassistant.components.recorder.statistics import statistics_during_period  # noqa: PLC0415

    rows = statistics_during_period(hass, start, end, {entity_id}, "hour", None, {"mean"}).get(entity_id)
    if not rows:
        return None
    # Mitte der Stunde: der Wert gilt für die ganze Stunde.
    return [(float(row["start"]) + 1800, float(row["mean"])) for row in rows if row.get("mean") is not None]


def thin(points: list[tuple[float, float]], start: float, end: float, limit: int = MAX_POINTS) -> list[tuple[float, float]]:
    """Höchstens limit Punkte: Mittel pro gleich langem Abschnitt, letzter Punkt bleibt."""
    if len(points) <= limit:
        return points
    size = (end - start) / limit
    buckets: dict[int, list[tuple[float, float]]] = {}
    for t, v in points[:-1]:
        buckets.setdefault(min(limit - 1, int((t - start) // size)), []).append((t, v))
    out = [
        (sum(t for t, _v in group) / len(group), sum(v for _t, v in group) / len(group))
        for _i, group in sorted(buckets.items())
    ]
    out.append(points[-1])
    return out


def changes(points: list[tuple[float, float]]) -> list[dict[str, float]]:
    """
    Batteriewechsel: Anstieg um mindestens CHANGE_JUMP Punkte gegenüber dem
    vorigen Punkt oder innert CHANGE_WINDOW (über zwei Stundenmittel
    verteilt). "Von" ist der
    tiefste Wert davor, "auf" der höchste kurz danach, die Zeit die des
    Anstiegs.
    """
    found: list[dict[str, float]] = []
    i = 1
    while i < len(points):
        t, v = points[i]
        # Der vorige Punkt zählt immer (Sensoren, die selten melden), dazu
        # alle im Fenster (Stundenmittel, die den Sprung verteilen).
        before = [points[i - 1][1]] + [pv for pt, pv in points[:i] if t - pt <= CHANGE_WINDOW]
        if before and v - min(before) >= CHANGE_JUMP:
            low = min(before)
            after = [pv for pt, pv in points[i:] if pt - t <= CHANGE_WINDOW]
            found.append({"at": t, "from": round(low), "to": round(max(after))})
            # Weiter nach dem Fenster: ein Wechsel zählt einmal.
            while i < len(points) and points[i][0] - t <= CHANGE_WINDOW:
                i += 1
            continue
        i += 1
    return found


async def async_battery_history(
    hass: HomeAssistant, entity_id: str, range_key: str, threshold: int | None, now: float | None = None
) -> dict[str, Any]:
    """Punkte, Quelle, Wechsel und Schwelle für das Fenster "Batterie"."""
    now = now if now is not None else time.time()
    days = RANGES.get(range_key, 1)
    start = now - days * 86400
    result: dict[str, Any] = {
        "entity_id": entity_id,
        "start": start,
        "end": now,
        "source": "none",
        "points": [],
        "first": None,
        "changes": [],
        "threshold": threshold,
    }
    state = hass.states.get(entity_id)
    current = _value(state.state) if state else None
    if "recorder" not in hass.config.components:
        if current is not None:
            result["points"] = [[now, current]]
        return result
    from homeassistant.components.recorder import get_instance  # noqa: PLC0415

    instance = get_instance(hass)
    start_dt, end_dt = dt_util.utc_from_timestamp(start), dt_util.utc_from_timestamp(now)
    points: list[tuple[float, float]] | None = None
    source = "history"
    try:
        if days >= STATS_FROM_DAYS:
            points = await instance.async_add_executor_job(_statistics, hass, entity_id, start_dt, end_dt)
            if points is not None:
                source = "statistics"
        if points is None:
            points = await instance.async_add_executor_job(_history, hass, entity_id, start_dt, end_dt)
    except Exception as err:  # noqa: BLE001
        # Recorder nicht bereit oder Abfrage fehlgeschlagen: wie ohne Daten.
        _LOGGER.debug("Batterie-Verlauf für %s nicht lesbar: %s", entity_id, err)
        points = []
    points = sorted(p for p in points if start <= p[0] <= now)
    # Bis jetzt: der aktuelle Stand als letzter Punkt.
    if current is not None and (not points or points[-1][0] < now):
        points.append((now, current))
    if not points:
        return result
    result["source"] = source
    result["first"] = points[0][0]
    result["changes"] = changes(points)
    result["points"] = [[round(t, 1), round(v, 1)] for t, v in thin(points, start, now)]
    return result
