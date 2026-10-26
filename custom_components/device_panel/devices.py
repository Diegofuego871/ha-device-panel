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

from . import activity
from .battery_history import async_last_known, battery_entity
from .compat import device_entry_ids, device_primary_entry_id, registry_devices
from .const import (
    CONF_AI_ASSESSMENT,
    CONF_AI_TASK,
    CONF_BATTERY_LOW,
    CONF_BATTERY_LOW_INTEGRATIONS,
    CONF_BATTERY_PUSH,
    CONF_BATTERY_PUSH_EXCLUDE,
    CONF_CHARGE_FULL,
    CONF_CHARGE_FULL_INTEGRATIONS,
    CONF_CHARGE_INTEGRATIONS,
    CONF_CHARGE_RISE,
    CONF_CHARGE_RISE_INTEGRATIONS,
    CONF_CHARGE_STALL,
    CONF_CHARGE_STALL_INTEGRATIONS,
    CONF_CHARGE_STOP_INTEGRATIONS,
    CONF_CHARGE_LIVE,
    CONF_CHARGE_LIVE_INTEGRATIONS,
    CONF_NOTIFY_CHARGE_STOP,
    CONF_NOTIFY_CHARGE,
    CONF_EXCLUDE_INTEGRATIONS,
    CONF_EXCLUDE_TYPES,
    CONF_WIZARD_STATE,
    CONF_CHIP_ORDER,
    CONF_CONNECTION_ORDER,
    CONF_CONNECTION_INTEGRATIONS,
    CONF_HIDE_CHIPS,
    CONF_HIDE_CONNECTIONS,
    CONNECTION_MANUAL,
    DATA_BLE_BEST,
    DATA_SIGNAL,
    DATA_BLE_STAMPS,
    DATA_CONNECTION_OVERRIDES,
    CONF_FLAKY_OUTAGES,
    CONF_NOTIFY_DELAY,
    CONF_NOTIFY_DELAY_INTEGRATIONS,
    CONF_OFFLINE_AFTER,
    CONF_OFFLINE_INTEGRATIONS,
    CONF_NOTIFY_EXCLUDE,
    CONF_NOTIFY_ONLINE,
    CONF_NOTIFY_OUTAGE,
    CONF_OUTAGE_PERSISTENT,
    CONF_PERSISTENT_EXCLUDE,
    MONITOR_NOSTATUS,
    MONITOR_OFF,
    NOTIFY_NONE,
    OFFLINE_INTEGRATION_RANGE,
    CONF_SHOW_DISABLED,
    CONF_SHOW_SERVICE,
    BATTERY_OFF,
    DATA_DEVICE_SETTINGS,
    DATA_CHARGE,
    DATA_STARTED_AT,
    DATA_STATUS,
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
    SIGNAL_WEAK_DBM,
    SIGNAL_WEAK_LQI,
    NEW_DEVICE_DAYS,
    CONF_EXCLUDE_DEVICES,
    CONF_TYPE_INTEGRATIONS,
)
from .labels import strip_address
from .scope import configured_labels, first, is_label_key, label_list, listed, lowest, off_wins, pick, scope_of, strictest_time
from .options_api import battery_threshold, effective, notify_delay_for, notify_target, offline_after_for, signal_default, status_off_for

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


def live_status(
    hass: HomeAssistant,
    entries: list[er.RegistryEntry],
    now: datetime,
    offline_after: float,
    log: Any = None,
    device_id: str = "",
) -> tuple[bool | None, datetime | None]:
    """
    device_status mit der Regel der Liste: Unter der Schwelle, aber ausgefallen
    schon vor einer Lücke im Protokoll (z. B. die ersten Minuten nach einem
    Neustart), läuft der Ausfall weiter.
    """
    online, since = device_status(hass, entries, now, offline_after)
    if online and log is not None and (down := device_down_since(hass, entries)) is not None:
        if log.open_outage(device_id)[0] is not None:
            return False, down
    return online, since


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
    hass: HomeAssistant, device: dr.DeviceEntry, entries: list[er.RegistryEntry], domains: list[str] | set[str], smooth: bool = True
) -> tuple[dict[str, Any] | None, str | None, str | None]:
    """
    (Empfang, Empfänger, Quelle) wie in der Liste: ZHA vor dem Sensor,
    Bluetooth (seit 2.41.2) vor dem Sensor des Geräts. Quelle ist die Entität
    des Sensors oder "zha" bzw. "ble" (Wert direkt aus der Integration, ohne
    Verlauf im Recorder; signal_history zeichnet ihn selbst auf).
    Mit smooth (seit 2.111.0) gilt für Geräte mit eigener Aufzeichnung der Median der letzten Minuten statt des Einzelwerts
    (SignalLog.steady); die Aufzeichnung selbst liest den Rohwert (smooth=False), sonst glättete sie doppelt.
    """
    signal, source = _signal_entity(hass, entries)
    via = None
    if "zha" in domains and (zha := _zha_signal(hass, device.id)):
        signal, source = zha, "zha"
    ble = next((c[1] for c in device.connections if c[0] == dr.CONNECTION_BLUETOOTH), None)
    if ble:
        # Wert und Empfänger aus derselben Quelle: Der Sensor des Geräts (zum Beispiel SwitchBot "Bluetooth-Signal") liest den Scanner,
        # der das Gerät steuern kann, nicht den besten Empfang; das widerspräche dem angezeigten Empfänger. Der Sensor bleibt Ersatz,
        # wenn Bluetooth gerade nichts meldet.
        live, via = _ble_signal(hass, ble)
        if live:
            signal, source = live, "ble"
    if smooth and signal and signal.get("value") is not None and (log := hass.data.get(DATA_SIGNAL)) is not None:
        signal = log.steady(device.id, signal)
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


# Bluetooth-Empfang (seit 2.108.0): der stärkste Empfänger, nicht der, den Home Assistant gerade führt. HA behält die zuletzt gewählte
# Quelle, bis eine neue deutlich stärker ist (oder die alte veraltet): Das Gerät steht oft auf einem schwächeren Proxy, und beim Wechsel
# springt der Wert. Alle Adapter und Proxys hören aber gleichzeitig mit; async_scanner_devices_by_address liefert ihre letzte Meldung.
BLE_WINDOW_S = 60.0  # nur Empfänger, deren letzte Meldung höchstens so viel älter ist als die frischeste (selten sendende Geräte)
BLE_KEEP_DB = 2  # der bisherige Empfänger bleibt, solange er höchstens so viel schwächer ist wie der stärkste (Rauschen, kein Hin und Her)
_BLE_RSSI_MIN = -127  # "kein Wert" in HA
BLE_STAMPS_TTL_S = 5.0


def _ble_stamps(hass: HomeAssistant, scanner: Any, now: float) -> dict[str, float]:
    """
    Zeitpunkte der letzten Meldung je Adresse bei einem Empfänger. HA baut dieses Wörterbuch bei jedem Zugriff neu (alle Adressen des
    Empfängers); bei vielen Geräten und Empfängern wäre das je Abfrage zu teuer, darum höchstens alle BLE_STAMPS_TTL_S Sekunden.
    """
    cache: dict[str, tuple[Any, float, dict[str, float]]] = hass.data.setdefault(DATA_BLE_STAMPS, {})
    hit = cache.get(str(scanner.source))
    if hit is not None and hit[0] is scanner and now - hit[1] < BLE_STAMPS_TTL_S:
        return hit[2]
    stamps = dict(getattr(scanner, "discovered_device_timestamps", None) or {})
    cache[str(scanner.source)] = (scanner, now, stamps)
    return stamps


def _ble_seen(hass: HomeAssistant, address: str) -> list[tuple[float, int, str, str]]:
    """
    Die letzte Meldung jedes Empfängers (Adapter oder Proxy) zu einem Gerät: (Alter in Sekunden, RSSI, Quelle, Name). Ungültige Werte
    (kein Wert, 0 dBm, über 0) fallen weg: 0 wäre sonst der "stärkste" Wert und würde einen Empfänger ohne Messung wählen. Leer: nie
    gehört, Bluetooth nicht bereit oder die Schnittstelle fehlt.
    """
    if "bluetooth" not in hass.config.components:
        return []
    try:
        from homeassistant.components import bluetooth  # noqa: PLC0415

        now = time.monotonic()
        seen: list[tuple[float, int, str, str]] = []
        for item in bluetooth.async_scanner_devices_by_address(hass, address, connectable=False):
            rssi = getattr(item.advertisement, "rssi", None)
            if not isinstance(rssi, (int, float)) or not _BLE_RSSI_MIN < rssi < 0:
                continue
            stamp = _ble_stamps(hass, item.scanner, now).get(address)
            age = max(0.0, now - stamp) if isinstance(stamp, (int, float)) else 0.0
            source = str(item.scanner.source)
            seen.append((age, int(rssi), source, str(getattr(item.scanner, "name", None) or source)))
        return seen
    except Exception:  # noqa: BLE001 - interne Schnittstelle von HA
        return []


def _ble_pick(hass: HomeAssistant, address: str, seen: list[tuple[float, int, str, str]]) -> tuple[float, int, str, str]:
    """Der gezählte Empfänger unter den Meldungen von _ble_seen: stärkster unter den frischen, der bisherige bleibt bei BLE_KEEP_DB."""
    freshest = min(a for a, *_ in seen)
    fresh = [x for x in seen if x[0] - freshest <= BLE_WINDOW_S]
    best = max(fresh, key=lambda x: (x[1], -x[0]))
    memory: dict[str, str] = hass.data.setdefault(DATA_BLE_BEST, {})
    kept = next((x for x in fresh if x[2] == memory.get(address)), None)
    if kept is not None and kept[1] >= best[1] - BLE_KEEP_DB:
        best = kept
    memory[address] = best[2]
    return best


def _ble_best(hass: HomeAssistant, address: str) -> tuple[int, str, str] | None:
    """
    (RSSI, Quelle, Name) des Empfängers mit dem stärksten Wert unter allen, die das Gerät kürzlich gehört haben. Der bisherige Empfänger
    bleibt, solange er höchstens BLE_KEEP_DB schwächer ist (stabiler Name im Verlauf, Wert und Empfänger stammen immer aus derselben
    Meldung). Fehlt eine Einzelsicht, gilt wie bisher die Meldung, die Home Assistant führt. None: nie gehört oder Bluetooth nicht bereit.
    """
    if "bluetooth" not in hass.config.components:
        return None
    if seen := _ble_seen(hass, address):
        best = _ble_pick(hass, address, seen)
        return best[1], best[2], best[3]
    try:
        from homeassistant.components import bluetooth  # noqa: PLC0415

        info = bluetooth.async_last_service_info(hass, address, connectable=False)
        if info is None or not info.source:
            return None
        scanner = bluetooth.async_scanner_by_source(hass, info.source)
        return info.rssi, str(info.source), str(getattr(scanner, "name", None) or info.source)
    except Exception:  # noqa: BLE001 - interne Schnittstelle von HA
        return None


def ble_listeners(hass: HomeAssistant, device: dr.DeviceEntry) -> list[dict[str, Any]]:
    """
    Wer das Bluetooth-Gerät gerade hört (seit 2.109.0, für das Empfangs-Fenster): je Empfänger Name, RSSI und Alter der letzten Meldung in
    Sekunden, der stärkste zuerst; "used" markiert den Empfänger, dessen Wert der angezeigte Empfang ist. Leer ohne Bluetooth-Adresse
    oder ohne Einzelsicht.
    """
    address = next((c[1] for c in device.connections if c[0] == dr.CONNECTION_BLUETOOTH), None)
    seen = _ble_seen(hass, address) if address else []
    if not seen:
        return []
    used = _ble_pick(hass, address, seen)[2]
    rows = sorted(seen, key=lambda x: (-x[1], x[0]))
    return [{"name": strip_address(name), "rssi": rssi, "age": round(age), "used": source == used} for age, rssi, source, name in rows]


def _ble_signal(hass: HomeAssistant, address: str) -> tuple[dict[str, Any] | None, str | None]:
    """RSSI des stärksten Empfängers (Adapter oder Proxy) und dessen Name aus der Bluetooth-Integration."""
    best = _ble_best(hass, address)
    if best is None:
        return None, None
    return {"kind": "dbm", "value": best[0]}, strip_address(best[2])


def ble_receiver(hass: HomeAssistant, device: dr.DeviceEntry) -> tuple[str, str] | None:
    """
    (Quelle, Name) des Empfängers, über den ein Bluetooth-Gerät gerade am stärksten gehört wird (Adapter oder Proxy); die Quelle (Adresse)
    ist stabil, der Name ist der Anzeigename. None: unbekannt (noch nie empfangen, Bluetooth nicht geladen). Seit 2.40.0 für den Verlauf.
    """
    address = next((c[1] for c in device.connections if c[0] == dr.CONNECTION_BLUETOOTH), None)
    best = _ble_best(hass, address) if address else None
    return (best[1], best[2]) if best else None


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
            # Glaubwürdiger Stand (seit 2.43.0): ein unmöglich schneller Abfall (Messfehler) gilt erst nach Bestätigung
            from .battery_guard import get as battery_guard  # noqa: PLC0415

            value = battery_guard(hass).level(entry.entity_id, state)
            if value is None:
                value = _number(state)
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
    source, own = pick(opts[CONF_OFFLINE_INTEGRATIONS], domain, strictest_time)
    return {
        "minutes": own if own is not None else opts[CONF_OFFLINE_AFTER],
        # Woher der Wert kommt: die Integration (Domain) oder ein Label ("label:<ID>", seit 2.155.0)
        "integration": source if own is not None else None,
        "global": opts[CONF_OFFLINE_AFTER],
    }


def _notify_delay_default(opts: dict[str, Any], domain: str | None) -> dict[str, Any]:
    """"Erst melden nach" ohne Einstellung des Geräts (seit 2.91.0): Minuten, dazu die Integration mit eigenem Wert."""
    source, own = pick(opts[CONF_NOTIFY_DELAY_INTEGRATIONS], domain, strictest_time)
    return {
        "minutes": own if own is not None else opts[CONF_NOTIFY_DELAY],
        "integration": source if own is not None else None,
        "global": opts[CONF_NOTIFY_DELAY],
    }


def _notify_default(opts: dict[str, Any], domain: str | None) -> dict[str, Any]:
    """
    Push und anhaltende Benachrichtigung bei Ausfall für Geräte der Integration
    (Optionen, ohne Einstellung des Geräts); "integration" nennt sie, wenn sie
    von den globalen Schaltern abweicht.
    """
    push_on = notify_target(opts, "outage") != NOTIFY_NONE and (opts[CONF_NOTIFY_OUTAGE] or opts[CONF_NOTIFY_ONLINE])
    ex_push = listed(opts[CONF_NOTIFY_EXCLUDE], domain)
    ex_pers = listed(opts[CONF_PERSISTENT_EXCLUDE], domain)
    return {
        "push": bool(push_on) and not ex_push,
        "persistent": bool(opts[CONF_OUTAGE_PERSISTENT]) and not ex_pers,
        "integration": ex_push or ex_pers or None,
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
    own_source, own = pick(opts[CONF_BATTERY_LOW_INTEGRATIONS], domain, lowest)
    # Push bei schwacher Batterie: global an und nicht für die Integration (oder ein Label) aus
    # (seit 0.34.0); "push_integration" nennt sie, wenn sie ihn ausschaltet.
    push_off = listed(opts[CONF_BATTERY_PUSH_EXCLUDE], domain)
    return {
        # Warnung aus: Stand ja, "schwach" nie.
        "battery": {**info, "low": False} if info and threshold is None else info,
        "has_battery": has_battery(hass, entries),
        "battery_setting": device_settings(hass)["battery"].get(device.id),
        "battery_default": {
            "pct": own if own is not None else opts[CONF_BATTERY_LOW],
            "integration": own_source if own is not None else None,
            "push": bool(opts[CONF_BATTERY_PUSH]) and notify_target(opts, "battery") != NOTIFY_NONE and not push_off,
            "push_integration": push_off,
        },
    }


def _in_range(value: Any, key: str) -> bool:
    """Ganze Zahl (kein bool) im erlaubten Bereich der Option."""
    low, high = INT_RANGES[key]
    return isinstance(value, int) and not isinstance(value, bool) and low <= value <= high


def charge_values(opts: dict[str, Any], domain: str | None) -> tuple[int, int, str | None, str | None]:
    """
    "Voll ab" und Anstieg ohne Wahl am Gerät: die der Integration, sonst die globalen. Dazu je die
    Integration, wenn der Wert von ihr kommt (für die Herkunft im Popup).
    """
    full_source, full = pick(opts.get(CONF_CHARGE_FULL_INTEGRATIONS), domain, first)
    rise_source, rise = pick(opts.get(CONF_CHARGE_RISE_INTEGRATIONS), domain, first)
    return (
        opts[CONF_CHARGE_FULL] if full is None else full,
        opts[CONF_CHARGE_RISE] if rise is None else rise,
        full_source if full is not None else None,
        rise_source if rise is not None else None,
    )


def charge_stop_values(opts: dict[str, Any], domain: str | None) -> tuple[int, bool, str | None, str | None]:
    """
    "Ladung beendet nach" (Minuten) und Push bei beendeter Ladung ohne Wahl am Gerät: die der Integration, sonst die
    globalen (seit 1.41.0). Dazu je die Integration, wenn der Wert von ihr kommt (für die Herkunft im Popup).
    """
    stall_source, stall = pick(opts.get(CONF_CHARGE_STALL_INTEGRATIONS), domain, first)
    stop_source, stop = pick(opts.get(CONF_CHARGE_STOP_INTEGRATIONS), domain, off_wins)
    return (
        opts[CONF_CHARGE_STALL] if stall is None else stall,
        bool(opts[CONF_NOTIFY_CHARGE_STOP]) if stop is None else stop,
        stall_source if stall is not None else None,
        stop_source if stop is not None else None,
    )


def charge_live_value(opts: dict[str, Any], domain: str | None) -> tuple[bool, str | None]:
    """Live-Aktivität beim Laden ohne Wahl am Gerät: die der Integration, sonst die globale (seit 2.19.0), dazu die Integration."""
    source, own = pick(opts.get(CONF_CHARGE_LIVE_INTEGRATIONS), domain, off_wins)
    return (bool(opts[CONF_CHARGE_LIVE]) if own is None else own, source if own is not None else None)


def device_charge_opts(hass: HomeAssistant, opts: dict[str, Any], device_id: str) -> dict[str, Any]:
    """
    Optionen mit "Voll ab", Anstieg, "Ladung beendet nach" und Push bei beendeter Ladung des Geräts: Gerät, sonst
    Integration, sonst global (Lademeldung und "lädt gerade").
    """
    settings = device_settings(hass)
    device = dr.async_get(hass).async_get(device_id)
    domain = primary_domain(hass, device) if device else None
    full, rise, _fi, _ri = charge_values(opts, domain)
    stall, stop, _si, _pi = charge_stop_values(opts, domain)
    live, _li = charge_live_value(opts, domain)
    return {
        **opts,
        CONF_CHARGE_FULL: settings.get("charge_full", {}).get(device_id, full),
        CONF_CHARGE_RISE: settings.get("charge_rise", {}).get(device_id, rise),
        CONF_CHARGE_STALL: settings.get("charge_stall", {}).get(device_id, stall),
        CONF_NOTIFY_CHARGE_STOP: settings.get("charge_stop", {}).get(device_id, stop),
        CONF_CHARGE_LIVE: settings.get("charge_live", {}).get(device_id, live),
    }


def _charging(hass: HomeAssistant, opts: dict[str, Any], device: dr.DeviceEntry, entries: list[er.RegistryEntry], now: float) -> dict[str, Any] | None:
    """Lädt das Gerät gerade? {level, from, since (ISO), source} oder None (Beobachter: charge.ChargeNotifier)."""
    watcher = hass.data.get(DATA_CHARGE)
    if watcher is None:
        return None
    info = watcher.charging_of(device, entries, now, opts)
    if info is None:
        return None
    return {**info, "level": None if info["level"] is None else round(info["level"]), "from": None if info["from"] is None else round(info["from"]), "since": _iso(info["since"])}


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
    for device in registry_devices(dr.async_get(hass)):
        # Das eigene Dienst-Gerät (Entitäten der Integration, seit 2.122.0) gehört nicht in die Liste: sonst zählten die Sensoren sich selbst
        # Kennungen können mehr als zwei Teile haben (zum Beispiel Shelly): nur der erste, die Integration, zählt
        if any(ident[0] == DOMAIN for ident in device.identifiers):
            continue
        if device.entry_type == dr.DeviceEntryType.SERVICE and not service:
            continue
        if device.disabled_by and not disabled:
            continue
        entries = er.async_entries_for_device(ent_reg, device.id, include_disabled_entities=bool(device.disabled_by))
        if entries:
            yield device, entries


def hub_ids(hass: HomeAssistant) -> set[str]:
    """Geräte, über die andere Geräte verbunden sind (Hub, Bridge, Koordinator)."""
    return {d.via_device_id for d in registry_devices(dr.async_get(hass)) if d.via_device_id}


def _shown(
    hass: HomeAssistant, opts: dict[str, Any], disabled: bool, unmonitored: bool = True, status: bool = True
) -> Iterator[tuple[dr.DeviceEntry, list[er.RegistryEntry]]]:
    """
    Kandidaten nach "Anzeige", ohne ausgeschlossene Integrationen (primärer
    Eintrag), Typen und einzeln ausgeblendete Geräte. Geräte mit
    "Ausgefallen nach" = "off" (Nicht überwachen, am Gerät oder an der
    Integration) fehlen nur ohne unmonitored; Geräte "Ohne Online-Status" (seit 2.156.0) fehlen nur ohne status.
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
        if not status and device_status_off(hass, opts, device):
            continue
        if ex_types and effective_type(hass, device, entries, hubs, opts[CONF_TYPE_INTEGRATIONS])[0] in ex_types:
            continue
        yield device, entries


def monitored_devices(
    hass: HomeAssistant, opts: dict[str, Any] | None = None
) -> Iterator[tuple[dr.DeviceEntry, list[er.RegistryEntry]]]:
    """Geräte, die Batterie, Laden und Empfang überwachen: gezeigt, nicht deaktiviert und nicht auf "Nicht überwachen"."""
    yield from _shown(hass, opts or effective(hass), disabled=False, unmonitored=False)


def status_devices(
    hass: HomeAssistant, opts: dict[str, Any] | None = None
) -> Iterator[tuple[dr.DeviceEntry, list[er.RegistryEntry]]]:
    """Geräte mit Online-Status (Verfügbarkeitsprotokoll, Ausfälle, Meldungen): wie monitored_devices, ohne die "Ohne Online-Status" (seit 2.156.0)."""
    yield from _shown(hass, opts or effective(hass), disabled=False, unmonitored=False, status=False)


def shown_devices(
    hass: HomeAssistant, opts: dict[str, Any] | None = None
) -> Iterator[tuple[dr.DeviceEntry, list[er.RegistryEntry]]]:
    """Gezeigte, nicht deaktivierte Geräte, auch die auf "Nicht überwachen" (neue Geräte, seit 1.24.0)."""
    yield from _shown(hass, opts or effective(hass), disabled=False)


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


def integration_type_source(hass: HomeAssistant, device: dr.DeviceEntry, integ: dict[str, str] | None = None) -> tuple[str | None, str | None]:
    """(Schlüssel, Typ), den ein Label oder die Integration des Geräts festlegt (Label seit 2.155.0), sonst (None, None)."""
    own = integ if integ is not None else effective(hass)[CONF_TYPE_INTEGRATIONS]
    if not own or not (domain := primary_domain(hass, device)):
        return None, None
    source, kind = pick(own, scope_of(hass, device, domain), first)
    return (source, kind) if kind in DEVICE_TYPES else (None, None)


def integration_type(hass: HomeAssistant, device: dr.DeviceEntry, integ: dict[str, str] | None = None) -> str | None:
    """Typ, den die Integration (oder ein Label) des Geräts festlegt (seit 1.25.0), sonst None."""
    return integration_type_source(hass, device, integ)[1]


def effective_type(
    hass: HomeAssistant,
    device: dr.DeviceEntry,
    entries: list[er.RegistryEntry],
    hubs: set[str],
    integ: dict[str, str] | None = None,
) -> tuple[str, str]:
    """
    (gültiger Typ, erkannter Typ): ein von Hand am Gerät gesetzter Typ hat
    Vorrang, dann der Typ der Integration (integ: {Domain: Typ}, ohne Angabe aus
    den Optionen), sonst die Erkennung.
    """
    auto = device_type(hass, device, entries, hubs)
    manual = type_overrides(hass).get(device.id)
    if manual in DEVICE_TYPES:
        return manual, auto
    return (integration_type(hass, device, integ) or auto), auto


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
            # "Erst melden nach" des Geräts: ganze Minuten (seit 2.91.0).
            "notify_delay": {str(k): v for k, v in (stored.get("notify_delay") or {}).items() if valid_notify_delay_setting(v)},
            # Lademeldung des Geräts: True/False, ohne Eintrag gilt die Integration (seit 1.30.0).
            "charge": {str(k): v for k, v in (stored.get("charge") or {}).items() if isinstance(v, bool)},
            # Eigenes "Voll ab" und eigener Anstieg des Geräts für die Lademeldung (seit 1.35.0).
            "charge_full": {str(k): v for k, v in (stored.get("charge_full") or {}).items() if _in_range(v, CONF_CHARGE_FULL)},
            "charge_rise": {str(k): v for k, v in (stored.get("charge_rise") or {}).items() if _in_range(v, CONF_CHARGE_RISE)},
            # Eigenes "Ladung beendet nach" und eigener Push bei beendeter Ladung des Geräts (seit 1.41.0).
            "charge_stall": {str(k): v for k, v in (stored.get("charge_stall") or {}).items() if _in_range(v, CONF_CHARGE_STALL)},
            "charge_stop": {str(k): v for k, v in (stored.get("charge_stop") or {}).items() if isinstance(v, bool)},
            # Live-Aktivität beim Laden des Geräts: True/False, ohne Eintrag gilt die Integration (seit 2.19.0).
            "charge_live": {str(k): v for k, v in (stored.get("charge_live") or {}).items() if isinstance(v, bool)},
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
    if settings.get("notify_delay"):
        data["notify_delay"] = dict(settings["notify_delay"])
    if settings.get("charge"):
        data["charge"] = dict(settings["charge"])
    for key in ("charge_full", "charge_rise", "charge_stall", "charge_stop", "charge_live"):
        if settings.get(key):
            data[key] = dict(settings[key])
    await _types_store(hass).async_save(data)


@callback
def device_settings(hass: HomeAssistant) -> dict[str, Any]:
    """
    {"battery": {Gerät: Prozent | "off"}, "notify_off": {Gerät, …},
    "notify_mute": {Gerät: bis}, "signal": {Gerät: Schwelle | "off"},
    "offline": {Gerät: Minuten | "off"}, "charge": {Gerät: bool}}.
    """
    return hass.data.get(DATA_DEVICE_SETTINGS) or {"battery": {}, "notify_off": set(), "notify_mute": {}, "signal": {}, "offline": {}, "notify_delay": {}, "charge": {}, "charge_full": {}, "charge_rise": {}, "charge_stall": {}, "charge_stop": {}, "charge_live": {}}


def signal_limit(d: dict[str, Any]) -> Any:
    """Wirksame Empfang-Warnung (seit 1.17.0): das Gerät, sonst die Integration oder der globale Wert."""
    own = d.get("signal_setting")
    return own if own is not None else (d.get("signal_default") or {}).get("value")


def signal_weak(signal: dict[str, Any], setting: Any) -> bool:
    """
    Schwacher Empfang wie im Panel (devSigLevel; seit 2.120.0 hier, für die KI und das Geräteprotokoll): Empfang-Warnung "off" ist nie
    schwach, eine eigene Schwelle heisst "schwach unter X", sonst der Standard.
    """
    value = signal["value"]
    if setting == SIGNAL_OFF:
        return False
    if isinstance(setting, int) and not isinstance(setting, bool):
        return value < setting
    return value < SIGNAL_WEAK_DBM if signal.get("kind") == "dbm" else value <= SIGNAL_WEAK_LQI


def valid_signal_setting(value: Any) -> bool:
    """Empfang-Warnung: "off" oder ganze Zahl im Bereich für dBm oder LQI."""
    if value == SIGNAL_OFF:
        return True
    if not isinstance(value, int) or isinstance(value, bool):
        return False
    return SIGNAL_DBM_RANGE[0] <= value <= SIGNAL_DBM_RANGE[1] or SIGNAL_LQI_RANGE[0] <= value <= SIGNAL_LQI_RANGE[1]


def valid_offline_setting(value: Any) -> bool:
    """"Ausgefallen nach" des Geräts: "off" (nicht überwachen), "nostatus" (ohne Online-Status, seit 2.156.0) oder ganze Minuten im Bereich der Integrationen."""
    if value in (MONITOR_OFF, MONITOR_NOSTATUS):
        return True
    low, high = OFFLINE_INTEGRATION_RANGE
    return isinstance(value, int) and not isinstance(value, bool) and low <= value <= high


def valid_notify_delay_setting(value: Any) -> bool:
    """"Erst melden nach" des Geräts (seit 2.91.0): ganze Minuten im Bereich der Integrationen."""
    low, high = OFFLINE_INTEGRATION_RANGE
    return isinstance(value, int) and not isinstance(value, bool) and low <= value <= high


def device_notify_delay(hass: HomeAssistant, opts: dict[str, Any], device: dr.DeviceEntry) -> int:
    """
    Wirksames "Erst melden nach" eines Geräts in Minuten (seit 2.91.0): eigenes des Geräts, sonst das der Integration, sonst das globale;
    nie kürzer als sein wirksames "Ausgefallen nach".
    """
    own = device_settings(hass).get("notify_delay", {}).get(device.id)
    return notify_delay_for(opts, primary_domain(hass, device), own, device_offline_after(hass, opts, device))


async def async_notify_delay_error(hass: HomeAssistant, device_id: str, changes: dict[str, Any]) -> str | None:
    """
    Fehlertext, wenn das eigene "Erst melden nach" des Geräts nach den Änderungen kürzer wäre als sein wirksames "Ausgefallen nach" (seit 2.91.0);
    sonst None. Ohne eigenen Wert gilt zur Laufzeit der längere (notify_delay_for), das ist kein Fehler.
    """
    if "notify_delay" not in changes and "offline" not in changes:
        return None
    await async_load_type_overrides(hass)
    settings = device_settings(hass)
    own = changes["notify_delay"] if "notify_delay" in changes else settings.get("notify_delay", {}).get(device_id)
    if own is None:
        return None
    offline = changes["offline"] if "offline" in changes else settings.get("offline", {}).get(device_id)
    if offline in (MONITOR_OFF, MONITOR_NOSTATUS):
        return None
    if isinstance(offline, int):
        offline_seconds: float | None = offline * 60
    else:
        device = dr.async_get(hass).async_get(device_id)
        offline_seconds = offline_after_for(effective(hass), primary_domain(hass, device) if device else None)
    if offline_seconds is not None and own * 60 < offline_seconds:
        return "\"Erst melden nach\" darf nicht kürzer sein als \"Ausgefallen nach\""
    return None


def device_offline_after(hass: HomeAssistant, opts: dict[str, Any], device: dr.DeviceEntry) -> float | None:
    """
    Wirksames "Ausgefallen nach" eines Geräts in Sekunden: eigenes des Geräts,
    sonst das der Integration, sonst das globale; None = nicht überwacht. Das
    Gerät geht vor, auch gegen "Nicht überwachen" der Integration.
    """
    own = device_settings(hass).get("offline", {}).get(device.id)
    if own == MONITOR_OFF:
        return None
    if own == MONITOR_NOSTATUS:
        return opts[CONF_OFFLINE_AFTER] * 60
    if isinstance(own, int):
        return own * 60
    return offline_after_for(opts, primary_domain(hass, device))


def device_status_off(hass: HomeAssistant, opts: dict[str, Any], device: dr.DeviceEntry) -> bool:
    """
    Gilt für das Gerät "Ohne Online-Status" (seit 2.156.0): eigene Wahl des Geräts, sonst Label vor Integration vor global. Das Gerät geht vor,
    auch gegen "Ohne Online-Status" des Labels oder der Integration (eine eigene Zeit schaltet den Status wieder ein).
    """
    own = device_settings(hass).get("offline", {}).get(device.id)
    if own is not None:
        return own == MONITOR_NOSTATUS
    return status_off_for(opts, primary_domain(hass, device))


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
    offline=None (Integration bzw. global), "off" oder Minuten;
    notify_delay=None (Integration bzw. global) oder Minuten "Erst melden nach" (seit 2.91.0);
    charge=None (Integration), True/False (Lademeldung, seit 1.30.0);
    charge_full / charge_rise / charge_stall=None (Integration bzw. global) oder eigener Wert (seit 1.35.0, charge_stall seit 1.41.0);
    charge_stop=None (Integration bzw. global), True/False (Push bei beendeter Ladung, seit 1.41.0);
    charge_live=None (Integration bzw. global), True/False (Live-Aktivität beim Laden, seit 2.19.0).
    """
    await async_load_type_overrides(hass)
    settings = hass.data[DATA_DEVICE_SETTINGS]
    if "offline" in changes:
        if changes["offline"] is None:
            settings.setdefault("offline", {}).pop(device_id, None)
        else:
            settings.setdefault("offline", {})[device_id] = changes["offline"]
    if "notify_delay" in changes:
        if changes["notify_delay"] is None:
            settings.setdefault("notify_delay", {}).pop(device_id, None)
        else:
            settings.setdefault("notify_delay", {})[device_id] = changes["notify_delay"]
    if "charge" in changes:
        if changes["charge"] is None:
            settings.setdefault("charge", {}).pop(device_id, None)
        else:
            settings.setdefault("charge", {})[device_id] = bool(changes["charge"])
    for key in ("charge_full", "charge_rise", "charge_stall"):
        if key in changes:
            if changes[key] is None:
                settings.setdefault(key, {}).pop(device_id, None)
            else:
                settings.setdefault(key, {})[device_id] = int(changes[key])
    if "charge_live" in changes:
        if changes["charge_live"] is None:
            settings.setdefault("charge_live", {}).pop(device_id, None)
        else:
            settings.setdefault("charge_live", {})[device_id] = bool(changes["charge_live"])
    if "charge_stop" in changes:
        if changes["charge_stop"] is None:
            settings.setdefault("charge_stop", {}).pop(device_id, None)
        else:
            settings.setdefault("charge_stop", {})[device_id] = bool(changes["charge_stop"])
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


# Eigene Werte der Lademeldung eines Geräts (Schlüssel in device_settings) und ihre Kurznamen für die Übersicht
CHARGE_SETTING_KEYS = {"charge": "on", "charge_full": "full", "charge_rise": "rise", "charge_stall": "stall", "charge_stop": "stop", "charge_live": "live"}


async def async_reset_device_settings(
    hass: HomeAssistant,
    battery: list[str],
    notify: list[str],
    connection: list[str] | None = None,
    signal: list[str] | None = None,
    offline: list[str] | None = None,
    charge: list[str] | None = None,
    notify_delay: list[str] | None = None,
) -> dict[str, int]:
    """
    Einstellungen mehrerer Geräte auf den globalen Wert zurück (Einstellungen,
    "Alle zurücksetzen" oder einzeln); die Verbindungsart von Hand zurück auf
    Integration bzw. Erkennung; "charge" nimmt alle eigenen Werte der Lademeldung
    eines Geräts zurück (seit 2.78.0). Nur die genannten Geräte: ein Wert, der
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
    delays = settings.setdefault("notify_delay", {})
    done_delay = sum(1 for dev in set(notify_delay or []) if delays.pop(dev, None) is not None)
    done_charge = 0
    for dev in set(charge or []):
        # Ein Gerät zählt einmal, auch wenn mehrere seiner Lade-Werte wegfallen
        if sum(settings.setdefault(key, {}).pop(dev, None) is not None for key in CHARGE_SETTING_KEYS):
            done_charge += 1
    if done_battery or done_notify or done_conn or done_signal or done_offline or done_delay or done_charge:
        await _async_save_devices(hass)
    return {
        "battery": done_battery,
        "notify": done_notify,
        "connection": done_conn,
        "signal": done_signal,
        "offline": done_offline,
        "notify_delay": done_delay,
        "charge": done_charge,
    }


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
    notify_delay = settings.get("notify_delay", {})
    charge_devs = {dev for key in CHARGE_SETTING_KEYS for dev in settings.get(key, {})}
    for dev in {*settings["battery"], *settings["notify_off"], *conns, *signal, *offline, *notify_delay, *charge_devs}:
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
        # "Erst melden nach" des Geräts (seit 2.91.0): Minuten.
        "notify_delay": sorted(({**items[dev], "value": value} for dev, value in notify_delay.items() if dev in items), key=by_name),
        # Lademeldung des Geräts (seit 2.78.0): alle eigenen Werte (an/aus, voll ab, Anstieg, Ende, Push bei Ende, Live)
        "charge": sorted(
            (
                {**items[dev], "value": {short: settings[key][dev] for key, short in CHARGE_SETTING_KEYS.items() if dev in settings.get(key, {})}}
                for dev in charge_devs
                if dev in items
            ),
            key=by_name,
        ),
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
    # Warum fehlen Geräte einer gezeigten Integration (seit 2.132.0): je Integration die Zahl der Geräte, die ein ausgeblendeter Typ oder
    # eine einzelne Ausblendung verbirgt; sonst sieht man in den Einstellungen nur "3 Geräte" und in der Liste keines davon
    ex_devices = set(opts[CONF_EXCLUDE_DEVICES])
    ex_types = set(opts[CONF_EXCLUDE_TYPES])
    ex_domains = set(opts[CONF_EXCLUDE_INTEGRATIONS])
    hidden_by_type: dict[str, dict[str, int]] = {}
    hidden_by_device: dict[str, int] = {}
    label_counts: dict[str, int] = {}
    for device, entries in candidate_devices(hass, service=opts[CONF_SHOW_SERVICE], disabled=opts[CONF_SHOW_DISABLED]):
        primary = _primary_entry(hass, device)
        for label_id in getattr(device, "labels", None) or ():
            label_counts[label_id] = label_counts.get(label_id, 0) + 1
        if primary:
            by_domain[primary.domain] = by_domain.get(primary.domain, 0) + 1
        kind = effective_type(hass, device, entries, hubs, opts[CONF_TYPE_INTEGRATIONS])[0]
        by_type[kind] = by_type.get(kind, 0) + 1
        if primary and primary.domain not in ex_domains:
            if device.id in ex_devices:
                hidden_by_device[primary.domain] = hidden_by_device.get(primary.domain, 0) + 1
            elif kind in ex_types:
                types = hidden_by_type.setdefault(primary.domain, {})
                types[kind] = types.get(kind, 0) + 1
    # Eigene Batterie-Schwelle: Integrationen mit Batteriegeräten unter den
    # überwachten Geräten (Ausblendungen gelten), dazu solche mit eigener
    # Schwelle ohne Geräte (damit sie sich zurücksetzen lässt).
    own = opts[CONF_BATTERY_LOW_INTEGRATIONS]
    # Schwellen von Labels ("label:<ID>") stehen in derselben Zuordnung, gehören aber nicht in die Liste der Integrationen
    bat: dict[str, dict[str, Any]] = {d: {"devices": 0, "weakest": None} for d in own if not is_label_key(d)}
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
    integrations = [
        {"domain": d, "name": name(d), "devices": n, "hidden_by_type": hidden_by_type.get(d, {}), "hidden_by_device": hidden_by_device.get(d, 0)}
        for d, n in by_domain.items()
    ]
    integrations.sort(key=lambda x: (-x["devices"], str(x["name"]).lower()))
    battery_list = [{"domain": d, "name": name(d), **v} for d, v in bat.items()]
    battery_list.sort(key=lambda x: (-x["devices"], str(x["name"]).lower()))
    from .ai_assessment import ai_ready  # noqa: PLC0415 - ai_assessment braucht devices

    return {
        "integrations": integrations,
        "types": [{"type": t, "devices": by_type.get(t, 0)} for t in DEVICE_TYPES],
        "battery": battery_list,
        # Labels von Home Assistant mit Zahl der Geräte (seit 2.155.0), dazu die eingerichteten
        "labels": label_list(hass, label_counts, keep=configured_labels(hass)),
        "hidden_devices": await async_hidden_devices(hass, opts),
        # KI-Aufgaben von Home Assistant zur Auswahl (Einstellungen, "KI-Einschätzung").
        "ai_tasks": sorted(
            ({"value": s.entity_id, "name": s.name} for s in hass.states.async_all("ai_task")), key=lambda x: str(x["name"]).lower()
        ),
        # Lässt sich die KI-Einschätzung einschalten? Nur mit einer KI-Aufgabe (seit 2.38.0, siehe ai_assessment.ai_ready).
        "ai_ready": ai_ready(hass, opts.get(CONF_AI_TASK)),
    }


def _label_counts(devices: list[dict[str, Any]]) -> dict[str, int]:
    """Geräte je Label unter den gezeigten Geräten."""
    counts: dict[str, int] = {}
    for dev in devices:
        for label_id in dev["labels"]:
            counts[label_id] = counts.get(label_id, 0) + 1
    return counts


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
            "type": effective_type(hass, device, entries, hubs, opts[CONF_TYPE_INTEGRATIONS])[0],
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
    entry_id = device_primary_entry_id(device)
    return hass.config_entries.async_get_entry(entry_id) if entry_id else None


def primary_domain(hass: HomeAssistant, device: dr.DeviceEntry) -> str | None:
    """
    Integration, nach der Ausschlüsse und eigene Batterie-Schwellen gehen. Trägt das Gerät eingerichtete Labels, ist es ein Scope (ein String
    mit der Domain und den Schlüsseln der Labels, seit 2.155.0): die Auflösung der Einstellungen schaut zuerst auf die Labels.
    """
    primary = _primary_entry(hass, device)
    return scope_of(hass, device, primary.domain) if primary else None


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
            {e.domain for eid in device_entry_ids(device) if (e := hass.config_entries.async_get_entry(eid))}
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
        scope = primary_domain(hass, device)
        # "Ausgefallen nach": Gerät, Label, Integration oder global; None = nicht überwacht.
        offline_after = device_offline_after(hass, opts, device)
        unmonitored = offline_after is None
        # Ohne Online-Status (seit 2.156.0): überwacht (Batterie, Laden, Empfang), aber ohne Status und Ausfälle
        no_status = not disabled and not unmonitored and device_status_off(hass, opts, device)
        # Deaktiviert, nicht überwacht oder ohne Online-Status: kein Status, keine Ausfälle.
        online, since = (None, None) if disabled or unmonitored or no_status else live_status(hass, entries, now, offline_after, log, device.id)
        at_least = False
        if since is not None:
            since, at_least = outage_start(log, device.id, since, started_at, offline_after)
        signal, via, _source = signal_source(hass, device, entries, domains)
        if via is None and device.via_device_id and (hub := dev_reg.async_get(device.via_device_id)):
            via = hub.name_by_user or hub.name
        name = device.name_by_user or device.name or device.id
        names[device.id] = name
        avail = None
        if log is not None and not no_status:
            summary = log.device_summary(device.id, 86400, now_ts)
            avail = {**(summary or {}), "strip": log.device_strip(device.id, now_ts), "down": log.down_now(device.id, now_ts) or online is False} if summary else None
        bat_fields = _battery_fields(hass, opts, device, entries, scope)
        # Ausgefallen: der Sensor meldet "nicht verfügbar", die Batterie fehlt. Dann der letzte Stand vor dem Ausfall, nur zur Anzeige
        # (keine Warnung, kein Push daraus).
        battery_last = None
        if online is False and bat_fields["battery"] is None and bat_fields["has_battery"] and (bat_entity := battery_entity(hass, entries)):
            battery_last = await async_last_known(hass, bat_entity, now_ts)
        auto_conn = _connection(device, domains, entries, signal, iot_classes)
        manual_conn = connection_overrides(hass).get(device.id)
        # Pro Integration festgelegt (nach der primären Integration, wie die Batterie).
        integ_conn_source, integ_conn = pick(opts[CONF_CONNECTION_INTEGRATIONS], scope, first)
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
                # Labels des Geräts (IDs, seit 2.155.0), für den Filter und die Einstellungen pro Label
                "labels": sorted(getattr(device, "labels", None) or ()),
                **dict(zip(("type", "type_auto"), effective_type(hass, device, entries, hubs, opts[CONF_TYPE_INTEGRATIONS]))),
                "type_manual": device.id in type_overrides(hass),
                # Typ der Integration (seit 1.25.0), wenn dort einer festgelegt ist.
                "type_integration": integration_type(hass, device, opts[CONF_TYPE_INTEGRATIONS]),
                # Woher: Domain der Integration oder "label:<ID>" (seit 2.155.0)
                "type_integration_source": integration_type_source(hass, device, opts[CONF_TYPE_INTEGRATIONS])[0],
                "entities": len(entries),
                "online": online,
                "disabled": disabled,
                # "Ausgefallen nach" der Integration auf "off": sichtbar, aber
                # ohne Status, Ausfälle, Statistik und Meldungen.
                "unmonitored": unmonitored and not disabled,
                # Wirksames "Ausgefallen nach" in Minuten (None = nicht überwacht).
                "offline_after": None if offline_after is None or no_status else offline_after // 60,
                "no_status": no_status,
                # Einstellung des Geräts (None, "off" oder Minuten) und was ohne
                # sie gälte, mit der Integration, falls sie einen eigenen Wert hat.
                "offline_setting": device_settings(hass).get("offline", {}).get(device.id),
                "offline_default": _offline_default(opts, scope),
                # "Erst melden nach" (seit 2.91.0): wirksam in Minuten (nie kürzer als "Ausgefallen nach"), Einstellung des Geräts, ohne sie.
                "notify_delay": notify_delay_for(opts, scope, device_settings(hass).get("notify_delay", {}).get(device.id), offline_after),
                "notify_delay_setting": device_settings(hass).get("notify_delay", {}).get(device.id),
                "notify_delay_default": _notify_delay_default(opts, scope),
                # Ausfall-Meldungen ohne Einstellung des Geräts (Herkunft im Popup).
                "notify_default": _notify_default(opts, scope),
                # Beginn des Ausfalls, auch über Neustarts von HA (outage_start).
                "offline_since": since.isoformat() if since else None,
                # Beginn nicht bekannt (HA lief nicht): Dauer ist "mindestens".
                "since_at_least": at_least,
                # Von Hand vor der Integration vor der Erkennung; die Erkennung
                # bleibt für die Übersicht in den Einstellungen.
                "connection": manual_conn or integ_conn or auto_conn,
                "connection_auto": auto_conn,
                "connection_integration": integ_conn,
                "connection_integration_source": integ_conn_source if integ_conn else None,
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
                "signal_default": signal_default(opts, scope, manual_conn or integ_conn or auto_conn or "unknown", signal),
                "via": via,
                **bat_fields,
                "battery_last": battery_last,
                # Ausfall- und Online-Meldungen für dieses Gerät aus.
                "notify_off": device.id in device_settings(hass)["notify_off"],
                # Lademeldung (seit 1.30.0): am Gerät (None = Integration) und was ohne Wahl gilt.
                "charge_setting": device_settings(hass).get("charge", {}).get(device.id),
                # Eigenes "Voll ab" und eigener Anstieg (None = global, seit 1.35.0).
                "charge_full_setting": device_settings(hass).get("charge_full", {}).get(device.id),
                "charge_rise_setting": device_settings(hass).get("charge_rise", {}).get(device.id),
                "charge_stall_setting": device_settings(hass).get("charge_stall", {}).get(device.id),
                "charge_stop_setting": device_settings(hass).get("charge_stop", {}).get(device.id),
                "charge_live_setting": device_settings(hass).get("charge_live", {}).get(device.id),
                "charge_default": {
                    # Ohne Wahl am Gerät: Wert der Integration, sonst global (full_integration/rise_integration nennen sie).
                    **dict(zip(("full", "rise", "full_integration", "rise_integration"), charge_values(opts, scope))),
                    **dict(zip(("stall", "stop", "stall_integration", "stop_integration"), charge_stop_values(opts, scope))),
                    **dict(zip(("live", "live_integration"), charge_live_value(opts, scope))),
                    "on": bool(opts[CONF_NOTIFY_CHARGE]) and bool(listed(opts[CONF_CHARGE_INTEGRATIONS], scope)),
                    "integration": listed(opts[CONF_CHARGE_INTEGRATIONS], scope),
                },
                "notify_mute_until": _iso(notify_muted_until(hass, device.id)),
                # Lädt gerade (seit 1.35.0): Ladeanzeige des Geräts oder Anstieg des Stands.
                "charging": _charging(hass, opts, device, entries, now_ts),
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
        # Für die Kopfzeile (seit 2.62.0): Debug-Modus und Störungen der Status-App, damit Punkte am Launcher oder an der angehefteten App stehen
        "debug": activity.get(hass).debug,
        # Einrichtungsassistent (seit 2.135.0): Zustand für das Fenster, die Kachel und den Punkt im Launcher
        "wizard": opts[CONF_WIZARD_STATE],
        "status": status_watch.summary() if (status_watch := hass.data.get(DATA_STATUS)) is not None else {"problems": 0, "down": 0},
        # Filter "Bereich": Bereiche und Etagen in der Reihenfolge, die man in
        # HA festlegt (Einstellungen → Bereiche, Etagen und Zonen).
        **area_catalog(hass),
        # Filter "Label" (seit 2.155.0): Labels, die mindestens ein gezeigtes Gerät trägt
        "labels": label_list(hass, _label_counts(devices)),
        # Eingerichtete Labels in der Reihenfolge des Benutzers (für die Herkunft im Popup)
        "label_order": configured_labels(hass),
    }
    if log is not None:
        # Nur die gezeigten, überwachten Geräte: ausgeschlossene und
        # deaktivierte zählen nicht mit.
        shown = {d["id"] for d in devices if not d["disabled"] and not d["unmonitored"] and not d["no_status"]}
        result["pulse"] = log.pulse(now_ts, only=shown, down_now={d["id"] for d in devices if d["id"] in shown and d["online"] is False})
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
    domains = sorted({e.domain for eid in device_entry_ids(device) if (e := hass.config_entries.async_get_entry(eid))})
    info = await async_integration_info(hass, set(domains))
    signal, _via, _source = signal_source(hass, device, entries, domains)
    primary = _primary_entry(hass, device)
    auto = _connection(device, domains, entries, signal, {d: i["iot_class"] for d, i in info.items()})
    integ = pick(opts[CONF_CONNECTION_INTEGRATIONS], primary_domain(hass, device), first)[1]
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
    entry_ids = device_entry_ids(device)
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
        "identifiers": sorted(f"{i[0]}: {i[1]}" for i in device.identifiers if len(i) >= 2)[:4],
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
