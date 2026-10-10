"""Batterie-Warnung: Push (einmal, Hysterese, Sammelmeldung), anhaltende Benachrichtigung, Push-Ziele."""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.components import persistent_notification
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.device_panel.battery import BatteryWatch
from custom_components.device_panel.const import DATA_AVAILABILITY, DATA_BATTERY, DOMAIN, PERSISTENT_BATTERY_ID
from custom_components.device_panel.devices import async_list_devices
from custom_components.device_panel.options_api import notify_targets


@pytest.fixture
async def watch(hass: HomeAssistant) -> BatteryWatch:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return hass.data[DATA_BATTERY]


def _device(hass: HomeAssistant, name: str, **kwargs: Any) -> dr.DeviceEntry:
    source = MockConfigEntry(domain="test", title=f"{name} Eintrag")
    source.add_to_hass(hass)
    return dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={("test", name)}, name=name, **kwargs)


def _battery(hass: HomeAssistant, device: dr.DeviceEntry, state: str, domain: str = "sensor") -> str:
    entry = er.async_get(hass).async_get_or_create(domain, "test", f"{device.id}-bat", device_id=device.id, original_device_class="battery")
    hass.states.async_set(entry.entity_id, state)
    return entry.entity_id


async def _options(hass: HomeAssistant, **values: Any) -> None:
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    hass.config_entries.async_update_entry(entry, options={**entry.options, **values})
    await hass.async_block_till_done()


def _persistent(hass: HomeAssistant) -> dict | None:
    return persistent_notification._async_get_or_create_notifications(hass).get(PERSISTENT_BATTERY_ID)


async def test_push_once_rearm_and_persistent(hass: HomeAssistant, watch: BatteryWatch) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    dev = _device(hass, "Sensor Keller")
    bat = _battery(hass, dev, "50")
    await _options(hass, battery_push=True, battery_persistent=True, notify_service="notify.handy")
    await watch.async_check()
    assert calls == [] and _persistent(hass) is None

    hass.states.async_set(bat, "10")
    await watch.async_check()
    assert len(calls) == 1
    assert calls[0].data["title"] == "Low battery: Sensor Keller"
    assert calls[0].data["message"] == "10 %"
    assert calls[0].data["data"]["url"] == f"/device-panel?device={dev.id}"
    assert calls[0].data["data"]["clickAction"] == f"/device-panel?device={dev.id}"
    assert calls[0].data["data"]["tag"] == f"{DOMAIN}_battery_{dev.id}"
    note = _persistent(hass)
    assert note is not None and "Sensor Keller" in note["message"] and "(up to 15 %)" in note["message"]

    await watch.async_check()
    assert len(calls) == 1  # einmal pro Gerät
    # 18 % liegt in der Hysterese (15 + 5): weiter schwach, keine neue Meldung
    hass.states.async_set(bat, "18")
    await watch.async_check()
    assert len(calls) == 1 and dev.id in watch.low and "18 %" in _persistent(hass)["message"]
    # Neue Batterie: nicht mehr schwach, Benachrichtigung verschwindet
    hass.states.async_set(bat, "100")
    await watch.async_check()
    assert watch.low == {} and _persistent(hass) is None
    # Wieder schwach: neue Meldung
    hass.states.async_set(bat, "12")
    await watch.async_check()
    assert len(calls) == 2


async def test_unavailable_keeps_state(hass: HomeAssistant, watch: BatteryWatch) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, battery_push=True, notify_service="notify.handy")
    dev = _device(hass, "Fenster")
    bat = _battery(hass, dev, "8")
    await watch.async_check()
    assert len(calls) == 1
    # Kurz nicht erreichbar: kein Zurücksetzen, die Rückkehr meldet nicht erneut
    hass.states.async_set(bat, "unavailable")
    await watch.async_check()
    assert dev.id in watch.low
    hass.states.async_set(bat, "7")
    await watch.async_check()
    assert len(calls) == 1


async def test_many_at_once_one_push(hass: HomeAssistant, watch: BatteryWatch) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, battery_push=True, notify_service="notify.handy")
    for i in range(5):
        _battery(hass, _device(hass, f"Gerät {i}"), str(5 + i))
    await watch.async_check()
    assert len(calls) == 1
    assert calls[0].data["title"] == "Low battery: 5 devices"
    assert calls[0].data["message"].startswith("Gerät 0 5 %, Gerät 1 6 %")
    assert calls[0].data["data"]["url"] == "/device-panel"


async def test_binary_sensor_and_click_target(hass: HomeAssistant, watch: BatteryWatch) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, battery_push=True, notify_service="notify.handy", notify_click_target="device")
    dev = _device(hass, "Rauchmelder")
    _battery(hass, dev, "on", domain="binary_sensor")
    await watch.async_check()
    assert calls[0].data["message"] == "low"
    assert calls[0].data["data"]["url"] == f"/config/devices/device/{dev.id}"


async def test_dismissed_stays_away_until_new_device(hass: HomeAssistant, watch: BatteryWatch) -> None:
    await _options(hass, battery_persistent=True)
    _battery(hass, _device(hass, "A"), "10")
    await watch.async_check()
    assert _persistent(hass) is not None
    persistent_notification.async_dismiss(hass, PERSISTENT_BATTERY_ID)
    await watch.async_check()
    assert _persistent(hass) is None  # weggeklickt: Ruhe
    _battery(hass, _device(hass, "B"), "9")
    await watch.async_check()
    note = _persistent(hass)
    assert note is not None and "[A]" in note["message"] and "[B]" in note["message"]


async def test_switching_push_on_reports_current(hass: HomeAssistant, watch: BatteryWatch, hass_ws_client) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    _battery(hass, _device(hass, "A"), "10")
    await watch.async_check()
    assert calls == [] and watch.low  # ohne Push: still, aber gemerkt
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_options", "values": {"battery_push": True, "notify_service": "notify.handy"}})
    assert (await client.receive_json())["result"] == {"changed": True}
    await hass.async_block_till_done()
    assert len(calls) == 1  # eingeschaltet: die aktuell schwachen einmal melden
    await watch.async_check()
    assert len(calls) == 1


async def test_restart_does_not_repeat(hass: HomeAssistant, hass_storage: dict[str, Any]) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    dev = _device(hass, "A")
    _battery(hass, dev, "10")
    hass_storage[f"{DOMAIN}.battery"] = {"version": 1, "minor_version": 1, "key": f"{DOMAIN}.battery", "data": {"low": {dev.id: {"name": "A", "level": 11, "area": None}}}}
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options={"battery_push": True, "notify_service": "notify.handy", "battery_persistent": True})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    await hass.data[DATA_BATTERY].async_check()
    assert calls == []
    # Die anhaltende Benachrichtigung lebt nicht über den Neustart: neu aufbauen.
    assert _persistent(hass) is not None


async def test_threshold_in_list(hass: HomeAssistant, watch: BatteryWatch) -> None:
    _battery(hass, _device(hass, "A"), "25")
    log = hass.data[DATA_AVAILABILITY]
    assert (await async_list_devices(hass, log))["devices"][0]["battery"] == {"level": 25, "low": False}
    await _options(hass, battery_low=30)
    result = await async_list_devices(hass, log)
    assert result["devices"][0]["battery"]["low"] is True and result["battery_low"] == 30


async def test_notify_targets_and_entity_push(hass: HomeAssistant, watch: BatteryWatch) -> None:
    async_mock_service(hass, "notify", "handy")
    async_mock_service(hass, "notify", "persistent_notification")
    sent = async_mock_service(hass, "notify", "send_message")
    hass.states.async_set("notify.fernseher", "unknown")
    targets = notify_targets(hass, "notify.alt")
    assert targets == [
        {"value": "none", "kind": "none"},
        {"value": "notify.handy", "kind": "service"},
        {"value": "notify.fernseher", "kind": "entity"},
        {"value": "notify.alt", "kind": "missing"},
    ]
    await _options(hass, battery_push=True, notify_service="notify.fernseher")
    _battery(hass, _device(hass, "A"), "3")
    await watch.async_check()
    # Entität: nur Titel und Text über send_message
    assert len(sent) == 1 and sent[0].data == {"title": "Low battery: A", "message": "3 %", "entity_id": "notify.fernseher"}


async def test_target_rejecting_data_gets_plain_message(hass: HomeAssistant, watch: BatteryWatch) -> None:
    received: list[dict] = []

    async def handler(call: ServiceCall) -> None:
        if "data" in call.data:
            raise ValueError("extra keys not allowed")
        received.append(dict(call.data))

    hass.services.async_register("notify", "mail", handler)
    await _options(hass, battery_push=True, notify_service="notify.mail")
    _battery(hass, _device(hass, "A"), "3")
    await watch.async_check()
    assert received == [{"title": "Low battery: A", "message": "3 %"}]


async def test_push_options_are_checked(hass: HomeAssistant, watch: BatteryWatch, hass_ws_client) -> None:
    client = await hass_ws_client(hass)
    for i, values in enumerate(({"notify_service": "light.kueche"}, {"notify_service": 5}, {"notify_click_target": "irgendwo"}, {"battery_low": 51}), 1):
        await client.send_json({"id": i, "type": f"{DOMAIN}/set_options", "values": values})
        assert (await client.receive_json())["error"]["code"] == "invalid_format", values
    await client.send_json({"id": 9, "type": f"{DOMAIN}/get_options"})
    result = (await client.receive_json())["result"]
    assert result["values"]["notify_service"] == "none" and result["values"]["notify_click_target"] == "panel"
    assert result["notify_targets"][0] == {"value": "none", "kind": "none"}
    assert result["limits"]["battery_low"] == [1, 50]


async def test_threshold_per_integration(hass: HomeAssistant, watch: BatteryWatch, hass_ws_client) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    dev = _device(hass, "Fenster")  # Integration "test"
    _battery(hass, dev, "25")
    log = hass.data[DATA_AVAILABILITY]
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/get_options"})
    battery_list = (await client.receive_json())["result"]["catalog"]["battery"]
    # Nur Integrationen mit Batteriegeräten, mit Zahl und schwächster Batterie
    assert battery_list == [{"domain": "test", "name": "test", "devices": 1, "weakest": 25}]

    await client.send_json({"id": 2, "type": f"{DOMAIN}/set_options", "values": {
        "battery_push": True, "battery_persistent": True, "notify_service": "notify.handy",
        "battery_low_integrations": {"test": 30, "zha": 20},
    }})
    assert (await client.receive_json())["result"] == {"changed": True}
    await hass.async_block_till_done()
    # 25 % liegt unter der eigenen Schwelle 30 %, nicht unter der allgemeinen 15 %
    assert (await async_list_devices(hass, log))["devices"][0]["battery"]["low"] is True
    assert len(calls) == 1 and calls[0].data["title"] == "Low battery: Fenster"
    assert "(threshold per integration or device)" in _persistent(hass)["message"]
    # Eigene Schwelle ohne Geräte bleibt in der Liste (zum Zurücksetzen)
    await client.send_json({"id": 3, "type": f"{DOMAIN}/get_options"})
    domains = {b["domain"]: b["devices"] for b in (await client.receive_json())["result"]["catalog"]["battery"]}
    assert domains == {"test": 1, "zha": 0}
    # Wiederscharf nach der eigenen Schwelle: 33 % (30 + 5 - 2) bleibt schwach
    hass.states.async_set(next(iter(e.entity_id for e in er.async_entries_for_device(er.async_get(hass), dev.id))), "33")
    await watch.async_check()
    assert dev.id in watch.low


async def test_warning_off_per_integration(hass: HomeAssistant, watch: BatteryWatch, hass_ws_client) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    window = _device(hass, "Fenster")  # Integration "test"
    _battery(hass, window, "5")
    smoke = _device(hass, "Rauchmelder")
    _battery(hass, smoke, "25")
    log = hass.data[DATA_AVAILABILITY]
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_options", "values": {
        "battery_push": True, "battery_persistent": True, "notify_service": "notify.handy",
        "battery_low_integrations": {"test": "off"},
    }})
    assert (await client.receive_json())["result"] == {"changed": True}
    await hass.async_block_till_done()
    devices = {d["name"]: d for d in (await async_list_devices(hass, log))["devices"]}
    # Warnung für die Integration aus: Stand sichtbar, nie "schwach", keine Meldung
    assert devices["Fenster"]["battery"] == {"level": 5, "low": False}
    assert devices["Fenster"]["battery_default"] == {"pct": "off", "integration": "test", "push": True, "push_integration": None}
    assert calls == [] and _persistent(hass) is None
    # Eigene Schwelle des Geräts geht vor: Rauchmelder warnt ab 30 %
    await client.send_json({"id": 2, "type": f"{DOMAIN}/set_device_settings", "device_id": smoke.id, "battery": 30})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    await watch.async_check()
    assert [c.data["title"] for c in calls] == ["Low battery: Rauchmelder"]
    assert set(watch.low) == {smoke.id}
    # Gespeichert wie im Panel, auch "OFF" und False (YAML 1.1) als off
    await client.send_json({"id": 3, "type": f"{DOMAIN}/set_options", "values": {"battery_low_integrations": {"test": "OFF", "zha": False, "hue": 20}}})
    assert (await client.receive_json())["success"]
    await client.send_json({"id": 4, "type": f"{DOMAIN}/get_options"})
    assert (await client.receive_json())["result"]["values"]["battery_low_integrations"] == {"hue": 20, "test": "off", "zha": "off"}


async def test_battery_map_is_checked(hass: HomeAssistant, watch: BatteryWatch, hass_ws_client) -> None:
    client = await hass_ws_client(hass)
    bad = ({"zha": 60}, {"zha": 0}, {"zha": True}, {"Böse Domain": 20}, {"zha": "20"}, {"zha": "aus"}, {"Böse Domain": "off"}, ["zha"])
    for i, value in enumerate(bad, 1):
        await client.send_json({"id": i, "type": f"{DOMAIN}/set_options", "values": {"battery_low_integrations": value}})
        assert (await client.receive_json())["error"]["code"] == "invalid_format", value
    # Ab 1 Prozent erlaubt (seit 1.41.0): niemand wird bevormundet
    await client.send_json({"id": 19, "type": f"{DOMAIN}/set_options", "values": {"battery_low_integrations": {"zha": 1}}})
    assert (await client.receive_json())["success"] is True
    await client.send_json({"id": 20, "type": f"{DOMAIN}/set_options", "values": {"battery_low_integrations": {}}})
    assert (await client.receive_json())["result"]["changed"] is True


async def test_push_off_per_integration(hass: HomeAssistant, watch: BatteryWatch, hass_ws_client) -> None:
    """Seit 0.34.0: Push pro Integration aus; schwach im Panel und anhaltende Benachrichtigung bleiben."""
    calls = async_mock_service(hass, "notify", "handy")
    window = _device(hass, "Fenster")  # Integration "test"
    _battery(hass, window, "5")
    log = hass.data[DATA_AVAILABILITY]
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_options", "values": {
        "battery_push": True, "battery_persistent": True, "notify_service": "notify.handy",
        "battery_push_exclude_integrations": ["test"],
    }})
    assert (await client.receive_json())["result"] == {"changed": True}
    await hass.async_block_till_done()
    await watch.async_check()
    devices = {d["name"]: d for d in (await async_list_devices(hass, log))["devices"]}
    assert devices["Fenster"]["battery"] == {"level": 5, "low": True}
    assert devices["Fenster"]["battery_default"] == {"pct": 15, "integration": None, "push": False, "push_integration": "test"}
    assert calls == [] and window.id in watch.low
    assert "Fenster" in _persistent(hass)["message"]
    # Tagesmeldung: ebenfalls ohne die Integration
    await _options(hass, battery_push_mode="daily", battery_push_daily="all")
    await watch._async_daily()
    assert calls == []
    # Wieder eingeschaltet: das schwache Gerät kommt mit der nächsten Meldung
    await client.send_json({"id": 2, "type": f"{DOMAIN}/set_options", "values": {"battery_push_exclude_integrations": []}})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    await watch._async_daily()
    assert [c.data["title"] for c in calls] == ["Low battery: Fenster"]
    # Keine Domain-Liste: abgelehnt
    await client.send_json({"id": 3, "type": f"{DOMAIN}/set_options", "values": {"battery_push_exclude_integrations": ["Böse Domain"]}})
    assert (await client.receive_json())["error"]["code"] == "invalid_format"


async def test_battery_fields(hass: HomeAssistant, watch: BatteryWatch, hass_ws_client) -> None:
    """Seit 0.34.0: Inhalt der Batterie-Meldung wählbar, feste Reihenfolge; Sammelmeldung mit Klammern."""
    from homeassistant.helpers import area_registry as ar  # noqa: PLC0415

    calls = async_mock_service(hass, "notify", "handy")
    area = ar.async_get(hass).async_create("Flur")
    smoke = _device(hass, "Rauchmelder", manufacturer="Beispiel AG", model="Modell X")
    dr.async_get(hass).async_update_device(smoke.id, area_id=area.id)
    bat = _battery(hass, smoke, "50")
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/get_options"})
    assert (await client.receive_json())["result"]["values"]["battery_fields"] == ["battery", "area"]
    await client.send_json({"id": 2, "type": f"{DOMAIN}/set_options", "values": {
        "battery_push": True, "notify_service": "notify.handy", "battery_fields": ["model", "battery", "integration"],
    }})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    hass.states.async_set(bat, "8")
    await watch.async_check()
    # Feste Reihenfolge (Stand, Integration, Modell), nicht die gewählte.
    assert calls[-1].data["title"] == "Low battery: Rauchmelder"
    assert calls[-1].data["message"] == "8 % · test · Beispiel AG Modell X"
    # Standard (Stand, Bereich): wie vor 0.34.0
    await _options(hass, battery_fields=["battery", "area"])
    hass.states.async_set(bat, "100")
    await watch.async_check()
    hass.states.async_set(bat, "7")
    await watch.async_check()
    assert calls[-1].data["message"] == "7 % · Flur"
    # Nichts gewählt: der Stand, damit die Meldung nicht leer ist
    await _options(hass, battery_fields=[])
    hass.states.async_set(bat, "100")
    await watch.async_check()
    hass.states.async_set(bat, "6")
    await watch.async_check()
    assert calls[-1].data["message"] == "6 %"
    # Sammelmeldung: Name und Stand, die übrigen Angaben in Klammern
    await _options(hass, battery_fields=["battery", "area"], battery_push_mode="daily", battery_push_daily="all")
    other = _device(hass, "Fenster")
    _battery(hass, other, "5")
    await watch.async_check()
    await watch._async_daily()
    assert calls[-1].data["title"] == "Low battery: 2 devices"
    assert calls[-1].data["message"] == "Fenster 5 %, Rauchmelder 6 % (Flur)"
    # Unbekannte Angabe: abgelehnt
    await client.send_json({"id": 3, "type": f"{DOMAIN}/set_options", "values": {"battery_fields": ["since"]}})
    assert (await client.receive_json())["error"]["code"] == "invalid_format"


async def test_new_low_is_logged_with_reason(hass: HomeAssistant, watch: BatteryWatch) -> None:
    """Protokoll (1.38.0): neu schwach, und warum keine Meldung kam (Batterie-Push aus)."""
    from custom_components.device_panel import activity  # noqa: PLC0415

    dev = _device(hass, "Sensor Keller")
    bat = _battery(hass, dev, "50")
    await _options(hass, battery_push=False, notify_service="notify.handy")
    await watch.async_check()
    hass.states.async_set(bat, "10")
    await watch.async_check()
    texts = [e["text"] for e in activity.snapshot(hass)["entries"] if e["cat"] == "battery" and e["title"] == "Sensor Keller"]
    assert texts == ["battery 10 % below the threshold: newly low", "battery push is off: no notification"]
