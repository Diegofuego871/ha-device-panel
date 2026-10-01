"""
Einstellungen der Integration für Panel und Optionsdialog.

Das Panel bearbeitet dieselben Options wie der Optionsdialog von Home
Assistant, keine Kopie (wie unifi_dynamic). Standardwerte und Prüfung
stehen hier einmal und gelten für beide Oberflächen.
"""

from __future__ import annotations

from typing import Any

import re

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import (
    CONF_EXCLUDE_INTEGRATIONS,
    CONF_EXCLUDE_TYPES,
    CONF_UPDATE_CHECK,
    DEFAULT_UPDATE_CHECK,
    DEVICE_TYPES,
    DOMAIN,
)

BOOL_OPTIONS: tuple[tuple[str, bool], ...] = ((CONF_UPDATE_CHECK, DEFAULT_UPDATE_CHECK),)
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


# Alle Felder optional: gespeichert wird nur, was mitkommt.
PANEL_SCHEMA = vol.Schema(
    {
        **{vol.Optional(key): bool for key, _default in BOOL_OPTIONS},
        vol.Optional(CONF_EXCLUDE_INTEGRATIONS): _domains,
        vol.Optional(CONF_EXCLUDE_TYPES): _types,
    }
)


def current_values(entry: ConfigEntry) -> dict[str, Any]:
    """Alle Einstellungen mit wirksamem Wert (Options, sonst Standard)."""
    values: dict[str, Any] = {key: bool(entry.options.get(key, default)) for key, default in BOOL_OPTIONS}
    values[CONF_EXCLUDE_INTEGRATIONS] = sorted(
        {d for d in entry.options.get(CONF_EXCLUDE_INTEGRATIONS) or [] if isinstance(d, str)}
    )
    values[CONF_EXCLUDE_TYPES] = sorted({t for t in entry.options.get(CONF_EXCLUDE_TYPES) or [] if t in DEVICE_TYPES})
    return values


def exclusions(hass: HomeAssistant) -> tuple[set[str], set[str]]:
    """Ausgeschlossene Integrationen und Typen des (einzigen) Eintrags."""
    entry = next(iter(hass.config_entries.async_entries(DOMAIN)), None)
    if entry is None:
        return set(), set()
    values = current_values(entry)
    return set(values[CONF_EXCLUDE_INTEGRATIONS]), set(values[CONF_EXCLUDE_TYPES])


def apply_values(hass: HomeAssistant, entry: ConfigEntry, values: dict[str, Any]) -> bool:
    """Prüft und speichert Werte aus dem Panel; True, wenn sich etwas änderte."""
    clean = PANEL_SCHEMA(values)
    options = {**entry.options, **clean}
    if options == dict(entry.options):
        return False
    hass.config_entries.async_update_entry(entry, options=options)
    return True
