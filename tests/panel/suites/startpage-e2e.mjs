// Startseite (2.39.0, Wunsch des Nutzers; 2.39.1: gilt wie alles andere erst mit "Speichern"; seit 2.87.0 im Abschnitt "Panel", Unterreiter
// "Standardseite"): Bereich "Startseite" mit dem Schalter "Als meine Startseite festlegen" und dem Hinweis "Gilt nur für dich". Die Wahl ist ein Entwurf (Etikett
// "geändert", Zähler, "Speichern", Rückfrage beim Schliessen) und wird erst beim Speichern als default_panel ("device-panel") in die Benutzerdaten
// "core" von Home Assistant geschrieben (frontend/set_user_data), ohne die übrigen Werte zu verlieren. Beim Einschalten merkt sich das Panel die
// bisherige Startseite und stellt sie beim Ausschalten wieder her; ohne bisherige fällt der Eintrag weg (Vorgabe von HA). Fehler beim Speichern
// erscheinen wie bei den anderen Einstellungen. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { sec: "Panel", title: "Startseite", label: "Als meine Startseite festlegen", note: "Gilt nur für dich, nicht für andere Benutzer.", sum: "Deine Startseite" },
  en: { sec: "Panel", title: "Start page", label: "Set as my start page", note: "Applies only to you, not to other users.", sum: "Your start page" },
};

async function open(lang, mobile, seed = null) {
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1400, height: 1000 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  if (seed) await p.addInitScript((v) => { if (!sessionStorage.getItem("sim_user_data")) sessionStorage.setItem("sim_user_data", v); }, JSON.stringify(seed.core ? seed : { core: seed }));
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
  const userData = (key) => p.evaluate((k) => JSON.parse(sessionStorage.getItem("sim_user_data") || "{}")[k] ?? {}, key);
  await tap(".gear-btn");
  await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
  await tap('[data-set="section"][data-id="updates"]');
  await tap('[data-set="subtab"][data-group="panel"][data-key="pstart"]');
  await wait(`return !!r.querySelector('input[data-start-panel]')`);
  return { ctx, p, ev, tap, wait, errors, userData };
}

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;

    // Name des Abschnitts, Reihenfolge: Hinweis, Bereich "Startseite", Schalter
    {
      const { ctx, p, ev, tap, wait, errors, userData } = await open(lang, mobile, { core: { other: 1, default_panel: "lovelace" } });
      check(`[${tag}] Abschnitt heisst "${T.sec}"`, (await ev(`return r.querySelector('[data-id="updates"] .set-sec-title').textContent.trim()`)) === T.sec);
      const order = await ev(`const body = r.querySelector('[data-id="updates"]').parentElement; const items = [...body.querySelectorAll(".nf-note, .set-title, input[data-start-panel]")]; return items.map((e) => e.matches("input") ? "switch" : e.textContent.trim())`);
      check(`[${tag}] ganz oben: Hinweis "${T.note}", dann "${T.title}", dann der Schalter`, order[0] === T.note && order[1] === T.title && order[2] === "switch", JSON.stringify(order));
      check(`[${tag}] Schalter "${T.label}": aus (HA hat eine andere Startseite), frei, nichts zu speichern`, await ev(`const i = r.querySelector('input[data-start-panel]'); return !i.checked && !i.disabled && i.getAttribute("aria-label") === ${JSON.stringify(T.label)} && r.querySelector('[data-set="save"]').disabled`));
      await tap("input[data-start-panel]");
      check(`[${tag}] eingeschaltet: Entwurf (Etikett "geändert", Zähler, "Speichern" frei), noch nichts in den Benutzerdaten`, await wait(`const i = r.querySelector('input[data-start-panel]'); return i.checked && i.closest(".opt").classList.contains("changed") && !r.querySelector('[data-set="save"]').disabled && /^1 /.test(r.querySelector(".set-count")?.textContent || "")`) && (await userData("core")).default_panel === "lovelace", JSON.stringify(await userData("core")));
      check(`[${tag}] Zusammenfassung des Abschnitts nennt "${T.sum}"`, (await ev(`return r.querySelector('[data-id="updates"] .set-sec-sum').textContent`)).includes(T.sum));
      await tap('[data-set="save"]');
      check(`[${tag}] gespeichert: default_panel = device-panel, übrige Werte bleiben, bisherige Startseite gemerkt`, await wait(`return r.querySelector('[data-set="save"]').disabled && !r.querySelector('input[data-start-panel]').closest(".opt").classList.contains("changed")`) && JSON.stringify(await userData("core")) === JSON.stringify({ other: 1, default_panel: "device-panel" }) && JSON.stringify(await userData("device_panel_start")) === JSON.stringify({ previous: "lovelace" }), JSON.stringify([await userData("core"), await userData("device_panel_start")]));
      await tap("input[data-start-panel]");
      check(`[${tag}] ausgeschaltet: wieder ein Entwurf, bis zum Speichern bleibt die Startseite`, await wait(`return !r.querySelector('input[data-start-panel]').checked && !r.querySelector('[data-set="save"]').disabled`) && (await userData("core")).default_panel === "device-panel");
      await tap('[data-set="save"]');
      check(`[${tag}] gespeichert: die bisherige Startseite "lovelace" ist zurück, übrige Werte bleiben, Merkzettel leer`, await wait(`return r.querySelector('[data-set="save"]').disabled`) && JSON.stringify(await userData("core")) === JSON.stringify({ other: 1, default_panel: "lovelace" }) && !(await userData("device_panel_start")).previous, JSON.stringify([await userData("core"), await userData("device_panel_start")]));
      await p.evaluate(() => { window.__wsCalls = []; });
      check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }

    // Ohne bisherige Startseite: Ausschalten entfernt den Eintrag (Vorgabe von HA)
    {
      const { ctx, tap, wait, errors, userData } = await open(lang, mobile);
      await tap("input[data-start-panel]");
      await tap('[data-set="save"]');
      await wait(`return r.querySelector('[data-set="save"]').disabled`);
      check(`[${tag}] ohne bisherige Startseite: eingeschaltet und gespeichert`, (await userData("core")).default_panel === "device-panel" && !(await userData("device_panel_start")).previous, JSON.stringify(await userData("core")));
      await tap("input[data-start-panel]");
      await tap('[data-set="save"]');
      check(`[${tag}] ausgeschaltet und gespeichert: default_panel entfernt (Vorgabe von HA)`, await wait(`return r.querySelector('[data-set="save"]').disabled`) && !("default_panel" in (await userData("core"))), JSON.stringify(await userData("core")));
      check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }

    // Beim Öffnen steht der Schalter schon an, wenn dieses Panel die Startseite ist; Schliessen ohne Speichern verwirft den Entwurf
    {
      const { ctx, ev, tap, wait, errors, userData } = await open(lang, mobile, { core: { default_panel: "device-panel" } });
      check(`[${tag}] ist das Panel schon die Startseite: Schalter an, nichts zu speichern`, await ev(`const i = r.querySelector('input[data-start-panel]'); return i.checked && !i.disabled && r.querySelector('[data-set="save"]').disabled`));
      await tap("input[data-start-panel]");
      await wait(`return !r.querySelector('input[data-start-panel]').checked`);
      await tap('dialog.settings .dlg-actions [data-set="close"]');
      check(`[${tag}] Schliessen mit Entwurf fragt nach ("Änderungen verwerfen?"), die Startseite bleibt unverändert`, await wait(`return !!r.querySelector("dialog.discard-dlg[open] [data-dd='yes']")`) && (await userData("core")).default_panel === "device-panel");
      await tap("dialog.discard-dlg [data-dd='yes']");
      check(`[${tag}] verworfen: Einstellungen zu, Startseite unverändert`, await wait(`return !r.querySelector("dialog.settings").open`) && (await userData("core")).default_panel === "device-panel");
      check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }

    // Fehler beim Speichern: Meldung wie bei den anderen Einstellungen, der Entwurf bleibt
    {
      const { ctx, p, ev, tap, wait, errors, userData } = await open(lang, mobile);
      await tap("input[data-start-panel]");
      await p.evaluate(() => { window.__userDataFails = "boom"; });
      await tap('[data-set="save"]');
      check(`[${tag}] Fehler beim Speichern: Meldung "boom", der Entwurf bleibt, nichts geschrieben`, await wait(`return (r.querySelector("dialog.settings")?.textContent || "").includes("boom")`) && (await ev(`return r.querySelector('input[data-start-panel]').checked`)) && !(await userData("core"))?.default_panel, JSON.stringify(await userData("core")));
      check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
