/**
 * Timer mit Auslöser (seit 2.54.0, docs/mockups/timer-trigger-v1 und timer-trigger-v2): Ein Timer schaltet statt zu einer Uhrzeit
 * durch Bedingungen auf beliebigen Entitäten, und auch das Zurückschalten kann durch eine Uhrzeit oder einen Auslöser geschehen.
 * Die Bedingungen sind dieselben wie bei Magic Push (über, unter, ist, ändert sich; Und/Oder mit einer Ebene Gruppen).
 *
 * Diese Datei hängt ihre Methoden an die Klasse TimerUi (timers.js): Bedingungs-Editor, Seiten "Wann: Auslöser" und "Zurückschalten",
 * Satz der Bedingungen. Wer sie lädt, ist timers.js (mit derselben Versionsnummer wie das Panel, damit der Zwischenspeicher
 * des Browsers nicht eine alte Datei liefert).
 */

let seq = 0;
const uid = () => `c${++seq}`;

export const HOLD_PRESETS = [0, 30, 120, 300];
export const PAUSE_PRESETS = [60, 300, 900, 3600];
export const MAX_PRESETS = [1800, 3600, 7200, 21600];
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
  return { conds: emptyTree(), holdS: 0, winOn: false, winFrom: "22:00", winTo: "06:00", pauseS: 60, onceTrig: false, backKind: "none", backTime: "23:30", backConds: emptyTree(), backHoldS: 0, backMaxOn: false, backMaxS: 7200 };
}

export function triggerFromTimer(tm) {
  return {
    conds: tm.conditions ? treeFromServer(tm.conditions) : emptyTree(),
    holdS: tm.hold_s || 0,
    winOn: Boolean(tm.window),
    winFrom: tm.window?.from || "22:00",
    winTo: tm.window?.to || "06:00",
    pauseS: tm.pause_s || 60,
    onceTrig: Boolean(tm.once_trigger),
    backKind: tm.back_kind || (tm.back_s ? "duration" : "none"),
    backTime: tm.back_time || "23:30",
    backConds: tm.back_conditions ? treeFromServer(tm.back_conditions) : emptyTree(),
    backHoldS: tm.back_hold_s || 0,
    backMaxOn: Boolean(tm.back_max_s),
    backMaxS: tm.back_max_s || 7200,
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

// --- Methoden für TimerUi ---------------------------------------------------------------------------

export const triggerMethods = {
  // Angaben zu Entitäten (Name, Art, Einheit, Zustände) aus dem Server (Timer-Liste, Suche) für Sätze und Karten
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
    if (leaf.kind === "change") text = t("tmCondSentChange", name);
    else if (leaf.kind === "above" || leaf.kind === "below") {
      const unit = e?.unit ? ` ${e.unit}` : "";
      text = t(leaf.kind === "above" ? "tmCondSentAbove" : "tmCondSentBelow", name, `${this.fmtNum(Number(String(leaf.value).replace(",", ".")))}${unit}`);
    } else text = t("tmCondSentIs", name, this.stateLabel(e, leaf.value));
    return text.trim();
  },

  // Der ganze Baum als Satz: "Bewegung Bad ist Bewegung und (Helligkeit unter 20 lx oder Tür ist offen)"
  treeText(tree) {
    const t = (k, ...a) => this.t(k, ...a);
    const node = (n, nested) => {
      const parts = n.items.map((i) => (i.items ? node(i, true) : this.leafText(i)));
      const text = parts.join(` ${t(n.op === "or" ? "tmCondOr" : "tmCondAnd")} `);
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
        { on: tree.op === "and", attrs: `data-tm="c-op" data-w="${which}" data-v="and"`, label: t("tmCondOpAnd") },
        { on: tree.op === "or", attrs: `data-tm="c-op" data-w="${which}" data-v="or"`, label: t("tmCondOpOr") },
      ]);
      html += `<div class="mg-sumline"><b>${esc(t("tmCondWhen"))}</b> ${esc(this.treeText(tree))}</div>`;
    }
    tree.items.forEach((item, i) => {
      if (i) html += `<div class="mg-join">${esc(t(tree.op === "or" ? "tmCondOr" : "tmCondAnd"))}</div>`;
      html += item.items ? this.groupHtml(which, item) : this.leafHtml(which, item);
    });
    if (c.add) return `${html}${this.pickerHtml(which)}`;
    if (leaves.length === 1 && leaves[0].kind === "change") return html;
    if (leaves.length >= LEAF_MAX) return `${html}<p class="mg-hint">${esc(t("tmCondLimit", LEAF_MAX))}</p>`;
    html += `<div class="mg-adds"><button type="button" class="mg-add" data-tm="c-add" data-w="${which}">${this.h.mdi("plus", 18)}${esc(t("tmCondAdd"))}</button>`;
    if (tree.items.filter((i) => i.items).length < GROUP_MAX && leaves.length) html += `<button type="button" class="mg-add" data-tm="c-addgroup" data-w="${which}">${this.h.mdi("plus", 18)}${esc(t("tmCondAddGroup"))}</button>`;
    return `${html}</div>`;
  },

  groupHtml(which, g) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const tabs = this.tabsHtml(
      [
        { on: g.op === "and", attrs: `data-tm="c-gop" data-w="${which}" data-group="${esc(g.uid)}" data-uid="${esc(g.uid)}" data-v="and"`, label: t("tmCondGroupAll") },
        { on: g.op === "or", attrs: `data-tm="c-gop" data-w="${which}" data-group="${esc(g.uid)}" data-uid="${esc(g.uid)}" data-v="or"`, label: t("tmCondGroupAny") },
      ],
      "mg-mini"
    );
    const inner = g.items.map((lf, i) => `${i ? `<div class="mg-join">${esc(t(g.op === "or" ? "tmCondOr" : "tmCondAnd"))}</div>` : ""}${this.leafHtml(which, lf)}`).join("");
    const full = leavesOf(this.treeOf(which)).length >= LEAF_MAX;
    return `<div class="mg-group"><div class="mg-ghead"><b>${esc(t("tmCondGroup"))}</b>${tabs}
      <button type="button" class="mg-xbtn" data-tm="c-gdel" data-w="${which}" data-uid="${esc(g.uid)}" title="${esc(t("tmCondRemoveGroup"))}" aria-label="${esc(t("tmCondRemoveGroup"))}">${this.h.mdi("close", 22)}</button></div>
      ${inner}${full ? "" : `<button type="button" class="linkbtn mg-addin" data-tm="c-addin" data-w="${which}" data-uid="${esc(g.uid)}">${esc(t("tmCondAddIn"))}</button>`}</div>`;
  },

  leafHtml(which, lf) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const e = this.entDesc(lf.entity_id);
    const open = this.cstate(which).cur === lf.uid;
    const tree = this.treeOf(which);
    const now = e ? this.entValue(e) : "";
    const sub = [leafValid(lf, tree) ? this.leafText(lf, false) : t("tmCondIncomplete"), now ? t("tmCondNow", now) : ""].filter(Boolean).join(" · ");
    return `<div class="mg-lcard${open ? " open" : ""}"><div class="mg-lhead">
      <button type="button" class="mg-lmain" data-tm="c-open" data-w="${which}" data-uid="${esc(lf.uid)}" aria-expanded="${open}"><span class="mg-ic" aria-hidden="true">${this.entIcon(e)}</span>
        <span class="mg-t"><b>${esc(e?.name || lf.entity_id)}</b><small>${esc(sub)}</small></span>${this.chevHtml(open)}</button>
      <button type="button" class="mg-xbtn" data-tm="c-del" data-w="${which}" data-uid="${esc(lf.uid)}" title="${esc(t("tmCondRemove"))}" aria-label="${esc(t("tmCondRemove"))}">${this.h.mdi("close", 22)}</button></div>
      ${open ? this.leafEditorHtml(which, lf, e) : ""}</div>`;
  },

  entValue(e) {
    if (!e) return "";
    if (!e.available) return this.t("tmUnreachable");
    return e.kind === "number" && e.unit ? `${e.value} ${e.unit}` : String(e.value ?? "");
  },

  leafEditorHtml(which, lf, e) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    if (!e) return "";
    let kinds = e.kind === "number" ? [["above", "tmCondKindAbove"], ["below", "tmCondKindBelow"], ["is", "tmCondKindIs"]] : [["is", "tmCondKindIsState"]];
    if (sole(this.treeOf(which))) kinds = [...kinds, ["change", "tmCondKindChange"]];
    let html = `<div class="mg-ledit">${this.tabsHtml(kinds.map(([k, label]) => ({ on: lf.kind === k, attrs: `data-tm="c-kind" data-w="${which}" data-uid="${esc(lf.uid)}" data-group="${esc(lf.uid)}" data-kind="${k}"`, label: t(label) })))}`;
    if (lf.kind === "above" || lf.kind === "below" || (lf.kind === "is" && e.kind === "number")) {
      html += `<div class="mg-k">${esc(t("tmCondThreshold"))}${e.unit ? ` <span class="mg-unit">· ${esc(e.unit)}</span>` : ""}</div>
        <div class="sub-tabs mg-tabs mg-stepper"><button type="button" class="sub-tab" data-tm="c-step" data-w="${which}" data-uid="${esc(lf.uid)}" data-dir="-1" aria-label="${esc(t("tmCondMinus"))}">−</button>
        <input class="mg-valin" type="text" inputmode="decimal" data-tm="c-value" data-w="${which}" data-uid="${esc(lf.uid)}" value="${esc(lf.value)}" aria-label="${esc(t("tmCondThreshold"))}" autocomplete="off">
        <button type="button" class="sub-tab" data-tm="c-step" data-w="${which}" data-uid="${esc(lf.uid)}" data-dir="1" aria-label="${esc(t("tmCondPlus"))}">+</button></div>`;
    } else if (lf.kind === "is") {
      if (e.options?.length) {
        html += `<div class="mg-k">${esc(t("tmCondPickState"))}</div>${this.tabsHtml(e.options.map((o) => ({ on: String(lf.value) === String(o.value), attrs: `data-tm="c-state" data-w="${which}" data-uid="${esc(lf.uid)}" data-group="${esc(lf.uid)}s" data-v="${esc(o.value)}"`, label: o.label })))}`;
      } else {
        html += `<div class="mg-k">${esc(t("tmCondStateFree"))}</div><input class="mg-input" type="text" data-tm="c-value" data-w="${which}" data-uid="${esc(lf.uid)}" value="${esc(lf.value)}" autocomplete="off">`;
      }
    }
    html += `<button type="button" class="linkbtn mg-chgent" data-tm="c-ent" data-w="${which}" data-uid="${esc(lf.uid)}">${esc(t("tmCondChangeEntity"))}</button></div>`;
    return html;
  },

  // Auswahl der Entität für eine neue (oder zu ändernde) Bedingung: Suche in allen Entitäten
  pickerHtml(which) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const c = this.cstate(which);
    return `<div class="mg-free"><div class="mg-k">${esc(t("tmCondPickTitle"))}</div>
      <input class="mg-input" type="search" data-tm="c-search" data-w="${which}" value="${esc(c.query)}" placeholder="${esc(t("tmCondSearch"))}" aria-label="${esc(t("tmCondSearch"))}" autocomplete="off">
      <div data-tm-zone="cpick-${which}">${this.pickListHtml(which)}</div>
      <button type="button" class="linkbtn" data-tm="c-cancel" data-w="${which}">${esc(t("tmCancel"))}</button></div>`;
  },

  pickListHtml(which) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const c = this.cstate(which);
    if (c.error) return `<div class="opt-error">${esc(c.error)}</div>`;
    if (c.loading && !c.results) return `<p class="mg-hint">${esc(t("tmCondSearching"))}</p>`;
    if (!c.results?.length) return `<p class="mg-hint">${esc(t("tmCondSearchNone"))}</p>`;
    return `<div class="mg-list" role="listbox">${c.results
      .map(
        (e) => `<button type="button" class="mg-opt-row" role="option" data-tm="c-pick" data-w="${which}" data-id="${esc(e.entity_id)}"><span><b>${this.entIcon(e)} ${esc(e.name)}</b><br><small>${esc([e.entity_id, e.device_name].filter(Boolean).join(" · "))}</small></span><span class="mg-freeval">${esc(this.entValue(e))}</span></button>`
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
      const zone = this.q(`[data-tm-zone="cpick-${which}"]`);
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
    const tm = el.dataset.tm;
    if (!w || (!tm?.startsWith("c-") && !["whenmode", "backkind", "hold", "pause", "bmax"].includes(tm))) return false;
    const d = w.draft;
    const which = el.dataset.w;
    switch (tm) {
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
        d[which === "back" ? "backHoldS" : "holdS"] = Number(el.dataset.s);
        this.paint();
        return true;
      case "pause":
        d.pauseS = Number(el.dataset.s);
        this.paint();
        this.requestPreview();
        return true;
      case "bmax":
        d.backMaxS = Number(el.dataset.s);
        this.paint();
        this.requestPreview();
        return true;
      default:
    }
    const tree = this.treeOf(which);
    const c = this.cstate(which);
    const id = el.dataset.uid;
    switch (tm) {
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
    const tm = el.dataset.tm;
    if (!this.wiz) return false;
    const d = this.wiz.draft;
    switch (tm) {
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
    switch (el.dataset.tm) {
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
    return `<div class="mg-k">${esc(t("tmHoldLabel"))}</div>${this.tabsHtml(HOLD_PRESETS.map((s) => ({ on: value === s, attrs: `data-tm="hold" data-w="${which}" data-group="${which}" data-s="${s}"`, label: s ? this.fmtDur(s) : t("tmHoldNow") })))}`;
  },

  // Seite "Wann", Teil Auslöser: Bedingungen, Dauer, Zeitfenster, Pause, nur einmal
  triggerPageHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    let html = `<p class="mg-note">${esc(t("tmTrigNote"))}</p><div class="mg-k tm-sec">${esc(t("tmTrigWhen"))}</div>${this.condEditorHtml("start")}`;
    if (!leavesOf(d.conds).length) return `${html}<p class="mg-hint">${esc(t("tmTrigNone"))}</p>`;
    html += `<div data-tm-zone="csum-start">${this.condSumHtml("start")}</div>`;
    html += this.holdHtml("start");
    html += `<div class="mg-k tm-sec">${esc(t("tmWinTitle"))}</div><p class="mg-hint">${esc(t("tmWinNote"))}</p>
      <div class="mg-optrow"><div>${esc(t("tmWinSwitch"))}</div><label class="switch"><input type="checkbox" data-tm="win-on"${d.winOn ? " checked" : ""} aria-label="${esc(t("tmWinSwitch"))}"><span></span></label></div>`;
    if (d.winOn) {
      html += `<div class="tm-winrange"><input class="mg-input tm-timein" type="time" data-tm="win-from" value="${esc(d.winFrom)}" aria-label="${esc(t("tmWinFrom"))}"><span>${esc(t("tmWinTo"))}</span><input class="mg-input tm-timein" type="time" data-tm="win-to" value="${esc(d.winTo)}" aria-label="${esc(t("tmWinTo"))}"></div>`;
      html += `<div data-tm-zone="winerr">${this.winErrHtml()}</div>`;
    }
    html += `<div class="mg-k tm-sec">${esc(t("tmPauseTitle"))}</div><p class="mg-hint">${esc(t("tmPauseNote"))}</p>${this.tabsHtml(PAUSE_PRESETS.map((s) => ({ on: d.pauseS === s, attrs: `data-tm="pause" data-s="${s}"`, label: this.fmtDur(s) })))}`;
    html += `<div class="mg-optrow"><div>${esc(t("tmOnceTrig"))}<small>${esc(t("tmOnceTrigNote"))}</small></div><label class="switch"><input type="checkbox" data-tm="once-trig"${d.onceTrig ? " checked" : ""} aria-label="${esc(t("tmOnceTrig"))}"><span></span></label></div>`;
    return html;
  },

  // Satz zur einzelnen Bedingung; eigene Zone, damit das Tippen im Wertfeld ihn ohne Neuzeichnen nachführt
  condSumHtml(which) {
    const tree = this.treeOf(which);
    return leavesOf(tree).length === 1 ? `<div class="mg-sumline">${this.esc(this.t("tmCondSum", this.treeText(tree)))}</div>` : "";
  },

  winErrHtml() {
    const e = this.winError();
    return e ? `<div class="opt-error">${this.esc(e)}</div>` : "";
  },

  winError() {
    const d = this.wiz.draft;
    if (!d.winOn) return "";
    if (!/^\d{2}:\d{2}$/.test(d.winFrom || "") || !/^\d{2}:\d{2}$/.test(d.winTo || "")) return this.t("tmWinInvalid");
    return d.winFrom === d.winTo ? this.t("tmWinSame") : "";
  },

  // Geht der Schritt "Wann" mit einem Auslöser weiter?
  triggerValid() {
    const d = this.wiz.draft;
    return treeValid(d.conds) && !this.winError() && !this.wiz.pvError;
  },

  // Seite "Zurückschalten" (Schritt 6)
  backStepHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    const kinds = [["none", "tmBackKindNone"], ["duration", "tmBackKindDuration"], ["time", "tmBackKindTime"], ["trigger", "tmBackKindTrigger"]];
    let html = this.tabsHtml(kinds.map(([k, label]) => ({ on: d.backKind === k, attrs: `data-tm="backkind" data-v="${k}"`, label: t(label) })), "mg-two");
    if (d.backKind === "none") return `${html}<p class="mg-note">${esc(t("tmBackNoneNote"))}</p>`;
    if (d.backKind === "duration") {
      html += `<div class="mg-k">${esc(t("tmBackAfter"))}</div>
        ${this.tabsHtml(this.backPresets().map((s) => ({ on: !d.backOwn.text && d.back_s === s, attrs: `data-tm="bdur" data-s="${s}"`, label: this.fmtDur(s) })))}
        ${this.ownHtml("back", d.backOwn, t("tmOwnTime"))}
        ${this.backError() ? `<div class="opt-error" data-tm-err="back">${esc(this.backError())}</div>` : ""}`;
    } else if (d.backKind === "time") {
      html += `<div class="mg-k">${esc(t("tmBackTimeLabel"))}</div><input class="mg-input tm-timein" type="time" data-tm="back-time" value="${esc(d.backTime)}" aria-label="${esc(t("tmBackTimeLabel"))}"><p class="mg-hint">${esc(t("tmBackTimeNote"))}</p>`;
    } else {
      html += `<p class="mg-note">${esc(t("tmBackTrigNote"))}</p><div class="mg-k tm-sec">${esc(t("tmBackTrigWhen"))}</div>${this.condEditorHtml("back")}`;
      html += `<div data-tm-zone="csum-back">${this.condSumHtml("back")}</div>`;
      if (leavesOf(d.backConds).length) {
        html += this.holdHtml("back");
        html += `<div class="mg-k tm-sec">${esc(t("tmBackMaxTitle"))}</div><p class="mg-hint">${esc(t("tmBackMaxNote"))}</p>
          <div class="mg-optrow"><div>${esc(t("tmBackMaxSwitch"))}</div><label class="switch"><input type="checkbox" data-tm="bmax-on"${d.backMaxOn ? " checked" : ""} aria-label="${esc(t("tmBackMaxSwitch"))}"><span></span></label></div>`;
        if (d.backMaxOn) html += this.tabsHtml(MAX_PRESETS.map((s) => ({ on: d.backMaxS === s, attrs: `data-tm="bmax" data-s="${s}"`, label: this.fmtDur(s) })));
      }
    }
    const e = this.entity(d.entity_id);
    if (e && !(d.backKind === "trigger" && !leavesOf(d.backConds).length)) {
      html += `<div class="mg-k">${esc(t("tmBackModeLabel"))}</div>${this.tabsHtml([["opposite", t(`tmAct_${this.actionKey(e.domain, this.opposite(d.action))}`)], ["restore", t("tmBackModeRestore")]].map(([k, label]) => ({ on: d.back_mode === k, attrs: `data-tm="bmode" data-v="${k}"`, label })))}`;
      if (d.back_mode === "restore") html += `<p class="mg-hint">${esc(t("tmBackModeNote"))}</p>`;
    }
    return `${html}<div data-tm-zone="backsum">${this.backSumHtml()}</div><div data-tm-zone="runs">${this.runsHtml()}</div>`;
  },

  // Der Satz zum Zurückschalten unter den Einstellungen ("Nach 20 Min. wieder aus."); eigene Zone, damit er beim Tippen mitläuft
  backSumHtml() {
    const sentence = this.backText(this.draftTm());
    return sentence ? `<div class="mg-sumline">${this.esc(sentence.charAt(0).toUpperCase() + sentence.slice(1))}.</div>` : "";
  },

  backValid() {
    const d = this.wiz.draft;
    if (d.backKind === "none") return true;
    if (d.backKind === "duration") return Boolean(d.back_s) && !this.backError();
    if (d.backKind === "time") return /^\d{2}:\d{2}$/.test(d.backTime || "");
    return treeValid(d.backConds) && !this.wiz.pvError;
  },
};
