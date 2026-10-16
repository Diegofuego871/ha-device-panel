/**
 * App "Status" (seit 2.62.0, docs/mockups/status-v1, Variante A): Läuft die Integration? Oben der kleine Config-Teil (Meldung bei
 * Stillstand: Schalter und Empfänger als Auswahlliste wie bei den Reitern der Einstellungen), darunter der Zustand der Teile (läuft,
 * verspätet, steht) und die Zeile zum letzten Start. Die Zahlen kommen von device_panel/status_get (status.py), die Einstellungen
 * lesen und schreiben get_options / set_options; das Fenster fragt alle 10 Sekunden neu, solange es offen ist.
 * Seit 2.68.0 zeigt der Abschnitt "System" CPU, Arbeitsspeicher und Festplatte als kleine Kurven (system_stats.py, device_panel/status_system).
 * Seit 2.72.0 hat die App Reiter, seit 2.73.0 drei: "Dienste" (die Teile der Integration), "System" (CPU, Arbeitsspeicher, Festplatte als
 * Kurven) und "Einstellungen" (Meldungen, Grenzen, Quelle der Werte). Die Einstellungen sind ein Entwurf (this.draft) und gelten erst nach
 * "Speichern"; beim Schliessen mit Änderungen fragt die App nach. Die Systemwerte werden nur geholt, solange "System" oder "Einstellungen" offen ist.
 */

const REFRESH_MS = 10000;
// Systemwerte (CPU, RAM, Festplatte): alle 60 Sekunden neu, nicht bei jedem Takt des Fensters
const SYS_EVERY = 6;
const SYS_RANGES = ["24h", "30d", "6m", "1y"];
// Höchstens so viele Sensoren zeigt die Auswahl auf einmal (der Rest folgt nach der Eingabe)
const PICK_MAX = 60;
const LOAD_KINDS = ["cpu", "ram", "disk"];
// Mindestdauer der Meldung bei hoher Auslastung (seit 2.74.0): Zahl der Prüfungen in Folge (eine je Minute)
const MINUTES_KEY = "status_load_minutes";
const STATE_TABS = ["services", "system", "settings"];
const SYS_OPTION = { cpu: "status_cpu_entity", ram: "status_ram_entity", disk: "status_disk_entity" };
const PART_ORDER = ["routines", "magic", "availability", "battery", "charge", "new", "updates", "signal"];

export class StatusUi {
  constructor(host, deps) {
    this.host = host;
    this.h = deps;
    this.data = null;
    this.cfg = null;
    this.error = null;
    this.saving = false;
    // Entwurf der Einstellungen: nur die geänderten Optionen (Schlüssel wie in set_options); Grenzen bleiben als getippter Text stehen
    this.draft = {};
    this._timer = null;
    // System: Antwort von status_system, Zeitraum der Festplatte, Zähler für das Nachladen
    this.sys = null;
    this.sysError = null;
    this.range = "24h";
    this._ticks = 0;
    // Neustart von Hand (seit 2.63.0): confirm = Teil mit offener Rückfrage, busy = Teil, der gerade neu startet, flash = Hinweis danach
    this.ui = { confirm: null, busy: null, flash: "", flashTimer: null, pick: null, pickQ: "", enabled: {}, enabling: null, enableAsk: null, tab: "services", saved: false, saveError: "" };
  }

  t(key, ...args) {
    return this.host._t(key, ...args);
  }

  get dlg() {
    return this.host.shadowRoot.querySelector("dialog.status-dlg");
  }

  // --- Öffnen und Schliessen ---------------------------------------------------

  // tab: Reiter beim frischen Öffnen (Meldung bei hoher Auslastung öffnet "system"); sonst "services"
  open(tab = "services") {
    const dlg = this.dlg;
    if (!dlg) return;
    if (!dlg.open) {
      this.resetDraft();
      this.ui.tab = STATE_TABS.includes(tab) ? tab : "services";
    }
    this.frame();
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    this.load();
    if (this.ui.tab !== "services") this.loadSystem();
    this._ticks = 0;
    window.clearInterval(this._timer);
    this._timer = window.setInterval(() => {
      // Nichts holen, solange das Panel verdeckt ist (wie die Liste der Geräte); beim Zurückkehren kommt der nächste Takt
      if (document.visibilityState === "hidden") return;
      this.load();
      if (++this._ticks % SYS_EVERY === 0 && this.ui.tab !== "services") this.loadSystem();
    }, REFRESH_MS);
  }

  close() {
    window.clearInterval(this._timer);
    this._timer = null;
    this.resetDraft();
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
        if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) this.guard(() => this.close());
        return;
      }
      if (ev.target.closest("[data-st-close]")) return this.guard(() => this.close());
      if (ev.target.closest("[data-st-add]")) {
        // Die Seite "Integration hinzufügen" von Home Assistant, gleich bei "System Monitor" (nur öffnen, nichts wird geändert)
        this.guard(() => {
          this.close();
          this.host._navigate?.("/config/integrations/dashboard/add?domain=systemmonitor");
        });
        return;
      }
      const tab = ev.target.closest("[data-st-tab]");
      if (tab) {
        if (STATE_TABS.includes(tab.dataset.stTab) && tab.dataset.stTab !== this.ui.tab) {
          this.ui.tab = tab.dataset.stTab;
          this.ui.pick = null;
          this.ui.pickQ = "";
          const sc = this.dlg.querySelector(".dlg-body");
          this.render(true);
          if (sc) sc.scrollTop = 0;
          // Systemwerte erst jetzt holen (im Reiter "Dienste" braucht man sie nicht)
          if (this.ui.tab !== "services") this.loadSystem();
        }
        return;
      }
      if (ev.target.closest("[data-st-save]")) return this.saveAll();
      if (ev.target.closest("[data-st-discard]")) {
        this.resetDraft();
        this.render(true);
        return;
      }
      // Einschalten mit Rückfrage: erst nennt die App, was geändert wird, dann der Knopf "Einschalten"
      const enableAsk = ev.target.closest("[data-st-enable-ask]");
      if (enableAsk) {
        this.ui.enableAsk = enableAsk.dataset.stEnableAsk;
        this.render();
        return;
      }
      if (ev.target.closest("[data-st-enable-no]")) {
        this.ui.enableAsk = null;
        this.render();
        return;
      }
      const enable = ev.target.closest("[data-st-enable]");
      if (enable) return this.enable(enable.dataset.stEnable);
      const pick = ev.target.closest("[data-st-pick]");
      if (pick) {
        const kind = pick.dataset.stPick;
        this.ui.pick = this.ui.pick === kind ? null : kind;
        this.ui.pickQ = "";
        this.render();
        if (this.ui.pick) this.dlg.querySelector("[data-st-pickq]")?.focus();
        return;
      }
      const choose = ev.target.closest("[data-st-choose]");
      if (choose) return this.choose(choose.dataset.stKind, choose.dataset.stChoose);
      const range = ev.target.closest("[data-st-range]");
      if (range) {
        if (SYS_RANGES.includes(range.dataset.stRange) && range.dataset.stRange !== this.range) {
          this.range = range.dataset.stRange;
          this.loadSystem();
        }
        return;
      }
      const ask = ev.target.closest("[data-st-restart]");
      const yes = ev.target.closest("[data-st-restart-yes]");
      if (ask) this.ui.confirm = ask.dataset.stRestart;
      else if (ev.target.closest("[data-st-restart-no]")) this.ui.confirm = null;
      else if (yes) return this.restart(yes.dataset.stRestartYes);
      else return;
      this.render();
    });
    dlg.addEventListener("input", (ev) => {
      // Suche in der Sensor-Auswahl: nur die Liste neu zeichnen, damit das Feld den Fokus behält
      if (ev.target.matches?.("[data-st-pickq]")) {
        this.ui.pickQ = ev.target.value;
        const list = this.dlg.querySelector("[data-st-picklist]");
        if (list && this.ui.pick) list.innerHTML = this.pickListHtml(this.ui.pick);
      } else if (ev.target.matches?.("[data-st-limit]") && LOAD_KINDS.includes(ev.target.dataset.stLimit)) {
        // Grenze: beim Tippen nur den Entwurf und die Leiste unten nachführen (das Feld behält den Fokus), Fehler zeigt "change"
        this.setDraft(`status_${ev.target.dataset.stLimit}_limit`, ev.target.value);
        this.renderFoot();
      } else if (ev.target.matches?.("[data-st-minutes]")) {
        this.setDraft(MINUTES_KEY, ev.target.value);
        this.renderFoot();
      }
    });
    // Esc: wie Schliessen (mit Rückfrage, wenn Änderungen offen sind)
    dlg.addEventListener("cancel", (ev) => {
      ev.preventDefault();
      this.guard(() => this.close());
    });
    dlg.addEventListener("change", (ev) => {
      const el = ev.target;
      if (el.matches("[data-st-notify]")) this.setDraft("status_notify", el.checked);
      else if (el.matches("[data-st-target]")) this.setDraft("notify_service_status", el.value);
      else if (el.matches("[data-st-alert]") && LOAD_KINDS.includes(el.dataset.stAlert)) this.setDraft(`status_${el.dataset.stAlert}_alert`, el.checked);
      else if (el.matches("[data-st-limit]") && LOAD_KINDS.includes(el.dataset.stLimit)) this.setDraft(`status_${el.dataset.stLimit}_limit`, el.value);
      else if (el.matches("[data-st-minutes]")) this.setDraft(MINUTES_KEY, el.value);
      else return;
      this.render(true);
    });
  }

  // --- Laden und Speichern -----------------------------------------------------

  async load() {
    const call = (msg) => this.host._hass.callWS(msg);
    try {
      const [snap, opts] = await Promise.all([call({ type: "device_panel/status_get" }), call({ type: "device_panel/get_options" })]);
      this.data = snap;
      this.cfg = { values: opts.values, targets: opts.notify_targets || [], limits: opts.limits || {} };
      this.error = null;
      this.host._statusSum = { problems: snap.problems, down: snap.down };
      this.host._apps?.paintDots();
    } catch (err) {
      this.error = this.h.errText(err);
    }
    this.render();
  }

  // CPU, Arbeitsspeicher, Festplatte (status_system); der Zeitraum gilt nur für die Festplatte
  async loadSystem() {
    const range = this.range;
    try {
      const res = await this.host._hass.callWS({ type: "device_panel/status_system", range });
      if (range !== this.range) return;
      this.sys = res;
      this.sysError = null;
      // "Eingeschaltet"-Hinweis nur, solange die Sensoren noch fehlen; sind sie da (oder fehlt nichts mehr), gilt er nicht mehr
      for (const m of res.metrics) if (!m.disabled?.length) delete this.ui.enabled[m.id];
    } catch (err) {
      this.sysError = this.h.errText(err);
    }
    this.render();
  }

  // Ausgeschaltete Sensoren einschalten (nur auf Knopfdruck, nur System Monitor und Supervisor); HA lädt die Integration von selbst neu
  async enable(kind) {
    if (this.ui.enabling) return;
    this.ui.enabling = kind;
    this.ui.enableAsk = null;
    this.render();
    try {
      await this.host._hass.callWS({ type: "device_panel/status_system_enable", kind });
      this.ui.enabled[kind] = true;
      this.sysError = null;
      // Die Integration lädt nach etwa 30 Sekunden neu; danach einmal nachsehen (sonst beim nächsten Takt)
      window.setTimeout(() => this.dlg?.open && this.loadSystem(), 45000);
    } catch (err) {
      this.sysError = this.h.errText(err);
    }
    this.ui.enabling = null;
    this.render();
  }

  // Sensor für eine Art wählen ("" = automatisch); gilt erst nach "Speichern"
  choose(kind, entityId) {
    if (!SYS_OPTION[kind]) return;
    this.ui.pick = null;
    this.ui.pickQ = "";
    this.setDraft(SYS_OPTION[kind], entityId);
    this.render(true);
  }

  // --- Entwurf der Einstellungen -----------------------------------------------

  resetDraft() {
    this.draft = {};
    this.ui.saved = false;
    this.ui.saveError = "";
    this.ui.pick = null;
    this.ui.pickQ = "";
  }

  // Wert einer Option: der Entwurf, sonst der gespeicherte Stand
  val(key) {
    return key in this.draft ? this.draft[key] : this.cfg?.values?.[key];
  }

  // Entwurf nachführen; ein Wert, der dem gespeicherten gleicht, ist keine Änderung mehr
  setDraft(key, value) {
    const cur = this.cfg?.values?.[key];
    const same = typeof cur === "number" ? String(value).trim() === String(cur) : value === cur || (cur === undefined && value === "");
    if (same) delete this.draft[key];
    else this.draft[key] = value;
    this.ui.saved = false;
    this.ui.saveError = "";
  }

  changes() {
    return Object.keys(this.draft);
  }

  // Zahl im Entwurf ungültig: leer, keine ganze Zahl oder ausserhalb des erlaubten Bereichs (Grenze 1 bis 100, Mindestdauer 1 bis 60)
  intBad(key, fallback = [1, 100]) {
    if (!(key in this.draft)) return false;
    const [lo, hi] = this.cfg?.limits?.[key] || fallback;
    const text = String(this.draft[key]).trim();
    const n = Number(text);
    return !text || !Number.isInteger(n) || n < lo || n > hi;
  }

  limitBad(kind) {
    return this.intBad(`status_${kind}_limit`);
  }

  minutesBad() {
    return this.intBad(MINUTES_KEY, [1, 60]);
  }

  anyBad() {
    return LOAD_KINDS.some((k) => this.limitBad(k)) || this.minutesBad();
  }

  // Beim Schliessen mit offenen Änderungen fragen (wie im Fenster Einstellungen), sonst gleich ausführen
  guard(run) {
    if (!this.changes().length) return run();
    this.host._askDiscard(() => {
      this.resetDraft();
      run();
    });
  }

  // Alle Änderungen in einem Zug speichern; das Fenster bleibt offen, "Gespeichert" erscheint kurz
  async saveAll() {
    if (this.saving || !this.changes().length || this.anyBad()) return;
    const values = {};
    for (const [key, value] of Object.entries(this.draft)) values[key] = key.endsWith("_limit") || key === MINUTES_KEY ? Number(String(value).trim()) : value;
    this.saving = true;
    this.ui.saveError = "";
    this.render(true);
    try {
      await this.host._hass.callWS({ type: "device_panel/set_options", values });
      this.draft = {};
      this.ui.saved = true;
    } catch (err) {
      this.ui.saveError = this.h.errText(err);
    }
    this.saving = false;
    // Eine neue Quelle ändert die Karten: beides neu holen
    await Promise.all([this.load(), this.loadSystem()]);
    this.render(true);
  }

  // Teil von Hand neu starten (status_restart); danach der neue Stand und ein kurzer Hinweis
  async restart(part) {
    if (this.ui.busy) return;
    this.ui.busy = part;
    this.error = null;
    this.render();
    let failed = null;
    try {
      await this.host._hass.callWS({ type: "device_panel/status_restart", part });
      this.flash(this.t("stRestartDone", this.t(`stPart_${part}`)));
    } catch (err) {
      failed = this.h.errText(err);
    }
    this.ui.busy = null;
    this.ui.confirm = null;
    await this.load();
    // load() räumt den Fehler weg; der des Neustarts bleibt stehen, bis der nächste Abruf (oder Neustart) kommt
    if (failed) {
      this.error = failed;
      this.render();
    }
  }

  flash(text) {
    window.clearTimeout(this.ui.flashTimer);
    this.ui.flash = text;
    this.ui.flashTimer = window.setTimeout(() => {
      this.ui.flash = "";
      this.render();
    }, 8000);
  }

  // --- Anzeige -----------------------------------------------------------------

  frame() {
    const dlg = this.dlg;
    const { escape, mdi } = this.h;
    dlg.innerHTML = `<div class="dlg-head"><span class="dlg-avatar">${mdi("pulse", 28)}</span>
        <div class="dlg-title"><h2>${escape(this.t("stTitle"))}</h2></div>
        <button type="button" class="dlg-close" data-st-close title="${escape(this.t("close"))}" aria-label="${escape(this.t("close"))}">${mdi("close", 18)}</button></div>
      <div class="dlg-body"><div class="st-wrap" data-st-body></div></div><div data-st-foot></div>`;
    this.render();
  }

  render(force = false) {
    const body = this.dlg?.querySelector("[data-st-body]");
    if (!body) return;
    // Auswahl nicht zerstören, solange sie geöffnet ist (Neuzeichnen alle 10 Sekunden)
    if (!force && this.host.shadowRoot.activeElement?.matches?.("[data-st-target], [data-st-pickq], [data-st-limit], [data-st-minutes]")) return;
    const scroll = body.closest(".dlg-body")?.scrollTop || 0;
    body.innerHTML = this.html();
    const sc = body.closest(".dlg-body");
    if (sc) sc.scrollTop = scroll;
    this.renderFoot();
  }

  // Leiste unten mit Speichern: nur im Reiter "Einstellungen", getrennt vom Rest, damit das Tippen in einem Feld sie nachführen kann
  renderFoot() {
    const foot = this.dlg?.querySelector("[data-st-foot]");
    if (!foot) return;
    if (this.ui.tab !== "settings" || !this.cfg) {
      foot.innerHTML = "";
      return;
    }
    const { escape } = this.h;
    const t = (k, ...a) => this.t(k, ...a);
    const n = this.changes().length;
    const bad = this.anyBad();
    const saved = !n && this.ui.saved;
    const status = n ? t("settingsChanges", n) : saved ? t("settingsSavedShort") : "";
    foot.innerHTML = `<div class="dlg-actions"><span class="set-count${saved ? " saved" : ""}" role="status" data-st-count>${escape(status)}</span>
      <button type="button" class="dlg-btn primary" data-st-save ${n && !bad && !this.saving ? "" : "disabled"}>${escape(this.saving ? t("settingsSaving") : t("settingsSave"))}</button>
      ${n ? `<button type="button" class="dlg-btn" data-st-discard>${escape(t("discardYes"))}</button>` : `<button type="button" class="dlg-btn" data-st-close>${escape(t("close"))}</button>`}</div>`;
  }

  targetLabel(x) {
    const t = (k, ...a) => this.t(k, ...a);
    return x.kind === "none" ? t("notifyNone") : x.kind === "entity" ? t("notifyEntity", x.value) : x.kind === "missing" ? t("notifyMissing", x.value) : x.value;
  }

  configHtml() {
    const { escape } = this.h;
    const t = (k, ...a) => this.t(k, ...a);
    if (!this.cfg) return "";
    const v = this.cfg.values;
    const targets = this.cfg.targets.map((x) => [x.value, this.targetLabel(x)]);
    const global = v.notify_service;
    const stdLabel = !global || global === "none" ? t("notifyStdNone") : t("notifyStd", targets.find(([val]) => val === global)?.[1] || global);
    const options = [["", stdLabel], ...targets.filter(([val]) => val !== "none")];
    const own = this.val("notify_service_status") || "";
    // Kein Ziel (weder eigenes noch globales): der Schalter ist an, aber es geht nichts raus. Das soll nicht still bleiben.
    const target = own || global;
    const noTarget = (Boolean(this.val("status_notify")) || LOAD_KINDS.some((k) => this.val(`status_${k}_alert`))) && (!target || target === "none");
    const select = `<span class="opt-select"><select data-st-target aria-label="${escape(t("optNotifyTargetTab"))}">${options
      .map(([val, text]) => `<option value="${escape(val)}"${val === own ? " selected" : ""}>${escape(text)}</option>`)
      .join("")}</select>${this.h.mdi("chevronDown", 18)}</span>`;
    return `<div class="set-title">${escape(t("stCfgTitle"))}</div>
      <div class="opt"><div class="opt-line"><span class="opt-label">${escape(t("stNotify"))}</span>
        <label class="switch"><input type="checkbox" data-st-notify ${this.val("status_notify") ? "checked" : ""} aria-label="${escape(t("stNotify"))}"><span></span></label></div>
        <div class="opt-short">${escape(t("stNotifyShort"))}</div></div>
      <div class="opt"><div class="opt-line"><span class="opt-label">${escape(t("optNotifyTargetTab"))}</span>${select}</div>
        <div class="opt-short">${escape(t("stTargetShort"))}</div>
        ${noTarget ? `<div class="opt-warn" data-st-notarget role="alert">${this.h.mdi("alert", 14)}<span>${escape(t("stNoTarget"))}</span></div>` : ""}</div>`;
  }

  // Meldung bei hoher Auslastung (seit 2.71.0): je Art Schalter und Grenze in Prozent; derselbe Empfänger wie oben
  loadHtml() {
    const { escape } = this.h;
    const t = (k, ...a) => this.t(k, ...a);
    if (!this.cfg) return "";
    const rows = LOAD_KINDS.map((kind) => {
      const name = t(`stSys${kind[0].toUpperCase()}${kind.slice(1)}`);
      const [lo, hi] = this.cfg.limits?.[`status_${kind}_limit`] || [1, 100];
      const err = this.limitBad(kind) ? String(this.draft[`status_${kind}_limit`]) : undefined;
      const metric = this.sys?.metrics?.find((m) => m.id === kind);
      // Nur ein Prozentwert lässt sich mit der Grenze vergleichen; bei einem Sensor in Gigabyte (oder keinem) gibt es keine Meldung
      const noPercent = metric && (!metric.entity_id || metric.mode === "absolute");
      return `<div class="opt${err !== undefined ? " invalid" : ""}"><div class="opt-line"><span class="opt-label">${escape(name)}</span>
          <span class="st-ctl"><span class="opt-input${err !== undefined ? " bad" : ""}"><input type="number" inputmode="numeric" step="1" min="${lo}" max="${hi}" data-st-limit="${kind}" value="${escape(String(this.val(`status_${kind}_limit`)))}" aria-label="${escape(t("stLoadLimit", name))}"><span class="unit">%</span></span>
          <label class="switch"><input type="checkbox" data-st-alert="${kind}" ${this.val(`status_${kind}_alert`) ? "checked" : ""} aria-label="${escape(t("stLoadOn", name))}"><span></span></label></span></div>
          ${err !== undefined ? `<div class="opt-warn" role="alert">${this.h.mdi("alert", 14)}<span>${escape(t("stLoadRange", lo, hi))}</span></div>` : ""}
          ${noPercent && this.val(`status_${kind}_alert`) ? `<div class="opt-short">${escape(t("stLoadNoPercent"))}</div>` : ""}</div>`;
    }).join("");
    // Mindestdauer für alle drei: wie viele Prüfungen (Minuten) in Folge der Wert über der Grenze liegen muss
    const [mlo, mhi] = this.cfg.limits?.[MINUTES_KEY] || [1, 60];
    const mbad = this.minutesBad();
    const minutes = `<div class="opt${mbad ? " invalid" : ""}"><div class="opt-line"><span class="opt-label">${escape(t("stLoadMinutes"))}</span>
        <span class="st-ctl"><span class="opt-input${mbad ? " bad" : ""}"><input type="number" inputmode="numeric" step="1" min="${mlo}" max="${mhi}" data-st-minutes value="${escape(String(this.val(MINUTES_KEY)))}" aria-label="${escape(t("stLoadMinutes"))}"><span class="unit">${escape(t("stLoadMinUnit"))}</span></span><span class="st-pad" aria-hidden="true"></span></span></div>
        ${mbad ? `<div class="opt-warn" role="alert">${this.h.mdi("alert", 14)}<span>${escape(t("stLoadMinRange", mlo, mhi))}</span></div>` : ""}</div>`;
    return `<div class="set-title">${escape(t("stLoadTitle"))}</div>${rows}${minutes}<div class="opt-short">${escape(t("stLoadShort", this.val(MINUTES_KEY)))}</div>`;
  }

  // Alter als Satz: "vor 8 Sek.", "vor 3 Min.", "vor 2 Std."
  ago(seconds) {
    const s = Math.max(0, Math.round(seconds));
    if (s < 90) return this.t("stAgoSec", s);
    if (s < 5400) return this.t("stAgoMin", Math.round(s / 60));
    return this.t("stAgoHour", Math.round(s / 3600));
  }

  partText(p) {
    const t = (k, ...a) => this.t(k, ...a);
    if (p.state !== "ok") {
      if (p.age_s == null) return t("stNotLoaded");
      return p.expect_s ? t("stLastTickOld", Math.max(1, Math.round(p.age_s / 60)), p.expect_s) : t("stOverdue", Math.max(1, Math.round(p.age_s / 60)));
    }
    if (p.id === "routines") return t("stRoutinesOk", p.loaded ?? 0);
    if (p.id === "magic") return t("stMagicOk", p.loaded ?? 0);
    if (p.expect_s) return p.last ? t("stLastTick", this.ago(this.data.now - p.last)) : t("stWaiting");
    return t("stActive");
  }

  // Knopf "Neu starten" nur bei einem Teil, der nicht läuft (verspätet oder steht)
  actsHtml(p) {
    if (p.state === "ok" || this.ui.confirm === p.id) return "";
    const busy = this.ui.busy === p.id;
    return `<span class="st-acts"><button type="button" class="linkbtn" data-st-restart="${this.h.escape(p.id)}"${this.ui.busy ? " disabled" : ""}>${this.h.escape(this.t(busy ? "stRestartBusy" : "stRestart"))}</button></span>`;
  }

  // Rückfrage unter der Zeile; was der Neustart tut und was er nicht tut
  confirmHtml(p) {
    const { escape } = this.h;
    const t = (k, ...a) => this.t(k, ...a);
    const busy = this.ui.busy === p.id;
    const name = t(`stPart_${p.id}`);
    return `<div class="st-confirm mg-confirm"><b>${escape(t("stRestartAsk", name))}</b>
      <small>${escape(t("stRestartNote"))}${p.id === "routines" ? ` ${escape(t("stRestartNoteRoutines"))}` : ""}</small>
      <div class="mg-btns small"><button type="button" class="dlg-btn" data-st-restart-no${busy ? " disabled" : ""}>${escape(t("rtCancel"))}</button>
      <button type="button" class="dlg-btn primary" data-st-restart-yes="${escape(p.id)}"${busy ? " disabled" : ""}>${escape(t(busy ? "stRestartBusy" : "stRestartYes"))}</button></div></div>`;
  }

  zoneHtml() {
    const { escape, mdi } = this.h;
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.data;
    if (!d) return `<p class="mg-note">${escape(this.error ? t("stLoadError", this.error) : t("rtLoading"))}</p>`;
    const bad = d.problems > 0;
    const names = d.parts.filter((p) => p.state !== "ok").map((p) => t(`stPart_${p.id}`)).join(", ");
    const banner = bad
      ? `<div class="st-banner bad"><span class="ic">${mdi("pulse", 22)}</span><span><b>${escape(t("stProblems", d.problems))}</b><small>${escape(t("stProblemsSub", names))}</small></span></div>`
      : `<div class="st-banner ok"><span class="ic">${mdi("check", 22)}</span><span><b>${escape(t("stAllOk"))}</b><small>${escape(t("stAllOkSub", d.parts.length))}</small></span></div>`;
    const pill = (state) => `<span class="pill ${state === "ok" ? "on" : state === "late" ? "warn" : "off"}"><span class="pd"></span>${escape(t(`stState_${state}`))}</span>`;
    const parts = [...d.parts].sort((a, b) => PART_ORDER.indexOf(a.id) - PART_ORDER.indexOf(b.id));
    const rows = parts.map((p) => `<div class="st-line"><span class="st-t"><b>${escape(t(`stPart_${p.id}`))}</b><small>${escape(this.partText(p))}</small>${this.actsHtml(p)}</span>${pill(p.state)}</div>${this.ui.confirm === p.id ? this.confirmHtml(p) : ""}`).join("");
    const started = new Date(d.started * 1000).toLocaleString(this.host._locale?.() || undefined, { dateStyle: "short", timeStyle: "short" });
    const flash = this.ui.flash ? `<div class="st-flash" role="status">${mdi("check", 16)}<span>${escape(this.ui.flash)}</span></div>` : "";
    return `<div class="set-title">${escape(t("stStateTitle"))}</div>${banner}${flash}<div class="st-card">${rows}</div>
      <p class="st-start">${escape(t("stStart", started, d.routines_loaded, d.routines_missed))}</p>
      ${this.error ? `<div class="dlg-error" role="alert">${escape(this.error)}</div>` : ""}`;
  }

  // Eine Kurve mit Fläche und Hilfslinien bei 0, halber und voller Höhe (Prozent: 0 bis 100; sonst bis zur Achse des Sensors)
  plotHtml(m) {
    const { escape } = this.h;
    const span = m.end - m.start || 1;
    const x = (at) => Math.max(0, Math.min(1000, ((at - m.start) / span) * 1000));
    const top = m.mode === "absolute" ? m.axis_max || 1 : 100;
    const y = (v) => 100 - Math.max(0, Math.min(100, (v / top) * 100));
    const pts = m.points;
    const line = pts.map(([at, v], i) => `${i ? "L" : "M"}${x(at).toFixed(1)},${y(v).toFixed(2)}`).join(" ");
    const area = `${line} L${x(pts[pts.length - 1][0]).toFixed(1)},100 L${x(pts[0][0]).toFixed(1)},100 Z`;
    const marks = [top, top / 2, 0];
    // Zeitstrahl (seit 2.70.0): Uhrzeiten bei 24 Std. (alle 3 Stunden), sonst Tage bzw. Monate; wie bei Batterie und Empfang
    const ticks = this.ticks(m);
    const vlines = ticks.map((tk) => `<line class="bh-grid bh-v" x1="${(tk.pos * 10).toFixed(1)}" x2="${(tk.pos * 10).toFixed(1)}" y1="0" y2="100" vector-effect="non-scaling-stroke"/>`).join("");
    const grid = vlines + marks.map((v) => `<line class="bh-grid" x1="0" x2="1000" y1="${y(v)}" y2="${y(v)}" vector-effect="non-scaling-stroke"/>`).join("");
    const labels = marks.map((v) => `<span class="st-sys-y" style="top:${y(v)}%">${this.num(v)}</span>`).join("");
    const tickRow = `<div class="avail-ticks bh-ticks st-sys-ticks" data-st-ticks>${ticks
      .map((tk) => `<span class="${tk.minor ? "minor" : ""}" style="left:${tk.pos.toFixed(2)}%">${escape(tk.label)}</span>`)
      .join("")}<span class="now-label">${escape(this.t("stSysNow"))}</span></div>`;
    return `<div class="st-sys-plot" data-st-plot="${escape(m.id)}"><svg class="bh-svg" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">${grid}<path class="bh-area" d="${area}"/><path class="bh-line" d="${line}" vector-effect="non-scaling-stroke"/></svg>${labels}</div>${tickRow}`;
  }

  // Marken des Zeitstrahls je Zeitraum (die Hilfsfunktion des Panels kennt 24h, 30d, 180d und 365d)
  ticks(m) {
    const mode = { 1: "24h", 30: "30d", 180: "180d", 365: "365d" }[m.days] || "24h";
    return this.host._ticks?.(m.start, m.end, mode) || [];
  }

  // Zahl im Format der HA-Sprache, eine Nachkommastelle nur wenn nötig
  num(n) {
    return Number(n).toLocaleString(this.host._locale?.() || undefined, { maximumFractionDigits: 1 });
  }

  // Knopf "Einschalten" für ausgeschaltete Sensoren (mit Namen), danach der Hinweis, dass HA die Integration gleich neu lädt
  enableHtml(m) {
    const { escape } = this.h;
    const t = (k, ...a) => this.t(k, ...a);
    if (!m.disabled?.length) return "";
    if (this.ui.enabled[m.id]) return `<p class="st-sys-note ok" role="status">${escape(t("stSysEnabled"))}</p>`;
    const list = m.disabled.map((d) => `<li>${escape(d.name)} <small>(${escape(d.entity_id)})</small></li>`).join("");
    if (this.ui.enableAsk === m.id || this.ui.enabling === m.id) {
      const busy = this.ui.enabling === m.id;
      return `<div class="st-confirm mg-confirm" data-st-enable-confirm><b>${escape(t("stSysEnableAsk"))}</b><ul class="st-sys-list">${list}</ul><small>${escape(t("stSysEnableNote"))}</small>
        <div class="mg-btns small"><button type="button" class="dlg-btn" data-st-enable-no${busy ? " disabled" : ""}>${escape(t("rtCancel"))}</button>
        <button type="button" class="dlg-btn primary" data-st-enable="${escape(m.id)}"${this.ui.enabling ? " disabled" : ""}>${escape(t(busy ? "stSysEnabling" : "stSysEnableYes"))}</button></div></div>`;
    }
    return `<ul class="st-sys-list">${list}</ul><div class="st-sys-act"><button type="button" class="dlg-btn" data-st-enable-ask="${escape(m.id)}"${this.ui.enabling ? " disabled" : ""}>${escape(t("stSysEnable"))}</button></div>`;
  }

  metricHtml(m) {
    const { escape } = this.h;
    const t = (k, ...a) => this.t(k, ...a);
    const title = t(`stSys${m.id[0].toUpperCase()}${m.id.slice(1)}`);
    const range = m.id === "disk" ? this.range : "24h";
    const scope = m.scope === "own" ? m.name : m.scope === "none" ? "" : t(`stSysScope_${m.scope}`);
    const absolute = m.mode === "absolute";
    const val =
      m.current == null
        ? `<span class="st-sys-val"><small>–</small></span>`
        : absolute
          ? `<span class="st-sys-val">${escape(this.num(m.current))}<small>${escape(m.unit)}</small></span>`
          : `<span class="st-sys-val">${escape(String(Math.round(m.current)))}<small>%</small></span>`;
    const tabs =
      m.id === "disk"
        ? `<div class="sub-tabs" role="tablist">${SYS_RANGES.map((k) => `<button type="button" role="tab" class="sub-tab${k === this.range ? " on" : ""}" data-st-range="${k}" aria-selected="${k === this.range}">${escape(t(`stSysRange_${k}`))}</button>`).join("")}</div>`
        : "";
    let body;
    if (!m.entity_id) {
      // Ohne "System Monitor": sagen, wie man es hinzufügt (nicht zwingend, die Auswahl unten nimmt jeden Sensor)
      const noInteg = this.sys && this.sys.integrations && !this.sys.integrations.systemmonitor && !m.disabled?.length;
      body = `<p class="st-sys-note">${escape(t(m.disabled?.length ? "stSysOff" : noInteg ? "stSysNoInteg" : "stSysNone"))}</p>${this.enableHtml(m)}${
        noInteg ? `<div class="st-sys-act"><button type="button" class="dlg-btn" data-st-add>${escape(t("stSysAdd"))}</button></div>` : ""
      }`;
    }
    else if (m.missing) body = `<p class="st-sys-note warn">${escape(t("stSysMissing"))}</p>`;
    else if (m.pending) body = `<p class="st-sys-note" role="status">${escape(t("stSysPending"))}</p>`;
    else if (m.off) body = `<p class="st-sys-note warn">${escape(t("stSysOwnOff"))}</p>${this.enableHtml(m)}`;
    else if (!m.points.length) body = `<p class="st-sys-note">${escape(t("stSysNoData"))}</p>`;
    else {
      const stats =
        m.avg != null && m.max != null ? (absolute ? t("stSysAvgMaxUnit", this.num(m.avg), this.num(m.max), m.unit) : t("stSysAvgMax", Math.round(m.avg), Math.round(m.max))) : "";
      body = `${this.plotHtml(m)}<div class="st-sys-foot"><span>${escape(t(`stSysAgo_${range}`))}</span><span class="mid">${escape(stats)}</span></div>
        ${range !== "24h" && m.source !== "statistics" ? `<p class="st-sys-note">${escape(t("stSysNoStats"))}</p>` : ""}`;
    }
    // Festplatte: wie viel das in Gigabyte ist (seit 2.69.0), sonst ein Hinweis, welche Sensoren dazu fehlen
    const sz = m.size;
    const size = sz
      ? `<div class="st-sys-size" data-st-size>${escape(t("stSysSize", this.num(sz.used), this.num(sz.total), sz.unit, this.num(sz.free)))}</div>`
      : m.id === "disk" && m.entity_id && !m.missing && m.disabled?.length
        ? `<p class="st-sys-note">${escape(t(absolute ? "stSysSizeOffAbs" : "stSysSizeOff"))}</p>${this.enableHtml(m)}`
        : "";
    return `<div class="st-sys" data-st-metric-card="${escape(m.id)}"><div class="st-sys-head"><span class="st-sys-t"><b>${escape(title)}</b>${scope ? `<small>${escape(scope)}</small>` : ""}</span>${val}</div>${size}${tabs}${body}</div>`;
  }

  // Sensoren zur Auswahl für die Art: Prozent-Sensoren für CPU und RAM, bei der Festplatte auch Sensoren in Gigabyte; gefiltert nach der Eingabe
  pickOptions(kind) {
    const q = this.ui.pickQ.trim().toLowerCase();
    const own = this.val(SYS_OPTION[kind]) || "";
    // Alle Sensor-Entitäten mit Zahl; die naheliegenden (Prozent, bei der Festplatte auch Gigabyte) stehen vorn, den Rest findet die Suche
    const fits = (c) => c.pref && (kind === "disk" || c.unit === "%");
    let list = [...(this.sys?.candidates || [])].sort((a, b) => Number(fits(b)) - Number(fits(a)));
    // Gewählt, aber nicht (mehr) in der Liste: trotzdem anzeigen, damit die Wahl sichtbar bleibt
    if (own && !list.some((c) => c.entity_id === own)) list = [{ entity_id: own, name: own, unit: "" }, ...list];
    return list.filter((c) => !q || `${c.name} ${c.entity_id}`.toLowerCase().includes(q));
  }

  pickListHtml(kind) {
    const { escape, mdi } = this.h;
    const t = (k, ...a) => this.t(k, ...a);
    const own = this.val(SYS_OPTION[kind]) || "";
    const m = this.sys.metrics.find((x) => x.id === kind);
    const autoName = m && m.scope !== "own" && m.entity_id ? m.name : "";
    const q = this.ui.pickQ.trim();
    const all = this.pickOptions(kind);
    const shown = all.slice(0, PICK_MAX);
    const row = (id, name, sub) => `<button type="button" class="st-opt${id === own ? " on" : ""}" role="radio" aria-checked="${id === own}" data-st-kind="${escape(kind)}" data-st-choose="${escape(id)}"><span class="st-opt-t"><b>${escape(name)}</b>${sub ? `<small>${escape(sub)}</small>` : ""}</span>${id === own ? mdi("check", 18) : ""}</button>`;
    const rows = [
      // "Automatisch" steht immer oben (auch wenn die Suche sonst nichts findet), solange nichts getippt ist
      ...(q ? [] : [row("", autoName ? t("stSysAuto", autoName) : t("stSysAutoNone"), "")]),
      ...shown.map((c) => row(c.entity_id, c.name, c.name === c.entity_id ? "" : c.entity_id)),
    ];
    if (!shown.length) rows.push(`<p class="st-sys-note">${escape(t("listSearchNone"))}</p>`);
    if (all.length > shown.length) rows.push(`<p class="st-sys-note">${escape(t("stSysPickMore", all.length - shown.length))}</p>`);
    return rows.join("");
  }

  // Auswahl des Sensors je Art: automatisch oder ein eigener, mit Suchfeld (eine Liste mit Dutzenden Sensoren lässt sich sonst nicht lesen)
  sourceHtml() {
    const { escape, mdi } = this.h;
    const t = (k, ...a) => this.t(k, ...a);
    const rows = this.sys.metrics
      .map((m) => {
        const own = this.val(SYS_OPTION[m.id]) || "";
        const known = own && this.sys.candidates.find((c) => c.entity_id === own);
        const label = own ? known?.name || own : m.entity_id && m.scope !== "own" ? t("stSysAuto", m.name) : t("stSysAutoNone");
        const open = this.ui.pick === m.id;
        const title = t(`stSys${m.id[0].toUpperCase()}${m.id.slice(1)}`);
        const picker = open
          ? `<div class="st-pick"><label class="list-search" data-for="st-pick">${mdi("search", 18)}<input type="search" data-st-pickq value="${escape(this.ui.pickQ)}" placeholder="${escape(t("stSysPickSearch"))}" aria-label="${escape(t("stSysPickSearch"))}" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false">${this.host._fieldClearHtml("data-fc", "", this.ui.pickQ)}</label>
              <div class="st-pick-list" role="radiogroup" data-st-picklist>${this.pickListHtml(m.id)}</div></div>`
          : "";
        return `<div class="opt"><div class="opt-line"><span class="opt-label">${escape(title)}</span>
          <button type="button" class="st-pickbtn" data-st-pick="${escape(m.id)}" aria-expanded="${open}" aria-label="${escape(title)}"><span>${escape(label)}</span>${mdi("chevronDown", 18)}</button></div>${picker}</div>`;
      })
      .join("");
    return `<div class="set-title">${escape(t("stSysSrcTitle"))}</div>${rows}<div class="opt-short">${escape(t("stSysSrcShort"))}</div>`;
  }

  systemHtml() {
    const { escape } = this.h;
    const t = (k, ...a) => this.t(k, ...a);
    if (!this.sys) return `<p class="mg-note">${escape(this.sysError ? t("stSysError", this.sysError) : t("stSysLoading"))}</p>`;
    return `${this.sys.metrics.map((m) => this.metricHtml(m)).join("")}
      ${this.sysError ? `<div class="dlg-error" role="alert">${escape(t("stSysError", this.sysError))}</div>` : ""}`;
  }

  // Reiterleiste "Dienste" | "System" | "Einstellungen"; ein Punkt an den Einstellungen zeigt ungespeicherte Änderungen in den anderen Reitern
  tabsHtml() {
    const { escape } = this.h;
    const mark = this.changes().length ? " chg" : "";
    return `<div class="sub-tabs" role="tablist">${STATE_TABS.map((id) => {
      const on = id === this.ui.tab;
      return `<button type="button" role="tab" class="sub-tab${on ? " on" : ""}${id === "settings" && !on ? mark : ""}" data-st-tab="${id}" aria-selected="${on}">${escape(this.t(`stTab_${id}`))}</button>`;
    }).join("")}</div>`;
  }

  settingsHtml() {
    const { escape } = this.h;
    const source = this.sys ? this.sourceHtml() : `<div class="set-title">${escape(this.t("stSysSrcTitle"))}</div><p class="mg-note">${escape(this.sysError ? this.t("stSysError", this.sysError) : this.t("stSysLoading"))}</p>`;
    const err = this.ui.saveError ? `<div class="dlg-error" role="alert">${escape(this.t("settingsSaveError"))} ${escape(this.ui.saveError)}</div>` : "";
    return `${this.configHtml()}${this.loadHtml()}${source}${err}`;
  }

  html() {
    const body = this.ui.tab === "settings" ? this.settingsHtml() : this.ui.tab === "system" ? this.systemHtml() : this.zoneHtml();
    return `${this.tabsHtml()}${body}`;
  }
}
