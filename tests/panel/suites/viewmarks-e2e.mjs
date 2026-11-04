// Markierungen für eigene Einstellungen in der Liste (2.191.1): in der Ansicht (Desktop: Reiter "Spalten", Handy: "Sortierung") schaltet
// ein Schalter "Markierungen für eigene Einstellungen" die kleinen Symbole neben dem Namen ein. Standard: aus. Der Stand gilt je Gerät
// (Desktop, Handy), wird beim Speichern übernommen und von "Standard wiederherstellen" zurückgesetzt. Deutsch und Englisch.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = { de: { label: "Markierungen für eigene Einstellungen" }, en: { label: "Marks for own settings" } };

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&marks=off&theme=${mobile ? "dark" : "light"}`);
    await p.evaluate(() => { window.__devSettings.battery = { a: "off", c: 30 }; });
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const marks = () => ev(`return r.querySelectorAll(".dev .ovr").length`);

    check(`[${tag}] Standard: keine Markierungen in der Liste`, (await wait(`return r.querySelectorAll(".dev").length > 1`)) && (await marks()) === 0);
    await tap(mobile ? "[data-view-open]" : ".view-btn");
    await wait(`return !!r.querySelector("dialog.settings [data-vmarks]")`);
    check(`[${tag}] Ansicht: Schalter "${T.label}", aus`, await ev(`const i = r.querySelector("dialog.settings [data-vmarks]"); return !!i && !i.checked && r.querySelector("dialog.settings").textContent.includes(${JSON.stringify(T.label)})`));
    await tap("dialog.settings [data-vmarks]");
    check(`[${tag}] eingeschaltet: Markierungen erscheinen in der Liste`, await wait(`return r.querySelectorAll(".dev .ovr").length >= 2 && r.querySelector("dialog.settings [data-vmarks]").checked`));
    await tap("dialog.settings [data-vmarks]");
    check(`[${tag}] wieder aus: Markierungen weg`, await wait(`return r.querySelectorAll(".dev .ovr").length === 0 && !r.querySelector("dialog.settings [data-vmarks]").checked`));
    await tap("dialog.settings [data-vmarks]");
    await wait(`return r.querySelectorAll(".dev .ovr").length >= 2`);
    await tap(mobile ? '[data-vreset="sheet"]' : '[data-vreset="cols"]');
    check(`[${tag}] Standard wiederherstellen: Markierungen aus`, await wait(`return r.querySelectorAll(".dev .ovr").length === 0 && !r.querySelector("dialog.settings [data-vmarks]").checked`));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
