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
    if (mobile) {
      // Launcher offen: die Symbole des Kopfes liegen genau über denen der Kopfzeile des Panels (Neustart über dem ersten, Bleistift über dem zweiten, Strich, Kreuz über dem Launcher-Knopf)
      const C = "const c = (e) => { const x = e.getBoundingClientRect(); return [Math.round((x.left + x.width / 2) * 10) / 10, Math.round((x.top + x.height / 2) * 10) / 10]; };";
      const tb = JSON.parse(await ev(`${C} const pins = [...r.querySelectorAll(".toolbar .app-pin")]; return JSON.stringify({ a: c(pins[0]), b: c(pins[1]), sep: c(r.querySelector(".toolbar .tb-sep")), apps: c(r.querySelector(".toolbar .apps-btn")) })`));
      await ev(`r.querySelector(".apps-btn").click()`);
      await p.waitForTimeout(700);
      const hd = JSON.parse(await ev(`${C} const h = r.querySelector("dialog.apps-dlg .ap-head"); return JSON.stringify({ pw: h.querySelector(".ap-pw") && c(h.querySelector(".ap-pw")), ed: c(h.querySelector('[data-ap="edit"]')), sep: c(h.querySelector(".dlg-sep")), x: c(h.querySelector(".ap-x")) })`));
      const pos = { tb, hd };
      check(`[${tag}] Launcher-Kopf: Symbole genau über denen der Kopfzeile`, pos.hd.pw && Math.abs(pos.hd.pw[0] - pos.tb.a[0]) < 0.6 && Math.abs(pos.hd.ed[0] - pos.tb.b[0]) < 0.6 && Math.abs(pos.hd.sep[0] - pos.tb.sep[0]) < 0.6 && Math.abs(pos.hd.x[0] - pos.tb.apps[0]) < 0.6, JSON.stringify(pos));
    }
    if (mobile) {
      // Geräte-Popup (2.200.0): Protokoll, Herz, Strich und Kreuz liegen über den zwei angehefteten Apps, dem Strich und dem Launcher-Knopf
      await ev(`r.querySelector("dialog.apps-dlg")?.close?.()`);
      const tb2 = JSON.parse(await ev(`const c = (e) => { const x = e.getBoundingClientRect(); return [Math.round((x.left + x.width / 2) * 10) / 10, Math.round((x.top + x.height / 2) * 10) / 10]; }; const pins = [...r.querySelectorAll(".toolbar .app-pin")]; return JSON.stringify({ a: c(pins[0]), b: c(pins[1]), sep: c(r.querySelector(".toolbar .tb-sep")), apps: c(r.querySelector(".toolbar .apps-btn")) })`));
      await ev(`r.host._openDevice("b")`);
      await p.waitForTimeout(700);
      const dv = JSON.parse(await ev(`const c = (e) => { const x = e.getBoundingClientRect(); return [Math.round((x.left + x.width / 2) * 10) / 10, Math.round((x.top + x.height / 2) * 10) / 10]; }; const h = r.querySelector("dialog.device .dlg-head"); return JSON.stringify({ log: c(h.querySelector(".dlg-head-log")), fav: c(h.querySelector(".dlg-fav")), sep: c(h.querySelector(":scope > .dlg-sep")), x: c(h.querySelector(".dlg-close")), close: c(h.querySelector(".dlg-close")), favTop: h.querySelector(".dlg-fav").getBoundingClientRect().top, sepMid: Math.abs(c(h.querySelector(":scope > .dlg-sep"))[1] - c(h.querySelector(".dlg-close"))[1]) })`));
      check(`[${tag}] Geräte-Popup: Protokoll, Herz, Strich und Kreuz genau über den Symbolen der Kopfzeile`, Math.abs(dv.log[0] - tb2.a[0]) < 0.6 && Math.abs(dv.fav[0] - tb2.b[0]) < 0.6 && Math.abs(dv.sep[0] - tb2.sep[0]) < 0.6 && Math.abs(dv.x[0] - tb2.apps[0]) < 0.6 && dv.sepMid < 1, JSON.stringify({ tb2, dv }));
    }
    check(`[${tag}] keine Fehler`, errors.length === 0, errors.join("|"));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
