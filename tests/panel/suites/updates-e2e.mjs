// Update-Erinnerung (1.29.0, docs/mockups/charging-v1): Reiter "Updates" unter "Überwachung und
// Meldungen" mit Schalter (aus), Zeitpunkt (Standard täglich 09:00, Sofort / Täglich / Montags),
// Sammeln (nur bei Sofort), Erinnerung, Arten und Vorschau; die Update-Zeile des Panels bleibt
// oben beim Öffnen; der Abschnitt "Updates" des Panels heisst "Panel-Version".
// Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { tab: "Updates", sec: "Panel-Version", title: "Home Assistant Update", count: "5 verfügbar:", c4: "4 verfügbar:", own: "eigene Wahl", grp: "Einzelne Apps und Integrationen", none: "Ohne Ziel kommt kein Push", daily: "Täglich um", weekly: "Montags um", instant: "Sofort", one: "1 Änderung" },
  en: { tab: "Updates", sec: "Panel version", title: "Home Assistant update", count: "5 available:", c4: "4 available:", own: "own choice", grp: "Single apps and integrations", none: "Without a target no push", daily: "Daily at", weekly: "Mondays at", instant: "Immediately", one: "1 change" },
};
for (const lang of ["de", "en"]) for (const mobile of [false, true]) {
  const T_ = T[lang];
  const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
  const ctx = await b.newContext(mobile ? { viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
  const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
  const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
  // Wiederholt, wenn sich das Panel gerade neu aufbaut ("not attached").
  const tap = async (sel) => {
    for (let versuch = 1; ; versuch++) {
      const h = await handle(sel);
      if (!h) throw new Error("fehlt: " + sel);
      try { await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); return; } catch (err) { if (versuch >= 3 || !/not attached|not stable/.test(String(err))) throw err; }
    }
  };
  const wait = (c) => f.waitForFunction(new Function(`const r=${R};` + c), null, { timeout: 5000 }).then(() => true, () => false);
  const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.innerText || "").replace(/\\s+/g," ").trim()`);
  const calls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_options").map((m) => m.values));

  await tap(".gear-btn");
  await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
  // Update-Zeile des Panels ganz oben, sofort sichtbar (vor den Abschnitten)
  const top = await ev(`const d=r.querySelector("dialog.settings").getBoundingClientRect(); const v=r.querySelector("dialog.settings .ver"); const s=r.querySelector("dialog.settings .set-sec"); const q=v.getBoundingClientRect(); return { before: !!(v.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING), visible: q.top >= d.top && q.bottom <= d.bottom }`);
  check(`[${tag}] Update-Zeile des Panels vor den Abschnitten und sichtbar`, top.before && top.visible, JSON.stringify(top));
  check(`[${tag}] Abschnitt heisst "${T_.sec}"`, (await text('[data-id="updates"] .set-sec-title')) === T_.sec, await text('[data-id="updates"] .set-sec-title'));

  await tap('[data-set="section"][data-id="monitor"]');
  await tap('.mon-tab[data-key="updates"]');
  await wait(`return !!r.querySelector('input[data-opt="notify_updates"]')`);
  check(`[${tag}] Reiter "${T_.tab}", Schalter aus, sonst nichts`, (await text(".mon-tab.on")) === T_.tab && !(await ev(`return r.querySelector('input[data-opt="notify_updates"]').checked`)) && !(await ev(`return !!r.querySelector('select[data-opt="updates_mode"]')`)));
  await tap('input[data-opt="notify_updates"]');
  await wait(`return !!r.querySelector('select[data-opt="updates_mode"]')`);
  const base = await ev(`return [r.querySelector('select[data-opt="updates_mode"]').value, r.querySelector('input[data-opt="updates_time"]').value, r.querySelector('select[data-opt="updates_repeat"]').value, !r.querySelector('input[data-opt="updates_window"]'), [...r.querySelectorAll("input[data-ukind]")].map(i=>i.checked).join()]`);
  check(`[${tag}] Standard: täglich 09:00, ohne Sammeln, nie erinnern, Arten Core/Add-ons/HACS`, JSON.stringify(base) === JSON.stringify(["daily", "09:00", "never", true, "true,true,true,false"]), JSON.stringify(base));
  check(`[${tag}] Vorschau mit den 5 offenen Updates`, (await text(".pv-title")) === T_.title && (await text(".pv-text")).startsWith(T_.count), await text(".pv-text"));
  check(`[${tag}] ohne Ziel: Hinweis`, (await text(".opt-warn")).includes(T_.none), await text(".opt-warn"));
  check(`[${tag}] Zähler und Reiterpunkt`, (await text(".set-count")) === T_.one && await ev(`return r.querySelector('.mon-tab[data-key="updates"]').classList.contains("chg")`));

  // Liste aller update-Entitäten (1.31.0): Ausnahme pro Eintrag gegen die Art
  const row = (id) => `.ex-row:has(input[data-uitem="update.${id}"])`;
  const on = (id) => ev(`return r.querySelector('input[data-uitem="update.${id}"]').checked`);
  check(`[${tag}] Liste: Überschrift, 17 Einträge, Suchfeld`, (await text('.srch-rows[data-srch="updates"]').then(() => ev(`return [...r.querySelectorAll(".mon-grp")].some(g=>g.textContent.trim()===${JSON.stringify(T_.grp)}) && r.querySelectorAll('input[data-uitem]').length === 17 && !!r.querySelector('input[data-lsearch="updates"]')`))));
  check(`[${tag}] Standard folgt der Art: MariaDB an, Shelly Plug aus`, (await on("mariadb_update")) && !(await on("shelly_plug_fw")) && (await on("home_assistant_core_update")));
  await tap('input[data-uitem="update.mariadb_update"]');
  check(`[${tag}] MariaDB aus: Vorschau 4, "${T_.own}"`, (await wait(`return r.querySelector(".pv-text").innerText.startsWith(${JSON.stringify(T_.c4)})`)) && (await text(row("mariadb_update"))).includes(T_.own), await text(".pv-text"));
  await tap('input[data-uitem="update.shelly_plug_fw"]');
  check(`[${tag}] Shelly Plug an gegen die Art: Vorschau wieder 5`, await wait(`return r.querySelector(".pv-text").innerText.startsWith(${JSON.stringify(T_.count)}) && r.querySelector(".pv-text").innerText.includes("Shelly Plug")`));
  await tap('input[data-uitem="update.mariadb_update"]');
  check(`[${tag}] MariaDB wieder an: keine eigene Wahl mehr`, (await wait(`return !r.querySelector('.ex-row:has(input[data-uitem="update.mariadb_update"]) small').textContent.includes(${JSON.stringify(T_.own)})`)) && (await on("mariadb_update")));
  await tap('input[data-uitem="update.mariadb_update"]');
  await wait(`return !r.querySelector('input[data-uitem="update.mariadb_update"]').checked`);
  // Suche in der Liste
  await (await handle('input[data-lsearch="updates"]')).fill("maria");
  check(`[${tag}] Suche "maria": 1 Eintrag sichtbar`, await ev(`return [...r.querySelectorAll('.srch-rows[data-srch="updates"] .ex-row')].filter(e=>!e.hidden).length === 1`));
  await (await handle('input[data-lsearch="updates"]')).fill("");

  // Sofort: Uhrzeit weg, Sammeln da; Fehler bei 0
  await (await handle('select[data-opt="updates_mode"]')).selectOption("instant");
  await wait(`return !!r.querySelector('input[data-opt="updates_window"]')`);
  check(`[${tag}] Sofort: keine Uhrzeit, Feld "Sammeln"`, await ev(`return !r.querySelector('input[data-opt="updates_time"]') && r.querySelector('input[data-opt="updates_window"]').value === "5"`));
  await (await handle('input[data-opt="updates_window"]')).fill("0");
  check(`[${tag}] Sammeln 0: Fehler, Speichern gesperrt`, await wait(`return r.querySelector('[data-set="save"]').disabled`));
  await (await handle('input[data-opt="updates_window"]')).fill("10");
  // Montags 07:30, Firmware an, Core aus, Erinnerung 7 Tage
  await (await handle('select[data-opt="updates_mode"]')).selectOption("weekly");
  await wait(`return !!r.querySelector('input[data-opt="updates_time"]')`);
  await (await handle('input[data-opt="updates_time"]')).fill("07:30");
  await (await handle('select[data-opt="updates_repeat"]')).selectOption("7d");
  await tap('input[data-ukind="devices"]');
  await tap('input[data-ukind="core"]');
  check(`[${tag}] Vorschau folgt den Arten (ohne MariaDB, ohne Core)`, await wait(`return r.querySelector(".pv-text").innerText.startsWith(${JSON.stringify(T_.c4)}) && !r.querySelector(".pv-text").innerText.includes("MariaDB") && !r.querySelector(".pv-text").innerText.includes("Home Assistant Core")`), await text(".pv-text"));
  await p.screenshot({ path: `${outDir}/updates-${tag.replace("/", "-")}.png` });
  await tap('dialog.settings [data-set="save"]');
  await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`);
  const last = (await calls()).at(-1);
  check(`[${tag}] gespeichert`, JSON.stringify(last) === JSON.stringify({ notify_updates: true, updates_mode: "weekly", updates_time: "07:30", updates_window: 5, updates_repeat: "7d", updates_kinds: ["addons", "hacs", "devices"], updates_exclude: ["update.mariadb_update"] }) || (last && last.updates_mode === "weekly" && last.updates_time === "07:30" && last.updates_repeat === "7d" && JSON.stringify(last.updates_kinds) === JSON.stringify(["addons", "hacs", "devices"]) && last.notify_updates === true && JSON.stringify(last.updates_exclude) === JSON.stringify(["update.mariadb_update"]) && !(last.updates_include || []).length), JSON.stringify(last));
  check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
  check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
