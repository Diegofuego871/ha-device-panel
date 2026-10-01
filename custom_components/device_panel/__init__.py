"""Integration "Device Panel": Panel mit allen Geräten, Ausfällen und Softwarestand."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import voluptuous as vol
from homeassistant.components import frontend, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import STATE_UNAVAILABLE
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from .const import (
    BRAND_DIR,
    DATA_PANEL_REGISTERED,
    DATA_PUSH_IMAGE,
    DATA_WS_REGISTERED,
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

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    await _async_register_brand_path(hass)
    await _async_register_panel(hass)
    _async_register_websocket_commands(hass)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    if hass.data.pop(DATA_PANEL_REGISTERED, None):
        frontend.async_remove_panel(hass, PANEL_URL_PATH)
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


def _device_online(hass: HomeAssistant, entities: list[er.RegistryEntry]) -> bool | None:
    """
    Erster Entwurf (siehe docs/CONCEPT.md, noch zu entscheiden): online, wenn
    mindestens eine aktivierte Entität nicht "unavailable" ist. None, wenn das
    Gerät keine Entität mit Zustand hat.
    """
    states = [hass.states.get(e.entity_id) for e in entities if not e.disabled_by]
    states = [s for s in states if s is not None]
    if not states:
        return None
    return any(s.state != STATE_UNAVAILABLE for s in states)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/list_devices"})
@websocket_api.require_admin
@callback
def _ws_list_devices(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Alle Geräte mit Status, Bereich, Integration und Softwarestand."""
    dev_reg = dr.async_get(hass)
    ent_reg = er.async_get(hass)
    area_reg = ar.async_get(hass)
    devices: list[dict[str, Any]] = []
    for device in dev_reg.devices.values():
        if device.disabled_by:
            continue
        entities = er.async_entries_for_device(ent_reg, device.id)
        area = area_reg.async_get_area(device.area_id) if device.area_id else None
        domains = sorted(
            {e.domain for eid in device.config_entries if (e := hass.config_entries.async_get_entry(eid))}
        )
        devices.append(
            {
                "id": device.id,
                "name": device.name_by_user or device.name or device.id,
                "area": area.name if area else None,
                "manufacturer": device.manufacturer,
                "model": device.model,
                "sw_version": device.sw_version,
                "hw_version": device.hw_version,
                "integrations": domains,
                "service": device.entry_type == dr.DeviceEntryType.SERVICE,
                "entities": len(entities),
                "online": _device_online(hass, entities),
            }
        )
    connection.send_result(msg["id"], {"devices": devices})


@callback
def _async_register_websocket_commands(hass: HomeAssistant) -> None:
    if hass.data.get(DATA_WS_REGISTERED):
        return
    hass.data[DATA_WS_REGISTERED] = True
    websocket_api.async_register_command(hass, _ws_list_devices)
