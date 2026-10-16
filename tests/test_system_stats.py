"""System-Werte der Status-App (system_stats.py, seit 2.68.0): Sensoren finden, Kurven aus dem Recorder, eigene Wahl."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import pytest
from homeassistant.components.recorder.models import StatisticMeanType
from homeassistant.components.recorder.statistics import async_import_statistics
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.components.recorder.common import async_wait_recording_done

from custom_components.device_panel import system_stats
from custom_components.device_panel.const import DOMAIN


@pytest.fixture
def mock_recorder_before_hass(async_test_recorder) -> None:
    """Recorder-Datenbank vor hass vorbereiten (wie in test_battery_history.py)."""


async def _setup(hass: HomeAssistant, **options: Any) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options=options)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()


def _sensor(hass: HomeAssistant, platform: str, uid: str, value: str, name: str, **attrs: Any) -> str:
    entry = er.async_get(hass).async_get_or_create("sensor", platform, uid, suggested_object_id=uid.replace("/", "_"))
    hass.states.async_set(entry.entity_id, value, {"unit_of_measurement": "%", "state_class": "measurement", "friendly_name": name, **attrs})
    return entry.entity_id


async def _ws(client, msg_id: int, **msg: Any) -> dict[str, Any]:
    await client.send_json({"id": msg_id, **msg})
    return await client.receive_json()


async def test_auto_detection_prefers_system_monitor(hass: HomeAssistant) -> None:
    cpu = _sensor(hass, "systemmonitor", "processor_use", "12", "Prozessornutzung")
    core_cpu = _sensor(hass, "hassio", "home_assistant_core_cpu_percent", "3", "Core CPU")
    core_ram = _sensor(hass, "hassio", "home_assistant_core_memory_percent", "20", "Core RAM")
    # Mehrere Festplatten: die Hauptplatte (genau "disk_use_percent") gewinnt vor den anderen
    other = _sensor(hass, "systemmonitor", "disk_use_percent_config", "55", "Config")
    main = _sensor(hass, "systemmonitor", "disk_use_percent", "41", "Festplatte /")
    assert system_stats.auto_entity(hass, "cpu") == (cpu, "host") and core_cpu != cpu
    # ohne System Monitor für den Arbeitsspeicher: der Wert von Core, als solcher gekennzeichnet
    assert system_stats.auto_entity(hass, "ram") == (core_ram, "core")
    assert system_stats.auto_entity(hass, "disk") == (main, "host") and other != main
    # deaktiviert zählt nicht
    er.async_get(hass).async_update_entity(main, disabled_by=er.RegistryEntryDisabler.USER)
    assert system_stats.auto_entity(hass, "disk") == (other, "host")


async def test_nothing_found_and_candidates(hass: HomeAssistant) -> None:
    assert [system_stats.auto_entity(hass, k) for k in system_stats.KINDS] == [None, None, None]
    eigen = _sensor(hass, "template", "mein-cpu", "7", "Mein Server CPU")
    # Batterie (Geräteklasse) und Sensoren ohne state_class stehen nicht zur Auswahl
    _sensor(hass, "test", "bat", "80", "Batterie", device_class="battery")
    hass.states.async_set("sensor.ohne_klasse", "5", {"unit_of_measurement": "%", "friendly_name": "Ohne"})
    assert [c["entity_id"] for c in system_stats.candidates(hass)] == [eigen]


async def test_without_recorder_and_without_sensors(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    res = (await _ws(client, 1, type=f"{DOMAIN}/status_system"))["result"]
    assert [m["id"] for m in res["metrics"]] == ["cpu", "ram", "disk"] and all(m["entity_id"] is None and m["points"] == [] for m in res["metrics"])
    cpu = _sensor(hass, "systemmonitor", "processor_use", "12", "Prozessornutzung")
    res = (await _ws(client, 2, type=f"{DOMAIN}/status_system"))["result"]
    m = res["metrics"][0]
    # Ohne Recorder: nur der aktuelle Wert
    assert m["entity_id"] == cpu and m["current"] == 12 and m["source"] == "none" and m["scope"] == "host" and [p[1] for p in m["points"]] == [12, 12]
    assert not (await _ws(client, 3, type=f"{DOMAIN}/status_system", range="3d"))["success"]


async def test_history_for_cpu_and_statistics_for_the_disk(recorder_mock, hass: HomeAssistant, hass_ws_client, freezer) -> None:
    cpu = _sensor(hass, "systemmonitor", "processor_use", "10", "Prozessornutzung")
    disk = _sensor(hass, "systemmonitor", "disk_use_percent", "60", "Festplatte")
    now = dt_util.utcnow()
    for at, value in ((now - timedelta(hours=20), "30"), (now - timedelta(hours=10), "90"), (now - timedelta(hours=1), "12")):
        freezer.move_to(at)
        hass.states.async_set(cpu, value, {"unit_of_measurement": "%", "state_class": "measurement", "friendly_name": "Prozessornutzung"})
        await async_wait_recording_done(hass)
    freezer.move_to(now)
    top = now.replace(hour=0, minute=0, second=0, microsecond=0)
    # Tagesmittel über 200 Tage: die Festplatte füllt sich von 40 % auf 60 %
    rows = [{"start": top - timedelta(days=d), "mean": 40 + (200 - d) * 0.1, "min": 40, "max": 60} for d in range(200, 0, -1)]
    async_import_statistics(
        hass,
        {"mean_type": StatisticMeanType.ARITHMETIC, "has_sum": False, "name": None, "source": "recorder", "statistic_id": disk, "unit_class": None, "unit_of_measurement": "%"},
        rows,
    )
    await async_wait_recording_done(hass)
    await _setup(hass)
    client = await hass_ws_client(hass)
    day = (await _ws(client, 1, type=f"{DOMAIN}/status_system", range="24h"))["result"]
    cpu_m = day["metrics"][0]
    assert cpu_m["source"] == "history" and cpu_m["days"] == 1 and cpu_m["max"] == 90 and cpu_m["current"] == 12
    assert {p[1] for p in cpu_m["points"]} >= {30, 90, 12}
    # CPU bleibt bei 24 Std., auch wenn die Festplatte einen längeren Zeitraum zeigt
    year = (await _ws(client, 2, type=f"{DOMAIN}/status_system", range="1y"))["result"]
    assert year["range"] == "1y" and year["metrics"][0]["days"] == 1 and year["metrics"][2]["days"] == 365
    d = year["metrics"][2]
    assert d["source"] == "statistics" and 195 <= len(d["points"]) <= 202 and d["current"] == 60 and d["max"] >= 59
    month = (await _ws(client, 3, type=f"{DOMAIN}/status_system", range="30d"))["result"]["metrics"][2]
    assert month["source"] == "statistics" and month["days"] == 30 and len(month["points"]) <= 300
    half = (await _ws(client, 4, type=f"{DOMAIN}/status_system", range="6m"))["result"]["metrics"][2]
    assert half["days"] == 180 and half["source"] == "statistics"


async def test_own_sensor_choice_and_validation(hass: HomeAssistant, hass_ws_client) -> None:
    auto = _sensor(hass, "systemmonitor", "processor_use", "12", "Prozessornutzung")
    own = _sensor(hass, "template", "mein-cpu", "7", "Mein Server CPU")
    await _setup(hass)
    client = await hass_ws_client(hass)
    assert (await _ws(client, 1, type=f"{DOMAIN}/status_system"))["result"]["metrics"][0]["entity_id"] == auto
    # eigene Wahl über die Optionen: gilt vor der automatischen
    saved = await _ws(client, 2, type=f"{DOMAIN}/set_options", values={"status_cpu_entity": own})
    assert saved["success"]
    m = (await _ws(client, 3, type=f"{DOMAIN}/status_system"))["result"]["metrics"][0]
    assert m["entity_id"] == own and m["scope"] == "own" and m["name"] == "Mein Server CPU" and m["missing"] is False
    # ungültig: nur sensor-Entitäten (oder leer)
    assert not (await _ws(client, 4, type=f"{DOMAIN}/set_options", values={"status_cpu_entity": "light.wohnzimmer"}))["success"]
    # gewählt, aber der Sensor ist weg: gemeldet statt still auf automatisch zurückgefallen
    hass.states.async_remove(own)
    gone = (await _ws(client, 5, type=f"{DOMAIN}/status_system"))["result"]["metrics"][0]
    assert gone["entity_id"] == own and gone["missing"] is True and gone["points"] == []
    # leer = wieder automatisch
    assert (await _ws(client, 6, type=f"{DOMAIN}/set_options", values={"status_cpu_entity": ""}))["success"]
    assert (await _ws(client, 7, type=f"{DOMAIN}/status_system"))["result"]["metrics"][0]["entity_id"] == auto
