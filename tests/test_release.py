"""Release: Zur Version in manifest.json gibt es Release Notes im CHANGELOG."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _section_module():
    spec = importlib.util.spec_from_file_location("changelog_section", ROOT / ".github" / "scripts" / "changelog_section.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _version() -> str:
    manifest = ROOT / "custom_components" / "device_panel" / "manifest.json"
    return json.loads(manifest.read_text(encoding="utf-8"))["version"]


def test_changelog_has_current_version() -> None:
    """Der Release-Workflow bricht ohne Abschnitt ab; das soll schon hier auffallen."""
    text = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    version = _version()
    assert _section_module().section(text, version), f"kein CHANGELOG-Abschnitt für {version}"
    link = f"[{version}]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v{version}"
    assert link in text, "Link-Fussnote fehlt"


def test_section_stops_at_next_version_and_links() -> None:
    text = "# Changelog\n\n## [1.1.0] - x\n\n- neu\n\n## [1.0.0] - y\n\n- alt\n\n[1.1.0]: a\n[1.0.0]: b\n"
    section = _section_module().section
    assert section(text, "1.1.0") == "- neu"
    assert section(text, "1.0.0") == "- alt"
    assert section(text, "1.0") == ""
