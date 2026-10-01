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

// innerHTML nur bei echter Änderung ersetzen; Vergleich mit dem zuletzt
// gesetzten String, nie mit el.innerHTML (siehe LEARNINGS).
const lastHtml = new WeakMap();
function setHtml(el, html) {
  if (!el || lastHtml.get(el) === html) return false;
  el.innerHTML = html;
  lastHtml.set(el, html);
  return true;
}

function escape(value) {
  const div = document.createElement("div");
  div.textContent = value == null ? "" : String(value);
  return div.innerHTML;
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
  open: "M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z",
  chevron: "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z",
  pulse: "M3,13H5.79L10.1,4.79L11.28,13.75L14.5,9.66L17.83,13H21V15H17L14.67,12.67L9.92,18.73L8.94,11.31L7,15H3V13Z",
};
// Gerätetypen (devices.DEVICE_TYPES), gleiche Schlüssel wie im Backend.
const TYPE_ICONS = {
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

const LOGO = `<svg width="30" height="30" viewBox="22 22 212 212" aria-hidden="true"><defs><linearGradient id="dpg" x1="28" y1="20" x2="228" y2="236" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7ADFFD"/><stop offset=".5" stop-color="#22A9F9"/><stop offset="1" stop-color="#1C7DF9"/></linearGradient></defs><path d="M60 44 H112 A84 84 0 0 1 112 212 H60 Z" fill="none" stroke="url(#dpg)" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/><path d="M86 128 H104 L118 94 L136 164 L150 128 H168" fill="none" stroke="url(#dpg)" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

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

function ringSvg(pct, size, width) {
  const r = (size - width) / 2;
  const c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--dp-bar-off)" stroke-width="${width}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--dp-success)" stroke-width="${width}" stroke-linecap="round"
      stroke-dasharray="${((c * pct) / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}

// Verfügbarkeit 24 Std. als Streifen: 0 online, 1 Unterbruch, 2 keine Daten.
function stripSvg(strip) {
  const rects = strip.map((v, i) => `<rect x="${i * 2}" y="0" width="1.4" height="14" rx=".5" class="s${v}"/>`).join("");
  return `<svg class="strip" width="${strip.length * 2}" height="14" viewBox="0 0 ${strip.length * 2} 14" aria-hidden="true">${rects}</svg>`;
}

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
    this._conn = "all";
    this._problems = false;
    this._hint = null;
    this._matter = new Map();
    this._flakyOutages = 3;
    this._pulse = null;
    this._incidents = [];
    // Geräte-Popup und Statistik-Fenster
    this._detailId = null;
    this._detail = null;
    this._statRange = null;
    this._hist = null;
    this._narrowQuery = window.matchMedia(NARROW_QUERY);
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) {
      this._build();
      this._fetch();
    }
  }

  connectedCallback() {
    this._timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") this._fetch();
    }, POLL_INTERVAL_MS);
    this._tick = window.setInterval(() => this._hass && this._render(), TICK_MS);
    this._onVisible = () => document.visibilityState === "visible" && this._fetch();
    document.addEventListener("visibilitychange", this._onVisible);
    this._onNarrow = () => this._render();
    this._narrowQuery.addEventListener("change", this._onNarrow);
  }

  disconnectedCallback() {
    window.clearInterval(this._timer);
    window.clearInterval(this._tick);
    document.removeEventListener("visibilitychange", this._onVisible);
    this._narrowQuery.removeEventListener("change", this._onNarrow);
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
        <label class="searchbox">${mdi("search", 20)}<input class="search" type="search" placeholder="${escape(this._t("search"))}" aria-label="${escape(this._t("search"))}"></label>
      </div>
      <div class="content"><div class="hero"></div><div class="chips"></div><div class="list"></div><div class="foot"></div></div>
      <dialog class="device"></dialog><dialog class="stat-dlg"></dialog>`;
    const root = this.shadowRoot;
    root.querySelector(".search").addEventListener("input", (ev) => {
      this._search = ev.target.value.trim().toLowerCase();
      this._render();
    });
    const content = root.querySelector(".content");
    content.addEventListener("click", (ev) => {
      const open = ev.target.closest("[data-open]");
      if (open) {
        this._openDevice(open.dataset.open);
        return;
      }
      const el = ev.target.closest("[data-conn],[data-problems],[data-hint]");
      if (!el || el.disabled) return;
      if (el.dataset.conn) this._conn = el.dataset.conn;
      else if (el.dataset.problems !== undefined) this._problems = !this._problems;
      else if (el.dataset.hint) this._hint = this._hint === el.dataset.hint ? null : el.dataset.hint;
      this._render();
    });
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

  // Nie zwei Abfragen gleichzeitig.
  async _fetch() {
    if (!this._hass || this._fetching) return;
    this._fetching = true;
    try {
      const result = await this._hass.callWS({ type: "device_panel/list_devices" });
      this._devices = (result.devices || []).filter((d) => !d.service && d.entities > 0);
      this._integrations = result.integrations || {};
      this._flakyOutages = result.flaky_outages || 3;
      this._pulse = Array.isArray(result.pulse) ? result.pulse : null;
      this._incidents = result.incidents || [];
      const serverNow = Date.parse(result.now);
      this._offset = Number.isFinite(serverNow) ? serverNow - Date.now() : 0;
      this._serverNow = (Number.isFinite(serverNow) ? serverNow : Date.now()) / 1000;
      this._fetchedAt = new Date();
      this._error = null;
    } catch (err) {
      this._error = (err && err.message) || String(err);
    } finally {
      this._fetching = false;
      this._loading = false;
      this._render();
      this._refineMatter();
      if (this._detailId) {
        this._loadDetail();
        if (this._statRange) this._loadHistory();
      }
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
        if (d.connection !== "matter") continue;
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

  _connOf(d) {
    if (d.connection === "matter") return this._matter.get(d.id)?.type || "matter";
    return CONN[d.connection] ? d.connection : "unknown";
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

  _durationHtml(d, short = false) {
    const text = this._duration(d.offline_since, short);
    return d.since_restart ? `<span title="${escape(this._t("sinceRestart"))}">≥ ${escape(text)}</span>` : escape(text);
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
    if (this._conn !== "all" && this._connOf(d) !== this._conn) return false;
    if (this._problems && !(d.online !== true || d.flaky || d.battery?.low || isWeak(d.signal))) return false;
    if (this._hint === "battery" && !d.battery?.low) return false;
    if (this._hint === "signal" && !isWeak(d.signal)) return false;
    if (this._hint === "update" && !d.update) return false;
    if (!this._search) return true;
    const integs = (d.integrations || []).map((dom) => this._integrations[dom] || dom);
    return [d.name, d.area, d.manufacturer, d.model, d.sw_version, ...integs, d.integration?.title, this._t(typeKey(d.type)), this._t(CONN[this._connOf(d)].key), d.via]
      .join(" ")
      .toLowerCase()
      .includes(this._search);
  }

  // --- Liste ----------------------------------------------------------------

  _render() {
    const root = this.shadowRoot;
    if (!root.querySelector(".content")) return;
    const all = this._devices;
    const offline = all.filter((d) => d.online === false).sort((a, b) => Date.parse(a.offline_since) - Date.parse(b.offline_since));
    setHtml(root.querySelector(".hero"), this._loading ? "" : this._heroHtml(all, offline));
    setHtml(root.querySelector(".chips"), this._loading ? "" : this._chipsHtml(all));
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
    // Protokoll Daten hat), sonst der Anteil, der gerade online ist.
    const withAvail = all.filter((d) => d.avail24);
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
        <div class="top"><span class="num">${offline.length}</span><span class="lbl">${escape(this._t("longest", this._duration(offline[0].offline_since)))}</span></div>
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
    const counts = new Map();
    for (const d of all) counts.set(this._connOf(d), (counts.get(this._connOf(d)) || 0) + 1);
    const types = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const chip = (key, label, n, icon = "") =>
      `<button type="button" class="chip ${this._conn === key ? "on" : ""}" data-conn="${key}" aria-pressed="${this._conn === key}">${icon}<span>${escape(label)}</span> <span class="n">${n}</span></button>`;
    let html = chip("all", this._t("all"), all.length);
    for (const [key, n] of types) html += chip(key, this._t(CONN[key].key), n, CONN[key].icon(15));
    html += `<span class="vsep"></span><button type="button" class="chip ${this._problems ? "on" : ""}" data-problems aria-pressed="${this._problems}">${mdi("alert", 15)}<span>${escape(this._t("onlyProblems"))}</span></button>`;
    // Hinweise als Filter-Chips, nur wenn sie etwas finden (oder aktiv sind).
    const hints = [
      ["battery", "b", "battery", "hintBattery", all.filter((d) => d.battery?.low).length],
      ["signal", "s", "signal", "hintSignal", all.filter((d) => isWeak(d.signal)).length],
      ["update", "u", "update", "hintUpdate", all.filter((d) => d.update).length],
    ];
    for (const [key, cls, icon, label, n] of hints) {
      if (!n && this._hint !== key) continue;
      const on = this._hint === key;
      html += `<button type="button" class="chip hint ${cls} ${on ? "on" : ""}" data-hint="${key}" aria-pressed="${on}">${mdi(icon, 15)}<span>${escape(this._t(label))}</span> <span class="n">${n}</span></button>`;
    }
    return html;
  }

  _avatar(d, size = 18) {
    const cls = d.online === false ? "off" : d.online == null ? "none" : d.flaky ? "warn" : "";
    return `<div class="av ${cls}">${CONN[this._connOf(d)].icon(size)}<span class="dot"></span></div>`;
  }

  _statusHtml(d) {
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
    return `<span class="avc ${a.outages ? "bad" : ""}">${stripSvg(a.strip || [])}${escape(this._fmtPct(a.pct))} %</span>`;
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

  _groups(rows) {
    const byName = (a, b) => String(a.name).localeCompare(String(b.name));
    const outages = (d) => d.avail24?.outages || 0;
    return [
      ["e", this._t("groupOffline"), this._t("groupOfflineHint"), rows.filter((d) => d.online === false).sort((a, b) => Date.parse(a.offline_since) - Date.parse(b.offline_since))],
      ["w", this._t("groupFlaky"), this._t("groupFlakyHint", this._flakyOutages), rows.filter((d) => d.online === true && d.flaky).sort((a, b) => outages(b) - outages(a) || byName(a, b))],
      ["n", this._t("groupNoData"), this._t("groupNoDataHint"), rows.filter((d) => d.online == null).sort(byName)],
      ["", this._t("groupOnline"), null, rows.filter((d) => d.online === true && !d.flaky).sort(byName)],
    ].filter((g) => g[3].length);
  }

  _listHtml(rows) {
    if (this._loading) return `<div class="note">${escape(this._t("loading"))}</div>`;
    if (this._error) return `<div class="note">${escape(this._t("error"))} ${escape(this._error)}</div>`;
    if (!rows.length) return `<div class="note">${escape(this._t("empty"))}</div>`;
    return this._narrowQuery.matches ? this._cardsHtml(rows) : this._tableHtml(rows);
  }

  _tableHtml(rows) {
    const cols = ["colName", "colStatus", "colConnection", "colAvail", "colType", "colIntegration", "colBattery", "colModel", "colSoftware"];
    const head = `<thead><tr>${cols.map((c) => `<th>${escape(this._t(c))}</th>`).join("")}</tr></thead>`;
    const body = this._groups(rows)
      .map(([cls, title, hint, list]) =>
        `<tr class="grp ${cls}"><td colspan="${cols.length}"><span class="gl">${escape(title)} · ${list.length}${hint ? ` <small>${escape(hint)}</small>` : ""}</span></td></tr>` +
        list
          .map((d) => {
            const title = this._integTitle(d);
            return `<tr class="dev ${d.online === false ? "off" : d.online && d.flaky ? "flaky" : ""}" data-open="${escape(d.id)}" tabindex="0">
            <td><div class="nc">${this._avatar(d)}<div>${escape(d.name)}${d.area ? `<span class="sub">${escape(d.area)}</span>` : ""}</div></div></td>
            <td>${this._statusHtml(d)}</td>
            <td>${this._connHtml(d)}</td>
            <td>${this._availHtml(d)}</td>
            <td>${this._typeHtml(d)}</td>
            <td>${escape(this._integName(d) || "–")}${title ? `<span class="sub">${escape(title)}</span>` : ""}</td>
            <td>${this._batteryHtml(d)}</td>
            <td>${escape(d.manufacturer || "–")}${d.model ? `<span class="sub">${escape(d.model)}</span>` : ""}</td>
            <td>${this._softwareHtml(d)}</td></tr>`;
          })
          .join(""))
      .join("");
    return `<div class="tcard"><table>${head}<tbody>${body}</tbody></table></div>`;
  }

  _cardsHtml(rows) {
    const meta = (d) => [this._t(typeKey(d.type)), this._integName(d), d.area].filter(Boolean).map(escape).join(" · ");
    return `<div class="cards">${this._groups(rows)
      .map(([cls, title, , list]) => {
        const head = `<div class="gh ${cls}">${escape(title)} · ${list.length}</div>`;
        if (cls === "") {
          return head + `<div class="mlist">${list
            .map((d) => `<div class="mrow dev" data-open="${escape(d.id)}" tabindex="0" role="button">${this._avatar(d, 16)}<div>${escape(d.name)}<span class="sub">${meta(d)}</span></div>
              <div>${d.battery?.low ? this._batteryHtml(d) : bars(sigLevel(d.signal), false)}</div></div>`)
            .join("")}</div>`;
        }
        return head + list
          .map((d) => {
            let right = this._statusHtml(d);
            if (d.online === false) right = `<div class="dur">${this._durationHtml(d, true)}</div><div class="durs">${escape(this._t("statusOffline"))}</div>`;
            return `<div class="mc dev ${d.online === false ? "off" : d.flaky ? "flaky" : ""}" data-open="${escape(d.id)}" tabindex="0" role="button">${this._avatar(d)}
            <div><div class="nm">${escape(d.name)}</div><div class="sb">${this._connHtml(d, false)}</div><div class="sb2">${meta(d)}</div></div>
            <div class="rt">${right}</div></div>`;
          })
          .join("");
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

  _resetDevice() {
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
        s24 ? `${escape(this._fmtPct(s24.pct))}<small>%</small>` : `<span class="t3">–</span>`,
        !s24 ? this._t("statNoData") : s24.outages ? this._t("statOutages", s24.outages, this._fmtSeconds(s24.longest)) : this._t("statNoOutages")
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
    const tiles = [this._tile(this._t("connType"), `<span class="sig">${CONN[type].icon(16)} ${escape(this._t(CONN[type].key))}</span>`)];
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

  _deviceSectionHtml(d) {
    const text = (v) => (v ? escape(v) : `<span class="t3">–</span>`);
    const sw = `${text(d.sw_version)}${d.update ? `<small class="upd">${escape(this._t("updateTo", d.update))}</small>` : ""}`;
    const tiles = [
      this._tile(this._t("typeLabel"), this._typeHtml(d)),
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
    let html;
    if (!d) {
      html = `<div class="dlg-head"><span class="dlg-avatar none">${typeIcon("other", 28)}</span><div class="dlg-title"><h2>–</h2></div>${close}</div>
        <div class="dlg-body"><p class="dlg-note">${escape(this._t("deviceGone"))}</p></div>`;
    } else {
      let status = `<span class="pill on"><span class="pd"></span>${escape(this._t("statusOnline"))}</span>`;
      let avatar = "";
      if (d.online === false) {
        status = `<span class="pill off"><span class="pd"></span>${escape(this._t("statusOfflinePill", `${d.since_restart ? "≥ " : ""}${this._duration(d.offline_since)}`))}</span>`;
        avatar = "off";
      } else if (d.online == null) {
        status = `<span class="pill none">${escape(this._t("statusNoData"))}</span>`;
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
    if (sel) dlg.querySelector(sel)?.focus();
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
    const top = `<div class="avail-top"><span class="avail-pct">${escape(this._fmtPct(pct))}<small>%</small></span><span class="avail-facts">${facts.join(" · ")}</span></div>`;
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
}

customElements.define("device-panel", DevicePanel);
