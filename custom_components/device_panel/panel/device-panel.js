/**
 * Panel "Device Panel": alle Geräte von Home Assistant mit Status,
 * Softwarestand und (später) Ausfall-Statistik.
 *
 * Erster, bewusst kleiner Stand als Ausgangspunkt. Aufbau wie in
 * "UniFi Dynamic Clients" (siehe docs/LEARNINGS.md): Vanilla Web Component,
 * eingebettet als iframe-Panel, Texte und Styles in eigenen Modulen.
 */

const MODULE_VERSION = new URL(import.meta.url).search;
const [{ STRINGS, pickLang }, { PANEL_CSS }] = await Promise.all([
  import(`./strings.js${MODULE_VERSION}`),
  import(`./styles.js${MODULE_VERSION}`),
]);

const POLL_INTERVAL_MS = 10000;

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

class DevicePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._devices = [];
    this._filter = "all";
    this._search = "";
    this._loading = true;
    this._error = null;
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
    this._onVisible = () => document.visibilityState === "visible" && this._fetch();
    document.addEventListener("visibilitychange", this._onVisible);
  }

  disconnectedCallback() {
    window.clearInterval(this._timer);
    document.removeEventListener("visibilitychange", this._onVisible);
  }

  _t(key) {
    return STRINGS[pickLang(this._hass)][key];
  }

  _build() {
    const t = (k) => this._t(k);
    this.shadowRoot.innerHTML = `<style>${PANEL_CSS}</style>
      <div class="toolbar"><input class="search" type="search" placeholder="${escape(t("search"))}"></div>
      <div class="stats"></div>
      <div class="content"><table><thead><tr>
        <th>${escape(t("colName"))}</th><th>${escape(t("colArea"))}</th><th>${escape(t("colIntegration"))}</th>
        <th>${escape(t("colModel"))}</th><th>${escape(t("colSoftware"))}</th><th>${escape(t("colStatus"))}</th>
      </tr></thead><tbody></tbody></table></div>`;
    this.shadowRoot.querySelector(".search").addEventListener("input", (ev) => {
      this._search = ev.target.value.trim().toLowerCase();
      this._render();
    });
    this.shadowRoot.querySelector(".stats").addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-filter]");
      if (!btn) return;
      this._filter = btn.dataset.filter;
      this._render();
    });
  }

  // Nie zwei Abfragen gleichzeitig.
  async _fetch() {
    if (!this._hass || this._fetching) return;
    this._fetching = true;
    try {
      const result = await this._hass.callWS({ type: "device_panel/list_devices" });
      this._devices = (result.devices || []).filter((d) => !d.service);
      this._error = null;
    } catch (err) {
      this._error = (err && err.message) || String(err);
    } finally {
      this._fetching = false;
      this._loading = false;
      this._render();
    }
  }

  _render() {
    const t = (k) => this._t(k);
    const all = this._devices;
    const down = all.filter((d) => d.online === false).length;
    const up = all.filter((d) => d.online === true).length;
    const seg = (key, n, label) =>
      `<button data-filter="${key}" class="${this._filter === key ? "on" : ""}"><b>${n}</b> ${escape(label)}</button>`;
    setHtml(
      this.shadowRoot.querySelector(".stats"),
      seg("all", all.length, t("total")) + seg("online", up, t("online")) + seg("offline", down, t("offline"))
    );
    let rows = all.filter((d) => this._filter === "all" || (this._filter === "online" ? d.online === true : d.online === false));
    if (this._search) {
      rows = rows.filter((d) =>
        [d.name, d.area, d.manufacturer, d.model, d.sw_version, ...(d.integrations || [])]
          .join(" ")
          .toLowerCase()
          .includes(this._search)
      );
    }
    // Ausgefallene zuoberst, dann nach Name.
    rows.sort((a, b) => Number(b.online === false) - Number(a.online === false) || String(a.name).localeCompare(String(b.name)));
    const status = (d) =>
      d.online === true
        ? `<span class="pill on">${escape(t("statusOnline"))}</span>`
        : d.online === false
        ? `<span class="pill off">${escape(t("statusOffline"))}</span>`
        : `<span class="pill none">${escape(t("statusUnknown"))}</span>`;
    let body;
    if (this._loading) body = `<tr><td colspan="6" class="note">${escape(t("loading"))}</td></tr>`;
    else if (this._error) body = `<tr><td colspan="6" class="note">${escape(t("error"))} ${escape(this._error)}</td></tr>`;
    else if (!rows.length) body = `<tr><td colspan="6" class="note">${escape(t("empty"))}</td></tr>`;
    else
      body = rows
        .map(
          (d) => `<tr>
          <td>${escape(d.name)}</td>
          <td>${escape(d.area || "–")}</td>
          <td>${escape((d.integrations || []).join(", ") || "–")}</td>
          <td>${escape(d.manufacturer || "–")}<span class="sub">${escape(d.model || "")}</span></td>
          <td>${escape(d.sw_version || "–")}${d.hw_version ? `<span class="sub">HW ${escape(d.hw_version)}</span>` : ""}</td>
          <td>${status(d)}</td>
        </tr>`
        )
        .join("");
    setHtml(this.shadowRoot.querySelector("tbody"), body);
  }
}

customElements.define("device-panel", DevicePanel);
