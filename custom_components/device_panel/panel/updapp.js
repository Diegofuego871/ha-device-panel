/**
 * App "Geräte-Updates" (seit 2.164.0, docs/mockups/updates-v1, Variante A): alle offenen Geräte-Updates in einem Fenster. Chips nach Integration
 * wählen vor, die Kästchen vorne verfeinern, ein Knopf startet die Auswahl nach einer Rückfrage. Der Server (update_queue.py) arbeitet die Auswahl
 * ab, höchstens drei Updates gleichzeitig und eines je Integration; das Fenster darf zu sein. Die Zahlen kommen von device_panel/updates_list,
 * der Fortschritt (Prozent, Neustart) direkt aus dem Zustand der Update-Entität in hass.states. Nur für Administratoren.
 */

const REFRESH_MS = 3000;
// Merkmal "Backup" der Update-Entität (UpdateEntityFeature.BACKUP)
const FEATURE_BACKUP = 8;

export class UpdApp {
  constructor(host, deps) {
    this.host = host;
    this.h = deps;
    this.data = { available: [], queue: [] };
    this.error = "";
    // view: "list" (Auswahl), "run" (Stand der gestarteten); step: "list" oder "confirm" (Rückfrage vor dem Start)
    this.ui = { view: "list", step: "list", filter: "all", sel: new Set(), backup: true, busy: false, loaded: false };
    this._timer = null;
    this._sig = "";
  }

  t(key, ...args) {
    return this.host._t(key, ...args);
  }

  get dlg() {
    return this.host.shadowRoot.querySelector("dialog.updapp-dlg");
  }

  // --- Öffnen und Schliessen ---------------------------------------------------

  async open() {
    const dlg = this.dlg;
    if (!dlg) return;
    if (!dlg.open) {
      this.ui = { view: "list", step: "list", filter: "all", sel: new Set(), backup: true, busy: false, loaded: false };
      this.error = "";
      this.frame();
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    await this.load(true);
    window.clearInterval(this._timer);
    this._timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") this.load();
    }, REFRESH_MS);
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
    dlg.addEventListener("close", () => {
      window.clearInterval(this._timer);
      this._timer = null;
    });
    dlg.addEventListener("click", (ev) => {
      if (ev.target === dlg) {
        const r = dlg.getBoundingClientRect();
        if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) this.close();
        return;
      }
      const el = ev.target.closest("[data-ua]");
      if (!el) return;
      const act = el.dataset.ua;
      if (act === "close") this.close();
      else if (act === "filter") this.setFilter(el.dataset.key);
      else if (act === "next") {
        this.ui.step = "confirm";
        this.render();
      } else if (act === "back") {
        this.ui.step = "list";
        this.render();
      } else if (act === "go") this.start([...this.ui.sel]);
      else if (act === "retry") this.start([el.dataset.entity]);
      else if (act === "tolist") {
        this.ui.view = "list";
        this.ui.step = "list";
        this.render();
      } else if (act === "info") {
        // Einzelnes Update mit Release Notes im bekannten Fenster (2.161.0), darüber gelegt
        this.host._openUpdate(el.dataset.entity, el.dataset.device);
      }
    });
    dlg.addEventListener("change", (ev) => {
      const el = ev.target;
      if (el.matches?.("[data-ua-sel]")) {
        if (el.checked) this.ui.sel.add(el.dataset.uaSel);
        else this.ui.sel.delete(el.dataset.uaSel);
        this.render();
      } else if (el.matches?.("[data-ua-backup]")) this.ui.backup = el.checked;
    });
  }

  // --- Daten -----------------------------------------------------------------

  async load(first = false) {
    try {
      const res = await this.host._hass.callWS({ type: "device_panel/updates_list" });
      this.data = res;
      this.error = "";
      const active = res.queue.some((q) => q.status === "waiting" || q.status === "running");
      if (first && !this.ui.loaded) {
        // Beim ersten Öffnen: läuft schon etwas, gleich den Stand zeigen; sonst alles vorwählen
        this.ui.view = active ? "run" : "list";
        this.ui.sel = new Set(res.available.map((u) => u.entity_id));
      }
      this.ui.loaded = true;
      // Was nicht mehr offen ist, aus der Auswahl nehmen
      const open = new Set(res.available.map((u) => u.entity_id));
      for (const id of [...this.ui.sel]) if (!open.has(id)) this.ui.sel.delete(id);
    } catch (err) {
      this.error = this.h.errText(err);
    }
    this.render();
  }

  // Aus set hass: nur neu zeichnen, wenn sich Zustand oder Prozent einer gezeigten Update-Entität geändert haben
  onHass() {
    if (!this.dlg?.open) return;
    const states = this.host._hass?.states || {};
    const ids = [...this.data.queue, ...this.data.available].map((u) => u.entity_id);
    const sig = ids.map((id) => { const s = states[id]; return s ? `${s.state}|${s.attributes?.in_progress}|${s.attributes?.update_percentage}` : "-"; }).join(",");
    if (sig === this._sig) return;
    this._sig = sig;
    this.render();
  }

  // Zeilen: Name des Geräts, Integration (Anzeigename), Versionen
  info(u) {
    const d = this.host._devices.find((x) => x.id === u.device_id);
    return { name: d?.name || u.title, integ: this.host._scopeName(u.platform) };
  }

  async start(ids) {
    if (!ids.length || this.ui.busy) return;
    this.ui.busy = true;
    this.render();
    try {
      const res = await this.host._hass.callWS({ type: "device_panel/updates_start", entity_ids: ids, backup: this.ui.backup && this.backupPossible(ids) });
      this.data.queue = res.queue;
      this.ui.view = "run";
      this.ui.step = "list";
      this.error = "";
    } catch (err) {
      this.error = this.h.errText(err);
      this.ui.step = "list";
    }
    this.ui.busy = false;
    this.render();
  }

  backupPossible(ids) {
    const by = new Map(this.data.available.map((u) => [u.entity_id, u]));
    return ids.some((id) => (by.get(id)?.features || 0) & FEATURE_BACKUP);
  }

  setFilter(key) {
    this.ui.filter = key;
    // Der Chip wählt genau seine Geräte vor ("Alle": alle)
    this.ui.sel = new Set(this.data.available.filter((u) => key === "all" || u.platform === key).map((u) => u.entity_id));
    this.ui.step = "list";
    this.render();
  }

  // --- Anzeige ---------------------------------------------------------------

  frame() {
    const { escape, mdi } = this.h;
    this.dlg.innerHTML = `<div class="dlg-head"><span class="dlg-avatar">${mdi("verUp", 28)}</span>
        <div class="dlg-title"><h2>${escape(this.t("appupTitle"))}</h2><div class="dlg-sub" data-ua-sub></div></div>
        <button type="button" class="dlg-close" data-ua="close" title="${escape(this.t("close"))}" aria-label="${escape(this.t("close"))}">${mdi("close", 18)}</button></div>
      <div class="dlg-body" data-ua-body></div><div class="dlg-actions" data-ua-foot></div>`;
    this.render();
  }

  render() {
    const dlg = this.dlg;
    const body = dlg?.querySelector("[data-ua-body]");
    if (!body) return;
    const { escape } = this.h;
    const t = (k, ...a) => this.t(k, ...a);
    const scroll = body.scrollTop;
    const run = this.ui.view === "run" && this.data.queue.length > 0;
    const avail = this.data.available;
    const sub = dlg.querySelector("[data-ua-sub]");
    const foot = dlg.querySelector("[data-ua-foot]");
    const closeBtn = (cls = "") => `<button type="button" class="dlg-btn${cls}" data-ua="close">${this.h.mdi("close", 18)}${escape(t("close"))}</button>`;
    const err = this.error ? `<div class="dlg-error">${escape(this.error)}</div>` : "";
    if (!this.ui.loaded) {
      sub.textContent = "";
      body.innerHTML = `<div class="ver-prog"><i></i></div>`;
      foot.innerHTML = closeBtn();
      return;
    }
    if (run) {
      const q = this.data.queue;
      const count = (s) => q.filter((x) => this.runState(x).kind === s).length;
      const parts = [
        [count("running"), "appupRunN"],
        [count("waiting"), "appupWaitN"],
        [count("done"), "appupDoneN"],
        [count("failed"), "appupFailN"],
      ].filter(([n]) => n);
      sub.textContent = parts.map(([n, k]) => t(k, n)).join(" · ");
      body.innerHTML = `${err}<div class="ua-list">${q.map((x) => this.runRow(x)).join("")}</div>`;
      const active = count("running") + count("waiting") > 0;
      const more = !active && avail.some((u) => !q.some((x) => x.entity_id === u.entity_id && (x.status === "waiting" || x.status === "running")));
      foot.innerHTML = `${more ? `<button type="button" class="dlg-btn" data-ua="tolist">${this.h.mdi("arrowLeft", 18)}${escape(t("appupToList"))}</button>` : ""}${closeBtn(more ? "" : " primary")}`;
    } else if (!avail.length) {
      sub.textContent = t("appupAllCurrent");
      body.innerHTML = `${err}<div class="ua-empty">${this.h.mdi("check", 34)}<p>${escape(t("appupEmpty"))}</p></div>`;
      foot.innerHTML = closeBtn(" primary");
    } else if (this.ui.step === "confirm") {
      const n = this.ui.sel.size;
      sub.textContent = t("appupAvail", avail.length);
      const backup = this.backupPossible([...this.ui.sel]);
      body.innerHTML = `${err}<div class="nf-note">${this.h.mdi("alert", 16)}<div><p><b>${escape(t("appupConfirmTitle", n))}</b></p><p>${escape(t("appupConfirmText"))}</p></div></div>
        ${backup ? `<label class="ua-backup"><span class="switch"><input type="checkbox" data-ua-backup ${this.ui.backup ? "checked" : ""}><span></span></span><span>${escape(t("appupBackup"))}<small>${escape(t("appupBackupHint"))}</small></span></label>` : ""}`;
      foot.innerHTML = `<button type="button" class="dlg-btn" data-ua="back">${this.h.mdi("arrowLeft", 18)}${escape(t("updBack"))}</button><button type="button" class="dlg-btn primary" data-ua="go" ${this.ui.busy ? "disabled" : ""}>${this.h.mdi("verDownload", 18)}${escape(t("appupConfirmYes", n))}</button>`;
    } else {
      sub.textContent = t("appupAvail", avail.length);
      const groups = new Map();
      for (const u of avail) groups.set(u.platform, (groups.get(u.platform) || 0) + 1);
      const chips = [["all", t("appupAll"), avail.length], ...[...groups].map(([k, n]) => [k, this.host._scopeName(k), n])]
        .map(([k, label, n]) => `<button type="button" class="chip${this.ui.filter === k ? " on" : ""}" data-ua="filter" data-key="${escape(k)}"><span>${escape(label)}</span><span class="n">${n}</span></button>`)
        .join("");
      const rows = avail.map((u) => this.listRow(u)).join("");
      body.innerHTML = `${err}<div class="ua-chips">${chips}</div><div class="ua-list">${rows}</div>`;
      const n = this.ui.sel.size;
      foot.innerHTML = `${closeBtn()}<button type="button" class="dlg-btn primary" data-ua="next" ${n ? "" : "disabled"}>${this.h.mdi("verDownload", 18)}${escape(t("appupStart", n))}</button>`;
    }
    body.scrollTop = scroll;
  }

  listRow(u) {
    const { escape, mdi } = this.h;
    const { name, integ } = this.info(u);
    const on = this.ui.sel.has(u.entity_id);
    return `<div class="ua-row"><label class="ua-cb"><input type="checkbox" data-ua-sel="${escape(u.entity_id)}" ${on ? "checked" : ""} aria-label="${escape(name)}"><span>${mdi("check", 14)}</span></label>
      <button type="button" class="ua-main" data-ua="info" data-entity="${escape(u.entity_id)}" data-device="${escape(u.device_id)}"><span class="ua-t"><b>${escape(name)}</b><small>${escape(integ)} · ${escape(u.installed ?? "?")} → ${escape(u.latest ?? "?")}</small></span><span class="cbtn" aria-hidden="true">${mdi("chevronRight", 16)}</span></button></div>`;
  }

  // Zustand einer gestarteten Zeile: Warteschlange des Servers, Fortschritt aus dem Zustand der Entität
  runState(x) {
    const st = this.host._hass?.states?.[x.entity_id];
    const a = st?.attributes || {};
    const raw = a.in_progress;
    const percent = Number.isFinite(Number(a.update_percentage)) && a.update_percentage != null ? Number(a.update_percentage) : typeof raw === "number" ? raw : null;
    if (x.status === "waiting") return { kind: "waiting" };
    if (x.status === "done") return { kind: "done" };
    if (x.status === "failed") return { kind: "failed" };
    const gone = !st || st.state === "unavailable" || st.state === "unknown";
    return { kind: "running", percent: gone ? null : percent, gone, active: raw === true || typeof raw === "number" };
  }

  runRow(x) {
    const { escape, mdi } = this.h;
    const t = (k, ...a) => this.t(k, ...a);
    const d = this.host._devices.find((v) => v.id === x.device_id);
    const name = d?.name || x.title;
    const s = this.runState(x);
    let line = "";
    let cls = "";
    let extra = "";
    let lead = "";
    if (s.kind === "waiting") line = t("appupWaiting");
    else if (s.kind === "done") {
      line = t("updDone", x.latest ?? "?");
      cls = " ok";
      lead = `<span class="ua-ic ok">${mdi("check", 16)}</span>`;
    } else if (s.kind === "failed") {
      line = t("appupFailed");
      cls = " bad";
      lead = `<span class="ua-ic bad">${mdi("alert", 16)}</span>`;
      extra = `<button type="button" class="ua-retry" data-ua="retry" data-entity="${escape(x.entity_id)}" title="${escape(t("appupRetry"))}" aria-label="${escape(t("appupRetry"))}">${mdi("reset", 16)}</button>`;
    } else {
      line = s.gone ? t("updRebooting") : s.percent != null ? t("updPercent", Math.round(s.percent)) : t("updRunning");
      extra = s.gone ? `<div class="upd-bar"><i style="width:100%"></i></div>` : s.percent != null ? `<div class="upd-bar" role="progressbar" aria-valuenow="${Math.round(s.percent)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(2, Math.min(100, s.percent))}%"></i></div>` : `<div class="ver-prog"><i></i></div>`;
    }
    return `<div class="ua-row run ${s.kind}">${lead}<div class="ua-t"><b>${escape(name)}</b><small class="ua-st${cls}">${escape(line)}</small>${s.kind === "running" ? extra : ""}</div>${s.kind === "failed" ? extra : ""}</div>`;
  }
}
