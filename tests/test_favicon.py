"""Favicon für eigene Apps mit externem Link (2.33.0): Symbol aus dem Kopf der Seite, /favicon.ico, Grenzen, nur Administratoren."""

from __future__ import annotations

import base64

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel import favicon
from custom_components.device_panel.const import DOMAIN

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 40
ICO = b"\x00\x00\x01\x00\x01\x00" + b"\x00" * 30
SVG = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>'


def _uri(mime: str, data: bytes) -> str:
    return f"data:{mime};base64,{base64.b64encode(data).decode()}"


def test_sniff_by_content_not_header() -> None:
    assert favicon.sniff(PNG) == "image/png" and favicon.sniff(ICO) == "image/x-icon" and favicon.sniff(SVG) == "image/svg+xml"
    assert favicon.sniff(b"GIF89a" + b"\x00" * 10) == "image/gif" and favicon.sniff(b"\xff\xd8\xff\xe0" + b"\x00" * 10) == "image/jpeg"
    assert favicon.sniff(b"RIFF\x00\x00\x00\x00WEBPVP8 ") == "image/webp"
    # kein Bild: HTML, Text, SVG ohne Ende, Skript im SVG zählt als SVG (läuft in <img> nie), leere Daten
    assert favicon.sniff(b"<html><body>404</body></html>") is None and favicon.sniff(b"") is None and favicon.sniff(b"<svg>") is None


def test_valid_url_only_http_and_https() -> None:
    assert favicon.valid_url("https://router.local/x") and favicon.valid_url("http://192.168.1.1")
    assert not favicon.valid_url("javascript:alert(1)") and not favicon.valid_url("ftp://a.example") and not favicon.valid_url("https://")
    assert not favicon.valid_url("https://a b.example") and not favicon.valid_url("") and not favicon.valid_url("/config")
    assert not favicon.valid_url("https://a.example/" + "x" * 400)


def test_icon_links_order_relative_and_limits() -> None:
    html = """<html><head>
      <link rel="apple-touch-icon" href="/apple.png">
      <link rel="shortcut icon" href="img/fav.ico">
      <link rel="icon" type="image/svg+xml" href="https://cdn.example/i.svg">
      <link rel="icon" href="data:image/png;base64,AAAA">
      <link rel="stylesheet" href="/s.css">
      <link rel="icon" href="img/fav.ico">
      </head><body><link rel="icon" href="/spaet.png"></body></html>"""
    links = favicon.icon_links(html, "https://host.example/app/index.html")
    # normale Symbole zuerst (Reihenfolge der Seite), Apple zuletzt, relativ aufgelöst, ohne Data-URI und Doppelte
    assert links == ["https://host.example/app/img/fav.ico", "https://cdn.example/i.svg", "https://host.example/apple.png"]
    assert len(favicon.icon_links("".join(f'<link rel="icon" href="/{i}.png">' for i in range(9)), "https://h.example/")) == favicon.MAX_CANDIDATES


async def _setup(hass: HomeAssistant) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel", options={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()


async def test_fetch_from_link_in_head(hass: HomeAssistant, aioclient_mock) -> None:
    aioclient_mock.get("https://nas.example/start", text='<html><head><link rel="icon" href="/static/logo.png"></head></html>')
    aioclient_mock.get("https://nas.example/static/logo.png", content=PNG)
    assert await favicon.async_fetch_favicon(hass, "https://nas.example/start") == _uri("image/png", PNG)


async def test_fetch_falls_back_to_favicon_ico(hass: HomeAssistant, aioclient_mock) -> None:
    aioclient_mock.get("http://router.local/", text="<html><head><title>Router</title></head></html>")
    aioclient_mock.get("http://router.local/favicon.ico", content=ICO)
    # Mime nach Inhalt, auch wenn die Adresse .ico heisst; Seite mit Pfad: Symbol von der Wurzel
    assert await favicon.async_fetch_favicon(hass, "http://router.local/") == _uri("image/x-icon", ICO)
    aioclient_mock.get("http://router.local/admin/ui", status=404)
    assert await favicon.async_fetch_favicon(hass, "http://router.local/admin/ui") == _uri("image/x-icon", ICO)


async def test_fetch_skips_non_images_and_takes_next(hass: HomeAssistant, aioclient_mock) -> None:
    aioclient_mock.get("https://x.example/", text='<head><link rel="icon" href="/a.png"><link rel="icon" href="/b.svg"></head>')
    aioclient_mock.get("https://x.example/a.png", text="<html>Login</html>")
    aioclient_mock.get("https://x.example/b.svg", content=SVG)
    assert await favicon.async_fetch_favicon(hass, "https://x.example/") == _uri("image/svg+xml", SVG)


@pytest.mark.parametrize(
    ("setup", "code"),
    [
        ("none", "not_found"),
        ("big", "too_large"),
        ("down", "unreachable"),
    ],
)
async def test_fetch_errors(hass: HomeAssistant, aioclient_mock, setup: str, code: str) -> None:
    import aiohttp  # noqa: PLC0415

    if setup == "none":
        aioclient_mock.get("https://x.example/", text="<html><head></head></html>")
        aioclient_mock.get("https://x.example/favicon.ico", status=404)
    elif setup == "big":
        aioclient_mock.get("https://x.example/", text='<head><link rel="icon" href="/big.png"></head>')
        aioclient_mock.get("https://x.example/big.png", content=PNG + b"\x00" * (favicon.MAX_BYTES + 10))
        aioclient_mock.get("https://x.example/favicon.ico", status=404)
    else:
        aioclient_mock.get("https://x.example/", exc=aiohttp.ClientConnectionError())
        aioclient_mock.get("https://x.example/favicon.ico", exc=aiohttp.ClientConnectionError())
    with pytest.raises(favicon.FaviconError) as err:
        await favicon.async_fetch_favicon(hass, "https://x.example/")
    assert err.value.code == code


async def test_fetch_rejects_other_schemes(hass: HomeAssistant) -> None:
    for url in ("javascript:alert(1)", "file:///etc/passwd", "/config", "https://", ""):
        with pytest.raises(favicon.FaviconError) as err:
            await favicon.async_fetch_favicon(hass, url)
        assert err.value.code == "invalid_url"


async def test_ws_fetch_favicon_admin_only(hass: HomeAssistant, hass_ws_client, hass_admin_user, aioclient_mock) -> None:
    from homeassistant.auth.const import GROUP_ID_USER  # noqa: PLC0415

    await _setup(hass)
    aioclient_mock.get("https://x.example/", text='<head><link rel="icon" href="/a.png"></head>')
    aioclient_mock.get("https://x.example/a.png", content=PNG)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/fetch_favicon", "url": "https://x.example/"})
    assert (await client.receive_json())["result"] == {"icon": _uri("image/png", PNG)}
    await client.send_json({"id": 2, "type": f"{DOMAIN}/fetch_favicon", "url": "javascript:alert(1)"})
    response = await client.receive_json()
    assert response["success"] is False and response["error"]["code"] == "invalid_url"
    user = await hass.auth.async_create_user("Mitglied", group_ids=[GROUP_ID_USER])
    token = await hass.auth.async_create_refresh_token(user, "https://example.test")
    other = await hass_ws_client(hass, hass.auth.async_create_access_token(token))
    await other.send_json({"id": 1, "type": f"{DOMAIN}/fetch_favicon", "url": "https://x.example/"})
    response = await other.receive_json()
    assert response["success"] is False and response["error"]["code"] == "unauthorized"


def test_no_credentials_sent() -> None:
    """Kein Cookie und keine Zugangsdaten: nur ein neutraler User-Agent."""
    assert set(favicon.HEADERS) == {"User-Agent", "Accept"} and "Home Assistant" in favicon.HEADERS["User-Agent"]


