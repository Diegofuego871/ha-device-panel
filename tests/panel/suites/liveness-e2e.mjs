// Lebenszeichen ausschliessen (2.165.0): im Reiter "Entitäten" des Geräte-Popups ist die Marke "Lebenszeichen" ein Schalter. Eine ausgeschlossene
// Entität zählt nicht (zum Beispiel ein selbst angelegter Template-Helfer, der immer verfügbar ist); die Wahl ist ein Entwurf wie die übrigen
// Einstellungen und gilt nach "Speichern". Sind alle ausgeschlossen, gilt die Wahl nicht, das Popup sagt es. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { live: "Lebenszeichen", off: "kein Lebenszeichen", tpl: /Template-Helfern/, ignored: /alle Lebenszeichen ausgeschlossen/ },
  en: { live: "Sign of life", off: "no sign of life", tpl: /template helpers/, ignored: /All signs of life are excluded/ },
};
const helper = (n) => ({ entity_id: `sensor.helfer_${n}`, name: `Helfer ${n}`, state: "1.0", unit: null, category: null, liveness: true, platform: "template" });

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const L = T[lang];
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const errors = [];
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => {
      for (let n = 1; ; n++) {
        const h = await handle(sel);
        if (!h) throw new Error("fehlt: " + sel);
        try { await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); return; } catch (err) { if (n >= 3 || !/not attached|not stable/.test(String(err))) throw err; await p.waitForTimeout(200); }
      }
    };
    const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
    const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.innerText || "").replace(/\\s+/g," ").trim()`);
    const calls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_device_settings"));

    await p.evaluate((h) => { window.__detailExtra = { a: h }; }, [helper(1), helper(2), helper(3)]);
    await ev(`r.host._openDevice("a")`);
    await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device .dev-tabs [data-tab="ent"]')`);
    await tap('dialog.device .dev-tabs [data-tab="ent"]');
    await wait(`return r.querySelectorAll("dialog.device .entity").length >= 4`);
    const marks = () => ev(`return [...r.querySelectorAll("dialog.device .entity")].map((x) => [x.querySelector(".ent-name small")?.textContent, x.querySelector(".pill.live")?.innerText.trim() || ""])`);

    check(`[${tag}] Marke "${L.live}" an Gerät und Helfern, ein Schalter (Knopf)`, (await ev(`return r.querySelectorAll('dialog.device button.pill.live[data-dlg="live-toggle"]').length`)) === 4);
    check(`[${tag}] Hinweis auf Template-Helfer`, L.tpl.test(await text("dialog.device .dlg-note.small")) || (await ev(`return [...r.querySelectorAll("dialog.device .dlg-note.small")].some((n) => ${L.tpl}.test(n.innerText))`)));
    await tap('dialog.device [data-entity="sensor.helfer_1"][data-dlg="live-toggle"]');
    await tap('dialog.device [data-entity="sensor.helfer_2"][data-dlg="live-toggle"]');
    check(`[${tag}] zwei Helfer ausgeschlossen: Marke "${L.off}", durchgestrichen`, await wait(`return r.querySelectorAll("dialog.device button.pill.live.off").length === 2`) && (await marks()).filter(([, m]) => m === L.off).length === 2);
    check(`[${tag}] Entwurf: "Speichern" erscheint, noch nichts gesendet`, await wait(`return !!r.querySelector('dialog.device [data-dlg="save"]')`) && (await calls()).length === 0);
    await p.screenshot({ path: `${outDir}/liveness-${tag.replace("/", "-")}.png` });
    await tap('dialog.device [data-dlg="save"]');
    check(`[${tag}] gesendet: genau die zwei Entitäten`, await wait(`return true`) && await p.evaluate(() => { const c = window.__wsCalls.filter((m) => m.type === "device_panel/set_device_settings").at(-1); return JSON.stringify(c?.liveness_exclude) === JSON.stringify(["sensor.helfer_1", "sensor.helfer_2"]); }));
    check(`[${tag}] nach dem Speichern weiter ausgeschlossen (Liste neu geladen)`, await wait(`return r.querySelectorAll("dialog.device button.pill.live.off").length === 2`));
    // wieder mitzählen: Entwurf, der zurück auf den Stand führt, ist keine Änderung
    await tap('dialog.device [data-entity="sensor.helfer_1"][data-dlg="live-toggle"]');
    await tap('dialog.device [data-entity="sensor.helfer_1"][data-dlg="live-toggle"]');
    check(`[${tag}] zweimal geschaltet: keine offene Änderung`, await wait(`return !r.querySelector('dialog.device [data-dlg="save"]')`));
    // alle ausschliessen: Hinweis, dass die Wahl dann nicht gilt
    for (const id of ["sensor.helfer_3"]) await tap(`dialog.device [data-entity="${id}"][data-dlg="live-toggle"]`);
    const first = await ev(`return r.querySelector('dialog.device button.pill.live:not(.off)')?.dataset.entity || ""`);
    if (first) await tap(`dialog.device [data-entity="${first}"][data-dlg="live-toggle"]`);
    check(`[${tag}] alle ausgeschlossen: Warnung "${L.ignored}"`, await wait(`return [...r.querySelectorAll("dialog.device .dlg-note.small.warn")].some((n) => ${L.ignored}.test(n.innerText))`));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
