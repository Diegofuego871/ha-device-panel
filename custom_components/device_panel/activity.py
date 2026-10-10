"""
Protokoll der Integration (seit 1.38.0, Knopf "Protokoll" im Panel): zeigt, was die Meldungen
entscheiden und warum etwas nicht kam ("Lademeldung aus", "kein Push-Ziel", "stumm" …). Die
Einträge liegen nur im Arbeitsspeicher (Ringspeicher, die letzten MAX_ENTRIES) und gehen beim
Neustart verloren: Das Protokoll dient der Fehlersuche, nicht der Aufbewahrung. Debug-Einträge
(Zwischenstände wie jeder neue Batteriestand) werden nur aufgezeichnet, solange der Schalter im
Protokoll-Fenster an ist. Zusätzlich gehen die Einträge ans Python-Protokoll von Home Assistant
(Warnungen und Fehler sind dort ohnehin sichtbar).

Texte stehen in der Sprache der Instanz wie die Push-Meldungen (DE und EN mit denselben
Schlüsseln, tests/test_translations.py prüft das). Namen von Geräten und Push-Zielen kommen
unverändert; Zugangsdaten gibt es hier nie.
"""

from __future__ import annotations

import logging
import time
from collections import deque
from typing import Any

from homeassistant.core import HomeAssistant

from .const import DATA_ACTIVITY

_LOGGER = logging.getLogger(__name__)

MAX_ENTRIES = 500
LEVELS = ("debug", "info", "warning", "error")
CATEGORIES = ("charge", "outage", "battery", "new", "updates", "push", "system")

_PY_LEVEL = {"debug": logging.DEBUG, "info": logging.INFO, "warning": logging.WARNING, "error": logging.ERROR}

# Platzhalter mit str.format. Der Schlüssel "<code>" ist der Text, "<code>_d" die Detailzeile (optional).
TEXTS: dict[str, dict[str, str]] = {
    "de": {
        "sys_start": "gestartet (Version {version})",
        "charge_watch": "{count} Geräte mit Batterie werden beobachtet",
        "charge_level": "Stand {level} %, Tiefpunkt {low} %, Voll ab {full} %, Anstieg {rise} Punkte",
        "charge_started": "lädt: Stand {level} % von {low} % (Anstieg {rise} Punkte erreicht)",
        "charge_full_sent": "voll geladen bei {level} % (Voll ab {full} %), Meldung wird gesendet",
        "charge_full_sent_d": "{how}",
        "charge_full_off": "voll geladen bei {level} % (Voll ab {full} %), aber die Lademeldung ist für dieses Gerät aus: keine Meldung",
        "charge_no_target": "voll geladen bei {level} %, aber kein Push-Ziel gewählt: Meldung verworfen",
        "charge_no_target_d": "Einstellungen › Push-Benachrichtigung",
        "charge_how_rise": "Ladung beobachtet: von {start} % in {duration}",
        "charge_how_jump": "Sprung von {start} % auf voll (Ersatzregel für selten meldende Geräte)",
        "outage_sent": "ausgefallen seit {time}: Meldung wird gesendet",
        "outage_off": "ausgefallen seit {time}: Ausfall-Meldungen sind aus",
        "outage_device_off": "ausgefallen seit {time}: keine Meldung (für das Gerät aus, stumm oder Integration ausgenommen)",
        "outage_no_target": "ausgefallen seit {time}: kein Push-Ziel gewählt, keine Meldung",
        "online_sent": "wieder online nach {duration}: Meldung wird gesendet",
        "online_off": "wieder online nach {duration}: Online-Meldungen sind aus",
        "online_device_off": "wieder online nach {duration}: keine Meldung (für das Gerät aus, stumm oder Integration ausgenommen)",
        "online_no_target": "wieder online nach {duration}: kein Push-Ziel gewählt, keine Meldung",
        "battery_new": "Batterie {level} unter der Schwelle: neu schwach",
        "battery_push_off": "Batterie-Push ist aus: keine Meldung",
        "battery_daily": "Meldung kommt mit der Tagesmeldung",
        "battery_integ_off": "Push für diese Integration aus: keine Meldung",
        "battery_no_target": "kein Push-Ziel gewählt: keine Meldung",
        "new_found": "neues Gerät erkannt",
        "new_no_target": "neues Gerät erkannt: kein Push-Ziel gewählt, keine Meldung",
        "updates_sent": "{count} Updates verfügbar, Erinnerung wird gesendet",
        "updates_no_target": "{count} Updates verfügbar, aber kein Push-Ziel gewählt: keine Erinnerung",
        "push_sent": "gesendet: {title}",
        "push_extra": "Ziel lehnt die Zusatzdaten ab, Versuch ohne",
        "push_failed": "Senden fehlgeschlagen: {title}",
        "push_failed_d": "Einzelheiten im Home-Assistant-Protokoll",
        "push_missing": "Push-Ziel existiert nicht, Meldung verworfen: {title}",
        "push_invalid": "ungültiges Push-Ziel, erwartet wird notify.<name>: Meldung verworfen",
    },
    "en": {
        "sys_start": "started (version {version})",
        "charge_watch": "watching {count} devices with a battery",
        "charge_level": "level {level} %, low point {low} %, full from {full} %, rise {rise} points",
        "charge_started": "charging: level {level} % from {low} % (rise of {rise} points reached)",
        "charge_full_sent": "fully charged at {level} % (full from {full} %), sending the notification",
        "charge_full_sent_d": "{how}",
        "charge_full_off": "fully charged at {level} % (full from {full} %), but the charging notification is off for this device: no notification",
        "charge_no_target": "fully charged at {level} %, but no push target chosen: notification dropped",
        "charge_no_target_d": "Settings › Push notification",
        "charge_how_rise": "charging observed: from {start} % in {duration}",
        "charge_how_jump": "jump from {start} % to full (fallback rule for devices that report rarely)",
        "outage_sent": "offline since {time}: sending the notification",
        "outage_off": "offline since {time}: outage notifications are off",
        "outage_device_off": "offline since {time}: no notification (off for the device, muted or integration excluded)",
        "outage_no_target": "offline since {time}: no push target chosen, no notification",
        "online_sent": "back online after {duration}: sending the notification",
        "online_off": "back online after {duration}: online notifications are off",
        "online_device_off": "back online after {duration}: no notification (off for the device, muted or integration excluded)",
        "online_no_target": "back online after {duration}: no push target chosen, no notification",
        "battery_new": "battery {level} below the threshold: newly low",
        "battery_push_off": "battery push is off: no notification",
        "battery_daily": "notification comes with the daily message",
        "battery_integ_off": "push for this integration is off: no notification",
        "battery_no_target": "no push target chosen: no notification",
        "new_found": "new device found",
        "new_no_target": "new device found: no push target chosen, no notification",
        "updates_sent": "{count} updates available, sending the reminder",
        "updates_no_target": "{count} updates available, but no push target chosen: no reminder",
        "push_sent": "sent: {title}",
        "push_extra": "target rejects the extra data, trying without",
        "push_failed": "sending failed: {title}",
        "push_failed_d": "details in the Home Assistant log",
        "push_missing": "push target does not exist, notification dropped: {title}",
        "push_invalid": "invalid push target, expected notify.<name>: notification dropped",
    },
}


class ActivityLog:
    """Ringspeicher der Einträge; ein Eintrag ist ein Dict (siehe entry())."""

    def __init__(self) -> None:
        self.entries: deque[dict[str, Any]] = deque(maxlen=MAX_ENTRIES)
        self.debug = False
        self.since = time.time()


def get(hass: HomeAssistant) -> ActivityLog:
    log = hass.data.get(DATA_ACTIVITY)
    if log is None:
        log = hass.data[DATA_ACTIVITY] = ActivityLog()
    return log


def record(hass: HomeAssistant, severity: str, cat: str, code: str, name: str = "", device_id: str | None = None, **args: Any) -> None:
    """
    Eintrag aufnehmen. severity debug nur bei eingeschaltetem Schalter, die übrigen immer. name ist der Name
    des Geräts oder Push-Ziels (fett im Fenster; die Parameter heissen name und severity, weil Texte eigene title und level brauchen), code wählt Text (und Detail "<code>_d") aus TEXTS.
    """
    from .push import language  # noqa: PLC0415 (push meldet seinerseits hierher)

    log = get(hass)
    if severity == "debug" and not log.debug:
        return
    texts = TEXTS[language(hass)]
    text = texts[code].format(**args)
    detail = texts.get(f"{code}_d")
    entry = {
        "at": time.time(),
        "level": severity,
        "cat": cat,
        "title": name,
        "text": text,
        "detail": detail.format(**args) if detail else "",
        "device_id": device_id,
    }
    log.entries.append(entry)
    _LOGGER.log(_PY_LEVEL[severity], "%s: %s%s", name or cat, text, f" ({entry['detail']})" if entry["detail"] else "")


def text(hass: HomeAssistant, code: str, **args: Any) -> str:
    """Textbaustein aus TEXTS (für Teile eines Eintrags), in der Sprache der Instanz."""
    from .push import language  # noqa: PLC0415

    return TEXTS[language(hass)][code].format(**args)


def snapshot(hass: HomeAssistant) -> dict[str, Any]:
    """Für das Panel: alle Einträge (neueste zuletzt), Schalter, Beginn."""
    log = get(hass)
    return {"entries": list(log.entries), "debug": log.debug, "since": log.since, "max": MAX_ENTRIES}


def set_debug(hass: HomeAssistant, on: bool) -> None:
    get(hass).debug = bool(on)


def clear(hass: HomeAssistant) -> None:
    get(hass).entries.clear()
