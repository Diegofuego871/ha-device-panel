"""
Empfangsverlauf für das Geräte-Popup (seit 0.24.0, Wunsch des Nutzers:
Tipp auf die Kachel "Empfang" zeigt den Verlauf).

Zwei Quellen, je nachdem, woher der Wert in der Liste kommt
(devices.signal_source):

- Sensor (WLAN-RSSI, Zigbee2MQTT-LQI …): der Recorder, wie beim
  Batterie-Verlauf; 24 Std. und 7 Tage aus dem Verlauf, 30 Tage aus der
  Langzeitstatistik, sonst dem Verlauf.
- ZHA und Bluetooth: Der Wert kommt direkt aus der Integration, der Recorder
  kennt ihn nicht. Das Panel zeichnet ihn selbst auf (wie signal_log in
  unifi_dynamic): jede Minute für überwachte Geräte, die online sind,
  zusammengefasst in 5-Minuten-Blöcke (24 Std.) und Stunden (31 Tage).
  Ein Block ist [Start, Median, Schlechtester, Bester]. Kein Block heisst
  keine Messung (offline, ausser Reichweite): im Diagramm eine Lücke.
- Sensor, den der Recorder nicht aufzeichnet (in dessen Konfiguration
  ausgeschlossen, oder kein Recorder; seit 0.26.0): wie ZHA und Bluetooth.
"""

from __future__ import annotations

import logging
import statistics
import time
from datetime import timedelta
from typing import Any

from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .availability import ONLINE
from .battery_history import STATS_FROM_DAYS, _history, _statistics, held, thin
from .const import DATA_AVAILABILITY, DOMAIN, STORAGE_VERSION
from .compat import device_entry_ids
from .devices import monitored_devices, signal_sensor, signal_source
from .options_api import effective
from .storage_util import PeriodicSaver

_LOGGER = logging.getLogger(__name__)

STORAGE_KEY = f"{DOMAIN}.signal"
RANGES = {"24h": 86400, "7d": 7 * 86400, "30d": 30 * 86400}
SAMPLE_INTERVAL = timedelta(seconds=60)
BLOCK_SECONDS = 300
HOUR_SECONDS = 3600
KEEP_BLOCKS = 86400 + HOUR_SECONDS
KEEP_HOURS = 31 * 86400
# Seltener als das Verfügbarkeitsprotokoll: ein verlorener Block nach einem
# Absturz ist verschmerzbar, die Datei ist grösser.
SAVE_DELAY = 900
# Quellen, die nur das Panel aufzeichnet.
LOGGED = ("zha", "ble")
# Plausible Werte; alles andere ist ein Messfehler (z. B. 0 dBm, 127 dBm).
DBM_RANGE = (-130.0, -1.0)
LQI_RANGE = (0.0, 255.0)


def recorded(hass: HomeAssistant, entity_id: str) -> bool:
    """Zeichnet der Recorder die Entität auf? Ohne Recorder oder ausgeschlossen nicht."""
    if "recorder" not in hass.config.components:
        return False
    try:
        from homeassistant.components.recorder import get_instance  # noqa: PLC0415

        entity_filter = get_instance(hass).entity_filter
    except Exception:  # noqa: BLE001 - Recorder noch nicht bereit: wie bisher fragen
        return True
    return entity_filter is None or entity_filter(entity_id)


def _plausible(kind: str, value: float) -> bool:
    low, high = DBM_RANGE if kind == "dbm" else LQI_RANGE
    return low <= value <= high


def parser(kind: str):
    """Wert eines Zustands im Recorder (Text) oder None, wenn unbrauchbar."""

    def parse(state: str) -> float | None:
        try:
            value = float(state)
        except (TypeError, ValueError):
            return None
        return value if _plausible(kind, value) else None

    return parse


def _block(values: list[float], start: float) -> list[float]:
    """[Start, Median, Schlechtester, Bester]."""
    return [round(start), round(statistics.median(values), 1), round(min(values), 1), round(max(values), 1)]


def _hour(blocks: list[list[float]], start: float) -> list[float]:
    """Stunde aus ihren 5-Minuten-Blöcken."""
    return [round(start), round(statistics.median(b[1] for b in blocks), 1), min(b[2] for b in blocks), max(b[3] for b in blocks)]


class SignalLog:
    """Eigene Aufzeichnung des Empfangs für Geräte ohne Sensor (ZHA, Bluetooth)."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._saver = PeriodicSaver(self._store, self.data, SAVE_DELAY)
        self._kind: dict[str, str] = {}
        self._blocks: dict[str, list[list[float]]] = {}
        self._hours: dict[str, list[list[float]]] = {}
        # Laufender Block pro Gerät: [Start, Werte]; laufende Stunde: [Start, Blöcke].
        self._open: dict[str, list[Any]] = {}
        self._open_hour: dict[str, list[Any]] = {}
        self._unsub_tick: CALLBACK_TYPE | None = None
        self._unsub_started: CALLBACK_TYPE | None = None

    # -- Speicher --------------------------------------------------------------

    async def async_start(self) -> None:
        try:
            stored = await self._store.async_load() or {}
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Empfangsverlauf konnte nicht geladen werden: %s", err)
            stored = {}
        self.load(stored, time.time())
        if self.hass.is_running:
            self._start_ticking()
        else:
            self._unsub_started = self.hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, self._on_started)

    async def async_stop(self) -> None:
        if self._unsub_tick is not None:
            self._unsub_tick()
            self._unsub_tick = None
        if self._unsub_started is not None:
            self._unsub_started()
            self._unsub_started = None
        await self._saver.async_save()

    @callback
    def _on_started(self, _event: Event) -> None:
        self._unsub_started = None
        self._start_ticking()

    @callback
    def _start_ticking(self) -> None:
        self._unsub_tick = async_track_time_interval(self.hass, self._async_tick, SAMPLE_INTERVAL)

    async def _async_tick(self, _now: Any) -> None:
        self.sample()

    def load(self, stored: dict[str, Any], now: float) -> None:
        def rows(raw: Any) -> dict[str, list[list[float]]]:
            return {
                str(dev): [list(b) for b in items if isinstance(b, list) and len(b) == 4]
                for dev, items in (raw or {}).items()
                if isinstance(items, list)
            }

        self._kind = {str(k): v for k, v in (stored.get("kind") or {}).items() if v in ("dbm", "lqi")}
        self._blocks = rows(stored.get("blocks"))
        self._hours = rows(stored.get("hours"))
        self._open = {
            str(dev): [o[0], [float(v) for v in o[1]]]
            for dev, o in (stored.get("open") or {}).items()
            if isinstance(o, list) and len(o) == 2 and isinstance(o[1], list)
        }
        self._open_hour = {
            str(dev): [o[0], [list(b) for b in o[1]]]
            for dev, o in (stored.get("open_hours") or {}).items()
            if isinstance(o, list) and len(o) == 2 and isinstance(o[1], list)
        }
        self.prune(now)

    def data(self) -> dict[str, Any]:
        return {"kind": self._kind, "blocks": self._blocks, "hours": self._hours, "open": self._open, "open_hours": self._open_hour}

    # -- Aufzeichnen -------------------------------------------------------

    @callback
    def sample(self, now: float | None = None) -> None:
        """
        Empfang aller überwachten Geräte, die gerade online sind und deren Wert
        sonst niemand aufzeichnet: ZHA, Bluetooth, Sensor ohne Recorder.
        """
        now = now if now is not None else time.time()
        log = self.hass.data.get(DATA_AVAILABILITY)
        wrote = False
        for device, entries in monitored_devices(self.hass, effective(self.hass)):
            # Ausgefallen: ZHA und Bluetooth liefern den letzten Wert weiter,
            # er sagt nichts über jetzt.
            events = log.events(device.id) if log is not None else []
            if not events or events[-1][1] != ONLINE:
                continue
            domains = {e.domain for eid in device_entry_ids(device) if (e := self.hass.config_entries.async_get_entry(eid))}
            signal, _via, source = signal_source(self.hass, device, entries, domains)
            if not signal or signal.get("value") is None:
                continue
            if source not in LOGGED and (source is None or recorded(self.hass, source)):
                continue
            self.record(device.id, signal["kind"], float(signal["value"]), now)
            wrote = True
        self.prune(now)
        if wrote:
            self._saver.schedule()

    def record(self, dev: str, kind: str, value: float, now: float) -> None:
        if not _plausible(kind, value):
            return
        if self._kind.get(dev) not in (None, kind):
            # Andere Art (z. B. Gerät neu angelernt): alter Verlauf passt nicht mehr.
            self.forget(dev)
        self._kind[dev] = kind
        start = now - (now % BLOCK_SECONDS)
        current = self._open.get(dev)
        if current is not None and current[0] != start:
            self._close(dev)
            current = None
        if current is None:
            current = [start, []]
            self._open[dev] = current
        current[1].append(value)

    def _close(self, dev: str) -> None:
        current = self._open.pop(dev, None)
        if current is None or not current[1]:
            return
        block = _block(current[1], current[0])
        self._blocks.setdefault(dev, []).append(block)
        hour_start = block[0] - (block[0] % HOUR_SECONDS)
        hour = self._open_hour.get(dev)
        if hour is not None and hour[0] != hour_start:
            self._close_hour(dev)
            hour = None
        if hour is None:
            hour = [hour_start, []]
            self._open_hour[dev] = hour
        hour[1].append(block)

    def _close_hour(self, dev: str) -> None:
        hour = self._open_hour.pop(dev, None)
        if hour is not None and hour[1]:
            self._hours.setdefault(dev, []).append(_hour(hour[1], hour[0]))

    def prune(self, now: float) -> None:
        # Abgelaufene laufende Blöcke und Stunden abschliessen, auch von
        # Geräten ohne neue Messung; sonst blieben sie "laufend".
        start = now - (now % BLOCK_SECONDS)
        for dev in [d for d, o in self._open.items() if o[0] != start]:
            self._close(dev)
        hour_start = now - (now % HOUR_SECONDS)
        for dev in [d for d, h in self._open_hour.items() if h[0] != hour_start]:
            self._close_hour(dev)
        for store, keep in ((self._blocks, KEEP_BLOCKS), (self._hours, KEEP_HOURS)):
            limit = now - keep
            for dev in list(store):
                kept = [b for b in store[dev] if b[0] >= limit]
                if kept:
                    store[dev] = kept
                else:
                    store.pop(dev)
        for dev in [d for d in self._kind if d not in self._blocks and d not in self._hours and d not in self._open and d not in self._open_hour]:
            self._kind.pop(dev)

    def forget(self, dev: str) -> None:
        for store in (self._kind, self._blocks, self._hours, self._open, self._open_hour):
            store.pop(dev, None)

    # -- Abfragen --------------------------------------------------------------

    def kind(self, dev: str) -> str | None:
        return self._kind.get(dev)

    def history(self, dev: str, range_key: str, now: float | None = None) -> tuple[list[list[float]], int]:
        """Blöcke im Zeitraum (24 Std.: 5 Minuten, sonst Stunden) und ihre Länge in Sekunden."""
        now = now if now is not None else time.time()
        span = RANGES.get(range_key, RANGES["24h"])
        limit = now - span
        current = self._open.get(dev)
        open_block = _block(current[1], current[0]) if current and current[1] else None
        if span <= RANGES["24h"]:
            out = [b for b in self._blocks.get(dev, []) if b[0] >= limit]
            if open_block is not None and open_block[0] >= limit:
                out.append(open_block)
            return out, BLOCK_SECONDS
        out = [b for b in self._hours.get(dev, []) if b[0] >= limit]
        hour = self._open_hour.get(dev)
        blocks = list(hour[1]) if hour else []
        hour_start = hour[0] if hour else None
        if open_block is not None:
            start = open_block[0] - (open_block[0] % HOUR_SECONDS)
            if hour_start is not None and hour_start != start and blocks:
                out.append(_hour(blocks, hour_start))
                blocks = []
            hour_start = start
            blocks.append(open_block)
        if blocks and hour_start is not None and hour_start >= limit:
            out.append(_hour(blocks, hour_start))
        return out, HOUR_SECONDS

    def first(self, dev: str) -> float | None:
        """Beginn der Aufzeichnung für das Gerät (ältester Block)."""
        starts = [rows[0][0] for rows in (self._hours.get(dev), self._blocks.get(dev)) if rows]
        if (hour := self._open_hour.get(dev)) and hour[1]:
            starts.append(hour[1][0][0])
        if (current := self._open.get(dev)) and current[1]:
            starts.append(current[0])
        return min(starts) if starts else None


async def async_signal_history(
    hass: HomeAssistant, log: SignalLog | None, device: dr.DeviceEntry, range_key: str, now: float | None = None
) -> dict[str, Any]:
    """Punkte, Quelle und Art des Empfangs für das Fenster "Empfang"."""
    now = now if now is not None else time.time()
    span = RANGES.get(range_key, RANGES["24h"])
    start = now - span
    entries = er.async_entries_for_device(er.async_get(hass), device.id)
    domains = {e.domain for eid in device_entry_ids(device) if (e := hass.config_entries.async_get_entry(eid))}
    signal, _via, source = signal_source(hass, device, entries, domains)
    result: dict[str, Any] = {
        "kind": signal["kind"] if signal else None,
        "current": signal.get("value") if signal else None,
        "source": "none",
        "entity_id": None,
        "start": start,
        "end": now,
        "bucket": None,
        "points": [],
        "first": None,
        # "not_recorded": Sensor, den der Recorder nicht aufzeichnet.
        "reason": None,
        "steady_since": None,
    }
    # Ohne aktuellen Wert (ausgefallen): Sensor nach der Registry, sonst die
    # eigene Aufzeichnung, falls es eine gibt.
    logged = source in LOGGED
    if source is None:
        if sensor := signal_sensor(hass, entries):
            source, result["kind"] = sensor
        elif log is not None and log.kind(device.id):
            logged = True
    if source is not None and not logged and not recorded(hass, source):
        # Der Recorder kennt den Sensor nicht: Verlauf aus der eigenen Aufzeichnung.
        logged = True
        result["reason"] = "not_recorded"
        result["entity_id"] = source
    if logged:
        if log is None:
            return result
        kind = log.kind(device.id)
        if kind and result["kind"] not in (None, kind):
            return result
        blocks, bucket = log.history(device.id, range_key, now)
        result["kind"] = result["kind"] or kind
        result["bucket"] = bucket
        result["first"] = log.first(device.id)
        if blocks:
            result["source"] = "log"
            # Mitte des Blocks: der Wert gilt für den ganzen Block.
            result["points"] = [[b[0] + bucket / 2, b[1], b[2], b[3]] for b in blocks]
        return result
    if source is None:
        return result
    entity_id = source
    result["entity_id"] = entity_id
    parse = parser(result["kind"] or "dbm")
    from homeassistant.components.recorder import get_instance  # noqa: PLC0415

    instance = get_instance(hass)
    start_dt, end_dt = dt_util.utc_from_timestamp(start), dt_util.utc_from_timestamp(now)
    points: list[tuple[float, float]] | None = None
    kind_source = "history"
    try:
        if span >= STATS_FROM_DAYS * 86400:
            points = await instance.async_add_executor_job(_statistics, hass, entity_id, start_dt, end_dt)
            if points is not None:
                kind_source = "statistics"
        if points is None:
            points = await instance.async_add_executor_job(_history, hass, entity_id, start_dt, end_dt, parse)
    except Exception as err:  # noqa: BLE001
        # Im Log sichtbar: sonst ist ein leerer Verlauf nicht zu klären.
        _LOGGER.warning("Empfangsverlauf für %s nicht lesbar: %s", entity_id, err)
        points = []
    points = sorted((t, v) for t, v in points if start <= t <= now and _plausible(result["kind"] or "dbm", v))
    # Bis jetzt: der aktuelle Wert gilt seit seiner letzten Änderung, auch
    # wenn der Recorder dafür keine Zeile mehr hat.
    points, result["steady_since"] = held(points, hass.states.get(entity_id), parse, start, now)
    if points:
        result["source"] = kind_source
        result["first"] = points[0][0]
        result["points"] = [[round(t, 1), round(v, 1)] for t, v in thin(points, start, now)]
    return result
