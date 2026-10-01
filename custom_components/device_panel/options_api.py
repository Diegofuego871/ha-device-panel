"""
Einstellungen der Integration für Panel und Optionsdialog.

Das Panel bearbeitet dieselben Options wie der Optionsdialog von Home
Assistant, keine Kopie (wie unifi_dynamic). Standardwerte und Prüfung
stehen hier einmal und gelten für beide Oberflächen.
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import CONF_UPDATE_CHECK, DEFAULT_UPDATE_CHECK

BOOL_OPTIONS: tuple[tuple[str, bool], ...] = ((CONF_UPDATE_CHECK, DEFAULT_UPDATE_CHECK),)

# Alle Felder optional: gespeichert wird nur, was mitkommt.
PANEL_SCHEMA = vol.Schema({vol.Optional(key): bool for key, _default in BOOL_OPTIONS})


def current_values(entry: ConfigEntry) -> dict[str, Any]:
    """Alle Einstellungen mit wirksamem Wert (Options, sonst Standard)."""
    return {key: bool(entry.options.get(key, default)) for key, default in BOOL_OPTIONS}


def apply_values(hass: HomeAssistant, entry: ConfigEntry, values: dict[str, Any]) -> bool:
    """Prüft und speichert Werte aus dem Panel; True, wenn sich etwas änderte."""
    clean = PANEL_SCHEMA(values)
    options = {**entry.options, **clean}
    if options == dict(entry.options):
        return False
    hass.config_entries.async_update_entry(entry, options=options)
    return True
