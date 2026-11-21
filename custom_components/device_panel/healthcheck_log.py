"""
Protokoll der HealthCheck-Dienste (seit 2.236.0, Wunsch des Nutzers; Aufbau und Entscheide wie bei Alarmageddon 1.68.0).

Je Dienst hält es jeden Aufruf fest: Zeit, Art, Ergebnis, HTTP-Status, Antwortzeit und Auslöser. Gespeichert wird viererlei, alles mit Ablaufzeit:

- einzelne Aufrufe der letzten HEALTHLOG_CALL_HOURS Stunden (Reiter "Alle Aufrufe"; ältere nur zusammengefasst, Entscheid des Nutzers),
- Stundenwerte für die Grafik über HEALTHLOG_HOUR_DAYS Tage (Anzahl je Art, Summe, Zahl und Höchstwert der Antwortzeiten, Zahl ohne Antwort),
- Tageswerte über HEALTHLOG_DAY_DAYS Tage für 6 Monate und 1 Jahr (Wunsch des Nutzers 18:24, "Langzeitstatistik"; dieselben Zahlen und dazu die
  Sekunden ohne Daten), je Tag in der Ortszeit von Home Assistant,
- Ereignisse über HEALTHLOG_EVENT_DAYS Tage, höchstens HEALTHLOG_EVENT_MAX je Dienst: gescheitert, Fall gemeldet (ein Fall trifft zu, zum Beispiel ein Gerät ist ausgefallen),
  Test, wieder in Ordnung, erstes Lebenszeichen nach dem Start. Aufeinanderfolgende gescheiterte Aufrufe (und ebenso gemeldete Fehler) sind ein
  Ereignis mit Anzahl und Ende; so bleibt die Liste auch bei einem langen Ausfall kurz.

Art eines Aufrufs: "ok" (Lebenszeichen angekommen), "report" (URL eines Falls angekommen, `sent` nennt den Fall), "fail" (nicht angekommen:
keine Antwort, keine Verbindung, Antwort ausserhalb 2xx), "test" (Testknopf, angekommen). Auslöser: "tick" (Takt), "case" (ein Fall hat begonnen oder
geendet), "test", "start" (erstes nach dem Start von Home Assistant), "save" (neu oder geändert gespeichert).

Eine Lücke ist eine Zeit ohne einen einzigen Aufruf, länger als zwei Intervalle (Home Assistant aus, Netz weg, bevor ein Aufruf hinausging). Bis 30
Tage rechnet die Abfrage sie aus den Aufrufen und Stundenwerten; für die Tageswerte zählt `record` sie beim ersten Aufruf nach der Lücke (der letzte
Aufruf steht dafür in `last`, auch über einen Neustart).

Die URL steht nie im Protokoll (sie ist ein Geheimnis des Dienstes, Grundsatz wie im Log), auch nicht der Text einer Ausnahme der Verbindung (er
enthält oft die URL). Das Protokoll ist Laufzeit, nicht im Backup; wird ein Dienst entfernt, fällt sein Protokoll mit. Geschrieben wird gesammelt
(HEALTHLOG_SAVE_DELAY) und beim Beenden; ein Absturz kostet höchstens die letzten Minuten des Protokolls, nie ein Lebenszeichen. Gesammelt heisst:
höchstens HEALTHLOG_SAVE_DELAY nach dem ersten ungeschriebenen Aufruf, nie verschoben (Store.async_delay_save allein schöbe das Schreiben bei jedem
Aufruf hinaus; bei einem Intervall unter der Verzögerung schriebe es erst beim Beenden, und gerade ein Absturz, für den es die Dienste gibt, kostete
dann das ganze Protokoll seit dem letzten Start).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
import logging
import math
from typing import Any

from homeassistant.const import EVENT_HOMEASSISTANT_FINAL_WRITE
from homeassistant.core import Event, HassJob, HomeAssistant, callback
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    HEALTHCHECK_CASES,
    HEALTHLOG_CALL_HOURS,
    HEALTHLOG_DAY_DAYS,
    HEALTHLOG_EVENT_DAYS,
    HEALTHLOG_EVENT_MAX,
    HEALTHLOG_GAP_DAY_MINUTES,
    HEALTHLOG_HOUR_DAYS,
    HEALTHLOG_SAVE_DELAY,
    HEALTHLOG_STORE_KEY,
)

_LOGGER = logging.getLogger(__name__)

KINDS = ("ok", "report", "fail", "test")
RESULTS = ("ok", "http", "timeout", "error")
BY = ("tick", "case", "test", "start", "save")
SENT = ("ok", *HEALTHCHECK_CASES)
EVENT_KINDS = ("fail", "report", "test", "back", "start")
LIST_MAX = 300  # Zeilen je Liste in einer Antwort (neueste zuerst), wie die Sensoransicht; die Zahl gilt immer für den ganzen Zeitraum
HOUR = 3600
DAY_FIELDS = 9  # ok, report, fail, test, summe_ms, anzahl_ms, max_ms, ohne_antwort, sekunden_ohne_daten


def call_kind(sent: str, result: str, test: bool) -> str:
    """Art eines Aufrufs: nicht angekommen ist immer "fail", auch beim Testknopf."""
    if result != "ok":
        return "fail"
    if test:
        return "test"
    return "report" if sent != "ok" else "ok"


def gap_limit(interval: int) -> int:
    """Ab so vielen Sekunden ohne Aufruf ist es eine Lücke: länger als zwei Intervalle (bei kurzen Intervallen mindestens zwei Minuten Spiel)."""
    return max(2 * interval, interval + 120)


def _iso(ts: float | None) -> str | None:
    return dt_util.utc_from_timestamp(ts).isoformat() if ts is not None else None


def _day_of(ts: float) -> date:
    """Der Tag eines Zeitpunkts in der Ortszeit von Home Assistant (die Grafik zeigt Tage, wie sie der Nutzer erlebt)."""
    return dt_util.as_local(dt_util.utc_from_timestamp(ts)).date()


def _day_start(day: date) -> float:
    return dt_util.start_of_local_day(day).timestamp()


def _int(value: Any, low: int = 0) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= low else None


def _parse_call(row: Any) -> tuple | None:
    """Eine Zeile "ts,kind,result,code,ms,by,sent"; kaputte Zeilen fallen einzeln weg, nie die ganze Ablage."""
    if not isinstance(row, str):
        return None
    parts = row.split(",")
    if len(parts) != 7:
        return None
    ts, kind, result, code, ms, by, sent = parts
    try:
        t = int(ts)
        code_v = int(code) if code else None
        ms_v = int(ms) if ms else None
    except ValueError:
        return None
    if kind not in KINDS or result not in RESULTS or by not in BY or sent not in SENT or t <= 0 or (ms_v is not None and ms_v < 0):
        return None
    return (t, kind, result, code_v, ms_v, by, sent)


def _call_row(c: tuple) -> str:
    t, kind, result, code, ms, by, sent = c
    return f"{int(t)},{kind},{result},{'' if code is None else code},{'' if ms is None else ms},{by},{sent}"


def _parse_hour(row: Any) -> tuple[int, list[int]] | None:
    """Eine Zeile "stunde,ok,report,fail,test,summe_ms,anzahl_ms,max_ms,ohne_antwort" (ohne Antwort: keine Antwort oder keine Verbindung)."""
    if not isinstance(row, str):
        return None
    try:
        values = [int(v) for v in row.split(",")]
    except ValueError:
        return None
    if len(values) != 9 or values[0] <= 0 or values[0] % HOUR or any(v < 0 for v in values):
        return None
    return values[0], values[1:]


def _parse_day(row: Any) -> tuple[str, list[int]] | None:
    """Eine Zeile "JJJJ-MM-TT,ok,report,fail,test,summe_ms,anzahl_ms,max_ms,ohne_antwort,sekunden_ohne_daten"."""
    if not isinstance(row, str):
        return None
    day, _, rest = row.partition(",")
    try:
        date.fromisoformat(day)
        values = [int(v) for v in rest.split(",")]
    except ValueError:
        return None
    if len(day) != 10 or len(values) != DAY_FIELDS or any(v < 0 for v in values) or values[8] > 90000:
        return None
    return day, values


def _parse_event(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict) or value.get("k") not in EVENT_KINDS or _int(value.get("t"), 1) is None:
        return None
    out: dict[str, Any] = {"k": value["k"], "t": value["t"]}
    if value.get("by") in BY:
        out["by"] = value["by"]
    if value.get("result") in RESULTS:
        out["result"] = value["result"]
    for key in ("code", "ms", "n", "end"):
        if (v := _int(value.get(key))) is not None:
            out[key] = v
    if value.get("sent") in SENT:
        out["sent"] = value["sent"]
    if value.get("from") in ("fail", "report"):
        out["from"] = value["from"]
    if value.get("open") is True:
        out["open"] = True
    return out


class HealthLog:
    """Das Protokoll aller Dienste; gehört zur einen Instanz von HealthCheck."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store = Store(hass, 1, HEALTHLOG_STORE_KEY)
        self.calls: dict[str, list[tuple]] = {}  # aufsteigend: (ts, kind, result, code, ms, by, sent)
        self.hours: dict[str, dict[int, list[int]]] = {}  # Stunde -> [ok, report, fail, test, summe_ms, anzahl_ms, max_ms, ohne_antwort]
        self.days: dict[str, dict[str, list[int]]] = {}  # Tag (JJJJ-MM-TT, Ortszeit) -> wie die Stunde und dazu Sekunden ohne Daten
        self.events: dict[str, list[dict[str, Any]]] = {}  # aufsteigend
        self.state: dict[str, list[Any]] = {}  # [Art ok/report/fail, seit (ts)]
        self.since: dict[str, int] = {}  # erster Aufruf im Protokoll
        self.last: dict[str, int] = {}  # letzter Aufruf (für die Lücken der Tageswerte, auch nach mehr als 24 Stunden ohne Aufruf)
        self._unsub_save: Any = None  # geplantes Schreiben (höchstens eines)
        self._unsub_final: Any = None  # Schreiben beim Beenden von Home Assistant, solange etwas ungeschrieben ist

    async def async_load(self) -> None:
        try:
            stored = await self._store.async_load()
        except Exception:  # noqa: BLE001 - ein kaputtes Protokoll darf die Lebenszeichen nie aufhalten
            _LOGGER.exception("The health check log could not be read; it starts empty")
            return
        if not isinstance(stored, dict):
            return

        def table(key: str) -> Any:
            value = stored.get(key)
            return value.items() if isinstance(value, dict) else ()

        for hid, rows in table("calls"):
            if isinstance(hid, str) and isinstance(rows, list):
                self.calls[hid] = sorted(c for row in rows if (c := _parse_call(row)) is not None)
        for hid, rows in table("hours"):
            if isinstance(hid, str) and isinstance(rows, list):
                self.hours[hid] = dict(h for row in rows if (h := _parse_hour(row)) is not None)
        for hid, rows in table("days"):
            if isinstance(hid, str) and isinstance(rows, list):
                self.days[hid] = dict(d for row in rows if (d := _parse_day(row)) is not None)
        for hid, rows in table("events"):
            if isinstance(hid, str) and isinstance(rows, list):
                self.events[hid] = sorted((e for row in rows if (e := _parse_event(row)) is not None), key=lambda e: e["t"])
        for hid, value in table("state"):
            if isinstance(hid, str) and isinstance(value, list) and len(value) == 2 and value[0] in ("ok", "report", "fail") and _int(value[1], 1) is not None:
                self.state[hid] = [value[0], value[1]]
        for name, target in (("since", self.since), ("last", self.last)):
            for hid, value in table(name):
                if isinstance(hid, str) and _int(value, 1) is not None:
                    target[hid] = value

    def _data(self) -> dict[str, Any]:
        return {
            "since": dict(self.since),
            "last": dict(self.last),
            "state": {hid: list(v) for hid, v in self.state.items()},
            "calls": {hid: [_call_row(c) for c in rows] for hid, rows in self.calls.items()},
            "hours": {hid: [",".join(str(v) for v in (hour, *values)) for hour, values in sorted(rows.items())] for hid, rows in self.hours.items()},
            "days": {hid: [",".join((day, *(str(v) for v in values))) for day, values in sorted(rows.items())] for hid, rows in self.days.items()},
            "events": {hid: [dict(e) for e in rows] for hid, rows in self.events.items()},
        }

    @callback
    def _save(self) -> None:
        # Fällig HEALTHLOG_SAVE_DELAY nach dem ersten ungeschriebenen Aufruf; weitere Aufrufe verschieben das nie (eigener Zeitgeber statt
        # Store.async_delay_save). Beim Beenden von Home Assistant wird geschrieben, auch ohne Entladen der Integration.
        if self._unsub_save is None:
            self._unsub_save = async_call_later(self.hass, HEALTHLOG_SAVE_DELAY, HassJob(self._write, "device panel health check log", cancel_on_shutdown=True))
        if self._unsub_final is None:
            self._unsub_final = self.hass.bus.async_listen_once(EVENT_HOMEASSISTANT_FINAL_WRITE, self._final_write)

    @callback
    def _write(self, _now: Any = None) -> None:
        self._unsub_save = None
        self.hass.async_create_task(self._store.async_save(self._data()), "device panel health check log")

    async def _final_write(self, _event: Event) -> None:
        self._unsub_final = None  # hat schon gefeuert: nie mehr abmelden
        await self.async_save()

    async def async_save(self) -> None:
        if self._unsub_save is not None:
            self._unsub_save()
            self._unsub_save = None
        if self._unsub_final is not None:
            self._unsub_final()
            self._unsub_final = None
        await self._store.async_save(self._data())

    @callback
    def remove(self, hid: str) -> None:
        """Ein entfernter Dienst nimmt sein Protokoll mit."""
        for table in (self.calls, self.hours, self.days, self.events, self.state, self.since, self.last):
            table.pop(hid, None)
        self._save()

    # ----- Aufzeichnen -----

    @callback
    def record(self, hid: str, *, at: datetime, sent: str, result: str, code: int | None, ms: int | None, by: str, interval: int | None = None) -> str:
        """
        Einen Aufruf festhalten; gibt seine Art zurück. `interval` (Sekunden) braucht es für die Lücken der Tageswerte: liegt der letzte Aufruf
        länger als zwei Intervalle zurück, zählt die Zeit dazwischen als "ohne Daten".
        """
        ts = int(at.timestamp())
        kind = call_kind(sent, result, by == "test")
        self.since.setdefault(hid, ts)
        prev = self.last.get(hid)
        if interval and prev is not None and ts - prev > gap_limit(interval):
            self._add_gap(hid, prev + interval, ts)
        self.last[hid] = max(ts, prev or 0)
        self.calls.setdefault(hid, []).append((ts, kind, result, code, ms, by, sent))
        hour = ts - ts % HOUR
        for bucket in (self.hours.setdefault(hid, {}).setdefault(hour, [0] * 8), self._day(hid, _day_of(ts))):
            bucket[KINDS.index(kind)] += 1
            if ms is not None and result == "ok":
                bucket[4] += ms
                bucket[5] += 1
                bucket[6] = max(bucket[6], ms)
            if result in ("timeout", "error"):
                bucket[7] += 1
        self._event(hid, ts, kind, result, code, ms, by, sent)
        self._prune(hid, ts)
        self._save()
        return kind

    def _day(self, hid: str, day: date) -> list[int]:
        return self.days.setdefault(hid, {}).setdefault(day.isoformat(), [0] * DAY_FIELDS)

    def _add_gap(self, hid: str, start: float, end: float, target: dict[str, list[int]] | None = None) -> None:
        """Sekunden ohne Daten auf die Tage verteilen (eine Lücke über Mitternacht zählt je Tag ihren Teil)."""
        t = start
        while t < end:
            day = _day_of(t)
            next_day = _day_start(day + timedelta(days=1))
            if next_day <= t:  # nie ohne Fortschritt (Sicherung gegen eine Endlosschleife)
                break
            piece = min(end, next_day) - t
            if target is None:
                self._day(hid, day)[8] += int(piece)
            else:
                row = target.setdefault(day.isoformat(), [0] * DAY_FIELDS)
                row[8] += int(piece)
            t = min(end, next_day)

    def _event(self, hid: str, ts: int, kind: str, result: str, code: int | None, ms: int | None, by: str, sent: str) -> None:
        events = self.events.setdefault(hid, [])
        state = self.state.get(hid, [None, None])[0]
        base = {"t": ts, "result": result, "by": by, **({"code": code} if code is not None else {}), **({"ms": ms} if ms is not None else {})}
        if kind == "test":
            events.append({**base, "k": "test", "sent": sent})
            return
        if by == "start":
            # Nach dem Start beginnt alles neu: eine Folge von vor dem Neustart läuft nicht weiter
            for e in events:
                e.pop("open", None)
        open_event = next((e for e in reversed(events) if e.get("open")), None)
        if kind in ("fail", "report"):
            # Jeder Fall ist ein eigenes Ereignis: ein gemeldeter Fall läuft nie in einem anderen auf (die Zeile "Gerät ausgefallen" nicht in "Batterie schwach")
            if open_event is not None and open_event["k"] == kind and state == kind and by != "start" and open_event.get("sent") == (sent if kind == "report" else None):
                open_event["n"] = open_event.get("n", 1) + 1
                open_event["end"] = ts
            else:
                if open_event is not None:
                    open_event.pop("open", None)
                events.append({**base, "k": kind, "n": 1, "end": ts, "open": True, **({"sent": sent} if kind == "report" else {})})
        else:
            if open_event is not None:
                open_event.pop("open", None)
            if state in ("fail", "report"):
                events.append({**base, "k": "back", "from": state})
            elif by == "start":
                events.append({**base, "k": "start"})
        if kind != state:
            self.state[hid] = [kind, ts]

    def _prune(self, hid: str, now: int) -> None:
        calls = self.calls.get(hid, [])
        cut = now - HEALTHLOG_CALL_HOURS * HOUR
        if calls and calls[0][0] <= cut:
            self.calls[hid] = [c for c in calls if c[0] > cut]
        hours = self.hours.get(hid, {})
        cut_h = now - HEALTHLOG_HOUR_DAYS * 24 * HOUR
        for hour in [h for h in hours if h + HOUR <= cut_h]:
            del hours[hour]
        days = self.days.get(hid, {})
        cut_d = (_day_of(now) - timedelta(days=HEALTHLOG_DAY_DAYS)).isoformat()
        for day in [d for d in days if d <= cut_d]:
            del days[day]
        events = self.events.get(hid, [])
        cut_e = now - HEALTHLOG_EVENT_DAYS * 24 * HOUR
        kept = [e for e in events if e.get("end", e["t"]) > cut_e]
        if len(kept) > HEALTHLOG_EVENT_MAX:
            kept = kept[-HEALTHLOG_EVENT_MAX:]
        if len(kept) != len(events):
            self.events[hid] = kept

    # ----- Abfrage für das Panel -----

    def history(self, hid: str, hours: int, interval: int, now: datetime | None = None) -> dict[str, Any]:
        """
        Antwort für die Ansicht eines Dienstes im gewählten Zeitraum: Kennzahlen, Grafik (bis 1 Tag je Aufruf, bis 30 Tage je Stunde, darüber je
        Tag), Lücken ohne Daten, Ereignisse und einzelne Aufrufe. Zahl und Liste gelten immer für denselben Zeitraum (Vorgabe des Nutzers
        2026-11-19); einzelne Aufrufe gibt es nur für die letzten HEALTHLOG_CALL_HOURS Stunden (`calls_from`). Über 30 Tage beginnt der Zeitraum
        um Mitternacht (Ortszeit) des ersten der gewählten Tage, damit Grafik, Kennzahlen und Liste dieselben ganzen Tage zeigen.
        """
        now_ts = (now or dt_util.utcnow()).timestamp()
        daily = hours > HEALTHLOG_HOUR_DAYS * 24
        today = _day_of(now_ts)
        first_day = today - timedelta(days=hours // 24 - 1)
        start = _day_start(first_day) if daily else now_ts - hours * HOUR
        calls = [c for c in self.calls.get(hid, []) if start < c[0] <= now_ts]
        all_calls = self.calls.get(hid, [])
        last = all_calls[-1] if all_calls else None
        events = [e for e in self.events.get(hid, []) if e.get("end", e["t"]) > start and e["t"] <= now_ts]
        state = self.state.get(hid)
        out: dict[str, Any] = {
            "id": hid, "hours": hours, "now": _iso(now_ts), "start": _iso(start), "interval": interval, "gap_day": HEALTHLOG_GAP_DAY_MINUTES,
            "since": _iso(self.since.get(hid)),
            "state": {"state": state[0], "since": _iso(state[1])} if state else {"state": None, "since": None},
            "last": {"t": _iso(last[0]), "kind": last[1], "result": last[2], "code": last[3], "ms": last[4]} if last else None,
            "points": [], "hourly": [], "daily": [], "gaps": [], "marks": [],
            # Marken der Zeitleiste und der Antwortzeit über 7 und 30 Tage (einzelne Aufrufe gibt es dort nicht mehr): alle Fehler, gemeldeten Fehler
            # und Tests des Zeitraums, nie gekürzt (höchstens HEALTHLOG_EVENT_MAX)
            "events": [self._event_out(e) for e in reversed(events)][:LIST_MAX], "events_total": len(events),
            "calls": [{"t": _iso(c[0]), "kind": c[1], "result": c[2], "code": c[3], "ms": c[4], "by": c[5], "sent": c[6]} for c in reversed(calls)][:LIST_MAX],
            "calls_total": len(calls),
            "calls_from": _iso(all_calls[0][0]) if all_calls else None,
        }
        if hours <= HEALTHLOG_CALL_HOURS:
            counts = {k: sum(1 for c in calls if c[1] == k) for k in KINDS}
            times = [c[4] for c in calls if c[4] is not None and c[2] == "ok"]
            ms_sum, ms_n, ms_max = sum(times), len(times), max(times, default=None)
            no_answer = sum(1 for c in calls if c[2] in ("timeout", "error"))
            out["points"] = [[_iso(c[0]), c[1], c[4]] for c in calls]
        else:
            if daily:
                # Tage des Zeitraums, dazu eine Lücke, die gerade läuft (seit dem letzten Aufruf nichts mehr)
                rows = {d: list(v) for d, v in self.days.get(hid, {}).items() if first_day.isoformat() <= d <= today.isoformat()}
                prev = self.last.get(hid)
                if prev is not None and now_ts - prev > gap_limit(interval):
                    self._add_gap(hid, max(prev + interval, start), now_ts, rows)
                table = list(rows.values())
                out["daily"] = [[d, *v[:4], round(v[4] / v[5]) if v[5] else None, v[6] if v[5] else None, v[7], round(v[8] / 60)] for d, v in sorted(rows.items())]
            else:
                per_hour = {h: v for h, v in self.hours.get(hid, {}).items() if h + HOUR > start and h <= now_ts}
                table = list(per_hour.values())
                out["hourly"] = [[_iso(h), *v[:4], round(v[4] / v[5]) if v[5] else None, v[6] if v[5] else None] for h, v in sorted(per_hour.items())]
            counts = {k: sum(v[i] for v in table) for i, k in enumerate(KINDS)}
            ms_sum, ms_n = sum(v[4] for v in table), sum(v[5] for v in table)
            ms_max = max((v[6] for v in table if v[5]), default=None)
            no_answer = sum(v[7] for v in table)
            out["marks"] = [[_iso(e["t"]), _iso(e["end"]) if e.get("n", 1) > 1 and e.get("end") else None, e["k"]] for e in events if e["k"] in ("fail", "report", "test")]
        if not daily:
            out["gaps"] = [[_iso(a), _iso(b)] for a, b in self.gaps(hid, start, now_ts, interval, hours)]
        total = sum(counts.values())
        out["summary"] = {
            **counts, "total": total,
            "rate": round(100 * (total - counts["fail"]) / total, 2 if daily else 1) if total else None,
            "ms_mean": round(ms_sum / ms_n) if ms_n else None, "ms_max": ms_max, "no_answer": no_answer,
        }
        return out

    def brief(self, hid: str) -> dict[str, Any] | None:
        """Zustand seit wann, für die Liste der Dienste und die Auswahl im Kopf des Protokolls (jede Antwort von `data`: nur nachschlagen)."""
        state = self.state.get(hid)
        return {"state": state[0], "since": _iso(state[1])} if state else None

    @staticmethod
    def _event_out(e: dict[str, Any]) -> dict[str, Any]:
        out = {k: v for k, v in e.items() if k not in ("t", "end", "open")}
        out["t"] = _iso(e["t"])
        out["end"] = _iso(e.get("end")) if e.get("n", 1) > 1 else None
        out["kind"] = out.pop("k")
        return out

    def gaps(self, hid: str, start: float, now: float, interval: int, hours: int) -> list[tuple[float, float]]:
        """
        Zeiten ohne Daten (Home Assistant aus, Netz weg, bevor ein Aufruf hinausging): länger als zwei Abstände ohne einen einzigen Aufruf. Bis
        1 Tag aus den einzelnen Aufrufen, bis 30 Tage aus den Stundenwerten. Vor dem ersten Aufruf im Protokoll gibt es keine Lücke, nur nichts.
        """
        since = self.since.get(hid)
        if since is None:
            return []
        limit = gap_limit(interval)
        low = max(start, since)
        out: list[tuple[float, float]] = []
        if hours <= HEALTHLOG_CALL_HOURS:
            times = [c[0] for c in self.calls.get(hid, []) if c[0] <= now]
            prev: float | None = None
            for t in [*times, now]:
                if prev is not None and t - prev > limit:
                    a, b = max(low, prev + interval), min(now, t)
                    if b > a:
                        out.append((a, b))
                prev = t
            return out
        hours_with_calls = {h for h, v in self.hours.get(hid, {}).items() if sum(v[:4])}
        run: float | None = None
        hour = math.floor(low / HOUR) * HOUR
        while hour <= now:
            if hour in hours_with_calls:
                if run is not None and hour - run > limit:
                    out.append((max(low, run), hour))
                run = None
            elif run is None:
                run = hour
            hour += HOUR
        if run is not None and now - run > limit:
            out.append((max(low, run), now))
        return out
