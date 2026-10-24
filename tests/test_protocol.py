"""Protokoll (2.104.0): Speicher mit Obergrenzen, Einträge von Magic Push und Routinen (mit Trace), Abfrage, Löschen, Befehl."""

from __future__ import annotations

import time
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_mock_service

from custom_components.device_panel import protocol, routines
from custom_components.device_panel.const import DATA_MAGIC, DATA_PROTOCOL, DATA_ROUTINES, DOMAIN

from .test_magic import _rule, _sensor, _tick
from .test_outage_notify import _device, _options, setup  # noqa: F401  (Fixture "setup")
from .test_routines import _raw, _switch, _zurich  # noqa: F401  (Fixture "_zurich")

DAY = 86400


@pytest.fixture(autouse=True)
def _no_gap(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(routines, "CALL_GAP_S", 0)


# -- Speicher -------------------------------------------------------------------------------------


def test_clean_entry_shortens_and_drops_empty() -> None:
    entry = protocol.clean_entry({"at": 5.0, "k": "fired", "title": "x" * 500, "body": "y" * 2000, "err": None, "value": "", "trace": []})
    assert len(entry["title"]) == protocol.TITLE_MAX and entry["title"].endswith("…")
    assert len(entry["body"]) == protocol.BODY_MAX
    assert set(entry) == {"at", "k", "title", "body"}


async def test_add_trims_by_count_not_by_age(hass: HomeAssistant, setup) -> None:  # noqa: F811
    await _options(hass, protocol_max_entries=100)
    log = hass.data[DATA_PROTOCOL]
    now = time.time()
    # Seit 2.105.0 gibt es keine Zeitgrenze: auch ein Eintrag von vor drei Jahren bleibt, solange Platz ist
    log.add("a", {"at": now - 1100 * DAY, "k": "fired", "title": "alt"})
    for i in range(120):
        log.add("a", {"at": now - 1000 + i, "k": "fired", "title": str(i)})
    assert len(log.entries("a")) == 100 and log.entries("a")[0]["title"] == "20" and log.entries("a")[-1]["title"] == "119"
    # eine andere Meldung hat ihre eigene Zahl
    log.add("b", {"at": now, "k": "fired", "title": "b"})
    assert len(log.entries("b")) == 1
    # tiefere Grenze: kürzt sofort, bei allen
    hass.config_entries.async_update_entry(hass.config_entries.async_entries(DOMAIN)[0], options={**hass.config_entries.async_entries(DOMAIN)[0].options, "protocol_max_entries": 100})
    log.enforce()
    assert len(log.entries("a")) == 100


async def test_size_limit_drops_oldest_across_items(hass: HomeAssistant, setup) -> None:  # noqa: F811
    await _options(hass, protocol_max_mb=1)
    log = hass.data[DATA_PROTOCOL]
    now = time.time()
    big = "x" * 790
    # a und b teilen sich 1 MB: je Eintrag rund 0,9 KB, zusammen weit mehr als 1 MB
    for i in range(1500):
        log.add("a" if i % 2 == 0 else "b", {"at": now - 5000 + i, "k": "fired", "title": f"t{i}", "body": big, "value": "v"})
    usage = log.usage()
    assert usage["bytes"] <= 1024 * 1024 and usage["entries"] < 1500 and usage["items"] == 2
    # der älteste Eintrag über alle fällt zuerst weg: beide Meldungen verlieren vom Anfang, die neuesten bleiben
    assert log.entries("a")[-1]["title"] == "t1498" and log.entries("b")[-1]["title"] == "t1499"
    first_a, first_b = log.entries("a")[0]["at"], log.entries("b")[0]["at"]
    assert abs(first_a - first_b) < 5
    # eine kleinere Grenze wirkt auch ohne neuen Eintrag, wenn enforce() aufgerufen wird (so tut es die Einstellung)
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    hass.config_entries.async_update_entry(entry, options={**entry.options, "protocol_max_mb": 1})
    before = log.usage()["bytes"]
    log.enforce()
    assert log.usage()["bytes"] == before


async def test_options_change_shrinks_immediately(hass: HomeAssistant, setup) -> None:  # noqa: F811
    log = hass.data[DATA_PROTOCOL]
    now = time.time()
    for i in range(300):
        log.add("a", {"at": now - 1000 + i, "k": "fired", "title": str(i), "body": "y" * 500})
    assert len(log.entries("a")) == 300
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    hass.config_entries.async_update_entry(entry, options={**entry.options, "protocol_max_entries": 100, "log_max_entries": 100})
    await hass.async_block_till_done()
    # der Listener der Integration wendet die neuen Grenzen an
    assert len(log.entries("a")) == 100 and log.entries("a")[-1]["title"] == "299"


async def test_persists_and_forgets(hass: HomeAssistant, hass_storage: dict[str, Any]) -> None:
    log = protocol.Protocol(hass)
    log.add("abc", {"k": "fired", "title": "Hallo"})
    await log._store("abc").async_save({"entries": log.entries("abc")})  # was die Verzögerung später schreibt
    await log._index.async_save({"ids": ["abc"]})
    again = protocol.Protocol(hass)
    await again.async_load()
    assert again.entries("abc")[0]["title"] == "Hallo"
    await again.async_prune({"other"})
    assert again.entries("abc") == [] and "device_panel.protocol_abc" not in hass_storage
    await again.async_remove_all()


async def test_load_ignores_garbage(hass: HomeAssistant, hass_storage: dict[str, Any]) -> None:
    hass_storage[protocol.INDEX_KEY] = {"version": 1, "key": protocol.INDEX_KEY, "data": {"ids": ["ok", 5, None]}}
    hass_storage["device_panel.protocol_ok"] = {"version": 1, "key": "device_panel.protocol_ok", "data": {"entries": [{"at": 1.0}, {"at": "x"}, 7, {"k": "x"}]}}
    log = protocol.Protocol(hass)
    await log.async_load()
    assert log.entries("ok") == [{"at": 1.0}]


def test_query_counts_buckets_and_filters(hass: HomeAssistant) -> None:
    log = protocol.Protocol(hass)
    now = time.time()
    log.add("r", {"at": now - 3 * DAY, "k": "fired", "res": "sent", "title": "Keller kalt", "body": "Klimasensor"})
    log.add("r", {"at": now - 2 * DAY, "k": "recovered", "res": "sent", "title": "Wieder warm", "dur": 600})
    log.add("r", {"at": now - 1 * DAY, "k": "fired", "res": "failed", "err": "no_target"})
    log.add("r", {"at": now - 60 * DAY, "k": "fired", "res": "sent"})
    out = log.query("magic", {"r": "Keller"}, since=now - 7 * DAY, until=now)
    assert out["all"] == 3 and out["total"] == 3 and out["longest_s"] == 600 and out["step"] == "day"
    assert [e["k"] for e in out["entries"]] == ["fired", "recovered", "fired"]  # neueste zuerst
    assert sum(b["n"] for b in out["buckets"]) == 3 and sum(b["bad"] for b in out["buckets"]) == 1
    assert out["oldest"] < now - 59 * DAY
    assert log.query("magic", {"r": "Keller"}, since=now - 7 * DAY, until=now, filter_="failed")["total"] == 1
    assert log.query("magic", {"r": "Keller"}, since=now - 7 * DAY, until=now, text="warm")["total"] == 1
    assert log.query("magic", {"r": "Keller"}, since=now - 7 * DAY, until=now, limit=1, offset=2)["entries"][0]["res"] == "sent"
    # langer Zeitraum: je Woche
    long = log.query("magic", {"r": "Keller"}, since=now - 300 * DAY, until=now)
    assert long["step"] == "week" and len(long["buckets"]) < 60 and sum(b["n"] for b in long["buckets"]) == 4


# -- Magic Push -----------------------------------------------------------------------------------


async def test_magic_push_writes_entries(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    hass.config.language = "de"
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klimasensor Keller")
    attrs = {"device_class": "temperature", "unit_of_measurement": "°C"}
    temp = _sensor(hass, device, "temp", "14.2", "temperature", "°C")
    rule = await hass.data[DATA_MAGIC].async_save_rule(_rule(device, temp, recover=True, recover_message="Wieder warm: {value} {unit}"))
    hass.states.async_set(temp, "11.5", attrs)
    await _tick(hass, freezer, 601)
    hass.states.async_set(temp, "12.6", attrs)
    await hass.async_block_till_done()
    assert len(calls) == 2
    first, second = hass.data[DATA_PROTOCOL].entries(rule["id"])
    assert first["k"] == "fired" and first["res"] == "sent" and first["title"] == calls[0].data["title"] and first["body"] == calls[0].data["message"]
    assert first["value"] == "11,5 °C" and first["target"] == "notify.handy"
    assert second["k"] == "recovered" and second["dur"] >= 600
    # Test einer gespeicherten Meldung wird als Test vermerkt, ein Entwurf (ohne Id) gar nicht
    draft = _rule(device, temp, recover=True, recover_message="Wieder warm: {value} {unit}")
    await hass.data[DATA_MAGIC].async_test({**draft, "id": rule["id"]})
    assert hass.data[DATA_PROTOCOL].entries(rule["id"])[-1]["k"] == "test"
    n = len(hass.data[DATA_PROTOCOL].entries(rule["id"]))
    await hass.data[DATA_MAGIC].async_test(draft)
    assert len(hass.data[DATA_PROTOCOL].entries(rule["id"])) == n


async def test_magic_push_failed_and_no_target(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    await _options(hass, notify_service="notify.handy")  # der Dienst existiert nicht
    device = _device(hass, "Klimasensor Keller")
    temp = _sensor(hass, device, "temp", "14.2", "temperature", "°C")
    rule = await hass.data[DATA_MAGIC].async_save_rule(_rule(device, temp, for_s=0))
    hass.states.async_set(temp, "10", {"device_class": "temperature", "unit_of_measurement": "°C"})
    await hass.async_block_till_done()
    entry = hass.data[DATA_PROTOCOL].entries(rule["id"])[0]
    assert entry["res"] == "failed" and entry["err"]
    await _options(hass, notify_service="none")
    other = await hass.data[DATA_MAGIC].async_save_rule(_rule(device, temp, name="Zweite", for_s=0))
    hass.states.async_set(temp, "9", {"device_class": "temperature", "unit_of_measurement": "°C"})
    await hass.async_block_till_done()
    assert hass.data[DATA_PROTOCOL].entries(other["id"])[0]["res"] == "no_target"


async def test_delete_rule_removes_protocol(hass: HomeAssistant, setup) -> None:  # noqa: F811
    async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klimasensor Keller")
    temp = _sensor(hass, device, "temp", "14.2", "temperature", "°C")
    rule = await hass.data[DATA_MAGIC].async_save_rule(_rule(device, temp, for_s=0))
    hass.states.async_set(temp, "10", {"device_class": "temperature", "unit_of_measurement": "°C"})
    await hass.async_block_till_done()
    assert hass.data[DATA_PROTOCOL].entries(rule["id"])
    await hass.data[DATA_MAGIC].async_delete_rule(rule["id"])
    assert hass.data[DATA_PROTOCOL].entries(rule["id"]) == []


# -- Routinen -------------------------------------------------------------------------------------


async def test_routine_run_writes_trace(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    async_mock_service(hass, "switch", "turn_on")
    async_mock_service(hass, "switch", "turn_off")
    async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    manager = hass.data[DATA_ROUTINES]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    saved = await manager.async_save_routine(_raw(device, plug, push=True, back_s=300))
    await _tick(hass, freezer, 601)
    run = hass.data[DATA_PROTOCOL].entries(saved["id"])[0]
    assert run["k"] == "run" and run["src"] == "time" and run["ok"] is True and run["act"] == "on" and run["ent"] == plug
    steps = [s["s"] for s in run["trace"]]
    assert steps == ["trigger", "call", "revert_plan", "notify", "result"]
    call = run["trace"][1]["v"]
    assert call["svc"] == ["switch.turn_on"] and call["ent"] == plug and "ms" in call
    assert run["trace"][2]["v"]["back"] == "off" and run["trace"][3]["v"]["res"] == "sent"
    await _tick(hass, freezer, 301)
    back = hass.data[DATA_PROTOCOL].entries(saved["id"])[1]
    assert back["k"] == "revert" and back["src"] == "revert" and back["trace"][-1]["v"]["what"] == "revert"


async def test_routine_manual_and_failed(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    manager = hass.data[DATA_ROUTINES]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    saved = await manager.async_save_routine(_raw(device, plug))
    async_mock_service(hass, "switch", "turn_on")
    assert await manager.async_run_now(saved["id"]) == (True, None)
    hass.states.async_set(plug, "unavailable")
    assert await manager.async_run_now(saved["id"]) == (False, "unavailable")
    manual, failed = hass.data[DATA_PROTOCOL].entries(saved["id"])
    assert manual["src"] == "manual" and manual["k"] == "run"
    assert failed["k"] == "failed" and failed["err"] == "unavailable" and failed["trace"][1] == {"s": "call", "v": {"ent": plug, "state": "unavailable", "err": "unavailable"}}
    # kein Eintrag zu viel: der Schalttest im Assistenten schreibt nichts
    await manager.async_try(plug, "on")
    assert len(hass.data[DATA_PROTOCOL].entries(saved["id"])) == 2


async def test_delete_routine_removes_protocol(hass: HomeAssistant, setup) -> None:  # noqa: F811
    async_mock_service(hass, "switch", "turn_on")
    manager = hass.data[DATA_ROUTINES]
    device = _device(hass, "Steckdose")
    saved = await manager.async_save_routine(_raw(device, _switch(hass, device)))
    await manager.async_run_now(saved["id"])
    assert hass.data[DATA_PROTOCOL].entries(saved["id"])
    await manager.async_delete_routine(saved["id"])
    assert hass.data[DATA_PROTOCOL].entries(saved["id"]) == []


# -- Befehl ---------------------------------------------------------------------------------------


async def test_websocket_command(hass: HomeAssistant, setup, hass_ws_client, hass_admin_user) -> None:  # noqa: F811
    async_mock_service(hass, "switch", "turn_on")
    manager = hass.data[DATA_ROUTINES]
    device = _device(hass, "Steckdose")
    saved = await manager.async_save_routine(_raw(device, _switch(hass, device)))
    await manager.async_run_now(saved["id"])
    client = await hass_ws_client(hass)

    async def call(**payload: Any) -> dict[str, Any]:
        call.n += 1
        await client.send_json({"id": call.n, "type": f"{DOMAIN}/protocol_get", **payload})
        return await client.receive_json()

    call.n = 0

    async def call_usage() -> dict[str, Any]:
        call.n += 1
        await client.send_json({"id": call.n, "type": f"{DOMAIN}/storage_usage"})
        return await client.receive_json()

    got = (await call(kind="routine", item_id=saved["id"]))["result"]
    assert got["total"] == 1 and got["entries"][0]["trace"] and got["items"][0]["name"] == "Gartenlicht"
    assert got["max_entries"] == 5000 and got["max_mb"] == 30 and "retention_days" not in got
    # ohne "since": alles ab dem ältesten Eintrag
    everything = (await call(kind="routine", item_id=saved["id"]))["result"]
    assert everything["since"] == everything["oldest"]
    usage = (await call_usage())["result"]
    assert usage["protocol"]["entries"] >= 1 and usage["protocol"]["bytes"] > 0 and usage["log"]["entries"] >= 1
    assert set(usage["other"]) == {"states", "ai", "config"} and {"availability", "signal"} <= set(usage)
    by_device = (await call(kind="routine", device_id=device.id, filter="manual"))["result"]
    assert by_device["total"] == 1 and by_device["entries"][0]["id"] == saved["id"]
    assert (await call(kind="routine", device_id=device.id, filter="failed"))["result"]["total"] == 0
    # Zeitraum vor dem Eintrag
    assert (await call(kind="routine", item_id=saved["id"], since=1.0, until=2.0))["result"]["all"] == 0
    assert not (await call(kind="routine", item_id="0" * 12))["success"]
    assert not (await call(kind="magic"))["success"]
    assert not (await call(kind="routine", item_id=saved["id"], limit=0))["success"]
    assert not (await call(kind="x", item_id=saved["id"]))["success"]
    assert not (await call(kind="routine", item_id=saved["id"], device_id=device.id))["success"]


async def test_survives_reload_and_remove_deletes_files(hass: HomeAssistant, setup, hass_storage: dict[str, Any], freezer) -> None:  # noqa: F811
    from datetime import timedelta

    from pytest_homeassistant_custom_component.common import async_fire_time_changed

    hass.data[DATA_PROTOCOL].add("abc123", {"k": "fired", "title": "Hallo"})
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    # Speichern der Einstellungen lädt neu: ausstehende Einträge dürfen nicht verloren gehen
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    # die Integration kennt "abc123" nicht als Meldung oder Routine: beim Start entfernt
    assert hass.data[DATA_PROTOCOL].entries("abc123") == []
    hass.data[DATA_PROTOCOL].add("abc123", {"k": "fired"})
    freezer.tick(timedelta(seconds=protocol.SAVE_DELAY_S + 1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert "device_panel.protocol_abc123" in hass_storage and protocol.INDEX_KEY in hass_storage
    assert await hass.config_entries.async_remove(entry.entry_id) is not None
    await hass.async_block_till_done()
    assert "device_panel.protocol_abc123" not in hass_storage and protocol.INDEX_KEY not in hass_storage
