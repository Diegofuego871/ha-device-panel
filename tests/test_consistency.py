"""
Konsistenz der Einstellungen pro Gerät: jede Art ("kind") hat dieselben Wege (seit 2.94.0).

Eine neue Einstellung pro Gerät wurde mehrfach nur an einer Stelle eingebaut und an den anderen vergessen (Übersicht, Zurücksetzen,
Geräte-Payload). Der Test geht alle Arten durch: setzen, in der Übersicht von get_options finden, im Geräte-Payload sehen,
mit reset_device_settings zurücksetzen. Kommt in get_options eine neue Art dazu, die hier fehlt, schlägt er fehl: dann
KINDS ergänzen (und im Panel `st.resets`, `_settingsResetChanges`, `_overridesHtml`, siehe Suite consistency-e2e).
"""

from __future__ import annotations

import time
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel.const import DATA_AVAILABILITY, DOMAIN


@pytest.fixture
async def setup(hass: HomeAssistant):
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    hass.data[DATA_AVAILABILITY]._started = time.time() - 3600
    return entry


def _device(hass: HomeAssistant, name: str, domain: str = "zha") -> dr.DeviceEntry:
    source = MockConfigEntry(domain=domain, title=f"{name} Eintrag")
    source.add_to_hass(hass)
    device = dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={(domain, name)}, name=name)
    for key, ent_domain, state, extra in (
        ("bat", "sensor", "40", {"original_device_class": "battery"}),
        ("rssi", "sensor", "-80", {"original_device_class": "signal_strength", "unit_of_measurement": "dBm"}),
        ("l", "light", "on", {}),
    ):
        entry = er.async_get(hass).async_get_or_create(ent_domain, "test", f"{device.id}-{key}", device_id=device.id, **extra)
        hass.states.async_set(entry.entity_id, state)
    return device


# Art -> (Nachricht zum Setzen, Feld im Geräte-Payload der list_devices, das den eigenen Wert trägt)
KINDS: dict[str, tuple[dict[str, Any], str]] = {
    "battery": ({"type": f"{DOMAIN}/set_device_settings", "battery": 25}, "battery_setting"),
    "notify": ({"type": f"{DOMAIN}/set_device_settings", "notify": False}, "notify_off"),
    "connection": ({"type": f"{DOMAIN}/set_device_connection", "connection": "wifi"}, "connection_manual"),
    "signal": ({"type": f"{DOMAIN}/set_device_settings", "signal": -90}, "signal_setting"),
    "offline": ({"type": f"{DOMAIN}/set_device_settings", "offline": 45}, "offline_setting"),
    "notify_delay": ({"type": f"{DOMAIN}/set_device_settings", "notify_delay": 50}, "notify_delay_setting"),
    "charge": ({"type": f"{DOMAIN}/set_device_settings", "charge": True}, "charge_setting"),
}


async def test_every_kind_has_all_paths(hass: HomeAssistant, setup, hass_ws_client) -> None:
    dev = _device(hass, "Prüfgerät")
    client = await hass_ws_client(hass)
    ids = iter(range(1, 1000))

    async def call(**msg: Any) -> dict[str, Any]:
        await client.send_json({"id": next(ids), **msg})
        return await client.receive_json()

    async def payload() -> dict[str, Any]:
        devices = (await call(type=f"{DOMAIN}/list_devices"))["result"]["devices"]
        return next(d for d in devices if d["id"] == dev.id)

    async def overrides() -> dict[str, Any]:
        return (await call(type=f"{DOMAIN}/get_options"))["result"]["overrides"]

    # Alle Arten, die das Backend kennt, stehen in der Tabelle (und umgekehrt)
    assert set(await overrides()) == set(KINDS), "Neue Art in get_options: KINDS und das Panel (consistency-e2e) ergänzen"
    plain = await payload()
    for kind, (msg, field) in KINDS.items():
        assert not plain[field], f"{kind}: Ausgangslage hat schon einen eigenen Wert"

    for kind, (msg, field) in KINDS.items():
        res = await call(device_id=dev.id, **msg)
        assert res.get("success"), f"{kind}: Setzen schlägt fehl: {res}"
        assert [i["id"] for i in (await overrides())[kind]] == [dev.id], f"{kind}: fehlt in der Übersicht von get_options"
        assert (await payload())[field], f"{kind}: Geräte-Payload ({field}) zeigt den eigenen Wert nicht"

    # Zurücksetzen: jede Art einzeln, das Ergebnis nennt genau diese Art
    for kind, (_msg, field) in KINDS.items():
        res = await call(type=f"{DOMAIN}/reset_device_settings", **{kind: [dev.id]})
        assert res.get("success"), f"{kind}: Zurücksetzen schlägt fehl: {res}"
        assert set(res["result"]) == set(KINDS), f"{kind}: Ergebnis des Zurücksetzens nennt nicht alle Arten"
        assert res["result"][kind] == 1, f"{kind}: Zurücksetzen zählt nicht"
        assert (await overrides())[kind] == [], f"{kind}: bleibt nach dem Zurücksetzen in der Übersicht"
        assert not (await payload())[field], f"{kind}: Geräte-Payload zeigt nach dem Zurücksetzen noch einen eigenen Wert"
