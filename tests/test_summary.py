"""Eigene Entitäten (2.122.0): Zähler, Fehlerzähler, Quittieren, Namen, das eigene Gerät fehlt in der Liste."""

from __future__ import annotations

from datetime import timedelta

from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from custom_components.device_panel import activity
from custom_components.device_panel.const import DATA_SUMMARY, DOMAIN
from custom_components.device_panel.devices import async_list_devices
from custom_components.device_panel.summary import MAX_NAMES, UPDATE_SECONDS, async_summary

from .test_battery import _battery
from .test_outage_notify import _device, _entity, _options, setup  # noqa: F401, F811  (Fixture "setup")


def _state(hass: HomeAssistant, unique_suffix: str) -> str | None:
    """Zustand der Entität mit dieser eindeutigen Kennung (Teil nach der ID des Eintrags)."""
    ent_reg = er.async_get(hass)
    entry = next((e for e in ent_reg.entities.values() if e.platform == DOMAIN and e.unique_id.split("_", 1)[1] == unique_suffix), None)
    assert entry is not None, unique_suffix
    state = hass.states.get(entry.entity_id)
    return state.state if state else None


async def _refresh(hass: HomeAssistant) -> None:
    await hass.data[DATA_SUMMARY].async_refresh()
    await hass.async_block_till_done()


async def test_entities_exist_with_service_device(hass: HomeAssistant, setup) -> None:  # noqa: F811
    ent_reg = er.async_get(hass)
    keys = {e.unique_id.split("_", 1)[1] for e in ent_reg.entities.values() if e.platform == DOMAIN}
    assert keys == {
        "active", "hidden", "offline", "warning", "battery", "battery_low", "charging", "signal_weak", "new", "updates", "errors",
        "outage", "problem", "acknowledge_errors",
    }
    device = dr.async_get(hass).async_get_device(identifiers={(DOMAIN, "panel")})
    assert device is not None and device.entry_type is dr.DeviceEntryType.SERVICE and device.name == "Device Panel"


async def test_own_device_is_not_listed(hass: HomeAssistant, setup) -> None:  # noqa: F811
    from custom_components.device_panel.devices import candidate_devices

    assert not [d for d, _ in candidate_devices(hass, service=True, disabled=True) if (DOMAIN, "panel") in d.identifiers]


async def test_counts_and_names(hass: HomeAssistant, setup) -> None:  # noqa: F811
    plug = _device(hass, "Steckdose")
    _entity(hass, plug, "switch", "s", "on")
    sensor = _device(hass, "Fühler")
    _entity(hass, sensor, "sensor", "t", "20")
    _battery(hass, sensor, "5")
    hidden = _device(hass, "Versteckt")
    _entity(hass, hidden, "switch", "h", "on")
    await _options(hass, exclude_devices=[hidden.id])
    setup.evaluate()
    await _refresh(hass)
    assert _state(hass, "active") == "2"
    assert _state(hass, "hidden") == "1"
    assert _state(hass, "battery") == "1"
    assert _state(hass, "battery_low") == "1"
    assert _state(hass, "warning") == "1"
    assert _state(hass, "offline") == "0"
    data = await async_summary(hass)
    assert data["warning"]["names"] == ["Fühler"] and data["battery_low"]["names"] == ["Fühler"]


async def test_offline_sets_binary_sensors(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    lamp = _device(hass, "Lampe")
    light = _entity(hass, lamp, "light", "l", "on")
    setup.evaluate()
    await _refresh(hass)
    assert _state(hass, "outage") == "off"
    hass.states.async_set(light, "unavailable")
    freezer.tick(timedelta(minutes=30))
    setup.evaluate()
    await _refresh(hass)
    assert _state(hass, "offline") == "1" and _state(hass, "outage") == "on"
    assert _state(hass, "warning") == "0"  # ein Ausfall zählt als Ausfall, nicht als Warnung


async def test_names_are_cut(hass: HomeAssistant, setup) -> None:  # noqa: F811
    for i in range(MAX_NAMES + 5):
        _entity(hass, _device(hass, f"Gerät {i:02d}"), "sensor", "x", "unavailable")
    setup.evaluate()
    data = await async_summary(hass)
    group = data["active"]
    assert group["count"] == MAX_NAMES + 5 and len(group["names"]) == MAX_NAMES and group["more"] == 5


async def test_error_counter_and_acknowledge(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    assert _state(hass, "errors") == "0" and _state(hass, "problem") == "off"
    activity.record(hass, "info", "system", "sys_start", "Device Panel", version="1")
    await _refresh(hass)
    assert _state(hass, "errors") == "0"  # nur die Stufe "error" zählt
    activity.record(hass, "error", "system", "ai_failed", "Device Panel", reason="Zeitüberschreitung", detail="kein Dienst", chars=1, task="ai_task.x")
    await _refresh(hass)
    assert _state(hass, "errors") == "1" and _state(hass, "problem") == "on"
    ent_reg = er.async_get(hass)
    button = next(e.entity_id for e in ent_reg.entities.values() if e.platform == DOMAIN and e.unique_id.endswith("_acknowledge_errors"))
    freezer.tick(timedelta(seconds=5))
    await hass.services.async_call("button", "press", {"entity_id": button}, blocking=True)
    await hass.async_block_till_done()
    assert _state(hass, "errors") == "0" and _state(hass, "problem") == "off"
    # Das Log bleibt unberührt
    assert any(e["level"] == "error" for e in activity.get(hass).entries)
    # Nach 24 Stunden zählt ein alter Fehler nicht mehr
    freezer.tick(timedelta(hours=25))
    assert hass.data[DATA_SUMMARY].ack_at > 0


async def test_polls_every_interval(hass: HomeAssistant, setup) -> None:  # noqa: F811
    assert hass.data[DATA_SUMMARY].update_interval == timedelta(seconds=UPDATE_SECONDS)


async def test_list_has_no_own_device(hass: HomeAssistant, setup) -> None:  # noqa: F811
    listing = await async_list_devices(hass, setup)
    assert all(d["name"] != "Device Panel" for d in listing["devices"])


async def test_identifiers_with_more_than_two_parts(hass: HomeAssistant, setup) -> None:  # noqa: F811
    """Eine Integration mit dreiteiliger Kennung (Shelly) liess die Einrichtung scheitern: "too many values to unpack"."""
    from custom_components.device_panel.devices import async_device_detail, candidate_devices

    device = _device(hass, "Shelly")
    dr.async_get(hass).async_update_device(device.id, merge_identifiers={("shelly", "abc", "extra")})
    _entity(hass, device, "switch", "s", "on")
    assert [d.id for d, _ in candidate_devices(hass)] == [device.id]
    await _refresh(hass)
    assert _state(hass, "active") == "1"
    detail = await async_device_detail(hass, device.id)
    assert any(x.startswith("shelly: abc") for x in detail["identifiers"])
