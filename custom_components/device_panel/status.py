"""
Status (seit 2.62.0): Läuft die Integration? Ein Wächter prüft jede Minute, ob die Teile noch leben, zeigt es in der Status-App und
meldet per Push, wenn ein Teil steht (und wenn er wieder läuft).

Lebenszeichen: Teile mit festem Takt (Ausfall-Überwachung, Batterie, Laden, Empfangsverlauf) merken sich ihren letzten Takt in "last_tick".
Routinen werden daran gemessen, ob etwas überfällig ist (fällig, aber nicht gelaufen). Magic Push, Neue Geräte und Updates sind
ereignisgesteuert und haben keinen Takt; für sie gilt nur, dass sie geladen sind. Grenze: Steht Home Assistant selbst, kann dieser
Wächter nichts melden; dafür braucht es etwas ausserhalb (zum Beispiel einen externen Ping).
"""

from __future__ import annotations

import logging
import time
from datetime import timedelta
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers.event import async_track_time_interval

from . import activity, push
from .const import (
    CONF_STATUS_NOTIFY,
    DATA_AVAILABILITY,
    DATA_BATTERY,
    DATA_CHARGE,
    DATA_MAGIC,
    DATA_NEW,
    DATA_ROUTINES,
    DATA_SIGNAL,
    DATA_STATUS,
    DATA_UPDATES,
    DOMAIN,
    NOTIFY_NONE,
)
from .options_api import effective, notify_target

_LOGGER = logging.getLogger(__name__)

CHECK_INTERVAL = timedelta(seconds=60)
# Verspätet ab dem 4fachen des Takts (mindestens 2 Min.), steht ab dem 10fachen (mindestens 5 Min.): Home Assistant darf kurz stocken
LATE_FACTOR, LATE_MIN_S = 4, 120
DOWN_FACTOR, DOWN_MIN_S = 10, 300

# Teile mit festem Takt: (Schlüssel, Daten in hass.data, Takt in Sekunden)
TICK_PARTS = (
    ("availability", DATA_AVAILABILITY, 30),
    ("battery", DATA_BATTERY, 60),
    ("charge", DATA_CHARGE, 60),
    ("signal", DATA_SIGNAL, 60),
)
# Ereignisgesteuerte Teile ohne Takt: (Schlüssel, Daten in hass.data)
LOADED_PARTS = (("magic", DATA_MAGIC), ("new", DATA_NEW), ("updates", DATA_UPDATES))
# Reihenfolge in der Status-App
ORDER = ("routines", "magic", "availability", "battery", "charge", "new", "updates", "signal")


def classify(age_s: float, interval_s: float) -> str:
    """"ok", "late" (verspätet) oder "down" (steht) für ein Lebenszeichen, das age_s alt ist, bei einem Takt von interval_s."""
    if age_s > max(DOWN_MIN_S, DOWN_FACTOR * interval_s):
        return "down"
    if age_s > max(LATE_MIN_S, LATE_FACTOR * interval_s):
        return "late"
    return "ok"


class StatusWatch:
    """Der Wächter: prüft die Teile, merkt sich, was schon gemeldet ist, und meldet Stillstand und Rückkehr."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.started = time.time()
        self._alerted: set[str] = set()
        # Steht ein Teil beim ersten Prüfen, wird erst beim nächsten gemeldet: nach einem Stocken von Home Assistant (Ruhezustand, Zeitsprung)
        # sind alle Lebenszeichen kurz alt, und die Teile holen sie im selben Takt nach
        self._suspect: set[str] = set()
        self._since: dict[str, float] = {}
        self._unsub: CALLBACK_TYPE | None = None

    async def async_start(self) -> None:
        self._unsub = async_track_time_interval(self.hass, self._on_tick, CHECK_INTERVAL)

    async def async_stop(self) -> None:
        if self._unsub is not None:
            self._unsub()
            self._unsub = None

    # -- Prüfen ---------------------------------------------------------------

    def evaluate(self, now: float) -> list[dict[str, Any]]:
        """Alle Teile mit Zustand ("ok", "late", "down"), Alter des letzten Lebenszeichens und erwartetem Takt (None ohne Takt)."""
        data = self.hass.data
        parts: dict[str, dict[str, Any]] = {}
        manager = data.get(DATA_ROUTINES)
        if manager is None:
            parts["routines"] = {"state": "down", "age_s": None, "expect_s": None, "last": None}
        else:
            # Überfällig gemessen ab dem Start des Wächters: was vor dem Start fällig war, holt der Start der Routinen selbst nach
            overdue = min(manager.overdue_s(now), now - self.started)
            parts["routines"] = {"state": classify(overdue, 0), "age_s": round(overdue), "expect_s": None, "last": None, "loaded": len(manager.routines())}
        for key, data_key, interval in TICK_PARTS:
            part = data.get(data_key)
            if part is None:
                parts[key] = {"state": "down", "age_s": None, "expect_s": interval, "last": None}
                continue
            last = getattr(part, "last_tick", None)
            age = now - (last if last is not None else self.started)
            parts[key] = {"state": classify(age, interval), "age_s": round(age), "expect_s": interval, "last": last}
        for key, data_key in LOADED_PARTS:
            parts[key] = {"state": "ok" if data.get(data_key) is not None else "down", "age_s": None, "expect_s": None, "last": None}
        if (magic := data.get(DATA_MAGIC)) is not None:
            parts["magic"]["loaded"] = len(getattr(magic, "_rules", {}))
        return [{"id": key, **parts[key], "since": self._since.get(key)} for key in ORDER]

    def snapshot(self, now: float | None = None) -> dict[str, Any]:
        """Stand für die Status-App und die Kopfzeile: Teile, Zahl der Störungen, Start und Routinen."""
        now = time.time() if now is None else now
        parts = self.evaluate(now)
        manager = self.hass.data.get(DATA_ROUTINES)
        return {
            "now": now,
            "started": self.started,
            "parts": parts,
            "problems": sum(1 for p in parts if p["state"] != "ok"),
            "down": sum(1 for p in parts if p["state"] == "down"),
            "routines_loaded": len(manager.routines()) if manager is not None else 0,
            "routines_missed": manager.missed_since(self.started) if manager is not None else 0,
        }

    def summary(self) -> dict[str, int]:
        """Nur die Zahlen für die Kopfzeile des Panels (rote Punkt)."""
        snap = self.snapshot()
        return {"problems": snap["problems"], "down": snap["down"]}

    # -- Takt: melden ----------------------------------------------------------

    @callback
    def _on_tick(self, _now: Any) -> None:
        now = time.time()
        for part in self.evaluate(now):
            key, state = part["id"], part["state"]
            if state != "ok":
                self._since.setdefault(key, now)
            if state != "down":
                self._suspect.discard(key)
            if state == "down" and key not in self._alerted and key not in self._suspect:
                self._suspect.add(key)
            elif state == "down" and key not in self._alerted:
                self._alerted.add(key)
                minutes = max(1, int((part["age_s"] or 0) // 60))
                activity.record(self.hass, "warning", "system", "status_down", self._label(key), minutes=minutes)
                self.hass.async_create_task(self._async_notify(key, up=False, minutes=minutes))
            elif state == "ok":
                self._since.pop(key, None)
                if key in self._alerted:
                    self._alerted.discard(key)
                    activity.record(self.hass, "info", "system", "status_up", self._label(key))
                    self.hass.async_create_task(self._async_notify(key, up=True))

    def _label(self, key: str) -> str:
        return push.text(self.hass, f"status_part_{key}")

    async def _async_notify(self, key: str, *, up: bool, minutes: int = 0) -> None:
        """Push bei Stillstand oder Rückkehr, an das Ziel der Status-App (sonst das globale); nur mit "Bei Stillstand melden"."""
        opts = effective(self.hass)
        if not opts[CONF_STATUS_NOTIFY]:
            return
        target = notify_target(opts, "status")
        if target == NOTIFY_NONE:
            return
        hass = self.hass
        clock = time.strftime("%H:%M", time.localtime())
        part = self._label(key)
        if up:
            title, message = push.text(hass, "status_up_title", part=part), push.text(hass, "status_up_text", time=clock)
        else:
            title, message = push.text(hass, "status_down_title", part=part), push.text(hass, "status_down_text", minutes=minutes, time=clock)
        # Eine Meldung je Teil: "läuft wieder" ersetzt "steht"
        data = push.notification_data(hass, f"device_panel_status_{key}", push.panel_url())
        await push.async_push(hass, target, title, message, data)


# -- WebSocket ------------------------------------------------------------------


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/status_get"})
@websocket_api.require_admin
@callback
def ws_status_get(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Stand der Status-App: Teile mit Zustand, Zahl der Störungen, Start der Integration und Routinen."""
    watch = hass.data.get(DATA_STATUS)
    if watch is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "integration not set up")
        return
    connection.send_result(msg["id"], watch.snapshot())


COMMANDS = (ws_status_get,)
