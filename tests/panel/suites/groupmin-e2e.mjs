// Ausfälle pro Integration zusammenfassen (2.94.0): Feld "Zusammenfassen ab" im Reiter Ausfall (nur bei eingeschaltetem
// Zusammenfassen), Bereich 2 bis 20, Speichern. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = { de: { label: "Zusammenfassen ab", unit: "Geräte" }, en: { label: "Combine from", unit: "devices" } };

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
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const typeIn = async (sel, val) => { const h = await handle(sel); await h.scrollIntoViewIfNeeded(); await h.click(); await h.fill(""); await h.type(val); await p.keyboard.press("Tab"); };

    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await tap('.mon-tab[data-key="outage"]');
    await wait(`return !!r.querySelector('[data-opt="notify_group"], input[data-opt="notify_group"]')`);
    check(`[${tag}] Feld "${T.label}" bei eingeschaltetem Zusammenfassen, Standard 3`, await wait(`return r.querySelector('input[data-opt="notify_group_min"]')?.value === "3"`));
    check(`[${tag}] Beschriftung und Einheit`, await ev(`const row = r.querySelector('input[data-opt="notify_group_min"]').closest(".opt"); return row.textContent.includes(${JSON.stringify(T.label)}) && row.textContent.includes(${JSON.stringify(T.unit)})`));
    // Ausserhalb des Bereichs: Fehler, Speichern gesperrt
    await typeIn('input[data-opt="notify_group_min"]', "1");
    check(`[${tag}] 1: Bereichsfehler`, await wait(`return !!r.host._settingsErrors().notify_group_min`));
    await typeIn('input[data-opt="notify_group_min"]', "21");
    check(`[${tag}] 21: Bereichsfehler`, await wait(`return !!r.host._settingsErrors().notify_group_min`));
    await typeIn('input[data-opt="notify_group_min"]', "5");
    check(`[${tag}] 5: Entwurf, kein Fehler`, await wait(`return r.host._settings.draft.notify_group_min === 5 && !r.host._settingsErrors().notify_group_min`));
    await tap('dialog.settings [data-set="save"]');
    await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`);
    const so = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_options").at(-1)?.values);
    check(`[${tag}] gespeichert`, so?.notify_group_min === 5, JSON.stringify(so));
    // Zusammenfassen aus: das Feld verschwindet
    await tap('input[data-opt="notify_group"]');
    check(`[${tag}] Zusammenfassen aus: kein Feld`, await wait(`return !r.querySelector('input[data-opt="notify_group_min"]')`));
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
