"""
Verläufe in linearer Zeit (2.204.1): changes() (Batteriewechsel) gibt dasselbe wie die frühere Fassung (hier als Referenz), auch bei
gleichen Zeitpunkten, Sprüngen am Rand und mehreren Wechseln; 20'000 Punkte brauchen keine Sekunden mehr. Dazu die Vorschau "Verlauf" von
Magic Push mit mehreren Bedingungen (evaluate_tree).
"""

from __future__ import annotations

import random
import time

from custom_components.device_panel.battery_history import CHANGE_JUMP, CHANGE_WINDOW, changes


def _changes_ref(points: list[tuple[float, float]], window: float = CHANGE_WINDOW) -> list[dict[str, float]]:
    found: list[dict[str, float]] = []
    i = 1
    while i < len(points):
        t, v = points[i]
        before = [points[i - 1][1]] + [pv for pt, pv in points[:i] if t - pt <= window]
        if before and v - min(before) >= CHANGE_JUMP:
            low = min(before)
            after = [pv for pt, pv in points[i:] if pt - t <= window]
            found.append({"at": t, "from": round(low), "to": round(max(after))})
            while i < len(points) and points[i][0] - t <= window:
                i += 1
            continue
        i += 1
    return found


def _series(rng: random.Random) -> list[tuple[float, float]]:
    t, v, out = 0.0, rng.uniform(20, 100), []
    for _ in range(rng.randint(0, 300)):
        t += rng.choice((0.0, 60.0, 600.0, 3600.0, 4 * 3600.0, 86400.0))
        r = rng.random()
        if r < 0.05:
            v = rng.uniform(80, 100)  # Wechsel
        elif r < 0.1:
            v = max(0.0, v - rng.uniform(5, 30))  # Ausreisser nach unten
        else:
            v = max(0.0, min(100.0, v + rng.uniform(-1.5, 0.5)))
        out.append((t, round(v, 1)))
    return sorted(out)


def test_same_result_as_before() -> None:
    rng = random.Random(5)
    for _ in range(500):
        points = _series(rng)
        for window in (CHANGE_WINDOW, 2 * 86400 + 3600):
            assert changes(points, window) == _changes_ref(points, window)


def test_many_points_are_fast() -> None:
    points = [(i * 120.0, 100 - i * 50 / 20000) for i in range(20000)]
    start = time.perf_counter()
    changes(points)
    assert time.perf_counter() - start < 0.5


def test_magic_history_with_many_values_is_fast() -> None:
    """2.204.1: Vorschau "Verlauf" von Magic Push mit mehreren Bedingungen und vielen Werten (Leistung, Temperatur) in linearer Zeit."""
    from custom_components.device_panel.magic_history import SPAN, evaluate_tree  # noqa: PLC0415

    now = 10 * 86400.0
    start = now - SPAN
    n = 6000
    step = SPAN / n
    rows_by = {
        "sensor.t": [(start + i * step, str(20 + (i % 50) / 10)) for i in range(n)],
        "binary_sensor.w": [(start + i * step * 7, "on" if i % 2 else "off") for i in range(n // 7)],
    }
    tree = {"op": "and", "items": [{"entity_id": "sensor.t", "kind": "above", "value": 22.0, "reset_value": None}, {"entity_id": "binary_sensor.w", "kind": "is", "value": "on", "reset_value": None}]}
    begin = time.perf_counter()
    intervals, _fires, count, _spans = evaluate_tree(rows_by, tree, 600, now, start)
    assert time.perf_counter() - begin < 0.5
    assert intervals and count >= 0
