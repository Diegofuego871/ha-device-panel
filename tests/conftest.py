"""Gemeinsame Fixtures: echtes Home Assistant über pytest-homeassistant-custom-component."""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest

# Beim Sammeln importieren wie die Testmodule: später ist custom_components
# je nach Reihenfolge schon das Testpaket von Home Assistant.
from custom_components.device_panel import battery_guard, update_check

# Echte Abfrage (vor dem Patch), für Tests mit aioclient_mock.
REAL_GET_JSON = update_check._async_get_json

pytest_plugins = "pytest_homeassistant_custom_component"

# Antworten von GitHub in Tests: ohne Eintrag kein stabiles Release (404) und
# keine Vorabversion. Tests setzen eigene Werte (siehe test_update_check.py).
GITHUB: dict[str, tuple[Any, str | None]] = {}


@pytest.fixture(autouse=True)
def isolated_push_icons(tmp_path, monkeypatch):
    """
    Push-Icons je Test in einem eigenen Ordner. Sonst läge er im gemeinsamen Konfigurationsordner der Tests
    (.storage/device_panel_icons): Dateien aus einem Test wären im nächsten noch da, und gleichzeitige Läufe
    (zwei Aufrufe von pytest) stören sich gegenseitig.
    """
    import custom_components.device_panel as integration  # noqa: PLC0415 - wie die Testmodule, nicht beim Sammeln

    monkeypatch.setattr(integration, "_icon_dir", lambda _hass: tmp_path / "push_icons")


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


@pytest.fixture
def ai_default(hass, monkeypatch):
    """Home Assistant hat unter "KI-Vorschläge" eine Aufgabe zur Datengenerierung gewählt (ai_task ist in der CI nicht geladen)."""
    from custom_components.device_panel import ai_assessment  # noqa: PLC0415

    hass.states.async_set("ai_task.standard", "unknown", {"friendly_name": "Standard-KI"})
    monkeypatch.setattr(ai_assessment, "default_entity", lambda _hass: "ai_task.standard")
    return "ai_task.standard"


@pytest.fixture(autouse=True)
def battery_guard_off(request, monkeypatch):
    """
    Die Tests der Batterie, des Ladens und der KI setzen Stände sprunghaft (100 dann 20 ohne Zeit dazwischen): ohne den Wächter für
    Messfehler (2.43.0) laufen sie wie bisher. tests/test_battery_guard.py schaltet ihn mit der Marke "battery_guard" ein.
    """
    if request.node.get_closest_marker("battery_guard") is None:
        monkeypatch.setattr(battery_guard, "JUMP_POINTS", 1000.0)
