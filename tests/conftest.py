"""Gemeinsame Fixtures: echtes Home Assistant über pytest-homeassistant-custom-component."""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest

# Beim Sammeln importieren wie die Testmodule: später ist custom_components
# je nach Reihenfolge schon das Testpaket von Home Assistant.
from custom_components.device_panel import update_check

# Echte Abfrage (vor dem Patch), für Tests mit aioclient_mock.
REAL_GET_JSON = update_check._async_get_json

pytest_plugins = "pytest_homeassistant_custom_component"

# Antworten von GitHub in Tests: ohne Eintrag kein stabiles Release (404) und
# keine Vorabversion. Tests setzen eigene Werte (siehe test_update_check.py).
GITHUB: dict[str, tuple[Any, str | None]] = {}


@pytest.fixture(autouse=True)
def github_offline():
    """
    Kein echter Zugriff auf GitHub. Steht vor allen Fixtures, die hass
    starten: so gilt der Patch auch noch beim Aufräumen von hass (Entladen,
    Zeitgeber der täglichen Prüfung).
    """
    GITHUB.clear()

    async def fake(_hass, url):
        if url in GITHUB:
            return GITHUB[url]
        return ([], None) if url == update_check.RELEASES_URL else (None, "HTTP 404")

    with patch.object(update_check, "_async_get_json", fake):
        yield GITHUB


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Lädt custom_components/device_panel in jedem Test."""
    yield


@pytest.fixture(autouse=True)
def skip_frontend(hass):
    """Das Testpaket bringt das HA-Frontend nicht mit: als geladen markieren."""
    hass.config.components.add("frontend")
    yield
