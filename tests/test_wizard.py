"""Einrichtungsassistent (2.135.0): Zustand, Daten der Schritte, Testmeldung."""

from __future__ import annotations

import time
from unittest.mock import patch
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.device_panel import backup
from custom_components.device_panel.const import DATA_AVAILABILITY, DOMAIN, NEW_INSTALL_OPTIONS
from custom_components.device_panel.options_api import values_from


@pytest.fixture
async def setup(hass: HomeAssistant):
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    hass.data[DATA_AVAILABILITY]._started = time.time() - 3600
    return entry


def _device(hass: HomeAssistant, name: str, domain: str, entity_domain: str = "light", **kwargs: Any) -> dr.DeviceEntry:
    source = MockConfigEntry(domain=domain, title=f"{name} Eintrag")
    source.add_to_hass(hass)
    device = dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={(domain, name)}, name=name, **kwargs)
    entry = er.async_get(hass).async_get_or_create(entity_domain, "test", f"{device.id}-1", device_id=device.id)
    hass.states.async_set(entry.entity_id, "on")
    return device


async def _ws(client, msg_id: int, **msg: Any) -> dict[str, Any]:
    await client.send_json({"id": msg_id, **msg})
    return await client.receive_json()


def test_state_defaults_and_new_install() -> None:
    """Frische Installation: "new"; bestehende ohne Wert (und ungültige Werte): "done", kein Fenster und keine Kachel."""
    assert NEW_INSTALL_OPTIONS["wizard_state"] == "new"
    assert values_from({})["wizard_state"] == "done" and values_from({})["wizard_done_at"] == 0
    assert values_from({"wizard_state": "later"})["wizard_state"] == "later"
    assert values_from({"wizard_state": "kaputt"})["wizard_state"] == "done"
    assert values_from({"wizard_done_at": -5})["wizard_done_at"] == 0


async def test_state_in_list_and_options(hass: HomeAssistant, setup, hass_ws_client) -> None:  # noqa: F811
    client = await hass_ws_client(hass)
    assert (await _ws(client, 1, type=f"{DOMAIN}/list_devices"))["result"]["wizard"] == "done"
    for n, state in enumerate(("later", "open", "off", "new", "done"), start=2):
        res = await _ws(client, n * 2, type=f"{DOMAIN}/set_options", values={"wizard_state": state, "wizard_done_at": 1_700_000_000})
        assert res["success"], res
        assert (await _ws(client, n * 2 + 1, type=f"{DOMAIN}/list_devices"))["result"]["wizard"] == state
    values = (await _ws(client, 30, type=f"{DOMAIN}/get_options"))["result"]["values"]
    assert values["wizard_state"] == "done" and values["wizard_done_at"] == 1_700_000_000
    assert not (await _ws(client, 31, type=f"{DOMAIN}/set_options", values={"wizard_state": "halb"}))["success"]


async def test_state_is_not_in_the_backup(hass: HomeAssistant, setup) -> None:  # noqa: F811
    """Der Zustand gehört zur Installation: er steht nicht in der Sicherung, und eine Datei kann ihn nicht setzen."""
    assert "wizard_state" not in backup._SCHEMA_KEYS and "wizard_done_at" not in backup._SCHEMA_KEYS
    file = await backup.async_export(hass, ["monitor"])
    assert "wizard_state" not in str(file)
    hass.config_entries.async_update_entry(setup, options={**setup.options, "wizard_state": "open"})
    file["sections"]["monitor"]["options"]["wizard_state"] = "off"
    await backup.async_import(hass, file, ["monitor"], dry_run=False)
    assert setup.options["wizard_state"] == "open"


async def test_wizard_data(hass: HomeAssistant, setup, hass_ws_client) -> None:  # noqa: F811
    """Alle Kandidaten mit Integration, Typ und Bereich; Ausschlüsse sind nicht abgezogen."""
    area = ar.async_get(hass).async_create("Wohnzimmer")
    tv = _device(hass, "Fernseher", "apple_tv", "media_player")
    dr.async_get(hass).async_update_device(tv.id, area_id=area.id)
    lamp = _device(hass, "Lampe", "hue", "light")
    other = _device(hass, "Stehlampe", "hue", "light")
    cell = _device(hass, "Taster", "hue", "sensor")
    cell_entity = next(e for e in er.async_entries_for_device(er.async_get(hass), cell.id))
    hass.states.async_set(cell_entity.entity_id, "80", {"device_class": "battery", "unit_of_measurement": "%"})
    client = await hass_ws_client(hass)
    # Ausschlüsse ändern die Antwort nicht (der Assistent rechnet selbst nach seinem Entwurf)
    assert (await _ws(client, 1, type=f"{DOMAIN}/set_options", values={"exclude_integrations": ["apple_tv"], "exclude_types": ["light"], "exclude_devices": [other.id]}))["success"]
    data = (await _ws(client, 2, type=f"{DOMAIN}/wizard_data"))["result"]
    by = {i["domain"]: i for i in data["integrations"]}
    assert by["hue"]["devices"] == 3 and by["apple_tv"]["devices"] == 1
    devices = {d["name"]: d for d in data["devices"]}
    assert devices["Fernseher"]["type"] == "media" and devices["Fernseher"]["area"] == "Wohnzimmer" and devices["Fernseher"]["domain"] == "apple_tv"
    assert devices["Lampe"]["id"] == lamp.id and devices["Lampe"]["type"] == "light" and devices["Lampe"]["area"] == ""
    # Batterie (ja/nein) je Gerät, für die Lade- und Batteriemeldung je Integration im Assistenten
    assert devices["Taster"]["battery"] is True and devices["Lampe"]["battery"] is False
    # Aktueller Stand in Prozent, klein hinter dem Bereich in den Zeilen Batterie und Laden
    assert devices["Taster"]["battery_level"] == 80 and devices["Lampe"]["battery_level"] is None
    assert [d["name"] for d in data["devices"]] == sorted((d["name"] for d in data["devices"]), key=str.lower)
    # Gerade ausgefallen (für den Hinweis in der Zeile "Ausfall"): ohne Ausfall nie, sonst nach device_status
    # Aktuelle Auslastung für die Systemmeldungen: ohne Sensor kein Wert, mit einem Prozent-Sensor der gerundete Stand
    assert data["status"] == {"cpu": None, "ram": None, "disk": None}
    hass.states.async_set("sensor.cpu_test", "23.4", {"unit_of_measurement": "%"})
    assert (await _ws(client, 4, type=f"{DOMAIN}/set_options", values={"status_cpu_entity": "sensor.cpu_test"}))["success"]
    assert (await _ws(client, 5, type=f"{DOMAIN}/wizard_data"))["result"]["status"]["cpu"] == 23.4
    assert not any(d["down"] for d in data["devices"])
    with patch("custom_components.device_panel.wizard.live_status", return_value=(False, None)):
        down = (await _ws(client, 6, type=f"{DOMAIN}/wizard_data"))["result"]
    assert all(d["down"] is True for d in down["devices"])


async def test_wizard_test_message(hass: HomeAssistant, setup, hass_ws_client) -> None:  # noqa: F811
    calls = async_mock_service(hass, "notify", "handy")
    client = await hass_ws_client(hass)
    res = await _ws(client, 1, type=f"{DOMAIN}/wizard_test", target="notify.handy")
    assert res["success"] and res["result"] == {"sent": True}
    assert len(calls) == 1 and "Device Panel" in calls[0].data["title"]
    # Ein Ziel, das es nicht gibt, meldet "nicht gesendet"; ein ungültiger Name wird abgelehnt
    missing = await _ws(client, 2, type=f"{DOMAIN}/wizard_test", target="notify.gibtesnicht")
    assert missing["success"] and missing["result"] == {"sent": False}
    assert not (await _ws(client, 3, type=f"{DOMAIN}/wizard_test", target="light.kueche"))["success"]
    assert not (await _ws(client, 4, type=f"{DOMAIN}/wizard_test", target="none"))["success"]


async def test_draft_is_stored_cleared_and_validated(hass: HomeAssistant, setup, hass_ws_client) -> None:  # noqa: F811
    """Zwischenstand (2.136.0): Schritt und Entwurf bleiben, ohne etwas anzuwenden; "None" löscht; Unsinn und Übergrösse werden abgelehnt."""
    client = await hass_ws_client(hass)
    assert (await _ws(client, 1, type=f"{DOMAIN}/get_options"))["result"]["values"]["wizard_draft"] is None
    draft = {"step": "devices", "d": {"exI": ["hue"], "exT": [], "exD": ["abc"], "target": "notify.handy", "on": {"outage": True}, "v": {"notify_delay": "3"}, "quiet": {"on": False}}}
    assert (await _ws(client, 2, type=f"{DOMAIN}/set_options", values={"wizard_draft": draft}))["success"]
    values = (await _ws(client, 3, type=f"{DOMAIN}/get_options"))["result"]["values"]
    assert values["wizard_draft"] == draft
    # angewendet wird nichts
    assert values["exclude_integrations"] == [] and values["notify_service"] == "none" and values["notify_delay"] == 2
    for n, bad in enumerate(({"step": "nirgends", "d": {}}, {"step": "types"}, {"step": "types", "d": []}, "text", {"step": "types", "d": {"x": "a" * 250_000}}), start=4):
        assert not (await _ws(client, n, type=f"{DOMAIN}/set_options", values={"wizard_draft": bad}))["success"]
    assert (await _ws(client, 20, type=f"{DOMAIN}/get_options"))["result"]["values"]["wizard_draft"] == draft
    assert (await _ws(client, 21, type=f"{DOMAIN}/set_options", values={"wizard_draft": None}))["success"]
    assert (await _ws(client, 22, type=f"{DOMAIN}/get_options"))["result"]["values"]["wizard_draft"] is None
    assert "wizard_draft" not in backup._SCHEMA_KEYS


async def test_wizard_data_down_in_restart_gap(hass: HomeAssistant, setup, hass_ws_client) -> None:  # noqa: F811
    """Wie die Liste: kurz nach einem Neustart (unter "Ausgefallen nach", Lücke im Protokoll) gilt ein laufender Ausfall weiter als ausgefallen."""
    from custom_components.device_panel.const import DATA_AVAILABILITY

    dev = _device(hass, "Eve Türe", "matter", "binary_sensor")
    entity = next(e for e in er.async_entries_for_device(er.async_get(hass), dev.id))
    hass.states.async_set(entity.entity_id, "unavailable")
    now = time.time()
    client = await hass_ws_client(hass)
    first = (await _ws(client, 1, type=f"{DOMAIN}/wizard_data"))["result"]
    assert next(d for d in first["devices"] if d["id"] == dev.id)["down"] is False
    hass.data[DATA_AVAILABILITY]._events[dev.id] = [[now - 7200, 1], [now - 3600, 0], [now - 60, None]]
    second = (await _ws(client, 2, type=f"{DOMAIN}/wizard_data"))["result"]
    assert next(d for d in second["devices"] if d["id"] == dev.id)["down"] is True
