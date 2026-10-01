"""
Gerätedaten für das Panel: Status, Verbindungsart, Empfang, Batterie, Updates.

Alles stammt aus Home Assistant selbst (Registries, Zustände, Integrationen).
Was eine andere Integration nur intern kennt (ZHA: LQI/RSSI, Bluetooth: RSSI
und Proxy), wird vorsichtig gelesen: fehlt es oder ändert sich die interne
Schnittstelle, bleibt das Feld leer, statt dass die Liste scheitert.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from homeassistant.const import STATE_OFF, STATE_ON, STATE_UNAVAILABLE
from homeassistant.core import CoreState, HomeAssistant, State, callback
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.loader import async_get_integration
from homeassistant.util import dt as dt_util

from .const import BATTERY_LOW, DATA_STARTED_AT, OFFLINE_AFTER

_LOGGER = logging.getLogger(__name__)

# Verbindungsarten, wie sie das Panel kennt (Texte in panel/strings.js).
CONN_ZIGBEE = "zigbee"
CONN_ZWAVE = "zwave"
CONN_THREAD = "thread"
CONN_MATTER = "matter"  # Panel verfeinert per matter/node_diagnostics
CONN_BLE = "ble"
CONN_WIFI = "wifi"
CONN_NETWORK = "network"  # IP-Netzwerk, LAN oder WLAN unbekannt
CONN_CLOUD = "cloud"

# Integrationen, deren Geräte immer über dieselbe Funkart laufen.
_DOMAIN_CONN = {
    "zha": CONN_ZIGBEE,
    "zwave_js": CONN_ZWAVE,
    "zwave_me": CONN_ZWAVE,
    "matter": CONN_MATTER,
}
# Bridges: die Bridge selbst hängt am Netzwerk, die Geräte dahinter funken Zigbee.
_ZIGBEE_BRIDGE_DOMAINS = {"hue", "deconz"}


def _attr(state: State | None, key: str) -> Any:
    return state.attributes.get(key) if state else None


def _number(state: State | None) -> float | None:
    if state is None:
        return None
    try:
        return float(state.state)
    except (TypeError, ValueError):
        return None


def _device_class(entry: er.RegistryEntry, state: State | None) -> str | None:
    return entry.device_class or entry.original_device_class or _attr(state, "device_class")


def liveness_entities(entries: list[er.RegistryEntry]) -> tuple[list[er.RegistryEntry], bool]:
    """
    Entitäten, die zeigen, dass das Gerät lebt (Standard der Überwachung).

    Ein Verbindungssensor sagt es direkt und hat Vorrang. Sonst zählen
    aktivierte Entitäten ohne Kategorie; versteckte und Diagnose-Entitäten
    nur, wenn es nichts anderes gibt, damit Geräte mit wenigen Entitäten
    nicht als "keine Daten" enden.
    """
    enabled = [e for e in entries if not e.disabled_by]
    connectivity = [
        e for e in enabled
        if e.domain == "binary_sensor" and (e.device_class or e.original_device_class) == "connectivity"
    ]
    if connectivity:
        return connectivity, True
    for candidates in (
        [e for e in enabled if e.entity_category is None and not e.hidden_by],
        [e for e in enabled if e.entity_category is None],
        enabled,
    ):
        if candidates:
            return candidates, False
    return [], False


def device_status(
    hass: HomeAssistant, entries: list[er.RegistryEntry], now: datetime
) -> tuple[bool | None, datetime | None]:
    """
    (online, ausgefallen seit). None = keine Daten.

    Ausgefallen erst nach OFFLINE_AFTER: kurze Aussetzer und das Hochfahren
    der Integrationen nach einem Neustart zählen nicht.
    """
    relevant, is_connectivity = liveness_entities(entries)
    states = [s for e in relevant if (s := hass.states.get(e.entity_id)) is not None]
    if not states:
        return None, None
    # Verbindungssensor: "aus" heisst getrennt; "unknown" (z. B. kurz nach
    # dem Start) ist kein Ausfall.
    dead = (STATE_OFF, STATE_UNAVAILABLE) if is_connectivity else (STATE_UNAVAILABLE,)
    down = [s for s in states if s.state in dead]
    if len(down) < len(states):
        return True, None
    since = max(s.last_changed for s in down)
    if now - since < timedelta(seconds=OFFLINE_AFTER):
        return True, None
    return False, since


def _signal(hass: HomeAssistant, entries: list[er.RegistryEntry]) -> dict[str, Any] | None:
    """Empfang aus Entitäten: dBm (WLAN, Z-Wave …) oder LQI (Zigbee2MQTT)."""
    for entry in entries:
        if entry.disabled_by or entry.domain != "sensor":
            continue
        state = hass.states.get(entry.entity_id)
        value = _number(state)
        if value is None:
            continue
        unit = str(_attr(state, "unit_of_measurement") or "").lower()
        if _device_class(entry, state) == "signal_strength" and unit == "dbm":
            return {"kind": "dbm", "value": round(value)}
        if unit == "lqi" or entry.entity_id.endswith(("_lqi", "_linkquality")):
            return {"kind": "lqi", "value": round(value)}
    return None


def _zha_signal(hass: HomeAssistant, device_id: str) -> dict[str, Any] | None:
    """LQI/RSSI direkt aus ZHA; die Sensoren dafür sind meist deaktiviert."""
    if "zha" not in hass.config.components:
        return None
    try:
        from homeassistant.components.zha.helpers import async_get_zha_device_proxy  # noqa: PLC0415

        device = async_get_zha_device_proxy(hass, device_id).device
        lqi, rssi = getattr(device, "lqi", None), getattr(device, "rssi", None)
    except Exception:  # noqa: BLE001 - interne Schnittstelle von ZHA
        return None
    if lqi is None and rssi is None:
        return None
    return {"kind": "lqi", "value": lqi, "rssi": rssi} if lqi is not None else {"kind": "dbm", "value": rssi}


def _ble_signal(hass: HomeAssistant, address: str) -> tuple[dict[str, Any] | None, str | None]:
    """RSSI und Empfänger (Adapter oder Proxy) aus der Bluetooth-Integration."""
    if "bluetooth" not in hass.config.components:
        return None, None
    try:
        from homeassistant.components import bluetooth  # noqa: PLC0415

        info = bluetooth.async_last_service_info(hass, address, connectable=False)
        if info is None:
            return None, None
        scanner = bluetooth.async_scanner_by_source(hass, info.source)
        via = getattr(scanner, "name", None) or info.source
        return {"kind": "dbm", "value": info.rssi}, via
    except Exception:  # noqa: BLE001
        return None, None


def _battery(hass: HomeAssistant, entries: list[er.RegistryEntry]) -> dict[str, Any] | None:
    level: int | None = None
    low = False
    found = False
    for entry in entries:
        if entry.disabled_by:
            continue
        state = hass.states.get(entry.entity_id)
        if _device_class(entry, state) != "battery":
            continue
        if entry.domain == "sensor" and (value := _number(state)) is not None:
            level, found = round(value), True
        elif entry.domain == "binary_sensor" and state is not None and state.state != STATE_UNAVAILABLE:
            low, found = low or state.state == STATE_ON, True
    if not found:
        return None
    if level is not None:
        low = low or level <= BATTERY_LOW
    return {"level": level, "low": low}


def _update(hass: HomeAssistant, entries: list[er.RegistryEntry]) -> str | None:
    """Neue Software-Version, wenn eine Update-Entität des Geräts eine meldet."""
    for entry in entries:
        if entry.domain != "update" or entry.disabled_by:
            continue
        state = hass.states.get(entry.entity_id)
        if state is not None and state.state == STATE_ON:
            return _attr(state, "latest_version") or "?"
    return None


def _connection(
    device: dr.DeviceEntry,
    domains: list[str],
    entries: list[er.RegistryEntry],
    signal: dict[str, Any] | None,
    iot_classes: dict[str, str | None],
) -> str | None:
    """Verbindungsart, vom Sichersten zum Ungefähren."""
    for domain in domains:
        if domain in _DOMAIN_CONN:
            return _DOMAIN_CONN[domain]
        if domain in _ZIGBEE_BRIDGE_DOMAINS:
            return CONN_ZIGBEE if device.via_device_id else CONN_NETWORK
        if domain == "mqtt" and any("zigbee2mqtt" in str(i[1]) for i in device.identifiers):
            return CONN_ZIGBEE
        if domain == "homekit_controller" and any(e.translation_key == "thread_status" for e in entries):
            return CONN_THREAD
    kinds = {c[0] for c in device.connections}
    if dr.CONNECTION_ZIGBEE in kinds:
        return CONN_ZIGBEE
    if dr.CONNECTION_BLUETOOTH in kinds and dr.CONNECTION_NETWORK_MAC not in kinds:
        return CONN_BLE
    if signal and signal.get("kind") == "dbm":
        return CONN_WIFI
    if any(str(iot_classes.get(d) or "").startswith("cloud") for d in domains):
        return CONN_CLOUD
    if kinds & {dr.CONNECTION_NETWORK_MAC, dr.CONNECTION_UPNP}:
        return CONN_NETWORK
    if any(str(iot_classes.get(d) or "").startswith("local") for d in domains):
        return CONN_NETWORK
    return None


async def async_integration_info(hass: HomeAssistant, domains: set[str]) -> dict[str, dict[str, Any]]:
    """Anzeigename und iot_class je Integration (vom Loader zwischengespeichert)."""
    info: dict[str, dict[str, Any]] = {}
    for domain in domains:
        try:
            integration = await async_get_integration(hass, domain)
            info[domain] = {"name": integration.name, "iot_class": integration.iot_class}
        except Exception:  # noqa: BLE001 - z. B. entfernte Integration
            info[domain] = {"name": domain, "iot_class": None}
    return info


async def async_list_devices(hass: HomeAssistant) -> dict[str, Any]:
    """Alle Geräte für das Panel, dazu Integrationsnamen und Serverzeit."""
    dev_reg = dr.async_get(hass)
    ent_reg = er.async_get(hass)
    area_reg = ar.async_get(hass)
    now = dt_util.utcnow()
    started_at: datetime | None = hass.data.get(DATA_STARTED_AT)

    raw: list[tuple[dr.DeviceEntry, list[str]]] = []
    all_domains: set[str] = set()
    for device in dev_reg.devices.values():
        if device.disabled_by:
            continue
        domains = sorted(
            {e.domain for eid in device.config_entries if (e := hass.config_entries.async_get_entry(eid))}
        )
        all_domains.update(domains)
        raw.append((device, domains))
    integrations = await async_integration_info(hass, all_domains)
    iot_classes = {d: i["iot_class"] for d, i in integrations.items()}

    devices: list[dict[str, Any]] = []
    for device, domains in raw:
        entries = er.async_entries_for_device(ent_reg, device.id)
        area = area_reg.async_get_area(device.area_id) if device.area_id else None
        online, since = device_status(hass, entries, now)
        signal = _signal(hass, entries)
        via = None
        if "zha" in domains:
            signal = _zha_signal(hass, device.id) or signal
        ble = next((c[1] for c in device.connections if c[0] == dr.CONNECTION_BLUETOOTH), None)
        if ble and not signal:
            signal, via = _ble_signal(hass, ble)
        if via is None and device.via_device_id and (hub := dev_reg.async_get(device.via_device_id)):
            via = hub.name_by_user or hub.name
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
                "entities": len([e for e in entries if not e.disabled_by]),
                "online": online,
                "offline_since": since.isoformat() if since else None,
                # Ausfall schon vor dem letzten Start: Dauer ist "mindestens".
                "since_restart": bool(since and started_at and since <= started_at + timedelta(seconds=OFFLINE_AFTER)),
                "connection": _connection(device, domains, entries, signal, iot_classes),
                "signal": signal,
                "via": via,
                "battery": _battery(hass, entries),
                "update": _update(hass, entries),
            }
        )
    return {
        "devices": devices,
        "integrations": {d: i["name"] for d, i in integrations.items()},
        "now": now.isoformat(),
        "offline_after": OFFLINE_AFTER,
        "battery_low": BATTERY_LOW,
    }


@callback
def async_mark_start(hass: HomeAssistant) -> None:
    """Merkt sich den Start von HA, um Ausfälle davor als "mindestens" zu kennzeichnen."""
    if DATA_STARTED_AT not in hass.data and hass.state is not CoreState.running:
        hass.data[DATA_STARTED_AT] = dt_util.utcnow()
