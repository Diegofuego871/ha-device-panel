"""Speicher (2.117.0): Aufbewahrung und Grösse der Verläufe von Verfügbarkeit und Empfang, Belegung aller Dateien."""

from __future__ import annotations

import time
from pathlib import Path

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel import storage_ws
from custom_components.device_panel.availability import AvailabilityLog
from custom_components.device_panel.const import DOMAIN
from custom_components.device_panel.signal_history import HOUR_SECONDS, SignalLog


def _setup(hass: HomeAssistant, options: dict) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options=options)
    entry.add_to_hass(hass)
    return entry


def test_availability_days_cut_old_events_but_keep_the_state(hass: HomeAssistant) -> None:
    _setup(hass, {"availability_keep_days": 7})
    log = AvailabilityLog(hass)
    now = time.time()
    log._events = {"a": [[now - 20 * 86400, 1], [now - 10 * 86400, 0], [now - 3 * 86400, 1]]}
    log.apply_limits()
    # Die Ereignisse vor 7 Tagen fallen weg; der Zustand davor (ausgefallen) steht am Anfang des Zeitraums
    assert [e[1] for e in log._events["a"]] == [0, 1]
    assert abs(log._events["a"][0][0] - (now - 7 * 86400)) < 5


def test_availability_mb_drops_the_oldest_events_of_all_devices(hass: HomeAssistant) -> None:
    _setup(hass, {"availability_max_mb": 1})
    log = AvailabilityLog(hass)
    now = time.time()
    # Viele Ereignisse: wechselnd online/ausgefallen, je 30 Sekunden Abstand, über mehrere Geräte
    log._events = {f"dev{n}": [[now - 20 * 86400 + i * 30 + n, i % 2] for i in range(8000)] for n in range(10)}
    before = log.size()
    assert before > 1048576
    log.apply_limits()
    assert 0 < log.size() <= 1048576
    # Die neuesten Ereignisse bleiben, die ältesten sind weg
    assert all(events[-1][0] > now - 20 * 86400 + 7990 * 30 for events in log._events.values())
    usage = log.usage()
    assert usage["bytes"] == log.size() and usage["devices"] == 10 and usage["days"] >= 1


def test_signal_days_and_mb(hass: HomeAssistant) -> None:
    _setup(hass, {"signal_keep_days": 7, "signal_max_mb": 1})
    log = SignalLog(hass)
    now = time.time()
    now -= now % HOUR_SECONDS
    # 30 Tage Stundenwerte für 300 Geräte (aufsteigend): weit über 1 MB, auch noch nach den 7 Tagen
    log._hours = {f"d{n}": [[now - h * HOUR_SECONDS, -70.0, -80.0, -60.0] for h in range(30 * 24 - 1, -1, -1)] for n in range(300)}
    assert log.size() > 1048576
    log.apply_limits()
    assert log.size() <= 1048576
    # Die Tage-Grenze (7) gilt zuerst, dann kürzt die MB-Grenze weiter; die neueste Stunde bleibt
    assert all(rows[-1][0] == now for rows in log._hours.values())
    oldest = min(rows[0][0] for rows in log._hours.values())
    assert oldest >= now - 7 * 86400
    assert oldest > now - 7 * 86400 + HOUR_SECONDS  # die MB-Grenze hat über die 7 Tage hinaus gekürzt
    usage = log.usage()
    assert usage["bytes"] == log.size() and usage["devices"] == 300 and usage["days"] <= 7


def test_other_sizes_groups_files(tmp_path: Path) -> None:
    (tmp_path / "device_panel.notify").write_bytes(b"x" * 100)
    (tmp_path / "device_panel.new").write_bytes(b"x" * 50)
    (tmp_path / "device_panel.ai").write_bytes(b"x" * 30)
    (tmp_path / "device_panel.routines").write_bytes(b"x" * 20)
    (tmp_path / "device_panel.magic").write_bytes(b"x" * 10)
    # schon anderswo gezählt: Verläufe, Log, Protokolle
    for name in ("availability", "signal", "debug", "protocol_abc", "protocol_index"):
        (tmp_path / f"device_panel.{name}").write_bytes(b"x" * 999)
    (tmp_path / "core.config").write_bytes(b"x" * 999)
    assert storage_ws.other_sizes(str(tmp_path)) == {"states": 150, "ai": 30, "config": 30}
    assert storage_ws.other_sizes(str(tmp_path / "gibt-es-nicht")) == {"states": 0, "ai": 0, "config": 0}


def test_signal_folds_old_hours_into_days_and_serves_long_ranges(hass: HomeAssistant) -> None:
    """2.119.0: Stunden über 31 Tage werden zu Tageswerten; 3, 6 und 12 Monate zeigen Tageswerte (Standard: 365 Tage Aufbewahrung)."""
    log = SignalLog(hass)
    now = time.time()
    now -= now % HOUR_SECONDS
    day = 86400
    # 100 Tage Stundenwerte eines Geräts: -70 mit Ausreissern an einem Tag (-95 / -50)
    log._hours = {"a": [[now - h * HOUR_SECONDS, -70.0 if h != 40 * 24 + 5 else -95.0, -80.0, -60.0] for h in range(100 * 24 - 1, -1, -1)]}
    log.prune(now, force=True)
    # Stunden nur noch für etwa 31 bis 32 Tage, der Rest sind Tageswerte (ganze UTC-Tage)
    assert all(h[0] >= now - 33 * day for h in log._hours["a"]) and len(log._hours["a"]) > 31 * 24 - 1
    assert 60 <= len(log._days["a"]) <= 70 and all(d[0] % day == 0 for d in log._days["a"])
    assert min(d[2] for d in log._days["a"]) == -80.0 and max(d[3] for d in log._days["a"]) == -60.0
    rows, bucket = log.history("a", "365d", now)
    assert bucket == day and 95 <= len(rows) <= 102 and [r[0] for r in rows] == sorted(r[0] for r in rows) and len({r[0] for r in rows}) == len(rows)
    rows90, bucket90 = log.history("a", "90d", now)
    assert bucket90 == day and 88 <= len(rows90) <= 92
    hours, bucket30 = log.history("a", "30d", now)
    assert bucket30 == 3600 and len(hours) >= 29 * 24
    assert log.first("a") == min(r[0] for r in log._days["a"])
    # kürzere Aufbewahrung als 31 Tage: keine Tageswerte, die Stunden folgen ihr
    short = SignalLog(hass)
    short._hours = {"a": [[now - h * HOUR_SECONDS, -70.0, -80.0, -60.0] for h in range(40 * 24 - 1, -1, -1)]}
    entry = _setup(hass, {"signal_keep_days": 10})
    short.prune(now, force=True)
    assert not short._days and all(h[0] >= now - 11 * day for h in short._hours["a"])
    hass.config_entries.async_remove  # Eintrag bleibt für den Test bestehen
    assert entry is not None


def test_availability_history_covers_12_months(hass: HomeAssistant) -> None:
    from custom_components.device_panel.availability import RANGES

    assert {"24h", "7d", "30d", "90d", "180d", "365d"} <= set(RANGES)
    log = AvailabilityLog(hass)
    now = time.time()
    log._events = {"a": [[now - 300 * 86400, 1], [now - 200 * 86400, 0], [now - 200 * 86400 + 3600, 1], [now - 10 * 86400, 0], [now - 10 * 86400 + 600, 1]]}
    year = log.history("a", "365d", now)
    assert len(year["days"]) == 365 and sum(d["outages"] for d in year["days"]) >= 2
    assert len(year["outages"]) == 2 and year["first"] == now - 300 * 86400
    half = log.history("a", "180d", now)
    assert len(half["days"]) == 180 and len(half["outages"]) == 1
