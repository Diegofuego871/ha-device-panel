"""
Meldung bei Backup-Fehler (seit 2.185.0): Die Backup-Integration von Home Assistant meldet jeden Lauf als Ereignis; kommt "fehlgeschlagen",
geht eine Push-Meldung an das Ziel der Status-App. Mit einer Uhrzeit ("einmal täglich um 09:00") wartet die Meldung bis zur nächsten dieser Uhrzeit; Fehler bis dahin ergeben eine Meldung.

Ein zurückgehaltener Fehler liegt in einer eigenen Datei, damit ein Neustart von Home Assistant ihn nicht verliert. Die Meldung läuft als Art "status"
durch push.async_push, die Ruhezeit gilt für sie also wie für die übrigen Status-Meldungen. Gemeldet wird nur ein Fehler, nicht ein Backup, das nie lief.

Erfolgsmeldung: Gelingt ein Backup, nachdem ein Fehler oder ein "nicht fertig geworden" gemeldet wurde, folgt eine zweite Meldung (gleicher Tag, sie ersetzt die
erste). War es dasselbe Backup, das über die längste Dauer hinaus lief und doch fertig wurde, schlägt sie vor, die längste Dauer zu erhöhen.
Wartet der Fehler noch auf seine Uhrzeit und das Backup gelingt vorher, entfällt er (nur ein "doch noch fertig" bleibt, wegen des Vorschlags).
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta
from typing import Any

from homeassistant.const import EVENT_COMPONENT_LOADED, EVENT_STATE_CHANGED
from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from . import push
from .const import CONF_STATUS_BACKUP_ALERT, CONF_STATUS_BACKUP_AUTO, CONF_STATUS_BACKUP_MINUTES, CONF_STATUS_BACKUP_TIME, DOMAIN, NOTIFY_NONE, STORAGE_VERSION
from .options_api import effective, notify_target

_LOGGER = logging.getLogger(__name__)

STORE_KEY = f"{DOMAIN}.backup_alert"
CLICK_URL = "/config/backup"
# Sensoren der Backup-Integration (Plattform "backup", eindeutige Kennung = Schlüssel); der Entitätsname ist übersetzt und lässt sich umbenennen
SENSOR_KEYS = {"state": "backup_manager_state", "attempted": "last_attempted_automatic_backup", "success": "last_successful_automatic_backup"}
# Der Versuch wird kurz vor dem Zustandswechsel vermerkt; nach dem Lauf bekommen die Sensoren noch einen Moment, bis sie nachgeführt sind
STAMP_SLACK_S = 120
JUDGE_DELAY_S = 30
# Längste Dauer "Automatisch": die längste der letzten RUNS_KEPT gelungenen Läufe plus Zuschlag; mindestens RUNS_MIN Läufe müssen bekannt sein
RUNS_KEPT = 5
RUNS_MIN = 2
RESERVE_S = 20 * 60
SEED_DAYS = 30


def release_at(clock: str, failed: datetime) -> datetime | None:
    """Wann eine Meldung des Fehlers `failed` hinausgeht: None = sofort, sonst die nächste dieser Uhrzeit (heute, war sie schon, morgen)."""
    if not clock:
        return None
    hour, minute = int(clock[:2]), int(clock[3:5])
    due = failed.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return due if failed < due else due + timedelta(days=1)


def is_success(event: Any) -> bool:
    """Ein gelungener Lauf beim Erstellen eines Backups."""
    return getattr(event, "manager_state", None) == "create_backup" and getattr(event, "state", None) == "completed"


def auto_minutes(durations: list[float]) -> int | None:
    """Längste Dauer aus den Dauern der letzten gelungenen Backups: die längste plus 20 Minuten (10 bis 1440); None bei zu wenigen Läufen."""
    if len(durations) < RUNS_MIN:
        return None
    return min(1440, max(10, -(-int(max(durations) + RESERVE_S) // 60)))


def fallback_minutes(durations: list[float], fixed: int) -> int:
    """Längste Dauer bei zu wenigen Läufen: der feste Wert, nie unter dem längsten bekannten Lauf plus 20 Minuten (ein einzelner langer Lauf zählt gleich)."""
    if not durations:
        return fixed
    return min(1440, max(fixed, -(-int(max(durations) + RESERVE_S) // 60)))


def runs_from_history(states: dict[str, list[Any]], ids: dict[str, str]) -> list[dict[str, float]]:
    """Gelungene automatische Läufe aus dem Verlauf der Sensoren (Recorder): Zeiträume mit Zustand "create_backup", in denen "letzter Versuch" und
    "letzter Erfolg" nachgeführt wurden. Ein von Hand gestarteter Lauf setzt den Versuch nicht und bleibt draussen."""
    runs: list[dict[str, float]] = []
    manager = sorted(states.get(ids.get("state", ""), []), key=lambda s: s.last_changed)

    def changed_in(name: str, start: float, end: float) -> bool:
        return any(start - STAMP_SLACK_S <= s.last_changed.timestamp() <= end + JUDGE_DELAY_S * 2 for s in states.get(ids.get(name, ""), [])[1:])

    for index, state in enumerate(manager):
        if state.state != "create_backup" or index + 1 >= len(manager):
            continue
        start, end = state.last_changed.timestamp(), manager[index + 1].last_changed.timestamp()
        if changed_in("attempted", start, end) and changed_in("success", start, end):
            runs.append({"end": end, "secs": end - start})
    return runs[-RUNS_KEPT:]


def suggest_minutes(seconds: float) -> int:
    """Vorschlag für die längste Dauer: das Eineinhalbfache der gebrauchten Zeit, auf halbe Stunden aufgerundet (höchstens 24 Stunden)."""
    return min(1440, max(10, -(-int(seconds * 1.5) // 1800) * 30))


def is_failure(event: Any) -> bool:
    """Ein fehlgeschlagener Lauf beim Erstellen eines Backups (Ereignis der Backup-Integration; Aufbau geprüft, keine Importe nötig)."""
    return getattr(event, "manager_state", None) == "create_backup" and getattr(event, "state", None) == "failed"




class BackupAlert:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store = Store(hass, STORAGE_VERSION, STORE_KEY)
        # Wartende Meldung: {"ts": Zeitpunkt, "kind": "failed" | "hang" | "ok" | "late", "secs": Dauer für ok/late}
        self._pending: dict[str, Any] | None = None
        self._open: float | None = None  # Zeitpunkt der zuletzt gesendeten Fehlermeldung, solange kein Backup danach gelang
        self._runs: list[dict[str, float]] = []  # die letzten gelungenen Läufe: {"end": Zeitpunkt, "secs": Dauer}
        self._ids: dict[str, str] = {}  # gefundene Sensoren
        self._run: dict[str, Any] | None = None  # laufendes Backup: Start, Zeitlimit, schon gemeldet
        self._unsub_events: CALLBACK_TYPE | None = None
        self._unsub_loaded: CALLBACK_TYPE | None = None
        self._unsub_timer: CALLBACK_TYPE | None = None
        self._unsub_state: CALLBACK_TYPE | None = None

    async def async_start(self) -> None:
        data = await self._store.async_load()
        if isinstance(data, dict):
            pending = data.get("pending")
            if isinstance(pending, dict) and pending.get("kind") in ("failed", "hang", "ok", "late") and isinstance(pending.get("ts"), (int, float)):
                self._pending = {"ts": float(pending["ts"]), "kind": pending["kind"], "secs": float(pending.get("secs") or 0), "limit": float(pending.get("limit") or 0)}
            elif isinstance(pending, (int, float)):  # 2.185.0: nur der Zeitpunkt (und "hang")
                self._pending = {"ts": float(pending), "kind": "hang" if data.get("hang") else "failed", "secs": 0.0, "limit": 0.0}
            if isinstance(data.get("open"), (int, float)):
                self._open = float(data["open"])
            runs = data.get("runs")
            if isinstance(runs, list):
                self._runs = [
                    {"end": float(r["end"]), "secs": float(r["secs"])}
                    for r in runs
                    if isinstance(r, dict) and isinstance(r.get("end"), (int, float)) and isinstance(r.get("secs"), (int, float)) and r["secs"] > 0
                ][-RUNS_KEPT:]
        self._unsub_state = self.hass.bus.async_listen(EVENT_STATE_CHANGED, self._on_state, event_filter=self._state_filter)
        if not self._subscribe():
            # Die Backup-Integration kann nach uns starten: auf ihr Laden warten
            self._unsub_loaded = self.hass.bus.async_listen(EVENT_COMPONENT_LOADED, self._on_component_loaded)
        self._schedule()
        if len(self._runs) < RUNS_MIN:
            async_at_started(self.hass, self._seed)

    async def _seed(self, _hass: HomeAssistant) -> None:
        """Beim ersten Start die Dauern früherer Läufe aus dem Verlauf des Recorders holen, damit "Automatisch" gleich Werte hat."""
        if len(self._runs) >= RUNS_MIN or "recorder" not in self.hass.config.components:
            return
        ids = {name: self._id(name) for name in SENSOR_KEYS}
        if not all(ids.values()):
            return
        try:
            from homeassistant.components.recorder import get_instance, history  # noqa: PLC0415

            end = dt_util.utcnow()
            states = await get_instance(self.hass).async_add_executor_job(
                lambda: history.get_significant_states(self.hass, end - timedelta(days=SEED_DAYS), end, list(ids.values()), None, True, False, False, True)
            )
        except Exception:  # noqa: BLE001 - ohne Verlauf bleibt es beim festen Wert, bis genug Läufe bekannt sind
            _LOGGER.debug("Verlauf der Backup-Sensoren nicht lesbar", exc_info=True)
            return
        seeded = runs_from_history(states, ids)
        if len(seeded) > len(self._runs):
            self._runs = seeded
            self._save()

    def minutes(self) -> int:
        """Die längste Dauer, die jetzt gilt: berechnet ("Automatisch", genug Läufe bekannt) oder der feste Wert."""
        opts = effective(self.hass)
        secs = [r["secs"] for r in self._runs]
        if opts[CONF_STATUS_BACKUP_AUTO]:
            if (auto := auto_minutes(secs)) is not None:
                return auto
            return fallback_minutes(secs, opts[CONF_STATUS_BACKUP_MINUTES])
        return opts[CONF_STATUS_BACKUP_MINUTES]

    def info(self) -> dict[str, Any]:
        """Für die Anzeige in der Status-App: die berechnete Dauer (None = zu wenige Läufe), die Dauer, die dann gilt, und die Zahl der bekannten Läufe."""
        secs = [r["secs"] for r in self._runs]
        return {"minutes": auto_minutes(secs), "fallback": fallback_minutes(secs, effective(self.hass)[CONF_STATUS_BACKUP_MINUTES]), "runs": len(secs)}

    async def async_stop(self) -> None:
        self._cancel_run()
        for name in ("_unsub_events", "_unsub_loaded", "_unsub_timer", "_unsub_state"):
            if (unsub := getattr(self, name)) is not None:
                unsub()
                setattr(self, name, None)

    @callback
    def _on_component_loaded(self, event: Event) -> None:
        if event.data.get("component") == "backup" and self._subscribe() and self._unsub_loaded is not None:
            self._unsub_loaded()
            self._unsub_loaded = None

    def _subscribe(self) -> bool:
        """Auf die Ereignisse der Backup-Integration hören; False, wenn sie (noch) nicht läuft."""
        if self._unsub_events is not None:
            return True
        if "backup" not in self.hass.config.components:
            return False
        try:
            from homeassistant.components.backup import async_get_manager  # noqa: PLC0415

            self._unsub_events = async_get_manager(self.hass).async_subscribe_events(self._on_event)
        except Exception:  # noqa: BLE001 - ohne Backup-Verwaltung gibt es nichts zu melden
            _LOGGER.debug("Backup-Verwaltung nicht erreichbar", exc_info=True)
            return False
        return True

    # --- Ereignisse der Backup-Verwaltung -----------------------------------------

    @callback
    def _on_event(self, event: Any) -> None:
        if is_failure(event):
            if self._run is not None:
                self._run["reported"] = True
            self._queue("failed", dt_util.now())
        elif is_success(event):
            self._succeeded_run()

    # --- Wächter über die Sensoren ------------------------------------------------

    def _id(self, name: str) -> str | None:
        if name not in self._ids:
            if entity_id := er.async_get(self.hass).async_get_entity_id("sensor", "backup", SENSOR_KEYS[name]):
                self._ids[name] = entity_id
        return self._ids.get(name)

    @callback
    def _state_filter(self, data: Any) -> bool:
        return data.get("entity_id") == self._id("state")

    def _stamp(self, name: str) -> float | None:
        """Zeitstempel eines Sensors (Sekunden); None bei fehlendem Sensor oder ohne Wert."""
        entity_id = self._id(name)
        state = self.hass.states.get(entity_id) if entity_id else None
        parsed = dt_util.parse_datetime(state.state) if state else None
        return parsed.timestamp() if parsed else None

    def _automatic(self, start: float) -> bool | None:
        """Ist das Backup, das um `start` begann, ein automatisches? None = Sensor fehlt (dann gilt es als ja)."""
        entity_id = self._id("attempted")
        if not entity_id or self.hass.states.get(entity_id) is None:
            return None
        stamp = self._stamp("attempted")
        return stamp is not None and stamp >= start - STAMP_SLACK_S

    def _succeeded(self, start: float) -> bool:
        stamp = self._stamp("success")
        return stamp is not None and stamp >= start - STAMP_SLACK_S

    def _cancel_run(self) -> None:
        if self._run:
            for key in ("timeout", "judge"):
                if self._run.get(key) is not None:
                    self._run[key]()
                    self._run[key] = None
        self._run = None

    @callback
    def _on_state(self, event: Event) -> None:
        new, old = event.data.get("new_state"), event.data.get("old_state")
        was = old is not None and old.state == "create_backup"
        now = new is not None and new.state == "create_backup"
        if now and not was:
            self._run_started()
        elif was and not now:
            self._run_ended()

    def _run_started(self) -> None:
        self._cancel_run()
        minutes = self.minutes()
        self._run = {"start": time.time(), "limit": minutes * 60, "reported": False, "hang": False, "done": False, "timeout": async_call_later(self.hass, minutes * 60, self._on_timeout), "judge": None}

    @callback
    def _on_timeout(self, _now: Any) -> None:
        run = self._run
        if run is None:
            return
        run["timeout"] = None
        if run["reported"]:
            return
        run["reported"] = True
        run["hang"] = True
        self._queue("hang", dt_util.now(), limit=run["limit"])

    def _run_ended(self) -> None:
        run = self._run
        if run is None:
            return
        if run["timeout"] is not None:
            run["timeout"]()
            run["timeout"] = None
        if run["done"]:
            self._run = None
            return
        run["judge"] = async_call_later(self.hass, JUDGE_DELAY_S, self._on_judge)

    @callback
    def _on_judge(self, _now: Any) -> None:
        run = self._run
        if run is None:
            return
        run["judge"] = None
        if run["done"]:
            self._run = None
            return
        automatic = self._automatic(run["start"])
        if automatic is not False and self._succeeded(run["start"]):
            self._succeeded_run()
        elif automatic is not False and not run["reported"]:
            run["reported"] = True
            self._queue("failed", dt_util.now())
        self._run = None

    # --- Erfolg nach einem gemeldeten Fehler ---------------------------------------

    def _succeeded_run(self) -> None:
        """Ein Backup ist gelungen (Ereignis oder Sensor): eine gemeldete Störung ist vorbei."""
        run = self._run
        if run is not None:
            if run["done"]:
                return
            run["done"] = True
        hung = bool(run and run["hang"])
        now = time.time()
        if run is not None:
            self._record(now, now - run["start"])
        if hung:
            # Dasselbe Backup lief über die längste Dauer hinaus und wurde doch fertig: fest: Vorschlag, sie zu erhöhen; automatisch: sie passt sich an
            self._queue("late", dt_util.now(), secs=now - run["start"], limit=run["limit"])
        elif self._pending is not None and self._pending["kind"] in ("failed", "hang"):
            # Die Fehlermeldung wartet noch auf ihre Uhrzeit: sie ist überholt
            self._pending = None
            self._save()
            self._schedule()
        elif self._open is not None:
            self._queue("ok", dt_util.now(), secs=now - self._open)

    def _record(self, end: float, secs: float) -> None:
        """Dauer eines gelungenen Laufs merken (die letzten RUNS_KEPT)."""
        if secs <= 0:
            return
        self._runs = [*self._runs, {"end": end, "secs": secs}][-RUNS_KEPT:]
        self._save()

    # --- Melden --------------------------------------------------------------------

    @callback
    def _queue(self, kind: str, when: datetime, secs: float = 0.0, limit: float = 0.0) -> None:
        """Eine Meldung vormerken: sofort oder zur nächsten eingestellten Uhrzeit. Eine neuere ersetzt eine wartende."""
        opts = effective(self.hass)
        if not opts[CONF_STATUS_BACKUP_ALERT] or notify_target(opts, "status") == NOTIFY_NONE:
            return
        self._pending = {"ts": when.timestamp(), "kind": kind, "secs": secs, "limit": limit}
        self._save()
        self._schedule()

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"pending": self._pending, "open": self._open, "runs": self._runs}, 0)

    def _schedule(self) -> None:
        if self._unsub_timer is not None:
            self._unsub_timer()
            self._unsub_timer = None
        if self._pending is None:
            return
        failed = dt_util.as_local(dt_util.utc_from_timestamp(self._pending["ts"]))
        due = release_at(effective(self.hass)[CONF_STATUS_BACKUP_TIME], failed)
        if due is None or due <= dt_util.now():
            self.hass.async_create_task(self._on_timer(None))
            return
        self._unsub_timer = async_call_later(self.hass, (due - dt_util.now()).total_seconds(), self._on_timer)

    async def _on_timer(self, _now: Any) -> None:
        self._unsub_timer = None
        if self._pending is None:
            return
        pending, self._pending = self._pending, None
        await self._async_send(pending)
        self._save()

    async def async_options_changed(self) -> None:
        """Ausgeschaltet: Wartendes und Offenes verwerfen; eine andere Uhrzeit gilt für das Wartende sofort."""
        if not effective(self.hass)[CONF_STATUS_BACKUP_ALERT]:
            self._pending = None
            self._open = None
            self._save()
        self._schedule()

    async def _async_send(self, pending: dict[str, Any]) -> None:
        opts = effective(self.hass)
        target = notify_target(opts, "status")
        if not opts[CONF_STATUS_BACKUP_ALERT] or target == NOTIFY_NONE:
            return
        hass = self.hass
        kind = pending["kind"]
        failed = dt_util.as_local(dt_util.utc_from_timestamp(pending["ts"]))
        same_day = failed.date() == dt_util.now().date()
        when = failed.strftime("%H:%M") if same_day else failed.strftime("%d.%m. %H:%M")
        limit_s = pending.get("limit") or self.minutes() * 60
        auto = bool(opts[CONF_STATUS_BACKUP_AUTO])
        url = CLICK_URL
        if kind == "hang":
            title = push.text(hass, "backup_failed_title")
            message = push.text(hass, "backup_hang_text", duration=push.duration(hass, limit_s), when=when)
        elif kind == "ok":
            title = push.text(hass, "backup_ok_title")
            message = push.text(hass, "backup_ok_text", since=push.duration(hass, pending["secs"]), when=when)
        elif kind == "late" and auto:
            # Automatisch: das Backup ist jetzt in der Reihe der letzten Läufe, die Grenze wächst beim nächsten Mal von selbst mit
            title = push.text(hass, "backup_late_title")
            message = push.text(hass, "backup_late_auto_text", duration=push.duration(hass, pending["secs"]), limit=push.duration(hass, limit_s), when=when)
        elif kind == "late":
            title = push.text(hass, "backup_late_title")
            message = push.text(
                hass,
                "backup_late_text",
                duration=push.duration(hass, pending["secs"]),
                limit=push.duration(hass, limit_s),
                suggest=push.duration(hass, suggest_minutes(pending["secs"]) * 60),
                when=when,
            )
            url = push.panel_url(app="status", tab="settings")  # der Vorschlag betrifft eine Einstellung dort
        else:
            title = push.text(hass, "backup_failed_title")
            message = push.text(hass, "backup_failed_text", when=when)
        # Ein Tag: die Erfolgsmeldung ersetzt die Fehlermeldung auf dem Telefon, ein neuer Fehler die vorige
        data = push.notification_data(hass, "device_panel_backup_failed", url)
        await push.async_push(hass, target, title, message, data, topic="status")
        self._open = pending["ts"] if kind in ("failed", "hang") else None
