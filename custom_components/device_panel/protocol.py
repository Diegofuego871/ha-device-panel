"""
Protokoll je Magic-Push-Meldung und Routine (seit 2.104.0): jede Ausführung mit Datum, bei Magic Push mit dem Inhalt der
Meldung, bei Routinen mit dem Ablauf (Trace). Aufbewahrt werden RETENTION_DAYS Tage, höchstens MAX_ENTRIES Einträge je
Meldung oder Routine (die ältesten fallen weg). Jeder Eintrag liegt in einer eigenen Datei (Store), damit ein Schreiben nur die
betroffene Meldung betrifft; geschrieben wird verzögert (SAVE_DELAY_S), beim Beenden von Home Assistant sofort.

Eintrag Magic Push: at, k (fired, repeat, recovered, test), res (sent, held, failed, no_target), title, body, value, target, err, dur.
Eintrag Routine: at, k (run, revert, missed, paused, retry, failed, test), src (time, trigger, manual, revert, test), ok, act, ent, err,
late, trace (Liste von {s: Schritt, v: Angaben}); das Panel macht daraus die Sätze in der Sprache des Benutzers.
"""

from __future__ import annotations

import logging
import time
from datetime import timedelta
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

RETENTION_DAYS = 366
MAX_ENTRIES = 4000
SAVE_DELAY_S = 30
STORE_VERSION = 1
INDEX_KEY = f"{DOMAIN}.protocol_index"
TITLE_MAX = 300
BODY_MAX = 800
ERR_MAX = 200
# Ab so vielen Tagen im Zeitraum zählt das Diagramm je Woche statt je Tag
WEEK_FROM_DAYS = 120

# Auswahl in der Tabelle: Name -> Prüfung des Eintrags
FILTERS: dict[str, dict[str, Any]] = {
    "magic": {
        "fired": lambda e: e.get("k") in ("fired", "repeat"),
        "recovered": lambda e: e.get("k") == "recovered",
        "test": lambda e: e.get("k") == "test",
        "held": lambda e: e.get("res") == "held",
        "failed": lambda e: e.get("res") in ("failed", "no_target"),
    },
    "routine": {
        "run": lambda e: e.get("k") == "run" and e.get("src") != "manual",
        "revert": lambda e: e.get("k") == "revert",
        "missed": lambda e: e.get("k") in ("missed", "paused"),
        "failed": lambda e: e.get("k") == "failed",
        "manual": lambda e: e.get("src") == "manual",
    },
}


def _cut(value: Any, size: int) -> str:
    text = " ".join(str(value or "").split())
    return text if len(text) <= size else text[: size - 1] + "…"


def clean_entry(entry: dict[str, Any]) -> dict[str, Any]:
    """Eintrag auf bekannte Felder und Längen bringen (Speicher klein halten)."""
    out: dict[str, Any] = {}
    for key, value in entry.items():
        if value in (None, "", [], {}):
            continue
        if key in ("title", "value", "target"):
            out[key] = _cut(value, TITLE_MAX)
        elif key == "body":
            out[key] = str(value)[:BODY_MAX]
        elif key == "err":
            out[key] = _cut(value, ERR_MAX)
        else:
            out[key] = value
    out.setdefault("at", time.time())
    return out


class Protocol:
    """Alle Protokolle im Speicher, je Eintrag eine Datei."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._data: dict[str, list[dict[str, Any]]] = {}
        self._stores: dict[str, Store] = {}
        self._index = Store(hass, STORE_VERSION, INDEX_KEY)

    def _store(self, item_id: str) -> Store:
        store = self._stores.get(item_id)
        if store is None:
            store = self._stores[item_id] = Store(self.hass, STORE_VERSION, f"{DOMAIN}.protocol_{item_id}")
        return store

    async def async_load(self) -> None:
        """Beim Start: alle bekannten Protokolle lesen (die Liste steht im Index)."""
        index = await self._index.async_load()
        ids = index.get("ids") if isinstance(index, dict) else None
        for item_id in ids if isinstance(ids, list) else []:
            if not isinstance(item_id, str):
                continue
            raw = await self._store(item_id).async_load()
            entries = raw.get("entries") if isinstance(raw, dict) else None
            self._data[item_id] = [e for e in entries if isinstance(e, dict) and isinstance(e.get("at"), (int, float))] if isinstance(entries, list) else []

    async def async_prune(self, valid: set[str]) -> None:
        """Protokolle von Meldungen und Routinen, die es nicht mehr gibt, löschen (zum Beispiel nach einer Wiederherstellung)."""
        for item_id in [i for i in self._data if i not in valid]:
            await self.async_forget(item_id)

    async def async_forget(self, item_id: str) -> None:
        self._data.pop(item_id, None)
        await self._store(item_id).async_remove()
        self._stores.pop(item_id, None)
        self._save_index()

    async def async_remove_all(self) -> None:
        """Integration entfernt: alle Dateien löschen."""
        for item_id in list(self._data):
            await self._store(item_id).async_remove()
        self._data.clear()
        await self._index.async_remove()

    def _save_index(self) -> None:
        self._index.async_delay_save(lambda: {"ids": sorted(self._data)}, SAVE_DELAY_S)

    def _trim(self, entries: list[dict[str, Any]]) -> None:
        horizon = time.time() - RETENTION_DAYS * 86400
        while entries and (entries[0]["at"] < horizon or len(entries) > MAX_ENTRIES):
            entries.pop(0)

    @callback
    def add(self, item_id: str, entry: dict[str, Any]) -> None:
        """Einen Eintrag anhängen; ein Fehler hier darf nie die Meldung oder die Routine stören."""
        try:
            entries = self._data.get(item_id)
            if entries is None:
                entries = self._data[item_id] = []
                self._save_index()
            entries.append(clean_entry(entry))
            self._trim(entries)
            self._store(item_id).async_delay_save(lambda: {"entries": self._data.get(item_id, [])}, SAVE_DELAY_S)
        except Exception:  # noqa: BLE001
            _LOGGER.debug("Protokoll: Eintrag für %s nicht gespeichert", item_id, exc_info=True)

    def entries(self, item_id: str) -> list[dict[str, Any]]:
        return self._data.get(item_id, [])

    def capped(self, item_id: str) -> bool:
        """Wurden schon Einträge wegen der Obergrenze verworfen? (Es gilt: so viele Einträge wie die Obergrenze.)"""
        return len(self._data.get(item_id, [])) >= MAX_ENTRIES

    # -- Abfrage ---------------------------------------------------------------------------------------------------------

    def query(
        self,
        kind: str,
        items: dict[str, str],
        *,
        since: float,
        until: float,
        filter_: str | None = None,
        text: str = "",
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """
        Einträge der Meldungen oder Routinen "items" ({id: Name}) im Zeitraum, neueste zuerst. Zahlen und Diagramm gelten für den ganzen
        Zeitraum, die Tabelle zusätzlich für Auswahl und Suchtext.
        """
        tz = dt_util.get_default_time_zone()
        scope: list[dict[str, Any]] = []
        oldest: float | None = None
        for item_id, name in items.items():
            for entry in self._data.get(item_id, []):
                if oldest is None or entry["at"] < oldest:
                    oldest = entry["at"]
                if since <= entry["at"] <= until:
                    scope.append({**entry, "id": item_id, "name": name})
        scope.sort(key=lambda e: e["at"], reverse=True)

        counts: dict[str, int] = {}
        longest = 0.0
        late_ok = late_n = 0
        for e in scope:
            counts[e.get("k", "")] = counts.get(e.get("k", ""), 0) + 1
            if kind == "magic":
                counts[f"res_{e.get('res', '')}"] = counts.get(f"res_{e.get('res', '')}", 0) + 1
                longest = max(longest, float(e.get("dur") or 0))
            elif e.get("k") == "run" and e.get("late") is not None:
                late_n += 1
                late_ok += 1 if float(e["late"]) <= 60 else 0
        needle = text.strip().lower()
        check = FILTERS.get(kind, {}).get(filter_ or "")
        shown = [
            e
            for e in scope
            if (check is None or check(e))
            and (not needle or needle in f"{e.get('title', '')} {e.get('body', '')} {e.get('err', '')} {e.get('name', '')} {e.get('value', '')}".lower())
        ]
        step_days = 7 if (until - since) / 86400 > WEEK_FROM_DAYS else 1
        return {
            "counts": counts,
            "longest_s": longest or None,
            "punctual": round(100 * late_ok / late_n) if late_n else None,
            "total": len(shown),
            "all": len(scope),
            "entries": shown[offset : offset + limit],
            "step": "week" if step_days == 7 else "day",
            "buckets": _buckets(scope, since, until, step_days, tz),
            "oldest": oldest,
            "capped": any(self.capped(i) for i in items),
        }


def _buckets(scope: list[dict[str, Any]], since: float, until: float, step_days: int, tz: Any) -> list[dict[str, Any]]:
    """Dichte Liste der Tage (oder Wochen ab Montag) im Zeitraum mit der Zahl der Einträge und der davon problematischen."""
    first = dt_util.as_local(dt_util.utc_from_timestamp(since)).astimezone(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    if step_days == 7:
        first -= timedelta(days=first.weekday())
    last = dt_util.utc_from_timestamp(until).astimezone(tz)
    starts: list[Any] = []
    cur = first
    while cur <= last and len(starts) < 400:
        starts.append(cur)
        cur = (cur + timedelta(days=step_days)).replace(hour=0, minute=0, second=0, microsecond=0)
    out = [{"t": s.timestamp(), "n": 0, "bad": 0} for s in starts]
    if not out:
        return out
    import bisect

    keys = [b["t"] for b in out]
    for e in scope:
        i = bisect.bisect_right(keys, e["at"]) - 1
        if 0 <= i < len(out):
            out[i]["n"] += 1
            if e.get("res") in ("failed", "no_target") or e.get("k") in ("failed", "missed"):
                out[i]["bad"] += 1
    return out
