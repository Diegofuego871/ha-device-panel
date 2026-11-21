"""
HealthCheck-Dienste (seit 2.236.0, Wunsch des Nutzers; Vorbild: Alarmageddon 1.65.0 bis 1.73.0): Lebenszeichen an externe Dienste wie
Healthchecks.io, Cronitor, Better Stack oder Uptime Kuma. Fällt Home Assistant, das Netz oder der Strom aus, bleibt das Lebenszeichen aus, und der
Dienst alarmiert; das kann das Panel selbst nicht melden.

- Bis zu MAX_HEALTHCHECKS Dienste, je mit Namen, URL und einem Abstand (1 Minute bis 24 Stunden).
- Inhalt: im Abstand die URL des Dienstes ("in Ordnung"). Dazu "Fälle" (Entscheid des Nutzers; das Panel hat keinen Selbsttest wie Alarmageddon):
  je Dienst eine geordnete Liste von Zeilen, jede mit einer Art (`HEALTHCHECK_CASES`: ein Gerät ist ausgefallen, eine Batterie ist schwach, das
  Backup ist fehlgeschlagen) und einem URL-Zusatz. Trifft ein Fall zu, geht statt des Lebenszeichens die URL mit dem Zusatz dieser Zeile hinaus;
  treffen mehrere zu, gilt die oberste Zeile (ein Aufruf je Takt, wie bei Alarmageddon der Alarm vor dem Fehler). Beginnt oder endet ein Fall,
  geht sofort ein Aufruf hinaus (das Ende als Lebenszeichen, höchstens alle HEALTHCHECK_MIN_GAP Sekunden).
- Testknöpfe im Panel: je Fall der Zeile, dazu "OK senden" (nach einem Test bleibt der Dienst sonst bis zum nächsten Lebenszeichen rot).
- Protokoll je Dienst (healthcheck_log.py): jeder Aufruf mit Art, Ergebnis, Antwortzeit und Auslöser; Mitschreiben ist Zusatz und hält nie
  ein Lebenszeichen auf (im `try`).

Sicherheitsregeln: Ein Lebenszeichen ist ein GET ohne Daten aus dem Panel. Es läuft als eigene Aufgabe mit Zeitgrenze und hält nie etwas auf. Die URL
ist ein Geheimnis des Dienstes (wer sie kennt, kann einen Ausfall verdecken). Ausnahme vom Grundsatz, nichts Geheimes im Panel zu zeigen (Entscheid
des Nutzers, wie bei Alarmageddon): Panel (nur für Administratoren) und Sicherung zeigen und enthalten sie; in Logzeilen und im Protokoll steht nur
der Rechnername, auch die Meldung einer Ausnahme der Verbindung kommt nie ins Log (sie enthält oft die URL).
"""

from __future__ import annotations

import asyncio
from datetime import timedelta
from functools import partial
import logging
import re
import time
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_call_later, async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from . import activity
from .const import (
    DATA_BACKUP_ALERT,
    DATA_BATTERY,
    DATA_HEALTHCHECK,
    DATA_OUTAGE,
    HEALTHCHECK_CASES,
    HEALTHCHECK_DEFAULT_INTERVAL,
    HEALTHCHECK_INTERVAL_RANGE,
    HEALTHCHECK_MIN_GAP,
    HEALTHCHECK_NAME_MAX,
    HEALTHCHECK_START_DELAY,
    HEALTHCHECK_STORE_KEY,
    HEALTHCHECK_SUFFIX_MAX,
    HEALTHCHECK_TICK,
    HEALTHCHECK_TIMEOUT,
    HEALTHCHECK_URL_MAX,
    MAX_HEALTHCHECKS,
    STORAGE_VERSION,
)
from .healthcheck_log import HealthLog

_LOGGER = logging.getLogger(__name__)

RESULTS = ("ok", "http", "timeout", "error")
HEALTHCHECK_ID = re.compile(r"^[a-z0-9]{1,16}$")


# -- Prüfen der Eingaben --------------------------------------------------------------------------------------------------------------------------


def valid_url(value: Any) -> str | None:
    """Adresse eines Lebenszeichens: http oder https mit Rechnername, ohne Leerzeichen, höchstens HEALTHCHECK_URL_MAX Zeichen; sonst None."""
    if not isinstance(value, str):
        return None
    url = value.strip()
    if not url or len(url) > HEALTHCHECK_URL_MAX or any(c.isspace() for c in url):
        return None
    try:
        parts = urlsplit(url)
    except ValueError:
        return None
    if parts.scheme not in ("http", "https") or not parts.hostname:
        return None
    return url


def apply_suffix(url: str, suffix: str) -> str | None:
    """
    Adresse eines Falls aus der URL und dem Zusatz (generisch): "/…" kommt hinten an den Pfad (vor die Parameter), "?…" (oder "&…") setzt Parameter
    und ersetzt gleichnamige. Beispiele: Healthchecks.io und Better Stack "/fail", Cronitor "?state=fail". Leerer oder ungültiger Zusatz: None.
    """
    if not suffix:
        return None
    parts = urlsplit(url)
    if suffix.startswith("/"):
        return urlunsplit(parts._replace(path=parts.path.rstrip("/") + suffix))
    if suffix[0] in "?&":
        extra = parse_qsl(suffix[1:], keep_blank_values=True)
        if not extra:
            return None
        names = {k for k, _v in extra}
        query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k not in names] + extra
        return urlunsplit(parts._replace(query=urlencode(query)))
    return None


def valid_suffix(url: str, value: Any) -> str | None:
    """Zusatz: leer, oder mit "/", "?" oder "&" am Anfang, ohne Leerzeichen, höchstens HEALTHCHECK_SUFFIX_MAX Zeichen, ergibt eine gültige URL; sonst None."""
    if value is None:
        return ""
    if not isinstance(value, str):
        return None
    suffix = value.strip()
    if not suffix:
        return ""
    if len(suffix) > HEALTHCHECK_SUFFIX_MAX or any(c.isspace() for c in suffix):
        return None
    try:
        full = apply_suffix(url, suffix)
    except ValueError:
        return None
    return suffix if full is not None and valid_url(full) is not None else None


def valid_name(value: Any) -> str | None:
    """Name eines Dienstes (Pflichtfeld): ohne Leerzeichen am Rand, ohne Steuerzeichen, 1 bis HEALTHCHECK_NAME_MAX Zeichen; sonst None."""
    if not isinstance(value, str):
        return None
    name = " ".join(value.split())
    return name if 0 < len(name) <= HEALTHCHECK_NAME_MAX and name.isprintable() else None


def valid_cases(url: str, value: Any) -> list[dict[str, str]]:
    """Zeilen der Fälle in der Reihenfolge der Eingabe: jede Art höchstens einmal, ein ungültiger Zusatz macht die Zeile ungültig (sie fällt weg)."""
    out: list[dict[str, str]] = []
    for item in value if isinstance(value, list) else []:
        if not isinstance(item, dict) or item.get("kind") not in HEALTHCHECK_CASES or any(c["kind"] == item["kind"] for c in out):
            continue
        suffix = valid_suffix(url, item.get("suffix"))
        if suffix:  # ohne Zusatz gibt es nichts zu senden: die Zeile wäre wirkungslos
            out.append({"kind": item["kind"], "suffix": suffix})
    return out


def valid_items(value: Any) -> list[dict[str, Any]]:
    """
    Dienste: höchstens MAX_HEALTHCHECKS, jeder Eintrag einzeln geprüft (ein beschädigter fällt weg, nie die Liste).
    {"id", "name", "url", "interval" (Sekunden), "cases": [{"kind", "suffix"}]}. Ohne gültigen Namen heisst der Dienst wie der Rechner seiner URL.
    """
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in value if isinstance(value, list) else []:
        if not isinstance(item, dict) or len(out) >= MAX_HEALTHCHECKS:
            continue
        hid, url = item.get("id"), valid_url(item.get("url"))
        if not isinstance(hid, str) or not HEALTHCHECK_ID.match(hid) or hid in seen or url is None:
            continue
        interval = item.get("interval")
        if isinstance(interval, bool) or not isinstance(interval, int):
            interval = HEALTHCHECK_DEFAULT_INTERVAL
        interval = max(HEALTHCHECK_INTERVAL_RANGE[0], min(HEALTHCHECK_INTERVAL_RANGE[1], interval))
        seen.add(hid)
        name = valid_name(item.get("name")) or (urlsplit(url).hostname or "?")[:HEALTHCHECK_NAME_MAX]
        out.append({"id": hid, "name": name, "url": url, "interval": interval, "cases": valid_cases(url, item.get("cases"))})
    return out


def host_of(url: str) -> str:
    """Nur der Rechnername (für Log und Protokoll); die ganze URL ist ein Geheimnis des Dienstes."""
    try:
        return urlsplit(url).hostname or "?"
    except ValueError:
        return "?"


def case_url(item: dict[str, Any], kind: str) -> str | None:
    """Adresse für einen Fall: URL mit dem Zusatz der Zeile dieser Art; ohne diese Zeile None."""
    for row in item.get("cases") or []:
        if row["kind"] == kind:
            try:
                return apply_suffix(str(item.get("url") or ""), str(row.get("suffix") or ""))
            except ValueError:
                return None
    return None


# -- Welche Fälle gerade zutreffen ----------------------------------------------------------------------------------------------------------------


def case_active(hass: HomeAssistant, kind: str) -> bool:
    """Trifft der Fall jetzt zu? Liest nur, was das Panel ohnehin führt (Ausfälle, Batterien, Backup); jeder Fehler beim Lesen heisst "trifft nicht zu"."""
    try:
        if kind == "offline":
            outage = hass.data.get(DATA_OUTAGE)
            return bool(outage is not None and outage.offline)
        if kind == "battery":
            battery = hass.data.get(DATA_BATTERY)
            return bool(battery is not None and battery.low)
        if kind == "backup":
            alert = hass.data.get(DATA_BACKUP_ALERT)
            return bool(alert is not None and alert.failing)
    except Exception:  # noqa: BLE001 - im Zweifel ein Lebenszeichen "in Ordnung", nie keines
        _LOGGER.exception("The health check could not read the case %s", kind)
    return False


def active_case(hass: HomeAssistant, item: dict[str, Any]) -> str | None:
    """Der Fall, der für diesen Dienst gilt: die oberste Zeile, deren Fall zutrifft; sonst None."""
    for row in item.get("cases") or []:
        if case_active(hass, row["kind"]):
            return row["kind"]
    return None


def _clean_status(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict) or not isinstance(value.get("at"), str) or dt_util.parse_datetime(value["at"]) is None:
        return None
    if value.get("sent") not in ("ok", *HEALTHCHECK_CASES) or value.get("result") not in RESULTS:
        return None
    code = value.get("code")
    return {"at": value["at"], "sent": value["sent"], "result": value["result"], "code": code if isinstance(code, int) and not isinstance(code, bool) else None,
            "test": value.get("test") is True}


class HealthCheck:
    """Eine Instanz für alle Dienste (hass.data[DATA_HEALTHCHECK])."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, HEALTHCHECK_STORE_KEY)
        self._items: list[dict[str, Any]] = []
        self.status: dict[str, dict[str, Any]] = {}  # je Dienst der letzte Aufruf: Zeit, was gesendet wurde ("ok" oder der Fall), Ergebnis, HTTP-Status
        self._config: dict[str, dict[str, Any]] = {}  # Stand der Dienste beim letzten Abgleich (geänderte senden sofort neu)
        self._later: dict[str, CALLBACK_TYPE] = {}
        self._hold_until = 0.0  # nach dem Start erst nach HEALTHCHECK_START_DELAY
        self._last_try: dict[str, float] = {}
        self._last_auto: dict[str, float] = {}  # letzter Aufruf ohne Testknopf
        self._wanted: dict[str, str] = {}  # je Dienst, was zuletzt galt ("ok" oder der Fall): ein Wechsel geht sofort hinaus
        self._unsubs: list[CALLBACK_TYPE] = []
        self._fresh: set[str] = set()  # Dienste ohne Aufruf seit dem Start (Auslöser "start" im Protokoll)
        self.log = HealthLog(hass)
        self.started = False

    async def async_load(self) -> None:
        await self.log.async_load()
        stored = await self._store.async_load()
        if not isinstance(stored, dict):
            return
        self._items = valid_items(stored.get("items"))
        for hid, value in (stored.get("status") or {}).items() if isinstance(stored.get("status"), dict) else ():
            if isinstance(hid, str) and (clean := _clean_status(value)) is not None:
                self.status[hid] = clean

    @callback
    def async_start(self) -> None:
        if self.started:
            return
        self.started = True
        self._fresh = {i["id"] for i in self._items}
        self._wanted = {i["id"]: active_case(self.hass, i) or "ok" for i in self._items}
        self._hold_until = dt_util.utcnow().timestamp() + HEALTHCHECK_START_DELAY
        self._unsubs.append(async_track_time_interval(self.hass, self._tick, timedelta(seconds=HEALTHCHECK_TICK)))
        self._unsubs.append(async_call_later(self.hass, HEALTHCHECK_START_DELAY, self._tick))
        self.async_reconfigure(first=True)

    async def async_stop(self) -> None:
        for unsub in [*self._unsubs, *self._later.values()]:
            unsub()
        self._unsubs.clear()
        self._later.clear()
        self._config.clear()
        self.started = False
        await self._store.async_save(self._stored())
        await self.log.async_save()

    def _stored(self) -> dict[str, Any]:
        return {"items": self._items, "status": self.status}

    def items(self) -> list[dict[str, Any]]:
        return list(self._items)

    def item(self, hid: str) -> dict[str, Any] | None:
        return next((i for i in self._items if i["id"] == hid), None)

    def listing(self) -> list[dict[str, Any]]:
        """Dienste für das Panel: die gespeicherten Werte (mit der URL, Entscheid des Nutzers), der letzte Aufruf und seit wann der Zustand gilt."""
        return [{**item, "status": self.status.get(item["id"]), "log": self.log.brief(item["id"])} for item in self._items]

    async def async_set_items(self, items: list[dict[str, Any]]) -> None:
        """Dienste speichern (sofort, nicht gesammelt: sie gehören zur Einrichtung) und abgleichen."""
        self._items = valid_items(items)
        await self._store.async_save(self._stored())
        self.async_reconfigure()

    # -- Zeitgeber --

    @callback
    def async_reconfigure(self, first: bool = False) -> None:
        """Nach dem Speichern: neue und geänderte Dienste sind sofort fällig, entfernte vergessen (samt ihrem Protokoll)."""
        current = {i["id"]: i for i in self._items}
        for hid in [h for h in self._config if h not in current or self._config[h] != current[h]]:
            if (later := self._later.pop(hid, None)) is not None:
                later()
            self._config.pop(hid, None)
            self._last_auto.pop(hid, None)  # geändert: gleich mit den neuen Werten
            if hid not in current:
                self.status.pop(hid, None)
                self._last_try.pop(hid, None)
                self._fresh.discard(hid)
                self._wanted.pop(hid, None)
                self.log.remove(hid)
        fresh = [hid for hid in current if hid not in self._config]
        for hid in fresh:
            self._config[hid] = dict(current[hid])
            self._wanted[hid] = active_case(self.hass, current[hid]) or "ok"
        self._save()
        # Neue und geänderte senden gleich (nach dem Start erst nach HEALTHCHECK_START_DELAY, über den Takt)
        if not first:
            for hid in fresh:
                self.async_ping(hid, by="save")

    @callback
    def _tick(self, _now: Any = None) -> None:
        """Jeder Dienst, dessen Abstand seit dem letzten Aufruf (ohne Testknopf) vergangen ist, sendet jetzt; ein Wechsel des Falls geht sofort hinaus."""
        now = dt_util.utcnow().timestamp()
        if not self.started or now < self._hold_until:
            return
        for item in self._items:
            hid = item["id"]
            wanted = active_case(self.hass, item) or "ok"
            if wanted != self._wanted.get(hid, "ok"):
                self._wanted[hid] = wanted
                # Ein Fall geht ohne Mindestabstand hinaus (der Dienst soll es gleich wissen), sein Ende als Lebenszeichen mit Mindestabstand
                self.async_ping(hid, respect_gap=wanted == "ok", by="case")
            elif now - self._last_auto.get(hid, 0.0) >= int(item["interval"]):
                self.async_ping(hid, by="start" if hid in self._fresh else "tick")

    @callback
    def async_ping(self, hid: str, respect_gap: bool = False, test: str | None = None, by: str = "tick") -> asyncio.Task | None:
        """
        Ein Aufruf als eigene Aufgabe (nie abwarten). `respect_gap`: höchstens alle HEALTHCHECK_MIN_GAP Sekunden, sonst danach. `test`: Knopf im Panel,
        "ok" oder die Art eines Falls sendet genau das (ohne den Zustand des Panels zu fragen); einen Fall ohne Zeile gibt es nicht (None). `by`: der
        Auslöser für das Protokoll ("tick", "case", "start", "save"; mit `test` immer "test").
        """
        item = self.item(hid)
        if item is None or (test not in (None, "ok") and case_url(item, str(test)) is None):
            return None
        if test:
            self._last_try[hid] = dt_util.utcnow().timestamp()
            return self.hass.async_create_background_task(self._send(item, test, "test"), f"device panel health check test {hid}")
        if respect_gap:
            wait = HEALTHCHECK_MIN_GAP - (dt_util.utcnow().timestamp() - self._last_try.get(hid, 0.0))
            if wait > 0:
                if (later := self._later.pop(hid, None)) is not None:
                    later()
                self._later[hid] = async_call_later(self.hass, wait, partial(self._ping_later, hid))
                return None
        self._last_try[hid] = self._last_auto[hid] = dt_util.utcnow().timestamp()
        if hid in self._fresh:
            self._fresh.discard(hid)
            by = "start" if by == "tick" else by
        # Ein aufgeschobener Aufruf (Ende eines Falls) entfällt: dieser zeigt schon den aktuellen Stand
        if (later := self._later.pop(hid, None)) is not None:
            later()
        return self.hass.async_create_background_task(self._send(item, None, by), f"device panel health check {hid}")

    @callback
    def _ping_later(self, hid: str, _now: Any = None) -> None:
        self._later.pop(hid, None)
        self.async_ping(hid, by="case")

    async def _send(self, item: dict[str, Any], test: str | None = None, by: str = "tick") -> dict[str, Any]:
        hid = item["id"]
        # Was geht hinaus: beim Testknopf genau das Gewählte, sonst der Fall, der jetzt gilt (die oberste Zeile), sonst das Lebenszeichen
        sent = test if test else (active_case(self.hass, item) or "ok")
        bad = case_url(item, sent) if sent != "ok" else None
        if sent != "ok" and bad is None:
            sent = "ok"  # die Zeile wurde inzwischen entfernt
        url = bad or item["url"]
        code: int | None = None
        ms: int | None = None
        began = time.monotonic()
        try:
            async with asyncio.timeout(HEALTHCHECK_TIMEOUT):
                async with async_get_clientsession(self.hass).get(url, allow_redirects=True) as response:
                    code = response.status
            # Antwortzeit bis zur Antwort des Dienstes (Kachel "Antwortzeit" im Protokoll)
            ms = round((time.monotonic() - began) * 1000)
            result = "ok" if 200 <= code < 300 else "http"
        except TimeoutError:
            result = "timeout"
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - jeder Fehler der Verbindung; die Meldung des Fehlers enthielte oft die URL (Geheimnis), darum nicht ins Log
            result = "error"
        now = dt_util.utcnow()
        status = {"at": now.isoformat(), "sent": sent, "result": result, "code": code, "test": bool(test)}
        if self.item(hid) is not None:  # inzwischen gelöscht: nichts mehr festhalten
            self.status[hid] = status
            try:
                self.log.record(hid, at=now, sent=sent, result=result, code=code, ms=ms, by="test" if test else by, interval=int(item["interval"]))
            except Exception:  # noqa: BLE001 - das Protokoll ist Zusatz, ein Fehler darin hält keinen Aufruf auf
                _LOGGER.exception("The health check log could not record a call")
            if result != "ok":
                host = host_of(item["url"])
                _LOGGER.warning("Health check %s to %s failed: %s", item.get("name", ""), host, f"HTTP {code}" if code is not None else result)
                activity.record(self.hass, "warning", "system", "healthcheck_failed", str(item.get("name") or host), None, host=host, reason=f"HTTP {code}" if code is not None else result)
            self._save()
        return status

    @callback
    def _save(self) -> None:
        self._store.async_delay_save(self._stored, 5)


async def async_get_healthcheck(hass: HomeAssistant) -> HealthCheck:
    """Die eine Instanz (laden mit Sperre, falls mehrere Stellen zugleich fragen)."""
    if (healthcheck := hass.data.get(DATA_HEALTHCHECK)) is not None:
        return healthcheck
    async with hass.data.setdefault(f"{DATA_HEALTHCHECK}_lock", asyncio.Lock()):
        if (healthcheck := hass.data.get(DATA_HEALTHCHECK)) is None:
            healthcheck = HealthCheck(hass)
            await healthcheck.async_load()
            hass.data[DATA_HEALTHCHECK] = healthcheck
    return healthcheck


async def async_stop_healthcheck(hass: HomeAssistant) -> None:
    if (healthcheck := hass.data.pop(DATA_HEALTHCHECK, None)) is not None:
        await healthcheck.async_stop()
