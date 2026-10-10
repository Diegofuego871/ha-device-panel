"""Lademeldung (1.30.0): Anstieg + voll, Ersatzregel für Sprünge, wieder scharf, Integration/Gerät, Meldungstext."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.device_panel.charge import ChargeNotifier
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


def test_step_rise_then_full() -> None:
    n = ChargeNotifier.__new__(ChargeNotifier)
    n._state = {}
    n._save = lambda: None  # type: ignore[method-assign]
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
    n._state = {}
    n._save = lambda: None  # type: ignore[method-assign]
    assert n.step("d", 38, 0, OPTS) is None
    # Selten gemeldet: ein Sprung 38 -> 100 reicht (Anstieg 62 >= 20, Dauer unbekannt gilt trotzdem als beobachtet)
    done = n.step("d", 100, 50, OPTS)
    assert done is not None and done["level"] == 100 and done["start"] == 38
    # Schon voll beim Start: keine Meldung
    n2 = ChargeNotifier.__new__(ChargeNotifier)
    n2._state = {}
    n2._save = lambda: None  # type: ignore[method-assign]
    assert n2.step("e", 100, 0, OPTS) is None
    assert n2.step("e", 100, 10, OPTS) is None
    # Ziel 95: ab 95 voll
    opts = {**OPTS, "charge_full": 95}
    n3 = ChargeNotifier.__new__(ChargeNotifier)
    n3._state = {}
    n3._save = lambda: None  # type: ignore[method-assign]
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
    assert data["title"] == "Charged: Zahnbürste"
    assert data["message"] == "100 % · in < 1 min from 30 % · Büro"
    # Gerät schaltet ein: die andere Integration meldet jetzt auch
    await async_set_device_settings(hass, other.id, charge=True)
    await hass.data[DATA_CHARGE].async_rebuild()
    hass.states.async_set(other_eid, "20", {"device_class": "battery", "unit_of_measurement": "%"})
    await hass.async_block_till_done()
    hass.states.async_set(other_eid, "100", {"device_class": "battery", "unit_of_measurement": "%"})
    await hass.async_block_till_done()
    assert [c.data["title"] for c in calls] == ["Charged: Zahnbürste", "Charged: Wegwerf"]
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
    n._state = {}
    n._save = lambda: None  # type: ignore[method-assign]
    return n


def test_charging_by_level_rise_then_full_or_drop() -> None:
    n = _notifier()
    for level, at in ((40, 0), (30, 100), (22, 200), (30, 300)):
        n.step("d", level, at, OPTS)
    assert n.charging("d", 300, OPTS) is None  # Anstieg 8 < 20
    n.step("d", 50, 400, OPTS)
    info = n.charging("d", 400, OPTS)
    assert info == {"level": 50, "from": 22, "since": 200, "source": "level"}
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
    assert by_name["Handy"]["charging"] == {"level": 55, "from": 20, "since": by_name["Handy"]["charging"]["since"], "source": "level"}
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
    assert len(calls) == 1 and calls[0].data["title"] == "Charged: Handy"
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
