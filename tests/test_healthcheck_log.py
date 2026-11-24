"""
Protokoll der HealthCheck-Dienste (2.236.0; Aufbau und Entscheide wie Alarmageddon 1.68.0): jeder Aufruf mit Art, Ergebnis, Antwortzeit und Auslöser;
einzelne Aufrufe 24 Stunden, Stundenwerte 30 Tage, Tageswerte und Ereignisse ein Jahr (höchstens 1000). Zahl und Liste gelten immer für den gewählten
Zeitraum. Nie die URL im Protokoll. Ein entfernter Dienst nimmt sein Protokoll mit, das Protokoll ist nicht im Backup.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.test_util.aiohttp import AiohttpClientMocker

from homeassistant.const import EVENT_HOMEASSISTANT_FINAL_WRITE

from custom_components.device_panel import backup
from custom_components.device_panel.const import DATA_HEALTHCHECK, DOMAIN, HEALTHLOG_EVENT_MAX, HEALTHLOG_SAVE_DELAY, HEALTHLOG_STORE_KEY
from custom_components.device_panel.healthcheck_log import HealthLog, call_kind

from .test_healthcheck import HC, add, advance, calls, entry, flags, ws  # noqa: F401  (Fixtures und Helfer)

T0 = datetime(2026, 11, 19, 6, 0, tzinfo=timezone.utc)


def log_with(hass: HomeAssistant) -> HealthLog:
    return HealthLog(hass)


def rec(log: HealthLog, minutes: float, *, sent: str = "ok", result: str = "ok", code: int | None = 200, ms: int | None = 120, by: str = "tick", hid: str = "a") -> str:
    return log.record(hid, at=T0 + timedelta(minutes=minutes), sent=sent, result=result, code=code, ms=ms, by=by)


def test_kind_of_a_call() -> None:
    """Nicht angekommen ist immer "gescheitert", auch beim Testknopf; die URL eines Falls ist "Fall gemeldet"."""
    assert call_kind("ok", "ok", False) == "ok"
    assert call_kind("offline", "ok", False) == "report" and call_kind("battery", "ok", False) == "report"
    assert call_kind("ok", "ok", True) == "test" and call_kind("error", "ok", True) == "test"
    for result in ("http", "timeout", "error"):
        assert call_kind("ok", result, False) == "fail" and call_kind("offline", result, True) == "fail"


async def test_events_merge_a_streak_and_mark_the_way_back(hass: HomeAssistant) -> None:
    """Vier gescheiterte Aufrufe hintereinander sind ein Ereignis mit Anzahl und Ende; der nächste, der klappt, ist "wieder in Ordnung"."""
    log = log_with(hass)
    rec(log, 0, by="start")
    rec(log, 5)
    for m in (10, 15, 20, 25):
        rec(log, m, result="timeout", code=None, ms=None)
    rec(log, 27, by="test")  # ein Test mitten im Ausfall unterbricht die Folge nicht
    rec(log, 30, result="timeout", code=None, ms=None)
    rec(log, 35)
    rec(log, 40, sent="offline", by="case")
    rec(log, 45, sent="offline")
    rec(log, 50, by="case")
    out = log.history("a", 3, 300, now=T0 + timedelta(minutes=55))
    kinds = [(e["kind"], e.get("n"), e.get("from"), e["by"]) for e in out["events"]]
    assert kinds == [("back", None, "report", "case"), ("report", 2, None, "case"), ("back", None, "fail", "tick"), ("test", None, None, "test"),
                     ("fail", 5, None, "tick"), ("start", None, None, "start")]
    fail = out["events"][4]
    assert fail["result"] == "timeout" and fail["t"] == (T0 + timedelta(minutes=10)).isoformat() and fail["end"] == (T0 + timedelta(minutes=30)).isoformat()
    assert out["events"][1]["sent"] == "offline"
    assert out["state"] == {"state": "ok", "since": (T0 + timedelta(minutes=50)).isoformat()}


async def test_counts_and_lists_follow_the_chosen_period(hass: HomeAssistant) -> None:
    """Vorgabe des Nutzers: Ereignisse und einzelne Aufrufe darunter genau nach dem oben gewählten Zeitraum, die Zahl entspricht der Liste."""
    log = log_with(hass)
    for m in range(0, 24 * 60, 5):
        rec(log, m, ms=100 + m % 50, result="ok" if m not in (300, 1000) else "http", code=200 if m not in (300, 1000) else 503)
    now = T0 + timedelta(hours=24, minutes=-1)
    for hours, n_calls in ((3, 36), (12, 144), (24, 288)):
        out = log.history("a", hours, 300, now=now)
        assert out["calls_total"] == n_calls == len(out["calls"]) == out["summary"]["total"] == len(out["points"])
        assert all(datetime.fromisoformat(c["t"]) > now - timedelta(hours=hours) for c in out["calls"])
        assert out["events_total"] == len(out["events"])
    # 3 Stunden: kein Ausfall darin; 24 Stunden: beide (je "gescheitert" und "wieder in Ordnung")
    assert log.history("a", 3, 300, now=now)["events_total"] == 0
    day = log.history("a", 24, 300, now=now)
    assert [e["kind"] for e in day["events"]] == ["back", "fail", "back", "fail"]
    assert day["summary"]["fail"] == 2 and day["summary"]["ok"] == 286 and day["summary"]["rate"] == 99.3
    assert day["summary"]["ms_mean"] is not None and day["summary"]["ms_max"] <= 149
    # "ohne Antwort" zählt nur Aufrufe ohne Antwort (keine Antwort, keine Verbindung), nie eine Antwort mit Fehlerstatus, auch über einen Tag
    assert day["summary"]["no_answer"] == 0
    # Über einen Tag: Grafik aus Stundenwerten, einzelne Aufrufe nur aus den letzten 24 Stunden (der Hinweis nennt, ab wann)
    week = log.history("a", 168, 300, now=now)
    assert week["points"] == [] and len(week["hourly"]) == 24 and week["calls_total"] == 288 and week["summary"]["no_answer"] == 0
    assert week["calls_from"] == T0.isoformat()
    # Marken der Zeitleiste und der Antwortzeit (nur über einen Tag): jeder Fehler des Zeitraums mit seiner Zeit
    assert week["marks"] == [[(T0 + timedelta(minutes=m)).isoformat(), None, "fail"] for m in (300, 1000)] and day["marks"] == []
    assert log.history("a", 720, 300, now=now + timedelta(hours=1))["marks"] == week["marks"]
    rec(log, 24 * 60 - 1, result="timeout", code=None, ms=None)
    assert log.history("a", 168, 300, now=now)["summary"]["no_answer"] == log.history("a", 24, 300, now=now)["summary"]["no_answer"] == 1


async def test_each_case_is_its_own_event_and_never_merges_with_another(hass: HomeAssistant) -> None:
    """Der Aufruf eines Falls ist "Fall gemeldet" mit `sent` = Art; aufeinanderfolgende gleiche Fälle sind ein Ereignis, ein anderer Fall ein neues."""
    log = log_with(hass)
    for kind in ("offline", "backup", "cpu", "ram", "disk", "stall"):
        assert call_kind(kind, "ok", False) == "report" and call_kind(kind, "error", False) == "fail"
    rec(log, 0, sent="offline", by="case")
    rec(log, 1, sent="backup", by="case")
    rec(log, 2, sent="backup", by="tick")
    rec(log, 3, sent="offline", by="tick")
    events = [(e["k"], e.get("sent"), e.get("n")) for e in log.events["a"]]
    assert events == [("report", "offline", 1), ("report", "backup", 2), ("report", "offline", 1)]


async def test_old_data_runs_out(hass: HomeAssistant) -> None:
    """Einzelne Aufrufe 24 Stunden, Stundenwerte 30 Tage, Tageswerte und Ereignisse ein Jahr (Entscheid des Nutzers), höchstens HEALTHLOG_EVENT_MAX."""
    log = log_with(hass)
    rec(log, 0, result="error", code=None, ms=None)
    rec(log, 5)
    rec(log, 60 * 25)
    assert [c[0] for c in log.calls["a"]] == [int((T0 + timedelta(minutes=60 * 25)).timestamp())]
    assert len(log.hours["a"]) == 2  # 06:00 (zwei Aufrufe) und 07:00 am nächsten Tag
    rec(log, 60 * 24 * 31)
    assert min(log.hours["a"]) >= int((T0 + timedelta(days=1)).timestamp())
    assert [e["k"] for e in log.events["a"]] == ["fail", "back"]
    rec(log, 60 * 24 * 300)
    assert [e["k"] for e in log.events["a"]] == ["fail", "back"] and len(log.days["a"]) == 4  # nach 300 Tagen noch da (90 Tage und 1 Jahr)
    rec(log, 60 * 24 * 367)
    assert log.events["a"] == [] and sorted(log.days["a"]) == sorted({local_day(T0 + timedelta(days=d)) for d in (31, 300, 367)})
    for i in range(HEALTHLOG_EVENT_MAX + 20):
        rec(log, 60 * 24 * 367 + i, by="test")
    assert len(log.events["a"]) == HEALTHLOG_EVENT_MAX == 1000


def local_day(when: datetime) -> str:
    return dt_util.as_local(when).date().isoformat()


async def test_daily_values_for_90_days_and_a_year(hass: HomeAssistant) -> None:
    """
    90 Tage und 1 Jahr (Wunsch des Nutzers 2026-11-19, 18:24): Tageswerte in der Ortszeit von Home Assistant mit den Minuten ohne Daten (Home
    Assistant aus); Kennzahlen, Grafik und Ereignisse über dieselben ganzen Tage; eine Lücke, die gerade läuft, zählt mit.
    """
    log = log_with(hass)
    day0 = dt_util.start_of_local_day(dt_util.as_local(T0)) + timedelta(hours=8)  # 08:00 Ortszeit
    at = lambda days, minutes=0: day0 + timedelta(days=days, minutes=minutes)  # noqa: E731
    put = lambda when, **kw: log.record("a", at=when, sent=kw.pop("sent", "ok"), result=kw.pop("result", "ok"), code=kw.pop("code", 200), ms=kw.pop("ms", 100), by=kw.pop("by", "tick"), interval=300, **kw)  # noqa: E731
    put(at(-200), by="start")  # vor 200 Tagen: nur im Jahr
    put(at(-200, 5), result="timeout", code=None, ms=None)
    put(at(-200, 10))
    for m in range(0, 120, 5):  # vor 10 Tagen zwei Stunden (davor seit 200 Tagen nichts), dann Home Assistant drei Stunden aus
        put(at(-10, m))
    put(at(-10, 120 + 180), by="start")
    put(at(0, 0), by="start")  # danach zehn Tage nichts
    now = at(0, 30)  # 08:30, der letzte Aufruf um 08:00: seit 08:05 ohne Daten (länger als zwei Intervalle)
    half = log.history("a", 4320, 300, now=now)
    year = log.history("a", 8760, 300, now=now)
    assert half["hourly"] == [] and half["points"] == [] and half["gaps"] == []
    assert datetime.fromisoformat(half["start"]) == dt_util.start_of_local_day(dt_util.as_local(now)) - timedelta(days=179)
    days = {row[0]: row for row in half["daily"]}
    ten = days[local_day(at(-10))]
    # Minuten ohne Daten: 00:00 bis 08:00 (seit 200 Tagen nichts), 10:00 bis 13:00 (ab dem Intervall nach dem letzten Aufruf), 13:05 bis Mitternacht
    assert ten[1:5] == [25, 0, 0, 0] and ten[5] == 100 and ten[7] == 0 and ten[8] == 480 + 180 + 655
    assert days[local_day(at(-5))][8] == 1440 and days[local_day(at(-5))][1:5] == [0, 0, 0, 0]
    assert days[local_day(at(0))][8] == 480 + 25  # bis 08:00 noch die zehn Tage, dazu 08:05 bis 08:30, gerade ohne Daten
    assert local_day(at(-200)) not in days and local_day(at(-200)) in {row[0] for row in year["daily"]}
    assert half["summary"]["total"] == 26 and year["summary"]["total"] == 29 and year["summary"]["fail"] == year["summary"]["no_answer"] == 1
    assert year["summary"]["rate"] == round(100 * 28 / 29, 2)
    # Ereignisse folgen denselben Tagen: der Ausfall vor 200 Tagen nur im Jahr
    assert "fail" not in [e["kind"] for e in half["events"]] and "fail" in [e["kind"] for e in year["events"]]
    assert half["events_total"] == len(half["events"]) and year["events_total"] == len(year["events"])
    assert [m[2] for m in year["marks"]] == ["fail"]
    # Die Lücke steht in den Tageswerten, auch nach dem Neustart (der letzte Aufruf ist gemerkt)
    assert log.days["a"][local_day(at(-10))][8] == (480 + 180 + 655) * 60 and log.last["a"] == int(at(0).timestamp())


async def test_gaps_without_data(hass: HomeAssistant) -> None:
    """Länger als zwei Abstände ohne einen Aufruf ist eine Lücke (Home Assistant aus); vor dem ersten Aufruf gibt es keine Lücke."""
    log = log_with(hass)
    for m in [*range(0, 60, 5), *range(120, 180, 5)]:
        rec(log, m)
    out = log.history("a", 24, 300, now=T0 + timedelta(minutes=180))
    assert out["gaps"] == [[(T0 + timedelta(minutes=60)).isoformat(), (T0 + timedelta(minutes=120)).isoformat()]]
    # Abstand 1 Stunde: 1 Stunde ohne Aufruf ist keine Lücke
    hourly = log_with(hass)
    for h in range(0, 10):
        rec(hourly, 60 * h)
    assert hourly.history("a", 24, 3600, now=T0 + timedelta(hours=9, minutes=50))["gaps"] == []
    # Über einen Tag aus den Stundenwerten
    week = log.history("a", 168, 300, now=T0 + timedelta(minutes=180))
    assert [[g[0][11:16], g[1][11:16]] for g in week["gaps"]] == [["07:00", "08:00"]]


async def test_damaged_storage_is_dropped_line_by_line(hass: HomeAssistant, hass_storage) -> None:
    """Eine kaputte Zeile fällt einzeln weg, nie das ganze Protokoll."""
    ts = int(T0.timestamp())
    hass_storage[HEALTHLOG_STORE_KEY] = {"version": 1, "key": HEALTHLOG_STORE_KEY, "data": {
        "since": {"a": ts, "b": "gestern"},
        "state": {"a": ["ok", ts], "b": ["kaputt", ts]},
        "calls": {"a": [f"{ts},ok,ok,200,120,tick,ok", "kaputt", f"{ts},ok,ok,200,-1,tick,ok", f"{ts},boese,ok,200,1,tick,ok", 7]},
        "hours": {"a": [f"{ts - ts % 3600},1,0,0,0,120,1,120,0", "1,2,3", f"{ts + 7},1,0,0,0,1,1,1,0", f"{ts - ts % 3600},1,0,0,0,120,1,120"]},
        "days": {"a": ["2026-11-19,1,0,0,0,120,1,120,0,0", "2026-13-40,1,0,0,0,1,1,1,0,0", "2026-11-18,1,0,0", "2026-11-17,1,0,0,0,1,1,1,0,-5"]},
        "last": {"a": ts, "b": -1},
        "events": {"a": [{"k": "start", "t": ts, "by": "start", "url": "https://geheim"}, {"k": "erfunden", "t": ts}, "kein Wörterbuch"]},
    }}
    log = log_with(hass)
    await log.async_load()
    assert len(log.calls["a"]) == 1 and len(log.hours["a"]) == 1 and log.events["a"] == [{"k": "start", "t": ts, "by": "start"}]
    assert list(log.days["a"]) == ["2026-11-19"] and log.last == {"a": ts}
    assert "b" not in log.since and "b" not in log.state


async def test_recorded_from_the_real_service_with_trigger_and_time(hass: HomeAssistant, entry, flags, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:  # noqa: F811
    """Im Betrieb: Speichern, Takt, Fall, Testknopf; Antwortzeit gemessen; die Abfrage nur für bestehende Dienste und Zeiträume."""
    aioclient_mock.get(HC, status=200)
    aioclient_mock.get(f"{HC}/fail", status=200)
    client = await hass_ws_client(hass)
    hid = (await add(client, interval=120))["result"]["id"]
    await advance(hass, freezer, 31)
    await advance(hass, freezer, 121)
    flags.options(notify_outage=True)
    flags.offline = {"d1": 1.0}
    await advance(hass, freezer, 31)
    client = await hass_ws_client(hass)  # nach dem Verstellen der Uhr neu verbinden (die alte Verbindung schliesst der Herzschlag des Websockets)
    assert (await ws(client, type=f"{DOMAIN}/healthcheck_ping", check_id=hid, kind="error"))["success"]
    out = (await ws(client, type=f"{DOMAIN}/healthcheck_history", check_id=hid, hours=3))["result"]
    kinds = [(c["kind"], c["by"]) for c in reversed(out["calls"])]
    assert kinds[:2] == [("ok", "save"), ("ok", "tick")] and ("report", "case") in kinds and kinds[-1] == ("test", "test")
    assert all(isinstance(c["ms"], int) and c["ms"] >= 0 for c in out["calls"]) and out["summary"]["report"] >= 1
    assert any(e["kind"] == "report" and e["sent"] == "offline" for e in out["events"])
    assert calls(aioclient_mock)[-1] == f"{HC}/fail"
    # Die Liste der Dienste nennt den Zustand seit wann (Auswahl im Kopf des Protokolls); ein Test ändert ihn nicht
    listing = (await ws(client, type=f"{DOMAIN}/healthcheck_list"))["result"]
    assert listing["items"][0]["log"]["state"] == "report" == out["state"]["state"]
    for good in (720, 4320, 8760):
        assert (await ws(client, type=f"{DOMAIN}/healthcheck_history", check_id=hid, hours=good))["success"], good
    assert (await ws(client, type=f"{DOMAIN}/healthcheck_history", check_id=hid, hours=2160))["success"] is False
    for bad in ({"check_id": "nichtda", "hours": 3}, {"check_id": hid, "hours": 5}):
        answer = await ws(client, type=f"{DOMAIN}/healthcheck_history", **bad)
        assert answer["success"] is False


async def test_the_log_never_holds_up_a_life_sign(hass: HomeAssistant, entry, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker, monkeypatch) -> None:  # noqa: F811
    """Scheitert das Mitschreiben, geht der Aufruf trotzdem hinaus und der Zustand stimmt."""
    aioclient_mock.get(HC, status=200)
    client = await hass_ws_client(hass)
    healthcheck = hass.data[DATA_HEALTHCHECK]

    def broken(*_a: Any, **_k: Any) -> str:
        raise RuntimeError("kaputt")

    monkeypatch.setattr(healthcheck.log, "record", broken)
    hid = (await add(client))["result"]["id"]
    await advance(hass, freezer, 2)
    assert calls(aioclient_mock) == [HC] and healthcheck.status[hid]["result"] == "ok"


async def test_removing_a_service_removes_its_log_and_the_log_is_not_in_the_backup(hass: HomeAssistant, entry, freezer, hass_ws_client, hass_storage,  # noqa: F811
                                                                                    aioclient_mock: AiohttpClientMocker) -> None:
    aioclient_mock.get(HC, status=200)
    client = await hass_ws_client(hass)
    hid = (await add(client))["result"]["id"]
    await advance(hass, freezer, 2)
    log = hass.data[DATA_HEALTHCHECK].log
    assert log.calls[hid]
    exported = json.dumps(await backup.async_export(hass, ["monitor"]))
    assert '"calls"' not in exported and "healthcheck_log" not in exported
    assert (await ws(client, type=f"{DOMAIN}/healthcheck_delete", check_id=hid))["success"]
    assert all(hid not in table for table in (log.calls, log.hours, log.events, log.state, log.since))
    await log.async_save()
    assert hass_storage[HEALTHLOG_STORE_KEY]["data"]["calls"] == {}


async def test_written_within_the_delay_even_with_calls_every_minute(hass: HomeAssistant, entry, freezer, hass_ws_client, hass_storage,  # noqa: F811
                                                                     aioclient_mock: AiohttpClientMocker) -> None:
    """Ein Absturz kostet höchstens HEALTHLOG_SAVE_DELAY: Aufrufe jede Minute schieben das Schreiben nicht immer weiter hinaus."""
    aioclient_mock.get(HC, status=200)
    client = await hass_ws_client(hass)
    hid = (await add(client, interval=60))["result"]["id"]
    await advance(hass, freezer, 2)
    assert HEALTHLOG_STORE_KEY not in hass_storage
    # Beenden von Home Assistant (ohne Entladen der Integration) schreibt, was noch fehlt
    hass.bus.async_fire(EVENT_HOMEASSISTANT_FINAL_WRITE)
    await hass.async_block_till_done()
    assert len(hass_storage[HEALTHLOG_STORE_KEY]["data"]["calls"][hid]) == 1
    for _ in range(HEALTHLOG_SAVE_DELAY // 60 + 2):
        await advance(hass, freezer, 61)
    stored = hass_storage.get(HEALTHLOG_STORE_KEY, {}).get("data", {})
    assert len(stored.get("calls", {}).get(hid, [])) >= HEALTHLOG_SAVE_DELAY // 60, "nach der Verzögerung geschrieben, ohne Beenden"


@pytest.mark.parametrize("hours", [3, 12, 24, 168, 720, 4320, 8760])
async def test_every_period_answers(hass: HomeAssistant, hours: int) -> None:
    log = log_with(hass)
    rec(log, 0, by="start")
    out = log.history("a", hours, 300, now=T0 + timedelta(minutes=10))
    assert out["hours"] == hours and (out["points"] if hours <= 24 else out["hourly"] if hours <= 720 else out["daily"]) and out["since"] == T0.isoformat()


def test_fails_count_only_real_failed_life_signs_of_the_last_24_hours(hass: HomeAssistant) -> None:
    """Übersicht (2.241.0): gezählt werden gescheiterte Lebenszeichen der letzten 24 Std.; Testknöpfe und Erfolge zählen nicht, Ältere fallen heraus."""
    log = log_with(hass)
    rec(log, 0, result="http", code=503)  # gescheitert, aber älter als 24 Std.
    rec(log, 60 * 25, result="timeout", code=None, ms=None)
    rec(log, 60 * 26, result="http", code=500)
    rec(log, 60 * 27, by="test", result="http", code=500)  # Testknopf zählt nicht
    rec(log, 60 * 28)
    now = T0 + timedelta(minutes=60 * 29)
    assert log.fails("a", now) == 2 and log.fails("nicht-da", now) == 0
    assert log.fails("a", T0 + timedelta(hours=49.5)) == 1  # der Aufruf von 25 Std. ist dann älter als 24 Std., der von 26 Std. noch nicht


async def test_overview_lists_only_services_with_a_failure(hass: HomeAssistant, entry, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:  # noqa: F811
    """Übersicht (2.241.0): leer, solange alles läuft; gescheitert gilt als "failing"; danach bleibt der Dienst mit der Zahl der Fehler der letzten 24 Std. stehen."""
    aioclient_mock.get(HC, status=200)
    client = await hass_ws_client(hass)
    hid = (await add(client, interval=120))["result"]["id"]
    await advance(hass, freezer, 31)
    healthcheck = hass.data[DATA_HEALTHCHECK]
    assert healthcheck.overview() == []
    assert healthcheck.states() == [{"id": hid, "name": "Haus", "failing": False}]
    # das Panel bekommt die Übersicht mit der Geräteliste (nur Administratoren)
    assert (await ws(client, type=f"{DOMAIN}/list_devices"))["result"]["health"] == []
    aioclient_mock.clear_requests()
    aioclient_mock.get(HC, status=503)
    await advance(hass, freezer, 121)
    rows = healthcheck.overview()
    assert len(rows) == 1 and rows[0]["id"] == hid and rows[0]["name"] == "Haus" and rows[0]["failing"] is True and rows[0]["fails24"] >= 1
    assert rows[0]["status"]["result"] == "http" and rows[0]["status"]["code"] == 503
    over_ws = (await ws(client, type=f"{DOMAIN}/list_devices"))["result"]["health"]
    assert over_ws and over_ws[0]["failing"] is True and over_ws[0]["fails24"] == rows[0]["fails24"]
    # das Herz bekommt alle Dienste mit Zustand
    assert healthcheck.states()[0]["failing"] is True
    assert (await ws(client, type=f"{DOMAIN}/list_devices"))["result"]["health_services"] == [{"id": hid, "name": "Haus", "failing": True}]
    # ein Test-Aufruf macht den Dienst nicht schlechter und nicht besser
    aioclient_mock.clear_requests()
    aioclient_mock.get(HC, status=200)
    await advance(hass, freezer, 121)
    after = healthcheck.overview()
    assert len(after) == 1 and after[0]["failing"] is False and after[0]["fails24"] >= 1
    # nach 24 Stunden ohne Fehler verschwindet der Dienst wieder aus der Übersicht
    await advance(hass, freezer, 25 * 3600)
    assert healthcheck.overview() == []
