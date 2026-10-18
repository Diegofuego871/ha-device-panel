// Feste Höhe (1.41.0): Fenster mit Reitern oder wechselndem Inhalt bleiben gleich hoch, egal welcher Reiter gewählt ist
// (Geräte-Popup, Einstellungen, Statistik, Puls-Fenster); Knöpfe unten bleiben am unteren Rand. Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
for (const mobile of [false, true]) {
  const tag = mobile ? "mobile" : "desktop";
  const ctx = await b.newContext(mobile ? { viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:8950/ha-sim.html?lang=de&theme=dark");
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
  const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
  const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
  const tap = async (sel) => {
    for (let versuch = 1; ; versuch++) {
      const h = await handle(sel);
      if (!h) throw new Error("fehlt: " + sel);
      // Das Element kann zwischen Suchen und Tippen neu aufgebaut werden (Panel zeichnet neu): dann nochmals suchen
      try { await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); return; } catch (err) { if (versuch >= 4 || !/not attached|not stable/.test(String(err))) throw err; }
    }
  };
  const wait = (c, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + c), null, { timeout: ms }).then(() => true, () => false);
  const h = (dlg) => ev(`const d=r.querySelector("dialog.${dlg}"); const b=d.getBoundingClientRect(); const a=d.querySelector(".dlg-actions"); const ab=a?a.getBoundingClientRect():null; return [Math.round(b.height), Math.round(b.bottom - (ab?.bottom ?? b.bottom))]`);
  const same = (name, list) => check(`[${tag}] ${name}: gleiche Höhe auf allen Reitern`, list.every((x) => x[0] === list[0][0]) && list[0][0] > 400, JSON.stringify(list));

  // Geräte-Popup: Übersicht, Einstellungen, Entitäten
  await tap('.dev[data-open="b"]');
  await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device [data-tab="set"]')`);
  const dev = [];
  for (const tab of ["ov", "set", "ent"]) {
    await tap(`dialog.device [data-tab="${tab}"]`);
    await wait(`return r.querySelector('dialog.device [data-tab="${tab}"]').getAttribute("aria-selected") === "true"`);
    await p.waitForTimeout(150);
    dev.push(await h("device"));
  }
  same("Geräte-Popup", dev);
  check(`[${tag}] Geräte-Popup: Knöpfe am unteren Rand (Abstand ≤ 1 px)`, dev.every((x) => x[1] <= 1), JSON.stringify(dev));
  // Statistik-Fenster: 24 Std., 7 Tage, 30 Tage
  await tap('dialog.device [data-tab="ov"]');
  await tap('dialog.device [data-dlg="stat"][data-range="24h"]');
  await wait(`return r.querySelector("dialog.stat-dlg")?.open && !!r.querySelector("dialog.stat-dlg .avail-pct")`);
  const st = [];
  for (const range of ["24h", "7d", "30d"]) {
    await tap(`[data-stat="range"][data-range="${range}"]`);
    await wait(`return r.querySelector('[data-stat="range"].on')?.dataset.range === ${JSON.stringify(range)} && !!r.querySelector("dialog.stat-dlg .avail-pct")`);
    await p.waitForTimeout(200);
    st.push(await h("stat-dlg"));
  }
  same("Statistik-Fenster", st);
  await tap('dialog.stat-dlg [data-stat="close"]');
  await tap('dialog.device [data-dlg="close"]');
  await wait(`return !r.querySelector("dialog.device").open`);

  // Einstellungen: alle Reiter von "Überwachung und Meldungen"
  await tap(".gear-btn");
  await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
  const set = [await h("settings")];
  await tap('[data-set="section"][data-id="monitor"]');
  for (const key of ["overview", "outage", "battery", "new", "updates", "integ"]) {
    const sel = `.mon-tab[data-key="${key}"]`;
    if (!(await ev(`return !!r.querySelector(${JSON.stringify(sel)})`))) continue;
    await tap(sel);
    await p.waitForTimeout(200);
    set.push(await h("settings"));
  }
  same("Einstellungen", set);
  // Handy: Einstellungen als Vollbild (2.24.0), Desktop: Blatt mit Rand
  const box = await ev(`const q = r.querySelector("dialog.settings").getBoundingClientRect(); return [Math.round(q.width), Math.round(q.height), Math.round(q.left), Math.round(q.top), innerWidth, innerHeight]`);
  check(`[${tag}] Einstellungen: ${mobile ? "Vollbild" : "nicht Vollbild"}`, mobile ? box[0] === box[4] && box[1] === box[5] && box[2] === 0 && box[3] === 0 : box[0] < box[4] && box[1] < box[5], JSON.stringify(box));
  await ev(`const d=r.querySelector("dialog.settings"); if (d.open) d.close();`);

  // Puls-Fenster ohne und mit gewähltem Unterbruch
  await ev(`r.host._openPulse()`);
  await wait(`return r.querySelector("dialog.pulse-dlg")?.open`);
  const pu = [await h("pulse-dlg")];
  if (await ev(`return !!r.querySelector("dialog.pulse-dlg [data-pulse-at]")`)) {
    await ev(`r.querySelector("dialog.pulse-dlg [data-pulse-at]").dispatchEvent(new MouseEvent("click", { bubbles: true }))`);
    await p.waitForTimeout(200);
    pu.push(await h("pulse-dlg"));
  }
  same("Puls-Fenster", pu);
  check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
