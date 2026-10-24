/**
 * Einrichtungsassistent (seit 2.135.0, docs/mockups/wizard-v1): führt einmalig durch die Grundkonfiguration. Am Handy ein Vollbild,
 * am Desktop ein Popup in der Mitte. Schritte: Willkommen, Integrationen, Gerätetypen, Geräte, Meldungen (Ziel, Arten und ihre
 * wichtigsten Werte), Ruhezeit (nur mit Ziel), Fertig. Alles ist ein Entwurf (this.s.d); gespeichert wird erst mit "Fertigstellen"
 * (ein set_options), bis dahin ändert sich nichts. Die Zahlen jedes Schritts rechnet das Panel selbst nach dem Entwurf (wizard_data
 * liefert alle Kandidaten ohne abgezogene Ausschlüsse).
 *
 * Zustand (wizard_state, für alle Administratoren): "new" frisch installiert (das Fenster öffnet sich einmal von selbst), "later" übersprungen
 * (Kachel und Punkt im Launcher bleiben), "open" aus den Einstellungen neu gestartet und nicht beendet (Kachel und Punkt kommen zurück), "done"
 * abgeschlossen, "off" "Nicht mehr zeigen". Bestehende Installationen gelten als "done".
 */

const STATES_SHOWN = ["new", "later", "open"];
const MSG_ROWS = ["outage", "battery", "new", "charge"];
const MSG_ICON = { outage: "alert", battery: "battery", new: "sparkle", charge: "batteryCharging" };
// Zahlen der Meldungen: Schlüssel der Option, Zeile, Beschriftung, Einheit
const VALUES = {
  // "Ausgefallen nach" (offline_after) bleibt hier weg, damit es einfach bleibt; "Melden nach" darf aber nicht darunter liegen
  outage: [["notify_delay", "wzVDelay", "wzVMin"]],
  battery: [["battery_low", "wzVBattery", "wzVPercent"]],
  new: [["new_window", "wzVNew", "wzVMin"]],
  charge: [["charge_full", "wzVFull", "wzVPercent"]],
};
const VALUE_KEYS = Object.values(VALUES).flatMap((rows) => rows.map(([key]) => key));
// Geräte einer Integration, die schon beim Öffnen aufgeklappt sind: keine (die Liste bleibt kurz)
const SEARCH_MIN = 8;

export class WizardUi {
  constructor(host, deps) {
    this.host = host;
    this.h = deps;
    this.s = null;
    this._bound = false;
  }

  t(key, ...args) {
    return this.host._t(key, ...args);
  }

  get dlg() {
    return this.host.shadowRoot.querySelector("dialog.wizard-dlg");
  }

  // --- Zustand ------------------------------------------------------------------

  state() {
    return this.host._wizardState || "done";
  }

  // Kachel und Punkt im Launcher: solange der Assistent nie abgeschlossen wurde (oder neu gestartet und nicht beendet)
  visible() {
    return this.host._hass?.user?.is_admin !== false && STATES_SHOWN.includes(this.state());
  }

  async setState(value, extra = {}) {
    try {
      await this.host._hass.callWS({ type: "device_panel/set_options", values: { wizard_state: value, ...extra } });
    } catch (err) {
      // Der Zustand ist nur Komfort: ein Fehler stört den Ablauf nicht
    }
    this.host._wizardState = value;
    this.host._apps?.paintDots();
    this.host._fetch(true);
  }

  // Beim ersten Öffnen einer frischen Installation einmal von selbst (nur Administratoren, nur wenn kein anderes Fenster offen ist)
  maybeAuto() {
    if (this._auto || this.state() !== "new" || this.host._hass?.user?.is_admin === false) return;
    if (this.host.shadowRoot.querySelector("dialog[open]")) return;
    this._auto = true;
    this.open("auto");
  }

  // --- Öffnen und Schliessen ---------------------------------------------------

  async open(source = "app") {
    const dlg = this.dlg;
    if (!dlg || this.host._hass?.user?.is_admin === false) return;
    this._auto = true;
    this.s = { step: "welcome", source, loading: true, error: "", busy: false, d: null, base: null, data: null, opts: null, test: "", q: { integ: "", dev: "" }, open: new Set(), start: 0 };
    this.render();
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    // Neu gestartet, obwohl abgeschlossen oder abgewählt: gilt als nicht beendet, bis er beendet ist
    if (["done", "off"].includes(this.state())) await this.setState("open");
    await this.load();
  }

  async load() {
    const s = this.s;
    if (!s) return;
    s.loading = true;
    s.error = "";
    this.render();
    try {
      const [opts, data] = await Promise.all([this.host._hass.callWS({ type: "device_panel/get_options" }), this.host._hass.callWS({ type: "device_panel/wizard_data" })]);
      if (this.s !== s) return;
      s.opts = opts;
      s.data = data;
      s.base = opts.values;
      s.d = this.draftFrom(opts.values);
      s.start = JSON.stringify(this.snapshot(s.d));
    } catch (err) {
      if (this.s !== s) return;
      s.error = this.h.errText(err);
    }
    s.loading = false;
    this.render();
  }

  draftFrom(v) {
    const days = Array.isArray(v.quiet_days) ? v.quiet_days : [];
    const first = days.find((x) => x.on) || days[0] || { from: "22:00", to: "07:00" };
    const uniform = days.length === 7 && days.every((x) => x.on === days[0].on && x.from === days[0].from && x.to === days[0].to);
    return {
      exI: new Set(v.exclude_integrations || []),
      exT: new Set(v.exclude_types || []),
      exD: new Set(v.exclude_devices || []),
      target: v.notify_service || "none",
      on: { outage: Boolean(v.notify_outage), battery: Boolean(v.battery_push), new: Boolean(v.notify_new), charge: Boolean(v.notify_charge) },
      v: Object.fromEntries(VALUE_KEYS.map((k) => [k, String(v[k])])),
      quiet: { on: Boolean(v.quiet_enabled), from: first.from || "22:00", to: first.to || "07:00", uniform },
    };
  }

  snapshot(d) {
    return { i: [...d.exI].sort(), t: [...d.exT].sort(), d: [...d.exD].sort(), target: d.target, on: d.on, v: d.v, q: d.quiet };
  }

  dirty() {
    const s = this.s;
    return Boolean(s?.d) && JSON.stringify(this.snapshot(s.d)) !== s.start;
  }

  // X, Escape: ein geänderter Entwurf geht verloren, darum vorher fragen; ein ungeöffneter "new" wird zu "later" (das Fenster kommt nicht von selbst wieder)
  requestClose() {
    if (this.dirty() && this.s.step !== "welcome") {
      this.host._askConfirm({ title: "wzDiscardTitle", note: "wzDiscardNote", no: "wzDiscardNo", yes: "wzDiscardYes", noIcon: "pencil", yesIcon: "close" }, () => this.close());
      return;
    }
    this.close();
  }

  close() {
    const dlg = this.dlg;
    if (dlg?.open) dlg.close();
    this.s = null;
    if (this.state() === "new") this.setState("later");
  }

  // --- Schritte -------------------------------------------------------------------

  // Reihenfolge ohne "welcome": die Ruhezeit nur mit Ziel
  steps() {
    const d = this.s?.d;
    return ["integrations", "types", "devices", "messages", ...(d && d.target !== "none" ? ["quiet"] : []), "done"];
  }

  go(step) {
    const s = this.s;
    if (!s || s.loading) return;
    s.step = step;
    s.test = "";
    this.render();
    const body = this.dlg?.querySelector("[data-wz-body]");
    if (body) body.scrollTop = 0;
  }

  next() {
    const s = this.s;
    if (!s) return;
    if (s.step === "welcome") return this.go(this.steps()[0]);
    const list = this.steps();
    const i = list.indexOf(s.step);
    if (i >= 0 && i < list.length - 1 && !this.invalid()) this.go(list[i + 1]);
  }

  back() {
    const s = this.s;
    if (!s) return;
    const list = this.steps();
    const i = list.indexOf(s.step);
    this.go(i <= 0 ? "welcome" : list[i - 1]);
  }

  // --- Zahlen nach dem Entwurf ---------------------------------------------------

  // Geräte, die nach Integrationen und Typen übrig sind
  afterIntegrations() {
    const { data, d } = this.s;
    return data.devices.filter((x) => !d.exI.has(x.domain));
  }

  afterTypes() {
    return this.afterIntegrations().filter((x) => !this.s.d.exT.has(x.type));
  }

  chosen() {
    const { d } = this.s;
    return this.afterTypes().filter((x) => !d.exD.has(x.id));
  }

  // Fehler der Meldungs-Zahlen: Text oder ""
  invalid() {
    const s = this.s;
    if (s?.step !== "messages" || !s.d) return "";
    const limits = s.opts.limits || {};
    const num = (k) => (/^\d+$/.test(String(s.d.v[k]).trim()) ? Number(s.d.v[k]) : NaN);
    for (const key of VALUE_KEYS) {
      const [lo, hi] = limits[key] || [1, 999];
      const n = num(key);
      if (!(n >= lo && n <= hi)) return this.t("wzErrRange", this.t(this.valueLabel(key)), lo, hi);
    }
    const detect = Number(s.base.offline_after);
    if (num("notify_delay") < detect) return this.t("wzErrDelay", detect);
    return "";
  }

  valueLabel(key) {
    for (const rows of Object.values(VALUES)) for (const [k, label] of rows) if (k === key) return label;
    return key;
  }

  // --- Zeichnen ------------------------------------------------------------------

  render() {
    const dlg = this.dlg;
    const s = this.s;
    if (!dlg || !s) return;
    const { escape, mdi } = this.h;
    const t = (k, ...a) => this.t(k, ...a);
    let top = "";
    let body = "";
    let foot = "";
    const close = `<button type="button" class="wz-x" data-wz="close" title="${escape(t("wzClose"))}" aria-label="${escape(t("wzClose"))}">${mdi("close", 18)}</button>`;
    if (s.loading || s.error || !s.d) {
      body = s.error
        ? `<div class="dlg-error">${escape(t("wzLoadError"))} ${escape(s.error)}</div>`
        : `<p class="wz-p">${escape(t("wzLoading"))}</p>`;
      foot = `<button type="button" class="dlg-btn" data-wz="close">${escape(t("wzClose"))}</button>${s.error ? `<button type="button" class="dlg-btn primary" data-wz="retry">${mdi("verCheck", 18)}${escape(t("wzRetry"))}</button>` : ""}`;
      top = `<div class="wz-top"><div class="wz-stp"><span></span>${close}</div></div>`;
    } else if (s.step === "welcome") {
      top = `<div class="wz-top"><div class="wz-stp"><span></span>${close}</div></div>`;
      body = this.welcomeHtml();
      foot = `<div class="wz-welcome-ft"><button type="button" class="dlg-btn primary" data-wz="start">${escape(t("wzStart"))}</button>
        <div class="wz-ft2"><button type="button" class="dlg-btn" data-wz="later">${escape(t("wzLater"))}</button><button type="button" class="dlg-btn" data-wz="never">${escape(t("wzNever"))}</button></div></div>`;
    } else {
      const list = this.steps();
      const n = list.indexOf(s.step) + 1;
      const pct = Math.round((100 * n) / list.length);
      top = `<div class="wz-top"><div class="wz-prog"><i style="width:${pct}%"></i></div><div class="wz-stp"><span><b>${escape(t("wzStep", n, list.length))}</b> · ${escape(t(`wzS_${s.step}`))}</span>${close}</div></div>`;
      body = this[`${s.step}Html`]();
      const last = s.step === "done";
      foot = `<button type="button" class="dlg-btn" data-wz="back"${s.busy ? " disabled" : ""}>${escape(t("wzBack"))}</button>
        <button type="button" class="dlg-btn primary" data-wz="${last ? "finish" : "next"}"${s.busy || this.invalid() ? " disabled" : ""}>${escape(t(last ? (s.busy ? "wzSaving" : "wzFinish") : "wzNext"))}</button>`;
    }
    dlg.innerHTML = `${top}<div class="wz-bd" data-wz-body>${body}</div><div class="wz-ft">${foot}</div>`;
  }

  welcomeHtml() {
    const { escape, mdi } = this.h;
    const t = (k, ...a) => this.t(k, ...a);
    const point = (n, a, b) => `<div><u>${n}</u><span>${escape(t(a))}<small>${escape(t(b))}</small></span></div>`;
    return `<div class="wz-hero">${mdi("rocket", 36)}</div><h1 class="wz-h">${escape(t("wzWelcomeTitle"))}</h1>
      <p class="wz-p">${escape(t("wzWelcomeText"))}</p>
      <div class="wz-pts">${point(1, "wzP1", "wzP1s")}${point(2, "wzP2", "wzP2s")}${point(3, "wzP3", "wzP3s")}</div>
      <p class="wz-p small">${escape(t("wzTime"))}</p>`;
  }

  toggle(attr, value, on, label) {
    return `<label class="switch"><input type="checkbox" ${attr}="${this.h.escape(value)}"${on ? " checked" : ""} aria-label="${this.h.escape(label)}"><span></span></label>`;
  }

  searchHtml(key, show) {
    if (!show) return "";
    const { escape, mdi } = this.h;
    return `<label class="list-search">${mdi("search", 16)}<input type="search" data-wz-q="${key}" placeholder="${escape(this.t(key === "integ" ? "wzISearch" : "wzDSearch"))}" value="${escape(this.s.q[key])}" aria-label="${escape(this.t(key === "integ" ? "wzISearch" : "wzDSearch"))}"></label>`;
  }

  // Schritt 1: Integrationen
  integrationsHtml() {
    const { escape } = this.h;
    const { data, d } = this.s;
    const total = data.devices.length;
    return `<h2 class="wz-h2">${escape(this.t("wzITitle"))}</h2><p class="wz-p">${escape(this.t("wzIText", data.integrations.length, total))}</p>
      ${this.searchHtml("integ", data.integrations.length >= SEARCH_MIN)}<div data-wz-list>${this.integListHtml()}</div>`;
  }

  integListHtml() {
    const { escape } = this.h;
    const { data, d, q } = this.s;
    const needle = q.integ.trim().toLowerCase();
    const rows = data.integrations
      .filter((i) => !needle || String(i.name).toLowerCase().includes(needle))
      .map((i) => {
        const hint = i.domain === "mobile_app" ? this.t("wzHintPhone") : ["apple_tv", "samsungtv", "cast", "webostv", "androidtv", "roku", "sonos"].includes(i.domain) ? this.t("wzHintOff") : "";
        return `<div class="wz-li">${this.host._ibadge(i.domain, i.name)}<div class="wz-nm">${escape(i.name)}${hint ? `<span class="wz-tag">${escape(hint)}</span>` : ""}<small>${escape(this.t("devicesCount", i.devices))}</small></div>${this.toggle("data-wz-integ", i.domain, !d.exI.has(i.domain), i.name)}</div>`;
      });
    return rows.length ? rows.join("") : `<p class="wz-p small">${escape(this.t("wzNoMatch"))}</p>`;
  }

  // Schritt 2: Gerätetypen (nur die, die nach Schritt 1 noch Geräte haben)
  typesHtml() {
    const { escape } = this.h;
    const left = this.afterIntegrations();
    const types = new Map();
    for (const x of left) types.set(x.type, (types.get(x.type) || 0) + 1);
    // Ein abgewählter Typ ohne Geräte (nach Schritt 1) bleibt wählbar, damit sich nichts "verliert"
    for (const k of this.s.d.exT) if (!types.has(k)) types.set(k, 0);
    this.s.typeCounts = types;
    const tip = types.has("phone") || types.has("media") ? `<div class="wz-tip">${escape(this.t("wzTTip"))}</div>` : "";
    return `<h2 class="wz-h2">${escape(this.t("wzTTitle"))}</h2><p class="wz-p">${escape(this.t("wzTText", left.length, [...types.values()].filter((n) => n > 0).length))}</p>
      <div data-wz-list>${this.typeListHtml()}</div>${tip}`;
  }

  typeListHtml() {
    const { escape } = this.h;
    const { d } = this.s;
    const order = this.host._typeOrder?.() || [];
    const types = [...this.s.typeCounts.entries()].sort((a, b) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99));
    return types
      .map(([type, n]) => {
        const label = this.host._typeLabel(type);
        return `<div class="wz-li"><span class="wz-ic">${this.host._typeIcon(type, 18)}</span><div class="wz-nm">${escape(label)}<small>${escape(this.t("devicesCount", n))}</small></div>${this.toggle("data-wz-type", type, !d.exT.has(type), label)}</div>`;
      })
      .join("");
  }

  // Schritt 3: Geräte, gruppiert nach Integration
  devicesHtml() {
    const { escape } = this.h;
    const total = this.afterTypes().length;
    return `<h2 class="wz-h2">${escape(this.t("wzDTitle"))}</h2><p class="wz-p" data-wz-lead>${escape(this.t("wzDText", this.chosen().length, total))}</p>
      ${this.searchHtml("dev", total >= SEARCH_MIN)}<div data-wz-list>${this.deviceListHtml()}</div>`;
  }

  deviceListHtml() {
    const { escape, mdi } = this.h;
    const { d, q, data } = this.s;
    const needle = q.dev.trim().toLowerCase();
    const groups = new Map();
    for (const x of this.afterTypes()) {
      if (!groups.has(x.domain)) groups.set(x.domain, []);
      groups.get(x.domain).push(x);
    }
    const names = Object.fromEntries(data.integrations.map((i) => [i.domain, i.name]));
    const out = [];
    for (const dom of [...groups.keys()].sort((a, b) => String(names[a] || a).localeCompare(String(names[b] || b)))) {
      const all = groups.get(dom);
      const shown = needle ? all.filter((x) => `${x.name} ${x.area}`.toLowerCase().includes(needle)) : all;
      if (!shown.length) continue;
      const on = all.filter((x) => !d.exD.has(x.id)).length;
      const open = Boolean(needle) || this.s.open.has(dom);
      const state = on === all.length ? "on" : on ? "part" : "off";
      out.push(`<div class="wz-grp"><button type="button" class="wz-gh" data-wz-open="${escape(dom)}" aria-expanded="${open}"><span class="wz-chev${open ? " open" : ""}">${mdi("chevronRight", 16)}</span>${this.host._ibadge(dom, names[dom] || dom)}<span class="wz-gn">${escape(names[dom] || dom)}</span><span class="wz-cn">${escape(this.t("wzOf", on, all.length))}</span></button>
        <label class="switch${state === "part" ? " part" : ""}"><input type="checkbox" data-wz-group="${escape(dom)}"${on ? " checked" : ""} aria-label="${escape(names[dom] || dom)}"><span></span></label></div>`);
      if (open) {
        out.push(`<div class="wz-sub">${shown.map((x) => `<div class="wz-li"><div class="wz-nm">${escape(x.name)}${x.area ? `<small>${escape(x.area)}</small>` : ""}</div>${this.toggle("data-wz-dev", x.id, !d.exD.has(x.id), x.name)}</div>`).join("")}</div>`);
      }
    }
    return out.length ? out.join("") : `<p class="wz-p small">${escape(this.t("wzNoMatch"))}</p>`;
  }

  // Schritt 4: Meldungen: Ziel, ein Schalter je Art, darunter die jetzigen Werte zum Anpassen
  messagesHtml() {
    const { escape, mdi } = this.h;
    const { d, opts } = this.s;
    const none = d.target === "none";
    const label = (x) => (x.kind === "none" ? this.t("wzMNoTarget") : x.kind === "missing" ? `${x.value} (${this.t("wzMissing")})` : x.value);
    const targets = (opts.notify_targets || []).map((x) => `<option value="${escape(x.value)}"${x.value === d.target ? " selected" : ""}>${escape(label(x))}</option>`).join("");
    const rows = MSG_ROWS.map((id) => {
      const vals = VALUES[id]
        .map(([key, lab, unit]) => {
          const [lo, hi] = opts.limits?.[key] || [1, 999];
          return `<label class="wz-v"><span>${escape(this.t(lab))}</span><input type="number" inputmode="numeric" min="${lo}" max="${hi}" step="1" data-wz-v="${key}" value="${escape(d.v[key])}"${none ? " disabled" : ""}><em>${escape(this.t(unit))}</em></label>`;
        })
        .join("");
      return `<div class="wz-msg${d.on[id] && !none ? " on" : ""}"><div class="wz-li"><span class="wz-ic">${mdi(MSG_ICON[id], 18)}</span><div class="wz-nm">${escape(this.t(`wzM_${id}`))}<small>${escape(this.t(`wzM_${id}_s`))}</small></div>${this.toggle("data-wz-msg", id, d.on[id] && !none, this.t(`wzM_${id}`)).replace("<input", none ? "<input disabled" : "<input")}</div><div class="wz-vals">${vals}</div></div>`;
    }).join("");
    return `<h2 class="wz-h2">${escape(this.t("wzMTitle"))}</h2><p class="wz-p">${escape(this.t("wzMText"))}</p>
      <div class="wz-lab">${escape(this.t("wzMTarget"))}</div><label class="wz-sel"><select data-wz-target aria-label="${escape(this.t("wzMTarget"))}">${targets}</select>${mdi("chevronDown", 18)}</label>
      ${none ? `<p class="wz-p small">${escape(this.t("wzMNoTargetHint"))}</p>` : `<div class="wz-testrow"><button type="button" class="dlg-btn" data-wz="test"${this.s.testing ? " disabled" : ""}>${mdi("send", 18)}${escape(this.t("wzTest"))}</button><span class="wz-testres ${this.s.test ? this.s.test.split(":")[0] : ""}" data-wz-testres role="status">${escape(this.testText())}</span></div>`}
      <div class="wz-lab">${escape(this.t("wzMRows"))}</div>${rows}
      <div class="opt-error wz-err" data-wz-err role="alert">${escape(this.invalid())}</div>
      <p class="wz-p small">${escape(this.t("wzMLater"))}</p>`;
  }

  testText() {
    const r = this.s.test;
    return r === "ok" ? this.t("wzTestOk") : r === "fail" ? this.t("wzTestFail") : r === "busy" ? this.t("wzTestBusy") : "";
  }

  // Schritt 5: Ruhezeit (nur mit Ziel)
  quietHtml() {
    const { escape } = this.h;
    const { d } = this.s;
    const q = d.quiet;
    const fields = q.uniform
      ? `<div class="wz-times"><label>${escape(this.t("wzQFrom"))}<input type="time" data-wz-time="from" value="${escape(q.from)}"${q.on ? "" : " disabled"}></label><label>${escape(this.t("wzQTo"))}<input type="time" data-wz-time="to" value="${escape(q.to)}"${q.on ? "" : " disabled"}></label></div>`
      : `<p class="wz-p small">${escape(this.t("wzQCustom"))}</p>`;
    return `<h2 class="wz-h2">${escape(this.t("wzQTitle"))}</h2><p class="wz-p">${escape(this.t("wzQText"))}</p>
      <div class="wz-li">${this.h.mdi("bellOff", 18).replace("<svg", '<svg class="wz-ic-svg"')}<div class="wz-nm">${escape(this.t("wzQUse"))}<small>${escape(this.t("wzQUseSub"))}</small></div>${this.toggle("data-wz-quiet", "on", q.on, this.t("wzQUse"))}</div>${q.on ? fields : ""}`;
  }

  // Schritt 6: Zusammenfassung
  doneHtml() {
    const { escape, mdi } = this.h;
    const { d, data, opts } = this.s;
    const t = (k, ...a) => this.t(k, ...a);
    const types = new Set(this.afterIntegrations().map((x) => x.type));
    const typesOn = [...types].filter((k) => !d.exT.has(k)).length;
    const msgs = d.target === "none" ? [] : MSG_ROWS.filter((id) => d.on[id]).map((id) => t(`wzM_${id}`));
    const target = d.target === "none" ? t("wzNone") : d.target;
    const row = (a, b) => `<div class="wz-li"><div class="wz-nm">${escape(a)}</div><b class="wz-val">${escape(b)}</b></div>`;
    const quiet = d.target === "none" ? "" : row(t("wzSumQuiet"), d.quiet.on ? (d.quiet.uniform ? `${d.quiet.from} – ${d.quiet.to}` : t("wzQCustomShort")) : t("wzOff"));
    return `<div class="wz-check">${mdi("check", 30)}</div><h2 class="wz-h2">${escape(t("wzDoneTitle"))}</h2><p class="wz-p">${escape(t("wzDoneText"))}</p>
      <div class="wz-sum">${row(t("wzSumInteg"), t("wzOf", data.integrations.length - d.exI.size, data.integrations.length))}${row(t("wzSumTypes"), t("wzOf", typesOn, types.size))}${row(t("wzSumDevices"), t("wzOf", this.chosen().length, this.afterTypes().length))}${row(t("wzSumTarget"), target)}${row(t("wzSumMsgs"), msgs.length ? msgs.join(", ") : t("wzNone"))}${quiet}</div>
      ${this.s.saveError ? `<div class="dlg-error">${escape(t("wzSaveError"))} ${escape(this.s.saveError)}</div>` : ""}
      <p class="wz-p">${escape(t("wzDoneFoot"))}</p>`;
  }

  // --- Speichern ------------------------------------------------------------------

  values() {
    const { d, base, opts, data } = this.s;
    const n = (k) => Number(String(d.v[k]).trim());
    const values = {
      exclude_integrations: [...d.exI].sort(),
      exclude_types: [...d.exT].sort(),
      exclude_devices: [...d.exD].sort(),
      notify_service: d.target,
      notify_outage: d.on.outage,
      // Ausfall und Rückkehr zusammen; ein früher eigens gesetztes "Rückkehr aus" bleibt, wenn der Ausfall schon an war
      notify_online: d.on.outage ? (base.notify_outage ? Boolean(base.notify_online) : true) : false,
      battery_push: d.on.battery,
      notify_new: d.on.new,
      notify_charge: d.on.charge,
      ...Object.fromEntries(VALUE_KEYS.map((k) => [k, n(k)])),
      wizard_state: "done",
      wizard_done_at: Math.floor(Date.now() / 1000),
    };
    // Die Lademeldung gilt nur für Integrationen, die dafür gewählt sind: ohne Wahl alle mit Batteriegeräten
    if (d.on.charge && !(base.charge_integrations || []).length) {
      values.charge_integrations = (opts.catalog?.battery || []).map((b) => b.domain).filter((dom) => !d.exI.has(dom));
    }
    if (d.target !== "none") {
      values.quiet_enabled = d.quiet.on;
      if (d.quiet.on && d.quiet.uniform) values.quiet_days = Array.from({ length: 7 }, () => ({ on: true, from: d.quiet.from, to: d.quiet.to }));
    }
    // Ohne Ziel sind Meldungen und Ruhezeit nicht Teil der Wahl: nichts anfassen ausser dem Ziel
    if (d.target === "none") for (const k of ["notify_outage", "notify_online", "battery_push", "notify_new", "notify_charge"]) delete values[k];
    return values;
  }

  async finish() {
    const s = this.s;
    if (!s || s.busy) return;
    s.busy = true;
    s.saveError = "";
    this.render();
    try {
      await this.host._hass.callWS({ type: "device_panel/set_options", values: this.values() });
    } catch (err) {
      s.busy = false;
      s.saveError = this.h.errText(err);
      this.render();
      return;
    }
    this.host._wizardState = "done";
    this.s = null;
    const dlg = this.dlg;
    if (dlg?.open) dlg.close();
    this.host._apps?.paintDots();
    // Die Liste richtet sich nach den neuen Ausschlüssen; eine offene Einstellungsseite liest ihre Werte neu
    this.host._fetch(true);
    this.host._settingsReload?.();
    this.host._apps?.snack?.(this.t("wzDoneSnack"));
  }

  // --- Eingaben ---------------------------------------------------------------------

  bind(dlg) {
    if (!dlg || this._bound) return;
    this._bound = true;
    dlg.addEventListener("click", (ev) => {
      const open = ev.target.closest?.("[data-wz-open]");
      if (open && this.s) {
        const dom = open.dataset.wzOpen;
        if (this.s.open.has(dom)) this.s.open.delete(dom);
        else this.s.open.add(dom);
        this.refreshList();
        return;
      }
      const btn = ev.target.closest?.("[data-wz]");
      if (!btn || btn.disabled || !this.s) return;
      const a = btn.dataset.wz;
      if (a === "close") this.requestClose();
      else if (a === "start" || a === "next") this.next();
      else if (a === "back") this.back();
      else if (a === "later") this.close();
      else if (a === "never") {
        this.dlg?.close();
        this.s = null;
        this.setState("off");
      } else if (a === "finish") this.finish();
      else if (a === "retry") this.load();
      else if (a === "test") this.test();
    });
    dlg.addEventListener("change", (ev) => {
      const s = this.s;
      const el = ev.target;
      if (!s?.d || !el.matches) return;
      const { d } = s;
      const flip = (set, key, on) => (on ? set.delete(key) : set.add(key));
      if (el.matches("[data-wz-integ]")) {
        flip(d.exI, el.dataset.wzInteg, el.checked);
        this.refreshList();
      } else if (el.matches("[data-wz-type]")) {
        flip(d.exT, el.dataset.wzType, el.checked);
        this.refreshList();
      } else if (el.matches("[data-wz-dev]")) {
        flip(d.exD, el.dataset.wzDev, el.checked);
        this.refreshList();
      } else if (el.matches("[data-wz-group]")) {
        for (const x of this.afterTypes().filter((y) => y.domain === el.dataset.wzGroup)) flip(d.exD, x.id, el.checked);
        this.refreshList();
      } else if (el.matches("[data-wz-msg]")) {
        d.on[el.dataset.wzMsg] = el.checked;
        this.render();
      } else if (el.matches("[data-wz-target]")) {
        d.target = el.value;
        s.test = "";
        this.render();
      } else if (el.matches("[data-wz-quiet]")) {
        d.quiet.on = el.checked;
        this.render();
      } else if (el.matches("[data-wz-time]")) {
        d.quiet[el.dataset.wzTime] = el.value || d.quiet[el.dataset.wzTime];
      }
    });
    dlg.addEventListener("input", (ev) => {
      const s = this.s;
      const el = ev.target;
      if (!s?.d || !el.matches) return;
      if (el.matches("[data-wz-v]")) {
        s.d.v[el.dataset.wzV] = el.value;
        // Nur Fehlerzeile und Weiter neu setzen, damit die Eingabe ihren Fokus behält
        const err = this.invalid();
        const line = dlg.querySelector("[data-wz-err]");
        if (line) line.textContent = err;
        const next = dlg.querySelector('.wz-ft [data-wz="next"]');
        if (next) next.disabled = Boolean(err);
      } else if (el.matches("[data-wz-q]")) {
        s.q[el.dataset.wzQ] = el.value;
        this.refreshList();
      }
    });
    // Escape: wie das Kreuz
    dlg.addEventListener("cancel", (ev) => {
      ev.preventDefault();
      this.requestClose();
    });
  }

  // Liste und Zahlen neu, ohne das Suchfeld anzufassen (Fokus und Bildlauf bleiben)
  refreshList() {
    const s = this.s;
    const dlg = this.dlg;
    if (!s?.d || !dlg) return;
    const list = dlg.querySelector("[data-wz-list]");
    if (!list) return;
    const body = dlg.querySelector("[data-wz-body]");
    const keep = body ? body.scrollTop : 0;
    if (s.step === "integrations") list.innerHTML = this.integListHtml();
    else if (s.step === "types") list.innerHTML = this.typeListHtml();
    else if (s.step === "devices") {
      list.innerHTML = this.deviceListHtml();
      const lead = dlg.querySelector("[data-wz-lead]");
      if (lead) lead.textContent = this.t("wzDText", this.chosen().length, this.afterTypes().length);
    }
    if (body) body.scrollTop = keep;
  }

  async test() {
    const s = this.s;
    if (!s || s.d.target === "none") return;
    s.testing = true;
    s.test = "busy";
    this.render();
    try {
      const r = await this.host._hass.callWS({ type: "device_panel/wizard_test", target: s.d.target });
      s.test = r.sent ? "ok" : "fail";
    } catch (err) {
      s.test = "fail";
    }
    s.testing = false;
    if (this.s === s) this.render();
  }
}
