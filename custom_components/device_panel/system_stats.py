"""
System-Werte für die Status-App (seit 2.68.0): CPU, Arbeitsspeicher und Festplatte von Home Assistant als Kurve.

Die Werte kommen aus Sensoren, die es in Home Assistant schon gibt, und aus dem Recorder; das Panel zeichnet nichts selbst auf.
Gefunden werden sie automatisch: zuerst die Integration "System Monitor" (Prozessor, Arbeitsspeicher und Festplatte in Prozent,
Host-Werte), für CPU und Arbeitsspeicher sonst die Werte von Home Assistant Core der Supervisor-Integration (nur der Prozess, nicht
der Host: das Panel sagt es dazu). Wer andere Sensoren hat, wählt sie in der App (Optionen status_cpu_entity, status_ram_entity,
status_disk_entity; leer = automatisch).

Zeitraum: CPU und Arbeitsspeicher immer 24 Std., die Festplatte 24 Std., 30 Tage, 6 Monate oder 1 Jahr. Ab 30 Tagen kommt die
Langzeitstatistik des Recorders (Stundenmittel, ab 6 Monaten Tagesmittel), davor der Verlauf; ohne Statistik reicht der Verlauf nur so
weit wie die Aufbewahrung des Recorders.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

from .battery_history import _history, _statistics, _value, held, thin
from .const import CONF_STATUS_CPU_ENTITY, CONF_STATUS_DISK_ENTITY, CONF_STATUS_RAM_ENTITY, DOMAIN
from .options_api import effective

_LOGGER = logging.getLogger(__name__)

KINDS = ("cpu", "ram", "disk")
OPTION_OF = {"cpu": CONF_STATUS_CPU_ENTITY, "ram": CONF_STATUS_RAM_ENTITY, "disk": CONF_STATUS_DISK_ENTITY}
# Zeitraum der Festplatte in Tagen; CPU und Arbeitsspeicher sind immer 24h
RANGES = {"24h": 1, "30d": 30, "6m": 180, "1y": 365}
STATS_FROM_DAYS = 30
DAILY_FROM_DAYS = 180
# So viele Punkte zeichnet eine kleine Grafik sinnvoll
MAX_POINTS = 300
# Quellen in der Reihenfolge der Wahl: (Plattform, unique_id-Anfang, Bezug); der Bezug sagt dem Nutzer, was gemessen wird
AUTO_SOURCES: dict[str, tuple[tuple[str, str, str], ...]] = {
    "cpu": (("systemmonitor", "processor_use", "host"), ("hassio", "home_assistant_core_cpu_percent", "core")),
    "ram": (("systemmonitor", "memory_use_percent", "host"), ("hassio", "home_assistant_core_memory_percent", "core")),
    "disk": (("systemmonitor", "disk_use_percent", "host"),),
}
# Höchstens so viele Sensoren zur Auswahl in der App
CANDIDATES_MAX = 200


def auto_entity(hass: HomeAssistant, kind: str) -> tuple[str, str] | None:
    """Sensor, den das Panel für die Art von selbst wählt: (entity_id, "host" | "core"), sonst None."""
    entries = [e for e in er.async_get(hass).entities.values() if e.domain == "sensor" and not e.disabled_by and e.unique_id]
    for platform, prefix, scope in AUTO_SOURCES[kind]:
        found = [e for e in entries if e.platform == platform and str(e.unique_id).startswith(prefix)]
        if not found:
            continue
        # Mehrere Festplatten: die Hauptplatte ("/") hat genau diesen unique_id, die anderen hängen den Pfad an
        exact = [e for e in found if str(e.unique_id) == prefix]
        return (exact or sorted(found, key=lambda e: str(e.unique_id)))[0].entity_id, scope
    return None


def candidates(hass: HomeAssistant) -> list[dict[str, str]]:
    """Sensoren in Prozent ohne Geräteklasse (Batterie, Feuchte … haben eine): zur Auswahl in der App, nach Namen sortiert."""
    out = []
    for state in hass.states.async_all("sensor"):
        if state.attributes.get("unit_of_measurement") != "%" or state.attributes.get("device_class") or not state.attributes.get("state_class"):
            continue
        out.append({"entity_id": state.entity_id, "name": str(state.attributes.get("friendly_name") or state.entity_id)})
    out.sort(key=lambda c: c["name"].casefold())
    return out[:CANDIDATES_MAX]


async def _points(hass: HomeAssistant, entity_id: str, days: int, now: float) -> tuple[list[tuple[float, float]], str, str]:
    """Punkte der letzten days Tage: (Punkte, Quelle "statistics"|"history"|"none", Periode "5min"|"hour"|"day")."""
    start = now - days * 86400
    state = hass.states.get(entity_id)
    if "recorder" not in hass.config.components:
        points, _steady = held([], state, _value, start, now)
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
                source = "statistics"
            else:
                period = "hour"
        if points is None:
            points = await instance.async_add_executor_job(_history, hass, entity_id, start_dt, end_dt)
    except Exception as err:  # noqa: BLE001
        # Recorder nicht bereit oder Abfrage fehlgeschlagen: wie ohne Daten, aber im Log sichtbar
        _LOGGER.warning("Systemwert %s nicht lesbar: %s", entity_id, err)
        points = []
    points = sorted(p for p in points if start <= p[0] <= now)
    recorded = bool(points)
    # Bis jetzt: der aktuelle Stand gilt seit seiner letzten Änderung
    points, _steady = held(points, state, _value, start, now)
    return points, source if recorded else "none", period


async def async_metric(hass: HomeAssistant, kind: str, own: str, days: int, now: float) -> dict[str, Any]:
    """Eine Kurve: Sensor (eigener oder automatisch), aktueller Wert, Mittel und Spitze, Punkte."""
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
        "start": now - days * 86400,
        "end": now,
        "days": days,
        "current": None,
        "avg": None,
        "max": None,
        "source": "none",
        "points": [],
        # Die Auswahl der App zeigt "gewählt, aber es gibt ihn nicht mehr" (Sensor gelöscht)
        "missing": bool(entity_id) and state is None,
    }
    if not entity_id or state is None:
        return out
    points, source, _period = await _points(hass, entity_id, days, now)
    out["source"] = source
    out["current"] = _value(state.state)
    if points:
        values = [v for _t, v in points]
        out["avg"] = round(sum(values) / len(values), 1)
        out["max"] = round(max(values), 1)
        out["points"] = [[round(t, 1), round(v, 1)] for t, v in thin(points, out["start"], now, MAX_POINTS)]
    return out


async def async_system(hass: HomeAssistant, range_key: str, now: float | None = None) -> dict[str, Any]:
    """Alle drei Kurven plus die Sensoren zur Auswahl. range_key gilt nur für die Festplatte."""
    now = now if now is not None else time.time()
    opts = effective(hass)
    metrics = []
    for kind in KINDS:
        days = RANGES.get(range_key, 1) if kind == "disk" else 1
        metrics.append(await async_metric(hass, kind, str(opts.get(OPTION_OF[kind]) or ""), days, now))
    return {"range": range_key if range_key in RANGES else "24h", "metrics": metrics, "candidates": candidates(hass)}


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/status_system", vol.Optional("range", default="24h"): vol.In(tuple(RANGES))})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_status_system(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """CPU, Arbeitsspeicher und Festplatte für die Status-App (Administratoren)."""
    connection.send_result(msg["id"], await async_system(hass, msg["range"]))


COMMANDS = (ws_status_system,)
