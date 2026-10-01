"""
Batterie-Warnung: meldet Geräte mit schwacher Batterie als Push, als
anhaltende Benachrichtigung in Home Assistant, beides oder keines
(Optionen im Abschnitt "Batterie").

Push kommt einmal pro Gerät, wenn es unter die Schwelle fällt; gemerkt in
einer eigenen Datei, damit ein Neustart nicht erneut meldet. Erneut gemeldet
wird erst, wenn die Batterie zwischendurch BATTERY_REARM Prozentpunkte über
der Schwelle war. Die anhaltende Benachrichtigung listet alle betroffenen
Geräte und verschwindet, sobald keines mehr betroffen ist.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from homeassistant.components import persistent_notification
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store

from . import push
from .const import (
    BATTERY_PUSH_MAX,
    BATTERY_REARM,
    CONF_BATTERY_LOW,
    CONF_BATTERY_PERSISTENT,
    CONF_BATTERY_PUSH,
    CONF_NOTIFY_CLICK,
    CONF_NOTIFY_SERVICE,
    DOMAIN,
    NOTIFY_NONE,
    PERSISTENT_BATTERY_ID,
    STORAGE_VERSION,
)
from .devices import battery, monitored_devices
from .options_api import effective

_LOGGER = logging.getLogger(__name__)

STORE_KEY = f"{DOMAIN}.battery"
CHECK_INTERVAL = timedelta(seconds=60)


class BatteryWatch:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORE_KEY)
        # Gemeldete (schwache) Geräte mit dem zuletzt bekannten Stand.
        self._low: dict[str, dict[str, Any]] = {}
        self._message: str | None = None
        self._shown = False
        # Erste Prüfung nach dem Start oder nach geänderten Optionen: die
        # anhaltende Benachrichtigung neu aufbauen, auch ohne neue Geräte.
        self._refresh = True
        # Push und Ziel der letzten Prüfung: neu eingeschaltet oder anderes
        # Ziel meldet die aktuell betroffenen Geräte einmal (sonst wirkte das
        # Einschalten wirkungslos). None bis zur ersten Prüfung: ein Neustart
        # meldet nichts erneut.
        self._push_key: tuple[bool, str] | None = None
        self._unsubs: list[Any] = []
        self._unsub_started: Any = None

    @property
    def low(self) -> dict[str, dict[str, Any]]:
        return self._low

    async def async_start(self) -> None:
        stored = await self._store.async_load() or {}
        raw = stored.get("low") if isinstance(stored, dict) else None
        if isinstance(raw, dict):
            self._low = {str(k): v for k, v in raw.items() if isinstance(v, dict)}
        self._unsubs.append(persistent_notification.async_register_callback(self.hass, self._on_notification))
        if self.hass.is_running:
            self._start_ticking()
        else:
            self._unsub_started = self.hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, self._on_started)

    @callback
    def _on_started(self, _event: Event) -> None:
        # async_listen_once löst sich selbst; nicht mehr beim Stoppen lösen.
        self._unsub_started = None
        self._start_ticking()

    @callback
    def _start_ticking(self) -> None:
        self._unsubs.append(async_track_time_interval(self.hass, self._async_tick, CHECK_INTERVAL))
        self.hass.async_create_task(self.async_check())

    async def _async_tick(self, _now: Any) -> None:
        await self.async_check()

    @callback
    def _on_notification(self, update_type: persistent_notification.UpdateType, items: dict[str, Any]) -> None:
        """Merkt, ob unsere Meldung noch da ist (wer sie wegklickt, will Ruhe)."""
        if PERSISTENT_BATTERY_ID not in items:
            return
        self._shown = update_type != persistent_notification.UpdateType.REMOVED

    async def async_options_changed(self) -> None:
        self._refresh = True
        await self.async_check()

    async def async_stop(self) -> None:
        if self._unsub_started is not None:
            self._unsub_started()
            self._unsub_started = None
        for unsub in self._unsubs:
            unsub()
        self._unsubs = []
        if self._shown:
            persistent_notification.async_dismiss(self.hass, PERSISTENT_BATTERY_ID)

    async def async_check(self) -> None:
        hass = self.hass
        opts = effective(hass)
        threshold = opts[CONF_BATTERY_LOW]
        area_reg = ar.async_get(hass)
        low: dict[str, dict[str, Any]] = {}
        for device, entries in monitored_devices(hass, opts):
            info = battery(hass, entries, threshold)
            known = self._low.get(device.id)
            if info is None:
                # Keine Batteriewerte (Gerät gerade nicht erreichbar, HA startet
                # noch): Stand behalten, sonst meldete die Rückkehr erneut.
                if known is not None:
                    low[device.id] = known
                continue
            level = info["level"]
            is_low = info["low"] or (
                known is not None and level is not None and level <= threshold + BATTERY_REARM
            )
            if is_low:
                area = area_reg.async_get_area(device.area_id) if device.area_id else None
                low[device.id] = {
                    "name": device.name_by_user or device.name or device.id,
                    "level": level,
                    "area": area.name if area else None,
                }
        new = [dev for dev in low if dev not in self._low]
        push_key = (opts[CONF_BATTERY_PUSH], opts[CONF_NOTIFY_SERVICE])
        switched = self._push_key is not None and push_key != self._push_key
        self._push_key = push_key
        to_push = list(low) if switched else new
        if to_push and opts[CONF_BATTERY_PUSH] and opts[CONF_NOTIFY_SERVICE] != NOTIFY_NONE:
            await self._async_push(opts, low, to_push)
        self._update_persistent(opts, low, bool(new))
        self._refresh = False
        if low != self._low:
            self._low = low
            self._store.async_delay_save(lambda: {"low": self._low}, 1)

    @staticmethod
    def _order(low: dict[str, dict[str, Any]], ids: list[str]) -> list[str]:
        # Schwächste zuerst; nur "schwach" ohne Prozent ganz vorne.
        return sorted(ids, key=lambda d: (low[d]["level"] if low[d]["level"] is not None else -1, str(low[d]["name"]).lower()))

    def _level_text(self, level: int | None) -> str:
        return f"{level} %" if level is not None else push.text(self.hass, "battery_low")

    async def _async_push(self, opts: dict[str, Any], low: dict[str, dict[str, Any]], new: list[str]) -> None:
        hass = self.hass
        target = opts[CONF_NOTIFY_SERVICE]
        ordered = self._order(low, new)
        if len(ordered) > BATTERY_PUSH_MAX:
            # Viele auf einmal (z. B. erste Prüfung): eine Sammelmeldung.
            message = ", ".join(f"{low[d]['name']} {self._level_text(low[d]['level'])}" for d in ordered)
            title = push.text(hass, "battery_title_many", count=len(ordered))
            url = push.panel_url()
            await push.async_push(hass, target, title, message, push.notification_data(hass, f"{DOMAIN}_battery", url))
            return
        for dev in ordered:
            item = low[dev]
            message = " · ".join(x for x in (self._level_text(item["level"]), item["area"]) if x)
            url = push.device_url(opts[CONF_NOTIFY_CLICK], dev)
            data = push.notification_data(hass, f"{DOMAIN}_battery_{dev}", url)
            await push.async_push(hass, target, push.text(hass, "battery_title", name=item["name"]), message, data)

    def _update_persistent(self, opts: dict[str, Any], low: dict[str, dict[str, Any]], has_new: bool) -> None:
        hass = self.hass
        if not opts[CONF_BATTERY_PERSISTENT] or not low:
            if self._shown:
                persistent_notification.async_dismiss(hass, PERSISTENT_BATTERY_ID)
            self._message = None
            return
        lines = [
            "- " + " · ".join(
                x for x in (f"[{low[d]['name']}]({push.panel_url(d)})", self._level_text(low[d]["level"]), low[d]["area"]) if x
            )
            for d in self._order(low, list(low))
        ]
        message = "\n".join(
            [push.text(hass, "persistent_intro", threshold=opts[CONF_BATTERY_LOW]), "", *lines, "", push.text(hass, "persistent_outro")]
        )
        # Weggeklickt: erst bei einem neu betroffenen Gerät (oder nach Start
        # bzw. geänderten Optionen) wieder zeigen; sonst nur nachführen, wenn
        # sich der Inhalt ändert.
        if not (self._shown or has_new or self._refresh):
            return
        if self._shown and message == self._message and not has_new:
            return
        persistent_notification.async_create(hass, message, push.text(hass, "persistent_title"), PERSISTENT_BATTERY_ID)
        self._message = message
        self._shown = True
