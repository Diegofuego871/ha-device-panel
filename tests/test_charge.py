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
