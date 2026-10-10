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
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.storage import Store

from . import options_api, update_check, updates
from .availability import RANGES, AvailabilityLog
from .availability import STORAGE_KEY as AVAILABILITY_STORE_KEY
from .battery import STORE_KEY as BATTERY_STORE_KEY
from .battery import BatteryWatch
from .newdevice import STORE_KEY as NEW_STORE_KEY
from .charge import STORE_KEY as CHARGE_STORE_KEY, ChargeNotifier
from .updates import STORE_KEY as UPDATES_STORE_KEY, UpdateNotifier
from .newdevice import NewDeviceNotifier
from .battery_history import RANGES as BATTERY_RANGES
from .battery_history import async_battery_history, battery_entity
from .outage import STORE_KEY as NOTIFY_STORE_KEY
from .outage import OutageNotifier
from .signal_history import RANGES as SIGNAL_RANGES
from .signal_history import STORAGE_KEY as SIGNAL_STORE_KEY
from .signal_history import SignalLog, async_signal_history
from .ai_assessment import AiError, async_assess, async_preview
from .ai_prompt import DEFAULT_PROMPT
from .const import (
    AI_PROMPT_MAX,
    BATTERY_OFF,
    SIGNAL_DBM_RANGE,
    SIGNAL_LQI_RANGE,
    SIGNAL_OFF,
    CONNECTION_MANUAL,
    CONF_BATTERY_LOW,
    CONF_NOTIFY_SERVICE,
    INT_RANGES,
    DATA_AVAILABILITY,
    DATA_BATTERY,
    DATA_NEW,
    DATA_CHARGE,
    DATA_UPDATES,
    DATA_CONNECTION_OVERRIDES,
    DATA_DEVICE_SETTINGS,
    DATA_OUTAGE,
    DATA_PANEL_REGISTERED,
    DATA_PUSH_IMAGE,
    DATA_SIGNAL,
    DATA_TYPE_OVERRIDES,
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
    PUSH_DIR,
    PUSH_IMAGE_FILE,
    PUSH_IMAGE_URL,
    PUSH_STATIC_URL_PATH,
    STORAGE_VERSION,
)
from .devices import (
    DEVICES_STORE_KEY,
    async_catalog,
    async_device_detail,
    async_device_overrides,
    async_list_devices,
    async_load_type_overrides,
    async_mark_start,
    async_reset_device_settings,
    async_set_connection_override,
    async_set_device_hidden,
    async_set_device_settings,
    async_set_type_override,
    device_battery_threshold,
    valid_offline_setting,
    valid_signal_setting,
)

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    async_mark_start(hass)
    await _async_register_push_path(hass)
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
    if DATA_NEW not in hass.data:
        new_devices = NewDeviceNotifier(hass)
        await new_devices.async_start()
        hass.data[DATA_NEW] = new_devices
    if DATA_CHARGE not in hass.data:
        charge_notifier = ChargeNotifier(hass)
        await charge_notifier.async_start()
        hass.data[DATA_CHARGE] = charge_notifier
    if DATA_UPDATES not in hass.data:
        update_notifier = UpdateNotifier(hass)
        await update_notifier.async_start()
        hass.data[DATA_UPDATES] = update_notifier
    if DATA_SIGNAL not in hass.data:
        signal_log = SignalLog(hass)
        await signal_log.async_start()
        hass.data[DATA_SIGNAL] = signal_log
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
    # Neue Geräte: ausgeschaltet verwirft Offenes.
    if (new_devices := hass.data.get(DATA_NEW)) is not None:
        await new_devices.async_options_changed()
    # Lademeldung: Geräte neu bestimmen.
    if (charge_notifier := hass.data.get(DATA_CHARGE)) is not None:
        await charge_notifier.async_rebuild()
    # Update-Erinnerung: Zeitpunkt oder Ausschalten.
    if (update_notifier := hass.data.get(DATA_UPDATES)) is not None:
        await update_notifier.async_options_changed()
    # Ausfälle: Verzögerung, Integrationen, anhaltende Benachrichtigung.
    if (notifier := hass.data.get(DATA_OUTAGE)) is not None:
        await notifier.async_options_changed()


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    if hass.data.pop(DATA_PANEL_REGISTERED, None):
        frontend.async_remove_panel(hass, PANEL_URL_PATH)
    if (notifier := hass.data.pop(DATA_OUTAGE, None)) is not None:
        await notifier.async_stop()
    if (log := hass.data.pop(DATA_AVAILABILITY, None)) is not None:
        await log.async_stop()
    if (new_devices := hass.data.pop(DATA_NEW, None)) is not None:
        await new_devices.async_stop()
    if (update_notifier := hass.data.pop(DATA_UPDATES, None)) is not None:
        await update_notifier.async_stop()
    if (charge_notifier := hass.data.pop(DATA_CHARGE, None)) is not None:
        await charge_notifier.async_stop()
    if (watch := hass.data.pop(DATA_BATTERY, None)) is not None:
        await watch.async_stop()
    if (signal_log := hass.data.pop(DATA_SIGNAL, None)) is not None:
        await signal_log.async_stop()
    update_check.async_stop_daily(hass)
    return True


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """
    Integration entfernt: ihre eigenen Dateien löschen (Entscheid des Nutzers,
    2026-10-02), damit nichts zurückbleibt. Verfügbarkeitsprotokoll,
    Einstellungen pro Gerät (Typ, Verbindungsart, Batterie, Meldungen),
    gemeldete Ausfälle und Batterien, Empfangsverlauf, gemeinsame
    Panel-Einstellungen. HA ruft
    das erst nach dem Entladen auf; dort wurde alles Ausstehende geschrieben.
    """
    for key in (AVAILABILITY_STORE_KEY, DEVICES_STORE_KEY, NOTIFY_STORE_KEY, BATTERY_STORE_KEY, NEW_STORE_KEY, UPDATES_STORE_KEY, CHARGE_STORE_KEY, SIGNAL_STORE_KEY, update_check.PANEL_STORE_KEY):
        await Store(hass, STORAGE_VERSION, key).async_remove()
    # Geladene Stände vergessen: ein neues Einrichten ohne Neustart beginnt leer.
    for key in (DATA_TYPE_OVERRIDES, DATA_DEVICE_SETTINGS, DATA_CONNECTION_OVERRIDES, update_check.PANEL_DATA_KEY):
        hass.data.pop(key, None)


# ---------------------------------------------------------------------------
# Mitgeliefertes Bild für Push-Meldungen
# ---------------------------------------------------------------------------


async def _async_register_push_path(hass: HomeAssistant) -> None:
    """
    Macht den Ordner push/ unter PUSH_STATIC_URL_PATH abrufbar.

    Statische Pfade werden ohne Authentifizierung ausgeliefert, genau wie
    /local/. Nur so kann die Companion-App das Bild einer Push-Meldung laden.
    Läuft einmal pro Home-Assistant-Instanz; der Merker bleibt beim Entladen
    stehen, weil HA statische Pfade nicht wieder abmelden kann.
    """
    if DATA_PUSH_IMAGE in hass.data:
        return

    push_path = Path(__file__).parent / PUSH_DIR
    if not await hass.async_add_executor_job((push_path / PUSH_IMAGE_FILE).is_file):
        hass.data[DATA_PUSH_IMAGE] = None
        _LOGGER.debug("%s fehlt, Push-Meldungen kommen ohne Bild", PUSH_IMAGE_FILE)
        return

    try:
        await hass.http.async_register_static_paths(
            [StaticPathConfig(PUSH_STATIC_URL_PATH, str(push_path), True)]
        )
    except Exception as err:  # noqa: BLE001 - das Bild ist nur Kosmetik
        hass.data[DATA_PUSH_IMAGE] = None
        _LOGGER.warning(
            "Statischer Pfad %s konnte nicht registriert werden (%s), "
            "Push-Meldungen kommen ohne Bild",
            PUSH_STATIC_URL_PATH,
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
        vol.Required("type"): f"{DOMAIN}/battery_history",
        vol.Required("device_id"): str,
        vol.Optional("range", default="24h"): vol.In(list(BATTERY_RANGES)),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_battery_history(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Batterie-Verlauf für das Fenster "Batterie" (seit 0.22.0)."""
    device = dr.async_get(hass).async_get(msg["device_id"])
    if device is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "device not found")
        return
    entity_id = battery_entity(hass, er.async_entries_for_device(er.async_get(hass), device.id))
    if entity_id is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "no battery level")
        return
    threshold = device_battery_threshold(hass, options_api.effective(hass), device)
    connection.send_result(msg["id"], await async_battery_history(hass, entity_id, msg["range"], threshold))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/signal_history",
        vol.Required("device_id"): str,
        vol.Optional("range", default="24h"): vol.In(list(SIGNAL_RANGES)),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_signal_history(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Empfangsverlauf für das Fenster "Empfang" (seit 0.24.0)."""
    device = dr.async_get(hass).async_get(msg["device_id"])
    if device is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "device not found")
        return
    connection.send_result(msg["id"], await async_signal_history(hass, hass.data.get(DATA_SIGNAL), device, msg["range"]))


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
    mit der Zahl ihrer Geräte, die Bereiche der Zahlen und die Geräte mit
    eigener Einstellung (zum Zurücksetzen).
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
            "catalog": {**await async_catalog(hass), "updates": updates.catalog(hass)},
            "limits": options_api.limits(),
            "notify_targets": options_api.notify_targets(hass, options_api.current_values(entry)[CONF_NOTIFY_SERVICE]),
            "overrides": await async_device_overrides(hass),
            # Standard-Prompt für den Profi-Modus (Anzeigen, Kopieren, Zurücksetzen).
            "ai_prompt_default": DEFAULT_PROMPT,
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
        vol.Required("type"): f"{DOMAIN}/set_device_connection",
        vol.Required("device_id"): str,
        # None: wieder erkennen lassen.
        vol.Required("connection"): vol.Any(None, vol.In(CONNECTION_MANUAL)),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_set_device_connection(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Verbindungsart eines Geräts von Hand setzen (wenn die Erkennung danebenliegt)."""
    if dr.async_get(hass).async_get(msg["device_id"]) is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "device not found")
        return
    await async_set_connection_override(hass, msg["device_id"], msg["connection"])
    connection.send_result(msg["id"], {"connection": msg["connection"]})


def _offline_setting(value: Any) -> Any:
    """"Ausgefallen nach" des Geräts: "off" oder Minuten (True zählt nicht als Zahl)."""
    if not valid_offline_setting(value):
        raise vol.Invalid("off oder ganze Minuten von 1 bis 1440 erwartet")
    return value


def _signal_setting(value: Any) -> Any:
    """Empfang-Warnung: "off" oder ganze Zahl (kein bool) im Bereich für dBm oder LQI."""
    if not valid_signal_setting(value):
        raise vol.Invalid(
            f"signal: {SIGNAL_OFF!r} oder {SIGNAL_DBM_RANGE[0]}..{SIGNAL_DBM_RANGE[1]} dBm"
            f" bzw. {SIGNAL_LQI_RANGE[0]}..{SIGNAL_LQI_RANGE[1]} LQI"
        )
    return value


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/set_device_settings",
        vol.Required("device_id"): str,
        # None = globaler Wert, "off" = Warnung aus, Zahl = eigene Schwelle.
        vol.Optional("battery"): vol.Any(None, BATTERY_OFF, vol.All(int, vol.Range(*INT_RANGES[CONF_BATTERY_LOW]))),
        # False = Ausfall- und Online-Meldungen für dieses Gerät aus.
        vol.Optional("notify"): bool,
        # Empfang-Warnung: None = Standard, "off" = aus, Zahl = schwach unter
        # (dBm negativ, LQI positiv).
        vol.Optional("signal"): vol.Any(None, _signal_setting),
        # "Ausgefallen nach": None = Integration bzw. global, "off" = nicht
        # überwachen, Zahl = Minuten.
        vol.Optional("offline"): vol.Any(None, _offline_setting),
        # Lademeldung (seit 1.30.0): None = Integration, True/False = am Gerät.
        vol.Optional("charge"): vol.Any(None, bool),
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
    changes = {k: msg[k] for k in ("battery", "notify", "signal", "offline", "charge") if k in msg}
    await async_set_device_settings(hass, msg["device_id"], **changes)
    # Batterie-Warnung sofort nachführen (Push, anhaltende Benachrichtigung).
    if "battery" in changes and (watch := hass.data.get(DATA_BATTERY)) is not None:
        await watch.async_check()
    if "charge" in changes and (charge := hass.data.get(DATA_CHARGE)) is not None:
        await charge.async_rebuild()
    connection.send_result(msg["id"], changes)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/ai_assess",
        vol.Required("device_id"): str,
        # Sprache der Antwort: die des Panels.
        vol.Optional("language", default="en"): vol.In(("de", "en")),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_ai_assess(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """KI-Einschätzung eines Geräts (Popup), nur mit eingeschalteter Option und nur auf Knopfdruck."""
    try:
        result = await async_assess(hass, msg["device_id"], msg["language"], hass.data.get(DATA_AVAILABILITY))
    except AiError as err:
        connection.send_error(msg["id"], err.code, str(err))
        return
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/ai_prompt_preview",
        vol.Required("device_id"): str,
        vol.Optional("language", default="en"): vol.In(("de", "en")),
        # Entwurf aus dem Fenster "Prompt bearbeiten"; leer = gespeicherter Prompt.
        vol.Optional("prompt", default=""): vol.All(str, vol.Length(max=AI_PROMPT_MAX)),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_ai_prompt_preview(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Vorschau des Prompts mit den Fakten eines Geräts (Profi-Modus); schickt nichts an die KI."""
    try:
        result = await async_preview(hass, msg["device_id"], msg["language"], msg["prompt"], hass.data.get(DATA_AVAILABILITY))
    except AiError as err:
        connection.send_error(msg["id"], err.code, str(err))
        return
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/hide_device",
        vol.Required("device_id"): str,
        vol.Required("hidden"): bool,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_hide_device(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """
    Gerät aus- oder einblenden (Popup, "Rückgängig"); gilt für alle Benutzer
    und beendet die Überwachung. Einblenden geht auch für gelöschte Geräte.
    """
    if msg["hidden"] and dr.async_get(hass).async_get(msg["device_id"]) is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "device not found")
        return
    changed = await async_set_device_hidden(hass, msg["device_id"], msg["hidden"])
    connection.send_result(msg["id"], {"hidden": msg["hidden"], "changed": changed})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/rename_device",
        vol.Required("device_id"): str,
        # Leer = zurück auf den Namen der Integration.
        vol.Required("name"): vol.All(str, vol.Length(max=255)),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_rename_device(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """
    Gerät in Home Assistant umbenennen (Popup, nur auf Knopfdruck): setzt
    name_by_user im Geräte-Register, also wie die Geräteseite von HA. Der Name der
    Integration bleibt erhalten, ein leerer Name stellt ihn wieder her. Entitäts-IDs
    ändern sich nicht.
    """
    registry = dr.async_get(hass)
    if registry.async_get(msg["device_id"]) is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "device not found")
        return
    name = msg["name"].strip() or None
    device = registry.async_update_device(msg["device_id"], name_by_user=name)
    connection.send_result(
        msg["id"],
        {"name": (device.name_by_user or device.name) if device else name, "name_custom": device.name_by_user if device else name},
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/reset_device_settings",
        # Geräte, deren Batterie-Warnung bzw. Meldungen auf den globalen Wert
        # zurückgehen (Einstellungen, beim Speichern).
        vol.Optional("battery", default=[]): [str],
        vol.Optional("notify", default=[]): [str],
        # Verbindungsart von Hand: zurück auf Integration bzw. Erkennung.
        vol.Optional("connection", default=[]): [str],
        # Empfang-Warnung: zurück auf den Standard.
        vol.Optional("signal", default=[]): [str],
        # "Ausgefallen nach" des Geräts: zurück auf Integration bzw. global.
        vol.Optional("offline", default=[]): [str],
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_reset_device_settings(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Einstellungen pro Gerät zurücksetzen, gibt die Zahl der Geräte zurück."""
    done = await async_reset_device_settings(hass, msg["battery"], msg["notify"], msg["connection"], msg["signal"], msg["offline"])
    # Batterie-Warnung sofort nachführen (Push, anhaltende Benachrichtigung).
    if done["battery"] and (watch := hass.data.get(DATA_BATTERY)) is not None:
        await watch.async_check()
    connection.send_result(msg["id"], done)


@callback
def _async_register_websocket_commands(hass: HomeAssistant) -> None:
    if hass.data.get(DATA_WS_REGISTERED):
        return
    hass.data[DATA_WS_REGISTERED] = True
    websocket_api.async_register_command(hass, _ws_list_devices)
    websocket_api.async_register_command(hass, _ws_ai_assess)
    websocket_api.async_register_command(hass, _ws_ai_prompt_preview)
    websocket_api.async_register_command(hass, _ws_device)
    websocket_api.async_register_command(hass, _ws_availability)
    websocket_api.async_register_command(hass, _ws_battery_history)
    websocket_api.async_register_command(hass, _ws_version)
    websocket_api.async_register_command(hass, _ws_set_panel)
    websocket_api.async_register_command(hass, _ws_get_options)
    websocket_api.async_register_command(hass, _ws_set_options)
    websocket_api.async_register_command(hass, _ws_set_device_type)
    websocket_api.async_register_command(hass, _ws_set_device_connection)
    websocket_api.async_register_command(hass, _ws_set_device_settings)
    websocket_api.async_register_command(hass, _ws_reset_device_settings)
    websocket_api.async_register_command(hass, _ws_hide_device)
    websocket_api.async_register_command(hass, _ws_rename_device)
    websocket_api.async_register_command(hass, _ws_signal_history)
