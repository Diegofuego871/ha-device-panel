"""Ausfälle und Rückkehr pro Integration zusammenfassen (2.94.0): Sammelzeit, Schwelle, einzelne Geräte, Rückkehrer."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_mock_service

from tests.test_outage import _device, _entity, _options, _tick, setup  # noqa: F401


async def _done(hass: HomeAssistant) -> None:
    await hass.async_block_till_done(wait_background_tasks=True)


def _fleet(hass: HomeAssistant, domain: str, names: list[str]) -> list[str]:
    return [_entity(hass, _device(hass, name, domain=domain), "light", "l", "on") for name in names]


def _down(hass: HomeAssistant, lights: list[str]) -> None:
    for light in lights:
        hass.states.async_set(light, "unavailable")


def _up(hass: HomeAssistant, lights: list[str]) -> None:
    for light in lights:
        hass.states.async_set(light, "on")


def _titles(calls: list[Any]) -> list[str]:
    return [c.data["title"] for c in calls]


async def test_one_message_per_integration(hass: HomeAssistant, setup, freezer) -> None:
    """Zwei Integrationen fallen zugleich aus: je eine Meldung; eine dritte mit nur zwei Geräten bleibt bei Einzelmeldungen."""
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy", notify_outage=True)
    zha = _fleet(hass, "zha", ["Z1", "Z2", "Z3"])
    hue = _fleet(hass, "hue", ["H1", "H2", "H3", "H4"])
    few = _fleet(hass, "mqtt", ["M1", "M2"])
    setup.evaluate()
    _down(hass, zha + hue + few)
    await _tick(hass, setup, freezer, 3)
    # Die Gruppen warten auf weitere Geräte, die beiden einzelnen gehen sofort
    assert sorted(_titles(calls)) == ["🔴 Offline: M1", "🔴 Offline: M2"]
    await _tick(hass, setup, freezer, 1.1)
    await _done(hass)
    titles = _titles(calls)
    assert "🚨 Zigbee Home Automation: 3 devices offline" in titles
    assert "🚨 Philips Hue: 4 devices offline" in titles
    assert len(calls) == 4
    tags = {c.data["data"]["tag"] for c in calls[2:]}
    assert tags == {"device_panel_incident_zha", "device_panel_incident_hue"}


async def test_threshold_is_an_option(hass: HomeAssistant, setup, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy", notify_outage=True, notify_group_min=2)
    lights = _fleet(hass, "zha", ["Z1", "Z2"])
    setup.evaluate()
    _down(hass, lights)
    await _tick(hass, setup, freezer, 3)
    assert calls == []
    await _tick(hass, setup, freezer, 1.1)
    await _done(hass)
    assert _titles(calls) == ["🚨 Zigbee Home Automation: 2 devices offline"]


async def test_single_device_is_not_delayed(hass: HomeAssistant, setup, freezer) -> None:
    """Ein einzelnes Gerät einer Integration wartet nicht auf eine Sammelzeit."""
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy", notify_outage=True)
    lights = _fleet(hass, "zha", ["Z1", "Z2", "Z3"])
    setup.evaluate()
    _down(hass, lights[:1])
    await _tick(hass, setup, freezer, 3)
    assert _titles(calls) == ["🔴 Offline: Z1"]


async def test_long_list_is_shortened(hass: HomeAssistant, setup, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy", notify_outage=True)
    lights = _fleet(hass, "zha", [f"Z{i}" for i in range(9)])
    setup.evaluate()
    _down(hass, lights)
    await _tick(hass, setup, freezer, 3)
    await _tick(hass, setup, freezer, 1.1)
    await _done(hass)
    assert len(calls) == 1
    assert calls[0].data["title"].endswith(": 9 devices offline")
    assert calls[0].data["message"].startswith("Z0, Z1, Z2, Z3, Z4, Z5 and 3 more · since ")


async def test_returns_are_combined(hass: HomeAssistant, setup, freezer) -> None:
    """Rückkehr: kommen die Geräte nacheinander zurück, steht am Ende eine Meldung; bleibt eines weg, kommt sie nach der Sammelzeit."""
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy", notify_outage=True, notify_online=True)
    lights = _fleet(hass, "zha", ["Z1", "Z2", "Z3", "Z4"])
    setup.evaluate()
    _down(hass, lights)
    await _tick(hass, setup, freezer, 3)
    await _tick(hass, setup, freezer, 1.1)
    await _done(hass)
    assert len(calls) == 1
    # Zwei kommen zurück, zwei fehlen noch: gewartet
    _up(hass, lights[:2])
    await _tick(hass, setup, freezer, 0.2)
    assert len(calls) == 1
    # Ein weiteres kommt in der Sammelzeit dazu: noch immer gewartet (eines fehlt)
    _up(hass, lights[2:3])
    await _tick(hass, setup, freezer, 0.2)
    assert len(calls) == 1
    # Das letzte kommt: eine Meldung für alle vier, gleicher Tag wie der Ausfall
    _up(hass, lights[3:])
    await _tick(hass, setup, freezer, 0.2)
    await _done(hass)
    assert len(calls) == 2
    assert calls[1].data["title"] == "🟢 Zigbee Home Automation: 4 devices back online"
    assert calls[1].data["data"]["tag"] == calls[0].data["data"]["tag"]


async def test_return_waits_only_one_window(hass: HomeAssistant, setup, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy", notify_outage=True, notify_online=True)
    lights = _fleet(hass, "zha", ["Z1", "Z2", "Z3", "Z4"])
    setup.evaluate()
    _down(hass, lights)
    await _tick(hass, setup, freezer, 3)
    await _tick(hass, setup, freezer, 1.1)
    await _done(hass)
    _up(hass, lights[:3])
    await _tick(hass, setup, freezer, 0.2)
    assert len(calls) == 1
    # Eines bleibt weg: nach der Sammelzeit kommt die Meldung für die drei Zurückgekehrten
    await _tick(hass, setup, freezer, 1.2)
    await _done(hass)
    assert len(calls) == 2
    assert calls[1].data["title"] == "🟢 Zigbee Home Automation: 3 devices back online"


async def test_straggler_is_sent_alone(hass: HomeAssistant, setup, freezer) -> None:
    """Fällt nach der Gruppen-Meldung ein weiteres Gerät derselben Integration aus, kommt es einzeln."""
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy", notify_outage=True)
    lights = _fleet(hass, "zha", ["Z1", "Z2", "Z3", "Z4"])
    setup.evaluate()
    _down(hass, lights[:3])
    await _tick(hass, setup, freezer, 3)
    await _tick(hass, setup, freezer, 1.1)
    await _done(hass)
    assert len(calls) == 1
    _down(hass, lights[3:])
    await _tick(hass, setup, freezer, 3)
    await _tick(hass, setup, freezer, 1.1)
    await _done(hass)
    # Vier Geräte der Integration sind jetzt offline und eines ist neu fällig: ein einzelnes Gerät bildet keine Gruppe
    assert _titles(calls)[1:] == ["🔴 Offline: Z4"]
