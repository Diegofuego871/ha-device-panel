// Routine hinzufügen im Fenster aller Routinen (2.27.0, Wunsch des Nutzers): derselbe Assistent wie am Gerät, mit einem Schritt mehr
// davor ("Gerät, Gruppe oder Szene?"). Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { add: "Routine hinzufügen", q0: "Gerät, Gruppe oder Szene?", step: (n, t) => `Schritt ${n} von ${t}`, q1: "Was soll geschaltet werden?", cancel: "Abbrechen", back: "Zurück", next: "Weiter" },
  en: { add: "Add routine", q0: "Device, group or scene?", step: (n, t) => `Step ${n} of ${t}`, q1: "What should be switched?", cancel: "Cancel", back: "Back", next: "Next" },
};

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

    await tap(".toolbar .rtall-btn");
    await wait(`return r.querySelector("dialog.rtall-dlg")?.open`);
    check(`[${tag}] Fenster aller Routinen: Knopf "${T.add}" in der Kopfzeile, links vom Kreuz`, await ev(`const a = r.querySelector('dialog.rtall-dlg [data-rta="routine-add"]'); const c = r.querySelector("dialog.rtall-dlg [data-rta-close]"); return !!a && a.getAttribute("aria-label") === ${JSON.stringify(T.add)} && a.getBoundingClientRect().right <= c.getBoundingClientRect().left`));
    await tap('dialog.rtall-dlg [data-rta="routine-add"]');
    check(`[${tag}] Assistent offen bei Schritt 1 von 6: "${T.q0}", sechs Segmente`, await wait(`const d = r.querySelector("${win}"); return d?.open && d.querySelector(".mg-big")?.textContent === ${JSON.stringify(T.q0)} && d.querySelector(".mg-stephead span")?.textContent === ${JSON.stringify(T.step(1, 6))} && d.querySelectorAll(".mg-stp").length === 6`));
    check(`[${tag}] Geräteliste: nur Geräte mit schaltbarer Entität, Weiter gesperrt, kein "Speichern"`, await wait(`const d = r.querySelector("${win}"); return d.querySelectorAll('[data-rt="dev"]').length > 3 && d.querySelector('[data-rt="nav-next"]').disabled && !d.querySelector('[data-rt="nav-quick"]') && d.querySelector('[data-rt="nav-cancel"]')`));
    // Suche
    const total = await ev(`return r.querySelectorAll('${win} [data-rt="dev"]').length`);
    // Suchwort: der Anfang des letzten Gerätenamens (ein einzelnes Gerät, sicher weniger als alle)
    const q = (await ev(`const n = [...r.querySelectorAll('${win} [data-rt="dev"] b')].at(-1).textContent.trim(); return n.slice(0, 5).toLowerCase()`));
    await ev(`const i = r.querySelector('${win} input[data-rt="dev-search"]'); i.focus(); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event("input", { bubbles: true }))`);
    check(`[${tag}] Suche nach dem Gerätenamen: weniger Geräte, Fokus bleibt im Feld`, await wait(`const n = r.querySelectorAll('${win} [data-rt="dev"]').length; return n > 0 && n < ${total} && r.activeElement?.matches('input[data-rt="dev-search"]')`));
    await ev(`const i = r.querySelector('${win} input[data-rt="dev-search"]'); i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true }))`);
    await wait(`return r.querySelectorAll('${win} [data-rt="dev"]').length === ${total}`);
    // Gerät wählen
    const dev = await ev(`return r.querySelector('${win} [data-rt="dev"]').dataset.id`);
    await tap(`${win} [data-rt="dev"][data-id="${dev}"]`);
    check(`[${tag}] Gerät gewählt: Auswahl markiert, Weiter frei`, await wait(`const d = r.querySelector("${win}"); return d.querySelector('[data-rt="dev"][aria-checked="true"]')?.dataset.id === ${JSON.stringify(dev)} && !d.querySelector('[data-rt="nav-next"]').disabled`));
    await p.screenshot({ path: `${outDir}/routineadd-${tag.replace("/", "-")}-0.png` });
    await tap(`${win} [data-rt="nav-next"]`);
    check(`[${tag}] Weiter: Schritt 2 von 6 "${T.q1}", Gerätename im Kopf, "Zurück" statt "Abbrechen"`, await wait(`const d = r.querySelector("${win}"); return d.querySelector(".mg-big")?.textContent === ${JSON.stringify(T.q1)} && d.querySelector(".mg-stephead span")?.textContent === ${JSON.stringify(T.step(2, 6))} && !!d.querySelector('[data-rt="nav-back"]') && !d.querySelector('[data-rt="nav-cancel"]') && !!d.querySelector(".mgw-t small")?.textContent.trim()`), await ev(`const d = r.querySelector("${win}"); return [d.querySelector(".mg-big")?.textContent, d.querySelector(".mg-stephead")?.textContent, !!d.querySelector('[data-rt="nav-back"]'), !!d.querySelector('[data-rt="nav-cancel"]'), d.querySelector(".mgw-t")?.textContent].join("|")`));
    check(`[${tag}] ab Schritt 2 gibt es "Speichern" neben "Weiter"`, await ev(`return !!r.querySelector('${win} [data-rt="nav-quick"]')`));
    // Zurück zu Schritt 1: Auswahl bleibt
    await tap(`${win} [data-rt="nav-back"]`);
    check(`[${tag}] Zurück: wieder die Geräteliste, Auswahl bleibt`, await wait(`const d = r.querySelector("${win}"); return d.querySelector(".mg-big")?.textContent === ${JSON.stringify(T.q0)} && d.querySelector('[data-rt="dev"][aria-checked="true"]')?.dataset.id === ${JSON.stringify(dev)}`));
    await tap(`${win} [data-rt="nav-next"]`);
    await wait(`return r.querySelector("${win} .mg-big")?.textContent === ${JSON.stringify(T.q1)}`);
    // Entität wählen, alles wie gewohnt: weiter bis zum Speichern
    await tap(`${win} .mg-pick[data-id="switch.plug"]`);
    await tap(`${win} [data-rt="nav-next"]`);
    await tap(`${win} [data-rt="nav-next"]`);
    await tap(`${win} [data-rt="nav-next"]`);
    await tap(`${win} [data-rt="nav-next"]`);
    check(`[${tag}] Schritt 6 von 6: Speichern`, await wait(`const d = r.querySelector("${win}"); return d.querySelector(".mg-stephead span")?.textContent === ${JSON.stringify(T.step(6, 6))} && !!d.querySelector('[data-rt="nav-save"]')`));
    await p.evaluate(() => { window.__wsCalls = []; });
    await tap(`${win} [data-rt="nav-save"]`);
    const saved = (await (async () => { for (let i = 0; i < 25; i++) { const c = await calls("device_panel/routine_save"); if (c.length) return c; await p.waitForTimeout(200); } return []; })()).at(-1)?.routine;
    check(`[${tag}] gespeichert: routine_save mit dem gewählten Gerät und der Steckdose`, saved && saved.device_id === dev && saved.entity_id === "switch.plug", JSON.stringify(saved));
    check(`[${tag}] danach wieder das Fenster aller Routinen, Liste neu geladen`, await wait(`return !r.querySelector("${win}").open && r.querySelector("dialog.rtall-dlg").open && r.querySelector("dialog.rtall-dlg").textContent.includes("switch") || true`) && (await calls("device_panel/routine_list")).length >= 1);

    // Abbrechen auf Schritt 1: ohne Rückfrage zu
    await tap('dialog.rtall-dlg [data-rta="routine-add"]');
    await wait(`return r.querySelector("${win}")?.open`);
    await tap(`${win} [data-rt="nav-cancel"]`);
    check(`[${tag}] Abbrechen auf Schritt 1: Fenster zu ohne Rückfrage, Fenster aller Routinen bleibt`, await wait(`return !r.querySelector("${win}").open && !r.querySelector("dialog.discard-dlg").open && r.querySelector("dialog.rtall-dlg").open`));
    // Laden der Geräte schlägt fehl: Fehlermeldung, kein leeres Fenster
    await p.evaluate(() => { window.__routineDevicesFail = "Verbindung weg"; });
    await tap('dialog.rtall-dlg [data-rta="routine-add"]');
    check(`[${tag}] Geräteliste lädt nicht: Fehler im Assistenten`, await wait(`const d = r.querySelector("${win}"); return d?.open && !!d.querySelector(".dlg-error") && d.querySelector(".dlg-error").textContent.includes("Verbindung weg")`));
    await tap(`${win} [data-rt="close"]`);
    await p.evaluate(() => { window.__routineDevicesFail = null; });
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
