"""Einrichtung: nur bestätigen, keine Angaben nötig (eine Instanz)."""

from __future__ import annotations

from typing import Any

from homeassistant import config_entries

from .const import DOMAIN, PANEL_TITLE


class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(title=PANEL_TITLE, data={})
        return self.async_show_form(step_id="user")
