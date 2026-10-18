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
from homeassistant.util import dt as dt_util

from . import activity, push
from .const import (
    CONF_STATUS_CPU_ALERT,
    CONF_STATUS_CPU_LIMIT,
    CONF_STATUS_CPU_MINUTES,
    CONF_STATUS_DISK_ALERT,
    CONF_STATUS_DISK_LIMIT,
    CONF_STATUS_DISK_MINUTES,
    CONF_STATUS_NOTIFY,
    CONF_STATUS_RAM_ALERT,
    CONF_STATUS_RAM_LIMIT,
    CONF_STATUS_RAM_MINUTES,
    DATA_AVAILABILITY,
    DATA_BATTERY,
    DATA_CHARGE,
    DATA_MAGIC,
    DATA_NEW,
    DATA_OUTAGE,
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

# Meldung bei hoher Auslastung (seit 2.71.0): je Art Schalter und Grenze; gemeldet wird erst, wenn der Wert so viele Prüfungen (Minuten) in
# Folge über der Grenze liegt (kurze Spitzen melden nichts), "wieder unter der Grenze" erst nach so vielen Prüfungen darunter und mit
# LOAD_MARGIN Prozentpunkten Abstand (sonst piept ein Wert, der um die Grenze pendelt)
LOAD_KINDS = {
    "cpu": (CONF_STATUS_CPU_ALERT, CONF_STATUS_CPU_LIMIT, CONF_STATUS_CPU_MINUTES),
    "ram": (CONF_STATUS_RAM_ALERT, CONF_STATUS_RAM_LIMIT, CONF_STATUS_RAM_MINUTES),
    "disk": (CONF_STATUS_DISK_ALERT, CONF_STATUS_DISK_LIMIT, CONF_STATUS_DISK_MINUTES),
}
LOAD_CLEAR = 2
LOAD_MARGIN = 2.0

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
# Neustart von Hand (seit 2.63.0): Daten in hass.data je Teil; die Ausfall-Überwachung besteht aus zwei Objekten (Protokoll und Melder)
RESTART_DATA = {
    "routines": (DATA_ROUTINES,),
    "magic": (DATA_MAGIC,),
    "availability": (DATA_AVAILABILITY, DATA_OUTAGE),
    "battery": (DATA_BATTERY,),
    "charge": (DATA_CHARGE,),
    "new": (DATA_NEW,),
    "updates": (DATA_UPDATES,),
    "signal": (DATA_SIGNAL,),
}
# Sperre gegen Doppelklick: ein Teil lässt sich frühestens nach dieser Zeit wieder neu starten
RESTART_COOLDOWN_S = 20


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
        # Zeitpunkt des letzten Neustarts je Teil: ein frisches Objekt hat noch keinen Takt, gemessen wird ab diesem Zeitpunkt
        self._restarted: dict[str, float] = {}
        self._since: dict[str, float] = {}
        # Auslastung je Art (cpu, ram, disk): Prüfungen über/unter der Grenze, ob gemeldet, seit wann
        self._load: dict[str, dict[str, Any]] = {}
        self._unsub: CALLBACK_TYPE | None = None

    async def async_start(self) -> None:
        self._unsub = async_track_time_interval(self.hass, self._on_tick, CHECK_INTERVAL)

    async def async_stop(self) -> None:
        if self._unsub is not None:
            self._unsub()
            self._unsub = None

    # -- Prüfen ---------------------------------------------------------------

    def _base(self, key: str) -> float:
        """Ab wann ein Teil gemessen wird: Start des Wächters, nach einem Neustart von Hand dessen Zeitpunkt."""
        return max(self.started, self._restarted.get(key, 0.0))

    def evaluate(self, now: float) -> list[dict[str, Any]]:
        """Alle Teile mit Zustand ("ok", "late", "down"), Alter des letzten Lebenszeichens und erwartetem Takt (None ohne Takt)."""
        data = self.hass.data
        parts: dict[str, dict[str, Any]] = {}
        manager = data.get(DATA_ROUTINES)
        if manager is None:
            parts["routines"] = {"state": "down", "age_s": None, "expect_s": None, "last": None}
        else:
            # Überfällig gemessen ab dem Start des Wächters: was vor dem Start fällig war, holt der Start der Routinen selbst nach
            overdue = min(manager.overdue_s(now), now - self._base("routines"))
            parts["routines"] = {"state": classify(overdue, 0), "age_s": round(overdue), "expect_s": None, "last": None, "loaded": len(manager.routines())}
        for key, data_key, interval in TICK_PARTS:
            part = data.get(data_key)
            if part is None:
                parts[key] = {"state": "down", "age_s": None, "expect_s": interval, "last": None}
                continue
            last = getattr(part, "last_tick", None)
            age = now - (last if last is not None else self._base(key))
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

    # -- Neustart von Hand (seit 2.63.0) -----------------------------------------------

    async def async_restart(self, key: str) -> None:
        """
        Einen Teil der Integration auf einem frischen Objekt neu starten (Knopf in der Status-App). Nur ein Teil, der nicht läuft;
        Home Assistant und andere Integrationen bleiben unberührt. Gelingt der Start nicht, läuft das alte Objekt wieder an.
        """
        if key not in RESTART_DATA:
            raise vol.Invalid("Unbekannter Teil")
        now = time.time()
        part = next(p for p in self.evaluate(now) if p["id"] == key)
        if part["state"] == "ok":
            raise vol.Invalid("Dieser Teil läuft")
        if now - self._restarted.get(key, 0.0) < RESTART_COOLDOWN_S:
            raise vol.Invalid("Dieser Teil wurde eben erst neu gestartet")
        self._restarted[key] = now
        hass = self.hass
        keys = RESTART_DATA[key]
        old = [hass.data.get(k) for k in keys]
        fresh: list[Any] = []
        try:
            # Das Objekt zuerst anhalten (es schreibt dabei seinen Stand), dann ein frisches aus dem Gespeicherten aufbauen
            for obj in reversed(old):
                if obj is not None:
                    try:
                        await obj.async_stop()
                    except Exception:  # noqa: BLE001 - ein hängendes Teil darf den Neustart nicht verhindern
                        _LOGGER.exception("Status: %s liess sich nicht sauber anhalten", key)
            fresh = self._build(key)
            for obj in fresh:
                await obj.async_start()
            for k, obj in zip(keys, fresh, strict=True):
                hass.data[k] = obj
        except Exception as err:  # noqa: BLE001
            _LOGGER.exception("Status: Neustart von %s fehlgeschlagen", key)
            for obj in fresh:
                try:
                    await obj.async_stop()
                except Exception:  # noqa: BLE001
                    pass
            for k, obj in zip(keys, old, strict=True):
                if obj is not None:
                    try:
                        await obj.async_start()
                        hass.data[k] = obj
                    except Exception:  # noqa: BLE001
                        _LOGGER.exception("Status: auch das alte Objekt von %s lief nicht wieder an", key)
            activity.record(hass, "error", "system", "status_restart_failed", self._label(key), error=str(err) or type(err).__name__)
            raise vol.Invalid(f"Neustart fehlgeschlagen: {err}") from err
        self._suspect.discard(key)
        activity.record(hass, "info", "system", "status_restart", self._label(key))

    def _build(self, key: str) -> list[Any]:
        """Frische Objekte für einen Teil (Importe hier, damit status.py die Teile nicht beim Laden mitzieht)."""
        from .availability import AvailabilityLog  # noqa: PLC0415
        from .battery import BatteryWatch  # noqa: PLC0415
        from .charge import ChargeNotifier  # noqa: PLC0415
        from .magic import MagicPush  # noqa: PLC0415
        from .newdevice import NewDeviceNotifier  # noqa: PLC0415
        from .outage import OutageNotifier  # noqa: PLC0415
        from .routines import RoutineManager  # noqa: PLC0415
        from .signal_history import SignalLog  # noqa: PLC0415
        from .updates import UpdateNotifier  # noqa: PLC0415

        hass = self.hass
        if key == "availability":
            log = AvailabilityLog(hass)
            return [log, OutageNotifier(hass, log)]
        classes = {"routines": RoutineManager, "magic": MagicPush, "battery": BatteryWatch, "charge": ChargeNotifier, "new": NewDeviceNotifier, "updates": UpdateNotifier, "signal": SignalLog}
        return [classes[key](hass)]

    # -- Takt: melden ----------------------------------------------------------

    @callback
    def _check_load(self) -> None:
        """CPU, Arbeitsspeicher und Festplatte gegen die Grenze prüfen (jede Minute); Push bei hoher Auslastung und bei Rückkehr."""
        from .system_stats import current_percent  # noqa: PLC0415 - system_stats zieht Recorder-Hilfen, erst bei Bedarf

        opts = effective(self.hass)
        for kind, (alert_key, limit_key, minutes_key) in LOAD_KINDS.items():
            hold = opts[minutes_key]
            st = self._load.setdefault(kind, {"over": 0, "under": 0, "alerted": False, "since": 0.0})
            limit = opts[limit_key]
            value = current_percent(self.hass, kind) if opts[alert_key] else None
            if value is None:
                # Schalter aus oder kein Wert: zählt nicht; eine offene Meldung bleibt offen (es gibt nichts zu entwarnen)
                st["over"] = st["under"] = 0
                continue
            if value >= limit:
                st["under"] = 0
                st["over"] += 1
                if st["over"] == 1:
                    st["since"] = time.time()
                if st["over"] >= hold and not st["alerted"]:
                    st["alerted"] = True
                    minutes = max(1, int((time.time() - st["since"]) // 60))
                    what = push.text(self.hass, f"status_what_{kind}")
                    activity.record(self.hass, "warning", "system", "status_load", what, value=round(value), limit=limit)
                    self.hass.async_create_task(self._async_notify_load(kind, up=False, value=value, limit=limit, minutes=minutes))
            elif value < limit - LOAD_MARGIN:
                st["over"] = 0
                if st["alerted"]:
                    st["under"] += 1
                    if st["under"] >= LOAD_CLEAR:
                        st["alerted"] = False
                        st["under"] = 0
                        what = push.text(self.hass, f"status_what_{kind}")
                        activity.record(self.hass, "info", "system", "status_load_ok", what, value=round(value), limit=limit)
                        self.hass.async_create_task(self._async_notify_load(kind, up=True, value=value, limit=limit))
            else:
                # Knapp unter der Grenze: weder neu zählen noch entwarnen
                st["over"] = 0
                st["under"] = 0

    async def _async_notify_load(self, kind: str, *, up: bool, value: float, limit: int, minutes: int = 0) -> None:
        """Push bei hoher Auslastung oder Rückkehr, an das Ziel der Status-App (sonst das globale); eine Meldung je Art, "wieder unter" ersetzt sie."""
        opts = effective(self.hass)
        target = notify_target(opts, "status")
        if target == NOTIFY_NONE:
            return
        hass = self.hass
        clock = dt_util.now().strftime("%H:%M")
        what = push.text(hass, f"status_what_{kind}")
        if up:
            title = push.text(hass, "status_load_ok_title", what=what, limit=limit)
            message = push.text(hass, "status_load_ok_text", value=round(value), time=clock)
        else:
            title = push.text(hass, "status_load_title", what=what, value=round(value))
            message = push.text(hass, "status_load_text", limit=limit, minutes=minutes, time=clock)
        data = push.notification_data(hass, f"device_panel_status_load_{kind}", push.panel_url(app="status", tab="system"))
        await push.async_push(hass, target, title, message, data, topic="status")

    @callback
    def _on_tick(self, _now: Any) -> None:
        now = time.time()
        self._check_load()
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
        clock = dt_util.now().strftime("%H:%M")
        part = self._label(key)
        if up:
            title, message = push.text(hass, "status_up_title", part=part), push.text(hass, "status_up_text", time=clock)
        else:
            title, message = push.text(hass, "status_down_title", part=part), push.text(hass, "status_down_text", minutes=minutes, time=clock)
        # Eine Meldung je Teil: "läuft wieder" ersetzt "steht"
        data = push.notification_data(hass, f"device_panel_status_{key}", push.panel_url(app="status"))
        await push.async_push(hass, target, title, message, data, topic="status")


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


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/status_restart", vol.Required("part"): str})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_status_restart(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Einen Teil von Hand neu starten (Knopf der Status-App); Antwort ist der neue Stand."""
    watch = hass.data.get(DATA_STATUS)
    if watch is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "integration not set up")
        return
    try:
        await watch.async_restart(msg["part"])
    except vol.Invalid as err:
        connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, str(err.msg if hasattr(err, "msg") else err))
        return
    connection.send_result(msg["id"], watch.snapshot())


COMMANDS = (ws_status_get, ws_status_restart)
