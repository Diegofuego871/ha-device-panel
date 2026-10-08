// Grund der Warnung im Geräte-Popup (1.27.0, docs/mockups/warn-reason-v1, K2): Marken im Kopf
// (Instabil, Empfang schwach, Batterie niedrig), die zugehörigen Kacheln der Statistik gelb
// mit Punkt; ohne Warnung keine Marken. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = { de: { flaky: "Instabil · 5× in 24 Std.", weak: "Empfang schwach", bat: "Batterie niedrig · 9 %" }, en: { flaky: "Unstable · 5× in 24 h", weak: "Weak signal", bat: "Battery low · 9 %" } };
for (const lang of ["de", "en"]) for (const mobile of [false, true]) {
  const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
  const ctx = await b.newContext(mobile ? { viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
  const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
  const wait = (c) => f.waitForFunction(new Function(`const r=${R};` + c), null, { timeout: 5000 }).then(() => true, () => false);
  const open = async (id) => { await ev(`r.host._fetch = () => {}; r.querySelector('.dev[data-open="${id}"]').click()`); await wait(`return r.querySelector("dialog.device")?.open && r.querySelector(".dlg-sub")`); };
  const close = async () => { await ev(`r.querySelector("dialog.device").close()`); };
  const tags = () => ev(`return [...r.querySelectorAll("dialog.device .why")].map(x=>x.textContent.replace(/\\s+/g," ").trim())`);
  const warned = () => ev(`return [...r.querySelectorAll("dialog.device .st-tile.warned .st-k")].map(x=>x.textContent)`);
  await open("e");
  check(`[${tag}] Instabil: Marke im Kopf`, JSON.stringify(await tags()) === JSON.stringify([T[lang].flaky]), JSON.stringify(await tags()));
  check(`[${tag}] nur die Kachel Verfügbarkeit markiert`, (await warned()).length === 1);
  check(`[${tag}] Pille "Instabil" ersetzt`, !(await ev(`return !!r.querySelector("dialog.device .dlg-sub .pill.warn")`)));
  await p.screenshot({ path: `${outDir}/warnwhy-${tag.replace("/", "-")}.png` });
  await close();
  await ev(`const d=r.host._devices.find(x=>x.id==="e"); d.battery={level:9,low:true}; d.signal={kind:"lqi",value:30}; r.host._devForce=true;`);
  await open("e");
  const t = await tags();
  check(`[${tag}] drei Gründe`, t.length === 3 && t[1].startsWith(T[lang].weak) && t[2] === T[lang].bat, JSON.stringify(t));
  check(`[${tag}] drei Kacheln mit Punkt`, (await warned()).length === 3, JSON.stringify(await warned()));
  const dot = await ev(`const x=r.querySelector("dialog.device .st-tile.warned"); return getComputedStyle(x,"::after").content`);
  check(`[${tag}] gelber Punkt`, dot === '""', dot);
  await close();
  await open("g");
  check(`[${tag}] ohne Warnung keine Marken, keine Markierung`, (await tags()).length === 0 && (await warned()).length === 0);
  check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
