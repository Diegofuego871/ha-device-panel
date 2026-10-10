"""
Lademeldung (seit 1.30.0, Abschnitt "Laden" im Reiter "Batterie"): Push, sobald ein Gerät
voll geladen ist. Standardmässig aus; eingeschaltet pro Integration oder pro Gerät (Popup,
das Gerät geht vor). Das Laden wird am Batteriestand erkannt (für "lädt" im Panel nur bei eingeschalteter
Lademeldung, ausser das Gerät hat eine Ladeanzeige), nicht abgefragt: Das Panel hört
auf den Prozent-Sensor und merkt sich den tiefsten Stand seit dem letzten Entladen. Steigt
der Stand um "Anstieg" Punkte darüber, gilt das Gerät als "lädt"; erreicht es "Voll ab", geht
die Meldung raus. Geräte, die selten melden (Bluetooth, Zigbee), zeigen oft nur einen Sprung:
Ersatzregel ist der Wechsel von unter 90 % auf "Voll ab". Wieder scharf, sobald der Stand
10 Punkte unter "Voll ab" fällt. Ein Batteriewechsel (neue Batterie: 100 %) sieht wie Laden
aus; darum nur für wiederaufladbare Geräte einschalten.
"""

from __future__ import annotations

import logging
import time
from datetime import timedelta
from typing import Any

from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, callback
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_track_state_change_event, async_track_time_interval
from homeassistant.helpers.storage import Store

from . import activity, push
from .battery_history import battery_entity
from .const import (
    CHARGE_DROP,
    CHARGE_JUMP_FROM,
    CHARGE_REARM,
    CHARGE_STALE,
    CONF_CHARGE_FULL,
    CONF_CHARGE_INTEGRATIONS,
    CONF_CHARGE_RISE,
    CONF_CHARGE_STALL,
    CONF_NOTIFY_CHARGE,
    CONF_NOTIFY_CHARGE_STOP,
    CONF_NOTIFY_CLICK,
    CONF_NOTIFY_SERVICE,
    DOMAIN,
    NOTIFY_NONE,
    STORAGE_VERSION,
)
from .devices import device_charge_opts, device_settings, monitored_devices, primary_domain
from .options_api import effective

_LOGGER = logging.getLogger(__name__)

STORE_KEY = f"{DOMAIN}.charge"


def level_of(state: Any) -> float | None:
    """Prozent aus dem Zustand eines Batteriesensors, sonst None."""
    try:
        value = float(state.state)
    except (AttributeError, TypeError, ValueError):
        return None
    return value if 0 <= value <= 100 else None


def charging_entity(hass: HomeAssistant, entries: list[er.RegistryEntry]) -> str | None:
    """
    Ladeanzeige des Geräts, wenn es eine hat: Binärsensor mit Geräteklasse battery_charging
    (an = lädt) oder der Sensor "Batteriestatus" der Companion-App (charging/full/…).
    """
    for entry in entries:
        if entry.disabled_by:
            continue
        if entry.domain == "binary_sensor" and (entry.device_class or entry.original_device_class) == "battery_charging":
            return entry.entity_id
        if entry.domain == "sensor" and entry.platform == "mobile_app" and entry.entity_id.endswith("_battery_state"):
            return entry.entity_id
    return None


class ChargeNotifier:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORE_KEY)
        # Je Gerät: tiefster Stand mit Zeitpunkt, letzter Stand, gemeldet (bis er wieder fällt).
        self._state: dict[str, dict[str, Any]] = {}
        self._entities: dict[str, str] = {}
        self._unsub_track: CALLBACK_TYPE | None = None
        self._unsubs: list[CALLBACK_TYPE] = []

    async def async_start(self) -> None:
        stored = await self._store.async_load() or {}
        raw = stored.get("state") if isinstance(stored, dict) else None
        if isinstance(raw, dict):
            self._state = {
                k: v for k, v in raw.items()
                if isinstance(k, str) and isinstance(v, dict) and all(isinstance(v.get(f), (int, float)) for f in ("min", "min_at", "last"))
            }
        # Neue Entitäten und Geräte (Register) ändern, welche Sensoren zu beobachten sind.
        # Alle überwachten Geräte mit Batterie werden beobachtet (für "lädt gerade" im Panel);
        # die Meldung bei "voll" geht nur an die eingeschalteten.
        self._unsubs.append(self.hass.bus.async_listen(er.EVENT_ENTITY_REGISTRY_UPDATED, self._on_registry))
        # Ladung beendet (seit 1.40.0): ein gleichbleibender Stand löst kein Ereignis aus, darum ein Termin jede Minute.
        self._unsubs.append(async_track_time_interval(self.hass, self._on_tick, timedelta(minutes=1)))
        await self.async_rebuild()

    @callback
    def _on_registry(self, _event: Event) -> None:
        self.hass.async_create_task(self.async_rebuild())

    @staticmethod
    def enabled(opts: dict[str, Any], hass: HomeAssistant, device: dr.DeviceEntry) -> bool:
        """Lademeldung für ein Gerät: Wahl am Gerät, sonst die Integration."""
        if not opts[CONF_NOTIFY_CHARGE]:
            return False
        own = device_settings(hass).get("charge", {}).get(device.id)
        if own is not None:
            return bool(own)
        domain = primary_domain(hass, device)
        return bool(domain) and domain in opts[CONF_CHARGE_INTEGRATIONS]

    async def async_rebuild(self) -> None:
        """Beobachtete Batteriesensoren neu bestimmen (Optionen, Gerät, Register)."""
        hass = self.hass
        opts = effective(hass)
        wanted: dict[str, str] = {}
        for device, entries in monitored_devices(hass, opts):
            if (entity_id := battery_entity(hass, entries)) is not None:
                wanted[entity_id] = device.id
        if wanted == self._entities and self._unsub_track is not None:
            return
        if wanted != self._entities:
            activity.record(hass, "info", "charge", "charge_watch", count=len(wanted))
        if self._unsub_track is not None:
            self._unsub_track()
            self._unsub_track = None
        self._entities = wanted
        # Nicht mehr beobachtete Geräte vergessen; neue mit dem jetzigen Stand beginnen (ohne Meldung).
        keep = set(wanted.values())
        self._state = {d: s for d, s in self._state.items() if d in keep}
        now = time.time()
        for entity_id, dev in wanted.items():
            if dev not in self._state and (level := level_of(hass.states.get(entity_id))) is not None:
                self._state[dev] = {"min": level, "min_at": now, "last": level, "done": level >= device_charge_opts(hass, opts, dev)[CONF_CHARGE_FULL]}
        if wanted:
            self._unsub_track = async_track_state_change_event(hass, list(wanted), self._on_state)
        self._save()

    @callback
    def _on_state(self, event: Event) -> None:
        dev = self._entities.get(event.data["entity_id"])
        level = level_of(event.data.get("new_state"))
        if dev is None or level is None:
            return
        opts = effective(self.hass)
        # Eigenes "Voll ab" und eigener Anstieg des Geräts (seit 1.35.0) gelten für die Erkennung wie für den Push.
        copts = device_charge_opts(self.hass, opts, dev)
        now = time.time()
        was = self.charging(dev, now, copts) is not None
        done = self.step(dev, level, now, copts)
        device = dr.async_get(self.hass).async_get(dev)
        name = (device.name_by_user or device.name or dev) if device is not None else dev
        st = self._state.get(dev) or {}
        low = round(st.get("min", level))
        hass = self.hass
        activity.record(hass, "debug", "charge", "charge_level", name, dev, level=round(level), low=low, full=copts[CONF_CHARGE_FULL], rise=copts[CONF_CHARGE_RISE])
        if not was and done is None and self.charging(dev, now, copts) is not None:
            activity.record(hass, "info", "charge", "charge_started", name, dev, level=round(level), low=low, rise=copts[CONF_CHARGE_RISE])
        if done is None:
            return
        if device is None or not self.enabled(opts, hass, device):
            activity.record(hass, "info", "charge", "charge_full_off", name, dev, level=round(done["level"]), full=copts[CONF_CHARGE_FULL])
            return
        if opts[CONF_NOTIFY_SERVICE] == NOTIFY_NONE:
            activity.record(hass, "warning", "charge", "charge_no_target", name, dev, level=round(done["level"]))
            return
        if done["seconds"] is not None:
            how = activity.text(hass, "charge_how_rise", start=round(done["start"]), duration=push.duration(hass, done["seconds"]))
        else:
            how = activity.text(hass, "charge_how_jump", start=round(done["start"]))
        activity.record(hass, "info", "charge", "charge_full_sent", name, dev, level=round(done["level"]), full=copts[CONF_CHARGE_FULL], how=how)
        hass.async_create_task(self._async_push(dev, done))

    def step(self, dev: str, level: float, now: float, opts: dict[str, Any]) -> dict[str, Any] | None:
        """
        Neuen Stand verarbeiten. Gibt bei "voll geladen" {"level", "start", "seconds"} zurück
        (start/seconds None bei der Ersatzregel), sonst None.
        """
        full = opts[CONF_CHARGE_FULL]
        rise = opts[CONF_CHARGE_RISE]
        st = self._state.get(dev)
        if st is None:
            self._state[dev] = {"min": level, "min_at": now, "last": level, "peak": level, "done": level >= full}
            self._save()
            return None
        prev = st["last"]
        st["last"] = level
        if level > prev:
            # Steigt der Stand wieder, gilt die Ladung als fortgesetzt ("beendet" fällt weg).
            st["up_at"] = now
            st.pop("stopped", None)
        result: dict[str, Any] | None = None
        if st.get("done"):
            # Wieder scharf, wenn der Stand deutlich unter "voll" fällt (Entladen oder Batteriewechsel).
            if level < full - CHARGE_REARM:
                st.update(done=False, min=level, min_at=now)
        else:
            if level < st["min"]:
                st["min"], st["min_at"], st["peak"] = level, now, level
            st["peak"] = max(st.get("peak", st["min"]), level)
            if level <= st["peak"] - CHARGE_DROP:
                # Entladen: der Tiefpunkt beginnt neu (sonst bliebe "lädt" nach einem Rückgang stehen).
                st.update(min=level, min_at=now, peak=level)
            charging = level - st["min"] >= rise
            # Ersatzregel nur bei einem Sprung von mehr als 10 Punkten (sonst zählte bei "Voll ab" 80 jeder Schritt 79 → 80).
            if level >= full and (charging or (prev < min(CHARGE_JUMP_FROM, full - 10))):
                st["done"] = True
                if charging:
                    result = {"level": level, "start": st["min"], "seconds": max(0.0, now - st["min_at"])}
                else:
                    result = {"level": level, "start": prev, "seconds": None}
        self._save()
        return result

    @callback
    def _on_tick(self, _now: Any) -> None:
        self.check_stalls(time.time())

    def check_stalls(self, now: float) -> list[str]:
        """
        Ladung beendet (seit 1.40.0): Geräte, die nach dem Stand laden, deren Stand aber seit "beendet nach"
        Minuten unverändert ist (Ladelimit, Ladegerät abgezogen, Gerät voll unter "Voll ab"). Nur Geräte mit
        eingeschalteter Lademeldung, nur ohne eigene Ladeanzeige (die sagt es selbst). Gibt die Geräte-IDs zurück.
        """
        hass = self.hass
        opts = effective(hass)
        registry = dr.async_get(hass)
        ereg = er.async_get(hass)
        stopped: list[str] = []
        for dev, st in self._state.items():
            if st.get("done") or st.get("stopped"):
                continue
            device = registry.async_get(dev)
            if device is None or not self.enabled(opts, hass, device) or charging_entity(hass, er.async_entries_for_device(ereg, dev)):
                continue
            # "Ladung beendet nach" und der Push dazu: Gerät, sonst Integration, sonst global (seit 1.41.0).
            copts = device_charge_opts(hass, opts, dev)
            if now - st.get("up_at", now) < copts[CONF_CHARGE_STALL] * 60:
                continue
            # Nur wer jetzt nach dem Stand lädt (vor dem Merker "beendet"), sonst gäbe es nichts zu beenden.
            if self.charging(dev, now, copts) is None:
                continue
            st["stopped"] = True
            stopped.append(dev)
            name = device.name_by_user or device.name or dev
            args = {"level": round(st["last"]), "minutes": copts[CONF_CHARGE_STALL], "full": copts[CONF_CHARGE_FULL]}
            if opts[CONF_NOTIFY_SERVICE] == NOTIFY_NONE:
                activity.record(hass, "info", "charge", "charge_stopped_no_target", name, dev, **args)
            elif not copts[CONF_NOTIFY_CHARGE_STOP]:
                activity.record(hass, "info", "charge", "charge_stopped_push_off", name, dev, **args)
            else:
                activity.record(hass, "info", "charge", "charge_stopped_sent", name, dev, **args)
                hass.async_create_task(self._async_push_stop(dev, dict(st), copts[CONF_CHARGE_STALL]))
        if stopped:
            self._save()
        return stopped

    def charging(self, dev: str, now: float, opts: dict[str, Any]) -> dict[str, Any] | None:
        """
        Lädt das Gerät jetzt, nach dem Stand: Anstieg erkannt, noch nicht voll, zuletzt gestiegen.
        Gibt Stand, Start und Zeitpunkt des Tiefpunkts zurück, sonst None.
        """
        st = self._state.get(dev)
        if not st or st.get("done") or st.get("stopped"):
            return None
        if st["last"] - st["min"] < opts[CONF_CHARGE_RISE] or st["last"] >= opts[CONF_CHARGE_FULL]:
            return None
        up = st.get("up_at")
        if up is None or now - up > CHARGE_STALE:
            return None
        return {"level": st["last"], "from": st["min"], "since": st["min_at"], "full": opts[CONF_CHARGE_FULL], "source": "level"}

    def charging_of(self, device: dr.DeviceEntry, entries: list[er.RegistryEntry], now: float, opts: dict[str, Any]) -> dict[str, Any] | None:
        """
        "Lädt gerade" für Liste und Popup: die Ladeanzeige des Geräts, wenn es eine hat und sie
        etwas meldet (sie gilt dann allein), sonst die Erkennung am Stand, und die nur, wenn die
        Lademeldung für das Gerät eingeschaltet ist: Das ist die Erklärung "wiederaufladbar".
        Ohne sie liesse sich ein Schwanken des Stands (Knopfzelle im Kühlschrank, Batteriewechsel)
        nicht von Laden unterscheiden.
        """
        entity_id = charging_entity(self.hass, entries)
        state = self.hass.states.get(entity_id) if entity_id else None
        if state is not None and state.state not in ("unknown", "unavailable"):
            if state.state not in ("on", "charging"):
                return None
            st = self._state.get(device.id)
            full = device_charge_opts(self.hass, opts, device.id)[CONF_CHARGE_FULL]
            return {"level": st["last"] if st else None, "from": None, "since": state.last_changed.timestamp(), "full": full, "source": "entity"}
        if not self.enabled(opts, self.hass, device):
            return None
        return self.charging(device.id, now, device_charge_opts(self.hass, opts, device.id))

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"state": self._state}, 1)

    async def async_stop(self) -> None:
        if self._unsub_track is not None:
            self._unsub_track()
            self._unsub_track = None
        for unsub in self._unsubs:
            unsub()
        self._unsubs = []
        # Sofort schreiben: ein verzögerter Termin legte die Datei nach dem Entfernen neu an.
        await self._store.async_save({"state": self._state})

    def message(self, done: dict[str, Any], area: str | None) -> str:
        """"100 % · in 1 Std. 40 Min. von 22 % · Büro" (Dauer nur, wenn das Laden beobachtet wurde)."""
        hass = self.hass
        parts = [f"{round(done['level'])} %"]
        start = round(done["start"])
        if done["seconds"] is not None:
            parts.append(push.text(hass, "charge_from", duration=push.duration(hass, done["seconds"]), start=start))
        else:
            parts.append(push.text(hass, "charge_jump", start=start))
        if area:
            parts.append(area)
        return " · ".join(parts)

    async def _async_push_stop(self, dev: str, st: dict[str, Any], minutes: int) -> None:
        """Push "Ladung beendet": Stand, bisherige Ladung und wie lange er schon unverändert ist."""
        hass = self.hass
        opts = effective(hass)
        device = dr.async_get(hass).async_get(dev)
        if device is None or opts[CONF_NOTIFY_SERVICE] == NOTIFY_NONE:
            return
        area = ar.async_get(hass).async_get_area(device.area_id) if device.area_id else None
        name = device.name_by_user or device.name or dev
        parts = [f"{round(st['last'])} %", push.text(hass, "charge_from", duration=push.duration(hass, max(0.0, st.get("up_at", st["min_at"]) - st["min_at"])), start=round(st["min"]))]
        parts.append(push.text(hass, "charge_stalled", duration=push.duration(hass, minutes * 60)))
        if area:
            parts.append(area.name)
        await push.async_push(
            hass, opts[CONF_NOTIFY_SERVICE], push.text(hass, "charge_stop_title", name=name), " · ".join(parts),
            push.notification_data(hass, f"{DOMAIN}_charge_{dev}", push.device_url(opts[CONF_NOTIFY_CLICK], dev)),
        )

    async def _async_push(self, dev: str, done: dict[str, Any]) -> None:
        hass = self.hass
        opts = effective(hass)
        device = dr.async_get(hass).async_get(dev)
        if device is None or opts[CONF_NOTIFY_SERVICE] == NOTIFY_NONE:
            return
        area = ar.async_get(hass).async_get_area(device.area_id) if device.area_id else None
        name = device.name_by_user or device.name or dev
        await push.async_push(
            hass, opts[CONF_NOTIFY_SERVICE], push.text(hass, "charge_title", name=name), self.message(done, area.name if area else None),
            push.notification_data(hass, f"{DOMAIN}_charge_{dev}", push.device_url(opts[CONF_NOTIFY_CLICK], dev)),
        )
