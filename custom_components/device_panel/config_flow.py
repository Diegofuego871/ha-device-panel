"""Einrichtung (nur bestätigen, eine Instanz) und Optionen."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback

from .const import CONF_UPDATE_CHECK, DOMAIN, PANEL_TITLE
from .options_api import current_values


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


class OptionsFlowHandler(config_entries.OptionsFlow):
    """
    Dieselben Einstellungen wie im Panel (Zahnrad). Kein eigenes __init__:
    self.config_entry setzt das Framework.
    """

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        if user_input is not None:
            # Bestehende Options erhalten, statt sie zu ersetzen.
            return self.async_create_entry(title="", data={**self.config_entry.options, **user_input})
        values = current_values(self.config_entry)
        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({vol.Required(CONF_UPDATE_CHECK, default=values[CONF_UPDATE_CHECK]): bool}),
        )
