// Kopf auf dem Desktop (2.181.4): Verfügbarkeit und "Gerade ausgefallen" gleich breit, der Ausfall-Puls so breit wie beide zusammen mit dem
// Abstand; das Raster ist höchstens 1396 px breit (der Platz rechts bleibt frei, seit 2.180.0), damit der Messpunkt nicht über 1400 px rast;
// bis 1100 px und am Handy unverändert. Deutsch und Englisch.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

for (const lang of ["de", "en"]) {
  for (const [name, w, h, mobile] of [["2000", 2000, 900, false], ["1600", 1600, 900, false], ["1100", 1100, 900, false], ["mobile", 390, 844, true]]) {
    const tag = `${lang}/${name}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: w, height: h } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const m = await f.evaluate(new Function(`const r=${R}; const q = (s) => Math.round(r.querySelector(s).getBoundingClientRect().width * 10) / 10; return { hero: q(".hero"), c1: q(".hero > :nth-child(1)"), c2: q(".hero > :nth-child(2)"), pul: q(".hero .kt.pul") };`));
    if (!mobile && w >= 1101) {
      check(`[${tag}] Verfügbarkeit und "Gerade ausgefallen" gleich breit (${m.c1} und ${m.c2} px)`, Math.abs(m.c1 - m.c2) <= 1, JSON.stringify(m));
      check(`[${tag}] Ausfall-Puls so breit wie beide Kacheln samt Abstand (${m.pul} px)`, Math.abs(m.pul - (m.c1 + m.c2 + 12)) <= 1.5, JSON.stringify(m));
      if (w >= 1600) check(`[${tag}] grosser Bildschirm: Raster höchstens ${1396} px, der Platz rechts bleibt frei`, m.hero <= 1397 && m.hero > 1300, JSON.stringify(m));
    } else check(`[${tag}] bis 1100 px und am Handy unverändert: Puls füllt die Zeile`, m.pul >= m.hero - 4, JSON.stringify(m));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(";"));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
