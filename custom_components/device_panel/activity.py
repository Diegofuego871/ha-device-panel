"""
Protokoll der Integration (seit 1.38.0, Knopf "Protokoll" im Panel): zeigt, was die Meldungen
entscheiden und warum etwas nicht kam ("Lademeldung aus", "kein Push-Ziel", "stumm" …). Die
Einträge liegen in einem Ringspeicher (die letzten MAX_ENTRIES). Seit 2.47.0 bleiben sie über
Neustarts von Home Assistant erhalten (Wunsch des Nutzers: Debug-Einträge sollen einen Neustart
überstehen, sonst fehlt genau der Verlauf davor); sie liegen mit dem Debug-Schalter in einer
kleinen Datei, verzögert geschrieben. Debug-Einträge
(Zwischenstände wie jeder neue Batteriestand) werden nur aufgezeichnet, solange der Schalter im
Protokoll-Fenster an ist. Der Schalter bleibt seit 2.32.0 über Neustarts von Home Assistant
erhalten, aber nur DEBUG_HOURS Stunden lang (Wunsch des Nutzers): Er merkt sich sein Ablaufdatum
und schaltet sich dann von selbst aus. Zusätzlich gehen die Einträge ans Python-Protokoll von Home Assistant
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

from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import DATA_ACTIVITY, DOMAIN, STORAGE_VERSION

_LOGGER = logging.getLogger(__name__)

MAX_ENTRIES = 500
# So lange bleibt der Debug-Schalter an (auch über Neustarts), danach schaltet er sich aus.
DEBUG_HOURS = 48
STORE_KEY = f"{DOMAIN}.debug"
# Verzögerung des Schreibens: Fasst viele Einträge zu einem Schreibvorgang zusammen (HA schreibt beim Beenden ohnehin).
SAVE_DELAY = 30
LEVELS = ("debug", "info", "warning", "error")
CATEGORIES = ("charge", "outage", "battery", "new", "updates", "magic", "routine", "push", "system")

_PY_LEVEL = {"debug": logging.DEBUG, "info": logging.INFO, "warning": logging.WARNING, "error": logging.ERROR}

# Platzhalter mit str.format. Der Schlüssel "<code>" ist der Text, "<code>_d" die Detailzeile (optional).
TEXTS: dict[str, dict[str, str]] = {
    "de": {
        "sys_start": "gestartet (Version {version})",
        "debug_restored": "Debug-Modus nach dem Start wieder eingeschaltet",
        "debug_restored_d": "läuft noch bis {until}",
        "debug_expired": "Debug-Modus nach {hours} Stunden ausgeschaltet",
        "auto_update_done": "Version {version} automatisch installiert, Home Assistant muss neu gestartet werden",
        "auto_update_failed": "Version {version} konnte nicht automatisch installiert werden: {error}",
        "auto_update_failed_d": "Neuer Versuch bei der nächsten Prüfung",
        "auto_update_wait": "HACS kennt noch keine neuere Version als {running} (HACS: {hacs}), es wird erneut versucht",
        "magic_fired": "ausgelöst, Meldung wird gesendet: {title}",
        "magic_repeat": "Wert bleibt so, Meldung wird wiederholt: {title}",
        "magic_recovered": "wieder normal, Meldung wird gesendet: {title}",
        "magic_test": "Test: Meldung wird gesendet",
        "routine_run": "geschaltet: {entity} ({action})",
        "routine_run_manual": "von Hand ausgeführt: {entity} ({action})",
        "routine_run_scene": "Szene aktiviert: {entity}",
        "status_down": "Steht: seit {minutes} Min. kein Lebenszeichen",
        "status_up": "Läuft wieder",
        "status_restart": "Von Hand neu gestartet",
        "status_restart_failed": "Neustart von Hand fehlgeschlagen: {error}",
        "routine_run_scene_manual": "von Hand ausgeführt: Szene {entity} aktiviert",
        "routine_revert": "zurückgeschaltet: {entity} ({action})",
        "routine_skip_window": "Auslöser übergangen: ausserhalb des Zeitfensters",
        "routine_skip_pause": "Auslöser übergangen: Mindestpause noch nicht um",
        "routine_skip_busy": "Auslöser übergangen: die Routine wartet noch auf das Zurückschalten",
        "routine_retry": "{entity} nicht erreichbar, neuer Versuch in {minutes} Min. ({count} von {max})",
        "routine_failed": "{entity} konnte nicht geschaltet werden",
        "routine_failed_d": "Einzelheiten im Home-Assistant-Protokoll",
        "routine_missed": "verpasst (Home Assistant lief nicht, {minutes} Min. zu spät): übersprungen",
        "routine_paused": "übersprungen: alle Routinen sind pausiert",
        "routine_no_target": "Meldung gewünscht, aber kein Push-Ziel gewählt: keine Meldung",
        "routine_no_target_d": "Einstellungen › Überwachung und Meldungen › Übersicht, oder bei der Routine einen Empfänger wählen",
        "routine_test": "Test: Meldung wird gesendet",
        # Debug (seit 2.29.0): Zwischenstände, nur bei eingeschaltetem Schalter
        "outage_seen": "als ausgefallen erkannt, Meldung nach {minutes} Min., falls es dann noch ausgefallen ist",
        "outage_resumed": "ausgefallen seit {time} (begann vor einer Lücke): wird nicht erneut gemeldet",
        "outage_back_notified": "wieder erreichbar nach {duration}: die Rückkehr wird gemeldet (falls eingeschaltet)",
        "outage_back_silent": "wieder erreichbar nach {duration}: der Ausfall war nicht gemeldet, keine Rückkehr-Meldung",
        "outage_gone": "wird nicht mehr überwacht (entfernt oder ausgenommen): vergessen",
        "battery_check": "{devices} Geräte mit Batterie geprüft: {low} schwach, davon {new} neu",
        "routine_armed": "nächster Lauf {when}",
        "routine_armed_revert": "Zurückschalten geplant für {when}",
        "options_saved": "Einstellungen gespeichert: {keys}",
        "device_settings_saved": "Geräteeinstellung gespeichert: {keys}",
        "device_type_saved": "Gerätetyp von Hand gesetzt: {value}",
        "sys_stop": "entladen (Neuladen, Entfernen der Integration oder Beenden von Home Assistant)",
        "magic_no_target": "ausgelöst, aber kein Push-Ziel gewählt: keine Meldung",
        "magic_no_target_d": "Einstellungen › Überwachung und Meldungen › Übersicht, oder bei der Meldung ein Ziel wählen",
        "bat_spike_held": "Batterie {level} % nach {prev} % vor {minutes} Min.: unglaubwürdig schneller Abfall, bis zur Bestätigung gilt weiter {prev} %",
        "bat_spike_ignored": "Batterie {level} % verworfen (Messfehler): der Stand ist wieder bei {now_level} %",
        "bat_drop_confirmed_second": "Batterie {level} % bestätigt (eine weitere Meldung passt dazu), vorher {prev} %",
        "bat_drop_confirmed_duration": "Batterie {level} % bestätigt (seit über 30 Min. unverändert), vorher {prev} %",
        "ai_failed": "KI-Einschätzung fehlgeschlagen ({reason}): {detail}",
        "ai_failed_d": "Prompt {chars} Zeichen, KI-Aufgabe {task}",
        "ai_done": "KI-Einschätzung erstellt: Prompt {chars} Zeichen, Antwort {answer} Zeichen, {seconds} s",
        "ai_ask_done": "KI-Rückfrage beantwortet (\"{question}\"): Prompt {chars} Zeichen, Antwort {answer} Zeichen, {seconds} s",
        "ai_empty_retry": "KI-Aufgabe lieferte eine leere Antwort: zweiter Versuch",
        "ai_retry": "KI-Aufgabe vorübergehend nicht erreichbar, neuer Versuch in {seconds} s ({attempt} von {max}): {detail}",
        "ai_trimmed": "Fakten für die KI gekürzt (über {limit} Zeichen): {parts}",
        "charge_watch": "{count} Geräte mit Batterie werden beobachtet",
        "charge_level": "Stand {level} %, Tiefpunkt {low} %, Voll ab {full} %, Anstieg {rise} Punkte",
        "charge_started": "lädt: Stand {level} % von {low} % (Anstieg {rise} Punkte erreicht)",
        "charge_full_sent": "voll geladen bei {level} % (Voll ab {full} %), Meldung wird gesendet",
        "charge_full_sent_d": "{how}",
        "charge_full_off": "voll geladen bei {level} % (Voll ab {full} %), aber die Lademeldung ist für dieses Gerät aus: keine Meldung",
        "charge_no_target": "voll geladen bei {level} %, aber kein Push-Ziel gewählt: Meldung verworfen",
        "charge_stopped_sent": "Ladung beendet bei {level} % (Voll ab {full} %): Stand seit {minutes} Min. unverändert, Meldung wird gesendet",
        "charge_stopped_push_off": "Ladung beendet bei {level} % (Voll ab {full} %): Stand seit {minutes} Min. unverändert, der Push bei beendeter Ladung ist aus: keine Meldung",
        "charge_stopped_no_target": "Ladung beendet bei {level} % (Voll ab {full} %): Stand seit {minutes} Min. unverändert, kein Push-Ziel gewählt: keine Meldung",
        "charge_no_target_d": "Einstellungen › Push-Benachrichtigung",
        "charge_live_start": "Live-Aktivität gestartet bei {level} % (Ziel {full} %)",
        "charge_live_eta": "Ladeschätzung: {rate} Punkte pro Minute über {minutes} Min., Stand {level} % von {full} %, fertig gegen {time}",
        "charge_live_done": "Ziel {full} % erreicht: Live-Aktivität zeigt \"Geladen\" und endet in {minutes} Min.",
        "charge_live_end": "Live-Aktivität beendet: {reason}",
        "charge_live_dismissed": "Live-Aktivität weggewischt: für diese Ladung keine Updates mehr an {target}",
        "charge_live_no_target": "lädt bei {level} %, aber kein Push-Ziel gewählt: keine Live-Aktivität",
        "charge_live_unsupported": "Live-Aktivität nicht möglich: {target} ist kein notify-Dienst (Entitäten kennen nur Titel und Text)",
        "charge_live_failed": "Live-Aktivität an {target} fehlgeschlagen",
        "charge_live_why_stopped": "die Ladung ist beendet",
        "charge_live_why_off": "für das Gerät ausgeschaltet",
        "charge_live_why_done": "\"Geladen\" lange genug angezeigt",
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
        "debug_restored": "debug mode switched on again after the start",
        "debug_restored_d": "runs until {until}",
        "debug_expired": "debug mode switched off after {hours} hours",
        "auto_update_done": "version {version} installed automatically, Home Assistant must be restarted",
        "auto_update_failed": "version {version} could not be installed automatically: {error}",
        "auto_update_failed_d": "trying again at the next check",
        "auto_update_wait": "HACS does not know a version newer than {running} yet (HACS: {hacs}), will try again",
        "magic_fired": "triggered, sending the notification: {title}",
        "magic_repeat": "value stays the same, repeating the notification: {title}",
        "magic_recovered": "back to normal, sending the notification: {title}",
        "magic_test": "test: sending the notification",
        "routine_run": "switched: {entity} ({action})",
        "routine_run_manual": "run by hand: {entity} ({action})",
        "routine_run_scene": "scene activated: {entity}",
        "status_down": "Down: no sign of life for {minutes} min",
        "status_up": "Running again",
        "status_restart": "Restarted by hand",
        "status_restart_failed": "Restart by hand failed: {error}",
        "routine_run_scene_manual": "run by hand: scene {entity} activated",
        "routine_revert": "switched back: {entity} ({action})",
        "routine_skip_window": "trigger skipped: outside the time window",
        "routine_skip_pause": "trigger skipped: minimum pause not over yet",
        "routine_skip_busy": "trigger skipped: the routine is still waiting to switch back",
        "routine_retry": "{entity} not reachable, trying again in {minutes} min ({count} of {max})",
        "routine_failed": "{entity} could not be switched",
        "routine_failed_d": "details in the Home Assistant log",
        "routine_missed": "missed (Home Assistant was not running, {minutes} min late): skipped",
        "routine_paused": "skipped: all routines are paused",
        "routine_no_target": "notification wanted, but no push target chosen: no notification",
        "routine_no_target_d": "Settings › Monitoring and notifications › Overview, or choose a recipient in the routine",
        "routine_test": "test: sending the notification",
        # Debug (since 2.29.0): intermediate steps, only while the switch is on
        "outage_seen": "detected as offline, notification after {minutes} min if it is still offline then",
        "outage_resumed": "offline since {time} (began before a gap): not reported again",
        "outage_back_notified": "reachable again after {duration}: the return is reported (if switched on)",
        "outage_back_silent": "reachable again after {duration}: the outage was not reported, no return notification",
        "outage_gone": "no longer monitored (removed or excluded): forgotten",
        "battery_check": "{devices} devices with a battery checked: {low} low, {new} of them new",
        "routine_armed": "next run {when}",
        "routine_armed_revert": "switching back planned for {when}",
        "options_saved": "settings saved: {keys}",
        "device_settings_saved": "device setting saved: {keys}",
        "device_type_saved": "device type set by hand: {value}",
        "sys_stop": "unloaded (reload, removal of the integration or Home Assistant shutting down)",
        "magic_no_target": "triggered, but no push target chosen: no notification",
        "magic_no_target_d": "Settings › Monitoring and notifications › Overview, or choose a target in the notification",
        "bat_spike_held": "battery {level} % after {prev} % {minutes} min ago: implausibly fast drop, {prev} % stays valid until confirmed",
        "bat_spike_ignored": "battery {level} % discarded (measurement error): the level is back at {now_level} %",
        "bat_drop_confirmed_second": "battery {level} % confirmed (another report matches), before {prev} %",
        "bat_drop_confirmed_duration": "battery {level} % confirmed (unchanged for over 30 min), before {prev} %",
        "ai_failed": "AI assessment failed ({reason}): {detail}",
        "ai_failed_d": "prompt {chars} characters, AI task {task}",
        "ai_done": "AI assessment created: prompt {chars} characters, answer {answer} characters, {seconds} s",
        "ai_ask_done": "AI follow-up answered (\"{question}\"): prompt {chars} characters, answer {answer} characters, {seconds} s",
        "ai_empty_retry": "the AI task returned an empty answer: trying a second time",
        "ai_retry": "AI task temporarily unavailable, trying again in {seconds} s ({attempt} of {max}): {detail}",
        "ai_trimmed": "facts for the AI trimmed (over {limit} characters): {parts}",
        "charge_watch": "watching {count} devices with a battery",
        "charge_level": "level {level} %, low point {low} %, full from {full} %, rise {rise} points",
        "charge_started": "charging: level {level} % from {low} % (rise of {rise} points reached)",
        "charge_full_sent": "fully charged at {level} % (full from {full} %), sending the notification",
        "charge_full_sent_d": "{how}",
        "charge_full_off": "fully charged at {level} % (full from {full} %), but the charging notification is off for this device: no notification",
        "charge_no_target": "fully charged at {level} %, but no push target chosen: notification dropped",
        "charge_stopped_sent": "charging stopped at {level} % (full from {full} %): level unchanged for {minutes} min, sending the notification",
        "charge_stopped_push_off": "charging stopped at {level} % (full from {full} %): level unchanged for {minutes} min, the push for a stopped charge is off: no notification",
        "charge_stopped_no_target": "charging stopped at {level} % (full from {full} %): level unchanged for {minutes} min, no push target chosen: no notification",
        "charge_no_target_d": "Settings › Push notification",
        "charge_live_start": "live activity started at {level} % (target {full} %)",
        "charge_live_eta": "charging estimate: {rate} points per minute over {minutes} min, level {level} % of {full} %, done around {time}",
        "charge_live_done": "target {full} % reached: the live activity shows \"Charged\" and ends in {minutes} min",
        "charge_live_end": "live activity ended: {reason}",
        "charge_live_dismissed": "live activity swiped away: no more updates to {target} for this charge",
        "charge_live_no_target": "charging at {level} %, but no push target chosen: no live activity",
        "charge_live_unsupported": "live activity not possible: {target} is not a notify service (entities only know title and text)",
        "charge_live_failed": "live activity to {target} failed",
        "charge_live_why_stopped": "the charge is over",
        "charge_live_why_off": "switched off for the device",
        "charge_live_why_done": "\"Charged\" has been shown long enough",
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
        # Zeitpunkt (Unix), zu dem der Debug-Schalter ausläuft; None bei ausgeschaltetem Schalter
        self.debug_until: float | None = None
        self.restored = False
        self.store: Store | None = None  # eine Instanz je Start: so fasst ein Zeitgeber alle Einträge zusammen
        self.save_pending = False
        self._expiry: CALLBACK_TYPE | None = None
        self.since = time.time()

    def cancel_expiry(self) -> None:
        if self._expiry is not None:
            self._expiry()
            self._expiry = None


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
    _save(hass)
    _LOGGER.log(_PY_LEVEL[severity], "%s: %s%s", name or cat, text, f" ({entry['detail']})" if entry["detail"] else "")


def text(hass: HomeAssistant, code: str, **args: Any) -> str:
    """Textbaustein aus TEXTS (für Teile eines Eintrags), in der Sprache der Instanz."""
    from .push import language  # noqa: PLC0415

    return TEXTS[language(hass)][code].format(**args)


def snapshot(hass: HomeAssistant) -> dict[str, Any]:
    """Für das Panel: alle Einträge (neueste zuletzt), Schalter, Beginn."""
    log = get(hass)
    return {
        "entries": list(log.entries),
        "debug": log.debug,
        "debug_until": log.debug_until if log.debug else None,
        "since": log.since,
        "max": MAX_ENTRIES,
    }


def _store(hass: HomeAssistant, log: ActivityLog) -> Store:
    if log.store is None:
        log.store = Store(hass, STORAGE_VERSION, STORE_KEY)
    return log.store


def _save(hass: HomeAssistant) -> None:
    """
    Ablaufdatum des Schalters und Einträge merken (verzögert, auch beim Beenden von HA geschrieben). Ein bereits
    angesetztes Schreiben wird nicht neu gestartet, sonst käme ein stetiger Strom von Einträgen nie zum Schreiben.
    """
    log = get(hass)
    if log.save_pending:
        return
    log.save_pending = True

    def data() -> dict[str, Any]:
        log.save_pending = False
        return {"debug_until": log.debug_until if log.debug else None, "entries": list(log.entries)}

    _store(hass, log).async_delay_save(data, SAVE_DELAY)


def _arm(hass: HomeAssistant, log: ActivityLog) -> None:
    """Zeitgeber setzen, der den Schalter zum Ablaufdatum ausschaltet."""
    log.cancel_expiry()
    if not log.debug or log.debug_until is None:
        return

    @callback
    def expire(now: Any) -> None:
        log._expiry = None  # noqa: SLF001 (gehört demselben Modul)
        # Zeit des Zeitgebers statt der Uhr: so gilt, was HA als Zeitpunkt des Auslösens meldet (auch in Tests)
        if log.debug and log.debug_until is not None and now.timestamp() >= log.debug_until - 1:
            log.debug = False
            log.debug_until = None
            record(hass, "info", "system", "debug_expired", "Device Panel", hours=DEBUG_HOURS)
            _save(hass)

    log._expiry = async_call_later(hass, max(1.0, log.debug_until - time.time()), expire)  # noqa: SLF001


def set_debug(hass: HomeAssistant, on: bool) -> None:
    """Schalter setzen: an für DEBUG_HOURS Stunden (neu gezählt ab jetzt), aus sofort."""
    log = get(hass)
    log.debug = bool(on)
    log.debug_until = time.time() + DEBUG_HOURS * 3600 if log.debug else None
    _arm(hass, log)
    _save(hass)


async def async_restore(hass: HomeAssistant) -> None:
    """Beim Start: einen noch nicht abgelaufenen Debug-Schalter wieder einschalten (nur einmal je Start von HA)."""
    log = get(hass)
    if log.restored:
        return
    log.restored = True
    data = await _store(hass, log).async_load() or {}
    _restore_entries(log, data.get("entries"))
    until = data.get("debug_until")
    if isinstance(until, (int, float)) and until > time.time():
        log.debug = True
        log.debug_until = float(until)
        _arm(hass, log)
        stamp = dt_util.as_local(dt_util.utc_from_timestamp(until)).strftime("%d.%m. %H:%M")
        record(hass, "info", "system", "debug_restored", "Device Panel", until=stamp)


def _restore_entries(log: ActivityLog, stored: Any) -> None:
    """Gemerkte Einträge vor die seit dem Start aufgezeichneten setzen (höchstens MAX_ENTRIES, die neuesten)."""
    if not isinstance(stored, list):
        return
    keys = {"at", "level", "cat", "title", "text", "detail", "device_id"}
    old = [
        {k: e.get(k, None if k == "device_id" else "") for k in keys}
        for e in stored
        if isinstance(e, dict) and isinstance(e.get("at"), (int, float)) and e.get("level") in LEVELS and isinstance(e.get("text"), str)
    ]
    if not old:
        return
    merged = sorted([*old, *log.entries], key=lambda e: e["at"])[-MAX_ENTRIES:]
    log.entries.clear()
    log.entries.extend(merged)
    # "Seit" nennt den Beginn des Verlaufs, nicht den letzten Start
    log.since = min(log.since, merged[0]["at"])


async def async_forget(hass: HomeAssistant) -> None:
    """Integration entfernt: Zeitgeber stoppen, gemerkten Schalter und Einträge löschen."""
    log = get(hass)
    log.cancel_expiry()
    await _store(hass, log).async_remove()


def clear(hass: HomeAssistant) -> None:
    get(hass).entries.clear()
    _save(hass)
