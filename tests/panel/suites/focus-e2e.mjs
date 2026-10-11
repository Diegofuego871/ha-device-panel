// Kein Fokusring nach dem Schliessen eines Fensters auf dem Handy (2.0.9): Beim Schliessen gibt der Browser den Fokus an die
// antippte Kachel zurück und zeigt dort einen blauen Ring (:focus-visible). Geprüft: Puls, Geräte-Popup, Einstellungen, Ansicht.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=de&theme=dark`);
const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
const tap = async (sel) => {
  for (let versuch = 1; ; versuch++) {
    const h = await handle(sel);
    if (!h) throw new Error("fehlt: " + sel);
    try { await h.scrollIntoViewIfNeeded(); await h.tap(); return; } catch (err) { if (versuch >= 3 || !/not attached|not stable/.test(String(err))) throw err; }
  }
};
const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
const focused = () => ev(`const a = r.activeElement; return a ? (a.className || a.tagName) : "keiner"`);
const ring = () => ev(`return !!r.querySelector(":focus-visible")`);

// Puls: Kachel antippen, Fenster schliessen
await tap(".kt.pul");
check("Puls: Fenster offen", await wait(`return r.querySelector("dialog.pulse-dlg")?.open`));
await tap("dialog.pulse-dlg .dlg-close");
check("Puls: Fenster zu", await wait(`return !r.querySelector("dialog.pulse-dlg")?.open`));
await p.waitForTimeout(300);
check("Puls: kein Fokusring und kein Fokus an der Kachel", !(await ring()) && (await focused()) === "keiner", await focused());

// Geräte-Popup
await tap('.dev[data-open="c"]');
await wait(`return r.querySelector("dialog.device")?.open`);
await tap('dialog.device [data-dlg="close"]');
await wait(`return !r.querySelector("dialog.device").open`);
await p.waitForTimeout(300);
check("Geräte-Popup: kein Fokusring nach dem Schliessen", !(await ring()), await focused());

// Einstellungen
await tap(".gear-btn");
await wait(`return r.querySelector("dialog.settings")?.open`);
await tap('dialog.settings .dlg-actions [data-set="close"]');
await wait(`return !r.querySelector("dialog.settings").open`);
await p.waitForTimeout(300);
check("Einstellungen: kein Fokusring nach dem Schliessen", !(await ring()), await focused());

// Ansicht (Zeile Sortierung & Ansicht)
await tap(".sort-btn");
await wait(`return r.querySelector("dialog.view")?.open`);
await tap("dialog.view .dlg-actions [data-vdone]");
await wait(`return !r.querySelector("dialog.view").open`);
await p.waitForTimeout(300);
check("Ansicht: kein Fokusring nach dem Schliessen", !(await ring()), await focused());

check("keine Skriptfehler", errors.length === 0, errors.join(" | "));
await ctx.close();
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
