// Status-App (2.62.0, docs/mockups/status-v1, Variante A): App im Launcher (nur Administratoren, nicht vorgemerkt), Fenster mit Config oben
// (Schalter und Auswahl "Empfänger" wie bei den Reitern der Einstellungen) und Zustand der Teile; Punkte: rot = Störung, orange = Debug,
// am Launcher-Knopf oder, wenn die App angeheftet ist, an ihrem eigenen Knopf; Pillen im Launcher. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { restart: "Neu starten", askRoutines: "Routinen neu starten?", notHa: "nicht Home Assistant", catchUp: "Nachhol-Fenster", done: "Ausfall-Überwachung wurde neu gestartet.", app: "Status", win: "Status", allOk: "Alles läuft", prob1: "Störung: 1 Teil", prob2: "Störung: 2 Teile", up: "läuft", late: "verspätet", down: "steht", pill: "Störung", debug: "Debug", std: "Standard (kein Ziel)", notify: "Bei Stillstand melden" },
  en: { restart: "Restart", askRoutines: "Restart Routines?", notHa: "not Home Assistant", catchUp: "catch-up window", done: "Outage monitoring was restarted.", app: "Status", win: "Status", allOk: "Everything is running", prob1: "Fault: 1 part", prob2: "Fault: 2 parts", up: "running", late: "late", down: "stopped", pill: "Fault", debug: "Debug", std: "Default (no target)", notify: "Alert when something stops" },
};

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=${mobile ? "dark" : "light"}`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => {
      for (let n = 1; ; n++) {
        const h = await handle(sel);
        if (!h) throw new Error("fehlt: " + sel);
        try { await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); return; } catch (err) { if (n >= 3 || !/not attached|not stable/.test(String(err))) throw err; await p.waitForTimeout(200); }
      }
    };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    // zweimal: läuft gerade eine Abfrage (Takt von 10 Sek.), überspringt _fetch den Aufruf und das Ergebnis wäre veraltet
    const refetch = async () => { for (let i = 0; i < 2; i++) { await ev(`r.host._fetch()`); await p.waitForTimeout(400); } };
    const setStates = (o) => p.evaluate((x) => { window.__statusStates = x; }, o);
    const openLauncher = async () => { await tap(".apps-btn"); await wait(`return r.querySelector("dialog.apps-dlg")?.open`); };
    const closeLauncher = async () => { await ev(`r.host._apps.close()`); await p.waitForTimeout(200); };

    // Ausgangslage: alles läuft, kein Punkt, App im Launcher, nicht in der Kopfzeile
    check(`[${tag}] alles ok: kein Punkt am Launcher-Knopf, kein Status-Knopf in der Kopfzeile`, await ev(`const b = r.querySelector(".apps-btn"); return !b.classList.contains("has-dot") && !r.querySelector('[data-app-pin="status"]')`));
    await openLauncher();
    check(`[${tag}] Launcher: App "${T.app}" in der Gruppe Device Panel, ohne Pille`, await ev(`const t = r.querySelector('dialog.apps-dlg [data-id="status"]'); return !!t && !t.closest(".ap-tile, .ap-row").querySelector(".ap-badge")`));
    await closeLauncher();

    // Störung: roter Punkt am Launcher-Knopf, Pille "Störung"
    await setStates({ routines: "down", availability: "late" });
    await refetch();
    check(`[${tag}] Störung: roter Punkt am Launcher-Knopf (nicht orange)`, await wait(`const b = r.querySelector(".apps-btn"); return b.classList.contains("has-dot") && b.classList.contains("dot-bad") && !b.classList.contains("dot-warn")`));
    await openLauncher();
    check(`[${tag}] Launcher: rote Pille "${T.pill}" an der App`, await ev(`const t = r.querySelector('dialog.apps-dlg [data-id="status"]').closest(".ap-tile, .ap-row"); const bd = t.querySelector(".ap-badge.bad"); return !!bd && bd.textContent.trim() === ${JSON.stringify(T.pill)}`));

    // Fenster öffnen
    await tap('dialog.apps-dlg [data-id="status"]');
    check(`[${tag}] Fenster "${T.win}" offen, Launcher zu`, await wait(`return r.querySelector("dialog.status-dlg")?.open && !r.querySelector("dialog.apps-dlg")?.open`));
    await wait(`return r.querySelectorAll("dialog.status-dlg .st-line").length === 8`);
    check(`[${tag}] Kopf "${T.prob2}", acht Teile mit Pillen (steht, verspätet, läuft)`, await ev(`const d = r.querySelector("dialog.status-dlg"); const pills = [...d.querySelectorAll(".st-line .pill")].map((x) => x.textContent.trim()); return d.querySelector(".st-banner.bad b")?.textContent.trim() === ${JSON.stringify(T.prob2)} && pills.length === 8 && pills[0] === ${JSON.stringify(T.down)} && pills[2] === ${JSON.stringify(T.late)} && pills.filter((x) => x === ${JSON.stringify(T.up)}).length === 6`));
    check(`[${tag}] Config oben: Schalter "${T.notify}" an, Auswahl Empfänger mit "${T.std}" gewählt (vor dem Zustand)`, await ev(`const d = r.querySelector("dialog.status-dlg"); const sw = d.querySelector("[data-st-notify]"); const sel = d.querySelector("[data-st-target]"); return sw.checked && sel.options[sel.selectedIndex].textContent.trim() === ${JSON.stringify(T.std)} && !!(sw.compareDocumentPosition(d.querySelector(".st-banner")) & Node.DOCUMENT_POSITION_FOLLOWING)`));
    check(`[${tag}] Start-Zeile mit Routinen geladen und verpasst`, await ev(`return /3/.test(r.querySelector("dialog.status-dlg .st-start").textContent)`));
    check(`[${tag}] kein Ziel (weder eigenes noch globales): rote Warnung unter dem Empfänger`, await ev(`const w = r.querySelector("dialog.status-dlg [data-st-notarget]"); const sel = r.querySelector("dialog.status-dlg [data-st-target]"); return !!w && w.textContent.length > 20 && !!(sel.compareDocumentPosition(w) & Node.DOCUMENT_POSITION_FOLLOWING)`));
    if (mobile) check(`[${tag}] Handy: Fenster füllt den Bildschirm`, await ev(`const rc = r.querySelector("dialog.status-dlg").getBoundingClientRect(); return Math.round(rc.width) === window.innerWidth && Math.round(rc.height) === window.innerHeight`));
    await p.screenshot({ path: `${outDir}/status-${tag.replace("/", "-")}.png` });

    // Config ändern: Auswahl und Schalter schreiben über set_options
    await p.evaluate(() => { window.__wsCalls = []; });
    await ev(`const s = r.querySelector("dialog.status-dlg [data-st-target]"); s.value = "notify.familie"; s.dispatchEvent(new Event("change", { bubbles: true }))`);
    await p.waitForTimeout(600);
    const sets = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_options").map((m) => m.values));
    check(`[${tag}] Empfänger gewählt: set_options mit notify_service_status`, sets.some((v) => v.notify_service_status === "notify.familie"), JSON.stringify(sets));
    check(`[${tag}] mit Ziel: die Warnung verschwindet`, await wait(`return !r.querySelector("dialog.status-dlg [data-st-notarget]")`));
    await ev(`const s = r.querySelector("dialog.status-dlg [data-st-notify]"); s.checked = false; s.dispatchEvent(new Event("change", { bubbles: true }))`);
    await p.waitForTimeout(600);
    check(`[${tag}] Schalter aus: set_options mit status_notify false, Anzeige folgt`, (await p.evaluate(() => window.__opts.status_notify)) === false && (await ev(`return r.querySelector("dialog.status-dlg [data-st-notify]").checked === false && r.querySelector("dialog.status-dlg [data-st-target]").value === "notify.familie"`)));
    await p.evaluate(() => { window.__opts.status_notify = true; window.__opts.notify_service_status = ""; });

    // Neustart von Hand: Knopf nur bei Teilen, die nicht laufen; Rückfrage; Abbrechen; Bestätigen; Fehler
    check(`[${tag}] "${T.restart}": nur bei den zwei gestörten Teilen (Routinen, Ausfall-Überwachung)`, await ev(`const b = [...r.querySelectorAll("dialog.status-dlg [data-st-restart]")].map((x) => x.dataset.stRestart); return JSON.stringify(b) === '["routines","availability"]'`));
    await tap('dialog.status-dlg [data-st-restart="routines"]');
    check(`[${tag}] Rückfrage "${T.askRoutines}" mit Hinweis (nicht Home Assistant) und Routinen-Satz`, await wait(`const c = r.querySelector("dialog.status-dlg .st-confirm"); return !!c && c.querySelector("b").textContent.trim() === ${JSON.stringify(T.askRoutines)} && /${T.notHa}/.test(c.textContent) && /${T.catchUp}/.test(c.textContent)`));
    await p.screenshot({ path: `${outDir}/status-confirm-${tag.replace("/", "-")}.png` });
    await tap('dialog.status-dlg [data-st-restart-no]');
    check(`[${tag}] Abbrechen: Rückfrage weg, nichts neu gestartet`, await wait(`return !r.querySelector("dialog.status-dlg .st-confirm")`) && !(await p.evaluate(() => (window.__statusRestarts || []).length)));
    await p.evaluate(() => { window.__statusRestartFails = true; });
    await tap('dialog.status-dlg [data-st-restart="availability"]');
    await tap('dialog.status-dlg [data-st-restart-yes="availability"]');
    check(`[${tag}] Neustart schlägt fehl: Fehlermeldung im Fenster, Teil bleibt gestört`, await wait(`const d = r.querySelector("dialog.status-dlg"); return /kaputt/.test(d.querySelector(".dlg-error")?.textContent || "") && !!d.querySelector('[data-st-restart="availability"]')`));
    await p.evaluate(() => { window.__statusRestartFails = false; });
    await tap('dialog.status-dlg [data-st-restart="availability"]');
    await tap('dialog.status-dlg [data-st-restart-yes="availability"]');
    check(`[${tag}] Bestätigen: status_restart für availability, Hinweis "${T.done}", Teil läuft wieder`, await wait(`const d = r.querySelector("dialog.status-dlg"); return d.querySelector(".st-flash")?.textContent.includes(${JSON.stringify(T.done)}) && !d.querySelector('[data-st-restart="availability"]')`) && JSON.stringify(await p.evaluate(() => window.__statusRestarts)) === '["availability"]');
    check(`[${tag}] Kopf folgt: noch ${T.prob1}`, await wait(`return r.querySelector("dialog.status-dlg .st-banner.bad b")?.textContent.trim() === ${JSON.stringify(T.prob1)}`));
    await p.evaluate(() => { window.__statusRestarts = []; });

    // Entwarnung: Fenster folgt beim nächsten Abruf
    await setStates({});
    await ev(`r.host._status.load()`);
    check(`[${tag}] Entwarnung: Kopf "${T.allOk}", alle Pillen "${T.up}"`, await wait(`const d = r.querySelector("dialog.status-dlg"); return d.querySelector(".st-banner.ok b")?.textContent.trim() === ${JSON.stringify(T.allOk)} && [...d.querySelectorAll(".st-line .pill")].every((x) => x.textContent.trim() === ${JSON.stringify(T.up)})`));
    await tap('dialog.status-dlg [data-st-close]');
    check(`[${tag}] Schliessen`, await wait(`return !r.querySelector("dialog.status-dlg").open`));

    // Punkte: angeheftet, Debug
    await setStates({ routines: "down" });
    await refetch();
    await ev(`r.host._apps.toggleFav("status")`);
    await p.waitForTimeout(300);
    const pinSel = (id) => `[data-app-pin="${id}"]`;
    if (!mobile) {
      check(`[${tag}] Status angeheftet: roter Punkt am eigenen Knopf, nicht mehr am Launcher-Knopf`, await ev(`const pin = r.querySelector('[data-app-pin="status"]'); const b = r.querySelector(".apps-btn"); return !!pin && pin.classList.contains("has-dot") && pin.classList.contains("dot-bad") && !b.classList.contains("has-dot")`));
      await tap(pinSel("status"));
      check(`[${tag}] Tipp auf den angehefteten Knopf öffnet das Fenster`, await wait(`return r.querySelector("dialog.status-dlg")?.open`));
      await ev(`r.host._status.close()`);
    } else {
      // Handy: nur der erste Favorit steht in der Kopfzeile (Routinen), also bleibt der Punkt am Launcher-Knopf
      check(`[${tag}] Handy: nur der erste Favorit in der Kopfzeile, Punkt bleibt am Launcher-Knopf`, await ev(`return !r.querySelector('[data-app-pin="status"]') && r.querySelector(".apps-btn").classList.contains("dot-bad")`));
    }
    await ev(`r.host._apps.toggleFav("status")`);
    await setStates({});
    await refetch();
    check(`[${tag}] wieder alles ok: Punkt weg`, await wait(`return !r.querySelector(".apps-btn").classList.contains("has-dot")`), await ev(`return JSON.stringify([r.host._statusSum, r.querySelector(".apps-btn").className, r.host._apps.dotLevels(), r.host._apps.data.fav])`));
    // Debug-Modus: orange; mit Störung zusammen gewinnt rot
    await p.evaluate(() => { window.__log.debug = true; });
    await refetch();
    check(`[${tag}] Debug-Modus: oranger Punkt am Launcher-Knopf`, await wait(`const b = r.querySelector(".apps-btn"); return b.classList.contains("dot-warn") && !b.classList.contains("dot-bad")`));
    await openLauncher();
    check(`[${tag}] Launcher: Pille "${T.debug}" am Protokoll, ohne den Protokoll-Dialog geöffnet zu haben`, await ev(`const t = r.querySelector('dialog.apps-dlg [data-id="log"]').closest(".ap-tile, .ap-row"); return t.querySelector(".ap-badge")?.textContent.trim() === ${JSON.stringify(T.debug)}`));
    // Die Pille überlappt das Symbol nicht (Desktop und Handy; sie sass vorher links oben auf dem Symbol, 2.71.0)
    check(`[${tag}] Launcher: Pille "${T.debug}" liegt über dem Symbol, nicht darauf, und innerhalb der Kachel`, await ev(`const t = r.querySelector('dialog.apps-dlg [data-id="log"]').closest(".ap-tile"); if (!t) return true; const b = t.querySelector(".ap-badge").getBoundingClientRect(); const i = t.querySelector(".ap-ico").getBoundingClientRect(); const c = t.getBoundingClientRect(); return b.bottom <= i.top + 0.5 && b.top >= c.top && b.left >= c.left && b.right <= c.right`));
    await closeLauncher();
    await setStates({ routines: "down" });
    await refetch();
    check(`[${tag}] Debug und Störung zugleich: rot geht vor orange`, await wait(`const b = r.querySelector(".apps-btn"); return b.classList.contains("dot-bad") && !b.classList.contains("dot-warn")`));
    await setStates({});
    await p.evaluate(() => { window.__log.debug = false; });
    await refetch();

    // Rechte: Nicht-Administratoren sehen die App nicht
    await p.evaluate(() => { document.querySelector("home-assistant").hass.user = { is_admin: false }; window.__pushHass(); });
    await p.waitForTimeout(300);
    await openLauncher();
    check(`[${tag}] Nicht-Administrator: keine App "${T.app}"`, await ev(`return !r.querySelector('dialog.apps-dlg [data-id="status"]')`));
    check(`[${tag}] keine Konsolenfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALLE BESTANDEN" : "FEHLER");
process.exit(ok ? 0 : 1);
