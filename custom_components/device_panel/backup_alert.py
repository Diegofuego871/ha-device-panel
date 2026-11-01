"""
Meldung bei Backup-Fehler (seit 2.185.0): Die Backup-Integration von Home Assistant meldet jeden Lauf als Ereignis; kommt "fehlgeschlagen",
geht eine Push-Meldung an das Ziel der Status-App. Mit einer Uhrzeit ("einmal täglich um 09:00") wartet die Meldung bis zur nächsten dieser Uhrzeit; Fehler bis dahin ergeben eine Meldung.

Ein zurückgehaltener Fehler liegt in einer eigenen Datei, damit ein Neustart von Home Assistant ihn nicht verliert. Die Meldung läuft als Art "status"
durch push.async_push, die Ruhezeit gilt für sie also wie für die übrigen Status-Meldungen. Gemeldet wird nur ein Fehler, nicht ein Backup, das nie lief.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from homeassistant.const import EVENT_COMPONENT_LOADED
from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, callback
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from . import push
from .const import CONF_STATUS_BACKUP_ALERT, CONF_STATUS_BACKUP_TIME, DOMAIN, NOTIFY_NONE, STORAGE_VERSION
from .options_api import effective, notify_target

_LOGGER = logging.getLogger(__name__)

STORE_KEY = f"{DOMAIN}.backup_alert"
CLICK_URL = "/config/backup"


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
        self._unsub_events: CALLBACK_TYPE | None = None
        self._unsub_loaded: CALLBACK_TYPE | None = None
        self._unsub_timer: CALLBACK_TYPE | None = None

    async def async_start(self) -> None:
        data = await self._store.async_load()
        if isinstance(data, dict) and isinstance(data.get("pending"), (int, float)):
            self._pending = float(data["pending"])
        if not self._subscribe():
            # Die Backup-Integration kann nach uns starten: auf ihr Laden warten
            self._unsub_loaded = self.hass.bus.async_listen(EVENT_COMPONENT_LOADED, self._on_component_loaded)
        self._schedule()

    async def async_stop(self) -> None:
        for name in ("_unsub_events", "_unsub_loaded", "_unsub_timer"):
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
        if is_failure(event):
            self.on_failure(dt_util.now())

    @callback
    def on_failure(self, when: datetime) -> None:
        opts = effective(self.hass)
        if not opts[CONF_STATUS_BACKUP_ALERT] or notify_target(opts, "status") == NOTIFY_NONE:
            return
        if release_at(opts[CONF_STATUS_BACKUP_TIME], when) is None:
            self.hass.async_create_task(self._async_send(when.timestamp()))
            return
        self._pending = when.timestamp()
        self._save()
        self._schedule()

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"pending": self._pending}, 0)

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
        await self._async_send(failed)

    async def async_options_changed(self) -> None:
        """Ausgeschaltet: Wartendes verwerfen; eine andere Uhrzeit gilt für das Wartende sofort."""
        if self._pending is None:
            return
        if not effective(self.hass)[CONF_STATUS_BACKUP_ALERT]:
            self._pending = None
            self._save()
        self._schedule()

    async def _async_send(self, failed_ts: float) -> None:
        opts = effective(self.hass)
        target = notify_target(opts, "status")
        if not opts[CONF_STATUS_BACKUP_ALERT] or target == NOTIFY_NONE:
            return
        hass = self.hass
        failed = dt_util.as_local(dt_util.utc_from_timestamp(failed_ts))
        same_day = failed.date() == dt_util.now().date()
        when = failed.strftime("%H:%M") if same_day else failed.strftime("%d.%m. %H:%M")
        title = push.text(hass, "backup_failed_title")
        message = push.text(hass, "backup_failed_text", when=when)
        # Ein Tag: ein neuer Fehler ersetzt die Meldung des vorigen
        data = push.notification_data(hass, "device_panel_backup_failed", CLICK_URL)
        await push.async_push(hass, target, title, message, data, topic="status")
