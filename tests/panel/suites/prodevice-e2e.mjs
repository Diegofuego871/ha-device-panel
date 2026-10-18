// Einstellungen pro Gerät an einem Ort (2.0.7): "Geräte im Panel" hat den Reiter "Pro Gerät" mit allen Geräten, die eine
// eigene Einstellung haben (Ausfall-Zeit, Meldungen, Batterie, Verbindungsart, Empfang); "Darstellung" hat nur noch die
// Filter-Chips; die Empfang-Warnschwellen stehen im Reiter "Empfang" der Überwachung. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { tabs: "Integrationen|Typen|Geräte|Pro Gerät", title: "Einstellungen pro Gerät", conn: "Verbindungsart von Hand auf Geräten", sig: "Empfang: Warnschwelle pro Funkart", sigTab: "Empfang", diff: "Abweichungen" },
  en: { tabs: "Integrations|Types|Devices|Per device", title: "Settings per device", conn: "Connection type set by hand on devices", sig: "Signal: warning threshold per connection type", sigTab: "Signal", diff: "Exceptions" },
};
for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.textContent || "").replace(/\\s+/g," ").trim()`);

    // Ein Gerät mit Verbindungsart von Hand (Popup), damit die Liste einen Eintrag hat
    await tap('.dev[data-open="p"]');
    await wait(`return r.querySelector("dialog.device")?.open`);
    await tap('dialog.device [data-tab="set"]');
    const s = await handle('select[data-dlg="conn"]');
    await s.selectOption("zigbee");
    await wait(`return r.querySelector('select[data-dlg="conn"]')?.value === "zigbee"`);
    await tap('dialog.device [data-dlg="save"]');
    await wait(`return r.querySelector("dialog.device .set-count.saved")`);
    await tap('dialog.device [data-dlg="close"]');
    await wait(`return !r.querySelector("dialog.device").open`);
    await f.evaluate(() => document.querySelector("device-panel")._fetch());
    await p.waitForTimeout(500);

    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="devices"]');
    check(`[${tag}] Geräte im Panel: Reiter ${T.tabs}`, (await ev(`return [...r.querySelectorAll('[data-id="devices"] ~ .set-sec-body .sub-tab')].map(t => t.firstChild.textContent.trim()).join("|")`)) === T.tabs, await ev(`return [...r.querySelectorAll('.sub-tab')].map(t => t.firstChild.textContent.trim()).join("|")`));
    await tap('[data-set="subtab"][data-key="devset"]');
    check(`[${tag}] Reiter "Pro Gerät": Titel und sieben Listen`, (await ev(`return [...r.querySelectorAll(".set-title")].some(x => x.textContent.trim() === ${JSON.stringify(T.title)})`)) && (await ev(`return r.querySelectorAll(".ovr-opt").length`)) === 7 && (await ev(`return [...r.querySelectorAll(".ovr-opt .opt-label")].some(e => e.textContent.trim() === ${JSON.stringify(T.conn)})`)));
    const count = () => ev(`return r.querySelector('[data-key="devset"] .sub-n').textContent`);
    check(`[${tag}] Zähler am Reiter = Geräte mit eigener Einstellung (mindestens das Gerät "p")`, Number(await count()) >= 1, await count());
    const n0 = Number(await count());
    await tap('[data-key="connection:p"]');
    check(`[${tag}] zum Zurücksetzen markiert: Zähler sinkt, eine Änderung`, (await wait(`return r.querySelector('[data-key="devset"] .sub-n').textContent === ${JSON.stringify(String(n0 - 1 || ""))} || r.querySelector('[data-key="devset"] .sub-n').hidden`)) && (await text("dialog.settings .set-count")).startsWith("1"), `${await count()} / ${await text("dialog.settings .set-count")}`);
    await tap('[data-key="connection:p"]');
    check(`[${tag}] Rückgängig: Zähler wieder ${n0}`, await wait(`return r.querySelector('[data-key="devset"] .sub-n').textContent === ${JSON.stringify(String(n0))}`));

    // Darstellung: nur noch Filter-Chips
    await tap('dialog.settings [data-set="close"]');
    await tap(mobile ? "[data-view-open]" : ".view-btn");
    await wait(`return !!r.querySelector("dialog.settings .sub-tab")`);
    await tap('[data-set="vtab"][data-key="chips"]');
    check(`[${tag}] Ansicht › Filter-Chips: keine Listen für Verbindungsart und Empfang`, await ev(`return r.querySelectorAll("dialog.settings .sub-tab").length === 2 && !r.querySelector('select[data-sig-mode]') && !r.querySelector(".ovr-opt") && !!r.querySelector(".ex-title")`));
    await tap('dialog.settings [data-set="close"]');
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);

    // Überwachung und Meldungen: Reiter Empfang
    await tap('[data-set="section"][data-id="monitor"]');
    await tap('.mon-tab[data-key="sig"]');
    await wait(`return !!r.querySelector('select[data-sig-mode="|wifi"]')`);
    check(`[${tag}] Überwachung › ${T.sigTab}: Warnschwellen und "${T.diff}"`, (await ev(`return [...r.querySelectorAll(".set-title")].some(x => x.textContent.trim() === ${JSON.stringify(T.sig)})`)) && (await text(".mon-grp")) === T.diff && (await ev(`return !!r.querySelector('[data-set="ovr-all"][data-key="signal"]') || !!r.querySelector(".ovr-opt")`)));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
