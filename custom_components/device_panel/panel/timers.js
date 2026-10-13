/**
 * Timer im Geräte-Popup und in den Einstellungen (seit 2.21.0, docs/mockups/timer-v1).
 *
 * Ein Timer schaltet eine schaltbare Entität eines Geräts einmalig (in X Minuten oder an einem Datum) oder wiederholt
 * (täglich, wöchentlich, monatlich), auf Wunsch mit "danach wieder zurückschalten" und einer Push-Meldung mit festem
 * Inhalt. Aufbau wie Magic Push (magic-push.js): Der Reiter im Popup schreibt nur in einen eigenen Behälter (.tm-root)
 * und hält seinen Stand im Speicher; das Popup baut sich alle 10 Sekunden neu auf, darum setzt attach() den Behälter
 * danach wieder zusammen. Der Assistent (vier Schritte: Was · Wann · Meldung · Name und Prüfung) hat ein eigenes Fenster
 * (dialog.timer-dlg, gleiche Stile wie das von Magic Push). Nächste Ausführungen, Meldungstext und Ziel kommen als
 * Vorschau vom Server (timer_preview), damit Panel und Meldung dieselbe Rechnung benutzen (Zeitzone der Instanz).
 * Timer gehören den Geräten und werden sofort gespeichert, nicht mit "Speichern" der Einstellungen.
 */

const STEPS = 4;
const DELAY_PRESETS = [300, 900, 1800, 3600];
const BACK_PRESETS = [0, 600, 1800, 3600];
const UNITS = [60, 3600, 86400];
const PREVIEW_DELAY_MS = 300;
const EMOJI = { switch: "🔌", light: "💡", fan: "🌀", cover: "🪟", lock: "🔒", valve: "🚿", siren: "🚨", humidifier: "💧", input_boolean: "🔘" };
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
const pad = (n) => String(n).padStart(2, "0");

export const timerEmoji = (domain) => EMOJI[domain] || "⏱️";

export function splitSeconds(seconds, units) {
  for (const u of [...units].reverse()) if (seconds >= u && seconds % u === 0) return { text: String(seconds / u), unit: u };
  return { text: String(Math.round(seconds / units[0])), unit: units[0] };
}

export class TimerUi {
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
    this.ui = { confirmId: null, flash: "", error: "", busy: null };
    this._pendingEdit = null;
    this._offset = 0;
  }

  t(key, ...args) {
    return this.host._t(key, ...args);
  }

  esc(value) {
    return this.h.escape(value);
  }

  wizardOpen() {
    return this.view === "wizard" && Boolean(this.wiz);
  }

  win() {
    return this.host.shadowRoot?.querySelector("dialog.timer-dlg") || null;
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

  // Zahl der eingeschalteten Timer für die Beschriftung des Reiters (null: noch nicht geladen)
  count(deviceId) {
    if (!this.data || this.deviceId !== deviceId) return null;
    return this.data.timers.filter((x) => x.enabled).length;
  }

  // --- Laden ------------------------------------------------------------------

  editWhenLoaded(timerId) {
    this._pendingEdit = timerId;
    this.applyPending();
  }

  applyPending() {
    if (!this._pendingEdit || !this.data) return;
    const timer = this.data.timers.find((x) => x.id === this._pendingEdit);
    this._pendingEdit = null;
    if (timer) this.startWizard(timer);
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
      const result = await this.host._hass.callWS({ type: "device_panel/timer_get", device_id: deviceId });
      if (this.deviceId !== deviceId) return;
      this.data = result;
      this._offset = Number.isFinite(result.now) ? result.now * 1000 - Date.now() : 0;
      this.applyPending();
    } catch (err) {
      if (this.deviceId !== deviceId) return;
      this.error = this.h.errText(err);
      const all = this.standalone ? this.host._tmAll : null;
      if (all) {
        all.err = this.t("tmLoadError", this.error);
        this._pendingEdit = null;
        this.host._renderTmAll?.();
      }
    }
    this.loading = false;
    this.refresh();
  }

  refresh() {
    if (this.host._detailId !== this.deviceId) return;
    if (this.host._devTab === "timer" && this.root?.isConnected) this.paint();
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
    return this.data?.entities.find((e) => e.entity_id === id) || null;
  }

  domainOf(entityId) {
    return String(entityId || "").split(".")[0];
  }

  // Wochentag kurz (0 = Montag)
  wd(i) {
    return this.t("tmWd")[i];
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
      if (local.date === today) return `${this.t("tmToday")} ${local.time}`;
      if (local.date === tom) return `${this.t("tmTomorrow")} ${local.time}`;
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
    if (s || !parts.length) parts.push(`${s} ${this.t("tmSecUnit")}`);
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
    return String(d || "").startsWith("notify.") ? d : this.t("tmTargetNone");
  }

  limit(name, fallback) {
    return this.data?.limits?.[name] ?? fallback;
  }

  // Wort des Zustands einer Entität
  stateWord(e) {
    if (!e) return "";
    if (!e.available) return this.t("tmUnreachable");
    const key = `tmState_${e.state}`;
    const word = this.t(key);
    return word == null ? String(e.state ?? "") : word;
  }

  // "Steckdose einschalten, nach 20 Min. wieder aus"
  sentenceOf(tm, entityName) {
    const domain = this.domainOf(tm.entity_id);
    let text = `${entityName} ${this.t(`tmVerb_${actKey(domain, tm.action)}`)}`;
    if (tm.back_s && opposite(tm.action)) text += `, ${this.t("tmBackText", this.fmtDur(tm.back_s), this.t(`tmRes_${resKey(domain, opposite(tm.action))}`))}`;
    return text;
  }

  // Wann: "Täglich um 20:00", "Mo, Mi, Fr um 06:30", "Monatlich am 1. um 09:00", "Einmalig, 24.12. um 17:00", "Einmalig, in 30 Min."
  whenText(tm) {
    if (tm.kind === "countdown") return this.t("tmWhenCountdown", this.fmtDur(tm.delay_s));
    if (tm.kind === "once") return tm.date ? this.t("tmWhenOnce", this.dateText({ date: tm.date }), tm.time) : this.t("tmWhenOnceNext", tm.time);
    if (tm.repeat === "daily") return this.t("tmWhenDaily", tm.time);
    if (tm.repeat === "weekly") return this.t("tmWhenWeekly", (tm.weekdays || []).map((i) => this.wd(i)).join(", "), tm.time);
    return this.t("tmWhenMonthly", tm.mday === -1 ? this.t("tmLastDayShort") : `${tm.mday}.`, tm.time);
  }

  sentence(tm) {
    return `${this.whenText(tm)} · ${this.sentenceOf(tm, tm.entity_name || tm.entity_id)}`;
  }

  // --- Reiter im Popup --------------------------------------------------------

  paint() {
    if (this.view === "wizard" && this.wiz) {
      this.paintWindow();
      return;
    }
    if (!this.root?.isConnected) return;
    this.root.innerHTML = this.listHtml();
    this.startTick();
  }

  listHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    let html = `<h3>${esc(t("tmTab"))}</h3><p class="mg-note">${esc(t("tmIntro"))}</p>`;
    if (this.ui.flash) html += `<div class="mg-flash" role="status">${esc(this.ui.flash)}</div>`;
    if (this.ui.error) html += `<div class="dlg-error">${esc(this.ui.error)}</div>`;
    if (!this.data) {
      if (this.error) {
        return `${html}<div class="dlg-error">${esc(t("tmLoadError", this.error))}</div><button type="button" class="qbtn" data-tm="reload">${esc(t("tmRetry"))}</button>`;
      }
      return `${html}<p class="mg-note">${esc(t("tmLoading"))}</p>`;
    }
    const timers = this.data.timers;
    if (!timers.length) html += `<p class="mg-empty">${esc(this.data.entities.length ? t("tmEmpty") : t("tmNoEntities"))}</p>`;
    html += timers.map((x) => this.clockHtml(x)).join("");
    const full = timers.length >= this.limit("per_device", 20);
    if (full) html += `<p class="mg-hint">${esc(t("tmLimit", this.limit("per_device", 20)))}</p>`;
    else if (this.data.entities.length) html += `<button type="button" class="mg-add" data-tm="add">${this.h.mdi("plus", 18)}${esc(t("tmAdd"))}</button>`;
    return html;
  }

  // Zeile unter dem Satz: zuletzt, Fehler, verpasst, Entität
  statusHtml(tm) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const out = [];
    if (tm.entity_missing) out.push(`<span class="mg-warn">${esc(t("tmEntityMissing"))}</span>`);
    const last = tm.last;
    if (last) {
      const ago = this.serverNow() - last.at;
      const when = ago < 60 ? t("tmJustNow") : t("tmAgo", this.host._fmtSeconds(ago, true));
      if (last.what === "failed") out.push(`<span class="mg-warn">${esc(t("tmFailed", t(`tmReason_${last.reason || "error"}`)))}</span> ${esc(when)}`);
      else if (last.what === "retry") out.push(`<span class="mg-warn">${esc(t("tmRetrying", t(`tmReason_${last.reason || "error"}`)))}</span>`);
      else if (last.what === "missed") out.push(`<span class="mg-warn">${esc(t("tmMissed"))}</span> ${esc(when)}`);
      else if (last.what === "paused") out.push(esc(t("tmSkippedPaused")) + ` ${esc(when)}`);
      else if (last.ok) out.push(esc(t("tmLastRun", when)));
    }
    return out;
  }

  // Wecker-Stil (docs/mockups/timer-v1, Variante B): Uhrzeit gross, Wochentage als Zeile, darunter nächster Lauf
  clockHtml(tm) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const confirming = this.ui.confirmId === tm.id;
    const domain = tm.domain || this.domainOf(tm.entity_id);
    const name = tm.entity_name || tm.entity_id;
    const running = tm.running && tm.due;
    let left;
    if (running) {
      const total = Number(tm.delay_s) || 1;
      const rem = Math.max(0, tm.due - this.serverNow());
      const circ = 2 * Math.PI * 26;
      left = `<div class="tm-ring" data-tm-due="${tm.due}" data-total="${total}"><svg viewBox="0 0 62 62" aria-hidden="true"><circle class="bg" cx="31" cy="31" r="26"/><circle class="fg" cx="31" cy="31" r="26" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${(circ * (1 - rem / total)).toFixed(1)}"/></svg><span data-tm-left>${esc(this.fmtClock(rem))}</span></div>`;
    } else {
      const sub = tm.kind === "once" ? (tm.date ? this.dateText({ date: tm.date }) : t("tmOnceShort")) : tm.repeat === "monthly" ? t("tmMonthlyOn", tm.mday === -1 ? t("tmLastDayShort") : `${tm.mday}.`) : "";
      left = `<div class="time">${esc(tm.time || this.localTimeOf(tm))}${sub ? `<small>${esc(sub)}</small>` : ""}</div>`;
    }
    const sw = `<label class="switch"><input type="checkbox" data-tm="toggle" data-id="${esc(tm.id)}"${tm.enabled ? " checked" : ""} aria-label="${esc(tm.name)}"><span></span></label>`;
    const what = `${this.sentenceOf(tm, name)}${tm.kind === "countdown" ? ` · ${t("tmOnceShort")}` : ""}${tm.push ? ` · 🔔 ${esc(tm.target ? this.niceTarget(tm.target) : t("tmTargetDefaultShort"))}` : ""}`;
    const days = tm.kind === "repeat" && (tm.repeat === "daily" || tm.repeat === "weekly")
      ? `<div class="tm-days">${WEEKDAYS.map((i) => `<i class="${tm.repeat === "daily" || (tm.weekdays || []).includes(i) ? "on" : ""}">${esc(this.wd(i))}</i>`).join("")}</div>`
      : "";
    const status = this.statusHtml(tm);
    let next;
    if (running) next = `<span>${esc(t("tmRemaining"))} <b data-tm-left2>${esc(this.fmtClock(Math.max(0, tm.due - this.serverNow())))}</b></span>`;
    else if (tm.enabled && tm.due_local) next = `<span>${esc(t("tmNextRun"))} <b>${esc(this.localText(tm.due_local))}</b></span>`;
    else if (tm.done) next = `<span class="tm-tag grey">${esc(t("tmDone"))}</span>`;
    else next = `<span>${esc(t("tmDisabled"))}</span>`;
    if (tm.revert_local) next += `<span>${esc(t("tmRevertAt", tm.revert_local.time))}</span>`;
    const again = !tm.enabled && (tm.done || tm.kind !== "repeat");
    const acts = confirming
      ? ""
      : `<span class="acts"><button type="button" class="linkbtn" data-tm="edit" data-id="${esc(tm.id)}">${esc(t("tmActEdit"))}</button>
         ${again ? `<button type="button" class="linkbtn" data-tm="restart" data-id="${esc(tm.id)}">${esc(t("tmActRestart"))}</button>` : ""}
         <button type="button" class="linkbtn" data-tm="run" data-id="${esc(tm.id)}"${this.ui.busy === tm.id ? " disabled" : ""}>${esc(t("tmActRun"))}</button>
         <button type="button" class="linkbtn danger" data-tm="delete" data-id="${esc(tm.id)}">${esc(t("tmActDelete"))}</button></span>`;
    const confirm = confirming
      ? `<div class="mg-confirm"><b>${esc(t("tmDeleteAsk", tm.name))}</b><small>${esc(t("tmDeleteNote"))}</small>
          <div class="mg-btns small"><button type="button" class="dlg-btn" data-tm="delete-no">${esc(t("tmCancel"))}</button><button type="button" class="dlg-btn danger" data-tm="delete-yes" data-id="${esc(tm.id)}">${esc(t("tmDeleteYes"))}</button></div></div>`
      : "";
    return `<div class="tm-clock${tm.enabled ? "" : " off"}"><div class="top">${left}<span class="grow"></span>${sw}</div>
      <div class="name">${timerEmoji(domain)} ${esc(tm.name)}</div><div class="what">${what}</div>${days}
      ${status.length ? `<div class="what">${status.join(" · ")}</div>` : ""}
      <div class="next">${next}${acts}</div>${confirm}</div>`;
  }

  localTimeOf(tm) {
    return tm.due_local?.time || "";
  }

  // Restzeit eines laufenden Countdowns jede Sekunde nachführen, ohne den Behälter neu zu zeichnen
  startTick() {
    window.clearInterval(this._tick);
    this._tick = null;
    if (!this.root?.querySelector("[data-tm-due]")) return;
    this._tick = window.setInterval(() => {
      if (!this.root?.isConnected) {
        window.clearInterval(this._tick);
        this._tick = null;
        return;
      }
      let expired = false;
      for (const el of this.root.querySelectorAll("[data-tm-due]")) {
        const rem = Number(el.dataset.tmDue) - this.serverNow();
        if (rem <= 0) expired = true;
        const total = Number(el.dataset.total) || 1;
        const text = this.fmtClock(rem);
        const span = el.querySelector("[data-tm-left]");
        if (span) span.textContent = text;
        const fg = el.querySelector("circle.fg");
        if (fg) fg.setAttribute("stroke-dashoffset", String((2 * Math.PI * 26 * (1 - Math.max(0, rem) / total)).toFixed(1)));
        const card = el.closest(".tm-clock");
        const b = card?.querySelector("[data-tm-left2]");
        if (b) b.textContent = text;
      }
      if (expired) {
        window.clearInterval(this._tick);
        this._tick = null;
        window.setTimeout(() => this.load(this.deviceId), 1500);
      }
    }, 1000);
  }

  // --- Einstellungen: Übersicht aller Timer -----------------------------------

  allCounts(timers) {
    return {
      all: timers.length,
      on: timers.filter((x) => x.enabled).length,
      off: timers.filter((x) => !x.enabled).length,
      running: timers.filter((x) => x.running || x.reverting).length,
      fav: timers.filter((x) => this.isStar(x.id)).length,
    };
  }

  // Attribut für Aktionen: in den Einstellungen "data-set", im Fenster mit allen Timern (all.dlg) "data-tma"
  a(all, action) {
    return all.dlg ? `data-tma="${action}"` : `data-set="${action}"`;
  }

  allQuery(all) {
    return String(all?.dlg ? all.query || "" : this.host._settings?.search?.timers || "").trim();
  }

  haystack(tm) {
    return `${tm.name} ${tm.device_name} ${tm.entity_name} ${tm.entity_id} ${this.sentence(tm)} ${tm.target || ""}`.toLowerCase();
  }

  allGroups(all, devices) {
    const groups = new Map();
    for (const tm of all.timers || []) {
      const dev = devices.find((d) => d.id === tm.device_id);
      if (!groups.has(tm.device_id)) groups.set(tm.device_id, { id: tm.device_id, name: tm.device_name || dev?.name || "", dev, timers: [] });
      groups.get(tm.device_id).timers.push(tm);
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  // Lieblings-Timer (Herz, seit 2.26.0): liegen pro Benutzer in den Benutzerdaten, eigener Reiter in "Alle Timer"
  isStar(id) {
    return Boolean(this.host._tmStars?.has(id));
  }

  passes(tm, q, filter) {
    if (filter === "on" && !tm.enabled) return false;
    if (filter === "off" && tm.enabled) return false;
    if (filter === "running" && !tm.running && !tm.reverting) return false;
    if (filter === "fav" && !this.isStar(tm.id)) return false;
    return !q || this.haystack(tm).includes(q.toLowerCase());
  }

  isFiltering(all) {
    return Boolean(this.allQuery(all)) || (all.filter || "all") !== "all";
  }

  isOpen(all, id, nGroups) {
    if (this.isFiltering(all)) return all.sopen?.[id] !== false;
    if (all.open && id in all.open) return all.open[id];
    return nGroups === 1;
  }

  visibleGroups(all, devices) {
    const q = this.allQuery(all);
    const filter = all.filter || "all";
    return this.allGroups(all, devices)
      .map((g) => ({ ...g, shown: g.timers.filter((x) => this.passes(x, q, filter)) }))
      .filter((g) => g.shown.length);
  }

  toggleFold(all, devices, id) {
    const n = this.allGroups(all, devices).length;
    const open = this.isOpen(all, id, n);
    if (this.isFiltering(all)) (all.sopen ||= {})[id] = !open;
    else (all.open ||= {})[id] = !open;
  }

  foldAll(all, devices) {
    const groups = this.visibleGroups(all, devices);
    const n = this.allGroups(all, devices).length;
    const anyOpen = groups.some((g) => this.isOpen(all, g.id, n));
    for (const g of groups) {
      if (this.isFiltering(all)) (all.sopen ||= {})[g.id] = !anyOpen;
      else (all.open ||= {})[g.id] = !anyOpen;
    }
  }

  overviewHtml(all, devices) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    let html = `<p class="mg-note">${esc(t(all.dlg ? "tmAllDlgIntro" : "tmAllIntro"))}</p>`;
    if (all.flash) html += `<div class="mg-flash" role="status">${esc(all.flash)}</div>`;
    if (all.error && !all.timers) {
      return `${html}<div class="dlg-error">${esc(t("tmLoadError", all.error))}</div><button type="button" class="qbtn" ${this.a(all, "timer-reload")}>${esc(t("tmRetry"))}</button>`;
    }
    if (all.err) html += `<div class="dlg-error">${esc(all.err)}</div>`;
    if (!all.timers) return `${html}<p class="mg-note">${esc(t("tmLoading"))}</p>`;
    if (!all.timers.length) return `${html}<p class="mg-empty">${esc(t("tmAllEmpty"))}</p>`;
    const q = all.dlg ? String(all.query || "") : String(this.host._settings?.search?.timers || "");
    const ph = t("listSearch");
    html += `<label class="list-search" data-for="timers">${this.h.mdi("search", 18)}<input type="search" data-lsearch="timers" value="${esc(q)}" placeholder="${esc(ph)}" aria-label="${esc(ph)}" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false"><span class="n"></span>${this.host._fieldClearHtml(all.dlg ? "data-tma-clear" : "data-lclear", "timers", q)}</label>`;
    const c = this.allCounts(all.timers);
    // Reiter mit Herz (seit 2.26.0): nur, solange es einen Lieblings-Timer gibt; das Fenster öffnet dann auf diesem Reiter
    if (all.dlg && !all.tabInit) {
      all.tabInit = true;
      if (c.fav) all.filter = "fav";
    }
    if ((all.filter || "all") === "fav" && !c.fav) all.filter = "all";
    const filter = all.filter || "all";
    const tabs = [["all", "tmFilterAll"], ["on", "tmFilterOn"], ["off", "tmFilterOff"], ["running", "tmFilterRunning"], ...(c.fav ? [["fav", "tmFilterFav"]] : [])];
    html += `<div class="sub-tabs mg-tabs mg-filter" role="tablist">${tabs
      .map(([k, label]) => `<button type="button" role="tab" class="sub-tab two${k === filter ? " on" : ""}${k === "fav" ? " fav" : ""}" ${this.a(all, "timer-filter")} data-v="${k}" aria-selected="${k === filter}"${k === "fav" ? ` aria-label="${esc(t(label))}"` : ""}><span class="tab-l">${k === "fav" ? this.h.mdi("heart", 16) : esc(t(label))}</span> <span class="tab-s">${c[k]}</span></button>`)
      .join("")}</div>`;
    return `${html}<div data-tm-all-zone data-q="${esc(q)}">${this.overviewListHtml(all, devices)}</div>`;
  }

  overviewListHtml(all, devices) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const groups = this.visibleGroups(all, devices);
    const nGroups = this.allGroups(all, devices).length;
    const shown = groups.reduce((n, g) => n + g.shown.length, 0);
    all.shown = { n: shown, total: all.timers.length, filtering: this.isFiltering(all) };
    if (!groups.length) return `<p class="mg-note mg-none">${esc(t("listSearchNone"))}</p>`;
    const anyOpen = groups.some((g) => this.isOpen(all, g.id, nGroups));
    let html = `<div class="mg-allcount"><span class="mg-count">${esc(t("tmAllCount", shown, groups.length))}</span><button type="button" class="linkbtn" ${this.a(all, "timer-fold-all")}>${esc(t(anyOpen ? "tmFoldAll" : "tmUnfoldAll"))}</button></div>`;
    for (const g of groups) {
      const open = this.isOpen(all, g.id, nGroups);
      const offN = g.shown.filter((x) => !x.enabled).length;
      const nextTm = g.shown.filter((x) => x.enabled && x.due_local).sort((a, b) => a.due - b.due)[0];
      const sum = open
        ? g.dev?.area || g.dev?.integration?.name ? `<small>${esc([g.dev?.area, g.dev?.integration?.name].filter(Boolean).join(" · "))}</small>` : ""
        : `<small class="mg-dsum">${esc(t("tmSumTimers", g.shown.length))}${offN ? ` · ${esc(t("tmSumOff", offN))}` : ""}${nextTm ? ` · <span class="mg-on">${esc(t("tmSumNext", this.localText(nextTm.due_local)))}</span>` : ""}</small>`;
      html += `<div class="mg-dcard${open ? "" : " closed"}"><button type="button" class="mg-dhead" ${this.a(all, "timer-fold-dev")} data-device="${esc(g.id)}" aria-expanded="${open}">
        <span class="mg-devic" aria-hidden="true">${this.h.typeIcon(g.dev?.type || "other", 18)}</span>
        <span class="mg-t"><b>${esc(g.name)}</b>${sum}</span><span class="mg-badge">${g.shown.length}</span>${this.chevHtml(open)}</button>`;
      if (open) {
        html += g.shown.map((x) => this.overviewCardHtml(x, all)).join("");
        html += `<div class="mg-dfoot"><button type="button" class="linkbtn" ${this.a(all, "timer-device")} data-device="${esc(g.id)}">${esc(t("tmAllOpenDevice"))} ›</button></div>`;
      }
      html += `</div>`;
    }
    return html;
  }

  overviewCardHtml(tm, all) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const confirming = all.confirmId === tm.id;
    const sw = `<label class="switch"><input type="checkbox" ${this.a(all, "timer-toggle")} data-id="${esc(tm.id)}"${tm.enabled ? " checked" : ""} aria-label="${esc(tm.name)}"><span></span></label>`;
    const again = !tm.enabled && (tm.done || tm.kind !== "repeat");
    const acts = confirming
      ? ""
      : `<div class="mg-acts"><button type="button" class="linkbtn" ${this.a(all, "timer-edit")} data-device="${esc(tm.device_id)}" data-id="${esc(tm.id)}">${esc(t("tmActEdit"))}</button>
        ${again ? `<button type="button" class="linkbtn" ${this.a(all, "timer-restart")} data-id="${esc(tm.id)}">${esc(t("tmActRestart"))}</button>` : ""}${
          // Im Fenster mit allen Timern: bearbeiten, ein-/ausschalten und löschen (seit 2.24.1), kein Ausführen, kein Neuanlegen
          all.dlg ? "" : `
        <button type="button" class="linkbtn" ${this.a(all, "timer-run")} data-id="${esc(tm.id)}">${esc(t("tmActRun"))}</button>`
        }
        <button type="button" class="linkbtn danger" ${this.a(all, "timer-delete")} data-id="${esc(tm.id)}">${esc(t("tmActDelete"))}</button>
        <button type="button" class="linkbtn fav${this.isStar(tm.id) ? " on" : ""}" ${this.a(all, "timer-star")} data-id="${esc(tm.id)}" aria-pressed="${this.isStar(tm.id)}" title="${esc(t(this.isStar(tm.id) ? "tmFavRemove" : "tmFavAdd"))}" aria-label="${esc(t(this.isStar(tm.id) ? "tmFavRemove" : "tmFavAdd"))}">${this.h.mdi(this.isStar(tm.id) ? "heart" : "heartOutline", 20)}</button></div>`;
    const confirm = confirming
      ? `<div class="mg-confirm"><b>${esc(t("tmDeleteAsk", tm.name))}</b><small>${esc(t("tmDeleteNote"))}</small>
          <div class="mg-btns small"><button type="button" class="dlg-btn" ${this.a(all, "timer-delete-no")}>${esc(t("tmCancel"))}</button><button type="button" class="dlg-btn danger" ${this.a(all, "timer-delete-yes")} data-id="${esc(tm.id)}">${esc(t("tmDeleteYes"))}</button></div></div>`
      : "";
    const status = this.statusHtml(tm);
    // Wartet auf das Zurückschalten: wann, steht in der Zeile (Reiter "Läuft", seit 2.26.0)
    const backWord = tm.reverting && tm.revert_local && opposite(tm.action) ? this.t(`tmRes_${resKey(tm.domain, opposite(tm.action))}`) : "";
    if (backWord) status.unshift(`<span class="mg-on">${esc(t("tmBackAtRow", backWord, this.localText(tm.revert_local)))}</span>`);
    const next = tm.running ? `<span class="mg-on">${esc(t("tmRunningShort"))}</span>` : tm.enabled && tm.due_local ? `${esc(t("tmNextRun"))} <span class="mg-on">${esc(this.localText(tm.due_local))}</span>` : tm.done ? esc(t("tmDone")) : esc(t("tmDisabled"));
    return `<div class="mg-card${tm.enabled ? "" : " off"}"><div class="mg-row"><span class="mg-ic" aria-hidden="true">${timerEmoji(tm.domain)}</span>
      <div class="mg-t"><b>${esc(tm.name)}</b><small>${esc(this.sentence(tm))}</small><small class="mg-status">${[next, ...status].join(" · ")}</small></div>${sw}</div>${acts}${confirm}</div>`;
  }

  chevHtml(open) {
    return `<span class="mg-lchev${open ? " up" : ""}" aria-hidden="true">${this.h.mdi("chevronDown", 24)}</span>`;
  }

  // --- Aktionen auf Timern (Popup und Übersicht) ------------------------------

  replaceTimer(timer) {
    for (const list of [this.data?.timers, this.host._tmAll?.timers]) {
      if (!list) continue;
      const i = list.findIndex((x) => x.id === timer.id);
      if (i >= 0) list[i] = { ...list[i], ...timer };
    }
  }

  async toggle(id, enabled, input) {
    try {
      const r = await this.call({ type: "device_panel/timer_enable", timer_id: id, enabled });
      this.replaceTimer(r.timer);
      this.ui.error = "";
    } catch (err) {
      this.ui.error = this.t("tmToggleError", this.h.errText(err));
      if (input) input.checked = !enabled;
    }
    this.afterChange();
  }

  async restart(id) {
    await this.toggle(id, true);
  }

  async run(id) {
    if (this.ui.busy) return;
    this.ui.busy = id;
    this.afterChange();
    try {
      const r = await this.call({ type: "device_panel/timer_run", timer_id: id });
      this.replaceTimer(r.timer);
      this.ui.error = r.ok ? "" : this.t("tmRunFailed", this.t(`tmReason_${r.reason || "error"}`));
      this.ui.flash = r.ok ? this.t("tmRunDone") : "";
    } catch (err) {
      this.ui.error = this.t("tmRunFailed", this.h.errText(err));
    }
    this.ui.busy = null;
    this.afterChange();
  }

  async remove(id) {
    try {
      await this.call({ type: "device_panel/timer_delete", timer_id: id });
      if (this.data) this.data.timers = this.data.timers.filter((x) => x.id !== id);
      const all = this.host._tmAll;
      if (all?.timers) all.timers = all.timers.filter((x) => x.id !== id);
      this.ui.confirmId = null;
      this.ui.error = "";
    } catch (err) {
      this.ui.error = this.t("tmDeleteError", this.h.errText(err));
    }
    this.afterChange();
  }

  afterChange() {
    if (this.host._devTab === "timer" && this.root?.isConnected && !this.wizardOpen()) this.paint();
    this.host._renderDevice?.(true);
    this.host._renderTmAll?.();
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
      back_s: 0,
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

  draftFrom(tm) {
    const back = tm.back_s ? splitSeconds(tm.back_s, UNITS) : { text: "", unit: 60 };
    const delay = tm.delay_s ? splitSeconds(tm.delay_s, UNITS) : { text: "", unit: 60 };
    const backPreset = BACK_PRESETS.includes(tm.back_s || 0);
    const delayPreset = DELAY_PRESETS.includes(tm.delay_s || 0);
    return {
      id: tm.id,
      device_id: tm.device_id,
      entity_id: tm.entity_id,
      action: tm.action,
      back_s: tm.back_s || 0,
      backOwn: backPreset ? { text: "", unit: 60 } : back,
      kind: tm.kind,
      delay_s: tm.delay_s || 1800,
      delayOwn: delayPreset || !tm.delay_s ? { text: "", unit: 60 } : delay,
      date: tm.date || "",
      time: tm.time || "06:30",
      repeat: tm.repeat || "daily",
      weekdays: tm.weekdays?.length ? [...tm.weekdays] : [0, 1, 2, 3, 4],
      mday: tm.mday ?? 1,
      mdayOwn: tm.mday != null && tm.mday !== 1 && tm.mday !== 15 && tm.mday !== -1,
      // Ein erledigter Timer wird beim Bearbeiten wieder scharf
      enabled: tm.done ? true : tm.enabled,
      push: Boolean(tm.push),
      target: tm.target || "",
      name: tm.name,
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
      back_s: d.back_s || null,
      kind: d.kind,
      delay_s: d.kind === "countdown" ? d.delay_s : null,
      date: d.kind === "once" && d.date ? d.date : null,
      time: d.kind === "countdown" ? null : d.time,
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

  startWizard(timer = null) {
    this.view = "wizard";
    this.ui.flash = "";
    this.ui.error = "";
    this.wiz = {
      step: timer ? 2 : 1,
      editing: Boolean(timer),
      draft: timer ? this.draftFrom(timer) : this.newDraft(),
      pv: null,
      pvError: "",
      test: null,
      targetOpen: false,
      error: "",
      saving: false,
    };
    // Eine einzige schaltbare Entität ist schon gewählt: gleich zu "Wann"
    if (!timer && this.wiz.draft.entity_id) this.wiz.step = 1;
    this.wiz.snap = JSON.stringify(this.wiz.draft);
    this.paint();
    this.scrollTop();
    this.requestPreview();
  }

  // Neuer Timer aus dem Fenster aller Timer (seit 2.27.0): derselbe Assistent mit einem Schritt mehr davor, der das Gerät wählt
  async startNewFromAll() {
    this.reset();
    this.standalone = true;
    this.view = "wizard";
    const draft = { id: null, device_id: null, entity_id: "", action: "on", back_s: 0, backOwn: { text: "", unit: 60 }, kind: "repeat", delay_s: 1800, delayOwn: { text: "", unit: 60 }, date: "", time: "06:30", repeat: "daily", weekdays: [0, 1, 2, 3, 4], mday: 1, mdayOwn: false, enabled: true, push: false, target: "", name: "" };
    const w = (this.wiz = { pick: true, step: 0, editing: false, draft, pv: null, pvError: "", test: null, targetOpen: false, error: "", saving: false, devices: null, devQuery: "", pickId: "", loadingDev: false });
    w.snap = JSON.stringify(draft);
    this.paint();
    try {
      const r = await this.call({ type: "device_panel/timer_devices" });
      if (this.wiz !== w) return;
      w.devices = r.devices;
    } catch (err) {
      if (this.wiz !== w) return;
      w.devices = [];
      w.error = this.t("tmLoadError", this.h.errText(err));
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
        const result = await this.call({ type: "device_panel/timer_get", device_id: id });
        if (this.wiz !== w) return;
        this.deviceId = id;
        this.data = result;
        this._offset = Number.isFinite(result.now) ? result.now * 1000 - Date.now() : 0;
        w.draft = this.newDraft();
        w.snap = JSON.stringify(w.draft);
        w.pv = null;
      }
    } catch (err) {
      if (this.wiz !== w) return;
      w.loadingDev = false;
      w.error = this.t("tmLoadError", this.h.errText(err));
      this.paint();
      return;
    }
    w.loadingDev = false;
    this.setStep(1);
  }

  // Schritt 0: Gerät wählen (nur Geräte mit schaltbarer Entität), mit Suche
  step0Html() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const w = this.wiz;
    return `<p class="mg-note">${esc(t("tmPickDeviceNote"))}</p>
      <label class="list-search" data-for="tm-devs">${this.h.mdi("search", 18)}<input type="search" data-tm="dev-search" value="${esc(w.devQuery)}" placeholder="${esc(t("listSearch"))}" aria-label="${esc(t("listSearch"))}" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
      <div data-tm-zone="devs">${this.devsHtml()}</div>`;
  }

  devsHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const w = this.wiz;
    if (!w.devices) return `<p class="mg-note">${esc(t("tmLoading"))}</p>`;
    const q = String(w.devQuery || "").trim().toLowerCase();
    const rows = w.devices
      .map((x) => {
        const dev = this.host._devices?.find((d) => d.id === x.id);
        const sub = [dev?.area, dev?.integration?.name].filter(Boolean).join(" · ");
        return { ...x, name: dev?.name || x.name, sub, type: dev?.type || "other" };
      })
      .filter((x) => !q || `${x.name} ${x.sub}`.toLowerCase().includes(q));
    if (!rows.length) return `<p class="mg-note mg-none">${esc(t(w.devices.length ? "listSearchNone" : "tmNoSwitchableDevices"))}</p>`;
    return rows
      .map((x) => `<button type="button" class="mg-card mg-pick" data-tm="dev" data-id="${esc(x.id)}" role="radio" aria-checked="${w.pickId === x.id}">
        <span class="mg-row"><span class="mg-devic" aria-hidden="true">${this.h.typeIcon(x.type, 18)}</span><span class="mg-t"><b>${esc(x.name)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ""}</span>
        <span class="mg-val">${esc(t("tmDevEntities", x.entities))}</span><span class="mg-radio${w.pickId === x.id ? " on" : ""}"></span></span></button>`)
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
      this.host._loadTmAll?.();
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
    return d.kind === "countdown" && (!Number.isFinite(d.delay_s) || d.delay_s < lo || d.delay_s > hi) ? this.t("tmDelayRange", this.fmtDur(lo), this.fmtDur(hi)) : "";
  }

  backError() {
    const d = this.wiz.draft;
    if (!d.back_s) return "";
    const lo = this.limit("back_min", 10);
    const hi = this.limit("back_max", 604800);
    return !Number.isFinite(d.back_s) || d.back_s < lo || d.back_s > hi ? this.t("tmBackRange", this.fmtDur(lo), this.fmtDur(hi)) : "";
  }

  canNext(step = this.wiz.step) {
    if (step === 0) return Boolean(this.wiz.pickId) && !this.wiz.loadingDev;
    const d = this.wiz.draft;
    const e = this.entity(d.entity_id);
    if (step === 1) return Boolean(e) && e.actions.includes(d.action) && !this.backError();
    if (step === 2) {
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
    try {
      const r = await this.call({ type: "device_panel/timer_preview", timer: this.payload() });
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
      const r = await this.call({ type: "device_panel/timer_test", timer: this.payload() });
      const to = w.draft.target || this.data.default_target;
      w.test = { text: r.sent ? this.t("tmTestSent", to && to !== "none" ? this.niceTarget(to) : "") : this.t("tmTestFail"), failed: !r.sent };
    } catch (err) {
      w.test = { text: this.t("tmTestError", this.h.errText(err)), failed: true };
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
      const r = await this.call({ type: "device_panel/timer_save", timer: this.payload() });
      const list = this.data?.timers;
      if (list) {
        const i = list.findIndex((x) => x.id === r.timer.id);
        if (i >= 0) list[i] = r.timer;
        else list.push(r.timer);
        list.sort((a, b) => a.name.localeCompare(b.name));
      }
      this.ui.flash = this.t("tmSaved");
      w.saving = false;
      w.snap = JSON.stringify(w.draft);
      this.closeWizard();
    } catch (err) {
      w.saving = false;
      w.error = this.t("tmSaveError", this.h.errText(err));
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
    for (const name of only || ["result", "runs", "pv", "summary"]) {
      const el = this.q(`[data-tm-zone="${name}"]`);
      if (!el) continue;
      if (name === "result") el.innerHTML = this.resultHtml();
      else if (name === "runs") el.innerHTML = this.runsHtml();
      else if (name === "summary") el.innerHTML = this.summaryHtml();
      else if (name === "devs") el.innerHTML = this.devsHtml();
      else el.innerHTML = this.pvHtml();
    }
  }

  // Alle Schritte gültig: dann darf auf jeder Seite gespeichert werden (seit 2.24.0)
  canSaveAll() {
    return Array.from({ length: STEPS }, (_, i) => i + 1).every((n) => this.canNext(n));
  }

  syncNav() {
    const next = this.q('[data-tm="nav-next"], [data-tm="nav-save"]');
    if (next) next.disabled = !this.canNext() || Boolean(this.wiz?.saving);
    const quick = this.q('[data-tm="nav-quick"]');
    if (quick) quick.disabled = !this.canSaveAll() || Boolean(this.wiz?.saving);
  }

  tabsHtml(items, cls = "") {
    const esc = (v) => this.esc(v);
    return `<div class="sub-tabs mg-tabs${cls ? ` ${cls}` : ""}" role="radiogroup">${items
      .map((i) => `<button type="button" role="radio" class="sub-tab${i.on ? " on" : ""}" aria-checked="${Boolean(i.on)}" ${i.attrs}>${esc(i.label)}</button>`)
      .join("")}</div>`;
  }

  ownHtml(kind, own, label) {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    return `<div class="mg-own"><span>${esc(label)}</span>
      <input class="mg-pill num mg-ownin" type="text" inputmode="decimal" data-tm="${kind}-own" value="${esc(own.text)}" placeholder="${esc(t("tmOwnPh"))}" aria-label="${esc(label)}" autocomplete="off">
      <select class="mg-pill" data-tm="${kind}-unit" aria-label="${esc(label)}">${UNITS.map((u) => `<option value="${u}"${u === own.unit ? " selected" : ""}>${esc(t(`tmUnit_${u}`))}</option>`).join("")}</select></div>`;
  }

  wizardHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const w = this.wiz;
    const step = w.step;
    // Mit "Timer hinzufügen" im Fenster aller Timer kommt Schritt 0 (Gerät wählen) davor: eine Seite mehr, die Anzeige zählt ab 1
    const first = w.pick ? 0 : 1;
    const total = w.pick ? STEPS + 1 : STEPS;
    const shown = (n) => (w.pick ? n + 1 : n);
    const bars = Array.from({ length: total }, (_, i) => {
      const n = i + first;
      const on = n <= step ? " on" : "";
      const open = (w.editing || n < step) && !(n >= 1 && !this.data);
      return open
        ? `<button type="button" class="mg-stp${on}" data-tm="goto" data-step="${n}" aria-label="${esc(`${t("tmStepOf", shown(n), total)}: ${t(`tmStepName_${n}`)}`)}"></button>`
        : `<span class="mg-stp${on}"></span>`;
    }).join("");
    const body = [this.step0Html, this.step1Html, this.step2Html, this.step3Html, this.step4Html][step].call(this);
    const last = step === STEPS;
    const quick = last || step === 0 ? "" : `<button type="button" class="dlg-btn quick" data-tm="nav-quick"${this.canSaveAll() && !w.saving ? "" : " disabled"}>${esc(w.saving ? t("tmSaving") : t("tmSave"))}</button>`;
    const nav = `<div class="mg-btns"><button type="button" class="dlg-btn" data-tm="${step === first ? "nav-cancel" : "nav-back"}">${esc(step === first ? t("tmCancel") : t("tmBack"))}</button>
      ${quick}
      ${last ? `<button type="button" class="dlg-btn primary" data-tm="nav-save"${this.canNext() && !w.saving ? "" : " disabled"}>${esc(w.saving ? t("tmSaving") : t("tmSave"))}</button>` : `<button type="button" class="dlg-btn primary" data-tm="nav-next"${this.canNext() ? "" : " disabled"}>${esc(t("tmNext"))}</button>`}</div>`;
    const device = (step > 0 || !w.pick) && this.deviceId ? this.host._devices?.find((x) => x.id === this.deviceId)?.name || w.devices?.find((x) => x.id === this.deviceId)?.name || "" : "";
    return `<div class="mgw-head"><div class="mgw-t"><b>${esc(w.editing ? t("tmEditing") : t("tmNew"))}</b>${device ? `<small>${esc(device)}</small>` : ""}</div>
        <button type="button" class="dlg-close" data-tm="close" title="${esc(t("close"))}" aria-label="${esc(t("close"))}">${this.h.mdi("close", 18)}</button></div>
      <div class="mgw-prog"><div class="mg-stephead"><span>${esc(t("tmStepOf", shown(step), total))}</span><span>${esc(t(`tmStepName_${step}`))}</span></div>
        <div class="mg-steps">${bars}</div></div>
      <div class="mgw-body"><div class="mgw-main"><div class="mg-big">${esc(t(`tmQ_${step}`))}</div>
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
    if (!ents.length) return `<p class="mg-note">${esc(t("tmNoEntities"))}</p>`;
    let html = `<p class="mg-note">${esc(t("tmOnlySwitchable"))}</p>`;
    html += ents.map((e) => `<button type="button" class="mg-card mg-pick" data-tm="pick" data-id="${esc(e.entity_id)}" role="radio" aria-checked="${d.entity_id === e.entity_id}">
      <span class="mg-row"><span class="mg-ic" aria-hidden="true">${timerEmoji(e.domain)}</span><span class="mg-t"><b>${esc(e.name)}</b><small>${esc(e.entity_id)}</small></span>
      <span class="mg-val${e.available ? "" : " off"}">${esc(this.stateWord(e))}</span><span class="mg-radio${d.entity_id === e.entity_id ? " on" : ""}"></span></span></button>`).join("");
    const e = this.entity(d.entity_id);
    if (!e) return html;
    html += `<div class="mg-k">${esc(t("tmAction"))}</div>${this.tabsHtml(e.actions.map((a) => ({ on: d.action === a, attrs: `data-tm="action" data-v="${a}"`, label: t(`tmAct_${actKey(e.domain, a)}`) })))}`;
    if (opposite(d.action)) {
      html += `<div class="mg-k">${esc(t("tmBackLabel"))}</div>
        ${this.tabsHtml(BACK_PRESETS.map((s) => ({ on: !d.backOwn.text && d.back_s === s, attrs: `data-tm="bdur" data-s="${s}"`, label: s ? this.fmtDur(s) : t("tmBackNever") })))}
        ${this.ownHtml("back", d.backOwn, t("tmOwnTime"))}
        ${this.backError() ? `<div class="opt-error" data-tm-err="back">${esc(this.backError())}</div>` : ""}`;
    } else html += `<p class="mg-hint">${esc(t("tmToggleNoBack"))}</p>`;
    return `${html}<div data-tm-zone="result">${this.resultHtml()}</div>`;
  }

  resultHtml() {
    const d = this.wiz.draft;
    const e = this.entity(d.entity_id);
    if (!e) return "";
    const w = this.wiz;
    const row = w.tried?.busy
      ? `<span class="opt-short">${this.esc(this.t("tmTryBusy"))}</span>`
      : `<button type="button" class="dlg-btn tm-try" data-tm="try">${this.esc(this.t("tmTryBtn"))}</button>${w.tried?.text ? `<span class="${w.tried.failed ? "opt-error" : "opt-short"}" role="status">${this.esc(w.tried.text)}</span>` : ""}`;
    return `<p class="mg-note tm-result">${this.esc(this.t("tmResult", this.sentenceOf({ entity_id: d.entity_id, action: d.action, back_s: d.back_s }, e.name)))}</p>
      <div class="mg-testrow tm-tryrow">${row}</div><p class="mg-hint">${this.esc(this.t("tmTryNote"))}</p>`;
  }

  // Testknopf: schaltet die gewählte Entität jetzt, ohne Timer und ohne Zurückschalten
  async tryNow() {
    const w = this.wiz;
    if (!w || w.tried?.busy) return;
    const d = w.draft;
    w.tried = { busy: true };
    this.paintZones(["result"]);
    try {
      const r = await this.call({ type: "device_panel/timer_try", entity_id: d.entity_id, action: d.action });
      w.tried = r.ok ? { text: this.t("tmTryDone") } : { text: this.t("tmTryFail", this.t(r.reason === "unavailable" ? "tmTryUnavailable" : "tmTryError")), failed: true };
    } catch (err) {
      w.tried = { text: this.t("tmTryFail", this.h.errText(err)), failed: true };
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
      const r = await this.call({ type: "device_panel/timer_get", device_id: this.deviceId });
      if (this.wiz !== w || !Array.isArray(r?.entities)) return;
      this.data.entities = r.entities;
      this.paint();
    } catch {
      // Der Stand bleibt wie er war; das Ergebnis des Schaltens steht schon da
    }
  }

  // Schritt 2: Wann
  step2Html() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    let html = this.tabsHtml([["countdown", "tmKindIn"], ["once", "tmKindOnce"], ["repeat", "tmKindRepeat"]].map(([k, label]) => ({ on: d.kind === k, attrs: `data-tm="kind" data-v="${k}"`, label: t(label) })));
    if (d.kind === "countdown") {
      html += `<div class="mg-k">${esc(t("tmInLabel"))}</div>
        ${this.tabsHtml(DELAY_PRESETS.map((s) => ({ on: !d.delayOwn.text && d.delay_s === s, attrs: `data-tm="delay" data-s="${s}"`, label: this.fmtDur(s) })))}
        ${this.ownHtml("delay", d.delayOwn, t("tmOwnTime"))}
        ${this.delayError() ? `<div class="opt-error" data-tm-err="delay">${esc(this.delayError())}</div>` : ""}
        <p class="mg-hint">${esc(t("tmCountdownNote"))}</p>`;
    } else if (d.kind === "once") {
      // Schalter "Bestimmtes Datum" (aus = nächstes Eintreffen der Uhrzeit, an = Datum, zuerst morgen)
      html += `<div class="mg-optrow"><div>${esc(t("tmDateSwitch"))}</div><label class="switch"><input type="checkbox" data-tm="date-on"${d.date ? " checked" : ""} aria-label="${esc(t("tmDateSwitch"))}"><span></span></label></div>${
        d.date ? `<input class="mg-input tm-datein" type="date" data-tm="date" value="${esc(d.date)}" min="${esc(this.data.today || "")}" aria-label="${esc(t("tmDate"))}">` : ""
      }
        <div class="mg-k">${esc(t("tmTime"))}</div>
        <input class="mg-input tm-timein" type="time" data-tm="time" value="${esc(d.time)}" aria-label="${esc(t("tmTime"))}">
        <p class="mg-hint">${esc(t(d.date ? "tmOnceNote" : "tmOnceNoteNoDate"))}</p>`;
    } else {
      html += `<div class="mg-k">${esc(t("tmTime"))}</div>
        <input class="mg-input tm-timein" type="time" data-tm="time" value="${esc(d.time)}" aria-label="${esc(t("tmTime"))}">
        <div class="mg-k">${esc(t("tmRepeatLabel"))}</div>
        ${this.tabsHtml([["daily", "tmDaily"], ["weekly", "tmWeekly"], ["monthly", "tmMonthly"]].map(([k, label]) => ({ on: d.repeat === k, attrs: `data-tm="repeat" data-v="${k}"`, label: t(label) })))}`;
      if (d.repeat === "weekly") {
        html += `<div class="mg-k">${esc(t("tmDaysLabel"))}</div><div class="tm-wd" role="group" aria-label="${esc(t("tmDaysLabel"))}">${WEEKDAYS.map((i) => `<button type="button" class="${d.weekdays.includes(i) ? "on" : ""}" data-tm="wd" data-d="${i}" aria-pressed="${d.weekdays.includes(i)}">${esc(this.wd(i))}</button>`).join("")}</div>`;
      } else if (d.repeat === "monthly") {
        const sel = d.mdayOwn ? "own" : d.mday === 1 ? "1" : d.mday === 15 ? "15" : d.mday === -1 ? "last" : "own";
        html += `<div class="mg-k">${esc(t("tmMonthDay"))}</div>
          ${this.tabsHtml([["1", "1."], ["15", "15."], ["last", t("tmLastDay")], ["own", t("tmOtherDay")]].map(([k, label]) => ({ on: sel === k, attrs: `data-tm="mday" data-v="${k}"`, label })))}
          ${sel === "own" ? `<div class="mg-own"><span>${esc(t("tmMonthDay"))}</span><input class="mg-pill num mg-ownin" type="text" inputmode="numeric" data-tm="mday-own" value="${esc(d.mday > 0 ? d.mday : "")}" placeholder="1–31" aria-label="${esc(t("tmMonthDay"))}" autocomplete="off"></div>` : ""}
          <p class="mg-hint">${esc(t("tmMonthNote"))}</p>`;
      }
      html += `<p class="mg-hint">${esc(t("tmTzNote"))}</p>`;
    }
    return `${html}<div data-tm-zone="runs">${this.runsHtml()}</div>`;
  }

  // Nächste Ausführungen (vom Server, Zeitzone der Instanz)
  runsHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const w = this.wiz;
    if (w.pvError && w.step === 2) return `<div class="opt-error" role="alert">${esc(w.pvError)}</div>`;
    const runs = w.pv?.next_runs;
    if (!runs?.length) return "";
    const label = w.draft.kind === "countdown" ? t("tmRunsAt") : t("tmNextRuns");
    // Mit "danach wieder zurückschalten": darunter, wann es wieder ein-/ausgeschaltet wird (vom Server auf die Minute genau gerechnet)
    const rows = runs.map((r) => `<div><span>${esc(this.dateText(r))}</span><span>${esc(r.time)}</span>${this.backLine(r)}</div>`).join("");
    return `<div class="mg-k">${esc(label)}</div><div class="tm-next">${rows}</div>`;
  }

  // Zeile "wieder aus: morgen 06:50" unter einer Ausführung, wenn zurückgeschaltet wird (seit 2.26.0)
  backLine(run) {
    const d = this.wiz.draft;
    if (!run?.back || !d.back_s || !opposite(d.action)) return "";
    const word = this.t(`tmRes_${resKey(this.domainOf(d.entity_id), opposite(d.action))}`);
    return `<small>${this.esc(this.t("tmBackAtRow", word, this.localText(run.back)))}</small>`;
  }

  // Schritt 3: Meldung
  step3Html() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    let html = `<p class="mg-note">${esc(t("tmPushNote"))}</p>
      <div class="mg-optrow"><div>${esc(t("tmPushSwitch"))}</div><label class="switch"><input type="checkbox" data-tm="push"${d.push ? " checked" : ""} aria-label="${esc(t("tmPushSwitch"))}"><span></span></label></div>`;
    if (!d.push) return `${html}<p class="mg-hint">${esc(t("tmPushOffNote"))}</p>`;
    html += `<div class="mg-k">${esc(t("tmRecipient"))}</div>
      <button type="button" class="mg-sel" data-tm="target-toggle" aria-expanded="${this.wiz.targetOpen}"><span>${esc(d.target ? this.niceTarget(d.target) : t("tmTargetDefault"))}<small>${esc(d.target || this.targetSub())}</small></span>${this.chevHtml(this.wiz.targetOpen)}</button>`;
    if (this.wiz.targetOpen) html += `<div class="mg-list" role="listbox">${this.targetListHtml()}</div>`;
    html += `<p class="mg-hint">${esc(t("tmTargetHint"))}</p>`;
    return `${html}<div data-tm-zone="pv">${this.pvHtml()}</div>`;
  }

  targetListHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    const row = (value, title, sub) =>
      `<button type="button" class="mg-opt-row${d.target === value ? " on" : ""}" data-tm="target" data-v="${esc(value)}" role="option" aria-selected="${d.target === value}"><span>${esc(title)}${sub ? `<br><small>${esc(sub)}</small>` : ""}</span>${d.target === value ? "<span>✓</span>" : ""}</button>`;
    let html = row("", t("tmTargetDefault"), this.targetSub());
    for (const [kind, label] of [["group", "tmTargetGroups"], ["service", "tmTargetServices"], ["entity", "tmTargetEntities"], ["missing", "tmTargetMissing"]]) {
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
    if (w.pvError) inner = `<div class="opt-error">${esc(t("tmPvError", w.pvError))}</div>`;
    else if (!w.pv) inner = `<div class="pv-text">…</div>`;
    else inner = `<div class="pv-title">${esc(w.pv.title)}</div><div class="pv-text">${esc(w.pv.message)}</div>`;
    const test = w.test?.busy
      ? `<div class="mg-testrow"><span class="opt-short">${esc(t("tmTestBusy"))}</span></div>`
      : `<div class="mg-testrow"><button type="button" class="linkbtn" data-tm="test">${esc(t("tmTestSend"))}</button>${w.test?.text ? `<span class="${w.test.failed ? "opt-error" : "opt-short"}" role="status">${esc(w.test.text)}</span>` : ""}</div>`;
    return `<div class="mg-pv"><div class="pv-k">${esc(t("tmPvLabel"))}</div><div class="pv-card"><div class="pv-app">${this.h.logo}${esc(t("tmPvApp"))}</div>${inner}</div><div class="opt-short">${esc(t("tmPvNote"))}</div>${test}</div>`;
  }

  // Schritt 4: Name und Prüfung
  step4Html() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.wiz.draft;
    const e = this.entity(d.entity_id);
    const placeholder = e ? e.name : "";
    return `<label class="mg-k" for="tm-name">${esc(t("tmName"))}</label>
      <input id="tm-name" class="mg-input" type="text" maxlength="${this.limit("name", 60)}" data-tm="name" value="${esc(d.name)}" placeholder="${esc(placeholder)}" autocomplete="off">
      <p class="mg-hint">${esc(t("tmNameHint"))}</p>
      <div data-tm-zone="summary">${this.summaryHtml()}</div>
      <div class="mg-optrow"><div>${esc(t("tmEnabled"))}<small>${esc(t("tmEnabledNote"))}</small></div><label class="switch"><input type="checkbox" data-tm="enabled"${d.enabled ? " checked" : ""} aria-label="${esc(t("tmEnabled"))}"><span></span></label></div>`;
  }

  summaryHtml() {
    const esc = (v) => this.esc(v);
    const t = (k, ...a) => this.t(k, ...a);
    const w = this.wiz;
    const d = w.draft;
    const e = this.entity(d.entity_id);
    const tm = { ...this.payload(), entity_id: d.entity_id, weekdays: d.weekdays, mday: d.mday, time: d.time, date: d.date, delay_s: d.delay_s, back_s: d.back_s };
    let html = `<div class="tm-sum"><b>${esc(this.whenText(tm))}</b>: ${esc(this.sentenceOf(tm, e?.name || ""))}.`;
    if (d.push) html += `<br>🔔 ${esc(t("tmSumPush", d.target ? this.niceTarget(d.target) : t("tmTargetDefaultShort")))}`;
    html += `</div>`;
    const first = w.pv?.next_runs?.[0];
    if (first) html += `<div class="mg-k">${esc(t("tmNextRun2"))}</div><div class="tm-next"><div><span>${esc(this.localText(first))}</span>${this.backLine(first)}</div></div>`;
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

  setStep(step) {
    this.wiz.step = Math.min(Math.max(step, this.wiz.pick ? 0 : 1), STEPS);
    this.paint();
    this.scrollTop();
    this.requestPreview();
  }

  onClick(ev) {
    const el = ev.target.closest?.("[data-tm]");
    if (!el || !this.inScope(el) || el.disabled) return;
    const w = this.wiz;
    const id = el.dataset.id;
    switch (el.dataset.tm) {
      case "reload":
        this.error = null;
        this.paint();
        this.load(this.deviceId);
        break;
      case "add":
        this.startWizard();
        break;
      case "edit": {
        const tm = this.data?.timers.find((x) => x.id === id);
        if (tm) this.startWizard(tm);
        break;
      }
      case "run":
        this.run(id);
        break;
      case "restart":
        this.restart(id);
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
        this.setStep(w.step - 1);
        break;
      case "dev":
        w.pickId = id;
        this.paint();
        break;
      case "nav-next":
        if (!this.canNext()) break;
        if (w.step === 0) this.chooseDevice();
        else this.setStep(w.step + 1);
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
        w.tried = null;
        if (!e.actions.includes(w.draft.action)) w.draft.action = e.actions[0];
        if (!opposite(w.draft.action)) w.draft.back_s = 0;
        this.paint();
        break;
      }
      case "action":
        w.draft.action = el.dataset.v;
        w.tried = null;
        if (!opposite(w.draft.action)) {
          w.draft.back_s = 0;
          w.draft.backOwn = { text: "", unit: 60 };
        }
        this.paint();
        break;
      case "bdur":
        w.draft.back_s = Number(el.dataset.s);
        w.draft.backOwn = { text: "", unit: 60 };
        this.paint();
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
    }
  }

  parseOwn(text, unit) {
    const n = Number(String(text).replace(",", "."));
    return text.trim() !== "" && Number.isFinite(n) && n > 0 ? Math.round(n * unit) : NaN;
  }

  onInput(ev) {
    const el = ev.target;
    const w = this.wiz;
    if (!w || !this.inScope(el) || !el.dataset?.tm) return;
    const d = w.draft;
    switch (el.dataset.tm) {
      case "dev-search":
        w.devQuery = el.value;
        this.paintZones(["devs"]);
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
    }
  }

  // Eigene Zeit getippt: Fehlertext und Satz nachführen, ohne das Feld neu zu zeichnen
  afterOwn(kind) {
    const w = this.wiz;
    const win = this.win();
    // Eigene Zeit getippt: keine Voreinstellung gilt mehr, die Kapsel verschwindet
    for (const b of win.querySelectorAll(`[data-tm="${kind === "back" ? "bdur" : "delay"}"].on`)) {
      b.classList.remove("on");
      b.setAttribute("aria-checked", "false");
    }
    if (kind === "back") {
      const err = this.backError();
      let box = win.querySelector('[data-tm-err="back"]');
      if (err && !box) {
        box = document.createElement("div");
        box.className = "opt-error";
        box.dataset.tmErr = "back";
        win.querySelector(".mg-own")?.after(box);
      }
      if (box) {
        box.textContent = err;
        box.hidden = !err;
      }
      this.paintZones(["result"]);
    } else {
      const err = this.delayError();
      let box = win.querySelector('[data-tm-err="delay"]');
      if (err && !box) {
        box = document.createElement("div");
        box.className = "opt-error";
        box.dataset.tmErr = "delay";
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
    if (el.dataset?.tm === "toggle" && this.inScope(el)) {
      this.toggle(el.dataset.id, el.checked, el);
      return;
    }
    if (!w || !this.inScope(el) || !el.dataset?.tm) return;
    const d = w.draft;
    switch (el.dataset.tm) {
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
    }
  }
}
