// Schalter in Home Assistant (2.177.0): im Assistenten der Routine (Schritt "Name") der Schalter "Als Schalter in Home Assistant";
// er geht mit der Routine ins Backend (ha_switch) und zeigt nach dem Speichern die Entity-ID. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const SEED = (id, device, name, extra = {}) => ({ id, device_id: device, entity_id: "switch.plug", name, action: "on", back_s: null, kind: "repeat", delay_s: null, date: null, time: "06:30", repeat: "daily", weekdays: null, mday: null, enabled: true, push: false, target: null, created: Date.now() / 1000, ...extra });

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const calls = (type) => p.evaluate((ty) => window.__wsCalls.filter((m) => m.type === ty), type);
    await p.evaluate((rts) => { (window.__routines ||= { list: [], seq: 1, runs: [], tests: [] }).list.push(...rts); }, [SEED("aaaaaaaaaaa1", "d", "Bewässerung"), SEED("aaaaaaaaaaa2", "d", "Nachtlicht", { ha_switch: true })]);

    // Bestehende Routine bearbeiten: Schalter steht auf "aus"; ein, speichern, ha_switch geht mit
    await ev(`r.host._openDevice("d", "routine")`);
    await wait(`return r.querySelectorAll(".rt-root .rt-rowcard").length === 2`);
    await tap(`.rt-root .rt-rowcard .mg-dhead`);
    await wait(`return !!r.querySelector(".rt-root .rt-clock [data-rt='edit']")`);
    await tap(`.rt-root .rt-clock [data-rt='edit']`);
    // Zum Schritt mit dem Namen (letzter Schritt): "Weiter" bis der Schalter da ist
    for (let i = 0; i < 8 && !(await ev(`return !!r.querySelector('[data-rt="ha-switch"]')`)); i++) {
      const next = await ev(`const n = r.querySelector('dialog.routine-dlg [data-rt="nav-next"]'); return !!n && !n.disabled`);
      if (!next) break;
      await tap(`dialog.routine-dlg [data-rt="nav-next"]`);
      await wait(`return true`);
    }
    check(`[${tag}] Assistent: Zeile "Als Schalter in Home Assistant" mit Schalter`, await ev(`const i = r.querySelector('[data-rt="ha-switch"]'); return !!i && /(Home Assistant)/.test(i.closest(".mg-optrow").textContent)`));
    const was = await ev(`return r.querySelector('[data-rt="ha-switch"]').checked`);
    await tap(`[data-rt="ha-switch"]`);
    check(`[${tag}] Schalter umlegen ändert den Entwurf`, (await ev(`return r.querySelector('[data-rt="ha-switch"]').checked`)) === !was);
    await tap(`dialog.routine-dlg [data-rt="nav-save"]`);
    await wait(`return !r.querySelector('[data-rt="ha-switch"]')`);
    const saved = (await calls("device_panel/routine_save")).at(-1)?.routine;
    check(`[${tag}] gespeichert: ha_switch im Entwurf`, saved && saved.ha_switch === !was, JSON.stringify(saved && { ha_switch: saved.ha_switch }));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(";"));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
