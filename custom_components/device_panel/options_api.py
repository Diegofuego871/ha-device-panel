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
    CONF_EXCLUDE_INTEGRATIONS,
    CONF_EXCLUDE_TYPES,
    CONF_FLAKY_OUTAGES,
    CONF_OFFLINE_AFTER,
    CONF_SHOW_DISABLED,
    CONF_SHOW_SERVICE,
    CONF_STARTUP_GRACE,
    CONF_UPDATE_CHECK,
    DEFAULT_FLAKY_OUTAGES,
    DEFAULT_OFFLINE_AFTER,
    DEFAULT_STARTUP_GRACE,
    DEFAULT_UPDATE_CHECK,
    DEVICE_TYPES,
    DOMAIN,
    INT_RANGES,
)

BOOL_OPTIONS: tuple[tuple[str, bool], ...] = (
    (CONF_SHOW_SERVICE, False),
    (CONF_SHOW_DISABLED, False),
    (CONF_UPDATE_CHECK, DEFAULT_UPDATE_CHECK),
)
INT_OPTIONS: tuple[tuple[str, int], ...] = (
    (CONF_OFFLINE_AFTER, DEFAULT_OFFLINE_AFTER),
    (CONF_FLAKY_OUTAGES, DEFAULT_FLAKY_OUTAGES),
    (CONF_STARTUP_GRACE, DEFAULT_STARTUP_GRACE),
)
LIST_OPTIONS = (CONF_EXCLUDE_INTEGRATIONS, CONF_EXCLUDE_TYPES)

_DOMAIN_RE = re.compile(r"^[a-z0-9_]+$")


def _domains(value: Any) -> list[str]:
    if not isinstance(value, list) or not all(isinstance(v, str) and _DOMAIN_RE.match(v) for v in value):
        raise vol.Invalid("Liste von Integrationen (Domains) erwartet")
    return sorted(set(value))


def _types(value: Any) -> list[str]:
    if not isinstance(value, list) or not all(v in DEVICE_TYPES for v in value):
        raise vol.Invalid("Liste von Gerätetypen erwartet")
    return sorted(set(value))


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
