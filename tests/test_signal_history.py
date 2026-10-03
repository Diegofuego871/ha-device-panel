"""Empfangsverlauf (signal_history.py, seit 0.24.0): eigene Aufzeichnung und Recorder."""

from __future__ import annotations

import time
from datetime import timedelta
from typing import Any

import pytest
from homeassistant.const import STATE_UNAVAILABLE
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.components.recorder.common import async_wait_recording_done

from custom_components.device_panel import signal_history
from custom_components.device_panel.const import DATA_AVAILABILITY, DATA_SIGNAL, DOMAIN
from custom_components.device_panel.signal_history import BLOCK_SECONDS, HOUR_SECONDS, SignalLog


# --- eigene Aufzeichnung, reine Rechnung ---------------------------------------


def test_blocks_hours_and_gaps(hass: HomeAssistant) -> None:
    log = SignalLog(hass)
    t0 = 1_800_000_000 - (1_800_000_000 % HOUR_SECONDS)
    # Eine Stunde lang jede Minute; in Block 3 ein Ausreisser nach unten.
    for minute in range(60):
        value = -95 if minute == 17 else -70 - (minute % 3)
        log.record("a", "dbm", value, t0 + minute * 60)
    # Danach 2 Std. nichts (ausser Reichweite), dann wieder.
    log.record("a", "dbm", -60, t0 + 3 * HOUR_SECONDS + 30)
    now = t0 + 3 * HOUR_SECONDS + 90
    log.prune(now)
    day, bucket = log.history("a", "24h", now)
    assert bucket == BLOCK_SECONDS
    assert len(day) == 13  # 12 Blöcke der ersten Stunde, dazu der laufende
    third = day[3]
    assert third[0] == t0 + 15 * 60 and third[2] == -95 and third[1] == -71
    assert day[-1] == [t0 + 3 * HOUR_SECONDS, -60, -60, -60]
    week, bucket = log.history("a", "7d", now)
    assert bucket == HOUR_SECONDS and [h[0] for h in week] == [t0, t0 + 3 * HOUR_SECONDS]
    assert week[0][2] == -95 and week[0][3] == -70
    assert log.first("a") == t0
    # Unplausible Werte zählen nicht; andere Art beginnt neu.
    log.record("a", "dbm", 0, now + 10)
    assert log.history("a", "24h", now + 10)[0][-1] == [t0 + 3 * HOUR_SECONDS, -60, -60, -60]
    log.record("a", "lqi", 120, now + 20)
    assert log.kind("a") == "lqi" and len(log.history("a", "24h", now + 20)[0]) == 1
    # Nach 31 Tagen ist alles weg, die Art auch.
    log.prune(now + 32 * 86400)
    assert log.history("a", "30d", now + 32 * 86400)[0] == [] and log.kind("a") is None


def test_load_survives_restart(hass: HomeAssistant) -> None:
    log = SignalLog(hass)
    t0 = 1_800_000_000 - (1_800_000_000 % HOUR_SECONDS)
    for minute in range(12):
        log.record("b", "lqi", 100 + minute, t0 + minute * 60)
    data = log.data()
    again = SignalLog(hass)
    again.load(data, t0 + 12 * 60 + 5)
    blocks, _bucket = again.history("b", "24h", t0 + 12 * 60 + 5)
    assert [b[0] for b in blocks] == [t0, t0 + 300, t0 + 600]
    assert again.kind("b") == "lqi"
    # Kaputtes bleibt draussen
    broken = SignalLog(hass)
    broken.load({"kind": {"x": "foo"}, "blocks": {"x": [[1, 2]]}, "open": {"x": "nein"}}, t0)
    assert broken.history("x", "24h", t0)[0] == [] and broken.kind("x") is None


# --- mit Home Assistant -------------------------------------------------------


@pytest.fixture
def mock_recorder_before_hass(async_test_recorder) -> None:
    """Recorder-Datenbank vor hass vorbereiten (wie in test_battery_history.py)."""


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    hass.data[DATA_AVAILABILITY]._started = time.time() - 3600
    return entry


async def _ws(client, msg_id: int, **msg: Any) -> dict[str, Any]:
    await client.send_json({"id": msg_id, **msg})
    return await client.receive_json()


async def test_logs_only_online_devices_without_sensor(hass: HomeAssistant, hass_ws_client, monkeypatch, freezer) -> None:
    await _setup(hass)
    source = MockConfigEntry(domain="test")
    source.add_to_hass(hass)
    reg = dr.async_get(hass)
    stick = reg.async_get_or_create(config_entry_id=source.entry_id, identifiers={("test", "stick")}, name="Kontakt")
    lamp = reg.async_get_or_create(config_entry_id=source.entry_id, identifiers={("test", "lamp")}, name="Lampe")
    contact = er.async_get(hass).async_get_or_create("binary_sensor", "test", "stick-c", device_id=stick.id)
    light = er.async_get(hass).async_get_or_create("light", "test", "lamp-l", device_id=lamp.id)
    hass.states.async_set(contact.entity_id, "off")
    hass.states.async_set(light.entity_id, "on")
    # Wie ZHA: Wert direkt aus der Integration, kein Sensor.
    values = {stick.id: -72, lamp.id: None}

    def fake_source(_hass, device, _entries, _domains):
        value = values.get(device.id)
        return ({"kind": "dbm", "value": value} if value is not None else None), None, ("zha" if value is not None else None)

    monkeypatch.setattr(signal_history, "signal_source", fake_source)
    hass.data[DATA_AVAILABILITY].evaluate()
    log: SignalLog = hass.data[DATA_SIGNAL]
    for value in (-72, -74, -70):
        values[stick.id] = value
        log.sample()
        freezer.tick(timedelta(minutes=1))
    assert log.kind(stick.id) == "dbm" and log.kind(lamp.id) is None
    # Ausgefallen: keine Messung, obwohl ZHA den alten Wert noch kennt.
    hass.states.async_set(contact.entity_id, STATE_UNAVAILABLE)
    freezer.tick(timedelta(minutes=5))
    hass.data[DATA_AVAILABILITY].evaluate()
    values[stick.id] = -99
    log.sample()
    blocks, _bucket = log.history(stick.id, "24h")
    assert all(b[2] > -99 for b in blocks) and blocks[0][1] == -72
    # Abfrage wie im Panel: Quelle "log", Mitte der Blöcke, Art aus der Aufzeichnung
    client = await hass_ws_client(hass)
    res = (await _ws(client, 1, type=f"{DOMAIN}/signal_history", device_id=stick.id, range="24h"))["result"]
    assert res["source"] == "log" and res["kind"] == "dbm" and res["bucket"] == BLOCK_SECONDS
    assert res["points"][0][1:] == [-72, -74, -70]
    assert res["points"][0][0] % BLOCK_SECONDS == BLOCK_SECONDS / 2
    # Ohne Empfang überhaupt: leer, ohne Fehler
    res = (await _ws(client, 2, type=f"{DOMAIN}/signal_history", device_id=lamp.id))["result"]
    assert res["source"] == "none" and res["points"] == [] and res["kind"] is None
    assert (await _ws(client, 3, type=f"{DOMAIN}/signal_history", device_id="weg"))["error"]["code"] == "not_found"
    assert (await _ws(client, 4, type=f"{DOMAIN}/signal_history", device_id=stick.id, range="1y"))["error"]["code"] == "invalid_format"


async def test_sensor_from_recorder(recorder_mock, hass: HomeAssistant, hass_ws_client, freezer) -> None:
    source = MockConfigEntry(domain="test")
    source.add_to_hass(hass)
    dev = dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={("test", "plug")}, name="Steckdose")
    sensor = er.async_get(hass).async_get_or_create(
        "sensor", "test", "plug-rssi", device_id=dev.id, original_device_class="signal_strength", unit_of_measurement="dBm"
    )
    attrs = {"device_class": "signal_strength", "unit_of_measurement": "dBm"}
    now = dt_util.utcnow()
    for at, value in ((now - timedelta(days=2), "-60"), (now - timedelta(hours=20), "-75"), (now - timedelta(hours=3), "0"), (now - timedelta(hours=2), "-82")):
        freezer.move_to(at)
        hass.states.async_set(sensor.entity_id, value, attrs)
        await async_wait_recording_done(hass)
    freezer.move_to(now)
    await _setup(hass)
    client = await hass_ws_client(hass)
    day = (await _ws(client, 1, type=f"{DOMAIN}/signal_history", device_id=dev.id, range="24h"))["result"]
    assert day["source"] == "history" and day["kind"] == "dbm" and day["entity_id"] == sensor.entity_id
    # Stand zu Beginn, Wechsel, 0 dBm verworfen, jetzt
    assert [v for _t, v in day["points"]] == [-60, -75, -82, -82] and day["current"] == -82
    # Ausgefallen: Sensor ohne Wert, der Verlauf bleibt erreichbar
    hass.states.async_set(sensor.entity_id, STATE_UNAVAILABLE, attrs)
    await async_wait_recording_done(hass)
    week = (await _ws(client, 2, type=f"{DOMAIN}/signal_history", device_id=dev.id, range="7d"))["result"]
    assert week["source"] == "history" and week["current"] is None and [v for _t, v in week["points"]] == [-60, -75, -82]
