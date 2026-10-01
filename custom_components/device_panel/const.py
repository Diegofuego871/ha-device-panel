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
PANEL_VERSION = "2"
PANEL_PAGE_URL = f"{PANEL_STATIC_URL_PATH}/{PANEL_HTML_FILE}?v={PANEL_VERSION}"

DATA_PANEL_REGISTERED = f"{DOMAIN}_panel_registered"
DATA_WS_REGISTERED = f"{DOMAIN}_ws_registered"

WS_TYPE_LIST_DEVICES = f"{DOMAIN}/list_devices"
