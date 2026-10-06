// Gerätetyp pro Integration (1.25.0): Spalte "Typ" in der Liste der Integrationen
// unter "Geräte im Panel" mit Erkennung je Zeile, Entwurf und Speichern, Wirkung auf Liste,
// Typen-Zähler und Popup ("Wie Integration: …"); von Hand am Gerät geht vor,
// zurück auf Automatisch. Deutsch und Englisch, Desktop und Handy, echte
// Klicks/Taps.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: {
    col: "Typ", intro: 'Die Spalte "Typ" gilt für alle Geräte der Integration', shelly: "2 Geräte · erkannt: 2 Steckdose", autoOpt: "Automatisch", one: "1 Änderung",
    sumNone: "Dienst-Geräte und deaktivierte Geräte ausgeblendet", sumOne: "Typ für 1 Integration festgelegt · Dienst-Geräte und deaktivierte Geräte ausgeblendet",
    popAuto: "Automatisch: Steckdose", popInteg: "Wie Integration: Schalter", byInteg: "für die ganze Integration festgelegt", manual: "von Hand gesetzt",
    switch: "Schalter", outlet: "Steckdose", two: "2 Geräte",
  },
  en: {
    col: "Type", intro: 'The "Type" column applies to all devices of the integration', shelly: "2 devices · detected: 2 Outlet", autoOpt: "Automatic", one: "1 change",
    sumNone: "Service devices and disabled devices hidden", sumOne: "type set for 1 integration · Service devices and disabled devices hidden",
    popAuto: "Automatic: Outlet", popInteg: "Same as integration: Switch", byInteg: "set for the whole integration", manual: "set by hand",
    switch: "Switch", outlet: "Outlet", two: "2 devices",
  },
};
const TYPES = ",hub,phone,network,climate,lock,cover,valve,vacuum,camera,alarm,media,fan,light,outlet,switch,motion,contact,safety,energy,sensor,button,other";

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
    const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const setCalls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_options").map((m) => m.values));
    const typeCalls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_device_type").map(({ device_id, device_type }) => ({ device_id, device_type })));
    const open = async (id) => { await tap(`.dev[data-open="${id}"]`); await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('select[data-dlg="type"]')`); };
    const close = async () => { await tap('dialog.device [data-dlg="close"]'); await wait(`return !r.querySelector("dialog.device").open`); };
    const sel = () => ev(`const s=r.querySelector('select[data-dlg="type"]'); return s.value + "|" + s.options[s.selectedIndex].textContent`);
    // Der Reiter "Integrationen" ist beim Öffnen von "Geräte im Panel" der erste
    const openInteg = async () => {
      await tap(".gear-btn");
      await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
      await tap('[data-set="section"][data-id="devices"]');
      await wait(`return !!r.querySelector('select[data-type-integ="shelly"]')`);
    };
    const closeSettings = async () => { await tap('dialog.settings .dlg-actions [data-set="close"]'); await wait(`return !r.querySelector("dialog.settings")?.open`); };

    // Ausgangslage: beide Shelly-Geräte sind Steckdosen, Popup mit Erkennung
    await open("d");
    check(`[${tag}] Popup zeigt die Erkennung`, (await sel()) === `|${T.popAuto}`, await sel());
    check(`[${tag}] Auswahl: Automatisch und alle Typen`, (await ev(`return [...r.querySelectorAll('select[data-dlg="type"] option')].map(o=>o.value).join()`)) === TYPES);
    await close();

    // Einstellungen: Liste im Reiter "Typen"
    await openInteg();
    check(`[${tag}] Abschnitt ohne festen Typ`, (await text('[data-id="devices"] .set-sec-sum')) === T.sumNone, await text('[data-id="devices"] .set-sec-sum'));
    const row = await ev(`const s=r.querySelector('select[data-type-integ="shelly"]'); return s ? [s.closest(".ex-row").querySelector("small").textContent, s.value, s.options[0].textContent, [...s.options].map(o=>o.value).join()] : null`);
    check(`[${tag}] Zeile mit Erkennung und Auswahl`, JSON.stringify(row) === JSON.stringify([T.shelly, "", T.autoOpt, TYPES]), JSON.stringify(row));
    // Spalte neben "Anzeigen": Kopf (Desktop) bzw. Beschriftung in der Zeile (Handy)
    check(`[${tag}] Spalte "Typ" mit Erklärung`,
      (await text(".ex-intro")).includes(T.intro) &&
      (await ev(`return r.querySelector('select[data-type-integ="shelly"]').closest(".ex-col").querySelector(".ex-lbl").textContent`)) === T.col &&
      (mobile || (await text(".ex-head .ex-col.sel")) === T.col),
      await text(".ex-head"));
    // Schalter "Anzeigen" steht in jeder Zeile rechts neben dem Namen (Handy: lange Erkennungstexte
    // drängen ihn nicht in eine eigene Zeile)
    const misplaced = await ev(`return [...r.querySelectorAll('select[data-type-integ]')].map((s) => s.closest(".ex-row")).filter((row) => { const n=row.querySelector(".ex-name").getBoundingClientRect(); const w=row.querySelector(".switch").getBoundingClientRect(); return Math.abs((w.top + w.height/2) - (n.top + n.height/2)) > n.height/2 + 4 || w.left < n.left; }).length`);
    check(`[${tag}] Schalter "Anzeigen" in jeder Zeile neben dem Namen`, misplaced === 0, String(misplaced));
    const sh = await handle('select[data-type-integ="shelly"]');
    await sh.scrollIntoViewIfNeeded();
    await sh.selectOption("switch");
    check(`[${tag}] Entwurf`,
      await wait(`return r.querySelector('select[data-type-integ="shelly"]')?.value === "switch"`) &&
      (await text(".set-count")) === T.one &&
      (await text('[data-id="devices"] .set-sec-sum')) === T.sumOne &&
      (await ev(`return r.querySelector('select[data-type-integ="shelly"]').closest(".opt-select").classList.contains("changed")`)) &&
      (await ev(`return r.querySelector(".sub-tab.on").classList.contains("chg")`)),
      `${await text(".set-count")} | ${await text('[data-id="devices"] .set-sec-sum')}`);
    // Lange Typnamen in der Erkennung (Zigbee) verdrängen die Auswahl nicht aus dem Fenster
    const clipped = await ev(`const box=r.querySelector("dialog.settings").getBoundingClientRect(); return [...r.querySelectorAll("select[data-type-integ]")].filter((s)=>{const q=s.getBoundingClientRect(); return q.right > box.right - 8 || q.left < box.left || q.width < 120}).length`);
    check(`[${tag}] Auswahl in jeder Zeile sichtbar`, clipped === 0, String(clipped));
    if (mobile) {
      const over = await ev(`const d=r.querySelector("dialog.settings"); return d.scrollWidth - d.clientWidth`);
      check(`[${tag}] Handy ohne Überlauf`, over <= 1, String(over));
    }
    await ev(`r.querySelector('select[data-type-integ="shelly"]').closest(".ex-row").scrollIntoView({ block: "center" })`);
    await p.screenshot({ path: `${outDir}/typeinteg-${tag.replace("/", "-")}.png` });
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] gespeichert`, await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`) && JSON.stringify((await setCalls()).at(-1)) === JSON.stringify({ type_integrations: { shelly: "switch" } }), JSON.stringify((await setCalls()).at(-1)));
    // Der Katalog folgt dem wirksamen Typ: "Schalter" mit 2 Geräten, "Steckdose" ohne Geräte nicht mehr in der Liste
    await tap('[data-set="subtab"][data-key="types"]');
    check(`[${tag}] Reiter "Typen" ohne Typ-Auswahl`, await ev(`return !r.querySelector('select[data-type-integ]')`));
    check(`[${tag}] Typen-Liste folgt dem Typ`, await wait(`const s=r.querySelector('input[data-list="exclude_types"][data-value="switch"]'); return s && s.closest(".ex-row").querySelector("small").textContent === ${JSON.stringify(T.two)} && !r.querySelector('input[data-list="exclude_types"][data-value="outlet"]')`),
      await ev(`return r.querySelector('input[data-list="exclude_types"][data-value="switch"]')?.closest(".ex-row").querySelector("small").textContent || "fehlt"`));
    await closeSettings();
    check(`[${tag}] Liste zeigt Schalter`, await wait(`return r.querySelector('.dev[data-open="d"]').textContent.includes(${JSON.stringify(T.switch)})`), await text('.dev[data-open="d"]'));

    // Popup: "Wie Integration: Schalter"; von Hand geht vor, zurück folgt wieder der Integration
    await open("d");
    check(`[${tag}] Popup: wie Integration`, (await sel()) === `|${T.popInteg}` && (await ev(`return r.querySelector('select[data-dlg="type"]').closest(".tile").textContent`)).includes(T.byInteg), await sel());
    await (await handle('select[data-dlg="type"]')).selectOption("outlet");
    check(`[${tag}] von Hand vor Integration`,
      await wait(`const s=r.querySelector('select[data-dlg="type"]'); return s?.value === "outlet" && s.closest(".tile").textContent.includes(${JSON.stringify(T.manual)}) && !s.closest(".tile").textContent.includes(${JSON.stringify(T.byInteg)})`) &&
      JSON.stringify((await typeCalls()).at(-1)) === JSON.stringify({ device_id: "d", device_type: "outlet" }));
    await (await handle('select[data-dlg="type"]')).selectOption("");
    check(`[${tag}] zurück: wieder wie Integration`, await wait(`return r.querySelector('select[data-dlg="type"]')?.value === "" && r.querySelector('select[data-dlg="type"]').options[0].textContent === ${JSON.stringify(T.popInteg)}`) && JSON.stringify((await typeCalls()).at(-1)) === JSON.stringify({ device_id: "d", device_type: null }));
    // Die Anzeige im Kopf des Popups folgt dem wirksamen Typ
    check(`[${tag}] Kopf zeigt Schalter`, (await text("dialog.device .dlg-sub")).includes(T.switch), await text("dialog.device .dlg-sub"));
    await close();

    // Integration zurück auf Automatisch
    await openInteg();
    check(`[${tag}] gespeicherter Wert in der Auswahl`, (await ev(`return r.querySelector('select[data-type-integ="shelly"]').value`)) === "switch" && (await text('[data-id="devices"] .set-sec-sum')) === T.sumOne);
    const sh2 = await handle('select[data-type-integ="shelly"]');
    await sh2.scrollIntoViewIfNeeded();
    await sh2.selectOption("");
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] zurück auf Erkennung`, await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`) && JSON.stringify((await setCalls()).at(-1)) === JSON.stringify({ type_integrations: {} }), JSON.stringify((await setCalls()).at(-1)));
    await closeSettings();
    await open("d");
    check(`[${tag}] Popup: wieder erkannt`, await wait(`return r.querySelector('select[data-dlg="type"]')?.options[0].textContent === ${JSON.stringify(T.popAuto)}`) && !(await ev(`return r.querySelector('select[data-dlg="type"]').closest(".tile").textContent`)).includes(T.byInteg), await sel());
    await close();

    check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
