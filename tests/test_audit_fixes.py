"""Korrekturen aus dem Prüfbericht (2.74.0): hängender Schaltbefehl, Push-Rückfall, Zeitzone der Status-Meldung, doppelte Textschlüssel."""

from __future__ import annotations

import asyncio
import re
from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import async_fire_time_changed, async_mock_service

from custom_components.device_panel import push, status
from custom_components.device_panel.const import DATA_ROUTINES

from .test_outage_notify import _device, setup  # noqa: F401  (Fixture "setup")
from .test_routines import _raw, _switch, _zurich  # noqa: F401  (Fixture "_zurich")
from .test_status import _de, _load_sensors, _setup, _ticks  # noqa: F401  (Fixture "_de")

STRINGS_JS = Path(__file__).parent.parent / "custom_components" / "device_panel" / "panel" / "strings.js"


# -- Routinen: ein hängender Schaltbefehl lässt andere nicht "verpasst" werden ---------------------


async def test_hanging_call_delays_but_does_not_miss_other_routine(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    gate = asyncio.Event()
    calls: list[str] = []

    async def turn_on(call: ServiceCall) -> None:
        calls.append(call.data["entity_id"])
        if len(calls) == 1:
            await gate.wait()  # das erste Gerät antwortet nicht (zum Beispiel eine Cloud-Integration)

    hass.services.async_register("switch", "turn_on", turn_on)
    manager = hass.data[DATA_ROUTINES]
    dev_a, dev_b = _device(hass, "A"), _device(hass, "B")
    a, b = _switch(hass, dev_a, "a"), _switch(hass, dev_b, "b")
    first = await manager.async_save_routine(_raw(dev_a, a, delay_s=60, name="A"))
    second = await manager.async_save_routine(_raw(dev_b, b, delay_s=60, name="B"))
    await hass.async_block_till_done()
    freezer.tick(timedelta(seconds=61))
    async_fire_time_changed(hass)
    for _ in range(20):
        await asyncio.sleep(0)
    # Beide Routinen sind zur selben Sekunde fällig; welche zuerst die Sperre bekommt, ist offen (gleicher Zeitpunkt). Die andere wartet auf die Sperre.
    assert len(calls) == 1 and calls[0] in (a, b)
    # A hängt länger als die Nachholzeit (Standard 10 Minuten): B darf deshalb nicht als verpasst gelten
    freezer.tick(timedelta(minutes=15))
    gate.set()
    await hass.async_block_till_done()
    assert sorted(calls) == sorted([a, b])
    assert manager.runtime(first["id"])["last"]["what"] == "run"
    assert manager.runtime(second["id"])["last"]["what"] == "run"


async def test_really_late_routine_is_still_missed(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    """Wer wegen Ausfall von Home Assistant zu spät dran ist, gilt weiter als verpasst (die Verspätung zählt ab dem Zeitgeber)."""
    on = async_mock_service(hass, "switch", "turn_on")
    manager = hass.data[DATA_ROUTINES]
    device = _device(hass, "A")
    plug = _switch(hass, device, "a")
    saved = await manager.async_save_routine(_raw(device, plug, delay_s=60))
    rt = manager.runtime(saved["id"])
    rt["due"] = rt["due"] - 3600  # vor einer Stunde fällig, nichts geschah
    await manager._async_process(saved["id"])
    assert on == [] and rt["last"]["what"] == "missed"


# -- Push: zweiter Versuch ohne Zusatzdaten nur bei abgelehnten Daten -----------------------------


async def test_transient_error_is_retried_with_the_same_data(hass: HomeAssistant, monkeypatch) -> None:
    monkeypatch.setattr(push, "RETRY_DELAY_S", 0)
    received: list[dict[str, Any]] = []

    async def handler(call: ServiceCall) -> None:
        if not received and not hasattr(handler, "failed"):
            handler.failed = True  # type: ignore[attr-defined]
            raise HomeAssistantError("Zeitüberschreitung")
        received.append(dict(call.data))

    hass.services.async_register("notify", "handy", handler)
    assert await push.async_push(hass, "notify.handy", "Titel", "Text", {"tag": "x", "url": "/device-panel"})
    assert received == [{"title": "Titel", "message": "Text", "data": {"tag": "x", "url": "/device-panel"}}]


async def test_rejected_data_still_gets_plain_message(hass: HomeAssistant, monkeypatch) -> None:
    monkeypatch.setattr(push, "RETRY_DELAY_S", 0)
    received: list[dict[str, Any]] = []

    async def handler(call: ServiceCall) -> None:
        if "data" in call.data:
            raise ValueError("extra keys not allowed")
        received.append(dict(call.data))

    hass.services.async_register("notify", "mail", handler)
    assert await push.async_push(hass, "notify.mail", "Titel", "Text", {"tag": "x"})
    assert received == [{"title": "Titel", "message": "Text"}]


async def test_two_transient_errors_fall_back_to_plain_as_last_resort(hass: HomeAssistant, monkeypatch) -> None:
    monkeypatch.setattr(push, "RETRY_DELAY_S", 0)
    seen: list[bool] = []

    async def handler(call: ServiceCall) -> None:
        seen.append("data" in call.data)
        if "data" in call.data:
            raise HomeAssistantError("nicht erreichbar")

    hass.services.async_register("notify", "handy", handler)
    assert await push.async_push(hass, "notify.handy", "Titel", "Text", {"tag": "x"})
    assert seen == [True, True, False]


# -- Status-Meldung: Uhrzeit in der Zeitzone von Home Assistant -----------------------------------


async def test_status_load_push_uses_the_home_assistant_time_zone(hass: HomeAssistant, freezer) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    await hass.config.async_set_time_zone("Pacific/Auckland")
    ids = _load_sensors(hass)
    watch = await _setup(hass)
    handy.clear()
    hass.states.async_set(ids["cpu"], "99", {"unit_of_measurement": "%"})
    _ticks(watch, 3)
    await hass.async_block_till_done()
    assert len(handy) == 1
    expected = dt_util.now().strftime("%H:%M")
    assert handy[0].data["message"].endswith(f"· {expected}")
    assert dt_util.now().utcoffset() != timedelta(0)  # die Zeitzone gilt wirklich (nicht UTC)


# -- Texte: keine doppelten Schlüssel (der spätere überdeckt den früheren stillschweigend) -------


def test_strings_have_no_duplicate_keys() -> None:
    blocks = re.split(r"^  (?:de|en): \{$", STRINGS_JS.read_text(encoding="utf-8"), flags=re.M)[1:]
    assert len(blocks) == 2
    for lang, block in zip(("de", "en"), blocks, strict=True):
        body = block.split("\n  },", 1)[0]
        keys = re.findall(r"^    ([A-Za-z0-9_]+):", body, flags=re.M)
        dupes = sorted({k for k in keys if keys.count(k) > 1})
        assert not dupes, f"{lang}: doppelte Schlüssel {dupes}"
