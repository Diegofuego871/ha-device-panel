// Startseite (2.39.0, Wunsch des Nutzers): Der Abschnitt "Darstellung" heisst jetzt "Ansicht" und hat ganz oben, vor den Filter-Chips, den neuen
// Bereich "Startseite" mit dem Schalter "Als meine Startseite festlegen". Er schreibt default_panel ("device-panel") sofort in die Benutzerdaten
// "core" von Home Assistant (frontend/set_user_data), ohne die übrigen Werte zu verlieren, und gilt nicht erst mit "Speichern". Ausschalten
// entfernt den Wert (Vorgabe von HA). Fehler werden gezeigt. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { sec: "Ansicht", title: "Startseite", label: "Als meine Startseite festlegen", chips: "Filter-Chips", sum: "Deine Startseite", err: "Die Startseite liess sich nicht speichern: boom" },
  en: { sec: "View", title: "Start page", label: "Set as my start page", chips: "Filter chips", sum: "Your start page", err: "The start page could not be saved: boom" },
};

async function open(lang, mobile, core = null) {
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1400, height: 1000 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  if (core) await p.addInitScript((v) => { if (!sessionStorage.getItem("sim_user_data")) sessionStorage.setItem("sim_user_data", v); }, JSON.stringify({ core }));
  await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}`);
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
  const userCore = () => p.evaluate(() => JSON.parse(sessionStorage.getItem("sim_user_data") || "{}").core ?? null);
  await tap(".gear-btn");
  await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
  await tap('[data-set="section"][data-id="look"]');
  await wait(`return !!r.querySelector('input[data-start-panel]')`);
  return { ctx, p, ev, tap, wait, errors, userCore };
}

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;

    // Name des Abschnitts, Reihenfolge: Bereich "Startseite" vor den Filter-Chips
    {
      const { ctx, p, ev, tap, wait, errors, userCore } = await open(lang, mobile, { other: 1, default_panel: "lovelace" });
      check(`[${tag}] Abschnitt heisst "${T.sec}"`, (await ev(`return r.querySelector('[data-id="look"] .set-sec-title').textContent.trim()`)) === T.sec);
      const order = await ev(`const body = r.querySelector('[data-id="look"]').parentElement; const items = [...body.querySelectorAll(".set-title, .ex-title, input[data-start-panel]")]; return items.map((e) => e.matches("input") ? "switch" : e.textContent.trim())`);
      check(`[${tag}] ganz oben: "${T.title}", dann der Schalter, dann "${T.chips}"`, order[0] === T.title && order[1] === "switch" && order[2] === T.chips, JSON.stringify(order));
      check(`[${tag}] Schalter "${T.label}": aus (HA hat eine andere Startseite), frei`, await ev(`const i = r.querySelector('input[data-start-panel]'); return !i.checked && !i.disabled && i.getAttribute("aria-label") === ${JSON.stringify(T.label)}`));
      await p.evaluate(() => { window.__wsCalls = []; });
      await tap("input[data-start-panel]");
      check(`[${tag}] eingeschaltet: sofort gespeichert (default_panel = device-panel), übrige Werte bleiben`, await wait(`return r.querySelector('input[data-start-panel]').checked`) && JSON.stringify(await userCore()) === JSON.stringify({ other: 1, default_panel: "device-panel" }), JSON.stringify(await userCore()));
      check(`[${tag}] gilt sofort: nichts zu speichern, keine Panel-Einstellung gesendet`, await ev(`return r.querySelector('[data-set="save"]').disabled`) && (await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_options").length)) === 0);
      check(`[${tag}] Zusammenfassung des Abschnitts nennt "${T.sum}"`, (await ev(`return r.querySelector('[data-id="look"] .set-sec-sum').textContent`)).includes(T.sum));
      await tap("input[data-start-panel]");
      check(`[${tag}] ausgeschaltet: default_panel entfernt (Vorgabe von HA), übrige Werte bleiben`, await wait(`return !r.querySelector('input[data-start-panel]').checked`) && JSON.stringify(await userCore()) === JSON.stringify({ other: 1 }), JSON.stringify(await userCore()));
      check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }

    // Beim Öffnen steht der Schalter schon an, wenn dieses Panel die Startseite ist
    {
      const { ctx, ev, errors } = await open(lang, mobile, { default_panel: "device-panel" });
      check(`[${tag}] ist das Panel schon die Startseite: Schalter an`, await ev(`const i = r.querySelector('input[data-start-panel]'); return i.checked && !i.disabled`));
      check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }

    // Fehler beim Speichern: bleibt aus, Meldung
    {
      const { ctx, p, ev, tap, wait, errors } = await open(lang, mobile);
      await p.evaluate(() => { window.__userDataFails = "boom"; });
      await tap("input[data-start-panel]");
      check(`[${tag}] Fehler: Meldung "${T.err}", Schalter bleibt aus und frei`, await wait(`return (r.querySelector('.opt-error[role="alert"]')?.textContent || "").trim() === ${JSON.stringify(T.err)}`) && (await ev(`const i = r.querySelector('input[data-start-panel]'); return !i.checked && !i.disabled`)));
      check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
