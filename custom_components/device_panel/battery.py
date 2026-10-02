"""
Batterie-Warnung: meldet Geräte mit schwacher Batterie als Push, als
anhaltende Benachrichtigung in Home Assistant, beides oder keines
(Optionen im Abschnitt "Batterie").

Push sofort: einmal pro Gerät, wenn es unter die Schwelle fällt. Push
einmal täglich um eine Uhrzeit: eine Sammelmeldung mit den seither neu
betroffenen oder mit allen schwachen Geräten. Gemerkt wird in einer eigenen
Datei, damit ein Neustart nicht erneut meldet. Erneut gemeldet wird erst,
wenn die Batterie zwischendurch BATTERY_REARM Prozentpunkte über der
Schwelle war. Die anhaltende Benachrichtigung listet alle betroffenen
Geräte und verschwindet, sobald keines mehr betroffen ist. Pro Gerät lässt
sich die Warnung ausschalten oder eine eigene Schwelle setzen.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from homeassistant.components import persistent_notification
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers.event import async_track_time_change, async_track_time_interval
from homeassistant.helpers.storage import Store

from . import push
from .const import (
    BATTERY_PUSH_MAX,
    BATTERY_REARM,
    CONF_BATTERY_LOW,
    CONF_BATTERY_LOW_INTEGRATIONS,
    CONF_BATTERY_PERSISTENT,
    CONF_BATTERY_PUSH,
    CONF_BATTERY_PUSH_DAILY,
    CONF_BATTERY_PUSH_MODE,
    CONF_BATTERY_PUSH_TIME,
    CONF_NOTIFY_CLICK,
    CONF_NOTIFY_SERVICE,
    DAILY_ALL,
    DOMAIN,
    NOTIFY_NONE,
    PERSISTENT_BATTERY_ID,
    PUSH_DAILY,
    STORAGE_VERSION,
)
from .devices import battery, device_battery_threshold, device_settings, monitored_devices
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
        # Täglich: seit der letzten Tagesmeldung neu schwach geworden.
        self._pending: set[str] = set()
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
        self._unsub_daily: Any = None
        self._daily_key: tuple[Any, ...] | None = None

    @property
    def low(self) -> dict[str, dict[str, Any]]:
        return self._low

    @property
    def pending(self) -> set[str]:
        return self._pending

    async def async_start(self) -> None:
        stored = await self._store.async_load() or {}
        if isinstance(stored, dict):
            raw = stored.get("low")
            if isinstance(raw, dict):
                self._low = {str(k): v for k, v in raw.items() if isinstance(v, dict)}
            self._pending = {str(d) for d in stored.get("pending") or [] if isinstance(d, str)}
        self._unsubs.append(persistent_notification.async_register_callback(self.hass, self._on_notification))
        self._schedule_daily(effective(self.hass))
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
    def _schedule_daily(self, opts: dict[str, Any]) -> None:
        """Tagesmeldung zur eingestellten Uhrzeit (lokale Zeit der Instanz)."""
        key = (opts[CONF_BATTERY_PUSH], opts[CONF_BATTERY_PUSH_MODE], opts[CONF_BATTERY_PUSH_TIME])
        if key == self._daily_key:
            return
        self._daily_key = key
        if self._unsub_daily is not None:
            self._unsub_daily()
            self._unsub_daily = None
        if opts[CONF_BATTERY_PUSH] and opts[CONF_BATTERY_PUSH_MODE] == PUSH_DAILY:
            hour, minute = (int(x) for x in opts[CONF_BATTERY_PUSH_TIME].split(":"))
            self._unsub_daily = async_track_time_change(self.hass, self._async_daily, hour=hour, minute=minute, second=0)

    async def _async_daily(self, _now: Any = None) -> None:
        """Tagesmeldung: neu betroffene oder alle schwachen Geräte, eine Meldung."""
        opts = effective(self.hass)
        await self.async_check()
        ids = list(self._low) if opts[CONF_BATTERY_PUSH_DAILY] == DAILY_ALL else [d for d in self._pending if d in self._low]
        self._pending = set()
        self._save()
        if ids and opts[CONF_BATTERY_PUSH] and opts[CONF_NOTIFY_SERVICE] != NOTIFY_NONE:
            await self._async_push(opts, self._low, ids, summary=True)

    @callback
    def _on_notification(self, update_type: persistent_notification.UpdateType, items: dict[str, Any]) -> None:
        """Merkt, ob unsere Meldung noch da ist (wer sie wegklickt, will Ruhe)."""
        if PERSISTENT_BATTERY_ID not in items:
            return
        self._shown = update_type != persistent_notification.UpdateType.REMOVED

    async def async_options_changed(self) -> None:
        self._refresh = True
        self._schedule_daily(effective(self.hass))
        await self.async_check()

    async def async_stop(self) -> None:
        for name in ("_unsub_started", "_unsub_daily"):
            unsub = getattr(self, name)
            if unsub is not None:
                unsub()
                setattr(self, name, None)
        for unsub in self._unsubs:
            unsub()
        self._unsubs = []
        if self._shown:
            persistent_notification.async_dismiss(self.hass, PERSISTENT_BATTERY_ID)

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"low": self._low, "pending": sorted(self._pending)}, 1)

    async def async_check(self) -> None:
        hass = self.hass
        opts = effective(hass)
        area_reg = ar.async_get(hass)
        low: dict[str, dict[str, Any]] = {}
        for device, entries in monitored_devices(hass, opts):
            # Schwelle des Geräts, sonst der Integration, sonst die allgemeine;
            # None: Warnung für dieses Gerät aus (und vergessen).
            threshold = device_battery_threshold(hass, opts, device)
            if threshold is None:
                continue
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
        pending = (self._pending | set(new)) & set(low)
        if opts[CONF_BATTERY_PUSH_MODE] == PUSH_DAILY:
            # Täglich: nichts sofort, die Tagesmeldung nimmt sie mit. Eben
            # eingeschaltet (oder neues Ziel): die gerade betroffenen kommen
            # einmal mit, wie beim sofortigen Versand.
            if switched:
                pending = set(low)
        else:
            # Noch offene aus dem Modus "täglich" (eben umgestellt) gehen nicht verloren.
            to_push = list(low) if switched else [d for d in low if d in new or d in self._pending]
            if to_push and opts[CONF_BATTERY_PUSH] and opts[CONF_NOTIFY_SERVICE] != NOTIFY_NONE:
                await self._async_push(opts, low, to_push)
            pending = set()
        self._update_persistent(opts, low, bool(new))
        self._refresh = False
        if low != self._low or pending != self._pending:
            self._low = low
            self._pending = pending
            self._save()

    @staticmethod
    def _order(low: dict[str, dict[str, Any]], ids: list[str]) -> list[str]:
        # Schwächste zuerst; nur "schwach" ohne Prozent ganz vorne.
        return sorted(ids, key=lambda d: (low[d]["level"] if low[d]["level"] is not None else -1, str(low[d]["name"]).lower()))

    def _level_text(self, level: int | None) -> str:
        return f"{level} %" if level is not None else push.text(self.hass, "battery_low")

    async def _async_push(self, opts: dict[str, Any], low: dict[str, dict[str, Any]], new: list[str], summary: bool = False) -> None:
        hass = self.hass
        target = opts[CONF_NOTIFY_SERVICE]
        ordered = self._order(low, new)
        if len(ordered) > BATTERY_PUSH_MAX or (summary and len(ordered) > 1):
            # Viele auf einmal oder Tagesmeldung: eine Sammelmeldung.
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
        own = opts[CONF_BATTERY_LOW_INTEGRATIONS] or any(isinstance(v, int) for v in device_settings(hass)["battery"].values())
        message = "\n".join(
            [
                push.text(hass, "persistent_intro_own")
                if own
                else push.text(hass, "persistent_intro", threshold=opts[CONF_BATTERY_LOW]),
                "",
                *lines,
                "",
                push.text(hass, "persistent_outro"),
            ]
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
