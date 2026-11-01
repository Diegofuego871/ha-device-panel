"""
Meldung bei Backup-Fehler (seit 2.185.0): Die Backup-Integration von Home Assistant meldet jeden Lauf als Ereignis; kommt "fehlgeschlagen",
geht eine Push-Meldung an das Ziel der Status-App. Mit einer Uhrzeit ("einmal täglich um 09:00") wartet die Meldung bis zur nächsten dieser Uhrzeit; Fehler bis dahin ergeben eine Meldung.

Ein zurückgehaltener Fehler liegt in einer eigenen Datei, damit ein Neustart von Home Assistant ihn nicht verliert. Die Meldung läuft als Art "status"
durch push.async_push, die Ruhezeit gilt für sie also wie für die übrigen Status-Meldungen. Gemeldet wird nur ein Fehler, nicht ein Backup, das nie lief.
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
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from . import push
from .const import CONF_STATUS_BACKUP_ALERT, CONF_STATUS_BACKUP_MINUTES, CONF_STATUS_BACKUP_TIME, DOMAIN, NOTIFY_NONE, STORAGE_VERSION
from .options_api import effective, notify_target

_LOGGER = logging.getLogger(__name__)

STORE_KEY = f"{DOMAIN}.backup_alert"
CLICK_URL = "/config/backup"
# Sensoren der Backup-Integration (Plattform "backup", eindeutige Kennung = Schlüssel); der Entitätsname ist übersetzt und lässt sich umbenennen
SENSOR_KEYS = {"state": "backup_manager_state", "attempted": "last_attempted_automatic_backup", "success": "last_successful_automatic_backup"}
# Der Versuch wird kurz vor dem Zustandswechsel vermerkt; nach dem Lauf bekommen die Sensoren noch einen Moment, bis sie nachgeführt sind
STAMP_SLACK_S = 120
JUDGE_DELAY_S = 30


def release_at(clock: str, failed: datetime) -> datetime | None:
    """Wann eine Meldung des Fehlers `failed` hinausgeht: None = sofort, sonst die nächste dieser Uhrzeit (heute, war sie schon, morgen)."""
    if not clock:
        return None
    hour, minute = int(clock[:2]), int(clock[3:5])
    due = failed.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return due if failed < due else due + timedelta(days=1)


def is_failure(event: Any) -> bool:
    """Ein fehlgeschlagener Lauf beim Erstellen eines Backups (Ereignis der Backup-Integration; Aufbau geprüft, keine Importe nötig)."""
    return getattr(event, "manager_state", None) == "create_backup" and getattr(event, "state", None) == "failed"


class BackupAlert:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store = Store(hass, STORAGE_VERSION, STORE_KEY)
        self._pending: float | None = None  # Zeitpunkt des Fehlers, solange die Meldung noch wartet
        self._hang = False  # die wartende Meldung ist "nicht fertig geworden" (nicht "fehlgeschlagen")
        self._ids: dict[str, str] = {}  # gefundene Sensoren
        self._run: dict[str, Any] | None = None  # laufendes Backup: Start, Zeitlimit, schon gemeldet
        self._unsub_state: CALLBACK_TYPE | None = None
        self._unsub_events: CALLBACK_TYPE | None = None
        self._unsub_loaded: CALLBACK_TYPE | None = None
        self._unsub_timer: CALLBACK_TYPE | None = None

    async def async_start(self) -> None:
        data = await self._store.async_load()
        if isinstance(data, dict) and isinstance(data.get("pending"), (int, float)):
            self._pending = float(data["pending"])
            self._hang = bool(data.get("hang"))
        self._unsub_state = self.hass.bus.async_listen(EVENT_STATE_CHANGED, self._on_state, event_filter=self._state_filter)
        if not self._subscribe():
            # Die Backup-Integration kann nach uns starten: auf ihr Laden warten
            self._unsub_loaded = self.hass.bus.async_listen(EVENT_COMPONENT_LOADED, self._on_component_loaded)
        self._schedule()

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

    @callback
    def _on_event(self, event: Any) -> None:
        if not is_failure(event):
            return
        # Ein von Hand gestartetes Backup meldet das Ereignis nicht (der Nutzer sieht den Fehler selbst); ohne die Sensoren gilt jeder Fehler
        if self._run is not None and self._automatic(self._run["start"]) is False:
            self._run["reported"] = True
            return
        if self._run is not None:
            self._run["reported"] = True
        self.on_failure(dt_util.now())

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
        minutes = effective(self.hass)[CONF_STATUS_BACKUP_MINUTES]
        self._run = {"start": time.time(), "reported": False, "timeout": async_call_later(self.hass, minutes * 60, self._on_timeout), "judge": None}

    @callback
    def _on_timeout(self, _now: Any) -> None:
        run = self._run
        if run is None:
            return
        run["timeout"] = None
        if run["reported"] or self._automatic(run["start"]) is False:
            return
        run["reported"] = True
        self.on_failure(dt_util.now(), hang=True)

    def _run_ended(self) -> None:
        run = self._run
        if run is None:
            return
        if run["timeout"] is not None:
            run["timeout"]()
            run["timeout"] = None
        if run["reported"]:
            self._run = None
            return
        run["judge"] = async_call_later(self.hass, JUDGE_DELAY_S, self._on_judge)

    @callback
    def _on_judge(self, _now: Any) -> None:
        run, self._run = self._run, None
        if run is None or run["reported"] or self._automatic(run["start"]) is False or self._succeeded(run["start"]):
            return
        self.on_failure(dt_util.now())

    @callback
    def on_failure(self, when: datetime, hang: bool = False) -> None:
        opts = effective(self.hass)
        if not opts[CONF_STATUS_BACKUP_ALERT] or notify_target(opts, "status") == NOTIFY_NONE:
            return
        if release_at(opts[CONF_STATUS_BACKUP_TIME], when) is None:
            self.hass.async_create_task(self._async_send(when.timestamp(), hang))
            return
        self._pending = when.timestamp()
        self._hang = hang
        self._save()
        self._schedule()

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"pending": self._pending, "hang": self._hang}, 0)

    def _schedule(self) -> None:
        if self._unsub_timer is not None:
            self._unsub_timer()
            self._unsub_timer = None
        if self._pending is None:
            return
        failed = dt_util.as_local(dt_util.utc_from_timestamp(self._pending))
        due = release_at(effective(self.hass)[CONF_STATUS_BACKUP_TIME], failed)
        delay = 0.0 if due is None else max(0.0, (due - dt_util.now()).total_seconds())
        self._unsub_timer = async_call_later(self.hass, delay, self._on_timer)

    async def _on_timer(self, _now: Any) -> None:
        self._unsub_timer = None
        if self._pending is None:
            return
        failed, self._pending = self._pending, None
        self._save()
        await self._async_send(failed, self._hang)

    async def async_options_changed(self) -> None:
        """Ausgeschaltet: Wartendes verwerfen; eine andere Uhrzeit gilt für das Wartende sofort."""
        if self._pending is None:
            return
        if not effective(self.hass)[CONF_STATUS_BACKUP_ALERT]:
            self._pending = None
            self._save()
        self._schedule()

    async def _async_send(self, failed_ts: float, hang: bool = False) -> None:
        opts = effective(self.hass)
        target = notify_target(opts, "status")
        if not opts[CONF_STATUS_BACKUP_ALERT] or target == NOTIFY_NONE:
            return
        hass = self.hass
        failed = dt_util.as_local(dt_util.utc_from_timestamp(failed_ts))
        same_day = failed.date() == dt_util.now().date()
        when = failed.strftime("%H:%M") if same_day else failed.strftime("%d.%m. %H:%M")
        title = push.text(hass, "backup_failed_title")
        if hang:
            message = push.text(hass, "backup_hang_text", duration=push.duration(hass, opts[CONF_STATUS_BACKUP_MINUTES] * 60), when=when)
        else:
            message = push.text(hass, "backup_failed_text", when=when)
        # Ein Tag: ein neuer Fehler ersetzt die Meldung des vorigen
        data = push.notification_data(hass, "device_panel_backup_failed", CLICK_URL)
        await push.async_push(hass, target, title, message, data, topic="status")
