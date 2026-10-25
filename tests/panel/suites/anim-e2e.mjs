// Animationen ein-/ausschalten (2.151.0): Einstellungen › Panel › Allgemein, Standard an, Entwurf bis "Speichern", gilt nur für den Benutzer
// (Ansichts-Benutzerdaten und lokale Kopie), betrifft Messpunkt des Ausfall-Pulses und Sternschnuppe am Punkt, übersteht ein Neuladen.
// Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = { de: { ttl: "Animationen", opt: "Animationen anzeigen" }, en: { ttl: "Animations", opt: "Show animations" } };

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const L = T[lang];
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    const open = async () => {
      await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
      const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
      await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
      return f;
    };
    let f = await open();
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const state = async () => { await ev(`r.host._debugOn = true; r.host._apps.paintDots()`); await wait(`return r.querySelector(".apps-btn").classList.contains("has-dot")`); return ev(`const d = r.querySelector(".pchart .pdot"); const b = r.querySelector(".apps-btn"); return { attr: r.host.getAttribute("data-anim"), dot: d ? getComputedStyle(d).display : "fehlt", comet: b ? getComputedStyle(b, "::before").animationName : "fehlt" }`); };
    const save = async () => { await tap('dialog.settings [data-set="save"]'); await wait(`return r.host._settings && !r.host._settings.saving`); };
    const openSettings = async () => {
      await tap(".gear-btn");
      await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
      await tap('[data-set="section"][data-id="updates"]');
      await tap('[data-set="subtab"][data-group="panel"][data-key="pstart"]');
      await wait(`return !!r.querySelector("[data-anim-set]")`);
    };

    // Standard: an; Debug-Modus gibt dem Launcher-Knopf einen Punkt (Sternschnuppe)
    await ev(`r.host._debugOn = true; r.host._apps.paintDots()`);
    await wait(`return r.querySelector(".apps-btn").classList.contains("has-dot")`);
    let s = await state();
    check(`[${tag}] Standard: Animationen an (Messpunkt da, Sternschnuppe läuft)`, s.attr === null && s.dot !== "none" && s.comet === "dp-comet", JSON.stringify(s));
    await openSettings();
    check(`[${tag}] Kapitel "${L.ttl}" mit Schalter "${L.opt}", Standard an`, (await ev(`return r.querySelector("[data-anim-set]").checked && r.querySelector("dialog.settings").textContent.includes(${JSON.stringify(L.ttl)}) && r.querySelector("dialog.settings").textContent.includes(${JSON.stringify(L.opt)})`)));

    // Entwurf: nichts ändert sich bis "Speichern"
    await tap("[data-anim-set]");
    s = await state();
    check(`[${tag}] ausgeschaltet, noch nicht gespeichert: Animationen laufen weiter, Zeile markiert`, s.attr === null && s.comet === "dp-comet" && (await ev(`return !!r.querySelector("[data-anim-set]").closest(".opt.changed")`)), JSON.stringify(s));
    await save();
    s = await state();
    check(`[${tag}] nach "Speichern": Messpunkt weg, Sternschnuppe steht`, s.attr === "off" && s.dot === "none" && s.comet === "none", JSON.stringify(s));
    await ev(`r.host._debugOn = true; r.host._apps.paintDots()`);
    const dotAfter = await ev(`const a = getComputedStyle(r.querySelector(".apps-btn"), "::after"); return a.animationName`);
    check(`[${tag}] auch der Punkt selbst steht still`, dotAfter === "none", dotAfter);
    await p.waitForTimeout(700);
    const saved = await p.evaluate(() => window.__userData?.device_panel_view?.anim ?? JSON.parse(localStorage.getItem("device_panel_view") || "{}").anim ?? null);
    check(`[${tag}] gespeichert beim Benutzer (anim=false)`, saved === false, String(saved));

    // Neu laden: bleibt aus
    f = await open();
    await ev(`r.host._debugOn = true; r.host._apps.paintDots()`);
    s = await state();
    check(`[${tag}] nach dem Neuladen noch aus`, s.attr === "off" && s.dot === "none", JSON.stringify(s));
    await openSettings();
    check(`[${tag}] Schalter zeigt aus`, await ev(`return !r.querySelector("[data-anim-set]").checked`));
    await tap("[data-anim-set]");
    await save();
    await wait(`return r.host.getAttribute("data-anim") === null`);
    await ev(`r.host._debugOn = true; r.host._apps.paintDots()`);
    s = await state();
    check(`[${tag}] wieder an: Messpunkt und Sternschnuppe laufen`, s.attr === null && s.dot !== "none" && s.comet === "dp-comet", JSON.stringify(s));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join("|"));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
