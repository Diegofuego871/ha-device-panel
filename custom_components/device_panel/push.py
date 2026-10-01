"""
Meldungen nach aussen: Push über notify und Texte in der Sprache der
Instanz (wie unifi_dynamic, notification.py und msg.py).
"""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant

from .const import CLICK_DEVICE, DATA_PUSH_IMAGE, NOTIFY_NONE, PANEL_URL_PATH

_LOGGER = logging.getLogger(__name__)

# Texte der Meldungen. Platzhalter mit str.format; DE und EN mit denselben
# Schlüsseln (tests/test_translations.py prüft das).
TEXTS: dict[str, dict[str, str]] = {
    "de": {
        "battery_title": "Batterie schwach: {name}",
        "battery_title_many": "Batterie schwach: {count} Geräte",
        "battery_low": "schwach",
        "persistent_title": "Device Panel: Batterie schwach",
        "persistent_intro": "Diese Geräte haben eine schwache Batterie (bis {threshold} %):",
        "persistent_intro_own": "Diese Geräte haben eine schwache Batterie (Schwelle je nach Integration):",
        "persistent_outro": "Die Meldung verschwindet von selbst, wenn alle wieder über der Schwelle sind. Einstellen im Device Panel unter Einstellungen → Batterie.",
        "notify_none": "Keine Push-Meldungen",
        "notify_entity": "{entity_id} (Entität)",
        "notify_missing": "{value} (nicht gefunden)",
    },
    "en": {
        "battery_title": "Low battery: {name}",
        "battery_title_many": "Low battery: {count} devices",
        "battery_low": "low",
        "persistent_title": "Device Panel: low battery",
        "persistent_intro": "These devices have a low battery (up to {threshold} %):",
        "persistent_intro_own": "These devices have a low battery (threshold per integration):",
        "persistent_outro": "This notification disappears by itself once all of them are above the threshold again. Change it in Device Panel under Settings → Battery.",
        "notify_none": "No push notifications",
        "notify_entity": "{entity_id} (entity)",
        "notify_missing": "{value} (not found)",
    },
}


def language(hass: HomeAssistant) -> str:
    """Sprache der Instanz: "de" für de und de-*, sonst "en"."""
    lang = (hass.config.language or "").strip().lower()
    return "de" if lang == "de" or lang.startswith("de-") else "en"


def text(hass: HomeAssistant, key: str, **kwargs: Any) -> str:
    return TEXTS[language(hass)][key].format(**kwargs)


def panel_url(device_id: str | None = None) -> str:
    """Panel, mit Gerät öffnet es dessen Popup (?device=)."""
    return f"/{PANEL_URL_PATH}?device={device_id}" if device_id else f"/{PANEL_URL_PATH}"


def device_url(click: str, device_id: str) -> str:
    """Ziel beim Tippen auf die Meldung zu einem Gerät."""
    return f"/config/devices/device/{device_id}" if click == CLICK_DEVICE else panel_url(device_id)


def notification_data(hass: HomeAssistant, tag: str, url: str) -> dict[str, Any]:
    """
    Zusatzdaten für die Companion-App. Das Klickziel steht doppelt drin: iOS
    liest "url", Android nur "clickAction". Der Tag ersetzt eine frühere
    Meldung mit demselben Tag. Ohne Bild entfällt nur "icon_url".
    """
    data: dict[str, Any] = {"tag": tag, "url": url, "clickAction": url}
    if image := hass.data.get(DATA_PUSH_IMAGE):
        data["icon_url"] = image
    return data


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
        _LOGGER.warning("Ungültiges Push-Ziel '%s', erwartet wird notify.<name>", target)
        return False
    plain: dict[str, Any] = {"title": title, "message": message}
    if hass.services.has_service("notify", object_id):
        if data:
            try:
                await hass.services.async_call("notify", object_id, {**plain, "data": data}, blocking=True)
                return True
            except Exception as err:  # noqa: BLE001
                _LOGGER.debug("Ziel '%s' lehnt die Zusatzdaten ab (%s), Versuch ohne", target, err)
        try:
            await hass.services.async_call("notify", object_id, plain, blocking=True)
            return True
        except Exception:  # noqa: BLE001
            _LOGGER.exception("Push an '%s' fehlgeschlagen", target)
            return False
    if hass.states.get(target) is not None and hass.services.has_service("notify", "send_message"):
        # notify-Entität: send_message kennt nur Titel und Text.
        try:
            await hass.services.async_call("notify", "send_message", {**plain, "entity_id": target}, blocking=True)
            return True
        except Exception:  # noqa: BLE001
            _LOGGER.exception("Push an '%s' fehlgeschlagen", target)
            return False
    _LOGGER.warning("Push-Ziel '%s' existiert nicht, Meldung verworfen", target)
    return False
