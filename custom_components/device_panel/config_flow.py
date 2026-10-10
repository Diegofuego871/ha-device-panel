"""Einrichtung (nur bestätigen, eine Instanz) und Optionen."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    DeviceSelector,
    DeviceSelectorConfig,
    EntitySelector,
    EntitySelectorConfig,
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
    BATTERY_FIELDS,
    CLICK_TARGETS,
    CONF_BATTERY_FIELDS,
    CONF_BATTERY_PUSH_EXCLUDE,
    CONF_NEW_EXCLUDE,
    CONF_NEW_FIELDS,
    CONF_NEW_PERSISTENT,
    CONF_NEW_WINDOW,
    CONF_NOTIFY_UPDATES,
    CONF_UPDATES_KINDS,
    CONF_UPDATES_MODE,
    CONF_UPDATES_REPEAT,
    CONF_UPDATES_TIME,
    CONF_UPDATES_WINDOW,
    UPDATE_KINDS,
    UPDATES_MODES,
    UPDATES_REPEATS,
    CONF_NOTIFY_NEW,
    NEW_FIELDS,
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
    NOTIFY_FIELDS,
    DAILY_CONTENTS,
    PUSH_MODES,
    CONF_BATTERY_LOW,
    CONF_BATTERY_LOW_INTEGRATIONS,
    CONF_BATTERY_PERSISTENT,
    CONF_BATTERY_PUSH,
    CONF_EXCLUDE_INTEGRATIONS,
    CONF_EXCLUDE_DEVICES,
    CONF_EXCLUDE_TYPES,
    CONF_FLAKY_OUTAGES,
    CONF_CONNECTION_INTEGRATIONS,
    CONF_TYPE_INTEGRATIONS,
    CONF_SIGNAL_LOW,
    CONF_SIGNAL_LOW_INTEGRATIONS,
    CONF_CONNECTION_ORDER,
    CONF_HIDE_CHIPS,
    CONF_HIDE_CONNECTIONS,
    NEW_INSTALL_OPTIONS,
    CHIP_KEYS,
    CONNECTION_TYPES,
    CONF_NOTIFY_CLICK,
    CONF_NOTIFY_SERVICE,
    CONF_OFFLINE_AFTER,
    CONF_OFFLINE_INTEGRATIONS,
    CONF_SHOW_DISABLED,
    CONF_SHOW_SERVICE,
    CONF_STARTUP_GRACE,
    CONF_AI_ASSESSMENT,
    CONF_AI_TASK,
    CONF_UPDATE_CHECK,
    DEVICE_TYPES,
    DOMAIN,
    INT_RANGES,
    PANEL_TITLE,
)
from .options_api import (
    INT_OPTIONS,
    battery_fields,
    new_fields,
    update_kinds,
    battery_map,
    delay_too_short,
    offline_map,
    connection_map,
    type_map,
    signal_integrations_map,
    signal_map,
    connection_order,
    current_values,
    notify_fields,
    notify_targets,
    push_time,
)
from .push import text

# Einheit der Zahlenfelder im Optionsdialog.
_UNITS = {CONF_OFFLINE_AFTER: "min", CONF_STARTUP_GRACE: "min", CONF_BATTERY_LOW: "%", CONF_NOTIFY_DELAY: "min", CONF_NEW_WINDOW: "min", CONF_UPDATES_WINDOW: "min"}


class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(title=PANEL_TITLE, data={}, options=deepcopy(NEW_INSTALL_OPTIONS))
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
            try:
                offline = offline_map(user_input.get(CONF_OFFLINE_INTEGRATIONS))
            except vol.Invalid:
                offline = None
                errors[CONF_OFFLINE_INTEGRATIONS] = "offline_map"
            try:
                conns = connection_map(user_input.get(CONF_CONNECTION_INTEGRATIONS))
            except vol.Invalid:
                conns = None
                errors[CONF_CONNECTION_INTEGRATIONS] = "connection_map"
            try:
                types_by_integration = type_map(user_input.get(CONF_TYPE_INTEGRATIONS))
            except vol.Invalid:
                types_by_integration = None
                errors[CONF_TYPE_INTEGRATIONS] = "type_map"
            try:
                signal_low = signal_map(user_input.get(CONF_SIGNAL_LOW))
            except vol.Invalid:
                signal_low = None
                errors[CONF_SIGNAL_LOW] = "signal_map"
            try:
                signal_integ = signal_integrations_map(user_input.get(CONF_SIGNAL_LOW_INTEGRATIONS))
            except vol.Invalid:
                signal_integ = None
                errors[CONF_SIGNAL_LOW_INTEGRATIONS] = "signal_integrations_map"
            if not errors:
                # Bestehende Options erhalten, statt sie zu ersetzen. Leere
                # Mehrfachauswahl muss die alte überschreiben.
                data = {**self.config_entry.options, **user_input, CONF_BATTERY_LOW_INTEGRATIONS: own, CONF_OFFLINE_INTEGRATIONS: offline, CONF_CONNECTION_INTEGRATIONS: conns, CONF_TYPE_INTEGRATIONS: types_by_integration, CONF_SIGNAL_LOW: signal_low, CONF_SIGNAL_LOW_INTEGRATIONS: signal_integ}
                for key in (
                    CONF_EXCLUDE_INTEGRATIONS, CONF_EXCLUDE_TYPES, CONF_EXCLUDE_DEVICES, CONF_HIDE_CHIPS, CONF_HIDE_CONNECTIONS,
                    CONF_NOTIFY_EXCLUDE, CONF_PERSISTENT_EXCLUDE, CONF_BATTERY_PUSH_EXCLUDE, CONF_NEW_EXCLUDE,
                ):
                    data[key] = sorted(set(user_input.get(key) or []))
                # Inhalt der Meldungen in fester Reihenfolge, wie im Panel.
                data[CONF_NOTIFY_FIELDS] = notify_fields(list(user_input.get(CONF_NOTIFY_FIELDS) or []))
                data[CONF_BATTERY_FIELDS] = battery_fields(list(user_input.get(CONF_BATTERY_FIELDS) or []))
                data[CONF_NEW_FIELDS] = new_fields(list(user_input.get(CONF_NEW_FIELDS) or []))
                data[CONF_UPDATES_KINDS] = update_kinds(list(user_input.get(CONF_UPDATES_KINDS) or []))
                if CONF_UPDATES_TIME in user_input:
                    data[CONF_UPDATES_TIME] = push_time(user_input[CONF_UPDATES_TIME])
                # Leere Auswahl der KI-Aufgabe überschreibt die alte (Standard von HA).
                data[CONF_AI_TASK] = user_input.get(CONF_AI_TASK) or ""
                # Das Zahlenfeld liefert Kommazahlen (2.0); gespeichert wird wie
                # aus dem Panel eine ganze Zahl.
                for key, _default in INT_OPTIONS:
                    if key in user_input:
                        data[key] = int(user_input[key])
                # Reihenfolge der Chips: wie gewählt, nicht sortiert; leer = nach Anzahl.
                data[CONF_CONNECTION_ORDER] = connection_order(list(user_input.get(CONF_CONNECTION_ORDER) or []))
                # Zeitfeld liefert "HH:MM:SS"; gespeichert wird "HH:MM" wie im Panel.
                if CONF_BATTERY_PUSH_TIME in user_input:
                    data[CONF_BATTERY_PUSH_TIME] = push_time(user_input[CONF_BATTERY_PUSH_TIME])
                # "Erst melden nach" nie kürzer als "Ausgefallen nach" (wie im Panel).
                if delay_too_short(data):
                    errors[CONF_NOTIFY_DELAY] = "notify_delay_short"
                else:
                    return self.async_create_entry(title="", data=data)
            # Fehler: die Eingaben bleiben stehen.
            values = {**values, **user_input}
        # Spät importiert: devices importiert options_api, das hier schon geladen ist.
        from .devices import async_catalog  # noqa: PLC0415

        catalog = await async_catalog(self.hass)
        integrations = [{"value": i["domain"], "label": f"{i['name']} ({i['devices']})"} for i in catalog["integrations"]]
        # Ausgeschlossene Integration ohne Geräte bleibt wählbar.
        known = {i["value"] for i in integrations}
        for key in (CONF_EXCLUDE_INTEGRATIONS, CONF_NOTIFY_EXCLUDE, CONF_PERSISTENT_EXCLUDE, CONF_BATTERY_PUSH_EXCLUDE, CONF_NEW_EXCLUDE):
            integrations += [{"value": d, "label": d} for d in values[key] if d not in known]
            known.update(values[key])
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
                    # Überwachung und Meldungen (Abschnitt im Panel, seit 0.34.0):
                    # Ziel, Ausfall, Batterie, dann pro Integration.
                    vol.Required(CONF_NOTIFY_SERVICE, default=values[CONF_NOTIFY_SERVICE]): SelectSelector(
                        SelectSelectorConfig(options=targets, mode=SelectSelectorMode.DROPDOWN)
                    ),
                    vol.Required(CONF_NOTIFY_CLICK, default=values[CONF_NOTIFY_CLICK]): SelectSelector(
                        SelectSelectorConfig(options=list(CLICK_TARGETS), mode=SelectSelectorMode.DROPDOWN, translation_key="click_target")
                    ),
                    vol.Required(CONF_OFFLINE_AFTER, default=values[CONF_OFFLINE_AFTER]): _number(CONF_OFFLINE_AFTER),
                    vol.Required(CONF_NOTIFY_DELAY, default=values[CONF_NOTIFY_DELAY]): _number(CONF_NOTIFY_DELAY),
                    vol.Required(CONF_FLAKY_OUTAGES, default=values[CONF_FLAKY_OUTAGES]): _number(CONF_FLAKY_OUTAGES),
                    vol.Required(CONF_STARTUP_GRACE, default=values[CONF_STARTUP_GRACE]): _number(CONF_STARTUP_GRACE),
                    vol.Required(CONF_NOTIFY_OUTAGE, default=values[CONF_NOTIFY_OUTAGE]): bool,
                    vol.Required(CONF_NOTIFY_ONLINE, default=values[CONF_NOTIFY_ONLINE]): bool,
                    vol.Required(CONF_NOTIFY_GROUP, default=values[CONF_NOTIFY_GROUP]): bool,
                    vol.Required(CONF_OUTAGE_PERSISTENT, default=values[CONF_OUTAGE_PERSISTENT]): bool,
                    vol.Optional(CONF_NOTIFY_FIELDS, default=values[CONF_NOTIFY_FIELDS]): SelectSelector(
                        SelectSelectorConfig(
                            options=list(NOTIFY_FIELDS), multiple=True, mode=SelectSelectorMode.LIST, translation_key="notify_field"
                        )
                    ),
                    vol.Required(CONF_BATTERY_LOW, default=values[CONF_BATTERY_LOW]): _number(CONF_BATTERY_LOW),
                    vol.Required(CONF_BATTERY_PUSH, default=values[CONF_BATTERY_PUSH]): bool,
                    vol.Required(CONF_BATTERY_PUSH_MODE, default=values[CONF_BATTERY_PUSH_MODE]): SelectSelector(
                        SelectSelectorConfig(options=list(PUSH_MODES), mode=SelectSelectorMode.DROPDOWN, translation_key="battery_push_mode")
                    ),
                    vol.Required(CONF_BATTERY_PUSH_TIME, default=values[CONF_BATTERY_PUSH_TIME]): TimeSelector(),
                    vol.Required(CONF_BATTERY_PUSH_DAILY, default=values[CONF_BATTERY_PUSH_DAILY]): SelectSelector(
                        SelectSelectorConfig(options=list(DAILY_CONTENTS), mode=SelectSelectorMode.DROPDOWN, translation_key="battery_push_daily")
                    ),
                    vol.Required(CONF_BATTERY_PERSISTENT, default=values[CONF_BATTERY_PERSISTENT]): bool,
                    vol.Optional(CONF_BATTERY_FIELDS, default=values[CONF_BATTERY_FIELDS]): SelectSelector(
                        SelectSelectorConfig(
                            options=list(BATTERY_FIELDS), multiple=True, mode=SelectSelectorMode.LIST, translation_key="battery_field"
                        )
                    ),
                    # Neue Geräte (Reiter "Neu" im Panel, seit 1.24.0).
                    vol.Required(CONF_NOTIFY_NEW, default=values[CONF_NOTIFY_NEW]): bool,
                    vol.Required(CONF_NEW_WINDOW, default=values[CONF_NEW_WINDOW]): _number(CONF_NEW_WINDOW),
                    vol.Required(CONF_NEW_PERSISTENT, default=values[CONF_NEW_PERSISTENT]): bool,
                    vol.Optional(CONF_NEW_FIELDS, default=values[CONF_NEW_FIELDS]): SelectSelector(
                        SelectSelectorConfig(
                            options=list(NEW_FIELDS), multiple=True, mode=SelectSelectorMode.LIST, translation_key="new_field"
                        )
                    ),
                    # Update-Erinnerung (Reiter "Updates" im Panel, seit 1.29.0).
                    vol.Required(CONF_NOTIFY_UPDATES, default=values[CONF_NOTIFY_UPDATES]): bool,
                    vol.Required(CONF_UPDATES_MODE, default=values[CONF_UPDATES_MODE]): SelectSelector(
                        SelectSelectorConfig(options=list(UPDATES_MODES), mode=SelectSelectorMode.DROPDOWN, translation_key="updates_mode")
                    ),
                    vol.Required(CONF_UPDATES_TIME, default=values[CONF_UPDATES_TIME]): TimeSelector(),
                    vol.Required(CONF_UPDATES_WINDOW, default=values[CONF_UPDATES_WINDOW]): _number(CONF_UPDATES_WINDOW),
                    vol.Required(CONF_UPDATES_REPEAT, default=values[CONF_UPDATES_REPEAT]): SelectSelector(
                        SelectSelectorConfig(options=list(UPDATES_REPEATS), mode=SelectSelectorMode.DROPDOWN, translation_key="updates_repeat")
                    ),
                    vol.Optional(CONF_UPDATES_KINDS, default=values[CONF_UPDATES_KINDS]): SelectSelector(
                        SelectSelectorConfig(
                            options=list(UPDATE_KINDS), multiple=True, mode=SelectSelectorMode.LIST, translation_key="update_kind"
                        )
                    ),
                    # Pro Integration (Reiter "Integrationen" im Panel). Eigenes
                    # "Ausgefallen nach", z. B. "zha: 60" oder "hue: off".
                    vol.Optional(CONF_OFFLINE_INTEGRATIONS, default=values[CONF_OFFLINE_INTEGRATIONS] or {}): ObjectSelector(),
                    vol.Optional(CONF_NOTIFY_EXCLUDE, default=values[CONF_NOTIFY_EXCLUDE]): SelectSelector(
                        SelectSelectorConfig(options=integrations, multiple=True, mode=SelectSelectorMode.DROPDOWN)
                    ),
                    vol.Optional(CONF_PERSISTENT_EXCLUDE, default=values[CONF_PERSISTENT_EXCLUDE]): SelectSelector(
                        SelectSelectorConfig(options=integrations, multiple=True, mode=SelectSelectorMode.DROPDOWN)
                    ),
                    # Eigene Schwelle pro Integration als Zuordnung, z. B. "zha: 25".
                    vol.Optional(CONF_BATTERY_LOW_INTEGRATIONS, default=values[CONF_BATTERY_LOW_INTEGRATIONS] or {}): ObjectSelector(),
                    vol.Optional(CONF_BATTERY_PUSH_EXCLUDE, default=values[CONF_BATTERY_PUSH_EXCLUDE]): SelectSelector(
                        SelectSelectorConfig(options=integrations, multiple=True, mode=SelectSelectorMode.DROPDOWN)
                    ),
                    vol.Optional(CONF_NEW_EXCLUDE, default=values[CONF_NEW_EXCLUDE]): SelectSelector(
                        SelectSelectorConfig(options=integrations, multiple=True, mode=SelectSelectorMode.DROPDOWN)
                    ),
                    # Abschnitt "Integrationen" (nur noch Anzeigen), Gerätetypen,
                    # ausgeblendete Geräte.
                    vol.Optional(CONF_EXCLUDE_INTEGRATIONS, default=values[CONF_EXCLUDE_INTEGRATIONS]): SelectSelector(
                        SelectSelectorConfig(options=integrations, multiple=True, mode=SelectSelectorMode.DROPDOWN)
                    ),
                    vol.Optional(CONF_EXCLUDE_TYPES, default=values[CONF_EXCLUDE_TYPES]): SelectSelector(
                        SelectSelectorConfig(
                            options=list(DEVICE_TYPES), multiple=True, mode=SelectSelectorMode.DROPDOWN, translation_key="device_type"
                        )
                    ),
                    # Einzeln ausgeblendete Geräte (im Panel: Knopf im Geräte-Popup).
                    vol.Optional(CONF_EXCLUDE_DEVICES, default=values[CONF_EXCLUDE_DEVICES]): DeviceSelector(DeviceSelectorConfig(multiple=True)),
                    vol.Required(CONF_SHOW_SERVICE, default=values[CONF_SHOW_SERVICE]): bool,
                    vol.Required(CONF_SHOW_DISABLED, default=values[CONF_SHOW_DISABLED]): bool,
                    vol.Optional(CONF_HIDE_CHIPS, default=values[CONF_HIDE_CHIPS]): SelectSelector(
                        SelectSelectorConfig(options=list(CHIP_KEYS), multiple=True, mode=SelectSelectorMode.DROPDOWN, translation_key="chip")
                    ),
                    vol.Optional(CONF_HIDE_CONNECTIONS, default=values[CONF_HIDE_CONNECTIONS]): SelectSelector(
                        SelectSelectorConfig(
                            options=list(CONNECTION_TYPES), multiple=True, mode=SelectSelectorMode.DROPDOWN, translation_key="connection"
                        )
                    ),
                    # Reihenfolge der Chips: in der Reihenfolge der Auswahl (HA kann hier
                    # nicht ziehen; im Panel per Griff), leer = nach Anzahl.
                    vol.Optional(CONF_CONNECTION_ORDER, default=values[CONF_CONNECTION_ORDER]): SelectSelector(
                        SelectSelectorConfig(
                            options=list(CONNECTION_TYPES), multiple=True, mode=SelectSelectorMode.DROPDOWN, translation_key="connection"
                        )
                    ),
                    # Verbindungsart pro Integration als Zuordnung, z. B. "hue: zigbee".
                    vol.Optional(CONF_CONNECTION_INTEGRATIONS, default=values[CONF_CONNECTION_INTEGRATIONS] or {}): ObjectSelector(),
                    # Gerätetyp pro Integration als Zuordnung, z. B. "hue: light" (seit 1.25.0).
                    vol.Optional(CONF_TYPE_INTEGRATIONS, default=values[CONF_TYPE_INTEGRATIONS] or {}): ObjectSelector(),
                    # Warnschwelle des Empfangs pro Funkart, global und pro Integration (seit 1.17.0).
                    vol.Optional(CONF_SIGNAL_LOW, default=values[CONF_SIGNAL_LOW] or {}): ObjectSelector(),
                    vol.Optional(CONF_SIGNAL_LOW_INTEGRATIONS, default=values[CONF_SIGNAL_LOW_INTEGRATIONS] or {}): ObjectSelector(),
                    # KI-Einschätzung im Geräte-Popup: aus, bis eingeschaltet; die
                    # KI-Aufgabe ist wählbar, leer = Standard von Home Assistant.
                    vol.Required(CONF_AI_ASSESSMENT, default=values[CONF_AI_ASSESSMENT]): bool,
                    vol.Optional(CONF_AI_TASK, description={"suggested_value": values[CONF_AI_TASK] or None}): EntitySelector(
                        EntitySelectorConfig(domain="ai_task")
                    ),
                    vol.Required(CONF_UPDATE_CHECK, default=values[CONF_UPDATE_CHECK]): bool,
                }
            ),
        )
