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
  // Seit 2.96.0 steht die Übersichtskarte jedes Reiters im Reiter selbst (Ausfall, Batterie, Laden, Neu, Updates)
  const lanes = [];
  for (const tab of ["outage", "battery", "charge", "new", "updates"]) {
    await tap(`.mon-tab[data-key="${tab}"]`);
    await wait(`return !!r.querySelector('.lane[data-lane="${tab}"] .mtl')`);
    lanes.push(...(await geo(".lane .mtl")));
  }
  // Das Ende ist der grösste Wert einer Grafik (Linie: letzte Marke, Balken: längster Balken); leere Grafiken zählen nicht
  const near80 = (list) => list.every((s) => s === "" || Math.abs(Math.max(...s.split(",").map(Number)) - 80) <= 3);
  check(`[${tag}] Karten: letzte Marke jeder Linie bei etwa 80 %`, near80(lanes), lanes.join(" | "));

  // Linie endet vor dem Rand: rechte Kante der Linie bei 80 % der Breite
  await tap('.mon-tab[data-key="battery"]');
  await wait(`return !!r.querySelector('.lane[data-lane="battery"] .mtl-mk.mk-off i')`);
  check(`[${tag}] Linie endet bei 80 % der Breite`, await ev(`const g = r.querySelector('.lane[data-lane="battery"] .mtl'); const bar = g.querySelector(".mtl-bar").getBoundingClientRect(); const gb = g.getBoundingClientRect(); return Math.abs((bar.right - gb.left) / gb.width * 100 - 80) < 1.5`));
  // Meldung aus (2.0.8): grauer Ring mit Schrägstrich, auch bei den Balken am Ende der gestrichelten Linie
  check(`[${tag}] Meldung aus: Linie mit Ring und Schrägstrich (durchgezogener Rand), kein gestrichelter Ring`, await ev(`const i = r.querySelector('.lane[data-lane="battery"] .mtl-mk.mk-off i'); const c = getComputedStyle(i); const sl = getComputedStyle(i, "::before"); return !!i && c.borderStyle === "solid" && sl.content !== "none" && sl.transform !== "none"`));
  await tap('.mon-tab[data-key="outage"]');
  await wait(`return !!r.querySelector('.lane[data-lane="outage"] .ptl-track')`);
  check(`[${tag}] Ausfall: Balken enden höchstens bei 80 %, Wert unter dem Ring`, await ev(`const g = r.querySelector('.lane[data-lane="outage"] .mtl'); const tr = g.querySelector(".ptl-track"); const tb = tr.getBoundingClientRect(); const ring = tr.querySelector("i").getBoundingClientRect(); const txt = tr.querySelector(".ptl-txt"); const x = txt.getBoundingClientRect(); return (ring.right - tb.left) / tb.width <= 0.81 && x.top >= ring.bottom - 1 && !!txt.querySelector("b")`));

  // Bearbeiten: Ausfall (zwei Balken mit Feldern), Batterie, Laden
  for (const [tab, sel] of [["outage", ".mon-body .ptl"], ["battery", ".mon-body .mtl"], ["charge", ".mon-body .mtl"]]) {
    await tap(`.mon-tab[data-key="${tab}"]`);
    await wait(`return !!r.querySelector(${JSON.stringify(sel + " input[data-opt]")})`);
    const g = await geo(sel);
    check(`[${tag}] ${tab}: Ende bei etwa 80 %`, near80(g), g.join(" | "));
    check(`[${tag}] ${tab}: Eingabefeld liegt in der Grafik, nicht über dem rechten Rand`, await ev(`const g = r.querySelector(${JSON.stringify(sel)}); const gb = g.getBoundingClientRect(); return [...g.querySelectorAll("input[data-opt]")].every(i => { const x = i.getBoundingClientRect(); return x.left >= gb.left - 4 && x.right <= gb.right + 4 })`));
  }

  // Reiter als Segmentschalter (2.0.5): Fläche hinter der Reihe, gleich breite Felder, Kapsel hinter dem gewählten Reiter
  const bar = "dialog.settings .mon-tabs";
  check(`[${tag}] Reiter: Fläche hinter der Reihe, abgerundet`, await ev(`const c = getComputedStyle(r.querySelector(${JSON.stringify(bar)})); return c.backgroundColor !== "rgba(0, 0, 0, 0)" && parseInt(c.borderRadius) >= 12 && c.display === "grid"`));
  check(`[${tag}] Reiter: nicht gewählte ohne Rahmen, gewählter in Akzentfarbe`, await ev(`const off = r.querySelector(${JSON.stringify(bar + " .mon-tab:not(.on)")}); const on = r.querySelector(${JSON.stringify(bar + " .mon-tab.on")}); return getComputedStyle(off).boxShadow === "none" && getComputedStyle(on).color !== getComputedStyle(off).color`));
  await p.waitForTimeout(700); // die Kapsel gleitet noch vom letzten Wechsel
  check(`[${tag}] Reiter: Kapsel genau hinter dem gewählten Reiter`, await ev(`const b = r.querySelector(${JSON.stringify(bar)}); const pills = b.querySelectorAll(":scope > .seg-pill"); const p = pills[0].getBoundingClientRect(); const o = b.querySelector(".mon-tab.on").getBoundingClientRect(); return pills.length === 1 && Math.abs(p.left - o.left) < 1.5 && Math.abs(p.top - o.top) < 1.5 && Math.abs(p.width - o.width) < 1.5 && Math.abs(p.height - o.height) < 1.5`));
  check(`[${tag}] Reiter: alle gleich breit, auch "Integrationen" (der letzte links, nicht gezogen)`, await ev(`const tabs = [...r.querySelectorAll(${JSON.stringify(bar + " .mon-tab")})]; const w = tabs.map(t => Math.round(t.getBoundingClientRect().width)); const bb = r.querySelector(${JSON.stringify(bar)}).getBoundingClientRect(); return Math.max(...w) - Math.min(...w) <= 1 && Math.max(...w) < bb.width * 0.4`));
  if (mobile) {
    check(`[${tag}] Handy: Reiter mindestens 44 px hoch, 8 Reiter in zwei Zeilen (4 + 4)`, await ev(`const tabs = [...r.querySelectorAll(${JSON.stringify(bar + " .mon-tab")})]; const tops = new Set(tabs.map(t => Math.round(t.getBoundingClientRect().top))); const firstRow = tabs.filter(t => Math.round(t.getBoundingClientRect().top) === [...tops][0]).length; return tabs.every(t => t.getBoundingClientRect().height >= 43.5) && tops.size === 2 && firstRow === 4 && tabs.length === 8`));
    check(`[${tag}] Handy: kein Text abgeschnitten`, await ev(`return [...r.querySelectorAll(${JSON.stringify(bar + " .mon-tab")})].every(t => t.scrollWidth <= t.clientWidth)`));
  } else {
    check(`[${tag}] Desktop: acht Reiter in zwei Zeilen (4 + 4, sonst wird "Integrationen" abgeschnitten)`, await ev(`const tabs = [...r.querySelectorAll(${JSON.stringify(bar + " .mon-tab")})]; return new Set(tabs.map(t => Math.round(t.getBoundingClientRect().top))).size === 2 && tabs.length === 8 && tabs.every(t => t.scrollWidth <= t.clientWidth)`));
  }
  // Wechsel: die Kapsel gleitet (unterwegs zwischen alter und neuer Lage), landet am neuen Reiter
  const pillPos = () => ev(`const b = r.querySelector(${JSON.stringify(bar)}); const p = b.querySelector(":scope > .seg-pill").getBoundingClientRect(); return [p.left, p.top]`);
  await tap(`.mon-tab[data-key="battery"]`);
  await wait(`return r.querySelector('.mon-tab[data-key="battery"]').classList.contains("on")`);
  await p.waitForTimeout(700);
  const g0 = await pillPos();
  // Lage der Kapsel in jedem Bild (requestAnimationFrame) während 700 ms nach dem Wechsel
  const seen = await ev(`return new Promise((res) => { const b = r.querySelector(${JSON.stringify(bar)}); const out = []; const t0 = performance.now(); r.querySelector('.mon-tab[data-key="charge"]').click(); const tick = () => { const q = b.querySelector(":scope > .seg-pill")?.getBoundingClientRect(); if (q) out.push([q.left, q.top]); if (performance.now() - t0 < 700) requestAnimationFrame(tick); else res(out); }; tick(); })`);
  const target = await ev(`const o = r.querySelector('.mon-tab[data-key="charge"]').getBoundingClientRect(); return [o.left, o.top]`);
  // Bei hoher Last (parallele Läufe) landet die Kapsel später als nach 700 ms: bis zu 3 s warten, bis sie am Reiter steht
  let g1 = await pillPos();
  for (let i = 0; i < 30 && (Math.abs(g1[0] - target[0]) >= 1.5 || Math.abs(g1[1] - target[1]) >= 1.5); i++) {
    await p.waitForTimeout(100);
    g1 = await pillPos();
  }
  const between = seen.some(([x, y]) => (Math.abs(x - g0[0]) > 4 || Math.abs(y - g0[1]) > 4) && (Math.abs(x - g1[0]) > 4 || Math.abs(y - g1[1]) > 4));
  check(`[${tag}] Reiter: Kapsel gleitet und landet am gewählten Reiter`, between && Math.abs(g1[0] - target[0]) < 1.5 && Math.abs(g1[1] - target[1]) < 1.5, JSON.stringify({ g0, g1, target, seen: seen.map((x) => x.map(Math.round).join(":")).join(" ") }));

  // Gerät: Reiter im Popup mit Kapsel
  await tap(`dialog.settings .dlg-actions [data-set="close"]`);
  await ev(`r.querySelector("dialog.settings")?.close?.()`);
  await tap('.dev[data-open="c"], .mrow[data-open="c"]');
  await wait(`return !!r.querySelector("dialog.device .sub-tab")`);
  check(`[${tag}] Gerät: Reiter als Segmentschalter mit Kapsel`, await ev(`const bars = [...r.querySelectorAll("dialog.device .sub-tabs")]; return bars.length > 0 && bars.every(b => b.querySelectorAll(":scope > .seg-pill").length === 1 && getComputedStyle(b).backgroundColor !== "rgba(0, 0, 0, 0)")`));

  check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
  await ctx.close();
}
await b.close();
process.exit(ok ? 0 : 1);
