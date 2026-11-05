// Kopf der Unterseiten (Verfügbarkeit, Batterie, Empfang) wie der Kopf des Geräte-Popups (2.200.0): gleiches Symbol (Grösse, Rundung) und gleiche Schriftgrösse
// des Titels, am Desktop und am Handy.
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
  await ev(`r.host._openDevice("b")`);
  await p.waitForTimeout(700);
  const m = (sel) => `const a = r.querySelector("${sel} .dlg-avatar"), h = r.querySelector("${sel} .dlg-title h2"); const ra = a.getBoundingClientRect(); return JSON.stringify({ w: ra.width, h: ra.height, rad: getComputedStyle(a).borderRadius, fs: getComputedStyle(h).fontSize, fw: getComputedStyle(h).fontWeight })`;
  const dev = JSON.parse(await ev(m("dialog.device .dlg-head")));
  for (const [name, call] of [["Verfügbarkeit", `r.host._openStat("7d", "avail")`], ["Batterie", `r.host._openStat("30d", "battery")`], ["Empfang", `r.host._openStat("24h", "signal")`]]) {
    await ev(`r.querySelector("dialog.stat-dlg")?.open && r.querySelector("dialog.stat-dlg").close(); ${call}`);
    await p.waitForTimeout(600);
    const open = await ev(`return !!r.querySelector("dialog.stat-dlg")?.open`);
    if (!open) { check(`[${tag}] ${name}: Fenster offen`, false); continue; }
    const st = JSON.parse(await ev(m("dialog.stat-dlg .dlg-head")));
    check(`[${tag}] ${name}: Symbol und Titel wie im Kopf des Geräte-Popups`, st.w === dev.w && st.h === dev.h && st.rad === dev.rad && st.fs === dev.fs && st.fw === dev.fw, JSON.stringify({ dev, st }));
  }
  check(`[${tag}] keine Fehler`, errors.length === 0, errors.join("|"));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
