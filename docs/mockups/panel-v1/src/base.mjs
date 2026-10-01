// Gemeinsame Bausteine der Mockups: erfundene Daten, Symbole, Farben, Helfer.
import { fileURLToPath } from "node:url";
const here = fileURLToPath(new URL(".", import.meta.url));
const font = (w) => `file://${here}node_modules/@fontsource/roboto/files/roboto-latin-${w}-normal.woff2`;

// --- Symbole (MDI-Pfade bzw. eigene Strichzeichnungen) -------------------
const P = {
  search: "M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z",
  cog: "M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z",
  columns: "M16,5V18H21V5M4,18H9V5H4M10,18H15V5H10V18Z",
  filter: "M14,12V19.88C14.04,20.18 13.94,20.5 13.71,20.71C13.32,21.1 12.69,21.1 12.3,20.71L10.29,18.7C10.06,18.47 9.96,18.16 10,17.87V12H9.97L4.21,4.62C3.87,4.19 3.95,3.56 4.38,3.22C4.57,3.08 4.78,3 5,3V3H19V3C19.22,3 19.43,3.08 19.62,3.22C20.05,3.56 20.13,4.19 19.79,4.62L14.03,12H14Z",
  close: "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
  wifi: "M12,21L15.6,16.2C14.6,15.45 13.35,15 12,15C10.65,15 9.4,15.45 8.4,16.2L12,21M12,3C7.95,3 4.21,4.34 1.2,6.6L3,9C5.5,7.12 8.62,6 12,6C15.38,6 18.5,7.12 21,9L22.8,6.6C19.79,4.34 16.05,3 12,3M12,9C9.3,9 6.81,9.89 4.8,11.4L6.6,13.8C8.1,12.67 9.97,12 12,12C14.03,12 15.9,12.67 17.4,13.8L19.2,11.4C17.19,9.89 14.7,9 12,9Z",
  ble: "M14.88,16.29L13,18.17V14.41M13,5.83L14.88,7.71L13,9.58M17.71,7.71L12,2H11V9.58L6.41,5L5,6.41L10.59,12L5,17.58L6.41,19L11,14.41V22H12L17.71,16.29L13.41,12L17.71,7.71Z",
  cloud: "M6.5,20Q4.22,20 2.61,18.43 1,16.85 1,14.58 1,12.63 2.17,11.1 3.35,9.57 5.25,9.15 5.88,6.85 7.75,5.43 9.63,4 12,4 14.93,4 16.96,6.04 19,8.07 19,11 20.73,11.2 21.86,12.5 23,13.78 23,15.5 23,17.38 21.69,18.69 20.38,20 18.5,20Z",
  lan: "M7,15H9V18H11V15H13V18H15V15H17V18H18V9H15V6H9V9H6V18H7V15M4.38,3H19.63C20.94,3 22,4.06 22,5.38V19.63A2.37,2.37 0 0,1 19.63,22H4.38C3.06,22 2,20.94 2,19.63V5.38C2,4.06 3.06,3 4.38,3Z",
  open: "M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z",
  bellOff: "M20.84,22.73L18.11,20H3V19L5,17V11C5,9.86 5.29,8.73 5.83,7.72L1.11,3L2.39,1.73L22.11,21.46L20.84,22.73M19,15.8V11C19,7.9 16.97,5.17 14,4.29C14,4.19 14,4.1 14,4A2,2 0 0,0 12,2A2,2 0 0,0 10,4C10,4.1 10,4.19 10,4.29C9.39,4.47 8.8,4.74 8.26,5.09L19,15.8M12,23A2,2 0 0,0 14,21H10A2,2 0 0,0 12,23Z",
  eyeOff: "M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.08L19.73,22L21,20.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C21.07,15.5 22.27,13.86 23,12C21.27,7.61 17,4.5 12,4.5C10.6,4.5 9.26,4.75 8,5.2L10.17,7.35C10.74,7.13 11.35,7 12,7Z",
  drag: "M7,19V17H9V19H7M11,19V17H13V19H11M15,19V17H17V19H15M7,15V13H9V15H7M11,15V13H13V15H11M15,15V13H17V15H15M7,11V9H9V11H7M11,11V9H13V11H11M15,11V9H17V11H15M7,7V5H9V7H7M11,7V5H13V7H11M15,7V5H17V7H15Z",
  chevDown: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  chevUp: "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z",
  chevRight: "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z",
  refresh: "M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z",
  download: "M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z",
  info: "M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z",
  alert: "M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z",
  sort: "M7,15L12,20L17,15H7M7,9H17L12,4L7,9Z",
  update: "M21,10.12H14.22L16.96,7.3C14.23,4.6 9.81,4.5 7.08,7.2C4.35,9.91 4.35,14.28 7.08,17C9.81,19.7 14.23,19.7 16.96,17C18.32,15.65 19,14.08 19,12.1H21C21,14.08 20.12,16.65 18.36,18.39C14.85,21.87 9.15,21.87 5.64,18.39C2.14,14.92 2.11,9.28 5.62,5.81C9.13,2.34 14.76,2.34 18.27,5.81L21,3V10.12M12.5,8V12.25L16,14.33L15.28,15.54L11,13V8H12.5Z",
  battery: "M16,20H8V6H16M16.67,4H15V2H9V4H7.33A1.33,1.33 0 0,0 6,5.33V20.67C6,21.4 6.6,22 7.33,22H16.67A1.33,1.33 0 0,0 18,20.67V5.33C18,4.6 17.4,4 16.67,4Z",
  pulse: "M3,13H5.79L10.1,4.79L11.28,13.75L14.5,9.66L17.83,13H21V15H17L14.67,12.67L9.92,18.73L8.94,11.31L7,15H3V13Z",
  history: "M13.5,8H12V13L16.28,15.54L17,14.33L13.5,12.25V8M13,3A9,9 0 0,0 4,12H1L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3",
  lightning: "M11,15H6L13,1V9H18L11,23V15Z",
};
export const ic = (name, size = 18, cls = "") =>
  `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24"><path fill="currentColor" d="${P[name]}"/></svg>`;

// Funk-Symbole ohne MDI-Vorlage: einfache Strichzeichnungen.
const STROKE = (d, size) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const connIcon = (kind, size = 18) => {
  switch (kind) {
    case "zigbee": return STROKE(`<circle cx="12" cy="12" r="9.2"/><path d="M8 8.2h8l-8 7.6h8"/>`, size);
    case "thread": return STROKE(`<circle cx="12" cy="12" r="9.2"/><path d="M12 19V9.5a2.6 2.6 0 0 1 5.2 0c0 1.5-1.2 2.6-2.6 2.6H6.8"/>`, size);
    case "zwave": return STROKE(`<path d="M5 7h9l-9 10h9"/><path d="M16 9.5c1.6 1.4 1.6 3.6 0 5M18.6 7.5c2.8 2.5 2.8 6.5 0 9"/>`, size);
    case "wifi": return ic("wifi", size);
    case "ble": return ic("ble", size);
    case "lan": return ic("lan", size);
    case "cloud": return ic("cloud", size);
  }
  return "";
};
export const CONN = {
  zigbee: "Zigbee", thread: "Thread", wifi: "WLAN", ble: "Bluetooth", zwave: "Z-Wave", lan: "LAN", cloud: "Cloud",
};

// Signalstufen wie Ping/WLAN in unifi_dynamic (DESIGN.md --dp-tier*).
const TIER = { 4: "var(--t5)", 3: "var(--t4)", 2: "var(--t3)", 1: "var(--t1)", 0: "var(--text3)" };
export function sigLevel(sig) {
  if (!sig) return null;
  if (sig.kind === "dbm") return sig.v >= -60 ? 4 : sig.v >= -70 ? 3 : sig.v >= -80 ? 2 : 1;
  return sig.v >= 150 ? 4 : sig.v >= 100 ? 3 : sig.v >= 60 ? 2 : 1;
}
export function bars(level, dim = false) {
  if (level == null) return "";
  const c = dim ? "var(--text3)" : TIER[level];
  const r = [0, 1, 2, 3].map((i) => `<rect x="${i * 4.4}" y="${11 - (i + 1) * 2.7}" width="3" height="${(i + 1) * 2.7}" rx="1" fill="${i < level ? c : "var(--bar-off)"}"/>`).join("");
  return `<svg class="bars" width="17" height="12" viewBox="0 0 17 12">${r}</svg>`;
}
export const sigText = (sig) => (!sig ? "" : sig.kind === "dbm" ? `${sig.v} dBm` : `LQI ${sig.v}`);

// --- Erfundene Geräte -------------------------------------------------------
// status: off = ausgefallen, flaky = instabil (viele Unterbrüche), on = online.
export const DEVICES = [
  { name: "Temperatur Keller", area: "Keller", integ: "bthome", maker: "Polarwerk", model: "TH-2", sw: "1.0.3", conn: "ble", sig: { kind: "dbm", v: -91 }, via: "Proxy Garage", bat: 0, status: "off", since: "3 T. 4 Std.", sinceShort: "3 T.", avail: 0, out: 1, health: 12 },
  { name: "Bewegungsmelder Flur", area: "Flur", integ: "zha", maker: "Nordlicht", model: "MS-30", sw: "2.1.4", upd: true, conn: "zigbee", sig: { kind: "lqi", v: 38 }, via: "Steckdose Flur", bat: 8, status: "off", since: "2 Std. 14 Min.", sinceShort: "2 Std.", avail: 90.7, out: 2, health: 31 },
  { name: "Thermostat Bad", area: "Bad", integ: "matter", maker: "Alpenfunk", model: "Therm T1", sw: "1.4.0", conn: "thread", sig: null, via: "Border Router Wohnzimmer", bat: 22, status: "off", since: "47 Min.", sinceShort: "47 Min.", avail: 96.7, out: 1, health: 54 },
  { name: "Steckdose Terrasse", area: "Terrasse", integ: "shelly", maker: "Voltix", model: "Plug S", sw: "1.6.2", conn: "wifi", sig: { kind: "dbm", v: -84 }, status: "off", since: "6 Min.", sinceShort: "6 Min.", avail: 98.1, out: 3, health: 58 },
  { name: "Fensterkontakt Küche", area: "Küche", integ: "zha", maker: "Nordlicht", model: "DW-10", sw: "2.0.9", conn: "zigbee", sig: { kind: "lqi", v: 61 }, bat: 64, status: "flaky", out: 5, avail: 97.4, health: 66 },
  { name: "Präsenzsensor Büro", area: "Büro", integ: "esphome", maker: "Eigenbau", model: "mmWave", sw: "2026.9.1", conn: "wifi", sig: { kind: "dbm", v: -79 }, status: "flaky", out: 3, avail: 98.9, health: 71 },
  { name: "Deckenlicht Wohnzimmer", area: "Wohnzimmer", integ: "hue", maker: "Lumetta", model: "Bulb E27", sw: "1.122.2", conn: "zigbee", sig: null, via: "Bridge", status: "on", out: 0, avail: 100, health: 98 },
  { name: "Stromzähler", area: "Keller", integ: "esphome", maker: "Eigenbau", model: "IR-Lesekopf", sw: "2026.9.1", upd: true, conn: "wifi", sig: { kind: "dbm", v: -61 }, status: "on", out: 0, avail: 100, health: 95 },
  { name: "Türschloss Haustür", area: "Eingang", integ: "matter", maker: "Alpenfunk", model: "Lock L2", sw: "3.2.1", conn: "thread", sig: null, bat: 81, status: "on", out: 0, avail: 100, health: 97 },
  { name: "Heizkörper Kinderzimmer", area: "Kinderzimmer", integ: "zwave_js", maker: "Thermia", model: "TRV 4", sw: "4.7", conn: "zwave", sig: { kind: "dbm", v: -72 }, bat: 67, status: "on", out: 1, avail: 99.6, health: 88 },
  { name: "Steckdose Kaffeemaschine", area: "Küche", integ: "shelly", maker: "Voltix", model: "Plug S", sw: "1.6.2", conn: "wifi", sig: { kind: "dbm", v: -55 }, status: "on", out: 0, avail: 100, health: 99 },
  { name: "Rollladen Büro", area: "Büro", integ: "zha", maker: "Nordlicht", model: "SC-2", sw: "2.0.9", conn: "zigbee", sig: { kind: "lqi", v: 168 }, status: "on", out: 0, avail: 100, health: 97 },
  { name: "Rauchmelder Flur", area: "Flur", integ: "zha", maker: "Nordlicht", model: "SD-1", sw: "1.3.0", conn: "zigbee", sig: { kind: "lqi", v: 122 }, bat: 92, status: "on", out: 0, avail: 100, health: 96 },
  { name: "NAS", area: "Keller", integ: "synology_dsm", maker: "Datenwerk", model: "DS-4", sw: "7.3", conn: "lan", sig: null, status: "on", out: 0, avail: 100, health: 100 },
  { name: "Saugroboter", area: "Wohnzimmer", integ: "roborock", maker: "Kehrfix", model: "S9", sw: "02.41", conn: "cloud", sig: { kind: "dbm", v: -66 }, status: "on", out: 1, avail: 99.4, health: 90 },
];
export const INTEG = { zha: "ZHA", shelly: "Shelly", matter: "Matter", esphome: "ESPHome", bthome: "BTHome", hue: "Hue", zwave_js: "Z-Wave JS", synology_dsm: "Synology DSM", roborock: "Roborock" };
export const KPI = { total: 128, online: 124, offline: 4, flaky: 2, avail: 98.6, longest: "3 T. 4 Std." };
export const CONN_COUNTS = [["zigbee", 46], ["wifi", 38], ["thread", 14], ["ble", 11], ["zwave", 4], ["lan", 6], ["cloud", 9]];

// 24-Std.-Streifen je Gerät: 48 Felder à 30 Min.; 0 = online, 1 = Unterbruch, 2 = keine Daten.
export function strip(d) {
  const a = Array(48).fill(0);
  const seed = [...d.name].reduce((s, c) => s + c.charCodeAt(0), 0);
  if (d.status === "off") {
    const n = d.name === "Temperatur Keller" ? 48 : d.name === "Bewegungsmelder Flur" ? 5 : d.name === "Thermostat Bad" ? 2 : 1;
    for (let i = 48 - n; i < 48; i++) a[i] = 1;
  }
  for (let k = 0; k < (d.status === "flaky" ? d.out : d.out && d.status !== "off" ? d.out : d.status === "off" ? d.out - 1 : 0); k++) a[(seed * (k + 3) * 7) % 40 + 2] = 1;
  if (d.name === "Bewegungsmelder Flur" || d.name === "Rollladen Büro" || d.name === "Fensterkontakt Küche") a[6] = 1; // Sammelausfall 03:12
  return a;
}
export const stripSvg = (d, w = 96, h = 14) => {
  const a = strip(d);
  const cw = w / a.length;
  return `<svg class="strip" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${a
    .map((v, i) => `<rect x="${(i * cw).toFixed(2)}" y="0" width="${(cw - 0.6).toFixed(2)}" height="${h}" rx="1.2" fill="${v === 1 ? "var(--error)" : v === 2 ? "var(--text3)" : "var(--success-strip)"}"/>`)
    .join("")}</svg>`;
};

// Ring (Gesundheit oder Anteil online).
export function ring(value, size = 34, stroke = 4, color = null, label = null) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const col = color || (value >= 85 ? "var(--t5)" : value >= 65 ? "var(--t4)" : value >= 45 ? "var(--t3)" : "var(--t1)");
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--ring-bg)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${((c * value) / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    ${label !== null ? `<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" class="ring-t">${label}</text>` : ""}
  </svg>`;
}

// Logo (Variante A "D mit Puls") klein für die Werkzeugleiste.
export const LOGO = (s = 30) => `<svg width="${s}" height="${s}" viewBox="22 22 212 212"><defs><linearGradient id="lg${s}" x1="28" y1="20" x2="228" y2="236" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7ADFFD"/><stop offset=".5" stop-color="#22A9F9"/><stop offset="1" stop-color="#1C7DF9"/></linearGradient></defs><path d="M60 44 H112 A84 84 0 0 1 112 212 H60 Z" fill="none" stroke="url(#lg${s})" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/><path d="M86 128 H104 L118 94 L136 164 L150 128 H168" fill="none" stroke="url(#lg${s})" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// --- Seitenrahmen -----------------------------------------------------------
export const CSS = `
@font-face { font-family: Roboto; font-weight: 400; src: url("${font(400)}"); }
@font-face { font-family: Roboto; font-weight: 500; src: url("${font(500)}"); }
@font-face { font-family: Roboto; font-weight: 700; src: url("${font(700)}"); }
:root, .light {
  --bg: #f4f6f9; --card: #ffffff; --text: #1f2328; --text2: #6b7280; --text3: #a3a9b3;
  --divider: rgba(15, 23, 42, .08); --primary: #03a9f4; --success: #2e9e4f; --error: #e5484d; --warning: #f59e0b; --violet: #8b5cf6;
  --success-strip: #bfe5c9; --bar-off: rgba(15,23,42,.13); --ring-bg: rgba(15,23,42,.08);
  --hover: #f6f8fb; --subtle: #f1f3f7; --input: #ffffff;
  --err-soft: rgba(229, 72, 77, .09); --err-line: rgba(229, 72, 77, .35); --warn-soft: rgba(245, 158, 11, .12); --ok-soft: rgba(46, 158, 79, .12); --pri-soft: rgba(3, 169, 244, .12); --vio-soft: rgba(139, 92, 246, .12);
  --t5: #4caf50; --t4: #8bc34a; --t3: #eba43f; --t2: #a37fe0; --t1: #e5625f;
  --shadow: 0 10px 30px rgba(15, 23, 42, .16); --shadow-s: 0 1px 2px rgba(15,23,42,.06), 0 1px 8px rgba(15,23,42,.04);
  --scrim: rgba(15, 23, 42, .38);
}
.dark {
  --bg: #111111; --card: #1c1c1c; --text: #e6e6e6; --text2: #9ba1a8; --text3: #666b72;
  --divider: rgba(255,255,255,.08); --error: #ef5350; --success: #4caf50; --success-strip: #2c5b38; --bar-off: rgba(255,255,255,.14); --ring-bg: rgba(255,255,255,.09);
  --hover: #232323; --subtle: #242424; --input: #161616;
  --err-soft: rgba(239, 83, 80, .12); --err-line: rgba(239, 83, 80, .45);
  --shadow: 0 10px 30px rgba(0,0,0,.5); --shadow-s: 0 1px 2px rgba(0,0,0,.4); --scrim: rgba(0,0,0,.55);
}
* { box-sizing: border-box; }
html, body { margin: 0; }
body { font-family: Roboto, sans-serif; background: var(--bg); color: var(--text); font-size: 14px; -webkit-font-smoothing: antialiased; }
.ic { display: inline-block; vertical-align: middle; flex: none; }
.mono { font-family: "DejaVu Sans Mono", monospace; font-size: 12.5px; }
.t2 { color: var(--text2); } .t3 { color: var(--text3); }
.btn { display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 16px; border-radius: 999px; border: 1px solid var(--divider); background: var(--card); color: var(--text); font: 500 14px Roboto; white-space: nowrap; }
.btn.round { width: 38px; padding: 0; justify-content: center; }
.btn.primary { background: var(--primary); border-color: var(--primary); color: #fff; }
.btn.ghost-err { color: var(--error); border-color: var(--err-line); }
.pill { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 9px; border-radius: 999px; font-size: 12px; font-weight: 500; white-space: nowrap; }
.pill .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.pill.on { color: var(--success); background: var(--ok-soft); }
.pill.off { color: #fff; background: var(--error); }
.pill.flaky { color: #b45309; background: var(--warn-soft); }
.dark .pill.flaky { color: #fbbf24; }
.pill.none { color: var(--text2); background: var(--subtle); }
.pill.beta { color: var(--violet); background: var(--vio-soft); }
.pill.upd { color: var(--primary); background: var(--pri-soft); }
.chip { display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 12px; border-radius: 999px; background: var(--card); border: 1px solid var(--divider); font-size: 13px; color: var(--text); white-space: nowrap; }
.chip b { font-weight: 500; } .chip .n { color: var(--text2); }
.chip.on { background: var(--pri-soft); border-color: transparent; color: var(--primary); }
.search { flex: 1; display: flex; align-items: center; gap: 10px; height: 42px; padding: 0 14px; border-radius: 14px; background: var(--card); border: 1px solid var(--divider); color: var(--text2); min-width: 0; }
.seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 12px; background: var(--subtle); }
.seg span { padding: 6px 12px; border-radius: 9px; font-size: 13px; color: var(--text2); white-space: nowrap; }
.seg span.on { background: var(--card); color: var(--text); box-shadow: var(--shadow-s); font-weight: 500; }
.toggle { width: 36px; height: 20px; border-radius: 999px; background: var(--bar-off); position: relative; flex: none; }
.toggle::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.3); }
.toggle.on { background: var(--primary); } .toggle.on::after { left: 18px; }
.sig { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.bars { vertical-align: middle; }
.ring-t { font: 600 10px Roboto; fill: var(--text); }
.label { font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: var(--text2); font-weight: 500; }
.pulse-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--error); box-shadow: 0 0 0 4px var(--err-soft), 0 0 12px var(--error); display: inline-block; flex: none; }
.bat { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
.bat.low { color: var(--error); font-weight: 500; }
`;

export function page(body, { theme = "light", extraCss = "" } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}${extraCss}</style></head><body class="${theme}">${body}</body></html>`;
}

export function batHtml(b) {
  if (b == null) return `<span class="t3">–</span>`;
  return `<span class="bat ${b <= 15 ? "low" : ""}">${ic("battery", 14)} ${b} %</span>`;
}
export function connHtml(d, { showVia = false } = {}) {
  const lvl = sigLevel(d.sig);
  const dim = d.status === "off";
  return `<span class="sig">${connIcon(d.conn, 16)} ${CONN[d.conn]}${lvl ? ` ${bars(lvl, dim)} <span class="t2" style="font-size:12px">${sigText(d.sig)}</span>` : ""}</span>${
    showVia && d.via ? `<div class="t2" style="font-size:11.5px;margin-top:2px">über ${d.via}</div>` : ""}`;
}
