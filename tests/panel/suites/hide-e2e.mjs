// Einzelne Geräte ausblenden (0.23.0, docs/mockups/hide-v1, A): Knopf
// "Gerät ausblenden" (bis 0.26.0 "Ausblenden") im Geräte-Popup, danach Hinweis mit "Rückgängig"; Abschnitt
// "Ausgeblendete Geräte" in den Einstellungen zum Wiedereinblenden (gilt mit
// "Speichern"). Deutsch und Englisch, Desktop und Handy, echte Klicks/Taps.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: {
    hide: "Gerät ausblenden", toast: "Fensterkontakt Küche ausgeblendet", undo: "Rückgängig", shown: "Fensterkontakt Küche wieder eingeblendet",
    sec: "Ausgeblendete Geräte", sumNone: "Keine ausgeblendet", sumOne: "1 Gerät ausgeblendet", sumTwo: "2 Geräte ausgeblendet",
    all: "Alle einblenden", sub: "Küche · Zigbee Home Automation", empty: 'Kein Gerät ausgeblendet. Ein Gerät blendest du in seinem Popup mit "Gerät ausblenden" aus.',
    error: "Ausblenden fehlgeschlagen: Speicher voll",
  },
  en: {
    hide: "Hide device", toast: "Fensterkontakt Küche hidden", undo: "Undo", shown: "Fensterkontakt Küche shown again",
    sec: "Hidden devices", sumNone: "None hidden", sumOne: "1 device hidden", sumTwo: "2 devices hidden",
    all: "Show all", sub: "Küche · Zigbee Home Automation", empty: 'No device is hidden. Hide a device in its pop-up with "Hide device".',
    error: "Could not hide the device: Speicher voll",
  },
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
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wait = (code, timeout = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout }).then(() => true, () => false);
    const calls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/hide_device").map(({ device_id, hidden }) => `${device_id}:${hidden}`).join());
    const hasRow = (id) => ev(`return !!r.querySelector('.dev[data-open="${id}"]')`);
    const total = await ev(`return r.querySelectorAll(".dev").length`);

    // Knopf im Popup, unten neben "Schliessen"
    await tap('.dev[data-open="e"]');
    await wait(`return r.querySelector("dialog.device")?.open`);
    check(`[${tag}] Knopf "${T.hide}" im Popup`, (await text('dialog.device .dlg-actions [data-dlg="hide"]')) === T.hide && !!(await handle('dialog.device .dlg-actions [data-dlg="close"]')));
    // Einzeilig, auch auf dem Handy (seit 0.27.0 längerer Text): nebeneinander, nicht abgeschnitten
    const btns = await ev(`return [...r.querySelectorAll("dialog.device .dlg-actions .dlg-btn")].map(b=>{const x=b.getBoundingClientRect(); return [Math.round(x.top), Math.round(x.height), b.scrollWidth <= b.clientWidth]})`);
    check(`[${tag}] Knöpfe einzeilig nebeneinander`, btns.length === 2 && btns[0][0] === btns[1][0] && btns.every(([, hgt, fits]) => hgt <= 44 && fits), JSON.stringify(btns));
    const widths = await ev(`return [...r.querySelectorAll("dialog.device .dlg-actions .dlg-btn")].map(x=>Math.round(x.getBoundingClientRect().width))`);
    check(`[${tag}] beide Knöpfe gleich breit`, widths.length === 2 && Math.abs(widths[0] - widths[1]) <= 1, JSON.stringify(widths));
    await p.screenshot({ path: `${outDir}/hide-popup-${tag.replace("/", "-")}.png` });

    // Fehler: Popup bleibt offen und nennt ihn
    await p.evaluate(() => (window.__hideFails = "Speicher voll"));
    await tap('dialog.device [data-dlg="hide"]');
    check(`[${tag}] Fehler im Popup`, await wait(`return (r.querySelector("dialog.device .dlg-error")?.textContent || "").includes("Speicher voll")`), await text("dialog.device .dlg-error"));
    check(`[${tag}] Popup bleibt offen, Gerät bleibt`, (await ev(`return r.querySelector("dialog.device").open`)) && (await hasRow("e")));
    check(`[${tag}] Fehlertext`, (await text("dialog.device .dlg-error")) === T.error, await text("dialog.device .dlg-error"));
    await p.evaluate(() => { window.__hideFails = null; window.__wsCalls.length = 0; });

    // Ausblenden: Popup zu, Zeile weg, Hinweis mit Rückgängig
    await tap('dialog.device [data-dlg="hide"]');
    check(`[${tag}] Popup zu`, await wait(`return !r.querySelector("dialog.device").open`));
    check(`[${tag}] Gerät nicht mehr in der Liste`, !(await hasRow("e")) && (await ev(`return r.querySelectorAll(".dev").length`)) === total - 1);
    check(`[${tag}] Befehl gesendet`, (await calls()) === "e:true", await calls());
    check(`[${tag}] Hinweis mit Name`, (await text(".toast span")) === T.toast && (await text(".toast [data-toast-action]")) === T.undo, await text(".toast"));
    await p.waitForTimeout(400);
    check(`[${tag}] nach der Abfrage weiter ausgeblendet`, !(await hasRow("e")));
    await p.screenshot({ path: `${outDir}/hide-toast-${tag.replace("/", "-")}.png` });

    // Rückgängig: wieder da
    await tap(".toast [data-toast-action]");
    check(`[${tag}] Rückgängig blendet wieder ein`, await wait(`return !!r.querySelector('.dev[data-open="e"]')`), await calls());
    check(`[${tag}] Hinweis "wieder eingeblendet"`, await wait(`return r.querySelector(".toast span")?.textContent === ${JSON.stringify(T.shown)}`), await text(".toast"));
    check(`[${tag}] Befehle: aus, ein`, (await calls()) === "e:true,e:false", await calls());

    // Einstellungen: zuerst leer
    await tap(".gear-btn");
    await wait(`return !!r.querySelector('dialog.settings [data-id="hidden"]')`);
    check(`[${tag}] Abschnitt "${T.sec}"`, (await text('[data-id="hidden"] .set-sec-title')) === T.sec && (await text('[data-id="hidden"] .set-sec-sum')) === T.sumNone, await text('[data-id="hidden"] .set-sec-sum'));
    await tap('[data-set="section"][data-id="hidden"]');
    check(`[${tag}] ohne ausgeblendete: Hinweis`, (await text("dialog.settings .hidden-empty")) === T.empty, await text("dialog.settings .hidden-empty"));
    await tap('dialog.settings .dlg-actions [data-set="close"]');
    await wait(`return !r.querySelector("dialog.settings").open`);

    // Zwei ausblenden, dann in den Einstellungen eines wieder einblenden
    for (const id of ["e", "k"]) {
      await tap(`.dev[data-open="${id}"]`);
      await wait(`return r.querySelector("dialog.device")?.open`);
      await tap('dialog.device [data-dlg="hide"]');
      await wait(`return !r.querySelector('.dev[data-open="${id}"]')`);
    }
    await tap(".gear-btn");
    await wait(`return !!r.querySelector('dialog.settings [data-id="hidden"]')`);
    check(`[${tag}] Zusammenfassung zählt`, (await text('[data-id="hidden"] .set-sec-sum')) === T.sumTwo, await text('[data-id="hidden"] .set-sec-sum'));
    if (!(await ev(`return r.querySelector('[data-set="section"][data-id="hidden"]').getAttribute("aria-expanded") === "true"`))) await tap('[data-set="section"][data-id="hidden"]');
    const row = await ev(`const i=r.querySelector('input[data-list="exclude_devices"][data-value="e"]'); return i ? [i.checked, i.closest(".ex-row").querySelector(".ex-name").textContent.replace(/\\s+/g," ").trim(), !!i.closest(".ex-row").querySelector(".ibadge svg")] : null`);
    check(`[${tag}] Zeile mit Name, Bereich, Integration, Symbol; "Anzeigen" aus`, row && row[0] === false && row[1] === `Fensterkontakt Küche${T.sub}` && row[2], JSON.stringify(row));
    check(`[${tag}] "${T.all}"`, (await text('dialog.settings [data-id="hidden"] ~ .set-sec-body .ex-all .ex-name, dialog.settings .set-sec.open .ex-all .ex-name')) === T.all, await text("dialog.settings .set-sec.open .ex-all .ex-name"));
    if (mobile) await p.screenshot({ path: `${outDir}/hide-settings-${tag.replace("/", "-")}.png` });
    await tap('input[data-list="exclude_devices"][data-value="e"]');
    check(`[${tag}] Entwurf: geändert, Zeile bleibt`, (await text('[data-id="hidden"] .set-sec-sum')) === T.sumOne && !!(await handle('input[data-list="exclude_devices"][data-value="e"]')) && (await text('[data-id="hidden"] .set-badge')) !== "");
    if (!mobile) await p.screenshot({ path: `${outDir}/hide-settings-${tag.replace("/", "-")}.png` });
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] gespeichert: wieder in der Liste`, await wait(`return !!r.querySelector('.dev[data-open="e"]') && !r.querySelector('.dev[data-open="k"]')`));
    check(`[${tag}] nach dem Speichern nur noch eines`, await wait(`return r.querySelectorAll('input[data-list="exclude_devices"]').length === 1`) && (await text('[data-id="hidden"] .set-sec-sum')) === T.sumOne, await text('[data-id="hidden"] .set-sec-sum'));
    // Alle einblenden
    await tap('input[data-list-all="exclude_devices"]');
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] "${T.all}" und Speichern`, await wait(`return !!r.querySelector('.dev[data-open="k"]') && r.querySelectorAll(".dev").length === ${total}`));
    check(`[${tag}] Optionen leer`, (await p.evaluate(() => window.__opts.exclude_devices.length)) === 0);

    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
