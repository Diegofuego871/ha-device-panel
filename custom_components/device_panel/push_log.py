"""
Gesendete Meldungen (seit 2.124.0): eigener Speicher mit eigener Aufbewahrung, getrennt vom Panel-Log.

Im Panel-Log (activity.py) zählen die Einträge nach Zahl und Grösse für alle Arten zusammen; bei viel Betrieb verdrängen häufige Einträge die
Meldungen. Hier bleibt jede Meldung so lange, wie "Aufbewahrung" (Tage) und "Grösse" (MB) erlauben (Panel › Speicher). Das Geräteprotokoll
(devicelog.py) liest die Meldungen von hier.

Eintrag: {"at", "devs": [Geräte-IDs], "p": {"title", "body", "target", "topic", "res"}}; res ist "sent", "held", "failed" oder "missing".
Eine Sammelmeldung ist ein Eintrag mit mehreren Geräten.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store

from . import activity
from .const import CONF_PUSH_DAYS, CONF_PUSH_MB, DOMAIN, STORAGE_VERSION
from .options_api import effective
from .storage_util import PeriodicSaver

_LOGGER = logging.getLogger(__name__)

PUSH_STORE_KEY = f"{DOMAIN}.push_log"
SAVE_DELAY = 60
BODY_MAX = 600
TITLE_MAX = 200
DEVICES_MAX = 50
RESULTS = ("sent", "held", "failed", "missing")
KEYS = ("title", "body", "target", "topic", "res")


def _valid(item: Any) -> bool:
    if not isinstance(item, dict) or not isinstance(item.get("at"), (int, float)) or not isinstance(item.get("devs"), list):
        return False
    p = item.get("p")
    return isinstance(p, dict) and all(isinstance(p.get(k), str) for k in KEYS) and p["res"] in RESULTS


class PushLog:
    """Die gesendeten Meldungen mit Geräten, älteste zuerst."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._items: list[dict[str, Any]] = []
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, PUSH_STORE_KEY)
        self._saver = PeriodicSaver(self._store, self.data, SAVE_DELAY)
        self._trimmed_at = 0.0

    # -- Speicher --------------------------------------------------------------

    def data(self) -> dict[str, Any]:
        return {"items": self._items}

    async def async_start(self) -> None:
        try:
            stored = await self._store.async_load()
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Meldungsprotokoll konnte nicht geladen werden: %s", err)
            stored = None
        if isinstance(stored, dict):
            self._items = sorted((i for i in stored.get("items", []) if _valid(i)), key=lambda i: i["at"])
        else:
            self._items = self._from_activity()
            if self._items:
                self._saver.schedule()
        self._enforce()

    async def async_stop(self) -> None:
        await self._saver.async_save()

    async def async_remove(self) -> None:
        self._items = []
        await self._store.async_remove()

    def _from_activity(self) -> list[dict[str, Any]]:
        """Einmalig: Meldungen, die 2.123.0 noch im Panel-Log führte, hierher übernehmen."""
        out: list[dict[str, Any]] = []
        for e in activity.get(self.hass).entries:
            p = e.get("push")
            ids = e.get("device_ids") or ([e["device_id"]] if e.get("device_id") else [])
            if e.get("cat") == "push" and ids and isinstance(p, dict) and _valid({"at": e.get("at"), "devs": ids, "p": p}):
                out.append({"at": e["at"], "devs": [d for d in ids if isinstance(d, str)][:DEVICES_MAX], "p": {k: p[k] for k in KEYS}})
        return sorted(out, key=lambda i: i["at"])

    # -- Schreiben -------------------------------------------------------------

    @callback
    def add(self, devices: list[str], title: str, message: str, target: str, topic: str, res: str) -> None:
        """Eine Meldung aufnehmen (nur mit Geräten: Meldungen ohne Gerät gehören ins Panel-Log)."""
        ids = [d for d in devices if isinstance(d, str)][:DEVICES_MAX]
        if not ids or res not in RESULTS:
            return
        self._items.append(
            {"at": time.time(), "devs": ids, "p": {"title": title[:TITLE_MAX], "body": message[:BODY_MAX], "target": target, "topic": topic or "", "res": res}}
        )
        now = time.time()
        # Nur stündlich nach Tagen und Grösse prüfen: das Messen der Grösse ist nicht gratis
        if now - self._trimmed_at > 3600:
            self._trimmed_at = now
            self._enforce()
        self._saver.schedule()

    # -- Grenzen ---------------------------------------------------------------

    def size(self) -> int:
        """Grösse im gespeicherten JSON in Byte."""
        return len(json.dumps(self._items, ensure_ascii=False, separators=(",", ":")).encode())

    def _enforce(self) -> bool:
        """Älter als die Aufbewahrung oder über der Grösse: die ältesten weg. True, wenn etwas wegfiel."""
        opts = effective(self.hass)
        before = len(self._items)
        cutoff = time.time() - int(opts[CONF_PUSH_DAYS]) * 86400
        self._items = [i for i in self._items if i["at"] >= cutoff]
        max_bytes = int(opts[CONF_PUSH_MB]) * 1048576
        size = self.size()
        if size > max_bytes and self._items:
            # Mit etwas Luft, damit das nächste Prüfen nicht gleich wieder kürzt
            keep = max(0, int(len(self._items) * (max_bytes * 0.9) / size))
            self._items = self._items[len(self._items) - keep :]
        return len(self._items) != before

    @callback
    def apply_limits(self) -> None:
        """Eine tiefere Grenze wirkt sofort (Einstellungen geändert)."""
        self._trimmed_at = time.time()
        if self._enforce():
            self._saver.schedule()

    def usage(self) -> dict[str, int]:
        """Belegung für Panel › Speicher: Byte, Meldungen, Geräte und Tage der ältesten."""
        first = self._items[0]["at"] if self._items else None
        return {
            "bytes": self.size(),
            "entries": len(self._items),
            "devices": len({d for i in self._items for d in i["devs"]}),
            "days": max(0, int((time.time() - first) / 86400)) if first else 0,
        }

    # -- Abfrage ---------------------------------------------------------------

    def items(self, device: str | None, since: float, until: float) -> list[dict[str, Any]]:
        """Meldungen im Zeitraum, auf ein Gerät beschränkt, wenn angegeben (älteste zuerst)."""
        return [i for i in self._items if since <= i["at"] <= until and (device is None or device in i["devs"])]
