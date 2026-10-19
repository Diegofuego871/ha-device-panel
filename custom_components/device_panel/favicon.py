"""
Favicon einer Seite holen (seit 2.33.0, App-Launcher: eigene Apps mit externem Link).

Home Assistant ruft die Seite ab, nicht der Browser: So klappt es auch bei http:// und bei Geräten im Heimnetz (Router),
der Browser lädt nichts von der fremden Seite, und das Bild lässt sich als kleines Bild (Data-URI) in den Benutzerdaten
speichern. Vorgehen: die Seite lesen und das erste Symbol aus dem Kopf nehmen (<link rel="icon" …>), sonst /favicon.ico.

Grenzen (Absprache mit dem Nutzer): höchstens REQUEST_TIMEOUT Sekunden je Abruf, höchstens MAX_BYTES Byte je Bild, nur Bilder
(PNG, ICO, GIF, JPEG, WebP, SVG; erkannt am Inhalt, nicht am Header des Servers). Es werden weder Zugangsdaten noch Cookies
gesendet. Das Zertifikat wird nicht geprüft, damit auch Router mit eigenem Zertifikat gehen: Es wird nur ein öffentliches Bild
geholt. Der Befehl ist nur für Administratoren (das Panel ist es ohnehin).
"""

from __future__ import annotations

import base64
import ipaddress
import logging
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

from aiohttp import ClientError, ClientTimeout
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

_LOGGER = logging.getLogger(__name__)

REQUEST_TIMEOUT = 5
MAX_BYTES = 100 * 1024
# So viel der Seite wird gelesen, um das Symbol im Kopf zu finden.
MAX_PAGE_BYTES = 256 * 1024
MAX_URL_LENGTH = 300
MAX_CANDIDATES = 3
MAX_REDIRECTS = 5
_REDIRECT_CODES = (301, 302, 303, 307, 308)
HEADERS = {"User-Agent": "Device Panel (Home Assistant)", "Accept": "text/html,image/*;q=0.8,*/*;q=0.5"}


class FaviconError(Exception):
    """Fehler mit einem Code für das Panel: invalid_url, unreachable, not_found, too_large."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def valid_url(url: str) -> str | None:
    """Nur http:// und https:// mit Host, ohne Leerzeichen."""
    url = (url or "").strip()
    if not url or len(url) > MAX_URL_LENGTH or any(c.isspace() for c in url):
        return None
    parts = urlsplit(url)
    return url if parts.scheme in ("http", "https") and parts.hostname else None


def is_local_target(host: str | None) -> bool:
    """Loopback, Link-Local (dazu gehört die Cloud-Metadatenadresse 169.254.169.254) oder unbestimmte Adresse, auch "localhost"."""
    host = (host or "").strip("[]").lower().rstrip(".")
    if host == "localhost" or host.endswith(".localhost"):
        return True
    try:
        ip = ipaddress.ip_address(host.split("%")[0])
    except ValueError:
        return False  # ein Name: ohne Namensauflösung nicht zu beurteilen
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return ip.is_loopback or ip.is_link_local or ip.is_unspecified


def _allowed(url: str, trusted_host: str | None) -> bool:
    """
    Darf diese Adresse abgerufen werden? Was die Seite selbst nennt (Symbol-Links, Weiterleitungen), geht nicht an Loopback
    oder Link-Local, ausser die vom Benutzer eingegebene Adresse hat denselben Host (zum Beispiel ein Dienst auf localhost).
    Ein privates Heimnetz (192.168.x.x, 10.x.x.x) bleibt erlaubt: dafür gibt es die Funktion.
    """
    host = urlsplit(url).hostname
    return not is_local_target(host) or (host or "").lower() == (trusted_host or "").lower()


def sniff(data: bytes) -> str | None:
    """MIME-Typ eines Bildes am Inhalt erkennen; None, wenn es keins der erlaubten ist."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\x00\x00\x01\x00") and len(data) > 6:
        return "image/x-icon"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    head = data[:1024].lstrip(b"\xef\xbb\xbf \t\r\n").lower()
    if (head.startswith(b"<svg") or (head.startswith(b"<?xml") and b"<svg" in data[:2048].lower())) and b"</svg" in data[-2048:].lower():
        return "image/svg+xml"
    return None


class _IconLinks(HTMLParser):
    """Sammelt die Symbole aus dem Kopf einer Seite (rel icon, shortcut icon, apple-touch-icon), in der Reihenfolge der Seite."""

    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[int, str]] = []
        self._done = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "link" and not self._done:
            a = {k: (v or "") for k, v in attrs}
            rel = a.get("rel", "").lower().split()
            href = a.get("href", "").strip()
            if href and ("icon" in rel or "apple-touch-icon" in rel):
                # normale Symbole vor dem grossen Apple-Symbol
                self.links.append((1 if "apple-touch-icon" in rel and "icon" not in rel else 0, href))

    def handle_endtag(self, tag: str) -> None:
        if tag == "head":
            self._done = True


def icon_links(html: str, base: str) -> list[str]:
    """Adressen der Symbole einer Seite, sortiert (normal vor Apple), ohne Doppelte, höchstens MAX_CANDIDATES."""
    parser = _IconLinks()
    try:
        parser.feed(html)
    except Exception:  # noqa: BLE001 - kaputtes HTML: nehmen, was gefunden wurde
        _LOGGER.debug("Seite nicht vollständig lesbar", exc_info=True)
    out: list[str] = []
    for _rank, href in sorted(parser.links, key=lambda x: x[0]):
        if href.startswith("data:"):
            continue
        full = urljoin(base, href)
        if valid_url(full) and full not in out and _allowed(full, urlsplit(base).hostname):
            out.append(full)
    return out[:MAX_CANDIDATES]


async def _read(hass: HomeAssistant, url: str, limit: int, trusted_host: str | None = None) -> tuple[bytes, str, bool]:
    """
    Bis limit Byte lesen; liefert (Daten, endgültige Adresse, abgeschnitten). Fehler: FaviconError.
    Weiterleitungen werden von Hand verfolgt (höchstens MAX_REDIRECTS), damit jedes Ziel geprüft wird (siehe _allowed).
    """
    session = async_get_clientsession(hass, verify_ssl=False)
    try:
        for _hop in range(MAX_REDIRECTS + 1):
            async with session.get(url, headers=HEADERS, timeout=ClientTimeout(total=REQUEST_TIMEOUT), allow_redirects=False) as resp:
                if resp.status in _REDIRECT_CODES and (location := resp.headers.get("Location")):
                    url = urljoin(url, location.strip())
                    if valid_url(url) is None or not _allowed(url, trusted_host):
                        raise FaviconError("unreachable")
                    continue
                if resp.status >= 400:
                    raise FaviconError("not_found" if resp.status == 404 else "unreachable")
                data = bytearray()
                async for chunk in resp.content.iter_chunked(8192):
                    data += chunk
                    if len(data) > limit:
                        return bytes(data[:limit]), str(resp.url), True
                return bytes(data), str(resp.url), False
        raise FaviconError("unreachable")  # zu viele Weiterleitungen
    except FaviconError:
        raise
    except (ClientError, TimeoutError, OSError, ValueError) as err:
        _LOGGER.debug("Abruf von %s fehlgeschlagen: %s", url, err)
        raise FaviconError("unreachable") from err


async def async_fetch_favicon(hass: HomeAssistant, url: str) -> str:
    """Das Favicon der Seite als Data-URI (base64). Fehler: FaviconError mit Code."""
    page = valid_url(url)
    if page is None:
        raise FaviconError("invalid_url")
    origin = f"{urlsplit(page).scheme}://{urlsplit(page).netloc}"
    trusted = urlsplit(page).hostname  # Host der eingegebenen Adresse: nur dieser darf auch lokal sein
    candidates: list[str] = []
    final = page
    reached = False
    try:
        html, final, _cut = await _read(hass, page, MAX_PAGE_BYTES, trusted)
        reached = True
        candidates = icon_links(html.decode("utf-8", errors="ignore"), final)
    except FaviconError as err:
        # Seite selbst nicht lesbar (zum Beispiel 404): trotzdem /favicon.ico versuchen
        reached = err.code == "not_found"
    fallback = f"{urlsplit(final).scheme}://{urlsplit(final).netloc}/favicon.ico"
    for extra in (fallback, f"{origin}/favicon.ico"):
        if extra not in candidates:
            candidates.append(extra)
    too_large = False
    for candidate in candidates:
        try:
            data, _url, cut = await _read(hass, candidate, MAX_BYTES, trusted)
        except FaviconError as err:
            reached = reached or err.code == "not_found"
            continue
        reached = True
        if cut:
            too_large = True
            continue
        mime = sniff(data)
        if mime is None:
            continue
        return f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"
    if too_large:
        raise FaviconError("too_large")
    raise FaviconError("not_found" if reached else "unreachable")
