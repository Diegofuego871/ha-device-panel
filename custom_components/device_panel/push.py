"""
Meldungen nach aussen: Push über notify und Texte in der Sprache der
Instanz (wie unifi_dynamic, notification.py und msg.py).
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError

from . import activity
from .options_api import emoji_for
from .const import CLICK_DEVICE, DATA_PUSH_IMAGE, DATA_PUSHLOG, DATA_QUIET, MUTE_ACTION_PREFIX, NOTIFY_NONE, PANEL_URL_PATH

_LOGGER = logging.getLogger(__name__)

# Fehler, mit denen ein Ziel die Zusatzdaten ablehnt (Prüfung der Eingabe); alles andere (Netz, Zeitüberschreitung) ist vorübergehend
_REJECTED = (vol.Invalid, ValueError, TypeError, ServiceValidationError)
# Pause vor dem zweiten Versuch mit denselben Zusatzdaten nach einem vorübergehenden Fehler
RETRY_DELAY_S = 2.0

# Texte der Meldungen. Platzhalter mit str.format; DE und EN mit denselben
# Schlüsseln (tests/test_translations.py prüft das).
TEXTS: dict[str, dict[str, str]] = {
    "de": {
        "battery_title": "Batterie schwach: {name}",
        "battery_title_many": "Batterie schwach: {count} Geräte",
        "battery_low": "schwach",
        "persistent_title": "🪫 Device Panel: Batterie schwach",
        "persistent_intro": "Diese Geräte haben eine schwache Batterie (bis {threshold} %):",
        "persistent_intro_own": "Diese Geräte haben eine schwache Batterie (Schwelle je nach Integration oder Gerät):",
        "persistent_outro": "Die Meldung verschwindet von selbst, wenn alle wieder über der Schwelle sind. Einstellen im Device Panel unter Einstellungen → Batterie.",
        "notify_none": "Keine Push-Meldungen",
        "notify_entity": "{entity_id} (Entität)",
        "notify_missing": "{value} (nicht gefunden)",
        "outage_title": "Ausgefallen: {name}",
        "outage_title_many": "Sammelausfall: {count} Geräte",
        "outage_since": "seit {time}",
        "outage_cause": "vermutlich {integration}",
        "outage_title_integ": "{integration}: {count} Geräte ausgefallen",
        "online_title_integ": "{integration}: {count} Geräte wieder online",
        "group_more": "und {count} weitere",
        "quiet_title": "🌙 Ruhezeit vorbei: {counts}",
        "quiet_outage": "Ausfälle",
        "quiet_online": "Wieder online",
        "quiet_open": "Noch offen",
        "quiet_short": "War kurz weg",
        "quiet_back": "Wieder online",
        "quiet_battery": "Batterie",
        "quiet_charge": "Laden",
        "quiet_new": "Neue Geräte",
        "quiet_updates": "Updates",
        "quiet_panelupdate": "Panel-Update",
        "quiet_routines": "Routinen",
        "quiet_status": "Status",
        "quiet_magic": "Magic Push",
        "online_title": "Wieder online: {name}",
        "online_title_many": "Wieder online: {count} Geräte",
        "online_after": "nach {duration}",
        "dur_days": "{d} T. {h} Std.",
        "dur_hours": "{h} Std. {m} Min.",
        "dur_minutes": "{m} Min.",
        "dur_short": "< 1 Min.",
        "magic_since": "seit {duration}",
        "magic_after": "nach {duration}",
        "magic_and": "und",
        "magic_or": "oder",
        "magic_above": "über {value}",
        "magic_below": "unter {value}",
        "magic_is": "ist {value}",
        "panelupdate_found_title": "⬆️ Device Panel {latest} verfügbar",
        "panelupdate_found_text": "Installiert ist {installed}. Aktualisieren unter Einstellungen im Panel oder in HACS.",
        "panelupdate_done_title": "✅ Device Panel {latest} installiert",
        "panelupdate_done_text": "Home Assistant muss noch neu gestartet werden, damit die neue Version läuft.",
        "routine_title": "⚡ Routine: {name}",
        "routine_text": "{entity} ist jetzt {result} · {time}",
        "routine_text_toggled": "{entity} wurde umgeschaltet · {time}",
        "routine_text_restored": "{entity} ist wieder wie vorher · {time}",
        "routine_text_set": "{entity} auf {value} gesetzt · {time}",
        "routine_res_set": "auf {value}",
        "wizard_test_title": "✅ Device Panel: Testmeldung",
        "wizard_test_text": "Diese Meldung kommt an. Das Panel meldet jetzt an dieses Ziel.",
        "status_down_title": "⚠️ Device Panel: {part} steht",
        "status_down_text": "Seit {minutes} Min. kein Lebenszeichen · {time}",
        "status_up_title": "✅ Device Panel: {part} läuft wieder",
        "status_up_text": "Wieder im Takt · {time}",
        "status_load_title": "⚠️ Device Panel: {what} bei {value} %",
        "status_load_text": "Seit {minutes} Min. über der Grenze von {limit} % · {time}",
        "status_load_ok_title": "✅ Device Panel: {what} wieder unter {limit} %",
        "status_load_ok_text": "Jetzt {value} % · {time}",
        "status_what_cpu": "Prozessor",
        "status_what_ram": "Arbeitsspeicher",
        "status_what_disk": "Festplatte",
        "status_part_routines": "Routinen",
        "status_part_magic": "Magic Push",
        "status_part_availability": "Ausfall-Überwachung",
        "status_part_battery": "Batterie",
        "status_part_charge": "Laden",
        "status_part_new": "Neue Geräte",
        "status_part_updates": "Updates",
        "status_part_signal": "Empfangsverlauf",
        "routine_text_activated": "Szene {entity} aktiviert · {time}",
        "routine_res_restored": "wie vorher",
        "routine_res_activated": "aktiviert",
        "routine_res_on": "ein",
        "routine_res_off": "aus",
        "routine_res_toggled": "umgeschaltet",
        "routine_res_open": "offen",
        "routine_res_closed": "geschlossen",
        "routine_res_locked": "abgeschlossen",
        "routine_res_unlocked": "aufgeschlossen",
        "routine_fail_title": "⚠️ Routine fehlgeschlagen: {name}",
        "routine_fail_text": "{entity} konnte nicht geschaltet werden: {reason} · {time}",
        "routine_reason_unavailable": "nicht erreichbar",
        "routine_reason_missing": "Entität nicht gefunden",
        "routine_reason_error": "Fehler beim Schalten",
        "routine_reason_timeout": "keine Antwort des Geräts",
        "action_open": "Öffnen",
        "action_mute": "24 Std. stumm",
        "field_battery": "Batterie {level}",
        "field_signal": "Empfang zuletzt {value}",
        "conn_zigbee": "Zigbee",
        "conn_thread": "Thread",
        "conn_zwave": "Z-Wave",
        "conn_matter": "Matter",
        "conn_ble": "Bluetooth",
        "conn_wifi": "WLAN",
        "conn_ethernet": "LAN",
        "conn_network": "Netzwerk",
        "conn_cloud": "Cloud",
        "conn_unknown": "Unbekannt",
        "new_title": "Neues Gerät: {name}",
        "new_title_many": "{count} neue Geräte",
        "new_found": "neu gefunden",
        "charge_title": "Geladen: {name}",
        "charge_from": "in {duration} von {start} %",
        "charge_jump": "von {start} %",
        "charge_stop_title": "Ladung beendet: {name}",
        "charge_stalled": "Stand seit {duration} unverändert",
        "charge_live_title": "Lädt: {name}",
        "charge_live_progress": "{level} % von {full} %",
        "charge_live_progress_eta": "{eta} · {level} % von {full} %",
        "charge_live_eta": "fertig gegen {time}",
        "charge_live_eta_tomorrow": "fertig morgen gegen {time}",
        "charge_live_done_title": "Geladen: {name}",
        "charge_live_done": "Ziel {full} % erreicht",
        "update_title": "Home Assistant Update",
        "update_message": "{count} verfügbar:",
        "update_line": "{name} {installed} → {latest}",
        "new_persistent_title": "✨ Device Panel: Neue Geräte",
        "new_persistent_intro": "Diese Geräte sind neu in Home Assistant:",
        "new_persistent_outro": "Die Meldung bleibt, bis du sie wegklickst. Einstellen im Device Panel unter Einstellungen → Neu.",
        "outage_persistent_title": "🔴 Device Panel: Geräte ausgefallen",
        "outage_persistent_intro": "Diese Geräte sind gerade ausgefallen:",
        "outage_persistent_since": "seit {time}",
        "outage_persistent_outro": "Die Meldung verschwindet von selbst, wenn alle wieder online sind. Einstellen im Device Panel unter Einstellungen → Anhaltende Benachrichtigung.",
    },
    "en": {
        "battery_title": "Low battery: {name}",
        "battery_title_many": "Low battery: {count} devices",
        "battery_low": "low",
        "persistent_title": "🪫 Device Panel: low battery",
        "persistent_intro": "These devices have a low battery (up to {threshold} %):",
        "persistent_intro_own": "These devices have a low battery (threshold per integration or device):",
        "persistent_outro": "This notification disappears by itself once all of them are above the threshold again. Change it in Device Panel under Settings → Battery.",
        "notify_none": "No push notifications",
        "notify_entity": "{entity_id} (entity)",
        "notify_missing": "{value} (not found)",
        "outage_title": "Offline: {name}",
        "outage_title_many": "Group outage: {count} devices",
        "outage_since": "since {time}",
        "outage_cause": "probably {integration}",
        "outage_title_integ": "{integration}: {count} devices offline",
        "online_title_integ": "{integration}: {count} devices back online",
        "group_more": "and {count} more",
        "quiet_title": "🌙 Quiet time is over: {counts}",
        "quiet_outage": "Outages",
        "quiet_online": "Back online",
        "quiet_open": "Still open",
        "quiet_short": "Was briefly gone",
        "quiet_back": "Back online",
        "quiet_battery": "Battery",
        "quiet_charge": "Charging",
        "quiet_new": "New devices",
        "quiet_updates": "Updates",
        "quiet_panelupdate": "Panel update",
        "quiet_routines": "Routines",
        "quiet_status": "Status",
        "quiet_magic": "Magic Push",
        "online_title": "Back online: {name}",
        "online_title_many": "Back online: {count} devices",
        "online_after": "after {duration}",
        "dur_days": "{d} d {h} h",
        "dur_hours": "{h} h {m} min",
        "dur_minutes": "{m} min",
        "dur_short": "< 1 min",
        "magic_since": "for {duration}",
        "magic_after": "after {duration}",
        "magic_and": "and",
        "magic_or": "or",
        "magic_above": "above {value}",
        "magic_below": "below {value}",
        "magic_is": "is {value}",
        "panelupdate_found_title": "⬆️ Device Panel {latest} available",
        "panelupdate_found_text": "Installed is {installed}. Update in the panel settings or in HACS.",
        "panelupdate_done_title": "✅ Device Panel {latest} installed",
        "panelupdate_done_text": "Home Assistant still has to be restarted for the new version to run.",
        "routine_title": "⚡ Routine: {name}",
        "routine_text": "{entity} is now {result} · {time}",
        "routine_text_toggled": "{entity} was toggled · {time}",
        "routine_text_restored": "{entity} is back to how it was · {time}",
        "routine_text_set": "{entity} set to {value} · {time}",
        "routine_res_set": "to {value}",
        "wizard_test_title": "✅ Device Panel: test message",
        "wizard_test_text": "This message arrived. The panel now reports to this target.",
        "status_down_title": "⚠️ Device Panel: {part} is down",
        "status_down_text": "No sign of life for {minutes} min · {time}",
        "status_up_title": "✅ Device Panel: {part} is running again",
        "status_up_text": "Back on schedule · {time}",
        "status_load_title": "⚠️ Device Panel: {what} at {value} %",
        "status_load_text": "Above the limit of {limit} % for {minutes} min · {time}",
        "status_load_ok_title": "✅ Device Panel: {what} back below {limit} %",
        "status_load_ok_text": "Now {value} % · {time}",
        "status_what_cpu": "Processor",
        "status_what_ram": "Memory",
        "status_what_disk": "Disk",
        "status_part_routines": "Routines",
        "status_part_magic": "Magic Push",
        "status_part_availability": "Outage monitoring",
        "status_part_battery": "Battery",
        "status_part_charge": "Charging",
        "status_part_new": "New devices",
        "status_part_updates": "Updates",
        "status_part_signal": "Reception history",
        "routine_text_activated": "Scene {entity} activated · {time}",
        "routine_res_restored": "as before",
        "routine_res_activated": "activated",
        "routine_res_on": "on",
        "routine_res_off": "off",
        "routine_res_toggled": "toggled",
        "routine_res_open": "open",
        "routine_res_closed": "closed",
        "routine_res_locked": "locked",
        "routine_res_unlocked": "unlocked",
        "routine_fail_title": "⚠️ Routine failed: {name}",
        "routine_fail_text": "{entity} could not be switched: {reason} · {time}",
        "routine_reason_unavailable": "not reachable",
        "routine_reason_missing": "entity not found",
        "routine_reason_error": "error while switching",
        "routine_reason_timeout": "the device did not answer",
        "action_open": "Open",
        "action_mute": "Mute 24 h",
        "field_battery": "battery {level}",
        "field_signal": "last signal {value}",
        "conn_zigbee": "Zigbee",
        "conn_thread": "Thread",
        "conn_zwave": "Z-Wave",
        "conn_matter": "Matter",
        "conn_ble": "Bluetooth",
        "conn_wifi": "Wi-Fi",
        "conn_ethernet": "LAN",
        "conn_network": "Network",
        "conn_cloud": "Cloud",
        "conn_unknown": "Unknown",
        "new_title": "New device: {name}",
        "new_title_many": "{count} new devices",
        "new_found": "newly found",
        "charge_title": "Charged: {name}",
        "charge_from": "in {duration} from {start} %",
        "charge_jump": "from {start} %",
        "charge_stop_title": "Charging stopped: {name}",
        "charge_stalled": "level unchanged for {duration}",
        "charge_live_title": "Charging: {name}",
        "charge_live_progress": "{level} % of {full} %",
        "charge_live_progress_eta": "{eta} · {level} % of {full} %",
        "charge_live_eta": "done around {time}",
        "charge_live_eta_tomorrow": "done tomorrow around {time}",
        "charge_live_done_title": "Charged: {name}",
        "charge_live_done": "Target of {full} % reached",
        "update_title": "Home Assistant update",
        "update_message": "{count} available:",
        "update_line": "{name} {installed} → {latest}",
        "new_persistent_title": "✨ Device Panel: new devices",
        "new_persistent_intro": "These devices are new in Home Assistant:",
        "new_persistent_outro": "This notification stays until you dismiss it. Change it in Device Panel under Settings → New.",
        "outage_persistent_title": "🔴 Device Panel: devices offline",
        "outage_persistent_intro": "These devices are offline right now:",
        "outage_persistent_since": "since {time}",
        "outage_persistent_outro": "This notification disappears by itself once all of them are back online. Change it in Device Panel under Settings → Persistent notification.",
    },
}


def title(hass: HomeAssistant, opts: dict[str, Any], kind: str, key: str, **kwargs: Any) -> str:
    """
    Titel einer Push-Meldung: das eingestellte Emoji der Meldung (kind, siehe
    const.EMOJI_DEFAULTS), ein Leerzeichen und der Text. Ohne Emoji nur der Text.
    """
    mark = emoji_for(opts, kind)
    return f"{mark} {text(hass, key, **kwargs)}" if mark else text(hass, key, **kwargs)


def language(hass: HomeAssistant) -> str:
    """Sprache der Instanz: "de" für de und de-*, sonst "en"."""
    lang = (hass.config.language or "").strip().lower()
    return "de" if lang == "de" or lang.startswith("de-") else "en"


_MD_SPECIAL = re.compile(r"([\\`*_\[\]()<>!~|&])")


def md_text(value: Any) -> str:
    """
    Namen für Markdown-Meldungen (persistente Benachrichtigung in Home Assistant): Zeilenumbrüche werden zu Leerzeichen,
    Zeichen mit Bedeutung für Markdown bekommen einen Backslash. Sonst könnte ein Gerätename wie "x](https://…)" fremde Links
    oder Bilder in die Meldung einschleusen. Für reinen Text (Push an das Handy) nicht nötig und nicht gedacht.
    """
    return _MD_SPECIAL.sub(r"\\\1", " ".join(str(value if value is not None else "").split()))


def text(hass: HomeAssistant, key: str, **kwargs: Any) -> str:
    return TEXTS[language(hass)][key].format(**kwargs)


def duration(hass: HomeAssistant, seconds: float) -> str:
    """Dauer grob wie im Panel: "2 Std. 14 Min.", "3 T. 4 Std."."""
    minutes = int(seconds // 60)
    if minutes < 1:
        return text(hass, "dur_short")
    if minutes < 60:
        return text(hass, "dur_minutes", m=minutes)
    hours, minutes = divmod(minutes, 60)
    if hours < 24:
        return text(hass, "dur_hours", h=hours, m=minutes)
    days, hours = divmod(hours, 24)
    return text(hass, "dur_days", d=days, h=hours)


def panel_url(device_id: str | None = None, app: str | None = None, tab: str | None = None) -> str:
    """Panel; mit Gerät öffnet es dessen Popup (?device=), mit App die App, zum Beispiel "status" (?app=, seit 2.66.0), dort auf Wunsch
    gleich ein Reiter (?tab=, seit 2.73.0)."""
    if device_id:
        return f"/{PANEL_URL_PATH}?device={device_id}"
    if not app:
        return f"/{PANEL_URL_PATH}"
    return f"/{PANEL_URL_PATH}?app={app}&tab={tab}" if tab else f"/{PANEL_URL_PATH}?app={app}"


def device_url(click: str, device_id: str) -> str:
    """Ziel beim Tippen auf die Meldung zu einem Gerät."""
    return f"/config/devices/device/{device_id}" if click == CLICK_DEVICE else panel_url(device_id)


def notification_data(
    hass: HomeAssistant, tag: str, url: str, actions: list[dict[str, str]] | None = None, icon: str | None = None
) -> dict[str, Any]:
    """
    Zusatzdaten für die Companion-App. Das Klickziel steht doppelt drin: iOS
    liest "url", Android nur "clickAction". Der Tag ersetzt eine frühere
    Meldung mit demselben Tag. Als Bild dient das Icon der Integration
    (push_icon.py), sonst das Device-Panel-Icon; ohne beide entfällt nur
    "icon_url". Aktionen erscheinen als Knöpfe unter der Meldung.
    """
    data: dict[str, Any] = {"tag": tag, "url": url, "clickAction": url}
    if image := icon or hass.data.get(DATA_PUSH_IMAGE):
        data["icon_url"] = image
    if actions:
        data["actions"] = actions
    return data


# Kritische Mitteilung (seit 2.7.0). Die Companion-App für iOS erwartet in "push.sound" critical = 1 und volume als
# Kommazahl von 0.0 bis 1.0 (0.0 wäre stumm); im Panel gilt 1 bis 10, also 0.1 bis 1.0. Auf Android gibt es keine
# Lautstärke pro Meldung: ttl 0, priority high und der Kanal "alarm_stream" spielen sie über den Alarm-Ton, auch bei
# stummem Telefon (companion.home-assistant.io, "Critical notifications").
CRITICAL_VOLUME_MAX = 10


def critical_data(volume: int) -> dict[str, Any]:
    """Zusatzdaten einer kritischen Mitteilung; volume 1 bis 10."""
    level = min(max(int(volume), 1), CRITICAL_VOLUME_MAX)
    return {
        "push": {"sound": {"name": "default", "critical": 1, "volume": round(level / CRITICAL_VOLUME_MAX, 1)}},
        "ttl": 0,
        "priority": "high",
        "channel": "alarm_stream",
    }


def device_actions(hass: HomeAssistant, url: str, device_id: str) -> list[dict[str, str]]:
    """Knöpfe einer Ausfall-Meldung: öffnen und 24 Std. stumm (Bild 5)."""
    return [
        {"action": "URI", "title": text(hass, "action_open"), "uri": url},
        {"action": f"{MUTE_ACTION_PREFIX}{device_id}", "title": text(hass, "action_mute")},
    ]


async def async_live(hass: HomeAssistant, target: str, name: str, title: str, message: str, data: dict[str, Any]) -> bool:
    """
    Live-Aktivität (iOS) bzw. Live-Update (Android) über einen notify-Dienst (seit 2.19.0; Gruppen reichen die Daten an
    ihre Mitglieder weiter). Eine notify-Entität kennt nur Titel und Text und kann das nicht; ein Dienst, der die
    Zusatzdaten ablehnt, auch nicht: dann gibt es keinen zweiten Versuch ohne Daten (das wäre eine gewöhnliche Meldung).
    """
    domain, _, object_id = target.partition(".")
    if domain != "notify" or not hass.services.has_service("notify", object_id) or object_id == "send_message":
        activity.record(hass, "error", "charge", "charge_live_unsupported", name, target=target)
        return False
    try:
        await hass.services.async_call("notify", object_id, {"title": title, "message": message, "data": data}, blocking=True)
    except Exception as err:  # noqa: BLE001 - eine Meldung darf die Überwachung nie stören
        _LOGGER.warning("Live-Aktivität an '%s' fehlgeschlagen: %s", target, err)
        activity.record(hass, "error", "charge", "charge_live_failed", name, target=target)
        return False
    return True


async def async_live_clear(hass: HomeAssistant, target: str, tag: str) -> bool:
    """Live-Aktivität beenden: clear_notification mit demselben Tag (beide Plattformen)."""
    domain, _, object_id = target.partition(".")
    if domain != "notify" or not hass.services.has_service("notify", object_id) or object_id == "send_message":
        return False
    try:
        await hass.services.async_call("notify", object_id, {"message": "clear_notification", "data": {"tag": tag}}, blocking=True)
    except Exception as err:  # noqa: BLE001
        _LOGGER.debug("Live-Aktivität beenden an '%s' fehlgeschlagen: %s", target, err)
        return False
    return True


def _journal(
    hass: HomeAssistant, severity: str, code: str, target: str, title: str, message: str, topic: str | None, devices: list[str] | None, res: str
) -> None:
    """
    Zeile im Panel-Log zu einer Meldung und, mit Geräten, der Eintrag im Meldungsprotokoll (seit 2.124.0 mit eigener Aufbewahrung, push_log.py):
    was an wen ging und mit welchem Ergebnis ("sent", "held", "failed", "missing"). Das Geräteprotokoll liest die Meldungen von dort.
    """
    activity.record(hass, severity, "push", code, target, title=title)
    if devices and (log := hass.data.get(DATA_PUSHLOG)) is not None:
        log.add(devices, title, message, target, topic or "", res)


async def async_push(
    hass: HomeAssistant,
    target: str,
    title: str,
    message: str,
    data: dict[str, Any] | None = None,
    topic: str | None = None,
    quiet: dict[str, Any] | None = None,
    outcome: dict[str, Any] | None = None,
    devices: list[str] | None = None,
    log_topic: str | None = None,
) -> bool:
    """
    Sendet an einen notify-Dienst oder eine notify-Entität; True, wenn
    abgeschickt. Lehnt ein Ziel die Zusatzdaten ab (z. B. Telegram, E-Mail:
    "extra keys not allowed"), folgt ein zweiter Versuch ohne. Eine Meldung
    darf die Überwachung nie stören: Fehler werden nur protokolliert.
    """
    # outcome (seit 2.104.0): der Aufrufer erfährt, was daraus wurde ("held" zurückgehalten, "sent" abgeschickt, "err" Grund), für das Protokoll
    outcome = outcome if outcome is not None else {}
    if not target or target == NOTIFY_NONE:
        outcome["err"] = "no_target"
        return False
    domain, _, object_id = target.partition(".")
    if domain != "notify" or not object_id:
        activity.record(hass, "error", "push", "push_invalid", target)
        outcome["err"] = "invalid_target"
        return False
    # Ruhezeit (seit 2.95.0): zurückgehaltene Meldungen stellt das Ende der Ruhezeit zu ("topic" ist die Art, "quiet" Angaben für die Zusammenfassung)
    if topic and (manager := hass.data.get(DATA_QUIET)) is not None and manager.hold(topic, target, title, message, data, quiet, devices):
        outcome["held"] = True
        return True
    plain: dict[str, Any] = {"title": title, "message": message}
    if hass.services.has_service("notify", object_id):
        if data:
            # Zweiter Versuch mit denselben Zusatzdaten nur nach einem vorübergehenden Fehler: Ohne sie fehlten Tag und Link,
            # eine Entwarnung ersetzte die erste Meldung nicht, und ein Tipp öffnete die App nicht
            for attempt in (1, 2):
                try:
                    await hass.services.async_call("notify", object_id, {**plain, "data": data}, blocking=True)
                    _journal(hass, "info", "push_sent", target, title, message, topic or log_topic, devices, "sent")
                    outcome["sent"] = True
                    return True
                except _REJECTED as err:
                    _LOGGER.debug("Zusatzdaten abgelehnt (%s)", err)
                    activity.record(hass, "debug", "push", "push_extra", target)
                    break
                except Exception as err:  # noqa: BLE001
                    _LOGGER.debug("Push an '%s' mit Zusatzdaten fehlgeschlagen, Versuch %d (%s)", target, attempt, err)
                    if attempt == 1:
                        await asyncio.sleep(RETRY_DELAY_S)
                    else:
                        activity.record(hass, "debug", "push", "push_extra", target)
        try:
            await hass.services.async_call("notify", object_id, plain, blocking=True)
            _journal(hass, "info", "push_sent", target, title, message, topic or log_topic, devices, "sent")
            outcome["sent"] = True
            return True
        except Exception as err:  # noqa: BLE001
            _LOGGER.exception("Push an '%s' fehlgeschlagen", target)
            _journal(hass, "error", "push_failed", target, title, message, topic or log_topic, devices, "failed")
            outcome["err"] = str(err) or type(err).__name__
            return False
    if hass.states.get(target) is not None and hass.services.has_service("notify", "send_message"):
        # notify-Entität: send_message kennt nur Titel und Text.
        try:
            await hass.services.async_call("notify", "send_message", {**plain, "entity_id": target}, blocking=True)
            _journal(hass, "info", "push_sent", target, title, message, topic or log_topic, devices, "sent")
            outcome["sent"] = True
            return True
        except Exception as err:  # noqa: BLE001
            _LOGGER.exception("Push an '%s' fehlgeschlagen", target)
            _journal(hass, "error", "push_failed", target, title, message, topic or log_topic, devices, "failed")
            outcome["err"] = str(err) or type(err).__name__
            return False
    _journal(hass, "error", "push_missing", target, title, message, topic or log_topic, devices, "missing")
    outcome["err"] = "missing"
    return False
