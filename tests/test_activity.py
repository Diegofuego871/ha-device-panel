"""Protokoll (1.38.0): Ringspeicher, Debug-Schalter, Einträge der Meldungen (auch "warum nicht"), WS-Befehle (nur Admin)."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.device_panel import activity
from custom_components.device_panel.const import DOMAIN


async def _setup(hass: HomeAssistant, **options: Any) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN, title="Device Panel",
        options={"notify_service": "notify.handy", "notify_charge": True, "charge_integrations": ["test"], **options},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def _device(hass: HomeAssistant, name: str, level: int = 50) -> tuple[dr.DeviceEntry, str]:
    source = next((e for e in hass.config_entries.async_entries("test") if e.title == "test Eintrag"), None)
    if source is None:
        source = MockConfigEntry(domain="test", title="test Eintrag")
        source.add_to_hass(hass)
    device = dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={("test", name)}, name=name)
    entity = er.async_get(hass).async_get_or_create("sensor", "test", f"{name}-bat", device_id=device.id, original_device_class="battery")
    hass.states.async_set(entity.entity_id, str(level), {"device_class": "battery", "unit_of_measurement": "%"})
    return device, entity.entity_id


def _bat(hass: HomeAssistant, entity: str, level: int) -> None:
    hass.states.async_set(entity, str(level), {"device_class": "battery", "unit_of_measurement": "%"})


async def test_record_ring_and_debug_switch(hass: HomeAssistant) -> None:
    activity.record(hass, "debug", "charge", "charge_level", "A", level=50, low=40, full=100, rise=20)
    assert activity.snapshot(hass)["entries"] == []  # Debug nur bei eingeschaltetem Schalter
    activity.set_debug(hass, True)
    activity.record(hass, "debug", "charge", "charge_level", "A", "dev1", level=50, low=40, full=100, rise=20)
    entry = activity.snapshot(hass)["entries"][0]
    assert entry["level"] == "debug" and entry["cat"] == "charge" and entry["title"] == "A" and entry["device_id"] == "dev1"
    assert entry["text"] == "level 50 %, low point 40 %, full from 100 %, rise 20 points"  # Instanz auf Englisch
    for i in range(activity.MAX_ENTRIES + 20):
        activity.record(hass, "info", "system", "sys_start", str(i), version="1")
    snap = activity.snapshot(hass)
    assert len(snap["entries"]) == activity.MAX_ENTRIES and snap["entries"][-1]["title"] == str(activity.MAX_ENTRIES + 19)
    activity.clear(hass)
    assert activity.snapshot(hass)["entries"] == [] and activity.snapshot(hass)["debug"] is True


async def test_german_texts(hass: HomeAssistant) -> None:
    hass.config.language = "de"
    activity.record(hass, "info", "charge", "charge_full_off", "Handy", level=100, full=100)
    assert activity.snapshot(hass)["entries"][0]["text"].startswith("voll geladen bei 100 %")


async def test_charge_decisions_are_logged(hass: HomeAssistant) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    on, on_entity = _device(hass, "Zahnbürste", 30)
    off, off_entity = _device(hass, "Wegwerf", 30)
    await _setup(hass)
    from custom_components.device_panel.devices import async_set_device_settings  # noqa: PLC0415

    await async_set_device_settings(hass, off.id, charge=False)
    activity.set_debug(hass, True)
    for level in (50, 100):
        _bat(hass, on_entity, level)
        _bat(hass, off_entity, level)
        await hass.async_block_till_done()
    entries = activity.snapshot(hass)["entries"]
    texts = {e["title"]: [x["text"] for x in entries if x["title"] == e["title"]] for e in entries}
    assert any(t.startswith("charging: level 50 %") for t in texts["Zahnbürste"])
    assert any(t.startswith("fully charged at 100 % (full from 100 %), sending") for t in texts["Zahnbürste"])
    assert any("charging notification is off for this device" in t for t in texts["Wegwerf"])
    assert any(e["level"] == "debug" and e["title"] == "Zahnbürste" for e in entries)
    assert any(e["cat"] == "push" and e["title"] == "notify.handy" and e["text"] == "sent: 🔋 Charged: Zahnbürste" for e in entries)
    assert len(calls) == 1


async def test_no_target_and_missing_target_are_logged(hass: HomeAssistant) -> None:
    from custom_components.device_panel import push  # noqa: PLC0415

    # Ziel existiert nicht: Eintrag mit Stufe "error"
    assert not await push.async_push(hass, "notify.gibtsnicht", "Titel", "Text")
    entry = activity.snapshot(hass)["entries"][-1]
    assert entry["level"] == "error" and entry["cat"] == "push" and "does not exist" in entry["text"]
    assert not await push.async_push(hass, "keinnotify", "Titel", "Text")
    assert activity.snapshot(hass)["entries"][-1]["text"].startswith("invalid push target")
    # Voll geladen, aber kein Push-Ziel: Warnung statt Stille
    _device(hass, "Zahnbürste", 30)
    await _setup(hass, notify_service="none")
    entity = next(s.entity_id for s in hass.states.async_all("sensor"))
    for level in (50, 100):
        _bat(hass, entity, level)
        await hass.async_block_till_done()
    last = [e for e in activity.snapshot(hass)["entries"] if e["cat"] == "charge"][-1]
    assert last["level"] == "warning" and last["text"].startswith("fully charged at 100 %, but no push target") and last["detail"]


async def test_startup_entry_and_ws(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    first = activity.snapshot(hass)["entries"][0]
    assert first["cat"] == "system" and first["title"] == "Device Panel" and first["text"].startswith("started (version ")
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/get_log"})
    result = (await client.receive_json())["result"]
    assert result["debug"] is False and result["max"] == activity.MAX_ENTRIES and result["entries"][0]["cat"] == "system"
    await client.send_json({"id": 2, "type": f"{DOMAIN}/set_log", "debug": True})
    assert (await client.receive_json())["result"]["debug"] is True
    await client.send_json({"id": 3, "type": f"{DOMAIN}/clear_log"})
    result = (await client.receive_json())["result"]
    assert result["entries"] == [] and result["debug"] is True


async def test_ws_log_needs_admin(hass: HomeAssistant, hass_ws_client, hass_admin_user) -> None:
    from homeassistant.auth.const import GROUP_ID_USER  # noqa: PLC0415

    await _setup(hass)
    user = await hass.auth.async_create_user("Mitglied", group_ids=[GROUP_ID_USER])
    token = await hass.auth.async_create_refresh_token(user, "https://example.test")
    access = hass.auth.async_create_access_token(token)
    client = await hass_ws_client(hass, access)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/get_log"})
    response = await client.receive_json()
    assert response["success"] is False and response["error"]["code"] == "unauthorized"
