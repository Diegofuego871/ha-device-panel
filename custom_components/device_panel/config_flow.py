"""Einrichtung (nur bestätigen, eine Instanz) und Optionen."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
)

from .const import (
    CONF_EXCLUDE_INTEGRATIONS,
    CONF_EXCLUDE_TYPES,
    CONF_FLAKY_OUTAGES,
    CONF_OFFLINE_AFTER,
    CONF_SHOW_DISABLED,
    CONF_SHOW_SERVICE,
    CONF_STARTUP_GRACE,
    CONF_UPDATE_CHECK,
    DEVICE_TYPES,
    DOMAIN,
    INT_RANGES,
    PANEL_TITLE,
)
from .options_api import INT_OPTIONS, current_values

# Einheit der Zahlenfelder im Optionsdialog.
_UNITS = {CONF_OFFLINE_AFTER: "min", CONF_STARTUP_GRACE: "min"}


class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(title=PANEL_TITLE, data={})
        return self.async_show_form(step_id="user")

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry) -> OptionsFlowHandler:
        return OptionsFlowHandler()


def _number(key: str) -> NumberSelector:
    low, high = INT_RANGES[key]
    config = NumberSelectorConfig(min=low, max=high, step=1, mode=NumberSelectorMode.BOX)
    # Ohne Einheit das Feld weglassen: None lehnt die Prüfung des Selektors ab.
    if key in _UNITS:
        config["unit_of_measurement"] = _UNITS[key]
    return NumberSelector(config)


class OptionsFlowHandler(config_entries.OptionsFlow):
    """
    Dieselben Einstellungen wie im Panel (Zahnrad), in derselben Reihenfolge.
    Kein eigenes __init__: self.config_entry setzt das Framework.
    """

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        if user_input is not None:
            # Bestehende Options erhalten, statt sie zu ersetzen. Leere
            # Mehrfachauswahl muss die alte überschreiben.
            data = {**self.config_entry.options, **user_input}
            for key in (CONF_EXCLUDE_INTEGRATIONS, CONF_EXCLUDE_TYPES):
                data[key] = sorted(set(user_input.get(key) or []))
            # Das Zahlenfeld liefert Kommazahlen (2.0); gespeichert wird wie
            # aus dem Panel eine ganze Zahl.
            for key, _default in INT_OPTIONS:
                if key in user_input:
                    data[key] = int(user_input[key])
            return self.async_create_entry(title="", data=data)
        # Spät importiert: devices importiert options_api, das hier schon geladen ist.
        from .devices import async_catalog  # noqa: PLC0415

        values = current_values(self.config_entry)
        catalog = await async_catalog(self.hass)
        integrations = [{"value": i["domain"], "label": f"{i['name']} ({i['devices']})"} for i in catalog["integrations"]]
        # Ausgeschlossene Integration ohne Geräte bleibt wählbar.
        known = {i["value"] for i in integrations}
        integrations += [{"value": d, "label": d} for d in values[CONF_EXCLUDE_INTEGRATIONS] if d not in known]
        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_OFFLINE_AFTER, default=values[CONF_OFFLINE_AFTER]): _number(CONF_OFFLINE_AFTER),
                    vol.Required(CONF_FLAKY_OUTAGES, default=values[CONF_FLAKY_OUTAGES]): _number(CONF_FLAKY_OUTAGES),
                    vol.Required(CONF_STARTUP_GRACE, default=values[CONF_STARTUP_GRACE]): _number(CONF_STARTUP_GRACE),
                    vol.Optional(CONF_EXCLUDE_INTEGRATIONS, default=values[CONF_EXCLUDE_INTEGRATIONS]): SelectSelector(
                        SelectSelectorConfig(options=integrations, multiple=True, mode=SelectSelectorMode.DROPDOWN)
                    ),
                    vol.Optional(CONF_EXCLUDE_TYPES, default=values[CONF_EXCLUDE_TYPES]): SelectSelector(
                        SelectSelectorConfig(
                            options=list(DEVICE_TYPES), multiple=True, mode=SelectSelectorMode.DROPDOWN, translation_key="device_type"
                        )
                    ),
                    vol.Required(CONF_SHOW_SERVICE, default=values[CONF_SHOW_SERVICE]): bool,
                    vol.Required(CONF_SHOW_DISABLED, default=values[CONF_SHOW_DISABLED]): bool,
                    vol.Required(CONF_UPDATE_CHECK, default=values[CONF_UPDATE_CHECK]): bool,
                }
            ),
        )
