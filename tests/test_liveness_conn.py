"""Verbindungssensor zählt als Lebenszeichen (2.184.0): vier Ebenen, Wirkung auf den Status, gesperrte Marken im Detail, Sicherung."""

from __future__ import annotations

import time
from datetime import timedelta
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import label_registry as lr
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel import backup, options_api
from custom_components.device_panel.const import DATA_AVAILABILITY, DATA_DEVICE_SETTINGS, DOMAIN
from custom_components.device_panel.devices import (
    async_device_detail,
    async_set_device_settings,
    liveness_conn,
    liveness_exclude,
)


async def _setup(hass: HomeAssistant, **options: Any) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options=options)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    hass.data[DATA_AVAILABILITY]._started = time.time() - 3600
    return entry


def _shelly(hass: HomeAssistant, name: str = "Steckdose", domain: str = "shelly", labels: tuple[str, ...] = (), only_conn: bool = False) -> tuple[dr.DeviceEntry, str, str]:
    """Gerät mit Verbindungssensor "Cloud" (aus) und einem Schalter (an). Gibt (Gerät, Sensor, Schalter) zurück."""
    source = next((e for e in hass.config_entries.async_entries(domain) if e.title == f"{domain} Eintrag"), None)
    if source is None:
        source = MockConfigEntry(domain=domain, title=f"{domain} Eintrag")
        source.add_to_hass(hass)
    reg = dr.async_get(hass)
    device = reg.async_get_or_create(config_entry_id=source.entry_id, identifiers={(domain, name)}, name=name)
    if labels:
        device = reg.async_update_device(device.id, labels=set(labels))
    ents = er.async_get(hass)
    cloud = ents.async_get_or_create("binary_sensor", domain, f"{name}-cloud", device_id=device.id, original_device_class="connectivity")
    hass.states.async_set(cloud.entity_id, "off")
    switch = ""
    if not only_conn:
        entry = ents.async_get_or_create("switch", domain, f"{name}-relay", device_id=device.id)
        hass.states.async_set(entry.entity_id, "on")
        switch = entry.entity_id
    return device, cloud.entity_id, switch


async def _list(hass: HomeAssistant, hass_ws_client) -> dict[str, dict[str, Any]]:
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/list_devices"})
    return {d["name"]: d for d in (await client.receive_json())["result"]["devices"]}


async def test_default_on_connectivity_decides(hass: HomeAssistant, hass_ws_client, freezer) -> None:
    await _setup(hass)
    device, cloud, _switch = _shelly(hass)
    assert liveness_conn(hass, device.id) is True
    assert liveness_exclude(hass, device.id) == frozenset()
    # Wie bisher: der Verbindungssensor entscheidet, "aus" heisst ausgefallen (nach "Ausgefallen nach")
    freezer.tick(timedelta(minutes=10))
    assert (await _list(hass, hass_ws_client))["Steckdose"]["online"] is False


async def test_off_global_other_entities_count(hass: HomeAssistant, hass_ws_client, freezer) -> None:
    await _setup(hass, liveness_connectivity=False)
    device, cloud, _switch = _shelly(hass)
    assert liveness_conn(hass, device.id) is False
    assert liveness_exclude(hass, device.id) == {cloud}
    freezer.tick(timedelta(minutes=10))
    got = (await _list(hass, hass_ws_client))["Steckdose"]
    assert got["online"] is True and got["liveness_conn"] is False and got["has_connectivity"] is True
    assert got["liveness_conn_default"] == {"on": False, "integration": None, "global": False}


async def test_levels_device_label_integration_global(hass: HomeAssistant, hass_ws_client) -> None:
    often = lr.async_get(hass).async_create("Cloud egal").label_id
    await _setup(hass, labels=[often], liveness_connectivity=True, liveness_connectivity_integrations={"shelly": False, f"label:{often}": True})
    plain, _c1, _s1 = _shelly(hass, "Plain")
    labelled, _c2, _s2 = _shelly(hass, "Label", labels=(often,))
    other, _c3, _s3 = _shelly(hass, "Zha", domain="zha")
    got = await _list(hass, hass_ws_client)
    # Integration "shelly" aus; das Label geht vor der Integration (an); eine andere Integration folgt dem globalen Wert (an)
    assert got["Plain"]["liveness_conn"] is False and got["Plain"]["liveness_conn_default"]["integration"] == "shelly"
    assert got["Label"]["liveness_conn"] is True and got["Label"]["liveness_conn_default"]["integration"] == f"label:{often}"
    assert got["Zha"]["liveness_conn"] is True and got["Zha"]["liveness_conn_default"]["integration"] is None
    # Das Gerät geht vor allem
    await async_set_device_settings(hass, plain.id, liveness_conn=True)
    await async_set_device_settings(hass, labelled.id, liveness_conn=False)
    got = await _list(hass, hass_ws_client)
    assert got["Plain"]["liveness_conn"] is True and got["Plain"]["liveness_conn_setting"] is True
    assert got["Label"]["liveness_conn"] is False and got["Label"]["liveness_conn_setting"] is False
    assert other.id != plain.id


async def test_several_labels_off_wins(hass: HomeAssistant) -> None:
    a = lr.async_get(hass).async_create("A").label_id
    b = lr.async_get(hass).async_create("B").label_id
    await _setup(hass, labels=[a, b], liveness_connectivity_integrations={f"label:{a}": True, f"label:{b}": False})
    device, _c, _s = _shelly(hass, labels=(a, b))
    assert liveness_conn(hass, device.id) is False


async def test_only_connectivity_sensor_stays_effective(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass, liveness_connectivity=False)
    device, cloud, _ = _shelly(hass, only_conn=True)
    # Bliebe nichts übrig, gilt der Ausschluss nicht: der Sensor zählt trotzdem (sonst "keine Daten")
    from custom_components.device_panel.devices import liveness_entities

    relevant, is_conn = liveness_entities(er.async_entries_for_device(er.async_get(hass), device.id), liveness_exclude(hass, device.id))
    assert [e.entity_id for e in relevant] == [cloud] and is_conn is True
    detail = await async_device_detail(hass, device.id)
    assert detail["liveness_conn"]["applies"] is False and not any(e["liveness_locked"] for e in detail["entities"])


async def test_detail_locks_connectivity_with_source(hass: HomeAssistant) -> None:
    await _setup(hass, liveness_connectivity_integrations={"shelly": False})
    device, cloud, switch = _shelly(hass)
    detail = await async_device_detail(hass, device.id)
    rows = {e["entity_id"]: e for e in detail["entities"]}
    assert rows[cloud]["liveness_locked"] is True and rows[cloud]["liveness"] is False and rows[cloud]["liveness_off"] is False
    assert rows[switch]["liveness"] is True and rows[switch]["liveness_locked"] is False
    assert detail["liveness_conn"] == {"on": False, "own": False, "source": "shelly", "has": True, "applies": True}
    # Eigene Wahl des Geräts: "an" hebt die Sperre auf
    await async_set_device_settings(hass, device.id, liveness_conn=True)
    detail = await async_device_detail(hass, device.id)
    assert not any(e["liveness_locked"] for e in detail["entities"]) and detail["liveness_conn"]["own"] is True


async def test_manual_mark_survives_rule(hass: HomeAssistant) -> None:
    await _setup(hass, liveness_connectivity=False)
    device, cloud, switch = _shelly(hass)
    await async_set_device_settings(hass, device.id, liveness_exclude=[cloud])
    assert hass.data[DATA_DEVICE_SETTINGS]["liveness_exclude"][device.id] == [cloud]
    assert liveness_exclude(hass, device.id) == {cloud}


async def test_validation_and_reset(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    device, _c, _s = _shelly(hass)
    client = await hass_ws_client(hass)
    for i, bad in enumerate(({"shelly": "aus"}, {"BAD KEY": True}, [True]), start=1):
        await client.send_json({"id": i, "type": f"{DOMAIN}/set_options", "values": {"liveness_connectivity_integrations": bad}})
        assert (await client.receive_json())["error"]["code"] == "invalid_format", bad
    for i, bad in enumerate(("ja", 1, [True]), start=10):
        await client.send_json({"id": i, "type": f"{DOMAIN}/set_device_settings", "device_id": device.id, "liveness_conn": bad})
        assert (await client.receive_json())["error"]["code"] == "invalid_format", bad
    await client.send_json({"id": 20, "type": f"{DOMAIN}/set_options", "values": {"liveness_connectivity": False, "liveness_connectivity_integrations": {"shelly": True, "label:x": False}}})
    assert (await client.receive_json())["success"]
    await client.send_json({"id": 21, "type": f"{DOMAIN}/set_device_settings", "device_id": device.id, "liveness_conn": False})
    assert (await client.receive_json())["success"]
    await client.send_json({"id": 22, "type": f"{DOMAIN}/reset_device_settings", "liveness_conn": [device.id]})
    assert (await client.receive_json())["result"]["liveness_conn"] == 1
    assert hass.data[DATA_DEVICE_SETTINGS]["liveness_conn"] == {}


async def test_backup_roundtrip(hass: HomeAssistant) -> None:
    entry = await _setup(hass)
    device, _c, _s = _shelly(hass)
    await async_set_device_settings(hass, device.id, liveness_conn=False)
    hass.config_entries.async_update_entry(entry, options={**entry.options, "liveness_connectivity": False, "liveness_connectivity_integrations": {"shelly": True, "label:garage": False}})
    file = await backup.async_export(hass, ["monitor", "devices"])
    assert file["sections"]["monitor"]["options"]["liveness_connectivity_integrations"] == {"label:garage": False, "shelly": True}
    assert file["sections"]["monitor"]["options"]["liveness_connectivity"] is False
    assert file["sections"]["devices"]["settings"][device.id] == {"liveness_conn": False}
    hass.config_entries.async_update_entry(entry, options={k: v for k, v in entry.options.items() if not k.startswith("liveness_connectivity")})
    await async_set_device_settings(hass, device.id, liveness_conn=None)
    await backup.async_import(hass, file, ["monitor", "devices"], dry_run=False)
    values = options_api.current_values(entry)
    assert values["liveness_connectivity"] is False and values["liveness_connectivity_integrations"] == {"label:garage": False, "shelly": True}
    assert hass.data[DATA_DEVICE_SETTINGS]["liveness_conn"] == {device.id: False}
    # Ein ungültiger Wert in der Datei wird übersprungen
    file["sections"]["devices"]["settings"][device.id] = {"liveness_conn": "ja"}
    rep = await backup.async_import(hass, file, ["devices"], dry_run=True)
    assert any(s["what"] == "liveness_conn" and s["reason"] == "invalid" for s in rep["sections"]["devices"]["skipped"])


@pytest.mark.parametrize("value", [True, False])
async def test_global_option_roundtrips(hass: HomeAssistant, hass_ws_client, value: bool) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_options", "values": {"liveness_connectivity": value}})
    assert (await client.receive_json())["success"]
    await client.send_json({"id": 2, "type": f"{DOMAIN}/get_options"})
    assert (await client.receive_json())["result"]["values"]["liveness_connectivity"] is value


async def test_detail_tiers_and_marking_sole_connectivity_sensor(hass: HomeAssistant) -> None:
    """Das Popup rechnet mit den Stufen wie liveness_entities: wird der Verbindungssensor von Hand ausgeschlossen, zählen die übrigen (2.184.0)."""
    await _setup(hass)
    device, cloud, switch = _shelly(hass)
    ents = er.async_get(hass)
    diag = ents.async_get_or_create("sensor", "shelly", "Steckdose-rssi", device_id=device.id, entity_category=er.EntityCategory.DIAGNOSTIC)
    hass.states.async_set(diag.entity_id, "-60")
    detail = await async_device_detail(hass, device.id)
    tiers = {e["entity_id"]: e["liveness_tier"] for e in detail["entities"]}
    assert tiers == {cloud: 0, switch: 1, diag.entity_id: 3}
    # Server: von Hand ausgeschlossen, bleibt die Wahl nicht beim Verbindungssensor hängen, sondern fällt auf die übrigen zurück
    await async_set_device_settings(hass, device.id, liveness_exclude=[cloud])
    from custom_components.device_panel.devices import liveness_entities

    relevant, is_conn = liveness_entities(er.async_entries_for_device(ents, device.id), liveness_exclude(hass, device.id))
    assert is_conn is False and {e.entity_id for e in relevant} == {switch}
