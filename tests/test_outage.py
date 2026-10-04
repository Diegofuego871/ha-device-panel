"""Meldungen bei Ausfall und Rückkehr, Batterie täglich, Einstellungen pro Gerät."""

from __future__ import annotations

import time
from datetime import timedelta
from typing import Any

import pytest
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import CoreState, HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.device_panel.const import DATA_AVAILABILITY, DATA_BATTERY, DATA_OUTAGE, DOMAIN
from custom_components.device_panel.devices import async_list_devices


@pytest.fixture
async def setup(hass: HomeAssistant):
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    log = hass.data[DATA_AVAILABILITY]
    log._started = time.time() - 3600  # Anlaufphase überspringen
    return log


def _device(hass: HomeAssistant, name: str, domain: str = "test", **kwargs: Any) -> dr.DeviceEntry:
    source = MockConfigEntry(domain=domain, title=f"{name} Eintrag")
    source.add_to_hass(hass)
    return dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={(domain, name)}, name=name, **kwargs)


def _entity(hass: HomeAssistant, device: dr.DeviceEntry, domain: str, key: str, state: str, **kwargs: Any) -> str:
    entry = er.async_get(hass).async_get_or_create(domain, "test", f"{device.id}-{key}", device_id=device.id, **kwargs)
    hass.states.async_set(entry.entity_id, state)
    return entry.entity_id


async def _options(hass: HomeAssistant, **values: Any) -> None:
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    hass.config_entries.async_update_entry(entry, options={**entry.options, **values})
    await hass.async_block_till_done()


async def _tick(hass: HomeAssistant, log, freezer, minutes: float) -> None:
    freezer.tick(timedelta(minutes=minutes))
    log.evaluate()
    await hass.async_block_till_done()


async def test_outage_and_back_online(hass: HomeAssistant, setup, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    area = ar.async_get(hass).async_create("Küche")
    lamp = _device(hass, "Lampe", suggested_area="Küche")
    assert dr.async_get(hass).async_get(lamp.id).area_id == area.id
    light = _entity(hass, lamp, "light", "l", "on")
    await _options(hass, notify_service="notify.handy", notify_outage=True, notify_online=True)
    setup.evaluate()
    hass.states.async_set(light, "unavailable")
    await _tick(hass, setup, freezer, 1)
    assert calls == []  # noch nicht ausgefallen (Schwelle 2 Min.)
    await _tick(hass, setup, freezer, 2)
    # Sofort bei Erkennung
    assert len(calls) == 1
    assert calls[0].data["title"] == "Offline: Lampe"
    assert calls[0].data["message"].startswith("Küche · test · since ")
    assert calls[0].data["data"]["tag"] == f"{DOMAIN}_device_{lamp.id}"
    assert calls[0].data["data"]["url"] == f"/device-panel?device={lamp.id}"
    await _tick(hass, setup, freezer, 5)
    assert len(calls) == 1  # einmal
    hass.states.async_set(light, "on")
    await _tick(hass, setup, freezer, 0.5)
    assert len(calls) == 2
    assert calls[1].data["title"] == "Back online: Lampe"
    assert calls[1].data["message"] == "after 8 min · Küche"
    # Gleicher Tag: die Rückkehr ersetzt die Ausfall-Meldung
    assert calls[1].data["data"]["tag"] == calls[0].data["data"]["tag"]


async def test_switches_target_and_mute(hass: HomeAssistant, setup, freezer, hass_ws_client) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    lamp = _device(hass, "Lampe")
    light = _entity(hass, lamp, "light", "l", "on")
    plug = _device(hass, "Steckdose")
    switch = _entity(hass, plug, "switch", "s", "on")
    setup.evaluate()
    # Ohne Ziel und standardmässig aus: nichts
    hass.states.async_set(light, "unavailable")
    await _tick(hass, setup, freezer, 3)
    assert calls == []
    hass.states.async_set(light, "on")
    await _tick(hass, setup, freezer, 1)
    # Nur "wieder online" an, Steckdose stumm geschaltet
    await _options(hass, notify_service="notify.handy", notify_outage=False, notify_online=True)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_device_settings", "device_id": plug.id, "notify": False})
    assert (await client.receive_json())["result"] == {"notify": False}
    hass.states.async_set(light, "unavailable")
    hass.states.async_set(switch, "unavailable")
    await _tick(hass, setup, freezer, 3)
    assert calls == []  # Ausfall nicht gemeldet
    hass.states.async_set(light, "on")
    hass.states.async_set(switch, "on")
    await _tick(hass, setup, freezer, 1)
    assert [c.data["title"] for c in calls] == ["Back online: Lampe"]  # Steckdose stumm
    devices = {d["name"]: d for d in (await async_list_devices(hass, setup))["devices"]}
    assert devices["Steckdose"]["notify_off"] is True and devices["Lampe"]["notify_off"] is False


async def test_group_outage(hass: HomeAssistant, setup, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy", notify_outage=True, notify_online=True)
    lights = [_entity(hass, _device(hass, f"Zigbee {i}", domain="zha"), "light", "l", "on") for i in range(3)]
    setup.evaluate()
    for light in lights:
        hass.states.async_set(light, "unavailable")
    await _tick(hass, setup, freezer, 3)
    assert len(calls) == 1
    assert calls[0].data["title"] == "Group outage: 3 devices"
    assert calls[0].data["message"].startswith("Zigbee 0, Zigbee 1, Zigbee 2 · probably ")
    assert calls[0].data["data"]["url"] == "/device-panel"
    for light in lights:
        hass.states.async_set(light, "on")
    await _tick(hass, setup, freezer, 1)
    assert calls[1].data["title"] == "Back online: 3 devices"
    # Zusammenfassen aus: einzeln
    await _options(hass, notify_group=False)
    for light in lights:
        hass.states.async_set(light, "unavailable")
    await _tick(hass, setup, freezer, 3)
    assert [c.data["title"] for c in calls[2:]] == ["Offline: Zigbee 0", "Offline: Zigbee 1", "Offline: Zigbee 2"]


async def test_restart_does_not_repeat_outage(hass: HomeAssistant, hass_storage: dict[str, Any], freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    lamp = _device(hass, "Lampe")
    light = _entity(hass, lamp, "light", "l", "unavailable")
    hass_storage[f"{DOMAIN}.notify"] = {"version": 1, "minor_version": 1, "key": f"{DOMAIN}.notify", "data": {"offline": {lamp.id: time.time() - 600}}}
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options={"notify_service": "notify.handy", "notify_outage": True, "notify_online": True})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    log = hass.data[DATA_AVAILABILITY]
    log._started = time.time() - 3600
    await _tick(hass, log, freezer, 3)
    assert calls == []  # vor dem Neustart schon gemeldet
    hass.states.async_set(light, "on")
    await _tick(hass, log, freezer, 1)
    assert [c.data["title"] for c in calls] == ["Back online: Lampe"]
    assert hass.data[DATA_OUTAGE].offline == {}


async def test_restart_keeps_outage_and_duration(hass: HomeAssistant, hass_storage: dict[str, Any], freezer) -> None:
    # Seit 2 Tagen ausgefallen und gemeldet, dann Neustart von HA
    calls = async_mock_service(hass, "notify", "handy")
    lamp = _device(hass, "Lampe")
    light = _entity(hass, lamp, "light", "l", "unavailable")
    began = time.time() - 2 * 86400
    hass_storage[f"{DOMAIN}.availability"] = {
        "version": 1, "minor_version": 1, "key": f"{DOMAIN}.availability",
        "data": {"heartbeat": time.time() - 300, "devices": {lamp.id: [[began - 60, 1], [began, 0]]}},
    }
    hass_storage[f"{DOMAIN}.notify"] = {"version": 1, "minor_version": 1, "key": f"{DOMAIN}.notify", "data": {"offline": {lamp.id: began}}}
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options={"notify_service": "notify.handy", "notify_outage": True, "notify_online": True})
    entry.add_to_hass(hass)
    # Wie beim Hochfahren: Protokoll und Meldungen stehen, bevor HA läuft;
    # die erste Bewertung kommt mit "gestartet".
    hass.set_state(CoreState.not_running)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    hass.set_state(CoreState.running)
    hass.bus.async_fire(EVENT_HOMEASSISTANT_STARTED)
    await hass.async_block_till_done()
    log = hass.data[DATA_AVAILABILITY]
    # Erste Minuten (unter "Ausgefallen nach", Anlaufphase): kein "wieder online"
    for _ in range(4):
        await _tick(hass, log, freezer, 0.5)
    assert calls == []
    await _tick(hass, log, freezer, 6)
    assert calls == []  # derselbe Ausfall, nicht nochmals melden
    hass.states.async_set(light, "on")
    await _tick(hass, log, freezer, 0.5)
    assert [c.data["title"] for c in calls] == ["Back online: Lampe"]
    assert calls[0].data["message"].startswith("after 2 d")


async def test_outage_known_from_log_is_not_repeated(hass: HomeAssistant, setup, freezer) -> None:
    # Ausgefallen, eine Weile nicht überwacht (vergessen), wieder überwacht
    # und noch immer aus: derselbe Ausfall, keine zweite Meldung.
    calls = async_mock_service(hass, "notify", "handy")
    lamp = _device(hass, "Lampe", domain="hue")
    light = _entity(hass, lamp, "light", "l", "on")
    await _options(hass, notify_service="notify.handy", notify_outage=True, notify_online=True)
    setup.evaluate()
    hass.states.async_set(light, "unavailable")
    await _tick(hass, setup, freezer, 3)
    assert [c.data["title"] for c in calls] == ["Offline: Lampe"]
    await _options(hass, exclude_integrations=["hue"])
    await _tick(hass, setup, freezer, 60)
    assert lamp.id not in hass.data[DATA_OUTAGE].offline
    await _options(hass, exclude_integrations=[])
    await _tick(hass, setup, freezer, 1)
    assert [c.data["title"] for c in calls] == ["Offline: Lampe"]
    hass.states.async_set(light, "on")
    await _tick(hass, setup, freezer, 0.5)
    assert [c.data["title"] for c in calls] == ["Offline: Lampe", "Back online: Lampe"]
    assert calls[1].data["message"].startswith("after 1 h")


def _battery(hass: HomeAssistant, device: dr.DeviceEntry, state: str) -> str:
    return _entity(hass, device, "sensor", "bat", state, original_device_class="battery")


async def test_battery_per_device(hass: HomeAssistant, setup, hass_ws_client) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    watch = hass.data[DATA_BATTERY]
    a = _device(hass, "Fenster")
    _battery(hass, a, "10")
    b = _device(hass, "Rauchmelder")
    _battery(hass, b, "25")
    client = await hass_ws_client(hass)
    # Fenster: Warnung aus; Rauchmelder: eigene Schwelle 30 %
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_device_settings", "device_id": a.id, "battery": "off"})
    assert (await client.receive_json())["result"] == {"battery": "off"}
    await client.send_json({"id": 2, "type": f"{DOMAIN}/set_device_settings", "device_id": b.id, "battery": 30})
    assert (await client.receive_json())["success"]
    await _options(hass, battery_push=True, notify_service="notify.handy")
    await watch.async_check()
    assert [c.data["title"] for c in calls] == ["Low battery: Rauchmelder"]
    devices = {d["name"]: d for d in (await async_list_devices(hass, setup))["devices"]}
    assert devices["Fenster"]["battery"] == {"level": 10, "low": False}  # Wert ja, Warnung nein
    assert devices["Fenster"]["battery_setting"] == "off" and devices["Rauchmelder"]["battery_setting"] == 30
    assert devices["Rauchmelder"]["battery"]["low"] is True
    assert devices["Rauchmelder"]["battery_default"] == {"pct": 15, "integration": None, "push": True, "push_integration": None}
    assert devices["Fenster"]["has_battery"] is True
    # Zurück auf den globalen Wert
    await client.send_json({"id": 3, "type": f"{DOMAIN}/set_device_settings", "device_id": a.id, "battery": None})
    await client.receive_json()
    await watch.async_check()
    assert [c.data["title"] for c in calls][-1] == "Low battery: Fenster"
    # Ungültig
    for i, payload in enumerate(({"battery": 60}, {"battery": "aus"}, {"notify": "nein"}), 10):
        await client.send_json({"id": i, "type": f"{DOMAIN}/set_device_settings", "device_id": a.id, **payload})
        assert (await client.receive_json())["error"]["code"] == "invalid_format", payload
    await client.send_json({"id": 20, "type": f"{DOMAIN}/set_device_settings", "device_id": "gibtsnicht", "notify": False})
    assert (await client.receive_json())["error"]["code"] == "not_found"


@pytest.mark.parametrize("content", ["new", "all"])
async def test_battery_daily(hass: HomeAssistant, setup, content: str) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    watch = hass.data[DATA_BATTERY]
    _battery(hass, _device(hass, "A"), "10")
    await watch.async_check()  # A ist schon schwach, bevor Push eingeschaltet wird
    await _options(hass, battery_push=True, notify_service="notify.handy", battery_push_mode="daily", battery_push_time="07:30", battery_push_daily=content)
    _battery(hass, _device(hass, "B"), "9")
    await watch.async_check()
    assert calls == []  # täglich: nichts sofort
    names = lambda ids: sorted(watch.low[d]["name"] for d in ids)  # noqa: E731
    # Eingeschaltet: die gerade betroffenen kommen mit der ersten Tagesmeldung
    assert names(watch.pending) == ["A", "B"]
    await watch._async_daily()
    assert [c.data["title"] for c in calls] == ["Low battery: 2 devices"]
    assert watch.pending == set()
    # Ohne neue Geräte: "neu" bleibt still, "alle" erinnert erneut
    await watch._async_daily()
    assert len(calls) == (1 if content == "new" else 2)
    _battery(hass, _device(hass, "C"), "5")
    await watch.async_check()
    await watch._async_daily()
    assert calls[-1].data["title"] == ("Low battery: C" if content == "new" else "Low battery: 3 devices")


async def test_battery_daily_to_instant_keeps_pending(hass: HomeAssistant, setup) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    watch = hass.data[DATA_BATTERY]
    await _options(hass, battery_push=True, notify_service="notify.handy", battery_push_mode="daily")
    _battery(hass, _device(hass, "A"), "10")
    await watch.async_check()
    assert calls == [] and len(watch.pending) == 1
    # Vor der Tagesmeldung auf "sofort" umgestellt: A kommt jetzt
    await _options(hass, battery_push_mode="instant")
    assert [c.data["title"] for c in calls] == ["Low battery: A"]
    assert watch.pending == set()
    await watch.async_check()
    assert len(calls) == 1
