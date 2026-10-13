"""WebSocket-Befehle der Timer (seit 2.21.0): Liste, Speichern, Löschen, Ein-/Ausschalten, Ausführen, Vorschau, Test."""

from __future__ import annotations

import time
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.util import dt as dt_util

from . import options_api, timers
from .const import DATA_TIMERS, DOMAIN


def _manager(hass: HomeAssistant) -> timers.TimerManager | None:
    return hass.data.get(DATA_TIMERS)


def _error(connection: websocket_api.ActiveConnection, msg: dict[str, Any], err: vol.Invalid) -> None:
    connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, str(err.msg if hasattr(err, "msg") else err))


def _limits() -> dict[str, Any]:
    return {
        "per_device": timers.MAX_PER_DEVICE,
        "name": timers.NAME_MAX,
        "back_min": timers.BACK_MIN,
        "back_max": timers.BACK_MAX,
        "delay_min": timers.DELAY_MIN,
        "delay_max": timers.DELAY_MAX,
    }


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/timer_devices"})
@websocket_api.require_admin
@callback
def ws_timer_devices(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Geräte, für die sich ein Timer anlegen lässt (erster Schritt von "Timer hinzufügen" im Fenster aller Timer)."""
    connection.send_result(msg["id"], {"devices": timers.switchable_devices(hass)})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/timer_get", vol.Required("device_id"): str})
@websocket_api.require_admin
@callback
def ws_timer_get(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Timer eines Geräts mit den schaltbaren Entitäten, den Empfängern und dem Standard-Ziel."""
    manager = _manager(hass)
    if manager is None or dr.async_get(hass).async_get(msg["device_id"]) is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "device not found")
        return
    rows = manager.timers(msg["device_id"])
    connection.send_result(
        msg["id"],
        {
            "timers": [timers.timer_payload(hass, manager, t) for t in rows],
            "entities": timers.switchable_entities(hass, msg["device_id"]),
            "targets": timers.targets(hass, [t["target"] for t in rows if t.get("target")]),
            "default_target": options_api.notify_target(options_api.effective(hass), "timers"),
            "limits": _limits(),
            "now": time.time(),
            "today": dt_util.now().strftime("%Y-%m-%d"),
        },
    )


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/timer_list"})
@websocket_api.require_admin
@callback
def ws_timer_list(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Alle Timer aller Geräte (Abschnitt "Timer" in den Einstellungen), mit Gerät und Entität."""
    manager = _manager(hass)
    if manager is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "integration not set up")
        return
    devices = dr.async_get(hass)
    out = []
    for timer in manager.timers():
        if devices.async_get(timer["device_id"]) is None:
            continue
        out.append(timers.timer_payload(hass, manager, timer))
    connection.send_result(msg["id"], {"timers": out, "now": time.time(), "today": dt_util.now().strftime("%Y-%m-%d")})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/timer_save", vol.Required("timer"): dict})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_timer_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Timer anlegen oder ändern (mit id)."""
    manager = _manager(hass)
    if manager is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "integration not set up")
        return
    try:
        timer = await manager.async_save_timer(msg["timer"])
    except vol.Invalid as err:
        _error(connection, msg, err)
        return
    connection.send_result(msg["id"], {"timer": timers.timer_payload(hass, manager, timer)})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/timer_delete", vol.Required("timer_id"): str})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_timer_delete(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    manager = _manager(hass)
    if manager is None or not await manager.async_delete_timer(msg["timer_id"]):
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "timer not found")
        return
    connection.send_result(msg["id"], {"deleted": msg["timer_id"]})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/timer_enable", vol.Required("timer_id"): str, vol.Required("enabled"): bool}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_timer_enable(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Ein- oder ausschalten; ein erledigter einmaliger Timer startet damit neu ("Erneut starten")."""
    manager = _manager(hass)
    if manager is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "integration not set up")
        return
    try:
        timer = await manager.async_set_enabled(msg["timer_id"], msg["enabled"])
    except vol.Invalid as err:
        _error(connection, msg, err)
        return
    if timer is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "timer not found")
        return
    connection.send_result(msg["id"], {"timer": timers.timer_payload(hass, manager, timer)})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/timer_run", vol.Required("timer_id"): str})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_timer_run(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Jetzt ausführen: schaltet sofort, der Zeitplan bleibt."""
    manager = _manager(hass)
    result = await manager.async_run_now(msg["timer_id"]) if manager is not None else None
    if result is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "timer not found")
        return
    ok, reason = result
    timer = manager.get(msg["timer_id"])  # type: ignore[union-attr]
    connection.send_result(msg["id"], {"ok": ok, "reason": reason, "timer": timers.timer_payload(hass, manager, timer)})  # type: ignore[arg-type]


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/timer_preview", vol.Required("timer"): dict})
@websocket_api.require_admin
@callback
def ws_timer_preview(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Vorschau eines Entwurfs: Meldungstext, nächste Ausführungen, Ziel."""
    manager = _manager(hass)
    if manager is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "integration not set up")
        return
    try:
        result = manager.preview_raw(msg["timer"])
    except vol.Invalid as err:
        _error(connection, msg, err)
        return
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/timer_test", vol.Required("timer"): dict})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_timer_test(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Test: die echte Meldung an den gewählten Empfänger, ohne zu schalten."""
    manager = _manager(hass)
    if manager is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "integration not set up")
        return
    try:
        sent = await manager.async_test(msg["timer"])
    except vol.Invalid as err:
        _error(connection, msg, err)
        return
    connection.send_result(msg["id"], {"sent": sent})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/timer_try", vol.Required("entity_id"): str, vol.Required("action"): str})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_timer_try(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Jetzt ausführen aus dem Assistenten: die gewählte Entität und Aktion sofort schalten, ohne Rückschaltung."""
    manager = _manager(hass)
    if manager is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "integration not set up")
        return
    try:
        ok, reason = await manager.async_try(msg["entity_id"], msg["action"])
    except vol.Invalid as err:
        _error(connection, msg, err)
        return
    connection.send_result(msg["id"], {"ok": ok, "reason": reason})


COMMANDS = (ws_timer_try, ws_timer_devices, ws_timer_get, ws_timer_list, ws_timer_save, ws_timer_delete, ws_timer_enable, ws_timer_run, ws_timer_preview, ws_timer_test)
