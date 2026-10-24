"""WebSocket-Befehl für das Protokoll (seit 2.104.0): Einträge, Zahlen und Diagramm einer Meldung, einer Routine oder eines Geräts."""

from __future__ import annotations

import time
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from . import devicelog
from .const import DATA_MAGIC, DATA_PROTOCOL, DATA_ROUTINES, DOMAIN

PAGE_MAX = 500


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/protocol_get",
        vol.Required("kind"): vol.In(["magic", "routine", "all", "system"]),
        vol.Exclusive("item_id", "scope"): str,
        vol.Exclusive("device_id", "scope"): str,
        # Seit 2.134.0: eine Auswahl innerhalb von Gerät oder allen Geräten (der Filter-Chip im Protokoll); "items" nennt weiter alle des Bereichs
        vol.Optional("item_ids"): vol.All([str], vol.Length(max=50)),
        vol.Optional("since"): vol.Coerce(float),
        vol.Optional("until"): vol.Coerce(float),
        vol.Optional("filter"): vol.Any(None, str),
        vol.Optional("cat"): vol.Any(None, str),
        vol.Optional("q", default=""): vol.All(str, vol.Length(max=100)),
        vol.Optional("limit", default=100): vol.All(int, vol.Range(min=1, max=PAGE_MAX)),
        vol.Optional("offset", default=0): vol.All(int, vol.Range(min=0)),
    }
)
@websocket_api.require_admin
@callback
def ws_protocol_get(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """
    Protokoll einer Meldung oder Routine ("item_id"), aller eines Geräts ("device_id") oder aller überhaupt (ohne beides); neueste zuerst.
    Mit kind "system" (seit 2.125.0) kommen die Einträge ohne Gerät und das Debug-Log (Reiter "System"). Mit kind "all" (seit 2.118.0, Geräteprotokoll) kommen alle Einträge des Geräts (oder aller Geräte) in einer Liste, siehe devicelog.py.
    """
    now = time.time()
    until = min(float(msg.get("until", now)), now + 86400)
    since = float(msg["since"]) if "since" in msg else None
    if msg["kind"] == "all":
        result = devicelog.query(hass, msg.get("device_id") or None, since=since, until=until, cat=msg.get("filter"), text=msg["q"], limit=msg["limit"], offset=msg["offset"])
        connection.send_result(msg["id"], {**result, "until": until, "now": now})
        return
    if msg["kind"] == "system":
        result = devicelog.system_query(hass, since=since, until=until, level=msg.get("filter"), cat=msg.get("cat"), text=msg["q"], limit=msg["limit"], offset=msg["offset"])
        connection.send_result(msg["id"], {**result, "until": until, "now": now})
        return
    store = hass.data.get(DATA_PROTOCOL)
    manager = hass.data.get(DATA_MAGIC if msg["kind"] == "magic" else DATA_ROUTINES)
    if store is None or manager is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "protocol not available")
        return
    if "item_id" in msg:
        row = manager.get(msg["item_id"])
        rows = [row] if row is not None else []
        if not rows:
            connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "item not found")
            return
        scope_rows = rows
    else:
        device = msg.get("device_id") or None
        scope_rows = manager.rules(device) if msg["kind"] == "magic" else manager.routines(device)
        rows = scope_rows
        if msg.get("item_ids"):
            wanted = set(msg["item_ids"])
            rows = [row for row in scope_rows if row["id"] in wanted]
            if not rows:
                connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "item not found")
                return
    limits = store.limits()
    result = store.query(
        msg["kind"],
        {row["id"]: row["name"] for row in rows},
        since=since,
        until=until,
        filter_=msg.get("filter"),
        text=msg["q"],
        limit=msg["limit"],
        offset=msg["offset"],
    )
    connection.send_result(
        msg["id"],
        {**result, "items": [{"id": row["id"], "name": row["name"], "entity_id": row.get("entity_id"), "device_id": row.get("device_id")} for row in scope_rows], "until": until, "now": now, "max_entries": limits[1], "max_mb": limits[0] // (1024 * 1024)},
    )


COMMANDS = (ws_protocol_get,)
