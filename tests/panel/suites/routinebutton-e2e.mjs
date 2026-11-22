// Buttons in Routinen (2.239.0): Aktion "Drücken" (button, input_button), kein Zurückschalten (Hinweis, keine Seite "Zurückschalten"),
// Satz, Testen und Speichern. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { act: "Drücken", note: "Ein Button lässt sich nur drücken, nicht zurückschalten.", sentence: "drücken", back: "Zurückschalten" },
  en: { act: "Press", note: "A button can only be pressed, not switched back.", sentence: "press", back: "Switch back" },
};
const ENTS = [
  { entity_id: "switch.plug", name: "Plug", domain: "switch", state: "on", available: true, actions: ["on", "off", "toggle"], options: [] },
  { entity_id: "button.klingel", name: "Klingel", domain: "button", state: "2026-11-22T08:00:00+00:00", available: true, actions: ["press"], options: [] },
  { entity_id: "input_button.alarm", name: "Alarm-Taste", domain: "input_button", state: "unknown", available: true, actions: ["press"], options: [] },
];

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
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const calls = (type) => p.evaluate((ty) => window.__wsCalls.filter((m) => m.type === ty), type);
    const win = "dialog.routine-dlg";
    const text = (sel) => ev(`return r.querySelector(${JSON.stringify(sel)})?.textContent.trim() ?? null`);
    await p.evaluate((ents) => { window.__routineEntities = Object.fromEntries(window.__devices.map((d) => [d.id, ents])); }, ENTS);

    await tap(".toolbar .rtall-btn");
    await wait(`return r.querySelector("dialog.rtall-dlg")?.open`);
    await tap('dialog.rtall-dlg [data-rta="routine-add"]');
    await wait(`return r.querySelectorAll('${win} [data-rt="dev"]').length > 0`);
    await tap(`${win} [data-rt="dev"]`);
    await tap(`${win} [data-rt="nav-next"]`);
    await wait(`return r.querySelectorAll('${win} [data-rt="pick"]').length === ${ENTS.length}`);

    for (const [id, name] of [["button.klingel", "Klingel"], ["input_button.alarm", "Alarm-Taste"]]) {
      await tap(`${win} [data-rt="pick"][data-id="${id}"]`);
      check(`[${tag}] ${id}: nur die Aktion "${T.act}", Hinweis "${T.note}", kein Zustandswort`, await wait(`const tabs = [...r.querySelectorAll('${win} [data-rt="action"]')].map((x) => x.textContent.trim()); return tabs.join() === ${JSON.stringify(T.act)} && r.querySelector("${win}").textContent.includes(${JSON.stringify(T.note)})`));
      check(`[${tag}] ${id}: Satz "${name} ${T.sentence}", "Weiter" frei, keine Optionen`, await wait(`return r.querySelector("${win} .rt-result")?.textContent.includes(${JSON.stringify(`${name} ${T.sentence}`)}) && !r.querySelector('${win} [data-rt="nav-next"]').disabled && !r.querySelector('${win} [data-rt="setnum"]')`));
    }
    await p.screenshot({ path: `${outDir}/routinebutton-${tag.replace("/", "-")}.png` });

    // Testen: routine_try mit action press
    await tap(`${win} [data-rt="pick"][data-id="button.klingel"]`);
    await p.evaluate(() => { window.__wsCalls = []; });
    await tap(`${win} [data-rt="try"]`);
    check(`[${tag}] Testen: routine_try mit action press für den Button`, await (async () => { for (let i = 0; i < 20; i++) { const c = (await calls("device_panel/routine_try")).at(-1); if (c) return c.action === "press" && c.entity_id === "button.klingel"; await p.waitForTimeout(100); } return false; })());

    // Seiten: Was, Wann, Meldung, Name; es gibt keine Seite "Zurückschalten"
    await tap(`${win} [data-rt="nav-next"]`);
    check(`[${tag}] Seite "Wann", dann geht es ohne "${T.back}" weiter zur Meldung`, await wait(`return !r.querySelector('${win} [data-rt="backkind"]')`));
    await tap(`${win} [data-rt="nav-next"]`);
    check(`[${tag}] Nach "Wann" folgt die Meldung, nie das Zurückschalten`, await wait(`return !r.querySelector('${win} [data-rt="backkind"]') && !!r.querySelector('${win} [data-rt="push"], ${win} [data-rt="notify"], ${win} .mg-k')`));
    await tap(`${win} [data-rt="nav-next"]`);
    await p.evaluate(() => { window.__wsCalls = []; });
    await tap(`${win} [data-rt="nav-save"]`);
    check(`[${tag}] Speichern: action press, kein Zurückschalten, Entität button.klingel`, await wait(`return !r.querySelector("${win}").open`) && await (async () => { const c = (await calls("device_panel/routine_save")).at(-1)?.routine; return c && c.action === "press" && c.entity_id === "button.klingel" && (c.back_kind || "none") === "none" && !c.back_s; })());
    check(`[${tag}] Liste: Satz der neuen Routine nennt "${T.sentence}"`, await wait(`return r.querySelector("dialog.rtall-dlg")?.textContent.includes(${JSON.stringify(T.sentence)})`));

    // Ein Schalter bleibt wie er war
    await tap('dialog.rtall-dlg [data-rta="routine-add"]');
    await wait(`return r.querySelectorAll('${win} [data-rt="dev"]').length > 0`);
    await tap(`${win} [data-rt="dev"]`);
    await tap(`${win} [data-rt="nav-next"]`);
    await wait(`return r.querySelectorAll('${win} [data-rt="pick"]').length === ${ENTS.length}`);
    await tap(`${win} [data-rt="pick"][data-id="switch.plug"]`);
    check(`[${tag}] Schalter: keine Aktion "${T.act}", drei Aktionen`, await wait(`return ![...r.querySelectorAll('${win} [data-rt="action"]')].some((x) => x.textContent.trim() === ${JSON.stringify(T.act)}) && r.querySelectorAll('${win} [data-rt="action"]').length === 3`));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
