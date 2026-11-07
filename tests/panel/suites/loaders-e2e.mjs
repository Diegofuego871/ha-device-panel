// Ladeanzeige für alle Grafiken (2.209.0, Regel: der Reiter wechselt sofort, danach lädt es; alte Grafik gedimmt, drei Punkte in der Farbe der Grafik darüber):
// Statistik-Fenster (Verfügbarkeit und Batterie), Protokoll und Fenster "Ladungen". Dazu: Punkte bewegen sich schnell, Zwischenspeicher beim Zurückwechseln.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const now = Math.floor(Date.now() / 1000);
const CH = { start: now - 86400, end: now - 82000, minutes: 60, from: 20, to: 70, pts: [[0, 20], [1800, 45], [3600, 70]], watts: null, avg_w: null, peak_w: null };
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
  const calls = (type) => p.evaluate((t) => window.__wsCalls.filter((m) => m.type === t), type);
  const dotColor = (sel) => ev(`const d = r.querySelector(${JSON.stringify(sel + " .pl-ld s")}); return d ? getComputedStyle(d).backgroundColor : null`);
  const tokenColor = (v) => ev(`const e = document.createElement("i"); e.style.color = ${JSON.stringify(v)}; r.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c`);
  const moves = async (sel) => { const pos = () => ev(`return [...r.querySelectorAll(${JSON.stringify(sel + " .pl-ld s")})].map((d) => d.style.left + "," + d.style.top).join("|")`); let a = await pos(); for (let i = 0; i < 20 && a === ""; i++) { await p.waitForTimeout(50); a = await pos(); } for (let i = 0; i < 12; i++) { await p.waitForTimeout(100); if ((await pos()) !== a) return true; } return false; };

  // --- Statistik-Fenster: Verfügbarkeit (Farbe der Grafik: grün) ---
  await ev(`r.host._openDevice("e")`);
  await wait(`return r.querySelector("dialog.device")?.open`);
  await ev(`r.host._openStat("24h", "avail")`);
  const S = "dialog.stat-dlg";
  await wait(`return r.querySelector("${S}")?.open && !r.querySelector("${S} .pl-ld")`);
  await p.evaluate(() => { window.__wsDelay = { "device_panel/availability": 2000, "device_panel/battery_history": 2000 }; window.__wsCalls = []; });
  await tap(`${S} [data-stat="range"][data-range="7d"]`);
  check(`[${tag}] Statistik: Reiter "7 Tage" sofort gewählt`, await ev(`return r.querySelector('${S} [data-stat="range"][data-range="7d"]').classList.contains("on")`));
  check(`[${tag}] Statistik: Ladeanzeige da, alte Grafik gedimmt darunter`, (await ev(`return r.querySelectorAll("${S} .pl-ld s").length === 3`)) && (await ev(`const w = r.querySelector("${S} .pl-ldwrap"); return !!w && !w.classList.contains("empty") && Number(getComputedStyle(w.firstElementChild).opacity) < 0.5`)));
  check(`[${tag}] Statistik Verfügbarkeit: Punkte in der Farbe der Grafik (grün), nicht in der Akzentfarbe`, (await dotColor(S)) === (await tokenColor("var(--dp-success)")), `${await dotColor(S)} / ${await tokenColor("var(--dp-success)")}`);
  check(`[${tag}] Statistik: die Punkte bewegen sich`, await moves(S));
  check(`[${tag}] Statistik: nach der Antwort Ladeanzeige weg`, await wait(`return !r.querySelector("${S} .pl-ld")`, 6000));
  // Zurück auf 24 Std.: war geholt, sofort, ohne neue Abfrage
  await p.evaluate(() => { window.__wsCalls = []; });
  await tap(`${S} [data-stat="range"][data-range="24h"]`);
  check(`[${tag}] Statistik: zurück auf "24 Std." sofort aus dem Zwischenspeicher, keine neue Abfrage`, (await ev(`return !r.querySelector("${S} .pl-ld")`)) && (await calls("device_panel/availability")).length === 0);
  await ev(`r.host._closeStat()`);
  await ev(`r.host._closeDevice?.()`);

  // --- Statistik-Fenster: Batterie (Farbe der Linie) ---
  await ev(`const d = r.host._devices.find((x) => x.battery && x.id !== "e"); r.host._openDevice(d.id)`);
  await wait(`return r.querySelector("dialog.device")?.open`);
  await ev(`r.host._openStat("24h", "battery")`);
  await wait(`return r.querySelector("${S}")?.open && !r.querySelector("${S} .pl-ld") && !!r.querySelector("${S} .bh-line")`);
  const lineColor = await ev(`return getComputedStyle(r.querySelector("${S} .bh-line")).stroke`);
  await tap(`${S} [data-stat="range"][data-range="30d"]`);
  check(`[${tag}] Batterie: Ladeanzeige in der Farbe der Linie der Grafik`, (await wait(`return !!r.querySelector("${S} .pl-ld")`)) && (await dotColor(S)) === lineColor, `${await dotColor(S)} / ${lineColor}`);
  await wait(`return !r.querySelector("${S} .pl-ld")`, 6000);
  await ev(`r.host._closeStat()`);
  await ev(`r.host._closeDevice?.()`);

  // --- Protokoll ---
  await p.evaluate(() => { window.__wsDelay = { "device_panel/protocol_get": 2000 }; window.__wsCalls = []; });
  await tap(".apps-btn");
  await wait(`return r.querySelector("dialog.apps-dlg")?.open && !!r.querySelector('dialog.apps-dlg [data-ap="open"][data-id="log"]')`);
  await p.waitForTimeout(600);
  await tap('dialog.apps-dlg [data-ap="open"][data-id="log"]');
  const D = "dialog.proto-dlg";
  check(`[${tag}] Protokoll: beim ersten Laden Ladeanzeige statt Text`, await wait(`return !!r.querySelector("${D} [data-pr-body] .pl-ld")`, 3000));
  await wait(`return !r.querySelector("${D} [data-pr-body] .pl-ld") && r.querySelectorAll("${D} .lg-row").length > 0`, 6000);
  await tap(`${D} [data-pr-ranges] [data-v="7d"]`);
  check(`[${tag}] Protokoll: Zeitraum "7 T." sofort gewählt, Liste gedimmt mit Ladeanzeige`, (await ev(`return r.querySelector('${D} [data-pr-ranges] [data-v="7d"]').classList.contains("on")`)) && (await ev(`const w = r.querySelector("${D} [data-pr-body] .pl-ldwrap"); return !!w && !!w.querySelector(".pl-ld") && !w.classList.contains("empty")`)));
  check(`[${tag}] Protokoll: Punkte bewegen sich`, await moves(`${D} [data-pr-body]`));
  check(`[${tag}] Protokoll: nach der Antwort Ladeanzeige weg`, await wait(`return !r.querySelector("${D} [data-pr-body] .pl-ld")`, 6000));
  await tap(`${D} [data-pr="close"]`);
  await wait(`return !r.querySelector("${D}").open`);

  // --- Fenster "Ladungen" ---
  await p.evaluate((c) => { window.__rechargeable = ["e"]; window.__charges = { e: [c] }; window.__wsDelay = { "device_panel/charges": 2000 }; }, CH);
  await ev(`r.host._fetch(true)`);
  await wait(`return r.host._devices.find((d) => d.id === "e")?.charges_count === 1`);
  await ev(`r.host._openDevice("e")`);
  await wait(`return r.querySelector('dialog.device .st-tile[data-dlg="charges"]')`);
  await tap('dialog.device .st-tile[data-dlg="charges"]');
  const C = "dialog.charges-dlg";
  check(`[${tag}] Ladungen: Ladeanzeige in grün (Farbe der Kurve) während des Ladens`, (await wait(`return !!r.querySelector("${C} .pl-ld")`, 3000)) && (await dotColor(C)) === (await tokenColor("var(--dp-success)")));
  check(`[${tag}] Ladungen: danach Kurve, keine Ladeanzeige`, await wait(`return !r.querySelector("${C} .pl-ld") && !!r.querySelector("${C} .cg-svg")`, 6000));
  check(`[${tag}] keine Fehler`, errors.length === 0, errors.join("|"));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
