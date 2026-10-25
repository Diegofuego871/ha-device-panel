// Akzentfarbe (2.146.0): Einstellungen › Panel › Allgemein, "Home Assistant" plus acht Farben, gilt sofort und nur für den Benutzer
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
    check(`[${tag}] Kapitel "${L.ttl}": "${L.ha}" plus acht Farben`, names.length === 9 && names[0] === L.ha, names.join());
    check(`[${tag}] Standard: "${L.ha}" gewählt, keine eigene Farbe`, (await ev(`return r.querySelector('[data-accent=""]').classList.contains("on")`)) && (await accent()) === "|");

    await tap('[data-accent="teal"]');
    check(`[${tag}] Türkis: Farbe gesetzt, gilt sofort ohne Speichern`, (await accent()) === "#00acc1|#fff" && (await ev(`return r.querySelector('[data-accent="teal"]').getAttribute("aria-pressed") === "true" && !r.querySelector('[data-accent=""]').classList.contains("on")`)));
    const used = await ev(`const e = r.querySelector("dialog.settings .dlg-btn.primary"); return e ? getComputedStyle(e).backgroundColor : ""`);
    check(`[${tag}] Knopf "Speichern" in Türkis`, used === "rgb(0, 172, 193)", used);
    await tap('[data-accent="graphite"]');
    check(`[${tag}] Graphit: dunkle Schrift auf der Farbe`, (await accent()) === "#90a4ae|#10222b");
    await tap('[data-accent="orange"]');
    check(`[${tag}] Orange: dunkle Schrift, Statusfarben bleiben`, (await accent()) === "#fb8c00|#1f1300" && (await ev(`return getComputedStyle(r.host).getPropertyValue("--dp-error").trim() !== "" `)));
    await p.screenshot({ path: `${outDir}/accent-${lang}-${mobile ? "mobile" : "desktop"}.png` });
    await tap('[data-accent="teal"]');
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
    check(`[${tag}] zurück zu "${L.ha}": Farbe von HA`, (await accent()) === "|");
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join("|"));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
