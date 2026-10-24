"""WebSocket-Befehl für das Protokoll (seit 2.104.0): Einträge, Zahlen und Diagramm einer Meldung, einer Routine oder eines Geräts."""

from __future__ import annotations

import time
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DATA_MAGIC, DATA_PROTOCOL, DATA_ROUTINES, DOMAIN

PAGE_MAX = 500


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/protocol_get",
        vol.Required("kind"): vol.In(["magic", "routine"]),
        vol.Exclusive("item_id", "scope"): str,
        vol.Exclusive("device_id", "scope"): str,
        vol.Optional("since"): vol.Coerce(float),
        vol.Optional("until"): vol.Coerce(float),
        vol.Optional("filter"): vol.Any(None, str),
        vol.Optional("q", default=""): vol.All(str, vol.Length(max=100)),
        vol.Optional("limit", default=100): vol.All(int, vol.Range(min=1, max=PAGE_MAX)),
        vol.Optional("offset", default=0): vol.All(int, vol.Range(min=0)),
    }
)
@websocket_api.require_admin
@callback
def ws_protocol_get(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Protokoll einer Meldung oder Routine ("item_id") oder aller eines Geräts ("device_id"); neueste zuerst."""
    store = hass.data.get(DATA_PROTOCOL)
    manager = hass.data.get(DATA_MAGIC if msg["kind"] == "magic" else DATA_ROUTINES)
    if store is None or manager is None or ("item_id" not in msg and "device_id" not in msg):
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "protocol not available")
        return
    if "item_id" in msg:
        row = manager.get(msg["item_id"])
        rows = [row] if row is not None else []
        if not rows:
            connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "item not found")
            return
    else:
        rows = manager.rules(msg["device_id"]) if msg["kind"] == "magic" else manager.routines(msg["device_id"])
    now = time.time()
    until = min(float(msg.get("until", now)), now + 86400)
    since = float(msg["since"]) if "since" in msg else None
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
        {**result, "items": [{"id": row["id"], "name": row["name"], "entity_id": row.get("entity_id")} for row in rows], "until": until, "now": now, "max_entries": limits[1], "max_mb": limits[0] // (1024 * 1024)},
    )


COMMANDS = (ws_protocol_get,)
