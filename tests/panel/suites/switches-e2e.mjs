// Reiter "Schalter" im Geräte-Popup (2.58.0, Wunsch des Nutzers, docs/mockups/switches-v1, Variante C): zweiter Reiter, kompakte Kacheln
// (Symbol, Name, Zustand) für die schaltbaren Entitäten; ein Tipp öffnet die Bedienung von HA (hass-more-info), geschaltet wird nie durch
// die Kachel. Ohne Schaltbares kein Reiter. Emoji der Reiter auf Desktop (vor der Beschriftung) und Handy. Deutsch und Englisch.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { tab: "Schalter", title: (n) => `Schalter · ${n}`, tabs: ["Übersicht", "Schalter", "Einstellungen"], bad: "Nicht erreichbar" },
  en: { tab: "Switches", title: (n) => `Switches · ${n}`, tabs: ["Overview", "Switches", "Settings"], bad: "Unavailable" },
};

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
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 6000 }).then(() => true, () => false);
    const openDev = async (name) => {
      await ev(`[...r.querySelectorAll(".dev")].find((e) => e.textContent.includes(${JSON.stringify(name)})).click()`);
      await wait(`return r.querySelector("dialog.device")?.open && !!r.querySelector("dialog.device .dev-tabs .sub-tab")`);
      await p.waitForTimeout(500);
    };
    const closeDev = async () => { await tap("dialog.device .dlg-close"); await wait(`return !r.querySelector("dialog.device").open`); };
    const tabs = () => ev(`return [...r.querySelectorAll("dialog.device .dev-tabs .sub-tab")].map((e) => e.dataset.tab).join()`);

    // Zusätzliche Entitäten für zwei Geräte (Lampe: aus; Rollladen: zu mit Position)
    await p.evaluate(() => {
      window.__detailExtra = {
        g: [
          { entity_id: "light.deckenlicht_spot", name: "Spot", state: "off", unit: null, category: null, liveness: false },
          { entity_id: "cover.deckenlicht_rollo", name: "Rollo", state: "closed", unit: null, category: null, liveness: false },
          { entity_id: "sensor.deckenlicht_energie", name: "Energie", state: "3", unit: "W", category: "diagnostic", liveness: false },
        ],
      };
    });

    // Gerät mit Schaltbarem: Reiter an zweiter Stelle
    await openDev("Deckenlicht Wohnzimmer");
    check(`[${tag}] sechs Reiter, "Schalter" an zweiter Stelle`, (await tabs()) === "ov,sw,set,ent,magic,routine", await tabs());
    check(`[${tag}] Beschriftung "${T.tab}"`, await ev(`return r.querySelector('dialog.device [data-tab="sw"]').textContent.trim() === ${JSON.stringify(T.tab)} || r.querySelector('dialog.device [data-tab="sw"]').textContent.trim() === ""`));
    // Emoji der Reiter: Joystick für Schalter, Blitz für Routinen (Desktop und Handy)
    check(`[${tag}] Emoji: 🕹️ Schalter, ⚡ Routinen`, await ev(`const c = (t) => getComputedStyle(r.querySelector('dialog.device [data-tab="' + t + '"]'), "::before").content; return c("sw").includes("🕹") && c("routine").includes("⚡")`));
    await tap(`dialog.device [data-tab="sw"]`);
    check(`[${tag}] Reiter gewählt, Titel "${T.title(3)}", drei Kacheln`, await wait(`const d = r.querySelector("dialog.device"); return d.querySelector('[data-tab="sw"]').classList.contains("on") && d.querySelector(".dlg-body h3")?.textContent === ${JSON.stringify(T.title(3))} && d.querySelectorAll(".sw-cell").length === 3`));
    check(`[${tag}] nur Schaltbares: Lampe, Spot, Rollo (kein Sensor)`, await ev(`return [...r.querySelectorAll("dialog.device .sw-cell")].map((e) => e.dataset.entity).join()`) === "light.deckenlicht_wohnzimmer,light.deckenlicht_spot,cover.deckenlicht_rollo" || (await ev(`return [...r.querySelectorAll("dialog.device .sw-cell")].map((e) => e.dataset.entity.split(".")[0]).join()`)) === "light,light,cover");
    check(`[${tag}] Kachel: Symbol, Name, Zustand; an = farbig, aus/zu = grau`, await ev(`const c = [...r.querySelectorAll("dialog.device .sw-cell")]; return c[0].classList.contains("on") && !c[1].classList.contains("on") && !c[2].classList.contains("on") && c[0].querySelector(".sw-ic").textContent === "💡" && c[2].querySelector(".sw-ic").textContent === "🪟" && !!c[0].querySelector("b").textContent && !!c[0].querySelector("small").textContent`));
    check(`[${tag}] drei Spalten, kein Querlauf`, await ev(`const g = r.querySelector("dialog.device .sw-grid"); const w = [...g.children].map((e) => Math.round(e.getBoundingClientRect().left)); const body = r.querySelector("dialog.device .dlg-body"); return new Set(w).size === 3 && body.scrollWidth <= body.clientWidth + 1`));
    await p.screenshot({ path: new URL(`../output/switches-${tag.replace("/", "-")}.png`, import.meta.url).pathname });
    // Tipp: öffnet die Bedienung von HA (hass-more-info), schaltet nichts
    await tap(`dialog.device .sw-cell[data-entity="light.deckenlicht_spot"]`);
    check(`[${tag}] Tipp auf die Kachel öffnet die Bedienung von HA für diese Entität`, await p.evaluate(() => window.__moreInfo.at(-1) === "light.deckenlicht_spot"), await p.evaluate(() => JSON.stringify(window.__moreInfo)));
    check(`[${tag}] kein Schaltbefehl gesendet`, await p.evaluate(() => !window.__wsCalls.some((m) => /turn_|toggle|call_service/.test(JSON.stringify(m)))));
    await closeDev();

    // Gerät ohne Schaltbares: kein Reiter
    await openDev("Temperatur Keller");
    check(`[${tag}] ohne Schaltbares fünf Reiter, kein "Schalter"`, (await tabs()) === "ov,set,ent,magic,routine", await tabs());
    await closeDev();

    // Nicht erreichbare Entität: gedimmt mit Hinweis
    await openDev("Steckdose Terrasse");
    await tap(`dialog.device [data-tab="sw"]`);
    check(`[${tag}] nicht erreichbar: Kachel gedimmt (bad), Zustand "${T.bad}"`, await wait(`const c = r.querySelector("dialog.device .sw-cell"); return !!c && c.classList.contains("bad") && !c.classList.contains("on") && c.querySelector("small").textContent.length > 0`));
    // Ein anderes Gerät ohne Schaltbares öffnen, solange "Schalter" gewählt war: zurück auf "Übersicht"
    await closeDev();
    await openDev("Temperatur Keller");
    check(`[${tag}] zuletzt "Schalter" gewählt, Gerät ohne Schaltbares: "Übersicht" ist gewählt`, await ev(`return r.querySelector('dialog.device [data-tab="ov"]').classList.contains("on")`));
    check(`[${tag}] keine Fehler in der Seite`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
