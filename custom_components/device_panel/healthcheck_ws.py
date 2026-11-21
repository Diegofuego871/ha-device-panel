"""
WebSocket-Befehle der HealthCheck-Dienste (seit 2.236.0): nur für Administratoren (die URL der Dienste ist ein Geheimnis). Die Liste kommt auf Abruf,
nie in den Daten, die jeder Benutzer bekommt; das Protokoll eines Dienstes ebenso.
"""

from __future__ import annotations

import secrets
from typing import Any

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant
import voluptuous as vol

from .const import (
    DATA_HEALTHCHECK,
    DOMAIN,
    HEALTHCHECK_CASES,
    HEALTHCHECK_INTERVAL_RANGE,
    HEALTHCHECK_NAME_MAX,
    HEALTHCHECK_SUFFIX_MAX,
    HEALTHCHECK_URL_MAX,
    HEALTHLOG_RANGES,
    MAX_HEALTHCHECKS,
)
from .healthcheck import HealthCheck, valid_cases, valid_name, valid_url

_ID = vol.All(str, vol.Length(min=1, max=16))
_CASE = vol.Schema({vol.Required("kind"): vol.In(HEALTHCHECK_CASES), vol.Required("suffix"): vol.All(str, vol.Length(max=HEALTHCHECK_SUFFIX_MAX))})


def _loaded(hass: HomeAssistant) -> HealthCheck | None:
    healthcheck = hass.data.get(DATA_HEALTHCHECK)
    return healthcheck if healthcheck is not None and healthcheck.started else None


def _info(healthcheck: HealthCheck) -> dict[str, Any]:
    return {"items": healthcheck.listing(), "max": MAX_HEALTHCHECKS, "cases": list(HEALTHCHECK_CASES)}


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/healthcheck_list"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_healthcheck_list(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    if (healthcheck := _loaded(hass)) is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "health check not running")
        return
    connection.send_result(msg["id"], _info(healthcheck))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/healthcheck_save",
        vol.Optional("check_id"): _ID,
        vol.Required("name"): vol.All(str, vol.Length(max=HEALTHCHECK_NAME_MAX * 2)),
        vol.Required("url"): vol.All(str, vol.Length(max=HEALTHCHECK_URL_MAX)),
        vol.Required("interval"): vol.All(int, vol.Range(min=HEALTHCHECK_INTERVAL_RANGE[0], max=HEALTHCHECK_INTERVAL_RANGE[1])),
        vol.Optional("cases", default=[]): vol.All([_CASE], vol.Length(max=len(HEALTHCHECK_CASES))),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_healthcheck_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """
    Dienst anlegen (ohne `check_id`) oder ändern: Name (Pflicht), URL (http oder https), Abstand in Sekunden und die Zeilen der Fälle (Art und Zusatz,
    "/…", "?…" oder "&…"; die Reihenfolge ist der Vorrang). Höchstens MAX_HEALTHCHECKS. Danach geht von diesem Dienst sofort ein Lebenszeichen hinaus.
    """
    if (healthcheck := _loaded(hass)) is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "health check not running")
        return
    if valid_name(msg["name"]) is None:
        connection.send_error(msg["id"], "invalid_name", "A name is required")
        return
    url = valid_url(msg["url"])
    if url is None:
        connection.send_error(msg["id"], "invalid_url", "The address must start with http:// or https://")
        return
    cases = valid_cases(url, msg["cases"])
    # Ein ungültiger Zusatz fällt in valid_cases still weg: das Panel soll es melden, nicht der Server verschweigen
    if len(cases) != len(msg["cases"]):
        connection.send_error(msg["id"], "invalid_suffix", "Each suffix must start with /, ? or & and each case may appear once")
        return
    items = [dict(i) for i in healthcheck.items()]
    entry = {"name": valid_name(msg["name"]), "url": url, "interval": msg["interval"], "cases": cases}
    if "check_id" in msg:
        index = next((n for n, i in enumerate(items) if i["id"] == msg["check_id"]), None)
        if index is None:
            connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "no such health check")
            return
        items[index] = {"id": msg["check_id"], **entry}
        hid = msg["check_id"]
    else:
        if len(items) >= MAX_HEALTHCHECKS:
            connection.send_error(msg["id"], "too_many", f"At most {MAX_HEALTHCHECKS} health checks")
            return
        hid = secrets.token_hex(6)
        items.append({"id": hid, **entry})
    await healthcheck.async_set_items(items)
    connection.send_result(msg["id"], {"id": hid, **_info(healthcheck)})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/healthcheck_delete", vol.Required("check_id"): _ID})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_healthcheck_delete(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    if (healthcheck := _loaded(hass)) is None or healthcheck.item(msg["check_id"]) is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "no such health check")
        return
    await healthcheck.async_set_items([i for i in healthcheck.items() if i["id"] != msg["check_id"]])
    connection.send_result(msg["id"], _info(healthcheck))


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/healthcheck_ping", vol.Required("check_id"): _ID, vol.Required("kind"): vol.In(("ok", *HEALTHCHECK_CASES))}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_healthcheck_ping(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Testknöpfe "OK senden" und je Fall: genau das sofort an den Dienst, wartet auf die Antwort (höchstens HEALTHCHECK_TIMEOUT). Einen Fall ohne Zeile gibt es nicht."""
    if (healthcheck := _loaded(hass)) is None or (task := healthcheck.async_ping(msg["check_id"], test=msg["kind"])) is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "no such health check")
        return
    status = await task
    connection.send_result(msg["id"], {"status": status, **_info(healthcheck)})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/healthcheck_history", vol.Required("check_id"): _ID, vol.Required("hours"): vol.In(HEALTHLOG_RANGES)})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_healthcheck_history(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Protokoll eines Dienstes im gewählten Zeitraum (Kennzahlen, Grafik, Ereignisse, einzelne Aufrufe); nur auf Anfrage, nie in den Daten für alle."""
    if (healthcheck := _loaded(hass)) is None or (item := healthcheck.item(msg["check_id"])) is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "no such health check")
        return
    connection.send_result(msg["id"], healthcheck.log.history(item["id"], msg["hours"], int(item["interval"])))


COMMANDS = (ws_healthcheck_list, ws_healthcheck_save, ws_healthcheck_delete, ws_healthcheck_ping, ws_healthcheck_history)
