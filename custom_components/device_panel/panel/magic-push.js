/**
 * Magic Push im Geräte-Popup (seit 2.6.0, docs/mockups/magic-push-v2, Variante C).
 *
 * Der Reiter verwaltet sich selbst: Er schreibt nur in einen eigenen Behälter (.mg-root) und hält seinen Stand
 * (Meldungen, Entwurf des Assistenten) im Speicher. Das Popup baut sich alle 10 Sekunden neu auf; deshalb setzt
 * attach() den Behälter nach jedem Neuaufbau aus dem Stand wieder zusammen, und solange der Assistent offen ist,
 * baut das Popup gar nicht neu (wizardOpen()). So geht beim Tippen nichts verloren.
 *
 * Aufbau: Liste der Meldungen (Name, Satz, Schalter, Bearbeiten/Umbenennen/Löschen) und ein Assistent in fünf
 * Schritten (Wert · Wann · Text · Versand · Name). Rückblick und Vorschau kommen vom Server (magic_history,
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
const PREVIEW_DELAY_MS = 300;
// Felder, die der Server in einer Meldung annimmt (alles andere, etwa "active", würde er ablehnen).
const RULE_KEYS = ["id", "device_id", "entity_id", "name", "kind", "value", "for_s", "message", "recover", "recover_message", "repeat_s", "target", "enabled", "critical", "critical_volume"];

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
    this.ui = { renameId: null, renameValue: "", confirmId: null, flash: "", error: "" };
    this._seq = 0;
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

  // Zahl der eingeschalteten Meldungen für die Beschriftung des Reiters (null: noch nicht geladen).
  count(deviceId) {
    if (!this.data || this.deviceId !== deviceId) return null;
    return this.data.rules.filter((r) => r.enabled).length;
  }

  // Popup geöffnet: bei einem anderen Gerät von vorn beginnen und im Hintergrund laden.
  open(deviceId) {
    if (this.deviceId !== deviceId) {
      this.reset();
      this.deviceId = deviceId;
    }
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
    } catch (err) {
      if (this.deviceId !== deviceId) return;
      this.error = this.h.errText(err);
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
    this.paint();
  }

  entity(id) {
    return this.data?.entities.find((e) => e.entity_id === id) || null;
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
  condText(rule) {
    const e = this.entity(rule.entity_id);
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

  entityName(rule) {
    return this.entity(rule.entity_id)?.name || rule.entity_id;
  }

  repeatText(seconds) {
    if (!seconds) return this.t("mgSentenceOnce");
    return this.t("mgSentenceEvery", this.fmtDur(seconds));
  }

  // "Temperatur unter 12 °C · für 10 Min. · einmal · mit "wieder normal""
  sentence(rule) {
    const parts = [`${this.entityName(rule)} ${this.condText(rule)}`];
    parts.push(rule.for_s ? this.t("mgSentenceFor", this.fmtDur(rule.for_s)) : this.t("mgSentenceNow"));
    if (rule.kind !== "change") {
      parts.push(this.repeatText(rule.repeat_s));
      if (rule.recover) parts.push(this.t("mgSentenceRecover"));
    }
    if (rule.critical) parts.push(this.t("mgSentenceCritical", rule.critical_volume ?? VOLUME_MAX));
    if (rule.target) parts.push(this.t("mgSentenceTo", this.niceTarget(rule.target)));
    return parts.join(" · ");
  }

  // Vorschlag für den Namen aus Entität und Bedingung.
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

  draftPayload() {
    const d = this.wiz.draft;
    const e = this.entity(d.entity_id);
    let value = null;
    if (d.kind === "above" || d.kind === "below") value = parseNumber(d.value);
    else if (d.kind === "is") value = e?.kind === "number" ? (parseNumber(d.value) ?? d.value) : d.value;
    const out = {
      device_id: this.deviceId,
      entity_id: d.entity_id,
      name: (d.name || "").trim() || this.suggestName(d) || "Magic Push",
      kind: d.kind,
      value,
      for_s: d.for_s,
      message: d.message,
      recover: d.kind === "change" ? false : d.recover,
      recover_message: d.recover_message,
      repeat_s: d.kind === "change" ? 0 : d.repeat_s,
      target: d.target || null,
      enabled: d.enabled,
      critical: d.critical,
      critical_volume: d.critical_volume,
    };
    if (d.id) out.id = d.id;
    return out;
  }

  // --- Liste ------------------------------------------------------------------

  paint() {
    if (!this.root?.isConnected) return;
    this.root.innerHTML = this.view === "wizard" && this.wiz ? this.wizardHtml() : this.listHtml();
    if (this.view === "list" && this.ui.renameId) {
      const input = this.root.querySelector('input[data-mg="rename-input"]');
      if (input) {
        input.focus({ preventScroll: true });
        input.select();
      }
    }
    if (this.view === "wizard") this.paintZones();
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
    html += rules.map((r) => this.cardHtml(r)).join("");
    const full = rules.length >= this.limit("per_device", 20);
    html += full
      ? `<p class="mg-hint">${esc(t("mgLimit", this.limit("per_device", 20)))}</p>`
      : `<button type="button" class="mg-add" data-mg="add">${this.h.mdi("plus", 18)}${esc(t("mgAdd"))}</button>`;
    return html;
  }

  cardHtml(r) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const e = this.entity(r.entity_id);
    const renaming = this.ui.renameId === r.id;
    const confirming = this.ui.confirmId === r.id;
    const status = [];
    if (r.entity_missing) status.push(`<span class="mg-warn">${esc(t("mgEntityMissing"))}</span>`);
    else if (!r.available && r.enabled) status.push(`<span class="mg-warn">${esc(t("mgUnreachable"))}</span>`);
    if (!r.enabled) status.push(esc(t("mgDisabled")));
    else if (r.active) status.push(`<span class="mg-on">${esc(r.fired ? t("mgFiredNow") : t("mgActiveNow"))}</span>`);
    if (r.last_fired) {
      const ago = (Date.now() + this.host._offset) / 1000 - r.last_fired;
      status.push(esc(ago < 60 ? t("mgJustNow") : t("mgLast", this.host._fmtSeconds(ago, true))));
    } else status.push(esc(t("mgNever")));
    const title = renaming
      ? `<div class="mg-t"><input class="mg-input" type="text" data-mg="rename-input" maxlength="${this.limit("name", 60)}" value="${esc(this.ui.renameValue)}" aria-label="${esc(t("mgRenameLabel"))}">
          <div class="mg-btns small"><button type="button" class="dlg-btn" data-mg="rename-cancel">${esc(t("mgCancel"))}</button><button type="button" class="dlg-btn primary" data-mg="rename-save">${esc(t("mgSave"))}</button></div></div>`
      : `<div class="mg-t"><b>${esc(r.name)}</b><small>${esc(this.sentence(r))}</small><small class="mg-status">${status.join(" · ")}</small></div>`;
    const sw = `<label class="switch"><input type="checkbox" data-mg="toggle" data-id="${esc(r.id)}"${r.enabled ? " checked" : ""} aria-label="${esc(r.name)}"><span></span></label>`;
    let acts = "";
    if (!renaming && !confirming) {
      acts = `<div class="mg-acts"><button type="button" class="linkbtn" data-mg="edit" data-id="${esc(r.id)}">${esc(t("mgActEdit"))}</button>
        <button type="button" class="linkbtn" data-mg="rename" data-id="${esc(r.id)}">${esc(t("mgActRename"))}</button>
        <button type="button" class="linkbtn danger" data-mg="delete" data-id="${esc(r.id)}">${esc(t("mgActDelete"))}</button></div>`;
    }
    const confirm = confirming
      ? `<div class="mg-confirm"><b>${esc(t("mgDeleteAsk", r.name))}</b><small>${esc(t("mgDeleteNote"))}</small>
          <div class="mg-btns small"><button type="button" class="dlg-btn" data-mg="delete-no">${esc(t("mgCancel"))}</button><button type="button" class="dlg-btn danger" data-mg="delete-yes" data-id="${esc(r.id)}">${esc(t("mgDeleteYes"))}</button></div></div>`
      : "";
    return `<div class="mg-card${r.enabled ? "" : " off"}"><div class="mg-row"><span class="mg-ic" aria-hidden="true">${emojiFor(e)}</span>${title}${renaming ? "" : sw}</div>${acts}${confirm}</div>`;
  }

  // --- Assistent: Stand -------------------------------------------------------

  newDraft() {
    return {
      id: null,
      entity_id: "",
      kind: "below",
      value: "",
      for_s: 600,
      forOwn: { text: "", unit: 60 },
      message: "",
      messageTouched: false,
      recover: false,
      recover_message: "",
      recoverTouched: false,
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
    Object.assign(d, {
      id: rule.id,
      entity_id: rule.entity_id,
      kind: rule.kind,
      value: rule.value == null ? "" : String(rule.value),
      for_s: rule.for_s,
      message: rule.message,
      messageTouched: true,
      recover: Boolean(rule.recover),
      recover_message: rule.recover_message || "",
      recoverTouched: true,
      repeat_s: rule.repeat_s || 0,
      target: rule.target || "",
      critical: Boolean(rule.critical),
      critical_volume: rule.critical_volume ?? VOLUME_MAX,
      name: rule.name,
      nameTouched: true,
      enabled: rule.enabled,
    });
    if (!PRESET_FOR.includes(d.for_s)) d.forOwn = splitSeconds(d.for_s, FOR_UNITS);
    if (d.repeat_s && !PRESET_REPEAT.includes(d.repeat_s)) d.repeatOwn = splitSeconds(d.repeat_s, REPEAT_UNITS);
    return d;
  }

  startWizard(rule = null) {
    this.view = "wizard";
    this.ui.flash = "";
    this.ui.error = "";
    this.wiz = {
      step: 1,
      editing: Boolean(rule),
      draft: rule ? this.draftFrom(rule) : this.newDraft(),
      hist: null,
      pv: { main: null, recover: null },
      test: null,
      targetOpen: false,
      error: "",
      saving: false,
    };
    this.paint();
    this.scrollTop();
  }

  closeWizard() {
    window.clearTimeout(this._histTimer);
    window.clearTimeout(this._pvTimer);
    this._seq += 1;
    this.view = "list";
    this.wiz = null;
    this.paint();
    this.scrollTop();
    this.host._renderDevice(true);
  }

  scrollTop() {
    const dlg = this.host.shadowRoot.querySelector("dialog.device");
    if (dlg) dlg.scrollTop = 0;
  }

  // Wert, Bedingung oder Entität haben sich geändert: Standardtexte nachführen, solange nichts von Hand geschrieben wurde.
  syncDefaults() {
    const d = this.wiz.draft;
    if (!d.messageTouched) d.message = this.defaultMessage(d);
    if (!d.recoverTouched) d.recover_message = this.defaultRecover(d);
    if (!d.nameTouched) d.name = this.suggestName(d);
  }

  pickEntity(id) {
    const d = this.wiz.draft;
    const e = this.entity(id);
    if (!e) return;
    // Beim Wechsel auf eine andere Entität passt der alte Wert nicht mehr (Schwelle der Temperatur gilt nicht für die Feuchte).
    if (d.entity_id !== id) {
      if (e.kind === "number") {
        if (!["above", "below", "is", "change"].includes(d.kind)) d.kind = "below";
        d.value = e.number != null ? String(Math.round(e.number * 10) / 10) : "";
      } else {
        if (d.kind !== "change") d.kind = "is";
        const other = e.options?.find((o) => o.value !== String(e.state)) || e.options?.[0];
        d.value = other ? other.value : "";
      }
      d.entity_id = id;
    }
    this.syncDefaults();
    this.paint();
    this.syncNav();
  }

  setKind(kind) {
    const d = this.wiz.draft;
    const e = this.entity(d.entity_id);
    d.kind = kind;
    if (kind === "is" && e?.kind === "state" && !d.value) d.value = e.options?.[0]?.value ?? "";
    if ((kind === "above" || kind === "below" || (kind === "is" && e?.kind === "number")) && parseNumber(d.value) == null && e?.number != null) {
      d.value = String(Math.round(e.number * 10) / 10);
    }
    this.syncDefaults();
    this.paint();
    this.requestHistory();
    this.requestPreview();
  }

  setValue(text, fromInput = false) {
    const d = this.wiz.draft;
    d.value = text;
    if (!d.nameTouched) d.name = this.suggestName(d);
    if (!fromInput) {
      const input = this.root.querySelector('input[data-mg="value"]');
      if (input) input.value = text;
    }
    this.paintZones(["chart"]);
    this.syncNav();
    this.requestHistory();
    this.requestPreview();
  }

  stepValue(direction) {
    const d = this.wiz.draft;
    const e = this.entity(d.entity_id);
    const current = parseNumber(d.value) ?? e?.number ?? 0;
    // Ganze Schwelle in ganzen Schritten, mit Nachkommastellen in Zehnteln (ab 100 wieder ganz, sonst zu mühsam).
    const step = Number.isInteger(current) || Math.abs(current) >= 100 ? 1 : 0.1;
    this.setValue(String(Math.round((current + direction * step) * 1000) / 1000));
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

  // Die Voreinstellungen leuchten nur, wenn sie gelten und keine eigene Zeit getippt ist.
  markPresets() {
    const d = this.wiz.draft;
    for (const btn of this.root.querySelectorAll('[data-mg="for"]')) {
      btn.classList.toggle("on", !d.forOwn.text && Number(btn.dataset.s) === d.for_s);
    }
    for (const btn of this.root.querySelectorAll('[data-mg="repeat"]')) {
      btn.classList.toggle("on", !d.repeatOwn.text && Number(btn.dataset.s) === d.repeat_s);
    }
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

  repeatError() {
    const d = this.wiz.draft;
    if (d.repeatOwn.text && parseNumber(d.repeatOwn.text) == null) return true;
    return d.repeat_s > this.limit("repeat", 2592000);
  }

  canNext(step = this.wiz.step) {
    const d = this.wiz.draft;
    const e = this.entity(d.entity_id);
    if (step === 1) return Boolean(e);
    if (step === 2) {
      if (!e) return false;
      if (d.kind === "above" || d.kind === "below") return parseNumber(d.value) != null && !this.forError();
      if (d.kind === "is") return String(d.value).trim() !== "" && (e.kind !== "number" || parseNumber(d.value) != null) && !this.forError();
      return !this.forError();
    }
    if (step === 3) return d.message.trim() !== "";
    if (step === 4) return (!d.recover || d.kind === "change" || d.recover_message.trim() !== "") && !this.repeatError();
    return d.name.trim() !== "";
  }

  syncNav() {
    if (!this.root || !this.wiz) return;
    const ok = this.canNext();
    for (const btn of this.root.querySelectorAll('[data-mg="next"], [data-mg="save"]')) btn.disabled = !ok || this.wiz.saving;
  }

  goto(step) {
    const w = this.wiz;
    if (step < 1 || step > STEPS || step === w.step) return;
    // Vorwärts nur, wenn die Schritte davor vollständig sind.
    for (let s = w.step; s < step; s += 1) if (!this.canNext(s)) return;
    w.step = step;
    w.error = "";
    if (step === 5 && !w.draft.nameTouched) w.draft.name = this.suggestName(w.draft);
    if (step === 3) this.syncDefaults();
    this.paint();
    this.scrollTop();
    if (step === 2) this.requestHistory();
    if (step >= 3) this.requestPreview();
  }

  // --- Assistent: Rückblick und Vorschau ----------------------------------------

  requestHistory() {
    const w = this.wiz;
    if (!w || w.step !== 2) return;
    window.clearTimeout(this._histTimer);
    const d = w.draft;
    const numeric = d.kind === "above" || d.kind === "below";
    const value = numeric ? parseNumber(d.value) : d.kind === "is" ? d.value : null;
    if ((numeric && value == null) || (d.kind === "is" && String(d.value).trim() === "") || this.forError()) {
      w.hist = null;
      this.paintZones(["chart", "hist"]);
      return;
    }
    w.hist = { loading: true, prev: w.hist && !w.hist.loading ? w.hist : w.hist?.prev || null };
    this.paintZones(["hist"]);
    this._histTimer = window.setTimeout(() => this.fetchHistory(value), HIST_DELAY_MS);
  }

  async fetchHistory(value) {
    const w = this.wiz;
    if (!w) return;
    const d = w.draft;
    const seq = (this._seq += 1);
    const msg = { type: "device_panel/magic_history", entity_id: d.entity_id, kind: d.kind, for_s: d.for_s };
    if (value != null) msg.value = value;
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
    if (!w || w.step < 3) return;
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
    this.paintZones(["pv"]);
  }

  async sendTest(which) {
    const w = this.wiz;
    if (!w || w.test?.busy) return;
    w.test = { which, busy: true };
    this.paintZones(["pv"]);
    try {
      const r = await this.call({ type: "device_panel/magic_test", rule: this.draftPayload(), which });
      const to = w.draft.target || this.data.default_target;
      w.test = { which, text: r.sent ? this.t("mgTestSent", this.targetLabel(to === "none" ? "" : to)) : this.t("mgTestFail"), failed: !r.sent };
    } catch (err) {
      w.test = { which, text: this.t("mgTestError", this.h.errText(err)), failed: true };
    }
    if (this.wiz === w) this.paintZones(["pv"]);
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
    const bars = Array.from({ length: STEPS }, (_, i) => {
      const n = i + 1;
      const on = n <= step ? " on" : "";
      const open = w.editing || n < step;
      return open
        ? `<button type="button" class="mg-stp${on}" data-mg="goto" data-step="${n}" aria-label="${esc(`${t("mgStepOf", n, STEPS)}: ${t(`mgStepName_${n}`)}`)}"></button>`
        : `<span class="mg-stp${on}"></span>`;
    }).join("");
    const where = step === 1 ? t(`mgStepName_${step}`) : `${e ? `${emojiFor(e)} ${e.name} · ` : ""}${t(`mgStepName_${step}`)}`;
    let body = "";
    if (step === 1) body = this.step1Html();
    else if (step === 2) body = this.step2Html();
    else if (step === 3) body = this.step3Html();
    else if (step === 4) body = this.step4Html();
    else body = this.step5Html();
    const last = step === STEPS;
    const nav = `<div class="mg-btns"><button type="button" class="dlg-btn" data-mg="${step === 1 ? "cancel" : "back"}">${esc(step === 1 ? t("mgCancel") : t("mgBack"))}</button>
      ${last ? `<button type="button" class="dlg-btn primary" data-mg="save"${this.canNext() && !w.saving ? "" : " disabled"}>${esc(t("mgSave"))}</button>` : `<button type="button" class="dlg-btn primary" data-mg="next"${this.canNext() ? "" : " disabled"}>${esc(t("mgNext"))}</button>`}</div>`;
    return `<h3>${esc(w.editing ? t("mgEditing") : t("mgNew"))}</h3>
      <div class="mg-stephead"><span>${esc(t("mgStepOf", step, STEPS))}</span><span>${esc(where)}</span></div>
      <div class="mg-steps">${bars}</div>
      <div class="mg-big">${esc(t(`mgQ_${step}`))}</div>
      ${body}
      ${w.error ? `<div class="dlg-error" role="alert">${esc(w.error)}</div>` : ""}
      ${nav}`;
  }

  step1Html() {
    const esc = (v) => this.esc(v);
    const entities = this.data?.entities || [];
    if (!entities.length) return `<p class="mg-note">${esc(this.t("mgNoEntities"))}</p>`;
    const picked = this.wiz.draft.entity_id;
    return entities
      .map((e) => {
        const cat = e.category ? this.tt(`mgCat_${e.category}`) : "";
        const sel = e.entity_id === picked;
        return `<button type="button" class="mg-card mg-pick${sel ? " sel" : ""}" data-mg="pick" data-id="${esc(e.entity_id)}" role="radio" aria-checked="${sel}">
          <span class="mg-row"><span class="mg-ic" aria-hidden="true">${emojiFor(e)}</span><span class="mg-t"><b>${esc(e.name)}</b>${cat ? `<small>${esc(cat)}</small>` : ""}</span>
          <span class="mg-val${e.available ? "" : " off"}">${esc(this.entityValue(e))}</span><span class="mg-radio${sel ? " on" : ""}"></span></span></button>`;
      })
      .join("");
  }

  // Bedingung (Zahl: über, unter, ist gleich, ändert sich; Zustand: ist, ändert sich), Wert, Dauer.
  step2Html() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    const e = this.entity(d.entity_id);
    if (!e) return "";
    const kinds = e.kind === "number" ? [["above", "mgKindAbove"], ["below", "mgKindBelow"], ["is", "mgKindIs"], ["change", "mgKindChange"]] : [["is", "mgKindIsState"], ["change", "mgKindChange"]];
    let html = `<div class="mg-seg" role="tablist">${kinds
      .map(([k, label]) => `<button type="button" role="tab" class="${d.kind === k ? "on" : ""}" aria-selected="${d.kind === k}" data-mg="kind" data-kind="${k}">${esc(t(label))}</button>`)
      .join("")}</div>`;
    html += `<div data-mg-zone="chart">${this.chartHtml()}</div>`;
    if (d.kind === "above" || d.kind === "below" || (d.kind === "is" && e.kind === "number")) {
      html += `<div class="mg-k">${esc(t("mgThreshold"))}${e.unit ? ` <span class="mg-unit">· ${esc(t("mgThresholdUnit", e.unit))}</span>` : ""}</div>
        <div class="mg-pills"><button type="button" class="mg-pill num" data-mg="step" data-dir="-1" aria-label="${esc(t("mgMinus"))}">−</button>
        <input class="mg-pill num mg-valin" type="text" inputmode="decimal" data-mg="value" value="${esc(d.value)}" aria-label="${esc(t("mgThreshold"))}" autocomplete="off">
        <button type="button" class="mg-pill num" data-mg="step" data-dir="1" aria-label="${esc(t("mgPlus"))}">+</button></div>`;
    } else if (d.kind === "is") {
      if (e.options?.length) {
        html += `<div class="mg-k">${esc(t("mgPickState"))}</div><div class="mg-seg wrap">${e.options
          .map((o) => `<button type="button" class="${String(d.value) === o.value ? "on" : ""}" data-mg="state" data-v="${esc(o.value)}">${esc(o.label)}</button>`)
          .join("")}</div>`;
      } else {
        html += `<div class="mg-k">${esc(t("mgStateFree"))}</div><input class="mg-input" type="text" data-mg="value" value="${esc(d.value)}" autocomplete="off">`;
      }
    }
    html += `<div class="mg-k">${esc(d.kind === "change" ? t("mgForChange") : t("mgFor"))}</div>
      <div class="mg-seg wrap">${PRESET_FOR.map((s) => `<button type="button" class="${!d.forOwn.text && d.for_s === s ? "on" : ""}" data-mg="for" data-s="${s}">${esc(this.fmtDur(s))}</button>`).join("")}</div>
      <div class="mg-own"><span>${esc(t("mgOwnTime"))}</span>
        <input class="mg-pill num mg-ownin" type="text" inputmode="decimal" data-mg="for-own" value="${esc(d.forOwn.text)}" placeholder="${esc(t("mgOwnPh"))}" aria-label="${esc(t("mgOwnTime"))}" autocomplete="off">
        <select class="mg-pill" data-mg="for-unit" aria-label="${esc(t("mgOwnTime"))}">${FOR_UNITS.map((u) => `<option value="${u}"${u === d.forOwn.unit ? " selected" : ""}>${esc(t(`mgUnit_${u}`))}</option>`).join("")}</select></div>
      <div data-mg-zone="forhint">${this.forHintHtml()}</div>
      <div data-mg-zone="hist">${this.histHtml()}</div>`;
    return html;
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

  chipsHtml(field) {
    const esc = (v) => this.esc(v);
    const vars = this.data.variables;
    const names = [...(vars[this.varGroup()] || []), ...vars.common];
    return `<div class="mg-chips">${names
      .map((n) => `<button type="button" class="${(vars[this.varGroup()] || []).includes(n) ? "sug" : ""}" data-mg="var" data-field="${field}" data-var="${esc(n)}" title="${esc(this.tt(`mgVar_${n}`))}">{${esc(n)}}</button>`)
      .join("")}</div>`;
  }

  step3Html() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    const e = this.entity(d.entity_id);
    const group = this.varGroup();
    return `<label class="mg-k" for="mg-message">${esc(t("mgMsgLabel"))}</label>
      <textarea id="mg-message" class="mg-text" rows="3" maxlength="${this.limit("text", 300)}" data-mg-text="message" placeholder="${esc(t("mgMsgPh"))}">${esc(d.message)}</textarea>
      <div class="mg-k">${esc(t("mgVarsFor", e?.name || "", t(`mgVarKind_${group}`)))}</div>${this.chipsHtml("message")}
      <p class="mg-hint">${esc(t(`mgVarHelp_${group}`))}</p>
      <div data-mg-zone="pv">${this.pvHtml()}</div>`;
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

  step4Html() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    const change = d.kind === "change";
    const targetSub = d.target || (String(this.data.default_target || "").startsWith("notify.") ? this.data.default_target : t("mgTargetNone"));
    let html = `<div class="mg-k">${esc(t("mgTarget"))}</div>
      <button type="button" class="mg-sel" data-mg="target-toggle" aria-expanded="${this.wiz.targetOpen}"><span>${esc(d.target ? this.niceTarget(d.target) : t("mgTargetDefault"))}<small>${esc(targetSub)}</small></span><span aria-hidden="true">${this.wiz.targetOpen ? "▴" : "▾"}</span></button>`;
    if (this.wiz.targetOpen) html += `<div class="mg-list" role="listbox">${this.targetListHtml()}</div>`;
    html += `<p class="mg-hint">${esc(t("mgTargetHint"))}</p>
      <div class="mg-optrow"><div>${esc(t("mgCritical"))}<small>${esc(t("mgCriticalHint"))}</small></div><label class="switch"><input type="checkbox" data-mg="critical"${d.critical ? " checked" : ""} aria-label="${esc(t("mgCritical"))}"><span></span></label></div>`;
    if (d.critical) {
      html += `<div class="mg-vol"><label class="mg-k" for="mg-volume">${esc(t("mgVolume"))}</label>
        <div class="mg-volrow"><input id="mg-volume" type="range" min="1" max="${VOLUME_MAX}" step="1" value="${d.critical_volume}" data-mg="volume" aria-valuetext="${esc(t("mgVolumeOf", d.critical_volume))}"><output class="mg-volval" for="mg-volume">${esc(t("mgVolumeOf", d.critical_volume))}</output></div>
        <p class="mg-hint">${esc(t("mgVolumeHint"))}</p></div>`;
    }
    if (change) {
      html += `<p class="mg-hint">${esc(t("mgChangeNote"))}</p>`;
    } else {
      html += `<div class="mg-k">${esc(t("mgRepeat"))}</div>
        <div class="mg-seg wrap">${PRESET_REPEAT.map((s) => `<button type="button" class="${!d.repeatOwn.text && d.repeat_s === s ? "on" : ""}" data-mg="repeat" data-s="${s}">${esc(s ? t(`mgRepeat_${s}`) : t("mgRepeatOnce"))}</button>`).join("")}</div>
        <div class="mg-own"><span>${esc(t("mgRepeatOwn"))}</span>
          <input class="mg-pill num mg-ownin" type="text" inputmode="decimal" data-mg="repeat-own" value="${esc(d.repeatOwn.text)}" placeholder="${esc(t("mgOwnPh"))}" aria-label="${esc(t("mgRepeatOwn"))}" autocomplete="off">
          <select class="mg-pill" data-mg="repeat-unit" aria-label="${esc(t("mgRepeatOwn"))}">${REPEAT_UNITS.map((u) => `<option value="${u}"${u === d.repeatOwn.unit ? " selected" : ""}>${esc(t(`mgUnit_${u}`))}</option>`).join("")}</select></div>
        <p class="mg-hint">${esc(t("mgRepeatOnceHint"))}</p>
        <div class="mg-optrow"><div>${esc(t("mgRecover"))}</div><label class="switch"><input type="checkbox" data-mg="recover"${d.recover ? " checked" : ""} aria-label="${esc(t("mgRecover"))}"><span></span></label></div>`;
      if (d.recover) {
        html += `<label class="mg-k" for="mg-recover">${esc(t("mgRecoverText"))}</label>
          <textarea id="mg-recover" class="mg-text" rows="2" maxlength="${this.limit("text", 300)}" data-mg-text="recover_message" placeholder="${esc(t("mgMsgPh"))}">${esc(d.recover_message)}</textarea>
          ${this.chipsHtml("recover_message")}`;
      }
    }
    return `${html}<div data-mg-zone="pv">${this.pvHtml()}</div>`;
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
    if (!this.root || !this.wiz) return;
    for (const name of only || ["chart", "hist", "pv", "forhint"]) {
      const el = this.root.querySelector(`[data-mg-zone="${name}"]`);
      if (!el) continue;
      if (name === "chart") el.innerHTML = this.chartHtml();
      else if (name === "hist") el.innerHTML = this.histHtml();
      else if (name === "forhint") el.innerHTML = this.forHintHtml();
      else el.innerHTML = this.pvHtml();
    }
  }

  // Diagramm der letzten 24 Stunden: Zahl als Linie mit Schwelle, Zustand als Balken.
  chartHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const w = this.wiz;
    const d = w.draft;
    const e = this.entity(d.entity_id);
    const hist = w.hist && !w.hist.loading ? w.hist : w.hist?.prev || null;
    if (!e || !hist || hist.failed || !hist.available || hist.empty) return "";
    const from = hist.start;
    const to = hist.end;
    const span = to - from || 1;
    const x = (ts) => Math.max(0, Math.min(100, ((ts - from) / span) * 100));
    const bands = (hist.intervals || []).filter(() => d.kind !== "change");
    if (e.kind === "number" && hist.points?.length > 1) {
      const limit = d.kind === "change" ? null : parseNumber(d.value);
      const ys = hist.points.map((p) => p[1]);
      const hi = Math.max(...ys, limit ?? -Infinity);
      const lo = Math.min(...ys, limit ?? Infinity);
      const W = 320;
      const H = 70;
      const y = (n) => H - 8 - ((n - lo) / (hi - lo || 1)) * (H - 16);
      const line = hist.points.map((p, i) => `${i ? "L" : "M"}${((x(p[0]) / 100) * W).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
      const zones = bands
        .map(([a, b, counts]) => `<rect x="${((x(a) / 100) * W).toFixed(1)}" y="0" width="${Math.max(1, ((x(b ?? to) - x(a)) / 100) * W).toFixed(1)}" height="${H}" fill="var(--dp-error)" opacity="${counts ? 0.2 : 0.08}"/>`)
        .join("");
      const lim = limit != null && Number.isFinite(limit) ? `<line x1="0" x2="${W}" y1="${y(limit).toFixed(1)}" y2="${y(limit).toFixed(1)}" stroke="var(--dp-error)" stroke-width="1.5" stroke-dasharray="5 4"/>` : "";
      const mid = limit != null ? t("mgChartThreshold", `${this.fmtNum(limit)}${e.unit ? ` ${e.unit}` : ""}`) : t("mgChartRange", this.fmtNum(lo), this.fmtNum(hi));
      return `<div class="mg-card"><svg class="mg-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(t("mgHistTitle"))}">${zones}<path d="${line}" fill="none" stroke="var(--dp-primary)" stroke-width="2" vector-effect="non-scaling-stroke"/>${lim}</svg>
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
  pvHtml() {
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
    let html = card(w.pv.main, t("mgPvNote"), "main");
    if (w.step >= 4 && w.draft.recover && w.draft.kind !== "change") html += card(w.pv.recover, t("mgPvNoteRecover"), "recover");
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

  bind(dlg) {
    dlg.addEventListener("click", (ev) => this.onClick(ev));
    dlg.addEventListener("input", (ev) => this.onInput(ev));
    dlg.addEventListener("change", (ev) => this.onChange(ev));
    dlg.addEventListener("keydown", (ev) => this.onKey(ev));
    // Variablen einfügen, ohne dass das Textfeld den Fokus (und die Tastatur) verliert.
    dlg.addEventListener("mousedown", (ev) => {
      if (ev.target.closest?.('[data-mg="var"]')) ev.preventDefault();
    });
  }

  onClick(ev) {
    const el = ev.target.closest?.("[data-mg]");
    if (!el || !this.root?.contains(el) || el.disabled) return;
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
        this.closeWizard();
        break;
      case "back":
        this.goto(this.wiz.step - 1);
        break;
      case "next":
        this.goto(this.wiz.step + 1);
        break;
      case "goto":
        this.goto(Number(el.dataset.step));
        break;
      case "save":
        this.save();
        break;
      case "pick":
        this.pickEntity(id);
        break;
      case "kind":
        this.setKind(el.dataset.kind);
        break;
      case "state":
        this.wiz.draft.value = el.dataset.v;
        this.syncDefaults();
        this.paint();
        this.requestHistory();
        this.requestPreview();
        break;
      case "step":
        this.stepValue(Number(el.dataset.dir));
        break;
      case "for":
        this.setForSeconds(Number(el.dataset.s));
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
        this.insertVariable(el.dataset.field, el.dataset.var);
        break;
      case "test":
        this.sendTest(el.dataset.which);
        break;
      default:
    }
  }

  insertVariable(field, name) {
    const ta = this.root.querySelector(`textarea[data-mg-text="${field}"]`);
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
    if (field === "message") d.messageTouched = true;
    else d.recoverTouched = true;
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
    if (!this.wiz || !this.root?.contains(el)) return;
    if (el.dataset.mgText) this.onText(el);
    else if (action === "value") this.setValue(el.value, true);
    else if (action === "for-own") {
      this.wiz.draft.forOwn.text = el.value;
      this.applyOwnFor();
    } else if (action === "repeat-own") {
      this.wiz.draft.repeatOwn.text = el.value;
      this.applyOwnRepeat();
    } else if (action === "volume") {
      const level = Math.min(Math.max(Number(el.value) || 1, 1), VOLUME_MAX);
      this.wiz.draft.critical_volume = level;
      const out = this.root.querySelector(".mg-volval");
      if (out) out.textContent = this.t("mgVolumeOf", level);
      el.setAttribute("aria-valuetext", this.t("mgVolumeOf", level));
    } else if (action === "name") {
      this.wiz.draft.name = el.value;
      this.wiz.draft.nameTouched = true;
      this.syncNav();
      const title = this.root.querySelector(".mg-card .mg-t b");
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
    } else if (action === "repeat-unit") {
      d.repeatOwn.unit = Number(el.value);
      this.applyOwnRepeat();
    } else if (action === "critical") {
      d.critical = el.checked;
      this.paint();
      this.paintZones(["pv"]);
    } else if (action === "recover") {
      d.recover = el.checked;
      if (d.recover && !d.recover_message) d.recover_message = this.defaultRecover(d);
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
