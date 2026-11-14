"""Dashboard-Karten (2.216.0): Anmeldung im Frontend, scheiternde Anmeldung, Datei ohne Geheimnisse."""

from __future__ import annotations

import re
from pathlib import Path
from unittest.mock import patch

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel.const import CARD_URL, DATA_CARDS, DOMAIN, PANEL_STATIC_URL_PATH, PANEL_VERSION

PANEL = Path(__file__).parent.parent / "custom_components" / "device_panel" / "panel"


async def _setup(hass: HomeAssistant) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()


async def test_card_module_is_registered_once(hass: HomeAssistant) -> None:
    hass.data["frontend_extra_module_url"] = set()
    await _setup(hass)
    assert CARD_URL in hass.data["frontend_extra_module_url"]
    assert CARD_URL == f"{PANEL_STATIC_URL_PATH}/card.js?v={PANEL_VERSION}"
    assert hass.data[DATA_CARDS] is True


async def test_a_failing_card_registration_never_stops_the_integration(hass: HomeAssistant, caplog) -> None:
    with patch("custom_components.device_panel.frontend.add_extra_js_url", side_effect=RuntimeError("kaputt")):
        await _setup(hass)
    assert hass.config_entries.async_entries(DOMAIN)[0].state.value == "loaded"
    assert "Dashboard-Karten" in caplog.text


def test_card_file_exists_and_holds_nothing_secret() -> None:
    source = (PANEL / "card.js").read_text(encoding="utf-8")
    # Alle drei Karten angemeldet, nur der Sensor wird gelesen: kein WebSocket-Befehl, kein Token
    for tag in ("device-panel-card", "device-panel-availability-card", "device-panel-offline-card"):
        assert f'"{tag}"' in source
    assert not re.search(r"callApi|fetch\(|accessToken|auth\.", source)
    # Einzige Abfrage: die eigenen Daten des Benutzers (Einstellung "Animationen"), kein Befehl des Panels
    assert re.findall(r"callWS\(\{ type: \"([^\"]+)\"", source) == ["frontend/get_user_data"]
    assert "ß" not in source
