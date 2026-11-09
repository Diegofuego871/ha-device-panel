"""Neustart nötig nach einem Update (2.212.0): Version auf der Platte gegen die laufende (geladene) Version."""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from homeassistant.core import HomeAssistant

from custom_components.device_panel import restart_pending


def _write(folder: Path, version: str | None, name: str = "Alarmageddon") -> None:
    folder.mkdir(parents=True, exist_ok=True)
    data: dict[str, Any] = {"domain": folder.name, "name": name}
    if version is not None:
        data["version"] = version
    (folder / "manifest.json").write_text(json.dumps(data), encoding="utf-8")


def test_scan_reports_only_differing_versions(tmp_path: Path) -> None:
    _write(tmp_path / "a", "0.23.0")
    _write(tmp_path / "b", "1.0.0", "Bee")
    _write(tmp_path / "c", None, "Ohne Version")
    (tmp_path / "d").mkdir()
    (tmp_path / "e").mkdir()
    (tmp_path / "e" / "manifest.json").write_text("{kaputt", encoding="utf-8")
    entries = [
        ("a", str(tmp_path / "a"), "0.22.0", "a"),  # Platte neuer: Neustart nötig
        ("b", str(tmp_path / "b"), "1.0.0", "Bee"),  # gleich: nichts
        ("c", str(tmp_path / "c"), "1.0.0", "c"),  # Platte ohne Version: nichts
        ("d", str(tmp_path / "d"), "1.0.0", "d"),  # keine Datei: nichts
        ("e", str(tmp_path / "e"), "1.0.0", "e"),  # kaputte Datei: nichts
        ("f", str(tmp_path / "f"), None, "f"),  # laufende Version unbekannt: nichts
    ]
    assert restart_pending.scan(entries) == [{"domain": "a", "name": "Alarmageddon", "running": "0.22.0", "installed": "0.23.0"}]


async def test_pending_uses_loaded_version_and_skips_unloaded(hass: HomeAssistant, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _write(tmp_path / "alarm", "0.23.0")
    _write(tmp_path / "idle", "2.0.0", "Nicht geladen")
    _write(tmp_path / "same", "3.0.0", "Gleich")
    comps = {
        "alarm": SimpleNamespace(domain="alarm", name="Alarmageddon", version="0.22.0", file_path=tmp_path / "alarm"),
        "idle": SimpleNamespace(domain="idle", name="Nicht geladen", version="1.0.0", file_path=tmp_path / "idle"),
        "same": SimpleNamespace(domain="same", name="Gleich", version="3.0.0", file_path=tmp_path / "same"),
    }

    async def fake_custom(_hass: HomeAssistant) -> dict[str, Any]:
        return comps

    monkeypatch.setattr(restart_pending, "async_get_custom_components", fake_custom)
    hass.config.components.add("alarm")
    hass.config.components.add("same")
    # "idle" ist nicht geladen: braucht keinen Neustart, auch wenn die Platte neuer ist
    result = await restart_pending.async_pending(hass)
    assert [r["domain"] for r in result] == ["alarm"]
    assert result[0]["running"] == "0.22.0" and result[0]["installed"] == "0.23.0"
    # Nach dem Neustart trägt die laufende Fassung die neue Version: nichts mehr offen
    comps["alarm"].version = "0.23.0"
    assert await restart_pending.async_pending(hass) == []


async def test_pending_survives_a_failing_loader(hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch) -> None:
    async def boom(_hass: HomeAssistant) -> dict[str, Any]:
        raise RuntimeError("kaputt")

    monkeypatch.setattr(restart_pending, "async_get_custom_components", boom)
    assert await restart_pending.async_pending(hass) == []
