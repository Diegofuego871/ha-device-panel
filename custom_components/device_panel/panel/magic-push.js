/**
 * Magic Push im Geräte-Popup (seit 2.6.0, docs/mockups/magic-push-v2, Variante C).
 *
 * Der Reiter verwaltet sich selbst: Er schreibt nur in einen eigenen Behälter (.mg-root) und hält seinen Stand
 * (Meldungen, Entwurf des Assistenten) im Speicher. Das Popup baut sich alle 10 Sekunden neu auf; deshalb setzt
 * attach() den Behälter nach jedem Neuaufbau aus dem Stand wieder zusammen, und solange der Assistent offen ist,
 * baut das Popup gar nicht neu (wizardOpen()). So geht beim Tippen nichts verloren.
 *
 * Aufbau: Liste der Meldungen (Name, Satz, Schalter, Bearbeiten/Umbenennen/Löschen) und ein Assistent in fünf
 * Schritten (Bedingungen · Wie lange · Versand · Text · Name; Bedingungen seit 2.15.0 als Baum aus Und/Oder mit einer
 * Ebene Gruppen, alle auf Seite 1). Der Assistent hat seit 2.11.0 ein eigenes Fenster (dialog.magic-dlg,
 * docs/mockups/magic-push-dialog-v1, Variante A): Vollbild auf dem Handy, breites Fenster mit Seitenspalte auf dem Desktop.
 * Der Reiter im Popup zeigt nur noch die Liste. Rückblick und Vorschau kommen vom Server (magic_history,
 * magic_preview), damit Panel und Meldung dieselbe Rechnung benutzen.
 */

const STEPS = 5;
const PRESET_FOR = [0, 60, 300, 600, 1800, 3600];
const PRESET_REPEAT = [0, 1800, 3600, 86400];
// Kritische Mitteilung: Lautstärke 1 bis 10 (iOS: 0.1 bis 1.0, der Server rechnet um)
const VOLUME_MAX = 10;
const FOR_UNITS = [1, 60, 3600, 86400];
const REPEAT_UNITS = [60, 3600, 86400];
const HIST_DELAY_MS = 450;
// Kennung einer Bedingung oder Gruppe im Entwurf (nur im Panel, geht nicht an den Server)
let LEAF_SEQ = 0;
const leafId = () => `c${(LEAF_SEQ += 1)}`;
const PREVIEW_DELAY_MS = 300;
// Felder, die der Server in einer Meldung annimmt (alles andere, etwa "active", würde er ablehnen).
const RULE_KEYS = ["id", "device_id", "entity_id", "name", "kind", "value", "for_s", "reset_value", "message", "body", "recover", "recover_message", "recover_body", "repeat_s", "target", "enabled", "critical", "critical_volume", "conditions", "reset_for_s"];

// Zeichen vor dem Eintrag: nach Geräteklasse, sonst nach Art der Entität.
const EMOJI_CLASS = {
  temperature: "🌡️",
  humidity: "💧",
  battery: "🔋",
  signal_strength: "📶",
  connectivity: "📶",
  window: "🪟",
  door: "🚪",
  garage_door: "🚪",
  opening: "🚪",
  motion: "🚶",
  occupancy: "🚶",
  power: "⚡",
  energy: "⚡",
  voltage: "⚡",
  current: "⚡",
  illuminance: "💡",
  pressure: "🧭",
  carbon_dioxide: "🫧",
  moisture: "💦",
  smoke: "🔥",
  problem: "⚠️",
};
const EMOJI_DOMAIN = { light: "💡", switch: "🔌", lock: "🔒", cover: "🪟", climate: "🌡️", fan: "🌀", update: "⬆️", water_heater: "🌡️" };

export function emojiFor(entity) {
  return EMOJI_CLASS[entity?.device_class] || EMOJI_DOMAIN[entity?.domain] || "🔔";
}

// Zahl aus einer Eingabe: Komma und Punkt, sonst null.
export function parseNumber(text) {
  const s = String(text ?? "").trim().replace(",", ".");
  if (!s || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Grösste Einheit, die ohne Rest aufgeht: 2700 s → 45 Min.
export function splitSeconds(seconds, units) {
  for (const unit of [...units].sort((a, b) => b - a)) {
    if (seconds >= unit && seconds % unit === 0) return { text: String(seconds / unit), unit };
  }
  return { text: "", unit: units[units.length > 1 ? 1 : 0] };
}

export class MagicPush {
  constructor(host, deps) {
    this.host = host;
    this.h = deps;
    this.root = null;
    this.reset();
  }

  // --- Stand ------------------------------------------------------------------

  reset() {
    window.clearTimeout(this._histTimer);
    window.clearTimeout(this._pvTimer);
    this.deviceId = null;
    this.data = null;
    this.loading = false;
    this.error = null;
    this.view = "list";
    this.wiz = null;
    this.standalone = false;
    this.closeWin();
    this.ui = { renameId: null, renameValue: "", confirmId: null, flash: "", error: "" };
    // Freie Entitäten, die im Assistenten gewählt wurden (Angaben vom Server), und die Suche danach
    this.extra = {};
    this._pendingEdit = null;
    this._seq = 0;
    window.clearTimeout(this._freeTimer);
  }

  t(key, ...args) {
    return this.host._t(key, ...args);
  }

  // Text, der fehlen darf (Kategorien und Variablen ohne Beschriftung).
  tt(key, ...args) {
    const value = this.host._t(key, ...args);
    return value == null ? "" : String(value);
  }

  esc(value) {
    return this.h.escape(value);
  }

  wizardOpen() {
    return this.view === "wizard" && Boolean(this.wiz);
  }

  // Fenster des Assistenten (steht fest im Panel, siehe device-panel.js) und Suche darin
  win() {
    return this.host.shadowRoot?.querySelector("dialog.magic-dlg") || null;
  }

  q(selector) {
    return this.win()?.querySelector(selector) || null;
  }

  qa(selector) {
    return this.win()?.querySelectorAll(selector) || [];
  }

  // Gehört das Element zur Liste im Popup oder zum Fenster des Assistenten?
  inScope(el) {
    return Boolean(this.root?.contains(el) || this.win()?.contains(el));
  }

  closeWin() {
    const win = this.win();
    if (!win) return;
    if (win.open) win.close();
    win.innerHTML = "";
    this._unwatch?.();
    win.style.removeProperty("--mgw-top");
    win.style.removeProperty("--mgw-h");
  }

  // Zahl der eingeschalteten Meldungen für die Beschriftung des Reiters (null: noch nicht geladen).
  count(deviceId) {
    if (!this.data || this.deviceId !== deviceId) return null;
    return this.data.rules.filter((r) => r.enabled).length;
  }

  // Sichtbare Fläche (ohne Tastatur) in Koordinaten dieses Fensters. Auf dem Handy schrumpft das visualViewport des
  // obersten Fensters, wenn die Tastatur kommt, oder es verschiebt sich, weil das Handy die Seite hochschiebt; das Panel
  // liegt in einem iframe, darum zählt dessen Abstand zum oberen Rand mit.
  visibleArea() {
    const full = { top: 0, bottom: window.innerHeight };
    try {
      const top = this.host._topWindow?.() || window;
      const vv = top.visualViewport || window.visualViewport;
      if (!vv) return full;
      const frameTop = top === window ? 0 : window.frameElement?.getBoundingClientRect().top || 0;
      return { top: Math.max(0, vv.offsetTop - frameTop), bottom: Math.min(window.innerHeight, vv.offsetTop + vv.height - frameTop) };
    } catch (err) {
      return full;
    }
  }

  viewport() {
    try {
      return (this.host._topWindow?.() || window).visualViewport || window.visualViewport || null;
    } catch (err) {
      return window.visualViewport || null;
    }
  }

  // Handy: das Fenster nur so hoch wie die sichtbare Fläche, sonst deckt die Tastatur Felder und Knöpfe zu
  fitWindow() {
    const win = this.win();
    if (!win) return;
    const narrow = Boolean(window.matchMedia?.("(max-width: 700px)").matches);
    const area = this.visibleArea();
    const h = area.bottom - area.top;
    if (narrow && h > 0 && h < window.innerHeight - 60) {
      win.style.setProperty("--mgw-top", `${Math.round(area.top)}px`);
      win.style.setProperty("--mgw-h", `${Math.round(h)}px`);
    } else {
      win.style.removeProperty("--mgw-top");
      win.style.removeProperty("--mgw-h");
    }
  }

  // Solange das Fenster offen ist, folgt es der sichtbaren Fläche
  watchViewport() {
    if (this._unwatch) return;
    const vv = this.viewport();
    if (!vv?.addEventListener) return;
    const fit = () => this.fitWindow();
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    this._unwatch = () => {
      vv.removeEventListener("resize", fit);
      vv.removeEventListener("scroll", fit);
      this._unwatch = null;
    };
  }

  // Nächster Vorfahre, der wirklich scrollt (im Fenster des Assistenten der Inhalt, nicht das Fenster)
  scrollParent(el) {
    const win = this.win();
    for (let node = el.parentElement; node && node !== win; node = node.parentElement) {
      const overflow = getComputedStyle(node).overflowY;
      if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight + 1) return node;
    }
    return null;
  }

  // Ein Feld, das gleich getippt wird, an den oberen Rand der sichtbaren Fläche holen: die Tastatur des Handys deckt das Feld
  // sonst zu, wenn es weiter unten steht. Die sichtbare Fläche ändert sich erst, während die Tastatur einfährt (und das Handy
  // schiebt die Seite von sich aus), darum noch einmal danach (visualViewport). Im Fenster des Assistenten wird nur der
  // Inhalt gescrollt und die Lage der sichtbaren Fläche eingerechnet; ein Scrollen des Fensters selbst würde das Feld
  // zu weit nach oben aus dem Bild schieben (gemeldet 2026-10-11).
  revealField(el) {
    if (!el) return;
    const go = () => {
      if (!el.isConnected) return;
      if (!this.win()?.contains(el)) {
        el.scrollIntoView({ block: "start", behavior: "smooth" });
        return;
      }
      this.fitWindow();
      const sc = this.scrollParent(el);
      if (!sc) return;
      const want = Math.max(sc.getBoundingClientRect().top, this.visibleArea().top) + 8;
      sc.scrollTop += el.getBoundingClientRect().top - want;
    };
    window.setTimeout(go, 60);
    const vv = this.viewport();
    if (!vv?.addEventListener) return;
    const again = () => {
      vv.removeEventListener("resize", again);
      window.setTimeout(go, 60);
    };
    vv.addEventListener("resize", again);
    window.setTimeout(() => vv.removeEventListener("resize", again), 1500);
  }

  // Aus der Übersicht in den Einstellungen: den Assistenten mit dieser Meldung öffnen, sobald die Liste da ist
  editWhenLoaded(ruleId) {
    this._pendingEdit = ruleId;
    this.applyPending();
  }

  applyPending() {
    if (!this._pendingEdit || !this.data) return;
    const rule = this.data.rules.find((r) => r.id === this._pendingEdit);
    this._pendingEdit = null;
    if (rule) this.startWizard(rule);
  }

  // Popup geöffnet: bei einem anderen Gerät von vorn beginnen und im Hintergrund laden.
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
      const result = await this.host._hass.callWS({ type: "device_panel/magic_get", device_id: deviceId });
      if (this.deviceId !== deviceId) return;
      this.data = result;
      this.applyPending();
    } catch (err) {
      if (this.deviceId !== deviceId) return;
      this.error = this.h.errText(err);
      // Aus der Übersicht geöffnet: der Fehler gehört dorthin (es gibt kein Popup, das ihn zeigt)
      const all = this.standalone ? this.host._mgAll : null;
      if (all) {
        all.err = this.t("mgLoadError", this.error);
        this._pendingEdit = null;
        this.host._renderMagicAll?.();
      }
    }
    this.loading = false;
    this.refresh();
  }

  // Nach dem Laden oder Speichern: Beschriftung des Reiters (Popup) und, wenn sichtbar, den Inhalt auffrischen.
  refresh() {
    if (this.host._detailId !== this.deviceId) return;
    if (this.host._devTab === "magic" && this.root?.isConnected) this.paint();
    this.host._renderDevice(true);
  }

  // Das Popup hat sich neu aufgebaut: Behälter aus dem Stand füllen.
  attach(root) {
    this.root = root;
    if (!this.data && !this.loading && !this.error && this.deviceId) this.load(this.deviceId);
    // Der Assistent lebt in seinem eigenen Fenster und bleibt vom Neuaufbau des Popups unberührt
    if (!this.wizardOpen()) this.paint();
  }

  entity(id) {
    return this.data?.entities.find((e) => e.entity_id === id) || this.data?.extra_entities?.find((e) => e.entity_id === id) || this.extra[id] || null;
  }

  // Angaben zur Entität einer Meldung: aus der Liste aller Geräte (rule.entity) oder aus dem Popup des Geräts
  entityOf(rule) {
    return rule.entity || this.entity(rule.entity_id);
  }

  // Frei = nicht von diesem Gerät (seit 2.10.0)
  isFree(entityId) {
    return Boolean(entityId) && !this.data?.entities.some((e) => e.entity_id === entityId);
  }

  // --- Anzeige-Hilfen ---------------------------------------------------------

  fmtNum(n) {
    try {
      return Number(n).toLocaleString(this.host._locale(), { maximumFractionDigits: 2 });
    } catch (err) {
      return String(n);
    }
  }

  fmtDur(seconds) {
    const s = Math.round(seconds);
    if (!s) return this.t("mgInstant");
    const parts = [];
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d) parts.push(`${d} ${this.t("mgDayShort")}`);
    if (h) parts.push(`${h} ${this.t("mgHourShort")}`);
    if (m) parts.push(`${m} ${this.t("mgMinShort")}`);
    if (sec) parts.push(`${sec} ${this.t("mgSecShort")}`);
    return parts.slice(0, 2).join(" ");
  }

  // Empfänger nett beschriften: notify.mobile_app_dani_iphone → "Dani iPhone" ist nicht ableitbar, aber lesbar.
  niceTarget(value) {
    const name = String(value || "").replace(/^notify\./, "").replace(/^mobile_app_/, "").replace(/_/g, " ");
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : String(value || "");
  }

  targetLabel(value) {
    if (!value) return this.t("mgTargetDefault");
    return this.niceTarget(value);
  }

  // Wert mit Einheit oder das Wort des Zustands.
  entityValue(e) {
    if (!e) return "";
    if (!e.available) return this.t("mgNotReachable");
    return e.kind === "number" && e.unit ? `${e.value} ${e.unit}` : String(e.value ?? "");
  }

  limit(name, fallback) {
    return this.data?.limits?.[name] ?? fallback;
  }

  // Bedingung als Satzteil ("unter 12 °C", "ist offen", "ändert sich").
  condText(rule, e = this.entityOf(rule)) {
    const unit = e?.kind === "number" && e.unit ? ` ${e.unit}` : "";
    if (rule.kind === "change") return this.t("mgSentenceChange");
    if (rule.kind === "is" && e?.kind === "state") {
      const word = e.options?.find((o) => o.value === String(rule.value))?.label ?? String(rule.value ?? "");
      return this.t("mgSentenceIs", word);
    }
    const num = this.fmtNum(rule.value) + unit;
    if (rule.kind === "above") return this.t("mgSentenceAbove", num);
    if (rule.kind === "below") return this.t("mgSentenceBelow", num);
    return this.t("mgSentenceIs", num);
  }

  // "zurück ab 14 °C" (unter), "zurück bis 70 %" (über), "zurück bei geschlossen" (ist)
  resetSentence(rule) {
    const e = this.entityOf(rule);
    const unit = e?.kind === "number" && e.unit ? ` ${e.unit}` : "";
    if (rule.kind === "is") {
      const word = e?.options?.find((o) => o.value === String(rule.reset_value))?.label ?? String(rule.reset_value);
      return this.t("mgSentenceResetAt", word);
    }
    return this.t(rule.kind === "above" ? "mgSentenceResetTo" : "mgSentenceResetFrom", this.fmtNum(rule.reset_value) + unit);
  }

  entityName(rule) {
    return this.entityOf(rule)?.name || rule.entity_id;
  }

  repeatText(seconds) {
    if (!seconds) return this.t("mgSentenceOnce");
    return this.t("mgSentenceEvery", this.fmtDur(seconds));
  }

  // "Temperatur unter 12 °C · für 10 Min. · einmal · mit "wieder normal""
  sentence(rule) {
    const many = rule.conditions?.items && this.leavesOf({ conds: rule.conditions }).length > 1;
    const parts = [many ? this.treeText(rule.conditions, (id) => this.entityByIdOf(rule, id)) : `${this.entityName(rule)} ${this.condText(rule)}`];
    parts.push(rule.for_s ? this.t("mgSentenceFor", this.fmtDur(rule.for_s)) : this.t("mgSentenceNow"));
    if (rule.kind !== "change") {
      parts.push(this.repeatText(rule.repeat_s));
      if (rule.recover) parts.push(this.t("mgSentenceRecover"));
      if (rule.reset_for_s) parts.push(this.t("mgSentenceResetFor", this.fmtDur(rule.reset_for_s)));
    }
    if (!many && rule.kind !== "change" && rule.reset_value != null && rule.reset_value !== "") parts.push(this.resetSentence(rule));
    if (rule.critical) parts.push(this.t("mgSentenceCritical", rule.critical_volume ?? VOLUME_MAX));
    if (rule.target) parts.push(this.t("mgSentenceTo", this.niceTarget(rule.target)));
    return parts.join(" · ");
  }

  // Vorschlag für den Namen aus Entität und Bedingung.
  // Entität einer Bedingung: aus der Regel (Übersicht), sonst aus dem Popup des Geräts
  entityByIdOf(rule, id) {
    return rule?.leaf_entities?.[id] || (id === rule?.entity_id ? rule.entity : null) || this.entity(id);
  }

  // Ganze Bedingung als Satz: "Temperatur unter 12 °C und (Fenster ist offen oder Feuchte über 60 %)"
  treeText(tree, resolve) {
    const part = (item, nested) => {
      if (item.items) {
        const text = item.items.map((x) => part(x, true)).join(` ${this.t(item.op === "or" ? "mgOrWord" : "mgAndWord")} `);
        return nested && item.items.length > 1 ? `(${text})` : text;
      }
      const e = resolve(item.entity_id);
      return `${e?.name || item.entity_id} ${this.condText(item, e)}`;
    };
    return part(tree, false);
  }

  // --- Bedingungen im Entwurf (seit 2.15.0) ---------------------------------------

  newLeaf(entityId = "") {
    return { uid: leafId(), entity_id: entityId, kind: "below", value: "", reset_value: "", resetOwn: false };
  }

  // Alle Bedingungen der Reihe nach (Gruppen aufgelöst). Die erste gilt für Name, Variablen und Standardtexte.
  leavesOf(d = this.wiz?.draft) {
    const out = [];
    for (const item of d?.conds?.items || []) {
      if (item.items) out.push(...item.items);
      else out.push(item);
    }
    return out;
  }

  findLeaf(uid) {
    return this.leavesOf().find((l) => l.uid === uid) || null;
  }

  curLeaf() {
    return this.findLeaf(this.wiz?.cur);
  }

  // Die erste Bedingung steht zusätzlich in den alten Feldern des Entwurfs (Namen, Texte und Variablen bauen darauf)
  syncPrimary(d = this.wiz.draft) {
    const first = this.leavesOf(d)[0];
    d.entity_id = first?.entity_id || "";
    d.kind = first?.kind || "below";
    d.value = first?.value ?? "";
    d.resetOwn = Boolean(first?.resetOwn);
    d.reset_value = first?.reset_value ?? "";
  }

  // Leere Gruppen fallen weg; genau eine Bedingung steht ohne Gruppe
  tidyTree(d = this.wiz.draft) {
    d.conds.items = d.conds.items.filter((i) => !i.items || i.items.length);
    const leaves = this.leavesOf(d);
    if (leaves.length === 1) d.conds.items = [leaves[0]];
  }

  // Vorgabe für eine neu gewählte Entität: Zahl "unter" dem jetzigen Wert, Zustand der andere
  leafDefaults(lf, e) {
    if (e.kind === "number") {
      lf.kind = "below";
      lf.value = e.number != null ? String(Math.round(e.number * 10) / 10) : "";
    } else {
      lf.kind = "is";
      const other = e.options?.find((o) => o.value !== String(e.state)) || e.options?.[0];
      lf.value = other ? other.value : "";
    }
    lf.resetOwn = false;
    lf.reset_value = "";
  }

  leafValid(lf) {
    const e = this.entity(lf.entity_id);
    if (!e) return false;
    if (lf.kind === "above" || lf.kind === "below") return parseNumber(lf.value) != null && !this.resetError(lf);
    if (lf.kind === "is") return String(lf.value).trim() !== "" && (e.kind !== "number" || parseNumber(lf.value) != null) && !this.resetError(lf);
    return true;
  }

  // Bedingung für den Server: Zahl bei Zahlen, Zustand bei Zuständen
  leafPayload(lf) {
    const e = this.entity(lf.entity_id);
    let value = null;
    if (lf.kind === "above" || lf.kind === "below") value = parseNumber(lf.value);
    else if (lf.kind === "is") value = e?.kind === "number" ? (parseNumber(lf.value) ?? lf.value) : lf.value;
    return { entity_id: lf.entity_id, kind: lf.kind, value, reset_value: this.resetPayload(lf, e) };
  }

  treePayload(d = this.wiz.draft) {
    return {
      op: d.conds.op,
      items: d.conds.items.map((it) => (it.items ? { op: it.op, items: it.items.map((l) => this.leafPayload(l)) } : this.leafPayload(it))),
    };
  }

  onPick(id) {
    const e = this.entity(id);
    const w = this.wiz;
    if (!e || !w) return;
    const d = w.draft;
    const add = w.adding;
    if (add?.replace) {
      const lf = this.findLeaf(add.replace);
      if (lf && lf.entity_id !== id) {
        lf.entity_id = id;
        this.leafDefaults(lf, e);
      }
      w.cur = add.replace;
    } else {
      const lf = this.newLeaf(id);
      this.leafDefaults(lf, e);
      if (add?.group === "new") d.conds.items.push({ uid: leafId(), op: "or", items: [lf] });
      else if (add?.group) d.conds.items.find((g) => g.uid === add.group)?.items.push(lf);
      else d.conds.items.push(lf);
      w.cur = lf.uid;
    }
    w.adding = null;
    w.free.open = false;
    this.syncPrimary();
    this.syncDefaults();
    this.paint();
    this.syncNav();
    this.requestLeafHistory();
  }

  startAdd(adding) {
    this.wiz.adding = adding;
    this.wiz.free.open = false;
    this.paint();
    this.scrollTop();
  }

  removeLeaf(uid) {
    const w = this.wiz;
    const d = w.draft;
    d.conds.items = d.conds.items
      .map((it) => (it.items ? { ...it, items: it.items.filter((l) => l.uid !== uid) } : it))
      .filter((it) => (it.items ? it.items.length : it.uid !== uid));
    this.afterTreeChange(uid);
  }

  removeGroup(uid) {
    const d = this.wiz.draft;
    const gone = d.conds.items.find((it) => it.uid === uid)?.items.map((l) => l.uid) || [];
    d.conds.items = d.conds.items.filter((it) => it.uid !== uid);
    this.afterTreeChange(gone.includes(this.wiz.cur) ? this.wiz.cur : null);
  }

  afterTreeChange(removedUid) {
    const w = this.wiz;
    this.tidyTree();
    const leaves = this.leavesOf();
    if (w.cur === removedUid || !this.findLeaf(w.cur)) w.cur = leaves.length === 1 ? leaves[0].uid : null;
    this.syncPrimary();
    this.syncDefaults();
    this.paint();
    this.syncNav();
    this.requestLeafHistory();
  }

  // Eine Bedingung auf- oder zuklappen (immer höchstens eine ist offen)
  openLeaf(uid) {
    const w = this.wiz;
    w.cur = w.cur === uid ? null : uid;
    this.paint();
    this.requestLeafHistory();
  }

  suggestName(draft) {
    const e = this.entity(draft.entity_id);
    if (!e) return "";
    const rule = { entity_id: draft.entity_id, kind: draft.kind, value: draft.kind === "change" ? null : (parseNumber(draft.value) ?? draft.value) };
    const text = `${e.name} ${this.condText(rule)}`;
    return text.slice(0, this.limit("name", 60));
  }

  defaultMessage(draft) {
    const e = this.entity(draft.entity_id);
    if (draft.kind === "change") return this.t("mgDefaultMsg_change");
    if (draft.kind === "is") return this.t(e?.kind === "number" ? "mgDefaultMsg_isNumber" : "mgDefaultMsg_isState").trim();
    return this.t(draft.kind === "above" ? "mgDefaultMsg_above" : "mgDefaultMsg_below").trim();
  }

  defaultRecover(draft) {
    const e = this.entity(draft.entity_id);
    return this.t(e?.kind === "number" ? "mgDefaultRecover_number" : "mgDefaultRecover_state").trim();
  }

  // Inhalt unter dem Titel (seit 2.7.0): Vorgabe wie die frühere automatische Zeile
  defaultBody(draft) {
    if (draft.kind === "change") return this.t("mgDefaultBody_change");
    return draft.for_s > 0 ? this.t("mgDefaultBody_since") : this.t("mgDefaultBody_plain");
  }

  defaultRecoverBody() {
    return this.t("mgDefaultRecoverBody");
  }

  // --- Server -----------------------------------------------------------------

  call(msg) {
    return this.host._hass.callWS(msg);
  }

  // Meldung (gespeichert oder Entwurf) als Nachricht an den Server.
  payload(source) {
    const out = {};
    for (const key of RULE_KEYS) if (key in source && source[key] !== undefined) out[key] = source[key];
    return out;
  }

  // Eigener Rücksetzwert für den Server: Zahl bei Zahlen, Zustand bei Zuständen; sonst leer (automatisch)
  resetPayload(lf, e = this.entity(lf.entity_id)) {
    if (!lf.resetOwn || lf.kind === "change" || String(lf.reset_value).trim() === "") return null;
    return e?.kind === "number" ? parseNumber(lf.reset_value) : lf.reset_value;
  }

  draftPayload() {
    const d = this.wiz.draft;
    const leaves = this.leavesOf();
    const first = leaves.length ? this.leafPayload(leaves[0]) : { entity_id: d.entity_id, kind: d.kind, value: null, reset_value: null };
    const out = {
      device_id: this.deviceId,
      entity_id: first.entity_id,
      name: (d.name || "").trim() || this.suggestName(d) || "Magic Push",
      kind: first.kind,
      value: first.value,
      for_s: d.for_s,
      reset_for_s: d.kind === "change" ? 0 : d.reset_for_s,
      reset_value: first.reset_value,
      message: d.message,
      body: d.body,
      recover: d.kind === "change" ? false : d.recover,
      recover_message: d.recover_message,
      recover_body: d.recover_body,
      repeat_s: d.kind === "change" ? 0 : d.repeat_s,
      target: d.target || null,
      enabled: d.enabled,
      critical: d.critical,
      critical_volume: d.critical_volume,
    };
    // Mehrere Bedingungen (seit 2.15.0): der Baum; die erste steht zusätzlich in den alten Feldern
    if (leaves.length > 1) out.conditions = this.treePayload(d);
    if (d.id) out.id = d.id;
    return out;
  }

  // --- Liste ------------------------------------------------------------------

  paint() {
    if (this.view === "wizard" && this.wiz) {
      this.paintWindow();
      return;
    }
    if (!this.root?.isConnected) return;
    this.root.innerHTML = this.listHtml();
    if (this.ui.renameId) {
      const input = this.root.querySelector('input[data-mg="rename-input"]');
      if (input) {
        input.focus({ preventScroll: true });
        input.select();
        this.revealField(input);
      }
    }
  }

  // Assistent im eigenen Fenster: Kopf, Fortschritt, Inhalt (scrollt) und Knöpfe (fest). Beim Neuzeichnen bleibt die Scrollposition.
  paintWindow() {
    const win = this.win();
    if (!win) return;
    const scrolls = [".mgw-body", ".mgw-main", ".mgw-side"].map((sel) => [sel, win.querySelector(sel)?.scrollTop || 0]);
    win.innerHTML = this.wizardHtml();
    if (!win.open) {
      if (typeof win.showModal === "function") win.showModal();
      else win.setAttribute("open", "");
      this.host._blurOnTouch?.();
    }
    this.watchViewport();
    this.fitWindow();
    this.placeSide(win);
    this.paintZones();
    // Rückfrage: Fokus auf die sichere Antwort, damit Enter nichts verwirft
    if (this.wiz?.confirmClose) win.querySelector('[data-mg="discard-no"]')?.focus({ preventScroll: true });
    for (const [sel, top] of scrolls) {
      const el = win.querySelector(sel);
      if (el) el.scrollTop = top;
    }
  }

  // Desktop: Diagramm, Rückblick und Vorschau rechts neben dem Formular (seit 2.11.0); schmal bleiben sie im Fluss des Formulars
  wide() {
    return Boolean(window.matchMedia?.("(min-width: 900px)").matches);
  }

  placeSide(win) {
    if (!this.wide()) return;
    const body = win.querySelector(".mgw-body");
    // Rechts stehen nur Rückblick (Schritt 2) und die Zusammenfassung (Schritt 5); sonst bleibt alles unter seinen Feldern
    const step = this.wiz?.step;
    const names = step === 2 ? ["chart", "hist"] : step === 5 ? ["pv"] : [];
    const zones = names.map((n) => body?.querySelector(`[data-mg-zone="${n}"]`)).filter(Boolean);
    if (!zones.length) return;
    const side = document.createElement("aside");
    side.className = "mgw-side";
    side.append(...zones);
    body.classList.add("two");
    body.append(side);
  }

  listHtml() {
    const { esc, t } = { esc: (v) => this.esc(v), t: (k, ...a) => this.t(k, ...a) };
    let html = `<h3>${esc(t("mgTab"))}</h3><p class="mg-note">${esc(t("mgIntro"))}</p>`;
    if (this.ui.flash) html += `<div class="mg-flash" role="status">${esc(this.ui.flash)}</div>`;
    if (this.ui.error) html += `<div class="dlg-error">${esc(this.ui.error)}</div>`;
    if (!this.data) {
      if (this.error) {
        return `${html}<div class="dlg-error">${esc(t("mgLoadError", this.error))}</div><button type="button" class="qbtn" data-mg="reload">${esc(t("mgRetry"))}</button>`;
      }
      return `${html}<p class="mg-note">${esc(t("mgLoading"))}</p>`;
    }
    const rules = this.data.rules;
    if (!rules.length) html += `<p class="mg-empty">${esc(t("mgEmpty"))}</p>`;
    if (rules.length) html += `<div class="pr-devlink"><button type="button" class="linkbtn" data-proto="magic" data-device="${esc(this.deviceId)}" data-name="${esc(this.host._devices?.find((d) => d.id === this.deviceId)?.name || "")}">${esc(t("prDeviceLink"))} ›</button></div>`;
    html += rules.map((r) => this.cardHtml(r)).join("");
    const full = rules.length >= this.limit("per_device", 20);
    html += full
      ? `<p class="mg-hint">${esc(t("mgLimit", this.limit("per_device", 20)))}</p>`
      : `<button type="button" class="mg-add" data-mg="add">${this.h.mdi("plus", 18)}${esc(t("mgAdd"))}</button>`;
    return html;
  }

  // Zeile unter dem Satz: Zustand der Entität, ob sie gilt, wann zuletzt, und woher eine freie Entität kommt
  statusParts(r) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const status = [];
    if (r.entity_missing) status.push(`<span class="mg-warn">${esc(t("mgEntityMissing"))}</span>`);
    else if (!r.available && r.enabled) status.push(`<span class="mg-warn">${esc(t("mgUnreachable"))}</span>`);
    if (!r.enabled) status.push(esc(t("mgDisabled")));
    else if (r.active) status.push(`<span class="mg-on">${esc(r.fired ? t("mgFiredNow") : t("mgActiveNow"))}</span>`);
    if (r.last_fired) {
      const ago = (Date.now() + this.host._offset) / 1000 - r.last_fired;
      status.push(esc(ago < 60 ? t("mgJustNow") : t("mgLast", this.host._fmtSeconds(ago, true))));
    } else status.push(esc(t("mgNever")));
    if (r.entity_free) status.push(`<span class="mg-freetag">${esc(t("mgFreeTag", r.entity_id))}</span>`);
    return status;
  }

  cardHtml(r) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const e = this.entity(r.entity_id);
    const renaming = this.ui.renameId === r.id;
    const confirming = this.ui.confirmId === r.id;
    const status = this.statusParts(r);
    const title = renaming
      ? `<div class="mg-t"><input class="mg-input" type="text" data-mg="rename-input" maxlength="${this.limit("name", 60)}" value="${esc(this.ui.renameValue)}" aria-label="${esc(t("mgRenameLabel"))}">
          <div class="mg-btns small"><button type="button" class="dlg-btn" data-mg="rename-cancel">${this.h.mdi("close", 18)}${esc(t("mgCancel"))}</button><button type="button" class="dlg-btn primary" data-mg="rename-save">${this.h.mdi("save", 18)}${esc(t("mgSave"))}</button></div></div>`
      : `<div class="mg-t"><b>${esc(r.name)}</b><small>${esc(this.sentence(r))}</small><small class="mg-status">${status.join(" · ")}</small></div>`;
    const sw = `<label class="switch"><input type="checkbox" data-mg="toggle" data-id="${esc(r.id)}"${r.enabled ? " checked" : ""} aria-label="${esc(r.name)}"><span></span></label>`;
    let acts = "";
    if (!renaming && !confirming) {
      acts = `<div class="mg-acts"><button type="button" class="linkbtn" data-mg="edit" data-id="${esc(r.id)}">${esc(t("mgActEdit"))}</button>
        <button type="button" class="linkbtn" data-proto="magic" data-id="${esc(r.id)}" data-device="${esc(r.device_id)}" data-name="${esc(r.name)}">${esc(t("prAct"))}</button>
        <button type="button" class="linkbtn" data-mg="rename" data-id="${esc(r.id)}">${esc(t("mgActRename"))}</button>
        <button type="button" class="linkbtn danger" data-mg="delete" data-id="${esc(r.id)}">${esc(t("mgActDelete"))}</button></div>`;
    }
    const confirm = confirming
      ? `<div class="mg-confirm"><b>${esc(t("mgDeleteAsk", r.name))}</b><small>${esc(t("mgDeleteNote"))}</small>
          <div class="mg-btns small"><button type="button" class="dlg-btn" data-mg="delete-no">${this.h.mdi("close", 18)}${esc(t("mgCancel"))}</button><button type="button" class="dlg-btn danger" data-mg="delete-yes" data-id="${esc(r.id)}">${this.h.mdi("trash", 18)}${esc(t("mgDeleteYes"))}</button></div></div>`
      : "";
    return `<div class="mg-card${r.enabled ? "" : " off"}"><div class="mg-row"><span class="mg-ic" aria-hidden="true">${emojiFor(e)}</span>${title}${renaming ? "" : sw}</div>${acts}${confirm}</div>`;
  }

  // --- Übersicht aller Meldungen (eigenes Fenster der App "Magic Push", seit 2.75.0; bis 2.74.0 ein Reiter in den Einstellungen) --------------------------

  // Seit 2.13.0 (docs/mockups/magic-overview-v1, Variante B): pro Gerät eine einklappbare Karte (Kopf mit Symbol, Name,
  // Bereich und Integration, Zahl; zu: Kurzfassung), darin die Meldungen mit Schalter, Bearbeiten und Löschen; darüber
  // Suchfeld und Filter (Alle, An, Aus, Ausgelöst). Neue Meldungen gibt es hier nicht, sie entstehen im Popup des Geräts.
  // Suche und Filter klappen die Treffer auf; der Zustand "zu/offen" gilt, solange das Fenster offen ist.
  allQuery(all) {
    return String(all?.query || "").trim();
  }

  collate() {
    return [this.host._locale() || undefined, { sensitivity: "base" }];
  }

  // Alle Meldungen nach Gerät: Name, Untertitel (Bereich · Integration), Ausfall; sortiert nach Gerätename
  allGroups(all, devices) {
    const byDevice = new Map();
    for (const r of all.rules) {
      if (!byDevice.has(r.device_id)) byDevice.set(r.device_id, []);
      byDevice.get(r.device_id).push(r);
    }
    const [loc, opt] = this.collate();
    return [...byDevice.entries()]
      .map(([id, rules]) => {
        const dev = devices.find((d) => d.id === id);
        return {
          id,
          dev,
          name: dev?.name || rules[0].device_name || id,
          sub: dev ? [dev.area, this.host._integName(dev)].filter(Boolean).join(" · ") : "",
          off: dev?.online === false,
          rules: rules.sort((a, b) => a.name.localeCompare(b.name, loc, opt)),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, loc, opt));
  }

  // Suchtext einer Meldung: Name, Satz, Gerät, Bereich, Integration, Empfänger, Entität
  haystack(r, g) {
    const e = this.entityOf(r);
    return [r.name, this.sentence(r), g.name, g.sub, r.target, r.entity_id, e?.name].filter(Boolean).join(" ").toLowerCase();
  }

  passes(r, g, q, filter) {
    if (filter === "on" && !r.enabled) return false;
    if (filter === "off" && r.enabled) return false;
    if (filter === "fired" && !(r.enabled && r.active)) return false;
    return !q || q.toLowerCase().split(/\s+/).every((w) => this.haystack(r, g).includes(w));
  }

  allCounts(rules) {
    return { all: rules.length, on: rules.filter((r) => r.enabled).length, off: rules.filter((r) => !r.enabled).length, fired: rules.filter((r) => r.enabled && r.active).length };
  }

  // Filter aktiv? Dann sind die Treffer aufgeklappt (eigener Zustand, der beim Ändern von Suche und Filter neu beginnt)
  isFiltering(all) {
    return Boolean(this.allQuery(all)) || (all.filter || "all") !== "all";
  }

  isOpen(all, id, nGroups) {
    if (this.isFiltering(all)) return all.sopen?.[id] ?? true;
    return all.open?.[id] ?? nGroups <= 3;
  }

  toggleFold(all, devices, id) {
    const map = this.isFiltering(all) ? (all.sopen ||= {}) : (all.open ||= {});
    map[id] = !this.isOpen(all, id, this.allGroups(all, devices).length);
  }

  foldAll(all, devices) {
    const groups = this.visibleGroups(all, devices);
    const anyOpen = groups.some((g) => this.isOpen(all, g.id, this.allGroups(all, devices).length));
    const map = this.isFiltering(all) ? (all.sopen ||= {}) : (all.open ||= {});
    for (const g of groups) map[g.id] = !anyOpen;
  }

  visibleGroups(all, devices) {
    const q = this.allQuery(all);
    const filter = all.filter || "all";
    return this.allGroups(all, devices)
      .map((g) => ({ ...g, shown: g.rules.filter((r) => this.passes(r, g, q, filter)) }))
      .filter((g) => g.shown.length);
  }

  overviewHtml(all, devices) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    let html = `<p class="mg-note">${esc(t("mgAllIntro"))}</p>`;
    if (all.flash) html += `<div class="mg-flash" role="status">${esc(all.flash)}</div>`;
    if (all.error && !all.rules) {
      return `${html}<div class="dlg-error">${esc(t("mgLoadError", all.error))}</div><button type="button" class="qbtn" data-mga="magic-reload">${esc(t("mgRetry"))}</button>`;
    }
    if (all.err) html += `<div class="dlg-error">${esc(all.err)}</div>`;
    if (!all.rules) return `${html}<p class="mg-note">${esc(t("mgLoading"))}</p>`;
    if (!all.rules.length) return `${html}<p class="mg-empty">${esc(t("mgAllEmpty"))}</p>`;
    const q = String(all.query || "");
    const ph = t("listSearch");
    html += `<label class="list-search" data-for="magic">${this.h.mdi("search", 18)}<input type="search" data-lsearch="magic" value="${esc(q)}" placeholder="${esc(ph)}" aria-label="${esc(ph)}" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false"><span class="n"></span>${this.host._fieldClearHtml("data-mga-clear", "magic", q)}</label>`;
    const c = this.allCounts(all.rules);
    const filter = all.filter || "all";
    html += `<div class="sub-tabs mg-tabs mg-filter" role="tablist">${[["all", "mgFilterAll"], ["on", "mgFilterOn"], ["off", "mgFilterOff"], ["fired", "mgFilterFired"]]
      .map(([k, label]) => `<button type="button" role="tab" class="sub-tab two${k === filter ? " on" : ""}" data-mga="magic-filter" data-v="${k}" aria-selected="${k === filter}"><span class="tab-l">${esc(t(label))}</span> <span class="tab-s">${c[k]}</span></button>`)
      .join("")}</div>`;
    return `${html}<div data-mg-all-zone data-q="${esc(q)}">${this.overviewListHtml(all, devices)}</div>`;
  }

  // Zahl der Treffer, Alle einklappen und die Gerätekarten (der Teil, der bei der Suche neu gezeichnet wird)
  overviewListHtml(all, devices) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const groups = this.visibleGroups(all, devices);
    const nGroups = this.allGroups(all, devices).length;
    const shown = groups.reduce((n, g) => n + g.shown.length, 0);
    all.shown = { n: shown, total: all.rules.length, filtering: this.isFiltering(all) };
    if (!groups.length) return `<p class="mg-note mg-none">${esc(t("listSearchNone"))}</p>`;
    const anyOpen = groups.some((g) => this.isOpen(all, g.id, nGroups));
    let html = `<div class="mg-allcount"><span class="mg-count">${esc(t("mgAllCount", shown, groups.length))}</span><button type="button" class="linkbtn" data-mga="magic-fold-all">${esc(t(anyOpen ? "mgFoldAll" : "mgUnfoldAll"))}</button></div>`;
    for (const g of groups) {
      const open = this.isOpen(all, g.id, nGroups);
      const firing = g.shown.filter((r) => r.enabled && r.active).length;
      const offN = g.shown.filter((r) => !r.enabled).length;
      const sum = open
        ? g.sub
          ? `<small>${esc(g.sub)}</small>`
          : ""
        : `<small class="mg-dsum">${esc(t("mgSumMsgs", g.shown.length))}${offN ? ` · ${esc(t("mgSumOff", offN))}` : ""}${firing ? ` · <span class="mg-on">${esc(t("mgSumFired", firing))}</span>` : ""}${g.off ? ` · <span class="mg-warn">${esc(t("mgUnreachable"))}</span>` : ""}</small>`;
      html += `<div class="mg-dcard${open ? "" : " closed"}"><button type="button" class="mg-dhead" data-mga="magic-fold-dev" data-device="${esc(g.id)}" aria-expanded="${open}">
        <span class="mg-devic${g.off ? " off" : ""}" aria-hidden="true">${this.h.typeIcon(g.dev?.type || "other", 18)}</span>
        <span class="mg-t"><b>${esc(g.name)}</b>${sum}</span>${g.off && open ? `<span class="mg-devoff">${esc(t("statusOffline"))}</span>` : ""}<span class="mg-badge">${g.shown.length}</span>${this.chevHtml(open)}</button>`;
      if (open) {
        html += g.shown.map((r) => this.overviewCardHtml(r, all)).join("");
        html += `<div class="mg-dfoot"><button type="button" class="linkbtn" data-mga="magic-device" data-device="${esc(g.id)}">${esc(t("mgAllOpenDevice"))} ›</button><button type="button" class="linkbtn" data-proto="magic" data-device="${esc(g.id)}" data-name="${esc(g.name)}">${esc(t("prDeviceLink"))} ›</button></div>`;
      }
      html += `</div>`;
    }
    return html;
  }

  overviewCardHtml(r, all) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const confirming = all.confirmId === r.id;
    const sw = `<label class="switch"><input type="checkbox" data-mga="magic-toggle" data-id="${esc(r.id)}"${r.enabled ? " checked" : ""} aria-label="${esc(r.name)}"><span></span></label>`;
    const acts = confirming
      ? ""
      : `<div class="mg-acts"><button type="button" class="linkbtn" data-mga="magic-edit" data-device="${esc(r.device_id)}" data-id="${esc(r.id)}">${esc(t("mgActEdit"))}</button>
        <button type="button" class="linkbtn" data-proto="magic" data-id="${esc(r.id)}" data-device="${esc(r.device_id)}" data-name="${esc(r.name)}">${esc(t("prAct"))}</button>
        <button type="button" class="linkbtn danger" data-mga="magic-delete" data-id="${esc(r.id)}">${esc(t("mgActDelete"))}</button></div>`;
    const confirm = confirming
      ? `<div class="mg-confirm"><b>${esc(t("mgDeleteAsk", r.name))}</b><small>${esc(t("mgDeleteNote"))}</small>
          <div class="mg-btns small"><button type="button" class="dlg-btn" data-mga="magic-delete-no">${this.h.mdi("close", 18)}${esc(t("mgCancel"))}</button><button type="button" class="dlg-btn danger" data-mga="magic-delete-yes" data-id="${esc(r.id)}">${this.h.mdi("trash", 18)}${esc(t("mgDeleteYes"))}</button></div></div>`
      : "";
    return `<div class="mg-card${r.enabled ? "" : " off"}"><div class="mg-row"><span class="mg-ic" aria-hidden="true">${emojiFor(this.entityOf(r))}</span>
      <div class="mg-t"><b>${esc(r.name)}</b><small>${esc(this.sentence(r))}</small><small class="mg-status">${this.statusParts(r).join(" · ")}</small></div>${sw}</div>${acts}${confirm}</div>`;
  }

  // --- Assistent: Stand -------------------------------------------------------

  newDraft() {
    return {
      id: null,
      // Bedingungen (seit 2.15.0): Baum aus Bedingungen und Gruppen; die erste steht zusätzlich in entity_id, kind, value, ...
      conds: { op: "and", items: [] },
      entity_id: "",
      kind: "below",
      value: "",
      for_s: 600,
      forOwn: { text: "", unit: 60 },
      // Zurücksetzen erst nach Dauer (seit 2.17.0): neue Meldungen starten mit 1 Min. gegen Flattern um die Schwelle
      reset_for_s: 60,
      resetForOwn: { text: "", unit: 60 },
      // Eigener Rücksetzwert (seit 2.8.0); ohne: zurückgesetzt, sobald die Bedingung nicht mehr gilt
      resetOwn: false,
      reset_value: "",
      message: "",
      body: "",
      recover: false,
      recover_message: "",
      recover_body: "",
      // Von Hand geschriebene Texte werden nicht mehr durch Standardtexte ersetzt
      touched: { message: false, body: false, recover_message: false, recover_body: false },
      repeat_s: 0,
      repeatOwn: { text: "", unit: 3600 },
      target: "",
      critical: false,
      critical_volume: VOLUME_MAX,
      name: "",
      nameTouched: false,
      enabled: true,
    };
  }

  draftFrom(rule) {
    const d = this.newDraft();
    const tree = rule.conditions?.items?.length
      ? rule.conditions
      : { op: "and", items: [{ entity_id: rule.entity_id, kind: rule.kind, value: rule.value, reset_value: rule.reset_value }] };
    const leaf = (x) => ({
      uid: leafId(),
      entity_id: x.entity_id,
      kind: x.kind,
      value: x.value == null ? "" : String(x.value),
      reset_value: x.reset_value == null ? "" : String(x.reset_value),
      resetOwn: x.reset_value != null && x.reset_value !== "",
    });
    d.conds = { op: tree.op || "and", items: tree.items.map((it) => (it.items ? { uid: leafId(), op: it.op || "and", items: it.items.map(leaf) } : leaf(it))) };
    Object.assign(d, {
      id: rule.id,
      for_s: rule.for_s,
      reset_for_s: rule.reset_for_s || 0,
      message: rule.message,
      body: rule.body || "",
      recover: Boolean(rule.recover),
      recover_message: rule.recover_message || "",
      recover_body: rule.recover_body || "",
      touched: { message: true, body: true, recover_message: true, recover_body: true },
      repeat_s: rule.repeat_s || 0,
      target: rule.target || "",
      critical: Boolean(rule.critical),
      critical_volume: rule.critical_volume ?? VOLUME_MAX,
      name: rule.name,
      nameTouched: true,
      enabled: rule.enabled,
    });
    this.syncPrimary(d);
    if (!PRESET_FOR.includes(d.for_s)) d.forOwn = splitSeconds(d.for_s, FOR_UNITS);
    if (!PRESET_FOR.includes(d.reset_for_s)) d.resetForOwn = splitSeconds(d.reset_for_s, FOR_UNITS);
    if (d.repeat_s && !PRESET_REPEAT.includes(d.repeat_s)) d.repeatOwn = splitSeconds(d.repeat_s, REPEAT_UNITS);
    return d;
  }

  // Zustand eines frischen Assistenten (Meldung bearbeiten oder neu)
  makeWiz(rule = null) {
    return {
      step: 1,
      editing: Boolean(rule),
      draft: rule ? this.draftFrom(rule) : this.newDraft(),
      hist: null,
      pv: { main: null, recover: null },
      test: null,
      targetOpen: false,
      free: { open: false, query: "", results: null, loading: false, error: "" },
      error: "",
      saving: false,
      confirmClose: false,
      // Schritt 1: gerade geöffnete Bedingung (uid), Auswahl einer Entität ({group, replace}) und Verlauf der offenen Bedingung
      cur: null,
      adding: null,
      leafHist: null,
    };
  }

  startWizard(rule = null) {
    this.view = "wizard";
    this.ui.flash = "";
    this.ui.error = "";
    this.wiz = this.makeWiz(rule);
    const leaves = this.leavesOf(this.wiz.draft);
    if (leaves.length === 1) this.wiz.cur = leaves[0].uid;
    // Stand beim Öffnen: ohne Änderung schliesst das Fenster ohne Rückfrage
    this.wiz.snap = JSON.stringify(this.wiz.draft);
    this.paint();
    this.scrollTop();
    this.requestLeafHistory();
  }

  // Neue Meldung aus dem Fenster aller Meldungen (seit 2.102.0): derselbe Assistent mit einem Schritt mehr davor, der das Gerät wählt
  startNewFromAll() {
    this.reset();
    this.standalone = true;
    this.view = "wizard";
    this.wiz = { ...this.makeWiz(), pick: true, step: 0, pickId: "", devQuery: "", loadingDev: false };
    this.wiz.snap = JSON.stringify(this.wiz.draft);
    this.paint();
    this.scrollTop();
  }

  // Schritt 0 verlassen: Entitäten und Ziele des gewählten Geräts laden, dann weiter zu "Bedingungen". Ein anderes Gerät als
  // zuvor beginnt den Entwurf von vorn (die Entitäten der Bedingungen gehören zum Gerät).
  async chooseDevice() {
    const w = this.wiz;
    if (!w || !w.pick || !w.pickId || w.loadingDev) return;
    w.loadingDev = true;
    w.error = "";
    this.paint();
    try {
      if (this.deviceId !== w.pickId || !this.data) {
        const result = await this.host._hass.callWS({ type: "device_panel/magic_get", device_id: w.pickId });
        if (this.wiz !== w) return;
        this.deviceId = w.pickId;
        this.data = result;
        this.extra = {};
        w.draft = this.newDraft();
        w.free = { open: false, query: "", results: null, loading: false, error: "" };
        w.cur = null;
        w.adding = null;
        w.leafHist = null;
        w.snap = JSON.stringify(w.draft);
      }
    } catch (err) {
      if (this.wiz !== w) return;
      w.loadingDev = false;
      w.error = this.t("mgLoadError", this.h.errText(err));
      this.paint();
      return;
    }
    w.loadingDev = false;
    w.step = 1;
    this.paint();
    this.scrollTop();
    this.requestLeafHistory();
  }

  // Schritt 0: die Geräte des Panels (ohne ausgeschaltete) mit Suche
  deviceRows() {
    const q = String(this.wiz?.devQuery || "").trim().toLowerCase();
    return (this.host._devices || [])
      .filter((d) => !d.disabled)
      .map((d) => ({ id: d.id, name: d.name || d.id, sub: [d.area, d.integration?.name].filter(Boolean).join(" · "), type: d.type || "other" }))
      .filter((x) => !q || `${x.name} ${x.sub}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, this.host._locale() || undefined, { sensitivity: "base" }));
  }

  step0Html() {
    const esc = (v) => this.esc(v);
    const w = this.wiz;
    return `<p class="mg-note">${esc(this.t("mgPickDeviceNote"))}</p>
      <label class="list-search" data-for="mg-devs">${this.h.mdi("search", 18)}<input type="search" data-mg="dev-search" value="${esc(w.devQuery)}" placeholder="${esc(this.t("listSearch"))}" aria-label="${esc(this.t("listSearch"))}" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false">${this.host._fieldClearHtml("data-fc", "", w.devQuery)}</label>
      <div data-mg-zone="devs">${this.devsHtml()}</div>`;
  }

  devsHtml() {
    const esc = (v) => this.esc(v);
    const rows = this.deviceRows();
    if (!rows.length) return `<p class="mg-note mg-none">${esc(this.t("listSearchNone"))}</p>`;
    return rows
      .map((x) => {
        const on = this.wiz.pickId === x.id;
        return `<button type="button" class="mg-card mg-pick" data-mg="dev" data-id="${esc(x.id)}" role="radio" aria-checked="${on}">
        <span class="mg-row"><span class="mg-devic" aria-hidden="true">${this.h.typeIcon(x.type, 18)}</span><span class="mg-t"><b>${esc(x.name)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ""}</span><span class="mg-radio${on ? " on" : ""}"></span></span></button>`;
      })
      .join("");
  }

  closeWizard() {
    window.clearTimeout(this._histTimer);
    window.clearTimeout(this._leafTimer);
    window.clearTimeout(this._pvTimer);
    this._seq += 1;
    this._lseq = (this._lseq || 0) + 1;
    this.view = "list";
    this.wiz = null;
    this.closeWin();
    this.paint();
    if (this.standalone) {
      // Aus dem Fenster mit allen Meldungen geöffnet: kein Popup dahinter, die Übersicht neu laden
      this.reset();
      this.host._loadMagicAll?.();
      return;
    }
    this.host._renderDevice(true);
  }

  // Schliessen mit Rückfrage, wenn etwas geändert wurde
  requestClose() {
    const w = this.wiz;
    if (!w) return;
    if (w.saving) return;
    if (JSON.stringify(w.draft) !== w.snap) {
      w.confirmClose = true;
      this.paint();
    } else this.closeWizard();
  }

  scrollTop() {
    for (const el of this.qa(".mgw-body, .mgw-main, .mgw-side")) el.scrollTop = 0;
  }

  // Wert, Bedingung oder Entität haben sich geändert: Standardtexte nachführen, solange nichts von Hand geschrieben wurde.
  syncDefaults() {
    const d = this.wiz.draft;
    if (!d.touched.message) d.message = this.defaultMessage(d);
    if (!d.touched.body) d.body = this.defaultBody(d);
    if (!d.touched.recover_message) d.recover_message = this.defaultRecover(d);
    if (!d.touched.recover_body) d.recover_body = this.defaultRecoverBody();
    if (!d.nameTouched) d.name = this.suggestName(d);
  }

  setKind(kind) {
    const lf = this.curLeaf();
    if (!lf) return;
    const e = this.entity(lf.entity_id);
    // "ändert sich" ist ein Ereignis und gibt es nur als einzige Bedingung
    if (kind === "change" && this.leavesOf().length > 1) return;
    lf.kind = kind;
    if (kind === "is" && e?.kind === "state" && !lf.value) lf.value = e.options?.[0]?.value ?? "";
    if ((kind === "above" || kind === "below" || (kind === "is" && e?.kind === "number")) && parseNumber(lf.value) == null && e?.number != null) {
      lf.value = String(Math.round(e.number * 10) / 10);
    }
    if (lf.resetOwn) lf.reset_value = this.defaultReset(lf);
    this.syncPrimary();
    this.syncDefaults();
    this.paint();
    this.requestLeafHistory();
  }

  // Vorschlag für den Rücksetzwert: ein Stück auf der Seite des Normalen, bei Zuständen der andere Zustand
  defaultReset(lf) {
    const e = this.entity(lf.entity_id);
    if (lf.kind === "is" && e?.kind === "state") {
      return (e.options?.find((o) => o.value !== String(lf.value)) || e.options?.[0])?.value ?? "";
    }
    const v = parseNumber(lf.value);
    if (v == null) return "";
    const gap = Math.max(1, Math.abs(v) * 0.1);
    return String(Math.round((lf.kind === "above" ? v - gap : v + gap) * 10) / 10);
  }

  setValue(text, fromInput = false) {
    const lf = this.curLeaf();
    if (!lf) return;
    lf.value = text;
    this.syncPrimary();
    const d = this.wiz.draft;
    if (!d.nameTouched) d.name = this.suggestName(d);
    if (!fromInput) {
      const input = this.q('input[data-mg="value"]');
      if (input) input.value = text;
    }
    this.paintZones(["chart", "resethint"]);
    this.syncNav();
    this.requestLeafHistory();
  }

  stepValue(direction, field = "value") {
    const lf = this.curLeaf();
    if (!lf) return;
    const e = this.entity(lf.entity_id);
    const current = parseNumber(lf[field]) ?? e?.number ?? 0;
    // Ganze Schwelle in ganzen Schritten, mit Nachkommastellen in Zehnteln (ab 100 wieder ganz, sonst zu mühsam).
    const step = Number.isInteger(current) || Math.abs(current) >= 100 ? 1 : 0.1;
    const next = String(Math.round((current + direction * step) * 1000) / 1000);
    if (field === "reset_value") this.setReset(next);
    else this.setValue(next);
  }

  setReset(text, fromInput = false) {
    const lf = this.curLeaf();
    if (!lf) return;
    lf.reset_value = text;
    this.syncPrimary();
    if (!fromInput) {
      const input = this.q('input[data-mg="reset-value"]');
      if (input) input.value = text;
    }
    this.paintZones(["chart", "resethint"]);
    this.syncNav();
    this.requestLeafHistory();
  }

  // Fehler des eigenen Rücksetzwerts als Textschlüssel ("" = in Ordnung)
  resetError(lf = this.curLeaf()) {
    if (!lf || !lf.resetOwn || lf.kind === "change") return "";
    const e = this.entity(lf.entity_id);
    if (e?.kind === "state" || (lf.kind === "is" && e?.kind !== "number")) return String(lf.reset_value).trim() === "" ? "mgResetBadState" : "";
    const rv = parseNumber(lf.reset_value);
    if (rv == null) return "mgResetBadNumber";
    if (lf.kind === "is") return "";
    const v = parseNumber(lf.value);
    if (v == null) return "";
    if (lf.kind === "below" && rv < v) return "mgResetBad_below";
    if (lf.kind === "above" && rv > v) return "mgResetBad_above";
    return "";
  }

  setForSeconds(seconds) {
    const d = this.wiz.draft;
    d.for_s = seconds;
    d.forOwn.text = "";
    this.paint();
    this.requestHistory();
    this.requestPreview();
  }

  // Eigene Zeit tippen: gilt, sobald es eine Zahl ist und in den Rahmen passt.
  applyOwnFor() {
    const d = this.wiz.draft;
    const n = parseNumber(d.forOwn.text);
    if (n != null && n >= 0) d.for_s = Math.round(n * d.forOwn.unit);
    this.syncNav();
    this.paintZones(["chart", "forhint"]);
    this.requestHistory();
    this.requestPreview();
    this.markPresets();
  }

  // Wartezeit zum Zurücksetzen (seit 2.17.0), gleiche Bedienung wie "für mindestens"
  setResetForSeconds(seconds) {
    const d = this.wiz.draft;
    d.reset_for_s = seconds;
    d.resetForOwn.text = "";
    this.paint();
    this.requestHistory();
  }

  applyOwnResetFor() {
    const d = this.wiz.draft;
    const n = parseNumber(d.resetForOwn.text);
    if (n != null && n >= 0) d.reset_for_s = Math.round(n * d.resetForOwn.unit);
    this.syncNav();
    this.paintZones(["chart", "rforhint"]);
    this.requestHistory();
    this.markPresets();
  }

  // Die Voreinstellungen leuchten nur, wenn sie gelten und keine eigene Zeit getippt ist.
  markPresets() {
    const d = this.wiz.draft;
    for (const btn of this.qa('[data-mg="for"]')) {
      this.setOn(btn, !d.forOwn.text && Number(btn.dataset.s) === d.for_s);
    }
    for (const btn of this.qa('[data-mg="rfor"]')) {
      this.setOn(btn, !d.resetForOwn.text && Number(btn.dataset.s) === d.reset_for_s);
    }
    for (const btn of this.qa('[data-mg="repeat"]')) {
      this.setOn(btn, !d.repeatOwn.text && Number(btn.dataset.s) === d.repeat_s);
    }
  }

  // Wahl in einer Reiterleiste ändern; die Kapsel folgt der Klasse "on" (Beobachter im Panel).
  setOn(btn, on) {
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-checked", String(on));
  }

  setRepeatSeconds(seconds) {
    const d = this.wiz.draft;
    d.repeat_s = seconds;
    d.repeatOwn.text = "";
    this.paint();
  }

  applyOwnRepeat() {
    const d = this.wiz.draft;
    const n = parseNumber(d.repeatOwn.text);
    if (n != null && n > 0) d.repeat_s = Math.round(n * d.repeatOwn.unit);
    else if (d.repeatOwn.text === "") d.repeat_s = 0;
    this.syncNav();
    this.markPresets();
  }

  // Gültigkeit je Schritt (der Server prüft zusätzlich beim Speichern).
  forError() {
    const d = this.wiz.draft;
    const own = parseNumber(d.forOwn.text);
    if (d.forOwn.text && own == null) return true;
    return d.for_s > this.limit("for", 604800);
  }

  resetForError() {
    const d = this.wiz.draft;
    if (d.kind === "change") return false;
    if (d.resetForOwn.text && parseNumber(d.resetForOwn.text) == null) return true;
    return d.reset_for_s > this.limit("for", 604800);
  }

  repeatError() {
    const d = this.wiz.draft;
    if (d.repeatOwn.text && parseNumber(d.repeatOwn.text) == null) return true;
    return d.repeat_s > this.limit("repeat", 2592000);
  }

  canNext(step = this.wiz.step) {
    const d = this.wiz.draft;
    if (step === 0) return Boolean(this.wiz.pickId) && !this.wiz.loadingDev;
    if (step === 1) {
      const leaves = this.leavesOf();
      return leaves.length > 0 && !this.wiz.adding && leaves.every((l) => this.leafValid(l));
    }
    if (step === 2) return !this.forError() && !this.resetForError();
    if (step === 3) return !this.repeatError();
    if (step === 4) return d.message.trim() !== "" && (!d.recover || d.kind === "change" || d.recover_message.trim() !== "");
    return d.name.trim() !== "";
  }

  syncNav() {
    if (!this.win() || !this.wiz) return;
    const ok = this.canNext();
    for (const btn of this.qa('[data-mg="next"], [data-mg="save"]')) btn.disabled = !ok || this.wiz.saving;
  }

  goto(step) {
    const w = this.wiz;
    if (step < (w.pick ? 0 : 1) || step > STEPS || step === w.step) return;
    // Vorwärts nur, wenn die Schritte davor vollständig sind.
    for (let s = w.step; s < step; s += 1) if (!this.canNext(s)) return;
    w.step = step;
    w.error = "";
    if (step === 5 && !w.draft.nameTouched) w.draft.name = this.suggestName(w.draft);
    if (step >= 3) this.syncDefaults();
    this.paint();
    this.scrollTop();
    if (step === 1) this.requestLeafHistory();
    if (step === 2) this.requestHistory();
    if (step >= 4) this.requestPreview();
  }

  // --- Assistent: Rückblick und Vorschau ----------------------------------------

  requestHistory() {
    const w = this.wiz;
    if (!w || w.step !== 2) return;
    window.clearTimeout(this._histTimer);
    const leaves = this.leavesOf();
    if (!leaves.length || !leaves.every((l) => this.leafValid(l)) || this.forError() || this.resetForError()) {
      w.hist = null;
      this.paintZones(["chart", "hist"]);
      return;
    }
    w.hist = { loading: true, prev: w.hist && !w.hist.loading ? w.hist : w.hist?.prev || null };
    this.paintZones(["hist"]);
    this._histTimer = window.setTimeout(() => this.fetchHistory(), HIST_DELAY_MS);
  }

  // Verlauf der offenen Bedingung für das Diagramm in Schritt 1 (ohne Dauer: jeder Abschnitt zählt)
  requestLeafHistory() {
    const w = this.wiz;
    if (!w || w.step !== 1) return;
    window.clearTimeout(this._leafTimer);
    const lf = this.curLeaf();
    if (!lf || !this.leafValid(lf)) {
      w.leafHist = null;
      this.paintZones(["chart"]);
      return;
    }
    w.leafHist = { loading: true, prev: w.leafHist && !w.leafHist.loading ? w.leafHist : w.leafHist?.prev || null };
    this._leafTimer = window.setTimeout(() => this.fetchLeafHistory(lf.uid), HIST_DELAY_MS);
  }

  async fetchLeafHistory(uid) {
    const w = this.wiz;
    const lf = this.findLeaf(uid);
    if (!w || !lf) return;
    const seq = (this._lseq = (this._lseq || 0) + 1);
    const one = this.leafPayload(lf);
    const msg = { type: "device_panel/magic_history", entity_id: one.entity_id, kind: one.kind, for_s: 0 };
    if (one.value != null) msg.value = one.value;
    if (one.reset_value != null) msg.reset_value = one.reset_value;
    try {
      const result = await this.call(msg);
      if (seq !== this._lseq || this.wiz !== w) return;
      w.leafHist = result;
    } catch (err) {
      if (seq !== this._lseq || this.wiz !== w) return;
      w.leafHist = { failed: true };
    }
    this.paintZones(["chart"]);
  }

  async fetchHistory() {
    const w = this.wiz;
    if (!w) return;
    const d = w.draft;
    const seq = (this._seq += 1);
    const first = this.leafPayload(this.leavesOf()[0]);
    const msg = { type: "device_panel/magic_history", entity_id: first.entity_id, kind: first.kind, for_s: d.for_s };
    if (first.kind !== "change" && d.reset_for_s > 0) msg.reset_for_s = d.reset_for_s;
    if (first.value != null) msg.value = first.value;
    if (first.reset_value != null) msg.reset_value = first.reset_value;
    // Mehrere Bedingungen: der Rückblick rechnet über alle (seit 2.15.0)
    if (this.leavesOf().length > 1) msg.conditions = this.treePayload();
    try {
      const result = await this.call(msg);
      if (seq !== this._seq || this.wiz !== w) return;
      w.hist = result;
    } catch (err) {
      if (seq !== this._seq || this.wiz !== w) return;
      w.hist = { failed: true };
    }
    this.paintZones(["chart", "hist"]);
  }

  requestPreview() {
    const w = this.wiz;
    if (!w || w.step < 4) return;
    window.clearTimeout(this._pvTimer);
    this._pvTimer = window.setTimeout(() => this.fetchPreview(), PREVIEW_DELAY_MS);
  }

  async fetchPreview() {
    const w = this.wiz;
    if (!w) return;
    const rule = this.draftPayload();
    const one = async (which) => {
      try {
        const r = await this.call({ type: "device_panel/magic_preview", rule, which });
        return { title: r.title, message: r.message };
      } catch (err) {
        return { error: this.h.errText(err) };
      }
    };
    const seq = (this._pvSeq = (this._pvSeq || 0) + 1);
    const [main, recover] = await Promise.all([one("main"), w.draft.recover && w.draft.kind !== "change" ? one("recover") : Promise.resolve(null)]);
    if (seq !== this._pvSeq || this.wiz !== w) return;
    w.pv = { main, recover };
    this.paintZones(["pv", "pvr"]);
  }

  async sendTest(which) {
    const w = this.wiz;
    if (!w || w.test?.busy) return;
    w.test = { which, busy: true };
    this.paintZones(["pv", "pvr"]);
    try {
      const r = await this.call({ type: "device_panel/magic_test", rule: this.draftPayload(), which });
      const to = w.draft.target || this.data.default_target;
      w.test = { which, text: r.sent ? this.t("mgTestSent", this.targetLabel(to === "none" ? "" : to)) : this.t("mgTestFail"), failed: !r.sent };
    } catch (err) {
      w.test = { which, text: this.t("mgTestError", this.h.errText(err)), failed: true };
    }
    if (this.wiz === w) this.paintZones(["pv", "pvr"]);
  }

  // --- Assistent: Aktionen ----------------------------------------------------

  async save() {
    const w = this.wiz;
    if (!w || w.saving || !this.canNext(5)) return;
    w.saving = true;
    w.error = "";
    this.syncNav();
    try {
      const r = await this.call({ type: "device_panel/magic_save", rule: this.draftPayload() });
      const i = this.data.rules.findIndex((x) => x.id === r.rule.id);
      if (i >= 0) this.data.rules[i] = r.rule;
      else this.data.rules.push(r.rule);
      this.sortRules();
      this.ui.flash = this.t("mgSaved");
      this.closeWizard();
    } catch (err) {
      w.saving = false;
      w.error = this.t("mgSaveError", this.h.errText(err));
      this.paint();
    }
  }

  sortRules() {
    this.data.rules.sort((a, b) => a.name.localeCompare(b.name, this.host._locale() || undefined, { sensitivity: "base" }));
  }

  async toggle(id, enabled) {
    this.ui.error = "";
    try {
      const r = await this.call({ type: "device_panel/magic_enable", rule_id: id, enabled });
      this.replaceRule(r.rule);
    } catch (err) {
      this.ui.error = this.t("mgListError", this.h.errText(err));
    }
    this.paint();
    this.host._renderDevice(true);
  }

  replaceRule(rule) {
    const i = this.data.rules.findIndex((x) => x.id === rule.id);
    if (i >= 0) this.data.rules[i] = rule;
  }

  async renameSave() {
    const id = this.ui.renameId;
    const name = this.ui.renameValue.trim();
    const rule = this.data.rules.find((r) => r.id === id);
    if (!rule) return;
    if (!name) {
      this.ui.error = this.t("mgListError", this.t("mgRenameLabel"));
      this.paint();
      return;
    }
    if (name === rule.name) {
      this.ui.renameId = null;
      this.paint();
      return;
    }
    this.ui.error = "";
    try {
      const r = await this.call({ type: "device_panel/magic_save", rule: { ...this.payload(rule), name } });
      this.replaceRule(r.rule);
      this.sortRules();
      this.ui.renameId = null;
      this.ui.flash = this.t("mgSaved");
    } catch (err) {
      this.ui.error = this.t("mgListError", this.h.errText(err));
    }
    this.paint();
  }

  async remove(id) {
    this.ui.error = "";
    try {
      await this.call({ type: "device_panel/magic_delete", rule_id: id });
      this.data.rules = this.data.rules.filter((r) => r.id !== id);
      this.ui.confirmId = null;
      this.ui.flash = this.t("mgDeleted");
    } catch (err) {
      this.ui.error = this.t("mgListError", this.h.errText(err));
    }
    this.paint();
    this.host._renderDevice(true);
  }

  // --- Assistent: Anzeige -----------------------------------------------------

  wizardHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const w = this.wiz;
    const step = w.step;
    const e = this.entity(w.draft.entity_id);
    // Aus der Übersicht kommt der Schritt "Gerät" davor (Schritt 0): die Zählung zeigt ihn als ersten von sechs
    const off = w.pick ? 1 : 0;
    const total = STEPS + off;
    const bars = Array.from({ length: total }, (_, i) => {
      const n = i + 1 - off;
      const on = n <= step ? " on" : "";
      const open = w.editing || n < step;
      return open
        ? `<button type="button" class="mg-stp${on}" data-mg="goto" data-step="${n}" aria-label="${esc(`${t("mgStepOf", n + off, total)}: ${t(`mgStepName_${n}`)}`)}"></button>`
        : `<span class="mg-stp${on}"></span>`;
    }).join("");
    const where = step <= 1 || !this.leavesOf().length ? t(`mgStepName_${step}`) : `${e ? `${emojiFor(e)} ${e.name}${this.leavesOf().length > 1 ? " +" : ""} · ` : ""}${t(`mgStepName_${step}`)}`;
    let body = "";
    if (step === 0) body = this.step0Html();
    else if (step === 1) body = this.step1Html();
    else if (step === 2) body = this.step2Html();
    else if (step === 3) body = this.step3Html();
    else if (step === 4) body = this.step4Html();
    else body = this.step5Html();
    const last = step === STEPS;
    // "Abbrechen" statt "Zurück" im ersten Schritt (mit Gerätewahl ist das Schritt 0) und beim Hinzufügen einer weiteren Bedingung
    const cancels = w.pick ? step === 0 || (step === 1 && Boolean(w.adding) && this.leavesOf().length > 0) : step === 1;
    const nav = `<div class="mg-btns"><button type="button" class="dlg-btn" data-mg="${cancels ? "cancel" : "back"}">${this.h.mdi(cancels ? "close" : "arrowLeft", 18)}${esc(cancels ? t("mgCancel") : t("mgBack"))}</button>
      ${last ? `<button type="button" class="dlg-btn primary" data-mg="save"${this.canNext() && !w.saving ? "" : " disabled"}>${this.h.mdi("save", 18)}${esc(t("mgSave"))}</button>` : `<button type="button" class="dlg-btn primary" data-mg="next"${this.canNext() ? "" : " disabled"}>${esc(t("mgNext"))}${this.h.mdi("arrowRight", 18)}</button>`}</div>`;
    // Rückfrage beim Schliessen als Pop-up in der Mitte des Fensters (seit 2.16.0); der Rest dahinter ist gesperrt (inert)
    const lock = w.confirmClose ? " inert" : "";
    const discard = w.confirmClose
      ? `<div class="mgw-ov"><div class="mgw-discard" role="alertdialog" aria-modal="true" aria-label="${esc(t("mgDiscardTitle"))}"><b>${esc(t("mgDiscardTitle"))}</b><small>${esc(t("mgDiscardNote"))}</small>
      <div class="mg-btns"><button type="button" class="dlg-btn" data-mg="discard-no">${this.h.mdi("pencil", 18)}${esc(t("mgDiscardNo"))}</button><button type="button" class="dlg-btn danger" data-mg="discard-yes">${this.h.mdi("trash", 18)}${esc(t("mgDiscardYes"))}</button></div></div></div>`
      : "";
    const device = this.host._devices?.find((d) => d.id === this.deviceId)?.name || "";
    return `<div class="mgw-head"${lock}><div class="mgw-t"><b>${esc(w.editing ? t("mgEditing") : t("mgNew"))}</b>${device ? `<small>${esc(device)}</small>` : ""}</div>
        <button type="button" class="dlg-close" data-mg="close" title="${esc(t("close"))}" aria-label="${esc(t("close"))}">${this.h.mdi("close", 18)}</button></div>
      <div class="mgw-prog"${lock}><div class="mg-stephead"><span>${esc(t("mgStepOf", step + off, total))}</span><span>${esc(where)}</span></div>
        <div class="mg-steps">${bars}</div></div>
      <div class="mgw-body"${lock}><div class="mgw-main"><div class="mg-big">${esc(t(step === 1 && !w.adding && this.leavesOf().length ? "mgQ_1b" : `mgQ_${step}`))}</div>
        ${body}
        ${w.error ? `<div class="dlg-error" role="alert">${esc(w.error)}</div>` : ""}</div></div>
      <div class="mgw-foot"${lock}>${nav}</div>${discard}`;
  }

  // Schritt 1 (seit 2.15.0): alle Bedingungen an einem Ort. Ohne Bedingung (und beim Hinzufügen) die Auswahl der Entität
  // wie bisher, sonst die Liste mit Und/Oder, Gruppen und der geöffneten Bedingung.
  step1Html() {
    return this.wiz.adding || !this.leavesOf().length ? this.pickerHtml() : this.condListHtml();
  }

  pickerHtml() {
    const esc = (v) => this.esc(v);
    const w = this.wiz;
    const entities = this.data?.entities || [];
    const picked = w.adding?.replace ? this.findLeaf(w.adding.replace)?.entity_id || "" : "";
    let html = `<p class="mg-note">${esc(this.t(this.leavesOf().length ? "mgAddIntro" : "mgFirstIntro"))}</p>`;
    html += entities.length
      ? entities.map((e) => this.pickCardHtml(e, e.entity_id === picked, this.tt(`mgCat_${e.category}`))).join("")
      : `<p class="mg-note">${esc(this.t("mgNoEntities"))}</p>`;
    // Ganz unten: freie Entität (seit 2.10.0), jede Entität von Home Assistant; die Meldung bleibt an dieses Gerät gebunden
    const free = picked && this.isFree(picked) ? this.entity(picked) : null;
    html += `<div class="mg-k mg-freehead">${esc(this.t("mgFreeLabel"))}</div>`;
    if (free) html += this.pickCardHtml(free, true, this.t("mgFreeBadge"), free.entity_id);
    const open = w.free.open;
    html += `<button type="button" class="mg-card mg-pick mg-freebtn" data-mg="free-open" aria-expanded="${open}"><span class="mg-row"><span class="mg-ic" aria-hidden="true">🔎</span>
      <span class="mg-t"><b>${esc(free ? this.t("mgFreeChange") : this.t("mgFreeOpen"))}</b><small>${esc(this.t("mgFreeSub"))}</small></span>${this.chevHtml(open)}</span></button>`;
    if (open) {
      html += `<div class="mg-free"><label class="list-search">${this.h.mdi("search", 18)}<input type="search" data-mg="free-query" value="${esc(w.free.query)}" placeholder="${esc(this.t("mgFreeSearch"))}" aria-label="${esc(this.t("mgFreeSearch"))}" autocomplete="off">${this.host._fieldClearHtml("data-fc", "", w.free.query)}</label>
        <div data-mg-zone="freelist">${this.freeListHtml()}</div></div>`;
    }
    return html;
  }

  // Liste der Bedingungen: Und/Oder und Satz (ab zwei Bedingungen), Karten und Gruppen, Knöpfe zum Hinzufügen
  condListHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    const leaves = this.leavesOf();
    const sole = leaves.length === 1;
    let html = "";
    if (!sole) {
      html += this.tabsHtml([
        { on: d.conds.op === "and", attrs: 'data-mg="op" data-v="and"', label: t("mgOpAnd") },
        { on: d.conds.op === "or", attrs: 'data-mg="op" data-v="or"', label: t("mgOpOr") },
      ]);
      html += `<div class="mg-sumline"><b>${esc(t("mgWhenPrefix"))}</b> ${esc(this.treeText(d.conds, (id) => this.entity(id)))}</div>`;
    }
    d.conds.items.forEach((item, i) => {
      if (i > 0) html += `<div class="mg-join">${esc(t(d.conds.op === "or" ? "mgOrWord" : "mgAndWord"))}</div>`;
      html += item.items ? this.groupHtml(item) : this.leafHtml(item);
    });
    const groups = d.conds.items.filter((i) => i.items).length;
    if (sole && leaves[0].kind === "change") return html;
    if (leaves.length >= this.limit("leaves", 10)) return `${html}<p class="mg-hint mg-limit">${esc(t("mgLimitConds", this.limit("leaves", 10)))}</p>`;
    html += `<div class="mg-adds"><button type="button" class="mg-add" data-mg="add-cond">${this.h.mdi("plus", 18)}${esc(t("mgAddCond"))}</button>`;
    if (groups < this.limit("groups", 4)) html += `<button type="button" class="mg-add" data-mg="add-group">${this.h.mdi("plus", 18)}${esc(t("mgAddGroup"))}</button>`;
    return `${html}</div>`;
  }

  groupHtml(g) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const tabs = this.tabsHtml(
      [
        { on: g.op === "and", attrs: `data-mg="gop" data-group="${esc(g.uid)}" data-v="and"`, label: t("mgGroupAll") },
        { on: g.op === "or", attrs: `data-mg="gop" data-group="${esc(g.uid)}" data-v="or"`, label: t("mgGroupAny") },
      ],
      "mg-mini"
    );
    const inner = g.items.map((lf, i) => `${i ? `<div class="mg-join">${esc(t(g.op === "or" ? "mgOrWord" : "mgAndWord"))}</div>` : ""}${this.leafHtml(lf)}`).join("");
    const full = this.leavesOf().length >= this.limit("leaves", 10);
    return `<div class="mg-group"><div class="mg-ghead"><b>${esc(t("mgGroup"))}</b>${tabs}
      <button type="button" class="mg-xbtn" data-mg="group-del" data-uid="${esc(g.uid)}" title="${esc(t("mgRemoveGroup"))}" aria-label="${esc(t("mgRemoveGroup"))}">${this.h.mdi("close", 22)}</button></div>
      ${inner}${full ? "" : `<button type="button" class="linkbtn mg-addin" data-mg="add-in" data-uid="${esc(g.uid)}">${esc(t("mgAddInGroup"))}</button>`}</div>`;
  }

  // Eine Bedingung: Kopf (Name, Satz, jetziger Wert) und, wenn offen, der Editor
  // Pfeil zum Auf- und Zuklappen, überall gleich (Bedingungen, Empfänger, freie Entität, Geräte-Karten): nach unten, offen nach oben
  chevHtml(open) {
    return `<span class="mg-lchev${open ? " up" : ""}" aria-hidden="true">${this.h.mdi("chevronDown", 24)}</span>`;
  }

  leafHtml(lf) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const e = this.entity(lf.entity_id);
    const open = this.wiz.cur === lf.uid;
    const now = e ? this.entityValue(e) : "";
    const sub = [this.leafValid(lf) || lf.kind === "change" ? this.condText(lf, e) : t("mgCondIncomplete"), now ? t("mgNowValue", now) : ""].filter(Boolean).join(" · ");
    return `<div class="mg-lcard${open ? " open" : ""}"><div class="mg-lhead">
      <button type="button" class="mg-lmain" data-mg="leaf-open" data-uid="${esc(lf.uid)}" aria-expanded="${open}"><span class="mg-ic" aria-hidden="true">${emojiFor(e)}</span>
        <span class="mg-t"><b>${esc(e?.name || lf.entity_id)}</b><small>${esc(sub)}</small></span>${this.chevHtml(open)}</button>
      <button type="button" class="mg-xbtn" data-mg="leaf-del" data-uid="${esc(lf.uid)}" title="${esc(t("mgRemoveCond"))}" aria-label="${esc(t("mgRemoveCond"))}">${this.h.mdi("close", 22)}</button></div>
      ${open ? this.leafEditorHtml(lf, e) : ""}</div>`;
  }

  // Editor der offenen Bedingung: Art, Diagramm, Wert, Zurücksetzen (bisher "Wann")
  leafEditorHtml(lf, e) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    if (!e) return "";
    const sole = this.leavesOf().length === 1;
    let kinds = e.kind === "number" ? [["above", "mgKindAbove"], ["below", "mgKindBelow"], ["is", "mgKindIs"]] : [["is", "mgKindIsState"]];
    if (sole) kinds = [...kinds, ["change", "mgKindChange"]];
    let html = `<div class="mg-ledit">${this.tabsHtml(kinds.map(([k, label]) => ({ on: lf.kind === k, attrs: `data-mg="kind" data-kind="${k}"`, label: t(label) })))}`;
    html += `<div data-mg-zone="chart">${this.chartHtml(this.wiz.leafHist, lf)}</div>`;
    if (lf.kind === "above" || lf.kind === "below" || (lf.kind === "is" && e.kind === "number")) {
      html += `<div class="mg-k">${esc(t("mgThreshold"))}${e.unit ? ` <span class="mg-unit">· ${esc(t("mgThresholdUnit", e.unit))}</span>` : ""}</div>
        <div class="sub-tabs mg-tabs mg-stepper"><button type="button" class="sub-tab" data-mg="step" data-dir="-1" aria-label="${esc(t("mgMinus"))}">−</button>
        <input class="mg-valin" type="text" inputmode="decimal" data-mg="value" value="${esc(lf.value)}" aria-label="${esc(t("mgThreshold"))}" autocomplete="off">
        <button type="button" class="sub-tab" data-mg="step" data-dir="1" aria-label="${esc(t("mgPlus"))}">+</button></div>`;
    } else if (lf.kind === "is") {
      if (e.options?.length) {
        html += `<div class="mg-k">${esc(t("mgPickState"))}</div>${this.tabsHtml(e.options.map((o) => ({ on: String(lf.value) === o.value, attrs: `data-mg="state" data-v="${esc(o.value)}"`, label: o.label })))}`;
      } else {
        html += `<div class="mg-k">${esc(t("mgStateFree"))}</div><input class="mg-input" type="text" data-mg="value" value="${esc(lf.value)}" autocomplete="off">`;
      }
    }
    html += this.resetHtml(lf);
    html += `<button type="button" class="linkbtn mg-chgent" data-mg="leaf-entity" data-uid="${esc(lf.uid)}">${esc(t("mgChangeEntity"))}</button></div>`;
    return html;
  }

  pickCardHtml(e, sel, note, sub = "") {
    const esc = (v) => this.esc(v);
    return `<button type="button" class="mg-card mg-pick${sel ? " sel" : ""}" data-mg="pick" data-id="${esc(e.entity_id)}" role="radio" aria-checked="${sel}">
      <span class="mg-row"><span class="mg-ic" aria-hidden="true">${emojiFor(e)}</span><span class="mg-t"><b>${esc(e.name)}</b>${note || sub ? `<small>${esc([note, sub].filter(Boolean).join(" · "))}</small>` : ""}</span>
      <span class="mg-val${e.available ? "" : " off"}">${esc(this.entityValue(e))}</span><span class="mg-radio${sel ? " on" : ""}"></span></span></button>`;
  }

  // Treffer der Suche: Name, darunter Entitäts-ID und Gerät, rechts der Wert
  freeListHtml() {
    const esc = (v) => this.esc(v);
    const f = this.wiz.free;
    if (f.error) return `<div class="opt-error">${esc(this.t("mgFreeError", f.error))}</div>`;
    if (f.loading && !f.results) return `<p class="mg-hint">${esc(this.t("mgFreeLoading"))}</p>`;
    if (!f.results?.length) return `<p class="mg-hint">${esc(this.t("mgFreeNone"))}</p>`;
    return `<div class="mg-list" role="listbox">${f.results
      .map(
        (e) => `<button type="button" class="mg-opt-row" role="option" data-mg="free-pick" data-id="${esc(e.entity_id)}"><span><b>${emojiFor(e)} ${esc(e.name)}</b><br><small>${esc([e.entity_id, e.device_name].filter(Boolean).join(" · "))}</small></span><span class="mg-freeval">${esc(this.entityValue(e))}</span></button>`
      )
      .join("")}</div>`;
  }

  searchFree(query) {
    const w = this.wiz;
    if (!w) return;
    window.clearTimeout(this._freeTimer);
    w.free.loading = true;
    this._freeTimer = window.setTimeout(async () => {
      const seq = (this._freeSeq = (this._freeSeq || 0) + 1);
      try {
        const r = await this.call({ type: "device_panel/magic_entity_search", query });
        if (seq !== this._freeSeq || this.wiz !== w) return;
        w.free.results = r.entities;
        w.free.error = "";
      } catch (err) {
        if (seq !== this._freeSeq || this.wiz !== w) return;
        w.free.error = this.h.errText(err);
      }
      w.free.loading = false;
      const zone = this.q('[data-mg-zone="freelist"]');
      if (zone) zone.innerHTML = this.freeListHtml();
    }, query ? 250 : 0);
  }

  // Bedingung (Zahl: über, unter, ist gleich, ändert sich; Zustand: ist, ändert sich), Wert, Dauer.
  // Schritt 2 (seit 2.15.0): wie lange die Bedingung gelten muss, und der Rückblick (je Bedingung und zusammen)
  step2Html() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    if (!this.leavesOf().length) return "";
    return `<div class="mg-k">${esc(d.kind === "change" ? t("mgForChange") : t("mgFor"))}</div>
      ${this.tabsHtml(PRESET_FOR.map((s) => ({ on: !d.forOwn.text && d.for_s === s, attrs: `data-mg="for" data-s="${s}"`, label: this.fmtDur(s) })))}
      <div class="mg-own"><span>${esc(t("mgOwnTime"))}</span>
        <input class="mg-pill num mg-ownin" type="text" inputmode="decimal" data-mg="for-own" value="${esc(d.forOwn.text)}" placeholder="${esc(t("mgOwnPh"))}" aria-label="${esc(t("mgOwnTime"))}" autocomplete="off">
        <select class="mg-pill" data-mg="for-unit" aria-label="${esc(t("mgOwnTime"))}">${FOR_UNITS.map((u) => `<option value="${u}"${u === d.forOwn.unit ? " selected" : ""}>${esc(t(`mgUnit_${u}`))}</option>`).join("")}</select></div>
      <div data-mg-zone="forhint">${this.forHintHtml()}</div>
      ${d.kind === "change" ? "" : this.resetForHtml()}
      <div data-mg-zone="chart">${this.reviewChartHtml()}</div>
      <div data-mg-zone="hist">${this.histHtml()}</div>`;
  }

  // Rückblick-Grafik: bei einer Bedingung das Diagramm mit Schwelle, bei mehreren eine Zeile je Bedingung und "Zusammen"
  reviewChartHtml() {
    const leaves = this.leavesOf();
    return leaves.length > 1 ? this.timelinesHtml() : this.chartHtml(this.wiz.hist, leaves[0]);
  }

  timelinesHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const w = this.wiz;
    const hist = w.hist && !w.hist.loading ? w.hist : w.hist?.prev || null;
    if (!hist || hist.failed || !hist.available || hist.empty || !hist.leaves) return "";
    const from = hist.start;
    const span = hist.end - from || 1;
    const pct = (ts) => Math.max(0, Math.min(100, ((ts - from) / span) * 100));
    const bars = (list, cls = "") =>
      list.map(([a, b, counts]) => `<i class="${cls}${counts === false ? " dim" : ""}" style="left:${pct(a).toFixed(2)}%;width:${Math.max(0.8, pct(b ?? hist.end) - pct(a)).toFixed(2)}%"></i>`).join("");
    const leaves = this.leavesOf();
    const rows = hist.leaves
      .map((row, i) => {
        const lf = leaves[i];
        const e = lf ? this.entity(lf.entity_id) : null;
        const label = lf ? `${emojiFor(e)} ${e?.name || lf.entity_id} ${this.condText(lf, e)}` : row.entity_id;
        return `<div class="mg-tlr"><span>${esc(label)}</span><div class="mg-tl">${bars(row.intervals)}</div></div>`;
      })
      .join("");
    const together = `<div class="mg-tlr tot"><span><b>${esc(t("mgTogether"))}</b></span><div class="mg-tl">${bars(hist.intervals || [], "all")}</div></div>`;
    return `<div class="mg-card mg-tls">${rows}${together}<div class="mg-scale"><span>${esc(t("mgChart24"))}</span><span>${esc(t("mgChartNow"))}</span></div></div>`;
  }

  // Zurücksetzen (seit 2.8.0): automatisch, sobald die Bedingung nicht mehr gilt, oder erst am eigenen Wert
  // Zurücksetzen (seit 2.8.0, seit 2.15.0 je Bedingung): automatisch, sobald die Bedingung nicht mehr gilt, oder erst am eigenen Wert
  resetHtml(lf) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const e = this.entity(lf.entity_id);
    if (!e || lf.kind === "change") return "";
    let html = `<div class="mg-k">${esc(t("mgResetLabel"))}</div>${this.tabsHtml([
      { on: !lf.resetOwn, attrs: 'data-mg="reset-mode" data-own="0"', label: t("mgResetAuto") },
      { on: lf.resetOwn, attrs: 'data-mg="reset-mode" data-own="1"', label: t("mgResetOwn") },
    ])}`;
    if (lf.resetOwn) {
      if (lf.kind === "is" && e.kind === "state") {
        html += e.options?.length
          ? this.tabsHtml(e.options.map((o) => ({ on: String(lf.reset_value) === o.value, attrs: `data-mg="reset-state" data-v="${esc(o.value)}"`, label: o.label })))
          : `<input class="mg-input" type="text" data-mg="reset-value" value="${esc(lf.reset_value)}" aria-label="${esc(t("mgResetValue"))}" autocomplete="off">`;
      } else {
        html += `<div class="mg-k">${esc(t("mgResetValue"))}${e.unit ? ` <span class="mg-unit">· ${esc(t("mgThresholdUnit", e.unit))}</span>` : ""}</div>
          <div class="sub-tabs mg-tabs mg-stepper"><button type="button" class="sub-tab" data-mg="reset-step" data-dir="-1" aria-label="${esc(t("mgMinus"))}">−</button>
          <input class="mg-valin" type="text" inputmode="decimal" data-mg="reset-value" value="${esc(lf.reset_value)}" aria-label="${esc(t("mgResetValue"))}" autocomplete="off">
          <button type="button" class="sub-tab" data-mg="reset-step" data-dir="1" aria-label="${esc(t("mgPlus"))}">+</button></div>`;
      }
    }
    return `${html}<div data-mg-zone="resethint">${this.resetHintHtml(lf)}</div>`;
  }

  resetHintHtml(lf = this.curLeaf()) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const e = lf ? this.entity(lf.entity_id) : null;
    if (!e || lf.kind === "change") return "";
    if (!lf.resetOwn) return `<p class="mg-hint">${esc(t("mgResetHintAuto"))}</p>`;
    const unit = e.kind === "number" && e.unit ? ` ${e.unit}` : "";
    // Die Fehlermeldung nennt die Bedingung mit der Schwelle, damit klar ist, warum der Wert nicht passt
    const bad = this.resetError(lf);
    if (bad) return `<div class="opt-error">${esc(t(bad, this.fmtNum(parseNumber(lf.value) ?? 0) + unit))}</div>`;
    if (lf.kind === "is") {
      const word = e.options?.find((o) => o.value === String(lf.reset_value))?.label ?? String(lf.reset_value);
      return `<p class="mg-hint">${esc(t("mgResetHint_is", word))}</p>`;
    }
    const thr = this.fmtNum(parseNumber(lf.value) ?? 0) + unit;
    const rv = this.fmtNum(parseNumber(lf.reset_value) ?? 0) + unit;
    return `<p class="mg-hint">${esc(t(lf.kind === "above" ? "mgResetHint_above" : "mgResetHint_below", thr, rv))}</p>`;
  }

  // Auswahlgruppe als Reiterleiste: dieselben Klassen wie die Reiter oben (.sub-tabs/.sub-tab), damit die Kapsel (.seg-pill)
  // gleitet und alles gleich aussieht (Wunsch des Nutzers, docs/DESIGN.md "Auswahlknöpfe").
  tabsHtml(items, cls = "") {
    const esc = (v) => this.esc(v);
    return `<div class="sub-tabs mg-tabs${cls ? ` ${cls}` : ""}" role="radiogroup">${items
      .map((i) => `<button type="button" role="radio" class="sub-tab${i.on ? " on" : ""}" aria-checked="${Boolean(i.on)}" ${i.attrs}>${esc(i.label)}</button>`)
      .join("")}</div>`;
  }

  // Zurücksetzen erst nach Dauer (seit 2.17.0): "wieder normal" und eine neue Meldung erst, wenn es so lange nicht mehr gilt
  resetForHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    return `<div class="mg-rfor"><div class="mg-k">${esc(t("mgResetFor"))}</div>
      ${this.tabsHtml(PRESET_FOR.map((s) => ({ on: !d.resetForOwn.text && d.reset_for_s === s, attrs: `data-mg="rfor" data-s="${s}"`, label: this.fmtDur(s) })))}
      <div class="mg-own"><span>${esc(t("mgOwnTime"))}</span>
        <input class="mg-pill num mg-ownin" type="text" inputmode="decimal" data-mg="rfor-own" value="${esc(d.resetForOwn.text)}" placeholder="${esc(t("mgOwnPh"))}" aria-label="${esc(t("mgOwnTime"))}" autocomplete="off">
        <select class="mg-pill" data-mg="rfor-unit" aria-label="${esc(t("mgOwnTime"))}">${FOR_UNITS.map((u) => `<option value="${u}"${u === d.resetForOwn.unit ? " selected" : ""}>${esc(t(`mgUnit_${u}`))}</option>`).join("")}</select></div>
      <div data-mg-zone="rforhint">${this.resetForHintHtml()}</div></div>`;
  }

  resetForHintHtml() {
    if (this.resetForError()) return `<div class="opt-error">${this.esc(this.t("mgTooLong", this.fmtDur(this.limit("for", 604800))))}</div>`;
    const s = this.wiz.draft.reset_for_s;
    return `<div class="mg-note">${this.esc(s > 0 ? this.t("mgResetForHint", this.fmtDur(s)) : this.t("mgResetForHintNow"))}</div>`;
  }

  forHintHtml() {
    return this.forError() ? `<div class="opt-error">${this.esc(this.t("mgTooLong", this.fmtDur(this.limit("for", 604800))))}</div>` : "";
  }

  // Variablen passen zur Art der Entität (Zahl, Zustand) bzw. zur Änderung.
  varGroup() {
    const d = this.wiz.draft;
    const e = this.entity(d.entity_id);
    if (d.kind === "change") return "change";
    return e?.kind === "number" ? "number" : "state";
  }

  chipsHtml(group) {
    const esc = (v) => this.esc(v);
    const vars = this.data.variables;
    const names = [...(vars[this.varGroup()] || []), ...vars.common];
    return `<div class="mg-chips">${names
      .map((n) => `<button type="button" class="${(vars[this.varGroup()] || []).includes(n) ? "sug" : ""}" data-mg="var" data-group="${group}" data-var="${esc(n)}" title="${esc(this.tt(`mgVar_${n}`))}">{${esc(n)}}</button>`)
      .join("")}</div>`;
  }

  // Schritt 3: wohin (Empfänger), kritische Mitteilung, Wiederholung
  step3Html() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    const change = d.kind === "change";
    const targetSub = d.target || (String(this.data.default_target || "").startsWith("notify.") ? this.data.default_target : t("mgTargetNone"));
    let html = `<div class="mg-k">${esc(t("mgTarget"))}</div>
      <button type="button" class="mg-sel" data-mg="target-toggle" aria-expanded="${this.wiz.targetOpen}"><span>${esc(d.target ? this.niceTarget(d.target) : t("mgTargetDefault"))}<small>${esc(targetSub)}</small></span>${this.chevHtml(this.wiz.targetOpen)}</button>`;
    if (this.wiz.targetOpen) html += `<div class="mg-list" role="listbox">${this.targetListHtml()}</div>`;
    html += `<p class="mg-hint">${esc(t("mgTargetHint"))}</p>
      <div class="mg-optrow"><div>${esc(t("mgCritical"))}<small>${esc(t("mgCriticalHint"))}</small></div><label class="switch"><input type="checkbox" data-mg="critical"${d.critical ? " checked" : ""} aria-label="${esc(t("mgCritical"))}"><span></span></label></div>`;
    if (d.critical) {
      html += `<div class="mg-vol"><label class="mg-k" for="mg-volume">${esc(t("mgVolume"))}</label>
        <div class="mg-volrow"><input id="mg-volume" type="range" min="1" max="${VOLUME_MAX}" step="1" value="${d.critical_volume}" data-mg="volume" aria-valuetext="${esc(t("mgVolumeOf", d.critical_volume))}"><output class="mg-volval" for="mg-volume">${esc(t("mgVolumeOf", d.critical_volume))}</output></div>
        <p class="mg-hint">${esc(t("mgVolumeHint"))}</p></div>`;
    }
    if (change) return `${html}<p class="mg-hint">${esc(t("mgChangeNote"))}</p>`;
    return `${html}<div class="mg-k">${esc(t("mgRepeat"))}</div>
      ${this.tabsHtml(PRESET_REPEAT.map((s) => ({ on: !d.repeatOwn.text && d.repeat_s === s, attrs: `data-mg="repeat" data-s="${s}"`, label: s ? t(`mgRepeat_${s}`) : t("mgRepeatOnce") })))}
      <div class="mg-own"><span>${esc(t("mgRepeatOwn"))}</span>
        <input class="mg-pill num mg-ownin" type="text" inputmode="decimal" data-mg="repeat-own" value="${esc(d.repeatOwn.text)}" placeholder="${esc(t("mgOwnPh"))}" aria-label="${esc(t("mgRepeatOwn"))}" autocomplete="off">
        <select class="mg-pill" data-mg="repeat-unit" aria-label="${esc(t("mgRepeatOwn"))}">${REPEAT_UNITS.map((u) => `<option value="${u}"${u === d.repeatOwn.unit ? " selected" : ""}>${esc(t(`mgUnit_${u}`))}</option>`).join("")}</select></div>
      <p class="mg-hint">${esc(t("mgRepeatOnceHint"))}</p>`;
  }

  targetListHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    const row = (value, title, sub) =>
      `<button type="button" class="mg-opt-row${d.target === value ? " on" : ""}" data-mg="target" data-v="${esc(value)}" role="option" aria-selected="${d.target === value}"><span>${esc(title)}${sub ? `<br><small>${esc(sub)}</small>` : ""}</span>${d.target === value ? "<span>✓</span>" : ""}</button>`;
    const defaultSub = String(this.data.default_target || "").startsWith("notify.") ? this.data.default_target : t("mgTargetNone");
    let html = row("", t("mgTargetDefault"), defaultSub);
    for (const [kind, label] of [["group", "mgTargetGroups"], ["service", "mgTargetServices"], ["entity", "mgTargetEntities"], ["missing", "mgTargetMissing"]]) {
      const list = this.data.targets.filter((x) => x.kind === kind);
      if (!list.length) continue;
      html += `<div class="mg-opt-head">${esc(t(label))}</div>${list.map((x) => row(x.value, this.niceTarget(x.value), x.value)).join("")}`;
    }
    return html;
  }

  // Schritt 4: Titel und Inhalt der Meldung, auf Wunsch "wieder normal" mit eigenem Titel und Inhalt, Vorschau und Test
  step4Html() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    const e = this.entity(d.entity_id);
    const group = this.varGroup();
    const change = d.kind === "change";
    return `<label class="mg-k" for="mg-message">${esc(t("mgMsgLabel"))}</label>
      <input id="mg-message" class="mg-input" type="text" maxlength="${this.limit("text", 300)}" data-mg-text="message" data-mg-group="main" value="${esc(d.message)}" placeholder="${esc(t("mgMsgPh"))}" autocomplete="off">
      <label class="mg-k" for="mg-body">${esc(t("mgBodyLabel"))}</label>
      <textarea id="mg-body" class="mg-text" rows="3" maxlength="${this.limit("text", 300)}" data-mg-text="body" data-mg-group="main" placeholder="${esc(t("mgBodyPh"))}">${esc(d.body)}</textarea>
      <p class="mg-hint">${esc(t("mgBodyHint"))}</p>
      <div class="mg-k">${esc(t("mgVarsFor", e?.name || "", t(`mgVarKind_${group}`)))}</div>${this.chipsHtml("main")}
      <p class="mg-hint">${esc(t("mgVarsWhere"))} ${esc(t(`mgVarHelp_${group}`))}</p>
      <div data-mg-zone="pv">${this.pvHtml("main")}</div>
      ${change ? "" : this.recoverHtml()}`;
  }

  // "Auch melden, wenn wieder normal" mit eigenem Titel und Inhalt (gehört zum Text der Meldung)
  recoverHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    let html = `<div class="mg-optrow"><div>${esc(t("mgRecover"))}</div><label class="switch"><input type="checkbox" data-mg="recover"${d.recover ? " checked" : ""} aria-label="${esc(t("mgRecover"))}"><span></span></label></div>`;
    if (d.recover) {
      html += `<label class="mg-k" for="mg-recover">${esc(t("mgRecoverText"))}</label>
        <input id="mg-recover" class="mg-input" type="text" maxlength="${this.limit("text", 300)}" data-mg-text="recover_message" data-mg-group="recover" value="${esc(d.recover_message)}" placeholder="${esc(t("mgMsgPh"))}" autocomplete="off">
        <label class="mg-k" for="mg-recover-body">${esc(t("mgRecoverBody"))}</label>
        <textarea id="mg-recover-body" class="mg-text" rows="2" maxlength="${this.limit("text", 300)}" data-mg-text="recover_body" data-mg-group="recover" placeholder="${esc(t("mgBodyPh"))}">${esc(d.recover_body)}</textarea>
        <p class="mg-hint">${esc(t("mgBodyHint"))}</p>
        ${this.chipsHtml("recover")}
        <div data-mg-zone="pvr">${this.pvHtml("recover")}</div>`;
    }
    return html;
  }


  step5Html() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    const rule = { ...this.draftPayload() };
    return `<label class="mg-k" for="mg-name">${esc(t("mgNameLabel"))}</label>
      <input id="mg-name" class="mg-input" type="text" data-mg="name" maxlength="${this.limit("name", 60)}" value="${esc(d.name)}" autocomplete="off">
      <p class="mg-hint">${esc(t("mgNameHint"))}</p>
      <div class="mg-k">${esc(t("mgSummary"))}</div>
      <div class="mg-card"><div class="mg-row"><span class="mg-ic" aria-hidden="true">${emojiFor(this.entity(d.entity_id))}</span><div class="mg-t"><b>${esc(d.name || "–")}</b><small>${esc(this.sentence(rule))}</small></div></div></div>
      <div data-mg-zone="pv">${this.pvHtml()}</div>`;
  }

  // --- Assistent: Zonen (ohne den Schritt neu zu zeichnen, sonst ginge beim Tippen der Fokus verloren) -------

  paintZones(only) {
    if (!this.win() || !this.wiz) return;
    for (const name of only || ["chart", "hist", "pv", "pvr", "forhint", "resethint"]) {
      const el = this.q(`[data-mg-zone="${name}"]`);
      if (!el) continue;
      if (name === "chart") el.innerHTML = this.wiz.step === 2 ? this.reviewChartHtml() : this.chartHtml(this.wiz.leafHist, this.curLeaf());
      else if (name === "hist") el.innerHTML = this.histHtml();
      else if (name === "forhint") el.innerHTML = this.forHintHtml();
      else if (name === "rforhint") el.innerHTML = this.resetForHintHtml();
      else if (name === "resethint") el.innerHTML = this.resetHintHtml();
      else if (name === "pvr") el.innerHTML = this.pvHtml("recover");
      else el.innerHTML = this.pvHtml(this.wiz.step === 4 ? "main" : undefined);
    }
  }

  // Diagramm der letzten 24 Stunden für eine Bedingung (seit 2.15.0 mit dem Verlauf als Parameter): Zahl als Linie mit Schwelle, Zustand als Balken.
  chartHtml(histData, lf) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = lf;
    const e = lf ? this.entity(lf.entity_id) : null;
    const hist = histData && !histData.loading ? histData : histData?.prev || null;
    if (!e || !hist || hist.failed || !hist.available || hist.empty) return "";
    const from = hist.start;
    const to = hist.end;
    const span = to - from || 1;
    const x = (ts) => Math.max(0, Math.min(100, ((ts - from) / span) * 100));
    const bands = (hist.intervals || []).filter(() => d.kind !== "change");
    if (e.kind === "number" && hist.points?.length > 1) {
      const limit = d.kind === "change" ? null : parseNumber(d.value);
      const back = d.resetOwn && d.kind !== "change" && !this.resetError(lf) ? parseNumber(d.reset_value) : null;
      const ys = hist.points.map((p) => p[1]);
      const hi = Math.max(...ys, limit ?? -Infinity, back ?? -Infinity);
      const lo = Math.min(...ys, limit ?? Infinity, back ?? Infinity);
      const W = 320;
      const H = 70;
      const y = (n) => H - 8 - ((n - lo) / (hi - lo || 1)) * (H - 16);
      const line = hist.points.map((p, i) => `${i ? "L" : "M"}${((x(p[0]) / 100) * W).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
      const zones = bands
        .map(([a, b, counts]) => `<rect x="${((x(a) / 100) * W).toFixed(1)}" y="0" width="${Math.max(1, ((x(b ?? to) - x(a)) / 100) * W).toFixed(1)}" height="${H}" fill="var(--dp-error)" opacity="${counts ? 0.2 : 0.08}"/>`)
        .join("");
      const lim = limit != null && Number.isFinite(limit) ? `<line x1="0" x2="${W}" y1="${y(limit).toFixed(1)}" y2="${y(limit).toFixed(1)}" stroke="var(--dp-error)" stroke-width="1.5" stroke-dasharray="5 4"/>` : "";
      const reset = back != null ? `<line x1="0" x2="${W}" y1="${y(back).toFixed(1)}" y2="${y(back).toFixed(1)}" stroke="var(--dp-success)" stroke-width="1.5" stroke-dasharray="5 4"/>` : "";
      const mid = limit != null ? t("mgChartThreshold", `${this.fmtNum(limit)}${e.unit ? ` ${e.unit}` : ""}`) : t("mgChartRange", this.fmtNum(lo), this.fmtNum(hi));
      return `<div class="mg-card"><svg class="mg-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(t("mgHistTitle"))}">${zones}<path d="${line}" fill="none" stroke="var(--dp-primary)" stroke-width="2" vector-effect="non-scaling-stroke"/>${lim}${reset}</svg>
        <div class="mg-scale"><span>${esc(t("mgChart24"))}</span><span>${esc(mid)}</span><span>${esc(t("mgChartNow"))}</span></div></div>`;
    }
    const what = d.kind === "change" ? t("mgChartChanges") : t("mgChartStateLine", this.condText({ entity_id: d.entity_id, kind: d.kind, value: d.value }));
    const spans = (hist.intervals || [])
      .map(([a, b, counts]) => `<span class="${counts ? "" : "dim"}" style="left:${x(a).toFixed(2)}%;width:${Math.max(0.8, x(b ?? to) - x(a)).toFixed(2)}%"></span>`)
      .join("");
    return `<div class="mg-card"><div class="mg-k first">${esc(what)}</div><div class="mg-bar">${spans}</div><div class="mg-scale"><span>${esc(t("mgChart24"))}</span><span>${esc(t("mgChartNow"))}</span></div></div>`;
  }

  // Rückblick als Text: "wäre 1-mal gekommen" und die letzte Auslösung; leer darf er sein.
  histHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const h = this.wiz.hist;
    const head = `<b>${esc(t("mgHistTitle"))}</b>`;
    if (!h) return "";
    if (h.loading) return `<div class="mg-hist">${head} · ${esc(t("mgHistLoading"))}</div>`;
    if (h.failed) return `<div class="mg-hist">${head} · ${esc(t("mgHistFail"))}</div>`;
    if (!h.available) return `<div class="mg-hist">${head} · ${esc(t("mgHistNoRecorder"))}<small>${esc(t("mgHistNoneSub"))}</small></div>`;
    if (h.empty) return `<div class="mg-hist">${head} · ${esc(t("mgHistNone"))}<small>${esc(t("mgHistNoneSub"))}</small></div>`;
    const word = h.count === 0 ? t("mgHistNever") : h.count === 1 ? t("mgHistOnce") : t("mgHistTimes", h.count);
    let sub = "";
    const f = h.fires?.[0];
    if (f) {
      const e = this.entity(this.wiz.draft.entity_id);
      const unit = e?.kind === "number" && e.unit ? ` ${e.unit}` : "";
      sub = t("mgHistLast", this.host._fmtTime(f.start, true), this.fmtDur(f.duration), f.end == null);
      if (f.extreme != null) sub += ` · ${this.wiz.draft.kind === "below" ? t("mgHistLow", this.fmtNum(f.extreme) + unit) : t("mgHistHigh", this.fmtNum(f.extreme) + unit)}`;
    }
    return `<div class="mg-hist">${head} · ${esc(word)}${sub ? `<small>${esc(sub)}</small>` : ""}</div>`;
  }

  // Vorschau: Meldung der Seite, mit eingesetzten Werten (vom Server).
  // only: "main" oder "recover" (Schritt 4: jede Vorschau steht unter ihren Feldern); ohne: beide (Schritt 5)
  pvHtml(only) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const w = this.wiz;
    const card = (p, note, which) => {
      let inner;
      if (!p) inner = `<div class="pv-text">…</div>`;
      else if (p.error) inner = `<div class="opt-error">${esc(t("mgPvError", p.error))}</div>`;
      else if (!p.title) inner = `<div class="pv-text">${esc(t("mgPvEmpty"))}</div>`;
      else inner = `<div class="pv-title">${esc(p.title)}</div><div class="pv-text">${esc(p.message)}</div>`;
      const test = w.step === 4 ? this.testHtml(which) : "";
      return `<div class="mg-pv"><div class="pv-k">${esc(t("mgPvLabel"))}</div><div class="pv-card"><div class="pv-app">${this.h.logo}${esc(t("mgPvApp"))}${which === "main" && w.draft.critical ? ` · ${esc(t("mgPvCritical"))}` : ""}</div>${inner}</div><div class="opt-short">${esc(note)}</div>${test}</div>`;
    };
    const recoverOn = w.draft.recover && w.draft.kind !== "change";
    if (only === "main") return card(w.pv.main, t("mgPvNote"), "main");
    if (only === "recover") return recoverOn ? card(w.pv.recover, t("mgPvNoteRecover"), "recover") : "";
    let html = card(w.pv.main, t("mgPvNote"), "main");
    if (w.step >= 4 && recoverOn) html += card(w.pv.recover, t("mgPvNoteRecover"), "recover");
    return html;
  }

  testHtml(which) {
    const esc = (v) => this.esc(v);
    const test = this.wiz.test;
    const mine = test && test.which === which ? test : null;
    const label = mine?.busy ? this.t("mgTesting") : this.t("mgTest");
    return `<div class="mg-testrow"><button type="button" class="linkbtn" data-mg="test" data-which="${which}"${mine?.busy ? " disabled" : ""}>${esc(label)}</button>${
      mine?.text ? `<span class="mg-testres${mine.failed ? " bad" : ""}" role="status">${esc(mine.text)}</span>` : ""
    }</div>`;
  }

  // --- Ereignisse -------------------------------------------------------------

  // Das Fenster des Assistenten: dieselben Ereignisse wie im Popup; Escape fragt bei Änderungen nach, ein Klick daneben nicht
  bindWindow(win) {
    this.bind(win);
    win.addEventListener("cancel", (ev) => {
      ev.preventDefault();
      if (this.wiz?.confirmClose) {
        this.wiz.confirmClose = false;
        this.paint();
      } else this.requestClose();
    });
    window.matchMedia?.("(min-width: 900px)").addEventListener?.("change", () => {
      if (this.wizardOpen()) this.paint();
    });
  }

  bind(dlg) {
    dlg.addEventListener("click", (ev) => this.onClick(ev));
    dlg.addEventListener("input", (ev) => this.onInput(ev));
    dlg.addEventListener("change", (ev) => this.onChange(ev));
    dlg.addEventListener("keydown", (ev) => this.onKey(ev));
    // Welches Feld einer Gruppe zuletzt gewählt wurde, bekommt die Variable (auch wenn ein Tipp auf den Chip den Fokus nimmt)
    dlg.addEventListener("focusin", (ev) => {
      const el = ev.target;
      if (this.wiz && el.dataset?.mgText) (this.wiz.focus ||= {})[el.dataset.mgGroup] = el.dataset.mgText;
    });
    // Variablen einfügen, ohne dass das Textfeld den Fokus (und die Tastatur) verliert.
    dlg.addEventListener("mousedown", (ev) => {
      if (ev.target.closest?.('[data-mg="var"]')) ev.preventDefault();
    });
  }

  onClick(ev) {
    const el = ev.target.closest?.("[data-mg]");
    if (!el || !this.inScope(el) || el.disabled) return;
    const action = el.dataset.mg;
    const id = el.dataset.id;
    switch (action) {
      case "reload":
        this.error = null;
        this.paint();
        this.load(this.deviceId);
        break;
      case "add":
        this.startWizard();
        break;
      case "edit":
        {
          const rule = this.data.rules.find((r) => r.id === id);
          if (rule) this.startWizard(rule);
        }
        break;
      case "rename":
        {
          const rule = this.data.rules.find((r) => r.id === id);
          if (!rule) break;
          this.ui = { ...this.ui, renameId: id, renameValue: rule.name, confirmId: null, flash: "", error: "" };
          this.paint();
        }
        break;
      case "rename-cancel":
        this.ui.renameId = null;
        this.paint();
        break;
      case "rename-save":
        this.renameSave();
        break;
      case "delete":
        this.ui = { ...this.ui, confirmId: id, renameId: null, flash: "", error: "" };
        this.paint();
        break;
      case "delete-no":
        this.ui.confirmId = null;
        this.paint();
        break;
      case "delete-yes":
        this.remove(id);
        break;
      case "cancel":
        if (this.wiz.step === 1 && this.wiz.adding && this.leavesOf().length) {
          this.wiz.adding = null;
          this.paint();
        } else this.requestClose();
        break;
      case "close":
        this.requestClose();
        break;
      case "discard-no":
        this.wiz.confirmClose = false;
        this.paint();
        break;
      case "discard-yes":
        this.closeWizard();
        break;
      case "back":
        this.goto(this.wiz.step - 1);
        break;
      case "next":
        if (this.wiz.step === 0) this.chooseDevice();
        else this.goto(this.wiz.step + 1);
        break;
      case "dev":
        this.wiz.pickId = id;
        this.paint();
        break;
      case "goto":
        this.goto(Number(el.dataset.step));
        break;
      case "save":
        this.save();
        break;
      case "pick":
        this.onPick(id);
        break;
      case "add-cond":
        this.startAdd({ group: null });
        break;
      case "add-group":
        this.startAdd({ group: "new" });
        break;
      case "add-in":
        this.startAdd({ group: el.dataset.uid });
        break;
      case "leaf-open":
        this.openLeaf(el.dataset.uid);
        break;
      case "leaf-del":
        this.removeLeaf(el.dataset.uid);
        break;
      case "leaf-entity":
        this.startAdd({ replace: el.dataset.uid });
        break;
      case "group-del":
        this.removeGroup(el.dataset.uid);
        break;
      case "op":
        this.wiz.draft.conds.op = el.dataset.v;
        this.paint();
        break;
      case "gop": {
        const g = this.wiz.draft.conds.items.find((it) => it.uid === el.dataset.group);
        if (g) g.op = el.dataset.v;
        this.paint();
        break;
      }
      case "free-open":
        this.wiz.free.open = !this.wiz.free.open;
        this.paint();
        if (this.wiz.free.open) {
          if (!this.wiz.free.results) this.searchFree(this.wiz.free.query);
          const field = this.q('[data-mg="free-query"]');
          field?.focus({ preventScroll: true });
          this.revealField(field);
        }
        break;
      case "free-pick": {
        const found = this.wiz.free.results?.find((x) => x.entity_id === id);
        if (!found) break;
        this.extra[id] = found;
        this.wiz.free.open = false;
        this.onPick(id);
        break;
      }
      case "kind":
        this.setKind(el.dataset.kind);
        break;
      case "state": {
        const lf = this.curLeaf();
        if (!lf) break;
        lf.value = el.dataset.v;
        this.syncPrimary();
        this.syncDefaults();
        this.paint();
        this.requestLeafHistory();
        break;
      }
      case "step":
        this.stepValue(Number(el.dataset.dir));
        break;
      case "reset-step":
        this.stepValue(Number(el.dataset.dir), "reset_value");
        break;
      case "reset-mode": {
        const lf = this.curLeaf();
        if (!lf) break;
        lf.resetOwn = el.dataset.own === "1";
        if (lf.resetOwn && String(lf.reset_value).trim() === "") lf.reset_value = this.defaultReset(lf);
        this.syncPrimary();
        this.paint();
        this.requestLeafHistory();
        break;
      }
      case "reset-state": {
        const lf = this.curLeaf();
        if (!lf) break;
        lf.reset_value = el.dataset.v;
        this.syncPrimary();
        this.paint();
        this.requestLeafHistory();
        break;
      }
      case "for":
        this.setForSeconds(Number(el.dataset.s));
        break;
      case "rfor":
        this.setResetForSeconds(Number(el.dataset.s));
        break;
      case "repeat":
        this.setRepeatSeconds(Number(el.dataset.s));
        break;
      case "target-toggle":
        this.wiz.targetOpen = !this.wiz.targetOpen;
        this.paint();
        break;
      case "target":
        this.wiz.draft.target = el.dataset.v;
        this.wiz.targetOpen = false;
        this.paint();
        break;
      case "var":
        this.insertVariable(el.dataset.group, el.dataset.var);
        break;
      case "test":
        this.sendTest(el.dataset.which);
        break;
      default:
    }
  }

  // Die Variable kommt in das zuletzt gewählte Feld der Gruppe (Titel oder Inhalt); ohne Wahl in den Titel.
  insertVariable(group, name) {
    const field = this.wiz.focus?.[group] || (group === "recover" ? "recover_message" : "message");
    const ta = this.q(`[data-mg-text="${field}"]`);
    if (!ta) return;
    const token = `{${name}}`;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? start;
    const limit = this.limit("text", 300);
    const next = ta.value.slice(0, start) + token + ta.value.slice(end);
    if (next.length > limit) return;
    ta.value = next;
    ta.setSelectionRange(start + token.length, start + token.length);
    ta.focus({ preventScroll: true });
    this.onText(ta);
  }

  onText(ta) {
    const d = this.wiz.draft;
    const field = ta.dataset.mgText;
    d[field] = ta.value;
    d.touched[field] = true;
    this.syncNav();
    this.requestPreview();
  }

  onInput(ev) {
    const el = ev.target;
    const action = el.dataset?.mg;
    if (action === "rename-input") {
      this.ui.renameValue = el.value;
      return;
    }
    if (!this.wiz || !this.inScope(el)) return;
    if (el.dataset.mgText) this.onText(el);
    else if (action === "value") this.setValue(el.value, true);
    else if (action === "reset-value") this.setReset(el.value, true);
    else if (action === "dev-search") {
      this.wiz.devQuery = el.value;
      const zone = this.q('[data-mg-zone="devs"]');
      if (zone) zone.innerHTML = this.devsHtml();
    } else if (action === "free-query") {
      this.wiz.free.query = el.value;
      this.searchFree(el.value);
    }
    else if (action === "for-own") {
      this.wiz.draft.forOwn.text = el.value;
      this.applyOwnFor();
    } else if (action === "rfor-own") {
      this.wiz.draft.resetForOwn.text = el.value;
      this.applyOwnResetFor();
    } else if (action === "repeat-own") {
      this.wiz.draft.repeatOwn.text = el.value;
      this.applyOwnRepeat();
    } else if (action === "volume") {
      const level = Math.min(Math.max(Number(el.value) || 1, 1), VOLUME_MAX);
      this.wiz.draft.critical_volume = level;
      const out = this.q(".mg-volval");
      if (out) out.textContent = this.t("mgVolumeOf", level);
      el.setAttribute("aria-valuetext", this.t("mgVolumeOf", level));
    } else if (action === "name") {
      this.wiz.draft.name = el.value;
      this.wiz.draft.nameTouched = true;
      this.syncNav();
      const title = this.q(".mg-card .mg-t b");
      if (title) title.textContent = el.value || "–";
    }
  }

  onChange(ev) {
    const el = ev.target;
    const action = el.dataset?.mg;
    if (!action) return;
    if (action === "toggle") {
      this.toggle(el.dataset.id, el.checked);
      return;
    }
    if (!this.wiz) return;
    const d = this.wiz.draft;
    if (action === "for-unit") {
      d.forOwn.unit = Number(el.value);
      this.applyOwnFor();
    } else if (action === "rfor-unit") {
      d.resetForOwn.unit = Number(el.value);
      this.applyOwnResetFor();
    } else if (action === "repeat-unit") {
      d.repeatOwn.unit = Number(el.value);
      this.applyOwnRepeat();
    } else if (action === "critical") {
      d.critical = el.checked;
      this.paint();
      this.paintZones(["pv", "pvr"]);
    } else if (action === "recover") {
      d.recover = el.checked;
      if (d.recover && !d.recover_message) d.recover_message = this.defaultRecover(d);
      if (d.recover && !d.touched.recover_body && !d.recover_body) d.recover_body = this.defaultRecoverBody();
      this.paint();
      this.requestPreview();
    }
  }

  onKey(ev) {
    const el = ev.target;
    const action = el.dataset?.mg;
    if (action === "rename-input" && (ev.key === "Enter" || ev.key === "Escape")) {
      // Escape beendet nur das Umbenennen; das Popup bleibt offen.
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.key === "Enter") this.renameSave();
      else {
        this.ui.renameId = null;
        this.paint();
      }
    } else if (this.wiz && action === "name" && ev.key === "Enter") {
      ev.preventDefault();
      this.save();
    }
  }
}
