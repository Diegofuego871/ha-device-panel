// KI-Einschätzung nur mit KI-Aufgabe einschaltbar (2.38.0, Wunsch des Nutzers): Ohne eine KI-Task-Entität unter "KI-Vorschläge" von Home Assistant
// (/config/ai, "Aufgaben zur Datengenerierung") lässt sich der Schalter "Knopf "Mit KI einschätzen" zeigen" nicht einschalten; eine sprechende
// Meldung sagt warum und was zu tun ist. Ein Link führt zu /config/ai. Schon Eingeschaltetes bleibt, mit Hinweis. Deutsch und Englisch,
// Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: {
    link: "KI-Vorschläge in Home Assistant öffnen",
    notReady: 'Keine KI-Aufgabe ausgewählt. Wähle in Home Assistant unter "KI-Vorschläge" bei "Aufgaben zur Datengenerierung" eine KI-Task-Entität aus. Erst dann lässt sich die KI-Einschätzung hier einschalten.',
    lost: 'Keine KI-Aufgabe mehr verfügbar: Die Einschätzung scheitert, bis in Home Assistant unter "KI-Vorschläge" bei "Aufgaben zur Datengenerierung" eine KI-Task-Entität gewählt ist.',
  },
  en: {
    link: "Open AI suggestions in Home Assistant",
    notReady: 'No AI task selected. In Home Assistant, under "AI suggestions", choose an AI task entity for "Data generation tasks". Only then can the AI assessment be switched on here.',
    lost: 'No AI task available any more: the assessment fails until an AI task entity is chosen for "Data generation tasks" in Home Assistant under "AI suggestions".',
  },
};

async function open(lang, mobile, query = "", enabled = false) {
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1400, height: 1000 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}${query}`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
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
  if (enabled) await p.evaluate(() => { window.__opts.ai_assessment = true; });
  await tap(".gear-btn");
  await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
  await tap('[data-set="section"][data-id="ai"]');
  await wait(`return !!r.querySelector('input[data-opt="ai_assessment"]')`);
  const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.textContent || "").replace(/\\s+/g, " ").trim()`);
  return { ctx, p, ev, tap, wait, text, errors, handle };
}

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;

    // 1. Mit KI-Aufgabe: einschaltbar, keine Warnung, der Link ist da
    {
      const { ctx, ev, text, errors, wait } = await open(lang, mobile);
      check(`[${tag}] mit KI-Aufgabe: Schalter frei, keine Meldung`, await ev(`const i = r.querySelector('input[data-opt="ai_assessment"]'); const o = i.closest(".opt"); return !i.disabled && !i.checked && !o.querySelector(".opt-warn")`));
      check(`[${tag}] Link "${T.link}" unter dem Schalter`, (await text(".opt-link .set-link")) === T.link);
      await ev(`r.querySelector('input[data-opt="ai_assessment"]').click()`);
      check(`[${tag}] mit KI-Aufgabe: Schalter lässt sich einschalten`, await wait(`return r.querySelector('input[data-opt="ai_assessment"]').checked`));
      check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }

    // 2. Ohne KI-Aufgabe: gesperrt, sprechende Meldung, Link; Klick auf den Schalter ändert nichts
    {
      const { ctx, p, ev, tap, text, errors, wait } = await open(lang, mobile, "&noai=1");
      check(`[${tag}] ohne KI-Aufgabe: Schalter gesperrt und aus`, await ev(`const i = r.querySelector('input[data-opt="ai_assessment"]'); return i.disabled && !i.checked`));
      check(`[${tag}] Meldung: "${T.notReady.slice(0, 40)}…"`, (await ev(`const i = r.querySelector('input[data-opt="ai_assessment"]'); return (i.closest(".opt").querySelector(".opt-warn")?.textContent || "").replace(/\\s+/g, " ").trim()`)) === T.notReady);
      check(`[${tag}] Link "${T.link}" auch ohne KI-Aufgabe`, (await text(".opt-link .set-link")) === T.link);
      await ev(`r.querySelector('input[data-opt="ai_assessment"]').click()`);
      await p.waitForTimeout(250);
      check(`[${tag}] Klick auf den gesperrten Schalter: bleibt aus, nichts zu speichern`, await ev(`return !r.querySelector('input[data-opt="ai_assessment"]').checked && r.querySelector('[data-set="save"]').disabled`));
      // Der Link führt zu /config/ai und schliesst die Einstellungen
      await p.evaluate(() => { window.__nav = []; });
      await tap(".opt-link .set-link");
      check(`[${tag}] Link öffnet /config/ai, Einstellungen sind zu`, (await p.evaluate(() => window.__nav.at(-1))) === "/config/ai" && (await wait(`return !r.querySelector("dialog.settings").open`)));
      check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }

    // 3. Schon eingeschaltet, aber die KI-Aufgabe fehlt: bleibt an, Hinweis; nach dem Ausschalten wieder gesperrt
    {
      const { ctx, ev, text, errors, wait } = await open(lang, mobile, "&noai=1", true);
      check(`[${tag}] schon an, KI-Aufgabe weg: Schalter an und frei, Hinweis "${T.lost.slice(0, 40)}…"`, await ev(`const i = r.querySelector('input[data-opt="ai_assessment"]'); return i.checked && !i.disabled`) && (await ev(`return (r.querySelector('input[data-opt="ai_assessment"]').closest(".opt").querySelector(".opt-warn")?.textContent || "").replace(/\\s+/g, " ").trim()`)) === T.lost);
      await ev(`r.querySelector('input[data-opt="ai_assessment"]').click()`);
      check(`[${tag}] ausgeschaltet: jetzt gesperrt mit der Meldung "keine KI-Aufgabe ausgewählt"`, await wait(`const i = r.querySelector('input[data-opt="ai_assessment"]'); return !i.checked && i.disabled`) && (await ev(`return (r.querySelector('input[data-opt="ai_assessment"]').closest(".opt").querySelector(".opt-warn")?.textContent || "").replace(/\\s+/g, " ").trim()`)) === T.notReady);
      check(`[${tag}] Link bleibt`, (await text(".opt-link .set-link")) === T.link);
      check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
