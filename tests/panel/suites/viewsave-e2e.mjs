// Ansicht mit "Speichern" (2.87.0, docs/mockups/view-v3): Der Dialog "Ansicht" hat zwei Reiter, "Spalten" (Handy "Sortierung", pro Benutzer)
// und "Filter-Chips" (für alle, nur Administratoren). Beide ändern nur einen Entwurf; "Speichern" schreibt die Chips an die Optionen und die
// Ansicht in die Benutzerdaten, Schliessen mit Entwurf fragt nach. Ohne Administratorrecht gibt es nur den Reiter "Spalten" und keine
// Optionen werden geladen. Der Abschnitt "Panel" der Einstellungen hat die Unterreiter "Standardseite" und "Updates". Alle Speichern-Knöpfe
// tragen das Disketten-Symbol. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { cols: "Spalten", sort: "Sortierung", chips: "Filter-Chips", global: "Gilt für alle Benutzer, nur Administratoren sehen diesen Reiter.", panel: "Panel", start: "Standardseite", upd: "Updates", two: "2 Änderungen" },
  en: { cols: "Columns", sort: "Sorting", chips: "Filter chips", global: "Applies to all users; only administrators see this tab.", panel: "Panel", start: "Default page", upd: "Updates", two: "2 changes" },
};

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1400, height: 1000 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const calls = (type) => p.evaluate((t) => window.__wsCalls.filter((m) => m.type === t), type);
    const userView = () => p.evaluate(() => JSON.parse(sessionStorage.getItem("sim_user_data") || "{}").device_panel_view);
    const entry = mobile ? "[data-view-open]" : ".view-btn";
    const D = "dialog.settings";

    // Symbol "Auge mit Zahnrad" am Einstieg (Handy in der Zeile, Desktop im Knopf)
    check(`[${tag}] Einstieg mit dem Symbol "Auge mit Zahnrad" (Maske)`, await ev(`return r.querySelector(${JSON.stringify(entry + " svg")}).innerHTML.includes("mask")`));

    // Administrator: zwei Reiter, Optionen werden geladen
    await tap(entry);
    await wait(`return !!r.querySelector("${D} .sub-tab")`);
    check(`[${tag}] zwei Reiter: "${mobile ? T.sort : T.cols}" und "${T.chips}"`, (await ev(`return [...r.querySelectorAll("${D} .sub-tabs .sub-tab")].map((t) => t.textContent.trim()).join("|")`)) === `${mobile ? T.sort : T.cols}|${T.chips}`);
    check(`[${tag}] "Spalten" gewählt, Optionen geladen`, (await ev(`return r.querySelector('${D} .sub-tab.on').dataset.key`)) === "cols" && (await wait(`return !!r.host._settings?.data`)) && (await calls("device_panel/get_options")).length >= 1);

    // Entwurf in beiden Reitern
    await tap(`${D} [data-vtoggle="${mobile ? "fields" : "cols"}"][data-key="area"]`);
    await tap(`${D} [data-set="vtab"][data-key="chips"]`);
    await wait(`return !!r.querySelector('${D} input[data-list="hide_chips"]')`);
    check(`[${tag}] Reiter "${T.chips}": Hinweis "gilt für alle"`, (await text(`${D} .view-own`)) === T.global, await text(`${D} .view-own`));
    await tap(`${D} input[data-list="hide_chips"][data-value="area"]`);
    check(`[${tag}] zwei Änderungen (Ansicht und Chips), beide Reiter markiert`, (await text(`${D} .set-count`)) === T.two && (await ev(`return [...r.querySelectorAll("${D} .sub-tab")].every((t) => t.classList.contains("chg"))`)), await text(`${D} .set-count`));
    check(`[${tag}] noch nichts gespeichert (Optionen, Benutzerdaten)`, (await calls("device_panel/set_options")).length === 0 && !(await userView()));
    check(`[${tag}] "Speichern" mit Disketten-Symbol, aktiv`, await ev(`const b = r.querySelector('${D} [data-set="save"]'); return !b.disabled && !!b.querySelector("svg")`));
    await tap(`${D} [data-set="save"]`);
    check(`[${tag}] gespeichert: Optionen und Ansicht, Dialog bleibt offen`, (await wait(`return r.querySelector("${D} .set-count.saved")`)) && (await calls("device_panel/set_options")).length === 1 && (await calls("device_panel/set_options"))[0].values.hide_chips.includes("area"));
    for (let i = 0; i < 20 && !(await userView()); i++) await p.waitForTimeout(100);
    check(`[${tag}] Ansicht in den Benutzerdaten`, Boolean(await userView()));

    // Entwurf verwerfen: Kreuz fragt nach, Ansicht kehrt zurück
    await tap(`${D} [data-set="vtab"][data-key="${"cols"}"]`);
    const key = mobile ? "fields" : "cols";
    const was = await ev(`return JSON.stringify(r.host._view.${key})`);
    await tap(`${D} [data-vtoggle="${key}"][data-key="area"]`);
    await tap(`${D} .dlg-close`);
    check(`[${tag}] Kreuz mit Entwurf fragt nach`, await wait(`return !!r.querySelector("dialog.discard-dlg[open] [data-dd='yes']")`));
    await tap("dialog.discard-dlg [data-dd='yes']");
    check(`[${tag}] verworfen: Dialog zu, Ansicht wie gespeichert`, (await wait(`return !r.querySelector("${D}").open`)) && (await ev(`return JSON.stringify(r.host._view.${key})`)) === was);

    // Einstellungen: Abschnitt "Panel" mit zwei Unterreitern, kein Abschnitt "Ansicht" mehr
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("${D} .set-sec")`);
    check(`[${tag}] Abschnitt "${T.panel}", kein Abschnitt "Ansicht"`, (await text('[data-id="updates"] .set-sec-title')) === T.panel && !(await ev(`return !!r.querySelector('[data-id="look"]')`)));
    await tap('[data-set="section"][data-id="updates"]');
    check(`[${tag}] Unterreiter "${T.start}" und "${T.upd}", Updates gewählt mit Versionszeile`, (await ev(`return [...r.querySelectorAll('${D} .sub-tab[data-group="panel"]')].map((t) => t.firstChild.textContent.trim()).join("|")`)) === `${T.start}|${T.upd}` && (await ev(`return r.querySelector('${D} .sub-tab.on[data-group="panel"]').dataset.key`)) === "pupdates" && (await ev(`return !!r.querySelector("${D} .ver-slot")`)));
    await tap(`${D} .sub-tab[data-key="pstart"]`);
    check(`[${tag}] "${T.start}": Schalter für die Startseite, keine Versionszeile`, (await ev(`return !!r.querySelector("${D} input[data-start-panel]") && !r.querySelector("${D} .ver-slot")`)));
    await tap(`${D} .dlg-actions [data-set="close"]`);
    await wait(`return !r.querySelector("${D}").open`);

    // Ohne Administratorrecht: nur "Spalten", keine Optionen geladen
    await p.evaluate(() => { window.__wsCalls = []; document.querySelector("home-assistant").hass.user = { is_admin: false }; window.__pushHass(); });
    await tap(entry);
    await wait(`return r.querySelector("${D}").open`);
    check(`[${tag}] kein Administrator: kein Reiter "${T.chips}", keine Optionen geladen`, !(await ev(`return !!r.querySelector("${D} .sub-tab")`)) && (await calls("device_panel/get_options")).length === 0);
    await tap(`${D} [data-vtoggle="${key}"][data-key="area"]`);
    await tap(`${D} [data-set="save"]`);
    check(`[${tag}] kein Administrator: Speichern der Ansicht geht, keine Optionen geschrieben`, (await wait(`return r.querySelector("${D} .set-count.saved")`)) && (await calls("device_panel/set_options")).length === 0);
    await tap(`${D} .dlg-actions [data-set="close"]`);
    check(`[${tag}] kein fehlender Text, keine JS-Fehler`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)) && errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
