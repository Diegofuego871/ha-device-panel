"""
Routinen und Umstellung auf Winterzeit (2.204.1): In der doppelten Stunde (Europe/Zurich, 25.10.2026, 02:00–03:00 zweimal) lieferte die Planung
für "täglich 02:30" einen Zeitpunkt in der Vergangenheit (das erste 02:30). Datumsvergleiche mit gleicher Zeitzone vergleichen in Python die
Wanduhrzeit und übersehen die Umstellung. Folge: Die Routine lief sofort erneut und plante danach wieder dasselbe vergangene 02:30, jede Sekunde,
bis zum zweiten 02:30 (je nach Nachholzeit schaltend oder als "verpasst" im Protokoll).
"""

from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from custom_components.device_panel.routines import first_due, next_runs, occurrence_after

TZ = ZoneInfo("Europe/Zurich")


def _ts(text: str) -> float:
    return datetime.fromisoformat(text).replace(tzinfo=timezone.utc).timestamp()


def test_repeat_never_plans_the_past_in_the_repeated_hour() -> None:
    for repeat in ({"repeat": "daily"}, {"repeat": "weekly", "weekdays": [0, 1, 2, 3, 4, 5, 6]}, {"repeat": "monthly", "mday": 25}):
        routine = {"kind": "repeat", "time": "02:30", **repeat}
        # Jede Minute von 00:00 bis 02:00 UTC (02:00 Sommerzeit bis 03:00 Winterzeit)
        for minute in range(0, 121):
            now = _ts("2026-10-25T00:00:00") + minute * 60
            due = first_due(routine, now, TZ)
            assert due is not None and due > now, (repeat, minute)
            after = datetime.fromtimestamp(now, timezone.utc).astimezone(TZ)
            nxt = occurrence_after(routine, after, TZ)
            assert nxt is not None and nxt.timestamp() > now


def test_runs_once_on_the_day_of_the_change() -> None:
    routine = {"kind": "repeat", "repeat": "daily", "time": "02:30"}
    runs = next_runs(routine, _ts("2026-10-24T20:00:00"), TZ, count=2)
    # 25.10. um 02:30 Sommerzeit (00:30 UTC), danach 26.10. um 02:30 Winterzeit (01:30 UTC): kein zweites 02:30 am 25.10.
    assert [r["ts"] for r in runs] == [_ts("2026-10-25T00:30:00"), _ts("2026-10-26T01:30:00")]


def test_missing_time_in_spring_moves_one_hour() -> None:
    routine = {"kind": "repeat", "repeat": "daily", "time": "02:30"}
    assert first_due(routine, _ts("2026-03-29T00:00:00"), TZ) == _ts("2026-03-29T01:30:00")
