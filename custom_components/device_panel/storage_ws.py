"""
WebSocket-Befehl "storage_usage" (seit 2.117.0, Panel › Speicher): was die Integration selbst speichert und wie viel Platz es belegt.

Verfügbarkeit, Empfang, die Protokolle und das Panel-Log haben eine Grenze (Einstellungen); sie melden die Grösse ihres JSON (so misst auch die
Grenze). Alle übrigen Dateien der Integration in ".storage" (Zustände der Meldungen, Einstellungen, Ergebnisse der KI) haben keine Grenze und
wachsen kaum; sie zählen hier nach der Grösse der Datei, in drei Gruppen. Die Dateien auf der Platte sind etwas grösser als das JSON.
"""

from __future__ import annotations

import os
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant

from . import activity
from .const import DATA_AVAILABILITY, DATA_PROTOCOL, DATA_SIGNAL, DOMAIN

# Dateien, die schon oben gezählt werden (Grösse des JSON, mit Grenze)
COUNTED = ("availability", "signal", "debug")
# Gruppe je Datei (Schlüssel ohne "device_panel."); alles Unbekannte zählt zu "states"
GROUPS = {
    "ai": "ai",
    "routines": "config", "timers": "config", "magic": "config", "devices": "config", "panel": "config",
}


def other_sizes(directory: str) -> dict[str, int]:
    """Grösse der übrigen Dateien der Integration in Byte, je Gruppe (blockiert: im Executor aufrufen)."""
    out = {"states": 0, "ai": 0, "config": 0}
    prefix = f"{DOMAIN}."
    try:
        names = os.listdir(directory)
    except OSError:
        return out
    for name in names:
        if not name.startswith(prefix):
            continue
        key = name[len(prefix):]
        if key in COUNTED or key.startswith("protocol_"):
            continue
        try:
            size = os.path.getsize(os.path.join(directory, name))
        except OSError:
            continue
        out[GROUPS.get(key, "states")] += size
    return out


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/storage_usage"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_storage_usage(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Belegung aller Daten der Integration: Verläufe, Protokolle, Log und die übrigen Dateien."""
    availability = hass.data.get(DATA_AVAILABILITY)
    signal = hass.data.get(DATA_SIGNAL)
    protocol = hass.data.get(DATA_PROTOCOL)
    other = await hass.async_add_executor_job(other_sizes, hass.config.path(".storage"))
    empty = {"bytes": 0, "devices": 0, "days": 0}
    connection.send_result(
        msg["id"],
        {
            "availability": availability.usage() if availability is not None else empty,
            "signal": signal.usage() if signal is not None else empty,
            "protocol": protocol.usage() if protocol is not None else {"bytes": 0, "entries": 0, "items": 0, "max_item": 0},
            "log": activity.usage(hass),
            "other": other,
        },
    )


COMMANDS = (ws_storage_usage,)
