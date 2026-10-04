"""Batterie-Verlauf aus dem Recorder (battery_history.py, seit 0.22.0)."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import pytest
from homeassistant.components.recorder.models import StatisticMeanType
from homeassistant.components.recorder.statistics import async_import_statistics
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.components.recorder.common import async_wait_recording_done

from custom_components.device_panel.battery_history import CHANGE_JUMP, changes, forecast, thin
from custom_components.device_panel.const import DOMAIN


@pytest.fixture
def mock_recorder_before_hass(async_test_recorder) -> None:
    """Recorder-Datenbank vor hass vorbereiten (wie in test_backfill.py)."""


# --- reine Rechnung ----------------------------------------------------------


def test_change_detected_once_also_over_two_hours() -> None:
    hour = 3600
    # Stundenmittel: 14 %, Wechsel mitten in der Stunde (57 %), dann 100 %.
    pts = [(0, 15.0), (hour, 14.0), (2 * hour, 57.0), (3 * hour, 100.0), (4 * hour, 99.5)]
    found = changes(pts)
    assert found == [{"at": 2 * hour, "from": 14, "to": 100}]
    # Selten gemeldet: 22 % und 18 Std. später 100 %
    assert changes([(0, 22.0), (18 * hour, 100.0)]) == [{"at": 18 * hour, "from": 22, "to": 100}]
    # Langsam steigend (Temperatur): kein Wechsel
    assert changes([(i * hour, 60.0 + i) for i in range(10)]) == []
    # Knapp unter der Schwelle: kein Wechsel
    assert changes([(0, 50.0), (hour, 50.0 + CHANGE_JUMP - 1)]) == []


def test_thin_keeps_last_point() -> None:
    pts = [(float(i), float(i % 7)) for i in range(5000)]
    out = thin(pts, 0, 5000, limit=100)
    assert len(out) <= 101 and out[-1] == pts[-1]
    assert thin(pts[:50], 0, 50, limit=100) == pts[:50]


# --- Prognose (seit 1.5.0) ----------------------------------------------------

DAY = 86400.0
NOW = 400 * DAY


def _line(days: int, start: float, per_day: float, step: float = 0.25) -> list[tuple[float, float]]:
    """Täglicher Wert, der mit per_day Punkten pro Tag fällt; endet bei NOW."""
    return [(NOW - (days - i) * DAY, start - per_day * i) for i in range(days + 1)]


def test_forecast_linear_until_the_warning_threshold() -> None:
    # 100 % -> 60 % in 100 Tagen (0,4 pro Tag), Schwelle 10 %: noch 50 Punkte = 125 Tage
    fc = forecast(_line(100, 100.0, 0.4), NOW, 10)
    assert fc["status"] == "ok" and fc["target"] == 10 and fc["target_is_zero"] is False
    assert fc["days"] == pytest.approx(125, abs=2) and fc["at"] == pytest.approx(NOW + 125 * DAY, abs=2 * DAY)
    assert fc["confidence"] == "high" and fc["accelerating"] is False and fc["after_change"] is False
    assert fc["per_month"] == pytest.approx(12.2, abs=0.2)
    assert fc["days_low"] <= fc["days"] <= fc["days_high"]
    # Ohne Warnung (None): bis 0 %
    zero = forecast(_line(100, 100.0, 0.4), NOW, None)
    assert zero["target"] == 0 and zero["target_is_zero"] is True and zero["days"] == pytest.approx(150, abs=2)
    # Höhere eigene Schwelle des Geräts: früher
    assert forecast(_line(100, 100.0, 0.4), NOW, 30)["days"] == pytest.approx(75, abs=2)


def test_forecast_counts_only_since_the_last_battery_change() -> None:
    old = _line(60, 40.0, 0.5)  # alte Batterie bis ~10 %
    old = [(t - 80 * DAY, v) for t, v in old]
    new = [(NOW - (50 - i) * DAY, 100.0 - 0.2 * i) for i in range(51)]  # neue Batterie, 0,2 pro Tag
    fc = forecast(old + new, NOW, 10, 3 * 3600)
    assert fc["status"] == "ok" and fc["after_change"] is True
    assert fc["since"] == pytest.approx(NOW - 50 * DAY, abs=DAY)
    # Noch 90 -> 10 Punkte... aktuell 90 %: (90 - 10) / 0,2 = 400 Tage
    assert fc["days"] == pytest.approx(400, abs=10)


def test_forecast_states() -> None:
    # Zu wenig Tage seit dem Wechsel
    short = forecast(_line(4, 90.0, 1.0), NOW, 10)
    assert short["status"] == "short" and short["min_days"] == 7 and short["days_used"] == pytest.approx(4, abs=0.1)
    # Gleichbleibend
    flat = forecast([(NOW - (30 - i) * DAY, 80.0) for i in range(31)], NOW, 10)
    assert flat["status"] == "flat"
    # Steigend (Temperatur) zählt als gleichbleibend
    assert forecast(_line(30, 50.0, -0.3), NOW, 10)["status"] == "flat"
    # Schwelle schon erreicht
    assert forecast(_line(30, 20.0, 0.5), NOW, 10)["status"] == "reached"
    # Keine Daten
    assert forecast([], NOW, 10)["status"] == "none"


def test_forecast_warns_when_the_drop_gets_steeper() -> None:
    # Knopfzelle: 40 Tage fast gleich, dann schneller Abfall
    pts = [(NOW - (60 - i) * DAY, 98.0 - 0.02 * i) for i in range(40)]
    pts += [(NOW - (60 - i) * DAY, 97.0 - 1.2 * (i - 40)) for i in range(40, 61)]
    fc = forecast(pts, NOW, 5)
    assert fc["status"] == "ok" and fc["accelerating"] is True
    # Gleichmässiger Abfall: nicht steiler
    assert forecast(_line(80, 100.0, 0.5), NOW, 5)["accelerating"] is False


def test_forecast_confidence_is_lower_with_few_days_and_noise() -> None:
    few = forecast(_line(10, 90.0, 0.5), NOW, 10)
    assert few["status"] == "ok" and few["confidence"] == "low"
    # Gröbe Stufen von 10 %: noch ein Ergebnis, aber nicht "hoch"
    steps = [(NOW - (90 - i) * DAY, 100.0 - 10 * (i // 22)) for i in range(91)]
    assert forecast(steps, NOW, 10)["confidence"] != "high"


# --- mit Recorder ------------------------------------------------------------


async def _setup(hass: HomeAssistant) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()


def _battery_device(hass: HomeAssistant) -> tuple[dr.DeviceEntry, str]:
    source = MockConfigEntry(domain="test", title="Test")
    source.add_to_hass(hass)
    dev = dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={("test", "kontakt")}, name="Kontakt")
    entry = er.async_get(hass).async_get_or_create("sensor", "test", "kontakt-bat", device_id=dev.id, original_device_class="battery")
    return dev, entry.entity_id


async def _ws(client, msg_id: int, **msg: Any) -> dict[str, Any]:
    await client.send_json({"id": msg_id, **msg})
    return await client.receive_json()


async def test_history_with_change(recorder_mock, hass: HomeAssistant, hass_ws_client, freezer) -> None:
    dev, bat = _battery_device(hass)
    now = dt_util.utcnow()
    for at, value in ((now - timedelta(days=3), "30"), (now - timedelta(days=2), "22"), (now - timedelta(hours=30), "100"), (now - timedelta(hours=2), "97")):
        freezer.move_to(at)
        hass.states.async_set(bat, value, {"device_class": "battery", "unit_of_measurement": "%"})
        await async_wait_recording_done(hass)
    freezer.move_to(now)
    await _setup(hass)
    client = await hass_ws_client(hass)
    week = (await _ws(client, 1, type=f"{DOMAIN}/battery_history", device_id=dev.id, range="7d"))["result"]
    assert week["source"] == "history" and week["entity_id"] == bat
    assert [v for _t, v in week["points"]] == [30, 22, 100, 97, 97]
    assert len(week["changes"]) == 1
    change = week["changes"][0]
    assert (change["from"], change["to"]) == (22, 100) and abs(change["at"] - (now - timedelta(hours=30)).timestamp()) < 1
    assert week["threshold"] == 15
    # 24 Std.: Stand zu Beginn, dann jetzt; kein Wechsel im Zeitraum
    day = (await _ws(client, 2, type=f"{DOMAIN}/battery_history", device_id=dev.id, range="24h"))["result"]
    assert [v for _t, v in day["points"]] == [100, 97, 97] and day["changes"] == []
    assert day["points"][0][0] == pytest.approx(day["start"], abs=1)
    # 3 Monate ohne Statistik (keine state_class): Verlauf, so weit vorhanden
    long = (await _ws(client, 3, type=f"{DOMAIN}/battery_history", device_id=dev.id, range="90d"))["result"]
    assert long["source"] == "history" and long["first"] == pytest.approx((now - timedelta(days=3)).timestamp(), abs=1)
    # Fehler: unbekanntes Gerät, Gerät ohne Prozent, falscher Zeitraum
    assert (await _ws(client, 4, type=f"{DOMAIN}/battery_history", device_id="weg"))["error"]["code"] == "not_found"
    other = dr.async_get(hass).async_get_or_create(config_entry_id=hass.config_entries.async_entries("test")[0].entry_id, identifiers={("test", "x")}, name="X")
    assert (await _ws(client, 5, type=f"{DOMAIN}/battery_history", device_id=other.id))["error"]["code"] == "not_found"
    assert (await _ws(client, 6, type=f"{DOMAIN}/battery_history", device_id=dev.id, range="1y"))["error"]["code"] == "invalid_format"


async def test_statistics_for_long_ranges(recorder_mock, hass: HomeAssistant, hass_ws_client) -> None:
    dev, bat = _battery_device(hass)
    hass.states.async_set(bat, "64", {"device_class": "battery", "unit_of_measurement": "%", "state_class": "measurement"})
    now = dt_util.utcnow()
    top = now.replace(minute=0, second=0, microsecond=0)
    # Stundenmittel über 40 Tage: gewechselt vor 20 Tagen (18 % auf 100 %)
    rows = []
    for h in range(40 * 24, 0, -1):
        start = top - timedelta(hours=h)
        mean = 30 - (40 * 24 - h) / 40 if h > 20 * 24 else 100 - (20 * 24 - h) / 13
        rows.append({"start": start, "mean": mean, "min": mean, "max": mean})
    async_import_statistics(
        hass,
        {
            "mean_type": StatisticMeanType.ARITHMETIC, "has_sum": False, "name": None, "source": "recorder",
            "statistic_id": bat, "unit_class": None, "unit_of_measurement": "%",
        },
        rows,
    )
    await async_wait_recording_done(hass)
    await _setup(hass)
    client = await hass_ws_client(hass)
    month = (await _ws(client, 1, type=f"{DOMAIN}/battery_history", device_id=dev.id, range="30d"))["result"]
    assert month["source"] == "statistics"
    assert 700 <= len(month["points"]) <= 722 and month["points"][-1][1] == 64
    assert [(c["from"], c["to"]) for c in month["changes"]] == [(18, 100)]
    quarter = (await _ws(client, 2, type=f"{DOMAIN}/battery_history", device_id=dev.id, range="90d"))["result"]
    assert quarter["source"] == "statistics" and quarter["first"] == pytest.approx((top - timedelta(hours=40 * 24)).timestamp() + 1800)
    assert quarter["period"] == "hour"
    # 6 und 12 Monate (seit 0.29.0): Tagesmittel, weniger Punkte, Wechsel bleibt erkennbar
    for i, key in enumerate(("180d", "365d")):
        long = (await _ws(client, 3 + i, type=f"{DOMAIN}/battery_history", device_id=dev.id, range=key))["result"]
        assert long["source"] == "statistics" and long["period"] == "day", key
        assert 40 <= len(long["points"]) <= 44 and long["points"][-1][1] == 64, len(long["points"])
        assert len(long["changes"]) == 1 and long["changes"][0]["to"] >= 60, long["changes"]


async def test_without_recorder(hass: HomeAssistant, hass_ws_client) -> None:
    dev, bat = _battery_device(hass)
    hass.states.async_set(bat, "80", {"device_class": "battery", "unit_of_measurement": "%"})
    await _setup(hass)
    client = await hass_ws_client(hass)
    res = (await _ws(client, 1, type=f"{DOMAIN}/battery_history", device_id=dev.id, range="7d"))["result"]
    # Seit 0.26.0: der Wert gilt seit seiner letzten Änderung (zwei Punkte, unverändert seit)
    assert res["source"] == "none" and [v for _t, v in res["points"]] == [80, 80] and res["steady_since"] is not None


async def test_history_carries_the_forecast_independent_of_the_range(recorder_mock, hass: HomeAssistant, hass_ws_client) -> None:
    """Die Prognose steht in jedem Zeitraum und rechnet über das längste Fenster; Schwelle des Geräts."""
    dev, bat = _battery_device(hass)
    hass.states.async_set(bat, "70", {"device_class": "battery", "unit_of_measurement": "%", "state_class": "measurement"})
    now = dt_util.utcnow()
    top = now.replace(hour=0, minute=0, second=0, microsecond=0)
    # Tagesmittel über 100 Tage: 100 % -> 70 % (0,3 pro Tag), bis jetzt
    rows = [{"start": top - timedelta(days=d), "mean": 70 + 0.3 * (d - 1), "min": 70, "max": 100} for d in range(100, 0, -1)]
    async_import_statistics(
        hass,
        {"mean_type": StatisticMeanType.ARITHMETIC, "has_sum": False, "name": None, "source": "recorder", "statistic_id": bat, "unit_class": None, "unit_of_measurement": "%"},
        rows,
    )
    await async_wait_recording_done(hass)
    await _setup(hass)
    client = await hass_ws_client(hass)
    results = {}
    for i, key in enumerate(("24h", "7d", "30d", "365d")):
        results[key] = (await _ws(client, 1 + i, type=f"{DOMAIN}/battery_history", device_id=dev.id, range=key))["result"]
    for key, result in results.items():
        fc = result["forecast"]
        assert fc["status"] == "ok", key
        # Schwelle 15 % (Standard des Geräts): (70 - 15) / 0,3 = ~183 Tage, unabhängig vom Reiter
        assert fc["target"] == 15 and fc["days"] == pytest.approx(183, abs=12), (key, fc["days"])
    assert results["24h"]["forecast"]["days"] == pytest.approx(results["365d"]["forecast"]["days"], abs=1)
    # Eigene Schwelle 5 %: später; Warnung aus: bis 0 %
    await _ws(client, 9, type=f"{DOMAIN}/set_device_settings", device_id=dev.id, battery=5)
    own = (await _ws(client, 10, type=f"{DOMAIN}/battery_history", device_id=dev.id, range="7d"))["result"]["forecast"]
    assert own["target"] == 5 and own["days"] > results["7d"]["forecast"]["days"]
    await _ws(client, 11, type=f"{DOMAIN}/set_device_settings", device_id=dev.id, battery="off")
    off = (await _ws(client, 12, type=f"{DOMAIN}/battery_history", device_id=dev.id, range="7d"))["result"]["forecast"]
    assert off["target"] == 0 and off["target_is_zero"] is True and off["days"] > own["days"]
