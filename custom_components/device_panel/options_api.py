"""
Einstellungen der Integration für Panel und Optionsdialog.

Das Panel bearbeitet dieselben Options wie der Optionsdialog von Home
Assistant, keine Kopie (wie unifi_dynamic). Standardwerte und Prüfung
stehen hier einmal und gelten für beide Oberflächen.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import re

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .ai_prompt import ai_prompt
from .const import (
    BATTERY_FIELDS,
    BATTERY_OFF,
    CONF_BATTERY_FIELDS,
    CONF_NEW_EXCLUDE,
    CONF_NEW_FIELDS,
    CONF_NEW_PERSISTENT,
    CONF_NEW_WINDOW,
    CONF_CHARGE_FULL,
    CONF_CHARGE_INTEGRATIONS,
    CONF_CHARGE_RISE,
    CONF_NOTIFY_CHARGE,
    CONF_NOTIFY_UPDATES,
    DEFAULT_CHARGE_FULL,
    DEFAULT_CHARGE_RISE,
    CONF_UPDATES_KINDS,
    CONF_UPDATES_MODE,
    CONF_UPDATES_REPEAT,
    CONF_UPDATES_TIME,
    CONF_UPDATES_WINDOW,
    DEFAULT_UPDATES_KINDS,
    DEFAULT_UPDATES_TIME,
    DEFAULT_UPDATES_WINDOW,
    UPDATE_KINDS,
    UPDATES_DAILY,
    UPDATES_MODES,
    UPDATES_REPEATS,
    CONF_NOTIFY_NEW,
    DEFAULT_NEW_FIELDS,
    DEFAULT_NEW_WINDOW,
    NEW_FIELDS,
    CONF_BATTERY_PUSH_EXCLUDE,
    DEFAULT_BATTERY_FIELDS,
    MONITOR_OFF,
    OFFLINE_INTEGRATION_RANGE,
    CLICK_PANEL,
    CLICK_TARGETS,
    CONF_BATTERY_PUSH_DAILY,
    CONF_BATTERY_PUSH_MODE,
    CONF_BATTERY_PUSH_TIME,
    CONF_NOTIFY_DELAY,
    CONF_NOTIFY_EXCLUDE,
    CONF_NOTIFY_FIELDS,
    CONF_NOTIFY_GROUP,
    CONF_NOTIFY_ONLINE,
    CONF_NOTIFY_OUTAGE,
    CONF_OUTAGE_PERSISTENT,
    CONF_PERSISTENT_EXCLUDE,
    DAILY_CONTENTS,
    DEFAULT_NOTIFY_DELAY,
    DEFAULT_NOTIFY_FIELDS,
    NOTIFY_FIELDS,
    DAILY_NEW,
    DEFAULT_BATTERY_PUSH_TIME,
    PUSH_INSTANT,
    PUSH_MODES,
    CONF_BATTERY_LOW,
    CONF_BATTERY_LOW_INTEGRATIONS,
    CONF_BATTERY_PERSISTENT,
    CONF_BATTERY_PUSH,
    CONF_EXCLUDE_DEVICES,
    CONF_EXCLUDE_INTEGRATIONS,
    CONF_EXCLUDE_TYPES,
    CONF_CONNECTION_INTEGRATIONS,
    CONF_TYPE_INTEGRATIONS,
    CONF_CHIP_ORDER,
    CONF_CONNECTION_ORDER,
    CONF_HIDE_CHIPS,
    CONF_HIDE_CONNECTIONS,
    CONNECTION_MANUAL,
    CHIP_KEYS,
    CHIP_ORDER_KEYS,
    SIGNAL_DBM_RANGE,
    SIGNAL_LQI_RANGE,
    SIGNAL_OFF,
    CHIP_ORDER_LEGACY_BLOCK,
    CONNECTION_TYPES,
    CONF_FLAKY_OUTAGES,
    CONF_NOTIFY_CLICK,
    CONF_NOTIFY_SERVICE,
    CONF_OFFLINE_AFTER,
    CONF_OFFLINE_INTEGRATIONS,
    CONF_SHOW_DISABLED,
    CONF_SHOW_SERVICE,
    CONF_SIGNAL_LOW,
    CONF_SIGNAL_LOW_INTEGRATIONS,
    CONF_STARTUP_GRACE,
    CONF_AI_ASSESSMENT,
    CONF_AI_PROMPT,
    CONF_AI_TASK,
    CONF_UPDATE_CHECK,
    DEFAULT_BATTERY_LOW,
    DEFAULT_FLAKY_OUTAGES,
    DEFAULT_OFFLINE_AFTER,
    DEFAULT_STARTUP_GRACE,
    DEFAULT_UPDATE_CHECK,
    DEVICE_TYPES,
    DOMAIN,
    INT_RANGES,
    NOTIFY_NONE,
)

BOOL_OPTIONS: tuple[tuple[str, bool], ...] = (
    (CONF_NOTIFY_OUTAGE, False),
    (CONF_NOTIFY_ONLINE, False),
    (CONF_NOTIFY_GROUP, True),
    (CONF_OUTAGE_PERSISTENT, False),
    (CONF_BATTERY_PUSH, False),
    (CONF_BATTERY_PERSISTENT, False),
    (CONF_NOTIFY_NEW, False),
    (CONF_NEW_PERSISTENT, False),
    (CONF_NOTIFY_UPDATES, False),
    (CONF_NOTIFY_CHARGE, False),
    (CONF_SHOW_SERVICE, False),
    (CONF_SHOW_DISABLED, False),
    (CONF_UPDATE_CHECK, DEFAULT_UPDATE_CHECK),
    (CONF_AI_ASSESSMENT, False),
)
INT_OPTIONS: tuple[tuple[str, int], ...] = (
    (CONF_OFFLINE_AFTER, DEFAULT_OFFLINE_AFTER),
    (CONF_FLAKY_OUTAGES, DEFAULT_FLAKY_OUTAGES),
    (CONF_STARTUP_GRACE, DEFAULT_STARTUP_GRACE),
    (CONF_BATTERY_LOW, DEFAULT_BATTERY_LOW),
    (CONF_NOTIFY_DELAY, DEFAULT_NOTIFY_DELAY),
    (CONF_NEW_WINDOW, DEFAULT_NEW_WINDOW),
    (CONF_UPDATES_WINDOW, DEFAULT_UPDATES_WINDOW),
    (CONF_CHARGE_FULL, DEFAULT_CHARGE_FULL),
    (CONF_CHARGE_RISE, DEFAULT_CHARGE_RISE),
)
LIST_OPTIONS = (CONF_EXCLUDE_INTEGRATIONS, CONF_EXCLUDE_TYPES, CONF_HIDE_CHIPS, CONF_HIDE_CONNECTIONS, CONF_CONNECTION_ORDER, CONF_CHIP_ORDER)

_DOMAIN_RE = re.compile(r"^[a-z0-9_]+$")
# Geräte-IDs von HA: Hex (uuid4().hex); etwas weiter gefasst für Tests.
_DEVICE_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_NOTIFY_RE = re.compile(r"^notify\.[a-z0-9_]+$")
_AI_TASK_RE = re.compile(r"^ai_task\.[a-z0-9_]+$")
_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def push_time(value: Any) -> str:
    """Uhrzeit "HH:MM" (Sekunden aus dem Zeitfeld von HA werden weggelassen)."""
    text = str(value or "").strip()[:5] if isinstance(value, str) else ""
    if not _TIME_RE.match(text):
        raise vol.Invalid("Uhrzeit HH:MM erwartet")
    return text


def _domains(value: Any) -> list[str]:
    if not isinstance(value, list) or not all(isinstance(v, str) and _DOMAIN_RE.match(v) for v in value):
        raise vol.Invalid("Liste von Integrationen (Domains) erwartet")
    return sorted(set(value))


def device_ids(value: Any) -> list[str]:
    """Liste von Geräte-IDs (ausgeblendete Geräte), sortiert, ohne Doppelte."""
    if not isinstance(value, list) or not all(isinstance(v, str) and _DEVICE_RE.match(v) for v in value):
        raise vol.Invalid("Liste von Geräte-IDs erwartet")
    return sorted(set(value))


def _types(value: Any) -> list[str]:
    if not isinstance(value, list) or not all(v in DEVICE_TYPES for v in value):
        raise vol.Invalid("Liste von Gerätetypen erwartet")
    return sorted(set(value))


def _connections(value: Any) -> list[str]:
    if not isinstance(value, list) or not all(v in CONNECTION_TYPES for v in value):
        raise vol.Invalid("Liste von Verbindungsarten erwartet")
    return sorted(set(value))


def _chips(value: Any) -> list[str]:
    """Ausgeblendete Filter-Chips: bekannte Schlüssel in fester Reihenfolge, ohne Doppelte."""
    if not isinstance(value, list) or not all(v in CHIP_KEYS for v in value):
        raise vol.Invalid(f"Liste von Chips erwartet ({', '.join(CHIP_KEYS)})")
    return [k for k in CHIP_KEYS if k in set(value)]


def notify_fields(value: Any) -> list[str]:
    """Inhalt der Meldung: bekannte Angaben in fester Reihenfolge."""
    if not isinstance(value, list) or not all(v in NOTIFY_FIELDS for v in value):
        raise vol.Invalid(f"Liste aus {', '.join(NOTIFY_FIELDS)} erwartet")
    return [f for f in NOTIFY_FIELDS if f in value]


def battery_fields(value: Any) -> list[str]:
    """Inhalt der Batterie-Meldung: bekannte Angaben in fester Reihenfolge."""
    if not isinstance(value, list) or not all(v in BATTERY_FIELDS for v in value):
        raise vol.Invalid(f"Liste aus {', '.join(BATTERY_FIELDS)} erwartet")
    return [f for f in BATTERY_FIELDS if f in value]


def update_kinds(value: Any) -> list[str]:
    """Arten der Update-Erinnerung: bekannte Werte in fester Reihenfolge."""
    if not isinstance(value, list) or not all(v in UPDATE_KINDS for v in value):
        raise vol.Invalid(f"Liste aus {', '.join(UPDATE_KINDS)} erwartet")
    return [k for k in UPDATE_KINDS if k in value]


def new_fields(value: Any) -> list[str]:
    """Inhalt der Meldung bei neuen Geräten: bekannte Angaben in fester Reihenfolge."""
    if not isinstance(value, list) or not all(v in NEW_FIELDS for v in value):
        raise vol.Invalid(f"Liste aus {', '.join(NEW_FIELDS)} erwartet")
    return [f for f in NEW_FIELDS if f in value]


def connection_map(value: Any) -> dict[str, str]:
    """Verbindungsart pro Integration {Domain: Art}; "unbekannt" ist keine Wahl."""
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise vol.Invalid("Zuordnung Integration → Verbindungsart erwartet")
    out: dict[str, str] = {}
    for domain, kind in value.items():
        kind = kind.strip().lower() if isinstance(kind, str) else kind
        if not isinstance(domain, str) or not _DOMAIN_RE.match(domain) or kind not in CONNECTION_MANUAL:
            raise vol.Invalid("Integration → Verbindungsart erwartet (zigbee, thread, zwave, matter, ble, wifi, ethernet, network, cloud)")
        out[domain] = kind
    return dict(sorted(out.items()))


def type_map(value: Any) -> dict[str, str]:
    """Gerätetyp pro Integration {Domain: Typ} (seit 1.25.0)."""
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise vol.Invalid("Zuordnung Integration → Gerätetyp erwartet")
    out: dict[str, str] = {}
    for domain, kind in value.items():
        kind = kind.strip().lower() if isinstance(kind, str) else kind
        if not isinstance(domain, str) or not _DOMAIN_RE.match(domain) or kind not in DEVICE_TYPES:
            raise vol.Invalid(f"Integration → Gerätetyp erwartet ({', '.join(DEVICE_TYPES)})")
        out[domain] = kind
    return dict(sorted(out.items()))


def connection_order(value: Any) -> list[str]:
    """Reihenfolge der Chips: bekannte Arten in der gegebenen Folge, ohne Doppelte."""
    if not isinstance(value, list) or not all(v in CONNECTION_TYPES for v in value):
        raise vol.Invalid("Liste von Verbindungsarten erwartet")
    return list(dict.fromkeys(value))


def _stored_chip_order(stored: Any, connection_order: list[str]) -> list[str]:
    """
    Gespeicherte Chip-Folge lesen. Der Block "connections" aus 1.13.0 wird zu
    "all" und den Verbindungsarten in ihrer eigenen Folge (connection_order);
    Verbindungsarten ohne Platz ordnet das Panel hinter der letzten ein.
    """
    out: list[str] = []
    for key in stored if isinstance(stored, list) else []:
        if key == CHIP_ORDER_LEGACY_BLOCK:
            out.extend(["all", *connection_order])
        elif key in CHIP_ORDER_KEYS:
            out.append(key)
    return list(dict.fromkeys(out))


def chip_order(value: Any) -> list[str]:
    """Reihenfolge der Chips über der Liste: bekannte Schlüssel in der gegebenen Folge, ohne Doppelte."""
    if not isinstance(value, list) or not all(v in CHIP_ORDER_KEYS for v in value):
        raise vol.Invalid(f"Liste von Chips erwartet ({', '.join(CHIP_ORDER_KEYS)})")
    return list(dict.fromkeys(value))


def _ai_task(value: Any) -> str:
    """KI-Aufgabe: ai_task-Entität oder leer (= Standard von HA)."""
    text = str(value or "").strip()
    if not text:
        return ""
    if not isinstance(value, str) or not _AI_TASK_RE.match(text):
        raise vol.Invalid("ai_task-Entität erwartet")
    return text


def _notify_target(value: Any) -> str:
    text = str(value or "").strip()
    if not text or text == NOTIFY_NONE:
        return NOTIFY_NONE
    if not isinstance(value, str) or not _NOTIFY_RE.match(text):
        raise vol.Invalid("notify-Dienst oder notify-Entität erwartet")
    return text


def battery_map(value: Any) -> dict[str, int | str]:
    """
    Eigene Batterie-Schwellen {Domain: Prozent oder "off"}; Bereich wie
    "Schwach ab", "off" schaltet die Warnung für die Integration aus.
    """
    low, high = INT_RANGES[CONF_BATTERY_LOW]
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise vol.Invalid("Zuordnung Integration → Prozent erwartet")
    out: dict[str, int | str] = {}
    for domain, pct in value.items():
        if not isinstance(domain, str) or not _DOMAIN_RE.match(domain):
            raise vol.Invalid(f"Integration → ganze Zahl von {low} bis {high} oder off erwartet")
        # YAML 1.1 (Optionsdialog) liest "off" als False.
        if pct is False or (isinstance(pct, str) and pct.strip().lower() == BATTERY_OFF):
            out[domain] = BATTERY_OFF
            continue
        number = _whole(pct)
        if number is None or not low <= number <= high:
            raise vol.Invalid(f"Integration → ganze Zahl von {low} bis {high} oder off erwartet")
        out[domain] = number
    return dict(sorted(out.items()))


def _signal_value(value: Any) -> int | str:
    """Warnschwelle für den Empfang: "off" oder Zahl (dBm negativ, LQI positiv)."""
    # YAML 1.1 (Optionsdialog) liest "off" als False.
    if value is False or (isinstance(value, str) and value.strip().lower() == SIGNAL_OFF):
        return SIGNAL_OFF
    number = _whole(value)
    ok = number is not None and (
        SIGNAL_DBM_RANGE[0] <= number <= SIGNAL_DBM_RANGE[1] or SIGNAL_LQI_RANGE[0] <= number <= SIGNAL_LQI_RANGE[1]
    )
    if not ok:
        raise vol.Invalid(
            f"off oder {SIGNAL_DBM_RANGE[0]}..{SIGNAL_DBM_RANGE[1]} dBm bzw. {SIGNAL_LQI_RANGE[0]}..{SIGNAL_LQI_RANGE[1]} LQI erwartet"
        )
    return number  # type: ignore[return-value]


def signal_map(value: Any) -> dict[str, int | str]:
    """
    Warnschwellen für den Empfang pro Funkart {Verbindungsart: Zahl oder "off"}
    (seit 1.17.0), z. B. {"wifi": -85, "zigbee": 40, "ble": "off"}.
    """
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise vol.Invalid("Zuordnung Verbindungsart → Schwelle erwartet")
    out: dict[str, int | str] = {}
    for kind, setting in value.items():
        if kind not in CONNECTION_TYPES:
            raise vol.Invalid(f"Verbindungsart aus {', '.join(CONNECTION_TYPES)} erwartet")
        out[kind] = _signal_value(setting)
    return dict(sorted(out.items()))


def signal_integrations_map(value: Any) -> dict[str, dict[str, int | str]]:
    """Wie signal_map, je Integration {Domain: {Verbindungsart: Zahl oder "off"}}; leere Einträge fallen weg."""
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise vol.Invalid("Zuordnung Integration → Verbindungsart → Schwelle erwartet")
    out: dict[str, dict[str, int | str]] = {}
    for domain, inner in value.items():
        if not isinstance(domain, str) or not _DOMAIN_RE.match(domain):
            raise vol.Invalid("Integration → Verbindungsart → Schwelle erwartet")
        if rules := signal_map(inner):
            out[domain] = rules
    return dict(sorted(out.items()))


def offline_map(value: Any) -> dict[str, int | str]:
    """
    Eigenes "Ausgefallen nach" {Domain: Minuten oder "off"}; "off" schaltet die
    Überwachung der Integration aus (Geräte bleiben sichtbar).
    """
    low, high = OFFLINE_INTEGRATION_RANGE
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise vol.Invalid("Zuordnung Integration → Minuten erwartet")
    out: dict[str, int | str] = {}
    for domain, minutes in value.items():
        if not isinstance(domain, str) or not _DOMAIN_RE.match(domain):
            raise vol.Invalid(f"Integration → ganze Zahl von {low} bis {high} oder off erwartet")
        # YAML 1.1 (Optionsdialog) liest "off" als False.
        if minutes is False or (isinstance(minutes, str) and minutes.strip().lower() == MONITOR_OFF):
            out[domain] = MONITOR_OFF
            continue
        number = _whole(minutes)
        if number is None or not low <= number <= high:
            raise vol.Invalid(f"Integration → ganze Zahl von {low} bis {high} oder off erwartet")
        out[domain] = number
    return dict(sorted(out.items()))


def _whole(value: Any) -> int | None:
    """Ganze Zahl oder None. True/False zählen nicht (bool ist in Python ein int)."""
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value != int(value):
        return None
    return int(value)


def _int_in(key: str):
    low, high = INT_RANGES[key]

    def check(value: Any) -> int:
        number = _whole(value)
        if number is None or not low <= number <= high:
            raise vol.Invalid(f"Ganze Zahl von {low} bis {high} erwartet")
        return number

    return check


# Alle Felder optional: gespeichert wird nur, was mitkommt.
PANEL_SCHEMA = vol.Schema(
    {
        **{vol.Optional(key): bool for key, _default in BOOL_OPTIONS},
        **{vol.Optional(key): _int_in(key) for key, _default in INT_OPTIONS},
        vol.Optional(CONF_EXCLUDE_INTEGRATIONS): _domains,
        vol.Optional(CONF_EXCLUDE_TYPES): _types,
        vol.Optional(CONF_EXCLUDE_DEVICES): device_ids,
        vol.Optional(CONF_NOTIFY_EXCLUDE): _domains,
        vol.Optional(CONF_PERSISTENT_EXCLUDE): _domains,
        vol.Optional(CONF_BATTERY_PUSH_EXCLUDE): _domains,
        vol.Optional(CONF_NOTIFY_FIELDS): notify_fields,
        vol.Optional(CONF_BATTERY_FIELDS): battery_fields,
        vol.Optional(CONF_NEW_FIELDS): new_fields,
        vol.Optional(CONF_NEW_EXCLUDE): _domains,
        vol.Optional(CONF_CHARGE_INTEGRATIONS): _domains,
        vol.Optional(CONF_UPDATES_KINDS): update_kinds,
        vol.Optional(CONF_UPDATES_MODE): vol.In(UPDATES_MODES),
        vol.Optional(CONF_UPDATES_TIME): push_time,
        vol.Optional(CONF_UPDATES_REPEAT): vol.In(tuple(UPDATES_REPEATS)),
        vol.Optional(CONF_HIDE_CHIPS): _chips,
        vol.Optional(CONF_HIDE_CONNECTIONS): _connections,
        vol.Optional(CONF_CONNECTION_ORDER): connection_order,
        vol.Optional(CONF_CHIP_ORDER): chip_order,
        vol.Optional(CONF_CONNECTION_INTEGRATIONS): connection_map,
        vol.Optional(CONF_TYPE_INTEGRATIONS): type_map,
        vol.Optional(CONF_BATTERY_LOW_INTEGRATIONS): battery_map,
        vol.Optional(CONF_SIGNAL_LOW): signal_map,
        vol.Optional(CONF_SIGNAL_LOW_INTEGRATIONS): signal_integrations_map,
        vol.Optional(CONF_OFFLINE_INTEGRATIONS): offline_map,
        vol.Optional(CONF_NOTIFY_SERVICE): _notify_target,
        vol.Optional(CONF_AI_TASK): _ai_task,
        vol.Optional(CONF_AI_PROMPT): ai_prompt,
        vol.Optional(CONF_NOTIFY_CLICK): vol.In(CLICK_TARGETS),
        vol.Optional(CONF_BATTERY_PUSH_MODE): vol.In(PUSH_MODES),
        vol.Optional(CONF_BATTERY_PUSH_TIME): push_time,
        vol.Optional(CONF_BATTERY_PUSH_DAILY): vol.In(DAILY_CONTENTS),
    }
)


def values_from(options: Mapping[str, Any]) -> dict[str, Any]:
    """Alle Einstellungen mit wirksamem Wert (Options, sonst Standard)."""
    values: dict[str, Any] = {key: bool(options.get(key, default)) for key, default in BOOL_OPTIONS}
    for key, default in INT_OPTIONS:
        # Ungültig gespeichert (von Hand, ältere Version): Standard statt Fehler.
        number = _whole(options.get(key))
        low, high = INT_RANGES[key]
        values[key] = number if number is not None and low <= number <= high else default
    # "Erst melden nach" nie kürzer als "Ausgefallen nach" (seit 0.34.0): ein
    # früher gespeicherter kürzerer Wert wirkte schon immer wie "Ausgefallen
    # nach" (der Push kommt frühestens, wenn das Gerät als ausgefallen gilt).
    values[CONF_NOTIFY_DELAY] = max(values[CONF_NOTIFY_DELAY], values[CONF_OFFLINE_AFTER])
    values[CONF_EXCLUDE_INTEGRATIONS] = sorted(
        {d for d in options.get(CONF_EXCLUDE_INTEGRATIONS) or [] if isinstance(d, str)}
    )
    values[CONF_EXCLUDE_TYPES] = sorted({t for t in options.get(CONF_EXCLUDE_TYPES) or [] if t in DEVICE_TYPES})
    values[CONF_EXCLUDE_DEVICES] = sorted(
        {d for d in options.get(CONF_EXCLUDE_DEVICES) or [] if isinstance(d, str) and _DEVICE_RE.match(d)}
    )
    for key in (CONF_NOTIFY_EXCLUDE, CONF_PERSISTENT_EXCLUDE, CONF_BATTERY_PUSH_EXCLUDE, CONF_NEW_EXCLUDE, CONF_CHARGE_INTEGRATIONS):
        values[key] = sorted({d for d in options.get(key) or [] if isinstance(d, str) and _DOMAIN_RE.match(d)})
    fields = options.get(CONF_NOTIFY_FIELDS)
    values[CONF_NOTIFY_FIELDS] = (
        [f for f in NOTIFY_FIELDS if f in fields] if isinstance(fields, list) else list(DEFAULT_NOTIFY_FIELDS)
    )
    fields = options.get(CONF_BATTERY_FIELDS)
    values[CONF_BATTERY_FIELDS] = (
        [f for f in BATTERY_FIELDS if f in fields] if isinstance(fields, list) else list(DEFAULT_BATTERY_FIELDS)
    )
    fields = options.get(CONF_NEW_FIELDS)
    values[CONF_NEW_FIELDS] = [f for f in NEW_FIELDS if f in fields] if isinstance(fields, list) else list(DEFAULT_NEW_FIELDS)
    values[CONF_HIDE_CHIPS] = [k for k in CHIP_KEYS if k in set(options.get(CONF_HIDE_CHIPS) or [])]
    values[CONF_HIDE_CONNECTIONS] = sorted({c for c in options.get(CONF_HIDE_CONNECTIONS) or [] if c in CONNECTION_TYPES})
    # Reihenfolge bleibt, wie gespeichert (nicht sortieren); Unbekanntes fällt weg.
    values[CONF_CONNECTION_ORDER] = list(dict.fromkeys(c for c in options.get(CONF_CONNECTION_ORDER) or [] if c in CONNECTION_TYPES))
    values[CONF_CHIP_ORDER] = _stored_chip_order(options.get(CONF_CHIP_ORDER), values[CONF_CONNECTION_ORDER])
    try:
        values[CONF_CONNECTION_INTEGRATIONS] = connection_map(options.get(CONF_CONNECTION_INTEGRATIONS))
    except vol.Invalid:
        values[CONF_CONNECTION_INTEGRATIONS] = {}
    try:
        values[CONF_TYPE_INTEGRATIONS] = type_map(options.get(CONF_TYPE_INTEGRATIONS))
    except vol.Invalid:
        # Ungültig gespeichert: lieber keine eigenen Typen als ein Fehler.
        values[CONF_TYPE_INTEGRATIONS] = {}
    try:
        values[CONF_BATTERY_LOW_INTEGRATIONS] = battery_map(options.get(CONF_BATTERY_LOW_INTEGRATIONS))
    except vol.Invalid:
        # Ungültig gespeichert: lieber keine eigenen Schwellen als ein Fehler.
        values[CONF_BATTERY_LOW_INTEGRATIONS] = {}
    try:
        values[CONF_SIGNAL_LOW] = signal_map(options.get(CONF_SIGNAL_LOW))
    except vol.Invalid:
        values[CONF_SIGNAL_LOW] = {}
    try:
        values[CONF_SIGNAL_LOW_INTEGRATIONS] = signal_integrations_map(options.get(CONF_SIGNAL_LOW_INTEGRATIONS))
    except vol.Invalid:
        values[CONF_SIGNAL_LOW_INTEGRATIONS] = {}
    try:
        values[CONF_OFFLINE_INTEGRATIONS] = offline_map(options.get(CONF_OFFLINE_INTEGRATIONS))
    except vol.Invalid:
        # Ungültig gespeichert: lieber überall der globale Wert als ein Fehler.
        values[CONF_OFFLINE_INTEGRATIONS] = {}
    target = str(options.get(CONF_NOTIFY_SERVICE) or "").strip()
    values[CONF_NOTIFY_SERVICE] = target if _NOTIFY_RE.match(target) else NOTIFY_NONE
    task = str(options.get(CONF_AI_TASK) or "").strip()
    values[CONF_AI_TASK] = task if _AI_TASK_RE.match(task) else ""
    try:
        values[CONF_AI_PROMPT] = ai_prompt(options.get(CONF_AI_PROMPT))
    except vol.Invalid:
        # Ungültig gespeichert: lieber der Standard als eine Fehlermeldung.
        values[CONF_AI_PROMPT] = ""
    click = options.get(CONF_NOTIFY_CLICK)
    values[CONF_NOTIFY_CLICK] = click if click in CLICK_TARGETS else CLICK_PANEL
    mode = options.get(CONF_BATTERY_PUSH_MODE)
    values[CONF_BATTERY_PUSH_MODE] = mode if mode in PUSH_MODES else PUSH_INSTANT
    try:
        values[CONF_BATTERY_PUSH_TIME] = push_time(options.get(CONF_BATTERY_PUSH_TIME))
    except vol.Invalid:
        values[CONF_BATTERY_PUSH_TIME] = DEFAULT_BATTERY_PUSH_TIME
    daily = options.get(CONF_BATTERY_PUSH_DAILY)
    values[CONF_BATTERY_PUSH_DAILY] = daily if daily in DAILY_CONTENTS else DAILY_NEW
    # Update-Erinnerung (seit 1.29.0)
    kinds = options.get(CONF_UPDATES_KINDS)
    values[CONF_UPDATES_KINDS] = [k for k in UPDATE_KINDS if k in kinds] if isinstance(kinds, list) else list(DEFAULT_UPDATES_KINDS)
    mode = options.get(CONF_UPDATES_MODE)
    values[CONF_UPDATES_MODE] = mode if mode in UPDATES_MODES else UPDATES_DAILY
    try:
        values[CONF_UPDATES_TIME] = push_time(options.get(CONF_UPDATES_TIME))
    except vol.Invalid:
        values[CONF_UPDATES_TIME] = DEFAULT_UPDATES_TIME
    repeat = options.get(CONF_UPDATES_REPEAT)
    values[CONF_UPDATES_REPEAT] = repeat if repeat in UPDATES_REPEATS else "never"
    return values


def current_values(entry: ConfigEntry) -> dict[str, Any]:
    return values_from(entry.options)


def effective(hass: HomeAssistant) -> dict[str, Any]:
    """Wirksame Einstellungen des (einzigen) Eintrags, ohne Eintrag die Standards."""
    entry = next(iter(hass.config_entries.async_entries(DOMAIN)), None)
    return values_from(entry.options if entry else {})


def exclusions(hass: HomeAssistant) -> tuple[set[str], set[str]]:
    """Ausgeschlossene Integrationen und Typen."""
    values = effective(hass)
    return set(values[CONF_EXCLUDE_INTEGRATIONS]), set(values[CONF_EXCLUDE_TYPES])


def notify_targets(hass: HomeAssistant, current: str) -> list[dict[str, Any]]:
    """
    Push-Ziele für Panel und Optionsdialog (wie unifi_dynamic): klassische
    notify-Dienste (auch Gruppen) und notify-Entitäten. "none" steht vorne.
    """
    targets: list[dict[str, Any]] = [{"value": NOTIFY_NONE, "kind": "none"}]
    known: set[str] = set()
    for name in sorted(hass.services.async_services_for_domain("notify")):
        # send_message ist der Dienst der Entitäten, persistent_notification
        # keine Push-Meldung.
        if name in ("send_message", "persistent_notification"):
            continue
        known.add(f"notify.{name}")
        targets.append({"value": f"notify.{name}", "kind": "service"})
    for entity_id in sorted(hass.states.async_entity_ids("notify")):
        if entity_id not in known:
            targets.append({"value": entity_id, "kind": "entity"})
    # Ein früher gewähltes Ziel, das es nicht mehr gibt, bleibt wählbar.
    if current not in {t["value"] for t in targets}:
        targets.append({"value": current, "kind": "missing"})
    return targets


def signal_default(
    opts: Mapping[str, Any], domain: str | None, connection: str | None, signal: Mapping[str, Any] | None
) -> dict[str, Any]:
    """
    Warnschwelle des Empfangs ohne Einstellung des Geräts (seit 1.17.0):
    erst die Integration, dann der globale Wert, je für die Verbindungsart des
    Geräts. value ist "off", eine Zahl oder None (fester Standard); source
    nennt, woher sie kommt. Eine Zahl gilt nur für die passende Einheit (dBm
    negativ, LQI positiv); sonst zählt die nächste Stufe.
    """
    kind = (signal or {}).get("kind")
    tables = (
        ("integration", (opts.get(CONF_SIGNAL_LOW_INTEGRATIONS) or {}).get(domain) or {} if domain else {}),
        ("global", opts.get(CONF_SIGNAL_LOW) or {}),
    )
    for source, table in tables:
        value = table.get(connection) if connection else None
        if value is None:
            continue
        if value == SIGNAL_OFF or kind is None or (value < 0) == (kind == "dbm"):
            return {"value": value, "source": source}
    return {"value": None, "source": None}


def battery_threshold(opts: Mapping[str, Any], domain: str | None) -> int | None:
    """Wirksame Schwelle für ein Gerät der Integration domain; None = Warnung aus."""
    own = opts.get(CONF_BATTERY_LOW_INTEGRATIONS) or {}
    value = own.get(domain, opts[CONF_BATTERY_LOW]) if domain else opts[CONF_BATTERY_LOW]
    return None if value == BATTERY_OFF else value


def offline_after_for(opts: Mapping[str, Any], domain: str | None) -> float | None:
    """Wirksames "Ausgefallen nach" in Sekunden für ein Gerät der Integration; None = nicht überwacht."""
    own = opts.get(CONF_OFFLINE_INTEGRATIONS) or {}
    value = own.get(domain, opts[CONF_OFFLINE_AFTER]) if domain else opts[CONF_OFFLINE_AFTER]
    return None if value == MONITOR_OFF else value * 60


def limits() -> dict[str, list[int]]:
    """Bereiche der Zahlen für die Prüfung im Panel."""
    return {key: list(INT_RANGES[key]) for key, _default in INT_OPTIONS}


def delay_too_short(options: Mapping[str, Any]) -> bool:
    """
    "Erst melden nach" kürzer als "Ausgefallen nach" (beide gespeichert, wie
    sie gespeichert würden). Ein Wert aus früheren Versionen unter dem
    Bereich (0 = sobald ausgefallen) zählt nicht: er gilt als "Ausgefallen
    nach" (values_from).
    """
    delay = _whole(options.get(CONF_NOTIFY_DELAY))
    low, _high = INT_RANGES[CONF_NOTIFY_DELAY]
    if delay is None or delay < low:
        return False
    return delay < values_from(options)[CONF_OFFLINE_AFTER]


def apply_values(hass: HomeAssistant, entry: ConfigEntry, values: dict[str, Any]) -> bool:
    """Prüft und speichert Werte aus dem Panel; True, wenn sich etwas änderte."""
    clean = PANEL_SCHEMA(values)
    options = {**entry.options, **clean}
    if (CONF_NOTIFY_DELAY in clean or CONF_OFFLINE_AFTER in clean) and delay_too_short(options):
        raise vol.Invalid("\"Erst melden nach\" darf nicht kürzer sein als \"Ausgefallen nach\"", path=[CONF_NOTIFY_DELAY])
    if options == dict(entry.options):
        return False
    hass.config_entries.async_update_entry(entry, options=options)
    return True
