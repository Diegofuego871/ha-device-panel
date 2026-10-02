"""Integration "Device Panel": Panel mit allen Geräten, Ausfällen und Softwarestand."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import voluptuous as vol
from homeassistant.components import frontend, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr

from . import options_api, update_check
from .availability import RANGES, AvailabilityLog
from .battery import BatteryWatch
from .outage import OutageNotifier
from .const import (
    BATTERY_OFF,
    CONF_BATTERY_LOW,
    CONF_NOTIFY_SERVICE,
    INT_RANGES,
    BRAND_DIR,
    DATA_AVAILABILITY,
    DATA_BATTERY,
    DATA_OUTAGE,
    DATA_PANEL_REGISTERED,
    DATA_PUSH_IMAGE,
    DATA_WS_REGISTERED,
    DEVICE_TYPES,
    DOMAIN,
    PANEL_DIR,
    PANEL_HTML_FILE,
    PANEL_ICON,
    PANEL_PAGE_URL,
    PANEL_STATIC_URL_PATH,
    PANEL_TITLE,
    PANEL_URL_PATH,
    PUSH_IMAGE_FILE,
    PUSH_IMAGE_URL,
    STATIC_URL_PATH,
)
from .devices import (
    async_catalog,
    async_device_detail,
    async_list_devices,
    async_load_type_overrides,
    async_mark_start,
    async_set_device_settings,
    async_set_type_override,
)

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    async_mark_start(hass)
    await _async_register_brand_path(hass)
    await _async_register_panel(hass)
    _async_register_websocket_commands(hass)
    # Typ von Hand und Einstellungen pro Gerät vor dem Protokoll: beide
    # entscheiden mit, was überwacht und gemeldet wird.
    await async_load_type_overrides(hass)
    if DATA_AVAILABILITY not in hass.data:
        log = AvailabilityLog(hass)
        await log.async_start()
        hass.data[DATA_AVAILABILITY] = log
    if DATA_OUTAGE not in hass.data:
        notifier = OutageNotifier(hass, hass.data[DATA_AVAILABILITY])
        await notifier.async_start()
        hass.data[DATA_OUTAGE] = notifier
    if DATA_BATTERY not in hass.data:
        watch = BatteryWatch(hass)
        await watch.async_start()
        hass.data[DATA_BATTERY] = watch
    await update_check.async_load_panel_settings(hass)
    update_check.async_start_daily(hass)
    entry.async_on_unload(entry.add_update_listener(_async_options_updated))
    return True


async def _async_options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Optionen geändert (Panel oder Optionsdialog): kein Reload nötig."""
    # Tägliche Prüfung ein-/ausgeschaltet: Meldung sofort nachführen.
    await update_check.async_refresh_issue(hass)
    # Batterie: Schwelle oder Meldungsart geändert, sofort neu prüfen.
    if (watch := hass.data.get(DATA_BATTERY)) is not None:
        await watch.async_options_changed()


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    if hass.data.pop(DATA_PANEL_REGISTERED, None):
        frontend.async_remove_panel(hass, PANEL_URL_PATH)
    if (notifier := hass.data.pop(DATA_OUTAGE, None)) is not None:
        await notifier.async_stop()
    if (log := hass.data.pop(DATA_AVAILABILITY, None)) is not None:
        await log.async_stop()
    if (watch := hass.data.pop(DATA_BATTERY, None)) is not None:
        await watch.async_stop()
    update_check.async_stop_daily(hass)
    return True


# ---------------------------------------------------------------------------
# Mitgeliefertes Bild für Push-Meldungen
# ---------------------------------------------------------------------------


async def _async_register_brand_path(hass: HomeAssistant) -> None:
    """
    Macht den Ordner brand/ unter STATIC_URL_PATH abrufbar.

    Statische Pfade werden ohne Authentifizierung ausgeliefert, genau wie
    /local/. Nur so kann die Companion-App das Bild einer Push-Meldung laden.
    Läuft einmal pro Home-Assistant-Instanz; der Merker bleibt beim Entladen
    stehen, weil HA statische Pfade nicht wieder abmelden kann.
    """
    if DATA_PUSH_IMAGE in hass.data:
        return

    brand_path = Path(__file__).parent / BRAND_DIR
    if not await hass.async_add_executor_job((brand_path / PUSH_IMAGE_FILE).is_file):
        hass.data[DATA_PUSH_IMAGE] = None
        _LOGGER.debug("%s fehlt, Push-Meldungen kommen ohne Bild", PUSH_IMAGE_FILE)
        return

    try:
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL_PATH, str(brand_path), True)]
        )
    except Exception as err:  # noqa: BLE001 - das Bild ist nur Kosmetik
        hass.data[DATA_PUSH_IMAGE] = None
        _LOGGER.warning(
            "Statischer Pfad %s konnte nicht registriert werden (%s), "
            "Push-Meldungen kommen ohne Bild",
            STATIC_URL_PATH,
            err,
        )
        return

    hass.data[DATA_PUSH_IMAGE] = PUSH_IMAGE_URL


async def _async_register_panel(hass: HomeAssistant) -> None:
    """
    Eingebautes iframe-Panel statt Custom Panel: HA rendert Kopfzeile,
    Menü-Knopf und Safe-Area selbst, das iframe hat eine feste Höhe.
    """
    if hass.data.get(DATA_PANEL_REGISTERED):
        return
    panel_dir = Path(__file__).parent / PANEL_DIR
    if not await hass.async_add_executor_job((panel_dir / PANEL_HTML_FILE).is_file):
        _LOGGER.warning("%s fehlt, Panel wird nicht registriert", PANEL_HTML_FILE)
        return
    try:
        await hass.http.async_register_static_paths(
            [StaticPathConfig(PANEL_STATIC_URL_PATH, str(panel_dir), True)]
        )
    except RuntimeError:
        # Pfad nach einem Reload schon registriert.
        pass
    frontend.async_register_built_in_panel(
        hass,
        component_name="iframe",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        frontend_url_path=PANEL_URL_PATH,
        config={"url": PANEL_PAGE_URL},
        require_admin=True,
    )
    hass.data[DATA_PANEL_REGISTERED] = True


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/list_devices"})
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_list_devices(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Alle Geräte mit Status, Verbindung, Empfang, Batterie und Softwarestand."""
    connection.send_result(msg["id"], await async_list_devices(hass, hass.data.get(DATA_AVAILABILITY)))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/device", vol.Required("device_id"): str})
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_device(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Details für das Geräte-Popup."""
    detail = await async_device_detail(hass, msg["device_id"], hass.data.get(DATA_AVAILABILITY))
    if detail is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "device not found")
        return
    connection.send_result(msg["id"], detail)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/availability",
        vol.Required("device_id"): str,
        vol.Optional("range", default="24h"): vol.In(list(RANGES)),
    }
)
@websocket_api.require_admin
@callback
def _ws_availability(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Verlauf für das Statistik-Fenster."""
    log: AvailabilityLog | None = hass.data.get(DATA_AVAILABILITY)
    if log is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "availability log not running")
        return
    connection.send_result(msg["id"], log.history(msg["device_id"], msg["range"]))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/version",
        vol.Optional("force", default=False): bool,
        vol.Optional("prerelease", default=False): bool,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_version(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """
    Installierte und neueste veröffentlichte Version (GitHub). Mit
    prerelease auch die neueste Vorabversion, sofern sie neuer ist als das
    stabile Release und die installierte Version.
    """
    installed = await update_check.async_installed_version(hass)
    release = await update_check.async_latest_release(hass, force=msg["force"])
    # Meldung unter "Reparaturen" gleich mitziehen (z. B. nach dem Update weg).
    await update_check.async_refresh_issue(hass, release)
    result: dict[str, Any] = {
        "installed": installed,
        **release,
        "prerelease": None,
        "prerelease_url": None,
        "panel": update_check.panel_settings(hass),
    }
    if msg["prerelease"]:
        pre = await update_check.async_latest_prerelease(hass, force=msg["force"])
        candidate = pre.get("prerelease")
        if (
            candidate
            and update_check.compare_versions(candidate, release.get("latest")) > 0
            and update_check.compare_versions(candidate, installed) > 0
        ):
            result["prerelease"] = candidate
            result["prerelease_url"] = pre.get("prerelease_url")
        if pre.get("error") and not result.get("error"):
            result["error"] = pre["error"]
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/set_panel",
        vol.Optional("prerelease"): bool,
        vol.Optional("prerelease_hacs"): vol.Any(None, str),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_set_panel(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Gemeinsame Panel-Einstellungen der Instanz speichern (Vorabversionen)."""
    values = {k: msg[k] for k in ("prerelease", "prerelease_hacs") if k in msg}
    connection.send_result(msg["id"], await update_check.async_set_panel_settings(hass, values))


def _entry(hass: HomeAssistant) -> ConfigEntry | None:
    """Der einzige Eintrag (single_config_entry)."""
    return next(iter(hass.config_entries.async_entries(DOMAIN)), None)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/get_options"})
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_get_options(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """
    Einstellungen, dieselben Werte wie im Optionsdialog, dazu die
    Panel-Einstellungen, für die Ausschlüsse alle Integrationen und Typen
    mit der Zahl ihrer Geräte und die Bereiche der Zahlen.
    """
    entry = _entry(hass)
    if entry is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "integration not set up")
        return
    connection.send_result(
        msg["id"],
        {
            "values": options_api.current_values(entry),
            "panel": update_check.panel_settings(hass),
            "catalog": await async_catalog(hass),
            "limits": options_api.limits(),
            "notify_targets": options_api.notify_targets(hass, options_api.current_values(entry)[CONF_NOTIFY_SERVICE]),
        },
    )


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/set_options", vol.Required("values"): dict})
@websocket_api.require_admin
@callback
def _ws_set_options(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Speichert Einstellungen aus dem Panel in die Options des Eintrags."""
    entry = _entry(hass)
    if entry is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "integration not set up")
        return
    try:
        changed = options_api.apply_values(hass, entry, msg["values"])
    except vol.Invalid as err:
        connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, str(err))
        return
    connection.send_result(msg["id"], {"changed": changed})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/set_device_type",
        vol.Required("device_id"): str,
        vol.Required("device_type"): vol.Any(None, vol.In(DEVICE_TYPES)),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_set_device_type(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Typ eines Geräts von Hand setzen (None: wieder erkennen lassen)."""
    if dr.async_get(hass).async_get(msg["device_id"]) is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "device not found")
        return
    await async_set_type_override(hass, msg["device_id"], msg["device_type"])
    connection.send_result(msg["id"], {"device_type": msg["device_type"]})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/set_device_settings",
        vol.Required("device_id"): str,
        # None = globaler Wert, "off" = Warnung aus, Zahl = eigene Schwelle.
        vol.Optional("battery"): vol.Any(None, BATTERY_OFF, vol.All(int, vol.Range(*INT_RANGES[CONF_BATTERY_LOW]))),
        # False = Ausfall- und Online-Meldungen für dieses Gerät aus.
        vol.Optional("notify"): bool,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_set_device_settings(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Einstellungen eines Geräts (Popup), gelten sofort."""
    if dr.async_get(hass).async_get(msg["device_id"]) is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "device not found")
        return
    changes = {k: msg[k] for k in ("battery", "notify") if k in msg}
    await async_set_device_settings(hass, msg["device_id"], **changes)
    # Batterie-Warnung sofort nachführen (Push, anhaltende Benachrichtigung).
    if "battery" in changes and (watch := hass.data.get(DATA_BATTERY)) is not None:
        await watch.async_check()
    connection.send_result(msg["id"], changes)


@callback
def _async_register_websocket_commands(hass: HomeAssistant) -> None:
    if hass.data.get(DATA_WS_REGISTERED):
        return
    hass.data[DATA_WS_REGISTERED] = True
    websocket_api.async_register_command(hass, _ws_list_devices)
    websocket_api.async_register_command(hass, _ws_device)
    websocket_api.async_register_command(hass, _ws_availability)
    websocket_api.async_register_command(hass, _ws_version)
    websocket_api.async_register_command(hass, _ws_set_panel)
    websocket_api.async_register_command(hass, _ws_get_options)
    websocket_api.async_register_command(hass, _ws_set_options)
    websocket_api.async_register_command(hass, _ws_set_device_type)
    websocket_api.async_register_command(hass, _ws_set_device_settings)
