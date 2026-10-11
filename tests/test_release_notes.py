"""Release Notes im Panel (2.3.0): Abschnitte aus CHANGELOG(.de).md, Auswahl, Rückfälle, Zwischenspeicher, Befehl."""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel import update_check
from custom_components.device_panel.const import DOMAIN

CHANGELOG_EN = """# Changelog

[Deutsch](CHANGELOG.de.md)

## [2.2.0] - 2026-10-11

Emoji per push.

### Added

- One line that is long
  and continues here.

## [2.1.0] - 2026-10-11

Icon in push.

### Added

- The icon.

## [2.0.10] - 2026-10-11

Not released; included in 2.1.0.

Tab on two lines.

### Changed

- Two lines.

## [2.0.6] - 2026-10-11

Old.

### Fixed

- Old fix.

[2.2.0]: https://github.com/x/y/releases/tag/v2.2.0
[2.1.0]: https://github.com/x/y/releases/tag/v2.1.0
"""

CHANGELOG_DE = CHANGELOG_EN.replace("Emoji per push.", "Emoji pro Push.").replace("Not released; included in", "Nicht veröffentlicht; enthalten in")
BASE = update_check.RAW_URL + "/v2.2.0"


def test_sections_and_selection() -> None:
    sections = update_check.changelog_sections(CHANGELOG_EN)
    assert [s["version"] for s in sections] == ["2.2.0", "2.1.0", "2.0.10", "2.0.6"]
    assert sections[0]["date"] == "2026-10-11"
    assert "[2.2.0]: https" not in sections[-1]["notes"] and "Not released" not in sections[2]["notes"]
    assert sections[0]["notes"].startswith("Emoji per push.")
    # Von 2.0.6 auf 2.2.0: die Versionen dazwischen, neueste zuerst; 2.0.6 selbst nicht
    picked = update_check.select_sections(sections, "2.0.6", "2.2.0")
    assert [s["version"] for s in picked] == ["2.2.0", "2.1.0", "2.0.10"]
    # Ohne installierte Version nur die neueste; Version nach der neuesten gehört nicht dazu
    assert [s["version"] for s in update_check.select_sections(sections, None, "2.1.0")] == ["2.1.0"]
    assert [s["version"] for s in update_check.select_sections(sections, "2.0.6", "2.1.0")] == ["2.1.0", "2.0.10"]
    assert update_check.select_sections(sections, "2.2.0", "2.2.0") == []


@pytest.fixture
def texts():
    """Gefälschte Abrufe: Textdateien nach URL; GitHub-Releases über die vorhandene Fixture."""
    files: dict[str, str] = {}
    calls: list[str] = []

    async def fake(_hass, url):
        calls.append(url)
        return (files[url], None) if url in files else (None, "HTTP 404")

    with patch.object(update_check, "_async_get_text", fake):
        yield files, calls


async def test_german_and_english(hass: HomeAssistant, texts) -> None:
    files, calls = texts
    files[f"{BASE}/CHANGELOG.de.md"] = CHANGELOG_DE
    files[f"{BASE}/CHANGELOG.md"] = CHANGELOG_EN
    de = await update_check.async_release_notes(hass, "2.0.6", "2.2.0", "de")
    assert de["language"] == "de" and de["error"] is None
    assert [e["version"] for e in de["entries"]] == ["2.2.0", "2.1.0", "2.0.10"]
    assert de["entries"][0]["notes"].startswith("Emoji pro Push.")
    en = await update_check.async_release_notes(hass, "2.0.6", "2.2.0", "en")
    assert en["language"] == "en" and en["entries"][0]["notes"].startswith("Emoji per push.")
    # Zwischengespeichert: gleiche Anfrage holt nichts neu
    before = len(calls)
    await update_check.async_release_notes(hass, "2.0.6", "2.2.0", "de")
    assert len(calls) == before


async def test_german_falls_back_to_english_file(hass: HomeAssistant, texts) -> None:
    files, _calls = texts
    files[f"{BASE}/CHANGELOG.md"] = CHANGELOG_EN
    result = await update_check.async_release_notes(hass, "2.0.6", "2.2.0", "de")
    assert result["language"] == "en" and len(result["entries"]) == 3 and result["error"] is None


async def test_release_body_as_last_resort(hass: HomeAssistant, texts, github_offline) -> None:
    github_offline[f"{update_check.TAG_RELEASE_URL}/v2.2.0"] = ({"body": "## 2.2.0\n\nText", "published_at": "2026-10-11T10:00:00Z"}, None)
    result = await update_check.async_release_notes(hass, "2.0.6", "2.2.0", "de")
    assert result["error"] is None and result["language"] == "en"
    assert result["entries"] == [{"version": "2.2.0", "date": "2026-10-11", "notes": "## 2.2.0\n\nText"}]


async def test_error_when_nothing_found(hass: HomeAssistant, texts) -> None:
    result = await update_check.async_release_notes(hass, "2.0.6", "2.2.0", "en")
    assert result["entries"] == [] and result["error"] == "HTTP 404"
    # Fehler wird kürzer zwischengespeichert, "force" holt früher neu
    files, calls = texts
    n = len(calls)
    await update_check.async_release_notes(hass, "2.0.6", "2.2.0", "en")
    assert len(calls) == n


async def test_command(hass: HomeAssistant, hass_ws_client, texts) -> None:
    files, _calls = texts
    files[f"{BASE}/CHANGELOG.de.md"] = CHANGELOG_DE
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)

    async def call(**kwargs: Any) -> dict[str, Any]:
        call.n += 1
        await client.send_json({"id": call.n, "type": f"{DOMAIN}/release_notes", **kwargs})
        return await client.receive_json()

    call.n = 0
    ok = await call(installed="2.0.6", latest="2.2.0", language="de")
    assert ok["success"] and ok["result"]["language"] == "de" and "checked_at" not in ok["result"]
    assert [e["version"] for e in ok["result"]["entries"]] == ["2.2.0", "2.1.0", "2.0.10"]
    # Versionsnummern kommen in den Pfad: nichts anderes als Nummern
    for bad in ("../main", "2.2.0/x", "v2.2.0?x=1", "", "2.2.0 ", "2.2.0\n"):
        assert not (await call(installed="2.0.6", latest=bad))["success"], bad
    assert not (await call(installed="x/y", latest="2.2.0"))["success"]
    assert not (await call(latest="2.2.0", language="fr"))["success"]
    assert (await call(latest="2.2.0"))["success"]
