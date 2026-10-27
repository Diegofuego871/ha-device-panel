/**
 * Einrichtungsassistent (seit 2.135.0, docs/mockups/wizard-v1): führt einmalig durch die Grundkonfiguration. Am Handy ein Vollbild,
 * am Desktop ein Popup in der Mitte. Schritte: Willkommen, Integrationen, Gerätetypen, Geräte, Meldungen (Ziel, Arten und ihre
 * wichtigsten Werte), Labels (nur wenn es Labels gibt, seit 2.155.0), Ruhezeit (nur mit Ziel), Fertig. Alles ist ein Entwurf (this.s.d); gespeichert wird erst mit "Fertigstellen"
 * (ein set_options), bis dahin ändert sich nichts. Die Zahlen jedes Schritts rechnet das Panel selbst nach dem Entwurf (wizard_data
 * liefert alle Kandidaten ohne abgezogene Ausschlüsse).
 *
 * Zwischenstand (seit 2.136.0): bei jedem Schrittwechsel und beim Schliessen liegt der Entwurf samt Schritt in der Option wizard_draft (für alle
 * Administratoren, wird nicht angewendet). Der nächste Start macht dort weiter; "Fertigstellen" und "Nicht mehr zeigen" löschen ihn.
 *
 * Zustand (wizard_state, für alle Administratoren): "new" frisch installiert (das Fenster öffnet sich einmal von selbst), "later" übersprungen
 * (Kachel und Punkt im Launcher bleiben), "open" aus den Einstellungen neu gestartet und nicht beendet (Kachel und Punkt kommen zurück), "done"
 * abgeschlossen, "off" "Nicht mehr zeigen". Bestehende Installationen gelten als "done".
 */

const STATES_SHOWN = ["new", "later", "open"];
const MSG_ROWS = ["outage", "battery", "charge", "new", "updates"];
// Meldungsarten mit Einstellung je Integration (aufklappbar); bei den Updates sind es die Integrationen der update-Entitäten (seit 2.139.0)
const PER_INTEGRATION = ["outage", "battery", "new", "charge", "updates"];
const MSG_ICON = { outage: "alert", battery: "battery", new: "sparkle", charge: "batteryCharging", updates: "download" };
// Zahlen der Meldungen: Schlüssel der Option, Zeile, Beschriftung, Einheit
const VALUES = {
  // "Ausgefallen nach" (offline_after) bleibt hier weg, damit es einfach bleibt; "Melden nach" darf aber nicht darunter liegen
  outage: [["notify_delay", "wzVDelay", "wzVMin"]],
  battery: [["battery_low", "wzVBattery", "wzVPercent"]],
  new: [["new_window", "wzVNew", "wzVMin"]],
  charge: [["charge_full", "wzVFull", "wzVPercent"]],
  // Updates: die Uhrzeit nur bei "einmal am Tag" (die anderen Arten stellt man in den Einstellungen)
  updates: [["updates_time", "wzVTime", "", "time"]],
};
// Systemauslastung (seit 2.143.0, Schritt "Ruhezeit und System"): je Art Schalter, Grenze in Prozent und Mindestdauer in Minuten (Optionen der Status-App)
const SYS_KINDS = ["cpu", "ram", "disk"];
const sysKey = (kind, part) => `status_${kind}_${part}`;
const VALUE_KEYS = Object.values(VALUES).flatMap((rows) => rows.map(([key]) => key));
// Labels (seit 2.155.0): Schlüssel in den Zuordnungen pro Integration, feste Zeiten zur Auswahl wie in den Einstellungen
const LABEL_PREFIX = "label:";
const LABEL_TIMES = [1, 2, 5, 10, 15, 30, 60, 120, 360, 720, 1440];
const LABEL_MAPS = ["offline_after_integrations", "notify_delay_integrations", "battery_low_integrations"];
const LABEL_LISTS = ["notify_exclude_integrations", "battery_push_exclude_integrations", "new_exclude_integrations", "charge_integrations", "updates_integrations_on", "updates_integrations_off"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const isTime = (key) => key === "updates_time";
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
    this.s = { step: "welcome", source, loading: true, error: "", busy: false, d: null, base: null, data: null, opts: null, test: "", q: { integ: "", dev: "" }, open: new Set(), openMsg: new Set(), openInt: new Set(), start: 0 };
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
      this.restore(opts.values.wizard_draft);
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
      on: { outage: Boolean(v.notify_outage), battery: Boolean(v.battery_push), new: Boolean(v.notify_new), charge: Boolean(v.notify_charge), updates: Boolean(v.notify_updates) },
      v: Object.fromEntries(VALUE_KEYS.map((k) => [k, String(v[k])])),
      quiet: { on: Boolean(v.quiet_enabled), from: first.from || "22:00", to: first.to || "07:00", uniform },
      sys: Object.fromEntries(SYS_KINDS.map((k) => [k, { on: Boolean(v[sysKey(k, "alert")]), limit: String(v[sysKey(k, "limit")]), min: String(v[sysKey(k, "minutes")]) }])),
      // Je Meldungsart die Integrationen (seit 2.137.0): Ausfall, Batterie und Neue Geräte schliessen aus, Voll geladen schliesst ein
      ex: { outage: new Set(v.notify_exclude_integrations || []), battery: new Set(v.battery_push_exclude_integrations || []), new: new Set(v.new_exclude_integrations || []) },
      // Je Gerät (seit 2.137.0): ausgeschaltet bei Ausfall und Batterie, eingeschaltet bei Voll geladen (Lademeldung: Gerät, sonst Integration)
      devOff: { outage: new Set(this.overrideIds("notify")), battery: new Set(this.overrideList("battery").filter((o) => o.value === "off").map((o) => o.id)) },
      chargeOn: this.chargeOnFrom(v),
      updOn: this.updOnFrom(v),
      lab: this.labelsFrom(v),
      // Ohne Online-Status (seit 2.156.0): Integrationen (Domains) und Geräte (IDs), deren Online-Status nicht beobachtet wird
      noStat: {
        integ: new Set(Object.entries(v.offline_after_integrations || {}).filter(([k, x]) => x === "nostatus" && !k.startsWith(LABEL_PREFIX)).map(([k]) => k)),
        dev: new Set(this.overrideList("offline").filter((o) => o.value === "nostatus").map((o) => o.id)),
      },
    };
  }

  // Einstellungen der Labels (seit 2.155.0) aus den Optionen: je Label ein Eintrag mit denselben Wahlen wie bei einer Integration.
  // Leere Zeichenfolgen bedeuten Standard; mon = überwachen, push/batPush/newPush = Meldung an, charge = Lademeldung, upd = Standard, an oder aus.
  labelsFrom(v) {
    const ids = [...(v.labels || [])];
    const map = (key, id) => (v[key] || {})[`${LABEL_PREFIX}${id}`];
    const has = (key, id) => (v[key] || []).includes(`${LABEL_PREFIX}${id}`);
    const cfg = {};
    for (const id of ids) {
      const off = map("offline_after_integrations", id);
      const delay = map("notify_delay_integrations", id);
      const bat = map("battery_low_integrations", id);
      cfg[id] = {
        mon: off !== "off",
        after: Number.isInteger(off) ? String(off) : "",
        delay: Number.isInteger(delay) ? String(delay) : "",
        bat: bat === "off" ? "off" : Number.isInteger(bat) ? String(bat) : "",
        push: !has("notify_exclude_integrations", id),
        batPush: !has("battery_push_exclude_integrations", id),
        newPush: !has("new_exclude_integrations", id),
        charge: has("charge_integrations", id),
        upd: has("updates_integrations_off", id) ? "off" : has("updates_integrations_on", id) ? "on" : "default",
        // Online-Status beobachten (seit 2.156.0); aus = "nostatus", die Zeiten und der Ausfall-Push ruhen
        status: off !== "nostatus",
      };
    }
    return { ids, cfg };
  }

  // Eigene Einstellungen je Gerät aus get_options (overrides): Liste oder leer
  overrideList(key) {
    return this.s?.opts?.overrides?.[key] || [];
  }

  overrideIds(key) {
    return this.overrideList(key).map((o) => o.id);
  }

  // update-Entitäten aus get_options (catalog.updates)
  updateItems() {
    return this.s?.opts?.catalog?.updates || [];
  }

  // Updates, die jetzt gemeldet werden: Eintrag vor Integration vor Art (wie updates.is_wanted)
  updOnFrom(v) {
    const ex = new Set(v.updates_exclude || []);
    const inc = new Set(v.updates_include || []);
    const off = new Set(v.updates_integrations_off || []);
    const on = new Set(v.updates_integrations_on || []);
    const kinds = new Set(v.updates_kinds || []);
    const set = new Set();
    for (const x of this.updateItems()) {
      const wanted = ex.has(x.id) ? false : inc.has(x.id) ? true : off.has(x.platform) ? false : on.has(x.platform) ? true : kinds.has(x.kind);
      if (wanted) set.add(x.id);
    }
    return set;
  }

  // Geräte mit Batterie, deren Lademeldung jetzt gilt: eigene Wahl am Gerät vor der Integration
  chargeOnFrom(v) {
    const own = new Map(this.overrideList("charge").filter((o) => typeof o.value?.on === "boolean").map((o) => [o.id, o.value.on]));
    const inte = new Set(v.charge_integrations || []);
    const on = new Set();
    for (const x of this.s?.data?.devices || []) if (x.battery && (own.has(x.id) ? own.get(x.id) : inte.has(x.domain))) on.add(x.id);
    return on;
  }

  // Entwurf für die Option wizard_draft (Mengen als Listen)
  serialize(d) {
    return {
      exI: [...d.exI].sort(), exT: [...d.exT].sort(), exD: [...d.exD].sort(), target: d.target, on: { ...d.on }, v: { ...d.v }, quiet: { ...d.quiet }, sys: Object.fromEntries(Object.entries(d.sys).map(([k, x]) => [k, { ...x }])),
      lab: { ids: [...d.lab.ids], cfg: Object.fromEntries(Object.entries(d.lab.cfg).map(([k, x]) => [k, { ...x }])) },
      noStat: { integ: [...d.noStat.integ].sort(), dev: [...d.noStat.dev].sort() },
      ex: Object.fromEntries(Object.entries(d.ex).map(([k, set]) => [k, [...set].sort()])),
      devOff: Object.fromEntries(Object.entries(d.devOff).map(([k, set]) => [k, [...set].sort()])), chargeOn: [...d.chargeOn].sort(), updOn: [...d.updOn].sort(),
    };
  }

  // Zwischenstand einlesen und auf das prüfen, was es heute gibt (Geräte, Integrationen und Ziele können weggefallen sein)
  restore(saved) {
    const s = this.s;
    if (!saved?.d || typeof saved.step !== "string") return;
    const d = s.d;
    const x = saved.d;
    const list = (v, known) => (Array.isArray(v) ? v.filter((i) => typeof i === "string" && (!known || known.has(i))) : []);
    d.exI = new Set(list(x.exI, new Set(s.data.integrations.map((i) => i.domain))));
    d.exT = new Set(list(x.exT));
    d.exD = new Set(list(x.exD, new Set(s.data.devices.map((i) => i.id))));
    if (typeof x.target === "string" && (s.opts.notify_targets || []).some((t) => t.value === x.target)) d.target = x.target;
    for (const id of MSG_ROWS) if (typeof x.on?.[id] === "boolean") d.on[id] = x.on[id];
    for (const k of VALUE_KEYS) if (typeof x.v?.[k] === "string" && x.v[k].length <= 6) d.v[k] = x.v[k];
    if (typeof x.quiet?.on === "boolean") d.quiet.on = x.quiet.on;
    for (const k of ["from", "to"]) if (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(x.quiet?.[k]))) d.quiet[k] = x.quiet[k];
    for (const k of SYS_KINDS) {
      const y = x.sys?.[k];
      if (typeof y?.on === "boolean") d.sys[k].on = y.on;
      for (const f of ["limit", "min"]) if (typeof y?.[f] === "string" && y[f].length <= 6) d.sys[k][f] = y[f];
    }
    for (const id of Object.keys(d.ex)) if (Array.isArray(x.ex?.[id])) d.ex[id] = new Set(list(x.ex[id]));
    const known = new Set(s.data.devices.map((i) => i.id));
    for (const id of Object.keys(d.devOff)) if (Array.isArray(x.devOff?.[id])) d.devOff[id] = new Set(list(x.devOff[id], known));
    if (Array.isArray(x.chargeOn)) d.chargeOn = new Set(list(x.chargeOn, known));
    if (Array.isArray(x.updOn)) d.updOn = new Set(list(x.updOn, new Set(this.updateItems().map((u) => u.id))));
    // Ohne Online-Status: nur Integrationen und Geräte, die es noch gibt
    if (x.noStat) {
      d.noStat = {
        integ: new Set(list(x.noStat.integ, new Set(s.data.integrations.map((i) => i.domain)))),
        dev: new Set(list(x.noStat.dev, known)),
      };
    }
    // Labels: nur solche, die es in Home Assistant noch gibt oder die schon eingerichtet waren
    if (Array.isArray(x.lab?.ids)) {
      const known = new Set([...(s.data.labels || []).map((l) => l.id), ...d.lab.ids]);
      const ids = list(x.lab.ids, known);
      const cfg = {};
      for (const id of ids) {
        const base = d.lab.cfg[id] || this.labelDefault();
        const y = x.lab.cfg?.[id] || {};
        const text = (v, ok) => (typeof v === "string" && v.length <= 6 && ok(v) ? v : null);
        cfg[id] = {
          mon: typeof y.mon === "boolean" ? y.mon : base.mon,
          after: text(y.after, (v) => v === "" || /^\d+$/.test(v)) ?? base.after,
          delay: text(y.delay, (v) => v === "" || /^\d+$/.test(v)) ?? base.delay,
          bat: text(y.bat, (v) => v === "" || v === "off" || /^\d+$/.test(v)) ?? base.bat,
          push: typeof y.push === "boolean" ? y.push : base.push,
          batPush: typeof y.batPush === "boolean" ? y.batPush : base.batPush,
          newPush: typeof y.newPush === "boolean" ? y.newPush : base.newPush,
          charge: typeof y.charge === "boolean" ? y.charge : base.charge,
          upd: ["default", "on", "off"].includes(y.upd) ? y.upd : base.upd,
          status: typeof y.status === "boolean" ? y.status : base.status,
        };
      }
      d.lab = { ids, cfg };
    }
    s.hasDraft = true;
    s.savedDraft = JSON.stringify(saved);
    // Dort weitermachen, wo es aufhörte (die Ruhezeit nur mit Ziel)
    s.step = [...this.steps(), "welcome"].includes(saved.step) ? saved.step : "integrations";
  }

  // Zwischenstand speichern (ohne zu warten; ein Fehler stört den Ablauf nicht). Auf der Willkommensseite ohne Änderung gibt es nichts zu merken
  persist() {
    const s = this.s;
    if (!s?.d || (s.step === "welcome" && !this.dirty() && !s.hasDraft)) return;
    const draft = { step: s.step, d: this.serialize(s.d) };
    const text = JSON.stringify(draft);
    if (text === s.savedDraft) return;
    s.savedDraft = text;
    s.hasDraft = true;
    this.host._hass.callWS({ type: "device_panel/set_options", values: { wizard_draft: draft } }).catch(() => {});
  }

  snapshot(d) {
    return { i: [...d.exI].sort(), t: [...d.exT].sort(), d: [...d.exD].sort(), target: d.target, on: d.on, v: d.v, q: d.quiet, y: d.sys, x: Object.fromEntries(Object.entries(d.ex).map(([k, set]) => [k, [...set].sort()])), o: Object.fromEntries(Object.entries(d.devOff).map(([k, set]) => [k, [...set].sort()])), c: [...d.chargeOn].sort(), u: [...d.updOn].sort(), l: d.lab, n: { i: [...d.noStat.integ].sort(), d: [...d.noStat.dev].sort() } };
  }

  dirty() {
    const s = this.s;
    return Boolean(s?.d) && JSON.stringify(this.snapshot(s.d)) !== s.start;
  }

  // X, Escape: ab Schritt 1 fragt ein Hinweis nach "Jetzt nicht" oder "Nicht mehr zeigen" (der Zwischenstand bleibt in beiden
  // Fällen bis zum Verwerfen); auf der Willkommensseite und beim Laden gibt es diese Wahl schon bzw. nichts zu verlieren
  requestClose() {
    const s = this.s;
    if (s?.d && s.step !== "welcome" && !s.loading && !s.error) {
      s.ask = !s.ask;
      this.render();
      return;
    }
    this.close();
  }

  never() {
    this.dlg?.close();
    this.s = null;
    this.setState("off", { wizard_draft: null });
  }

  close() {
    this.persist();
    const dlg = this.dlg;
    if (dlg?.open) dlg.close();
    this.s = null;
    if (this.state() === "new") this.setState("later");
  }

  // --- Schritte -------------------------------------------------------------------

  // Reihenfolge ohne "welcome": die Ruhezeit nur mit Ziel
  steps() {
    const d = this.s?.d;
    return ["integrations", "types", "devices", "messages", ...(this.hasLabels() ? ["labels"] : []), ...(d && d.target !== "none" ? ["quiet"] : []), "done"];
  }

  // Die Seite "Labels" gibt es nur, wenn Home Assistant mindestens ein Label an einem Gerät kennt (oder schon eines eingerichtet ist)
  hasLabels() {
    return Boolean(this.s?.data?.labels?.length);
  }

  labelDefault() {
    return { mon: true, after: "", delay: "", bat: "", push: true, batPush: true, newPush: true, charge: false, upd: "default", status: true };
  }

  labelName(id) {
    return (this.s.data.labels || []).find((l) => l.id === id)?.name || id;
  }

  go(step) {
    const s = this.s;
    if (!s || s.loading) return;
    s.step = step;
    s.test = "";
    this.persist();
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
    if (s?.step === "quiet" && s.d) return this.sysInvalid();
    if (s?.step === "labels" && s.d) return this.labelsInvalid();
    if (s?.step !== "messages" || !s.d) return "";
    const limits = s.opts.limits || {};
    const num = (k) => (/^\d+$/.test(String(s.d.v[k]).trim()) ? Number(s.d.v[k]) : NaN);
    for (const key of VALUE_KEYS.filter((k) => !isTime(k))) {
      const [lo, hi] = limits[key] || [1, 999];
      const n = num(key);
      if (!(n >= lo && n <= hi)) return this.t("wzErrRange", this.t(this.valueLabel(key)), lo, hi);
    }
    const detect = Number(s.base.offline_after);
    if (this.rowValues("updates").length && !TIME_RE.test(String(s.d.v.updates_time))) return this.t("wzErrTime");
    if (num("notify_delay") < detect) return this.t("wzErrDelay", detect);
    return "";
  }

  // Fehler der Label-Werte: "Erst melden nach" nicht kürzer als "Ausgefallen nach" des Labels (sonst das globale), Batterie im Bereich
  labelsInvalid() {
    const { d, opts, base } = this.s;
    const limits = opts.limits || {};
    for (const id of d.lab.ids) {
      const c = d.lab.cfg[id];
      const name = this.labelName(id);
      for (const [key, raw, label] of [["offline_after", c.after, "optOfflineAfter"], ["notify_delay", c.delay, "optDelay"], ["battery_low", c.bat === "off" ? "" : c.bat, "optBatteryLow"]]) {
        if (raw === "") continue;
        const [lo, hi] = limits[key] || [1, 1440];
        const n = Number(raw);
        if (!(/^\d+$/.test(raw) && n >= lo && n <= hi)) return this.t("wzErrRange", `${name}: ${this.t(label)}`, lo, hi);
      }
      const detect = c.after !== "" ? Number(c.after) : Number(base.offline_after);
      if (c.mon && c.status && c.delay !== "" && Number(c.delay) < detect) return `${name}: ${this.t("wzErrDelay", detect)}`;
    }
    return "";
  }

  // Fehler der Systemwerte (Grenze, Mindestdauer) der angezeigten Arten: Text oder ""
  sysInvalid() {
    const { d, opts } = this.s;
    for (const k of this.sysShown()) {
      for (const [part, def, label] of [["limit", [1, 100], "wzSysLimit"], ["minutes", [1, 60], "wzSysMin"]]) {
        const [lo, hi] = opts.limits?.[sysKey(k, part)] || def;
        const raw = String(d.sys[k][part === "limit" ? "limit" : "min"]).trim();
        if (d.sys[k].on && !(/^\d+$/.test(raw) && Number(raw) >= lo && Number(raw) <= hi)) return this.t("wzErrRange", `${this.t(`stSys${k[0].toUpperCase()}${k.slice(1)}`)}: ${this.t(label)}`, lo, hi);
      }
    }
    return "";
  }

  // Arten mit einem aktuellen Wert in Prozent; ohne ihn gäbe es keine Meldung (kein Sensor oder nur Gigabyte ohne Gesamtgrösse)
  sysShown() {
    const cur = this.s.data?.status || {};
    return SYS_KINDS.filter((k) => typeof cur[k] === "number");
  }

  // Integrationen einer Meldungsart nach dem Entwurf (nur die, die nach Schritt 1 bis 3 übrig sind; Batterie und Laden nur mit Batteriegeräten)
  rowIntegrations(id) {
    if (id === "updates") {
      const map = new Map();
      for (const x of this.updateItems()) {
        const p = x.platform || x.kind;
        if (!map.has(p)) map.set(p, { domain: p, n: 0, name: x.platform_name || p });
        map.get(p).n += 1;
      }
      return [...map.values()].sort((a, b) => b.n - a.n || String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase()));
    }
    const { data } = this.s;
    const count = new Map();
    for (const x of this.chosen()) if (x.domain && (!["battery", "charge"].includes(id) || x.battery)) count.set(x.domain, (count.get(x.domain) || 0) + 1);
    const names = Object.fromEntries(data.integrations.map((i) => [i.domain, i.name]));
    return [...count.entries()]
      .map(([domain, n]) => ({ domain, n, name: names[domain] || domain }))
      .sort((a, b) => b.n - a.n || String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase()));
  }

  // Schalter der Integration: "on", "off" oder "part" (Voll geladen: nach ihren Geräten)
  integState(id, domain) {
    const { d } = this.s;
    if (!["charge", "updates"].includes(id)) return d.ex[id].has(domain) ? "off" : "on";
    const devs = this.rowDevices(id, domain);
    const set = id === "charge" ? d.chargeOn : d.updOn;
    const on = devs.filter((x) => set.has(x.id)).length;
    return on === 0 ? "off" : on === devs.length ? "on" : "part";
  }

  // Geräte einer Integration unter einer Meldungsart (nach dem Entwurf; Batterie und Laden nur mit Batterie), nach Namen
  rowDevices(id, domain) {
    if (id === "updates") {
      // update-Entitäten einer Integration; unter "Bereich" steht die Version
      return this.updateItems()
        .filter((x) => (x.platform || x.kind) === domain)
        .map((x) => ({ id: x.id, name: x.name, area: x.available && x.installed && x.latest ? `${x.installed} → ${x.latest}` : x.installed || "" }))
        .sort((a, b) => String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase()));
    }
    return this.chosen()
      .filter((x) => x.domain === domain && (!["battery", "charge"].includes(id) || x.battery))
      .sort((a, b) => String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase()));
  }

  // Zeile unter dem Gerätenamen: "gerade ausgefallen" (nur Ausfall), Bereich und Batteriestand (nur Batterie und Laden), alles in einer Zeile
  devSub(id, x) {
    const { escape } = this.h;
    const parts = [];
    if (x.down && id === "outage") parts.push(`<em class="wz-down">${escape(this.t("wzDown"))}</em>`);
    if (x.area) parts.push(escape(x.area));
    if (["battery", "charge"].includes(id) && typeof x.battery_level === "number") parts.push(`<span class="wz-bl">${x.battery_level} %</span>`);
    return parts.length ? `<small>${parts.join(" · ")}</small>` : "";
  }

  devOn(id, devId) {
    const { d } = this.s;
    return id === "charge" ? d.chargeOn.has(devId) : id === "updates" ? d.updOn.has(devId) : !d.devOff[id].has(devId);
  }

  // Zeilen mit Werten zum Anpassen: bei den Updates die Uhrzeit nur im Modus "einmal am Tag"
  rowValues(id) {
    const mode = this.s?.base?.updates_mode;
    return VALUES[id].filter(([key]) => key !== "updates_time" || mode === "daily");
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
    const close = `<button type="button" class="dlg-close" data-wz="close" title="${escape(t("wzClose"))}" aria-label="${escape(t("wzClose"))}">${mdi("close", 18)}</button>`;
    if (s.loading || s.error || !s.d) {
      body = s.error
        ? `<div class="dlg-error">${escape(t("wzLoadError"))} ${escape(s.error)}</div>`
        : `<p class="wz-p">${escape(t("wzLoading"))}</p>`;
      foot = `<button type="button" class="dlg-btn" data-wz="close">${escape(t("wzClose"))}</button>${s.error ? `<button type="button" class="dlg-btn primary" data-wz="retry">${mdi("verCheck", 18)}${escape(t("wzRetry"))}</button>` : ""}`;
      top = `<div class="wz-top"><div class="wz-stp"><span></span>${close}</div></div>`;
    } else if (s.step === "welcome") {
      top = `<div class="wz-top"><div class="wz-stp"><span></span>${close}</div></div>`;
      body = this.welcomeHtml();
      foot = `<div class="wz-welcome-ft"><button type="button" class="dlg-btn primary" data-wz="start">${escape(t("wzStart"))}${mdi("arrowRight", 18)}</button>
        <div class="wz-ft2"><button type="button" class="dlg-btn" data-wz="later">${mdi("close", 18)}${escape(t("wzLater"))}</button><button type="button" class="dlg-btn" data-wz="never">${mdi("eyeOff", 18)}${escape(t("wzNever"))}</button>${s.hasDraft ? `<button type="button" class="dlg-btn wz-reset" data-wz="reset">${mdi("reset", 18)}${escape(t("wzReset"))}</button>` : ""}</div></div>`;
    } else {
      const list = this.steps();
      const n = list.indexOf(s.step) + 1;
      const pct = Math.round((100 * n) / list.length);
      top = `<div class="wz-top"><div class="wz-stp"><span><b>${escape(t("wzStep", n, list.length))}</b> · ${escape(t(`wzS_${s.step}`))}</span>${close}</div><div class="wz-prog"><i style="width:${pct}%"></i></div></div>`;
      body = this[`${s.step}Html`]();
      const last = s.step === "done";
      foot = `<button type="button" class="dlg-btn" data-wz="back"${s.busy ? " disabled" : ""}>${mdi("arrowLeft", 18)}${escape(t("wzBack"))}</button>
        <button type="button" class="dlg-btn primary" data-wz="${last ? "finish" : "next"}"${s.busy || this.invalid() ? " disabled" : ""}>${last ? mdi("check", 18) : ""}${escape(t(last ? (s.busy ? "wzSaving" : "wzFinish") : "wzNext"))}${last ? "" : mdi("arrowRight", 18)}</button>`;
    }
    // Beim Neuzeichnen im selben Schritt bleibt die Lage (ein Schalter weiter unten springt nicht nach oben)
    const keep = s.drawnStep === s.step ? dlg.querySelector("[data-wz-body]")?.scrollTop || 0 : 0;
    const ask = s.ask && s.d && s.step !== "welcome"
      ? `<div class="wz-ask" data-wz="ask-no" role="alertdialog" aria-label="${escape(t("wzAskTitle"))}"><div class="wz-ask-c" data-wz-stop><b>${escape(t("wzAskTitle"))}</b><p>${escape(t("wzAskText"))}</p>
        <button type="button" class="dlg-btn" data-wz="later">${mdi("close", 18)}${escape(t("wzLater"))}</button><button type="button" class="dlg-btn" data-wz="never">${mdi("eyeOff", 18)}${escape(t("wzNever"))}</button></div></div>`
      : "";
    dlg.innerHTML = `${top}<div class="wz-bd" data-wz-body>${body}</div><div class="wz-ft">${foot}</div>${ask}`;
    const bd = dlg.querySelector("[data-wz-body]");
    if (bd && keep) bd.scrollTop = keep;
    s.drawnStep = s.step;
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
      const vals = this.rowValues(id)
        .map(([key, lab, unit]) => {
          if (isTime(key)) return `<label class="wz-v"><span>${escape(this.t(lab))}</span><input type="time" data-wz-v="${key}" value="${escape(d.v[key])}"${none ? " disabled" : ""}></label>`;
          const [lo, hi] = opts.limits?.[key] || [1, 999];
          return `<label class="wz-v"><span>${escape(this.t(lab))}</span><input type="number" inputmode="numeric" min="${lo}" max="${hi}" step="1" data-wz-v="${key}" value="${escape(d.v[key])}"${none ? " disabled" : ""}><em>${escape(this.t(unit))}</em></label>`;
        })
        .join("");
      const open = PER_INTEGRATION.includes(id) && this.s.openMsg.has(id);
      const list = open ? this.integListMsgHtml(id, none) : "";
      const hint = id === "charge" && d.on.charge && !none && !this.rowIntegrations("charge").some((i) => this.integState("charge", i.domain) !== "off") ? `<p class="wz-p small wz-hint">${escape(this.t("wzChargeHint"))}</p>` : "";
      const chev = !PER_INTEGRATION.includes(id) ? `<span class="wz-mx"></span>` : `<button type="button" class="wz-mx" data-wz-mopen="${id}" aria-expanded="${open}" title="${escape(this.t("wzMInteg"))}" aria-label="${escape(this.t("wzMInteg"))}"><span class="wz-chev${open ? " open" : ""}">${mdi("chevronRight", 16)}</span></button>`;
      return `<div class="wz-msg${d.on[id] && !none ? " on" : ""}"><div class="wz-li">${chev}<span class="wz-ic">${mdi(MSG_ICON[id], 18)}</span><div class="wz-nm">${escape(this.t(`wzM_${id}`))}<small>${escape(this.t(`wzM_${id}_s`))}</small></div>${this.toggle("data-wz-msg", id, d.on[id] && !none, this.t(`wzM_${id}`)).replace("<input", none ? "<input disabled" : "<input")}</div><div class="wz-vals">${vals}</div>${hint}${list}</div>`;
    }).join("");
    return `<h2 class="wz-h2">${escape(this.t("wzMTitle"))}</h2><p class="wz-p">${escape(this.t("wzMText"))}</p>
      <div class="wz-lab">${escape(this.t("wzMTarget"))}</div><label class="wz-sel"><select data-wz-target aria-label="${escape(this.t("wzMTarget"))}">${targets}</select>${mdi("chevronDown", 18)}</label>
      ${none ? `<p class="wz-p small">${escape(this.t("wzMNoTargetHint"))}</p>` : `<div class="wz-testrow"><button type="button" class="dlg-btn" data-wz="test"${this.s.testing ? " disabled" : ""}>${mdi("send", 18)}${escape(this.t("wzTest"))}</button><span class="wz-testres ${this.s.test ? this.s.test.split(":")[0] : ""}" data-wz-testres role="status">${escape(this.testText())}</span></div>`}
      <div class="wz-lab">${escape(this.t("wzMRows"))}</div>${rows}
      <div class="opt-error wz-err" data-wz-err role="alert">${escape(this.invalid())}</div>
      <p class="wz-p small">${escape(this.t("wzMLater"))}</p>`;
  }

  // Aufgeklappt: die Integrationen der Meldungsart, je ein Schalter; Ausfall, Batterie und Laden lassen sich weiter bis zu den Geräten aufklappen
  integListMsgHtml(id, none) {
    const { escape, mdi } = this.h;
    const rows = this.rowIntegrations(id);
    const deep = id !== "new";
    const body = rows.length
      ? rows
          .map((i) => {
            const state = this.integState(id, i.domain);
            const key = `${id}:${i.domain}`;
            const open = deep && this.s.openInt.has(key);
            const chev = deep ? `<button type="button" class="wz-mx" data-wz-iopen="${escape(key)}" aria-expanded="${open}" title="${escape(this.t(id === "updates" ? "wzMUpdates" : "wzMDevices"))}" aria-label="${escape(this.t(id === "updates" ? "wzMUpdates" : "wzMDevices"))}"><span class="wz-chev${open ? " open" : ""}">${mdi("chevronRight", 16)}</span></button>` : "";
            // Ausfall: ein zweiter Schalter (Ring) für den Online-Status der Integration (seit 2.156.0); ohne Status ruht die Meldung
            const ns = id === "outage" ? this.statusSwitch("int", i.domain, i.name) : "";
            const quiet = id === "outage" && this.s.d.noStat.integ.has(i.domain);
            const head = `<div class="wz-li">${chev}${this.host._ibadge(i.domain, i.name)}<div class="wz-nm">${escape(i.name)}<small>${escape(id === "updates" ? this.t("updIntegCount", i.n) : this.t("devicesCount", i.n))}</small></div>${ns}<label class="switch${state === "part" ? " part" : ""}"><input type="checkbox" data-wz-int="${id}" data-wz-dom="${escape(i.domain)}"${state !== "off" ? " checked" : ""}${none || quiet ? " disabled" : ""} aria-label="${escape(i.name)}"><span></span></label></div>`;
            if (!open) return head;
            // Bei ausgeschalteter Integration (Ausfall, Batterie) gelten die Geräte nicht: ausgegraut
            const off = (state === "off" && !["charge", "updates"].includes(id)) || quiet;
            const devs = this.rowDevices(id, i.domain)
              .map((x) => {
                const dquiet = id === "outage" && this.s.d.noStat.dev.has(x.id);
                return `<div class="wz-li${off || dquiet ? " dim" : ""}"><div class="wz-nm">${escape(x.name)}${this.devSub(id, x)}</div>${id === "outage" ? this.statusSwitch("dev", x.id, x.name, quiet) : ""}<label class="switch"><input type="checkbox" data-wz-md="${id}" data-wz-id="${escape(x.id)}"${this.devOn(id, x.id) ? " checked" : ""}${none || off || dquiet ? " disabled" : ""} aria-label="${escape(x.name)}"><span></span></label></div>`;
              })
              .join("");
            return `${head}<div class="wz-sub wz-dsub">${devs}</div>`;
          })
          .join("")
      : `<p class="wz-p small">${escape(this.t("wzMNoInteg"))}</p>`;
    return `<div class="wz-sub wz-msub"><p class="wz-p small">${escape(this.t(`wzMSub_${id}`))}</p>${body}</div>`;
  }

  // Schalter "Online-Status beobachten" (seit 2.156.0) neben dem der Ausfall-Meldung: Ring-Symbol, aus = ohne Online-Status. Eine Integration
  // auf "Nicht überwachen" oder ein Gerät mit eigener Zeit lässt der Assistent, wie es ist (gesperrt); lock sperrt von aussen (Integration aus).
  statusSwitch(kind, key, name, lock = false) {
    const { escape, mdi } = this.h;
    const { d, base } = this.s;
    const own = kind === "int" ? (base.offline_after_integrations || {})[key] : this.overrideList("offline").find((o) => o.id === key)?.value;
    const fixed = own !== undefined && own !== "nostatus";
    const on = !(kind === "int" ? d.noStat.integ : d.noStat.dev).has(key);
    const label = `${this.t("optStatus")}: ${name}`;
    return `<span class="wz-ns" title="${escape(this.t(fixed ? "wzNsFixed" : "optStatus"))}">${mdi("circleOutline", 14)}<label class="switch"><input type="checkbox" data-wz-ns="${kind}" data-wz-key="${escape(key)}"${on ? " checked" : ""}${fixed || lock ? " disabled" : ""} aria-label="${escape(label)}"><span></span></label></span>`;
  }

  testText() {
    const r = this.s.test;
    return r === "ok" ? this.t("wzTestOk") : r === "fail" ? this.t("wzTestFail") : r === "busy" ? this.t("wzTestBusy") : "";
  }

  // Schritt "Labels" (seit 2.155.0, vor der Ruhezeit): ein Label aus Home Assistant wählen und dafür dieselben Wahlen treffen wie bei einer Integration.
  // Ein Label gilt für alle Geräte, die es tragen, vor der Integration und vor den globalen Werten; das Gerät geht immer vor.
  labelsHtml() {
    const { escape, mdi } = this.h;
    const { d, data } = this.s;
    const none = d.target === "none";
    const t = (k, ...a) => this.t(k, ...a);
    const sel = this.s.labSel && d.lab.cfg[this.s.labSel] ? this.s.labSel : "";
    const options = [`<option value=""${sel ? "" : " selected"}>${escape(t("wzLPick"))}</option>`]
      .concat((data.labels || []).map((l) => `<option value="${escape(l.id)}"${l.id === sel ? " selected" : ""}>${escape(`${d.lab.cfg[l.id] ? "✓ " : ""}${l.name} (${t("labelDevs", l.devices)})`)}</option>`))
      .join("");
    const diff = (id) => {
      const c = d.lab.cfg[id];
      const parts = [!c.mon && t("integUnmon"), c.mon && !c.status && t("integNoStatus"), c.after !== "" && t("offlineMin", Number(c.after)), c.delay !== "" && t("diffDelay", t("offlineMin", Number(c.delay))), c.bat === "off" ? t("devBatOff") : c.bat !== "" && `${c.bat} %`,
        !c.push && t("diffNoPush"), !c.batPush && t("optBatPush"), !c.newPush && t("diffNoNew"), c.charge && t("diffCharge"), c.upd !== "default" && `${t("optUpdNotify")}: ${t(c.upd === "on" ? "devChargeOn" : "devChargeOff")}`].filter(Boolean);
      return parts.length ? parts.join(" · ") : t("integStandard");
    };
    const list = d.lab.ids.length
      ? d.lab.ids.map((id) => `<button type="button" class="wz-li wz-lrow${id === sel ? " on" : ""}" data-wz-lsel="${escape(id)}">${this.host._ibadge(`${LABEL_PREFIX}${id}`, this.labelName(id))}<div class="wz-nm">${escape(this.labelName(id))}<small>${escape(diff(id))}</small></div><span class="cbtn" aria-hidden="true">${mdi("chevronRight", 16)}</span></button>`).join("")
      : "";
    return `<h2 class="wz-h2">${escape(t("wzLTitle"))}</h2><p class="wz-p">${escape(t("wzLText"))}</p>
      <div class="wz-lab">${escape(t("wzLChoose"))}</div><label class="wz-sel"><select data-wz-lab aria-label="${escape(t("wzLChoose"))}">${options}</select>${mdi("chevronDown", 18)}</label>
      ${list ? `<div class="wz-lab">${escape(t("wzLDone"))}</div>${list}` : ""}
      ${sel ? this.labelCardHtml(sel, none) : ""}
      <div class="opt-error wz-err" data-wz-err role="alert">${escape(this.labelsInvalid())}</div>
      <p class="wz-p small">${escape(t("wzLLater"))}</p>`;
  }

  // Die Wahlen eines Labels: überwachen und Zeiten, die Meldungen, Batterie, Updates (ohne Ziel sind die Meldungen aus)
  labelCardHtml(id, none) {
    const { escape, mdi } = this.h;
    const t = (k, ...a) => this.t(k, ...a);
    const c = this.s.d.lab.cfg[id];
    const sw = (field, on, label, off = false) => `<label class="switch"><input type="checkbox" data-wz-lc="${escape(id)}" data-wz-lf="${field}"${on ? " checked" : ""}${off ? " disabled" : ""} aria-label="${escape(label)}"><span></span></label>`;
    const timeSel = (field, label, value, std) => {
      const times = [...new Set([...LABEL_TIMES, ...(value !== "" ? [Number(value)] : [])])].sort((a, b) => a - b);
      return `<label class="wz-sel wz-sel-s"><select data-wz-lc="${escape(id)}" data-wz-lf="${field}" aria-label="${escape(label)}"${c.mon && c.status ? "" : " disabled"}><option value=""${value === "" ? " selected" : ""}>${escape(std)}</option>${times.map((m) => `<option value="${m}"${String(m) === value ? " selected" : ""}>${escape(t("offlineMin", m))}</option>`).join("")}</select>${mdi("chevronDown", 18)}</label>`;
    };
    const row = (icon, title, sub, control) => `<div class="wz-li"><span class="wz-ic">${mdi(icon, 18)}</span><div class="wz-nm">${escape(title)}${sub ? `<small>${escape(sub)}</small>` : ""}</div>${control}</div>`;
    const batValues = [...new Set([10, 15, 20, 25, 30, ...(/^\d+$/.test(c.bat) ? [Number(c.bat)] : [])])].sort((a, b) => a - b);
    const batSel = `<label class="wz-sel wz-sel-s"><select data-wz-lc="${escape(id)}" data-wz-lf="bat" aria-label="${escape(t("optBatteryLow"))}"><option value=""${c.bat === "" ? " selected" : ""}>${escape(t("wzLStd"))}</option>${batValues.map((v) => `<option value="${v}"${String(v) === c.bat ? " selected" : ""}>${v} %</option>`).join("")}<option value="off"${c.bat === "off" ? " selected" : ""}>${escape(t("devBatOff"))}</option></select>${mdi("chevronDown", 18)}</label>`;
    const updSel = `<label class="wz-sel wz-sel-s"><select data-wz-lc="${escape(id)}" data-wz-lf="upd" aria-label="${escape(t("optUpdNotify"))}"${none ? " disabled" : ""}><option value="default"${c.upd === "default" ? " selected" : ""}>${escape(t("labelUpdDefault"))}</option><option value="on"${c.upd === "on" ? " selected" : ""}>${escape(t("devChargeOn"))}</option><option value="off"${c.upd === "off" ? " selected" : ""}>${escape(t("devChargeOff"))}</option></select>${mdi("chevronDown", 18)}</label>`;
    const outDim = c.mon && c.status ? "" : "dim";
    return `<div class="wz-msg on wz-lcard"><div class="wz-li">${this.host._ibadge(`${LABEL_PREFIX}${id}`, this.labelName(id))}<div class="wz-nm">${escape(this.labelName(id))}<small>${escape(t("labelDevs", (this.s.data.labels.find((l) => l.id === id) || {}).devices || 0))}</small></div><button type="button" class="dlg-btn wz-lrm" data-wz-lrm="${escape(id)}">${mdi("close", 16)}${escape(t("wzLRemove"))}</button></div>
      ${row("eye", t("optMonitor"), t("optMonitorShort"), sw("mon", c.mon, t("optMonitor")))}
      ${!c.mon ? "" : `<div>${row("circleOutline", t("optStatus"), t("wzLNsSub"), sw("status", c.status, t("optStatus"), !c.mon))}
      <div class="${outDim}">${row("pulse", t("optOfflineAfter"), "", timeSel("after", t("optOfflineAfter"), c.after, t("wzLStd")))}
      ${row("timer", t("optDelay"), "", timeSel("delay", t("optDelay"), c.delay, t("wzLStd")))}
      ${row("alert", t("wzM_outage"), "", sw("push", c.push, t("wzM_outage"), none || !c.mon || !c.status))}</div>
      ${row("battery", t("optBatteryLow"), "", batSel)}
      ${row("battery", t("wzM_battery"), "", sw("batPush", c.batPush, t("wzM_battery"), none))}
      ${row("batteryCharging", t("wzM_charge"), "", sw("charge", c.charge, t("wzM_charge"), none))}</div>
`}
      ${row("sparkle", t("wzM_new"), "", sw("newPush", c.newPush, t("wzM_new"), none))}
      ${row("download", t("wzM_updates"), "", updSel)}
      ${none ? `<p class="wz-p small">${escape(t("wzMNoTargetHint"))}</p>` : ""}</div>`;
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
      <div class="wz-li">${this.h.mdi("bellOff", 18).replace("<svg", '<svg class="wz-ic-svg"')}<div class="wz-nm">${escape(this.t("wzQUse"))}<small>${escape(this.t("wzQUseSub"))}</small></div>${this.toggle("data-wz-quiet", "on", q.on, this.t("wzQUse"))}</div>${q.on ? fields : ""}${this.sysHtml()}`;
  }

  // Unter der Ruhezeit: Meldung bei hoher Auslastung von Prozessor, Arbeitsspeicher und Festplatte mit dem aktuellen Wert, der Grenze und der
  // Mindestdauer (die Werte der Status-App); der Empfänger und "Bei Stillstand melden" bleiben bei ihren Standards und fehlen hier
  sysHtml() {
    const kinds = this.sysShown();
    if (!kinds.length) return "";
    const { escape, mdi } = this.h;
    const { d, opts, data } = this.s;
    const rows = kinds
      .map((k) => {
        const name = this.t(`stSys${k[0].toUpperCase()}${k.slice(1)}`);
        const x = d.sys[k];
        const [lo, hi] = opts.limits?.[sysKey(k, "limit")] || [1, 100];
        const [mlo, mhi] = opts.limits?.[sysKey(k, "minutes")] || [1, 60];
        const vals = `<label class="wz-v"><span>${escape(this.t("wzSysLimit"))}</span><input type="number" inputmode="numeric" min="${lo}" max="${hi}" step="1" data-wz-sys="${k}" data-wz-part="limit" value="${escape(x.limit)}"${x.on ? "" : " disabled"}><em>%</em></label>
          <label class="wz-v"><span>${escape(this.t("wzSysMin"))}</span><input type="number" inputmode="numeric" min="${mlo}" max="${mhi}" step="1" data-wz-sys="${k}" data-wz-part="min" value="${escape(x.min)}"${x.on ? "" : " disabled"}><em>${escape(this.t("stLoadMinUnit"))}</em></label>`;
        return `<div class="wz-msg${x.on ? " on" : ""}"><div class="wz-li"><span class="wz-ic">${mdi("pulse", 18)}</span><div class="wz-nm">${escape(name)}<small>${escape(this.t("wzSysNow", Math.round(data.status[k])))}</small></div>${this.toggle("data-wz-syson", k, x.on, name)}</div><div class="wz-vals">${vals}</div></div>`;
      })
      .join("");
    return `<h2 class="wz-h2 wz-h2b">${escape(this.t("wzSysTitle"))}</h2><p class="wz-p">${escape(this.t("wzSysText"))}</p>${rows}
      <div class="opt-error wz-err" data-wz-err role="alert">${escape(this.sysInvalid())}</div>`;
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
    const labelsRow = this.hasLabels() ? row(t("wzSumLabels"), d.lab.ids.length ? d.lab.ids.map((id) => this.labelName(id)).join(", ") : t("wzNone")) : "";
    const nsCount = d.noStat.integ.size + d.noStat.dev.size + (this.hasLabels() ? d.lab.ids.filter((id) => d.lab.cfg[id].mon && !d.lab.cfg[id].status).length : 0);
    const noStatus = nsCount ? row(t("wzSumNoStatus"), String(nsCount)) : "";
    const sysKinds = d.target === "none" ? [] : this.sysShown();
    const system = sysKinds.length ? row(t("wzSumSystem"), sysKinds.some((k) => d.sys[k].on) ? sysKinds.filter((k) => d.sys[k].on).map((k) => `${t(`stSys${k[0].toUpperCase()}${k.slice(1)}`).replace(/ \(.*\)/, "")} ${d.sys[k].limit} %`).join(", ") : t("wzOff")) : "";
    return `<div class="wz-check">${mdi("check", 30)}</div><h2 class="wz-h2">${escape(t("wzDoneTitle"))}</h2><p class="wz-p">${escape(t("wzDoneText"))}</p>
      <div class="wz-sum">${row(t("wzSumInteg"), t("wzOf", data.integrations.length - d.exI.size, data.integrations.length))}${row(t("wzSumTypes"), t("wzOf", typesOn, types.size))}${row(t("wzSumDevices"), t("wzOf", this.chosen().length, this.afterTypes().length))}${row(t("wzSumTarget"), target)}${row(t("wzSumMsgs"), msgs.length ? msgs.join(", ") : t("wzNone"))}${labelsRow}${noStatus}${quiet}${system}</div>
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
      notify_updates: d.on.updates,
      ...Object.fromEntries(VALUE_KEYS.filter((k) => !isTime(k)).map((k) => [k, n(k)])),
      wizard_state: "done",
      wizard_draft: null,
      wizard_done_at: Math.floor(Date.now() / 1000),
    };
    // Uhrzeit der Update-Meldung nur, wenn sie im Assistenten zu sehen war
    if (d.on.updates && this.rowValues("updates").length && TIME_RE.test(String(d.v.updates_time))) values.updates_time = d.v.updates_time;
    // Je Meldungsart die Integrationen: was der Assistent zeigt, ersetzt die Wahl; Integrationen, die er nicht zeigt, bleiben, wie sie sind.
    // Die Lademeldung gilt nur für gewählte Integrationen (Best Practice: je Integration einschalten); ohne Wahl meldet sie nichts.
    const merge = (id, saved, selected) => {
      const shown = new Set(this.rowIntegrations(id).map((i) => i.domain));
      return [...new Set([...(saved || []).filter((dom) => !shown.has(dom)), ...selected.filter((dom) => shown.has(dom))])].sort();
    };
    const excluded = (id) => this.rowIntegrations(id).map((i) => i.domain).filter((dom) => d.ex[id].has(dom));
    values.notify_exclude_integrations = merge("outage", base.notify_exclude_integrations, excluded("outage"));
    values.battery_push_exclude_integrations = merge("battery", base.battery_push_exclude_integrations, excluded("battery"));
    values.new_exclude_integrations = merge("new", base.new_exclude_integrations, excluded("new"));
    // Voll geladen: eine Integration gilt, wenn die Mehrheit ihrer Geräte an ist; die anderen Geräte bekommen eine eigene Wahl (siehe deviceCalls)
    values.charge_integrations = merge("charge", base.charge_integrations, this.chargeIntegrations());
    Object.assign(values, this.updateLists());
    Object.assign(values, this.statusValues());
    if (this.hasLabels()) Object.assign(values, this.labelValues(values));
    if (d.target !== "none") {
      values.quiet_enabled = d.quiet.on;
      if (d.quiet.on && d.quiet.uniform) values.quiet_days = Array.from({ length: 7 }, () => ({ on: true, from: d.quiet.from, to: d.quiet.to }));
      // Systemauslastung: nur die Arten, die der Assistent zeigte; Grenze und Mindestdauer nur bei eingeschalteter Meldung (sonst bleiben die Werte)
      for (const k of this.sysShown()) {
        const x = d.sys[k];
        values[sysKey(k, "alert")] = x.on;
        if (x.on) {
          values[sysKey(k, "limit")] = Number(x.limit);
          values[sysKey(k, "minutes")] = Number(x.min);
        }
      }
    }
    // Ohne Ziel sind Meldungen und Ruhezeit nicht Teil der Wahl: nichts anfassen ausser dem Ziel
    if (d.target === "none") for (const k of ["notify_outage", "notify_online", "battery_push", "notify_new", "notify_charge", "notify_updates", "notify_exclude_integrations", "battery_push_exclude_integrations", "new_exclude_integrations", "charge_integrations", "updates_integrations_on", "updates_integrations_off", "updates_exclude", "updates_include"]) delete values[k];
    return values;
  }

  // Ohne Online-Status (seit 2.156.0): die Integrationen mit "nostatus" in der Zuordnung "Ausgefallen nach"; nur die Integrationen, die der Assistent
  // zeigt, ändern sich (andere Einträge, auch Zeiten und "off", bleiben). Die Geräte stehen in deviceCalls.
  statusValues() {
    const { d, base } = this.s;
    const map = { ...(base.offline_after_integrations || {}) };
    for (const i of this.rowIntegrations("outage")) {
      if (map[i.domain] === "off" || Number.isInteger(map[i.domain])) continue;
      if (d.noStat.integ.has(i.domain)) map[i.domain] = "nostatus";
      else if (map[i.domain] === "nostatus") delete map[i.domain];
    }
    return { offline_after_integrations: Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b))) };
  }

  // Die Einstellungen der Labels (seit 2.155.0) in die Zuordnungen und Listen pro Integration: was der Assistent zeigt, ersetzt die Wahl der Labels,
  // die er kennt (eingerichtete und gewählte); andere Schlüssel bleiben. Nur was vom Standard abweicht, wird geschrieben.
  labelValues(values) {
    const { d, base } = this.s;
    const managed = new Set([...(base.labels || []), ...d.lab.ids].map((id) => `${LABEL_PREFIX}${id}`));
    const out = { labels: [...d.lab.ids] };
    const maps = Object.fromEntries(LABEL_MAPS.map((k) => [k, Object.fromEntries(Object.entries(values[k] ?? base[k] ?? {}).filter(([key]) => !managed.has(key)))]));
    const lists = Object.fromEntries(LABEL_LISTS.map((k) => [k, (values[k] ?? base[k] ?? []).filter((key) => !managed.has(key))]));
    for (const id of d.lab.ids) {
      const c = d.lab.cfg[id];
      const key = `${LABEL_PREFIX}${id}`;
      if (!c.mon) maps.offline_after_integrations[key] = "off";
      else if (!c.status) maps.offline_after_integrations[key] = "nostatus";
      else if (c.after !== "") maps.offline_after_integrations[key] = Number(c.after);
      if (c.delay !== "") maps.notify_delay_integrations[key] = Number(c.delay);
      if (c.bat === "off") maps.battery_low_integrations[key] = "off";
      else if (c.bat !== "") maps.battery_low_integrations[key] = Number(c.bat);
      if (!c.push) lists.notify_exclude_integrations.push(key);
      if (!c.batPush) lists.battery_push_exclude_integrations.push(key);
      if (!c.newPush) lists.new_exclude_integrations.push(key);
      if (c.charge) lists.charge_integrations.push(key);
      if (c.upd === "on") lists.updates_integrations_on.push(key);
      if (c.upd === "off") lists.updates_integrations_off.push(key);
    }
    for (const k of LABEL_MAPS) out[k] = Object.fromEntries(Object.entries(maps[k]).sort(([a], [b]) => a.localeCompare(b)));
    for (const k of LABEL_LISTS) out[k] = [...new Set(lists[k])].sort();
    return out;
  }

  // Integrationen mit Batteriegeräten, deren Lademeldung gilt: alle Geräte an oder mindestens die Hälfte (der Rest wird am Gerät ausgeschaltet)
  chargeIntegrations() {
    return this.rowIntegrations("charge")
      .filter((i) => {
        const devs = this.rowDevices("charge", i.domain);
        return devs.filter((x) => this.s.d.chargeOn.has(x.id)).length * 2 >= devs.length && devs.some((x) => this.s.d.chargeOn.has(x.id));
      })
      .map((i) => i.domain);
  }

  // Update-Meldungen: je Integration (Plattform) an oder aus, je Eintrag nur, was davon abweicht; die Arten oben (updates_kinds) bleiben, wie sie sind.
  // Gespeichert wird das Kleinste, das den Entwurf trifft: folgt alles seiner Art, steht nichts da.
  updateLists() {
    const { d, base } = this.s;
    const kinds = new Set(base.updates_kinds || []);
    const items = this.updateItems();
    const plats = new Set(items.map((x) => x.platform || x.kind));
    const ids = new Set(items.map((x) => x.id));
    const on = (base.updates_integrations_on || []).filter((p) => !plats.has(p));
    const off = (base.updates_integrations_off || []).filter((p) => !plats.has(p));
    const exclude = (base.updates_exclude || []).filter((id) => !ids.has(id));
    const include = (base.updates_include || []).filter((id) => !ids.has(id));
    for (const p of plats) {
      const group = items.filter((x) => (x.platform || x.kind) === p);
      const want = (x) => d.updOn.has(x.id);
      const count = group.filter(want).length;
      const integ = count * 2 >= group.length;
      // Eine Ausnahme für die Integration nur, wenn ihre Einträge sonst nicht der Art folgten
      const needInteg = group.some((x) => kinds.has(x.kind) !== integ) && group.some((x) => want(x) !== kinds.has(x.kind));
      if (needInteg) (integ ? on : off).push(p);
      for (const x of group) {
        const follows = needInteg ? integ : kinds.has(x.kind);
        if (want(x) !== follows) (want(x) ? include : exclude).push(x.id);
      }
    }
    const sort = (list) => [...new Set(list)].sort();
    return { updates_integrations_on: sort(on), updates_integrations_off: sort(off), updates_exclude: sort(exclude), updates_include: sort(include) };
  }

  // Eigene Einstellungen je Gerät, die der Entwurf ändert (nur wirklich geänderte; Geräte ausserhalb der Wahl bleiben, wie sie sind).
  // Ergebnis: Liste von Änderungen für set_device_settings; leer ohne Push-Ziel.
  deviceCalls() {
    const { d, opts } = this.s;
    // Ohne Push-Ziel gibt es keine Meldungen zu wählen; "Ohne Online-Status" (seit 2.156.0) hängt nicht am Ziel
    const none = d.target === "none";
    const calls = new Map();
    const set = (id, change) => calls.set(id, { ...(calls.get(id) || {}), device_id: id, ...change });
    const baseOff = new Set((opts.overrides?.notify || []).map((o) => o.id));
    const baseBat = new Set((opts.overrides?.battery || []).filter((o) => o.value === "off").map((o) => o.id));
    const baseCharge = new Map((opts.overrides?.charge || []).filter((o) => typeof o.value?.on === "boolean").map((o) => [o.id, o.value.on]));
    for (const x of none ? [] : this.chosen()) {
      const off = d.devOff.outage.has(x.id);
      if (off && !baseOff.has(x.id)) set(x.id, { notify: false });
      else if (!off && baseOff.has(x.id)) set(x.id, { notify: true });
      if (x.battery) {
        const boff = d.devOff.battery.has(x.id);
        if (boff && !baseBat.has(x.id)) set(x.id, { battery: "off" });
        else if (!boff && baseBat.has(x.id)) set(x.id, { battery: null });
      }
    }
    // Ohne Online-Status (seit 2.156.0): eigene Wahl des Geräts; eine eigene Zeit oder "Nicht überwachen" am Gerät lässt der Assistent stehen
    const baseOffline = new Map((opts.overrides?.offline || []).map((o) => [o.id, o.value]));
    for (const x of this.chosen()) {
      const has = baseOffline.get(x.id);
      if (has !== undefined && has !== "nostatus") continue;
      const want = d.noStat.dev.has(x.id);
      if (want && has === undefined) set(x.id, { offline: "nostatus" });
      else if (!want && has === "nostatus") set(x.id, { offline: null });
    }
    // Lademeldung: Gerät an/aus gegen die Integration (siehe chargeIntegrations)
    const included = new Set(this.chargeIntegrations());
    for (const i of none ? [] : this.rowIntegrations("charge")) {
      for (const x of this.rowDevices("charge", i.domain)) {
        const on = d.chargeOn.has(x.id);
        // gewünschte eigene Wahl: keine, wenn das Gerät der Integration folgt
        const want = on === included.has(i.domain) ? null : on;
        const has = baseCharge.has(x.id) ? baseCharge.get(x.id) : null;
        if (want !== has) set(x.id, { charge: want });
      }
    }
    return [...calls.values()];
  }

  async finish() {
    const s = this.s;
    if (!s || s.busy) return;
    s.busy = true;
    s.saveError = "";
    this.render();
    try {
      // Erst die Geräte, dann der Abschluss: scheitert ein Aufruf, bleibt der Assistent offen und lässt sich wiederholen
      for (const call of this.deviceCalls()) await this.host._hass.callWS({ type: "device_panel/set_device_settings", ...call });
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
      const mopen = ev.target.closest?.("[data-wz-mopen]");
      if (mopen && this.s) {
        const id = mopen.dataset.wzMopen;
        if (this.s.openMsg.has(id)) this.s.openMsg.delete(id);
        else this.s.openMsg.add(id);
        this.render();
        return;
      }
      const iopen = ev.target.closest?.("[data-wz-iopen]");
      if (iopen && this.s) {
        const key = iopen.dataset.wzIopen;
        if (this.s.openInt.has(key)) this.s.openInt.delete(key);
        else this.s.openInt.add(key);
        this.render();
        return;
      }
      if (ev.target.closest?.("[data-wz-stop]") && !ev.target.closest("[data-wz]")) return;
      const btn = ev.target.closest?.("[data-wz]");
      if (!btn || btn.disabled || !this.s) return;
      const a = btn.dataset.wz;
      if (a === "close") this.requestClose();
      else if (a === "start" || a === "next") this.next();
      else if (a === "back") this.back();
      else if (a === "ask-no") {
        this.s.ask = false;
        this.render();
      } else if (a === "later") this.close();
      else if (a === "reset") this.resetDraft();
      else if (a === "never") this.never();
      else if (a === "finish") this.finish();
      else if (a === "retry") this.load();
      else if (a === "test") this.test();
    });
    // Schritt "Labels": ein Label der Liste öffnen oder entfernen (Entwurf)
    dlg.addEventListener("click", (ev) => {
      const s = this.s;
      if (!s?.d) return;
      const open = ev.target.closest?.("[data-wz-lsel]");
      const rm = ev.target.closest?.("[data-wz-lrm]");
      if (open) {
        s.labSel = open.dataset.wzLsel;
        this.render();
      } else if (rm) {
        const id = rm.dataset.wzLrm;
        s.d.lab.ids = s.d.lab.ids.filter((x) => x !== id);
        delete s.d.lab.cfg[id];
        s.labSel = "";
        this.render();
      }
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
      } else if (el.matches("[data-wz-int]")) {
        const id = el.dataset.wzInt;
        const dom = el.dataset.wzDom;
        if (id === "charge" || id === "updates") {
          // Die Integration setzt alle ihre Einträge (Geräte mit Batterie, update-Entitäten); das schaltet die Meldung selbst mit ein
          const set = id === "charge" ? d.chargeOn : d.updOn;
          for (const x of this.rowDevices(id, dom)) {
            if (el.checked) set.add(x.id);
            else set.delete(x.id);
          }
          if (el.checked) d.on[id] = true;
        } else if (el.checked) d.ex[id].delete(dom);
        else d.ex[id].add(dom);
        this.render();
      } else if (el.matches("[data-wz-md]")) {
        const id = el.dataset.wzMd;
        const dev = el.dataset.wzId;
        if (id === "charge" || id === "updates") {
          const set = id === "charge" ? d.chargeOn : d.updOn;
          if (el.checked) {
            set.add(dev);
            d.on[id] = true;
          } else set.delete(dev);
        } else if (el.checked) d.devOff[id].delete(dev);
        else d.devOff[id].add(dev);
        this.render();
      } else if (el.matches("[data-wz-ns]")) {
        const set = el.dataset.wzNs === "int" ? d.noStat.integ : d.noStat.dev;
        flip(set, el.dataset.wzKey, el.checked);
        this.render();
      } else if (el.matches("[data-wz-lab]")) {
        // Ein Label wählen: es ist damit eingerichtet (ohne Wahl gilt der Standard)
        const id = el.value;
        s.labSel = id;
        if (id && !d.lab.cfg[id]) {
          d.lab.ids.push(id);
          d.lab.cfg[id] = this.labelDefault();
        }
        this.render();
      } else if (el.matches("[data-wz-lc]")) {
        const c = d.lab.cfg[el.dataset.wzLc];
        const field = el.dataset.wzLf;
        if (c && field in c) c[field] = el.type === "checkbox" ? el.checked : el.value;
        this.render();
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
      } else if (el.matches("[data-wz-syson]")) {
        d.sys[el.dataset.wzSyson].on = el.checked;
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
      } else if (el.matches("[data-wz-sys]")) {
        s.d.sys[el.dataset.wzSys][el.dataset.wzPart] = el.value;
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

  // Entwurf verwerfen: zurück auf den jetzigen Stand der Einstellungen
  resetDraft() {
    const s = this.s;
    if (!s?.base) return;
    s.d = this.draftFrom(s.base);
    s.start = JSON.stringify(this.snapshot(s.d));
    s.hasDraft = false;
    s.savedDraft = "";
    this.host._hass.callWS({ type: "device_panel/set_options", values: { wizard_draft: null } }).catch(() => {});
    this.render();
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
