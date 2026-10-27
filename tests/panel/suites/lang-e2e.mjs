// Sprache des Panels (2.157.0): Einstellungen › Panel › Allgemein, Auswahl "Automatisch / English / Deutsch" mit den Sprachnamen in der gerade
// gewählten Sprache; gilt nur für den Benutzer, erst mit "Speichern", sofort in der ganzen Oberfläche, übersteht ein Neuladen.
// Deutsch und Englisch als Sprache von Home Assistant, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const NAMES = { de: ["Automatisch", "Englisch", "Deutsch"], en: ["Automatic", "English", "German"] };
const TITLE = { de: "Geräte", en: "Devices" };

for (const ha of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `HA ${ha}/${mobile ? "mobile" : "desktop"}`;
    const other = ha === "de" ? "en" : "de";
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    const open = async () => {
      await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${ha}&theme=dark`);
      const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
      await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
      return f;
    };
    let f = await open();
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const title = () => ev(`return r.querySelector(".tb-main h1").textContent`);
    const opts = () => ev(`return [...r.querySelectorAll("select[data-lang-set] option")].map((o) => o.textContent)`);
    const pick = async (v) => { await ev(`const s = r.querySelector("select[data-lang-set]"); s.value = ${JSON.stringify(v)}; s.dispatchEvent(new Event("change", { bubbles: true }));`); };
    const save = async () => { await tap('dialog.settings [data-set="save"]'); await wait(`return r.host._settings && !r.host._settings.saving`); };

    check(`[${tag}] Standard: Titel in der Sprache von HA`, (await title()) === TITLE[ha], await title());
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="updates"]');
    await tap('[data-set="subtab"][data-group="panel"][data-key="pstart"]');
    await wait(`return !!r.querySelector("select[data-lang-set]")`);
    check(`[${tag}] Auswahl: Automatisch, Englisch, Deutsch (in ${ha})`, JSON.stringify(await opts()) === JSON.stringify(NAMES[ha]), (await opts()).join());
    check(`[${tag}] Standard "Automatisch" gewählt`, (await ev(`return r.querySelector("select[data-lang-set]").value`)) === "");

    // Entwurf: Sprachnamen wechseln mit, aber die Oberfläche bleibt bis "Speichern"
    await pick(other);
    await wait(`return r.querySelector("select[data-lang-set]").value === ${JSON.stringify(other)}`);
    check(`[${tag}] gewählt, noch nichts geändert (Entwurf), Namen in der gewählten Sprache`, (await title()) === TITLE[ha] && JSON.stringify(await opts()) === JSON.stringify(NAMES[other]), (await opts()).join());
    await save();
    check(`[${tag}] gespeichert: Titel in ${other}`, (await title()) === TITLE[other], await title());
    check(`[${tag}] Liste und Einstellungen in ${other}`, await wait(`return r.querySelector("dialog.settings .dlg-title h2")?.textContent.trim() === ${JSON.stringify(other === "de" ? "Einstellungen" : "Settings")}`));
    check(`[${tag}] Suchfeld in ${other}`, (await ev(`return r.querySelector(".search").placeholder === r.host._t("search") && r.host._lang() === ${JSON.stringify(other)}`)));
    await ev(`r.querySelector("dialog.settings").close()`);

    // Übersteht ein Neuladen (lokale Kopie und Benutzerdaten)
    f = await open();
    check(`[${tag}] nach Neuladen weiter in ${other}`, (await title()) === TITLE[other], await title());

    // Zurück auf Automatisch
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="updates"]');
    await tap('[data-set="subtab"][data-group="panel"][data-key="pstart"]');
    await wait(`return !!r.querySelector("select[data-lang-set]")`);
    await pick("");
    await save();
    check(`[${tag}] Automatisch: wieder die Sprache von HA`, (await title()) === TITLE[ha], await title());
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
