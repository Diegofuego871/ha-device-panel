"""Gemeinsame Fixtures: echtes Home Assistant über pytest-homeassistant-custom-component."""

from __future__ import annotations

import pytest

pytest_plugins = "pytest_homeassistant_custom_component"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Lädt custom_components/device_panel in jedem Test."""
    yield


@pytest.fixture(autouse=True)
def skip_frontend(hass):
    """Das Testpaket bringt das HA-Frontend nicht mit: als geladen markieren."""
    hass.config.components.add("frontend")
    yield
