/**
 * Protokoll einer Magic-Push-Meldung oder Routine (seit 2.104.0, docs/mockups/protocol-v1, Variante A) und das Protokoll aller
 * Meldungen oder Routinen eines Geräts. Ein eigenes Fenster (dialog.proto-dlg, gleiche Hülle wie das Aktivitätsprotokoll):
 * oben der Zeitraum (7 Tage bis 12 Monate oder eigene Daten), Suche und Auswahl, darunter Kennzahlen, ein Diagramm (Balken je Tag,
 * bei langen Zeiträumen je Woche; ein Tipp auf einen Balken setzt den Zeitraum auf diesen Tag) und die Tabelle. Bei Magic Push zeigt
 * eine Zeile den Inhalt der Meldung, bei Routinen öffnet sie den Trace (jeder Schritt des Laufs, als Text kopierbar).
 *
 * Alle Zahlen, das Diagramm und die Tabelle kommen von device_panel/protocol_get (protocol.py); das Panel rechnet nichts nach.
 * Der Server beschneidet nach den Einstellungen "Protokolle" (Panel › Allgemein): Grösse in MB und Einträge je Meldung oder Routine.
 */

// "all": ab dem ältesten Eintrag (der Server kennt seit 2.105.0 keine Zeitgrenze mehr, nur noch Grösse und Zahl der Einträge)
const RANGES = [
  ["7d", 7],
  ["30d", 30],
  ["6m", 183],
  ["12m", 366],
  ["all", 0],
];
const PAGE = 100;
const LIMIT_MAX = 500;
const DAY = 86400;
const SEARCH_DELAY_MS = 250;
const FILTERS = {
  magic: ["all", "fired", "recovered", "test", "held", "failed"],
  routine: ["all", "run", "revert", "missed", "failed", "manual"],
};
// Schritte eines Trace, die einen Fehler oder ein Warnzeichen zeigen
const BAD_RESULT = new Set(["failed", "retry", "missed"]);

// Datum als "JJJJ-MM-TT" in Ortszeit (für die Datumsfelder)
const isoDay = (sec) => {
  const d = new Date(sec * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// Beginn des Tages (Ortszeit) einer "JJJJ-MM-TT"-Angabe in Sekunden, sonst null
const dayStart = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() / 1000 : null;
};

export class ProtocolUi {
  constructor(host, deps) {
    this.host = host;
    this.h = deps;
    this.s = null;
    this._searchTimer = null;
    this._flashTimer = null;
  }

  t(key, ...args) {
    return this.host._t(key, ...args);
  }

  get dlg() {
    return this.host.shadowRoot.querySelector("dialog.proto-dlg");
  }

  esc(value) {
    return this.h.escape(value);
  }

  // Jetzt in Sekunden nach der Uhr des Servers
  now() {
    return (Date.now() + (this.host._offset || 0)) / 1000;
  }

  // --- Öffnen und Schliessen ---------------------------------------------------

  // kind: "magic" oder "routine"; itemId: eine Meldung oder Routine; deviceId: alle des Geräts; name: Name des Eintrags oder Geräts
  open({ kind, itemId = "", deviceId = "", name = "" }) {
    const dlg = this.dlg;
    if (!dlg || !FILTERS[kind] || (!itemId && !deviceId)) return;
    window.clearTimeout(this._searchTimer);
    this.s = {
      kind,
      itemId,
      deviceId,
      name,
      range: "30d",
      own: null,
      filter: "all",
      item: "",
      items: [],
      q: "",
      limit: PAGE,
      data: null,
      loading: true,
      error: null,
      open: new Set(),
      view: "list",
      trace: 0,
      flash: "",
      seq: 0,
    };
    this.frame();
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    this.load();
  }

  close() {
    window.clearTimeout(this._searchTimer);
    const dlg = this.dlg;
    if (dlg?.open) {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }
  }

  bind(dlg) {
    dlg.addEventListener("click", (ev) => {
      if (ev.target === dlg) {
        const r = dlg.getBoundingClientRect();
        if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) this.close();
        return;
      }
      const s = this.s;
      if (!s) return;
      const el = ev.target.closest("[data-pr]");
      if (!el || el.disabled) return;
      this.action(el.dataset.pr, el);
    });
    dlg.addEventListener("input", (ev) => {
      const s = this.s;
      if (!s || !ev.target.matches?.("[data-pr-search]")) return;
      s.q = ev.target.value;
      window.clearTimeout(this._searchTimer);
      this._searchTimer = window.setTimeout(() => {
        s.limit = PAGE;
        this.load();
      }, SEARCH_DELAY_MS);
    });
    dlg.addEventListener("change", (ev) => {
      const s = this.s;
      const el = ev.target;
      if (!s || !el.matches?.("[data-pr-date]")) return;
      const own = { ...(s.own || this.span().dates) };
      own[el.dataset.prDate] = el.value;
      if (own.from && own.to && own.from > own.to) {
        // Von nach Bis: die beiden vertauschen statt zu verwerfen
        [own.from, own.to] = [own.to, own.from];
      }
      s.own = own;
      s.range = "own";
      s.limit = PAGE;
      this.renderBar();
      this.load();
    });
    dlg.addEventListener("close", () => {
      if (!dlg.open) {
        window.clearTimeout(this._searchTimer);
        this.s = null;
      }
    });
  }

  // --- Zeitraum ------------------------------------------------------------------

  // Beginn und Ende in Sekunden und als Datum für die Felder
  span() {
    const s = this.s;
    const now = this.now();
    if (s.range === "all") {
      // Ohne Anfang: der Server nimmt den ältesten Eintrag; die Daten für "Eigener" kommen aus der letzten Antwort
      const first = s.data?.oldest ?? now;
      return { since: null, until: now, dates: { from: isoDay(first), to: isoDay(now) } };
    }
    if (s.range === "own" && s.own) {
      const from = dayStart(s.own.from);
      const toStart = dayStart(s.own.to);
      if (from !== null && toStart !== null) {
        return { since: from, until: Math.min(toStart + DAY - 1, now), dates: { from: s.own.from, to: s.own.to } };
      }
    }
    const days = (RANGES.find(([id]) => id === s.range) || RANGES[1])[1];
    return { since: now - days * DAY, until: now, dates: { from: isoDay(now - days * DAY), to: isoDay(now) } };
  }

  // --- Laden ---------------------------------------------------------------------

  async load() {
    const s = this.s;
    if (!s) return;
    const seq = ++s.seq;
    const { since, until } = this.span();
    const msg = { type: "device_panel/protocol_get", kind: s.kind, ...(since === null ? {} : { since }), until, limit: s.limit, filter: s.filter === "all" ? null : s.filter, q: s.q.trim() };
    const wholeDevice = !s.itemId && !s.item;
    if (s.itemId || s.item) msg.item_id = s.itemId || s.item;
    else msg.device_id = s.deviceId;
    s.loading = true;
    this.renderFoot();
    try {
      const r = await this.host._hass.callWS(msg);
      if (this.s !== s || seq !== s.seq) return;
      s.data = r;
      s.error = null;
      // Auswahl der Meldungen eines Geräts: die Liste der Antwort für das ganze Gerät merken
      const fresh = wholeDevice && JSON.stringify(s.items) !== JSON.stringify(r.items || []);
      if (wholeDevice) s.items = r.items || [];
      if (fresh) this.renderBar();
    } catch (err) {
      if (this.s !== s || seq !== s.seq) return;
      s.error = this.h.errText(err);
    }
    s.loading = false;
    this.render();
  }

  // --- Zeichnen ------------------------------------------------------------------

  frame() {
    const dlg = this.dlg;
    const s = this.s;
    const t = (k, ...a) => this.t(k, ...a);
    const icon = s.kind === "magic" ? "bell" : "timer";
    dlg.innerHTML = `<div class="dlg-head"><span class="dlg-avatar">${this.h.mdi(icon, 28)}</span>
        <div class="dlg-title"><h2>${this.esc(t("prTitle"))}</h2><div class="dlg-sub" data-pr-sub></div></div></div>
      <div class="lg-bar" data-pr-bar>
        <div data-pr-ranges></div>
        <div class="pr-dates" data-pr-dates></div>
        <label class="list-search lg-search">${this.h.mdi("search", 18)}<input type="search" data-pr-search placeholder="${this.esc(t("prSearch"))}" aria-label="${this.esc(t("prSearch"))}" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="100">${this.host._fieldClearHtml("data-fc", "", "")}</label>
        <div class="lg-chips" data-pr-filters></div>
        <div class="lg-chips" data-pr-items></div>
      </div>
      <div class="lg-list pr-body" data-pr-body role="list"></div>
      <div class="lg-foot" data-pr-foot></div>`;
    this.renderBar();
    this.render();
  }

  render() {
    const s = this.s;
    if (!s || !this.dlg) return;
    const inTrace = s.view === "trace";
    const bar = this.dlg.querySelector("[data-pr-bar]");
    if (bar) bar.hidden = inTrace;
    this.renderSub();
    this.renderBody();
    this.renderFoot();
  }

  renderSub() {
    const sub = this.dlg.querySelector("[data-pr-sub]");
    const s = this.s;
    if (!sub) return;
    let text = s.name;
    if (s.deviceId && !s.itemId && s.items.length) text = `${s.name} · ${this.t(s.kind === "magic" ? "prItemsMagic" : "prItemsRoutine", s.items.length)}`;
    sub.textContent = text;
  }

  // Zeitraum, Daten, Auswahl: ohne das Suchfeld, damit Fokus und Cursor beim Tippen bleiben
  renderBar() {
    const s = this.s;
    const dlg = this.dlg;
    const t = (k, ...a) => this.t(k, ...a);
    if (!s || !dlg) return;
    const labels = { "7d": "prR7d", "30d": "prR30d", "6m": "prR6m", "12m": "prR12m", all: "prRAll" };
    const tabs = RANGES.map(([id]) => `<button type="button" class="sub-tab${s.range === id ? " on" : ""}" data-set="pr-range" data-pr="range" data-v="${id}">${this.esc(t(labels[id]))}</button>`);
    tabs.push(`<button type="button" class="sub-tab${s.range === "own" ? " on" : ""}" data-set="pr-range" data-pr="range" data-v="own">${this.esc(t("prROwn"))}</button>`);
    const ranges = dlg.querySelector("[data-pr-ranges]");
    ranges.innerHTML = `<div class="sub-tabs mg-filter" role="group" aria-label="${this.esc(t("prRange"))}">${tabs.join("")}</div>`;
    const dates = dlg.querySelector("[data-pr-dates]");
    if (s.range === "own") {
      const d = this.span().dates;
      const today = isoDay(this.now());
      dates.hidden = false;
      dates.innerHTML = `<label>${this.esc(t("prFrom"))}<input type="date" data-pr-date="from" value="${this.esc(d.from)}" max="${today}"></label>
        <label>${this.esc(t("prUntil"))}<input type="date" data-pr-date="to" value="${this.esc(d.to)}" max="${today}"></label>`;
    } else {
      dates.hidden = true;
      dates.innerHTML = "";
    }
    const chips = FILTERS[s.kind].map((id) => {
      const label = t(`prF_${id}`);
      return `<button type="button" class="chip${s.filter === id ? " on" : ""}" data-pr="filter" data-v="${id}" aria-pressed="${s.filter === id}"><span>${this.esc(label)}</span></button>`;
    });
    dlg.querySelector("[data-pr-filters]").innerHTML = chips.join("");
    // Meldungen eines Geräts: zusätzlich die Auswahl der einzelnen Meldung oder Routine
    const items = dlg.querySelector("[data-pr-items]");
    if (s.deviceId && !s.itemId && s.items.length > 1) {
      const all = t(s.kind === "magic" ? "prAllMagic" : "prAllRoutines");
      items.hidden = false;
      items.innerHTML = [["", all], ...s.items.map((i) => [i.id, i.name])]
        .map(([id, label]) => `<button type="button" class="chip${s.item === id ? " on" : ""}" data-pr="item" data-v="${this.esc(id)}" aria-pressed="${s.item === id}"><span>${this.esc(label)}</span></button>`)
        .join("");
    } else {
      items.hidden = true;
      items.innerHTML = "";
    }
  }

  fmtStamp(sec) {
    const loc = this.host._locale();
    const d = new Date(sec * 1000);
    try {
      const day = d.toLocaleDateString(loc, { day: "2-digit", month: "2-digit", year: "numeric" });
      const time = d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      return `${day} · ${time}`;
    } catch {
      return d.toISOString().replace("T", " ").slice(0, 19);
    }
  }

  ago(sec) {
    return this.t("prAgo", this.host._fmtSeconds(Math.max(0, this.now() - sec), true));
  }

  num(n) {
    return Number(n || 0).toLocaleString(this.host._locale());
  }

  kpis(d) {
    const s = this.s;
    const c = d.counts || {};
    const t = (k, ...a) => this.t(k, ...a);
    const box = (value, label) => `<div class="pr-k"><b>${this.esc(value)}</b><span>${this.esc(label)}</span></div>`;
    if (s.kind === "magic") {
      const fired = (c.fired || 0) + (c.repeat || 0);
      const notSent = (c.res_held || 0) + (c.res_failed || 0) + (c.res_no_target || 0);
      return [box(this.num(d.all), t("prKMsgs")), box(this.num(fired), t("prKFired")), box(this.num(c.recovered), t("prKRecovered")), box(this.num(notSent), t("prKNotSent")), box(d.longest_s ? this.host._fmtSeconds(d.longest_s) : "–", t("prKLongest"))].join("");
    }
    const missed = (c.missed || 0) + (c.paused || 0);
    return [box(this.num(c.run), t("prKRuns")), box(this.num(c.revert), t("prKReverts")), box(this.num(missed), t("prKMissed")), box(this.num(c.failed), t("prKFailed")), box(d.punctual === null || d.punctual === undefined ? "–" : `${d.punctual} %`, t("prKPunctual"))].join("");
  }

  chart(d) {
    const buckets = d.buckets || [];
    if (!buckets.length) return "";
    const t = (k, ...a) => this.t(k, ...a);
    const max = Math.max(1, ...buckets.map((b) => b.n));
    const week = d.step === "week";
    const bars = buckets
      .map((b) => {
        const label = week ? t("prBarWeek", this.host._fmtDate(b.t)) : this.host._fmtDateY(b.t);
        const tip = `${label}: ${t("prBarTip", b.n, b.bad)}`;
        const col = b.n ? `<span class="pr-col" style="height:${Math.max(6, (b.n / max) * 100).toFixed(1)}%">${b.bad ? `<i class="bad" style="flex:${b.bad}"></i>` : ""}${b.n - b.bad ? `<i class="ok" style="flex:${b.n - b.bad}"></i>` : ""}</span>` : "";
        return `<button type="button" class="pr-bar" data-pr="bar" data-t="${b.t}" data-step="${week ? "week" : "day"}" title="${this.esc(tip)}" aria-label="${this.esc(tip)}">${col}</button>`;
      })
      .join("");
    const at = (i) => buckets[Math.min(buckets.length - 1, Math.max(0, i))].t;
    const n = buckets.length;
    const marks = n > 1 ? [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1] : [0];
    const axis = marks.map((i, k) => `<span>${this.esc(k === 0 || k === marks.length - 1 ? this.host._fmtDateY(at(i)) : this.host._fmtDate(at(i)))}</span>`).join("");
    return `<div class="pr-chart" role="group" aria-label="${this.esc(t("prChart"))}">${bars}</div><div class="pr-axis">${axis}</div>`;
  }

  // Ergebnis einer Meldung oder Zeile der Routine: [Text, Ton (ok/wn/er/nu/in)]
  magicKind(e) {
    return this.t(`prK_${e.k}`) || e.k || "";
  }

  errText(code) {
    if (!code) return "";
    const known = this.host._t(`prErr_${code}`);
    return known || String(code);
  }

  magicResult(e) {
    const tone = { sent: "ok", held: "nu", failed: "er", no_target: "er" }[e.res] || "nu";
    return [this.t(`prRes_${e.res}`) || e.res || "", tone];
  }

  routineResult(e) {
    const tone = { run: e.src === "manual" ? "in" : "ok", revert: "ok", missed: "wn", paused: "nu", retry: "wn", failed: "er" }[e.k] || "nu";
    return [this.t(`prRR_${e.k}`) || e.k || "", tone];
  }

  actText(e) {
    if (!e.act) return "";
    if (e.act === "restore") return this.t("prRestore");
    if (e.act === "set") return this.t("rtAct_set");
    return this.host._t(`rtVerb_${e.act}`) || e.act;
  }

  lateText(e) {
    const late = Number(e.late || 0);
    if (!(late >= 5)) return "";
    return this.t("prLate", late < 60 ? `${Math.round(late)} s` : this.host._fmtSeconds(late));
  }

  magicRow(e, i, device) {
    const s = this.s;
    const [res, tone] = this.magicResult(e);
    const key = `${e.id}|${e.at}`;
    const open = s.open.has(key);
    const body = String(e.body || "");
    const hasMsg = Boolean(e.title || body);
    const extra = [];
    if (device && e.name) extra.push(this.esc(e.name));
    if (e.k === "recovered" && e.dur) extra.push(this.esc(this.t("prDur", this.host._fmtSeconds(e.dur))));
    const err = e.err ? `<small class="pr-err">${this.esc(this.errText(e.err))}</small>` : "";
    const target = e.target && e.res === "sent" ? `<small>→ ${this.esc(e.target)}</small>` : e.target && e.res === "held" ? `<small>${this.esc(e.target)}</small>` : "";
    const msg = open && hasMsg ? `<div class="pr-msg"><b>${this.esc(e.title || "")}</b>${body ? `<span>${this.esc(body)}</span>` : ""}</div>` : "";
    return `<div class="pr-item${open ? " open" : ""}" role="listitem"><button type="button" class="pr-row" data-pr="row" data-key="${this.esc(key)}" aria-expanded="${open}"${hasMsg ? "" : " disabled"}>
        <span class="c-date">${this.esc(this.fmtStamp(e.at))}<small>${this.esc(this.ago(e.at))}</small></span>
        <span class="c-kind"><span class="pr-st ${e.k === "recovered" ? "ok" : e.k === "test" ? "in" : "wn"}">${this.esc(this.magicKind(e))}</span></span>
        <span class="c-main"><b>${this.esc(e.title || e.name || "")}</b>${extra.length ? `<small>${extra.join(" · ")}</small>` : ""}</span>
        <span class="c-res"><span class="pr-st ${tone}">${this.esc(res)}</span>${target}${err}</span>
        <span class="c-val">${this.esc(e.value || "–")}</span></button>${msg}</div>`;
  }

  routineRow(e, i, device) {
    const [res, tone] = this.routineResult(e);
    const late = this.lateText(e);
    const src = this.t(`prSrc_${e.src}`) || e.src || "";
    const err = e.err ? `<small class="pr-err">${this.esc(this.host._t(`rtReason_${e.err}`) || e.err)}</small>` : "";
    return `<div class="pr-item" role="listitem"><button type="button" class="pr-row" data-pr="trace" data-i="${i}">
        <span class="c-date">${this.esc(this.fmtStamp(e.at))}<small>${this.esc(this.ago(e.at))}</small></span>
        <span class="c-kind">${this.esc(src)}${late ? `<small>${this.esc(late)}</small>` : ""}</span>
        <span class="c-main"><b>${this.esc(this.actText(e))}</b>${device && e.name ? `<small>${this.esc(e.name)}</small>` : ""}</span>
        <span class="c-res"><span class="pr-st ${tone}">${this.esc(res)}</span>${err}</span>
        <span class="c-val pr-go">${this.h.mdi("chevronRight", 18)}</span></button></div>`;
  }

  head() {
    const t = (k) => this.esc(this.t(k));
    if (this.s.kind === "magic") return `<div class="pr-row pr-head" aria-hidden="true"><span>${t("prColDate")}</span><span>${t("prColKind")}</span><span>${t("prColMsg")}</span><span>${t("prColResult")}</span><span>${t("prColValue")}</span></div>`;
    return `<div class="pr-row pr-head" aria-hidden="true"><span>${t("prColDate")}</span><span>${t("prColSrc")}</span><span>${t("prColAct")}</span><span>${t("prColResult")}</span><span>${t("prColTrace")}</span></div>`;
  }

  renderBody() {
    const s = this.s;
    const body = this.dlg.querySelector("[data-pr-body]");
    if (!body) return;
    const t = (k, ...a) => this.t(k, ...a);
    if (s.view === "trace") {
      body.innerHTML = this.traceHtml();
      body.scrollTop = 0;
      return;
    }
    if (!s.data) {
      body.innerHTML = s.error
        ? `<div class="dlg-error">${this.esc(t("prError", s.error))}</div><button type="button" class="qbtn" data-pr="reload">${this.esc(t("prRetry"))}</button>`
        : `<p class="mg-note">${this.esc(t("prLoading"))}</p>`;
      return;
    }
    const d = s.data;
    const device = Boolean(s.deviceId && !s.itemId);
    const rows = (d.entries || []).map((e, i) => (s.kind === "magic" ? this.magicRow(e, i, device) : this.routineRow(e, i, device))).join("");
    const filtered = s.filter !== "all" || Boolean(s.q.trim());
    let empty = "";
    if (!d.entries.length) empty = `<p class="mg-empty">${this.esc(t(d.all || filtered ? "prEmpty" : "prNone"))}</p>`;
    let more = "";
    if (d.total > d.entries.length) {
      more = d.entries.length >= LIMIT_MAX ? `<p class="mg-hint">${this.esc(t("prCutoff", LIMIT_MAX, this.num(d.total)))}</p>` : `<button type="button" class="qbtn pr-more" data-pr="more">${this.esc(t("prMore"))}</button>`;
    }
    const notes = [];
    if (d.oldest) notes.push(t("prOldest", this.host._fmtDateY(d.oldest)));
    notes.push(t("prKeep", this.num(d.max_mb), this.num(d.max_entries)));
    const err = s.error ? `<div class="dlg-error">${this.esc(t("prError", s.error))}</div>` : "";
    body.innerHTML = `${err}<div class="pr-kpis">${this.kpis(d)}</div>${this.chart(d)}
      <div class="pr-table" role="list">${rows ? this.head() + rows : ""}</div>${empty}${more}<p class="pr-note">${this.esc(notes.join(" "))}</p>`;
  }

  renderFoot() {
    const s = this.s;
    const foot = this.dlg?.querySelector("[data-pr-foot]");
    if (!s || !foot) return;
    const t = (k, ...a) => this.t(k, ...a);
    const mdi = this.h.mdi;
    if (s.view === "trace") {
      const n = s.data?.entries?.length || 0;
      foot.innerHTML = `<button type="button" class="lg-btn" data-pr="back">${mdi("arrowLeft", 16)}<span>${this.esc(t("prBack"))}</span></button>
        <span class="sp"></span>
        <button type="button" class="lg-btn" data-pr="newer"${s.trace <= 0 ? " disabled" : ""}>${this.esc(t("prNewer"))}</button>
        <button type="button" class="lg-btn" data-pr="older"${s.trace >= n - 1 ? " disabled" : ""}>${this.esc(t("prOlder"))}</button>
        <button type="button" class="lg-btn" data-pr="copy-trace">${mdi("copy", 16)}<span>${this.esc(s.flash || t("prTraceCopy"))}</span></button>`;
      return;
    }
    const d = s.data;
    const count = s.loading && !d ? t("prLoading") : d ? t("prShown", d.entries.length, this.num(d.total)) : "";
    foot.innerHTML = `<button type="button" class="lg-btn" data-pr="close">${mdi("arrowLeft", 16)}<span>${this.esc(t("prBack"))}</span></button><span class="pr-count">${this.esc(count)}</span><span class="sp"></span>
      <button type="button" class="lg-btn" data-pr="copy"${d?.entries?.length ? "" : " disabled"}>${mdi("copy", 16)}<span>${this.esc(s.flash || t("prCopyText"))}</span></button>`;
  }

  // --- Trace ---------------------------------------------------------------------

  traceTime(sec) {
    const d = new Date(sec * 1000);
    try {
      return d.toLocaleTimeString(this.host._locale(), { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return d.toISOString().slice(11, 19);
    }
  }

  // Satz eines Schrittes; [Text, Ton]
  stepText(step, e) {
    const t = (k, ...a) => this.t(k, ...a);
    const v = step.v || {};
    switch (step.s) {
      case "trigger": {
        const parts = [];
        if (v.src === "manual") parts.push(t("prTrManual"));
        else if (v.src === "revert") parts.push(t("prTrRevert", v.kind ? t(`prBack_${v.kind}`) : ""));
        else parts.push(t(v.src === "trigger" ? "prTrTrigger" : "prTrTime"));
        if (v.due) parts.push(t("prTrDue", this.traceTime(v.due)));
        if (v.late >= 5) parts.push(this.lateText({ late: v.late }));
        return [parts.filter(Boolean).join(", "), ""];
      }
      case "window":
        return [t("prTrWindow", v.window?.from || "", v.window?.to || ""), ""];
      case "snapshot":
        return [t("prTrSnapshot", v.state ?? "?"), ""];
      case "call": {
        const what = Array.isArray(v.svc) && v.svc.length ? `${v.svc.join(", ")} → ${v.ent}` : v.ent || "";
        if (v.err) {
          const reason = this.host._t(`rtReason_${v.err}`) || v.err;
          return [`${what ? `${what}: ` : ""}${t("prTrFailed", reason)}${v.ms !== undefined ? ` (${(v.ms / 1000).toLocaleString(this.host._locale(), { maximumFractionDigits: 1 })} s)` : ""}`, "er"];
        }
        const sec = (Number(v.ms || 0) / 1000).toLocaleString(this.host._locale(), { maximumFractionDigits: 1 });
        return [`${what}\n${t("prTrCallOk", sec)}${v.state !== undefined ? ` · ${t("prTrState", v.state)}` : ""}`, "ok"];
      }
      case "revert_plan":
        if (!v.due || v.kind === "none" || !v.back) return [t("prTrNoBack"), ""];
        return [t("prTrBackAt", this.fmtStamp(v.due), v.kind ? t(`prBack_${v.kind}`) : "", v.back === "set" || e.act === "restore" ? t("prRestore") : this.host._t(`rtVerb_${v.back}`) || v.back), ""];
      case "notify":
        if (v.res === "off") return [t("prTrNotifyOff"), ""];
        if (v.res === "sent") return [t("prTrNotifySent", v.target || ""), "ok"];
        if (v.res === "held") return [t("prTrNotifyHeld"), ""];
        return [t("prTrNotifyFailed", this.errText(v.err) || ""), "er"];
      case "result": {
        const what = t(`prRR_${v.what}`) || v.what || "";
        if (v.what === "retry") return [`${what} (${v.count}), ${t("prTrNext", v.next ? this.traceTime(v.next) : "")}`, "wn"];
        return [what, BAD_RESULT.has(v.what) ? (v.what === "failed" ? "er" : "wn") : "ok"];
      }
      default:
        return [JSON.stringify(v), ""];
    }
  }

  traceLines(e) {
    return (e.trace || []).map((step, i) => {
      const [text, tone] = this.stepText(step, e);
      return { n: i + 1, label: this.t(`prTr_${step.s}`) || step.s, text, tone };
    });
  }

  traceText(e) {
    const t = (k, ...a) => this.t(k, ...a);
    const pad = (label) => label.padEnd(12, " ");
    const out = [`${pad(t("prTrRoutine"))}${e.name} (ID ${e.id})`, `${pad(t("prTrEntity"))}${e.ent || ""}`, `${pad(t("prTrRun"))}${this.fmtStamp(e.at)} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`, ""];
    for (const l of this.traceLines(e)) {
      const [first, ...rest] = l.text.split("\n");
      out.push(`${String(l.n).padEnd(3, " ")}${l.label.padEnd(14, " ")}${first}`);
      for (const r of rest) out.push(`${" ".repeat(17)}${r}`);
    }
    const [res] = this.routineResult(e);
    out.push("", `${t("prTrResult")}: ${res}${e.err ? ` (${this.host._t(`rtReason_${e.err}`) || e.err})` : ""}`);
    return out.join("\n");
  }

  traceHtml() {
    const s = this.s;
    const e = s.data?.entries?.[s.trace];
    const t = (k, ...a) => this.t(k, ...a);
    if (!e) return `<p class="mg-empty">${this.esc(t("prEmpty"))}</p>`;
    const lines = this.traceLines(e);
    const [res, tone] = this.routineResult(e);
    const rows = lines
      .map((l) => `<div class="tr-line${l.tone ? ` ${l.tone}` : ""}"><span class="tr-n">${l.n}</span><span class="tr-l">${this.esc(l.label)}</span><span class="tr-t">${this.esc(l.text)}</span></div>`)
      .join("");
    return `<div class="pr-trace-head"><b>${this.esc(e.name)}</b><small>${this.esc(this.fmtStamp(e.at))}${e.ent ? ` · ${this.esc(e.ent)}` : ""}</small></div>
      <div class="pr-trace">${rows || `<p class="mg-empty">${this.esc(t("prNoTrace"))}</p>`}<div class="tr-result pr-st ${tone}">${this.esc(t("prTrResult"))}: ${this.esc(res)}</div></div>`;
  }

  // --- Aktionen --------------------------------------------------------------------

  flash(text) {
    const s = this.s;
    if (!s) return;
    s.flash = text;
    window.clearTimeout(this._flashTimer);
    this._flashTimer = window.setTimeout(() => {
      if (this.s === s) {
        s.flash = "";
        this.renderFoot();
      }
    }, 1500);
    this.renderFoot();
  }

  tableText() {
    const s = this.s;
    const rows = s.data?.entries || [];
    return rows
      .map((e) => {
        if (s.kind === "magic") {
          const [res] = this.magicResult(e);
          return [this.fmtStamp(e.at), this.magicKind(e), e.name, e.title || "", e.body || "", res, e.value || "", e.err ? this.errText(e.err) : ""].filter((x, i) => x || i < 3).join(" | ");
        }
        const [res] = this.routineResult(e);
        return [this.fmtStamp(e.at), this.t(`prSrc_${e.src}`) || e.src || "", e.name, this.actText(e), res, e.err ? this.host._t(`rtReason_${e.err}`) || e.err : ""].filter((x, i) => x || i < 3).join(" | ");
      })
      .join("\n");
  }

  async action(name, el) {
    const s = this.s;
    switch (name) {
      case "close":
        this.close();
        break;
      case "reload":
        s.error = null;
        s.data = null;
        this.render();
        this.load();
        break;
      case "range": {
        const v = el.dataset.v;
        if (v === s.range) break;
        // "Eigener Zeitraum" beginnt mit den Daten des bisherigen Zeitraums
        if (v === "own") s.own = { ...this.span().dates };
        s.range = v;
        s.limit = PAGE;
        this.renderBar();
        this.load();
        break;
      }
      case "bar": {
        const t0 = Number(el.dataset.t);
        const days = el.dataset.step === "week" ? 7 : 1;
        const last = isoDay(Math.min(t0 + days * DAY - 3600, this.now()));
        s.own = { from: isoDay(t0 + 3600), to: last };
        s.range = "own";
        s.limit = PAGE;
        this.renderBar();
        this.load();
        break;
      }
      case "filter":
        s.filter = el.dataset.v;
        s.limit = PAGE;
        this.renderBar();
        this.load();
        break;
      case "item":
        s.item = el.dataset.v;
        s.limit = PAGE;
        this.renderBar();
        this.load();
        break;
      case "more":
        s.limit = Math.min(LIMIT_MAX, s.limit + PAGE);
        this.load();
        break;
      case "row": {
        const key = el.dataset.key;
        if (s.open.has(key)) s.open.delete(key);
        else s.open.add(key);
        const scroll = this.dlg.querySelector("[data-pr-body]").scrollTop;
        this.renderBody();
        this.dlg.querySelector("[data-pr-body]").scrollTop = scroll;
        break;
      }
      case "trace":
        s.view = "trace";
        s.trace = Number(el.dataset.i) || 0;
        s.flash = "";
        this.render();
        break;
      case "back":
        s.view = "list";
        s.flash = "";
        this.render();
        break;
      case "newer":
      case "older":
        s.trace = Math.max(0, Math.min((s.data?.entries?.length || 1) - 1, s.trace + (name === "older" ? 1 : -1)));
        s.flash = "";
        this.render();
        break;
      case "copy":
        if (await this.host._copyText(this.tableText(), null)) this.flash(this.t("prCopied"));
        break;
      case "copy-trace": {
        const e = s.data?.entries?.[s.trace];
        if (e && (await this.host._copyText(this.traceText(e), null))) this.flash(this.t("prCopied"));
        break;
      }
      default:
    }
  }
}
