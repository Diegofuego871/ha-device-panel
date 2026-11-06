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
from homeassistant.helpers.debounce import Debouncer
from homeassistant.helpers.event import async_track_state_change_event, async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from . import activity, push, push_icon
from .battery_history import battery_entity
from .battery_guard import get as battery_guard
from .const import (
    CHARGE_DROP,
    CHARGE_JUMP_FROM,
    CHARGE_REARM,
    CHARGE_STALE,
    CONF_CHARGE_FULL,
    CONF_CHARGE_INTEGRATIONS,
    CONF_CHARGE_RISE,
    CONF_CHARGE_LIVE,
    CONF_CHARGE_STALL,
    CONF_NOTIFY_CHARGE,
    CONF_NOTIFY_CHARGE_STOP,
    CONF_NOTIFY_CLICK,
    DOMAIN,
    LIVE_EVENT_CLEARED,
    LIVE_EVENT_DISMISSED,
    LIVE_INTERVAL,
    LIVE_KEEP,
    NOTIFY_NONE,
    STORAGE_VERSION,
)
from .devices import device_charge_opts, device_settings, monitored_devices, primary_domain
from .scope import listed
from .options_api import notify_target, effective

_LOGGER = logging.getLogger(__name__)

STORE_KEY = f"{DOMAIN}.charge"


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


# Schätzung der Ladezeit für die Live-Aktivität (seit 2.49.0): aus den Messpunkten der laufenden Ladung. Gezeigt wird sie erst, wenn
# sie trägt: genug Zeit, genug Anstieg. Gegen Ende lädt ein Akku langsamer; ab TAPER_FROM zählt die Restzeit TAPER_FACTOR-fach
# (grobe Annahme, noch nicht aus früheren Ladungen des Geräts gelernt).
ETA_WINDOW = 1800.0
ETA_MIN_SPAN = 300.0
ETA_MIN_RISE = 3.0
ETA_TAPER_FROM = 80.0
ETA_TAPER_FACTOR = 2.0
ETA_MAX = 12 * 3600.0
ETA_ROUND = 300.0
ETA_POINTS_MAX = 150
CHARGES_KEEP = 5  # aufgezeichnete Ladungen pro Gerät (seit 2.204.0)
POWER_WINDOW = 600.0  # Sekunden: Fenster für die Glättung der Leistung
CHARGE_MIN_POINTS = 3
CHARGE_MIN_RISE = 2.0
REBUILD_COOLDOWN = 2.0


def estimate_finish(points: list[list[float]], level: float, full: float, now: float) -> tuple[float, float, float] | None:
    """
    Wann ist das Ladeziel erreicht? points: [[Zeit, Stand], ...] der laufenden Ladung. Gibt (Zeitpunkt, Punkte pro Minute, Minuten
    der Messung) zurück oder None, wenn die Schätzung (noch) nicht verlässlich ist.
    """
    if level >= full:
        return None
    window = [p for p in points if now - p[0] <= ETA_WINDOW]
    if len(window) < 2:
        return None
    start_t, start_level = window[0]
    span = now - start_t
    rise = level - start_level
    if span < ETA_MIN_SPAN or rise < ETA_MIN_RISE:
        return None
    rate = rise / span  # Punkte pro Sekunde
    if level >= ETA_TAPER_FROM:
        seconds = (full - level) / rate
    else:
        seconds = (min(full, ETA_TAPER_FROM) - level) / rate + max(0.0, full - ETA_TAPER_FROM) / rate * ETA_TAPER_FACTOR
    if seconds > ETA_MAX:
        return None
    finish = round((now + seconds) / ETA_ROUND) * ETA_ROUND
    return finish, rate * 60, span / 60


def _thin(pts: list[list[float]], now: float) -> None:
    """
    Höchstens ETA_POINTS_MAX Messpunkte (seit 2.204.1): statt der ältesten fällt jeder zweite Punkt vor dem Fenster der Restzeit weg. Der erste
    Punkt (Beginn der Ladung) bleibt, sonst begänne die aufgezeichnete Ladung bei Sensoren mit Nachkommastellen zu spät; die Punkte im Fenster
    der Restzeit bleiben vollständig.
    """
    if len(pts) <= ETA_POINTS_MAX:
        return
    recent = next((i for i, p in enumerate(pts) if now - p[0] <= ETA_WINDOW), len(pts))
    if recent > 2:
        # Zwischen dem ersten Punkt und dem Fenster jeden zweiten weglassen
        pts[1:recent] = pts[2:recent:2]
    if len(pts) > ETA_POINTS_MAX:
        # Mehr Punkte im Fenster als erlaubt (sehr häufige Meldungen): den ältesten nach dem Beginn weglassen
        del pts[1 : len(pts) - ETA_POINTS_MAX + 1]


def _valid_charge(c: Any) -> bool:
    """Eine gespeicherte Ladung: Start, Ende, Stand von bis und mindestens zwei Messpunkte [Zeit, Stand]."""
    return (
        isinstance(c, dict)
        and all(isinstance(c.get(k), (int, float)) for k in ("start", "end", "from", "to"))
        and isinstance(c.get("pts"), list)
        and len(c["pts"]) >= 2
        and all(isinstance(p, list) and len(p) == 2 and all(isinstance(x, (int, float)) for x in p) for p in c["pts"])
    )


class ChargeNotifier:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORE_KEY)
        # Je Gerät: tiefster Stand mit Zeitpunkt, letzter Stand, gemeldet (bis er wieder fällt).
        self._state: dict[str, dict[str, Any]] = {}
        self._entities: dict[str, str] = {}
        self._unsub_track: CALLBACK_TYPE | None = None
        self._unsubs: list[CALLBACK_TYPE] = []
        # Live-Aktivität beim Laden (seit 2.19.0), je Gerät: tag, phase ("active", "done", "dismissed"), at (letztes
        # Senden), level (zuletzt gesendet), done_at. Wird mitgespeichert: nach einem Neustart läuft sie weiter.
        self._live: dict[str, dict[str, Any]] = {}
        # Abgeschlossene Ladungen je Gerät, die letzten CHARGES_KEEP (seit 2.204.0): {"start", "end", "from", "to", "pts": [[Zeit, Stand], ...]}
        self._charges: dict[str, list[dict[str, Any]]] = {}
        self._live_warned: set[str] = set()
        # Änderungen im Entitäts-Register kommen oft gebündelt (Start, Neueinbindung eines Funknetzes): die erste baut sofort neu auf, weitere
        # innert REBUILD_COOLDOWN Sekunden zusammen einmal am Ende (seit 2.204.1; vorher ein ganzer Durchlauf über alle Geräte je Ereignis)
        self._rebuilder: Debouncer[Any] = Debouncer(hass, _LOGGER, cooldown=REBUILD_COOLDOWN, immediate=True, function=self.async_rebuild)

    async def async_start(self) -> None:
        stored = await self._store.async_load() or {}
        raw = stored.get("state") if isinstance(stored, dict) else None
        if isinstance(raw, dict):
            self._state = {
                k: v for k, v in raw.items()
                if isinstance(k, str) and isinstance(v, dict) and all(isinstance(v.get(f), (int, float)) for f in ("min", "min_at", "last"))
            }
        charges = stored.get("charges") if isinstance(stored, dict) else None
        if isinstance(charges, dict):
            for dev, lst in charges.items():
                if isinstance(dev, str) and isinstance(lst, list):
                    ok = [c for c in lst if _valid_charge(c)]
                    if ok:
                        self._charges[dev] = ok[-CHARGES_KEEP:]
        live = stored.get("live") if isinstance(stored, dict) else None
        if isinstance(live, dict):
            self._live = {
                k: v for k, v in live.items()
                if isinstance(k, str) and isinstance(v, dict) and isinstance(v.get("tag"), str) and v.get("phase") in ("active", "done", "dismissed")
                and isinstance(v.get("at"), (int, float)) and isinstance(v.get("level"), (int, float))
            }
        # Wegwischen: iOS (Ereignis in Core, sobald vorhanden) und Android (Benachrichtigung entfernt), beide mit dem Tag.
        self._unsubs.append(self.hass.bus.async_listen(LIVE_EVENT_DISMISSED, self._on_live_event))
        self._unsubs.append(self.hass.bus.async_listen(LIVE_EVENT_CLEARED, self._on_live_event))
        # Neue Entitäten und Geräte (Register) ändern, welche Sensoren zu beobachten sind.
        # Alle überwachten Geräte mit Batterie werden beobachtet (für "lädt gerade" im Panel);
        # die Meldung bei "voll" geht nur an die eingeschalteten.
        self._unsubs.append(self.hass.bus.async_listen(er.EVENT_ENTITY_REGISTRY_UPDATED, self._on_registry))
        # Ladung beendet (seit 1.40.0): ein gleichbleibender Stand löst kein Ereignis aus, darum ein Termin jede Minute.
        self._unsubs.append(async_track_time_interval(self.hass, self._on_tick, timedelta(minutes=1)))
        await self.async_rebuild()

    @callback
    def _on_registry(self, _event: Event) -> None:
        self._rebuilder.async_schedule_call()

    @staticmethod
    def enabled(opts: dict[str, Any], hass: HomeAssistant, device: dr.DeviceEntry) -> bool:
        """Lademeldung für ein Gerät: Wahl am Gerät, sonst die Integration."""
        if not opts[CONF_NOTIFY_CHARGE]:
            return False
        own = device_settings(hass).get("charge", {}).get(device.id)
        if own is not None:
            return bool(own)
        domain = primary_domain(hass, device)
        return bool(listed(opts[CONF_CHARGE_INTEGRATIONS], domain))

    @staticmethod
    def known_rechargeable(opts: dict[str, Any], hass: HomeAssistant, device: dr.DeviceEntry) -> bool:
        """
        Weiss das Panel, dass das Gerät geladen wird (seit 2.203.1)? Ja, wenn die Lademeldung für es gilt, wenn sie am Gerät ausdrücklich
        eingeschaltet ist (auch bei ausgeschaltetem globalem Schalter) oder wenn die Live-Aktivität für es an ist: Wer sie einschaltet,
        sagt damit, dass das Gerät wiederaufladbar ist (wie in _is_charging). Vorher zählte nur die Lademeldung mit globalem Schalter.
        """
        if ChargeNotifier.enabled(opts, hass, device):
            return True
        if device_settings(hass).get("charge", {}).get(device.id) is True:
            return True
        return bool(device_charge_opts(hass, opts, device.id).get(CONF_CHARGE_LIVE))

    @staticmethod
    def rechargeable(opts: dict[str, Any], hass: HomeAssistant, device: dr.DeviceEntry) -> bool:
        """
        Ist das ein Gerät, das geladen wird (nicht: dessen Batterie gewechselt wird)? Ja, wenn die Lademeldung für es an
        ist oder es eine eigene Ladeanzeige hat (Binärsensor battery_charging, Batteriestatus der Companion-App). Seit 2.33.0
        (Wunsch des Nutzers): Das Fenster "Batterie" und die KI-Einschätzung nennen einen Anstieg dann "Laden" und
        nicht "Wechsel", auch ohne Lademeldung. Ohne beides kann das Panel Laden und Wechsel nicht unterscheiden.
        """
        if ChargeNotifier.known_rechargeable(opts, hass, device):
            return True
        return charging_entity(hass, er.async_entries_for_device(er.async_get(hass), device.id)) is not None

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
            if dev not in self._state and (level := battery_guard(hass).level(entity_id, hass.states.get(entity_id))) is not None:
                self._state[dev] = {"min": level, "min_at": now, "last": level, "done": level >= device_charge_opts(hass, opts, dev)[CONF_CHARGE_FULL]}
        if wanted:
            self._unsub_track = async_track_state_change_event(hass, list(wanted), self._on_state)
        self._save()

    @callback
    def _on_state(self, event: Event) -> None:
        dev = self._entities.get(event.data["entity_id"])
        # Glaubwürdiger Stand (seit 2.43.0): ein Messfehler (76 % - 2 % - 68 %) soll weder Tiefpunkt noch "lädt" verfälschen
        level = battery_guard(self.hass).level(event.data["entity_id"], event.data.get("new_state"))
        if dev is None or level is None:
            return
        opts = effective(self.hass)
        # Eigenes "Voll ab" und eigener Anstieg des Geräts (seit 1.35.0) gelten für die Erkennung wie für den Push.
        copts = device_charge_opts(self.hass, opts, dev)
        now = time.time()
        was = self.charging(dev, now, copts) is not None
        before = (self._state.get(dev) or {}).get("last")
        done = self.step(dev, level, now, copts)
        self._live_eval(dev, now)
        device = dr.async_get(self.hass).async_get(dev)
        name = (device.name_by_user or device.name or dev) if device is not None else dev
        st = self._state.get(dev) or {}
        low = round(st.get("min", level))
        hass = self.hass
        # Nur bei geändertem Stand: Wiederverbindungen (Matter, Eve) melden viele Geräte zugleich mit gleichem Wert und füllten das Protokoll (seit 2.43.0)
        if before is None or round(before) != round(level):
            activity.record(hass, "debug", "charge", "charge_level", name, dev, level=round(level), low=low, full=copts[CONF_CHARGE_FULL], rise=copts[CONF_CHARGE_RISE])
        if not was and done is None and self.charging(dev, now, copts) is not None:
            activity.record(hass, "info", "charge", "charge_started", name, dev, level=round(level), low=low, rise=copts[CONF_CHARGE_RISE])
        if done is None:
            return
        if device is None or not self.enabled(opts, hass, device):
            activity.record(hass, "info", "charge", "charge_full_off", name, dev, level=round(done["level"]), full=copts[CONF_CHARGE_FULL])
            return
        if notify_target(opts, "charge") == NOTIFY_NONE:
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
            self._state[dev] = {"min": level, "min_at": now, "last": level, "peak": level, "done": level >= full, **({} if level >= full else {"pts": [[now, level]]})}
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
                # Auch die Spitze neu: sonst hielte der nächste Anstieg die alte Spitze ("voll") für den Massstab und gälte als Entladen
                st.update(done=False, min=level, min_at=now, peak=level)
        else:
            if level < st["min"]:
                self._record_charge(dev, st, now)
                st["min"], st["min_at"], st["peak"] = level, now, level
            st["peak"] = max(st.get("peak", st["min"]), level)
            if level <= st["peak"] - CHARGE_DROP:
                # Entladen: der Tiefpunkt beginnt neu (sonst bliebe "lädt" nach einem Rückgang stehen).
                self._record_charge(dev, st, now)
                st.update(min=level, min_at=now, peak=level)
            charging = level - st["min"] >= rise
            # Ersatzregel nur bei einem Sprung von mehr als 10 Punkten (sonst zählte bei "Voll ab" 80 jeder Schritt 79 → 80).
            if level >= full and (charging or (prev < min(CHARGE_JUMP_FROM, full - 10))):
                st["done"] = True
                if charging:
                    result = {"level": level, "start": st["min"], "seconds": max(0.0, now - st["min_at"])}
                else:
                    result = {"level": level, "start": prev, "seconds": None}
        # Messpunkte der laufenden Ladung für die Restzeit im Panel (seit 2.202.0); eine neue Ladung (neuer Tiefpunkt) beginnt neu, nach "voll" entfallen sie
        # (die Ladung ist dann in self._charges festgehalten, seit 2.204.0)
        if st.get("done"):
            if result is not None:
                pts = st.setdefault("pts", [])
                if not pts or pts[-1][1] != level:
                    pts.append([now, level])
                self._record_charge(dev, st, now)
            st.pop("pts", None)
        else:
            pts = st.setdefault("pts", [])
            if st["min_at"] == now:
                pts.clear()
            if not pts or pts[-1][1] != level:
                pts.append([now, level])
                _thin(pts, now)
        self._save()
        return result

    def _record_charge(self, dev: str, st: dict[str, Any], now: float) -> None:
        """
        Die laufende Ladung festhalten (seit 2.204.0), wenn sie endet: voll, Stillstand oder Entladen. Gespeichert werden die Messpunkte;
        zu kurze Ladungen (zu wenige Punkte, kaum Anstieg) zählen nicht. Dieselbe Ladung (gleicher Start) ersetzt ihren früheren Eintrag
        (zum Beispiel nach "beendet", wenn sie weitergeht).
        """
        pts = st.get("pts") or []
        if len(pts) < CHARGE_MIN_POINTS or max(p[1] for p in pts) - pts[0][1] < CHARGE_MIN_RISE:
            return
        rec = {
            "start": pts[0][0],
            "end": max(p[0] for p in pts) if st.get("up_at") is None else min(float(st["up_at"]), now),
            "from": pts[0][1],
            "to": max(p[1] for p in pts),
            "pts": [list(p) for p in pts],
        }
        lst = self._charges.setdefault(dev, [])
        lst[:] = [c for c in lst if c["start"] != rec["start"]]
        lst.append(rec)
        lst.sort(key=lambda c: c["start"])
        del lst[:-CHARGES_KEEP]

    def charges_info(self, dev: str) -> tuple[int, float | None]:
        """Zahl der aufgezeichneten Ladungen und Ende der letzten (für die Kachel "Ladungen")."""
        lst = self._charges.get(dev) or []
        return len(lst), (lst[-1]["end"] if lst else None)

    def charges_view(self, dev: str, wh: float | None) -> list[dict[str, Any]]:
        """
        Die aufgezeichneten Ladungen des Geräts, neueste zuerst, für das Fenster "Ladungen": Kurve (Sekunden ab Start, Stand), mit Kapazität
        auch die Leistung ins Akku in Watt (über ein Fenster von POWER_WINDOW Sekunden geglättet, nicht von Punkt zu Punkt), Durchschnitt
        und Spitze. Alles Schätzungen.
        """
        out: list[dict[str, Any]] = []
        for c in reversed(self._charges.get(dev) or []):
            pts = c["pts"]
            t0 = pts[0][0]
            curve = [[round(p[0] - t0), p[1]] for p in pts]
            watts: list[float | None] | None = None
            avg = peak = None
            if wh:
                watts = [None]
                for i in range(1, len(pts)):
                    j = next((k for k in range(i) if pts[i][0] - pts[k][0] <= POWER_WINDOW), i - 1)
                    dt = pts[i][0] - pts[j][0]
                    watts.append(round(max(0.0, (pts[i][1] - pts[j][1]) / 100 * wh * 3600 / dt), 1) if dt > 0 else None)
                dur = pts[-1][0] - t0
                avg = round((pts[-1][1] - pts[0][1]) / 100 * wh * 3600 / dur, 1) if dur > 0 else None
                real = [w for w in watts if w is not None]
                peak = max(real) if real else None
            out.append(
                {
                    "start": c["start"],
                    "end": c["end"],
                    "minutes": max(1, round((pts[-1][0] - t0) / 60)),
                    "from": round(c["from"]),
                    "to": round(c["to"]),
                    "pts": curve,
                    "watts": watts,
                    "avg_w": avg,
                    "peak_w": peak,
                }
            )
        return out

    @callback
    def _on_tick(self, _now: Any) -> None:
        self.last_tick = time.time()  # Lebenszeichen für die Status-App (status.py)
        self.check_stalls(time.time())
        self.live_check()

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
            if device is None or charging_entity(hass, er.async_entries_for_device(ereg, dev)):
                continue
            # "Ladung beendet nach" und der Push dazu: Gerät, sonst Integration, sonst global (seit 1.41.0).
            copts = device_charge_opts(hass, opts, dev)
            push_on = self.enabled(opts, hass, device)
            # Auch mit nur der Live-Aktivität (2.19.0) muss "beendet" erkannt werden, sonst bliebe sie nach dem Abziehen stehen
            if not push_on and not copts[CONF_CHARGE_LIVE]:
                continue
            if now - st.get("up_at", now) < copts[CONF_CHARGE_STALL] * 60:
                continue
            # Nur wer jetzt nach dem Stand lädt (vor dem Merker "beendet"), sonst gäbe es nichts zu beenden.
            if self.charging(dev, now, copts) is None:
                continue
            st["stopped"] = True
            self._record_charge(dev, st, now)
            stopped.append(dev)
            if not push_on:
                continue
            name = device.name_by_user or device.name or dev
            args = {"level": round(st["last"]), "minutes": copts[CONF_CHARGE_STALL], "full": copts[CONF_CHARGE_FULL]}
            if notify_target(opts, "charge") == NOTIFY_NONE:
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
        return {"level": st["last"], "from": st["min"], "since": st["min_at"], "full": opts[CONF_CHARGE_FULL], "source": "level", **self._eta(st, opts[CONF_CHARGE_FULL], now)}

    @staticmethod
    def _eta(st: dict[str, Any] | None, full: float, now: float) -> dict[str, Any]:
        """Restzeit der laufenden Ladung (gleiche Schätzung wie die Live-Aktivität): {"eta": Zeitpunkt, "rate": Punkte pro Minute}; leer, solange sie nicht trägt."""
        pts = st.get("pts") if st else None
        est = estimate_finish(pts, st["last"], full, now) if pts and st else None
        return {"eta": est[0], "rate": est[1]} if est else {"eta": None, "rate": None}

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
            return {"level": st["last"] if st else None, "from": None, "since": state.last_changed.timestamp(), "full": full, "source": "entity", **self._eta(st, full, now)}
        if not self.known_rechargeable(opts, self.hass, device):
            return None
        return self.charging(device.id, now, device_charge_opts(self.hass, opts, device.id))

    # -- Live-Aktivität beim Laden (seit 2.19.0) ---------------------------------------

    def _is_charging(self, device: dr.DeviceEntry, now: float, copts: dict[str, Any]) -> bool:
        """
        Lädt das Gerät jetzt: die Ladeanzeige, wenn es eine hat und sie etwas meldet, sonst der Anstieg des Stands. Anders als
        bei "lädt" im Panel kommt es hier nicht auf die Lademeldung an: Wer die Live-Aktivität einschaltet, sagt damit,
        dass das Gerät wiederaufladbar ist.
        """
        entries = er.async_entries_for_device(er.async_get(self.hass), device.id)
        entity_id = charging_entity(self.hass, entries)
        state = self.hass.states.get(entity_id) if entity_id else None
        if state is not None and state.state not in ("unknown", "unavailable"):
            return state.state in ("on", "charging")
        return self.charging(device.id, now, copts) is not None

    @callback
    def live_check(self) -> None:
        """Alle Geräte neu beurteilen: jede Minute und nach einer geänderten Einstellung."""
        now = time.time()
        for dev in {*self._state, *self._live}:
            self._live_eval(dev, now)

    def _live_eval(self, dev: str, now: float) -> None:
        """
        Eine Live-Aktivität starten, aktualisieren oder beenden. Stille Updates höchstens alle LIVE_INTERVAL Sekunden und nur
        bei neuem Prozentwert (sonst vibriert das Telefon bei jedem Aktualisieren). Ziel ist das "Voll ab" des Geräts.
        """
        hass = self.hass
        opts = effective(hass)
        device = dr.async_get(hass).async_get(dev)
        live = self._live.get(dev)
        copts = device_charge_opts(hass, opts, dev) if device is not None else None
        enabled = copts is not None and bool(copts[CONF_CHARGE_LIVE])
        st = self._state.get(dev)
        if live is None:
            if not enabled or st is None or device is None or copts is None:
                return
            if st["last"] >= copts[CONF_CHARGE_FULL] or not self._is_charging(device, now, copts):
                self._live_warned.discard(dev)
                return
            name = device.name_by_user or device.name or dev
            if notify_target(opts, "charge") == NOTIFY_NONE:
                if dev not in self._live_warned:
                    self._live_warned.add(dev)
                    activity.record(hass, "warning", "charge", "charge_live_no_target", name, dev, level=round(st["last"]))
                return
            # Messpunkte der Ladung für die Schätzung: der Tiefpunkt zu Beginn und der jetzige Stand
            points = [[st["min_at"], st["min"]]] if st.get("min_at", now) < now and st["min"] < st["last"] else []
            self._live[dev] = {"tag": f"{DOMAIN}_live_{dev}", "phase": "active", "at": now, "level": st["last"], "done_at": None, "pts": [*points, [now, st["last"]]]}
            self._save()
            activity.record(hass, "info", "charge", "charge_live_start", name, dev, level=round(st["last"]), full=copts[CONF_CHARGE_FULL])
            self._live_send(dev, update=False)
            return
        if not enabled or device is None or copts is None:
            self._live_end(dev, "charge_live_why_off", clear=live["phase"] != "dismissed")
            return
        full = copts[CONF_CHARGE_FULL]
        level = st["last"] if st else live["level"]
        phase = live["phase"]
        if phase == "dismissed":
            # Weggewischt: für diese Ladung kommt nichts mehr; erst wenn sie vorbei ist, gilt die nächste wieder
            if level >= full or not self._is_charging(device, now, copts):
                self._live.pop(dev, None)
                self._save()
            return
        if phase == "done":
            if now - (live.get("done_at") or now) >= LIVE_KEEP:
                self._live_end(dev, "charge_live_why_done")
            return
        if level >= full:
            live.update(phase="done", done_at=now, level=level, at=now)
            self._save()
            name = device.name_by_user or device.name or dev
            activity.record(hass, "info", "charge", "charge_live_done", name, dev, full=full, minutes=LIVE_KEEP // 60)
            self._live_send(dev, update=True, done=True)
            return
        if not self._is_charging(device, now, copts):
            self._live_end(dev, "charge_live_why_stopped")
            return
        pts = live.setdefault("pts", [])
        if not pts or pts[-1][1] != level:
            pts.append([now, level])
            del pts[:-ETA_POINTS_MAX]
        if now - live["at"] >= LIVE_INTERVAL and round(level) != round(live["level"]):
            live.update(at=now, level=level)
            self._save()
            self._live_send(dev, update=True)

    def _live_end(self, dev: str, why: str, clear: bool = True) -> None:
        """Live-Aktivität beenden: Eintrag zuerst weg (ein Ereignis auf unser eigenes Beenden gilt dann nicht als Wegwischen), dann clear_notification."""
        live = self._live.pop(dev, None)
        if live is None:
            return
        self._live_warned.discard(dev)
        self._save()
        hass = self.hass
        device = dr.async_get(hass).async_get(dev)
        name = (device.name_by_user or device.name or dev) if device is not None else dev
        activity.record(hass, "info", "charge", "charge_live_end", name, dev, reason=activity.text(hass, why))
        if clear:
            hass.async_create_task(push.async_live_clear(hass, notify_target(effective(hass), "charge"), live["tag"]))

    def _live_send(self, dev: str, *, update: bool, done: bool = False) -> None:
        """
        Start oder Update senden. Daten für iOS (Live-Aktivität) und Android (Live-Update) zugleich: live_update, tag, progress
        und progress_max, Symbol, kurzer Text. Updates sind auf iOS "silent" (nur der Start darf melden) und auf Android
        "alert_once".
        """
        hass = self.hass
        opts = effective(hass)
        device = dr.async_get(hass).async_get(dev)
        live = self._live.get(dev)
        st = self._state.get(dev)
        if device is None or live is None or st is None:
            return
        full = int(device_charge_opts(hass, opts, dev)[CONF_CHARGE_FULL])
        level = int(round(full if done else min(live["level"], full)))
        name = device.name_by_user or device.name or dev
        url = push.device_url(opts[CONF_NOTIFY_CLICK], dev)
        data: dict[str, Any] = {
            "tag": live["tag"],
            "live_update": True,
            "progress": level,
            "progress_max": full,
            "notification_icon": "mdi:battery-check" if done else "mdi:battery-charging",
            "critical_text": f"{level} %",
            "url": url,
            "clickAction": url,
            "alert_once": True,
        }
        if update:
            data["silent"] = True
        if done:
            title = push.title(hass, opts, "charge", "charge_live_done_title", name=name)
            message = push.text(hass, "charge_live_done", full=full)
        else:
            title = push.title(hass, opts, "charge", "charge_live_title", name=name)
            message = push.text(hass, "charge_live_progress", level=level, full=full)
            # Schätzung "fertig gegen 14:35" davor, sobald sie verlässlich ist (mit dem nächsten Update, kein eigener Takt)
            now = time.time()
            if (eta := estimate_finish(live.get("pts") or [], st["last"], full, now)) is not None:
                finish, rate, minutes = eta
                local = dt_util.as_local(dt_util.utc_from_timestamp(finish))
                clock = local.strftime("%H:%M")
                tomorrow = local.date() != dt_util.as_local(dt_util.utc_from_timestamp(now)).date()
                text = push.text(hass, "charge_live_eta_tomorrow" if tomorrow else "charge_live_eta", time=clock)
                message = push.text(hass, "charge_live_progress_eta", eta=text, level=level, full=full)
                activity.record(hass, "debug", "charge", "charge_live_eta", name, dev, rate=round(rate, 2), minutes=round(minutes), level=round(st["last"]), full=full, time=clock)
        hass.async_create_task(push.async_live(hass, notify_target(opts, "charge"), name, title, message, data))

    @callback
    def _on_live_event(self, event: Event) -> None:
        """
        Der Nutzer hat die Live-Aktivität weggewischt: für diese Ladung kommen keine Updates mehr (sonst startete jedes Update
        sie neu, auf iOS mit Alarm). iOS: Ereignis von Core (Pull Request home-assistant/core#183255, noch nicht in jeder
        Version), Android: mobile_app_notification_cleared. Beide tragen den Tag. Nicht unterscheidbar ist, welches Telefon
        einer Gruppe es war; das Ziel gilt als Ganzes.
        """
        data = event.data
        tag = data.get("tag")
        if not isinstance(tag, str):
            inner = data.get("data")
            tag = inner.get("tag") if isinstance(inner, dict) else None
        if not isinstance(tag, str):
            return
        now = time.time()
        for dev, live in self._live.items():
            if live["tag"] != tag or live["phase"] == "dismissed":
                continue
            # Ein Ersetzen durch unser Update kurz davor ist kein Wegwischen
            if event.event_type == LIVE_EVENT_CLEARED and now - live["at"] < 5:
                continue
            live["phase"] = "dismissed"
            self._save()
            device = dr.async_get(self.hass).async_get(dev)
            name = (device.name_by_user or device.name or dev) if device is not None else dev
            activity.record(self.hass, "info", "charge", "charge_live_dismissed", name, dev, target=notify_target(effective(self.hass), "charge"))

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"state": self._state, "live": self._live, "charges": self._charges}, 1)

    async def async_stop(self) -> None:
        self._rebuilder.async_cancel()
        if self._unsub_track is not None:
            self._unsub_track()
            self._unsub_track = None
        for unsub in self._unsubs:
            unsub()
        self._unsubs = []
        # Sofort schreiben: ein verzögerter Termin legte die Datei nach dem Entfernen neu an.
        await self._store.async_save({"state": self._state, "live": self._live, "charges": self._charges})

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
        if device is None or notify_target(opts, "charge") == NOTIFY_NONE:
            return
        area = ar.async_get(hass).async_get_area(device.area_id) if device.area_id else None
        name = device.name_by_user or device.name or dev
        parts = [f"{round(st['last'])} %", push.text(hass, "charge_from", duration=push.duration(hass, max(0.0, st.get("up_at", st["min_at"]) - st["min_at"])), start=round(st["min"]))]
        parts.append(push.text(hass, "charge_stalled", duration=push.duration(hass, minutes * 60)))
        if area:
            parts.append(area.name)
        await push.async_push(
            hass, notify_target(opts, "charge"), push.title(hass, opts, "charge_stop", "charge_stop_title", name=name), " · ".join(parts),
            push.notification_data(
                hass, f"{DOMAIN}_charge_{dev}", push.device_url(opts[CONF_NOTIFY_CLICK], dev),
                icon=await push_icon.async_integration_icon(hass, primary_domain(hass, device)),
            ),
            topic="charge", quiet={"label": name}, devices=[dev],
        )

    async def _async_push(self, dev: str, done: dict[str, Any]) -> None:
        hass = self.hass
        opts = effective(hass)
        device = dr.async_get(hass).async_get(dev)
        if device is None or notify_target(opts, "charge") == NOTIFY_NONE:
            return
        area = ar.async_get(hass).async_get_area(device.area_id) if device.area_id else None
        name = device.name_by_user or device.name or dev
        await push.async_push(
            hass, notify_target(opts, "charge"), push.title(hass, opts, "charge", "charge_title", name=name), self.message(done, area.name if area else None),
            push.notification_data(
                hass, f"{DOMAIN}_charge_{dev}", push.device_url(opts[CONF_NOTIFY_CLICK], dev),
                icon=await push_icon.async_integration_icon(hass, primary_domain(hass, device)),
            ),
            topic="charge", quiet={"label": name}, devices=[dev],
        )
