"""
App "Geräte-Updates" (seit 2.164.0): alle offenen Geräte-Updates auf einmal starten.

Das Panel zeigt alle Update-Entitäten von Geräten (keine Updates von Home Assistant selbst, seinen Apps und HACS), der Benutzer wählt aus und
startet. Der Server arbeitet die Auswahl als Warteschlange ab, damit sie auch weiterläuft, wenn das Fenster zu ist: höchstens drei
Updates gleichzeitig und höchstens eines je Integration (parallele Updates bei Zigbee oder Z-Wave bremsen das Funknetz). Jedes Update
startet über device_update.async_install; damit ruhen auch die Ausfall-Meldungen des Geräts während des Updates und kurz danach.
Der Fortschritt (Prozent) kommt im Panel direkt aus dem Zustand der Update-Entität; hier steht nur, was der Server weiss: wartet, läuft,
fertig, fehlgeschlagen.
"""

from __future__ import annotations

import time
from typing import Any

from homeassistant.const import STATE_OFF, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_call_later, async_track_state_change_event

from .const import DOMAIN
from .device_update import EXCLUDED_PLATFORMS, FEATURE_BACKUP, FEATURE_INSTALL, UpdateError, async_install
from .updates import update_kind

DATA_UPDATE_QUEUE = f"{DOMAIN}_update_queue"

MAX_PARALLEL = 3
# Läuft nach dem Start nichts (kein Fortschritt, kein Neustart des Geräts), gilt das Update als fehlgeschlagen
NO_PROGRESS_SECONDS = 10 * 60
# Höchstdauer eines Updates
MAX_SECONDS = 60 * 60
# Fertige und fehlgeschlagene Einträge bleiben so lange sichtbar
KEEP_SECONDS = 60 * 60


def available(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Offene Geräte-Updates, die sich installieren lassen (nach Gerät und Entität)."""
    registry = er.async_get(hass)
    out: list[dict[str, Any]] = []
    for state in hass.states.async_all("update"):
        entry = registry.async_get(state.entity_id)
        if entry is None or not entry.device_id or entry.disabled_by or entry.platform in EXCLUDED_PLATFORMS:
            continue
        if state.state != "on" or update_kind(hass, state.entity_id) != "devices":
            continue
        features = int(state.attributes.get("supported_features") or 0)
        if not features & FEATURE_INSTALL:
            continue
        attrs = state.attributes
        out.append(
            {
                "entity_id": state.entity_id,
                "device_id": entry.device_id,
                "platform": entry.platform,
                "features": features,
                "installed": attrs.get("installed_version"),
                "latest": attrs.get("latest_version"),
                "title": str(attrs.get("title") or attrs.get("friendly_name") or state.entity_id),
            }
        )
    return sorted(out, key=lambda i: (i["platform"], i["title"].lower()))


class UpdateQueue:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.items: dict[str, dict[str, Any]] = {}
        self._unsub: CALLBACK_TYPE | None = None

    def snapshot(self) -> list[dict[str, Any]]:
        now = time.time()
        for eid in [e for e, i in self.items.items() if i["status"] in ("done", "failed") and now - i["ended"] > KEEP_SECONDS]:
            del self.items[eid]
        keys = ("entity_id", "device_id", "platform", "status", "error", "installed", "latest", "title")
        return [{k: i[k] for k in keys} for i in self.items.values()]

    def enqueue(self, entity_ids: list[str], backup: bool) -> list[dict[str, Any]]:
        """Gewählte Updates einreihen; was schon wartet oder läuft, bleibt wie es ist; Fertiges und Fehlgeschlagenes wird neu eingereiht."""
        by_id = {u["entity_id"]: u for u in available(self.hass)}
        for eid in entity_ids:
            cur = self.items.get(eid)
            if eid not in by_id or (cur and cur["status"] in ("waiting", "running")):
                continue
            u = by_id[eid]
            self.items[eid] = {**u, "backup": backup, "status": "waiting", "error": None, "seen": False, "started": 0.0, "ended": 0.0, "cancel": []}
        self._listen()
        self._pump()
        return self.snapshot()

    def _listen(self) -> None:
        if self._unsub:
            self._unsub()
        self._unsub = async_track_state_change_event(self.hass, list(self.items), self._on_state)

    def _pump(self) -> None:
        running = [i for i in self.items.values() if i["status"] == "running"]
        busy = {i["platform"] for i in running}
        for item in self.items.values():
            if len(running) >= MAX_PARALLEL:
                break
            if item["status"] != "waiting" or item["platform"] in busy:
                continue
            try:
                async_install(self.hass, item["device_id"], item["entity_id"], bool(item["backup"]) and bool(item["features"] & FEATURE_BACKUP))
            except UpdateError as err:
                self._end(item, "failed", str(err), pump=False)
                continue
            item["status"] = "running"
            item["started"] = time.time()
            item["cancel"] = [
                async_call_later(self.hass, NO_PROGRESS_SECONDS, lambda _n, i=item: self._timeout(i, False)),
                async_call_later(self.hass, MAX_SECONDS, lambda _n, i=item: self._timeout(i, True)),
            ]
            running.append(item)
            busy.add(item["platform"])

    def _timeout(self, item: dict[str, Any], hard: bool) -> None:
        if item["status"] == "running" and (hard or not item["seen"]):
            self._end(item, "failed", "timeout" if hard else "no progress")

    def _end(self, item: dict[str, Any], status: str, error: str | None = None, pump: bool = True) -> None:
        for cancel in item.get("cancel", []):
            cancel()
        item.update(status=status, error=error, ended=time.time(), cancel=[])
        if pump:
            self._pump()

    @callback
    def _on_state(self, event: Event) -> None:
        item = self.items.get(event.data["entity_id"])
        if item is None or item["status"] != "running":
            return
        new = event.data.get("new_state")
        if new is None or new.state == STATE_OFF:
            self._end(item, "done")
        elif new.attributes.get("in_progress") or new.state in (STATE_UNAVAILABLE, STATE_UNKNOWN):
            item["seen"] = True
        elif item["seen"]:
            self._end(item, "failed", "update failed")

    def stop(self) -> None:
        if self._unsub:
            self._unsub()
            self._unsub = None
        for item in self.items.values():
            for cancel in item.get("cancel", []):
                cancel()


def get_queue(hass: HomeAssistant) -> UpdateQueue:
    queue = hass.data.get(DATA_UPDATE_QUEUE)
    if queue is None:
        queue = hass.data[DATA_UPDATE_QUEUE] = UpdateQueue(hass)
    return queue
