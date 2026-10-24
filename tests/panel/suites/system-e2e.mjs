// Protokoll und Log in einem Fenster (2.125.0, docs/mockups/protocol-merge-v1, A): die App im Launcher heisst "Protokoll" (EN "History") und öffnet das
// Protokoll über alle Geräte auf "Alles"; der Reiter "System" (nur über alle Geräte, nicht am Gerät) zeigt die Einträge ohne Gerät und alle Debug-Einträge
// mit Stufen- und Kategorie-Chips, Suche, Debug-Schalter mit Ablaufzeit, Kopieren und Leeren; ein Eintrag mit Gerät öffnet das Gerät. Die Einstellungen
// (Speicher) öffnen dasselbe Fenster auf "System". Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { app: "Protokoll", tabs: ["Alles", "Magic Push", "Routinen", "System"], levels: ["Alle", "Fehler", "Warnung", "Info"], levelsDebug: ["Alle", "Fehler", "Warnung", "Info", "Debug"], cats: ["Alle", "System", "Push", "Updates"], sub: "System · seit", debug: "Debug-Einträge aufzeichnen", debugFor: "· 48 Std.", clearAsk: "Log leeren?", none: "Keine Einträge für diesen Filter.", empty: "Noch keine Einträge.", copied: "Kopiert", open: "Protokoll öffnen (System)" },
  en: { app: "History", tabs: ["All", "Magic Push", "Routines", "System"], levels: ["All", "Error", "Warning", "Info"], levelsDebug: ["All", "Error", "Warning", "Info", "Debug"], cats: ["All", "System", "Push", "Updates"], sub: "System · since", debug: "Record debug entries", debugFor: "· 48 h", clearAsk: "Clear the log?", none: "No entries for this filter.", empty: "No entries yet.", copied: "Copied", open: "Open history (System)" },
};
for (const lang of ["de", "en"]) for (const mobile of [false, true]) {
  const T_ = T[lang];
  const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
  const ctx = await b.newContext(mobile ? { viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=${mobile ? "dark" : "light"}`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
  const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
  const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
  const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
  const wait = (c, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + c), null, { timeout: ms }).then(() => true, () => false);
  const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.innerText || "").replace(/\\s+/g," ").trim()`);
  const texts = (s) => ev(`return [...r.querySelectorAll(${JSON.stringify(s)})].map(e => e.innerText.replace(/\\s+/g," ").trim())`);
  const calls = (type) => p.evaluate((t) => window.__wsCalls.filter((m) => m.type === t), type);
  const D = "dialog.proto-dlg";
  const sysRows = () => ev(`return r.querySelectorAll("${D} .pr-list .lg-row").length`);
  const chipLabels = (sel) => texts(`${D} ${sel} .chip > span:not(.n):not(.lg-dot)`);

  // --- Launcher: App "Protokoll" (EN "History"), öffnet über alle Geräte auf "Alles" ---
  await tap(".apps-btn");
  await wait(`return r.querySelector("dialog.apps-dlg")?.open && !!r.querySelector('dialog.apps-dlg [data-ap="open"][data-id="log"]')`);
  check(`[${tag}] App im Launcher heisst "${T_.app}"`, (await text('dialog.apps-dlg [data-ap="open"][data-id="log"]')).includes(T_.app), await text('dialog.apps-dlg [data-ap="open"][data-id="log"]'));
  await p.waitForTimeout(600);
  await tap('dialog.apps-dlg [data-ap="open"][data-id="log"]');
  check(`[${tag}] Fenster offen, Reiter "Alles" gewählt, Unterzeile "alle Geräte"`, await wait(`return r.querySelector("${D}")?.open && r.querySelector('${D} [data-pr="kind"].on')?.dataset.v === "all"`));
  check(`[${tag}] vier Reiter: ${T_.tabs.join(", ")}`, JSON.stringify(await texts(`${D} [data-pr-kinds] .sub-tab`)) === JSON.stringify(T_.tabs), JSON.stringify(await texts(`${D} [data-pr-kinds] .sub-tab`)));
  const geo = await ev(`const d=r.querySelector("${D}").getBoundingClientRect(); return [Math.round(d.left), Math.round(d.width), Math.round(d.top), Math.round(d.height), innerWidth, innerHeight]`);
  if (mobile) check(`[${tag}] Handy: Fenster füllt den Bildschirm`, geo[0] === 0 && geo[1] === geo[4] && geo[2] === 0 && Math.abs(geo[3] - geo[5]) <= 1, JSON.stringify(geo));
  else check(`[${tag}] Desktop: Fenster gross (880 px breit wie die übrigen)`, geo[1] === 880 && geo[3] > 600, JSON.stringify(geo));
  check(`[${tag}] kein Debug-Schalter auf "Alles"`, await ev(`return r.querySelector("${D} [data-pr-debug-row]").hidden`));

  // --- Reiter "System" ---
  await tap(`${D} [data-pr="kind"][data-v="system"]`);
  check(`[${tag}] System: nur Einträge ohne Gerät (vier), Unterzeile`, (await wait(`return r.querySelectorAll("${D} .pr-list .lg-row").length === 4`)) && (await text(`${D} [data-pr-sub]`)).startsWith(T_.sub), `${await sysRows()} / ${await text(`${D} [data-pr-sub]`)}`);
  check(`[${tag}] System: Zeitraum steht auf "Alle", auf "Alles" wieder auf "30 Tage"`, await (async () => {
    const on = () => ev(`return r.querySelector('${D} [data-pr-ranges] .sub-tab.on')?.dataset.v`);
    const inSystem = await on() === "all";
    await tap(`${D} [data-pr="kind"][data-v="all"]`);
    await wait(`return r.querySelector('${D} [data-pr="kind"].on')?.dataset.v === "all"`);
    const inAll = await on() === "30d";
    await tap(`${D} [data-pr="kind"][data-v="system"]`);
    await wait(`return r.querySelectorAll("${D} .pr-list .lg-row").length === 4`);
    return inSystem && inAll && await on() === "all";
  })());
  check(`[${tag}] Chips Stufe`, JSON.stringify(await chipLabels("[data-pr-filters]")) === JSON.stringify(T_.levels), JSON.stringify(await chipLabels("[data-pr-filters]")));
  check(`[${tag}] Chips Kategorie`, JSON.stringify(await chipLabels("[data-pr-items]")) === JSON.stringify(T_.cats), JSON.stringify(await chipLabels("[data-pr-items]")));
  check(`[${tag}] Zahlen: Fehler 1, Info 3; Push 2`, (await text(`${D} [data-pr-filters] [data-v="error"] .n`)) === "1" && (await text(`${D} [data-pr-filters] [data-v="info"] .n`)) === "3" && (await text(`${D} [data-pr-items] [data-v="push"] .n`)) === "2");
  await p.screenshot({ path: `${outDir}/system-${tag.replace("/", "-")}.png` });
  const first = await text(`${D} .pr-list .lg-row`);
  check(`[${tag}] neuester Eintrag zuerst, Tag "Heute"`, first.includes("Charged") || first.includes("sent"), first);
  check(`[${tag}] Debug-Schalter nur hier, aus, mit "48" daneben`, (await text(`${D} [data-pr-debug-row]`)) === `${T_.debug} ${T_.debugFor}`, await text(`${D} [data-pr-debug-row]`));
  check(`[${tag}] ohne Debug kein Chip "Debug"`, !(await ev(`return !!r.querySelector('${D} [data-pr-filters] [data-v="debug"]')`)));

  // Stufe und Kategorie
  await tap(`${D} [data-pr-filters] [data-v="error"]`);
  check(`[${tag}] Stufe Fehler: ein Eintrag`, (await wait(`return r.querySelectorAll("${D} .pr-list .lg-row").length === 1`)) && (await text(`${D} .pr-list .lg-row`)).includes("notify.altes_handy"));
  await tap(`${D} [data-pr-filters] [data-v="all"]`);
  await tap(`${D} [data-pr-items] [data-v="updates"]`);
  check(`[${tag}] Kategorie Updates: ein Eintrag`, await wait(`return r.querySelectorAll("${D} .pr-list .lg-row").length === 1`));
  await tap(`${D} [data-pr-filters] [data-v="error"]`);
  check(`[${tag}] Updates und Fehler: nichts, Hinweis`, (await wait(`return r.querySelectorAll("${D} .pr-list .lg-row").length === 0`)) && (await text(`${D} .lg-none`)) === T_.none, await text(`${D} .lg-none`));
  await tap(`${D} [data-pr-filters] [data-v="all"]`);
  await tap(`${D} [data-pr-items] [data-v=""]`);
  check(`[${tag}] Alle: vier Einträge`, await wait(`return r.querySelectorAll("${D} .pr-list .lg-row").length === 4`));

  // Suche mit X
  const input = await handle(`${D} input[data-pr-search]`);
  await input.fill("handy");
  check(`[${tag}] Suche "handy": zwei Einträge`, await wait(`return r.querySelectorAll("${D} .pr-list .lg-row").length === 2`));
  await input.fill("");
  check(`[${tag}] Suche leer: vier Einträge`, await wait(`return r.querySelectorAll("${D} .pr-list .lg-row").length === 4`));

  // Debug-Schalter: set_log, Ablaufzeit, Chip "Debug", Eintrag mit Gerät erscheint hier
  await tap(`${D} [data-pr-debug]`);
  check(`[${tag}] Debug an: set_log gesendet, Schalter an`, await wait(`return r.querySelector("${D} [data-pr-debug]").checked`) && (await calls("device_panel/set_log")).at(-1)?.debug === true);
  check(`[${tag}] Debug an: Ablaufzeit statt "48" allein, Punkt am Launcher`, await wait(`return /\\d\\d:\\d\\d|\\d\\.\\d/.test(r.querySelector("${D} [data-pr-debug-row] small").textContent)`) , await text(`${D} [data-pr-debug-row]`));
  check(`[${tag}] Chips mit "Debug"`, JSON.stringify(await chipLabels("[data-pr-filters]")) === JSON.stringify(T_.levelsDebug), JSON.stringify(await chipLabels("[data-pr-filters]")));
  await tap(`${D} [data-pr-filters] [data-v="debug"]`);
  check(`[${tag}] Stufe Debug: der Debug-Eintrag steht hier, obwohl er ein Gerät hat`, (await wait(`return r.querySelectorAll("${D} .pr-list .lg-row").length === 1`)) && (await text(`${D} .pr-list .lg-row`)).includes("Aqua10 Roller"));
  await tap(`${D} [data-pr-filters] [data-v="all"]`);
  await tap(`${D} [data-pr-debug]`);
  check(`[${tag}] Debug aus: set_log false, Chip "Debug" bleibt (es gibt noch Debug-Einträge)`, await wait(`return !r.querySelector("${D} [data-pr-debug]").checked`) && (await calls("device_panel/set_log")).at(-1)?.debug === false);

  // Eintrag mit Gerät öffnet das Gerät (Debug-Eintrag), Protokoll bleibt offen
  await tap(`${D} [data-pr-filters] [data-v="debug"]`);
  await wait(`return !!r.querySelector('${D} .pr-list button.lg-row[data-pr="device"]')`);
  await tap(`${D} .pr-list button.lg-row[data-pr="device"]`);
  check(`[${tag}] Eintrag mit Gerät öffnet das Geräte-Popup`, (await wait(`return r.querySelector("dialog.device")?.open`)) && (await ev(`return r.querySelector("${D}").open`)));
  await tap('dialog.device [data-dlg="close"]');
  await wait(`return !r.querySelector("dialog.device").open`);
  check(`[${tag}] zurück im Protokoll`, await ev(`return r.querySelector("${D}").open`));
  await tap(`${D} [data-pr-filters] [data-v="all"]`);

  // Kopieren
  await ev(`r.host._copyText = async (t) => { window.__copied = t; return true; }`);
  await tap(`${D} [data-pr="copy"]`);
  check(`[${tag}] Kopieren: Rückmeldung`, await wait(`return r.querySelector("${D} [data-pr='copy'] span").textContent === ${JSON.stringify(T_.copied)}`));
  const copied = await ev(`return window.__copied ?? null`);
  const lines = String(copied).split("\n");
  check(`[${tag}] Zwischenablage: eine Zeile je gezeigtem Eintrag mit Stufe und Kategorie`, lines.length >= 4 && /\[(INFO|ERROR|WARNING|DEBUG)\] \[/.test(lines[0]), lines[0]);

  // Leeren fragt zuerst
  await tap(`${D} [data-pr="clear-log"]`);
  check(`[${tag}] Leeren fragt zuerst: "${T_.clearAsk}"`, (await wait(`const d = r.querySelector("dialog.discard-dlg"); return d?.open && d.textContent.includes(${JSON.stringify(T_.clearAsk)})`)) && (await sysRows()) >= 4);
  await tap('dialog.discard-dlg [data-dd="no"]');
  await wait(`return !r.querySelector("dialog.discard-dlg").open`);
  check(`[${tag}] "Abbrechen": nichts gelöscht, Fenster bleibt offen`, (await sysRows()) >= 4 && (await ev(`return r.querySelector("${D}").open`)));
  await tap(`${D} [data-pr="clear-log"]`);
  await wait(`return r.querySelector("dialog.discard-dlg")?.open`);
  await tap('dialog.discard-dlg [data-dd="yes"]');
  check(`[${tag}] Leeren: keine Einträge, Hinweis "${T_.empty}"`, (await wait(`return r.querySelectorAll("${D} .pr-list .lg-row").length === 0`)) && (await text(`${D} .lg-none`)) === T_.empty && (await calls("device_panel/clear_log")).length === 1, await text(`${D} .lg-none`));

  // Ladefehler
  await p.evaluate(() => { window.__protocolFails = "boom"; });
  await tap(`${D} [data-pr-filters] [data-v="info"]`);
  check(`[${tag}] Ladefehler angezeigt`, await wait(`return !!r.querySelector("${D} .dlg-error, ${D} .mg-note")`));
  await p.evaluate(() => { window.__protocolFails = null; });

  // Am Gerät: kein Reiter "System"
  await tap(`${D} [data-pr="close"]`);
  await wait(`return !r.querySelector("${D}").open`);
  await ev(`r.host._openDevice("d")`);
  await wait(`return !!r.querySelector('dialog.device .dlg-head [data-proto="all"]')`);
  await tap('dialog.device .dlg-head [data-proto="all"]');
  check(`[${tag}] am Gerät drei Reiter, kein "System"`, (await wait(`return r.querySelector("${D}")?.open && r.querySelectorAll("${D} [data-pr-kinds] .sub-tab").length === 3`)) && !(await ev(`return !!r.querySelector('${D} [data-pr="kind"][data-v="system"]')`)));
  await tap(`${D} [data-pr="close"]`);
  await wait(`return !r.querySelector("${D}").open`);
  await tap('dialog.device [data-dlg="close"]');
  await wait(`return !r.querySelector("dialog.device").open`);

  // Einstellungen › Speicher: Knopf öffnet das Protokoll auf "System"
  await tap(".gear-btn");
  await wait(`return r.querySelector("dialog.settings")?.open`);
  await p.waitForTimeout(800);
  await ev(`r.host._settings.sub = { ...r.host._settings.sub, panel: "pstorage" }; r.host._settings.open.add("updates"); r.host._renderSettings()`);
  await wait(`return !!r.querySelector('dialog.settings [data-set="open-syslog"]')`);
  check(`[${tag}] Speicher: Knopf "${T_.open}"`, (await text('dialog.settings [data-set="open-syslog"]')).includes(T_.open), await text('dialog.settings [data-set="open-syslog"]'));
  await tap('dialog.settings [data-set="open-syslog"]');
  check(`[${tag}] öffnet das Protokoll auf "System"`, await wait(`return r.querySelector("${D}")?.open && r.querySelector('${D} [data-pr="kind"].on')?.dataset.v === "system"`));
  await tap(`${D} [data-pr="close"]`);
  check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
