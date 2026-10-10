"""
Update-Erinnerung (seit 1.29.0, Reiter "Updates" in "Überwachung und Meldungen"):
Ersetzt die Automationen mit Zähler und Hilfsentität. Das Panel hört auf die
update-Entitäten von Home Assistant (Zustand "on" = Update verfügbar, übersprungene
Versionen sind schon "off") und meldet neue Updates in einer Meldung an das
Push-Ziel: sofort (nach dem Sammelfenster), täglich zur Uhrzeit oder wöchentlich
(Montag). Gemerkt wird je Entität die gemeldete Version, damit dasselbe Update nicht
zweimal kommt; optional wird ein offen gebliebenes nach 3 oder 7 Tagen erneut gemeldet.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from homeassistant.const import EVENT_STATE_CHANGED
from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_call_later, async_track_time_change
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from . import push
from .const import (
    CONF_NOTIFY_SERVICE,
    CONF_NOTIFY_UPDATES,
    CONF_UPDATES_KINDS,
    CONF_UPDATES_MODE,
    CONF_UPDATES_REPEAT,
    CONF_UPDATES_TIME,
    CONF_UPDATES_WINDOW,
    DOMAIN,
    NOTIFY_NONE,
    STORAGE_VERSION,
    UPDATES_INSTANT,
    UPDATES_REPEATS,
    UPDATES_WEEKLY,
)
from .options_api import effective

_LOGGER = logging.getLogger(__name__)

STORE_KEY = f"{DOMAIN}.updates"
# Klickziel der Meldung: die Update-Seite von Home Assistant.
UPDATES_URL = "/config/updates"
# Entitäten von Home Assistant selbst (Core, Betriebssystem, Supervisor); übrige Hassio-Updates sind Add-ons.
_CORE_IDS = {
    "update.home_assistant_core_update",
    "update.home_assistant_operating_system_update",
    "update.home_assistant_supervisor_update",
}


def update_kind(hass: HomeAssistant, entity_id: str) -> str:
    """Art eines Updates: core, addons, hacs oder devices (Geräte-Firmware und alles übrige)."""
    entry = er.async_get(hass).async_get(entity_id)
    platform = entry.platform if entry else ""
    if platform == "hassio":
        return "core" if entity_id in _CORE_IDS else "addons"
    if platform == "hacs":
        return "hacs"
    return "devices"


def _item(hass: HomeAssistant, state: Any) -> dict[str, Any]:
    attrs = state.attributes
    return {
        "id": state.entity_id,
        "name": str(attrs.get("title") or attrs.get("friendly_name") or state.entity_id),
        "installed": attrs.get("installed_version"),
        "latest": attrs.get("latest_version"),
        "kind": update_kind(hass, state.entity_id),
    }


class UpdateNotifier:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORE_KEY)
        # Gemeldet: Entität -> {"v": Version, "at": Zeitpunkt}.
        self._known: dict[str, dict[str, Any]] = {}
        # Seit der letzten Meldung neu verfügbar gewordene (nur "sofort").
        self._pending: set[str] = set()
        self._unsubs: list[CALLBACK_TYPE] = []
        self._unsub_timer: CALLBACK_TYPE | None = None
        self._unsub_time: CALLBACK_TYPE | None = None
        self._time_key: tuple[Any, ...] | None = None

    async def async_start(self) -> None:
        stored = await self._store.async_load() or {}
        raw = stored.get("known") if isinstance(stored, dict) else None
        if isinstance(raw, dict):
            self._known = {
                k: v for k, v in raw.items() if isinstance(k, str) and isinstance(v, dict) and "v" in v and isinstance(v.get("at"), (int, float))
            }
        self._unsubs.append(self.hass.bus.async_listen(EVENT_STATE_CHANGED, self._on_state, event_filter=self._filter))
        self._schedule(effective(self.hass))

    @staticmethod
    @callback
    def _filter(data: Any) -> bool:
        return str(data.get("entity_id", "")).startswith("update.")

    @callback
    def _on_state(self, event: Event) -> None:
        opts = effective(self.hass)
        if not opts[CONF_NOTIFY_UPDATES] or opts[CONF_UPDATES_MODE] != UPDATES_INSTANT:
            return
        new = event.data.get("new_state")
        old = event.data.get("old_state")
        if new is None or new.state != "on":
            return
        if old is not None and old.state == "on" and old.attributes.get("latest_version") == new.attributes.get("latest_version"):
            return
        self._pending.add(new.entity_id)
        # Das Fenster beginnt mit dem ersten neuen Update.
        if self._unsub_timer is None:
            self._unsub_timer = async_call_later(self.hass, opts[CONF_UPDATES_WINDOW] * 60, self._on_timer)

    @callback
    def _on_timer(self, _now: Any) -> None:
        self._unsub_timer = None
        pending, self._pending = self._pending, set()
        self.hass.async_create_task(self.async_report(only=pending))

    @callback
    def _schedule(self, opts: dict[str, Any]) -> None:
        """Täglich/wöchentlich zur Uhrzeit; "sofort" nur dann, wenn offene Updates erinnert werden sollen."""
        wanted = opts[CONF_NOTIFY_UPDATES] and (opts[CONF_UPDATES_MODE] != UPDATES_INSTANT or opts[CONF_UPDATES_REPEAT] != "never")
        key = (wanted, opts[CONF_UPDATES_TIME]) if wanted else (False,)
        if key == self._time_key:
            return
        self._time_key = key
        if self._unsub_time is not None:
            self._unsub_time()
            self._unsub_time = None
        if wanted:
            hour, minute = (int(x) for x in opts[CONF_UPDATES_TIME].split(":"))
            self._unsub_time = async_track_time_change(self.hass, self._on_time, hour=hour, minute=minute, second=0)

    @callback
    def _on_time(self, now: Any) -> None:
        opts = effective(self.hass)
        if opts[CONF_UPDATES_MODE] == UPDATES_WEEKLY and dt_util.as_local(now).weekday() != 0:
            return
        self.hass.async_create_task(self.async_report())

    async def async_options_changed(self) -> None:
        opts = effective(self.hass)
        self._schedule(opts)
        if not opts[CONF_NOTIFY_UPDATES] or opts[CONF_UPDATES_MODE] != UPDATES_INSTANT:
            self._pending = set()
            if self._unsub_timer is not None:
                self._unsub_timer()
                self._unsub_timer = None

    async def async_stop(self) -> None:
        if self._unsub_timer is not None:
            self._unsub_timer()
            self._unsub_timer = None
        if self._unsub_time is not None:
            self._unsub_time()
            self._unsub_time = None
        for unsub in self._unsubs:
            unsub()
        self._unsubs = []
        # Sofort schreiben: ein verzögerter Termin legte die Datei nach dem Entfernen neu an.
        await self._store.async_save({"known": self._known})

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"known": self._known}, 1)

    def due(self, opts: dict[str, Any], only: set[str] | None = None, now: float | None = None) -> list[dict[str, Any]]:
        """Updates, die jetzt zu melden sind: neu oder (mit Erinnerung) lange offen."""
        now = time.time() if now is None else now
        kinds = set(opts[CONF_UPDATES_KINDS])
        repeat = UPDATES_REPEATS[opts[CONF_UPDATES_REPEAT]]
        out: list[dict[str, Any]] = []
        for state in self.hass.states.async_all("update"):
            if state.state != "on" or (only is not None and state.entity_id not in only):
                continue
            item = _item(self.hass, state)
            if item["kind"] not in kinds:
                continue
            known = self._known.get(item["id"])
            if known is None or known["v"] != item["latest"] or (repeat and now - known["at"] >= repeat):
                out.append(item)
        return sorted(out, key=lambda i: i["name"].lower())

    async def async_report(self, only: set[str] | None = None) -> None:
        """Fällige Updates in einer Meldung senden und als gemeldet merken."""
        hass = self.hass
        opts = effective(hass)
        if not opts[CONF_NOTIFY_UPDATES]:
            return
        now = time.time()
        items = self.due(opts, only, now)
        # Nicht mehr offene Updates vergessen, damit ein späteres neues wieder gemeldet wird.
        open_ids = {s.entity_id for s in hass.states.async_all("update") if s.state == "on"}
        self._known = {k: v for k, v in self._known.items() if k in open_ids}
        if items and opts[CONF_NOTIFY_SERVICE] != NOTIFY_NONE:
            await push.async_push(
                hass, opts[CONF_NOTIFY_SERVICE], push.text(hass, "update_title"), self.message(items),
                push.notification_data(hass, f"{DOMAIN}_updates", UPDATES_URL),
            )
        for item in items:
            self._known[item["id"]] = {"v": item["latest"], "at": now}
        self._save()

    def message(self, items: list[dict[str, Any]]) -> str:
        """"3 verfügbar:" mit einer Zeile je Update ("Name alt → neu")."""
        hass = self.hass
        lines = []
        for i in items:
            if i["installed"] and i["latest"]:
                lines.append("• " + push.text(hass, "update_line", name=i["name"], installed=i["installed"], latest=i["latest"]))
            else:
                lines.append(f"• {i['name']}")
        return "\n".join([push.text(hass, "update_message", count=len(items)), *lines])
