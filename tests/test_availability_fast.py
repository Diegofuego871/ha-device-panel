"""
Schnelle Abfragen des Verfügbarkeitsprotokolls (2.204.1): segments() springt per Binärsuche zum Zeitraum, device_summary() und incidents()
wenden bridged() nur auf das Ende der Historie an. Die Ergebnisse müssen genau denen der früheren Fassung entsprechen (hier als Referenz).
"""

from __future__ import annotations

import random
from typing import Any

from custom_components.device_panel import availability
from custom_components.device_panel.availability import OFFLINE, ONLINE, AvailabilityLog, _tail, bridged, segments, summarize


def _segments_ref(events: list[list[Any]], start: float, end: float) -> list[list[Any]]:
    out: list[list[Any]] = []
    state = None
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


def _incidents_starts_ref(events: list[list[Any]], start: float) -> list[float]:
    found, prev = [], None
    for at, st in bridged(events):
        if st == OFFLINE and prev != OFFLINE and at >= start:
            found.append(at)
        prev = st
    return found


def _random_events(rng: random.Random, n: int) -> list[list[Any]]:
    t, events, last = 0.0, [], object()
    for _ in range(n):
        # Gleiche Zeitpunkte kommen vor (Neustart, Lücke), "keine Daten" nie zweimal hintereinander (wie evaluate)
        t += rng.choice((0.0, 1.0, 30.0, 600.0, 3600.0, 7200.0))
        st = rng.choice((ONLINE, OFFLINE, OFFLINE, None))
        if st is None and last is None:
            continue
        events.append([t, st])
        last = st
    return events


def test_fast_queries_match_the_reference() -> None:
    rng = random.Random(7)
    for _ in range(400):
        events = _random_events(rng, rng.randint(0, 60))
        top = events[-1][0] if events else 1000.0
        for _ in range(12):
            start = rng.uniform(-1000.0, top + 1000.0)
            if rng.random() < 0.3 and events:
                start = rng.choice(events)[0]  # Grenze genau auf einem Ereignis
            end = start + rng.choice((1.0, 600.0, 86400.0, 10 * 86400.0))
            assert segments(events, start, end) == _segments_ref(events, start, end)
            log = AvailabilityLog.__new__(AvailabilityLog)
            log._events = {"d": events}
            assert log.device_summary("d", end - start, end) == summarize(_segments_ref(bridged(events), start, end))
            assert [i["at"] for i in log.incidents(end, end - start)] == []  # ein Gerät allein ist nie ein Sammelausfall
            # Beginn der Ausfälle wie in incidents(), auf dem Ende der Historie
            got = []
            prev = None
            for at, st in bridged(_tail(events, start)):
                if st == OFFLINE and prev != OFFLINE and at >= start:
                    got.append(at)
                prev = st
            assert got == _incidents_starts_ref(events, start)


def test_incidents_and_pulse_unchanged_for_many_devices(monkeypatch) -> None:
    rng = random.Random(11)
    events = {f"d{i}": _random_events(rng, 80) for i in range(15)}
    # Drei Geräte fallen innert 2 Minuten aus: ein Sammelausfall
    for i, dev in enumerate(("d0", "d1", "d2")):
        top = events[dev][-1][0] if events[dev] else 0.0
        events[dev] += [[top + 500_000.0 + i * 30, ONLINE], [top + 600_000.0 + i * 30, OFFLINE]]
    log = AvailabilityLog.__new__(AvailabilityLog)
    log._events = events
    top = max(e[-1][0] for e in events.values() if e) + 3600
    windows = [(rng.uniform(0, top), rng.choice((3600.0, 86400.0, 7 * 86400.0, top))) for _ in range(60)]
    fast = [(log.incidents(now, seconds), log.pulse(now)) for now, seconds in windows]
    # Referenz: bridged() über die ganze Historie, segments() wie früher
    monkeypatch.setattr(availability, "_tail", lambda events, _start: events)
    monkeypatch.setattr(availability, "segments", _segments_ref)
    slow = [(log.incidents(now, seconds), log.pulse(now)) for now, seconds in windows]
    assert fast == slow
    assert any(found for found, _pulse in fast)
