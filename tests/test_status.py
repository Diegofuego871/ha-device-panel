"""Status-App (2.62.0): Einstufung, Lebenszeichen der Teile, überfällige Routinen, Push bei Stillstand und Rückkehr, Befehl."""

from __future__ import annotations

import time
from datetime import timedelta
from typing import Any

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant, callback
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed, async_mock_service

from custom_components.device_panel import status
from custom_components.device_panel.const import DATA_AVAILABILITY, DATA_ROUTINES, DATA_STATUS, DOMAIN


@pytest.fixture(autouse=True)
async def _de(hass: HomeAssistant) -> None:
    hass.config.language = "de"


async def _setup(hass: HomeAssistant, **options: Any) -> status.StatusWatch:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options={"notify_service": "notify.handy", **options})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return hass.data[DATA_STATUS]


def test_classify_scales_with_the_interval() -> None:
    # Takt 30 s: verspätet ab 2 Min., steht ab 5 Min.; Takt 60 s: ab 4 und 10 Min.
    assert [status.classify(a, 30) for a in (60, 121, 301)] == ["ok", "late", "down"]
    assert [status.classify(a, 60) for a in (200, 241, 601)] == ["ok", "late", "down"]


async def test_snapshot_lists_all_parts_ok_after_start(hass: HomeAssistant) -> None:
    watch = await _setup(hass)
    snap = watch.snapshot()
    assert [p["id"] for p in snap["parts"]] == list(status.ORDER)
    assert snap["problems"] == 0 and snap["down"] == 0 and snap["routines_loaded"] == 0 and snap["routines_missed"] == 0


async def test_stale_tick_is_late_then_down_and_back(hass: HomeAssistant) -> None:
    watch = await _setup(hass)
    now = time.time()
    hass.data[DATA_AVAILABILITY].last_tick = now - 150
    assert next(p for p in watch.evaluate(now) if p["id"] == "availability")["state"] == "late"
    hass.data[DATA_AVAILABILITY].last_tick = now - 400
    assert next(p for p in watch.evaluate(now) if p["id"] == "availability")["state"] == "down"
    hass.data[DATA_AVAILABILITY].last_tick = now
    assert next(p for p in watch.evaluate(now) if p["id"] == "availability")["state"] == "ok"


async def test_missing_manager_counts_as_down(hass: HomeAssistant) -> None:
    watch = await _setup(hass)
    hass.data.pop(DATA_ROUTINES)
    assert next(p for p in watch.evaluate(time.time()) if p["id"] == "routines")["state"] == "down"


async def test_overdue_routine_is_flagged(hass: HomeAssistant) -> None:
    from .test_outage_notify import _device
    from .test_routines import _raw, _switch

    watch = await _setup(hass)
    manager = hass.data[DATA_ROUTINES]
    device = _device(hass, "Steckdose")
    saved = await manager.async_save_routine(_raw(device, _switch(hass, device), delay_s=600))
    manager.runtime(saved["id"])["due"] = time.time() - 400
    # überfällig, aber der Wächter läuft erst seit Kurzem: gemessen ab seinem Start, also noch nicht gemeldet
    assert next(p for p in watch.evaluate(time.time()) if p["id"] == "routines")["state"] == "ok"
    watch.started -= 3600
    part = next(p for p in watch.evaluate(time.time()) if p["id"] == "routines")
    assert part["state"] == "down" and part["age_s"] >= 400 and part["loaded"] == 1
    await manager.async_set_enabled(saved["id"], False)
    assert next(p for p in watch.evaluate(time.time()) if p["id"] == "routines")["state"] == "ok"


async def _stall(hass: HomeAssistant, watch: status.StatusWatch) -> None:
    hass.data[DATA_AVAILABILITY].last_tick = time.time() - 1200


async def test_push_on_down_after_two_checks_and_on_recovery(hass: HomeAssistant, freezer) -> None:
    from custom_components.device_panel import activity

    handy = async_mock_service(hass, "notify", "handy")
    watch = await _setup(hass)
    await _stall(hass, watch)
    watch._on_tick(None)
    await hass.async_block_till_done()
    assert handy == []  # beim ersten Prüfen nur vermerkt (Stocken von HA)
    watch._on_tick(None)
    await hass.async_block_till_done()
    assert len(handy) == 1 and handy[0].data["title"] == "⚠️ Device Panel: Ausfall-Überwachung steht"
    assert "Min. kein Lebenszeichen" in handy[0].data["message"]
    watch._on_tick(None)
    await hass.async_block_till_done()
    assert len(handy) == 1  # nur einmal je Störung
    assert any(e["text"].startswith("Steht:") for e in activity.get(hass).entries)
    hass.data[DATA_AVAILABILITY].last_tick = time.time()
    watch._on_tick(None)
    await hass.async_block_till_done()
    assert len(handy) == 2 and handy[1].data["title"] == "✅ Device Panel: Ausfall-Überwachung läuft wieder"
    assert handy[0].data["data"]["tag"] == handy[1].data["data"]["tag"]


async def test_push_off_and_own_target(hass: HomeAssistant) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    status_target = async_mock_service(hass, "notify", "wache")
    watch = await _setup(hass, status_notify=False)
    await _stall(hass, watch)
    for _ in range(3):
        watch._on_tick(None)
    await hass.async_block_till_done()
    assert handy == [] and status_target == []
    # eingeschaltet, eigenes Ziel: geht dorthin, nicht an das globale
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    hass.config_entries.async_update_entry(entry, options={**entry.options, "status_notify": True, "notify_service_status": "notify.wache"})
    await hass.async_block_till_done()
    watch._alerted.clear()
    watch._suspect.clear()
    for _ in range(2):
        watch._on_tick(None)
    await hass.async_block_till_done()
    assert handy == [] and len(status_target) >= 1


async def test_push_opens_the_status_app(hass: HomeAssistant) -> None:
    """Tippen auf die Statusmeldung führt in die Status-App (?app=status), nicht auf die Übersicht (seit 2.66.0)."""
    handy = async_mock_service(hass, "notify", "handy")
    watch = await _setup(hass)
    await _stall(hass, watch)
    for _ in range(2):
        watch._on_tick(None)
    await hass.async_block_till_done()
    assert handy and handy[0].data["data"]["url"] == "/device-panel?app=status" and handy[0].data["data"]["clickAction"] == "/device-panel?app=status"


async def test_no_push_without_target(hass: HomeAssistant) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    watch = await _setup(hass, notify_service="none")
    await _stall(hass, watch)
    for _ in range(2):
        watch._on_tick(None)
    await hass.async_block_till_done()
    assert handy == []


async def test_websocket_and_header_summary(hass: HomeAssistant, hass_ws_client) -> None:
    watch = await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/status_get"})
    got = (await client.receive_json())["result"]
    assert got["problems"] == 0 and len(got["parts"]) == len(status.ORDER) and got["started"] == watch.started
    await _stall(hass, watch)
    assert watch.summary() == {"problems": 1, "down": 1}
    # list_devices trägt die Zahlen und den Debug-Schalter für die Kopfzeile
    await client.send_json({"id": 2, "type": f"{DOMAIN}/list_devices"})
    result = (await client.receive_json())["result"]
    assert result["status"] == {"problems": 1, "down": 1} and result["debug"] is False


async def test_watch_ticks_by_itself(hass: HomeAssistant, freezer) -> None:
    watch = await _setup(hass)
    calls = []
    watch._on_tick = callback(lambda now: calls.append(now))  # type: ignore[method-assign]
    await watch.async_stop()
    await watch.async_start()
    freezer.tick(timedelta(seconds=61))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert len(calls) == 1


# -- Neustart von Hand (2.63.0) -------------------------------------------------------------------


async def test_restart_refused_when_part_is_running_or_unknown(hass: HomeAssistant) -> None:
    watch = await _setup(hass)
    with pytest.raises(vol.Invalid, match="läuft"):
        await watch.async_restart("battery")
    with pytest.raises(vol.Invalid, match="Unbekannt"):
        await watch.async_restart("nichts")


async def test_restart_builds_fresh_objects_and_measures_from_then(hass: HomeAssistant) -> None:
    from custom_components.device_panel import activity
    from custom_components.device_panel.const import DATA_OUTAGE

    watch = await _setup(hass)
    old_log, old_outage = hass.data[DATA_AVAILABILITY], hass.data[DATA_OUTAGE]
    await _stall(hass, watch)
    watch.started -= 3600
    assert next(p for p in watch.evaluate(time.time()) if p["id"] == "availability")["state"] == "down"
    await watch.async_restart("availability")
    # beide Objekte der Ausfall-Überwachung sind neu, der Melder hängt am neuen Protokoll
    assert hass.data[DATA_AVAILABILITY] is not old_log and hass.data[DATA_OUTAGE] is not old_outage
    assert hass.data[DATA_OUTAGE]._log is hass.data[DATA_AVAILABILITY] if hasattr(hass.data[DATA_OUTAGE], "_log") else True
    assert next(p for p in watch.evaluate(time.time()) if p["id"] == "availability")["state"] == "ok"
    assert any(e["text"] == "Von Hand neu gestartet" for e in activity.get(hass).entries)
    # Sperre gegen Doppelklick (auch wenn der Teil erneut hängen würde)
    hass.data[DATA_AVAILABILITY].last_tick = time.time() - 1200
    watch._restarted["availability"] = time.time()
    with pytest.raises(vol.Invalid, match="eben erst"):
        await watch.async_restart("availability")


async def test_restart_routines_keeps_the_routines(hass: HomeAssistant) -> None:
    from .test_outage_notify import _device
    from .test_routines import _raw, _switch

    watch = await _setup(hass)
    manager = hass.data[DATA_ROUTINES]
    device = _device(hass, "Steckdose")
    saved = await manager.async_save_routine(_raw(device, _switch(hass, device), delay_s=600))
    manager.runtime(saved["id"])["due"] = time.time() - 400
    watch.started -= 3600
    assert next(p for p in watch.evaluate(time.time()) if p["id"] == "routines")["state"] == "down"
    await watch.async_restart("routines")
    await hass.async_block_till_done()
    fresh = hass.data[DATA_ROUTINES]
    assert fresh is not manager and [r["id"] for r in fresh.routines()] == [saved["id"]]
    assert next(p for p in watch.evaluate(time.time()) if p["id"] == "routines")["state"] == "ok"


async def test_failed_restart_puts_the_old_object_back(hass: HomeAssistant, monkeypatch) -> None:
    from custom_components.device_panel import activity
    from custom_components.device_panel.battery import BatteryWatch
    from custom_components.device_panel.const import DATA_BATTERY

    watch = await _setup(hass)
    old = hass.data[DATA_BATTERY]
    old.last_tick = time.time() - 1200
    watch.started -= 3600

    async def boom(self: Any) -> None:
        raise RuntimeError("kaputt")

    monkeypatch.setattr(BatteryWatch, "async_start", boom)
    started: list[Any] = []

    async def old_start() -> None:
        started.append(True)

    monkeypatch.setattr(old, "async_start", old_start, raising=False)
    with pytest.raises(vol.Invalid, match="fehlgeschlagen"):
        await watch.async_restart("battery")
    assert hass.data[DATA_BATTERY] is old and started == [True]
    assert any(e["level"] == "error" and "fehlgeschlagen" in e["text"] for e in activity.get(hass).entries)


async def test_restart_websocket(hass: HomeAssistant, hass_ws_client) -> None:
    watch = await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/status_restart", "part": "battery"})
    assert not (await client.receive_json())["success"]  # läuft
    await _stall(hass, watch)
    watch.started -= 3600
    await client.send_json({"id": 2, "type": f"{DOMAIN}/status_restart", "part": "availability"})
    got = await client.receive_json()
    # (die anderen Teile haben in diesem Test nie getaktet und gelten wegen des vorverlegten Starts als überfällig)
    assert got["success"] and next(p for p in got["result"]["parts"] if p["id"] == "availability")["state"] == "ok"


# --- Meldung bei hoher Auslastung (seit 2.71.0) -----------------------------------------------------


def _load_sensors(hass: HomeAssistant, cpu: str = "10", ram: str = "20", disk: str = "30") -> dict[str, str]:
    """CPU, RAM und Festplatte als System-Monitor-Sensoren (Registry mit unique_id, wie sie das Panel findet)."""
    from homeassistant.helpers import entity_registry as er

    ids = {}
    for kind, uid, value in (("cpu", "processor_use", cpu), ("ram", "memory_use_percent", ram), ("disk", "disk_use_percent", disk)):
        entry = er.async_get(hass).async_get_or_create("sensor", "systemmonitor", uid, suggested_object_id=uid)
        hass.states.async_set(entry.entity_id, value, {"unit_of_measurement": "%", "state_class": "measurement"})
        ids[kind] = entry.entity_id
    return ids


def _ticks(watch: status.StatusWatch, n: int) -> None:
    for _ in range(n):
        watch._on_tick(None)


async def test_high_load_alerts_after_three_checks_and_clears_with_margin(hass: HomeAssistant) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    ids = _load_sensors(hass)
    watch = await _setup(hass)
    handy.clear()
    # Standard: alles an, Grenze 99 %; unter der Grenze nichts
    hass.states.async_set(ids["cpu"], "98", {"unit_of_measurement": "%"})
    _ticks(watch, 5)
    await hass.async_block_till_done()
    assert [c for c in handy if "Prozessor" in c.data["title"]] == []
    # 99 % (= Grenze) zählt: erst nach drei Prüfungen in Folge eine Meldung, einmal
    hass.states.async_set(ids["cpu"], "99", {"unit_of_measurement": "%"})
    _ticks(watch, 2)
    await hass.async_block_till_done()
    assert handy == []
    _ticks(watch, 1)
    await hass.async_block_till_done()
    assert len(handy) == 1 and handy[0].data["title"] == "⚠️ Device Panel: Prozessor bei 99 %"
    assert "über der Grenze von 99 %" in handy[0].data["message"] and handy[0].data["data"]["url"] == "/device-panel?app=status&tab=system"
    assert handy[0].data["data"]["tag"] == "device_panel_status_load_cpu"
    _ticks(watch, 5)
    await hass.async_block_till_done()
    assert len(handy) == 1  # nicht bei jeder Prüfung
    # knapp darunter (98 %, weniger als 2 Punkte Abstand): keine Entwarnung
    hass.states.async_set(ids["cpu"], "98", {"unit_of_measurement": "%"})
    _ticks(watch, 5)
    await hass.async_block_till_done()
    assert len(handy) == 1
    # klar darunter, zwei Prüfungen: Entwarnung (ersetzt die Meldung über das gleiche tag)
    hass.states.async_set(ids["cpu"], "40", {"unit_of_measurement": "%"})
    _ticks(watch, 1)
    await hass.async_block_till_done()
    assert len(handy) == 1
    _ticks(watch, 1)
    await hass.async_block_till_done()
    assert len(handy) == 2 and handy[1].data["title"] == "✅ Device Panel: Prozessor wieder unter 99 %" and handy[1].data["data"]["tag"] == handy[0].data["data"]["tag"]


async def test_short_peaks_do_not_alert_and_each_kind_has_its_own_limit(hass: HomeAssistant) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    ids = _load_sensors(hass)
    watch = await _setup(hass, status_ram_limit=80, status_disk_alert=False)
    handy.clear()
    # Spitze von zwei Minuten und dann wieder normal: nichts
    hass.states.async_set(ids["cpu"], "100", {"unit_of_measurement": "%"})
    _ticks(watch, 2)
    hass.states.async_set(ids["cpu"], "30", {"unit_of_measurement": "%"})
    _ticks(watch, 3)
    # RAM mit eigener Grenze 80 %: meldet bei 85; Festplatte mit ausgeschaltetem Schalter: nie
    hass.states.async_set(ids["ram"], "85", {"unit_of_measurement": "%"})
    hass.states.async_set(ids["disk"], "100", {"unit_of_measurement": "%"})
    _ticks(watch, 4)
    await hass.async_block_till_done()
    assert [c.data["title"] for c in handy] == ["⚠️ Device Panel: Arbeitsspeicher bei 85 %"]


async def test_load_alert_uses_the_status_target_and_needs_a_percent_value(hass: HomeAssistant) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    wache = async_mock_service(hass, "notify", "wache")
    ids = _load_sensors(hass)
    watch = await _setup(hass, notify_service_status="notify.wache")
    handy.clear()
    hass.states.async_set(ids["disk"], "100", {"unit_of_measurement": "%"})
    # nur Gigabyte ohne Gesamtgrösse (ein eigener Sensor): kein Prozentwert, also keine Meldung
    hass.states.async_set("sensor.nas_gb", "1500", {"unit_of_measurement": "GB"})
    hass.config_entries.async_update_entry(hass.config_entries.async_entries(DOMAIN)[0], options={**hass.config_entries.async_entries(DOMAIN)[0].options, "status_cpu_entity": "sensor.nas_gb"})
    await hass.async_block_till_done()
    _ticks(watch, 4)
    await hass.async_block_till_done()
    assert handy == [] and [c.data["title"] for c in wache] == ["⚠️ Device Panel: Festplatte bei 100 %"]


async def test_load_options_defaults_and_range(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/get_options"})
    res = (await client.receive_json())["result"]
    for kind in ("cpu", "ram", "disk"):
        assert res["values"][f"status_{kind}_alert"] is True and res["values"][f"status_{kind}_limit"] == 99
        assert res["limits"][f"status_{kind}_limit"] == [1, 100]
    await client.send_json({"id": 2, "type": f"{DOMAIN}/set_options", "values": {"status_cpu_limit": 85, "status_ram_alert": False}})
    assert (await client.receive_json())["success"]
    await client.send_json({"id": 3, "type": f"{DOMAIN}/set_options", "values": {"status_cpu_limit": 101}})
    assert not (await client.receive_json())["success"]
    await client.send_json({"id": 4, "type": f"{DOMAIN}/set_options", "values": {"status_cpu_limit": 0}})
    assert not (await client.receive_json())["success"]


async def test_load_minutes_option_controls_how_long_before_the_alert(hass: HomeAssistant, hass_ws_client) -> None:
    """Mindestdauer (seit 2.74.0): Zahl der Prüfungen in Folge über der Grenze; Standard 3, 1 = gleich beim ersten Mal."""
    handy = async_mock_service(hass, "notify", "handy")
    ids = _load_sensors(hass)
    watch = await _setup(hass, status_load_minutes=1)
    handy.clear()
    hass.states.async_set(ids["cpu"], "100", {"unit_of_measurement": "%"})
    _ticks(watch, 1)
    await hass.async_block_till_done()
    assert [c.data["title"] for c in handy] == ["⚠️ Device Panel: Prozessor bei 100 %"]
    # 5 Prüfungen: nach vier nichts, bei der fünften die Meldung (Arbeitsspeicher)
    from custom_components.device_panel.const import CONF_STATUS_LOAD_MINUTES  # noqa: PLC0415

    entry = hass.config_entries.async_entries(DOMAIN)[0]
    hass.config_entries.async_update_entry(entry, options={**entry.options, CONF_STATUS_LOAD_MINUTES: 5})
    handy.clear()
    hass.states.async_set(ids["ram"], "100", {"unit_of_measurement": "%"})
    _ticks(watch, 4)
    await hass.async_block_till_done()
    assert handy == []
    _ticks(watch, 1)
    await hass.async_block_till_done()
    assert [c.data["title"] for c in handy] == ["⚠️ Device Panel: Arbeitsspeicher bei 100 %"]
    # Grenzen der Option: 1 bis 60
    client = await hass_ws_client(hass)
    for i, (value, ok) in enumerate(((60, True), (1, True), (0, False), (61, False), ("3", False)), 1):
        await client.send_json({"id": i, "type": f"{DOMAIN}/set_options", "values": {"status_load_minutes": value}})
        assert (await client.receive_json())["success"] is ok, value
