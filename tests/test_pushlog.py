"""Gesendete Meldungen im Geräteprotokoll (2.122.0): Journal in push.py, Verbindung "Meldung wird gesendet" → Inhalt, Sammelmeldungen, Wiederherstellung."""

from __future__ import annotations

import time

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er  # noqa: F401
from pytest_homeassistant_custom_component.common import async_mock_service

from custom_components.device_panel import activity, devicelog, push, push_log
from custom_components.device_panel.push_log import PushLog
from custom_components.device_panel.const import DATA_PUSHLOG, DOMAIN

from .test_outage_notify import _device, _options, setup  # noqa: F401, F811  (Fixture "setup")


async def test_push_is_journaled_with_devices(hass: HomeAssistant, setup) -> None:  # noqa: F811
    calls = async_mock_service(hass, "notify", "handy")
    a, b = _device(hass, "Lampe"), _device(hass, "Stecker")
    assert await push.async_push(hass, "notify.handy", "Titel", "Text " * 200, topic="outage", devices=[a.id])
    assert await push.async_push(hass, "notify.handy", "Sammel", "zwei", topic="battery", devices=[a.id, b.id])
    assert len(calls) == 2
    single, group = hass.data[DATA_PUSHLOG].items(None, 0, time.time() + 5)
    assert single["devs"] == [a.id] and single["p"]["title"] == "Titel" and single["p"]["target"] == "notify.handy" and single["p"]["res"] == "sent"
    assert len(single["p"]["body"]) == push_log.BODY_MAX  # gekürzt
    assert group["devs"] == [a.id, b.id] and group["p"]["topic"] == "battery"
    # das Panel-Log hat nur die Zeile, ohne Inhalt der Meldung
    line = [e for e in activity.get(hass).entries if e["cat"] == "push"][-1]
    assert line["code"] == "push_sent" and "push" not in line and "device_ids" not in line
    # ohne Gerät nichts im Meldungsprotokoll
    await push.async_push(hass, "notify.handy", "Ohne", "Gerät", topic="status")
    assert len(hass.data[DATA_PUSHLOG].items(None, 0, time.time() + 5)) == 2


async def test_failed_and_missing_push_are_journaled(hass: HomeAssistant, setup) -> None:  # noqa: F811
    dev = _device(hass, "Lampe")
    assert not await push.async_push(hass, "notify.gibt_es_nicht", "T", "M", topic="outage", devices=[dev.id])
    entry = [e for e in activity.get(hass).entries if e["cat"] == "push"][-1]
    assert entry["code"] == "push_missing" and entry["level"] == "error"
    item = hass.data[DATA_PUSHLOG].items(dev.id, 0, time.time() + 5)[-1]
    assert item["p"]["res"] == "missing"


async def test_devicelog_links_push_to_row(hass: HomeAssistant, setup) -> None:  # noqa: F811
    async_mock_service(hass, "notify", "handy")
    a, b = _device(hass, "Lampe"), _device(hass, "Stecker")
    activity.record(hass, "info", "outage", "online_sent", "Lampe", a.id, duration="9 Min.")
    activity.record(hass, "info", "outage", "online_sent", "Stecker", b.id, duration="1 Min.")
    activity.record(hass, "info", "outage", "online_off", "Lampe", a.id, duration="1 Min.")  # keine Meldung: nichts zu verbinden
    await push.async_push(hass, "notify.handy", "Lampe wieder online", "nach 9 Min.", topic="online", devices=[a.id])
    out = devicelog.query(hass, a.id, since=None, until=time.time() + 5)
    sent = next(e for e in out["entries"] if e.get("code") == "online_sent")
    assert sent["push"]["title"] == "Lampe wieder online" and sent["push"]["target"] == "notify.handy"
    off = next(e for e in out["entries"] if e.get("code") == "online_off")
    assert "push" not in off
    # die Meldung bleibt auch eine eigene Zeile (Kategorie "push")
    assert out["counts"]["push"] == 1 and out["counts"]["outage"] == 2
    # das andere Gerät: sein Eintrag bekommt die Meldung des ersten nicht
    other = devicelog.query(hass, b.id, since=None, until=time.time() + 5)
    assert "push" not in next(e for e in other["entries"] if e.get("code") == "online_sent")
    # Suche findet auch den Inhalt der Meldung
    assert devicelog.query(hass, a.id, since=None, until=time.time() + 5, text="nach 9 min")["total"] >= 1


async def test_group_push_appears_for_every_device(hass: HomeAssistant, setup) -> None:  # noqa: F811
    async_mock_service(hass, "notify", "handy")
    a, b = _device(hass, "Lampe"), _device(hass, "Stecker")
    await push.async_push(hass, "notify.handy", "2 Geräte ausgefallen", "Lampe, Stecker", topic="outage", devices=[a.id, b.id])
    for dev in (a, b):
        rows = devicelog.query(hass, dev.id, since=None, until=time.time() + 5)["entries"]
        assert [e["push"]["title"] for e in rows if e["cat"] == "push"] == ["2 Geräte ausgefallen"]
    both = devicelog.query(hass, None, since=None, until=time.time() + 5)
    assert sorted(e["dname"] for e in both["entries"] if e["cat"] == "push") == ["Lampe", "Stecker"]


async def test_restore_keeps_push_fields_and_migrates(hass: HomeAssistant, setup) -> None:  # noqa: F811
    """Die Felder aus 2.123.0 bleiben beim Wiederherstellen des Panel-Logs; ein neues Meldungsprotokoll übernimmt sie einmalig."""
    log = activity.get(hass)
    activity._restore_entries(
        hass, log,
        [
            {"at": 1.0, "level": "info", "cat": "push", "title": "notify.handy", "text": "gesendet: T", "detail": "", "device_id": "x", "code": "push_sent",
             "push": {"title": "T", "body": "B", "target": "notify.handy", "topic": "outage", "res": "sent"}, "device_ids": ["x", "y", 5]},
            {"at": 2.0, "level": "info", "cat": "push", "title": "n", "text": "alt", "detail": "", "device_id": None, "push": {"title": 1}},
        ],
    )
    first = next(e for e in log.entries if e["at"] == 1.0)
    assert first["code"] == "push_sent" and first["push"]["body"] == "B" and first["device_ids"] == ["x", "y"]
    assert "push" not in next(e for e in log.entries if e["at"] == 2.0)
    fresh = PushLog(hass)
    assert [(i["at"], i["devs"], i["p"]["title"]) for i in fresh._from_activity()] == [(1.0, ["x", "y"], "T")]


async def test_limits_by_days_and_size(hass: HomeAssistant, setup) -> None:  # noqa: F811
    log = hass.data[DATA_PUSHLOG]
    now = time.time()
    for n in range(40):
        log._items.append({"at": now - n * 86400 * 20, "devs": ["d"], "p": {"title": "T", "body": "x" * 500, "target": "notify.h", "topic": "outage", "res": "sent"}})
    log._items.sort(key=lambda i: i["at"])
    await _options(hass, push_keep_days=365)
    assert len(log._items) == 19  # 0 .. 360 Tage zurück (n*20 <= 365)
    assert log.usage()["days"] >= 340 and log.usage()["entries"] == 19 and log.usage()["devices"] == 1
    await _options(hass, push_keep_days=60)
    assert [round((now - i["at"]) / 86400) for i in log._items] == [40, 20, 0]
    await _options(hass, push_keep_days=365, push_max_mb=1)
    for n in range(4000):
        log._items.append({"at": now - n, "devs": ["d"], "p": {"title": "T", "body": "x" * 500, "target": "notify.h", "topic": "outage", "res": "sent"}})
    log._items.sort(key=lambda i: i["at"])
    log.apply_limits()
    assert log.size() <= 1048576 and len(log._items) > 1000
    assert log._items[-1]["at"] >= now - 1  # die neuesten bleiben


async def test_log_survives_restart(hass: HomeAssistant, hass_storage, setup) -> None:  # noqa: F811
    log = hass.data[DATA_PUSHLOG]
    dev = _device(hass, "Lampe")
    await push.async_push(hass, "notify.handy", "Titel", "Text", topic="outage", devices=[dev.id])
    await log.async_stop()
    saved = hass_storage[push_log.PUSH_STORE_KEY]["data"]["items"]
    assert len(saved) == 1 and saved[0]["p"]["title"] == "Titel" and saved[0]["devs"] == [dev.id]
    again = PushLog(hass)
    await again.async_start()
    assert [i["p"]["title"] for i in again.items(dev.id, 0, time.time() + 5)] == ["Titel"]
    # Kaputte Einträge werden verworfen
    hass_storage[push_log.PUSH_STORE_KEY]["data"]["items"] += [{"at": "x"}, {"at": 1, "devs": [], "p": {"title": 1}}]
    third = PushLog(hass)
    await third.async_start()
    assert len(third.items(None, 0, time.time() + 5)) == 1


async def test_storage_usage_reports_push(hass: HomeAssistant, setup, hass_ws_client) -> None:  # noqa: F811
    dev = _device(hass, "Lampe")
    await push.async_push(hass, "notify.handy", "Titel", "Text", topic="outage", devices=[dev.id])
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/storage_usage"})
    result = (await client.receive_json())["result"]
    assert result["push"]["entries"] == 1 and result["push"]["bytes"] > 0 and result["push"]["devices"] == 1


async def test_quiet_hold_and_summary_are_journaled(hass: HomeAssistant, setup) -> None:  # noqa: F811
    from custom_components.device_panel.const import DATA_QUIET
    from homeassistant.util import dt as dt_util

    calls = async_mock_service(hass, "notify", "handy")
    manager = hass.data[DATA_QUIET]
    manager._options = lambda: {"quiet_topics": ["outage"], "quiet_mode": "summary"}  # type: ignore[method-assign]
    manager._end = lambda opts: dt_util.utcnow()  # type: ignore[method-assign]
    a, b = _device(hass, "Lampe"), _device(hass, "Stecker")
    assert await push.async_push(hass, "notify.handy", "Lampe aus", "weg", topic="outage", devices=[a.id], quiet={"label": "Lampe"})
    assert await push.async_push(hass, "notify.handy", "Stecker aus", "weg", topic="outage", devices=[b.id], quiet={"label": "Stecker"})
    held = hass.data[DATA_PUSHLOG].items(None, 0, time.time() + 5)
    assert [i["p"]["res"] for i in held] == ["held", "held"] and held[0]["devs"] == [a.id] and held[0]["p"]["topic"] == "outage"
    assert manager._items[-1]["devices"] == [b.id] and not calls
    # Ende der Ruhezeit: die Zusammenfassung gehört zu beiden Geräten (Lücke 2)
    await manager._deliver(list(manager._items), {"quiet_mode": "summary"})
    assert len(calls) == 1
    summary = hass.data[DATA_PUSHLOG].items(None, 0, time.time() + 5)[-1]
    assert summary["p"]["res"] == "sent" and summary["p"]["topic"] == "quiet" and summary["devs"] == [a.id, b.id]
    rows = devicelog.query(hass, a.id, since=None, until=time.time() + 5)["entries"]
    assert [e["push"]["res"] for e in rows if e["cat"] == "push"] == ["sent", "held"]  # neueste zuerst


async def test_quiet_single_mode_keeps_devices_and_topic(hass: HomeAssistant, setup) -> None:  # noqa: F811
    from custom_components.device_panel.const import DATA_QUIET

    async_mock_service(hass, "notify", "handy")
    manager = hass.data[DATA_QUIET]
    dev = _device(hass, "Lampe")
    item = {"topic": "battery", "target": "notify.handy", "title": "T", "message": "M", "data": {}, "at": time.time(), "quiet": {}, "devices": [dev.id]}
    await manager._deliver([item], {"quiet_mode": "single"})
    only = hass.data[DATA_PUSHLOG].items(dev.id, 0, time.time() + 5)
    assert len(only) == 1 and only[0]["p"]["topic"] == "battery"


async def test_system_query_levels_cats_and_debug(hass: HomeAssistant, setup, hass_ws_client) -> None:  # noqa: F811
    """Reiter "System" (2.125.0): Einträge ohne Gerät plus alle Debug-Einträge; Zahlen je Stufe und Kategorie wie die Chips."""
    dev = _device(hass, "Lampe")
    activity.record(hass, "info", "outage", "online_sent", "Lampe", dev.id, duration="9 Min.")  # gehört dem Gerät: nicht im System
    activity.record(hass, "info", "system", "sys_start", "Device Panel", version="2.125.0")
    activity.record(hass, "error", "system", "ai_failed", "Device Panel", reason="Zeit", detail="x", chars=1, task="ai_task.x")
    activity.record(hass, "info", "push", "push_sent", "notify.handy", title="T")
    activity.set_debug(hass, True)
    activity.record(hass, "debug", "outage", "outage_seen", "Lampe", dev.id, minutes=5, entities="light.l=unavailable")  # Debug mit Gerät: im System
    now = time.time() + 5
    out = devicelog.system_query(hass, since=None, until=now)
    assert out["all"] >= 5  # der Start der Einrichtung zählt mit
    cats = {e["cat"] for e in out["entries"]}
    assert "outage" in cats and all(e["cat"] != "outage" or e["level"] == "debug" for e in out["entries"])
    assert out["levels"]["error"] == 1 and out["levels"]["debug"] == 1 and out["debug"] is True and out["debug_until"] > time.time()
    # Stufe wählt: die Zahlen je Kategorie folgen ihr, die je Stufe nicht
    err = devicelog.system_query(hass, since=None, until=now, level="error")
    assert [e["level"] for e in err["entries"]] == ["error"] and err["cats"] == {"system": 1} and err["levels"]["info"] >= 2
    # Kategorie wählt: die Zahlen je Stufe folgen ihr
    push = devicelog.system_query(hass, since=None, until=now, cat="push")
    assert push["total"] == 1 and push["levels"] == {"info": 1}
    # Suche und Seite
    assert devicelog.system_query(hass, since=None, until=now, text="handy")["total"] == 1
    page = devicelog.system_query(hass, since=None, until=now, limit=2, offset=1)
    assert len(page["entries"]) == 2 and page["total"] == out["total"]
    # über den WebSocket (nur Administratoren)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/protocol_get", "kind": "system", "filter": "error", "cat": "system"})
    result = (await client.receive_json())["result"]
    assert result["total"] == 1 and result["entries"][0]["source"] == "system" and "debug" in result and "until" in result


async def test_devicelog_chart_follows_the_chip_and_marks_faults(hass: HomeAssistant, setup) -> None:  # noqa: F811
    """Diagramm in "Alles" (2.126.0): Einträge je Tag der gezeigten Liste, Störungen (Ausfall, Warnung, Fehler) als "bad"."""
    from custom_components.device_panel.const import DATA_AVAILABILITY

    dev = _device(hass, "Lampe")
    now = time.time()
    hass.data[DATA_AVAILABILITY]._events = {dev.id: [[now - 5 * 86400, 1], [now - 2 * 86400, 0], [now - 2 * 86400 + 600, 1]]}
    activity.record(hass, "warning", "battery", "battery_new", "Lampe", dev.id, level="9 %")
    out = devicelog.query(hass, dev.id, since=now - 7 * 86400, until=now + 5)
    assert out["step"] == "day" and sum(b["n"] for b in out["buckets"]) == out["total"] == 3
    assert sum(b["bad"] for b in out["buckets"]) == 2  # Ausfall und Warnung; die Rückkehr zählt nicht
    only = devicelog.query(hass, dev.id, since=now - 7 * 86400, until=now + 5, cat="battery")
    assert sum(b["n"] for b in only["buckets"]) == 1 and sum(b["bad"] for b in only["buckets"]) == 1
    long = devicelog.query(hass, dev.id, since=None, until=now + 5)
    assert long["step"] == "day" and long["buckets"]
