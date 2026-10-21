"""
Versionsprüfung für die Einstellungen im Panel (übernommen aus unifi_dynamic).

Die installierte Version kommt aus dem Manifest der laufenden Integration,
die neueste aus den GitHub-Releases des Repositories. Das ist der Rückfall,
wenn HACS fehlt, und ergänzt HACS, das nur alle paar Tage prüft. Auf Wunsch
prüft die Integration täglich selbst und meldet eine neue Version unter
"Reparaturen". Installiert wird immer über HACS (update.install): auf Knopfdruck
vom Panel, und seit 2.22.0 auf Wunsch automatisch nach der täglichen Prüfung
(Panel-Einstellung auto_update; nur zusammen mit der täglichen Prüfung). Der
Neustart von Home Assistant bleibt immer Sache des Benutzers.
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
import re
import time
from datetime import timedelta
from typing import Any

from aiohttp import ClientError, ClientTimeout
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import issue_registry as ir
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_call_later, async_track_time_change, async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.loader import async_get_integration

from .http_limit import read_limited
from .const import (
    CONF_UPDATE_CHECK,
    CONF_UPDATE_CHECK_TIME,
    CONF_UPDATE_NOTIFY,
    DEFAULT_UPDATE_CHECK,
    DOMAIN,
    GITHUB_REPO,
    NOTIFY_NONE,
    PANEL_URL_PATH,
    STORAGE_VERSION,
)

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

_LOGGER = logging.getLogger(__name__)
_CACHE_KEY = f"{DOMAIN}_latest_release"
_PRE_CACHE_KEY = f"{DOMAIN}_latest_prerelease"
_TIMER_KEY = f"{DOMAIN}_update_timer"
_TIME_KEY = f"{DOMAIN}_update_check_time"
# Gemeinsame Panel-Einstellungen der Instanz (nicht pro Benutzer):
# Vorabversionen anbieten, und welchen HACS-Schalter "Pre-release" das Panel
# selbst eingeschaltet hat (nur den schaltet es wieder aus).
PANEL_DATA_KEY = f"{DOMAIN}_panel_settings"
PANEL_STORE_KEY = f"{DOMAIN}.panel"
PANEL_DEFAULTS: dict[str, Any] = {"prerelease": False, "auto_update": False, "notified": {}}
RESTART_ISSUE_ID = "restart_required"
# HACS braucht für Download und Entpacken etwas; danach gilt der Versuch als gescheitert.
INSTALL_TIMEOUT = 300
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


# Release Notes im Panel (seit 2.3.0): die Abschnitte der Versionen aus CHANGELOG(.de).md am Tag
# der neuesten Version, damit auch übersprungene Versionen dabei sind. Fehlt die Datei (oder die
# Sprache), gilt der Text des GitHub-Releases (Englisch).
RAW_URL = f"https://raw.githubusercontent.com/{GITHUB_REPO}"
TAG_RELEASE_URL = f"https://api.github.com/repos/{GITHUB_REPO}/releases/tags"
NOTES_MAX = 15
NOTES_MAX_BYTES = 1_000_000
# Antwort der GitHub-API (Release-Angaben mit Text): grösser wird sie nicht, alles darüber wird verworfen.
JSON_MAX_BYTES = 2_000_000
_NOTES_KEY = f"{DOMAIN}_release_notes"
# Versionsnummer, wie sie im URL-Pfad stehen darf (kommt vom Panel): Ziffern, Punkte, Vorabstufe.
VERSION_ARG = re.compile(r"^v?\d{1,3}(\.\d{1,3}){0,2}([-.]?(a|b|rc|alpha|beta|pre)\.?\d{0,3})?\Z", re.IGNORECASE)
_SECTION_RE = re.compile(r"^## \[([^\]]+)\](?: - (\S+))?\s*$")
_FOOTNOTE_RE = re.compile(r"^\[[^\]]+\]: \S+")
_NOT_RELEASED_RE = re.compile(r"^(Not released|Nicht veröffentlicht)\b", re.IGNORECASE)


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
            raw = await read_limited(resp, JSON_MAX_BYTES)
            if raw is None:
                return None, "too large"
            return json.loads(raw), None
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
        # Automatisch installieren (seit 2.23.0): sobald irgendeine Prüfung eine neuere Version findet (Start, tägliche Prüfung,
        # Öffnen der Einstellungen), nicht erst nach einem eigenen Lauf. Läuft im Hintergrund, die Prüfung wartet nicht darauf.
        if auto_update_active(hass):
            hass.async_create_task(async_auto_install(hass), f"{DOMAIN}_auto_install")
        else:
            # Ohne automatische Installation: Push "Version verfügbar" (einmal pro Version, seit 2.25.0)
            await async_notify(hass, "found", latest, installed)
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


def auto_update_active(hass: HomeAssistant) -> bool:
    """Automatisch installieren: eingeschaltet und nur mit der täglichen Prüfung (sonst wirkungslos)."""
    return bool(panel_settings(hass).get("auto_update")) and _enabled(hass)


# Link auf dieses Repository auf GitHub, am Host verankert (ein fremder Host mit gleichem Pfad zählt nicht). Mit und ohne
# Pfad dahinter: bei einer Installation von einem Stand statt von einem Release endet der Link ohne Schrägstrich.
_REPO_URL_RE = re.compile(rf"^https://github\.com/{re.escape(GITHUB_REPO)}(?:[/?#]|$)", re.IGNORECASE)


def is_repo_url(url: Any) -> bool:
    """Gehört der Link zu diesem Repository auf GitHub?"""
    return bool(_REPO_URL_RE.match(str(url or "").strip()))


def _hacs_update_entity(hass: HomeAssistant) -> str | None:
    """Update-Entität von HACS für dieses Repository: erkannt am Link des Releases, nie am Titel oder an einer festen ID."""
    registry = er.async_get(hass)
    for entry in registry.entities.values():
        if entry.platform != "hacs" or entry.domain != "update" or entry.disabled_by is not None:
            continue
        state = hass.states.get(entry.entity_id)
        if state is not None and is_repo_url(state.attributes.get("release_url")):
            return entry.entity_id
    return None


async def async_notify(hass: HomeAssistant, kind: str, latest: str, installed: str | None) -> bool:
    """
    Push zum Panel-Update (seit 2.25.0), einmal pro Version und Art: "found" = neue Version gefunden, "done" = automatisch
    installiert (Neustart steht aus). Nur mit eingeschaltetem "update_notify"; Ziel: eigener Empfänger, sonst das globale Ziel.
    Gemerkt wird erst nach dem Versand, damit ein fehlgeschlagener Push beim nächsten Durchgang wieder versucht wird.
    """
    from . import options_api, push  # noqa: PLC0415 (push und options_api importieren dieses Modul)

    opts = options_api.effective(hass)
    if not opts[CONF_UPDATE_NOTIFY]:
        return False
    settings = await async_load_panel_settings(hass)
    notified = settings.setdefault("notified", {})
    if notified.get(kind) == latest:
        return False
    target = options_api.notify_target(opts, "panelupdate")
    if not target or target == NOTIFY_NONE:
        return False
    title = push.text(hass, f"panelupdate_{kind}_title", latest=latest, installed=installed or "?")
    message = push.text(hass, f"panelupdate_{kind}_text", latest=latest, installed=installed or "?")
    data = push.notification_data(hass, f"{DOMAIN}_panelupdate", f"/{PANEL_URL_PATH}")
    if not await push.async_push(hass, target, title, message, data, topic="panelupdate"):
        return False
    notified[kind] = latest
    await _panel_store(hass).async_save(dict(settings))
    return True


async def async_auto_install(hass: HomeAssistant) -> bool:
    """
    Sobald eine Prüfung eine neuere Version findet (Start, tägliche Prüfung, Öffnen der Einstellungen): ist sie da, über HACS installieren (update.install). Nur mit
    "auto_update" und eingeschalteter täglicher Prüfung; eine Vorabversion nur, wenn Vorabversionen angeboten werden.
    Danach bleibt der Neustart dem Benutzer überlassen: Eintrag im Protokoll und Meldung unter "Reparaturen".
    Liefert True, wenn installiert wurde.
    """
    from . import activity  # noqa: PLC0415 (activity importiert push, das seinerseits update_check kennt)

    if not auto_update_active(hass):
        return False
    lock = hass.data.setdefault(f"{DOMAIN}_auto_update_lock", asyncio.Lock())
    if lock.locked():
        return False
    async with lock:
        entity_id = _hacs_update_entity(hass)
        if entity_id is None:
            return False
        try:
            # Die Entität über den öffentlichen Dienst neu laden lassen; HACS prüft sonst nur alle paar Stunden, eine eben erschienene
            # Version erscheint dann erst später (die HACS-Interna werden bewusst nicht angefasst)
            await hass.services.async_call("homeassistant", "update_entity", {"entity_id": entity_id}, blocking=True)
        except Exception:  # noqa: BLE001 (nicht kritisch: dann gilt der bisherige Stand von HACS)
            pass
        state = hass.states.get(entity_id)
        if state is None:
            return False
        attrs = state.attributes
        latest, installed_hacs = attrs.get("latest_version"), attrs.get("installed_version")
        running = await async_installed_version(hass)
        if not latest or not running or compare_versions(latest, running) <= 0:
            # GitHub kennt eine neuere Version, HACS noch nicht: im nächsten Durchgang wieder (Debug-Protokoll)
            activity.record(hass, "debug", "updates", "auto_update_wait", "Device Panel", None, hacs=latest or "?", running=running or "?")
            return False
        # Schon heruntergeladen, wartet nur noch auf den Neustart
        if installed_hacs and compare_versions(installed_hacs, running) > 0 and compare_versions(installed_hacs, latest) >= 0:
            return False
        if attrs.get("in_progress"):
            return False
        if is_prerelease(latest) and not panel_settings(hass).get("prerelease"):
            return False
        try:
            async with asyncio.timeout(INSTALL_TIMEOUT):
                await hass.services.async_call("update", "install", {"entity_id": entity_id}, blocking=True)
        except Exception as err:  # noqa: BLE001 (jede Ursache gehört ins Protokoll; am nächsten Tag neuer Versuch)
            activity.record(hass, "warning", "updates", "auto_update_failed", "Device Panel", None, version=latest, error=str(err) or type(err).__name__)
            # Installation gescheitert: wenigstens melden, dass es eine neue Version gibt
            await async_notify(hass, "found", latest, running)
            return False
        activity.record(hass, "info", "updates", "auto_update_done", "Device Panel", None, version=latest)
        ir.async_create_issue(
            hass,
            DOMAIN,
            RESTART_ISSUE_ID,
            is_fixable=False,
            is_persistent=False,
            severity=ir.IssueSeverity.WARNING,
            translation_key=RESTART_ISSUE_ID,
            translation_placeholders={"latest": latest, "installed": running},
        )
        await async_notify(hass, "done", latest, running)
        return True


def _check_time(hass: HomeAssistant) -> str:
    """Eingestellte Uhrzeit der täglichen Prüfung ("" = automatisch)."""
    from .options_api import effective  # noqa: PLC0415 (options_api importiert dieses Modul)

    return str(effective(hass)[CONF_UPDATE_CHECK_TIME] or "")


def _schedule(hass: HomeAssistant) -> None:
    """Zeitgeber der täglichen Prüfung setzen: feste Uhrzeit (seit 2.25.0) oder automatisch (zufällig nach dem Start, dann alle 24 Std.)."""
    unsubs: list[Any] = hass.data[_TIMER_KEY]
    for unsub in unsubs:
        unsub()
    unsubs.clear()
    when = _check_time(hass)
    hass.data[_TIME_KEY] = when

    async def _run(_now: Any = None) -> None:
        await async_refresh_issue(hass)

    if when:
        hour, minute = (int(part) for part in when.split(":"))
        unsubs.append(async_track_time_change(hass, _run, hour=hour, minute=minute, second=0))
        return

    async def _first(_now: Any) -> None:
        await _run()
        unsubs.append(async_track_time_interval(hass, _run, DAILY))

    unsubs.append(async_call_later(hass, random.randint(*FIRST_CHECK_DELAY), _first))


@callback
def async_start_daily(hass: HomeAssistant) -> None:
    """Tägliche Prüfung starten (einmal pro Instanz)."""
    if _TIMER_KEY in hass.data:
        return
    hass.data[_TIMER_KEY] = []
    _schedule(hass)


@callback
def async_reschedule_daily(hass: HomeAssistant) -> None:
    """Uhrzeit der Prüfung geändert: Zeitgeber neu setzen (sonst bleibt der Lauf unberührt)."""
    if _TIMER_KEY in hass.data and hass.data.get(_TIME_KEY) != _check_time(hass):
        _schedule(hass)


@callback
def async_stop_daily(hass: HomeAssistant) -> None:
    """Beim Entladen: Zeitgeber und Meldung entfernen."""
    for unsub in hass.data.pop(_TIMER_KEY, []):
        unsub()
    hass.data.pop(_TIME_KEY, None)
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
            "auto_update": bool(stored.get("auto_update")),
            "notified": {k: str(v) for k, v in (stored.get("notified") or {}).items() if k in ("found", "done") and v},
        }
    return hass.data[PANEL_DATA_KEY]


@callback
def panel_settings(hass: HomeAssistant) -> dict[str, Any]:
    # "notified" (gemerkte Versionen der Push-Meldungen) ist intern und gehört nicht ins Panel
    return {k: v for k, v in dict(hass.data.get(PANEL_DATA_KEY) or PANEL_DEFAULTS).items() if k != "notified"}


async def async_set_panel_settings(hass: HomeAssistant, values: dict[str, Any]) -> dict[str, Any]:
    current = await async_load_panel_settings(hass)
    if "prerelease" in values:
        current["prerelease"] = bool(values["prerelease"])
    if "auto_update" in values:
        current["auto_update"] = bool(values["auto_update"])
    await _panel_store(hass).async_save(dict(current))
    return panel_settings(hass)


# -- Release Notes im Panel ------------------------------------------------------


def changelog_sections(text: str) -> list[dict[str, Any]]:
    """
    Abschnitte einer CHANGELOG-Datei (Keep a Changelog): Version, Datum und
    Markdown-Text, in der Reihenfolge der Datei (neueste zuerst). Der Vermerk
    "Nicht veröffentlicht; enthalten in …" fällt weg, die Link-Fussnoten am
    Ende gehören zu keinem Abschnitt.
    """
    out: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for line in text.splitlines():
        match = _SECTION_RE.match(line)
        if match:
            current = {"version": _strip_v(match.group(1)), "date": match.group(2), "lines": []}
            out.append(current)
        elif current is not None:
            if _FOOTNOTE_RE.match(line):
                current = None
            else:
                current["lines"].append(line)
    sections = []
    for section in out:
        lines = [x for x in section.pop("lines") if not _NOT_RELEASED_RE.match(x.strip())]
        body = "\n".join(lines).strip()
        if body and section["version"][:1].isdigit():
            sections.append({**section, "notes": re.sub(r"\n{3,}", "\n\n", body)})
    return sections


def select_sections(sections: list[dict[str, Any]], installed: str | None, latest: str) -> list[dict[str, Any]]:
    """Versionen nach der installierten bis zur neuesten, neueste zuerst; ohne installierte nur die neueste."""
    if not installed:
        picked = [x for x in sections if compare_versions(x["version"], latest) == 0]
    else:
        picked = [
            x
            for x in sections
            if compare_versions(x["version"], installed) > 0 and compare_versions(x["version"], latest) <= 0
        ]
    picked.sort(key=lambda x: _version_key(x["version"]), reverse=True)
    return picked[:NOTES_MAX]


async def _async_get_text(hass: HomeAssistant, url: str) -> tuple[str | None, str | None]:
    """Textdatei holen; (Text, Fehler). 404 ist kein Fehler im engeren Sinn (Text None, Fehler "HTTP 404")."""
    try:
        session = async_get_clientsession(hass)
        async with session.get(url, timeout=TIMEOUT) as resp:
            if resp.status >= 400:
                return None, f"HTTP {resp.status}"
            raw = await read_limited(resp, NOTES_MAX_BYTES)
            if raw is None:
                return None, "too large"
            return raw.decode("utf-8", errors="replace"), None
    except (asyncio.TimeoutError, ClientError, ValueError) as err:
        return None, str(err) or type(err).__name__


async def async_release_notes(
    hass: HomeAssistant, installed: str | None, latest: str, language: str, force: bool = False
) -> dict[str, Any]:
    """
    Release Notes der Versionen nach der installierten bis zur neuesten.
    Deutsch aus CHANGELOG.de.md, sonst (und als Rückfall) Englisch aus
    CHANGELOG.md, zuletzt der Text des GitHub-Releases. Zwischengespeichert
    wie die Versionsprüfung. Ergebnis: entries [{version, date, notes}],
    language ("de"/"en", die tatsächlich gelieferte), error (Text oder None).
    """
    wanted = "de" if language == "de" else "en"
    # HACS nennt die Version mit dem Tag ("v2.6.0"); intern gilt die Nummer ohne "v".
    latest = latest.lstrip("vV")
    installed = installed.lstrip("vV") if installed else installed
    key = (installed or "", latest, wanted)
    cache: dict[Any, dict[str, Any]] = hass.data.setdefault(_NOTES_KEY, {})
    if (hit := cache.get(key)) is not None:
        age = time.time() - hit["checked_at"]
        if age < (ERROR_RETRY_SECONDS if hit["error"] else CACHE_SECONDS) and not (force and age >= FORCE_MIN_SECONDS):
            return hit
    result: dict[str, Any] = {"checked_at": time.time(), "entries": [], "language": wanted, "error": None}
    # Der Tag heisst je nach Release "v2.63.0" oder "2.63.0" (der Nutzer legt Releases selbst an,
    # mal mit, mal ohne "v"): beide Schreibweisen versuchen, sonst gibt es "HTTP 404".
    tags = [f"v{latest}", latest]
    names = ["CHANGELOG.de.md", "CHANGELOG.md"] if wanted == "de" else ["CHANGELOG.md"]
    error: str | None = None
    for name in names:
        for tag in tags:
            text, error = await _async_get_text(hass, f"{RAW_URL}/{tag}/{name}")
            if text is None:
                continue
            entries = select_sections(changelog_sections(text), installed, latest)
            if entries:
                result["entries"] = [{k: x[k] for k in ("version", "date", "notes")} for x in entries]
                result["language"] = "de" if name.endswith(".de.md") else "en"
                break
        if result["entries"]:
            break
    if not result["entries"]:
        # Rückfall: der Text des GitHub-Releases (Englisch), nur für die neueste Version.
        for tag in tags:
            data, error = await _async_get_json(hass, f"{TAG_RELEASE_URL}/{tag}")
            if isinstance(data, dict) and isinstance(data.get("body"), str) and data["body"].strip():
                published = str(data.get("published_at") or "")[:10] or None
                result["entries"] = [{"version": latest, "date": published, "notes": data["body"].strip()[:NOTES_MAX_BYTES]}]
                result["language"] = "en"
                error = None
                break
    result["error"] = None if result["entries"] else (error or "HTTP 404")
    if len(cache) > 20:
        cache.clear()
    cache[key] = result
    return result
