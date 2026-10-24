/**
 * Protokoll einer Magic-Push-Meldung oder Routine (seit 2.104.0, docs/mockups/protocol-v1, Variante A) und das Protokoll aller
 * Meldungen oder Routinen eines Geräts. Ein eigenes Fenster (dialog.proto-dlg, gleiche Hülle wie das Aktivitätsprotokoll):
 * oben der Zeitraum (7 Tage bis 12 Monate oder eigene Daten), Suche und Auswahl, darunter Kennzahlen, ein Diagramm (Balken je Tag,
 * bei langen Zeiträumen je Woche; ein Tipp auf einen Balken setzt den Zeitraum auf diesen Tag) und die Tabelle. Bei Magic Push zeigt
 * eine Zeile den Inhalt der Meldung, bei Routinen öffnet sie den Trace (jeder Schritt des Laufs, als Text kopierbar).
 *
 * Seit 2.106.0 gibt es oben zwei Reiter "Magic Push" und "Routinen" (links Magic Push): ein Fenster für beides. Es öffnet auf dem Reiter,
 * von dem aus es aufgerufen wurde; der andere Reiter zeigt das Protokoll aller Meldungen oder Routinen desselben Geräts, und der Wechsel
 * zurück stellt den ersten Zusammenhang (eine einzelne Meldung oder Routine) wieder her.
 *
 * Seit 2.118.0 ist es das Geräteprotokoll: ein dritter, erster Reiter "Alles" führt alles zu einem Gerät (oder zu allen Geräten) in einer Liste nach
 * Tagen zusammen (Ausfall, Batterie, Laden, Updates, neue Geräte, Push, Magic Push, Routinen; kind "all", siehe devicelog.py); die Reiter "Magic
 * Push" und "Routinen" behalten ihre Auswertung (Kennzahlen, Diagramm, Tabelle, Trace). Es öffnet vom Geräte-Popup und von den Übersichten.
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
// Reiter oben: Reihenfolge und Name der Texte
const TABS = ["all", "magic", "routine", "system"];
const PAGE = 100;
const LIMIT_MAX = 500;
const DAY = 86400;
const SEARCH_DELAY_MS = 250;
const FILTERS = {
  // Kategorien der Liste "Alles"; das Panel zeigt nur die, zu denen es im Zeitraum Einträge gibt
  all: ["all", "outage", "battery", "charge", "signal", "updates", "new", "push", "magic", "routine"],
  magic: ["all", "fired", "recovered", "test", "held", "failed"],
  routine: ["all", "run", "revert", "missed", "failed", "manual"],
  // Stufen des Reiters "System" (Debug erscheint nur, wenn der Schalter an ist oder es Debug-Einträge gibt)
  system: ["all", "error", "warning", "info", "debug"],
};
// Reihenfolge der Kategorien im Reiter "System"; unbekannte kommen danach
const SYSTEM_CATS = ["system", "push", "launcher", "updates", "new", "charge", "outage", "battery", "signal", "magic", "routine"];
const POLL_MS = 4000;
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
    if (!dlg || !FILTERS[kind]) return;
    window.clearTimeout(this._searchTimer);
    this.stopPoll();
    // Seit 2.134.0 ist eine Meldung oder Routine von der Karte nur eine Vorauswahl (s.item) im Bereich ihres Geräts: die Chips zeigen sie
    // und lassen den Filter aufheben oder wechseln (docs/mockups/protocol-filter-v1)
    this.s = {
      kind,
      itemId: "",
      deviceId,
      name,
      // Zusammenhang der anderen Reiter: alles, alle Meldungen oder alle Routinen des Geräts (ohne Gerät: aller Geräte)
      alt: Object.fromEntries(TABS.filter((k) => k !== kind).map((k) => [k, { itemId: "", deviceId, name: deviceId ? this.deviceName(deviceId) : "" }])),
      // Im Reiter "System" steht der Zeitraum auf "Alle" (seit 2.129.0), die anderen auf 30 Tage; beim Wechsel merkt sich das Fenster den bisherigen
      range: kind === "system" ? "all" : "30d",
      rangeBack: "30d",
      own: null,
      filter: "all",
      item: kind === "magic" || kind === "routine" ? itemId : "",
      pickOpen: false,
      // Von einer Karte geöffnet: die Chips stehen auch bei nur einem Eintrag da, damit man den Filter sieht und aufheben kann
      keepChips: Boolean(itemId) && (kind === "magic" || kind === "routine"),
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
    if (window.matchMedia?.("(pointer: coarse)").matches) this.host.shadowRoot.activeElement?.blur();
    this.load();
    this.startPoll();
  }

  // Reiter "System": die Einträge ändern sich laufend (Debug), das Fenster fragt alle 4 Sekunden nach, nicht mitten in einer Berührung
  startPoll() {
    this.stopPoll();
    if (this.s?.kind !== "system") return;
    this._poll = window.setInterval(() => this.pollOnce(), POLL_MS);
  }

  pollOnce() {
    const dlg = this.dlg;
    if (!this.s || this.s.kind !== "system" || !dlg?.open || this.s.view !== "list" || this.host._dlgBusy?.(dlg)) return;
    this.load(true);
  }

  stopPoll() {
    window.clearInterval(this._poll);
    this._poll = null;
  }

  // Name des Geräts (oder der Sammelstelle Szenen/Gruppen) für die Unterzeile
  deviceName(id) {
    if (id === "@scenes") return this.t("rtHolderScenes");
    if (id === "@groups") return this.t("rtHolderGroups");
    return this.host._devices?.find((d) => d.id === id)?.name || "";
  }

  close() {
    window.clearTimeout(this._searchTimer);
    this.stopPoll();
    const dlg = this.dlg;
    if (dlg?.open) {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }
  }

  bind(dlg) {
    this.host._trackBusy?.(dlg);
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
      if (s && el.matches?.("[data-pr-debug]")) {
        this.setDebug(el.checked);
        return;
      }
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

  async setDebug(on) {
    const s = this.s;
    if (!s) return;
    try {
      const r = await this.host._callWithTimeout({ type: "device_panel/set_log", debug: on }, 10000);
      this.host._debugOn = Boolean(r.debug);
      this.host._apps?.paintDots?.();
      s.error = null;
    } catch (err) {
      s.error = this.h.errText(err);
    }
    this.load();
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

  async load(soft = false) {
    const s = this.s;
    if (!s) return;
    const seq = ++s.seq;
    const { since, until } = this.span();
    const msg = { type: "device_panel/protocol_get", kind: s.kind, ...(since === null ? {} : { since }), until, limit: s.limit, filter: s.filter === "all" ? null : s.filter, q: s.q.trim() };
    const items = s.kind === "magic" || s.kind === "routine";
    if (s.kind === "system") {
      // Kategorie des Reiters "System"; ohne Gerät und ohne Auswahl einer Meldung
      if (s.item) msg.cat = s.item;
    } else {
      if (s.deviceId) msg.device_id = s.deviceId;
      if (items && s.item) msg.item_ids = [s.item];
    }
    if (!soft) {
      s.loading = true;
      this.renderFoot();
    }
    try {
      const r = await this.host._hass.callWS(msg);
      if (this.s !== s || seq !== s.seq) return;
      // Nachfrage ohne Änderung: nichts neu zeichnen (Auswahl und Scrollstand bleiben)
      if (soft && s.data && JSON.stringify({ ...r, now: 0, until: 0 }) === s.stamp) return;
      s.stamp = JSON.stringify({ ...r, now: 0, until: 0 });
      s.data = r;
      s.error = null;
      if (s.kind === "system") this.host._debugOn = Boolean(r.debug);
      // Auswahl der Meldungen oder Routinen: die Liste des ganzen Bereichs (Gerät oder alle Geräte) aus der Antwort merken
      const fresh = items && JSON.stringify(s.items) !== JSON.stringify(r.items || []);
      if (items) s.items = r.items || [];
      // Listen "Alles" und "System": die Chips zeigen die Zahlen aus der Antwort
      if (fresh || s.kind === "all" || s.kind === "system") this.renderBar();
    } catch (err) {
      if (this.s !== s || seq !== s.seq) return;
      if (soft) return;
      // Die gewählte Meldung oder Routine gibt es nicht mehr: Auswahl aufheben und neu laden
      if (items && s.item && /not.?found/i.test(`${err?.code || ""} ${err?.message || ""}`)) {
        s.item = "";
        this.renderBar();
        return this.load();
      }
      s.error = this.h.errText(err);
    }
    s.loading = false;
    const body = this.dlg?.querySelector("[data-pr-body]");
    const keep = soft && body ? body.scrollTop : null;
    this.render();
    if (keep !== null) this.dlg.querySelector("[data-pr-body]").scrollTop = keep;
  }

  // --- Zeichnen ------------------------------------------------------------------

  frame() {
    const dlg = this.dlg;
    const s = this.s;
    const t = (k, ...a) => this.t(k, ...a);
    const icon = s.kind === "all" || s.kind === "system" ? "log" : s.kind === "magic" ? "bell" : "timer";
    dlg.innerHTML = `<div class="dlg-head"><span class="dlg-avatar">${this.h.mdi(icon, 28)}</span>
        <div class="dlg-title"><h2>${this.esc(t("prTitle"))}</h2><div class="dlg-sub" data-pr-sub></div></div>
        <button type="button" class="dlg-close" data-pr="close" title="${this.esc(t("close"))}" aria-label="${this.esc(t("close"))}">${this.h.mdi("close", 18)}</button></div>
      <div class="lg-bar" data-pr-bar>
        <div data-pr-kinds></div>
        <div data-pr-ranges></div>
        <div class="pr-dates" data-pr-dates></div>
        <label class="list-search lg-search">${this.h.mdi("search", 18)}<input type="search" data-pr-search placeholder="${this.esc(t("prSearch"))}" aria-label="${this.esc(t("prSearch"))}" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="100">${this.host._fieldClearHtml("data-fc", "", "")}</label>
        <div class="lg-chips" data-pr-filters></div>
        <div class="lg-chips" data-pr-items></div>
        <label class="lg-check" data-pr-debug-row hidden></label>
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
    let text = s.name || this.t("prAllDevices");
    if (s.kind === "system") {
      const since = s.data?.since ? this.host._fmtDateY(s.data.since) : "";
      sub.textContent = this.t("prSystemSub", since);
      return;
    }
    if (s.kind === "magic" || s.kind === "routine") {
      const base = s.deviceId ? this.deviceName(s.deviceId) || s.name || this.t("prAllDevices") : this.t("prAllDevices");
      text = s.items.length ? `${base} · ${this.t(s.kind === "magic" ? "prItemsMagic" : "prItemsRoutine", s.items.length)}` : base;
    }
    sub.textContent = text;
  }

  // Zeitraum, Daten, Auswahl: ohne das Suchfeld, damit Fokus und Cursor beim Tippen bleiben
  renderBar() {
    const s = this.s;
    const dlg = this.dlg;
    const t = (k, ...a) => this.t(k, ...a);
    if (!s || !dlg) return;
    const kinds = dlg.querySelector("[data-pr-kinds]");
    const kindTab = (id, key) => `<button type="button" class="sub-tab${s.kind === id ? " on" : ""}" data-set="pr-kind" data-pr="kind" data-v="${id}">${this.esc(t(key))}</button>`;
    kinds.hidden = false;
    kinds.innerHTML = `<div class="sub-tabs mg-filter" role="group">${kindTab("all", "prTabAll")}${kindTab("magic", "mgTab")}${kindTab("routine", "rtTab")}${s.deviceId ? "" : kindTab("system", "prTabSystem")}</div>`;
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
    // Listen "Alles" und "System": nur Kategorien mit Einträgen im Zeitraum (die Zahlen kommen vom Server), die gewählte bleibt immer
    const counts = s.data?.counts || {};
    const filterBox = dlg.querySelector("[data-pr-filters]");
    if (s.kind === "system") {
      const lv = s.data?.levels || {};
      const levelIds = FILTERS.system.filter((id) => id !== "debug" || s.data?.debug || lv.debug || s.filter === "debug");
      const total = Object.values(lv).reduce((n, v) => n + v, 0);
      filterBox.innerHTML = levelIds
        .map((id) => {
          const n = id === "all" ? total : lv[id] || 0;
          const dot = id === "all" ? "" : `<span class="lg-dot ${id}"></span>`;
          return `<button type="button" class="chip${s.filter === id ? " on" : ""}" data-pr="filter" data-v="${id}" aria-pressed="${s.filter === id}">${dot}<span>${this.esc(id === "all" ? t("logAll") : t(`logLevel_${id}`))}</span><span class="n">${this.num(n)}</span></button>`;
        })
        .join("");
    } else {
      const ids = s.kind === "all" ? FILTERS.all.filter((id) => id === "all" || counts[id] || s.filter === id) : FILTERS[s.kind];
      const chips = ids.map((id) => {
        const label = s.kind === "all" && id !== "all" ? `${t(`prC_${id}`)} ${this.num(counts[id] || 0)}` : t(`prF_${id}`);
        return `<button type="button" class="chip${s.filter === id ? " on" : ""}" data-pr="filter" data-v="${id}" aria-pressed="${s.filter === id}"><span>${this.esc(label)}</span></button>`;
      });
      filterBox.innerHTML = chips.join("");
    }
    this.renderDebug();
    // Meldungen eines Geräts: zusätzlich die Auswahl der einzelnen Meldung oder Routine
    const items = dlg.querySelector("[data-pr-items]");
    if (s.kind === "system") {
      const cs = s.data?.cats || {};
      const ids = [...SYSTEM_CATS, ...Object.keys(cs).filter((c) => !SYSTEM_CATS.includes(c))].filter((c) => cs[c] || s.item === c);
      const total = Object.values(cs).reduce((n, v) => n + v, 0);
      items.hidden = false;
      items.innerHTML = [["", t("logAll"), total], ...ids.map((c) => [c, this.catLabel(c), cs[c] || 0])]
        .map(([id, label, n]) => `<button type="button" class="chip${s.item === id ? " on" : ""}" data-pr="item" data-v="${this.esc(id)}" aria-pressed="${s.item === id}"><span>${this.esc(label)}</span><span class="n">${this.num(n)}</span></button>`)
        .join("");
    } else if ((s.kind === "magic" || s.kind === "routine") && s.deviceId && (s.items.length > 1 || (s.keepChips && s.items.length))) {
      // Am Gerät: "Alle ..." und je eine Meldung oder Routine; die gewählte ist markiert, ein Tipp auf "Alle" hebt den Filter auf
      const all = t(s.kind === "magic" ? "prAllMagic" : "prAllRoutines");
      items.hidden = false;
      items.innerHTML = [["", all], ...s.items.map((i) => [i.id, i.name])]
        .map(([id, label]) => `<button type="button" class="chip${s.item === id ? " on" : ""}" data-pr="item" data-v="${this.esc(id)}" aria-pressed="${s.item === id}"><span>${this.esc(label)}</span></button>`)
        .join("");
    } else if ((s.kind === "magic" || s.kind === "routine") && !s.deviceId && (s.items.length > 1 || s.item || (s.keepChips && s.items.length))) {
      // Über alle Geräte zu viele Namen für eine Chip-Reihe: ein Chip öffnet die Auswahl (wie "Integration" in der Geräteliste)
      const magic = s.kind === "magic";
      const cur = s.items.find((i) => i.id === s.item);
      const label = cur ? `${t(magic ? "prPickMagic" : "prPickRoutine")}: ${cur.name}` : t(magic ? "prPickMagic" : "prPickRoutine");
      const rows = [["", t(magic ? "prAllMagic" : "prAllRoutines"), ""], ...s.items.map((i) => [i.id, i.name, this.deviceName(i.device_id)])]
        .map(([id, name, dev]) => `<button type="button" class="pr-pick-row${s.item === id ? " on" : ""}" role="option" aria-selected="${s.item === id}" data-pr="item" data-v="${this.esc(id)}"><span class="pr-pick-box">${s.item === id ? this.h.mdi("check", 14) : ""}</span><span class="pr-pick-name">${this.esc(name)}${dev ? `<small>${this.esc(dev)}</small>` : ""}</span></button>`)
        .join("");
      items.hidden = false;
      items.innerHTML = `<div class="pr-pick-wrap"><button type="button" class="chip pr-pick-chip${s.item ? " on" : ""}" data-pr="pick" aria-haspopup="listbox" aria-expanded="${s.pickOpen}"><span>${this.esc(label)}</span>${this.h.mdi("chevronDown", 15)}</button>${s.pickOpen ? `<div class="pr-pick" role="listbox">${rows}</div>` : ""}</div>`;
    } else {
      items.hidden = true;
      items.innerHTML = "";
    }
  }

  catLabel(c) {
    const v = this.t(`logCat_${c}`);
    return v && v !== `logCat_${c}` ? v : c;
  }

  // Debug-Schalter (nur Reiter "System"): gilt für das ganze Panel, 48 Stunden, auch über Neustarts von Home Assistant
  renderDebug() {
    const row = this.dlg?.querySelector("[data-pr-debug-row]");
    const s = this.s;
    if (!row) return;
    if (s.kind !== "system") {
      row.hidden = true;
      row.innerHTML = "";
      return;
    }
    const d = s.data || {};
    const t = (k, ...a) => this.t(k, ...a);
    row.hidden = false;
    row.title = t("logDebugHint");
    const note = d.debug && d.debug_until ? t("logDebugUntil", this.host._fmtTime(d.debug_until, true)) : t("logDebugFor");
    const html = `<input type="checkbox" data-pr-debug${d.debug ? " checked" : ""}><span>${this.esc(t("logDebug"))}</span><small>${this.esc(note)}</small>`;
    if (row.innerHTML !== html) row.innerHTML = html;
  }

  // Zeile des Reiters "System": Zeit, Stufe, Kategorie, Text; mit Gerät ein Tipp öffnet das Gerät
  sysRow(e) {
    const t = (k, ...a) => this.t(k, ...a);
    const open = e.device_id && this.host._devices?.some((x) => x.id === e.device_id);
    const tag = open ? "button" : "div";
    return `<${tag}${open ? ` type="button" data-pr="device" data-id="${this.esc(e.device_id)}"` : ""} class="lg-row${open ? " has-chev" : ""} ${this.esc(e.level)}" role="listitem">
      <span class="lg-rt">${this.esc(this.host._logTime(e))}</span><span class="lg-lv"><span class="lg-dot ${this.esc(e.level)}" title="${this.esc(t(`logLevel_${e.level}`))}"></span></span>
      <span class="lg-cat"><span class="lg-pill ${this.esc(e.cat)}">${this.esc(this.catLabel(e.cat))}</span></span>
      <span class="lg-msg">${e.title ? `<b>${this.esc(e.title)}</b> · ` : ""}${this.esc(e.text)}${e.detail ? `<small>${this.esc(e.detail)}</small>` : ""}</span>${open ? `<span class="al-chev" aria-hidden="true">${this.h.mdi("chevronRight", 18)}</span>` : ""}</${tag}>`;
  }

  systemHtml(d) {
    const s = this.s;
    const t = (k, ...a) => this.t(k, ...a);
    let day = "";
    const rows = (d.entries || [])
      .map((e) => {
        const label = this.host._logDay(e);
        const head = label === day ? "" : `<div class="lg-day" role="presentation">${this.esc(label)}</div>`;
        day = label;
        return head + this.sysRow(e);
      })
      .join("");
    const filtered = s.filter !== "all" || Boolean(s.item) || Boolean(s.q.trim());
    const empty = d.entries.length ? "" : `<p class="dlg-note lg-none">${this.esc(t(d.all || filtered ? "logNoneFilter" : "logNone"))}</p>`;
    let more = "";
    if (d.total > d.entries.length) {
      more = d.entries.length >= LIMIT_MAX ? `<p class="mg-hint">${this.esc(t("prCutoff", LIMIT_MAX, this.num(d.total)))}</p>` : `<button type="button" class="qbtn pr-more" data-pr="more">${this.esc(t("prMore"))}</button>`;
    }
    const err = s.error ? `<div class="dlg-error">${this.esc(t("prError", s.error))}</div>` : "";
    return `${err}<div class="pr-list" role="list">${rows}</div>${empty}${more}<p class="pr-note">${this.esc(t("prSystemNote", this.num(d.max)))}</p>`;
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
        <span class="c-val${hasMsg ? " has-arrow" : ""}"><span>${this.esc(e.value || "–")}</span>${hasMsg ? `<span class="pr-arrow" aria-hidden="true">${this.h.mdi("chevronDown", 18)}</span>` : ""}</span></button>${msg}</div>`;
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
    if (s.kind === "all") {
      body.innerHTML = this.allHtml(d);
      return;
    }
    if (s.kind === "system") {
      body.innerHTML = this.systemHtml(d);
      return;
    }
    const device = Boolean(s.deviceId && !s.item);
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

  // --- Liste "Alles" (Geräteprotokoll) ------------------------------------------------

  // Text der Zeile je Quelle: [Titel, Zeile darunter]; Magic Push und Routinen zeigen ihre Ergebnisse wie in den eigenen Reitern
  allText(e) {
    const t = (k, ...a) => this.t(k, ...a);
    if (e.source === "avail") {
      const dur = e.k === "online" && e.dur ? t("prDur", this.host._fmtSeconds(e.dur)) : "";
      return [t(e.k === "online" ? "prAvOnline" : "prAvOffline"), dur];
    }
    if (e.source === "magic") {
      const [res] = this.magicResult(e);
      return [e.title || e.name || "", [this.magicKind(e), res, e.value, e.target && e.res === "sent" ? `→ ${e.target}` : ""].filter(Boolean).join(" · ")];
    }
    if (e.source === "routine") {
      const [res] = this.routineResult(e);
      const err = e.err ? ` (${this.host._t(`rtReason_${e.err}`) || e.err})` : "";
      return [[e.name, this.actText(e)].filter(Boolean).join(": "), [this.t(`prSrc_${e.src}`) || e.src || "", `${res}${err}`].filter(Boolean).join(" · ")];
    }
    return [e.text || "", e.detail || ""];
  }

  allRow(e, global) {
    const s = this.s;
    const [title, line] = this.allText(e);
    const time = this.host._logTime(e);
    const who = global && e.dname ? `<small>${this.esc(e.dname)}</small>` : "";
    const cls = e.source === "event" && (e.level === "warning" || e.level === "error") ? ` ${e.level}` : "";
    const pill = `<span class="lg-pill ${this.esc(e.cat)}">${this.esc(this.t(`prC_${e.cat}`))}</span>`;
    const main = `<span class="lg-msg"><b>${this.esc(title)}</b>${line ? `<small>${this.esc(line)}</small>` : ""}${who}</span>`;
    const head = `<span class="lg-rt">${this.esc(time)}</span><span>${pill}</span>${main}`;
    // Pfeil am Zeilenende (seit 2.127.0): zeigt, dass man die Zeile antippen kann; aufklappbar: nach unten (offen: nach oben), Ablauf oder Gerät: nach rechts
    const arrow = (name) => `<span class="al-chev" aria-hidden="true">${this.h.mdi(name, 18)}</span>`;
    if (e.source === "routine") return `<div class="pr-item" role="listitem"><button type="button" class="lg-row al-row has-chev${cls}" data-pr="trace" data-i="${s.data.entries.indexOf(e)}">${head}${arrow("chevronRight")}</button></div>`;
    if (e.source === "magic") {
      const key = `${e.id}|${e.at}`;
      const open = s.open.has(key);
      const body = String(e.body || "");
      const msg = open && (e.title || body) ? `<div class="pr-msg"><b>${this.esc(e.title || "")}</b>${body ? `<span>${this.esc(body)}</span>` : ""}</div>` : "";
      return `<div class="pr-item${open ? " open" : ""}" role="listitem"><button type="button" class="lg-row al-row has-chev${cls}" data-pr="row" data-key="${this.esc(key)}" aria-expanded="${open}">${head}${arrow("chevronDown")}</button>${msg}</div>`;
    }
    if (e.push) {
      // Gesendete Meldung (seit 2.122.0): ein Tipp zeigt, an wen was ging und mit welchem Ergebnis
      const key = `push|${e.at}|${e.dev || ""}|${e.cat}`;
      const open = s.open.has(key);
      return `<div class="pr-item${open ? " open" : ""}" role="listitem"><button type="button" class="lg-row al-row has-chev${cls}" data-pr="row" data-key="${this.esc(key)}" aria-expanded="${open}">${head}${arrow("chevronDown")}</button>${open ? this.pushHtml(e.push) : ""}</div>`;
    }
    return `<div class="pr-item" role="listitem"><div class="lg-row al-row${cls}">${head}</div></div>`;
  }

  // Inhalt einer gesendeten Meldung: Titel, Text, Ziel und Ergebnis
  pushHtml(p) {
    const t = (k, ...a) => this.t(k, ...a);
    const res = t(`prPushRes_${p.res}`) || p.res || "";
    const line = [res, p.target ? t("prPushTo", p.target) : ""].filter(Boolean).join(" · ");
    return `<div class="pr-msg"><b>${this.esc(p.title || "")}</b>${p.body ? `<span>${this.esc(p.body)}</span>` : ""}${line ? `<small>${this.esc(line)}</small>` : ""}</div>`;
  }

  allHtml(d) {
    const s = this.s;
    const t = (k, ...a) => this.t(k, ...a);
    const global = !s.deviceId;
    let day = "";
    const rows = (d.entries || [])
      .map((e) => {
        const label = this.host._logDay(e);
        const head = label === day ? "" : `<div class="lg-day">${this.esc(label)}</div>`;
        day = label;
        return head + this.allRow(e, global);
      })
      .join("");
    const filtered = s.filter !== "all" || Boolean(s.q.trim());
    const empty = d.entries.length ? "" : `<p class="mg-empty">${this.esc(t(d.all || filtered ? "prEmpty" : "prNone"))}</p>`;
    let more = "";
    if (d.total > d.entries.length) {
      more = d.entries.length >= LIMIT_MAX ? `<p class="mg-hint">${this.esc(t("prCutoff", LIMIT_MAX, this.num(d.total)))}</p>` : `<button type="button" class="qbtn pr-more" data-pr="more">${this.esc(t("prMore"))}</button>`;
    }
    const err = s.error ? `<div class="dlg-error">${this.esc(t("prError", s.error))}</div>` : "";
    const note = d.oldest ? `<p class="pr-note">${this.esc(t("prOldest", this.host._fmtDateY(d.oldest)))} ${this.esc(t("prAllNote"))}</p>` : `<p class="pr-note">${this.esc(t("prAllNote"))}</p>`;
    return `${err}${this.chart(d)}<div class="pr-list" role="list">${rows}</div>${empty}${more}${note}`;
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
        ${s.kind === "all" ? "" : `<button type="button" class="lg-btn" data-pr="newer"${s.trace <= 0 ? " disabled" : ""}>${this.esc(t("prNewer"))}</button>
        <button type="button" class="lg-btn" data-pr="older"${s.trace >= n - 1 ? " disabled" : ""}>${this.esc(t("prOlder"))}</button>`}
        <button type="button" class="lg-btn" data-pr="copy-trace">${mdi("copy", 16)}<span>${this.esc(s.flash || t("prTraceCopy"))}</span></button>`;
      return;
    }
    const d = s.data;
    const count = s.loading && !d ? t("prLoading") : d ? t("prShown", d.entries.length, this.num(d.total)) : "";
    foot.innerHTML = `<button type="button" class="lg-btn" data-pr="close">${mdi("arrowLeft", 16)}<span>${this.esc(t("prBack"))}</span></button><span class="pr-count">${this.esc(count)}</span><span class="sp"></span>
      <button type="button" class="lg-btn" data-pr="copy"${d?.entries?.length ? "" : " disabled"}>${mdi("copy", 16)}<span>${this.esc(s.flash || t("prCopyText"))}</span></button>${s.kind === "system" ? `<button type="button" class="lg-btn" data-pr="clear-log">${this.esc(t("logClear"))}</button>` : ""}`;
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
        if (s.kind === "system") {
          const d = new Date(e.at * 1000);
          const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${d.toTimeString().slice(0, 8)}`;
          return `${stamp} [${e.level.toUpperCase()}] [${this.catLabel(e.cat)}] ${e.title ? `${e.title}: ` : ""}${e.text}${e.detail ? ` (${e.detail})` : ""}`;
        }
        if (s.kind === "all") {
          const [title, line] = this.allText(e);
          return [this.fmtStamp(e.at), this.t(`prC_${e.cat}`), e.dname || "", title, line].filter((x, i) => x || i < 2).join(" | ");
        }
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
      case "kind": {
        const next = s.alt[el.dataset.v];
        if (!next || el.dataset.v === s.kind) break;
        // Den bisherigen Zusammenhang merken: zurück gibt es wieder die einzelne Meldung oder Routine
        s.alt[s.kind] = { itemId: s.kind === "magic" || s.kind === "routine" ? s.item : "", deviceId: s.deviceId, name: s.name };
        // "System" beginnt mit "Alle"; beim Verlassen kommt der vorherige Zeitraum zurück
        if (el.dataset.v === "system") Object.assign(s, { rangeBack: s.range, range: "all" });
        else if (s.kind === "system") s.range = s.rangeBack || "30d";
        Object.assign(s, { kind: el.dataset.v, itemId: "", deviceId: next.deviceId, name: next.name, filter: "all", item: el.dataset.v === "magic" || el.dataset.v === "routine" ? next.itemId : "", pickOpen: false, items: [], q: "", limit: PAGE, data: null, loading: true, error: null, view: "list", trace: 0, open: new Set() });
        window.clearTimeout(this._searchTimer);
        this.frame();
        this.load();
        this.startPoll();
        break;
      }
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
      case "pick":
        s.pickOpen = !s.pickOpen;
        this.renderBar();
        break;
      case "item":
        s.item = el.dataset.v;
        s.pickOpen = false;
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
        // Geöffnet am unteren Rand: den Inhalt ins Bild holen, sonst bleibt er unter dem Fuss verborgen
        if (s.open.has(key)) [...this.dlg.querySelectorAll(".pr-item.open")].find((it) => it.querySelector(`[data-key="${CSS.escape(key)}"]`))?.scrollIntoView({ block: "nearest" });
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
      case "device":
        // Das Geräte-Popup öffnet über dem Protokoll; schliesst es, ist man wieder hier
        this.host._openDevice(el.dataset.id);
        break;
      case "clear-log":
        // Leeren ist endgültig (auch die gespeicherten Einträge): erst fragen
        this.host._askConfirm({ title: "logClearTitle", note: "logClearNote", no: "logClearNo", yes: "logClearYes", noIcon: "close", yesIcon: "trash" }, async () => {
          try {
            await this.host._hass.callWS({ type: "device_panel/clear_log" });
          } catch (err) {
            s.error = this.h.errText(err);
          }
          this.load();
        });
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
