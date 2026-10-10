// Protokoll (1.38.0, docs/mockups/popup-tabs-log-v1, P1): Knopf in der Kopfzeile, Fenster (Desktop gross, Handy vollflächig),
// Filter nach Stufe und Bereich, Suche mit X, Debug-Schalter im Fenster, Kopieren, Leeren, Zeile öffnet das Gerät.
// Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { btn: "Protokoll", title: "Protokoll", levels: ["Alle", "Info", "Warnung", "Fehler"], levelsDebug: ["Alle", "Debug", "Info", "Warnung", "Fehler"], cats: ["Alle", "Laden", "Ausfall", "Batterie", "Push", "Updates", "Neu", "System"], today: "Heute", yesterday: "Gestern",
    none: "Keine Einträge für diesen Filter.", empty: "Noch keine Einträge.", count: "10 Einträge", countShown: "10 Einträge, 2 gezeigt", debug: "Debug-Einträge aufzeichnen", copied: "Kopiert", sub: "Letzte 500 Einträge", err: "Protokoll konnte nicht geladen werden:" },
  en: { btn: "Log", title: "Log", levels: ["All", "Info", "Warning", "Error"], levelsDebug: ["All", "Debug", "Info", "Warning", "Error"], cats: ["All", "Charging", "Outage", "Battery", "Push", "Updates", "New", "System"], today: "Today", yesterday: "Yesterday",
    none: "No entries for this filter.", empty: "No entries yet.", count: "10 entries", countShown: "10 entries, 2 shown", debug: "Record debug entries", copied: "Copied", sub: "Last 500 entries", err: "Could not load the log:" },
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
  const wait = (c) => f.waitForFunction(new Function(`const r=${R};` + c), null, { timeout: 5000 }).then(() => true, () => false);
  const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.innerText || "").replace(/\\s+/g," ").trim()`);
  const texts = (s) => ev(`return [...r.querySelectorAll(${JSON.stringify(s)})].map(e => e.innerText.replace(/\\s+/g," ").trim())`);
  const calls = (type) => p.evaluate((t) => window.__wsCalls.filter((m) => m.type === t), type);
  const rows = () => ev(`return r.querySelectorAll("dialog.log-dlg .lg-row").length`);
  const chipN = (attr, id) => ev(`return r.querySelector('dialog.log-dlg [${attr}="${id}"] .n')?.textContent`);

  // Knopf in der Kopfzeile, vor dem Zahnrad
  const order = await ev(`return [...r.querySelectorAll(".toolbar > button")].map(x => x.className.split(" ")[0])`);
  check(`[${tag}] Knopf "${T_.btn}" vor dem Zahnrad`, order.indexOf("log-btn") !== -1 && order.indexOf("log-btn") === order.indexOf("gear-btn") - 1, JSON.stringify(order));
  check(`[${tag}] Knopf mit Beschriftung`, (await ev(`return r.querySelector(".log-btn").getAttribute("aria-label")`)) === T_.btn);
  await tap(".log-btn");
  check(`[${tag}] Fenster offen, Titel`, (await wait(`return r.querySelector("dialog.log-dlg")?.open && r.querySelectorAll("dialog.log-dlg .lg-row").length > 0`)) && (await text("dialog.log-dlg h2")) === T_.title);
  const geo = await ev(`const d=r.querySelector("dialog.log-dlg").getBoundingClientRect(); return [Math.round(d.left), Math.round(d.width), Math.round(d.top), Math.round(d.height), innerWidth, innerHeight]`);
  if (mobile) check(`[${tag}] Handy: Fenster füllt den Bildschirm`, geo[0] === 0 && geo[1] === geo[4] && geo[2] === 0 && Math.abs(geo[3] - geo[5]) <= 1, JSON.stringify(geo));
  else check(`[${tag}] Desktop: Fenster gross (breiter als das Popup)`, geo[1] > 900 && geo[3] > 600, JSON.stringify(geo));
  check(`[${tag}] Untertitel`, (await text("dialog.log-dlg .dlg-sub")).startsWith(T_.sub), await text("dialog.log-dlg .dlg-sub"));
  check(`[${tag}] zehn Einträge, Zähler im Fuss`, (await rows()) === 10 && (await text('dialog.log-dlg [data-lg="count"]')) === T_.count, await text('dialog.log-dlg [data-lg="count"]'));
  check(`[${tag}] Tage "${T_.today}" und "${T_.yesterday}"`, JSON.stringify((await texts("dialog.log-dlg .lg-day")).map((s) => s.toLowerCase())) === JSON.stringify([T_.today, T_.yesterday].map((s) => s.toLowerCase())), JSON.stringify(await texts("dialog.log-dlg .lg-day")));
  const first = await text("dialog.log-dlg .lg-row");
  check(`[${tag}] neuester Eintrag zuerst`, first.includes("Aqua10 Roller") && first.includes("charging: level 23 %"), first);
  check(`[${tag}] Chips Stufe`, JSON.stringify(await texts('dialog.log-dlg [data-lg="levels"] .chip > span:not(.n):not(.lg-dot)')) === JSON.stringify(T_.levels), JSON.stringify(await texts('dialog.log-dlg [data-lg="levels"] .chip')));
  check(`[${tag}] Chips Bereich`, JSON.stringify(await texts('dialog.log-dlg [data-lg="cats"] .chip > span:not(.n):not(.lg-dot)')) === JSON.stringify(T_.cats));
  check(`[${tag}] Zahlen: Warnung 1, Fehler 1, Push 2`, (await chipN("data-lg-level", "warning")) === "1" && (await chipN("data-lg-level", "error")) === "1" && (await chipN("data-lg-cat", "push")) === "2");
  check(`[${tag}] Debug-Schalter im Fenster, aus`, (await text("dialog.log-dlg .lg-check")) === T_.debug && !(await ev(`return r.querySelector("dialog.log-dlg [data-lg-debug]").checked`)));
  await p.screenshot({ path: `${outDir}/log-${lang}-${mobile ? "mobile" : "desktop"}.png` });

  // Filter Stufe, dann Bereich, kombiniert
  await tap('dialog.log-dlg [data-lg-level="warning"]');
  check(`[${tag}] Stufe Warnung: ein Eintrag`, (await wait(`return r.querySelectorAll("dialog.log-dlg .lg-row").length === 1`)) && (await text("dialog.log-dlg .lg-row")).includes("Türsensor Keller"));
  check(`[${tag}] Fuss: gezeigt`, (await text('dialog.log-dlg [data-lg="count"]')) === (lang === "de" ? "10 Einträge, 1 gezeigt" : "10 entries, 1 shown"));
  await tap('dialog.log-dlg [data-lg-cat="push"]');
  check(`[${tag}] Warnung und Push: nichts, Hinweis`, (await wait(`return r.querySelectorAll("dialog.log-dlg .lg-row").length === 0`)) && (await text("dialog.log-dlg .lg-none")) === T_.none, await text("dialog.log-dlg .lg-none"));
  await tap('dialog.log-dlg [data-lg-level="all"]');
  check(`[${tag}] Bereich Push: zwei Einträge`, await wait(`return r.querySelectorAll("dialog.log-dlg .lg-row").length === 2`), String(await rows()));
  await tap('dialog.log-dlg [data-lg-cat="all"]');

  // Suche mit X
  const input = await handle("dialog.log-dlg [data-lg-search]");
  await input.fill("lampe");
  check(`[${tag}] Suche "lampe": zwei Einträge, X sichtbar`, (await wait(`return r.querySelectorAll("dialog.log-dlg .lg-row").length === 2`)) && !(await ev(`return r.querySelector("dialog.log-dlg [data-lg-clear]").hidden`)));
  check(`[${tag}] Suche nach Bereich ("${T_.cats[2]}")`, await (async () => { await input.fill(T_.cats[2].toLowerCase()); return wait(`return r.querySelectorAll("dialog.log-dlg .lg-row").length === 2`); })());
  await input.fill("lampe");
  await wait(`return r.querySelectorAll("dialog.log-dlg .lg-row").length === 2`);
  await tap("dialog.log-dlg [data-lg-clear]");
  check(`[${tag}] X leert die Suche`, (await wait(`return r.querySelectorAll("dialog.log-dlg .lg-row").length === 10`)) && (await ev(`return r.querySelector("dialog.log-dlg [data-lg-search]").value`)) === "");

  // Eingabe übersteht das Nachfragen (alle 4 s)
  await input.fill("push");
  await p.waitForTimeout(4500);
  check(`[${tag}] Eingabe übersteht das Nachfragen`, (await ev(`return r.querySelector("dialog.log-dlg [data-lg-search]").value`)) === "push" && (await calls("device_panel/get_log")).length >= 2, String((await calls("device_panel/get_log")).length));
  await input.fill("");
  await wait(`return r.querySelectorAll("dialog.log-dlg .lg-row").length === 10`);

  // Debug-Schalter: zeichnet auf, Chip "Debug" erscheint
  check(`[${tag}] ohne Debug kein Chip "Debug"`, !(await ev(`return !!r.querySelector('dialog.log-dlg [data-lg-level="debug"]')`)));
  await tap("dialog.log-dlg [data-lg-debug]");
  check(`[${tag}] Debug an: set_log gesendet`, await wait(`return r.querySelector("dialog.log-dlg [data-lg-debug]").checked && !!r.querySelector('dialog.log-dlg [data-lg-level="debug"]')`) && (await calls("device_panel/set_log")).at(-1)?.debug === true);
  check(`[${tag}] Chips mit "Debug"`, JSON.stringify(await texts('dialog.log-dlg [data-lg="levels"] .chip > span:not(.n):not(.lg-dot)')) === JSON.stringify(T_.levelsDebug));
  await tap('dialog.log-dlg [data-lg-level="debug"]');
  check(`[${tag}] Stufe Debug: ein Eintrag`, (await wait(`return r.querySelectorAll("dialog.log-dlg .lg-row").length === 1`)) && (await text("dialog.log-dlg .lg-row")).includes("level 23 %, low point"));
  await tap('dialog.log-dlg [data-lg-level="all"]');
  await tap("dialog.log-dlg [data-lg-debug]");
  check(`[${tag}] Debug aus: set_log false`, await wait(`return !r.querySelector("dialog.log-dlg [data-lg-debug]").checked`) && (await calls("device_panel/set_log")).at(-1)?.debug === false);

  // Kopieren
  await tap("dialog.log-dlg [data-lg-copy]");
  check(`[${tag}] Kopieren: Rückmeldung`, await wait(`return r.querySelector("dialog.log-dlg [data-lg-copy] span").textContent === ${JSON.stringify(T_.copied)}`));
  const copied = await p.evaluate(() => navigator.clipboard.readText().catch(() => null));
  if (copied !== null) check(`[${tag}] Zwischenablage: eine Zeile je gezeigtem Eintrag, älteste zuerst`, copied.split("\n").length === 11 && copied.split("\n")[0].includes("[INFO] ") && copied.includes("Türsensor Keller: battery 9 % below the threshold: newly low"), copied.split("\n")[0]);

  // Zeile mit Gerät öffnet das Popup über dem Protokoll
  await tap('dialog.log-dlg [data-lg-open="b"]');
  check(`[${tag}] Zeile öffnet das Geräte-Popup, Protokoll bleibt offen`, (await wait(`return r.querySelector("dialog.device")?.open`)) && (await ev(`return r.querySelector("dialog.log-dlg").open`)));
  await tap('dialog.device [data-dlg="close"]');
  await wait(`return !r.querySelector("dialog.device").open`);
  check(`[${tag}] zurück im Protokoll`, await ev(`return r.querySelector("dialog.log-dlg").open`));

  // Leeren
  await tap("dialog.log-dlg [data-lg-reset]");
  check(`[${tag}] Leeren: keine Einträge, Hinweis`, (await wait(`return r.querySelectorAll("dialog.log-dlg .lg-row").length === 0`)) && (await text("dialog.log-dlg .lg-none")) === T_.empty && (await calls("device_panel/clear_log")).length === 1);

  // Fehler beim Laden
  await p.evaluate(() => { window.__logFails = "Keine Berechtigung"; });
  await tap("dialog.log-dlg [data-lg-copy]");
  await ev(`r.host._fetchLog()`);
  check(`[${tag}] Ladefehler angezeigt`, await wait(`return (r.querySelector("dialog.log-dlg .dlg-error")?.textContent || "").includes(${JSON.stringify(T_.err)})`), await text("dialog.log-dlg .dlg-error"));
  await p.evaluate(() => { window.__logFails = null; });

  // Schliessen: Nachfragen hört auf
  await tap("dialog.log-dlg [data-lg-close]");
  check(`[${tag}] Fenster zu`, await wait(`return !r.querySelector("dialog.log-dlg").open`));
  const n0 = (await calls("device_panel/get_log")).length;
  await p.waitForTimeout(4500);
  check(`[${tag}] zu: keine Abfragen mehr`, (await calls("device_panel/get_log")).length === n0, `${n0} -> ${(await calls("device_panel/get_log")).length}`);
  check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
