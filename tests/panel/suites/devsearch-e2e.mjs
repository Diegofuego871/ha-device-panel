// Suche in den Listen des Geräte-Popups (2.103.0): Reiter "Entitäten" und "Schalter" haben immer ein Suchfeld (seit 2.160.0, vorher ab 8 Einträgen) (Name, Entity-ID
// oder Zustand), mit X zum Leeren, Zähler "n von m" und Hinweis ohne Treffer. Der Suchtext bleibt beim Wechsel des Reiters und beim
// Neuaufbau des Popups; auch in einem Gerät mit wenigen Einträgen steht das Feld da, in beiden Reitern gleich. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { none: "Keine Treffer", of: (n, m) => `${n} von ${m}` },
  en: { none: "No matches", of: (n, m) => `${n} of ${m}` },
};
const EXTRA = [
  ...["Küche", "Bad", "Flur", "Keller", "Garten", "Büro", "Dach", "Balkon", "Terrasse"].map((n, i) => ({ entity_id: `switch.steckdose_${i}`, name: `Steckdose ${n}`, state: i % 2 ? "on" : "off", unit: "", category: null, liveness: false })),
  ...["Feuchte", "Druck", "Licht", "Lärm"].map((n, i) => ({ entity_id: `sensor.messung_${i}`, name: `Messwert ${n}`, state: String(10 + i), unit: "x", category: null, liveness: false })),
];

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=${mobile ? "dark" : "light"}`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => {
      for (let i = 0; ; i++) {
        try { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); return; }
        catch (err) { if (i >= 3 || !/not attached|detached|not stable/.test(String(err))) throw err; await new Promise((r) => setTimeout(r, 150)); }
      }
    };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 6000 }).then(() => true, () => false);
    const type = async (value) => { await ev(`const i = r.querySelector('dialog.device input[data-dlg="dev-search"]'); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new Event("input", { bubbles: true }))`); };
    const rows = () => ev(`return r.querySelectorAll("dialog.device ul.entities > li.entity").length`);
    const cells = () => ev(`return r.querySelectorAll("dialog.device .sw-grid .sw-cell").length`);
    const openDev = async (id) => {
      await ev(`r.host._openDevice(${JSON.stringify(id)})`);
      await wait(`return r.querySelector("dialog.device")?.open && !!r.querySelector("dialog.device .dev-tabs .sub-tab") && !r.querySelector("dialog.device .dlg-body .dlg-note")?.textContent.includes("…")`);
      await p.waitForTimeout(400);
    };
    await p.evaluate((extra) => { window.__detailExtra = { d: extra }; }, EXTRA);

    // --- Entitäten ---
    await openDev("d");
    await tap('dialog.device .dev-tabs [data-tab="ent"]');
    await wait(`return !!r.querySelector("dialog.device ul.entities")`);
    const total = await rows();
    check(`[${tag}] Entitäten: Suchfeld über der Liste (${total} Einträge), Lupe, kein Zähler`, total >= 8 && (await ev(`const l = r.querySelector("dialog.device label.list-search"); return !!l && !!l.querySelector("svg") && l.querySelector(".n").textContent === "" && l.querySelector("[data-fc]").hidden === true && !!r.querySelector('dialog.device [data-dev-zone="ent"] ul.entities')`)));
    await type("messwert");
    check(`[${tag}] "messwert": nur die vier Messwerte, Zähler "${T.of(4, total)}", X sichtbar`, await wait(`return r.querySelectorAll("dialog.device ul.entities > li.entity").length === 4 && r.querySelector("dialog.device label.list-search .n").textContent === ${JSON.stringify(T.of(4, total))} && r.querySelector("dialog.device label.list-search [data-fc]").hidden === false`), await rows());
    await type("sensor.messung_2");
    check(`[${tag}] Entity-ID gefunden (ein Treffer)`, await wait(`return r.querySelectorAll("dialog.device ul.entities > li.entity").length === 1`));
    await type("zzzz");
    check(`[${tag}] Ohne Treffer: "${T.none}", Zähler "${T.of(0, total)}"`, await wait(`return !r.querySelector('dialog.device [data-dev-zone="ent"] ul.entities') && r.querySelector('dialog.device [data-dev-zone="ent"]').textContent.includes(${JSON.stringify(T.none)}) && r.querySelector("dialog.device label.list-search .n").textContent === ${JSON.stringify(T.of(0, total))}`));
    await type("MESSWERT");
    check(`[${tag}] Gross-/Kleinschreibung egal`, await wait(`return r.querySelectorAll("dialog.device ul.entities > li.entity").length === 4`));
    // bleibt über Reiterwechsel und Neuaufbau
    await ev(`r.querySelector('dialog.device input[data-dlg="dev-search"]').blur()`);
    await tap('dialog.device .dev-tabs [data-tab="sw"]');
    await wait(`return !!r.querySelector("dialog.device .sw-grid")`);
    await tap('dialog.device .dev-tabs [data-tab="ent"]');
    check(`[${tag}] Suchtext bleibt beim Reiterwechsel (Feld und Liste)`, await wait(`return r.querySelector('dialog.device input[data-dlg="dev-search"]').value === "MESSWERT" && r.querySelectorAll("dialog.device ul.entities > li.entity").length === 4`));
    await ev(`r.host._devForce = true; r.host._renderDevice(true)`);
    await p.waitForTimeout(300);
    check(`[${tag}] Suchtext bleibt beim Neuaufbau des Popups`, (await rows()) === 4 && (await ev(`return r.querySelector('dialog.device input[data-dlg="dev-search"]').value`)) === "MESSWERT");
    // X leert, Fokus bleibt im Feld
    await tap("dialog.device label.list-search [data-fc]");
    check(`[${tag}] X leert: alle Einträge, Feld leer, X weg, Zähler leer`, await wait(`const l = r.querySelector("dialog.device label.list-search"); return r.querySelectorAll("dialog.device ul.entities > li.entity").length === ${total} && l.querySelector("input").value === "" && l.querySelector("[data-fc]").hidden === true && l.querySelector(".n").textContent === ""`));
    await p.screenshot({ path: `${outDir}/devsearch-${tag.replace("/", "-")}-ent.png` });

    // --- Schalter ---
    await tap('dialog.device .dev-tabs [data-tab="sw"]');
    await wait(`return !!r.querySelector("dialog.device .sw-grid")`);
    const sw = await cells();
    check(`[${tag}] Schalter: Suchfeld über den Kacheln (${sw} Stück)`, sw >= 8 && !!(await handle('dialog.device [data-dev-zone="sw"] .sw-grid')) && !!(await handle('dialog.device input[data-dlg="dev-search"][data-key="sw"]')));
    await type("küche");
    check(`[${tag}] "küche": eine Kachel, Zähler "${T.of(1, sw)}"`, await wait(`return r.querySelectorAll("dialog.device .sw-grid .sw-cell").length === 1 && r.querySelector("dialog.device label.list-search .n").textContent === ${JSON.stringify(T.of(1, sw))}`));
    await type("on");
    check(`[${tag}] Suche im Zustand ("on"): nur eingeschaltete`, await wait(`const c = [...r.querySelectorAll("dialog.device .sw-grid .sw-cell")]; return c.length > 0 && c.every((x) => x.classList.contains("on"))`), await cells());
    await type("zzzz");
    check(`[${tag}] Ohne Treffer: "${T.none}"`, await wait(`return !r.querySelector("dialog.device .sw-grid") && r.querySelector('dialog.device [data-dev-zone="sw"]').textContent.includes(${JSON.stringify(T.none)})`));
    await tap("dialog.device label.list-search [data-fc]");
    check(`[${tag}] X leert: alle Kacheln wieder da`, await wait(`return r.querySelectorAll("dialog.device .sw-grid .sw-cell").length === ${sw}`));
    // Der Suchtext der Entitäten ist unabhängig
    await tap('dialog.device .dev-tabs [data-tab="ent"]');
    check(`[${tag}] Reiter getrennt: Entitäten-Feld leer`, await wait(`return r.querySelector('dialog.device input[data-dlg="dev-search"]').value === ""`));
    await tap("dialog.device .dlg-close");
    await wait(`return !r.querySelector("dialog.device").open`);
    // anderes Gerät: Suchtext zurückgesetzt, wenige Einträge: Feld bleibt
    await openDev("h");
    await tap('dialog.device .dev-tabs [data-tab="ent"]');
    await wait(`return !!r.querySelector("dialog.device ul.entities")`);
    check(`[${tag}] Gerät mit wenigen Entitäten (${await rows()}): Suchfeld trotzdem da, leer`, (await rows()) < 8 && (await ev(`const i = r.querySelector("dialog.device label.list-search input"); return !!i && i.value === ""`)));
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
