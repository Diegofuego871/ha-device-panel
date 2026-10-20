/**
 * Panel "Device Panel": alle Geräte von Home Assistant mit Status, Dauer des
 * Ausfalls, Verfügbarkeit, Verbindungsart, Empfang, Typ, Integration,
 * Batterie und Softwarestand. Jedes Gerät hat ein Popup mit Statistik,
 * Verbindung und Entitäten; die Statistik-Kacheln öffnen ein zweites
 * Fenster mit dem Verlauf (wie in "UniFi Dynamic Clients").
 *
 * Design C (docs/mockups/panel-v1): Kopf mit Kennzahlen und Ausfall-Puls,
 * Chips nach Verbindungsart und Hinweisen, gruppierte Tabelle; auf dem
 * Handy Karten. Aufbau wie in unifi_dynamic (docs/LEARNINGS.md): Vanilla
 * Web Component als iframe-Panel, Texte und Styles in eigenen Modulen.
 */

const MODULE_VERSION = new URL(import.meta.url).search;
const [{ STRINGS, pickLang }, { PANEL_CSS }, { MagicPush }, { RoutineUi, DOMAIN_EMOJI }, { AppLauncher }, { StatusUi }, { ProtocolUi }] = await Promise.all([
  import(`./strings.js${MODULE_VERSION}`),
  import(`./styles.js${MODULE_VERSION}`),
  import(`./magic-push.js${MODULE_VERSION}`),
  import(`./routines.js${MODULE_VERSION}`),
  import(`./apps.js${MODULE_VERSION}`),
  import(`./status-ui.js${MODULE_VERSION}`),
  import(`./protocol.js${MODULE_VERSION}`),
]);

const POLL_INTERVAL_MS = 10000;
// Dauer-Anzeigen laufen weiter, ohne dafür neu abzufragen.
const TICK_MS = 30000;
// Logos der Integrationen (Brand-Dienst): Token alle 10 Min. erneuern, beim Aufwachen schon nach 5 Min.; ein gescheitertes Bild
// wird nach 5 Min. neu versucht (2.35.0)
const BRAND_TOKEN_MS = 10 * 60 * 1000;
const BRAND_STALE_MS = 5 * 60 * 1000;
const BRAND_FAIL_MS = 5 * 60 * 1000;
const NARROW_QUERY = "(max-width: 600px)";
// Ansicht pro Benutzer (docs/mockups/view-v1): Sortierung, Gruppen oder
// Liste, Spalten (Desktop) bzw. Angaben auf der Karte (Handy) und die
// Filter-Chips, getrennt für Desktop und Handy (schmal). Gespeichert in HA
// (frontend/set_user_data), lokale Kopie in localStorage; beim Laden gewinnt
// der neuere Stand (wie unifi_dynamic). Der Suchtext gilt nur, solange das
// Panel offen ist.
const VIEW_KEY = "device_panel_view";
// Adresse dieses Panels in Home Assistant (const.py: PANEL_URL_PATH); als Startseite wird sie in den Benutzerdaten "core" als default_panel gespeichert
const PANEL_PATH = "device-panel";
// Eigener Eintrag in den Benutzerdaten: die bisherige Startseite, die beim Ausschalten zurückkommt
const START_KEY = "device_panel_start";
const VIEW_SAVE_DELAY_MS = 400;
// Reiter "Schalter" (seit 2.58.0): was als "an" gilt (farbige Kachel); alles andere (aus, zu, abgeschlossen, Standby …) bleibt grau
const SWITCH_ON = new Set(["on", "open", "opening", "unlocked", "unlocking", "playing", "heat", "cool", "heat_cool", "auto", "dry", "fan_only", "triggered"]);
// Favoriten pro Benutzer (seit 2.22.0), gleiche Ablage wie die Ansicht
const FAV_KEY = "device_panel_favorites";
// Lieblings-Routine (seit 2.26.0): Routinen-IDs pro Benutzer, gleich gespeichert wie die Favoriten-Geräte
const TSTAR_KEY = "device_panel_routine_stars";
// Umbenennung Timer → Routine (2.55.0): so hiess der Eintrag vorher; _loadRtStars übernimmt ihn einmal
const LEGACY_TSTAR_KEY = "device_panel_timer_stars";
// Spalten nach "Gerät" (fest vorne): Schlüssel, Text, Standard sichtbar.
// Der Schlüssel ist zugleich der Sortierschlüssel der Spalte.
const COLUMNS = [
  ["status", "colStatus", true],
  ["connection", "colConnection", true],
  ["avail", "colAvail", true],
  ["type", "colType", true],
  ["integration", "colIntegration", true],
  ["battery", "colBattery", true],
  ["model", "colModel", true],
  ["software", "colSoftware", true],
  ["area", "colArea", false],
  ["outages", "colOutages", false],
  ["via", "colVia", false],
];
// Angaben auf den Karten (Handy), gleiche Schlüssel wie die Spalten.
const CARD_FIELDS = [
  ["connection", "colConnection", true],
  ["type", "colType", true],
  ["integration", "colIntegration", true],
  ["area", "colArea", true],
  ["battery", "colBattery", false],
  ["avail", "colAvail", false],
  ["model", "colModel", false],
  ["software", "colSoftware", false],
];
const COL_LABEL = Object.fromEntries([["name", "colName"], ["signal", "sortSignal"], ...COLUMNS.map(([k, label]) => [k, label])]);
// Im Blatt (Handy) heisst die Sortierung nach dem Namen "Name", nicht "Gerät".
const SORT_LABEL = { ...COL_LABEL, name: "sortName", default: "sortDefault" };
// "default": nach Gruppe (Ausfälle zuerst, längste zuoberst).
const SORT_KEYS = ["default", "name", "signal", ...COLUMNS.map(([k]) => k)];
// Auf dem Handy wählbar, in dieser Reihenfolge.
const SORT_MOBILE = ["default", "name", "status", "avail", "battery", "signal", "integration", "type", "area"];
// Schwacher Empfang (wie die Ursachen-Regeln in docs/CONCEPT.md).
const WEAK_DBM = -80;
// Farben der Empfänger im Weg des Bluetooth-Empfangs (Fenster "Empfang"), nach erstem Auftreten.
const VIA_COLORS = ["#3B82F6", "#F59E0B", "#10B981", "#8B5CF6", "#EC4899", "#14B8A6"];
const WEAK_LQI = 60;
// Eigene Empfang-Schwelle pro Gerät "schwach unter" (wie const.SIGNAL_*_RANGE).
const SIG_DBM_RANGE = [-110, -40];
const SIG_LQI_RANGE = [1, 200];
// Matter: Funkart (Thread/WLAN/LAN) ändert sich praktisch nie.
const MATTER_REFRESH_MS = 3600000;
// Popup: Entitäten und Kurzstatistik höchstens 30 s alt, Verlauf 60 s.
const DETAIL_MAX_AGE_MS = 30000;
const HISTORY_MAX_AGE_MS = 60000;
const RANGES = ["24h", "7d", "30d"];
// Batterie-Verlauf (seit 0.22.0, docs/mockups/battery-history-v1, A): dazu 3 Monate.
const BAT_RANGES = ["24h", "7d", "30d", "90d", "180d", "365d"];
// Kaum Daten im Zeitraum (neu installiert): Zeitstrahl erst ab dem ersten
// Datenpunkt, sonst wäre er fast ganz schraffiert (wie unifi_dynamic).
const ZOOM_SHARE = 0.1;
const OUTAGE_LIST_MAX = 10;
// Repository für den Abgleich mit HACS (Update-Entität, Repository-Liste).
const REPO = "diegofuego871/ha-device-panel";
// Link auf dieses Repository auf GitHub, am Host verankert (wie update_check.is_repo_url im Backend)
const REPO_URL_RE = /^https:\/\/github\.com\/diegofuego871\/ha-device-panel(?:[/?#]|$)/i;

// innerHTML nur bei echter Änderung ersetzen; Vergleich mit dem zuletzt
// gesetzten String, nie mit el.innerHTML (siehe LEARNINGS).
const lastHtml = new WeakMap();
function setHtml(el, html) {
  if (!el || lastHtml.get(el) === html) return false;
  el.innerHTML = html;
  lastHtml.set(el, html);
  return true;
}

// Fokus nach einem Neuaufbau zurückgeben, aber auf Touch-Geräten nicht an
// Auswahl- und Zeitfelder: iOS öffnet bei Fokus sofort wieder die Auswahl,
// nach jeder Änderung und jeder Abfrage erneut (Rückmeldung des Nutzers).
// Mit Maus und Tastatur bleibt der Fokus, wie er war.
const TOUCH_QUERY = "(pointer: coarse)";
function refocus(el) {
  if (!el) return;
  const picker = el.tagName === "SELECT" || (el.tagName === "INPUT" && (el.type === "time" || el.type === "date"));
  if (picker && window.matchMedia?.(TOUCH_QUERY).matches) return;
  el.focus({ preventScroll: true });
  // Suchfeld einer Liste: der Cursor bleibt am Ende des Getippten
  if (el.dataset?.lsearch) {
    try {
      el.setSelectionRange(el.value.length, el.value.length);
    } catch (err) {
      // Feldart ohne Auswahl: nichts zu tun
    }
  }
}

// Für Text und Attribute: auch Anführungszeichen, sonst bricht ein Wert mit
// " das Attribut ab (abgeschnittene Texte, eingeschleuste Attribute).
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
// Fehler von callWS: HA wirft nicht immer einen Error. Verbindungsfehler
// kommen als Zahl (ERR_CONNECTION_LOST = 3), als Ereignis oder als Objekt
// ohne Text; früher stand dann "[object Object]" im Panel (Fehlerbericht des
// Nutzers, 2026-10-03, nach dem Aufwachen des Handys).
const WS_ERRORS = { 1: "Verbindung nicht möglich", 2: "Anmeldung ungültig", 3: "Verbindung verloren", 4: "Host fehlt" };
function errText(err) {
  if (err == null) return "";
  if (typeof err === "string") return err;
  if (typeof err === "number") return WS_ERRORS[err] || `Fehler ${err}`;
  if (typeof err.message === "string" && err.message) return err.message;
  if (typeof err.code === "number") return WS_ERRORS[err.code] || `Fehler ${err.code}`;
  if (typeof err.code === "string") return err.code;
  if (typeof err.type === "string") return err.type;
  return "unbekannter Fehler";
}
// Ist die Verbindung zu HA weg (Handy im Ruhezustand, WLAN-Wechsel)? Dann hilft
// ein erneuter Versuch, kein Fehlerbild.
function isConnectionError(err) {
  if (err == null) return true;
  if (typeof err === "number") return true;
  if (typeof err.code === "number") return true;
  if (typeof err.message !== "string") return true;
  return /connection|closed|disconnect|network|timeout|failed to fetch|load failed/i.test(err.message);
}

function escape(value) {
  return (value == null ? "" : String(value)).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

// Kleiner Markdown-Umsetzer für die Release Notes (CHANGELOG im Stil Keep a Changelog): Überschriften,
// Listen mit Fortsetzungszeilen, Absätze, Codeblöcke, `Code`, **fett** und https-Links. HTML aus der Quelle
// wird nie übernommen: erst escapen, dann nur die bekannten Auszeichnungen ersetzen.
function inlineMd(text) {
  return String(text)
    .split(/(`[^`]+`)/)
    .map((part) =>
      part.length > 2 && part.startsWith("`") && part.endsWith("`")
        ? `<code>${escape(part.slice(1, -1))}</code>`
        : escape(part)
            .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
            .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    )
    .join("");
}

function releaseMarkdownHtml(markdown) {
  let html = "";
  let list = null;
  let para = [];
  let code = null;
  const flushPara = () => {
    if (para.length) html += `<p>${inlineMd(para.join(" "))}</p>`;
    para = [];
  };
  const flushList = () => {
    if (list) html += `<ul>${list.map((x) => `<li>${inlineMd(x)}</li>`).join("")}</ul>`;
    list = null;
  };
  for (const raw of String(markdown || "").replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (/^\s*```/.test(line)) {
      if (code) {
        html += `<pre>${escape(code.join("\n"))}</pre>`;
        code = null;
      } else {
        flushPara();
        flushList();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    let m;
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if ((m = line.match(/^#{1,6}\s+(.*)$/))) {
      flushPara();
      flushList();
      html += `<h4>${inlineMd(m[1])}</h4>`;
    } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      flushPara();
      (list ||= []).push(m[1]);
    } else if (list && /^\s+\S/.test(line)) {
      list[list.length - 1] += ` ${line.trim()}`;
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  if (code) html += `<pre>${escape(code.join("\n"))}</pre>`;
  flushPara();
  flushList();
  return html;
}

// --- Symbole (Material Design Icons als Pfad, Funkarten als Strichzeichnung)
const MDI = {
  plus: "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z",
  search: "M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z",
  wifi: "M12,21L15.6,16.2C14.6,15.45 13.35,15 12,15C10.65,15 9.4,15.45 8.4,16.2L12,21M12,3C7.95,3 4.21,4.34 1.2,6.6L3,9C5.5,7.12 8.62,6 12,6C15.38,6 18.5,7.12 21,9L22.8,6.6C19.79,4.34 16.05,3 12,3M12,9C9.3,9 6.81,9.89 4.8,11.4L6.6,13.8C8.1,12.67 9.97,12 12,12C14.03,12 15.9,12.67 17.4,13.8L19.2,11.4C17.19,9.89 14.7,9 12,9Z",
  ble: "M14.88,16.29L13,18.17V14.41M13,5.83L14.88,7.71L13,9.58M17.71,7.71L12,2H11V9.58L6.41,5L5,6.41L10.59,12L5,17.58L6.41,19L11,14.41V22H12L17.71,16.29L13.41,12L17.71,7.71Z",
  cloud: "M6.5,20Q4.22,20 2.61,18.43 1,16.85 1,14.58 1,12.63 2.17,11.1 3.35,9.57 5.25,9.15 5.88,6.85 7.75,5.43 9.63,4 12,4 14.93,4 16.96,6.04 19,8.07 19,11 20.73,11.2 21.86,12.5 23,13.78 23,15.5 23,17.38 21.69,18.69 20.38,20 18.5,20Z",
  lan: "M7,15H9V18H11V15H13V18H15V15H17V18H18V9H15V6H9V9H6V18H7V15M4.38,3H19.63C20.94,3 22,4.06 22,5.38V19.63A2.37,2.37 0 0,1 19.63,22H4.38C3.06,22 2,20.94 2,19.63V5.38C2,4.06 3.06,3 4.38,3Z",
  battery: "M16,20H8V6H16M16.67,4H15V2H9V4H7.33A1.33,1.33 0 0,0 6,5.33V20.67C6,21.4 6.6,22 7.33,22H16.67A1.33,1.33 0 0,0 18,20.67V5.33C18,4.6 17.4,4 16.67,4Z",
  batteryCharging: "M11,20V14.5H9L13,7V12.5H15M16.67,4H15V2H9V4H7.33A1.33,1.33 0 0,0 6,5.33V20.67C6,21.4 6.6,22 7.33,22H16.67A1.33,1.33 0 0,0 18,20.67V5.33C18,4.6 17.4,4 16.67,4Z",
  signal: "M3,21H6V18H3M8,21H11V14H8M13,21H16V9H13M18,21H21V3H18V21Z",
  update: "M21,10.12H14.22L16.96,7.3C14.23,4.6 9.81,4.5 7.08,7.2C4.35,9.91 4.35,14.28 7.08,17C9.81,19.7 14.23,19.7 16.96,17C18.32,15.65 19,14.08 19,12.1H21C21,14.08 20.12,16.65 18.36,18.39C14.85,21.87 9.15,21.87 5.64,18.39C2.14,14.92 2.11,9.28 5.62,5.81C9.13,2.34 14.76,2.34 18.27,5.81L21,3V10.12M12.5,8V12.25L16,14.33L15.28,15.54L11,13V8H12.5Z",
  alert: "M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z",
  pencil: "M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z",
  copy: "M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z",
  trash: "M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z",
  play: "M8,5.14V19.14L19,12.14L8,5.14Z",
  arrowLeft: "M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z",
  download: "M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z",
  upload: "M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z",
  arrowRight: "M4,11V13H16L10.5,18.5L11.92,19.92L19.84,12L11.92,4.08L10.5,5.5L16,11H4Z",
  close: "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
  gear: "M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z",
  verOk: "M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z",
  refreshAuto: "M12.68 6H11.32L7 16H9L9.73 14H14.27L15 16H17L12.68 6M10.3 12.5L12 8L13.7 12.5H10.3M17.4 20.4L19 22H14V17L16 19C18.39 17.61 20 14.95 20 12C20 7.59 16.41 4 12 4S4 7.59 4 12C4 14.95 5.61 17.53 8 18.92V21.16C4.47 19.61 2 16.1 2 12C2 6.5 6.5 2 12 2S22 6.5 22 12C22 15.53 20.17 18.62 17.4 20.4Z",
  verUp: "M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M12 7L17 12H14V16H10V12H7L12 7Z",
  verCheck: "M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z",
  verDownload: "M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z",
  flask: "M5,19A1,1 0 0,0 6,20H18A1,1 0 0,0 19,19C19,18.79 18.93,18.59 18.82,18.43L13,8.35V4H11V8.35L5.18,18.43C5.07,18.59 5,18.79 5,19M6,22A3,3 0 0,1 3,19C3,18.4 3.18,17.84 3.5,17.37L9,7.81V6A1,1 0 0,1 8,5V4A2,2 0 0,1 10,2H14A2,2 0 0,1 16,4V5A1,1 0 0,1 15,6V7.81L20.5,17.37C20.82,17.84 21,18.4 21,19A3,3 0 0,1 18,22H6M13,16L14.34,14.66L16.27,18H7.73L10.39,13.39L13,16M12.5,12A0.5,0.5 0 0,1 13,12.5A0.5,0.5 0 0,1 12.5,13A0.5,0.5 0 0,1 12,12.5A0.5,0.5 0 0,1 12.5,12Z",
  power: "M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13",
  reset: "M12,4C14.1,4 16.1,4.8 17.6,6.3C20.7,9.4 20.7,14.5 17.6,17.6C15.8,19.5 13.3,20.2 10.9,19.9L11.4,17.9C13.1,18.1 14.9,17.5 16.2,16.2C18.5,13.9 18.5,10.1 16.2,7.7C15.1,6.6 13.5,6 12,6V10.6L7,5.6L12,0.6V4M6.3,17.6C3.7,15 3.3,11 5.1,7.9L6.6,9.4C5.5,11.6 5.9,14.4 7.8,16.2C8.3,16.7 8.9,17.1 9.6,17.4L9,19.4C8,19 7.1,18.4 6.3,17.6Z",
  info: "M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z",
  cols: "M16,5V18H21V5M4,18H9V5H4M10,18H15V5H10V18Z",
  log: "M4,4H20A2,2 0 0,1 22,6V18A2,2 0 0,1 20,20H4A2,2 0 0,1 2,18V6A2,2 0 0,1 4,4M4,6V18H20V6H4M6,8H18V10H6V8M6,11H18V13H6V11M6,14H14V16H6V14Z",
  sort: "M9,3L5,7H8V14H10V7H13M16,17V10H14V17H11L15,21L19,17H16Z",
  arrowUp: "M13,20H11V8L5.5,13.5L4.08,12.08L12,4.16L19.92,12.08L18.5,13.5L13,8V20Z",
  arrowDown: "M11,4H13V16L18.5,10.5L19.92,11.92L12,19.84L4.08,11.92L5.5,10.5L11,16V4Z",
  check: "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z",
  save: "M15,9H5V5H15M12,19A3,3 0 0,1 9,16A3,3 0 0,1 12,13A3,3 0 0,1 15,16A3,3 0 0,1 12,19M17,3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7L17,3Z",
  drag: "M9,3H11V5H9V3M13,3H15V5H13V3M9,7H11V9H9V7M13,7H15V9H13V7M9,11H11V13H9V11M13,11H15V13H13V11M9,15H11V17H9V15M13,15H15V17H13V15M9,19H11V21H9V19M13,19H15V21H13V19Z",
  tune: "M8 13C6.14 13 4.59 14.28 4.14 16H2V18H4.14C4.59 19.72 6.14 21 8 21S11.41 19.72 11.86 18H22V16H11.86C11.41 14.28 9.86 13 8 13M8 19C6.9 19 6 18.1 6 17C6 15.9 6.9 15 8 15S10 15.9 10 17C10 18.1 9.1 19 8 19M19.86 6C19.41 4.28 17.86 3 16 3S12.59 4.28 12.14 6H2V8H12.14C12.59 9.72 14.14 11 16 11S19.41 9.72 19.86 8H22V6H19.86M16 9C14.9 9 14 8.1 14 7C14 5.9 14.9 5 16 5S18 5.9 18 7C18 8.1 17.1 9 16 9Z",
  filter: "M6,13H18V11H6M3,6V8H21V6M10,18H14V16H10V18Z",
  pin: "M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z",
  chevronRight: "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z",
  closeCircle: "M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z",
  lock: "M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z",
  sparkle: "M12,1L9,9L1,12L9,15L12,23L15,15L23,12L15,9L12,1Z",
  send: "M2,21L23,12L2,3V10L17,12L2,14V21Z",
  heart: "M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.42 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.42 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z",
  star: "M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z",
  starOutline: "M12,15.39L8.24,17.66L9.23,13.38L5.91,10.5L10.29,10.13L12,6.1L13.71,10.13L18.09,10.5L14.77,13.38L15.76,17.66M22,9.24L14.81,8.63L12,2L9.19,8.63L2,9.24L7.45,13.97L5.82,21L12,17.27L18.18,21L16.54,13.97L22,9.24Z",
  heartOutline: "M12.1,18.55L12,18.65L11.89,18.55C7.14,14.24 4,11.39 4,8.5C4,6.5 5.5,5 7.5,5C9.04,5 10.54,6 11.07,7.36H12.93C13.46,6 14.96,5 16.5,5C18.5,5 20,6.5 20,8.5C20,11.39 16.86,14.24 12.1,18.55M16.5,3C14.76,3 13.09,3.81 12,5.08C10.91,3.81 9.24,3 7.5,3C4.42,3 2,5.41 2,8.5C2,12.27 5.4,15.36 10.55,20.03L12,21.35L13.45,20.04C18.6,15.36 22,12.27 22,8.5C22,5.41 19.58,3 16.5,3Z",
  signalOff: "M18,3V16.18L21,19.18V3H18M4.28,5L3,6.27L10.73,14H8V21H11V14.27L13,16.27V21H16V19.27L19.73,23L21,21.72L4.28,5M13,9V11.18L16,14.18V9H13M3,18V21H6V18H3Z",
  flash: "M7,2V13H10V22L17,10H13L17,2H7Z",
  timer: "M12,20A7,7 0 0,1 5,13A7,7 0 0,1 12,6A7,7 0 0,1 19,13A7,7 0 0,1 12,20M19.03,7.39L20.45,5.97C20,5.46 19.55,5 19.04,4.56L17.62,6C16.07,4.74 14.12,4 12,4A9,9 0 0,0 3,13A9,9 0 0,0 12,22C17,22 21,17.97 21,13C21,10.88 20.26,8.93 19.03,7.39M11,14H13V8H11M15,1H9V3H15V1Z",
  bell: "M21,19V20H3V19L5,17V11C5,7.9 7.03,5.17 10,4.29C10,4.19 10,4.1 10,4A2,2 0 0,1 12,2A2,2 0 0,1 14,4C14,4.1 14,4.19 14,4.29C16.97,5.17 19,7.9 19,11V17L21,19M14,21A2,2 0 0,1 12,23A2,2 0 0,1 10,21",
  bellOff: "M20.84,22.73L18.11,20H3V19L5,17V11C5,9.86 5.29,8.73 5.83,7.72L1.11,3L2.39,1.73L22.11,21.46L20.84,22.73M19,15.8V11C19,7.9 16.97,5.17 14,4.29C14,4.19 14,4.1 14,4A2,2 0 0,0 12,2A2,2 0 0,0 10,4C10,4.1 10,4.19 10,4.29C9.39,4.47 8.8,4.74 8.26,5.09L19,15.8M12,23A2,2 0 0,0 14,21H10A2,2 0 0,0 12,23Z",
  batteryOff: "M22.11 21.46L2.39 1.73L1.11 3L6 7.89V20.67C6 21.4 6.6 22 7.33 22H16.67C17.4 22 18 21.4 18 20.67V19.89L20.84 22.73L22.11 21.46M16 18H8V9.89L16 17.89V18M8.2 4H9V2H15V4H16.67C17.4 4 18 4.6 18 5.33V15.8L16 13.8V6H10.2L8.2 4Z",
  chevronDown: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  puzzle: "M20.5,11H19V7C19,5.89 18.1,5 17,5H13V3.5A2.5,2.5 0 0,0 10.5,1A2.5,2.5 0 0,0 8,3.5V5H4A2,2 0 0,0 2,7V10.8H3.5C5,10.8 6.2,12 6.2,13.5C6.2,15 5 16.2 3.5,16.2H2V20A2,2 0 0,0 4,22H7.8V20.5C7.8,19 9,17.8 10.5,17.8C12,17.8 13.2,19 13.2,20.5V22H17A2,2 0 0,0 19,20V16H20.5A2.5,2.5 0 0,0 23,13.5A2.5,2.5 0 0,0 20.5,11Z",
  open: "M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z",
  chevron: "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z",
  pulse: "M3,13H5.79L10.1,4.79L11.28,13.75L14.5,9.66L17.83,13H21V15H17L14.67,12.67L9.92,18.73L8.94,11.31L7,15H3V13Z",
  eyeOff:
    "M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.08L19.73,22L21,20.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C21.07,15.5 22.27,13.86 23,12C21.27,7.61 17,4.5 12,4.5C10.6,4.5 9.26,4.75 8,5.2L10.17,7.35C10.74,7.13 11.35,7 12,7Z",
  home: "M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z",
  eye: "M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z",
  // App-Launcher (seit 2.31.0)
  apps: "M3 11H11V3H3M5 5H9V9H5M13 21H21V13H13M15 15H19V19H15M3 21H11V13H3M5 15H9V19H5M13 3V11H21V3M19 9H15V5H19Z",
  robot: "M17.5 15.5C17.5 16.61 16.61 17.5 15.5 17.5S13.5 16.61 13.5 15.5 14.4 13.5 15.5 13.5 17.5 14.4 17.5 15.5M8.5 13.5C7.4 13.5 6.5 14.4 6.5 15.5S7.4 17.5 8.5 17.5 10.5 16.61 10.5 15.5 9.61 13.5 8.5 13.5M23 15V18C23 18.55 22.55 19 22 19H21V20C21 21.11 20.11 22 19 22H5C3.9 22 3 21.11 3 20V19H2C1.45 19 1 18.55 1 18V15C1 14.45 1.45 14 2 14H3C3 10.13 6.13 7 10 7H11V5.73C10.4 5.39 10 4.74 10 4C10 2.9 10.9 2 12 2S14 2.9 14 4C14 4.74 13.6 5.39 13 5.73V7H14C17.87 7 21 10.13 21 14H22C22.55 14 23 14.45 23 15M21 16H19V14C19 11.24 16.76 9 14 9H10C7.24 9 5 11.24 5 14V16H3V17H5V20H19V17H21V16Z",
  palette: "M12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2C17.5,2 22,6 22,11A6,6 0 0,1 16,17H14.2C13.9,17 13.7,17.2 13.7,17.5C13.7,17.6 13.8,17.7 13.8,17.8C14.2,18.3 14.4,18.9 14.4,19.5C14.5,20.9 13.4,22 12,22M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C12.3,20 12.5,19.8 12.5,19.5C12.5,19.3 12.4,19.2 12.4,19.1C12,18.6 11.8,18.1 11.8,17.5C11.8,16.1 12.9,15 14.3,15H16A4,4 0 0,0 20,11C20,7.1 16.4,4 12,4M6.5,10C7.3,10 8,10.7 8,11.5C8,12.3 7.3,13 6.5,13C5.7,13 5,12.3 5,11.5C5,10.7 5.7,10 6.5,10M9.5,6C10.3,6 11,6.7 11,7.5C11,8.3 10.3,9 9.5,9C8.7,9 8,8.3 8,7.5C8,6.7 8.7,6 9.5,6M14.5,6C15.3,6 16,6.7 16,7.5C16,8.3 15.3,9 14.5,9C13.7,9 13,8.3 13,7.5C13,6.7 13.7,6 14.5,6M17.5,10C18.3,10 19,10.7 19,11.5C19,12.3 18.3,13 17.5,13C16.7,13 16,12.3 16,11.5C16,10.7 16.7,10 17.5,10Z",
  script: "M15,20A1,1 0 0,0 16,19V4H8A1,1 0 0,0 7,5V16H5V5A3,3 0 0,1 8,2H19A3,3 0 0,1 22,5V6H20V5A1,1 0 0,0 19,4A1,1 0 0,0 18,5V9L18,19A3,3 0 0,1 15,22H5A3,3 0 0,1 2,19V18H13A2,2 0 0,0 15,20M9,6H14V8H9V6M9,10H14V12H9V10M9,14H14V16H9V14Z",
  tools: "M13.78 15.3L19.78 21.3L21.89 19.14L15.89 13.14L13.78 15.3M17.5 10.1C17.11 10.1 16.69 10.05 16.36 9.91L4.97 21.25L2.86 19.14L10.27 11.74L8.5 9.96L7.78 10.66L6.33 9.25V12.11L5.63 12.81L2.11 9.25L2.81 8.55H5.62L4.22 7.14L7.78 3.58C8.95 2.41 10.83 2.41 12 3.58L9.89 5.74L11.3 7.14L10.59 7.85L12.38 9.63L14.2 7.75C14.06 7.42 14 7 14 6.63C14 4.66 15.56 3.11 17.5 3.11C18.09 3.11 18.61 3.25 19.08 3.53L16.41 6.2L17.91 7.7L20.58 5.03C20.86 5.5 21 6 21 6.63C21 8.55 19.45 10.1 17.5 10.1Z",
  history: "M9 17H7V10H9V17M13 17H11V7H13V17M17 17H15V13H17V17M19 19H5V5H19V19.1M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3Z",
  logbook: "M7,5H21V7H7V5M7,13V11H21V13H7M4,4.5A1.5,1.5 0 0,1 5.5,6A1.5,1.5 0 0,1 4,7.5A1.5,1.5 0 0,1 2.5,6A1.5,1.5 0 0,1 4,4.5M4,10.5A1.5,1.5 0 0,1 5.5,12A1.5,1.5 0 0,1 4,13.5A1.5,1.5 0 0,1 2.5,12A1.5,1.5 0 0,1 4,10.5M7,19V17H21V19H7M4,16.5A1.5,1.5 0 0,1 5.5,18A1.5,1.5 0 0,1 4,19.5A1.5,1.5 0 0,1 2.5,18A1.5,1.5 0 0,1 4,16.5Z",
  devices: "M3 6H21V4H3C1.9 4 1 4.9 1 6V18C1 19.1 1.9 20 3 20H7V18H3V6M13 12H9V13.78C8.39 14.33 8 15.11 8 16C8 16.89 8.39 17.67 9 18.22V20H13V18.22C13.61 17.67 14 16.88 14 16S13.61 14.33 13 13.78V12M11 17.5C10.17 17.5 9.5 16.83 9.5 16S10.17 14.5 11 14.5 12.5 15.17 12.5 16 11.83 17.5 11 17.5M22 8H16C15.5 8 15 8.5 15 9V19C15 19.5 15.5 20 16 20H22C22.5 20 23 19.5 23 19V9C23 8.5 22.5 8 22 8M21 18H17V10H21V18Z",
  shape: "M11,13.5V21.5H3V13.5H11M9,15.5H5V19.5H9V15.5M12,2L17.5,11H6.5L12,2M12,5.86L10.08,9H13.92L12,5.86M17.5,13C20,13 22,15 22,17.5C22,20 20,22 17.5,22C15,22 13,20 13,17.5C13,15 15,13 17.5,13M17.5,15A2.5,2.5 0 0,0 15,17.5A2.5,2.5 0 0,0 17.5,20A2.5,2.5 0 0,0 20,17.5A2.5,2.5 0 0,0 17.5,15Z",
  bolt: "M11 15H6L13 1V9H18L11 23V15Z",
  map: "M20.5,3L20.34,3.03L15,5.1L9,3L3.36,4.9C3.15,4.97 3,5.15 3,5.38V20.5A0.5,0.5 0 0,0 3.5,21L3.66,20.97L9,18.9L15,21L20.64,19.1C20.85,19.03 21,18.85 21,18.62V3.5A0.5,0.5 0 0,0 20.5,3M10,5.47L14,6.87V18.53L10,17.13V5.47M5,6.46L8,5.45V17.15L5,18.31V6.46M19,17.54L16,18.55V6.86L19,5.7V17.54Z",
  camera: "M6.03 12.03L8.03 15.5L5.5 18.68L2 12.62L6.03 12.03M17 18V15.29C17.88 14.9 18.5 14.03 18.5 13C18.5 12.43 18.3 11.9 17.97 11.5L19.94 10.35C20.95 9.76 21.3 8.47 20.71 7.46L19.33 5.06C18.74 4.05 17.45 3.7 16.44 4.28L8.31 9C7.36 9.53 7.03 10.75 7.58 11.71L9.08 14.31C9.63 15.26 10.86 15.59 11.81 15.04L13.69 13.96C13.94 14.55 14.41 15.03 15 15.29V18C15 19.1 15.9 20 17 20H22V18H17Z",
  web: "M16.36,14C16.44,13.34 16.5,12.68 16.5,12C16.5,11.32 16.44,10.66 16.36,10H19.74C19.9,10.64 20,11.31 20,12C20,12.69 19.9,13.36 19.74,14M14.59,19.56C15.19,18.45 15.65,17.25 15.97,16H18.92C17.96,17.65 16.43,18.93 14.59,19.56M14.34,14H9.66C9.56,13.34 9.5,12.68 9.5,12C9.5,11.32 9.56,10.65 9.66,10H14.34C14.43,10.65 14.5,11.32 14.5,12C14.5,12.68 14.43,13.34 14.34,14M12,19.96C11.17,18.76 10.5,17.43 10.09,16H13.91C13.5,17.43 12.83,18.76 12,19.96M8,8H5.08C6.03,6.34 7.57,5.06 9.4,4.44C8.8,5.55 8.35,6.75 8,8M5.08,16H8C8.35,17.25 8.8,18.45 9.4,19.56C7.57,18.93 6.03,17.65 5.08,16M4.26,14C4.1,13.36 4,12.69 4,12C4,11.31 4.1,10.64 4.26,10H7.64C7.56,10.66 7.5,11.32 7.5,12C7.5,12.68 7.56,13.34 7.64,14M12,4.03C12.83,5.23 13.5,6.57 13.91,8H10.09C10.5,6.57 11.17,5.23 12,4.03M18.92,8H15.97C15.65,6.75 15.19,5.55 14.59,4.44C16.43,5.07 17.96,6.34 18.92,8M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z",
  link: "M10.59,13.41C11,13.8 11,14.44 10.59,14.83C10.2,15.22 9.56,15.22 9.17,14.83C7.22,12.88 7.22,9.71 9.17,7.76V7.76L12.71,4.22C14.66,2.27 17.83,2.27 19.78,4.22C21.73,6.17 21.73,9.34 19.78,11.29L18.29,12.78C18.3,11.96 18.17,11.14 17.89,10.36L18.36,9.88C19.54,8.71 19.54,6.81 18.36,5.64C17.19,4.46 15.29,4.46 14.12,5.64L10.59,9.17C9.41,10.34 9.41,12.24 10.59,13.41M13.41,9.17C13.8,8.78 14.44,8.78 14.83,9.17C16.78,11.12 16.78,14.29 14.83,16.24V16.24L11.29,19.78C9.34,21.73 6.17,21.73 4.22,19.78C2.27,17.83 2.27,14.66 4.22,12.71L5.71,11.22C5.7,12.04 5.83,12.86 6.11,13.65L5.64,14.12C4.46,15.29 4.46,17.19 5.64,18.36C6.81,19.54 8.71,19.54 9.88,18.36L13.41,14.83C14.59,13.66 14.59,11.76 13.41,10.59C13,10.2 13,9.56 13.41,9.17Z",
  phone: "M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1Z",
  store: "M18.36 9L18.96 12H5.04L5.64 9H18.36M20 4H4V6H20V4M20 7H4L3 12V14H4V20H14V14H18V20H20V14H21V12L20 7M6 18V14H12V18H6Z",
  calendar: "M7 11H9V13H7V11M21 5V19C21 20.11 20.11 21 19 21H5C3.89 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H6V1H8V3H16V1H18V3H19C20.11 3 21 3.9 21 5M5 7H19V5H5V7M19 19V9H5V19H19M15 13V11H17V13H15M11 13V11H13V13H11M7 15H9V17H7V15M15 17V15H17V17H15M11 17V15H13V17H11Z",
  bar: "M22,21H2V3H4V19H6V10H10V19H12V6H16V19H18V14H22V21Z",
  wrench: "M22.61,19L13.53,9.91C14.46,7.57 14,4.81 12.09,2.91C9.79,0.61 6.21,0.4 3.66,2.26L7.5,6.11L6.08,7.5L2.25,3.69C0.39,6.23 0.6,9.82 2.9,12.11C4.76,13.97 7.47,14.46 9.79,13.59L18.9,22.7C19.29,23.09 19.92,23.09 20.31,22.7L22.61,20.4C23,20 23,19.39 22.61,19M19.61,20.59L10.15,11.13C9.54,11.58 8.86,11.85 8.15,11.95C6.79,12.15 5.36,11.74 4.32,10.7C3.37,9.76 2.93,8.5 3,7.26L6.09,10.35L10.33,6.11L7.24,3C8.5,2.95 9.73,3.39 10.68,4.33C11.76,5.41 12.17,6.9 11.92,8.29C11.8,9 11.5,9.66 11.04,10.25L20.5,19.7L19.61,20.59Z",
  desktop: "M21,16H3V4H21M21,2H3C1.89,2 1,2.89 1,4V16A2,2 0 0,0 3,18H10V20H8V22H16V20H14V18H21A2,2 0 0,0 23,16V4C23,2.89 22.1,2 21,2Z",
};
// Zusammengesetztes Symbol (seit 2.85.0): Auge mit kleinem Zahnrad für "Ansicht" (Einstellungen der Ansicht), das Zahnrad schneidet das Auge aus.
// Beginnt ein Eintrag mit "<", ist er fertiges SVG-Innenleben (siehe mdiPath), sonst ein einzelner Pfad.
MDI.viewSettings = `<defs><mask id="dp-vs-mask"><rect width="24" height="24" fill="#fff"/><circle cx="17.7" cy="17.5" r="6.4" fill="#000"/></mask></defs><g mask="url(#dp-vs-mask)"><path fill="currentColor" transform="translate(-0.5 -1.6) scale(.92)" d="${MDI.eye}"/></g><path fill="currentColor" transform="translate(11.5 11.3) scale(.52)" d="${MDI.gear}"/>`;
// Gerätetypen (devices.DEVICE_TYPES), gleiche Schlüssel wie im Backend.
const TYPE_ICONS = {
  phone: "M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1Z",
  valve: "M4 22H2V2H4M22 2H20V22H22M17.24 5.34L13.24 9.34A3 3 0 0 0 9.24 13.34L5.24 17.34L6.66 18.76L10.66 14.76A3 3 0 0 0 14.66 10.76L18.66 6.76Z",
  energy: "M7,2V13H10V22L17,10H13L17,2H7Z",
  network: "M5 9C3.9 9 3 9.9 3 11V15C3 16.11 3.9 17 5 17H11V19H10C9.45 19 9 19.45 9 20H2V22H9C9 22.55 9.45 23 10 23H14C14.55 23 15 22.55 15 22H22V20H15C15 19.45 14.55 19 14 19H13V17H19C20.11 17 21 16.11 21 15V11C21 9.9 20.11 9 19 9H5M6 12H8V14H6V12M9.5 12H11.5V14H9.5V12M13 12H15V14H13V12Z",
  hub: "M9,2V8H11V11H5C3.89,11 3,11.89 3,13V16H1V22H7V16H5V13H11V16H9V22H15V16H13V13H19V16H17V22H23V16H21V13C21,11.89 20.11,11 19,11H13V8H15V2H9Z",
  climate: "M16.95,16.95L14.83,14.83C15.55,14.1 16,13.1 16,12C16,11.26 15.79,10.57 15.43,10L17.6,7.81C18.5,9 19,10.43 19,12C19,13.93 18.22,15.68 16.95,16.95M12,5C13.57,5 15,5.5 16.19,6.4L14,8.56C13.43,8.21 12.74,8 12,8A4,4 0 0,0 8,12C8,13.1 8.45,14.1 9.17,14.83L7.05,16.95C5.78,15.68 5,13.93 5,12A7,7 0 0,1 12,5M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12C22,6.47 17.5,2 12,2Z",
  lock: "M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z",
  cover: "M3 4H21V8H19V20H17V8H7V20H5V8H3V4M8 9H16V11H8V9M8 12H16V14H8V12M8 15H16V17H8V15M8 18H16V20H8V18Z",
  vacuum: "M12,2C14.65,2 17.19,3.06 19.07,4.93L17.65,6.35C16.15,4.85 14.12,4 12,4C9.88,4 7.84,4.84 6.35,6.35L4.93,4.93C6.81,3.06 9.35,2 12,2M3.66,6.5L5.11,7.94C4.39,9.17 4,10.57 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,10.57 19.61,9.17 18.88,7.94L20.34,6.5C21.42,8.12 22,10.04 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12C2,10.04 2.58,8.12 3.66,6.5M12,6A6,6 0 0,1 18,12C18,13.59 17.37,15.12 16.24,16.24L14.83,14.83C14.08,15.58 13.06,16 12,16C10.94,16 9.92,15.58 9.17,14.83L7.76,16.24C6.63,15.12 6,13.59 6,12A6,6 0 0,1 12,6M12,8A1,1 0 0,0 11,9A1,1 0 0,0 12,10A1,1 0 0,0 13,9A1,1 0 0,0 12,8Z",
  camera: "M6.03 12.03L8.03 15.5L5.5 18.68L2 12.62L6.03 12.03M17 18V15.29C17.88 14.9 18.5 14.03 18.5 13C18.5 12.43 18.3 11.9 17.97 11.5L19.94 10.35C20.95 9.76 21.3 8.47 20.71 7.46L19.33 5.06C18.74 4.05 17.45 3.7 16.44 4.28L8.31 9C7.36 9.53 7.03 10.75 7.58 11.71L9.08 14.31C9.63 15.26 10.86 15.59 11.81 15.04L13.69 13.96C13.94 14.55 14.41 15.03 15 15.29V18C15 19.1 15.9 20 17 20H22V18H17Z",
  alarm: "M6,6.9L3.87,4.78L5.28,3.37L7.4,5.5L6,6.9M13,1V4H11V1H13M20.13,4.78L18,6.9L16.6,5.5L18.72,3.37L20.13,4.78M4.5,10.5V12.5H1.5V10.5H4.5M19.5,10.5H22.5V12.5H19.5V10.5M6,20H18A2,2 0 0,1 20,22H4A2,2 0 0,1 6,20M12,5A6,6 0 0,1 18,11V19H6V11A6,6 0 0,1 12,5Z",
  media: "M10,16.5V7.5L16,12M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z",
  display: "M21,16H3V4H21M21,2H3C1.89,2 1,2.89 1,4V16A2,2 0 0,0 3,18H10V20H8V22H16V20H14V18H21A2,2 0 0,0 23,16V4C23,2.89 22.1,2 21,2Z",
  fan: "M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11M12.5,2C17,2 17.11,5.57 14.75,6.75C13.76,7.24 13.32,8.29 13.13,9.22C13.61,9.42 14.03,9.73 14.35,10.13C18.05,8.13 22.03,8.92 22.03,12.5C22.03,17 18.46,17.1 17.28,14.73C16.78,13.74 15.72,13.3 14.79,13.11C14.59,13.59 14.28,14 13.88,14.34C15.87,18.03 15.08,22 11.5,22C7,22 6.91,18.42 9.27,17.24C10.25,16.75 10.69,15.71 10.89,14.79C10.4,14.59 9.97,14.27 9.65,13.87C5.96,15.85 2,15.07 2,11.5C2,7 5.56,6.89 6.74,9.26C7.24,10.25 8.29,10.68 9.22,10.87C9.41,10.39 9.73,9.97 10.14,9.65C8.15,5.96 8.94,2 12.5,2Z",
  light: "M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z",
  outlet: "M7.5,10.5A1.5,1.5 0 0,1 9,12A1.5,1.5 0 0,1 7.5,13.5C6.66,13.5 6,12.83 6,12A1.5,1.5 0 0,1 7.5,10.5M16.5,10.5A1.5,1.5 0 0,1 18,12A1.5,1.5 0 0,1 16.5,13.5A1.5,1.5 0 0,1 15,12A1.5,1.5 0 0,1 16.5,10.5M4.22,2H19.78C21,2 22,3 22,4.22V19.78A2.22,2.22 0 0,1 19.78,22H4.22C3,22 2,21 2,19.78V4.22A2.22,2.22 0 0,1 4.22,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4Z",
  switch: "M18.4 1.6C18 1.2 17.5 1 17 1H7C6.5 1 6 1.2 5.6 1.6C5.2 2 5 2.5 5 3V21C5 21.5 5.2 22 5.6 22.4C6 22.8 6.5 23 7 23H17C17.5 23 18 22.8 18.4 22.4C18.8 22 19 21.5 19 21V3C19 2.5 18.8 2 18.4 1.6M16 7C16 7.6 15.6 8 15 8H9C8.4 8 8 7.6 8 7V5C8 4.4 8.4 4 9 4H15C15.6 4 16 4.4 16 5V7Z",
  motion: "M10,0.2C9,0.2 8.2,1 8.2,2C8.2,3 9,3.8 10,3.8C11,3.8 11.8,3 11.8,2C11.8,1 11,0.2 10,0.2M15.67,1A7.33,7.33 0 0,0 23,8.33V7A6,6 0 0,1 17,1H15.67M18.33,1C18.33,3.58 20.42,5.67 23,5.67V4.33C21.16,4.33 19.67,2.84 19.67,1H18.33M21,1A2,2 0 0,0 23,3V1H21M7.92,4.03C7.75,4.03 7.58,4.06 7.42,4.11L2,5.8V11H3.8V7.33L5.91,6.67L2,22H3.8L6.67,13.89L9,17V22H10.8V15.59L8.31,11.05L9.04,8.18L10.12,10H15V8.2H11.38L9.38,4.87C9.08,4.37 8.54,4.03 7.92,4.03Z",
  contact: "M12,3C10.89,3 10,3.89 10,5H3V19H2V21H22V19H21V5C21,3.89 20.11,3 19,3H12M12,5H19V19H12V5M5,11H7V13H5V11Z",
  safety: "M12,18A6,6 0 0,0 18,12C18,8.68 15.31,6 12,6C8.68,6 6,8.68 6,12A6,6 0 0,0 12,18M19,3A2,2 0 0,1 21,5V19A2,2 0 0,1 19,21H5C3.89,21 3,20.1 3,19V5C3,3.89 3.89,3 5,3H19M8,12A4,4 0 0,1 12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12Z",
  sensor: "M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z",
  button: "M13 5C15.21 5 17 6.79 17 9C17 10.5 16.2 11.77 15 12.46V11.24C15.61 10.69 16 9.89 16 9C16 7.34 14.66 6 13 6S10 7.34 10 9C10 9.89 10.39 10.69 11 11.24V12.46C9.8 11.77 9 10.5 9 9C9 6.79 10.79 5 13 5M20 20.5C19.97 21.32 19.32 21.97 18.5 22H13C12.62 22 12.26 21.85 12 21.57L8 17.37L8.74 16.6C8.93 16.39 9.2 16.28 9.5 16.28H9.7L12 18V9C12 8.45 12.45 8 13 8S14 8.45 14 9V13.47L15.21 13.6L19.15 15.79C19.68 16.03 20 16.56 20 17.14V20.5M20 2H4C2.9 2 2 2.9 2 4V12C2 13.11 2.9 14 4 14H8V12L4 12L4 4H20L20 12H18V14H20V13.96L20.04 14C21.13 14 22 13.09 22 12V4C22 2.9 21.11 2 20 2Z",
  other: "M11,13.5V21.5H3V13.5H11M12,2L17.5,11H6.5L12,2M17.5,13C20,13 22,15 22,17.5C22,20 20,22 17.5,22C15,22 13,20 13,17.5C13,15 15,13 17.5,13Z",
};
// Reihenfolge wie const.DEVICE_TYPES im Backend.
const TYPE_ORDER = ["hub", "phone", "network", "climate", "lock", "cover", "valve", "vacuum", "camera", "alarm", "media", "display", "fan", "light", "outlet", "switch", "motion", "contact", "safety", "energy", "sensor", "button", "other"];
const mdiPath = (d, size) =>
  `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${d.startsWith("<") ? d : `<path fill="currentColor" d="${d}"/>`}</svg>`;
const mdi = (name, size = 18) => mdiPath(MDI[name], size);
const typeIcon = (type, size = 18) => mdiPath(TYPE_ICONS[type] || TYPE_ICONS.other, size);
const typeKey = (type) => (TYPE_ICONS[type] ? `type${type[0].toUpperCase()}${type.slice(1)}` : "typeOther");
const stroke = (d, size) =>
  `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const CONN = {
  zigbee: { key: "connZigbee", icon: (s) => stroke(`<circle cx="12" cy="12" r="9.2"/><path d="M8 8.2h8l-8 7.6h8"/>`, s) },
  thread: { key: "connThread", icon: (s) => stroke(`<circle cx="12" cy="12" r="9.2"/><path d="M12 19V9.5a2.6 2.6 0 0 1 5.2 0c0 1.5-1.2 2.6-2.6 2.6H6.8"/>`, s) },
  zwave: { key: "connZwave", icon: (s) => stroke(`<path d="M5 7h9l-9 10h9"/><path d="M16 9.5c1.6 1.4 1.6 3.6 0 5M18.6 7.5c2.8 2.5 2.8 6.5 0 9"/>`, s) },
  matter: { key: "connMatter", icon: (s) => stroke(`<circle cx="12" cy="6" r="2.4"/><circle cx="6" cy="17" r="2.4"/><circle cx="18" cy="17" r="2.4"/><path d="M12 8.4v4.2M10.2 13.6 7.8 15.4M13.8 13.6l2.4 1.8"/>`, s) },
  ble: { key: "connBle", icon: (s) => mdi("ble", s) },
  wifi: { key: "connWifi", icon: (s) => mdi("wifi", s) },
  ethernet: { key: "connEthernet", icon: (s) => mdi("lan", s) },
  network: { key: "connNetwork", icon: (s) => mdi("lan", s) },
  cloud: { key: "connCloud", icon: (s) => mdi("cloud", s) },
  unknown: { key: "connUnknown", icon: (s) => stroke(`<circle cx="12" cy="12" r="9.2"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6M12 16.8v.2"/>`, s) },
};
const MATTER_TYPES = { thread: "thread", wifi: "wifi", ethernet: "ethernet" };
// Rolle im Thread-Netz aus matter/node_diagnostics (node_type; Werte des
// Matter-Servers: end_device, sleepy_end_device, routing_end_device für Router
// und Leader, bridge, unknown). Nur diese drei zeigt das Popup, der Rest
// bleibt weg (nichts raten).
const THREAD_ROLES = { routing_end_device: "roleRouter", end_device: "roleEnd", sleepy_end_device: "roleSleepy" };
// Wählbar von Hand (Popup): alle ausser "unbekannt" (Fall ohne Erkennung).
const CONN_MANUAL = Object.keys(CONN).filter((k) => k !== "unknown");

const LOGO = `<svg width="30" height="30" viewBox="22 22 212 212" aria-hidden="true"><defs><linearGradient id="dpg" x1="28" y1="20" x2="228" y2="236" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7ADFFD"/><stop offset=".5" stop-color="#22A9F9"/><stop offset="1" stop-color="#1C7DF9"/></linearGradient></defs><path d="M60 44 H112 A84 84 0 0 1 112 212 H60 Z" fill="none" stroke="url(#dpg)" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/><path d="M86 128 H104 L118 94 L136 164 L150 128 H168" fill="none" stroke="url(#dpg)" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
// Kleines Logo für die Vorschau einer Push-Meldung.
// Easter Egg (seit 2.89.0): Zahl der Klicks aufs Logo und Dauer des Herzschlags
// Arten "eigene Einstellung pro Gerät" (wie die Schlüssel von get_options.overrides): an einer Stelle, damit keine vergessen wird
// (tests/panel/suites/consistency-e2e.mjs und tests/test_consistency.py prüfen das gegen das Backend)
const RESET_KINDS = ["battery", "notify", "connection", "signal", "offline", "notify_delay", "charge"];
const newResets = () => Object.fromEntries(RESET_KINDS.map((k) => [k, new Set()]));
const EE_TAPS = 5;
const EE_MS = 7400;
const LOGO_SMALL = LOGO.replace('width="30" height="30"', 'width="14" height="14"').replaceAll("dpg", "dpgs");
// Inhalt einer Ausfall-Meldung in fester Reihenfolge (wie const.NOTIFY_FIELDS).
// Zeiten der Auswahl "Ausgefallen nach" pro Integration (Minuten, 1 bis 1440).
const OFFLINE_PRESETS = [1, 2, 5, 10, 15, 30, 60, 120, 360, 720, 1440];
const NOTIFY_FIELDS = ["area", "integration", "connection", "since", "signal", "battery", "model"];
// Inhalt der Batterie-Meldung (options_api.BATTERY_FIELDS, feste Reihenfolge).
const BATTERY_FIELDS = ["battery", "area", "integration", "model"];
// Inhalt der Meldung bei neuen Geräten (seit 1.24.0, const.NEW_FIELDS).
const NEW_FIELDS = ["area", "integration", "connection", "model"];
const UPDATE_KINDS = ["core", "addons", "hacs", "devices"];
// Ruhezeit (seit 2.95.0): Meldungsarten, die sich zurückhalten lassen (wie im Backend, quiet.py), und die Vorgabe je Wochentag
const QUIET_TOPICS = ["outage", "online", "battery", "charge", "new", "updates", "panelupdate", "routines", "status", "magic"];
// Sichern und wiederherstellen (seit 2.98.0): Bereiche der Sicherung wie im Backend (backup.py); Routinen und Magic Push standardmässig aus
const BACKUP_SECTIONS = ["monitor", "display", "devices", "ai", "routines", "magic"];
const BACKUP_DEFAULT = ["monitor", "display", "devices", "ai"];
const QUIET_DAY_DEFAULT = { on: true, from: "22:00", to: "07:00" };
// Abschnitt "Überwachung und Meldungen" (seit 0.34.0): Optionen je Reiter,
// für den Punkt am Reiter und das Etikett "geändert" des Abschnitts.
const MON_TAB_KEYS = {
  overview: ["notify_service", "notify_click_target", "quiet_enabled", "quiet_days", "quiet_mode", "quiet_topics"],
  outage: ["notify_service_outage", "offline_after", "notify_delay", "flaky_outages", "startup_grace", "notify_outage", "notify_online", "notify_group", "notify_group_min", "outage_persistent", "notify_fields", "emoji_outage", "emoji_group", "emoji_online", "reset_offline", "reset_notify_delay", "reset_notify"],
  charge: ["notify_service_charge", "notify_charge", "charge_live", "charge_full", "charge_rise", "charge_stall", "notify_charge_stop", "charge_integrations", "emoji_charge", "emoji_charge_stop", "reset_charge"],
  battery: ["notify_service_battery", "battery_low", "battery_push", "battery_push_mode", "battery_push_time", "battery_push_daily", "battery_persistent", "battery_fields", "emoji_battery", "reset_battery"],
  new: ["notify_service_new", "notify_new", "new_window", "new_persistent", "new_fields", "emoji_new"],
  updates: ["notify_service_updates", "notify_updates", "updates_mode", "updates_time", "updates_window", "updates_repeat", "updates_kinds", "updates_exclude", "updates_include", "emoji_updates"],
  sig: ["signal_low", "reset_signal"],
  integ: ["offline_after_integrations", "notify_delay_integrations", "charge_full_integrations", "charge_rise_integrations", "charge_stall_integrations", "charge_stop_integrations", "charge_live_integrations", "notify_exclude_integrations", "persistent_exclude_integrations", "battery_low_integrations", "battery_push_exclude_integrations", "new_exclude_integrations", "signal_low_integrations"],
};

// Reiter der Abschnitte "Geräte im Panel" und "Darstellung" (seit 1.0.0,
// docs/mockups/content-v1, A) mit den Optionen, die sie ändern.
// Prompt der KI-Einschätzung (Profi-Modus, seit 1.2.0): wie
// ai_prompt.prompt_problem im Backend; das Backend prüft beim Speichern nochmals.
const PROMPT_MAX = 12000;
// Rückfragen zur KI-Einschätzung (seit 2.48.0): so viele je Einschätzung, so lang darf eine Frage sein (wie im Backend)
const AI_ASK_MAX = 3;
// Hinweis "weiter entfernter Empfänger" im Fenster "Empfang" (seit 2.50.0): ab so vielen Prozent der Zeit und so vielen dBm schwächer als der Hauptempfänger
const VIA_FAR_SHARE = 10;
const VIA_FAR_DBM = 10;
const AI_ASK_Q_MAX = 200;
// So lange gilt "Home Assistant startet neu…", wenn die laufende Version gleich
// bleibt (Neustart abgebrochen oder nie gekommen); danach erscheint der Knopf wieder.
const RESTART_WAIT_MS = 5 * 60 * 1000;
// Übrige Filter-Chips, die sich ausblenden lassen (seit 1.11.0, wie const.CHIP_KEYS):
// Schlüssel, Symbol. Die Texte stehen in strings.js (chipOther).
const CHIP_OTHER = [
  ["area", "home"], ["integration", "puzzle"], ["offline", "closeCircle"], ["problems", "alert"], ["batteries", "battery"], ["battery", "battery"],
  ["signal", "signal"], ["update", "update"], ["override", "tune"], ["new", "sparkle"], ["charging", "batteryCharging"], ["favorites", "heart"],
];
// Reihenfolge aller Chips über der Liste (seit 1.13.0, seit 1.14.0 eine Folge,
// wie const.CHIP_ORDER_KEYS): "all", jede Verbindungsart und die übrigen Chips.
const CHIP_TAIL = CHIP_OTHER.map(([k]) => k).filter((k) => k !== "area" && k !== "integration");
// Art eines Chips für die Trenner der Leiste: zwei Chips verschiedener Art
// trennt eine feine Linie. Auswahlfenster (Bereich, Integration), "Alle" mit den
// Verbindungsarten (genau eine aktiv) und "Nur Probleme" mit den Hinweisen.
const chipKind = (key) => (key === "area" || key === "integration" ? "scope" : key === "all" || key in CONN ? "conn" : "tail");
// Standardfolge ohne gespeicherte Folge (seit 1.18.0, nach dem Bildschirmfoto des
// Nutzers): "Alle" ist angeheftet, dann die Hinweise, dann die Verbindungsarten,
// hinten die seltenen Chips.
const CHIP_DEFAULT = [
  "all", "pin", "favorites", "integration", "new", "offline", "problems", "battery", "batteries", "charging", "area",
  "thread", "wifi", "ble", "zigbee", "ethernet", "cloud", "matter", "network", "unknown", "zwave",
  "signal", "update", "override",
];
// Vollständige Folge aus der gespeicherten (leer = Standard): Unbekanntes und
// Doppelte fallen weg. Verbindungsarten ohne Platz (neue Art, ältere Folge)
// kommen nach Anzahl der Geräte (counts: Art -> Zahl; connOrder: Ausgangsfolge
// aus dem Optionsdialog) hinter die letzte Verbindungsart, sonst hinter "Alle";
// übrige fehlende Chips folgen am Ende in der Standardfolge.
function chipOrder(order, connOrder, counts) {
  const types = orderConns(Object.keys(CONN).map((k) => [k, (counts && counts.get(k)) || 0]), connOrder).map(([k]) => k);
  const known = ["pin", "area", "integration", "all", ...Object.keys(CONN), ...CHIP_TAIL];
  const out = (order || []).filter((k, i, a) => known.includes(k) && a.indexOf(k) === i);
  if (!out.length) {
    // Nur eine eigene Folge der Verbindungsarten aus 1.12.0 (ohne chip_order) behält ihre Anordnung.
    if ((connOrder || []).length) return ["pin", "area", "integration", "all", "favorites", ...types, ...CHIP_TAIL.filter((k) => k !== "favorites")];
    return [...CHIP_DEFAULT];
  }
  const missing = types.filter((k) => !out.includes(k));
  if (missing.length) {
    let at = out.reduce((n, k, i) => (k in CONN ? i : n), -1);
    if (at < 0) at = out.indexOf("all");
    if (at < 0) out.push(...missing);
    else out.splice(at + 1, 0, ...missing);
  }
  // Der Chip "Ausgefallen" (seit 1.16.0) fehlt in älteren Folgen: vor "Warnungen".
  if (!out.includes("offline") && out.includes("problems")) out.splice(out.indexOf("problems"), 0, "offline");
  // Das Herz (seit 2.22.0) fehlt in älteren Folgen: gleich nach "Alle", aber hinter dem Anheft-Marker, damit es nicht festklebt.
  if (!out.includes("favorites")) {
    const a = out.indexOf("all"), p = out.indexOf("pin");
    out.splice(p > a && a >= 0 ? p + 1 : a >= 0 ? a + 1 : Math.max(p + 1, 0), 0, "favorites");
  }
  const full = [...out, ...["area", "integration", "all", ...CHIP_TAIL].filter((k) => !out.includes(k))];
  // Der Anheft-Marker fehlt in Folgen vor 1.15.0: ganz vorn, nichts angeheftet.
  return full.includes("pin") ? full : ["pin", ...full];
}
// Chips (Schlüssel -> HTML, leer = erscheint nicht) in der Folge zusammensetzen,
// mit einer feinen Linie zwischen zwei sichtbaren Chips verschiedener Art.
// Angeheftet (seit 1.15.0) sind die sichtbaren Chips vor dem Marker "pin": Im
// Modus "group" (Leiste) stehen sie in einem Block, der auf dem Handy beim
// seitlichen Scrollen links klebt; an der Haftkante steht keine Linie. Im Modus
// "mark" (Vorschau) bleibt alles in einer Reihe, nur ein Pin-Zeichen markiert
// die Kante.
function joinChips(order, parts, mode = "group", mark = "") {
  const pinAt = order.indexOf("pin");
  let html = "";
  let prev = "";
  let open = false;
  order.forEach((key, i) => {
    const part = parts.get(key);
    if (key === "pin" || !part) return;
    const pinned = pinAt >= 0 && i < pinAt;
    if (pinned && !open) {
      if (mode === "group") html += `<span class="chip-pin">`;
      open = true;
    }
    if (!pinned && open) {
      html += mode === "group" ? `</span>` : mark;
      open = false;
      prev = "";
    }
    if (prev && chipKind(prev) !== chipKind(key)) html += `<span class="vsep"></span>`;
    html += part;
    prev = key;
  });
  if (open) html += mode === "group" ? `</span>` : mark;
  return html;
}
// Seit 1.7.0 zusätzlich die Gruppen der Fakten ({facts_area} usw., wie
// ai_prompt.FACT_GROUPS): wer {facts} nicht nutzt, setzt nur Gruppen ein.
const PROMPT_GROUPS = ["device", "history", "previous", "battery", "signal", "integration", "area", "hub", "model"];
const PROMPT_VARS = ["{language}", "{facts}", ...PROMPT_GROUPS.map((g) => `{facts_${g}}`)];
function promptProblem(text) {
  if (text.length > PROMPT_MAX) return ["promptErrLong", PROMPT_MAX];
  const unknown = (text.match(/\{[A-Za-z_][A-Za-z0-9_]*\}/g) || []).find((v) => !PROMPT_VARS.includes(v));
  if (unknown) return ["promptErrUnknown", unknown];
  return PROMPT_VARS.some((v) => v !== "{language}" && text.includes(v)) ? null : ["promptErrNoFacts"];
}
const promptHtml = (text) => escape(text).replace(/\{(language|facts(?:_[a-z]+)?)\}/g, '<span class="pv">{$1}</span>');

// Optionen mit Abweichungen pro Integration ("Alle zurücksetzen" in
// "Überwachung und Meldungen" › "Integrationen", "Alles auf Standard" in der Integration).
// "Voll ab" (seit 1.38.0): feste Stufen und "Eigener Wert"; ein Wert ausserhalb der Stufen gilt als eigener.
const CHARGE_FULL_PRESETS = [100, 95, 90, 80];
const CHARGE_FULL_OWN_START = 85;
const CHARGE_FULL_RANGE = [50, 100];
const INTEG_OWN_MAPS = ["offline_after_integrations", "notify_delay_integrations", "battery_low_integrations", "signal_low_integrations", "charge_full_integrations", "charge_rise_integrations", "charge_stall_integrations", "charge_stop_integrations", "charge_live_integrations"];
// Liste der Integrationen mit Lademeldung (seit 1.32.0 auch hier einstellbar): zurücksetzen = aus, der Standard.
const INTEG_OWN_LISTS = ["notify_exclude_integrations", "persistent_exclude_integrations", "battery_push_exclude_integrations", "new_exclude_integrations", "charge_integrations"];

const SUB_TAB_KEYS = {
  integrations: ["exclude_integrations", "type_integrations", "connection_integrations"],
  types: ["exclude_types"],
  devs: ["exclude_devices"],
  devset: ["reset_connection", "reset_signal", "reset_offline", "reset_notify", "reset_battery", "reset_charge"],
  chips: ["hide_chips", "hide_connections", "connection_order", "chip_order"],
  pstart: ["start_panel", "protocol_max_mb", "protocol_max_entries", "log_max_mb", "log_max_entries"],
  pupdates: ["update_check", "update_check_time", "update_notify", "notify_service_panelupdate", "prerelease", "auto_update"],
};

// Empfang in vier Stufen (gut -> schlecht), Farben wie unifi_dynamic.
function sigLevel(sig) {
  if (!sig || sig.value == null) return null;
  if (sig.kind === "dbm") return sig.value >= -60 ? 4 : sig.value >= -70 ? 3 : sig.value >= WEAK_DBM ? 2 : 1;
  return sig.value >= 150 ? 4 : sig.value >= 100 ? 3 : sig.value > WEAK_LQI ? 2 : 1;
}
function bars(level, dim) {
  if (!level) return "";
  const color = dim ? "var(--dp-text3)" : `var(--dp-tier${level})`;
  const rects = [0, 1, 2, 3]
    .map((i) => `<rect x="${i * 4.4}" y="${11 - (i + 1) * 2.7}" width="3" height="${(i + 1) * 2.7}" rx="1" fill="${i < level ? color : "var(--dp-bar-off)"}"/>`)
    .join("");
  return `<svg class="ic" width="17" height="12" viewBox="0 0 17 12" aria-hidden="true">${rects}</svg>`;
}
const sigText = (sig) => (sig.kind === "dbm" ? `${sig.value} dBm` : `LQI ${sig.value}`);
// Schwelle als Text: negativ = dBm, positiv = LQI.
const sigLimitText = (v) => sigText({ kind: v < 0 ? "dbm" : "lqi", value: v });
// Empfang zum Sortieren: Stufe, dann Wert (dBm und LQI je in ihrem Bereich).
const sigRank = (sig) => {
  const level = sigLevel(sig);
  return level ? level * 1000 + (sig.kind === "dbm" ? sig.value + 200 : sig.value) : null;
};
// Schwelle, die für das Gerät gilt (seit 1.17.0): die eigene am Gerät, sonst die
// der Integration oder der Funkart (vom Backend als signal_default), sonst
// null = fester Standard. "off" heisst: nie schwach.
const sigOwn = (d) => d.signal_setting ?? d.signal_default?.value ?? null;
// Fester Standard der Warnschwelle je Einheit ("schwach unter").
const sigStd = (kind) => (kind === "lqi" ? WEAK_LQI + 1 : WEAK_DBM);
// Schwelle einer Funkart ohne eigene Einstellung (wie options_api.signal_default):
// erst die Integration, dann der globale Wert; eine Zahl gilt nur für die
// passende Einheit (dBm negativ, LQI positiv), "off" für jede.
function sigDefaultOf(global, integ, conn, kind) {
  for (const [source, table] of [["integration", integ], ["global", global]]) {
    const v = table?.[conn];
    if (v == null) continue;
    if (v === "off" || !kind || v < 0 === (kind === "dbm")) return { value: v, source };
  }
  return { value: null, source: null };
}
// Stufe mit der Empfang-Warnung des Geräts (seit 0.21.0, docs/mockups/signal-v1,
// A): "aus" ist nie schwach, eine eigene Schwelle heisst "schwach unter X";
// ohne Einstellung der Standard. Schwach bleibt Stufe 1, sonst mindestens 2.
function devSigLevel(d) {
  const level = sigLevel(d.signal);
  const own = sigOwn(d);
  if (!level || own == null) return level;
  if (own === "off") return Math.max(level, 2);
  return d.signal.value < own ? 1 : Math.max(level, 2);
}
const devWeak = (d) => devSigLevel(d) === 1;
// Zwei Stufen (seit 1.16.0): Ausfall = Gerät offline; Warnung = instabil, Batterie
// niedrig, schwacher Empfang oder keine Daten, ohne Ausfälle. Deaktivierte und
// nicht überwachte Geräte zählen nicht (bewusst abgeschaltet).
const devOffline = (d) => !d.disabled && !d.unmonitored && d.online === false;
const devWarn = (d) => !d.disabled && !d.unmonitored && d.online !== false && (d.online !== true || Boolean(d.flaky) || Boolean(d.battery?.low) || devWeak(d));
// Vorschlag für die eigene Schwelle: 5 dBm bzw. 10 LQI unter dem heutigen
// Wert, im erlaubten Bereich; ohne Wert der Standard.
function sigSuggest(sig) {
  const lqi = sig?.kind === "lqi";
  const [min, max] = lqi ? SIG_LQI_RANGE : SIG_DBM_RANGE;
  const base = sig?.value != null ? sig.value - (lqi ? 10 : 5) : lqi ? WEAK_LQI + 1 : WEAK_DBM;
  return Math.min(max, Math.max(min, Math.round(base)));
}
// Batterie in vier Farbstufen wie der Empfang (seit 0.24.0; Skala vom Nutzer
// Claude überlassen). Rot heisst "schwach" nach der Batterie-Warnung des
// Geräts, genau wie der Chip "Batterie niedrig"; sonst nach Stand: bis 30 %
// orange, bis 50 % gelbgrün, darüber grün. Ohne Prozent: rot oder grün.
function batTier(b) {
  if (!b) return null;
  if (b.low) return 1;
  if (b.level == null) return 4;
  return b.level <= 30 ? 2 : b.level <= 50 ? 3 : 4;
}
// Symbol mit Füllstand (Innenraum des Umrisses von y 6 bis 20) in der Farbe
// der Stufe; ein Rest bleibt sichtbar, 0 % ist leer.
function batIcon(b, size = 14) {
  const tier = batTier(b);
  if (!tier) return mdi("battery", size);
  const pct = b.level != null ? Math.max(0, Math.min(100, b.level)) : b.low ? 10 : 100;
  const h = pct > 0 ? Math.max(1.5, (14 * pct) / 100) : 0;
  return `<svg class="ic bat-ic t${tier}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${MDI.battery}"/>${
    h ? `<rect x="8" y="${(20 - h).toFixed(2)}" width="8" height="${h.toFixed(2)}" fill="currentColor"/>` : ""
  }</svg>`;
}
// Anteil online erst ab 1 Std. Daten, wie im Backend (availability.PCT_MIN_COVERED).
const PCT_MIN_COVERED = 3600;
// Rang für die Sortierung nach Batteriestand: Prozent, "schwach" ohne Zahl
// wie 0 %, Stand unbekannt am Ende.
const batteryRank = (d) => d.battery?.level ?? (d.battery?.low ? 0 : d.battery ? 101 : 102);

function ringSvg(pct, size, width) {
  const r = (size - width) / 2;
  const c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--dp-bar-off)" stroke-width="${width}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--dp-success)" stroke-width="${width}" stroke-linecap="round"
      stroke-dasharray="${((c * pct) / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}

// Kürzel und Farbton für Integrationen ohne eigenes Symbol (wie im Entwurf).
function initials(name) {
  const words = String(name || "").replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const text = words.length > 1 ? words[0][0] + words[1][0] : (words[0] || "?").slice(0, 2);
  return text.toUpperCase();
}
function hue(text) {
  let h = 0;
  for (const c of String(text)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

// Verfügbarkeit 24 Std. als Streifen: 0 online, 1 Unterbruch, 2 keine Daten.
function stripSvg(strip) {
  const rects = strip.map((v, i) => `<rect x="${i * 2}" y="0" width="1.4" height="14" rx=".5" class="s${v}"/>`).join("");
  return `<svg class="strip" width="${strip.length * 2}" height="14" viewBox="0 0 ${strip.length * 2} 14" aria-hidden="true">${rects}</svg>`;
}

// Verbindungsarten [[Art, Anzahl], …] in der eingestellten Reihenfolge
// (Einstellung "Reihenfolge der Chips"); nicht genannte folgen nach Anzahl.
// Ohne Reihenfolge: häufigste zuerst.
function orderConns(entries, order) {
  const byCount = [...entries].sort((a, b) => b[1] - a[1]);
  if (!order || !order.length) return byCount;
  const pos = new Map(order.map((k, i) => [k, i]));
  return byCount.sort((a, b) => (pos.get(a[0]) ?? Infinity) - (pos.get(b[0]) ?? Infinity) || b[1] - a[1]);
}

// Gerät mit eigener Einstellung (Batterie-Warnung oder Meldungen); der Typ
// von Hand zählt nicht dazu (Entscheid des Nutzers).
// Seit 0.17.0 zählt auch die Verbindungsart von Hand (Wunsch des Nutzers:
// so lässt sie sich gesammelt bereinigen).
// Anzahl eigener Einstellungen des Geräts (Zähler am Reiter "Einstellungen"): jede Wahl, die vom Standard abweicht.
const devOwnCount = (d) =>
  [
    d.type_manual,
    d.connection_manual,
    d.offline_setting != null,
    d.notify_delay_setting != null,
    d.battery_setting != null,
    d.signal_setting != null,
    d.charge_setting != null,
    d.charge_full_setting != null,
    d.charge_rise_setting != null,
    d.charge_stall_setting != null,
    d.charge_stop_setting != null,
    d.charge_live_setting != null,
    d.notify_off || (d.notify_mute_until && Date.parse(d.notify_mute_until) > Date.now()),
  ].filter(Boolean).length;
const hasOverride = (d) => d.offline_setting != null || d.notify_delay_setting != null || d.battery_setting != null || Boolean(d.notify_off) || Boolean(d.connection_manual) || d.signal_setting != null;

const defaultView = () => ({
  sort: "default",
  dir: "asc",
  flat: false,
  cols: COLUMNS.map(([k, , on]) => [k, on]),
  fields: CARD_FIELDS.map(([k, , on]) => [k, on]),
  conn: "all",
  problems: false,
  // Filter "Ausgefallen" (seit 1.16.0); mit "Warnungen" zusammen zählt beides (oder).
  offline: false,
  hint: null,
  // Filter "Bereich" (seit 0.23.0): IDs der Bereiche, AREA_NONE = ohne Bereich.
  areas: [],
  // Filter "Integration" (seit 1.9.0): Domains der Integrationen, AREA_NONE = ohne Integration.
  integs: [],
});

// Pseudo-Bereich für Geräte ohne Bereich (eine echte Bereichs-ID beginnt nie
// mit "#").
const AREA_NONE = "#none";

// Gespeicherte Ansicht bereinigen: Unbekanntes fällt weg, neue Spalten
// kommen mit ihrem Standard ans Ende, ungültige Werte auf den Standard.
function sanitizeView(raw) {
  const d = defaultView();
  if (!raw || typeof raw !== "object") return d;
  const order = (saved, defs) => {
    const known = new Set(defs.map(([k]) => k));
    const out = [];
    for (const item of Array.isArray(saved) ? saved : []) {
      if (Array.isArray(item) && known.has(item[0]) && !out.some(([k]) => k === item[0])) out.push([item[0], Boolean(item[1])]);
    }
    for (const [k, , on] of defs) if (!out.some(([x]) => x === k)) out.push([k, on]);
    return out;
  };
  return {
    sort: SORT_KEYS.includes(raw.sort) ? raw.sort : d.sort,
    dir: raw.dir === "desc" ? "desc" : "asc",
    flat: Boolean(raw.flat),
    cols: order(raw.cols, COLUMNS),
    fields: order(raw.fields, CARD_FIELDS),
    conn: raw.conn === "all" || (typeof raw.conn === "string" && CONN[raw.conn]) ? raw.conn : "all",
    problems: Boolean(raw.problems),
    offline: Boolean(raw.offline),
    hint: HINTS.some((h) => h.key === raw.hint) ? raw.hint : null,
    areas: Array.isArray(raw.areas) ? [...new Set(raw.areas.filter((x) => typeof x === "string" && x.length > 0 && x.length <= 64))].sort().slice(0, 500) : [],
    integs: Array.isArray(raw.integs) ? [...new Set(raw.integs.filter((x) => typeof x === "string" && x.length > 0 && x.length <= 64))].sort().slice(0, 500) : [],
  };
}

function sanitizeViews(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  return { desktop: sanitizeView(r.desktop), mobile: sanitizeView(r.mobile), updated: Number(r.updated) || 0 };
}

// Hinweis-Chips: Schlüssel, CSS-Klasse, Symbol, Text und Bedingung.
// "Batterie" zeigt alle Geräte mit Batterie (Überblick über den Stand).
const HINTS = [
  { key: "batteries", cls: "ba", icon: "battery", label: "hintBatteries", test: (d) => Boolean(d.battery || d.has_battery) },
  { key: "charging", cls: "ch", icon: "batteryCharging", label: "hintCharging", test: (d) => Boolean(d.charging) },
  { key: "battery", cls: "b", icon: "battery", label: "hintBattery", test: (d) => Boolean(d.battery?.low) },
  { key: "signal", cls: "s", icon: "signal", label: "hintSignal", test: (d) => devWeak(d) },
  { key: "update", cls: "u", icon: "update", label: "hintUpdate", test: (d) => Boolean(d.update) },
  { key: "override", cls: "o", icon: "tune", label: "hintOverride", test: hasOverride },
  { key: "new", cls: "nw", icon: "sparkle", label: "hintNew", test: (d) => Boolean(d.new) },
  // Favoriten (seit 2.22.0): nur das rote Herz, ohne Text und Zahl; erscheint immer (auch ohne Favoriten), damit man es findet
  { key: "favorites", cls: "fv", icon: "heart", label: "hintFavorites", test: (d) => Boolean(d.fav), bare: true },
];

class DevicePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._devices = [];
    // Favoriten (seit 2.22.0): Geräte-IDs des Benutzers, gespeichert wie die Ansicht in den HA-Benutzerdaten
    this._favs = new Set();
    this._favUpdated = 0;
    this._favDirty = false;
    this._favLoaded = false;
    this._integrations = {};
    this._offset = 0;
    this._serverNow = null;
    this._fetchedAt = null;
    this._loading = true;
    this._error = null;
    this._search = "";
    // Ansicht pro Benutzer; die Filter-Chips (_conn, _problems, _hint)
    // stehen darin, je für Desktop und Handy.
    this._views = { desktop: defaultView(), mobile: defaultView() };
    this._viewUpdated = 0;
    this._viewLoaded = false;
    this._viewDirty = false;
    this._matter = new Map();
    // KI-Einschätzungen je Gerät (nur im Speicher), Option aus der Geräteliste.
    this._ai = new Map();
    // Für welche Geräte die gemerkte letzte KI-Einschätzung schon geholt wurde (seit 2.45.0)
    this._aiLastTried = new Set();
    // Angefangene Rückfrage je Gerät: übersteht einen Neuaufbau des Pop-ups (seit 2.48.0)
    this._aiDraft = new Map();
    // Magic Push (seit 2.6.0): eigener Reiter im Geräte-Popup, verwaltet seinen Stand selbst (magic-push.js)
    this._magic = new MagicPush(this, { escape, mdi, errText, logo: LOGO_SMALL, typeIcon });
    // Routine (seit 2.21.0): eigener Reiter im Geräte-Popup und Abschnitt "Routinen" in den Einstellungen (routines.js)
    this._routines = new RoutineUi(this, { escape, mdi, errText, logo: LOGO_SMALL, typeIcon });
    // App-Launcher (seit 2.31.0): Knopf in der Kopfzeile, Favoriten, eigene Links (apps.js)
    this._apps = new AppLauncher(this, { escape, mdi });
    this._status = new StatusUi(this, { escape, mdi, errText });
    // Protokoll einer Meldung oder Routine (seit 2.104.0): eigenes Fenster, geöffnet von den Knöpfen mit data-proto
    this._protocol = new ProtocolUi(this, { escape, mdi, errText });
    this._aiOn = false;
    this._flakyOutages = 3;
    // Chips der Verbindungsart, die nicht erscheinen (Einstellung "Anzeige").
    this._hideConn = new Set();
    // Weitere ausgeblendete Chips (seit 1.11.0): Schlüssel wie CHIP_KEYS.
    this._hideChips = new Set();
    // Reihenfolge der Chips über der Liste (seit 1.13.0), leer = Standard.
    this._chipOrder = [];
    // Bereiche und Etagen aus HA in ihrer Reihenfolge (Filter "Bereich").
    this._areas = [];
    this._floors = [];
    this._areaQuery = "";
    this._areaOpen = false;
    // Welche Auswahl offen ist (seit 1.9.0): "area" oder "integ"; beide teilen Popover und Blatt.
    this._pickKind = "area";
    this._pulse = null;
    this._incidents = [];
    // Geräte-Popup und Statistik-Fenster
    this._detailId = null;
    this._detail = null;
    this._statRange = null;
    this._hist = null;
    // Einstellungen und Versionsprüfung (wie unifi_dynamic)
    this._settings = null;
    this._version = null;
    this._prerelease = false;
    this._narrowQuery = window.matchMedia(NARROW_QUERY);
    this._loadLocalView();
  }

  // --- Ansicht pro Benutzer -------------------------------------------------

  get _view() {
    return this._views[this._narrowQuery.matches ? "mobile" : "desktop"];
  }

  get _conn() {
    return this._view.conn;
  }

  set _conn(value) {
    this._view.conn = value;
  }

  get _problems() {
    return this._view.problems;
  }

  set _problems(value) {
    this._view.problems = value;
  }

  get _offlineOnly() {
    return this._view.offline;
  }

  set _offlineOnly(value) {
    this._view.offline = value;
  }

  get _hint() {
    return this._view.hint;
  }

  set _hint(value) {
    this._view.hint = value;
  }

  // --- Favoriten (seit 2.22.0) ---------------------------------------------
  // Das Herz im Kopf des Popups; die Geräte-IDs gehören dem Benutzer (HA-Benutzerdaten, lokale Kopie als Rückfall,
  // beim Laden gewinnt der neuere Stand wie bei der Ansicht). Jedes Gerät trägt "fav" für Filter und Herz.
  _applyFavs() {
    for (const d of this._devices) d.fav = this._favs.has(d.id);
  }

  _favData() {
    // aiFold (seit 2.90.0): die KI-Einschätzung im Popup ist zugeklappt, pro Benutzer, im selben Datensatz wie die Favoriten
    return { ids: [...this._favs].sort(), aiFold: Boolean(this._aiFold), updated: this._favUpdated };
  }

  _setFavs(raw) {
    const ids = Array.isArray(raw?.ids) ? raw.ids.filter((x) => typeof x === "string" && x.length > 0 && x.length <= 64) : [];
    this._favs = new Set(ids.slice(0, 5000));
    this._favUpdated = Number(raw?.updated) || 0;
    this._aiFold = raw?.aiFold === true;
    this._applyFavs();
  }

  // KI-Einschätzung zu- oder aufklappen; gespeichert wie die Favoriten (lokal sofort, bei HA verzögert)
  _toggleAiFold() {
    this._aiFold = !this._aiFold;
    this._favUpdated = Date.now();
    this._favDirty = true;
    try {
      window.localStorage.setItem(FAV_KEY, JSON.stringify(this._favData()));
    } catch {
      // Lokale Kopie ist nur ein Rückfall.
    }
    window.clearTimeout(this._favTimer);
    this._favTimer = window.setTimeout(() => this._saveUserFavs(), VIEW_SAVE_DELAY_MS);
    this._renderDevice();
  }

  _loadLocalFavs() {
    try {
      const raw = window.localStorage.getItem(FAV_KEY);
      if (raw) this._setFavs(JSON.parse(raw));
    } catch {
      // Ohne localStorage gilt eine leere Liste bis HA antwortet.
    }
  }

  async _loadUserFavs() {
    let value = null;
    try {
      const result = await this._hass.callWS({ type: "frontend/get_user_data", key: FAV_KEY });
      value = result ? result.value : null;
    } catch (err) {
      console.warn("device-panel: Favoriten von HA nicht verfügbar", err);
      return;
    }
    this._favLoaded = true;
    if (value && !this._favDirty && (Number(value.updated) || 0) >= this._favUpdated) {
      this._setFavs(value);
      try {
        window.localStorage.setItem(FAV_KEY, JSON.stringify(this._favData()));
      } catch {
        // siehe _toggleFav
      }
      this._render();
      this._renderDevice(true);
      return;
    }
    if (this._favUpdated) await this._saveUserFavs();
  }

  async _saveUserFavs() {
    if (!this._hass || !this._favLoaded) return;
    try {
      await this._hass.callWS({ type: "frontend/set_user_data", key: FAV_KEY, value: this._favData() });
      this._favDirty = false;
    } catch (err) {
      console.warn("device-panel: Favoriten nicht bei HA gespeichert", err);
    }
  }

  // --- Lieblings-Routine (seit 2.26.0) ------------------------------------------
  // Der Stern in "Alle Routinen": Routinen mit Stern stehen ganz oben, ihr Gerät aufgeklappt. Gehört dem Benutzer (Benutzerdaten von HA,
  // lokale Kopie als Rückfall, der neuere Stand gewinnt).
  get _rtStars() {
    return (this.__rtStars ||= new Set());
  }

  _rtStarData() {
    return { ids: [...this._rtStars].sort(), updated: this._rtStarUpdated || 0 };
  }

  _setRtStars(raw) {
    const ids = Array.isArray(raw?.ids) ? raw.ids.filter((x) => typeof x === "string" && x.length > 0 && x.length <= 64) : [];
    this.__rtStars = new Set(ids.slice(0, 2000));
    this._rtStarUpdated = Number(raw?.updated) || 0;
  }

  async _loadRtStars() {
    try {
      const raw = window.localStorage.getItem(TSTAR_KEY) || window.localStorage.getItem(LEGACY_TSTAR_KEY);
      if (raw) this._setRtStars(JSON.parse(raw));
      window.localStorage.removeItem(LEGACY_TSTAR_KEY);
    } catch {
      // ohne localStorage: leer, bis HA antwortet
    }
    let value = null;
    let legacy = false;
    try {
      const result = await this._hass.callWS({ type: "frontend/get_user_data", key: TSTAR_KEY });
      value = result ? result.value : null;
      if (!value) {
        const old = await this._hass.callWS({ type: "frontend/get_user_data", key: LEGACY_TSTAR_KEY });
        value = old ? old.value : null;
        legacy = Boolean(value);
      }
    } catch (err) {
      console.warn("device-panel: Lieblings-Routine von HA nicht verfügbar", err);
      return;
    }
    this._rtStarLoaded = true;
    if (value && !this._rtStarDirty && (Number(value.updated) || 0) >= (this._rtStarUpdated || 0)) {
      this._setRtStars(value);
      try {
        window.localStorage.setItem(TSTAR_KEY, JSON.stringify(this._rtStarData()));
      } catch {
        // nur ein Rückfall
      }
      this._renderRtAll?.();
      if (legacy) await this._moveLegacyStars();
      return;
    }
    if (this._rtStarUpdated) await this._saveRtStars();
  }

  // Die Sterne unter dem neuen Namen speichern und den alten Eintrag leeren
  async _moveLegacyStars() {
    await this._saveRtStars();
    try {
      await this._hass.callWS({ type: "frontend/set_user_data", key: LEGACY_TSTAR_KEY, value: null });
    } catch {
      // bleibt dann liegen, schadet nicht
    }
  }

  async _saveRtStars() {
    if (!this._hass || !this._rtStarLoaded) return;
    try {
      await this._hass.callWS({ type: "frontend/set_user_data", key: TSTAR_KEY, value: this._rtStarData() });
      this._rtStarDirty = false;
    } catch (err) {
      console.warn("device-panel: Lieblings-Routine nicht bei HA gespeichert", err);
    }
  }

  _toggleRtStar(id) {
    if (!id) return;
    if (this._rtStars.has(id)) this._rtStars.delete(id);
    else this._rtStars.add(id);
    this._rtStarUpdated = Date.now();
    this._rtStarDirty = true;
    try {
      window.localStorage.setItem(TSTAR_KEY, JSON.stringify(this._rtStarData()));
    } catch {
      // nur ein Rückfall
    }
    window.clearTimeout(this._rtStarTimer);
    this._rtStarTimer = window.setTimeout(() => this._saveRtStars(), VIEW_SAVE_DELAY_MS);
  }

  _toggleFav(id) {
    if (!id) return;
    if (this._favs.has(id)) this._favs.delete(id);
    else this._favs.add(id);
    this._favUpdated = Date.now();
    this._favDirty = true;
    this._applyFavs();
    try {
      window.localStorage.setItem(FAV_KEY, JSON.stringify(this._favData()));
    } catch {
      // Lokale Kopie ist nur ein Rückfall.
    }
    window.clearTimeout(this._favTimer);
    this._favTimer = window.setTimeout(() => this._saveUserFavs(), VIEW_SAVE_DELAY_MS);
    // Zeigt der Filter "Favoriten" und fällt das Gerät heraus, bleibt es im offenen Popup bis zum Schliessen
    this._devForce = true;
    this._renderDevice();
    this._render();
  }

  _loadLocalView() {
    try {
      const raw = window.localStorage.getItem(VIEW_KEY);
      if (raw) this._setViews(JSON.parse(raw));
    } catch {
      // Ohne localStorage (privates Fenster) gilt der Standard bis HA antwortet.
    }
  }

  _setViews(raw) {
    const v = sanitizeViews(raw);
    this._views = { desktop: v.desktop, mobile: v.mobile };
    this._viewUpdated = v.updated;
  }

  _viewData() {
    return { desktop: this._views.desktop, mobile: this._views.mobile, updated: this._viewUpdated };
  }

  // Nach jeder Änderung: lokal sofort, an HA verzögert und gebündelt.
  _saveView() {
    this._viewUpdated = Date.now();
    this._viewDirty = true;
    try {
      window.localStorage.setItem(VIEW_KEY, JSON.stringify(this._viewData()));
    } catch {
      // Lokale Kopie ist nur ein Rückfall.
    }
    window.clearTimeout(this._viewTimer);
    this._viewTimer = window.setTimeout(() => this._saveUserView(), VIEW_SAVE_DELAY_MS);
  }

  async _saveUserView() {
    if (!this._hass || !this._viewLoaded) return;
    try {
      await this._hass.callWS({ type: "frontend/set_user_data", key: VIEW_KEY, value: this._viewData() });
      this._viewDirty = false;
    } catch (err) {
      console.warn("device-panel: Ansicht nicht bei HA gespeichert", err);
    }
  }

  // Stand von HA holen: Er gilt, wenn er mindestens so neu ist wie die
  // lokale Kopie und hier nichts ungespeichert ist; sonst geht die lokale
  // Kopie an HA. Ohne Speicher bei HA bleibt es bei der lokalen Kopie.
  async _loadUserView() {
    let value = null;
    try {
      const result = await this._hass.callWS({ type: "frontend/get_user_data", key: VIEW_KEY });
      value = result ? result.value : null;
    } catch (err) {
      console.warn("device-panel: Ansicht von HA nicht verfügbar", err);
      return;
    }
    this._viewLoaded = true;
    if (value && !this._viewDirty && (Number(value.updated) || 0) >= this._viewUpdated) {
      this._setViews(value);
      try {
        window.localStorage.setItem(VIEW_KEY, JSON.stringify(this._viewData()));
      } catch {
        // siehe _saveView
      }
      this._render();
      return;
    }
    if (this._viewUpdated) await this._saveUserView();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    // Hell oder dunkel für die Stile: im hellen Design sind die Fenster deckend (sonst wirken sie über dem
    // abgedunkelten Hintergrund grau)
    this.toggleAttribute("light", !(hass?.themes?.darkMode ?? window.matchMedia?.("(prefers-color-scheme: dark)").matches));
    if (first) {
      this._build();
      this._loadLocalFavs();
      this._loadUserView();
      this._loadUserFavs();
      this._loadRtStars();
      this._apps.load();
      this._fetch();
      this._brandReady = this._brandStart();
      this._versionDotInit();
    } else {
      // HACS meldet Fortschritt und neue Versionen über seine Update-Entität.
      if (this._settings) this._renderSettingsVersion();
      this._gearDot();
      this._watchEntityStates();
    }
  }

  // Reiter "Schalter" und "Entitäten" des Geräte-Popups lesen den Zustand live aus hass.states. Das Popup baut sich aber nur beim Abfragen
  // (alle 10 s) oder beim Reiterwechsel neu auf; wer in HAs Dialog schaltet und zurückkommt, sah deshalb den alten Zustand (behoben in
  // 2.92.0). Darum: ändert sich Zustand oder Attribut einer Entität des offenen Geräts, wird das Popup sanft neu gezeichnet
  // (sanft = nicht mitten in Berührung oder Eingabe, siehe _dlgBusy).
  _watchEntityStates() {
    if (!this._detailId || !["sw", "ent"].includes(this._devTab)) return;
    const dlg = this.shadowRoot?.querySelector("dialog.device");
    if (!dlg?.open) return;
    const list = this._detail?.id === this._detailId ? this._detail.data?.entities || [] : [];
    const states = this._hass?.states || {};
    // Die Zeichenkette aus Zustand und Attributen: Helligkeit, Position und Ähnliches stehen hinter dem Zustand
    const sig = list.map((e) => { const st = states[e.entity_id]; return st ? `${st.state}|${st.last_updated}` : ""; }).join("\n");
    const key = `${this._detailId}\n${sig}`;
    if (key === this._entSig) return;
    this._entSig = key;
    this._renderDevice(true);
  }

  // Roter Punkt an den Einstellungen (angeheftet am Knopf, sonst am Launcher), solange ein Update installiert ist und der Neustart noch aussteht (seit 2.25.0). Nötig ist die laufende
  // Version vom Server, darum beim Start einmal abfragen (aus dem Zwischenspeicher, kein Aufruf bei GitHub, wenn frisch).
  async _versionDotInit() {
    try {
      const r = await this._hass.callWS({ type: "device_panel/version", force: false, prerelease: true });
      const v = (this._version = this._version || {});
      if (!v.data) v.data = r;
    } catch (_err) {
      /* ohne Antwort kein Punkt */
    }
    this._gearDot(true);
  }

  _gearDot(now = false) {
    // set hass kommt bei jeder Zustandsänderung: höchstens alle 5 Sekunden rechnen
    const t = Date.now();
    if (!now && this._dotAt && t - this._dotAt < 5000) return;
    this._dotAt = t;
    if (!this._version?.data) return;
    const s = this._versionState();
    const on = Boolean(s.restart && !this._version.restarting);
    if (Boolean(this._gearRestart) === on) return;
    // Seit 2.88.0 steht das Zahnrad nicht mehr fest in der Kopfzeile: der Punkt sitzt am angehefteten Knopf der Einstellungen, sonst am
    // Launcher-Knopf (AppLauncher.dotLevels); die Karte "Einstellungen" im Launcher zeigt in jedem Fall die Pille "Neustart"
    this._gearRestart = on;
    this._apps?.paintDots?.();
  }

  connectedCallback() {
    this._timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") this._fetch();
    }, POLL_INTERVAL_MS);
    this._tick = window.setInterval(() => this._hass && this._render(true), TICK_MS);
    this._onVisible = () => document.visibilityState === "visible" && this._wake();
    document.addEventListener("visibilitychange", this._onVisible);
    // Handy wacht auf oder bekommt wieder Netz: sofort neu abfragen.
    this._onWake = () => this._wake();
    window.addEventListener("online", this._onWake);
    window.addEventListener("pageshow", this._onWake);
    window.addEventListener("focus", this._onWake);
    // Wechsel zwischen Desktop und Handy: andere Ansicht, offene Auswahl zu.
    this._onNarrow = () => {
      if (this._settings?.mode === "view") this._closeSettings();
      this._closeAreas();
      this._apps.onNarrow();
      this._render();
    };
    this._narrowQuery.addEventListener("change", this._onNarrow);
    // Kapsel der Reiter nach erneutem Einhängen wieder beobachten
    if (this._segMO) {
      this._segMO.observe(this.shadowRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
      this.shadowRoot.querySelectorAll(".mon-tabs, .sub-tabs").forEach((bar) => delete bar._segSeen);
    }
    // Tipp auf eine Meldung, während das Panel schon offen ist: HA ändert
    // nur die Adresse, das iframe bleibt.
    this._onLocation = () => this._deepLink();
    this._topWindow()?.addEventListener("location-changed", this._onLocation);
  }

  disconnectedCallback() {
    this._segMO?.disconnect();
    this._segRO?.disconnect();
    this._heroObserver?.disconnect();
    this._stickyObserver?.disconnect();
    window.clearInterval(this._timer);
    window.clearInterval(this._tick);
    window.clearInterval(this._logTimer);
    window.clearTimeout(this._logRetry);
    window.clearTimeout(this._devRetry);
    window.clearInterval(this._brandTimer);
    window.clearTimeout(this._brandRetry);
    window.clearTimeout(this._brandRender);
    window.clearTimeout(this._retryTimer);
    document.removeEventListener("visibilitychange", this._onVisible);
    window.removeEventListener("online", this._onWake);
    window.removeEventListener("pageshow", this._onWake);
    window.removeEventListener("focus", this._onWake);
    this._narrowQuery.removeEventListener("change", this._onNarrow);
    this._topWindow()?.removeEventListener("location-changed", this._onLocation);
  }

  _topWindow() {
    try {
      return window.parent || window;
    } catch {
      return null;
    }
  }

  // Deep-Link aus einer Meldung: /device-panel?device=<id> öffnet das Popup.
  // Der Parameter wird danach entfernt, damit Neuladen es nicht erneut öffnet.
  // Reiter als Segmentschalter (seit 2.0.5, docs/mockups/segmented-v1): Die gewählte "Kapsel" ist ein eigenes Element
  // (.seg-pill), das beim Wechsel zum neuen Reiter gleitet. Die Reiterleisten werden bei jedem Aufbau neu gezeichnet;
  // darum merkt sich das Panel je Leiste die letzte Lage der Kapsel und fährt von dort los (FLIP). Ohne Bewegung
  // (Beim ersten Zeichnen, nach Grössenänderung, bei "Bewegung reduzieren") steht die Kapsel sofort am Ziel.
  _initSeg(root) {
    this._segLast = new Map();
    const reduced = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    const keyOf = (bar) => {
      const b = bar.querySelector("button");
      return `${bar.closest("dialog")?.className || "page"}|${b ? b.dataset.set || b.dataset.dlg || b.dataset.prompt || b.dataset.mg || b.dataset.rt || (b.dataset.stRange ? "st-range" : b.dataset.stTab ? "st-tab" : "") || "" : ""}|${b?.dataset.group || ""}`;
    };
    const apply = (pill, r) => {
      pill.style.width = `${r.w}px`;
      pill.style.height = `${r.h}px`;
      pill.style.transform = `translate(${r.x}px, ${r.y}px)`;
    };
    const instant = (pill, r) => {
      pill.style.transition = "none";
      apply(pill, r);
      void pill.offsetWidth;
      pill.style.transition = "";
    };
    const sync = (still = false) => {
      for (const bar of root.querySelectorAll(".mon-tabs, .sub-tabs")) {
        const on = bar.querySelector(".mon-tab.on, .sub-tab.on");
        // Leiste ohne Wahl (Magic Push: eigene Zeit getippt, keine Voreinstellung gilt): keine Kapsel stehen lassen
        if (!on && bar.offsetWidth) {
          bar.querySelector(":scope > .seg-pill")?.remove();
          this._segLast.delete(keyOf(bar));
        }
        if (!on || !bar.offsetWidth) continue; // unsichtbar (Fenster zu): Lage wird beim Öffnen gesetzt
        if (!bar._segSeen) {
          bar._segSeen = true;
          this._segRO.observe(bar);
        }
        bar._segW = bar.offsetWidth;
        const rect = { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight };
        const key = keyOf(bar);
        const prev = this._segLast.get(key);
        let pill = bar.querySelector(":scope > .seg-pill");
        const fresh = !pill;
        if (fresh) {
          pill = document.createElement("i");
          pill.className = "seg-pill";
          pill.setAttribute("aria-hidden", "true");
          bar.appendChild(pill);
        }
        const same = (a, b) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
        const moved = Boolean(prev) && !same(prev, rect);
        // Wird die Leiste mitten in der Fahrt noch einmal neu gezeichnet, startet die Kapsel wieder am ursprünglichen Ausgang.
        const now = Date.now();
        // Mitten in der Fahrt gezeichnet (zum Beispiel weil gleich nach dem Tipp Daten eintreffen): von der echten Lage der alten
        // Kapsel weiterfahren, nicht vom ursprünglichen Ausgang (das sah wie ein Sprung zurück aus).
        const flying = Boolean(prev?.live) && now - prev.t < 340;
        const from = flying ? prev.live : moved ? prev : null;
        const animate = Boolean(from) && !still && !reduced();
        if (!animate) instant(pill, rect);
        else if (fresh) {
          instant(pill, from);
          apply(pill, rect);
        } else apply(pill, rect);
        if (animate) {
          pill.classList.add("go");
          window.clearTimeout(pill._goT);
          pill._goT = window.setTimeout(() => pill.classList.remove("go"), 320);
        }
        const entry = { ...rect, live: null, t: moved ? now : prev?.t || 0 };
        this._segLast.set(key, entry);
        if (animate) {
          // Lage der Kapsel während der Fahrt mitschreiben (Bild für Bild), damit ein Neuzeichnen dort ansetzen kann
          const t0 = performance.now();
          const track = () => {
            if (this._segLast.get(key) !== entry || !pill.isConnected || performance.now() - t0 > 340) {
              if (this._segLast.get(key) === entry) entry.live = null;
              return;
            }
            const m = new DOMMatrixReadOnly(getComputedStyle(pill).transform);
            entry.live = { x: m.m41, y: m.m42, w: pill.offsetWidth, h: pill.offsetHeight };
            window.requestAnimationFrame(track);
          };
          window.requestAnimationFrame(track);
        }
      }
    };
    // Nur bei echter Breitenänderung (Fenster öffnet, Drehen); die erste Meldung beim Beobachten ist keine.
    this._segRO = new ResizeObserver((entries) => {
      // Entfernte (ersetzte) Leisten melden Breite 0: aus der Beobachtung nehmen und nicht beachten.
      for (const e of entries) if (!e.target.isConnected) this._segRO.unobserve(e.target);
      if (entries.some((e) => e.target.isConnected && e.target.offsetWidth > 0 && e.target.offsetWidth !== e.target._segW)) sync(true);
    });
    this._segMO = new MutationObserver((muts) => {
      if (muts.every((m) => m.target.classList?.contains("seg-pill") || [...m.addedNodes, ...m.removedNodes].every((n) => n.classList?.contains("seg-pill")))) return;
      sync();
    });
    this._segMO.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  // Kein Fokusrahmen beim Öffnen eines Fensters per Tipp (showModal fokussiert den ersten Knopf, auf dem Handy wäre das
  // zum Beispiel der Stift am Gerätenamen blau umrandet).
  _blurOnTouch() {
    if (window.matchMedia?.(TOUCH_QUERY).matches) this.shadowRoot.activeElement?.blur();
  }

  _deepLink() {
    const top = this._topWindow();
    if (!top || this._loading || this._error) return;
    let url;
    try {
      url = new URL(top.location.href);
    } catch {
      return;
    }
    const id = url.searchParams.get("device");
    // App aus einer Meldung (seit 2.66.0): /device-panel?app=status öffnet die Status-App, nur für Administratoren
    const app = url.searchParams.get("app");
    // Reiter der Status-App (seit 2.73.0): ?app=status&tab=system öffnet gleich die Kurven (Meldung bei hoher Auslastung)
    const tab = url.searchParams.get("tab");
    if (!id && app !== "status") return;
    url.searchParams.delete("device");
    url.searchParams.delete("app");
    url.searchParams.delete("tab");
    top.history.replaceState(top.history.state, "", url.pathname + url.search + url.hash);
    if (id) this._openDevice(id);
    else if (this._hass?.user?.is_admin !== false) this._status.open(tab || undefined);
  }

  // Zahlen und Uhrzeit im Format der HA-Sprache des Benutzers (z. B. de-CH).
  _locale() {
    return this._hass?.locale?.language || this._hass?.language || undefined;
  }

  _t(key, ...args) {
    const value = STRINGS[pickLang(this._hass)][key];
    return typeof value === "function" ? value(...args) : value;
  }

  _build() {
    this.shadowRoot.innerHTML = `<style>${PANEL_CSS}</style>
      <div class="toolbar"><div class="tb-main">${LOGO}<h1>${escape(this._t("title"))}</h1>
        <label class="searchbox">${mdi("search", 20)}<input class="search" type="search" placeholder="${escape(this._t("search"))}" aria-label="${escape(this._t("search"))}">
          <button type="button" class="search-clear" title="${escape(this._t("searchClear"))}" aria-label="${escape(this._t("searchClear"))}" hidden>${mdi("close", 18)}</button></label></div>
        <button type="button" class="view-btn" aria-expanded="false" title="${escape(this._t("viewBtn"))}" aria-label="${escape(this._t("viewBtn"))}">${mdi("viewSettings", 20)}<span>${escape(this._t("viewBtn"))}</span></button>
        <span class="app-pins"></span><button type="button" class="apps-btn" aria-haspopup="dialog" aria-expanded="false" title="${escape(this._t("appsBtn"))}" aria-label="${escape(this._t("appsBtn"))}">${mdi("apps", 22)}</button>
      </div>
      <div class="area-pop" role="dialog" aria-label="${escape(this._t("areaTitle"))}" hidden></div>
      <div class="content"><div class="hstrip"></div><div class="hero"></div><div class="chips"></div><div class="viewline"></div><div class="list"></div><div class="foot"></div></div>
      <dialog class="device"></dialog><dialog class="magic-dlg"></dialog><dialog class="magic-dlg routine-dlg"></dialog><dialog class="stat-dlg"></dialog><dialog class="settings"></dialog><dialog class="area-sheet"></dialog><dialog class="pulse-dlg"></dialog><dialog class="log-dlg"></dialog><dialog class="log-dlg proto-dlg"></dialog><dialog class="apps-dlg"></dialog><dialog class="app-dlg"></dialog><dialog class="rtall-dlg"></dialog><dialog class="mgall-dlg"></dialog><dialog class="status-dlg"></dialog><dialog class="prompt-dlg"></dialog><dialog class="notes-dlg"></dialog><dialog class="notes-dlg backup-dlg"></dialog><dialog class="discard-dlg"></dialog>
      <div class="toast" role="status" aria-live="polite" hidden></div>`;
    const root = this.shadowRoot;
    this._apps.bind(root);
    // X in jedem Suchfeld (seit 2.63.0): ein Knopf mit data-fc neben dem Feld (_fieldClearHtml) leert es und löst "input" aus, damit die Liste
    // sich wie beim Tippen neu aufbaut; sichtbar ist er nur, solange etwas im Feld steht
    root.addEventListener("input", (ev) => {
      const el = ev.target;
      if (!el.matches?.('input[type="search"]')) return;
      const btn = el.closest("label")?.querySelector("[data-fc]");
      if (btn) btn.hidden = !el.value;
    });
    root.addEventListener("click", (ev) => {
      const btn = ev.target.closest?.("[data-fc]");
      if (!btn) return;
      const field = btn.closest("label")?.querySelector("input");
      if (!field) return;
      ev.preventDefault();
      field.value = "";
      field.dispatchEvent(new Event("input", { bubbles: true }));
      btn.hidden = true;
      field.focus();
    });
    this._apps.renderBar();
    root.querySelector(".toast").addEventListener("click", (ev) => {
      if (!ev.target.closest("[data-toast-action]") || !this._toastAction) return;
      const { run } = this._toastAction;
      this._toastAction = null;
      ev.currentTarget.hidden = true;
      run();
    });
    this._bindSettings(root.querySelector("dialog.settings"));
    this._bindDiscard(root.querySelector("dialog.discard-dlg"));
    const search = root.querySelector(".search");
    const clear = root.querySelector(".search-clear");
    search.addEventListener("input", () => {
      this._search = search.value.trim().toLowerCase();
      clear.hidden = !search.value;
      this._render();
    });
    clear.addEventListener("click", (ev) => {
      // Klick im Label fokussiert sonst das Feld und öffnet auf dem Handy die Tastatur.
      ev.preventDefault();
      search.value = "";
      this._search = "";
      clear.hidden = true;
      this._render();
      if (!window.matchMedia?.(TOUCH_QUERY).matches) search.focus();
    });
    const content = root.querySelector(".content");
    content.addEventListener("click", (ev) => {
      const open = ev.target.closest("[data-open]");
      if (open) {
        this._openDevice(open.dataset.open);
        return;
      }
      const sortBtn = ev.target.closest("[data-sort]");
      if (sortBtn) {
        this._cycleSort(sortBtn.dataset.sort);
        return;
      }
      if (ev.target.closest("[data-view-open]")) {
        this._openView();
        return;
      }
      if (ev.target.closest("[data-area-clear]")) {
        this._setAreas([]);
        return;
      }
      if (ev.target.closest("[data-integ-clear]")) {
        this._setIntegs([]);
        return;
      }
      if (ev.target.closest("[data-pulse-open]")) {
        this._openPulse();
        return;
      }
      // Handy: Zeile "online · ausgefallen" bringt zu den Kacheln zurück.
      if (ev.target.closest("[data-hs-top]")) {
        content.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const pick = ev.target.closest("[data-area-open],[data-integ-open]");
      if (pick) {
        // Gleiche Auswahl erneut: zu; die andere: erst zu, dann deren Auswahl auf.
        const kind = pick.hasAttribute("data-integ-open") ? "integ" : "area";
        const same = this._areaOpen && this._pickKind === kind;
        if (this._areaOpen) this._closeAreas();
        if (!same) this._openAreas(kind);
        return;
      }
      // Zeile unten in der Kachel (seit 1.16.0): nur die Warnungen anzeigen.
      if (ev.target.closest("[data-warn-open]")) {
        this._conn = "all";
        this._hint = null;
        this._offlineOnly = false;
        this._problems = true;
        this._saveView();
        this._render();
        return;
      }
      const el = ev.target.closest("[data-conn],[data-problems],[data-offline],[data-hint]");
      if (!el || el.disabled) return;
      // "Alle" hebt alle Filter auf (seit 0.25.0, Wunsch des Nutzers): Bereich,
      // Verbindungsart, "Ausgefallen", "Warnungen", Hinweis. Die Suche bleibt (eigenes X).
      // Aktiven Chip erneut antippen hebt nur seinen Filter auf.
      if (el.dataset.conn === "all") {
        this._conn = "all";
        this._problems = false;
        this._offlineOnly = false;
        this._hint = null;
        this._view.areas = [];
        this._view.integs = [];
      } else if (el.dataset.conn) this._conn = this._conn === el.dataset.conn ? "all" : el.dataset.conn;
      else if (el.dataset.problems !== undefined) this._problems = !this._problems;
      else if (el.dataset.offline !== undefined) this._offlineOnly = !this._offlineOnly;
      else if (el.dataset.hint) this._hint = this._hint === el.dataset.hint ? null : el.dataset.hint;
      this._saveView();
      this._render();
    });
    root.querySelector(".view-btn").addEventListener("click", () => this._openView());
    // Easter Egg (seit 2.89.0): fünfmal schnell aufs Logo, dann schlägt das Herz im Puls-Diagramm
    root.querySelector(".tb-main > svg")?.addEventListener("click", () => this._logoTap());
    this._bindViewControls(root.querySelector("dialog.settings"));
    this._bindAreas(root.querySelector(".area-pop"), root.querySelector("dialog.area-sheet"));
    this._bindPulse(root.querySelector("dialog.pulse-dlg"));
    this._bindLog(root.querySelector("dialog.log-dlg"));
    this._bindRtAll(root.querySelector("dialog.rtall-dlg"));
    this._bindMagicAll(root.querySelector("dialog.mgall-dlg"));
    this._status.bind(root.querySelector("dialog.status-dlg"));
    this._protocol.bind(root.querySelector("dialog.proto-dlg"));
    root.addEventListener("click", (ev) => {
      const btn = ev.target.closest?.("[data-proto]");
      if (!btn || btn.disabled || this._hass?.user?.is_admin === false) return;
      this._protocol.open({ kind: btn.dataset.proto, itemId: btn.dataset.id || "", deviceId: btn.dataset.device || "", name: btn.dataset.name || "" });
    });
    this._bindPrompt(root.querySelector("dialog.prompt-dlg"));
    this._bindNotes(root.querySelector("dialog.notes-dlg"));
    this._bindBackup(root.querySelector("dialog.backup-dlg"));
    // Auf dem Handy gibt der Browser beim Schliessen eines Fensters den Fokus an die antippte Kachel zurück und zeigt dort einen
    // blauen Ring (zum Beispiel an der Kachel "Ausfall-Puls"). "close" steigt nicht auf, darum in der Einfangphase.
    root.addEventListener("close", () => this._blurOnTouch(), true);
    this._initSeg(root);
    // Zeilen und Karten sind keine Buttons (Tabellensemantik); Tastatur
    // deshalb selbst behandeln.
    // Handy: Kacheln ganz weggescrollt (unter der Zeile oben) -> Zeile zeigen.
    // Die Zeile selbst ist 44 px hoch, darum der Rand oben.
    if (typeof IntersectionObserver === "function") {
      this._heroObserver = new IntersectionObserver(([entry]) => content.classList.toggle("hs-on", !entry.isIntersecting), {
        root: content,
        rootMargin: "-44px 0px 0px 0px",
      });
      this._heroObserver.observe(content.querySelector(".hero"));
    }
    // Kopfzeile der Tabelle klebt unter Zeile, Chips (und Sortierung): deren
    // Höhe wechselt (Chips brechen um), darum messen statt festlegen.
    const chipBar = content.querySelector(".chips");
    chipBar.addEventListener("scroll", () => chipBar.classList.toggle("scrolled", chipBar.scrollLeft > 2), { passive: true });
    if (typeof ResizeObserver === "function") {
      this._stickyObserver = new ResizeObserver(() => this._syncSticky());
      this._stickyObserver.observe(content.querySelector(".chips"));
      this._stickyObserver.observe(content.querySelector(".viewline"));
    }
    content.addEventListener("keydown", (ev) => {
      if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches?.("[data-open]:not(button)")) {
        ev.preventDefault();
        this._openDevice(ev.target.dataset.open);
      } else if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches?.("[data-pulse-open]")) {
        ev.preventDefault();
        this._openPulse();
      }
    });
    const dlg = root.querySelector("dialog.device");
    this._trackBusy(dlg);
    dlg.addEventListener("click", (ev) => this._onDeviceClick(ev));
    this._magic.bind(dlg);
    this._magic.bindWindow(root.querySelector("dialog.magic-dlg"));
    this._routines.bind(dlg);
    this._routines.bindWindow(root.querySelector("dialog.routine-dlg"));
    dlg.addEventListener("input", (ev) => {
      if (this._rename && ev.target.matches?.('input[data-dlg="rename-input"]')) this._rename.value = ev.target.value;
      if (ev.target.matches?.('input[data-dlg="ai-q"]')) this._aiDraft.set(this._detailId, ev.target.value);
      if (ev.target.matches?.('input[data-dlg="dev-search"]')) this._devSearchInput(ev.target);
    });
    dlg.addEventListener("keydown", (ev) => {
      if (ev.target.matches?.('input[data-dlg="ai-q"]') && ev.key === "Enter" && !ev.isComposing) {
        ev.preventDefault();
        this._aiAsk(this._detailId, ev.target.value);
      } else if (ev.target.matches?.('input[data-dlg="rename-input"]') && (ev.key === "Enter" || ev.key === "Escape")) {
        // Enter speichert, Escape verwirft nur das Umbenennen (das Fenster bleibt offen).
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.key === "Enter") this._renameSave(ev.target.value);
        else this._renameCancel();
      } else if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches?.("li[data-dlg]")) {
        ev.preventDefault();
        ev.target.click();
      }
    });
    dlg.addEventListener("change", (ev) => {
      const el = ev.target;
      if (!this._detailId) return;
      if (el.matches?.('select[data-dlg="type"]')) this._setDeviceType(this._detailId, el.value || null);
      else if (el.matches?.('select[data-dlg="conn"]')) this._setDeviceConnection(this._detailId, el.value || null);
      else if (el.matches?.('select[data-dlg="dev-bat"]')) {
        // Eigene Schwelle: mit dem bisher geltenden Wert beginnen, dann anpassen.
        const d = this._devices.find((x) => x.id === this._detailId);
        const pct = d?.battery_default?.pct;
        const value = el.value === "own" ? (Number.isInteger(pct) ? pct : this._batteryLow ?? 15) : el.value === "off" ? "off" : null;
        this._devRangeError = null;
        this._setDeviceSettings(this._detailId, { battery: value });
      } else if (el.matches?.('select[data-dlg="dev-charge"]')) {
        this._setDeviceSettings(this._detailId, { charge: el.value === "on" ? true : el.value === "off" ? false : null });
      } else if (el.matches?.('select[data-dlg="dev-charge-full"]')) {
        // Eigenes "Voll ab" des Geräts (seit 1.35.0): "default" = globaler Wert, "own" = Zahl (Start 85, sonst der bisherige Wert).
        const d = this._devices.find((x) => x.id === this._detailId);
        this._chargeFullRangeError = null;
        const own = Number.isInteger(d?.charge_full_setting) && !CHARGE_FULL_PRESETS.includes(d.charge_full_setting) ? d.charge_full_setting : CHARGE_FULL_OWN_START;
        this._setDeviceSettings(this._detailId, { charge_full: el.value === "default" ? null : el.value === "own" ? own : Number(el.value) });
      } else if (el.matches?.('input[data-dlg="dev-charge-full-val"]')) {
        const v = Number(el.value);
        const [min, max] = CHARGE_FULL_RANGE;
        if (el.value === "" || !Number.isInteger(v) || v < min || v > max) {
          this._chargeFullRangeError = { value: el.value, message: this._t("settingsRange", min, max) };
          this._devForce = true;
          this._renderDevice();
        } else {
          this._chargeFullRangeError = null;
          this._setDeviceSettings(this._detailId, { charge_full: v });
        }
      } else if (el.matches?.('select[data-dlg="dev-charge-rise"]')) {
        // Eigener Anstieg: mit dem globalen Wert beginnen, dann anpassen.
        const d = this._devices.find((x) => x.id === this._detailId);
        this._chargeRangeError = null;
        this._setDeviceSettings(this._detailId, { charge_rise: el.value === "own" ? d?.charge_default?.rise ?? 20 : null });
      } else if (el.matches?.('select[data-dlg="dev-charge-stall"]')) {
        // Eigenes "Ladung beendet nach": mit dem geltenden Wert beginnen, dann anpassen.
        const d = this._devices.find((x) => x.id === this._detailId);
        this._chargeStallRangeError = null;
        this._setDeviceSettings(this._detailId, { charge_stall: el.value === "own" ? d?.charge_default?.stall ?? 15 : null });
      } else if (el.matches?.('input[data-dlg="dev-charge-stall-val"]')) {
        const v = Number(el.value);
        const [min, max] = [Number(el.min), Number(el.max)];
        if (el.value === "" || !Number.isInteger(v) || v < min || v > max) {
          this._chargeStallRangeError = { value: el.value, message: this._t("settingsRange", min, max) };
          this._devForce = true;
          this._renderDevice();
        } else {
          this._chargeStallRangeError = null;
          this._setDeviceSettings(this._detailId, { charge_stall: v });
        }
      } else if (el.matches?.('select[data-dlg="dev-charge-live"]')) {
        this._setDeviceSettings(this._detailId, { charge_live: el.value === "on" ? true : el.value === "off" ? false : null });
      } else if (el.matches?.('select[data-dlg="dev-charge-stop"]')) {
        this._setDeviceSettings(this._detailId, { charge_stop: el.value === "on" ? true : el.value === "off" ? false : null });
      } else if (el.matches?.('input[data-dlg="dev-charge-rise-val"]')) {
        const v = Number(el.value);
        const [min, max] = [Number(el.min), Number(el.max)];
        if (el.value === "" || !Number.isInteger(v) || v < min || v > max) {
          this._chargeRangeError = { value: el.value, message: this._t("settingsRange", min, max) };
          this._devForce = true;
          this._renderDevice();
        } else {
          this._chargeRangeError = null;
          this._setDeviceSettings(this._detailId, { charge_rise: v });
        }
      } else if (el.matches?.('input[data-dlg="dev-bat-pct"]')) {
        const v = Number(el.value);
        const [min, max] = [1, 50];
        // Ausserhalb des Bereichs: nichts senden, Eingabe stehen lassen und
        // den Bereich direkt unter dem Feld nennen.
        if (el.value === "" || !Number.isInteger(v) || v < min || v > max) {
          this._devRangeError = { value: el.value, message: this._t("settingsRange", min, max) };
          this._devForce = true;
          this._renderDevice();
        } else {
          this._devRangeError = null;
          this._setDeviceSettings(this._detailId, { battery: v });
        }
      } else if (el.matches?.('select[data-dlg="dev-off"]')) {
        // Eigene Zeit: mit dem bisher geltenden Wert beginnen (Minuten; war
        // die Integration auf "Nicht überwachen", mit dem globalen Wert).
        const d = this._devices.find((x) => x.id === this._detailId);
        const start = [d?.offline_after, d?.offline_default?.minutes, d?.offline_default?.global].find((v) => Number.isInteger(v)) ?? 2;
        this._offRangeError = null;
        this._setDeviceSettings(this._detailId, { offline: el.value === "own" ? start : el.value === "off" ? "off" : null });
      } else if (el.matches?.('input[data-dlg="dev-off-min"]')) {
        const v = Number(el.value);
        const [min, max] = [1, 1440];
        if (el.value === "" || !Number.isInteger(v) || v < min || v > max) {
          this._offRangeError = { value: el.value, message: this._t("settingsRange", min, max) };
          this._devForce = true;
          this._renderDevice();
        } else {
          this._offRangeError = null;
          this._setDeviceSettings(this._detailId, { offline: v });
        }
      } else if (el.matches?.('select[data-dlg="dev-delay"]')) {
        // Eigene Zeit: mit dem bisher geltenden Wert beginnen (wirksames "Erst melden nach")
        const d = this._devices.find((x) => x.id === this._detailId);
        const start = [d?.notify_delay, d?.notify_delay_default?.minutes].find((v) => Number.isInteger(v)) ?? 2;
        this._delayRangeError = null;
        this._setDeviceSettings(this._detailId, { notify_delay: el.value === "own" ? start : null });
      } else if (el.matches?.('input[data-dlg="dev-delay-min"]')) {
        const v = Number(el.value);
        const [min, max] = [1, 1440];
        if (el.value === "" || !Number.isInteger(v) || v < min || v > max) {
          this._delayRangeError = { value: el.value, message: this._t("settingsRange", min, max) };
          this._devForce = true;
          this._renderDevice();
        } else {
          this._delayRangeError = null;
          this._setDeviceSettings(this._detailId, { notify_delay: v });
        }
      } else if (el.matches?.('select[data-dlg="dev-sig"]')) {
        // Eigene Schwelle: etwas unter dem heutigen Wert vorschlagen (5 dBm
        // bzw. 10 LQI), damit das Gerät nicht mehr als schwach gilt.
        const d = this._devices.find((x) => x.id === this._detailId);
        let value = el.value === "off" ? "off" : null;
        if (el.value === "own") value = sigSuggest(d?.signal);
        this._sigRangeError = null;
        this._setDeviceSettings(this._detailId, { signal: value });
      } else if (el.matches?.('input[data-dlg="dev-sig-val"]')) {
        const v = Number(el.value);
        const [min, max] = [Number(el.min), Number(el.max)];
        if (el.value === "" || !Number.isInteger(v) || v < min || v > max) {
          this._sigRangeError = { value: el.value, message: this._t("settingsRange", min, max) };
          this._devForce = true;
          this._renderDevice();
        } else {
          this._sigRangeError = null;
          this._setDeviceSettings(this._detailId, { signal: v });
        }
      } else if (el.matches?.('select[data-dlg="dev-notify"]') && el.value !== "mute") this._setDeviceSettings(this._detailId, { notify: el.value !== "off" });
    });
    // Escape: mit offenen Änderungen erst fragen (seit 2.20.0)
    dlg.addEventListener("cancel", (ev) => {
      ev.preventDefault();
      this._requestCloseDevice();
    });
    dlg.addEventListener("close", () => {
      if (!dlg.open) this._resetDevice();
    });
    const stat = root.querySelector("dialog.stat-dlg");
    stat.addEventListener("click", (ev) => this._onStatClick(ev));
    stat.addEventListener("pointerover", (ev) => {
      if (ev.pointerType !== "mouse") return;
      const seg = ev.target.closest?.(".avail-bar .seg");
      if (seg) this._showTip(seg.classList.contains("off") ? seg : null);
    });
    stat.addEventListener("pointerout", (ev) => {
      if (ev.pointerType !== "mouse") return;
      const bar = ev.target.closest?.(".avail-bar");
      if (bar && !(ev.relatedTarget && bar.contains(ev.relatedTarget))) this._showTip(null);
    });
    stat.addEventListener("close", () => {
      if (!stat.open) {
        this._statRange = null;
        // Auch bei Escape: X des Popups dahinter wieder zeigen.
        this.removeAttribute("stat-open");
      }
    });
  }

  // Nie zwei Abfragen gleichzeitig. changed: nach einer eigenen Änderung
  // (Verbindungsart, Typ, Einstellungen). Eine Abfrage, die davor begonnen
  // hat, bringt den alten Stand und würde die Änderung überdecken, bis zur
  // nächsten Abfrage (Fehlerbericht: Thread von Hand zeigte wieder Matter).
  // Ihr Ergebnis wird verworfen und sofort neu abgefragt.
  async _fetch(changed = false) {
    if (!this._hass) return;
    if (changed) this._changes = (this._changes || 0) + 1;
    if (this._fetching) return;
    this._fetching = true;
    const seen = this._changes || 0;
    const stale = () => (this._changes || 0) !== seen;
    try {
      const result = await this._callWithTimeout({ type: "device_panel/list_devices" });
      if (stale()) return;
      // Logos vorab laden, damit die erste Darstellung schon vollständig ist.
      await this._brandPreload(result.devices || []);
      if (stale()) return;
      // Welche Geräte gezeigt werden (Dienst-Geräte, deaktivierte, Ausschlüsse),
      // entscheidet das Backend nach den Einstellungen.
      this._devices = result.devices || [];
      this._applyFavs();
      this._reapplyDevDraft();
      this._integrations = result.integrations || {};
      this._flakyOutages = result.flaky_outages || 3;
      this._batteryLow = result.battery_low;
      this._aiOn = result.ai_assessment === true;
      this._hideConn = new Set(result.hide_connections || []);
      this._hideChips = new Set(result.hide_chips || []);
      this._connOrder = result.connection_order || [];
      this._chipOrder = result.chip_order || [];
      this._areas = Array.isArray(result.areas) ? result.areas : [];
      this._floors = Array.isArray(result.floors) ? result.floors : [];
      // Ausgeblendeter Chip mit aktivem Filter: zurück auf "Alle", sonst
      // bliebe ein Filter ohne sichtbaren Chip.
      if (this._hideConn.has(this._conn)) this._conn = "all";
      this._dropHiddenFilters();
      this._pulse = Array.isArray(result.pulse) ? result.pulse : null;
      // Kopfzeile (seit 2.62.0): Debug-Modus und Störungen des Status für die Punkte am Launcher oder an den angehefteten Apps
      this._debugOn = result.debug === true;
      this._statusSum = result.status || { problems: 0, down: 0 };
      this._apps.paintDots();
      this._incidents = result.incidents || [];
      const serverNow = Date.parse(result.now);
      this._offset = Number.isFinite(serverNow) ? serverNow - Date.now() : 0;
      this._serverNow = (Number.isFinite(serverNow) ? serverNow : Date.now()) / 1000;
      this._fetchedAt = new Date();
      this._error = null;
      this._offline = false;
      this._retries = 0;
      this._deepPending = true;
      // HA ist nach dem Neustart wieder da: laufende Version neu lesen.
      if (this._version?.restarting) this._loadVersion(false);
    } catch (err) {
      if (!stale()) {
        if (isConnectionError(err)) {
          // Verbindung weg: Daten behalten, Hinweis zeigen, bald neu versuchen.
          this._offline = true;
          this._error = null;
          this._scheduleRetry();
        } else {
          this._error = errText(err);
        }
      }
    } finally {
      this._fetching = false;
      if (stale()) this._fetch();
      else this._fetched();
    }
  }

  // Nach dem Aufwachen ist die Verbindung oft noch zu: lieber gleich den
  // Hinweis zeigen als einen Fehler, und der Versuch läuft von allein weiter.
  _wake() {
    this._retries = 0;
    this._fetch();
    this._brandWake();
  }

  // callWS ohne Antwort (Verbindung hängt nach dem Aufwachen) würde _fetching
  // für immer besetzen; nach 20 s gilt es als Verbindungsfehler.
  _callWithTimeout(msg, ms = 20000) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = window.setTimeout(() => reject({ code: 3 }), ms);
    });
    return Promise.race([this._hass.callWS(msg), timeout]).finally(() => window.clearTimeout(timer));
  }

  // Erneuter Versuch mit wachsendem Abstand (1, 2, 4, 8 s, dann wie der
  // Abruf alle 10 s); HA baut die Verbindung nach dem Aufwachen selbst wieder auf.
  _scheduleRetry() {
    window.clearTimeout(this._retryTimer);
    const delay = Math.min(1000 * 2 ** (this._retries || 0), POLL_INTERVAL_MS);
    this._retries = (this._retries || 0) + 1;
    this._retryTimer = window.setTimeout(() => this._fetch(), delay);
  }

  _fetched() {
    // Offline und noch nie Daten gehabt: weiter "wird geladen" (mit Hinweis), kein Fehlerbild.
    this._loading = !!this._offline && !this._fetchedAt;
    this._render(true);
    if (this._deepPending) {
      this._deepPending = false;
      this._deepLink();
    }
    this._refineMatter();
    if (this._detailId) {
      this._loadDetail();
      if (this._statRange) this._loadHistory();
    }
  }

  // Matter meldet die Funkart (Thread, WLAN, LAN) über den eigenen
  // Diagnose-Befehl; einzeln nacheinander, damit der Matter-Server nicht
  // mit vielen Anfragen gleichzeitig belastet wird.
  async _refineMatter() {
    if (this._refining) return;
    this._refining = true;
    let changed = false;
    try {
      for (const d of this._devices) {
        // Auch bei Verbindungsart von Hand: für "Automatisch: …" im Popup.
        if ((d.connection_auto !== undefined ? d.connection_auto : d.connection) !== "matter") continue;
        const cached = this._matter.get(d.id);
        if (cached && Date.now() - cached.at < MATTER_REFRESH_MS) continue;
        let type = "matter";
        let role = null;
        let network = null;
        try {
          const diag = await this._hass.callWS({ type: "matter/node_diagnostics", device_id: d.id });
          type = MATTER_TYPES[String(diag?.network_type ?? "").toLowerCase()] || "matter";
          // Rolle nur bei Thread, Netzname bei Thread (Netzname) und WLAN (SSID)
          // (Punkt 4). Zugangsdaten liefert die Diagnose nicht und das Panel
          // zeigt keine.
          if (type === "thread") role = THREAD_ROLES[String(diag?.node_type ?? "").toLowerCase()] || null;
          if (type === "thread" || type === "wifi") {
            const name = typeof diag?.network_name === "string" ? diag.network_name.trim() : "";
            network = name || null;
          }
        } catch (err) {
          // Gerät nicht erreichbar oder Matter-Server weg: Funkart bleibt offen.
        }
        if (cached?.type !== type || cached?.role !== role || cached?.network !== network) changed = true;
        this._matter.set(d.id, { type, role, network, at: Date.now() });
      }
    } finally {
      this._refining = false;
    }
    if (changed) this._render(true);
  }

  // Von Hand gesetzt: genau diese; sonst die der Integration (gilt für alle
  // ihre Geräte, Variante B); sonst die Erkennung, Matter verfeinert.
  _connOf(d) {
    if (d.connection_manual) return CONN[d.connection] ? d.connection : "unknown";
    if (d.connection_integration && CONN[d.connection_integration]) return d.connection_integration;
    return this._connAuto(d);
  }

  _connAuto(d) {
    const auto = d.connection_auto !== undefined ? d.connection_auto : d.connection;
    if (auto === "matter") return this._matter.get(d.id)?.type || "matter";
    return CONN[auto] ? auto : "unknown";
  }

  // --- Formatierung ---------------------------------------------------------

  _fmtSeconds(sec, short = false) {
    const min = Math.max(0, Math.floor(sec / 60));
    if (min < 1) return this._t("underMinute");
    const d = Math.floor(min / 1440);
    const h = Math.floor((min % 1440) / 60);
    const m = min % 60;
    const [du, hu, mu] = [this._t("dayUnit"), this._t("hourUnit"), this._t("minuteUnit")];
    if (d) return short || !h ? `${d} ${du}` : `${d} ${du} ${h} ${hu}`;
    if (h) return short || !m ? `${h} ${hu}` : `${h} ${hu} ${m} ${mu}`;
    return `${m} ${mu}`;
  }

  _duration(iso, short = false) {
    return this._fmtSeconds((Date.now() + this._offset - Date.parse(iso)) / 1000, short);
  }

  // Dauer des Ausfalls, im Tooltip der Beginn (auch über Neustarts von HA).
  _durationHtml(d, short = false) {
    const text = this._duration(d.offline_since, short);
    const at = this._fmtTime(Date.parse(d.offline_since) / 1000, true);
    return d.since_at_least
      ? `<span title="${escape(this._t("sinceAtLeast", at))}">≥ ${escape(text)}</span>`
      : `<span title="${escape(this._t("offlineSinceAt", at))}">${escape(text)}</span>`;
  }

  // Prozent mit einer Stelle, 100 ohne.
  _fmtPct(v) {
    return Number(v).toLocaleString(this._locale(), { minimumFractionDigits: v >= 100 ? 0 : 1, maximumFractionDigits: 1 });
  }

  // Uhrzeit (Epoch-Sekunden), bei längeren Zeiträumen mit Wochentag und Datum.
  // withYear: genaues Datum mit Jahr (Kachel "Hinzugefügt", seit 0.28.0).
  _fmtTime(sec, withDate = false, withYear = false) {
    const opts = withDate
      ? { weekday: "short", day: "numeric", month: "numeric", ...(withYear ? { year: "numeric" } : {}), hour: "2-digit", minute: "2-digit" }
      : { hour: "2-digit", minute: "2-digit" };
    try {
      return new Date(sec * 1000).toLocaleString(this._locale(), opts);
    } catch (err) {
      return new Date(sec * 1000).toISOString();
    }
  }

  _fmtDate(sec) {
    try {
      return new Date(sec * 1000).toLocaleDateString(this._locale(), { day: "numeric", month: "short" });
    } catch (err) {
      return new Date(sec * 1000).toISOString().slice(0, 10);
    }
  }

  _fmtDateY(sec) {
    try {
      return new Date(sec * 1000).toLocaleDateString(this._locale(), { day: "numeric", month: "short", year: "numeric" });
    } catch (err) {
      return new Date(sec * 1000).toISOString().slice(0, 10);
    }
  }

  // Dauer in Tagen als Text: Tage bis 45, Monate bis 1 Jahr, danach Jahre und Monate ("2 Jahre 11 Monate", seit 2.52.0).
  _fmtSpan(days) {
    const t = (k, ...a) => this._t(k, ...a);
    if (days > 1825) return t("batFcOver5");
    if (days < 45) return t("batFcDays", Math.max(1, Math.round(days)));
    const months = Math.round(days / 30.44);
    if (months < 12) return t("batFcMonths", months);
    return t("batFcYears", Math.floor(months / 12), months % 12);
  }

  // Prognose-Block im Batterie-Verlauf (seit 1.5.0). Unabhängig vom
  // gewählten Zeitraum: das Backend rechnet immer über höchstens 365 Tage.
  _batForecastHtml(fc, charging = false) {
    if (!fc || !fc.status) return "";
    // Mit aktiver Lademeldung ist ein Anstieg ein Ladevorgang, kein Batteriewechsel (seit 2.30.0): eigene Wortwahl "seit dem Laden"
    const c = charging ? "C" : "";
    const t = (k, ...a) => this._t(k + (k.startsWith("batFc") && k.endsWith("Change") ? c : ""), ...a);
    const zero = !!fc.target_is_zero;
    const note = `<p class="bh-fc-note">${escape(t("batFcNote"))}</p>`;
    const wrap = (cls, inner) => `<div class="bh-fc ${cls}"><div class="bh-fc-h">${escape(t("batFcTitle"))}</div>${inner}${note}</div>`;
    if (fc.status === "none") return "";
    if (fc.status === "short") {
      const msg = fc.after_change ? t("batFcShortChange", fc.days_used, fc.min_days) : t("batFcShortAll", fc.days_used, fc.min_days);
      return wrap("muted", `<p class="bh-fc-sub">${escape(msg)}</p>`);
    }
    if (fc.status === "flat") return wrap("muted", `<p class="bh-fc-sub">${escape(t("batFcFlat"))}</p>`);
    if (fc.status === "reached") return wrap("warn", `<p class="bh-fc-main">${escape(zero ? t("batFcReachedZero") : t("batFcReached", fc.target))}</p>`);
    const sub = zero ? t("batFcTargetZero", this._fmtDateY(fc.at)) : t("batFcTarget", fc.target, this._fmtDateY(fc.at));
    const lo = this._fmtSpan(fc.days_low);
    const range = fc.days_high == null ? t("batFcRangeMin", lo) : t("batFcRange", lo, this._fmtSpan(fc.days_high));
    const basis = fc.after_change ? t("batFcBasisChange", this._fmtDateY(fc.since), fc.days_used) : t("batFcBasisAll", fc.days_used);
    const conf = ["high", "medium", "low"].includes(fc.confidence) ? fc.confidence : "low";
    return wrap(
      fc.accelerating ? "accel" : "",
      `<div class="bh-fc-main">${escape(t("batFcLeft", this._fmtSpan(fc.days)))}</div>
       <p class="bh-fc-sub">${escape(sub)}</p>
       <div class="bh-fc-meta"><span>${escape(range)}</span><span class="bh-fc-conf ${conf}">${escape(t("batFcConf", conf))}</span><span>${escape(t("batFcRate", this._fmtPct(fc.per_month)))}</span></div>
       <p class="bh-fc-basis">${escape(basis)}</p>
       ${fc.accelerating ? `<p class="bh-fc-warn">${escape(t("batFcAccel"))}</p>` : ""}`
    );
  }

  // Beschriftete Marken auf ganzen Stunden bzw. Mitternacht (wie
  // unifi_dynamic). "minor" blendet das schmale Layout aus.
  _ticks(start, end, mode) {
    const span = end - start;
    const zoom = mode === "zoom";
    let step = 3;
    if (zoom) {
      const hours = span / 3600;
      if (hours <= 36) {
        mode = "24h";
        step = hours <= 4 ? 1 : hours <= 10 ? 2 : hours <= 20 ? 3 : 6;
      } else {
        mode = hours <= 8 * 24 ? "7d" : "30d";
      }
    }
    const ticks = [];
    const d = new Date(start * 1000);
    if (mode === "24h") {
      d.setMinutes(0, 0, 0);
      d.setHours(d.getHours() + 1);
      for (; d.getTime() < end * 1000; d.setHours(d.getHours() + 1)) {
        const h = d.getHours();
        if (h % step) continue;
        ticks.push({ at: d.getTime() / 1000, label: `${String(h).padStart(2, "0")}:00`, minor: h % (step * 2) !== 0 });
      }
    } else {
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 1);
      for (; d.getTime() < end * 1000; d.setDate(d.getDate() + 1)) {
        if (mode === "7d") {
          ticks.push({ at: d.getTime() / 1000, label: d.toLocaleDateString(this._locale(), { weekday: "short" }), minor: false });
        } else if (mode === "90d") {
          if (d.getDate() === 1) ticks.push({ at: d.getTime() / 1000, label: d.toLocaleDateString(this._locale(), { month: "long" }), minor: false });
        } else if (mode === "180d" || mode === "365d") {
          // 6 und 12 Monate (seit 0.29.0): Monat kurz am Ersten; bei 12 Monaten jeder zweite klein (auf dem Handy ausgeblendet).
          if (d.getDate() === 1) ticks.push({ at: d.getTime() / 1000, label: d.toLocaleDateString(this._locale(), { month: "short" }), minor: mode === "365d" && d.getMonth() % 2 === 1 });
        } else if (d.getDate() % 5 === 0 && d.getDate() !== 30) {
          ticks.push({ at: d.getTime() / 1000, label: d.toLocaleDateString(this._locale(), { day: "numeric", month: "numeric" }), minor: d.getDate() % 10 !== 0 });
        }
      }
    }
    // Nicht zu nah an "jetzt" (rechts) und an der Startzeit (links beim Zoom).
    const minPos = zoom ? 16 : 5;
    return ticks.map((tk) => ({ ...tk, pos: ((tk.at - start) / span) * 100 })).filter((tk) => tk.pos > minPos && tk.pos < 82);
  }

  _integName(d) {
    const dom = d.integration?.domain || d.integrations?.[0];
    return dom ? this._integrations[dom] || dom : "";
  }

  // Eintragstitel nur, wenn er mehr sagt als der Name der Integration.
  _integTitle(d) {
    const title = d.integration?.title;
    return title && title !== this._integName(d) ? title : "";
  }

  // Ausgeblendete Chips (seit 1.11.0, Wunsch des Nutzers) heben ihren Filter
  // auf: "Ausgefallen", "Warnungen", der Hinweis, Bereich und Integration. Gespeichert
  // wird nur, wenn sich etwas ändert.
  _dropHiddenFilters() {
    const hide = this._hideChips;
    let changed = false;
    if (hide.has("problems") && this._problems) {
      this._problems = false;
      changed = true;
    }
    if (hide.has("offline") && this._offlineOnly) {
      this._offlineOnly = false;
      changed = true;
    }
    if (this._hint && hide.has(this._hint)) {
      this._hint = null;
      changed = true;
    }
    if (hide.has("area") && (this._view.areas || []).length) {
      this._view.areas = [];
      changed = true;
    }
    if (hide.has("integration") && (this._view.integs || []).length) {
      this._view.integs = [];
      changed = true;
    }
    if (changed) this._saveView();
  }

  _matches(d) {
    return this._scopePass(d) && this._connPass(d) && this._problemPass(d) && this._hintPass(d, this._hint) && this._searchPass(d);
  }

  // Gewählte Bereiche, soweit es sie in HA noch gibt; null = kein Filter.
  // Ein gelöschter Bereich fällt still weg, sonst bliebe die Liste leer.
  // Zwischengespeichert: _areaPass läuft für jedes Gerät. Beide Listen werden
  // bei jeder Änderung ersetzt (Auswahl, Abfrage), nie verändert.
  _areaSel() {
    const picked = this._view.areas || [];
    if (this._areaSelFor?.[0] !== picked || this._areaSelFor[1] !== this._areas) {
      const known = new Set([...this._areas.map((a) => a.id), AREA_NONE]);
      const sel = picked.filter((id) => known.has(id));
      this._areaSelFor = [picked, this._areas];
      this._areaSelSet = sel.length ? new Set(sel) : null;
    }
    return this._areaSelSet;
  }

  _areaPass(d) {
    const sel = this._areaSel();
    return !sel || sel.has(d.area_id || AREA_NONE);
  }

  // Filter "Integration" (seit 1.9.0, Wunsch des Nutzers): wie "Bereich", nach
  // der Integration des Geräts (Domain, wie die Spalte "Integration").
  // Eine Integration, die es nicht mehr gibt, fällt still weg.
  _integId(d) {
    return d.integration?.domain || d.integrations?.[0] || AREA_NONE;
  }

  _integSel() {
    const picked = this._view.integs || [];
    if (this._integSelFor?.[0] !== picked || this._integSelFor[1] !== this._devices) {
      const known = new Set(this._devices.map((d) => this._integId(d)));
      const sel = picked.filter((id) => known.has(id));
      this._integSelFor = [picked, this._devices];
      this._integSelSet = sel.length ? new Set(sel) : null;
    }
    return this._integSelSet;
  }

  _integPass(d) {
    const sel = this._integSel();
    return !sel || sel.has(this._integId(d));
  }

  // Bereich und Integration zusammen bilden den Umfang von Liste und Kopf.
  _scopePass(d) {
    return this._areaPass(d) && this._integPass(d);
  }

  _scoped() {
    return Boolean(this._areaSel() || this._integSel());
  }

  // Einzelne Filter: Die Zahl auf einem Chip zählt mit allen übrigen Filtern
  // (auch der Suche), also so viele Zeilen, wie nach dem Antippen erscheinen.
  _connPass(d) {
    return this._conn === "all" || this._connOf(d) === this._conn;
  }

  // "Ausgefallen" und "Warnungen" (seit 1.16.0, vorher "Nur Probleme"): Ist einer
  // aktiv, zählen Geräte mit Ausfall bzw. Warnung; sind beide aktiv, beides.
  _problemPass(d) {
    if (!this._problems && !this._offlineOnly) return true;
    return (this._offlineOnly && devOffline(d)) || (this._problems && devWarn(d));
  }

  _hintPass(d, hint) {
    if (!hint) return true;
    return HINTS.find((h) => h.key === hint)?.test(d) ?? true;
  }

  _searchPass(d) {
    if (!this._search) return true;
    const integs = (d.integrations || []).map((dom) => this._integrations[dom] || dom);
    return [d.name, d.area, d.manufacturer, d.model, d.sw_version, ...integs, d.integration?.title, this._t(typeKey(d.type)), this._t(CONN[this._connOf(d)].key), d.via]
      .join(" ")
      .toLowerCase()
      .includes(this._search);
  }

  // --- Ansicht: Spalten, Sortierung, Gruppen/Liste ---------------------------

  // Änderung an der Ansicht: sofort sichtbar und gespeichert (Filter, Bereiche). Im Dialog "Ansicht" (draft) nur sichtbar,
  // gespeichert wird mit "Speichern" des Dialogs.
  _setView(patch, { draft = false } = {}) {
    // Fokus am Schalter bzw. Griff halten: der Neuaufbau ersetzt ihn, und
    // ohne Fokus im Panel erreichte Escape es nicht mehr (echtes HA).
    const a = this.shadowRoot.activeElement;
    const ds = a?.dataset || {};
    const sel = ds.vtoggle ? `[data-vtoggle="${ds.vtoggle}"][data-key="${ds.key}"]` : ds.vdrag ? `[data-vdrag="${ds.vdrag}"][data-key="${ds.key}"]` : null;
    Object.assign(this._view, patch);
    if (!draft) this._saveView();
    this._render();
    if (this._settings?.mode === "view") this._renderSettings();
    if (sel) this.shadowRoot.querySelector(sel)?.focus({ preventScroll: true });
  }

  // Klick auf den Spaltenkopf: aufsteigend, absteigend, dann wieder Standard.
  _cycleSort(key) {
    const v = this._view;
    if (v.sort !== key) this._setView({ sort: key, dir: "asc" });
    else if (v.dir === "asc") this._setView({ dir: "desc" });
    else this._setView({ sort: "default", dir: "asc" });
  }

  _sortLabel(key) {
    return this._t(SORT_LABEL[key]);
  }

  // Wert zum Sortieren; null = ohne Wert, steht immer am Ende.
  _sortValue(d, key) {
    switch (key) {
      case "name":
        return String(d.name || "");
      case "status":
        return d.disabled || d.unmonitored ? 4 : d.online === false ? 0 : d.online == null ? 2 : d.flaky ? 1 : 3;
      case "connection":
        return this._t(CONN[this._connOf(d)].key);
      case "avail":
        return d.avail24?.pct ?? null;
      case "outages":
        return d.avail24 ? d.avail24.outages || 0 : null;
      case "type":
        return this._t(typeKey(d.type));
      case "integration":
        return this._integName(d) || null;
      case "battery":
        return d.battery ? batteryRank(d) : null;
      case "signal":
        return sigRank(d.signal);
      case "area":
        return d.area || null;
      case "model":
        return [d.manufacturer, d.model].filter(Boolean).join(" ") || null;
      case "software":
        return d.sw_version || null;
      case "via":
        return d.via || null;
      default:
        return null;
    }
  }

  // Vergleich nach der gewählten Sortierung; null bei "Standard".
  _sortCmp() {
    const { sort, dir } = this._view;
    if (sort === "default") return null;
    const sign = dir === "desc" ? -1 : 1;
    const byName = (a, b) => String(a.name).localeCompare(String(b.name));
    return (a, b) => {
      const x = this._sortValue(a, sort);
      const y = this._sortValue(b, sort);
      if (x == null || y == null) return x == null && y == null ? byName(a, b) : x == null ? 1 : -1;
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
      return c ? c * sign : byName(a, b);
    };
  }

  // Liste zum Ein-/Ausblenden und Verschieben (Spalten bzw. Angaben).
  // Wie HA "Anpassen": Griff links, Name, Auge rechts; ausgeblendete grau
  // und ohne Griff (ihre Lage zählt erst, wenn sie wieder sichtbar sind).
  _orderRowsHtml(list, defs, kind) {
    const label = Object.fromEntries(defs.map(([k, l]) => [k, this._t(l)]));
    return list
      .map(([key, on]) => {
        const handle = on
          ? `<button type="button" class="drag-h" data-vdrag="${kind}" data-key="${key}" title="${escape(this._t("colDragHint"))}" aria-label="${escape(this._t("colDragMove", label[key]))}">${mdi("drag", 18)}</button>`
          : `<span class="drag-h ph" aria-hidden="true"></span>`;
        const eye = escape(this._t(on ? "colHide" : "colShowIt", label[key]));
        return `<div class="vrow${on ? "" : " off"}" data-key="${key}">${handle}<span class="vl">${escape(label[key])}</span>
          <button type="button" class="eye" data-vtoggle="${kind}" data-key="${key}" aria-pressed="${on}" title="${eye}" aria-label="${eye}">${mdi(on ? "eye" : "eyeOff", 20)}</button></div>`;
      })
      .join("");
  }

  // Umschalter (Segment) im Dialog "Ansicht".
  _vseg(attr, items, value) {
    return `<span class="seg-sw" role="group">${items
      .map(([val, label]) => `<button type="button" data-${attr}="${val}" class="${val === value ? "on" : ""}" aria-pressed="${val === value}">${label}</button>`)
      .join("")}</span>`;
  }

  // Ansicht (seit 2.87.0): ein Dialog mit zwei Reitern, im Dialog der Einstellungen. "Spalten" (Handy: "Sortierung") gilt pro Benutzer,
  // "Filter-Chips" für alle Benutzer (nur Administratoren). Änderungen sind ein Entwurf: die Liste dahinter zeigt sie gleich,
  // gespeichert wird erst mit "Speichern" (docs/mockups/view-v3).
  _openView() {
    const btn = this.shadowRoot.querySelector(".view-btn");
    btn?.classList.add("on");
    btn?.setAttribute("aria-expanded", "true");
    this._openSettings("view");
  }

  _viewAdmin() {
    return this._hass?.user?.is_admin !== false;
  }

  // Stand der Ansicht beim Öffnen, zum Vergleichen und Zurückstellen
  _viewSnap() {
    const v = this._view;
    return { sort: v.sort, dir: v.dir, flat: v.flat, cols: v.cols.map((x) => [...x]), fields: v.fields.map((x) => [...x]) };
  }

  _viewChanged() {
    const base = this._settings?.viewBase;
    return Boolean(base) && JSON.stringify(this._viewSnap()) !== JSON.stringify(base.snap);
  }

  // Schliessen ohne Speichern: die Liste kehrt zum gespeicherten Stand zurück
  _revertView() {
    const base = this._settings?.viewBase;
    if (!base || !this._viewChanged()) return;
    Object.assign(this._views[base.kind], JSON.parse(JSON.stringify(base.snap)));
    this._render();
  }

  // Beschriftung des Reiters "Spalten" (Handy: "Sortierung")
  _viewColsLabel() {
    return this._t(this._narrowQuery.matches ? "viewTabSort" : "viewTabCols");
  }

  // Inhalt des Reiters "Spalten": Desktop Gruppen/Liste und Spalten, Handy Sortierung und Angaben der Kachel
  _viewControlsHtml() {
    const t = (k, ...a) => this._t(k, ...a);
    const v = this._view;
    const reset = (what) => `<div class="drag-reset"><button type="button" class="ovr-all" data-vreset="${what}">${mdi("reset", 15)}${escape(t("restoreDefault"))}</button></div>`;
    const groups = `<div class="vline first"><span>${escape(t("viewGroupsOrList"))}</span>${this._vseg("vflat", [["0", escape(t("viewGroups"))], ["1", escape(t("viewList"))]], v.flat ? "1" : "0")}</div>
      <div class="vnote">${escape(t("viewGroupsNote"))}</div>`;
    const intro = `<div class="nf-note view-own">${mdi("info", 16)}<div><p>${escape(t(this._narrowQuery.matches ? "viewSubMobile" : "customizeSub"))}</p></div></div>`;
    if (!this._narrowQuery.matches) {
      return `${intro}${groups}
        <h3>${escape(t("viewTabCols"))}</h3><p class="dlg-note small">${escape(t("customizeHint"))}</p>
        <div class="vrow fixed"><span class="drag-h ph" aria-hidden="true"></span><span class="vl">${escape(t("colName"))}<small>${escape(t("colFixed"))}</small></span>
          <span class="eye dis" aria-hidden="true">${mdi("eye", 20)}</span></div>
        <div class="vlist" data-vlist="cols">${this._orderRowsHtml(v.cols, COLUMNS, "cols")}</div>${reset("cols")}`;
    }
    const pills = SORT_MOBILE.map((key) => {
      const on = v.sort === key;
      return `<button type="button" class="vpill${on ? " on" : ""}" data-vsort="${key}" aria-pressed="${on}">${on ? mdi("check", 15) : ""}${escape(this._sortLabel(key))}</button>`;
    }).join("");
    return `${intro}<h3>${escape(t("sortBy"))}</h3><div class="vpills">${pills}</div>
      <div class="vline"><span>${escape(t("sortDir"))}</span>${this._vseg("vdir", [["asc", `${mdi("arrowUp", 14)} ${escape(t("sortAsc"))}`], ["desc", `${mdi("arrowDown", 14)} ${escape(t("sortDesc"))}`]], v.dir)}</div>
      <h3>${escape(t("viewDisplay"))}</h3>${groups}
      <h3>${escape(t("viewFields"))}</h3><div class="vnote top">${escape(t("viewFieldsNote"))}</div>
      <div class="vlist" data-vlist="fields">${this._orderRowsHtml(v.fields, CARD_FIELDS, "fields")}</div>${reset("sheet")}`;
  }

  // Körper des Dialogs im Modus "Ansicht": Reiterleiste (nur mit beiden Reitern) und der gewählte Reiter
  _viewBodyHtml(changes) {
    const st = this._settings;
    const t = (k, ...a) => this._t(k, ...a);
    const admin = this._viewAdmin();
    const tab = admin && st.vtab === "chips" ? "chips" : "cols";
    const mark = (id) => (id === "cols" ? this._viewChanged() : SUB_TAB_KEYS.chips.some((k) => changes.has(k))) ? " chg" : "";
    const bar = admin
      ? `<div class="sub-tabs" role="tablist">${[["cols", this._viewColsLabel()], ["chips", t("viewTabChips")]]
          .map(([id, label]) => `<button type="button" role="tab" class="sub-tab${id === tab ? " on" : ""}${mark(id)}" data-set="vtab" data-key="${id}" aria-selected="${id === tab}">${escape(label)}</button>`)
          .join("")}</div>`
      : "";
    let inner;
    if (tab === "cols") inner = this._viewControlsHtml();
    else if (st.loading) inner = `<p class="dlg-note">${escape(t("settingsLoading"))}</p>`;
    else if (st.error) inner = `<div class="dlg-error">${escape(t("settingsLoadError"))} ${escape(st.error)}</div>`;
    else inner = `<div class="nf-note view-own">${mdi("info", 16)}<div><p>${escape(t("viewChipsGlobal"))}</p></div></div>${this._settingsBodyHtml()}`;
    return `${bar}${inner}${st.saveError ? `<div class="dlg-error">${escape(t("settingsSaveError"))} ${escape(st.saveError)}</div>` : ""}`;
  }

  // Bedienung der Ansicht im Dialog der Einstellungen: Auge, Ziehen am Griff (Maus und Finger, Pointer-Events), Pfeiltasten, Auswahl.
  // Alles ändert nur den Entwurf (_setView mit draft).
  _bindViewControls(dialog) {
    const listOf = (kind) => (kind === "cols" ? "cols" : "fields");
    const draft = (patch) => this._setView(patch, { draft: true });
    const inView = () => this._settings?.mode === "view";
    const toggle = (ev) => {
      const el = ev.target.closest?.("[data-vtoggle]");
      if (!el) return false;
      const key = listOf(el.dataset.vtoggle);
      draft({ [key]: this._view[key].map(([k, on]) => [k, k === el.dataset.key ? !on : on]) });
      return true;
    };
    const reorder = (kind, keys) => {
      const key = listOf(kind);
      const map = new Map(this._view[key]);
      draft({ [key]: keys.map((k) => [k, map.get(k)]) });
    };
    dialog.addEventListener("keydown", (ev) => {
      const h = ev.target.closest?.("[data-vdrag]");
      if (!inView() || !h || (ev.key !== "ArrowUp" && ev.key !== "ArrowDown")) return;
      ev.preventDefault();
      const kind = h.dataset.vdrag;
      const keys = this._view[listOf(kind)].map(([k]) => k);
      const i = keys.indexOf(h.dataset.key);
      const j = ev.key === "ArrowUp" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= keys.length) return;
      [keys[i], keys[j]] = [keys[j], keys[i]];
      // Fokus bleibt am Griff (_setView), die nächste Pfeiltaste schiebt weiter.
      reorder(kind, keys);
    });
    dialog.addEventListener("pointerdown", (ev) => {
      const h = ev.target.closest?.("[data-vdrag]");
      if (!inView() || !h || (ev.pointerType === "mouse" && ev.button !== 0)) return;
      ev.preventDefault();
      const row = h.closest(".vrow");
      const box = row?.parentElement;
      if (!box) return;
      const win = this.ownerDocument?.defaultView || window;
      row.classList.add("lift");
      const move = (e) => {
        const y = e.clientY;
        const sr = dialog.getBoundingClientRect();
        if (y < sr.top + 50) dialog.scrollTop -= 10;
        else if (y > sr.bottom - 60) dialog.scrollTop += 10;
        const after = [...box.children].find((r) => {
          if (r === row) return false;
          const b = r.getBoundingClientRect();
          return y < b.top + b.height / 2;
        });
        if (after) {
          if (row.nextElementSibling !== after) box.insertBefore(row, after);
        } else if (box.lastElementChild !== row) box.appendChild(row);
      };
      const up = () => {
        win.removeEventListener("pointermove", move);
        win.removeEventListener("pointerup", up);
        win.removeEventListener("pointercancel", up);
        row.classList.remove("lift");
        reorder(h.dataset.vdrag, [...box.children].map((r) => r.dataset.key));
      };
      win.addEventListener("pointermove", move);
      win.addEventListener("pointerup", up);
      win.addEventListener("pointercancel", up);
    });
    dialog.addEventListener("click", (ev) => {
      if (!inView()) return;
      if (toggle(ev)) return;
      const el = ev.target.closest("[data-vsort],[data-vdir],[data-vflat],[data-vreset]");
      if (!el) return;
      if (el.dataset.vsort) draft({ sort: el.dataset.vsort, dir: el.dataset.vsort === this._view.sort ? this._view.dir : "asc" });
      else if (el.dataset.vdir) draft({ dir: el.dataset.vdir });
      else if (el.dataset.vflat) draft({ flat: el.dataset.vflat === "1" });
      else if (el.dataset.vreset === "cols") draft({ cols: defaultView().cols, flat: defaultView().flat });
      else {
        const d = defaultView();
        draft({ sort: d.sort, dir: d.dir, flat: d.flat, fields: d.fields });
      }
    });
    // Ein Klick in die Liste, der ein Popover schliesst (Filter "Bereich"),
    // öffnet kein Gerät (wie unifi_dynamic).
    this.shadowRoot.addEventListener(
      "click",
      (ev) => {
        if (!this._swallowUntil) return;
        const swallow = Date.now() < this._swallowUntil;
        this._swallowUntil = 0;
        if (swallow) {
          ev.stopPropagation();
          ev.preventDefault();
        }
      },
      true
    );
  }

  // --- Filter "Bereich" (seit 0.23.0, docs/mockups/area-v1, A) -------------
  // Wählt einen oder mehrere Bereiche (eine Etage wählt alle ihre); die Liste
  // zeigt nur deren Geräte, die übrigen Chips filtern darin weiter. Der Kopf
  // (Ring, Ausfälle, Puls) zeigt weiter das ganze Haus. Pro Benutzer in der
  // Ansicht gespeichert, Desktop und Handy getrennt.

  _setAreas(list) {
    this._setView({ areas: [...new Set(list)].sort() });
  }

  _setIntegs(list) {
    this._setView({ integs: [...new Set(list)].sort() });
  }

  // Die offene Auswahl: Gruppen, gewählte IDs, Setzen und Textschlüssel.
  _pickGroups() {
    return this._pickKind === "integ" ? this._integGroups() : this._areaGroups();
  }

  _pickPicked() {
    return new Set((this._pickKind === "integ" ? this._view.integs : this._view.areas) || []);
  }

  _setPick(list) {
    if (this._pickKind === "integ") this._setIntegs(list);
    else this._setAreas(list);
  }

  _pk(suffix) {
    return this._t(`${this._pickKind === "integ" ? "integ" : "area"}${suffix}`);
  }

  // Etagen mit ihren Bereichen in der Reihenfolge aus HA (Einstellungen →
  // Bereiche, Etagen und Zonen), Bereiche ohne Etage danach, zuletzt "Ohne
  // Bereich". Nur Bereiche mit Geräten (oder gewählte), damit leere Bereiche
  // die Auswahl nicht füllen. Zahl je Bereich mit den übrigen Filtern.
  _areaGroups() {
    const total = new Map();
    const count = new Map();
    for (const d of this._devices) {
      const id = d.area_id || AREA_NONE;
      total.set(id, (total.get(id) || 0) + 1);
      if (this._integPass(d) && this._connPass(d) && this._problemPass(d) && this._hintPass(d, this._hint) && this._searchPass(d)) count.set(id, (count.get(id) || 0) + 1);
    }
    const picked = new Set(this._view.areas || []);
    const show = (id) => total.has(id) || picked.has(id);
    const item = (a) => ({ id: a.id, name: a.name, n: count.get(a.id) || 0 });
    const groups = [];
    for (const f of this._floors) {
      const items = this._areas.filter((a) => a.floor_id === f.id && show(a.id)).map(item);
      if (items.length) groups.push({ key: `f:${f.id}`, name: f.name, items });
    }
    const floorIds = new Set(this._floors.map((f) => f.id));
    const loose = this._areas.filter((a) => !floorIds.has(a.floor_id) && show(a.id)).map(item);
    // Ohne Etagen in HA: Bereiche ohne Überschrift.
    if (loose.length) groups.push({ key: "loose", name: groups.length ? this._t("areaNoFloor") : null, items: loose });
    if (show(AREA_NONE)) groups.push({ key: "none", name: null, items: [{ id: AREA_NONE, name: this._t("areaNone"), n: count.get(AREA_NONE) || 0 }] });
    return groups;
  }

  // Beschriftung des aktiven Chips: genau eine Etage mit ihrem Namen, ein
  // oder zwei Bereiche mit Namen, sonst die Zahl.
  _areaLabel(sel, groups) {
    for (const g of groups) {
      if (!g.key.startsWith("f:") || g.items.length !== sel.size) continue;
      if (g.items.every((x) => sel.has(x.id))) return g.name;
    }
    const names = groups.flatMap((g) => g.items).filter((x) => sel.has(x.id)).map((x) => x.name);
    return names.length && names.length <= 2 && names.length === sel.size ? names.join(", ") : this._t("areaMany", sel.size);
  }

  // Integrationen mit Geräten (oder gewählte) alphabetisch, zuletzt "Ohne
  // Integration"; die Zahl zählt mit den übrigen Filtern, auch dem Bereich.
  _integGroups() {
    const total = new Set();
    const count = new Map();
    for (const d of this._devices) {
      const id = this._integId(d);
      total.add(id);
      if (this._areaPass(d) && this._connPass(d) && this._problemPass(d) && this._hintPass(d, this._hint) && this._searchPass(d)) count.set(id, (count.get(id) || 0) + 1);
    }
    const picked = new Set(this._view.integs || []);
    const items = [...total, ...picked.keys()]
      .filter((id, i, arr) => arr.indexOf(id) === i && id !== AREA_NONE && (total.has(id) || picked.has(id)))
      .map((id) => ({ id, name: this._integrations[id] || id, n: count.get(id) || 0 }))
      .sort((a, b) => a.name.localeCompare(b.name, this._locale()));
    if (total.has(AREA_NONE)) items.push({ id: AREA_NONE, name: this._t("integNone"), n: count.get(AREA_NONE) || 0 });
    return items.length ? [{ key: "loose", name: null, items }] : [];
  }

  // Beschriftung des aktiven Chips: ein oder zwei Namen, sonst die Zahl.
  _integLabel(sel, groups) {
    const names = groups.flatMap((g) => g.items).filter((x) => sel.has(x.id)).map((x) => x.name);
    return names.length && names.length <= 2 && names.length === sel.size ? names.join(", ") : this._t("integMany", sel.size);
  }

  // Wie der Chip "Bereich"; erst ab zwei Integrationen sinnvoll (oder wenn aktiv).
  _integChipHtml(all) {
    if (this._hideChips.has("integration")) return "";
    const sel = this._integSel();
    const open = this._areaOpen && this._pickKind === "integ";
    if (!sel) {
      if (new Set(all.map((d) => this._integId(d))).size < 2) return "";
      return `<button type="button" class="chip area integ${open ? " open" : ""}" data-integ-open aria-haspopup="dialog" aria-expanded="${open}">${mdi("puzzle", 15)}<span>${escape(this._t("integChip"))}</span>${mdi("chevronDown", 15)}</button>`;
    }
    const label = this._integLabel(sel, this._integGroups());
    const n = all.filter((d) => this._matches(d)).length;
    return `<span class="chip area integ on"><button type="button" class="area-open" data-integ-open aria-haspopup="dialog" aria-expanded="${open}" title="${escape(`${this._t("integChip")}: ${label}`)}">${mdi("puzzle", 15)}<span class="al">${escape(label)}</span> <span class="n">${n}</span></button><button type="button" class="area-x" data-integ-clear title="${escape(this._t("integClear"))}" aria-label="${escape(this._t("integClear"))}">${mdi("close", 13)}</button></span>`;
  }

  _areaChipHtml(all) {
    if (this._hideChips.has("area")) return "";
    const sel = this._areaSel();
    if (!sel && !this._areas.length) return "";
    const open = this._areaOpen && this._pickKind === "area";
    if (!sel) {
      return `<button type="button" class="chip area${open ? " open" : ""}" data-area-open aria-haspopup="dialog" aria-expanded="${open}">${mdi("home", 15)}<span>${escape(this._t("areaChip"))}</span>${mdi("chevronDown", 15)}</button>`;
    }
    const label = this._areaLabel(sel, this._areaGroups());
    const n = all.filter((d) => this._matches(d)).length;
    return `<span class="chip area on"><button type="button" class="area-open" data-area-open aria-haspopup="dialog" aria-expanded="${open}" title="${escape(`${this._t("areaChip")}: ${label}`)}">${mdi("home", 15)}<span class="al">${escape(label)}</span> <span class="n">${n}</span></button><button type="button" class="area-x" data-area-clear title="${escape(this._t("areaClear"))}" aria-label="${escape(this._t("areaClear"))}">${mdi("close", 13)}</button></span>`;
  }

  // Desktop: Popover unter dem Chip; Handy: Blatt von unten (wie "Ansicht").
  _openAreas(kind = "area") {
    this._areaQuery = "";
    this._areaOpen = true;
    this._pickKind = kind;
    const mobile = this._narrowQuery.matches;
    const t = (k, ...a) => this._t(k, ...a);
    const icon = kind === "integ" ? "puzzle" : "home";
    const many = this._pickGroups().reduce((a, g) => a + g.items.length, 0) > 8;
    const search = many
      ? `<label class="area-search">${mdi("search", 16)}<input type="search" data-area-search placeholder="${escape(this._pk("Search"))}" aria-label="${escape(this._pk("Search"))}">${this._fieldClearHtml("data-area-search-clear", "", "")}</label>`
      : "";
    if (mobile) {
      const dlg = this.shadowRoot.querySelector("dialog.area-sheet");
      if (!dlg) return;
      dlg.innerHTML = `<div class="dlg-head"><span class="dlg-avatar">${mdi(icon, 28)}</span>
          <div class="dlg-title"><h2>${escape(this._pk("Title"))}</h2><div class="dlg-sub">${escape(t("areaSubMobile"))}</div></div>
          <button type="button" class="dlg-close" data-area-done title="${escape(t("close"))}" aria-label="${escape(t("close"))}">${mdi("close", 18)}</button></div>
        <div class="dlg-body">${search}<div class="alist"></div></div>
        <div class="dlg-actions"><button type="button" class="dlg-btn" data-area-clear>${mdi("eye", 18)}${escape(this._pk("ShowAll"))}</button><button type="button" class="dlg-btn primary" data-area-done>${mdi("check", 18)}${escape(t("areaDone"))}</button></div>`;
      this._renderAreaList();
      if (!dlg.open) {
        if (typeof dlg.showModal === "function") dlg.showModal();
        else dlg.setAttribute("open", "");
      }
      dlg.scrollTop = 0;
      // Kein Fokusrahmen und keine Tastatur beim Öffnen per Tipp.
      if (window.matchMedia?.(TOUCH_QUERY).matches) this.shadowRoot.activeElement?.blur();
    } else {
      const pop = this.shadowRoot.querySelector(".area-pop");
      if (!pop) return;
      pop.innerHTML = `<h4>${escape(this._pk("Title"))}</h4><div class="vsub">${escape(this._pk("Sub"))}</div>${search}<div class="alist"></div><div class="vfoot afoot"></div>`;
      pop.hidden = false;
      this._renderAreaList();
      this._placeAreas();
      (pop.querySelector("[data-area-search]") || pop.querySelector(".arow,.afloor"))?.focus({ preventScroll: true });
    }
    this._render();
  }

  // Unter dem Chip, linksbündig, nie über den rechten oder unteren Rand
  // hinaus (der Chip steht nach dem Kopf oft weit unten); die Liste scrollt.
  _placeAreas() {
    const pop = this.shadowRoot.querySelector(".area-pop");
    const chip = this.shadowRoot.querySelector(this._pickKind === "integ" ? ".chips .chip.integ" : ".chips .chip.area:not(.integ)");
    if (!pop || pop.hidden || !chip) return;
    const b = chip.getBoundingClientRect();
    const width = pop.offsetWidth;
    const top = Math.round(b.bottom + 8);
    pop.style.top = `${top}px`;
    pop.style.left = `${Math.max(8, Math.min(Math.round(b.left), window.innerWidth - width - 8))}px`;
    pop.style.maxHeight = `${Math.max(220, Math.min(560, window.innerHeight - top - 12))}px`;
  }

  _closeAreas() {
    if (!this._areaOpen) return;
    this._areaOpen = false;
    const pop = this.shadowRoot.querySelector(".area-pop");
    if (pop) pop.hidden = true;
    const dlg = this.shadowRoot.querySelector("dialog.area-sheet");
    if (dlg?.open) dlg.close();
    this._render();
  }

  // Liste der Auswahl (und Fusszeile im Popover) neu; das Suchfeld bleibt,
  // damit Fokus und Cursor beim Tippen nicht verloren gehen.
  _renderAreaList() {
    const box = this.shadowRoot.querySelector(this._narrowQuery.matches ? "dialog.area-sheet .alist" : ".area-pop .alist");
    if (!box) return;
    const picked = this._pickPicked();
    const all = this._pickGroups();
    const q = this._areaQuery.trim().toLowerCase();
    // Suche: eine passende Etage zeigt alle ihre Bereiche.
    const groups = q
      ? all
          .map((g) => (g.name && g.name.toLowerCase().includes(q) ? g : { ...g, items: g.items.filter((x) => x.name.toLowerCase().includes(q)) }))
          .filter((g) => g.items.length)
      : all;
    const check = (state) => `<span class="abox ${state}">${state === "on" ? mdi("check", 14) : ""}</span>`;
    let html = "";
    for (const g of groups) {
      if (g.name) {
        const n = g.items.filter((x) => picked.has(x.id)).length;
        const state = n === g.items.length ? "on" : n ? "part" : "";
        html += `<button type="button" class="afloor" role="checkbox" aria-checked="${state === "on" ? "true" : state ? "mixed" : "false"}" data-area-group="${escape(g.key)}">${check(state)}<span class="al">${escape(g.name)}</span></button>`;
      }
      html += g.items
        .map((x) => {
          const on = picked.has(x.id);
          return `<button type="button" class="arow${g.name ? " in" : ""}${x.n ? "" : " zero"}" role="checkbox" aria-checked="${on}" data-area="${escape(x.id)}" data-in="${escape(g.key)}">${check(on ? "on" : "")}<span class="al">${escape(x.name)}</span><span class="an">${x.n}</span></button>`;
        })
        .join("");
    }
    if (!html) html = `<div class="anote">${escape(this._pk(all.length ? "NoMatch" : "Empty"))}</div>`;
    // Fokus auf der Zeile halten (Tastatur): der Neuaufbau ersetzt sie.
    const a = this.shadowRoot.activeElement;
    const sel = a?.dataset?.area !== undefined ? `[data-area="${CSS.escape(a.dataset.area)}"]` : a?.dataset?.areaGroup ? `[data-area-group="${CSS.escape(a.dataset.areaGroup)}"]` : null;
    if (setHtml(box, html) && sel) box.querySelector(sel)?.focus({ preventScroll: true });
    const known = all.reduce((n, g) => n + g.items.length, 0);
    const chosen = all.reduce((n, g) => n + g.items.filter((x) => picked.has(x.id)).length, 0);
    const foot = this.shadowRoot.querySelector(".area-pop .afoot");
    if (foot && !this._narrowQuery.matches) {
      setHtml(foot, `<span>${escape(this._t(this._pickKind === "integ" ? "integCount" : "areaCount", chosen, known))}</span><button type="button" class="vlink" data-area-clear ${chosen ? "" : "disabled"}>${escape(this._pk("ShowAll"))}</button>`);
    }
    const clear = this.shadowRoot.querySelector("dialog.area-sheet .dlg-actions [data-area-clear]");
    if (clear) clear.disabled = !chosen;
  }

  _bindAreas(pop, sheet) {
    const onClick = (ev) => {
      const one = ev.target.closest("[data-area]");
      const group = ev.target.closest("[data-area-group]");
      const picked = this._pickPicked();
      if (one) {
        const id = one.dataset.area;
        if (picked.has(id)) picked.delete(id);
        else picked.add(id);
        this._setPick([...picked]);
      } else if (group) {
        // Etage: alle ihre (sichtbaren) Bereiche an, sind schon alle an: aus.
        const ids = [...group.parentElement.querySelectorAll(`[data-in="${CSS.escape(group.dataset.areaGroup)}"]`)].map((el) => el.dataset.area);
        const allOn = ids.every((id) => picked.has(id));
        for (const id of ids) {
          if (allOn) picked.delete(id);
          else picked.add(id);
        }
        this._setPick([...picked]);
      } else if (ev.target.closest("[data-area-search-clear]")) {
        ev.preventDefault();
        const box = ev.target.closest("dialog, .area-pop");
        const input = box?.querySelector("[data-area-search]");
        if (input) input.value = "";
        this._areaQuery = "";
        ev.target.closest("[data-area-search-clear]").hidden = true;
        this._renderAreaList();
        if (input && !window.matchMedia?.(TOUCH_QUERY).matches) input.focus();
      } else if (ev.target.closest("[data-area-clear]")) this._setPick([]);
      else if (ev.target.closest("[data-area-done]")) this._closeAreas();
    };
    const onInput = (ev) => {
      if (!ev.target.matches?.("[data-area-search]")) return;
      this._areaQuery = ev.target.value;
      const x = ev.target.closest("dialog, .area-pop")?.querySelector("[data-area-search-clear]");
      if (x) x.hidden = !ev.target.value;
      this._renderAreaList();
    };
    pop.addEventListener("click", onClick);
    pop.addEventListener("input", onInput);
    sheet.addEventListener("click", (ev) => {
      // Tipp auf den Hintergrund schliesst wie bei den übrigen Blättern.
      if (ev.target === sheet) return this._closeAreas();
      onClick(ev);
    });
    sheet.addEventListener("input", onInput);
    sheet.addEventListener("close", () => {
      if (this._areaOpen && !sheet.open) {
        this._areaOpen = false;
        this._render();
      }
    });
    // Klick ausserhalb oder Escape schliesst das Popover; ein Klick in die
    // Liste öffnet dabei kein Gerät (wie beim Popover "Spalten").
    const content = this.shadowRoot.querySelector(".content");
    this.shadowRoot.addEventListener(
      "pointerdown",
      (ev) => {
        if (!this._areaOpen || this._narrowQuery.matches) return;
        const path = ev.composedPath();
        if (path.some((el) => el === pop || el?.classList?.contains?.("area"))) return;
        this._closeAreas();
        if (path.includes(content)) this._swallowUntil = Date.now() + 800;
      },
      true
    );
    (this.ownerDocument?.defaultView || window).addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && this._areaOpen && !this._narrowQuery.matches) {
        this._closeAreas();
        this.shadowRoot.querySelector(this._pickKind === "integ" ? ".chips [data-integ-open]" : ".chips [data-area-open]")?.focus();
      }
    });
  }

  // --- Liste ----------------------------------------------------------------

  // soft: Aufruf aus dem Abfragen (nicht aus einer Aktion des Benutzers); das Popup wartet dann auf das Ende einer Berührung.
  _render(soft = false) {
    const root = this.shadowRoot;
    if (!root.querySelector(".content")) return;
    const all = this._devices;
    // Kopf mit Filter "Bereich" nur für dessen Geräte (seit 0.26.0, Entscheid
    // des Nutzers); die übrigen Chips wirken nur auf die Liste.
    const scope = this._scoped() ? all.filter((d) => this._scopePass(d)) : all;
    const offline = scope.filter((d) => d.online === false).sort((a, b) => Date.parse(a.offline_since) - Date.parse(b.offline_since));
    // Kopf und Puls nur mit überwachten Geräten; deaktivierte und nicht überwachte zählen nicht.
    const monitored = scope.filter((d) => !d.disabled && !d.unmonitored);
    setHtml(root.querySelector(".hero"), this._loading ? "" : this._heroHtml(monitored, offline));
    setHtml(root.querySelector(".hstrip"), this._loading ? "" : this._stripHtml(monitored, offline));
    setHtml(root.querySelector(".chips"), this._loading ? "" : this._chipsHtml(all));
    this._guardPin();
    setHtml(root.querySelector(".viewline"), this._loading || !this._narrowQuery.matches ? "" : this._viewLineHtml());
    this._syncSticky();
    const rows = all.filter((d) => this._matches(d));
    setHtml(root.querySelector(".list"), this._listHtml(rows));
    if (this._areaOpen) {
      this._renderAreaList();
      this._placeAreas();
    }
    this._renderPulse();
    const time = this._fetchedAt ? this._fetchedAt.toLocaleTimeString(this._locale(), { hour: "2-digit", minute: "2-digit" }) : "";
    setHtml(
      root.querySelector(".foot"),
      this._loading || this._error
        ? ""
        : this._offline
          ? `<span class="offline-note">${escape(this._t("reconnecting"))}</span>`
          : `<span>${escape(this._t("footer", rows.length, all.length))}${time ? ` · ${escape(this._t("updatedAt", time))}` : ""}</span>${rows.length ? `<span class="tap">${escape(this._t("openDetails"))}</span>` : ""}`
    );
    // Das Popup nicht mitten in einer Berührung oder Wischbewegung neu aufbauen (siehe _dlgBusy).
    this._renderDevice(soft);
  }

  _heroHtml(all, offline) {
    const online = all.filter((d) => d.online === true);
    const flaky = online.filter((d) => d.flaky).length;
    const noData = all.filter((d) => d.online == null).length;
    let share = all.length ? (online.length / all.length) * 100 : 100;
    // Nie 100 % zeigen, solange ein Gerät fehlt (Rundung bei vielen Geräten).
    if (share > 99.9 && online.length < all.length) share = 99.9;
    // Kennzahl gross: der Anteil, der gerade online ist, wie der Ring. Bis
    // 0.33.1 stand hier gross der Durchschnitt der letzten 24 Std.; neben
    // einem vollen Ring las sich das als Fehler (Rückfrage des Nutzers,
    // 0.34.0, Variante B). Der Durchschnitt steht darunter, sobald das
    // Protokoll genug Daten hat.
    const withAvail = all.filter((d) => d.avail24?.pct != null);
    const pctHtml = `${escape(this._fmtPct(share))} %<small>${escape(this._t("pctNow"))}</small>`;
    let avgHtml = "";
    if (withAvail.length) {
      let avg = withAvail.reduce((a, d) => a + d.avail24.pct, 0) / withAvail.length;
      if (avg > 99.9 && withAvail.some((d) => d.avail24.outages)) avg = 99.9;
      avgHtml = `<div class="pavg">${escape(this._t("avg24"))}: <b>${escape(this._fmtPct(avg))} %</b></div>`;
    }
    const line = (color, text) => `<div><i style="background:${color}"></i>${escape(text)}</div>`;
    const ring = `<div class="kt ring"><div class="ringwrap">${ringSvg(share, 108, 11)}<div class="c"><div><b>${online.length}</b><span>${escape(this._t("ofTotal", all.length))}</span></div></div></div>
      <div class="rtxt"><div class="k">${escape(this._t("availability"))}${this._scopeHtml()}</div><div class="pct${avgHtml ? " with-avg" : ""}">${pctHtml}</div>${avgHtml}
      <div class="lines">${line("var(--dp-success)", this._t("linesOnline", online.length - flaky))}
      ${flaky ? line("var(--dp-warning)", this._t("linesFlaky", flaky)) : ""}
      ${line("var(--dp-error)", this._t("linesOffline", offline.length))}
      ${noData ? line("var(--dp-text3)", this._t("linesNoData", noData)) : ""}</div></div></div>`;
    // Zeile unten in der Kachel (seit 1.16.0, docs/mockups/chip-warn-v1, V1): wie
    // viele Geräte eine Warnung haben; antippbar, setzt den Filter "Warnungen".
    // Bei Ausfällen ohne Warnungen entfällt die Zeile (seit 2.83.0): "Keine Warnungen" direkt unter einem Ausfall las sich als
    // Widerspruch, obwohl Warnungen nur Geräte zählen, die online sind.
    const warn = all.filter(devWarn).length;
    const warnLine = warn
      ? `<button type="button" class="kwarn" data-warn-open aria-label="${escape(this._t("warnOpen"))}"><span class="w-ic">${mdi("alert", 16)}</span><span><b>${warn}</b><span class="w-long"> ${escape(this._t("warnDevices", warn))}</span><span class="w-short"> ${escape(this._t("warnShort", warn))}</span></span><span class="w-go">${mdi("chevronRight", 18)}</span></button>`
      : `<div class="kwarn none"><span class="w-ic">${mdi("check", 16)}</span><span>${escape(this._t("warnNone"))}</span></div>`;
    const off = offline.length
      ? `<div class="kt err offl"><div class="k"><span class="pulse"></span>${escape(this._t("offlineNow"))}${this._scopeHtml()}</div>
        <div class="top"><span class="num">${offline.length}</span><span class="lbl">${escape(this._t("longest", `${offline[0].since_at_least ? "≥ " : ""}${this._duration(offline[0].offline_since)}`))}</span></div>
        <div class="olist">${offline.slice(0, 4).map((d) => `<button type="button" data-open="${escape(d.id)}"><span>${CONN[this._connOf(d)].icon(16)}</span><span class="name">${escape(d.name)}</span><b>${this._durationHtml(d, true)}</b></button>`).join("")}
        ${offline.length > 4 ? `<div class="more more-long">${escape(this._t("more", offline.length - 4))}</div>` : ""}
        ${offline.length > 2 ? `<div class="more more-short">${escape(this._t("more", offline.length - 2))}</div>` : ""}</div>${warn ? warnLine : ""}</div>`
      : `<div class="kt offl"><div class="k">${escape(this._t("offlineNow"))}${this._scopeHtml()}</div>
        <div class="top"><span class="num ok">0</span><span class="lbl">${escape(this._t("allOnline"))}</span></div>
        <div class="durs">${escape(this._t("allOnlineSub"))}</div>${warnLine}</div>`;
    return ring + off + this._pulseHtml(all);
  }

  _syncSticky() {
    const content = this.shadowRoot.querySelector(".content");
    if (!content) return;
    const h = (sel) => {
      const el = content.querySelector(sel);
      return el && getComputedStyle(el).display !== "none" ? el.offsetHeight : 0;
    };
    content.style.setProperty("--stick-th", `${44 + h(".chips") + h(".viewline")}px`);
  }

  // Fixierter Kopf (seit 0.28.0, docs/mockups/fixed-v1, C): Sind die Kacheln weggescrollt,
  // bleibt eine Zeile oben stehen; Chips und Sortierung darunter. Tipp = zurück.
  _stripHtml(all, offline) {
    const online = all.filter((d) => d.online === true).length;
    const state = offline.length
      ? `<span class="e"><i></i>${escape(this._t("linesOffline", offline.length))}</span>`
      : `<span class="ok">${escape(this._t("allOnline"))}</span>`;
    return `<button type="button" class="hs-in" data-hs-top aria-label="${escape(this._t("stripTop"))}"><b>${online}</b><span>${escape(this._t("ofTotal", all.length))}</span>${state}${this._scopeHtml()}<span class="hs-up">${mdi("chevronDown", 18)}</span></button>`;
  }

  // Mit Filter "Bereich": Name der Auswahl hinter dem Titel einer Kachel.
  _scopeHtml() {
    const text = this._scopeText();
    return text ? `<span class="scope">· ${escape(text)}</span>` : "";
  }

  // Name des Umfangs (Bereich und Integration), leer ohne Filter.
  _scopeText() {
    const area = this._areaSel();
    const integ = this._integSel();
    return [area && this._areaLabel(area, this._areaGroups()), integ && this._integLabel(integ, this._integGroups())].filter(Boolean).join(" · ");
  }

  // Gehört das Gerät zum Abschnitt i des Pulses? Der letzte Abschnitt ist der
  // Stand jetzt: nur Geräte, die gerade ausgefallen sind (availability.pulse).
  _inPulse(d, i, n) {
    return d.avail24?.strip?.[i] === 1 && (i < n - 1 || d.avail24.down === true);
  }

  // Puls für den Kopf: ohne Bereichsfilter vom Backend, sonst aus den
  // Streifen der Geräte im Bereich (gleiche Zählung: Geräte mit Unterbruch je
  // 30 Min., availability.pulse und strip).
  _headPulse(devs) {
    if (!this._scoped() || !this._pulse) return this._pulse;
    const n = this._pulse.length;
    const counts = new Array(n).fill(0);
    for (const d of devs) for (let i = 0; i < n; i++) if (this._inPulse(d, i, n)) counts[i] += 1;
    return counts;
  }

  // Sammelausfälle für den Kopf: mit Bereichsfilter nur deren Geräte, und nur
  // solange es noch mindestens drei sind (wie availability.INCIDENT_MIN).
  _headIncidents(devs) {
    if (!this._scoped()) return this._incidents;
    const byId = new Map(devs.map((d) => [d.id, d]));
    return this._incidents
      .map((inc) => {
        const mine = (inc.devices || []).filter((id) => byId.has(id));
        if (mine.length < 3) return null;
        const doms = new Set(mine.map((id) => byId.get(id).integration?.domain || null));
        return { ...inc, devices: mine, count: mine.length, names: mine.map((id) => byId.get(id).name).slice(0, 6), integration: doms.size === 1 ? [...doms][0] : null };
      })
      .filter(Boolean);
  }

  // Puls als Kurve mit Ticks; in der Kachel mit Tooltips, im Fenster (tap)
  // mit antippbaren Abschnitten (sel = gewählter Abschnitt).
  // Farbe abschnittweise (seit 0.34.1, Wunsch des Nutzers): rot, solange die
  // Kurve über 0 liegt (auch An- und Abstieg), grün nur, wo sie auf 0 liegt.
  // 0.34.0 färbte die ganze Kurve grün, sobald gerade niemand fehlte; dann
  // waren auch die Höcker grün. Eigene Pfade statt Verlauf (linearGradient):
  // url(#id) im Shadow DOM ist auf älteren WebViews unzuverlässig.
  // --- Easter Egg: Herzschlag im Puls-Diagramm (seit 2.89.0) ----------------------------------------------
  // Fünf Klicks aufs Logo, jeder höchstens 1,5 s nach dem vorigen; dann zeichnet sich einige Sekunden lang ein Herzschlag in die Kachel "Puls".
  // Der Zustand ist nur eine Endzeit: das Diagramm wird laufend neu aufgebaut (Abfrage, Minutentakt), das Overlay kommt dann mit der richtigen
  // Phase (negative Verzögerung) wieder, die Animation springt nicht. Ohne Kachel (keine Daten) gibt es nur einen kurzen Hinweis.
  _logoTap() {
    const now = Date.now();
    const taps = (this._eeTaps || []).filter((t) => now - t < 1500);
    taps.push(now);
    this._eeTaps = taps.length >= EE_TAPS ? [] : taps;
    if (taps.length < EE_TAPS) return;
    this._eeAt = now;
    this._eeUntil = now + EE_MS;
    this._heartLogo(true);
    this._render();
    window.clearTimeout(this._eeTimer);
    this._eeTimer = window.setTimeout(() => {
      this._heartLogo(false);
      this._render();
    }, EE_MS + 100);
  }

  // Seit 2.92.0 wird das Logo oben links zum blauen Herz, das im Takt der Linie schlägt (auch bei gescrolltem Diagramm sichtbar, auch ohne
  // Kachel "Puls"). Das D verschwindet dabei; danach kommt das Logo unverändert zurück (Innenleben und viewBox werden gemerkt).
  _heartLogo(on) {
    const svg = this.shadowRoot.querySelector(".tb-main > svg");
    if (!svg) return;
    if (on) {
      if (this._logoKeep === undefined) this._logoKeep = { html: svg.innerHTML, box: svg.getAttribute("viewBox") };
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.innerHTML = `<defs><linearGradient id="dpgh" x1="2" y1="3" x2="22" y2="21" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7ADFFD"/><stop offset=".5" stop-color="#22A9F9"/><stop offset="1" stop-color="#1C7DF9"/></linearGradient></defs><path d="${MDI.heart}" fill="url(#dpgh)"/>`;
      // Neu starten: dieselbe Animation noch einmal (Klasse weg, Layout erzwingen, Klasse wieder dran)
      svg.classList.remove("ee-heart");
      void svg.getBoundingClientRect();
      svg.classList.add("ee-heart");
    } else if (this._logoKeep !== undefined) {
      svg.classList.remove("ee-heart");
      svg.setAttribute("viewBox", this._logoKeep.box);
      svg.innerHTML = this._logoKeep.html;
      this._logoKeep = undefined;
    }
  }

  _heartOn() {
    return Date.now() < (this._eeUntil || 0);
  }

  // Ein Herzschlag-Strich über die ganze Breite: drei Schläge (P-Welle, Ausschlag, T-Welle); die Linie wird von links aufgedeckt
  _heartbeatSvg(W, H) {
    const base = H * 0.62;
    let d = `M0 ${base}`;
    for (const x0 of [W * 0.1, W * 0.43, W * 0.76]) {
      const u = W * 0.0125;
      d += ` H${(x0).toFixed(1)} q${(2 * u).toFixed(1)} -8 ${(4 * u).toFixed(1)} 0 h${(2 * u).toFixed(1)} l${u.toFixed(1)} 6 l${(2 * u).toFixed(1)} -${(base - 8).toFixed(1)} l${(2 * u).toFixed(1)} ${(base + 10).toFixed(1)} l${u.toFixed(1)} -${(H - 8 - base).toFixed(1)} h${(2 * u).toFixed(1)} q${(3 * u).toFixed(1)} -14 ${(6 * u).toFixed(1)} 0`;
    }
    d += ` H${W}`;
    const delay = `-${Math.max(0, (Date.now() - (this._eeAt || Date.now())) / 1000).toFixed(2)}s`;
    return `<svg class="ee-ecg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" style="--ee-delay:${delay}"><path d="${d}" vector-effect="non-scaling-stroke"/></svg>`;
  }

  _pulseChartHtml(p, incidents, tap = false, sel = null) {
    const n = p.length;
    const max = Math.max(...p);
    const W = 480;
    const H = 84;
    const x = (i) => (((i + 0.5) / n) * W).toFixed(1);
    const y = (v) => (H - 3 - (max ? (v / max) * (H - 12) : 0)).toFixed(1);
    const pt = (i) => `${x(i)},${y(p[i])}`;
    // Läufe gleicher Farbe: Strecke i..i+1 ist rot, wenn ein Ende über 0 liegt.
    const runs = [];
    for (let i = 0; i < n - 1; i++) {
      const off = p[i] > 0 || p[i + 1] > 0;
      const last = runs[runs.length - 1];
      if (last && last.off === off) last.to = i + 1;
      else runs.push({ off, from: i, to: i + 1 });
    }
    if (n === 1) runs.push({ off: p[0] > 0, from: 0, to: 0 });
    const path = (r) => `M${Array.from({ length: r.to - r.from + 1 }, (_, k) => pt(r.from + k)).join(" L")}`;
    const areas = runs
      .filter((r) => r.off)
      .map((r) => `<path class="area" d="${path(r)} L${x(r.to)},${H} L${x(r.from)},${H} Z"/>`)
      .join("");
    const lines = runs.map((r) => `<path class="line ${r.off ? "off" : "ok"}" d="${path(r)}" vector-effect="non-scaling-stroke"/>`).join("");
    // Auf die Minute abgerundet: Mit der Sekunde der Abfrage änderte sich der
    // Text der Achse alle 10 s, setHtml ersetzte die ganze Kachelreihe, und ein
    // Tipp genau dabei ging verloren (Fenster öffnete sich nicht).
    const end = Math.floor((this._serverNow || Date.now() / 1000) / 60) * 60;
    const start = end - 86400;
    const size = 86400 / n;
    const span = (i) => `${this._fmtTime(start + i * size)}–${this._fmtTime(start + (i + 1) * size)}`;
    const hits = p
      .map((v, i) => {
        if (!v) return "";
        const rx = `x="${((i / n) * W).toFixed(1)}" y="0" width="${(W / n).toFixed(1)}" height="${H}"`;
        const tip = `<title>${escape(this._t("pulseTip", span(i), v))}</title>`;
        return tap ? `<rect class="phit${sel === i ? " sel" : ""}" ${rx} data-pulse-at="${i}">${tip}</rect>` : `<rect ${rx} fill="transparent">${tip}</rect>`;
      })
      .join("");
    const marks = incidents
      .filter((inc) => inc.at >= start)
      .map((inc) => `<span class="imark" style="left:${(((inc.at - start) / 86400) * 100).toFixed(2)}%" title="${escape(this._t("incidentTitle", this._fmtTime(inc.at)))}"></span>`)
      .join("");
    const ticks = this._ticks(start, end, "24h")
      .map((tk) => `<span class="${tk.minor ? "minor" : ""}" style="left:${tk.pos.toFixed(2)}%">${escape(tk.label)}</span>`)
      .join("");
    const beat = !tap && this._heartOn() ? this._heartbeatSvg(W, H) : "";
    return `<div class="pchart${max ? "" : " quiet"}${beat ? " ee" : ""}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="${tap ? "false" : "true"}">
        <line class="base" x1="0" x2="${W}" y1="${H - 0.5}" y2="${H - 0.5}" vector-effect="non-scaling-stroke"/>
        ${areas}${lines}${hits}</svg>${beat}${marks}</div>
      <div class="pticks">${ticks}<span class="now-label">${escape(this._t("now"))}</span></div>`;
  }

  // Hinweis auf einen Sammelausfall (mehrere Geräte fast gleichzeitig): in der Kachel
  // und, seit 1.26.0, im Fenster "Unterbrüche in 24 Std." (auf dem Handy zeigt die
  // schlanke Kachel nur die Titelzeile).
  _incidentHtml(inc) {
    const integ = inc.integration ? this._integrations[inc.integration] || inc.integration : null;
    return `<div class="inc" title="${escape((inc.names || []).join(", "))}"><b>${escape(this._t("incidentTitle", this._fmtTime(inc.at)))}</b><span class="inc-text">${escape(this._t("incidentText", inc.count, integ))}</span></div>`;
  }

  // Ausfall-Puls: Zahl der Geräte mit Unterbruch je 30 Min. über 24 Std.,
  // dazu der jüngste Sammelausfall (mehrere Geräte fast gleichzeitig).
  _pulseHtml(all) {
    const p = this._headPulse(all);
    const incidents = this._headIncidents(all);
    if (!p || !p.length) return "";
    const inc = incidents[0];
    const outages = all.reduce((a, d) => a + (d.avail24?.outages || 0), 0);
    const affected = all.filter((d) => d.avail24?.outages).length;
    let note;
    if (inc) {
      note = this._incidentHtml(inc);
    } else if (outages) {
      note = `<div class="pnote plink">${escape(this._t("pulseSummary", outages, affected))}${mdi("chevron", 15)}</div>`;
    } else {
      note = `<div class="pnote ok">${escape(this._t("pulseNone"))}</div>`;
    }
    // Mit Unterbrüchen öffnet die Kachel das Fenster mit den Geräten
    // (seit 0.26.0, docs/mockups/pulse-v1, A).
    const open = affected ? ` tap" data-pulse-open role="button" tabindex="0" aria-label="${escape(this._t("pulseOpen"))}` : "";
    return `<div class="kt pul${this._heartOn() ? " ee" : ""}${open}"><div class="k">${mdi("pulse", 16)}${escape(this._t("pulseTitle"))}${this._scopeHtml()}${affected ? `<span class="kchev">${mdi("chevron", 16)}</span>` : ""}</div>
      ${this._pulseChartHtml(p, incidents)}${note}</div>`;
  }

  // Geräte im Kopf: mit Filter "Bereich" nur dessen, überwacht (nicht deaktiviert).
  _headDevices() {
    return this._devices.filter((d) => !d.disabled && !d.unmonitored && this._scopePass(d));
  }

  // --- Fenster "Unterbrüche in 24 Std." (seit 0.26.0, docs/mockups/pulse-v1, A)

  _openPulse() {
    const dlg = this.shadowRoot.querySelector("dialog.pulse-dlg");
    if (!dlg) return;
    this._pulseAt = null;
    this._renderPulse(true);
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    dlg.scrollTop = 0;
    if (window.matchMedia?.(TOUCH_QUERY).matches) this.shadowRoot.activeElement?.blur();
  }

  _closePulse() {
    const dlg = this.shadowRoot.querySelector("dialog.pulse-dlg");
    if (dlg?.open) {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }
  }

  // force: vor dem Öffnen (der Dialog ist noch zu).
  _renderPulse(force = false) {
    const dlg = this.shadowRoot.querySelector("dialog.pulse-dlg");
    if (!dlg || (!dlg.open && !force)) return;
    const t = (k, ...a) => this._t(k, ...a);
    const head = this._headDevices();
    const p = this._headPulse(head) || [];
    const incidents = this._headIncidents(head);
    const hit = head.filter((d) => d.avail24?.outages);
    const outages = hit.reduce((a, d) => a + d.avail24.outages, 0);
    const total = hit.reduce((a, d) => a + (d.avail24.offline || 0), 0);
    if (this._pulseAt != null && !(p[this._pulseAt] > 0)) this._pulseAt = null;
    const at = this._pulseAt;
    const list = (at == null ? hit : head.filter((d) => this._inPulse(d, at, p.length))).sort(
      (a, b) => (b.avail24?.outages || 0) - (a.avail24?.outages || 0) || (b.avail24?.offline || 0) - (a.avail24?.offline || 0) || String(a.name).localeCompare(String(b.name))
    );
    const sub = hit.length ? t("pulseWinSub", outages, hit.length, this._fmtSeconds(total)) : t("pulseNone");
    const scope = this._scopeText() ? ` · ${this._scopeText()}` : "";
    let pick = "";
    if (at != null) {
      const end = this._serverNow || Date.now() / 1000;
      const size = 86400 / p.length;
      const from = end - 86400 + at * size;
      pick = `<div class="ppick"><button type="button" class="chip on" data-pulse-clear aria-label="${escape(t("pulseWinClear"))}">${mdi("pulse", 15)}<span>${escape(
        t("pulseTip", `${this._fmtTime(from)}–${this._fmtTime(from + size)}`, list.length)
      )}</span>${mdi("close", 14)}</button></div>`;
    }
    const rows = list
      .map((d) => {
        const a = d.avail24 || {};
        const pill = d.online === false ? `<span class="pill off sm">${escape(t("statusOffline"))}</span>` : "";
        const subline = [d.area, this._integName(d)].filter(Boolean).join(" · ");
        return `<button type="button" class="prow" data-pulse-dev="${escape(d.id)}">${this._avatar(d, 16)}
          <span class="pname"><span class="pn">${escape(d.name)}${pill}</span><small>${escape(subline)}</small></span>
          <span class="pval"><span><b>${escape(String(a.outages || 0))}×</b> <small>${escape(t("statTotal", this._fmtSeconds(a.offline || 0)))}</small></span>${this._availHtml(d)}</span></button>`;
      })
      .join("");
    const html = `<div class="dlg-head stat-head"><span class="dlg-avatar">${mdi("pulse", 24)}</span>
        <div class="dlg-title"><h2>${escape(t("pulseWinTitle"))}</h2><div class="dlg-sub">${escape(sub + scope)}</div></div>
        <button type="button" class="dlg-close" data-pulse-close title="${escape(t("close"))}" aria-label="${escape(t("close"))}">${mdi("close", 18)}</button></div>
      <div class="dlg-body"><div class="avail pwin">${this._pulseChartHtml(p, incidents, true, at)}${incidents.slice(0, 3).map((inc) => this._incidentHtml(inc)).join("")}</div>
        <p class="dlg-note small">${escape(t("pulseWinHint"))}</p>${pick}
        <h3>${escape(t("pulseWinList"))}</h3>${rows ? `<div class="plist">${rows}</div>` : `<p class="dlg-note">${escape(t("pulseNone"))}</p>`}</div>
      <div class="dlg-actions"><button type="button" class="dlg-btn" data-pulse-close>${mdi("close", 18)}${escape(t("close"))}</button></div>`;
    const scroll = dlg.scrollTop;
    if (setHtml(dlg, html)) dlg.scrollTop = scroll;
  }

  _bindPulse(dlg) {
    dlg.addEventListener("click", (ev) => {
      if (ev.target === dlg) {
        const r = dlg.getBoundingClientRect();
        if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) this._closePulse();
        return;
      }
      const hit = ev.target.closest("[data-pulse-at]");
      if (hit) {
        const i = Number(hit.dataset.pulseAt);
        this._pulseAt = this._pulseAt === i ? null : i;
        this._renderPulse();
        return;
      }
      if (ev.target.closest("[data-pulse-clear]")) {
        this._pulseAt = null;
        this._renderPulse();
        return;
      }
      const dev = ev.target.closest("[data-pulse-dev]");
      if (dev) {
        // Gerät öffnen: das Fenster schliesst, das Popup übernimmt.
        this._closePulse();
        this._openDevice(dev.dataset.pulseDev);
        return;
      }
      if (ev.target.closest("[data-pulse-close]")) this._closePulse();
    });
  }

  // --- Protokoll (seit 1.38.0, docs/mockups/popup-tabs-log-v1, P1) ----------------
  // Eigener Knopf in der Kopfzeile, Fenster gross auf dem Desktop, auf dem Handy vollflächig. Die Einträge
  // liegen in der Integration und bleiben über Neustarts erhalten (nur Administratoren); das Fenster fragt alle 4 Sekunden nach.

  _logState() {
    if (!this._log) {
      this._log = { entries: [], debug: false, since: null, max: 500, loaded: false, error: null };
      this._logUi = { q: "", level: "all", cat: "all" };
    }
    return this._log;
  }

  _openLog() {
    const dlg = this.shadowRoot.querySelector("dialog.log-dlg");
    if (!dlg) return;
    this._logState();
    this._renderLogFrame();
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    if (window.matchMedia?.(TOUCH_QUERY).matches) this.shadowRoot.activeElement?.blur();
    this._fetchLog();
    window.clearInterval(this._logTimer);
    this._logTimer = window.setInterval(() => this._fetchLog(), 4000);
  }

  _closeLog() {
    window.clearInterval(this._logTimer);
    const dlg = this.shadowRoot.querySelector("dialog.log-dlg");
    if (dlg?.open) {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }
  }

  async _logCall(msg, soft = false) {
    const log = this._logState();
    try {
      const res = await this._callWithTimeout(msg, 10000);
      this._debugOn = Boolean(res.debug);
      this._apps.paintDots();
      Object.assign(log, { entries: res.entries || [], debug: Boolean(res.debug), debugUntil: res.debug ? res.debug_until ?? null : null, since: res.since ?? null, max: res.max || 500, loaded: true, error: null });
    } catch (err) {
      log.error = errText(err);
      log.loaded = true;
    }
    this._renderLogBody(soft);
  }

  _fetchLog() {
    return this._logCall({ type: "device_panel/get_log" }, true);
  }

  // Fester Teil (Kopf, Suche, Chips, Fuss): wird nur beim Öffnen gebaut, damit die Eingabe beim Nachfragen bleibt.
  _renderLogFrame() {
    const dlg = this.shadowRoot.querySelector("dialog.log-dlg");
    const t = (k, ...a) => this._t(k, ...a);
    dlg.innerHTML = `<div class="dlg-head"><span class="dlg-avatar">${mdi("log", 28)}</span>
        <div class="dlg-title"><h2>${escape(t("logTitle"))}</h2><div class="dlg-sub" data-lg="sub"></div></div>
        <button type="button" class="dlg-close" data-lg-close title="${escape(t("close"))}" aria-label="${escape(t("close"))}">${mdi("close", 18)}</button></div>
      <div class="lg-bar">
        <label class="list-search lg-search">${mdi("search", 18)}<input type="search" data-lg-search value="${escape(this._logUi.q)}" placeholder="${escape(t("logSearch"))}" aria-label="${escape(t("logSearch"))}" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false">${this._fieldClearHtml("data-lg-clear", "", this._logUi.q)}</label>
        <div class="lg-chips" data-lg="levels"></div>
        <div class="lg-chips" data-lg="cats"></div>
        <label class="lg-check" title="${escape(t("logDebugHint"))}"><input type="checkbox" data-lg-debug><span>${escape(t("logDebug"))}</span><small data-lg="dbuntil"></small></label>
      </div>
      <div class="lg-list" data-lg="list" role="list"></div>
      <div class="lg-foot"><span data-lg="count"></span><span class="sp"></span>
        <button type="button" class="lg-btn" data-lg-copy>${mdi("copy", 16)}<span>${escape(t("logCopy"))}</span></button>
        <button type="button" class="lg-btn" data-lg-reset>${escape(t("logClear"))}</button></div>`;
    this._renderLogBody();
  }

  _logFiltered() {
    const log = this._logState();
    const { q, level, cat } = this._logUi;
    const needle = q.trim().toLocaleLowerCase();
    return [...log.entries]
      .filter((e) => (level === "all" || e.level === level) && (cat === "all" || e.cat === cat))
      .filter((e) => !needle || `${e.title} ${e.text} ${e.detail} ${this._t(`logCat_${e.cat}`)}`.toLocaleLowerCase().includes(needle))
      .sort((a, b) => b.at - a.at);
  }

  _logTime(e) {
    const d = new Date(e.at * 1000);
    let time;
    try {
      time = d.toLocaleTimeString(this._locale(), { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      time = d.toISOString().slice(11, 19);
    }
    return time;
  }

  _logDay(e) {
    const d = new Date(e.at * 1000);
    const today = new Date();
    const key = (x) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
    if (key(d) === key(today)) return this._t("logToday");
    today.setDate(today.getDate() - 1);
    if (key(d) === key(today)) return this._t("logYesterday");
    try {
      return d.toLocaleDateString(this._locale(), { weekday: "short", day: "numeric", month: "numeric", year: "numeric" });
    } catch {
      return d.toISOString().slice(0, 10);
    }
  }

  // Wechselnder Teil: Chips mit Zahlen, Liste, Fuss. Schreibt nur, was sich geändert hat (setHtml).
  _renderLogBody(soft = false) {
    const dlg = this.shadowRoot.querySelector("dialog.log-dlg");
    if (!dlg || !dlg.querySelector('[data-lg="list"]')) return;
    // Beim Nachfragen nicht mitten in einer Wischbewegung neu aufbauen (siehe _dlgBusy).
    if (soft && dlg.open && this._dlgBusy(dlg)) {
      window.clearTimeout(this._logRetry);
      this._logRetry = window.setTimeout(() => this._renderLogBody(true), 500);
      return;
    }
    const t = (k, ...a) => this._t(k, ...a);
    const log = this._logState();
    const ui = this._logUi;
    const inCat = (e) => ui.cat === "all" || e.cat === ui.cat;
    const inLevel = (e) => ui.level === "all" || e.level === ui.level;
    const needle = ui.q.trim().toLocaleLowerCase();
    const inText = (e) => !needle || `${e.title} ${e.text} ${e.detail} ${t(`logCat_${e.cat}`)}`.toLocaleLowerCase().includes(needle);
    // Zahlen der Chips: je Gruppe nach den übrigen Filtern
    const count = (fn) => log.entries.filter(fn).length;
    const levels = [["all", t("logAll"), count((e) => inCat(e) && inText(e))]];
    if (log.debug || log.entries.some((e) => e.level === "debug")) levels.push(["debug", t("logLevel_debug"), count((e) => e.level === "debug" && inCat(e) && inText(e))]);
    for (const l of ["info", "warning", "error"]) levels.push([l, t(`logLevel_${l}`), count((e) => e.level === l && inCat(e) && inText(e))]);
    const cats = [["all", t("logAll"), count((e) => inLevel(e) && inText(e))]];
    for (const c of ["charge", "outage", "battery", "push", "magic", "routine", "updates", "new", "system"]) cats.push([c, t(`logCat_${c}`), count((e) => e.cat === c && inLevel(e) && inText(e))]);
    const dot = (l) => (l === "all" ? "" : `<span class="lg-dot ${l}"></span>`);
    const chip = (attr, [id, label, n], on) =>
      `<button type="button" class="chip${on === id ? " on" : ""}" ${attr}="${id}" aria-pressed="${on === id}">${dot(id)}<span>${escape(label)}</span><span class="n">${n}</span></button>`;
    const lv = dlg.querySelector('[data-lg="levels"]');
    const ct = dlg.querySelector('[data-lg="cats"]');
    setHtml(lv, levels.map((x) => chip("data-lg-level", x, ui.level)).join(""));
    setHtml(ct, cats.map((x) => chip("data-lg-cat", x, ui.cat)).join(""));
    const check = dlg.querySelector("[data-lg-debug]");
    if (check.checked !== log.debug) check.checked = log.debug;
    // Der Schalter läuft 48 Stunden (auch über Neustarts von HA): wann er sich ausschaltet
    dlg.querySelector('[data-lg="dbuntil"]').textContent = log.debug && log.debugUntil ? t("logDebugUntil", this._fmtTime(log.debugUntil, true)) : t("logDebugFor");
    const shown = this._logFiltered();
    let body = "";
    if (log.error) body += `<div class="dlg-error">${escape(t("logError"))} ${escape(log.error)}</div>`;
    let day = "";
    for (const e of shown) {
      const d = this._logDay(e);
      if (d !== day) {
        day = d;
        body += `<div class="lg-day" role="presentation">${escape(d)}</div>`;
      }
      const open = e.device_id && this._devices.some((x) => x.id === e.device_id);
      const tag = open ? "button" : "div";
      body += `<${tag}${open ? ` type="button" data-lg-open="${escape(e.device_id)}"` : ""} class="lg-row ${e.level}" role="listitem">
        <span class="lg-rt">${escape(this._logTime(e))}</span><span class="lg-lv"><span class="lg-dot ${e.level}" title="${escape(t(`logLevel_${e.level}`))}"></span></span>
        <span class="lg-cat"><span class="lg-pill ${e.cat}">${escape(t(`logCat_${e.cat}`))}</span></span>
        <span class="lg-msg">${e.title ? `<b>${escape(e.title)}</b> · ` : ""}${escape(e.text)}${e.detail ? `<small>${escape(e.detail)}</small>` : ""}</span></${tag}>`;
    }
    if (!shown.length && log.loaded && !log.error) body += `<p class="dlg-note lg-none">${escape(t(log.entries.length ? "logNoneFilter" : "logNone"))}</p>`;
    const list = dlg.querySelector('[data-lg="list"]');
    const keep = list.scrollTop;
    if (setHtml(list, body)) list.scrollTop = keep;
    const since = log.since ? this._fmtTime(log.since, false) : "";
    setHtml(dlg.querySelector('[data-lg="sub"]'), escape(t("logSub", log.max, since)));
    setHtml(dlg.querySelector('[data-lg="count"]'), escape(t("logCount", log.entries.length, shown.length)));
  }

  _logText() {
    const rows = this._logFiltered().reverse();
    return rows
      .map((e) => {
        const d = new Date(e.at * 1000);
        const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${d.toTimeString().slice(0, 8)}`;
        return `${stamp} [${e.level.toUpperCase()}] [${this._t(`logCat_${e.cat}`)}] ${e.title ? `${e.title}: ` : ""}${e.text}${e.detail ? ` (${e.detail})` : ""}`;
      })
      .join("\n");
  }

  _bindLog(dlg) {
    this._trackBusy(dlg);
    const rerender = () => this._renderLogBody();
    dlg.addEventListener("click", async (ev) => {
      if (ev.target === dlg) {
        const r = dlg.getBoundingClientRect();
        if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) this._closeLog();
        return;
      }
      const el = ev.target.closest("[data-lg-close],[data-lg-level],[data-lg-cat],[data-lg-clear],[data-lg-copy],[data-lg-reset],[data-lg-open]");
      if (!el) return;
      if (el.matches("[data-lg-close]")) this._closeLog();
      else if (el.matches("[data-lg-level]")) {
        this._logUi.level = el.dataset.lgLevel;
        rerender();
      } else if (el.matches("[data-lg-cat]")) {
        this._logUi.cat = el.dataset.lgCat;
        rerender();
      } else if (el.matches("[data-lg-clear]")) {
        this._logUi.q = "";
        const input = dlg.querySelector("[data-lg-search]");
        input.value = "";
        el.hidden = true;
        input.focus();
        rerender();
      } else if (el.matches("[data-lg-copy]")) {
        const label = el.querySelector("span");
        if (await this._copyText(this._logText(), null) && label) {
          const old = label.textContent;
          label.textContent = this._t("logCopied");
          window.setTimeout(() => {
            if (label.isConnected) label.textContent = old;
          }, 1500);
        }
      } else if (el.matches("[data-lg-reset]")) {
        await this._logCall({ type: "device_panel/clear_log" });
      } else if (el.matches("[data-lg-open]")) {
        // Das Geräte-Popup öffnet über dem Protokoll; schliesst es, ist man wieder im Protokoll.
        this._openDevice(el.dataset.lgOpen);
      }
    });
    dlg.addEventListener("input", (ev) => {
      if (ev.target.matches("[data-lg-search]")) {
        this._logUi.q = ev.target.value;
        const clear = dlg.querySelector("[data-lg-clear]");
        if (clear) clear.hidden = !ev.target.value;
        rerender();
      }
    });
    dlg.addEventListener("change", (ev) => {
      if (ev.target.matches("[data-lg-debug]")) this._logCall({ type: "device_panel/set_log", debug: ev.target.checked });
    });
    dlg.addEventListener("close", () => window.clearInterval(this._logTimer));
  }

  _chipsHtml(all) {
    // Welche Chips erscheinen, richtet sich nach allen Geräten (sonst sprängen
    // sie beim Tippen); die Zahl nach den übrigen Filtern samt Suche.
    const present = new Map();
    for (const d of all) present.set(this._connOf(d), (present.get(this._connOf(d)) || 0) + 1);
    const base = all.filter((d) => this._scopePass(d) && this._problemPass(d) && this._hintPass(d, this._hint) && this._searchPass(d));
    const counts = new Map();
    for (const d of base) counts.set(this._connOf(d), (counts.get(this._connOf(d)) || 0) + 1);
    const chip = (key, label, n, icon = "", on = this._conn === key) =>
      `<button type="button" class="chip ${on ? "on" : ""} ${n ? "" : "zero"}" data-conn="${key}" aria-pressed="${on}">${icon}<span>${escape(label)}</span> <span class="n">${n}</span></button>`;
    // Jeder Chip als eigenes Stück ("Alle" und jede Verbindungsart auch); die
    // Reihenfolge bestimmt die Einstellung "Reihenfolge der Chips" (seit 1.13.0,
    // seit 1.14.0 eine Folge). Standard: Bereich zuerst (erst den Bereich
    // wählen, dann mit den Chips filtern), dann "Alle" mit den Verbindungsarten,
    // dann "Ausgefallen", "Warnungen" und die Hinweise.
    const parts = new Map();
    parts.set("area", this._areaChipHtml(all));
    parts.set("integration", this._integChipHtml(all));
    // "Alle" ist nur ohne jeden Filter aktiv; die Zahl zeigt wie überall, was
    // nach dem Antippen erscheint: alle Geräte (mit der Suche).
    const none = this._conn === "all" && !this._problems && !this._offlineOnly && !this._hint && !this._scoped();
    parts.set("all", chip("all", this._t("all"), all.filter((d) => this._searchPass(d)).length, "", none));
    for (const key of Object.keys(CONN)) {
      parts.set(key, present.has(key) && !this._hideConn.has(key) ? chip(key, this._t(CONN[key].key), counts.get(key) || 0, CONN[key].icon(15)) : "");
    }
    // "Ausgefallen" und "Warnungen" (seit 1.16.0): wie die Hinweise nur, wenn sie
    // bei irgendeinem Gerät zutreffen (oder aktiv sind); die Zahl zählt mit allen
    // übrigen Filtern ausser diesen beiden.
    const others = all.filter((d) => this._scopePass(d) && this._connPass(d) && this._hintPass(d, this._hint) && this._searchPass(d));
    const level = (key, test, on, attr, icon, label, cls) => {
      if (this._hideChips.has(key) || (!on && !all.some(test))) return "";
      const n = others.filter(test).length;
      return `<button type="button" class="chip ${cls} ${on ? "on" : ""} ${n ? "" : "zero"}" ${attr} aria-pressed="${on}">${mdi(icon, 15)}<span>${escape(this._t(label))}</span> <span class="n">${n}</span></button>`;
    };
    parts.set("offline", level("offline", devOffline, this._offlineOnly, "data-offline", "closeCircle", "chipOffline", "off"));
    parts.set("problems", level("problems", devWarn, this._problems, "data-problems", "alert", "chipWarnings", "warn"));
    // Hinweise als Filter-Chips, nur wenn sie bei irgendeinem Gerät zutreffen
    // (oder aktiv sind).
    const rest = all.filter((d) => this._scopePass(d) && this._connPass(d) && this._problemPass(d) && this._searchPass(d));
    for (const { key, cls, icon, label, test, bare } of HINTS) {
      const on = this._hint === key;
      if (this._hideChips.has(key) || (!on && !bare && !all.some(test))) {
        parts.set(key, "");
        continue;
      }
      if (bare) {
        parts.set(key, `<button type="button" class="chip hint bare ${cls} ${on ? "on" : ""}" data-hint="${key}" aria-pressed="${on}" title="${escape(this._t(label))}" aria-label="${escape(this._t(label))}">${mdi(icon, 16)}</button>`);
        continue;
      }
      const n = rest.filter(test).length;
      parts.set(key, `<button type="button" class="chip hint ${cls} ${on ? "on" : ""} ${n ? "" : "zero"}" data-hint="${key}" aria-pressed="${on}">${mdi(icon, 15)}<span>${escape(this._t(label))}</span> <span class="n">${n}</span></button>`);
    }
    return joinChips(chipOrder(this._chipOrder, this._connOrder, present), parts);
  }

  // Angeheftete Chips (seit 1.15.0) kleben auf dem Handy links. Nehmen sie mehr
  // als 60 % der Leiste ein, bliebe zu wenig Platz zum Scrollen: dann scrollen
  // sie wie die übrigen mit. Auf dem Desktop (Leiste bricht um) ohne Wirkung.
  _guardPin() {
    const bar = this.shadowRoot.querySelector(".chips");
    const pin = bar?.querySelector(".chip-pin");
    if (pin) pin.classList.toggle("too-wide", pin.offsetWidth > bar.clientWidth * 0.6);
  }

  // Handy: eine Zeile "Sortierung & Ansicht" unter den Chips mit der gewählten Sortierung rechts; öffnet das Blatt
  // "Ansicht" (seit 2.0.5, docs/mockups/sort-line-v1, C; ersetzt die Pille und den Knopf oben, die dasselbe öffneten).
  _viewLineHtml() {
    const v = this._view;
    const label = this._sortLabel(v.sort);
    const dir = v.sort === "default" ? "" : mdi(v.dir === "asc" ? "arrowUp" : "arrowDown", 14);
    const title = this._t("viewLineTitle");
    return `<button type="button" class="sort-btn" data-view-open aria-label="${escape(`${title}: ${label}`)}">${mdi("viewSettings", 16)}<span class="lbl">${escape(title)}</span><span class="val">${escape(label)}</span>${dir}${mdi("chevronDown", 16)}</button>`;
  }

  _avatar(d, size = 18) {
    const cls = d.online === false ? "off" : d.online == null ? "none" : d.flaky ? "warn" : "";
    // Logo der Integration, wenn der Brand-Dienst von HA eines liefert; sonst das Icon der Verbindungsart.
    const src = this._brandSrc(d.integration?.domain);
    const icon = src ? `<img class="brand" src="${escape(src)}" alt="" width="${size + 6}" height="${size + 6}" draggable="false">` : CONN[this._connOf(d)].icon(size);
    return `<div class="av ${cls}${src ? " has-brand" : ""}">${icon}<span class="dot"></span></div>`;
  }

  // Kennzeichen einer Integration in den Einstellungen (seit 1.23.0): ihr Logo, sonst
  // die Anfangsbuchstaben auf farbigem Grund.
  _ibadge(domain, name) {
    const src = this._brandSrc(domain);
    return src
      ? `<span class="ibadge has-img"><img src="${escape(src)}" alt="" width="22" height="22" draggable="false"></span>`
      : `<span class="ibadge" style="--h:${hue(domain)}">${escape(initials(name))}</span>`;
  }

  // Logos der Integrationen (seit 1.22.0): vom Brand-Dienst der eigenen HA-Instanz
  // (ab 2026.3, /api/brands/integration/<Domain>/icon.png), geschützt durch ein Token
  // (WebSocket brands/access_token, läuft ab: alle 10 Min. neu holen). Nichts geht ins
  // Internet. Ohne Dienst (ältere HA) oder ohne Logo bleibt das Verbindungs-Icon.
  // Seit 2.35.0 erholt sich das von selbst (Fehler: nach dem Öffnen der Companion-App fehlten alle Logos bis zum Neustart der App):
  // scheitert die Abfrage (Verbindung verloren), wird sie mit wachsendem Abstand wiederholt, statt es nie wieder zu versuchen;
  // nur "unknown_command" (ältere HA) beendet es. Beim Aufwachen wird ein altes Token erneuert (die Zeitgeber ruhen im Hintergrund).
  async _brandStart() {
    await this._brandLoad();
    window.clearInterval(this._brandTimer);
    this._brandTimer = window.setInterval(() => this._brandLoad(), BRAND_TOKEN_MS);
  }

  async _brandLoad() {
    if (this._brandOff || this._brandBusy || !this._hass) return;
    this._brandBusy = true;
    try {
      const res = await this._hass.callWS({ type: "brands/access_token" });
      const token = res?.token || null;
      this._brandAt = Date.now();
      this._brandTries = 0;
      if (token !== this._brandToken) {
        this._brandToken = token;
        // Mit neuem Token alle als gescheitert vermerkten Logos neu versuchen (der Fehler kann am alten Token gelegen haben)
        for (const [domain, state] of this._brandState || []) if (state === "fail") this._brandState.delete(domain);
        this._brandRenderSoon();
      }
    } catch (err) {
      if (err?.code === "unknown_command") {
        // Ältere HA ohne Brand-Dienst: nicht wieder fragen
        this._brandOff = true;
        this._brandToken = null;
      } else {
        window.clearTimeout(this._brandRetry);
        this._brandRetry = window.setTimeout(() => this._brandLoad(), Math.min(60000, 3000 * 2 ** Math.min(this._brandTries++, 5)));
      }
    } finally {
      this._brandBusy = false;
    }
  }

  // Beim Aufwachen: kein Token oder ein altes Token erneuern
  _brandWake() {
    if (this._brandOff || !this._brandReady) return;
    if (!this._brandToken || Date.now() - (this._brandAt || 0) > BRAND_STALE_MS) this._brandLoad();
  }

  _brandRenderSoon() {
    window.clearTimeout(this._brandRender);
    this._brandRender = window.setTimeout(() => {
      this._render();
      if (this._settings?.data && this.shadowRoot.querySelector("dialog.settings")?.open) this._renderSettings();
    }, 60);
  }

  // Die Logos aller gezeigten Integrationen einmal laden (höchstens 2 s warten), bevor
  // die Liste zum ersten Mal erscheint; so baut sich die Liste nicht nachträglich um.
  async _brandPreload(devices) {
    await this._brandPreloadDomains(devices.map((d) => d.integration?.domain));
  }

  async _brandPreloadDomains(domains) {
    const wait = (ms) => new Promise((ok) => window.setTimeout(ok, ms));
    await Promise.race([this._brandReady, wait(1500)]);
    if (!this._brandToken) return;
    this._brandState ||= new Map();
    const todo = [...new Set(domains.filter((x) => x && !this._brandState.has(x)))];
    if (todo.length) await Promise.race([Promise.all(todo.map((x) => this._brandProbe(x))), wait(2000)]);
  }

  // Adresse des Logos oder null (noch unbekannt, nicht vorhanden, kein Token).
  _brandSrc(domain) {
    if (!domain || !this._brandToken) return null;
    this._brandState ||= new Map();
    // Ein gescheitertes Bild (Netz weg, 401) wird nach einer Weile neu versucht; "kein Logo" (404) kostet dann nur eine Anfrage
    if (this._brandState.get(domain) === "fail" && Date.now() - (this._brandFailAt?.get(domain) || 0) > (this._brandFailMs ?? BRAND_FAIL_MS)) this._brandState.delete(domain);
    if (!this._brandState.has(domain)) this._brandProbe(domain).then(() => this._brandRenderSoon());
    const known = this._brandState.get(domain);
    return known && known !== "fail" && known !== "pending" ? `/api/brands/integration/${encodeURIComponent(domain)}/${known}?token=${encodeURIComponent(this._brandToken)}` : null;
  }

  // Lädt das Bild einmal und merkt das Ergebnis; im dunklen Design zuerst dark_icon.png,
  // sonst oder ersatzweise icon.png. Die Zusage endet, wenn das Ergebnis feststeht.
  _brandProbe(domain) {
    this._brandState.set(domain, "pending");
    const dark = this._hass?.themes?.darkMode ?? window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const files = dark ? ["dark_icon.png", "icon.png"] : ["icon.png"];
    return new Promise((done) => {
      const next = (i) => {
        if (i >= files.length) {
          this._brandState.set(domain, "fail");
          (this._brandFailAt ||= new Map()).set(domain, Date.now());
          done();
          return;
        }
        const img = new Image();
        img.onload = () => {
          this._brandState.set(domain, files[i]);
          done();
        };
        img.onerror = () => next(i + 1);
        img.src = `/api/brands/integration/${encodeURIComponent(domain)}/${files[i]}?token=${encodeURIComponent(this._brandToken)}`;
      };
      next(0);
    });
  }

  // Einstellungen pro Gerät beim Namen (Variante A, docs/mockups/override-v1):
  // je Art ein Symbol, Wert und globaler Wert im Tooltip.
  _overrideHtml(d) {
    const out = [];
    const tag = (cls, icon, text, label) =>
      `<span class="ovr ${cls}" role="img" title="${escape(label)}" aria-label="${escape(label)}">${mdi(icon, 12)}${text ? escape(text) : ""}</span>`;
    if (d.offline_setting === "off") out.push(tag("time-off", "timer", "", this._t("ovrTimeOffTip")));
    else if (Number.isInteger(d.offline_setting)) out.push(tag("time", "timer", this._t("offlineMin", d.offline_setting), this._t("ovrTimeOwnTip", this._t("offlineMin", d.offline_setting))));
    if (Number.isInteger(d.notify_delay_setting)) out.push(tag("time", "bell", this._t("offlineMin", d.notify_delay_setting), this._t("ovrDelayOwnTip", this._t("offlineMin", d.notify_delay_setting))));
    const setting = d.battery_setting;
    if (setting === "off") out.push(tag("bat-off", "batteryOff", "", this._t("ovrBatOffTip")));
    else if (Number.isInteger(setting)) out.push(tag("bat", "battery", `${setting} %`, this._t("ovrBatOwnTip", setting, d.battery_default?.pct ?? 15)));
    if (d.notify_off) out.push(tag("mute", "bellOff", "", this._t("ovrNotifyOffTip")));
    if (d.signal_setting === "off") out.push(tag("sig-off", "signalOff", "", this._t("ovrSigOffTip")));
    else if (Number.isInteger(d.signal_setting)) out.push(tag("sig", "signal", "", this._t("ovrSigOwnTip", sigLimitText(d.signal_setting))));
    if (d.connection_manual && CONN[d.connection]) {
      // Ohne die Wahl am Gerät gälte die Integration, sonst die Erkennung.
      const base = d.connection_integration && CONN[d.connection_integration] ? d.connection_integration : this._connAuto(d);
      const label = this._t("ovrConnTip", this._t(CONN[d.connection].key), this._t(CONN[base].key));
      out.push(`<span class="ovr conn" role="img" title="${escape(label)}" aria-label="${escape(label)}">${CONN[d.connection].icon(12)}</span>`);
    }
    return out.length ? `<span class="ovrs">${out.join("")}</span>` : "";
  }

  // Neu (seit 0.21.0): die ersten 3 Tage nach dem Anlegen in HA (Backend).
  _newTagHtml(d) {
    if (!d.new) return "";
    const at = d.created_at ? this._fmtTime(Date.parse(d.created_at) / 1000, true, true) : "";
    return `<span class="new-tag" title="${escape(this._t("newTip", at))}">${escape(this._t("newTag"))}</span>`;
  }

  _statusHtml(d) {
    if (d.disabled) return `<span class="pill none">${escape(this._t("statusDisabled"))}</span>`;
    if (d.unmonitored) return `<span class="pill none">${escape(this._t("statusUnmonitored"))}</span>`;
    if (d.online === false) return `<div class="dur">${this._durationHtml(d)}</div><div class="durs">${escape(this._t("statusOffline"))}</div>`;
    if (d.online == null) return `<span class="pill none">${escape(this._t("statusNoData"))}</span>`;
    if (d.flaky) return `<span class="pill warn">${escape(this._t("statusFlaky"))}</span><div class="durs">${escape(this._t("flakyOutages", d.avail24.outages))}</div>`;
    return `<span class="pill on"><span class="pd"></span>${escape(this._t("statusOnline"))}</span>`;
  }

  _connHtml(d, withVia = true) {
    const type = this._connOf(d);
    const level = devSigLevel(d);
    const sig = level ? ` ${bars(level, d.online === false)} <span class="val">${escape(sigText(d.signal))}</span>` : "";
    const via = withVia && d.via ? `<span class="sub">${escape(this._t("via", d.via))}</span>` : "";
    return `<span class="sig">${CONN[type].icon(16)} ${escape(this._t(CONN[type].key))}${sig}</span>${via}`;
  }

  _availHtml(d) {
    const a = d.avail24;
    if (!a) return `<span class="t3">–</span>`;
    const pct = a.pct != null ? `${escape(this._fmtPct(a.pct))} %` : `<span class="t3" title="${escape(this._t("pctWait"))}">–</span>`;
    return `<span class="avc ${a.outages ? "bad" : ""}">${stripSvg(a.strip || [])}${pct}</span>`;
  }

  _typeHtml(d) {
    return `<span class="typ">${typeIcon(d.type, 16)}${escape(this._t(typeKey(d.type)))}</span>`;
  }

  _batteryHtml(d) {
    const b = d.battery;
    if (!b) return `<span class="t3">–</span>`;
    const text = b.level != null ? `${b.level} %` : b.low ? this._t("batteryLow") : "OK";
    // Lädt gerade (seit 1.35.0): Blitz im Symbol, grün.
    if (d.charging) return `<span class="bat chg" title="${escape(this._t("chargingSince", this._duration(d.charging.since)))}">${mdi("batteryCharging", 14)} ${escape(text)}</span>`;
    return `<span class="bat ${b.low ? "low" : ""}">${batIcon(b, 14)} ${escape(text)}</span>`;
  }

  // Ladende Geräte (seit 1.35.0, docs/mockups/charging-state-v1, B und C): grüne Pille "lädt" in der Liste;
  // bei gewähltem Chip "Lädt" dazu Stand, Start und Dauer sowie ein Füllstandsbalken.
  _chargingView() {
    return this._hint === "charging";
  }

  _chargingPillHtml(d, title = true) {
    if (!d.charging) return "";
    const tip = title ? ` title="${escape(this._t("chargingSince", this._duration(d.charging.since)))}"` : "";
    return `<span class="pill chg"${tip}>${mdi("batteryCharging", 13)}${escape(this._t("chargingPill"))}</span>`;
  }

  _chargingInfoHtml(d) {
    const c = d.charging;
    if (!c) return "";
    const dur = this._duration(c.since);
    const text = c.level != null && c.from != null ? this._t("chargingInfo", c.level, c.from, dur) : c.level != null ? this._t("chargingInfoNoStart", c.level, dur) : this._t("chargingSince", dur);
    return `${this._chargeBarHtml(c)}<span class="sub chg-sub">${escape(text)}</span>`;
  }

  // Ladebalken mit Ziel (seit 1.41.0, docs/mockups/charge-target-v1, Variante C): liegt "Voll ab" unter 100 %,
  // ist der Rest hinter dem Ziel schraffiert, mit Strich und kleiner Zahl am Ziel. Bei 100 % bleibt der Balken wie er war.
  _chargeBarHtml(c) {
    if (c.level == null) return "";
    const goal = Number.isFinite(c.full) && c.full > 0 && c.full < 100 ? Math.round(c.full) : null;
    const mark = goal == null ? "" : `<b class="chg-rest" style="left:${goal}%"></b><b class="chg-tick" style="left:${goal}%"></b><span class="chg-goal" style="left:${goal}%">${goal}</span>`;
    return `<span class="chg-bar${goal == null ? "" : " has-goal"}" aria-hidden="true"${goal == null ? "" : ` title="${escape(this._t("chargeGoal", goal))}"`}><i style="width:${Math.max(0, Math.min(100, c.level))}%"></i>${mark}</span>`;
  }

  _softwareHtml(d) {
    const upd = d.update ? `<span class="pill upd" title="${escape(this._t("updateTo", d.update))}">${escape(this._t("update"))}</span>` : "";
    return `${escape(d.sw_version || "–")}${upd}`;
  }

  // Gruppen [Klasse, Titel, Hinweis, Geräte]. Ansicht "Liste": eine
  // Gruppe ohne Titel. Eine gewählte Sortierung geht vor; sonst sortieren die
  // Batterie-Chips nach Stand, und jede Gruppe hat ihre eigene Folge.
  _groups(rows) {
    const byName = (a, b) => String(a.name).localeCompare(String(b.name));
    const outages = (d) => d.avail24?.outages || 0;
    const active = rows.filter((d) => !d.disabled && !d.unmonitored);
    // Chip "Lädt": der volleste zuerst (fast fertig); Batterie-Chips: der leerste zuerst.
    const chosen = this._sortCmp() || (this._batterySort() ? (a, b) => batteryRank(a) - batteryRank(b) || byName(a, b) : this._chargingView() ? (a, b) => (b.charging?.level ?? -1) - (a.charging?.level ?? -1) || byName(a, b) : null);
    const groups = [
      ["e", this._t("groupOffline"), this._t("groupOfflineHint"), active.filter((d) => d.online === false).sort((a, b) => Date.parse(a.offline_since) - Date.parse(b.offline_since))],
      ["w", this._t("groupFlaky"), this._t("groupFlakyHint", this._flakyOutages), active.filter((d) => d.online === true && d.flaky).sort((a, b) => outages(b) - outages(a) || byName(a, b))],
      ["n", this._t("groupNoData"), this._t("groupNoDataHint"), active.filter((d) => d.online == null).sort(byName)],
      ["", this._t("groupOnline"), null, active.filter((d) => d.online === true && !d.flaky).sort(byName)],
      // Nur mit "Deaktivierte Geräte anzeigen": am Ende, nicht überwacht.
      ["d", this._t("groupDisabled"), this._t("groupDisabledHint"), rows.filter((d) => d.disabled).sort(byName)],
      // Integration auf "Nicht überwachen": sichtbar, ohne Status und Meldungen.
      ["d", this._t("groupUnmonitored"), this._t("groupUnmonitoredHint"), rows.filter((d) => d.unmonitored).sort(byName)],
    ].filter((g) => g[3].length);
    // Chip "Lädt": eine Liste nach Stand (der volleste zuerst), ohne Gruppen, wie im Mockup charging-state-v1.
    if (this._view.flat || (this._chargingView() && !this._sortCmp())) {
      // Ohne gewählte Sortierung in der Folge der Gruppen, nur ohne Köpfe.
      const list = chosen ? [...rows].sort(chosen) : groups.flatMap((g) => g[3]);
      return list.length ? [["flat", null, null, list]] : [];
    }
    return chosen ? groups.map((g) => [g[0], g[1], g[2], [...g[3]].sort(chosen)]) : groups;
  }

  _batterySort() {
    return this._hint === "batteries" || this._hint === "battery";
  }

  _listHtml(rows) {
    if (this._loading) return `<div class="note">${escape(this._t(this._offline ? "reconnecting" : "loading"))}</div>`;
    if (this._error) return `<div class="note">${escape(this._t("error"))} ${escape(this._error)}</div>`;
    if (!rows.length) return `<div class="note">${escape(this._t("empty"))}</div>`;
    return this._narrowQuery.matches ? this._cardsHtml(rows) : this._tableHtml(rows);
  }

  _tableHtml(rows) {
    const v = this._view;
    const keys = v.cols.filter(([, on]) => on).map(([k]) => k);
    const dash = `<span class="t3">–</span>`;
    const cell = {
      status: (d) => this._statusHtml(d),
      connection: (d) => this._connHtml(d),
      avail: (d) => this._availHtml(d),
      type: (d) => this._typeHtml(d),
      integration: (d) => {
        const title = this._integTitle(d);
        return `${escape(this._integName(d) || "–")}${title ? `<span class="sub">${escape(title)}</span>` : ""}`;
      },
      battery: (d) => this._batteryHtml(d),
      model: (d) => `${escape(d.manufacturer || "–")}${d.model ? `<span class="sub">${escape(d.model)}</span>` : ""}`,
      software: (d) => this._softwareHtml(d),
      area: (d) => (d.area ? escape(d.area) : dash),
      outages: (d) => (d.avail24 ? `<span class="${d.avail24.outages ? "nbad" : ""}">${d.avail24.outages || 0}</span>` : dash),
      via: (d) => (d.via ? escape(d.via) : dash),
    };
    // Kopf: Klick sortiert (aufsteigend, absteigend, Standard).
    const th = (key) => {
      const sorted = v.sort === key;
      const label = this._t(COL_LABEL[key]);
      const icon = sorted ? mdi(v.dir === "asc" ? "arrowUp" : "arrowDown", 14) : mdi("sort", 14);
      const aria = sorted ? (v.dir === "asc" ? "ascending" : "descending") : "none";
      return `<th class="${sorted ? "sorted" : ""}" aria-sort="${aria}"><button type="button" class="th-sort" data-sort="${key}" title="${escape(this._t("sortTip", label))}">${escape(label)}${icon}</button></th>`;
    };
    const head = `<thead><tr>${["name", ...keys].map(th).join("")}</tr></thead>`;
    // Bereich unter dem Namen nur, solange er keine eigene Spalte hat.
    const areaSub = !keys.includes("area");
    const chargingView = this._chargingView();
    const span = keys.length + 1;
    const body = this._groups(rows)
      .map(([cls, title, hint, list]) =>
        (title == null ? "" : `<tr class="grp ${cls}"><td colspan="${span}"><span class="gl">${escape(title)} · ${list.length}${hint ? ` <small>${escape(hint)}</small>` : ""}</span></td></tr>`) +
        list
          .map(
            (d) => `<tr class="dev ${d.online === false ? "off" : d.online && d.flaky ? "flaky" : ""}" data-open="${escape(d.id)}" tabindex="0">
            <td><div class="nc">${this._avatar(d)}<div>${escape(d.name)}${this._newTagHtml(d)}${this._overrideHtml(d)}${this._chargingPillHtml(d)}${chargingView ? this._chargingInfoHtml(d) : areaSub && d.area ? `<span class="sub">${escape(d.area)}</span>` : ""}</div></div></td>
            ${keys.map((k) => `<td>${cell[k](d)}</td>`).join("")}</tr>`
          )
          .join("")
      )
      .join("");
    return `<div class="tcard"><table>${head}<tbody>${body}</tbody></table></div>`;
  }

  // Eine Angabe auf der Karte (Handy); leer, wenn das Gerät sie nicht hat.
  _fieldHtml(d, key) {
    switch (key) {
      case "type":
        return escape(this._t(typeKey(d.type)));
      case "integration":
        return escape(this._integName(d) || "");
      case "area":
        return escape(d.area || "");
      case "battery":
        return d.battery ? this._batteryHtml(d) : "";
      case "avail":
        return d.avail24?.pct != null ? escape(this._t("fieldAvail", this._fmtPct(d.avail24.pct))) : "";
      case "model":
        return escape([d.manufacturer, d.model].filter(Boolean).join(" "));
      case "software":
        return d.sw_version ? escape(this._t("fieldSw", d.sw_version)) : "";
      default:
        return "";
    }
  }

  _cardsHtml(rows) {
    // Mit einem Batterie-Chip zeigt jede Karte den Stand.
    const batSort = this._batterySort();
    const fields = this._view.fields.filter(([, on]) => on).map(([k]) => k);
    const showConn = fields.includes("connection");
    const metaKeys = fields.filter((k) => k !== "connection");
    const meta = (d) => metaKeys.map((k) => this._fieldHtml(d, k)).filter(Boolean).join(" · ");
    const batExtra = batSort && !metaKeys.includes("battery");
    const chargingView = this._chargingView();
    // Online ohne Auffälligkeit: kompakte Zeile; sonst eine Karte mit Dauer.
    const compact = (d) => d.online === true && !d.flaky && !d.disabled;
    // Rechts: ladend die grüne Pille (bei gewähltem Chip nur das Symbol, der Stand steht im Balken), sonst schwache
    // Batterie oder Empfang.
    const rowRight = (d) => (d.charging ? (chargingView ? `<span class="bat chg">${mdi("batteryCharging", 16)}</span>` : this._chargingPillHtml(d)) : d.battery?.low || batSort ? this._batteryHtml(d) : bars(devSigLevel(d), false));
    const row = (d) => `<div class="mrow dev${d.charging && chargingView ? " chg" : ""}" data-open="${escape(d.id)}" tabindex="0" role="button">${this._avatar(d, 16)}<div>${escape(d.name)}${this._newTagHtml(d)}${this._overrideHtml(d)}<span class="sub">${meta(d)}</span>${chargingView ? this._chargingInfoHtml(d) : ""}</div>
              <div>${rowRight(d)}</div></div>`;
    const card = (d) => {
      let right = this._statusHtml(d);
      if (d.online === false) right = `<div class="dur">${this._durationHtml(d, true)}</div><div class="durs">${escape(this._t("statusOffline"))}</div>`;
      const sb = `${showConn ? this._connHtml(d, false) : ""}${batExtra ? ` ${this._batteryHtml(d)}` : ""}${d.charging && !batExtra ? ` ${this._chargingPillHtml(d)}` : ""}`;
      const m = meta(d);
      return `<div class="mc dev ${d.online === false ? "off" : d.flaky ? "flaky" : ""}" data-open="${escape(d.id)}" tabindex="0" role="button">${this._avatar(d)}
            <div><div class="nm">${escape(d.name)}${this._newTagHtml(d)}${this._overrideHtml(d)}</div>${sb.trim() ? `<div class="sb">${sb}</div>` : ""}${m ? `<div class="sb2">${m}</div>` : ""}${chargingView ? this._chargingInfoHtml(d) : ""}</div>
            <div class="rt">${right}</div></div>`;
    };
    return `<div class="cards">${this._groups(rows)
      .map(([cls, title, , list]) => {
        if (title == null) {
          // Liste: aufeinanderfolgende kompakte Zeilen in einem Block.
          let html = "";
          let run = [];
          const flush = () => {
            if (run.length) html += `<div class="mlist">${run.map(row).join("")}</div>`;
            run = [];
          };
          for (const d of list) {
            if (compact(d)) run.push(d);
            else {
              flush();
              html += card(d);
            }
          }
          flush();
          return html;
        }
        const head = `<div class="gh ${cls}">${escape(title)} · ${list.length}</div>`;
        if (cls === "") return head + `<div class="mlist">${list.map(row).join("")}</div>`;
        return head + list.map(card).join("");
      })
      .join("")}</div>`;
  }

  // --- Geräte-Popup ---------------------------------------------------------

  // tab: Reiter, mit dem das Popup beginnt; editRule: Meldung, die der Assistent von Magic Push gleich öffnet
  _openDevice(id, tab = "ov", editRule = null, editRoutine = null) {
    const dlg = this.shadowRoot.querySelector("dialog.device");
    if (!dlg || !id) return;
    this._closeStat();
    this._detailId = id;
    this._devTab = tab;
    this._devQ = { ent: "", sw: "" };
    this._devSub = "out";
    this._detail = null;
    this._magic.open(id);
    if (editRule) this._magic.editWhenLoaded(editRule);
    this._routines.open(id);
    if (editRoutine) this._routines.editWhenLoaded(editRoutine);
    this._aiLoadLast(id);
    this._renderDevice();
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    this._blurOnTouch();
    dlg.scrollTop = 0;
    this._stickDevTabs(dlg);
    this._loadDetail(true);
  }

  // Die Reiter bleiben unter dem Kopf haften: Höhe des Kopfes als Abstand (je nach Warnungen und Namen verschieden;
  // bei geschlossenem Dialog ist sie 0, darum auch nach dem Öffnen messen).
  _stickDevTabs(dlg) {
    const h = dlg.querySelector(".dlg-head")?.offsetHeight;
    if (h) dlg.style.setProperty("--dev-head-h", `${h}px`);
  }

  _closeDevice() {
    this._closeStat();
    const dlg = this.shadowRoot.querySelector("dialog.device");
    this._resetDevice();
    if (dlg?.open) {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }
  }

  // --- Einheitlich speichern (seit 2.20.0) -----------------------------------------------------------------------
  // Typ, Verbindungsart und alle Einstellungen eines Geräts werden gesammelt und mit "Speichern" übernommen, wie die
  // Einstellungen im Zahnrad. Schliessen mit offenen Änderungen fragt in der Mitte "Änderungen verwerfen?" (wie der
  // Assistent von Magic Push). Das Gerät zeigt die gewählten Werte schon vorher (Entwurf in this._devDraft).

  // Wert eines Felds so, wie ihn der Server annimmt (null = Standard bzw. automatisch)
  _devGet(d, key) {
    // Meldungen: "aus" und "stumm bis" zusammen, weil jede Wahl im Popup ein "stumm bis" aufhebt
    if (key === "notify") return `${d.notify_off ? 1 : 0}|${d.notify_mute_until || ""}`;
    if (key === "type") return d.type_manual ? d.type : null;
    if (key === "connection") return d.connection_manual ? d.connection : null;
    return d[`${key}_setting`] ?? null;
  }

  _devPut(d, key, value) {
    if (key === "notify") {
      const [off, mute] = String(value).split("|");
      d.notify_off = off === "1";
      d.notify_mute_until = mute || null;
    }
    else if (key === "type") {
      d.type = value || d.type_integration || d.type_auto || d.type;
      d.type_manual = Boolean(value);
    } else if (key === "connection") {
      d.connection = value || d.connection_integration || (d.connection_auto !== undefined ? d.connection_auto : d.connection);
      d.connection_manual = Boolean(value);
    } else d[`${key}_setting`] = value;
  }

  _devEdit(id, changes) {
    const d = this._devices.find((x) => x.id === id);
    if (!d) return;
    if (this._devDraft?.id !== id) this._devDraft = { id, orig: {}, cur: {} };
    const dr = this._devDraft;
    for (let [key, value] of Object.entries(changes)) {
      if (key === "notify" && typeof value === "boolean") value = value ? "0|" : "1|";
      if (!(key in dr.orig)) dr.orig[key] = this._devGet(d, key);
      dr.cur[key] = value;
      this._devPut(d, key, value);
    }
    this._devSetError = null;
    this._devSaved = false;
    this._render();
  }

  // Geänderte Felder (ein Feld, das wieder auf den alten Wert steht, zählt nicht)
  _devChanges() {
    const dr = this._devDraft;
    if (!dr) return [];
    return Object.keys(dr.orig).filter((k) => JSON.stringify(dr.cur[k] ?? null) !== JSON.stringify(dr.orig[k] ?? null));
  }

  // Nach dem Neuladen der Liste die noch nicht gespeicherten Werte wieder einsetzen
  _reapplyDevDraft() {
    const dr = this._devDraft;
    if (!dr) return;
    const d = this._devices.find((x) => x.id === dr.id);
    if (d) for (const [key, value] of Object.entries(dr.cur)) this._devPut(d, key, value);
  }

  _devDiscard() {
    const dr = this._devDraft;
    if (!dr) return;
    const d = this._devices.find((x) => x.id === dr.id);
    if (d) for (const [key, value] of Object.entries(dr.orig)) this._devPut(d, key, value);
    this._devDraft = null;
    this._devSaved = false;
  }

  async _devSave() {
    const dr = this._devDraft;
    const keys = this._devChanges();
    if (!dr || !keys.length || this._devSaving) return;
    this._devSaving = true;
    this._devSetError = null;
    this._renderDevice();
    // Fehler dort anzeigen, wo der Wert steht (Typ, Verbindungsart, sonst Einstellungen)
    let step = "settings";
    this._typeError = null;
    this._connError = null;
    try {
      if (keys.includes("type")) {
        step = "type";
        await this._hass.callWS({ type: "device_panel/set_device_type", device_id: dr.id, device_type: dr.cur.type ?? null });
      }
      if (keys.includes("connection")) {
        step = "connection";
        await this._hass.callWS({ type: "device_panel/set_device_connection", device_id: dr.id, connection: dr.cur.connection ?? null });
      }
      step = "settings";
      const settings = {};
      for (const key of keys) if (key !== "type" && key !== "connection") settings[key] = key === "notify" ? String(dr.cur[key]).startsWith("0") : dr.cur[key] ?? null;
      if (Object.keys(settings).length) await this._hass.callWS({ type: "device_panel/set_device_settings", device_id: dr.id, ...settings });
      this._devDraft = null;
      this._devSaved = true;
    } catch (err) {
      if (step === "type") this._typeError = errText(err);
      else if (step === "connection") this._connError = errText(err);
      else this._devSetError = errText(err);
    }
    this._devSaving = false;
    this._render();
    this._fetch(true);
  }

  // Schliessen: ohne Änderung sofort, sonst erst fragen; "after" läuft danach (zum Beispiel zur Geräteseite)
  _requestCloseDevice(after) {
    if (!this._devChanges().length) {
      this._closeDevice();
      after?.();
      return;
    }
    this._askDiscard(() => {
      this._devDiscard();
      this._closeDevice();
      this._fetch(true);
      after?.();
    });
  }

  // Rückfrage "Änderungen verwerfen?" als Pop-up in der Mitte, über jedem Fenster (eigenes modales Fenster)
  _askDiscard(onYes) {
    this._askConfirm({ title: "discardTitle", note: "discardNote", no: "discardNo", yes: "discardYes", noIcon: "pencil", yesIcon: "trash" }, onYes);
  }

  // Dieselbe Rückfrage für andere Entscheidungen (zum Beispiel "Home Assistant neu starten?"); keys: Textschlüssel
  _askConfirm(keys, onYes) {
    const dlg = this.shadowRoot.querySelector("dialog.discard-dlg");
    if (!dlg) {
      onYes();
      return;
    }
    this._discardYes = onYes;
    dlg.innerHTML = `<div class="dd-card" role="alertdialog" aria-labelledby="dd-t"><b id="dd-t">${escape(this._t(keys.title))}</b><small>${escape(this._t(keys.note))}</small>
      <div class="dd-btns"><button type="button" class="dlg-btn" data-dd="no">${mdi(keys.noIcon || "close", 18)}${escape(this._t(keys.no))}</button><button type="button" class="dlg-btn danger" data-dd="yes">${mdi(keys.yesIcon || "check", 18)}${escape(this._t(keys.yes))}</button></div></div>`;
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    // Fokus auf die sichere Antwort, damit Enter nichts auslöst
    dlg.querySelector('[data-dd="no"]')?.focus({ preventScroll: true });
  }

  // Home Assistant neu starten (Knopf im Launcher, seit 2.81.0): erst nach der Rückfrage. Den Dienst prüft HA selbst (nur Administratoren)
  // und lehnt bei ungültiger Konfiguration ab; beim Neustart bricht die Verbindung ab, das ist kein Fehler.
  async _restartHa() {
    const apps = this._apps;
    apps?.snack(this._t("restartStarting"));
    try {
      await this._callService("homeassistant", "restart", {});
    } catch (err) {
      if (!isConnectionError(err)) apps?.snack(`${this._t("verRestartError")} ${errText(err)}`);
    }
  }

  _bindDiscard(dlg) {
    dlg.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-dd]");
      if (!btn) return;
      const run = btn.dataset.dd === "yes" ? this._discardYes : null;
      this._discardYes = null;
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
      run?.();
    });
    // Escape: zurück ins Bearbeiten
    dlg.addEventListener("close", () => {
      this._discardYes = null;
    });
  }

  _setDeviceType(id, kind) {
    this._typeError = null;
    this._devEdit(id, { type: kind });
  }

  _setDeviceConnection(id, kind) {
    this._connError = null;
    this._devEdit(id, { connection: kind });
  }

  _setDeviceSettings(id, changes) {
    this._devEdit(id, changes);
  }

  _resetDevice() {
    // Offene Änderungen verfallen mit dem Schliessen (Rückfrage kam vorher)
    this._devDiscard();
    this._devSaved = false;
    this._devSaving = false;
    this._rename = null;
    this._hideError = null;
    this._connError = null;
    this._devSetError = null;
    this._devRangeError = null;
    this._sigRangeError = null;
    this._offRangeError = null;
    this._delayRangeError = null;
    this._chargeRangeError = null;
    this._chargeFullRangeError = null;
    this._chargeStallRangeError = null;
    this._typeError = null;
    this._detailId = null;
    this._detail = null;
    this._hist = null;
    this._magic.reset();
    this._routines.reset();
    // Im Popup können Meldungen geändert worden sein: die Fenster mit allen Meldungen und Routinen neu laden
    this._loadMagicAll();
    this._loadRtAll();
  }

  // Entitäten und Kurzstatistik (7 Tage) holt erst das Popup.
  async _loadDetail(force = false) {
    const id = this._detailId;
    if (!id || !this._hass) return;
    const cur = this._detail;
    if (!force && cur && cur.id === id && (cur.loading || Date.now() - cur.at < DETAIL_MAX_AGE_MS)) return;
    const prev = cur && cur.id === id ? cur.data : null;
    this._detail = { id, data: prev, loading: true, at: Date.now() };
    try {
      const data = await this._hass.callWS({ type: "device_panel/device", device_id: id });
      if (this._detailId !== id) return;
      this._detail = { id, data, loading: false, at: Date.now() };
    } catch (err) {
      if (this._detailId !== id) return;
      this._detail = { id, data: prev, loading: false, error: errText(err), at: Date.now() };
    }
    this._renderDevice();
  }

  _statTile(range, label, valueHtml, sub, kind = "avail", bad = false, warn = false, extra = "") {
    return `<button type="button" class="st-tile${warn ? " warned" : ""}" data-dlg="stat" data-range="${range}" data-kind="${kind}">
      <span class="st-k">${escape(label)}</span><span class="st-v${bad ? " bad" : ""}">${valueHtml}</span>${extra}<span class="st-sub">${escape(sub)}</span>${mdi("chevron", 16).replace('class="ic"', 'class="ic chev"')}</button>`;
  }

  _staticTile(label, valueHtml, sub, bad = false, warn = false) {
    return `<div class="st-tile static${warn ? " warned" : ""}"><span class="st-k">${escape(label)}</span><span class="st-v${bad ? " bad" : ""}">${valueHtml}</span><span class="st-sub">${escape(sub || "")}</span></div>`;
  }

  _tile(label, valueHtml) {
    return `<div class="tile"><div class="tile-k">${escape(label)}</div><div class="tile-v">${valueHtml}</div></div>`;
  }

  _statTilesHtml(d) {
    const detail = this._detail?.id === d.id ? this._detail.data : null;
    // 24 Std. kommt schon mit der Liste, 7 Tage erst mit dem Popup.
    const s24 = detail ? detail.stats?.["24h"] : d.avail24;
    const s7 = detail ? detail.stats?.["7d"] : undefined;
    const tiles = [];
    tiles.push(
      this._statTile(
        "24h",
        this._t("tileAvail"),
        s24?.pct != null ? `${escape(this._fmtPct(s24.pct))}<small>%</small>` : `<span class="t3">–</span>`,
        !s24
          ? this._t("statNoData")
          : s24.outages
            ? this._t("statOutages", s24.outages, this._fmtSeconds(s24.longest))
            : s24.pct == null
              ? this._t("pctWait")
              : this._t("statNoOutages"),
        "avail",
        false,
        Boolean(d.flaky)
      )
    );
    let v7 = `<span class="t3">…</span>`;
    let sub7 = this._t("loadingDetail");
    if (s7 === null) {
      v7 = `<span class="t3">–</span>`;
      sub7 = this._t("statNoData");
    } else if (s7) {
      v7 = escape(String(s7.outages));
      sub7 = s7.outages ? this._t("statTotal", this._fmtSeconds(s7.offline)) : this._t("statNoOutages");
    }
    tiles.push(this._statTile("7d", this._t("tileOutages7"), v7, sub7));
    const level = devSigLevel(d);
    // Tipp öffnet den Verlauf (seit 0.24.0, Wunsch des Nutzers).
    if (level) tiles.push(this._statTile("24h", this._t("tileSignal"), `${bars(level, d.online === false)}${escape(sigText(d.signal))}`, this._t("tierNames")[level], "signal", false, level === 1));
    if (d.battery) {
      const b = d.battery;
      const value = `${batIcon(b, 18)}${b.level != null ? `${escape(String(b.level))}<small>%</small>` : escape(b.low ? this._t("batteryLow") : "OK")}`;
      // Mit Prozent: Tipp öffnet den Verlauf; "schwach ja/nein" nur als Kachel.
      const chg = d.charging ? this._t("chargingSince", this._duration(d.charging.since)) : null;
      if (b.level != null) tiles.push(this._statTile("30d", this._t("tileBattery"), d.charging ? `${mdi("batteryCharging", 18)}${escape(String(b.level))}<small>%</small>` : value, chg || (b.low ? this._t("batteryLow") : this._t("batHistoryHint")), "battery", b.low, b.low, d.charging ? this._chargeBarHtml({ ...d.charging, level: b.level }) : ""));
      else tiles.push(this._staticTile(this._t("tileBattery"), value, "", b.low, b.low));
    }
    return `<div class="st-tiles" style="--n:${tiles.length}">${tiles.join("")}</div>`;
  }

  // Verbindungsart: im Reiter "Einstellungen" wählbar, in der Übersicht nur Text (seit 1.37.0).
  _connSelHtml(d, edit) {
    const type = this._connOf(d);
    // Verbindungsart wählbar wie der Typ: erkannt oder von Hand, gilt sofort.
    const auto = this._connAuto(d);
    // Ohne Wahl am Gerät gilt die Integration, wenn dort eine festgelegt ist.
    const integ = d.connection_integration && CONN[d.connection_integration] ? d.connection_integration : null;
    const autoText = integ ? this._t("connAutoInteg", this._t(CONN[integ].key)) : this._t("typeAuto", this._t(CONN[auto].key));
    const opts = [`<option value="" ${d.connection_manual ? "" : "selected"}>${escape(autoText)}</option>`]
      .concat(CONN_MANUAL.map((k) => `<option value="${k}" ${d.connection_manual && d.connection === k ? "selected" : ""}>${escape(this._t(CONN[k].key))}</option>`))
      .join("");
    if (!edit) {
      return `<span class="typ-ro">${CONN[type].icon(16)}<span>${escape(this._t(CONN[type].key))}</span></span>${
        d.connection_manual ? `<small>${escape(this._t("typeManual"))}</small>` : integ ? `<small>${escape(this._t("connByInteg"))}</small>` : ""
      }`;
    }
    return `<label class="typ-sel">${CONN[type].icon(16)}<select data-dlg="conn" aria-label="${escape(this._t("connType"))}">${opts}</select>${mdi("chevronDown", 18)}</label>${
      d.connection_manual ? `<small>${escape(this._t("typeManual"))}</small>` : integ ? `<small>${escape(this._t("connByInteg"))}</small>` : ""
    }${this._connError ? `<small class="warn">${escape(this._t("connSaveError"))} ${escape(this._connError)}</small>` : ""}`;
  }

  _connSectionHtml(d) {
    const detail = this._detail?.id === d.id ? this._detail.data : null;
    const connSel = this._connSelHtml(d, false);
    const tiles = [this._tile(this._t("connType"), connSel)];
    if (d.via) tiles.push(this._tile(this._t("viaLabel"), escape(d.via)));
    // Thread-Rolle und Netz aus der Matter-Diagnose (Zusatzangaben, ohne
    // Einstellung); die Verbindungsart von Hand bleibt davon unberührt.
    const mat = (d.connection_auto !== undefined ? d.connection_auto : d.connection) === "matter" ? this._matter.get(d.id) : null;
    if (mat?.role) tiles.push(this._tile(this._t("threadRole"), `${escape(this._t(mat.role))}<small>${escape(this._t(`${mat.role}Hint`))}</small>`));
    if (mat?.network) tiles.push(this._tile(this._t("threadNet"), `${escape(mat.network)}<small>${escape(this._t("threadNetHint"))}</small>`));
    const entries = detail?.config_entries?.length
      ? detail.config_entries
      : d.integration
        ? [{ name: this._integName(d), title: d.integration.title, state: "loaded" }]
        : [];
    for (const e of entries) {
      // Zustand nur, wenn der Eintrag nicht läuft: oft die Ursache eines Ausfalls.
      const state = e.state && e.state !== "loaded" ? this._t("entryStates")[e.state] || e.state : "";
      const title = e.title && e.title !== e.name ? e.title : "";
      tiles.push(
        this._tile(
          this._t("integrationLabel"),
          `${escape(e.name)}${title ? `<small>${escape(title)}</small>` : ""}${state ? `<small class="warn">${escape(state)}</small>` : ""}`
        )
      );
    }
    return `<div class="tiles">${tiles.join("")}</div>`;
  }

  // Variante A (docs/mockups/notify-v1): Batterie-Warnung und Meldungen für
  // dieses Gerät, gilt sofort.
  _deviceNotifyHtml(d) {
    const t = (k, ...a) => this._t(k, ...a);
    const chev = mdi("chevronDown", 18);
    const sel = (name, opts, value, label) =>
      `<span class="opt-select"><select data-dlg="${name}" aria-label="${escape(label)}">${opts
        .map(([v, text]) => `<option value="${v}"${v === value ? " selected" : ""}>${escape(text)}</option>`)
        .join("")}</select>${chev}</span>`;
    const def = d.battery_default || { pct: 15, integration: null };
    const setting = d.battery_setting;
    const mode = setting === "off" ? "off" : Number.isInteger(setting) ? "own" : "default";
    const range = mode === "own" ? this._devRangeError : null;
    const parts = { out: "", bat: "", chg: "", sig: "" };
    // Herkunft unter jeder Einstellung (Variante A, docs/mockups/backlog-v1):
    // Etikett (Standard / Integration / Gerät) und was ohne die Wahl am Gerät
    // gälte; der Tooltip trägt die ausführliche Erklärung.
    const origin = (own, integKey, text, tip) => {
      const name = integKey ? this._integrations[integKey] || integKey : null;
      const [cls, label] = own ? ["own", t("originDevice")] : name ? ["integ", t("originIntegration", name)] : ["std", t("originStandard")];
      return `<div class="opt-origin"><span class="origin ${cls}"${tip ? ` title="${escape(tip)}"` : ""}>${escape(label)}</span><span>${escape(text)}</span></div>`;
    };
    // "Ausgefallen nach" pro Gerät (Punkt 7): Standard der Integration, eigene
    // Zeit in Minuten oder "Nicht überwachen"; das Gerät geht vor.
    {
      const od = d.offline_default || { minutes: 2, integration: null, global: 2 };
      const fmt = (v) => (v === "off" ? t("offlineNone") : t("offlineMin", v));
      const own = d.offline_setting;
      const offMode = own === "off" ? "off" : Number.isInteger(own) ? "own" : "default";
      const offRange = offMode === "own" ? this._offRangeError : null;
      const defLabel = od.integration ? t("devOffInteg", fmt(od.minutes)) : t("devOffGlobal", fmt(od.minutes));
      parts.out += `<div class="opt${offMode !== "default" ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(t("devOffline"))}</span>${sel(
        "dev-off",
        [["default", defLabel], ["own", t("devOffOwn")], ["off", t("devOffNone")]],
        offMode,
        t("devOffline")
      )}</div>${
        offMode === "own"
          ? `<div class="opt-line opt-sub"><span class="opt-label">${escape(t("devOffline"))}</span><span class="opt-input${offRange ? " bad" : ""}"><input type="number" inputmode="numeric" step="1" min="1" max="1440" data-dlg="dev-off-min" value="${escape(offRange ? offRange.value : own)}" aria-label="${escape(t("devOffline"))}"><span class="unit">${escape(t("minuteUnit"))}</span></span></div>${
              offRange ? `<div class="opt-error" data-dev-range>${escape(offRange.message)}</div>` : ""
            }`
          : ""
      }${origin(offMode !== "default", od.integration, offMode !== "default" || od.integration ? t("originDefaultWould", fmt(od.global)) : "", t("devOffShort"))}</div>`;
    }
    // "Erst melden nach" pro Gerät (seit 2.91.0): Standard der Integration bzw. global oder eigene Zeit; nie kürzer als "Ausgefallen nach"
    {
      const nd = d.notify_delay_default || { minutes: 2, integration: null, global: 2 };
      const own = d.notify_delay_setting;
      const dMode = Number.isInteger(own) ? "own" : "default";
      const dRange = dMode === "own" ? this._delayRangeError : null;
      const dLabel = nd.integration ? t("devDelayInteg", t("offlineMin", nd.minutes)) : t("devDelayGlobal", t("offlineMin", nd.minutes));
      // Eigenes "Erst melden nach" kürzer als das wirksame "Ausgefallen nach" des Geräts: Fehler am Feld (der Server lehnt es ebenfalls ab)
      const offEffective = d.offline_setting === "off" ? null : Number.isInteger(d.offline_setting) ? d.offline_setting : d.offline_default?.minutes ?? 2;
      const short = dMode === "own" && Number.isInteger(offEffective) && own < offEffective ? { value: String(own), message: t("integDelayError", t("offlineMin", offEffective)) } : null;
      const bad = dRange || short;
      parts.out += `<div class="opt${dMode !== "default" ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(t("devDelay"))}</span>${sel(
        "dev-delay",
        [["default", dLabel], ["own", t("devDelayOwn")]],
        dMode,
        t("devDelay")
      )}</div>${
        dMode === "own"
          ? `<div class="opt-line opt-sub"><span class="opt-label">${escape(t("devDelay"))}</span><span class="opt-input${bad ? " bad" : ""}"><input type="number" inputmode="numeric" step="1" min="1" max="1440" data-dlg="dev-delay-min" value="${escape(dRange ? dRange.value : own)}" aria-label="${escape(t("devDelay"))}"><span class="unit">${escape(t("minuteUnit"))}</span></span></div>${
              bad ? `<div class="opt-error" data-dev-range>${escape(bad.message)}</div>` : ""
            }`
          : ""
      }${origin(dMode !== "default", nd.integration, dMode !== "default" || nd.integration ? t("originDefaultWould", t("offlineMin", nd.global)) : "", t("devDelayShort"))}</div>`;
    }
    if (d.has_battery) {
      const integ = def.integration ? this._integrations[def.integration] || def.integration : null;
      parts.bat += `<div class="opt${mode !== "default" ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(t("devBattery"))}</span>${sel(
        "dev-bat",
        [["default", def.integration ? t("devBatInteg", def.pct) : t("devBatDefault", def.pct)], ["own", t("devBatOwn")], ["off", t("devBatOff")]],
        mode,
        t("devBattery")
      )}</div>${
        mode === "own"
          ? `<div class="opt-line opt-sub"><span class="opt-label">${escape(t("devBatLow"))}</span><span class="opt-input${range ? " bad" : ""}"><input type="number" inputmode="numeric" step="1" min="1" max="50" data-dlg="dev-bat-pct" value="${escape(range ? range.value : setting)}" aria-label="${escape(t("devBatLow"))}"><span class="unit">%</span></span></div>${
              range ? `<div class="opt-error" data-dev-range>${escape(range.message)}</div>` : ""
            }`
          : ""
      }${origin(
        mode !== "default",
        def.integration || def.push_integration,
        // Push pro Integration aus (seit 0.34.0): steht neben dem Standardwert.
        [mode !== "default" || def.integration ? t("originDefaultWould", this._batteryLow == null ? "15 %" : `${this._batteryLow} %`) : "", def.push_integration ? t("originBatPushOff") : ""]
          .filter(Boolean)
          .join(" · "),
        t("devBatShort", def.pct, integ)
      )}</div>`;
    }
    // Empfang-Warnung (Variante A, docs/mockups/signal-v1): globaler Wert,
    // eigene Schwelle "schwach unter" oder aus; nur mit Empfangswert.
    const own = d.signal_setting;
    if (d.signal?.value != null || own != null) {
      const sigMode = own === "off" ? "off" : Number.isInteger(own) ? "own" : "default";
      const lqi = d.signal ? d.signal.kind === "lqi" : Number.isInteger(own) && own > 0;
      // Was ohne eigene Einstellung gilt (seit 1.17.0): Wert der Integration oder
      // der Funkart, sonst der feste Standard.
      const sdef = d.signal_default || { value: null, source: null };
      const std = sdef.value === "off" ? t("sigOffWord") : sigText({ kind: lqi ? "lqi" : "dbm", value: Number.isInteger(sdef.value) ? sdef.value : sigStd(lqi ? "lqi" : "dbm") });
      const defLabel =
        sdef.source === "integration"
          ? sdef.value === "off" ? t("devSigIntegOff") : t("devSigInteg", std)
          : sdef.value === "off" ? t("devSigDefaultOff") : t("devSigDefault", std);
      const [min, max] = lqi ? SIG_LQI_RANGE : SIG_DBM_RANGE;
      const range = sigMode === "own" ? this._sigRangeError : null;
      // Ohne inputmode: iOS zeigt bei type=number dann die Tastatur mit Minus.
      const mode = lqi ? ' inputmode="numeric"' : "";
      parts.sig += `<div class="opt${sigMode !== "default" ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(t("devSignal"))}</span>${sel(
        "dev-sig",
        [["default", defLabel], ["own", t("devSigOwn")], ["off", t("devSigOff")]],
        sigMode,
        t("devSignal")
      )}</div>${
        sigMode === "own"
          ? `<div class="opt-line opt-sub"><span class="opt-label">${escape(t("devSigLow"))}</span><span class="opt-input${range ? " bad" : ""}"><input type="number"${mode} step="1" min="${min}" max="${max}" data-dlg="dev-sig-val" value="${escape(range ? range.value : own)}" aria-label="${escape(t("devSigLow"))}"><span class="unit">${lqi ? "LQI" : "dBm"}</span></span></div>${
              range ? `<div class="opt-error" data-dev-range>${escape(range.message)}</div>` : ""
            }`
          : ""
      }${origin(sigMode !== "default", sdef.source === "integration" ? d.integration?.domain : null, sigMode !== "default" ? t("originDefaultWould", std) : "", t("devSigShort", d.signal?.value != null ? sigText(d.signal) : null))}</div>`;
    }
    // Lademeldung (seit 1.30.0): Push, sobald das Gerät voll geladen ist; ohne Wahl gilt die Integration.
    if (d.battery?.level != null) {
      const cd = d.charge_default || { on: false, integration: null };
      const cs = d.charge_setting === true ? "on" : d.charge_setting === false ? "off" : "default";
      parts.chg += `<div class="opt${cs !== "default" ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(t("devCharge"))}</span>${sel(
        "dev-charge",
        [["default", t("devChargeDefault", cd.on)], ["on", t("devChargeOn")], ["off", t("devChargeOff")]],
        cs,
        t("devCharge")
      )}</div>${origin(cs !== "default", cd.integration, "", t("devChargeShort"))}</div>`;
      // Live-Aktivität beim Laden (seit 2.19.0): unabhängig von der Lademeldung; Gerät, sonst Integration, sonst global.
      const liveSet = d.charge_live_setting;
      const liveMode = liveSet == null ? "default" : liveSet ? "on" : "off";
      parts.chg += `<div class="opt${liveSet != null ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(t("devChargeLive"))}</span>${sel(
        "dev-charge-live",
        [["default", t("devChargeLiveDefault", Boolean(cd.live), Boolean(cd.live_integration))], ["on", t("devChargeOn")], ["off", t("devChargeOff")]],
        liveMode,
        t("devChargeLive")
      )}</div>${origin(liveSet != null, cd.live_integration, "", t("devChargeLiveShort"))}</div>`;
      const liveOn = liveSet === true || (liveSet == null && Boolean(cd.live));
      const pushOn = cs === "on" || (cs === "default" && cd.on);
      // Eigene Werte (seit 1.35.0): "Voll ab" (bei der Live-Aktivität das Ziel) und Anstieg, wie global; wenn Meldung oder Live-Aktivität gilt.
      if (pushOn || liveOn) {
        const gFull = cd.full ?? 100;
        const gRise = cd.rise ?? 20;
        const fullSet = d.charge_full_setting;
        const riseSet = d.charge_rise_setting;
        // Stufen 100, 95, 90, 80 oder "Eigener Wert" (Zahl); ein Wert ausserhalb der Stufen zeigt "Eigener Wert".
        const fullMode = fullSet == null ? "default" : CHARGE_FULL_PRESETS.includes(fullSet) ? String(fullSet) : "own";
        const fullErr = fullMode === "own" ? this._chargeFullRangeError : null;
        parts.chg += `<div class="opt${fullSet != null ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(t("devChargeFull"))}</span>${sel(
          "dev-charge-full",
          [["default", cd.full_integration ? t("devChargeFullInteg", gFull) : t("devChargeFullGlobal", gFull)], ...CHARGE_FULL_PRESETS.map((v) => [String(v), `${v} %`]), ["own", t("chargeFullOwn")]],
          fullMode,
          t("devChargeFull")
        )}</div>${
          fullMode === "own"
            ? `<div class="opt-line opt-sub"><span class="opt-label">${escape(t("devChargeFull"))}</span><span class="opt-input${fullErr ? " bad" : ""}"><input type="number" inputmode="numeric" step="1" min="${CHARGE_FULL_RANGE[0]}" max="${CHARGE_FULL_RANGE[1]}" data-dlg="dev-charge-full-val" value="${escape(fullErr ? fullErr.value : fullSet)}" aria-label="${escape(t("devChargeFull"))}"><span class="unit">${escape(t("unitPercent"))}</span></span></div>${
                fullErr ? `<div class="opt-error" data-dev-range>${escape(fullErr.message)}</div>` : ""
              }`
            : ""
        }${origin(fullSet != null, cd.full_integration, fullSet != null || cd.full_integration ? t("originDefaultWould", `${gFull} %`) : "", t("devChargeFullShort"))}</div>`;
        const riseMode = riseSet != null ? "own" : "default";
        const riseErr = riseMode === "own" ? this._chargeRangeError : null;
        parts.chg += `<div class="opt${riseMode === "own" ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(t("devChargeRise"))}</span>${sel(
          "dev-charge-rise",
          [["default", cd.rise_integration ? t("devChargeRiseInteg", gRise) : t("devChargeRiseGlobal", gRise)], ["own", t("devChargeRiseOwn")]],
          riseMode,
          t("devChargeRise")
        )}</div>${
          riseMode === "own"
            ? `<div class="opt-line opt-sub"><span class="opt-label">${escape(t("devChargeRiseBy"))}</span><span class="opt-input${riseErr ? " bad" : ""}"><input type="number" inputmode="numeric" step="1" min="2" max="80" data-dlg="dev-charge-rise-val" value="${escape(riseErr ? riseErr.value : riseSet)}" aria-label="${escape(t("devChargeRise"))}"><span class="unit">${escape(t("unitPercent"))}</span></span></div>${
                riseErr ? `<div class="opt-error" data-dev-range>${escape(riseErr.message)}</div>` : ""
              }`
            : ""
        }${origin(riseMode === "own", cd.rise_integration, riseMode === "own" || cd.rise_integration ? t("originDefaultWould", `${gRise} %`) : "", t("devChargeRiseShort"))}</div>`;
        // "Ladung beendet nach" und Push bei beendeter Ladung (seit 1.41.0): Gerät, sonst Integration, sonst global.
        const gStall = cd.stall ?? 15;
        const stallSet = d.charge_stall_setting;
        const stallMode = stallSet != null ? "own" : "default";
        const stallErr = stallMode === "own" ? this._chargeStallRangeError : null;
        parts.chg += `<div class="opt${stallMode === "own" ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(t("devChargeStall"))}</span>${sel(
          "dev-charge-stall",
          [["default", cd.stall_integration ? t("devChargeStallInteg", gStall) : t("devChargeStallGlobal", gStall)], ["own", t("devChargeStallOwn")]],
          stallMode,
          t("devChargeStall")
        )}</div>${
          stallMode === "own"
            ? `<div class="opt-line opt-sub"><span class="opt-label">${escape(t("devChargeStallBy"))}</span><span class="opt-input${stallErr ? " bad" : ""}"><input type="number" inputmode="numeric" step="1" min="5" max="120" data-dlg="dev-charge-stall-val" value="${escape(stallErr ? stallErr.value : stallSet)}" aria-label="${escape(t("devChargeStall"))}"><span class="unit">${escape(t("minuteUnit"))}</span></span></div>${
                stallErr ? `<div class="opt-error" data-dev-range>${escape(stallErr.message)}</div>` : ""
              }`
            : ""
        }${origin(stallMode === "own", cd.stall_integration, stallMode === "own" || cd.stall_integration ? t("originDefaultWould", t("offlineMin", gStall)) : "", t("devChargeStallShort"))}</div>`;
        // Push bei beendeter Ladung: nur mit Lademeldung
        if (pushOn) {
          const stopSet = d.charge_stop_setting;
          const stopMode = stopSet == null ? "default" : stopSet ? "on" : "off";
          parts.chg += `<div class="opt${stopSet != null ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(t("devChargeStop"))}</span>${sel(
            "dev-charge-stop",
            [["default", t("devChargeStopDefault", Boolean(cd.stop), Boolean(cd.stop_integration))], ["on", t("devChargeOn")], ["off", t("devChargeOff")]],
            stopMode,
            t("devChargeStop")
          )}</div>${origin(stopSet != null, cd.stop_integration, "", t("devChargeStopShort"))}</div>`;
        }
      }
    }
    // Stumm (Knopf "24 Std. stumm" in der Meldung): eigene Option mit Ende;
    // "Globale Einstellung" oder "Aus" hebt es auf.
    const muted = d.notify_mute_until && Date.parse(d.notify_mute_until) > Date.now() ? Date.parse(d.notify_mute_until) / 1000 : null;
    const nd = d.notify_default || { push: false, persistent: false, integration: null };
    const notifyOpts = [["on", nd.integration ? t("devNotifyInteg") : t("devNotifyOn")], ...(muted ? [["mute", t("devNotifyMuted", this._fmtTime(muted, true))]] : []), ["off", t("devNotifyOff")]];
    parts.out += `<div class="opt${d.notify_off || muted ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(t("devNotify"))}</span>${sel(
      "dev-notify",
      notifyOpts,
      d.notify_off ? "off" : muted ? "mute" : "on",
      t("devNotify")
    )}</div>${origin(
      Boolean(d.notify_off),
      nd.integration,
      d.notify_off ? t("originNotifyOff") : t("originNotify", nd.push, nd.persistent),
      t("devNotifyShort")
    )}</div>`;
    // Gleiche Reiter wie in den Einstellungen und im Detail einer Integration (seit 1.42.0): Ausfall | Batterie | Laden | Empfang,
    // je Reiter die Grafik wie im globalen Reiter mit den für das Gerät wirksamen Werten. Reiter ohne Inhalt (keine Batterie,
    // kein Empfang) entfallen seit 2.46.0.
    const od = d.offline_default || { minutes: 2, integration: null, global: 2 };
    const offOwn = d.offline_setting;
    const offEff = offOwn === "off" ? "off" : Number.isInteger(offOwn) ? offOwn : od.minutes;
    const silenced = Boolean(d.notify_off || muted);
    const outTl =
      offEff === "off"
        ? this._ptlHtml([{ cls: "mk-off", title: t("offlineNone"), sub: t("tlDevNotMonitored"), w: 100 }])
        : this._ptlHtml(
            // Zwei Balken wie im Reiter der Einstellungen (seit 2.93.0): "Ausgefallen nach" und "Erst melden nach" (nie kürzer, siehe _outageRows)
            this._outageRows(
              offEff,
              Number.isInteger(d.notify_delay_setting) ? d.notify_delay_setting : d.notify_delay_default?.minutes ?? 2,
              !silenced && Boolean(nd.push),
              silenced ? t(d.notify_off ? "tlDevOff" : "tlDevMuted") : nd.integration ? t("tlIntegOff") : t("tlNoTarget")
            )
          );
    const lowEff = mode === "off" ? "off" : mode === "own" ? setting : def.pct;
    const batTl = this._tlHtml([lowEff === "off" ? { at: 14, cls: "mk-off", title: t("devBatOff"), sub: "" } : { at: 14, title: t("tlLow", lowEff), sub: t("tlRed") }], "mtl-b");
    const cdv = d.charge_default || { on: false, integration: null };
    const chargeOn = d.charge_setting === true || (d.charge_setting == null && Boolean(cdv.on));
    const chgTl = this._tlHtml(
      [
        { at: 14, title: t("tlChargeRise", d.charge_rise_setting ?? cdv.rise ?? 20), sub: t("tlChargeRiseSub") },
        chargeOn
          ? { at: 80, cls: "mk-p", title: t("tlChargeFull", d.charge_full_setting ?? cdv.full ?? 100), sub: t("tlChargeFullSub") }
          : { at: 80, cls: "mk-off", title: t("tlNoPush"), sub: t("tlSwitchedOff") },
      ],
      "mtl-b"
    );
    const note = (key) => `<div class="opt-short mon-empty">${escape(t(key))}</div>`;
    const hasSignal = d.signal?.value != null || d.signal_setting != null;
    const bodies = {
      out: outTl + parts.out,
      bat: d.has_battery ? batTl + parts.bat : note("devNoBattery"),
      chg: d.battery?.level != null ? chgTl + parts.chg : note("devNoBattery"),
      sig: hasSignal ? parts.sig : note("devNoSignal"),
    };
    const ownTab = {
      out: d.offline_setting != null || d.notify_delay_setting != null || silenced,
      bat: d.battery_setting != null,
      chg: [d.charge_setting, d.charge_full_setting, d.charge_rise_setting, d.charge_stall_setting, d.charge_stop_setting, d.charge_live_setting].some((v) => v != null),
      sig: d.signal_setting != null,
    };
    // Reiter ohne Inhalt entfallen (seit 2.46.0): ohne Batterie, Ladestand oder Empfang bliebe nur der Hinweis.
    const hasTab = { out: true, bat: Boolean(d.has_battery), chg: d.battery?.level != null, sig: hasSignal };
    const tabs = [["out", "tabOutage"], ["bat", "tabBattery"], ["chg", "tabCharge"], ["sig", "tabSignal"]].filter(([id]) => hasTab[id]);
    const cur = tabs.some(([id]) => id === this._devSub) ? this._devSub : "out";
    // Ohne Reiterleiste nennt ein Titel, worum es geht (sonst steht die Grafik ohne Überschrift im Rahmen)
    const tabBar = tabs.length < 2 ? `<div class="lvl-title">${escape(t(tabs[0][1]))}</div>` : `<div class="sub-tabs lvl-tabs" role="tablist">${tabs
      .map(([id, key]) => `<button type="button" role="tab" class="sub-tab${id === cur ? " on" : ""}${ownTab[id] ? " chg" : ""}" data-dlg="stab" data-stab="${id}" aria-selected="${id === cur}">${escape(t(key))}</button>`)
      .join("")}</div>`;
    const err = this._devSetError ? `<div class="opt-error">${escape(t("devSaveError"))} ${escape(this._devSetError)}</div>` : "";
    return `<div class="dev-set">${tabBar}<div class="lvl-body" role="tabpanel">${bodies[cur]}</div>${err}</div>`;
  }

  // Typ: im Reiter "Einstellungen" wählbar, in der Übersicht nur Text (seit 1.37.0).
  _typeSelHtml(d, edit) {
    // Typ wählbar: automatisch erkannt oder von Hand (für Ausschlüsse, wenn
    // die Erkennung danebenliegt). Gilt sofort, ohne "Speichern".
    // Ohne Wahl am Gerät gilt die Integration, wenn dort ein Typ festgelegt ist.
    const integ = !d.type_manual && d.type_integration && TYPE_ICONS[d.type_integration] ? d.type_integration : null;
    const autoText = integ ? this._t("typeAutoInteg", this._t(typeKey(integ))) : this._t("typeAuto", this._t(typeKey(d.type_auto || d.type)));
    const opts = [`<option value="" ${d.type_manual ? "" : "selected"}>${escape(autoText)}</option>`]
      .concat(TYPE_ORDER.map((k) => `<option value="${k}" ${d.type_manual && d.type === k ? "selected" : ""}>${escape(this._t(typeKey(k)))}</option>`))
      .join("");
    if (!edit) {
      return `<span class="typ-ro">${typeIcon(d.type, 16)}<span>${escape(this._t(typeKey(d.type)))}</span></span>${
        d.type_manual ? `<small>${escape(this._t("typeManual"))}</small>` : integ ? `<small>${escape(this._t("typeByInteg"))}</small>` : ""
      }`;
    }
    return `<label class="typ-sel">${typeIcon(d.type, 16)}<select data-dlg="type" aria-label="${escape(this._t("typeLabel"))}">${opts}</select>${mdi("chevronDown", 18)}</label>${
      d.type_manual ? `<small>${escape(this._t("typeManual"))}</small>` : integ ? `<small>${escape(this._t("typeByInteg"))}</small>` : ""
    }${this._typeError ? `<small class="warn">${escape(this._t("typeSaveError"))} ${escape(this._typeError)}</small>` : ""}`;
  }

  _deviceSectionHtml(d) {
    const text = (v) => (v ? escape(v) : `<span class="t3">–</span>`);
    const sw = `${text(d.sw_version)}${d.update ? `<small class="upd">${escape(this._t("updateTo", d.update))}</small>` : ""}`;
    const typeSel = this._typeSelHtml(d, false);
    const tiles = [
      this._tile(this._t("typeLabel"), typeSel),
      this._tile(this._t("manufacturer"), text(d.manufacturer)),
      this._tile(this._t("model"), text(d.model)),
      this._tile(this._t("software"), sw),
    ];
    if (d.hw_version) tiles.push(this._tile(this._t("hardware"), text(d.hw_version)));
    tiles.push(this._tile(this._t("area"), text(d.area)));
    if (d.created_at) tiles.push(this._tile(this._t("added"), `${escape(this._fmtTime(Date.parse(d.created_at) / 1000, true, true))}${d.new ? `<small>${escape(this._t("newTag"))}</small>` : ""}`));
    return `<div class="tiles">${tiles.join("")}</div>`;
  }

  // HAs eigene Formatierung (Übersetzung, Einheit), wenn das hass-Objekt
  // sie anbietet; sonst Rohwert plus Einheit aus der Abfrage.
  _formatState(e) {
    const st = this._hass?.states?.[e.entity_id];
    const raw = st ? st.state : e.state;
    if (st && typeof this._hass.formatEntityState === "function") {
      try {
        return { text: this._hass.formatEntityState(st), bad: raw === "unavailable" };
      } catch (err) {
        // Rückfall unten.
      }
    }
    if (raw == null) return { text: "–", bad: false };
    if (raw === "unavailable") return { text: this._t("unavailable"), bad: true };
    const unit = st ? st.attributes?.unit_of_measurement : e.unit;
    return { text: unit ? `${raw} ${unit}` : String(raw), bad: false };
  }

  // Reiter "Schalter" (seit 2.58.0, docs/mockups/switches-v1, Variante C): die schaltbaren Entitäten des Geräts (dieselben Arten wie bei den
  // Routinen) als kompakte Kacheln mit Symbol, Name und Zustand. Ein Tipp öffnet die Bedienung von Home Assistant wie die Entität im
  // Reiter "Entitäten" (Dimmen, Farbe, Position, Temperatur sind dort); geschaltet wird nie durch die Kachel selbst.
  _switchEntities(d) {
    const cur = this._detail?.id === d.id ? this._detail : null;
    return (cur?.data?.entities || []).filter((e) => DOMAIN_EMOJI[e.entity_id.split(".", 1)[0]]);
  }

  // Suche in den Listen des Geräte-Popups (seit 2.103.0): Reiter "Schalter" und "Entitäten", ab 8 Einträgen. Der Suchtext liegt
  // in this._devQ (je Reiter) und überlebt den Neuaufbau alle 10 s; getippt wird nur die Liste (data-dev-zone) neu gezeichnet.
  _devSearchHtml(key, n) {
    if (n < 8) return "";
    const q = this._devQ?.[key] || "";
    const ph = this._t("listSearch");
    return `<label class="list-search" data-for="dev-${key}">${mdi("search", 18)}<input type="search" data-dlg="dev-search" data-key="${key}" value="${escape(q)}" placeholder="${escape(ph)}" aria-label="${escape(ph)}" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false"><span class="n">${escape(this._devSearchCount(key, n))}</span>${this._fieldClearHtml("data-fc", "", q)}</label>`;
  }

  _devSearchCount(key, total) {
    const q = String(this._devQ?.[key] || "").trim();
    if (!q) return "";
    const d = this._devices.find((x) => x.id === this._detailId);
    const n = d ? (key === "sw" ? this._switchEntities(d) : this._detail?.data?.entities || []).filter((e) => this._devMatch(e, q)).length : 0;
    return this._t("listSearchOf", n, total);
  }

  // Treffer: Name, Entity-ID oder angezeigter Zustand enthält den Text
  _devMatch(e, q) {
    const needle = String(q || "").trim().toLowerCase();
    if (!needle) return true;
    return `${e.name} ${e.entity_id} ${this._formatState(e).text}`.toLowerCase().includes(needle);
  }

  _devSearchInput(el) {
    const key = el.dataset.key;
    if (!this._devQ || !["ent", "sw"].includes(key)) return;
    this._devQ[key] = el.value;
    const dlg = this.shadowRoot.querySelector("dialog.device");
    const d = this._devices.find((x) => x.id === this._detailId);
    const zone = dlg?.querySelector(`[data-dev-zone="${key}"]`);
    if (!zone || !d) return;
    const all = key === "sw" ? this._switchEntities(d) : this._detail?.data?.entities || [];
    zone.innerHTML = key === "sw" ? this._switchGridHtml(all) : this._entListHtml(d);
    const n = dlg.querySelector(`.list-search[data-for="dev-${key}"] .n`);
    if (n) n.textContent = this._devSearchCount(key, all.length);
    // Der Zwischenspeicher von setHtml kennt diese Änderung nicht
    lastHtml.delete(dlg);
  }

  _switchesHtml(list) {
    return `${this._devSearchHtml("sw", list.length)}<div data-dev-zone="sw">${this._switchGridHtml(list)}</div>`;
  }

  _switchGridHtml(all) {
    const list = all.filter((e) => this._devMatch(e, this._devQ?.sw));
    if (!list.length) return `<p class="dlg-note mg-none">${escape(this._t("listSearchNone"))}</p>`;
    const cells = list.map((e) => {
      const domain = e.entity_id.split(".", 1)[0];
      const st = this._hass?.states?.[e.entity_id];
      const raw = st ? st.state : e.state;
      const { text, bad } = this._formatState(e);
      const on = SWITCH_ON.has(raw);
      // Helligkeit einer Lampe und Position eines Rollladens stehen hinter dem Zustand
      let extra = "";
      if (on && st) {
        const level = domain === "light" ? Math.round(Number(st.attributes?.brightness) / 2.55) : domain === "cover" ? Number(st.attributes?.current_position) : NaN;
        if (Number.isFinite(level)) extra = ` · ${level} %`;
      }
      const label = `${text}${extra}`;
      return `<button type="button" class="sw-cell${on ? " on" : ""}${bad ? " bad" : ""}" data-dlg="more-info" data-entity="${escape(e.entity_id)}" title="${escape(e.entity_id)}" aria-label="${escape(`${e.name}, ${label}`)}">
        <span class="sw-ic" aria-hidden="true">${DOMAIN_EMOJI[domain]}</span><b>${escape(e.name)}</b><small>${escape(label)}</small></button>`;
    });
    return `<div class="sw-grid">${cells.join("")}</div>`;
  }

  _entitiesHtml(d) {
    const cur = this._detail?.id === d.id ? this._detail : null;
    if (!cur || (!cur.data && cur.loading)) return { count: 0, html: `<p class="dlg-note">${escape(this._t("loadingDetail"))}</p>` };
    if (!cur.data) return { count: 0, html: `<div class="dlg-error">${escape(this._t("error"))} ${escape(cur.error || "")}</div>` };
    const list = cur.data.entities || [];
    return { count: list.length, html: list.length ? `${this._devSearchHtml("ent", list.length)}<div data-dev-zone="ent">${this._entListHtml(d)}</div>` : "" };
  }

  // Die Liste der Entitäten (mit dem Suchtext des Reiters) und der Hinweis zum Lebenszeichen
  _entListHtml(d) {
    const all = this._detail?.data?.entities || [];
    const list = all.filter((e) => this._devMatch(e, this._devQ?.ent));
    if (!list.length) return `<p class="dlg-note mg-none">${escape(this._t("listSearchNone"))}</p>`;
    const items = list
      .map((e) => {
        const { text, bad } = this._formatState(e);
        return `<li class="entity" role="button" tabindex="0" data-dlg="more-info" data-entity="${escape(e.entity_id)}">
          <span class="ent-name">${escape(e.name)}<small>${escape(e.entity_id)}</small></span>
          ${e.liveness ? `<span class="pill live">${escape(this._t("liveness"))}</span>` : ""}
          <span class="ent-state ${bad ? "bad" : ""}">${escape(text)}</span>
          <button type="button" class="ent-copy" data-dlg="copy-id" data-entity="${escape(e.entity_id)}" title="${escape(this._t("entCopy"))}" aria-label="${escape(`${this._t("entCopy")}: ${e.entity_id}`)}">${mdi("copy", 16)}</button></li>`;
      })
      .join("");
    const hint = list.some((e) => e.liveness) ? `<p class="dlg-note small">${escape(this._t("livenessHint"))}</p>` : "";
    return `<ul class="entities">${items}</ul>${hint}`;
  }

  // Link zu diesem Gerät (seit 2.82.0): öffnet das Popup über /device-panel?device=<id> (Deep-Link, siehe _openFromUrl).
  // web: Adresse, mit der der Benutzer gerade in HA ist; app: Schema der Companion-App (homeassistant://navigate/..., Aufbau nach der
  // Dokumentation der App, ob sie sich damit öffnet, hängt vom Handy ab). Zusammengesetzt beim Zeichnen und beim Kopieren.
  _deviceLink(id, kind) {
    const path = `${PANEL_PATH}?device=${encodeURIComponent(id)}`;
    if (kind === "app") return `homeassistant://navigate/${path}`;
    let origin = "";
    try {
      origin = top.location.origin;
    } catch {
      origin = window.location.origin;
    }
    return `${origin}/${path}`;
  }

  _deviceLinksHtml(d) {
    const row = (kind, label) => {
      const url = this._deviceLink(d.id, kind);
      return `<li class="dl-row" role="button" tabindex="0" data-dlg="copy-link" data-kind="${kind}">
        <span class="ent-name">${escape(label)}<small>${escape(url)}</small></span>
        <span class="dl-ic" aria-hidden="true">${mdi("copy", 16)}</span></li>`;
    };
    return `<h3>${escape(this._t("secDeviceLink"))}</h3><ul class="entities dl-list">${row("web", this._t("linkWeb"))}${row("app", this._t("linkApp"))}</ul>
      <p class="dlg-note small">${escape(this._t("linkNote"))}</p>`;
  }

  async _copyLink(row) {
    if (!(await this._copyText(this._deviceLink(this._detailId, row.dataset.kind), null))) return;
    const ic = row.querySelector(".dl-ic");
    if (!ic) return;
    ic.classList.add("done");
    ic.innerHTML = mdi("check", 16);
    window.setTimeout(() => {
      if (!ic.isConnected) return;
      ic.classList.remove("done");
      ic.innerHTML = mdi("copy", 16);
    }, 1500);
  }

  // Berührt der Benutzer das Fenster gerade oder wischt er darin? Dann baut das Abfragen (alle 10 s) den Inhalt nicht
  // neu auf: Auf dem iPhone bricht ein ersetzter Inhalt die Wischbewegung ab, die Seite dahinter scrollt mit und löst
  // das Neuladen der App aus (Rückmeldung des Nutzers).
  _trackBusy(dlg) {
    const busy = { touch: false, at: 0 };
    dlg.__busy = busy;
    const stamp = () => {
      busy.at = Date.now();
    };
    dlg.addEventListener("touchstart", () => { busy.touch = true; stamp(); }, { passive: true, capture: true });
    for (const type of ["touchend", "touchcancel"]) dlg.addEventListener(type, () => { busy.touch = false; stamp(); }, { passive: true, capture: true });
    dlg.addEventListener("scroll", stamp, { passive: true, capture: true });
    dlg.addEventListener("wheel", stamp, { passive: true, capture: true });
  }

  _dlgBusy(dlg) {
    const busy = dlg?.__busy;
    if (!busy) return false;
    // Beim Wischen mit Schwung feuert "scroll" weiter, die Frist läuft also ab dem letzten Ereignis.
    return busy.touch || Date.now() - busy.at < 800;
  }

  _renderDevice(soft = false) {
    this._renderStat();
    const dlg = this.shadowRoot.querySelector("dialog.device");
    if (!dlg || !this._detailId) return;
    if (soft && !this._devForce && dlg.open && this._dlgBusy(dlg)) {
      window.clearTimeout(this._devRetry);
      this._devRetry = window.setTimeout(() => this._renderDevice(true), 500);
      return;
    }
    const close = `<button type="button" class="dlg-close" data-dlg="close" title="${escape(this._t("close"))}" aria-label="${escape(this._t("close"))}">${mdi("close", 18)}</button>`;
    const d = this._devices.find((x) => x.id === this._detailId);
    const favLabel = d ? this._t(d.fav ? "favRemove" : "favAdd") : "";
    const heart = d
      ? `<button type="button" class="dlg-fav${d.fav ? " on" : ""}" data-dlg="fav" aria-pressed="${Boolean(d.fav)}" title="${escape(favLabel)}" aria-label="${escape(favLabel)}">${mdi(d.fav ? "heart" : "heartOutline", 18)}</button>`
      : "";
    // Eigene Schwelle wird gerade getippt: nicht neu aufbauen, sonst ginge die
    // Eingabe beim nächsten Abfragen (alle 10 s) verloren.
    const typing = this.shadowRoot.activeElement;
    // Der Assistent von Magic Push ist offen: nicht neu aufbauen, sonst ginge Getipptes verloren (Stand liegt im Modul).
    if (!this._devForce && (this._magic.wizardOpen() || this._routines.wizardOpen())) return;
    if (!this._devForce && this._rename && typing?.dataset?.dlg === "rename-input") return;
    if (!this._devForce && typing?.dataset?.dlg === "ai-q" && typing.value) return;
    if (!this._devForce && typing?.dataset?.dlg === "dev-search") return;
    if (!this._devForce && d && typing?.dataset?.dlg === "dev-bat-pct" && typing.value !== String(d.battery_setting)) return;
    if (!this._devForce && d && typing?.dataset?.dlg === "dev-sig-val" && typing.value !== String(d.signal_setting)) return;
    if (!this._devForce && d && typing?.dataset?.dlg === "dev-charge-stall-val" && typing.value !== String(d.charge_stall_setting)) return;
    if (!this._devForce && d && typing?.dataset?.dlg === "dev-charge-full-val" && typing.value !== String(d.charge_full_setting)) return;
    if (!this._devForce && d && typing?.dataset?.dlg === "dev-off-min" && typing.value !== String(d.offline_setting)) return;
    if (!this._devForce && d && typing?.dataset?.dlg === "dev-delay-min" && typing.value !== String(d.notify_delay_setting)) return;
    this._devForce = false;
    let html;
    if (!d) {
      html = `<div class="dlg-head"><span class="dlg-avatar none">${typeIcon("other", 28)}</span><div class="dlg-title"><h2>–</h2></div>${close}</div>
        <div class="dlg-body"><p class="dlg-note">${escape(this._t("deviceGone"))}</p></div>`;
    } else {
      let status = `<span class="pill on"><span class="pd"></span>${escape(this._t("statusOnline"))}</span>`;
      let avatar = "";
      if (d.online === false) {
        status = `<span class="pill off"><span class="pd"></span>${escape(this._t("statusOfflinePill", `${d.since_at_least ? "≥ " : ""}${this._duration(d.offline_since)}`))}</span>`;
        avatar = "off";
      } else if (d.disabled || d.unmonitored || d.online == null) {
        status = `<span class="pill none">${escape(this._t(d.disabled ? "statusDisabled" : d.unmonitored ? "statusUnmonitored" : "statusNoData"))}</span>`;
        avatar = "none";
      } else if (d.flaky || devWeak(d) || d.battery?.low) {
        avatar = "warn";
      }
      // Grund der Warnung oben (seit 1.27.0, docs/mockups/warn-reason-v1, K2): Marken im Kopf,
      // die zugehörigen Kacheln der Statistik tragen einen gelben Punkt.
      const why = [];
      if (d.online !== false && !d.disabled && !d.unmonitored) {
        if (d.flaky) why.push([this._t("statusFlaky"), this._t("flakyOutages", d.avail24?.outages ?? 0)]);
        if (devWeak(d)) why.push([this._t("warnWeakSignal"), sigText(d.signal)]);
        if (d.battery?.low) why.push([this._t("warnBatteryLow"), d.battery.level != null ? `${d.battery.level} %` : ""]);
      }
      const whyHtml = why.length
        ? `<div class="why-tags">${why.map(([k, v]) => `<span class="why">${mdi("alert", 15)}<b>${escape(k)}</b>${v ? ` · ${escape(v)}` : ""}</span>`).join("")}</div>`
        : "";
      const ents = this._entitiesHtml(d);
      // Reiter (seit 1.37.0, docs/mockups/popup-tabs-log-v1, R3): Übersicht zum Lesen, alle Einstellungen des Geräts
      // in "Einstellungen" (der Zähler nennt die eigenen), Entitäten für sich.
      const own = devOwnCount(d);
      const switches = this._switchEntities(d);
      const tab = ["ov", "sw", "set", "ent", "magic", "routine"].includes(this._devTab) && (this._devTab !== "sw" || switches.length) ? this._devTab : "ov";
      const magicCount = this._magic.count(d.id);
      const routineCount = this._routines.count(d.id);
      const tabs = `<div class="sub-tabs" role="tablist">${[
        ["ov", this._t("devTabOverview"), false],
        // Schalter (seit 2.58.0): nur, wenn das Gerät etwas Schaltbares hat
        ...(switches.length ? [["sw", this._t("devTabSwitches"), false]] : []),
        // Mit eigenen Einstellungen auf zwei Zeilen (seit 2.0.10): Name, darunter klein die Zahl
        ["set", this._t("devTabSettings"), own > 0, own ? this._t("devTabOwnCount", own) : ""],
        ["ent", this._t("devTabEntities", ents.count), false],
        // Magic Push: mit eingeschalteten Meldungen ebenfalls zweizeilig (Name, darunter klein die Zahl)
        ["magic", this._t("mgTab"), false, magicCount ? this._t("mgTabActive", magicCount) : ""],
        // Routine (seit 2.21.0): ebenfalls zweizeilig mit der Zahl der eingeschalteten
        ["routine", this._t("rtTab"), false, routineCount ? this._t("rtTabActive", routineCount) : ""],
      ]
        .map(([id, label, chg, sub]) => `<button type="button" role="tab" class="sub-tab${sub ? " two" : ""}${id === tab ? " on" : ""}${chg ? " chg" : ""}" data-dlg="tab" data-tab="${id}" aria-selected="${id === tab}"${sub ? ` aria-label="${escape(id === "magic" ? this._t("mgTabAria", magicCount) : id === "routine" ? this._t("rtTabAria", routineCount) : this._t("devTabSettingsOwn", own))}"` : ""}>${
          sub ? `<span class="tab-l">${escape(label)}</span> <span class="tab-s">${escape(sub)}</span>` : escape(label)
        }</button>`)
        .join("")}</div>`;
      const body =
        tab === "sw"
          ? `<h3>${escape(this._t("swTitle", switches.length))}</h3>${this._switchesHtml(switches)}<p class="dlg-note small">${escape(this._t("swHint"))}</p>`
          : tab === "set"
          ? `<h3>${escape(this._t("secTypeConn"))}</h3><div class="tiles">${this._tile(this._t("typeLabel"), this._typeSelHtml(d, true))}${this._tile(this._t("connType"), this._connSelHtml(d, true))}</div>
          <h3>${escape(this._t("secNotifyDevice"))}</h3>${this._deviceNotifyHtml(d)}
          <p class="dlg-note small">${escape(this._t("devSettingsNote"))}</p>`
          : tab === "magic"
            ? `<div class="mg-root"></div>`
            : tab === "routine"
              ? `<div class="rt-root"></div>`
            : tab === "ent"
              ? `<h3>${escape(this._t("secEntities", ents.count))}</h3>${ents.html}${this._deviceLinksHtml(d)}`
              : `<h3>${escape(this._t("secStats"))}</h3>${this._statTilesHtml(d)}
          ${this._aiHtml(d)}
          <h3>${escape(this._t("secConnection"))}</h3>${this._connSectionHtml(d)}
          <h3>${escape(this._t("secDevice"))}</h3>${this._deviceSectionHtml(d)}`;
      html = `<div class="dlg-head"><span class="dlg-avatar ${avatar}">${typeIcon(d.type, 28)}</span>
          <div class="dlg-title">${this._nameHtml(d)}
            <div class="dlg-sub">${status}<span>${[this._t(typeKey(d.type)), d.area].filter(Boolean).map(escape).join(" · ")}</span></div>${whyHtml}</div>
          ${heart}${close}</div>
        <div class="dlg-quick"><button type="button" class="qbtn" data-dlg="open-device">${mdi("open", 17)}<span class="q-t">${escape(this._t("openDevicePage"))}</span></button>${d.integration?.domain ? `<button type="button" class="qbtn" data-dlg="open-integration" data-domain="${escape(d.integration.domain)}">${mdi("open", 17)}<span class="q-t">${escape(this._t("openIntegPage"))}</span></button>` : ""}</div>
        <div class="dev-tabs">${tabs}</div>
        <div class="dlg-body" role="tabpanel">${body}
          ${this._hideError ? `<div class="dlg-error">${escape(this._t("hideError"))} ${escape(this._hideError)}</div>` : ""}
        </div>
        ${this._devActionsHtml()}`;
    }
    // Fokus und Scrollposition über den Neuaufbau retten (Abfrage alle 10 s).
    const active = this.shadowRoot.activeElement;
    const sel =
      active && dlg.contains(active) && active.dataset?.dlg
        ? `[data-dlg="${active.dataset.dlg}"]${active.dataset.range ? `[data-range="${active.dataset.range}"]` : ""}${active.dataset.tab ? `[data-tab="${active.dataset.tab}"]` : ""}${active.dataset.stab ? `[data-stab="${active.dataset.stab}"]` : ""}${
            active.dataset.entity ? `[data-entity="${CSS.escape(active.dataset.entity)}"]` : ""
          }`
        : null;
    const scroll = dlg.scrollTop;
    if (!setHtml(dlg, html)) return;
    this._stickDevTabs(dlg);
    // Magic Push füllt seinen Behälter nach jedem Neuaufbau aus dem eigenen Stand.
    const mgRoot = d && this._devTab === "magic" ? dlg.querySelector(".mg-root") : null;
    if (mgRoot) this._magic.attach(mgRoot);
    const rtRoot = d && this._devTab === "routine" ? dlg.querySelector(".rt-root") : null;
    if (rtRoot) this._routines.attach(rtRoot);
    dlg.scrollTop = scroll;
    if (sel) refocus(dlg.querySelector(sel));
  }

  // Fuss des Popups: mit Änderungen Zähler, "Abbrechen" und "Speichern" (wie im Zahnrad), sonst "Gerät ausblenden" und "Schliessen"
  _devActionsHtml() {
    const n = this._devChanges().length;
    if (n) {
      return `<div class="dlg-actions"><span class="set-count" role="status">${escape(this._t("settingsChanges", n))}</span>
        <button type="button" class="dlg-btn" data-dlg="close">${mdi("close", 18)}${escape(this._t("settingsCancel"))}</button>
        <button type="button" class="dlg-btn primary" data-dlg="save" ${this._devSaving ? "disabled" : ""}>${mdi("save", 18)}${escape(this._devSaving ? this._t("settingsSaving") : this._t("settingsSave"))}</button></div>`;
    }
    return `<div class="dlg-actions two">${this._devSaved ? `<span class="set-count saved" role="status">${escape(this._t("settingsSavedShort"))}</span>` : ""}<button type="button" class="dlg-btn hide-btn" data-dlg="hide">${mdi("eyeOff", 18)}${escape(this._t("hideDevice"))}</button>
          <button type="button" class="dlg-btn" data-dlg="close">${mdi("close", 18)}${escape(this._t("close"))}</button></div>`;
  }

  _onDeviceClick(ev) {
    const dlg = ev.currentTarget;
    // Klick auf den Hintergrund (ausserhalb des Inhalts) schliesst.
    if (ev.target === dlg) {
      const r = dlg.getBoundingClientRect();
      if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) this._requestCloseDevice();
      return;
    }
    const btn = ev.target.closest("[data-dlg]");
    if (!btn || btn.disabled) return;
    const action = btn.dataset.dlg;
    if (action === "close") this._requestCloseDevice();
    else if (action === "save") this._devSave();
    else if (action === "open-integration") {
      // HA-Seite der Integration dieses Geräts (seit 2.84.0); der Domainname kommt aus dem Registry-Eintrag, nicht aus freier Eingabe
      const domain = btn.dataset.domain;
      if (/^[a-z0-9_]+$/.test(domain || "")) this._requestCloseDevice(() => this._navigate(`/config/integrations/integration/${domain}`));
    } else if (action === "open-device") {
      const id = this._detailId;
      this._requestCloseDevice(() => this._navigate(`/config/devices/device/${id}`));
    } else if (action === "stat") this._openStat(btn.dataset.range, btn.dataset.kind);
    else if (action === "more-info") this._openMoreInfo(btn.dataset.entity);
    else if (action === "copy-id") this._copyId(btn);
    else if (action === "copy-link") this._copyLink(btn);
    else if (action === "fav") this._toggleFav(this._detailId);
    else if (action === "rename") this._renameStart();
    else if (action === "rename-cancel") this._renameCancel();
    else if (action === "rename-save") this._renameSave(this.shadowRoot.querySelector('input[data-dlg="rename-input"]')?.value ?? "");
    else if (action === "rename-reset") this._renameSave("");
    else if (action === "stab") {
      this._devSub = btn.dataset.stab;
      this._devForce = true;
      this._renderDevice();
    } else if (action === "tab") {
      this._devTab = btn.dataset.tab;
      this._devForce = true;
      this._renderDevice();
      this.shadowRoot.querySelector("dialog.device").scrollTop = 0;
    } else if (action === "hide") {
      // Rückfrage (seit 2.93.0): der Knopf liegt nah an "Schliessen" und ist schnell aus Versehen getroffen; "Rückgängig" bleibt im Hinweis danach
      const id = this._detailId;
      this._askConfirm({ title: "hideAskTitle", note: "hideAskNote", no: "hideAskNo", yes: "hideAskYes", noIcon: "close", yesIcon: "eyeOff" }, () => this._hideDevice(id));
    }
    else if (action === "ai") this._aiAssess(this._detailId);
    else if (action === "ai-ask") this._aiAsk(this._detailId, btn.dataset.q);
    else if (action === "ai-clear") this._aiClear(this._detailId);
    else if (action === "ai-fold") this._toggleAiFold();
    else if (action === "ai-send") this._aiAsk(this._detailId, this.shadowRoot.querySelector('input[data-dlg="ai-q"]')?.value ?? "");
  }

  // KI-Einschätzung (Punkt 10, docs/mockups/backlog-v1, A): nur mit
  // eingeschalteter Option, nur auf Knopfdruck; die Antwort bleibt im Panel
  // (Speicher), nichts wird gespeichert.
  _aiHtml(d) {
    if (!this._aiOn) return "";
    const t = (k, ...a) => this._t(k, ...a);
    const st = this._ai.get(d.id);
    const btn = (label) => `<button type="button" class="qbtn ai-btn" data-dlg="ai">${mdi("sparkle", 16)}${escape(label)}</button>`;
    let body;
    let source = "";
    if (st?.state === "loading") {
      body = `<div class="ai-card" aria-busy="true"><div class="ai-wait">${mdi("sparkle", 16)}${escape(t("aiWorking"))}</div></div>`;
    } else if (st?.state === "done") {
      const at = this._fmtTime(Date.parse(st.at) / 1000, false);
      source = st.source || "";
      body = `<div class="ai-card"><div class="ai-title">${mdi("sparkle", 16)}${escape(st.title || t("aiTitleDefault"))}</div>
        <div class="ai-text">${escape(st.text)}</div>
        <div class="ai-foot">${escape(t("aiAt", at))} · <button type="button" class="linkbtn" data-dlg="ai">${escape(t("aiAgain"))}</button> · <button type="button" class="linkbtn" data-dlg="ai-clear">${escape(t("aiClear"))}</button></div></div>
        <div class="opt-short">${escape(t("aiNote"))}</div>${this._aiAskHtml(d, st)}`;
    } else if (st?.state === "error") {
      body = `<div class="opt-error">${escape(t("aiError", st.error))}</div>${st.detail ? `<div class="opt-short ai-detail">${escape(t("aiDetail", st.detail))}</div>` : ""}${btn(t("aiRetry"))}`;
    } else {
      body = `${btn(t("aiButton"))}<div class="opt-short">${escape(t("aiNote"))}</div>`;
    }
    // Alles, was von der KI kommt, steht in einem Rahmen mit Kopfzeile und Quelle (seit 2.53.0, docs/mockups/ai-frame-v1, A):
    // Einschätzung und Rückfragen sind so klar von "Verbindung" und "Gerät" darunter getrennt.
    // Zuklappbar (seit 2.90.0): die Kopfzeile ist der Knopf, zugeklappt bleibt nur sie; der Stand gehört dem Benutzer
    const fold = Boolean(this._aiFold);
    const label = escape(t(fold ? "aiExpand" : "aiCollapse"));
    return `<div class="ai-box${fold ? " fold" : ""}"><button type="button" class="ai-head" data-dlg="ai-fold" aria-expanded="${!fold}" title="${label}" aria-label="${label}">${mdi("sparkle", 16)}<h3>${escape(t("secAiSettings"))}</h3>${source && !fold ? `<small>${escape(source)}</small>` : ""}<span class="ai-chev">${mdi("chevronDown", 18)}</span></button>${fold ? "" : body}</div>`;
  }

  // Rückfragen zur Einschätzung (seit 2.48.0, docs/mockups/ai-ask-v1, A und B kombiniert): bisherige Fragen und Antworten,
  // darüber vorgeschlagene Fragen als Pillen, darunter ein Textfeld; höchstens AI_ASK_MAX je Einschätzung.
  _aiAskHtml(d, st) {
    const t = (k, ...a) => this._t(k, ...a);
    const asks = st.asks || [];
    const left = AI_ASK_MAX - asks.length - (st.asking ? 1 : 0);
    let thread = asks.map((a) => `<div class="ai-q">${escape(a.q)}</div><div class="ai-a">${escape(a.a)}</div>`).join("");
    if (st.asking) thread += `<div class="ai-q">${escape(st.asking)}</div><div class="ai-a ai-wait" aria-busy="true">${mdi("sparkle", 16)}${escape(t("aiWorking"))}</div>`;
    // Vorschläge (seit 2.51.0): die der KI zu ihrer letzten Antwort; ohne sie feste, nach dem, was das Gerät hat. Gestellte entfallen.
    const asked = new Set(asks.map((a) => a.q.toLowerCase()));
    const own = (st.next || []).filter((q) => !asked.has(q.toLowerCase())).slice(0, 3);
    const fixed = [
      ["aiAskQ_first", true],
      ["aiAskQ_battery", Boolean(d.has_battery)],
      ["aiAskQ_pattern", (d.avail24?.outages || 0) > 0],
      ["aiAskQ_signal", d.signal?.value != null],
      ["aiAskQ_sure", true],
    ]
      .filter(([key, on]) => on && !asked.has(t(key).toLowerCase()))
      .map(([key]) => t(key))
      .slice(0, 4);
    const ideas = own.length ? own : fixed;
    const chips = left > 0 && !st.asking ? `<div class="ai-chips">${ideas.map((q) => `<button type="button" class="ai-chip" data-dlg="ai-ask" data-q="${escape(q)}">${escape(q)}</button>`).join("")}</div>` : "";
    const form =
      left > 0
        ? `<div class="ai-in"><input type="text" class="ai-input" data-dlg="ai-q" maxlength="${AI_ASK_Q_MAX}" value="${escape(this._aiDraft.get(d.id) || "")}" placeholder="${escape(t("aiAskPlaceholder"))}" aria-label="${escape(t("aiAskTitle"))}"${st.asking ? " disabled" : ""}>
          <button type="button" class="ai-send" data-dlg="ai-send" title="${escape(t("aiAskSend"))}" aria-label="${escape(t("aiAskSend"))}"${st.asking ? " disabled" : ""}>${mdi("send", 18)}</button></div>
          <div class="opt-short">${escape(t("aiAskLeft", Math.max(left, 0)))}</div>`
        : `<div class="opt-short">${escape(t("aiAskDone"))}</div>`;
    const err = st.askError ? `<div class="opt-error">${escape(t("aiError", st.askError))}</div>` : "";
    return `<div class="ai-ask"><div class="ai-ask-lbl">${escape(t("aiAskTitle"))}</div>${thread ? `<div class="ai-thread">${thread}</div>` : ""}${chips}${form}${err}</div>`;
  }

  async _aiAsk(id, question) {
    const st = this._ai.get(id);
    const q = String(question || "").replace(/\s+/g, " ").trim().slice(0, AI_ASK_Q_MAX);
    const asks = st?.asks || [];
    if (!id || !q || st?.state !== "done" || st.asking || asks.length >= AI_ASK_MAX) return;
    st.asking = q;
    st.askError = "";
    this._aiDraft.delete(id);
    this._devForce = true;
    this._renderDevice();
    try {
      const r = await this._hass.callWS({ type: "device_panel/ai_ask", device_id: id, question: q, language: pickLang(this._hass), history: asks.map(({ q: aq, a }) => ({ q: aq, a })) });
      st.asks = [...asks, { q, a: r.text }];
      // Neue Vorschläge zur Antwort; ohne welche bleiben die bisherigen (ohne die gestellten)
      if (Array.isArray(r.next) && r.next.length) st.next = r.next;
    } catch (err) {
      const code = err && typeof err === "object" ? err.code : null;
      const known = ["disabled", "no_ai_task", "timeout", "failed", "empty", "not_found", "limit"];
      st.askError = known.includes(code) ? this._t(`aiErr_${code}`) : errText(err);
      // Die Frage nicht verlieren: zurück ins Textfeld
      this._aiDraft.set(id, q);
    }
    st.asking = null;
    this._devForce = true;
    this._renderDevice();
  }

  // Die letzte Einschätzung bleibt über Neustarts gespeichert (seit 2.45.0): beim Öffnen des Geräts erscheint sie wieder, ohne die KI zu fragen.
  async _aiLoadLast(id) {
    if (!this._aiOn || !id || this._ai.has(id) || this._aiLastTried.has(id)) return;
    this._aiLastTried.add(id);
    try {
      const r = await this._hass.callWS({ type: "device_panel/ai_last", device_id: id });
      if (r && !this._ai.has(id)) {
        this._ai.set(id, { state: "done", title: r.title, text: r.text, source: r.source, at: r.at, next: r.next || [] });
        if (this._detailId === id) this._renderDevice();
      }
    } catch (err) {
      // nur eine Zugabe: ohne sie bleibt der Knopf
    }
  }

  // Einschätzung entfernen (seit 2.86.0): weg aus dem Pop-up und aus dem Speicher; der Knopf "Mit KI einschätzen" steht wieder da.
  // Ohne Rückfrage, weil sie sich mit einem Tipp neu erstellen lässt; beim Öffnen wird sie nicht wieder geholt.
  async _aiClear(id) {
    if (!id || this._ai.get(id)?.state !== "done") return;
    this._ai.delete(id);
    this._aiLastTried.add(id);
    this._renderDevice();
    try {
      await this._hass.callWS({ type: "device_panel/ai_clear", device_id: id });
    } catch (err) {
      // Im Speicher bleibt sie dann stehen; beim nächsten Öffnen kommt sie wieder (Neuladen der Seite holt sie erneut)
      this._aiLastTried.delete(id);
    }
  }

  async _aiAssess(id) {
    if (!id || this._ai.get(id)?.state === "loading") return;
    this._ai.set(id, { state: "loading" });
    this._renderDevice();
    try {
      const r = await this._hass.callWS({ type: "device_panel/ai_assess", device_id: id, language: pickLang(this._hass) });
      this._ai.set(id, { state: "done", title: r.title, text: r.text, source: r.source, at: r.at, next: r.next || [] });
    } catch (err) {
      const code = err && typeof err === "object" ? err.code : null;
      const known = ["disabled", "no_ai_task", "timeout", "failed", "empty", "not_found"];
      // Bei "failed" steht der Grund der KI-Aufgabe in der Meldung (seit 2.42.0): ohne ihn lässt sich der Fehler nicht eingrenzen.
      const detail = code === "failed" && err.message ? String(err.message).slice(0, 300) : "";
      this._ai.set(id, { state: "error", error: known.includes(code) ? this._t(`aiErr_${code}`) : errText(err), detail });
    }
    this._devForce = true;
    this._renderDevice();
  }

  // Ausblenden (Variante A, docs/mockups/hide-v1): gilt für alle Benutzer,
  // nicht mehr überwacht, keine Meldungen. Sofort aus der Liste, dann
  // "Rückgängig" im Hinweis; wieder einblenden auch in den Einstellungen.
  async _hideDevice(id) {
    const d = this._devices.find((x) => x.id === id);
    if (!id || !this._hass) return;
    const name = d?.name || id;
    try {
      await this._hass.callWS({ type: "device_panel/hide_device", device_id: id, hidden: true });
    } catch (err) {
      // Der Hinweis läge hinter dem Popup: Fehler im Popup über den Knöpfen.
      this._hideError = errText(err);
      this._renderDevice();
      return;
    }
    this._closeDevice();
    this._devices = this._devices.filter((x) => x.id !== id);
    this._render();
    this._fetch(true);
    this._toast(this._t("hiddenToast", name), { label: this._t("undo"), run: () => this._unhideDevice(id, name) });
  }

  async _unhideDevice(id, name) {
    try {
      await this._hass.callWS({ type: "device_panel/hide_device", device_id: id, hidden: false });
      this._toast(this._t("shownToast", name));
    } catch (err) {
      this._toast(`${this._t("unhideError")} ${errText(err)}`);
    }
    this._fetch(true);
  }

  // Navigation gehört ins Elternfenster (Home Assistant selbst): im iframe
  // würde history.pushState nur das iframe umleiten. Gleiches Muster wie
  // HAs navigate(): pushState plus "location-changed" (siehe LEARNINGS).
  // Seit dem Frontend 20260930 merkt sich HA im Verlaufseintrag, woher man
  // kam (history.state.from): Der Pfeil oben links geht nur dann im Verlauf
  // zurück (also ins Panel), wenn der Eintrag das trägt; sonst springt er zur
  // festen Seite der Geräteseite, der Geräteliste von HA. Deshalb denselben
  // Zustand mitgeben wie HAs navigate().
  _navigate(path, replace = false) {
    const target = window.parent || window;
    const state = target.history.state;
    if (replace) {
      // Wie HA: "root" und "from" des Eintrags bleiben.
      const keep = state?.root ? { root: true } : null;
      target.history.replaceState(state?.from === undefined ? keep : { ...keep, from: state.from }, "", path);
    } else target.history.pushState({ from: target.location.pathname }, "", path);
    target.dispatchEvent(new target.CustomEvent("location-changed", { detail: { replace } }));
  }

  // HAs eigener Entitäts-Dialog (mehr Infos, Verlauf) über dem Panel.
  _openMoreInfo(entityId) {
    try {
      const ha = (window.parent || window).document.querySelector("home-assistant");
      if (!ha) return;
      ha.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
    } catch (err) {
      console.warn("device-panel: Entitäts-Dialog nicht verfügbar", err);
    }
  }

  // --- Statistik-Fenster (über dem Popup) -----------------------------------

  _openStat(range, kind = "avail") {
    const dlg = this.shadowRoot.querySelector("dialog.stat-dlg");
    if (!dlg || !this._detailId) return;
    this._statKind = kind === "battery" || kind === "signal" ? kind : "avail";
    this._statRange = this._statRanges().includes(range) ? range : "24h";
    // X des Popups dahinter ausblenden: es wirkt sonst, als gehöre es zum
    // Statistik-Fenster (wie unifi_dynamic).
    this.setAttribute("stat-open", "");
    this._renderStat();
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    this._blurOnTouch();
    dlg.scrollTop = 0;
    this._loadHistory(true);
  }

  _statRanges() {
    return this._statKind === "battery" ? BAT_RANGES : RANGES;
  }

  // Schlüssel des geladenen Verlaufs: Art, Gerät, Zeitraum.
  _histKey(range) {
    return `${this._statKind || "avail"}|${this._detailId}|${range}`;
  }

  _closeStat() {
    const dlg = this.shadowRoot.querySelector("dialog.stat-dlg");
    this._statRange = null;
    this.removeAttribute("stat-open");
    if (dlg?.open) {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }
  }

  async _loadHistory(force = false) {
    const id = this._detailId;
    const range = this._statRange;
    if (!id || !range || !this._hass) return;
    const key = this._histKey(range);
    const type = { battery: "device_panel/battery_history", signal: "device_panel/signal_history" }[this._statKind] || "device_panel/availability";
    const cur = this._hist;
    if (!force && cur && cur.key === key && (cur.loading || Date.now() - cur.at < HISTORY_MAX_AGE_MS)) return;
    const prev = cur && cur.key === key ? cur.data : null;
    this._hist = { key, data: prev, loading: true, at: Date.now() };
    try {
      const data = await this._hass.callWS({ type, device_id: id, range });
      if (this._hist?.key !== key) return;
      this._hist = { key, data, loading: false, at: Date.now() };
    } catch (err) {
      if (this._hist?.key !== key) return;
      this._hist = { key, data: prev, loading: false, error: errText(err), at: Date.now() };
    }
    this._renderStat();
  }

  _renderStat() {
    const dlg = this.shadowRoot.querySelector("dialog.stat-dlg");
    if (!dlg || !this._statRange || !this._detailId) return;
    const d = this._devices.find((x) => x.id === this._detailId);
    if (!d) {
      this._closeStat();
      return;
    }
    const range = this._statRange;
    const ranges = this._t("ranges");
    const kind = this._statKind;
    const sw = `<div class="stat-range"><span class="seg-sw" role="group">${this._statRanges().map(
      (r) => `<button type="button" data-stat="range" data-range="${r}" class="${r === range ? "on" : ""}" aria-pressed="${r === range}">${escape(ranges[r])}</button>`
    ).join("")}</span></div>`;
    const icon = { battery: "battery", signal: "signal" }[kind] || "pulse";
    const title = { battery: "tileBattery", signal: "tileSignal" }[kind] || "statTitle";
    const body = kind === "battery" ? this._batteryHistHtml(range) : kind === "signal" ? this._signalHistHtml(range, d) : this._historyHtml(range);
    const html = `<div class="dlg-head stat-head"><span class="dlg-avatar">${mdi(icon, 24)}</span>
        <div class="dlg-title"><h2>${escape(this._t(title))}</h2><div class="dlg-sub">${escape(d.name)}</div></div>
        <button type="button" class="dlg-close" data-stat="close" title="${escape(this._t("close"))}" aria-label="${escape(this._t("close"))}">${mdi("close", 18)}</button></div>
      <div class="dlg-body">${sw}${body}</div>`;
    const scroll = dlg.scrollTop;
    if (setHtml(dlg, html)) dlg.scrollTop = scroll;
    // Gewählter Zeitraum sichtbar, wenn die Auswahl seitlich scrollt (nur die Auswahl, nicht das Fenster).
    const strip = dlg.querySelector(".stat-range");
    const on = strip?.querySelector("button.on");
    if (strip && on && strip.scrollWidth > strip.clientWidth) strip.scrollLeft = Math.max(0, on.offsetLeft - (strip.clientWidth - on.offsetWidth) / 2);
  }

  // Zeitstrahl mit Abschnitten online/ausgefallen/keine Daten, Fakten,
  // Liste der Unterbrüche; ab 7 Tagen Säulen "Unterbrüche pro Tag".
  _historyHtml(range) {
    const h = this._hist;
    const key = this._histKey(range);
    if (!h || h.key !== key || (!h.data && h.loading)) return `<div class="avail"><p class="dlg-note">${escape(this._t("loadingDetail"))}</p></div>`;
    if (!h.data) return `<div class="dlg-error">${escape(this._t("error"))} ${escape(h.error || "")}</div>`;
    const { start, end, segments: segs = [], summary } = h.data;
    const span = end - start;
    const sum = (st) => segs.filter((s) => s[2] === st).reduce((a, s) => a + s[1] - s[0], 0);
    const on = sum(1);
    if (!on && !sum(0)) return `<div class="avail"><p class="dlg-note">${escape(this._t("statNoData"))}</p></div>`;
    const withDate = range !== "24h";
    // Unterbrüche wie die Zahlen im Backend: ein Ausfall über Lücken ohne
    // Daten (Neustart) ist einer, nicht ein Eintrag pro Neustart. Die Balken
    // zeigen weiter, was HA beobachtet hat.
    const outages = Array.isArray(h.data.outages) ? h.data.outages.map(([a, b]) => [a, b, 0]) : segs.filter((s) => s[2] === 0);
    const off = outages.reduce((a, s) => a + s[1] - s[0], 0);
    let pct = summary ? summary.pct : (on / (on + off)) * 100;
    // Nie 100 % zeigen, wenn es einen Unterbruch gab (Rundung).
    if (outages.length && pct > 99.9) pct = 99.9;
    const facts = [];
    const pctOk = summary ? summary.pct != null : on + off >= PCT_MIN_COVERED;
    if (!pctOk) facts.push(escape(this._t("pctWait")));
    if (!on) facts.push(`<b>${escape(this._t("availNever"))}</b>`);
    else if (!outages.length) facts.push(escape(this._t("availAlways")));
    else {
      facts.push(`<b>${escape(this._t("availOutages", outages.length))}</b>`);
      facts.push(escape(this._t("availTotal", this._fmtSeconds(off))));
      facts.push(escape(this._t("availLongest", this._fmtSeconds(Math.max(...outages.map((s) => s[1] - s[0]))))));
    }
    const firstData = segs.find((s) => s[2] != null);
    if (firstData && firstData[0] > start + span * 0.01) facts.push(escape(this._t("availSince", this._fmtTime(firstData[0], true))));

    const zoom = Boolean(firstData && end - firstData[0] < span * ZOOM_SHARE);
    const viewStart = zoom ? firstData[0] : start;
    const viewSpan = end - viewStart;
    const endLabel = (s) => (s[1] >= end - 1 ? this._t("availOngoing") : this._fmtTime(s[1]));
    const cls = { 1: "on", 0: "off" };
    const segHtml = segs
      .filter((s) => s[1] > viewStart)
      .map((s) => {
        const from = Math.max(s[0], viewStart);
        const left = ((from - viewStart) / viewSpan) * 100;
        const width = ((s[1] - from) / viewSpan) * 100;
        // Tooltip: der ganze Unterbruch, auch wenn eine Lücke ihn teilt.
        const o = s[2] === 0 ? outages.find((x) => x[0] <= s[0] + 1 && s[1] <= x[1] + 1) || s : null;
        const tip = o ? ` data-tip="${escape(`${this._fmtTime(o[0], withDate)}–${endLabel(o)}`)}" data-dur="${escape(this._fmtSeconds(o[1] - o[0]))}"` : "";
        return `<span class="seg ${cls[s[2]] || "none"}" style="left:${left.toFixed(3)}%;width:${width.toFixed(3)}%"${tip}></span>`;
      })
      .join("");
    const startLabel = zoom ? `<span class="start-label">${escape(this._fmtTime(viewStart, viewSpan > 20 * 3600))}</span>` : "";
    const ticks =
      startLabel +
      this._ticks(viewStart, end, zoom ? "zoom" : range)
        .map((tk) => `<span class="${tk.minor ? "minor" : ""}" style="left:${tk.pos.toFixed(2)}%">${escape(tk.label)}</span>`)
        .join("");
    const hasNone = segs.some((s) => s[2] == null && s[1] > viewStart);
    const legend = `<div class="avail-legend"><span><i class="on"></i>${escape(this._t("availOnline"))}</span><span><i class="off"></i>${escape(this._t("availOffline"))}</span>${
      hasNone ? `<span><i class="none"></i>${escape(this._t("availNone"))}</span>` : ""
    }</div>`;
    let list = "";
    if (outages.length) {
      const newest = outages.slice().reverse();
      list = `<div class="avail-list">${newest
        .slice(0, OUTAGE_LIST_MAX)
        .map((s) => `<div><span>${escape(this._fmtTime(s[0], withDate))} – ${escape(endLabel(s))}</span><span class="d">${escape(this._fmtSeconds(s[1] - s[0]))}</span></div>`)
        .join("")}${newest.length > OUTAGE_LIST_MAX ? `<p class="avail-more">${escape(this._t("availMore", newest.length - OUTAGE_LIST_MAX))}</p>` : ""}</div>`;
    }
    const top = `<div class="avail-top"><span class="avail-pct">${pctOk ? `${escape(this._fmtPct(pct))}<small>%</small>` : `<span class="t3">–</span>`}</span><span class="avail-facts">${facts.join(" · ")}</span></div>`;
    return `<div class="avail">${top}
        <div class="avail-barwrap"><div class="avail-bar">${segHtml}<span class="avail-now"></span></div><div class="avail-tip" hidden></div></div>
        <div class="avail-ticks">${ticks}<span class="now-label">${escape(this._t("now"))}</span></div>
        ${legend}${list}</div>${this._daysHtml(h.data.days || [])}`;
  }

  // Batterie-Verlauf wie ein Kurs (Variante A): Linie mit Fläche, Achse
  // immer 0–100 % (Schwelle sichtbar, Zeiträume vergleichbar), Schwelle
  // gestrichelt, Batteriewechsel markiert und darunter aufgeführt.
  _batteryHistHtml(range) {
    const t = (k, ...a) => this._t(k, ...a);
    const h = this._hist;
    const key = this._histKey(range);
    if (!h || h.key !== key || (!h.data && h.loading)) return `<div class="avail"><p class="dlg-note">${escape(t("loadingDetail"))}</p></div>`;
    if (!h.data) return `<div class="dlg-error">${escape(t("error"))} ${escape(h.error || "")}</div>`;
    const { start, end, points = [], changes = [], threshold, source, steady_since: steady, forecast, charging = false } = h.data;
    const cs = charging ? "C" : "";
    if (!points.length) return `<div class="avail"><p class="dlg-note">${escape(t("batNoData"))}</p></div><p class="dlg-note bh-src">${escape(t("batSrcNone"))}</p>`;
    const span = end - start;
    const x = (at) => Math.max(0, Math.min(1000, ((at - start) / span) * 1000));
    const y = (v) => 100 - Math.max(0, Math.min(100, v));
    const cur = points[points.length - 1][1];
    const vals = points.map((p) => p[1]);
    const fmt = (v) => this._fmtPct(Math.round(v * 10) / 10);
    const facts = [];
    const last = changes[changes.length - 1];
    if (last) {
      facts.push(t("batSince" + cs, Math.round(cur - last.to), this._fmtDate(last.at)));
      const days = (end - last.at) / 86400;
      if (days >= 1 && last.to > cur) facts.push(t("batPerDay", fmt((last.to - cur) / days)));
    } else {
      facts.push(t("batMinMax", Math.round(Math.min(...vals)), Math.round(Math.max(...vals))));
      const days = (end - points[0][0]) / 86400;
      const drop = points[0][1] - cur;
      if (range !== "24h" && days >= 1 && drop >= 1) facts.push(t("batPerDay", fmt(drop / days)));
    }
    const line = points.map(([at, v], i) => `${i ? "L" : "M"}${x(at).toFixed(1)},${y(v).toFixed(2)}`).join(" ");
    const area = `${line} L${x(points[points.length - 1][0]).toFixed(1)},100 L${x(points[0][0]).toFixed(1)},100 Z`;
    const grid = [0, 50, 100].map((v) => `<line class="bh-grid" x1="0" x2="1000" y1="${y(v)}" y2="${y(v)}" vector-effect="non-scaling-stroke"/>`).join("");
    const thr = Number.isInteger(threshold)
      ? `<line class="bh-thr" x1="0" x2="1000" y1="${y(threshold)}" y2="${y(threshold)}" vector-effect="non-scaling-stroke"/>`
      : "";
    const marks = changes.map((c) => `<line class="bh-chg" x1="${x(c.at).toFixed(1)}" x2="${x(c.at).toFixed(1)}" y1="0" y2="100" vector-effect="non-scaling-stroke"/>`).join("");
    const labels =
      [100, 50, 0].map((v) => `<span class="bh-y" style="top:${y(v)}%">${v} %</span>`).join("") +
      (Number.isInteger(threshold) ? `<span class="bh-thr-l" style="bottom:${threshold}%">${escape(t("batThreshold", threshold))}</span>` : "") +
      changes.map((c) => `<span class="bh-chg-l" style="left:${(x(c.at) / 10).toFixed(2)}%">${escape(t("batChange" + cs))}</span>`).join("") +
      `<span class="bh-dot" style="top:${y(cur)}%"></span>`;
    const ticks = this._ticks(start, end, range)
      .map((tk) => `<span class="${tk.minor ? "minor" : ""}" style="left:${tk.pos.toFixed(2)}%">${escape(tk.label)}</span>`)
      .join("");
    const list = changes.length
      ? `<div class="avail-list">${changes
          .slice()
          .reverse()
          .map((c) => `<div><span>${escape(t("batChanged" + cs))}</span><span class="d">${escape(this._fmtTime(c.at, true))} · ${c.from} % → ${c.to} %</span></div>`)
          .join("")}</div>`
      : "";
    const srcKey = source === "statistics" ? (h.data.period === "day" ? "batSrcStatsDay" : "batSrcStats") : source === "history" ? (["30d", "90d", "180d", "365d"].includes(range) ? "batSrcHistoryLong" : "batSrcHistory") : "batSrcNone";
    return `<div class="avail bh"><div class="avail-top"><span class="avail-pct">${escape(String(Math.round(cur)))}<small>%</small></span><span class="avail-facts">${escape(facts.join(" · "))}</span></div>
        ${this._batForecastHtml(forecast, charging)}
        <div class="bh-plot"><svg class="bh-svg" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">${grid}${thr}
          <path class="bh-area" d="${area}"/><path class="bh-line" d="${line}" vector-effect="non-scaling-stroke"/>${marks}</svg>${labels}</div>
        <div class="avail-ticks bh-ticks">${ticks}<span class="now-label">${escape(t("now"))}</span></div>${list}</div>
      <p class="dlg-note bh-src">${escape(t(srcKey) + (steady ? ` ${t("histSteady", this._fmtTime(steady, true))}` : ""))}</p>`;
  }

  // Empfang als Kurs (seit 0.24.0, Rahmen wie "Batterie"): Median als Linie,
  // aus der eigenen Aufzeichnung dazu die Spanne (schlechtester bis bester
  // Wert) als Fläche und Lücken, wo nichts empfangen wurde; die Schwelle der
  // Empfang-Warnung des Geräts gestrichelt. Achse dBm -100 bis -40 (weiter,
  // wenn Werte darüber hinaus gehen), LQI 0 bis 255.
  _signalHistHtml(range, d) {
    const t = (k, ...a) => this._t(k, ...a);
    const h = this._hist;
    const key = this._histKey(range);
    if (!h || h.key !== key || (!h.data && h.loading)) return `<div class="avail"><p class="dlg-note">${escape(t("loadingDetail"))}</p></div>`;
    if (!h.data) return `<div class="dlg-error">${escape(t("error"))} ${escape(h.error || "")}</div>`;
    const { start, end, points = [], kind, source, bucket, first, current, reason, steady_since: steady, via } = h.data;
    const note = (text) => `<p class="dlg-note bh-src">${escape(text)}</p>`;
    const viaBlock = via ? this._viaHtml(via, start, end, range, Boolean(points.length && kind)) : "";
    // Sensor, den der Recorder nicht aufzeichnet (seit 0.26.0): das Panel zeichnet selbst auf.
    const why = reason === "not_recorded" ? ` ${t("sigSrcNotRecorded")}` : "";
    if (!points.length || !kind) {
      // Aufzeichnung mit älteren Werten (z. B. seit Tagen ausgefallen): sagen, seit wann.
      const empty = why ? `${why.trim()} ${t("sigSrcSoon")}` : t("sigSrcLogEmpty");
      const text = bucket ? (first ? t("sigSrcLog", this._fmtTime(first, true)) + why : empty) : t("sigSrcNone");
      return `<div class="avail"><p class="dlg-note">${escape(t("batNoData"))}</p></div>${note(text)}${viaBlock}`;
    }
    const dbm = kind === "dbm";
    const med = points.map((p) => p[1]);
    const lo = points.map((p) => p[2] ?? p[1]);
    const hi = points.map((p) => p[3] ?? p[1]);
    const top = dbm ? Math.max(-40, Math.ceil(Math.max(...hi) / 10) * 10) : 255;
    const bottom = dbm ? Math.min(-100, Math.floor(Math.min(...lo) / 10) * 10) : 0;
    const span = end - start;
    const x = (at) => Math.max(0, Math.min(1000, ((at - start) / span) * 1000));
    const y = (v) => Math.max(0, Math.min(100, ((top - v) / (top - bottom)) * 100));
    // Geschütztes Leerzeichen: "-84 dBm" nicht zwischen Zahl und Einheit umbrechen.
    const fmt = (v) => sigText({ kind, value: Math.round(v) }).replace(" ", "\u00a0");
    // Läufe ohne Lücke; aus der Aufzeichnung reicht ein Block über seine ganze Länge.
    const half = bucket ? bucket / 2 : 0;
    const gap = bucket ? bucket * 1.5 : source === "statistics" ? 5400 : Infinity;
    const runs = [];
    points.forEach((p, i) => {
      if (!i || p[0] - points[i - 1][0] > gap) runs.push([]);
      runs[runs.length - 1].push(p);
    });
    let line = "";
    let band = "";
    for (const run of runs) {
      const a = run[0];
      const z = run[run.length - 1];
      if (source === "history") {
        // Zustände gelten bis zum nächsten Wechsel: Treppe statt Schräge.
        line += `M${x(a[0]).toFixed(1)},${y(a[1]).toFixed(2)}${run.slice(1).map((p) => ` H${x(p[0]).toFixed(1)} V${y(p[1]).toFixed(2)}`).join("")} `;
        continue;
      }
      const pts = [[a[0] - half, a[1], a[2], a[3]], ...run, [z[0] + half, z[1], z[2], z[3]]];
      line += `M${pts.map((p) => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(2)}`).join(" L")} `;
      if (bucket) {
        band += `M${pts.map((p) => `${x(p[0]).toFixed(1)},${y(p[3] ?? p[1]).toFixed(2)}`).join(" L")} L${pts
          .slice()
          .reverse()
          .map((p) => `${x(p[0]).toFixed(1)},${y(p[2] ?? p[1]).toFixed(2)}`)
          .join(" L")} Z `;
      }
    }
    // Schwelle: eigene des Geräts (passende Art), sonst der Standard; "aus" ohne Linie.
    const own = sigOwn(d);
    const limit = own === "off" ? null : Number.isInteger(own) && own < 0 === dbm ? own : dbm ? WEAK_DBM : WEAK_LQI;
    const showLimit = limit != null && limit < top && limit > bottom;
    const mid = Math.round((top + bottom) / 2);
    const grid = [top, mid, bottom].map((v) => `<line class="bh-grid" x1="0" x2="1000" y1="${y(v)}" y2="${y(v)}" vector-effect="non-scaling-stroke"/>`).join("");
    const thr = showLimit ? `<line class="bh-thr" x1="0" x2="1000" y1="${y(limit)}" y2="${y(limit)}" vector-effect="non-scaling-stroke"/>` : "";
    const cur = current ?? med[med.length - 1];
    const labels =
      // Nur Zahlen: "-100 dBm" bräche in der schmalen Spalte um; die Einheit steht oben beim Wert.
      [top, mid, bottom].map((v) => `<span class="bh-y" style="top:${y(v)}%">${v}</span>`).join("") +
      (showLimit ? `<span class="bh-thr-l" style="bottom:${100 - y(limit)}%">${escape(t("sigWeakLine", sigText({ kind, value: limit })))}</span>` : "") +
      (current != null ? `<span class="bh-dot" style="top:${y(current)}%"></span>` : "");
    const ticks = this._ticks(start, end, range)
      .map((tk) => `<span class="${tk.minor ? "minor" : ""}" style="left:${tk.pos.toFixed(2)}%">${escape(tk.label)}</span>`)
      .join("");
    const sorted = [...med].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const facts = t("sigFacts", fmt(median), fmt(Math.min(...lo)), fmt(Math.max(...hi)));
    const legend = bucket
      ? `<div class="avail-legend"><span><i class="sg-med"></i>${escape(t("sigLegendMedian"))}</span><span><i class="sg-span"></i>${escape(t("sigLegendSpan"))}</span></div>`
      : "";
    // Der Recorder hatte im Zeitraum nichts: der Wert gilt seit seiner letzten Änderung.
    const held = steady ? ` ${t("histSteady", this._fmtTime(steady, true))}` : "";
    const src =
      source === "log"
        ? t("sigSrcLog", this._fmtTime(first ?? points[0][0], true)) + why
        : (source === "statistics" ? t("sigSrcStats") : range === "30d" ? t("sigSrcHistoryLong") : t("sigSrcHistory")) + held;
    return `<div class="avail bh sg"><div class="avail-top"><span class="avail-pct sg-cur">${bars(sigLevel({ kind, value: cur }), current == null)}${escape(fmt(cur))}</span><span class="avail-facts">${escape(facts)}</span></div>
        <div class="bh-plot"><svg class="bh-svg" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">${grid}${thr}
          ${band ? `<path class="sg-band" d="${band}"/>` : ""}<path class="bh-line" d="${line}" vector-effect="non-scaling-stroke"/></svg>${labels}</div>
        <div class="avail-ticks bh-ticks">${ticks}<span class="now-label">${escape(t("now"))}</span></div>${legend}</div>
      ${note(src)}${viaBlock}`;
  }

  // Weg des Bluetooth-Empfangs (seit 2.40.0): Balken mit Abschnitten je Empfänger (Lücke
  // schraffiert), Legende mit Anteil und mittlerem Empfang, die letzten Wechsel. Die Farben
  // folgen der Reihenfolge, in der die Empfänger zuerst auftraten; sie bleiben je Gerät stabil.
  _viaHtml(via, start, end, range, aligned = true) {
    const t = (k, ...a) => this._t(k, ...a);
    const span = end - start;
    if (!(span > 0) || !via.segments?.length) return "";
    const colour = (i) => VIA_COLORS[i % VIA_COLORS.length];
    const name = (i) => via.receivers[i]?.name ?? "";
    // Jeder Abschnitt steht an seiner Zeit (seit 2.49.0): was vor dem Beginn der Aufzeichnung liegt, bleibt links leer ("none"),
    // damit "jetzt" auch bei einer jungen Aufzeichnung ganz rechts liegt und der Balken von rechts her wächst, nicht von links.
    let cursor = start;
    const blank = (to) => (to - cursor > span * 0.0005 ? `<i class="none" style="width:${(((to - cursor) / span) * 100).toFixed(3)}%"></i>` : "");
    const parts = [];
    for (const [a, b, i] of via.segments) {
      parts.push(blank(a));
      const width = (((b - a) / span) * 100).toFixed(3);
      parts.push(i == null ? `<i class="gap" style="width:${width}%"></i>` : `<i style="width:${width}%;background:${colour(i)}" title="${escape(name(i))}"></i>`);
      cursor = b;
    }
    parts.push(blank(end));
    const bar = parts.join("");
    // Dieselben Zeitmarken wie im Verlauf darüber: Balken und Diagramm liegen auf gleicher Breite (seit 2.49.0), das Auge fährt senkrecht
    const ticks = this._ticks(start, end, range)
      .map((tk) => `<span class="${tk.minor ? "minor" : ""}" style="left:${tk.pos.toFixed(2)}%">${escape(tk.label)}</span>`)
      .join("");
    const legend = via.receivers
      .map((r, i) => `<div><i class="sv-dot" style="background:${colour(i)}"></i><b>${escape(r.name)}</b><span>${escape(t("viaShare", r.share, r.avg == null ? null : Math.round(r.avg)))}</span></div>`)
      .join("");
    // Hinweis auf einen weiter entfernten Empfänger (seit 2.50.0): lief der Empfang längere Zeit über einen Empfänger, der im Mittel
    // deutlich schwächer war als der Hauptempfänger, erklärt das die Einbrüche im Verlauf. Beheben kann das Panel es nicht (Home Assistant wählt).
    const rated = via.receivers.map((r, i) => ({ ...r, i })).filter((r) => r.avg != null);
    const main = rated.reduce((best, r) => (!best || r.share > best.share ? r : best), null);
    const far = main
      ? rated.filter((r) => r.i !== main.i && r.share >= VIA_FAR_SHARE && main.avg - r.avg >= VIA_FAR_DBM).sort((a, b) => b.share - a.share).slice(0, 2)
      : [];
    const farHtml = far
      .map((r) => `<p class="sv-far">${escape(t("viaFar", r.name, r.share, Math.round(r.avg), main.name, Math.round(main.avg), Math.round(main.avg - r.avg)))}</p>`)
      .join("");
    const dayOf = (at) => this._fmtTime(at, new Date(at * 1000).toDateString() !== new Date(end * 1000).toDateString());
    const changes = (via.changes || [])
      .map(([at, from, to]) => `<p><span>${escape(dayOf(at))}</span><b>${escape(name(from))} → ${escape(name(to))}</b></p>`)
      .join("");
    return `<div class="sv${aligned ? "" : " sv-full"}"><h3>${escape(t("viaTitle"))}</h3><div class="sv-bar">${bar}</div>
      <div class="avail-ticks sv-ticks">${ticks}<span class="now-label">${escape(t("now"))}</span></div>
      <div class="sv-leg">${legend}</div>${farHtml}${changes ? `<div class="sv-chg"><h4>${escape(t("viaChanges"))}</h4>${changes}</div>` : ""}
      <p class="sv-note">${escape(t("viaNote", this._fmtTime(via.since, true)))}</p></div>`;
  }

  _daysHtml(days) {
    if (!days.length) return "";
    const max = Math.max(1, ...days.map((x) => x.outages));
    const barsHtml = days
      .map((day) => {
        const cls = day.nodata ? "none" : day.outages >= 2 ? "e" : day.outages ? "w" : "";
        const height = day.outages && !day.nodata ? 10 + (day.outages / max) * 46 : 3;
        const tip = `${this._fmtDate(day.start)} · ${
          day.nodata ? this._t("availNone") : day.outages ? `${this._t("availOutages", day.outages)} · ${this._t("availTotal", this._fmtSeconds(day.offline))}` : this._t("availAlways")
        }`;
        return `<i class="${cls}" style="height:${height.toFixed(0)}px" title="${escape(tip)}"></i>`;
      })
      .join("");
    const mid = days[Math.floor(days.length / 2)];
    return `<h3>${escape(this._t("daysTitle"))}</h3><div class="avail"><div class="days">${barsHtml}</div>
      <div class="daysx"><span>${escape(this._fmtDate(days[0].start))}</span><span>${escape(this._fmtDate(mid.start))}</span><span>${escape(this._t("today"))}</span></div></div>`;
  }

  _onStatClick(ev) {
    const dlg = ev.currentTarget;
    if (ev.target === dlg) {
      const r = dlg.getBoundingClientRect();
      if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) this._closeStat();
      return;
    }
    const seg = ev.target.closest(".avail-bar .seg");
    if (seg) {
      // Maus: Tooltip folgt dem Zeiger (pointerover); Touch: Antippen.
      if (ev.pointerType !== "mouse") this._showTip(seg.classList.contains("off") && !seg.classList.contains("hover") ? seg : null);
      return;
    }
    this._showTip(null);
    const btn = ev.target.closest("[data-stat]");
    if (!btn) return;
    if (btn.dataset.stat === "close") this._closeStat();
    else if (btn.dataset.stat === "range" && btn.dataset.range !== this._statRange) {
      this._statRange = btn.dataset.range;
      this._renderStat();
      this._loadHistory(true);
    }
  }

  // Tooltip über einem Unterbruch, am Rand eingeklemmt; der Pfeil zeigt
  // trotzdem auf den Abschnitt.
  _showTip(seg) {
    const root = this.shadowRoot;
    root.querySelectorAll(".avail-bar .seg.hover").forEach((el) => el.classList.remove("hover"));
    if (!seg || !seg.dataset.tip) {
      root.querySelectorAll(".avail-tip").forEach((el) => (el.hidden = true));
      return;
    }
    const tip = seg.closest(".avail-barwrap").querySelector(".avail-tip");
    if (!tip) return;
    seg.classList.add("hover");
    tip.innerHTML = `${escape(this._t("availOffline"))} <b>${escape(seg.dataset.tip)}</b> · ${escape(seg.dataset.dur)}`;
    tip.hidden = false;
    const wrap = tip.parentElement.getBoundingClientRect();
    const r = seg.getBoundingClientRect();
    const center = r.left + r.width / 2 - wrap.left;
    const half = tip.offsetWidth / 2;
    const left = Math.min(Math.max(center, half), Math.max(half, wrap.width - half));
    tip.style.left = `${left}px`;
    tip.style.setProperty("--arrow", `${center - left}px`);
  }
  // --- Einstellungen (wie unifi_dynamic) ------------------------------------
  // Dieselben Options wie der Optionsdialog von HA (device_panel/get_options,
  // set_options) plus die gemeinsamen Panel-Einstellungen (Vorabversionen).
  // Gespeichert wird erst mit "Speichern"; der Entwurf lebt nur im Dialog.

  // tab: Abschnitt, bei dem die Einstellungen öffnen (seit 2.75.0 ruft niemand mehr mit einem Reiter auf)
  // Startseite (seit 2.39.0, gilt seit 2.39.1 erst mit "Speichern"): Ist dieses Panel die Startseite des Benutzers? Das Frontend von HA liest default_panel aus den Benutzerdaten
  // "core" (userData.default_panel) vor der Systemeinstellung. Die Auswahl im Profil kennt nur eingebaute Seiten und Dashboards, nicht
  // das Panel einer Integration; deshalb setzt das Panel den Wert selbst. Wie alles andere gilt die Wahl erst mit "Speichern"
  // (Entwurf in st.extra.start_panel); beim Einschalten merkt sich das Panel die bisherige Startseite, beim Ausschalten kommt sie zurück.
  async _readStartPanel() {
    try {
      const r = await this._hass.callWS({ type: "frontend/get_user_data", key: "core" });
      this._startOn = r?.value?.default_panel === PANEL_PATH;
    } catch (err) {
      console.warn("device-panel: Startseite von HA nicht lesbar", err);
      this._startOn = false;
    }
  }

  async _saveStartPanel(on) {
    const read = async (key) => (await this._hass.callWS({ type: "frontend/get_user_data", key }))?.value || {};
    // Die übrigen Werte von "core" bleiben erhalten (zum Beispiel andere Einstellungen von HA)
    const core = { ...(await read("core")) };
    const mine = { ...(await read(START_KEY)) };
    if (on) {
      // Die bisherige Startseite merken, damit sie beim Ausschalten wiederkommt (nicht, wenn es schon dieses Panel ist)
      if (core.default_panel && core.default_panel !== PANEL_PATH) mine.previous = core.default_panel;
      else if (!core.default_panel) delete mine.previous;
      core.default_panel = PANEL_PATH;
    } else if (core.default_panel === PANEL_PATH) {
      if (mine.previous) core.default_panel = mine.previous;
      else delete core.default_panel;
      delete mine.previous;
    }
    await this._hass.callWS({ type: "frontend/set_user_data", key: "core", value: core });
    await this._hass.callWS({ type: "frontend/set_user_data", key: START_KEY, value: mine });
    this._startOn = on;
  }

  // Stand der Panel-Einstellungen, die nicht zu den Optionen gehören (Vorabversionen, automatisch installieren, Startseite)
  _extraBase() {
    return { prerelease: Boolean(this._prerelease), auto_update: Boolean(this._autoUpdate), start_panel: Boolean(this._startOn) };
  }

  async _openSettings(tab = "overview") {
    const dialog = this.shadowRoot.querySelector("dialog.settings");
    if (!dialog || !this._hass) return;
    // resets: Geräte, deren eigene Einstellung beim Speichern auf den globalen
    // Wert zurückgeht (Variante A, docs/mockups/override-v1).
    this._settings = {
      loading: true, error: null, saveError: null, saving: false, data: null, draft: null, open: new Set(tab === "overview" ? [] : ["monitor"]), info: new Set(),
      resets: newResets(),
      // Reiter von "Überwachung und Meldungen", gewählte Integration, Filter der Liste.
      tab, integ: null, integFilter: "all",
      // Reiter von "Geräte im Panel" und "Darstellung".
      sub: { devices: "integrations", integ: "out" },
    };
    // Ansicht (seit 2.87.0): derselbe Dialog, Reiter "Spalten" und "Filter-Chips"; Stand beim Öffnen merken, um zurückzustellen
    const view = tab === "view";
    const viewAdmin = view && this._viewAdmin();
    if (view) {
      Object.assign(this._settings, { mode: "view", vtab: "cols", viewBase: { kind: this._narrowQuery.matches ? "mobile" : "desktop", snap: this._viewSnap() } });
      // Ohne Administratorrecht gibt es nur den Reiter "Spalten": nichts zu laden
      if (!viewAdmin) this._settings.loading = false;
    }
    this._renderSettings();
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    this._blurOnTouch();
    // Beim Öffnen immer frisch bei GitHub nachsehen (seit 2.64.0), nicht erst nach 6 Stunden; läuft gerade eine Installation oder ein Neustart,
    // bleibt es beim bisherigen Stand, damit nichts dazwischenfährt
    const busyVersion = this._version?.installing || this._version?.restarting;
    if (!view) this._loadVersion(!busyVersion, { open: true });
    const st = this._settings;
    if (view && !viewAdmin) return;
    try {
      const data = await this._hass.callWS({ type: "device_panel/get_options" });
      if (this._settings !== st) return;
      // Logos der Integrationen vorab laden, damit die Liste gleich vollständig erscheint.
      await this._brandPreloadDomains((data.catalog?.integrations || []).map((i) => i.domain));
      if (this._settings !== st) return;
      if (!view) await this._readStartPanel();
      if (this._settings !== st) return;
      st.data = data;
      st.draft = { ...data.values };
      this._applyPanelSettings(data.panel);
      // Vorabversionen (ganze Instanz) und Startseite (Benutzer) gelten wie alles andere erst mit "Speichern".
      st.extraBase = this._extraBase();
      st.extra = { ...st.extraBase };
      if (!view) this._loadProtocolUsage(st);
    } catch (err) {
      if (this._settings !== st) return;
      st.error = errText(err);
    }
    st.loading = false;
    this._renderSettings();
  }

  // Schliessen: mit ungespeicherten Änderungen erst fragen "Änderungen verwerfen?" (seit 2.20.0)
  _requestCloseSettings(after) {
    const st = this._settings;
    if (st && (st.mode === "view" || (!st.loading && !st.error)) && this._settingsChanges().length) {
      this._askDiscard(() => {
        this._closeSettings();
        after?.();
      });
      return;
    }
    this._closeSettings();
    after?.();
  }

  _closeSettings() {
    const dialog = this.shadowRoot.querySelector("dialog.settings");
    this._revertView();
    const viewBtn = this.shadowRoot.querySelector(".view-btn");
    viewBtn?.classList.remove("on");
    viewBtn?.setAttribute("aria-expanded", "false");
    this._settings = null;
    this._closePrompt();
    this._closeNotes();
    if (dialog?.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }

  // --- Profi-Modus der KI-Einschätzung (seit 1.2.0, docs/mockups/ai-v1, A)

  // Im Abschnitt: Schalter, bei "ein" der Prompt (nur zum Lesen) mit Knöpfen.
  _aiPromptHtml(d, changed) {
    const st = this._settings;
    const t = (k, ...a) => this._t(k, ...a);
    const expert = st.expert ?? Boolean(d.ai_prompt);
    const head = `<div class="opt${changed ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(t("optAiExpert"))}</span>
      <label class="switch"><input type="checkbox" data-set="expert" ${expert ? "checked" : ""} aria-label="${escape(t("optAiExpert"))}"><span></span></label></div>
      <div class="opt-short">${escape(t("optAiExpertShort"))}</div></div>`;
    if (!expert) return head;
    const own = Boolean(d.ai_prompt);
    return `${head}<div class="aip"><div class="aip-h">${escape(t("aiPromptTitle"))} · <b>${escape(t(own ? "aiPromptOwn" : "aiPromptDefault"))}</b></div>
      <div class="aip-box" tabindex="0">${promptHtml(d.ai_prompt || st.data.ai_prompt_default || "")}</div>
      <div class="aip-btns"><button type="button" class="dlg-btn primary" data-set="prompt-open">${mdi("pencil", 18)}${escape(t("aiPromptEdit"))}</button>
        <button type="button" class="dlg-btn" data-set="prompt-copy">${mdi("copy", 18)}${escape(t("aiPromptCopy"))}</button>
        <button type="button" class="dlg-btn" data-set="prompt-default" ${own ? "" : "disabled"}>${mdi("reset", 18)}${escape(t("aiPromptReset"))}</button></div>
      <div class="nf-note">${mdi("info", 16)}<div><p>${escape(t("aiPromptPrivacy"))}</p></div></div></div>`;
  }

  // Text in die Zwischenablage; die Beschriftung des Knopfes sagt kurz "Kopiert".
  async _copyText(text, btn) {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // Ohne Berechtigung (iframe): über ein verstecktes Textfeld.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0";
      this.shadowRoot.appendChild(ta);
      ta.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      ta.remove();
    }
    if (btn && ok) {
      const label = btn.textContent;
      btn.textContent = this._t("aiPromptCopied");
      window.setTimeout(() => {
        if (btn.isConnected) btn.textContent = label;
      }, 1500);
    }
    return ok;
  }

  // Name im Kopf des Popups (seit 1.21.0): mit Stift; beim Umbenennen ein Feld mit
  // Speichern und Abbrechen, dazu der Name der Integration und "Zurücksetzen".
  _nameHtml(d) {
    const t = (k, ...a) => this._t(k, ...a);
    const r = this._rename;
    if (!r) {
      return `<h2><span>${escape(d.name)}</span><button type="button" class="dn-edit" data-dlg="rename" title="${escape(t("renameDevice"))}" aria-label="${escape(t("renameDevice"))}">${mdi("pencil", 16)}</button></h2>`;
    }
    const orig = d.name_original && d.name_custom ? `<div class="dn-orig">${escape(t("renameOriginal", d.name_original))} <button type="button" class="linkbtn" data-dlg="rename-reset"${r.busy ? " disabled" : ""}>${escape(t("renameReset"))}</button></div>` : "";
    return `<div class="dn-form"><input type="text" class="dn-input" data-dlg="rename-input" maxlength="255" value="${escape(r.value)}" aria-label="${escape(t("renameDevice"))}"${r.busy ? " disabled" : ""}>
      <button type="button" class="dn-btn ok" data-dlg="rename-save" title="${escape(t("renameSave"))}" aria-label="${escape(t("renameSave"))}"${r.busy ? " disabled" : ""}>${mdi("check", 18)}</button>
      <button type="button" class="dn-btn" data-dlg="rename-cancel" title="${escape(t("settingsCancel"))}" aria-label="${escape(t("settingsCancel"))}">${mdi("close", 18)}</button></div>${orig}${
      r.error ? `<div class="opt-error">${escape(t("renameError"))} ${escape(r.error)}</div>` : ""
    }`;
  }

  _renameStart() {
    const d = this._devices.find((x) => x.id === this._detailId);
    if (!d) return;
    this._rename = { value: d.name, error: null, busy: false };
    this._devForce = true;
    this._renderDevice();
    const input = this.shadowRoot.querySelector('input[data-dlg="rename-input"]');
    input?.focus();
    input?.select();
  }

  _renameCancel() {
    this._rename = null;
    this._devForce = true;
    this._renderDevice();
  }

  // In Home Assistant umbenennen (name_by_user); leer = Name der Integration.
  async _renameSave(value) {
    const id = this._detailId;
    const d = this._devices.find((x) => x.id === id);
    if (!id || !d || !this._rename || this._rename.busy) return;
    const name = String(value).trim();
    // Unverändert: nichts senden
    if (name === d.name || (!name && !d.name_custom)) return this._renameCancel();
    this._rename = { ...this._rename, value: name, busy: true, error: null };
    this._devForce = true;
    this._renderDevice();
    try {
      const res = await this._hass.callWS({ type: "device_panel/rename_device", device_id: id, name });
      d.name = res.name;
      d.name_custom = res.name_custom;
      this._rename = null;
    } catch (err) {
      this._rename = { ...this._rename, busy: false, error: errText(err) };
    }
    this._devForce = true;
    this._renderDevice();
    this._render();
    this._fetch(true);
  }

  // Entitäts-ID in die Zwischenablage; das Symbol zeigt kurz einen Haken.
  async _copyId(btn) {
    if (!(await this._copyText(btn.dataset.entity, null))) return;
    btn.classList.add("done");
    btn.innerHTML = mdi("check", 16);
    window.setTimeout(() => {
      if (!btn.isConnected) return;
      btn.classList.remove("done");
      btn.innerHTML = mdi("copy", 16);
    }, 1500);
  }

  // --- Fenster "Release Notes" (seit 2.3.0): die Versionen nach der installierten bis zur neuesten,
  // aus dem CHANGELOG des Repositories (Sprache des Panels, sonst Englisch), statt eines Links auf GitHub.
  _openNotes() {
    const dlg = this.shadowRoot.querySelector("dialog.notes-dlg");
    if (!dlg) return;
    const state = this._versionState();
    // Mit neuer Version: alle Versionen dazwischen. Ohne: die Notes der installierten Version
    // (kein Update da, aber nachlesen, was die aktuelle Version bringt).
    const newer = Boolean(state.latest && state.installed && this._cmpVersion(state.latest, state.installed) > 0);
    // HACS meldet die Version mit dem Tag ("v2.6.0"); der Server erwartet die Nummer ohne "v".
    const bare = (v) => (v == null ? v : String(v).replace(/^v/i, ""));
    const latest = bare(newer ? state.latest : state.installed);
    if (!latest) return;
    const n = (this._notes = {
      installed: newer ? bare(state.installed) : null,
      latest,
      current: !newer,
      url: newer ? state.url || null : `https://github.com/${REPO}/releases/tag/v${latest}`,
      loading: true, error: null, data: null, seq: (this._notes?.seq || 0) + 1,
    });
    this._renderNotes();
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    this._blurOnTouch();
    dlg.scrollTop = 0;
    this._loadNotes(n);
  }

  async _loadNotes(n, force = false) {
    const lang = pickLang(this._hass);
    try {
      const data = await this._hass.callWS({ type: "device_panel/release_notes", installed: n.installed || undefined, latest: n.latest, language: lang, force });
      if (this._notes !== n) return;
      n.data = data;
      n.error = data.error && !(data.entries || []).length ? data.error : null;
    } catch (err) {
      if (this._notes !== n) return;
      n.error = errText(err);
    }
    n.loading = false;
    this._renderNotes();
  }

  _closeNotes() {
    const dlg = this.shadowRoot.querySelector("dialog.notes-dlg");
    this._notes = null;
    if (dlg?.open) {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }
  }

  _renderNotes() {
    const dlg = this.shadowRoot.querySelector("dialog.notes-dlg");
    const n = this._notes;
    if (!dlg || !n) return;
    const t = (k, ...a) => this._t(k, ...a);
    const link = n.url ? `<a class="dlg-btn rn-gh" href="${escape(n.url)}" target="_blank" rel="noopener">${escape(t("notesGithub"))}${mdi("open", 15)}</a>` : "";
    let body;
    if (n.loading) {
      body = `<p class="dlg-note">${escape(t("notesLoading"))}</p>`;
    } else if (n.error) {
      const msg = n.error === "rate_limit" ? t("verRateLimit") : n.error;
      body = `<div class="dlg-error">${escape(t("notesError"))} ${escape(msg)}</div><div class="aip-btns"><button type="button" class="dlg-btn" data-notes="retry">${mdi("reset", 18)}${escape(t("notesRetry"))}</button></div>`;
    } else {
      const entries = n.data?.entries || [];
      const lang = pickLang(this._hass);
      const note = n.data?.language && n.data.language !== lang ? `<div class="nf-note">${mdi("info", 16)}<div><p>${escape(t("notesEnglishOnly"))}</p></div></div>` : "";
      body =
        note +
        entries
          .map((e) => {
            const date = e.date && !Number.isNaN(Date.parse(e.date)) ? this._fmtDateY(Date.parse(e.date) / 1000) : "";
            return `<section class="rn-entry"><h3 class="rn-ver"><span>${escape(e.version)}</span>${date ? `<small>${escape(date)}</small>` : ""}</h3><div class="rn">${releaseMarkdownHtml(e.notes)}</div></section>`;
          })
          .join("");
    }
    const sub = n.current ? t("notesInstalled", n.latest) : n.installed ? `${n.installed} → ${n.latest}` : n.latest;
    const html = `<div class="dlg-head"><span class="dlg-avatar">${mdi("verUp", 24)}</span><div class="dlg-title"><h2>${escape(t("notesTitle"))}</h2><div class="dlg-sub">${escape(sub)}</div></div>
        <button type="button" class="dlg-close" data-notes="close" title="${escape(t("close"))}" aria-label="${escape(t("close"))}">${mdi("close", 18)}</button></div>
      <div class="dlg-body">${body}</div>
      <div class="dlg-actions">${link}<button type="button" class="dlg-btn primary" data-notes="close">${mdi("close", 18)}${escape(t("close"))}</button></div>`;
    setHtml(dlg, html);
  }

  _bindNotes(dlg) {
    if (!dlg) return;
    dlg.addEventListener("click", (ev) => {
      if (ev.target === dlg) {
        const r = dlg.getBoundingClientRect();
        if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) this._closeNotes();
        return;
      }
      const btn = ev.target.closest("[data-notes]");
      if (!btn) return;
      if (btn.dataset.notes === "close") this._closeNotes();
      else if (btn.dataset.notes === "retry" && this._notes) {
        const n = this._notes;
        n.loading = true;
        n.error = null;
        this._renderNotes();
        this._loadNotes(n, true);
      }
    });
    // Escape schliesst nur dieses Fenster, nicht die Einstellungen dahinter.
    dlg.addEventListener("close", () => {
      this._notes = null;
    });
  }

  // --- Einstellungen sichern und wiederherstellen (seit 2.98.0, docs/mockups/backup-v1, A) ---------------------------------
  // Kapitel unter "Startseite" (Panel › Allgemein): zwei Knöpfe. Mit ungespeicherten Änderungen gesperrt: die Wiederherstellung
  // lädt die Einstellungen neu und würde den Entwurf verwerfen, die Sicherung enthielte ihn nicht.
  _backupChapterHtml(dirty) {
    const t = (k, ...a) => this._t(k, ...a);
    const off = dirty ? " disabled" : "";
    return `<div class="set-title">${escape(t("ttlBackup"))}</div>
      <div class="opt-short bk-note">${escape(t("bkNote"))}</div>
      ${dirty ? `<div class="opt-warn">${mdi("alert", 14)}<span>${escape(t("bkUnsaved"))}</span></div>` : ""}
      <div class="bk-btns"><button type="button" class="dlg-btn" data-set="bk-export"${off}>${mdi("download", 18)}${escape(t("bkBackup"))}</button>
        <button type="button" class="dlg-btn" data-set="bk-import"${off}>${mdi("upload", 18)}${escape(t("bkRestore"))}</button></div>`;
  }

  _openBackup(mode) {
    const dlg = this.shadowRoot.querySelector("dialog.backup-dlg");
    if (!dlg || (this._settings && this._settingsChanges().length)) return;
    this._bk = { mode, sections: new Set(BACKUP_DEFAULT), busy: false, error: null, status: null, file: null, fileName: "", preview: null, before: true, beforeName: "", snapshot: null, result: null, paste: false, text: "" };
    this._renderBackup();
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    this._blurOnTouch();
    dlg.scrollTop = 0;
  }

  _closeBackup() {
    const dlg = this.shadowRoot.querySelector("dialog.backup-dlg");
    this._bk = null;
    if (dlg?.open) {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }
  }

  _bkDate() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  // Datei zum Herunterladen anbieten (Blob); die Companion-App auf dem Handy kann das nicht immer: dort "Kopieren"
  _downloadJson(obj, name) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    this.shadowRoot.appendChild(a);
    a.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1500);
  }

  async _bkExport(how) {
    const b = this._bk;
    if (!b || b.busy || !b.sections.size) return;
    b.busy = true;
    b.error = null;
    b.status = null;
    this._renderBackup();
    try {
      const res = await this._hass.callWS({ type: "device_panel/backup_export", sections: BACKUP_SECTIONS.filter((s) => b.sections.has(s)) });
      if (this._bk !== b) return;
      if (how === "copy") {
        await navigator.clipboard.writeText(JSON.stringify(res.file, null, 2));
        b.status = this._t("bkCopied");
      } else {
        this._downloadJson(res.file, `device-panel-${this._bkDate()}.json`);
        b.status = this._t("bkSaved");
      }
    } catch (err) {
      b.error = errText(err);
    }
    b.busy = false;
    this._renderBackup();
  }

  async _bkCopyReport() {
    const b = this._bk;
    const report = b?.mode === "done" ? b.result : b?.preview;
    if (!report) return;
    try {
      await navigator.clipboard.writeText(this._bkReportText(report, b.fileName));
      b.status = this._t("bkReportCopied");
    } catch (err) {
      b.error = errText(err);
    }
    this._renderBackup();
  }

  // Datei oder eingefügten Text lesen und die Vorschau holen (schreibt nichts)
  async _bkPreview(text, name) {
    const b = this._bk;
    if (!b || b.busy) return;
    b.busy = true;
    b.error = null;
    this._renderBackup();
    try {
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(this._t("bkBadFile"));
      }
      const res = await this._hass.callWS({ type: "device_panel/backup_import", data, dry_run: true });
      if (this._bk !== b) return;
      b.file = data;
      b.fileName = name;
      b.preview = res;
      b.mode = "preview";
    } catch (err) {
      const msg = errText(err);
      b.error = /Keine Sicherung|invalid_format/i.test(msg) ? this._t("bkBadFile") : msg;
    }
    b.busy = false;
    this._renderBackup();
  }

  // Wiederherstellen: erst der Zustand vorher (im Speicher für "Rückgängig", auf Wunsch als Datei), dann schreiben
  async _bkApply() {
    const b = this._bk;
    if (!b || b.busy || !b.preview) return;
    b.busy = true;
    b.error = null;
    this._renderBackup();
    try {
      const sections = Object.keys(b.preview.sections);
      b.snapshot = (await this._hass.callWS({ type: "device_panel/backup_export", sections })).file;
      if (b.before) {
        b.beforeName = `device-panel-vorher-${this._bkDate()}.json`;
        this._downloadJson(b.snapshot, b.beforeName);
      }
      b.result = await this._hass.callWS({ type: "device_panel/backup_import", data: b.file, sections, dry_run: false });
      b.mode = "done";
      await this._bkRefresh();
    } catch (err) {
      b.error = errText(err);
    }
    if (this._bk === b) b.busy = false;
    this._renderBackup();
  }

  // Rückgängig: den gesicherten Zustand vorher genau herstellen (auch Neues entfernen)
  async _bkUndo() {
    const b = this._bk;
    if (!b || b.busy || !b.snapshot) return;
    b.busy = true;
    b.error = null;
    this._renderBackup();
    try {
      await this._hass.callWS({ type: "device_panel/backup_import", data: b.snapshot, sections: Object.keys(b.snapshot.sections), dry_run: false, replace: true });
      b.snapshot = null;
      b.mode = "undone";
      await this._bkRefresh();
    } catch (err) {
      b.error = errText(err);
    }
    if (this._bk === b) b.busy = false;
    this._renderBackup();
  }

  // Nach dem Schreiben: Liste und Einstellungen mit dem neuen Stand des Backends neu laden
  async _bkRefresh() {
    this._fetch(true);
    const st = this._settings;
    if (st) await this._reloadSettings(st);
  }

  _bkSkipText(sk, sectionRep) {
    const t = (k, ...a) => this._t(k, ...a);
    if (sk.reason === "unknown") return [t("bkSkUnknown", sk.what), t("bkSkUnknownHint")];
    if (sk.reason === "device_unknown") return [t("bkSkDevices", sk.count || 1), t("bkSkDevicesHint")];
    if (sk.reason === "invalid") return [t("bkSkInvalid", sk.device ? `${sk.device}: ${sk.what}` : sk.what), t("bkSkInvalidHint")];
    void sectionRep;
    return [String(sk.what), String(sk.reason)];
  }

  // Hinweise und übersprungene Einträge der Vorschau oder des Ergebnisses als Zeilen; Geräte, die es hier nicht gibt, stehen
  // in einer aufklappbaren Zeile mit Name (falls die Datei ihn kennt), ID und den betroffenen Einstellungen
  _bkIssues(report, compact = false) {
    const t = (k, ...a) => this._t(k, ...a);
    const row = (icon, cls, title, hint, badge, extra = "") =>
      `<div class="bk-rw"><span class="bk-ic ${cls}">${mdi(icon, 15)}</span><div>${escape(title)}<small>${escape(hint)}</small>${extra}</div><span class="bk-badge ${cls}">${escape(badge)}</span></div>`;
    const rows = [];
    const devs = [];
    let skippedN = 0;
    for (const r of Object.values(report.sections)) {
      for (const n of r.notes) rows.push(row("alert", "w", t(`bkNote_${n.kind}`, n.what), t(`bkNoteHint_${n.kind}`), t(n.kind === "target" ? "bkBadgeWarn" : "bkBadgeHint")));
      for (const sk of r.skipped) {
        if (compact) skippedN++;
        else if (sk.reason === "device_unknown") devs.push(sk);
        else {
          const [title, hint] = this._bkSkipText(sk, r);
          rows.push(row("close", "e", title, hint, t("bkBadgeSkipped")));
        }
      }
    }
    if (compact && skippedN) {
      rows.push(`<div class="bk-rw go" data-bk="detail" data-kind="skipped" role="button" tabindex="0"><span class="bk-ic e">${mdi("close", 15)}</span><div>${escape(t("bkSkN", skippedN))}<small>${escape(t("bkSkNHint"))}</small></div><span class="bk-badge e">${escape(t("bkBadgeSkipped"))} ›</span></div>`);
    }
    if (devs.length) {
      const open = Boolean(this._bk?.devOpen);
      const lines = devs
        .map((d) => `<div class="bk-dev"><b>${escape(d.name || t("bkDevNoName"))}</b><small><code>${escape(d.id)}</code>${d.parts?.length ? ` · ${escape(t("bkDevParts", d.parts.map((x) => t(`bkPart_${x}`)).join(", ")))}` : ""}</small></div>`)
        .join("");
      const extra = `<button type="button" class="lnk bk-toggle" data-bk="devs" aria-expanded="${open}">${escape(t(open ? "bkDevHide" : "bkDevShow"))}</button>${open ? `<div class="bk-devs">${lines}</div>` : ""}`;
      rows.push(row("close", "e", t("bkSkDevices", devs.length), t("bkSkDevicesHint"), t("bkBadgeSkipped"), extra));
    }
    return rows;
  }

  _bkIssuesBlock(rows, withReport = true) {
    if (!rows.length) return "";
    const t = (k, ...a) => this._t(k, ...a);
    return `<div class="mon-grp bk-h">${escape(t("bkHeadNotes"))}</div>${rows.join("")}
      ${withReport ? `<button type="button" class="lnk bk-toggle" data-bk="report">${escape(t("bkReportCopy"))}</button>` : ""}`;
  }

  // Wert in der Detailansicht: Schalter als an/aus, Leeres als Strich
  _bkVal(v) {
    if (v === true) return this._t("bkOn");
    if (v === false) return this._t("bkOff");
    if (v === null || v === undefined || v === "") return "–";
    return String(v);
  }

  _bkKey(key) {
    return this._t("bkKeys")?.[key] || String(key).replace(/_/g, " ");
  }

  // Detailfenster zu einer Kachel: alle Änderungen (Alt → Neu), alles Gleiche oder alles Übersprungene mit Namen und IDs
  _bkDetailHtml(report, kind) {
    const t = (k, ...a) => this._t(k, ...a);
    const secs = Object.entries(report.sections);
    const grp = (s, n, body) => `<div class="bk-g" data-bk-grp="${s}"><div class="mon-grp bk-h">${escape(t(`bkSec_${s}`))} (${n})</div>${body}</div>`;
    const label = (c) => (c.device ? `${c.device} · ${this._bkKey(c.what)}` : this._bkKey(c.what));
    if (kind === "changed") {
      return secs
        .filter(([, r]) => r.changes?.length)
        .map(([s, r]) => grp(s, r.changes.length, r.changes.map((c) => `<div class="bk-dv">${escape(label(c))}<small class="bk-diff"><s>${escape(this._bkVal(c.old))}</s> → <b>${escape(this._bkVal(c.new))}</b></small>${c.detail ? `<small class="bk-ent">${escape(c.detail)}</small>` : ""}</div>`).join("")))
        .join("");
    }
    if (kind === "same") {
      return secs
        .filter(([, r]) => r.same?.length)
        .map(([s, r]) => grp(s, r.unchanged, r.same.map((c) => `<div class="bk-dv">${escape(label(c))}</div>`).join("") + (r.unchanged > r.same.length ? `<div class="bk-dv"><small>${escape(t("bkMore", r.unchanged - r.same.length))}</small></div>` : "")))
        .join("");
    }
    return `${this._bkIssues(report).join("")}`;
  }

  _bkDetailCount(report, kind) {
    const secs = Object.values(report.sections);
    if (kind === "changed") return secs.reduce((n, r) => n + r.changed, 0);
    if (kind === "same") return secs.reduce((n, r) => n + r.unchanged, 0);
    return secs.reduce((n, r) => n + r.skipped.length + r.notes.length, 0);
  }

  // Der Bericht als Text (zum Kopieren): jede Zeile mit Name und ID, damit sich die Fehler prüfen lassen
  _bkReportText(report, fileName) {
    const t = (k, ...a) => this._t(k, ...a);
    const out = [`Device Panel · ${t("bkImportTitle")} · ${fileName || ""}`.trim(), ""];
    for (const [section, r] of Object.entries(report.sections)) {
      for (const n of r.notes) out.push(`[${t(`bkSec_${section}`)}] ${t(`bkNote_${n.kind}`, n.what)} (${t(`bkNoteHint_${n.kind}`)})`);
      for (const sk of r.skipped) {
        if (sk.reason === "device_unknown") {
          const parts = sk.parts?.length ? ` · ${t("bkDevParts", sk.parts.map((x) => t(`bkPart_${x}`)).join(", "))}` : "";
          out.push(`[${t(`bkSec_${section}`)}] ${t("bkSkDevices", 1)}: ${sk.name || t("bkDevNoName")} · ${sk.id}${parts}`);
        } else {
          const [title, hint] = this._bkSkipText(sk, r);
          out.push(`[${t(`bkSec_${section}`)}] ${title} (${hint})`);
        }
      }
    }
    return out.join("\n");
  }

  _renderBackup() {
    const dlg = this.shadowRoot.querySelector("dialog.backup-dlg");
    const b = this._bk;
    if (!dlg || !b) return;
    const t = (k, ...a) => this._t(k, ...a);
    const err = b.error ? `<div class="dlg-error">${escape(t("bkError"))} ${escape(b.error)}</div>` : "";
    const btn = (data, icon, label, cls = "", extra = "") => `<button type="button" class="dlg-btn${cls ? ` ${cls}` : ""}" data-bk="${data}"${b.busy ? " disabled" : ""}${extra}>${mdi(icon, 18)}${escape(label)}</button>`;
    const head = (icon, title, sub) => `<div class="dlg-head"><span class="dlg-avatar">${mdi(icon, 24)}</span><div class="dlg-title"><h2>${escape(title)}</h2><div class="dlg-sub">${escape(sub)}</div></div>
        <button type="button" class="dlg-close" data-bk="close" title="${escape(t("close"))}" aria-label="${escape(t("close"))}">${mdi("close", 18)}</button></div>`;
    let html;
    if (b.mode === "export") {
      const rows = BACKUP_SECTIONS.map(
        (s) => `<div class="opt"><div class="opt-line"><span class="opt-label">${escape(t(`bkSec_${s}`))}</span>
          <label class="switch"><input type="checkbox" data-bk-sec="${s}" ${b.sections.has(s) ? "checked" : ""} aria-label="${escape(t(`bkSec_${s}`))}"><span></span></label></div>
          <div class="opt-short">${escape(t(`bkSecShort_${s}`))}</div></div>`
      ).join("");
      html = `${head("download", t("bkExportTitle"), t("bkExportSub"))}<div class="dlg-body">${rows}
        <div class="nf-note">${mdi("info", 16)}<div><p>${escape(t("bkContains"))}</p></div></div>
        <div class="dlg-note small">${escape(t("bkFileName"))}: <code>device-panel-${this._bkDate()}.json</code></div>
        ${b.status ? `<div class="dlg-note" role="status">${escape(b.status)}</div>` : ""}${err}</div>
        <div class="dlg-actions">${btn("close", "close", t("bkCancel"))}${btn("copy", "copy", t("bkCopy"), "", b.sections.size ? "" : " disabled")}${btn("save", "download", t("bkSave"), "primary", b.sections.size ? "" : " disabled")}</div>`;
    } else if (b.mode === "import") {
      html = `${head("upload", t("bkImportTitle"), t("bkPickSub"))}<div class="dlg-body">
        <label class="dlg-btn bk-file${b.busy ? " disabled" : ""}">${mdi("upload", 18)}${escape(t("bkPick"))}<input type="file" accept="application/json,.json,text/plain" data-bk-file hidden></label>
        <button type="button" class="lnk bk-paste-toggle" data-bk="paste">${escape(t("bkPaste"))}</button>
        ${b.paste ? `<textarea class="bk-text" data-bk-text rows="6" placeholder="${escape(t("bkPasteHint"))}" aria-label="${escape(t("bkPaste"))}">${escape(b.text)}</textarea>
          <div class="aip-btns">${btn("pastego", "check", t("bkPasteGo"), "primary")}</div>` : ""}
        <div class="dlg-note small">${escape(t("bkPickNote"))}</div>${err}</div>
        <div class="dlg-actions">${btn("close", "close", t("bkCancel"))}</div>`;
    } else if (b.mode === "preview") {
      const tot = b.preview.totals;
      const rows = Object.entries(b.preview.sections)
        .map(([s, r]) => {
          const ex = r.changes?.[0];
          const detail = [r.changed ? t("bkChangedN", r.changed) : t("bkNoChange"), ex ? `${ex.device ? `${ex.device} · ` : ""}${this._bkKey(ex.what)}: ${this._bkVal(ex.old)} → ${this._bkVal(ex.new)}${ex.detail ? ` (${ex.detail})` : ""}` : ""].filter(Boolean).join(" · ");
          const go = r.changed ? ` data-bk="detail" data-kind="changed" data-sec="${s}" role="button" tabindex="0"` : "";
          return `<div class="bk-rw${r.changed ? " go" : ""}"${go}><span class="bk-dot${r.changed ? " on" : ""}"></span><div>${escape(t(`bkSec_${s}`))}<small>${escape(detail)}</small></div><span class="bk-badge${r.changed ? " g" : ""}">${r.changed}${r.changed ? " ›" : ""}</span></div>`;
        })
        .join("");
      const notes = this._bkIssues(b.preview, true);
      const tile = (kind, n, cls, label) =>
        n ? `<button type="button" class="bk-tile go" data-bk="detail" data-kind="${kind}"><b class="${cls}">${n}</b><span>${escape(label)}</span></button>` : `<div class="bk-tile"><b class="${cls}">${n}</b><span>${escape(label)}</span></div>`;
      const ver = b.preview.file_version ? t("bkPreviewSub", b.fileName, b.preview.file_version) : b.fileName;
      html = `${head("upload", t("bkImportTitle"), ver)}<div class="dlg-body">
        <div class="bk-sum">${tile("changed", tot.changed, "ok", t("bkTChanged"))}${tile("same", tot.unchanged, "", t("bkTSame"))}${tile("skipped", tot.skipped, "wn", t("bkTSkipped"))}</div>
        ${rows}${this._bkIssuesBlock(notes, false)}
        <div class="opt"><div class="opt-line"><span class="opt-label">${escape(t("bkBefore"))}</span><label class="switch"><input type="checkbox" data-bk-before ${b.before ? "checked" : ""} aria-label="${escape(t("bkBefore"))}"><span></span></label></div><div class="opt-short">${escape(t("bkBeforeShort"))}</div></div>${b.status ? `<div class="dlg-note" role="status">${escape(b.status)}</div>` : ""}${err}</div>
        <div class="dlg-actions">${btn("close", "close", t("bkCancel"))}${btn("apply", "check", tot.changed ? t("bkApply", tot.changed) : t("bkNothing"), "primary", tot.changed ? "" : " disabled")}</div>`;
    } else if (b.mode === "detail") {
      const report = b.from === "done" ? b.result : b.preview;
      const kind = b.detail.kind;
      const n = this._bkDetailCount(report, kind);
      const icon = kind === "changed" ? "check" : kind === "same" ? "info" : "close";
      html = `${head(icon, t(`bkDet_${kind}`), t(`bkDetSub_${kind}`, n))}<div class="dlg-body bk-detail">${this._bkDetailHtml(report, kind)}
        ${kind === "skipped" ? `<button type="button" class="lnk bk-toggle" data-bk="report">${escape(t("bkReportCopy"))}</button>` : ""}${b.status ? `<div class="dlg-note" role="status">${escape(b.status)}</div>` : ""}${err}</div>
        <div class="dlg-actions">${btn("back", "arrowLeft", t("bkBack"), "primary")}</div>`;
    } else if (b.mode === "done") {
      const tot = b.result.totals;
      html = `${head("check", t("bkDoneTitle"), t("bkDoneSub", tot.changed, tot.skipped))}<div class="dlg-body">
        ${b.beforeName ? `<div class="dlg-note">${escape(t("bkBeforeSaved", b.beforeName))}</div>` : ""}
        ${this._bkIssuesBlock(this._bkIssues(b.result))}
        <div class="dlg-note small">${escape(t("bkUndoNote"))}</div>${b.status ? `<div class="dlg-note" role="status">${escape(b.status)}</div>` : ""}${err}</div>
        <div class="dlg-actions">${btn("undo", "reset", t("bkUndo"), "", b.snapshot ? "" : " disabled")}${btn("close", "close", t("close"), "primary")}</div>`;
    } else {
      html = `${head("reset", t("bkUndoneTitle"), t("bkUndoneSub"))}<div class="dlg-body">${err}</div>
        <div class="dlg-actions">${btn("close", "close", t("close"), "primary")}</div>`;
    }
    setHtml(dlg, html);
  }

  _bindBackup(dlg) {
    if (!dlg) return;
    dlg.addEventListener("click", (ev) => {
      if (ev.target === dlg) {
        const r = dlg.getBoundingClientRect();
        if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) this._closeBackup();
        return;
      }
      const btn = ev.target.closest("[data-bk]");
      const b = this._bk;
      if (!btn || !b) return;
      const act = btn.dataset.bk;
      if (act === "close") this._closeBackup();
      else if (act === "save") this._bkExport("file");
      else if (act === "copy") this._bkExport("copy");
      else if (act === "paste") {
        b.paste = !b.paste;
        this._renderBackup();
      } else if (act === "pastego") {
        b.text = dlg.querySelector("[data-bk-text]")?.value || "";
        this._bkPreview(b.text, this._t("bkPasted"));
      } else if (act === "detail") {
        b.from = b.mode;
        b.detail = { kind: btn.dataset.kind, sec: btn.dataset.sec || null };
        b.mode = "detail";
        b.status = null;
        if (b.detail.kind === "skipped") b.devOpen = true;
        this._renderBackup();
        if (b.detail.sec) dlg.querySelector(`[data-bk-grp="${b.detail.sec}"]`)?.scrollIntoView({ block: "start" });
      } else if (act === "back") {
        b.mode = b.from || "preview";
        b.status = null;
        this._renderBackup();
      } else if (act === "devs") {
        b.devOpen = !b.devOpen;
        this._renderBackup();
      } else if (act === "report") this._bkCopyReport();
      else if (act === "apply") this._bkApply();
      else if (act === "undo") this._bkUndo();
    });
    dlg.addEventListener("keydown", (ev) => {
      const el = ev.target;
      if ((ev.key === "Enter" || ev.key === " ") && el.matches?.('[role="button"][data-bk]')) {
        ev.preventDefault();
        el.click();
      }
    });
    dlg.addEventListener("change", async (ev) => {
      const b = this._bk;
      const el = ev.target;
      if (!b) return;
      if (el.dataset.bkSec) {
        if (el.checked) b.sections.add(el.dataset.bkSec);
        else b.sections.delete(el.dataset.bkSec);
        this._renderBackup();
      } else if (el.dataset.bkBefore !== undefined) {
        b.before = el.checked;
      } else if (el.dataset.bkFile !== undefined && el.files?.[0]) {
        const file = el.files[0];
        let text = "";
        try {
          text = await file.text();
        } catch (err) {
          b.error = errText(err);
          this._renderBackup();
          return;
        }
        this._bkPreview(text, file.name);
      }
    });
    dlg.addEventListener("input", (ev) => {
      if (this._bk && ev.target.dataset.bkText !== undefined) this._bk.text = ev.target.value;
    });
    // Escape schliesst nur dieses Fenster, nicht die Einstellungen dahinter.
    dlg.addEventListener("close", () => {
      this._bk = null;
    });
  }

  _openPrompt() {
    const st = this._settings;
    const dlg = this.shadowRoot.querySelector("dialog.prompt-dlg");
    if (!st?.draft || !dlg) return;
    const devices = this._devices.filter((d) => !d.disabled);
    const first = devices.find((d) => d.online === false) || devices[0];
    this._prompt = { text: st.draft.ai_prompt || st.data.ai_prompt_default || "", tab: "edit", device: first ? first.id : null, preview: null, seq: 0 };
    this._renderPrompt();
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    this._blurOnTouch();
    dlg.scrollTop = 0;
  }

  _closePrompt() {
    const dlg = this.shadowRoot.querySelector("dialog.prompt-dlg");
    if (dlg?.open) {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }
  }

  _promptError(text) {
    const p = promptProblem(text.replace(/\r\n/g, "\n").trim());
    return p ? this._t(p[0], p[1]) : "";
  }

  _renderPrompt() {
    const dlg = this.shadowRoot.querySelector("dialog.prompt-dlg");
    const p = this._prompt;
    const st = this._settings;
    if (!dlg || !p || !st?.data) return;
    const t = (k, ...a) => this._t(k, ...a);
    const def = st.data.ai_prompt_default || "";
    const own = p.text.trim() !== def.trim();
    const tabs = [["edit", "promptTabEdit"], ["preview", "promptTabPreview"]]
      .map(([id, key]) => `<button type="button" role="tab" class="sub-tab${p.tab === id ? " on" : ""}" data-prompt="tab" data-key="${id}" aria-selected="${p.tab === id}">${escape(t(key))}</button>`)
      .join("");
    let body;
    if (p.tab === "preview") {
      const devices = this._devices.filter((d) => !d.disabled).sort((a, b) => String(a.name).localeCompare(String(b.name)));
      const pv = p.preview;
      const text = !devices.length
        ? `<div class="opt-short">${escape(t("promptNoDevice"))}</div>`
        : !pv || pv.loading
          ? `<div class="opt-short">${escape(t("promptPreviewLoading"))}</div>`
          : pv.error
            ? `<div class="opt-error">${escape(t("promptPreviewError"))} ${escape(pv.error)}</div>`
            : `<div class="aip-box ro">${promptHtml(pv.text)}</div>`;
      body = `<div class="opt-line prompt-dev"><span class="opt-label">${escape(t("promptDevice"))}</span><span class="opt-select"><select data-prompt-dev aria-label="${escape(t("promptDevice"))}">${devices
        .map((d) => `<option value="${escape(d.id)}"${d.id === p.device ? " selected" : ""}>${escape(d.name)}</option>`)
        .join("")}</select>${mdi("chevronDown", 18)}</span></div>${text}
        <div class="opt-short">${escape(t("promptPreviewNote"))}</div>`;
    } else {
      body = `<div class="pr-vars">${PROMPT_VARS.map((v) => `<button type="button" class="chip" data-prompt="insert" data-key="${escape(v)}" title="${escape(t("promptVarInfo", v))}" aria-label="${escape(t("promptInsert", v))}">${escape(v)}</button>`).join("")}</div>
        <div class="opt-short">${escape(t("promptVarsHint"))}</div>
        <textarea class="pr-text" data-prompt-text spellcheck="false" rows="12" aria-label="${escape(t("promptTitle"))}">${escape(p.text)}</textarea>
        <div class="pr-count" data-prompt-count></div><div class="opt-error" data-prompt-error hidden></div>
        <div class="nf-note">${mdi("info", 16)}<div><p>${escape(t("promptHeadline"))}</p></div></div>
        <div class="aip-btns"><button type="button" class="dlg-btn" data-prompt="default">${mdi("reset", 18)}${escape(t("promptInsertDefault"))}</button>
          <button type="button" class="dlg-btn" data-prompt="copy">${mdi("copy", 18)}${escape(t("aiPromptCopy"))}</button></div>`;
    }
    const html = `<div class="dlg-head"><div class="dlg-title"><h2>${escape(t("promptTitle"))}</h2><div class="dlg-sub" data-prompt-sub>${escape(t(own ? "promptSubOwn" : "promptSubDefault"))}</div></div>
        <button type="button" class="dlg-close" data-prompt="cancel" title="${escape(t("close"))}" aria-label="${escape(t("close"))}">${mdi("close", 18)}</button></div>
      <div class="dlg-body"><div class="sub-tabs" role="tablist">${tabs}</div>${body}</div>
      <div class="dlg-actions"><button type="button" class="dlg-btn" data-prompt="cancel">${mdi("close", 18)}${escape(t("promptCancel"))}</button>
        <button type="button" class="dlg-btn primary" data-prompt="apply">${mdi("check", 18)}${escape(t("promptApply"))}</button></div>`;
    // Das Textfeld ändert sich beim Tippen ohne Neuaufbau; darum immer neu schreiben.
    setHtml(dlg, "");
    setHtml(dlg, html);
    this._promptLive();
  }

  // Zähler, Fehler und "Übernehmen" nachführen, ohne das Textfeld neu zu bauen.
  _promptLive() {
    const dlg = this.shadowRoot.querySelector("dialog.prompt-dlg");
    const p = this._prompt;
    if (!dlg || !p) return;
    const error = this._promptError(p.text);
    const count = dlg.querySelector("[data-prompt-count]");
    if (count) count.textContent = this._t("promptCount", p.text.length, PROMPT_MAX);
    const err = dlg.querySelector("[data-prompt-error]");
    if (err) {
      err.hidden = !error;
      err.textContent = error;
    }
    dlg.querySelector(".pr-text")?.classList.toggle("bad", Boolean(error));
    const apply = dlg.querySelector('[data-prompt="apply"]');
    if (apply) apply.disabled = Boolean(error);
    const sub = dlg.querySelector("[data-prompt-sub]");
    const def = this._settings?.data?.ai_prompt_default || "";
    if (sub) sub.textContent = this._t(p.text.trim() !== def.trim() ? "promptSubOwn" : "promptSubDefault");
  }

  // Vorschau mit den Fakten des gewählten Geräts; veraltete Antworten verfallen (seq).
  async _promptPreview() {
    const p = this._prompt;
    if (!p || !p.device) return;
    const seq = ++p.seq;
    p.preview = { loading: true };
    this._renderPrompt();
    let result;
    try {
      const text = p.text.replace(/\r\n/g, "\n").trim();
      const problem = this._promptError(text);
      if (problem) throw new Error(problem);
      const r = await this._hass.callWS({ type: "device_panel/ai_prompt_preview", device_id: p.device, language: pickLang(this._hass), prompt: text });
      result = { text: r.text };
    } catch (err) {
      result = { error: err && typeof err === "object" && err.message ? String(err.message) : String(err || "") };
    }
    if (this._prompt !== p || p.seq !== seq || p.tab !== "preview") return;
    p.preview = result;
    this._renderPrompt();
  }

  _bindPrompt(dlg) {
    dlg.addEventListener("click", (ev) => {
      if (ev.target === dlg) {
        const r = dlg.getBoundingClientRect();
        if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) this._closePrompt();
        return;
      }
      const btn = ev.target.closest("[data-prompt]");
      const p = this._prompt;
      if (!btn || btn.disabled || !p) return;
      const action = btn.dataset.prompt;
      const area = dlg.querySelector(".pr-text");
      if (action === "cancel") this._closePrompt();
      else if (action === "apply") {
        const st = this._settings;
        const text = p.text.replace(/\r\n/g, "\n").trim();
        if (!st?.draft || this._promptError(text)) return;
        st.draft.ai_prompt = text === (st.data.ai_prompt_default || "").trim() ? "" : text;
        this._closePrompt();
        this._renderSettings();
      } else if (action === "tab") {
        if (area) p.text = area.value;
        p.tab = btn.dataset.key;
        if (p.tab === "preview") this._promptPreview();
        else this._renderPrompt();
      } else if (action === "insert" && area) {
        const at = area.selectionStart ?? area.value.length;
        const end = area.selectionEnd ?? at;
        area.value = area.value.slice(0, at) + btn.dataset.key + area.value.slice(end);
        p.text = area.value;
        area.focus();
        area.setSelectionRange(at + btn.dataset.key.length, at + btn.dataset.key.length);
        this._promptLive();
      } else if (action === "default") {
        p.text = this._settings?.data?.ai_prompt_default || "";
        this._renderPrompt();
      } else if (action === "copy") this._copyText(area ? area.value : p.text, btn);
    });
    dlg.addEventListener("input", (ev) => {
      if (!ev.target.matches?.("[data-prompt-text]") || !this._prompt) return;
      this._prompt.text = ev.target.value;
      this._promptLive();
    });
    dlg.addEventListener("change", (ev) => {
      if (!ev.target.matches?.("[data-prompt-dev]") || !this._prompt) return;
      this._prompt.device = ev.target.value;
      this._promptPreview();
    });
  }

  _applyPanelSettings(panel) {
    if (!panel) return;
    this._prerelease = panel.prerelease === true;
    // Automatisch installieren (seit 2.22.0): wirkt nur zusammen mit der täglichen Prüfung
    this._autoUpdate = panel.auto_update === true;
  }

  _settingsEntryChanges() {
    const st = this._settings;
    if (!st || !st.draft) return [];
    // Listen (Ausschlüsse) und Zuordnungen (Batterie pro Integration) nach
    // Inhalt vergleichen, nicht nach Referenz oder Reihenfolge.
    // Ausnahme: die Reihenfolge der Chips, bei ihr zählt genau die Folge.
    const norm = (v) => (Array.isArray(v) ? [...v].sort() : v && typeof v === "object" ? Object.entries(v).sort() : v);
    const same = (k, a, b) => (k === "connection_order" || k === "chip_order" ? JSON.stringify(a || []) === JSON.stringify(b || []) : JSON.stringify(norm(a)) === JSON.stringify(norm(b)));
    return Object.keys(st.draft).filter((k) => !same(k, st.draft[k], st.data.values[k]));
  }

  _settingsExtraChanges() {
    const st = this._settings;
    if (!st || !st.extra) return [];
    return Object.keys(st.extra).filter((k) => st.extra[k] !== st.extraBase[k]);
  }

  // Eine Änderung pro zurückgesetztem Gerät; der Schlüssel ordnet sie dem
  // Abschnitt zu (Etikett "geändert").
  _settingsResetChanges() {
    const st = this._settings;
    if (!st?.resets) return [];
    return RESET_KINDS.flatMap((k) => [...st.resets[k]].map(() => `reset_${k}`));
  }

  _settingsChanges() {
    return [...this._settingsEntryChanges(), ...this._settingsExtraChanges(), ...this._settingsResetChanges(), ...(this._viewChanged() ? ["view"] : [])];
  }

  // Abschnitte mit ihren Optionen. Seit 0.34.0 (docs/mockups/notify-v3)
  // zuerst "Überwachung und Meldungen" mit allem, was überwacht und meldet;
  // "Integrationen" nur noch mit "Anzeigen".
  _settingsSections() {
    return [
      ["devices", ["show_service_devices", "show_disabled_devices", ...SUB_TAB_KEYS.integrations, ...SUB_TAB_KEYS.types, ...SUB_TAB_KEYS.devs, ...SUB_TAB_KEYS.devset]],
      ["monitor", Object.values(MON_TAB_KEYS).flat()],
      ["routines", ["routines_pause", "routines_catch_up", "notify_service_routines", "routines_notify_error"]],
      ["ai", ["ai_assessment", "ai_task_entity", "ai_prompt"]],
      ["updates", [...SUB_TAB_KEYS.pstart, ...SUB_TAB_KEYS.pupdates]],
    ];
  }

  // Zahlen ausserhalb des Bereichs (vom Server, wie im Optionsdialog): Feld
  // rot mit Hinweis, "Speichern" gesperrt.
  _settingsErrors() {
    const st = this._settings;
    const errors = {};
    if (!st || !st.draft || !st.data) return errors;
    for (const [key, [min, max]] of Object.entries(st.data.limits || {})) {
      if (!(key in st.draft)) continue;
      const v = st.draft[key];
      if (!Number.isInteger(v) || v < min || v > max) errors[key] = this._t("settingsRange", min, max);
    }
    if (st.draft.update_check_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(st.draft.update_check_time))) errors.update_check_time = this._t("timeError");
    if (Array.isArray(st.draft.quiet_days) && st.draft.quiet_days.some((x) => x.on && !(/^([01]\d|2[0-3]):[0-5]\d$/.test(String(x.from || "")) && /^([01]\d|2[0-3]):[0-5]\d$/.test(String(x.to || ""))))) errors.quiet_days = this._t("timeError");
    if ("updates_time" in st.draft && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(st.draft.updates_time || ""))) errors.updates_time = this._t("timeError");
    if ("battery_push_time" in st.draft && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(st.draft.battery_push_time || ""))) {
      errors.battery_push_time = this._t("timeError");
    }
    if (this._batInvalid().length) errors.battery_low_integrations = this._t("settingsRange", ...(st.data.limits?.battery_low || [1, 50]));
    // Warnschwelle des Empfangs pro Funkart ausserhalb des Bereichs der Einheit.
    const sigBad = this._sigInvalid();
    const sigGlobal = sigBad.find((x) => !x.dom);
    const sigInteg = sigBad.find((x) => x.dom);
    if (sigGlobal) errors.signal_low = this._t("settingsRange", ...sigGlobal.range);
    if (sigInteg) errors.signal_low_integrations = this._t("settingsRange", ...sigInteg.range);
    // Eigenes "Erst melden nach" einer Integration nie kürzer als ihr wirksames "Ausgefallen nach" (seit 2.91.0): Fehler, Speichern gesperrt
    {
      const own = st.draft.notify_delay_integrations || {};
      const offs = st.draft.offline_after_integrations || {};
      const globalOff = errors.offline_after ? st.data.values.offline_after : st.draft.offline_after;
      const bad = Object.entries(own).find(([dom, v]) => {
        const off = offs[dom] === undefined ? globalOff : offs[dom];
        return Number.isInteger(v) && Number.isInteger(off) && v < off;
      });
      if (bad) errors.notify_delay_integrations = this._t("integDelayError", this._t("offlineMin", Number.isInteger(offs[bad[0]]) ? offs[bad[0]] : globalOff));
    }
    // "Erst melden nach" nie kürzer als "Ausgefallen nach" (seit 0.34.0,
    // Wunsch des Nutzers): vorher gilt ein Gerät nicht als ausgefallen.
    const { offline_after: oa, notify_delay: nd } = st.draft;
    if (!errors.offline_after && !errors.notify_delay && Number.isInteger(oa) && Number.isInteger(nd) && nd < oa) errors.notify_delay = this._t("delayShort", oa);
    return errors;
  }

  // Integrationen, deren eigene Batterie-Schwelle ausserhalb des Bereichs liegt.
  _batInvalid() {
    const st = this._settings;
    const [min, max] = st?.data?.limits?.battery_low || [1, 50];
    return Object.entries(st?.draft?.battery_low_integrations || {})
      .filter(([, v]) => v !== "off" && (!Number.isInteger(v) || v < min || v > max))
      .map(([d]) => d);
  }

  // Geräte mit Empfangswert je Verbindungsart ("wifi") und je Integration und
  // Verbindungsart ("shelly|wifi") für die Warnschwellen pro Funkart (seit
  // 1.17.0). Die Einheit einer Gruppe ist die häufigste ihrer Geräte.
  _sigGroups() {
    const out = new Map();
    for (const dev of this._devices) {
      const kind = dev.signal?.value != null ? dev.signal.kind : null;
      if (!kind || dev.disabled) continue;
      // Die Verbindungsart des Backends (Hand vor Integration vor Erkennung), nicht
      // die verfeinerte des Panels: nach ihr rechnet das Backend die Schwelle ("matter"
      // bleibt "matter", auch wenn der Chip "Thread" zeigt).
      const conn = CONN[dev.connection] ? dev.connection : "unknown";
      const dom = dev.integration?.domain;
      for (const key of dom ? [conn, `${dom}|${conn}`] : [conn]) {
        const g = out.get(key) || { devices: 0, kinds: new Map() };
        g.devices += 1;
        g.kinds.set(kind, (g.kinds.get(kind) || 0) + 1);
        out.set(key, g);
      }
    }
    return out;
  }

  // Einheit einer Funkart: die häufigste der Geräte, sonst die der eigenen Zahl.
  _sigKind(group, value) {
    if (group) return [...group.kinds.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return Number.isInteger(value) && value > 0 ? "lqi" : "dbm";
  }

  // Eigene Schwellen pro Funkart (global und je Integration), deren Zahl
  // ausserhalb des Bereichs ihrer Einheit liegt: {dom, conn, range}.
  _sigInvalid() {
    const st = this._settings;
    if (!st?.draft) return [];
    const groups = this._sigGroups();
    const rows = [
      ...Object.entries(st.draft.signal_low || {}).map(([conn, v]) => ({ dom: "", conn, v })),
      ...Object.entries(st.draft.signal_low_integrations || {}).flatMap(([dom, m]) => Object.entries(m || {}).map(([conn, v]) => ({ dom, conn, v }))),
    ];
    return rows
      .filter(({ v }) => v !== "off")
      .map((x) => ({ ...x, range: this._sigKind(groups.get(x.dom ? `${x.dom}|${x.conn}` : x.conn), x.v) === "lqi" ? SIG_LQI_RANGE : SIG_DBM_RANGE }))
      .filter(({ v, range }) => !Number.isInteger(v) || v < range[0] || v > range[1]);
  }

  // Schwelle einer Funkart im Entwurf setzen; undefined = Standard (Eintrag
  // weg, bei einer Integration auch deren leere Zuordnung). id: "<Domain>|<Art>",
  // ohne Domain die globale Schwelle.
  _setSig(id, value) {
    const st = this._settings;
    const [dom, conn] = id.split("|");
    const put = (map) => {
      const out = { ...(map || {}) };
      if (value === undefined) delete out[conn];
      else out[conn] = value;
      return out;
    };
    if (!dom) st.draft.signal_low = put(st.draft.signal_low);
    else {
      const all = { ...(st.draft.signal_low_integrations || {}) };
      const own = put(all[dom]);
      if (Object.keys(own).length) all[dom] = own;
      else delete all[dom];
      st.draft.signal_low_integrations = all;
    }
  }

  // Zeilen "Funkart: Standard / Eigene / Aus" der Empfang-Warnschwelle (seit
  // 1.17.0): dom leer = global (Reiter Verbindungsart), sonst eine Integration.
  // Es erscheinen die Funkarten mit Geräten, die einen Empfangswert melden, dazu
  // solche mit eigener Einstellung ohne Geräte (zum Zurücksetzen).
  _sigRowsHtml(d, dom) {
    const st = this._settings;
    const t = (k, ...a) => this._t(k, ...a);
    const groups = this._sigGroups();
    const prefix = dom ? `${dom}|` : "";
    const pick = (src) => (dom ? (src.signal_low_integrations || {})[dom] : src.signal_low) || {};
    const table = pick(d);
    const saved = pick(st.data.values);
    const conns = new Set([...Object.keys(table), ...Object.keys(saved)]);
    for (const key of groups.keys()) if (dom ? key.startsWith(prefix) : !key.includes("|")) conns.add(key.slice(prefix.length));
    const bad = new Set(this._sigInvalid().filter((x) => x.dom === (dom || "")).map((x) => x.conn));
    const name = dom ? this._integrations[dom] || dom : "";
    const list = [...conns].sort((a, b) => (groups.get(prefix + b)?.devices || 0) - (groups.get(prefix + a)?.devices || 0) || a.localeCompare(b));
    return list
      .map((conn) => {
        const g = groups.get(prefix + conn);
        const own = table[conn];
        const mode = own === "off" ? "off" : own === undefined ? "default" : "own";
        const kind = this._sigKind(g, own);
        const [min, max] = kind === "lqi" ? SIG_LQI_RANGE : SIG_DBM_RANGE;
        // Was ohne eigene Einstellung gilt: in der Integration der globale Wert, sonst der feste Standard.
        const def = dom ? sigDefaultOf(d.signal_low, null, conn, kind) : { value: null, source: null };
        const stdText = def.value === "off" ? t("sigOffWord") : sigText({ kind, value: Number.isInteger(def.value) ? def.value : sigStd(kind) });
        const defLabel = def.source === "global" ? (def.value === "off" ? t("sigRowGlobalOff") : t("sigRowGlobal", stdText)) : t("sigRowDefault", stdText);
        const id = `${dom || ""}|${conn}`;
        const label = CONN[conn] ? t(CONN[conn].key) : conn;
        const aria = `${name ? `${name}: ` : ""}${label}: ${t("devSignal")}`;
        const changed = JSON.stringify(own ?? null) !== JSON.stringify(saved[conn] ?? null);
        const select = `<span class="opt-select"><select data-sig-mode="${escape(id)}" aria-label="${escape(aria)}">${[["default", defLabel], ["own", t("originOwn")], ["off", t("devSigOff")]]
          .map(([v, l]) => `<option value="${v}"${v === mode ? " selected" : ""}>${escape(l)}</option>`)
          .join("")}</select>${mdi("chevronDown", 18)}</span>`;
        const input =
          mode === "own"
            ? `<span class="opt-input${bad.has(conn) ? " bad" : ""}"><input type="number"${kind === "lqi" ? ' inputmode="numeric"' : ""} step="1" min="${min}" max="${max}" data-sig="${escape(id)}" value="${escape(own ?? "")}" placeholder="${escape(stdText)}" aria-label="${escape(`${aria} (${t("devSigLow")})`)}"><span class="unit">${kind === "lqi" ? "LQI" : "dBm"}</span></span>`
            : "";
        const origin = `<div class="opt-origin"><span class="origin ${mode !== "default" ? "own" : "std"}">${escape(t(mode !== "default" ? "originOwn" : "originStandard"))}</span>${mode !== "default" ? `<span>${escape(t("originDefaultWould", stdText))}</span>` : ""}</div>`;
        const info = g ? t("sigRowInfo", g.devices, kind === "lqi") : t("sigRowNone");
        return `<div class="opt bat-row sig-row${changed ? " changed" : ""}${bad.has(conn) ? " invalid" : ""}"><div class="opt-line"><span class="opt-label">${escape(label)}</span><span class="bat-ctl">${select}${input}</span></div>
          <div class="opt-short">${escape(info)}</div>
          <div class="opt-error" data-sig-error="${escape(id)}" ${bad.has(conn) ? "" : "hidden"}>${bad.has(conn) ? escape(t("settingsRange", min, max)) : ""}</div>${origin}</div>`;
      })
      .join("");
  }

  // Reiter "Empfang" der Überwachung (seit 2.0.7, vorher in "Darstellung" › "Verbindungsart"): die Warnschwellen pro Funkart
  // und, wie bei den anderen Reitern, die Geräte mit eigener Schwelle unter "Abweichungen".
  _monSigHtml(d) {
    const t = (k, ...a) => this._t(k, ...a);
    return `${this._sigGlobalHtml(d)}<div class="mon-grp">${escape(t("grpDiff"))}</div>${this._integDiffBox(d, "sig")}${this._overridesHtml("signal")}`;
  }

  // Globale Warnschwellen des Empfangs pro Funkart (Reiter "Empfang").
  _sigGlobalHtml(d) {
    const t = (k, ...a) => this._t(k, ...a);
    const rows = this._sigRowsHtml(d, "");
    return `<div class="set-title">${escape(t("sigTitle"))}</div>
      <div class="opt-short">${escape(t("sigShort"))}</div>${rows || `<div class="opt-short mon-empty">${escape(t("sigNone"))}</div>`}`;
  }

  // Verbindungsarten für die Filter-Chips: alle mit Geräten (wie die Chips,
  // häufigste zuerst), dazu ausgeblendete ohne Geräte.
  // Zahl der Geräte je Verbindungsart (alle Geräte, ohne Filter).
  _connCounts() {
    const counts = new Map();
    for (const dev of this._devices) counts.set(this._connOf(dev), (counts.get(this._connOf(dev)) || 0) + 1);
    return counts;
  }

  // Neue Folge in den Entwurf: Entspricht sie der Standardfolge, gilt "leer"
  // (neue Verbindungsarten ordnen sich dann von allein ein). Die Ausgangsfolge
  // der Verbindungsarten wird leer, die Folge steht jetzt in chip_order.
  _setChipOrder(order) {
    const st = this._settings;
    const standard = chipOrder([], [], this._connCounts());
    st.draft.chip_order = JSON.stringify(order) === JSON.stringify(standard) ? [] : order;
    st.draft.connection_order = [];
  }

  // Angezeigte Folge aller Chips im Entwurf (Ziehen, Pfeiltasten, Vorschau).
  _dragOrder(d) {
    return chipOrder(d.chip_order, d.connection_order, this._connCounts());
  }

  // Vorschau der Chip-Leiste für die Einstellungen (seit 1.14.0): dieselben
  // Chips in der Folge des Entwurfs, ohne Filter und Zustand; ausgeblendete und
  // nicht zutreffende fehlen wie in der echten Leiste.
  _chipPreviewHtml(d) {
    const t = (k, ...a) => this._t(k, ...a);
    const devs = this._devices;
    const counts = this._connCounts();
    const hideChips = new Set(d.hide_chips || []);
    const hideConn = new Set(d.hide_connections || []);
    const pill = (inner, cls = "") => `<span class="chip ${cls}">${inner}</span>`;
    const parts = new Map();
    parts.set("area", !hideChips.has("area") && this._areas.length ? pill(`${mdi("home", 15)}<span>${escape(t("areaChip"))}</span>${mdi("chevronDown", 15)}`) : "");
    const integs = new Set(devs.map((x) => this._integId(x)));
    parts.set("integration", !hideChips.has("integration") && integs.size >= 2 ? pill(`${mdi("puzzle", 15)}<span>${escape(t("integChip"))}</span>${mdi("chevronDown", 15)}`) : "");
    parts.set("all", pill(`<span>${escape(t("all"))}</span> <span class="n">${devs.length}</span>`, "on"));
    for (const key of Object.keys(CONN)) {
      parts.set(key, counts.get(key) && !hideConn.has(key) ? pill(`${CONN[key].icon(15)}<span>${escape(t(CONN[key].key))}</span> <span class="n">${counts.get(key)}</span>`) : "");
    }
    for (const [key, test, icon, label, cls] of [["offline", devOffline, "closeCircle", "chipOffline", "off"], ["problems", devWarn, "alert", "chipWarnings", "warn"]]) {
      const n = devs.filter(test).length;
      parts.set(key, hideChips.has(key) || !n ? "" : pill(`${mdi(icon, 15)}<span>${escape(t(label))}</span> <span class="n">${n}</span>`, cls));
    }
    for (const { key, cls, icon, label, test, bare } of HINTS) {
      const n = devs.filter(test).length;
      if (bare) {
        parts.set(key, hideChips.has(key) ? "" : pill(mdi(icon, 16), `hint bare ${cls}`));
        continue;
      }
      parts.set(key, hideChips.has(key) || !n ? "" : pill(`${mdi(icon, 15)}<span>${escape(t(label))}</span> <span class="n">${n}</span>`, `hint ${cls}`));
    }
    const order = this._dragOrder(d);
    const wrap = joinChips(order, parts, "mark", `<span class="chip-prev-pin" title="${escape(t("chipPinTip"))}">${mdi("pin", 13)}</span>`);
    // Etwas angeheftet: dazu die Leiste des Handys (eine Zeile, seitlich
    // gescrollt, zum Ausprobieren mit dem Finger oder der Maus).
    const strip = joinChips(order, parts, "group");
    return { wrap, strip: strip.includes("chip-pin") ? strip : "" };
  }

  // Ausgeblendete Geräte, wie beim Öffnen gespeichert: Wer eines wieder
  // einschaltet, behält die Zeile bis zum Speichern (sonst verschwände sie
  // unter dem Finger). Gelöschte Geräte fehlen (Backend).
  _hiddenCatalog() {
    return this._settings?.data?.catalog?.hidden_devices || [];
  }

  // Typen für die Ausschlüsse: alle mit Geräten, dazu ausgeblendete ohne.
  _catalogTypes(d) {
    const types = this._settings?.data?.catalog?.types || [];
    return types.filter((x) => x.devices > 0 || d.exclude_types.includes(x.type));
  }

  // Zahl der ausgeblendeten Einträge eines Reiters (Zähler am Reiter und in der Zusammenfassung).
  _subCount(id, d) {
    if (id === "devset") {
      // Geräte mit eigener Einstellung, die nicht zum Zurücksetzen markiert sind
      const st = this._settings;
      return ["offline", "notify_delay", "notify", "battery", "connection", "signal", "charge"].reduce((n, k) => n + (st?.data?.overrides?.[k] || []).filter((x) => !st.resets[k].has(x.id)).length, 0);
    }
    if (id === "integrations") return (d.exclude_integrations || []).length;
    if (id === "types") return (d.exclude_types || []).length;
    if (id === "devs") {
      const ex = new Set(d.exclude_devices || []);
      return this._hiddenCatalog().filter((x) => ex.has(x.id)).length;
    }
    return 0;
  }

  _settingsSummary(id, d) {
    if (id === "updates") {
      if (this._settings?.sub?.panel === "pstart") return this._t((this._settings?.extra ? this._settings.extra.start_panel : this._startOn) ? "sumStartOn" : "sumStartOff");
      const auto = Boolean(this._settings?.extra ? this._settings.extra.auto_update : this._autoUpdate);
      return this._t(d.update_check ? (auto ? "sumUpdatesAuto" : "sumUpdatesOn") : "sumUpdatesOff");
    }
    if (id === "ai") {
      const task = (this._settings?.data?.catalog?.ai_tasks || []).find((x) => x.value === d.ai_task_entity);
      const base = d.ai_assessment ? this._t("sumAiOn", task?.name || d.ai_task_entity || "") : this._t("sumAiOff");
      return d.ai_prompt ? `${base} · ${this._t("sumAiPrompt")}` : base;
    }
    if (id === "routines") {
      return this._t(d.routines_pause ? "sumRoutinesPaused" : "sumRoutinesIdle");
    }
    if (id === "monitor") {
      // Während der Eingabe ungültig: der gespeicherte Wert gilt weiter.
      const errors = this._settingsErrors();
      const num = (k) => (errors[k] ? this._settings?.data?.values?.[k] : d[k]);
      const tOut = this._hasTarget(d, "outage");
      const tBat = this._hasTarget(d, "battery");
      return this._t("sumMonitor", {
        offline: num("offline_after"),
        push: tOut && d.notify_outage,
        delay: num("notify_delay"),
        battery: num("battery_low"),
        batPush: tBat && d.battery_push,
        daily: d.battery_push_mode === "daily" ? num("battery_push_time") : null,
      });
    }
    if (id === "devices") {
      const hidden = ["integrations", "types", "devs"].map((k) => this._subCount(k, d));
      const typed = Object.keys(d.type_integrations || {}).length;
      const conn = Object.keys(d.connection_integrations || {}).length;
      return (hidden.some(Boolean) ? `${this._t("sumDevHidden", ...hidden)} · ` : "") + (typed ? `${this._t("sumTypeInteg", typed)} · ` : "") + (conn ? `${this._t("sumConnInteg", conn)} · ` : "") + this._t("sumDisplay", Boolean(d.show_service_devices), Boolean(d.show_disabled_devices));
    }
    return "";
  }

  _renderSettings() {
    const dialog = this.shadowRoot.querySelector("dialog.settings");
    const st = this._settings;
    if (!dialog || !st) return;
    const t = (k, ...a) => this._t(k, ...a);
    const viewMode = st.mode === "view";
    const head = `<div class="dlg-head"><span class="dlg-avatar">${mdi(viewMode ? "viewSettings" : "gear", 28)}</span>
        <div class="dlg-title"><h2>${escape(t(viewMode ? "viewTitle" : "settingsTitle"))}</h2><div class="dlg-sub">${escape(t(viewMode ? "viewSub" : "settingsSub"))}</div></div>
        <button type="button" class="dlg-close" data-set="close" title="${escape(t("close"))}" aria-label="${escape(t("close"))}">${mdi("close", 18)}</button></div>`;
    const changes = this._settingsChanges();
    let body;
    if (viewMode) body = this._viewBodyHtml(new Set(changes));
    else if (st.loading) body = `<p class="dlg-note">${escape(t("settingsLoading"))}</p>`;
    else if (st.error) body = `<div class="dlg-error">${escape(t("settingsLoadError"))} ${escape(st.error)}</div>`;
    else body = this._settingsBodyHtml();
    // Die Ansicht lässt sich auch speichern, solange die Filter-Chips noch laden
    const canSave = (viewMode || (!st.loading && !st.error)) && !st.saving && changes.length > 0 && !Object.keys(this._settingsErrors()).length;
    // Nach dem Speichern bleibt der Dialog offen (Wunsch des Nutzers): kurz
    // "Gespeichert" statt des Zählers; ohne Änderung heisst der Knopf "Schliessen".
    if (changes.length) st.saved = false;
    const saved = !changes.length && st.saved;
    const actions = `<div class="dlg-actions">
        <span class="set-count${saved ? " saved" : ""}" role="status">${changes.length ? escape(t("settingsChanges", changes.length)) : saved ? escape(t("settingsSavedShort")) : ""}</span>
        <button type="button" class="dlg-btn primary" data-set="save" ${canSave ? "" : "disabled"}>${mdi("save", 18)}${escape(st.saving ? t("settingsSaving") : t("settingsSave"))}</button>
        <button type="button" class="dlg-btn" data-set="close">${mdi("close", 18)}${escape(changes.length ? t("settingsCancel") : t("close"))}</button></div>`;
    // Die Versionszeile (.ver-slot) ändert sich oft (Prüfung, HACS) und wird
    // dann allein ersetzt (_renderSettingsVersion), nicht der ganze Dialog.
    const html = `${head}<div class="dlg-body">${body}</div>${actions}`;
    const scroll = dialog.scrollTop;
    const active = this.shadowRoot.activeElement;
    const focusSel = active && dialog.contains(active) && active.dataset
      ? active.dataset.set ? `[data-set="${active.dataset.set}"]${active.dataset.id ? `[data-id="${active.dataset.id}"]` : ""}${active.dataset.key ? `[data-key="${active.dataset.key}"]` : ""}`
        : active.dataset.lsearch ? `[data-lsearch="${active.dataset.lsearch}"]` : active.dataset.opt ? `[data-opt="${active.dataset.opt}"]` : active.dataset.bat ? `[data-bat="${active.dataset.bat}"]` : active.dataset.batMode ? `[data-bat-mode="${active.dataset.batMode}"]` : active.dataset.sig ? `[data-sig="${active.dataset.sig}"]` : active.dataset.sigMode ? `[data-sig-mode="${active.dataset.sigMode}"]` : active.dataset.connInteg ? `[data-conn-integ="${active.dataset.connInteg}"]` : active.dataset.typeInteg ? `[data-type-integ="${active.dataset.typeInteg}"]` : active.dataset.offMode ? `[data-off-mode="${active.dataset.offMode}"]` : active.dataset.delayMode ? `[data-delay-mode="${active.dataset.delayMode}"]` : active.dataset.imon ? `[data-imon="${active.dataset.imon}"]` : active.dataset.list && active.dataset.value ? `[data-list="${active.dataset.list}"][data-value="${active.dataset.value}"]` : active.dataset.emoji ? `[data-emoji="${active.dataset.emoji}"]` : active.dataset.nfield ? `[data-nfield="${active.dataset.nfield}"]` : active.dataset.bfield ? `[data-bfield="${active.dataset.bfield}"]` : active.dataset.newfield ? `[data-newfield="${active.dataset.newfield}"]` : active.dataset.qday !== undefined ? `[data-qday="${active.dataset.qday}"][data-qfield="${active.dataset.qfield}"]` : active.dataset.qdayOn !== undefined ? `[data-qday-on="${active.dataset.qdayOn}"]` : active.dataset.qtopic ? `[data-qtopic="${active.dataset.qtopic}"]` : active.dataset.ukind ? `[data-ukind="${active.dataset.ukind}"]` : active.dataset.uitem ? `[data-uitem="${active.dataset.uitem}"]` : active.dataset.cinteg ? `[data-cinteg="${active.dataset.cinteg}"]` : active.dataset.cfullInteg ? `[data-cfull-integ="${active.dataset.cfullInteg}"]` : active.dataset.criseInteg ? `[data-crise-integ="${active.dataset.criseInteg}"]` : active.dataset.cfull !== undefined ? "[data-cfull]" : active.dataset.ver ? `[data-ver="${active.dataset.ver}"]` : null
      : null;
    if (!setHtml(dialog, html)) return;
    // Die Versionszeile wurde eben mit aufgebaut: als aktuell vermerken, sonst
    // ersetzte sie das nächste Teil-Update einmal grundlos (siehe setHtml).
    const slot = dialog.querySelector(".ver-slot");
    if (slot) lastHtml.set(slot, this._verSlotHtml);
    dialog.scrollTop = scroll;
    // Höhe des Dialog-Kopfes: Abstand, unter dem die Kopfzeile einer aufgeklappten Gruppe haftet
    const headH = dialog.querySelector(".dlg-head")?.offsetHeight;
    if (headH) dialog.style.setProperty("--set-head-h", `${headH}px`);
    this._applyListSearch(dialog);
    // Vorschau der Handy-Leiste einmal seitlich scrollen, damit die Haftkante
    // zu sehen ist; danach bleibt, was der Nutzer eingestellt hat.
    const strip = dialog.querySelector(".chip-prev-strip");
    if (strip && !strip.dataset.placed) {
      strip.dataset.placed = "1";
      strip.scrollLeft = Math.min(120, strip.scrollWidth - strip.clientWidth);
    }
    if (focusSel) refocus(dialog.querySelector(focusSel));
  }

  // Suchfeld in langen Listen der Einstellungen (seit 1.28.0, docs/mockups/settings-search-v1, A):
  // ab 8 Einträgen über der Liste; filtert die Zeilen des Behälters mit data-srch ohne Neuaufbau.
  _searchHtml(key, n) {
    if (n < 8) return "";
    const q = this._settings?.search?.[key] || "";
    const ph = this._t("listSearch");
    return `<label class="list-search" data-for="${key}">${mdi("search", 18)}<input type="search" data-lsearch="${key}" value="${escape(q)}" placeholder="${escape(ph)}" aria-label="${escape(ph)}" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false"><span class="n"></span>${this._fieldClearHtml("data-lclear", key, q)}</label>`;
  }

  // Eigenes X in Suchfeldern (seit 1.35.0): iOS zeigt das des Browsers nicht. Sichtbar nur mit Eingabe.
  _fieldClearHtml(attr, value, text) {
    const label = this._t("searchClear");
    return `<button type="button" class="field-clear" ${attr}="${escape(value)}" title="${escape(label)}" aria-label="${escape(label)}"${text ? "" : " hidden"}>${mdi("close", 16)}</button>`;
  }

  _applyListSearch(root) {
    const st = this._settings;
    for (const wrap of root.querySelectorAll(".srch-rows[data-srch]")) {
      const key = wrap.dataset.srch;
      const q = String(st?.search?.[key] || "").trim().toLowerCase();
      const rows = [...wrap.children].filter((e) => e.matches(".ex-row, .ilist-row, .ovr-row"));
      let n = 0;
      for (const row of rows) {
        const hit = !q || row.textContent.toLowerCase().includes(q);
        row.hidden = !hit;
        if (hit) n += 1;
      }
      const none = wrap.querySelector(".srch-none");
      if (none) none.hidden = !q || n > 0;
      const cnt = root.querySelector(`.list-search[data-for="${key}"] .n`);
      if (cnt) cnt.textContent = q ? this._t("listSearchOf", n, rows.length) : "";
      const x = root.querySelector(`[data-lclear="${key}"]`);
      if (x) x.hidden = !st?.search?.[key];
    }
  }

  // Erkannte Verbindungsart der gezeigten Geräte je Integration {Domain: Map(Art -> Zahl)} für die
  // Spalte "Verbindungsart" der Integrationen (seit 2.0.4, vorher eigene Liste in "Darstellung").
  _connIntegInfo() {
    const out = new Map();
    for (const dev of this._devices) {
      const dom = dev.integration?.domain;
      if (!dom || dev.disabled) continue;
      const kinds = out.get(dom) || new Map();
      const kind = this._connAuto(dev);
      kinds.set(kind, (kinds.get(kind) || 0) + 1);
      out.set(dom, kinds);
    }
    return out;
  }

  // Erkannter Typ der gezeigten Geräte je Integration {Domain: Map(Typ -> Zahl)}
  // für die Spalte "Typ" der Integrationen (seit 1.25.0), damit man sieht, was
  // sich ändert, wenn man einen Typ festlegt.
  _typeIntegInfo() {
    const out = new Map();
    for (const dev of this._devices) {
      const dom = dev.integration?.domain;
      if (!dom || dev.disabled) continue;
      const kinds = out.get(dom) || new Map();
      const kind = dev.type_auto || dev.type;
      kinds.set(kind, (kinds.get(kind) || 0) + 1);
      out.set(dom, kinds);
    }
    return out;
  }

  // Eigene Werte der Lademeldung eines Geräts als Text (seit 2.78.0): an/aus, voll ab, Anstieg, Ende, Push bei Ende, Live
  _chargeOwnText(v) {
    const t = (k, ...a) => this._t(k, ...a);
    return [
      v.on === undefined ? "" : v.on ? t("diffCharge") : t("ovrChargeOff"),
      v.full === undefined ? "" : t("diffChargeFull", v.full),
      v.rise === undefined ? "" : t("diffChargeRise", v.rise),
      v.stall === undefined ? "" : t("diffChargeStall", v.stall),
      v.stop === undefined ? "" : t("diffChargeStop", v.stop),
      v.live === undefined ? "" : t("diffChargeLive", v.live),
    ]
      .filter(Boolean)
      .join(" · ");
  }

  // Geräte mit eigener Einstellung (Batterie oder Meldungen), einzeln oder
  // alle zurücksetzen; gilt mit "Speichern" (Variante A, docs/mockups/override-v1).
  _overridesHtml(kind) {
    const st = this._settings;
    const t = (k, ...a) => this._t(k, ...a);
    const list = st.data.overrides?.[kind] || [];
    const marked = st.resets[kind];
    const all = list.length > 0 && list.every((x) => marked.has(x.id));
    const pre = { battery: "ovrBat", notify: "ovrNotify", connection: "ovrConn", signal: "ovrSig", offline: "ovrTime", notify_delay: "ovrDelay", charge: "ovrCharge" }[kind];
    const btn = list.length
      ? `<button type="button" class="ovr-all" data-set="ovr-all" data-key="${kind}" ${all ? "disabled" : ""}>${mdi("reset", 15)}${escape(t("ovrResetAll"))}</button>`
      : "";
    const value = (x) =>
      kind === "charge"
        ? this._chargeOwnText(x.value)
        : kind === "connection"
        ? t(CONN[x.value]?.key || "connUnknown")
        : kind === "offline"
          ? x.value === "off" ? t("offlineNone") : t("offlineMin", x.value)
        : kind === "notify_delay"
          ? t("offlineMin", x.value)
        : kind === "notify" || x.value === "off"
          ? t("ovrOff")
          : kind === "signal"
            ? t("ovrSigValue", sigLimitText(x.value))
            : `${x.value} %`;
    const back = kind === "connection" ? t("ovrToAuto") : kind === "offline" || kind === "notify_delay" || kind === "charge" ? t("ovrToInteg") : t("ovrToGlobal");
    const rows = list
      .map((x) => {
        const on = marked.has(x.id);
        const sub = [x.area, x.integration, x.hidden ? t("ovrHidden") : null].filter(Boolean).join(" · ");
        const label = t(on ? "ovrUndo" : "ovrReset", x.name);
        return `<div class="ovr-row${on ? " reset" : ""}${kind === "charge" ? " long" : ""}"><span class="ovr-name">${escape(x.name)}${sub ? `<small>${escape(sub)}</small>` : ""}</span>
          <span class="ovr-val">${on ? `<s>${escape(value(x))}</s> ${escape(back)}` : escape(value(x))}</span>
          <button type="button" class="ovr-x" data-set="ovr-one" data-key="${kind}:${escape(x.id)}" title="${escape(label)}" aria-label="${escape(label)}">${mdi(on ? "reset" : "close", 16)}</button></div>`;
      })
      .join("");
    return `<div class="opt ovr-opt${marked.size ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(t(`${pre}Title`))}</span>${btn}</div>
      <div class="opt-short">${escape(t(list.length ? `${pre}Short` : `${pre}Empty`))}</div>${rows ? this._searchHtml(`ovr-${kind}`, list.length) + `<div class="ovr-list srch-rows" data-srch="ovr-${kind}">${rows}<div class="srch-none opt-short" hidden>${escape(t("listSearchNone"))}</div></div>` : ""}</div>`;
  }

  // Sichtbare Zeichen eines Texts (Emoji mit Variantenwahl, Hautton oder Joiner zählen als eins);
  // wie options_api.grapheme_count im Backend. Ohne Intl.Segmenter zählen Codepunkte.
  _graphemes(text) {
    try {
      return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((x) => x.segment);
    } catch (err) {
      return [...text];
    }
  }

  // Wirksames Emoji einer Meldung im Entwurf: eigenes (auch leer), sonst der Standard.
  _emojiOf(d, kind) {
    const own = d[`emoji_${kind}`];
    return own == null ? this._settings?.data?.emoji_defaults?.[kind] || "" : own;
  }

  // Feld, Standard-Knopf, Markierung und Vorschau einer Meldung nach dem Entwurf nachführen,
  // ohne neu aufzubauen (der Cursor soll beim Tippen bleiben). Mit setValue auch den Text.
  _syncEmoji(kind, setValue = false) {
    const dialog = this.shadowRoot.querySelector("dialog.settings");
    const st = this._settings;
    if (!dialog || !st?.draft) return;
    const key = `emoji_${kind}`;
    for (const span of dialog.querySelectorAll(`[data-pve="${kind}"]`)) span.textContent = this._pveText(st.draft, kind);
    const input = dialog.querySelector(`[data-emoji="${kind}"]`);
    if (input && setValue) input.value = this._emojiOf(st.draft, kind);
    const row = input?.closest(".emo-row");
    row?.querySelector(".emo-reset")?.toggleAttribute("disabled", st.draft[key] == null);
    row?.classList.toggle("changed", st.draft[key] !== (st.data?.values?.[key] ?? null));
  }

  // Anfang des Titels in der Vorschau: Emoji und Leerzeichen, leer ohne Emoji. Die Spanne wird
  // beim Tippen im Feld nachgeführt (data-pve), ohne die Vorschau neu zu bauen.
  _pveText(d, kind) {
    const mark = this._emojiOf(d, kind);
    return mark ? `${mark} ` : "";
  }

  _pveHtml(d, kind) {
    return `<span data-pve="${kind}">${escape(this._pveText(d, kind))}</span>`;
  }

  // Emoji im Titel der Push-Meldung (seit 2.2.0, Wunsch des Nutzers): je Meldung ein Feld mit
  // bis zu drei Zeichen; leer = ohne Emoji, "Standard" setzt zurück (null im Entwurf).
  _emojiHtml(d, kinds, changes) {
    const t = (k, ...a) => this._t(k, ...a);
    const defs = this._settings?.data?.emoji_defaults || {};
    const max = this._settings?.data?.emoji_max || 3;
    const rows = kinds
      .map((kind) => {
        const key = `emoji_${kind}`;
        const own = d[key] != null;
        const label = t(key);
        return `<div class="emo-row${changes.has(key) ? " changed" : ""}"><span class="emo-l">${escape(label)}</span>
          <span class="opt-input emo-in"><input type="text" data-emoji="${kind}" value="${escape(own ? d[key] : defs[kind] || "")}" placeholder="${escape(t("emojiNone"))}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="${escape(t("emojiLabel", label))}"></span>
          <button type="button" class="lnk emo-reset" data-set="emoji-reset" data-key="${kind}" ${own ? "" : "disabled"}>${escape(t("emojiReset"))}</button></div>`;
      })
      .join("");
    return `<div class="emo-box"><div class="opt-line"><span class="opt-label">${escape(t("emojiTitle"))}</span></div><div class="opt-short">${escape(t("emojiShort", max))}</div>${rows}</div>`;
  }

  // "Inhalt der Meldung" als Schalter in zwei Spalten, dazu die Vorschau
  // einer Ausfall-Meldung (Bild 5) mit einem Gerät aus der Liste.
  _notifyFieldsHtml(d, changes) {
    const t = (k, ...a) => this._t(k, ...a);
    const on = new Set(d.notify_fields || []);
    const labels = { area: "fieldArea", integration: "fieldIntegration", connection: "fieldConnection", since: "fieldSince", signal: "fieldSignal", battery: "fieldBattery", model: "fieldModel" };
    const grid = NOTIFY_FIELDS.map(
      (f) => `<label class="nf-item"><span>${escape(t(labels[f]))}</span><span class="switch"><input type="checkbox" data-nfield="${f}" ${on.has(f) ? "checked" : ""} aria-label="${escape(t(labels[f]))}"><span></span></span></label>`
    ).join("");
    // Beispiel: das ausgefallene Gerät mit den meisten Angaben (sonst irgendeines,
    // sonst erfunden), damit jeder Schalter in der Vorschau etwas bewirkt.
    // Fehlt dem Gerät eine Angabe, steht ein Beispielwert in Kursiv.
    const score = (x) => [x.area, x.battery?.level != null, x.signal?.value != null, x.connection !== undefined, x.manufacturer || x.model].filter(Boolean).length;
    const best = (list) => list.slice().sort((a, b) => score(b) - score(a))[0];
    const offline = this._devices.filter((x) => x.online === false);
    const dev = (offline.length && best(offline)) || best(this._devices) || { name: t("pvSample"), area: null };
    const since = dev.offline_since ? Date.parse(dev.offline_since) / 1000 : Date.now() / 1000 - 300;
    let invented = false;
    const sample = (value, example) => {
      if (value) return escape(value);
      invented = true;
      return `<i>${escape(example)}</i>`;
    };
    const parts = NOTIFY_FIELDS.filter((f) => on.has(f))
      .map((f) => {
        if (f === "area") return dev.area ? escape(dev.area) : null;
        if (f === "integration") return dev.integration ? escape(this._integName(dev)) : null;
        if (f === "connection") return sample(dev.connection !== undefined && dev.connection ? t(CONN[this._connOf(dev)].key) : "", t("pvSampleConn"));
        if (f === "since") return escape(t("pvSince", this._fmtTime(since)));
        if (f === "signal") return dev.signal?.value != null ? escape(t("pvSignal", sigText(dev.signal))) : t("pvSignal", sample("", t("pvSampleSignal")));
        if (f === "battery") return dev.battery?.level != null ? escape(t("pvBattery", `${dev.battery.level} %`)) : t("pvBattery", sample("", t("pvSampleBattery")));
        if (f === "model") return sample([dev.manufacturer, dev.model].filter(Boolean).join(" "), t("pvSampleModel"));
        return null;
      })
      .filter(Boolean);
    const preview = d.notify_outage
      ? `<div class="pv"><div class="pv-k">${escape(t("pvLabel"))}</div><div class="pv-card"><div class="pv-app">${LOGO_SMALL}${escape(t("pvApp"))}</div>
          <div class="pv-title">${this._pveHtml(d, "outage")}${escape(t("pvTitle", dev.name))}</div><div class="pv-text">${parts.join(" · ")}</div>
          <div class="pv-actions"><span>${escape(t("pvOpen"))}</span><span>${escape(t("pvMute"))}</span></div></div>
          <div class="opt-short">${escape(t("pvNote"))}${invented ? ` ${escape(t("pvExample"))}` : ""}</div></div>`
      : "";
    return `<div class="opt${changes.has("notify_fields") ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(t("optFields"))}</span></div>
      <div class="opt-short">${escape(t("optFieldsShort"))}</div><div class="nf-grid">${grid}</div>
      <div class="nf-note">${mdi("info", 16)}<div><p>${escape(t("optFieldsNote1"))}</p><p>${escape(t("optFieldsNote2"))}</p></div></div>${this._emojiHtml(d, ["outage", "group", "online"], changes)}${preview}</div>`;
  }

  // --- Überwachung und Meldungen (seit 0.34.0, docs/mockups/notify-v3) -----
  // Ein Abschnitt mit vier Reitern statt fünf Orten (Wunsch des Nutzers: auf
  // einen Blick sehen, wann welche Meldung kommt): Übersicht mit einem
  // Zeitstrahl je Meldung, Ausfall, Batterie, Integrationen (Liste, je
  // Integration alle Einstellungen mit eigenem Zeitstrahl).
  _monitorHtml(d, changes, errors, ui) {
    const st = this._settings;
    const t = (k, ...a) => this._t(k, ...a);
    const tab = MON_TAB_KEYS[st.tab] ? st.tab : "overview";
    const tabs = [["overview", "tabOverview"], ["outage", "tabOutage"], ["battery", "tabBattery"], ["charge", "tabCharge"], ["new", "tabNew"], ["updates", "tabUpdates"], ["sig", "tabSignal"], ["integ", "tabInteg"]]
      .map(([id, key]) => {
        const keys = MON_TAB_KEYS[id];
        // Punkt am Reiter: dort gibt es eine Änderung (blau) oder einen Fehler (rot).
        const mark = keys.some((k) => errors[k]) ? " err" : keys.some((k) => changes.has(k)) ? " chg" : "";
        return `<button type="button" role="tab" class="mon-tab${id === tab ? " on" : ""}${mark}" data-set="tab" data-key="${id}" aria-selected="${id === tab}">${escape(t(key))}</button>`;
      })
      .join("");
    const body =
      tab === "outage"
        ? this._monOutageHtml(d, changes, errors, ui)
        : tab === "battery"
          ? this._monBatteryHtml(d, changes, errors, ui)
          : tab === "charge"
            ? this._chargeHtml(d, changes, errors, ui)
          : tab === "new"
            ? this._monNewHtml(d, changes, errors, ui)
          : tab === "updates"
            ? this._monUpdatesHtml(d, changes, errors, ui)
          : tab === "sig"
            ? this._monSigHtml(d)
          : tab === "integ"
            ? this._monIntegHtml(d, changes, errors)
            : this._monOverviewHtml(d, errors, ui, changes);
    return `<div class="mon-tabs" role="tablist">${tabs}</div><div class="mon-body" role="tabpanel">${body}</div>`;
  }

  // --- Fenster "Alle Routinen" (seit 2.22.0): Glocke in der Kopfzeile, Vollbild, alle Routinen aller Geräte ---------------------------
  // Nur ansehen, bearbeiten und ein-/ausschalten; neue Routinen gibt es nur im Popup eines Geräts.
  _openRtAll() {
    const dlg = this.shadowRoot.querySelector("dialog.rtall-dlg");
    if (!dlg) return;
    this._rtAll = { dlg: true, routines: null, error: null, confirmId: null, flash: "", err: "", filter: "all", open: {}, sopen: {}, query: "" };
    this._renderRtAllFrame();
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    if (window.matchMedia?.(TOUCH_QUERY).matches) this.shadowRoot.activeElement?.blur();
    this._loadRtAll();
  }

  // Die Liste wurde ohne den Zwischenspeicher von setHtml verändert (Suche tippen, Ausklappen): beim nächsten vollen Neuzeichnen darf
  // dieser nicht "unverändert" melden, sonst bliebe die alte Liste stehen (Suche leeren zeigte nach dem Tippen die Trefferliste weiter)
  _rtAllStale(dlg) {
    const body = dlg.querySelector("[data-rta-body]");
    if (body) lastHtml.delete(body);
  }

  _closeRtAll() {
    const dlg = this.shadowRoot.querySelector("dialog.rtall-dlg");
    this._rtAll = null;
    if (dlg?.open) {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }
  }

  _renderRtAllFrame() {
    const dlg = this.shadowRoot.querySelector("dialog.rtall-dlg");
    const t = (k, ...a) => this._t(k, ...a);
    dlg.innerHTML = `<div class="dlg-head"><span class="dlg-avatar">${mdi("flash", 28)}</span>
        <div class="dlg-title"><h2>${escape(t("rtAllTitle"))}</h2><div class="dlg-sub">${escape(t("rtAllSub"))}</div></div>
        <button type="button" class="dlg-close" data-rta-close title="${escape(t("close"))}" aria-label="${escape(t("close"))}">${mdi("close", 18)}</button></div>
      <div class="dlg-body"><div class="rt-all-wrap" data-rta-body></div>
        <div class="dlg-addbar"><button type="button" class="mg-add" data-rta="routine-add">${mdi("plus", 18)}${escape(t("rtAdd"))}</button></div></div>`;
    this._renderRtAll();
  }

  _renderRtAll() {
    const all = this._rtAll;
    const body = this.shadowRoot.querySelector("dialog.rtall-dlg [data-rta-body]");
    if (!all || !body) return;
    // Beim Neuzeichnen die Suche behalten (Fokus und Cursor), sonst ginge die Eingabe verloren
    const focus = this.shadowRoot.activeElement?.matches?.("[data-lsearch]") ? this.shadowRoot.activeElement : null;
    const pos = focus ? [focus.selectionStart, focus.selectionEnd] : null;
    const scroll = body.closest(".dlg-body")?.scrollTop || 0;
    setHtml(body, this._routines.overviewHtml(all, this._devices));
    const sh = all.shown;
    const cnt = body.querySelector(".list-search .n");
    if (cnt && sh) cnt.textContent = sh.filtering ? this._t("listSearchOf", sh.n, sh.total) : "";
    const dlgBody = body.closest(".dlg-body");
    if (dlgBody) dlgBody.scrollTop = scroll;
    if (focus) {
      const input = body.querySelector("[data-lsearch]");
      input?.focus();
      if (input && pos) input.setSelectionRange(pos[0], pos[1]);
    }
  }

  async _loadRtAll() {
    const all = this._rtAll;
    if (!all) return;
    try {
      const r = await this._hass.callWS({ type: "device_panel/routine_list" });
      all.routines = r.routines;
      all.error = null;
      all.paused = Boolean(r.paused);
      this._routines._today = r.today;
      this._routines._offset = Number.isFinite(r.now) ? r.now * 1000 - Date.now() : 0;
    } catch (err) {
      all.error = errText(err);
    }
    if (this._rtAll === all) this._renderRtAll();
  }

  _bindRtAll(dlg) {
    this._trackBusy(dlg);
    dlg.addEventListener("click", async (ev) => {
      if (ev.target === dlg) {
        const r = dlg.getBoundingClientRect();
        if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) this._closeRtAll();
        return;
      }
      const all = this._rtAll;
      if (!all) return;
      if (ev.target.closest("[data-rta-close]")) {
        this._closeRtAll();
        return;
      }
      const clear = ev.target.closest("[data-rta-clear]");
      if (clear) {
        all.query = "";
        all.sopen = {};
        this._renderRtAll();
        // Hat das Feld den Fokus, behält das Neuzeichnen seinen Text: ausdrücklich leeren
        const field = dlg.querySelector("input[data-lsearch]");
        if (field) field.value = "";
        return;
      }
      const btn = ev.target.closest("button[data-rta]");
      if (!btn || btn.disabled) return;
      const action = btn.dataset.rta;
      const ui = this._routines;
      all.flash = "";
      all.err = "";
      if (action !== "routine-run") all.ran = null;
      if (action === "routine-reload") {
        all.error = null;
        this._loadRtAll();
      } else if (action === "routine-device") {
        this._openDevice(btn.dataset.device, "routine");
      } else if (action === "routine-filter") {
        all.filter = btn.dataset.v;
        all.sopen = {};
        this._renderRtAll();
      } else if (action === "routine-fold-dev" || action === "routine-fold-all") {
        if (action === "routine-fold-dev") ui.toggleFold(all, this._devices, btn.dataset.device);
        else ui.foldAll(all, this._devices);
        const zone = dlg.querySelector("[data-rt-all-zone]");
        if (zone) zone.innerHTML = ui.overviewListHtml(all, this._devices);
        this._rtAllStale(dlg);
      } else if (action === "routine-edit") {
        ui.open(btn.dataset.device, true);
        ui.editWhenLoaded(btn.dataset.id);
      } else if (action === "routine-add") {
        // Neue Routine: der Assistent mit dem Schritt "Gerät wählen" davor (seit 2.27.0)
        ui.startNewFromAll();
      } else if (action === "routine-run") {
        this._rtAllRun(btn.dataset.id);
      } else if (action === "routine-star") {
        this._toggleRtStar(btn.dataset.id);
        this._renderRtAll();
      } else if (action === "routine-delete" || action === "routine-delete-no") {
        // Löschen mit Rückfrage (seit 2.24.1): erst die Karte mit "Löschen?", dann erst weg
        all.confirmId = action === "routine-delete" ? btn.dataset.id : null;
        this._renderRtAll();
      } else if (action === "routine-delete-yes") {
        ui.ui.error = "";
        await ui.remove(btn.dataset.id);
        all.confirmId = null;
        if (ui.ui.error) all.err = ui.ui.error;
        else all.flash = this._t("rtDeleted");
        this._renderRtAll();
      }
    });
    dlg.addEventListener("change", (ev) => {
      const el = ev.target;
      if (el.matches?.('input[data-rta="routine-toggle"]')) this._rtAllToggle(el.dataset.id, el.checked);
      else if (el.matches?.('input[data-rta="routines-pause"]')) this._rtAllPause(el.checked);
    });
    dlg.addEventListener("input", (ev) => {
      const el = ev.target;
      const all = this._rtAll;
      if (!all || !el.matches?.("[data-lsearch]")) return;
      all.query = el.value;
      all.sopen = {};
      // Nur die Liste neu zeichnen, das Suchfeld behält Fokus und Cursor
      const zone = dlg.querySelector("[data-rt-all-zone]");
      if (zone) zone.innerHTML = this._routines.overviewListHtml(all, this._devices);
      this._rtAllStale(dlg);
      const cnt = dlg.querySelector(".list-search .n");
      if (cnt && all.shown) cnt.textContent = all.shown.filtering ? this._t("listSearchOf", all.shown.n, all.shown.total) : "";
      const x = dlg.querySelector("[data-rta-clear]");
      if (x) x.hidden = !el.value;
    });
    // "close" kommt verzögert: wurde das Fenster inzwischen neu geöffnet, gehört der Stand dem neuen Öffnen
    dlg.addEventListener("close", () => {
      if (!dlg.open) this._rtAll = null;
    });
  }

  // Ausführen aus dem Fenster mit allen Routinen (seit 2.74.0): wie im Popup sofort, ohne Rückfrage; der Zeitplan bleibt, wie er ist
  async _rtAllRun(id) {
    const all = this._rtAll;
    if (!all || all.busy) return;
    const t = (k, ...a) => this._t(k, ...a);
    all.busy = id;
    all.ran = null;
    this._renderRtAll();
    let ran;
    try {
      const r = await this._hass.callWS({ type: "device_panel/routine_run", routine_id: id });
      const i = all.routines.findIndex((x) => x.id === id);
      if (i >= 0) all.routines[i] = { ...all.routines[i], ...r.routine };
      this._routines.replaceRoutine(r.routine);
      ran = { id, ok: r.ok, text: r.ok ? t("rtRunDone") : t("rtRunFailed", t(`rtReason_${r.reason || "error"}`)) };
    } catch (err) {
      ran = { id, ok: false, text: t("rtRunFailed", errText(err)) };
    }
    all.busy = null;
    if (this._rtAll !== all) return;
    all.ran = ran;
    this._renderRtAll();
  }

  // "Alle Routinen pausieren" im Fenster (seit 2.79.0): speichert sofort die Option routines_pause, wie die Einstellung "Routinen"
  async _rtAllPause(paused) {
    const all = this._rtAll;
    if (!all || all.pauseBusy) return;
    all.pauseBusy = true;
    all.err = "";
    try {
      await this._hass.callWS({ type: "device_panel/set_options", values: { routines_pause: paused } });
      all.paused = paused;
    } catch (err) {
      all.err = this._t("rtToggleError", errText(err));
    }
    all.pauseBusy = false;
    if (this._rtAll === all) this._renderRtAll();
  }

  async _rtAllToggle(id, enabled) {
    const all = this._rtAll;
    if (!all) return;
    try {
      const r = await this._hass.callWS({ type: "device_panel/routine_enable", routine_id: id, enabled });
      const i = all.routines.findIndex((x) => x.id === id);
      if (i >= 0) all.routines[i] = { ...all.routines[i], ...r.routine };
      this._routines.replaceRoutine(r.routine);
    } catch (err) {
      all.err = this._t("rtToggleError", errText(err));
    }
    if (this._rtAll === all) this._renderRtAll();
  }

  // --- Fenster "Magic Push" (seit 2.75.0): eigene App wie Routinen, alle Meldungen aller Geräte, nach Gerät ------------------------
  // Vorher ein Reiter in den Einstellungen; die Meldungen gehören den Geräten und werden sofort gespeichert, es sind keine
  // Einstellungen. Nur ansehen, bearbeiten, ein-/ausschalten und löschen; neue Meldungen gibt es im Popup eines Geräts.
  _openMagicAll() {
    const dlg = this.shadowRoot.querySelector("dialog.mgall-dlg");
    if (!dlg) return;
    this._mgAll = { dlg: true, rules: null, error: null, confirmId: null, flash: "", err: "", filter: "all", open: {}, sopen: {}, query: "" };
    this._renderMagicAllFrame();
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    if (window.matchMedia?.(TOUCH_QUERY).matches) this.shadowRoot.activeElement?.blur();
    this._loadMagicAll();
  }

  // Die Liste wurde ohne den Zwischenspeicher von setHtml verändert (Suche tippen, Ausklappen): beim nächsten vollen Neuzeichnen
  // darf dieser nicht "unverändert" melden, sonst bliebe die alte Liste stehen
  _mgAllStale(dlg) {
    const body = dlg.querySelector("[data-mga-body]");
    if (body) lastHtml.delete(body);
  }

  _closeMagicAll() {
    const dlg = this.shadowRoot.querySelector("dialog.mgall-dlg");
    this._mgAll = null;
    if (dlg?.open) {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }
  }

  _renderMagicAllFrame() {
    const dlg = this.shadowRoot.querySelector("dialog.mgall-dlg");
    const t = (k, ...a) => this._t(k, ...a);
    dlg.innerHTML = `<div class="dlg-head"><span class="dlg-avatar">${mdi("bell", 28)}</span>
        <div class="dlg-title"><h2>${escape(t("mgAllTitle"))}</h2><div class="dlg-sub">${escape(t("mgAllSub"))}</div></div>
        <button type="button" class="dlg-close" data-mga-close title="${escape(t("close"))}" aria-label="${escape(t("close"))}">${mdi("close", 18)}</button></div>
      <div class="dlg-body"><div class="rt-all-wrap" data-mga-body></div>
        <div class="dlg-addbar"><button type="button" class="mg-add" data-mga="magic-add">${mdi("plus", 18)}${escape(t("mgAdd"))}</button></div></div>`;
    this._renderMagicAll();
  }

  _renderMagicAll() {
    const all = this._mgAll;
    const body = this.shadowRoot.querySelector("dialog.mgall-dlg [data-mga-body]");
    if (!all || !body) return;
    // Beim Neuzeichnen die Suche behalten (Fokus und Cursor), sonst ginge die Eingabe verloren
    const focus = this.shadowRoot.activeElement?.matches?.("[data-lsearch]") ? this.shadowRoot.activeElement : null;
    const pos = focus ? [focus.selectionStart, focus.selectionEnd] : null;
    const scroll = body.closest(".dlg-body")?.scrollTop || 0;
    setHtml(body, this._magic.overviewHtml(all, this._devices));
    const sh = all.shown;
    const cnt = body.querySelector(".list-search .n");
    if (cnt && sh) cnt.textContent = sh.filtering ? this._t("listSearchOf", sh.n, sh.total) : "";
    const dlgBody = body.closest(".dlg-body");
    if (dlgBody) dlgBody.scrollTop = scroll;
    if (focus) {
      const input = body.querySelector("[data-lsearch]");
      input?.focus();
      if (input && pos) input.setSelectionRange(pos[0], pos[1]);
    }
  }

  async _loadMagicAll() {
    const all = this._mgAll;
    if (!all) return;
    try {
      const r = await this._hass.callWS({ type: "device_panel/magic_list" });
      all.rules = r.rules;
      all.error = null;
    } catch (err) {
      all.error = errText(err);
    }
    if (this._mgAll === all) this._renderMagicAll();
  }

  _bindMagicAll(dlg) {
    this._trackBusy(dlg);
    dlg.addEventListener("click", (ev) => {
      if (ev.target === dlg) {
        const r = dlg.getBoundingClientRect();
        if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) this._closeMagicAll();
        return;
      }
      const all = this._mgAll;
      if (!all) return;
      if (ev.target.closest("[data-mga-close]")) {
        this._closeMagicAll();
        return;
      }
      const clear = ev.target.closest("[data-mga-clear]");
      if (clear) {
        all.query = "";
        all.sopen = {};
        this._renderMagicAll();
        // Hat das Feld den Fokus, behält das Neuzeichnen seinen Text: ausdrücklich leeren
        const field = dlg.querySelector("input[data-lsearch]");
        if (field) field.value = "";
        return;
      }
      const btn = ev.target.closest("button[data-mga]");
      if (!btn || btn.disabled) return;
      this._magicAllAction(btn.dataset.mga, btn);
    });
    dlg.addEventListener("change", (ev) => {
      const el = ev.target;
      if (el.matches?.('input[data-mga="magic-toggle"]')) this._magicAllAction("magic-toggle", el);
    });
    dlg.addEventListener("input", (ev) => {
      const el = ev.target;
      const all = this._mgAll;
      if (!all || !el.matches?.("[data-lsearch]")) return;
      all.query = el.value;
      all.sopen = {};
      // Nur die Liste neu zeichnen, das Suchfeld behält Fokus und Cursor
      const zone = dlg.querySelector("[data-mg-all-zone]");
      if (zone) zone.innerHTML = this._magic.overviewListHtml(all, this._devices);
      this._mgAllStale(dlg);
      const cnt = dlg.querySelector(".list-search .n");
      if (cnt && all.shown) cnt.textContent = all.shown.filtering ? this._t("listSearchOf", all.shown.n, all.shown.total) : "";
      const x = dlg.querySelector("[data-mga-clear]");
      if (x) x.hidden = !el.value;
    });
    // "close" kommt verzögert: wurde das Fenster inzwischen neu geöffnet, gehört der Stand dem neuen Öffnen
    dlg.addEventListener("close", () => {
      if (!dlg.open) this._mgAll = null;
    });
  }

  async _magicAllAction(action, btn) {
    const all = this._mgAll;
    if (!all) return;
    const dlg = this.shadowRoot.querySelector("dialog.mgall-dlg");
    const t = (k, ...a) => this._t(k, ...a);
    const id = btn.dataset.id;
    all.flash = "";
    all.err = "";
    if (action === "magic-reload") {
      all.error = null;
      this._loadMagicAll();
      return;
    }
    if (action === "magic-device") {
      this._openDevice(btn.dataset.device, "magic");
      return;
    }
    // Filter, Karte ein- oder ausklappen (seit 2.13.0): nur Anzeige, kein Server
    if (action === "magic-filter") {
      all.filter = btn.dataset.v;
      all.sopen = {};
      this._renderMagicAll();
      return;
    }
    if (action === "magic-fold-dev" || action === "magic-fold-all") {
      if (action === "magic-fold-dev") this._magic.toggleFold(all, this._devices, btn.dataset.device);
      else this._magic.foldAll(all, this._devices);
      const zone = dlg?.querySelector("[data-mg-all-zone]");
      if (zone) zone.innerHTML = this._magic.overviewListHtml(all, this._devices);
      if (dlg) this._mgAllStale(dlg);
      return;
    }
    if (action === "magic-add") {
      // Neue Meldung: der Assistent mit dem Schritt "Gerät" davor (seit 2.102.0), wie bei den Routinen
      this._magic.startNewFromAll();
      return;
    }
    if (action === "magic-edit") {
      // Seit 2.11.0 direkt das Fenster des Assistenten, ohne das Popup des Geräts dahinter
      this._magic.open(btn.dataset.device, true);
      this._magic.editWhenLoaded(id);
      return;
    }
    if (action === "magic-delete") all.confirmId = id;
    else if (action === "magic-delete-no") all.confirmId = null;
    else if (action === "magic-delete-yes") {
      try {
        await this._hass.callWS({ type: "device_panel/magic_delete", rule_id: id });
        all.rules = all.rules.filter((r) => r.id !== id);
        all.flash = t("mgDeleted");
      } catch (err) {
        all.err = t("mgListError", errText(err));
      }
      all.confirmId = null;
    } else if (action === "magic-toggle") {
      try {
        const r = await this._hass.callWS({ type: "device_panel/magic_enable", rule_id: id, enabled: btn.checked });
        const i = all.rules.findIndex((x) => x.id === id);
        if (i >= 0) all.rules[i] = { ...all.rules[i], ...r.rule };
      } catch (err) {
        all.err = t("mgListError", errText(err));
      }
    }
    if (this._mgAll === all) this._renderMagicAll();
  }

  // Zeitstrahl: Linie mit Marken in festen Abständen (nicht massstäblich). Eine Marke hat
  // Titel und Unterzeile oder ein Eingabefeld (html). Seit 2.0.2 endet die Linie bei 80 %
  // der Breite, genau an der letzten Marke (at: 80); darunter steht der Wert mittig am
  // Endpunkt. Die letzten 20 % bleiben frei, damit Felder und Texte nicht am Rand kleben
  // (docs/mockups/graphics-v1, Variante A).
  _tlHtml(marks, kind = "") {
    return `<div class="mtl${kind ? ` ${kind}` : ""}"><div class="mtl-bar"></div>${marks
      .map(
        (m) =>
          `<div class="mtl-mk${m.cls ? ` ${m.cls}` : ""}" style="left:${m.at}%"><i></i><b>${escape(m.title)}</b>${m.html || (m.sub ? `<span>${escape(m.sub)}</span>` : "")}</div>`
      )
      .join("")}</div>`;
  }

  // Zeitstrahl der Ausfall-Meldung als zwei parallele Balken ab demselben Nullpunkt
  // (seit 1.20.0, Wunsch des Nutzers): "Ausgefallen nach" und Push zählen beide ab
  // Beginn des Ausfalls und werden nicht addiert. Die Länge folgt dem Wert (mindestens
  // ein Fünftel, damit Beschriftung und Ende sichtbar bleiben). Seit 2.0.2 endet der
  // längste Balken wie die Linien bei 80 % der Breite (Stil in styles.js), Wert und
  // Beschreibung stehen unter dem Ring am Endpunkt. Zeile: title, sub oder html
  // (Eingabefeld), w (Länge in %), cls, ghost (gestrichelte Marke, Länge in %).
  _ptlHtml(rows, edit = false, zero = "tlGone") {
    const t = (k, ...a) => this._t(k, ...a);
    return `<div class="mtl ptl${edit ? " ptl-e" : ""}"><div class="ptl-zero"><b>0</b><span>${escape(t(zero))}</span></div>${rows
      .map(
        (r) =>
          `<div class="ptl-row${r.cls ? ` ${r.cls}` : ""}" style="--w:${r.w}%"${r.key ? ` data-ptl="${r.key}"` : ""}><div class="ptl-track"><i></i>${
            r.ghost != null ? `<em style="left:calc(${r.ghost}% * .8 - 6px)"></em>` : ""
          }<div class="mtl-mk ptl-txt"><b>${escape(r.title)}</b>${r.html || (r.sub ? `<span>${escape(r.sub)}</span>` : "")}</div></div></div>`
      )
      .join("")}</div>`;
  }

  // Länge eines Balkens in Prozent im Verhältnis zum längsten (mindestens 22).
  _ptlWidth(value, max) {
    return Number.isInteger(value) && max > 0 ? Math.max(22, Math.min(100, Math.round((value / max) * 100))) : 60;
  }

  // Balken einer Ausfall-Meldung: im Panel ausgefallen und Push. Der Push kommt nie
  // vor "Ausgefallen nach"; ohne Push steht statt des Balkens der Grund.
  _outageRows(offline, delay, push, reason, ghost = null) {
    const t = (k, ...a) => this._t(k, ...a);
    const fmt = (m) => t("offlineMin", m);
    const at = Math.max(delay, offline);
    const max = Math.max(offline, push ? at : 0, ghost || 0);
    const rows = [{ title: fmt(offline), sub: t("tlOffline"), w: this._ptlWidth(offline, max) }];
    if (push) rows.push({ cls: "mk-p", title: fmt(at), sub: t("tlPush"), w: this._ptlWidth(at, max), ghost: ghost != null ? this._ptlWidth(ghost, max) : null });
    else rows.push({ cls: "mk-off", title: t("tlNoPush"), sub: reason, w: 100 });
    return rows;
  }

  // "Erst melden nach" kürzer als "Ausgefallen nach" (Fehler an beiden Feldern).
  _delayShort(errors) {
    const d = this._settings?.draft;
    return Boolean(d) && !errors.offline_after && Number.isInteger(d.offline_after) && Number.isInteger(d.notify_delay) && d.notify_delay < d.offline_after;
  }

  // Integrationen für den Reiter "Integrationen": gezeigte aus dem Katalog,
  // dazu solche mit eigener Einstellung ohne Geräte (zum Zurücksetzen). Je
  // Integration, was vom Standard abweicht, als kurze Texte.
  _integItems(d) {
    const st = this._settings;
    const t = (k, ...a) => this._t(k, ...a);
    const cat = st.data?.catalog || {};
    const hidden = new Set(d.exclude_integrations || []);
    const bat = new Map((cat.battery || []).map((b) => [b.domain, b.devices]));
    const offMap = d.offline_after_integrations || {};
    const delayMap = d.notify_delay_integrations || {};
    const batMap = d.battery_low_integrations || {};
    const noPush = new Set(d.notify_exclude_integrations || []);
    const noPers = new Set(d.persistent_exclude_integrations || []);
    const noBatPush = new Set(d.battery_push_exclude_integrations || []);
    const sigMap = d.signal_low_integrations || {};
    const noNew = new Set(d.new_exclude_integrations || []);
    const chargeOn = new Set(d.charge_integrations || []);
    const list = (cat.integrations || []).filter((i) => !hidden.has(i.domain)).map((i) => ({ domain: i.domain, name: i.name, devices: i.devices }));
    const known = new Set(list.map((x) => x.domain));
    for (const dom of [...Object.keys(offMap), ...Object.keys(delayMap), ...Object.keys(batMap), ...Object.keys(sigMap), ...noPush, ...noPers, ...noBatPush, ...noNew, ...chargeOn, ...Object.keys(d.charge_full_integrations || {}), ...Object.keys(d.charge_rise_integrations || {}), ...Object.keys(d.charge_stall_integrations || {}), ...Object.keys(d.charge_stop_integrations || {}), ...Object.keys(d.charge_live_integrations || {})]) {
      if (known.has(dom) || hidden.has(dom)) continue;
      known.add(dom);
      list.push({ domain: dom, name: this._integrations[dom] || dom, devices: 0 });
    }
    return list.map((x) => {
      const off = offMap[x.domain];
      const b = batMap[x.domain];
      const unmon = off === "off";
      const flags = [noPush.has(x.domain) && t("diffNoPush"), noPers.has(x.domain) && t("diffNoPers")].filter(Boolean);
      const dl = delayMap[x.domain];
      const out = [Number.isInteger(off) || flags.length ? t("diffOutage", Number.isInteger(off) ? t("offlineMin", off) : null, flags) : "", Number.isInteger(dl) ? t("diffDelay", t("offlineMin", dl)) : ""].filter(Boolean).join(", ") || null;
      const batText = b !== undefined || noBatPush.has(x.domain) ? t("diffBattery", Number.isInteger(b) ? b : null, b === "off", noBatPush.has(x.domain)) : null;
      const sigCount = Object.keys(sigMap[x.domain] || {}).length;
      const sigDiff = sigCount ? t("diffSignal", sigCount) : null;
      const newDiff = noNew.has(x.domain) ? t("diffNoNew") : null;
      const cf = (d.charge_full_integrations || {})[x.domain];
      const cr = (d.charge_rise_integrations || {})[x.domain];
      const cs = (d.charge_stall_integrations || {})[x.domain];
      const cp = (d.charge_stop_integrations || {})[x.domain];
      const cl = (d.charge_live_integrations || {})[x.domain];
      const chargeVals = [cf != null ? t("diffChargeFull", cf) : "", cr != null ? t("diffChargeRise", cr) : "", cs != null ? t("diffChargeStall", cs) : "", cp != null ? t("diffChargeStop", cp) : "", cl != null ? t("diffChargeLive", cl) : ""].filter(Boolean);
      const chargeDiff = chargeOn.has(x.domain) ? t("diffCharge") + (chargeVals.length ? ` (${chargeVals.join(", ")})` : "") : cl != null ? t("diffChargeLive", cl) : null;
      const diff = unmon ? t("integUnmon") : [out, batText, chargeDiff, newDiff, sigDiff].filter(Boolean).join(" · ");
      return { ...x, batDevices: bat.get(x.domain) || 0, unmon, out, bat: batText, chg: chargeDiff, noNew: noNew.has(x.domain), sig: sigDiff, own: Boolean(unmon || out || batText || chargeDiff || newDiff || sigDiff), diff };
    });
  }

  // Kasten "N Integrationen weichen ab" mit Sprung in den Reiter "Integrationen".
  _integDiffBox(d, kind) {
    const t = (k, ...a) => this._t(k, ...a);
    const items = this._integItems(d).filter((x) => (kind === "out" ? x.unmon || x.out : kind === "new" ? x.noNew : kind === "charge" ? x.chg : kind === "sig" ? x.sig : x.bat));
    const text = items.map((x) => `${x.name}: ${kind === "out" ? (x.unmon ? t("integUnmon") : x.out) : kind === "new" ? t("diffNoNew") : kind === "charge" ? x.chg : kind === "sig" ? x.sig : x.bat}`).join(" · ");
    return `<div class="opt mon-diff"><div class="opt-line"><span class="opt-label">${escape(t("diffIntegTitle", items.length))}</span><button type="button" class="lnk" data-set="goto" data-key="integ" data-filter="${items.length ? "own" : "all"}">${escape(t("diffIntegGo"))}</button></div>
      <div class="opt-short">${escape(items.length ? text : t("diffIntegNone"))}</div></div>`;
  }

  // Gibt es für die Meldungen dieses Reiters (outage, battery, charge, new, updates) ein Ziel: das eigene, sonst das globale (seit 2.18.0)
  _hasTarget(d, topic) {
    const target = d[`notify_service_${topic}`] || d.notify_service;
    return Boolean(target && target !== "none");
  }

  _monOverviewHtml(d, errors, ui, changes) {
    const t = (k, ...a) => this._t(k, ...a);
    const tg = (topic) => this._hasTarget(d, topic);
    // Ohne Ziel kommt kein Push: Warnung, sobald ein Reiter mit eingeschaltetem Push weder ein eigenes noch das globale Ziel hat
    const warn = [["outage", d.notify_outage || d.notify_online], ["battery", d.battery_push], ["new", d.notify_new], ["charge", d.notify_charge], ["updates", d.notify_updates]].some(([topic, on]) => on && !tg(topic)) ? t("noTargetWarn") : null;
    return (
      `<div class="mon-grp">${escape(t("grpTarget"))}</div>` +
      ui.row("notify_service", t("optNotifyTarget"), ui.select("notify_service", ui.targets, t("optNotifyTarget")), t("optNotifyTargetShort"), t("optNotifyTargetInfo"), warn) +
      ui.row("notify_click_target", t("optClick"), ui.select("notify_click_target", [["panel", t("clickPanel")], ["device", t("clickDevice")]], t("optClick")), t("optClickShort"), null) +
      `<div class="mon-grp">${escape(t("grpQuiet"))}</div>` +
      this._monQuietHtml(d, changes, errors, ui)
    );
  }

  // Zahlenfeld im Zeitstrahl (beim Tippen nur _updateSettingsMeta, kein Neuaufbau).
  _tlInput(d, key, unit, label, bad, changed) {
    const [min, max] = this._settings.data.limits?.[key] || [];
    return `<span class="opt-input mtl-in${bad ? " bad" : ""}${changed ? " chg" : ""}"><input type="number" inputmode="numeric" step="1" ${min != null ? `min="${min}" max="${max}"` : ""} data-opt="${key}" value="${escape(d[key] ?? "")}" aria-label="${escape(label)}"><span class="unit">${escape(unit)}</span></span>`;
  }

  // Kleine Übersicht je Reiter (seit 2.96.0): Karte mit Kapitel, Zeitstrahl und Pillen zum schnellen Umschalten
  // (früher im Reiter "Übersicht", jetzt "Allgemein"); der Zeitstrahl und die Hinweise stehen in `inner`.
  _laneCard(tab, icon, cls, titleKey, inner, chips) {
    const t = (k, ...a) => this._t(k, ...a);
    return `<div class="lane" data-lane="${tab}"><div class="lane-head"><span class="lane-ic ${cls}">${mdi(icon, 16)}</span><span class="lane-t">${escape(t(titleKey))}</span></div>${inner}<div class="lane-chips">${chips}</div></div>`;
  }

  _laneChip(d, key, label) {
    return `<button type="button" class="mon-chip${d[key] ? " on" : ""}" data-set="chip" data-key="${key}" aria-pressed="${Boolean(d[key])}">${d[key] ? mdi("check", 14) : ""}${escape(label)}</button>`;
  }

  _monOutageHtml(d, changes, errors, ui) {
    const t = (k, ...a) => this._t(k, ...a);
    const short = this._delayShort(errors);
    const target = this._hasTarget(d, "outage");
    const oa = d.offline_after;
    const nd = d.notify_delay;
    const max = Math.max(Number.isInteger(oa) ? oa : 0, Number.isInteger(nd) ? nd : 0);
    const tl = this._ptlHtml(
      [
        { key: "offline_after", title: t("optOfflineAfter"), html: this._tlInput(d, "offline_after", t("minuteUnit"), t("optOfflineAfter"), errors.offline_after || short, changes.has("offline_after")), w: this._ptlWidth(oa, max) },
        { key: "notify_delay", cls: "mk-p", title: t("optDelay"), html: this._tlInput(d, "notify_delay", t("minuteUnit"), t("optDelay"), errors.notify_delay, changes.has("notify_delay")), w: this._ptlWidth(nd, max) },
      ],
      true
    );
    const err = errors.offline_after || errors.notify_delay;
    const lane = `${tl}<div class="opt-error mtl-err" data-tl-error="offline_after,notify_delay" ${err ? "" : "hidden"}>${escape(err || "")}</div>
      <div class="opt-short mtl-note">${escape(t("tlNote"))}${ui.infoBtn("offline_after")}</div>
      ${this._settings.info.has("offline_after") ? `<div class="opt-info">${escape(t("optOfflineAfterInfo"))}</div>` : ""}`;
    return `${this._laneCard("outage", "pulse", "out", "laneOutage", lane, this._laneChip(d, "notify_outage", t("chipPush")) + this._laneChip(d, "outage_persistent", t("chipPersistent")) + this._laneChip(d, "notify_online", t("chipOnline")) + this._laneChip(d, "notify_group", t("chipGroup")))}
      <div class="mon-grp">${escape(t("grpDetect"))}</div>
      ${ui.row("flaky_outages", t("optFlaky"), ui.num("flaky_outages", t("unitOutages"), t("optFlaky")), t("optFlakyShort"), t("optFlakyInfo"))}
      ${ui.row("startup_grace", t("optGrace"), ui.num("startup_grace", t("minuteUnit"), t("optGrace")), t("optGraceShort"), t("optGraceInfo"))}
      <div class="mon-grp">${escape(t("grpNotify"))}</div>
      ${ui.targetRow("outage")}
      ${ui.row("notify_outage", t("optOutage"), ui.sw("notify_outage", t("optOutage")), target || !d.notify_outage ? t("optOutageShort") : null, null, target || !d.notify_outage ? null : t("noTargetWarn"))}
      ${ui.row("notify_online", t("optOnline"), ui.sw("notify_online", t("optOnline")), t("optOnlineShort"), null)}
      ${ui.row("notify_group", t("optGroup"), ui.sw("notify_group", t("optGroup")), t("optGroupShort"), null)}
      ${d.notify_group ? ui.row("notify_group_min", t("optGroupMin"), ui.num("notify_group_min", t("unitDevices"), t("optGroupMin")), t("optGroupMinShort"), null) : ""}
      ${ui.row("outage_persistent", t("optPersistent"), ui.sw("outage_persistent", t("optPersistent")), t("optOutagePersistentShort"), null)}
      ${this._notifyFieldsHtml(d, changes)}
      <div class="mon-grp">${escape(t("grpDiff"))}</div>
      ${this._integDiffBox(d, "out")}${this._overridesHtml("offline")}${this._overridesHtml("notify_delay")}${this._overridesHtml("notify")}`;
  }

  _monBatteryHtml(d, changes, errors, ui) {
    const t = (k, ...a) => this._t(k, ...a);
    const target = this._hasTarget(d, "battery");
    const daily = d.battery_push_mode === "daily";
    const time = errors.battery_push_time ? this._settings.data.values.battery_push_time : d.battery_push_time;
    const push =
      d.battery_push && target
        ? { at: 80, cls: "mk-p", title: daily ? t("tlDaily", time) : t("tlInstant"), sub: daily ? t(d.battery_push_daily === "all" ? "tlDailyAll" : "tlDailyNew") : t("tlInstantSub") }
        : { at: 80, cls: "mk-off", title: t("tlNoPush"), sub: target ? t("tlSwitchedOff") : t("tlNoTarget") };
    const tl = this._tlHtml(
      [{ at: 18, title: t("optBatteryLow"), html: this._tlInput(d, "battery_low", t("unitPercent"), t("optBatteryLow"), errors.battery_low, changes.has("battery_low")) }, push],
      "mtl-b mtl-e"
    );
    const noTarget = d.battery_push && !target;
    const lane = `${tl}<div class="opt-error mtl-err" data-tl-error="battery_low" ${errors.battery_low ? "" : "hidden"}>${escape(errors.battery_low || "")}</div>
      <div class="opt-short mtl-note">${escape(t("tlBatNote"))}</div>`;
    return `${this._laneCard("battery", "battery", "bat", "laneBattery", lane, this._laneChip(d, "battery_push", t("chipPush")) + this._laneChip(d, "battery_persistent", t("chipPersistent")))}
      <div class="mon-grp">${escape(t("grpNotify"))}</div>
      ${ui.targetRow("battery")}
      ${ui.row("battery_push", t("optBatteryPush"), ui.sw("battery_push", t("optBatteryPush")), noTarget ? null : t("optBatteryPushShort"), t("optBatteryPushInfo"), noTarget ? t("noTargetWarn") : null)}
      ${
        d.battery_push
          ? ui.row(
              "battery_push_mode",
              t("optPushMode"),
              `<span class="opt-pair">${ui.select("battery_push_mode", [["instant", t("pushModeInstant")], ["daily", t("pushModeDaily")]], t("optPushMode"))}${
                daily
                  ? `<span class="opt-input${errors.battery_push_time ? " bad" : ""}"><input type="time" data-opt="battery_push_time" value="${escape(d.battery_push_time || "")}" aria-label="${escape(t("pushModeDaily"))}"></span>`
                  : ""
              }</span>`,
              daily ? t("optPushModeShortDaily", d.battery_push_time || "–") : t("optPushModeShortInstant"),
              null,
              null,
              ["battery_push_time"]
            ) + (daily ? ui.row("battery_push_daily", t("optPushDaily"), ui.select("battery_push_daily", [["new", t("dailyNew")], ["all", t("dailyAll")]], t("optPushDaily")), t("optPushDailyShort"), null) : "")
          : ""
      }
      ${ui.row("battery_persistent", t("optPersistent"), ui.sw("battery_persistent", t("optPersistent")), t("optBatteryPersistentShort"), t("optBatteryPersistentInfo"))}
      ${this._batteryFieldsHtml(d, changes)}
      <div class="mon-grp">${escape(t("grpDiffBat", t("optBatteryLow")))}</div>
      ${this._integDiffBox(d, "bat")}${this._overridesHtml("battery")}`;
  }

  // Reiter "Laden" (seit 1.30.0, docs/mockups/charging-v1; Unterreiter von "Batterie" bis 1.41.0, seit 1.42.0
  // ein Reiter wie "Ausfall" und "Batterie", damit Einstellungen, Integration und Gerät gleich aufgebaut sind): Push, sobald ein Gerät voll geladen ist. Aus; einschalten pro Integration (hier) oder pro Gerät (Popup).
  _chargeHtml(d, changes, errors, ui) {
    const st = this._settings;
    const t = (k, ...a) => this._t(k, ...a);
    const target = this._hasTarget(d, "charge");
    const noTarget = d.notify_charge && !target;
    const push = target && d.notify_charge;
    // Stufen 100, 95, 90, 80 oder "Eigener Wert" mit Zahlenfeld (seit 1.38.0).
    const fullMode = CHARGE_FULL_PRESETS.includes(d.charge_full) ? String(d.charge_full) : "own";
    const fullSel = `<span class="opt-select${changes.has("charge_full") ? " chg" : ""}"><select data-cfull aria-label="${escape(t("optChargeFull"))}">${[...CHARGE_FULL_PRESETS.map((v) => [String(v), `${v} %`]), ["own", t("chargeFullOwn")]].map(([v, label]) => `<option value="${v}"${v === fullMode ? " selected" : ""}>${escape(label)}</option>`).join("")}</select>${mdi("chevronDown", 18)}</span>${
      fullMode === "own" ? this._tlInput(d, "charge_full", t("unitPercent"), t("optChargeFull"), errors.charge_full, changes.has("charge_full")) : ""
    }`;
    // Zeitstrahl wie bei der Warnung (seit 1.35.0): Anstieg erkennt das Laden, "Voll ab" löst den Push aus;
    // beide Werte stehen im Zeitstrahl.
    const tl = this._tlHtml(
      [
        { at: 18, title: t("tlChargeRiseEdit"), html: this._tlInput(d, "charge_rise", t("unitPercent"), t("optChargeRise"), errors.charge_rise, changes.has("charge_rise")) },
        { at: 80, cls: push ? "mk-p" : "mk-off", title: t("optChargeFull"), html: `${fullSel}<span>${escape(push ? t("tlChargeFullSub") : t(target ? "tlSwitchedOff" : "tlNoTarget"))}</span>` },
      ],
      "mtl-b mtl-e"
    );
    const lane = `${tl}<div class="opt-error mtl-err" data-tl-error="charge_rise,charge_full" ${errors.charge_rise || errors.charge_full ? "" : "hidden"}>${escape(errors.charge_rise || errors.charge_full || "")}</div>
      <div class="opt-short mtl-note">${escape(t("optChargeRiseShort"))} ${escape(t("optChargeFullShort"))}</div>`;
    let html = `${this._laneCard("charge", "batteryCharging", "chg", "laneCharge", lane, this._laneChip(d, "notify_charge", t("chipPush")))}
      <div class="mon-grp">${escape(t("grpNotify"))}</div>
      ${ui.targetRow("charge")}
      ${ui.row("notify_charge", t("optCharge"), ui.sw("notify_charge", t("optCharge")), noTarget ? null : t("optChargeShort"), null, noTarget ? t("noTargetWarn") : null)}`;
    // Live-Aktivität beim Laden (seit 2.19.0): unabhängig von der Lademeldung; pro Integration und Gerät einstellbar
    const liveNoTarget = d.charge_live && !target;
    html += `<div class="mon-grp">${escape(t("grpLive"))}</div>
      ${ui.row("charge_live", t("optChargeLive"), ui.sw("charge_live", t("optChargeLive")), liveNoTarget ? null : t("optChargeLiveShort"), t("optChargeLiveInfo"), liveNoTarget ? t("noTargetWarn") : null)}`;
    // Abweichungen am Schluss (seit 2.78.0, wie bei den anderen Reitern): Integrationen und Geräte mit eigenen Werten
    const diffHtml = `<div class="mon-grp">${escape(t("grpDiff"))}</div>${this._integDiffBox(d, "charge")}${this._overridesHtml("charge")}`;
    if (!d.notify_charge) return html + diffHtml;
    // Ladung beendet (seit 1.40.0): bleibt der Stand ohne Ladeanzeige am Gerät so lange unverändert, endet "lädt";
    // der Push dazu hat einen eigenen Schalter (standardmässig aus).
    html += ui.row("charge_stall", t("optChargeStall"), ui.num("charge_stall", t("minuteUnit"), t("optChargeStall")), t("optChargeStallShort"), null) +
      ui.row("notify_charge_stop", t("optChargeStop"), ui.sw("notify_charge_stop", t("optChargeStop")), noTarget ? null : t("optChargeStopShort"), null);
    // Integrationen mit Batteriegeräten (Katalog), dazu bereits eingeschaltete ohne Geräte.
    const on = new Set(d.charge_integrations || []);
    const saved = new Set(st.data.values.charge_integrations || []);
    const items = (st.data.catalog?.battery || []).map((x) => ({ domain: x.domain, name: x.name, devices: x.devices }));
    for (const dom of [...on, ...saved]) if (!items.some((x) => x.domain === dom)) items.push({ domain: dom, name: this._integrations[dom] || dom, devices: 0 });
    const rows = items
      .map((x) => `<div class="ex-row${on.has(x.domain) !== saved.has(x.domain) ? " changed" : ""}">${this._ibadge(x.domain, x.name)}<div class="ex-name">${escape(x.name)}<small>${escape(t("chargeIntegSub", x.devices))}</small></div>
        <label class="switch"><input type="checkbox" data-cinteg="${escape(x.domain)}" ${on.has(x.domain) ? "checked" : ""} aria-label="${escape(`${t("optCharge")}: ${x.name}`)}"><span></span></label></div>`)
      .join("");
    // Die lange Liste steht ganz unten (Wunsch des Nutzers, seit 2.5.0): Emoji und Vorschau davor,
    // damit man nicht an der Liste vorbeiscrollen muss.
    const integList = `<div class="mon-grp">${escape(t("chargeIntegTitle"))}</div><div class="opt-short">${escape(t("chargeIntegHint"))}</div>${this._searchHtml("charge", items.length)}
      <div class="srch-rows" data-srch="charge">${rows}<div class="srch-none opt-short" hidden>${escape(t("listSearchNone"))}</div></div>`;
    // Vorschau an einem Gerät mit Batterie (Beispielwerte kursiv, wie bei den anderen Meldungen)
    const dev = this._devices.find((x) => x.battery?.level != null) || null;
    const name = dev ? dev.name : t("pvSample");
    const area = dev?.area ? escape(dev.area) : `<i>${escape(t("pvSampleArea"))}</i>`;
    html += this._emojiHtml(d, ["charge", "charge_stop"], changes);
    html += `<div class="pv"><div class="pv-k">${escape(t("pvLabel"))}</div><div class="pv-card"><div class="pv-app">${LOGO_SMALL}${escape(t("pvApp"))}</div>
      <div class="pv-title">${this._pveHtml(d, "charge")}${escape(t("pvChargeTitle", name))}</div><div class="pv-text">${escape(`${d.charge_full ?? 100} %`)} · ${escape(t("pvChargeFrom", this._fmtSeconds(6000), 22))} · ${area}</div></div>
      <div class="opt-short">${escape(t("pvChargeNote"))}</div></div>`;
    return html + integList + diffHtml;
  }

  // Inhalt der Batterie-Meldung (seit 0.34.0, notify-v2 Bild 4: anpassbar wie
  // die Ausfall-Meldung), mit Vorschau am schwächsten Gerät mit Batterie.
  _batteryFieldsHtml(d, changes) {
    const t = (k, ...a) => this._t(k, ...a);
    const on = new Set(d.battery_fields || []);
    const labels = { battery: "bfBattery", area: "fieldArea", integration: "fieldIntegration", model: "fieldModel" };
    const grid = BATTERY_FIELDS.map(
      (f) => `<label class="nf-item"><span>${escape(t(labels[f]))}</span><span class="switch"><input type="checkbox" data-bfield="${f}" ${on.has(f) ? "checked" : ""} aria-label="${escape(t(labels[f]))}"><span></span></span></label>`
    ).join("");
    const withBat = this._devices.filter((x) => x.battery?.level != null);
    // Schwach zuerst, dann mit den meisten Angaben, dann der tiefste Stand.
    const score = (x) => (x.battery.low ? 4 : 0) + (x.area ? 1 : 0) + (x.manufacturer || x.model ? 1 : 0);
    const dev = withBat.slice().sort((a, b) => score(b) - score(a) || a.battery.level - b.battery.level)[0] || null;
    let invented = false;
    const sample = (value, example) => {
      if (value) return escape(value);
      invented = true;
      return `<i>${escape(example)}</i>`;
    };
    const level = () => sample(dev ? `${dev.battery.level} %` : "", t("pvSampleBattery"));
    const parts = BATTERY_FIELDS.filter((f) => on.has(f)).map((f) =>
      f === "battery"
        ? level()
        : f === "area"
          ? sample(dev?.area || "", t("pvSampleArea"))
          : f === "integration"
            ? sample(dev?.integration ? this._integName(dev) : "", t("pvSampleInteg"))
            : sample([dev?.manufacturer, dev?.model].filter(Boolean).join(" "), t("pvSampleModel"))
    );
    // Nichts gewählt: das Backend schickt den Stand.
    const text = parts.length ? parts.join(" · ") : level();
    const preview = d.battery_push
      ? `<div class="pv"><div class="pv-k">${escape(t("pvLabel"))}</div><div class="pv-card"><div class="pv-app">${LOGO_SMALL}${escape(t("pvApp"))}</div>
          <div class="pv-title">${this._pveHtml(d, "battery")}${escape(t("pvBatTitle", dev ? dev.name : t("pvSample")))}</div><div class="pv-text">${text}</div></div>
          <div class="opt-short">${escape(t("pvBatNote"))}${invented ? ` ${escape(t("pvExample"))}` : ""}</div></div>`
      : "";
    return `<div class="opt${changes.has("battery_fields") ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(t("optBatFields"))}</span></div>
      <div class="opt-short">${escape(t("optBatFieldsShort"))}</div><div class="nf-grid">${grid}</div>${this._emojiHtml(d, ["battery"], changes)}${preview}</div>`;
  }

  // Balken der Meldung bei neuen Geräten (seit 1.24.0): vom Fund bis zur Meldung nach dem
  // Sammelfenster; ohne Push steht der Grund.
  _newRows(window, push, reason) {
    const t = (k, ...a) => this._t(k, ...a);
    return push ? [{ cls: "mk-p", title: t("offlineMin", window), sub: t("tlNewPush"), w: 100 }] : [{ cls: "mk-off", title: t("tlNoPush"), sub: reason, w: 100 }];
  }

  // Reiter "Neu" (seit 1.24.0): Push bei neuen Geräten nach dem Muster von Ausfall und
  // Batterie: Zeitstrahl mit Sammelfenster, Meldung, Inhalt mit Vorschau, Abweichungen.
  _monNewHtml(d, changes, errors, ui) {
    const t = (k, ...a) => this._t(k, ...a);
    const target = this._hasTarget(d, "new");
    const noTarget = d.notify_new && !target;
    const tl = this._ptlHtml(
      [{ cls: "mk-p", title: t("optNewWindow"), html: this._tlInput(d, "new_window", t("minuteUnit"), t("optNewWindow"), errors.new_window, changes.has("new_window")), w: 100 }],
      true,
      "tlFound"
    );
    const lane = `${tl}<div class="opt-error mtl-err" data-tl-error="new_window" ${errors.new_window ? "" : "hidden"}>${escape(errors.new_window || "")}</div>
      <div class="opt-short mtl-note">${escape(t("tlNewNote"))}</div>`;
    return `${this._laneCard("new", "sparkle", "new", "laneNew", lane, this._laneChip(d, "notify_new", t("chipPush")) + this._laneChip(d, "new_persistent", t("chipPersistent")))}
      <div class="mon-grp">${escape(t("grpNotify"))}</div>
      ${ui.targetRow("new")}
      ${ui.row("notify_new", t("optNewNotify"), ui.sw("notify_new", t("optNewNotify")), noTarget ? null : t("optNewNotifyShort"), null, noTarget ? t("noTargetWarn") : null)}
      ${ui.row("new_persistent", t("optPersistent"), ui.sw("new_persistent", t("optPersistent")), t("optNewPersistentShort"), null)}
      ${this._newFieldsHtml(d, changes)}
      <div class="mon-grp">${escape(t("grpDiff"))}</div>
      ${this._integDiffBox(d, "new")}`;
  }

  // Reiter "Updates" (seit 1.29.0, docs/mockups/charging-v1): Update-Erinnerung per Push, ersetzt
  // Automationen mit Zähler und Hilfsentität. Das Panel hört auf die update-Entitäten von HA.
  _normalizeUpdateItems(draft) {
    const kind = new Map((this._settings.data?.catalog?.updates || []).map((u) => [u.id, u.kind]));
    const kinds = new Set(draft.updates_kinds || []);
    draft.updates_exclude = (draft.updates_exclude || []).filter((id) => !kind.has(id) || kinds.has(kind.get(id)));
    draft.updates_include = (draft.updates_include || []).filter((id) => !kind.has(id) || !kinds.has(kind.get(id)));
  }

  // Reiter "Ruhezeit" (seit 2.95.0): ein globales Fenster je Wochentag; Meldungen der gewählten Arten
  // werden gehalten und danach als Zusammenfassung oder einzeln gesendet (Backend: quiet.py).
  _monQuietHtml(d, changes, errors, ui) {
    const t = (k, ...a) => this._t(k, ...a);
    const on = Boolean(d.quiet_enabled);
    let html = ui.row("quiet_enabled", t("optQuiet"), ui.sw("quiet_enabled", t("optQuiet")), t("optQuietShort"), null);
    if (!on) return html;
    const days = Array.isArray(d.quiet_days) && d.quiet_days.length === 7 ? d.quiet_days : Array.from({ length: 7 }, () => ({ ...QUIET_DAY_DEFAULT }));
    const dayRows = days
      .map((x, i) => {
        const name = t(`qDay${i}`);
        const bad = errors.quiet_days && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(x.from || "")) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(x.to || "")));
        const time = (field, label) => `<span class="opt-input${bad ? " bad" : ""}"><input type="time" data-qday="${i}" data-qfield="${field}" value="${escape(x[field] || "")}"${x.on ? "" : " disabled"} aria-label="${escape(`${name}: ${label}`)}"></span>`;
        return `<div class="qd-row${x.on ? "" : " off"}"><span class="qd-name">${escape(name)}</span>
          <label class="switch"><input type="checkbox" data-qday-on="${i}" ${x.on ? "checked" : ""} aria-label="${escape(t("quietDayOn", name))}"><span></span></label>
          <span class="qd-times">${time("from", t("quietFrom"))}<span class="qd-sep">${escape(t("quietTo"))}</span>${time("to", t("quietTo"))}</span></div>`;
      })
      .join("");
    html += `<div class="opt${changes.has("quiet_days") ? " changed" : ""}${errors.quiet_days ? " invalid" : ""}"><div class="opt-line"><span class="opt-label">${escape(t("optQuietDays"))}</span>
      <button type="button" class="lnk" data-set="quiet-all">${escape(t("quietAllDays"))}</button></div>
      <div class="${errors.quiet_days ? "opt-error" : "opt-short"}">${escape(errors.quiet_days || t("optQuietDaysShort"))}</div>
      <div class="qd-list">${dayRows}</div></div>`;
    html += ui.row("quiet_mode", t("optQuietMode"), ui.select("quiet_mode", [["summary", t("quietModeSummary")], ["single", t("quietModeSingle")]], t("optQuietMode")), t(d.quiet_mode === "single" ? "optQuietModeShortSingle" : "optQuietModeShortSummary"), null);
    const topics = new Set(d.quiet_topics || []);
    const grid = QUIET_TOPICS.map(
      (k) => `<label class="nf-item"><span>${escape(t(`qTopic_${k}`))}</span><span class="switch"><input type="checkbox" data-qtopic="${k}" ${topics.has(k) ? "checked" : ""} aria-label="${escape(t(`qTopic_${k}`))}"><span></span></span></label>`
    ).join("");
    html += `<div class="opt${changes.has("quiet_topics") ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(t("optQuietTopics"))}</span></div>
      <div class="opt-short">${escape(t("optQuietTopicsShort"))}</div><div class="nf-grid">${grid}</div>
      <div class="nf-note">${mdi("info", 16)}<div><p>${escape(t("quietCriticalNote"))}</p></div></div></div>`;
    return html;
  }

  _monUpdatesHtml(d, changes, errors, ui) {
    const t = (k, ...a) => this._t(k, ...a);
    const target = this._hasTarget(d, "updates");
    const noTarget = d.notify_updates && !target;
    const mode = d.updates_mode || "daily";
    const time = d.updates_time || "";
    const modeSel = ui.select("updates_mode", [["instant", t("updModeInstant")], ["daily", t("updModeDaily")], ["weekly", t("updModeWeekly")]], t("optUpdMode"));
    const timeIn = `<span class="opt-input${errors.updates_time ? " bad" : ""}"><input type="time" data-opt="updates_time" value="${escape(time)}" aria-label="${escape(t("optUpdMode"))}"></span>`;
    const kinds = new Set(d.updates_kinds || []);
    const kindRows = UPDATE_KINDS.map((k) =>
      ui.row("updates_kinds", t(`updKind_${k}`), `<label class="switch"><input type="checkbox" data-ukind="${k}" ${kinds.has(k) ? "checked" : ""} aria-label="${escape(t(`updKind_${k}`))}"><span></span></label>`, t(`updKindShort_${k}`), null)
    ).join("");
    // Liste aller update-Entitäten (seit 1.31.0): jeder Eintrag folgt seiner Art, bis er hier
    // umgeschaltet wird (Ausnahme pro Eintrag, `updates_exclude` / `updates_include`).
    const st = this._settings;
    const items = st.data?.catalog?.updates || [];
    const wanted = (v, x) => (v.updates_exclude || []).includes(x.id) ? false : (v.updates_include || []).includes(x.id) ? true : (v.updates_kinds || []).includes(x.kind);
    const saved = st.data.values;
    const rows = items
      .map((x) => {
        const on = wanted(d, x);
        const ver = x.available && x.installed && x.latest ? t("updItemOpen", x.installed, x.latest) : x.installed ? t("updItemVersion", x.installed) : "";
        const own = (d.updates_exclude || []).includes(x.id) || (d.updates_include || []).includes(x.id);
        return `<div class="ex-row${on !== wanted(saved, x) ? " changed" : ""}">${this._ibadge(x.platform || x.kind, x.name)}<div class="ex-name">${escape(x.name)}${x.available ? `<span class="upd-dot" title="${escape(t("updItemOpenTip"))}"></span>` : ""}<small>${escape([t(`updKind_${x.kind}`), ver].filter(Boolean).join(" · "))}${own ? ` · ${escape(t("updItemOwn"))}` : ""}</small></div>
          <label class="switch"><input type="checkbox" data-uitem="${escape(x.id)}" ${on ? "checked" : ""} aria-label="${escape(`${t("optUpdNotify")}: ${x.name}`)}"><span></span></label></div>`;
      })
      .join("");
    const list = items.length
      ? `<div class="mon-grp">${escape(t("grpUpdItems"))}</div><div class="opt-short">${escape(t("updItemsHint"))}</div>${this._searchHtml("updates", items.length)}
        <div class="srch-rows" data-srch="updates">${rows}<div class="srch-none opt-short" hidden>${escape(t("listSearchNone"))}</div></div>`
      : `<div class="mon-grp">${escape(t("grpUpdItems"))}</div><div class="opt-short">${escape(t("updItemsNone"))}</div>`;
    // Vorschau: die jetzt offenen Updates, die gemeldet würden; ohne offene Beispiele.
    const open = items.filter((x) => x.available && wanted(d, x));
    const sample = { core: "Home Assistant Core 2026.10.2 → 2026.10.3", addons: "Mosquitto broker 6.5.0 → 6.5.1", hacs: "Device Panel 1.27.0 → 1.28.0", devices: "Shelly Plug 1.0.0 → 1.1.0" };
    const real = items.some((x) => x.available);
    const lines = real
      ? open.map((x) => `• ${escape(x.installed && x.latest ? `${x.name} ${x.installed} → ${x.latest}` : x.name)}`)
      : UPDATE_KINDS.filter((k) => kinds.has(k)).map((k) => `• ${escape(sample[k])}`);
    const preview = d.notify_updates
      ? `<div class="pv"><div class="pv-k">${escape(t("pvLabel"))}</div><div class="pv-card"><div class="pv-app">${LOGO_SMALL}${escape(t("pvApp"))}</div>
          <div class="pv-title">${this._pveHtml(d, "updates")}${escape(t("pvUpdTitle"))}</div><div class="pv-text">${lines.length ? `${escape(t("pvUpdCount", lines.length))}<br>${lines.join("<br>")}` : escape(t("pvUpdNone"))}</div></div>
          <div class="opt-short">${escape(t("pvUpdNote"))} ${escape(real ? t("pvUpdReal") : t("pvExample2"))}</div></div>`
      : "";
    // Zeitstrahl wie früher in der Übersicht: offene Updates, dann die Meldung (Zeitpunkt oder Sammelfenster)
    const val = (k) => (errors[k] ? this._settings.data.values[k] : d[k]);
    const updPush =
      target && d.notify_updates
        ? mode === "instant"
          ? { at: 80, cls: "mk-p", title: t("tlUpdWindow", val("updates_window")), sub: t("tlUpdWindowSub") }
          : { at: 80, cls: "mk-p", title: mode === "weekly" ? t("tlWeekly", val("updates_time") || "") : t("tlDaily", val("updates_time") || ""), sub: t("tlUpdAllSub") }
        : { at: 80, cls: "mk-off", title: t("tlNoPush"), sub: t(target ? "tlSwitchedOff" : "tlNoTarget") };
    const updTl = this._tlHtml([{ at: 14, title: t("tlUpdOpen"), sub: t("tlUpdOpenSub") }, updPush], "mtl-b");
    const lane = `${updTl}<div class="opt-short mtl-note">${escape(t("updNote"))}</div>`;
    return `${this._laneCard("updates", "update", "upd", "laneUpdates", lane, this._laneChip(d, "notify_updates", t("chipPush")))}
      <div class="mon-grp">${escape(t("grpNotify"))}</div>
      ${ui.targetRow("updates")}
      ${ui.row("notify_updates", t("optUpdNotify"), ui.sw("notify_updates", t("optUpdNotify")), noTarget ? null : t("optUpdNotifyShort"), null, noTarget ? t("noTargetWarn") : null)}
      ${
        d.notify_updates
          ? ui.row("updates_mode", t("optUpdMode"), `<span class="opt-pair">${modeSel}${mode === "instant" ? "" : timeIn}</span>`, t(mode === "instant" ? "optUpdModeShortInstant" : mode === "daily" ? "optUpdModeShortDaily" : "optUpdModeShortWeekly", time || "–"), null, null, ["updates_time"]) +
            (mode === "instant" ? ui.row("updates_window", t("optUpdWindow"), ui.num("updates_window", t("minuteUnit"), t("optUpdWindow")), t("optUpdWindowShort"), null) : "") +
            ui.row("updates_repeat", t("optUpdRepeat"), ui.select("updates_repeat", [["never", t("updRepeatNever")], ["3d", t("updRepeat3d")], ["7d", t("updRepeat7d")]], t("optUpdRepeat")), t("optUpdRepeatShort"), null)
          : ""
      }
      <div class="mon-grp">${escape(t("grpUpdKinds"))}</div>
      ${kindRows}
      ${this._emojiHtml(d, ["updates"], changes)}
      ${preview}
      ${list}`;
  }

  // Inhalt der Meldung bei neuen Geräten mit Vorschau an einem Gerät aus der Liste
  // (das zuletzt hinzugekommene, sonst das mit den meisten Angaben).
  _newFieldsHtml(d, changes) {
    const t = (k, ...a) => this._t(k, ...a);
    const on = new Set(d.new_fields || []);
    const labels = { area: "fieldArea", integration: "fieldIntegration", connection: "fieldConnection", model: "fieldModel" };
    const grid = NEW_FIELDS.map(
      (f) => `<label class="nf-item"><span>${escape(t(labels[f]))}</span><span class="switch"><input type="checkbox" data-newfield="${f}" ${on.has(f) ? "checked" : ""} aria-label="${escape(t(labels[f]))}"><span></span></span></label>`
    ).join("");
    const score = (x) => (x.new ? 10 : 0) + (x.area ? 1 : 0) + (x.integration ? 1 : 0) + (x.manufacturer || x.model ? 1 : 0);
    const newest = (x) => (x.created_at ? Date.parse(x.created_at) || 0 : 0);
    const dev = this._devices.slice().sort((a, b) => score(b) - score(a) || newest(b) - newest(a))[0] || null;
    let invented = false;
    const sample = (value, example) => {
      if (value) return escape(value);
      invented = true;
      return `<i>${escape(example)}</i>`;
    };
    const parts = NEW_FIELDS.filter((f) => on.has(f)).map((f) =>
      f === "area"
        ? sample(dev?.area || "", t("pvSampleArea"))
        : f === "integration"
          ? sample(dev?.integration ? this._integName(dev) : "", t("pvSampleInteg"))
          : f === "connection"
            ? sample(dev ? t(CONN[this._connOf(dev)].key) : "", t("pvSampleConn"))
            : sample([dev?.manufacturer, dev?.model].filter(Boolean).join(" "), t("pvSampleModel"))
    );
    // Nichts gewählt: das Backend schreibt "neu gefunden".
    const text = parts.length ? parts.join(" · ") : escape(t("pvNewFound"));
    const preview = d.notify_new
      ? `<div class="pv"><div class="pv-k">${escape(t("pvLabel"))}</div><div class="pv-card"><div class="pv-app">${LOGO_SMALL}${escape(t("pvApp"))}</div>
          <div class="pv-title">${this._pveHtml(d, "new")}${escape(t("pvNewTitle", dev ? dev.name : t("pvSample")))}</div><div class="pv-text">${text}</div></div>
          <div class="opt-short">${escape(t("pvNewNote"))}${invented ? ` ${escape(t("pvExample"))}` : ""}</div></div>`
      : "";
    return `<div class="opt${changes.has("new_fields") ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(t("optNewFields"))}</span></div>
      <div class="opt-short">${escape(t("optNewFieldsShort"))}</div><div class="nf-grid">${grid}</div>${this._emojiHtml(d, ["new"], changes)}${preview}</div>`;
  }

  _monIntegHtml(d, changes, errors) {
    const st = this._settings;
    const t = (k, ...a) => this._t(k, ...a);
    if (st.integ) return this._integDetailHtml(d, st.integ, errors);
    const items = this._integItems(d);
    const savedItems = new Map(this._integItems(st.data.values).map((x) => [x.domain, x.diff]));
    const own = items.filter((x) => x.own);
    const shown = st.integFilter === "own" ? own : items;
    const chip = (key, label) =>
      `<button type="button" class="mon-chip${st.integFilter === key || (key === "all" && st.integFilter !== "own") ? " on" : ""}" data-set="ifilter" data-key="${key}" aria-pressed="${st.integFilter === key || (key === "all" && st.integFilter !== "own")}">${escape(label)}</button>`;
    const rows = shown
      .map((x) => {
        const changed = savedItems.get(x.domain) !== x.diff;
        return `<button type="button" class="ilist-row${changed ? " changed" : ""}" data-set="integ" data-key="${escape(x.domain)}">${this._ibadge(x.domain, x.name)}
          <span class="ilist-name">${escape(x.name)}<small>${escape(t("integDevs", x.devices, x.batDevices))}</small><small class="ilist-diff${x.unmon ? " unmon" : x.own ? " own" : ""}">${escape(x.own ? x.diff : t("integStandard"))}</small></span>${mdi("chevron", 18)}</button>`;
      })
      .join("");
    // Alle Abweichungen der Integrationen auf einmal zurück auf den Standard
    // (beim Speichern), wie "Alle zurücksetzen" bei den Geräten. Auch die
    // von ausgeblendeten Integrationen, die die Liste nicht zeigt.
    const anyOwn = INTEG_OWN_MAPS.some((k) => Object.keys(d[k] || {}).length) || INTEG_OWN_LISTS.some((k) => (d[k] || []).length);
    return `<div class="opt-short mon-intro">${escape(t("integListIntro"))}</div>
      <div class="mon-flt">${chip("all", t("filterAll", items.length))}${chip("own", t("filterOwn", own.length))}<button type="button" class="ovr-all integ-all" data-set="integ-reset-all" ${anyOwn ? "" : "disabled"}>${mdi("reset", 15)}${escape(t("ovrResetAll"))}</button></div>
      ${shown.length ? this._searchHtml("integ", shown.length) + `<div class="ilist srch-rows" data-srch="integ">${rows}<div class="srch-none opt-short" hidden>${escape(t("listSearchNone"))}</div></div>` : `<div class="opt-short mon-empty">${escape(t(items.length ? "integNoneOwn" : "integNoneList"))}</div>`}`;
  }

  // Alle Einstellungen einer Integration (notify-v3, Bild 3): Zeitstrahl mit
  // den für sie wirksamen Zeiten, Ausfall, Batterie, ihre Geräte mit eigener
  // Einstellung. Etikett "Standard" oder "Eigene" wie im Geräte-Popup.
  _integDetailHtml(d, dom, errors) {
    const st = this._settings;
    const t = (k, ...a) => this._t(k, ...a);
    const item = this._integItems(d).find((x) => x.domain === dom) || { domain: dom, name: this._integrations[dom] || dom, devices: 0, batDevices: 0 };
    const saved = st.data.values;
    const offMap = d.offline_after_integrations || {};
    const batMap = d.battery_low_integrations || {};
    const delayOwn = (d.notify_delay_integrations || {})[dom];
    const off = offMap[dom];
    const unmon = off === "off";
    const val = (k) => (errors[k] ? saved[k] : d[k]);
    const gOff = val("offline_after");
    const gDelay = val("notify_delay");
    const eff = Number.isInteger(off) ? off : gOff;
    // "Erst melden nach" der Integration (seit 2.91.0): eigene Zeit oder die globale
    const dEff = Number.isInteger(delayOwn) ? delayOwn : gDelay;
    const tgt = (topic) => this._hasTarget(d, topic);
    const has = (key) => (d[key] || []).includes(dom);
    const pushOn = tgt("outage") && d.notify_outage && !has("notify_exclude_integrations");
    const fmt = (m) => t("offlineMin", m);
    const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    const origin = (own, would) =>
      `<div class="opt-origin"><span class="origin ${own ? "own" : "std"}">${escape(t(own ? "originOwn" : "originStandard"))}</span>${own && would ? `<span>${escape(t("originDefaultWould", would))}</span>` : ""}</div>`;
    const swi = (attrs, checked, label) =>
      `<label class="switch"><input type="checkbox" ${attrs} ${checked ? "checked" : ""} ${unmon ? "disabled" : ""} aria-label="${escape(label)}"><span></span></label>`;
    const opt = (changed, label, control, originHtml, extra = "", cls = "") =>
      `<div class="opt${cls}${changed ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(label)}</span>${control}</div>${extra}${originHtml}</div>`;
    const listSw = (key, label) =>
      opt(has(key) !== (saved[key] || []).includes(dom), label, swi(`data-list="${key}" data-value="${escape(dom)}"`, !has(key), `${label}: ${item.name}`), origin(has(key)));
    let tl;
    if (unmon) tl = `<div class="nf-note">${mdi("info", 16)}<div><p>${escape(t("integUnmonInfo"))}</p></div></div>`;
    else {
      const reason = tgt("outage") ? t("tlSwitchedOff") : t("tlNoTarget");
      const later = pushOn && dEff < eff;
      const rows = this._outageRows(eff, dEff, pushOn, has("notify_exclude_integrations") && tgt("outage") && d.notify_outage ? t("tlIntegOff") : reason, later ? dEff : null);
      tl = this._ptlHtml(rows) + (later ? `<div class="opt-short mtl-note">${escape(t("integPushLater", fmt(eff)))}</div>` : "");
    }
    // Ausgefallen nach: Standard oder feste Zeiten; "Nicht überwachen" ist der Schalter darüber.
    const mins = [...OFFLINE_PRESETS];
    if (Number.isInteger(off) && !mins.includes(off)) mins.push(off);
    mins.sort((a, b) => a - b);
    const offOpts = [["default", t("integOffDefault", fmt(gOff))], ...mins.map((m) => [String(m), fmt(m)])]
      .map(([v, l]) => `<option value="${v}"${v === (Number.isInteger(off) ? String(off) : "default") ? " selected" : ""}>${escape(l)}</option>`)
      .join("");
    // Erst melden nach: Standard oder feste Zeiten, gleiche Auswahl wie bei "Ausgefallen nach"
    const dMins = [...OFFLINE_PRESETS];
    if (Number.isInteger(delayOwn) && !dMins.includes(delayOwn)) dMins.push(delayOwn);
    dMins.sort((a, b) => a - b);
    const delayOpts = [["default", t("integOffDefault", fmt(gDelay))], ...dMins.map((m) => [String(m), fmt(m)])]
      .map(([v, l]) => `<option value="${v}"${v === (Number.isInteger(delayOwn) ? String(delayOwn) : "default") ? " selected" : ""}>${escape(l)}</option>`)
      .join("");
    const delaySel = `<span class="opt-select"><select data-delay-mode="${escape(dom)}" ${unmon ? "disabled" : ""} aria-label="${escape(`${t("optDelay")}: ${item.name}`)}">${delayOpts}</select>${mdi("chevronDown", 18)}</span>`;
    const delayErr = Number.isInteger(delayOwn) && Number.isInteger(eff) && delayOwn < eff ? t("integDelayError", fmt(eff)) : "";
    const offSel = `<span class="opt-select"><select data-off-mode="${escape(dom)}" ${unmon ? "disabled" : ""} aria-label="${escape(`${t("optOfflineAfter")}: ${item.name}`)}">${offOpts}</select>${mdi("chevronDown", 18)}</span>`;
    // Gleiche Reiter wie in den Einstellungen und im Geräte-Popup (seit 1.42.0): Ausfall | Batterie | Laden | Neu | Empfang | Geräte,
    // je Reiter die Grafik wie im globalen Reiter (hier mit den für die Integration wirksamen Werten).
    const wrap = (h) => `<div class="${unmon ? "mon-dis" : ""}">${h}</div>`;
    const empty = (key) => `<div class="opt-short mon-empty">${escape(t(key))}</div>`;
    const reasonOf = (excluded, topic) => (excluded ? t("tlIntegOff") : tgt(topic) ? t("tlSwitchedOff") : t("tlNoTarget"));
    // Ausfall
    const outHtml =
      tl +
      opt(!same(unmon, (saved.offline_after_integrations || {})[dom] === "off"), t("optMonitor"),
        `<label class="switch"><input type="checkbox" data-imon="${escape(dom)}" ${unmon ? "" : "checked"} aria-label="${escape(`${t("optMonitor")}: ${item.name}`)}"><span></span></label>`,
        origin(unmon), unmon ? "" : `<div class="opt-short">${escape(t("optMonitorShort"))}</div>`) +
      wrap(
        opt(!same(Number.isInteger(off) ? off : null, Number.isInteger((saved.offline_after_integrations || {})[dom]) ? saved.offline_after_integrations[dom] : null), t("optOfflineAfter"), offSel, origin(Number.isInteger(off), fmt(gOff))) +
          opt(
            !same(Number.isInteger(delayOwn) ? delayOwn : null, Number.isInteger((saved.notify_delay_integrations || {})[dom]) ? saved.notify_delay_integrations[dom] : null),
            t("optDelay"),
            delaySel,
            origin(Number.isInteger(delayOwn), fmt(gDelay)),
            delayErr ? `<div class="opt-error">${escape(delayErr)}</div>` : `<div class="opt-short">${escape(t("integDelayShort"))}</div>`,
            delayErr ? " invalid" : ""
          ) +
          listSw("notify_exclude_integrations", t("optPushOutage")) +
          (tgt("outage") && d.notify_outage ? "" : `<div class="opt-short mon-hint">${escape(t(tgt("outage") ? "integPushGlobalOff" : "noTargetWarn"))}</div>`) +
          listSw("persistent_exclude_integrations", t("optPersistent"))
      );
    // Batterie und Laden: nur sinnvoll mit Batteriegeräten oder eigener Einstellung (zum Zurücksetzen).
    const chargeMaps = ["charge_full_integrations", "charge_rise_integrations", "charge_stall_integrations", "charge_stop_integrations", "charge_live_integrations"];
    const hasBat = Boolean(item.batDevices || dom in batMap || has("battery_push_exclude_integrations") || has("charge_integrations") || chargeMaps.some((k) => dom in (d[k] || {})));
    const b = batMap[dom];
    const mode = b === "off" ? "off" : b === undefined ? "default" : "own";
    const std = val("battery_low");
    let batHtml = empty("integNoBattery");
    let chgHtml = empty("integNoBattery");
    if (hasBat) {
      const [min, max] = st.data.limits?.battery_low || [1, 50];
      const bad = this._batInvalid().includes(dom);
      const batSel = `<span class="bat-ctl"><span class="opt-select"><select data-bat-mode="${escape(dom)}" ${unmon ? "disabled" : ""} aria-label="${escape(`${t("optBatteryLow")}: ${item.name}`)}">${[
        ["default", t("integBatDefault", std)],
        ["own", t("originOwn")],
        ["off", t("devBatOff")],
      ]
        .map(([v, l]) => `<option value="${v}"${v === mode ? " selected" : ""}>${escape(l)}</option>`)
        .join("")}</select>${mdi("chevronDown", 18)}</span>${
        mode === "own"
          ? `<span class="opt-input${bad ? " bad" : ""}"><input type="number" inputmode="numeric" step="1" min="${min}" max="${max}" data-bat="${escape(dom)}" value="${escape(b ?? "")}" placeholder="${escape(std)}" aria-label="${escape(`${item.name}: ${t("optBatteryLow")}`)}"><span class="unit">%</span></span>`
          : ""
      }</span>`;
      // Grafik wie im globalen Reiter: Schwelle (der Integration oder global) und Push
      const batPushOn = tgt("battery") && d.battery_push && !has("battery_push_exclude_integrations");
      const daily = d.battery_push_mode === "daily";
      const lowMark = mode === "off" ? { at: 14, cls: "mk-off", title: t("devBatOff"), sub: "" } : { at: 14, title: t("tlLow", mode === "own" ? b : std), sub: t("tlRed") };
      const batTl = this._tlHtml(
        [
          lowMark,
          batPushOn && mode !== "off"
            ? { at: 80, cls: "mk-p", title: daily ? t("tlDaily", val("battery_push_time")) : t("tlInstant"), sub: daily ? t(d.battery_push_daily === "all" ? "tlDailyAll" : "tlDailyNew") : t("tlInstantSub") }
            : { at: 80, cls: "mk-off", title: t("tlNoPush"), sub: mode === "off" ? t("devBatOff") : reasonOf(has("battery_push_exclude_integrations") && tgt("battery") && d.battery_push, "battery") },
        ],
        "mtl-b"
      );
      batHtml =
        batTl +
        wrap(
          opt(!same(b, (saved.battery_low_integrations || {})[dom]), t("optBatteryLow"), batSel, origin(mode !== "default", `${std} %`),
            `<div class="opt-error" data-bat-error ${errors.battery_low_integrations && bad ? "" : "hidden"}>${escape(bad ? errors.battery_low_integrations || "" : "")}</div>`, " bat-row") +
            listSw("battery_push_exclude_integrations", t("optBatPush")) +
            (tgt("battery") && d.battery_push ? "" : `<div class="opt-short mon-hint">${escape(t(tgt("battery") ? "integBatPushGlobalOff" : "noTargetWarn"))}</div>`)
        );
      // Laden (seit 1.32.0): derselbe Wert wie die Liste im Reiter "Laden"; Standard ist aus.
      const chargeOn = has("charge_integrations");
      // Live-Aktivität beim Laden (seit 2.19.0): Standard (global), Ein, Aus; unabhängig von der Lademeldung
      const liveOwn = (d.charge_live_integrations || {})[dom];
      const liveOn = liveOwn ?? Boolean(val("charge_live"));
      const liveSel = `<span class="opt-select"><select data-clive-integ="${escape(dom)}" ${unmon ? "disabled" : ""} aria-label="${escape(`${t("optChargeLive")}: ${item.name}`)}"><option value="default"${liveOwn == null ? " selected" : ""}>${escape(t("integChargeLiveDefault", Boolean(val("charge_live"))))}</option><option value="on"${liveOwn === true ? " selected" : ""}>${escape(t("devChargeOn"))}</option><option value="off"${liveOwn === false ? " selected" : ""}>${escape(t("devChargeOff"))}</option></select>${mdi("chevronDown", 18)}</span>`;
      const liveRow = opt((liveOwn ?? null) !== ((saved.charge_live_integrations || {})[dom] ?? null), t("optChargeLive"), liveSel, origin(liveOwn != null, liveOwn != null ? t(liveOwn ? "devChargeOn" : "devChargeOff") : ""));
      const gFull = val("charge_full");
      const gRise = val("charge_rise");
      const fullMap = d.charge_full_integrations || {};
      const riseMap = d.charge_rise_integrations || {};
      const savedFull = saved.charge_full_integrations || {};
      const savedRise = saved.charge_rise_integrations || {};
      const chargeTl = this._tlHtml(
        [
          { at: 14, title: t("tlChargeRise", riseMap[dom] ?? gRise), sub: t("tlChargeRiseSub") },
          tgt("charge") && d.notify_charge && chargeOn
            ? { at: 80, cls: "mk-p", title: t("tlChargeFull", fullMap[dom] ?? gFull), sub: t("tlChargeFullSub") }
            : { at: 80, cls: "mk-off", title: t("tlNoPush"), sub: !chargeOn ? t("tlSwitchedOff") : tgt("charge") ? t("tlSwitchedOff") : t("tlNoTarget") },
        ],
        "mtl-b"
      );
      chgHtml =
        chargeTl +
        wrap(
          opt(chargeOn !== (saved.charge_integrations || []).includes(dom), t("optCharge"),
            swi(`data-cinteg="${escape(dom)}"`, chargeOn, `${t("optCharge")}: ${item.name}`),
            origin(chargeOn, t("devChargeOff").toLowerCase())) +
            (tgt("charge") && d.notify_charge ? "" : `<div class="opt-short mon-hint">${escape(t(tgt("charge") ? "integChargeGlobalOff" : "noTargetWarn"))}</div>`) +
            liveRow
        );
      // Eigenes "Voll ab" und eigener Anstieg der Integration (seit 1.35.0): ohne Wahl gilt der globale Wert, das Gerät geht vor.
      if (chargeOn || liveOn) {
        const choices = (presets, own) => [...new Set([...presets, own].filter((v) => Number.isInteger(v)))].sort((a, b) => a - b);
        const chargeSel = (attr, own, g, values, label, ownOption = false) => {
          const custom = ownOption && own != null && !values.includes(own);
          return `<span class="opt-select"><select ${attr}="${escape(dom)}" ${unmon ? "disabled" : ""} aria-label="${escape(`${label}: ${item.name}`)}"><option value="default"${own == null ? " selected" : ""}>${escape(t("integChargeDefault", g))}</option>${values
            .map((v) => `<option value="${v}"${v === own ? " selected" : ""}>${v} %</option>`)
            .join("")}${ownOption ? `<option value="own"${custom ? " selected" : ""}>${escape(t("chargeFullOwn"))}</option>` : ""}</select>${mdi("chevronDown", 18)}</span>`;
        };
        // Eigener Wert von "Voll ab" (seit 1.38.0): Zahlenfeld unter der Auswahl.
        const fullOwn = (own) => {
          if (own == null || CHARGE_FULL_PRESETS.includes(own)) return "";
          const bad = this._integFullErr?.dom === dom ? this._integFullErr : null;
          return `<div class="opt-line opt-sub"><span class="opt-label">${escape(t("optChargeFull"))}</span><span class="opt-input${bad ? " bad" : ""}"><input type="number" inputmode="numeric" step="1" min="${CHARGE_FULL_RANGE[0]}" max="${CHARGE_FULL_RANGE[1]}" data-cfull-integ-val="${escape(dom)}" ${unmon ? "disabled" : ""} value="${escape(bad ? bad.value : own)}" aria-label="${escape(`${t("optChargeFull")}: ${item.name}`)}"><span class="unit">${escape(t("unitPercent"))}</span></span></div>${bad ? `<div class="opt-error">${escape(bad.message)}</div>` : ""}`;
        };
        // "Ladung beendet nach" und Push bei beendeter Ladung pro Integration (seit 1.41.0): ohne Wahl gilt der globale Wert, das Gerät geht vor.
        const gStall = val("charge_stall");
        const stallMap = d.charge_stall_integrations || {};
        const stopMap = d.charge_stop_integrations || {};
        const stallSel = `<span class="opt-select"><select data-cstall-integ="${escape(dom)}" ${unmon ? "disabled" : ""} aria-label="${escape(`${t("optChargeStall")}: ${item.name}`)}"><option value="default"${stallMap[dom] == null ? " selected" : ""}>${escape(t("integChargeStallDefault", gStall))}</option>${choices([5, 10, 15, 20, 30, 45, 60, 90, 120], stallMap[dom])
          .map((v) => `<option value="${v}"${v === stallMap[dom] ? " selected" : ""}>${escape(t("offlineMin", v))}</option>`)
          .join("")}</select>${mdi("chevronDown", 18)}</span>`;
        const stopOwn = stopMap[dom];
        const stopSel = `<span class="opt-select"><select data-cstop-integ="${escape(dom)}" ${unmon ? "disabled" : ""} aria-label="${escape(`${t("optChargeStop")}: ${item.name}`)}"><option value="default"${stopOwn == null ? " selected" : ""}>${escape(t("integChargeStopDefault", Boolean(val("notify_charge_stop"))))}</option><option value="on"${stopOwn === true ? " selected" : ""}>${escape(t("devChargeOn"))}</option><option value="off"${stopOwn === false ? " selected" : ""}>${escape(t("devChargeOff"))}</option></select>${mdi("chevronDown", 18)}</span>`;
        chgHtml +=
          wrap(
            opt((fullMap[dom] ?? null) !== (savedFull[dom] ?? null), t("optChargeFull"), chargeSel("data-cfull-integ", fullMap[dom], gFull, CHARGE_FULL_PRESETS, t("optChargeFull"), true), origin(fullMap[dom] != null, fullMap[dom] != null ? `${gFull} %` : ""), fullOwn(fullMap[dom])) +
              opt((riseMap[dom] ?? null) !== (savedRise[dom] ?? null), t("optChargeRise"), chargeSel("data-crise-integ", riseMap[dom], gRise, choices([2, 3, 5, 10, 15, 20, 25, 30, 40, 50, 60, 80], riseMap[dom]), t("optChargeRise")), origin(riseMap[dom] != null, riseMap[dom] != null ? `${gRise} %` : "")) +
              opt((stallMap[dom] ?? null) !== ((saved.charge_stall_integrations || {})[dom] ?? null), t("optChargeStall"), stallSel, origin(stallMap[dom] != null, stallMap[dom] != null ? t("offlineMin", gStall) : "")) +
              (chargeOn ? opt((stopMap[dom] ?? null) !== ((saved.charge_stop_integrations || {})[dom] ?? null), t("optChargeStop"), stopSel, origin(stopOwn != null, stopOwn != null ? t(val("notify_charge_stop") ? "devChargeOn" : "devChargeOff") : "")) : "")
          );
      }
    }
    // Neue Geräte (seit 1.24.0): Override pro Integration; gilt auch bei "Nicht überwachen".
    const newPush = tgt("new") && d.notify_new && !has("new_exclude_integrations");
    const newHtml =
      this._ptlHtml(this._newRows(val("new_window"), newPush, reasonOf(has("new_exclude_integrations") && tgt("new") && d.notify_new, "new")), false, "tlFound") +
      opt(has("new_exclude_integrations") !== (saved.new_exclude_integrations || []).includes(dom), t("optNewNotify"),
        `<label class="switch"><input type="checkbox" data-list="new_exclude_integrations" data-value="${escape(dom)}" ${has("new_exclude_integrations") ? "" : "checked"} aria-label="${escape(`${t("optNewNotify")}: ${item.name}`)}"><span></span></label>`,
        origin(has("new_exclude_integrations"))) +
      (tgt("new") && d.notify_new ? "" : `<div class="opt-short mon-hint">${escape(t(tgt("new") ? "integNewGlobalOff" : "noTargetWarn"))}</div>`);
    // Empfang (seit 1.17.0): Warnschwelle je Funkart der Integration; gilt auch bei
    // "Nicht überwachen", weil sie nur die Markierung betrifft.
    const sigRows = this._sigRowsHtml(d, dom);
    const sigHtml = sigRows ? `<div class="opt-short sig-intro">${escape(t("sigIntegShort"))}</div>${sigRows}` : empty("integNoSignal");
    // Geräte der Integration mit eigener Einstellung, zum Zurücksetzen wie im Reiter.
    const ov = st.data.overrides || {};
    const devs = ["offline", "notify_delay", "notify", "battery", "charge"].flatMap((kind) => (ov[kind] || []).filter((x) => x.domain === dom).map((x) => ({ kind, x })));
    const devsHtml = devs.length
      ? `<div class="ovr-list">${devs
          .map(({ kind, x }) => {
            const on = st.resets[kind].has(x.id);
            const value = kind === "offline" ? (x.value === "off" ? t("ovrKindUnmon") : t("ovrKindOffline", fmt(x.value))) : kind === "notify_delay" ? t("ovrKindDelay", fmt(x.value)) : kind === "notify" ? t("ovrKindNotify") : kind === "charge" ? this._chargeOwnText(x.value) : t("ovrKindBattery", x.value);
            const label = t(on ? "ovrUndo" : "ovrReset", x.name);
            return `<div class="ovr-row${on ? " reset" : ""}${kind === "charge" ? " long" : ""}"><span class="ovr-name">${escape(x.name)}${x.area ? `<small>${escape(x.area)}</small>` : ""}</span>
            <span class="ovr-val">${on ? `<s>${escape(value)}</s> ${escape(t("ovrToInteg"))}` : escape(value)}</span>
            <button type="button" class="ovr-x" data-set="ovr-one" data-key="${kind}:${escape(x.id)}" title="${escape(label)}" aria-label="${escape(label)}">${mdi(on ? "reset" : "close", 16)}</button></div>`;
          })
          .join("")}</div>`
      : empty("integNoDevs");
    const anyOwn = off !== undefined || delayOwn !== undefined || dom in batMap || chargeMaps.some((k) => dom in (d[k] || {})) || dom in (d.signal_low_integrations || {}) || ["notify_exclude_integrations", "persistent_exclude_integrations", "battery_push_exclude_integrations", "new_exclude_integrations", "charge_integrations"].some(has);
    // Reiter: Punkt, wenn es dort eine eigene Einstellung der Integration gibt (Geräte: eigene der Geräte).
    const own = {
      out: off !== undefined || delayOwn !== undefined || has("notify_exclude_integrations") || has("persistent_exclude_integrations"),
      bat: dom in batMap || has("battery_push_exclude_integrations"),
      chg: has("charge_integrations") || chargeMaps.some((k) => dom in (d[k] || {})),
      new: has("new_exclude_integrations"),
      sig: dom in (d.signal_low_integrations || {}),
      dev: devs.length > 0,
    };
    const tabs = [["out", "tabOutage"], ["bat", "tabBattery"], ["chg", "tabCharge"], ["new", "tabNew"], ["sig", "tabSignal"], ["dev", "tabDevices"]];
    const cur = tabs.some(([id]) => id === st.sub?.integ) ? st.sub.integ : "out";
    const tabBar = `<div class="sub-tabs lvl-tabs" role="tablist">${tabs
      .map(([id, key]) => `<button type="button" role="tab" class="sub-tab${id === cur ? " on" : ""}${own[id] ? " chg" : ""}" data-set="isub" data-key="${id}" aria-selected="${id === cur}">${escape(t(key))}</button>`)
      .join("")}</div>`;
    const bodies = { out: outHtml, bat: batHtml, chg: chgHtml, new: newHtml, sig: sigHtml, dev: devsHtml };
    return `<button type="button" class="iback" data-set="integ" data-key="">${mdi("arrowLeft", 18)}${escape(t("integBack"))}</button>
      <div class="ihead">${this._ibadge(dom, item.name)}<div><b>${escape(item.name)}</b><small>${escape(t("integDevs", item.devices, item.batDevices))}</small></div></div>
      ${tabBar}<div class="lvl-body" role="tabpanel">${bodies[cur]}</div>
      <div class="integ-reset"><button type="button" class="ovr-all" data-set="integ-reset" data-key="${escape(dom)}" ${anyOwn ? "" : "disabled"}>${mdi("reset", 15)}${escape(t("integReset"))}</button></div>`;
  }

  _settingsBodyHtml() {
    const st = this._settings;
    const d = st.draft;
    const t = (k, ...a) => this._t(k, ...a);
    const changes = new Set(this._settingsChanges());
    const errors = this._settingsErrors();
    const infoBtn = (key) =>
      `<button type="button" class="info-btn${st.info.has(key) ? " on" : ""}" data-set="info" data-key="${key}" title="${escape(t("settingsInfo"))}" aria-label="${escape(t("settingsInfo"))}" aria-expanded="${st.info.has(key)}">${mdi("info", 16)}</button>`;
    // Feldzeile: Beschriftung (+ ⓘ), Eingabe, Kurzzeile oder Fehler,
    // aufklappbarer Text. data-short: Kurzzeile zurück, wenn der Fehler weg ist.
    // Eine Zeile kann mehrere Werte tragen (Zeitpunkt: Auswahl plus Uhrzeit):
    // geändert, wenn einer geändert ist; Fehler des ersten fehlerhaften.
    const row = (key, label, control, short, info, warn = null, also = []) => {
      const keys = [key, ...also];
      const error = keys.map((k) => errors[k]).find(Boolean);
      return `<div class="opt${keys.some((k) => changes.has(k)) ? " changed" : ""}${error ? " invalid" : ""}">
        <div class="opt-line"><span class="opt-label">${escape(label)}${info ? infoBtn(key) : ""}</span>${control}</div>
        ${short || error ? `<div class="${error ? "opt-error" : "opt-short"}" data-short="${escape(short || "")}">${escape(error || short)}</div>` : ""}
        ${warn ? `<div class="opt-warn">${mdi("alert", 14)}<span>${escape(warn)}</span></div>` : ""}
        ${info && st.info.has(key) ? `<div class="opt-info">${escape(info)}</div>` : ""}</div>`;
    };
    // Startseite: Benutzereinstellung (Benutzerdaten von HA); der Entwurf steht in st.extra, gespeichert wird mit "Speichern"
    const startRow = () => {
      const on = Boolean(st.extra ? st.extra.start_panel : this._startOn);
      const changed = Boolean(st.extra) && st.extra.start_panel !== st.extraBase.start_panel;
      const control = `<label class="switch"><input type="checkbox" data-start-panel ${on ? "checked" : ""}${st.extra ? "" : " disabled"} aria-label="${escape(t("optStart"))}"><span></span></label>`;
      return row("start_panel", t("optStart"), control, t("optStartShort"), null).replace('class="opt', changed ? 'class="opt changed' : 'class="opt');
    };
    const sw = (key, label, locked = false) => `<label class="switch"><input type="checkbox" data-opt="${key}" ${d[key] ? "checked" : ""}${locked ? " disabled" : ""} aria-label="${escape(label)}"><span></span></label>`;
    // Automatisch installieren (seit 2.22.0): Panel-Einstellung der Instanz (wie "Vorabversionen"), nur mit der täglichen Prüfung
    const autoUpdateRow = () => {
      const daily = Boolean(d.update_check);
      const on = daily && Boolean(st.extra ? st.extra.auto_update : this._autoUpdate);
      const changed = Boolean(st.extra) && st.extra.auto_update !== st.extraBase.auto_update;
      const control = `<label class="switch"><input type="checkbox" data-auto-update ${on ? "checked" : ""} ${daily && st.extra ? "" : "disabled"} aria-label="${escape(t("optAutoUpdate"))}"><span></span></label>`;
      return row("auto_update", t("optAutoUpdate"), control, daily ? t("optAutoUpdateShort") : t("optAutoUpdateNeedsCheck"), t("optAutoUpdateInfo")).replace('class="opt', changed ? 'class="opt changed' : 'class="opt');
    };
    // Uhrzeit der täglichen Prüfung (seit 2.25.0): leer = automatisch (zufällig nach dem Start, danach alle 24 Stunden)
    const checkTimeRow = () => {
      const daily = Boolean(d.update_check);
      const time = d.update_check_time || "";
      const control = `<span class="opt-input${errors.update_check_time ? " bad" : ""}"><input type="time" data-opt="update_check_time" value="${escape(time)}"${daily ? "" : " disabled"} aria-label="${escape(t("optUpdateCheckTime"))}"></span>
        <button type="button" class="lnk" data-set="check-time-auto"${daily && time ? "" : " disabled"}>${escape(t("optUpdateCheckTimeAuto"))}</button>`;
      return row("update_check_time", t("optUpdateCheckTime"), control, daily ? t("optUpdateCheckTimeShort") : t("optAutoUpdateNeedsCheck"), null);
    };
    // Push zum Panel-Update (seit 2.25.0): Schalter, darunter der Empfänger (nur wenn an)
    const updateNotifyRows = () => {
      const daily = Boolean(d.update_check);
      const control = `<label class="switch"><input type="checkbox" data-opt="update_notify" ${d.update_notify && daily ? "checked" : ""}${daily ? "" : " disabled"} aria-label="${escape(t("optUpdateNotify"))}"><span></span></label>`;
      const auto = Boolean(st.extra ? st.extra.auto_update : this._autoUpdate);
      let html = row("update_notify", t("optUpdateNotify"), control, daily ? t(auto ? "optUpdateNotifyShortAuto" : "optUpdateNotifyShort") : t("optAutoUpdateNeedsCheck"), t("optUpdateNotifyInfo"));
      if (daily && d.update_notify) html += targetRow("panelupdate", "optUpdateTargetShort");
      return html;
    };
    const select = (key, options, label) => `<span class="opt-select"><select data-opt="${key}" aria-label="${escape(label)}">${options
        .map(([v, text]) => `<option value="${escape(v)}"${v === d[key] ? " selected" : ""}>${escape(text)}</option>`)
        .join("")}</select>${mdi("chevronDown", 18)}</span>`;
    const targets = (st.data.notify_targets || [{ value: "none", kind: "none" }]).map((x) => [
      x.value,
      x.kind === "none" ? t("notifyNone") : x.kind === "entity" ? t("notifyEntity", x.value) : x.kind === "missing" ? t("notifyMissing", x.value) : x.value,
    ]);
    const num = (key, unit, label) => {
      const [min, max] = st.data.limits?.[key] || [];
      return `<span class="opt-input"><input type="number" inputmode="numeric" step="1" ${min != null ? `min="${min}" max="${max}"` : ""} data-opt="${key}" value="${escape(d[key] ?? "")}" aria-label="${escape(label)}"><span class="unit">${escape(unit)}</span></span>`;
    };
    // Ausschlüsse als Tabelle: Schalter "Anzeigen" pro Integration bzw. Typ,
    // bei den Integrationen dazu "Push" und "Anhaltend" (Bild 5). Jede Spalte
    // ist eine Liste der Ausgeschlossenen; ausgeblendete Zeilen sperren die
    // übrigen Spalten (nicht überwacht, keine Meldungen).
    // drag: Zeilen mit Griff zum Verschieben (Reihenfolge der Chips).
    // extra: zusätzliche Spalte (oder Liste von Spalten) mit Auswahl {label, html(x, off)} am Ende
    // ("Typ" und "Verbindungsart" der Integrationen).
    // Zeilen mit eigener Liste (x.list) schalten diese statt der Liste der Tabelle
    // (die Chips-Liste mischt hide_chips und hide_connections); allKey benennt
    // den Schalter "Alle umschalten", preview steht unter dem Hinweis.
    const exTable = (key, items, intro, drag = false, cols = null, allLabel = null, extra = null, allKey = null, preview = "") => {
      const columns = cols || [[key, t("colShow")]];
      const extras = extra ? [].concat(extra) : [];
      const multi = columns.length > 1;
      const sets = {};
      const setOf = (k) => (sets[k] ||= new Set(d[k] || []));
      const isOff = (x) => setOf(x.list || key).has(x.value);
      const dragOpt = drag;
      const handle = (x) =>
        drag
          ? `<button type="button" class="drag-h" data-set="drag" data-drag="${dragOpt}" data-key="${escape(x.value)}" title="${escape(t("dragHint"))}" aria-label="${escape(t("dragMove", x.label))}">${mdi("drag", 18)}</button>`
          : "";
      const cell = (html) => (multi ? `<span class="ex-col">${html}</span>` : html);
      // Feste Zeile ("Alle"): immer da, nicht umschaltbar, nur verschiebbar.
      const toggle = (k, label, x, off) =>
        x.fixed
          ? cell(`<span class="fix-badge" title="${escape(t("chipFixedTip"))}">${mdi("lock", 13)}${escape(t("chipFixed"))}</span>`)
          : cell(`<label class="switch"><input type="checkbox" data-list="${x.list || k}" data-value="${escape(x.value)}" ${setOf(x.list || k).has(x.value) ? "" : "checked"} ${off ? "disabled" : ""} aria-label="${escape(`${label}: ${x.label}`)}"><span></span></label>`);
      // Anheft-Marker (seit 1.15.0, docs/mockups/chip-pin-v1, B): schlanke Linie
      // mit Etikett und Griff statt einer Zeile mit Schalter.
      const pinLine = (x) => `<div class="ex-row pin-line"><span class="pin-tab" title="${escape(t("chipPinTip"))}">${handle(x)}${mdi("pin", 14)}<span>${escape(t("chipPinLabel"))}</span></span></div>`;
      const line = (x) => x.pin ? pinLine(x) : `<div class="ex-row${isOff(x) ? " off" : ""}">${handle(x)}${x.badge}<div class="ex-name">${escape(x.label)}<small>${escape(x.sub)}</small></div>
          ${columns.map(([k, label], i) => toggle(k, label, x, x.fixed || (i > 0 && isOff(x)))).join("")}${extras.map((e) => e.html(x, isOff(x))).join("")}</div>`;
      const rows = items.map(line).join("");
      const allRow = columns
        .map(([k, label]) => cell(`<label class="switch"><input type="checkbox" data-list-all="${allKey || k}" ${items.every((x) => x.fixed || !setOf(x.list || k).has(x.value)) ? "checked" : ""} aria-label="${escape(`${allLabel || t("toggleAll")}: ${label}`)}"><span></span></label>`))
        .join("");
      return `<div class="opt-short ex-intro">${escape(intro)}</div>${preview}${drag ? "" : this._searchHtml(key, items.length)}
        <div class="ex-head${multi ? " multi" : ""}"><span></span>${columns.map(([, label]) => (multi ? `<span class="ex-col">${escape(label)}</span>` : `<span>${escape(label)}</span>`)).join("")}${extras.map((e) => `<span class="ex-col sel">${escape(e.label)}</span>`).join("")}</div>
        <div class="ex-row ex-all"><div class="ex-name">${escape(allLabel || t("toggleAll"))}</div>${allRow}${extras.map(() => `<span class="ex-col sel"></span>`).join("")}</div>
        ${drag ? `<div class="drag-list" data-drag-list="${dragOpt}">${rows}</div>` : `<div class="srch-rows" data-srch="${key}">${rows}<div class="srch-none opt-short" hidden>${escape(t("listSearchNone"))}</div></div>`}`;
    };
    // KI-Aufgaben von HA; eine früher gewählte, die es nicht mehr gibt, bleibt sichtbar.
    const aiTasks = [...(st.data.catalog?.ai_tasks || [])];
    // Ältere Rückmeldung des Backends ohne das Feld: wie bisher einschaltbar
    const aiReady = st.data.catalog?.ai_ready !== false;
    const aiBlocked = !aiReady && !d.ai_assessment;
    if (d.ai_task_entity && !aiTasks.some((x) => x.value === d.ai_task_entity)) aiTasks.push({ value: d.ai_task_entity, name: d.ai_task_entity });
    const integrations = (st.data.catalog?.integrations || []).map((i) => ({
      value: i.domain,
      label: i.name,
      sub: t("devicesCount", i.devices),
      badge: this._ibadge(i.domain, i.name),
    }));
    // Typ pro Integration (seit 1.25.0): Spalte neben "Anzeigen", gilt für alle
    // Geräte der Integration statt der Erkennung, von Hand am Gerät geht vor.
    // Je Zeile die Erkennung, "Automatisch" ist der Standard. Festgelegt, aber
    // gerade ohne Geräte: bleibt zum Zurücksetzen in der Liste.
    const typeInfo = this._typeIntegInfo();
    const typeOwn = d.type_integrations || {};
    const typeSaved = st.data.values.type_integrations || {};
    const detected = (dom) =>
      [...(typeInfo.get(dom) || [])].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${n} ${t(typeKey(k))}`).join(", ");
    for (const i of integrations) if (detected(i.value)) i.sub = `${i.sub} · ${t("typeIntegDetected", detected(i.value))}`;
    for (const dom of Object.keys({ ...typeOwn, ...typeSaved })) {
      if (integrations.some((x) => x.value === dom)) continue;
      const label = this._integrations[dom] || dom;
      integrations.push({ value: dom, label, sub: t("typesEmpty"), badge: this._ibadge(dom, label) });
    }
    const typeOpts = [["", t("connIntegAuto")], ...TYPE_ORDER.map((k) => [k, t(typeKey(k))])];
    const typeExtra = {
      label: t("typeLabel"),
      html: (x) => {
        const v = typeOwn[x.value] || "";
        const changed = (typeOwn[x.value] || null) !== (typeSaved[x.value] || null);
        const opts = typeOpts.map(([val, text]) => `<option value="${val}"${val === v ? " selected" : ""}>${escape(text)}</option>`).join("");
        return `<span class="ex-col sel"><span class="ex-lbl">${escape(t("typeLabel"))}</span><span class="opt-select${changed ? " changed" : ""}"><select data-type-integ="${escape(x.value)}" aria-label="${escape(`${t("typeLabel")}: ${x.label}`)}">${opts}</select>${mdi("chevronDown", 18)}</span></span>`;
      },
    };
    // Verbindungsart pro Integration (seit 2.0.4 neben dem Typ, vorher eigene Liste in "Darstellung"): gilt für alle
    // Geräte der Integration statt der Erkennung, von Hand am Gerät geht vor. Festgelegt, aber gerade ohne Geräte:
    // bleibt zum Zurücksetzen in der Liste.
    const connInfo = this._connIntegInfo();
    const connOwn = d.connection_integrations || {};
    const connSaved = st.data.values.connection_integrations || {};
    const connDetected = (dom) =>
      [...(connInfo.get(dom) || [])].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${n} ${t(CONN[k].key)}`).join(", ");
    for (const dom of Object.keys({ ...connOwn, ...connSaved })) {
      if (integrations.some((x) => x.value === dom)) continue;
      const label = this._integrations[dom] || dom;
      integrations.push({ value: dom, label, sub: t("typesEmpty"), badge: this._ibadge(dom, label) });
    }
    const connOpts = [["", t("connIntegAuto")], ...CONN_MANUAL.map((k) => [k, t(CONN[k].key)])];
    const connExtra = {
      label: t("connType"),
      html: (x) => {
        const v = connOwn[x.value] || "";
        const changed = (connOwn[x.value] || null) !== (connSaved[x.value] || null);
        const opts = connOpts.map(([val, text]) => `<option value="${val}"${val === v ? " selected" : ""}>${escape(text)}</option>`).join("");
        const hint = connDetected(x.value) ? t("typeIntegDetected", connDetected(x.value)) : "";
        return `<span class="ex-col sel"><span class="ex-lbl">${escape(t("connType"))}</span><span class="opt-select${changed ? " changed" : ""}"><select data-conn-integ="${escape(x.value)}" title="${escape(hint)}" aria-label="${escape(`${t("connType")}: ${x.label}`)}">${opts}</select>${mdi("chevronDown", 18)}</span></span>`;
      },
    };
    // Eine Liste für alle Chips (seit 1.14.0, docs/mockups/chip-order-v3, D2):
    // "Alle" (fest, nur verschiebbar), jede Verbindungsart (auch ohne Geräte,
    // zum Ausblenden und Einordnen im Voraus) und die übrigen Chips, in der
    // Folge der Leiste. Verbindungsarten schalten hide_connections, die
    // übrigen hide_chips.
    const chipIcons = Object.fromEntries(CHIP_OTHER);
    const connCounts = this._connCounts();
    const chipItems = this._dragOrder(d).map((key) => {
      if (key === "pin") return { value: key, pin: true, label: t("chipPinLabel") };
      if (key === "all") {
        return { value: key, label: t("chipOther").all[0], sub: t("chipOther").all[1], badge: `<span class="ibadge type">${mdi("filter", 18)}</span>`, fixed: true };
      }
      if (key in CONN) {
        const n = connCounts.get(key) || 0;
        return { value: key, list: "hide_connections", label: t(CONN[key].key), sub: n ? t("devicesCount", n) : t("typesEmpty"), badge: `<span class="ibadge type">${CONN[key].icon(18)}</span>` };
      }
      return { value: key, label: t("chipOther")[key][0], sub: t("chipOther")[key][1], badge: `<span class="ibadge type">${mdi(chipIcons[key], 18)}</span>` };
    });
    const types = this._catalogTypes(d).map((x) => ({
      value: x.type,
      label: t(typeKey(x.type)),
      sub: x.devices ? t("devicesCount", x.devices) : t("typesEmpty"),
      badge: `<span class="ibadge type">${typeIcon(x.type, 18)}</span>`,
    }));
    const hiddenDevs = this._hiddenCatalog().map((x) => ({
      value: x.id,
      label: x.name,
      sub: [x.area, x.integration].filter(Boolean).join(" · "),
      badge: `<span class="ibadge type">${typeIcon(x.type, 18)}</span>`,
    }));
    // Eigenes Ziel je Reiter (seit 2.18.0): "Standard" folgt dem Ziel aus der Übersicht
    const stdLabel = () => {
      const global = d.notify_service;
      if (!global || global === "none") return t("notifyStdNone");
      return t("notifyStd", targets.find(([v]) => v === global)?.[1] || global);
    };
    const targetRow = (topic, shortKey = "optNotifyTargetTabShort") => {
      const key = `notify_service_${topic}`;
      return row(key, t("optNotifyTargetTab"), select(key, [["", stdLabel()], ...targets.filter(([v]) => v !== "none")], t("optNotifyTargetTab")), t(shortKey), null);
    };
    const ui = { row, sw, select, num, targets, infoBtn, targetRow };
    // Titel eines neuen Themas (seit 1.43.0): überall derselbe grosse Stil (.set-title, wie .mon-grp)
    const ttl = (key) => `<div class="set-title">${escape(t(key))}</div>`;
    const devTab = ["integrations", "types", "devs", "devset"].includes(st.sub?.devices) ? st.sub.devices : "integrations";
    // Abschnitt "Panel" (seit 2.87.0): Unterreiter "Allgemein" und "Updates"
    const panelTab = st.sub?.panel === "pupdates" ? "pupdates" : "pstart";
    // Reiter innerhalb eines Abschnitts; Zähler = ausgeblendete Einträge,
    // Punkt = Änderung im Entwurf (wie bei den Reitern der Überwachung).
    const subTabs = (group, items, cur = devTab) =>
      `<div class="sub-tabs" role="tablist">${items
        .map(([id, key]) => {
          const on = id === cur;
          const mark = SUB_TAB_KEYS[id].some((k) => changes.has(k)) ? " chg" : "";
          const n = this._subCount(id, d);
          return `<button type="button" role="tab" class="sub-tab${on ? " on" : ""}${mark}" data-set="subtab" data-group="${group}" data-key="${id}" aria-selected="${on}">${escape(t(key))}<span class="sub-n"${n ? "" : " hidden"}>${n}</span></button>`;
        })
        .join("")}</div>`;
    // Kapitel "Protokolle" (seit 2.105.0) ganz unten in Panel › Allgemein: Grösse und Zahl der Einträge der beiden Protokolle
    const protoChapter = () => {
      const u = st.usage;
      const used = (x) => (x ? t("usedText", this._fmtMb(x.bytes), (x.entries || 0).toLocaleString(this._locale())) : "");
      const cut = this._protocolCuts();
      const ask = st.cutAsk && cut.length
        ? `<div class="opt-warn cut-ask">${mdi("alert", 14)}<span>${escape(t("cutAsk", cut.join(", ")))}</span></div>
           <div class="bk-btns"><button type="button" class="dlg-btn" data-set="cut-no">${escape(t("cutNo"))}</button><button type="button" class="dlg-btn danger" data-set="cut-yes">${escape(t("cutYes"))}</button></div>`
        : "";
      return ttl("ttlLogs") + `<div class="opt-short bk-note">${escape(t("logsNote"))}</div>` +
        row("protocol_max_mb", t("optProtoMb"), num("protocol_max_mb", t("unitMb"), t("optProtoMb")), t("optProtoMbShort", used(u?.protocol)), null) +
        row("protocol_max_entries", t("optProtoEntries"), num("protocol_max_entries", t("unitEntries"), t("optProtoEntries")), t("optProtoEntriesShort", u?.protocol?.max_item || 0), null) +
        row("log_max_mb", t("optLogMb"), num("log_max_mb", t("unitMb"), t("optLogMb")), t("optLogMbShort", used(u?.log)), null) +
        row("log_max_entries", t("optLogEntries"), num("log_max_entries", t("unitEntries"), t("optLogEntries")), t("optLogEntriesShort", u?.log?.entries || 0), null) +
        ask;
    };
    const fields = {
      monitor: this._monitorHtml(d, changes, errors, ui),
      // Seit 1.0.0 (docs/mockups/content-v1, A): was bestimmt, welche Geräte
      // das Panel zeigt und überwacht, in einem Abschnitt. Die Integrationen
      // haben nur "Anzeigen"; Überwachen und Melden pro Integration steht in
      // "Überwachung und Meldungen" › "Integrationen".
      devices:
        ttl("ttlShow") +
        row("show_service_devices", t("optShowService"), sw("show_service_devices", t("optShowService")), t("optShowServiceShort"), t("optShowServiceInfo")) +
        row("show_disabled_devices", t("optShowDisabled"), sw("show_disabled_devices", t("optShowDisabled")), t("optShowDisabledShort"), null) +
        subTabs("devices", [["integrations", "secIntegrations"], ["types", "subTypes"], ["devs", "subDevs"], ["devset", "subDevSet"]]) +
        ttl(devTab === "types" ? "ttlTypes" : devTab === "devs" ? "ttlHiddenDevs" : devTab === "devset" ? "ttlDevSet" : "ttlIntegShow") +
        (devTab === "types"
          ? exTable("exclude_types", types, `${t("hideIntro")} ${t("typesIntro")}`)
          : devTab === "devset"
            ? // Alle Geräte mit eigener Einstellung an einem Ort (seit 2.0.7); jede Liste steht auch beim jeweiligen Thema.
              `<div class="opt-short ex-intro">${escape(t("devSetIntro"))}</div>` +
              ["offline", "notify_delay", "notify", "battery", "connection", "signal", "charge"].map((k) => this._overridesHtml(k)).join("")
          : devTab === "devs"
            ? hiddenDevs.length
              ? exTable("exclude_devices", hiddenDevs, t("hiddenIntro"), false, null, t("hiddenShowAll"))
              : `<div class="opt-short ex-intro">${escape(t("hiddenIntro"))}</div><div class="opt-short hidden-empty">${escape(t("hiddenEmpty"))}</div>`
            : `<div class="nf-note integ-goto">${mdi("info", 16)}<div><p>${escape(t("integGoto"))} <button type="button" class="lnk" data-set="goto" data-key="integ">${escape(t("integGotoLink"))}</button></p></div></div>` +
              exTable("exclude_integrations", integrations, `${t("integIntroShow")} ${t("typeIntegIntro")}`, false, null, null, [typeExtra, connExtra])),
      // Wie Geräte erscheinen, nicht ob (seit 1.0.0).
      // Allgemein (Startseite) und Updates des Panels (seit 2.87.0): die Startseite gilt nur für den Benutzer, alles andere für die Instanz; die Versionszeile steht oben ausserhalb
      updates:
        subTabs("panel", [["pstart", "subPanelStart"], ["pupdates", "subPanelUpdates"]], panelTab) +
        (panelTab === "pstart"
          ? `<div class="nf-note view-own">${mdi("info", 16)}<div><p>${escape(t("startOwnNote"))}</p></div></div>` + ttl("ttlStart") + startRow() + this._backupChapterHtml(changes.size > 0) + protoChapter()
          : row("update_check", t("optUpdateCheck"), sw("update_check", t("optUpdateCheck")), t("optUpdateCheckShort"), t("optUpdateCheckInfo")) +
            checkTimeRow() +
            autoUpdateRow() +
            updateNotifyRows()),
      // Filter-Chips (seit 2.87.0 im Dialog "Ansicht", Reiter "Filter-Chips"):
      chips:
        // Alle Chips in einer Liste (seit 1.14.0, docs/mockups/chip-order-v3, D2):
        // Reihenfolge, Ausblenden und Vorschau der Leiste, gilt für alle. Seit 2.0.7 ohne Unterreiter
        // (Verbindungsart und Empfang sind nach "Geräte im Panel" und "Überwachung und Meldungen" gezogen).
            `<h4 class="ex-title">${escape(t("chipsOtherTitle"))}</h4>` +
            // Zurücksetzen vor der Liste, nicht dahinter (seit 2.5.0): die Liste steht ganz unten.
            ((d.chip_order || []).length || (d.connection_order || []).length
              ? `<div class="drag-reset"><button type="button" class="ovr-all" data-set="drag-reset">${mdi("reset", 15)}${escape(t("chipsOrderResetAll"))}</button></div>`
              : "") +
            exTable(
              "hide_chips", chipItems, t("chipsOtherIntro"), "chip_order", null, null, null, "chips",
              (() => {
                const prev = this._chipPreviewHtml(d);
                return `<div class="chip-prev"><div class="chip-prev-t">${escape(t("chipsPreview"))}</div><div class="chip-prev-pills">${prev.wrap}</div>` +
                  (prev.strip ? `<div class="chip-prev-t phone">${escape(t("chipsPreviewPhone"))}</div><div class="chip-prev-strip">${prev.strip}</div>` : "") +
                  `</div>`;
              })()
            ),
      ai:
        ttl("ttlAiShow") +
        // Ohne KI-Aufgabe (in Home Assistant unter "KI-Vorschläge" gewählt oder hier) lässt sich die Funktion nicht einschalten (seit 2.38.0);
        // schon Eingeschaltetes bleibt, mit Hinweis. Der Link führt zu /config/ai.
        row("ai_assessment", t("optAi"), sw("ai_assessment", t("optAi"), aiBlocked), t("optAiShort"), t("optAiInfo"), aiReady ? null : t(d.ai_assessment ? "aiLost" : "aiNotReady")) +
        `<div class="opt-link"><button type="button" class="set-link" data-ai-open>${escape(t("aiOpenHa"))}${mdi("chevronRight", 16)}</button></div>` +
        (d.ai_assessment
          ? ttl("ttlAiTask") + row(
              "ai_task_entity",
              t("optAiTask"),
              select("ai_task_entity", [["", t("aiTaskDefault")], ...aiTasks.map((x) => [x.value, x.name])], t("optAiTask")),
              t("optAiTaskShort"),
              null,
              (st.data.catalog?.ai_tasks || []).length ? null : t("aiNoTasks")
            )
          : "") +
        ttl("ttlAiPrompt") +
        this._aiPromptHtml(d, changes.has("ai_prompt")),
      routines:
        row("routines_pause", t("optRoutinesPause"), sw("routines_pause", t("optRoutinesPause")), t("optRoutinesPauseShort"), null) +
        row("routines_catch_up", t("optRoutinesCatchUp"), num("routines_catch_up", t("minuteUnit"), t("optRoutinesCatchUp")), t("optRoutinesCatchUpShort"), null) +
        ui.targetRow("routines", "optRoutinesTargetShort") +
        row("routines_notify_error", t("optRoutinesNotifyError"), sw("routines_notify_error", t("optRoutinesNotifyError")), t("optRoutinesNotifyErrorShort"), t("optRoutinesNotifyErrorInfo")),
    };
    const titles = {
      devices: "secDevices", monitor: "secMonitor", routines: "secRoutines", ai: "secAiSettings", updates: "secPanel",
    };
    // Dialog "Ansicht": nur der Block der Filter-Chips (Rahmen und Reiter baut _viewBodyHtml)
    if (st.mode === "view") return fields.chips;
    // Die Versionszeile (Prüfen, Installieren, Vorabversionen) steht wie immer ganz oben, vor den Abschnitten (Wunsch des Nutzers, 2.88.0):
    // schnell erreichbar und beim Öffnen gleich zu sehen; im Abschnitt "Panel" › "Updates" bleiben nur die Einstellungen
    return (
      `<div class="ver-slot">${(this._verSlotHtml = this._versionHtml())}</div>` +
      this._settingsSections()
        .map(([id, keys]) => {
          const open = st.open.has(id);
          const changed = keys.some((k) => changes.has(k));
          return `<section class="set-sec${open ? " open" : ""}">
            <button type="button" class="set-sec-head" data-set="section" data-id="${id}" aria-expanded="${open}">
              <span><span class="set-sec-title">${escape(t(titles[id]))}${changed ? `<span class="set-badge">${escape(t("settingsChanged"))}</span>` : ""}</span>
              <span class="set-sec-sum">${escape(this._settingsSummary(id, d))}</span></span>${mdi("chevronDown", 20)}</button>
            ${open ? `<div class="set-sec-body">${fields[id]}</div>` : ""}</section>`;
        })
        .join("") +
      (st.saveError ? `<div class="dlg-error">${escape(t("settingsSaveError"))} ${escape(st.saveError)}</div>` : "")
    );
  }

  _bindSettings(dialog) {
    // Escape: mit ungespeicherten Änderungen erst fragen (seit 2.20.0)
    dialog.addEventListener("cancel", (ev) => {
      ev.preventDefault();
      this._requestCloseSettings();
    });
    dialog.addEventListener("click", (ev) => {
      const lclear = ev.target.closest("[data-lclear]");
      if (lclear) {
        // Klick im Label fokussiert sonst das Feld und öffnet auf dem Handy die Tastatur.
        ev.preventDefault();
        const key = lclear.dataset.lclear;
        (this._settings.search ||= {})[key] = "";
        const input = dialog.querySelector(`input[data-lsearch="${key}"]`);
        if (input) input.value = "";
        this._applyListSearch(dialog);
        if (input && !window.matchMedia?.(TOUCH_QUERY).matches) input.focus();
        return;
      }
      // Link zu den KI-Einstellungen von Home Assistant (seit 2.38.0): die Einstellungen schliessen (mit Rückfrage bei Änderungen), dann hin
      if (ev.target.closest("[data-ai-open]")) {
        this._requestCloseSettings(() => this._navigate("/config/ai"));
        return;
      }
      const verBtn = ev.target.closest("[data-ver]");
      if (verBtn) {
        if (!verBtn.disabled) this._versionAction(verBtn.dataset.ver);
        return;
      }
      if (ev.target === dialog) {
        const r = dialog.getBoundingClientRect();
        if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) this._requestCloseSettings();
        return;
      }
      const btn = ev.target.closest("[data-set]");
      if (!btn || btn.disabled || !this._settings) return;
      const st = this._settings;
      const action = btn.dataset.set;
      if (action === "close") this._requestCloseSettings();
      else if (action === "save") this._saveSettings();
      else if (action === "cut-no") {
        st.cutAsk = false;
        this._renderSettings();
      } else if (action === "cut-yes") {
        st.cutOk = true;
        this._saveSettings();
      }
      else if (action === "tab" || action === "goto" || action === "integ" || action === "ifilter") {
        // Reiter, Sprung aus Übersicht oder Abschnitt "Integrationen", Liste
        // und eine Integration (leer = zurück zur Liste).
        if (action === "tab" || action === "goto") {
          st.tab = btn.dataset.key;
          if (btn.dataset.sub) st.sub.battery = btn.dataset.sub;
          st.integ = null;
          if (btn.dataset.filter) st.integFilter = btn.dataset.filter;
          if (action === "goto") st.open.add("monitor");
        } else if (action === "integ") {
          if ((btn.dataset.key || null) !== st.integ) st.sub.integ = "out";
          st.integ = btn.dataset.key || null;
        }
        else st.integFilter = btn.dataset.key;
        this._renderSettings();
        // Neuer Inhalt beginnt oben: die Reiter ins Bild, wenn sie darüber liegen.
        if (action !== "ifilter") this.shadowRoot.querySelector("dialog.settings .mon-tabs")?.scrollIntoView({ block: action === "goto" ? "start" : "nearest" });
      } else if (action === "subtab") {
        st.sub[btn.dataset.group] = btn.dataset.key;
        this._renderSettings();
      } else if (action === "vtab") {
        st.vtab = btn.dataset.key;
        this._renderSettings();
      } else if (action === "isub") {
        // Reiter im Detail einer Integration (seit 1.42.0)
        st.sub.integ = btn.dataset.key;
        this._renderSettings();
      } else if (action === "expert") {
        st.expert = btn.checked;
        this._renderSettings();
      } else if (action === "prompt-open") this._openPrompt();
      else if (action === "prompt-copy") this._copyText(st.draft.ai_prompt || st.data.ai_prompt_default, btn);
      else if (action === "prompt-default") {
        if (!st.draft) return;
        st.draft.ai_prompt = "";
        // Der Prompt bleibt sichtbar, auch wenn der Schalter nur aus dem eigenen Prompt abgeleitet war.
        st.expert = true;
        this._renderSettings();
      } else if (action === "chip") {
        if (!st.draft) return;
        st.draft[btn.dataset.key] = !st.draft[btn.dataset.key];
        this._renderSettings();
      } else if (action === "integ-reset-all") {
        if (!st.draft) return;
        for (const key of INTEG_OWN_MAPS) st.draft[key] = {};
        for (const key of INTEG_OWN_LISTS) st.draft[key] = [];
        this._renderSettings();
      } else if (action === "integ-reset") {
        // Alles einer Integration auf den Standard (beim Speichern).
        if (!st.draft) return;
        const dom = btn.dataset.key;
        for (const key of INTEG_OWN_MAPS) {
          const own = { ...(st.draft[key] || {}) };
          delete own[dom];
          st.draft[key] = own;
        }
        for (const key of INTEG_OWN_LISTS) {
          st.draft[key] = (st.draft[key] || []).filter((x) => x !== dom);
        }
        this._renderSettings();
      } else if (action === "quiet-all") {
        // Ruhezeit: die Zeiten des Montags für alle Wochentage übernehmen (ein/aus bleibt je Tag)
        if (!st.draft || !Array.isArray(st.draft.quiet_days)) return;
        const [first] = st.draft.quiet_days;
        st.draft.quiet_days = st.draft.quiet_days.map((x) => ({ ...x, from: first.from, to: first.to }));
        this._renderSettings();
      } else if (action === "bk-export" || action === "bk-import") {
        this._openBackup(action === "bk-export" ? "export" : "import");
      } else if (action === "check-time-auto") {
        // Uhrzeit der Prüfung zurück auf "automatisch"
        if (!st.draft) return;
        st.draft.update_check_time = "";
        this._renderSettings();
      } else if (action === "section" || action === "info") {
        const set = action === "section" ? st.open : st.info;
        const key = action === "section" ? btn.dataset.id : btn.dataset.key;
        // Wird eine Gruppe geschlossen, deren Anfang oben aus dem Bild gescrollt ist (angeheftete Kopfzeile), springt die Ansicht sonst
        // an eine zufällige Stelle: danach die Gruppe an den oberen Rand holen.
        const dlg = btn.closest("dialog");
        const sec = action === "section" ? btn.closest(".set-sec") : null;
        const headBottom = (dlg?.querySelector(".dlg-head")?.getBoundingClientRect().bottom ?? 0) + 1;
        const aboveView = Boolean(sec) && set.has(key) && sec.getBoundingClientRect().top < headBottom;
        if (set.has(key)) set.delete(key);
        else set.add(key);
        this._renderSettings();
        if (aboveView) dlg.querySelector(`.set-sec-head[data-id="${key}"]`)?.closest(".set-sec")?.scrollIntoView({ block: "start" });
      } else if (action === "drag-reset") {
        if (!st.draft) return;
        // Standardreihenfolge: auch die Ausgangsfolge der Verbindungsarten leeren.
        st.draft.chip_order = [];
        st.draft.connection_order = [];
        this._renderSettings();
      } else if (action === "emoji-reset") {
        // Standard-Emoji einer Meldung (seit 2.2.0): null im Entwurf.
        if (!st.draft) return;
        st.draft[`emoji_${btn.dataset.key}`] = null;
        this._renderSettings();
        // Die Eingabe hat der Nutzer von Hand verändert: gleicht sich der Neuaufbau nicht an
        // (setHtml überspringt gleiches HTML), also das Feld selbst nachführen.
        this._syncEmoji(btn.dataset.key, true);
      } else if (action === "ovr-all" || action === "ovr-one") {
        if (!st.data) return;
        const [kind, id] = btn.dataset.key.split(/:(.*)/s);
        const marked = st.resets[kind];
        if (action === "ovr-all") for (const x of st.data.overrides?.[kind] || []) marked.add(x.id);
        else if (marked.has(id)) marked.delete(id);
        else marked.add(id);
        this._renderSettings();
      }
    });
    // Zahlen: Entwurf beim Tippen nachführen, aber nur die Anzeige drumherum
    // anpassen; ein Neuaufbau liesse den Cursor springen (wie unifi_dynamic).
    // Ihr "change" (beim Verlassen) baut bewusst nichts neu auf, sonst ginge
    // der Klick verloren, der den Fokus wegnimmt (z. B. auf "Speichern").
    // Reihenfolge der Chips: am Griff ziehen (Maus und Finger, Pointer-Events)
    // oder mit den Pfeiltasten. Beim Ziehen wird nur umgehängt, kein
    // Neuaufbau; erst beim Loslassen kommt die Folge in den Entwurf.
    dialog.addEventListener("pointerdown", (ev) => {
      const h = ev.target.closest('[data-set="drag"]');
      if (!h || !this._settings?.draft || (ev.pointerType === "mouse" && ev.button !== 0)) return;
      ev.preventDefault();
      const row = h.closest(".ex-row");
      const box = row?.parentElement;
      if (!box) return;
      // Bewegungen am Fenster abhören, nicht am Griff: Das Umhängen der Zeile
      // im DOM hebt die Zeiger-Bindung an den Griff auf.
      const win = this.ownerDocument?.defaultView || window;
      row.classList.add("lift");
      const move = (e) => {
        const y = e.clientY;
        // Am Rand des Dialogs mitscrollen, damit lange Listen gehen.
        const dr = dialog.getBoundingClientRect();
        if (y < dr.top + 60) dialog.scrollTop -= 10;
        else if (y > dr.bottom - 90) dialog.scrollTop += 10;
        const after = [...box.children].find((r) => {
          if (r === row) return false;
          const b = r.getBoundingClientRect();
          return y < b.top + b.height / 2;
        });
        if (after) {
          if (row.nextElementSibling !== after) box.insertBefore(row, after);
        } else if (box.lastElementChild !== row) box.appendChild(row);
      };
      const up = () => {
        win.removeEventListener("pointermove", move);
        win.removeEventListener("pointerup", up);
        win.removeEventListener("pointercancel", up);
        row.classList.remove("lift");
        const st = this._settings;
        if (!st?.draft) return;
        const order = [...box.querySelectorAll('[data-set="drag"]')].map((b) => b.dataset.key);
        // Nur speichern, wenn die Folge von der angezeigten abweicht.
        if (JSON.stringify(order) !== JSON.stringify(this._dragOrder(st.draft))) this._setChipOrder(order);
        this._renderSettings();
      };
      win.addEventListener("pointermove", move);
      win.addEventListener("pointerup", up);
      win.addEventListener("pointercancel", up);
    });
    dialog.addEventListener("keydown", (ev) => {
      const h = ev.target.closest?.('[data-set="drag"]');
      const st = this._settings;
      if (!h || !st?.draft || (ev.key !== "ArrowUp" && ev.key !== "ArrowDown")) return;
      ev.preventDefault();
      const order = this._dragOrder(st.draft);
      const i = order.indexOf(h.dataset.key);
      const j = ev.key === "ArrowUp" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      this._setChipOrder(order);
      this._renderSettings();
    });
    dialog.addEventListener("input", (ev) => {
      const st = this._settings;
      const el = ev.target;
      if (el.dataset?.lsearch && st) {
        // Suchfeld einer Liste (seit 1.28.0): nur filtern, kein Neuaufbau (sonst ginge der Fokus verloren)
        (st.search ||= {})[el.dataset.lsearch] = el.value;
        this._applyListSearch(dialog);
        return;
      }
      if (st?.draft && el.dataset?.emoji) {
        // Emoji im Titel (seit 2.2.0): höchstens so viele sichtbare Zeichen wie erlaubt (nicht
        // mitten in einer Eingabe-Komposition kürzen), leer = ohne Emoji, wie der Standard = Standard.
        if (ev.isComposing) return;
        const kind = el.dataset.emoji;
        const max = st.data?.emoji_max || 3;
        let marks = this._graphemes(el.value);
        if (marks.length > max) {
          marks = marks.slice(0, max);
          el.value = marks.join("");
        }
        const value = marks.join("").trim();
        st.draft[`emoji_${kind}`] = value === (st.data?.emoji_defaults?.[kind] || "") && value !== "" ? null : value;
        this._syncEmoji(kind);
        this._updateSettingsMeta();
        return;
      }
      if (st?.draft && el.type === "time" && el.dataset.qday !== undefined) {
        // Ruhezeit: Start- oder Endzeit eines Wochentags (ohne Neuaufbau, der Fokus bleibt im Feld)
        const days = (st.draft.quiet_days || []).map((x) => ({ ...x }));
        const day = days[Number(el.dataset.qday)];
        if (day) day[el.dataset.qfield] = el.value;
        st.draft.quiet_days = days;
        this._updateSettingsMeta();
        return;
      }
      if (st?.draft && el.type === "time" && el.dataset.opt) {
        st.draft[el.dataset.opt] = el.value;
        this._updateSettingsMeta();
        return;
      }
      if (!st?.draft || el.type !== "number") return;
      if (el.dataset.bat) {
        // Das Feld gibt es nur bei "Eigene Schwelle": leer ist dort ungültig
        // (zurück auf den globalen Wert geht es über die Auswahl).
        const own = { ...(st.draft.battery_low_integrations || {}) };
        own[el.dataset.bat] = el.value === "" ? null : Number(el.value);
        st.draft.battery_low_integrations = own;
      } else if (el.dataset.sig) {
        // Eigene Schwelle einer Funkart (global oder je Integration); leer ist ungültig.
        this._setSig(el.dataset.sig, el.value === "" ? null : Number(el.value));
      } else if (el.dataset.opt) {
        st.draft[el.dataset.opt] = el.value === "" ? null : Number(el.value);
      } else return;
      this._updateSettingsMeta();
    });
    dialog.addEventListener("change", (ev) => {
      const st = this._settings;
      const el = ev.target;
      if (st?.draft && el.tagName === "SELECT" && el.dataset.cfull !== undefined) {
        // "own": mit einem Wert ausserhalb der Stufen beginnen (der bisherige eigene Wert, sonst 85).
        st.draft.charge_full = el.value === "own" ? (Number.isInteger(st.draft.charge_full) && !CHARGE_FULL_PRESETS.includes(st.draft.charge_full) ? st.draft.charge_full : CHARGE_FULL_OWN_START) : Number(el.value);
        this._renderSettings();
        return;
      }
      if (st?.draft && el.tagName === "SELECT" && el.dataset.opt) {
        st.draft[el.dataset.opt] = el.value;
        this._renderSettings();
        return;
      }
      if (st?.draft && el.tagName === "SELECT" && el.dataset.connInteg) {
        const own = { ...(st.draft.connection_integrations || {}) };
        if (el.value) own[el.dataset.connInteg] = el.value;
        else delete own[el.dataset.connInteg];
        st.draft.connection_integrations = own;
        this._renderSettings();
        return;
      }
      if (st?.draft && el.tagName === "SELECT" && el.dataset.typeInteg) {
        const own = { ...(st.draft.type_integrations || {}) };
        if (el.value) own[el.dataset.typeInteg] = el.value;
        else delete own[el.dataset.typeInteg];
        st.draft.type_integrations = own;
        this._renderSettings();
        return;
      }
      if (st?.draft && el.tagName === "SELECT" && el.dataset.offMode) {
        const own = { ...(st.draft.offline_after_integrations || {}) };
        if (el.value === "default") delete own[el.dataset.offMode];
        else own[el.dataset.offMode] = el.value === "off" ? "off" : Number(el.value);
        st.draft.offline_after_integrations = own;
        this._renderSettings();
        return;
      }
      if (st?.draft && el.tagName === "SELECT" && el.dataset.delayMode) {
        const own = { ...(st.draft.notify_delay_integrations || {}) };
        if (el.value === "default") delete own[el.dataset.delayMode];
        else own[el.dataset.delayMode] = Number(el.value);
        st.draft.notify_delay_integrations = own;
        this._renderSettings();
        return;
      }
      if (st?.draft && el.tagName === "SELECT" && el.dataset.sigMode) {
        const [dom, conn] = el.dataset.sigMode.split("|");
        if (el.value === "default") this._setSig(el.dataset.sigMode, undefined);
        else if (el.value === "off") this._setSig(el.dataset.sigMode, "off");
        else {
          // Start mit dem heute geltenden Wert (gleiche Einheit), sonst dem festen Standard.
          const kind = this._sigKind(this._sigGroups().get(dom ? `${dom}|${conn}` : conn));
          const def = sigDefaultOf(st.draft.signal_low, null, conn, kind);
          this._setSig(el.dataset.sigMode, Number.isInteger(def.value) && dom ? def.value : sigStd(kind));
        }
        this._renderSettings();
        return;
      }
      if (st?.draft && el.tagName === "INPUT" && el.dataset.cfullIntegVal) {
        // Eigener Wert von "Voll ab" einer Integration (Zahlenfeld, seit 1.38.0).
        const dom = el.dataset.cfullIntegVal;
        const v = Number(el.value);
        const [min, max] = CHARGE_FULL_RANGE;
        if (el.value === "" || !Number.isInteger(v) || v < min || v > max) {
          this._integFullErr = { dom, value: el.value, message: this._t("settingsRange", min, max) };
        } else {
          this._integFullErr = null;
          st.draft.charge_full_integrations = { ...(st.draft.charge_full_integrations || {}), [dom]: v };
        }
        this._renderSettings();
        return;
      }
      if (st?.draft && el.tagName === "SELECT" && (el.dataset.cstallInteg || el.dataset.cstopInteg || el.dataset.cliveInteg)) {
        // Eigenes "Ladung beendet nach", eigener Push bei beendeter Ladung bzw. eigene Live-Aktivität einer Integration: "default" = global.
        const key = el.dataset.cstallInteg ? "charge_stall_integrations" : el.dataset.cliveInteg ? "charge_live_integrations" : "charge_stop_integrations";
        const dom = el.dataset.cstallInteg || el.dataset.cstopInteg || el.dataset.cliveInteg;
        const map = { ...(st.draft[key] || {}) };
        if (el.value === "default") delete map[dom];
        else map[dom] = key === "charge_stall_integrations" ? Number(el.value) : el.value === "on";
        st.draft[key] = map;
        this._renderSettings();
        return;
      }
      if (st?.draft && el.tagName === "SELECT" && (el.dataset.cfullInteg || el.dataset.criseInteg)) {
        // Eigenes "Voll ab" bzw. eigener Anstieg einer Integration: "default" = global.
        const key = el.dataset.cfullInteg ? "charge_full_integrations" : "charge_rise_integrations";
        const dom = el.dataset.cfullInteg || el.dataset.criseInteg;
        const map = { ...(st.draft[key] || {}) };
        this._integFullErr = null;
        if (el.value === "default") delete map[dom];
        else if (el.value === "own") map[dom] = Number.isInteger(map[dom]) && !CHARGE_FULL_PRESETS.includes(map[dom]) ? map[dom] : CHARGE_FULL_OWN_START;
        else map[dom] = Number(el.value);
        st.draft[key] = map;
        this._renderSettings();
        return;
      }
      if (st?.draft && el.tagName === "SELECT" && el.dataset.batMode) {
        const dom = el.dataset.batMode;
        const own = { ...(st.draft.battery_low_integrations || {}) };
        const saved = (st.data.values.battery_low_integrations || {})[dom];
        if (el.value === "default") delete own[dom];
        else if (el.value === "off") own[dom] = "off";
        else own[dom] = Number.isInteger(saved) ? saved : Number.isInteger(st.draft.battery_low) ? st.draft.battery_low : st.data.values.battery_low;
        st.draft.battery_low_integrations = own;
        this._renderSettings();
        return;
      }
      if (!st?.draft || el.type !== "checkbox") return;
      if (el.dataset.cinteg) {
        const on = new Set(st.draft.charge_integrations || []);
        if (el.checked) on.add(el.dataset.cinteg);
        else on.delete(el.dataset.cinteg);
        st.draft.charge_integrations = [...on].sort();
      } else if (el.dataset.qdayOn !== undefined) {
        // Ruhezeit: Wochentag ein- oder ausschalten (die Zeiten bleiben erhalten)
        st.draft.quiet_days = (st.draft.quiet_days || []).map((x, i) => (i === Number(el.dataset.qdayOn) ? { ...x, on: el.checked } : x));
        this._renderSettings();
        return;
      } else if (el.dataset.qtopic) {
        const on = new Set(st.draft.quiet_topics || []);
        if (el.checked) on.add(el.dataset.qtopic);
        else on.delete(el.dataset.qtopic);
        st.draft.quiet_topics = QUIET_TOPICS.filter((k) => on.has(k));
      } else if (el.dataset.ukind) {
        const on = new Set(st.draft.updates_kinds || []);
        if (el.checked) on.add(el.dataset.ukind);
        else on.delete(el.dataset.ukind);
        st.draft.updates_kinds = UPDATE_KINDS.filter((k) => on.has(k));
        // Ausnahmen, die jetzt der Art entsprechen, sind überflüssig.
        this._normalizeUpdateItems(st.draft);
      } else if (el.dataset.uitem) {
        // Eintrag umschalten: gleich wie die Art = keine Ausnahme, sonst Ausnahme (Aus oder An).
        const x = (st.data.catalog?.updates || []).find((u) => u.id === el.dataset.uitem);
        const ex = new Set(st.draft.updates_exclude || []);
        const inc = new Set(st.draft.updates_include || []);
        ex.delete(el.dataset.uitem);
        inc.delete(el.dataset.uitem);
        const kindOn = (st.draft.updates_kinds || []).includes(x?.kind);
        if (el.checked !== kindOn) (el.checked ? inc : ex).add(el.dataset.uitem);
        st.draft.updates_exclude = [...ex].sort();
        st.draft.updates_include = [...inc].sort();
      } else if (el.dataset.nfield || el.dataset.bfield || el.dataset.newfield) {
        // Inhalt der Meldung: Liste in fester Reihenfolge.
        const [key, order, field] = el.dataset.nfield
          ? ["notify_fields", NOTIFY_FIELDS, el.dataset.nfield]
          : el.dataset.bfield
            ? ["battery_fields", BATTERY_FIELDS, el.dataset.bfield]
            : ["new_fields", NEW_FIELDS, el.dataset.newfield];
        const on = new Set(st.draft[key] || []);
        if (el.checked) on.add(field);
        else on.delete(field);
        st.draft[key] = order.filter((f) => on.has(f));
      } else if (el.dataset.imon) {
        // "Überwachen" einer Integration = "Ausgefallen nach" nicht "off";
        // wieder ein: Standard (eine eigene Zeit ist mit "off" ersetzt).
        const own = { ...(st.draft.offline_after_integrations || {}) };
        if (el.checked) delete own[el.dataset.imon];
        else own[el.dataset.imon] = "off";
        st.draft.offline_after_integrations = own;
      } else if (el.dataset.startPanel !== undefined) {
        if (st.extra) st.extra.start_panel = el.checked;
      } else if (el.dataset.autoUpdate !== undefined) {
        if (st.extra) st.extra.auto_update = el.checked;
      } else if (el.dataset.opt) st.draft[el.dataset.opt] = el.checked;
      else if (el.dataset.list) {
        // Angezeigt = nicht in der Liste der Ausschlüsse.
        const list = new Set(st.draft[el.dataset.list]);
        if (el.checked) list.delete(el.dataset.value);
        else list.add(el.dataset.value);
        st.draft[el.dataset.list] = [...list].sort();
      } else if (el.dataset.listAll) {
        const key = el.dataset.listAll;
        if (key === "exclude_devices") {
          const listed = new Set(this._hiddenCatalog().map((x) => x.id));
          const keep = (st.draft[key] || []).filter((id) => !listed.has(id));
          st.draft[key] = (el.checked ? keep : [...keep, ...listed]).sort();
          this._renderSettings();
          return;
        }
        if (key === "chips") {
          // Alle Chips der Liste: die übrigen (hide_chips) und die Verbindungsarten (hide_connections).
          st.draft.hide_chips = el.checked ? [] : CHIP_OTHER.map(([k]) => k).sort();
          st.draft.hide_connections = el.checked ? [] : Object.keys(CONN).sort();
          this._renderSettings();
          return;
        }
        const all = key.endsWith("exclude_integrations")
          ? (st.data.catalog?.integrations || []).map((i) => i.domain)
          : this._catalogTypes(st.draft).map((x) => x.type);
        st.draft[key] = el.checked ? [] : [...all].sort();
      } else return;
      this._renderSettings();
    });
    dialog.addEventListener("close", () => {
      if (!dialog.open) this._settings = null;
    });
  }

  // Leichte Aktualisierung während der Eingabe: Zähler, "Speichern",
  // Markierung und Fehlertext der Zahlenfelder, Zusammenfassungen und
  // Etiketten der Abschnitte, ohne Neuaufbau (Fokus und Cursor bleiben).
  _updateSettingsMeta() {
    const dialog = this.shadowRoot.querySelector("dialog.settings");
    const st = this._settings;
    if (!dialog || !st?.draft) return;
    const changes = this._settingsChanges();
    const errors = this._settingsErrors();
    if (changes.length) st.saved = false;
    const count = dialog.querySelector(".set-count");
    if (count) {
      count.textContent = changes.length ? this._t("settingsChanges", changes.length) : st.saved ? this._t("settingsSavedShort") : "";
      count.classList.toggle("saved", !changes.length && Boolean(st.saved));
    }
    const cancel = dialog.querySelector('.dlg-actions [data-set="close"]');
    if (cancel) cancel.innerHTML = `${mdi("close", 18)}${escape(changes.length ? this._t("settingsCancel") : this._t("close"))}`;
    const save = dialog.querySelector('[data-set="save"]');
    if (save) save.disabled = st.saving || !changes.length || Object.keys(errors).length > 0;
    // Batterie pro Integration: Zeilen markieren, Fehlerzeile, globaler Wert als Platzhalter.
    const bad = new Set(this._batInvalid());
    const saved = st.data.values.battery_low_integrations || {};
    const own = st.draft.battery_low_integrations || {};
    const std = errors.battery_low ? st.data.values.battery_low : st.draft.battery_low;
    for (const sel of dialog.querySelectorAll("select[data-bat-mode]")) {
      const dom = sel.dataset.batMode;
      const row = sel.closest(".ex-row, .opt");
      row?.classList.toggle("invalid", bad.has(dom));
      row?.classList.toggle("changed", own[dom] !== saved[dom]);
      const def = sel.querySelector('option[value="default"]');
      if (def) def.textContent = this._t("integBatDefault", std);
    }
    for (const input of dialog.querySelectorAll("input[data-bat]")) input.placeholder = String(std);
    // Empfang-Schwellen pro Funkart: Zeile markieren, Fehlerzeile je Zeile.
    const sigBad = new Set(this._sigInvalid().map((x) => `${x.dom}|${x.conn}`));
    for (const input of dialog.querySelectorAll("input[data-sig]")) {
      const row = input.closest(".opt");
      row?.classList.toggle("invalid", sigBad.has(input.dataset.sig));
      input.closest(".opt-input")?.classList.toggle("bad", sigBad.has(input.dataset.sig));
      const err = row?.querySelector("[data-sig-error]");
      if (err) {
        const [min, max] = input.min !== "" ? [input.min, input.max] : [0, 0];
        err.hidden = !sigBad.has(input.dataset.sig);
        err.textContent = err.hidden ? "" : this._t("settingsRange", min, max);
      }
      const [dom, conn] = input.dataset.sig.split("|");
      const now = dom ? ((st.draft.signal_low_integrations || {})[dom] || {})[conn] : (st.draft.signal_low || {})[conn];
      const was = dom ? ((st.data.values.signal_low_integrations || {})[dom] || {})[conn] : (st.data.values.signal_low || {})[conn];
      row?.classList.toggle("changed", JSON.stringify(now ?? null) !== JSON.stringify(was ?? null));
    }
    const batErr = dialog.querySelector("[data-bat-error]");
    if (batErr) {
      batErr.hidden = !errors.battery_low_integrations;
      batErr.textContent = errors.battery_low_integrations || "";
    }
    // Uhrzeit der Tagesmeldung: Markierung, Fehler und Kurzzeile mit der
    // neuen Zeit, ohne Neuaufbau (Fokus im Zeitfeld bleibt).
    const timeInput = dialog.querySelector('input[type="time"][data-opt]:not([data-opt="update_check_time"])');
    const timeRow = timeInput?.closest(".opt");
    if (timeRow) {
      const key = timeInput.dataset.opt;
      timeInput.closest(".opt-input").classList.toggle("bad", Boolean(errors[key]));
      timeRow.classList.toggle("invalid", Boolean(errors[key]));
      timeRow.classList.toggle("changed", changes.includes(key) || changes.includes("battery_push_mode"));
      const line = timeRow.querySelector("[data-short]");
      if (line) {
        line.className = errors[key] ? "opt-error" : "opt-short";
        line.textContent = errors[key] || this._t("optPushModeShortDaily", st.draft[key]);
      }
    }
    // Uhrzeit der täglichen Prüfung (seit 2.25.0): Markierung, Fehler und "Automatisch"-Knopf nachführen, ohne Neuaufbau
    const checkInput = dialog.querySelector('input[type="time"][data-opt="update_check_time"]');
    if (checkInput) {
      const row = checkInput.closest(".opt");
      checkInput.closest(".opt-input").classList.toggle("bad", Boolean(errors.update_check_time));
      row.classList.toggle("invalid", Boolean(errors.update_check_time));
      row.classList.toggle("changed", changes.includes("update_check_time"));
      const auto = row.querySelector('[data-set="check-time-auto"]');
      if (auto) auto.disabled = checkInput.disabled || !checkInput.value;
    }
    for (const input of dialog.querySelectorAll('input[type="number"][data-opt]')) {
      const key = input.dataset.opt;
      const opt = input.closest(".opt");
      if (!opt) continue;
      opt.classList.toggle("changed", changes.includes(key));
      opt.classList.toggle("invalid", Boolean(errors[key]));
      const line = opt.querySelector("[data-short]");
      if (line) {
        line.className = errors[key] ? "opt-error" : "opt-short";
        line.textContent = errors[key] || line.dataset.short;
      }
    }
    // Zahlenfelder im Zeitstrahl (seit 0.34.0): Markierung, Fehler unter dem
    // Zeitstrahl; "Erst melden nach" zu kurz markiert beide Felder.
    const short = this._delayShort(errors);
    for (const input of dialog.querySelectorAll(".mtl input[data-opt]")) {
      const key = input.dataset.opt;
      const box = input.closest(".opt-input");
      box.classList.toggle("bad", Boolean(errors[key]) || (short && key === "offline_after"));
      box.classList.toggle("chg", changes.includes(key));
    }
    // Länge der Balken folgt den getippten Werten.
    const oa = st.draft.offline_after;
    const nd = st.draft.notify_delay;
    const top = Math.max(Number.isInteger(oa) ? oa : 0, Number.isInteger(nd) ? nd : 0);
    for (const row of dialog.querySelectorAll(".ptl-row[data-ptl]")) row.style.setProperty("--w", `${this._ptlWidth(st.draft[row.dataset.ptl], top)}%`);
    for (const el of dialog.querySelectorAll("[data-tl-error]")) {
      const msg = el.dataset.tlError.split(",").map((k) => errors[k]).find(Boolean);
      el.hidden = !msg;
      el.textContent = msg || "";
    }
    for (const tab of dialog.querySelectorAll(".mon-tab")) {
      const keys = MON_TAB_KEYS[tab.dataset.key] || [];
      const err = keys.some((k) => errors[k]);
      tab.classList.toggle("err", err);
      tab.classList.toggle("chg", !err && keys.some((k) => changes.includes(k)));
    }
    // Nur die Unterreiter mit Gruppe; die Reiter im Detail einer Integration (.lvl-tabs) haben weder Zähler noch Optionsliste.
    for (const tab of dialog.querySelectorAll(".sub-tab[data-group]")) {
      const keys = SUB_TAB_KEYS[tab.dataset.key] || [];
      tab.classList.toggle("chg", keys.some((k) => changes.includes(k)));
      const n = tab.querySelector(".sub-n");
      const count = this._subCount(tab.dataset.key, st.draft);
      n.textContent = count;
      n.hidden = !count;
    }
    for (const [id, keys] of this._settingsSections()) {
      const head = dialog.querySelector(`[data-set="section"][data-id="${id}"]`);
      if (!head) continue;
      head.querySelector(".set-sec-sum").textContent = this._settingsSummary(id, st.draft);
      const title = head.querySelector(".set-sec-title");
      let badge = title.querySelector(".set-badge");
      const changed = keys.some((k) => changes.includes(k));
      if (changed && !badge) {
        badge = document.createElement("span");
        badge.className = "set-badge";
        badge.textContent = this._t("settingsChanged");
        title.appendChild(badge);
      } else if (!changed && badge) badge.remove();
    }
  }

  // MB mit einer Stelle: "0,3", unter 0,1 "< 0,1"
  _fmtMb(bytes) {
    const mb = (bytes || 0) / 1048576;
    if (mb > 0 && mb < 0.1) return `< ${(0.1).toLocaleString(this._locale())}`;
    return mb.toLocaleString(this._locale(), { maximumFractionDigits: 1 });
  }

  // Belegung der Protokolle für das Kapitel "Protokolle" (Panel › Allgemein); ohne Antwort bleibt die Zeile ohne Zahl
  async _loadProtocolUsage(st) {
    try {
      const usage = await this._hass.callWS({ type: "device_panel/protocol_usage" });
      if (this._settings !== st) return;
      st.usage = usage;
      this._renderSettings();
    } catch {
      // nur eine Anzeige: ohne sie fehlt die Zahl
    }
  }

  // Welche Protokolle würden die neuen Grenzen kürzen? (Namen für die Rückfrage vor dem Speichern)
  _protocolCuts() {
    const st = this._settings;
    const u = st?.usage;
    const d = st?.draft;
    if (!u || !d) return [];
    const MB = 1048576;
    const cuts = [];
    if (Number.isInteger(d.protocol_max_mb) && Number.isInteger(d.protocol_max_entries) && (u.protocol.bytes > d.protocol_max_mb * MB || u.protocol.max_item > d.protocol_max_entries)) cuts.push(this._t("cutProto"));
    if (Number.isInteger(d.log_max_mb) && Number.isInteger(d.log_max_entries) && (u.log.bytes > d.log_max_mb * MB || u.log.entries > d.log_max_entries)) cuts.push(this._t("cutLog"));
    return cuts;
  }

  async _saveSettings() {
    const st = this._settings;
    if (!st) return;
    const changes = this._settingsEntryChanges();
    const extra = this._settingsExtraChanges();
    const resets = Object.fromEntries(RESET_KINDS.map((k) => [k, [...st.resets[k]]]));
    const anyReset = Object.values(resets).some((list) => list.length > 0);
    const viewChanged = this._viewChanged();
    if ((!changes.length && !extra.length && !anyReset && !viewChanged) || Object.keys(this._settingsErrors()).length) return;
    // Tiefere Grenzen der Protokolle kürzen sofort und endgültig: erst fragen (die Rückfrage steht im Kapitel "Protokolle")
    if (!st.cutOk && changes.some((k) => ["protocol_max_mb", "protocol_max_entries", "log_max_mb", "log_max_entries"].includes(k)) && this._protocolCuts().length) {
      st.cutAsk = true;
      st.sub = { ...st.sub, panel: "pstart" };
      st.open.add("updates");
      this._renderSettings();
      this.shadowRoot.querySelector("dialog.settings .cut-ask")?.scrollIntoView?.({ block: "center" });
      return;
    }
    st.cutAsk = false;
    st.cutOk = false;
    st.saving = true;
    st.saveError = null;
    this._renderSettings();
    try {
      if (changes.length) {
        const values = Object.fromEntries(changes.map((k) => [k, st.draft[k]]));
        await this._hass.callWS({ type: "device_panel/set_options", values });
      }
      if (extra.includes("prerelease")) {
        const panel = await this._hass.callWS({ type: "device_panel/set_panel", prerelease: st.extra.prerelease });
        this._applyPanelSettings(panel);
      }
      if (extra.includes("auto_update")) {
        const panel = await this._hass.callWS({ type: "device_panel/set_panel", auto_update: st.extra.auto_update });
        this._applyPanelSettings(panel);
      }
      if (extra.includes("start_panel")) await this._saveStartPanel(st.extra.start_panel);
      if (anyReset) await this._hass.callWS({ type: "device_panel/reset_device_settings", ...resets });
      // Ansicht (pro Benutzer): erst jetzt speichern, die Liste zeigt sie schon
      if (viewChanged) {
        this._saveView();
        st.viewBase.snap = this._viewSnap();
      }
      // Erkennung, Batterie-Schwelle, Ausschlüsse und Anzeige ändern die Liste sofort.
      const quiet = ["update_check", "battery_push", "battery_persistent", "notify_service", "notify_click_target"];
      // Zurückgesetzte Geräte: Symbole und Batterie-Markierung in der Liste.
      if (anyReset || changes.some((k) => !quiet.includes(k))) this._fetch(true);
      await this._reloadSettings(st);
    } catch (err) {
      if (this._settings !== st) return;
      st.saving = false;
      st.saveError = errText(err);
      this._renderSettings();
    }
  }

  // Nach dem Speichern: Dialog bleibt offen, mit dem gespeicherten Stand des
  // Backends (bereinigte Werte, Übersicht der Geräte-Einstellungen, Katalog).
  // Aufgeklappte Abschnitte und Infos bleiben.
  async _reloadSettings(st) {
    // Ansicht ohne geladene Optionen (kein Administrator): es gibt nichts nachzuladen
    if (!st.data) {
      st.saving = false;
      st.saved = true;
      this._renderSettings();
      return;
    }
    let data = null;
    try {
      data = await this._hass.callWS({ type: "device_panel/get_options" });
    } catch (err) {
      // Gespeichert ist es; ohne neue Daten gilt der Entwurf als Stand.
      data = { ...st.data, values: { ...st.data.values, ...st.draft } };
    }
    if (this._settings !== st) return;
    st.data = data;
    st.draft = { ...data.values };
    if (data.panel) this._applyPanelSettings(data.panel);
    st.extraBase = this._extraBase();
    st.extra = { ...st.extraBase };
    st.resets = newResets();
    this._loadProtocolUsage(st);
    st.saving = false;
    st.saved = true;
    this._renderSettings();
    window.clearTimeout(this._savedTimer);
    this._savedTimer = window.setTimeout(() => {
      if (this._settings !== st || !st.saved) return;
      st.saved = false;
      this._updateSettingsMeta();
    }, 4000);
  }

  // action: { label, run } zeigt einen Knopf (z. B. "Rückgängig"); der
  // Hinweis bleibt dann länger stehen, damit man ihn erreicht.
  _toast(text, action = null) {
    const el = this.shadowRoot.querySelector(".toast");
    if (!el) return;
    this._toastAction = action;
    el.innerHTML = `<span>${escape(text)}</span>${action ? `<button type="button" class="toast-btn" data-toast-action>${escape(action.label)}</button>` : ""}`;
    el.classList.toggle("act", Boolean(action));
    el.hidden = false;
    window.clearTimeout(this._toastTimer);
    this._toastTimer = window.setTimeout(() => {
      el.hidden = true;
      this._toastAction = null;
    }, action ? 8000 : 3500);
  }

  // --- Versionsprüfung und Update über HACS (wie unifi_dynamic) -------------
  // Die neueste Version kommt von HACS (Update-Entität) und zusätzlich von
  // GitHub (device_panel/version), so klappt die Prüfung auch ohne HACS.
  // Installieren geht nur über HACS (update.install).

  // Update-Entität von HACS für dieses Repository. Erkannt nur am Link des
  // Releases (wie im Backend, update_check.is_repo_url), nie am Titel oder an
  // einer festen Entity-ID.
  _hacsUpdateEntity() {
    const hass = this._hass;
    if (!hass || !hass.entities || !hass.states) return null;
    for (const e of Object.values(hass.entities)) {
      if (!e || e.platform !== "hacs" || !String(e.entity_id).startsWith("update.")) continue;
      const st = hass.states[e.entity_id];
      if (st && REPO_URL_RE.test(String((st.attributes || {}).release_url || "").trim())) return st;
    }
    return null;
  }

  // Versionsvergleich wie im Backend (update_check.compare_versions):
  // 0.10.0 > 0.9.9, und eine Vorabversion (0.4.0b1) liegt unter der
  // fertigen (0.4.0), aber über der vorherigen (0.3.2).
  _versionKey(v) {
    const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?[-.]?(?:(alpha|beta|pre|rc|a|b)\.?(\d*))?/i.exec(String(v || "").trim());
    if (!m) return [0, 0, 0, 3, 0];
    const rank = { a: 0, alpha: 0, b: 1, beta: 1, pre: 1, rc: 2 };
    return [+m[1], +(m[2] || 0), +(m[3] || 0), m[4] ? rank[m[4].toLowerCase()] : 3, +(m[5] || 0)];
  }

  _cmpVersion(a, b) {
    const x = this._versionKey(a);
    const y = this._versionKey(b);
    for (let i = 0; i < 5; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
    return 0;
  }

  _isPrerelease(v) {
    return Boolean(v) && this._versionKey(v)[3] < 3;
  }

  // Vorabversion nach Nummer (0.4.0b1) oder weil GitHub genau diese Version
  // als Pre-Release führt, auch ohne Zusatz in der Nummer.
  _isPreVersion(ver, d) {
    if (!ver) return false;
    if (this._isPrerelease(ver)) return true;
    return Boolean(d && d.prerelease && this._cmpVersion(ver, d.prerelease) === 0 && (!d.latest || this._cmpVersion(ver, d.latest) > 0));
  }

  // Schalter "Pre-release" von HACS für dieses Repository: eine Entität am
  // selben HACS-Gerät wie die Update-Entität. Standardmässig deaktiviert;
  // deaktiviert heisst: nicht in hass.states.
  _hacsPreReleaseSwitch() {
    const hass = this._hass;
    const upd = this._hacsUpdateEntity();
    if (!hass || !hass.entities || !upd) return null;
    const reg = hass.entities[upd.entity_id];
    const deviceId = reg && reg.device_id;
    if (!deviceId) return null;
    const sw = Object.values(hass.entities).find(
      (e) => e && e.platform === "hacs" && e.device_id === deviceId && String(e.entity_id).startsWith("switch.") && /pre.?release/i.test(`${e.entity_id} ${e.translation_key || ""}`)
    );
    // Deaktiviert (Standard bei HACS) fehlt die Entität in hass.entities: dann ist sie aus. Das Panel ändert sie nie (seit 2.99.3):
    // aktivieren und einschalten macht der Benutzer im HACS-Gerät (Link im Hinweis).
    const state = sw ? hass.states[sw.entity_id] : null;
    return { deviceId, entityId: sw ? sw.entity_id : null, on: Boolean(state && state.state === "on") };
  }

  // open: Prüfung beim Öffnen der Einstellungen. Wie auf Knopfdruck frisch bei GitHub (höchstens einmal pro Minute, der Server begrenzt es), aber ohne HACS
  // von sich aus neu zu laden und ohne eine frühere Fehlermeldung der Installation zu verwerfen
  async _loadVersion(force = false, { open = false } = {}) {
    const v = (this._version = this._version || {});
    if (force) {
      v.checking = true;
      // Neue Prüfung auf Knopfdruck: alte Meldungen verwerfen, der neue Stand zählt.
      if (!open) v.installError = null;
    }
    v.error = null;
    this._renderSettingsVersion();
    let fresh = false;
    const jobs = [
      // Vorabversion immer mitabfragen: auch bei ausgeschaltetem Schalter
      // muss das Panel wissen, welche Version GitHub als Pre-Release führt,
      // damit es eine solche von HACS gemeldete Version nicht als stabil
      // anbietet. Angezeigt wird sie nur mit eingeschaltetem Schalter.
      this._hass.callWS({ type: "device_panel/version", force, prerelease: true }).then(
        (r) => {
          v.data = r;
          fresh = true;
          if (!this._settings || !this._settings.extra) this._applyPanelSettings(r && r.panel);
        },
        (err) => (v.error = errText(err))
      ),
    ];
    // HACS prüft sonst nur alle paar Tage: auf Knopfdruck sofort neu laden.
    if (force && !open) jobs.push(this._refreshHacs());
    await Promise.all(jobs);
    // GitHub kennt eine neuere Version als HACS: HACS einmal pro Sitzung
    // auch ohne Knopfdruck nachladen lassen, sonst lässt sie sich nicht über
    // HACS installieren.
    const { hacs, a, latest } = this._versionState();
    // (einmal je neu gefundene Version, auch bei der Prüfung beim Öffnen der Einstellungen)
    if ((!force || open) && hacs && v.hacsRefreshedFor !== latest && latest && (!a.latest_version || this._cmpVersion(latest, a.latest_version) > 0)) {
      v.hacsRefreshedFor = latest;
      // Während HACS nachlädt, nicht zum Klick auf "Nach Updates suchen"
      // auffordern: das Panel erledigt genau das gerade selbst.
      v.hacsSyncing = true;
      this._renderSettingsVersion();
      await this._refreshHacs();
      // Der neue Stand der Update-Entität kommt etwas nach dem Dienstaufruf:
      // kurz darauf warten, höchstens 4 Sekunden.
      const until = Date.now() + 4000;
      while (Date.now() < until) {
        const now = this._versionState().a;
        if (now.latest_version && this._cmpVersion(now.latest_version, latest) >= 0) break;
        await new Promise((r) => setTimeout(r, 250));
      }
      v.hacsSyncing = false;
    }
    v.checking = false;
    // Nach einem Neustart bleibt die Seite offen (HA lädt sie nicht neu): Läuft
    // jetzt eine andere Version, oder kam in 5 Minuten kein Neustart, gilt
    // "startet neu" nicht mehr. Ohne Antwort von HA bleibt es stehen.
    if (v.restarting && fresh && (v.data.installed !== v.restartFrom || Date.now() - v.restartAt > RESTART_WAIT_MS)) {
      v.restarting = false;
      v.restartFrom = null;
    }
    if (v.data && v.data.error && !v.data.latest && !v.data.prerelease) v.error = v.data.error;
    this._renderSettingsVersion();
    this._gearDot(true);
    // Automatisch installieren (seit 2.22.0, ab 2.23.0 bei jeder Erkennung): sobald eine neuere Version gefunden wird (Öffnen der
    // Einstellungen oder "Nach Updates suchen"), wird sie installiert, ohne "Aktualisieren". Nur mit der täglichen Prüfung; der
    // Neustart bleibt Sache des Benutzers. Ohne Knopfdruck pro Version nur ein Versuch je Sitzung (kein Dauerlauf bei Fehlern).
    if (this._autoActive()) {
      const s = this._versionState();
      if (s.canInstall && !s.inProgress && !v.installing && !s.restart && (force || v.autoTried !== s.latest)) {
        v.autoTried = s.latest;
        await this._versionAction("install");
      }
    }
  }

  // Automatisch installieren gilt nur, solange die tägliche Prüfung eingeschaltet ist (gespeicherter Stand).
  _autoActive() {
    return Boolean(this._autoUpdate) && this._settings?.data?.values?.update_check !== false;
  }

  // Dienst über WebSocket statt hass.callService: der zeigt bei einem
  // Fehler zusätzlich eine eigene Meldung, hier steht der Fehler in der Zeile.
  _callService(domain, service, data) {
    return this._hass.callWS({ type: "call_service", domain, service, service_data: data });
  }

  // HACS die Versionen des Repositories neu laden lassen (wie sein Menüpunkt
  // "Informationen aktualisieren"), dann die Update-Entität. Alles
  // bestmöglich: fehlt ein Befehl in einer HACS-Version, bleibt es beim
  // Aktualisieren der Entität.
  async _refreshHacs() {
    const hacs = this._hacsUpdateEntity();
    if (!hacs) return;
    try {
      const repos = await this._hass.callWS({ type: "hacs/repositories/list" });
      const list = Array.isArray(repos) ? repos : (repos && repos.repositories) || [];
      const repo = list.find((r) => String(r.full_name || "").toLowerCase() === REPO);
      if (repo) await this._hass.callWS({ type: "hacs/repository/refresh", repository: String(repo.id) });
    } catch (err) {
      // Älteres oder neueres HACS ohne diese Befehle.
    }
    try {
      await this._callService("homeassistant", "update_entity", { entity_id: hacs.entity_id });
    } catch (err) {
      // Nicht kritisch: dann gilt der bisherige Stand von HACS.
    }
  }

  _versionState() {
    const v = this._version || {};
    const d = v.data || {};
    const hacs = this._hacsUpdateEntity();
    const a = (hacs && hacs.attributes) || {};
    const installed = d.installed || a.installed_version || null;
    let latest = d.latest || null;
    let url = d.release_url || null;
    // Vorabversion nur auf Wunsch und nur, wenn sie neuer ist.
    if (this._prerelease && d.prerelease && (!latest || this._cmpVersion(d.prerelease, latest) > 0)) {
      latest = d.prerelease;
      url = d.prerelease_url || url;
    }
    // HACS kennt eine Vorabversion nur mit eingeschaltetem "Pre-release";
    // ohne unseren Schalter keine Vorabversion von HACS übernehmen.
    if (a.latest_version && (!latest || this._cmpVersion(a.latest_version, latest) >= 0) && (this._prerelease || !this._isPreVersion(a.latest_version, d))) {
      latest = a.latest_version;
      url = a.release_url || url;
    }
    const beta = this._isPreVersion(latest, d);
    const preSwitch = beta && hacs ? this._hacsPreReleaseSwitch() : null;
    const inProgress = Boolean(hacs && (a.in_progress === true || typeof a.in_progress === "number"));
    // HACS hat eine neuere Version auf die Platte gelegt, als gerade läuft.
    const restart = Boolean(hacs && a.installed_version && installed && this._cmpVersion(a.installed_version, installed) > 0);
    // Installierbar nur, was HACS selbst als neueste Version kennt.
    let canInstall = Boolean(hacs && a.latest_version && installed && this._cmpVersion(a.latest_version, installed) > 0);
    // Beta ohne "Pre-release" in HACS: HACS würde die stabile Version (oder
    // gar nichts) installieren, deshalb sperren und erklären.
    const betaBlocked = Boolean(beta && hacs && (!preSwitch || !preSwitch.on));
    if (betaBlocked) canInstall = false;
    return { v, d, hacs, a, installed, latest, url, inProgress, restart, canInstall, beta, betaBlocked, preSwitch };
  }

  _versionHtml() {
    const state = this._versionState();
    if (!state.installed && !state.v.data && !state.v.error) return "";
    return this._versionRowHtml(state) + this._prereleaseOptHtml();
  }

  // Schalter "Vorabversionen anzeigen" unter dem Versionskasten (ganze Instanz).
  _prereleaseOptHtml() {
    const st = this._settings;
    const on = st && st.extra ? Boolean(st.extra.prerelease) : Boolean(this._prerelease);
    const changed = st && st.extra && st.extra.prerelease !== st.extraBase.prerelease;
    return `<div class="ver-opt">
        <div><div class="ver-opt-l">${escape(this._t("verPreToggle"))}${changed ? `<span class="set-badge">${escape(this._t("settingsChanged"))}</span>` : ""}</div><div class="ver-opt-d">${escape(this._t("verPreToggleShort"))}</div></div>
        <button type="button" class="sw-btn beta${on ? " on" : ""}" role="switch" aria-checked="${on}" data-ver="prerelease" aria-label="${escape(this._t("verPreToggle"))}" ${st && st.extra ? "" : "disabled"}><span></span></button></div>`;
  }

  _formatRelative(epoch) {
    if (!epoch) return "";
    const diff = epoch - Date.now() / 1000;
    const abs = Math.abs(diff);
    try {
      const rtf = new Intl.RelativeTimeFormat(this._locale(), { numeric: "auto" });
      for (const [unit, secs] of [["day", 86400], ["hour", 3600], ["minute", 60]]) {
        if (abs >= secs) return rtf.format(Math.round(diff / secs), unit);
      }
      return rtf.format(0, "minute");
    } catch (err) {
      return "";
    }
  }

  _versionRowHtml({ v, d, hacs, a, installed, latest, url, inProgress, restart, canInstall, beta, betaBlocked, preSwitch }) {
    const t = (k, ...x) => this._t(k, ...x);
    // Automatisch installieren ist wirklich aktiv (Schalter und tägliche Prüfung, gespeicherter Stand): bei "Aktuell" die Pille "Auto" hinter
    // dem Titel, wie die Pille "Beta" (2.38.0, docs/mockups/autoupdate-v1, Variante B; zuerst als Abzeichen mit kreisendem Ring, das war dem
    // Nutzer zu unruhig und es drehte sich auf seinem Gerät nicht). Ein gefundenes Update wird bei aktivem Auto-Update sofort installiert;
    // die Zeile "Update verfügbar" bleibt deshalb ohne Zeichen.
    const auto = this._autoActive();
    const autoMark = () => `<span class="ver-auto" role="img" title="${escape(t("verAutoOn"))}" aria-label="${escape(t("verAutoOn"))}">${mdi("refreshAuto", 12)}${escape(t("verAutoTag"))}</span>`;
    const row = (cls, iconName, title, sub, right, mark = "") => `<div class="ver ${cls}${mark ? " auto" : ""}">
        <span class="ver-ic">${mdi(iconName, 20)}</span>
        <div class="ver-t"><b>${escape(title)}${mark}</b><small>${escape(sub)}</small></div>
        ${right ? `<div class="ver-btns">${right}</div>` : ""}</div>`;
    // Release Notes im Fenster (seit 2.3.0); ohne die neueste Version nichts zu zeigen.
    const notes = latest && installed && this._cmpVersion(latest, installed) > 0 ? `<button type="button" class="ver-link" data-ver="notes">${escape(t("verReleaseNotes"))}${mdi("info", 15)}</button>` : "";
    if (v.restarting) return row("rst", "reset", t("verRestarting"), t("verRestartSub"), "");
    if (restart) {
      return row("rst", "reset", t("verRestartNeeded", a.installed_version), v.restartError ? `${t("verRestartError")} ${v.restartError}` : t("verRestartSub"),
        `<button type="button" class="ver-btn warn" data-ver="restart">${mdi("reset", 16)}${escape(t("verRestart"))}</button>`);
    }
    if (inProgress || v.installing) {
      return `<div class="ver upd"><span class="ver-ic">${mdi("verUp", 20)}</span>
          <div class="ver-t"><b>${escape(t("verInstalling", v.installing || latest))}</b><small>${escape(t("verInstallingSub"))}</small></div>
          <div class="ver-prog"><i></i></div></div>`;
    }
    if (latest && installed && this._cmpVersion(latest, installed) > 0) {
      const sub = v.installError
        ? `${t("verInstallError")} ${v.installError}`
        : beta && betaBlocked
          ? `${t("verInstalled", installed)} · ${t("verPreShort")}`
          : !hacs
            ? `${t("verInstalledVia", installed, false)} · ${t("verNoHacs")}`
            : canInstall
              ? t("verInstalledVia", installed, true)
              : v.hacsSyncing
                ? `${t("verInstalledVia", installed, true)} · ${t("verHacsSyncing")}`
                : `${t("verInstalledVia", installed, true)} · ${t("verHacsPending")}`;
      // Erneut prüfen geht immer: neben "Aktualisieren" als kompakter
      // Symbolknopf, sonst mit Beschriftung.
      const busy = v.checking || v.hacsSyncing ? `disabled aria-busy="true"` : "";
      const spinOrIcon = v.checking || v.hacsSyncing ? `<span class="ver-spin"></span>` : mdi("verCheck", 16);
      const checkBtn = canInstall || betaBlocked
        ? `<button type="button" class="ver-btn icon" data-ver="check" ${busy} title="${escape(t("verCheck"))}" aria-label="${escape(t("verCheck"))}">${spinOrIcon}</button>`
        : `<button type="button" class="ver-btn" data-ver="check" ${busy}>${spinOrIcon}${escape(t("verCheck"))}</button>`;
      const installBtn = canInstall
        ? `<button type="button" class="ver-btn primary" data-ver="install">${mdi("verDownload", 16)}${escape(t("verUpdate"))}</button>`
        : betaBlocked
          ? `<button type="button" class="ver-btn primary" disabled>${mdi("verDownload", 16)}${escape(t("verUpdate"))}</button>`
          : "";
      const hint = betaBlocked
        ? `<div class="ver-hint">${escape(t("verPreHint"))}<div class="ver-hint-acts">${preSwitch && preSwitch.deviceId ? `<button type="button" class="ver-hint-link" data-ver="hacs-device" data-device-id="${escape(preSwitch.deviceId)}">${escape(t("verPreHintLink"))}</button>` : ""}</div></div>`
        : "";
      const html = row(beta ? "upd beta" : "upd", beta ? "flask" : "verUp", t("verAvailable", latest), sub, `${notes}${checkBtn}${installBtn}`);
      // Etikett "Beta" in den Titel, Hinweis in den Kasten.
      return beta ? html.replace("</b>", ` <span class="ver-tag">${escape(t("verBeta"))}</span></b>`).replace(/<\/div>\s*$/, `${hint}</div>`) : html;
    }
    // Auch ohne Update: die Release Notes der installierten Version (seit 2.4.0).
    const currentNotes = installed ? `<button type="button" class="ver-link" data-ver="notes">${escape(t("verReleaseNotes"))}${mdi("info", 15)}</button>` : "";
    const checked = d.checked_at ? t("verChecked", this._formatRelative(d.checked_at)) : "";
    const err = v.error === "rate_limit" ? t("verRateLimit") : v.error;
    const sub = v.checking ? t("verCheckingSub") : v.error ? `${t("verCheckError")} ${err}` : [t("verCurrent"), checked].filter(Boolean).join(" · ");
    // Beschriftung bleibt während der Prüfung gleich, nur das Symbol wird
    // zum Spinner: so springt die Zeile nicht (Höhe des Blatts auf dem Handy).
    // Fehlgeschlagene Prüfung nicht mit Häkchen ("aktuell") darstellen.
    const failed = Boolean(v.error && !v.checking);
    return row(failed ? "err" : "ok", failed ? "alert" : "verOk", t("verName", installed || "?"), sub,
      `${currentNotes}<button type="button" class="ver-btn" data-ver="check" ${v.checking ? `disabled aria-busy="true" title="${escape(t("verChecking"))}"` : ""}>${v.checking ? `<span class="ver-spin"></span>` : mdi("verCheck", 16)}${escape(t("verCheck"))}</button>`, auto && !failed ? autoMark() : "");
  }

  _renderSettingsVersion() {
    const slot = this.shadowRoot.querySelector("dialog.settings .ver-slot");
    if (slot) setHtml(slot, this._versionHtml());
  }

  async _versionAction(action) {
    const v = (this._version = this._version || {});
    if (action === "prerelease") {
      // Nur Entwurf: gilt nach "Speichern" für die ganze Instanz.
      const st = this._settings;
      if (!st || !st.extra) return;
      st.extra.prerelease = !st.extra.prerelease;
      this._renderSettings();
    } else if (action === "notes") {
      this._openNotes();
    } else if (action === "hacs-device") {
      const sw = this._hacsPreReleaseSwitch();
      if (sw && sw.deviceId) {
        this._requestCloseSettings(() => this._navigate(`/config/devices/device/${sw.deviceId}`));
      }
    } else if (action === "check") {
      await this._loadVersion(true);
    } else if (action === "install") {
      const { hacs, a, canInstall } = this._versionState();
      if (!hacs || !canInstall || v.installing) return;
      // Ohne Versionsangabe: HACS installiert seine neueste bekannte Version.
      v.installing = a.latest_version;
      v.installError = null;
      this._renderSettingsVersion();
      try {
        await this._callService("update", "install", { entity_id: hacs.entity_id });
      } catch (err) {
        v.installError = errText(err);
      }
      v.installing = null;
      this._renderSettingsVersion();
    } else if (action === "restart") {
      if (!window.confirm(this._t("verRestartConfirm"))) return;
      v.restarting = true;
      v.restartError = null;
      v.restartFrom = this._versionState().installed;
      v.restartAt = Date.now();
      this._renderSettingsVersion();
      try {
        await this._callService("homeassistant", "restart", {});
      } catch (err) {
        // Die Verbindung bricht beim Neustart ab; ein Verbindungsfehler ist normal.
        // Lehnt HA den Neustart ab (z. B. ungültige Konfiguration), steht der
        // Fehler in der Zeile und der Knopf bleibt.
        if (!isConnectionError(err)) {
          v.restarting = false;
          v.restartError = errText(err);
          this._renderSettingsVersion();
        }
      }
    }
  }

}

customElements.define("device-panel", DevicePanel);
