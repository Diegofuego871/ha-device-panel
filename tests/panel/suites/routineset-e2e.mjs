// Routinen auf Zahl und Auswahl (2.80.0): Aktion "Wert setzen" für number und select, mit Regler und Zahlenfeld bzw. Auswahl auf der Seite
// "Was", Prüfung des Bereichs, "Zurück" nur mit "wie vorher", Test und Speichern. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { act: "Wert setzen", set20: "auf 20 % setzen", set53: "auf 53 % setzen", weiss: "auf Weiss setzen", range: "zwischen 0 und 100", restore: "wie vorher", note: "Zurück geht auf den Wert von vorher" },
  en: { act: "Set value", set20: "set to 20 %", set53: "set to 53 %", weiss: "set to Weiss", range: "between 0 and 100", restore: "as before", note: "Going back returns to the value from before" },
};
const ENTS = [
  { entity_id: "switch.plug", name: "Plug", domain: "switch", state: "on", available: true, actions: ["on", "off", "toggle"], options: [] },
  { entity_id: "number.helligkeit", name: "Helligkeit", domain: "number", state: "53.0", available: true, actions: ["set"], options: [{ key: "value", type: "number", unit: "%", min: 0, max: 100, step: 1 }] },
  { entity_id: "select.farbe", name: "Schriftfarbe", domain: "select", state: "Grau", available: true, actions: ["set"], options: [{ key: "option", type: "pick", values: ["Grau", "Weiss", "Schwarz"] }] },
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

    // Zahl: Aktion "Wert setzen", Regler und Zahlenfeld mit dem jetzigen Wert, Satz
    await tap(`${win} [data-rt="pick"][data-id="number.helligkeit"]`);
    check(`[${tag}] Zahl: nur die Aktion "${T.act}", Regler und Zahlenfeld mit 53, Einheit %`, await wait(`const tabs = [...r.querySelectorAll('${win} [data-rt="action"]')].map((x) => x.textContent.trim()); const num = r.querySelector('${win} input[type="number"][data-rt="setnum"]'); const rng = r.querySelector('${win} input[type="range"][data-rt="setnum"]'); return tabs.join() === ${JSON.stringify(T.act)} && num?.value === "53" && rng?.value === "53" && r.querySelector("${win} .rt-setnum span")?.textContent === "%"`));
    check(`[${tag}] Zahl: Satz "${T.set53}", "Weiter" frei`, await wait(`return r.querySelector("${win} .rt-result")?.textContent.includes(${JSON.stringify(T.set53)}) && !r.querySelector('${win} [data-rt="nav-next"]').disabled`));
    const num = await handle(`${win} input[type="number"][data-rt="setnum"]`);
    await num.fill("150");
    check(`[${tag}] Zahl 150: Fehler "${T.range}", "Weiter" gesperrt`, await wait(`const e = r.querySelector('${win} [data-rt-err="set"]'); return !e.hidden && e.textContent.includes(${JSON.stringify(T.range)}) && r.querySelector('${win} [data-rt="nav-next"]').disabled`));
    await num.fill("20");
    check(`[${tag}] Zahl 20: Regler folgt, Satz "${T.set20}", Fehler weg, "Weiter" frei`, await wait(`const e = r.querySelector('${win} [data-rt-err="set"]'); return e.hidden && r.querySelector('${win} input[type="range"][data-rt="setnum"]').value === "20" && r.querySelector("${win} .rt-result").textContent.includes(${JSON.stringify(T.set20)}) && !r.querySelector('${win} [data-rt="nav-next"]').disabled`));
    await p.screenshot({ path: `${outDir}/routineset-${tag.replace("/", "-")}-number.png` });

    // Testen: set mit Wert
    await p.evaluate(() => { window.__wsCalls = []; });
    await tap(`${win} [data-rt="try"]`);
    check(`[${tag}] Testen: routine_try mit action set und Wert 20`, await wait(`return true`) && await (async () => { for (let i = 0; i < 20; i++) { const c = (await calls("device_panel/routine_try")).at(-1); if (c) return c.action === "set" && c.options?.value === 20; await p.waitForTimeout(100); } return false; })());

    // Seiten: Was, Wann, Zurückschalten, Meldung, Name (keine Seite "Optionen")
    await tap(`${win} [data-rt="nav-next"]`);
    await tap(`${win} [data-rt="nav-next"]`);
    check(`[${tag}] Seite "Zurückschalten" kommt nach "Wann"`, await wait(`return !!r.querySelector('${win} [data-rt="backkind"]')`));
    await tap(`${win} [data-rt="backkind"][data-v="duration"]`);
    await tap(`${win} [data-rt="bdur"]`);
    check(`[${tag}] Zurück: kein Gegenstück zur Wahl, Hinweis "${T.note}", Satz "${T.restore}"`, await wait(`return !r.querySelector('${win} [data-rt="bmode"]') && r.querySelector("${win}").textContent.includes(${JSON.stringify(T.note)}) && r.querySelector("${win} .mg-sumline")?.textContent.includes(${JSON.stringify(T.restore)})`));
    await tap(`${win} [data-rt="nav-next"]`);
    await tap(`${win} [data-rt="nav-next"]`);
    await p.evaluate(() => { window.__wsCalls = []; });
    await tap(`${win} [data-rt="nav-save"]`);
    check(`[${tag}] Speichern: action set, Wert 20 (Zahl), "wie vorher", Dauer`, await wait(`return !r.querySelector("${win}").open`) && await (async () => { const c = (await calls("device_panel/routine_save")).at(-1)?.routine; return c && c.action === "set" && c.options?.value === 20 && c.back_mode === "restore" && c.back_s > 0 && c.entity_id === "number.helligkeit"; })());
    check(`[${tag}] Liste: Satz der neuen Routine nennt "${T.set20}" und "${T.restore}"`, await wait(`return [...r.querySelectorAll("dialog.rtall-dlg .mg-card small")].some((x) => x.textContent.includes(${JSON.stringify(T.set20)}) && x.textContent.includes(${JSON.stringify(T.restore)}))`) || await wait(`return r.querySelector("dialog.rtall-dlg")?.textContent.includes(${JSON.stringify(T.set20)})`));

    // Auswahl: Knöpfe mit den Werten, gewählt ist der jetzige
    await tap('dialog.rtall-dlg [data-rta="routine-add"]');
    await wait(`return r.querySelectorAll('${win} [data-rt="dev"]').length > 0`);
    await tap(`${win} [data-rt="dev"]`);
    await tap(`${win} [data-rt="nav-next"]`);
    await wait(`return r.querySelectorAll('${win} [data-rt="pick"]').length === ${ENTS.length}`);
    await tap(`${win} [data-rt="pick"][data-id="select.farbe"]`);
    check(`[${tag}] Auswahl: drei Knöpfe, "Grau" (jetziger Wert) gewählt`, await wait(`const b = [...r.querySelectorAll('${win} [data-rt="setopt"]')]; return b.map((x) => x.textContent.trim()).join() === "Grau,Weiss,Schwarz" && b[0].classList.contains("on")`));
    await tap(`${win} [data-rt="setopt"][data-v="Weiss"]`);
    check(`[${tag}] Auswahl "Weiss": Satz "${T.weiss}", "Weiter" frei`, await wait(`return r.querySelector("${win} .rt-result").textContent.includes(${JSON.stringify(T.weiss)}) && !r.querySelector('${win} [data-rt="nav-next"]').disabled`));
    await p.screenshot({ path: `${outDir}/routineset-${tag.replace("/", "-")}-select.png` });

    // Ein Schalter bleibt wie er war: Aktionen ein, aus, umschalten, kein "Wert setzen"
    await tap(`${win} [data-rt="pick"][data-id="switch.plug"]`);
    check(`[${tag}] Schalter: keine Aktion "${T.act}", kein Zahlenfeld`, await wait(`return ![...r.querySelectorAll('${win} [data-rt="action"]')].some((x) => x.textContent.trim() === ${JSON.stringify(T.act)}) && !r.querySelector('${win} [data-rt="setnum"]') && r.querySelectorAll('${win} [data-rt="action"]').length === 3`));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
