"""Konstanten der Integration "Device Panel"."""

from __future__ import annotations

DOMAIN = "device_panel"

# Panel: eingebautes iframe-Panel (siehe docs/LEARNINGS.md).
PANEL_URL_PATH = "device-panel"
PANEL_TITLE = "Device Panel"
PANEL_ICON = "mdi:devices"
PANEL_DIR = "panel"
PANEL_HTML_FILE = "panel.html"
STATIC_URL_PATH = f"/{DOMAIN}"
PANEL_STATIC_URL_PATH = f"{STATIC_URL_PATH}/panel"
# Cache-Buster: bei jeder Änderung unter panel/ von Hand erhöhen.
PANEL_VERSION = "3"
PANEL_PAGE_URL = f"{PANEL_STATIC_URL_PATH}/{PANEL_HTML_FILE}?v={PANEL_VERSION}"

# Mitgeliefertes Bild für Push-Meldungen (Companion-App, "icon_url"), wie in
# unifi_dynamic. Der Ordner brand/ wird beim Setup als statischer Pfad
# registriert und ist damit ohne Anmeldung abrufbar, wie /local/. Nur so kann
# die Companion-App das Bild laden. Nichts zu konfigurieren.
BRAND_DIR = "brand"
PUSH_IMAGE_FILE = "icon.png"
PUSH_IMAGE_URL = f"{STATIC_URL_PATH}/{PUSH_IMAGE_FILE}"

DATA_PANEL_REGISTERED = f"{DOMAIN}_panel_registered"
# URL des Push-Bilds oder None, wenn es nicht bereitgestellt werden konnte.
DATA_PUSH_IMAGE = f"{DOMAIN}_push_image"
DATA_WS_REGISTERED = f"{DOMAIN}_ws_registered"
# Zeitpunkt, an dem die Integration beim Start von HA geladen wurde.
DATA_STARTED_AT = f"{DOMAIN}_started_at"

# Standard der Überwachung (docs/CONCEPT.md, "Überwachung einstellen"):
# ausgefallen erst nach 2 Min. ohne Lebenszeichen; Batterie gilt bis 15 %
# als niedrig.
OFFLINE_AFTER = 120
BATTERY_LOW = 15

WS_TYPE_LIST_DEVICES = f"{DOMAIN}/list_devices"
