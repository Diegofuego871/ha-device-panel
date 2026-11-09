// App "Updates" (2.211.0): Neustart-Knopf in der Kopfzeile links neben "Nach Updates suchen", Lage wie die Symbole der anderen Fenster,
// Rückfrage vor dem Neustart (Abbrechen, Escape, Bestätigen genau ein Aufruf), kein Knopf für Nicht-Administratoren. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = { de: { need: "Neustart nötig", label: "Home Assistant neu starten", title: "Home Assistant neu starten?", no: "Abbrechen", yes: "Neu starten", starting: "Home Assistant startet neu" }, en: { need: "Restart needed", label: "Restart Home Assistant", title: "Restart Home Assistant?", no: "Cancel", yes: "Restart", starting: "Home Assistant is restarting" } };
for (const lang of ["de", "en"]) {
  const L = T[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const errors = [];
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark&updapp=1`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const restarts = () => p.evaluate(() => window.__services.filter((s) => s.domain === "homeassistant" && s.service === "restart").length);
    const D = "dialog.updapp-dlg";
    await ev(`r.host._updApp.open()`);
    await wait(`return r.querySelector("dialog[open] .dlg-acts")`);
    const dlgSel = await ev(`return r.querySelector("dialog[open] .ua-pw")?.closest("dialog")?.className || ""`);
    check(`[${tag}] Knopf in der Kopfzeile, Beschriftung "${L.label}"`, (await ev(`return r.querySelector(".ua-pw")?.getAttribute("aria-label")`)) === L.label, dlgSel);
    const geo = await ev(`const q = (s) => { const x = r.querySelector(s).getBoundingClientRect(); return [Math.round(x.left), Math.round(x.right), Math.round(x.top), Math.round(x.width), Math.round(x.height)]; }; return JSON.stringify({ pw: q(".ua-pw"), chk: q("[data-ua-check]"), sep: q(".dlg-sep"), close: q('[data-ua="close"]') })`);
    check(`[${tag}] Knopf links neben "Nach Updates suchen", vor dem Kreuz, gleiche Grösse und Höhe`, await ev(`const q = (s) => r.querySelector(s).getBoundingClientRect(); const a = q(".ua-pw"), c = q("[data-ua-check]"); return a.right <= c.left + 1 && Math.abs(a.top - c.top) < 1 && a.width === c.width && a.height === c.height && c.right <= q('[data-ua="close"]').left + 1`), geo);
    await tap(".ua-pw");
    check(`[${tag}] Rückfrage "${L.title}", noch nichts gesendet, Fokus auf "${L.no}"`, (await wait(`return r.querySelector("dialog.discard-dlg")?.open && r.querySelector("#dd-t")?.textContent === ${JSON.stringify(L.title)}`)) && (await restarts()) === 0 && (await ev(`return r.querySelector("dialog.discard-dlg").querySelector('[data-dd="no"]').textContent === ${JSON.stringify(L.no)} && r.querySelector("dialog.discard-dlg").querySelector('[data-dd="yes"]').textContent === ${JSON.stringify(L.yes)}`)));
    await tap('dialog.discard-dlg [data-dd="no"]');
    check(`[${tag}] Abbrechen: kein Neustart, Updates-Fenster bleibt offen`, (await wait(`return !r.querySelector("dialog.discard-dlg").open`)) && (await restarts()) === 0 && (await ev(`return !!r.querySelector("dialog[open] .ua-pw")`)));
    await tap(".ua-pw");
    await wait(`return r.querySelector("dialog.discard-dlg").open`);
    await p.keyboard.press("Escape");
    check(`[${tag}] Escape bricht ab`, (await wait(`return !r.querySelector("dialog.discard-dlg").open`)) && (await restarts()) === 0);
    await tap(".ua-pw");
    await wait(`return r.querySelector("dialog.discard-dlg").open`);
    await tap('dialog.discard-dlg [data-dd="yes"]');
    check(`[${tag}] "${L.yes}": homeassistant.restart genau einmal aufgerufen`, (await p.waitForFunction(() => window.__services.some((s) => s.service === "restart"), null, { timeout: 4000 }).then(() => true, () => false)) && (await restarts()) === 1);
    check(`[${tag}] nach "${L.yes}": Hinweis "${L.starting}" im Fenster`, await wait(`return (r.querySelector("dialog[open] .dlg-note")?.textContent || "").includes(${JSON.stringify(L.starting)})`));
    // Neustart nötig (2.212.0): der Server meldet eine Integration, deren Dateien neuer sind als der laufende Code
    check(`[${tag}] ohne offene Neustarts: kein Hinweis "${L.need}"`, await ev(`return !r.querySelector(".ua-rst")`));
    await p.evaluate(() => { window.__restartNeeded = [{ domain: "alarmageddon", name: "Alarmageddon", running: "0.22.0", installed: "0.23.0" }]; });
    await ev(`return r.host._updApp.load().then(() => { r.host._updApp.render(); return true; })`);
    check(`[${tag}] Hinweis "${L.need}" mit Name und Versionen (0.22.0 → 0.23.0)`, await wait(`const x = r.querySelector(".ua-rst"); return !!x && x.querySelector("b").textContent === ${JSON.stringify(L.need)} && /Alarmageddon \\(0\\.22\\.0 → 0\\.23\\.0\\)/.test(x.textContent)`));
    await p.screenshot({ path: `${outDir}/updaterestart-${tag.replace("/", "-")}.png` });
    check(`[${tag}] Hinweis passt in die Breite (kein seitliches Scrollen)`, await ev(`const b = r.querySelector("[data-ua-body]"); return b.scrollWidth <= b.clientWidth + 1`));
    const before = await restarts();
    await tap(".ua-rst [data-ua='restart']");
    check(`[${tag}] Knopf im Hinweis fragt zuerst, sendet noch nichts`, (await wait(`return r.querySelector("dialog.discard-dlg")?.open && r.querySelector("#dd-t")?.textContent === ${JSON.stringify(L.title)}`)) && (await restarts()) === before);
    await tap('dialog.discard-dlg [data-dd="no"]');
    await p.evaluate(() => { window.__restartNeeded = []; });
    await ev(`return r.host._updApp.load().then(() => { r.host._updApp.render(); return true; })`);
    check(`[${tag}] nach dem Neustart (nichts mehr offen): Hinweis weg`, await wait(`return !r.querySelector(".ua-rst")`));
    // Während des Neustarts bricht die Verbindung ab (die Antwort ist ein Objekt ohne Text, vorher stand "result" rot im Fenster); ein echter Fehler bleibt sichtbar
    await ev(`const h = r.host._hass; window.__origWS = h.callWS.bind(h); h.callWS = async (m) => { if (m.type === "device_panel/updates_list") throw window.__wsErr; return window.__origWS(m); };`);
    await f.evaluate(() => { window.__wsErr = { type: "result", success: false }; });
    await ev(`return r.host._updApp.load().then(() => true)`);
    check(`[${tag}] Verbindung weg beim Laden: keine rote Zeile`, await ev(`return !r.querySelector("dialog[open] .dlg-error")`));
    await f.evaluate(() => { window.__wsErr = { code: "unknown_error", message: "kaputt" }; });
    await ev(`return r.host._updApp.load().then(() => true)`);
    check(`[${tag}] echter Fehler des Servers: bleibt sichtbar`, await wait(`return (r.querySelector("dialog[open] .dlg-error")?.textContent || "").includes("kaputt")`));
    await ev(`r.host._hass.callWS = window.__origWS; return r.host._updApp.load().then(() => true)`);
    check(`[${tag}] danach wieder verbunden: Fehler weg`, await wait(`return !r.querySelector("dialog[open] .dlg-error")`));
    // Nicht-Administrator: kein Knopf
    await p.evaluate(() => { const ha = document.querySelector("home-assistant").hass; ha.user = { ...ha.user, is_admin: false }; });
    await ev(`r.host._hass = { ...r.host._hass, user: { ...r.host._hass.user, is_admin: false } }; r.host._updApp.frame()`);
    check(`[${tag}] Nicht-Administrator: kein Neustart-Knopf`, await ev(`return !r.querySelector(".ua-pw")`));
    check(`[${tag}] keine Fehler`, errors.length === 0, errors.join("|"));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
