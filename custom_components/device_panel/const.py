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
PANEL_VERSION = "7"
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

# Ausfall-Erkennung (Optionen, docs/CONCEPT.md, "Überwachung einstellen"):
# ausgefallen erst nach 2 Min. ohne Lebenszeichen; instabil ab 3 Unterbrüchen
# in 24 Std. bei einem Gerät, das gerade online ist; Anlaufphase von 5 Min.
# nach dem Start. Zeiten in Minuten, Bereiche (min, max) gelten für Panel und
# Optionsdialog.
CONF_OFFLINE_AFTER = "offline_after"
DEFAULT_OFFLINE_AFTER = 2
CONF_FLAKY_OUTAGES = "flaky_outages"
DEFAULT_FLAKY_OUTAGES = 3
CONF_STARTUP_GRACE = "startup_grace"
DEFAULT_STARTUP_GRACE = 5
INT_RANGES = {
    CONF_OFFLINE_AFTER: (1, 60),
    CONF_FLAKY_OUTAGES: (2, 50),
    CONF_STARTUP_GRACE: (0, 30),
}
# Batterie gilt bis 15 % als niedrig.
BATTERY_LOW = 15
# Anzeige (Optionen): Dienst-Geräte (z. B. Sonne, Add-ons) werden dann gezeigt
# und überwacht, deaktivierte Geräte nur gezeigt (eigene Gruppe).
CONF_SHOW_SERVICE = "show_service_devices"
CONF_SHOW_DISABLED = "show_disabled_devices"
# Verfügbarkeitsprotokoll (eine Instanz pro HA).
DATA_AVAILABILITY = f"{DOMAIN}_availability"

WS_TYPE_LIST_DEVICES = f"{DOMAIN}/list_devices"

# Versionsprüfung (GitHub-Releases) und Abgleich mit HACS, wie unifi_dynamic.
GITHUB_REPO = "Diegofuego871/ha-device-panel"
STORAGE_VERSION = 1
# Option: täglich nach Updates suchen und eine neue Version unter
# "Reparaturen" melden. Standard an, wie in unifi_dynamic.
CONF_UPDATE_CHECK = "update_check"
DEFAULT_UPDATE_CHECK = True

# Gerätetypen für Liste, Popup und Ausschlüsse (devices.device_type). Die
# Reihenfolge ist die Anzeigereihenfolge in den Einstellungen.
DEVICE_TYPES = (
    "hub", "phone", "network", "climate", "lock", "cover", "valve", "vacuum", "camera", "alarm", "media",
    "fan", "light", "outlet", "switch", "motion", "contact", "safety", "energy", "sensor", "button", "other",
)
# Ausschlüsse (Optionen): Geräte dieser Integrationen bzw. Typen zeigt das
# Panel nicht, und das Protokoll überwacht sie nicht.
CONF_EXCLUDE_INTEGRATIONS = "exclude_integrations"
CONF_EXCLUDE_TYPES = "exclude_types"
# Von Hand gesetzte Gerätetypen (eigene Datei, eine Instanz pro HA).
DATA_TYPE_OVERRIDES = f"{DOMAIN}_type_overrides"
