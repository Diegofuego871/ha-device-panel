/**
 * App-Launcher (seit 2.31.0, docs/mockups/launcher-v2).
 *
 * Ein Knopf in der Kopfzeile öffnet eine Übersicht nützlicher Seiten ("Apps"): eigene Funktionen des Panels (Routine, Magic Push,
 * Protokoll), Seiten von Home Assistant und eigene Links des Benutzers. Mit dem Herz markierte Apps (höchstens fünf) stehen als
 * Knöpfe direkt in der Kopfzeile, am Handy nur die erste. Der Bearbeiten-Modus sortiert (Ziehen), blendet aus (Auge) und
 * wählt Favoriten; die Darstellung (Raster oder Liste) wählt der Benutzer selbst, getrennt für Desktop und Handy.
 *
 * Alles gehört dem Benutzer: ein Eintrag in den Benutzerdaten von HA (frontend/set_user_data) mit lokaler Kopie im Browser, wie
 * die Herzen der Geräte und Routine. Der neuere Stand gewinnt. Das Protokoll ist nicht ausblendbar, sonst gäbe es keinen Zugang mehr
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
  { id: "routine", group: "panel", icon: "flash", act: "routine" },
  { id: "magic", group: "panel", icon: "bell", act: "magic" },
  { id: "log", group: "panel", icon: "log", act: "log", locked: true },
  // Status (seit 2.62.0): nur für Administratoren (status_get ist ein Befehl für Administratoren); nicht vorgemerkt, wer ihn in der Kopfzeile will, heftet ihn selbst an.
  // Seit 2.76.0 nicht mehr ausblendbar (locked): dort liegen die Einstellungen der Meldungen
  { id: "status", group: "panel", icon: "pulse", act: "status", admin: true, locked: true },
  // Ansicht und Einstellungen (seit 2.85.0): beides auch über die Knöpfe in der Kopfzeile erreichbar, darum ausblendbar (nicht locked)
  { id: "view", group: "panel", icon: "viewSettings", act: "view" },
  { id: "settings", group: "panel", icon: "gear", act: "settings" },
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
// Symbol und Farbe der Apps von Home Assistant, genau wie im Frontend von HA (home-assistant-frontend 20260930, Konfigurationsseiten:
// iconPath und iconColor der jeweiligen Seite), damit der Launcher dasselbe Bild zeigt wie die Seite, auf die er verlinkt. Verlauf und
// Logbuch haben dort keine Farbe (Seitenleiste): MDI chart-box und format-list-bulleted-type, Farben aus der HA-Palette.
// Neu in 2.35.0: Kreis in dieser Farbe, weisses Symbol. Die Apps des Panels behalten ihr Symbol, nur die Farbe kommt dazu.
const HA_LOOK = {
  auto: { c: "#518C43", p: "M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z" },
  scene: { c: "#518C43", p: "M17.5,12A1.5,1.5 0 0,1 16,10.5A1.5,1.5 0 0,1 17.5,9A1.5,1.5 0 0,1 19,10.5A1.5,1.5 0 0,1 17.5,12M14.5,8A1.5,1.5 0 0,1 13,6.5A1.5,1.5 0 0,1 14.5,5A1.5,1.5 0 0,1 16,6.5A1.5,1.5 0 0,1 14.5,8M9.5,8A1.5,1.5 0 0,1 8,6.5A1.5,1.5 0 0,1 9.5,5A1.5,1.5 0 0,1 11,6.5A1.5,1.5 0 0,1 9.5,8M6.5,12A1.5,1.5 0 0,1 5,10.5A1.5,1.5 0 0,1 6.5,9A1.5,1.5 0 0,1 8,10.5A1.5,1.5 0 0,1 6.5,12M12,3A9,9 0 0,0 3,12A9,9 0 0,0 12,21A1.5,1.5 0 0,0 13.5,19.5C13.5,19.11 13.35,18.76 13.11,18.5C12.88,18.23 12.73,17.88 12.73,17.5A1.5,1.5 0 0,1 14.23,16H16A5,5 0 0,0 21,11C21,6.58 16.97,3 12,3Z" },
  script: { c: "#518C43", p: "M17.8,20C17.4,21.2 16.3,22 15,22H5C3.3,22 2,20.7 2,19V18H5L14.2,18C14.6,19.2 15.7,20 17,20H17.8M19,2C20.7,2 22,3.3 22,5V6H20V5C20,4.4 19.6,4 19,4C18.4,4 18,4.4 18,5V18H17C16.4,18 16,17.6 16,17V16H5V5C5,3.3 6.3,2 8,2H19M8,6V8H15V6H8M8,10V12H14V10H8Z" },
  helper: { c: "#4D2EA4", p: "M21.71 20.29L20.29 21.71A1 1 0 0 1 18.88 21.71L7 9.85A3.81 3.81 0 0 1 6 10A4 4 0 0 1 2.22 4.7L4.76 7.24L5.29 6.71L6.71 5.29L7.24 4.76L4.7 2.22A4 4 0 0 1 10 6A3.81 3.81 0 0 1 9.85 7L21.71 18.88A1 1 0 0 1 21.71 20.29M2.29 18.88A1 1 0 0 0 2.29 20.29L3.71 21.71A1 1 0 0 0 5.12 21.71L10.59 16.25L7.76 13.42M20 2L16 4V6L13.83 8.17L15.83 10.17L18 8H20L22 4Z" },
  dev: { c: "#2D338F", p: "M3 6H21V4H3C1.9 4 1 4.9 1 6V18C1 19.1 1.9 20 3 20H7V18H3V6M13 12H9V13.78C8.39 14.33 8 15.11 8 16C8 16.89 8.39 17.67 9 18.22V20H13V18.22C13.61 17.67 14 16.88 14 16S13.61 14.33 13 13.78V12M11 17.5C10.17 17.5 9.5 16.83 9.5 16S10.17 14.5 11 14.5 12.5 15.17 12.5 16 11.83 17.5 11 17.5M22 8H16C15.5 8 15 8.5 15 9V19C15 19.5 15.5 20 16 20H22C22.5 20 23 19.5 23 19V9C23 8.5 22.5 8 22 8M21 18H17V10H21V18Z" },
  ent: { c: "#2D338F", p: "M11,13.5V21.5H3V13.5H11M12,2L17.5,11H6.5L12,2M17.5,13C20,13 22,15 22,17.5C22,20 20,22 17.5,22C15,22 13,20 13,17.5C13,15 15,13 17.5,13Z" },
  integ: { c: "#2D338F", p: "M20.5,11H19V7C19,5.89 18.1,5 17,5H13V3.5A2.5,2.5 0 0,0 10.5,1A2.5,2.5 0 0,0 8,3.5V5H4A2,2 0 0,0 2,7V10.8H3.5C5,10.8 6.2,12 6.2,13.5C6.2,15 5,16.2 3.5,16.2H2V20A2,2 0 0,0 4,22H7.8V20.5C7.8,19 9,17.8 10.5,17.8C12,17.8 13.2,19 13.2,20.5V22H17A2,2 0 0,0 19,20V16H20.5A2.5,2.5 0 0,0 23,13.5A2.5,2.5 0 0,0 20.5,11Z" },
  area: { c: "#2D338F", p: "M12.5 7C12.5 5.89 13.39 5 14.5 5H18C19.1 5 20 5.9 20 7V9.16C18.84 9.57 18 10.67 18 11.97V14H12.5V7M6 11.96V14H11.5V7C11.5 5.89 10.61 5 9.5 5H6C4.9 5 4 5.9 4 7V9.15C5.16 9.56 6 10.67 6 11.96M20.66 10.03C19.68 10.19 19 11.12 19 12.12V15H5V12C5 10.9 4.11 10 3 10S1 10.9 1 12V17C1 18.1 1.9 19 3 19V21H5V19H19V21H21V19C22.1 19 23 18.1 23 17V12C23 10.79 21.91 9.82 20.66 10.03Z" },
  tools: { c: "#7A5AA6", p: "M2 19.63L13.43 8.2L12.72 7.5L14.14 6.07L12 3.89C13.2 2.7 15.09 2.7 16.27 3.89L19.87 7.5L18.45 8.91H21.29L22 9.62L18.45 13.21L17.74 12.5V9.62L16.27 11.04L15.56 10.33L4.13 21.76L2 19.63Z" },
  backup: { c: "#0D47A1", p: "M12,3A9,9 0 0,0 3,12H0L4,16L8,12H5A7,7 0 0,1 12,5A7,7 0 0,1 19,12A7,7 0 0,1 12,19C10.5,19 9.09,18.5 7.94,17.7L6.5,19.14C8.04,20.3 9.94,21 12,21A9,9 0 0,0 21,12A9,9 0 0,0 12,3M14,12A2,2 0 0,0 12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12Z" },
  hist: { c: "#3263C3", p: "M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M9 17H7V10H9V17M13 17H11V7H13V17M17 17H15V13H17V17Z" },
  book: { c: "#00838F", p: "M5,9.5L7.5,14H2.5L5,9.5M3,4H7V8H3V4M5,20A2,2 0 0,0 7,18A2,2 0 0,0 5,16A2,2 0 0,0 3,18A2,2 0 0,0 5,20M9,5V7H21V5H9M9,19H21V17H9V19M9,13H21V11H9V13Z" },
};
const PANEL_COLOR = { routine: "#00838F", magic: "#8E24AA", log: "#4A5963", status: "#2E7D32", view: "#1E88E5", settings: "#8D6E63" };
export const APP_ICONS = ["web", "home", "camera", "map", "bolt", "calendar", "bar", "wrench", "store", "desktop", "robot", "palette", "script", "devices", "shape", "tools"];

// Favicon einer eigenen App mit externem Link (seit 2.33.0): kleines Bild als Data-URI (base64), vom Server geholt (favicon.py).
// Nur bekannte Bildarten, damit in den Benutzerdaten nie etwas anderes landet; höchstens FAVICON_MAX Zeichen (etwa 100 KB).
const FAVICON_MAX = 140000;
const FAVICON_RE = /^data:image\/(png|x-icon|gif|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/;
export const isFavicon = (v) => typeof v === "string" && v.length <= FAVICON_MAX && FAVICON_RE.test(v);

const defaults = () => ({ fav: ["routine"], hidden: [], order: {}, custom: [], layout: { desktop: "grid", phone: "grid" }, updated: 0 });
// Umbenennung Timer → Routine (2.55.0): die App hiess vorher "timer"; Favoriten, Ausgeblendetes und Reihenfolge behalten sie
const ids = (list, max) =>
  Array.isArray(list)
    ? [...new Set(list.filter((x) => typeof x === "string" && x.length > 0 && x.length <= 64).map((x) => (x === "timer" ? "routine" : x)))].slice(0, max)
    : [];

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
    const builtin = BUILTIN.filter((a) => admin || !a.admin).map((a) => ({ ...a, name: t(`app_${a.id}`), sub: a.path || t(`app_${a.id}_sub`) || "", look: HA_LOOK[a.id] || null, color: HA_LOOK[a.id]?.c || PANEL_COLOR[a.id] || null }));
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
    if (a.act === "routine") this.host._openRtAll();
    else if (a.act === "magic") this.host._openMagicAll();
    else if (a.act === "log") this.host._openLog();
    else if (a.act === "status") this.host._status.open();
    else if (a.act === "view") this.host._openView();
    else if (a.act === "settings") this.host._openSettings();
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
    this._paintLauncherDot();
    const { escape } = this.h;
    const pins = this.favs().slice(0, this.narrow() ? 1 : MAX_FAV);
    const html = pins
      .map((a) => {
        const dot = this.dotLevels().pins[a.id] || "";
        const label = escape(dot ? `${a.name} · ${this.t(dot === "bad" ? "appsDown" : "appsDebug")}` : a.name);
        const icon = this._icon(a, 22);
        const cls = `rtall-btn app-pin${dot ? ` has-dot dot-${dot}` : ""}`;
        return a.ext
          ? `<a class="${cls}" href="${escape(a.url)}" target="_blank" rel="noopener noreferrer" data-app-pin="${escape(a.id)}" title="${label}" aria-label="${label}">${icon}</a>`
          : `<button type="button" class="${cls}" data-app-pin="${escape(a.id)}" title="${label}" aria-label="${label}">${icon}</button>`;
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
    if (a.favicon) return `<img class="ap-fi" src="${escape(a.favicon)}" width="${size}" height="${size}" alt="" draggable="false">`;
    // Apps von HA: das Symbol von HA selbst (HA_LOOK), sonst das gewählte oder eigene Symbol
    if (a.look) return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${a.look.p}"/></svg>`;
    return mdi(a.icon, size);
  }

  // Kreis um das Symbol: Apps von HA und des Panels in ihrer Farbe (weisses Symbol), eigene Apps in der Hauptfarbe; ein Favicon
  // bleibt ohne Kreis (eigene Fläche, siehe .ap-fi)
  _ico(a, size, sm = false) {
    const style = a.color && !a.favicon ? ` style="background:${a.color};color:#fff"` : "";
    const own = !a.color && !a.favicon ? " own" : "";
    return `<span class="ap-ico${sm ? " sm" : ""}${own}"${style}>${this._icon(a, size)}</span>`;
  }

  // Knopf oder Verweis einer App: externe Links sind <a> (neuer Tab, kein Zugriff auf das Panel), alles andere <button>
  _main(a, cls, inner) {
    const { escape } = this.h;
    return a.ext
      ? `<a class="${cls}" href="${escape(a.url)}" target="_blank" rel="noopener noreferrer" data-ap="ext" data-id="${escape(a.id)}">${inner}</a>`
      : `<button type="button" class="${cls}" data-ap="open" data-id="${escape(a.id)}">${inner}</button>`;
  }

  _badge(a) {
    const { escape } = this.h;
    // "Debug" (orange) am Protokoll bei laufendem Debug-Modus, "Störung" (rot) am Status, wenn ein Teil nicht läuft (seit 2.62.0)
    if (a.id === "log" && this.host._debugOn) return `<span class="ap-badge">${escape(this.t("appsDebug"))}</span>`;
    if (a.id === "status" && this.dotLevels().pins.status) return `<span class="ap-badge bad">${escape(this.t("appsDown"))}</span>`;
    // "Neustart" (rot) an den Einstellungen, solange der rote Punkt am Zahnrad der Kopfzeile steht (Neustart nach einem Update ausstehend, seit 2.85.0)
    if (a.id === "settings" && this.host._gearRestart) return `<span class="ap-badge bad">${escape(this.t("appsRestartPending"))}</span>`;
    return "";
  }

  // Punkte (seit 2.62.0): orange = Debug-Modus, rot = Störung des Status. Ist die App in der Kopfzeile angeheftet, sitzt der Punkt an ihrem
  // eigenen Knopf, sonst am Launcher-Knopf; rot geht vor orange. Nicht angeheftet und ausgeblendet gilt dasselbe: der Launcher-Knopf zeigt es.
  dotLevels() {
    const pinned = new Set(this.favs().slice(0, this.narrow() ? 1 : MAX_FAV).map((a) => a.id));
    const bad = (this.host._statusSum?.problems || 0) > 0 && this._admin();
    const warn = Boolean(this.host._debugOn);
    return { pins: { status: bad ? "bad" : "", log: warn ? "warn" : "" }, launcher: bad && !pinned.has("status") ? "bad" : warn && !pinned.has("log") ? "warn" : "" };
  }

  // Punkte neu setzen: Launcher-Knopf, angeheftete Knöpfe (über die Kopfzeile) und die Pillen im offenen Launcher
  _paintLauncherDot() {
    const btn = this.root?.querySelector(".apps-btn");
    if (btn) {
      const level = this.dotLevels().launcher;
      btn.classList.toggle("has-dot", Boolean(level));
      btn.classList.toggle("dot-warn", level === "warn");
      btn.classList.toggle("dot-bad", level === "bad");
      const base = this.t("appsBtn");
      const label = level ? `${base} · ${this.t(level === "bad" ? "appsDown" : "appsDebug")}` : base;
      btn.setAttribute("title", label);
      btn.setAttribute("aria-label", label);
    }
  }

  paintDots() {
    this.renderBar();
    // Der offene Launcher zeigt die Pillen: nur neu zeichnen, wenn sich etwas geändert hat (sonst störte es das Bearbeiten und Suchen)
    const key = JSON.stringify([this.dotLevels().pins, Boolean(this.host._gearRestart)]);
    if (key !== this._dotKey) {
      this._dotKey = key;
      if (this.dlg?.open && !this.ui.edit) this.render();
    }
  }

  _tile(a) {
    const { escape, mdi } = this.h;
    const pin = this.data.fav.includes(a.id);
    return `<div class="ap-tile${pin ? " pin" : ""}">${this._main(a, "ap-main", `${this._ico(a, 22)}<span class="ap-nm">${escape(a.name)}</span>`)}
      ${this._badge(a)}${a.ext ? `<span class="ap-ext" title="${escape(this.t("appsExtMark"))}">${mdi("link", 12)}</span>` : ""}</div>`;
  }

  _row(a) {
    const { escape, mdi } = this.h;
    const inner = `${this._ico(a, 20, true)}<span class="ap-t"><b>${escape(a.name)}${this._badge(a)}</b></span>${a.ext ? `<span class="ap-ext in" title="${escape(this.t("appsExtMark"))}">${mdi("link", 14)}</span>` : ""}`;
    return `<div class="ap-row">${this._main(a, "ap-main row", inner)}</div>`;
  }

  _groupTitle(g) {
    return this.t(g === "panel" ? "appsGrpPanel" : g === "ha" ? "appsGrpHa" : "appsGrpOwn");
  }

  // Liste im normalen Modus (ohne Kopf und Suchfeld, die bleiben beim Tippen stehen)
  _listHtml() {
    const { escape, mdi } = this.h;
    const q = this.ui.q.trim().toLowerCase();
    const list = this.data.layout[this.layoutKey()] === "list";
    const match = (a) => !q || `${a.name} ${a.sub || ""}`.toLowerCase().includes(q);
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
      // Eigene Apps legt man nur im Bearbeiten-Modus an: ohne Eintrag zum Zeigen fehlt auch der Abschnitt
      if (!items.length) continue;
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
      out += list ? `<div class="ap-rows">${items.map((a) => this._row(a)).join("")}</div>` : `<div class="ap-grid">${items.map((a) => this._tile(a)).join("")}</div>`;
    }
    if (!any) out += `<p class="ap-note">${escape(this.t("appsNone"))}</p>`;
    return out;
  }

  _editRow(a) {
    const { escape, mdi } = this.h;
    const hid = this.isHidden(a);
    const eye = a.locked
      ? `<span class="ap-a dis" title="${escape(this.t(`appsLocked_${a.id}`))}" aria-label="${escape(this.t(`appsLocked_${a.id}`))}">${mdi("lock", 18)}</span>`
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
      ${this._ico(a, 18, true)}<span class="ap-t"><b>${escape(a.name)}${a.ext ? ` <span class="ap-ext in">${mdi("link", 12)}</span>` : ""}</b>${a.sub ? `<small>${escape(a.sub)}</small>` : ""}</span>
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
      : `<div class="ap-head"><b class="ap-title">${escape(this.t("appsTitle"))}</b>${this._admin() ? `<button type="button" class="ap-pw" data-ap="restart" title="${escape(this.t("appsRestart"))}" aria-label="${escape(this.t("appsRestart"))}">${mdi("power", 18)}</button>` : ""}<button type="button" class="ap-link" data-ap="edit">${mdi("pencil", 16)}<span>${escape(this.t("appsEditBtn"))}</span></button>
        <button type="button" class="ap-x" data-ap="close" title="${escape(this.t("close"))}" aria-label="${escape(this.t("close"))}">${mdi("close", 18)}</button></div>`;
    const search = edit ? "" : `<label class="ap-search">${mdi("search", 18)}<input class="ap-q" type="search" value="${escape(this.ui.q)}" placeholder="${escape(this.t("appsSearch"))}" aria-label="${escape(this.t("appsSearch"))}" autocomplete="off">${this.host._fieldClearHtml("data-fc", "", this.ui.q)}</label>`;
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
      <div class="ap-acts"><button type="button" class="dlg-btn" data-ap="fclose">${escape(this.t("settingsCancel"))}</button><button type="button" class="dlg-btn primary" data-ap="fsave">${mdi("save", 18)}${escape(this.t("settingsSave"))}</button></div>`;
    this._formSync();
  }

  _formPreview() {
    const el = this.fdlg?.querySelector("[data-f-prev]");
    const f = this.ui.form;
    if (!el || !f) return;
    const { escape, mdi } = this.h;
    el.innerHTML = `<span class="ap-main">${this._ico({ icon: f.icon, favicon: f.src === "favicon" ? f.favicon : null }, 22)}<span class="ap-nm">${escape(f.name.trim() || this.t("appsFName"))}</span></span>${f.ext ? `<span class="ap-ext">${mdi("link", 12)}</span>` : ""}`;
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
      case "restart":
        // Immer mit Rückfrage; die sichere Antwort hat den Fokus
        return this.host._askConfirm({ title: "restartTitle", note: "restartNote", no: "restartNo", yes: "restartYes" }, () => this.host._restartHa());
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
