// Lange Listen stehen in den Einstellungen ganz unten (2.5.0, Wunsch des Nutzers): Laden und Updates mit
// Emoji und Vorschau davor, Darstellung mit "Reihenfolge zurücksetzen" über der Chip-Liste; Ausfall, Batterie,
// Neu und Empfang enden bei den Abweichungen. Desktop und Handy, echte Taps.
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
  await p.goto("http://127.0.0.1:8950/ha-sim.html?lang=de");
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return (document.querySelector("device-panel")?.shadowRoot?.querySelectorAll(".dev").length || 0) > 1`), null, { timeout: 15000 });
  const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
  const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
  const tap = async (sel) => {
    for (let i = 0; ; i++) {
      try {
        const h = (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
        if (!h) throw new Error("fehlt: " + sel);
        await h.scrollIntoViewIfNeeded();
        if (mobile) await h.tap(); else await h.click();
        return;
      } catch (err) {
        if (i >= 3 || !/not attached|not stable/.test(String(err))) throw err;
        await p.waitForTimeout(150);
      }
    }
  };
  // Alle Blöcke des Reiters in der Reihenfolge, in der sie auftauchen: Position von a vor b
  const before = (a, bSel) => ev(`const A=r.querySelector(${JSON.stringify(a)}), B=r.querySelector(${JSON.stringify(bSel)}); return !!A && !!B && (A.compareDocumentPosition(B) & Node.DOCUMENT_POSITION_FOLLOWING) > 0`);
  // Liste ist der letzte Block des Reiters: nichts Eigenes dahinter (nur die Zeile "Keine Treffer" der Suche)
  const lastBlock = (sel) => ev(`const L=r.querySelector(${JSON.stringify(sel)}); let n=L?.nextElementSibling; while (n && n.classList.contains("srch-none")) n=n.nextElementSibling; return !!L && !n && !L.parentElement.nextElementSibling`);
  const tab = async (key) => { await tap(`[data-set="tab"][data-key="${key}"]`); await wait(`return r.querySelector('.mon-tab.on')?.dataset.key === "${key}"`); };

  await tap(".gear-btn");
  await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
  await tap('[data-set="section"][data-id="monitor"]');

  // Laden: Schalter, Zeilen, Emoji, Vorschau, dann die Liste "Pro Integration"
  await tab("charge");
  await tap('input[data-opt="notify_charge"]');
  await wait(`return !!r.querySelector('[data-srch="charge"]')`);
  check(`[${tag}] Laden: Emoji vor der Liste`, await before(".emo-box", '[data-srch="charge"]'));
  check(`[${tag}] Laden: Vorschau vor der Liste`, await before(".pv", '[data-srch="charge"]'));
  check(`[${tag}] Laden: Überschrift der Liste nach der Vorschau`, await ev(`const t=[...r.querySelectorAll(".mon-body .mon-grp")].pop(); const pv=r.querySelector(".pv"); return !!t && (pv.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING) > 0 && !!t.nextElementSibling`));
  check(`[${tag}] Laden: die Liste ist der letzte Block`, await lastBlock('[data-srch="charge"]'));

  // Updates: Arten, Emoji, Vorschau, dann die Liste "Einzelne Apps und Integrationen"
  await tab("updates");
  await tap('input[data-opt="notify_updates"]');
  await wait(`return !!r.querySelector('[data-srch="updates"]') && !!r.querySelector(".pv")`);
  check(`[${tag}] Updates: Arten, Emoji und Vorschau vor der Liste`, (await before('input[data-ukind]', '[data-srch="updates"]')) && (await before(".emo-box", '[data-srch="updates"]')) && (await before(".pv", '[data-srch="updates"]')));
  check(`[${tag}] Updates: die Liste ist der letzte Block`, await lastBlock('[data-srch="updates"]'));

  // Ausfall, Batterie, Neu, Empfang: die Abweichungen (Listen) bleiben am Ende, nach Emoji und Vorschau
  await tab("outage");
  await tap('input[data-opt="notify_outage"]');
  await wait(`return !!r.querySelector(".pv")`);
  check(`[${tag}] Ausfall: Emoji und Vorschau vor den Abweichungen`, (await before(".emo-box", ".ovr-opt")) && (await before(".pv", ".ovr-opt")));
  await tab("battery");
  await tap('input[data-opt="battery_push"]');
  await wait(`return !!r.querySelector(".pv")`);
  check(`[${tag}] Batterie: Emoji und Vorschau vor den Abweichungen`, (await before(".emo-box", ".ovr-opt")) && (await before(".pv", ".ovr-opt")));

  // Darstellung: "Reihenfolge zurücksetzen" über der Chip-Liste
  await tap('[data-set="section"][data-id="monitor"]');
  await tap('[data-set="section"][data-id="look"]');
  await ev(`r.host._settings.draft.chip_order = ["all"]; r.host._renderSettings()`);
  await wait(`return !!r.querySelector(".drag-reset") && !!r.querySelector(".drag-list")`);
  check(`[${tag}] Darstellung: Zurücksetzen vor der Chip-Liste, nichts dahinter`, (await before(".drag-reset", ".drag-list")) && (await ev(`const L=r.querySelector(".drag-list"); return !L.nextElementSibling`)));

  check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
