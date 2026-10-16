// Reiter "Schalter" zeigt auch number- und select-Entitäten (2.80.0); ein Tipp öffnet die Bedienung von HA, geschaltet wird nichts.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto("http://127.0.0.1:8950/ha-sim.html?lang=de&theme=light");
const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 6000 }).then(() => true, () => false);
await p.evaluate(() => {
  window.__detailExtra = {
    g: [
      { entity_id: "number.deckenlicht_helligkeit", name: "Helligkeit", state: "40", unit: "%", category: "config", liveness: false },
      { entity_id: "select.deckenlicht_modus", name: "Modus", state: "Auto", unit: null, category: "config", liveness: false },
    ],
  };
});
await ev(`[...r.querySelectorAll(".dev")].find((e) => e.textContent.includes("Deckenlicht Wohnzimmer")).click()`);
await wait(`return r.querySelector("dialog.device")?.open && !!r.querySelector("dialog.device .dev-tabs .sub-tab")`);
await p.waitForTimeout(500);
await (await f.evaluateHandle(new Function(`return ${R}.querySelector('dialog.device [data-tab="sw"]')`))).asElement().click();
check("number und select erscheinen als Kacheln", await wait(`return [...r.querySelectorAll("dialog.device .sw-cell")].map((e) => e.dataset.entity.split(".")[0]).join() === "light,number,select"`),
  await ev(`return [...r.querySelectorAll("dialog.device .sw-cell")].map((e) => e.dataset.entity).join()`));
await (await f.evaluateHandle(new Function(`return ${R}.querySelector('dialog.device .sw-cell[data-entity="number.deckenlicht_helligkeit"]')`))).asElement().click();
check("Tipp öffnet more-info der Zahl", await p.evaluate(() => window.__moreInfo.at(-1) === "number.deckenlicht_helligkeit"));
check("kein Befehl gesendet", await p.evaluate(() => !window.__wsCalls.some((m) => /set_value|select_option|call_service/.test(JSON.stringify(m)))));
check("keine Seitenfehler", errors.length === 0, errors.join("|"));
await b.close();
process.exit(ok ? 0 : 1);
