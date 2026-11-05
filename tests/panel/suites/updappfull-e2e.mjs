// App "Updates" als Vollbild-Fenster wie "Status" und "Magic Push" (2.201.0): gleiche Grösse (Desktop: Fenster 880 px, Handy: ganzer Bildschirm), Kopf mit
// Kreuz und Aktionsknopf an denselben Stellen, Schriftgrössen des Kopfes gleich.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
for (const mobile of [false, true]) {
  const tag = mobile ? "mobile" : "desktop";
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:8950/ha-sim.html?lang=de&theme=dark");
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
  const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
  const geo = (sel) => `const d = r.querySelector("${sel}"); const x = d.getBoundingClientRect(), c = d.querySelector(".dlg-head .dlg-close").getBoundingClientRect(), t = getComputedStyle(d.querySelector(".dlg-title h2")), a = d.querySelector(".dlg-avatar").getBoundingClientRect(); return JSON.stringify({ w: Math.round(x.width), h: Math.round(x.height), top: Math.round(x.top), cx: Math.round((c.left + c.width / 2 - x.left) * 10) / 10, cy: Math.round((c.top + c.height / 2 - x.top) * 10) / 10, cr: Math.round((x.right - c.right) * 10) / 10, fs: t.fontSize, aw: a.width, radius: getComputedStyle(d).borderRadius })`;
  await ev(`r.host._status.open()`);
  await p.waitForTimeout(700);
  const st = JSON.parse(await ev(geo("dialog.status-dlg")));
  await ev(`r.querySelector("dialog.status-dlg").close()`);
  await ev(`r.host._updApp.open()`);
  await p.waitForTimeout(700);
  const up = JSON.parse(await ev(geo("dialog.updapp-dlg")));
  check(`[${tag}] Updates wie Status: Grösse, Rundung, Kreuz-Abstand vom Rand, Titel- und Symbolgrösse`, st.w === up.w && st.h === up.h && st.radius === up.radius && Math.abs(st.cr - up.cr) < 0.6 && st.fs === up.fs && st.aw === up.aw && Math.abs(st.cy - up.cy) < 0.6, JSON.stringify({ st, up }));
  if (mobile) check(`[${tag}] Handy: ganze Fläche des Panels (Breite und Höhe), ohne Rundung`, up.w === 390 && up.h === (await ev("return innerHeight")) && up.radius === "0px", JSON.stringify(up));
  else check(`[${tag}] Desktop: Fenster 880 px breit`, up.w === 880, JSON.stringify(up));
  check(`[${tag}] Fuss mit "Schliessen" ganz unten im Fenster, Inhalt füllt die Fläche`, await ev(`const d = r.querySelector("dialog.updapp-dlg"); const x = d.getBoundingClientRect(), a = d.querySelector(".dlg-actions").getBoundingClientRect(), b = d.querySelector(".dlg-body").getBoundingClientRect(); return Math.abs(x.bottom - a.bottom) < 1 && Math.abs(a.top - b.bottom) < 1 && getComputedStyle(d).display === "flex"`));
  check(`[${tag}] keine Fehler`, errors.length === 0, errors.join("|"));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
