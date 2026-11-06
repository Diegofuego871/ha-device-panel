// Abfrage ohne neue Daten zeichnet nicht neu (2.204.1): gleiche Antwort (nur die Serverzeit neu) lässt die Liste stehen, geänderte Daten
// und eine Änderung durch den Benutzer (changed) zeichnen; Zahlen und Zeiten stehen gleich wie vorher (Formatierer zwischengespeichert).
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    // Zähler für das Zeichnen
    await ev(`const h = r.host; h.__renders = 0; const orig = h._render.bind(h); h._render = (...a) => { h.__renders++; return orig(...a); };`);
    await ev(`return r.host._fetch()`);
    const before = await ev(`return r.host.__renders`);
    const listHtml = await ev(`return r.querySelector(".list").innerHTML`);
    await ev(`return r.host._fetch()`);
    await ev(`return r.host._fetch()`);
    check(`[${tag}] zwei Abfragen ohne neue Daten: nicht neu gezeichnet`, (await ev(`return r.host.__renders`)) === before);
    check(`[${tag}] Liste unverändert`, (await ev(`return r.querySelector(".list").innerHTML`)) === listHtml);
    // Neue Daten: ein Gerät heisst anders
    const id = await p.evaluate(() => { const d = window.__devices[0]; d.name = `${d.name} neu`; return d.id; });
    await ev(`return r.host._fetch()`);
    check(`[${tag}] geänderte Daten: neu gezeichnet, neuer Name sichtbar`, (await ev(`return r.host.__renders`)) === before + 1 && (await ev(`return [...r.querySelectorAll(".dev")].some((x) => x.textContent.includes(" neu"))`)), id);
    // Änderung durch den Benutzer: zeichnet auch bei gleichen Daten
    const n = await ev(`return r.host.__renders`);
    await ev(`return r.host._fetch(true)`);
    check(`[${tag}] Abfrage nach einer Änderung (changed): gezeichnet`, (await ev(`return r.host.__renders`)) === n + 1);
    // Zahlen wie vorher: 99,5 % bzw. 99.5 %
    check(`[${tag}] Prozent im Format der Sprache`, (await ev(`return r.host._fmtPct(99.5)`)) === (lang === "de" ? "99,5" : "99.5") && (await ev(`return r.host._fmtPct(100)`)) === "100");
    check(`[${tag}] keine Fehler`, errors.length === 0, errors.join("|"));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
