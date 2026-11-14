"""
Dienst "Überwachung pausieren" (seit 2.217.0): damit die Dashboard-Karten ein ausgefallenes Gerät pausieren können.

Die Karte läuft in der Oberfläche von Home Assistant und hat kein Recht auf die Befehle des Panels. Was sie darf, bestimmt darum dieser Dienst,
nicht die Karte: er ist ein Administrator-Dienst, die Prüfung macht Home Assistant selbst. Ein Nutzer ohne Administratorrechte wird abgewiesen,
auch wenn er die Oberfläche umgeht.
"""

from __future__ import annotations

import time
from typing import Any

import voluptuous as vol
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.service import async_register_admin_service
from homeassistant.util import dt as dt_util

from .const import DATA_SUMMARY, DOMAIN, PAUSE_DATE, PAUSE_ONLINE
from .monitor_pause import async_set_pause

SERVICE_PAUSE = "pause_monitoring"


def _until(value: Any) -> float:
    """Ende der Pause: Zeit in Sekunden oder Datum mit Zeit (ohne Zeitzone gilt die Ortszeit von Home Assistant)."""
    if isinstance(value, bool):
        raise vol.Invalid("Datum oder Zeit in Sekunden erwartet")
    if isinstance(value, (int, float)):
        seconds = float(value)
    else:
        parsed = dt_util.parse_datetime(str(value))
        if parsed is None:
            raise vol.Invalid("Datum oder Zeit in Sekunden erwartet")
        seconds = (parsed if parsed.tzinfo else parsed.replace(tzinfo=dt_util.get_default_time_zone())).timestamp()
    if not 0 < seconds < 4_102_444_800:  # bis 2100
        raise vol.Invalid("Zeit ausserhalb des erlaubten Bereichs")
    return seconds


SCHEMA_PAUSE = vol.Schema(
    {
        vol.Required("device_id"): vol.All(str, vol.Length(min=1, max=64)),
        vol.Optional("mode", default=PAUSE_ONLINE): vol.In((PAUSE_ONLINE, PAUSE_DATE)),
        vol.Optional("until"): _until,
    }
)


async def _async_pause(call: ServiceCall) -> None:
    hass = call.hass
    device_id = call.data["device_id"]
    if dr.async_get(hass).async_get(device_id) is None:
        raise ServiceValidationError(translation_domain=DOMAIN, translation_key="device_unknown")
    if call.data["mode"] == PAUSE_DATE:
        until = call.data.get("until")
        if until is None:
            raise ServiceValidationError(translation_domain=DOMAIN, translation_key="pause_until_missing")
        if until <= time.time():
            raise ServiceValidationError(translation_domain=DOMAIN, translation_key="pause_until_past")
        await async_set_pause(hass, device_id, {"mode": PAUSE_DATE, "until": until})
    else:
        await async_set_pause(hass, device_id, {"mode": PAUSE_ONLINE})
    # Die Karten lesen den Sensor: sofort nachrechnen, statt bis zu 30 Sekunden auf den nächsten Durchlauf zu warten
    if (coordinator := hass.data.get(DATA_SUMMARY)) is not None:
        await coordinator.async_refresh()


def async_register(hass: HomeAssistant) -> None:
    if hass.services.has_service(DOMAIN, SERVICE_PAUSE):
        return
    async_register_admin_service(hass, DOMAIN, SERVICE_PAUSE, _async_pause, SCHEMA_PAUSE)


def async_unregister(hass: HomeAssistant) -> None:
    hass.services.async_remove(DOMAIN, SERVICE_PAUSE)
