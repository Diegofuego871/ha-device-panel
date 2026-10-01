"""
Gerätedaten für das Panel: Status, Verbindungsart, Empfang, Batterie, Updates.

Alles stammt aus Home Assistant selbst (Registries, Zustände, Integrationen).
Was eine andere Integration nur intern kennt (ZHA: LQI/RSSI, Bluetooth: RSSI
und Proxy), wird vorsichtig gelesen: fehlt es oder ändert sich die interne
Schnittstelle, bleibt das Feld leer, statt dass die Liste scheitert.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from datetime import datetime, timedelta
from typing import Any

from homeassistant.const import STATE_OFF, STATE_ON, STATE_UNAVAILABLE
from homeassistant.core import CoreState, HomeAssistant, State, callback
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.storage import Store
from homeassistant.loader import async_get_integration
from homeassistant.util import dt as dt_util

from .const import (
    BATTERY_LOW,
    DATA_STARTED_AT,
    DATA_TYPE_OVERRIDES,
    DEVICE_TYPES,
    DOMAIN,
    FLAKY_OUTAGES,
    OFFLINE_AFTER,
    STORAGE_VERSION,
)
from .options_api import exclusions

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


def candidate_devices(hass: HomeAssistant) -> Iterator[tuple[dr.DeviceEntry, list[er.RegistryEntry]]]:
    """
    Geräte, die überhaupt in Frage kommen: aktiviert, kein Dienst, mindestens
    eine aktivierte Entität (deaktivierte Entitäten lässt
    async_entries_for_device ohnehin weg). Ausschlüsse noch nicht abgezogen.
    """
    ent_reg = er.async_get(hass)
    for device in dr.async_get(hass).devices.values():
        if device.disabled_by or device.entry_type == dr.DeviceEntryType.SERVICE:
            continue
        entries = er.async_entries_for_device(ent_reg, device.id)
        if entries:
            yield device, entries


def hub_ids(hass: HomeAssistant) -> set[str]:
    """Geräte, über die andere Geräte verbunden sind (Hub, Bridge, Koordinator)."""
    return {d.via_device_id for d in dr.async_get(hass).devices.values() if d.via_device_id}


def monitored_devices(hass: HomeAssistant) -> Iterator[tuple[dr.DeviceEntry, list[er.RegistryEntry]]]:
    """
    Geräte, die das Panel zeigt und das Protokoll überwacht: die Kandidaten
    ohne ausgeschlossene Integrationen (primärer Eintrag) und Typen.
    """
    ex_domains, ex_types = exclusions(hass)
    hubs = hub_ids(hass) if ex_types else set()
    for device, entries in candidate_devices(hass):
        if ex_domains and (primary := _primary_entry(hass, device)) and primary.domain in ex_domains:
            continue
        if ex_types and effective_type(hass, device, entries, hubs)[0] in ex_types:
            continue
        yield device, entries


def device_back_since(hass: HomeAssistant, entries: list[er.RegistryEntry]) -> datetime | None:
    """Wann das Gerät wieder ein Lebenszeichen gab: frühester Wechsel der lebenden Entitäten."""
    relevant, is_connectivity = liveness_entities(entries)
    dead = (STATE_OFF, STATE_UNAVAILABLE) if is_connectivity else (STATE_UNAVAILABLE,)
    times = [s.last_changed for e in relevant if (s := hass.states.get(e.entity_id)) is not None and s.state not in dead]
    return min(times) if times else None


# Gerätetyp aus den Entitäten, in dieser Reihenfolge: das Gerät ist, was es
# vor allem kann (ein Thermostat mit Temperatursensor ist ein Thermostat).
_TYPE_DOMAINS = (
    ("climate", "climate"),
    ("water_heater", "climate"),
    ("humidifier", "climate"),
    ("lock", "lock"),
    ("cover", "cover"),
    ("valve", "valve"),
    ("vacuum", "vacuum"),
    ("lawn_mower", "vacuum"),
    ("camera", "camera"),
    ("alarm_control_panel", "alarm"),
    ("siren", "alarm"),
    ("media_player", "media"),
    ("fan", "fan"),
    ("light", "light"),
)
_BINARY_TYPES = {
    "motion": "motion", "occupancy": "motion", "presence": "motion",
    "door": "contact", "window": "contact", "opening": "contact", "garage_door": "contact",
    "smoke": "safety", "gas": "safety", "carbon_monoxide": "safety", "moisture": "safety", "safety": "safety", "heat": "safety",
}
# Handys, Tablets und Computer mit der Companion-App.
_PHONE_DOMAINS = {"mobile_app"}
# Integrationen für Netzwerkgeräte (Router, Access Points, Switches, NAS).
_NETWORK_DOMAINS = {
    "asuswrt", "fritz", "huawei_lte", "keenetic_ndms2", "luci", "mikrotik", "netgear", "qnap", "qnap_qsw",
    "synology_dsm", "tplink_omada", "ubus", "unifi", "upnp", "vodafone_station",
}
# Messwerte von Zählern und Energiemessern.
_ENERGY_CLASSES = {
    "energy", "power", "gas", "water", "current", "voltage", "apparent_power", "reactive_power", "power_factor",
}


def device_type(hass: HomeAssistant, device: dr.DeviceEntry, entries: list[er.RegistryEntry], hubs: set[str]) -> str:
    """Typ für Liste und Ausschlüsse (docs/CONCEPT.md, "Überwachung einstellen")."""
    if device.id in hubs:
        return "hub"
    primary_entry = _primary_entry(hass, device)
    integration = primary_entry.domain if primary_entry else None
    if integration in _PHONE_DOMAINS:
        return "phone"
    if integration in _NETWORK_DOMAINS:
        return "network"
    primary = [e for e in entries if e.entity_category is None] or entries
    domains = {e.domain for e in primary}
    for domain, kind in _TYPE_DOMAINS:
        if domain in domains:
            return kind
    if "switch" in domains:
        outlet = any(e.domain == "switch" and _device_class(e, hass.states.get(e.entity_id)) == "outlet" for e in primary)
        return "outlet" if outlet else "switch"
    for e in primary:
        if e.domain == "binary_sensor" and (kind := _BINARY_TYPES.get(str(_device_class(e, hass.states.get(e.entity_id))))):
            return kind
    sensors = [e for e in primary if e.domain == "sensor"]
    if sensors:
        # Zähler: mindestens die Hälfte der Messwerte sind Strom, Energie, Gas, Wasser.
        energy = sum(1 for e in sensors if _device_class(e, hass.states.get(e.entity_id)) in _ENERGY_CLASSES)
        if energy * 2 >= len(sensors):
            return "energy"
    if domains & {"sensor", "binary_sensor"}:
        return "sensor"
    if domains & {"button", "event", "scene"}:
        return "button"
    return "other"


def effective_type(
    hass: HomeAssistant, device: dr.DeviceEntry, entries: list[er.RegistryEntry], hubs: set[str]
) -> tuple[str, str]:
    """(gültiger Typ, erkannter Typ): ein von Hand gesetzter Typ hat Vorrang."""
    auto = device_type(hass, device, entries, hubs)
    manual = type_overrides(hass).get(device.id)
    return (manual if manual in DEVICE_TYPES else auto), auto


# -- Typ von Hand (eigene Datei, eine Instanz pro HA) ---------------------------

_TYPES_STORE_KEY = f"{DOMAIN}.devices"


def _types_store(hass: HomeAssistant) -> Store[dict[str, Any]]:
    return Store(hass, STORAGE_VERSION, _TYPES_STORE_KEY)


async def async_load_type_overrides(hass: HomeAssistant) -> None:
    if DATA_TYPE_OVERRIDES not in hass.data:
        stored = await _types_store(hass).async_load() or {}
        raw = stored.get("types") if isinstance(stored, dict) else None
        hass.data[DATA_TYPE_OVERRIDES] = {
            str(k): v for k, v in (raw or {}).items() if v in DEVICE_TYPES
        }


@callback
def type_overrides(hass: HomeAssistant) -> dict[str, str]:
    return hass.data.get(DATA_TYPE_OVERRIDES) or {}


async def async_set_type_override(hass: HomeAssistant, device_id: str, kind: str | None) -> None:
    """Typ von Hand setzen; None stellt auf die Erkennung zurück."""
    await async_load_type_overrides(hass)
    overrides = hass.data[DATA_TYPE_OVERRIDES]
    if kind is None:
        overrides.pop(device_id, None)
    else:
        overrides[device_id] = kind
    await _types_store(hass).async_save({"types": dict(overrides)})


async def async_catalog(hass: HomeAssistant) -> dict[str, Any]:
    """
    Für die Ausschlüsse in den Einstellungen: alle Integrationen und Typen der
    Kandidaten mit der Zahl ihrer Geräte, Ausschlüsse noch nicht abgezogen.
    """
    hubs = hub_ids(hass)
    by_domain: dict[str, int] = {}
    by_type: dict[str, int] = {}
    for device, entries in candidate_devices(hass):
        primary = _primary_entry(hass, device)
        if primary:
            by_domain[primary.domain] = by_domain.get(primary.domain, 0) + 1
        kind = effective_type(hass, device, entries, hubs)[0]
        by_type[kind] = by_type.get(kind, 0) + 1
    info = await async_integration_info(hass, set(by_domain))
    integrations = [
        {"domain": d, "name": info.get(d, {}).get("name", d), "devices": n} for d, n in by_domain.items()
    ]
    integrations.sort(key=lambda x: (-x["devices"], str(x["name"]).lower()))
    return {
        "integrations": integrations,
        "types": [{"type": t, "devices": by_type.get(t, 0)} for t in DEVICE_TYPES],
    }


def _primary_entry(hass: HomeAssistant, device: dr.DeviceEntry):
    entry_id = getattr(device, "primary_config_entry", None) or next(iter(device.config_entries), None)
    return hass.config_entries.async_get_entry(entry_id) if entry_id else None


async def async_list_devices(hass: HomeAssistant, log: Any = None) -> dict[str, Any]:
    """Alle überwachten Geräte für das Panel, dazu Integrationen, Protokoll und Serverzeit."""
    dev_reg = dr.async_get(hass)
    area_reg = ar.async_get(hass)
    now = dt_util.utcnow()
    now_ts = now.timestamp()
    started_at: datetime | None = hass.data.get(DATA_STARTED_AT)

    raw: list[tuple[dr.DeviceEntry, list[er.RegistryEntry], list[str]]] = []
    all_domains: set[str] = set()
    hubs = hub_ids(hass)
    for device, entries in monitored_devices(hass):
        domains = sorted(
            {e.domain for eid in device.config_entries if (e := hass.config_entries.async_get_entry(eid))}
        )
        all_domains.update(domains)
        raw.append((device, entries, domains))
    integrations = await async_integration_info(hass, all_domains)
    iot_classes = {d: i["iot_class"] for d, i in integrations.items()}

    devices: list[dict[str, Any]] = []
    names: dict[str, str] = {}
    for device, entries, domains in raw:
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
        primary = _primary_entry(hass, device)
        name = device.name_by_user or device.name or device.id
        names[device.id] = name
        avail = None
        if log is not None:
            summary = log.device_summary(device.id, 86400, now_ts)
            avail = {**(summary or {}), "strip": log.device_strip(device.id, now_ts)} if summary else None
        devices.append(
            {
                "id": device.id,
                "name": name,
                "area": area.name if area else None,
                "manufacturer": device.manufacturer,
                "model": device.model,
                "sw_version": device.sw_version,
                "hw_version": device.hw_version,
                "integrations": domains,
                "integration": {"domain": primary.domain, "title": primary.title} if primary else None,
                **dict(zip(("type", "type_auto"), effective_type(hass, device, entries, hubs))),
                "type_manual": device.id in type_overrides(hass),
                "entities": len(entries),
                "online": online,
                "offline_since": since.isoformat() if since else None,
                # Ausfall schon vor dem letzten Start: Dauer ist "mindestens".
                "since_restart": bool(since and started_at and since <= started_at + timedelta(seconds=OFFLINE_AFTER)),
                "connection": _connection(device, domains, entries, signal, iot_classes),
                "signal": signal,
                "via": via,
                "battery": _battery(hass, entries),
                "update": _update(hass, entries),
                "avail24": avail,
                # Instabil: online, aber oft unterbrochen.
                "flaky": bool(online and avail and avail.get("outages", 0) >= FLAKY_OUTAGES),
            }
        )
    result: dict[str, Any] = {
        "devices": devices,
        "integrations": {d: i["name"] for d, i in integrations.items()},
        "now": now.isoformat(),
        "offline_after": OFFLINE_AFTER,
        "battery_low": BATTERY_LOW,
        "flaky_outages": FLAKY_OUTAGES,
        "pulse": None,
        "incidents": [],
    }
    if log is not None:
        # Nur die gezeigten Geräte: ausgeschlossene zählen nirgends mit.
        shown = {d["id"] for d in devices}
        result["pulse"] = log.pulse(now_ts, only=shown)
        domain_of = {d["id"]: (d["integration"] or {}).get("domain") for d in devices}
        result["incidents"] = [
            {
                "at": inc["at"],
                "count": len(inc["devices"]),
                "names": [names[d] for d in inc["devices"] if d in names][:6],
                # Gemeinsame Integration als Hinweis auf die Ursache.
                "integration": common if len({domain_of.get(d) for d in inc["devices"]}) == 1 and (common := domain_of.get(inc["devices"][0])) else None,
            }
            for inc in log.incidents(now_ts, only=shown)
        ]
    return result


async def async_device_detail(hass: HomeAssistant, device_id: str, log: Any = None) -> dict[str, Any] | None:
    """Für das Geräte-Popup: Entitäten mit Zustand und Lebenszeichen, Integrationen, Kurzstatistik."""
    device = dr.async_get(hass).async_get(device_id)
    if device is None:
        return None
    entries = er.async_entries_for_device(er.async_get(hass), device_id)
    relevant, _conn = liveness_entities(entries)
    relevant_ids = {e.entity_id for e in relevant}
    device_name = device.name_by_user or device.name
    entities = []
    for e in sorted(entries, key=lambda x: (x.entity_category is not None, x.entity_id)):
        state = hass.states.get(e.entity_id)
        # Ohne eigenen Namen heisst die Hauptentität wie das Gerät (has_entity_name).
        own = e.name or e.original_name or (device_name if e.has_entity_name else None)
        entities.append(
            {
                "entity_id": e.entity_id,
                "name": own or _attr(state, "friendly_name") or e.entity_id,
                "state": state.state if state else None,
                "unit": _attr(state, "unit_of_measurement"),
                "category": e.entity_category.value if e.entity_category else None,
                "liveness": e.entity_id in relevant_ids,
            }
        )
    entry_ids = list(device.config_entries)
    domains = {e.domain for eid in entry_ids if (e := hass.config_entries.async_get_entry(eid))}
    info = await async_integration_info(hass, domains)
    configs = []
    for eid in entry_ids:
        entry = hass.config_entries.async_get_entry(eid)
        if entry:
            configs.append({"domain": entry.domain, "name": info.get(entry.domain, {}).get("name", entry.domain), "title": entry.title, "state": entry.state.value})
    now = dt_util.utcnow().timestamp()
    return {
        "id": device.id,
        "entities": entities,
        "config_entries": configs,
        "identifiers": sorted(f"{a}: {b}" for a, b in device.identifiers)[:4],
        "stats": {
            "24h": log.device_summary(device.id, 86400, now) if log else None,
            "7d": log.device_summary(device.id, 7 * 86400, now) if log else None,
        },
    }


@callback
def async_mark_start(hass: HomeAssistant) -> None:
    """Merkt sich den Start von HA, um Ausfälle davor als "mindestens" zu kennzeichnen."""
    if DATA_STARTED_AT not in hass.data and hass.state is not CoreState.running:
        hass.data[DATA_STARTED_AT] = dt_util.utcnow()
