// Fenster "Ladungen" (2.204.0): Kachel nur bei aufgezeichneten Ladungen, Fenster mit Kurve, Kacheln und Liste, Wahl einer Ladung, Watt nur mit Akku-Grösse,
// leerer Zustand ohne Ladungen nicht erreichbar (keine Kachel). Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { tile: "Ladungen", title: "Ladungen", avg: "Ø Leistung", peak: "Spitze", dur: "Dauer" },
  en: { tile: "Charges", title: "Charges", avg: "Avg. power", peak: "Peak", dur: "Duration" },
};
const now = Math.floor(Date.now() / 1000);
const mk = (daysAgo, from, to, minutes, wh) => {
  const start = now - daysAgo * 86400;
  const n = 8;
  const pts = Array.from({ length: n }, (_, i) => [Math.round((i * minutes * 60) / (n - 1)), Math.round(from + ((to - from) * i) / (n - 1))]);
  const watts = wh ? pts.map((p, i) => (i === 0 ? null : Math.round(((to - from) / (n - 1)) / 100 * wh * 3600 / ((minutes * 60) / (n - 1)) * 10) / 10)) : null;
  const avg = wh ? Math.round(((to - from) / 100 * wh * 3600 / (minutes * 60)) * 10) / 10 : null;
  return { start, end: start + minutes * 60, minutes, from, to, pts, watts, avg_w: avg, peak_w: wh ? Math.round(avg * 1.4 * 10) / 10 : null };
};
for (const lang of ["de", "en"]) {
  const L = T[lang];
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
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
    const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.innerText || "").replace(/\\s+/g," ").trim()`);
    const D = "dialog.device";
    const C = "dialog.charges-dlg";

    // Gerät kann geladen werden, aber noch keine Ladung: keine Kachel
    await p.evaluate(() => { window.__rechargeable = ["e"]; window.__charges = {}; });
    await ev(`r.host._fetch(true)`);
    await wait(`return r.host._devices.find((d) => d.id === "e")?.rechargeable === true`);
    await ev(`r.host._openDevice("e")`);
    await wait(`return r.querySelector('${D} .st-tiles')`);
    check(`[${tag}] ohne aufgezeichnete Ladung: keine Kachel "${L.tile}"`, !(await ev(`return [...r.querySelectorAll("${D} .st-tile .st-k")].some((x) => x.textContent === ${JSON.stringify(L.tile)})`)));
    await ev(`r.host._closeDevice?.()`);

    // Fünf Ladungen, mit Akku-Grösse
    await p.evaluate((list) => { window.__charges = { e: list }; window.__devSettings.chargeWh.e = 60; }, [mk(1, 19, 80, 62, 60), mk(3, 8, 100, 95, 60), mk(5, 30, 90, 70, 60), mk(8, 12, 55, 40, 60), mk(11, 40, 95, 66, 60)]);
    await ev(`r.host._fetch(true)`);
    await wait(`return r.host._devices.find((d) => d.id === "e")?.charges_count === 5`);
    await ev(`r.host._openDevice("e")`);
    await wait(`return r.querySelector('${D} .st-tiles')`);
    const tileSel = `${D} .st-tile[data-dlg="charges"]`;
    check(`[${tag}] Kachel "${L.tile}" mit Anzahl 5`, (await wait(`return !!r.querySelector('${tileSel}')`)) && /5/.test(await text(`${tileSel} .st-v`)) && (await text(`${tileSel} .st-k`)) === L.tile);
    await tap(tileSel);
    check(`[${tag}] Fenster öffnet: Titel "${L.title}", Kurve und fünf Zeilen`, (await wait(`return r.querySelector('${C}')?.open && r.querySelectorAll('${C} .cg-row').length === 5 && !!r.querySelector('${C} .cg-svg .cg-l')`)) && (await text(`${C} h2`)) === L.title);
    check(`[${tag}] vier Kacheln mit Leistung (Dauer, Stand, ${L.avg}, ${L.peak}), Watt-Kurve gestrichelt`, (await ev(`return r.querySelectorAll('${C} .cg-tile').length === 4 && !!r.querySelector('${C} .cg-wl')`)) && (await text(`${C} .cg-tiles`)).includes(L.avg));
    check(`[${tag}] neueste Ladung gewählt (19 → 80 %)`, (await text(`${C} .cg-row.on .cg-p`)).includes("19 → 80"));
    await tap(`${C} .cg-row:nth-child(2)`);
    check(`[${tag}] zweite Ladung gewählt, Tabelle zeigt 8 → 100 %`, (await wait(`return r.querySelector('${C} .cg-row.on')?.dataset.i === "1"`)) && (await text(`${C} .cg-tiles`)).includes("8") && (await text(`${C} .cg-tiles`)).includes("100"));
    const fits = await ev(`const d = r.querySelector('${C}'); const b = d.querySelector('.dlg-body'); return b.scrollWidth <= b.clientWidth + 1`);
    check(`[${tag}] kein seitliches Scrollen`, fits);
    await tap(`${C} .dlg-close`);
    check(`[${tag}] Schliessen`, await wait(`return !r.querySelector('${C}').open`));

    // Ohne Akku-Grösse: keine Watt
    await p.evaluate(() => { delete window.__devSettings.chargeWh.e; window.__charges.e = [{ start: Math.floor(Date.now() / 1000) - 86400, end: Math.floor(Date.now() / 1000) - 82000, minutes: 60, from: 20, to: 70, pts: [[0, 20], [1800, 45], [3600, 70]], watts: null, avg_w: null, peak_w: null }]; });
    await tap(tileSel);
    check(`[${tag}] ohne Akku-Grösse: zwei Kacheln, keine Watt-Kurve`, (await wait(`return r.querySelector('${C}')?.open && r.querySelectorAll('${C} .cg-row').length === 1`)) && (await ev(`return r.querySelectorAll('${C} .cg-tile').length === 2 && !r.querySelector('${C} .cg-wl')`)));
    await tap(`${C} .dlg-close`);
    await wait(`return !r.querySelector('${C}').open`);

    // Späte Antwort (2.204.1): Ladungen von "e" kommen erst, nachdem das Fenster für ein anderes Gerät offen ist; sie dürfen dort nicht erscheinen
    const other = await ev(`return r.host._devices.find((d) => d.id !== "e")?.id`);
    await ev(`const h = r.host._hass; const orig = h.callWS.bind(h); window.__cgGate = new Promise((res) => (window.__cgRelease = res));
      h.callWS = async (m) => { if (m.type === "device_panel/charges" && m.device_id === "e") await window.__cgGate; return orig(m); };
      r.host._charges.open("e"); r.host._charges.close(); r.host._charges.open(${JSON.stringify(other)});`);
    await wait(`return r.querySelector('${C} .dlg-note')`);
    await ev(`window.__cgRelease(); return new Promise((res) => setTimeout(res, 100));`);
    check(`[${tag}] späte Antwort eines anderen Geräts wird verworfen`, (await ev(`return r.querySelectorAll('${C} .cg-row').length === 0 && !!r.querySelector('${C} .dlg-note')`)) && (await ev(`return r.host._charges.deviceId`)) === other);
    check(`[${tag}] keine Fehler`, errors.length === 0, errors.join("|"));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
