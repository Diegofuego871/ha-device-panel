"""Nachfüllen des Verfügbarkeitsprotokolls aus dem Recorder (backfill.py)."""

from __future__ import annotations

import time
from datetime import timedelta
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.components.recorder.common import async_wait_recording_done

from custom_components.device_panel import backfill
from custom_components.device_panel.availability import AvailabilityLog
from custom_components.device_panel.backfill import OFFLINE, ONLINE, candidates, reconstruct
from custom_components.device_panel.const import DATA_AVAILABILITY, DOMAIN


@pytest.fixture
def mock_recorder_before_hass(async_test_recorder) -> None:
    """
    Recorder-Datenbank vor hass vorbereiten (Vorgabe des Testpakets): die
    automatischen Fixtures in conftest.py starten hass sonst vor
    recorder_mock.
    """


# --- reine Rechnung ----------------------------------------------------------


def test_outage_needs_offline_after() -> None:
    # Weg 100–400 (300 s): Ausfall; weg 600–650 (50 s): Aussetzer, online.
    tl = [[(0, True), (100, False), (400, True), (600, False), (650, True)]]
    assert reconstruct(tl, [], 0, 1000, 120, 300, ONLINE) == [[0, ONLINE], [100, OFFLINE], [400, ONLINE]]


def test_all_entities_must_be_down() -> None:
    a = [(0, True), (100, False), (500, True)]
    # Beide weg nur 200–300: zu kurz.
    assert reconstruct([a, [(0, True), (200, False), (300, True)]], [], 0, 1000, 120, 0, ONLINE) == [[0, ONLINE]]
    # Beide weg 200–450: Ausfall ab dem Moment, in dem die letzte wegfiel.
    assert reconstruct([a, [(0, True), (200, False), (450, True)]], [], 0, 1000, 120, 0, ONLINE) == [
        [0, ONLINE], [200, OFFLINE], [450, ONLINE],
    ]


def test_grace_after_start_and_gap_without_data() -> None:
    runs = [(0, 1000), (2000, None)]
    # Nach dem Start in der Anlaufphase (300 s) zurück: kein Ausfall. HA lief
    # 1000–2000 nicht: keine Daten.
    tl = [[(0, True), (2000, False), (2200, True)]]
    assert reconstruct(tl, runs, 0, 3000, 120, 300, ONLINE) == [[0, ONLINE], [1000, None], [2000, ONLINE]]
    # Nach der Anlaufphase noch weg: Ausfall ab dem Start.
    tl = [[(0, True), (2000, False), (2500, True)]]
    assert reconstruct(tl, runs, 0, 3000, 120, 300, ONLINE) == [
        [0, ONLINE], [1000, None], [2000, OFFLINE], [2500, ONLINE],
    ]


def test_outage_across_gap_like_the_log() -> None:
    # Wie das Protokoll: Ausfall, Lücke, weiter Ausfall (bridged zählt einmal).
    tl = [[(0, True), (500, False), (2600, True)]]
    assert reconstruct(tl, [(0, 1000), (2000, None)], 0, 3000, 120, 300, ONLINE) == [
        [0, ONLINE], [500, OFFLINE], [1000, None], [2000, OFFLINE], [2600, ONLINE],
    ]


def test_running_outage_at_the_end() -> None:
    tl = [[(0, True), (950, False)]]
    # Das Protokoll beginnt mit "ausgefallen": der Ausfall begann schon hier.
    assert reconstruct(tl, [], 0, 1000, 120, 0, OFFLINE) == [[0, ONLINE], [950, OFFLINE]]
    # Beginnt es mit "online", war es ein kurzer Aussetzer.
    assert reconstruct(tl, [], 0, 1000, 120, 0, ONLINE) == [[0, ONLINE]]


def test_start_clipped_and_without_data() -> None:
    assert reconstruct([[(-500, True), (300, False), (600, True)]], [], 0, 1000, 120, 0, ONLINE) == [
        [0, ONLINE], [300, OFFLINE], [600, ONLINE],
    ]
    assert reconstruct([[]], [], 0, 1000, 120, 0, ONLINE) == []
    assert reconstruct([[(400, True)]], [], 0, 1000, 120, 0, ONLINE) == [[400, ONLINE]]


# --- mit Home Assistant und Recorder --------------------------------------


def _device(hass: HomeAssistant, name: str) -> dr.DeviceEntry:
    source = MockConfigEntry(domain="test", title=f"{name} Eintrag")
    source.add_to_hass(hass)
    return dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={("test", name)}, name=name)


def _entity(hass: HomeAssistant, device: dr.DeviceEntry, domain: str, key: str, **kwargs: Any) -> str:
    return er.async_get(hass).async_get_or_create(domain, "test", f"{device.id}-{key}", device_id=device.id, **kwargs).entity_id


async def test_candidates_quiet_first(hass: HomeAssistant) -> None:
    dev = _device(hass, "Steckdose")
    _entity(hass, dev, "sensor", "power", original_device_class="power")
    _entity(hass, dev, "sensor", "temp", original_device_class="temperature")
    _entity(hass, dev, "switch", "relay")
    entries = er.async_entries_for_device(er.async_get(hass), dev.id)
    picked, conn = candidates(entries)
    assert [e.entity_id.split(".")[0] for e in picked] == ["switch", "sensor", "sensor"]
    assert (picked[1].original_device_class, picked[2].original_device_class) == ("temperature", "power")
    assert conn is False
    # Verbindungssensor: allein massgebend, wie in der Bewertung.
    conn_id = _entity(hass, dev, "binary_sensor", "conn", original_device_class="connectivity")
    picked, conn = candidates(er.async_entries_for_device(er.async_get(hass), dev.id))
    assert [e.entity_id for e in picked] == [conn_id]
    assert conn is True


async def _record(hass: HomeAssistant, freezer, at, entity_id: str, state: str) -> None:
    freezer.move_to(at)
    hass.states.async_set(entity_id, state)
    await async_wait_recording_done(hass)


async def _setup(hass: HomeAssistant) -> AvailabilityLog:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    log: AvailabilityLog = hass.data[DATA_AVAILABILITY]
    log._started = time.time() - 3600
    return log


async def test_backfill_from_recorder(recorder_mock, hass: HomeAssistant, freezer, hass_storage) -> None:
    t0 = dt_util.utcnow() - timedelta(days=2)
    lamp = _device(hass, "Lampe")
    light = _entity(hass, lamp, "light", "l")
    await _record(hass, freezer, t0, light, "on")
    # Ausfall 1 Std. nach t0, 10 Min. lang; danach ein Aussetzer von 60 s.
    await _record(hass, freezer, t0 + timedelta(hours=1), light, "unavailable")
    await _record(hass, freezer, t0 + timedelta(hours=1, minutes=10), light, "on")
    await _record(hass, freezer, t0 + timedelta(hours=3), light, "unavailable")
    await _record(hass, freezer, t0 + timedelta(hours=3, seconds=60), light, "on")
    # Gerät ohne Verlauf im Recorder (Entität ohne Zustand vor der Installation).
    _device(hass, "Neu")

    # Installation einen Tag später: das Protokoll beginnt jetzt.
    freezer.move_to(t0 + timedelta(days=1))
    log = await _setup(hass)
    first = log.events(lamp.id)[0]
    assert first[1] == ONLINE
    assert await log.async_backfill() == 1
    ts = t0.timestamp()
    assert log.events(lamp.id) == [
        [pytest.approx(ts), ONLINE],
        [pytest.approx(ts + 3600), OFFLINE],
        [pytest.approx(ts + 4200), ONLINE],
        first,
    ]
    # Läufe des Recorders lesbar (Lücken und Anlaufphase), nicht der Ersatz [].
    # Der Lauf des Tests begann zur echten Zeit, nach der eingefrorenen.
    runs = await recorder_mock.async_add_executor_job(
        backfill._runs, hass, dt_util.utcnow() - timedelta(days=31), dt_util.utcnow() + timedelta(days=3)
    )
    assert len(runs) == 1 and runs[0][1] is None and runs[0][0] > time.time()
    # Einmal pro Instanz: der Merker steht im gespeicherten Protokoll.
    assert await log.async_backfill() == 0
    assert hass_storage[f"{DOMAIN}.availability"]["data"]["backfilled"] == pytest.approx(time.time())


async def test_backfill_skips_chatty_entities(recorder_mock, hass: HomeAssistant, freezer, monkeypatch) -> None:
    monkeypatch.setattr(backfill, "ROW_LIMIT", 3)
    t0 = dt_util.utcnow() - timedelta(days=1)
    meter = _device(hass, "Zähler")
    power = _entity(hass, meter, "sensor", "p", original_device_class="power")
    for i in range(5):
        await _record(hass, freezer, t0 + timedelta(minutes=i), power, str(100 + i))
    freezer.move_to(t0 + timedelta(hours=2))
    hass.states.async_set(power, "200")
    log = await _setup(hass)
    before = list(log.events(meter.id))
    # Zu viele Wechsel: die Entität fällt weg, das Gerät bleibt wie es ist.
    assert await log.async_backfill() == 0
    assert log.events(meter.id) == before
    assert log._backfilled is not None


async def test_backfill_without_recorder_waits(hass: HomeAssistant) -> None:
    log = await _setup(hass)
    assert await log.async_backfill() == 0
    # Kein Recorder: kein Merker, ein späterer Start mit Recorder füllt nach.
    assert log._backfilled is None
