"""Versionsprüfung, Vorabversionen, Reparatur-Meldung, Optionen und Panel-Einstellungen mit echtem HA."""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.helpers import issue_registry as ir
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel import update_check
from custom_components.device_panel.const import CONF_UPDATE_CHECK, DOMAIN

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
    assert result["values"] == {CONF_UPDATE_CHECK: True}
    assert set(result["panel"]) == {"prerelease", "prerelease_hacs"}

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


async def test_options_flow(hass: HomeAssistant, entry) -> None:
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "init"
    result = await hass.config_entries.options.async_configure(result["flow_id"], {CONF_UPDATE_CHECK: False})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options[CONF_UPDATE_CHECK] is False


async def test_panel_settings_persist(hass: HomeAssistant, entry, hass_ws_client, hass_storage: dict[str, Any]) -> None:
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_panel", "prerelease": True, "prerelease_hacs": "switch.device_panel_pre_release"})
    assert (await client.receive_json())["result"] == {"prerelease": True, "prerelease_hacs": "switch.device_panel_pre_release"}
    stored = hass_storage[f"{DOMAIN}.panel"]["data"]
    assert stored == {"prerelease": True, "prerelease_hacs": "switch.device_panel_pre_release"}
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
