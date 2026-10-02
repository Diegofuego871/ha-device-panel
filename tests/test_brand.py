"""Brand-Bilder: Grössen wie unifi_dynamic, Auslieferung ohne Anmeldung (Push-Bild)."""

from __future__ import annotations

import struct
from pathlib import Path

import pytest
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel.const import (
    DATA_PUSH_IMAGE,
    DOMAIN,
    PANEL_HTML_FILE,
    PANEL_STATIC_URL_PATH,
    PUSH_IMAGE_URL,
)

BRAND = Path(__file__).resolve().parents[1] / "custom_components" / "device_panel" / "brand"
PUSH = BRAND.parent / "push"


def _png_header(path: Path) -> tuple[int, int, int]:
    """Breite, Höhe und Farbtyp aus dem IHDR-Block (6 = RGBA)."""
    data = path.read_bytes()[:26]
    assert data[:8] == b"\x89PNG\r\n\x1a\n", f"{path.name} ist kein PNG"
    width, height = struct.unpack(">II", data[16:24])
    return width, height, data[25]


@pytest.mark.parametrize(
    ("name", "size"),
    [
        ("icon.png", (256, 256)),
        ("icon@2x.png", (512, 512)),
        ("logo.png", (256, 295)),
        ("logo@2x.png", (512, 590)),
    ],
)
def test_brand_images(name: str, size: tuple[int, int]) -> None:
    width, height, color_type = _png_header(BRAND / name)
    assert (width, height) == size
    # Mit Alphakanal, sonst wäre der Hintergrund nicht transparent.
    assert color_type == 6


def test_push_image_has_margin() -> None:
    """
    Push-Bild mit Rand (iOS schneidet in ein abgerundetes Quadrat): 512 × 512
    mit Alphakanal. Grösser als das Brand-Icon, damit es auf dem Handy
    scharf bleibt.
    """
    width, height, color_type = _png_header(PUSH / "icon.png")
    assert (width, height, color_type) == (512, 512, 6)
    assert (PUSH / "icon.png").read_bytes() != (BRAND / "icon.png").read_bytes()


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_push_image_served_without_login(hass: HomeAssistant, hass_client_no_auth) -> None:
    await _setup(hass)
    assert hass.data[DATA_PUSH_IMAGE] == PUSH_IMAGE_URL

    client = await hass_client_no_auth()
    resp = await client.get(PUSH_IMAGE_URL)
    assert resp.status == 200
    assert resp.content_type == "image/png"
    assert await resp.read() == (PUSH / "icon.png").read_bytes()

    # /device_panel/push zeigt auf push/, /device_panel/panel weiter auf panel/.
    resp = await client.get(f"{PANEL_STATIC_URL_PATH}/{PANEL_HTML_FILE}")
    assert resp.status == 200
    assert "<device-panel>" in await resp.text()


async def test_reload_keeps_push_image(hass: HomeAssistant, hass_client_no_auth) -> None:
    """Statische Pfade lassen sich nicht abmelden; ein Reload darf nicht scheitern."""
    entry = await _setup(hass)
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.LOADED
    assert hass.data[DATA_PUSH_IMAGE] == PUSH_IMAGE_URL

    client = await hass_client_no_auth()
    assert (await client.get(PUSH_IMAGE_URL)).status == 200
