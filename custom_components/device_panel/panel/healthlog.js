/**
 * Protokoll der HealthCheck-Dienste (seit 2.236.0, Wunsch des Nutzers; Vorbild: Alarmageddon 1.68.0 bis 1.74.1, dort "so, als würde ich auf ein Gerät gehen"): öffnet sich über den
 * runden Knopf "Protokoll" je Zeile der Dienste. Kopf mit dem Namen als Auswahl zum Wechseln des Dienstes, Zustand und den runden Testknöpfen (je Fall,
 * "OK") samt Stift; drei Reiter (Verlauf, Antwortzeit, Dienst); Zeitraum, Kennzahlen, Grafik, Legende; darunter die Liste ("Ereignisse", "Alle Aufrufe") mit
 * Suche und Sortierung. Grafik je Zeitraum: bis 1 Tag "Herzschlag" (je Abschnitt ein Balken: Höhe die Antwortzeit, Farbe das Ergebnis; darunter ein Band), 7 Tage
 * eine Zeitleiste je Tag, 30 Tage ein Raster (Zeile je Tag, Zelle je Stunde), 6 Monate und 1 Jahr ein Raster Monat × Tag. Kachel "Antwortzeit": Linie mit Fläche, Zonen
 * schnell, langsam, sehr langsam, gestrichelte rote Marke bei jedem gescheiterten Aufruf. Die Daten kommen ausgewertet vom Server (healthcheck_log.py); hier wird
 * nur gezeichnet. Ladeanzeige nach der Regel für Grafiken: der Reiter wechselt sofort, die alte Grafik bleibt gedimmt, die Punkte stehen darüber; überholte Antworten
 * werden verworfen, geholte Zeiträume 30 Sekunden behalten. Die URL steht ganz im Reiter "Dienst" (Ausnahme vom Geheimnis-Grundsatz); das Protokoll kennt sie nicht.
 */
import { applySuffix, suggest } from "./healthcheck.js";

const RANGES = [3, 12, 24, 168, 720, 4320, 8760];
const RANGE_LABEL = { 3: "hlR3h", 12: "hlR12h", 24: "hlR1d", 168: "hlR7d", 720: "hlR30d", 4320: "hlR6m", 8760: "hlR1y" };
const TABS = ["history", "latency", "service"];
const RANK = { ok: 0, test: 1, report: 2, fail: 3 };
const HOUR = 3600000;
const SORT_DEFAULT = { events: { key: "time", dir: "desc" }, calls: { key: "time", dir: "desc" } };
// Geholte Zeiträume kurz behalten (Regel "Ladeanzeige bei Grafiken"): ein Wechsel zurück zeigt sofort, was eben noch da war
const CACHE_MS = 30000;
// Zonen der Antwortzeit: schnell bis 300 ms, sehr langsam ab 1 s
const FAST = 300;
const SLOW = 1000;
const ms = (iso) => new Date(iso).getTime();
const cmp = (a, b) => (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true }));

export class HealthLogUi {
  constructor(host, deps) {
    this.host = host;
    this.h = deps;
    this.id = null;
    this.tab = "history";
    this.range = 24;
    this.menu = false;
    this.cache = new Map();
    this.data = null;
    this.error = "";
    this.loading = false;
    this.seq = 0;
    this.resetList();
  }

  resetList() {
    this.pane = "events";
    this.lq = { events: "", calls: "" };
    this.lsort = { events: { ...SORT_DEFAULT.events }, calls: { ...SORT_DEFAULT.calls } };
  }

  _t(key, vars) {
    return this.host._t(key, vars);
  }

  get dlg() {
    return this.host.shadowRoot.querySelector("dialog.hl-dlg");
  }

  get items() {
    return this.host._hc?.items || [];
  }

  get narrow() {
    return Boolean(this.host._narrowQuery?.matches);
  }

  item(id = this.id) {
    return this.items.find((i) => i.id === id) || null;
  }

  _locale() {
    return this.host._hass?.locale?.language || this.host._lang;
  }

  // ----- Öffnen, Laden -----

  open(id) {
    const dlg = this.dlg;
    if (!dlg) return;
    if (id !== this.id) {
      this.resetList();
      this.data = null;
    }
    this.id = id;
    this.tab = "history";
    this.menu = false;
    this.error = "";
    const cached = this._cached();
    if (cached) this.data = cached;
    this.render();
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    this.host._blurOnTouch();
    this.load();
  }

  close() {
    const dlg = this.dlg;
    if (dlg?.open) {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }
  }

  _cached(hours = this.range) {
    const hit = this.cache.get(`${this.id}|${hours}`);
    return hit && Date.now() - hit.at < CACHE_MS ? hit.data : null;
  }

  async load(force = true) {
    if (!this.id) return;
    const cached = force ? null : this._cached();
    if (cached) {
      this.data = cached;
      this.error = "";
      this.render();
      return;
    }
    const seq = ++this.seq;
    this.loading = true;
    this.error = "";
    this.render();
    try {
      const res = await this.host._hass.callWS({ type: "device_panel/healthcheck_history", check_id: this.id, hours: this.range });
      if (seq !== this.seq) return;
      this.data = res;
      this.cache.set(`${this.id}|${this.range}`, { at: Date.now(), data: res });
    } catch (err) {
      if (seq !== this.seq) return;
      this.data = null;
      this.error = this.h.errText(err);
    }
    this.loading = false;
    this.render();
  }

  // Die Liste der Dienste hat sich geändert (Test, Speichern): Kopf und Knöpfe nachführen
  refresh() {
    if (this.dlg?.open && this.id) this.render();
  }

  // Nach dem Speichern im Formular: Name, Adresse oder Intervall können anders sein, die Lücken hängen am Intervall
  afterSave(id) {
    if (!this.dlg?.open || id !== this.id) return;
    this.cache.clear();
    this.load();
  }

  // Ein entfernter Dienst hat kein Protokoll mehr (der Server löscht es mit)
  afterRemove(id) {
    for (const key of [...this.cache.keys()]) if (key.startsWith(`${id}|`)) this.cache.delete(key);
    if (this.dlg?.open && id === this.id) this.close();
  }

  // Nach einem Test: der Aufruf steht im Protokoll als Test
  afterTest(id) {
    if (this.dlg?.open && this.id === id) {
      this.cache.clear();
      this.load(true);
    }
  }

  // ----- Ereignisse -----

  bind(dlg) {
    dlg.addEventListener("close", () => {
      this.seq++;
      this.id = null;
      this.menu = false;
    });
    dlg.addEventListener("click", (ev) => {
      if (ev.target === dlg) {
        const r = dlg.getBoundingClientRect();
        if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) this.close();
        return;
      }
      const el = ev.target.closest("[data-hl]");
      if (!el) {
        if (this.menu) this.setMenu(false);
        return;
      }
      if (el.disabled) return;
      this.onClick(el);
    });
    dlg.addEventListener("input", (ev) => {
      const el = ev.target;
      if (el.dataset?.hl !== "lq") return;
      this.lq[this.pane] = el.value;
      this._renderRows();
    });
  }

  // Auswahl im Kopf: auf und zu nur im Fenster umschalten, ohne neu zu zeichnen
  setMenu(open) {
    this.menu = open;
    const menu = this.dlg?.querySelector(".hl-menu");
    if (menu) menu.hidden = !open;
    this.dlg?.querySelector('[data-hl="menu"]')?.setAttribute("aria-expanded", String(open));
  }

  onClick(el) {
    const act = el.dataset.hl;
    if (act === "menu") {
      this.setMenu(!this.menu);
      return;
    }
    if (this.menu) this.setMenu(false);
    if (act === "close") this.close();
    else if (act === "pick") {
      if (el.dataset.id !== this.id) this.open(el.dataset.id);
    } else if (act === "tab") {
      if (el.dataset.tab === this.tab) return;
      this.tab = el.dataset.tab;
      this.render();
    } else if (act === "range") {
      const hours = Number(el.dataset.hours);
      if (hours === this.range && this.data?.hours === hours) return;
      this.range = hours;
      this.load(false);
    } else if (act === "pane") {
      this.pane = el.dataset.pane;
      this.render();
    } else if (act === "lsort") {
      const cur = this.lsort[this.pane];
      const key = el.dataset.key;
      this.lsort[this.pane] = { key, dir: cur.key === key ? (cur.dir === "asc" ? "desc" : "asc") : key === "time" ? "desc" : "asc" };
      this._renderRows();
    } else if (act === "edit") this.host._hc.openForm(this.id);
    else if (act === "test") {
      const id = this.id;
      this.host._hc.test(id, el.dataset.kind).then((ran) => ran && this.afterTest(id));
    } else if (act === "retry") this.load();
    else if (act === "copy") {
      const value = el.dataset.value || "";
      Promise.resolve(navigator.clipboard?.writeText(value)).then(() => this.host._toast(this._t("hlCopied")), () => {});
    }
  }

  // ----- Formate -----

  _ms(v) {
    if (v === null || v === undefined || !Number.isFinite(Number(v))) return "–";
    return v >= 1000 ? `${(v / 1000).toLocaleString(this._locale(), { maximumFractionDigits: 1 })} s` : `${Math.round(v)} ms`;
  }

  _num(v) {
    return Number.isFinite(Number(v)) ? Number(v).toLocaleString(this._locale()) : "–";
  }

  _clock(iso) {
    return new Date(iso).toLocaleTimeString(this._locale(), { hour: "2-digit", minute: "2-digit" });
  }

  _clockSec(iso) {
    return new Date(iso).toLocaleTimeString(this._locale(), { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  _dayLabel(date) {
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return this._t("hlToday");
    if (date.toDateString() === new Date(now.getTime() - 86400000).toDateString()) return this._t("hlYesterday");
    return date.toLocaleDateString(this._locale(), { weekday: "long", day: "numeric", month: "long" });
  }

  _shortDay(date) {
    return date.toLocaleDateString(this._locale(), { weekday: "short", day: "numeric" });
  }

  _host(item) {
    try {
      return new URL(item.url).hostname;
    } catch {
      return "";
    }
  }

  // Zustand eines Dienstes: aus dem Protokoll (seit wann), sonst aus dem letzten Aufruf (gleich nach dem Anlegen gibt es noch kein Protokoll)
  _state(item) {
    const live = this.data?.id === item.id ? this.data.state : null;
    if (live?.state) return live;
    if (item.log?.state) return item.log;
    const s = item.status;
    if (s) return { state: s.result !== "ok" ? "fail" : s.sent !== "ok" && !s.test ? "report" : "ok", since: null };
    return { state: null, since: null };
  }

  _stateText(s) {
    const text = this._t({ ok: "hlStOk", report: "hlStReport", fail: "hlStFail" }[s.state] || "hlStNone");
    return s.since ? `${text} ${this._t("hlSince", { time: this.host._fmtTime(ms(s.since) / 1000, true) })}` : text;
  }

  _result(e) {
    if (e.result === "timeout") return this._t("hcStTimeout");
    if (e.result === "error") return this._t("hcStError");
    return e.code === null || e.code === undefined ? "–" : `HTTP ${e.code}`;
  }

  _caseLabel(kind) {
    return this.host._hc.caseLabel(kind);
  }

  _legend(items) {
    const { escape } = this.h;
    return `<div class="hl-legend">${items.map(([cls, label]) => `<span><i class="${cls}"></i>${escape(label)}</span>`).join("")}</div>`;
  }

  _kpis(items) {
    const { escape } = this.h;
    return `<div class="hl-kpis">${items.filter(Boolean).map(([value, label]) => `<div class="hl-kpi"><b>${escape(value)}</b><span>${escape(label)}</span></div>`).join("")}</div>`;
  }

  _svg(w, h, body, label) {
    return `<svg class="hl-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${this.h.escape(label)}">${body}</svg>`;
  }

  _txt(x, y, text, anchor = "middle", cls = "") {
    return `<text x="${x.toFixed(1)}" y="${y}" text-anchor="${anchor}" class="hl-tx ${cls}">${this.h.escape(text)}</text>`;
  }

  // ----- Rahmen -----

  render() {
    const dlg = this.dlg;
    if (!dlg || !this.id) return;
    const item = this.item();
    if (!item) {
      this.close();
      return;
    }
    const { escape, mdi } = this.h;
    const t = (k, v) => this._t(k, v);
    const state = this._state(item);
    const host = this._host(item);
    const known = suggest(item.url);
    const every = t("hlEvery", { time: this.host._fmtSeconds(item.interval, true) });
    const sub = (this.narrow ? [host, every] : [host, known?.name, every]).filter(Boolean).join(" · ");
    const d = this.data?.id === this.id ? this.data : null;
    const tabs = TABS.map((tab) => `<button type="button" class="sub-tab${tab === this.tab ? " on" : ""}" data-hl="tab" data-set="hl-tab" data-tab="${tab}" role="tab" aria-selected="${tab === this.tab}">${escape(t(`hlTab_${tab}`))}</button>`).join("");
    const menu = this.items.map((i) => {
      const s = this._state(i);
      const on = i.id === this.id;
      return `<button type="button" class="hl-mi${on ? " on" : ""}" role="option" aria-selected="${on}" data-hl="pick" data-id="${escape(i.id)}"><span class="hl-dot-s ${s.state || "none"}"></span>
        <span class="hl-mt"><b>${escape(i.name || this._host(i))}</b><small>${escape([this._host(i), this._stateText(s)].filter(Boolean).join(" · "))}</small></span>${on ? mdi("check", 20) : ""}</button>`;
    }).join("");
    const body = this.tab === "service" ? this._serviceHtml(item, d, state) : this._chartHtml();
    dlg.innerHTML = `<div class="dlg-head hl-head"><span class="dlg-avatar app app-health">${mdi("heartPulse", 28)}</span>
        <div class="dlg-title"><button type="button" class="hl-pick" data-hl="menu" aria-haspopup="listbox" aria-expanded="${this.menu}" title="${escape(t("hlSwitch"))}"><b>${escape(item.name || host)}</b>${mdi("chevronDown", 18)}</button>
          <div class="dlg-sub">${escape(sub)}</div><span class="hl-pill ${state.state || "none"}">${escape(this._stateText({ state: state.state }))}</span></div>
        ${this._actsHtml(item)}
        <button type="button" class="dlg-close" data-hl="close" title="${escape(t("close"))}" aria-label="${escape(t("close"))}">${mdi("close", 18)}</button>
        <div class="hl-menu" role="listbox" aria-label="${escape(t("hlSwitch"))}" ${this.menu ? "" : "hidden"}>${menu}</div></div>
      <div class="dlg-body hl" data-tab="${this.tab}"><div class="sub-tabs hl-tabs" data-set="hl-tab" role="tablist">${tabs}</div>${body.fix}<div class="hl-list">${body.list}</div></div>
      <div class="dlg-actions"><button type="button" class="dlg-btn" data-hl="close">${mdi("close", 18)}${escape(t("close"))}</button></div>`;
    this.host._initSeg(dlg);
  }

  // Oben rechts: je Fall der runde Testknopf, "OK senden" und der Stift, dieselben runden Knöpfe wie in der Liste der Dienste
  _actsHtml(item) {
    const { escape, mdi } = this.h;
    const hc = this.host._hc;
    const busy = (kind) => hc.busy.has(`${item.id}|${kind}`);
    const btn = (act, icon, label, extra = "", cls = "") => `<button type="button" class="hc-ib${cls ? ` ${cls}` : ""}" data-hl="${act}" ${extra} title="${escape(label)}" aria-label="${escape(label)}">${mdi(icon, 18)}</button>`;
    const icons = { offline: "signalOff", battery: "battery", backup: "save" };
    const tests = (item.cases || []).map((c) => btn("test", icons[c.kind], this._t("hcTestCase", this.host._hc.caseLabel(c.kind)), `data-kind="${escape(c.kind)}" ${busy(c.kind) ? "disabled" : ""}`, "warn")).join("");
    return `<div class="hl-acts">${tests}${btn("test", "check", this._t("hcTestOk"), `data-kind="ok" ${busy("ok") ? "disabled" : ""}`, "good")}${btn("edit", "pencil", this._t("hcEdit"))}</div>`;
  }

  _rangeSeg() {
    const { escape } = this.h;
    return `<div class="sub-tabs hl-range" data-set="hl-range" role="group">${RANGES.map((h) => `<button type="button" data-hl="range" data-set="hl-range" data-hours="${h}" class="sub-tab${h === this.range ? " on" : ""}" aria-pressed="${h === this.range}">${escape(this._t(RANGE_LABEL[h]))}</button>`).join("")}</div>`;
  }

  // Verlauf und Antwortzeit: Zeitraum, Kennzahlen, Grafik, Legende; darunter die Liste. Mit alten Daten bleibt alles gedimmt stehen und die Ladeanzeige liegt
  // über der Grafik; beim ersten Laden steht sie allein in der Mitte (Regel "Ladeanzeige bei Grafiken").
  _chartHtml() {
    const { escape } = this.h;
    const seg = this._rangeSeg();
    const color = this.tab === "latency" ? "var(--dp-primary)" : "var(--dp-success)";
    if (this.error) return { fix: `${seg}<div class="dlg-error">${escape(this._t("hlLoadError"))} ${escape(this.error)} <button type="button" class="dlg-btn" data-hl="retry">${escape(this._t("hlRetry"))}</button></div>`, list: "" };
    const d = this.data;
    if (!d || d.id !== this.id) return { fix: `${seg}<div class="pl-ldwrap empty">${this.host._loaderHtml(color)}</div>`, list: "" };
    const busy = d.hours !== this.range;
    const s = d.summary;
    const W = this.narrow ? 358 : 832;
    const wide = !this.narrow;
    const t = (k, v) => this._t(k, v);
    let kpis;
    let chart;
    let legend;
    if (this.tab === "latency") {
      kpis = [[this._ms(d.last?.ms), t("hlKLast")], [this._ms(s.ms_mean), t("hlKMeanLat")], [this._ms(s.ms_max), t("hlKSlowest")], wide && [this._num(s.no_answer), t("hlKNoAnswer")]];
      chart = this._latency(d, W);
      legend = this._legend([["hl-i failmark", t(d.hours > 720 ? "hlLegFailDay" : "hlLegFailMark")]]);
    } else {
      const daily = d.hours > 720;
      kpis = [[s.rate === null || s.rate === undefined ? "–" : `${s.rate.toLocaleString(this._locale(), { maximumFractionDigits: daily ? 2 : 1 })} %`, t("hlKRate")], [this._num(s.total), t("hlKCalls")],
        [this._num(s.fail), t("hlKFail")], wide && [this._num(s.report), t("hlKReport")], wide && [this._ms(s.ms_mean), t("hlKMean")]];
      chart = d.hours <= 24 ? this._heartbeat(d, W) : d.hours <= 168 ? this._timeline(d, W) : daily ? this._monthRaster(d, W) : this._raster(d, W);
      legend = daily
        ? this._legend([["hl-i ok", t(wide ? "hlLegDayOk" : "hlLegOkShort")], ["hl-i report", t("hlLegReport")], ["hl-i fail", t("hlLegFail")], ["hl-i gap", wide ? t("hlLegGapDay", { n: d.gap_day ?? 30 }) : t("hlLegGapShort")], ["hl-i test dot", t("hlLegTest")]])
        : this._legend([["hl-i ok", t(wide ? "hlLegOk" : "hlLegOkShort")], ["hl-i report", t("hlLegReport")], ["hl-i fail", t("hlLegFail")], ["hl-i test", t("hlLegTest")], ["hl-i gap", t(wide ? "hlLegGap" : "hlLegGapShort")]]);
    }
    if (!d.since) chart = `<p class="dlg-note">${escape(t("hlNoData"))}</p>`;
    const chartHtml = busy ? `<div class="pl-ldwrap">${chart}${this.host._loaderHtml(color, true)}</div>` : chart;
    return { fix: `${seg}${this._kpis(kpis)}<div class="hl-chart">${chartHtml}</div>${d.since ? legend : ""}`, list: this._listArea(this._paneSpec(d)) };
  }

  // ----- Grafiken -----

  // Die Tage des Zeitraums (lokal, ältester zuerst) mit ihrem Beginn
  _days(d) {
    const count = Math.round(d.hours / 24);
    const today = new Date(d.now);
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: count }, (_v, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - (count - 1 - i)));
  }

  // Abschnitte eines Zeitraums mit den Aufrufen darin (Herzschlag und Antwortzeit bis 1 Tag)
  _buckets(d, n) {
    const now = ms(d.now);
    const start = ms(d.start);
    const step = (now - start) / n;
    const out = Array.from({ length: n }, (_v, i) => ({ a: start + i * step, b: start + (i + 1) * step, calls: [] }));
    for (const [iso, kind, v] of d.points) {
      const i = Math.min(n - 1, Math.max(0, Math.floor((ms(iso) - start) / step)));
      out[i].calls.push({ kind, ms: v });
    }
    return out;
  }

  _gaps(d) {
    return (d.gaps || []).map(([a, b]) => [ms(a), ms(b)]);
  }

  _inGap(gaps, a, b, min = 0) {
    return gaps.some(([ga, gb]) => Math.min(b, gb) - Math.max(a, ga) > min);
  }

  // Schöne Höchstwerte der Achse in Millisekunden (mindestens `floor`)
  _msScale(values, floor) {
    const top = Math.max(floor, ...values.filter(Number.isFinite));
    if (top <= floor) return floor;
    const step = top <= 3000 ? 300 : top <= 6000 ? 1000 : 2000;
    return Math.ceil(top / step) * step;
  }

  // Bis 1 Tag: "Herzschlag". Je Abschnitt ein Balken in der Farbe des schlechtesten Ergebnisses, die Höhe ist die mittlere Antwortzeit (gescheitert:
  // ganz hoch); darunter ein Band mit dem Ergebnis je Abschnitt, Fehler, gemeldete Fehler und Tests als breitere Marke (ein einzelner Aufruf fällt auf).
  // Lücken ohne Daten grau. Am Computer 5 Minuten je Abschnitt, auf dem Handy breiter.
  _heartbeat(d, W) {
    const narrow = W < 500;
    const H = narrow ? 150 : 184;
    const L = 50;
    const R = W - 6;
    const top = 12;
    const laneH = 9;
    const bottom = H - 24 - laneH - 6;
    const lane = bottom + 6;
    const now = ms(d.now);
    const start = ms(d.start);
    const n = narrow ? (d.hours <= 3 ? 36 : d.hours <= 12 ? 72 : 96) : d.hours * 12;
    const bw = (R - L) / n;
    const gaps = this._gaps(d);
    const buckets = this._buckets(d, n).map((b) => {
      const worst = b.calls.reduce((m, c) => (RANK[c.kind] > RANK[m] ? c.kind : m), "ok");
      const times = b.calls.filter((c) => c.kind !== "fail" && Number.isFinite(c.ms)).map((c) => c.ms);
      return { ...b, worst, mean: times.length ? times.reduce((x, y) => x + y, 0) / times.length : null };
    });
    const max = this._msScale(buckets.map((b) => b.mean), 600);
    const y = (v) => bottom - (Math.min(max, v) / max) * (bottom - top);
    let s = "";
    for (const g of [0, max / 2, max]) s += `<line class="hl-grid" x1="${L}" y1="${y(g).toFixed(1)}" x2="${R}" y2="${y(g).toFixed(1)}"/>${this._txt(L - 6, y(g) + 4, g ? this._ms(g) : "0", "end")}`;
    s += `<rect class="hl-track" x="${L}" y="${lane}" width="${R - L}" height="${laneH}" rx="2"/>`;
    // Das Band zeigt den Zustand ohne Unterbruch: zwischen zwei Aufrufen gilt der letzte (gescheitert bleibt rot bis zum nächsten, der ankommt; ein
    // Test ändert nichts). Vor dem ersten Aufruf des Protokolls und in Lücken nicht.
    const since = d.since ? ms(d.since) : Infinity;
    let carried = null;
    buckets.forEach((b, i) => {
      const x = L + i * bw + (bw > 3 ? 0.6 : 0.25);
      const w = Math.max(0.8, bw - (bw > 3 ? 1.2 : 0.5));
      const laneAt = (cls) => `<rect class="hl-lane ${cls}" x="${(L + i * bw).toFixed(2)}" y="${lane}" width="${(bw + 0.3).toFixed(2)}" height="${laneH}"/>`;
      for (const c of b.calls) if (c.kind !== "test") carried = c.kind;
      if (!b.calls.length) {
        if (this._inGap(gaps, b.a, b.b)) {
          s += `<rect class="hl-gap" x="${x.toFixed(1)}" y="${top}" width="${w.toFixed(2)}" height="${bottom - top}" rx="1"/>${laneAt("gap")}`;
          carried = null;
        } else if (carried && b.a >= since) s += laneAt(carried);
        return;
      }
      const yy = Math.min(b.worst === "fail" ? y(max) : y(b.mean ?? 0), bottom - 6);
      s += `<rect class="hl-b ${b.worst}" data-kind="${b.worst}" x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${w.toFixed(2)}" height="${(bottom - yy).toFixed(1)}" rx="${bw > 3 ? 1.2 : 0.4}"/>`;
      s += laneAt(b.worst);
    });
    for (const [iso, kind] of d.points) {
      if (kind === "ok") continue;
      const cx = L + ((ms(iso) - start) / (now - start)) * (R - L);
      s += `<rect class="hl-lane ${kind} mark" x="${(cx - 2).toFixed(1)}" y="${lane - 2}" width="4" height="${laneH + 4}" rx="2"/>`;
    }
    for (const [tt, anchor, x] of [[start, "start", L], [(start + now) / 2, "middle", (L + R) / 2], [now, "end", R]]) s += this._txt(x, H - 6, this._clock(tt), anchor);
    return this._svg(W, H, s, this._t("hlChartBeat"));
  }

  // Grüne Strecken eines Abschnitts: vom Beginn des Protokolls bis jetzt, ohne die Lücken
  _okSpans(d, a, b) {
    const from = Math.max(a, ms(d.since));
    const to = Math.min(b, ms(d.now));
    if (to <= from) return [];
    const out = [];
    let cur = from;
    for (const [ga, gb] of this._gaps(d).filter(([ga, gb]) => gb > from && ga < to).sort((p, q) => p[0] - q[0])) {
      if (ga > cur) out.push([cur, ga]);
      cur = Math.max(cur, gb);
    }
    if (to > cur) out.push([cur, to]);
    return out;
  }

  // Der Tag eines Zeitpunkts als Zeile (Tage über den Kalender, nicht über 24 Stunden: ein Tag der Zeitumstellung hat 23 oder 25)
  _dayIndex(days) {
    const index = new Map(days.map((day, i) => [day.toDateString(), i]));
    return (time) => index.get(new Date(time).toDateString());
  }

  // 7 Tage: Zeitleiste je Tag wie Türen und Fenster. Grün, solange Lebenszeichen ankommen, grau eine Lücke ohne Daten, Marken für gescheitert, Fehler
  // gemeldet und Test (aus den Ereignissen, auf die Minute genau; einzelne Aufrufe gibt es nach 24 Stunden nicht mehr)
  _timeline(d, W) {
    const narrow = W < 500;
    const days = this._days(d);
    const L = narrow ? 52 : 70;
    const R = W - 6;
    const rowH = 16;
    const gap = 9;
    const top = 6;
    const H = top + days.length * (rowH + gap) + 18;
    const gaps = this._gaps(d);
    let s = "";
    days.forEach((day, r) => {
      const a = day.getTime();
      const b = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
      const y = top + r * (rowH + gap);
      // Die Zeile zeigt 0 bis 24 Uhr; an einem Tag mit 25 Stunden endet ein Balken am rechten Rand
      const x = (tt) => Math.min(R, L + ((tt - a) / (24 * HOUR)) * (R - L));
      s += this._txt(L - 8, y + 12, this._shortDay(day), "end", r === days.length - 1 ? "now" : "");
      s += `<rect class="hl-track" x="${L}" y="${y}" width="${R - L}" height="${rowH}" rx="4"/>`;
      for (const [sa, sb] of this._okSpans(d, a, b)) s += `<rect class="hl-band ok" x="${x(sa).toFixed(1)}" y="${y}" width="${Math.max(0.5, x(sb) - x(sa)).toFixed(1)}" height="${rowH}" rx="3"/>`;
      for (const [ga, gb] of gaps) {
        const ca = Math.max(a, ga);
        const cb = Math.min(b, gb);
        if (cb > ca) s += `<rect class="hl-band gap" x="${x(ca).toFixed(1)}" y="${y}" width="${Math.max(2, x(cb) - x(ca)).toFixed(1)}" height="${rowH}" rx="3"/>`;
      }
      for (const [ta, tb, kind] of d.marks || []) {
        const ma = Math.max(a, ms(ta));
        const mb = Math.min(b, tb ? ms(tb) : ms(ta));
        if (ms(ta) >= b || (tb ? ms(tb) : ms(ta)) < a) continue;
        s += `<rect class="hl-b ${kind}" data-kind="${kind}" x="${x(ma).toFixed(1)}" y="${y - 2}" width="${Math.max(3, x(mb) - x(ma)).toFixed(1)}" height="${rowH + 4}" rx="1.5"/>`;
      }
    });
    const xh = (h) => L + (h / 24) * (R - L);
    for (const h of narrow ? [0, 6, 12, 18, 24] : [0, 3, 6, 9, 12, 15, 18, 21, 24]) s += this._txt(xh(h), H - 4, `${String(h).padStart(2, "0")}:00`, h === 0 ? "start" : h === 24 ? "end" : "middle");
    return this._svg(W, H, s, this._t("hlChartDays"));
  }

  // 30 Tage: Raster wie bei Bewegung (Entscheid des Nutzers, "Vorschlag 1"). Eine Zeile je Tag, eine Zelle je Stunde in der Farbe des schlechtesten
  // Ergebnisses dieser Stunde; ruhige Stunden blass grün, eine Stunde mit mehr als einer halben Stunde Lücke grau, vor dem Protokoll und die Zukunft leer
  _raster(d, W) {
    const days = this._days(d);
    const L = 50;
    const R = W - 4;
    const top = 4;
    const cw = (R - L) / 24;
    const ch = W > 500 ? 6.2 : 5.6;
    const gap = 1.3;
    const now = ms(d.now);
    const since = ms(d.since);
    const gaps = this._gaps(d);
    const dayOf = this._dayIndex(days);
    // Stundenwerte des Servers in die Zelle ihrer Mitte (so passen sie auch in Zeitzonen mit halben Stunden)
    const cells = new Map();
    for (const [iso, ok, report, fail, test] of d.hourly) {
      const mid = new Date(ms(iso) + HOUR / 2);
      const i = dayOf(mid.getTime());
      if (i === undefined) continue;
      const key = `${i}|${mid.getHours()}`;
      const c = cells.get(key) || { ok: 0, report: 0, fail: 0, test: 0 };
      cells.set(key, { ok: c.ok + ok, report: c.report + report, fail: c.fail + fail, test: c.test + test });
    }
    let s = "";
    days.forEach((day, i) => {
      const y = top + i * (ch + gap);
      for (let h = 0; h < 24; h++) {
        const a = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h).getTime();
        const b = a + HOUR;
        const x = (L + h * cw + 0.8).toFixed(1);
        const w = (cw - 1.6).toFixed(1);
        const c = cells.get(`${i}|${h}`);
        const worst = c ? ["fail", "report", "test"].find((k) => c[k] > 0) : null;
        let cls = "hl-track";
        if (worst) cls = `hl-b ${worst}`;
        else if (a >= now || b <= since) cls = "hl-track";
        else if (this._inGap(gaps, a, b, HOUR / 2)) cls = "hl-cell gap";
        else cls = "hl-cell ok";
        s += `<rect class="${cls}" ${worst ? `data-kind="${worst}"` : ""} x="${x}" y="${y.toFixed(1)}" width="${w}" height="${ch}" rx="1.5"/>`;
      }
      if (i === 0 || i === days.length - 1 || i % 5 === 4) s += this._txt(L - 8, y + ch / 2 + 4, this._shortDay(day), "end", i === days.length - 1 ? "now" : "");
    });
    const base = top + days.length * (ch + gap);
    for (const h of W < 500 ? [0, 6, 12, 18, 24] : [0, 3, 6, 9, 12, 15, 18, 21, 24]) s += this._txt(L + h * cw, base + 12, `${String(h).padStart(2, "0")}:00`, h === 24 ? "end" : h === 0 ? "start" : "middle");
    return this._svg(W, base + 18, s, this._t("hlChartHours"));
  }

  // Tag als Schlüssel der Tageswerte (JJJJ-MM-TT, Ortszeit wie der Server) und seine Mitte (Mittag; ein Tag der Zeitumstellung hat 23 oder 25 Stunden)
  _dayKey(day) {
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  }

  _dayMid(day) {
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).getTime();
  }

  // Art eines Tages: gescheitert vor Fehler gemeldet vor Lücke (ab `gap_day` Minuten ohne Daten) vor in Ordnung; "none" vor dem Protokoll und in der
  // Zukunft. Ein Tag nach dem Beginn ohne einen einzigen Aufruf ist eine Lücke.
  _dayKind(d, day, row) {
    const start = day.getTime();
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
    if (!d.since || end <= ms(d.since) || start > ms(d.now)) return "none";
    if (!row) return "gap";
    if (row[3] > 0) return "fail";
    if (row[2] > 0) return "report";
    if (row[8] >= (d.gap_day ?? 30) || row[1] + row[2] + row[3] + row[4] === 0) return "gap";
    return "ok";
  }

  // 6 Monate und 1 Jahr: Raster Monat × Tag (Entscheid des Nutzers 2026-11-19, 18:35, Mockup v3 "B"), das Raster der 30 Tage eine Stufe gröber. Eine
  // Zeile je Monat, eine Zelle je Tag in der Farbe des Tages; am Computer ein Test als blauer Punkt. Tage ausserhalb des Zeitraums bleiben leer.
  _monthRaster(d, W) {
    const { escape } = this.h;
    const narrow = W < 500;
    const days = this._days(d);
    const rows = new Map(d.daily.map((row) => [row[0], row]));
    const inRange = new Set(days.map((day) => this._dayKey(day)));
    const months = [];
    for (const day of days) {
      const key = `${day.getFullYear()}-${day.getMonth()}`;
      if (!months.length || months.at(-1).key !== key) months.push({ key, year: day.getFullYear(), month: day.getMonth() });
    }
    const L = 56;
    const R = W - 4;
    const top = 4;
    const cw = (R - L) / 31;
    const ch = narrow ? 9.5 : 15;
    const gap = narrow ? 2 : 3;
    const monthName = (y, m) => new Date(y, m, 1).toLocaleDateString(this._locale(), { month: "short" }).replace(".", "");
    let s = "";
    months.forEach((m, r) => {
      const y = top + r * (ch + gap);
      const len = new Date(m.year, m.month + 1, 0).getDate();
      for (let n = 1; n <= len; n++) {
        const day = new Date(m.year, m.month, n);
        const key = this._dayKey(day);
        const x = (L + (n - 1) * cw + 0.8).toFixed(1);
        const w = (cw - 1.6).toFixed(1);
        if (!inRange.has(key)) {
          s += `<rect class="hl-track hl-out" x="${x}" y="${y.toFixed(1)}" width="${w}" height="${ch}" rx="2"/>`;
          continue;
        }
        const row = rows.get(key);
        const kind = this._dayKind(d, day, row);
        const cls = kind === "none" ? "hl-track" : kind === "ok" ? "hl-cell ok" : kind === "gap" ? "hl-cell gap" : `hl-b ${kind}`;
        s += `<rect class="${cls}" data-day="${key}" data-kind="${kind}" x="${x}" y="${y.toFixed(1)}" width="${w}" height="${ch}" rx="2"/>`;
        if (!narrow && row?.[4] > 0) s += `<circle class="hl-dot test" cx="${(L + (n - 0.5) * cw).toFixed(1)}" cy="${(y + ch / 2).toFixed(1)}" r="2.2"/>`;
      }
      const label = `${monthName(m.year, m.month)}${r === 0 || m.month === 0 ? ` ’${String(m.year).slice(2)}` : ""}`;
      s += this._txt(L - 8, y + ch / 2 + 4, label, "end", r === months.length - 1 ? "now" : "");
    });
    const base = top + months.length * (ch + gap);
    for (const n of narrow ? [1, 8, 15, 22, 29] : [1, 5, 10, 15, 20, 25, 31]) s += this._txt(L + (n - 0.5) * cw, base + 12, `${n}.`);
    // Darunter die Zahl der Tage mit Ausfall, mit Fehlermeldung und mit Lücke (und seit wann aufgezeichnet, wenn das Protokoll jünger ist)
    const count = { fail: 0, report: 0, gap: 0 };
    for (const day of days) {
      const kind = this._dayKind(d, day, rows.get(this._dayKey(day)));
      if (kind in count) count[kind]++;
    }
    const part = (kind, n) => `<span><b>${n}</b> ${escape(this._t(`hlDays_${kind}${n === 1 ? "1" : ""}`))}</span>`;
    const since = d.since && ms(d.since) > ms(d.start) ? `<span>${escape(this._t("hlRecordedSince", { date: new Date(d.since).toLocaleDateString(this._locale(), { day: "numeric", month: "short", year: "numeric" }) }))}</span>` : "";
    return `${this._svg(W, base + 18, s, this._t("hlChartMonths"))}<div class="hl-sum">${part("fail", count.fail)}${part("report", count.report)}${part("gap", count.gap)}${since}</div>`;
  }

  // Kachel "Antwortzeit" (Mockup v1, "genau so umsetzen"): Linie mit Fläche wie "Empfang", Zonen schnell, langsam, sehr langsam; je gescheitertem
  // Aufruf eine gestrichelte rote Marke. Bis 1 Tag aus den Aufrufen, darüber aus den Stundenwerten; über eine Lücke ohne Daten läuft die Linie nicht.
  _latency(d, W) {
    const { escape } = this.h;
    const H = 150;
    const L = 50;
    const R = W - 6;
    const top = 10;
    const bottom = H - 22;
    const now = ms(d.now);
    const start = ms(d.start);
    const gaps = this._gaps(d);
    const n = W > 500 ? (d.hours <= 24 ? 96 : 168) : d.hours <= 24 ? 48 : 84;
    let pts;
    let fails;
    if (d.hours <= 24) {
      pts = this._buckets(d, n).map((b) => {
        const times = b.calls.filter((c) => c.kind !== "fail" && Number.isFinite(c.ms)).map((c) => c.ms);
        return times.length ? [(b.a + b.b) / 2, times.reduce((x, y) => x + y, 0) / times.length] : null;
      }).filter(Boolean);
      fails = d.points.filter((p) => p[1] === "fail").map((p) => ms(p[0]));
    } else if (d.hours > 720) {
      // Tageswerte (6 Monate, 1 Jahr): je Abschnitt das Mittel, gewichtet mit der Zahl der Aufrufe mit Antwort (Computer 1 oder 2 Tage, Handy 2 oder
      // 7 Tage); eine Marke an jedem Tag mit gescheitertem Aufruf. Ein Abschnitt ohne Antwort unterbricht die Linie.
      const per = W > 500 ? (d.hours > 4320 ? 2 : 1) : d.hours > 4320 ? 7 : 2;
      const days = this._days(d);
      const index = new Map(days.map((day, i) => [this._dayKey(day), i]));
      const sums = new Map();
      for (const [key, ok, report, , test, avg] of d.daily) {
        const i = index.get(key);
        if (i === undefined || avg === null || avg === undefined) continue;
        const chunk = Math.floor(i / per);
        const weight = Math.max(1, ok + report + test);
        const cur = sums.get(chunk) || [0, 0];
        sums.set(chunk, [cur[0] + avg * weight, cur[1] + weight]);
      }
      const mid = (chunk) => {
        const a = days[chunk * per];
        const b = days[Math.min(days.length - 1, chunk * per + per - 1)];
        return (this._dayMid(a) + this._dayMid(b)) / 2;
      };
      pts = [...sums.entries()].sort((a, b) => a[0] - b[0]).map(([chunk, [sum, count]]) => [mid(chunk), sum / count, chunk]);
      fails = d.daily.filter((row) => row[3] > 0 && index.has(row[0])).map((row) => this._dayMid(days[index.get(row[0])]));
    } else {
      // Stundenwerte zu Abschnitten zusammenfassen (gewichtet mit der Zahl der Aufrufe mit Antwort)
      const step = (now - start) / n;
      const sums = Array.from({ length: n }, () => [0, 0]);
      for (const [iso, ok, report, , test, avg] of d.hourly) {
        if (avg === null || avg === undefined) continue;
        const i = Math.min(n - 1, Math.max(0, Math.floor((ms(iso) + HOUR / 2 - start) / step)));
        const weight = Math.max(1, ok + report + test);
        sums[i][0] += avg * weight;
        sums[i][1] += weight;
      }
      pts = sums.map(([sum, count], i) => (count ? [start + (i + 0.5) * step, sum / count] : null)).filter(Boolean);
      fails = (d.marks || []).filter((m) => m[2] === "fail").map((m) => ms(m[0]));
    }
    if (!pts.length) return `<p class="dlg-note">${escape(this._t("hlNoTimes"))}</p>`;
    const max = this._msScale(pts.map((p) => p[1]), 1200);
    const x = (tt) => L + ((tt - start) / (now - start)) * (R - L);
    const y = (v) => bottom - (Math.min(max, v) / max) * (bottom - top);
    let s = "";
    for (const [from, to, cls, label] of [[0, FAST, "ok", "hlZoneFast"], [FAST, SLOW, "warn", "hlZoneSlow"], [SLOW, max, "err", "hlZoneVerySlow"]]) {
      // Beschriftung links: rechts liegt der letzte Wert (Punkt) und oft die Marke eines gescheiterten Aufrufs
      s += `<rect class="hl-zone ${cls}" x="${L}" y="${y(to).toFixed(1)}" width="${R - L}" height="${(y(from) - y(to)).toFixed(1)}"/>${this._txt(L + 6, y(to) + 13, this._t(label), "start", cls)}`;
    }
    for (const g of [0, max / 2, max]) s += `<line class="hl-grid" x1="${L}" y1="${y(g).toFixed(1)}" x2="${R}" y2="${y(g).toFixed(1)}"/>${this._txt(L - 6, y(g) + 4, g ? this._ms(g) : "0", "end")}`;
    // Linien je Abschnitt ohne Lücke dazwischen
    const parts = [];
    for (const p of pts) {
      const prev = parts.at(-1)?.at(-1);
      if (!prev || this._inGap(gaps, prev[0], p[0]) || (p[2] !== undefined && p[2] - prev[2] > 1)) parts.push([p]);
      else parts.at(-1).push(p);
    }
    for (const part of parts) {
      const path = part.map(([tt, v], i) => `${i ? "L" : "M"}${x(tt).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
      const ends = part.length > 1 ? ` L${x(part.at(-1)[0]).toFixed(1)},${bottom} L${x(part[0][0]).toFixed(1)},${bottom} Z` : "";
      if (ends) s += `<path class="hl-area" d="${path}${ends}"/>`;
      s += part.length > 1 ? `<path class="hl-line" d="${path}"/>` : `<circle class="hl-dot" cx="${x(part[0][0]).toFixed(1)}" cy="${y(part[0][1]).toFixed(1)}" r="2.5"/>`;
    }
    for (const f of fails) if (f >= start && f <= now) s += `<line class="hl-failmark" x1="${x(f).toFixed(1)}" y1="${top}" x2="${x(f).toFixed(1)}" y2="${bottom}"/>`;
    const last = pts.at(-1);
    s += `<circle class="hl-dot" cx="${x(last[0]).toFixed(1)}" cy="${y(last[1]).toFixed(1)}" r="4.5"/>`;
    const label = (tt) => (d.hours <= 24 ? this._clock(tt) : new Date(tt).toLocaleDateString(this._locale(), { day: "numeric", month: "short" }));
    for (const [tt, anchor, xx] of [[start, "start", L], [(start + now) / 2, "middle", (L + R) / 2], [now, "end", R]]) s += this._txt(xx, H - 6, label(tt), anchor);
    return this._svg(W, H, s, this._t("hlChartLatency"));
  }


  // ----- Liste: Ereignisse und alle Aufrufe -----

  _paneSpec(d) {
    return this.pane === "calls" ? this._callsSpec(d) : this._eventsSpec(d);
  }

  _notes(d) {
    const notes = [];
    if (d.since && ms(d.since) - ms(d.start) > HOUR) notes.push(this._t("hlListFrom", { date: new Date(d.since).toLocaleDateString(this._locale(), { day: "numeric", month: "long" }) }));
    return notes;
  }

  _testWhat(sent) {
    return sent === "ok" ? this._t("hlOkWord") : this._caseLabel(sent);
  }

  _eventText(e) {
    const t = (k, v) => this._t(k, v);
    let text;
    if (e.kind === "fail") text = t("hlEvFail");
    else if (e.kind === "report") text = t("hlEvReport", { what: this._caseLabel(e.sent) });
    else if (e.kind === "test") text = t("hlEvTest", { what: this._testWhat(e.sent) });
    else if (e.kind === "back") text = t(e.from === "report" ? "hlEvBackReport" : "hlEvBack");
    else text = t("hlEvStart");
    // Eine Folge gescheiterter Aufrufe (oder gemeldeter Fälle) ist ein Ereignis mit Anzahl und Ende
    return e.n > 1 && e.end ? `${text} (${t("hlEvCount", { n: e.n, time: this._clock(e.end) })})` : text;
  }

  _callText(c) {
    if (c.kind === "test") return this._t("hlEvTest", { what: this._testWhat(c.sent) });
    if (c.kind === "report") return this._t("hlEvReport", { what: this._caseLabel(c.sent) });
    return this._t({ ok: "hcStOkSent", fail: "hlEvFail" }[c.kind] || "hlEvFail");
  }

  // Zeilen: Zeit, Ereignis (mit Punkt in der Farbe), Ergebnis, Antwortzeit, Auslöser; auf dem Handy Ergebnis und Antwortzeit klein unter dem Ereignis
  _rows(list, text) {
    const { escape } = this.h;
    return list.map((e) => {
      const tt = ms(e.t);
      const what = text(e);
      const res = this._result(e);
      const time = this._ms(e.ms);
      const by = this._t(`hlBy_${e.by}`);
      const dot = `<span class="hl-dot-s ${e.kind}"></span>`;
      return {
        t: tt,
        sort: { time: tt, event: what, result: res, ms: Number.isFinite(e.ms) ? e.ms : Infinity, by },
        hay: [what, res, time, by, this._dayLabel(new Date(tt)), this._clock(e.t), this._clockSec(e.t)],
        wide: (when) => `<tr data-kind="${e.kind}"><td>${escape(when)}</td><td><span class="hl-ev">${dot}${escape(what)}</span></td><td>${escape(res)}</td><td>${escape(time)}</td><td><span class="hl-tag">${escape(by)}</span></td></tr>`,
        narrow: (when) => `<tr data-kind="${e.kind}"><td>${escape(when)}</td><td><span class="hl-ev">${dot}<span>${escape(what)}<small>${escape(e.ms === null || e.ms === undefined ? res : `${res} · ${time}`)}</small></span></span></td><td class="r"><span class="hl-tag">${escape(by)}</span></td></tr>`,
      };
    });
  }

  _cols() {
    return {
      cols: [["time", "hlColTime", "c1"], ["event", "hlColEvent", ""], ["result", "hlColResult", "c5"], ["ms", "hlColMs", "c5"], ["by", "hlColBy", "c6"]],
      ncols: [["time", "hlColTime", ""], ["event", "hlColEvent", ""], ["by", "hlColBy", "r"]],
    };
  }

  _eventsSpec(d) {
    const { escape } = this.h;
    const notes = this._notes(d);
    const total = Number.isInteger(d.events_total) ? d.events_total : d.events.length;
    if (d.events.length < total) notes.push(this._t("hlListTruncated", { shown: d.events.length, total }));
    return { rows: this._rows(d.events, (e) => this._eventText(e)), total, notes, ...this._cols(), empty: `<p class="dlg-note">${escape(this._t(d.since ? "hlNoEvents" : "hlNoData"))}</p>` };
  }

  _callsSpec(d) {
    const { escape } = this.h;
    const notes = this._notes(d);
    const total = Number.isInteger(d.calls_total) ? d.calls_total : d.calls.length;
    if (d.calls.length < total) notes.push(this._t("hlListTruncated", { shown: d.calls.length, total }));
    // Einzelne Aufrufe nur 24 Stunden ("ältere nur zusammengefasst"): bei 7 Tagen und mehr zeigt die Liste diese 24 Stunden, und das steht über der Liste
    return { rows: this._rows(d.calls, (c) => this._callText(c)), total, lead: d.hours > 24 ? [this._t("hlCallsDay")] : [], notes, ...this._cols(), empty: `<p class="dlg-note">${escape(this._t(d.since ? "hlNoCalls" : "hlNoData"))}</p>` };
  }

  _rowsHtml(spec) {
    const { escape, mdi } = this.h;
    if (!spec.rows.length) return spec.empty;
    const q = this.lq[this.pane].trim().toLowerCase();
    const sort = this.lsort[this.pane];
    const cols = this.narrow ? spec.ncols : spec.cols;
    let rows = spec.rows.filter((r) => !q || r.hay.some((x) => String(x || "").toLowerCase().includes(q)));
    if (!rows.length) return `<p class="dlg-note">${escape(this._t("hlNoMatch"))}</p>`;
    rows = [...rows].sort((a, b) => cmp(a.sort[sort.key], b.sort[sort.key]) * (sort.dir === "desc" ? -1 : 1) || b.t - a.t);
    const byDay = sort.key === "time";
    let day = "";
    let body = "";
    for (const r of rows) {
      const date = new Date(r.t);
      if (byDay && date.toDateString() !== day) {
        day = date.toDateString();
        body += `<tr class="day"><td colspan="${cols.length}">${escape(this._dayLabel(date))}</td></tr>`;
      }
      // Mit Sekunden, wo mehrere Zeilen in derselben Minute liegen können, nicht auf dem Handy
      const clock = !this.narrow ? this._clockSec(date) : this._clock(date);
      const time = byDay ? clock : `${this._shortDay(date)}, ${clock}`;
      body += (this.narrow ? r.narrow : r.wide)(time);
    }
    const th = ([key, label, cls]) => {
      const on = sort.key === key;
      const text = this._t(label);
      return `<th${cls ? ` class="${cls}"` : ""} aria-sort="${on ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}"><button type="button" class="hl-sort${on ? " on" : ""}" data-hl="lsort" data-key="${key}" title="${escape(this._t("hlSortBy", { column: text }))}">${escape(text)}${on ? mdi(sort.dir === "desc" ? "arrowDown" : "arrowUp", 14) : ""}</button></th>`;
    };
    return `<table class="hl-table"><thead><tr>${cols.map(th).join("")}</tr></thead><tbody>${body}</tbody></table>`;
  }

  // Reiter "Ereignisse" und "Alle Aufrufe" mit der Zahl des gewählten Zeitraums und Suche; der Hinweis zu den einzelnen Aufrufen steht über der Liste
  _listArea(spec) {
    const { escape } = this.h;
    const d = this.data;
    const pane = this.pane;
    const events = pane === "events" ? spec : this._eventsSpec(d);
    const calls = pane === "calls" ? spec : this._callsSpec(d);
    const btn = (key, label, n) => `<button type="button" role="tab" data-hl="pane" data-set="hl-pane" data-pane="${key}" class="sub-tab${pane === key ? " on" : ""}" aria-selected="${pane === key}">${escape(this._t(label))}<span class="hl-n">${n}</span></button>`;
    const note = (n) => `<p class="hl-note">${escape(n)}</p>`;
    const ph = this._t(pane === "calls" ? "hlSearchCalls" : "hlSearchEvents");
    const search = `<label class="list-search">${this.h.mdi("search", 18)}<input type="search" data-hl="lq" value="${escape(this.lq[pane])}" placeholder="${escape(ph)}" autocomplete="off" aria-label="${escape(ph)}">${this.host._fieldClearHtml("data-fc", "", this.lq[pane])}</label>`;
    return `<div class="hl-lbar"><div class="sub-tabs" data-set="hl-pane" role="tablist">${btn("events", "hlPaneEvents", events.total)}${btn("calls", "hlPaneCalls", calls.total)}</div>${search}</div>
      ${(spec.lead || []).map(note).join("")}<div class="hl-rows">${this._rowsHtml(spec)}</div>${spec.notes.map(note).join("")}`;
  }

  // Nur die Zeilen neu (Suche, Sortierung): das Suchfeld behält Fokus und Eingabe
  _renderRows() {
    const el = this.dlg?.querySelector(".hl-rows");
    if (!el || !this.data) return;
    el.innerHTML = this._rowsHtml(this._paneSpec(this.data));
  }

  // ----- Dienst: nur zur Ansicht -----

  _serviceHtml(item, d, state) {
    const { escape, mdi } = this.h;
    const t = (k, v) => this._t(k, v);
    const known = suggest(item.url);
    const copy = (value, label) => `<button type="button" class="hc-ib sm" data-hl="copy" data-value="${escape(value)}" title="${escape(t("hlCopy", { name: label }))}" aria-label="${escape(t("hlCopy", { name: label }))}">${mdi("copy", 16)}</button>`;
    const row = (label, value, mono = false, copyable = true) => (value ? `<div class="hl-drow${mono ? " mono" : ""}"><span class="hc-t2">${escape(label)}</span><b>${escape(value)}</b>${copyable ? copy(value, label) : ""}</div>` : "");
    const last = d?.last;
    const lastText = last ? [`${this._dayLabel(new Date(last.t))} ${this._clockSec(last.t)}`, this._result(last), last.ms !== null && last.ms !== undefined ? this._ms(last.ms) : null].filter(Boolean).join(" · ") : "";
    const cases = (item.cases || []).flatMap((c) => [row(this._caseLabel(c.kind), c.suffix, true), row(`${this._caseLabel(c.kind)}: ${t("hcPreview")}`, applySuffix(item.url, c.suffix) || "", true)]).join("");
    const facts = [row(t("hcName"), item.name), row(t("hlSvKnown"), known?.name, false, false), row(t("hcUrl"), item.url, true), row(t("hcInterval"), this.host._fmtSeconds(item.interval, true), false, false)].join("");
    const log = [row(t("hlSvState"), this._stateText(state), false, false), row(t("hlSvLast"), lastText, false, false),
      row(t("hlSvSince"), d?.since ? new Date(d.since).toLocaleDateString(this._locale(), { day: "numeric", month: "long", year: "numeric" }) : "", false, false)].join("");
    return { fix: "", list: `<div class="hl-device"><div class="set-title">${escape(t("hlTab_service"))}</div><div class="hl-card">${facts}</div>
      <div class="set-title">${escape(t("hlSvCases"))}</div><div class="hl-card">${cases || `<p class="dlg-note">${escape(t("hlSvNone"))}</p>`}</div>
      <div class="set-title">${escape(t("hlSvLog"))}</div><div class="hl-card">${log || `<p class="dlg-note">${escape(t("hlNoData"))}</p>`}</div>
      <p class="hl-note">${escape(t("hlSvKeep"))}</p></div>` };
  }
}
