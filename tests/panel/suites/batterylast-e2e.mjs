// Letzter Batteriestand eines ausgefallenen Geräts (2.145.0): der Sensor meldet "nicht verfügbar", das Backend liefert battery_last
// aus dem Verlauf. Das Panel zeigt ihn gedämpft mit Alter, in der Übersicht des Popups und in der Spalte "Batterie", ohne Warnung.
// Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = { de: /^letzter Stand vor 4\d Min\.$/, en: /^last value 4\d min ago$/i };

for (const lang of ["de", "en"]) {
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
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);

    // "Thermostat Bad" (c) ist ausgefallen; sein Sensor meldet nichts, das Backend liefert den letzten Stand von vor 47 Min.
    await p.evaluate(() => {
      const d = window.__devices.find((x) => x.id === "c");
      d.battery = null;
      d.has_battery = true;
      d.battery_last = { level: 22, at: Date.now() / 1000 - 47 * 60 };
    });
    await ev(`r.host._fetch(true)`);
    await tap('.dev[data-open="c"]');
    await wait(`return r.querySelector("dialog.device")?.open && r.querySelector("dialog.device .st-tile")`);
    const tile = await ev(`const t = [...r.querySelectorAll("dialog.device .st-tile.stale")][0]; return t ? { v: t.querySelector(".st-v").textContent.trim(), sub: t.querySelector(".st-sub").textContent.trim(), tag: t.tagName, opacity: getComputedStyle(t.querySelector(".st-v")).opacity } : null`);
    check(`[${tag}] Übersicht: Kachel Batterie mit letztem Stand 22 %`, tile && tile.v.startsWith("22") && tile.tag === "DIV", JSON.stringify(tile));
    check(`[${tag}] Kachel nennt das Alter ("${TEXT[lang]}")`, tile && TEXT[lang].test(tile.sub), tile?.sub);
    check(`[${tag}] Kachel gedämpft`, tile && Number(tile.opacity) < 1, tile?.opacity);
    check(`[${tag}] ohne Verlauf (keine Kachel zum Antippen) und ohne Warnung`, await ev(`return !r.querySelector('dialog.device .st-tile[data-kind="battery"]') && !r.querySelector("dialog.device .st-tile.stale.warned")`));
    await p.screenshot({ path: `${outDir}/batterylast-${lang}-${mobile ? "mobile" : "desktop"}.png` });
    await tap('dialog.device [data-dlg="close"]');
    // Liste: Spalte Batterie und Chip "Batterie schwach" zählen den alten Stand nicht als schwach
    const col = await ev(`return r.host._batteryHtml(r.host._devices.find((x) => x.id === "c"))`);
    check(`[${tag}] Liste: gedämpfter Stand, nicht "schwach"`, /bat stale/.test(col) && !/bat low/.test(col) && col.includes("22 %"), col);
    check(`[${tag}] gilt nicht als Warnung (Batterie schwach)`, await ev(`const d = r.host._devices.find((x) => x.id === "c"); return !d.battery?.low`));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join("|"));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
