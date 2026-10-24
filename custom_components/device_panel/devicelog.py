"""
Geräteprotokoll (seit 2.118.0): alles zu einem Gerät (oder zu allen) in einer Liste, neueste zuerst.

Quellen: die Ereignisse des Panel-Logs mit Gerät (Ausfall, Batterie, Laden, Empfang seit 2.120.0, Updates, neue Geräte, Push), die Wechsel online/ausgefallen aus der
Verfügbarkeit (mit Dauer), die Protokolle von Magic Push und Routinen. Das Panel-Log führt Magic Push und Routinen auch; sie zählen hier nur
aus ihren eigenen Protokollen (reicher: Inhalt der Meldung, Trace). Debug-Einträge, Einträge des Systems und der Apps gehören keinem Gerät.

Eintrag: at, source ("event", "avail", "magic", "routine"), cat (Chip), dev (Geräte-ID), dname (Name des Geräts, nur ohne Gerät als Auswahl) und je Quelle:
event: level, title, text, detail; avail: k ("offline", "online"), dur; magic und routine: die Felder des Protokolls (siehe protocol.py; bei Routinen ist "src" der Auslöser) mit id, name.
"""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr

from . import activity
from .const import DATA_AVAILABILITY, DATA_MAGIC, DATA_PROTOCOL, DATA_PUSHLOG, DATA_ROUTINES

# Kategorien des Panel-Logs, die ein Gerät betreffen können (Magic Push und Routinen kommen aus den Protokollen)
EVENT_CATS = ("outage", "battery", "charge", "signal", "updates", "new", "push")
CATS = ("outage", "battery", "charge", "signal", "updates", "new", "push", "magic", "routine")


def _avail_entries(hass: HomeAssistant, device_ids: list[str], since: float, until: float) -> list[dict[str, Any]]:
    """Wechsel online/ausgefallen aus der Verfügbarkeit; Lücken (HA lief nicht) zählen nicht, der erste Eintrag ist nur der Anfang."""
    log = hass.data.get(DATA_AVAILABILITY)
    if log is None:
        return []
    out: list[dict[str, Any]] = []
    for dev in device_ids:
        prev: int | None = None
        down_at: float | None = None
        for index, (at, state) in enumerate(log.events(dev)):
            if state is None:
                continue
            if index > 0 and prev is not None and state != prev:
                entry: dict[str, Any] = {"at": at, "source": "avail", "cat": "outage", "dev": dev, "k": "offline" if state == 0 else "online"}
                if state == 1 and down_at is not None:
                    entry["dur"] = max(0.0, at - down_at)
                if since <= at <= until:
                    out.append(entry)
            if state == 0 and prev != 0:
                down_at = at
            prev = state
    return out


# Welche Art Meldung zu welcher Kategorie der Einträge gehört (Thema der Meldung → Kategorie), für die Verbindung "Meldung wird gesendet" → Inhalt
PUSH_CATS = {"outage": "outage", "online": "outage", "battery": "battery", "charge": "charge", "new": "new"}
# So lange nach dem Eintrag darf die Meldung folgen (Sammelzeit, Ruhezeit ausgenommen: dann steht die Meldung als eigene Zeile da)
LINK_WINDOW_S = 900


def _event_entries(hass: HomeAssistant, device: str | None, since: float, until: float) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for e in activity.get(hass).entries:
        # Meldungen ("push") kommen seit 2.124.0 aus dem eigenen Meldungsprotokoll (push_log.py), nicht aus dem Panel-Log
        if e.get("cat") not in EVENT_CATS or e.get("cat") == "push" or e.get("level") == "debug":
            continue
        ids = e.get("device_ids") or ([e["device_id"]] if e.get("device_id") else [])
        if not ids or not since <= e["at"] <= until:
            continue
        if device is not None and device not in ids:
            continue
        for dev in [device] if device is not None else ids:
            entry = {"at": e["at"], "source": "event", "cat": e["cat"], "dev": dev, "level": e.get("level", "info"), "title": e.get("title", ""), "text": e.get("text", ""), "detail": e.get("detail", ""), "code": e.get("code", "")}
            out.append(entry)
    return out


def _push_entries(hass: HomeAssistant, device: str | None, since: float, until: float) -> list[dict[str, Any]]:
    """Gesendete Meldungen aus dem Meldungsprotokoll: eine Zeile je Gerät, das die Meldung nennt."""
    log = hass.data.get(DATA_PUSHLOG)
    if log is None:
        return []
    out: list[dict[str, Any]] = []
    for item in log.items(device, since, until):
        p = item["p"]
        code = f"push_{p['res']}"
        failed = p["res"] in ("failed", "missing")
        for dev in [device] if device is not None else item["devs"]:
            out.append(
                {
                    "at": item["at"], "source": "event", "cat": "push", "dev": dev, "level": "error" if failed else "info", "title": p["target"],
                    "text": activity.text(hass, code, title=p["title"]), "detail": "", "code": code, "push": {**p, "at": item["at"]},
                }
            )
    return out


def _link_pushes(scope: list[dict[str, Any]]) -> None:
    """
    Einträge wie "wieder online nach 9 Min.: Meldung wird gesendet" bekommen die Meldung, die kurz danach für dasselbe Gerät hinausging (Feld "push"),
    damit ein Tipp auf die Zeile zeigt, an wen was gesendet wurde. Die Meldung bleibt auch eine eigene Zeile.
    """
    pushes: dict[str, list[dict[str, Any]]] = {}
    for e in scope:
        if e["source"] == "event" and e["cat"] == "push" and e.get("push"):
            pushes.setdefault(e["dev"], []).append(e)
    for e in scope:
        if e["source"] != "event" or e["cat"] == "push" or e.get("push") or not e.get("code", "").endswith("_sent"):
            continue
        for p in sorted(pushes.get(e["dev"], []), key=lambda x: x["at"]):
            topic = PUSH_CATS.get(p["push"].get("topic", ""))
            if topic == e["cat"] and 0 <= p["at"] - e["at"] <= LINK_WINDOW_S:
                e["push"] = p["push"]
                break


def _protocol_entries(hass: HomeAssistant, device: str | None, since: float, until: float) -> list[dict[str, Any]]:
    store = hass.data.get(DATA_PROTOCOL)
    if store is None:
        return []
    out: list[dict[str, Any]] = []
    for src, key in (("magic", DATA_MAGIC), ("routine", DATA_ROUTINES)):
        manager = hass.data.get(key)
        if manager is None:
            continue
        rows = manager.rules(device) if src == "magic" else manager.routines(device)
        for row in rows:
            for e in store.entries(row["id"]):
                if since <= e["at"] <= until:
                    out.append({**e, "source": src, "cat": src, "dev": row.get("device_id"), "id": row["id"], "name": row["name"]})
    return out


def _text(e: dict[str, Any]) -> str:
    keys = ("title", "text", "detail", "name", "body", "value", "err", "dname", "target")
    push = e.get("push") or {}
    return (" ".join(str(e.get(k, "")) for k in keys) + " " + " ".join(str(push.get(k, "")) for k in ("title", "body", "target"))).lower()


def query(
    hass: HomeAssistant,
    device: str | None,
    *,
    since: float | None,
    until: float,
    cat: str | None = None,
    text: str = "",
    limit: int = 100,
    offset: int = 0,
) -> dict[str, Any]:
    """Einträge im Zeitraum, neueste zuerst. Die Zahlen je Kategorie gelten für den ganzen Zeitraum (ohne Auswahl und Suche)."""
    since_ts = since if since is not None else 0.0
    dev_reg = dr.async_get(hass)
    if device is not None:
        ids = [device]
    else:
        log = hass.data.get(DATA_AVAILABILITY)
        ids = list(getattr(log, "_events", {}))
    scope = _avail_entries(hass, ids, since_ts, until) + _event_entries(hass, device, since_ts, until) + _push_entries(hass, device, since_ts, until) + _protocol_entries(hass, device, since_ts, until)
    if device is None:
        names: dict[str, str] = {}
        for e in scope:
            dev = e.get("dev")
            if dev and dev not in names:
                entry = dev_reg.async_get(dev)
                names[dev] = (entry.name_by_user or entry.name or "") if entry else ""
            if dev and names.get(dev):
                e["dname"] = names[dev]
    _link_pushes(scope)
    scope.sort(key=lambda e: e["at"], reverse=True)
    counts: dict[str, int] = {}
    for e in scope:
        counts[e["cat"]] = counts.get(e["cat"], 0) + 1
    needle = text.strip().lower()
    shown = [e for e in scope if (not cat or e["cat"] == cat) and (not needle or needle in _text(e))]
    return {
        "counts": counts,
        "total": len(shown),
        "all": len(scope),
        "entries": shown[offset : offset + limit],
        "oldest": min((e["at"] for e in scope), default=None),
    }
