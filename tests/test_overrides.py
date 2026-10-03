"""Einstellungen pro Gerät: Übersicht in get_options und Zurücksetzen."""

from __future__ import annotations

import time
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.device_panel.const import DATA_AVAILABILITY, DOMAIN


@pytest.fixture
async def setup(hass: HomeAssistant):
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    hass.data[DATA_AVAILABILITY]._started = time.time() - 3600
    return entry


def _device(hass: HomeAssistant, name: str, domain: str = "test", **kwargs: Any) -> dr.DeviceEntry:
    source = MockConfigEntry(domain=domain, title=f"{name} Eintrag")
    source.add_to_hass(hass)
    return dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={(domain, name)}, name=name, **kwargs)


def _entity(hass: HomeAssistant, device: dr.DeviceEntry, domain: str, key: str, state: str, **kwargs: Any) -> str:
    entry = er.async_get(hass).async_get_or_create(domain, "test", f"{device.id}-{key}", device_id=device.id, **kwargs)
    hass.states.async_set(entry.entity_id, state)
    return entry.entity_id


async def _ws(client, msg_id: int, **msg: Any) -> dict[str, Any]:
    await client.send_json({"id": msg_id, **msg})
    return await client.receive_json()


async def test_overrides_listed_and_reset(hass: HomeAssistant, setup, hass_ws_client) -> None:
    ar.async_get(hass).async_create("Bad")
    bad = _device(hass, "Thermostat", domain="zha", suggested_area="Bad")
    _entity(hass, bad, "sensor", "bat", "40", original_device_class="battery")
    keller = _device(hass, "Wassersensor", domain="hidden_integration")
    _entity(hass, keller, "sensor", "bat", "10", original_device_class="battery")
    lampe = _device(hass, "Lampe")
    _entity(hass, lampe, "light", "l", "on")
    client = await hass_ws_client(hass)
    n = 1
    for payload in (
        {"device_id": bad.id, "battery": 30},
        {"device_id": keller.id, "battery": "off"},
        {"device_id": lampe.id, "notify": False},
        {"device_id": bad.id, "notify": False},
    ):
        assert (await _ws(client, n, type=f"{DOMAIN}/set_device_settings", **payload))["success"]
        n += 1
    # Wassersensor ausgeblendet: Wert bleibt gespeichert, Übersicht zeigt ihn
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    hass.config_entries.async_update_entry(entry, options={**entry.options, "exclude_integrations": ["hidden_integration"]})
    await hass.async_block_till_done()
    result = (await _ws(client, n, type=f"{DOMAIN}/get_options"))["result"]
    n += 1
    over = result["overrides"]
    assert [(i["name"], i["value"], i["hidden"]) for i in over["battery"]] == [("Thermostat", 30, False), ("Wassersensor", "off", True)]
    assert over["battery"][0]["area"] == "Bad"
    assert over["battery"][0]["integration"] == "Zigbee Home Automation"
    assert [i["name"] for i in over["notify"]] == ["Lampe", "Thermostat"]
    # Zurücksetzen: nur die genannten, unbekannte zählen nicht
    res = await _ws(client, n, type=f"{DOMAIN}/reset_device_settings", battery=[bad.id, "gibtsnicht"], notify=[lampe.id])
    n += 1
    assert res["result"] == {"battery": 1, "notify": 1, "connection": 0, "signal": 0, "offline": 0}
    over = (await _ws(client, n, type=f"{DOMAIN}/get_options"))["result"]["overrides"]
    n += 1
    assert [i["name"] for i in over["battery"]] == ["Wassersensor"]
    assert [i["name"] for i in over["notify"]] == ["Thermostat"]
    # Leere Anfrage: nichts zu tun
    assert (await _ws(client, n, type=f"{DOMAIN}/reset_device_settings"))["result"] == {"battery": 0, "notify": 0, "connection": 0, "signal": 0, "offline": 0}


async def test_deleted_device_kept_but_not_listed(hass: HomeAssistant, setup, hass_ws_client, hass_storage: dict[str, Any]) -> None:
    gone = _device(hass, "Weg")
    client = await hass_ws_client(hass)
    assert (await _ws(client, 1, type=f"{DOMAIN}/set_device_settings", device_id=gone.id, notify=False))["success"]
    dr.async_get(hass).async_remove_device(gone.id)
    await hass.async_block_till_done()
    assert (await _ws(client, 2, type=f"{DOMAIN}/get_options"))["result"]["overrides"] == {"battery": [], "notify": [], "connection": [], "signal": [], "offline": []}
    # Gespeichert bleibt er: HA stellt das Gerät mit derselben ID wieder her
    from custom_components.device_panel.devices import device_settings  # noqa: PLC0415

    assert gone.id in device_settings(hass)["notify_off"]


async def test_reset_battery_runs_warning(hass: HomeAssistant, setup, hass_ws_client) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    dev = _device(hass, "Fenster")
    _entity(hass, dev, "sensor", "bat", "10", original_device_class="battery")
    client = await hass_ws_client(hass)
    assert (await _ws(client, 1, type=f"{DOMAIN}/set_device_settings", device_id=dev.id, battery="off"))["success"]
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    hass.config_entries.async_update_entry(entry, options={**entry.options, "battery_push": True, "notify_service": "notify.handy"})
    await hass.async_block_till_done()
    assert calls == []  # Warnung für das Gerät aus
    res = await _ws(client, 2, type=f"{DOMAIN}/reset_device_settings", battery=[dev.id])
    assert res["result"]["battery"] == 1
    await hass.async_block_till_done()
    # Zurück auf den globalen Wert: die Warnung kommt sofort
    assert [c.data["title"] for c in calls] == ["Low battery: Fenster"]
    # Keine Liste: abgelehnt
    assert (await _ws(client, 3, type=f"{DOMAIN}/reset_device_settings", battery=["x"], notify="kein"))["error"]["code"] == "invalid_format"


async def test_connection_by_hand(hass: HomeAssistant, setup, hass_ws_client, hass_storage: dict[str, Any]) -> None:
    dev = _device(hass, "Glücksklee", domain="plant_test")
    _entity(hass, dev, "sensor", "moist", "40")
    client = await hass_ws_client(hass)

    async def listed() -> dict[str, Any]:
        await client.send_json({"id": next(ids), "type": f"{DOMAIN}/list_devices"})
        return next(d for d in (await client.receive_json())["result"]["devices"] if d["id"] == dev.id)

    ids = iter(range(1, 100))
    before = await listed()
    assert (before["connection"], before["connection_auto"], before["connection_manual"]) == (None, None, False)
    # Von Hand: Vorrang, Erkennung bleibt sichtbar, gespeichert
    res = await _ws(client, next(ids), type=f"{DOMAIN}/set_device_connection", device_id=dev.id, connection="ble")
    assert res["result"] == {"connection": "ble"}
    after = await listed()
    assert (after["connection"], after["connection_auto"], after["connection_manual"]) == ("ble", None, True)
    await hass.async_block_till_done()
    assert hass_storage[f"{DOMAIN}.devices"]["data"]["connections"] == {dev.id: "ble"}
    # "Unbekannt" ist keine Wahl, unbekannte Art und Gerät abgelehnt
    for payload, code in (({"connection": "unknown"}, "invalid_format"), ({"connection": "funk"}, "invalid_format")):
        assert (await _ws(client, next(ids), type=f"{DOMAIN}/set_device_connection", device_id=dev.id, **payload))["error"]["code"] == code
    assert (await _ws(client, next(ids), type=f"{DOMAIN}/set_device_connection", device_id="weg", connection="ble"))["error"]["code"] == "not_found"
    # Eigene Einstellung (seit 0.17.0): in der Übersicht, gesammelt zurücksetzbar
    over = (await _ws(client, next(ids), type=f"{DOMAIN}/get_options"))["result"]["overrides"]["connection"]
    assert [(i["name"], i["value"]) for i in over] == [("Glücksklee", "ble")]
    res = await _ws(client, next(ids), type=f"{DOMAIN}/reset_device_settings", connection=[dev.id, "gibtsnicht"])
    assert res["result"] == {"battery": 0, "notify": 0, "connection": 1, "signal": 0, "offline": 0}
    assert (await listed())["connection_manual"] is False
    await hass.async_block_till_done()
    assert hass_storage[f"{DOMAIN}.devices"]["data"]["connections"] == {}
    # Wieder von Hand, dann zurück auf die Erkennung über das Popup
    assert (await _ws(client, next(ids), type=f"{DOMAIN}/set_device_connection", device_id=dev.id, connection="ble"))["success"]
    assert (await _ws(client, next(ids), type=f"{DOMAIN}/set_device_connection", device_id=dev.id, connection=None))["success"]
    back = await listed()
    assert (back["connection"], back["connection_manual"]) == (None, False)


async def test_connection_per_integration(hass: HomeAssistant, setup, hass_ws_client) -> None:
    # Zwei Geräte derselben Integration: eines unbekannt, eines als WLAN erkannt
    plain = _device(hass, "Glücksklee", domain="plant_test")
    _entity(hass, plain, "sensor", "moist", "40")
    wifi = _device(hass, "Giesskanne", domain="plant_test", connections={(dr.CONNECTION_NETWORK_MAC, "aa:bb:cc:dd:ee:02")})
    _entity(hass, wifi, "sensor", "rssi", "-60", original_device_class="signal_strength", unit_of_measurement="dBm")
    hass.states.async_set(er.async_get(hass).async_get_entity_id("sensor", "test", f"{wifi.id}-rssi"), "-60", {"unit_of_measurement": "dBm"})
    client = await hass_ws_client(hass)
    ids = iter(range(1, 100))

    async def listed() -> dict[str, tuple]:
        await client.send_json({"id": next(ids), "type": f"{DOMAIN}/list_devices"})
        devs = (await client.receive_json())["result"]["devices"]
        return {d["name"]: (d["connection"], d["connection_auto"], d["connection_integration"], d["connection_manual"]) for d in devs if d["id"] in (plain.id, wifi.id)}

    assert await listed() == {"Glücksklee": (None, None, None, False), "Giesskanne": ("wifi", "wifi", None, False)}
    # Pro Integration: gilt für alle ihre Geräte, auch die richtig erkannten (Variante B)
    assert (await _ws(client, next(ids), type=f"{DOMAIN}/set_options", values={"connection_integrations": {"plant_test": "zigbee"}}))["success"]
    assert await listed() == {"Glücksklee": ("zigbee", None, "zigbee", False), "Giesskanne": ("zigbee", "wifi", "zigbee", False)}
    # Von Hand am Gerät geht vor
    assert (await _ws(client, next(ids), type=f"{DOMAIN}/set_device_connection", device_id=plain.id, connection="ble"))["success"]
    assert (await listed())["Glücksklee"] == ("ble", None, "zigbee", True)
    # Ungültig: "unbekannt", fremde Art, schlechte Domain
    for bad in ({"plant_test": "unknown"}, {"plant_test": "funk"}, {"Böse Domain": "zigbee"}, ["plant_test"]):
        assert (await _ws(client, next(ids), type=f"{DOMAIN}/set_options", values={"connection_integrations": bad}))["error"]["code"] == "invalid_format", bad
    # Zurück auf die Erkennung
    assert (await _ws(client, next(ids), type=f"{DOMAIN}/set_options", values={"connection_integrations": {}}))["success"]
    assert (await listed())["Giesskanne"] == ("wifi", "wifi", None, False)


async def test_signal_setting(hass: HomeAssistant, setup, hass_ws_client, hass_storage: dict[str, Any]) -> None:
    """Empfang-Warnung pro Gerät (0.21.0, Mockup signal-v1 A): aus oder eigene Schwelle."""
    sensor = _device(hass, "Präsenzsensor")
    _entity(hass, sensor, "sensor", "rssi", "-88", original_device_class="signal_strength", unit_of_measurement="dBm")
    zig = _device(hass, "Kontakt", domain="zha")
    _entity(hass, zig, "binary_sensor", "c", "off")
    client = await hass_ws_client(hass)
    ids = iter(range(1, 100))

    async def setting(dev: str) -> Any:
        devs = (await _ws(client, next(ids), type=f"{DOMAIN}/list_devices"))["result"]["devices"]
        return next(d for d in devs if d["id"] == dev)["signal_setting"]

    assert await setting(sensor.id) is None
    # dBm (negativ) und LQI (positiv), "off"
    for value in (-93, 50, "off"):
        assert (await _ws(client, next(ids), type=f"{DOMAIN}/set_device_settings", device_id=sensor.id, signal=value))["success"]
        assert await setting(sensor.id) == value
    assert hass_storage[f"{DOMAIN}.devices"]["data"]["signal"] == {sensor.id: "off"}
    # Ausserhalb der Bereiche abgelehnt
    for bad in (-120, -30, 0, 201, "aus", True):
        res = await _ws(client, next(ids), type=f"{DOMAIN}/set_device_settings", device_id=sensor.id, signal=bad)
        assert res["error"]["code"] == "invalid_format", bad
    assert (await _ws(client, next(ids), type=f"{DOMAIN}/set_device_settings", device_id=zig.id, signal=40))["success"]
    over = (await _ws(client, next(ids), type=f"{DOMAIN}/get_options"))["result"]["overrides"]["signal"]
    assert [(i["name"], i["value"]) for i in over] == [("Kontakt", 40), ("Präsenzsensor", "off")]
    # Zurücksetzen einzeln und im Popup (None)
    res = await _ws(client, next(ids), type=f"{DOMAIN}/reset_device_settings", signal=[zig.id, "gibtsnicht"])
    assert res["result"] == {"battery": 0, "notify": 0, "connection": 0, "signal": 1, "offline": 0}
    assert await setting(zig.id) is None
    assert (await _ws(client, next(ids), type=f"{DOMAIN}/set_device_settings", device_id=sensor.id, signal=None))["success"]
    assert await setting(sensor.id) is None
    # Ohne Eintrag kein Schlüssel in der Datei (wie "notify_mute")
    assert "signal" not in hass_storage[f"{DOMAIN}.devices"]["data"]


async def test_signal_setting_loaded(hass: HomeAssistant, hass_storage: dict[str, Any]) -> None:
    """Gespeicherte Empfang-Warnung wird geladen, Ungültiges fällt weg."""
    from custom_components.device_panel.devices import device_settings  # noqa: PLC0415

    hass_storage[f"{DOMAIN}.devices"] = {
        "version": 1, "key": f"{DOMAIN}.devices",
        "data": {"types": {}, "battery": {}, "notify_off": [], "connections": {}, "signal": {"a": -95, "b": "off", "c": 0, "d": "x", "e": 120}},
    }
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert device_settings(hass)["signal"] == {"a": -95, "b": "off", "e": 120}
