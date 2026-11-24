"""Reiter "Magic Push" im Geräte-Fenster (2.246.0): Standard aus; bestehende Installationen einmalig nach Meldungen umgestellt."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel import magic, options_api
from custom_components.device_panel.const import DOMAIN


async def _setup(hass: HomeAssistant, options: dict[str, Any]) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options={"status_notify": False, **options})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def _rules(hass_storage: dict[str, Any], count: int) -> None:
    rules = {f"abcdefabcde{i}": {"id": f"abcdefabcde{i}", "name": "x"} for i in range(count)}
    hass_storage[magic.STORE_KEY] = {"version": 1, "data": {"rules": rules, "runtime": {}}}


async def test_default_is_off_without_rules(hass: HomeAssistant) -> None:
    """Neue Installation: Reiter aus; die Umstellung merkt sich, dass sie gelaufen ist."""
    entry = await _setup(hass, {})
    assert options_api.effective(hass)["show_tab_magic"] is False
    assert entry.options["tab_magic_decided"] is True


async def test_existing_install_with_rules_turns_on(hass: HomeAssistant, hass_storage: dict[str, Any]) -> None:
    """Bestehende Installation mit mindestens einer Meldung: Reiter an."""
    _rules(hass_storage, 1)
    await _setup(hass, {})
    assert options_api.effective(hass)["show_tab_magic"] is True


async def test_existing_install_with_stored_on_but_no_rules_turns_off(hass: HomeAssistant) -> None:
    """Der frühere Standard "an" (2.244.0/2.245.0) ohne Meldungen: aus."""
    await _setup(hass, {"show_tab_magic": True})
    assert options_api.effective(hass)["show_tab_magic"] is False


async def test_explicit_off_stays_off_even_with_rules(hass: HomeAssistant, hass_storage: dict[str, Any]) -> None:
    """Wer den Reiter bewusst ausgeschaltet hat, behält das."""
    _rules(hass_storage, 2)
    await _setup(hass, {"show_tab_magic": False})
    assert options_api.effective(hass)["show_tab_magic"] is False


async def test_migration_runs_only_once(hass: HomeAssistant) -> None:
    """Hat der Nutzer den Reiter später selbst eingeschaltet (ohne Meldungen), bleibt er an."""
    await _setup(hass, {"show_tab_magic": True, "tab_magic_decided": True})
    assert options_api.effective(hass)["show_tab_magic"] is True
