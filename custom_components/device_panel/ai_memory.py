"""
Die letzte KI-Einschätzung je Gerät (seit 2.45.0): Sie bleibt über Neustarts gespeichert, das Pop-up zeigt sie beim Öffnen wieder,
und die nächste Einschätzung bekommt sie als Fakt "previous_assessment" mit. So kann die KI sagen, was sich seit dem letzten Mal
geändert hat, und wiederholt sich nicht blind. Gespeichert wird nur der Text der Antwort mit Zeit und Quelle, nichts vom Prompt.
"""

from __future__ import annotations

import time
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import DOMAIN

STORE_KEY = f"{DOMAIN}.ai"
STORAGE_VERSION = 1
DATA_KEY = f"{DOMAIN}_ai_memory"
# Höchstens so viele Geräte merken (die ältesten fallen weg) und so lange gilt eine Einschätzung als Bezug.
MAX_DEVICES = 150
MAX_AGE = 30 * 86400
TEXT_MAX = 2000
# Vorschläge für Rückfragen (seit 2.51.0): so viele, so lang (wie in ai_assessment)
NEXT_MAX = 3
NEXT_LENGTH = 60


class AiMemory:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORE_KEY)
        self._data: dict[str, dict[str, Any]] = {}

    async def async_load(self) -> None:
        stored = await self._store.async_load() or {}
        for dev, item in (stored.get("devices") or {}).items():
            if isinstance(dev, str) and isinstance(item, dict) and isinstance(item.get("at"), (int, float)) and isinstance(item.get("text"), str):
                self._data[dev] = {
                    "at": float(item["at"]),
                    "title": str(item.get("title") or ""),
                    "text": item["text"][:TEXT_MAX],
                    "source": item.get("source") if isinstance(item.get("source"), str) else None,
                    "status": item.get("status") if isinstance(item.get("status"), str) else None,
                    "next": [s[:NEXT_LENGTH] for s in (item.get("next") or []) if isinstance(s, str) and s.strip()][:NEXT_MAX] if isinstance(item.get("next"), list) else [],
                }

    def get(self, device_id: str, now: float | None = None) -> dict[str, Any] | None:
        item = self._data.get(device_id)
        if item is None or (now if now is not None else time.time()) - item["at"] > MAX_AGE:
            return None
        return item

    def set(
        self, device_id: str, title: str, text: str, source: str | None, status: str | None, now: float | None = None, suggestions: list[str] | None = None
    ) -> None:
        self._data[device_id] = {
            "at": now if now is not None else time.time(), "title": title, "text": text[:TEXT_MAX], "source": source, "status": status,
            "next": [s[:NEXT_LENGTH] for s in (suggestions or [])][:NEXT_MAX],
        }
        if len(self._data) > MAX_DEVICES:
            for dev, _item in sorted(self._data.items(), key=lambda kv: kv[1]["at"])[: len(self._data) - MAX_DEVICES]:
                del self._data[dev]
        self._store.async_delay_save(lambda: {"devices": self._data}, 10)

    def forget(self, device_id: str) -> None:
        if self._data.pop(device_id, None) is not None:
            self._store.async_delay_save(lambda: {"devices": self._data}, 10)


async def async_get(hass: HomeAssistant) -> AiMemory:
    memory = hass.data.get(DATA_KEY)
    if memory is None:
        memory = AiMemory(hass)
        await memory.async_load()
        hass.data[DATA_KEY] = memory
    return memory
