"""Integrations-Icon als Bild der Push-Meldung (2.0.11): Quellen, Rand, Zwischenspeicher, Auslieferung."""

from __future__ import annotations

import asyncio
import io
import os
import time
from datetime import timedelta
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from PIL import Image
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed, async_mock_service

from custom_components.device_panel import push_icon
from custom_components.device_panel.const import (
    DATA_AVAILABILITY,
    DATA_PUSH_ICONS,
    DATA_PUSH_IMAGE,
    DOMAIN,
    PUSH_ICON_URL_PATH,
    PUSH_IMAGE_URL,
)

ICON = Path(__file__).resolve().parents[1] / "custom_components" / "device_panel" / "brand" / "icon.png"


def _png(size: int = 256, color: tuple[int, int, int, int] = (200, 30, 30, 255)) -> bytes:
    """Voll deckendes Quadrat bis an den Rand, wie ein knapp zugeschnittenes Icon."""
    out = io.BytesIO()
    Image.new("RGBA", (size, size), color).save(out, "PNG")
    return out.getvalue()


@pytest.fixture
def icons(hass: HomeAssistant, tmp_path: Path) -> Path:
    """Ordner und Zustand wie nach _async_register_push_icons, ohne HTTP."""
    folder = tmp_path / "icons"
    folder.mkdir()
    hass.data[DATA_PUSH_ICONS] = {"dir": folder, "lock": asyncio.Lock(), "missing": {}}
    return folder


async def test_download_gets_margin_and_is_cached(hass: HomeAssistant, icons: Path) -> None:
    with patch.object(push_icon, "_async_download", AsyncMock(return_value=_png())) as download:
        assert await push_icon.async_integration_icon(hass, "hue") == f"{PUSH_ICON_URL_PATH}/hue.png"
        assert await push_icon.async_integration_icon(hass, "hue") == f"{PUSH_ICON_URL_PATH}/hue.png"
    assert download.await_count == 1
    with Image.open(icons / "hue.png") as image:
        # 512 × 512 mit Rand: das Icon füllt nicht die ganze Fläche (iOS schneidet die Ecken ab).
        assert image.size == (512, 512)
        left, top, right, bottom = image.getchannel("A").getbbox()
        assert left >= 512 * 0.15 and top >= 512 * 0.15 and right <= 512 * 0.85 and bottom <= 512 * 0.85


async def test_own_brand_icon_goes_first(hass: HomeAssistant, icons: Path) -> None:
    """Die Integration selbst (hier Device Panel) liefert brand/icon.png, ohne Zugriff nach aussen."""
    with patch.object(push_icon, "_async_download", AsyncMock()) as download:
        assert await push_icon.async_integration_icon(hass, DOMAIN) == f"{PUSH_ICON_URL_PATH}/{DOMAIN}.png"
    download.assert_not_awaited()
    with Image.open(icons / f"{DOMAIN}.png") as image:
        assert image.size == (512, 512)


async def test_missing_icon_is_retried_later(hass: HomeAssistant, icons: Path) -> None:
    with patch.object(push_icon, "_async_download", AsyncMock(return_value=None)) as download:
        assert await push_icon.async_integration_icon(hass, "hue") is None
        assert await push_icon.async_integration_icon(hass, "hue") is None
        assert download.await_count == 1
        # Nach der Wartezeit ein neuer Versuch (Netz kann wieder da sein).
        hass.data[DATA_PUSH_ICONS]["missing"]["hue"] = time.monotonic() - push_icon._RETRY_SECONDS - 1
        assert await push_icon.async_integration_icon(hass, "hue") is None
        assert download.await_count == 2
    assert not (icons / "hue.png").exists()


async def test_failed_refresh_keeps_old_copy(hass: HomeAssistant, icons: Path) -> None:
    old = icons / "hue.png"
    old.write_bytes(_png())
    stale = time.time() - push_icon._REFRESH_SECONDS - 60
    os.utime(old, (stale, stale))
    with patch.object(push_icon, "_async_download", AsyncMock(return_value=None)):
        assert await push_icon.async_integration_icon(hass, "hue") == f"{PUSH_ICON_URL_PATH}/hue.png"


@pytest.mark.parametrize("domain", [None, "", "../x", "Hue", "a/b"])
async def test_invalid_domain(hass: HomeAssistant, icons: Path, domain: str | None) -> None:
    with patch.object(push_icon, "_async_download", AsyncMock(return_value=_png())) as download:
        assert await push_icon.async_integration_icon(hass, domain) is None
    download.assert_not_awaited()
    assert list(icons.iterdir()) == []


async def test_without_registered_path(hass: HomeAssistant) -> None:
    assert await push_icon.async_integration_icon(hass, "hue") is None
    hass.data[DATA_PUSH_ICONS] = None
    assert await push_icon.async_integration_icon(hass, "hue") is None


async def test_no_png_is_not_stored(hass: HomeAssistant, icons: Path) -> None:
    class Response:
        status = 200

        async def __aenter__(self) -> "Response":
            return self

        async def __aexit__(self, *exc: Any) -> None:
            return None

        async def read(self) -> bytes:
            return b"<html>nicht gefunden</html>"

    class Session:
        def get(self, url: str) -> Response:
            assert url == "https://brands.home-assistant.io/_/hue/icon.png"
            return Response()

    with patch.object(push_icon, "async_get_clientsession", return_value=Session()):
        assert await push_icon.async_integration_icon(hass, "hue") is None
    assert not (icons / "hue.png").exists()


async def test_common_icon_only_for_one_integration(hass: HomeAssistant, icons: Path) -> None:
    with patch.object(push_icon, "_async_download", AsyncMock(return_value=_png())):
        assert await push_icon.async_common_icon(hass, ["hue", "hue"]) == f"{PUSH_ICON_URL_PATH}/hue.png"
        assert await push_icon.async_common_icon(hass, ["hue", "zha"]) is None
        assert await push_icon.async_common_icon(hass, ["hue", None]) is None
        assert await push_icon.async_common_icon(hass, []) is None


async def test_icon_served_without_login(hass: HomeAssistant, hass_client_no_auth) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert hass.data[DATA_PUSH_ICONS]["dir"].is_dir()

    with patch.object(push_icon, "_async_download", AsyncMock(return_value=_png())):
        url = await push_icon.async_integration_icon(hass, "hue")
    assert url == f"{PUSH_ICON_URL_PATH}/hue.png"

    client = await hass_client_no_auth()
    resp = await client.get(url)
    assert resp.status == 200
    assert resp.content_type == "image/png"
    # Das mitgelieferte Bild bleibt unter seinem Pfad erreichbar.
    assert (await client.get(PUSH_IMAGE_URL)).status == 200


async def test_remove_entry_deletes_icons(hass: HomeAssistant, hass_client_no_auth) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    folder = hass.data[DATA_PUSH_ICONS]["dir"]
    with patch.object(push_icon, "_async_download", AsyncMock(return_value=_png())):
        await push_icon.async_integration_icon(hass, "hue")
        assert (folder / "hue.png").is_file()
        await hass.config_entries.async_remove(entry.entry_id)
        await hass.async_block_till_done()
        assert not folder.exists()
        # Wieder einrichten ohne Neustart: der Ordner entsteht beim nächsten Icon neu.
        assert await push_icon.async_integration_icon(hass, "zha") == f"{PUSH_ICON_URL_PATH}/zha.png"
    assert (folder / "zha.png").is_file()


# --- Aufrufer -------------------------------------------------------------


@pytest.fixture
async def setup(hass: HomeAssistant, icons: Path):
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    # Ohne HTTP in diesem Test: Zustand aus der Fixture "icons" wieder setzen.
    hass.data[DATA_PUSH_ICONS] = {"dir": icons, "lock": asyncio.Lock(), "missing": {}}
    log = hass.data[DATA_AVAILABILITY]
    log._started = time.time() - 3600
    return log


def _device(hass: HomeAssistant, name: str, domain: str) -> dr.DeviceEntry:
    source = MockConfigEntry(domain=domain, title=f"{name} Eintrag")
    source.add_to_hass(hass)
    return dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={(domain, name)}, name=name)


async def _outage(hass: HomeAssistant, log: Any, freezer, names: list[tuple[str, str]]) -> list:
    calls = async_mock_service(hass, "notify", "handy")
    entities = []
    for name, domain in names:
        device = _device(hass, name, domain)
        entry = er.async_get(hass).async_get_or_create("binary_sensor", "test", f"{device.id}-c", device_id=device.id, original_device_class="connectivity")
        hass.states.async_set(entry.entity_id, "on")
        entities.append(entry.entity_id)
    config = hass.config_entries.async_entries(DOMAIN)[0]
    hass.config_entries.async_update_entry(config, options={**config.options, "notify_service": "notify.handy", "notify_outage": True, "notify_group": True})
    await hass.async_block_till_done()
    log.evaluate()
    for entity in entities:
        hass.states.async_set(entity, "off")
    freezer.tick(timedelta(minutes=3))
    log.evaluate()
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    # Mehrere Geräte einer Integration warten die Sammelzeit auf weitere (seit 2.94.0)
    freezer.tick(timedelta(seconds=61))
    async_fire_time_changed(hass)
    await hass.async_block_till_done(wait_background_tasks=True)
    return calls


async def test_outage_push_uses_integration_icon(hass: HomeAssistant, setup, freezer) -> None:
    with patch.object(push_icon, "_async_download", AsyncMock(return_value=_png())):
        calls = await _outage(hass, setup, freezer, [("Melder", "hue")])
    assert len(calls) == 1
    assert calls[0].data["data"]["icon_url"] == f"{PUSH_ICON_URL_PATH}/hue.png"


async def test_outage_push_falls_back_to_device_panel_icon(hass: HomeAssistant, setup, freezer) -> None:
    hass.data[DATA_PUSH_IMAGE] = PUSH_IMAGE_URL
    with patch.object(push_icon, "_async_download", AsyncMock(return_value=None)):
        calls = await _outage(hass, setup, freezer, [("Melder", "hue")])
    assert calls[0].data["data"]["icon_url"] == PUSH_IMAGE_URL


async def test_group_outage_icon_only_with_common_integration(hass: HomeAssistant, setup, freezer) -> None:
    hass.data[DATA_PUSH_IMAGE] = PUSH_IMAGE_URL
    with patch.object(push_icon, "_async_download", AsyncMock(return_value=_png())):
        same = await _outage(hass, setup, freezer, [(f"Hue {i}", "hue") for i in range(3)])
    assert len(same) == 1
    assert same[0].data["data"]["icon_url"] == f"{PUSH_ICON_URL_PATH}/hue.png"


async def test_group_outage_mixed_integrations_keeps_device_panel_icon(hass: HomeAssistant, setup, freezer) -> None:
    hass.data[DATA_PUSH_IMAGE] = PUSH_IMAGE_URL
    with patch.object(push_icon, "_async_download", AsyncMock(return_value=_png())):
        mixed = await _outage(hass, setup, freezer, [("A", "hue"), ("B", "zha"), ("C", "hue")])
    # Je Integration weniger als 3 Geräte (seit 2.94.0): drei einzelne Meldungen, jede mit dem Symbol ihrer Integration
    assert len(mixed) == 3
    assert {c.data["data"]["icon_url"] for c in mixed} == {f"{PUSH_ICON_URL_PATH}/hue.png", f"{PUSH_ICON_URL_PATH}/zha.png"}
