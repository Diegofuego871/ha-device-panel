// Einstellungen sichern und wiederherstellen (2.98.0): Kapitel unter "Startseite" (Panel › Allgemein), Fenster "Sichern" mit Bereichen,
// Vorschau, Übernehmen, Datei vorher, Rückgängig, ungültige Datei, eingefügter Text. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { ttl: "Sichern und wiederherstellen", exportTitle: "Einstellungen sichern", importTitle: "Wiederherstellen", done: "Wiederhergestellt", undone: "Rückgängig gemacht", bad: "keine sicherung" },
  en: { ttl: "Back up and restore", exportTitle: "Back up settings", importTitle: "Restore", done: "Restored", undone: "Undone", bad: "not a device panel backup" },
};
const dir = mkdtempSync(join(tmpdir(), "dp-backup-"));

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const L = T[lang];
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, acceptDownloads: true }
      : { viewport: { width: 1400, height: 900 }, acceptDownloads: true });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=light`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.innerText || "").replace(/\\s+/g," ").trim()`);
    const download = async (action) => { const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 5000 }), action()]); const path = join(dir, `${tag.replace("/", "-")}-${dl.suggestedFilename()}`); await dl.saveAs(path); return { name: dl.suggestedFilename(), json: JSON.parse(readFileSync(path, "utf8")), path }; };

    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="updates"]');
    await tap('[data-set="subtab"][data-group="panel"][data-key="pstart"]');
    await wait(`return !!r.querySelector('[data-set="bk-export"]')`);
    const titles = await ev(`return [...r.querySelectorAll("dialog.settings .set-sec-body .set-title")].map(x => x.textContent.trim())`);
    check(`[${tag}] Kapitel "${L.ttl}" unter "Startseite"`, titles.length === 2 && titles[1] === L.ttl, JSON.stringify(titles));
    check(`[${tag}] zwei Knöpfe mit Symbol, nicht gesperrt`, await ev(`const b = [...r.querySelectorAll('[data-set="bk-export"], [data-set="bk-import"]')]; return b.length === 2 && b.every((x) => !x.disabled && x.querySelector("svg"))`));

    // Ungespeicherte Änderung: beide Knöpfe gesperrt, mit Hinweis
    await ev(`r.host._settings.draft.battery_low = 21; r.host._renderSettings()`);
    check(`[${tag}] mit ungespeicherter Änderung gesperrt, Hinweis`, await wait(`return [...r.querySelectorAll('[data-set="bk-export"], [data-set="bk-import"]')].every((x) => x.disabled) && !!r.querySelector(".bk-note ~ .opt-warn")`));
    await ev(`r.host._settings.draft.battery_low = r.host._settings.data.values.battery_low; r.host._renderSettings()`);
    check(`[${tag}] wieder frei`, await wait(`return [...r.querySelectorAll('[data-set="bk-export"], [data-set="bk-import"]')].every((x) => !x.disabled)`));

    // Sichern: sechs Bereiche, vier an
    await tap('[data-set="bk-export"]');
    await wait(`return r.querySelector("dialog.backup-dlg")?.open && r.querySelectorAll("dialog.backup-dlg [data-bk-sec]").length === 6`);
    check(`[${tag}] Fenster "${L.exportTitle}", Standard: Routinen und Magic Push aus`, (await text("dialog.backup-dlg h2")) === L.exportTitle && (await ev(`return [...r.querySelectorAll("dialog.backup-dlg [data-bk-sec]")].map((x) => x.dataset.bkSec + ":" + x.checked).join()`)) === "monitor:true,display:true,devices:true,ai:true,routines:false,magic:false");
    let dl = await download(() => tap('dialog.backup-dlg [data-bk="save"]'));
    check(`[${tag}] Datei device-panel-JJJJ-MM-TT.json, vier Bereiche, Format`, /^device-panel-\d{4}-\d{2}-\d{2}\.json$/.test(dl.name) && dl.json.format === "device_panel_backup" && Object.keys(dl.json.sections).join() === "monitor,display,devices,ai", dl.name);
    check(`[${tag}] keine Zugangsdaten in der Datei`, !/token|password|secret/i.test(JSON.stringify(dl.json)));
    await tap('dialog.backup-dlg [data-bk-sec="routines"]');
    dl = await download(() => tap('dialog.backup-dlg [data-bk="save"]'));
    check(`[${tag}] mit Routinen: fünf Bereiche`, Object.keys(dl.json.sections).includes("routines"));
    for (const s of ["monitor", "display", "devices", "ai", "routines"]) await tap(`dialog.backup-dlg [data-bk-sec="${s}"]`);
    check(`[${tag}] kein Bereich: Knöpfe gesperrt`, await ev(`return r.querySelector('dialog.backup-dlg [data-bk="save"]').disabled && r.querySelector('dialog.backup-dlg [data-bk="copy"]').disabled`));
    await tap('dialog.backup-dlg [data-bk="close"]');
    check(`[${tag}] Fenster zu`, await wait(`return !r.querySelector("dialog.backup-dlg").open`));

    // Datei zum Wiederherstellen vorbereiten: geänderte Werte, ein unbekannter, ein ungültiger, ein fehlendes Push-Ziel, ein unbekanntes Gerät
    const file = structuredClone(dl.json);
    file.sections.monitor.options.battery_low = 25;
    file.sections.monitor.options.notify_service = "notify.mobile_app_alt";
    file.sections.monitor.options.charge_boost = true;
    file.sections.monitor.options.notify_group_min = 99;
    file.sections.devices.settings = { "dev-a": { battery: 30 }, "dev-zz": { battery: 10 } };
    const path = join(dir, `${tag.replace("/", "-")}-datei.json`);
    writeFileSync(path, JSON.stringify(file));
    const before = await p.evaluate(() => JSON.stringify([window.__opts.battery_low, window.__opts.notify_service]));

    await tap('[data-set="bk-import"]');
    await wait(`return !!r.querySelector("dialog.backup-dlg input[data-bk-file]")`);
    check(`[${tag}] Fenster "${L.importTitle}" mit Dateiwahl`, (await text("dialog.backup-dlg h2")) === L.importTitle);
    // ungültige Datei
    const badPath = join(dir, "schlecht.json");
    writeFileSync(badPath, JSON.stringify({ hallo: 1 }));
    await (await handle("dialog.backup-dlg input[data-bk-file]")).setInputFiles(badPath);
    check(`[${tag}] ungültige Datei: Fehlermeldung, nichts geschrieben`, await wait(`return !!r.querySelector("dialog.backup-dlg .dlg-error") && r.querySelector("dialog.backup-dlg .dlg-error").textContent.toLowerCase().includes(${JSON.stringify(L.bad)})`));
    // Text einfügen
    await tap('dialog.backup-dlg [data-bk="paste"]');
    await ev(`const t = r.querySelector("dialog.backup-dlg [data-bk-text]"); t.value = "kein json"; t.dispatchEvent(new Event("input", { bubbles: true }))`);
    await tap('dialog.backup-dlg [data-bk="pastego"]');
    check(`[${tag}] eingefügter Unsinn: Fehlermeldung`, await wait(`return !!r.querySelector("dialog.backup-dlg .dlg-error")`));
    await (await handle("dialog.backup-dlg input[data-bk-file]")).setInputFiles(path);
    check(`[${tag}] Vorschau: 2 Werte ändern sich, Hinweise und Übersprungenes`, await wait(`return r.querySelectorAll("dialog.backup-dlg .bk-tile b")[0]?.textContent === "3" && r.querySelectorAll("dialog.backup-dlg .bk-badge.e").length >= 3 && r.querySelectorAll("dialog.backup-dlg .bk-badge.w").length === 1`), await text("dialog.backup-dlg .bk-sum"));
    check(`[${tag}] Vorschau: Bereichszeilen, Hinweis zum Push-Ziel`, (await ev(`return r.querySelectorAll("dialog.backup-dlg .bk-rw .bk-dot").length`)) === Object.keys(file.sections).length && (await text("dialog.backup-dlg .bk-ic.w + div")).includes("notify.mobile_app_alt"));
    check(`[${tag}] Vorschau schreibt nichts`, (await p.evaluate(() => JSON.stringify([window.__opts.battery_low, window.__opts.notify_service]))) === before);
    check(`[${tag}] "Zustand vorher sichern" standardmässig an`, await ev(`return r.querySelector("dialog.backup-dlg [data-bk-before]").checked`));
    const vor = await download(() => tap('dialog.backup-dlg [data-bk="apply"]'));
    check(`[${tag}] Datei vorher gesichert`, /vorher/.test(vor.name) && vor.json.sections.monitor.options.battery_low !== 25, vor.name);
    check(`[${tag}] wiederhergestellt: Titel, Werte im Backend`, await wait(`return r.querySelector("dialog.backup-dlg h2")?.textContent === ${JSON.stringify(L.done)}`) && (await p.evaluate(() => window.__opts.battery_low === 25 && window.__opts.notify_service === "notify.mobile_app_alt")));
    check(`[${tag}] Einstellungen zeigen den neuen Stand`, await wait(`return r.host._settings.draft.battery_low === 25`));
    check(`[${tag}] Gerät aus der Datei übernommen, Gerät unbekannt übersprungen`, await p.evaluate(() => JSON.stringify(window.__bkDevices) === JSON.stringify({ "dev-a": { battery: 30 } })));
    // Rückgängig
    await tap('dialog.backup-dlg [data-bk="undo"]');
    check(`[${tag}] Rückgängig: Titel "${L.undone}", alter Zustand`, await wait(`return r.querySelector("dialog.backup-dlg h2")?.textContent === ${JSON.stringify(L.undone)}`) && (await p.evaluate(() => JSON.stringify([window.__opts.battery_low, window.__opts.notify_service]))) === before && (await p.evaluate(() => JSON.stringify(window.__bkDevices || {}))) === "{}");
    check(`[${tag}] Einstellungen zeigen wieder den alten Stand`, await wait(`return r.host._settings.draft.battery_low === ${JSON.parse(before)[0]}`));
    await tap('dialog.backup-dlg [data-bk="close"]');
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
