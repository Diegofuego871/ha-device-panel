/**
 * App "Status" (seit 2.62.0, docs/mockups/status-v1, Variante A): Läuft die Integration? Oben der kleine Config-Teil (Meldung bei
 * Stillstand: Schalter und Empfänger als Auswahlliste wie bei den Reitern der Einstellungen), darunter der Zustand der Teile (läuft,
 * verspätet, steht) und die Zeile zum letzten Start. Die Zahlen kommen von device_panel/status_get (status.py), die Einstellungen
 * lesen und schreiben get_options / set_options; das Fenster fragt alle 10 Sekunden neu, solange es offen ist.
 */

const REFRESH_MS = 10000;
const PART_ORDER = ["routines", "magic", "availability", "battery", "charge", "new", "updates", "signal"];

export class StatusUi {
  constructor(host, deps) {
    this.host = host;
    this.h = deps;
    this.data = null;
    this.cfg = null;
    this.error = null;
    this.saving = false;
    this._timer = null;
  }

  t(key, ...args) {
    return this.host._t(key, ...args);
  }

  get dlg() {
    return this.host.shadowRoot.querySelector("dialog.status-dlg");
  }

  // --- Öffnen und Schliessen ---------------------------------------------------

  open() {
    const dlg = this.dlg;
    if (!dlg) return;
    this.frame();
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    this.load();
    window.clearInterval(this._timer);
    this._timer = window.setInterval(() => this.load(), REFRESH_MS);
  }

  close() {
    window.clearInterval(this._timer);
    this._timer = null;
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
      if (ev.target.closest("[data-st-close]")) this.close();
    });
    dlg.addEventListener("cancel", () => this.close());
    dlg.addEventListener("change", (ev) => {
      const el = ev.target;
      if (el.matches("[data-st-notify]")) this.save({ status_notify: el.checked });
      else if (el.matches("[data-st-target]")) this.save({ notify_service_status: el.value });
    });
  }

  // --- Laden und Speichern -----------------------------------------------------

  async load() {
    const call = (msg) => this.host._hass.callWS(msg);
    try {
      const [snap, opts] = await Promise.all([call({ type: "device_panel/status_get" }), call({ type: "device_panel/get_options" })]);
      this.data = snap;
      this.cfg = { values: opts.values, targets: opts.notify_targets || [] };
      this.error = null;
      this.host._statusSum = { problems: snap.problems, down: snap.down };
      this.host._apps?.paintDots();
    } catch (err) {
      this.error = this.h.errText(err);
    }
    this.render();
  }

  async save(values) {
    if (this.saving) return;
    this.saving = true;
    try {
      await this.host._hass.callWS({ type: "device_panel/set_options", values });
      this.error = null;
    } catch (err) {
      this.error = this.h.errText(err);
    }
    this.saving = false;
    await this.load();
  }

  // --- Anzeige -----------------------------------------------------------------

  frame() {
    const dlg = this.dlg;
    const { escape, mdi } = this.h;
    dlg.innerHTML = `<div class="dlg-head"><span class="dlg-avatar">${mdi("pulse", 28)}</span>
        <div class="dlg-title"><h2>${escape(this.t("stTitle"))}</h2><div class="dlg-sub">${escape(this.t("stSub"))}</div></div>
        <button type="button" class="dlg-close" data-st-close title="${escape(this.t("close"))}" aria-label="${escape(this.t("close"))}">${mdi("close", 18)}</button></div>
      <div class="dlg-body"><div class="st-wrap" data-st-body></div></div>`;
    this.render();
  }

  render() {
    const body = this.dlg?.querySelector("[data-st-body]");
    if (!body) return;
    // Auswahl nicht zerstören, solange sie geöffnet ist (Neuzeichnen alle 10 Sekunden)
    if (this.host.shadowRoot.activeElement?.matches?.("[data-st-target]")) return;
    const scroll = body.closest(".dlg-body")?.scrollTop || 0;
    body.innerHTML = this.html();
    const sc = body.closest(".dlg-body");
    if (sc) sc.scrollTop = scroll;
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
    const own = v.notify_service_status || "";
    // Kein Ziel (weder eigenes noch globales): der Schalter ist an, aber es geht nichts raus. Das soll nicht still bleiben.
    const target = own || global;
    const noTarget = Boolean(v.status_notify) && (!target || target === "none");
    const select = `<span class="opt-select"><select data-st-target aria-label="${escape(t("optNotifyTargetTab"))}">${options
      .map(([val, text]) => `<option value="${escape(val)}"${val === own ? " selected" : ""}>${escape(text)}</option>`)
      .join("")}</select>${this.h.mdi("chevronDown", 18)}</span>`;
    return `<div class="set-title">${escape(t("stCfgTitle"))}</div>
      <div class="opt"><div class="opt-line"><span class="opt-label">${escape(t("stNotify"))}</span>
        <label class="switch"><input type="checkbox" data-st-notify ${v.status_notify ? "checked" : ""} aria-label="${escape(t("stNotify"))}"><span></span></label></div>
        <div class="opt-short">${escape(t("stNotifyShort"))}</div></div>
      <div class="opt"><div class="opt-line"><span class="opt-label">${escape(t("optNotifyTargetTab"))}</span>${select}</div>
        <div class="opt-short">${escape(t("stTargetShort"))}</div>
        ${noTarget ? `<div class="opt-warn" data-st-notarget role="alert">${this.h.mdi("alert", 14)}<span>${escape(t("stNoTarget"))}</span></div>` : ""}</div>`;
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
    const rows = parts.map((p) => `<div class="st-line"><span class="st-t"><b>${escape(t(`stPart_${p.id}`))}</b><small>${escape(this.partText(p))}</small></span>${pill(p.state)}</div>`).join("");
    const started = new Date(d.started * 1000).toLocaleString(this.host._locale?.() || undefined, { dateStyle: "short", timeStyle: "short" });
    return `<div class="set-title">${escape(t("stStateTitle"))}</div>${banner}<div class="st-card">${rows}</div>
      <p class="st-start">${escape(t("stStart", started, d.routines_loaded, d.routines_missed))}</p>
      ${this.error ? `<div class="dlg-error" role="alert">${escape(this.error)}</div>` : ""}`;
  }

  html() {
    return `${this.configHtml()}${this.zoneHtml()}`;
  }
}
