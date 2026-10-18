"""Einstellungen sichern und wiederherstellen (2.98.0): Export, Vorschau, Import, Rückgängig, fehlende Verweise."""

from __future__ import annotations

from typing import Any

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from custom_components.device_panel import backup, options_api
from custom_components.device_panel.const import DATA_DEVICE_SETTINGS, DATA_MAGIC, DATA_ROUTINES, DOMAIN

from .test_outage_notify import _device, _options, setup  # noqa: F401  (Fixture "setup")

ALL = list(backup.SECTIONS)


def _switch(hass: HomeAssistant, device: dr.DeviceEntry, key: str = "plug", state: str = "off") -> str:
    entry = er.async_get(hass).async_get_or_create("switch", "test", f"{device.id}-{key}", device_id=device.id, original_name=key)
    hass.states.async_set(entry.entity_id, state)
    return entry.entity_id


async def _ws(client, msg_id: int, **msg: Any) -> dict[str, Any]:
    await client.send_json({"id": msg_id, **msg})
    return await client.receive_json()


def _entry(hass: HomeAssistant):
    return hass.config_entries.async_entries(DOMAIN)[0]


async def test_export_roundtrip_is_all_unchanged(hass: HomeAssistant, setup) -> None:  # noqa: F811
    """Eine frische Sicherung gegen den gleichen Zustand: nichts ändert sich, nichts wird übersprungen (Schema nimmt eigene Werte an)."""
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    await hass.data[DATA_ROUTINES].async_save_routine(
        {"device_id": device.id, "entity_id": plug, "name": "Licht", "action": "on", "kind": "countdown", "delay_s": 600}
    )
    file = await backup.async_export(hass, ALL)
    assert file["format"] == backup.FORMAT and set(file["sections"]) == set(ALL)
    report = await backup.async_import(hass, file, None, dry_run=True)
    assert report["totals"]["changed"] == 0, report
    assert report["totals"]["skipped"] == 0, report
    assert report["totals"]["unchanged"] > 20
    # Optionen werden auf die Bereiche verteilt, keiner fehlt und keiner doppelt
    parts = [backup.section_keys(s) for s in ("monitor", "display", "devices", "ai", "routines")]
    assert sum(len(p) for p in parts) == len(backup._SCHEMA_KEYS) == len(set().union(*parts))


async def test_no_credentials_in_file(hass: HomeAssistant, setup) -> None:  # noqa: F811
    text = str(await backup.async_export(hass, ALL)).lower()
    for word in ("token", "password", "api_key", "secret"):
        assert word not in text


async def test_import_changes_options_and_skips_unknown(hass: HomeAssistant, setup) -> None:  # noqa: F811
    file = await backup.async_export(hass, ["monitor"])
    file["sections"]["monitor"]["options"].update(
        battery_low=22,
        notify_service="notify.mobile_app_alt",
        battery_low_integrations={"gibtsnicht": 30},
        charge_boost=True,  # gibt es nicht
        notify_group_min=99,  # ausserhalb des Bereichs
    )
    preview = await backup.async_import(hass, file, None, dry_run=True)
    rep = preview["sections"]["monitor"]
    assert _entry(hass).options.get("battery_low") is None  # Vorschau schreibt nichts
    whats = {s["what"]: s["reason"] for s in rep["skipped"]}
    assert whats["charge_boost"] == "unknown" and "notify_group_min" in whats
    assert {n["what"] for n in rep["notes"] if n["kind"] == "target"} == {"notify.mobile_app_alt"}
    assert {n["what"] for n in rep["notes"] if n["kind"] == "integration"} == {"gibtsnicht"}
    assert rep["changed"] == 3  # battery_low, notify_service, battery_low_integrations
    assert any(e["what"] == "battery_low" and e["old"] == 15 and e["new"] == 22 for e in rep["examples"])
    applied = await backup.async_import(hass, file, None, dry_run=False)
    assert applied["sections"]["monitor"]["changed"] == 3
    options = options_api.current_values(_entry(hass))
    assert options["battery_low"] == 22 and options["notify_service"] == "notify.mobile_app_alt"
    assert options["battery_low_integrations"] == {"gibtsnicht": 30}  # fehlende Integration: übernommen
    # Zweiter Import derselben Datei: nichts mehr zu tun
    again = await backup.async_import(hass, file, None, dry_run=True)
    assert again["sections"]["monitor"]["changed"] == 0


async def test_notify_delay_conflict_is_skipped(hass: HomeAssistant, setup) -> None:  # noqa: F811
    file = await backup.async_export(hass, ["monitor"])
    file["sections"]["monitor"]["options"].update(offline_after=10, notify_delay=5)  # Meldung vor dem Ausfall
    report = await backup.async_import(hass, file, None, dry_run=False)
    rep = report["sections"]["monitor"]
    assert {s["what"] for s in rep["skipped"]} >= {"offline_after", "notify_delay"}
    assert options_api.current_values(_entry(hass))["offline_after"] == 2  # unverändert


async def test_devices_import_and_replace(hass: HomeAssistant, setup) -> None:  # noqa: F811
    a, b = _device(hass, "Rauchmelder"), _device(hass, "Lampe")
    client_file: dict[str, Any]
    from custom_components.device_panel.devices import async_set_device_settings, async_set_type_override

    await async_set_device_settings(hass, a.id, battery=30, notify=False, signal=-80)
    await async_set_type_override(hass, a.id, "light")
    client_file = await backup.async_export(hass, ["devices"])
    snapshot = await backup.async_export(hass, ["devices"])
    body = client_file["sections"]["devices"]
    assert body["settings"][a.id] == {"battery": 30, "notify": False, "signal": -80}
    assert body["types"] == {a.id: "light"} and body["names"][a.id] == "Rauchmelder"
    # Wieder auf Standard, dann aus der Datei wiederherstellen; dazu ein unbekanntes Gerät und ein ungültiger Wert
    await async_set_device_settings(hass, a.id, battery=None, notify=True, signal=None)
    await async_set_type_override(hass, a.id, None)
    body["settings"]["nichtda"] = {"battery": 10}
    body["settings"][b.id] = {"battery": 500}  # ausserhalb
    preview = await backup.async_import(hass, client_file, ["devices"], dry_run=True)
    assert hass.data[DATA_DEVICE_SETTINGS]["battery"] == {}  # nichts geschrieben
    rep = preview["sections"]["devices"]
    assert rep["changed"] == 4  # battery, notify, signal, Typ
    assert any(s["reason"] == "device_unknown" and s.get("count") == 1 for s in rep["skipped"])
    assert any(s["what"] == "battery" and s["reason"] == "invalid" for s in rep["skipped"])
    await backup.async_import(hass, client_file, ["devices"], dry_run=False)
    assert hass.data[DATA_DEVICE_SETTINGS]["battery"] == {a.id: 30}
    assert a.id in hass.data[DATA_DEVICE_SETTINGS]["notify_off"]
    # Rückgängig: Zustand der Sicherung "vorher" (ohne Einstellungen) genau herstellen, auch das Neue entfernen
    before = {**snapshot, "sections": {"devices": {"options": {"exclude_devices": []}, "settings": {}, "types": {}, "connections": {}, "names": {}}}}
    await backup.async_import(hass, before, ["devices"], dry_run=False, replace=True)
    assert hass.data[DATA_DEVICE_SETTINGS]["battery"] == {} and not hass.data[DATA_DEVICE_SETTINGS]["notify_off"]
    assert hass.data[DATA_DEVICE_SETTINGS]["signal"] == {}


async def test_hidden_devices_must_exist(hass: HomeAssistant, setup) -> None:  # noqa: F811
    device = _device(hass, "Weg")
    file = await backup.async_export(hass, ["devices"])
    file["sections"]["devices"]["options"]["exclude_devices"] = sorted([device.id, "a" * 32])
    report = await backup.async_import(hass, file, ["devices"], dry_run=False)
    assert options_api.current_values(_entry(hass))["exclude_devices"] == [device.id]
    assert any(s["reason"] == "device_unknown" for s in report["sections"]["devices"]["skipped"])


async def test_routines_and_magic_roundtrip(hass: HomeAssistant, setup) -> None:  # noqa: F811
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    sensor = er.async_get(hass).async_get_or_create("sensor", "test", f"{device.id}-t", device_id=device.id, original_name="t")
    hass.states.async_set(sensor.entity_id, "14", {"device_class": "temperature", "unit_of_measurement": "°C"})
    routine = await hass.data[DATA_ROUTINES].async_save_routine(
        {"device_id": device.id, "entity_id": plug, "name": "Licht", "action": "on", "kind": "countdown", "delay_s": 600}
    )
    rule = await hass.data[DATA_MAGIC].async_save_rule(
        {"device_id": device.id, "entity_id": sensor.entity_id, "name": "Kalt", "kind": "below", "value": 12, "for_s": 600, "message": "kalt {value}"}
    )
    file = await backup.async_export(hass, ["routines", "magic"])
    assert [r["id"] for r in file["sections"]["routines"]["items"]] == [routine["id"]]
    assert "created" not in file["sections"]["routines"]["items"][0]
    # Beide löschen, aus der Datei wieder anlegen: gleiche id, kein Duplikat beim zweiten Mal
    await hass.data[DATA_ROUTINES].async_delete_routine(routine["id"])
    await hass.data[DATA_MAGIC].async_delete_rule(rule["id"])
    report = await backup.async_import(hass, file, ["routines", "magic"], dry_run=False)
    assert report["sections"]["routines"]["changed"] == 1 and report["sections"]["magic"]["changed"] == 1
    assert [r["id"] for r in hass.data[DATA_ROUTINES].routines()] == [routine["id"]]
    assert [r["id"] for r in hass.data[DATA_MAGIC].rules()] == [rule["id"]]
    again = await backup.async_import(hass, file, ["routines", "magic"], dry_run=True)
    assert again["totals"]["changed"] == 0 and again["totals"]["skipped"] == 0 and again["sections"]["magic"]["unchanged"] == 1
    # Entität gibt es nicht mehr: übersprungen mit Grund, die übrigen bleiben
    hass.states.async_remove(sensor.entity_id)
    er.async_get(hass).async_remove(sensor.entity_id)
    await hass.data[DATA_MAGIC].async_delete_rule(rule["id"])
    gone = await backup.async_import(hass, file, ["magic"], dry_run=False)
    assert gone["sections"]["magic"]["changed"] == 0 and gone["sections"]["magic"]["skipped"][0]["reason"] == "Die Entität gibt es nicht"
    # Rückgängig mit "replace": was die Sicherung nicht kennt, wird entfernt
    extra = await hass.data[DATA_ROUTINES].async_save_routine(
        {"device_id": device.id, "entity_id": plug, "name": "Neu", "action": "off", "kind": "countdown", "delay_s": 300}
    )
    empty = {**file, "sections": {"routines": {"options": file["sections"]["routines"]["options"], "items": []}}}
    await backup.async_import(hass, empty, ["routines"], dry_run=False, replace=True)
    assert hass.data[DATA_ROUTINES].routines() == [] and extra["id"]


async def test_check_file() -> None:
    for bad in ({}, {"format": "x", "sections": {}}, {"format": backup.FORMAT, "format_version": 99, "sections": {}}, {"format": backup.FORMAT, "format_version": 1}):
        with pytest.raises(vol.Invalid):
            backup.check_file(bad)


async def test_websocket(hass: HomeAssistant, setup, hass_ws_client) -> None:  # noqa: F811
    client = await hass_ws_client(hass)
    res = await _ws(client, 1, type=f"{DOMAIN}/backup_export", sections=["monitor", "display"])
    assert res["success"] and set(res["result"]["file"]["sections"]) == {"monitor", "display"}
    file = res["result"]["file"]
    file["sections"]["monitor"]["options"]["battery_low"] = 33
    res = await _ws(client, 2, type=f"{DOMAIN}/backup_import", data=file)  # Standard: Vorschau
    assert res["success"] and res["result"]["totals"]["changed"] == 1
    assert options_api.current_values(_entry(hass))["battery_low"] == 15
    res = await _ws(client, 3, type=f"{DOMAIN}/backup_import", data=file, dry_run=False)
    assert res["success"] and options_api.current_values(_entry(hass))["battery_low"] == 33
    bad = await _ws(client, 4, type=f"{DOMAIN}/backup_import", data={"format": "x", "sections": {}})
    assert not bad["success"] and bad["error"]["code"] == "invalid_format"
    wrong = await _ws(client, 5, type=f"{DOMAIN}/backup_export", sections=["gibtsnicht"])
    assert not wrong["success"]
    await _options(hass)
