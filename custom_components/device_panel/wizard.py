"""
Einrichtungsassistent (seit 2.135.0): die Daten für die Schritte und die Testmeldung.

Der Zustand (CONF_WIZARD_STATE) liegt in den Optionen und gilt für alle Administratoren; das Panel liest ihn aus der Liste und schreibt ihn mit
set_options. Hier stehen nur die zwei Befehle, die der Assistent zusätzlich braucht:

- wizard_data: alle Geräte, die überhaupt in Frage kommen, mit Integration, Typ und Bereich, ohne dass Ausschlüsse abgezogen sind. Der Assistent
  rechnet damit die Zahlen jedes Schritts selbst nach seinem Entwurf (eine abgewählte Integration lässt sich so auch wieder anwählen).
- wizard_test: eine Testmeldung an ein Push-Ziel, damit man sieht, ob es ankommt.
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar

from . import push
from .const import CONF_SHOW_DISABLED, CONF_SHOW_SERVICE, CONF_TYPE_INTEGRATIONS, DOMAIN
from .devices import _primary_entry, async_integration_info, candidate_devices, effective_type, hub_ids
from .options_api import _NOTIFY_RE, effective


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/wizard_data"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_wizard_data(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Alle Kandidaten mit Integration, Typ und Bereich; dazu die Integrationen mit Anzeigenamen (ohne Ausschlüsse)."""
    opts = effective(hass)
    hubs = hub_ids(hass)
    areas = ar.async_get(hass)
    devices: list[dict[str, Any]] = []
    counts: dict[str, int] = {}
    for device, entries in candidate_devices(hass, service=opts[CONF_SHOW_SERVICE], disabled=opts[CONF_SHOW_DISABLED]):
        primary = _primary_entry(hass, device)
        domain = primary.domain if primary else ""
        area = areas.async_get_area(device.area_id) if device.area_id else None
        devices.append(
            {
                "id": device.id,
                "name": device.name_by_user or device.name or device.id,
                "domain": domain,
                "type": effective_type(hass, device, entries, hubs, opts[CONF_TYPE_INTEGRATIONS])[0],
                "area": area.name if area else "",
            }
        )
        counts[domain] = counts.get(domain, 0) + 1
    info = await async_integration_info(hass, {d for d in counts if d})
    integrations = [{"domain": d, "name": info.get(d, {}).get("name", d), "devices": n} for d, n in counts.items() if d]
    integrations.sort(key=lambda x: (-x["devices"], str(x["name"]).lower()))
    devices.sort(key=lambda d: str(d["name"]).lower())
    connection.send_result(msg["id"], {"integrations": integrations, "devices": devices})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/wizard_test", vol.Required("target"): str})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_wizard_test(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Testmeldung an das gewählte Ziel (nur notify.*); sie geht nie durch die Ruhezeit und gehört zu keinem Gerät."""
    target = str(msg["target"]).strip()
    if not _NOTIFY_RE.match(target):
        connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, "invalid target")
        return
    outcome: dict[str, Any] = {}
    sent = await push.async_push(hass, target, push.text(hass, "wizard_test_title"), push.text(hass, "wizard_test_text"), outcome=outcome, log_topic="wizard")
    connection.send_result(msg["id"], {"sent": bool(sent) and not outcome.get("err")})


COMMANDS = (ws_wizard_data, ws_wizard_test)
