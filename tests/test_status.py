"""Status-App (2.62.0): Einstufung, Lebenszeichen der Teile, überfällige Routinen, Push bei Stillstand und Rückkehr, Befehl."""

from __future__ import annotations

import time
from datetime import timedelta
from typing import Any

import pytest
from homeassistant.core import HomeAssistant, callback
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed, async_mock_service

from custom_components.device_panel import status
from custom_components.device_panel.const import DATA_AVAILABILITY, DATA_ROUTINES, DATA_STATUS, DOMAIN


@pytest.fixture(autouse=True)
async def _de(hass: HomeAssistant) -> None:
    hass.config.language = "de"


async def _setup(hass: HomeAssistant, **options: Any) -> status.StatusWatch:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options={"notify_service": "notify.handy", **options})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return hass.data[DATA_STATUS]


def test_classify_scales_with_the_interval() -> None:
    # Takt 30 s: verspätet ab 2 Min., steht ab 5 Min.; Takt 60 s: ab 4 und 10 Min.
    assert [status.classify(a, 30) for a in (60, 121, 301)] == ["ok", "late", "down"]
    assert [status.classify(a, 60) for a in (200, 241, 601)] == ["ok", "late", "down"]


async def test_snapshot_lists_all_parts_ok_after_start(hass: HomeAssistant) -> None:
    watch = await _setup(hass)
    snap = watch.snapshot()
    assert [p["id"] for p in snap["parts"]] == list(status.ORDER)
    assert snap["problems"] == 0 and snap["down"] == 0 and snap["routines_loaded"] == 0 and snap["routines_missed"] == 0


async def test_stale_tick_is_late_then_down_and_back(hass: HomeAssistant) -> None:
    watch = await _setup(hass)
    now = time.time()
    hass.data[DATA_AVAILABILITY].last_tick = now - 150
    assert next(p for p in watch.evaluate(now) if p["id"] == "availability")["state"] == "late"
    hass.data[DATA_AVAILABILITY].last_tick = now - 400
    assert next(p for p in watch.evaluate(now) if p["id"] == "availability")["state"] == "down"
    hass.data[DATA_AVAILABILITY].last_tick = now
    assert next(p for p in watch.evaluate(now) if p["id"] == "availability")["state"] == "ok"


async def test_missing_manager_counts_as_down(hass: HomeAssistant) -> None:
    watch = await _setup(hass)
    hass.data.pop(DATA_ROUTINES)
    assert next(p for p in watch.evaluate(time.time()) if p["id"] == "routines")["state"] == "down"


async def test_overdue_routine_is_flagged(hass: HomeAssistant) -> None:
    from .test_outage_notify import _device
    from .test_routines import _raw, _switch

    watch = await _setup(hass)
    manager = hass.data[DATA_ROUTINES]
    device = _device(hass, "Steckdose")
    saved = await manager.async_save_routine(_raw(device, _switch(hass, device), delay_s=600))
    manager.runtime(saved["id"])["due"] = time.time() - 400
    # überfällig, aber der Wächter läuft erst seit Kurzem: gemessen ab seinem Start, also noch nicht gemeldet
    assert next(p for p in watch.evaluate(time.time()) if p["id"] == "routines")["state"] == "ok"
    watch.started -= 3600
    part = next(p for p in watch.evaluate(time.time()) if p["id"] == "routines")
    assert part["state"] == "down" and part["age_s"] >= 400 and part["loaded"] == 1
    await manager.async_set_enabled(saved["id"], False)
    assert next(p for p in watch.evaluate(time.time()) if p["id"] == "routines")["state"] == "ok"


async def _stall(hass: HomeAssistant, watch: status.StatusWatch) -> None:
    hass.data[DATA_AVAILABILITY].last_tick = time.time() - 1200


async def test_push_on_down_after_two_checks_and_on_recovery(hass: HomeAssistant, freezer) -> None:
    from custom_components.device_panel import activity

    handy = async_mock_service(hass, "notify", "handy")
    watch = await _setup(hass)
    await _stall(hass, watch)
    watch._on_tick(None)
    await hass.async_block_till_done()
    assert handy == []  # beim ersten Prüfen nur vermerkt (Stocken von HA)
    watch._on_tick(None)
    await hass.async_block_till_done()
    assert len(handy) == 1 and handy[0].data["title"] == "⚠️ Device Panel: Ausfall-Überwachung steht"
    assert "Min. kein Lebenszeichen" in handy[0].data["message"]
    watch._on_tick(None)
    await hass.async_block_till_done()
    assert len(handy) == 1  # nur einmal je Störung
    assert any(e["text"].startswith("Steht:") for e in activity.get(hass).entries)
    hass.data[DATA_AVAILABILITY].last_tick = time.time()
    watch._on_tick(None)
    await hass.async_block_till_done()
    assert len(handy) == 2 and handy[1].data["title"] == "✅ Device Panel: Ausfall-Überwachung läuft wieder"
    assert handy[0].data["data"]["tag"] == handy[1].data["data"]["tag"]


async def test_push_off_and_own_target(hass: HomeAssistant) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    status_target = async_mock_service(hass, "notify", "wache")
    watch = await _setup(hass, status_notify=False)
    await _stall(hass, watch)
    for _ in range(3):
        watch._on_tick(None)
    await hass.async_block_till_done()
    assert handy == [] and status_target == []
    # eingeschaltet, eigenes Ziel: geht dorthin, nicht an das globale
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    hass.config_entries.async_update_entry(entry, options={**entry.options, "status_notify": True, "notify_service_status": "notify.wache"})
    await hass.async_block_till_done()
    watch._alerted.clear()
    watch._suspect.clear()
    for _ in range(2):
        watch._on_tick(None)
    await hass.async_block_till_done()
    assert handy == [] and len(status_target) >= 1


async def test_no_push_without_target(hass: HomeAssistant) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    watch = await _setup(hass, notify_service="none")
    await _stall(hass, watch)
    for _ in range(2):
        watch._on_tick(None)
    await hass.async_block_till_done()
    assert handy == []


async def test_websocket_and_header_summary(hass: HomeAssistant, hass_ws_client) -> None:
    watch = await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/status_get"})
    got = (await client.receive_json())["result"]
    assert got["problems"] == 0 and len(got["parts"]) == len(status.ORDER) and got["started"] == watch.started
    await _stall(hass, watch)
    assert watch.summary() == {"problems": 1, "down": 1}
    # list_devices trägt die Zahlen und den Debug-Schalter für die Kopfzeile
    await client.send_json({"id": 2, "type": f"{DOMAIN}/list_devices"})
    result = (await client.receive_json())["result"]
    assert result["status"] == {"problems": 1, "down": 1} and result["debug"] is False


async def test_watch_ticks_by_itself(hass: HomeAssistant, freezer) -> None:
    watch = await _setup(hass)
    calls = []
    watch._on_tick = callback(lambda now: calls.append(now))  # type: ignore[method-assign]
    await watch.async_stop()
    await watch.async_start()
    freezer.tick(timedelta(seconds=61))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert len(calls) == 1
