"""
Messfehler im Batteriestand abfangen (seit 2.43.0), ohne dass jemand etwas einstellen muss.

Manche Sensoren melden zwischendurch einen unmöglichen Wert: 76 % - 2 % - 68 % innerhalb weniger Minuten (Fehlerbericht des Nutzers,
Kühlschrank-Sensoren). Das löste "Batterie schwach" aus und liess ein Gerät als "lädt" erscheinen. Schnell leere Akkus
(Staubsauger) müssen dagegen sofort gelten. Darum entscheidet nicht der Wert, sondern die Geschwindigkeit des Abfalls:

- Ein Abfall gilt als verdächtig, wenn er mindestens JUMP_POINTS Punkte beträgt und grösser ist, als eine Batterie in der
  vergangenen Zeit physikalisch verlieren kann (MAX_RATE Punkte pro Minute plus MARGIN). Ein Staubsauger verliert etwa einen
  Punkt pro Minute, ein Sensor in 6 Minuten keine 48 Punkte. Meldet ein Gerät nur selten, wächst die erlaubte Menge mit der Zeit.
- Ein verdächtiger Stand wird gehalten: Bis zur Bestätigung gilt weiter der letzte glaubwürdige Stand. Bestätigt wird er, wenn
  eine weitere Meldung dazu passt (höchstens CONSISTENT Punkte Abstand) und mindestens CONFIRM_SECONDS vergangen sind, oder wenn
  er HOLD_SECONDS lang unverändert blieb. Kehrt der Stand vorher zurück (höchstens RECOVER Punkte unter dem alten), war es ein Ausreisser.
- Steigt der Stand, wird nichts gefiltert (Laden und Batteriewechsel sind echt).

Der Zustand liegt im Arbeitsspeicher; nach einem Neustart gilt die erste Meldung.
"""

from __future__ import annotations

import time
from typing import Any

from homeassistant.core import HomeAssistant

from . import activity
from .const import DOMAIN

DATA_GUARD = f"{DOMAIN}_battery_guard"

# Ein Abfall unter so vielen Punkten ist nie verdächtig (normaler Betrieb, auch für schnell leere Akkus).
JUMP_POINTS = 25.0
# Plausibler Höchstverbrauch in Punkten pro Minute (Staubsauger beim Saugen: etwa 1) und fester Zuschlag für Sensoren, die selten melden.
MAX_RATE = 2.0
MARGIN = 10.0
# Bestätigung eines verdächtigen Stands.
CONFIRM_SECONDS = 600.0
HOLD_SECONDS = 1800.0
CONSISTENT = 10.0
# Ein Stand höchstens so viele Punkte unter dem alten gilt als zurückgekehrt (Ausreisser).
RECOVER = 15.0


def suspicious(previous: float, level: float, seconds: float) -> bool:
    """Ist der Abfall von previous auf level nach seconds Sekunden unglaubwürdig schnell?"""
    drop = previous - level
    if drop < JUMP_POINTS:
        return False
    return drop > MAX_RATE * max(seconds, 30.0) / 60.0 + MARGIN


class _Entry:
    __slots__ = ("level", "at", "pending", "since", "seen", "stamp", "ignored")

    def __init__(self, level: float, at: float, stamp: Any) -> None:
        self.level = level  # letzter glaubwürdiger Stand
        self.at = at
        self.pending: float | None = None  # gehaltener verdächtiger Stand
        self.since = 0.0
        self.seen = 0
        self.stamp = stamp  # zuletzt verarbeiteter Zustand (last_updated): jede Meldung nur einmal
        self.ignored: list[float] = []  # Zeitpunkte verworfener Messfehler (für die Fakten der KI, seit 2.45.0)


class BatteryGuard:
    """Glaubwürdiger Batteriestand je Entität; wird von allen Lesern gleich benutzt (Liste, Meldungen, Laden)."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._entries: dict[str, _Entry] = {}

    def level(self, entity_id: str, state: Any, now: float | None = None) -> float | None:
        """Der glaubwürdige Stand zu einem Zustand (Prozent) oder None, wenn der Zustand keine Zahl von 0 bis 100 ist."""
        try:
            value = float(state.state)
        except (AttributeError, TypeError, ValueError):
            return None
        if not 0 <= value <= 100:
            return None
        now = now if now is not None else time.time()
        stamp = (getattr(state, "last_updated", None), state.state)
        entry = self._entries.get(entity_id)
        if entry is None:
            self._entries[entity_id] = _Entry(value, now, stamp)
            return value
        if stamp == entry.stamp:
            # Derselbe Zustand noch einmal gelesen: keine neue Meldung, aber die Zeit läuft (Bestätigung durch Dauer).
            self._hold_expired(entity_id, state, entry, now)
            return entry.level
        entry.stamp = stamp
        self._process(entity_id, state, entry, value, now)
        return entry.level

    def _process(self, entity_id: str, state: Any, entry: _Entry, value: float, now: float) -> None:
        if suspicious(entry.level, value, now - entry.at):
            if entry.pending is not None and abs(value - entry.pending) <= CONSISTENT:
                entry.seen += 1
                if now - entry.since >= CONFIRM_SECONDS:
                    self._accept(entity_id, state, entry, value, now, "second")
                    return
            else:
                entry.pending, entry.since, entry.seen = value, now, 1
                activity.record(
                    self.hass, "info", "battery", "bat_spike_held", _name(state),
                    level=round(value), prev=round(entry.level), minutes=max(1, round((now - entry.at) / 60)),
                )
            return
        if entry.pending is not None and value >= entry.level - RECOVER:
            activity.record(self.hass, "info", "battery", "bat_spike_ignored", _name(state), level=round(entry.pending), now_level=round(value))
            entry.ignored = [*entry.ignored[-19:], now]
        entry.pending, entry.seen = None, 0
        entry.level, entry.at = value, now

    def ignored(self, entity_id: str, now: float | None = None, seconds: float = 7 * 86400) -> int:
        """Wie viele Messfehler des Sensors wurden in den letzten seconds Sekunden verworfen (Wiederanlauf: nur seit dem Start)?"""
        now = now if now is not None else time.time()
        entry = self._entries.get(entity_id)
        return sum(1 for at in entry.ignored if now - at <= seconds) if entry else 0

    def _hold_expired(self, entity_id: str, state: Any, entry: _Entry, now: float) -> None:
        if entry.pending is not None and now - entry.since >= HOLD_SECONDS:
            self._accept(entity_id, state, entry, entry.pending, now, "duration")

    def _accept(self, entity_id: str, state: Any, entry: _Entry, value: float, now: float, how: str) -> None:
        activity.record(self.hass, "info", "battery", f"bat_drop_confirmed_{how}", _name(state), level=round(value), prev=round(entry.level))
        entry.level, entry.at = value, now
        entry.pending, entry.seen = None, 0


def _name(state: Any) -> str:
    return getattr(state, "name", "") or getattr(state, "entity_id", "")


def get(hass: HomeAssistant) -> BatteryGuard:
    guard = hass.data.get(DATA_GUARD)
    if guard is None:
        guard = hass.data[DATA_GUARD] = BatteryGuard(hass)
    return guard


def despike(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """
    Dieselbe Regel für einen Verlauf (Zeit, Wert): Ein verdächtiger Abfall, auf den der Stand innerhalb einer Stunde zurückkehrt, ist ein
    Ausreisser und fällt weg. Ein Abfall ohne Rückkehr bleibt. Für das Fenster "Batterie", die Prognose und die KI.
    """
    out: list[tuple[float, float]] = []
    i, n = 0, len(points)
    while i < n:
        t, v = points[i]
        if out and suspicious(out[-1][1], v, t - out[-1][0]):
            base = out[-1][1]
            k = i
            while k < n and points[k][0] - t <= 3600 and points[k][1] < base - RECOVER:
                k += 1
            if k < n and points[k][0] - t <= 3600:
                i = k  # Rückkehr gefunden: die Zwischenwerte fallen weg
                continue
        out.append((t, v))
        i += 1
    return out
