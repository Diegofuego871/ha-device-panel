/**
 * HealthCheck-Dienste (seit 2.236.0, Wunsch des Nutzers; Vorbild: Alarmageddon 1.65.0 bis 1.74.1): Lebenszeichen an externe Dienste (bis zu 5), verwaltet in
 * Fenstern wie Routinen und Ladungen. Generisch: je Dienst Name, URL und Abstand, keine Auswahl des Anbieters. Für bekannte Dienste schlägt das Panel
 * den Zusatz vor (`suggest`); der Nutzer hat immer das letzte Wort: ein Vorschlag füllt den Zusatz nur, solange ihn niemand berührt hat, sonst steht er
 * als "Übernehmen" daneben. Statt des "Fehler" von Alarmageddon gibt es "Fälle" (Entscheid des Nutzers): je Dienst eine geordnete Liste von Zeilen mit
 * einer Art (Gerät ausgefallen, Batterie schwach, Backup fehlgeschlagen) und eigenem URL-Zusatz; die oberste zutreffende Zeile gilt. Die URL steht ganz
 * im Fenster (Ausnahme vom Geheimnis-Grundsatz, Entscheid des Nutzers wie bei Alarmageddon; nur Administratoren bekommen sie). Sofort gespeichert
 * (WebSocket healthcheck_save/_delete), nicht Teil des Entwurfs der Einstellungen. Testknöpfe je Zeile: "OK senden" und je Fall "<Fall> senden".
 * Das Protokoll eines Dienstes öffnet healthlog.js.
 */

const MIN = 60;
const MAX = 86400;
// Schnellwahl des Abstands: Zahl und Einheit gehen für jeden anderen Wert von 1 Minute bis 24 Stunden
const PRESETS = [60, 300, 900, 3600, 21600, 86400];
export const CASES = ["offline", "battery", "backup"];
const CASE_ICON = { offline: "signalOff", battery: "battery", backup: "save" };
// Nachrichten der Vorschläge bleiben Englisch (Vorgabe des Nutzers bei Alarmageddon): der Dienst zeigt sie in seinem Verlauf
const CASE_MSG = { offline: "Device+offline", battery: "Battery+low", backup: "Backup+failed" };

// Bekannte Dienste: erkannt an der URL. `suffix(kind)` ist der Zusatz, den das Panel für einen Fall vorschlägt (Healthchecks.io und Better Stack kennen nur "/fail").
const KNOWN = [
  { name: "Healthchecks.io", suffix: () => "/fail", test: (u) => u.hostname === "hc-ping.com" },
  { name: "Healthchecks", suffix: () => "/fail", test: (u) => /^\/ping\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i.test(u.pathname) },
  { name: "Better Stack", suffix: () => "/fail", test: (u) => /(^|\.)(betterstack\.com|betteruptime\.com)$/.test(u.hostname) && u.pathname.includes("/heartbeat/") },
  { name: "Cronitor", suffix: (k) => `?state=fail&message=${CASE_MSG[k]}`, test: (u) => u.hostname === "cronitor.link" },
  { name: "Uptime Kuma", suffix: (k) => `?status=down&msg=${CASE_MSG[k]}`, test: (u) => u.pathname.includes("/api/push/") },
];

// Beispiele unter der Liste (zum Aufklappen); dieselben Anbieter wie KNOWN. Uptime Kuma läuft meist beim Nutzer selbst: sinnvoll nur ausserhalb von Home Assistant.
const EXAMPLES = [["Healthchecks.io", "https://healthchecks.io"], ["Cronitor", "https://cronitor.io"], ["Better Stack", "https://betterstack.com"], ["Uptime Kuma", "https://github.com/louislam/uptime-kuma", "hcAboutKuma"]];

export function suggest(url) {
  let u;
  try {
    u = new URL(String(url || "").trim());
  } catch {
    return null;
  }
  return KNOWN.find((k) => k.test(u)) || null;
}

// Wie der Server (healthcheck.apply_suffix): "/…" an den Pfad, "?…" oder "&…" setzt Parameter und ersetzt gleichnamige; sonst null
export function applySuffix(url, suffix) {
  const s = String(suffix || "").trim();
  if (!s) return null;
  let u;
  try {
    u = new URL(String(url || "").trim());
  } catch {
    return null;
  }
  if (s.startsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "") + s;
    return u.toString();
  }
  if (s[0] === "?" || s[0] === "&") {
    const extra = new URLSearchParams(s.slice(1));
    if (![...extra.keys()].length) return null;
    const keep = [...u.searchParams.entries()].filter(([k]) => !extra.has(k));
    u.search = new URLSearchParams([...keep, ...extra.entries()]).toString();
    return u.toString();
  }
  return null;
}

export const validUrl = (url) => {
  const s = String(url || "").trim();
  if (!s || s.length > 500 || /\s/.test(s)) return false;
  try {
    const u = new URL(s);
    return (u.protocol === "http:" || u.protocol === "https:") && Boolean(u.hostname);
  } catch {
    return false;
  }
};

const validSuffix = (url, s) => {
  const x = String(s || "").trim();
  return Boolean(x) && /^[/?&]/.test(x) && !/\s/.test(x) && x.length <= 200 && Boolean(applySuffix(url, x));
};

export class HealthCheckUi {
  constructor(host, deps) {
    this.host = host;
    this.h = deps;
    this.items = [];
    this.max = 5;
    this.loaded = false;
    this.error = "";
    this.q = "";
    this.sort = { key: "name", dir: "asc" };
    this.form = null; // offenes Formular: { id, name, url, value, unit, cases: [{kind, suffix, touched}], pick, error, saving, shown }
    this.busy = new Set(); // laufende Tests "id|ok" oder "id|<Fall>"
    this.aboutOpen = false;
  }

  t(key, ...args) {
    return this.host._t(key, ...args);
  }

  get listDlg() {
    return this.host.shadowRoot.querySelector("dialog.hc-dlg");
  }

  get formDlg() {
    return this.host.shadowRoot.querySelector("dialog.hc-form-dlg");
  }

  get admin() {
    return this.host._hass?.user?.is_admin !== false;
  }

  // Die Liste kommt auf Abruf (nur Administratoren), nie mit den Daten für alle. Danach das Kapitel in den Einstellungen und die Liste nachführen.
  async load() {
    if (!this.host._hass || !this.admin) return;
    try {
      const res = await this.host._hass.callWS({ type: "device_panel/healthcheck_list" });
      this.items = res.items || [];
      this.max = res.max || 5;
      this.error = "";
    } catch (err) {
      this.error = this.h.errText(err);
    }
    this.loaded = true;
    this._changed();
  }

  _apply(res) {
    if (res?.items) {
      this.items = res.items;
      this.max = res.max || this.max;
      this.loaded = true;
    }
  }

  // Alles nachführen, was die Liste zeigt: das Kapitel in den Einstellungen, die Liste und (falls offen) das Protokoll
  _changed() {
    if (this.host._settings && this.host.shadowRoot.querySelector("dialog.settings")?.open) this.host._renderSettings();
    this.renderList();
    this.host._hl?.refresh?.();
  }

  // ----- Kapitel in den Einstellungen (Überwachung und Meldungen) -----

  stateOf(i) {
    if (i.log?.state) return i.log.state;
    const s = i.status;
    return s ? (s.result !== "ok" ? "fail" : s.sent !== "ok" && !s.test ? "report" : "ok") : null;
  }

  summaryHtml() {
    const { escape, mdi } = this.h;
    const n = this.items.length;
    if (!this.loaded) return `<div class="opt hc-sum"><div class="opt-short">${escape(this.t(this.error ? "hcLoadError" : "hcLoading", this.error))}</div></div>`;
    const failed = this.items.filter((i) => i.status && i.status.result !== "ok").length;
    const text = n ? this.t("hcSummary", n, this.max) : this.t("hcNone");
    const sub = !n ? this.t("hcNoneHint") : failed ? this.t(failed === 1 ? "hcFailedOne" : "hcFailed", failed) : this.t("hcAllOk");
    return `<div class="opt hc-sum"><span class="hc-ico${n ? " on" : ""}">${mdi("heartPulse", 22)}</span>
      <div class="hc-sum-tx"><b>${escape(text)}</b><small class="${failed ? "hc-bad" : ""}">${escape(sub)}</small></div>
      <div class="hc-sum-btns"><button type="button" class="dlg-btn" data-set="hc-add" ${n >= this.max ? "disabled" : ""}>${mdi("plus", 18)}<span>${escape(this.t("hcAdd"))}</span></button>
        <button type="button" class="dlg-btn" data-set="hc-open">${mdi("heartPulse", 18)}<span>${escape(this.t("hcShow"))}</span></button></div></div>`;
  }

  // ----- Texte -----

  caseLabel(kind) {
    return this.t(`hcCase_${kind}`);
  }

  when(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "–";
    const locale = this.host._hass?.locale?.language || this.host._lang;
    const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString(locale, { day: "numeric", month: "short" })} ${time}`;
  }

  statusText(s) {
    if (!s) return this.t("hcStNone");
    const what = s.sent === "ok" ? this.t("hcStOkSent") : this.t("hcStCaseSent", this.caseLabel(s.sent));
    const test = s.test ? ` (${this.t("hcStTest")})` : "";
    if (s.result === "ok") return `${what}${test} · HTTP ${s.code}`;
    const why = s.result === "http" ? `HTTP ${s.code}` : this.t(s.result === "timeout" ? "hcStTimeout" : "hcStError");
    return `${this.t("hcStFailed")}${test} · ${why}`;
  }

  tone(s) {
    if (!s) return "none";
    if (s.result !== "ok") return "err";
    return s.sent !== "ok" ? "warn" : "ok";
  }

  // ----- Fenster mit der Liste -----

  openList() {
    const dlg = this.listDlg;
    if (!dlg) return;
    if (!dlg.open) this.q = "";
    this.renderList(true);
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    this.host._blurOnTouch();
    this.load();
  }

  closeList() {
    const dlg = this.listDlg;
    if (dlg?.open) {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }
  }

  renderList(force = false) {
    const dlg = this.listDlg;
    if (!dlg || (!dlg.open && !force)) return;
    const { escape, mdi } = this.h;
    // Steht die Liste schon da, nur sie neu zeichnen: das Suchfeld behält Text und Fokus
    const body = dlg.querySelector("[data-hc-body]");
    if (body && !force) {
      body.innerHTML = this.body();
      const foot = dlg.querySelector("[data-hc-foot]");
      if (foot) foot.innerHTML = this.foot();
      const tools = dlg.querySelector("[data-hc-tools]");
      if (tools) tools.hidden = !this.items.length;
      return;
    }
    dlg.innerHTML = `<div class="dlg-head"><span class="dlg-avatar app app-health">${mdi("heartPulse", 28)}</span>
        <div class="dlg-title"><h2>${escape(this.t("hcListTitle"))}</h2></div>
        <button type="button" class="dlg-close" data-hc="close" title="${escape(this.t("close"))}" aria-label="${escape(this.t("close"))}">${mdi("close", 18)}</button></div>
      <div class="dlg-body"><div class="hc-tools" data-hc-tools ${this.items.length ? "" : "hidden"}>
          <label class="list-search">${mdi("search", 18)}<input type="search" data-hc="search" value="${escape(this.q)}" placeholder="${escape(this.t("hcFilter"))}" autocomplete="off" aria-label="${escape(this.t("hcFilter"))}">${this.host._fieldClearHtml("data-fc", "", this.q)}</label></div>
        <div data-hc-body>${this.body()}</div>${this.about()}</div>
      <div class="dlg-actions" data-hc-foot>${this.foot()}</div>`;
  }

  // Was diese Dienste sind, mit Beispielen: zum Aufklappen unter der Liste. Offen bleibt es, auch wenn das Fenster neu gezeichnet wird
  about() {
    const { escape, mdi } = this.h;
    const lines = ["hcAbout1", "hcAbout2", "hcAbout3"].map((k) => `<li>${escape(this.t(k))}</li>`).join("");
    const links = EXAMPLES.map(([name, url, note]) => `<li><a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(name)}</a> <span class="hc-t2">${escape(url.replace(/^https:\/\//, ""))}${note ? ` · ${escape(this.t(note))}` : ""}</span></li>`).join("");
    return `<details class="hc-about" ${this.aboutOpen ? "open" : ""}><summary data-hc="about">${mdi("info", 16)}<span>${escape(this.t("hcAbout"))}</span></summary>
      <ul>${lines}</ul><p>${escape(this.t("hcAboutExamples"))}</p><ul class="hc-ex">${links}</ul></details>`;
  }

  // "Schliessen" und "Dienst hinzufügen" nebeneinander rechts; "Dienst hinzufügen" erst, wenn die Liste nicht leer ist (sonst steht er in der Mitte)
  foot() {
    const { escape, mdi } = this.h;
    const n = this.items.length;
    const add = n ? `<button type="button" class="dlg-btn primary" data-hc="add" ${n >= this.max ? "disabled" : ""}>${mdi("plus", 18)}${escape(this.t("hcAdd"))}</button>` : "";
    return `<button type="button" class="dlg-btn" data-hc="close">${mdi("close", 18)}${escape(this.t("close"))}</button>${add}`;
  }

  matches(i) {
    const q = this.q.trim().toLowerCase();
    if (!q) return true;
    const hay = [i.name, i.url, suggest(i.url)?.name || "", ...(i.cases || []).flatMap((c) => [this.caseLabel(c.kind), c.suffix]), this.statusText(i.status), this.host._fmtSeconds(i.interval)];
    return hay.some((x) => String(x || "").toLowerCase().includes(q));
  }

  body() {
    const { escape, mdi } = this.h;
    if (!this.loaded) return `<div class="pl-ldwrap empty">${this.host._loaderHtml("var(--dp-primary)")}</div>`;
    if (this.error && !this.items.length) return `<div class="dlg-error">${escape(this.error)}</div>`;
    if (!this.items.length) return `<div class="hc-empty"><span>${escape(this.t("hcEmpty"))}</span><button type="button" class="dlg-btn primary" data-hc="add">${mdi("plus", 18)}${escape(this.t("hcAdd"))}</button></div>`;
    const shown = this.items.filter((i) => this.matches(i));
    if (!shown.length) return `<p class="dlg-note">${escape(this.t("hcNoMatch"))}</p>`;
    const sort = this.sort;
    const val = { name: (i) => (i.name || i.url).toLowerCase(), last: (i) => i.status?.at || "", interval: (i) => i.interval, status: (i) => this.statusText(i.status) }[sort.key];
    const cmp = (a, b) => (typeof a === "number" ? a - b : String(a).localeCompare(String(b), this.host._lang || "en", { numeric: true }));
    const list = [...shown].sort((a, b) => cmp(val(a), val(b)) * (sort.dir === "desc" ? -1 : 1) || cmp(a.name || "", b.name || ""));
    const btn = (act, icon, label, id, extra = "", cls = "") => `<button type="button" class="hc-ib${cls ? ` ${cls}` : ""}" data-hc="${act}" data-id="${escape(id)}" ${extra} title="${escape(label)}" aria-label="${escape(label)}">${mdi(icon, 18)}</button>`;
    const rows = list.map((i) => {
      const known = suggest(i.url);
      const cases = (i.cases || []).map((c) => `<span class="hc-case-chip">${mdi(CASE_ICON[c.kind], 14)}<span class="hc-cl">${escape(this.caseLabel(c.kind))}</span><span class="hc-cs">${escape(c.suffix)}</span></span>`).join("");
      const tests = (i.cases || []).map((c) => btn("test", CASE_ICON[c.kind], this.t("hcTestCase", this.caseLabel(c.kind)), i.id, `data-kind="${escape(c.kind)}" ${this.busy.has(`${i.id}|${c.kind}`) ? "disabled" : ""}`, "warn")).join("");
      return `<div class="hc-row" data-hc-row="${escape(i.id)}"><div class="hc-main"><b class="hc-name">${escape(i.name || i.url)}</b><span class="hc-addr" title="${escape(i.url)}">${escape(i.url)}</span>
          <div class="hc-tags">${known ? `<span class="hc-tag">${escape(known.name)}</span>` : ""}${cases || `<span class="hc-t2">${escape(this.t("hcCasesNone"))}</span>`}</div>
          <div class="hc-state ${this.tone(i.status)}">${escape(this.statusText(i.status))}</div>
          <div class="hc-t2">${escape(`${this.t("hcColInterval")}: ${this.host._fmtSeconds(i.interval)} · ${this.t("hcColLast")}: ${i.status ? this.when(i.status.at) : "–"}`)}</div></div>
        <div class="hc-btns">${btn("log", "history", this.t("hlOpen"), i.id)}${tests}${btn("test", "check", this.t("hcTestOk"), i.id, `data-kind="ok" ${this.busy.has(`${i.id}|ok`) ? "disabled" : ""}`, "good")}${btn("edit", "pencil", this.t("hcEdit"), i.id)}${btn("delete", "trash", this.t("hcRemove"), i.id, "", "bad")}</div></div>`;
    }).join("");
    const keys = ["name", "last", "interval", "status"];
    const sortSel = `<label class="hc-sort"><span class="hc-t2">${escape(this.t("hcSortBy"))}</span><select data-hc="sort" aria-label="${escape(this.t("hcSortBy"))}">${keys.map((k) => `<option value="${k}" ${sort.key === k ? "selected" : ""}>${escape(this.t(`hcCol_${k}`))}</option>`).join("")}</select>
      <button type="button" class="hc-ib sm" data-hc="sort-dir" title="${escape(this.t("hcSortDir"))}" aria-label="${escape(this.t("hcSortDir"))}">${mdi(sort.dir === "desc" ? "arrowDown" : "arrowUp", 16)}</button></label>`;
    return `<div class="hc-listhead"><span class="hc-t2">${escape(this.t("hcCount", shown.length, this.items.length, this.max))}</span>${sortSel}</div><div class="hc-rows">${rows}</div>`;
  }

  // ----- Formular -----

  openForm(id = null) {
    const item = id ? this.items.find((i) => i.id === id) : null;
    if (!item && this.items.length >= this.max) return;
    const interval = item?.interval ?? 300;
    const hours = interval % 3600 === 0;
    const cases = (item?.cases || []).map((c) => ({ kind: c.kind, suffix: c.suffix, touched: true }));
    this.form = { id: item?.id || null, name: item?.name || "", url: item?.url || "", value: hours ? interval / 3600 : Math.round(interval / 60), unit: hours ? "h" : "min", cases, pick: "", error: "", saving: false, shown: false };
    this.form.pick = this._free()[0] || "";
    this.renderForm(true);
    const dlg = this.formDlg;
    if (!dlg) return;
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    this.host._blurOnTouch();
    if (!item) dlg.querySelector('[data-hc="f-name"]')?.focus();
  }

  closeForm() {
    this.form = null;
    const dlg = this.formDlg;
    if (dlg?.open) {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }
  }

  _free(f = this.form) {
    return CASES.filter((k) => !f?.cases.some((c) => c.kind === k));
  }

  seconds(f = this.form) {
    const n = Number(f.value);
    if (f.value === "" || !Number.isInteger(n)) return NaN;
    return f.unit === "h" ? n * 3600 : n * 60;
  }

  problems(f = this.form) {
    const out = {};
    const name = String(f.name || "").trim();
    if (!name || name.length > 60) out.name = this.t(name ? "hcErrNameLong" : "hcErrName");
    if (!validUrl(f.url)) out.url = this.t(String(f.url || "").trim() ? "hcErrUrl" : "hcErrUrlEmpty");
    f.cases.forEach((c, i) => {
      if (!String(c.suffix || "").trim()) out[`case${i}`] = this.t("hcErrCaseEmpty");
      else if (validUrl(f.url) && !validSuffix(f.url, c.suffix)) out[`case${i}`] = this.t("hcErrSuffix");
    });
    const sec = this.seconds(f);
    if (!Number.isFinite(sec) || sec < MIN || sec > MAX) out.interval = this.t("hcErrInterval");
    return out;
  }

  // Teile des Formulars, die sich beim Tippen ändern (Erkennung, Vorschlag, Vorschau, Fehler); die Felder selbst werden nie neu gebaut
  parts() {
    const { escape } = this.h;
    const f = this.form;
    const bad = this.problems();
    const known = suggest(f.url);
    const shown = (key, value) => (bad[key] && (f.shown || String(value ?? "").trim()) ? `<small class="hc-err">${escape(bad[key])}</small>` : "");
    const out = {
      known: known ? `<span class="hc-tag">${escape(this.t("hcKnown", known.name))}</span>` : "",
      "err-name": shown("name", f.name),
      "err-url": shown("url", f.url),
      "err-interval": "",
      presets: PRESETS.map((sec) => `<button type="button" class="sub-tab${this.seconds() === sec ? " on" : ""}" data-hc="f-preset" data-set="hc-preset" data-sec="${sec}" aria-pressed="${this.seconds() === sec}">${escape(this.host._fmtSeconds(sec, true))}</button>`).join(""),
    };
    out["err-interval"] = bad.interval ? `<small class="hc-err">${escape(bad.interval)}</small>` : "";
    f.cases.forEach((c, i) => {
      const preview = validUrl(f.url) && validSuffix(f.url, c.suffix) ? applySuffix(f.url, c.suffix) : null;
      const sug = known?.suffix(c.kind);
      out[`case${i}`] = `${sug && sug !== String(c.suffix || "").trim() ? `<div class="hc-offer"><span class="hc-t2">${escape(this.t("hcSuggest", known.name, sug))}</span><button type="button" class="lnk" data-hc="f-take" data-i="${i}">${escape(this.t("hcTake"))}</button></div>` : ""}
        <small class="hc-t2 hc-prev">${preview ? `${escape(this.t("hcPreview"))} <span class="hc-mono">${escape(preview)}</span>` : escape(this.t(String(c.suffix || "").trim() ? "hcPreviewNone" : "hcPreviewEmpty"))}</small>${shown(`case${i}`, c.suffix || (f.shown ? "x" : ""))}`;
    });
    return out;
  }

  renderForm(force = false) {
    const dlg = this.formDlg;
    const f = this.form;
    if (!dlg || !f || (!dlg.open && !force)) return;
    const { escape, mdi } = this.h;
    const p = this.parts();
    const bad = this.problems();
    const field = (key, body) => `<label class="hc-field"><span class="hc-label">${escape(this.t(key))}</span>${body}</label>`;
    const free = this._free();
    const caseRows = f.cases.map((c, i) => `<div class="hc-case" data-case="${i}"><span class="hc-case-ic">${mdi(CASE_ICON[c.kind], 20)}</span>
        <div class="hc-case-b"><b>${escape(this.caseLabel(c.kind))}</b>
          <input class="hc-in" type="text" data-hc="f-case" data-i="${i}" value="${escape(c.suffix)}" placeholder="/fail" autocomplete="off" spellcheck="false" maxlength="200" aria-label="${escape(this.t("hcSuffix"))}">
          <div data-hcp="case${i}">${p[`case${i}`]}</div></div>
        <div class="hc-case-act"><button type="button" class="hc-ib sm" data-hc="f-up" data-i="${i}" ${i ? "" : "disabled"} title="${escape(this.t("hcUp"))}" aria-label="${escape(this.t("hcUp"))}">${mdi("arrowUp", 16)}</button>
          <button type="button" class="hc-ib sm" data-hc="f-down" data-i="${i}" ${i < f.cases.length - 1 ? "" : "disabled"} title="${escape(this.t("hcDown"))}" aria-label="${escape(this.t("hcDown"))}">${mdi("arrowDown", 16)}</button>
          <button type="button" class="hc-ib sm bad" data-hc="f-del" data-i="${i}" title="${escape(this.t("hcRemove"))}" aria-label="${escape(this.t("hcRemove"))}">${mdi("trash", 16)}</button></div></div>`).join("");
    const pick = free.length
      ? `<div class="hc-addcase"><select class="hc-in" data-hc="f-pick" aria-label="${escape(this.t("hcCaseAdd"))}">${free.map((k) => `<option value="${k}" ${f.pick === k ? "selected" : ""}>${escape(this.caseLabel(k))}</option>`).join("")}</select>
          <button type="button" class="dlg-btn" data-hc="f-addcase">${mdi("plus", 18)}${escape(this.t("hcCaseAdd"))}</button></div>`
      : "";
    dlg.innerHTML = `<form class="hc-form" data-hc-form novalidate>
      <div class="dlg-head"><span class="dlg-avatar app app-health">${mdi("heartPulse", 28)}</span><div class="dlg-title"><h2>${escape(this.t(f.id ? "hcEditTitle" : "hcAddTitle"))}</h2></div>
        <button type="button" class="dlg-close" data-hc="f-cancel" title="${escape(this.t("close"))}" aria-label="${escape(this.t("close"))}">${mdi("close", 18)}</button></div>
      <div class="dlg-body"><p class="dlg-note">${escape(this.t("hcFormHint"))}</p>
        <div class="set-title">${escape(this.t("hcChapService"))}</div>
        ${field("hcName", `<input class="hc-in" type="text" data-hc="f-name" value="${escape(f.name)}" placeholder="${escape(this.t("hcNamePh"))}" autocomplete="off" maxlength="60" required><span data-hcp="err-name">${p["err-name"]}</span>`)}
        ${field("hcUrl", `<input class="hc-in" type="url" inputmode="url" data-hc="f-url" value="${escape(f.url)}" placeholder="https://…" autocomplete="off" spellcheck="false" maxlength="500">
          <small class="hc-t2">${escape(this.t("hcUrlHint"))}</small><span data-hcp="known">${p.known}</span><span data-hcp="err-url">${p["err-url"]}</span>`)}
        <div class="set-title">${escape(this.t("hcChapCases"))}</div>
        <p class="dlg-note">${escape(this.t("hcCasesHint"))}</p>
        <div class="hc-cases">${caseRows || `<p class="dlg-note small">${escape(this.t("hcCasesNone"))}</p>`}</div>${pick}
        <div class="set-title">${escape(this.t("hcChapInterval"))}</div>
        <div class="hc-field"><div class="hc-int"><span class="opt-input${bad.interval ? " bad" : ""}"><input type="number" min="1" max="${f.unit === "h" ? 24 : 1440}" step="1" inputmode="numeric" data-hc="f-value" value="${escape(f.value)}" aria-label="${escape(this.t("hcInterval"))}"></span>
          <select class="hc-in" data-hc="f-unit" aria-label="${escape(this.t("hcUnit"))}"><option value="min" ${f.unit === "min" ? "selected" : ""}>${escape(this.t("hcMinutes"))}</option><option value="h" ${f.unit === "h" ? "selected" : ""}>${escape(this.t("hcHours"))}</option></select></div>
          <div class="sub-tabs hc-presets" data-hcp="presets" data-set="hc-preset" role="group">${p.presets}</div>
          <small class="hc-t2">${escape(this.t("hcIntervalHint"))}</small><span data-hcp="err-interval">${p["err-interval"]}</span></div>
        <div class="dlg-error" data-hc-err ${f.error ? "" : "hidden"} aria-live="polite">${escape(f.error || "")}</div></div>
      <div class="dlg-actions"><button type="button" class="dlg-btn" data-hc="f-cancel">${mdi("close", 18)}${escape(this.t("hcCancel"))}</button><button type="submit" class="dlg-btn primary" ${f.saving ? "disabled" : ""}>${mdi("check", 18)}${escape(this.t("hcSave"))}</button></div></form>`;
    this.host._initSeg(dlg);
  }

  // Nur Hinweise, Vorschau und Fehler neu zeichnen, nie das Feld, in dem getippt wird (Cursor und Fokus bleiben)
  refreshForm() {
    const dlg = this.formDlg;
    const f = this.form;
    if (!dlg || !f) return;
    const p = this.parts();
    for (const [key, html] of Object.entries(p)) {
      const el = dlg.querySelector(`[data-hcp="${key}"]`);
      if (el && el.innerHTML !== html) el.innerHTML = html;
    }
    if (dlg.querySelector('[data-hcp="presets"]')) this.host._initSeg(dlg);
    const active = this.host.shadowRoot.activeElement;
    f.cases.forEach((c, i) => {
      const input = dlg.querySelector(`[data-hc="f-case"][data-i="${i}"]`);
      if (input && input !== active && input.value !== c.suffix) input.value = c.suffix;
    });
    const value = dlg.querySelector('[data-hc="f-value"]');
    if (value) {
      value.max = f.unit === "h" ? "24" : "1440";
      if (value !== active && String(value.value) !== String(f.value)) value.value = f.value;
      value.closest(".opt-input")?.classList.toggle("bad", Boolean(this.problems().interval));
    }
    const unit = dlg.querySelector('[data-hc="f-unit"]');
    if (unit && unit.value !== f.unit) unit.value = f.unit;
    const err = dlg.querySelector("[data-hc-err]");
    if (err) {
      err.textContent = f.error || "";
      err.hidden = !f.error;
    }
  }

  async submit() {
    const f = this.form;
    if (!f || f.saving) return;
    f.shown = true;
    if (Object.keys(this.problems()).length) {
      this.refreshForm();
      return;
    }
    f.saving = true;
    f.error = "";
    this.renderForm();
    try {
      const res = await this.host._hass.callWS({
        type: "device_panel/healthcheck_save", ...(f.id ? { check_id: f.id } : {}), name: String(f.name).trim(), url: f.url.trim(), interval: this.seconds(),
        cases: f.cases.map((c) => ({ kind: c.kind, suffix: String(c.suffix).trim() })),
      });
      this._apply(res);
      this.closeForm();
      this.host._toast(this.t("hcSaved"));
      this._changed();
      this.host._hl?.afterSave?.(res.id);
    } catch (err) {
      f.saving = false;
      const known = { invalid_name: "hcErrName", invalid_url: "hcErrUrl", invalid_suffix: "hcErrSuffix", too_many: "hcErrTooMany" }[err?.code];
      f.error = known ? this.t(known) : this.t("hcSaveFailed", this.h.errText(err));
      this.renderForm();
    }
  }

  remove(id) {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    this.host._askConfirm({ title: "hcDeleteTitle", note: "hcDeleteText", no: "hcCancel", yes: "hcRemove", noIcon: "close", yesIcon: "trash", args: [item.name || item.url] }, async () => {
      try {
        this._apply(await this.host._hass.callWS({ type: "device_panel/healthcheck_delete", check_id: id }));
        this.host._hl?.afterRemove?.(id);
      } catch (err) {
        this.host._toast(this.t("hcError", this.h.errText(err)));
      }
      this._changed();
    });
  }

  // Testknöpfe: genau "OK" oder der Fall an den Dienst; das Ergebnis steht in der Zeile und kurz als Hinweis. Liefert das Versprechen, damit das Protokoll danach nachlädt.
  async test(id, kind) {
    const key = `${id}|${kind}`;
    if (this.busy.has(key)) return null;
    this.busy.add(key);
    this.renderList();
    this.host._hl?.refresh?.();
    try {
      const res = await this.host._hass.callWS({ type: "device_panel/healthcheck_ping", check_id: id, kind });
      this._apply(res);
      this.host._toast(this.statusText(res.status));
    } catch (err) {
      this.host._toast(this.t("hcError", this.h.errText(err)));
    } finally {
      this.busy.delete(key);
      this._changed();
    }
    return true;
  }

  // ----- Ereignisse -----

  bind(listDlg, formDlg) {
    const outside = (dlg, ev, close) => {
      if (ev.target !== dlg) return false;
      const r = dlg.getBoundingClientRect();
      if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) close();
      return true;
    };
    listDlg.addEventListener("click", (ev) => {
      if (outside(listDlg, ev, () => this.closeList())) return;
      const el = ev.target.closest("[data-hc]");
      if (el && !el.disabled) this.onClick(el);
    });
    listDlg.addEventListener("input", (ev) => this.onInput(ev.target));
    listDlg.addEventListener("change", (ev) => this.onInput(ev.target));
    formDlg.addEventListener("click", (ev) => {
      if (outside(formDlg, ev, () => this.closeForm())) return;
      const el = ev.target.closest("[data-hc]");
      if (el && !el.disabled) this.onClick(el);
    });
    formDlg.addEventListener("input", (ev) => this.onInput(ev.target));
    formDlg.addEventListener("change", (ev) => this.onInput(ev.target));
    formDlg.addEventListener("submit", (ev) => {
      ev.preventDefault();
      this.submit();
    });
    formDlg.addEventListener("close", () => {
      this.form = null;
    });
  }

  onClick(el) {
    const act = el?.dataset.hc;
    if (!act) return false;
    const f = this.form;
    // "Was sind HealthCheck-Dienste?": der Browser klappt auf oder zu, hier nur merken (der Klick kommt vor dem Umschalten)
    if (act === "about") {
      this.aboutOpen = !el.closest("details")?.open;
    } else if (act === "close") this.closeList();
    else if (act === "add") this.openForm();
    else if (act === "edit") this.openForm(el.dataset.id);
    else if (act === "delete") this.remove(el.dataset.id);
    else if (act === "log") this.host._hl?.open(el.dataset.id);
    else if (act === "test") {
      const id = el.dataset.id;
      this.test(id, el.dataset.kind).then((ran) => ran && this.host._hl?.afterTest?.(id));
    } else if (act === "sort-dir") {
      this.sort = { ...this.sort, dir: this.sort.dir === "asc" ? "desc" : "asc" };
      this.renderList();
    } else if (act === "f-cancel") this.closeForm();
    else if (f && act === "f-preset") {
      const sec = Number(el.dataset.sec);
      if (Number.isInteger(sec)) {
        const hours = sec % 3600 === 0;
        f.unit = hours ? "h" : "min";
        f.value = hours ? sec / 3600 : sec / 60;
        this.refreshForm();
      }
    } else if (f && act === "f-addcase") {
      const kind = f.pick || this._free()[0];
      if (kind) {
        const sug = suggest(f.url)?.suffix(kind) || "";
        f.cases.push({ kind, suffix: sug, touched: false });
        f.pick = this._free()[0] || "";
        this.renderForm();
        this.formDlg.querySelector(`[data-hc="f-case"][data-i="${f.cases.length - 1}"]`)?.focus();
      }
    } else if (f && ["f-up", "f-down", "f-del"].includes(act)) {
      const i = Number(el.dataset.i);
      const j = act === "f-up" ? i - 1 : act === "f-down" ? i + 1 : -1;
      if (act === "f-del") f.cases.splice(i, 1);
      else if (j >= 0 && j < f.cases.length) [f.cases[i], f.cases[j]] = [f.cases[j], f.cases[i]];
      f.pick = this._free().includes(f.pick) ? f.pick : this._free()[0] || "";
      this.renderForm();
    } else if (f && act === "f-take") {
      const c = f.cases[Number(el.dataset.i)];
      const sug = c && suggest(f.url)?.suffix(c.kind);
      if (sug) {
        c.suffix = sug;
        c.touched = true;
        this.refreshForm();
      }
    } else if (act === "search" || act.startsWith("f-")) {
      // Felder: Eingaben kommen über onInput
    } else return false;
    return true;
  }

  onInput(el) {
    const act = el?.dataset?.hc;
    if (!act) return false;
    if (act === "search") {
      this.q = el.value;
      this.renderList();
      return true;
    }
    if (act === "sort") {
      const key = el.value;
      this.sort = { key, dir: key === "last" ? "desc" : "asc" };
      this.renderList();
      return true;
    }
    const f = this.form;
    if (!f) return true;
    if (act === "f-name") f.name = el.value;
    else if (act === "f-url") {
      f.url = el.value;
      // Vorschlag nur, solange niemand den Zusatz berührt hat: der Nutzer hat das letzte Wort
      const known = suggest(f.url);
      for (const c of f.cases) if (!c.touched) c.suffix = known ? known.suffix(c.kind) : "";
    } else if (act === "f-case") {
      const c = f.cases[Number(el.dataset.i)];
      if (c) {
        c.suffix = el.value;
        c.touched = true;
      }
    } else if (act === "f-pick") f.pick = el.value;
    else if (act === "f-value") f.value = el.value.trim() === "" ? "" : Number(el.value);
    else if (act === "f-unit") {
      // Umrechnen, wo es aufgeht (90 min -> 1,5 h geht nicht: dann bleibt die Zahl, und die Prüfung meldet die Grenzen)
      const sec = this.seconds();
      f.unit = el.value;
      if (Number.isFinite(sec) && (el.value === "min" || sec % 3600 === 0)) f.value = el.value === "h" ? sec / 3600 : sec / 60;
    } else return true;
    f.error = "";
    this.refreshForm();
    return true;
  }
}
