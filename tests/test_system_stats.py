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


def _disk_trio(hass: HomeAssistant, suffix: str = "", used: str = "412", free: str = "541", unit: str = "GiB") -> str:
    """Die drei Festplatten-Sensoren von System Monitor; gibt den Prozent-Sensor zurück."""
    pct = _sensor(hass, "systemmonitor", "disk_use_percent" + suffix, "43", "Festplatte")
    for key, value in (("disk_use", used), ("disk_free", free)):
        entry = er.async_get(hass).async_get_or_create("sensor", "systemmonitor", key + suffix, suggested_object_id=key + suffix)
        hass.states.async_set(entry.entity_id, value, {"unit_of_measurement": unit, "state_class": "measurement"})
    return pct


async def test_disk_size_in_gigabytes(hass: HomeAssistant) -> None:
    pct = _disk_trio(hass)
    assert system_stats.disk_size(hass, pct) == {"used": 412.0, "free": 541.0, "total": 953.0, "unit": "GiB"}
    # Ab 1024 GiB in TiB
    big = _disk_trio(hass, "_daten", used="1500", free="900")
    assert system_stats.disk_size(hass, big) == {"used": 1.5, "free": 0.9, "total": 2.3, "unit": "TiB"}
    # Frei in anderer Einheit: umgerechnet in die Einheit von "belegt" (1024 MiB = 1 GiB)
    mixed = _disk_trio(hass, "_misch", used="10", free="2048", unit="GiB")
    hass.states.async_set(er.async_get(hass).async_get_entity_id("sensor", "systemmonitor", "disk_free_misch"), "2048", {"unit_of_measurement": "MiB"})
    assert system_stats.disk_size(hass, mixed)["total"] == 12.0
    # Ein Sensor nicht lesbar, deaktiviert oder fremd: keine Grösse, nur Prozent
    hass.states.async_set(er.async_get(hass).async_get_entity_id("sensor", "systemmonitor", "disk_free"), "unavailable", {"unit_of_measurement": "GiB"})
    assert system_stats.disk_size(hass, pct) is None
    er.async_get(hass).async_update_entity(er.async_get(hass).async_get_entity_id("sensor", "systemmonitor", "disk_use_daten"), disabled_by=er.RegistryEntryDisabler.USER)
    assert system_stats.disk_size(hass, big) is None
    assert system_stats.disk_size(hass, _sensor(hass, "template", "eigene-platte", "50", "Eigene")) is None


async def test_status_system_carries_the_disk_size(hass: HomeAssistant, hass_ws_client) -> None:
    pct = _disk_trio(hass)
    await _setup(hass)
    client = await hass_ws_client(hass)
    metrics = (await _ws(client, 1, type=f"{DOMAIN}/status_system"))["result"]["metrics"]
    assert metrics[2]["entity_id"] == pct and metrics[2]["size"] == {"used": 412.0, "free": 541.0, "total": 953.0, "unit": "GiB"}
    assert metrics[0]["size"] is None and metrics[1]["size"] is None


async def test_nothing_found_and_candidates(hass: HomeAssistant) -> None:
    assert [system_stats.auto_entity(hass, k) for k in system_stats.KINDS] == [None, None, None]
    eigen = _sensor(hass, "template", "mein-cpu", "7", "Mein Server CPU")
    # Batterie (Geräteklasse) und Temperatur stehen zur Auswahl, aber nicht als naheliegende ("pref"); ein Prozent-Sensor ohne state_class
    # und Grössen-Sensoren für die Festplatte schon. Sensoren ohne Einheit oder mit Text fehlen.
    _sensor(hass, "test", "bat", "80", "Batterie", device_class="battery")
    hass.states.async_set("sensor.text", "an", {"unit_of_measurement": "x", "friendly_name": "Text"})
    hass.states.async_set("sensor.ohne_einheit", "5", {"friendly_name": "Ohne Einheit"})
    hass.states.async_set("sensor.ohne_klasse", "5", {"unit_of_measurement": "%", "friendly_name": "Ohne"})
    hass.states.async_set("sensor.system_monitor_belegter_massenspeicher", "300", {"unit_of_measurement": "GiB", "friendly_name": "Belegter Massenspeicher /", "device_class": "data_size"})
    hass.states.async_set("sensor.temperatur", "20", {"unit_of_measurement": "°C", "friendly_name": "Temperatur"})
    listing = system_stats.candidates(hass)
    ids = [c["entity_id"] for c in listing]
    assert sorted(ids) == sorted([eigen, "sensor.ohne_klasse", "sensor.system_monitor_belegter_massenspeicher", "sensor.temperatur", "sensor.test_bat"]) or "sensor.temperatur" in ids
    assert "sensor.text" not in ids and "sensor.ohne_einheit" not in ids
    by_id = {c["entity_id"]: c for c in listing}
    assert by_id["sensor.system_monitor_belegter_massenspeicher"]["unit"] == "GiB" and by_id["sensor.system_monitor_belegter_massenspeicher"]["pref"] is True
    assert by_id["sensor.temperatur"]["pref"] is False and by_id[eigen]["pref"] is True
    # die naheliegenden stehen vorn
    assert all(c["pref"] for c in listing[:3]) and not listing[-1]["pref"]


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
    # Zustand weg, Eintrag noch da (Integration lädt gerade neu): "pending", noch kein Fehler
    waiting = (await _ws(client, 5, type=f"{DOMAIN}/status_system"))["result"]["metrics"][0]
    assert waiting["entity_id"] == own and waiting["pending"] is True and waiting["missing"] is False and waiting["points"] == []
    # Eintrag auch weg: gelöscht
    er.async_get(hass).async_remove(own)
    gone = (await _ws(client, 6, type=f"{DOMAIN}/status_system"))["result"]["metrics"][0]
    assert gone["entity_id"] == own and gone["missing"] is True and gone["pending"] is False and gone["points"] == []
    # leer = wieder automatisch
    assert (await _ws(client, 7, type=f"{DOMAIN}/set_options", values={"status_cpu_entity": ""}))["success"]
    assert (await _ws(client, 8, type=f"{DOMAIN}/status_system"))["result"]["metrics"][0]["entity_id"] == auto


# --- ausgeschaltete Sensoren und Supervisor (seit 2.70.0) ---------------------


def _disabled(hass: HomeAssistant, platform: str, uid: str, name: str | None = None) -> str:
    entry = er.async_get(hass).async_get_or_create(
        "sensor", platform, uid, suggested_object_id=uid, original_name=name, disabled_by=er.RegistryEntryDisabler.INTEGRATION
    )
    return entry.entity_id


async def test_disabled_system_monitor_sensors_are_reported_and_enabled_on_request(hass: HomeAssistant, hass_ws_client) -> None:
    """System Monitor legt seine Sensoren ausgeschaltet an: das Panel sagt es und schaltet sie nur auf Knopfdruck ein."""
    pct = _disabled(hass, "systemmonitor", "disk_use_percent", "Disk usage /")
    use = _disabled(hass, "systemmonitor", "disk_use", "Disk use /")
    free = _disabled(hass, "systemmonitor", "disk_free", "Disk free /")
    other = _disabled(hass, "template", "fremd", "Fremder Sensor")
    await _setup(hass)
    client = await hass_ws_client(hass)
    disk = (await _ws(client, 1, type=f"{DOMAIN}/status_system"))["result"]["metrics"][2]
    assert disk["entity_id"] is None and {d["entity_id"] for d in disk["disabled"]} == {pct, use, free} and {d["name"] for d in disk["disabled"]} >= {"Disk usage /"}
    # nichts wird von selbst eingeschaltet
    assert all(er.async_get(hass).async_get(e).disabled_by for e in (pct, use, free))
    res = (await _ws(client, 2, type=f"{DOMAIN}/status_system_enable", kind="disk"))["result"]
    assert set(res["enabled"]) == {pct, use, free}
    registry = er.async_get(hass)
    assert all(registry.async_get(e).disabled_by is None for e in (pct, use, free)) and registry.async_get(other).disabled_by is not None
    # zweiter Aufruf: nichts mehr zu tun; unbekannte Art abgelehnt
    assert (await _ws(client, 3, type=f"{DOMAIN}/status_system_enable", kind="disk"))["result"]["enabled"] == []
    assert not (await _ws(client, 4, type=f"{DOMAIN}/status_system_enable", kind="gpu"))["success"]


async def test_disabled_size_sensors_next_to_an_enabled_percent_sensor(hass: HomeAssistant, hass_ws_client) -> None:
    pct = _sensor(hass, "systemmonitor", "disk_use_percent", "43", "Festplatte")
    use = _disabled(hass, "systemmonitor", "disk_use", "Disk use /")
    free = _disabled(hass, "systemmonitor", "disk_free", "Disk free /")
    await _setup(hass)
    client = await hass_ws_client(hass)
    disk = (await _ws(client, 1, type=f"{DOMAIN}/status_system"))["result"]["metrics"][2]
    assert disk["entity_id"] == pct and disk["size"] is None and {d["entity_id"] for d in disk["disabled"]} == {use, free}
    assert set((await _ws(client, 2, type=f"{DOMAIN}/status_system_enable", kind="disk"))["result"]["enabled"]) == {use, free}


async def test_enabling_only_touches_system_monitor_and_supervisor(hass: HomeAssistant, hass_ws_client) -> None:
    mine = _disabled(hass, "template", "disk_use_percent", "Meiner")
    await _setup(hass)
    client = await hass_ws_client(hass)
    assert (await _ws(client, 1, type=f"{DOMAIN}/status_system_enable", kind="disk"))["result"]["enabled"] == []
    assert er.async_get(hass).async_get(mine).disabled_by is not None


async def test_supervisor_disk_in_percent_from_used_and_total(hass: HomeAssistant, hass_ws_client) -> None:
    """Ohne System Monitor: Host-Festplatte des Supervisors (belegt und gesamt in GB), das Panel rechnet in Prozent."""
    used = er.async_get(hass).async_get_or_create("sensor", "hassio", "home_assistant_host_disk_used", suggested_object_id="host_disk_used").entity_id
    total = er.async_get(hass).async_get_or_create("sensor", "hassio", "home_assistant_host_disk_total", suggested_object_id="host_disk_total").entity_id
    hass.states.async_set(used, "120.5", {"unit_of_measurement": "GB", "friendly_name": "Host disk used"})
    hass.states.async_set(total, "482", {"unit_of_measurement": "GB", "friendly_name": "Host disk total"})
    await _setup(hass)
    client = await hass_ws_client(hass)
    disk = (await _ws(client, 1, type=f"{DOMAIN}/status_system"))["result"]["metrics"][2]
    assert disk["entity_id"] == used and disk["scope"] == "supervisor" and disk["current"] == pytest.approx(25.0, abs=0.01)
    assert disk["size"] == {"used": 120.5, "free": 361.5, "total": 482.0, "unit": "GB"}
    # System Monitor geht vor, sobald es seinen Sensor gibt
    pct = _sensor(hass, "systemmonitor", "disk_use_percent", "43", "Festplatte")
    assert (await _ws(client, 2, type=f"{DOMAIN}/status_system"))["result"]["metrics"][2]["entity_id"] == pct


async def test_supervisor_total_disabled_is_reported(hass: HomeAssistant, hass_ws_client) -> None:
    used = er.async_get(hass).async_get_or_create("sensor", "hassio", "home_assistant_host_disk_used", suggested_object_id="host_disk_used").entity_id
    hass.states.async_set(used, "120.5", {"unit_of_measurement": "GB"})
    total = _disabled(hass, "hassio", "home_assistant_host_disk_total", "Host disk total")
    await _setup(hass)
    client = await hass_ws_client(hass)
    disk = (await _ws(client, 1, type=f"{DOMAIN}/status_system"))["result"]["metrics"][2]
    # ohne "gesamt" keine Prozent: die Karte zeigt die Gigabyte, mit dem Hinweis auf den ausgeschalteten Sensor
    assert disk["mode"] == "absolute" and disk["unit"] == "GB" and disk["current"] == 120.5 and disk["size"] is None
    assert disk["axis_max"] == 200 and [d["entity_id"] for d in disk["disabled"]] == [total]
    assert (await _ws(client, 2, type=f"{DOMAIN}/status_system_enable", kind="disk"))["result"]["enabled"] == [total]


async def test_disk_without_percent_sensor_from_used_and_free(hass: HomeAssistant, hass_ws_client) -> None:
    """Der Prozent-Sensor von System Monitor fehlt (ausgeschaltet), "belegt" und "frei" sind da: das Panel rechnet Prozent selbst."""
    _disabled(hass, "systemmonitor", "disk_use_percent", "Massenspeicher-Auslastung /")
    use = _sensor(hass, "systemmonitor", "disk_use", "300", "Belegter Massenspeicher /", unit_of_measurement="GiB", device_class="data_size")
    free = _sensor(hass, "systemmonitor", "disk_free", "100", "Freier Massenspeicher /", unit_of_measurement="GiB", device_class="data_size")
    await _setup(hass)
    client = await hass_ws_client(hass)
    disk = (await _ws(client, 1, type=f"{DOMAIN}/status_system"))["result"]["metrics"][2]
    assert disk["entity_id"] == use and disk["mode"] == "percent" and disk["current"] == 75.0
    assert disk["size"] == {"used": 300.0, "free": 100.0, "total": 400.0, "unit": "GiB"} and free


async def test_disk_with_only_a_used_sensor_shows_gigabytes(hass: HomeAssistant, hass_ws_client) -> None:
    """Nur "belegt" (wie bei dir: sensor.system_monitor_belegter_massenspeicher): die Karte zeigt Gigabyte, Achse bis über den Höchstwert."""
    use = _sensor(hass, "systemmonitor", "disk_use", "318.4", "Belegter Massenspeicher /", unit_of_measurement="GiB", device_class="data_size")
    _disabled(hass, "systemmonitor", "disk_free", "Freier Massenspeicher /")
    await _setup(hass)
    client = await hass_ws_client(hass)
    disk = (await _ws(client, 1, type=f"{DOMAIN}/status_system"))["result"]["metrics"][2]
    assert disk["entity_id"] == use and disk["mode"] == "absolute" and disk["unit"] == "GiB" and disk["current"] == 318.4
    assert disk["axis_max"] == 500 and [p[1] for p in disk["points"]] == [318.4, 318.4] and disk["size"] is None
    # der ausgeschaltete "frei"-Sensor ist als Möglichkeit genannt (Prozent und Grösse gäbe es dann)
    assert len(disk["disabled"]) == 1 and disk["disabled"][0]["name"] == "Freier Massenspeicher /"


async def test_own_choice_of_a_gigabyte_sensor_for_the_disk(hass: HomeAssistant, hass_ws_client) -> None:
    mine = _sensor(hass, "template", "mein-nas", "1500", "NAS belegt", unit_of_measurement="GB", device_class="data_size")
    await _setup(hass)
    client = await hass_ws_client(hass)
    assert (await _ws(client, 1, type=f"{DOMAIN}/set_options", values={"status_disk_entity": mine}))["success"]
    disk = (await _ws(client, 2, type=f"{DOMAIN}/status_system"))["result"]["metrics"][2]
    assert disk["entity_id"] == mine and disk["mode"] == "absolute" and disk["unit"] == "GB" and disk["scope"] == "own" and disk["axis_max"] == 2000


def test_axis_max_is_a_round_number_above_the_peak() -> None:
    assert [system_stats._axis_max(v) for v in (0, 0.4, 7, 318.4, 480, 1500, 4800)] == [1, 0.5, 10, 500, 1000, 2000, 10000]


async def test_freshly_enabled_sensor_does_not_replace_a_working_one(hass: HomeAssistant, hass_ws_client) -> None:
    """
    Nach dem Einschalten hat der neue Sensor bis zum Neuladen der Integration (etwa 30 Sekunden) keinen Zustand: die Karte bleibt bei dem
    Sensor mit Werten und sagt nicht "existiert nicht mehr" (so sah es beim Nutzer aus, 2.70.0).
    """
    use = _sensor(hass, "systemmonitor", "disk_use", "318.4", "Belegter Massenspeicher /", unit_of_measurement="GiB", device_class="data_size")
    pct_entry = er.async_get(hass).async_get_or_create("sensor", "systemmonitor", "disk_use_percent", suggested_object_id="massenspeicher_auslastung")
    await _setup(hass)
    client = await hass_ws_client(hass)
    disk = (await _ws(client, 1, type=f"{DOMAIN}/status_system"))["result"]["metrics"][2]
    # Prozent-Sensor eingeschaltet, aber ohne Zustand: weiter "belegt" (Gigabyte) mit Werten
    assert disk["entity_id"] == use and disk["mode"] == "absolute" and disk["pending"] is False and disk["missing"] is False
    # kommt der Zustand, gewinnt der Prozent-Sensor wieder
    hass.states.async_set(pct_entry.entity_id, "43", {"unit_of_measurement": "%", "state_class": "measurement"})
    disk = (await _ws(client, 2, type=f"{DOMAIN}/status_system"))["result"]["metrics"][2]
    assert disk["entity_id"] == pct_entry.entity_id and disk["mode"] == "percent"
    # nur der eben eingeschaltete ohne Zustand: "pending" statt "existiert nicht mehr"
    hass.states.async_remove(pct_entry.entity_id)
    hass.states.async_remove(use)
    disk = (await _ws(client, 3, type=f"{DOMAIN}/status_system"))["result"]["metrics"][2]
    assert disk["entity_id"] in (pct_entry.entity_id, use) and disk["pending"] is True and disk["missing"] is False


async def test_own_choice_switched_off_in_ha_is_reported(hass: HomeAssistant, hass_ws_client) -> None:
    off = _disabled(hass, "systemmonitor", "processor_use", "Prozessornutzung")
    other = _disabled(hass, "template", "mein-ding", "Mein Ding")
    await _setup(hass)
    client = await hass_ws_client(hass)
    assert (await _ws(client, 1, type=f"{DOMAIN}/set_options", values={"status_cpu_entity": off}))["success"]
    cpu = (await _ws(client, 2, type=f"{DOMAIN}/status_system"))["result"]["metrics"][0]
    assert cpu["off"] is True and cpu["pending"] is False and cpu["missing"] is False and [d["entity_id"] for d in cpu["disabled"]] == [off]
    # ein Sensor einer anderen Plattform: gemeldet, aber nicht zum Einschalten angeboten
    assert (await _ws(client, 3, type=f"{DOMAIN}/set_options", values={"status_cpu_entity": other}))["success"]
    cpu = (await _ws(client, 4, type=f"{DOMAIN}/status_system"))["result"]["metrics"][0]
    assert cpu["off"] is True and cpu["disabled"] == []


async def test_new_percent_sensor_keeps_the_longer_history_of_used(recorder_mock, hass: HomeAssistant, hass_ws_client, freezer) -> None:
    """Der eben eingeschaltete Prozent-Sensor hat nur Werte ab jetzt; der Verlauf von "belegt" wird in Prozent umgerechnet (nichts geht verloren)."""
    now = dt_util.utcnow()
    use = er.async_get(hass).async_get_or_create("sensor", "systemmonitor", "disk_use", suggested_object_id="belegt").entity_id
    free = er.async_get(hass).async_get_or_create("sensor", "systemmonitor", "disk_free", suggested_object_id="frei").entity_id
    pct = er.async_get(hass).async_get_or_create("sensor", "systemmonitor", "disk_use_percent", suggested_object_id="prozent").entity_id
    attrs = {"unit_of_measurement": "GiB", "state_class": "measurement", "device_class": "data_size"}
    for at, value in ((now - timedelta(hours=20), "300"), (now - timedelta(hours=10), "310")):
        freezer.move_to(at)
        hass.states.async_set(use, value, attrs)
        await async_wait_recording_done(hass)
    freezer.move_to(now)
    hass.states.async_set(use, "318.4", attrs)
    hass.states.async_set(free, "100", attrs)
    hass.states.async_set(pct, "76.1", {"unit_of_measurement": "%", "state_class": "measurement"})
    await async_wait_recording_done(hass)
    await _setup(hass)
    client = await hass_ws_client(hass)
    disk = (await _ws(client, 1, type=f"{DOMAIN}/status_system"))["result"]["metrics"][2]
    assert disk["entity_id"] == pct and disk["mode"] == "percent"
    # Verlauf von "belegt": seit etwa 20 Stunden, in Prozent der Platte (300 von 418,4 GiB = 71,7 %)
    assert disk["points"][0][0] <= now.timestamp() - 19 * 3600 and disk["points"][0][1] == pytest.approx(300 / 418.4 * 100, abs=0.2)
    assert disk["size"] == {"used": 318.4, "free": 100.0, "total": 418.4, "unit": "GiB"}


def test_thin_peaks_keeps_a_short_spike_that_the_mean_would_hide() -> None:
    """CPU/RAM: je Abschnitt der höchste Wert (2.74.0); das Mittel verschluckte einen Ausschlag von ein paar Minuten."""
    from custom_components.device_panel.battery_history import thin

    start, end = 0.0, 86400.0
    points = [(i * 30.0, 100.0 if 40000 <= i * 30.0 <= 40150 else 3.0) for i in range(2880)]
    peaks = system_stats.thin_peaks(points, start, end, 300)
    mean = thin(points, start, end, 300)
    assert len(peaks) <= 301 and max(v for _t, v in peaks) == 100.0
    assert max(v for _t, v in mean) < 70  # genau das sah man auf der Karte: "Spitze 100 %", Kurve nur etwa die Hälfte
    # zeitlich geordnet, letzter Punkt bleibt, kurze Reihen unverändert
    assert [t for t, _v in peaks] == sorted(t for t, _v in peaks) and peaks[-1] == points[-1]
    assert system_stats.thin_peaks(points[:10], start, end, 300) == points[:10]
