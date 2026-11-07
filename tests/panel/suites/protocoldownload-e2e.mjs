// Protokoll, Download (2.205.0): ein Knopf im Fuss lädt alles Gespeicherte des Reiters als Textdatei, in Seiten zu 500, ohne Zeitraum, Chips und Suche;
// das Fenster selbst zeigt höchstens 500. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TITLE = { de: "Auswahl als Textdatei herunterladen", en: "Download the selection as a text file" };
const TOTAL = 1203;
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
  const wait = (c, ms = 8000) => f.waitForFunction(new Function(`const r=${R};` + c), null, { timeout: ms }).then(() => true, () => false);
  const D = "dialog.proto-dlg";

  // 1203 Einträge ohne Gerät, davon einer ein Fehler; Zeit über mehrere Jahre, damit auch ein Zeitraum sie nicht begrenzt
  await p.evaluate((n) => {
    const now = Date.now() / 1000;
    window.__log.entries = Array.from({ length: n }, (_, i) => ({ at: now - i * 86400 * 0.9, level: i === 5 ? "error" : "info", cat: "system", title: "", text: `Eintrag ${i}`, detail: "", device_id: null }));
  }, TOTAL);
  await ev(`r.host._downloadText = (text, name) => { window.__dl = { text, name }; }`);
  await tap(".apps-btn");
  await wait(`return r.querySelector("dialog.apps-dlg")?.open && !!r.querySelector('dialog.apps-dlg [data-ap="open"][data-id="log"]')`);
  await p.waitForTimeout(600);
  await tap('dialog.apps-dlg [data-ap="open"][data-id="log"]');
  await wait(`return r.querySelector("${D}")?.open`);
  await tap(`${D} [data-pr="kind"][data-v="system"]`);
  await wait(`return r.querySelector('${D} [data-pr="kind"].on')?.dataset.v === "system" && r.querySelectorAll("${D} .pr-list .lg-row").length > 0 && !r.querySelector("${D} [data-pr-foot] [data-pr='download']")?.disabled`);
  const btn = `${D} [data-pr="download"]`;
  check(`[${tag}] Knopf da, mit Beschriftung "${TITLE[lang]}"`, (await ev(`return r.querySelector(${JSON.stringify(btn)})?.getAttribute("aria-label")`)) === TITLE[lang]);
  check(`[${tag}] Download-Knopf steht ganz rechts (System, nach "Leeren")`, await ev(`return r.querySelector("${D} [data-pr-foot]").lastElementChild?.dataset.pr === "download"`));
  await tap(`${D} [data-pr="kind"][data-v="all"]`);
  await wait(`return r.querySelector('${D} [data-pr="kind"].on')?.dataset.v === "all" && !!r.querySelector("${D} [data-pr-foot] [data-pr='download']")`);
  check(`[${tag}] Download-Knopf steht ganz rechts (Alles)`, await ev(`return r.querySelector("${D} [data-pr-foot]").lastElementChild?.dataset.pr === "download"`));
  await tap(`${D} [data-pr="kind"][data-v="system"]`);
  await wait(`return r.querySelectorAll("${D} .pr-list .lg-row").length > 0`);
  check(`[${tag}] Fuss ohne seitliches Überlaufen`, await ev(`const f = r.querySelector("${D} [data-pr-foot]"); return f.scrollWidth <= f.clientWidth + 1`));

  const lines = () => f.evaluate(() => window.__dl?.text.split("\n").length);
  const pages = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/protocol_get"));
  const run = async () => { await f.evaluate(() => { window.__dl = null; }); await p.evaluate(() => { window.__wsCalls.length = 0; }); await wait(`return !r.querySelector(${JSON.stringify(btn)}).disabled`); await tap(btn); await wait(`return !!window.__dl`); };

  // Alle, ohne Filter: alles, drei Seiten
  await run();
  check(`[${tag}] Zeitraum "Alle", kein Filter: Datei mit allen ${TOTAL} Einträgen`, (await lines()) === TOTAL, String(await lines()));
  const calls = await pages();
  check(`[${tag}] drei Seiten (Versatz 0, 500, 1000) ohne Filter, Suche und Anfang`, calls.length === 3 && calls.map((c) => c.offset ?? 0).join() === "0,500,1000" && calls.every((c) => !c.filter && !c.q && c.since === undefined && c.limit === 500), JSON.stringify(calls.map((c) => [c.offset, c.limit, c.filter, c.since])));
  const dl = await f.evaluate(() => window.__dl);
  check(`[${tag}] Dateiname device-panel-system-JJJJ-MM-TT.txt`, /^device-panel-system-\d{4}-\d{2}-\d{2}\.txt$/.test(dl.name), dl.name);
  check(`[${tag}] Zeilen mit Stufe und Kategorie, neuester zuerst`, /\[INFO\] \[/.test(dl.text.split("\n")[0]) && dl.text.split("\n")[0].includes("Eintrag 0"), dl.text.split("\n")[0]);

  // Filter "Fehler": nur dieser eine Eintrag, mit Filter in der Abfrage
  await tap(`${D} [data-pr-filters] [data-v="error"]`);
  await wait(`return r.querySelectorAll("${D} .pr-list .lg-row").length === 1`);
  await run();
  const fc = await pages();
  check(`[${tag}] Filter "Fehler": Datei mit einer Zeile, Filter in der Abfrage`, (await lines()) === 1 && fc.length === 1 && fc[0].filter === "error", `${await lines()} / ${JSON.stringify(fc.map((c) => c.filter))}`);
  await tap(`${D} [data-pr-filters] [data-v="all"]`);
  await wait(`return r.querySelectorAll("${D} .pr-list .lg-row").length > 1`);

  // Zeitraum 7 Tage: nur die jüngeren Einträge (alle 0,9 Tage einer), Anfang in der Abfrage
  await tap(`${D} [data-pr-ranges] [data-v="7d"]`);
  await wait(`return r.querySelector('${D} [data-pr-ranges] .sub-tab.on')?.dataset.v === "7d"`);
  await run();
  const rc = await pages();
  const n7 = await lines();
  check(`[${tag}] Zeitraum 7 T.: nur wenige Einträge (nicht alle ${TOTAL}), Anfang in der Abfrage`, n7 > 3 && n7 < 20 && rc.length === 1 && typeof rc[0].since === "number", `${n7} / ${JSON.stringify(rc.map((c) => c.since))}`);

  // Suche
  await tap(`${D} [data-pr-ranges] [data-v="all"]`);
  const input = await handle(`${D} input[data-pr-search]`);
  await input.fill("Eintrag 77");
  await wait(`return r.querySelectorAll("${D} .pr-list .lg-row").length > 0 && r.querySelectorAll("${D} .pr-list .lg-row").length < 30`);
  await run();
  const n77 = await lines();
  check(`[${tag}] Suche "Eintrag 77": nur passende Zeilen, Suche in der Abfrage`, n77 > 0 && n77 < 30 && (await pages()).every((c) => c.q === "Eintrag 77"), String(n77));
  check(`[${tag}] Knopf danach wieder bedienbar, keine Fehler`, (await ev(`return !r.querySelector(${JSON.stringify(btn)}).disabled`)) && errors.length === 0, errors.join("|"));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
