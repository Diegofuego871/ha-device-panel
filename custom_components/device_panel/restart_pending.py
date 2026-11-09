"""
Integrationen, die nach einem Update einen Neustart brauchen (seit 2.212.0).

Eine Integration aus HACS (oder von Hand) wird erst nach einem Neustart von Home Assistant aktiv: Der Code bleibt bis dahin der alte, und auch das
`manifest.json`, das Home Assistant beim Start gelesen hat, liegt im Arbeitsspeicher. Steht auf der Platte eine andere Version als im Speicher,
läuft noch die alte und es braucht einen Neustart. So erkennt es das Panel unabhängig davon, womit das Update kam (HACS, von Hand, Kopie).
Es zählt nur, was auch läuft: eine Integration, die nicht geladen ist, braucht keinen Neustart.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.loader import async_get_custom_components, async_get_loaded_integration, IntegrationNotLoaded

_LOGGER = logging.getLogger(__name__)


def _disk_manifest(folder: Path) -> dict[str, Any] | None:
    try:
        data = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def scan(entries: list[tuple[str, str, str | None, str]]) -> list[dict[str, str]]:
    """Vergleicht je Eintrag (Domäne, Ordner, laufende Version, Name) mit dem manifest.json auf der Platte (blockierend: im Executor aufrufen)."""
    out: list[dict[str, str]] = []
    for domain, folder, running, name in entries:
        manifest = _disk_manifest(Path(folder))
        disk = str(manifest["version"]).strip() if manifest and manifest.get("version") else None
        if not running or not disk or disk == running:
            continue
        out.append({"domain": domain, "name": str((manifest or {}).get("name") or name or domain), "running": running, "installed": disk})
    return sorted(out, key=lambda i: i["name"].casefold())


async def async_pending(hass: HomeAssistant) -> list[dict[str, str]]:
    """Geladene eigene Integrationen, deren Dateien eine andere Version tragen als die laufende."""
    try:
        custom = await async_get_custom_components(hass)
    except Exception:  # noqa: BLE001 (nie die Liste der Updates verhindern)
        _LOGGER.debug("Eigene Integrationen nicht lesbar", exc_info=True)
        return []
    entries: list[tuple[str, str, str | None, str]] = []
    for domain, integration in custom.items():
        if domain not in hass.config.components:
            continue
        # Die geladene Fassung hat Vorrang; sie trägt das manifest.json vom Start
        try:
            integration = async_get_loaded_integration(hass, domain)
        except IntegrationNotLoaded:
            pass
        version = integration.version
        entries.append((domain, str(integration.file_path), str(version) if version else None, str(integration.name or domain)))
    if not entries:
        return []
    return await hass.async_add_executor_job(scan, entries)
