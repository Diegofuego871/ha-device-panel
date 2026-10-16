"""Versionsprüfung, Vorabversionen, Reparatur-Meldung, Optionen und Panel-Einstellungen mit echtem HA."""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType, InvalidData
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import issue_registry as ir
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.device_panel import update_check
from custom_components.device_panel.const import CONF_UPDATE_CHECK, DOMAIN, EMOJI_KEYS, NOTIFY_TOPICS

from .conftest import REAL_GET_JSON

LATEST = update_check.LATEST_RELEASE_URL
RELEASES = update_check.RELEASES_URL


def _release(tag: str, prerelease: bool = False, draft: bool = False) -> dict[str, Any]:
    return {"tag_name": tag, "html_url": f"https://github.com/x/y/releases/tag/{tag}", "prerelease": prerelease, "draft": draft}


@pytest.fixture
async def entry(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def test_version_order() -> None:
    cmp = update_check.compare_versions
    assert cmp("0.10.0", "0.9.9") == 1
    assert cmp("0.4.0b1", "0.4.0") == -1
    assert cmp("0.4.0b2", "0.4.0b1") == 1
    assert cmp("0.4.0rc1", "0.4.0b9") == 1
    assert cmp("v0.4.0", "0.4.0") == 0
    assert update_check.is_prerelease("0.4.0b1") and not update_check.is_prerelease("0.4.0")


async def test_new_release_is_reported(hass: HomeAssistant, entry, hass_ws_client, github_offline) -> None:
    installed = await update_check.async_installed_version(hass)
    github_offline[LATEST] = (_release("v99.0.0"), None)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/version"})
    result = (await client.receive_json())["result"]
    assert result["installed"] == installed
    assert result["latest"] == "99.0.0"
    assert result["release_url"].endswith("/v99.0.0")
    assert result["prerelease"] is None  # nur auf Wunsch
    issue = ir.async_get(hass).async_get_issue(DOMAIN, update_check.ISSUE_ID)
    assert issue is not None
    assert issue.translation_placeholders == {"installed": installed, "latest": "99.0.0"}


async def test_no_stable_release_is_not_an_error(hass: HomeAssistant, entry, hass_ws_client, github_offline) -> None:
    # Solange es nur Vorabversionen gibt, antwortet GitHub mit 404.
    github_offline[RELEASES] = (
        [_release("v99.0.0b2", prerelease=True), _release("v99.0.0b3", prerelease=True, draft=True), _release("v0.0.1b1", prerelease=True)],
        None,
    )
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/version", "prerelease": True})
    result = (await client.receive_json())["result"]
    assert result["latest"] is None
    assert result["error"] is None
    assert result["prerelease"] == "99.0.0b2"  # Entwurf zählt nicht, ältere auch nicht
    # Vorabversionen erscheinen nie unter "Reparaturen".
    assert ir.async_get(hass).async_get_issue(DOMAIN, update_check.ISSUE_ID) is None


async def test_error_keeps_last_good_answer(hass: HomeAssistant, entry, hass_ws_client, github_offline) -> None:
    github_offline[LATEST] = (_release("v99.0.0"), None)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/version"})
    await client.receive_json()
    github_offline[LATEST] = (None, "HTTP 500")
    hass.data[update_check._CACHE_KEY]["checked_at"] -= 3600  # Knopf erlaubt nach 60 s
    await client.send_json({"id": 2, "type": f"{DOMAIN}/version", "force": True})
    result = (await client.receive_json())["result"]
    assert result["latest"] == "99.0.0"
    assert result["error"] == "HTTP 500"


async def test_cache_and_force(hass: HomeAssistant, entry, github_offline) -> None:
    github_offline[LATEST] = (_release("v1.0.0"), None)
    first = await update_check.async_latest_release(hass)
    github_offline[LATEST] = (_release("v2.0.0"), None)
    assert (await update_check.async_latest_release(hass))["latest"] == first["latest"]  # zwischengespeichert
    hass.data[update_check._CACHE_KEY]["checked_at"] -= 120
    assert (await update_check.async_latest_release(hass, force=True))["latest"] == "2.0.0"


async def test_options_from_panel_and_issue_follows(hass: HomeAssistant, entry, hass_ws_client, github_offline) -> None:
    github_offline[LATEST] = (_release("v99.0.0"), None)
    await update_check.async_refresh_issue(hass)
    assert ir.async_get(hass).async_get_issue(DOMAIN, update_check.ISSUE_ID) is not None
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/get_options"})
    result = (await client.receive_json())["result"]
    assert result["values"] == {
        # Emoji der Meldungen: None = Standard (seit 2.2.0)
        **{key: None for key in EMOJI_KEYS.values()},
        # Eigenes Ziel je Reiter: leer = das globale (seit 2.18.0)
        **{key: "" for key in NOTIFY_TOPICS.values()},
        CONF_UPDATE_CHECK: True,
        # Uhrzeit der Prüfung (leer = automatisch) und Push zum Panel-Update (seit 2.25.0)
        "update_check_time": "",
        "update_notify": False,
        "exclude_integrations": [],
        "exclude_types": [],
        "exclude_devices": [],
        "offline_after": 2,
        "flaky_outages": 3,
        "startup_grace": 5,
        "show_service_devices": False,
        "show_disabled_devices": False,
        "hide_chips": [],
        "hide_connections": [],
        "connection_order": [],
        "chip_order": [],
        "signal_low": {},
        "signal_low_integrations": {},
        "connection_integrations": {},
        "type_integrations": {},
        "battery_low": 15,
        "battery_low_integrations": {},
        "offline_after_integrations": {},
        "ai_assessment": False,
        "ai_task_entity": "",
        "status_cpu_entity": "",
        "status_ram_entity": "",
        "status_disk_entity": "",
        "ai_prompt": "",
        "battery_push": False,
        "battery_persistent": False,
        "notify_service": "none",
        "notify_click_target": "panel",
        "notify_outage": False,
        "notify_online": False,
        "notify_group": True,
        "notify_delay": 2,
        "notify_fields": ["area", "integration", "since"],
        "notify_exclude_integrations": [],
        "persistent_exclude_integrations": [],
        "battery_push_exclude_integrations": [],
        "battery_fields": ["battery", "area"],
        "notify_new": False,
        "new_window": 5,
        "new_persistent": False,
        "new_fields": ["area", "integration"],
        "new_exclude_integrations": [],
        "notify_charge": False,
        "charge_full": 100,
        "charge_rise": 20,
        "notify_charge_stop": False,
        "charge_stall": 15,
        "charge_live": False,
        "routines_pause": False,
        "routines_catch_up": 10,
        "routines_notify_error": True,
        "status_notify": True,
        "charge_live_integrations": {},
        "charge_integrations": [],
        "notify_updates": False,
        "updates_window": 5,
        "updates_mode": "daily",
        "updates_time": "09:00",
        "updates_repeat": "never",
        "updates_kinds": ["core", "addons", "hacs"],
        "charge_full_integrations": {},
        "charge_rise_integrations": {},
        "charge_stall_integrations": {},
        "charge_stop_integrations": {},
        "updates_exclude": [],
        "updates_include": [],
        "outage_persistent": False,
        "battery_push_mode": "instant",
        "battery_push_time": "08:00",
        "battery_push_daily": "new",
    }
    assert result["limits"] == {
        "offline_after": [1, 60], "flaky_outages": [2, 50], "startup_grace": [0, 30], "battery_low": [1, 50], "notify_delay": [1, 60], "new_window": [1, 60], "updates_window": [1, 60], "charge_full": [50, 100], "charge_rise": [2, 80], "charge_stall": [5, 120], "routines_catch_up": [0, 60],
    }
    assert set(result["panel"]) == {"prerelease", "prerelease_hacs", "auto_update"}

    await client.send_json({"id": 2, "type": f"{DOMAIN}/set_options", "values": {CONF_UPDATE_CHECK: False}})
    assert (await client.receive_json())["result"] == {"changed": True}
    await hass.async_block_till_done()
    assert entry.options[CONF_UPDATE_CHECK] is False
    # Prüfung aus: Meldung verschwindet sofort.
    assert ir.async_get(hass).async_get_issue(DOMAIN, update_check.ISSUE_ID) is None

    await client.send_json({"id": 3, "type": f"{DOMAIN}/set_options", "values": {CONF_UPDATE_CHECK: False}})
    assert (await client.receive_json())["result"] == {"changed": False}
    await client.send_json({"id": 4, "type": f"{DOMAIN}/set_options", "values": {CONF_UPDATE_CHECK: "vielleicht"}})
    assert (await client.receive_json())["error"]["code"] == "invalid_format"
    await client.send_json({"id": 5, "type": f"{DOMAIN}/set_options", "values": {"gibt_es_nicht": True}})
    assert (await client.receive_json())["error"]["code"] == "invalid_format"
    # Filter-Chips: nur bekannte Verbindungsarten, sortiert und ohne Doppelte
    await client.send_json({"id": 6, "type": f"{DOMAIN}/set_options", "values": {"hide_connections": ["thread", "ble", "thread"]}})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    assert entry.options["hide_connections"] == ["ble", "thread"]
    await client.send_json({"id": 7, "type": f"{DOMAIN}/set_options", "values": {"hide_connections": ["funk"]}})
    assert (await client.receive_json())["error"]["code"] == "invalid_format"
    await client.send_json({"id": 8, "type": f"{DOMAIN}/list_devices"})
    assert (await client.receive_json())["result"]["hide_connections"] == ["ble", "thread"]
    # Reihenfolge der Chips: wie gegeben (nicht sortiert), ohne Doppelte
    await client.send_json({"id": 9, "type": f"{DOMAIN}/set_options", "values": {"connection_order": ["wifi", "zigbee", "wifi"]}})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    assert entry.options["connection_order"] == ["wifi", "zigbee"]
    await client.send_json({"id": 10, "type": f"{DOMAIN}/set_options", "values": {"connection_order": ["funk"]}})
    assert (await client.receive_json())["error"]["code"] == "invalid_format"
    await client.send_json({"id": 11, "type": f"{DOMAIN}/list_devices"})
    assert (await client.receive_json())["result"]["connection_order"] == ["wifi", "zigbee"]
    # Übrige Filter-Chips (1.11.0): nur bekannte Schlüssel, in fester Reihenfolge, ohne Doppelte
    await client.send_json({"id": 12, "type": f"{DOMAIN}/set_options", "values": {"hide_chips": ["new", "area", "problems", "offline", "area"]}})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    assert entry.options["hide_chips"] == ["area", "offline", "problems", "new"]
    await client.send_json({"id": 13, "type": f"{DOMAIN}/set_options", "values": {"hide_chips": ["alle"]}})
    assert (await client.receive_json())["error"]["code"] == "invalid_format"
    await client.send_json({"id": 14, "type": f"{DOMAIN}/list_devices"})
    assert (await client.receive_json())["result"]["hide_chips"] == ["area", "offline", "problems", "new"]
    await client.send_json({"id": 15, "type": f"{DOMAIN}/set_options", "values": {"hide_chips": []}})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    assert entry.options["hide_chips"] == []
    # Reihenfolge aller Chips (1.13.0, seit 1.14.0 mit "all" und den Verbindungsarten):
    # wie gegeben, ohne Doppelte; der Block "connections" aus 1.13.0 ist kein Schlüssel mehr
    order = ["battery", "area", "all", "wifi", "battery", "zigbee", "pin", "new"]
    await client.send_json({"id": 16, "type": f"{DOMAIN}/set_options", "values": {"chip_order": order}})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    assert entry.options["chip_order"] == ["battery", "area", "all", "wifi", "zigbee", "pin", "new"]
    await client.send_json({"id": 17, "type": f"{DOMAIN}/set_options", "values": {"chip_order": ["alle"]}})
    assert (await client.receive_json())["error"]["code"] == "invalid_format"
    await client.send_json({"id": 18, "type": f"{DOMAIN}/set_options", "values": {"chip_order": ["connections"]}})
    assert (await client.receive_json())["error"]["code"] == "invalid_format"
    await client.send_json({"id": 19, "type": f"{DOMAIN}/list_devices"})
    assert (await client.receive_json())["result"]["chip_order"] == ["battery", "area", "all", "wifi", "zigbee", "pin", "new"]
    await client.send_json({"id": 20, "type": f"{DOMAIN}/set_options", "values": {"chip_order": []}})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    assert entry.options["chip_order"] == []


async def test_signal_thresholds_from_panel(hass: HomeAssistant, entry, hass_ws_client, github_offline) -> None:
    """Warnschwelle des Empfangs pro Funkart, global und pro Integration, gültig geprüft und gespeichert."""
    client = await hass_ws_client(hass)
    values = {"signal_low": {"zigbee": 40, "wifi": -85, "ble": "off"}, "signal_low_integrations": {"shelly": {"wifi": -90}, "zha": {}}}
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_options", "values": values})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    assert entry.options["signal_low"] == {"ble": "off", "wifi": -85, "zigbee": 40}
    assert entry.options["signal_low_integrations"] == {"shelly": {"wifi": -90}}
    for i, bad in enumerate(({"signal_low": {"funk": -85}}, {"signal_low": {"wifi": -20}}, {"signal_low_integrations": {"shelly": {"wifi": 0}}}), start=2):
        await client.send_json({"id": i, "type": f"{DOMAIN}/set_options", "values": bad})
        assert (await client.receive_json())["error"]["code"] == "invalid_format"
    await client.send_json({"id": 5, "type": f"{DOMAIN}/get_options"})
    got = (await client.receive_json())["result"]["values"]
    assert got["signal_low"] == {"ble": "off", "wifi": -85, "zigbee": 40}
    assert got["signal_low_integrations"] == {"shelly": {"wifi": -90}}
    # Zurücksetzen
    await client.send_json({"id": 6, "type": f"{DOMAIN}/set_options", "values": {"signal_low": {}, "signal_low_integrations": {}}})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    assert entry.options["signal_low"] == {} and entry.options["signal_low_integrations"] == {}


async def test_options_flow(hass: HomeAssistant, entry) -> None:
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "init"
    # Reihenfolge wie im Panel (seit 0.34.0): Überwachung und Meldungen (Ziel,
    # Ausfall, Batterie, pro Integration), Ausschlüsse, Anzeige, KI, Updates.
    assert [str(k) for k in result["data_schema"].schema] == [
        "notify_service", "notify_click_target", "offline_after", "notify_delay", "flaky_outages", "startup_grace",
        "notify_outage", "notify_online", "notify_group", "outage_persistent", "notify_fields",
        "battery_low", "battery_push", "battery_push_mode", "battery_push_time", "battery_push_daily", "battery_persistent", "battery_fields",
        "notify_charge", "charge_full", "charge_rise", "notify_charge_stop", "charge_stall", "charge_live", "charge_integrations",
        "notify_new", "new_window", "new_persistent", "new_fields",
        "notify_updates", "updates_mode", "updates_time", "updates_window", "updates_repeat", "updates_kinds",
        "routines_pause", "routines_catch_up", "routines_notify_error",
        "offline_after_integrations", "notify_exclude_integrations", "persistent_exclude_integrations", "battery_low_integrations",
        "battery_push_exclude_integrations", "new_exclude_integrations", "exclude_integrations", "exclude_types", "exclude_devices",
        "show_service_devices", "show_disabled_devices", "hide_chips", "hide_connections",
        "connection_order", "connection_integrations", "type_integrations", "signal_low", "signal_low_integrations", "ai_assessment", "ai_task_entity", "update_check",
    ]
    # "Ausgefallen nach" über "Erst melden nach" (2): Fehler am Feld, nichts gespeichert.
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {CONF_UPDATE_CHECK: False, "offline_after": 10.0, "show_disabled_devices": True}
    )
    assert result["type"] is FlowResultType.FORM and result["errors"] == {"notify_delay": "notify_delay_short"}
    assert "offline_after" not in entry.options
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {CONF_UPDATE_CHECK: False, "offline_after": 10.0, "notify_delay": 10.0, "show_disabled_devices": True}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options[CONF_UPDATE_CHECK] is False
    # Ganze Zahlen wie aus dem Panel, nicht 10.0; nicht genannte Felder mit Standard.
    assert entry.options["offline_after"] == 10 and type(entry.options["offline_after"]) is int
    assert entry.options["flaky_outages"] == 3 and entry.options["startup_grace"] == 5
    assert entry.options["show_disabled_devices"] is True and entry.options["show_service_devices"] is False
    # Ausfall-Meldungen (0.20.0): Inhalt in fester Reihenfolge.
    assert entry.options["notify_delay"] == 10 and entry.options["notify_fields"] == ["area", "integration", "since"]
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"notify_delay": 15.0, "notify_fields": ["model", "area"], "outage_persistent": True}
    )
    assert entry.options["notify_delay"] == 15 and entry.options["notify_fields"] == ["area", "model"]
    # Batterie (0.34.0): Inhalt in fester Reihenfolge, Push pro Integration.
    assert entry.options["battery_fields"] == ["battery", "area"] and entry.options["battery_push_exclude_integrations"] == []
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"battery_fields": ["model", "battery"]})
    assert entry.options["battery_fields"] == ["battery", "model"]
    # Integrationen zur Wahl gibt es nur mit Geräten (siehe Ausschlüsse unten).
    assert entry.options["notify_exclude_integrations"] == [] and entry.options["outage_persistent"] is True

    # Zu gross: der Selektor lehnt ab, gespeichert bleibt der alte Wert.
    result = await hass.config_entries.options.async_init(entry.entry_id)
    with pytest.raises(InvalidData):
        await hass.config_entries.options.async_configure(result["flow_id"], {"offline_after": 61})
    assert entry.options["offline_after"] == 10


async def test_panel_settings_persist(hass: HomeAssistant, entry, hass_ws_client, hass_storage: dict[str, Any]) -> None:
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_panel", "prerelease": True, "prerelease_hacs": "switch.device_panel_pre_release"})
    assert (await client.receive_json())["result"] == {"prerelease": True, "prerelease_hacs": "switch.device_panel_pre_release", "auto_update": False}
    stored = hass_storage[f"{DOMAIN}.panel"]["data"]
    assert stored == {"prerelease": True, "prerelease_hacs": "switch.device_panel_pre_release", "auto_update": False, "notified": {}}
    await client.send_json({"id": 2, "type": f"{DOMAIN}/set_panel", "prerelease_hacs": None})
    assert (await client.receive_json())["result"]["prerelease_hacs"] is None


async def test_prerelease_default_follows_installed(hass: HomeAssistant, entry) -> None:
    # Nie gespeichert: wer eine Vorabversion installiert hat, bekommt die nächsten angeboten.
    installed = await update_check.async_installed_version(hass)
    assert update_check.panel_settings(hass)["prerelease"] is update_check.is_prerelease(installed)


async def test_stored_prerelease_wins(hass: HomeAssistant, hass_storage: dict[str, Any]) -> None:
    hass_storage[f"{DOMAIN}.panel"] = {"version": 1, "minor_version": 1, "key": f"{DOMAIN}.panel", "data": {"prerelease": False}}
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    assert update_check.panel_settings(hass)["prerelease"] is False


async def test_unload_removes_issue(hass: HomeAssistant, entry, github_offline) -> None:
    github_offline[LATEST] = (_release("v99.0.0"), None)
    await update_check.async_refresh_issue(hass)
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert ir.async_get(hass).async_get_issue(DOMAIN, update_check.ISSUE_ID) is None


async def test_github_answers(hass: HomeAssistant, aioclient_mock) -> None:
    """Die echte Abfrage: Daten, Fehler, Abfragelimit als eigener Code."""
    aioclient_mock.get(LATEST, json=_release("v1.2.3"))
    assert await REAL_GET_JSON(hass, LATEST) == (_release("v1.2.3"), None)
    aioclient_mock.clear_requests()
    aioclient_mock.get(LATEST, status=403, headers={"X-RateLimit-Remaining": "0"})
    assert await REAL_GET_JSON(hass, LATEST) == (None, update_check.RATE_LIMIT)
    aioclient_mock.clear_requests()
    aioclient_mock.get(LATEST, status=403)
    assert await REAL_GET_JSON(hass, LATEST) == (None, "HTTP 403")


async def test_options_flow_with_exclusions(hass: HomeAssistant, entry) -> None:
    source = MockConfigEntry(domain="hue", title="Bridge")
    source.add_to_hass(hass)
    from homeassistant.helpers import device_registry as dr, entity_registry as er

    dev = dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={("hue", "x")}, name="Lampe")
    er.async_get(hass).async_get_or_create("light", "hue", "x", device_id=dev.id)
    result = await hass.config_entries.options.async_init(entry.entry_id)
    schema = {str(k): k for k in result["data_schema"].schema}
    assert {"update_check", "exclude_integrations", "exclude_types"} <= set(schema)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {CONF_UPDATE_CHECK: True, "exclude_integrations": ["hue"], "exclude_types": []}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options["exclude_integrations"] == ["hue"]
    assert entry.options["exclude_types"] == []


async def test_options_flow_hide_connections(hass: HomeAssistant, entry) -> None:
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"hide_connections": ["thread", "ble", "thread"]})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    # Wie aus dem Panel: sortiert, ohne Doppelte
    assert entry.options["hide_connections"] == ["ble", "thread"]
    # Leere Auswahl überschreibt die alte
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"hide_connections": []})
    assert entry.options["hide_connections"] == []
    # Unbekannte Verbindungsart lehnt der Selektor ab
    result = await hass.config_entries.options.async_init(entry.entry_id)
    with pytest.raises(InvalidData):
        await hass.config_entries.options.async_configure(result["flow_id"], {"hide_connections": ["funk"]})


async def test_options_flow_keeps_chip_order(hass: HomeAssistant, entry) -> None:
    """Die Reihenfolge der Chips (nur im Panel gesetzt) überlebt den Optionsdialog."""
    hass.config_entries.async_update_entry(entry, options={**entry.options, "chip_order": ["battery", "area"]})
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"hide_connections": ["ble"]})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options["chip_order"] == ["battery", "area"]


def test_chip_order_from_1_13_0() -> None:
    """Der Block "connections" aus 1.13.0 wird zu "all" und der Folge der Verbindungsarten."""
    from custom_components.device_panel.options_api import current_values

    class _Entry:
        options = {
            "chip_order": ["battery", "area", "connections", "new", "unbekannt", "area"],
            "connection_order": ["wifi", "zigbee"],
        }

    values = current_values(_Entry())
    assert values["chip_order"] == ["battery", "area", "all", "wifi", "zigbee", "new"]
    # Ohne Ausgangsfolge der Verbindungsarten bleibt nur "all"; die Arten ordnet das Panel nach Anzahl ein
    _Entry.options = {"chip_order": ["connections", "problems"]}
    assert current_values(_Entry())["chip_order"] == ["all", "problems"]
    # Neues Format unverändert, Unbekanntes fällt weg; der Anheft-Marker "pin" (1.15.0) bleibt
    _Entry.options = {"chip_order": ["all", "pin", "zigbee", "funk", "problems"]}
    assert current_values(_Entry())["chip_order"] == ["all", "pin", "zigbee", "problems"]


async def test_options_flow_connection_per_integration(hass: HomeAssistant, entry) -> None:
    result = await hass.config_entries.options.async_init(entry.entry_id)
    # "unbekannt" ist keine Wahl: Fehler am Feld, nichts gespeichert
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"connection_integrations": {"hue": "unknown"}})
    assert result["errors"] == {"connection_integrations": "connection_map"}
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"connection_integrations": {"hue": "Zigbee", "esphome": "wifi"}})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options["connection_integrations"] == {"esphome": "wifi", "hue": "zigbee"}


async def test_options_flow_connection_order(hass: HomeAssistant, entry) -> None:
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"connection_order": ["wifi", "zigbee", "wifi"]})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    # Reihenfolge der Auswahl bleibt, Doppelte fallen weg
    assert entry.options["connection_order"] == ["wifi", "zigbee"]
    # Geleert: nach Anzahl
    result = await hass.config_entries.options.async_init(entry.entry_id)
    await hass.config_entries.options.async_configure(result["flow_id"], {"connection_order": []})
    assert entry.options["connection_order"] == []


async def test_options_flow_offline_per_integration(hass: HomeAssistant, entry) -> None:
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"offline_after_integrations": {"zha": 0}})
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"offline_after_integrations": "offline_map"}
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"offline_after_integrations": {"zha": 60.0, "hue": "off"}})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options["offline_after_integrations"] == {"hue": "off", "zha": 60}


async def test_options_flow_battery_per_integration(hass: HomeAssistant, entry) -> None:
    result = await hass.config_entries.options.async_init(entry.entry_id)
    # Ungültig: Fehler am Feld, die Eingaben bleiben stehen
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"battery_low_integrations": {"zha": 60}})
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"battery_low_integrations": "battery_map"}
    assert "battery_low_integrations" not in entry.options
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"battery_low_integrations": {"zha": 25.0, "bthome": 10, "hue": "off"}})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    # "off": Warnung für die Integration aus
    assert entry.options["battery_low_integrations"] == {"bthome": 10, "hue": "off", "zha": 25}


async def test_options_flow_push_time(hass: HomeAssistant, entry) -> None:
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"battery_push_mode": "daily", "battery_push_time": "07:30:00", "battery_push_daily": "all", "notify_outage": True}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    # Zeitfeld "HH:MM:SS" wird wie im Panel als "HH:MM" gespeichert.
    assert entry.options["battery_push_time"] == "07:30"
    assert entry.options["battery_push_mode"] == "daily" and entry.options["battery_push_daily"] == "all"
    assert entry.options["notify_outage"] is True and entry.options["notify_online"] is False


async def test_notify_delay_not_shorter_than_offline_after(hass: HomeAssistant, entry, hass_ws_client) -> None:
    """Seit 0.34.0 (Wunsch des Nutzers): "Erst melden nach" nie kürzer als "Ausgefallen nach"."""
    client = await hass_ws_client(hass)
    # Kürzer: abgelehnt, nichts gespeichert
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_options", "values": {"offline_after": 5, "notify_delay": 3}})
    assert (await client.receive_json())["error"]["code"] == "invalid_format"
    assert "offline_after" not in entry.options
    # Gleich lang: erlaubt
    await client.send_json({"id": 2, "type": f"{DOMAIN}/set_options", "values": {"offline_after": 5, "notify_delay": 5}})
    assert (await client.receive_json())["result"] == {"changed": True}
    # "Ausgefallen nach" später über "Erst melden nach": abgelehnt, nicht still angepasst
    await client.send_json({"id": 3, "type": f"{DOMAIN}/set_options", "values": {"offline_after": 8}})
    assert (await client.receive_json())["error"]["code"] == "invalid_format"
    assert entry.options["offline_after"] == 5
    # 0 ("sobald ausgefallen") gibt es nicht mehr
    await client.send_json({"id": 4, "type": f"{DOMAIN}/set_options", "values": {"notify_delay": 0}})
    assert (await client.receive_json())["error"]["code"] == "invalid_format"


async def test_old_notify_delay_counts_as_offline_after(hass: HomeAssistant, entry, hass_ws_client) -> None:
    """Gespeichert vor 0.34.0 (0 = sobald ausgefallen, oder kürzer): gilt als "Ausgefallen nach", kein Fehler."""
    hass.config_entries.async_update_entry(entry, options={**entry.options, "offline_after": 5, "notify_delay": 0})
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/get_options"})
    assert (await client.receive_json())["result"]["values"]["notify_delay"] == 5
    # Andere Einstellungen lassen sich weiter speichern, auch "Ausgefallen nach"
    await client.send_json({"id": 2, "type": f"{DOMAIN}/set_options", "values": {"offline_after": 7}})
    assert (await client.receive_json())["result"] == {"changed": True}
    await client.send_json({"id": 3, "type": f"{DOMAIN}/get_options"})
    assert (await client.receive_json())["result"]["values"]["notify_delay"] == 7
    # Ein kürzerer Wert aus früheren Versionen gilt ebenso als "Ausgefallen nach"
    hass.config_entries.async_update_entry(entry, options={**entry.options, "notify_delay": 3})
    await hass.async_block_till_done()
    await client.send_json({"id": 4, "type": f"{DOMAIN}/get_options"})
    assert (await client.receive_json())["result"]["values"]["notify_delay"] == 7


async def test_options_flow_hide_chips(hass: HomeAssistant, entry) -> None:
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"hide_chips": ["signal", "area", "signal"]})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options["hide_chips"] == ["area", "signal"]
    # Leere Auswahl überschreibt die alte
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"hide_chips": []})
    assert entry.options["hide_chips"] == []
    # Unbekannter Chip: vom Selektor abgelehnt
    result = await hass.config_entries.options.async_init(entry.entry_id)
    with pytest.raises(InvalidData):
        await hass.config_entries.options.async_configure(result["flow_id"], {"hide_chips": ["alle"]})


# -- Automatisch installieren (seit 2.22.0) --------------------------------------


async def _hacs_entity(hass: HomeAssistant, installed: str, latest: str, **extra: Any) -> str:
    """Update-Entität von HACS für dieses Repository (Registry-Eintrag und Zustand)."""
    entity = er.async_get(hass).async_get_or_create("update", "hacs", "device_panel_x", suggested_object_id="device_panel_update")
    hass.states.async_set(
        entity.entity_id,
        "on",
        {"installed_version": installed, "latest_version": latest, "release_url": f"https://github.com/{update_check.GITHUB_REPO}/releases/tag/v{latest}", **extra},
    )
    return entity.entity_id


async def _auto_setup(hass: HomeAssistant, entry, github_offline, auto: bool = True, prerelease: bool = False) -> list:
    await update_check.async_set_panel_settings(hass, {"auto_update": auto, "prerelease": prerelease})
    async_mock_service(hass, "homeassistant", "update_entity")
    return async_mock_service(hass, "update", "install")


async def test_auto_update_installs_and_asks_for_restart(hass: HomeAssistant, entry, github_offline) -> None:
    installed = await update_check.async_installed_version(hass)
    calls = await _auto_setup(hass, entry, github_offline)
    entity = await _hacs_entity(hass, installed, "99.0.0")
    assert await update_check.async_auto_install(hass) is True
    assert [c.data["entity_id"] for c in calls] == [entity]
    issue = ir.async_get(hass).async_get_issue(DOMAIN, update_check.RESTART_ISSUE_ID)
    assert issue is not None and issue.translation_placeholders == {"latest": "99.0.0", "installed": installed}


async def test_auto_update_needs_switch_and_daily_check(hass: HomeAssistant, entry, github_offline) -> None:
    installed = await update_check.async_installed_version(hass)
    calls = await _auto_setup(hass, entry, github_offline, auto=False)
    await _hacs_entity(hass, installed, "99.0.0")
    assert await update_check.async_auto_install(hass) is False
    # Schalter an, aber tägliche Prüfung aus: wirkungslos
    await update_check.async_set_panel_settings(hass, {"auto_update": True})
    hass.config_entries.async_update_entry(entry, options={**entry.options, CONF_UPDATE_CHECK: False})
    await hass.async_block_till_done()
    assert update_check.auto_update_active(hass) is False
    assert await update_check.async_auto_install(hass) is False
    assert calls == []


async def test_auto_update_skips_current_pending_restart_and_beta(hass: HomeAssistant, entry, github_offline) -> None:
    installed = await update_check.async_installed_version(hass)
    calls = await _auto_setup(hass, entry, github_offline)
    await _hacs_entity(hass, installed, installed)  # nichts Neues
    assert await update_check.async_auto_install(hass) is False
    await _hacs_entity(hass, "99.0.0", "99.0.0")  # schon geladen, wartet auf den Neustart
    assert await update_check.async_auto_install(hass) is False
    await _hacs_entity(hass, installed, "99.1.0b1")  # Vorabversion ohne den Wunsch danach
    assert await update_check.async_auto_install(hass) is False
    await _hacs_entity(hass, installed, "99.0.0", in_progress=True)
    assert await update_check.async_auto_install(hass) is False
    assert calls == []
    await update_check.async_set_panel_settings(hass, {"prerelease": True})
    await _hacs_entity(hass, installed, "99.1.0b1")
    assert await update_check.async_auto_install(hass) is True
    assert len(calls) == 1


async def test_auto_update_failure_is_logged_not_raised(hass: HomeAssistant, entry, github_offline) -> None:
    from custom_components.device_panel import activity

    installed = await update_check.async_installed_version(hass)
    await update_check.async_set_panel_settings(hass, {"auto_update": True})
    async_mock_service(hass, "homeassistant", "update_entity")
    await _hacs_entity(hass, installed, "99.0.0")  # kein Dienst update.install registriert
    assert await update_check.async_auto_install(hass) is False
    assert any(e["cat"] == "updates" and "99.0.0" in e["text"] for e in activity.get(hass).entries)
    assert ir.async_get(hass).async_get_issue(DOMAIN, update_check.RESTART_ISSUE_ID) is None


async def test_auto_update_without_hacs_does_nothing(hass: HomeAssistant, entry, github_offline) -> None:
    calls = await _auto_setup(hass, entry, github_offline)
    assert await update_check.async_auto_install(hass) is False
    assert calls == []


async def test_set_panel_auto_update(hass: HomeAssistant, entry, hass_ws_client, hass_storage: dict[str, Any]) -> None:
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_panel", "auto_update": True})
    assert (await client.receive_json())["result"]["auto_update"] is True
    assert hass_storage[f"{DOMAIN}.panel"]["data"]["auto_update"] is True


async def test_auto_update_starts_as_soon_as_a_check_finds_a_version(hass: HomeAssistant, entry, github_offline) -> None:
    """Seit 2.23.0: jede Prüfung, die eine neuere Version findet, stösst die Installation an (nicht nur der tägliche Lauf)."""
    from unittest.mock import AsyncMock, MagicMock

    installed = await update_check.async_installed_version(hass)
    calls = await _auto_setup(hass, entry, github_offline)
    github_offline[LATEST] = (_release("v99.0.0"), None)
    # HACS kennt die Version erst nach dem Neuladen des Repositories (hier: das Neuladen setzt sie)
    entity = await _hacs_entity(hass, installed, installed)
    repo = MagicMock()

    async def refresh(**_kwargs: Any) -> None:
        await _hacs_entity(hass, installed, "99.0.0")

    repo.update_repository = AsyncMock(side_effect=refresh)
    hacs = MagicMock()
    hacs.repositories.get_by_full_name.return_value = repo
    hass.data["hacs"] = hacs
    await update_check.async_refresh_issue(hass)
    await hass.async_block_till_done()
    repo.update_repository.assert_awaited()
    assert [c.data["entity_id"] for c in calls] == [entity]
    assert ir.async_get(hass).async_get_issue(DOMAIN, update_check.RESTART_ISSUE_ID) is not None


async def test_no_install_trigger_when_auto_update_is_off(hass: HomeAssistant, entry, github_offline) -> None:
    installed = await update_check.async_installed_version(hass)
    calls = await _auto_setup(hass, entry, github_offline, auto=False)
    github_offline[LATEST] = (_release("v99.0.0"), None)
    await _hacs_entity(hass, installed, "99.0.0")
    await update_check.async_refresh_issue(hass)
    await hass.async_block_till_done()
    assert calls == []


# -- Push zum Panel-Update und Uhrzeit der Prüfung (seit 2.25.0) ---------------------------------------------------------


def _notify_options(hass: HomeAssistant, entry, **extra: Any) -> None:
    hass.config_entries.async_update_entry(entry, options={**entry.options, "update_notify": True, "notify_service": "notify.handy", **extra})


async def test_push_when_update_found_once_per_version(hass: HomeAssistant, entry, github_offline) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    github_offline[LATEST] = (_release("v99.0.0"), None)
    _notify_options(hass, entry)
    await hass.async_block_till_done()
    await update_check.async_refresh_issue(hass)
    assert len(handy) == 1
    assert "99.0.0" in handy[0].data["title"] and handy[0].data["data"]["url"] == "/device-panel"
    # Neue Version: wieder eine Meldung
    await update_check.async_refresh_issue(hass, {"latest": "99.1.0"})
    assert len(handy) == 2 and "99.1.0" in handy[1].data["title"]


async def test_no_push_when_switch_is_off_or_no_target(hass: HomeAssistant, entry, github_offline) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    github_offline[LATEST] = (_release("v99.0.0"), None)
    hass.config_entries.async_update_entry(entry, options={**entry.options, "notify_service": "notify.handy"})
    await update_check.async_refresh_issue(hass)
    assert handy == []
    _notify_options(hass, entry, notify_service="none")
    await update_check.async_refresh_issue(hass)
    assert handy == []


async def test_push_goes_to_own_recipient(hass: HomeAssistant, entry, github_offline) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    familie = async_mock_service(hass, "notify", "familie")
    github_offline[LATEST] = (_release("v99.0.0"), None)
    _notify_options(hass, entry, notify_service_panelupdate="notify.familie")
    await hass.async_block_till_done()
    await update_check.async_refresh_issue(hass)
    assert handy == [] and len(familie) == 1


async def test_push_after_automatic_installation_instead_of_found(hass: HomeAssistant, entry, github_offline) -> None:
    handy = async_mock_service(hass, "notify", "handy")
    installed = await update_check.async_installed_version(hass)
    await _auto_setup(hass, entry, github_offline)
    github_offline[LATEST] = (_release("v99.0.0"), None)
    await _hacs_entity(hass, installed, "99.0.0")
    _notify_options(hass, entry)
    await hass.async_block_till_done()
    await update_check.async_refresh_issue(hass)
    await hass.async_block_till_done()
    assert len(handy) == 1
    assert "installiert" in handy[0].data["title"] or "installed" in handy[0].data["title"]
    # Merkt sich: nicht noch einmal
    await update_check.async_notify(hass, "done", "99.0.0", installed)
    assert len(handy) == 1


async def test_failed_push_is_tried_again(hass: HomeAssistant, entry, github_offline) -> None:
    github_offline[LATEST] = (_release("v99.0.0"), None)
    _notify_options(hass, entry)
    await hass.async_block_till_done()  # notify.handy gibt es (noch) nicht: nichts gemerkt
    assert update_check.panel_settings(hass).get("notified") is None
    handy = async_mock_service(hass, "notify", "handy")
    await update_check.async_refresh_issue(hass)
    assert len(handy) == 1


def test_check_time_option_is_validated() -> None:
    from custom_components.device_panel import options_api

    assert options_api.values_from({"update_check_time": "04:30"})["update_check_time"] == "04:30"
    assert options_api.values_from({"update_check_time": "25:99"})["update_check_time"] == ""
    assert options_api.values_from({})["update_check_time"] == ""
    assert options_api.values_from({"update_check_time": "09:05:00"})["update_check_time"] == "09:05"


async def test_daily_check_runs_at_the_set_time(hass: HomeAssistant, entry, github_offline, freezer) -> None:
    from datetime import timedelta

    from homeassistant.util import dt as dt_util
    from pytest_homeassistant_custom_component.common import async_fire_time_changed

    freezer.move_to("2026-10-12 03:00:00+00:00")
    update_check.async_stop_daily(hass)
    github_offline[LATEST] = (_release("v99.0.0"), None)
    local = dt_util.now()
    at = (local + timedelta(minutes=30)).strftime("%H:%M")
    hass.config_entries.async_update_entry(entry, options={**entry.options, "update_check_time": at})
    await hass.async_block_till_done()
    # Die Änderung der Optionen löst selbst eine Prüfung aus: Meldung entfernen, dann muss erst die Uhrzeit sie wieder anlegen
    ir.async_delete_issue(hass, DOMAIN, update_check.ISSUE_ID)
    update_check.async_start_daily(hass)
    assert ir.async_get(hass).async_get_issue(DOMAIN, update_check.ISSUE_ID) is None
    freezer.tick(timedelta(minutes=31))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert ir.async_get(hass).async_get_issue(DOMAIN, update_check.ISSUE_ID) is not None
    # Zeit geändert: neu gesetzt; gleiche Zeit: bleibt
    first = list(hass.data[update_check._TIMER_KEY])
    update_check.async_reschedule_daily(hass)
    assert hass.data[update_check._TIMER_KEY] == first
    hass.config_entries.async_update_entry(entry, options={**entry.options, "update_check_time": ""})
    update_check.async_reschedule_daily(hass)
    assert hass.data[update_check._TIME_KEY] == ""
