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

from custom_components.device_panel.battery_history import CHANGE_JUMP, changes, thin
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


async def test_without_recorder(hass: HomeAssistant, hass_ws_client) -> None:
    dev, bat = _battery_device(hass)
    hass.states.async_set(bat, "80", {"device_class": "battery", "unit_of_measurement": "%"})
    await _setup(hass)
    client = await hass_ws_client(hass)
    res = (await _ws(client, 1, type=f"{DOMAIN}/battery_history", device_id=dev.id, range="7d"))["result"]
    assert res["source"] == "none" and [v for _t, v in res["points"]] == [80]
