// Batterie-Prognose (1.5.0): Block im Verlauf-Fenster, gerechnet bis zur
// Warnschwelle des Geräts (ohne Warnung bis 0 %), unabhängig vom Zeitraum.
// Zustände ok, beschleunigt, zu kurz, flach, erreicht; Deutsch/Englisch,
// Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const D = 86400;
const TEXT = {
  de: { title: "Prognose", left: /^Reicht noch etwa .+/, target: /^bis 15 % \(Warnschwelle\), um den /, zero: /^bis leer \(0 %\), um den /, basis: /^Gerechnet seit dem Wechsel am .+ \(\d+ Tage\)$/, conf: /^Sicherheit: (hoch|mittel|gering)$/, note: "Näherung aus dem bisherigen Verlauf, ohne KI.", accel: /Verlauf wird steiler/, short: /Noch zu wenig Verlauf seit dem Wechsel \(3 von 7 Tagen\)/, flat: /sinkt kaum/, reached: "Die Warnschwelle von 15 % ist erreicht.", over5: "Reicht noch etwa mehr als 5 Jahre", months: "Reicht noch etwa 6 Monate" },
  en: { title: "Forecast", left: /^Lasts about .+ more$/, target: /^until 15 % \(warning threshold\), around /, zero: /^until empty \(0 %\), around /, basis: /^Based on the time since the change on .+ \(\d+ days\)$/, conf: /^Confidence: (high|medium|low)$/, note: "Estimate from the history so far, without AI.", accel: /getting steeper/, short: /Not enough history since the change yet \(3 of 7 days\)/, flat: /barely drops/, reached: "The warning threshold of 15 % has been reached.", over5: "Lasts about more than 5 years more", months: "Lasts about 6 months more" },
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
    const force = (fc) => p.evaluate((v) => { window.__batForecast = v; }, fc);
    const open = async () => {
      if (!(await ev(`return !!r.querySelector("dialog.device")?.open`))) await tap('.dev[data-open="e"]');
      await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('[data-kind="battery"]')`);
      await tap('dialog.device .st-tile[data-kind="battery"]');
      return wait(`return r.querySelector("dialog.stat-dlg")?.open && !!r.querySelector("dialog.stat-dlg .bh-svg")`);
    };
    const closeAll = async () => {
      await tap('dialog.stat-dlg [data-stat="close"]');
      await wait(`return !r.querySelector("dialog.stat-dlg")?.open`);
    };
    const now = Math.round(Date.now() / 1000);
    const base = { target: 15, target_is_zero: false, after_change: true, since: now - 74 * D, days_used: 74, current: 64, per_month: 15 };

    // Echte Simulator-Rechnung (Gerät e, Wechsel vor 74 Tagen, Schwelle 15 %)
    check(`[${tag}] Fenster öffnet`, await open());
    check(`[${tag}] Prognose-Block, Titel`, (await text("dialog.stat-dlg .bh-fc .bh-fc-h")) === T.title);
    check(`[${tag}] Hauptzeile`, T.left.test(await text("dialog.stat-dlg .bh-fc-main")), await text("dialog.stat-dlg .bh-fc-main"));
    check(`[${tag}] Ziel: Warnschwelle 15 %`, T.target.test(await text("dialog.stat-dlg .bh-fc-sub")), await text("dialog.stat-dlg .bh-fc-sub"));
    check(`[${tag}] Grundlage seit Wechsel`, T.basis.test(await text("dialog.stat-dlg .bh-fc-basis")), await text("dialog.stat-dlg .bh-fc-basis"));
    check(`[${tag}] Sicherheit`, T.conf.test(await text("dialog.stat-dlg .bh-fc-conf")), await text("dialog.stat-dlg .bh-fc-conf"));
    check(`[${tag}] Hinweis ohne KI`, (await text("dialog.stat-dlg .bh-fc-note")) === T.note);
    // Unabhängig vom Zeitraum: gleicher Text in allen Tabs
    const main30 = await text("dialog.stat-dlg .bh-fc-main");
    let same = true;
    for (const r of ["24h", "7d", "90d", "365d"]) {
      await tap(`dialog.stat-dlg [data-stat="range"][data-range="${r}"]`);
      await wait(`return r.querySelector('dialog.stat-dlg [data-range="${r}"]')?.classList.contains("on") && !!r.querySelector("dialog.stat-dlg .bh-svg")`);
      same &&= (await text("dialog.stat-dlg .bh-fc-main")) === main30;
    }
    check(`[${tag}] gleiche Prognose in allen Zeiträumen`, same);
    if (!mobile && lang === "de") await p.screenshot({ path: `${outDir}/forecast-ok-${tag.replace("/", "-")}.png` });
    await closeAll();

    // Warnung aus: bis leer
    await force({ ...base, target: 0, target_is_zero: true, status: "ok", days: 200, at: now + 200 * D, days_low: 160, days_high: 260, confidence: "high", r2: 0.97, accelerating: false });
    await open();
    check(`[${tag}] ohne Warnschwelle: bis leer`, T.zero.test(await text("dialog.stat-dlg .bh-fc-sub")), await text("dialog.stat-dlg .bh-fc-sub"));
    check(`[${tag}] Sicherheit hoch (Klasse)`, await ev(`return !!r.querySelector("dialog.stat-dlg .bh-fc-conf.high")`));
    await closeAll();

    // Monate
    await force({ ...base, status: "ok", days: 183, at: now + 183 * D, days_low: 150, days_high: null, confidence: "medium", r2: 0.7, accelerating: false });
    await open();
    check(`[${tag}] Monate`, (await text("dialog.stat-dlg .bh-fc-main")) === T.months, await text("dialog.stat-dlg .bh-fc-main"));
    check(`[${tag}] Spanne offen: nur Minimum`, /150|5 /.test(await text("dialog.stat-dlg .bh-fc-meta")) && !/ bis | to /.test((await text("dialog.stat-dlg .bh-fc-meta span")) || ""), await text("dialog.stat-dlg .bh-fc-meta"));
    await closeAll();

    // Über 5 Jahre
    await force({ ...base, status: "ok", days: 3000, at: now + 3000 * D, days_low: 2000, days_high: null, confidence: "low", r2: 0.3, accelerating: false });
    await open();
    check(`[${tag}] mehr als 5 Jahre`, (await text("dialog.stat-dlg .bh-fc-main")) === T.over5, await text("dialog.stat-dlg .bh-fc-main"));
    check(`[${tag}] Sicherheit gering (Klasse)`, await ev(`return !!r.querySelector("dialog.stat-dlg .bh-fc-conf.low")`));
    await closeAll();

    // Beschleunigt
    await force({ ...base, status: "ok", days: 90, at: now + 90 * D, days_low: 70, days_high: 120, confidence: "medium", r2: 0.8, accelerating: true });
    await open();
    check(`[${tag}] Warnhinweis steiler`, T.accel.test(await text("dialog.stat-dlg .bh-fc-warn")) && await ev(`return !!r.querySelector("dialog.stat-dlg .bh-fc.accel")`));
    if (!mobile && lang === "de") await p.screenshot({ path: `${outDir}/forecast-accel-${tag.replace("/", "-")}.png` });
    await closeAll();

    // Zu kurz, flach, erreicht
    await force({ ...base, status: "short", days_used: 3, min_days: 7 });
    await open();
    check(`[${tag}] zu wenig Verlauf`, T.short.test(await text("dialog.stat-dlg .bh-fc-sub")) && !(await text("dialog.stat-dlg .bh-fc-main")), await text("dialog.stat-dlg .bh-fc-sub"));
    await closeAll();
    await force({ ...base, status: "flat" });
    await open();
    check(`[${tag}] flach`, T.flat.test(await text("dialog.stat-dlg .bh-fc-sub")));
    await closeAll();
    await force({ ...base, status: "reached" });
    await open();
    check(`[${tag}] Schwelle erreicht`, (await text("dialog.stat-dlg .bh-fc-main")) === T.reached, await text("dialog.stat-dlg .bh-fc-main"));
    if (mobile && lang === "de") await p.screenshot({ path: `${outDir}/forecast-reached-${tag.replace("/", "-")}.png` });
    await closeAll();

    // Ohne Prognose (status none): kein Block
    await force({ ...base, status: "none" });
    await open();
    check(`[${tag}] status none: kein Block`, !(await ev(`return !!r.querySelector("dialog.stat-dlg .bh-fc")`)));
    await closeAll();

    // Kein Überlauf auf dem Handy
    if (mobile) {
      await force(null);
      await open();
      const over = await ev(`const d=r.querySelector("dialog.stat-dlg"); return d.scrollWidth > d.clientWidth + 1`);
      check(`[${tag}] kein horizontaler Überlauf`, !over);
      if (lang === "de") await p.screenshot({ path: `${outDir}/forecast-ok-${tag.replace("/", "-")}.png` });
    }
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "OK" : "FEHLER");
process.exit(ok ? 0 : 1);
