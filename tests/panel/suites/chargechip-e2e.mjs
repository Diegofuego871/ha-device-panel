// Ladende Geräte (1.35.0, docs/mockups/charging-state-v1, B und C): Filter-Chip "Lädt" (nur wenn eines lädt),
// grüne Pille in der Liste, bei gewähltem Chip nach Stand sortiert mit Stand, Start und Dauer; Kachel im Popup.
// Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { chip: "Lädt", pill: "lädt", info1: "81 % · von 38 % · seit 1 Std. 20 Min.", tile: "lädt seit 1 Std. 20 Min." },
  en: { chip: "Charging", pill: "charging", info1: "81 % · from 38 % · for 1 h 20 min", tile: "charging for 1 h 20 min" },
};
for (const lang of ["de", "en"]) for (const mobile of [false, true]) {
  const T_ = T[lang];
  const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
  const ctx = await b.newContext(mobile ? { viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
  const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
  const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
  const tap = async (sel) => {
    for (let versuch = 1; ; versuch++) {
      const h = await handle(sel);
      if (!h) throw new Error("fehlt: " + sel);
      try { await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); return; } catch (err) { if (versuch >= 3 || !/not attached|not stable/.test(String(err))) throw err; }
    }
  };
  const wait = (c) => f.waitForFunction(new Function(`const r=${R};` + c), null, { timeout: 5000 }).then(() => true, () => false);
  const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.innerText || "").replace(/\\s+/g," ").trim()`);

  check(`[${tag}] ohne ladende Geräte kein Chip und keine Pille`, await ev(`return !r.querySelector('.chip[data-hint="charging"]') && !r.querySelector(".pill.chg")`));
  // Backend meldet drei ladende Geräte: Türschloss (81 %), Heizkörper (67 %), Fensterkontakt (64 %)
  await p.evaluate(() => { window.__charging = { i: { level: 81, from: 38, ago: 4800 }, j: { level: 67, from: 22, ago: 7500 }, e: { level: 64, from: 15, ago: 2400 } }; });
  await ev(`r.host._fetch(true)`);
  check(`[${tag}] Chip "${T_.chip} 3" erscheint nach "Batterie"`, await wait(`const c=[...r.querySelectorAll(".chips .chip")]; const ch=r.querySelector('.chip[data-hint="charging"]'); return !!ch && ch.textContent.replace(/\\s+/g," ").trim() === ${JSON.stringify(T_.chip + " 3")} && c.indexOf(ch) === c.indexOf(r.querySelector('.chip[data-hint="batteries"]')) + 1`));
  check(`[${tag}] grüne Pille "${T_.pill}" bei genau drei Geräten`, await wait(`return [...r.querySelectorAll('.dev')].filter(d=>d.querySelector(".pill.chg")).map(d=>d.dataset.open).sort().join() === "e,i,j"`) && (await text('.dev[data-open="i"] .pill.chg')) === T_.pill, await ev(`return [...r.querySelectorAll('.pill.chg')].length`));
  check(`[${tag}] Pille mit Tipp "${T_.tile}"`, (await ev(`return r.querySelector('.dev[data-open="i"] .pill.chg').title`)) === T_.tile);
  await p.screenshot({ path: `${outDir}/chargechip-list-${tag.replace("/", "-")}.png` });

  // Chip wählen
  await tap('.chip[data-hint="charging"]');
  await wait(`return r.querySelector('.chip[data-hint="charging"]').classList.contains("on")`);
  check(`[${tag}] Chip gewählt: nur die drei Geräte, nach Stand (81, 67, 64)`, await wait(`return [...r.querySelectorAll(".dev")].map(d=>d.dataset.open).join() === "i,j,e"`), await ev(`return [...r.querySelectorAll(".dev")].map(d=>d.dataset.open).join()`));
  check(`[${tag}] Stand, Start und Dauer: "${T_.info1}"`, (await text('.dev[data-open="i"] .chg-sub')) === T_.info1, await text('.dev[data-open="i"] .chg-sub'));
  check(`[${tag}] Füllstandsbalken 81 %`, (await ev(`return r.querySelector('.dev[data-open="i"] .chg-bar i').style.width`)) === "81%");
  if (mobile) check(`[${tag}] Handy: Zeile mit grünem Streifen`, await ev(`return r.querySelector('.mrow.dev[data-open="i"]').classList.contains("chg")`));
  await p.screenshot({ path: `${outDir}/chargechip-chip-${tag.replace("/", "-")}.png` });
  // Chip wieder ab
  await tap('.chip[data-hint="charging"]');
  check(`[${tag}] Chip ab: wieder alle Geräte`, await wait(`return !r.querySelector('.chip[data-hint="charging"]').classList.contains("on") && r.querySelectorAll(".dev").length > 3`));
  // Popup: Kachel Batterie
  await tap('.dev[data-open="i"]');
  await wait(`return r.querySelector("dialog.device")?.open`);
  check(`[${tag}] Popup: Kachel Batterie "${T_.tile}"`, await wait(`return [...r.querySelectorAll("dialog.device .st-tile")].some(t=>t.innerText.replace(/\\s+/g," ").includes(${JSON.stringify(T_.tile)}))`));
  await ctx.close();
  check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
