// Batterie-Verlauf (0.22.0, Variante A, docs/mockups/battery-history-v1):
// Kachel "Batterie" öffnet das Fenster, Zeiträume 24 Std. bis 3 Monate,
// Linie mit Fläche, Achse 0–100 %, Schwelle, Batteriewechsel mit Liste,
// Kennzahlen, Quelle (Langzeitstatistik oder Verlauf). Deutsch und
// Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: {
    title: "Batterie", ranges: ["24 Std.", "7 Tage", "30 Tage", "3 Monate", "6 Monate", "12 Monate"], hint: "Verlauf", since: "−36 % seit dem Wechsel am ", perDay: "etwa 0,5 % pro Tag",
    minmax: /^Tiefster \d+ % · höchster \d+ %/, thr: "Schwach ab 15 %", change: "Wechsel", changed: "Batterie gewechselt", statsDay: "Aus dem Recorder (Langzeitstatistik: Tagesmittel, auch über 10 Tage hinaus).", stats: "Aus dem Recorder (Langzeitstatistik",
    hist: "Aus dem Verlauf des Recorders.", histLong: "keine Langzeitstatistik", now: "jetzt",
  },
  en: {
    title: "Battery", ranges: ["24 h", "7 days", "30 days", "3 months", "6 months", "12 months"], hint: "History", since: "−36 % since the change on ", perDay: "about 0.5 % per day",
    minmax: /^Lowest \d+ % · highest \d+ %/, thr: "Low from 15 %", change: "Change", changed: "Battery changed", statsDay: "From the recorder (long-term statistics: daily means, also beyond 10 days).", stats: "From the recorder (long-term statistics",
    hist: "From the recorder history.", histLong: "keeps no long-term statistics", now: "now",
  },
};

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=${mobile ? "dark" : "light"}`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const calls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/battery_history").map(({ device_id, range }) => `${device_id}:${range}`));
    const range = async (r) => { await tap(`dialog.stat-dlg [data-stat="range"][data-range="${r}"]`); await wait(`return r.querySelector('dialog.stat-dlg [data-range="${r}"]')?.classList.contains("on") && !!r.querySelector("dialog.stat-dlg .bh-svg")`); };

    // Fensterkontakt Küche (64 %, vor 74 Tagen gewechselt)
    await tap('.dev[data-open="e"]');
    await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('[data-kind="battery"]')`);
    const tile = await ev(`const t=r.querySelector('dialog.device .st-tile[data-kind="battery"]'); return t ? [t.tagName, t.querySelector(".st-sub").textContent, !!t.querySelector(".chev")] : null`);
    check(`[${tag}] Kachel "Batterie" antippbar`, JSON.stringify(tile) === JSON.stringify(["BUTTON", T.hint, true]), JSON.stringify(tile));
    await tap('dialog.device .st-tile[data-kind="battery"]');
    check(`[${tag}] Fenster "Batterie", 30 Tage`, await wait(`return r.querySelector("dialog.stat-dlg")?.open && !!r.querySelector("dialog.stat-dlg .bh-svg")`) && (await text("dialog.stat-dlg h2")) === T.title && (await calls()).at(-1) === "e:30d");
    const ranges = await ev(`return [...r.querySelectorAll('dialog.stat-dlg [data-stat="range"]')].map(x=>x.textContent)`);
    check(`[${tag}] sechs Zeiträume`, JSON.stringify(ranges) === JSON.stringify(T.ranges), JSON.stringify(ranges));
    check(`[${tag}] 30 Tage: tiefster/höchster, Langzeitstatistik`, T.minmax.test(await text("dialog.stat-dlg .avail-facts")) && (await text("dialog.stat-dlg .bh-src")).startsWith(T.stats), `${await text("dialog.stat-dlg .avail-facts")} / ${await text("dialog.stat-dlg .bh-src")}`);
    check(`[${tag}] Stand und Achse 0–100 %`, (await text("dialog.stat-dlg .avail-pct")) === "64%" && (await ev(`return [...r.querySelectorAll("dialog.stat-dlg .bh-y")].map(x=>x.textContent).join("|")`)) === "100 %|50 %|0 %");
    check(`[${tag}] Schwelle`, (await text("dialog.stat-dlg .bh-thr-l")) === T.thr && await ev(`return !!r.querySelector("dialog.stat-dlg line.bh-thr")`));

    // 3 Monate: Wechsel
    await range("90d");
    const facts = await text("dialog.stat-dlg .avail-facts");
    check(`[${tag}] 3 Monate: seit dem Wechsel, pro Tag`, facts.startsWith(T.since) && facts.endsWith(T.perDay), facts);
    check(`[${tag}] Wechsel markiert und aufgeführt`, (await text("dialog.stat-dlg .bh-chg-l")) === T.change && (await text("dialog.stat-dlg .avail-list div span:first-child")) === T.changed && (await text("dialog.stat-dlg .avail-list .d")).endsWith("12 % → 100 %"), await text("dialog.stat-dlg .avail-list"));
    check(`[${tag}] Monate auf der Achse`, (await ev(`return r.querySelectorAll("dialog.stat-dlg .bh-ticks span:not(.now-label)").length`)) >= 2 && (await text("dialog.stat-dlg .bh-ticks .now-label")) === T.now);
    await p.screenshot({ path: `${outDir}/battery-90d-${tag.replace("/", "-")}.png` });

    // 6 und 12 Monate (seit 0.29.0, Wunsch des Nutzers): Tagesmittel, Monate kurz auf der Achse
    for (const key of ["180d", "365d"]) {
      await range(key);
      const src = await text("dialog.stat-dlg .bh-src");
      const months = await ev(`return [...r.querySelectorAll("dialog.stat-dlg .bh-ticks span:not(.now-label)")].filter(x=>getComputedStyle(x).display !== "none").map(x=>x.textContent)`);
      check(`[${tag}] ${key}: Tagesmittel aus der Statistik`, src === T.statsDay, src);
      check(`[${tag}] ${key}: Monate auf der Achse (${months.length})`, months.length >= (mobile && key === "365d" ? 2 : 4) && months.every((m) => m.length <= 5), months.join(","));
      // Fenster läuft nicht seitlich über, der gewählte Zeitraum liegt im sichtbaren Teil der Auswahl
      const fit = await ev(`const d=r.querySelector("dialog.stat-dlg"), s=d.querySelector(".stat-range"), o=d.querySelector(".stat-range button.on"); const sb=s.getBoundingClientRect(), ob=o.getBoundingClientRect(); return [d.scrollWidth <= d.clientWidth, d.scrollLeft === 0, ob.left >= sb.left - 1 && ob.right <= sb.right + 1]`);
      check(`[${tag}] ${key}: Fenster ohne seitliches Überlaufen, Auswahl sichtbar`, fit.every(Boolean), JSON.stringify(fit));
      check(`[${tag}] ${key}: Wechsel vor 74 Tagen aufgeführt`, (await text("dialog.stat-dlg .bh-chg-l")) === T.change);
      await p.screenshot({ path: `${outDir}/battery-${key}-${tag.replace("/", "-")}.png` });
    }
    // 24 Std.: Verlauf
    await range("24h");
    check(`[${tag}] 24 Std.: Verlauf des Recorders`, T.minmax.test(await text("dialog.stat-dlg .avail-facts")) && (await text("dialog.stat-dlg .bh-src")) === T.hist && !(await ev(`return !!r.querySelector("dialog.stat-dlg .bh-chg-l")`)));
    // Ohne Langzeitstatistik: Hinweis
    await p.evaluate(() => { window.__batSource = "history"; });
    await range("90d");
    check(`[${tag}] ohne Statistik: Hinweis`, (await text("dialog.stat-dlg .bh-src")).includes(T.histLong), await text("dialog.stat-dlg .bh-src"));
    await p.evaluate(() => { window.__batSource = null; });
    await p.screenshot({ path: `${outDir}/battery-24h-${tag.replace("/", "-")}.png` });

    // Schliessen: zurück zum Popup
    await tap('dialog.stat-dlg [data-stat="close"]');
    check(`[${tag}] X schliesst nur das Fenster`, await wait(`return !r.querySelector("dialog.stat-dlg").open && r.querySelector("dialog.device").open`));
    // Verfügbarkeit weiter wie bisher
    await tap('dialog.device [data-dlg="stat"][data-range="24h"][data-kind="avail"]');
    check(`[${tag}] Verfügbarkeit unverändert`, await wait(`return r.querySelector("dialog.stat-dlg")?.open && !!r.querySelector("dialog.stat-dlg .avail-bar")`) && (await ev(`return r.querySelectorAll('dialog.stat-dlg [data-stat="range"]').length`)) === 3);

    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
