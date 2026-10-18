// "Erst melden nach" pro Integration (2.91.0): Auswahl im Integrationsdetail, Entwurf,
// Fehler bei zu kurzer Zeit (blockiert Speichern), Speichern, Übersicht. DE/EN, Desktop/Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = { de: { diff: "Meldung nach 10 Min." }, en: { diff: "Notify after 10 min" } };

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const T = TEXT[lang];
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=light`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const pick = (attr, dom, value) => ev(`const s=r.querySelector('select[data-${attr}="${dom}"]'); s.value=${JSON.stringify(value)}; s.dispatchEvent(new Event("change",{bubbles:true,composed:true}))`);

    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await tap('[data-set="tab"][data-key="integ"]');
    await wait(`return !!r.querySelector(".ilist")`);
    await tap('[data-set="integ"][data-key="zha"]');
    await wait(`return !!r.querySelector('select[data-delay-mode="zha"]')`);
    check(`[${tag}] Auswahl vorhanden, Standard`, (await ev(`return r.querySelector('select[data-delay-mode="zha"]').value`)) === "default");
    await pick("delay-mode", "zha", "10");
    check(`[${tag}] Entwurf 10 Min.`, await wait(`return r.host._settings.draft.notify_delay_integrations?.zha === 10`));
    await tap('[data-set="integ"][data-key=""]');
    await wait(`return !!r.querySelector(".ilist")`);
    check(`[${tag}] Übersicht "${T.diff}"`, (await text('.ilist-row[data-key="zha"] .ilist-diff')).includes(T.diff), await text('.ilist-row[data-key="zha"] .ilist-diff'));
    // Zu kurz: "Ausgefallen nach" 1 Std. und Meldezeit 10 Min. blockiert
    await tap('[data-set="integ"][data-key="zha"]');
    await wait(`return !!r.querySelector('select[data-off-mode="zha"]')`);
    await pick("off-mode", "zha", "60");
    check(`[${tag}] zu kurz: Fehler, Speichern gesperrt`, await wait(`return !!r.host._settingsErrors().notify_delay_integrations`), JSON.stringify(await ev(`return r.host._settingsErrors()`)));
    await pick("delay-mode", "zha", "60");
    check(`[${tag}] gleich lang: kein Fehler`, await wait(`return !r.host._settingsErrors().notify_delay_integrations`));
    await tap('dialog.settings [data-set="save"]');
    await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`);
    const so = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_options").at(-1)?.values);
    check(`[${tag}] gespeichert`, so?.notify_delay_integrations?.zha === 60 && so?.offline_after_integrations?.zha === 60, JSON.stringify(so));
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
