"""
Integrations-Icon als Bild der Push-Meldung (Companion-App, "icon_url").

Ist eine Meldung eindeutig einer Integration zuzuordnen, zeigt sie deren Icon
statt des Device-Panel-Icons. Quellen in dieser Reihenfolge:

1. brand/icon.png der Integration selbst (eigene Integrationen, HA ab 2026.3)
2. das Icon-CDN von Home Assistant (brands.home-assistant.io), wie es HA für
   die Integrations-Seiten selbst nutzt
3. nichts gefunden: der Aufrufer nimmt das Device-Panel-Icon

Die Companion-App lädt das Bild ohne Anmeldung, deshalb liegt jedes Icon als
Datei in einem Ordner, der als statischer Pfad ausgeliefert wird (wie
push/icon.png, siehe __init__.py). Jedes Icon wird nur einmal geholt.
"""

from __future__ import annotations

import asyncio
import io
import logging
import re
import time
from pathlib import Path
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.loader import async_get_integration

from .const import BRAND_DIR, BRANDS_CDN_URL, DATA_PUSH_ICONS, PUSH_ICON_URL_PATH
from .http_limit import read_limited

_LOGGER = logging.getLogger(__name__)

# Domains sind kleingeschrieben mit Ziffern und "_"; alles andere würde den
# Dateinamen oder die Adresse verfälschen.
_DOMAIN = re.compile(r"^[a-z0-9_]+$")
_SOURCE = "icon.png"
# Wartezeit für das CDN: eine Meldung soll nicht lange auf ein Bild warten.
_DOWNLOAD_TIMEOUT = 4
# Das Icon-CDN liefert 256 Pixel breite Bilder (wenige KB); alles weit darüber ist kein Icon und wird nicht entpackt.
_MAX_BYTES = 512 * 1024
_MAX_SIDE = 2048
# Nicht gefundene Icons erst nach dieser Zeit wieder versuchen (Netz weg,
# CDN gestört), gefundene nach 30 Tagen auffrischen.
_RETRY_SECONDS = 6 * 3600
_REFRESH_SECONDS = 30 * 24 * 3600
# Seitenlänge des fertigen Bilds und Anteil, den das Icon davon einnimmt.
# iOS schneidet das Bild in ein abgerundetes Quadrat (LEARNINGS, "Bild der
# Push-Meldung mit Rand"): rund 20 % Rand auf jeder Seite.
_CANVAS = 512
_FILL = 0.62


def _prepare(raw: bytes) -> bytes:
    """Icon mittig mit Rand auf eine quadratische Fläche setzen; ohne Pillow unverändert."""
    try:
        from PIL import Image  # Teil von Home Assistant, daher normalerweise da
    except ImportError:
        return raw
    try:
        with Image.open(io.BytesIO(raw)) as src:
            icon = src.convert("RGBA")
            box = int(_CANVAS * _FILL)
            icon.thumbnail((box, box), Image.Resampling.LANCZOS)
            canvas = Image.new("RGBA", (_CANVAS, _CANVAS), (0, 0, 0, 0))
            canvas.paste(icon, ((_CANVAS - icon.width) // 2, (_CANVAS - icon.height) // 2), icon)
            out = io.BytesIO()
            canvas.save(out, "PNG")
            return out.getvalue()
    except Exception:  # noqa: BLE001 - kein lesbares Bild: unverändert weiter
        return raw


def _is_png(raw: bytes) -> bool:
    return raw.startswith(b"\x89PNG\r\n\x1a\n")


def _png_pixels_ok(raw: bytes) -> bool:
    """Breite und Höhe stehen im Kopf (IHDR): ein winziges PNG mit riesiger Fläche wird nicht entpackt (Pillow-Bombe)."""
    if len(raw) < 24 or raw[12:16] != b"IHDR":
        return False
    width, height = int.from_bytes(raw[16:20], "big"), int.from_bytes(raw[20:24], "big")
    return 0 < width <= _MAX_SIDE and 0 < height <= _MAX_SIDE


def _read_own(path: Path, target: Path) -> bool:
    """
    Icon der Integration in den Ordner kopieren (läuft im Executor). True,
    wenn eines da ist. Nur neu schreiben, wenn die Quelle neuer ist als die
    Kopie, damit ein Austausch des Icons ankommt.
    """
    source = path / BRAND_DIR / _SOURCE
    if not source.is_file():
        return False
    if target.is_file() and target.stat().st_mtime >= source.stat().st_mtime:
        return True
    raw = source.read_bytes()
    if not _is_png(raw):
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(_prepare(raw))
    return True


def _write(target: Path, raw: bytes) -> None:
    # Der Ordner kann fehlen, wenn die Integration entfernt und ohne Neustart
    # wieder eingerichtet wurde (async_remove_entry löscht ihn).
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(_prepare(raw))


def _fresh(target: Path) -> bool:
    """Datei da und jünger als der Auffrischungs-Zeitraum (Executor)."""
    try:
        return time.time() - target.stat().st_mtime < _REFRESH_SECONDS
    except OSError:
        return False


async def _async_download(hass: HomeAssistant, domain: str) -> bytes | None:
    """Icon vom Icon-CDN von Home Assistant holen; None bei jedem Fehler."""
    url = f"{BRANDS_CDN_URL}/_/{domain}/{_SOURCE}"
    try:
        async with asyncio.timeout(_DOWNLOAD_TIMEOUT):
            async with async_get_clientsession(hass).get(url) as response:
                if response.status != 200:
                    return None
                raw = await read_limited(response, _MAX_BYTES)
    except Exception as err:  # noqa: BLE001 - das Icon ist nur Kosmetik
        _LOGGER.debug("Icon für %s nicht geladen (%s)", domain, err)
        return None
    if raw is None:
        _LOGGER.debug("Icon für %s zu gross (über %d Byte)", domain, _MAX_BYTES)
        return None
    return raw if _is_png(raw) and _png_pixels_ok(raw) else None


async def async_integration_icon(hass: HomeAssistant, domain: str | None) -> str | None:
    """
    Adresse des Icons der Integration oder None (dann gilt das Device-Panel-
    Icon). Wirft nie: eine Meldung darf wegen eines Bilds nicht ausfallen.
    """
    state: dict[str, Any] | None = hass.data.get(DATA_PUSH_ICONS)
    if not state or not domain or not _DOMAIN.match(domain):
        return None
    folder: Path = state["dir"]
    target = folder / f"{domain}.png"
    url = f"{PUSH_ICON_URL_PATH}/{domain}.png"
    try:
        async with state["lock"]:
            missing: dict[str, float] = state["missing"]
            if (at := missing.get(domain)) is not None and time.monotonic() - at < _RETRY_SECONDS:
                return None

            # Eigenes Icon der Integration geht vor; es kostet keinen Zugriff nach aussen.
            try:
                integration = await async_get_integration(hass, domain)
            except Exception:  # noqa: BLE001 - unbekannte Integration
                integration = None
            if integration is not None and await hass.async_add_executor_job(_read_own, integration.file_path, target):
                return url

            if await hass.async_add_executor_job(_fresh, target):
                return url
            raw = await _async_download(hass, domain)
            if raw is not None:
                await hass.async_add_executor_job(_write, target, raw)
                return url
            # Auffrischen fehlgeschlagen: die alte Kopie bleibt besser als nichts.
            if await hass.async_add_executor_job(target.is_file):
                return url
            missing[domain] = time.monotonic()
            return None
    except Exception:  # noqa: BLE001
        _LOGGER.debug("Icon für %s nicht bereitgestellt", domain, exc_info=True)
        return None


async def async_common_icon(hass: HomeAssistant, domains: list[str | None]) -> str | None:
    """Icon für mehrere Geräte: nur, wenn alle zur selben Integration gehören."""
    unique = set(domains)
    if len(unique) != 1:
        return None
    return await async_integration_icon(hass, next(iter(unique)))
