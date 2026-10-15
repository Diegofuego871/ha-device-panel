// Suchfeld auf dem Desktop (2.36.0, Wunsch des Nutzers): ab 1101 px endet es genau mit der Kachel "Gerade ausgefallen" (zweite Kachel des
// Kopfs), damit das X zum Leeren nicht am äussersten Rand sitzt; die Schalter bleiben rechts. Fehlt der Platz (fünf Favoriten bei knapp
// 1101 px), gibt das Suchfeld nach und nichts läuft über. Bis 1100 px und am Handy ändert sich nichts (Suchfeld füllt den Rest).
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const FIVE = JSON.stringify({ device_panel_apps: { fav: ["routine", "magic", "log", "auto", "scene"], hidden: [], order: {}, layout: {}, custom: [], updated: 1 } });

async function open(width, { mobile = false, five = false, lang = "de" } = {}) {
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  if (five) await p.addInitScript((v) => { if (!sessionStorage.getItem("sim_user_data")) sessionStorage.setItem("sim_user_data", v); }, FIVE);
  await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=light`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
  const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
  await p.waitForTimeout(300);
  return { ctx, p, ev, errors };
}
const geo = (ev) => ev(`const q = (s) => r.querySelector(s)?.getBoundingClientRect(); const s = q(".toolbar .searchbox"), t = q(".hero > :nth-child(2)"), g = q(".toolbar .gear-btn"), tb = q(".toolbar"), v = q(".toolbar .view-btn"), x = q(".toolbar .search-clear"), h = q(".toolbar h1"), host = r.host.getBoundingClientRect(); return { sRight: s.right, sLeft: s.left, sWidth: s.width, tRight: t?.right, gRight: g.right, tbRight: tb.right, vLeft: v.left, hRight: h.right, hostRight: host.right, scroll: r.querySelector(".toolbar").scrollWidth > r.querySelector(".toolbar").clientWidth + 1 }`);

for (const lang of ["de", "en"]) {
  for (const width of [1101, 1280, 1400, 1920]) {
    const { ctx, ev, errors } = await open(width, { lang });
    const g = await geo(ev);
    check(`[${lang}/${width}] Suchfeld endet mit der Kachel "Gerade ausgefallen"`, Math.abs(g.sRight - g.tRight) <= 1, `Suchfeld ${g.sRight.toFixed(1)}, Kachel ${g.tRight.toFixed(1)}`);
    check(`[${lang}/${width}] Suchfeld liegt nach dem Titel, Schalter rechts am Rand`, g.sLeft > g.hRight && g.vLeft > g.sRight && Math.abs(g.gRight - (g.hostRight - 20)) <= 1, JSON.stringify(g));
    check(`[${lang}/${width}] Leiste läuft nicht über`, !g.scroll);
    check(`[${lang}/${width}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  // Fünf Favoriten bei knapp 1101 px: das Suchfeld gibt nach, nichts läuft über, der Zahnrad-Knopf bleibt am Rand
  for (const width of [1101, 1180, 1400]) {
    const { ctx, ev, errors } = await open(width, { five: true, lang });
    const g = await geo(ev);
    const pins = await ev(`return r.querySelectorAll(".toolbar .app-pin").length`);
    check(`[${lang}/${width}/5 Favoriten] fünf Knöpfe, Suchfeld nie breiter als die Kachel, Leiste läuft nicht über`, pins === 5 && g.sRight <= g.tRight + 1 && !g.scroll && g.vLeft >= g.sRight, `Knöpfe ${pins}, Suchfeld ${g.sRight.toFixed(1)}, Kachel ${g.tRight.toFixed(1)}`);
    check(`[${lang}/${width}/5 Favoriten] Zahnrad am rechten Rand, Suchfeld noch breit genug (> 200 px)`, Math.abs(g.gRight - (g.hostRight - 20)) <= 1 && g.sWidth > 200, `Zahnrad ${g.gRight.toFixed(1)}, Suchfeld ${g.sWidth.toFixed(1)}`);
    await ctx.close();
    void errors;
  }
  // Bis 1100 px und am Handy: das Suchfeld füllt wie bisher den Rest bis zu den Schaltern
  for (const [width, mobile] of [[1100, false], [900, false], [390, true]]) {
    const { ctx, ev, errors } = await open(width, { mobile, lang });
    const g = await geo(ev);
    const gapToBtn = mobile ? await ev(`const s = r.querySelector(".toolbar .searchbox").getBoundingClientRect(), n = r.querySelector(".toolbar .rtall-btn").getBoundingClientRect(); return n.left - s.right`) : g.vLeft - g.sRight;
    check(`[${lang}/${mobile ? "Handy" : width}] Suchfeld füllt den Rest bis zu den Schaltern (Abstand ≤ 20 px)`, gapToBtn >= 0 && gapToBtn <= 20 && g.sWidth > 150, `Abstand ${gapToBtn.toFixed(1)}, Breite ${g.sWidth.toFixed(1)}`);
    check(`[${lang}/${mobile ? "Handy" : width}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
