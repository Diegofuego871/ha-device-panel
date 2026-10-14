"""Wächter für Messfehler im Batteriestand (2.43.0): ein unmöglich schneller Abfall wird gehalten, schnelle Akkus gelten sofort."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from homeassistant.core import HomeAssistant, State
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel import activity
from custom_components.device_panel.battery_guard import BatteryGuard, despike, suspicious
from custom_components.device_panel.const import DOMAIN
from custom_components.device_panel.devices import battery

pytestmark = pytest.mark.battery_guard
T0 = 1_800_000_000.0
EID = "sensor.kuehlschrank_batterie"


def st(value: float, at: float) -> State:
    stamp = datetime.fromtimestamp(at, tz=timezone.utc)
    return State(EID, str(value), {"friendly_name": "Kühlschrank"}, last_changed=stamp, last_reported=stamp, last_updated=stamp)


@pytest.fixture
async def guard(hass: HomeAssistant):
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return BatteryGuard(hass)


def test_what_is_suspicious() -> None:
    assert suspicious(76, 2, 360)  # 74 Punkte in 6 Minuten: unmöglich
    assert not suspicious(100, 80, 60)  # unter 25 Punkten nie
    assert not suspicious(60, 20, 40 * 60)  # 40 Punkte in 40 Minuten: Staubsauger
    assert not suspicious(70, 5, 3600)  # selten meldender Sensor: in einer Stunde ist vieles möglich
    assert suspicious(80, 30, 120)  # 50 Punkte in 2 Minuten


async def test_measurement_error_is_held_and_then_discarded(hass: HomeAssistant, guard: BatteryGuard) -> None:
    assert guard.level(EID, st(76, T0), T0) == 76
    # Kühlschrank-Sensor: 76 % - 2 % - 68 %
    assert guard.level(EID, st(2, T0 + 360), T0 + 360) == 76
    assert guard.level(EID, st(68, T0 + 720), T0 + 720) == 68
    texts = [e["text"] for e in activity.snapshot(hass)["entries"] if e["cat"] == "battery"]
    assert any("implausibly fast drop" in t for t in texts) and any("discarded (measurement error)" in t for t in texts)


async def test_fast_discharging_devices_count_at_once(hass: HomeAssistant, guard: BatteryGuard) -> None:
    levels = [(0, 100), (600, 88), (1800, 60), (3000, 31), (3600, 20)]  # Staubsauger beim Saugen
    for seconds, value in levels:
        assert guard.level(EID, st(value, T0 + seconds), T0 + seconds) == value


async def test_rare_reporter_may_drop_a_lot(hass: HomeAssistant, guard: BatteryGuard) -> None:
    assert guard.level(EID, st(70, T0), T0) == 70
    assert guard.level(EID, st(5, T0 + 3600), T0 + 3600) == 5


async def test_real_drop_is_confirmed_by_a_matching_report(hass: HomeAssistant, guard: BatteryGuard) -> None:
    assert guard.level(EID, st(80, T0), T0) == 80
    assert guard.level(EID, st(5, T0 + 60), T0 + 60) == 80  # gehalten
    assert guard.level(EID, st(4, T0 + 240), T0 + 240) == 80  # passt dazu, aber erst 3 Minuten
    assert guard.level(EID, st(4, T0 + 720), T0 + 720) == 4  # 11 Minuten: bestätigt
    assert any("confirmed (another report matches)" in e["text"] for e in activity.snapshot(hass)["entries"])


async def test_real_drop_is_confirmed_by_duration(hass: HomeAssistant, guard: BatteryGuard) -> None:
    assert guard.level(EID, st(80, T0), T0) == 80
    low = st(5, T0 + 60)
    assert guard.level(EID, low, T0 + 60) == 80
    assert guard.level(EID, low, T0 + 600) == 80  # derselbe Zustand, noch keine 30 Minuten
    assert guard.level(EID, low, T0 + 60 + 1800) == 5  # unverändert seit 30 Minuten


async def test_rises_are_never_filtered(hass: HomeAssistant, guard: BatteryGuard) -> None:
    assert guard.level(EID, st(5, T0), T0) == 5
    assert guard.level(EID, st(100, T0 + 30), T0 + 30) == 100  # Batteriewechsel oder Laden
    assert guard.level(EID, State(EID, "unavailable"), T0 + 60) is None


def test_despike_removes_only_dips_that_come_back() -> None:
    glitch = [(0.0, 76.0), (360.0, 2.0), (720.0, 68.0)]
    assert despike(glitch) == [(0.0, 76.0), (720.0, 68.0)]
    two = [(0.0, 90.0), (100.0, 3.0), (200.0, 2.0), (400.0, 88.0)]
    assert despike(two) == [(0.0, 90.0), (400.0, 88.0)]
    real = [(0.0, 80.0), (60.0, 5.0), (7200.0, 4.0)]
    assert despike(real) == real  # keine Rückkehr: bleibt
    gradual = [(0.0, 100.0), (1800.0, 70.0), (3600.0, 40.0), (5400.0, 10.0)]
    assert despike(gradual) == gradual


async def test_device_list_ignores_a_glitch(hass: HomeAssistant, guard: BatteryGuard) -> None:
    source = MockConfigEntry(domain="test", title="Eintrag")
    source.add_to_hass(hass)
    dev = dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={("test", "k")}, name="Kühlschrank")
    entry = er.async_get(hass).async_get_or_create("sensor", "test", "k-b", device_id=dev.id, original_device_class="battery")
    attrs = {"device_class": "battery", "unit_of_measurement": "%"}
    hass.states.async_set(entry.entity_id, "76", attrs)
    entries = er.async_entries_for_device(er.async_get(hass), dev.id)
    assert battery(hass, entries, 15) == {"level": 76, "low": False}
    hass.states.async_set(entry.entity_id, "3", attrs)  # Sekunden später: Messfehler
    assert battery(hass, entries, 15) == {"level": 76, "low": False}
    hass.states.async_set(entry.entity_id, "74", attrs)
    assert battery(hass, entries, 15) == {"level": 74, "low": False}
