// Knopf "Integration in HA öffnen" ganz oben im Abschnitt "Panel" der Einstellungen (2.177.0): gleiche Gestalt wie auf der Gerätekarte,
// öffnet die Seite der Integration in Home Assistant; bei ungespeicherten Änderungen kommt erst die Rückfrage. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const label = lang === "de" ? "Integration in HA öffnen" : "Open integration in HA";
    const open = async () => { await tap(".gear-btn"); await wait(`return !!r.querySelector("dialog.settings .set-sec")`); await tap('[data-set="section"][data-id="updates"]'); await wait(`return !!r.querySelector('dialog.settings [data-set="open-ha"]')`); };
    const onHaPage = () => p.evaluate(() => location.pathname.endsWith("/config/integrations/integration/device_panel"));

    await open();
    check(`[${tag}] Knopf "${label}" ganz oben im Abschnitt "Panel", vor den Reitern, mit Symbol`, await ev(`const b = r.querySelector('dialog.settings [data-set="open-ha"]'); const first = b.closest(".dlg-quick"); const tabs = r.querySelector("dialog.settings .sub-tabs"); return b.textContent.trim() === ${JSON.stringify(label)} && !!b.querySelector("svg") && b.classList.contains("qbtn") && !!(first.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING)`));
    check(`[${tag}] gleiche Gestalt wie auf der Gerätekarte (Klasse qbtn, Höhe 34 px)`, await ev(`return Math.round(r.querySelector('dialog.settings [data-set="open-ha"]').getBoundingClientRect().height) === 34`));
    await p.screenshot({ path: `${process.env.OUT || "output"}/panel-ha-btn-${tag.replace("/", "-")}.png` });
    // Mit ungespeicherter Änderung: erst die Rückfrage
    await ev(`r.host._settings.draft.update_check = !r.host._settings.draft.update_check; r.host._renderSettings()`);
    await tap('dialog.settings [data-set="open-ha"]');
    check(`[${tag}] ungespeicherte Änderung: Rückfrage, noch keine Navigation`, (await wait(`return r.querySelector("dialog.discard-dlg:not(.pause-dlg)").open`)) && !(await onHaPage()));
    await tap('dialog.discard-dlg:not(.pause-dlg) [data-dd="yes"]');
    check(`[${tag}] nach "Verwerfen": Einstellungen zu, Seite der Integration in HA`, (await wait(`return !r.querySelector("dialog.settings").open`)) && (await onHaPage()));
    // Ohne Änderung: direkt
    await p.evaluate(() => history.pushState({}, "", "/ha-sim.html"));
    await open();
    await tap('dialog.settings [data-set="open-ha"]');
    check(`[${tag}] ohne Änderung: direkt zur Seite der Integration`, (await wait(`return !r.querySelector("dialog.settings").open`)) && (await onHaPage()));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(";"));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
