// Puls-Kachel (2.180.0): auf grossen Bildschirmen höchstens 720 px breit (der Platz rechts bleibt frei), damit der Messpunkt nicht über
// 1400 px rast; auf kleineren Bildschirmen und auf dem Handy unverändert. Deutsch und Englisch.
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
    const m = await f.evaluate(new Function(`const r=${R}; const hero = r.querySelector(".hero"); const pul = r.querySelector(".hero .kt.pul"); const hb = hero.getBoundingClientRect(); const pb = pul.getBoundingClientRect(); return { hero: Math.round(hb.width), pul: Math.round(pb.width), left: Math.round(pb.left - hb.left) }`));
    if (w >= 1600) check(`[${tag}] Puls-Kachel höchstens 720 px (Raster ${m.hero} px breit)`, m.pul <= 720 && m.pul >= 600 && m.hero > 1400, JSON.stringify(m));
    else if (!mobile) check(`[${tag}] bis 1100 px unverändert: Kachel füllt die Zeile`, m.pul >= m.hero - 4, JSON.stringify(m));
    else check(`[${tag}] Handy unverändert: Kachel füllt die Zeile`, m.pul >= m.hero - 4, JSON.stringify(m));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(";"));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
