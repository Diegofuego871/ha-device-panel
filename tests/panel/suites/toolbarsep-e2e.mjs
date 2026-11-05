// Kopfzeile des Panels (2.197.0): Strich zwischen den angehefteten Apps und dem Launcher-Knopf, je 16 px bis zu den Knöpfen
// (wie in den Köpfen der Fenster); Launcher-Knopf ganz rechts. Deutsch und Englisch, Desktop und Handy.
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
    const m = JSON.parse(await ev(`
      const rect = (e) => e.getBoundingClientRect();
      const pins = [...r.querySelectorAll(".toolbar .app-pin")];
      const sep = r.querySelector(".toolbar .tb-sep");
      const apps = r.querySelector(".toolbar .apps-btn");
      if (!pins.length || !sep) return JSON.stringify({ pins: pins.length, sep: !!sep });
      const last = rect(pins[pins.length - 1]), s = rect(sep), a = rect(apps), tb = rect(r.querySelector(".toolbar"));
      const prev = pins.length > 1 ? rect(pins[pins.length - 2]) : null;
      return JSON.stringify({ pins: pins.length, left: s.left - last.right, right: a.left - s.right, h: s.height, tbRight: tb.right - a.right, order: last.right <= s.left && s.right <= a.left, between: prev ? last.left - prev.right : null, sepMid: Math.abs((s.top + s.height / 2) - (a.top + a.height / 2)) });
    `));
    check(`[${tag}] Strich vor dem Launcher-Knopf`, m.sep !== false && m.pins > 0, JSON.stringify(m));
    check(`[${tag}] 16 px links und rechts des Strichs, Strich mittig zu den Knöpfen`, Math.abs(m.left - 16) < 0.6 && Math.abs(m.right - 16) < 0.6 && m.sepMid < 1, JSON.stringify(m));
    check(`[${tag}] Reihenfolge angeheftete Apps, Strich, Launcher`, m.order === true);
    check(`[${tag}] keine Fehler`, errors.length === 0, errors.join("|"));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
