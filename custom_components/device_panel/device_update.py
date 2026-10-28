"""
Update eines Geräts aus dem Geräte-Popup starten (seit 2.161.0).

Home Assistant bietet je Gerät eine Update-Entität (Dienst update.install, Fortschritt im Attribut in_progress und update_percentage,
Release Notes über update/release_notes). Das Panel startet das Update nur auf Knopfdruck eines Administrators und nach Rückfrage.

Ein Update startet das Gerät neu, es gilt dann kurz als ausgefallen. Darum hält das Panel die Ausfall-Meldungen dieses Geräts zurück:
ab dem Start bis zu einer Wartezeit nach dem Ende des Updates (Standard 5 Minuten). Der Ausfall im Panel bleibt sichtbar und wird
protokolliert; ist das Gerät nach der Wartezeit noch weg, kommt die Meldung dann (sie wird nicht verworfen).
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from typing import Any

from homeassistant.const import STATE_OFF, STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_call_later, async_track_state_change_event

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

DATA_UPDATE_HOLD = f"{DOMAIN}_update_hold"
# Letzter Fehlertext der Integration je Update-Entität (seit 2.166.0): das Fenster eines einzelnen Geräts fragt ihn ab
DATA_UPDATE_ERRORS = f"{DOMAIN}_update_errors"

# Merkmale der Update-Entität (homeassistant.components.update.UpdateEntityFeature)
FEATURE_INSTALL = 1
FEATURE_PROGRESS = 4
FEATURE_BACKUP = 8
FEATURE_RELEASE_NOTES = 16

HOLD_SECONDS = 5 * 60
# Höchstdauer, die ein einzelnes Update beobachtet wird (dann gilt nur noch die Wartezeit)
WATCH_MAX_SECONDS = 60 * 60
# Updates von Home Assistant selbst und seinen Apps gehören nicht ins Geräte-Popup
EXCLUDED_PLATFORMS = frozenset({"hassio", "homeassistant"})


def _hold(hass: HomeAssistant) -> dict[str, float]:
    return hass.data.setdefault(DATA_UPDATE_HOLD, {})


def last_error(hass: HomeAssistant, entity_id: str) -> str | None:
    """Fehlertext, mit dem die Integration das zuletzt gestartete Update dieser Entität abgelehnt oder beendet hat."""
    return hass.data.get(DATA_UPDATE_ERRORS, {}).get(entity_id)


def held_until(hass: HomeAssistant, device_id: str, now: float | None = None) -> float | None:
    """Ende der Zurückhaltung der Ausfall-Meldungen für das Gerät (Unix-Zeit), sonst None."""
    until = _hold(hass).get(device_id)
    return until if until is not None and until > (now if now is not None else time.time()) else None


def installable_updates(hass: HomeAssistant, device_id: str) -> list[dict[str, Any]]:
    """Update-Entitäten des Geräts, die ein Update anbieten und sich installieren lassen: Entität und Merkmale."""
    found: list[dict[str, Any]] = []
    for entry in er.async_entries_for_device(er.async_get(hass), device_id):
        if entry.domain != "update" or entry.disabled_by or entry.platform in EXCLUDED_PLATFORMS:
            continue
        state = hass.states.get(entry.entity_id)
        if state is None or state.state != STATE_ON:
            continue
        features = int(state.attributes.get("supported_features") or 0)
        if features & FEATURE_INSTALL:
            found.append({"entity_id": entry.entity_id, "features": features})
    return found


class UpdateError(Exception):
    """Das Update lässt sich nicht starten (Text für den Benutzer)."""


@callback
def async_install(hass: HomeAssistant, device_id: str, entity_id: str, backup: bool = False, on_error: Callable[[str], None] | None = None) -> None:
    """
    Update starten: Meldungen des Geräts zurückhalten, dann update.install, ohne auf das Ende zu warten.

    Der Dienst läuft im Hintergrund und wartet auf die Integration; meldet sie einen Fehler (zum Beispiel "Gerät nicht erreichbar"), geht
    der Text an on_error (seit 2.165.0). Sonst bliebe nur das Protokoll von Home Assistant, und das Panel könnte den Grund nicht nennen.
    """
    match = next((u for u in installable_updates(hass, device_id) if u["entity_id"] == entity_id), None)
    if match is None:
        raise UpdateError("no installable update for this device")
    if backup and not match["features"] & FEATURE_BACKUP:
        raise UpdateError("backup not supported")
    now = time.time()
    _hold(hass)[device_id] = now + HOLD_SECONDS
    _watch(hass, device_id, entity_id, now)
    data: dict[str, Any] = {"entity_id": entity_id}
    if backup:
        data["backup"] = True

    errors = hass.data.setdefault(DATA_UPDATE_ERRORS, {})
    errors.pop(entity_id, None)

    async def _run() -> None:
        try:
            await hass.services.async_call("update", "install", data, blocking=True)
        except Exception as err:  # noqa: BLE001 - jede Antwort der Integration ist für den Nutzer ein Grund
            _LOGGER.warning("Update of %s failed: %s", entity_id, err)
            errors[entity_id] = (str(err) or type(err).__name__)[:300]
            if on_error is not None:
                on_error(str(err) or type(err).__name__)

    hass.async_create_task(_run())


@callback
def _watch(hass: HomeAssistant, device_id: str, entity_id: str, started: float) -> None:
    """Hält die Meldungen zurück, solange das Update läuft, und noch HOLD_SECONDS nach dem Ende."""
    seen = {"running": False}
    unsubs: list[CALLBACK_TYPE] = []

    @callback
    def finish() -> None:
        while unsubs:
            unsubs.pop()()
        _hold(hass)[device_id] = time.time() + HOLD_SECONDS

    @callback
    def changed(event: Event) -> None:
        new = event.data.get("new_state")
        if new is None or new.state == STATE_OFF:
            # Das Update ist eingespielt (die Entität meldet "aktuell") oder gibt es nicht mehr
            finish()
        elif new.attributes.get("in_progress") or new.state in (STATE_UNAVAILABLE, STATE_UNKNOWN):
            # Läuft, oder das Gerät startet gerade neu und seine Entität fehlt: weiter zurückhalten
            seen["running"] = True
            _hold(hass)[device_id] = time.time() + HOLD_SECONDS
        elif seen["running"]:
            # War am Laufen und steht wieder auf "Update verfügbar": fehlgeschlagen oder abgebrochen
            finish()

    @callback
    def timeout(_now: Any) -> None:
        if unsubs:
            finish()

    unsubs.append(async_track_state_change_event(hass, [entity_id], changed))
    unsubs.append(async_call_later(hass, WATCH_MAX_SECONDS, timeout))
