"""
System-Werte für die Status-App (seit 2.68.0): CPU, Arbeitsspeicher und Festplatte von Home Assistant als Kurve.

Die Werte kommen aus Sensoren, die es in Home Assistant schon gibt, und aus dem Recorder; das Panel zeichnet nichts selbst auf.
Gefunden werden sie automatisch (über den unique_id der Sensoren, nicht über den Namen: der ist übersetzt):

- CPU und Arbeitsspeicher: die Integration "System Monitor" (Prozent, der Host), sonst die Werte von Home Assistant Core der
  Supervisor-Integration (nur der Prozess, nicht der Host: das Panel sagt es dazu).
- Festplatte: "System Monitor" in Prozent; fehlt der Prozent-Sensor, aber "belegt" (und "frei") ist da, rechnet das Panel selbst
  (belegt / (belegt + frei)); sonst "belegt" und "gesamt" des Hosts aus der Supervisor-Integration; gibt es nur einen Sensor in
  Gigabyte ohne Gegenstück, zeigt die Karte die Gigabyte statt Prozent (seit 2.70.0).

Beide Integrationen legen viele dieser Sensoren ausgeschaltet an: Sind sie nur ausgeschaltet, sagt das Panel es und schaltet sie
auf Knopfdruck ein. Wer andere Sensoren hat, wählt sie in der App (Optionen status_cpu_entity, status_ram_entity,
status_disk_entity; leer = automatisch); bei der Festplatte darf es auch ein Sensor in Gigabyte sein.

Zeitraum: CPU und Arbeitsspeicher immer 24 Std., die Festplatte 24 Std., 30 Tage, 6 Monate oder 1 Jahr. Ab 30 Tagen kommt die
Langzeitstatistik des Recorders (Stundenmittel, ab 6 Monaten Tagesmittel), davor der Verlauf; ohne Statistik reicht der Verlauf nur so
weit wie die Aufbewahrung des Recorders.
"""

from __future__ import annotations

import logging
import math
import time
from collections.abc import Callable
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, State
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

from .battery_history import _history, _statistics, _value, held, thin
from .const import CONF_STATUS_CPU_ENTITY, CONF_STATUS_DISK_ENTITY, CONF_STATUS_RAM_ENTITY, DOMAIN
from .options_api import effective

_LOGGER = logging.getLogger(__name__)

KINDS = ("cpu", "ram", "disk")
OPTION_OF = {"cpu": CONF_STATUS_CPU_ENTITY, "ram": CONF_STATUS_RAM_ENTITY, "disk": CONF_STATUS_DISK_ENTITY}
# Zeitraum in Tagen; seit 2.128.0 wählt man ihn für jede der drei Kurven (vorher nur für die Festplatte, CPU und Arbeitsspeicher waren immer 24h)
RANGES = {"24h": 1, "30d": 30, "6m": 180, "1y": 365}
STATS_FROM_DAYS = 30
DAILY_FROM_DAYS = 180
# So viele Punkte zeichnet eine kleine Grafik sinnvoll
MAX_POINTS = 300
# Quellen in der Reihenfolge der Wahl: (Plattform, unique_id-Anfang, nicht mit diesem Anfang, Bezug); der Bezug sagt dem Nutzer, was gemessen wird
AUTO_SOURCES: dict[str, tuple[tuple[str, str, str, str], ...]] = {
    "cpu": (("systemmonitor", "processor_use", "", "host"), ("hassio", "home_assistant_core_cpu_percent", "", "core")),
    "ram": (("systemmonitor", "memory_use_percent", "", "host"), ("hassio", "home_assistant_core_memory_percent", "", "core")),
    "disk": (
        ("systemmonitor", "disk_use_percent", "", "host"),
        ("systemmonitor", "disk_use", "disk_use_percent", "host"),
        ("hassio", "home_assistant_host_disk_used", "", "supervisor"),
    ),
}
# Supervisor: gesamte Grösse des Hosts (der Prozentwert fehlt dort, er wird aus belegt und gesamt gerechnet)
_SUPERVISOR_USED = "home_assistant_host_disk_used"
_SUPERVISOR_TOTAL = "home_assistant_host_disk_total"
# Nur Sensoren dieser Plattformen schaltet das Panel auf Knopfdruck ein
_ENABLE_PLATFORMS = ("systemmonitor", "hassio")
# Höchstens so viele Sensoren zur Auswahl in der App (die App filtert nach Eingabe)
CANDIDATES_MAX = 2000
# Einheiten der Grössen-Sensoren (System Monitor meldet GiB), in Byte
_BYTES = {"B": 1, "kB": 1e3, "MB": 1e6, "GB": 1e9, "TB": 1e12, "KiB": 1024, "MiB": 1024**2, "GiB": 1024**3, "TiB": 1024**4}
# Sensoren der Festplatte von System Monitor: Prozent, belegt, frei (der Anhang am unique_id nennt die Platte: "" für "/")
_DISK_KEYS = ("disk_use_percent", "disk_use", "disk_free")


def _entries(hass: HomeAssistant, platform: str, prefix: str, exclude: str = "") -> list[er.RegistryEntry]:
    """Sensoren der Plattform, deren unique_id mit prefix beginnt (und nicht mit exclude)."""
    return [
        e
        for e in er.async_get(hass).entities.values()
        if e.domain == "sensor"
        and e.platform == platform
        and e.unique_id
        and str(e.unique_id).startswith(prefix)
        and not (exclude and str(e.unique_id).startswith(exclude))
    ]


def _main(entries: list[er.RegistryEntry], prefix: str) -> er.RegistryEntry:
    """Mehrere Festplatten: die Hauptplatte ("/") hat genau diesen unique_id, die anderen hängen den Pfad an."""
    return ([e for e in entries if str(e.unique_id) == prefix] or sorted(entries, key=lambda e: str(e.unique_id)))[0]


def auto_entity(hass: HomeAssistant, kind: str) -> tuple[str, str] | None:
    """
    Sensor, den das Panel für die Art von selbst wählt: (entity_id, "host" | "core" | "supervisor"), sonst None. Ausgeschaltete zählen
    nicht. Sensoren mit Zustand gehen vor: Ein eben eingeschalteter Sensor hat bis zum Neuladen der Integration (etwa 30 Sekunden)
    keinen Zustand, bis dahin bleibt die Karte bei dem Sensor, der Werte hat (seit 2.70.0).
    """
    waiting: tuple[str, str] | None = None
    for platform, prefix, exclude, scope in AUTO_SOURCES[kind]:
        found = [e for e in _entries(hass, platform, prefix, exclude) if not e.disabled_by]
        live = [e for e in found if hass.states.get(e.entity_id) is not None]
        if live:
            return _main(live, prefix).entity_id, scope
        if found and waiting is None:
            waiting = _main(found, prefix).entity_id, scope
    return waiting


def disk_group(hass: HomeAssistant, entity_id: str) -> dict[str, er.RegistryEntry | None] | None:
    """Prozent, belegt und frei derselben Platte, wenn der Sensor von System Monitor ist (sonst None); fehlende Sensoren sind None."""
    registry = er.async_get(hass)
    entry = registry.async_get(entity_id)
    if entry is None or entry.platform != "systemmonitor" or not entry.unique_id:
        return None
    uid = str(entry.unique_id)
    for key in _DISK_KEYS:  # "disk_use_percent" vor "disk_use": der längere Anfang gewinnt
        if uid.startswith(key):
            suffix = uid[len(key) :]
            break
    else:
        return None
    group: dict[str, er.RegistryEntry | None] = {}
    for k in _DISK_KEYS:
        other = registry.async_get_entity_id("sensor", "systemmonitor", k + suffix)
        group[k] = registry.async_get(other) if other else None
    return group


def disabled_sources(hass: HomeAssistant, kind: str, found: str | None = None) -> list[er.RegistryEntry]:
    """
    Ausgeschaltete Sensoren, die für die Art fehlen (seit 2.70.0). found = Sensor, den die Auswahl schon liefert: dann bei der
    Festplatte von System Monitor die ausgeschalteten Sensoren derselben Platte (Prozent, belegt, frei), sonst nichts. Ohne Fund alle
    Sensoren der ersten Quelle, bei der es welche gibt (System Monitor vor Supervisor).
    """
    registry = er.async_get(hass)
    if found:
        entry = registry.async_get(found)
        if kind == "disk" and entry is not None and entry.platform == "hassio" and str(entry.unique_id) == _SUPERVISOR_USED:
            total_id = registry.async_get_entity_id("sensor", "hassio", _SUPERVISOR_TOTAL)
            total = registry.async_get(total_id) if total_id else None
            return [total] if total is not None and total.disabled_by else []
        group = disk_group(hass, found) if kind == "disk" else None
        return [e for e in (group or {}).values() if e is not None and e.disabled_by]
    for platform, prefix, exclude, _scope in AUTO_SOURCES[kind]:
        entries = _entries(hass, platform, prefix, exclude)
        if not entries:
            continue
        main = _main(entries, prefix)
        group = [main]
        if kind == "disk" and platform == "systemmonitor":
            group = [e for e in (disk_group(hass, main.entity_id) or {}).values() if e is not None]
        elif kind == "disk" and platform == "hassio":
            total = registry.async_get_entity_id("sensor", "hassio", _SUPERVISOR_TOTAL)
            group += [registry.async_get(total)] if total else []
        return [e for e in group if e is not None and e.disabled_by]
    return []


def candidates(hass: HomeAssistant) -> list[dict[str, str]]:
    """
    Entitäten zur Auswahl in der App (Sensor-Entitäten, nicht Geräte), nach Namen sortiert: jeder Sensor mit Zahl und Einheit. "pref"
    kennzeichnet die naheliegenden (Prozent ohne Geräteklasse, Batterie und Feuchte haben eine, und Grössen in Byte); die App zeigt
    sie zuerst, den Rest findet die Suche.
    """
    out = []
    for state in hass.states.async_all("sensor"):
        unit = str(state.attributes.get("unit_of_measurement") or "")
        try:
            float(state.state)
        except (TypeError, ValueError):
            if state.state not in ("unavailable", "unknown") or not unit:
                continue
        if not unit:
            continue
        pref = (unit == "%" and not state.attributes.get("device_class")) or unit in _BYTES
        out.append({"entity_id": state.entity_id, "name": str(state.attributes.get("friendly_name") or state.entity_id), "unit": unit, "pref": pref})
    out.sort(key=lambda c: (not c["pref"], c["name"].casefold()))
    return out[:CANDIDATES_MAX]


def _size(state: State | None) -> tuple[float, str] | None:
    """Wert und Einheit eines Grössen-Sensors (bekannte Einheit, Zahl ab 0), sonst None."""
    if state is None:
        return None
    try:
        value = float(state.state)
    except (TypeError, ValueError):
        return None
    unit = str(state.attributes.get("unit_of_measurement") or "")
    return (value, unit) if unit in _BYTES and value >= 0 and math.isfinite(value) else None


def _size_dict(used: float, free: float, total: float, unit: str) -> dict[str, Any]:
    """Grösse fürs Panel, ab 1000 bzw. 1024 in TB bzw. TiB, auf eine Nachkommastelle."""
    values = {"used": used, "free": free, "total": total}
    big = {"GiB": ("TiB", 1024), "GB": ("TB", 1000)}.get(unit)
    if big and total >= big[1]:
        unit = big[0]
        values = {k: v / big[1] for k, v in values.items()}
    return {**{k: round(max(v, 0.0), 1) for k, v in values.items()}, "unit": unit}


def _total_of(hass: HomeAssistant, entity_id: str, used: tuple[float, str]) -> float | None:
    """
    Gesamtgrösse der Platte in der Einheit des "belegt"-Sensors, wenn sich daraus ein Prozentwert rechnen lässt: bei System Monitor
    belegt + frei (beide eingeschaltet und lesbar), beim Supervisor der Sensor "gesamt". Sonst None (dann zeigt die Karte Gigabyte).
    """
    registry = er.async_get(hass)
    entry = registry.async_get(entity_id)
    if entry is None:
        return None
    if entry.platform == "systemmonitor":
        free_entry = (disk_group(hass, entity_id) or {}).get("disk_free")
        if free_entry is None or free_entry.disabled_by:
            return None
        free = _size(hass.states.get(free_entry.entity_id))
        return None if free is None else used[0] + free[0] * _BYTES[free[1]] / _BYTES[used[1]]
    if entry.platform == "hassio" and str(entry.unique_id) == _SUPERVISOR_USED:
        total_id = registry.async_get_entity_id("sensor", "hassio", _SUPERVISOR_TOTAL)
        total_entry = registry.async_get(total_id) if total_id else None
        if total_entry is None or total_entry.disabled_by:
            return None
        total = _size(hass.states.get(total_entry.entity_id))
        return None if total is None or total[0] <= 0 else total[0] * _BYTES[total[1]] / _BYTES[used[1]]
    return None


def disk_size(hass: HomeAssistant, entity_id: str) -> dict[str, Any] | None:
    """
    Belegt, frei und gesamt der Festplatte (seit 2.69.0) aus den Sensoren "belegt" und "frei" von System Monitor derselben Platte
    (gesamt = belegt + frei); der übergebene Sensor darf der Prozent- oder einer der beiden anderen sein. Einheit wie beim Sensor
    (GiB), ab 1000 bzw. 1024 in TB bzw. TiB. Ohne beide, ausgeschaltet oder nicht lesbar: None (das Panel zeigt dann nur Prozent).
    """
    group = disk_group(hass, entity_id)
    if not group:
        return None
    sizes = {}
    for key in ("disk_use", "disk_free"):
        entry = group[key]
        if entry is None or entry.disabled_by:
            return None
        sizes[key] = _size(hass.states.get(entry.entity_id))
    used, free = sizes["disk_use"], sizes["disk_free"]
    if used is None or free is None:
        return None
    free_in_unit = free[0] * _BYTES[free[1]] / _BYTES[used[1]]
    return _size_dict(used[0], free_in_unit, used[0] + free_in_unit, used[1])


def _percent_of(scale: float) -> Callable[[str], float | None]:
    """Zustand (Gigabyte belegt) als Prozent der Platte lesen; ausserhalb von 0 bis 100 gilt der Wert als Messfehler."""

    def parse(text: str) -> float | None:
        try:
            value = float(text) * scale
        except (TypeError, ValueError):
            return None
        return value if 0 <= value <= 100.5 else None

    return parse


def _plain(text: str) -> float | None:
    """Zustand als Zahl ab 0 (Sensor in Gigabyte ohne Gegenstück: die Karte zeigt den Wert selbst)."""
    try:
        value = float(text)
    except (TypeError, ValueError):
        return None
    return value if value >= 0 and math.isfinite(value) else None


def _axis_max(top: float) -> float:
    """Obere Grenze der Achse, etwas über dem höchsten Wert (1, 2, 2.5, 5 oder 10 mal eine Zehnerpotenz)."""
    if top <= 0:
        return 1.0
    power = 10 ** math.floor(math.log10(top * 1.05))
    for step in (1, 2, 2.5, 5, 10):
        if top * 1.05 <= step * power:
            return float(step * power)
    return float(10 * power)


def _disabled_payload(entries: list[er.RegistryEntry]) -> list[dict[str, str]]:
    """Ausgeschaltete Sensoren für das Panel: Entität und Name (so wie ihn Home Assistant zeigt)."""
    return [{"entity_id": e.entity_id, "name": str(e.name or e.original_name or e.entity_id)} for e in entries]


def thin_peaks(points: list[tuple[float, float]], start: float, end: float, limit: int = MAX_POINTS) -> list[tuple[float, float]]:
    """
    Höchstens limit Punkte wie battery_history.thin, aber der höchste Wert je gleich langem Abschnitt statt des Mittels (zu seiner
    Zeit): ein Ausschlag von ein paar Minuten bleibt auf der Kurve sichtbar und passt zur "Spitze" darunter. Der letzte Punkt bleibt.
    """
    if len(points) <= limit:
        return points
    size = (end - start) / limit
    peaks: dict[int, tuple[float, float]] = {}
    for t, v in points[:-1]:
        i = min(limit - 1, int((t - start) // size))
        if i not in peaks or v > peaks[i][1]:
            peaks[i] = (t, v)
    out = [peaks[i] for i in sorted(peaks)]
    out.append(points[-1])
    return out


async def _points(
    hass: HomeAssistant, entity_id: str, days: int, now: float, parse: Callable[[str], float | None] = _value, scale: float = 1.0
) -> tuple[list[tuple[float, float]], str, str]:
    """
    Punkte der letzten days Tage: (Punkte, Quelle "statistics"|"history"|"none", Periode "hour"|"day"). parse liest einen Zustand
    (der Verlauf), scale rechnet die Werte der Statistik um (Gigabyte belegt in Prozent der Platte).
    """
    start = now - days * 86400
    state = hass.states.get(entity_id)
    if "recorder" not in hass.config.components:
        points, _steady = held([], state, parse, start, now)
        return points, "none", "hour"
    from homeassistant.components.recorder import get_instance  # noqa: PLC0415

    instance = get_instance(hass)
    start_dt, end_dt = dt_util.utc_from_timestamp(start), dt_util.utc_from_timestamp(now)
    points: list[tuple[float, float]] | None = None
    source, period = "history", "hour"
    try:
        if days >= STATS_FROM_DAYS:
            period = "day" if days >= DAILY_FROM_DAYS else "hour"
            points = await instance.async_add_executor_job(_statistics, hass, entity_id, start_dt, end_dt, period)
            if points is not None:
                points = [(t, v * scale) for t, v in points]
                source = "statistics"
            else:
                period = "hour"
        if points is None:
            points = await instance.async_add_executor_job(_history, hass, entity_id, start_dt, end_dt, parse)
    except Exception as err:  # noqa: BLE001
        # Recorder nicht bereit oder Abfrage fehlgeschlagen: wie ohne Daten, aber im Log sichtbar
        _LOGGER.warning("Systemwert %s nicht lesbar: %s", entity_id, err)
        points = []
    points = sorted(p for p in points if start <= p[0] <= now)
    recorded = bool(points)
    # Bis jetzt: der aktuelle Stand gilt seit seiner letzten Änderung
    points, _steady = held(points, state, parse, start, now)
    return points, source if recorded else "none", period


def current_percent(hass: HomeAssistant, kind: str) -> float | None:
    """
    Aktuelle Auslastung in Prozent für die Meldung bei hoher Auslastung (seit 2.71.0): derselbe Sensor wie die Karte (eigene Wahl oder
    automatisch), bei einem Sensor in Gigabyte in Prozent der Platte umgerechnet. None, wenn es keinen Wert in Prozent gibt (kein Sensor,
    nicht lesbar, oder nur Gigabyte ohne Gesamtgrösse): dann gibt es keine Meldung.
    """
    entity_id = str(effective(hass).get(OPTION_OF[kind]) or "") or (auto_entity(hass, kind) or ("", ""))[0]
    state = hass.states.get(entity_id) if entity_id else None
    if state is None:
        return None
    if str(state.attributes.get("unit_of_measurement") or "") == "%":
        return _value(state.state)
    used = _size(state)
    total = _total_of(hass, entity_id, used) if used is not None else None
    return _percent_of(100 / total)(state.state) if used is not None and total else None


async def _longer_history(
    hass: HomeAssistant, percent_entity: str, days: int, now: float, points: list[tuple[float, float]], source: str
) -> tuple[list[tuple[float, float]], str]:
    """Verlauf aus "belegt" in Prozent, wenn er weiter zurückreicht als der des Prozent-Sensors (mindestens eine Stunde früher)."""
    group = disk_group(hass, percent_entity) or {}
    use_entry = group.get("disk_use")
    if use_entry is None or use_entry.disabled_by:
        return points, source
    used = _size(hass.states.get(use_entry.entity_id))
    total = _total_of(hass, use_entry.entity_id, used) if used is not None else None
    if used is None or not total:
        return points, source
    other, other_source, _period = await _points(hass, use_entry.entity_id, days, now, _percent_of(100 / total), 100 / total)
    if other_source == "none" or not other:
        return points, source
    if source != "none" and points and points[0][0] <= other[0][0] + 3600:
        return points, source
    return other, other_source


async def async_metric(hass: HomeAssistant, kind: str, own: str, days: int, now: float) -> dict[str, Any]:
    """Eine Kurve: Sensor (eigener oder automatisch), aktueller Wert, Mittel und Spitze, Punkte. mode "percent" (0 bis 100) oder "absolute" (Einheit des Sensors)."""
    scope = "own"
    entity_id = own
    if not entity_id:
        auto = auto_entity(hass, kind)
        entity_id, scope = auto if auto else ("", "none")
    state = hass.states.get(entity_id) if entity_id else None
    out: dict[str, Any] = {
        "id": kind,
        "entity_id": entity_id or None,
        "name": str(state.attributes.get("friendly_name") or entity_id) if state is not None else (entity_id or ""),
        "scope": scope,
        "mode": "percent",
        "unit": "%",
        "axis_max": 100,
        "start": now - days * 86400,
        "end": now,
        "days": days,
        "current": None,
        "avg": None,
        "max": None,
        "source": "none",
        "size": None,
        # Ausgeschaltete Sensoren, die es gäbe (Einschalten auf Knopfdruck); leer, wenn nichts fehlt
        "disabled": [],
        "points": [],
        # Gewählt, aber es gibt ihn nicht mehr (Sensor gelöscht): "missing". Eben eingeschaltet, die Integration lädt noch neu: "pending".
        # In Home Assistant ausgeschaltet (eigene Wahl): "off".
        "missing": False,
        "pending": False,
        "off": False,
    }
    entry = er.async_get(hass).async_get(entity_id) if entity_id else None
    if entity_id and state is None:
        out["missing"] = entry is None
        out["off"] = entry is not None and bool(entry.disabled_by)
        out["pending"] = entry is not None and not entry.disabled_by
        if out["off"] and entry is not None and entry.platform in _ENABLE_PLATFORMS:
            out["disabled"] = _disabled_payload([entry])
    if not entity_id:
        # Nichts gefunden: gibt es die Sensoren ausgeschaltet?
        out["disabled"] = _disabled_payload(disabled_sources(hass, kind))
        return out
    if state is None:
        return out
    parse, scale = _value, 1.0
    unit = str(state.attributes.get("unit_of_measurement") or "")
    if unit != "%":
        used = _size(state)
        total = _total_of(hass, entity_id, used) if used is not None else None
        if used is not None and total:
            # Gigabyte belegt, Gesamtgrösse bekannt: Prozent rechnen und die Grösse dazu zeigen
            scale = 100 / total
            parse = _percent_of(scale)
            out["size"] = _size_dict(used[0], total - used[0], total, used[1])
        else:
            # Ein Sensor ohne Gegenstück (oder in anderer Einheit): die Karte zeigt seinen Wert, nicht Prozent
            parse = _plain
            out["mode"], out["unit"] = "absolute", unit
    elif kind == "disk":
        out["size"] = disk_size(hass, entity_id)
    if kind == "disk" and out["size"] is None and scope in ("host", "supervisor"):
        # Prozent oder belegt gefunden, aber "frei" bzw. "gesamt" (für Prozent und Grösse) ausgeschaltet?
        out["disabled"] = _disabled_payload(disabled_sources(hass, kind, entity_id))
    points, source, _period = await _points(hass, entity_id, days, now, parse, scale)
    if kind == "disk" and out["mode"] == "percent" and scope in ("host", "own"):
        # Ein eben eingeschalteter Prozent-Sensor hat erst ab jetzt Werte; "belegt" läuft schon länger. Ist die Gesamtgrösse bekannt, den
        # längeren Verlauf von "belegt" in Prozent umrechnen, damit er nicht verloren scheint (seit 2.70.0)
        points, source = await _longer_history(hass, entity_id, days, now, points, source)
    out["source"] = source
    out["current"] = parse(state.state)
    if points:
        values = [v for _t, v in points]
        out["avg"] = round(sum(values) / len(values), 1)
        out["max"] = round(max(values), 1)
        # CPU und Arbeitsspeicher: je Abschnitt der höchste Wert, sonst verschwindet ein kurzer Ausschlag im Mittel (2.74.0)
        shrink = thin_peaks if kind in ("cpu", "ram") else thin
        out["points"] = [[round(t, 1), round(v, 1)] for t, v in shrink(points, out["start"], now, MAX_POINTS)]
    if out["mode"] == "absolute":
        out["axis_max"] = _axis_max(max(out["max"] or 0.0, out["current"] or 0.0))
    if out["current"] is not None:
        out["current"] = round(out["current"], 1)
    return out


async def async_system(hass: HomeAssistant, range_key: str, now: float | None = None, ranges: dict[str, str] | None = None) -> dict[str, Any]:
    """
    Alle drei Kurven plus die Sensoren zur Auswahl. ranges wählt den Zeitraum je Kurve (cpu, ram, disk); ohne Angabe gilt range_key nur für die
    Festplatte (ältere Panels) und die beiden anderen sind 24 Stunden.
    """
    now = now if now is not None else time.time()
    opts = effective(hass)
    metrics = []
    chosen: dict[str, str] = {}
    for kind in KINDS:
        key = (ranges or {}).get(kind) or (range_key if kind == "disk" else "24h")
        chosen[kind] = key if key in RANGES else "24h"
        metrics.append(await async_metric(hass, kind, str(opts.get(OPTION_OF[kind]) or ""), RANGES[chosen[kind]], now))
    # Ob die Integrationen eingerichtet sind: ohne "System Monitor" sagt die App, wie man es hinzufügt (nicht zwingend, es gibt die Auswahl)
    integrations = {"systemmonitor": bool(hass.config_entries.async_entries("systemmonitor")), "hassio": "hassio" in hass.config.components}
    return {"range": chosen["disk"], "ranges": chosen, "metrics": metrics, "candidates": candidates(hass), "integrations": integrations}


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/status_system",
        vol.Optional("range", default="24h"): vol.In(tuple(RANGES)),
        vol.Optional("ranges"): {vol.In(KINDS): vol.In(tuple(RANGES))},
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_status_system(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """CPU, Arbeitsspeicher und Festplatte für die Status-App (Administratoren)."""
    connection.send_result(msg["id"], await async_system(hass, msg["range"], ranges=msg.get("ranges")))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/status_system_enable", vol.Required("kind"): vol.In(KINDS)})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_status_system_enable(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """
    Ausgeschaltete Sensoren für CPU, Arbeitsspeicher oder Festplatte einschalten (seit 2.70.0), nur auf Knopfdruck in der Status-App und
    nur Sensoren von System Monitor und Supervisor. Home Assistant lädt die Integration danach von selbst neu (nach etwa 30 Sekunden).
    """
    kind = msg["kind"]
    own = str(effective(hass).get(OPTION_OF[kind]) or "")
    found = own or (auto_entity(hass, kind) or ("", ""))[0]
    entries = [e for e in disabled_sources(hass, kind, found or None) if e.platform in _ENABLE_PLATFORMS]
    registry = er.async_get(hass)
    for entry in entries:
        registry.async_update_entity(entry.entity_id, disabled_by=None)
    if entries:
        _LOGGER.info("Status-App: Sensoren eingeschaltet: %s", ", ".join(e.entity_id for e in entries))
    connection.send_result(msg["id"], {"enabled": [e.entity_id for e in entries]})


COMMANDS = (ws_status_system, ws_status_system_enable)
