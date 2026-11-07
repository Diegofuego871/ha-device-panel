"""Lademeldung (1.30.0): Anstieg + voll, Ersatzregel für Sprünge, wieder scharf, Integration/Gerät, Meldungstext."""

from __future__ import annotations

import time
from datetime import timedelta
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.device_panel.charge import ETA_POINTS_MAX, ETA_WINDOW, ChargeNotifier, _thin
from custom_components.device_panel.const import DATA_CHARGE, DOMAIN
from custom_components.device_panel.devices import async_set_device_settings
from custom_components.device_panel.options_api import values_from

OPTS = values_from({})


async def _setup(hass: HomeAssistant, **options: Any) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN, title="Device Panel",
        options={"notify_service": "notify.handy", "notify_charge": True, "charge_integrations": ["test"], **options},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def _device(hass: HomeAssistant, name: str, level: int = 50, domain: str = "test") -> tuple[dr.DeviceEntry, str]:
    source = next((e for e in hass.config_entries.async_entries(domain) if e.title == f"{domain} Eintrag"), None)
    if source is None:
        source = MockConfigEntry(domain=domain, title=f"{domain} Eintrag")
        source.add_to_hass(hass)
    device = dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={(domain, name)}, name=name)
    entity = er.async_get(hass).async_get_or_create("sensor", domain, f"{name}-bat", device_id=device.id, original_device_class="battery")
    hass.states.async_set(entity.entity_id, str(level), {"device_class": "battery", "unit_of_measurement": "%"})
    return device, entity.entity_id


def _bat(hass: HomeAssistant, entity: str, level: int) -> None:
    hass.states.async_set(entity, str(level), {"device_class": "battery", "unit_of_measurement": "%"})


def test_step_rise_then_full() -> None:
    n = ChargeNotifier.__new__(ChargeNotifier)
    n._chg, n._sessions = {}, {}
    n._state = {}
    n._charges = {}
    n._save = lambda: None  # type: ignore[method-assign]
    n._may_record = lambda dev: True  # type: ignore[method-assign]
    assert n.step("d", 40, 0, OPTS) is None
    assert n.step("d", 30, 100, OPTS) is None
    assert n.step("d", 22, 200, OPTS) is None  # tiefster Stand
    assert n.step("d", 35, 300, OPTS) is None  # Anstieg 13, noch nicht 20
    assert n.step("d", 60, 400, OPTS) is None  # lädt (Anstieg 38), noch nicht voll
    done = n.step("d", 100, 6200, OPTS)
    assert done == {"level": 100, "start": 22, "seconds": 6000}
    # Nur einmal; erst nach deutlichem Entladen wieder scharf
    assert n.step("d", 100, 6300, OPTS) is None
    assert n.step("d", 95, 6400, OPTS) is None
    assert n.step("d", 100, 6500, OPTS) is None
    assert n.step("d", 80, 7000, OPTS) is None
    assert n.step("d", 30, 8000, OPTS) is None
    assert n.step("d", 100, 9000, OPTS) is not None


def test_step_jump_and_fallback() -> None:
    n = ChargeNotifier.__new__(ChargeNotifier)
    n._chg, n._sessions = {}, {}
    n._state = {}
    n._charges = {}
    n._save = lambda: None  # type: ignore[method-assign]
    n._may_record = lambda dev: True  # type: ignore[method-assign]
    assert n.step("d", 38, 0, OPTS) is None
    # Selten gemeldet: ein Sprung 38 -> 100 reicht (Anstieg 62 >= 20, Dauer unbekannt gilt trotzdem als beobachtet)
    done = n.step("d", 100, 50, OPTS)
    assert done is not None and done["level"] == 100 and done["start"] == 38
    # Schon voll beim Start: keine Meldung
    n2 = ChargeNotifier.__new__(ChargeNotifier)
    n2._chg, n2._sessions = {}, {}
    n2._state = {}
    n2._charges = {}
    n2._save = lambda: None  # type: ignore[method-assign]
    n2._may_record = lambda dev: True  # type: ignore[method-assign]
    assert n2.step("e", 100, 0, OPTS) is None
    assert n2.step("e", 100, 10, OPTS) is None
    # Ziel 95: ab 95 voll
    opts = {**OPTS, "charge_full": 95}
    n3 = ChargeNotifier.__new__(ChargeNotifier)
    n3._chg, n3._sessions = {}, {}
    n3._state = {}
    n3._charges = {}
    n3._save = lambda: None  # type: ignore[method-assign]
    n3._may_record = lambda dev: True  # type: ignore[method-assign]
    n3.step("f", 50, 0, opts)
    assert n3.step("f", 96, 60, opts) is not None


async def test_push_for_integration_and_device(hass: HomeAssistant) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    area = ar.async_get(hass).async_create("Büro")
    device, eid = _device(hass, "Zahnbürste", 30)
    dr.async_get(hass).async_update_device(device.id, area_id=area.id)
    other, other_eid = _device(hass, "Wegwerf", 30, domain="andere")
    await _setup(hass)
    hass.states.async_set(eid, "55", {"device_class": "battery", "unit_of_measurement": "%"})
    hass.states.async_set(other_eid, "55", {"device_class": "battery", "unit_of_measurement": "%"})
    await hass.async_block_till_done()
    hass.states.async_set(eid, "100", {"device_class": "battery", "unit_of_measurement": "%"})
    hass.states.async_set(other_eid, "100", {"device_class": "battery", "unit_of_measurement": "%"})
    await hass.async_block_till_done()
    # Nur die Integration "test" ist eingeschaltet
    assert len(calls) == 1
    data = calls[0].data
    assert data["title"] == "🔋 Charged: Zahnbürste"
    assert data["message"] == "100 % · in < 1 min from 30 % · Büro"
    # Gerät schaltet ein: die andere Integration meldet jetzt auch
    await async_set_device_settings(hass, other.id, charge=True)
    await hass.data[DATA_CHARGE].async_rebuild()
    hass.states.async_set(other_eid, "20", {"device_class": "battery", "unit_of_measurement": "%"})
    await hass.async_block_till_done()
    hass.states.async_set(other_eid, "100", {"device_class": "battery", "unit_of_measurement": "%"})
    await hass.async_block_till_done()
    assert [c.data["title"] for c in calls] == ["🔋 Charged: Zahnbürste", "🔋 Charged: Wegwerf"]
    # Gerät schaltet aus, obwohl die Integration an ist
    await async_set_device_settings(hass, device.id, charge=False)
    await hass.data[DATA_CHARGE].async_rebuild()
    hass.states.async_set(eid, "20", {"device_class": "battery", "unit_of_measurement": "%"})
    await hass.async_block_till_done()
    hass.states.async_set(eid, "100", {"device_class": "battery", "unit_of_measurement": "%"})
    await hass.async_block_till_done()
    assert len(calls) == 2


async def test_master_switch_off(hass: HomeAssistant) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    _device_obj, eid = _device(hass, "Zahnbürste", 30)
    await _setup(hass, notify_charge=False)
    hass.states.async_set(eid, "100", {"device_class": "battery", "unit_of_measurement": "%"})
    await hass.async_block_till_done()
    assert not calls


async def test_message_texts(hass: HomeAssistant) -> None:
    await _setup(hass)
    n = hass.data[DATA_CHARGE]
    assert n.message({"level": 100, "start": 22, "seconds": 6000}, "Büro") == "100 % · in 1 h 40 min from 22 % · Büro"
    assert n.message({"level": 100, "start": 38, "seconds": None}, None) == "100 % · from 38 %"


# --- "Lädt gerade" (1.35.0): Chip und Markierung im Panel -------------------------------------------


def _notifier() -> ChargeNotifier:
    n = ChargeNotifier.__new__(ChargeNotifier)
    n._chg, n._sessions = {}, {}
    n._state = {}
    n._charges = {}
    n._save = lambda: None  # type: ignore[method-assign]
    n._may_record = lambda dev: True  # type: ignore[method-assign]
    n._level_logged = {}
    return n


def test_charging_by_level_rise_then_full_or_drop() -> None:
    n = _notifier()
    for level, at in ((40, 0), (30, 100), (22, 200), (30, 300)):
        n.step("d", level, at, OPTS)
    assert n.charging("d", 300, OPTS) is None  # Anstieg 8 < 20
    n.step("d", 50, 400, OPTS)
    info = n.charging("d", 400, OPTS)
    assert info == {"level": 50, "from": 22, "since": 200, "full": 100, "source": "level", "eta": None, "rate": None}  # Restzeit trägt noch nicht (seit 2.202.0)
    # Lange ohne Anstieg: unbekannt, nicht mehr "lädt"
    assert n.charging("d", 400 + 3 * 3600, OPTS) is None
    # Entladen (fünf Punkte unter dem Höchststand): der Tiefpunkt beginnt neu
    n.step("d", 60, 500, OPTS)
    n.step("d", 54, 600, OPTS)
    assert n.charging("d", 600, OPTS) is None
    assert n._state["d"]["min"] == 54
    # Voll: nicht mehr "lädt"
    n.step("d", 90, 700, OPTS)
    assert n.charging("d", 700, OPTS) is not None
    assert n.step("d", 100, 800, OPTS) is not None
    assert n.charging("d", 800, OPTS) is None


def test_charging_ignores_jump_to_full_and_unknown_devices() -> None:
    n = _notifier()
    n.step("d", 38, 0, OPTS)
    n.step("d", 100, 50, OPTS)  # Ersatzregel: Meldung, aber "geladen", nicht "lädt"
    assert n.charging("d", 50, OPTS) is None
    assert n.charging("fehlt", 50, OPTS) is None


async def test_charging_flag_in_list_and_entity_wins(hass: HomeAssistant) -> None:
    from custom_components.device_panel.devices import async_list_devices  # noqa: PLC0415

    await _setup(hass, charge_integrations=[])
    watcher = hass.data[DATA_CHARGE]
    device, entity = _device(hass, "Handy", level=20)
    other, other_entity = _device(hass, "Roboter", level=30)
    await watcher.async_rebuild()
    await async_set_device_settings(hass, device.id, charge=True)
    # Das Panel beobachtet alle Batteriegeräte, auch die ohne eingeschaltete Lademeldung
    assert set(watcher._entities) >= {entity, other_entity}
    for ent in (entity, other_entity):
        hass.states.async_set(ent, "55", {"device_class": "battery", "unit_of_measurement": "%"})
    await hass.async_block_till_done()
    by_name = {d["name"]: d for d in (await async_list_devices(hass))["devices"]}
    assert by_name["Handy"]["charging"] == {"level": 55, "from": 20, "since": by_name["Handy"]["charging"]["since"], "full": 100, "source": "level", "eta": None, "rate": None, "power_w": None}
    # Gleicher Anstieg, aber Lademeldung aus: nie "lädt" (Schwanken eines Sensors ist kein Laden)
    assert by_name["Roboter"]["charging"] is None
    # Lademeldung am Roboter eingeschaltet: derselbe Anstieg zählt jetzt
    await async_set_device_settings(hass, other.id, charge=True)
    by_name = {d["name"]: d for d in (await async_list_devices(hass))["devices"]}
    assert by_name["Roboter"]["charging"] is not None
    # Ladeanzeige des Geräts (Binärsensor battery_charging) geht vor: aus = nicht laden, auch bei steigendem Stand
    ereg = er.async_get(hass)
    flag = ereg.async_get_or_create("binary_sensor", "test", "Handy-chg", device_id=device.id, original_device_class="battery_charging")
    hass.states.async_set(flag.entity_id, "off")
    by_name = {d["name"]: d for d in (await async_list_devices(hass))["devices"]}
    assert by_name["Handy"]["charging"] is None
    hass.states.async_set(flag.entity_id, "on")
    by_name = {d["name"]: d for d in (await async_list_devices(hass))["devices"]}
    assert by_name["Handy"]["charging"]["source"] == "entity" and by_name["Handy"]["charging"]["level"] == 55


async def test_device_own_full_and_rise(hass: HomeAssistant) -> None:
    """Eigenes "Voll ab" und eigener Anstieg am Gerät (1.35.0) gelten für "lädt" und für den Push."""
    from custom_components.device_panel.devices import async_list_devices, device_charge_opts, device_settings  # noqa: PLC0415

    calls = async_mock_service(hass, "notify", "handy")
    await _setup(hass)
    device, entity = _device(hass, "Handy", level=30)
    other, other_entity = _device(hass, "Tablet", level=30)
    await hass.data[DATA_CHARGE].async_rebuild()
    await async_set_device_settings(hass, device.id, charge_full=95, charge_rise=10)
    assert device_settings(hass)["charge_full"] == {device.id: 95} and device_settings(hass)["charge_rise"] == {device.id: 10}
    opts = values_from({"notify_charge": True})
    assert device_charge_opts(hass, opts, device.id)["charge_full"] == 95 and device_charge_opts(hass, opts, other.id)["charge_full"] == 100
    for level in ("45", "46"):
        hass.states.async_set(entity, level, {"device_class": "battery", "unit_of_measurement": "%"})
        hass.states.async_set(other_entity, level, {"device_class": "battery", "unit_of_measurement": "%"})
        await hass.async_block_till_done()
    by_name = {d["name"]: d for d in (await async_list_devices(hass))["devices"]}
    # Mit Anstieg 10 lädt das Handy, das Tablet (global 20) noch nicht
    assert by_name["Handy"]["charging"] is not None and by_name["Tablet"]["charging"] is None
    assert by_name["Handy"]["charge_full_setting"] == 95 and by_name["Handy"]["charge_rise_setting"] == 10
    assert by_name["Tablet"]["charge_full_setting"] is None and by_name["Handy"]["charge_default"]["full"] == 100 and by_name["Handy"]["charge_default"]["rise"] == 20
    # 96 % ist für das Handy voll (95), für das Tablet nicht (100)
    for ent in (entity, other_entity):
        hass.states.async_set(ent, "96", {"device_class": "battery", "unit_of_measurement": "%"})
    await hass.async_block_till_done()
    assert len(calls) == 1 and calls[0].data["title"] == "🔋 Charged: Handy"
    # Zurück auf global
    await async_set_device_settings(hass, device.id, charge_full=None, charge_rise=None)
    assert device_settings(hass)["charge_full"] == {} and device_settings(hass)["charge_rise"] == {}


async def test_integration_own_full_and_rise(hass: HomeAssistant) -> None:
    """Eigenes "Voll ab" und Anstieg pro Integration (1.35.0): Gerät vor Integration vor global."""
    from custom_components.device_panel.devices import async_list_devices, charge_values, device_charge_opts  # noqa: PLC0415
    from custom_components.device_panel.options_api import charge_map  # noqa: PLC0415

    await _setup(hass, charge_full_integrations={"test": 95}, charge_rise_integrations={"test": 10})
    device, _entity = _device(hass, "Handy", level=30)
    other, _other = _device(hass, "Hue-Lampe", level=30, domain="hue")
    opts = values_from({"charge_full_integrations": {"test": 95}, "charge_rise_integrations": {"test": 10}})
    assert charge_values(opts, "test") == (95, 10, "test", "test")
    assert charge_values(opts, "hue") == (100, 20, None, None)
    assert device_charge_opts(hass, opts, device.id)["charge_full"] == 95 and device_charge_opts(hass, opts, other.id)["charge_full"] == 100
    # Das Gerät geht vor
    await async_set_device_settings(hass, device.id, charge_full=98)
    assert device_charge_opts(hass, opts, device.id)["charge_full"] == 98 and device_charge_opts(hass, opts, device.id)["charge_rise"] == 10
    by_name = {d["name"]: d for d in (await async_list_devices(hass))["devices"]}
    assert by_name["Handy"]["charge_default"]["full"] == 95 and by_name["Handy"]["charge_default"]["full_integration"] == "test"
    assert by_name["Hue-Lampe"]["charge_default"]["full"] == 100 and by_name["Hue-Lampe"]["charge_default"]["full_integration"] is None
    # Prüfung der Zuordnung
    import pytest  # noqa: PLC0415
    import pytest  # noqa: PLC0415
    import voluptuous as vol  # noqa: PLC0415

    assert charge_map("charge_full")({"zha": 95}) == {"zha": 95} and charge_map("charge_full")(None) == {}
    for bad in ({"zha": 49}, {"zha": 101}, {"zha": "x"}, {"ZHA!": 95}, [1]):
        with pytest.raises(vol.Invalid):
            charge_map("charge_full")(bad)
    assert values_from({"charge_full_integrations": {"zha": 49}})["charge_full_integrations"] == {}
    assert values_from({"charge_full_integrations": {"zha": 80}})["charge_full_integrations"] == {"zha": 80}


def test_full_80_needs_a_real_rise_or_jump() -> None:
    """"Voll ab" 80 (1.38.0): ein Schritt 79 → 80 ist kein Laden; ein Anstieg oder Sprung von mehr als 10 Punkten schon."""
    opts = {**OPTS, "charge_full": 80}
    n = _notifier()
    assert n.step("d", 70, 0, opts) is None
    assert n.step("d", 79, 60, opts) is None  # Anstieg 9 < 20
    assert n.step("d", 80, 120, opts) is None  # kein Sprung (vorher 79), kein Anstieg von 20 über den Tiefpunkt
    n2 = _notifier()
    n2.step("e", 40, 0, opts)
    assert n2.step("e", 60, 100, opts) is None
    done = n2.step("e", 80, 200, opts)
    assert done == {"level": 80, "start": 40, "seconds": 200}
    n3 = _notifier()
    n3.step("f", 60, 0, opts)
    assert n3.step("f", 80, 50, opts) is not None  # Anstieg 20 erreicht


async def test_device_full_range_50_to_100(hass: HomeAssistant, hass_ws_client) -> None:
    from custom_components.device_panel.devices import device_settings  # noqa: PLC0415

    await _setup(hass)
    device, _entity = _device(hass, "Handy", level=30)
    client = await hass_ws_client(hass)
    for i, (value, accepted) in enumerate(((80, True), (50, True), (49, False), (101, False)), start=1):
        await client.send_json({"id": i, "type": f"{DOMAIN}/set_device_settings", "device_id": device.id, "charge_full": value})
        assert (await client.receive_json())["success"] is accepted, value
    assert device_settings(hass)["charge_full"] == {device.id: 50}


async def test_charge_stopped_when_level_stalls(hass: HomeAssistant, freezer) -> None:
    """Ladung beendet (1.40.0): Stand N Minuten unverändert → "lädt" endet, Protokoll, Push nur mit Schalter."""
    from custom_components.device_panel import activity  # noqa: PLC0415

    calls = async_mock_service(hass, "notify", "handy")
    on, on_entity = _device(hass, "Zahnbürste", 30)
    off, off_entity = _device(hass, "Wegwerf", 30, domain="andere")  # Integration ohne Lademeldung
    await _setup(hass, notify_charge_stop=True)
    notifier = hass.data[DATA_CHARGE]
    opts = values_from({"notify_charge": True})
    for ent in (on_entity, off_entity):
        _bat(hass, ent, 55)
    await hass.async_block_till_done()
    now = time.time()
    assert notifier.charging(on.id, now, opts) is not None and notifier.check_stalls(now + 10 * 60) == []  # erst 10 von 15 Min.
    freezer.tick(timedelta(minutes=16))
    assert notifier.check_stalls(time.time()) == [on.id]  # "Wegwerf" hat keine Lademeldung: nie beendet
    await hass.async_block_till_done()
    assert notifier.charging(on.id, time.time(), opts) is None
    assert len(calls) == 1 and calls[0].data["title"] == "🔌 Charging stopped: Zahnbürste"
    assert calls[0].data["message"].startswith("55 % · ") and calls[0].data["message"].endswith("level unchanged for 15 min")
    texts = [e["text"] for e in activity.snapshot(hass)["entries"] if e["title"] == "Zahnbürste"]
    assert any(t.startswith("charging stopped at 55 % (full from 100 %): level unchanged for 15 min, sending") for t in texts)
    assert notifier.check_stalls(time.time()) == []  # nur einmal
    # Der Stand steigt wieder: die Ladung geht weiter
    _bat(hass, on_entity, 60)
    await hass.async_block_till_done()
    assert notifier.charging(on.id, time.time(), opts) is not None and "stopped" not in notifier._state[on.id]


async def test_charge_stopped_without_push_switch_or_target(hass: HomeAssistant, freezer) -> None:
    from custom_components.device_panel import activity  # noqa: PLC0415

    calls = async_mock_service(hass, "notify", "handy")
    device, entity = _device(hass, "Zahnbürste", 30)
    await _setup(hass)  # notify_charge_stop ist standardmässig aus
    notifier = hass.data[DATA_CHARGE]
    _bat(hass, entity, 55)
    await hass.async_block_till_done()
    freezer.tick(timedelta(minutes=16))
    assert notifier.check_stalls(time.time()) == [device.id]
    await hass.async_block_till_done()
    assert calls == []
    texts = [e["text"] for e in activity.snapshot(hass)["entries"] if e["title"] == "Zahnbürste"]
    assert any("the push for a stopped charge is off: no notification" in t for t in texts)


async def test_charge_stall_skips_device_with_indicator(hass: HomeAssistant, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    device, entity = _device(hass, "Handy", 30)
    ereg = er.async_get(hass)
    flag = ereg.async_get_or_create("binary_sensor", "test", "Handy-chg", device_id=device.id, original_device_class="battery_charging")
    hass.states.async_set(flag.entity_id, "on")
    await _setup(hass, notify_charge_stop=True)
    notifier = hass.data[DATA_CHARGE]
    _bat(hass, entity, 55)
    await hass.async_block_till_done()
    freezer.tick(timedelta(minutes=30))
    assert notifier.check_stalls(time.time()) == [] and calls == []  # die Ladeanzeige des Geräts meldet es selbst


async def test_stall_and_stop_per_integration_and_device(hass: HomeAssistant, freezer, hass_ws_client) -> None:
    """"Ladung beendet nach" und Push dazu (1.41.0): Gerät vor Integration vor global."""
    from custom_components.device_panel.devices import async_list_devices, charge_stop_values, device_charge_opts, device_settings  # noqa: PLC0415

    calls = async_mock_service(hass, "notify", "handy")
    a, a_entity = _device(hass, "Zahnbürste", 30)  # Integration "test": eigene 30 Min., Push an
    b, b_entity = _device(hass, "Rasierer", 30)  # wie Integration, aber am Gerät 5 Min. und Push aus
    await _setup(hass, charge_stall_integrations={"test": 30}, charge_stop_integrations={"test": True})
    notifier = hass.data[DATA_CHARGE]
    opts = values_from({"charge_stall_integrations": {"test": 30}, "charge_stop_integrations": {"test": True}})
    assert charge_stop_values(opts, "test") == (30, True, "test", "test") and charge_stop_values(opts, "andere") == (15, False, None, None)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_device_settings", "device_id": b.id, "charge_stall": 5, "charge_stop": False})
    assert (await client.receive_json())["success"]
    for i, bad in enumerate(({"charge_stall": 4}, {"charge_stall": 121}, {"charge_stop": "ja"}), start=2):
        await client.send_json({"id": i, "type": f"{DOMAIN}/set_device_settings", "device_id": b.id, **bad})
        assert (await client.receive_json())["success"] is False
    assert device_settings(hass)["charge_stall"] == {b.id: 5} and device_settings(hass)["charge_stop"] == {b.id: False}
    copts_b = device_charge_opts(hass, opts, b.id)
    copts_a = device_charge_opts(hass, opts, a.id)
    assert (copts_b["charge_stall"], copts_b["notify_charge_stop"], copts_a["charge_stall"], copts_a["notify_charge_stop"]) == (5, False, 30, True)
    by_name = {d["name"]: d for d in (await async_list_devices(hass))["devices"]}
    assert by_name["Rasierer"]["charge_stall_setting"] == 5 and by_name["Rasierer"]["charge_stop_setting"] is False
    assert by_name["Zahnbürste"]["charge_stall_setting"] is None and by_name["Zahnbürste"]["charge_default"]["stall"] == 30 and by_name["Zahnbürste"]["charge_default"]["stall_integration"] == "test" and by_name["Zahnbürste"]["charge_default"]["stop"] is True
    for ent in (a_entity, b_entity):
        _bat(hass, ent, 55)
    await hass.async_block_till_done()
    freezer.tick(timedelta(minutes=6))
    assert notifier.check_stalls(time.time()) == [b.id]  # Rasierer: 5 Min. am Gerät; Push aus
    await hass.async_block_till_done()
    assert calls == []
    freezer.tick(timedelta(minutes=25))
    assert notifier.check_stalls(time.time()) == [a.id]  # Zahnbürste: 30 Min. der Integration; Push an
    await hass.async_block_till_done()
    assert [c.data["title"] for c in calls] == ["🔌 Charging stopped: Zahnbürste"] and calls[0].data["message"].endswith("level unchanged for 30 min")
    # Zurück auf Integration bzw. global
    await async_set_device_settings(hass, b.id, charge_stall=None, charge_stop=None)
    assert device_settings(hass)["charge_stall"] == {} and device_settings(hass)["charge_stop"] == {}


def test_bool_and_stall_maps_validate() -> None:
    import pytest  # noqa: PLC0415
    import voluptuous as vol  # noqa: PLC0415

    from custom_components.device_panel.options_api import bool_map, charge_map  # noqa: PLC0415

    assert bool_map({"zha": True, "hue": False}) == {"hue": False, "zha": True} and bool_map(None) == {}
    for bad in ({"zha": 1}, {"ZHA!": True}, [1]):
        with pytest.raises(vol.Invalid):
            bool_map(bad)
    assert charge_map("charge_stall")({"zha": 10}) == {"zha": 10}
    for bad in ({"zha": 4}, {"zha": 121}):
        with pytest.raises(vol.Invalid):
            charge_map("charge_stall")(bad)
    assert values_from({"charge_stall_integrations": {"zha": 4}, "charge_stop_integrations": {"zha": "x"}})["charge_stall_integrations"] == {}
    assert values_from({"charge_stop_integrations": {"zha": "x"}})["charge_stop_integrations"] == {}


async def test_unchanged_level_is_not_logged_again(hass: HomeAssistant) -> None:
    """2.43.0: Wiederverbindungen (Matter, Eve) melden viele Geräte mit gleichem Wert; das Protokoll hält nur Änderungen fest."""
    from custom_components.device_panel import activity  # noqa: PLC0415

    _device(hass, "Eve Fenster", 100)
    device, entity = _device(hass, "Eve Tür", 100)
    await _setup(hass)
    activity.get(hass).debug = True
    for attrs in ({"friendly_name": "a"}, {"friendly_name": "b"}):  # gleicher Stand, neue Meldung durch geänderte Attribute
        hass.states.async_set(entity, "100", {"device_class": "battery", "unit_of_measurement": "%", **attrs})
        await hass.async_block_till_done()
    _bat(hass, entity, 99)
    await hass.async_block_till_done()
    texts = [e["text"] for e in activity.snapshot(hass)["entries"] if e["title"] == "Eve Tür" and e["cat"] == "charge"]
    assert len([t for t in texts if t.startswith("level 100 %")]) == 0 and len([t for t in texts if t.startswith("level 99 %")]) == 1


def test_eta_in_charging_dict(hass: HomeAssistant) -> None:
    """Restzeit der laufenden Ladung im Panel (2.202.0): Messpunkte werden gesammelt, die Schätzung kommt erst, wenn sie trägt, und entfällt nach "voll"."""
    n = ChargeNotifier(hass)
    t0 = 1000.0
    n.step("d", 40, t0, OPTS)
    assert n.charging("d", t0, OPTS) is None
    # 10 Minuten später 8 Punkte mehr: Anstieg und Zeitraum genügen (Anstieg 8 >= Schwelle), Tempo 0,8 Punkte pro Minute
    n.step("d", 48, t0 + 600, OPTS)
    info = n.charging("d", t0 + 600, OPTS)
    if info is None:  # Schwelle für "lädt" (Anstieg) noch nicht erreicht: weiter steigen lassen
        n.step("d", 60, t0 + 1200, OPTS)
        info = n.charging("d", t0 + 1200, OPTS)
    assert info is not None and info["eta"] is not None and info["rate"] > 0
    assert info["eta"] > info["since"]
    # Nach "voll" sind die Messpunkte weg
    n.step("d", 100, t0 + 4000, OPTS)
    assert "pts" not in n._state["d"]


async def test_capacity_and_power(hass: HomeAssistant) -> None:
    """Akku-Kapazität am Gerät (2.203.0): Speichern, ungültige Werte, "rechargeable", geschätzte Leistung ins Akku, Zurücksetzen mit der Lademeldung."""
    import pytest  # noqa: PLC0415
    import voluptuous as vol  # noqa: PLC0415
    from custom_components.device_panel.devices import (  # noqa: PLC0415
        _charging, async_device_overrides, async_list_devices, async_reset_device_settings, device_settings, valid_charge_wh,
    )

    await _setup(hass, notify_charge=True)
    device, entity = _device(hass, "Saugroboter", level=40)
    await hass.data[DATA_CHARGE].async_rebuild()
    assert valid_charge_wh(60) and valid_charge_wh(12.5) and not valid_charge_wh(0) and not valid_charge_wh(True) and not valid_charge_wh("60") and not valid_charge_wh(9999)
    await async_set_device_settings(hass, device.id, charge_wh=59.94)
    assert device_settings(hass)["charge_wh"] == {device.id: 59.9}
    by_name = {d["name"]: d for d in (await async_list_devices(hass))["devices"]}
    assert by_name["Saugroboter"]["charge_wh_setting"] == 59.9 and by_name["Saugroboter"]["rechargeable"] is True
    # Leistung: 1,2 Punkte pro Minute bei 60 Wh = 0,72 Wh pro Minute = 43,2 W
    watcher = hass.data[DATA_CHARGE]
    entries = er.async_entries_for_device(er.async_get(hass), device.id)
    now = time.time()
    watcher._state[device.id].update(min=40, min_at=now - 1800, last=76, up_at=now, pts=[[now - 1800, 40], [now - 900, 58], [now, 76]])
    from custom_components.device_panel.options_api import effective  # noqa: PLC0415

    opts = effective(hass)
    info = _charging(hass, opts, device, entries, now)
    assert info is not None and info["rate"] == 1.2 and info["power_w"] == round(1.2 / 100 * 59.9 * 60, 1)
    # Ohne Kapazität keine Leistung
    await async_set_device_settings(hass, device.id, charge_wh=None)
    assert _charging(hass, opts, device, entries, now)["power_w"] is None
    # Übersicht der eigenen Werte und Zurücksetzen gehören zur Lademeldung
    await async_set_device_settings(hass, device.id, charge_wh=60)
    own = await async_device_overrides(hass)
    assert own["charge"][0]["value"] == {"wh": 60.0}
    assert (await async_reset_device_settings(hass, [], [], charge=[device.id]))["charge"] == 1
    assert device_settings(hass)["charge_wh"] == {}


async def test_rechargeable_by_device_charge_or_live(hass: HomeAssistant) -> None:
    """Ladefähig (2.203.1): auch wenn die Lademeldung am Gerät "Ein" ist, aber der globale Schalter aus, oder wenn die Live-Aktivität für das Gerät an ist."""
    from custom_components.device_panel.devices import async_list_devices  # noqa: PLC0415

    await _setup(hass, notify_charge=False, charge_integrations=[])  # globaler Schalter "Lademeldung" aus
    a, _ = _device(hass, "Schloss A", level=40)
    b, _ = _device(hass, "Schloss B", level=40)
    c, _ = _device(hass, "Schloss C", level=40)
    await hass.data[DATA_CHARGE].async_rebuild()
    listed = {d["name"]: d for d in (await async_list_devices(hass))["devices"]}
    assert not any(listed[n]["rechargeable"] for n in ("Schloss A", "Schloss B", "Schloss C"))
    await async_set_device_settings(hass, a.id, charge=True)
    await async_set_device_settings(hass, b.id, charge_live=True)
    listed = {d["name"]: d for d in (await async_list_devices(hass))["devices"]}
    assert listed["Schloss A"]["rechargeable"] is True and listed["Schloss B"]["rechargeable"] is True and listed["Schloss C"]["rechargeable"] is False


def _notifier() -> ChargeNotifier:
    n = ChargeNotifier.__new__(ChargeNotifier)
    n._chg, n._sessions = {}, {}
    n._state = {}
    n._charges = {}
    n._save = lambda: None  # type: ignore[method-assign]
    n._may_record = lambda dev: True  # type: ignore[method-assign]
    n._level_logged = {}
    return n


def test_charge_recorded_when_full() -> None:
    """Eine Ladung bis "voll" wird mit ihren Messpunkten festgehalten (2.204.0): Start am Tiefpunkt, Ende bei "voll"."""
    n = _notifier()
    t = 10_000.0
    for i, level in enumerate((30, 36, 44, 53, 63, 74, 86, 100)):
        n.step("d", level, t + i * 300, OPTS)
    lst = n._charges["d"]
    assert len(lst) == 1 and lst[0]["from"] == 30 and lst[0]["to"] == 100 and lst[0]["start"] == t and lst[0]["end"] == t + 7 * 300
    assert [p[1] for p in lst[0]["pts"]] == [30, 36, 44, 53, 63, 74, 86, 100]
    assert "pts" not in n._state["d"]  # die laufende Sammlung ist leer
    assert n.charges_info("d") == (1, t + 7 * 300)


def test_charge_recorded_on_discharge_and_not_when_tiny() -> None:
    """Entladen beendet die Ladung (festgehalten); ein kleiner Anstieg oder zu wenige Punkte zählen nicht; dieselbe Ladung ersetzt sich; höchstens 5."""
    n = _notifier()
    t = 50_000.0
    # Anstieg von nur 1 Punkt: keine Ladung
    for i, level in enumerate((50, 51, 51)):
        n.step("a", level, t + i * 300, OPTS)
    n.step("a", 40, t + 2000, OPTS)  # Entladen beendet die kleine Schwankung
    assert "a" not in n._charges
    # Fünf echte Ladungen plus eine sechste: nur die letzten fünf bleiben
    now = t
    for k in range(6):
        for i, level in enumerate((20, 28, 37, 47, 58)):
            n.step("b", level, now + i * 300, OPTS)
        now += 5 * 300 + 100
        n.step("b", 10, now, OPTS)  # Entladen beendet diese Ladung
        now += 300
    starts = [c["start"] for c in n._charges["b"]]
    assert len(starts) == 5 and starts == sorted(starts)
    # derselbe Start ersetzt, statt doppelt zu stehen
    st = n._state["b"]
    st["pts"] = [[now, 10], [now + 300, 20], [now + 600, 30], [now + 900, 40]]
    n._record_charge("b", st, now + 1000)
    n._record_charge("b", st, now + 1100)
    assert len([c for c in n._charges["b"] if c["start"] == now]) == 1


def test_charges_view_power_and_storage() -> None:
    """Fenster "Ladungen": Kurve in Sekunden ab Start, mit Kapazität Leistung (geglättet), Durchschnitt und Spitze; ohne Kapazität keine Watt."""
    n = _notifier()
    t = 1000.0
    n._charges["d"] = [{"start": t, "end": t + 3000, "from": 20, "to": 80, "pts": [[t + i * 300, 20 + i * 6] for i in range(11)]}]
    ohne = n.charges_view("d", None)[0]
    assert ohne["watts"] is None and ohne["avg_w"] is None and ohne["minutes"] == 50 and ohne["pts"][0] == [0, 20] and ohne["pts"][-1] == [3000, 80]
    mit = n.charges_view("d", 60.0)[0]
    # 60 Punkte in 3000 s bei 60 Wh = 36 Wh in 50 Min. = 43,2 W
    assert mit["avg_w"] == 43.2 and mit["watts"][0] is None and all(abs(w - 43.2) < 0.2 for w in mit["watts"][1:])
    assert mit["peak_w"] is not None and mit["peak_w"] >= 43.1
    assert n.charges_view("unbekannt", 60.0) == []


async def test_charges_persist_and_ws(hass: HomeAssistant, hass_ws_client) -> None:
    """Die Ladungen überstehen einen Neustart (Speicher) und kommen über den Befehl device_panel/charges (nur Administratoren)."""
    await _setup(hass)
    device, _entity = _device(hass, "Saugroboter", level=20)
    await hass.data[DATA_CHARGE].async_rebuild()
    watcher = hass.data[DATA_CHARGE]
    t = time.time() - 4000
    for i, level in enumerate((20, 28, 37, 47, 58, 70, 82, 100)):
        watcher.step(device.id, level, t + i * 400, values_from({}))
    assert watcher.charges_info(device.id)[0] == 1
    await async_set_device_settings(hass, device.id, charge_wh=60)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "device_panel/charges", "device_id": device.id})
    res = (await client.receive_json())["result"]
    assert res["wh"] == 60 and len(res["charges"]) == 1 and res["charges"][0]["from"] == 20 and res["charges"][0]["to"] == 100 and res["charges"][0]["avg_w"] > 0
    # Speichern und neu laden
    await watcher._store.async_save({"state": watcher._state, "live": watcher._live, "charges": watcher._charges})
    fresh = ChargeNotifier(hass)
    await fresh.async_start()
    try:
        assert fresh.charges_info(device.id)[0] == 1 and fresh._charges[device.id][0]["pts"][-1][1] == 100
    finally:
        await fresh.async_stop()


def test_long_charge_with_decimals_keeps_its_start() -> None:
    """
    2.204.1: Ein Sensor mit Nachkommastellen meldet bei einer Ladung von 20 auf 100 % Hunderte von Ständen. Statt der ältesten fallen jetzt
    Punkte zwischen Beginn und Fenster der Restzeit weg: Die aufgezeichnete Ladung beginnt beim Tiefpunkt, nicht irgendwo in der Mitte.
    """
    n = _notifier()
    t = 50_000.0
    level, i = 20.0, 0
    while level < 100:
        n.step("d", level, t + i * 30, OPTS)
        level = round(level + 0.1, 1)
        i += 1
    n.step("d", 100.0, t + i * 30, OPTS)
    rec = n._charges["d"][0]
    assert rec["from"] == 20.0 and rec["start"] == t and rec["to"] == 100.0
    assert len(rec["pts"]) <= ETA_POINTS_MAX + 1
    # Die Zeit läuft vorwärts, der Stand steigt (keine vertauschten Punkte)
    assert all(a[0] < b[0] and a[1] < b[1] for a, b in zip(rec["pts"], rec["pts"][1:]))


def test_thin_keeps_first_and_recent_points() -> None:
    pts = [[float(i * 60), float(i) / 10] for i in range(ETA_POINTS_MAX + 1)]
    now = pts[-1][0]
    recent_before = [p for p in pts if now - p[0] <= ETA_WINDOW]
    _thin(pts, now)
    assert pts[0] == [0.0, 0.0] and len(pts) <= ETA_POINTS_MAX
    assert [p for p in pts if now - p[0] <= ETA_WINDOW] == recent_before


def test_rearm_resets_the_peak() -> None:
    """2.204.1: Nach "voll" und Entladen unter "Voll ab" − 10 beginnt eine neue Ladung am neuen Tiefpunkt (die alte Spitze 100 % zählt nicht mehr)."""
    n = _notifier()
    for at, level in enumerate((40, 70, 100)):
        n.step("d", level, at * 600.0, OPTS)
    n.step("d", 89, 5000.0, OPTS)  # wieder scharf
    for k, level in enumerate((91, 94, 97)):
        n.step("d", level, 6000.0 + k * 600, OPTS)
    st = n._state["d"]
    assert st["min"] == 89 and st["peak"] == 97
    assert [p[1] for p in st["pts"]] == [89, 91, 94, 97]


async def test_registry_bursts_rebuild_once(hass: HomeAssistant) -> None:
    """
    2.204.1: Viele Änderungen im Entitäts-Register am Stück (Start, Neueinbindung eines Funknetzes) bauen die beobachteten Sensoren nicht je
    Ereignis neu auf: die erste sofort, die übrigen zusammen einmal nach REBUILD_COOLDOWN Sekunden. Ein neues Gerät wird danach beobachtet.
    """
    from homeassistant.util import dt as dt_util  # noqa: PLC0415
    from pytest_homeassistant_custom_component.common import async_fire_time_changed  # noqa: PLC0415

    from custom_components.device_panel.charge import REBUILD_COOLDOWN  # noqa: PLC0415

    async def cooldown() -> None:
        async_fire_time_changed(hass, dt_util.utcnow() + timedelta(seconds=REBUILD_COOLDOWN + 1))
        await hass.async_block_till_done()

    await _setup(hass)
    # Die Einrichtung selbst ändert das Register: deren Frist ablaufen lassen (nach dem gesammelten Aufbau beginnt noch eine Frist)
    await cooldown()
    await cooldown()
    watcher = hass.data[DATA_CHARGE]
    calls: list[float] = []
    original = watcher._rebuilder.function

    async def counting() -> None:
        calls.append(time.time())
        await original()

    watcher._rebuilder.function = counting
    device, entity = _device(hass, "Roller", level=30)
    for i in range(20):
        er.async_get(hass).async_update_entity(entity, name=f"Akku {i}")
    await hass.async_block_till_done()
    assert len(calls) == 1
    await cooldown()
    assert len(calls) == 2
    assert watcher._entities.get(entity) == device.id


def test_curve_check_noise_drift_and_short_top_up() -> None:
    """
    2.204.1, Kurvenprüfung: Rauschen und Temperatur zeichnen keine Ladung auf (vorher genügten 2 Punkte Anstieg), kurzes Nachladen
    (40 → 52 % in 30 Minuten) schon, auch unter dem "Anstieg" des Geräts (Standard 20); ein Batteriewechsel (Sprung) nie.
    """
    n = _notifier()
    t = 0.0
    # Rauschen in 2-%-Schritten über einen Tag
    for i, level in enumerate((60, 62, 60, 62, 64, 62, 60, 62, 60, 58, 60, 62, 60)):
        n.step("noise", level, t + i * 3600, OPTS)
    # Langsamer Anstieg durch Wärme: +6 in 10 Stunden, dann zurück
    for i, level in enumerate((60, 61, 61, 62, 63, 63, 64, 65, 65, 66, 60, 54)):
        n.step("warm", level, t + i * 3600, OPTS)
    # Kurz nachladen, danach entladen
    for i, level in enumerate((40, 42, 44, 46, 48, 50, 52, 52, 50, 47, 45)):
        n.step("top", level, t + i * 300, OPTS)
    # Batteriewechsel: Sprung von 20 auf 100
    for i, level in enumerate((20, 100, 99, 97, 94, 90, 85)):
        n.step("swap", level, t + i * 3600, OPTS)
    assert "noise" not in n._charges and "warm" not in n._charges and "swap" not in n._charges
    rec = n._charges["top"][0]
    assert rec["from"] == 40 and rec["to"] == 52


def test_is_charge_rules() -> None:
    from custom_components.device_panel.charge import is_charge  # noqa: PLC0415

    hour = 3600.0
    # Über dem "Anstieg": leichte Rückgänge erlaubt (Wolken), langsam auch
    assert is_charge([[0, 30], [hour, 36], [2 * hour, 35], [3 * hour, 44], [5 * hour, 52], [8 * hour, 60]], 20)
    # zu viele Rückgänge über dem "Anstieg"
    assert not is_charge([[0, 30], [hour, 45], [2 * hour, 35], [3 * hour, 50], [4 * hour, 40], [5 * hour, 55]], 20)
    # unter dem "Anstieg": nur ohne Rückgang und zügig
    assert is_charge([[0, 40], [600, 43], [1200, 46], [1800, 50]], 20)
    assert not is_charge([[0, 40], [600, 43], [1200, 42], [1800, 50]], 20)
    assert not is_charge([[0, 40], [3 * hour, 43], [6 * hour, 46], [9 * hour, 50]], 20)  # 1,1 Punkte pro Stunde
    assert not is_charge([[0, 40], [600, 42], [1200, 43], [1800, 44]], 20)  # nur 4 Punkte
    assert not is_charge([[0, 20], [60, 100]], 20)  # Sprung


async def test_charge_by_indicator(hass: HomeAssistant) -> None:
    """
    2.204.1: Mit eigener Ladeanzeige (binary_sensor battery_charging) bestimmt die Anzeige Beginn und Ende der Ladung, auch bei kleinem
    Anstieg; kurzes Einstecken ohne Anstieg zählt nicht; die laufende Ladung übersteht einen Neustart.
    """
    await _setup(hass)
    device, bat = _device(hass, "Handy", level=40)
    indicator = er.async_get(hass).async_get_or_create("binary_sensor", "test", "Handy-chg", device_id=device.id, original_device_class="battery_charging")
    hass.states.async_set(indicator.entity_id, "off")
    watcher = hass.data[DATA_CHARGE]
    await watcher.async_rebuild()
    await hass.async_block_till_done()
    assert watcher._chg == {indicator.entity_id: device.id}
    # Kurz eingesteckt, kein Anstieg: nichts
    hass.states.async_set(indicator.entity_id, "on")
    await hass.async_block_till_done()
    hass.states.async_set(indicator.entity_id, "off")
    await hass.async_block_till_done()
    assert watcher.charges_info(device.id)[0] == 0
    # Echte Ladung 40 → 46 (unter dem "Anstieg" 20, die Anzeige sagt es)
    hass.states.async_set(indicator.entity_id, "on")
    await hass.async_block_till_done()
    session = watcher._sessions[device.id]
    for level in (42, 44, 46):
        _bat(hass, bat, level)
        await hass.async_block_till_done()
    # Neustart mitten in der Ladung: die laufende Ladung bleibt
    await watcher._store.async_save({"state": watcher._state, "live": watcher._live, "charges": watcher._charges, "sessions": watcher._sessions})
    fresh = ChargeNotifier(hass)
    await fresh.async_start()
    try:
        assert fresh._sessions[device.id]["start"] == session["start"] and [p[1] for p in fresh._sessions[device.id]["pts"]] == [40, 42, 44, 46]
    finally:
        await fresh.async_stop()
    session["start"] -= 3600  # eine Stunde geladen
    hass.states.async_set(indicator.entity_id, "off")
    await hass.async_block_till_done()
    lst = watcher._charges[device.id]
    assert len(lst) == 1 and lst[0]["from"] == 40 and lst[0]["to"] == 46 and lst[0]["start"] == session["start"]
    assert device.id not in watcher._sessions


async def test_only_rechargeable_devices_record_charges(hass: HomeAssistant) -> None:
    """2.205.0: Ein Sensor mit Messrauschen (Temperatur) ist nicht ladefähig; seine Kurve füllt keinen Platz, auch wenn sie wie eine Ladung aussieht."""
    from custom_components.device_panel.charge import is_charge  # noqa: PLC0415

    noise = [[0, 44], [360, 52], [720, 53], [1440, 55]]  # Log eines Kühlschrank-Sensors
    assert is_charge(noise, 5)  # allein am Stand nicht zu trennen
    await _setup(hass, charge_integrations=[])
    plain, _e1 = _device(hass, "Kühlschrank", 50)
    phone, _e2 = _device(hass, "Handy", 50)
    n = ChargeNotifier(hass)
    assert not n._may_record(plain.id)
    from custom_components.device_panel.devices import device_settings  # noqa: PLC0415

    device_settings(hass).setdefault("charge", {})[phone.id] = True
    assert n._may_record(phone.id) and not n._may_record(plain.id)
    n._save = lambda: None  # type: ignore[method-assign]
    for dev in (plain.id, phone.id):
        n._record_charge(dev, {"pts": noise}, 2000.0, 5)
    assert plain.id not in n._charges and len(n._charges[phone.id]) == 1


async def test_level_debug_line_is_throttled(hass: HomeAssistant) -> None:
    """2.205.0: Die Debug-Zeile "Stand" kommt je Gerät höchstens alle 10 Minuten (und bei Wechsel lädt/lädt nicht), nicht bei jedem Wert."""
    from custom_components.device_panel import activity  # noqa: PLC0415

    device, entity = _device(hass, "Saugroboter", 90)
    await _setup(hass)
    activity.get(hass).debug = True
    for level in (89, 88, 87, 86, 85):
        _bat(hass, entity, level)
        await hass.async_block_till_done()
    texts = [e["text"] for e in activity.snapshot(hass)["entries"] if e["title"] == "Saugroboter" and e["cat"] == "charge"]
    assert len([t for t in texts if t.startswith("level ")]) == 1
