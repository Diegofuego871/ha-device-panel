// Einheitliche Grafiken (2.0.2): Linien und Balken enden bei 80 % der Breite, der Wert steht am Endpunkt.
// Dazu: nicht gewählte Reiter sind umrahmt, Zeilen in Behältern werden beim Drücken nicht kleiner.
// Deutsch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
for (const mobile of [false, true]) {
  const tag = mobile ? "mobile" : "desktop";
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=de&theme=dark`);
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

  await tap(".gear-btn");
  await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
  await tap('[data-set="section"][data-id="monitor"]');
  await wait(`return !!r.querySelector(".lane .mtl")`);

  // Endpunkt je Grafik: x des Rings (Mitte) im Verhältnis zur Breite des Grafik-Behälters
  const GEO = `const out = []; for (const g of r.querySelectorAll(SEL)) { const gb = g.getBoundingClientRect(); const ptl = g.classList.contains("ptl");
    const ends = ptl ? [...g.querySelectorAll(".ptl-row:not(.mk-off) .ptl-track i")].map(i => i.getBoundingClientRect()) : [...g.querySelectorAll(".mtl-mk i")].map(i => i.getBoundingClientRect());
    const base = ptl ? g.querySelector(".ptl-track").getBoundingClientRect() : gb; const w = ptl ? base.width : gb.width;
    out.push(ends.map(e => Math.round(((e.left + e.width / 2 - base.left) / w) * 100)).join(",")); } return out;`;
  const geo = (sel) => ev(`const SEL = ${JSON.stringify(sel)};` + GEO);
  const lanes = await geo(".lane .mtl");
  // Das Ende ist der grösste Wert einer Grafik (Linie: letzte Marke, Balken: längster Balken); leere Grafiken zählen nicht
  const near80 = (list) => list.every((s) => s === "" || Math.abs(Math.max(...s.split(",").map(Number)) - 80) <= 3);
  check(`[${tag}] Übersicht: letzte Marke jeder Linie bei etwa 80 %`, near80(lanes), lanes.join(" | "));

  // Linie endet vor dem Rand: rechte Kante der Linie bei 80 % der Breite
  check(`[${tag}] Linie endet bei 80 % der Breite`, await ev(`const g = r.querySelector('.lane[data-lane="battery"] .mtl'); const bar = g.querySelector(".mtl-bar").getBoundingClientRect(); const gb = g.getBoundingClientRect(); return Math.abs((bar.right - gb.left) / gb.width * 100 - 80) < 1.5`));
  check(`[${tag}] Ausfall: Balken enden höchstens bei 80 %, Wert unter dem Ring`, await ev(`const g = r.querySelector('.lane[data-lane="outage"] .mtl'); const tr = g.querySelector(".ptl-track"); const tb = tr.getBoundingClientRect(); const ring = tr.querySelector("i").getBoundingClientRect(); const txt = tr.querySelector(".ptl-txt"); const x = txt.getBoundingClientRect(); return (ring.right - tb.left) / tb.width <= 0.81 && x.top >= ring.bottom - 1 && !!txt.querySelector("b")`));

  // Bearbeiten: Ausfall (zwei Balken mit Feldern), Batterie, Laden
  for (const [tab, sel] of [["outage", ".mon-body .ptl"], ["battery", ".mon-body .mtl"], ["charge", ".mon-body .mtl"]]) {
    await tap(`.mon-tab[data-key="${tab}"]`);
    await wait(`return !!r.querySelector(${JSON.stringify(sel + " input[data-opt]")})`);
    const g = await geo(sel);
    check(`[${tag}] ${tab}: Ende bei etwa 80 %`, near80(g), g.join(" | "));
    check(`[${tag}] ${tab}: Eingabefeld liegt in der Grafik, nicht über dem rechten Rand`, await ev(`const g = r.querySelector(${JSON.stringify(sel)}); const gb = g.getBoundingClientRect(); return [...g.querySelectorAll("input[data-opt]")].every(i => { const x = i.getBoundingClientRect(); return x.left >= gb.left - 4 && x.right <= gb.right + 4 })`));
  }

  // Reiter: nicht gewählte umrahmt, gewählter nicht
  check(`[${tag}] Reiter: nicht gewählte mit Rahmen, gewählter ohne`, await ev(`const off = r.querySelector(".mon-tab:not(.on)"); const on = r.querySelector(".mon-tab.on"); return getComputedStyle(off).boxShadow.includes("inset") && !getComputedStyle(on).boxShadow.includes("inset")`));
  check(`[${tag}] Reiter: Breite unverändert (Rahmen innen)`, await ev(`const off = r.querySelector(".mon-tab:not(.on)"); return getComputedStyle(off).borderTopWidth === "0px"`));

  // Reiter ohne Fläche dahinter (2.0.3), natürliche Breite links, auf dem Handy mindestens 44 px hoch
  check(`[${tag}] Reiter: keine Fläche hinter der Reihe`, await ev(`const bar = r.querySelector("dialog.settings .mon-tabs"); const c = getComputedStyle(bar); return (c.backgroundColor === "rgba(0, 0, 0, 0)" || c.backgroundColor === "transparent") && c.paddingTop === "0px"`));
  check(`[${tag}] Reiter: natürliche Breite, keiner füllt die Zeile (auch "Integrationen" nicht)`, await ev(`const bar = r.querySelector("dialog.settings .mon-tabs"); const bb = bar.getBoundingClientRect(); const tabs = [...bar.children]; return tabs.every(t => getComputedStyle(t).flexGrow === "0" && t.getBoundingClientRect().width < bb.width * 0.45) && getComputedStyle(bar).justifyContent !== "center"`));
  if (mobile) check(`[${tag}] Handy: Reiter mindestens 44 px hoch`, await ev(`return [...r.querySelectorAll("dialog.settings .mon-tab")].every(t => t.getBoundingClientRect().height >= 43.5)`));

  // Gerät: Reiter im Popup umrahmt
  await tap(".dlg-close");
  await ev(`r.querySelector("dialog.settings")?.close?.()`);
  await tap('.dev[data-open="c"], .mrow[data-open="c"]');
  await wait(`return !!r.querySelector("dialog.device .sub-tab")`);
  check(`[${tag}] Gerät: Reiter umrahmt`, await ev(`const t = [...r.querySelectorAll("dialog.device .sub-tab:not(.on)")]; return t.length > 0 && t.every(x => getComputedStyle(x).boxShadow.includes("inset"))`));

  check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
  await ctx.close();
}
await b.close();
process.exit(ok ? 0 : 1);
