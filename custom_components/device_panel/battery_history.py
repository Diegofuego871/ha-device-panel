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

from homeassistant.core import HomeAssistant, State
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

_LOGGER = logging.getLogger(__name__)

RANGES = {"24h": 1, "7d": 7, "30d": 30, "90d": 90, "180d": 180, "365d": 365}
# Ab so vielen Tagen die Langzeitstatistik (Stundenwerte) statt des Verlaufs.
STATS_FROM_DAYS = 30
# Ab so vielen Tagen Tagesmittel statt Stundenmittel (6 und 12 Monate; seit
# 0.29.0): weniger Zeilen, und mehr als 1000 Punkte zeichnet das Panel nicht.
DAILY_FROM_DAYS = 180
# Mehr Punkte zeichnet das Panel nicht sinnvoll; darüber Mittel pro Abschnitt.
MAX_POINTS = 1000
CHANGE_JUMP = 30
CHANGE_WINDOW = 3 * 3600
# Prognose "wie lange hält die Batterie noch" (seit 1.5.0): gerechnet wird seit
# dem letzten Batteriewechsel, sonst ab dem ältesten Wert, höchstens ein Jahr
# zurück, bis zur Warnschwelle des Geräts (ohne Warnung bis 0 %).
FORECAST_DAYS = 365
# Mindestens so viele Tage (und Tageswerte) seit dem Wechsel, sonst keine Prognose.
FORECAST_MIN_DAYS = 7
FORECAST_MIN_POINTS = 5
# Fällt der Wert über die ganze Spanne um weniger als so viele Punkte, gilt er als gleichbleibend.
FORECAST_MIN_DROP = 2.0


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


def _statistics(
    hass: HomeAssistant, entity_id: str, start: datetime, end: datetime, period: str = "hour"
) -> list[tuple[float, float]] | None:
    """Stunden- oder Tagesmittel aus der Langzeitstatistik; None ohne Statistik. Im Executor."""
    from homeassistant.components.recorder.statistics import statistics_during_period  # noqa: PLC0415

    rows = statistics_during_period(hass, start, end, {entity_id}, period, None, {"mean"}).get(entity_id)
    if not rows:
        return None
    # Mitte der Stunde bzw. des Tags: der Wert gilt für den ganzen Abschnitt.
    half = 43200 if period == "day" else 1800
    return [(float(row["start"]) + half, float(row["mean"])) for row in rows if row.get("mean") is not None]


def held(
    points: list[tuple[float, float]], state: State | None, parse: Callable[[str], float | None], start: float, now: float
) -> tuple[list[tuple[float, float]], float | None]:
    """
    Punkte bis jetzt ergänzen: Der aktuelle Wert gilt seit last_changed des
    Zustands. Der Recorder kennt das nicht, wenn sich der Wert lange nicht
    geändert hat (im Zeitraum keine Zeile, der Stand zu Beginn älter als die
    Aufbewahrung) oder die letzte Änderung noch nicht geschrieben ist; ohne
    den Schritt bliebe nur ein Punkt "jetzt" (Fehlerbericht des Nutzers,
    0.26.0). Gibt die Punkte zurück und, wenn der Recorder im Zeitraum nichts
    hatte, seit wann der Wert unverändert ist.
    """
    value = parse(state.state) if state is not None else None
    if value is None:
        return points, None
    since = state.last_changed.timestamp()
    steady = since if not points else None
    if not any(t >= since for t, _v in points):
        points.append((max(since, start), value))
    if points[-1][0] < now:
        points.append((now, value))
    return points, steady


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


def changes(points: list[tuple[float, float]], window: float = CHANGE_WINDOW) -> list[dict[str, float]]:
    """
    Batteriewechsel: Anstieg um mindestens CHANGE_JUMP Punkte gegenüber dem
    vorigen Punkt oder innert window (über zwei Stundenmittel verteilt; bei
    Tagesmitteln über zwei Tage, sonst zählte ein Wechsel doppelt). "Von" ist der
    tiefste Wert davor, "auf" der höchste kurz danach, die Zeit die des
    Anstiegs.
    """
    found: list[dict[str, float]] = []
    i = 1
    while i < len(points):
        t, v = points[i]
        # Der vorige Punkt zählt immer (Sensoren, die selten melden), dazu
        # alle im Fenster (Stundenmittel, die den Sprung verteilen).
        before = [points[i - 1][1]] + [pv for pt, pv in points[:i] if t - pt <= window]
        if before and v - min(before) >= CHANGE_JUMP:
            low = min(before)
            after = [pv for pt, pv in points[i:] if pt - t <= window]
            found.append({"at": t, "from": round(low), "to": round(max(after))})
            # Weiter nach dem Fenster: ein Wechsel zählt einmal.
            while i < len(points) and points[i][0] - t <= window:
                i += 1
            continue
        i += 1
    return found


def _regression(xs: list[float], ys: list[float]) -> tuple[float, float, float, float] | None:
    """Gerade y = a + b*x nach kleinsten Quadraten: (a, b, R², Standardfehler von b); None ohne Streuung in x."""
    n = len(xs)
    if n < 3:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    if sxx <= 0:
        return None
    b = sum((x - mx) * (y - my) for x, y in zip(xs, ys, strict=True)) / sxx
    a = my - b * mx
    ssr = sum((y - (a + b * x)) ** 2 for x, y in zip(xs, ys, strict=True))
    sst = sum((y - my) ** 2 for y in ys)
    r2 = 1 - ssr / sst if sst > 0 else 0.0
    se = ((ssr / (n - 2)) / sxx) ** 0.5 if n > 2 else 0.0
    return a, b, r2, se


def forecast(
    points: list[tuple[float, float]], now: float, threshold: int | None, window: float = CHANGE_WINDOW
) -> dict[str, Any]:
    """
    Wann die Batterie die Warnschwelle erreicht (ohne Warnung: 0 %), als
    Gerade durch die Tagesmittel seit dem letzten Wechsel. Kein KI-Aufruf: eine
    Näherung, die ihre Sicherheit nennt. Status: "none" (keine Daten), "short"
    (zu wenig Tage), "flat" (fällt kaum), "reached" (Schwelle erreicht), "ok".
    "accelerating": der Abfall wird zum Ende hin steiler (typisch für
    Lithium-Knopfzellen), die Batterie hält dann eher kürzer.
    """
    target = threshold if threshold is not None else 0
    base: dict[str, Any] = {"target": target, "target_is_zero": threshold is None}
    if not points:
        return {**base, "status": "none"}
    found = changes(points, window)
    # Nach dem Wechsel erst nach dem Fenster beginnen: die Tagesmittel um den Sprung sind gemischt.
    start = found[-1]["at"] + window if found else points[0][0]
    base["after_change"] = bool(found)
    base["since"] = found[-1]["at"] if found else points[0][0]
    days: dict[int, list[float]] = {}
    for t, v in points:
        if t >= start:
            days.setdefault(int(t // 86400), []).append(v)
    xs = [(day * 86400 + 43200 - now) / 86400 for day in sorted(days)]
    ys = [sum(days[day]) / len(days[day]) for day in sorted(days)]
    span = (xs[-1] - xs[0]) if xs else 0.0
    base["days_used"] = round(span, 1)
    if len(xs) < FORECAST_MIN_POINTS or span < FORECAST_MIN_DAYS:
        return {**base, "status": "short", "min_days": FORECAST_MIN_DAYS}
    fit = _regression(xs, ys)
    if fit is None:
        return {**base, "status": "short", "min_days": FORECAST_MIN_DAYS}
    a, b, r2, se = fit
    current = a  # Wert der Geraden jetzt (x = 0)
    last = points[-1][1]
    base["current"] = round(current, 1)
    base["per_month"] = round(-b * 30.44, 2)
    if last <= target:
        return {**base, "status": "reached"}
    if b > -0.01 or -b * span < FORECAST_MIN_DROP:
        return {**base, "status": "flat"}
    # Von der Geraden, solange sie über der Schwelle liegt (glatter als ein einzelner Wert), sonst vom letzten Wert.
    left = (current if current > target else last) - target
    eta = left / -b
    # Spanne: Steigung ± ein Standardfehler (flacher = später, steiler = früher)
    low = left / -(b - se) if b - se < 0 else None
    high = left / -(b + se) if b + se < 0 else None
    confidence = "high" if span >= 60 and r2 >= 0.8 else "medium" if span >= 21 and r2 >= 0.5 else "low"
    # Meldet der Sensor nur grobe Stufen (z. B. 10er-Schritte), ist der Zeitpunkt der Stufen
    # zufällig: nie "hoch".
    if confidence == "high" and len({round(y) for y in ys}) < 8:
        confidence = "medium"
    accelerating = False
    if span >= 30 and len(xs) >= 9:
        third = len(xs) // 3
        first, final = _regression(xs[:third], ys[:third]), _regression(xs[-third:], ys[-third:])
        if first and final:
            accelerating = final[1] <= 1.5 * first[1] and final[1] - first[1] < -0.05 and final[1] < -0.02
    return {
        **base,
        "status": "ok",
        "days": round(eta, 1),
        "at": round(now + eta * 86400),
        "days_low": round(low, 1) if low is not None else None,
        "days_high": round(high, 1) if high is not None else None,
        "confidence": confidence,
        "r2": round(r2, 2),
        "accelerating": accelerating,
    }


async def _load(
    hass: HomeAssistant, entity_id: str, days: int, now: float, state: State | None
) -> tuple[list[tuple[float, float]], str, str, float | None]:
    """
    Punkte der letzten days Tage bis jetzt: (Punkte, Quelle, "hour"|"day",
    unverändert seit). Ab 30 Tagen die Langzeitstatistik (Tages- ab 180 Tagen),
    sonst oder ohne Statistik der Verlauf. Im Executor des Recorders.
    """
    from homeassistant.components.recorder import get_instance  # noqa: PLC0415

    instance = get_instance(hass)
    start = now - days * 86400
    start_dt, end_dt = dt_util.utc_from_timestamp(start), dt_util.utc_from_timestamp(now)
    points: list[tuple[float, float]] | None = None
    source, period = "history", "hour"
    try:
        if days >= STATS_FROM_DAYS:
            period = "day" if days >= DAILY_FROM_DAYS else "hour"
            points = await instance.async_add_executor_job(_statistics, hass, entity_id, start_dt, end_dt, period)
            if points is not None:
                source = "statistics"
            else:
                period = "hour"
        if points is None:
            points = await instance.async_add_executor_job(_history, hass, entity_id, start_dt, end_dt)
    except Exception as err:  # noqa: BLE001
        # Recorder nicht bereit oder Abfrage fehlgeschlagen: wie ohne Daten,
        # aber im Log sichtbar (sonst ist ein leerer Verlauf nicht zu klären).
        _LOGGER.warning("Batterie-Verlauf für %s nicht lesbar: %s", entity_id, err)
        points = []
    points = sorted(p for p in points if start <= p[0] <= now)
    # Bis jetzt: der aktuelle Stand gilt seit seiner letzten Änderung.
    points, steady = held(points, state, _value, start, now)
    return points, source, period, steady


async def async_battery_history(
    hass: HomeAssistant, entity_id: str, range_key: str, threshold: int | None, now: float | None = None
) -> dict[str, Any]:
    """Punkte, Quelle, Wechsel, Schwelle und Prognose für das Fenster "Batterie"."""
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
        "steady_since": None,
        "period": "hour",
        "forecast": forecast([], now, threshold),
    }
    state = hass.states.get(entity_id)
    if "recorder" not in hass.config.components:
        # Ohne Recorder bleibt der aktuelle Wert seit seiner letzten Änderung.
        points, result["steady_since"] = held([], state, _value, start, now)
        result["points"] = [[round(t, 1), round(v, 1)] for t, v in points]
        return result
    points, source, period, result["steady_since"] = await _load(hass, entity_id, days, now, state)
    # Die Prognose rechnet immer über das längste Fenster, unabhängig vom Reiter.
    if days >= FORECAST_DAYS:
        long, long_period = points, period
    else:
        long, _src, long_period, _steady = await _load(hass, entity_id, FORECAST_DAYS, now, state)
    result["forecast"] = forecast(long, now, threshold, 2 * 86400 + 3600 if long_period == "day" else CHANGE_WINDOW)
    if not points:
        return result
    result["source"] = source
    result["period"] = period
    result["first"] = points[0][0]
    result["changes"] = changes(points, 2 * 86400 + 3600 if period == "day" else CHANGE_WINDOW)
    result["points"] = [[round(t, 1), round(v, 1)] for t, v in thin(points, start, now)]
    return result
