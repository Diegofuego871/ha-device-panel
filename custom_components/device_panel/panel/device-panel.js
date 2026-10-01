/**
 * Panel "Device Panel": alle Geräte von Home Assistant mit Status, Dauer des
 * Ausfalls, Verbindungsart, Empfang, Batterie und Softwarestand.
 *
 * Design C (docs/mockups/panel-v1): Kopf mit Kennzahlen, Chips nach
 * Verbindungsart, gruppierte Tabelle; auf dem Handy Karten. Aufbau wie in
 * "UniFi Dynamic Clients" (docs/LEARNINGS.md): Vanilla Web Component als
 * iframe-Panel, Texte und Styles in eigenen Modulen.
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
};
const mdi = (name, size = 18) =>
  `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${MDI[name]}"/></svg>`;
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

class DevicePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._devices = [];
    this._integrations = {};
    this._offset = 0;
    this._fetchedAt = null;
    this._loading = true;
    this._error = null;
    this._search = "";
    this._conn = "all";
    this._problems = false;
    this._hint = null;
    this._matter = new Map();
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
      <div class="content"><div class="hero"></div><div class="chips"></div><div class="list"></div><div class="foot"></div></div>`;
    this.shadowRoot.querySelector(".search").addEventListener("input", (ev) => {
      this._search = ev.target.value.trim().toLowerCase();
      this._render();
    });
    this.shadowRoot.querySelector(".content").addEventListener("click", (ev) => {
      const el = ev.target.closest("[data-conn],[data-problems],[data-hint],[data-clear]");
      if (!el || el.disabled) return;
      if (el.dataset.conn) this._conn = el.dataset.conn;
      else if (el.dataset.problems !== undefined) this._problems = !this._problems;
      else if (el.dataset.hint) this._hint = this._hint === el.dataset.hint ? null : el.dataset.hint;
      else if (el.dataset.clear !== undefined) this._hint = null;
      this._render();
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
      const serverNow = Date.parse(result.now);
      this._offset = Number.isFinite(serverNow) ? serverNow - Date.now() : 0;
      this._fetchedAt = new Date();
      this._error = null;
    } catch (err) {
      this._error = (err && err.message) || String(err);
    } finally {
      this._fetching = false;
      this._loading = false;
      this._render();
      this._refineMatter();
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

  _duration(iso, short = false) {
    const ms = Date.now() + this._offset - Date.parse(iso);
    const min = Math.max(0, Math.floor(ms / 60000));
    if (min < 1) return this._t("underMinute");
    const d = Math.floor(min / 1440);
    const h = Math.floor((min % 1440) / 60);
    const m = min % 60;
    const [du, hu, mu] = [this._t("dayUnit"), this._t("hourUnit"), this._t("minuteUnit")];
    if (d) return short ? `${d} ${du}` : `${d} ${du} ${h} ${hu}`;
    if (h) return short ? `${h} ${hu}` : `${h} ${hu} ${m} ${mu}`;
    return `${m} ${mu}`;
  }

  _durationHtml(d, short = false) {
    const text = this._duration(d.offline_since, short);
    return d.since_restart ? `<span title="${escape(this._t("sinceRestart"))}">≥ ${escape(text)}</span>` : escape(text);
  }

  _integrationText(d) {
    return (d.integrations || []).map((dom) => this._integrations[dom] || dom).join(", ");
  }

  _matches(d) {
    if (this._conn !== "all" && this._connOf(d) !== this._conn) return false;
    if (this._problems && !(d.online !== true || d.battery?.low || isWeak(d.signal))) return false;
    if (this._hint === "battery" && !d.battery?.low) return false;
    if (this._hint === "signal" && !isWeak(d.signal)) return false;
    if (this._hint === "update" && !d.update) return false;
    if (!this._search) return true;
    return [d.name, d.area, d.manufacturer, d.model, d.sw_version, this._integrationText(d), this._t(CONN[this._connOf(d)].key), d.via]
      .join(" ")
      .toLowerCase()
      .includes(this._search);
  }

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
    setHtml(root.querySelector(".foot"), this._loading || this._error ? "" : `<span>${escape(this._t("footer", rows.length, all.length))}${time ? ` · ${escape(this._t("updatedAt", time))}` : ""}</span>`);
  }

  _heroHtml(all, offline) {
    const online = all.filter((d) => d.online === true).length;
    const noData = all.filter((d) => d.online == null).length;
    const pct = all.length ? (online / all.length) * 100 : 100;
    const pctText = pct.toLocaleString(this._locale(), { maximumFractionDigits: 1 });
    const ring = `<div class="kt ring"><div class="ringwrap">${ringSvg(pct, 108, 11)}<div class="c"><div><b>${online}</b><span>${escape(this._t("ofTotal", all.length))}</span></div></div></div>
      <div><div class="k">${escape(this._t("availability"))}</div><div class="pct">${pctText} %</div>
      <div class="lines"><div><i style="background:var(--dp-success)"></i>${escape(this._t("linesOnline", online))}</div>
      <div><i style="background:var(--dp-error)"></i>${escape(this._t("linesOffline", offline.length))}</div>
      ${noData ? `<div><i style="background:var(--dp-text3)"></i>${escape(this._t("linesNoData", noData))}</div>` : ""}</div></div></div>`;
    const off = offline.length
      ? `<div class="kt err"><div class="k"><span class="pulse"></span>${escape(this._t("offlineNow"))}</div>
        <div class="top"><span class="num">${offline.length}</span><span class="lbl">${escape(this._t("longest", this._duration(offline[0].offline_since)))}</span></div>
        <div class="olist">${offline.slice(0, 4).map((d) => `<button type="button"><span>${CONN[this._connOf(d)].icon(16)}</span><span class="name">${escape(d.name)}</span><b>${this._durationHtml(d, true)}</b></button>`).join("")}
        ${offline.length > 4 ? `<div class="more">${escape(this._t("more", offline.length - 4))}</div>` : ""}</div></div>`
      : `<div class="kt"><div class="k">${escape(this._t("offlineNow"))}</div>
        <div class="top"><span class="num ok">0</span><span class="lbl">${escape(this._t("allOnline"))}</span></div>
        <div class="durs">${escape(this._t("allOnlineSub"))}</div></div>`;
    const count = { battery: all.filter((d) => d.battery?.low).length, signal: all.filter((d) => isWeak(d.signal)).length, update: all.filter((d) => d.update).length };
    const hint = (key, cls, icon, label) =>
      `<button type="button" data-hint="${key}" class="${this._hint === key ? "on" : ""}" ${count[key] ? "" : "disabled"} aria-pressed="${this._hint === key}">
        <span class="hi ${count[key] ? cls : ""}">${mdi(icon, 17)}</span><span>${escape(this._t(label))}</span><b>${count[key]}</b></button>`;
    const hints = `<div class="kt"><div class="k">${escape(this._t("hints"))}</div><div class="hintlist" style="margin-top:6px">
      ${hint("battery", "b", "battery", "hintBattery")}${hint("signal", "s", "signal", "hintSignal")}${hint("update", "u", "update", "hintUpdate")}</div></div>`;
    return ring + off + hints;
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
    if (this._hint) {
      const label = { battery: "hintBattery", signal: "hintSignal", update: "hintUpdate" }[this._hint];
      html += `<button type="button" class="chip on" data-clear aria-label="${escape(this._t("clearFilter"))}"><span>${escape(this._t(label))}</span>${mdi("close", 15)}</button>`;
    }
    return html;
  }

  _avatar(d, size = 18) {
    const cls = d.online === false ? "off" : d.online == null ? "none" : "";
    return `<div class="av ${cls}">${CONN[this._connOf(d)].icon(size)}<span class="dot"></span></div>`;
  }

  _statusHtml(d) {
    if (d.online === false) return `<div class="dur">${this._durationHtml(d)}</div><div class="durs">${escape(this._t("statusOffline"))}</div>`;
    if (d.online == null) return `<span class="pill none">${escape(this._t("statusNoData"))}</span>`;
    return `<span class="pill on"><span class="pd"></span>${escape(this._t("statusOnline"))}</span>`;
  }

  _connHtml(d, withVia = true) {
    const type = this._connOf(d);
    const level = sigLevel(d.signal);
    const sig = level ? ` ${bars(level, d.online === false)} <span class="val">${escape(sigText(d.signal))}</span>` : "";
    const via = withVia && d.via ? `<span class="sub">${escape(this._t("via", d.via))}</span>` : "";
    return `<span class="sig">${CONN[type].icon(16)} ${escape(this._t(CONN[type].key))}${sig}</span>${via}`;
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
    return [
      ["e", "groupOffline", "groupOfflineHint", rows.filter((d) => d.online === false).sort((a, b) => Date.parse(a.offline_since) - Date.parse(b.offline_since))],
      ["n", "groupNoData", "groupNoDataHint", rows.filter((d) => d.online == null).sort(byName)],
      ["", "groupOnline", null, rows.filter((d) => d.online === true).sort(byName)],
    ].filter((g) => g[3].length);
  }

  _listHtml(rows) {
    if (this._loading) return `<div class="note">${escape(this._t("loading"))}</div>`;
    if (this._error) return `<div class="note">${escape(this._t("error"))} ${escape(this._error)}</div>`;
    if (!rows.length) return `<div class="note">${escape(this._t("empty"))}</div>`;
    return this._narrowQuery.matches ? this._cardsHtml(rows) : this._tableHtml(rows);
  }

  _tableHtml(rows) {
    const cols = ["colName", "colStatus", "colConnection", "colBattery", "colIntegration", "colModel", "colSoftware"];
    const head = `<thead><tr>${cols.map((c) => `<th>${escape(this._t(c))}</th>`).join("")}</tr></thead>`;
    const body = this._groups(rows)
      .map(([cls, title, hint, list]) =>
        `<tr class="grp ${cls}"><td colspan="${cols.length}">${escape(this._t(title))} · ${list.length}${hint ? ` <small>${escape(this._t(hint))}</small>` : ""}</td></tr>` +
        list
          .map((d) => `<tr class="dev ${d.online === false ? "off" : ""}">
            <td><div class="nc">${this._avatar(d)}<div>${escape(d.name)}${d.area ? `<span class="sub">${escape(d.area)}</span>` : ""}</div></div></td>
            <td>${this._statusHtml(d)}</td>
            <td>${this._connHtml(d)}</td>
            <td>${this._batteryHtml(d)}</td>
            <td>${escape(this._integrationText(d) || "–")}</td>
            <td>${escape(d.manufacturer || "–")}${d.model ? `<span class="sub">${escape(d.model)}</span>` : ""}</td>
            <td>${this._softwareHtml(d)}</td></tr>`)
          .join(""))
      .join("");
    return `<div class="tcard"><table>${head}<tbody>${body}</tbody></table></div>`;
  }

  _cardsHtml(rows) {
    return `<div class="cards">${this._groups(rows)
      .map(([cls, title, , list]) => {
        const head = `<div class="gh ${cls}">${escape(this._t(title))} · ${list.length}</div>`;
        if (cls === "") {
          return head + `<div class="mlist">${list
            .map((d) => `<div class="mrow dev">${this._avatar(d, 16)}<div>${escape(d.name)}<span class="sub">${[this._t(CONN[this._connOf(d)].key), d.area].filter(Boolean).map(escape).join(" · ")}</span></div>
              <div>${d.battery?.low ? this._batteryHtml(d) : bars(sigLevel(d.signal), false)}</div></div>`)
            .join("")}</div>`;
        }
        return head + list
          .map((d) => `<div class="mc dev ${d.online === false ? "off" : ""}">${this._avatar(d)}
            <div><div class="nm">${escape(d.name)}</div><div class="sb">${this._connHtml(d, false)}</div></div>
            <div class="rt">${d.online === false ? `<div class="dur">${this._durationHtml(d, true)}</div><div class="durs">${escape(this._t("statusOffline"))}</div>` : this._statusHtml(d)}</div></div>`)
          .join("");
      })
      .join("")}</div>`;
  }
}

customElements.define("device-panel", DevicePanel);
