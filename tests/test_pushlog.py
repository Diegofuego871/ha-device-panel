"""Gesendete Meldungen im Geräteprotokoll (2.122.0): Journal in push.py, Verbindung "Meldung wird gesendet" → Inhalt, Sammelmeldungen, Wiederherstellung."""

from __future__ import annotations

import time

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er  # noqa: F401
from pytest_homeassistant_custom_component.common import async_mock_service

from custom_components.device_panel import activity, devicelog, push
from custom_components.device_panel.const import DOMAIN

from .test_outage_notify import _device, _options, setup  # noqa: F401, F811  (Fixture "setup")


async def test_push_is_journaled_with_devices(hass: HomeAssistant, setup) -> None:  # noqa: F811
    calls = async_mock_service(hass, "notify", "handy")
    a, b = _device(hass, "Lampe"), _device(hass, "Stecker")
    assert await push.async_push(hass, "notify.handy", "Titel", "Text " * 200, topic="outage", devices=[a.id])
    assert await push.async_push(hass, "notify.handy", "Sammel", "zwei", topic="battery", devices=[a.id, b.id])
    assert len(calls) == 2
    single, group = [e for e in activity.get(hass).entries if e["cat"] == "push"][-2:]
    assert single["device_id"] == a.id and single["code"] == "push_sent" and "device_ids" not in single
    assert single["push"]["title"] == "Titel" and single["push"]["target"] == "notify.handy" and single["push"]["res"] == "sent"
    assert len(single["push"]["body"]) == push.PUSH_BODY_MAX  # gekürzt
    assert group["device_ids"] == [a.id, b.id]


async def test_failed_and_missing_push_are_journaled(hass: HomeAssistant, setup) -> None:  # noqa: F811
    dev = _device(hass, "Lampe")
    assert not await push.async_push(hass, "notify.gibt_es_nicht", "T", "M", topic="outage", devices=[dev.id])
    entry = [e for e in activity.get(hass).entries if e["cat"] == "push"][-1]
    assert entry["code"] == "push_missing" and entry["push"]["res"] == "missing" and entry["level"] == "error"


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


async def test_restore_keeps_push_fields(hass: HomeAssistant, hass_storage, setup) -> None:  # noqa: F811
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
    second = next(e for e in log.entries if e["at"] == 2.0)
    assert "push" not in second and DOMAIN


async def test_quiet_hold_is_journaled(hass: HomeAssistant, setup) -> None:  # noqa: F811
    from custom_components.device_panel.const import DATA_QUIET

    manager = hass.data[DATA_QUIET]
    manager._options = lambda: {"quiet_topics": ["outage"]}  # type: ignore[method-assign]
    manager._end = lambda opts: __import__("homeassistant.util.dt", fromlist=["utcnow"]).utcnow()  # type: ignore[method-assign]
    dev = _device(hass, "Lampe")
    assert await push.async_push(hass, "notify.handy", "Lampe aus", "weg", topic="outage", devices=[dev.id])
    entry = [e for e in activity.get(hass).entries if e["cat"] == "push"][-1]
    assert entry["code"] == "push_held" and entry["push"]["res"] == "held" and entry["device_id"] == dev.id
    assert manager._items[-1]["devices"] == [dev.id]
