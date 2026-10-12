"""Magic Push: Verhalten über einen Neustart von Home Assistant (laufende Dauer, Wiederholung, Wartezeit, nicht erreichbar)."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_mock_service

from custom_components.device_panel import magic
from custom_components.device_panel.const import DATA_MAGIC

from .test_magic import _rule, _sensor, _tick
from .test_outage_notify import _device, _options, setup  # noqa: F401  (Fixture "setup")

TEMP = {"device_class": "temperature", "unit_of_measurement": "°C"}


async def _restart(hass: HomeAssistant) -> magic.MagicPush:
    """Engine anhalten (schreibt den Stand) und eine frische aus dem Speicher starten, wie nach einem Neustart."""
    await hass.data[DATA_MAGIC].async_stop()
    fresh = magic.MagicPush(hass)
    await fresh.async_start()
    await hass.async_block_till_done()
    hass.data[DATA_MAGIC] = fresh
    return fresh


async def test_duration_continues_after_restart(hass: HomeAssistant, setup, freezer, hass_storage: dict[str, Any]) -> None:  # noqa: F811
    """Dauer 10 Min.: 6 Min. gelaufen, Neustart, die restlichen 4 Min. zählen; es kommt genau eine Meldung."""
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klima")
    temp = _sensor(hass, device, "temp", "20", "temperature", "°C")
    await hass.data[DATA_MAGIC].async_save_rule(_rule(device, temp, for_s=600))
    hass.states.async_set(temp, "11", TEMP)
    await _tick(hass, freezer, 360)
    assert calls == []
    await _restart(hass)
    await _tick(hass, freezer, 200)
    assert calls == []
    await _tick(hass, freezer, 41)
    assert len(calls) == 1
    await hass.data[DATA_MAGIC].async_stop()


async def test_repeat_continues_after_restart(hass: HomeAssistant, setup, freezer, hass_storage: dict[str, Any]) -> None:  # noqa: F811
    """Wiederholung alle 10 Min.: nach dem Neustart im alten Takt, keine zusätzliche Meldung beim Start."""
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klima")
    temp = _sensor(hass, device, "temp", "20", "temperature", "°C")
    await hass.data[DATA_MAGIC].async_save_rule(_rule(device, temp, for_s=0, repeat_s=600))
    hass.states.async_set(temp, "11", TEMP)
    await _tick(hass, freezer, 0)
    assert len(calls) == 1
    await _tick(hass, freezer, 300)
    await _restart(hass)
    assert len(calls) == 1
    await _tick(hass, freezer, 250)
    assert len(calls) == 1
    await _tick(hass, freezer, 60)
    assert len(calls) == 2
    await hass.data[DATA_MAGIC].async_stop()


async def test_reset_wait_restarts_after_restart(hass: HomeAssistant, setup, freezer, hass_storage: dict[str, Any]) -> None:  # noqa: F811
    """Die Wartezeit zum Zurücksetzen (2.17.0) liegt nur im Speicher: nach dem Neustart beginnt sie von vorn, nichts geht verloren."""
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klima")
    temp = _sensor(hass, device, "temp", "20", "temperature", "°C")
    await hass.data[DATA_MAGIC].async_save_rule(_rule(device, temp, for_s=0, reset_for_s=300, recover=True, recover_message="normal"))
    hass.states.async_set(temp, "11", TEMP)
    await _tick(hass, freezer, 0)
    hass.states.async_set(temp, "20", TEMP)
    await _tick(hass, freezer, 100)  # Wartezeit läuft
    assert len(calls) == 1
    await _restart(hass)
    await _tick(hass, freezer, 250)  # alte Wartezeit wäre um 200 s später fällig; neu: 300 s ab Start
    assert len(calls) == 1
    await _tick(hass, freezer, 60)
    assert len(calls) == 2 and calls[1].data["title"] == "normal"
    await hass.data[DATA_MAGIC].async_stop()


async def test_unavailable_after_start_changes_nothing(hass: HomeAssistant, setup, freezer, hass_storage: dict[str, Any]) -> None:  # noqa: F811
    """Beim Start sind Entitäten oft noch "unavailable": weder zurücksetzen noch erneut melden; erst der echte Wert entscheidet."""
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klima")
    temp = _sensor(hass, device, "temp", "20", "temperature", "°C")
    rule = await hass.data[DATA_MAGIC].async_save_rule(_rule(device, temp, for_s=0, recover=True, recover_message="normal"))
    hass.states.async_set(temp, "11", TEMP)
    await _tick(hass, freezer, 0)
    assert len(calls) == 1
    hass.states.async_set(temp, "unavailable", TEMP)  # Zustand beim Start
    await hass.async_block_till_done()
    fresh = await _restart(hass)
    assert len(calls) == 1 and fresh.runtime(rule["id"])["fired"] is True
    hass.states.async_set(temp, "11", TEMP)  # wieder da, Bedingung gilt weiter: keine zweite Meldung
    await _tick(hass, freezer, 0)
    assert len(calls) == 1
    hass.states.async_set(temp, "20", TEMP)
    await _tick(hass, freezer, 0)
    assert len(calls) == 2 and calls[1].data["title"] == "normal"
    await fresh.async_stop()


async def test_recovered_while_down_reports_back_to_normal(hass: HomeAssistant, setup, freezer, hass_storage: dict[str, Any]) -> None:  # noqa: F811
    """War die Meldung raus und ist der Wert nach dem Neustart wieder normal, kommt "wieder normal" beim Start."""
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klima")
    temp = _sensor(hass, device, "temp", "20", "temperature", "°C")
    await hass.data[DATA_MAGIC].async_save_rule(_rule(device, temp, for_s=0, recover=True, recover_message="normal"))
    hass.states.async_set(temp, "11", TEMP)
    await _tick(hass, freezer, 0)
    assert len(calls) == 1
    await hass.data[DATA_MAGIC].async_stop()
    hass.states.async_set(temp, "20", TEMP)  # während HA aus war
    fresh = magic.MagicPush(hass)
    await fresh.async_start()
    await hass.async_block_till_done()
    fresh._resync()  # wie nach "gestartet"
    await hass.async_block_till_done()
    hass.data[DATA_MAGIC] = fresh
    assert len(calls) == 2 and calls[1].data["title"] == "normal"
    await fresh.async_stop()
