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
const [{ STRINGS, pickLang }, { PANEL_CSS }] = await Promise.all([
  import(`./strings.js${MODULE_VERSION}`),
  import(`./styles.js${MODULE_VERSION}`),
]);

const POLL_INTERVAL_MS = 10000;
// Dauer-Anzeigen laufen weiter, ohne dafür neu abzufragen.
const TICK_MS = 30000;
const NARROW_QUERY = "(max-width: 600px)";
// Ansicht pro Benutzer (docs/mockups/view-v1): Sortierung, Gruppen oder
// Liste, Spalten (Desktop) bzw. Angaben auf der Karte (Handy) und die
// Filter-Chips, getrennt für Desktop und Handy (schmal). Gespeichert in HA
// (frontend/set_user_data), lokale Kopie in localStorage; beim Laden gewinnt
// der neuere Stand (wie unifi_dynamic). Der Suchtext gilt nur, solange das
// Panel offen ist.
const VIEW_KEY = "device_panel_view";
const VIEW_SAVE_DELAY_MS = 400;
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
const WEAK_LQI = 60;
// Matter: Funkart (Thread/WLAN/LAN) ändert sich praktisch nie.
const MATTER_REFRESH_MS = 3600000;
// Popup: Entitäten und Kurzstatistik höchstens 30 s alt, Verlauf 60 s.
const DETAIL_MAX_AGE_MS = 30000;
const HISTORY_MAX_AGE_MS = 60000;
const RANGES = ["24h", "7d", "30d"];
// Kaum Daten im Zeitraum (neu installiert): Zeitstrahl erst ab dem ersten
// Datenpunkt, sonst wäre er fast ganz schraffiert (wie unifi_dynamic).
const ZOOM_SHARE = 0.1;
const OUTAGE_LIST_MAX = 10;
// Repository für den Abgleich mit HACS (Update-Entität, Repository-Liste).
const REPO = "diegofuego871/ha-device-panel";

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
}

// Für Text und Attribute: auch Anführungszeichen, sonst bricht ein Wert mit
// " das Attribut ab (abgeschnittene Texte, eingeschleuste Attribute).
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function escape(value) {
  return (value == null ? "" : String(value)).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

// --- Symbole (Material Design Icons als Pfad, Funkarten als Strichzeichnung)
const MDI = {
  search: "M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z",
  wifi: "M12,21L15.6,16.2C14.6,15.45 13.35,15 12,15C10.65,15 9.4,15.45 8.4,16.2L12,21M12,3C7.95,3 4.21,4.34 1.2,6.6L3,9C5.5,7.12 8.62,6 12,6C15.38,6 18.5,7.12 21,9L22.8,6.6C19.79,4.34 16.05,3 12,3M12,9C9.3,9 6.81,9.89 4.8,11.4L6.6,13.8C8.1,12.67 9.97,12 12,12C14.03,12 15.9,12.67 17.4,13.8L19.2,11.4C17.19,9.89 14.7,9 12,9Z",
  ble: "M14.88,16.29L13,18.17V14.41M13,5.83L14.88,7.71L13,9.58M17.71,7.71L12,2H11V9.58L6.41,5L5,6.41L10.59,12L5,17.58L6.41,19L11,14.41V22H12L17.71,16.29L13.41,12L17.71,7.71Z",
  cloud: "M6.5,20Q4.22,20 2.61,18.43 1,16.85 1,14.58 1,12.63 2.17,11.1 3.35,9.57 5.25,9.15 5.88,6.85 7.75,5.43 9.63,4 12,4 14.93,4 16.96,6.04 19,8.07 19,11 20.73,11.2 21.86,12.5 23,13.78 23,15.5 23,17.38 21.69,18.69 20.38,20 18.5,20Z",
  lan: "M7,15H9V18H11V15H13V18H15V15H17V18H18V9H15V6H9V9H6V18H7V15M4.38,3H19.63C20.94,3 22,4.06 22,5.38V19.63A2.37,2.37 0 0,1 19.63,22H4.38C3.06,22 2,20.94 2,19.63V5.38C2,4.06 3.06,3 4.38,3Z",
  battery: "M16,20H8V6H16M16.67,4H15V2H9V4H7.33A1.33,1.33 0 0,0 6,5.33V20.67C6,21.4 6.6,22 7.33,22H16.67A1.33,1.33 0 0,0 18,20.67V5.33C18,4.6 17.4,4 16.67,4Z",
  signal: "M3,21H6V18H3M8,21H11V14H8M13,21H16V9H13M18,21H21V3H18V21Z",
  update: "M21,10.12H14.22L16.96,7.3C14.23,4.6 9.81,4.5 7.08,7.2C4.35,9.91 4.35,14.28 7.08,17C9.81,19.7 14.23,19.7 16.96,17C18.32,15.65 19,14.08 19,12.1H21C21,14.08 20.12,16.65 18.36,18.39C14.85,21.87 9.15,21.87 5.64,18.39C2.14,14.92 2.11,9.28 5.62,5.81C9.13,2.34 14.76,2.34 18.27,5.81L21,3V10.12M12.5,8V12.25L16,14.33L15.28,15.54L11,13V8H12.5Z",
  alert: "M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z",
  close: "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
  gear: "M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z",
  verOk: "M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z",
  verUp: "M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M12 7L17 12H14V16H10V12H7L12 7Z",
  verCheck: "M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z",
  verDownload: "M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z",
  flask: "M5,19A1,1 0 0,0 6,20H18A1,1 0 0,0 19,19C19,18.79 18.93,18.59 18.82,18.43L13,8.35V4H11V8.35L5.18,18.43C5.07,18.59 5,18.79 5,19M6,22A3,3 0 0,1 3,19C3,18.4 3.18,17.84 3.5,17.37L9,7.81V6A1,1 0 0,1 8,5V4A2,2 0 0,1 10,2H14A2,2 0 0,1 16,4V5A1,1 0 0,1 15,6V7.81L20.5,17.37C20.82,17.84 21,18.4 21,19A3,3 0 0,1 18,22H6M13,16L14.34,14.66L16.27,18H7.73L10.39,13.39L13,16M12.5,12A0.5,0.5 0 0,1 13,12.5A0.5,0.5 0 0,1 12.5,13A0.5,0.5 0 0,1 12,12.5A0.5,0.5 0 0,1 12.5,12Z",
  reset: "M12,4C14.1,4 16.1,4.8 17.6,6.3C20.7,9.4 20.7,14.5 17.6,17.6C15.8,19.5 13.3,20.2 10.9,19.9L11.4,17.9C13.1,18.1 14.9,17.5 16.2,16.2C18.5,13.9 18.5,10.1 16.2,7.7C15.1,6.6 13.5,6 12,6V10.6L7,5.6L12,0.6V4M6.3,17.6C3.7,15 3.3,11 5.1,7.9L6.6,9.4C5.5,11.6 5.9,14.4 7.8,16.2C8.3,16.7 8.9,17.1 9.6,17.4L9,19.4C8,19 7.1,18.4 6.3,17.6Z",
  info: "M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z",
  cols: "M16,5V18H21V5M4,18H9V5H4M10,18H15V5H10V18Z",
  sort: "M9,3L5,7H8V14H10V7H13M16,17V10H14V17H11L15,21L19,17H16Z",
  arrowUp: "M13,20H11V8L5.5,13.5L4.08,12.08L12,4.16L19.92,12.08L18.5,13.5L13,8V20Z",
  arrowDown: "M11,4H13V16L18.5,10.5L19.92,11.92L12,19.84L4.08,11.92L5.5,10.5L11,16V4Z",
  check: "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z",
  drag: "M9,3H11V5H9V3M13,3H15V5H13V3M9,7H11V9H9V7M13,7H15V9H13V7M9,11H11V13H9V11M13,11H15V13H13V11M9,15H11V17H9V15M13,15H15V17H13V15M9,19H11V21H9V19M13,19H15V21H13V19Z",
  tune: "M8 13C6.14 13 4.59 14.28 4.14 16H2V18H4.14C4.59 19.72 6.14 21 8 21S11.41 19.72 11.86 18H22V16H11.86C11.41 14.28 9.86 13 8 13M8 19C6.9 19 6 18.1 6 17C6 15.9 6.9 15 8 15S10 15.9 10 17C10 18.1 9.1 19 8 19M19.86 6C19.41 4.28 17.86 3 16 3S12.59 4.28 12.14 6H2V8H12.14C12.59 9.72 14.14 11 16 11S19.41 9.72 19.86 8H22V6H19.86M16 9C14.9 9 14 8.1 14 7C14 5.9 14.9 5 16 5S18 5.9 18 7C18 8.1 17.1 9 16 9Z",
  bellOff: "M20.84,22.73L18.11,20H3V19L5,17V11C5,9.86 5.29,8.73 5.83,7.72L1.11,3L2.39,1.73L22.11,21.46L20.84,22.73M19,15.8V11C19,7.9 16.97,5.17 14,4.29C14,4.19 14,4.1 14,4A2,2 0 0,0 12,2A2,2 0 0,0 10,4C10,4.1 10,4.19 10,4.29C9.39,4.47 8.8,4.74 8.26,5.09L19,15.8M12,23A2,2 0 0,0 14,21H10A2,2 0 0,0 12,23Z",
  batteryOff: "M22.11 21.46L2.39 1.73L1.11 3L6 7.89V20.67C6 21.4 6.6 22 7.33 22H16.67C17.4 22 18 21.4 18 20.67V19.89L20.84 22.73L22.11 21.46M16 18H8V9.89L16 17.89V18M8.2 4H9V2H15V4H16.67C17.4 4 18 4.6 18 5.33V15.8L16 13.8V6H10.2L8.2 4Z",
  chevronDown: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  open: "M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z",
  chevron: "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z",
  pulse: "M3,13H5.79L10.1,4.79L11.28,13.75L14.5,9.66L17.83,13H21V15H17L14.67,12.67L9.92,18.73L8.94,11.31L7,15H3V13Z",
};
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
const TYPE_ORDER = ["hub", "phone", "network", "climate", "lock", "cover", "valve", "vacuum", "camera", "alarm", "media", "fan", "light", "outlet", "switch", "motion", "contact", "safety", "energy", "sensor", "button", "other"];
const mdiPath = (d, size) =>
  `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
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
// Wählbar von Hand (Popup): alle ausser "unbekannt" (Fall ohne Erkennung).
const CONN_MANUAL = Object.keys(CONN).filter((k) => k !== "unknown");

const LOGO = `<svg width="30" height="30" viewBox="22 22 212 212" aria-hidden="true"><defs><linearGradient id="dpg" x1="28" y1="20" x2="228" y2="236" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7ADFFD"/><stop offset=".5" stop-color="#22A9F9"/><stop offset="1" stop-color="#1C7DF9"/></linearGradient></defs><path d="M60 44 H112 A84 84 0 0 1 112 212 H60 Z" fill="none" stroke="url(#dpg)" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/><path d="M86 128 H104 L118 94 L136 164 L150 128 H168" fill="none" stroke="url(#dpg)" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
// Kleines Logo für die Vorschau einer Push-Meldung.
const LOGO_SMALL = LOGO.replace('width="30" height="30"', 'width="14" height="14"').replaceAll("dpg", "dpgs");
// Inhalt einer Ausfall-Meldung in fester Reihenfolge (wie const.NOTIFY_FIELDS).
const NOTIFY_FIELDS = ["area", "integration", "connection", "since", "signal", "battery", "model"];

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
const isWeak = (sig) => sigLevel(sig) === 1;
// Empfang zum Sortieren: Stufe, dann Wert (dBm und LQI je in ihrem Bereich).
const sigRank = (sig) => {
  const level = sigLevel(sig);
  return level ? level * 1000 + (sig.kind === "dbm" ? sig.value + 200 : sig.value) : null;
};
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
const hasOverride = (d) => d.battery_setting != null || Boolean(d.notify_off) || Boolean(d.connection_manual);

const defaultView = () => ({
  sort: "default",
  dir: "asc",
  flat: false,
  cols: COLUMNS.map(([k, , on]) => [k, on]),
  fields: CARD_FIELDS.map(([k, , on]) => [k, on]),
  conn: "all",
  problems: false,
  hint: null,
});

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
    hint: HINTS.some((h) => h.key === raw.hint) ? raw.hint : null,
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
  { key: "battery", cls: "b", icon: "battery", label: "hintBattery", test: (d) => Boolean(d.battery?.low) },
  { key: "signal", cls: "s", icon: "signal", label: "hintSignal", test: (d) => isWeak(d.signal) },
  { key: "update", cls: "u", icon: "update", label: "hintUpdate", test: (d) => Boolean(d.update) },
  { key: "override", cls: "o", icon: "tune", label: "hintOverride", test: hasOverride },
];

class DevicePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._devices = [];
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
    this._colsOpen = false;
    this._matter = new Map();
    this._flakyOutages = 3;
    // Chips der Verbindungsart, die nicht erscheinen (Einstellung "Anzeige").
    this._hideConn = new Set();
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
    this._prereleaseHacs = null;
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

  get _hint() {
    return this._view.hint;
  }

  set _hint(value) {
    this._view.hint = value;
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
    if (first) {
      this._build();
      this._loadUserView();
      this._fetch();
    } else if (this._settings) {
      // HACS meldet Fortschritt und neue Versionen über seine Update-Entität.
      this._renderSettingsVersion();
    }
  }

  connectedCallback() {
    this._timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") this._fetch();
    }, POLL_INTERVAL_MS);
    this._tick = window.setInterval(() => this._hass && this._render(), TICK_MS);
    this._onVisible = () => document.visibilityState === "visible" && this._fetch();
    document.addEventListener("visibilitychange", this._onVisible);
    // Wechsel zwischen Desktop und Handy: andere Ansicht, offene Auswahl zu.
    this._onNarrow = () => {
      this._toggleCols(false);
      this._closeViewSheet();
      this._render();
    };
    this._narrowQuery.addEventListener("change", this._onNarrow);
    // Tipp auf eine Meldung, während das Panel schon offen ist: HA ändert
    // nur die Adresse, das iframe bleibt.
    this._onLocation = () => this._deepLink();
    this._topWindow()?.addEventListener("location-changed", this._onLocation);
  }

  disconnectedCallback() {
    window.clearInterval(this._timer);
    window.clearInterval(this._tick);
    document.removeEventListener("visibilitychange", this._onVisible);
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
    if (!id) return;
    url.searchParams.delete("device");
    top.history.replaceState(top.history.state, "", url.pathname + url.search + url.hash);
    this._openDevice(id);
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
      <div class="toolbar">${LOGO}<h1>${escape(this._t("title"))}</h1>
        <label class="searchbox">${mdi("search", 20)}<input class="search" type="search" placeholder="${escape(this._t("search"))}" aria-label="${escape(this._t("search"))}">
          <button type="button" class="search-clear" title="${escape(this._t("searchClear"))}" aria-label="${escape(this._t("searchClear"))}" hidden>${mdi("close", 18)}</button></label>
        <button type="button" class="view-btn" aria-expanded="false" title="${escape(this._t("viewBtn"))}" aria-label="${escape(this._t("viewBtn"))}">${mdi("cols", 20)}<span>${escape(this._t("viewBtn"))}</span></button>
        <button type="button" class="gear-btn" title="${escape(this._t("settingsBtn"))}" aria-label="${escape(this._t("settingsBtn"))}">${mdi("gear", 22)}</button>
      </div>
      <div class="cols-pop" role="dialog" aria-label="${escape(this._t("viewBtn"))}" hidden></div>
      <div class="content"><div class="hero"></div><div class="chips"></div><div class="viewline"></div><div class="list"></div><div class="foot"></div></div>
      <dialog class="device"></dialog><dialog class="stat-dlg"></dialog><dialog class="settings"></dialog><dialog class="view"></dialog>
      <div class="toast" role="status" aria-live="polite" hidden></div>`;
    const root = this.shadowRoot;
    root.querySelector(".gear-btn").addEventListener("click", () => this._openSettings());
    this._bindSettings(root.querySelector("dialog.settings"));
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
      const flat = ev.target.closest("[data-flat]");
      if (flat) {
        this._setView({ flat: flat.dataset.flat === "1" });
        return;
      }
      if (ev.target.closest("[data-view-open]")) {
        this._openViewSheet();
        return;
      }
      const el = ev.target.closest("[data-conn],[data-problems],[data-hint]");
      if (!el || el.disabled) return;
      // Aktiven Chip erneut antippen hebt den Filter auf.
      if (el.dataset.conn) this._conn = this._conn === el.dataset.conn ? "all" : el.dataset.conn;
      else if (el.dataset.problems !== undefined) this._problems = !this._problems;
      else if (el.dataset.hint) this._hint = this._hint === el.dataset.hint ? null : el.dataset.hint;
      this._saveView();
      this._render();
    });
    root.querySelector(".view-btn").addEventListener("click", () => {
      if (this._narrowQuery.matches) this._openViewSheet();
      else this._toggleCols(!this._colsOpen);
    });
    this._bindViewControls(root.querySelector(".cols-pop"), root.querySelector("dialog.view"));
    // Zeilen und Karten sind keine Buttons (Tabellensemantik); Tastatur
    // deshalb selbst behandeln.
    content.addEventListener("keydown", (ev) => {
      if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches?.("[data-open]:not(button)")) {
        ev.preventDefault();
        this._openDevice(ev.target.dataset.open);
      }
    });
    const dlg = root.querySelector("dialog.device");
    dlg.addEventListener("click", (ev) => this._onDeviceClick(ev));
    dlg.addEventListener("keydown", (ev) => {
      if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches?.("li[data-dlg]")) {
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
      } else if (el.matches?.('input[data-dlg="dev-bat-pct"]')) {
        const v = Number(el.value);
        const [min, max] = [5, 50];
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
      } else if (el.matches?.('select[data-dlg="dev-notify"]') && el.value !== "mute") this._setDeviceSettings(this._detailId, { notify: el.value !== "off" });
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
      const result = await this._hass.callWS({ type: "device_panel/list_devices" });
      if (stale()) return;
      // Welche Geräte gezeigt werden (Dienst-Geräte, deaktivierte, Ausschlüsse),
      // entscheidet das Backend nach den Einstellungen.
      this._devices = result.devices || [];
      this._integrations = result.integrations || {};
      this._flakyOutages = result.flaky_outages || 3;
      this._batteryLow = result.battery_low;
      this._hideConn = new Set(result.hide_connections || []);
      this._connOrder = result.connection_order || [];
      // Ausgeblendeter Chip mit aktivem Filter: zurück auf "Alle", sonst
      // bliebe ein Filter ohne sichtbaren Chip.
      if (this._hideConn.has(this._conn)) this._conn = "all";
      this._pulse = Array.isArray(result.pulse) ? result.pulse : null;
      this._incidents = result.incidents || [];
      const serverNow = Date.parse(result.now);
      this._offset = Number.isFinite(serverNow) ? serverNow - Date.now() : 0;
      this._serverNow = (Number.isFinite(serverNow) ? serverNow : Date.now()) / 1000;
      this._fetchedAt = new Date();
      this._error = null;
      this._deepPending = true;
    } catch (err) {
      if (!stale()) this._error = (err && err.message) || String(err);
    } finally {
      this._fetching = false;
      if (stale()) this._fetch();
      else this._fetched();
    }
  }

  _fetched() {
    this._loading = false;
    this._render();
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
        try {
          const diag = await this._hass.callWS({ type: "matter/node_diagnostics", device_id: d.id });
          type = MATTER_TYPES[String(diag?.network_type ?? "").toLowerCase()] || "matter";
        } catch (err) {
          // Gerät nicht erreichbar oder Matter-Server weg: Funkart bleibt offen.
        }
        if (cached?.type !== type) changed = true;
        this._matter.set(d.id, { type, at: Date.now() });
      }
    } finally {
      this._refining = false;
    }
    if (changed) this._render();
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
  _fmtTime(sec, withDate = false) {
    const opts = withDate
      ? { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }
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

  _matches(d) {
    return this._connPass(d) && this._problemPass(d) && this._hintPass(d, this._hint) && this._searchPass(d);
  }

  // Einzelne Filter: Die Zahl auf einem Chip zählt mit allen übrigen Filtern
  // (auch der Suche), also so viele Zeilen, wie nach dem Antippen erscheinen.
  _connPass(d) {
    return this._conn === "all" || this._connOf(d) === this._conn;
  }

  _problemPass(d) {
    // Deaktiviert ist kein Problem: nicht überwacht, bewusst abgeschaltet.
    return !this._problems || (!d.disabled && (d.online !== true || d.flaky || d.battery?.low || isWeak(d.signal)));
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

  // Änderung an der Ansicht: sofort sichtbar und gespeichert (keine
  // "Speichern"-Taste, wie die Spaltenwahl in unifi_dynamic).
  _setView(patch) {
    // Fokus am Schalter bzw. Griff halten: der Neuaufbau ersetzt ihn, und
    // ohne Fokus im Panel erreichte Escape es nicht mehr (echtes HA).
    const a = this.shadowRoot.activeElement;
    const ds = a?.dataset || {};
    const sel = ds.vtoggle ? `[data-vtoggle="${ds.vtoggle}"][data-key="${ds.key}"]` : ds.vdrag ? `[data-vdrag="${ds.vdrag}"][data-key="${ds.key}"]` : null;
    Object.assign(this._view, patch);
    this._saveView();
    this._render();
    if (this._colsOpen) this._renderCols();
    if (this.shadowRoot.querySelector("dialog.view")?.open) this._renderViewSheet();
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
        return d.disabled ? 4 : d.online === false ? 0 : d.online == null ? 2 : d.flaky ? 1 : 3;
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

  _toggleCols(open) {
    const pop = this.shadowRoot.querySelector(".cols-pop");
    const btn = this.shadowRoot.querySelector(".view-btn");
    if (!pop || !btn) return;
    this._colsOpen = open;
    btn.classList.toggle("on", open);
    btn.setAttribute("aria-expanded", String(open));
    pop.hidden = !open;
    if (!open) return;
    this._renderCols();
    // Unter dem Knopf, rechtsbündig, nie über den Rand hinaus.
    const b = btn.getBoundingClientRect();
    pop.style.top = `${Math.round(b.bottom + 8)}px`;
    pop.style.left = `${Math.max(8, Math.round(b.right - pop.offsetWidth))}px`;
  }

  // Liste zum Ein-/Ausblenden und Verschieben (Spalten bzw. Angaben).
  _orderRowsHtml(list, defs, kind) {
    const label = Object.fromEntries(defs.map(([k, l]) => [k, this._t(l)]));
    return list
      .map(
        ([key, on]) => `<div class="vrow${on ? "" : " off"}" data-key="${key}">
          <button type="button" class="drag-h" data-vdrag="${kind}" data-key="${key}" title="${escape(this._t("colDragHint"))}" aria-label="${escape(this._t("colDragMove", label[key]))}">${mdi("drag", 18)}</button>
          <span class="vl">${escape(label[key])}</span>
          <label class="switch"><input type="checkbox" data-vtoggle="${kind}" data-key="${key}" ${on ? "checked" : ""} aria-label="${escape(label[key])}"><span></span></label></div>`
      )
      .join("");
  }

  _renderCols() {
    const pop = this.shadowRoot.querySelector(".cols-pop");
    if (!pop) return;
    const t = (k, ...a) => this._t(k, ...a);
    setHtml(
      pop,
      `<h4>${escape(t("viewBtn"))}</h4><div class="vsub">${escape(t("viewSubDesktop"))}</div>
      <div class="vrow fixed"><span class="drag-h" aria-hidden="true">${mdi("drag", 18)}</span><span class="vl">${escape(t("colName"))}<small>${escape(t("colFixed"))}</small></span>
        <label class="switch"><input type="checkbox" checked disabled aria-label="${escape(t("colName"))}"><span></span></label></div>
      <div class="vlist" data-vlist="cols">${this._orderRowsHtml(this._view.cols, COLUMNS, "cols")}</div>
      <div class="vfoot"><span>${escape(t("colDragHint"))}</span><button type="button" class="vlink" data-vreset="cols">${escape(t("viewReset"))}</button></div>`
    );
  }

  _openViewSheet() {
    const dlg = this.shadowRoot.querySelector("dialog.view");
    if (!dlg) return;
    this._renderViewSheet();
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    dlg.scrollTop = 0;
    // Kein Fokusrahmen beim Öffnen per Tipp (showModal fokussiert den ersten Knopf).
    if (window.matchMedia?.(TOUCH_QUERY).matches) this.shadowRoot.activeElement?.blur();
  }

  _closeViewSheet() {
    const dlg = this.shadowRoot.querySelector("dialog.view");
    if (dlg?.open) dlg.close();
  }

  _renderViewSheet() {
    const dlg = this.shadowRoot.querySelector("dialog.view");
    if (!dlg) return;
    const t = (k, ...a) => this._t(k, ...a);
    const v = this._view;
    const seg = (attr, items, value) =>
      `<span class="seg-sw" role="group">${items
        .map(([val, label]) => `<button type="button" data-${attr}="${val}" class="${val === value ? "on" : ""}" aria-pressed="${val === value}">${label}</button>`)
        .join("")}</span>`;
    const pills = SORT_MOBILE.map((key) => {
      const on = v.sort === key;
      return `<button type="button" class="vpill${on ? " on" : ""}" data-vsort="${key}" aria-pressed="${on}">${on ? mdi("check", 15) : ""}${escape(this._sortLabel(key))}</button>`;
    }).join("");
    const body = `<h3>${escape(t("sortBy"))}</h3><div class="vpills">${pills}</div>
      <div class="vline"><span>${escape(t("sortDir"))}</span>${seg("vdir", [["asc", `${mdi("arrowUp", 14)} ${escape(t("sortAsc"))}`], ["desc", `${mdi("arrowDown", 14)} ${escape(t("sortDesc"))}`]], v.dir)}</div>
      <h3>${escape(t("viewDisplay"))}</h3>
      <div class="vline first"><span>${escape(t("viewGroupsOrList"))}</span>${seg("vflat", [["0", escape(t("viewGroups"))], ["1", escape(t("viewList"))]], v.flat ? "1" : "0")}</div>
      <div class="vnote">${escape(t("viewGroupsNote"))}</div>
      <h3>${escape(t("viewFields"))}</h3><div class="vnote top">${escape(t("viewFieldsNote"))}</div>
      <div class="vlist" data-vlist="fields">${this._orderRowsHtml(v.fields, CARD_FIELDS, "fields")}</div>`;
    const html = `<div class="dlg-head"><span class="dlg-avatar">${mdi("cols", 28)}</span>
        <div class="dlg-title"><h2>${escape(t("viewTitle"))}</h2><div class="dlg-sub">${escape(t("viewSubMobile"))}</div></div>
        <button type="button" class="dlg-close" data-vdone title="${escape(t("close"))}" aria-label="${escape(t("close"))}">${mdi("close", 18)}</button></div>
      <div class="dlg-body">${body}</div>
      <div class="dlg-actions"><button type="button" class="dlg-btn" data-vreset="sheet">${escape(t("viewReset"))}</button><button type="button" class="dlg-btn primary" data-vdone>${escape(t("viewDone"))}</button></div>`;
    // Der Dialog scrollt selbst; Position beim Neuaufbau halten.
    const scroll = dlg.scrollTop;
    if (setHtml(dlg, html)) dlg.scrollTop = scroll;
  }

  // Bedienung von Popover (Desktop) und Blatt (Handy): Schalter, Ziehen am
  // Griff (Maus und Finger, Pointer-Events), Pfeiltasten, Auswahl.
  _bindViewControls(pop, sheet) {
    const listOf = (kind) => (kind === "cols" ? "cols" : "fields");
    const toggle = (ev) => {
      const el = ev.target.closest?.("[data-vtoggle]");
      if (!el) return;
      const key = listOf(el.dataset.vtoggle);
      this._setView({ [key]: this._view[key].map(([k, on]) => [k, k === el.dataset.key ? el.checked : on]) });
    };
    const reorder = (kind, keys) => {
      const key = listOf(kind);
      const map = new Map(this._view[key]);
      this._setView({ [key]: keys.map((k) => [k, map.get(k)]) });
    };
    const keyMove = (ev) => {
      const h = ev.target.closest?.("[data-vdrag]");
      if (!h || (ev.key !== "ArrowUp" && ev.key !== "ArrowDown")) return;
      ev.preventDefault();
      const kind = h.dataset.vdrag;
      const keys = this._view[listOf(kind)].map(([k]) => k);
      const i = keys.indexOf(h.dataset.key);
      const j = ev.key === "ArrowUp" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= keys.length) return;
      [keys[i], keys[j]] = [keys[j], keys[i]];
      // Fokus bleibt am Griff (_setView), die nächste Pfeiltaste schiebt weiter.
      reorder(kind, keys);
    };
    const drag = (ev, scroller) => {
      const h = ev.target.closest?.("[data-vdrag]");
      if (!h || (ev.pointerType === "mouse" && ev.button !== 0)) return;
      ev.preventDefault();
      const row = h.closest(".vrow");
      const box = row?.parentElement;
      if (!box) return;
      const win = this.ownerDocument?.defaultView || window;
      row.classList.add("lift");
      const move = (e) => {
        const y = e.clientY;
        if (scroller) {
          const sr = scroller.getBoundingClientRect();
          if (y < sr.top + 50) scroller.scrollTop -= 10;
          else if (y > sr.bottom - 60) scroller.scrollTop += 10;
        }
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
    };

    pop.addEventListener("change", toggle);
    pop.addEventListener("keydown", keyMove);
    pop.addEventListener("pointerdown", (ev) => drag(ev, null));
    pop.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-vreset]")) this._setView({ cols: defaultView().cols });
    });
    // Klick ausserhalb oder Escape schliesst das Popover. Ein Klick in die
    // Liste schliesst nur die Auswahl und öffnet kein Gerät (wie unifi_dynamic).
    const content = this.shadowRoot.querySelector(".content");
    this.shadowRoot.addEventListener(
      "pointerdown",
      (ev) => {
        const path = ev.composedPath();
        if (!this._colsOpen || path.some((el) => el === pop || el?.classList?.contains?.("view-btn"))) return;
        this._toggleCols(false);
        if (path.includes(content)) this._swallowUntil = Date.now() + 800;
      },
      true
    );
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
    // Am Fenster: auch wenn der Fokus gerade nicht im Panel liegt.
    (this.ownerDocument?.defaultView || window).addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && this._colsOpen) {
        this._toggleCols(false);
        this.shadowRoot.querySelector(".view-btn")?.focus();
      }
    });

    sheet.addEventListener("change", toggle);
    sheet.addEventListener("keydown", keyMove);
    sheet.addEventListener("pointerdown", (ev) => drag(ev, sheet));
    sheet.addEventListener("click", (ev) => {
      // Tipp auf den Hintergrund schliesst wie bei den übrigen Blättern.
      if (ev.target === sheet) return this._closeViewSheet();
      const el = ev.target.closest("[data-vsort],[data-vdir],[data-vflat],[data-vreset],[data-vdone]");
      if (!el) return;
      if (el.dataset.vsort) this._setView({ sort: el.dataset.vsort, dir: el.dataset.vsort === this._view.sort ? this._view.dir : "asc" });
      else if (el.dataset.vdir) this._setView({ dir: el.dataset.vdir });
      else if (el.dataset.vflat) this._setView({ flat: el.dataset.vflat === "1" });
      else if (el.dataset.vreset !== undefined) {
        const d = defaultView();
        this._setView({ sort: d.sort, dir: d.dir, flat: d.flat, fields: d.fields });
      } else this._closeViewSheet();
    });
  }

  // --- Liste ----------------------------------------------------------------

  _render() {
    const root = this.shadowRoot;
    if (!root.querySelector(".content")) return;
    const all = this._devices;
    const offline = all.filter((d) => d.online === false).sort((a, b) => Date.parse(a.offline_since) - Date.parse(b.offline_since));
    // Kopf und Puls nur mit überwachten Geräten; deaktivierte zählen nicht.
    const monitored = all.filter((d) => !d.disabled);
    setHtml(root.querySelector(".hero"), this._loading ? "" : this._heroHtml(monitored, offline));
    setHtml(root.querySelector(".chips"), this._loading ? "" : this._chipsHtml(all));
    setHtml(root.querySelector(".viewline"), this._loading || !this._narrowQuery.matches ? "" : this._viewLineHtml());
    const rows = all.filter((d) => this._matches(d));
    setHtml(root.querySelector(".list"), this._listHtml(rows));
    const time = this._fetchedAt ? this._fetchedAt.toLocaleTimeString(this._locale(), { hour: "2-digit", minute: "2-digit" }) : "";
    setHtml(
      root.querySelector(".foot"),
      this._loading || this._error
        ? ""
        : `<span>${escape(this._t("footer", rows.length, all.length))}${time ? ` · ${escape(this._t("updatedAt", time))}` : ""}</span>${rows.length ? `<span class="tap">${escape(this._t("openDetails"))}</span>` : ""}`
    );
    this._renderDevice();
  }

  _heroHtml(all, offline) {
    const online = all.filter((d) => d.online === true);
    const flaky = online.filter((d) => d.flaky).length;
    const noData = all.filter((d) => d.online == null).length;
    const share = all.length ? (online.length / all.length) * 100 : 100;
    // Kennzahl: mittlere Verfügbarkeit der letzten 24 Std. (sobald das
    // Protokoll genug Daten hat), sonst der Anteil, der gerade online ist.
    const withAvail = all.filter((d) => d.avail24?.pct != null);
    let pctHtml = `${escape(this._fmtPct(share))} %`;
    if (withAvail.length) {
      let avg = withAvail.reduce((a, d) => a + d.avail24.pct, 0) / withAvail.length;
      if (avg > 99.9 && withAvail.some((d) => d.avail24.outages)) avg = 99.9;
      pctHtml = `${escape(this._fmtPct(avg))} %<small>${escape(this._t("avg24"))}</small>`;
    }
    const line = (color, text) => `<div><i style="background:${color}"></i>${escape(text)}</div>`;
    const ring = `<div class="kt ring"><div class="ringwrap">${ringSvg(share, 108, 11)}<div class="c"><div><b>${online.length}</b><span>${escape(this._t("ofTotal", all.length))}</span></div></div></div>
      <div><div class="k">${escape(this._t("availability"))}</div><div class="pct">${pctHtml}</div>
      <div class="lines">${line("var(--dp-success)", this._t("linesOnline", online.length - flaky))}
      ${flaky ? line("var(--dp-warning)", this._t("linesFlaky", flaky)) : ""}
      ${line("var(--dp-error)", this._t("linesOffline", offline.length))}
      ${noData ? line("var(--dp-text3)", this._t("linesNoData", noData)) : ""}</div></div></div>`;
    const off = offline.length
      ? `<div class="kt err"><div class="k"><span class="pulse"></span>${escape(this._t("offlineNow"))}</div>
        <div class="top"><span class="num">${offline.length}</span><span class="lbl">${escape(this._t("longest", `${offline[0].since_at_least ? "≥ " : ""}${this._duration(offline[0].offline_since)}`))}</span></div>
        <div class="olist">${offline.slice(0, 4).map((d) => `<button type="button" data-open="${escape(d.id)}"><span>${CONN[this._connOf(d)].icon(16)}</span><span class="name">${escape(d.name)}</span><b>${this._durationHtml(d, true)}</b></button>`).join("")}
        ${offline.length > 4 ? `<div class="more">${escape(this._t("more", offline.length - 4))}</div>` : ""}</div></div>`
      : `<div class="kt"><div class="k">${escape(this._t("offlineNow"))}</div>
        <div class="top"><span class="num ok">0</span><span class="lbl">${escape(this._t("allOnline"))}</span></div>
        <div class="durs">${escape(this._t("allOnlineSub"))}</div></div>`;
    return ring + off + this._pulseHtml(all);
  }

  // Ausfall-Puls: Zahl der Geräte mit Unterbruch je 30 Min. über 24 Std.,
  // dazu der jüngste Sammelausfall (mehrere Geräte fast gleichzeitig).
  _pulseHtml(all) {
    const p = this._pulse;
    if (!p || !p.length) return "";
    const n = p.length;
    const max = Math.max(...p);
    const W = 480;
    const H = 84;
    const x = (i) => (((i + 0.5) / n) * W).toFixed(1);
    const y = (v) => (H - 3 - (max ? (v / max) * (H - 12) : 0)).toFixed(1);
    const line = `M${p.map((v, i) => `${x(i)},${y(v)}`).join(" L")}`;
    const end = this._serverNow || Date.now() / 1000;
    const start = end - 86400;
    const size = 86400 / n;
    const hits = p
      .map((v, i) =>
        v
          ? `<rect x="${((i / n) * W).toFixed(1)}" y="0" width="${(W / n).toFixed(1)}" height="${H}" fill="transparent"><title>${escape(
              this._t("pulseTip", `${this._fmtTime(start + i * size)}–${this._fmtTime(start + (i + 1) * size)}`, v)
            )}</title></rect>`
          : ""
      )
      .join("");
    const marks = this._incidents
      .filter((inc) => inc.at >= start)
      .map((inc) => `<span class="imark" style="left:${(((inc.at - start) / 86400) * 100).toFixed(2)}%" title="${escape(this._t("incidentTitle", this._fmtTime(inc.at)))}"></span>`)
      .join("");
    const ticks = this._ticks(start, end, "24h")
      .map((tk) => `<span class="${tk.minor ? "minor" : ""}" style="left:${tk.pos.toFixed(2)}%">${escape(tk.label)}</span>`)
      .join("");
    const inc = this._incidents[0];
    const outages = all.reduce((a, d) => a + (d.avail24?.outages || 0), 0);
    const affected = all.filter((d) => d.avail24?.outages).length;
    let note;
    if (inc) {
      const integ = inc.integration ? this._integrations[inc.integration] || inc.integration : null;
      note = `<div class="inc" title="${escape((inc.names || []).join(", "))}"><b>${escape(this._t("incidentTitle", this._fmtTime(inc.at)))}</b>${escape(this._t("incidentText", inc.count, integ))}</div>`;
    } else if (outages) {
      note = `<div class="pnote">${escape(this._t("pulseSummary", outages, affected))}</div>`;
    } else {
      note = `<div class="pnote ok">${escape(this._t("pulseNone"))}</div>`;
    }
    return `<div class="kt pul"><div class="k">${mdi("pulse", 16)}${escape(this._t("pulseTitle"))}</div>
      <div class="pchart ${max ? "" : "quiet"}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <line class="base" x1="0" x2="${W}" y1="${H - 0.5}" y2="${H - 0.5}" vector-effect="non-scaling-stroke"/>
        <path class="area" d="${line} L${x(n - 1)},${H} L${x(0)},${H} Z"/>
        <path class="line" d="${line}" vector-effect="non-scaling-stroke"/>${hits}</svg>${marks}</div>
      <div class="pticks">${ticks}<span class="now-label">${escape(this._t("now"))}</span></div>${note}</div>`;
  }

  _chipsHtml(all) {
    // Welche Chips erscheinen, richtet sich nach allen Geräten (sonst sprängen
    // sie beim Tippen); die Zahl nach den übrigen Filtern samt Suche.
    const present = new Map();
    for (const d of all) present.set(this._connOf(d), (present.get(this._connOf(d)) || 0) + 1);
    const types = orderConns([...present.entries()], this._connOrder);
    const base = all.filter((d) => this._problemPass(d) && this._hintPass(d, this._hint) && this._searchPass(d));
    const counts = new Map();
    for (const d of base) counts.set(this._connOf(d), (counts.get(this._connOf(d)) || 0) + 1);
    const chip = (key, label, n, icon = "") =>
      `<button type="button" class="chip ${this._conn === key ? "on" : ""} ${n ? "" : "zero"}" data-conn="${key}" aria-pressed="${this._conn === key}">${icon}<span>${escape(label)}</span> <span class="n">${n}</span></button>`;
    let html = chip("all", this._t("all"), base.length);
    for (const [key] of types) if (!this._hideConn.has(key)) html += chip(key, this._t(CONN[key].key), counts.get(key) || 0, CONN[key].icon(15));
    html += `<span class="vsep"></span><button type="button" class="chip ${this._problems ? "on" : ""}" data-problems aria-pressed="${this._problems}">${mdi("alert", 15)}<span>${escape(this._t("onlyProblems"))}</span></button>`;
    // Hinweise als Filter-Chips, nur wenn sie bei irgendeinem Gerät zutreffen
    // (oder aktiv sind).
    const rest = all.filter((d) => this._connPass(d) && this._problemPass(d) && this._searchPass(d));
    for (const { key, cls, icon, label, test } of HINTS) {
      const on = this._hint === key;
      if (!on && !all.some(test)) continue;
      const n = rest.filter(test).length;
      html += `<button type="button" class="chip hint ${cls} ${on ? "on" : ""} ${n ? "" : "zero"}" data-hint="${key}" aria-pressed="${on}">${mdi(icon, 15)}<span>${escape(this._t(label))}</span> <span class="n">${n}</span></button>`;
    }
    // Desktop: "Gruppen | Liste" am Ende der Chips; Handy: Zeile darunter.
    if (!this._narrowQuery.matches) html += this._flatSegHtml();
    return html;
  }

  _flatSegHtml() {
    const flat = this._view.flat;
    return `<span class="seg-sw vseg" role="group">${[["0", "viewGroups"], ["1", "viewList"]]
      .map(([val, key]) => {
        const on = (val === "1") === flat;
        return `<button type="button" data-flat="${val}" class="${on ? "on" : ""}" aria-pressed="${on}">${escape(this._t(key))}</button>`;
      })
      .join("")}</span>`;
  }

  // Handy: "Sortiert nach" unter den Chips; öffnet das Blatt "Ansicht".
  _viewLineHtml() {
    const v = this._view;
    const label = this._sortLabel(v.sort);
    const dir = v.sort === "default" ? "" : mdi(v.dir === "asc" ? "arrowUp" : "arrowDown", 14);
    return `<button type="button" class="sort-btn" data-view-open aria-label="${escape(`${this._t("sortBy")}: ${label}`)}">${mdi("sort", 16)}<span>${escape(label)}</span>${dir}${mdi("chevronDown", 16)}</button>${this._flatSegHtml()}`;
  }

  _avatar(d, size = 18) {
    const cls = d.online === false ? "off" : d.online == null ? "none" : d.flaky ? "warn" : "";
    return `<div class="av ${cls}">${CONN[this._connOf(d)].icon(size)}<span class="dot"></span></div>`;
  }

  // Einstellungen pro Gerät beim Namen (Variante A, docs/mockups/override-v1):
  // je Art ein Symbol, Wert und globaler Wert im Tooltip.
  _overrideHtml(d) {
    const out = [];
    const tag = (cls, icon, text, label) =>
      `<span class="ovr ${cls}" role="img" title="${escape(label)}" aria-label="${escape(label)}">${mdi(icon, 12)}${text ? escape(text) : ""}</span>`;
    const setting = d.battery_setting;
    if (setting === "off") out.push(tag("bat-off", "batteryOff", "", this._t("ovrBatOffTip")));
    else if (Number.isInteger(setting)) out.push(tag("bat", "battery", `${setting} %`, this._t("ovrBatOwnTip", setting, d.battery_default?.pct ?? 15)));
    if (d.notify_off) out.push(tag("mute", "bellOff", "", this._t("ovrNotifyOffTip")));
    if (d.connection_manual && CONN[d.connection]) {
      // Ohne die Wahl am Gerät gälte die Integration, sonst die Erkennung.
      const base = d.connection_integration && CONN[d.connection_integration] ? d.connection_integration : this._connAuto(d);
      const label = this._t("ovrConnTip", this._t(CONN[d.connection].key), this._t(CONN[base].key));
      out.push(`<span class="ovr conn" role="img" title="${escape(label)}" aria-label="${escape(label)}">${CONN[d.connection].icon(12)}</span>`);
    }
    return out.length ? `<span class="ovrs">${out.join("")}</span>` : "";
  }

  _statusHtml(d) {
    if (d.disabled) return `<span class="pill none">${escape(this._t("statusDisabled"))}</span>`;
    if (d.online === false) return `<div class="dur">${this._durationHtml(d)}</div><div class="durs">${escape(this._t("statusOffline"))}</div>`;
    if (d.online == null) return `<span class="pill none">${escape(this._t("statusNoData"))}</span>`;
    if (d.flaky) return `<span class="pill warn">${escape(this._t("statusFlaky"))}</span><div class="durs">${escape(this._t("flakyOutages", d.avail24.outages))}</div>`;
    return `<span class="pill on"><span class="pd"></span>${escape(this._t("statusOnline"))}</span>`;
  }

  _connHtml(d, withVia = true) {
    const type = this._connOf(d);
    const level = sigLevel(d.signal);
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
    return `<span class="bat ${b.low ? "low" : ""}">${mdi("battery", 14)} ${escape(text)}</span>`;
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
    const active = rows.filter((d) => !d.disabled);
    const chosen = this._sortCmp() || (this._batterySort() ? (a, b) => batteryRank(a) - batteryRank(b) || byName(a, b) : null);
    const groups = [
      ["e", this._t("groupOffline"), this._t("groupOfflineHint"), active.filter((d) => d.online === false).sort((a, b) => Date.parse(a.offline_since) - Date.parse(b.offline_since))],
      ["w", this._t("groupFlaky"), this._t("groupFlakyHint", this._flakyOutages), active.filter((d) => d.online === true && d.flaky).sort((a, b) => outages(b) - outages(a) || byName(a, b))],
      ["n", this._t("groupNoData"), this._t("groupNoDataHint"), active.filter((d) => d.online == null).sort(byName)],
      ["", this._t("groupOnline"), null, active.filter((d) => d.online === true && !d.flaky).sort(byName)],
      // Nur mit "Deaktivierte Geräte anzeigen": am Ende, nicht überwacht.
      ["d", this._t("groupDisabled"), this._t("groupDisabledHint"), rows.filter((d) => d.disabled).sort(byName)],
    ].filter((g) => g[3].length);
    if (this._view.flat) {
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
    if (this._loading) return `<div class="note">${escape(this._t("loading"))}</div>`;
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
    const span = keys.length + 1;
    const body = this._groups(rows)
      .map(([cls, title, hint, list]) =>
        (title == null ? "" : `<tr class="grp ${cls}"><td colspan="${span}"><span class="gl">${escape(title)} · ${list.length}${hint ? ` <small>${escape(hint)}</small>` : ""}</span></td></tr>`) +
        list
          .map(
            (d) => `<tr class="dev ${d.online === false ? "off" : d.online && d.flaky ? "flaky" : ""}" data-open="${escape(d.id)}" tabindex="0">
            <td><div class="nc">${this._avatar(d)}<div>${escape(d.name)}${this._overrideHtml(d)}${areaSub && d.area ? `<span class="sub">${escape(d.area)}</span>` : ""}</div></div></td>
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
    // Online ohne Auffälligkeit: kompakte Zeile; sonst eine Karte mit Dauer.
    const compact = (d) => d.online === true && !d.flaky && !d.disabled;
    const row = (d) => `<div class="mrow dev" data-open="${escape(d.id)}" tabindex="0" role="button">${this._avatar(d, 16)}<div>${escape(d.name)}${this._overrideHtml(d)}<span class="sub">${meta(d)}</span></div>
              <div>${d.battery?.low || batSort ? this._batteryHtml(d) : bars(sigLevel(d.signal), false)}</div></div>`;
    const card = (d) => {
      let right = this._statusHtml(d);
      if (d.online === false) right = `<div class="dur">${this._durationHtml(d, true)}</div><div class="durs">${escape(this._t("statusOffline"))}</div>`;
      const sb = `${showConn ? this._connHtml(d, false) : ""}${batExtra ? ` ${this._batteryHtml(d)}` : ""}`;
      const m = meta(d);
      return `<div class="mc dev ${d.online === false ? "off" : d.flaky ? "flaky" : ""}" data-open="${escape(d.id)}" tabindex="0" role="button">${this._avatar(d)}
            <div><div class="nm">${escape(d.name)}${this._overrideHtml(d)}</div>${sb.trim() ? `<div class="sb">${sb}</div>` : ""}${m ? `<div class="sb2">${m}</div>` : ""}</div>
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

  _openDevice(id) {
    const dlg = this.shadowRoot.querySelector("dialog.device");
    if (!dlg || !id) return;
    this._closeStat();
    this._detailId = id;
    this._detail = null;
    this._renderDevice();
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    dlg.scrollTop = 0;
    this._loadDetail(true);
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

  // Typ von Hand: sofort in der Liste zeigen, dann vom Server bestätigen lassen.
  async _setDeviceType(id, kind) {
    const d = this._devices.find((x) => x.id === id);
    this._typeError = null;
    try {
      await this._hass.callWS({ type: "device_panel/set_device_type", device_id: id, device_type: kind });
      if (d) {
        d.type = kind || d.type_auto || d.type;
        d.type_manual = Boolean(kind);
      }
    } catch (err) {
      this._typeError = (err && err.message) || String(err);
    }
    this._render();
    this._fetch(true);
  }

  // Verbindungsart von Hand: wie der Typ sofort zeigen, dann bestätigen lassen.
  async _setDeviceConnection(id, kind) {
    const d = this._devices.find((x) => x.id === id);
    this._connError = null;
    try {
      await this._hass.callWS({ type: "device_panel/set_device_connection", device_id: id, connection: kind });
      if (d) {
        d.connection = kind || d.connection_integration || (d.connection_auto !== undefined ? d.connection_auto : d.connection);
        d.connection_manual = Boolean(kind);
      }
    } catch (err) {
      this._connError = (err && err.message) || String(err);
    }
    this._render();
    this._fetch(true);
  }

  // Einstellungen des Geräts: sofort speichern (wie der Typ), dann neu laden.
  async _setDeviceSettings(id, changes) {
    const d = this._devices.find((x) => x.id === id);
    this._devSetError = null;
    try {
      await this._hass.callWS({ type: "device_panel/set_device_settings", device_id: id, ...changes });
      if (d) {
        if ("battery" in changes) d.battery_setting = changes.battery;
        if ("notify" in changes) d.notify_off = !changes.notify;
      }
    } catch (err) {
      this._devSetError = (err && err.message) || String(err);
    }
    this._render();
    this._fetch(true);
  }

  _resetDevice() {
    this._connError = null;
    this._devSetError = null;
    this._devRangeError = null;
    this._typeError = null;
    this._detailId = null;
    this._detail = null;
    this._hist = null;
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
      this._detail = { id, data: prev, loading: false, error: (err && err.message) || String(err), at: Date.now() };
    }
    this._renderDevice();
  }

  _statTile(range, label, valueHtml, sub) {
    return `<button type="button" class="st-tile" data-dlg="stat" data-range="${range}">
      <span class="st-k">${escape(label)}</span><span class="st-v">${valueHtml}</span><span class="st-sub">${escape(sub)}</span>${mdi("chevron", 16).replace('class="ic"', 'class="ic chev"')}</button>`;
  }

  _staticTile(label, valueHtml, sub, bad = false) {
    return `<div class="st-tile static"><span class="st-k">${escape(label)}</span><span class="st-v${bad ? " bad" : ""}">${valueHtml}</span><span class="st-sub">${escape(sub || "")}</span></div>`;
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
              : this._t("statNoOutages")
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
    const level = sigLevel(d.signal);
    if (level) tiles.push(this._staticTile(this._t("tileSignal"), `${bars(level, d.online === false)}${escape(sigText(d.signal))}`, this._t("tierNames")[level]));
    if (d.battery) {
      const b = d.battery;
      const value = b.level != null ? `${escape(String(b.level))}<small>%</small>` : escape(b.low ? this._t("batteryLow") : "OK");
      tiles.push(this._staticTile(this._t("tileBattery"), value, b.low && b.level != null ? this._t("batteryLow") : "", b.low));
    }
    return `<div class="st-tiles" style="--n:${tiles.length}">${tiles.join("")}</div>`;
  }

  _connSectionHtml(d) {
    const detail = this._detail?.id === d.id ? this._detail.data : null;
    const type = this._connOf(d);
    // Verbindungsart wählbar wie der Typ: erkannt oder von Hand, gilt sofort.
    const auto = this._connAuto(d);
    // Ohne Wahl am Gerät gilt die Integration, wenn dort eine festgelegt ist.
    const integ = d.connection_integration && CONN[d.connection_integration] ? d.connection_integration : null;
    const autoText = integ ? this._t("connAutoInteg", this._t(CONN[integ].key)) : this._t("typeAuto", this._t(CONN[auto].key));
    const opts = [`<option value="" ${d.connection_manual ? "" : "selected"}>${escape(autoText)}</option>`]
      .concat(CONN_MANUAL.map((k) => `<option value="${k}" ${d.connection_manual && d.connection === k ? "selected" : ""}>${escape(this._t(CONN[k].key))}</option>`))
      .join("");
    const connSel = `<label class="typ-sel">${CONN[type].icon(16)}<select data-dlg="conn" aria-label="${escape(this._t("connType"))}">${opts}</select>${mdi("chevronDown", 18)}</label>${
      d.connection_manual ? `<small>${escape(this._t("typeManual"))}</small>` : integ ? `<small>${escape(this._t("connByInteg"))}</small>` : ""
    }${this._connError ? `<small class="warn">${escape(this._t("connSaveError"))} ${escape(this._connError)}</small>` : ""}`;
    const tiles = [this._tile(this._t("connType"), connSel)];
    if (d.via) tiles.push(this._tile(this._t("viaLabel"), escape(d.via)));
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
    let html = "";
    if (d.has_battery) {
      const integ = def.integration ? this._integrations[def.integration] || def.integration : null;
      html += `<div class="opt${mode !== "default" ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(t("devBattery"))}</span>${sel(
        "dev-bat",
        [["default", t("devBatDefault", def.pct)], ["own", t("devBatOwn")], ["off", t("devBatOff")]],
        mode,
        t("devBattery")
      )}</div>${
        mode === "own"
          ? `<div class="opt-line opt-sub"><span class="opt-label">${escape(t("devBatLow"))}</span><span class="opt-input${range ? " bad" : ""}"><input type="number" inputmode="numeric" step="1" min="5" max="50" data-dlg="dev-bat-pct" value="${escape(range ? range.value : setting)}" aria-label="${escape(t("devBatLow"))}"><span class="unit">%</span></span></div>${
              range ? `<div class="opt-error" data-dev-range>${escape(range.message)}</div>` : ""
            }`
          : ""
      }<div class="opt-short">${escape(t("devBatShort", def.pct, integ))}</div></div>`;
    }
    // Stumm (Knopf "24 Std. stumm" in der Meldung): eigene Option mit Ende;
    // "Globale Einstellung" oder "Aus" hebt es auf.
    const muted = d.notify_mute_until && Date.parse(d.notify_mute_until) > Date.now() ? Date.parse(d.notify_mute_until) / 1000 : null;
    const notifyOpts = [["on", t("devNotifyOn")], ...(muted ? [["mute", t("devNotifyMuted", this._fmtTime(muted, true))]] : []), ["off", t("devNotifyOff")]];
    html += `<div class="opt${d.notify_off || muted ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(t("devNotify"))}</span>${sel(
      "dev-notify",
      notifyOpts,
      d.notify_off ? "off" : muted ? "mute" : "on",
      t("devNotify")
    )}</div><div class="opt-short">${escape(t("devNotifyShort"))}</div></div>`;
    if (this._devSetError) html += `<div class="opt-error">${escape(t("devSaveError"))} ${escape(this._devSetError)}</div>`;
    return `<div class="dev-set">${html}</div>`;
  }

  _deviceSectionHtml(d) {
    const text = (v) => (v ? escape(v) : `<span class="t3">–</span>`);
    const sw = `${text(d.sw_version)}${d.update ? `<small class="upd">${escape(this._t("updateTo", d.update))}</small>` : ""}`;
    // Typ wählbar: automatisch erkannt oder von Hand (für Ausschlüsse, wenn
    // die Erkennung danebenliegt). Gilt sofort, ohne "Speichern".
    const opts = [`<option value="" ${d.type_manual ? "" : "selected"}>${escape(this._t("typeAuto", this._t(typeKey(d.type_auto || d.type))))}</option>`]
      .concat(TYPE_ORDER.map((k) => `<option value="${k}" ${d.type_manual && d.type === k ? "selected" : ""}>${escape(this._t(typeKey(k)))}</option>`))
      .join("");
    const typeSel = `<label class="typ-sel">${typeIcon(d.type, 16)}<select data-dlg="type" aria-label="${escape(this._t("typeLabel"))}">${opts}</select>${mdi("chevronDown", 18)}</label>${
      d.type_manual ? `<small>${escape(this._t("typeManual"))}</small>` : ""
    }${this._typeError ? `<small class="warn">${escape(this._t("typeSaveError"))} ${escape(this._typeError)}</small>` : ""}`;
    const tiles = [
      this._tile(this._t("typeLabel"), typeSel),
      this._tile(this._t("manufacturer"), text(d.manufacturer)),
      this._tile(this._t("model"), text(d.model)),
      this._tile(this._t("software"), sw),
    ];
    if (d.hw_version) tiles.push(this._tile(this._t("hardware"), text(d.hw_version)));
    tiles.push(this._tile(this._t("area"), text(d.area)));
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

  _entitiesHtml(d) {
    const cur = this._detail?.id === d.id ? this._detail : null;
    if (!cur || (!cur.data && cur.loading)) return { count: 0, html: `<p class="dlg-note">${escape(this._t("loadingDetail"))}</p>` };
    if (!cur.data) return { count: 0, html: `<div class="dlg-error">${escape(this._t("error"))} ${escape(cur.error || "")}</div>` };
    const list = cur.data.entities || [];
    const items = list
      .map((e) => {
        const { text, bad } = this._formatState(e);
        return `<li class="entity" role="button" tabindex="0" data-dlg="more-info" data-entity="${escape(e.entity_id)}">
          <span class="ent-name">${escape(e.name)}<small>${escape(e.entity_id)}</small></span>
          ${e.liveness ? `<span class="pill live">${escape(this._t("liveness"))}</span>` : ""}
          <span class="ent-state ${bad ? "bad" : ""}">${escape(text)}</span></li>`;
      })
      .join("");
    const hint = list.some((e) => e.liveness) ? `<p class="dlg-note small">${escape(this._t("livenessHint"))}</p>` : "";
    return { count: list.length, html: list.length ? `<ul class="entities">${items}</ul>${hint}` : "" };
  }

  _renderDevice() {
    this._renderStat();
    const dlg = this.shadowRoot.querySelector("dialog.device");
    if (!dlg || !this._detailId) return;
    const close = `<button type="button" class="dlg-close" data-dlg="close" title="${escape(this._t("close"))}" aria-label="${escape(this._t("close"))}">${mdi("close", 18)}</button>`;
    const d = this._devices.find((x) => x.id === this._detailId);
    // Eigene Schwelle wird gerade getippt: nicht neu aufbauen, sonst ginge die
    // Eingabe beim nächsten Abfragen (alle 10 s) verloren.
    const typing = this.shadowRoot.activeElement;
    if (!this._devForce && d && typing?.dataset?.dlg === "dev-bat-pct" && typing.value !== String(d.battery_setting)) return;
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
      } else if (d.disabled || d.online == null) {
        status = `<span class="pill none">${escape(this._t(d.disabled ? "statusDisabled" : "statusNoData"))}</span>`;
        avatar = "none";
      } else if (d.flaky) {
        status = `<span class="pill warn">${escape(this._t("statusFlaky"))}</span><span>${escape(this._t("flakyOutages", d.avail24.outages))}</span>`;
        avatar = "warn";
      }
      const ents = this._entitiesHtml(d);
      html = `<div class="dlg-head"><span class="dlg-avatar ${avatar}">${typeIcon(d.type, 28)}</span>
          <div class="dlg-title"><h2>${escape(d.name)}</h2>
            <div class="dlg-sub">${status}<span>${[this._t(typeKey(d.type)), d.area].filter(Boolean).map(escape).join(" · ")}</span></div></div>
          ${close}</div>
        <div class="dlg-quick"><button type="button" class="qbtn" data-dlg="open-device">${mdi("open", 17)}${escape(this._t("openDevicePage"))}</button></div>
        <div class="dlg-body">
          <h3>${escape(this._t("secStats"))}</h3>${this._statTilesHtml(d)}
          <h3>${escape(this._t("secConnection"))}</h3>${this._connSectionHtml(d)}
          <h3>${escape(this._t("secDevice"))}</h3>${this._deviceSectionHtml(d)}
          <h3>${escape(this._t("secNotifyDevice"))}</h3>${this._deviceNotifyHtml(d)}
          <h3>${escape(this._t("secEntities", ents.count))}</h3>${ents.html}
        </div>
        <div class="dlg-actions"><button type="button" class="dlg-btn" data-dlg="close">${escape(this._t("close"))}</button></div>`;
    }
    // Fokus und Scrollposition über den Neuaufbau retten (Abfrage alle 10 s).
    const active = this.shadowRoot.activeElement;
    const sel =
      active && dlg.contains(active) && active.dataset?.dlg
        ? `[data-dlg="${active.dataset.dlg}"]${active.dataset.range ? `[data-range="${active.dataset.range}"]` : ""}${
            active.dataset.entity ? `[data-entity="${CSS.escape(active.dataset.entity)}"]` : ""
          }`
        : null;
    const scroll = dlg.scrollTop;
    if (!setHtml(dlg, html)) return;
    dlg.scrollTop = scroll;
    if (sel) refocus(dlg.querySelector(sel));
  }

  _onDeviceClick(ev) {
    const dlg = ev.currentTarget;
    // Klick auf den Hintergrund (ausserhalb des Inhalts) schliesst.
    if (ev.target === dlg) {
      const r = dlg.getBoundingClientRect();
      if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) this._closeDevice();
      return;
    }
    const btn = ev.target.closest("[data-dlg]");
    if (!btn || btn.disabled) return;
    const action = btn.dataset.dlg;
    if (action === "close") this._closeDevice();
    else if (action === "open-device") {
      const id = this._detailId;
      this._closeDevice();
      this._navigate(`/config/devices/device/${id}`);
    } else if (action === "stat") this._openStat(btn.dataset.range);
    else if (action === "more-info") this._openMoreInfo(btn.dataset.entity);
  }

  // Navigation gehört ins Elternfenster (Home Assistant selbst): im iframe
  // würde history.pushState nur das iframe umleiten. Gleiches Muster wie
  // HAs navigate(): pushState plus "location-changed" (siehe LEARNINGS).
  _navigate(path, replace = false) {
    const target = window.parent || window;
    if (replace) target.history.replaceState(target.history.state, "", path);
    else target.history.pushState(null, "", path);
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

  _openStat(range) {
    const dlg = this.shadowRoot.querySelector("dialog.stat-dlg");
    if (!dlg || !this._detailId) return;
    this._statRange = RANGES.includes(range) ? range : "24h";
    // X des Popups dahinter ausblenden: es wirkt sonst, als gehöre es zum
    // Statistik-Fenster (wie unifi_dynamic).
    this.setAttribute("stat-open", "");
    this._renderStat();
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    dlg.scrollTop = 0;
    this._loadHistory(true);
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
    const key = `${id}|${range}`;
    const cur = this._hist;
    if (!force && cur && cur.key === key && (cur.loading || Date.now() - cur.at < HISTORY_MAX_AGE_MS)) return;
    const prev = cur && cur.key === key ? cur.data : null;
    this._hist = { key, data: prev, loading: true, at: Date.now() };
    try {
      const data = await this._hass.callWS({ type: "device_panel/availability", device_id: id, range });
      if (this._hist?.key !== key) return;
      this._hist = { key, data, loading: false, at: Date.now() };
    } catch (err) {
      if (this._hist?.key !== key) return;
      this._hist = { key, data: prev, loading: false, error: (err && err.message) || String(err), at: Date.now() };
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
    const sw = `<div class="stat-range"><span class="seg-sw" role="group">${RANGES.map(
      (r) => `<button type="button" data-stat="range" data-range="${r}" class="${r === range ? "on" : ""}" aria-pressed="${r === range}">${escape(ranges[r])}</button>`
    ).join("")}</span></div>`;
    const html = `<div class="dlg-head stat-head"><span class="dlg-avatar">${mdi("pulse", 24)}</span>
        <div class="dlg-title"><h2>${escape(this._t("statTitle"))}</h2><div class="dlg-sub">${escape(d.name)}</div></div>
        <button type="button" class="dlg-close" data-stat="close" title="${escape(this._t("close"))}" aria-label="${escape(this._t("close"))}">${mdi("close", 18)}</button></div>
      <div class="dlg-body">${sw}${this._historyHtml(range)}</div>`;
    const scroll = dlg.scrollTop;
    if (setHtml(dlg, html)) dlg.scrollTop = scroll;
  }

  // Zeitstrahl mit Abschnitten online/ausgefallen/keine Daten, Fakten,
  // Liste der Unterbrüche; ab 7 Tagen Säulen "Unterbrüche pro Tag".
  _historyHtml(range) {
    const h = this._hist;
    const key = `${this._detailId}|${range}`;
    if (!h || h.key !== key || (!h.data && h.loading)) return `<div class="avail"><p class="dlg-note">${escape(this._t("loadingDetail"))}</p></div>`;
    if (!h.data) return `<div class="dlg-error">${escape(this._t("error"))} ${escape(h.error || "")}</div>`;
    const { start, end, segments: segs = [] } = h.data;
    const span = end - start;
    const sum = (st) => segs.filter((s) => s[2] === st).reduce((a, s) => a + s[1] - s[0], 0);
    const on = sum(1);
    const off = sum(0);
    if (!on && !off) return `<div class="avail"><p class="dlg-note">${escape(this._t("statNoData"))}</p></div>`;
    const withDate = range !== "24h";
    const outages = segs.filter((s) => s[2] === 0);
    let pct = (on / (on + off)) * 100;
    // Nie 100 % zeigen, wenn es einen Unterbruch gab (Rundung).
    if (outages.length && pct > 99.9) pct = 99.9;
    const facts = [];
    const pctOk = on + off >= PCT_MIN_COVERED;
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
        const tip = s[2] === 0 ? ` data-tip="${escape(`${this._fmtTime(s[0], withDate)}–${endLabel(s)}`)}" data-dur="${escape(this._fmtSeconds(s[1] - s[0]))}"` : "";
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

  async _openSettings() {
    const dialog = this.shadowRoot.querySelector("dialog.settings");
    if (!dialog || !this._hass) return;
    // resets: Geräte, deren eigene Einstellung beim Speichern auf den globalen
    // Wert zurückgeht (Variante A, docs/mockups/override-v1).
    this._settings = {
      loading: true, error: null, saveError: null, saving: false, data: null, draft: null, open: new Set(), info: new Set(),
      resets: { battery: new Set(), notify: new Set(), connection: new Set() },
    };
    this._renderSettings();
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    this._loadVersion(false);
    const st = this._settings;
    try {
      const data = await this._hass.callWS({ type: "device_panel/get_options" });
      if (this._settings !== st) return;
      st.data = data;
      st.draft = { ...data.values };
      this._applyPanelSettings(data.panel);
      // Vorabversionen (ganze Instanz) gelten wie alles andere erst mit "Speichern".
      st.extraBase = { prerelease: Boolean(this._prerelease) };
      st.extra = { ...st.extraBase };
    } catch (err) {
      if (this._settings !== st) return;
      st.error = (err && err.message) || String(err);
    }
    st.loading = false;
    this._renderSettings();
  }

  _closeSettings() {
    const dialog = this.shadowRoot.querySelector("dialog.settings");
    this._settings = null;
    if (dialog?.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }

  _applyPanelSettings(panel) {
    if (!panel) return;
    this._prerelease = panel.prerelease === true;
    this._prereleaseHacs = panel.prerelease_hacs || null;
  }

  _settingsEntryChanges() {
    const st = this._settings;
    if (!st || !st.draft) return [];
    // Listen (Ausschlüsse) und Zuordnungen (Batterie pro Integration) nach
    // Inhalt vergleichen, nicht nach Referenz oder Reihenfolge.
    // Ausnahme: die Reihenfolge der Chips, bei ihr zählt genau die Folge.
    const norm = (v) => (Array.isArray(v) ? [...v].sort() : v && typeof v === "object" ? Object.entries(v).sort() : v);
    const same = (k, a, b) => (k === "connection_order" ? JSON.stringify(a || []) === JSON.stringify(b || []) : JSON.stringify(norm(a)) === JSON.stringify(norm(b)));
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
    return [
      ...[...st.resets.battery].map(() => "reset_battery"),
      ...[...st.resets.notify].map(() => "reset_notify"),
      ...[...st.resets.connection].map(() => "reset_connection"),
    ];
  }

  _settingsChanges() {
    return [...this._settingsEntryChanges(), ...this._settingsExtraChanges(), ...this._settingsResetChanges()];
  }

  // Abschnitte mit ihren Optionen in der Reihenfolge von Bild 5, dazu
  // "Batterie" nach der Ausfall-Erkennung.
  _settingsSections() {
    return [
      ["detection", ["offline_after", "flaky_outages", "startup_grace"]],
      ["battery", ["battery_low", "battery_low_integrations", "battery_push", "battery_push_mode", "battery_push_time", "battery_push_daily", "battery_persistent", "reset_battery"]],
      ["integrations", ["exclude_integrations", "notify_exclude_integrations", "persistent_exclude_integrations"]],
      ["types", ["exclude_types"]],
      ["connections", ["connection_integrations", "reset_connection"]],
      ["push", ["notify_service", "notify_click_target", "notify_outage", "notify_online", "notify_group", "notify_delay", "notify_fields", "reset_notify"]],
      ["persistent", ["outage_persistent"]],
      ["display", ["show_service_devices", "show_disabled_devices", "hide_connections", "connection_order"]],
      ["updates", ["update_check"]],
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
    if ("battery_push_time" in st.draft && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(st.draft.battery_push_time || ""))) {
      errors.battery_push_time = this._t("timeError");
    }
    if (this._batInvalid().length) errors.battery_low_integrations = this._t("settingsRange", ...(st.data.limits?.battery_low || [5, 50]));
    return errors;
  }

  // Integrationen, deren eigene Batterie-Schwelle ausserhalb des Bereichs liegt.
  _batInvalid() {
    const st = this._settings;
    const [min, max] = st?.data?.limits?.battery_low || [5, 50];
    return Object.entries(st?.draft?.battery_low_integrations || {})
      .filter(([, v]) => v !== "off" && (!Number.isInteger(v) || v < min || v > max))
      .map(([d]) => d);
  }

  // Eigene Schwellen für die Zusammenfassung: "Name 25 %", nur gültige.
  _batOwnSummary(d) {
    const names = Object.fromEntries((this._settings?.data?.catalog?.battery || []).map((x) => [x.domain, x.name]));
    const bad = new Set(this._batInvalid());
    return Object.entries(d.battery_low_integrations || {})
      .filter(([dom]) => !bad.has(dom))
      .map(([dom, v]) => `${names[dom] || dom} ${v === "off" ? this._t("batOffSum") : `${v} %`}`);
  }

  // Verbindungsarten für die Filter-Chips: alle mit Geräten (wie die Chips,
  // häufigste zuerst), dazu ausgeblendete ohne Geräte.
  _connCatalog(d) {
    const counts = new Map();
    for (const dev of this._devices) counts.set(this._connOf(dev), (counts.get(this._connOf(dev)) || 0) + 1);
    for (const key of d.hide_connections || []) if (!counts.has(key) && CONN[key]) counts.set(key, 0);
    return orderConns([...counts.entries()], d.connection_order).map(([key, n]) => ({ value: key, devices: n }));
  }

  // Typen für die Ausschlüsse: alle mit Geräten, dazu ausgeblendete ohne.
  _catalogTypes(d) {
    const types = this._settings?.data?.catalog?.types || [];
    return types.filter((x) => x.devices > 0 || d.exclude_types.includes(x.type));
  }

  _settingsSummary(id, d) {
    if (id === "updates") return this._t(d.update_check ? "sumUpdatesOn" : "sumUpdatesOff");
    if (id === "detection") {
      // Während der Eingabe ungültig: der gespeicherte Wert gilt weiter.
      const errors = this._settingsErrors();
      const num = (k) => (errors[k] ? this._settings?.data?.values?.[k] : d[k]);
      return this._t("sumDetection", num("offline_after"), num("flaky_outages"), num("startup_grace"));
    }
    if (id === "display") {
      const chips = (d.hide_connections || []).length;
      return (
        this._t("sumDisplay", Boolean(d.show_service_devices), Boolean(d.show_disabled_devices)) +
        (chips ? ` · ${this._t("sumChipsHidden", chips)}` : "") +
        ((d.connection_order || []).length ? ` · ${this._t("sumChipsOrder")}` : "")
      );
    }
    if (id === "battery") {
      const errors = this._settingsErrors();
      const pct = errors.battery_low ? this._settings?.data?.values?.battery_low : d.battery_low;
      const daily = d.battery_push_mode === "daily" ? (errors.battery_push_time ? this._settings?.data?.values?.battery_push_time : d.battery_push_time) : null;
      return this._t("sumBattery", pct, Boolean(d.battery_push), Boolean(d.battery_persistent), this._batOwnSummary(d), daily);
    }
    if (id === "push") {
      const target = d.notify_service && d.notify_service !== "none" ? d.notify_service : "";
      const kinds = [
        d.notify_outage && this._t("pushKindOutage"),
        d.notify_online && this._t("pushKindOnline"),
        d.battery_push && this._t("pushKindBattery"),
      ].filter(Boolean);
      return this._t("sumPush", target, kinds);
    }
    if (id === "integrations") {
      const list = this._settings?.data?.catalog?.integrations || [];
      const shown = list.filter((i) => !d.exclude_integrations.includes(i.domain));
      const push = shown.filter((i) => !(d.notify_exclude_integrations || []).includes(i.domain)).length;
      const sum = this._t("sumShown", this._t("sumIntegrations", list.length), d.exclude_integrations.length);
      // "Push für N" nur, wenn es Push-Meldungen gibt (Bild 5).
      return d.notify_service && d.notify_service !== "none" && (d.notify_outage || d.notify_online) ? `${sum} · ${this._t("sumPushFor", push)}` : sum;
    }
    if (id === "persistent") {
      const list = this._settings?.data?.catalog?.integrations || [];
      const n = list.filter((i) => !d.exclude_integrations.includes(i.domain) && !(d.persistent_exclude_integrations || []).includes(i.domain)).length;
      return d.outage_persistent ? this._t("sumPersistentOn", n) : this._t("sumPersistentOff");
    }
    if (id === "types") return this._t("sumShown", this._t("sumTypes", this._catalogTypes(d).length), d.exclude_types.length);
    if (id === "connections") {
      const n = Object.keys(d.connection_integrations || {}).length;
      return n ? this._t("sumConnInteg", n) : this._t("sumConnAuto");
    }
    return "";
  }

  _renderSettings() {
    const dialog = this.shadowRoot.querySelector("dialog.settings");
    const st = this._settings;
    if (!dialog || !st) return;
    const t = (k, ...a) => this._t(k, ...a);
    const head = `<div class="dlg-head"><span class="dlg-avatar">${mdi("gear", 28)}</span>
        <div class="dlg-title"><h2>${escape(t("settingsTitle"))}</h2><div class="dlg-sub">${escape(t("settingsSub"))}</div></div>
        <button type="button" class="dlg-close" data-set="close" title="${escape(t("close"))}" aria-label="${escape(t("close"))}">${mdi("close", 18)}</button></div>`;
    let body;
    if (st.loading) body = `<p class="dlg-note">${escape(t("settingsLoading"))}</p>`;
    else if (st.error) body = `<div class="dlg-error">${escape(t("settingsLoadError"))} ${escape(st.error)}</div>`;
    else body = this._settingsBodyHtml();
    const changes = this._settingsChanges();
    const canSave = !st.loading && !st.error && !st.saving && changes.length > 0 && !Object.keys(this._settingsErrors()).length;
    // Nach dem Speichern bleibt der Dialog offen (Wunsch des Nutzers): kurz
    // "Gespeichert" statt des Zählers; ohne Änderung heisst der Knopf "Schliessen".
    if (changes.length) st.saved = false;
    const saved = !changes.length && st.saved;
    const actions = `<div class="dlg-actions">
        <span class="set-count${saved ? " saved" : ""}" role="status">${changes.length ? escape(t("settingsChanges", changes.length)) : saved ? escape(t("settingsSavedShort")) : ""}</span>
        <button type="button" class="dlg-btn" data-set="close">${escape(changes.length ? t("settingsCancel") : t("close"))}</button>
        <button type="button" class="dlg-btn primary" data-set="save" ${canSave ? "" : "disabled"}>${escape(st.saving ? t("settingsSaving") : t("settingsSave"))}</button></div>`;
    // Die Versionszeile (.ver-slot) ändert sich oft (Prüfung, HACS) und wird
    // dann allein ersetzt (_renderSettingsVersion), nicht der ganze Dialog.
    const html = `${head}<div class="dlg-body">${body}</div>${actions}`;
    const scroll = dialog.scrollTop;
    const active = this.shadowRoot.activeElement;
    const focusSel = active && dialog.contains(active) && active.dataset
      ? active.dataset.set ? `[data-set="${active.dataset.set}"]${active.dataset.id ? `[data-id="${active.dataset.id}"]` : ""}${active.dataset.key ? `[data-key="${active.dataset.key}"]` : ""}`
        : active.dataset.opt ? `[data-opt="${active.dataset.opt}"]` : active.dataset.bat ? `[data-bat="${active.dataset.bat}"]` : active.dataset.batMode ? `[data-bat-mode="${active.dataset.batMode}"]` : active.dataset.connInteg ? `[data-conn-integ="${active.dataset.connInteg}"]` : active.dataset.ver ? `[data-ver="${active.dataset.ver}"]` : null
      : null;
    if (!setHtml(dialog, html)) return;
    // Die Versionszeile wurde eben mit aufgebaut: als aktuell vermerken, sonst
    // ersetzte sie das nächste Teil-Update einmal grundlos (siehe setHtml).
    const slot = dialog.querySelector(".ver-slot");
    if (slot) lastHtml.set(slot, this._verSlotHtml);
    dialog.scrollTop = scroll;
    if (focusSel) refocus(dialog.querySelector(focusSel));
  }

  // Variante A (docs/mockups/battery-v1): eigene Schwelle nur für
  // Integrationen mit Batteriegeräten, leer = globaler Wert.
  _batOwnHtml(d, errors) {
    const st = this._settings;
    const t = (k, ...a) => this._t(k, ...a);
    const list = st.data.catalog?.battery || [];
    const std = errors.battery_low ? st.data.values.battery_low : d.battery_low;
    const [min, max] = st.data.limits?.battery_low || [5, 50];
    const own = d.battery_low_integrations || {};
    const saved = st.data.values.battery_low_integrations || {};
    const bad = new Set(this._batInvalid());
    const head = `<div class="opt bat-own"><div class="opt-line"><span class="opt-label">${escape(t("batOwnTitle"))}</span></div>
      <div class="opt-short" data-bat-short>${escape(t("batOwnShort", std))}</div></div>`;
    if (!list.length) return head + `<div class="opt-short bat-empty">${escape(t("batOwnEmpty"))}</div>`;
    // Variante B (docs/mockups/battery-v2): Auswahl wie im Geräte-Popup,
    // das Feld nur bei eigener Schwelle.
    const rows = list
      .map((x) => {
        const v = own[x.domain];
        const mode = v === "off" ? "off" : v === undefined ? "default" : "own";
        const cls = `${bad.has(x.domain) ? " invalid" : ""}${v !== saved[x.domain] ? " changed" : ""}${mode === "off" ? " off" : ""}`;
        const opts = [["default", t("devBatDefault", std)], ["own", t("devBatOwn")], ["off", t("devBatOff")]]
          .map(([val, text]) => `<option value="${val}"${val === mode ? " selected" : ""}>${escape(text)}</option>`)
          .join("");
        const input = mode === "own"
          ? `<span class="opt-input"><input type="number" inputmode="numeric" step="1" min="${min}" max="${max}" data-bat="${escape(x.domain)}" value="${escape(v ?? "")}" placeholder="${escape(std)}" aria-label="${escape(`${x.name}: ${t("batOwnCol")}`)}"><span class="unit">%</span></span>`
          : "";
        return `<div class="ex-row bat-row${cls}"><span class="ibadge" style="--h:${hue(x.domain)}">${escape(initials(x.name))}</span>
          <div class="ex-name">${escape(x.name)}<small>${escape(t("batDevices", x.devices, x.weakest))}</small></div>
          <span class="bat-ctl"><span class="opt-select"><select data-bat-mode="${escape(x.domain)}" aria-label="${escape(`${x.name}: ${t("batOwnColMode")}`)}">${opts}</select>${mdi("chevronDown", 18)}</span>${input}</span></div>`;
      })
      .join("");
    return head + `<div class="ex-head"><span>${escape(t("colIntegration"))}</span><span>${escape(t("batOwnColMode"))}</span></div>${rows}
      <div class="opt-error" data-bat-error ${errors.battery_low_integrations ? "" : "hidden"}>${escape(errors.battery_low_integrations || "")}</div>`;
  }

  // Verbindungsart pro Integration (Variante B): gilt für alle Geräte der
  // Integration statt der Erkennung, von Hand am Gerät geht vor. Je Zeile die
  // Erkennung als Übersicht, damit man sieht, was sich ändert. Darstellung wie
  // die Batterie pro Integration (docs/mockups/battery-v2, B).
  _connIntegHtml(d) {
    const st = this._settings;
    const t = (k, ...a) => this._t(k, ...a);
    const own = d.connection_integrations || {};
    const saved = st.data.values.connection_integrations || {};
    const groups = new Map();
    for (const dev of this._devices) {
      const dom = dev.integration?.domain;
      if (!dom || dev.disabled) continue;
      const g = groups.get(dom) || { devices: 0, kinds: new Map() };
      const kind = this._connAuto(dev);
      g.devices += 1;
      g.kinds.set(kind, (g.kinds.get(kind) || 0) + 1);
      groups.set(dom, g);
    }
    // Festgelegt, aber gerade ohne Geräte (z. B. ausgeblendet): bleibt zum Zurücksetzen.
    for (const dom of Object.keys({ ...own, ...saved })) if (!groups.has(dom)) groups.set(dom, { devices: 0, kinds: new Map() });
    const names = Object.fromEntries((st.data.catalog?.integrations || []).map((x) => [x.domain, x.name]));
    const name = (dom) => this._integrations[dom] || names[dom] || dom;
    const list = [...groups.entries()].sort((a, b) => b[1].devices - a[1].devices || name(a[0]).localeCompare(name(b[0])));
    const head = `<div class="opt bat-own"><div class="opt-line"><span class="opt-label">${escape(t("connIntegTitle"))}</span></div>
      <div class="opt-short">${escape(t("connIntegShort"))}</div></div>`;
    if (!list.length) return head;
    const rows = list
      .map(([dom, g]) => {
        const v = own[dom] || "";
        const detected = [...g.kinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${n} ${t(CONN[k].key)}`).join(", ");
        const opts = [["", t("connIntegAuto")], ...CONN_MANUAL.map((k) => [k, t(CONN[k].key)])]
          .map(([val, text]) => `<option value="${val}"${val === v ? " selected" : ""}>${escape(text)}</option>`)
          .join("");
        return `<div class="ex-row bat-row conn-row${(own[dom] || null) !== (saved[dom] || null) ? " changed" : ""}"><span class="ibadge" style="--h:${hue(dom)}">${escape(initials(name(dom)))}</span>
          <div class="ex-name">${escape(name(dom))}<small>${escape(t("connIntegDevices", g.devices, detected))}</small></div>
          <span class="bat-ctl"><span class="opt-select"><select data-conn-integ="${escape(dom)}" aria-label="${escape(`${name(dom)}: ${t("connType")}`)}">${opts}</select>${mdi("chevronDown", 18)}</span></span></div>`;
      })
      .join("");
    return head + `<div class="ex-head"><span>${escape(t("colIntegration"))}</span><span>${escape(t("connType"))}</span></div>${rows}`;
  }

  // Geräte mit eigener Einstellung (Batterie oder Meldungen), einzeln oder
  // alle zurücksetzen; gilt mit "Speichern" (Variante A, docs/mockups/override-v1).
  _overridesHtml(kind) {
    const st = this._settings;
    const t = (k, ...a) => this._t(k, ...a);
    const list = st.data.overrides?.[kind] || [];
    const marked = st.resets[kind];
    const all = list.length > 0 && list.every((x) => marked.has(x.id));
    const pre = { battery: "ovrBat", notify: "ovrNotify", connection: "ovrConn" }[kind];
    const btn = list.length
      ? `<button type="button" class="ovr-all" data-set="ovr-all" data-key="${kind}" ${all ? "disabled" : ""}>${mdi("reset", 15)}${escape(t("ovrResetAll"))}</button>`
      : "";
    const value = (x) =>
      kind === "connection" ? t(CONN[x.value]?.key || "connUnknown") : kind === "notify" || x.value === "off" ? t("ovrOff") : `${x.value} %`;
    const back = kind === "connection" ? t("ovrToAuto") : t("ovrToGlobal");
    const rows = list
      .map((x) => {
        const on = marked.has(x.id);
        const sub = [x.area, x.integration, x.hidden ? t("ovrHidden") : null].filter(Boolean).join(" · ");
        const label = t(on ? "ovrUndo" : "ovrReset", x.name);
        return `<div class="ovr-row${on ? " reset" : ""}"><span class="ovr-name">${escape(x.name)}${sub ? `<small>${escape(sub)}</small>` : ""}</span>
          <span class="ovr-val">${on ? `<s>${escape(value(x))}</s> ${escape(back)}` : escape(value(x))}</span>
          <button type="button" class="ovr-x" data-set="ovr-one" data-key="${kind}:${escape(x.id)}" title="${escape(label)}" aria-label="${escape(label)}">${mdi(on ? "reset" : "close", 16)}</button></div>`;
      })
      .join("");
    return `<div class="opt ovr-opt${marked.size ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(t(`${pre}Title`))}</span>${btn}</div>
      <div class="opt-short">${escape(t(list.length ? `${pre}Short` : `${pre}Empty`))}</div>${rows ? `<div class="ovr-list">${rows}</div>` : ""}</div>`;
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
    // Beispiel: ein ausgefallenes Gerät, sonst irgendeines, sonst erfunden.
    const dev = this._devices.find((x) => x.online === false) || this._devices[0] || { name: t("pvSample"), area: null };
    const since = dev.offline_since ? Date.parse(dev.offline_since) / 1000 : Date.now() / 1000 - 300;
    const parts = NOTIFY_FIELDS.filter((f) => on.has(f))
      .map((f) => {
        if (f === "area") return dev.area;
        if (f === "integration") return dev.integration ? this._integName(dev) : null;
        if (f === "connection") return dev.connection !== undefined ? t(CONN[this._connOf(dev)].key) : null;
        if (f === "since") return t("pvSince", this._fmtTime(since));
        if (f === "signal") return dev.signal?.value != null ? t("pvSignal", sigText(dev.signal)) : null;
        if (f === "battery") return dev.battery?.level != null ? t("pvBattery", `${dev.battery.level} %`) : null;
        if (f === "model") return [dev.manufacturer, dev.model].filter(Boolean).join(" ") || null;
        return null;
      })
      .filter(Boolean);
    const preview = d.notify_outage
      ? `<div class="pv"><div class="pv-k">${escape(t("pvLabel"))}</div><div class="pv-card"><div class="pv-app">${LOGO_SMALL}${escape(t("pvApp"))}</div>
          <div class="pv-title">${escape(t("pvTitle", dev.name))}</div><div class="pv-text">${escape(parts.join(" · "))}</div>
          <div class="pv-actions"><span>${escape(t("pvOpen"))}</span><span>${escape(t("pvMute"))}</span></div></div>
          <div class="opt-short">${escape(t("pvNote"))}</div></div>`
      : "";
    return `<div class="opt${changes.has("notify_fields") ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(t("optFields"))}</span></div>
      <div class="opt-short">${escape(t("optFieldsShort"))}</div><div class="nf-grid">${grid}</div>${preview}</div>`;
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
    const sw = (key, label) => `<label class="switch"><input type="checkbox" data-opt="${key}" ${d[key] ? "checked" : ""} aria-label="${escape(label)}"><span></span></label>`;
    const select = (key, options, label) => `<span class="opt-select"><select data-opt="${key}" aria-label="${escape(label)}">${options
        .map(([v, text]) => `<option value="${escape(v)}"${v === d[key] ? " selected" : ""}>${escape(text)}</option>`)
        .join("")}</select>${mdi("chevronDown", 18)}</span>`;
    const targets = (st.data.notify_targets || [{ value: "none", kind: "none" }]).map((x) => [
      x.value,
      x.kind === "none" ? t("notifyNone") : x.kind === "entity" ? t("notifyEntity", x.value) : x.kind === "missing" ? t("notifyMissing", x.value) : x.value,
    ]);
    const noTarget = !d.notify_service || d.notify_service === "none";
    const num = (key, unit, label) => {
      const [min, max] = st.data.limits?.[key] || [];
      return `<span class="opt-input"><input type="number" inputmode="numeric" step="1" ${min != null ? `min="${min}" max="${max}"` : ""} data-opt="${key}" value="${escape(d[key] ?? "")}" aria-label="${escape(label)}"><span class="unit">${escape(unit)}</span></span>`;
    };
    // Ausschlüsse als Tabelle: Schalter "Anzeigen" pro Integration bzw. Typ,
    // bei den Integrationen dazu "Push" und "Anhaltend" (Bild 5). Jede Spalte
    // ist eine Liste der Ausgeschlossenen; ausgeblendete Zeilen sperren die
    // übrigen Spalten (nicht überwacht, keine Meldungen).
    // drag: Zeilen mit Griff zum Verschieben (Reihenfolge der Chips).
    const exTable = (key, items, intro, drag = false, cols = null) => {
      const columns = cols || [[key, t("colShow")]];
      const multi = columns.length > 1;
      const sets = Object.fromEntries(columns.map(([k]) => [k, new Set(d[k] || [])]));
      const hidden = sets[key];
      const handle = (x) =>
        drag
          ? `<button type="button" class="drag-h" data-set="drag" data-key="${escape(x.value)}" title="${escape(t("dragHint"))}" aria-label="${escape(t("dragMove", x.label))}">${mdi("drag", 18)}</button>`
          : "";
      const cell = (html) => (multi ? `<span class="ex-col">${html}</span>` : html);
      const toggle = (k, label, x, off) =>
        cell(`<label class="switch"><input type="checkbox" data-list="${k}" data-value="${escape(x.value)}" ${sets[k].has(x.value) ? "" : "checked"} ${off ? "disabled" : ""} aria-label="${escape(`${label}: ${x.label}`)}"><span></span></label>`);
      const line = (x) => `<div class="ex-row${hidden.has(x.value) ? " off" : ""}">${handle(x)}${x.badge}<div class="ex-name">${escape(x.label)}<small>${escape(x.sub)}</small></div>
          ${columns.map(([k, label], i) => toggle(k, label, x, i > 0 && hidden.has(x.value))).join("")}</div>`;
      const rows = items.map(line).join("");
      const allRow = columns
        .map(([k, label]) => cell(`<label class="switch"><input type="checkbox" data-list-all="${k}" ${items.every((x) => !sets[k].has(x.value)) ? "checked" : ""} aria-label="${escape(`${t("toggleAll")}: ${label}`)}"><span></span></label>`))
        .join("");
      return `<div class="opt-short ex-intro">${escape(intro)}</div>
        <div class="ex-head${multi ? " multi" : ""}"><span></span>${columns.map(([, label]) => (multi ? `<span class="ex-col">${escape(label)}</span>` : `<span>${escape(label)}</span>`)).join("")}</div>
        <div class="ex-row ex-all"><div class="ex-name">${escape(t("toggleAll"))}</div>${allRow}</div>
        ${drag ? `<div class="drag-list">${rows}</div>` : rows}`;
    };
    const integrations = (st.data.catalog?.integrations || []).map((i) => ({
      value: i.domain,
      label: i.name,
      sub: t("devicesCount", i.devices),
      badge: `<span class="ibadge" style="--h:${hue(i.domain)}">${escape(initials(i.name))}</span>`,
    }));
    const chips = this._connCatalog(d).map((x) => ({
      value: x.value,
      label: t(CONN[x.value].key),
      sub: x.devices ? t("devicesCount", x.devices) : t("typesEmpty"),
      badge: `<span class="ibadge type">${CONN[x.value].icon(18)}</span>`,
    }));
    const types = this._catalogTypes(d).map((x) => ({
      value: x.type,
      label: t(typeKey(x.type)),
      sub: x.devices ? t("devicesCount", x.devices) : t("typesEmpty"),
      badge: `<span class="ibadge type">${typeIcon(x.type, 18)}</span>`,
    }));
    const fields = {
      detection:
        row("offline_after", t("optOfflineAfter"), num("offline_after", t("minuteUnit"), t("optOfflineAfter")), t("optOfflineAfterShort"), t("optOfflineAfterInfo")) +
        row("flaky_outages", t("optFlaky"), num("flaky_outages", t("unitOutages"), t("optFlaky")), t("optFlakyShort"), t("optFlakyInfo")) +
        row("startup_grace", t("optGrace"), num("startup_grace", t("minuteUnit"), t("optGrace")), t("optGraceShort"), t("optGraceInfo")),
      battery:
        row("battery_low", t("optBatteryLow"), num("battery_low", t("unitPercent"), t("optBatteryLow")), t("optBatteryLowShort"), null) +
        row("battery_push", t("optBatteryPush"), sw("battery_push", t("optBatteryPush")), d.battery_push && noTarget ? null : t("optBatteryPushShort"), t("optBatteryPushInfo"),
          d.battery_push && noTarget ? t("optBatteryPushNoTarget") : null) +
        (d.battery_push
          ? row(
              "battery_push_mode",
              t("optPushMode"),
              `<span class="opt-pair">${select("battery_push_mode", [["instant", t("pushModeInstant")], ["daily", t("pushModeDaily")]], t("optPushMode"))}${
                d.battery_push_mode === "daily"
                  ? `<span class="opt-input${errors.battery_push_time ? " bad" : ""}"><input type="time" data-opt="battery_push_time" value="${escape(d.battery_push_time || "")}" aria-label="${escape(t("pushModeDaily"))}"></span>`
                  : ""
              }</span>`,
              d.battery_push_mode === "daily" ? t("optPushModeShortDaily", d.battery_push_time || "–") : t("optPushModeShortInstant"),
              null,
              null,
              ["battery_push_time"]
            ) +
            (d.battery_push_mode === "daily"
              ? row("battery_push_daily", t("optPushDaily"), select("battery_push_daily", [["new", t("dailyNew")], ["all", t("dailyAll")]], t("optPushDaily")), t("optPushDailyShort"), null)
              : "")
          : "") +
        row("battery_persistent", t("optBatteryPersistent"), sw("battery_persistent", t("optBatteryPersistent")), t("optBatteryPersistentShort"), t("optBatteryPersistentInfo")) +
        this._batOwnHtml(d, errors) +
        this._overridesHtml("battery"),
      integrations: exTable("exclude_integrations", integrations, t("integIntro"), false, [
        ["exclude_integrations", t("colShow")],
        ["notify_exclude_integrations", t("colPush")],
        ["persistent_exclude_integrations", t("colPersistent")],
      ]),
      types: exTable("exclude_types", types, `${t("hideIntro")} ${t("typesIntro")}`),
      connections: this._connIntegHtml(d) + this._overridesHtml("connection"),
      push:
        row("notify_service", t("optNotifyTarget"), select("notify_service", targets, t("optNotifyTarget")), t("optNotifyTargetShort"), t("optNotifyTargetInfo")) +
        row("notify_click_target", t("optClick"), select("notify_click_target", [["panel", t("clickPanel")], ["device", t("clickDevice")]], t("optClick")), t("optClickShort"), null) +
        row("notify_outage", t("optOutage"), sw("notify_outage", t("optOutage")), t("optOutageShort", st.data.values.offline_after ?? 2, errors.notify_delay ? st.data.values.notify_delay : d.notify_delay), null) +
        row("notify_online", t("optOnline"), sw("notify_online", t("optOnline")), t("optOnlineShort"), null) +
        row("notify_group", t("optGroup"), sw("notify_group", t("optGroup")), t("optGroupShort"), null) +
        row("notify_delay", t("optDelay"), num("notify_delay", t("minuteUnit"), t("optDelay")), t("optDelayShort"), null) +
        this._notifyFieldsHtml(d, changes) +
        this._overridesHtml("notify"),
      persistent: row("outage_persistent", t("optOutagePersistent"), sw("outage_persistent", t("optOutagePersistent")), t("optOutagePersistentShort"), null),
      display:
        row("show_service_devices", t("optShowService"), sw("show_service_devices", t("optShowService")), t("optShowServiceShort"), t("optShowServiceInfo")) +
        row("show_disabled_devices", t("optShowDisabled"), sw("show_disabled_devices", t("optShowDisabled")), t("optShowDisabledShort"), null) +
        // Filter-Chips der Verbindungsart (docs/mockups/view-v2, C): nur die Chips, gilt für alle.
        `<div class="opt bat-own${changes.has("hide_connections") || changes.has("connection_order") ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${escape(t("optChips"))}</span></div></div>` +
        exTable("hide_connections", chips, t("chipsIntro"), true) +
        ((d.connection_order || []).length
          ? `<div class="drag-reset"><button type="button" class="ovr-all" data-set="drag-reset">${mdi("reset", 15)}${escape(t("chipsOrderReset"))}</button></div>`
          : ""),
      updates: row("update_check", t("optUpdateCheck"), sw("update_check", t("optUpdateCheck")), t("optUpdateCheckShort"), t("optUpdateCheckInfo")),
    };
    const titles = {
      detection: "secDetection", battery: "secBattery", integrations: "secIntegrations", types: "secTypes", connections: "secConnections", push: "secPush",
      persistent: "secPersistent", display: "secDisplay", updates: "secUpdates",
    };
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
    dialog.addEventListener("click", (ev) => {
      const verBtn = ev.target.closest("[data-ver]");
      if (verBtn) {
        if (!verBtn.disabled) this._versionAction(verBtn.dataset.ver);
        return;
      }
      if (ev.target === dialog) {
        const r = dialog.getBoundingClientRect();
        if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) this._closeSettings();
        return;
      }
      const btn = ev.target.closest("[data-set]");
      if (!btn || btn.disabled || !this._settings) return;
      const st = this._settings;
      const action = btn.dataset.set;
      if (action === "close") this._closeSettings();
      else if (action === "save") this._saveSettings();
      else if (action === "section" || action === "info") {
        const set = action === "section" ? st.open : st.info;
        const key = action === "section" ? btn.dataset.id : btn.dataset.key;
        if (set.has(key)) set.delete(key);
        else set.add(key);
        this._renderSettings();
      } else if (action === "drag-reset") {
        if (!st.draft) return;
        st.draft.connection_order = [];
        this._renderSettings();
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
        if (JSON.stringify(order) !== JSON.stringify(this._connCatalog(st.draft).map((x) => x.value))) {
          st.draft.connection_order = order;
        }
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
      const order = this._connCatalog(st.draft).map((x) => x.value);
      const i = order.indexOf(h.dataset.key);
      const j = ev.key === "ArrowUp" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      st.draft.connection_order = order;
      this._renderSettings();
    });
    dialog.addEventListener("input", (ev) => {
      const st = this._settings;
      const el = ev.target;
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
      } else if (el.dataset.opt) {
        st.draft[el.dataset.opt] = el.value === "" ? null : Number(el.value);
      } else return;
      this._updateSettingsMeta();
    });
    dialog.addEventListener("change", (ev) => {
      const st = this._settings;
      const el = ev.target;
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
      if (el.dataset.nfield) {
        // Inhalt der Meldung: Liste in fester Reihenfolge.
        const on = new Set(st.draft.notify_fields || []);
        if (el.checked) on.add(el.dataset.nfield);
        else on.delete(el.dataset.nfield);
        st.draft.notify_fields = NOTIFY_FIELDS.filter((f) => on.has(f));
      } else if (el.dataset.opt) st.draft[el.dataset.opt] = el.checked;
      else if (el.dataset.list) {
        // Angezeigt = nicht in der Liste der Ausschlüsse.
        const list = new Set(st.draft[el.dataset.list]);
        if (el.checked) list.delete(el.dataset.value);
        else list.add(el.dataset.value);
        st.draft[el.dataset.list] = [...list].sort();
      } else if (el.dataset.listAll) {
        const key = el.dataset.listAll;
        const all = key.endsWith("exclude_integrations")
          ? (st.data.catalog?.integrations || []).map((i) => i.domain)
          : key === "hide_connections"
            ? this._connCatalog(st.draft).map((x) => x.value)
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
    if (cancel) cancel.textContent = changes.length ? this._t("settingsCancel") : this._t("close");
    const save = dialog.querySelector('[data-set="save"]');
    if (save) save.disabled = st.saving || !changes.length || Object.keys(errors).length > 0;
    // Batterie pro Integration: Zeilen markieren, Fehlerzeile, globaler Wert als Platzhalter.
    const bad = new Set(this._batInvalid());
    const saved = st.data.values.battery_low_integrations || {};
    const own = st.draft.battery_low_integrations || {};
    const std = errors.battery_low ? st.data.values.battery_low : st.draft.battery_low;
    for (const sel of dialog.querySelectorAll("select[data-bat-mode]")) {
      const dom = sel.dataset.batMode;
      const row = sel.closest(".ex-row");
      row?.classList.toggle("invalid", bad.has(dom));
      row?.classList.toggle("changed", own[dom] !== saved[dom]);
      const def = sel.querySelector('option[value="default"]');
      if (def) def.textContent = this._t("devBatDefault", std);
    }
    for (const input of dialog.querySelectorAll("input[data-bat]")) input.placeholder = String(std);
    const batErr = dialog.querySelector("[data-bat-error]");
    if (batErr) {
      batErr.hidden = !errors.battery_low_integrations;
      batErr.textContent = errors.battery_low_integrations || "";
    }
    // Uhrzeit der Tagesmeldung: Markierung, Fehler und Kurzzeile mit der
    // neuen Zeit, ohne Neuaufbau (Fokus im Zeitfeld bleibt).
    const timeInput = dialog.querySelector('input[type="time"][data-opt]');
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
    const batShort = dialog.querySelector("[data-bat-short]");
    if (batShort) batShort.textContent = this._t("batOwnShort", std);
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
    // "Ausfall melden" nennt die Wartezeit aus "Erst melden nach".
    const outageLine = dialog.querySelector('input[data-opt="notify_outage"]')?.closest(".opt")?.querySelector(".opt-short");
    if (outageLine) {
      const delay = errors.notify_delay ? st.data.values.notify_delay : st.draft.notify_delay;
      outageLine.textContent = this._t("optOutageShort", st.data.values.offline_after ?? 2, delay);
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

  async _saveSettings() {
    const st = this._settings;
    if (!st) return;
    const changes = this._settingsEntryChanges();
    const extra = this._settingsExtraChanges();
    const resets = { battery: [...st.resets.battery], notify: [...st.resets.notify], connection: [...st.resets.connection] };
    const anyReset = resets.battery.length > 0 || resets.notify.length > 0 || resets.connection.length > 0;
    if ((!changes.length && !extra.length && !anyReset) || Object.keys(this._settingsErrors()).length) return;
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
        // Ausgeschaltet: den HACS-Schalter zurücksetzen, falls das Panel ihn
        // eingeschaltet hat.
        if (!this._prerelease) await this._disableHacsPrerelease();
      }
      if (anyReset) await this._hass.callWS({ type: "device_panel/reset_device_settings", ...resets });
      // Erkennung, Batterie-Schwelle, Ausschlüsse und Anzeige ändern die Liste sofort.
      const quiet = ["update_check", "battery_push", "battery_persistent", "notify_service", "notify_click_target"];
      // Zurückgesetzte Geräte: Symbole und Batterie-Markierung in der Liste.
      if (anyReset || changes.some((k) => !quiet.includes(k))) this._fetch(true);
      await this._reloadSettings(st);
    } catch (err) {
      if (this._settings !== st) return;
      st.saving = false;
      st.saveError = (err && err.message) || String(err);
      this._renderSettings();
    }
  }

  // Nach dem Speichern: Dialog bleibt offen, mit dem gespeicherten Stand des
  // Backends (bereinigte Werte, Übersicht der Geräte-Einstellungen, Katalog).
  // Aufgeklappte Abschnitte und Infos bleiben.
  async _reloadSettings(st) {
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
    st.extraBase = { prerelease: Boolean(this._prerelease) };
    st.extra = { ...st.extraBase };
    st.resets = { battery: new Set(), notify: new Set(), connection: new Set() };
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

  _toast(text) {
    const el = this.shadowRoot.querySelector(".toast");
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    window.clearTimeout(this._toastTimer);
    this._toastTimer = window.setTimeout(() => (el.hidden = true), 3500);
  }

  // --- Versionsprüfung und Update über HACS (wie unifi_dynamic) -------------
  // Die neueste Version kommt von HACS (Update-Entität) und zusätzlich von
  // GitHub (device_panel/version), so klappt die Prüfung auch ohne HACS.
  // Installieren geht nur über HACS (update.install).

  // Update-Entität von HACS für dieses Repository. Erkannt am Link des
  // Releases, sonst am Titel bzw. an der Entity-ID, nie an einer festen ID.
  _hacsUpdateEntity() {
    const hass = this._hass;
    if (!hass || !hass.entities || !hass.states) return null;
    let fallback = null;
    for (const e of Object.values(hass.entities)) {
      if (!e || e.platform !== "hacs" || !String(e.entity_id).startsWith("update.")) continue;
      const st = hass.states[e.entity_id];
      if (!st) continue;
      const a = st.attributes || {};
      if (String(a.release_url || "").toLowerCase().includes(`/${REPO}/`)) return st;
      const title = String(a.title || "").trim().toLowerCase();
      if (!fallback && (title === "device panel" || e.entity_id === "update.device_panel_update")) fallback = st;
    }
    return fallback;
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
    // Deaktivierte Entitäten fehlen in hass.entities: dann gilt, was die
    // Entity-Registry geliefert hat (_loadHacsSwitch).
    const regSw = !sw && this._hacsSwitchReg && this._hacsSwitchReg.deviceId === deviceId ? this._hacsSwitchReg : null;
    const entityId = sw ? sw.entity_id : regSw ? regSw.entityId : null;
    const state = entityId ? hass.states[entityId] : null;
    return { deviceId, entityId, on: Boolean(state && state.state === "on"), disabled: Boolean(!sw && regSw && regSw.disabled) };
  }

  async _loadHacsSwitch() {
    const upd = this._hacsUpdateEntity();
    const reg = upd && this._hass.entities && this._hass.entities[upd.entity_id];
    if (!reg || !reg.device_id) return;
    try {
      const list = await this._hass.callWS({ type: "config/entity_registry/list" });
      const e = (Array.isArray(list) ? list : []).find(
        (x) => x && x.platform === "hacs" && x.device_id === reg.device_id && String(x.entity_id).startsWith("switch.") && /pre.?release/i.test(`${x.entity_id} ${x.translation_key || ""} ${x.original_name || ""}`)
      );
      this._hacsSwitchReg = e ? { deviceId: reg.device_id, entityId: e.entity_id, disabled: Boolean(e.disabled_by) } : null;
    } catch (err) {
      this._hacsSwitchReg = null;
    }
  }

  // "In HACS freischalten": Entität aktivieren (falls nötig), warten, bis
  // HA sie nach dem Neuladen von HACS freigibt (etwa 30 s), einschalten und
  // HACS die Versionen neu laden lassen. Nur auf Knopfdruck.
  async _enableHacsPrerelease() {
    const v = (this._version = this._version || {});
    const sw = this._hacsPreReleaseSwitch();
    if (!sw || !sw.entityId) return;
    v.hacsEnabling = true;
    v.hacsError = null;
    this._renderSettingsVersion();
    try {
      if (sw.disabled || !this._hass.states[sw.entityId]) {
        await this._hass.callWS({ type: "config/entity_registry/update", entity_id: sw.entityId, disabled_by: null });
        const until = Date.now() + 90000;
        while (!this._hass.states[sw.entityId] && Date.now() < until) await new Promise((r) => setTimeout(r, 1000));
        if (!this._hass.states[sw.entityId]) throw new Error(this._t("verPreEnableTimeout"));
        this._hacsSwitchReg = { ...(this._hacsSwitchReg || {}), deviceId: sw.deviceId, entityId: sw.entityId, disabled: false };
      }
      await this._callService("switch", "turn_on", { entity_id: sw.entityId });
      this._prereleaseHacs = sw.entityId;
      await this._hass.callWS({ type: "device_panel/set_panel", prerelease_hacs: sw.entityId });
      await this._refreshHacs();
    } catch (err) {
      v.hacsError = (err && err.message) || String(err);
    }
    v.hacsEnabling = false;
    this._renderSettingsVersion();
    await this._loadVersion(false);
  }

  // Beim Ausschalten von "Vorabversionen anzeigen": den HACS-Schalter nur
  // zurücksetzen, wenn das Panel ihn selbst eingeschaltet hat.
  async _disableHacsPrerelease() {
    const id = this._prereleaseHacs;
    if (!id) return;
    this._prereleaseHacs = null;
    try {
      await this._hass.callWS({ type: "device_panel/set_panel", prerelease_hacs: null });
    } catch (err) {
      // Nicht kritisch.
    }
    const st = this._hass.states[id];
    if (st && st.state === "on") {
      try {
        await this._callService("switch", "turn_off", { entity_id: id });
        await this._refreshHacs();
      } catch (err) {
        // Nicht kritisch: der Schalter bleibt dann in HACS an.
      }
    }
  }

  async _loadVersion(force = false) {
    const v = (this._version = this._version || {});
    if (force) {
      v.checking = true;
      // Neue Prüfung: alte Meldungen verwerfen, der neue Stand zählt.
      v.installError = null;
    }
    v.error = null;
    this._renderSettingsVersion();
    const jobs = [
      // Vorabversion immer mitabfragen: auch bei ausgeschaltetem Schalter
      // muss das Panel wissen, welche Version GitHub als Pre-Release führt,
      // damit es eine solche von HACS gemeldete Version nicht als stabil
      // anbietet. Angezeigt wird sie nur mit eingeschaltetem Schalter.
      this._hass.callWS({ type: "device_panel/version", force, prerelease: true }).then(
        (r) => {
          v.data = r;
          if (!this._settings || !this._settings.extra) this._applyPanelSettings(r && r.panel);
        },
        (err) => (v.error = (err && err.message) || String(err))
      ),
    ];
    // HACS prüft sonst nur alle paar Tage: auf Knopfdruck sofort neu laden.
    if (force) jobs.push(this._refreshHacs());
    await Promise.all(jobs);
    // GitHub kennt eine neuere Version als HACS: HACS einmal pro Sitzung
    // auch ohne Knopfdruck nachladen lassen, sonst lässt sie sich nicht über
    // HACS installieren.
    const { hacs, a, latest } = this._versionState();
    if (!force && hacs && !v.hacsRefreshed && latest && (!a.latest_version || this._cmpVersion(latest, a.latest_version) > 0)) {
      v.hacsRefreshed = true;
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
    if (v.data && v.data.error && !v.data.latest && !v.data.prerelease) v.error = v.data.error;
    if (this._versionState().betaBlocked) await this._loadHacsSwitch();
    this._renderSettingsVersion();
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
    const row = (cls, iconName, title, sub, right) => `<div class="ver ${cls}">
        <span class="ver-ic">${mdi(iconName, 20)}</span>
        <div class="ver-t"><b>${escape(title)}</b><small>${escape(sub)}</small></div>
        ${right ? `<div class="ver-btns">${right}</div>` : ""}</div>`;
    const notes = url ? `<a class="ver-link" href="${escape(url)}" target="_blank" rel="noopener">${escape(t("verReleaseNotes"))}${mdi("open", 15)}</a>` : "";
    if (v.restarting) return row("rst", "reset", t("verRestarting"), t("verRestartSub"), "");
    if (restart) {
      return row("rst", "reset", t("verRestartNeeded", a.installed_version), t("verRestartSub"),
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
      const canEnable = Boolean(preSwitch && preSwitch.entityId);
      const hint = betaBlocked
        ? `<div class="ver-hint">${escape(t(canEnable ? "verPreHintEnable" : "verPreHint"))}${v.hacsError ? `<div class="ver-hint-err">${escape(t("verPreEnableError"))} ${escape(v.hacsError)}</div>` : ""}<div class="ver-hint-acts">${
            canEnable
              ? `<button type="button" class="ver-btn" data-ver="hacs-enable" ${v.hacsEnabling ? 'disabled aria-busy="true"' : ""}>${v.hacsEnabling ? `<span class="ver-spin"></span>${escape(t("verPreEnabling"))}` : `${mdi("flask", 16)}${escape(t("verPreEnable"))}`}</button>`
              : ""
          }${preSwitch && preSwitch.deviceId ? `<button type="button" class="ver-hint-link" data-ver="hacs-device" data-device-id="${escape(preSwitch.deviceId)}">${escape(t("verPreHintLink"))}</button>` : ""}</div></div>`
        : "";
      const html = row(beta ? "upd beta" : "upd", beta ? "flask" : "verUp", t("verAvailable", latest), sub, `${notes}${checkBtn}${installBtn}`);
      // Etikett "Beta" in den Titel, Hinweis in den Kasten.
      return beta ? html.replace("</b>", ` <span class="ver-tag">${escape(t("verBeta"))}</span></b>`).replace(/<\/div>\s*$/, `${hint}</div>`) : html;
    }
    const checked = d.checked_at ? t("verChecked", this._formatRelative(d.checked_at)) : "";
    const err = v.error === "rate_limit" ? t("verRateLimit") : v.error;
    const sub = v.checking ? t("verCheckingSub") : v.error ? `${t("verCheckError")} ${err}` : [t("verCurrent"), checked].filter(Boolean).join(" · ");
    // Beschriftung bleibt während der Prüfung gleich, nur das Symbol wird
    // zum Spinner: so springt die Zeile nicht (Höhe des Blatts auf dem Handy).
    // Fehlgeschlagene Prüfung nicht mit Häkchen ("aktuell") darstellen.
    const failed = Boolean(v.error && !v.checking);
    return row(failed ? "err" : "ok", failed ? "alert" : "verOk", t("verName", installed || "?"), sub,
      `<button type="button" class="ver-btn" data-ver="check" ${v.checking ? `disabled aria-busy="true" title="${escape(t("verChecking"))}"` : ""}>${v.checking ? `<span class="ver-spin"></span>` : mdi("verCheck", 16)}${escape(t("verCheck"))}</button>`);
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
    } else if (action === "hacs-enable") {
      await this._enableHacsPrerelease();
    } else if (action === "hacs-device") {
      const sw = this._hacsPreReleaseSwitch();
      if (sw && sw.deviceId) {
        this._closeSettings();
        this._navigate(`/config/devices/device/${sw.deviceId}`);
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
        v.installError = (err && err.message) || String(err);
      }
      v.installing = null;
      this._renderSettingsVersion();
    } else if (action === "restart") {
      if (!window.confirm(this._t("verRestartConfirm"))) return;
      v.restarting = true;
      this._renderSettingsVersion();
      try {
        await this._callService("homeassistant", "restart", {});
      } catch (err) {
        // Die Verbindung bricht beim Neustart ab; ein Fehler hier ist normal.
      }
    }
  }

}

customElements.define("device-panel", DevicePanel);
