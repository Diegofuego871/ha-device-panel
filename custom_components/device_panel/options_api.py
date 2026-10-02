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

from .const import (
    BATTERY_OFF,
    CLICK_PANEL,
    CLICK_TARGETS,
    CONF_BATTERY_PUSH_DAILY,
    CONF_BATTERY_PUSH_MODE,
    CONF_BATTERY_PUSH_TIME,
    CONF_NOTIFY_GROUP,
    CONF_NOTIFY_ONLINE,
    CONF_NOTIFY_OUTAGE,
    DAILY_CONTENTS,
    DAILY_NEW,
    DEFAULT_BATTERY_PUSH_TIME,
    PUSH_INSTANT,
    PUSH_MODES,
    CONF_BATTERY_LOW,
    CONF_BATTERY_LOW_INTEGRATIONS,
    CONF_BATTERY_PERSISTENT,
    CONF_BATTERY_PUSH,
    CONF_EXCLUDE_INTEGRATIONS,
    CONF_EXCLUDE_TYPES,
    CONF_CONNECTION_INTEGRATIONS,
    CONF_CONNECTION_ORDER,
    CONF_HIDE_CONNECTIONS,
    CONNECTION_MANUAL,
    CONNECTION_TYPES,
    CONF_FLAKY_OUTAGES,
    CONF_NOTIFY_CLICK,
    CONF_NOTIFY_SERVICE,
    CONF_OFFLINE_AFTER,
    CONF_SHOW_DISABLED,
    CONF_SHOW_SERVICE,
    CONF_STARTUP_GRACE,
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
    (CONF_BATTERY_PUSH, False),
    (CONF_BATTERY_PERSISTENT, False),
    (CONF_SHOW_SERVICE, False),
    (CONF_SHOW_DISABLED, False),
    (CONF_UPDATE_CHECK, DEFAULT_UPDATE_CHECK),
)
INT_OPTIONS: tuple[tuple[str, int], ...] = (
    (CONF_OFFLINE_AFTER, DEFAULT_OFFLINE_AFTER),
    (CONF_FLAKY_OUTAGES, DEFAULT_FLAKY_OUTAGES),
    (CONF_STARTUP_GRACE, DEFAULT_STARTUP_GRACE),
    (CONF_BATTERY_LOW, DEFAULT_BATTERY_LOW),
)
LIST_OPTIONS = (CONF_EXCLUDE_INTEGRATIONS, CONF_EXCLUDE_TYPES, CONF_HIDE_CONNECTIONS, CONF_CONNECTION_ORDER)

_DOMAIN_RE = re.compile(r"^[a-z0-9_]+$")
_NOTIFY_RE = re.compile(r"^notify\.[a-z0-9_]+$")
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


def _types(value: Any) -> list[str]:
    if not isinstance(value, list) or not all(v in DEVICE_TYPES for v in value):
        raise vol.Invalid("Liste von Gerätetypen erwartet")
    return sorted(set(value))


def _connections(value: Any) -> list[str]:
    if not isinstance(value, list) or not all(v in CONNECTION_TYPES for v in value):
        raise vol.Invalid("Liste von Verbindungsarten erwartet")
    return sorted(set(value))


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


def connection_order(value: Any) -> list[str]:
    """Reihenfolge der Chips: bekannte Arten in der gegebenen Folge, ohne Doppelte."""
    if not isinstance(value, list) or not all(v in CONNECTION_TYPES for v in value):
        raise vol.Invalid("Liste von Verbindungsarten erwartet")
    return list(dict.fromkeys(value))


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
        vol.Optional(CONF_HIDE_CONNECTIONS): _connections,
        vol.Optional(CONF_CONNECTION_ORDER): connection_order,
        vol.Optional(CONF_CONNECTION_INTEGRATIONS): connection_map,
        vol.Optional(CONF_BATTERY_LOW_INTEGRATIONS): battery_map,
        vol.Optional(CONF_NOTIFY_SERVICE): _notify_target,
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
    values[CONF_EXCLUDE_INTEGRATIONS] = sorted(
        {d for d in options.get(CONF_EXCLUDE_INTEGRATIONS) or [] if isinstance(d, str)}
    )
    values[CONF_EXCLUDE_TYPES] = sorted({t for t in options.get(CONF_EXCLUDE_TYPES) or [] if t in DEVICE_TYPES})
    values[CONF_HIDE_CONNECTIONS] = sorted({c for c in options.get(CONF_HIDE_CONNECTIONS) or [] if c in CONNECTION_TYPES})
    # Reihenfolge bleibt, wie gespeichert (nicht sortieren); Unbekanntes fällt weg.
    values[CONF_CONNECTION_ORDER] = list(dict.fromkeys(c for c in options.get(CONF_CONNECTION_ORDER) or [] if c in CONNECTION_TYPES))
    try:
        values[CONF_CONNECTION_INTEGRATIONS] = connection_map(options.get(CONF_CONNECTION_INTEGRATIONS))
    except vol.Invalid:
        values[CONF_CONNECTION_INTEGRATIONS] = {}
    try:
        values[CONF_BATTERY_LOW_INTEGRATIONS] = battery_map(options.get(CONF_BATTERY_LOW_INTEGRATIONS))
    except vol.Invalid:
        # Ungültig gespeichert: lieber keine eigenen Schwellen als ein Fehler.
        values[CONF_BATTERY_LOW_INTEGRATIONS] = {}
    target = str(options.get(CONF_NOTIFY_SERVICE) or "").strip()
    values[CONF_NOTIFY_SERVICE] = target if _NOTIFY_RE.match(target) else NOTIFY_NONE
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


def battery_threshold(opts: Mapping[str, Any], domain: str | None) -> int | None:
    """Wirksame Schwelle für ein Gerät der Integration domain; None = Warnung aus."""
    own = opts.get(CONF_BATTERY_LOW_INTEGRATIONS) or {}
    value = own.get(domain, opts[CONF_BATTERY_LOW]) if domain else opts[CONF_BATTERY_LOW]
    return None if value == BATTERY_OFF else value


def limits() -> dict[str, list[int]]:
    """Bereiche der Zahlen für die Prüfung im Panel."""
    return {key: list(INT_RANGES[key]) for key, _default in INT_OPTIONS}


def apply_values(hass: HomeAssistant, entry: ConfigEntry, values: dict[str, Any]) -> bool:
    """Prüft und speichert Werte aus dem Panel; True, wenn sich etwas änderte."""
    clean = PANEL_SCHEMA(values)
    options = {**entry.options, **clean}
    if options == dict(entry.options):
        return False
    hass.config_entries.async_update_entry(entry, options=options)
    return True
