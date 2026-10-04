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
PANEL_VERSION = "42"
PANEL_PAGE_URL = f"{PANEL_STATIC_URL_PATH}/{PANEL_HTML_FILE}?v={PANEL_VERSION}"

# Mitgeliefertes Bild für Push-Meldungen (Companion-App, "icon_url"), wie in
# unifi_dynamic. Der Ordner brand/ wird beim Setup als statischer Pfad
# registriert und ist damit ohne Anmeldung abrufbar, wie /local/. Nur so kann
# die Companion-App das Bild laden. Nichts zu konfigurieren.
BRAND_DIR = "brand"
# Eigenes Bild mit Rand: iOS schneidet das Bild einer Push-Meldung in ein
# abgerundetes Quadrat, das knapp zugeschnittene Brand-Icon verlor die Ecken.
PUSH_DIR = "push"
PUSH_IMAGE_FILE = "icon.png"
PUSH_STATIC_URL_PATH = f"{STATIC_URL_PATH}/{PUSH_DIR}"
PUSH_IMAGE_URL = f"{PUSH_STATIC_URL_PATH}/{PUSH_IMAGE_FILE}"

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
# Batterie (Optionen): gilt bis "Schwach ab" (Prozent) als schwach; Meldung
# wahlweise als Push, als anhaltende Benachrichtigung in HA, beides oder
# keines (Standard: keines, damit ein Update nicht ungefragt meldet).
CONF_BATTERY_LOW = "battery_low"
DEFAULT_BATTERY_LOW = 15
CONF_BATTERY_PUSH = "battery_push"
CONF_BATTERY_PERSISTENT = "battery_persistent"
# Eigene Schwelle pro Integration {Domain: Prozent}, gleicher Bereich wie
# "Schwach ab"; ohne Eintrag gilt der globale Wert. Massgebend ist
# die primäre Integration des Geräts.
CONF_BATTERY_LOW_INTEGRATIONS = "battery_low_integrations"
# Eigenes "Ausgefallen nach" pro Integration {Domain: Minuten oder "off"};
# ohne Eintrag gilt der globale Wert. "off" = Geräte der Integration bleiben
# sichtbar, werden aber nicht überwacht (keine Ausfälle, Statistik, Meldungen).
# Der Bereich ist weiter als beim globalen Wert: Geräte, die nur einmal am
# Tag melden, brauchen Stunden.
CONF_OFFLINE_INTEGRATIONS = "offline_after_integrations"
OFFLINE_INTEGRATION_RANGE = (1, 1440)
MONITOR_OFF = "off"
# Push erst nach so vielen Minuten Ausfall (0 = sobald ausgefallen); kurze
# Aussetzer lösen dann weder Ausfall- noch Online-Meldung aus.
CONF_NOTIFY_DELAY = "notify_delay"
DEFAULT_NOTIFY_DELAY = 0
INT_RANGES = {
    CONF_OFFLINE_AFTER: (1, 60),
    CONF_FLAKY_OUTAGES: (2, 50),
    CONF_STARTUP_GRACE: (0, 30),
    CONF_BATTERY_LOW: (5, 50),
    CONF_NOTIFY_DELAY: (0, 60),
}
# Erst wieder melden, wenn die Batterie zwischendurch so viele Prozentpunkte
# über der Schwelle war (Batteriewechsel), sonst meldet ein Wert, der um die
# Schwelle pendelt, immer wieder.
BATTERY_REARM = 5
# Mehr neu betroffene Geräte auf einmal: eine Sammelmeldung statt vieler.
BATTERY_PUSH_MAX = 3
DATA_BATTERY = f"{DOMAIN}_battery"
PERSISTENT_BATTERY_ID = f"{DOMAIN}_battery"

# Push (Optionen, wie unifi_dynamic): Ziel ist ein notify-Dienst oder eine
# notify-Entität; "none" = keine Push-Meldungen. Tipp auf die Meldung öffnet
# das Gerät im Panel oder die Geräteseite von HA.
CONF_NOTIFY_SERVICE = "notify_service"
NOTIFY_NONE = "none"
CONF_NOTIFY_CLICK = "notify_click_target"
# Push bei Ausfall (sofort, sobald ein Gerät als ausgefallen gilt) und bei
# Rückkehr, Sammelausfall als eine Meldung; Standard aus, damit ein Update
# nicht ungefragt meldet. Sammelausfall: ab INCIDENT_MIN Geräten im selben
# Durchlauf der Erkennung.
CONF_NOTIFY_OUTAGE = "notify_outage"
CONF_NOTIFY_ONLINE = "notify_online"
CONF_NOTIFY_GROUP = "notify_group"
NOTIFY_GROUP_MIN = 3
DATA_OUTAGE = f"{DOMAIN}_outage"
# Ausfall-Meldungen nach Bild 5 (docs/mockups/panel-v1), seit 0.20.0;
# "Erst melden nach" (CONF_NOTIFY_DELAY) steht bei den Bereichen oben.
# Inhalt der Meldung (der Name steht im Titel), in dieser Reihenfolge (wie
# die Vorschau in Bild 5).
CONF_NOTIFY_FIELDS = "notify_fields"
NOTIFY_FIELDS = ("area", "integration", "connection", "since", "signal", "battery", "model")
DEFAULT_NOTIFY_FIELDS = ("area", "integration", "since")
# Integrationen ohne Ausfall-/Online-Push bzw. ohne Eintrag in der
# anhaltenden Benachrichtigung (Spalten "Push" und "Anhaltend").
CONF_NOTIFY_EXCLUDE = "notify_exclude_integrations"
CONF_PERSISTENT_EXCLUDE = "persistent_exclude_integrations"
# Anhaltende Benachrichtigung in HA, solange Geräte ausgefallen sind.
CONF_OUTAGE_PERSISTENT = "outage_persistent"
PERSISTENT_OUTAGE_ID = f"{DOMAIN}_outage"
# Aktion "24 Std. stumm" in der Push-Meldung (Companion-App): Ereignis
# mobile_app_notification_action mit diesem Präfix und der Geräte-ID.
MUTE_ACTION_PREFIX = "DEVICE_PANEL_MUTE_"
MUTE_HOURS = 24
# Batterie-Push: sofort oder einmal täglich um eine Uhrzeit (lokale Zeit),
# täglich mit den neu betroffenen oder allen schwachen Geräten.
CONF_BATTERY_PUSH_MODE = "battery_push_mode"
PUSH_INSTANT = "instant"
PUSH_DAILY = "daily"
PUSH_MODES = (PUSH_INSTANT, PUSH_DAILY)
CONF_BATTERY_PUSH_TIME = "battery_push_time"
DEFAULT_BATTERY_PUSH_TIME = "08:00"
CONF_BATTERY_PUSH_DAILY = "battery_push_daily"
DAILY_NEW = "new"
DAILY_ALL = "all"
DAILY_CONTENTS = (DAILY_NEW, DAILY_ALL)
# Einstellungen pro Gerät (gleiche Datei wie der Typ von Hand): Batterie aus
# oder eigene Schwelle, Ausfall- und Online-Meldungen aus.
DATA_DEVICE_SETTINGS = f"{DOMAIN}_device_settings"
BATTERY_OFF = "off"
# Empfang-Warnung pro Gerät (seit 0.21.0, docs/mockups/signal-v1, A): "off"
# oder eigene Schwelle "schwach unter"; dBm negativ, LQI positiv. Ohne
# Eintrag gilt der Standard des Panels (unter -80 dBm bzw. LQI 60 und
# darunter).
SIGNAL_OFF = "off"
# Neue Geräte (seit 0.21.0): so lange nach dem Anlegen in HA markiert, mit
# eigenem Filter-Chip.
NEW_DEVICE_DAYS = 3
SIGNAL_DBM_RANGE = (-110, -40)
SIGNAL_LQI_RANGE = (1, 200)
CLICK_PANEL = "panel"
CLICK_DEVICE = "device"
CLICK_TARGETS = (CLICK_PANEL, CLICK_DEVICE)
# Anzeige (Optionen): Dienst-Geräte (z. B. Sonne, Add-ons) werden dann gezeigt
# und überwacht, deaktivierte Geräte nur gezeigt (eigene Gruppe).
CONF_SHOW_SERVICE = "show_service_devices"
CONF_SHOW_DISABLED = "show_disabled_devices"
# Verfügbarkeitsprotokoll (eine Instanz pro HA).
DATA_AVAILABILITY = f"{DOMAIN}_availability"
# Eigene Aufzeichnung des Empfangs (ZHA, Bluetooth; seit 0.24.0).
DATA_SIGNAL = f"{DOMAIN}_signal"

WS_TYPE_LIST_DEVICES = f"{DOMAIN}/list_devices"

# Versionsprüfung (GitHub-Releases) und Abgleich mit HACS, wie unifi_dynamic.
GITHUB_REPO = "Diegofuego871/ha-device-panel"
STORAGE_VERSION = 1
# Option: täglich nach Updates suchen und eine neue Version unter
# "Reparaturen" melden. Standard an, wie in unifi_dynamic.
# KI-Einschätzung eines Geräts (seit 0.33.0): Knopf im Geräte-Popup, nur auf
# Knopfdruck; standardmässig aus, weil je nach Anbieter Daten in die Cloud
# gehen. Die KI-Aufgabe (ai_task-Entität) ist wählbar, leer = Standard von HA.
CONF_AI_ASSESSMENT = "ai_assessment"
CONF_AI_TASK = "ai_task_entity"
# Antwort der KI abwarten (Sekunden), dann Fehler statt endlosem Warten.
AI_TIMEOUT = 90
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
# Einzelne Geräte ausgeblendet (seit 0.23.0): nicht gezeigt, nicht überwacht,
# keine Meldungen; Liste von Geräte-IDs, wieder einzublenden in den
# Einstellungen ("Ausgeblendete Geräte").
CONF_EXCLUDE_DEVICES = "exclude_devices"
# Filter-Chips der Verbindungsart, die das Panel nicht zeigt (Abschnitt
# "Anzeige", gilt für alle Benutzer). Nur die Chips: Geräte bleiben sichtbar.
CONF_HIDE_CONNECTIONS = "hide_connections"
# Reihenfolge dieser Chips (gilt für alle); leer = nach Anzahl der Geräte.
CONF_CONNECTION_ORDER = "connection_order"
CONNECTION_TYPES = ("zigbee", "thread", "zwave", "matter", "ble", "wifi", "ethernet", "network", "cloud", "unknown")
# Verbindungsart von Hand (Popup, wie der Typ): alle ausser "unbekannt", das
# ist der Fall ohne Erkennung, kein Wert zum Wählen.
CONNECTION_MANUAL = tuple(c for c in CONNECTION_TYPES if c != "unknown")
DATA_CONNECTION_OVERRIDES = f"{DOMAIN}_connection_overrides"
# Verbindungsart pro Integration {Domain: Art} (gilt für alle Benutzer): für
# alle Geräte der Integration statt der Erkennung; von Hand am Gerät geht vor.
CONF_CONNECTION_INTEGRATIONS = "connection_integrations"
# Von Hand gesetzte Gerätetypen (eigene Datei, eine Instanz pro HA).
DATA_TYPE_OVERRIDES = f"{DOMAIN}_type_overrides"
