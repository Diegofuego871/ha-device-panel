"""
Gerätedaten für das Panel: Status, Verbindungsart, Empfang, Batterie, Updates.

Alles stammt aus Home Assistant selbst (Registries, Zustände, Integrationen).
Was eine andere Integration nur intern kennt (ZHA: LQI/RSSI, Bluetooth: RSSI
und Proxy), wird vorsichtig gelesen: fehlt es oder ändert sich die interne
Schnittstelle, bleibt das Feld leer, statt dass die Liste scheitert.
"""

from __future__ import annotations

import logging
import time
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
    CONF_AI_ASSESSMENT,
    CONF_BATTERY_LOW,
    CONF_BATTERY_LOW_INTEGRATIONS,
    CONF_BATTERY_PUSH,
    CONF_BATTERY_PUSH_EXCLUDE,
    CONF_EXCLUDE_INTEGRATIONS,
    CONF_EXCLUDE_TYPES,
    CONF_CHIP_ORDER,
    CONF_CONNECTION_ORDER,
    CONF_CONNECTION_INTEGRATIONS,
    CONF_HIDE_CHIPS,
    CONF_HIDE_CONNECTIONS,
    CONNECTION_MANUAL,
    DATA_CONNECTION_OVERRIDES,
    CONF_FLAKY_OUTAGES,
    CONF_OFFLINE_AFTER,
    CONF_OFFLINE_INTEGRATIONS,
    CONF_NOTIFY_EXCLUDE,
    CONF_NOTIFY_ONLINE,
    CONF_NOTIFY_OUTAGE,
    CONF_NOTIFY_SERVICE,
    CONF_OUTAGE_PERSISTENT,
    CONF_PERSISTENT_EXCLUDE,
    MONITOR_OFF,
    NOTIFY_NONE,
    OFFLINE_INTEGRATION_RANGE,
    CONF_SHOW_DISABLED,
    CONF_SHOW_SERVICE,
    BATTERY_OFF,
    DATA_DEVICE_SETTINGS,
    DATA_STARTED_AT,
    DATA_TYPE_OVERRIDES,
    DEFAULT_BATTERY_LOW,
    DEFAULT_OFFLINE_AFTER,
    DEVICE_TYPES,
    DOMAIN,
    INT_RANGES,
    STORAGE_VERSION,
    SIGNAL_DBM_RANGE,
    SIGNAL_LQI_RANGE,
    SIGNAL_OFF,
    NEW_DEVICE_DAYS,
    CONF_EXCLUDE_DEVICES,
)
from .options_api import battery_threshold, effective, offline_after_for, signal_default

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
    hass: HomeAssistant,
    entries: list[er.RegistryEntry],
    now: datetime,
    offline_after: float = DEFAULT_OFFLINE_AFTER * 60,
) -> tuple[bool | None, datetime | None]:
    """
    (online, ausgefallen seit). None = keine Daten.

    Ausgefallen erst nach offline_after Sekunden (Option "Ausgefallen nach"):
    kurze Aussetzer und das Hochfahren der Integrationen nach einem Neustart
    zählen nicht.
    """
    states, down = _liveness_states(hass, entries)
    if not states:
        return None, None
    if len(down) < len(states):
        return True, None
    since = max(s.last_changed for s in down)
    if now - since < timedelta(seconds=offline_after):
        return True, None
    return False, since


def _liveness_states(hass: HomeAssistant, entries: list[er.RegistryEntry]) -> tuple[list[State], list[State]]:
    """Zustände der lebenden Entitäten und die davon, die weg sind."""
    relevant, is_connectivity = liveness_entities(entries)
    states = [s for e in relevant if (s := hass.states.get(e.entity_id)) is not None]
    # Verbindungssensor: "aus" heisst getrennt; "unknown" (z. B. kurz nach
    # dem Start) ist kein Ausfall.
    dead = (STATE_OFF, STATE_UNAVAILABLE) if is_connectivity else (STATE_UNAVAILABLE,)
    return states, [s for s in states if s.state in dead]


def device_down_since(hass: HomeAssistant, entries: list[er.RegistryEntry]) -> datetime | None:
    """
    Seit wann alle lebenden Entitäten weg sind, auch unter der Schwelle
    "Ausgefallen nach"; None, solange eine lebt.

    device_status zählt diese Zeit als online (kurzer Aussetzer). Nach einem
    Neustart beginnt last_changed aber beim Start: Ein Gerät, das schon vorher
    fehlte, ist dann kein Aussetzer, und ein Lebenszeichen ist es auch nicht.
    """
    states, down = _liveness_states(hass, entries)
    if not states or len(down) < len(states):
        return None
    return max(s.last_changed for s in down)


def outage_start(
    log: Any, device_id: str, since: datetime, started_at: datetime | None, offline_after: float
) -> tuple[datetime, bool]:
    """
    (Beginn des laufenden Ausfalls, nur "mindestens").

    `since` (last_changed) beginnt nach jedem Neustart von HA von vorn. Das
    Protokoll weiss mehr: Ein Ausfall endet erst, wenn HA das Gerät wieder
    online sah, Zeiten ohne Daten dazwischen beenden ihn nicht. Sicher ist
    der Beginn, wenn HA den Wechsel von online zu ausgefallen selbst sah;
    sonst gilt wie bisher: ein Beginn kurz nach dem Start von HA kommt vom
    Start selbst und ist nur ein "mindestens".
    """
    start, seen = log.open_outage(device_id) if log is not None else (None, False)
    if start is not None:
        if start <= since.timestamp():
            since = dt_util.utc_from_timestamp(start)
        else:
            # Protokoll beginnt später (z. B. erst wieder überwacht): last_changed zählt.
            seen = False
    at_least = not seen and bool(started_at and since <= started_at + timedelta(seconds=offline_after))
    return since, at_least


def _signal_kind(entry: er.RegistryEntry, state: State | None) -> str | None:
    """"dbm" oder "lqi", wenn die Entität den Empfang misst, sonst None."""
    unit = str(_attr(state, "unit_of_measurement") or entry.unit_of_measurement or "").lower()
    if _device_class(entry, state) == "signal_strength" and unit == "dbm":
        return "dbm"
    if unit == "lqi" or entry.entity_id.endswith(("_lqi", "_linkquality")):
        return "lqi"
    return None


def _signal_entity(hass: HomeAssistant, entries: list[er.RegistryEntry]) -> tuple[dict[str, Any] | None, str | None]:
    """Empfang aus Entitäten: dBm (WLAN, Z-Wave …) oder LQI (Zigbee2MQTT), dazu die Entität."""
    for entry in entries:
        if entry.disabled_by or entry.domain != "sensor":
            continue
        state = hass.states.get(entry.entity_id)
        value = _number(state)
        if value is None:
            continue
        if kind := _signal_kind(entry, state):
            return {"kind": kind, "value": round(value)}, entry.entity_id
    return None, None


def signal_sensor(hass: HomeAssistant, entries: list[er.RegistryEntry]) -> tuple[str, str] | None:
    """
    Sensor für den Empfang (Entität, Art), auch wenn er gerade keinen Wert
    hat: der Verlauf ist gerade bei einem ausgefallenen Gerät gefragt.
    """
    for entry in entries:
        if entry.disabled_by or entry.domain != "sensor":
            continue
        if kind := _signal_kind(entry, hass.states.get(entry.entity_id)):
            return entry.entity_id, kind
    return None


def signal_source(
    hass: HomeAssistant, device: dr.DeviceEntry, entries: list[er.RegistryEntry], domains: list[str] | set[str]
) -> tuple[dict[str, Any] | None, str | None, str | None]:
    """
    (Empfang, Empfänger, Quelle) wie in der Liste: ZHA vor dem Sensor,
    Bluetooth nur ohne anderen Wert. Quelle ist die Entität des Sensors oder
    "zha" bzw. "ble" (Wert direkt aus der Integration, ohne Verlauf im
    Recorder; signal_history zeichnet ihn selbst auf).
    """
    signal, source = _signal_entity(hass, entries)
    via = None
    if "zha" in domains and (zha := _zha_signal(hass, device.id)):
        signal, source = zha, "zha"
    ble = next((c[1] for c in device.connections if c[0] == dr.CONNECTION_BLUETOOTH), None)
    if ble and not signal:
        signal, via = _ble_signal(hass, ble)
        source = "ble" if signal else None
    return signal, via, source


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


def battery(
    hass: HomeAssistant, entries: list[er.RegistryEntry], threshold: int = DEFAULT_BATTERY_LOW
) -> dict[str, Any] | None:
    """
    Batterie aus Entitäten: Prozent (Sensor) und/oder "schwach" (Binärsensor).
    Schwach bis threshold Prozent (Option "Schwach ab") oder wenn der
    Binärsensor es meldet.
    """
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
        low = low or level <= threshold
    return {"level": level, "low": low}


def _offline_default(opts: dict[str, Any], domain: str | None) -> dict[str, Any]:
    """"Ausgefallen nach" ohne Einstellung des Geräts: Minuten oder "off", dazu die Integration mit eigenem Wert."""
    own = opts[CONF_OFFLINE_INTEGRATIONS].get(domain) if domain else None
    return {
        "minutes": own if own is not None else opts[CONF_OFFLINE_AFTER],
        "integration": domain if own is not None else None,
        "global": opts[CONF_OFFLINE_AFTER],
    }


def _notify_default(opts: dict[str, Any], domain: str | None) -> dict[str, Any]:
    """
    Push und anhaltende Benachrichtigung bei Ausfall für Geräte der Integration
    (Optionen, ohne Einstellung des Geräts); "integration" nennt sie, wenn sie
    von den globalen Schaltern abweicht.
    """
    push_on = opts[CONF_NOTIFY_SERVICE] != NOTIFY_NONE and (opts[CONF_NOTIFY_OUTAGE] or opts[CONF_NOTIFY_ONLINE])
    ex_push = bool(domain) and domain in opts[CONF_NOTIFY_EXCLUDE]
    ex_pers = bool(domain) and domain in opts[CONF_PERSISTENT_EXCLUDE]
    return {
        "push": bool(push_on) and not ex_push,
        "persistent": bool(opts[CONF_OUTAGE_PERSISTENT]) and not ex_pers,
        "integration": domain if ex_push or ex_pers else None,
    }


def _battery_fields(
    hass: HomeAssistant, opts: dict[str, Any], device: dr.DeviceEntry, entries: list[er.RegistryEntry], domain: str | None
) -> dict[str, Any]:
    """
    Batterie für Liste und Popup: Stand mit wirksamer Schwelle, Einstellung
    des Geräts und was ohne sie gälte (für "Sonst gilt …").
    """
    threshold = device_battery_threshold(hass, opts, device)
    info = battery(hass, entries, threshold if threshold is not None else -1)
    own = opts[CONF_BATTERY_LOW_INTEGRATIONS].get(domain) if domain else None
    # Push bei schwacher Batterie: global an und nicht für die Integration aus
    # (seit 0.34.0); "push_integration" nennt sie, wenn sie ihn ausschaltet.
    push_off = bool(domain) and domain in opts[CONF_BATTERY_PUSH_EXCLUDE]
    return {
        # Warnung aus: Stand ja, "schwach" nie.
        "battery": {**info, "low": False} if info and threshold is None else info,
        "has_battery": has_battery(hass, entries),
        "battery_setting": device_settings(hass)["battery"].get(device.id),
        "battery_default": {
            "pct": own if own is not None else opts[CONF_BATTERY_LOW],
            "integration": domain if own is not None else None,
            "push": bool(opts[CONF_BATTERY_PUSH]) and opts[CONF_NOTIFY_SERVICE] != NOTIFY_NONE and not push_off,
            "push_integration": domain if push_off else None,
        },
    }


def has_battery(hass: HomeAssistant, entries: list[er.RegistryEntry]) -> bool:
    """
    Gerät mit Batterie-Entität, nach Registry (bzw. Geräteklasse im Zustand),
    nicht nach dem aktuellen Wert: schlafende oder gerade nicht erreichbare
    Geräte zählen mit.
    """
    return any(
        not e.disabled_by and e.domain in ("sensor", "binary_sensor") and _device_class(e, hass.states.get(e.entity_id)) == "battery"
        for e in entries
    )


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


def candidate_devices(
    hass: HomeAssistant, *, service: bool = False, disabled: bool = False
) -> Iterator[tuple[dr.DeviceEntry, list[er.RegistryEntry]]]:
    """
    Geräte, die überhaupt in Frage kommen: mindestens eine aktivierte Entität
    (deaktivierte lässt async_entries_for_device weg), Dienst-Geräte nur mit
    service, deaktivierte Geräte nur mit disabled (dann mit ihren
    deaktivierten Entitäten). Ausschlüsse noch nicht abgezogen.
    """
    ent_reg = er.async_get(hass)
    for device in dr.async_get(hass).devices.values():
        if device.entry_type == dr.DeviceEntryType.SERVICE and not service:
            continue
        if device.disabled_by and not disabled:
            continue
        entries = er.async_entries_for_device(ent_reg, device.id, include_disabled_entities=bool(device.disabled_by))
        if entries:
            yield device, entries


def hub_ids(hass: HomeAssistant) -> set[str]:
    """Geräte, über die andere Geräte verbunden sind (Hub, Bridge, Koordinator)."""
    return {d.via_device_id for d in dr.async_get(hass).devices.values() if d.via_device_id}


def _shown(
    hass: HomeAssistant, opts: dict[str, Any], disabled: bool, unmonitored: bool = True
) -> Iterator[tuple[dr.DeviceEntry, list[er.RegistryEntry]]]:
    """
    Kandidaten nach "Anzeige", ohne ausgeschlossene Integrationen (primärer
    Eintrag), Typen und einzeln ausgeblendete Geräte. Geräte mit
    "Ausgefallen nach" = "off" (Nicht überwachen, am Gerät oder an der
    Integration) fehlen nur ohne unmonitored.
    """
    ex_devices = set(opts[CONF_EXCLUDE_DEVICES])
    ex_domains = set(opts[CONF_EXCLUDE_INTEGRATIONS])
    ex_types = set(opts[CONF_EXCLUDE_TYPES])
    hubs = hub_ids(hass) if ex_types else set()
    for device, entries in candidate_devices(hass, service=opts[CONF_SHOW_SERVICE], disabled=disabled):
        if device.id in ex_devices:
            continue
        if ex_domains and (primary := _primary_entry(hass, device)) and primary.domain in ex_domains:
            continue
        if not unmonitored and device_offline_after(hass, opts, device) is None:
            continue
        if ex_types and effective_type(hass, device, entries, hubs)[0] in ex_types:
            continue
        yield device, entries


def monitored_devices(
    hass: HomeAssistant, opts: dict[str, Any] | None = None
) -> Iterator[tuple[dr.DeviceEntry, list[er.RegistryEntry]]]:
    """Geräte, die das Protokoll überwacht: gezeigt, nicht deaktiviert und nicht auf "Nicht überwachen"."""
    yield from _shown(hass, opts or effective(hass), disabled=False, unmonitored=False)


def listed_devices(
    hass: HomeAssistant, opts: dict[str, Any] | None = None
) -> Iterator[tuple[dr.DeviceEntry, list[er.RegistryEntry]]]:
    """Geräte, die das Panel zeigt: die überwachten, dazu nicht überwachte und deaktivierte, wenn eingestellt."""
    opts = opts or effective(hass)
    yield from _shown(hass, opts, disabled=opts[CONF_SHOW_DISABLED])


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

DEVICES_STORE_KEY = f"{DOMAIN}.devices"


def _types_store(hass: HomeAssistant) -> Store[dict[str, Any]]:
    return Store(hass, STORAGE_VERSION, DEVICES_STORE_KEY)


async def async_load_type_overrides(hass: HomeAssistant) -> None:
    """Typ von Hand und Einstellungen pro Gerät (eine Datei) laden."""
    if DATA_TYPE_OVERRIDES not in hass.data:
        stored = await _types_store(hass).async_load() or {}
        if not isinstance(stored, dict):
            stored = {}
        raw = stored.get("types")
        hass.data[DATA_TYPE_OVERRIDES] = {
            str(k): v for k, v in (raw or {}).items() if v in DEVICE_TYPES
        }
        low, high = INT_RANGES[CONF_BATTERY_LOW]
        bat = stored.get("battery") if isinstance(stored.get("battery"), dict) else {}
        hass.data[DATA_DEVICE_SETTINGS] = {
            "battery": {
                str(k): v
                for k, v in bat.items()
                if v == BATTERY_OFF or (isinstance(v, int) and not isinstance(v, bool) and low <= v <= high)
            },
            "notify_off": {str(d) for d in stored.get("notify_off") or [] if isinstance(d, str)},
            # Push stumm bis (Unix-Zeit), aus der Aktion "24 Std. stumm".
            "notify_mute": {
                str(k): float(v)
                for k, v in (stored.get("notify_mute") or {}).items()
                if isinstance(v, (int, float)) and not isinstance(v, bool)
            },
            # Empfang-Warnung: "off" oder eigene Schwelle (seit 0.21.0).
            "signal": {str(k): v for k, v in (stored.get("signal") or {}).items() if valid_signal_setting(v)},
            # "Ausgefallen nach" des Geräts: Minuten oder "off" (seit 0.31.0).
            "offline": {str(k): v for k, v in (stored.get("offline") or {}).items() if valid_offline_setting(v)},
        }
        conns = stored.get("connections") if isinstance(stored.get("connections"), dict) else {}
        hass.data[DATA_CONNECTION_OVERRIDES] = {str(k): v for k, v in conns.items() if v in CONNECTION_MANUAL}


async def _async_save_devices(hass: HomeAssistant) -> None:
    settings = device_settings(hass)
    data: dict[str, Any] = {
        "types": dict(type_overrides(hass)),
        "battery": dict(settings["battery"]),
        "notify_off": sorted(settings["notify_off"]),
        "connections": dict(connection_overrides(hass)),
    }
    # Abgelaufene fallen beim Schreiben weg; ohne Eintrag kein Schlüssel.
    if mute := {d: t for d, t in settings.get("notify_mute", {}).items() if t > time.time()}:
        data["notify_mute"] = mute
    if settings.get("signal"):
        data["signal"] = dict(settings["signal"])
    if settings.get("offline"):
        data["offline"] = dict(settings["offline"])
    await _types_store(hass).async_save(data)


@callback
def device_settings(hass: HomeAssistant) -> dict[str, Any]:
    """
    {"battery": {Gerät: Prozent | "off"}, "notify_off": {Gerät, …},
    "notify_mute": {Gerät: bis}, "signal": {Gerät: Schwelle | "off"},
    "offline": {Gerät: Minuten | "off"}}.
    """
    return hass.data.get(DATA_DEVICE_SETTINGS) or {"battery": {}, "notify_off": set(), "notify_mute": {}, "signal": {}, "offline": {}}


def valid_signal_setting(value: Any) -> bool:
    """Empfang-Warnung: "off" oder ganze Zahl im Bereich für dBm oder LQI."""
    if value == SIGNAL_OFF:
        return True
    if not isinstance(value, int) or isinstance(value, bool):
        return False
    return SIGNAL_DBM_RANGE[0] <= value <= SIGNAL_DBM_RANGE[1] or SIGNAL_LQI_RANGE[0] <= value <= SIGNAL_LQI_RANGE[1]


def valid_offline_setting(value: Any) -> bool:
    """"Ausgefallen nach" des Geräts: "off" (nicht überwachen) oder ganze Minuten im Bereich der Integrationen."""
    if value == MONITOR_OFF:
        return True
    low, high = OFFLINE_INTEGRATION_RANGE
    return isinstance(value, int) and not isinstance(value, bool) and low <= value <= high


def device_offline_after(hass: HomeAssistant, opts: dict[str, Any], device: dr.DeviceEntry) -> float | None:
    """
    Wirksames "Ausgefallen nach" eines Geräts in Sekunden: eigenes des Geräts,
    sonst das der Integration, sonst das globale; None = nicht überwacht. Das
    Gerät geht vor, auch gegen "Nicht überwachen" der Integration.
    """
    own = device_settings(hass).get("offline", {}).get(device.id)
    if own == MONITOR_OFF:
        return None
    if isinstance(own, int):
        return own * 60
    return offline_after_for(opts, primary_domain(hass, device))


def _iso(ts: float | None) -> str | None:
    return dt_util.utc_from_timestamp(ts).isoformat() if ts is not None else None


def notify_muted_until(hass: HomeAssistant, device_id: str, now: float | None = None) -> float | None:
    """Push für das Gerät stumm bis (Unix-Zeit), sonst None."""
    until = device_settings(hass).get("notify_mute", {}).get(device_id)
    return until if until is not None and until > (now if now is not None else time.time()) else None


async def async_mute_device(hass: HomeAssistant, device_id: str, until: float) -> None:
    """Ausfall- und Online-Push eines Geräts bis zu einem Zeitpunkt stumm."""
    await async_load_type_overrides(hass)
    hass.data[DATA_DEVICE_SETTINGS].setdefault("notify_mute", {})[device_id] = until
    await _async_save_devices(hass)


def device_battery_threshold(hass: HomeAssistant, opts: dict[str, Any], device: dr.DeviceEntry) -> int | None:
    """
    Wirksame Batterie-Schwelle eines Geräts: eigene des Geräts, sonst die
    seiner Integration, sonst die allgemeine; None = Batterie-Warnung aus.
    """
    own = device_settings(hass)["battery"].get(device.id)
    if own == BATTERY_OFF:
        return None
    if isinstance(own, int):
        return own
    return battery_threshold(opts, primary_domain(hass, device))


async def async_set_device_settings(hass: HomeAssistant, device_id: str, **changes: Any) -> None:
    """
    Einstellungen eines Geräts: battery=None (globaler Wert), "off" oder
    Prozent; notify=True/False (Ausfall- und Online-Meldungen);
    signal=None (Standard), "off" oder Schwelle "schwach unter";
    offline=None (Integration bzw. global), "off" oder Minuten.
    """
    await async_load_type_overrides(hass)
    settings = hass.data[DATA_DEVICE_SETTINGS]
    if "offline" in changes:
        if changes["offline"] is None:
            settings.setdefault("offline", {}).pop(device_id, None)
        else:
            settings.setdefault("offline", {})[device_id] = changes["offline"]
    if "signal" in changes:
        if changes["signal"] is None:
            settings.setdefault("signal", {}).pop(device_id, None)
        else:
            settings.setdefault("signal", {})[device_id] = changes["signal"]
    if "battery" in changes:
        if changes["battery"] is None:
            settings["battery"].pop(device_id, None)
        else:
            settings["battery"][device_id] = changes["battery"]
    if "notify" in changes:
        # Jede Wahl im Popup hebt ein "stumm bis" auf.
        settings.setdefault("notify_mute", {}).pop(device_id, None)
        if changes["notify"]:
            settings["notify_off"].discard(device_id)
        else:
            settings["notify_off"].add(device_id)
    await _async_save_devices(hass)


async def async_reset_device_settings(
    hass: HomeAssistant,
    battery: list[str],
    notify: list[str],
    connection: list[str] | None = None,
    signal: list[str] | None = None,
    offline: list[str] | None = None,
) -> dict[str, int]:
    """
    Einstellungen mehrerer Geräte auf den globalen Wert zurück (Einstellungen,
    "Alle zurücksetzen" oder einzeln); die Verbindungsart von Hand zurück auf
    Integration bzw. Erkennung. Nur die genannten Geräte: ein Wert, der
    inzwischen dazukam, bleibt. Gibt zurück, wie viele es waren.
    """
    await async_load_type_overrides(hass)
    settings = hass.data[DATA_DEVICE_SETTINGS]
    done_battery = sum(1 for dev in set(battery) if settings["battery"].pop(dev, None) is not None)
    done_notify = 0
    for dev in set(notify):
        if dev in settings["notify_off"]:
            settings["notify_off"].discard(dev)
            done_notify += 1
    conns = hass.data[DATA_CONNECTION_OVERRIDES]
    done_conn = sum(1 for dev in set(connection or []) if conns.pop(dev, None) is not None)
    sig = settings.setdefault("signal", {})
    done_signal = sum(1 for dev in set(signal or []) if sig.pop(dev, None) is not None)
    off = settings.setdefault("offline", {})
    done_offline = sum(1 for dev in set(offline or []) if off.pop(dev, None) is not None)
    if done_battery or done_notify or done_conn or done_signal or done_offline:
        await _async_save_devices(hass)
    return {"battery": done_battery, "notify": done_notify, "connection": done_conn, "signal": done_signal, "offline": done_offline}


async def async_device_overrides(hass: HomeAssistant) -> dict[str, list[dict[str, Any]]]:
    """
    Geräte mit eigener Einstellung, für das Zurücksetzen in den Einstellungen:
    auch ausgeblendete (hidden), weil ihr Wert gespeichert bleibt. Gelöschte
    Geräte fehlen hier, ihr Eintrag bleibt aber: HA stellt ein wieder
    hinzugefügtes Gerät mit derselben ID wieder her.
    """
    await async_load_type_overrides(hass)
    settings = device_settings(hass)
    dev_reg = dr.async_get(hass)
    area_reg = ar.async_get(hass)
    shown = {device.id for device, _entries in listed_devices(hass)}
    conns = connection_overrides(hass)
    items: dict[str, dict[str, Any]] = {}
    signal = settings.get("signal", {})
    offline = settings.get("offline", {})
    for dev in {*settings["battery"], *settings["notify_off"], *conns, *signal, *offline}:
        device = dev_reg.async_get(dev)
        if device is None:
            continue
        area = area_reg.async_get_area(device.area_id) if device.area_id else None
        items[dev] = {
            "id": dev,
            "name": device.name_by_user or device.name or dev,
            "area": area.name if area else None,
            "domain": primary_domain(hass, device),
            "hidden": dev not in shown,
        }
    names = await async_integration_info(hass, {i["domain"] for i in items.values() if i["domain"]})
    for item in items.values():
        # Domain bleibt: die Einstellungen einer Integration zeigen ihre Geräte.
        domain = item["domain"]
        item["integration"] = names.get(domain, {}).get("name", domain) if domain else None

    def by_name(entry: dict[str, Any]) -> str:
        return str(entry["name"]).casefold()

    return {
        "battery": sorted(
            ({**items[dev], "value": value} for dev, value in settings["battery"].items() if dev in items), key=by_name
        ),
        "notify": sorted((items[dev] for dev in settings["notify_off"] if dev in items), key=by_name),
        # Verbindungsart von Hand (seit 0.17.0 eine eigene Einstellung wie die anderen).
        "connection": sorted(({**items[dev], "value": kind} for dev, kind in conns.items() if dev in items), key=by_name),
        # Empfang-Warnung (seit 0.21.0): "off" oder Schwelle.
        "signal": sorted(({**items[dev], "value": value} for dev, value in signal.items() if dev in items), key=by_name),
        # "Ausgefallen nach" des Geräts (seit 0.31.0): "off" oder Minuten.
        "offline": sorted(({**items[dev], "value": value} for dev, value in offline.items() if dev in items), key=by_name),
    }


@callback
def connection_overrides(hass: HomeAssistant) -> dict[str, str]:
    """Verbindungsart von Hand: Gerät → Art (Vorrang vor der Erkennung)."""
    return hass.data.get(DATA_CONNECTION_OVERRIDES) or {}


async def async_set_connection_override(hass: HomeAssistant, device_id: str, kind: str | None) -> None:
    """Verbindungsart von Hand setzen; None stellt auf die Erkennung zurück."""
    await async_load_type_overrides(hass)
    overrides = hass.data[DATA_CONNECTION_OVERRIDES]
    if kind is None:
        overrides.pop(device_id, None)
    else:
        overrides[device_id] = kind
    await _async_save_devices(hass)


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
    await _async_save_devices(hass)


async def async_catalog(hass: HomeAssistant) -> dict[str, Any]:
    """
    Für die Ausschlüsse in den Einstellungen: alle Integrationen und Typen der
    Kandidaten mit der Zahl ihrer Geräte, Ausschlüsse noch nicht abgezogen.
    """
    hubs = hub_ids(hass)
    opts = effective(hass)
    by_domain: dict[str, int] = {}
    by_type: dict[str, int] = {}
    for device, entries in candidate_devices(hass, service=opts[CONF_SHOW_SERVICE], disabled=opts[CONF_SHOW_DISABLED]):
        primary = _primary_entry(hass, device)
        if primary:
            by_domain[primary.domain] = by_domain.get(primary.domain, 0) + 1
        kind = effective_type(hass, device, entries, hubs)[0]
        by_type[kind] = by_type.get(kind, 0) + 1
    # Eigene Batterie-Schwelle: Integrationen mit Batteriegeräten unter den
    # überwachten Geräten (Ausblendungen gelten), dazu solche mit eigener
    # Schwelle ohne Geräte (damit sie sich zurücksetzen lässt).
    own = opts[CONF_BATTERY_LOW_INTEGRATIONS]
    bat: dict[str, dict[str, Any]] = {d: {"devices": 0, "weakest": None} for d in own}
    for device, entries in monitored_devices(hass, opts):
        if not has_battery(hass, entries) or not (primary := _primary_entry(hass, device)):
            continue
        item = bat.setdefault(primary.domain, {"devices": 0, "weakest": None})
        item["devices"] += 1
        level = (battery(hass, entries) or {}).get("level")
        if level is not None and (item["weakest"] is None or level < item["weakest"]):
            item["weakest"] = level
    info = await async_integration_info(hass, set(by_domain) | set(bat))
    name = lambda d: info.get(d, {}).get("name", d)  # noqa: E731
    integrations = [{"domain": d, "name": name(d), "devices": n} for d, n in by_domain.items()]
    integrations.sort(key=lambda x: (-x["devices"], str(x["name"]).lower()))
    battery_list = [{"domain": d, "name": name(d), **v} for d, v in bat.items()]
    battery_list.sort(key=lambda x: (-x["devices"], str(x["name"]).lower()))
    return {
        "integrations": integrations,
        "types": [{"type": t, "devices": by_type.get(t, 0)} for t in DEVICE_TYPES],
        "battery": battery_list,
        "hidden_devices": await async_hidden_devices(hass, opts),
        # KI-Aufgaben von Home Assistant zur Auswahl (Einstellungen, "KI-Einschätzung").
        "ai_tasks": sorted(
            ({"value": s.entity_id, "name": s.name} for s in hass.states.async_all("ai_task")), key=lambda x: str(x["name"]).lower()
        ),
    }


def area_catalog(hass: HomeAssistant) -> dict[str, list[dict[str, Any]]]:
    """Bereiche (mit Etage) und Etagen für den Filter, in der Reihenfolge der Registries."""
    from homeassistant.helpers import floor_registry as fr  # noqa: PLC0415

    floors = [{"id": f.floor_id, "name": f.name, "level": f.level} for f in fr.async_get(hass).async_list_floors()]
    areas = [{"id": a.id, "name": a.name, "floor_id": a.floor_id} for a in ar.async_get(hass).async_list_areas()]
    return {"areas": areas, "floors": floors}


async def async_hidden_devices(hass: HomeAssistant, opts: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """
    Einzeln ausgeblendete Geräte für die Einstellungen (zum Wiedereinblenden):
    Name, Typ (Symbol), Bereich, Integration. Gelöschte fehlen; ihre ID bleibt
    gespeichert, weil HA ein wieder hinzugefügtes Gerät mit derselben ID
    herstellt.
    """
    opts = opts or effective(hass)
    dev_reg = dr.async_get(hass)
    area_reg = ar.async_get(hass)
    ent_reg = er.async_get(hass)
    hubs = hub_ids(hass) if opts[CONF_EXCLUDE_DEVICES] else set()
    items: list[dict[str, Any]] = []
    for dev in opts[CONF_EXCLUDE_DEVICES]:
        device = dev_reg.async_get(dev)
        if device is None:
            continue
        area = area_reg.async_get_area(device.area_id) if device.area_id else None
        entries = er.async_entries_for_device(ent_reg, device.id, include_disabled_entities=bool(device.disabled_by))
        items.append({
            "id": dev,
            "name": device.name_by_user or device.name or dev,
            "type": effective_type(hass, device, entries, hubs)[0],
            "area": area.name if area else None,
            "domain": primary_domain(hass, device),
        })
    names = await async_integration_info(hass, {i["domain"] for i in items if i["domain"]})
    for item in items:
        domain = item.pop("domain")
        item["integration"] = names.get(domain, {}).get("name", domain) if domain else None
    items.sort(key=lambda x: str(x["name"]).casefold())
    return items


async def async_set_device_hidden(hass: HomeAssistant, device_id: str, hidden: bool) -> bool:
    """Gerät aus- oder einblenden (Option exclude_devices); True, wenn sich etwas änderte."""
    entry = next(iter(hass.config_entries.async_entries(DOMAIN)), None)
    if entry is None:
        return False
    current = set(effective(hass)[CONF_EXCLUDE_DEVICES])
    changed = current | {device_id} if hidden else current - {device_id}
    if changed == current:
        return False
    hass.config_entries.async_update_entry(entry, options={**entry.options, CONF_EXCLUDE_DEVICES: sorted(changed)})
    return True


def _primary_entry(hass: HomeAssistant, device: dr.DeviceEntry):
    entry_id = getattr(device, "primary_config_entry", None) or next(iter(device.config_entries), None)
    return hass.config_entries.async_get_entry(entry_id) if entry_id else None


def primary_domain(hass: HomeAssistant, device: dr.DeviceEntry) -> str | None:
    """Integration, nach der Ausschlüsse und eigene Batterie-Schwellen gehen."""
    primary = _primary_entry(hass, device)
    return primary.domain if primary else None


async def async_list_devices(hass: HomeAssistant, log: Any = None) -> dict[str, Any]:
    """Alle überwachten Geräte für das Panel, dazu Integrationen, Protokoll und Serverzeit."""
    dev_reg = dr.async_get(hass)
    area_reg = ar.async_get(hass)
    now = dt_util.utcnow()
    now_ts = now.timestamp()
    started_at: datetime | None = hass.data.get(DATA_STARTED_AT)
    opts = effective(hass)
    offline_default = opts[CONF_OFFLINE_AFTER] * 60
    flaky_outages = opts[CONF_FLAKY_OUTAGES]

    raw: list[tuple[dr.DeviceEntry, list[er.RegistryEntry], list[str]]] = []
    all_domains: set[str] = set()
    hubs = hub_ids(hass)
    for device, entries in listed_devices(hass, opts):
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
        disabled = bool(device.disabled_by)
        primary = _primary_entry(hass, device)
        # "Ausgefallen nach": Gerät, Integration oder global; None = nicht überwacht.
        offline_after = device_offline_after(hass, opts, device)
        unmonitored = offline_after is None
        # Deaktiviert oder nicht überwacht: kein Status, keine Ausfälle.
        online, since = (None, None) if disabled or unmonitored else device_status(hass, entries, now, offline_after)
        if online and log is not None and (down := device_down_since(hass, entries)) is not None:
            # Unter der Schwelle, aber ausgefallen schon vor einer Lücke (z. B.
            # die ersten Minuten nach einem Neustart): der Ausfall läuft weiter.
            if log.open_outage(device.id)[0] is not None:
                online, since = False, down
        at_least = False
        if since is not None:
            since, at_least = outage_start(log, device.id, since, started_at, offline_after)
        signal, via, _source = signal_source(hass, device, entries, domains)
        if via is None and device.via_device_id and (hub := dev_reg.async_get(device.via_device_id)):
            via = hub.name_by_user or hub.name
        name = device.name_by_user or device.name or device.id
        names[device.id] = name
        avail = None
        if log is not None:
            summary = log.device_summary(device.id, 86400, now_ts)
            avail = {**(summary or {}), "strip": log.device_strip(device.id, now_ts)} if summary else None
        auto_conn = _connection(device, domains, entries, signal, iot_classes)
        manual_conn = connection_overrides(hass).get(device.id)
        # Pro Integration festgelegt (nach der primären Integration, wie die Batterie).
        integ_conn = opts[CONF_CONNECTION_INTEGRATIONS].get(primary.domain) if primary else None
        devices.append(
            {
                "id": device.id,
                "name": name,
                "area": area.name if area else None,
                # Für den Filter "Bereich" (seit 0.23.0).
                "area_id": area.id if area else None,
                # Name der Integration und eigener Name (Umbenennen im Popup, seit 1.21.0)
                "name_original": device.name,
                "name_custom": device.name_by_user,
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
                "disabled": disabled,
                # "Ausgefallen nach" der Integration auf "off": sichtbar, aber
                # ohne Status, Ausfälle, Statistik und Meldungen.
                "unmonitored": unmonitored and not disabled,
                # Wirksames "Ausgefallen nach" in Minuten (None = nicht überwacht).
                "offline_after": None if offline_after is None else offline_after // 60,
                # Einstellung des Geräts (None, "off" oder Minuten) und was ohne
                # sie gälte, mit der Integration, falls sie einen eigenen Wert hat.
                "offline_setting": device_settings(hass).get("offline", {}).get(device.id),
                "offline_default": _offline_default(opts, primary.domain if primary else None),
                # Ausfall-Meldungen ohne Einstellung des Geräts (Herkunft im Popup).
                "notify_default": _notify_default(opts, primary.domain if primary else None),
                # Beginn des Ausfalls, auch über Neustarts von HA (outage_start).
                "offline_since": since.isoformat() if since else None,
                # Beginn nicht bekannt (HA lief nicht): Dauer ist "mindestens".
                "since_at_least": at_least,
                # Von Hand vor der Integration vor der Erkennung; die Erkennung
                # bleibt für die Übersicht in den Einstellungen.
                "connection": manual_conn or integ_conn or auto_conn,
                "connection_auto": auto_conn,
                "connection_integration": integ_conn,
                "connection_manual": manual_conn is not None,
                # Angelegt in HA; Geräte aus der Zeit vor HA 2024.7 haben 1970
                # und gelten nie als neu.
                "created_at": device.created_at.isoformat() if device.created_at.timestamp() > 0 else None,
                "new": device.created_at.timestamp() > now_ts - NEW_DEVICE_DAYS * 86400,
                "signal": signal,
                # Empfang-Warnung des Geräts: None (Standard), "off" oder Schwelle.
                "signal_setting": device_settings(hass).get("signal", {}).get(device.id),
                # Was ohne Einstellung des Geräts gilt (seit 1.17.0): Wert und
                # Herkunft ("integration", "global" oder None = fester Standard).
                "signal_default": signal_default(opts, primary.domain if primary else None, manual_conn or integ_conn or auto_conn or "unknown", signal),
                "via": via,
                **_battery_fields(hass, opts, device, entries, primary.domain if primary else None),
                # Ausfall- und Online-Meldungen für dieses Gerät aus.
                "notify_off": device.id in device_settings(hass)["notify_off"],
                "notify_mute_until": _iso(notify_muted_until(hass, device.id)),
                "update": _update(hass, entries),
                "avail24": avail,
                # Instabil: online, aber oft unterbrochen.
                "flaky": bool(online and avail and avail.get("outages", 0) >= flaky_outages),
            }
        )
    result: dict[str, Any] = {
        "devices": devices,
        "integrations": {d: i["name"] for d, i in integrations.items()},
        "now": now.isoformat(),
        "offline_after": offline_default,
        # KI-Einschätzung eingeschaltet: das Popup zeigt den Knopf (seit 0.33.0).
        "ai_assessment": opts[CONF_AI_ASSESSMENT],
        "battery_low": opts[CONF_BATTERY_LOW],
        "flaky_outages": flaky_outages,
        # Chips der Verbindungsart, die das Panel nicht zeigt (gilt für alle).
        "hide_chips": opts[CONF_HIDE_CHIPS],
        "hide_connections": opts[CONF_HIDE_CONNECTIONS],
        "connection_order": opts[CONF_CONNECTION_ORDER],
        # Reihenfolge aller Chips über der Liste (seit 1.13.0), leer = Standard.
        "chip_order": opts[CONF_CHIP_ORDER],
        "pulse": None,
        "incidents": [],
        # Filter "Bereich": Bereiche und Etagen in der Reihenfolge, die man in
        # HA festlegt (Einstellungen → Bereiche, Etagen und Zonen).
        **area_catalog(hass),
    }
    if log is not None:
        # Nur die gezeigten, überwachten Geräte: ausgeschlossene und
        # deaktivierte zählen nicht mit.
        shown = {d["id"] for d in devices if not d["disabled"] and not d["unmonitored"]}
        result["pulse"] = log.pulse(now_ts, only=shown)
        domain_of = {d["id"]: (d["integration"] or {}).get("domain") for d in devices}
        result["incidents"] = [
            {
                "at": inc["at"],
                "count": len(inc["devices"]),
                "names": [names[d] for d in inc["devices"] if d in names][:6],
                # Für den Kopf mit Filter "Bereich" (seit 0.26.0): das Panel
                # zählt nur die Geräte der gewählten Bereiche.
                "devices": inc["devices"],
                # Gemeinsame Integration als Hinweis auf die Ursache.
                "integration": common if len({domain_of.get(d) for d in inc["devices"]}) == 1 and (common := domain_of.get(inc["devices"][0])) else None,
            }
            for inc in log.incidents(now_ts, only=shown)
        ]
    return result


async def async_device_facts(hass: HomeAssistant, device: dr.DeviceEntry, opts: dict[str, Any]) -> dict[str, Any]:
    """
    Angaben zu einem Gerät für Meldungen (Inhalt nach "Inhalt der Meldung"):
    Bereich, Integration, Batterie, wirksame Verbindungsart, Empfang,
    Hersteller und Modell. Werte, die gerade fehlen, sind None.
    """
    entries = er.async_entries_for_device(er.async_get(hass), device.id)
    domains = sorted({e.domain for eid in device.config_entries if (e := hass.config_entries.async_get_entry(eid))})
    info = await async_integration_info(hass, set(domains))
    signal, _via, _source = signal_source(hass, device, entries, domains)
    primary = _primary_entry(hass, device)
    auto = _connection(device, domains, entries, signal, {d: i["iot_class"] for d, i in info.items()})
    integ = opts[CONF_CONNECTION_INTEGRATIONS].get(primary.domain) if primary else None
    area = ar.async_get(hass).async_get_area(device.area_id) if device.area_id else None
    return {
        "area": area.name if area else None,
        "domain": primary.domain if primary else None,
        "integration": info.get(primary.domain, {}).get("name", primary.domain) if primary else None,
        "battery": battery(hass, entries),
        "connection": connection_overrides(hass).get(device.id) or integ or auto,
        "signal": signal,
        "model": " ".join(x for x in (device.manufacturer, device.model) if x) or None,
    }


async def async_device_detail(hass: HomeAssistant, device_id: str, log: Any = None) -> dict[str, Any] | None:
    """Für das Geräte-Popup: Entitäten mit Zustand und Lebenszeichen, Integrationen, Kurzstatistik."""
    device = dr.async_get(hass).async_get(device_id)
    if device is None:
        return None
    entries = er.async_entries_for_device(
        er.async_get(hass), device_id, include_disabled_entities=bool(device.disabled_by)
    )
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
