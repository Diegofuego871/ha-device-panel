// Printscreens für die README (docs/screenshots/{de,en}/): aus dem HA-Nachbau
// mit erfundenen Daten, Desktop hell, Handy dunkel. Aufruf: node readme-shots.mjs
// Danach nur die in der README genutzten Dateien behalten (die übrigen Handy-Bilder
// löschen: alle ausser overview-, popup- und battery-mobile). Port 8950 muss frei sein.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { launchOptions } from "./lib.mjs";
import { startServer } from "./server.mjs";

const root = fileURLToPath(new URL("../../docs/screenshots/", import.meta.url));
const server = await startServer(8950);
const b = await chromium.launch(launchOptions);
const R = `document.querySelector("device-panel").shadowRoot`;

for (const lang of ["de", "en"]) {
  mkdirSync(`${root}${lang}`, { recursive: true });
  for (const mobile of [false, true]) {
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1.5 });
    const p = await ctx.newPage();
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=${mobile ? "dark" : "light"}`);
    const frameEl = await p.waitForSelector("#panel-frame");
    const f = await frameEl.contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 8000 }).then(() => true, () => false);
    const m = mobile ? "-mobile" : "";
    const shot = async (name) => { await p.waitForTimeout(500); await frameEl.screenshot({ path: `${root}${lang}/${name}${m}.png` }); };
    const closeDialogs = async () => {
      await ev(`r.querySelectorAll("dialog[open]").forEach((d) => d.close())`);
      await wait(`return ![...r.querySelectorAll("dialog")].some(d=>d.open)`);
    };
    const open = async (id) => { await tap(`.dev[data-open="${id}"]`); await wait(`return r.querySelector("dialog.device")?.open`); };

    await shot("overview");
    if (mobile) { await ev(`window.scrollTo(0, 0)`); }

    // Pop-up eines instabilen Geräts mit Batterie
    await open("e");
    await shot("popup");
    // Batterie-Verlauf mit Prognose (3 Monate)
    await tap('dialog.device .st-tile[data-kind="battery"]');
    await wait(`return r.querySelector("dialog.stat-dlg")?.open && !!r.querySelector("dialog.stat-dlg .bh-svg")`);
    await tap('dialog.stat-dlg [data-stat="range"][data-range="90d"]');
    await wait(`return r.querySelector('dialog.stat-dlg [data-range="90d"]')?.classList.contains("on") && !!r.querySelector("dialog.stat-dlg .bh-fc")`);
    await shot("battery");
    await closeDialogs();

    // Verfügbarkeit: Statistik 7 Tage (Gerät a, ausgefallen)
    await open("a");
    await tap('dialog.device [data-dlg="stat"][data-range="7d"][data-kind="avail"]');
    await wait(`return r.querySelector("dialog.stat-dlg")?.open && !!r.querySelector("dialog.stat-dlg .avail-bar")`);
    await shot("availability");
    await closeDialogs();

    // Empfang (Gerät mit Empfang: d = Zigbee im Simulator falls vorhanden)
    for (const id of ["b", "c", "d", "e", "a"]) {
      await open(id);
      if (await ev(`return !!r.querySelector('dialog.device .st-tile[data-kind="signal"]')`)) {
        await tap('dialog.device .st-tile[data-kind="signal"]');
        if (await wait(`return r.querySelector("dialog.stat-dlg")?.open && !!r.querySelector("dialog.stat-dlg .bh-svg")`)) { await shot("signal"); await closeDialogs(); break; }
      }
      await closeDialogs();
    }

    // Puls-Fenster
    await tap(".hero [data-pulse], .pulse-card, [data-pulse-open]").catch(() => {});
    if (await wait(`return r.querySelector("dialog.pulse-dlg")?.open`)) { await shot("pulse"); await closeDialogs(); }

    // KI-Einschätzung: einschalten, Antwort im Pop-up
    await ev(`r.host._aiOn = true; r.host._renderDevice && 0`);
    await p.evaluate(() => { window.__version = { installed: "1.7.0", latest: "1.7.0" }; });
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await wait(`return !!r.querySelector(".mon-tab")`);
    await shot("settings-monitor");
    await tap('.mon-tab[data-key="integ"]');
    await wait(`return !!r.querySelector(".ilist-row")`);
    await shot("settings-integrations");
    await tap('[data-set="section"][data-id="monitor"]');
    await tap('[data-set="section"][data-id="ai"]');
    await tap('.switch input[data-opt="ai_assessment"]');
    await ev(`const a=r.querySelector('input[data-opt="ai_expert"], input[data-set="expert"]'); if (a && !a.checked) a.click()`);
    await ev(`(r.querySelector(".aip-box") || r.querySelector('[data-id="ai"]')).scrollIntoView({ block: "center" })`);
    await shot("settings-ai");
    await tap('dialog.settings [data-set="save"]');
    await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`);
    await tap('dialog.settings [data-set="close"]');
    await wait(`return !r.querySelector("dialog.settings").open`);
    await wait(`return r.host._aiOn === true`);
    await open("b");
    if (await wait(`return !!r.querySelector(".ai-btn")`)) {
      await tap(".ai-btn");
      await wait(`return !!r.querySelector(".ai-title") && !!r.querySelector(".ai-foot")`);
      await shot("ai");
    }
    await closeDialogs();
    await ctx.close();
  }
}
await b.close();
server.close();
console.log("fertig", root);
