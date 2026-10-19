"""
Einstellungen sichern und wiederherstellen (seit 2.98.0, docs/mockups/backup-v1).

Die Sicherung ist eine JSON-Datei mit Bereichen (Meldungen, Anzeige, Geräte, KI, Routinen, Magic Push); sie enthält keine
Zugangsdaten und keine Tokens. Die Wiederherstellung prüft jeden Wert einzeln und gibt einen Bericht zurück (geändert,
unverändert, übersprungen, Hinweise); "dry_run" schreibt nichts (Vorschau). Was die Datei nicht nennt, bleibt unverändert;
nur mit "replace" (Rückgängig: Zustand vor der Wiederherstellung) wird auch entfernt, was die Sicherung nicht kennt.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from . import options_api
from .const import (
    BATTERY_OFF,
    CONF_AI_ASSESSMENT,
    CONF_AI_PROMPT,
    CONF_AI_TASK,
    CONF_BATTERY_LOW,
    CONF_CHARGE_FULL,
    CONF_CHARGE_RISE,
    CONF_CHARGE_STALL,
    CONF_EXCLUDE_DEVICES,
    CONF_EXCLUDE_INTEGRATIONS,
    CONF_EXCLUDE_TYPES,
    CONF_NOTIFY_DELAY,
    CONF_NOTIFY_DELAY_INTEGRATIONS,
    CONF_OFFLINE_AFTER,
    CONF_OFFLINE_INTEGRATIONS,
    CONNECTION_MANUAL,
    DATA_BATTERY,
    DATA_CHARGE,
    DATA_MAGIC,
    DATA_ROUTINES,
    DEVICE_TYPES,
    DOMAIN,
    NOTIFY_NONE,
)
from .devices import (
    _in_range,
    _async_save_devices,
    async_load_type_overrides,
    async_notify_delay_error,
    async_set_connection_override,
    async_set_device_settings,
    async_set_type_override,
    connection_overrides,
    device_settings,
    type_overrides,
    valid_notify_delay_setting,
    valid_offline_setting,
    valid_signal_setting,
)
from .magic import clean_rule
from .update_check import async_installed_version

FORMAT = "device_panel_backup"
FORMAT_VERSION = 1

SECTIONS = ("monitor", "display", "devices", "ai", "routines", "magic")
# Standard beim Sichern: Routinen und Magic Push verweisen auf Entitäten und Geräte, die fehlen können (Wunsch des Nutzers: aus)
DEFAULT_SECTIONS = ("monitor", "display", "devices", "ai")

_AI_KEYS = {CONF_AI_ASSESSMENT, CONF_AI_PROMPT, CONF_AI_TASK}
_DISPLAY_KEYS = {
    "chip_order",
    "connection_integrations",
    "connection_order",
    CONF_EXCLUDE_INTEGRATIONS,
    CONF_EXCLUDE_TYPES,
    "hide_chips",
    "hide_connections",
    "show_disabled_devices",
    "show_service_devices",
    "type_integrations",
}
_DEVICE_KEYS = {CONF_EXCLUDE_DEVICES}
_ROUTINE_KEYS = {"routines_catch_up", "routines_notify_error", "routines_pause", "notify_service_routines"}
_SCHEMA_KEYS = {str(k.schema) for k in options_api.PANEL_SCHEMA.schema}

# Die vier Werte, die sich gegenseitig prüfen ("Erst melden nach" nie kürzer als "Ausgefallen nach")
_DELAY_KEYS = {CONF_NOTIFY_DELAY, CONF_NOTIFY_DELAY_INTEGRATIONS, CONF_OFFLINE_AFTER, CONF_OFFLINE_INTEGRATIONS}

# Einstellungen pro Gerät: Schlüssel in device_settings; "notify" steht dort als Menge der abgeschalteten Geräte
_DEVICE_SETTING_KEYS = (
    "battery",
    "notify",
    "signal",
    "offline",
    "notify_delay",
    "charge",
    "charge_full",
    "charge_rise",
    "charge_stall",
    "charge_stop",
    "charge_live",
)
_ITEMS_MAX = 400
_EXAMPLES_MAX = 3
_LIST_MAX = 500


def section_keys(section: str) -> set[str]:
    """Optionen, die zu einem Bereich gehören; der Bereich "monitor" nimmt alle übrigen."""
    if section == "ai":
        return set(_AI_KEYS)
    if section == "display":
        return set(_DISPLAY_KEYS)
    if section == "devices":
        return set(_DEVICE_KEYS)
    if section == "routines":
        return set(_ROUTINE_KEYS)
    if section == "monitor":
        return _SCHEMA_KEYS - _AI_KEYS - _DISPLAY_KEYS - _DEVICE_KEYS - _ROUTINE_KEYS
    return set()


def _entry(hass: HomeAssistant) -> Any:
    return next(iter(hass.config_entries.async_entries(DOMAIN)), None)


def _strip(item: dict[str, Any]) -> dict[str, Any]:
    """Eine Routine oder Regel für die Datei: ohne Zeitstempel der Anlage."""
    return {k: v for k, v in item.items() if k != "created"}


# -- Sichern -----------------------------------------------------------------------------------------------------


def _current_device_settings(hass: HomeAssistant, device_id: str) -> dict[str, Any]:
    """Eigene Einstellungen eines Geräts (nur gesetzte), im Format der Sicherung."""
    settings = device_settings(hass)
    own: dict[str, Any] = {}
    for key in _DEVICE_SETTING_KEYS:
        if key == "notify":
            if device_id in settings["notify_off"]:
                own["notify"] = False
        elif device_id in (settings.get(key) or {}):
            own[key] = settings[key][device_id]
    return own


async def async_export(hass: HomeAssistant, sections: list[str]) -> dict[str, Any]:
    """Die Sicherung der gewählten Bereiche (Wörterbuch für die JSON-Datei)."""
    entry = _entry(hass)
    values = options_api.current_values(entry) if entry else {}
    out: dict[str, Any] = {}
    for section in SECTIONS:
        if section not in sections:
            continue
        keys = section_keys(section)
        body: dict[str, Any] = {}
        if keys:
            body["options"] = {k: values[k] for k in sorted(keys) if k in values}
        if section == "devices":
            await async_load_type_overrides(hass)
            registry = dr.async_get(hass)
            # Geräte, die es in Home Assistant nicht mehr gibt (gelöscht), bleiben in den Ablagen des Panels stehen;
            # sie gehören nicht in die Sicherung, sonst meldet das Wiederherstellen sie als "unbekannt".
            if CONF_EXCLUDE_DEVICES in body.get("options", {}):
                body["options"][CONF_EXCLUDE_DEVICES] = [d for d in body["options"][CONF_EXCLUDE_DEVICES] if registry.async_get(d) is not None]
            settings: dict[str, dict[str, Any]] = {}
            types = {d: v for d, v in type_overrides(hass).items() if registry.async_get(d) is not None}
            connections = {d: v for d, v in connection_overrides(hass).items() if registry.async_get(d) is not None}
            ids = set(types) | set(connections) | set(device_settings(hass)["notify_off"])
            for key in _DEVICE_SETTING_KEYS:
                if key != "notify":
                    ids |= set((device_settings(hass).get(key) or {}))
            for device_id in sorted(ids):
                if registry.async_get(device_id) is None:
                    continue
                own = _current_device_settings(hass, device_id)
                if own:
                    settings[device_id] = own
            body["settings"] = settings
            body["types"] = types
            body["connections"] = connections
            # Namen nur zur Lesbarkeit der Vorschau (die Zuordnung läuft über die ID)
            names = {}
            for device_id in sorted(set(settings) | set(types) | set(connections) | set(values.get(CONF_EXCLUDE_DEVICES) or [])):
                device = registry.async_get(device_id)
                if device is not None:
                    names[device_id] = device.name_by_user or device.name or device_id
            body["names"] = names
        elif section == "routines":
            manager = hass.data.get(DATA_ROUTINES)
            body["items"] = [_strip(r) for r in manager.routines()] if manager else []
        elif section == "magic":
            manager = hass.data.get(DATA_MAGIC)
            body["items"] = [_strip(r) for r in manager.rules()] if manager else []
        out[section] = body
    return {
        "format": FORMAT,
        "format_version": FORMAT_VERSION,
        "integration_version": await async_installed_version(hass),
        "exported_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "sections": out,
    }


# -- Wiederherstellen ----------------------------------------------------------------------------------------------


def _empty() -> dict[str, Any]:
    return {"changed": 0, "unchanged": 0, "skipped": [], "notes": [], "examples": [], "changes": [], "same": []}


def _example(rep: dict[str, Any], what: str, old: Any, new: Any, device: str | None = None) -> None:
    """Eine Änderung festhalten: alle für das Detailfenster ("changes"), die ersten drei für die Vorschau ("examples")."""
    if len(rep["examples"]) < _EXAMPLES_MAX:
        rep["examples"].append({"what": f"{device}: {what}" if device else what, "old": _short(old), "new": _short(new)})
    if len(rep["changes"]) < _LIST_MAX:
        rep["changes"].append({"what": what, "old": _short(old), "new": _short(new), **({"device": device} if device else {})})


def _same(rep: dict[str, Any], what: str, device: str | None = None) -> None:
    """Ein Wert, der schon so gilt (für das Detailfenster "unverändert")."""
    rep["unchanged"] += 1
    if len(rep["same"]) < _LIST_MAX:
        rep["same"].append({"what": what, **({"device": device} if device else {})})


def _short(value: Any) -> Any:
    """Wert für die Anzeige in der Vorschau: lange Texte und Listen kürzen."""
    if isinstance(value, str) and len(value) > 40:
        return value[:37] + "…"
    if isinstance(value, (list, dict)):
        return f"{len(value)} Einträge"
    return value


def _installed_domains(hass: HomeAssistant) -> set[str]:
    return set(hass.config.components) | {e.domain for e in hass.config_entries.async_entries()}


def _reference_notes(hass: HomeAssistant, values: dict[str, Any], rep: dict[str, Any]) -> None:
    """Verweise der Werte, die es hier nicht gibt: Push-Ziele, Integrationen, Entitäten (Hinweise, die Werte werden übernommen)."""
    targets = {t["value"] for t in options_api.notify_targets(hass, NOTIFY_NONE) if t["kind"] != "missing"}
    seen: set[str] = set()
    for key, value in values.items():
        if key.startswith("notify_service") and isinstance(value, str) and value and value != NOTIFY_NONE and value not in targets and value not in seen:
            seen.add(value)
            rep["notes"].append({"kind": "target", "what": value})
    domains = _installed_domains(hass)
    for key, value in values.items():
        if not key.endswith("_integrations") and key != CONF_EXCLUDE_INTEGRATIONS:
            continue
        for domain in (value.keys() if isinstance(value, dict) else value if isinstance(value, list) else []):
            if isinstance(domain, str) and domain not in domains and domain not in seen:
                seen.add(domain)
                rep["notes"].append({"kind": "integration", "what": domain})
    registry = er.async_get(hass)
    for key, value in values.items():
        if (key == CONF_AI_TASK or (key.startswith("status_") and key.endswith("_entity"))) and isinstance(value, str) and value:
            if registry.async_get(value) is None and hass.states.get(value) is None and value not in seen:
                seen.add(value)
                rep["notes"].append({"kind": "entity", "what": value})


def _apply_options(hass: HomeAssistant, entry: Any, values: dict[str, Any], dry_run: bool, rep: dict[str, Any]) -> dict[str, Any]:
    """Werte prüfen und speichern; ein Wert, der die Prüfung nicht besteht, wird mit Grund übersprungen. Gibt zurück, was gilt."""
    values = dict(values)
    for _ in range(len(values) + 1):
        if not values:
            return values
        try:
            options_api.apply_values(hass, entry, values, dry_run=dry_run)
        except vol.Invalid as err:
            key = err.path[0] if err.path else None
            drop = {key} if key in values else set()
            if key in _DELAY_KEYS:
                drop |= _DELAY_KEYS & set(values)
            if not drop:
                for k in list(values):
                    rep["skipped"].append({"what": k, "reason": str(err.msg)})
                return {}
            for k in sorted(drop):
                rep["skipped"].append({"what": k, "reason": str(err.msg)})
                values.pop(k)
        else:
            return values
    return {}


def _options_part(hass: HomeAssistant, entry: Any, section: str, file_options: Any, dry_run: bool, rep: dict[str, Any], names: dict[str, Any] | None = None) -> None:
    if entry is None or not isinstance(file_options, dict):
        return
    keys = section_keys(section)
    current = options_api.current_values(entry)
    valid: dict[str, Any] = {}
    for key, value in file_options.items():
        if key not in _SCHEMA_KEYS:
            rep["skipped"].append({"what": key, "reason": "unknown"})
            continue
        if key not in keys:
            continue
        try:
            valid[key] = options_api.PANEL_SCHEMA({key: value})[key]
        except vol.Invalid as err:
            rep["skipped"].append({"what": key, "reason": str(err.msg)})
    if section == "devices" and CONF_EXCLUDE_DEVICES in valid:
        registry = dr.async_get(hass)
        known = [d for d in valid[CONF_EXCLUDE_DEVICES] if registry.async_get(d) is not None]
        for d in valid[CONF_EXCLUDE_DEVICES]:
            if d not in known:
                rep["skipped"].append({"what": "device", "reason": "device_unknown", "id": d, "name": (names or {}).get(d), "parts": ["exclude"]})
        valid[CONF_EXCLUDE_DEVICES] = known
    _reference_notes(hass, valid, rep)
    changed = {k: v for k, v in valid.items() if v != current.get(k)}
    for key in valid:
        if key not in changed:
            _same(rep, key)
    applied = _apply_options(hass, entry, changed, dry_run, rep)
    rep["changed"] += len(applied)
    for key, value in applied.items():
        _example(rep, key, current.get(key), value)


def _valid_device_setting(key: str, value: Any) -> bool:
    if key in ("notify", "charge", "charge_stop", "charge_live"):
        return isinstance(value, bool)
    if key == "battery":
        return value == BATTERY_OFF or _in_range(value, CONF_BATTERY_LOW)
    if key == "signal":
        return valid_signal_setting(value)
    if key == "offline":
        return valid_offline_setting(value)
    if key == "notify_delay":
        return valid_notify_delay_setting(value)
    if key == "charge_full":
        return _in_range(value, CONF_CHARGE_FULL)
    if key == "charge_rise":
        return _in_range(value, CONF_CHARGE_RISE)
    if key == "charge_stall":
        return _in_range(value, CONF_CHARGE_STALL)
    return False


async def _devices_part(hass: HomeAssistant, body: dict[str, Any], dry_run: bool, replace: bool, rep: dict[str, Any]) -> None:
    await async_load_type_overrides(hass)
    registry = dr.async_get(hass)
    names = body.get("names") if isinstance(body.get("names"), dict) else {}
    file_settings = body.get("settings") if isinstance(body.get("settings"), dict) else {}
    file_types = body.get("types") if isinstance(body.get("types"), dict) else {}
    file_conns = body.get("connections") if isinstance(body.get("connections"), dict) else {}
    ids = set(file_settings) | set(file_types) | set(file_conns)
    if replace:
        # Rückgängig: auch Geräte, die die Sicherung nicht kennt, auf Standard setzen
        ids |= set(type_overrides(hass)) | set(connection_overrides(hass)) | set(device_settings(hass)["notify_off"])
        for key in _DEVICE_SETTING_KEYS:
            if key != "notify":
                ids |= set(device_settings(hass).get(key) or {})
    unknown: list[str] = []
    refresh = False
    for device_id in sorted(ids):
        if registry.async_get(device_id) is None:
            unknown.append(device_id)
            continue
        incoming = file_settings.get(device_id) if isinstance(file_settings.get(device_id), dict) else {}
        current = _current_device_settings(hass, device_id)
        changes: dict[str, Any] = {}
        for key in _DEVICE_SETTING_KEYS:
            if key in incoming:
                if not _valid_device_setting(key, incoming[key]):
                    rep["skipped"].append({"what": key, "reason": "invalid", "device": names.get(device_id, device_id)})
                    continue
                new = incoming[key]
            elif replace:
                new = None if key != "notify" else True
            else:
                continue
            old = current.get(key) if key != "notify" else current.get("notify", True)
            if key == "notify" and new is None:
                new = True
            if new == old or (new is None and old is None):
                if key in incoming:
                    _same(rep, key, names.get(device_id) or device_id)
                continue
            changes[key] = new
        if (error := await async_notify_delay_error(hass, device_id, changes)):
            for key in ("notify_delay", "offline"):
                if key in changes:
                    rep["skipped"].append({"what": key, "reason": error, "device": names.get(device_id, device_id)})
                    changes.pop(key)
        for key, new in changes.items():
            rep["changed"] += 1
            _example(rep, key, current.get(key, "–"), new, names.get(device_id) or device_id)
        if changes and not dry_run:
            await async_set_device_settings(hass, device_id, **changes)
            refresh = refresh or bool({"battery", "charge", "charge_live"} & set(changes))
        # Typ und Verbindungsart von Hand
        for kind, table, allowed, current_table, setter in (
            ("type", file_types, DEVICE_TYPES, type_overrides(hass), async_set_type_override),
            ("connection", file_conns, CONNECTION_MANUAL, connection_overrides(hass), async_set_connection_override),
        ):
            value = table.get(device_id)
            if value is not None and value not in allowed:
                rep["skipped"].append({"what": kind, "reason": "invalid", "device": names.get(device_id, device_id)})
                continue
            if value is None and not replace:
                continue
            if value == current_table.get(device_id):
                if value is not None:
                    _same(rep, kind, names.get(device_id) or device_id)
                continue
            rep["changed"] += 1
            _example(rep, kind, current_table.get(device_id, "–"), value if value is not None else "–", names.get(device_id) or device_id)
            if not dry_run:
                await setter(hass, device_id, value)
    for device_id in unknown:
        incoming = file_settings.get(device_id) if isinstance(file_settings.get(device_id), dict) else {}
        parts = [k for k in _DEVICE_SETTING_KEYS if k in incoming]
        parts += [kind for kind, table in (("type", file_types), ("connection", file_conns)) if device_id in table]
        rep["skipped"].append({"what": "device", "reason": "device_unknown", "id": device_id, "name": names.get(device_id), "parts": parts})
    if refresh and not dry_run:
        if (watch := hass.data.get(DATA_BATTERY)) is not None:
            await watch.async_check()
        if (charge := hass.data.get(DATA_CHARGE)) is not None:
            await charge.async_rebuild()
            charge.live_check()
    if not dry_run:
        await _async_save_devices(hass)


async def _items_part(hass: HomeAssistant, kind: str, items: Any, dry_run: bool, replace: bool, rep: dict[str, Any]) -> None:
    """Routinen (kind "routines") oder Magic-Push-Meldungen ("magic"): jede wird wie im Panel geprüft; was fehlt, wird übersprungen."""
    manager = hass.data.get(DATA_ROUTINES if kind == "routines" else DATA_MAGIC)
    if manager is None or not isinstance(items, list):
        return
    store = manager._routines if kind == "routines" else manager._rules  # noqa: SLF001 (gleiches Paket)
    wanted: set[str] = set()
    for raw in items[:_ITEMS_MAX]:
        if not isinstance(raw, dict):
            continue
        name = str(raw.get("name") or raw.get("id") or "?")
        item_id = str(raw.get("id") or "")
        existing = store.get(item_id)
        try:
            if kind == "routines":
                clean = manager.clean(dict(raw), existing=existing)
            else:
                clean = clean_rule(hass, dict(raw))
        except vol.Invalid as err:
            rep["skipped"].append({"what": name, "reason": str(getattr(err, "msg", err))})
            continue
        if item_id:
            wanted.add(item_id)
        if existing is not None and _strip(existing) == _strip({**clean, "id": item_id}):
            _same(rep, name)
            continue
        rep["changed"] += 1
        _example(rep, name, "–" if existing is None else "geändert", "neu" if existing is None else "angepasst")
        if dry_run:
            continue
        try:
            if kind == "routines":
                await manager.async_save_routine(dict(raw), adopt_id=True)
            else:
                await manager.async_save_rule(dict(raw), adopt_id=True)
        except vol.Invalid as err:
            rep["changed"] -= 1
            rep["skipped"].append({"what": name, "reason": str(getattr(err, "msg", err))})
    if replace:
        for item_id in [i for i in store if i not in wanted]:
            rep["changed"] += 1
            if not dry_run:
                if kind == "routines":
                    await manager.async_delete_routine(item_id)
                else:
                    await manager.async_delete_rule(item_id)


def check_file(data: Any) -> dict[str, Any]:
    """Die Datei prüfen (Format und Version); gibt die Bereiche zurück oder löst vol.Invalid aus."""
    if not isinstance(data, dict) or data.get("format") != FORMAT or not isinstance(data.get("sections"), dict):
        raise vol.Invalid("Keine Sicherung von Device Panel")
    version = data.get("format_version")
    if not isinstance(version, int) or isinstance(version, bool) or version < 1 or version > FORMAT_VERSION:
        raise vol.Invalid("Diese Sicherung stammt von einer neueren Version von Device Panel")
    return data["sections"]


async def async_import(hass: HomeAssistant, data: Any, sections: list[str] | None, *, dry_run: bool, replace: bool = False) -> dict[str, Any]:
    """Wiederherstellen (oder nur die Vorschau). Bericht je Bereich und Summen."""
    file_sections = check_file(data)
    entry = _entry(hass)
    report: dict[str, Any] = {}
    for section in SECTIONS:
        if section not in file_sections or (sections is not None and section not in sections):
            continue
        body = file_sections[section] if isinstance(file_sections[section], dict) else {}
        rep = _empty()
        _options_part(hass, entry, section, body.get("options"), dry_run, rep, body.get("names") if isinstance(body.get("names"), dict) else None)
        if section == "devices":
            await _devices_part(hass, body, dry_run, replace, rep)
        elif section in ("routines", "magic"):
            await _items_part(hass, section, body.get("items"), dry_run, replace, rep)
        report[section] = rep
    totals = {
        "changed": sum(r["changed"] for r in report.values()),
        "unchanged": sum(r["unchanged"] for r in report.values()),
        "skipped": sum(len(r["skipped"]) for r in report.values()),
        "notes": sum(len(r["notes"]) for r in report.values()),
    }
    return {"sections": report, "totals": totals, "file_version": data.get("integration_version"), "exported_at": data.get("exported_at")}
