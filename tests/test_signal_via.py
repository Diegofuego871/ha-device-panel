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

    def fake_source(_hass, device, _entries, _domains, smooth=True):
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


async def test_bluetooth_prefers_the_live_value_over_the_sensor_of_the_device(hass: HomeAssistant, monkeypatch) -> None:
    """SwitchBot und ähnliche (2.41.2): Wert und Empfänger kommen aus Bluetooth (bester Empfang), der Sensor des Geräts ist nur Ersatz."""
    from custom_components.device_panel import devices

    await _setup(hass)
    source = MockConfigEntry(domain="test")
    source.add_to_hass(hass)
    reg = dr.async_get(hass)
    device = reg.async_get_or_create(
        config_entry_id=source.entry_id, identifiers={("test", "sb")}, name="Sitzplatz", connections={(dr.CONNECTION_BLUETOOTH, BUERO[0])}
    )
    sensor = er.async_get(hass).async_get_or_create("sensor", "test", "sb-rssi", device_id=device.id, original_device_class="signal_strength")
    hass.states.async_set(sensor.entity_id, "-100", {"device_class": "signal_strength", "unit_of_measurement": "dBm"})
    live: dict[str, Any] = {"v": ({"kind": "dbm", "value": -70}, BUERO[1])}
    monkeypatch.setattr(devices, "_ble_signal", lambda _hass, _address: live["v"])
    entries = er.async_entries_for_device(er.async_get(hass), device.id)
    signal, via, src = devices.signal_source(hass, device, entries, {"test"})
    # Live-Wert (-70) statt Sensor (-100), Empfänger dazu, Quelle "ble" (eigene Aufzeichnung statt Recorder)
    assert signal and signal["value"] == -70 and src == "ble" and via == BUERO[1]
    # Meldet Bluetooth nichts, bleibt der Sensor Ersatz (ohne Empfänger)
    live["v"] = (None, None)
    signal, via, src = devices.signal_source(hass, device, entries, {"test"})
    assert signal and signal["value"] == -100 and src == sensor.entity_id and via is None

    live["v"] = ({"kind": "dbm", "value": -70}, BUERO[1])
    monkeypatch.setattr(signal_history, "ble_receiver", lambda _hass, _device: BUERO)
    hass.data[DATA_AVAILABILITY].evaluate()
    log: SignalLog = hass.data[DATA_SIGNAL]
    log.sample()
    assert [e[1] for e in log._via[device.id]] == [BUERO[0]]
    # Der Wert wird aufgezeichnet (Quelle "ble"): der Verlauf beginnt neu
    assert log._open[device.id][1] == [-70.0]
    result = await signal_history.async_signal_history(hass, log, device, "24h", time.time() + 3600)
    assert result["source"] == "log" and result["via"]["receivers"][0]["name"] == "Storen Büro"


def test_receiver_names_are_shown_without_addresses(hass: HomeAssistant) -> None:
    """2.50.0: "Name (Adresse)" erscheint im Panel als "Name"; heissen zwei Empfänger gleich, bleibt die Adresse bei ihnen."""
    log = SignalLog(hass)
    log.note_via("a", ("E4:B3:23:17:F5:3A", "Shelly Eingang EG Aussen (E4:B3:23:17:F5:3A)"), NOW - 7200)
    log.note_via("a", ("FC:B4:67:0E:B5:3E", "Storen Küche (FC:B4:67:0E:B5:3E)"), NOW - 3600)
    names = [r["name"] for r in log.via_summary("a", "24h", NOW)["receivers"]]
    assert names == ["Shelly Eingang EG Aussen", "Storen Küche"]
    # Die gespeicherten Namen bleiben unverändert (nur die Anzeige ändert sich)
    assert log._via_names["E4:B3:23:17:F5:3A"].endswith("(E4:B3:23:17:F5:3A)")
    # Zwei gleiche Namen: sonst nicht zu unterscheiden
    twin = SignalLog(hass)
    twin.note_via("b", ("AA:AA:AA:AA:AA:01", "Proxy (AA:AA:AA:AA:AA:01)"), NOW - 7200)
    twin.note_via("b", ("AA:AA:AA:AA:AA:02", "Proxy (AA:AA:AA:AA:AA:02)"), NOW - 3600)
    assert [r["name"] for r in twin.via_summary("b", "24h", NOW)["receivers"]] == ["Proxy (AA:AA:AA:AA:AA:01)", "Proxy (AA:AA:AA:AA:AA:02)"]
    # Nur eine Adresse als Name bleibt, wie sie ist
    only = SignalLog(hass)
    only.note_via("c", ("AA:BB:CC:00:00:09", "AA:BB:CC:00:00:09"), NOW - 100)
    assert only.via_summary("c", "24h", NOW)["receivers"][0]["name"] == "AA:BB:CC:00:00:09"
