"""Labels als Ebene zwischen Gerät und Integration (2.155.0): Rangfolge, das strengste bei mehreren Labels, Optionen und Kataloge."""

from __future__ import annotations

from typing import Any

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import label_registry as lr
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel.const import DOMAIN
from custom_components.device_panel.devices import async_set_device_settings
from custom_components.device_panel.options_api import PANEL_SCHEMA, battery_threshold, notify_delay_for, offline_after_for, signal_default
from custom_components.device_panel.scope import Scope, listed, lowest, pick, strictest_time


async def _setup(hass: HomeAssistant, **options: Any) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options=options)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def _device(hass: HomeAssistant, name: str, domain: str = "test", labels: tuple[str, ...] = ()) -> dr.DeviceEntry:
    source = next((e for e in hass.config_entries.async_entries(domain) if e.title == f"{domain} Eintrag"), None)
    if source is None:
        source = MockConfigEntry(domain=domain, title=f"{domain} Eintrag")
        source.add_to_hass(hass)
    reg = dr.async_get(hass)
    device = reg.async_get_or_create(config_entry_id=source.entry_id, identifiers={(domain, name)}, name=name)
    if labels:
        device = reg.async_update_device(device.id, labels=set(labels))
    entity = er.async_get(hass).async_get_or_create("sensor", domain, f"{name}-1", device_id=device.id)
    hass.states.async_set(entity.entity_id, "1")
    return device


def _label(hass: HomeAssistant, name: str) -> str:
    return lr.async_get(hass).async_create(name).label_id


async def _list(client, msg_id: int = 1) -> dict[str, Any]:
    await client.send_json({"id": msg_id, "type": f"{DOMAIN}/list_devices"})
    return (await client.receive_json())["result"]


async def _devices(client, msg_id: int = 1) -> dict[str, dict[str, Any]]:
    return {d["name"]: d for d in (await _list(client, msg_id))["devices"]}


def test_pick_and_listed_rules() -> None:
    scope = Scope("test", ("label:a", "label:b"))
    # Ohne Eintrag eines Labels gilt die Integration
    assert pick({"test": 5}, scope) == ("test", 5)
    assert pick({}, scope) == (None, None)
    # Ein Label geht vor der Integration
    assert pick({"test": 5, "label:b": 9}, scope) == ("label:b", 9)
    # Mehrere Labels: das strengste ("off" vor einer Zeit, sonst die längere), sonst das weiter oben
    assert pick({"label:a": 10, "label:b": "off"}, scope, strictest_time) == ("label:b", "off")
    assert pick({"label:a": 10, "label:b": 30}, scope, strictest_time) == ("label:b", 30)
    assert pick({"label:a": 10, "label:b": 30}, scope) == ("label:a", 10)
    assert pick({"label:a": 10, "label:b": 3}, scope, lowest) == ("label:b", 3)
    # Listen der Ausnahmen: ein Label in der Liste gilt für das Gerät
    assert listed({"label:b"}, scope) == "label:b"
    assert listed(["test"], scope) == "test"
    assert listed(["other"], scope) is None
    assert listed(["label:a"], "test") is None
    # Eine einfache Domain ohne Labels bleibt, wie sie war
    assert pick({"test": 5}, "test") == ("test", 5)
    assert str(scope) == "test" and scope == "test" and hash(scope) == hash("test")


def test_option_functions_use_labels() -> None:
    opts = {
        "offline_after": 2,
        "offline_after_integrations": {"test": 30, "label:a": "off", "label:b": 60},
        "notify_delay": 2,
        "notify_delay_integrations": {"label:a": 15, "label:b": 20},
        "battery_low": 15,
        "battery_low_integrations": {"test": 10, "label:a": 5, "label:b": 8},
        "signal_low": {},
        "signal_low_integrations": {"label:a": {"wifi": -90}, "label:b": {"wifi": -80}, "test": {"wifi": -70}},
    }
    both = Scope("test", ("label:a", "label:b"))
    only_b = Scope("test", ("label:b",))
    # "off" gewinnt vor einer Zeit; eine einzelne Zeit des Labels geht vor der Integration
    assert offline_after_for(opts, both) is None
    assert offline_after_for(opts, only_b) == 3600
    assert offline_after_for(opts, "test") == 1800
    assert offline_after_for(opts, "other") == 120
    # Die längere Zeit
    assert notify_delay_for(opts, both) == 20
    # Die tiefere Schwelle (weniger Meldungen)
    assert battery_threshold(opts, both) == 5
    assert battery_threshold(opts, only_b) == 8
    assert battery_threshold(opts, "test") == 10
    # Empfang: die tiefere Schwelle des Labels, vor der Integration
    assert signal_default(opts, both, "wifi", {"kind": "dbm", "value": -60}) == {"value": -90, "source": "label", "label": "label:a"}
    assert signal_default(opts, "test", "wifi", {"kind": "dbm", "value": -60}) == {"value": -70, "source": "integration"}


def test_option_schema_accepts_label_keys() -> None:
    clean = PANEL_SCHEMA(
        {
            "labels": ["often_offline", "garage", "often_offline"],
            "offline_after_integrations": {"label:often_offline": "off"},
            "battery_low_integrations": {"label:garage": 20},
            "notify_exclude_integrations": ["label:garage"],
            "type_integrations": {"label:garage": "sensor"},
            "signal_low_integrations": {"label:garage": {"wifi": -85}},
        }
    )
    assert clean["labels"] == ["often_offline", "garage"]
    assert clean["offline_after_integrations"] == {"label:often_offline": "off"}
    with pytest.raises(vol.Invalid):
        PANEL_SCHEMA({"labels": ["Gross Schreiben"]})
    with pytest.raises(vol.Invalid):
        PANEL_SCHEMA({"offline_after_integrations": {"label:": "off"}})
    with pytest.raises(vol.Invalid):
        PANEL_SCHEMA({"offline_after_integrations": {"label:UPPER": "off"}})


async def test_label_unmonitors_devices_and_device_wins(hass: HomeAssistant, hass_ws_client) -> None:
    often = _label(hass, "Oft offline")
    await _setup(hass, labels=[often], offline_after_integrations={f"label:{often}": "off"})
    laptop = _device(hass, "Laptop", labels=(often,))
    lamp = _device(hass, "Lampe")
    client = await hass_ws_client(hass)

    devices = await _devices(client, 1)
    assert devices["Laptop"]["unmonitored"] is True and devices["Laptop"]["offline_after"] is None
    assert devices["Laptop"]["offline_default"]["integration"] == f"label:{often}"
    assert devices["Laptop"]["labels"] == [often]
    assert devices["Lampe"]["unmonitored"] is False and devices["Lampe"]["offline_default"]["integration"] is None
    assert devices["Lampe"]["labels"] == []

    # Das Gerät geht vor dem Label
    await async_set_device_settings(hass, laptop.id, offline=45)
    laptop_dev = (await _devices(client, 2))["Laptop"]
    assert laptop_dev["offline_after"] == 45 and laptop_dev["unmonitored"] is False
    assert lamp.id != laptop.id


async def test_label_not_set_up_is_ignored(hass: HomeAssistant, hass_ws_client) -> None:
    often = _label(hass, "Oft offline")
    # Einstellung des Labels vorhanden, das Label aber nicht in der Liste der eingerichteten: wirkt nicht
    await _setup(hass, offline_after_integrations={f"label:{often}": "off"})
    _device(hass, "Laptop", labels=(often,))
    client = await hass_ws_client(hass)
    laptop = (await _devices(client, 1))["Laptop"]
    assert laptop["unmonitored"] is False and laptop["offline_default"]["integration"] is None


async def test_label_between_device_and_integration(hass: HomeAssistant, hass_ws_client) -> None:
    often = _label(hass, "Oft offline")
    await _setup(hass, labels=[often], offline_after_integrations={"test": 20, f"label:{often}": 90}, battery_low_integrations={"test": 12})
    _device(hass, "Laptop", labels=(often,))
    _device(hass, "Lampe")
    client = await hass_ws_client(hass)
    devices = await _devices(client, 1)
    # Label vor Integration
    assert devices["Laptop"]["offline_after"] == 90 and devices["Laptop"]["offline_default"]["minutes"] == 90
    assert devices["Lampe"]["offline_after"] == 20
    # Was das Label nicht setzt, kommt weiter von der Integration
    assert devices["Laptop"]["battery_default"]["pct"] == 12 and devices["Laptop"]["battery_default"]["integration"] == "test"


async def test_two_labels_strictest_wins(hass: HomeAssistant, hass_ws_client) -> None:
    a = _label(hass, "Eins")
    b = _label(hass, "Zwei")
    await _setup(hass, labels=[a, b], offline_after_integrations={f"label:{a}": 30, f"label:{b}": 120})
    _device(hass, "Beide", labels=(a, b))
    _device(hass, "Nur eins", labels=(a,))
    client = await hass_ws_client(hass)
    devices = await _devices(client, 1)
    assert devices["Beide"]["offline_after"] == 120 and devices["Beide"]["offline_default"]["integration"] == f"label:{b}"
    assert devices["Nur eins"]["offline_after"] == 30


async def test_catalog_and_list_carry_labels(hass: HomeAssistant, hass_ws_client) -> None:
    often = _label(hass, "Oft offline")
    unused = _label(hass, "Ohne Geräte")
    await _setup(hass, labels=[often, "geloescht"])
    _device(hass, "Laptop", labels=(often,))
    _device(hass, "Lampe", labels=(often,))
    _device(hass, "Ohne")
    client = await hass_ws_client(hass)
    result = await _list(client, 1)
    assert [x for x in result["labels"] if x["id"] == often][0]["devices"] == 2
    # Nur Labels mit Geräten unter den gezeigten
    assert unused not in {x["id"] for x in result["labels"]}
    assert result["label_order"] == [often, "geloescht"]
    await client.send_json({"id": 2, "type": f"{DOMAIN}/get_options"})
    catalog = (await client.receive_json())["result"]["catalog"]
    labels = {x["id"]: x for x in catalog["labels"]}
    assert labels[often]["devices"] == 2 and labels[often]["name"] == "Oft offline" and labels[often]["missing"] is False
    # Ein eingerichtetes Label, das es in HA nicht mehr gibt, bleibt sichtbar (zum Entfernen)
    assert labels["geloescht"]["missing"] is True
    # Labels ohne Geräte fehlen im Katalog
    assert unused not in labels
    # Die Einstellungen eines Labels stehen nicht in der Liste der Integrationen
    assert all(not i["domain"].startswith("label:") for i in catalog["integrations"])


async def test_label_push_exclusion_and_charge_lists(hass: HomeAssistant, hass_ws_client) -> None:
    often = _label(hass, "Oft offline")
    await _setup(
        hass,
        labels=[often],
        notify_exclude_integrations=[f"label:{often}"],
        battery_push_exclude_integrations=[f"label:{often}"],
        charge_integrations=[f"label:{often}"],
        notify_charge=True,
    )
    _device(hass, "Laptop", labels=(often,))
    _device(hass, "Lampe")
    client = await hass_ws_client(hass)
    devices = await _devices(client, 1)
    assert devices["Laptop"]["notify_default"]["push"] is False and devices["Laptop"]["notify_default"]["integration"] == f"label:{often}"
    assert devices["Laptop"]["battery_default"]["push_integration"] == f"label:{often}"
    assert devices["Laptop"]["charge_default"]["on"] is True and devices["Laptop"]["charge_default"]["integration"] == f"label:{often}"
    assert devices["Lampe"]["charge_default"]["on"] is False and devices["Lampe"]["notify_default"]["integration"] is None
