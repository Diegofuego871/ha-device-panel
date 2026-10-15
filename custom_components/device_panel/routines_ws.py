"""WebSocket-Befehle die Routine (seit 2.21.0): Liste, Speichern, Löschen, Ein-/Ausschalten, Ausführen, Vorschau, Test."""

from __future__ import annotations

import time
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.util import dt as dt_util

from . import options_api, routines
from .const import DATA_ROUTINES, DOMAIN


def _manager(hass: HomeAssistant) -> routines.RoutineManager | None:
    return hass.data.get(DATA_ROUTINES)


def _error(connection: websocket_api.ActiveConnection, msg: dict[str, Any], err: vol.Invalid) -> None:
    connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, str(err.msg if hasattr(err, "msg") else err))


def _limits() -> dict[str, Any]:
    return {
        "per_device": routines.MAX_PER_DEVICE,
        "name": routines.NAME_MAX,
        "back_min": routines.BACK_MIN,
        "back_max": routines.BACK_MAX,
        "delay_min": routines.DELAY_MIN,
        "delay_max": routines.DELAY_MAX,
        "pause_min": routines.PAUSE_MIN,
        "pause_max": routines.PAUSE_MAX,
        "hold_max": routines.HOLD_MAX,
    }


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/routine_devices"})
@websocket_api.require_admin
@callback
def ws_routine_devices(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Geräte, für die sich eine Routine anlegen lässt (erster Schritt von "Routine hinzufügen" im Fenster aller Routinen)."""
    connection.send_result(msg["id"], {"devices": routines.switchable_devices(hass)})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/routine_get", vol.Required("device_id"): str})
@websocket_api.require_admin
@callback
def ws_routine_get(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Routinen eines Geräts mit den schaltbaren Entitäten, den Empfängern und dem Standard-Ziel."""
    manager = _manager(hass)
    if manager is None or (not routines.is_holder(msg["device_id"]) and dr.async_get(hass).async_get(msg["device_id"]) is None):
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "device not found")
        return
    rows = manager.routines(msg["device_id"])
    connection.send_result(
        msg["id"],
        {
            "routines": [routines.routine_payload(hass, manager, t) for t in rows],
            "entities": routines.switchable_entities(hass, msg["device_id"]),
            "targets": routines.targets(hass, [t["target"] for t in rows if t.get("target")]),
            "default_target": options_api.notify_target(options_api.effective(hass), "routines"),
            "limits": _limits(),
            "now": time.time(),
            "today": dt_util.now().strftime("%Y-%m-%d"),
        },
    )


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/routine_list"})
@websocket_api.require_admin
@callback
def ws_routine_list(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Alle Routinen aller Geräte (Abschnitt "Routinen" in den Einstellungen), mit Gerät und Entität."""
    manager = _manager(hass)
    if manager is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "integration not set up")
        return
    devices = dr.async_get(hass)
    out = []
    for routine in manager.routines():
        if not routines.is_holder(routine["device_id"]) and devices.async_get(routine["device_id"]) is None:
            continue
        out.append(routines.routine_payload(hass, manager, routine))
    connection.send_result(msg["id"], {"routines": out, "now": time.time(), "today": dt_util.now().strftime("%Y-%m-%d")})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/routine_save", vol.Required("routine"): dict})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_routine_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Routine anlegen oder ändern (mit id)."""
    manager = _manager(hass)
    if manager is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "integration not set up")
        return
    try:
        routine = await manager.async_save_routine(msg["routine"])
    except vol.Invalid as err:
        _error(connection, msg, err)
        return
    connection.send_result(msg["id"], {"routine": routines.routine_payload(hass, manager, routine)})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/routine_delete", vol.Required("routine_id"): str})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_routine_delete(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    manager = _manager(hass)
    if manager is None or not await manager.async_delete_routine(msg["routine_id"]):
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "routine not found")
        return
    connection.send_result(msg["id"], {"deleted": msg["routine_id"]})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/routine_enable", vol.Required("routine_id"): str, vol.Required("enabled"): bool}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_routine_enable(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Ein- oder ausschalten; eine erledigte einmalige Routine startet damit neu ("Erneut starten")."""
    manager = _manager(hass)
    if manager is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "integration not set up")
        return
    try:
        routine = await manager.async_set_enabled(msg["routine_id"], msg["enabled"])
    except vol.Invalid as err:
        _error(connection, msg, err)
        return
    if routine is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "routine not found")
        return
    connection.send_result(msg["id"], {"routine": routines.routine_payload(hass, manager, routine)})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/routine_run", vol.Required("routine_id"): str})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_routine_run(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Jetzt ausführen: schaltet sofort, der Zeitplan bleibt."""
    manager = _manager(hass)
    result = await manager.async_run_now(msg["routine_id"]) if manager is not None else None
    if result is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "routine not found")
        return
    ok, reason = result
    routine = manager.get(msg["routine_id"])  # type: ignore[union-attr]
    connection.send_result(msg["id"], {"ok": ok, "reason": reason, "routine": routines.routine_payload(hass, manager, routine)})  # type: ignore[arg-type]


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/routine_preview", vol.Required("routine"): dict})
@websocket_api.require_admin
@callback
def ws_routine_preview(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Vorschau eines Entwurfs: Meldungstext, nächste Ausführungen, Ziel."""
    manager = _manager(hass)
    if manager is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "integration not set up")
        return
    try:
        result = manager.preview_raw(msg["routine"])
    except vol.Invalid as err:
        _error(connection, msg, err)
        return
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/routine_test", vol.Required("routine"): dict})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_routine_test(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Test: die echte Meldung an den gewählten Empfänger, ohne zu schalten."""
    manager = _manager(hass)
    if manager is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "integration not set up")
        return
    try:
        sent = await manager.async_test(msg["routine"])
    except vol.Invalid as err:
        _error(connection, msg, err)
        return
    connection.send_result(msg["id"], {"sent": sent})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/routine_try", vol.Required("entity_id"): str, vol.Required("action"): str, vol.Optional("options"): vol.Any(None, dict)}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_routine_try(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Jetzt ausführen aus dem Assistenten: die gewählte Entität und Aktion (mit Schaltoptionen) sofort schalten, ohne Rückschaltung."""
    manager = _manager(hass)
    if manager is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "integration not set up")
        return
    try:
        ok, reason = await manager.async_try(msg["entity_id"], msg["action"], msg.get("options"))
    except vol.Invalid as err:
        _error(connection, msg, err)
        return
    connection.send_result(msg["id"], {"ok": ok, "reason": reason})


COMMANDS = (ws_routine_try, ws_routine_devices, ws_routine_get, ws_routine_list, ws_routine_save, ws_routine_delete, ws_routine_enable, ws_routine_run, ws_routine_preview, ws_routine_test)
