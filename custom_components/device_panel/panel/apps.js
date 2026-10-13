/**
 * App-Launcher (seit 2.31.0, docs/mockups/launcher-v2).
 *
 * Ein Knopf in der Kopfzeile öffnet eine Übersicht nützlicher Seiten ("Apps"): eigene Funktionen des Panels (Timer, Magic Push,
 * Protokoll), Seiten von Home Assistant und eigene Links des Benutzers. Mit dem Herz markierte Apps (höchstens fünf) stehen als
 * Knöpfe direkt in der Kopfzeile, am Handy nur die erste. Der Bearbeiten-Modus sortiert (Ziehen), blendet aus (Auge) und
 * wählt Favoriten; die Darstellung (Raster oder Liste) wählt der Benutzer selbst, getrennt für Desktop und Handy.
 *
 * Alles gehört dem Benutzer: ein Eintrag in den Benutzerdaten von HA (frontend/set_user_data) mit lokaler Kopie im Browser, wie
 * die Herzen der Geräte und Timer. Der neuere Stand gewinnt. Das Protokoll ist nicht ausblendbar, sonst gäbe es keinen Zugang mehr
 * zum Debug-Modus. Externe Links öffnen immer in einem neuen Browser-Tab; als Ziel erlaubt sind nur https:// und http://.
 */

export const APPS_KEY = "device_panel_apps";
export const MAX_FAV = 5;
const MAX_CUSTOM = 30;
const NAME_MAX = 40;
const URL_MAX = 300;
const SAVE_DELAY_MS = 400;
const GROUPS = ["panel", "ha", "own"];

// Eingebaute Apps. act: Funktion des Panels, path: Seite von Home Assistant (admin: nur für Administratoren). Namen und Untertitel
// stehen in strings.js (app_<id>, app_<id>_sub).
const BUILTIN = [
  { id: "timer", group: "panel", icon: "timer", act: "timer" },
  { id: "magic", group: "panel", icon: "bell", act: "magic" },
  { id: "log", group: "panel", icon: "log", act: "log", locked: true },
  { id: "auto", group: "ha", icon: "robot", path: "/config/automation/dashboard", admin: true },
  { id: "scene", group: "ha", icon: "palette", path: "/config/scene/dashboard", admin: true },
  { id: "script", group: "ha", icon: "script", path: "/config/script/dashboard", admin: true },
  { id: "helper", group: "ha", icon: "tune", path: "/config/helpers", admin: true },
  { id: "dev", group: "ha", icon: "devices", path: "/config/devices/dashboard", admin: true },
  { id: "ent", group: "ha", icon: "shape", path: "/config/entities", admin: true },
  { id: "integ", group: "ha", icon: "puzzle", path: "/config/integrations/dashboard", admin: true },
  { id: "tools", group: "ha", icon: "tools", path: "/developer-tools", admin: true },
  { id: "area", group: "ha", icon: "map", path: "/config/areas/dashboard", admin: true },
  { id: "hist", group: "ha", icon: "history", path: "/history" },
  { id: "book", group: "ha", icon: "logbook", path: "/logbook" },
  { id: "backup", group: "ha", icon: "reset", path: "/config/backup", admin: true },
];
export const APP_ICONS = ["web", "home", "camera", "map", "bolt", "calendar", "bar", "wrench", "store", "desktop", "robot", "palette", "script", "devices", "shape", "tools"];

// Favicon einer eigenen App mit externem Link (seit 2.33.0): kleines Bild als Data-URI (base64), vom Server geholt (favicon.py).
// Nur bekannte Bildarten, damit in den Benutzerdaten nie etwas anderes landet; höchstens FAVICON_MAX Zeichen (etwa 100 KB).
const FAVICON_MAX = 140000;
const FAVICON_RE = /^data:image\/(png|x-icon|gif|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/;
export const isFavicon = (v) => typeof v === "string" && v.length <= FAVICON_MAX && FAVICON_RE.test(v);

const defaults = () => ({ fav: ["timer"], hidden: [], order: {}, custom: [], layout: { desktop: "grid", phone: "grid" }, updated: 0 });
const ids = (list, max) =>
  Array.isArray(list) ? [...new Set(list.filter((x) => typeof x === "string" && x.length > 0 && x.length <= 64))].slice(0, max) : [];

// Ziel prüfen: extern nur https:// und http:// (nie javascript: und Verwandte), intern eine Seite von HA ("/…", nicht "//host").
// Gibt das bereinigte Ziel zurück, sonst null.
export function checkTarget(raw, ext) {
  const v = String(raw ?? "").trim();
  if (!v || v.length > URL_MAX || /\s/.test(v)) return null;
  if (ext) {
    try {
      const u = new URL(v);
      return (u.protocol === "https:" || u.protocol === "http:") && u.hostname ? v : null;
    } catch {
      return null;
    }
  }
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : null;
}

// Gespeicherten Stand prüfen: nur bekannte Formen, alles andere fällt auf den Standard zurück.
export function sanitizeApps(raw) {
  const d = defaults();
  if (!raw || typeof raw !== "object") return d;
  const custom = (Array.isArray(raw.custom) ? raw.custom : [])
    .map((c) => {
      if (!c || typeof c !== "object") return null;
      const ext = c.ext === true;
      const url = checkTarget(c.url, ext);
      const name = String(c.name ?? "").trim().slice(0, NAME_MAX);
      const id = typeof c.id === "string" && c.id.length > 0 && c.id.length <= 64 ? c.id : null;
      if (!url || !name || !id) return null;
      const app = { id, name, icon: APP_ICONS.includes(c.icon) ? c.icon : "web", url, ext };
      // Das Favicon gibt es nur bei externen Links
      if (ext && isFavicon(c.favicon)) app.favicon = c.favicon;
      return app;
    })
    .filter(Boolean)
    .slice(0, MAX_CUSTOM);
  const layout = (v) => (v === "list" ? "list" : "grid");
  return {
    fav: Array.isArray(raw.fav) ? ids(raw.fav, MAX_FAV) : d.fav,
    hidden: ids(raw.hidden, 200),
    order: Object.fromEntries(GROUPS.map((g) => [g, ids(raw.order?.[g], 200)])),
    custom,
    layout: { desktop: layout(raw.layout?.desktop), phone: layout(raw.layout?.phone) },
    updated: Number(raw.updated) || 0,
  };
}

export class AppLauncher {
  constructor(host, deps) {
    this.host = host;
    this.h = deps;
    this.data = defaults();
    this.ui = { edit: false, q: "", all: false, form: null, snack: null };
    this.loaded = false;
    this.dirty = false;
  }

  // --- Zugriff auf das Panel ----------------------------------------------------

  t(key, ...args) {
    return this.host._t(key, ...args);
  }

  get root() {
    return this.host.shadowRoot;
  }

  get dlg() {
    return this.root?.querySelector("dialog.apps-dlg");
  }

  get fdlg() {
    return this.root?.querySelector("dialog.app-dlg");
  }

  narrow() {
    return Boolean(this.host._narrowQuery?.matches);
  }

  layoutKey() {
    return this.narrow() ? "phone" : "desktop";
  }

  // --- Daten --------------------------------------------------------------------

  _admin() {
    return this.host._hass?.user?.is_admin !== false;
  }

  _all() {
    const admin = this._admin();
    const t = (k) => this.t(k);
    const builtin = BUILTIN.filter((a) => admin || !a.admin).map((a) => ({ ...a, name: t(`app_${a.id}`), sub: a.path || t(`app_${a.id}_sub`) }));
    const own = this.data.custom.map((c) => ({ id: c.id, group: "own", icon: c.icon, name: c.name, sub: c.url, url: c.url, ext: c.ext, favicon: c.favicon, custom: true }));
    return [...builtin, ...own];
  }

  app(id) {
    return this._all().find((a) => a.id === id) || null;
  }

  isHidden(a) {
    return !a.locked && this.data.hidden.includes(a.id);
  }

  // Apps einer Gruppe in der Reihenfolge des Benutzers; neue (noch nicht einsortierte) hinten, in der Standardfolge.
  // noFav: Favoriten stehen nur im Abschnitt Favoriten, nicht noch einmal in ihrer Gruppe (ausser bei der Suche)
  group(g, withHidden = false, noFav = false) {
    const order = this.data.order[g] || [];
    const rank = (a) => {
      const i = order.indexOf(a.id);
      return i < 0 ? order.length : i;
    };
    const items = this._all().filter((a) => a.group === g);
    const favIds = new Set(noFav ? this.favs().map((a) => a.id) : []);
    return items
      .map((a, i) => [a, i])
      .sort((x, y) => rank(x[0]) - rank(y[0]) || x[1] - y[1])
      .map(([a]) => a)
      .filter((a) => (withHidden || !this.isHidden(a)) && !(noFav && favIds.has(a.id)));
  }

  // Favoriten in der Reihenfolge des Benutzers; was nicht (mehr) existiert oder ausgeblendet ist, fällt weg.
  favs() {
    return this.data.fav
      .map((id) => this.app(id))
      .filter((a) => a && !this.isHidden(a))
      .slice(0, MAX_FAV);
  }

  // --- Speichern (Benutzerdaten von HA, lokale Kopie als Rückfall) ----------------

  _local(write) {
    try {
      if (write) window.localStorage.setItem(APPS_KEY, JSON.stringify(this.data));
      else return window.localStorage.getItem(APPS_KEY);
    } catch {
      // ohne localStorage: nur HA
    }
    return null;
  }

  async load() {
    const raw = this._local(false);
    if (raw) {
      try {
        this.data = sanitizeApps(JSON.parse(raw));
      } catch {
        // kaputte Kopie: Standard
      }
    }
    this.renderBar();
    let value = null;
    try {
      const result = await this.host._hass.callWS({ type: "frontend/get_user_data", key: APPS_KEY });
      value = result ? result.value : null;
    } catch (err) {
      console.warn("device-panel: Apps von HA nicht verfügbar", err);
      return;
    }
    this.loaded = true;
    if (value && !this.dirty && (Number(value.updated) || 0) >= this.data.updated) {
      this.data = sanitizeApps(value);
      this._local(true);
      this.renderBar();
      if (this.dlg?.open) this.render();
      return;
    }
    if (this.data.updated) await this._save();
  }

  async _save() {
    if (!this.host._hass || !this.loaded) return;
    try {
      await this.host._hass.callWS({ type: "frontend/set_user_data", key: APPS_KEY, value: this.data });
      this.dirty = false;
    } catch (err) {
      console.warn("device-panel: Apps nicht bei HA gespeichert", err);
    }
  }

  // Jede Änderung: Zeitstempel, lokale Kopie, verzögert zu HA; Kopfzeile und Fenster nachführen.
  _changed(focusDrag = null) {
    this.data.updated = Date.now();
    this.dirty = true;
    this._local(true);
    window.clearTimeout(this._saveTimer);
    this._saveTimer = window.setTimeout(() => this._save(), SAVE_DELAY_MS);
    this.renderBar();
    this.render();
    if (focusDrag) this.dlg?.querySelector(`[data-ap-drag][data-id="${CSS.escape(focusDrag)}"]`)?.focus();
  }

  // Hinweis unten im Fenster (der Toast der Seite liegt unter dem modalen Fenster: unsichtbar und nicht erreichbar). Mit Knopf
  // (Rückgängig) bleibt er länger stehen.
  snack(text, action = null) {
    window.clearTimeout(this._snackTimer);
    this.ui.snack = { text, action };
    this._snackHtml();
    this._snackTimer = window.setTimeout(() => {
      this.ui.snack = null;
      this._snackHtml();
    }, action ? 8000 : 3500);
  }

  _snackHtml() {
    const dlg = this.dlg;
    if (!dlg) return;
    dlg.querySelector(".ap-snack")?.remove();
    const sn = this.ui.snack;
    if (!sn) return;
    const { escape } = this.h;
    const el = document.createElement("div");
    el.className = `ap-snack${sn.action ? " act" : ""}`;
    el.setAttribute("role", "status");
    el.innerHTML = `<span>${escape(sn.text)}</span>${sn.action ? `<button type="button" data-ap="snack">${escape(sn.action.label)}</button>` : ""}`;
    dlg.appendChild(el);
  }

  // Stand ersetzen (Rückgängig): wie eine Änderung, aber mit dem früheren Inhalt.
  _restore(snapshot) {
    this.data = sanitizeApps(snapshot);
    this._changed();
  }

  toggleFav(id) {
    const a = this.app(id);
    if (!a || this.isHidden(a)) return;
    if (this.data.fav.includes(id)) this.data.fav = this.data.fav.filter((x) => x !== id);
    else if (this.favs().length >= MAX_FAV) return this.snack(this.t("appsFavMax", MAX_FAV));
    else this.data.fav = [...this.data.fav.filter((x) => this.app(x)), id];
    this._changed();
  }

  toggleHidden(id) {
    const a = this.app(id);
    if (!a || a.locked) return;
    if (this.data.hidden.includes(id)) this.data.hidden = this.data.hidden.filter((x) => x !== id);
    else {
      this.data.hidden = [...this.data.hidden, id];
      this.data.fav = this.data.fav.filter((x) => x !== id);
    }
    this._changed();
  }

  reorder(box, list, focusId = null) {
    if (box === "fav") this.data.fav = list.filter((id) => this.app(id)).slice(0, MAX_FAV);
    else if (GROUPS.includes(box)) this.data.order = { ...this.data.order, [box]: list };
    else return;
    this._changed(focusId);
  }

  setLayout(mode) {
    if (mode !== "grid" && mode !== "list") return;
    this.data.layout = { ...this.data.layout, [this.layoutKey()]: mode };
    this._changed();
  }

  reset() {
    const snapshot = JSON.parse(JSON.stringify(this.data));
    const d = defaults();
    // Eigene Apps und die Darstellung bleiben: zurückgesetzt wird Auswahl, Reihenfolge und Ausgeblendetes.
    this.data = { ...d, custom: this.data.custom, layout: this.data.layout };
    this._changed();
    this.snack(this.t("appsResetDone"), { label: this.t("undo"), run: () => this._restore(snapshot) });
  }

  removeCustom(id) {
    const a = this.data.custom.find((c) => c.id === id);
    if (!a) return;
    const snapshot = JSON.parse(JSON.stringify(this.data));
    this.data.custom = this.data.custom.filter((c) => c.id !== id);
    this.data.fav = this.data.fav.filter((x) => x !== id);
    this.data.hidden = this.data.hidden.filter((x) => x !== id);
    this.data.order = { ...this.data.order, own: (this.data.order.own || []).filter((x) => x !== id) };
    this._changed();
    this.snack(this.t("appsRemoved", a.name), { label: this.t("undo"), run: () => this._restore(snapshot) });
  }

  // --- Öffnen -------------------------------------------------------------------

  // Ein Tipp auf eine App (externe Links sind echte Verweise und öffnen von selbst in einem neuen Tab).
  open(id) {
    const a = this.app(id);
    if (!a || a.ext) return;
    this.close();
    if (a.act === "timer") this.host._openTmAll();
    else if (a.act === "magic") this.host._openSettings("magic");
    else if (a.act === "log") this.host._openLog();
    else if (a.path || a.url) this.host._navigate(a.path || a.url);
  }

  toggle() {
    if (this.dlg?.open) this.close();
    else this.openLauncher();
  }

  openLauncher() {
    const dlg = this.dlg;
    if (!dlg) return;
    this.ui.edit = false;
    this.ui.q = "";
    this.ui.all = false;
    this.ui.snack = null;
    this.render();
    this._position();
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    dlg.scrollTop = 0;
    this._expanded(true);
    // Mit der Maus gleich in die Suche; am Handy keine Tastatur und kein Fokusrahmen
    if (this.narrow() || window.matchMedia?.("(pointer: coarse)").matches) this.root.activeElement?.blur();
    else dlg.querySelector(".ap-q")?.focus();
  }

  close() {
    const dlg = this.dlg;
    if (dlg?.open) {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }
    this._expanded(false);
  }

  _expanded(on) {
    const btn = this.root?.querySelector(".apps-btn");
    btn?.classList.toggle("on", on);
    btn?.setAttribute("aria-expanded", String(on));
  }

  // Desktop: unter dem Knopf, rechtsbündig; Handy: Blatt von unten (Stile)
  _position() {
    const dlg = this.dlg;
    const btn = this.root.querySelector(".apps-btn");
    if (!dlg || !btn) return;
    if (this.narrow()) {
      dlg.style.cssText = "";
      return;
    }
    const r = btn.getBoundingClientRect();
    const width = Math.min(450, window.innerWidth - 32);
    const left = Math.max(16, Math.min(r.right + 8 - width, window.innerWidth - width - 16));
    const top = r.bottom + 8;
    dlg.style.cssText = `top:${top}px;left:${left}px;max-height:${Math.max(240, window.innerHeight - top - 16)}px`;
  }

  // Wechsel zwischen Desktop und Handy: Fenster zu, Kopfzeile neu (am Handy nur der erste Favorit)
  onNarrow() {
    this.close();
    if (this.fdlg?.open) this.fdlg.close();
    this.renderBar();
  }

  // --- Kopfzeile ----------------------------------------------------------------

  renderBar() {
    const box = this.root?.querySelector(".app-pins");
    if (!box) return;
    const { escape, mdi } = this.h;
    const pins = this.favs().slice(0, this.narrow() ? 1 : MAX_FAV);
    const html = pins
      .map((a) => {
        const label = escape(a.name);
        const icon = this._icon(a, 22);
        return a.ext
          ? `<a class="tmall-btn app-pin" href="${escape(a.url)}" target="_blank" rel="noopener noreferrer" data-app-pin="${escape(a.id)}" title="${label}" aria-label="${label}">${icon}</a>`
          : `<button type="button" class="tmall-btn app-pin" data-app-pin="${escape(a.id)}" title="${label}" aria-label="${label}">${icon}</button>`;
      })
      .join("");
    if (this._barHtml === html) return;
    this._barHtml = html;
    box.innerHTML = html;
  }

  // --- Fenster ------------------------------------------------------------------

  // Symbol der App: das Favicon (eigene App mit externem Link), sonst das gewählte Symbol
  _icon(a, size) {
    const { escape, mdi } = this.h;
    return a.favicon ? `<img class="ap-fi" src="${escape(a.favicon)}" width="${size}" height="${size}" alt="" draggable="false">` : mdi(a.icon, size);
  }

  // Knopf oder Verweis einer App: externe Links sind <a> (neuer Tab, kein Zugriff auf das Panel), alles andere <button>
  _main(a, cls, inner) {
    const { escape } = this.h;
    return a.ext
      ? `<a class="${cls}" href="${escape(a.url)}" target="_blank" rel="noopener noreferrer" data-ap="ext" data-id="${escape(a.id)}">${inner}</a>`
      : `<button type="button" class="${cls}" data-ap="open" data-id="${escape(a.id)}">${inner}</button>`;
  }

  _badge(a) {
    // "Debug": nur wenn das Protokoll geladen ist und der Debug-Modus läuft
    return a.id === "log" && this.host._log?.debug ? `<span class="ap-badge">${this.h.escape(this.t("appsDebug"))}</span>` : "";
  }

  _tile(a) {
    const { escape, mdi } = this.h;
    const pin = this.data.fav.includes(a.id);
    return `<div class="ap-tile${pin ? " pin" : ""}">${this._main(a, "ap-main", `<span class="ap-ico">${this._icon(a, 22)}</span><span class="ap-nm">${escape(a.name)}</span>`)}
      ${this._badge(a)}${a.ext ? `<span class="ap-ext" title="${escape(this.t("appsExtMark"))}">${mdi("link", 12)}</span>` : ""}</div>`;
  }

  _row(a) {
    const { escape, mdi } = this.h;
    const inner = `<span class="ap-ico sm">${this._icon(a, 20)}</span><span class="ap-t"><b>${escape(a.name)}${this._badge(a)}</b><small>${escape(a.sub)}</small></span>${a.ext ? `<span class="ap-ext in" title="${escape(this.t("appsExtMark"))}">${mdi("link", 14)}</span>` : ""}`;
    return `<div class="ap-row">${this._main(a, "ap-main row", inner)}</div>`;
  }

  _addEntry(list) {
    const { escape, mdi } = this.h;
    if (this.data.custom.length >= MAX_CUSTOM) return "";
    return list
      ? `<button type="button" class="ap-row ap-add-row" data-ap="add"><span class="ap-ico sm">${mdi("plus", 20)}</span><span class="ap-t"><b>${escape(this.t("appsAddLong"))}</b></span></button>`
      : `<button type="button" class="ap-tile ap-add" data-ap="add"><span class="ap-ico">${mdi("plus", 24)}</span><span class="ap-nm">${escape(this.t("appsAdd"))}</span></button>`;
  }

  _groupTitle(g) {
    return this.t(g === "panel" ? "appsGrpPanel" : g === "ha" ? "appsGrpHa" : "appsGrpOwn");
  }

  // Liste im normalen Modus (ohne Kopf und Suchfeld, die bleiben beim Tippen stehen)
  _listHtml() {
    const { escape, mdi } = this.h;
    const q = this.ui.q.trim().toLowerCase();
    const list = this.data.layout[this.layoutKey()] === "list";
    const match = (a) => !q || `${a.name} ${a.sub}`.toLowerCase().includes(q);
    let out = "";
    let any = false;
    const favs = this.favs();
    if (!q) {
      out += `<div class="ap-h">${escape(this.t("appsGrpFav"))}<span class="ap-hh" aria-hidden="true">${mdi("heart", 13)}</span></div>`;
      if (!favs.length) out += `<p class="ap-note">${escape(this.t("appsNoFav", MAX_FAV))}</p>`;
      // Kein Strich und kein Hinweis zur Kopfzeile am Handy: das zeigt nur der Bearbeiten-Modus
      else out += list ? `<div class="ap-rows">${favs.map((a) => this._row(a)).join("")}</div>` : `<div class="ap-grid">${favs.map((a) => this._tile(a)).join("")}</div>`;
      any = true;
    }
    for (const g of GROUPS) {
      let items = this.group(g, false, !q).filter(match);
      const adding = g === "own" && !q;
      if (!items.length && !adding) continue;
      any = true;
      let more = "";
      if (g === "ha" && !q) {
        const limit = this.narrow() ? 6 : 8;
        if (items.length > limit) {
          more = `<button type="button" class="ap-more" data-ap="all">${escape(this.ui.all ? this.t("appsLess") : this.t("appsAll", items.length))}</button>`;
          if (!this.ui.all) items = items.slice(0, limit);
        }
      }
      out += `<div class="ap-h">${escape(this._groupTitle(g))}${more}</div>`;
      out += list ? `<div class="ap-rows">${items.map((a) => this._row(a)).join("")}${adding ? this._addEntry(true) : ""}</div>` : `<div class="ap-grid">${items.map((a) => this._tile(a)).join("")}${adding ? this._addEntry(false) : ""}</div>`;
    }
    if (!any) out += `<p class="ap-note">${escape(this.t("appsNone"))}</p>`;
    return out;
  }

  _editRow(a) {
    const { escape, mdi } = this.h;
    const hid = this.isHidden(a);
    const eye = a.locked
      ? `<span class="ap-a dis" title="${escape(this.t("appsLocked"))}" aria-label="${escape(this.t("appsLocked"))}">${mdi("lock", 18)}</span>`
      : `<button type="button" class="ap-a" data-ap="hide" data-id="${escape(a.id)}" aria-pressed="${!hid}" title="${escape(this.t(hid ? "appsShow" : "appsHide", a.name))}" aria-label="${escape(this.t(hid ? "appsShow" : "appsHide", a.name))}">${mdi(hid ? "eyeOff" : "eye", 20)}</button>`;
    const fav = this.data.fav.includes(a.id);
    const full = !fav && this.favs().length >= MAX_FAV;
    const heartLabel = escape(fav ? this.t("appsUnfav", a.name) : full ? this.t("appsFavMax", MAX_FAV) : this.t("appsFav", a.name));
    const heart = `<button type="button" class="ap-a heart${fav ? " on" : ""}${hid || full ? " dis" : ""}" data-ap="fav" data-id="${escape(a.id)}" aria-pressed="${fav}"${hid || full ? ' aria-disabled="true"' : ""} title="${heartLabel}" aria-label="${heartLabel}">${mdi(fav ? "heart" : "heartOutline", 20)}</button>`;
    const own = a.custom
      ? `<button type="button" class="ap-a" data-ap="edit-app" data-id="${escape(a.id)}" title="${escape(this.t("appsEdit"))}" aria-label="${escape(this.t("appsEdit"))}">${mdi("pencil", 18)}</button>
         <button type="button" class="ap-a del" data-ap="del" data-id="${escape(a.id)}" title="${escape(this.t("appsDelete", a.name))}" aria-label="${escape(this.t("appsDelete", a.name))}">${mdi("close", 18)}</button>`
      : "";
    return `<div class="ap-erow${hid ? " hid" : ""}" data-id="${escape(a.id)}" data-mark="${escape(this.t("appsPhoneMark"))}">
      <button type="button" class="ap-drag" data-ap-drag data-id="${escape(a.id)}" title="${escape(this.t("appsDragHint"))}" aria-label="${escape(this.t("appsDrag", a.name))}">${mdi("drag", 18)}</button>
      <span class="ap-ico sm">${this._icon(a, 18)}</span><span class="ap-t"><b>${escape(a.name)}${a.ext ? ` <span class="ap-ext in">${mdi("link", 12)}</span>` : ""}</b><small>${escape(a.sub)}</small></span>
      ${eye}${heart}${own}</div>`;
  }

  _editHtml() {
    const { escape, mdi } = this.h;
    const mode = this.data.layout[this.layoutKey()];
    const seg = (v, label) => `<button type="button" role="tab" class="sub-tab${mode === v ? " on" : ""}" data-set="layout" data-ap="layout" data-v="${v}" aria-selected="${mode === v}">${escape(label)}</button>`;
    const favs = this.favs();
    let out = `<p class="ap-note first">${escape(this.t("appsEditNote"))}</p>
      <div class="ap-view"><span>${escape(this.t("appsView"))}<small>${escape(this.t(this.narrow() ? "appsViewPhone" : "appsViewDesk"))}</small></span>
        <span class="sub-tabs" role="tablist" aria-label="${escape(this.t("appsView"))}">${seg("grid", this.t("appsViewGrid"))}${seg("list", this.t("appsViewList"))}</span></div>
      <div class="ap-h">${escape(this.t("appsGrpFav"))}<span class="ap-hh" aria-hidden="true">${mdi("heart", 13)}</span></div>`;
    out += favs.length ? `<div class="ap-box fav" data-ap-box="fav">${favs.map((a) => this._editRow(a)).join("")}</div>` : `<p class="ap-note">${escape(this.t("appsNoFav", MAX_FAV))}</p>`;
    for (const g of GROUPS) {
      const items = this.group(g, true, true);
      if (!items.length && g !== "own") continue;
      out += `<div class="ap-h">${escape(this._groupTitle(g))}</div>`;
      if (items.length) out += `<div class="ap-box" data-ap-box="${g}">${items.map((a) => this._editRow(a)).join("")}</div>`;
      if (g === "own") {
        if (!items.length) out += `<p class="ap-note">${escape(this.t("appsOwnNone"))}</p>`;
        if (this.data.custom.length < MAX_CUSTOM) out += `<button type="button" class="ap-addbtn" data-ap="add">${mdi("plus", 18)}<span>${escape(this.t("appsAddLong"))}</span></button>`;
      }
    }
    out += `<div class="ap-reset"><button type="button" class="ap-link" data-ap="reset">${mdi("reset", 18)}<span>${escape(this.t("appsReset"))}</span></button><span>${escape(this.t("appsResetSub"))}</span></div>`;
    return out;
  }

  render() {
    const dlg = this.dlg;
    if (!dlg) return;
    const { escape, mdi } = this.h;
    const edit = this.ui.edit;
    const head = edit
      ? `<div class="ap-head"><b class="ap-title">${escape(this.t("appsEditTitle"))}</b><button type="button" class="ap-done" data-ap="done">${mdi("check", 16)}<span>${escape(this.t("appsDone"))}</span></button></div>`
      : `<div class="ap-head"><b class="ap-title">${escape(this.t("appsTitle"))}</b><button type="button" class="ap-link" data-ap="edit">${mdi("pencil", 16)}<span>${escape(this.t("appsEditBtn"))}</span></button>
        <button type="button" class="ap-x" data-ap="close" title="${escape(this.t("close"))}" aria-label="${escape(this.t("close"))}">${mdi("close", 18)}</button></div>`;
    const search = edit ? "" : `<label class="ap-search">${mdi("search", 18)}<input class="ap-q" type="search" value="${escape(this.ui.q)}" placeholder="${escape(this.t("appsSearch"))}" aria-label="${escape(this.t("appsSearch"))}" autocomplete="off"></label>`;
    const html = `${head}<div class="ap-body">${search}<div class="ap-list">${edit ? this._editHtml() : this._listHtml()}</div></div>`;
    const scroll = dlg.scrollTop;
    dlg.style.minHeight = "";
    // Kein setHtml-Vergleich: _search ändert die Liste von Hand, der letzte String würde dann nicht mehr stimmen
    const q = this.root.activeElement?.matches?.(".ap-q") ? this.root.activeElement : null;
    const caret = q ? q.selectionStart : 0;
    dlg.innerHTML = html;
    dlg.scrollTop = scroll;
    this._snackHtml();
    if (q) {
      const again = dlg.querySelector(".ap-q");
      again?.focus();
      again?.setSelectionRange?.(caret, caret);
    }
  }

  // Beim Tippen bleibt das Suchfeld stehen: nur die Liste ersetzen
  _search(value) {
    this.ui.q = value;
    // Das Fenster wird beim Suchen nicht kleiner: die Höhe von vorher bleibt als Mindesthöhe, bis es neu aufgebaut wird
    if (this.dlg && !this.dlg.style.minHeight) this.dlg.style.minHeight = `${this.dlg.offsetHeight}px`;
    const list = this.dlg?.querySelector(".ap-list");
    if (list) list.innerHTML = this._listHtml();
  }

  // --- Formular "Eigene App" ------------------------------------------------------

  openForm(id = null) {
    const c = id ? this.data.custom.find((x) => x.id === id) : null;
    // src: welches Bild die App zeigt, "icon" (gewähltes Symbol) oder "favicon" (nur bei externem Link, nach "Favicon laden")
    this.ui.form = c
      ? { id: c.id, name: c.name, icon: c.icon, ext: c.ext, url: c.url, favicon: c.favicon || null, src: c.favicon ? "favicon" : "icon", busy: false, msg: "" }
      : { id: null, name: "", icon: "web", ext: false, url: "", favicon: null, src: "icon", busy: false, msg: "" };
    const dlg = this.fdlg;
    if (!dlg) return;
    this._renderForm();
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    dlg.scrollTop = 0;
    if (this.narrow() || window.matchMedia?.("(pointer: coarse)").matches) this.root.activeElement?.blur();
    else dlg.querySelector('[data-f="name"]')?.focus();
  }

  closeForm() {
    const dlg = this.fdlg;
    if (dlg?.open) dlg.close();
    this.ui.form = null;
  }

  _formTexts() {
    const f = this.ui.form;
    return {
      label: this.t(f.ext ? "appsFAddr" : "appsFPage"),
      hint: this.t(f.ext ? "appsFAddrHint" : "appsFPageHint"),
      ph: f.ext ? "https://" : "/config/automation/dashboard",
    };
  }

  _renderForm() {
    const dlg = this.fdlg;
    const f = this.ui.form;
    if (!dlg || !f) return;
    const { escape, mdi } = this.h;
    const tx = this._formTexts();
    const icons = APP_ICONS.map((k) => `<button type="button" class="ap-ic${f.icon === k ? " on" : ""}" data-ap="ficon" data-icon="${k}" aria-pressed="${f.icon === k}">${mdi(k, 20)}</button>`).join("");
    dlg.innerHTML = `<div class="ap-head"><b class="ap-title">${escape(this.t(f.id ? "appsFEdit" : "appsFNew"))}</b>
        <button type="button" class="ap-x show" data-ap="fclose" title="${escape(this.t("close"))}" aria-label="${escape(this.t("close"))}">${mdi("close", 18)}</button></div>
      <div class="ap-body">
        <label class="ap-f"><span>${escape(this.t("appsFName"))}</span><input class="ap-in" data-f="name" maxlength="${NAME_MAX}" value="${escape(f.name)}" autocomplete="off"></label>
        <label class="ap-chk"><input type="checkbox" data-f="ext"${f.ext ? " checked" : ""}><span>${escape(this.t("appsFExt"))}<small>${escape(this.t("appsFExtSub"))}</small></span></label>
        <label class="ap-f"><span data-f-label>${escape(tx.label)}</span><input class="ap-in" data-f="url" type="text" inputmode="url" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="${URL_MAX}" placeholder="${escape(tx.ph)}" value="${escape(f.url)}"></label>
        <div class="ap-hint" data-f-hint>${escape(tx.hint)}</div>
        <div class="ap-f"><span>${escape(this.t("appsFIcon"))}</span>
          <div class="sub-tabs" role="tablist" aria-label="${escape(this.t("appsFIcon"))}">
            <button type="button" role="tab" class="sub-tab" data-set="fsrc" data-v="icon">${escape(this.t("appsFSrcIcon"))}</button>
            <button type="button" role="tab" class="sub-tab" data-set="fsrc" data-v="favicon">${escape(this.t("appsFSrcFav"))}</button></div>
          <div class="ap-icons" data-f-pane="icon">${icons}</div>
          <div class="ap-favpane" data-f-pane="favicon" hidden>
            <div class="ap-favrow"><span class="ap-favbox" data-f-favimg></span>
              <div class="ap-favctl"><button type="button" class="dlg-btn" data-ap="ffetch" data-f-fetch>${escape(this.t("appsFFetch"))}</button>
                <div class="ap-hint" data-f-favmsg></div></div></div></div></div>
        <div class="ap-prev"><div class="ap-tile" data-f-prev></div><p>${escape(this.t("appsFPrev"))}</p></div>
        <div class="ap-err" data-f-err role="alert" hidden></div>
      </div>
      <div class="ap-acts"><button type="button" class="dlg-btn" data-ap="fclose">${escape(this.t("settingsCancel"))}</button><button type="button" class="dlg-btn primary" data-ap="fsave">${escape(this.t("settingsSave"))}</button></div>`;
    this._formSync();
  }

  _formPreview() {
    const el = this.fdlg?.querySelector("[data-f-prev]");
    const f = this.ui.form;
    if (!el || !f) return;
    const { escape, mdi } = this.h;
    el.innerHTML = `<span class="ap-main"><span class="ap-ico">${this._icon({ icon: f.icon, favicon: f.src === "favicon" ? f.favicon : null }, 22)}</span><span class="ap-nm">${escape(f.name.trim() || this.t("appsFName"))}</span></span>${f.ext ? `<span class="ap-ext">${mdi("link", 12)}</span>` : ""}`;
  }

  // Beschriftung, Hinweis und Vorschau nachführen, ohne das Fenster neu zu bauen (Fokus und Tastatur bleiben)
  _formSync() {
    const dlg = this.fdlg;
    const f = this.ui.form;
    if (!dlg || !f) return;
    const tx = this._formTexts();
    dlg.querySelector("[data-f-label]").textContent = tx.label;
    dlg.querySelector("[data-f-hint]").textContent = tx.hint;
    dlg.querySelector('[data-f="url"]').placeholder = tx.ph;
    dlg.querySelectorAll(".ap-ic").forEach((b) => {
      b.classList.toggle("on", b.dataset.icon === f.icon);
      b.setAttribute("aria-pressed", String(b.dataset.icon === f.icon));
    });
    // Das Favicon gibt es nur bei einem externen Link; sonst zurück zum Symbol
    if (!f.ext && f.src === "favicon") f.src = "icon";
    const url = f.ext ? checkTarget(f.url, true) : null;
    dlg.querySelectorAll('[data-set="fsrc"]').forEach((b) => {
      const on = b.dataset.v === f.src;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", String(on));
      if (b.dataset.v === "favicon") b.disabled = !f.ext;
    });
    dlg.querySelector('[data-f-pane="icon"]').hidden = f.src !== "icon";
    dlg.querySelector('[data-f-pane="favicon"]').hidden = f.src !== "favicon";
    const { escape } = this.h;
    dlg.querySelector("[data-f-favimg]").innerHTML = f.favicon ? `<img class="ap-fi" src="${escape(f.favicon)}" width="32" height="32" alt="" draggable="false">` : "";
    const btn = dlg.querySelector("[data-f-fetch]");
    btn.disabled = f.busy || !url;
    btn.textContent = this.t(f.busy ? "appsFFetching" : f.favicon ? "appsFFetchAgain" : "appsFFetch");
    // Hinweis: Fehler oder Erfolg, sonst warum der Knopf gesperrt ist bzw. was er tut
    dlg.querySelector("[data-f-favmsg]").textContent = f.msg || this.t(url ? "appsFFavHint" : "appsFFavNeedUrl");
    this._formPreview();
  }

  // Favicon über Home Assistant holen (WS device_panel/fetch_favicon); Fehlercodes siehe favicon.py
  async fetchFavicon() {
    const f = this.ui.form;
    const url = f && f.ext ? checkTarget(f.url, true) : null;
    if (!f || f.busy || !url) return;
    f.busy = true;
    f.msg = "";
    this._formSync();
    try {
      const res = await this.host._callWithTimeout({ type: "device_panel/fetch_favicon", url }, 20000);
      if (this.ui.form !== f) return;
      if (!isFavicon(res?.icon)) throw { code: "not_found" };
      f.favicon = res.icon;
      f.src = "favicon";
      f.msg = this.t("appsFFavDone");
    } catch (err) {
      if (this.ui.form !== f) return;
      const keys = { invalid_url: "appsFErrFavUrl", not_found: "appsFErrFavNone", too_large: "appsFErrFavBig", unreachable: "appsFErrFavDown" };
      f.msg = this.t(keys[err?.code] || "appsFErrFavFail");
    } finally {
      if (this.ui.form === f) {
        f.busy = false;
        this._formSync();
      }
    }
  }

  _formError(text) {
    const el = this.fdlg?.querySelector("[data-f-err]");
    if (!el) return;
    el.textContent = text || "";
    el.hidden = !text;
  }

  saveForm() {
    const f = this.ui.form;
    if (!f) return;
    const name = f.name.trim();
    if (!name) return this._formError(this.t("appsFErrName"));
    const url = checkTarget(f.url, f.ext);
    if (!url) return this._formError(this.t(f.ext ? "appsFErrExt" : "appsFErrPage"));
    const useFav = f.ext && f.src === "favicon";
    if (useFav && !isFavicon(f.favicon)) return this._formError(this.t("appsFErrFavNeed"));
    const app = { name, icon: f.icon, url, ext: f.ext, ...(useFav ? { favicon: f.favicon } : {}) };
    if (f.id) this.data.custom = this.data.custom.map((c) => (c.id === f.id ? { id: c.id, ...app } : c));
    else {
      const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      this.data.custom = [...this.data.custom, { id, ...app }];
    }
    this.closeForm();
    this._changed();
  }

  // --- Bedienung ----------------------------------------------------------------

  bind(root) {
    // Kopfzeile: Launcher-Knopf und Favoriten (Event-Delegation, die Knöpfe werden neu gezeichnet)
    root.querySelector(".toolbar").addEventListener("click", (ev) => {
      if (ev.target.closest(".apps-btn")) return this.toggle();
      const pin = ev.target.closest("button[data-app-pin]");
      if (pin) this.open(pin.dataset.appPin);
    });
    const dlg = root.querySelector("dialog.apps-dlg");
    dlg.addEventListener("close", () => this._expanded(false));
    dlg.addEventListener("input", (ev) => {
      if (ev.target.matches(".ap-q")) this._search(ev.target.value);
    });
    dlg.addEventListener("click", (ev) => this._click(ev, dlg));
    dlg.addEventListener("pointerdown", (ev) => this._drag(ev, dlg));
    dlg.addEventListener("keydown", (ev) => this._key(ev));
    const fdlg = root.querySelector("dialog.app-dlg");
    fdlg.addEventListener("click", (ev) => {
      if (ev.target === fdlg) {
        const r = fdlg.getBoundingClientRect();
        if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) this.closeForm();
        return;
      }
      const tab = ev.target.closest('[data-set="fsrc"]');
      if (tab) {
        if (!tab.disabled && this.ui.form) {
          this.ui.form.src = tab.dataset.v;
          this._formError("");
          this._formSync();
        }
        return;
      }
      const b = ev.target.closest("[data-ap]");
      if (!b) return;
      if (b.dataset.ap === "ffetch") this.fetchFavicon();
      else if (b.dataset.ap === "fclose") this.closeForm();
      else if (b.dataset.ap === "fsave") this.saveForm();
      else if (b.dataset.ap === "ficon") {
        this.ui.form.icon = b.dataset.icon;
        this.ui.form.src = "icon";
        this._formSync();
      }
    });
    fdlg.addEventListener("input", (ev) => {
      const f = this.ui.form;
      const k = ev.target.dataset?.f;
      if (!f || !k) return;
      if (k === "name") f.name = ev.target.value;
      else if (k === "url") f.url = ev.target.value;
      else if (k === "ext") f.ext = ev.target.checked;
      this._formError("");
      if (k === "ext" || k === "url") this._formSync();
      else if (k === "name") this._formPreview();
    });
    fdlg.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && ev.target.matches("input[type=text], input:not([type])")) {
        ev.preventDefault();
        this.saveForm();
      }
    });
    fdlg.addEventListener("close", () => {
      this.ui.form = null;
    });
  }

  _click(ev, dlg) {
    if (ev.target === dlg) {
      const r = dlg.getBoundingClientRect();
      if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) this.close();
      return;
    }
    const b = ev.target.closest("[data-ap]");
    if (!b) return;
    const id = b.dataset.id;
    switch (b.dataset.ap) {
      case "open":
        return this.open(id);
      case "ext":
        // Verweis öffnet von selbst in einem neuen Tab; Fenster danach zu
        window.setTimeout(() => this.close(), 0);
        return;
      case "fav":
        if (b.classList.contains("dis")) {
          // Ausgeblendete Apps können kein Favorit sein (still); sonst ist die Grenze erreicht
          const a = this.app(id);
          return a && !this.isHidden(a) ? this.snack(this.t("appsFavMax", MAX_FAV)) : undefined;
        }
        return this.toggleFav(id);
      case "hide":
        return this.toggleHidden(id);
      case "edit":
        this.ui.edit = true;
        this.ui.snack = null;
        this.render();
        dlg.scrollTop = 0;
        return;
      case "done":
        this.ui.edit = false;
        this.ui.snack = null;
        this.render();
        dlg.scrollTop = 0;
        return;
      case "close":
        return this.close();
      case "layout":
        return this.setLayout(b.dataset.v);
      case "all":
        this.ui.all = !this.ui.all;
        return this.render();
      case "add":
        return this.openForm();
      case "edit-app":
        return this.openForm(id);
      case "del":
        return this.removeCustom(id);
      case "reset":
        return this.reset();
      case "snack": {
        const action = this.ui.snack?.action;
        window.clearTimeout(this._snackTimer);
        this.ui.snack = null;
        this._snackHtml();
        return action?.run();
      }
      default:
    }
  }

  // Tastatur: Pfeil hoch/runter am Ziehgriff verschiebt die Zeile
  _key(ev) {
    const h = ev.target.closest?.("[data-ap-drag]");
    if (!h || (ev.key !== "ArrowUp" && ev.key !== "ArrowDown")) return;
    ev.preventDefault();
    const box = h.closest("[data-ap-box]");
    if (!box) return;
    const list = [...box.querySelectorAll(".ap-erow")].map((r) => r.dataset.id);
    const i = list.indexOf(h.dataset.id);
    const j = ev.key === "ArrowUp" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    this.reorder(box.dataset.apBox, list, h.dataset.id);
  }

  // Ziehen am Griff (Maus und Finger): die Zeile wandert mit, beim Loslassen wird die neue Reihenfolge gespeichert
  _drag(ev, dlg) {
    const h = ev.target.closest?.("[data-ap-drag]");
    if (!h || (ev.pointerType === "mouse" && ev.button !== 0)) return;
    const row = h.closest(".ap-erow");
    const box = row?.parentElement;
    if (!box?.dataset.apBox) return;
    ev.preventDefault();
    const win = window;
    row.classList.add("lift");
    const move = (e) => {
      const y = e.clientY;
      const sr = dlg.getBoundingClientRect();
      if (y < sr.top + 56) dlg.scrollTop -= 10;
      else if (y > sr.bottom - 60) dlg.scrollTop += 10;
      const after = [...box.children].find((r) => {
        if (r === row) return false;
        const b = r.getBoundingClientRect();
        return y < b.top + b.height / 2;
      });
      if (after) {
        if (row.nextElementSibling !== after) box.insertBefore(row, after);
      } else if (box.lastElementChild !== row) box.appendChild(row);
    };
    const up = () => {
      win.removeEventListener("pointermove", move);
      win.removeEventListener("pointerup", up);
      win.removeEventListener("pointercancel", up);
      row.classList.remove("lift");
      const list = [...box.querySelectorAll(".ap-erow")].map((r) => r.dataset.id);
      this.reorder(box.dataset.apBox, list);
    };
    win.addEventListener("pointermove", move);
    win.addEventListener("pointerup", up);
    win.addEventListener("pointercancel", up);
  }
}
