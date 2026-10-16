/**
 * Routine mit Auslöser (seit 2.54.0, docs/mockups/timer-trigger-v1 und timer-trigger-v2): Eine Routine schaltet statt zu einer Uhrzeit
 * durch Bedingungen auf beliebigen Entitäten, und auch das Zurückschalten kann durch eine Uhrzeit oder einen Auslöser geschehen.
 * Die Bedingungen sind dieselben wie bei Magic Push (über, unter, ist, ändert sich; Und/Oder mit einer Ebene Gruppen).
 *
 * Diese Datei hängt ihre Methoden an die Klasse RoutineUi (routines.js): Bedingungs-Editor, Seiten "Wann: Auslöser" und "Zurückschalten",
 * Satz der Bedingungen. Wer sie lädt, ist routines.js (mit derselben Versionsnummer wie das Panel, damit der Zwischenspeicher
 * des Browsers nicht eine alte Datei liefert).
 */

let seq = 0;
const uid = () => `c${++seq}`;

export const HOLD_PRESETS = [0, 30, 120, 300];
export const PAUSE_PRESETS = [60, 300, 900, 3600];
export const MAX_PRESETS = [1800, 3600, 7200, 21600];
// Freie Zeit neben den Schnellwahlen (seit 2.59.0): Feld mit Einheit, wie bei "Nach Dauer". Je Angabe der Wert im Entwurf, das Feld, die Einheiten,
// die Grenzen und der Wert ohne Angabe. Die Pause darf nicht unter die kleinste Schnellwahl (1 Min.) fallen; bei den anderen gilt, was der Server erlaubt.
const FREE = {
  hold: { sel: '[data-rt="hold"][data-w="start"]', val: "holdS", own: "holdOwn", presets: HOLD_PRESETS, units: [1, 60, 3600], lo: () => 1, hi: (ui) => ui.limit("hold_max", 604800), def: 0 },
  bhold: { sel: '[data-rt="hold"][data-w="back"]', val: "backHoldS", own: "backHoldOwn", presets: HOLD_PRESETS, units: [1, 60, 3600], lo: () => 1, hi: (ui) => ui.limit("hold_max", 604800), def: 0 },
  pause: { sel: '[data-rt="pause"]', val: "pauseS", own: "pauseOwn", presets: PAUSE_PRESETS, units: [60, 3600], lo: () => PAUSE_PRESETS[0], hi: (ui) => ui.limit("pause_max", 86400), def: 60 },
  bmax: { sel: '[data-rt="bmax"]', val: "backMaxS", own: "backMaxOwn", presets: MAX_PRESETS, units: [60, 3600, 86400], lo: (ui) => ui.limit("back_min", 10), hi: (ui) => ui.limit("back_max", 604800), def: 7200 },
};
const noOwn = () => ({ text: "", unit: 60 });
// Ein Wert, der keine Schnellwahl ist, steht beim Bearbeiten im Feld (in der grössten Einheit, die ihn ohne Rest teilt)
function ownFor(seconds, f) {
  if (!seconds || f.presets.includes(seconds)) return noOwn();
  for (const u of [...f.units].reverse()) if (seconds >= u && seconds % u === 0) return { text: String(seconds / u), unit: u };
  return { text: String(Math.round(seconds / f.units[0])), unit: f.units[0] };
}
const LEAF_MAX = 10;
const GROUP_MAX = 4;
const ICONS = { binary_sensor: "🔘", sensor: "📈", switch: "🔌", light: "💡", cover: "🪟", lock: "🔒", climate: "🌡️", person: "👤", device_tracker: "📍", input_boolean: "🔘", media_player: "🔊", fan: "🌀", sun: "☀️" };
const CLASS_ICONS = { motion: "🏃", occupancy: "🏃", presence: "🏃", door: "🚪", window: "🚪", opening: "🚪", garage_door: "🚪", illuminance: "☀️", temperature: "🌡️", humidity: "💧", moisture: "💧", power: "⚡", energy: "⚡", battery: "🔋" };

// --- Bedingungsbaum -------------------------------------------------------------------------------

export const emptyTree = () => ({ op: "and", items: [] });
export const leavesOf = (tree) => (tree?.items || []).flatMap((i) => (i.items ? i.items : [i]));

// Vom Server in die Form des Assistenten (mit Kennung je Bedingung und Gruppe) und zurück
export function treeFromServer(tree) {
  return {
    op: tree?.op === "or" ? "or" : "and",
    items: (tree?.items || []).map((i) => (i.items ? { uid: uid(), op: i.op === "or" ? "or" : "and", items: i.items.map((l) => ({ uid: uid(), ...leafPlain(l) })) } : { uid: uid(), ...leafPlain(i) })),
  };
}
const leafPlain = (l) => ({ entity_id: l.entity_id, kind: l.kind, value: l.value ?? "" });
export function treeToServer(tree) {
  const leaf = (l) => ({ entity_id: l.entity_id, kind: l.kind, value: l.kind === "above" || l.kind === "below" ? Number(l.value) : l.kind === "is" ? (Number.isFinite(Number(l.value)) && String(l.value).trim() !== "" ? l.value : String(l.value)) : null });
  return { op: tree.op, items: tree.items.map((i) => (i.items ? { op: i.op, items: i.items.map(leaf) } : leaf(i))) };
}

export function triggerDefaults() {
  return { conds: emptyTree(), holdS: 0, winOn: false, winFrom: "22:00", winTo: "06:00", pauseS: 60, onceTrig: false, backKind: "none", backTime: "23:30", backConds: emptyTree(), backHoldS: 0, backMaxOn: false, backMaxS: 7200, holdOwn: noOwn(), backHoldOwn: noOwn(), pauseOwn: noOwn(), backMaxOwn: noOwn() };
}

export function triggerFromRoutine(rt) {
  return {
    conds: rt.conditions ? treeFromServer(rt.conditions) : emptyTree(),
    holdS: rt.hold_s || 0,
    winOn: Boolean(rt.window),
    winFrom: rt.window?.from || "22:00",
    winTo: rt.window?.to || "06:00",
    pauseS: rt.pause_s || 60,
    onceTrig: Boolean(rt.once_trigger),
    backKind: rt.back_kind || (rt.back_s ? "duration" : "none"),
    backTime: rt.back_time || "23:30",
    backConds: rt.back_conditions ? treeFromServer(rt.back_conditions) : emptyTree(),
    backHoldS: rt.back_hold_s || 0,
    backMaxOn: Boolean(rt.back_max_s),
    backMaxS: rt.back_max_s || 7200,
    holdOwn: ownFor(rt.hold_s, FREE.hold),
    backHoldOwn: ownFor(rt.back_hold_s, FREE.bhold),
    pauseOwn: ownFor(rt.pause_s, FREE.pause),
    backMaxOwn: ownFor(rt.back_max_s, FREE.bmax),
  };
}

export function triggerPayload(d) {
  const trig = d.kind === "trigger";
  const back = d.backKind;
  return {
    conditions: trig ? treeToServer(d.conds) : null,
    hold_s: trig ? d.holdS : 0,
    window: trig && d.winOn ? { from: d.winFrom, to: d.winTo } : null,
    pause_s: d.pauseS,
    once_trigger: trig && d.onceTrig,
    back_kind: back,
    back_time: back === "time" ? d.backTime : null,
    back_conditions: back === "trigger" ? treeToServer(d.backConds) : null,
    back_hold_s: back === "trigger" ? d.backHoldS : 0,
    back_max_s: back === "trigger" && d.backMaxOn ? d.backMaxS : null,
  };
}

const sole = (tree) => leavesOf(tree).length === 1;
function leafValid(leaf, tree) {
  if (!leaf.entity_id) return false;
  if (leaf.kind === "above" || leaf.kind === "below") return String(leaf.value).trim() !== "" && Number.isFinite(Number(String(leaf.value).replace(",", ".")));
  if (leaf.kind === "is") return String(leaf.value).trim() !== "";
  return leaf.kind === "change" && sole(tree);
}
export const treeValid = (tree) => leavesOf(tree).length > 0 && leavesOf(tree).every((l) => leafValid(l, tree));

// --- Methoden für RoutineUi ---------------------------------------------------------------------------

export const triggerMethods = {
  // Angaben zu Entitäten (Name, Art, Einheit, Zustände) aus dem Server (Routinen-Liste, Suche) für Sätze und Karten
  learnEnts(list) {
    this._ents ||= {};
    for (const e of Array.isArray(list) ? list : Object.values(list || {})) if (e?.entity_id) this._ents[e.entity_id] = e;
  },

  entDesc(id) {
    return this._ents?.[id] || null;
  },

  entIcon(e) {
    return CLASS_ICONS[e?.device_class] || ICONS[e?.domain] || "🔹";
  },

  // Zustand der Entität als Wort ("Bewegung erkannt") zu einem Wert ("on")
  stateLabel(e, value) {
    const hit = (e?.options || []).find((o) => String(o.value) === String(value));
    return hit ? hit.label : String(value ?? "");
  },

  // Eine Bedingung als Satzteil; ohne Namen nur der Teil nach der Entität ("über 20 lx")
  leafText(leaf, withName = true) {
    const t = (k, ...a) => this.t(k, ...a);
    const e = this.entDesc(leaf.entity_id);
    const name = withName ? e?.name || leaf.entity_id : "";
    let text;
    if (leaf.kind === "change") text = t("rtCondSentChange", name);
    else if (leaf.kind === "above" || leaf.kind === "below") {
      const unit = e?.unit ? ` ${e.unit}` : "";
      text = t(leaf.kind === "above" ? "rtCondSentAbove" : "rtCondSentBelow", name, `${this.fmtNum(Number(String(leaf.value).replace(",", ".")))}${unit}`);
    } else text = t("rtCondSentIs", name, this.stateLabel(e, leaf.value));
    return text.trim();
  },

  // Der ganze Baum als Satz: "Bewegung Bad ist Bewegung und (Helligkeit unter 20 lx oder Tür ist offen)"
  treeText(tree) {
    const t = (k, ...a) => this.t(k, ...a);
    const node = (n, nested) => {
      const parts = n.items.map((i) => (i.items ? node(i, true) : this.leafText(i)));
      const text = parts.join(` ${t(n.op === "or" ? "rtCondOr" : "rtCondAnd")} `);
      return nested && parts.length > 1 ? `(${text})` : text;
    };
    return tree?.items?.length ? node(tree, false) : "";
  },

  cstate(which) {
    const w = this.wiz;
    w.cond ||= {};
    w.cond[which] ||= { cur: null, add: null, query: "", results: null, loading: false, error: "" };
    return w.cond[which];
  },

  treeOf(which) {
    const d = this.wiz.draft;
    return which === "back" ? d.backConds : d.conds;
  },

  // --- Bedingungs-Editor ---------------------------------------------------------------------------

  condEditorHtml(which) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const tree = this.treeOf(which);
    const c = this.cstate(which);
    const leaves = leavesOf(tree);
    let html = "";
    if (leaves.length >= 2) {
      html += this.tabsHtml([
        { on: tree.op === "and", attrs: `data-rt="c-op" data-w="${which}" data-v="and"`, label: t("rtCondOpAnd") },
        { on: tree.op === "or", attrs: `data-rt="c-op" data-w="${which}" data-v="or"`, label: t("rtCondOpOr") },
      ]);
      html += `<div class="mg-sumline"><b>${esc(t("rtCondWhen"))}</b> ${esc(this.treeText(tree))}</div>`;
    }
    tree.items.forEach((item, i) => {
      if (i) html += `<div class="mg-join">${esc(t(tree.op === "or" ? "rtCondOr" : "rtCondAnd"))}</div>`;
      html += item.items ? this.groupHtml(which, item) : this.leafHtml(which, item);
    });
    if (c.add) return `${html}${this.pickerHtml(which)}`;
    if (leaves.length === 1 && leaves[0].kind === "change") return html;
    if (leaves.length >= LEAF_MAX) return `${html}<p class="mg-hint">${esc(t("rtCondLimit", LEAF_MAX))}</p>`;
    html += `<div class="mg-adds"><button type="button" class="mg-add" data-rt="c-add" data-w="${which}">${this.h.mdi("plus", 18)}${esc(t("rtCondAdd"))}</button>`;
    if (tree.items.filter((i) => i.items).length < GROUP_MAX && leaves.length) html += `<button type="button" class="mg-add" data-rt="c-addgroup" data-w="${which}">${this.h.mdi("plus", 18)}${esc(t("rtCondAddGroup"))}</button>`;
    return `${html}</div>`;
  },

  groupHtml(which, g) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const tabs = this.tabsHtml(
      [
        { on: g.op === "and", attrs: `data-rt="c-gop" data-w="${which}" data-group="${esc(g.uid)}" data-uid="${esc(g.uid)}" data-v="and"`, label: t("rtCondGroupAll") },
        { on: g.op === "or", attrs: `data-rt="c-gop" data-w="${which}" data-group="${esc(g.uid)}" data-uid="${esc(g.uid)}" data-v="or"`, label: t("rtCondGroupAny") },
      ],
      "mg-mini"
    );
    const inner = g.items.map((lf, i) => `${i ? `<div class="mg-join">${esc(t(g.op === "or" ? "rtCondOr" : "rtCondAnd"))}</div>` : ""}${this.leafHtml(which, lf)}`).join("");
    const full = leavesOf(this.treeOf(which)).length >= LEAF_MAX;
    return `<div class="mg-group"><div class="mg-ghead"><b>${esc(t("rtCondGroup"))}</b>${tabs}
      <button type="button" class="mg-xbtn" data-rt="c-gdel" data-w="${which}" data-uid="${esc(g.uid)}" title="${esc(t("rtCondRemoveGroup"))}" aria-label="${esc(t("rtCondRemoveGroup"))}">${this.h.mdi("close", 22)}</button></div>
      ${inner}${full ? "" : `<button type="button" class="linkbtn mg-addin" data-rt="c-addin" data-w="${which}" data-uid="${esc(g.uid)}">${esc(t("rtCondAddIn"))}</button>`}</div>`;
  },

  leafHtml(which, lf) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const e = this.entDesc(lf.entity_id);
    const open = this.cstate(which).cur === lf.uid;
    const tree = this.treeOf(which);
    const now = e ? this.entValue(e) : "";
    const sub = [leafValid(lf, tree) ? this.leafText(lf, false) : t("rtCondIncomplete"), now ? t("rtCondNow", now) : ""].filter(Boolean).join(" · ");
    return `<div class="mg-lcard${open ? " open" : ""}"><div class="mg-lhead">
      <button type="button" class="mg-lmain" data-rt="c-open" data-w="${which}" data-uid="${esc(lf.uid)}" aria-expanded="${open}"><span class="mg-ic" aria-hidden="true">${this.entIcon(e)}</span>
        <span class="mg-t"><b>${esc(e?.name || lf.entity_id)}</b><small>${esc(sub)}</small></span>${this.chevHtml(open)}</button>
      <button type="button" class="mg-xbtn" data-rt="c-del" data-w="${which}" data-uid="${esc(lf.uid)}" title="${esc(t("rtCondRemove"))}" aria-label="${esc(t("rtCondRemove"))}">${this.h.mdi("close", 22)}</button></div>
      ${open ? this.leafEditorHtml(which, lf, e) : ""}</div>`;
  },

  entValue(e) {
    if (!e) return "";
    if (!e.available) return this.t("rtUnreachable");
    return e.kind === "number" && e.unit ? `${e.value} ${e.unit}` : String(e.value ?? "");
  },

  leafEditorHtml(which, lf, e) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    if (!e) return "";
    let kinds = e.kind === "number" ? [["above", "rtCondKindAbove"], ["below", "rtCondKindBelow"], ["is", "rtCondKindIs"]] : [["is", "rtCondKindIsState"]];
    if (sole(this.treeOf(which))) kinds = [...kinds, ["change", "rtCondKindChange"]];
    let html = `<div class="mg-ledit">${this.tabsHtml(kinds.map(([k, label]) => ({ on: lf.kind === k, attrs: `data-rt="c-kind" data-w="${which}" data-uid="${esc(lf.uid)}" data-group="${esc(lf.uid)}" data-kind="${k}"`, label: t(label) })))}`;
    if (lf.kind === "above" || lf.kind === "below" || (lf.kind === "is" && e.kind === "number")) {
      html += `<div class="mg-k">${esc(t("rtCondThreshold"))}${e.unit ? ` <span class="mg-unit">· ${esc(e.unit)}</span>` : ""}</div>
        <div class="sub-tabs mg-tabs mg-stepper"><button type="button" class="sub-tab" data-rt="c-step" data-w="${which}" data-uid="${esc(lf.uid)}" data-dir="-1" aria-label="${esc(t("rtCondMinus"))}">−</button>
        <input class="mg-valin" type="text" inputmode="decimal" data-rt="c-value" data-w="${which}" data-uid="${esc(lf.uid)}" value="${esc(lf.value)}" aria-label="${esc(t("rtCondThreshold"))}" autocomplete="off">
        <button type="button" class="sub-tab" data-rt="c-step" data-w="${which}" data-uid="${esc(lf.uid)}" data-dir="1" aria-label="${esc(t("rtCondPlus"))}">+</button></div>`;
    } else if (lf.kind === "is") {
      if (e.options?.length) {
        html += `<div class="mg-k">${esc(t("rtCondPickState"))}</div>${this.tabsHtml(e.options.map((o) => ({ on: String(lf.value) === String(o.value), attrs: `data-rt="c-state" data-w="${which}" data-uid="${esc(lf.uid)}" data-group="${esc(lf.uid)}s" data-v="${esc(o.value)}"`, label: o.label })))}`;
      } else {
        html += `<div class="mg-k">${esc(t("rtCondStateFree"))}</div><input class="mg-input" type="text" data-rt="c-value" data-w="${which}" data-uid="${esc(lf.uid)}" value="${esc(lf.value)}" autocomplete="off">`;
      }
    }
    html += `<button type="button" class="linkbtn mg-chgent" data-rt="c-ent" data-w="${which}" data-uid="${esc(lf.uid)}">${esc(t("rtCondChangeEntity"))}</button></div>`;
    return html;
  },

  // Auswahl der Entität für eine neue (oder zu ändernde) Bedingung: Suche in allen Entitäten
  pickerHtml(which) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const c = this.cstate(which);
    return `<div class="mg-free"><div class="mg-k">${esc(t("rtCondPickTitle"))}</div>
      <label class="list-search">${this.h.mdi("search", 18)}<input type="search" data-rt="c-search" data-w="${which}" value="${esc(c.query)}" placeholder="${esc(t("rtCondSearch"))}" aria-label="${esc(t("rtCondSearch"))}" autocomplete="off">${this.host._fieldClearHtml("data-fc", "", c.query)}</label>
      <div data-rt-zone="cpick-${which}">${this.pickListHtml(which)}</div>
      <button type="button" class="linkbtn" data-rt="c-cancel" data-w="${which}">${esc(t("rtCancel"))}</button></div>`;
  },

  pickListHtml(which) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const c = this.cstate(which);
    if (c.error) return `<div class="opt-error">${esc(c.error)}</div>`;
    if (c.loading && !c.results) return `<p class="mg-hint">${esc(t("rtCondSearching"))}</p>`;
    if (!c.results?.length) return `<p class="mg-hint">${esc(t("rtCondSearchNone"))}</p>`;
    return `<div class="mg-list" role="listbox">${c.results
      .map(
        (e) => `<button type="button" class="mg-opt-row" role="option" data-rt="c-pick" data-w="${which}" data-id="${esc(e.entity_id)}"><span><b>${this.entIcon(e)} ${esc(e.name)}</b><br><small>${esc([e.entity_id, e.device_name].filter(Boolean).join(" · "))}</small></span><span class="mg-freeval">${esc(this.entValue(e))}</span></button>`
      )
      .join("")}</div>`;
  },

  searchEnts(which, query) {
    const w = this.wiz;
    const c = this.cstate(which);
    window.clearTimeout(this._cTimer);
    c.loading = true;
    this._cTimer = window.setTimeout(async () => {
      const seq2 = (this._cSeq = (this._cSeq || 0) + 1);
      try {
        const r = await this.call({ type: "device_panel/magic_entity_search", query });
        if (seq2 !== this._cSeq || this.wiz !== w) return;
        c.results = r.entities;
        c.error = "";
        this.learnEnts(r.entities);
      } catch (err) {
        if (seq2 !== this._cSeq || this.wiz !== w) return;
        c.error = this.h.errText(err);
      }
      c.loading = false;
      const zone = this.q(`[data-rt-zone="cpick-${which}"]`);
      if (zone) zone.innerHTML = this.pickListHtml(which);
    }, query ? 250 : 0);
  },

  findNode(tree, id) {
    for (const item of tree.items) {
      if (item.uid === id) return { node: item, parent: tree };
      if (item.items) {
        const hit = item.items.find((l) => l.uid === id);
        if (hit) return { node: hit, parent: item };
      }
    }
    return null;
  },

  // Neue Bedingung zur gewählten Entität: Zahl "über" dem jetzigen Wert, Zustand "ist" der andere als der jetzige
  newLeaf(e) {
    if (e.kind === "number") return { uid: uid(), entity_id: e.entity_id, kind: "above", value: e.number ?? 0 };
    const other = (e.options || []).find((o) => String(o.value) !== String(e.state));
    return { uid: uid(), entity_id: e.entity_id, kind: "is", value: other?.value ?? e.options?.[0]?.value ?? "" };
  },

  // Klicks des Bedingungs-Editors; true, wenn behandelt
  onTriggerClick(el) {
    const w = this.wiz;
    const rt = el.dataset.rt;
    if (!w || (!rt?.startsWith("c-") && !["whenmode", "backkind", "hold", "pause", "bmax"].includes(rt))) return false;
    const d = w.draft;
    const which = el.dataset.w;
    switch (rt) {
      case "whenmode":
        d.kind = el.dataset.v === "trigger" ? "trigger" : d.kind === "trigger" ? "repeat" : d.kind;
        this.paint();
        this.requestPreview();
        return true;
      case "backkind":
        d.backKind = el.dataset.v;
        if (d.backKind === "duration" && !d.back_s) d.back_s = 1800;
        if (d.backKind !== "duration") d.back_s = 0;
        this.paint();
        this.requestPreview();
        return true;
      case "hold":
        this.pickFree(which === "back" ? "bhold" : "hold", Number(el.dataset.s));
        return true;
      case "pause":
        this.pickFree("pause", Number(el.dataset.s));
        return true;
      case "bmax":
        this.pickFree("bmax", Number(el.dataset.s));
        return true;
      default:
    }
    const tree = this.treeOf(which);
    const c = this.cstate(which);
    const id = el.dataset.uid;
    switch (rt) {
      case "c-add":
        c.add = { group: null, change: null };
        c.query = "";
        c.results = null;
        this.paint();
        this.searchEnts(which, "");
        break;
      case "c-addin":
        c.add = { group: id, change: null };
        c.query = "";
        c.results = null;
        this.paint();
        this.searchEnts(which, "");
        break;
      case "c-ent": {
        c.add = { group: null, change: id };
        c.query = "";
        c.results = null;
        this.paint();
        this.searchEnts(which, "");
        break;
      }
      case "c-cancel":
        c.add = null;
        tree.items = tree.items.filter((i) => !i.items || i.items.length);
        this.paint();
        break;
      case "c-addgroup": {
        const g = { uid: uid(), op: "or", items: [] };
        tree.items.push(g);
        c.add = { group: g.uid, change: null };
        c.query = "";
        c.results = null;
        this.paint();
        this.searchEnts(which, "");
        break;
      }
      case "c-pick": {
        const e = this.entDesc(el.dataset.id);
        if (!e || !c.add) break;
        if (c.add.change) {
          const hit = this.findNode(tree, c.add.change);
          if (hit) Object.assign(hit.node, this.newLeaf(e), { uid: hit.node.uid });
          c.cur = c.add.change;
        } else {
          const leaf = this.newLeaf(e);
          if (c.add.group) this.findNode(tree, c.add.group)?.node.items.push(leaf);
          else tree.items.push(leaf);
          c.cur = leaf.uid;
        }
        c.add = null;
        this.afterCond();
        break;
      }
      case "c-open":
        c.cur = c.cur === id ? null : id;
        this.paint();
        break;
      case "c-del": {
        const hit = this.findNode(tree, id);
        if (hit) {
          hit.parent.items.splice(hit.parent.items.indexOf(hit.node), 1);
          // Eine leere Gruppe fällt weg
          tree.items = tree.items.filter((i) => !i.items || i.items.length);
        }
        if (c.cur === id) c.cur = null;
        this.afterCond();
        break;
      }
      case "c-gdel":
        tree.items = tree.items.filter((i) => i.uid !== id);
        this.afterCond();
        break;
      case "c-op":
        tree.op = el.dataset.v;
        this.afterCond();
        break;
      case "c-gop": {
        const hit = this.findNode(tree, id);
        if (hit) hit.node.op = el.dataset.v;
        this.afterCond();
        break;
      }
      case "c-kind": {
        const hit = this.findNode(tree, id);
        if (hit) {
          hit.node.kind = el.dataset.kind;
          const e = this.entDesc(hit.node.entity_id);
          if (hit.node.kind === "is" && e?.kind !== "number" && !hit.node.value) hit.node.value = e?.options?.[0]?.value ?? "";
          if ((hit.node.kind === "above" || hit.node.kind === "below") && !Number.isFinite(Number(hit.node.value))) hit.node.value = e?.number ?? 0;
        }
        this.afterCond();
        break;
      }
      case "c-state": {
        const hit = this.findNode(tree, id);
        if (hit) hit.node.value = el.dataset.v;
        this.afterCond();
        break;
      }
      case "c-step": {
        const hit = this.findNode(tree, id);
        if (hit) {
          const cur = Number(String(hit.node.value).replace(",", ".")) || 0;
          const step = Number.isInteger(cur) && Math.abs(cur) >= 10 ? 1 : 0.5;
          hit.node.value = Math.round((cur + Number(el.dataset.dir) * step) * 100) / 100;
        }
        this.afterCond();
        break;
      }
      default:
        return false;
    }
    return true;
  },

  afterCond() {
    this.wiz.tried = null;
    this.paint();
    this.requestPreview();
  },

  onTriggerInput(el) {
    const rt = el.dataset.rt;
    if (!this.wiz) return false;
    const d = this.wiz.draft;
    switch (rt) {
      case "c-search": {
        const c = this.cstate(el.dataset.w);
        c.query = el.value;
        this.searchEnts(el.dataset.w, el.value.trim());
        return true;
      }
      case "c-value": {
        const hit = this.findNode(this.treeOf(el.dataset.w), el.dataset.uid);
        if (hit) hit.node.value = el.value;
        this.paintZones([`csum-${el.dataset.w}`]);
        this.syncNav();
        this.requestPreview();
        return true;
      }
      case "hold-own":
      case "bhold-own":
      case "pause-own":
      case "bmax-own":
        this.typeFree(rt.slice(0, -4), el.value);
        return true;
      case "win-from":
        d.winFrom = el.value;
        this.paintZones(["winerr"]);
        this.syncNav();
        this.requestPreview();
        return true;
      case "win-to":
        d.winTo = el.value;
        this.paintZones(["winerr"]);
        this.syncNav();
        this.requestPreview();
        return true;
      case "back-time":
        d.backTime = el.value;
        this.syncNav();
        this.requestPreview();
        return true;
      default:
        return false;
    }
  },

  onTriggerChange(el) {
    if (!this.wiz) return false;
    const d = this.wiz.draft;
    switch (el.dataset.rt) {
      case "hold-unit":
      case "bhold-unit":
      case "pause-unit":
      case "bmax-unit":
        this.unitFree(el.dataset.rt.slice(0, -5), Number(el.value));
        return true;
      case "win-on":
        d.winOn = el.checked;
        this.paint();
        this.syncNav();
        this.requestPreview();
        return true;
      case "once-trig":
        d.onceTrig = el.checked;
        this.paint();
        return true;
      case "bmax-on":
        d.backMaxOn = el.checked;
        this.paint();
        this.requestPreview();
        return true;
      case "c-value":
        // Kein Neuzeichnen: der Wechsel des Fokus würde sonst den Knopf unter dem Zeiger ersetzen und den Klick verschlucken
        return true;
      default:
        return false;
    }
  },

  // --- Seiten --------------------------------------------------------------------------------------

  holdHtml(which) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    const value = which === "back" ? d.backHoldS : d.holdS;
    const tree = this.treeOf(which);
    if (leavesOf(tree).length === 1 && leavesOf(tree)[0].kind === "change") return "";
    const key = which === "back" ? "bhold" : "hold";
    const own = d[FREE[key].own];
    return `<div class="mg-k">${esc(t("rtHoldLabel"))}</div>${this.tabsHtml(HOLD_PRESETS.map((s) => ({ on: !own.text && value === s, attrs: `data-rt="hold" data-w="${which}" data-group="${which}" data-s="${s}"`, label: s ? this.fmtDur(s) : t("rtHoldNow") })))}${this.freeHtml(key)}`;
  },

  // Seite "Wann", Teil Auslöser: Bedingungen, Dauer, Zeitfenster, Pause, nur einmal
  triggerPageHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    let html = `<p class="mg-note">${esc(t("rtTrigNote"))}</p><div class="mg-k rt-sec">${esc(t("rtTrigWhen"))}</div>${this.condEditorHtml("start")}`;
    if (!leavesOf(d.conds).length) return `${html}<p class="mg-hint">${esc(t("rtTrigNone"))}</p>`;
    html += `<div data-rt-zone="csum-start">${this.condSumHtml("start")}</div>`;
    html += this.holdHtml("start");
    html += `<div class="mg-k rt-sec">${esc(t("rtWinTitle"))}</div><p class="mg-hint">${esc(t("rtWinNote"))}</p>
      <div class="mg-optrow"><div>${esc(t("rtWinSwitch"))}</div><label class="switch"><input type="checkbox" data-rt="win-on"${d.winOn ? " checked" : ""} aria-label="${esc(t("rtWinSwitch"))}"><span></span></label></div>`;
    if (d.winOn) {
      html += `<div class="rt-winrange"><input class="mg-input rt-timein" type="time" data-rt="win-from" value="${esc(d.winFrom)}" aria-label="${esc(t("rtWinFrom"))}"><span>${esc(t("rtWinTo"))}</span><input class="mg-input rt-timein" type="time" data-rt="win-to" value="${esc(d.winTo)}" aria-label="${esc(t("rtWinTo"))}"></div>`;
      html += `<div data-rt-zone="winerr">${this.winErrHtml()}</div>`;
    }
    html += `<div class="mg-k rt-sec">${esc(t("rtPauseTitle"))}</div><p class="mg-hint">${esc(t("rtPauseNote"))}</p>${this.tabsHtml(PAUSE_PRESETS.map((s) => ({ on: !d.pauseOwn.text && d.pauseS === s, attrs: `data-rt="pause" data-s="${s}"`, label: this.fmtDur(s) })))}${this.freeHtml("pause")}`;
    html += `<div class="mg-optrow"><div>${esc(t("rtOnceTrig"))}<small>${esc(t("rtOnceTrigNote"))}</small></div><label class="switch"><input type="checkbox" data-rt="once-trig"${d.onceTrig ? " checked" : ""} aria-label="${esc(t("rtOnceTrig"))}"><span></span></label></div>`;
    return html;
  },

  // Satz zur einzelnen Bedingung; eigene Zone, damit das Tippen im Wertfeld ihn ohne Neuzeichnen nachführt
  condSumHtml(which) {
    const tree = this.treeOf(which);
    return leavesOf(tree).length === 1 ? `<div class="mg-sumline">${this.esc(this.t("rtCondSum", this.treeText(tree)))}</div>` : "";
  },

  // Freie Zeit (seit 2.59.0): Zeile mit Feld und Einheit unter den Schnellwahlen, darunter der Fehlertext (eigene Zone, damit das Tippen
  // das Feld nicht neu zeichnet)
  freeHtml(key) {
    const f = FREE[key];
    const t = (k, ...a) => this.t(k, ...a);
    return `${this.ownHtml(key, this.wiz.draft[f.own], t("rtOwnTime"), f.units)}<div data-rt-zone="ferr-${key}">${this.freeErrHtml(key)}</div>`;
  },

  freeError(key) {
    const f = FREE[key];
    const own = this.wiz.draft[f.own];
    if (!own.text.trim()) return "";
    const v = this.wiz.draft[f.val];
    const lo = f.lo(this);
    const hi = f.hi(this);
    return !Number.isFinite(v) || v < lo || v > hi ? this.t("rtFreeRange", this.fmtDur(lo), this.fmtDur(hi)) : "";
  },

  freeErrHtml(key) {
    const e = this.freeError(key);
    return e ? `<div class="opt-error">${this.esc(e)}</div>` : "";
  },

  // Schnellwahl gewählt: das Feld ist leer
  pickFree(key, seconds) {
    const d = this.wiz.draft;
    const f = FREE[key];
    d[f.val] = seconds;
    d[f.own] = { text: "", unit: d[f.own].unit };
    this.paint();
    if (key === "pause" || key === "bmax") this.requestPreview();
  },

  // Zeit getippt: keine Schnellwahl gilt mehr (die Kapsel verschwindet), der Fehlertext und der Satz laufen mit
  typeFree(key, text) {
    const d = this.wiz.draft;
    const f = FREE[key];
    d[f.own].text = text;
    d[f.val] = text.trim() === "" ? f.def : this.parseOwn(text, d[f.own].unit);
    // Feld geleert: es gilt wieder die Vorgabe, deren Kapsel neu gezeichnet wird (das Feld verliert dabei den Fokus)
    if (text.trim() === "") {
      this.paint();
      this.syncNav();
      this.requestPreview();
      return;
    }
    for (const b of this.qa(`${f.sel}.on`)) {
      b.classList.remove("on");
      b.setAttribute("aria-checked", "false");
    }
    this.paintZones([`ferr-${key}`, "backsum"]);
    this.syncNav();
    this.requestPreview();
  },

  unitFree(key, unit) {
    const d = this.wiz.draft;
    const f = FREE[key];
    d[f.own].unit = unit;
    if (d[f.own].text.trim() !== "") d[f.val] = this.parseOwn(d[f.own].text, unit);
    this.paint();
    this.requestPreview();
  },

  // Sind die Angaben dieser Schlüssel in Ordnung? (leer, solange kein eigener Wert getippt ist)
  freeOk(keys) {
    return keys.every((k) => !this.freeError(k));
  },

  winErrHtml() {
    const e = this.winError();
    return e ? `<div class="opt-error">${this.esc(e)}</div>` : "";
  },

  winError() {
    const d = this.wiz.draft;
    if (!d.winOn) return "";
    if (!/^\d{2}:\d{2}$/.test(d.winFrom || "") || !/^\d{2}:\d{2}$/.test(d.winTo || "")) return this.t("rtWinInvalid");
    return d.winFrom === d.winTo ? this.t("rtWinSame") : "";
  },

  // Ist der Entwurf noch unfertig (Bedingung fehlt, Wert leer, Zeitfenster ungültig)? Dann fragt das Panel den Server nicht,
  // sonst stünde "Bedingungen erwartet" schon beim ersten Wechsel zum Auslöser da, bevor jemand etwas eingeben konnte.
  draftIncomplete() {
    const d = this.wiz.draft;
    return (d.kind === "trigger" && (!treeValid(d.conds) || Boolean(this.winError()) || !this.freeOk(["hold", "pause"]))) || (d.backKind === "trigger" && (!treeValid(d.backConds) || !this.freeOk(d.backMaxOn ? ["bhold", "bmax"] : ["bhold"])));
  },

  // Geht der Schritt "Wann" mit einem Auslöser weiter?
  triggerValid() {
    const d = this.wiz.draft;
    return treeValid(d.conds) && !this.winError() && this.freeOk(["hold", "pause"]) && !this.wiz.pvError;
  },

  // Seite "Zurückschalten" (Schritt 6)
  backStepHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    const kinds = [["none", "rtBackKindNone"], ["duration", "rtBackKindDuration"], ["time", "rtBackKindTime"], ["trigger", "rtBackKindTrigger"]];
    let html = this.tabsHtml(kinds.map(([k, label]) => ({ on: d.backKind === k, attrs: `data-rt="backkind" data-v="${k}"`, label: t(label) })), "mg-two");
    if (d.backKind === "none") return `${html}<p class="mg-note">${esc(t("rtBackNoneNote"))}</p>`;
    if (d.backKind === "duration") {
      html += `<div class="mg-k">${esc(t("rtBackAfter"))}</div>
        ${this.tabsHtml(this.backPresets().map((s) => ({ on: !d.backOwn.text && d.back_s === s, attrs: `data-rt="bdur" data-s="${s}"`, label: this.fmtDur(s) })))}
        ${this.ownHtml("back", d.backOwn, t("rtOwnTime"))}
        ${this.backError() ? `<div class="opt-error" data-rt-err="back">${esc(this.backError())}</div>` : ""}`;
    } else if (d.backKind === "time") {
      html += `<div class="mg-k">${esc(t("rtBackTimeLabel"))}</div><input class="mg-input rt-timein" type="time" data-rt="back-time" value="${esc(d.backTime)}" aria-label="${esc(t("rtBackTimeLabel"))}"><p class="mg-hint">${esc(t("rtBackTimeNote"))}</p>`;
    } else {
      html += `<p class="mg-note">${esc(t("rtBackTrigNote"))}</p><div class="mg-k rt-sec">${esc(t("rtBackTrigWhen"))}</div>${this.condEditorHtml("back")}`;
      html += `<div data-rt-zone="csum-back">${this.condSumHtml("back")}</div>`;
      if (leavesOf(d.backConds).length) {
        html += this.holdHtml("back");
        html += `<div class="mg-k rt-sec">${esc(t("rtBackMaxTitle"))}</div><p class="mg-hint">${esc(t("rtBackMaxNote"))}</p>
          <div class="mg-optrow"><div>${esc(t("rtBackMaxSwitch"))}</div><label class="switch"><input type="checkbox" data-rt="bmax-on"${d.backMaxOn ? " checked" : ""} aria-label="${esc(t("rtBackMaxSwitch"))}"><span></span></label></div>`;
        if (d.backMaxOn) html += this.tabsHtml(MAX_PRESETS.map((s) => ({ on: !d.backMaxOwn.text && d.backMaxS === s, attrs: `data-rt="bmax" data-s="${s}"`, label: this.fmtDur(s) }))) + this.freeHtml("bmax");
      }
    }
    const e = this.entity(d.entity_id);
    if (e && d.action === "set") {
      // Nach "setzen" gibt es kein Gegenstück: Zurück geht nur auf den Wert von vorher
      if (d.backKind !== "none" && !(d.backKind === "trigger" && !leavesOf(d.backConds).length)) html += `<p class="mg-hint">${esc(t("rtBackSetNote"))}</p>`;
    } else if (e && !(d.backKind === "trigger" && !leavesOf(d.backConds).length)) {
      html += `<div class="mg-k">${esc(t("rtBackModeLabel"))}</div>${this.tabsHtml([["opposite", t(`rtAct_${this.actionKey(e.domain, this.opposite(d.action))}`)], ["restore", t("rtBackModeRestore")]].map(([k, label]) => ({ on: d.back_mode === k, attrs: `data-rt="bmode" data-v="${k}"`, label })))}`;
      if (d.back_mode === "restore") html += `<p class="mg-hint">${esc(t("rtBackModeNote"))}</p>`;
    }
    return `${html}<div data-rt-zone="backsum">${this.backSumHtml()}</div><div data-rt-zone="runs">${this.runsHtml()}</div>`;
  },

  // Der Satz zum Zurückschalten unter den Einstellungen ("Nach 20 Min. wieder aus."); eigene Zone, damit er beim Tippen mitläuft
  backSumHtml() {
    const sentence = this.backText(this.draftRt());
    return sentence ? `<div class="mg-sumline">${this.esc(sentence.charAt(0).toUpperCase() + sentence.slice(1))}.</div>` : "";
  },

  backValid() {
    const d = this.wiz.draft;
    if (d.backKind === "none") return true;
    if (d.backKind === "duration") return Boolean(d.back_s) && !this.backError();
    if (d.backKind === "time") return /^\d{2}:\d{2}$/.test(d.backTime || "");
    return treeValid(d.backConds) && this.freeOk(d.backMaxOn ? ["bhold", "bmax"] : ["bhold"]) && !this.wiz.pvError;
  },
};
