"""
Versionsprüfung für die Einstellungen im Panel (übernommen aus unifi_dynamic).

Die installierte Version kommt aus dem Manifest der laufenden Integration,
die neueste aus den GitHub-Releases des Repositories. Das ist der Rückfall,
wenn HACS fehlt, und ergänzt HACS, das nur alle paar Tage prüft. Auf Wunsch
prüft die Integration täglich selbst und meldet eine neue Version unter
"Reparaturen". Installiert wird hier nichts: das bleibt HACS (update.install)
vorbehalten, ausgelöst vom Panel.
"""

from __future__ import annotations

import asyncio
import random
import re
import time
from datetime import timedelta
from typing import Any

from aiohttp import ClientError, ClientTimeout
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import issue_registry as ir
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_call_later, async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.loader import async_get_integration

from .const import CONF_UPDATE_CHECK, DEFAULT_UPDATE_CHECK, DOMAIN, GITHUB_REPO, STORAGE_VERSION

LATEST_RELEASE_URL = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
# Für Vorabversionen: die letzten Releases inkl. Pre-Releases.
RELEASES_URL = f"https://api.github.com/repos/{GITHUB_REPO}/releases?per_page=20"
# GitHub erlaubt ohne Anmeldung 60 Abfragen pro Stunde und IP: ohne
# ausdrücklichen Wunsch höchstens alle 6 Stunden, auf Knopfdruck höchstens
# einmal pro Minute.
CACHE_SECONDS = 6 * 3600
FORCE_MIN_SECONDS = 60
# Nach einem Fehler früher erneut versuchen.
ERROR_RETRY_SECONDS = 300
TIMEOUT = ClientTimeout(total=10)
RATE_LIMIT = "rate_limit"

_CACHE_KEY = f"{DOMAIN}_latest_release"
_PRE_CACHE_KEY = f"{DOMAIN}_latest_prerelease"
_TIMER_KEY = f"{DOMAIN}_update_timer"
# Gemeinsame Panel-Einstellungen der Instanz (nicht pro Benutzer):
# Vorabversionen anbieten, und welchen HACS-Schalter "Pre-release" das Panel
# selbst eingeschaltet hat (nur den schaltet es wieder aus).
PANEL_DATA_KEY = f"{DOMAIN}_panel_settings"
PANEL_STORE_KEY = f"{DOMAIN}.panel"
PANEL_DEFAULTS: dict[str, Any] = {"prerelease": False, "prerelease_hacs": None}
ISSUE_ID = "update_available"
DAILY = timedelta(days=1)
# Erste Prüfung nach dem Start zufällig verteilt, damit nicht alle
# Installationen zur selben Zeit bei GitHub anfragen.
FIRST_CHECK_DELAY = (5 * 60, 65 * 60)


async def async_installed_version(hass: HomeAssistant) -> str | None:
    """Version der laufenden Integration (nicht der Dateien auf der Platte)."""
    integration = await async_get_integration(hass, DOMAIN)
    return str(integration.version) if integration.version else None


def _cached(hass: HomeAssistant, key: str, force: bool) -> dict[str, Any] | None:
    cached: dict[str, Any] | None = hass.data.get(key)
    if not cached:
        return None
    age = time.time() - cached["checked_at"]
    limit = FORCE_MIN_SECONDS if force else (ERROR_RETRY_SECONDS if cached.get("error") else CACHE_SECONDS)
    return cached if age < limit else None


def _strip_v(tag: Any) -> str:
    text = str(tag or "").strip()
    return text[1:] if text[:1] in ("v", "V") else text


async def _async_get_json(hass: HomeAssistant, url: str) -> tuple[Any, str | None]:
    """GET mit Zeitlimit; Fehler als Text statt Ausnahme."""
    try:
        session = async_get_clientsession(hass)
        async with session.get(url, headers={"Accept": "application/vnd.github+json"}, timeout=TIMEOUT) as resp:
            if resp.status >= 400:
                # Abfragelimit (ohne Anmeldung 60 pro Stunde und IP, bei
                # geteilter IP schnell erreicht): eigener Code, damit das Panel
                # es verständlich anzeigt statt "HTTP 403".
                if resp.status in (403, 429) and resp.headers.get("X-RateLimit-Remaining") == "0":
                    return None, RATE_LIMIT
                return None, f"HTTP {resp.status}"
            return await resp.json(content_type=None), None
    except (asyncio.TimeoutError, ClientError, ValueError) as err:
        return None, str(err) or type(err).__name__


async def async_latest_release(hass: HomeAssistant, force: bool = False) -> dict[str, Any]:
    """Neuestes veröffentlichtes Release (ohne Pre-Releases), zwischengespeichert."""
    if (hit := _cached(hass, _CACHE_KEY, force)) is not None:
        return hit
    now = time.time()
    result: dict[str, Any] = {"checked_at": now, "latest": None, "release_url": None, "error": None}
    data, error = await _async_get_json(hass, LATEST_RELEASE_URL)
    if error:
        # GitHub antwortet mit 404, solange es noch kein stabiles Release gibt.
        result["error"] = None if error == "HTTP 404" else error
    elif isinstance(data, dict):
        result["latest"] = _strip_v(data.get("tag_name")) or None
        result["release_url"] = data.get("html_url")
    # Bei einem Fehler den letzten guten Stand behalten, nur den Fehler zeigen.
    previous: dict[str, Any] | None = hass.data.get(_CACHE_KEY)
    if result["error"] and previous and previous.get("latest"):
        result = {**previous, "error": result["error"], "checked_at": now}
    hass.data[_CACHE_KEY] = result
    return result


_VERSION_RE = re.compile(
    r"^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?[-.]?(?:(alpha|beta|pre|rc|a|b)\.?(\d*))?", re.IGNORECASE
)
# Reihenfolge der Vorabstufen; eine fertige Version steht über allen.
_PRE_RANK = {"a": 0, "alpha": 0, "b": 1, "beta": 1, "pre": 1, "rc": 2}


def _version_key(value: str | None) -> tuple[int, ...]:
    """
    Sortierschlüssel: (Major, Minor, Patch, Stufe, Nummer).

    Stufe 3 = fertige Version, darunter rc (2), beta (1), alpha (0). So ist
    0.4.0b1 älter als 0.4.0, aber neuer als 0.3.2.
    """
    match = _VERSION_RE.match(str(value or "").strip())
    if not match:
        return (0, 0, 0, 3, 0)
    major, minor, patch, tag, num = match.groups()
    rank = _PRE_RANK[tag.lower()] if tag else 3
    return (int(major), int(minor or 0), int(patch or 0), rank, int(num or 0))


def is_prerelease(value: str | None) -> bool:
    return _version_key(value)[3] < 3


def compare_versions(a: str | None, b: str | None) -> int:
    """1, wenn a neuer ist als b; -1, wenn älter; 0 bei Gleichstand."""
    x, y = _version_key(a), _version_key(b)
    return (x > y) - (x < y)


async def async_latest_prerelease(hass: HomeAssistant, force: bool = False) -> dict[str, Any]:
    """
    Neueste Vorabversion (GitHub-Pre-Release), zwischengespeichert wie das
    stabile Release. Nur für das Panel; die tägliche Prüfung unter
    "Reparaturen" meldet nie Vorabversionen.
    """
    if (hit := _cached(hass, _PRE_CACHE_KEY, force)) is not None:
        return hit
    now = time.time()
    result: dict[str, Any] = {"checked_at": now, "prerelease": None, "prerelease_url": None, "error": None}
    data, error = await _async_get_json(hass, RELEASES_URL)
    if error:
        result["error"] = error
    else:
        best: tuple[str, str | None] | None = None
        for rel in data if isinstance(data, list) else []:
            if not isinstance(rel, dict) or rel.get("draft") or not rel.get("prerelease"):
                continue
            version = _strip_v(rel.get("tag_name"))
            if version and (best is None or compare_versions(version, best[0]) > 0):
                best = (version, rel.get("html_url"))
        if best:
            result["prerelease"], result["prerelease_url"] = best
    previous: dict[str, Any] | None = hass.data.get(_PRE_CACHE_KEY)
    if result["error"] and previous and previous.get("prerelease"):
        result = {**previous, "error": result["error"], "checked_at": now}
    hass.data[_PRE_CACHE_KEY] = result
    return result


def _enabled(hass: HomeAssistant) -> bool:
    """An, solange der (einzige) Eintrag die tägliche Prüfung eingeschaltet hat."""
    return any(
        bool(entry.options.get(CONF_UPDATE_CHECK, DEFAULT_UPDATE_CHECK))
        for entry in hass.config_entries.async_entries(DOMAIN)
        if entry.disabled_by is None
    )


async def async_refresh_issue(hass: HomeAssistant, release: dict[str, Any] | None = None) -> None:
    """
    Meldung unter "Reparaturen" anlegen oder entfernen.

    Ist die Prüfung aus, verschwindet eine bestehende Meldung. Ohne gültige
    Antwort von GitHub bleibt der bisherige Zustand stehen.
    """
    if not _enabled(hass):
        ir.async_delete_issue(hass, DOMAIN, ISSUE_ID)
        return
    installed = await async_installed_version(hass)
    if release is None:
        release = await async_latest_release(hass)
    latest = release.get("latest")
    if not installed or not latest:
        return
    if compare_versions(latest, installed) > 0:
        ir.async_create_issue(
            hass,
            DOMAIN,
            ISSUE_ID,
            is_fixable=False,
            is_persistent=False,
            severity=ir.IssueSeverity.WARNING,
            translation_key=ISSUE_ID,
            translation_placeholders={"installed": installed, "latest": latest},
            learn_more_url=release.get("release_url") or f"https://github.com/{GITHUB_REPO}/releases",
        )
    else:
        ir.async_delete_issue(hass, DOMAIN, ISSUE_ID)


@callback
def async_start_daily(hass: HomeAssistant) -> None:
    """Tägliche Prüfung starten (einmal pro Instanz)."""
    if _TIMER_KEY in hass.data:
        return
    unsubs: list[Any] = []

    async def _run(_now: Any = None) -> None:
        await async_refresh_issue(hass)

    async def _first(_now: Any) -> None:
        await _run()
        unsubs.append(async_track_time_interval(hass, _run, DAILY))

    unsubs.append(async_call_later(hass, random.randint(*FIRST_CHECK_DELAY), _first))
    hass.data[_TIMER_KEY] = unsubs


@callback
def async_stop_daily(hass: HomeAssistant) -> None:
    """Beim Entladen: Zeitgeber und Meldung entfernen."""
    for unsub in hass.data.pop(_TIMER_KEY, []):
        unsub()
    ir.async_delete_issue(hass, DOMAIN, ISSUE_ID)


# -- Gemeinsame Panel-Einstellungen --------------------------------------------


def _panel_store(hass: HomeAssistant) -> Store[dict[str, Any]]:
    return Store(hass, STORAGE_VERSION, PANEL_STORE_KEY)


async def async_load_panel_settings(hass: HomeAssistant) -> dict[str, Any]:
    """Einmal laden und in hass.data halten; danach synchron lesbar."""
    if PANEL_DATA_KEY not in hass.data:
        stored = await _panel_store(hass).async_load() or {}
        # Nie gespeichert: wer eine Vorabversion installiert hat, bekommt
        # auch die nächsten angeboten (sonst fände er bis zum ersten
        # stabilen Release gar kein Update).
        if "prerelease" in stored:
            prerelease = bool(stored["prerelease"])
        else:
            prerelease = is_prerelease(await async_installed_version(hass))
        hass.data[PANEL_DATA_KEY] = {
            "prerelease": prerelease,
            "prerelease_hacs": str(stored["prerelease_hacs"]) if stored.get("prerelease_hacs") else None,
        }
    return hass.data[PANEL_DATA_KEY]


@callback
def panel_settings(hass: HomeAssistant) -> dict[str, Any]:
    return dict(hass.data.get(PANEL_DATA_KEY) or PANEL_DEFAULTS)


async def async_set_panel_settings(hass: HomeAssistant, values: dict[str, Any]) -> dict[str, Any]:
    current = await async_load_panel_settings(hass)
    if "prerelease" in values:
        current["prerelease"] = bool(values["prerelease"])
    if "prerelease_hacs" in values:
        current["prerelease_hacs"] = str(values["prerelease_hacs"]) if values["prerelease_hacs"] else None
    await _panel_store(hass).async_save(dict(current))
    return dict(current)
