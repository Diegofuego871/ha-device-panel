"""Weg des Bluetooth-Empfangs (signal_history.py, seit 2.40.0): über welchen Empfänger ein Gerät gemeldet wird und wurde."""

from __future__ import annotations

import time
from datetime import timedelta
from typing import Any

from homeassistant.const import STATE_UNAVAILABLE
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel import signal_history
from custom_components.device_panel.const import DATA_AVAILABILITY, DATA_SIGNAL, DOMAIN
from custom_components.device_panel.signal_history import BLOCK_SECONDS, VIA_CHANGES_MAX, VIA_KEEP, SignalLog

BUERO = ("B0:A7:32:47:26:EA", "Storen Büro")
GARAGE = ("AA:BB:CC:00:00:01", "Proxy Garage")
KUECHE = ("AA:BB:CC:00:00:02", "Küche")
NOW = 1_800_000_000.0


def test_only_changes_are_stored_and_gaps_only_after_a_path(hass: HomeAssistant) -> None:
    log = SignalLog(hass)
    # Ohne Weg bleibt eine Lücke ohne Wirkung (zum Beispiel ein WLAN-Gerät)
    assert log.note_gap("a", NOW) is False and log.via_summary("a", "24h", NOW) is None
    assert log.note_via("a", BUERO, NOW) is True
    # Gleicher Empfänger, gleicher Name: nichts Neues, keine zweite Zeile
    assert log.note_via("a", BUERO, NOW + 60) is False and len(log._via["a"]) == 1
    assert log.note_via("a", GARAGE, NOW + 120) is True
    # Lücke nur einmal, auch wenn sie anhält; unbekannter Empfänger (None) zählt als Lücke
    assert log.note_gap("a", NOW + 180) is True and log.note_gap("a", NOW + 240) is False
    assert log.note_via("a", None, NOW + 300) is False
    assert [e[1] for e in log._via["a"]] == [BUERO[0], GARAGE[0], None]
    # Ein neuer Name derselben Quelle (umbenannter Proxy) ändert nur den Namen, nicht den Weg
    assert log.note_via("a", (GARAGE[0], "Garage neu"), NOW + 360) is True
    assert log._via_names[GARAGE[0]] == "Garage neu"


def test_summary_segments_shares_average_and_changes(hass: HomeAssistant) -> None:
    log = SignalLog(hass)
    t0 = NOW - 6 * 3600
    # 6 Std.: Büro 3 Std., Garage 1 Std., Lücke 1 Std., Küche 1 Std. bis jetzt
    log.note_via("a", BUERO, t0)
    log.note_via("a", GARAGE, t0 + 3 * 3600)
    log.note_gap("a", t0 + 4 * 3600)
    log.note_via("a", KUECHE, t0 + 5 * 3600)
    points = [[t0 + 1800, -70, -75, -66], [t0 + 3 * 3600 + 600, -90, -95, -85], [t0 + 4 * 3600 + 600, -50, -50, -50], [t0 + 5 * 3600 + 900, -80, -82, -78]]
    via = log.via_summary("a", "24h", NOW, points)
    assert via["since"] == round(t0)
    assert [r["name"] for r in via["receivers"]] == ["Storen Büro", "Proxy Garage", "Küche"]
    # Anteile an der bekannten Zeit (5 von 6 Std.): 3, 1, 1 Std. → 60, 20, 20 %
    assert [r["share"] for r in via["receivers"]] == [60, 20, 20] and sum(r["share"] for r in via["receivers"]) == 100
    assert [r["seconds"] for r in via["receivers"]] == [3 * 3600, 3600, 3600]
    # Mittlerer Empfang je Empfänger aus den Blöcken; der Wert in der Lücke zählt nicht
    assert [r["avg"] for r in via["receivers"]] == [-70, -90, -80]
    assert via["segments"] == [[round(t0), round(t0 + 3 * 3600), 0], [round(t0 + 3 * 3600), round(t0 + 4 * 3600), 1], [round(t0 + 4 * 3600), round(t0 + 5 * 3600), None], [round(t0 + 5 * 3600), round(NOW), 2]]
    # Wechsel (nur von Empfänger zu Empfänger, neueste zuerst): Büro → Garage; über die Lücke hinweg kein Wechsel
    assert via["changes"] == [[round(t0 + 3 * 3600), 0, 1]]


def test_window_clips_and_orders_receivers_by_first_appearance(hass: HomeAssistant) -> None:
    log = SignalLog(hass)
    log.note_via("a", BUERO, NOW - 20 * 86400)
    log.note_via("a", GARAGE, NOW - 10 * 86400)
    log.note_via("a", BUERO, NOW - 3600)
    day = log.via_summary("a", "24h", NOW)
    # Im Fenster von 24 Std.: Garage bis vor 1 Std., dann Büro; Büro wurde zuerst gesehen und behält Nr. 0
    assert [r["name"] for r in day["receivers"]] == ["Storen Büro", "Proxy Garage"]
    assert day["segments"][0][2] == 1 and day["segments"][-1][2] == 0
    assert day["segments"][0][0] == round(NOW - 86400) and day["segments"][-1][1] == round(NOW)
    assert day["changes"] == [[round(NOW - 3600), 1, 0]]
    month = log.via_summary("a", "30d", NOW)
    assert [r["name"] for r in month["receivers"]] == ["Storen Büro", "Proxy Garage"] and len(month["changes"]) == 2
    # Empfänger, den es im Fenster nicht gab, taucht nicht auf
    week = log.via_summary("a", "7d", NOW)
    assert [r["name"] for r in week["receivers"]] == ["Storen Büro", "Proxy Garage"]
    only = SignalLog(hass)
    only.note_via("b", GARAGE, NOW - 100)
    assert [r["name"] for r in only.via_summary("b", "24h", NOW)["receivers"]] == ["Proxy Garage"]
    assert only.via_summary("b", "24h", NOW)["receivers"][0]["share"] == 100


def test_changes_are_limited_to_the_newest(hass: HomeAssistant) -> None:
    log = SignalLog(hass)
    for i in range(20):
        log.note_via("a", (BUERO, GARAGE)[i % 2], NOW - 20000 + i * 600)
    via = log.via_summary("a", "24h", NOW)
    assert len(via["changes"]) == VIA_CHANGES_MAX
    assert via["changes"][0][0] > via["changes"][-1][0]


def test_prune_keeps_the_last_older_change_and_drops_unused_names(hass: HomeAssistant) -> None:
    log = SignalLog(hass)
    log.note_via("a", GARAGE, NOW - VIA_KEEP - 5 * 86400)
    log.note_via("a", BUERO, NOW - VIA_KEEP - 86400)  # älter als der Aufbewahrungszeitraum, aber der letzte davor
    log.note_via("a", KUECHE, NOW - 3600)
    log.prune(NOW)
    assert [e[1] for e in log._via["a"]] == [BUERO[0], KUECHE[0]]
    assert set(log._via_names) == {BUERO[0], KUECHE[0]}
    # Eine Lücke am Anfang ist ohne Aussage und fällt weg; ohne Rest verschwindet das Gerät
    log2 = SignalLog(hass)
    log2.note_via("b", GARAGE, NOW - VIA_KEEP - 86400)
    log2.note_gap("b", NOW - VIA_KEEP - 3600)
    log2.prune(NOW)
    assert "b" not in log2._via and GARAGE[0] not in log2._via_names


def test_survives_restart_and_forget(hass: HomeAssistant) -> None:
    log = SignalLog(hass)
    log.note_via("a", BUERO, NOW - 7200)
    log.note_gap("a", NOW - 3600)
    again = SignalLog(hass)
    again.load(log.data(), NOW)
    assert again.via_summary("a", "24h", NOW) == log.via_summary("a", "24h", NOW)
    assert again._via_names == {BUERO[0]: BUERO[1]}
    # Kaputtes bleibt draussen
    broken = SignalLog(hass)
    broken.load({"via": {"x": [[1, "a"], ["zwei", "b"], [True, "c"], [3], "kaputt"], "y": "kein Liste", "z": []}, "via_names": {"a": "A"}}, NOW)
    assert list(broken._via) == ["x"] and broken._via["x"] == [[1.0, "a"]] or "x" not in broken._via
    log.forget("a")
    assert log.via_summary("a", "24h", NOW) is None


async def _setup(hass: HomeAssistant) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()


async def test_sample_records_the_receiver_of_bluetooth_devices(hass: HomeAssistant, hass_ws_client, monkeypatch, freezer) -> None:
    """Ein Bluetooth-Gerät: der Empfänger wird aufgezeichnet, ein Wechsel und eine Lücke (ausgefallen) erscheinen im Weg des Fensters "Empfang"."""
    freezer.move_to(dt_util.utc_from_timestamp(time.time() // BLOCK_SECONDS * BLOCK_SECONDS + 10))
    await _setup(hass)
    source = MockConfigEntry(domain="test")
    source.add_to_hass(hass)
    reg = dr.async_get(hass)
    sensor = reg.async_get_or_create(config_entry_id=source.entry_id, identifiers={("test", "bt")}, name="Pflanze")
    wifi = reg.async_get_or_create(config_entry_id=source.entry_id, identifiers={("test", "wifi")}, name="Steckdose")
    contact = er.async_get(hass).async_get_or_create("binary_sensor", "test", "bt-c", device_id=sensor.id)
    plug = er.async_get(hass).async_get_or_create("binary_sensor", "test", "wifi-c", device_id=wifi.id)
    hass.states.async_set(contact.entity_id, "off")
    hass.states.async_set(plug.entity_id, "off")
    values: dict[str, Any] = {sensor.id: -72, wifi.id: -60}
    receivers: dict[str, Any] = {sensor.id: BUERO}

    def fake_source(_hass, device, _entries, _domains):
        # Beide aus der eigenen Aufzeichnung ("ble"); nur das Bluetooth-Gerät hat einen Empfänger
        return {"kind": "dbm", "value": values[device.id]}, None, "ble"

    monkeypatch.setattr(signal_history, "signal_source", fake_source)
    monkeypatch.setattr(signal_history, "ble_receiver", lambda _hass, device: receivers.get(device.id))
    monkeypatch.setattr(signal_history, "recorded", lambda _hass, _entity: True)
    hass.data[DATA_AVAILABILITY].evaluate()
    log: SignalLog = hass.data[DATA_SIGNAL]
    log.sample()
    freezer.tick(timedelta(minutes=1))
    receivers[sensor.id] = GARAGE
    log.sample()
    # Ein Gerät ohne Empfänger (kein Bluetooth) hat keinen Weg
    assert wifi.id not in log._via and [e[1] for e in log._via[sensor.id]] == [BUERO[0], GARAGE[0]]
    freezer.tick(timedelta(minutes=2))
    # Ausgefallen: Lücke im Weg
    hass.states.async_set(contact.entity_id, STATE_UNAVAILABLE)
    freezer.tick(timedelta(minutes=5))
    hass.data[DATA_AVAILABILITY].evaluate()
    log.sample()
    assert log._via[sensor.id][-1][1] is None
    # Die Lücke braucht Dauer, sonst erscheint sie nicht als Abschnitt
    freezer.tick(timedelta(minutes=3))
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/signal_history", "device_id": sensor.id, "range": "24h"})
    via = (await client.receive_json())["result"]["via"]
    assert [r["name"] for r in via["receivers"]] == ["Storen Büro", "Proxy Garage"]
    assert [s[2] for s in via["segments"]] == [0, 1, None] and via["changes"] and via["changes"][0][1:] == [0, 1]
    assert sum(r["share"] for r in via["receivers"]) == 100
    # Gerät ohne Weg: via ist None, ohne Fehler
    await client.send_json({"id": 2, "type": f"{DOMAIN}/signal_history", "device_id": wifi.id, "range": "24h"})
    reply = await client.receive_json()
    assert reply.get("success"), reply
    assert reply["result"]["via"] is None
