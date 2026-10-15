// Erledigte einmalige Routine (2.32.0, Fehler vom Nutzer gemeldet): Nach dem Lauf ist die Routine aus ("erledigt"), und das Bearbeiten
// schaltet ihn nicht mehr von selbst wieder ein. Der Schalter "Aktiv" im Assistenten bleibt aus, "Speichern" sendet enabled=false;
// nur von Hand (Schalter im Assistenten, Schalter in der Liste) wird er wieder scharf. Den Knopf "Erneut starten" gibt es seit 2.33.1 nicht mehr (er tat dasselbe wie der Schalter). Ein noch nicht gelaufener
// Routine bleibt beim Bearbeiten an. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = { de: { done: "erledigt" }, en: { done: "done" } };
const SEED = (id, name, enabled, done) => ({
  id, device_id: "d", entity_id: "switch.plug", name, action: "on", back_s: 1800, kind: "once", delay_s: null, date: null, time: "10:30", repeat: null, weekdays: null, mday: null,
  enabled, push: false, target: null, created: Date.now() / 1000, ...(done ? { __done: Date.now() / 1000 - 3600 } : {}),
});

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=${mobile ? "dark" : "light"}`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => {
      for (let n = 1; ; n++) {
        const h = await handle(sel);
        if (!h) throw new Error("fehlt: " + sel);
        try { await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); return; } catch (err) { if (n >= 3 || !/not attached|not stable/.test(String(err))) throw err; await p.waitForTimeout(200); }
      }
    };
    const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
    const calls = (type) => p.evaluate((ty) => window.__wsCalls.filter((m) => m.type === ty), type);
    const win = "dialog.routine-dlg";
    const all = "dialog.rtall-dlg";
    await p.evaluate(([a, c]) => { (window.__routines ||= { list: [], seq: 1, runs: [], tests: [] }).list.push(a, c); }, [SEED("aaaaaaaaaaa1", "Erledigt", false, true), SEED("aaaaaaaaaaa2", "Wartet", true, false)]);

    await tap(".toolbar .rtall-btn");
    await wait(`return r.querySelector("${all}")?.open`);
    const toggleOf = (id) => ev(`return r.querySelector('${all} [data-rta="routine-toggle"][data-id="${id}"]')?.checked`);
    check(`[${tag}] erledigte Routine ist aus, wartende an`, (await toggleOf("aaaaaaaaaaa1")) === false && (await toggleOf("aaaaaaaaaaa2")) === true);
    check(`[${tag}] kein Knopf "Erneut starten" im Fenster mit allen Routinen`, await ev(`return !r.querySelector('${all} [data-rta="routine-restart"]') && ![...r.querySelectorAll("${all} .linkbtn")].some((x) => /Erneut starten|Start again/.test(x.textContent))`));
    check(`[${tag}] erledigte Routine trägt "${T.done}"`, await ev(`const c = [...r.querySelectorAll("${all} .mg-card")].find((x) => x.querySelector('[data-id="aaaaaaaaaaa1"]')); return !!c && c.textContent.includes(${JSON.stringify(T.done)})`));

    // Bearbeiten des erledigten Routines: Schalter bleibt aus, Speichern sendet enabled=false
    await tap(`${all} [data-rta="routine-edit"][data-id="aaaaaaaaaaa1"]`);
    await wait(`return r.querySelector("${win}")?.open`);
    // bis zum letzten Schritt (Name und Prüfung, dort der Schalter)
    for (let i = 0; i < 6; i++) {
      if (await ev(`return !!r.querySelector('${win} input[data-rt="enabled"]')`)) break;
      await tap(`${win} [data-rt="nav-next"]`);
    }
    check(`[${tag}] Assistent: Schalter "Aktiv" bleibt beim erledigten Routine aus`, await wait(`const i = r.querySelector('${win} input[data-rt="enabled"]'); return !!i && !i.checked`));
    await p.evaluate(() => { window.__wsCalls = []; });
    await tap(`${win} [data-rt="nav-save"]`);
    const saved = (await (async () => { for (let i = 0; i < 25; i++) { const c = await calls("device_panel/routine_save"); if (c.length) return c; await p.waitForTimeout(200); } return []; })()).at(-1)?.routine;
    check(`[${tag}] Speichern sendet enabled=false, die Routine bleibt aus`, saved?.enabled === false && (await wait(`return r.querySelector("${all}")?.open`)) && (await toggleOf("aaaaaaaaaaa1")) === false, JSON.stringify(saved));

    // Von Hand wieder einschalten: Schalter im Assistenten
    await tap(`${all} [data-rta="routine-edit"][data-id="aaaaaaaaaaa1"]`);
    await wait(`return r.querySelector("${win}")?.open`);
    for (let i = 0; i < 6; i++) {
      if (await ev(`return !!r.querySelector('${win} input[data-rt="enabled"]')`)) break;
      await tap(`${win} [data-rt="nav-next"]`);
    }
    await tap(`${win} input[data-rt="enabled"]`);
    await p.evaluate(() => { window.__wsCalls = []; });
    await tap(`${win} [data-rt="nav-save"]`);
    const again = (await (async () => { for (let i = 0; i < 25; i++) { const c = await calls("device_panel/routine_save"); if (c.length) return c; await p.waitForTimeout(200); } return []; })()).at(-1)?.routine;
    check(`[${tag}] Schalter im Assistenten von Hand an: enabled=true, Routine wieder scharf`, again?.enabled === true && (await wait(`return !!r.querySelector('${all} [data-rta="routine-toggle"][data-id="aaaaaaaaaaa1"]:checked')`)), JSON.stringify(again));

    // Der noch nicht gelaufene Routine bleibt beim Bearbeiten an
    await tap(`${all} [data-rta="routine-edit"][data-id="aaaaaaaaaaa2"]`);
    await wait(`return r.querySelector("${win}")?.open`);
    for (let i = 0; i < 6; i++) {
      if (await ev(`return !!r.querySelector('${win} input[data-rt="enabled"]')`)) break;
      await tap(`${win} [data-rt="nav-next"]`);
    }
    check(`[${tag}] wartende Routine: Schalter bleibt an`, await wait(`const i = r.querySelector('${win} input[data-rt="enabled"]'); return !!i && i.checked`));
    await ev(`r.querySelector("${win}").close()`);
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
