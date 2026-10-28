/**
 * Routinen im Geräte-Popup und in den Einstellungen (seit 2.21.0, docs/mockups/timer-v1).
 *
 * Eine Routine schaltet eine schaltbare Entität eines Geräts einmalig (in X Minuten oder an einem Datum) oder wiederholt
 * (täglich, wöchentlich, monatlich), auf Wunsch mit "danach wieder zurückschalten" und einer Push-Meldung mit festem
 * Inhalt. Aufbau wie Magic Push (magic-push.js): Der Reiter im Popup schreibt nur in einen eigenen Behälter (.rt-root)
 * und hält seinen Stand im Speicher; das Popup baut sich alle 10 Sekunden neu auf, darum setzt attach() den Behälter
 * danach wieder zusammen. Der Assistent (vier Schritte: Was · Wann · Meldung · Name und Prüfung) hat ein eigenes Fenster
 * (dialog.routine-dlg, gleiche Stile wie das von Magic Push). Nächste Ausführungen, Meldungstext und Ziel kommen als
 * Vorschau vom Server (routine_preview), damit Panel und Meldung dieselbe Rechnung benutzen (Zeitzone der Instanz).
 * Routinen gehören den Geräten und werden sofort gespeichert, nicht mit "Speichern" der Einstellungen.
 *
 * Schaltoptionen (seit 2.52.0, docs/mockups/timer-light-v1): Kann die gewählte Entität beim Einschalten etwas einstellen
 * (Licht: Helligkeit und Farbe, Rollladen: Position, Klima: Temperatur und Modus, Medien: Lautstärke, Ventilator: Stufe),
 * kommt zwischen "Was schalten" und "Wann" eine eigene Seite "Optionen" mit einer Vorschau (geschaltet wird dabei nichts).
 * Die Seite hat die Nummer 5, steht aber in der Reihenfolge an zweiter Stelle (steps()); die übrigen Nummern bleiben, wie sie
 * waren. Was einstellbar ist, liefert der Server je Entität ("options"); ohne Angabe bleibt alles wie zuletzt.
 *
 * Auslöser (seit 2.54.0, docs/mockups/timer-trigger-v1 und -v2): Im Schritt "Wann" wählt ein Umschalter zwischen "Zu einer Zeit" und
 * "Durch einen Auslöser" (Bedingungen auf Entitäten wie bei Magic Push, Zeitfenster, Pause). Das Zurückschalten hat eine eigene Seite
 * (Nummer 6, zwischen "Wann" und "Meldung"): nie, nach einer Dauer, zu einer Uhrzeit oder durch einen Auslöser. Der Bedingungs-Editor
 * und die beiden Seiten stehen in routine-trigger.js und werden hier an die Klasse gehängt.
 */

const MODULE_VERSION = new URL(import.meta.url).search;
const { triggerMethods, triggerDefaults, triggerFromRoutine, triggerPayload } = await import(`./routine-trigger.js${MODULE_VERSION}`);

// Letzter Schritt (Name und Prüfung); die Seite "Optionen" (5) steht in steps() zwischen 1 und 2, nur wenn die Entität etwas kann
const STEPS = 4;
const ENT_SEARCH_MIN = 7;
const OPTS_STEP = 5;
const BACK_STEP = 6;
const DELAY_PRESETS = [300, 900, 1800, 3600];
const BACK_PRESETS = [600, 1800, 3600, 10800];
const UNITS = [60, 3600, 86400];
const PREVIEW_DELAY_MS = 300;
export const DOMAIN_EMOJI = { number: "🎚️", select: "🔽", switch: "🔌", light: "💡", fan: "🌀", cover: "🪟", lock: "🔒", valve: "🚿", siren: "🚨", humidifier: "💧", input_boolean: "🔘", climate: "🌡️", media_player: "🔊" };
// Schnellwahl unter den Reglern (zusätzlich zu "Wie zuletzt")
// Regler-Beschreibung vom Server auf brauchbare Zahlen bringen (seit 2.101.0): Eine Entität kann Unsinn melden (Text statt
// Zahl, min grösser als max, Schritt 0). Der Regler fällt dann auf die üblichen Grenzen zurück, statt kaputt zu gehen.
const SPEC_DEFAULTS = { percent: [0, 100, 1], number: [0, 100, 1], kelvin: [2000, 6500, 1], temperature: [7, 35, 0.5] };

function finiteNumber(v, fallback) {
  const ok = (typeof v === "number" || (typeof v === "string" && v.trim() !== "")) && Number.isFinite(Number(v));
  return ok ? Number(v) : fallback;
}

function cleanSpec(spec) {
  if (!spec || typeof spec !== "object") return spec;
  const d = SPEC_DEFAULTS[spec.type];
  if (d) {
    let min = finiteNumber(spec.min, d[0]);
    let max = finiteNumber(spec.max, d[1]);
    if (!(min < max)) [min, max] = [d[0], d[1]];
    let step = finiteNumber(spec.step, d[2]);
    if (!(step > 0 && step <= max - min)) step = d[2];
    return { ...spec, min, max, step };
  }
  if (spec.type === "choice" || spec.type === "pick") return { ...spec, values: Array.isArray(spec.values) ? spec.values.filter((v) => typeof v === "string") : [] };
  return spec;
}

const QUICK = { brightness_pct: [25, 50, 100], percentage: [25, 50, 100], position: [0, 50, 100], volume_pct: [25, 50, 75] };
// Farben zur Wahl: Name (Schlüssel rtCol_*), Anzeige, Wert für die Lampe
const COLOURS = [
  ["red", "#ff3b30", [255, 59, 48]],
  ["orange", "#ff9500", [255, 149, 0]],
  ["yellow", "#ffd60a", [255, 214, 10]],
  ["green", "#34c759", [52, 199, 89]],
  ["cyan", "#5ac8fa", [90, 200, 250]],
  ["blue", "#0a84ff", [10, 132, 255]],
  ["purple", "#af52de", [175, 82, 222]],
  ["pink", "#ff2d55", [255, 45, 85]],
];
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

// Schlüssel für Beschriftungen: Knopf/Verb der Aktion und Wort des Ergebnisses je Art der Entität
const actKey = (domain, action) => {
  if (action === "toggle") return "toggle";
  if (domain === "cover" || domain === "valve") return action === "on" ? "open" : "close";
  if (domain === "lock") return action === "on" ? "lock" : "unlock";
  return action;
};
const resKey = (domain, action) => {
  if (action === "toggle") return "toggled";
  if (domain === "cover" || domain === "valve") return action === "on" ? "open" : "closed";
  if (domain === "lock") return action === "on" ? "locked" : "unlocked";
  return action;
};
const opposite = (action) => (action === "on" ? "off" : action === "off" ? "on" : null);
// Lässt sich nach dieser Aktion zurückschalten? Ein/Aus mit dem Gegenstück, "setzen" (Zahl, Auswahl; seit 2.80.0) nur mit "wie vorher"
const canBack = (action) => opposite(action) !== null || action === "set";
const pad = (n) => String(n).padStart(2, "0");

// Farbe einer Lampe bei einer Farbtemperatur (Näherung nach Tanner Helland), nur für die Vorschau
export function kelvinRgb(kelvin) {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;
  const clamp = (v) => Math.round(Math.min(255, Math.max(0, v)));
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clamp(r), clamp(g), clamp(b)];
}
const toHex = (rgb) => `#${rgb.map((v) => pad(Math.round(v).toString(16))).join("")}`;
const fromHex = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// Szenen (seit 2.61.0) stehen nicht in DOMAIN_EMOJI: der Reiter "Schalter" im Geräte-Popup zeigt nur, was sich bedienen lässt
export const routineEmoji = (domain) => (domain === "scene" ? "🎬" : DOMAIN_EMOJI[domain] || "⚡");
// Sammelstellen für Szenen und Gruppen ohne Gerät (seit 2.61.0)
const HOLDERS = { "@scenes": { emoji: "🎬", key: "rtHolderScenes", count: "rtScenesCount", kind: "rtKindScene" }, "@groups": { emoji: "💡", key: "rtHolderGroups", count: "rtGroupsCount", kind: "rtKindGroup" } };
// Art der Einträge auf der ersten Seite des Assistenten: Filter oben und Pille an Szenen und Gruppen (seit 2.66.0)
const KIND_OF = { "@scenes": "scene", "@groups": "group" };
const KIND_TABS = [["all", "rtFilterAll"], ["device", "rtKindDevices"], ["group", "rtHolderGroups"], ["scene", "rtHolderScenes"]];
export const isHolder = (id) => Object.prototype.hasOwnProperty.call(HOLDERS, id);

export function splitSeconds(seconds, units) {
  for (const u of [...units].reverse()) if (seconds >= u && seconds % u === 0) return { text: String(seconds / u), unit: u };
  return { text: String(Math.round(seconds / units[0])), unit: units[0] };
}

export class RoutineUi {
  constructor(host, deps) {
    this.host = host;
    this.h = deps;
    this.root = null;
    this.reset();
  }

  // --- Stand ------------------------------------------------------------------

  reset() {
    window.clearTimeout(this._pvTimer);
    window.clearInterval(this._tick);
    this._tick = null;
    this.deviceId = null;
    this.data = null;
    this.loading = false;
    this.error = null;
    this.view = "list";
    this.wiz = null;
    this.standalone = false;
    this.closeWin();
    // q, filter, open, sopen (seit 2.174.0): Suche, Filter und Auf-/Zuklappen der Liste im Reiter des Geräts
    this.ui = { confirmId: null, flash: "", error: "", busy: null, q: "", filter: "all", open: {}, sopen: {} };
    this._pendingEdit = null;
    this._offset = 0;
  }

  t(key, ...args) {
    return this.host._t(key, ...args);
  }

  esc(value) {
    return this.h.escape(value);
  }

  // Brücken für routine-trigger.js (die Hilfsfunktionen dieser Datei sind nicht öffentlich)
  actionKey(domain, action) {
    return actKey(domain, action);
  }

  opposite(action) {
    return opposite(action);
  }

  backPresets() {
    return BACK_PRESETS;
  }

  wizardOpen() {
    return this.view === "wizard" && Boolean(this.wiz);
  }

  win() {
    return this.host.shadowRoot?.querySelector("dialog.routine-dlg") || null;
  }

  q(selector) {
    return this.win()?.querySelector(selector) || null;
  }

  qa(selector) {
    return this.win()?.querySelectorAll(selector) || [];
  }

  inScope(el) {
    return Boolean(this.root?.contains(el) || this.win()?.contains(el));
  }

  closeWin() {
    const win = this.win();
    if (!win) return;
    if (win.open) win.close();
    win.innerHTML = "";
  }

  // Zahl der eingeschalteten Routinen für die Beschriftung des Reiters (null: noch nicht geladen)
  count(deviceId) {
    if (!this.data || this.deviceId !== deviceId) return null;
    return this.data.routines.filter((x) => x.enabled).length;
  }

  // --- Laden ------------------------------------------------------------------

  editWhenLoaded(routineId) {
    this._pendingEdit = routineId;
    this.applyPending();
  }

  applyPending() {
    if (!this._pendingEdit || !this.data) return;
    const routine = this.data.routines.find((x) => x.id === this._pendingEdit);
    this._pendingEdit = null;
    if (routine) this.startWizard(routine);
  }

  open(deviceId, standalone = false) {
    if (this.deviceId !== deviceId) {
      this.reset();
      this.deviceId = deviceId;
    }
    this.standalone = standalone;
    this.load(deviceId);
  }

  async load(deviceId) {
    this.deviceId = deviceId;
    this.loading = !this.data;
    this.error = null;
    try {
      const result = await this.host._hass.callWS({ type: "device_panel/routine_get", device_id: deviceId });
      if (this.deviceId !== deviceId) return;
      this.data = result;
      this._offset = Number.isFinite(result.now) ? result.now * 1000 - Date.now() : 0;
      this.applyPending();
    } catch (err) {
      if (this.deviceId !== deviceId) return;
      this.error = this.h.errText(err);
      const all = this.standalone ? this.host._rtAll : null;
      if (all) {
        all.err = this.t("rtLoadError", this.error);
        this._pendingEdit = null;
        this.host._renderRtAll?.();
      }
    }
    this.loading = false;
    this.refresh();
  }

  refresh() {
    if (this.host._detailId !== this.deviceId) return;
    if (this.host._devTab === "routine" && this.root?.isConnected) this.paint();
    this.host._renderDevice(true);
  }

  attach(root) {
    this.root = root;
    if (!this.data && !this.loading && !this.error && this.deviceId) this.load(this.deviceId);
    if (!this.wizardOpen()) this.paint();
  }

  call(msg) {
    return this.host._hass.callWS(msg);
  }

  // --- Zeit und Texte ---------------------------------------------------------

  serverNow() {
    return (Date.now() + this._offset) / 1000;
  }

  entity(id) {
    const e = this.data?.entities.find((x) => x.entity_id === id) || null;
    // Die Regler-Beschreibungen einmal bereinigen (siehe cleanSpec); neu geladene Entitäten kommen wieder durch hierher
    if (e && Array.isArray(e.options) && !e._specsClean) {
      e.options = e.options.map(cleanSpec);
      e._specsClean = true;
    }
    return e;
  }

  domainOf(entityId) {
    return String(entityId || "").split(".")[0];
  }

  // Wochentag kurz (0 = Montag)
  wd(i) {
    return this.t("rtWd")[i];
  }

  dateText(local, withWeekday = true) {
    const [y, m, d] = local.date.split("-").map(Number);
    try {
      return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(this.host._locale(), { weekday: withWeekday ? "short" : undefined, day: "numeric", month: "numeric", year: local.date.slice(0, 4) !== (this.data?.today || this._today || "").slice(0, 4) ? "numeric" : undefined, timeZone: "UTC" });
    } catch (err) {
      return local.date;
    }
  }

  // "heute 20:00", "morgen 06:30", sonst "Mi., 14.10. 06:30"
  localText(local) {
    if (!local) return "";
    const today = this.data?.today || this._today;
    if (today) {
      const [y, m, d] = today.split("-").map(Number);
      const tomorrow = new Date(Date.UTC(y, m - 1, d + 1));
      const tom = `${tomorrow.getUTCFullYear()}-${pad(tomorrow.getUTCMonth() + 1)}-${pad(tomorrow.getUTCDate())}`;
      if (local.date === today) return `${this.t("rtToday")} ${local.time}`;
      if (local.date === tom) return `${this.t("rtTomorrow")} ${local.time}`;
    }
    return `${this.dateText(local)} ${local.time}`;
  }

  // Dauer auf die Sekunde genau, ohne Rundung (seit 2.26.0): 690 Min. = "11 Std. 30 Min.", nicht "11 Std."; Nullen entfallen
  fmtDur(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const parts = [];
    if (d) parts.push(`${d} ${this.t("dayUnit")}`);
    if (h) parts.push(`${h} ${this.t("hourUnit")}`);
    if (m) parts.push(`${m} ${this.t("minuteUnit")}`);
    if (s || !parts.length) parts.push(`${s} ${this.t("rtSecUnit")}`);
    return parts.join(" ");
  }

  fmtClock(seconds) {
    const s = Math.max(0, Math.round(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
  }

  niceTarget(value) {
    const name = String(value || "").replace(/^notify\./, "").replace(/^mobile_app_/, "").replace(/_/g, " ");
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : String(value || "");
  }

  targetSub() {
    const d = this.data?.default_target;
    return String(d || "").startsWith("notify.") ? d : this.t("rtTargetNone");
  }

  limit(name, fallback) {
    return this.data?.limits?.[name] ?? fallback;
  }

  // Wort des Zustands einer Entität
  stateWord(e) {
    if (!e) return "";
    if (!e.available) return this.t("rtUnreachable");
    if (e.domain === "scene") return ""; // Zustand einer Szene ist der Zeitpunkt der letzten Auslösung, keine Angabe für die Wahl
    const key = `rtState_${e.state}`;
    const word = this.t(key);
    return word == null ? String(e.state ?? "") : word;
  }

  // Zahl mit dem Dezimalzeichen der Sprache (21,5)
  fmtNum(n) {
    try {
      return Number(n).toLocaleString(this.host._locale(), { maximumFractionDigits: 2 });
    } catch (err) {
      return String(n);
    }
  }

  // Farbtemperatur als Wort: warmweiss, neutralweiss, kaltweiss
  kelvinWord(kelvin) {
    return this.t(`rtKelvinWord_${kelvin < 3200 ? "warm" : kelvin < 4800 ? "neutral" : "cold"}`);
  }

  colourName(rgb) {
    const hit = COLOURS.find(([, , c]) => c.every((v, i) => v === rgb[i]));
    return hit ? this.t(`rtCol_${hit[0]}`) : this.t("rtColOwn");
  }

  // Die Einstellungen als Teile: ["40 %", "warmweiss (2700 K)"]; leer, wenn nichts eingestellt ist
  optionParts(options) {
    const o = options || {};
    const unit = this.host._hass?.config?.unit_system?.temperature || "°C";
    const parts = [];
    if (o.brightness_pct != null) parts.push(`${o.brightness_pct} %`);
    if (o.color_temp_kelvin != null) parts.push(`${this.kelvinWord(o.color_temp_kelvin)} (${o.color_temp_kelvin} K)`);
    if (Array.isArray(o.rgb_color)) parts.push(this.colourName(o.rgb_color));
    if (o.position != null) parts.push(`${o.position} %`);
    if (o.temperature != null) parts.push(`${this.fmtNum(o.temperature)} ${unit}`);
    if (o.hvac_mode) parts.push(this.t(`rtHvac_${o.hvac_mode}`));
    if (o.volume_pct != null) parts.push(`${o.volume_pct} %`);
    if (o.percentage != null) parts.push(`${o.percentage} %`);
    return parts;
  }

  // Der Wert, auf den "setzen" stellt: vom Server (set_text) oder aus dem Entwurf (Zahl mit Einheit der Entität, Auswahl)
  setText(rt) {
    if (rt.set_text) return rt.set_text;
    const o = rt.options || {};
    if (o.option !== undefined) return String(o.option);
    if (o.value === undefined) return "";
    const unit = (this.entity(rt.entity_id)?.options || []).find((x) => x.key === "value")?.unit;
    return `${this.fmtNum(o.value)}${unit ? ` ${unit}` : ""}`;
  }

  // "Steckdose einschalten, nach 20 Min. wieder aus"; mit Optionen "Lampe einschalten (40 %, warmweiss), nach 20 Min. wieder wie vorher"
  sentenceOf(rt, entityName) {
    const domain = this.domainOf(rt.entity_id);
    if (rt.action === "set") {
      const set = this.t("rtVerbSet", this.setText(rt));
      const back = this.backText(rt);
      return `${entityName} ${set}${back ? `, ${back}` : ""}`;
    }
    const opts = rt.action === "on" ? rt.options : null;
    const parts = this.optionParts(opts);
    let verb = this.t(`rtVerb_${actKey(domain, rt.action)}`);
    if (domain === "cover" && opts?.position != null) verb = this.t("rtVerbPosition", opts.position);
    else if (parts.length) verb += ` (${parts.join(", ")})`;
    let text = `${entityName} ${verb}`;
    const back = this.backText(rt);
    if (back) text += `, ${back}`;
    return text;
  }

  // Das Zurückschalten als Satzteil (seit 2.54.0 mit vier Arten): "nach 20 Min. wieder aus", "um 23:30 wieder wie vorher",
  // "wieder aus, wenn Terrassentür ist offen, spätestens nach 6 Std."; leer ohne Zurückschalten
  backText(rt) {
    const domain = this.domainOf(rt.entity_id);
    const kind = rt.back_kind || (rt.back_s ? "duration" : "none");
    if (kind === "none" || !canBack(rt.action)) return "";
    const word = rt.back_mode === "restore" || rt.action === "set" ? this.t("rtRestoreWord") : this.t(`rtRes_${resKey(domain, opposite(rt.action))}`);
    if (kind === "duration") return rt.back_s ? this.t("rtBackText", this.fmtDur(rt.back_s), word) : "";
    if (kind === "time") return rt.back_time ? this.t("rtBackTime", rt.back_time, word) : "";
    this.learnEnts(rt.condition_entities);
    const cond = this.treeText(rt.back_conditions);
    if (!cond) return "";
    return `${this.t("rtBackTrig", word, cond)}${rt.back_max_s ? `, ${this.t("rtBackMax", this.fmtDur(rt.back_max_s))}` : ""}`;
  }

  // Der Entwurf als Routinen-Angaben für Sätze (wie vom Server, plus Zeit und Wiederholung)
  draftRt() {
    const d = this.wiz.draft;
    return { ...this.payload(), entity_id: d.entity_id, weekdays: d.weekdays, mday: d.mday, time: d.time, date: d.date, delay_s: d.delay_s };
  }

  // Wann: "Täglich um 20:00", "Mo, Mi, Fr um 06:30", "Monatlich am 1. um 09:00", "Einmalig, 24.12. um 17:00", "Einmalig, in 30 Min."
  whenText(rt) {
    if (rt.kind === "trigger") {
      this.learnEnts(rt.condition_entities);
      const cond = this.treeText(rt.conditions);
      const base = cond ? this.t("rtWhenTrigger", cond) : this.t("rtWhenTriggerShort");
      return rt.window ? `${base}, ${this.t("rtWhenWindow", rt.window.from, rt.window.to)}` : base;
    }
    if (rt.kind === "countdown") return this.t("rtWhenCountdown", this.fmtDur(rt.delay_s));
    if (rt.kind === "once") return rt.date ? this.t("rtWhenOnce", this.dateText({ date: rt.date }), rt.time) : this.t("rtWhenOnceNext", rt.time);
    if (rt.repeat === "daily") return this.t("rtWhenDaily", rt.time);
    if (rt.repeat === "weekly") return this.t("rtWhenWeekly", (rt.weekdays || []).map((i) => this.wd(i)).join(", "), rt.time);
    return this.t("rtWhenMonthly", rt.mday === -1 ? this.t("rtLastDayShort") : `${rt.mday}.`, rt.time);
  }

  sentence(rt) {
    return `${this.whenText(rt)} · ${this.sentenceOf(rt, rt.entity_name || rt.entity_id)}`;
  }

  // --- Reiter im Popup --------------------------------------------------------

  paint() {
    if (this.view === "wizard" && this.wiz) {
      this.paintWindow();
      return;
    }
    if (!this.root?.isConnected) return;
    // Es wird gerade im Suchfeld getippt (der Reiter baut sich alle 10 s neu auf): nur die Liste neu zeichnen, das Feld behält Fokus und Cursor
    const typing = this.root.getRootNode?.().activeElement;
    if (typing?.dataset?.rt === "list-search" && this.root.contains(typing) && this.data?.routines?.length) {
      this.paintList();
      return;
    }
    this.root.innerHTML = this.listHtml();
    this.startTick();
  }

  // Name des Geräts (oder der Sammelstelle Szenen/Gruppen) für die Überschrift des Protokolls
  deviceName() {
    if (isHolder(this.deviceId)) return this.t(HOLDERS[this.deviceId].key);
    return this.host._devices?.find((d) => d.id === this.deviceId)?.name || "";
  }

  listHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    let html = `<h3>${esc(t("rtTab"))}</h3><p class="mg-note">${esc(t("rtIntro"))}</p>`;
    if (this.ui.flash) html += `<div class="mg-flash" role="status">${esc(this.ui.flash)}</div>`;
    if (this.ui.error) html += `<div class="dlg-error">${esc(this.ui.error)}</div>`;
    if (!this.data) {
      if (this.error) {
        return `${html}<div class="dlg-error">${esc(t("rtLoadError", this.error))}</div><button type="button" class="qbtn" data-rt="reload">${esc(t("rtRetry"))}</button>`;
      }
      return `${html}<p class="mg-note">${esc(t("rtLoading"))}</p>`;
    }
    // Alle Routinen pausiert (seit 2.175.0): im Reiter des Geräts sichtbar, sonst wundert man sich, warum nichts schaltet
    if (this.data.paused) html += `<div class="opt-warn rt-paused-note" role="status">${this.h.mdi("alert", 14)}<span>${esc(this.pausedNote(this.data.paused_until))}</span></div>`;
    const routines = this.data.routines;
    if (!routines.length) html += `<p class="mg-empty">${esc(this.data.entities.length ? t("rtEmpty") : t("rtNoEntities"))}</p>`;
    else html += this.listControlsHtml(routines) + `<div data-rt-zone>${this.listZoneHtml()}</div>`;
    const full = routines.length >= this.limit("per_device", 20);
    if (full) html += `<p class="mg-hint">${esc(t("rtLimit", this.limit("per_device", 20)))}</p>`;
    else if (this.data.entities.length) html += `<button type="button" class="mg-add" data-rt="add">${this.h.mdi("plus", 18)}${esc(t("rtAdd"))}</button>`;
    return html;
  }

  // Suche und Filter über der Liste im Reiter des Geräts (seit 2.174.0, wie im Fenster mit allen Routinen, ohne Herz): immer da, sobald es eine Routine gibt
  listControlsHtml(routines) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const ph = t("listSearch");
    const q = this.ui.q || "";
    const c = this.allCounts(routines);
    const tabs = [["all", "rtFilterAll"], ["on", "rtFilterOn"], ["off", "rtFilterOff"], ["running", "rtFilterRunning"]];
    const n = this.listFiltering() ? t("listSearchOf", this.listShown().length, routines.length) : "";
    return `<label class="list-search" data-for="rt-dev">${this.h.mdi("search", 18)}<input type="search" data-rt="list-search" value="${esc(q)}" placeholder="${esc(ph)}" aria-label="${esc(ph)}" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false"><span class="n">${esc(n)}</span>${this.host._fieldClearHtml("data-fc", "", q)}</label>
      <div class="sub-tabs mg-tabs mg-filter" role="tablist">${tabs
        .map(([k, label]) => `<button type="button" role="tab" class="sub-tab two${k === (this.ui.filter || "all") ? " on" : ""}" data-rt="list-filter" data-v="${k}" aria-selected="${k === (this.ui.filter || "all")}"><span class="tab-l">${esc(t(label))}</span> <span class="tab-s">${c[k]}</span></button>`)
        .join("")}</div>`;
  }

  listFiltering() {
    return Boolean(String(this.ui.q || "").trim()) || (this.ui.filter || "all") !== "all";
  }

  listShown() {
    const q = String(this.ui.q || "").trim();
    return (this.data?.routines || []).filter((x) => this.passes(x, q, this.ui.filter || "all"));
  }

  // Aufgeklappt: wie im Fenster mit allen Routinen: sobald mehr als eine zu sehen ist, sind alle zu (auch bei Suche und Filter); eine eigene Wahl gilt, bis Suche oder Filter wechseln
  listOpen(id, n) {
    const own = this.listFiltering() ? this.ui.sopen : this.ui.open;
    if (own && id in own) return own[id] !== false;
    return n === 1;
  }

  listZoneHtml() {
    const shown = this.listShown();
    if (!shown.length) return `<p class="mg-note mg-none">${this.esc(this.t("listSearchNone"))}</p>`;
    return shown.map((x) => (this.listOpen(x.id, shown.length) ? this.clockHtml(x, shown.length > 1) : this.rowHtml(x))).join("");
  }

  // Nur die Liste neu zeichnen (Suche, Filter, Auf- und Zuklappen): das Suchfeld behält seinen Zustand
  paintList() {
    const zone = this.root?.querySelector("[data-rt-zone]");
    if (!zone || !this.data) return;
    zone.innerHTML = this.listZoneHtml();
    const n = this.root.querySelector(".list-search .n");
    if (n) n.textContent = this.listFiltering() ? this.t("listSearchOf", this.listShown().length, this.data.routines.length) : "";
    this.startTick();
  }

  // Zugeklappte Routine im Reiter des Geräts: Uhrzeit (oder Auslöser), Name, wann als Nächstes, Schalter im Kopf, Pfeil zum Aufklappen
  rowHtml(rt) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const domain = rt.domain || this.domainOf(rt.entity_id);
    const running = rt.running && rt.due;
    let time;
    if (running) time = `${esc(this.fmtClock(Math.max(0, rt.due - this.serverNow())))}<small>${esc(t("rtFilterRunning"))}</small>`;
    else if (rt.kind === "trigger") time = `⚡<small>${esc(t("rtTrigBadge"))}</small>`;
    else {
      const sub = rt.kind === "once" ? (rt.date ? this.dateText({ date: rt.date }) : t("rtOnceShort")) : rt.repeat === "monthly" ? t("rtMonthlyOn", rt.mday === -1 ? t("rtLastDayShort") : `${rt.mday}.`) : "";
      time = `${esc(rt.time || this.localTimeOf(rt))}${sub ? `<small>${esc(sub)}</small>` : ""}`;
    }
    let next;
    if (running) next = `<span class="mg-on">${esc(t("rtRunningShort"))}</span>`;
    else if (rt.kind === "trigger" && rt.enabled) next = `<span class="mg-on">${esc(this.waitsText(rt))}</span>`;
    else if (rt.enabled && rt.due_local) next = `${esc(t("rtNextRun"))} <span class="mg-on">${esc(this.localText(rt.due_local))}</span>`;
    else if (rt.done) next = esc(t("rtDone"));
    else next = esc(t(rt.enabled ? "rtFilterOn" : "rtDisabled"));
    const warn = this.statusHtml(rt).find((x) => x.includes("mg-warn"));
    return `<div class="mg-dcard closed rt-rowcard${rt.enabled ? "" : " off"}"><div class="mg-dwrap"><button type="button" class="mg-dhead" data-rt="list-fold" data-id="${esc(rt.id)}" aria-expanded="false">
        <span class="rt-rtime" aria-hidden="true">${time}</span>
        <span class="mg-t"><b>${routineEmoji(domain)} ${esc(rt.name)}</b><small class="mg-dsum">${next}${warn ? ` · ${warn}` : ""}</small></span><span class="mg-dslot" aria-hidden="true"></span>${this.chevHtml(false)}</button><span class="mg-dsw">${this.switchHtml(rt, { dlg: false, rt: true })}</span></div></div>`;
  }

  // Zeile unter dem Satz: zuletzt, Fehler, verpasst, Entität
  statusHtml(rt) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const out = [];
    if (rt.entity_missing) out.push(`<span class="mg-warn">${esc(t("rtEntityMissing"))}</span>`);
    const last = rt.last;
    if (last) {
      const ago = this.serverNow() - last.at;
      const when = ago < 60 ? t("rtJustNow") : t("rtAgo", this.host._fmtSeconds(ago, true));
      if (last.what === "failed") out.push(`<span class="mg-warn">${esc(t("rtFailed", t(`rtReason_${last.reason || "error"}`)))}</span> ${esc(when)}`);
      else if (last.what === "retry") out.push(`<span class="mg-warn">${esc(t("rtRetrying", t(`rtReason_${last.reason || "error"}`)))}</span>`);
      else if (last.what === "missed") out.push(`<span class="mg-warn">${esc(t("rtMissed"))}</span> ${esc(when)}`);
      else if (last.what === "paused") out.push(esc(t("rtSkippedPaused")) + ` ${esc(when)}`);
      else if (last.ok) out.push(esc(t("rtLastRun", when)));
    }
    return out;
  }

  // Wecker-Stil (docs/mockups/timer-v1, Variante B): Uhrzeit gross, Wochentage als Zeile, darunter nächster Lauf
  clockHtml(rt, foldable = false) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const confirming = this.ui.confirmId === rt.id;
    const domain = rt.domain || this.domainOf(rt.entity_id);
    const name = rt.entity_name || rt.entity_id;
    const running = rt.running && rt.due;
    let left;
    if (running) {
      const total = Number(rt.delay_s) || 1;
      const rem = Math.max(0, rt.due - this.serverNow());
      const circ = 2 * Math.PI * 26;
      left = `<div class="rt-ring" data-rt-due="${rt.due}" data-total="${total}"><svg viewBox="0 0 62 62" aria-hidden="true"><circle class="bg" cx="31" cy="31" r="26"/><circle class="fg" cx="31" cy="31" r="26" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${(circ * (1 - rem / total)).toFixed(1)}"/></svg><span data-rt-left>${esc(this.fmtClock(rem))}</span></div>`;
    } else if (rt.kind === "trigger") {
      left = `<div class="time">⚡<small>${esc(t("rtTrigBadge"))}</small></div>`;
    } else {
      const sub = rt.kind === "once" ? (rt.date ? this.dateText({ date: rt.date }) : t("rtOnceShort")) : rt.repeat === "monthly" ? t("rtMonthlyOn", rt.mday === -1 ? t("rtLastDayShort") : `${rt.mday}.`) : "";
      left = `<div class="time">${esc(rt.time || this.localTimeOf(rt))}${sub ? `<small>${esc(sub)}</small>` : ""}</div>`;
    }
    const sw = `<label class="switch"><input type="checkbox" data-rt="toggle" data-id="${esc(rt.id)}"${rt.enabled ? " checked" : ""} aria-label="${esc(rt.name)}"><span></span></label>`;
    // sentenceOf liefert Text (mit dem Namen der Entität), nicht HTML: hier escapen (seit 2.99.2, vorher als HTML eingesetzt)
    const what = `${esc(this.sentenceOf(rt, name))}${rt.kind === "countdown" ? ` · ${esc(t("rtOnceShort"))}` : ""}${rt.push ? ` · 🔔 ${esc(rt.target ? this.niceTarget(rt.target) : t("rtTargetDefaultShort"))}` : ""}`;
    const days = rt.kind === "repeat" && (rt.repeat === "daily" || rt.repeat === "weekly")
      ? `<div class="rt-days">${WEEKDAYS.map((i) => `<i class="${rt.repeat === "daily" || (rt.weekdays || []).includes(i) ? "on" : ""}">${esc(this.wd(i))}</i>`).join("")}</div>`
      : "";
    const status = this.statusHtml(rt);
    let next;
    if (running) next = `<span>${esc(t("rtRemaining"))} <b data-rt-left2>${esc(this.fmtClock(Math.max(0, rt.due - this.serverNow())))}</b></span>`;
    else if (rt.kind === "trigger" && rt.enabled) next = `<span>${esc(this.waitsText(rt))}</span>`;
    else if (rt.enabled && rt.due_local) next = `<span>${esc(t("rtNextRun"))} <b>${esc(this.localText(rt.due_local))}</b></span>`;
    else if (rt.done) next = `<span class="rt-tag grey">${esc(t("rtDone"))}</span>`;
    else next = `<span>${esc(t("rtDisabled"))}</span>`;
    if (rt.revert_local) next += `<span>${esc(t("rtRevertAt", rt.revert_local.time))}</span>`;
    const acts = confirming
      ? ""
      : `<span class="acts"><button type="button" class="linkbtn" data-rt="edit" data-id="${esc(rt.id)}">${esc(t("rtActEdit"))}</button>
         <button type="button" class="linkbtn" data-rt="run" data-id="${esc(rt.id)}"${this.ui.busy === rt.id ? " disabled" : ""}>${esc(t("rtActRun"))}</button>
         <button type="button" class="linkbtn" data-proto="routine" data-id="${esc(rt.id)}" data-device="${esc(rt.device_id)}" data-name="${esc(rt.name)}">${esc(t("prAct"))}</button>
         <button type="button" class="linkbtn danger" data-rt="delete" data-id="${esc(rt.id)}">${esc(t("rtActDelete"))}</button></span>`;
    const confirm = confirming
      ? `<div class="mg-confirm"><b>${esc(t("rtDeleteAsk", rt.name))}</b><small>${esc(t("rtDeleteNote"))}</small>
          <div class="mg-btns small"><button type="button" class="dlg-btn" data-rt="delete-no">${this.h.mdi("close", 18)}${esc(t("rtCancel"))}</button><button type="button" class="dlg-btn danger" data-rt="delete-yes" data-id="${esc(rt.id)}">${this.h.mdi("trash", 18)}${esc(t("rtDeleteYes"))}</button></div></div>`
      : "";
    const fold = foldable ? `<button type="button" class="rt-fold" data-rt="list-fold" data-id="${esc(rt.id)}" aria-expanded="true" title="${esc(t("rtFoldOne"))}" aria-label="${esc(t("rtFoldOne"))}">${this.chevHtml(true)}</button>` : "";
    return `<div class="rt-clock${rt.enabled ? "" : " off"}"><div class="top">${left}<span class="grow"></span>${sw}${fold}</div>
      <div class="name">${routineEmoji(domain)} ${esc(rt.name)}</div><div class="what">${what}</div>${days}
      ${status.length ? `<div class="what">${status.join(" · ")}</div>` : ""}
      <div class="next">${next}${acts}</div>${confirm}</div>`;
  }

  // Eine Auslöser-Routine in der Liste: wartet auf den Auslöser, oder ist eingeschaltet und wartet auf das Zurückschalten
  waitsText(rt) {
    this.learnEnts(rt.condition_entities);
    return rt.waiting_end ? this.t("rtWaitsEnd", this.treeText(rt.back_conditions)) : this.t("rtWaitsTrigger");
  }

  localTimeOf(rt) {
    return rt.due_local?.time || "";
  }

  // Restzeit eines laufenden Countdowns jede Sekunde nachführen, ohne den Behälter neu zu zeichnen
  startTick() {
    window.clearInterval(this._tick);
    this._tick = null;
    if (!this.root?.querySelector("[data-rt-due]")) return;
    this._tick = window.setInterval(() => {
      if (!this.root?.isConnected) {
        window.clearInterval(this._tick);
        this._tick = null;
        return;
      }
      let expired = false;
      for (const el of this.root.querySelectorAll("[data-rt-due]")) {
        const rem = Number(el.dataset.rtDue) - this.serverNow();
        if (rem <= 0) expired = true;
        const total = Number(el.dataset.total) || 1;
        const text = this.fmtClock(rem);
        const span = el.querySelector("[data-rt-left]");
        if (span) span.textContent = text;
        const fg = el.querySelector("circle.fg");
        if (fg) fg.setAttribute("stroke-dashoffset", String((2 * Math.PI * 26 * (1 - Math.max(0, rem) / total)).toFixed(1)));
        const card = el.closest(".rt-clock");
        const b = card?.querySelector("[data-rt-left2]");
        if (b) b.textContent = text;
      }
      if (expired) {
        window.clearInterval(this._tick);
        this._tick = null;
        window.setTimeout(() => this.load(this.deviceId), 1500);
      }
    }, 1000);
  }

  // --- Einstellungen: Übersicht aller Routinen -----------------------------------

  allCounts(routines) {
    return {
      all: routines.length,
      on: routines.filter((x) => x.enabled).length,
      off: routines.filter((x) => !x.enabled).length,
      running: routines.filter((x) => x.running || x.reverting).length,
      fav: routines.filter((x) => this.isStar(x.id)).length,
    };
  }

  // Attribut für Aktionen: in den Einstellungen "data-set", im Fenster mit allen Routinen (all.dlg) "data-rta"
  a(all, action) {
    return all.dlg ? `data-rta="${action}"` : `data-set="${action}"`;
  }

  allQuery(all) {
    return String(all?.dlg ? all.query || "" : this.host._settings?.search?.routines || "").trim();
  }

  haystack(rt) {
    return `${rt.name} ${rt.device_name} ${rt.entity_name} ${rt.entity_id} ${this.sentence(rt)} ${rt.target || ""}`.toLowerCase();
  }

  allGroups(all, devices) {
    const groups = new Map();
    for (const rt of all.routines || []) {
      const dev = devices.find((d) => d.id === rt.device_id);
      const holder = isHolder(rt.device_id) ? HOLDERS[rt.device_id] : null;
      if (!groups.has(rt.device_id)) groups.set(rt.device_id, { id: rt.device_id, name: holder ? this.t(holder.key) : rt.device_name || dev?.name || "", dev, holder, routines: [] });
      groups.get(rt.device_id).routines.push(rt);
    }
    // Szenen und Gruppen ohne Gerät stehen nach den Geräten
    return [...groups.values()].sort((a, b) => Boolean(a.holder) - Boolean(b.holder) || a.name.localeCompare(b.name));
  }

  // Lieblings-Routinen (Herz, seit 2.26.0): liegen pro Benutzer in den Benutzerdaten, eigener Reiter in "Alle Routinen"
  isStar(id) {
    return Boolean(this.host._rtStars?.has(id));
  }

  passes(rt, q, filter) {
    if (filter === "on" && !rt.enabled) return false;
    if (filter === "off" && rt.enabled) return false;
    if (filter === "running" && !rt.running && !rt.reverting) return false;
    if (filter === "fav" && !this.isStar(rt.id)) return false;
    return !q || this.haystack(rt).includes(q.toLowerCase());
  }

  isFiltering(all) {
    return Boolean(this.allQuery(all)) || (all.filter || "all") !== "all";
  }

  // Aufgeklappt (seit 2.171.0): in jeder Ansicht und auch bei einer Suche zu, sobald mehr als ein Gerät sichtbar ist; bei genau einem Gerät offen.
  // Eine eigene Wahl (Tipp auf den Kopf) gilt, bis Filter oder Suche wechseln. nGroups = Zahl der sichtbaren Geräte.
  isOpen(all, id, nGroups) {
    const own = this.isFiltering(all) ? all.sopen : all.open;
    if (own && id in own) return own[id] !== false;
    return nGroups === 1;
  }

  visibleGroups(all, devices) {
    const q = this.allQuery(all);
    const filter = all.filter || "all";
    return this.allGroups(all, devices)
      .map((g) => ({ ...g, shown: g.routines.filter((x) => this.passes(x, q, filter)) }))
      .filter((g) => g.shown.length);
  }

  toggleFold(all, devices, id) {
    const n = this.visibleGroups(all, devices).length;
    const open = this.isOpen(all, id, n);
    if (this.isFiltering(all)) (all.sopen ||= {})[id] = !open;
    else (all.open ||= {})[id] = !open;
  }

  foldAll(all, devices) {
    const groups = this.visibleGroups(all, devices);
    const n = groups.length;
    const anyOpen = groups.some((g) => this.isOpen(all, g.id, n));
    for (const g of groups) {
      if (this.isFiltering(all)) (all.sopen ||= {})[g.id] = !anyOpen;
      else (all.open ||= {})[g.id] = !anyOpen;
    }
  }

  // Schalter "Alle Routinen pausieren"; pausiert, steht darunter in Warnfarbe, dass nichts schaltet
  // Text der Warnung: mit "bis" nennt er den Zeitpunkt, an dem alles wieder läuft (seit 2.175.0)
  pausedNote(until) {
    return until > 0 ? this.t("rtPausedUntilNote", this.host._fmtTime(until, true, true)) : this.t("rtPausedNote");
  }

  pauseHtml(all) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const label = esc(t("optRoutinesPause"));
    return `<div class="opt rt-pause${all.paused ? " on" : ""}"><div class="opt-line"><span class="opt-label">${label}</span>
        <label class="switch"><input type="checkbox" data-rta="routines-pause" ${all.paused ? "checked" : ""}${all.pauseBusy ? " disabled" : ""} aria-label="${label}"><span></span></label></div>
        ${all.paused ? `<div class="opt-warn" role="status">${this.h.mdi("alert", 14)}<span>${esc(this.pausedNote(all.pausedUntil))}</span></div>` : `<div class="opt-short">${esc(t("optRoutinesPauseShort"))}</div>`}</div>`;
  }

  overviewHtml(all, devices) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    // "Alle Routinen pausieren" ganz oben (seit 2.79.0, Spiegel der Einstellung "Routinen"): gilt sofort, ohne "Speichern"
    let html = all.dlg && typeof all.paused === "boolean" ? this.pauseHtml(all) : "";
    html += `<p class="mg-note">${esc(t(all.dlg ? "rtAllDlgIntro" : "rtAllIntro"))}</p>`;
    if (all.flash) html += `<div class="mg-flash" role="status">${esc(all.flash)}</div>`;
    if (all.error && !all.routines) {
      return `${html}<div class="dlg-error">${esc(t("rtLoadError", all.error))}</div><button type="button" class="qbtn" ${this.a(all, "routine-reload")}>${esc(t("rtRetry"))}</button>`;
    }
    if (all.err) html += `<div class="dlg-error">${esc(all.err)}</div>`;
    if (!all.routines) return `${html}<p class="mg-note">${esc(t("rtLoading"))}</p>`;
    if (!all.routines.length) return `${html}<p class="mg-empty">${esc(t("rtAllEmpty"))}</p>`;
    const q = all.dlg ? String(all.query || "") : String(this.host._settings?.search?.routines || "");
    const ph = t("listSearch");
    html += `<label class="list-search" data-for="routines">${this.h.mdi("search", 18)}<input type="search" data-lsearch="routines" value="${esc(q)}" placeholder="${esc(ph)}" aria-label="${esc(ph)}" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false"><span class="n"></span>${this.host._fieldClearHtml(all.dlg ? "data-rta-clear" : "data-lclear", "routines", q)}</label>`;
    const c = this.allCounts(all.routines);
    // Reiter mit Herz (seit 2.26.0): nur, solange es eine Lieblings-Routine gibt; das Fenster öffnet dann auf diesem Reiter
    if (all.dlg && !all.tabInit) {
      all.tabInit = true;
      if (c.fav) all.filter = "fav";
    }
    if ((all.filter || "all") === "fav" && !c.fav) all.filter = "all";
    const filter = all.filter || "all";
    const tabs = [["all", "rtFilterAll"], ["on", "rtFilterOn"], ["off", "rtFilterOff"], ["running", "rtFilterRunning"], ...(c.fav ? [["fav", "rtFilterFav"]] : [])];
    html += `<div class="sub-tabs mg-tabs mg-filter" role="tablist">${tabs
      .map(([k, label]) => `<button type="button" role="tab" class="sub-tab two${k === filter ? " on" : ""}${k === "fav" ? " fav" : ""}" ${this.a(all, "routine-filter")} data-v="${k}" aria-selected="${k === filter}"${k === "fav" ? ` aria-label="${esc(t(label))}"` : ""}><span class="tab-l">${k === "fav" ? this.h.mdi("heart", 16) : esc(t(label))}</span> <span class="tab-s">${c[k]}</span></button>`)
      .join("")}</div>`;
    return `${html}<div data-rt-all-zone data-q="${esc(q)}">${this.overviewListHtml(all, devices)}</div>`;
  }

  overviewListHtml(all, devices) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const groups = this.visibleGroups(all, devices);
    const nGroups = groups.length;
    const shown = groups.reduce((n, g) => n + g.shown.length, 0);
    all.shown = { n: shown, total: all.routines.length, filtering: this.isFiltering(all) };
    if (!groups.length) return `<p class="mg-note mg-none">${esc(t("listSearchNone"))}</p>`;
    const anyOpen = groups.some((g) => this.isOpen(all, g.id, nGroups));
    let html = `<div class="mg-allcount"><span class="mg-count">${esc(t("rtAllCount", shown, groups.length))}</span><button type="button" class="linkbtn" ${this.a(all, "routine-fold-all")}>${esc(t(anyOpen ? "rtFoldAll" : "rtUnfoldAll"))}</button></div>`;
    for (const g of groups) {
      const open = this.isOpen(all, g.id, nGroups);
      const offN = g.shown.filter((x) => !x.enabled).length;
      const nextRt = g.shown.filter((x) => x.enabled && x.due_local).sort((a, b) => a.due - b.due)[0];
      // Aufgeklappt: Bereich und "Gerät öffnen" in der Zeile unter dem Namen (seit 2.171.0, vorher eine eigene Fusszeile); zugeklappt die Zusammenfassung
      const sub = open
        ? [g.holder ? "" : [g.dev?.area, g.dev?.integration?.name].filter(Boolean).map(esc).join(" · "), g.holder ? "" : `<span class="mg-dopen" data-rta-open data-device="${esc(g.id)}" role="link">${esc(t("rtAllOpenDevice"))} ›</span>`].filter(Boolean).join(" · ")
        : `${esc(t("rtSumRoutines", g.shown.length))}${offN ? ` · ${esc(t("rtSumOff", offN))}` : ""}${nextRt ? ` · <span class="mg-on">${esc(t("rtSumNext", this.localText(nextRt.due_local)))}</span>` : ""}`;
      const sum = sub ? `<small class="${open ? "" : "mg-dsum"}">${sub}</small>` : "";
      // Zugeklappt (seit 2.171.0): bei genau einer Routine sitzt ihr Schalter im Kopf statt der Zahl, bei mehreren folgt je Routine eine schlanke Zeile mit Schalter
      const one = !open && g.shown.length === 1 ? g.shown[0] : null;
      const lead = one ? `<span class="mg-dslot" aria-hidden="true"></span>` : open ? `<span class="mg-badge">${g.shown.length}</span>` : "";
      html += `<div class="mg-dcard${open ? "" : " closed"}"><div class="mg-dwrap"><button type="button" class="mg-dhead" ${this.a(all, "routine-fold-dev")} data-device="${esc(g.id)}" aria-expanded="${open}">
        <span class="mg-devic" aria-hidden="true">${g.holder ? g.holder.emoji : this.h.typeIcon(g.dev?.type || "other", 18)}</span>
        <span class="mg-t"><b>${esc(g.name)}</b>${sum}</span>${lead}${this.chevHtml(open)}</button>${one ? `<span class="mg-dsw">${this.switchHtml(one, all)}</span>` : ""}</div>`;
      if (open) html += g.shown.map((x) => this.overviewCardHtml(x, all)).join("");
      else if (g.shown.length > 1) html += g.shown.map((x) => this.lineHtml(x, all)).join("");
      html += `</div>`;
    }
    return html;
  }

  // Schalter einer Routine (Kopf der zugeklappten Karte, Zeile und aufgeklappte Karte teilen ihn)
  switchHtml(rt, all) {
    // Reiter des Geräts (seit 2.174.0): derselbe Schalter wie in der aufgeklappten Karte (data-rt="toggle")
    if (all?.rt) return `<label class="switch"><input type="checkbox" data-rt="toggle" data-id="${this.esc(rt.id)}"${rt.enabled ? " checked" : ""} aria-label="${this.esc(rt.name)}"><span></span></label>`;
    return `<label class="switch"><input type="checkbox" ${this.a(all, "routine-toggle")} data-id="${this.esc(rt.id)}"${rt.enabled ? " checked" : ""} aria-label="${this.esc(rt.name)}"><span></span></label>`;
  }

  // Schlanke Zeile unter dem Kopf einer zugeklappten Karte mit mehreren Routinen (seit 2.171.0): Name, wann als Nächstes, Schalter
  lineHtml(rt, all) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const next = rt.running ? `<span class="mg-on">${esc(t("rtRunningShort"))}</span>` : rt.kind === "trigger" && rt.enabled ? `<span class="mg-on">${esc(this.waitsText(rt))}</span>` : rt.enabled && rt.due_local ? `${esc(t("rtNextRun"))} <span class="mg-on">${esc(this.localText(rt.due_local))}</span>` : esc(t(rt.enabled ? "rtFilterOn" : "rtFilterOff"));
    return `<div class="mg-rline${rt.enabled ? "" : " off"}"><span class="mg-t"><b>${esc(rt.name)}</b><small>${next}</small></span>${this.switchHtml(rt, all)}</div>`;
  }

  overviewCardHtml(rt, all) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const confirming = all.confirmId === rt.id;
    const sw = this.switchHtml(rt, all);
    const acts = confirming
      ? ""
      : `<div class="mg-acts"><button type="button" class="linkbtn" ${this.a(all, "routine-edit")} data-device="${esc(rt.device_id)}" data-id="${esc(rt.id)}">${esc(t("rtActEdit"))}</button>
        <button type="button" class="linkbtn" ${this.a(all, "routine-run")} data-id="${esc(rt.id)}"${(all.dlg ? all.busy : this.ui.busy) === rt.id ? " disabled" : ""}>${esc(t("rtActRun"))}</button>
        <button type="button" class="linkbtn" data-proto="routine" data-id="${esc(rt.id)}" data-device="${esc(rt.device_id)}" data-name="${esc(rt.name)}">${esc(t("prAct"))}</button>
        <button type="button" class="linkbtn danger" ${this.a(all, "routine-delete")} data-id="${esc(rt.id)}">${esc(t("rtActDelete"))}</button>
        <button type="button" class="linkbtn fav${this.isStar(rt.id) ? " on" : ""}" ${this.a(all, "routine-star")} data-id="${esc(rt.id)}" aria-pressed="${this.isStar(rt.id)}" title="${esc(t(this.isStar(rt.id) ? "rtFavRemove" : "rtFavAdd"))}" aria-label="${esc(t(this.isStar(rt.id) ? "rtFavRemove" : "rtFavAdd"))}">${this.h.mdi(this.isStar(rt.id) ? "heart" : "heartOutline", 20)}</button></div>`;
    const confirm = confirming
      ? `<div class="mg-confirm"><b>${esc(t("rtDeleteAsk", rt.name))}</b><small>${esc(t("rtDeleteNote"))}</small>
          <div class="mg-btns small"><button type="button" class="dlg-btn" ${this.a(all, "routine-delete-no")}>${this.h.mdi("close", 18)}${esc(t("rtCancel"))}</button><button type="button" class="dlg-btn danger" ${this.a(all, "routine-delete-yes")} data-id="${esc(rt.id)}">${this.h.mdi("trash", 18)}${esc(t("rtDeleteYes"))}</button></div></div>`
      : "";
    // Ergebnis von "Ausführen" im Fenster mit allen Routinen (seit 2.74.0): direkt in der Karte, oben in einer langen Liste sähe man es nicht
    const ran = all.dlg && all.ran?.id === rt.id ? `<div class="${all.ran.ok ? "mg-flash" : "dlg-error"} rt-ran" role="status" data-rt-ran>${esc(all.ran.text)}</div>` : "";
    const status = this.statusHtml(rt);
    // Wartet auf das Zurückschalten: wann, steht in der Zeile (Reiter "Läuft", seit 2.26.0)
    const backWord = rt.reverting && rt.revert_local && canBack(rt.action) ? (rt.action === "set" ? t("rtRestoreWord") : this.t(`rtRes_${resKey(rt.domain, opposite(rt.action))}`)) : "";
    if (backWord) status.unshift(`<span class="mg-on">${esc(rt.back_mode === "restore" || rt.action === "set" ? t("rtBackAtRowRestore", this.localText(rt.revert_local)) : t("rtBackAtRow", backWord, this.localText(rt.revert_local)))}</span>`);
    const next = rt.running ? `<span class="mg-on">${esc(t("rtRunningShort"))}</span>` : rt.kind === "trigger" && rt.enabled ? `<span class="mg-on">${esc(this.waitsText(rt))}</span>` : rt.enabled && rt.due_local ? `${esc(t("rtNextRun"))} <span class="mg-on">${esc(this.localText(rt.due_local))}</span>` : rt.done ? esc(t("rtDone")) : esc(t("rtDisabled"));
    return `<div class="mg-card${rt.enabled ? "" : " off"}"><div class="mg-row"><span class="mg-ic" aria-hidden="true">${routineEmoji(rt.domain)}</span>
      <div class="mg-t"><b>${esc(rt.name)}</b><small>${esc(this.sentence(rt))}</small><small class="mg-status">${[next, ...status].join(" · ")}</small></div>${sw}</div>${acts}${ran}${confirm}</div>`;
  }

  chevHtml(open) {
    return `<span class="mg-lchev${open ? " up" : ""}" aria-hidden="true"><span class="cbtn">${this.h.mdi("chevronDown", 16)}</span></span>`;
  }

  // --- Aktionen auf Routinen (Popup und Übersicht) ------------------------------

  replaceRoutine(routine) {
    for (const list of [this.data?.routines, this.host._rtAll?.routines]) {
      if (!list) continue;
      const i = list.findIndex((x) => x.id === routine.id);
      if (i >= 0) list[i] = { ...list[i], ...routine };
    }
  }

  async toggle(id, enabled, input) {
    try {
      const r = await this.call({ type: "device_panel/routine_enable", routine_id: id, enabled });
      this.replaceRoutine(r.routine);
      this.ui.error = "";
    } catch (err) {
      this.ui.error = this.t("rtToggleError", this.h.errText(err));
      if (input) input.checked = !enabled;
    }
    this.afterChange();
  }

  async run(id) {
    if (this.ui.busy) return;
    this.ui.busy = id;
    this.afterChange();
    try {
      const r = await this.call({ type: "device_panel/routine_run", routine_id: id });
      this.replaceRoutine(r.routine);
      this.ui.error = r.ok ? "" : this.t("rtRunFailed", this.t(`rtReason_${r.reason || "error"}`));
      this.ui.flash = r.ok ? this.t("rtRunDone") : "";
    } catch (err) {
      this.ui.error = this.t("rtRunFailed", this.h.errText(err));
    }
    this.ui.busy = null;
    this.afterChange();
  }

  async remove(id) {
    try {
      await this.call({ type: "device_panel/routine_delete", routine_id: id });
      if (this.data) this.data.routines = this.data.routines.filter((x) => x.id !== id);
      const all = this.host._rtAll;
      if (all?.routines) all.routines = all.routines.filter((x) => x.id !== id);
      this.ui.confirmId = null;
      this.ui.error = "";
    } catch (err) {
      this.ui.error = this.t("rtDeleteError", this.h.errText(err));
    }
    this.afterChange();
  }

  afterChange() {
    if (this.host._devTab === "routine" && this.root?.isConnected && !this.wizardOpen()) this.paint();
    this.host._renderDevice?.(true);
    this.host._renderRtAll?.();
  }

  // --- Assistent: Stand -------------------------------------------------------

  tomorrow() {
    const today = this.data?.today || this._today || new Date().toISOString().slice(0, 10);
    const [y, m, d] = today.split("-").map(Number);
    const n = new Date(Date.UTC(y, m - 1, d + 1));
    return `${n.getUTCFullYear()}-${pad(n.getUTCMonth() + 1)}-${pad(n.getUTCDate())}`;
  }

  newDraft() {
    const first = this.data.entities[0];
    return {
      id: null,
      device_id: this.deviceId,
      entity_id: first && this.data.entities.length === 1 ? first.entity_id : "",
      action: "on",
      options: {},
      back_mode: "opposite",
      back_s: 0,
      ...triggerDefaults(),
      backOwn: { text: "", unit: 60 },
      kind: "repeat",
      delay_s: 1800,
      delayOwn: { text: "", unit: 60 },
      date: "",
      time: "06:30",
      repeat: "daily",
      weekdays: [0, 1, 2, 3, 4],
      mday: 1,
      mdayOwn: false,
      enabled: true,
      push: false,
      target: "",
      name: "",
      touched: { name: false },
    };
  }

  draftFrom(rt) {
    this.learnEnts(rt.condition_entities);
    const back = rt.back_s ? splitSeconds(rt.back_s, UNITS) : { text: "", unit: 60 };
    const delay = rt.delay_s ? splitSeconds(rt.delay_s, UNITS) : { text: "", unit: 60 };
    const backPreset = BACK_PRESETS.includes(rt.back_s || 0);
    const delayPreset = DELAY_PRESETS.includes(rt.delay_s || 0);
    return {
      id: rt.id,
      device_id: rt.device_id,
      entity_id: rt.entity_id,
      action: rt.action,
      options: { ...(rt.options || {}) },
      back_mode: rt.back_mode || "opposite",
      ...triggerFromRoutine(rt),
      back_s: rt.back_s || 0,
      backOwn: backPreset ? { text: "", unit: 60 } : back,
      kind: rt.kind,
      delay_s: rt.delay_s || 1800,
      delayOwn: delayPreset || !rt.delay_s ? { text: "", unit: 60 } : delay,
      date: rt.date || "",
      time: rt.time || "06:30",
      repeat: rt.repeat || "daily",
      weekdays: rt.weekdays?.length ? [...rt.weekdays] : [0, 1, 2, 3, 4],
      mday: rt.mday ?? 1,
      mdayOwn: rt.mday != null && rt.mday !== 1 && rt.mday !== 15 && rt.mday !== -1,
      // Eine einmalige Routine ist nach dem Lauf aus und bleibt es beim Bearbeiten: Sie muss von Hand wieder eingeschaltet werden
      // (Schalter in Schritt 5, Schalter in der Liste oder "Nochmal"); bis 2.32.0 schaltete das Bearbeiten ihn von selbst wieder ein.
      enabled: rt.enabled,
      push: Boolean(rt.push),
      target: rt.target || "",
      name: rt.name,
      touched: { name: true },
    };
  }

  payload() {
    const d = this.wiz.draft;
    const raw = {
      device_id: d.device_id,
      entity_id: d.entity_id,
      name: d.name.trim(),
      action: d.action,
      options: d.action === "on" || d.action === "set" ? d.options : {},
      back_mode: d.backKind !== "none" ? (d.action === "set" ? "restore" : d.back_mode) : "opposite",
      back_s: d.backKind === "duration" ? d.back_s || null : null,
      ...triggerPayload(d),
      kind: d.kind,
      delay_s: d.kind === "countdown" ? d.delay_s : null,
      date: d.kind === "once" && d.date ? d.date : null,
      time: d.kind === "countdown" || d.kind === "trigger" ? null : d.time,
      repeat: d.kind === "repeat" ? d.repeat : null,
      weekdays: d.kind === "repeat" && d.repeat === "weekly" ? d.weekdays : null,
      mday: d.kind === "repeat" && d.repeat === "monthly" ? d.mday : null,
      enabled: d.enabled,
      push: d.push,
      target: d.target || null,
    };
    if (d.id) raw.id = d.id;
    return raw;
  }

  startWizard(routine = null) {
    this.view = "wizard";
    this.ui.flash = "";
    this.ui.error = "";
    this.wiz = {
      step: routine ? 2 : 1,
      editing: Boolean(routine),
      draft: routine ? this.draftFrom(routine) : this.newDraft(),
      pv: null,
      pvError: "",
      test: null,
      targetOpen: false,
      error: "",
      saving: false,
    };
    // Eine einzige schaltbare Entität ist schon gewählt: gleich zu "Wann"
    if (!routine && this.wiz.draft.entity_id) this.wiz.step = 1;
    this.wiz.snap = JSON.stringify(this.wiz.draft);
    this.paint();
    this.scrollTop();
    this.requestPreview();
  }

  // Neue Routine aus dem Fenster aller Routinen (seit 2.27.0): derselbe Assistent mit einem Schritt mehr davor, der das Gerät wählt
  async startNewFromAll() {
    this.reset();
    this.standalone = true;
    this.view = "wizard";
    const draft = { id: null, device_id: null, entity_id: "", action: "on", options: {}, back_mode: "opposite", back_s: 0, ...triggerDefaults(), backOwn: { text: "", unit: 60 }, kind: "repeat", delay_s: 1800, delayOwn: { text: "", unit: 60 }, date: "", time: "06:30", repeat: "daily", weekdays: [0, 1, 2, 3, 4], mday: 1, mdayOwn: false, enabled: true, push: false, target: "", name: "" };
    const w = (this.wiz = { pick: true, step: 0, editing: false, draft, pv: null, pvError: "", test: null, targetOpen: false, error: "", saving: false, devices: null, devQuery: "", pickId: "", pickEnt: "", loadingDev: false });
    w.snap = JSON.stringify(draft);
    this.paint();
    try {
      const r = await this.call({ type: "device_panel/routine_devices" });
      if (this.wiz !== w) return;
      w.devices = r.devices;
    } catch (err) {
      if (this.wiz !== w) return;
      w.devices = [];
      w.error = this.t("rtLoadError", this.h.errText(err));
    }
    this.paint();
  }

  // Schritt 0 verlassen: schaltbare Entitäten und Ziele des gewählten Geräts laden, dann weiter zu "Was schalten"
  async chooseDevice() {
    const w = this.wiz;
    if (!w || !w.pickId || w.loadingDev) return;
    w.loadingDev = true;
    w.error = "";
    this.paint();
    try {
      if (this.deviceId !== w.pickId || !this.data) {
        const id = w.pickId;
        const result = await this.call({ type: "device_panel/routine_get", device_id: id });
        if (this.wiz !== w) return;
        this.deviceId = id;
        this.data = result;
        this._offset = Number.isFinite(result.now) ? result.now * 1000 - Date.now() : 0;
        w.draft = this.newDraft();
        this.preselect(w.pickEnt);
        w.snap = JSON.stringify(w.draft);
        w.pv = null;
        w.entQuery = "";
      } else if (w.pickEnt && w.draft.entity_id !== w.pickEnt) {
        this.preselect(w.pickEnt);
      }
    } catch (err) {
      if (this.wiz !== w) return;
      w.loadingDev = false;
      w.error = this.t("rtLoadError", this.h.errText(err));
      this.paint();
      return;
    }
    w.loadingDev = false;
    this.setStep(1);
  }

  // "Setzen" (Zahl, Auswahl; seit 2.80.0): der Entwurf beginnt mit dem Wert, den die Entität jetzt hat, und mit "wie vorher" als einzigem Weg zurück
  initSet(d, e) {
    if (d.action !== "set" || !e) return;
    d.back_mode = "restore";
    const spec = (e.options || [])[0];
    if (!spec || d.options.value !== undefined || d.options.option !== undefined) return;
    if (spec.type === "number") {
      const now = Number(e.state);
      const v = Number.isFinite(now) ? now : spec.min;
      d.options = { value: Math.min(spec.max, Math.max(spec.min, v)) };
    } else if (spec.type === "pick") {
      d.options = { option: spec.values.includes(e.state) ? e.state : spec.values[0] };
    }
  }

  // Ist der Wert zum Setzen gültig? Zahl im Bereich der Entität, Auswahl aus ihrer Liste (ist sie gerade nicht erreichbar, genügt ein Wert)
  setValid(d, e) {
    const spec = (e?.options || [])[0];
    const o = d.options || {};
    if (e?.domain === "number") return Number.isFinite(o.value) && (!spec || (o.value >= spec.min && o.value <= spec.max));
    if (e?.domain === "select") return typeof o.option === "string" && o.option !== "" && (!spec || spec.values.includes(o.option));
    return true;
  }

  // Eine einzeln gefundene Szene oder Gruppe gleich als Entität setzen (Aktion wie beim Antippen auf der Seite "Was")
  preselect(entityId) {
    const e = entityId ? this.entity(entityId) : null;
    if (!e) return;
    const d = this.wiz.draft;
    d.entity_id = entityId;
    d.options = {};
    if (!e.actions.includes(d.action)) d.action = e.actions[0];
    this.initSet(d, e);
    if (!canBack(d.action)) {
      d.back_s = 0;
      d.backKind = "none";
    }
  }

  // Alle Einträge der ersten Seite einzeln: Geräte, dann Gruppen, dann Szenen (jede Szene und Gruppe ohne Gerät eine eigene Zeile)
  pickRows() {
    const w = this.wiz;
    const devices = (w.devices || [])
      .filter((x) => !isHolder(x.id))
      .map((x) => {
        const dev = this.host._devices?.find((d) => d.id === x.id);
        const sub = [dev?.area, dev?.integration?.name].filter(Boolean).join(" · ");
        return { kind: "device", id: x.id, ent: "", name: dev?.name || x.name, sub, type: dev?.type || "other", entities: x.entities, names: x.names || [] };
      });
    const singles = (w.devices || [])
      .filter((x) => isHolder(x.id))
      .flatMap((x) => (x.items || []).map((i) => ({ kind: KIND_OF[x.id], id: x.id, ent: i.id, name: i.name, sub: "", holder: HOLDERS[x.id], names: [i.id] })));
    const byName = (a, b) => a.name.localeCompare(b.name);
    return [...devices, ...singles.filter((x) => x.kind === "group").sort(byName), ...singles.filter((x) => x.kind === "scene").sort(byName)];
  }

  // Schritt 0: Gerät, Gruppe oder Szene wählen, mit Filter nach Art und Suche
  step0Html() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const w = this.wiz;
    const all = this.pickRows();
    const count = (k) => (k === "all" ? all.length : all.filter((x) => x.kind === k).length);
    // Der Filter erscheint nur, wenn es Gruppen oder Szenen ohne Gerät gibt
    const tabs = all.some((x) => x.kind !== "device") ? KIND_TABS.filter(([k]) => count(k) > 0) : [];
    const kind = tabs.some(([k]) => k === w.devKind) ? w.devKind : "all";
    const bar = tabs.length
      ? `<div class="sub-tabs mg-tabs mg-filter" role="tablist">${tabs
          .map(([k, label]) => `<button type="button" role="tab" class="sub-tab two${k === kind ? " on" : ""}" data-rt="dev-kind" data-v="${k}" aria-selected="${k === kind}"><span class="tab-l">${esc(t(label))}</span> <span class="tab-s">${count(k)}</span></button>`)
          .join("")}</div>`
      : "";
    return `<p class="mg-note">${esc(t("rtPickDeviceNote"))}</p>
      ${bar}
      <label class="list-search" data-for="rt-devs">${this.h.mdi("search", 18)}<input type="search" data-rt="dev-search" value="${esc(w.devQuery)}" placeholder="${esc(t("listSearch"))}" aria-label="${esc(t("listSearch"))}" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false">${this.host._fieldClearHtml("data-fc", "", w.devQuery)}</label>
      <div data-rt-zone="devs">${this.devsHtml()}</div>`;
  }

  devsHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const w = this.wiz;
    if (!w.devices) return `<p class="mg-note">${esc(t("rtLoading"))}</p>`;
    const q = String(w.devQuery || "").trim().toLowerCase();
    const kind = w.devKind || "all";
    // Die Suche findet auch eine Entität im Gerät (seit 2.63.0): "alles" findet das Gerät mit der Szene "Alles aus"
    const rows = this.pickRows().filter((x) => (kind === "all" || x.kind === kind) && (!q || `${x.name} ${x.sub} ${x.names.join(" ")}`.toLowerCase().includes(q)));
    if (!rows.length) return `<p class="mg-note mg-none">${esc(t(w.devices.length ? "listSearchNone" : "rtNoSwitchableDevices"))}</p>`;
    const picked = `${w.pickId}|${w.pickEnt || ""}`;
    return rows
      .map((x) => {
        const on = picked === `${x.id}|${x.ent}`;
        const right = x.holder ? `<span class="mg-kind ${x.kind}">${esc(t(x.holder.kind))}</span>` : `<span class="mg-val">${esc(t("rtDevEntities", x.entities))}</span>`;
        return `<button type="button" class="mg-card mg-pick" data-rt="dev" data-id="${esc(x.id)}" data-ent="${esc(x.ent)}" role="radio" aria-checked="${on}">
        <span class="mg-row"><span class="mg-devic" aria-hidden="true">${x.holder ? x.holder.emoji : this.h.typeIcon(x.type, 18)}</span><span class="mg-t"><b>${esc(x.name)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ""}</span>
        ${right}<span class="mg-radio${on ? " on" : ""}"></span></span></button>`;
      })
      .join("");
  }

  closeWizard() {
    window.clearTimeout(this._pvTimer);
    this._pvSeq = (this._pvSeq || 0) + 1;
    this.view = "list";
    this.wiz = null;
    this.closeWin();
    if (this.standalone) {
      this.reset();
      this.host._loadRtAll?.();
      return;
    }
    this.paint();
    this.host._renderDevice?.(true);
  }

  // Schliessen: ohne Änderung sofort, sonst die gemeinsame Rückfrage "Änderungen verwerfen?" des Panels
  requestClose() {
    const w = this.wiz;
    if (!w || w.saving) return;
    if (JSON.stringify(w.draft) !== w.snap) this.host._askDiscard(() => this.closeWizard());
    else this.closeWizard();
  }

  scrollTop() {
    for (const el of this.qa(".mgw-body, .mgw-main")) el.scrollTop = 0;
  }

  // --- Assistent: Prüfen ------------------------------------------------------

  delayError() {
    const d = this.wiz.draft;
    const lo = this.limit("delay_min", 10);
    const hi = this.limit("delay_max", 604800);
    return d.kind === "countdown" && (!Number.isFinite(d.delay_s) || d.delay_s < lo || d.delay_s > hi) ? this.t("rtDelayRange", this.fmtDur(lo), this.fmtDur(hi)) : "";
  }

  backError() {
    const d = this.wiz.draft;
    if (d.backKind !== "duration" || !d.back_s) return "";
    const lo = this.limit("back_min", 10);
    const hi = this.limit("back_max", 604800);
    return !Number.isFinite(d.back_s) || d.back_s < lo || d.back_s > hi ? this.t("rtBackRange", this.fmtDur(lo), this.fmtDur(hi)) : "";
  }

  canNext(step = this.wiz.step) {
    if (step === 0) return Boolean(this.wiz.pickId) && !this.wiz.loadingDev;
    const d = this.wiz.draft;
    const e = this.entity(d.entity_id);
    if (step === 1) return Boolean(e) && e.actions.includes(d.action) && (d.action !== "set" || this.setValid(d, e));
    if (step === BACK_STEP) return this.backValid();
    if (step === 2) {
      if (d.kind === "trigger") return this.triggerValid();
      if (!/^\d{2}:\d{2}$/.test(d.time || "") && d.kind !== "countdown") return false;
      if (d.kind === "countdown") return !this.delayError();
      // Datum darf fehlen: dann gilt das nächste Eintreffen der Uhrzeit (seit 2.22.0)
      if (d.kind === "once") return !this.wiz.pvError;
      if (d.repeat === "weekly") return d.weekdays.length > 0;
      if (d.repeat === "monthly") return Number.isInteger(d.mday) && d.mday >= -1 && d.mday !== 0 && d.mday <= 31;
      return true;
    }
    return true;
  }

  // --- Assistent: Vorschau vom Server -----------------------------------------

  requestPreview() {
    window.clearTimeout(this._pvTimer);
    if (!this.wiz) return;
    this._pvTimer = window.setTimeout(() => this.fetchPreview(), PREVIEW_DELAY_MS);
  }

  async fetchPreview() {
    const w = this.wiz;
    if (!w || !w.draft.entity_id) return;
    const seq = (this._pvSeq = (this._pvSeq || 0) + 1);
    if (this.draftIncomplete()) {
      w.pv = null;
      w.pvError = "";
      this.paintZones();
      this.syncNav();
      return;
    }
    try {
      const r = await this.call({ type: "device_panel/routine_preview", routine: this.payload() });
      if (seq !== this._pvSeq || this.wiz !== w) return;
      w.pv = r;
      w.pvError = "";
    } catch (err) {
      if (seq !== this._pvSeq || this.wiz !== w) return;
      w.pv = null;
      w.pvError = this.h.errText(err);
    }
    this.paintZones();
    this.syncNav();
  }

  async sendTest() {
    const w = this.wiz;
    if (!w || w.test?.busy) return;
    w.test = { busy: true };
    this.paintZones(["pv"]);
    try {
      const r = await this.call({ type: "device_panel/routine_test", routine: this.payload() });
      const to = w.draft.target || this.data.default_target;
      w.test = { text: r.sent ? this.t("rtTestSent", to && to !== "none" ? this.niceTarget(to) : "") : this.t("rtTestFail"), failed: !r.sent };
    } catch (err) {
      w.test = { text: this.t("rtTestError", this.h.errText(err)), failed: true };
    }
    if (this.wiz === w) this.paintZones(["pv"]);
  }

  async save() {
    const w = this.wiz;
    if (!w || w.saving) return;
    w.saving = true;
    w.error = "";
    this.paintWindow();
    try {
      const r = await this.call({ type: "device_panel/routine_save", routine: this.payload() });
      const list = this.data?.routines;
      if (list) {
        const i = list.findIndex((x) => x.id === r.routine.id);
        if (i >= 0) list[i] = r.routine;
        else list.push(r.routine);
        list.sort((a, b) => a.name.localeCompare(b.name));
      }
      this.ui.flash = this.t("rtSaved");
      w.saving = false;
      w.snap = JSON.stringify(w.draft);
      this.closeWizard();
    } catch (err) {
      w.saving = false;
      w.error = this.t("rtSaveError", this.h.errText(err));
      if (this.wiz === w) this.paintWindow();
    }
  }

  // --- Assistent: Zeichnen ----------------------------------------------------

  paintWindow() {
    const win = this.win();
    if (!win) return;
    const scrolls = [".mgw-body", ".mgw-main"].map((sel) => [sel, win.querySelector(sel)?.scrollTop || 0]);
    win.innerHTML = this.wizardHtml();
    if (!win.open) {
      if (typeof win.showModal === "function") win.showModal();
      else win.setAttribute("open", "");
      this.host._blurOnTouch?.();
    }
    this.paintZones();
    for (const [sel, top] of scrolls) {
      const el = win.querySelector(sel);
      if (el) el.scrollTop = top;
    }
  }

  paintZones(only) {
    if (!this.win() || !this.wiz) return;
    for (const name of only || ["result", "runs", "pv", "summary", "prev", "backsum"]) {
      const el = this.q(`[data-rt-zone="${name}"]`);
      if (!el) continue;
      if (name === "result") el.innerHTML = this.resultHtml();
      else if (name === "runs") el.innerHTML = this.runsHtml();
      else if (name === "summary") el.innerHTML = this.summaryHtml();
      else if (name === "devs") el.innerHTML = this.devsHtml();
      else if (name === "ents") el.innerHTML = this.entsHtml();
      else if (name === "backsum") el.innerHTML = this.backSumHtml();
      else if (name === "winerr") el.innerHTML = this.winErrHtml();
      else if (name.startsWith("csum-")) el.innerHTML = this.condSumHtml(name.slice(5));
      else if (name.startsWith("ferr-")) el.innerHTML = this.freeErrHtml(name.slice(5));
      else if (name === "prev") el.innerHTML = this.prevHtml();
      else el.innerHTML = this.pvHtml();
    }
  }

  // Alle Schritte gültig: dann darf auf jeder Seite gespeichert werden (seit 2.24.0)
  canSaveAll() {
    return this.steps().filter((n) => n > 0).every((n) => this.canNext(n));
  }

  // Kann die Entität beim Einschalten etwas einstellen? Dann gibt es die Seite "Optionen" (nur beim Einschalten, nie beim Umschalten)
  hasOptions() {
    const d = this.wiz?.draft;
    return Boolean(d && d.action === "on" && this.entity(d.entity_id)?.options?.length);
  }

  // Die auf der ersten Seite gewählte einzelne Szene oder Gruppe (nur beim Anlegen aus dem Fenster aller Routinen), sonst null
  chosenWhat() {
    const w = this.wiz;
    if (!w?.pick || !w.pickEnt || !isHolder(this.deviceId) || !this.data || w.draft?.entity_id !== w.pickEnt) return null;
    return this.entity(w.pickEnt) || null;
  }

  // Die Schritte in ihrer Reihenfolge: Gerät (nur aus dem Fenster aller Routinen), Was, Optionen (nur wenn möglich), Wann, Meldung, Name
  steps() {
    const d = this.wiz?.draft;
    // Eine gewählte Szene hat nichts mehr zu bestimmen (nur "Aktivieren"): die Seite "Was" entfällt (seit 2.67.0)
    const sceneChosen = this.chosenWhat()?.domain === "scene";
    return [...(this.wiz?.pick ? [0] : []), ...(sceneChosen ? [] : [1]), ...(this.hasOptions() ? [OPTS_STEP] : []), 2, ...(d && canBack(d.action) ? [BACK_STEP] : []), 3, 4];
  }

  syncNav() {
    const next = this.q('[data-rt="nav-next"], [data-rt="nav-save"]');
    if (next) next.disabled = !this.canNext() || Boolean(this.wiz?.saving);
    const quick = this.q('[data-rt="nav-quick"]');
    if (quick) quick.disabled = !this.canSaveAll() || Boolean(this.wiz?.saving);
  }

  tabsHtml(items, cls = "") {
    const esc = (v) => this.esc(v);
    return `<div class="sub-tabs mg-tabs${cls ? ` ${cls}` : ""}" role="radiogroup">${items
      .map((i) => `<button type="button" role="radio" class="sub-tab${i.on ? " on" : ""}" aria-checked="${Boolean(i.on)}" ${i.attrs}>${esc(i.label)}</button>`)
      .join("")}</div>`;
  }

  ownHtml(kind, own, label, units = UNITS) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    return `<div class="mg-own"><span>${esc(label)}</span>
      <input class="mg-pill num mg-ownin" type="text" inputmode="decimal" data-rt="${kind}-own" value="${esc(own.text)}" placeholder="${esc(t("rtOwnPh"))}" aria-label="${esc(label)}" autocomplete="off">
      <select class="mg-pill" data-rt="${kind}-unit" aria-label="${esc(label)}">${units.map((u) => `<option value="${u}"${u === own.unit ? " selected" : ""}>${esc(t(`rtUnit_${u}`))}</option>`).join("")}</select></div>`;
  }

  wizardHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const w = this.wiz;
    const step = w.step;
    // Mit "Routine hinzufügen" im Fenster aller Routinen kommt Schritt 0 (Gerät wählen) davor, mit Schaltoptionen die Seite "Optionen"
    // dazwischen: Die Anzeige zählt die Seiten, die es gibt
    const order = this.steps();
    const pos = Math.max(0, order.indexOf(step));
    const first = order[0];
    const total = order.length;
    const shown = (n) => order.indexOf(n) + 1;
    const bars = order.map((n, i) => {
      const on = i <= pos ? " on" : "";
      const open = (w.editing || i < pos) && !(n >= 1 && !this.data);
      return open
        ? `<button type="button" class="mg-stp${on}" data-rt="goto" data-step="${n}" aria-label="${esc(`${t("rtStepOf", shown(n), total)}: ${t(`rtStepName_${n}`)}`)}"></button>`
        : `<span class="mg-stp${on}"></span>`;
    }).join("");
    const body = [this.step0Html, this.step1Html, this.step2Html, this.step3Html, this.step4Html, this.stepOptsHtml, this.backStepHtml][step].call(this);
    const last = step === STEPS;
    const quick = last || step === 0 ? "" : `<button type="button" class="dlg-btn quick" data-rt="nav-quick"${this.canSaveAll() && !w.saving ? "" : " disabled"}>${this.h.mdi("save", 18)}${esc(w.saving ? t("rtSaving") : t("rtSave"))}</button>`;
    const nav = `<div class="mg-btns"><button type="button" class="dlg-btn" data-rt="${step === first ? "nav-cancel" : "nav-back"}">${this.h.mdi(step === first ? "close" : "arrowLeft", 18)}${esc(step === first ? t("rtCancel") : t("rtBack"))}</button>
      ${quick}
      ${last ? `<button type="button" class="dlg-btn primary" data-rt="nav-save"${this.canNext() && !w.saving ? "" : " disabled"}>${this.h.mdi("save", 18)}${esc(w.saving ? t("rtSaving") : t("rtSave"))}</button>` : `<button type="button" class="dlg-btn primary" data-rt="nav-next"${this.canNext() ? "" : " disabled"}>${esc(t("rtNext"))}${this.h.mdi("arrowRight", 18)}</button>`}</div>`;
    const device = (step > 0 || !w.pick) && this.deviceId ? (isHolder(this.deviceId) ? t(HOLDERS[this.deviceId].key) : this.host._devices?.find((x) => x.id === this.deviceId)?.name || w.devices?.find((x) => x.id === this.deviceId)?.name || "") : "";
    return `<div class="mgw-head"><div class="mgw-t"><b>${esc(w.editing ? t("rtEditing") : t("rtNew"))}</b>${device ? `<small>${esc(device)}</small>` : ""}</div>
        <button type="button" class="dlg-close" data-rt="close" title="${esc(t("close"))}" aria-label="${esc(t("close"))}">${this.h.mdi("close", 18)}</button></div>
      <div class="mgw-prog"><div class="mg-stephead"><span>${esc(t("rtStepOf", shown(step), total))}</span><span>${esc(t(step === 1 && this.chosenWhat() ? "rtStepName_1_fixed" : `rtStepName_${step}`))}</span></div>
        <div class="mg-steps">${bars}</div></div>
      <div class="mgw-body"><div class="mgw-main"><div class="mg-big">${esc(step === 1 && this.chosenWhat() ? t("rtQ_1_fixed", this.chosenWhat().name) : t(`rtQ_${step}`))}</div>
        ${body}
        ${w.error ? `<div class="dlg-error" role="alert">${esc(w.error)}</div>` : ""}</div></div>
      <div class="mgw-foot">${nav}</div>`;
  }

  // Schritt 1: Entität, Aktion, Zurückschalten
  step1Html() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    const ents = this.data.entities;
    if (!ents.length) return `<p class="mg-note">${esc(t("rtNoEntities"))}</p>`;
    const e = this.entity(d.entity_id);
    let html = "";
    // Eine einzelne Szene oder Gruppe ist auf der ersten Seite schon gewählt (seit 2.67.0): keine zweite Auswahl, nur noch die Aktion.
    // Beim Bearbeiten einer Routine bleibt die Liste.
    if (!this.chosenWhat()) {
      html += `<p class="mg-note">${esc(t(isHolder(this.deviceId) ? "rtHolderNote" : "rtOnlySwitchable"))}</p>`;
      // Bei vielen Entitäten (78 Szenen) eine Suche (seit 2.63.0)
      if (ents.length > ENT_SEARCH_MIN) {
        html += `<label class="list-search" data-for="rt-ents">${this.h.mdi("search", 18)}<input type="search" data-rt="ent-search" value="${esc(this.wiz.entQuery || "")}" placeholder="${esc(t("listSearch"))}" aria-label="${esc(t("listSearch"))}" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false">${this.host._fieldClearHtml("data-fc", "", this.wiz.entQuery || "")}</label>`;
      }
      html += `<div data-rt-zone="ents">${this.entsHtml()}</div>`;
    }
    if (!e) return html;
    // Die einzige Entität des Geräts ist schon gewählt, aber eine Zahl oder Auswahl: ihre Aktion ist "setzen", nicht "ein"
    if (!e.actions.includes(d.action)) {
      d.action = e.actions[0];
      this.initSet(d, e);
    }
    html += `<div class="mg-k">${esc(t("rtAction"))}</div>${this.tabsHtml(e.actions.map((a) => ({ on: d.action === a, attrs: `data-rt="action" data-v="${a}"`, label: t(`rtAct_${actKey(e.domain, a)}`) })))}`;
    if (d.action === "set") html += this.setValueHtml(e);
    else if (!opposite(d.action)) html += `<p class="mg-hint">${esc(t(e.domain === "scene" ? "rtSceneNoBack" : "rtToggleNoBack"))}</p>`;
    return `${html}<div data-rt-zone="result">${this.resultHtml()}</div>`;
  }

  // Der Wert zum Setzen (Zahl: Regler und Zahlenfeld; Auswahl: Knöpfe oder Liste), auf der Seite "Was" unter der Aktion
  setValueHtml(e) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    const spec = (e.options || [])[0];
    if (!spec) return `<p class="mg-hint">${esc(t("rtSetUnavailable"))}</p>`;
    if (spec.type === "pick") {
      const items = spec.values.map((v) => ({ on: d.options.option === v, attrs: `data-rt="setopt" data-v="${esc(v)}" data-group="setopt"`, label: v }));
      const body = spec.values.length <= 5
        ? this.tabsHtml(items)
        : `<span class="opt-select"><select data-rt="setopt" aria-label="${esc(t("rtSetOption"))}">${spec.values.map((v) => `<option value="${esc(v)}"${d.options.option === v ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>${this.h.mdi("chevronDown", 18)}</span>`;
      return `<div class="mg-k">${esc(t("rtSetOption"))}</div>${body}`;
    }
    const v = d.options.value ?? spec.min;
    const fill = spec.max > spec.min ? ((Math.min(spec.max, Math.max(spec.min, v)) - spec.min) / (spec.max - spec.min)) * 100 : 0;
    const shown = this.setText({ options: { value: v }, entity_id: e.entity_id });
    return `<div class="mg-k">${esc(t("rtSetValue"))}</div>
      <div class="to-k"><span>${esc(e.name)}</span><b data-rt-val="set">${esc(shown)}</b></div>
      <input type="range" class="to-range" data-rt="setnum" min="${esc(spec.min)}" max="${esc(spec.max)}" step="${esc(spec.step)}" value="${esc(v)}" style="--fill:${fill.toFixed(1)}%" aria-label="${esc(t("rtSetValue"))}">
      <div class="rt-setnum"><input type="number" class="mg-input" inputmode="decimal" data-rt="setnum" min="${esc(spec.min)}" max="${esc(spec.max)}" step="${esc(spec.step)}" value="${esc(v)}" aria-label="${esc(t("rtSetValue"))}">${spec.unit ? `<span>${esc(spec.unit)}</span>` : ""}</div>
      <div class="opt-error" data-rt-err="set" ${this.setValid(d, e) ? "hidden" : ""}>${esc(t("rtSetRange", this.fmtNum(spec.min), this.fmtNum(spec.max)))}</div>`;
  }

  // Die Liste der Entitäten auf Seite "Was", gefiltert nach der Suche (die gewählte bleibt immer sichtbar)
  entsHtml() {
    const esc = (v) => this.esc(v);
    const d = this.wiz.draft;
    const q = String(this.wiz.entQuery || "").trim().toLowerCase();
    const rows = this.data.entities.filter((e) => !q || e.entity_id === d.entity_id || `${e.name} ${e.entity_id}`.toLowerCase().includes(q));
    if (!rows.length) return `<p class="mg-note mg-none">${esc(this.t("listSearchNone"))}</p>`;
    return rows.map((e) => `<button type="button" class="mg-card mg-pick" data-rt="pick" data-id="${esc(e.entity_id)}" role="radio" aria-checked="${d.entity_id === e.entity_id}">
      <span class="mg-row"><span class="mg-ic" aria-hidden="true">${routineEmoji(e.domain)}</span><span class="mg-t"><b>${esc(e.name)}</b><small>${esc(e.entity_id)}</small></span>
      <span class="mg-val${e.available ? "" : " off"}">${esc(this.stateWord(e))}</span><span class="mg-radio${d.entity_id === e.entity_id ? " on" : ""}"></span></span></button>`).join("");
  }

  resultHtml() {
    const d = this.wiz.draft;
    const e = this.entity(d.entity_id);
    if (!e) return "";
    const w = this.wiz;
    const row = w.tried?.busy
      ? `<span class="opt-short">${this.esc(this.t("rtTryBusy"))}</span>`
      : `<button type="button" class="dlg-btn rt-try" data-rt="try">${this.h.mdi("play", 18)}${this.esc(this.t("rtTryBtn"))}</button>${w.tried?.text ? `<span class="${w.tried.failed ? "opt-error" : "opt-short"}" role="status">${this.esc(w.tried.text)}</span>` : ""}`;
    return `<p class="mg-note rt-result">${this.esc(this.t("rtResult", this.sentenceOf(this.draftRt(), e.name)))}</p>
      <div class="mg-testrow rt-tryrow">${row}</div><p class="mg-hint">${this.esc(this.t("rtTryNote"))}</p>`;
  }

  // Testknopf: schaltet die gewählte Entität jetzt, ohne Routine und ohne Zurückschalten
  async tryNow() {
    const w = this.wiz;
    if (!w || w.tried?.busy) return;
    const d = w.draft;
    w.tried = { busy: true };
    this.paintZones(["result"]);
    try {
      const r = await this.call({ type: "device_panel/routine_try", entity_id: d.entity_id, action: d.action, options: d.action === "on" || d.action === "set" ? d.options : {} });
      w.tried = r.ok ? { text: this.t("rtTryDone") } : { text: this.t("rtTryFail", this.t(r.reason === "unavailable" ? "rtTryUnavailable" : r.reason === "timeout" ? "rtTryTimeout" : "rtTryError")), failed: true };
    } catch (err) {
      w.tried = { text: this.t("rtTryFail", this.h.errText(err)), failed: true };
    }
    if (this.wiz !== w) return;
    this.paintZones(["result"]);
    await this.refreshStates(w);
  }

  // Die Zustände der Entitäten kommen beim Öffnen des Assistenten; nach dem Testschalten neu holen, sonst zeigt die Karte
  // weiter den alten Stand ("ein", obwohl gerade ausgeschaltet wurde). Der Entwurf bleibt unberührt.
  async refreshStates(w) {
    if (!this.deviceId) return;
    try {
      const r = await this.call({ type: "device_panel/routine_get", device_id: this.deviceId });
      if (this.wiz !== w || !Array.isArray(r?.entities)) return;
      this.data.entities = r.entities;
      this.paint();
    } catch {
      // Der Stand bleibt wie er war; das Ergebnis des Schaltens steht schon da
    }
  }

  // --- Seite "Optionen" (seit 2.52.0) -----------------------------------------

  // Wert aus einem Knopf (Text) in den Wert der Option (Zahl oder Modus) übersetzen
  optSpecValue(key, text) {
    const spec = (this.entity(this.wiz.draft.entity_id)?.options || []).find((x) => x.key === key);
    return spec?.type === "choice" ? text : Number(text);
  }

  // Eine Angabe setzen oder (null) löschen; Farbtemperatur und Farbe schliessen sich aus
  setOpt(key, value) {
    const o = this.wiz.draft.options;
    if (value === null || value === undefined || (typeof value === "number" && !Number.isFinite(value))) delete o[key];
    else {
      o[key] = value;
      if (key === "color_temp_kelvin") delete o.rgb_color;
      if (key === "rgb_color") delete o.color_temp_kelvin;
    }
    this.wiz.tried = null;
  }

  // Schnellwahl unter dem Regler: [Beschriftung, Wert]
  quickValues(spec) {
    const t = (k, ...a) => this.t(k, ...a);
    if (spec.type === "kelvin") return [["warm", 2700], ["neutral", 4000], ["cold", 6500]].map(([k, v]) => [t(`rtKelvin_${k}`), Math.min(spec.max, Math.max(spec.min, v))]);
    if (spec.type === "choice") return spec.values.map((v) => [t(`rtHvac_${v}`), v]);
    if (spec.type === "temperature") {
      const step = Number(spec.step) || 0.5;
      const values = [0.25, 0.5, 0.75].map((f) => Math.min(spec.max, Math.max(spec.min, Math.round((spec.min + (spec.max - spec.min) * f) / step) * step)));
      return [...new Set(values.map((v) => Number(v.toFixed(2))))].map((v) => [this.fmtNum(v), v]);
    }
    return (QUICK[spec.key] || [25, 50, 100]).filter((v) => v >= spec.min && v <= spec.max).map((v) => [`${v} %`, v]);
  }

  // Der Wert neben der Überschrift eines Reglers
  optValueText(spec) {
    const o = this.wiz.draft.options;
    const v = o[spec.key];
    if (spec.key === "rgb_color") return Array.isArray(v) ? this.colourName(v) : this.t("rtOptKeep");
    if (v === undefined) return spec.key === "color_temp_kelvin" && o.rgb_color ? "–" : this.t("rtOptKeep");
    if (spec.type === "kelvin") return `${v} K`;
    if (spec.type === "temperature") return `${this.fmtNum(v)} ${spec.unit || "°C"}`;
    if (spec.type === "choice") return this.t(`rtHvac_${v}`);
    return `${v} %`;
  }

  // Schritt 5: Optionen. Vorschau oben (schaltet nichts), darunter ein Regler je Einstellung, unten "Jetzt ausführen"
  stepOptsHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const e = this.entity(this.wiz.draft.entity_id);
    if (!e) return "";
    return `<p class="mg-note">${esc(t("rtOptNote"))}</p>
      <div data-rt-zone="prev">${this.prevHtml()}</div>
      ${e.options.map((spec) => this.optHtml(spec)).join("")}
      <p class="mg-hint">${esc(t("rtOptPreviewNote"))}</p>
      <div data-rt-zone="result">${this.resultHtml()}</div>`;
  }

  // Eine Einstellung: Überschrift mit Wert, Regler (oder Farben), Schnellwahl als Reiterleiste
  optHtml(spec) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const k = spec.key;
    const cur = this.wiz.draft.options[k];
    const head = `<div class="to-k"><span>${esc(t(`rtOpt_${k}`))}</span><b data-rt-val="${esc(k)}">${esc(this.optValueText(spec))}</b></div>`;
    if (spec.type === "colour") return `${head}${this.coloursHtml()}`;
    let html = head;
    if (spec.type !== "choice") {
      const shown = finiteNumber(cur, Math.round((spec.min + spec.max) / 2));
      const fill = Math.min(100, Math.max(0, ((shown - spec.min) / (spec.max - spec.min)) * 100));
      const step = spec.type === "temperature" ? spec.step || 0.5 : 1;
      html += `<input type="range" class="to-range${spec.type === "kelvin" ? " kel" : ""}${cur === undefined ? " unset" : ""}" data-rt="opt" data-k="${esc(k)}" min="${esc(spec.min)}" max="${esc(spec.max)}" step="${esc(step)}" value="${esc(shown)}" style="--fill:${fill.toFixed(1)}%" aria-label="${esc(t(`rtOpt_${k}`))}">`;
      if (spec.type === "kelvin") html += `<div class="to-ends"><span>${esc(t("rtKelvin_warm"))}</span><span>${esc(t("rtKelvin_cold"))}</span></div>`;
    }
    const none = cur === undefined && !(k === "color_temp_kelvin" && this.wiz.draft.options.rgb_color);
    const items = [{ on: none, attrs: `data-rt="optq" data-k="${esc(k)}" data-v="" data-group="${esc(k)}"`, label: t("rtOptKeep") }, ...this.quickValues(spec).map(([label, v]) => ({ on: cur === v, attrs: `data-rt="optq" data-k="${esc(k)}" data-v="${esc(v)}" data-group="${esc(k)}"`, label }))];
    return `${html}${this.tabsHtml(items)}`;
  }

  // Farben als Kreise: "Wie zuletzt" (durchgestrichen), acht Farben, eigene Farbe über die Farbwahl des Browsers
  coloursHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const o = this.wiz.draft.options;
    const rgb = o.rgb_color;
    const known = rgb && COLOURS.some(([, , c]) => c.every((v, i) => v === rgb[i]));
    const none = !rgb && o.color_temp_kelvin === undefined;
    const dots = COLOURS.map(([name, hex, c]) => {
      const on = rgb && c.every((v, i) => v === rgb[i]);
      return `<button type="button" class="to-col${on ? " on" : ""}" style="background:${hex}" data-rt="optcol" data-v="${c.join(",")}" role="radio" aria-checked="${Boolean(on)}" aria-label="${esc(t(`rtCol_${name}`))}" title="${esc(t(`rtCol_${name}`))}"></button>`;
    }).join("");
    return `<div class="to-cols" role="radiogroup" aria-label="${esc(t("rtOpt_rgb_color"))}">
      <button type="button" class="to-col none${none ? " on" : ""}" data-rt="optcol" data-v="" role="radio" aria-checked="${none}" aria-label="${esc(t("rtOptKeep"))}" title="${esc(t("rtOptKeep"))}"></button>${dots}
      <label class="to-col more${rgb && !known ? " on" : ""}" title="${esc(t("rtColPick"))}"><input type="color" data-rt="optpick" value="${rgb ? toHex(rgb) : "#ffffff"}" aria-label="${esc(t("rtColPick"))}"></label></div>`;
  }

  // Vorschau: das Gerät, wie es nach dem Schalten aussieht (Lampe leuchtet in der Farbe, Rollladen steht auf der Position …)
  prevHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    const e = this.entity(d.entity_id);
    if (!e) return "";
    const o = d.options;
    const parts = this.optionParts(o);
    let big = "";
    let style = "";
    let off = !parts.length;
    let sub = parts.slice(1).join(" · ");
    if (e.domain === "light") {
      const level = (o.brightness_pct ?? 100) / 100;
      const rgb = Array.isArray(o.rgb_color) ? o.rgb_color : o.color_temp_kelvin ? kelvinRgb(o.color_temp_kelvin) : [255, 197, 120];
      style = `--pv-c:rgb(${rgb.join(",")});--pv-o:${off ? 0 : (0.2 + 0.5 * level).toFixed(2)};--pv-b:${off ? 1 : (0.55 + 0.45 * level).toFixed(2)}`;
      big = "<span>💡</span>";
    } else if (e.domain === "cover") {
      const pos = o.position ?? 50;
      style = `--pv-closed:${100 - pos}%`;
      big = '<span class="to-shade"><i></i></span>';
      sub = o.position == null ? "" : t(o.position >= 100 ? "rtCoverWord_open" : o.position <= 0 ? "rtCoverWord_closed" : "rtCoverWord_part");
    } else if (e.domain === "climate") {
      const colour = { heat: "#ff9500", cool: "#0a84ff", heat_cool: "#af52de", auto: "#34c759", dry: "#5ac8fa", fan_only: "#8e8e93" }[o.hvac_mode] || "var(--dp-text3)";
      style = `--pv-c:${colour};--pv-o:${off ? 0 : 0.35}`;
      big = `<span class="to-temp">${o.temperature != null ? `${esc(this.fmtNum(o.temperature))}°` : "–"}</span>`;
    } else {
      big = `<span>${esc(routineEmoji(e.domain))}</span>`;
      const level = (o.volume_pct ?? o.percentage ?? 100) / 100;
      style = `--pv-c:var(--dp-primary);--pv-o:${off ? 0 : (0.15 + 0.3 * level).toFixed(2)};--pv-b:1`;
      sub = off ? "" : t(`rtOpt_${e.options[0].key}`);
    }
    const main = parts[0] || t("rtOptKeep");
    if (off) sub = t("rtOptNothing");
    return `<div class="to-prev${off ? " off" : ""}" style="${style}" role="img" aria-label="${esc(`${e.name}: ${main}${sub ? `, ${sub}` : ""}`)}">
      <span class="to-prev-n">${esc(e.name)}</span><div class="big">${big}</div><b>${esc(main)}</b><small>${esc(sub)}</small></div>`;
  }

  // Regler bewegt (Eingabe): nur Vorschau, Wert und Schnellwahl nachführen, den Regler selbst nicht neu zeichnen
  onOptInput(el) {
    const spec = (this.entity(this.wiz.draft.entity_id)?.options || []).find((x) => x.key === el.dataset.k);
    if (!spec) return;
    this.setOpt(spec.key, Number(el.value));
    el.classList.remove("unset");
    el.style.setProperty("--fill", `${(((Number(el.value) - spec.min) / (spec.max - spec.min)) * 100).toFixed(1)}%`);
    const val = this.q(`[data-rt-val="${spec.key}"]`);
    if (val) val.textContent = this.optValueText(spec);
    for (const b of this.qa(`[data-rt="optq"][data-k="${spec.key}"]`)) {
      const on = b.dataset.v !== "" && this.optSpecValue(spec.key, b.dataset.v) === Number(el.value);
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", String(on));
    }
    this.paintZones(["prev", "result"]);
  }

  // Schritt 2: Wann
  step2Html() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    // Umschalter "Zu einer Zeit | Durch einen Auslöser" (seit 2.54.0)
    const mode = this.tabsHtml([
      { on: d.kind !== "trigger", attrs: 'data-rt="whenmode" data-v="time"', label: t("rtWhenModeTime") },
      { on: d.kind === "trigger", attrs: 'data-rt="whenmode" data-v="trigger"', label: t("rtWhenModeTrigger") },
    ]);
    if (d.kind === "trigger") return `${mode}${this.triggerPageHtml()}<div data-rt-zone="runs">${this.runsHtml()}</div>`;
    let html = mode + this.tabsHtml([["countdown", "rtKindIn"], ["once", "rtKindOnce"], ["repeat", "rtKindRepeat"]].map(([k, label]) => ({ on: d.kind === k, attrs: `data-rt="kind" data-v="${k}"`, label: t(label) })));
    if (d.kind === "countdown") {
      html += `<div class="mg-k">${esc(t("rtInLabel"))}</div>
        ${this.tabsHtml(DELAY_PRESETS.map((s) => ({ on: !d.delayOwn.text && d.delay_s === s, attrs: `data-rt="delay" data-s="${s}"`, label: this.fmtDur(s) })))}
        ${this.ownHtml("delay", d.delayOwn, t("rtOwnTime"))}
        ${this.delayError() ? `<div class="opt-error" data-rt-err="delay">${esc(this.delayError())}</div>` : ""}
        <p class="mg-hint">${esc(t("rtCountdownNote"))}</p>`;
    } else if (d.kind === "once") {
      // Schalter "Bestimmtes Datum" (aus = nächstes Eintreffen der Uhrzeit, an = Datum, zuerst morgen)
      html += `<div class="mg-optrow"><div>${esc(t("rtDateSwitch"))}</div><label class="switch"><input type="checkbox" data-rt="date-on"${d.date ? " checked" : ""} aria-label="${esc(t("rtDateSwitch"))}"><span></span></label></div>${
        d.date ? `<input class="mg-input rt-datein" type="date" data-rt="date" value="${esc(d.date)}" min="${esc(this.data.today || "")}" aria-label="${esc(t("rtDate"))}">` : ""
      }
        <div class="mg-k">${esc(t("rtTime"))}</div>
        <input class="mg-input rt-timein" type="time" data-rt="time" value="${esc(d.time)}" aria-label="${esc(t("rtTime"))}">
        <p class="mg-hint">${esc(t(d.date ? "rtOnceNote" : "rtOnceNoteNoDate"))}</p>`;
    } else {
      html += `<div class="mg-k">${esc(t("rtTime"))}</div>
        <input class="mg-input rt-timein" type="time" data-rt="time" value="${esc(d.time)}" aria-label="${esc(t("rtTime"))}">
        <div class="mg-k">${esc(t("rtRepeatLabel"))}</div>
        ${this.tabsHtml([["daily", "rtDaily"], ["weekly", "rtWeekly"], ["monthly", "rtMonthly"]].map(([k, label]) => ({ on: d.repeat === k, attrs: `data-rt="repeat" data-v="${k}"`, label: t(label) })))}`;
      if (d.repeat === "weekly") {
        html += `<div class="mg-k">${esc(t("rtDaysLabel"))}</div><div class="rt-wd" role="group" aria-label="${esc(t("rtDaysLabel"))}">${WEEKDAYS.map((i) => `<button type="button" class="${d.weekdays.includes(i) ? "on" : ""}" data-rt="wd" data-d="${i}" aria-pressed="${d.weekdays.includes(i)}">${esc(this.wd(i))}</button>`).join("")}</div>`;
      } else if (d.repeat === "monthly") {
        const sel = d.mdayOwn ? "own" : d.mday === 1 ? "1" : d.mday === 15 ? "15" : d.mday === -1 ? "last" : "own";
        html += `<div class="mg-k">${esc(t("rtMonthDay"))}</div>
          ${this.tabsHtml([["1", "1."], ["15", "15."], ["last", t("rtLastDay")], ["own", t("rtOtherDay")]].map(([k, label]) => ({ on: sel === k, attrs: `data-rt="mday" data-v="${k}"`, label })))}
          ${sel === "own" ? `<div class="mg-own"><span>${esc(t("rtMonthDay"))}</span><input class="mg-pill num mg-ownin" type="text" inputmode="numeric" data-rt="mday-own" value="${esc(d.mday > 0 ? d.mday : "")}" placeholder="1–31" aria-label="${esc(t("rtMonthDay"))}" autocomplete="off"></div>` : ""}
          <p class="mg-hint">${esc(t("rtMonthNote"))}</p>`;
      }
      html += `<p class="mg-hint">${esc(t("rtTzNote"))}</p>`;
    }
    return `${html}<div data-rt-zone="runs">${this.runsHtml()}</div>`;
  }

  // Nächste Ausführungen (vom Server, Zeitzone der Instanz)
  runsHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const w = this.wiz;
    if (w.pvError && (w.step === 2 || w.step === BACK_STEP)) return `<div class="opt-error" role="alert">${esc(w.pvError)}</div>`;
    const runs = w.pv?.next_runs;
    if (!runs?.length) return "";
    const label = w.draft.kind === "countdown" ? t("rtRunsAt") : t("rtNextRuns");
    // Mit "danach wieder zurückschalten": darunter, wann es wieder ein-/ausgeschaltet wird (vom Server auf die Minute genau gerechnet)
    const rows = runs.map((r) => `<div><span>${esc(this.dateText(r))}</span><span>${esc(r.time)}</span>${this.backLine(r)}</div>`).join("");
    return `<div class="mg-k">${esc(label)}</div><div class="rt-next">${rows}</div>`;
  }

  // Zeile "wieder aus: morgen 06:50" unter einer Ausführung, wenn zurückgeschaltet wird (seit 2.26.0)
  backLine(run) {
    const d = this.wiz.draft;
    if (!run?.back || !d.back_s || !canBack(d.action)) return "";
    const word = d.action === "set" ? "" : this.t(`rtRes_${resKey(this.domainOf(d.entity_id), opposite(d.action))}`);
    return `<small>${this.esc(d.back_mode === "restore" || d.action === "set" ? this.t("rtBackAtRowRestore", this.localText(run.back)) : this.t("rtBackAtRow", word, this.localText(run.back)))}</small>`;
  }

  // Schritt 3: Meldung
  step3Html() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    let html = `<p class="mg-note">${esc(t("rtPushNote"))}</p>
      <div class="mg-optrow"><div>${esc(t("rtPushSwitch"))}</div><label class="switch"><input type="checkbox" data-rt="push"${d.push ? " checked" : ""} aria-label="${esc(t("rtPushSwitch"))}"><span></span></label></div>`;
    if (!d.push) return `${html}<p class="mg-hint">${esc(t("rtPushOffNote"))}</p>`;
    html += `<div class="mg-k">${esc(t("rtRecipient"))}</div>
      <button type="button" class="mg-sel" data-rt="target-toggle" aria-expanded="${this.wiz.targetOpen}"><span>${esc(d.target ? this.niceTarget(d.target) : t("rtTargetDefault"))}<small>${esc(d.target || this.targetSub())}</small></span>${this.chevHtml(this.wiz.targetOpen)}</button>`;
    if (this.wiz.targetOpen) html += `<div class="mg-list" role="listbox">${this.targetListHtml()}</div>`;
    html += `<p class="mg-hint">${esc(t("rtTargetHint"))}</p>`;
    return `${html}<div data-rt-zone="pv">${this.pvHtml()}</div>`;
  }

  targetListHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    const row = (value, title, sub) =>
      `<button type="button" class="mg-opt-row${d.target === value ? " on" : ""}" data-rt="target" data-v="${esc(value)}" role="option" aria-selected="${d.target === value}"><span>${esc(title)}${sub ? `<br><small>${esc(sub)}</small>` : ""}</span>${d.target === value ? "<span>✓</span>" : ""}</button>`;
    let html = row("", t("rtTargetDefault"), this.targetSub());
    for (const [kind, label] of [["group", "rtTargetGroups"], ["service", "rtTargetServices"], ["entity", "rtTargetEntities"], ["missing", "rtTargetMissing"]]) {
      const list = this.data.targets.filter((x) => x.kind === kind);
      if (!list.length) continue;
      html += `<div class="mg-opt-head">${esc(t(label))}</div>${list.map((x) => row(x.value, this.niceTarget(x.value), x.value)).join("")}`;
    }
    return html;
  }

  // Vorschau der Meldung wie sie ankommt (fester Text), mit "Test senden"
  pvHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const w = this.wiz;
    if (!w.draft.push) return "";
    let inner;
    if (w.pvError) inner = `<div class="opt-error">${esc(t("rtPvError", w.pvError))}</div>`;
    else if (!w.pv) inner = `<div class="pv-text">…</div>`;
    else inner = `<div class="pv-title">${esc(w.pv.title)}</div><div class="pv-text">${esc(w.pv.message)}</div>`;
    const test = w.test?.busy
      ? `<div class="mg-testrow"><span class="opt-short">${esc(t("rtTestBusy"))}</span></div>`
      : `<div class="mg-testrow"><button type="button" class="linkbtn" data-rt="test">${esc(t("rtTestSend"))}</button>${w.test?.text ? `<span class="${w.test.failed ? "opt-error" : "opt-short"}" role="status">${esc(w.test.text)}</span>` : ""}</div>`;
    return `<div class="mg-pv"><div class="pv-k">${esc(t("rtPvLabel"))}</div><div class="pv-card"><div class="pv-app">${this.h.logo}${esc(t("rtPvApp"))}</div>${inner}</div><div class="opt-short">${esc(t("rtPvNote"))}</div>${test}</div>`;
  }

  // Schritt 4: Name und Prüfung
  step4Html() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    const e = this.entity(d.entity_id);
    const placeholder = e ? e.name : "";
    return `<label class="mg-k" for="rt-name">${esc(t("rtName"))}</label>
      <input id="rt-name" class="mg-input" type="text" maxlength="${this.limit("name", 60)}" data-rt="name" value="${esc(d.name)}" placeholder="${esc(placeholder)}" autocomplete="off">
      <p class="mg-hint">${esc(t("rtNameHint"))}</p>
      <div data-rt-zone="summary">${this.summaryHtml()}</div>
      <div class="mg-optrow"><div>${esc(t("rtEnabled"))}<small>${esc(t("rtEnabledNote"))}</small></div><label class="switch"><input type="checkbox" data-rt="enabled"${d.enabled ? " checked" : ""} aria-label="${esc(t("rtEnabled"))}"><span></span></label></div>`;
  }

  summaryHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const w = this.wiz;
    const d = w.draft;
    const e = this.entity(d.entity_id);
    const rt = this.draftRt();
    let html = `<div class="rt-sum"><b>${esc(this.whenText(rt))}</b>: ${esc(this.sentenceOf(rt, e?.name || ""))}.`;
    if (d.push) html += `<br>🔔 ${esc(t("rtSumPush", d.target ? this.niceTarget(d.target) : t("rtTargetDefaultShort")))}`;
    html += `</div>`;
    const first = w.pv?.next_runs?.[0];
    if (d.kind === "trigger") html += `<div class="mg-k">${esc(t("rtTrigState"))}</div><div class="rt-next"><div><span>${esc(t("rtWaitsTrigger"))}</span></div></div>`;
    else if (first) html += `<div class="mg-k">${esc(t("rtNextRun2"))}</div><div class="rt-next"><div><span>${esc(this.localText(first))}</span>${this.backLine(first)}</div></div>`;
    else if (w.pvError) html += `<div class="opt-error" role="alert">${esc(w.pvError)}</div>`;
    return html;
  }

  // --- Ereignisse -------------------------------------------------------------

  bindWindow(win) {
    this.bind(win);
    win.addEventListener("cancel", (ev) => {
      ev.preventDefault();
      this.requestClose();
    });
  }

  bind(dlg) {
    dlg.addEventListener("click", (ev) => this.onClick(ev));
    dlg.addEventListener("input", (ev) => this.onInput(ev));
    dlg.addEventListener("change", (ev) => this.onChange(ev));
  }

  // Zu einer Seite wechseln (Nummer); gibt es sie nicht (Optionen ohne Optionen), die nächste vorhandene
  setStep(step) {
    const order = this.steps();
    this.wiz.step = order.includes(step) ? step : step === OPTS_STEP ? 2 : step === BACK_STEP ? 3 : order.find((n) => n > step) ?? order[order.length - 1];
    this.paint();
    this.scrollTop();
    this.requestPreview();
  }

  // Eine Seite weiter (+1) oder zurück (-1) in der Reihenfolge der vorhandenen Seiten
  stepBy(delta) {
    const order = this.steps();
    const i = Math.min(Math.max(order.indexOf(this.wiz.step) + delta, 0), order.length - 1);
    this.setStep(order[i]);
  }

  onClick(ev) {
    const el = ev.target.closest?.("[data-rt]");
    if (!el || !this.inScope(el) || el.disabled) return;
    const w = this.wiz;
    const id = el.dataset.id;
    switch (el.dataset.rt) {
      case "list-filter":
        this.ui.filter = el.dataset.v;
        this.ui.sopen = {};
        this.paint();
        break;
      case "list-fold": {
        const shown = this.listShown();
        const open = this.listOpen(id, shown.length);
        (this.listFiltering() ? this.ui.sopen : this.ui.open)[id] = !open;
        this.paintList();
        break;
      }
      case "reload":
        this.error = null;
        this.paint();
        this.load(this.deviceId);
        break;
      case "add":
        this.startWizard();
        break;
      case "edit": {
        const rt = this.data?.routines.find((x) => x.id === id);
        if (rt) this.startWizard(rt);
        break;
      }
      case "run":
        this.run(id);
        break;
      case "delete":
        this.ui.confirmId = id;
        this.paint();
        break;
      case "delete-no":
        this.ui.confirmId = null;
        this.paint();
        break;
      case "delete-yes":
        this.remove(id);
        break;
      case "close":
      case "nav-cancel":
        this.requestClose();
        break;
      case "nav-back":
        this.stepBy(-1);
        break;
      case "dev-kind":
        w.devKind = el.dataset.v;
        this.paint();
        break;
      case "dev":
        w.pickId = id;
        // Eine einzelne Szene oder Gruppe aus der Suche: gleich vorgewählt auf der Seite "Was"
        w.pickEnt = el.dataset.ent || "";
        this.paint();
        break;
      case "nav-next":
        if (!this.canNext()) break;
        if (w.step === 0) this.chooseDevice();
        else this.stepBy(1);
        break;
      case "nav-quick":
        if (this.canSaveAll()) this.save();
        break;
      case "nav-save":
        if (this.canNext()) this.save();
        break;
      case "goto":
        this.setStep(Number(el.dataset.step));
        break;
      case "pick": {
        const e = this.entity(id);
        if (!e) break;
        w.draft.entity_id = id;
        w.draft.options = {};
        w.tried = null;
        if (!e.actions.includes(w.draft.action)) w.draft.action = e.actions[0];
        this.initSet(w.draft, e);
        if (!canBack(w.draft.action)) {
          w.draft.back_s = 0;
          w.draft.backKind = "none";
        }
        this.paint();
        break;
      }
      case "action":
        w.draft.action = el.dataset.v;
        w.tried = null;
        if (w.draft.action !== "on") w.draft.options = {};
        this.initSet(w.draft, this.entity(w.draft.entity_id));
        if (!canBack(w.draft.action)) {
          w.draft.back_s = 0;
          w.draft.backKind = "none";
          w.draft.backOwn = { text: "", unit: 60 };
        }
        this.paint();
        break;
      case "setopt":
        // Auswahl (select): Knopf; die Auswahlliste meldet sich über "change"
        if (el.tagName === "SELECT") break;
        w.draft.options = { option: el.dataset.v };
        w.tried = null;
        this.paint();
        this.requestPreview();
        break;
      case "bdur":
        w.draft.back_s = Number(el.dataset.s);
        w.draft.backOwn = { text: "", unit: 60 };
        this.paint();
        break;
      case "bmode":
        w.draft.back_mode = el.dataset.v;
        this.paint();
        this.requestPreview();
        break;
      case "optq":
        // Schnellwahl: "" = Wie zuletzt (Angabe löschen), sonst der Wert (Zahl oder Modus)
        this.setOpt(el.dataset.k, el.dataset.v === "" ? null : this.optSpecValue(el.dataset.k, el.dataset.v));
        this.paint();
        this.requestPreview();
        break;
      case "optcol":
        this.setOpt("rgb_color", el.dataset.v ? el.dataset.v.split(",").map(Number) : null);
        if (!el.dataset.v) this.setOpt("color_temp_kelvin", null);
        this.paint();
        this.requestPreview();
        break;
      case "kind":
        w.draft.kind = el.dataset.v;
        this.paint();
        this.requestPreview();
        break;
      case "delay":
        w.draft.delay_s = Number(el.dataset.s);
        w.draft.delayOwn = { text: "", unit: 60 };
        this.paint();
        this.requestPreview();
        break;
      case "repeat":
        w.draft.repeat = el.dataset.v;
        this.paint();
        this.requestPreview();
        break;
      case "wd": {
        const day = Number(el.dataset.d);
        const set = new Set(w.draft.weekdays);
        if (set.has(day)) set.delete(day);
        else set.add(day);
        w.draft.weekdays = [...set].sort((a, b) => a - b);
        this.paint();
        this.requestPreview();
        break;
      }
      case "mday": {
        const v = el.dataset.v;
        w.draft.mdayOwn = v === "own";
        if (v === "1") w.draft.mday = 1;
        else if (v === "15") w.draft.mday = 15;
        else if (v === "last") w.draft.mday = -1;
        else if (w.draft.mday < 1) w.draft.mday = 28;
        this.paint();
        this.requestPreview();
        break;
      }
      case "target-toggle":
        w.targetOpen = !w.targetOpen;
        this.paint();
        break;
      case "target":
        w.draft.target = el.dataset.v || "";
        w.targetOpen = false;
        w.test = null;
        this.paint();
        this.requestPreview();
        break;
      case "test":
        this.sendTest();
        break;
      case "try":
        this.tryNow();
        break;
      default:
        this.onTriggerClick(el);
    }
  }

  parseOwn(text, unit) {
    const n = Number(String(text).replace(",", "."));
    return text.trim() !== "" && Number.isFinite(n) && n > 0 ? Math.round(n * unit) : NaN;
  }

  onInput(ev) {
    const el = ev.target;
    if (el.dataset?.rt === "list-search" && this.inScope(el)) {
      this.ui.q = el.value;
      this.ui.sopen = {};
      this.paintList();
      return;
    }
    const w = this.wiz;
    if (!w || !this.inScope(el) || !el.dataset?.rt) return;
    const d = w.draft;
    switch (el.dataset.rt) {
      case "dev-search":
        w.devQuery = el.value;
        this.paintZones(["devs"]);
        break;
      case "ent-search":
        w.entQuery = el.value;
        this.paintZones(["ents"]);
        break;
      case "opt":
        this.onOptInput(el);
        break;
      case "setnum": {
        // Regler und Zahlenfeld gehören zusammen: beide führen den Wert nach, die Vorschau und die Prüfung laufen mit
        const e = this.entity(w.draft.entity_id);
        const spec = (e?.options || [])[0];
        const value = el.value === "" ? NaN : Number(el.value);
        w.draft.options = { value };
        w.tried = null;
        for (const other of this.qa('[data-rt="setnum"]')) if (other !== el) other.value = el.value;
        if (spec && Number.isFinite(value)) this.q('input[type="range"][data-rt="setnum"]')?.style.setProperty("--fill", `${(spec.max > spec.min ? ((Math.min(spec.max, Math.max(spec.min, value)) - spec.min) / (spec.max - spec.min)) * 100 : 0).toFixed(1)}%`);
        const val = this.q('[data-rt-val="set"]');
        if (val) val.textContent = Number.isFinite(value) ? this.setText({ options: { value }, entity_id: w.draft.entity_id }) : "–";
        const err = this.q('[data-rt-err="set"]');
        if (err) err.hidden = this.setValid(w.draft, e);
        this.paintZones(["result"]);
        this.syncNav();
        this.requestPreview();
        break;
      }
      case "optpick":
        // Farbwahl des Browsers: während des Ziehens nur die Vorschau, beim Loslassen (change) alles neu
        this.setOpt("rgb_color", fromHex(el.value));
        this.paintZones(["prev", "result"]);
        break;
      case "back-own":
        d.backOwn.text = el.value;
        d.back_s = this.parseOwn(el.value, d.backOwn.unit) || 0;
        if (el.value.trim() !== "" && !d.back_s) d.back_s = NaN;
        this.afterOwn("back");
        break;
      case "delay-own":
        d.delayOwn.text = el.value;
        d.delay_s = this.parseOwn(el.value, d.delayOwn.unit);
        this.afterOwn("delay");
        break;
      case "mday-own": {
        const n = Number(el.value);
        d.mday = Number.isInteger(n) ? n : 0;
        this.syncNav();
        this.requestPreview();
        break;
      }
      case "time":
        d.time = el.value;
        this.syncNav();
        this.requestPreview();
        break;
      case "date":
        d.date = el.value;
        this.syncNav();
        this.requestPreview();
        break;
      case "name":
        d.name = el.value;
        d.touched.name = true;
        break;
      default:
        this.onTriggerInput(el);
    }
  }

  // Eigene Zeit getippt: Fehlertext und Satz nachführen, ohne das Feld neu zu zeichnen
  afterOwn(kind) {
    const w = this.wiz;
    const win = this.win();
    // Eigene Zeit getippt: keine Voreinstellung gilt mehr, die Kapsel verschwindet
    for (const b of win.querySelectorAll(`[data-rt="${kind === "back" ? "bdur" : "delay"}"].on`)) {
      b.classList.remove("on");
      b.setAttribute("aria-checked", "false");
    }
    if (kind === "back") {
      const err = this.backError();
      let box = win.querySelector('[data-rt-err="back"]');
      if (err && !box) {
        box = document.createElement("div");
        box.className = "opt-error";
        box.dataset.rtErr = "back";
        win.querySelector(".mg-own")?.after(box);
      }
      if (box) {
        box.textContent = err;
        box.hidden = !err;
      }
      this.paintZones(["result", "backsum"]);
    } else {
      const err = this.delayError();
      let box = win.querySelector('[data-rt-err="delay"]');
      if (err && !box) {
        box = document.createElement("div");
        box.className = "opt-error";
        box.dataset.rtErr = "delay";
        win.querySelector(".mg-own")?.after(box);
      }
      if (box) {
        box.textContent = err;
        box.hidden = !err;
      }
      this.requestPreview();
    }
    this.syncNav();
    w.test = null;
  }

  onChange(ev) {
    const el = ev.target;
    const w = this.wiz;
    if (el.dataset?.rt === "toggle" && this.inScope(el)) {
      this.toggle(el.dataset.id, el.checked, el);
      return;
    }
    if (!w || !this.inScope(el) || !el.dataset?.rt) return;
    const d = w.draft;
    switch (el.dataset.rt) {
      case "setopt":
        d.options = { option: el.value };
        w.tried = null;
        this.paint();
        this.requestPreview();
        break;
      case "opt":
      case "optpick":
        // Losgelassen: Farben und Schnellwahl passend zum neuen Wert zeichnen (der Regler sitzt schon richtig)
        this.paint();
        this.requestPreview();
        break;
      case "back-unit":
        d.backOwn.unit = Number(el.value);
        d.back_s = this.parseOwn(d.backOwn.text, d.backOwn.unit) || 0;
        this.paint();
        break;
      case "delay-unit":
        d.delayOwn.unit = Number(el.value);
        d.delay_s = this.parseOwn(d.delayOwn.text, d.delayOwn.unit) || d.delay_s;
        this.paint();
        this.requestPreview();
        break;
      case "push":
        d.push = el.checked;
        w.test = null;
        this.paint();
        this.requestPreview();
        break;
      case "date-on":
        d.date = el.checked ? this.tomorrow() : "";
        this.paint();
        this.syncNav();
        this.requestPreview();
        break;
      case "enabled":
        d.enabled = el.checked;
        this.requestPreview();
        break;
      case "time":
        d.time = el.value;
        this.syncNav();
        this.requestPreview();
        break;
      case "date":
        d.date = el.value;
        this.syncNav();
        this.requestPreview();
        break;
      default:
        this.onTriggerChange(el);
    }
  }
}

// Bedingungs-Editor, Auslöser und Zurückschalten (routine-trigger.js)
Object.assign(RoutineUi.prototype, triggerMethods);
