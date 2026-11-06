// Kachel "Lädt" im Geräte-Popup (2.202.0, docs/mockups/charging-tile-v1, A): breite Kachel über den Statistik-Kacheln mit Stand, Balken, Restzeit und Uhrzeit,
// Batterie-Kachel mit "lädt · noch …"; ohne Schätzung "Restzeit folgt"; ohne Ladevorgang keine Kachel. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { left: /^noch etwa 2[2-5] Min\.$/, wait: "Restzeit folgt, sobald sie sich schätzen lässt", batLeft: /^lädt · noch 2[2-5] Min\.$/, since: /^lädt seit 40 Min\.$/, rate: "+1,2 % / Min." },
  en: { left: /^about 2[2-5] min left$/, wait: "Time left follows as soon as it can be estimated", batLeft: /^charging · 2[2-5] min left$/, since: /^charging for 40 min$/, rate: "+1.2 % / min" },
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
    const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
    const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.innerText || "").replace(/\\s+/g," ").trim()`);
    const D = "dialog.device";

    await p.evaluate(() => { window.__charging = { e: { level: 64, from: 15, ago: 2400, eta_min: 24, rate: 1.2 } }; });
    await ev(`r.host._fetch(true)`);
    await ev(`r.host._openDevice("e")`);
    check(`[${tag}] Kachel "Lädt" über den Statistik-Kacheln`, await wait(`const t = r.querySelector("${D} .chg-tile"), g = r.querySelector("${D} .st-tiles"); return !!t && !!g && t.getBoundingClientRect().bottom <= g.getBoundingClientRect().top + 1`));
    check(`[${tag}] Stand 64 %, Restzeit "noch etwa 22 bis 25 Min." (Schätzung auf 5 Min. gerundet, dazu die Zeit seit dem Abruf)`, L.left.test(await text(`${D} .chg-tile .chg-e`)) && (await text(`${D} .chg-tile .chg-n`)).startsWith("64"), await text(`${D} .chg-tile .chg-head`));
    check(`[${tag}] Zeile: "lädt seit …", Tempo ${L.rate} und Uhrzeit "fertig gegen"`, (await text(`${D} .chg-tile .chg-meta`)).includes(L.rate) && /\d{1,2}[:.]\d{2}/.test(await text(`${D} .chg-tile .chg-meta`)), await text(`${D} .chg-tile .chg-meta`));
    check(`[${tag}] Balken mit Ziel in der Kachel, Batterie-Kachel ohne eigenen Balken`, await ev(`return !!r.querySelector("${D} .chg-tile .chg-bar i") && !r.querySelector('${D} .st-tile[data-kind="battery"]:not(.chg-tile) .chg-bar')`));
    check(`[${tag}] Batterie-Kachel: "lädt · noch …"`, L.batLeft.test(await text(`${D} .st-tile[data-kind="battery"]:not(.chg-tile) .st-sub`)), await text(`${D} .st-tile[data-kind="battery"]:not(.chg-tile) .st-sub`));
    await p.screenshot({ path: `${process.env.OUT || "output"}/chargetile-${tag.replace("/", "-")}.png` });

    // Ohne Schätzung
    await p.evaluate(() => { window.__charging = { e: { level: 64, from: 15, ago: 2400 } }; });
    await ev(`r.host._fetch(true)`);
    check(`[${tag}] ohne Schätzung: "${L.wait}", Batterie-Kachel "lädt seit …"`, await wait(`return r.querySelector("${D} .chg-tile .chg-e")?.innerText.trim() === ${JSON.stringify(L.wait)} && ${L.since}.test(r.querySelector('${D} .st-tile[data-kind="battery"]:not(.chg-tile) .st-sub').innerText.trim())`));
    // Kein Ladevorgang
    await p.evaluate(() => { window.__charging = {}; });
    await ev(`r.host._fetch(true)`);
    check(`[${tag}] kein Ladevorgang: keine Kachel "Lädt"`, await wait(`return !r.querySelector("${D} .chg-tile")`));
    check(`[${tag}] keine Fehler`, errors.length === 0, errors.join("|"));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
