// Akzentfarbe (2.146.0): Einstellungen › Panel › Allgemein, "Home Assistant" plus neun Farben, gilt sofort und nur für den Benutzer
// (Ansichts-Benutzerdaten und lokale Kopie), Schrift auf der Farbe, Rückkehr zu "Home Assistant", übersteht ein Neuladen.
// Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = { de: { ttl: "Akzentfarbe", ha: "Home Assistant", teal: "Türkis" }, en: { ttl: "Accent colour", ha: "Home Assistant", teal: "Teal" } };

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
    const accent = () => ev(`return [r.host.style.getPropertyValue("--dp-primary"), r.host.style.getPropertyValue("--dp-on-primary")].join("|")`);

    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="updates"]');
    await tap('[data-set="subtab"][data-group="panel"][data-key="pstart"]');
    await wait(`return !!r.querySelector("[data-accent]")`);
    const names = await ev(`return [...r.querySelectorAll("[data-accent]")].map((x) => x.textContent.trim())`);
    check(`[${tag}] Kapitel "${L.ttl}": "${L.ha}" plus neun Farben`, names.length === 10 && names[0] === L.ha, names.join());
    check(`[${tag}] Standard: "${L.ha}" gewählt, keine eigene Farbe`, (await ev(`return r.querySelector('[data-accent=""]').classList.contains("on")`)) && (await accent()) === "|");

    // Entwurf: die Wahl ändert nichts, bis "Speichern" gedrückt ist
    const save = async () => { await tap('dialog.settings [data-set="save"]'); await wait(`return r.host._settings && !r.host._settings.saving`); };
    await tap('[data-accent="teal"]');
    check(`[${tag}] Türkis gewählt: noch nichts geändert (Entwurf), Auswahl markiert, "Speichern" frei`, (await accent()) === "|" && (await ev(`const g = r.querySelector(".accent-grid"); return g.classList.contains("changed") && r.querySelector('[data-accent="teal"]').getAttribute("aria-pressed") === "true" && !r.querySelector('dialog.settings [data-set="save"]').disabled`)));
    const before = await ev(`return getComputedStyle(r.querySelector("dialog.settings .dlg-btn.primary")).backgroundColor`);
    check(`[${tag}] Knöpfe noch nicht in Türkis`, before !== "rgb(0, 172, 193)", before);
    await save();
    check(`[${tag}] nach "Speichern": Türkis gilt`, (await accent()) === "#00acc1|#fff");
    const used = await ev(`const e = r.querySelector("dialog.settings .dlg-btn.primary"); return e ? getComputedStyle(e).backgroundColor : ""`);
    check(`[${tag}] Knopf in Türkis`, used === "rgb(0, 172, 193)" || used !== before, used);
    for (const [id, want, label] of [["graphite", "#90a4ae|#10222b", "Graphit: dunkle Schrift auf der Farbe"], ["forest", "#2e8b57|#fff", "Tannengrün: dunkles Grün mit weisser Schrift"], ["orange", "#fb8c00|#1f1300", "Orange: dunkle Schrift"]]) {
      await tap(`[data-accent="${id}"]`);
      await save();
      check(`[${tag}] ${label}`, (await accent()) === want, await accent());
    }
    check(`[${tag}] Statusfarben bleiben`, await ev(`return getComputedStyle(r.host).getPropertyValue("--dp-error").trim() !== ""`));
    await p.screenshot({ path: `${outDir}/accent-${lang}-${mobile ? "mobile" : "desktop"}.png` });
    // Zurück auf die alte Wahl ohne Speichern: nichts mehr zu speichern; Schliessen verwirft den Entwurf
    await tap('[data-accent="red"]');
    await tap('[data-accent="orange"]');
    check(`[${tag}] Wahl zurück auf die gespeicherte Farbe: kein Entwurf mehr`, await ev(`return !r.querySelector(".accent-grid").classList.contains("changed")`));
    await tap('[data-accent="teal"]');
    await save();
    // Nur dieser Benutzer: in den Ansichts-Benutzerdaten (HA) und lokal
    await p.waitForTimeout(700);
    const saved = await p.evaluate(() => window.__userData?.device_panel_view?.accent ?? JSON.parse(localStorage.getItem("device_panel_view") || "{}").accent ?? null);
    check(`[${tag}] gespeichert beim Benutzer (accent=teal)`, saved === "teal", String(saved));

    // Neu laden: die Farbe bleibt
    f = await open();
    check(`[${tag}] nach dem Neuladen noch Türkis`, (await accent()) === "#00acc1|#fff");
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="updates"]');
    await tap('[data-set="subtab"][data-group="panel"][data-key="pstart"]');
    await wait(`return !!r.querySelector("[data-accent]")`);
    check(`[${tag}] Auswahl zeigt Türkis`, await ev(`return r.querySelector('[data-accent="teal"]').classList.contains("on")`));
    await tap('[data-accent=""]');
    check(`[${tag}] "${L.ha}" gewählt, aber noch nicht gespeichert: Türkis bleibt`, (await accent()) === "#00acc1|#fff");
    await tap('dialog.settings [data-set="save"]');
    await wait(`return r.host._settings && !r.host._settings.saving`);
    check(`[${tag}] nach "Speichern" zurück zu "${L.ha}": Farbe von HA`, (await accent()) === "|");
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join("|"));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
