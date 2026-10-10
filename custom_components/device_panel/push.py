"""
Meldungen nach aussen: Push über notify und Texte in der Sprache der
Instanz (wie unifi_dynamic, notification.py und msg.py).
"""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant

from . import activity
from .const import CLICK_DEVICE, DATA_PUSH_IMAGE, MUTE_ACTION_PREFIX, NOTIFY_NONE, PANEL_URL_PATH

_LOGGER = logging.getLogger(__name__)

# Texte der Meldungen. Platzhalter mit str.format; DE und EN mit denselben
# Schlüsseln (tests/test_translations.py prüft das).
TEXTS: dict[str, dict[str, str]] = {
    "de": {
        "battery_title": "🪫 Batterie schwach: {name}",
        "battery_title_many": "🪫 Batterie schwach: {count} Geräte",
        "battery_low": "schwach",
        "persistent_title": "🪫 Device Panel: Batterie schwach",
        "persistent_intro": "Diese Geräte haben eine schwache Batterie (bis {threshold} %):",
        "persistent_intro_own": "Diese Geräte haben eine schwache Batterie (Schwelle je nach Integration oder Gerät):",
        "persistent_outro": "Die Meldung verschwindet von selbst, wenn alle wieder über der Schwelle sind. Einstellen im Device Panel unter Einstellungen → Batterie.",
        "notify_none": "Keine Push-Meldungen",
        "notify_entity": "{entity_id} (Entität)",
        "notify_missing": "{value} (nicht gefunden)",
        "outage_title": "🔴 Ausgefallen: {name}",
        "outage_title_many": "🚨 Sammelausfall: {count} Geräte",
        "outage_since": "seit {time}",
        "outage_cause": "vermutlich {integration}",
        "online_title": "🟢 Wieder online: {name}",
        "online_title_many": "🟢 Wieder online: {count} Geräte",
        "online_after": "nach {duration}",
        "dur_days": "{d} T. {h} Std.",
        "dur_hours": "{h} Std. {m} Min.",
        "dur_minutes": "{m} Min.",
        "dur_short": "< 1 Min.",
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
        "new_title": "✨ Neues Gerät: {name}",
        "new_title_many": "✨ {count} neue Geräte",
        "new_found": "neu gefunden",
        "charge_title": "🔋 Geladen: {name}",
        "charge_from": "in {duration} von {start} %",
        "charge_jump": "von {start} %",
        "charge_stop_title": "🔌 Ladung beendet: {name}",
        "charge_stalled": "Stand seit {duration} unverändert",
        "update_title": "⬆️ Home Assistant Update",
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
        "battery_title": "🪫 Low battery: {name}",
        "battery_title_many": "🪫 Low battery: {count} devices",
        "battery_low": "low",
        "persistent_title": "🪫 Device Panel: low battery",
        "persistent_intro": "These devices have a low battery (up to {threshold} %):",
        "persistent_intro_own": "These devices have a low battery (threshold per integration or device):",
        "persistent_outro": "This notification disappears by itself once all of them are above the threshold again. Change it in Device Panel under Settings → Battery.",
        "notify_none": "No push notifications",
        "notify_entity": "{entity_id} (entity)",
        "notify_missing": "{value} (not found)",
        "outage_title": "🔴 Offline: {name}",
        "outage_title_many": "🚨 Group outage: {count} devices",
        "outage_since": "since {time}",
        "outage_cause": "probably {integration}",
        "online_title": "🟢 Back online: {name}",
        "online_title_many": "🟢 Back online: {count} devices",
        "online_after": "after {duration}",
        "dur_days": "{d} d {h} h",
        "dur_hours": "{h} h {m} min",
        "dur_minutes": "{m} min",
        "dur_short": "< 1 min",
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
        "new_title": "✨ New device: {name}",
        "new_title_many": "✨ {count} new devices",
        "new_found": "newly found",
        "charge_title": "🔋 Charged: {name}",
        "charge_from": "in {duration} from {start} %",
        "charge_jump": "from {start} %",
        "charge_stop_title": "🔌 Charging stopped: {name}",
        "charge_stalled": "level unchanged for {duration}",
        "update_title": "⬆️ Home Assistant update",
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


def language(hass: HomeAssistant) -> str:
    """Sprache der Instanz: "de" für de und de-*, sonst "en"."""
    lang = (hass.config.language or "").strip().lower()
    return "de" if lang == "de" or lang.startswith("de-") else "en"


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


def panel_url(device_id: str | None = None) -> str:
    """Panel, mit Gerät öffnet es dessen Popup (?device=)."""
    return f"/{PANEL_URL_PATH}?device={device_id}" if device_id else f"/{PANEL_URL_PATH}"


def device_url(click: str, device_id: str) -> str:
    """Ziel beim Tippen auf die Meldung zu einem Gerät."""
    return f"/config/devices/device/{device_id}" if click == CLICK_DEVICE else panel_url(device_id)


def notification_data(hass: HomeAssistant, tag: str, url: str, actions: list[dict[str, str]] | None = None) -> dict[str, Any]:
    """
    Zusatzdaten für die Companion-App. Das Klickziel steht doppelt drin: iOS
    liest "url", Android nur "clickAction". Der Tag ersetzt eine frühere
    Meldung mit demselben Tag. Ohne Bild entfällt nur "icon_url". Aktionen
    erscheinen als Knöpfe unter der Meldung.
    """
    data: dict[str, Any] = {"tag": tag, "url": url, "clickAction": url}
    if image := hass.data.get(DATA_PUSH_IMAGE):
        data["icon_url"] = image
    if actions:
        data["actions"] = actions
    return data


def device_actions(hass: HomeAssistant, url: str, device_id: str) -> list[dict[str, str]]:
    """Knöpfe einer Ausfall-Meldung: öffnen und 24 Std. stumm (Bild 5)."""
    return [
        {"action": "URI", "title": text(hass, "action_open"), "uri": url},
        {"action": f"{MUTE_ACTION_PREFIX}{device_id}", "title": text(hass, "action_mute")},
    ]


async def async_push(
    hass: HomeAssistant, target: str, title: str, message: str, data: dict[str, Any] | None = None
) -> bool:
    """
    Sendet an einen notify-Dienst oder eine notify-Entität; True, wenn
    abgeschickt. Lehnt ein Ziel die Zusatzdaten ab (z. B. Telegram, E-Mail:
    "extra keys not allowed"), folgt ein zweiter Versuch ohne. Eine Meldung
    darf die Überwachung nie stören: Fehler werden nur protokolliert.
    """
    if not target or target == NOTIFY_NONE:
        return False
    domain, _, object_id = target.partition(".")
    if domain != "notify" or not object_id:
        activity.record(hass, "error", "push", "push_invalid", target)
        return False
    plain: dict[str, Any] = {"title": title, "message": message}
    if hass.services.has_service("notify", object_id):
        if data:
            try:
                await hass.services.async_call("notify", object_id, {**plain, "data": data}, blocking=True)
                activity.record(hass, "info", "push", "push_sent", target, title=title)
                return True
            except Exception as err:  # noqa: BLE001
                _LOGGER.debug("Zusatzdaten abgelehnt (%s)", err)
                activity.record(hass, "debug", "push", "push_extra", target)
        try:
            await hass.services.async_call("notify", object_id, plain, blocking=True)
            activity.record(hass, "info", "push", "push_sent", target, title=title)
            return True
        except Exception:  # noqa: BLE001
            _LOGGER.exception("Push an '%s' fehlgeschlagen", target)
            activity.record(hass, "error", "push", "push_failed", target, title=title)
            return False
    if hass.states.get(target) is not None and hass.services.has_service("notify", "send_message"):
        # notify-Entität: send_message kennt nur Titel und Text.
        try:
            await hass.services.async_call("notify", "send_message", {**plain, "entity_id": target}, blocking=True)
            activity.record(hass, "info", "push", "push_sent", target, title=title)
            return True
        except Exception:  # noqa: BLE001
            _LOGGER.exception("Push an '%s' fehlgeschlagen", target)
            activity.record(hass, "error", "push", "push_failed", target, title=title)
            return False
    activity.record(hass, "error", "push", "push_missing", target, title=title)
    return False
