// Status › System, Wechsel des Zeitraums (2.208.0, docs/mockups/loader-v1, A): der Reiter springt sofort um, nur die gewählte Karte lädt (alte Kurve gedimmt,
// Ladeanzeige aus drei Punkten darüber), die Abfrage nennt nur diese Karte (kinds), die anderen Karten bleiben stehen, eine schon geholte Kurve steht beim
// Zurückwechseln sofort da (ohne neue Abfrage). Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
for (const lang of ["de", "en"]) for (const mobile of [false, true]) {
  const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
  const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
  const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
  const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
  const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
  const calls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/status_system"));
  const win = "dialog.status-dlg";
  const card = (id) => `${win} [data-st-metric-card="${id}"]`;

  await tap(".apps-btn");
  await wait(`return r.querySelector("dialog.apps-dlg")?.open && !!r.querySelector('dialog.apps-dlg [data-ap="open"][data-id="status"]')`);
  await p.waitForTimeout(600);
  await tap('dialog.apps-dlg [data-ap="open"][data-id="status"]');
  await wait(`return r.querySelector("${win}")?.open`);
  await tap(`${win} [data-st-tab="system"]`);
  await wait(`return r.querySelectorAll("${win} .st-sys-plot").length === 3`);
  const before = await ev(`return r.querySelector('${card("ram")}').innerHTML.length`);

  // 800 ms Verzögerung: Reiter sofort, Ladeanzeige und gedimmte Kurve während des Wartens
  await p.evaluate(() => { window.__systemDelay = 900; window.__wsCalls = []; });
  await tap(`${card("cpu")} [data-st-range="7d"]`);
  check(`[${tag}] Reiter "7 Tage" ist sofort gewählt (vor der Antwort)`, await ev(`return r.querySelector('${card("cpu")} [data-st-range="7d"]').classList.contains("on") && !r.querySelector('${card("cpu")} [data-st-range="24h"]').classList.contains("on")`));
  check(`[${tag}] Ladeanzeige (drei Punkte) auf der Karte, alte Kurve noch da`, await ev(`return r.querySelectorAll('${card("cpu")} .pl-ld s').length === 3 && !!r.querySelector('${card("cpu")} .pl-ldwrap .st-sys-plot')`));
  const posOf = () => ev(`return [...r.querySelectorAll('${card("cpu")} .pl-ld s')].map((d) => d.style.left + "," + d.style.top).join("|")`);
  const pos1 = await posOf();
  await p.waitForTimeout(250);
  const pos2 = await posOf();
  check(`[${tag}] die Kurve ist gedimmt (Deckkraft unter 0,5), die drei Punkte bewegen sich`, (await ev(`return Number(getComputedStyle(r.querySelector('${card("cpu")} .pl-ldwrap .st-sys-plot')).opacity) < 0.5`)) && pos1 !== "" && pos1 !== pos2, `${pos1} → ${pos2}`);
  check(`[${tag}] RAM und Festplatte bleiben stehen: keine Ladeanzeige, Karte unverändert`, await ev(`return !r.querySelector('${card("ram")} .pl-ld') && !r.querySelector('${card("disk")} .pl-ld') && r.querySelector('${card("ram")}').innerHTML.length === ${before}`));
  check(`[${tag}] Fuss nennt schon den neuen Zeitraum`, await ev(`return /7/.test(r.querySelector('${card("cpu")} .st-sys-foot span').textContent)`));
  // Antwort: Ladeanzeige weg, neue Kurve
  check(`[${tag}] nach der Antwort: Ladeanzeige weg, Kurve nicht mehr gedimmt`, await wait(`return !r.querySelector('${card("cpu")} .pl-ld') && !r.querySelector('${card("cpu")} .pl-ldwrap')`, 4000));
  const c1 = await calls();
  check(`[${tag}] eine Abfrage, nur für die Karte CPU (kinds), mit allen Zeiträumen`, c1.length === 1 && JSON.stringify(c1[0].kinds) === '["cpu"]' && c1[0].ranges.cpu === "7d", JSON.stringify(c1.map((c) => [c.kinds, c.ranges])));

  // Zurück auf 24 Std.: war schon geholt (beim Öffnen), steht sofort da, ohne neue Abfrage
  await p.evaluate(() => { window.__wsCalls = []; });
  await tap(`${card("cpu")} [data-st-range="24h"]`);
  check(`[${tag}] zurück auf "24 Std.": zwischengespeichert, sofort da, keine Ladeanzeige, keine neue Abfrage`, (await ev(`return r.querySelector('${card("cpu")} [data-st-range="24h"]').classList.contains("on") && !r.querySelector('${card("cpu")} .pl-ld')`)) && (await calls()).length === 0);

  // Zwei schnelle Wechsel: die überholte Antwort zeichnet nicht
  await p.evaluate(() => { window.__systemDelay = 700; window.__wsCalls = []; });
  await tap(`${card("ram")} [data-st-range="30d"]`);
  await tap(`${card("ram")} [data-st-range="90d"]`);
  check(`[${tag}] "3 Monate" gewählt, lädt`, await ev(`return r.querySelector('${card("ram")} [data-st-range="90d"]').classList.contains("on") && !!r.querySelector('${card("ram")} .pl-ld')`));
  check(`[${tag}] am Ende steht "3 Monate" (die überholte Antwort für 30 Tage ändert nichts)`, await wait(`return !r.querySelector('${card("ram")} .pl-ld') && r.querySelector('${card("ram")} .st-sys-foot').textContent.includes(${JSON.stringify(lang === "de" ? "vor 3 Monaten" : "3 months ago")})`, 4000));
  check(`[${tag}] keine Fehler`, errors.length === 0, errors.join("|"));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
