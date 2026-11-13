/**
 * Dashboard-Karten (seit 2.216.0): "Verfügbarkeit", "Gerade ausgefallen" und eine Übersicht mit beiden und dem Ausfall-Puls.
 *
 * Die Karten laufen in der Oberfläche von Home Assistant (nicht im iframe des Panels) und lesen nur den Sensor "Verfügbarkeit"
 * (summary._availability): kein WebSocket-Befehl des Panels, kein Token. Das Panel verlangt Administratorrechte, die Karten nicht;
 * darum steht darin nur, was auch die Sensoren zeigen (Zahlen, Zeiten, Namen der ausgefallenen Geräte). Aussehen und Texte kommen aus
 * styles.js und strings.js des Panels, damit Karte und Panel gleich aussehen.
 */

const V = new URL(import.meta.url).search;
const [{ STRINGS, pickLang }, { PANEL_CSS }] = await Promise.all([import(`./strings.js${V}`), import(`./styles.js${V}`)]);

const PANEL_PATH = "/device-panel";
const DOCS = "https://github.com/Diegofuego871/ha-device-panel#dashboard-cards";
const PULSE_W = 480;
const PULSE_H = 84;

const MDI = {
  pause: "M14,19H18V5H14M6,19H10V5H6V19Z",
  alert: "M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z",
  check: "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z",
  chevron: "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z",
  pulse: "M3,13H5.79L10.1,4.79L11.28,13.75L14.5,9.66L17.83,13H21V15H17L14.67,12.67L9.92,18.73L8.94,11.31L7,15H3V13Z",
  closeCircle: "M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z",
};
const mdi = (name, size = 18) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${MDI[name]}"/></svg>`;

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escape = (value) => (value == null ? "" : String(value)).replace(/[&<>"']/g, (c) => ESCAPES[c]);

const CARD_CSS = `
:host { display: block; height: auto; background: transparent; }
.cgrid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.cgrid .kt.pul { grid-column: 1 / -1; }
.kt.tap { cursor: pointer; }
.kt.tap:hover { border-color: color-mix(in srgb, var(--dp-primary) 45%, var(--dp-divider)); }
.kt.tap:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: 2px; }
.kt .k .kchev { display: inline-flex; margin-left: auto; }
.orow { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 5px 0; font-size: 13.5px; }
.orow > span:first-child { color: var(--dp-error); display: flex; }
.orow b { color: var(--dp-error); font-weight: 600; font-variant-numeric: tabular-nums; }
.orow .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kpause { cursor: default; }
.msg { padding: 16px 18px; border-radius: 20px; border: 1px solid var(--dp-divider); background: var(--dp-card); color: var(--dp-text2); }
.cgrid .kt.ring, .cgrid .kt.offl { min-height: 100%; }
.pticks span:first-child { transform: none; }
`;

function ringSvg(pct, size, width) {
  const r = (size - width) / 2;
  const c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--dp-bar-off)" stroke-width="${width}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--dp-success)" stroke-width="${width}" stroke-linecap="round"
      stroke-dasharray="${((c * pct) / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}

// Entität suchen: über die Registrierung (Plattform und Schlüssel, nicht über den Namen, den der Nutzer ändern kann), sonst über das Attribut "pulse"
function findEntity(hass) {
  for (const [id, entry] of Object.entries(hass.entities || {})) {
    if (entry.platform === "device_panel" && entry.translation_key === "availability" && hass.states[id]) return id;
  }
  return Object.keys(hass.states).find((id) => id.startsWith("sensor.") && hass.states[id].attributes?.pulse !== undefined && hass.states[id].attributes?.offline_list !== undefined) || null;
}

function docLang() {
  const hass = document.querySelector("home-assistant")?.hass;
  return pickLang(hass);
}

class DevicePanelBaseCard extends HTMLElement {
  // Teile der Karte, in der Reihenfolge der Anzeige: "ring", "offline", "pulse"
  static parts = ["ring", "offline", "pulse"];
  static nameKey = "cardAllName";
  static descKey = "cardAllDesc";

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._sig = null;
  }

  static getConfigForm() {
    const t = (k) => STRINGS[docLang()][k];
    return {
      schema: [{ name: "entity", selector: { entity: { domain: "sensor", integration: "device_panel" } } }],
      computeLabel: (schema) => (schema.name === "entity" ? t("cardEntity") : schema.name),
    };
  }

  static getStubConfig(hass) {
    const entity = hass ? findEntity(hass) : null;
    return entity ? { entity } : {};
  }

  setConfig(config) {
    this._config = { ...(config || {}) };
    this._sig = null;
    if (this._hass) this._draw();
  }

  set hass(hass) {
    this._hass = hass;
    const id = this._config.entity || findEntity(hass);
    const st = id ? hass.states[id] : null;
    // Nur neu zeichnen, wenn sich etwas ändert: HA ruft das bei jeder Zustandsänderung im ganzen System auf
    const sig = `${id}|${st ? `${st.last_updated}|${st.state}` : "-"}|${pickLang(hass)}|${hass.user?.is_admin ? 1 : 0}`;
    if (sig === this._sig) return;
    this._sig = sig;
    this._draw();
  }

  connectedCallback() {
    // Die Dauer wächst mit der Zeit, auch ohne neuen Zustand: jede Minute nachführen
    this._timer = setInterval(() => this._hass && this._draw(), 60000);
  }

  disconnectedCallback() {
    clearInterval(this._timer);
  }

  getCardSize() {
    return this.constructor.parts.length === 3 ? 6 : 3;
  }

  getGridOptions() {
    return { columns: this.constructor.parts.length === 3 ? 12 : 6, min_columns: 6, rows: this.constructor.parts.length === 3 ? 6 : 3 };
  }

  _t(key, ...args) {
    const value = STRINGS[pickLang(this._hass)][key];
    return typeof value === "function" ? value(...args) : value;
  }

  _fmtPct(v) {
    const digits = v >= 100 ? 0 : 1;
    return new Intl.NumberFormat(pickLang(this._hass), { minimumFractionDigits: digits, maximumFractionDigits: 1 }).format(Number(v));
  }

  _duration(iso, short = false) {
    const min = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
    if (min < 1) return this._t("underMinute");
    const d = Math.floor(min / 1440);
    const h = Math.floor((min % 1440) / 60);
    const m = min % 60;
    const [du, hu, mu] = [this._t("dayUnit"), this._t("hourUnit"), this._t("minuteUnit")];
    if (d) return short || !h ? `${d} ${du}` : `${d} ${du} ${h} ${hu}`;
    if (h) return short || !m ? `${h} ${hu}` : `${h} ${hu} ${m} ${mu}`;
    return `${m} ${mu}`;
  }

  _canOpen() {
    return Boolean(this._hass?.user?.is_admin);
  }

  _open() {
    // Das Panel ist nur für Administratoren erreichbar
    if (!this._canOpen()) return;
    history.pushState(null, "", PANEL_PATH);
    window.dispatchEvent(new CustomEvent("location-changed", { bubbles: true, composed: true }));
  }

  _tapAttrs() {
    return this._canOpen() ? ` tap" role="button" tabindex="0" aria-label="${escape(this._t("cardOpen"))}` : "";
  }

  _chev() {
    return this._canOpen() ? `<span class="kchev"><span class="cbtn" aria-hidden="true">${mdi("chevron", 16)}</span></span>` : "";
  }

  _ringHtml(a) {
    const total = Number(a.total) || 0;
    const share = Number(a.share);
    const avg = a.avg24 == null ? "" : `<div class="pavg">${escape(this._t("avg24"))}: <b>${escape(this._fmtPct(a.avg24))} %</b></div>`;
    const line = (color, text) => `<div><i style="background:${color}"></i>${escape(text)}</div>`;
    return `<div class="kt ring${this._tapAttrs()}"><div class="ringwrap">${ringSvg(Number.isFinite(share) ? share : 0, 108, 11)}<div class="c"><div><b>${a.online}</b><span>${escape(this._t("ofTotal", total))}</span></div></div></div>
      <div class="rtxt"><div class="k">${escape(this._t("availability"))}${this._chev()}</div><div class="pct${avg ? " with-avg" : ""}">${escape(this._fmtPct(share))} %<small>${escape(this._t("pctNow"))}</small></div>${avg}
      <div class="lines">${line("var(--dp-success)", this._t("linesOnline", a.stable))}
      ${a.flaky ? line("var(--dp-warning)", this._t("linesFlaky", a.flaky)) : ""}
      ${line("var(--dp-error)", this._t("linesOffline", a.offline))}
      ${a.no_data ? line("var(--dp-text3)", this._t("linesNoData", a.no_data)) : ""}
      ${a.no_status ? `<div><i class="ring"></i>${escape(this._t("linesNoStatus", a.no_status))}</div>` : ""}</div></div></div>`;
  }

  _offlineHtml(a) {
    const paused = a.paused
      ? `<div class="kpause">${mdi("pause", 14)}<span><b>${a.paused}</b> ${escape(this._t("pausedNow", a.paused))}</span></div>`
      : "";
    const warn = a.warnings
      ? `<div class="kwarn"><span class="w-ic">${mdi("alert", 16)}</span><span><b>${a.warnings}</b> ${escape(this._t("warnDevices", a.warnings))}</span></div>`
      : `<div class="kwarn none"><span class="w-ic">${mdi("check", 16)}</span><span>${escape(this._t("warnNone"))}</span></div>`;
    const head = `<div class="k">${a.offline ? '<span class="pulse"></span>' : ""}${escape(this._t("offlineNow"))}${this._chev()}</div>`;
    if (!a.offline) {
      return `<div class="kt offl${this._tapAttrs()}">${head}
        <div class="top"><span class="num ok">0</span><span class="lbl">${escape(this._t("allOnline"))}</span></div>
        <div class="durs">${escape(this._t("allOnlineSub"))}</div>${paused}${warn}</div>`;
    }
    const list = (a.offline_list || []).slice(0, 4);
    const rows = list
      .map((d) => `<div class="orow"><span>${mdi("closeCircle", 16)}</span><span class="name">${escape(d.name)}</span><b>${d.since ? `${d.at_least ? "≥ " : ""}${escape(this._duration(d.since, true))}` : ""}</b></div>`)
      .join("");
    const more = a.offline > list.length ? `<div class="more">${escape(this._t("more", a.offline - list.length))}</div>` : "";
    const longest = a.longest_since ? this._t("longest", `${a.longest_at_least ? "≥ " : ""}${this._duration(a.longest_since)}`) : "";
    return `<div class="kt err offl${this._tapAttrs()}">${head}
      <div class="top"><span class="num">${a.offline}</span><span class="lbl">${escape(longest)}</span></div>
      <div class="olist">${rows}${more}</div>${paused}${warn}</div>`;
  }

  _pulseChart(p) {
    const n = p.length;
    const max = Math.max(...p);
    const x = (i) => (((i + 0.5) / n) * PULSE_W).toFixed(1);
    const y = (v) => (PULSE_H - 3 - (max ? (v / max) * (PULSE_H - 12) : 0)).toFixed(1);
    const pt = (i) => `${x(i)},${y(p[i])}`;
    const runs = [];
    for (let i = 0; i < n - 1; i++) {
      const off = p[i] > 0 || p[i + 1] > 0;
      const last = runs[runs.length - 1];
      if (last && last.off === off) last.to = i + 1;
      else runs.push({ off, from: i, to: i + 1 });
    }
    const path = (r) => `M${Array.from({ length: r.to - r.from + 1 }, (_, k) => pt(r.from + k)).join(" L")}`;
    const areas = runs.filter((r) => r.off).map((r) => `<path class="area" d="${path(r)} L${x(r.to)},${PULSE_H} L${x(r.from)},${PULSE_H} Z"/>`).join("");
    const lines = runs.map((r) => `<path class="line ${r.off ? "off" : "ok"}" d="${path(r)}" vector-effect="non-scaling-stroke"/>`).join("");
    const end = Math.floor(Date.now() / 60000) * 60000;
    const fmt = new Intl.DateTimeFormat(pickLang(this._hass), { hour: "2-digit", minute: "2-digit" });
    const ticks = [0, 1, 2, 3].map((k) => `<span style="left:${k * 25}%">${escape(fmt.format(new Date(end - 86400000 + k * 21600000)))}</span>`).join("");
    return `<div class="pchart${max ? "" : " quiet"}"><svg viewBox="0 0 ${PULSE_W} ${PULSE_H}" preserveAspectRatio="none" aria-hidden="true">
        <line class="base" x1="0" x2="${PULSE_W}" y1="${PULSE_H - 0.5}" y2="${PULSE_H - 0.5}" vector-effect="non-scaling-stroke"/>${areas}${lines}</svg></div>
      <div class="pticks">${ticks}<span class="now-label">${escape(this._t("now"))}</span></div>`;
  }

  _pulseHtml(a) {
    const p = Array.isArray(a.pulse) ? a.pulse.map((v) => Number(v) || 0) : [];
    if (!p.length) return "";
    const note = a.outages
      ? `<div class="pnote">${escape(this._t("pulseSummary", a.outages, a.affected))}</div>`
      : `<div class="pnote ok">${escape(this._t("pulseNone"))}</div>`;
    return `<div class="kt pul${this._tapAttrs()}"><div class="k">${mdi("pulse", 16)}${escape(this._t("pulseTitle"))}${this._chev()}</div>${this._pulseChart(p)}${note}</div>`;
  }

  _draw() {
    const hass = this._hass;
    if (!hass) return;
    const id = this._config.entity || findEntity(hass);
    const st = id ? hass.states[id] : null;
    const a = st && st.state !== "unavailable" && st.state !== "unknown" ? { ...st.attributes, share: Number(st.state) } : null;
    let body;
    if (!a) {
      body = `<div class="msg">${escape(this._t("cardMissing"))}</div>`;
    } else {
      const html = { ring: (x) => this._ringHtml(x), offline: (x) => this._offlineHtml(x), pulse: (x) => this._pulseHtml(x) };
      body = `<div class="cgrid">${this.constructor.parts.map((part) => html[part](a)).join("")}</div>`;
    }
    this.shadowRoot.innerHTML = `<style>${PANEL_CSS}${CARD_CSS}</style>${body}`;
    for (const tile of this.shadowRoot.querySelectorAll(".kt.tap")) {
      tile.addEventListener("click", () => this._open());
      tile.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          this._open();
        }
      });
    }
  }
}

class DevicePanelAvailabilityCard extends DevicePanelBaseCard {
  static parts = ["ring"];
  static nameKey = "cardAvailName";
  static descKey = "cardAvailDesc";
}
class DevicePanelOfflineCard extends DevicePanelBaseCard {
  static parts = ["offline"];
  static nameKey = "cardOfflineName";
  static descKey = "cardOfflineDesc";
}
class DevicePanelOverviewCard extends DevicePanelBaseCard {}

const CARDS = [
  ["device-panel-availability-card", DevicePanelAvailabilityCard],
  ["device-panel-offline-card", DevicePanelOfflineCard],
  ["device-panel-card", DevicePanelOverviewCard],
];
window.customCards = window.customCards || [];
for (const [type, cls] of CARDS) {
  // Die Abfragen verhindern den Fehler, wenn die Datei zweimal geladen wird (zum Beispiel zusätzlich als Ressource)
  if (!customElements.get(type)) customElements.define(type, cls);
  if (!window.customCards.some((c) => c.type === type)) {
    window.customCards.push({
      type,
      get name() {
        return STRINGS[docLang()][cls.nameKey];
      },
      get description() {
        return STRINGS[docLang()][cls.descKey];
      },
      preview: true,
      documentationURL: DOCS,
    });
  }
}
