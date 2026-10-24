"""
Protokoll je Magic-Push-Meldung und Routine (seit 2.104.0): jede Ausführung mit Datum, bei Magic Push mit dem Inhalt der
Meldung, bei Routinen mit dem Ablauf (Trace). Seit 2.105.0 gibt es keine Zeitgrenze mehr: Aufbewahrt werden höchstens so viele Einträge
je Meldung oder Routine, wie die Einstellung "protocol_max_entries" sagt, und alle Protokolle zusammen höchstens "protocol_max_mb" MB
(Grösse des gespeicherten JSON); ist eine Grenze erreicht, fällt der älteste Eintrag weg (bei den MB der älteste über alle Meldungen
und Routinen). Jede Meldung oder Routine liegt in einer eigenen Datei (Store), damit ein Schreiben nur sie betrifft; geschrieben wird
verzögert (SAVE_DELAY_S), beim Beenden von Home Assistant sofort.

Eintrag Magic Push: at, k (fired, repeat, recovered, test), res (sent, held, failed, no_target), title, body, value, target, err, dur.
Eintrag Routine: at, k (run, revert, missed, paused, retry, failed, test), src (time, trigger, manual, revert, test), ok, act, ent, err,
late, trace (Liste von {s: Schritt, v: Angaben}); das Panel macht daraus die Sätze in der Sprache des Benutzers.
"""

from __future__ import annotations

import bisect
import json
import logging
import time
from datetime import timedelta
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import CONF_PROTOCOL_ENTRIES, CONF_PROTOCOL_MB, DOMAIN

_LOGGER = logging.getLogger(__name__)

# Das Diagramm zeigt höchstens so viele Wochen (die neuesten); ältere Einträge zählen nur in Tabelle und Kennzahlen
CHART_WEEKS_MAX = 399
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


def entry_size(entry: dict[str, Any]) -> int:
    """Grösse eines Eintrags im gespeicherten JSON in Byte (mit Trenner)."""
    return len(json.dumps(entry, ensure_ascii=False, separators=(",", ":")).encode()) + 1


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
        # Grösse der Einträge je Meldung oder Routine in Byte (zusammen die Grösse aller Protokolle)
        self._bytes: dict[str, int] = {}
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
            self._bytes[item_id] = sum(entry_size(e) for e in self._data[item_id])
        self.enforce()

    async def async_prune(self, valid: set[str]) -> None:
        """Protokolle von Meldungen und Routinen, die es nicht mehr gibt, löschen (zum Beispiel nach einer Wiederherstellung)."""
        for item_id in [i for i in self._data if i not in valid]:
            await self.async_forget(item_id)

    async def async_forget(self, item_id: str) -> None:
        self._data.pop(item_id, None)
        self._bytes.pop(item_id, None)
        await self._store(item_id).async_remove()
        self._stores.pop(item_id, None)
        self._save_index()

    async def async_remove_all(self) -> None:
        """Integration entfernt: alle Dateien löschen."""
        for item_id in list(self._data):
            await self._store(item_id).async_remove()
        self._data.clear()
        self._bytes.clear()
        await self._index.async_remove()

    def _save_index(self) -> None:
        self._index.async_delay_save(lambda: {"ids": sorted(self._data)}, SAVE_DELAY_S)

    def limits(self) -> tuple[int, int]:
        """(Obergrenze aller Protokolle in Byte, Einträge je Meldung oder Routine) nach den Einstellungen."""
        from .options_api import effective  # noqa: PLC0415 (options_api meldet seinerseits an activity)

        opts = effective(self.hass)
        return int(opts[CONF_PROTOCOL_MB]) * 1024 * 1024, int(opts[CONF_PROTOCOL_ENTRIES])

    def _schedule(self, item_id: str) -> None:
        self._store(item_id).async_delay_save(lambda: {"entries": self._data.get(item_id, [])}, SAVE_DELAY_S)

    def _drop_oldest(self, item_id: str) -> None:
        entries = self._data[item_id]
        self._bytes[item_id] = max(0, self._bytes.get(item_id, 0) - entry_size(entries.pop(0)))

    def enforce(self, touched: str | None = None) -> None:
        """
        Grenzen anwenden: je Meldung oder Routine die Zahl der Einträge, dann alle zusammen die Grösse (der älteste Eintrag über alle
        fällt weg). Nach dem Ändern der Einstellung für alle, sonst nur für die Meldung, zu der gerade ein Eintrag kam.
        """
        max_bytes, max_entries = self.limits()
        changed: set[str] = set()
        for item_id in [touched] if touched else list(self._data):
            entries = self._data.get(item_id, [])
            while len(entries) > max_entries:
                self._drop_oldest(item_id)
                changed.add(item_id)
        while sum(self._bytes.values()) > max_bytes:
            nonempty = [i for i, e in self._data.items() if e]
            if not nonempty:
                break
            oldest = min(nonempty, key=lambda i: self._data[i][0]["at"])
            self._drop_oldest(oldest)
            changed.add(oldest)
        for item_id in changed:
            self._schedule(item_id)

    def usage(self) -> dict[str, int]:
        """Belegung für die Einstellungen: Byte, Einträge, Zahl der Meldungen und Routinen mit Einträgen, die grösste Zahl je Meldung."""
        return {
            "bytes": sum(self._bytes.values()),
            "entries": sum(len(e) for e in self._data.values()),
            "items": sum(1 for e in self._data.values() if e),
            "max_item": max((len(e) for e in self._data.values()), default=0),
        }

    @callback
    def add(self, item_id: str, entry: dict[str, Any]) -> None:
        """Einen Eintrag anhängen; ein Fehler hier darf nie die Meldung oder die Routine stören."""
        try:
            entries = self._data.get(item_id)
            if entries is None:
                entries = self._data[item_id] = []
                self._bytes[item_id] = 0
                self._save_index()
            clean = clean_entry(entry)
            entries.append(clean)
            self._bytes[item_id] += entry_size(clean)
            self.enforce(item_id)
            self._schedule(item_id)
        except Exception:  # noqa: BLE001
            _LOGGER.debug("Protokoll: Eintrag für %s nicht gespeichert", item_id, exc_info=True)

    def entries(self, item_id: str) -> list[dict[str, Any]]:
        return self._data.get(item_id, [])

    # -- Abfrage ---------------------------------------------------------------------------------------------------------

    def query(
        self,
        kind: str,
        items: dict[str, str],
        *,
        since: float | None,
        until: float,
        filter_: str | None = None,
        text: str = "",
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """
        Einträge der Meldungen oder Routinen "items" ({id: Name}) im Zeitraum, neueste zuerst. Die Zahlen gelten für den ganzen
        Zeitraum, Tabelle und Diagramm zusätzlich für Auswahl, Filter und Suchtext (seit 2.122.0 auch das Diagramm). Ohne "since" gilt alles ab dem ältesten Eintrag.
        """
        tz = dt_util.get_default_time_zone()
        oldest = min((e["at"] for item_id in items for e in self._data.get(item_id, [])), default=None)
        if since is None:
            since = oldest if oldest is not None and oldest < until else until
        scope: list[dict[str, Any]] = []
        for item_id, name in items.items():
            for entry in self._data.get(item_id, []):
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
            "buckets": _buckets(shown, max(since, until - CHART_WEEKS_MAX * 7 * 86400) if step_days == 7 else since, until, step_days, tz),
            "oldest": oldest,
            "since": since,
        }


def _buckets(scope: list[dict[str, Any]], since: float, until: float, step_days: int, tz: Any, is_bad: Any = None) -> list[dict[str, Any]]:
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
    keys = [b["t"] for b in out]
    for e in scope:
        i = bisect.bisect_right(keys, e["at"]) - 1
        if 0 <= i < len(out):
            out[i]["n"] += 1
            if (is_bad(e) if is_bad is not None else e.get("res") in ("failed", "no_target") or e.get("k") in ("failed", "missed")):
                out[i]["bad"] += 1
    return out
