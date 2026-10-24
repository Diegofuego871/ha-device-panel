"""
Ruhezeit (seit 2.95.0): Push-Meldungen werden in einem Zeitfenster zurückgehalten und danach als Zusammenfassung oder einzeln zugestellt.

Eine globale Ruhezeit mit eigenem Fenster je Wochentag (Beginn und Ende; reicht das Ende nicht über den Beginn, endet das Fenster am Folgetag).
Welche Meldungsarten zurückgehalten werden, wählt der Nutzer (auch "Status"); kritische Meldungen aus Magic Push kommen immer sofort.
Alle Meldungen laufen durch push.async_push mit ihrer Art ("topic"): dort wird gefragt, ob sie jetzt gehalten werden. Die gehaltenen liegen in einer
eigenen Datei (ein Neustart von HA verliert nichts) und gehen am Ende des Fensters hinaus. Gleiche Tags (derselbe Ausfall, dann die Rückkehr)
zählen nur einmal: es gilt die letzte Meldung.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from typing import Any

import voluptuous as vol
from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from . import activity
from .const import DOMAIN, NOTIFY_NONE, STORAGE_VERSION

_LOGGER = logging.getLogger(__name__)


def _push():
    """push.py, erst bei Gebrauch geladen: push importiert options_api, und das importiert diese Datei (Kreis)."""
    from . import push  # noqa: PLC0415

    return push

STORE_KEY = f"{DOMAIN}.quiet"
# Arten von Meldungen, die sich zurückhalten lassen ("online" ist die Rückkehr nach einem Ausfall)
QUIET_TOPICS = ("outage", "online", "battery", "charge", "new", "updates", "panelupdate", "routines", "status", "magic")
# Standard: alles ausser Status-App, Magic Push und Routinen (die Nutzer wählen sie bewusst dazu)
DEFAULT_QUIET_TOPICS = tuple(t for t in QUIET_TOPICS if t not in ("status", "magic", "routines"))
QUIET_MODES = ("summary", "single")
DEFAULT_QUIET_MODE = "summary"
# Höchstens so viele gehaltene Meldungen (ältere fallen weg): ein Schutz gegen unbegrenztes Wachsen
QUEUE_MAX = 300
# Namen je Zeile der Zusammenfassung, der Rest als "und N weitere"
SUMMARY_NAMES_MAX = 6
_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def default_days() -> list[dict[str, Any]]:
    """Jeden Tag von 22:00 bis 07:00."""
    return [{"on": True, "from": "22:00", "to": "07:00"} for _ in range(7)]


def quiet_days(value: Any) -> list[dict[str, Any]]:
    """Sieben Tage (Montag zuerst), je {"on": bool, "from": "HH:MM", "to": "HH:MM"}."""
    if not isinstance(value, list) or len(value) != 7:
        raise vol.Invalid("sieben Tage erwartet")
    days: list[dict[str, Any]] = []
    for day in value:
        if not isinstance(day, dict) or not isinstance(day.get("on"), bool):
            raise vol.Invalid("Tag mit \"on\" (Wahrheitswert) erwartet")
        for key in ("from", "to"):
            if not isinstance(day.get(key), str) or not _TIME_RE.match(day[key]):
                raise vol.Invalid(f"Uhrzeit HH:MM in \"{key}\" erwartet")
        days.append({"on": day["on"], "from": day["from"], "to": day["to"]})
    return days


def quiet_topics(value: Any) -> list[str]:
    """Auswahl der zurückgehaltenen Arten (in fester Reihenfolge, Unbekanntes ist ein Fehler)."""
    if not isinstance(value, list) or any(not isinstance(t, str) or t not in QUIET_TOPICS for t in value):
        raise vol.Invalid("Liste bekannter Meldungsarten erwartet")
    return [t for t in QUIET_TOPICS if t in value]


def quiet_mode(value: Any) -> str:
    if value not in QUIET_MODES:
        raise vol.Invalid("\"summary\" oder \"single\" erwartet")
    return str(value)


def _minutes(text: str) -> int:
    return int(text[:2]) * 60 + int(text[3:])


def window_end(days: list[dict[str, Any]], now: datetime) -> datetime | None:
    """Ende der Ruhezeit, die jetzt gilt (lokale Zeit), sonst None. Fenster, die nahtlos aneinander anschliessen, zählen als eines."""
    local = dt_util.as_local(now)
    windows: list[tuple[datetime, datetime]] = []
    for back in (1, 0, -1, -2, -3, -4, -5, -6):
        day = local.date() - timedelta(days=back)
        entry = days[day.weekday()]
        if not entry["on"]:
            continue
        begin = datetime.combine(day, datetime.min.time(), tzinfo=local.tzinfo) + timedelta(minutes=_minutes(entry["from"]))
        end = datetime.combine(day, datetime.min.time(), tzinfo=local.tzinfo) + timedelta(minutes=_minutes(entry["to"]))
        if end <= begin:
            end += timedelta(days=1)
        windows.append((begin, end))
    covering = [w for w in windows if w[0] <= local < w[1]]
    if not covering:
        return None
    end = max(w[1] for w in covering)
    # Anschliessende Fenster verlängern die Ruhezeit
    extended = True
    while extended:
        extended = False
        for begin, stop in windows:
            if begin <= end < stop:
                end = stop
                extended = True
    return end


def _is_critical(data: dict[str, Any] | None) -> bool:
    """Kritische Mitteilung (Magic Push, siehe push.critical_data): kommt immer sofort."""
    sound = ((data or {}).get("push") or {}).get("sound") if isinstance((data or {}).get("push"), dict) else None
    return bool(isinstance(sound, dict) and sound.get("critical"))


class QuietManager:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORE_KEY)
        self._items: list[dict[str, Any]] = []
        self._timer: CALLBACK_TYPE | None = None

    @property
    def items(self) -> list[dict[str, Any]]:
        return self._items

    def _options(self) -> dict[str, Any]:
        from .options_api import effective  # noqa: PLC0415 - Kreis vermeiden: options_api kennt diese Datei

        return effective(self.hass)

    async def async_start(self) -> None:
        stored = await self._store.async_load() or {}
        raw = stored.get("items") if isinstance(stored, dict) else None
        if isinstance(raw, list):
            self._items = [i for i in raw if isinstance(i, dict) and isinstance(i.get("target"), str) and isinstance(i.get("title"), str)][-QUEUE_MAX:]
        await self.async_options_changed()

    async def async_stop(self) -> None:
        if self._timer is not None:
            self._timer()
            self._timer = None
        await self._store.async_save({"items": self._items})

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"items": self._items}, 1)

    def _end(self, opts: dict[str, Any]) -> datetime | None:
        if not opts["quiet_enabled"]:
            return None
        return window_end(opts["quiet_days"], dt_util.utcnow())

    def hold(self, topic: str, target: str, title: str, message: str, data: dict[str, Any] | None, quiet: dict[str, Any] | None, devices: list[str] | None = None) -> bool:
        """True, wenn die Meldung jetzt zurückgehalten wird (dann stellt sie das Ende der Ruhezeit zu)."""
        if topic not in QUIET_TOPICS or not target or target == NOTIFY_NONE or _is_critical(data):
            return False
        opts = self._options()
        if topic not in opts["quiet_topics"]:
            return False
        end = self._end(opts)
        if end is None:
            return False
        item = {"topic": topic, "target": target, "title": title, "message": message, "data": data or {}, "at": dt_util.utcnow().timestamp(), "quiet": quiet or {}, "devices": list(devices or [])}
        self._items.append(item)
        del self._items[:-QUEUE_MAX]
        self._save()
        _push()._journal(self.hass, "info", "push_held", target, title, message, topic, devices, "held")
        self._schedule(end)
        return True

    @callback
    def _schedule(self, end: datetime | None) -> None:
        if self._timer is not None:
            self._timer()
            self._timer = None
        if end is not None and self._items:
            delay = max(1.0, (end - dt_util.utcnow()).total_seconds() + 1)
            self._timer = async_call_later(self.hass, delay, self._on_timer)

    @callback
    def _on_timer(self, _now: Any) -> None:
        self._timer = None
        self.hass.async_create_task(self.async_options_changed())

    async def async_options_changed(self) -> None:
        """Ruhezeit oder Auswahl geändert, Termin erreicht oder Start: alles, was nicht mehr gehalten wird, geht hinaus."""
        opts = self._options()
        end = self._end(opts)
        held = set(opts["quiet_topics"])
        if end is None:
            release, keep = self._items, []
        else:
            release = [i for i in self._items if i["topic"] not in held]
            keep = [i for i in self._items if i["topic"] in held]
        if release:
            self._items = keep
            self._save()
            await self._deliver(release, opts)
        self._schedule(end)

    async def _deliver(self, items: list[dict[str, Any]], opts: dict[str, Any]) -> None:
        """Gehaltene Meldungen zustellen: je Ziel eine Zusammenfassung, oder alle einzeln (letzte je Tag)."""
        hass = self.hass
        if opts["quiet_mode"] == "single":
            last: dict[str, dict[str, Any]] = {}
            plain: list[dict[str, Any]] = []
            for item in items:
                tag = (item.get("data") or {}).get("tag")
                if isinstance(tag, str) and tag:
                    last.pop(tag, None)
                    last[tag] = item
                else:
                    plain.append(item)
            for item in sorted([*plain, *last.values()], key=lambda i: i["at"]):
                await _push().async_push(hass, item["target"], item["title"], item["message"], item["data"] or None, devices=item.get("devices") or None, log_topic=item.get("topic"))
            return
        by_target: dict[str, list[dict[str, Any]]] = {}
        for item in items:
            by_target.setdefault(item["target"], []).append(item)
        for target, group in by_target.items():
            title, message = build_summary(hass, group)
            data = _push().notification_data(hass, f"{DOMAIN}_quiet", _push().panel_url())
            # Die Zusammenfassung gehört zu allen Geräten der zurückgehaltenen Meldungen (Meldungsprotokoll, seit 2.124.0)
            devices = list(dict.fromkeys(d for item in group for d in item.get("devices") or []))
            await _push().async_push(hass, target, title, message, data, devices=devices or None, log_topic="quiet")
        activity.record(hass, "info", "push", "quiet_released", "Device Panel", count=len(items))


def _short(hass: HomeAssistant, names: list[str]) -> str:
    shown = ", ".join(names[:SUMMARY_NAMES_MAX])
    if len(names) > SUMMARY_NAMES_MAX:
        shown += " " + _push().text(hass, "group_more", count=len(names) - SUMMARY_NAMES_MAX)
    return shown


def build_summary(hass: HomeAssistant, items: list[dict[str, Any]]) -> tuple[str, str]:
    """Titel und Text der Zusammenfassung: Ausfälle (offen, behoben), danach die übrigen Arten."""
    lines: list[str] = []
    counts: list[str] = []
    # Ausfall und Rückkehr desselben Tags (Gerät oder Integration) bilden einen Vorgang
    events: dict[str, dict[str, Any]] = {}
    for item in items:
        if item["topic"] not in ("outage", "online"):
            continue
        quiet = item.get("quiet") or {}
        tag = (item.get("data") or {}).get("tag") or item["title"]
        label = quiet.get("label") or item["title"]
        entry = events.setdefault(tag, {"label": label, "since": quiet.get("since"), "outage": False, "back": False})
        if item["topic"] == "outage":
            entry["outage"] = True
            entry["since"] = quiet.get("since") or entry["since"]
            entry["back"] = False
        else:
            entry["back"] = True
    if events:
        still = [e for e in events.values() if e["outage"] and not e["back"]]
        short = [e["label"] for e in events.values() if e["outage"] and e["back"]]
        back = [e["label"] for e in events.values() if not e["outage"] and e["back"]]
        counts.append(f"{_push().text(hass, 'quiet_outage')} {sum(1 for e in events.values() if e['outage'])}" if any(e["outage"] for e in events.values()) else f"{_push().text(hass, 'quiet_online')} {len(back)}")
        if still:
            labels = [e["label"] + (f" ({_push().text(hass, 'outage_since', time=_local(e['since']))})" if e["since"] else "") for e in still]
            lines.append(f"{_push().text(hass, 'quiet_open')}: {_short(hass, labels)}")
        if short:
            lines.append(f"{_push().text(hass, 'quiet_short')}: {_short(hass, short)}")
        if back:
            lines.append(f"{_push().text(hass, 'quiet_back')}: {_short(hass, back)}")
    for topic in QUIET_TOPICS:
        if topic in ("outage", "online"):
            continue
        group = [i for i in items if i["topic"] == topic]
        if not group:
            continue
        names = [(i.get("quiet") or {}).get("label") or i["title"] for i in group]
        name = _push().text(hass, f"quiet_{topic}")
        counts.append(f"{name} {len(group)}")
        lines.append(f"{name}: {_short(hass, names)}")
    title = _push().text(hass, "quiet_title", counts=" · ".join(counts))
    return title, "\n".join(lines)


def _local(ts: float) -> str:
    return dt_util.as_local(dt_util.utc_from_timestamp(ts)).strftime("%H:%M")
