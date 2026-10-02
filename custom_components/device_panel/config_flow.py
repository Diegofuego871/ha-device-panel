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
    ObjectSelector,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
    TimeSelector,
)

from .const import (
    CLICK_TARGETS,
    CONF_BATTERY_PUSH_DAILY,
    CONF_BATTERY_PUSH_MODE,
    CONF_BATTERY_PUSH_TIME,
    CONF_NOTIFY_GROUP,
    CONF_NOTIFY_ONLINE,
    CONF_NOTIFY_OUTAGE,
    DAILY_CONTENTS,
    PUSH_MODES,
    CONF_BATTERY_LOW,
    CONF_BATTERY_LOW_INTEGRATIONS,
    CONF_BATTERY_PERSISTENT,
    CONF_BATTERY_PUSH,
    CONF_EXCLUDE_INTEGRATIONS,
    CONF_EXCLUDE_TYPES,
    CONF_FLAKY_OUTAGES,
    CONF_HIDE_CONNECTIONS,
    CONNECTION_TYPES,
    CONF_NOTIFY_CLICK,
    CONF_NOTIFY_SERVICE,
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
from .options_api import INT_OPTIONS, battery_map, current_values, notify_targets, push_time
from .push import text

# Einheit der Zahlenfelder im Optionsdialog.
_UNITS = {CONF_OFFLINE_AFTER: "min", CONF_STARTUP_GRACE: "min", CONF_BATTERY_LOW: "%"}


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
        errors: dict[str, str] = {}
        values = current_values(self.config_entry)
        if user_input is not None:
            try:
                own = battery_map(user_input.get(CONF_BATTERY_LOW_INTEGRATIONS))
            except vol.Invalid:
                own = None
                errors[CONF_BATTERY_LOW_INTEGRATIONS] = "battery_map"
            if not errors:
                # Bestehende Options erhalten, statt sie zu ersetzen. Leere
                # Mehrfachauswahl muss die alte überschreiben.
                data = {**self.config_entry.options, **user_input, CONF_BATTERY_LOW_INTEGRATIONS: own}
                for key in (CONF_EXCLUDE_INTEGRATIONS, CONF_EXCLUDE_TYPES, CONF_HIDE_CONNECTIONS):
                    data[key] = sorted(set(user_input.get(key) or []))
                # Das Zahlenfeld liefert Kommazahlen (2.0); gespeichert wird wie
                # aus dem Panel eine ganze Zahl.
                for key, _default in INT_OPTIONS:
                    if key in user_input:
                        data[key] = int(user_input[key])
                # Zeitfeld liefert "HH:MM:SS"; gespeichert wird "HH:MM" wie im Panel.
                if CONF_BATTERY_PUSH_TIME in user_input:
                    data[CONF_BATTERY_PUSH_TIME] = push_time(user_input[CONF_BATTERY_PUSH_TIME])
                return self.async_create_entry(title="", data=data)
            # Fehler: die Eingaben bleiben stehen.
            values = {**values, **user_input}
        # Spät importiert: devices importiert options_api, das hier schon geladen ist.
        from .devices import async_catalog  # noqa: PLC0415

        catalog = await async_catalog(self.hass)
        integrations = [{"value": i["domain"], "label": f"{i['name']} ({i['devices']})"} for i in catalog["integrations"]]
        # Ausgeschlossene Integration ohne Geräte bleibt wählbar.
        known = {i["value"] for i in integrations}
        integrations += [{"value": d, "label": d} for d in values[CONF_EXCLUDE_INTEGRATIONS] if d not in known]
        # Push-Ziele mit Beschriftung in der Sprache der Instanz.
        labels = {
            "none": lambda t: text(self.hass, "notify_none"),
            "service": lambda t: t["value"],
            "entity": lambda t: text(self.hass, "notify_entity", entity_id=t["value"]),
            "missing": lambda t: text(self.hass, "notify_missing", value=t["value"]),
        }
        targets = [{"value": t["value"], "label": labels[t["kind"]](t)} for t in notify_targets(self.hass, values[CONF_NOTIFY_SERVICE])]
        # Integrationen mit Batteriegeräten als Hinweis zum Feld (Domain = Schlüssel).
        battery_domains = ", ".join(f"{b['domain']} ({b['name']})" for b in catalog.get("battery", [])) or "–"
        return self.async_show_form(
            step_id="init",
            errors=errors,
            description_placeholders={"battery_domains": battery_domains},
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_OFFLINE_AFTER, default=values[CONF_OFFLINE_AFTER]): _number(CONF_OFFLINE_AFTER),
                    vol.Required(CONF_FLAKY_OUTAGES, default=values[CONF_FLAKY_OUTAGES]): _number(CONF_FLAKY_OUTAGES),
                    vol.Required(CONF_STARTUP_GRACE, default=values[CONF_STARTUP_GRACE]): _number(CONF_STARTUP_GRACE),
                    vol.Required(CONF_BATTERY_LOW, default=values[CONF_BATTERY_LOW]): _number(CONF_BATTERY_LOW),
                    # Eigene Schwelle pro Integration als Zuordnung, z. B. "zha: 25".
                    vol.Optional(CONF_BATTERY_LOW_INTEGRATIONS, default=values[CONF_BATTERY_LOW_INTEGRATIONS] or {}): ObjectSelector(),
                    vol.Required(CONF_BATTERY_PUSH, default=values[CONF_BATTERY_PUSH]): bool,
                    vol.Required(CONF_BATTERY_PUSH_MODE, default=values[CONF_BATTERY_PUSH_MODE]): SelectSelector(
                        SelectSelectorConfig(options=list(PUSH_MODES), mode=SelectSelectorMode.DROPDOWN, translation_key="battery_push_mode")
                    ),
                    vol.Required(CONF_BATTERY_PUSH_TIME, default=values[CONF_BATTERY_PUSH_TIME]): TimeSelector(),
                    vol.Required(CONF_BATTERY_PUSH_DAILY, default=values[CONF_BATTERY_PUSH_DAILY]): SelectSelector(
                        SelectSelectorConfig(options=list(DAILY_CONTENTS), mode=SelectSelectorMode.DROPDOWN, translation_key="battery_push_daily")
                    ),
                    vol.Required(CONF_BATTERY_PERSISTENT, default=values[CONF_BATTERY_PERSISTENT]): bool,
                    vol.Optional(CONF_EXCLUDE_INTEGRATIONS, default=values[CONF_EXCLUDE_INTEGRATIONS]): SelectSelector(
                        SelectSelectorConfig(options=integrations, multiple=True, mode=SelectSelectorMode.DROPDOWN)
                    ),
                    vol.Optional(CONF_EXCLUDE_TYPES, default=values[CONF_EXCLUDE_TYPES]): SelectSelector(
                        SelectSelectorConfig(
                            options=list(DEVICE_TYPES), multiple=True, mode=SelectSelectorMode.DROPDOWN, translation_key="device_type"
                        )
                    ),
                    vol.Required(CONF_NOTIFY_SERVICE, default=values[CONF_NOTIFY_SERVICE]): SelectSelector(
                        SelectSelectorConfig(options=targets, mode=SelectSelectorMode.DROPDOWN)
                    ),
                    vol.Required(CONF_NOTIFY_CLICK, default=values[CONF_NOTIFY_CLICK]): SelectSelector(
                        SelectSelectorConfig(options=list(CLICK_TARGETS), mode=SelectSelectorMode.DROPDOWN, translation_key="click_target")
                    ),
                    vol.Required(CONF_NOTIFY_OUTAGE, default=values[CONF_NOTIFY_OUTAGE]): bool,
                    vol.Required(CONF_NOTIFY_ONLINE, default=values[CONF_NOTIFY_ONLINE]): bool,
                    vol.Required(CONF_NOTIFY_GROUP, default=values[CONF_NOTIFY_GROUP]): bool,
                    vol.Required(CONF_SHOW_SERVICE, default=values[CONF_SHOW_SERVICE]): bool,
                    vol.Required(CONF_SHOW_DISABLED, default=values[CONF_SHOW_DISABLED]): bool,
                    vol.Optional(CONF_HIDE_CONNECTIONS, default=values[CONF_HIDE_CONNECTIONS]): SelectSelector(
                        SelectSelectorConfig(
                            options=list(CONNECTION_TYPES), multiple=True, mode=SelectSelectorMode.DROPDOWN, translation_key="connection"
                        )
                    ),
                    vol.Required(CONF_UPDATE_CHECK, default=values[CONF_UPDATE_CHECK]): bool,
                }
            ),
        )
