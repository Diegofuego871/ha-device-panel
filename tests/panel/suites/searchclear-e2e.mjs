// X in jedem Suchfeld (2.63.0, Wunsch des Nutzers: überall gleich): Assistent "Routine hinzufügen" (Geräteliste und Entitäten), App-Launcher,
// Protokoll und die Suche der Übersicht (das Fenster aller Routinen ohne Routine hat kein Suchfeld; mit Routinen prüft es die Suite routineall). Der Knopf ist nur sichtbar, solange etwas im Feld steht; ein Tipp leert das
// Feld, die Liste folgt, der Fokus bleibt im Feld. (Bedingungs-Suche und "Freie Entität" prüfen die Suiten routinetrigger und magic.)
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

for (const mobile of [false, true]) {
  const tag = mobile ? "mobile" : "desktop";
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=de&theme=${mobile ? "dark" : "light"}`);
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
  const fill = async (sel, value) => { const h = await handle(sel); await h.scrollIntoViewIfNeeded(); await h.fill(value); };
  const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
  // Ein Suchfeld: leer ohne X, getippt mit X, Tipp aufs X leert und löst die Suche aus, Fokus bleibt im Feld
  const cycle = async (label, root, input, listCount) => {
    const btn = `${root} .field-clear`;
    const before = await ev(`const b = r.querySelector('${btn}'); return !!b && b.hidden`);
    await fill(input, "zzzxyz");
    const shown = await wait(`const b = r.querySelector('${btn}'); return !!b && !b.hidden`);
    const filtered = await ev(`return ${listCount} !== window.__n0`).catch(() => true);
    await tap(btn);
    const cleared = await wait(`const i = r.querySelector('${input}'); const b = r.querySelector('${btn}'); return i.value === "" && b.hidden && r.activeElement === i`);
    check(`[${tag}] ${label}: leer ohne X, getippt mit X, Tipp leert (Fokus im Feld)`, before && shown && cleared, JSON.stringify({ before, shown, cleared }));
    return filtered;
  };

  // Assistent: Geräteliste
  await tap(".toolbar .rtall-btn");
  await wait(`return r.querySelector("dialog.rtall-dlg")?.open`);
  await tap('dialog.rtall-dlg [data-rta="routine-add"]');
  const win = "dialog.routine-dlg";
  await wait(`return r.querySelectorAll('${win} [data-rt="dev"]').length > 3`);
  const n0 = await ev(`return r.querySelectorAll('${win} [data-rt="dev"]').length`);
  await cycle("Assistent, Geräteliste", `${win} .list-search`, `${win} input[data-rt="dev-search"]`, "0");
  check(`[${tag}] Assistent, Geräteliste: nach dem Leeren wieder alle ${n0} Einträge`, await wait(`return r.querySelectorAll('${win} [data-rt="dev"]').length === ${n0}`));
  // Assistent: Entitäten (viele Szenen)
  await p.evaluate(() => { window.__manyScenes = true; });
  await ev(`r.host._routines.closeWizard()`);
  await wait(`return !r.querySelector("${win}")?.open`);
  await tap('dialog.rtall-dlg [data-rta="routine-add"]');
  await wait(`return r.querySelector("${win} [data-rt='dev'][data-ent='scene.film']")`);
  await tap(`${win} [data-rt="dev"][data-ent="scene.film"]`);
  await tap(`${win} [data-rt="nav-next"]`);
  await wait(`return r.querySelectorAll("${win} .mg-pick").length === 14`);
  await cycle("Assistent, Entitäten", `${win} .list-search`, `${win} input[data-rt="ent-search"]`, "0");
  check(`[${tag}] Assistent, Entitäten: nach dem Leeren wieder alle 14`, await wait(`return r.querySelectorAll('${win} .mg-pick').length === 14`));
  await p.evaluate(() => { window.__manyScenes = false; });
  await ev(`r.host._routines.closeWizard()`);
  await wait(`return !r.querySelector("${win}")?.open`);

  await ev(`r.host._closeRtAll()`);
  await wait(`return !r.querySelector("dialog.rtall-dlg")?.open`);

  // App-Launcher
  await tap(".apps-btn");
  await wait(`return r.querySelector("dialog.apps-dlg")?.open`);
  await cycle("App-Launcher", "dialog.apps-dlg .ap-search", "dialog.apps-dlg .ap-q", "0");
  check(`[${tag}] App-Launcher: nach dem Leeren wieder die Gruppen`, await wait(`return r.querySelectorAll("dialog.apps-dlg .ap-h").length >= 2 && !r.querySelector("dialog.apps-dlg .ap-note")`));
  await ev(`r.host._apps.close()`);

  // Protokoll
  await ev(`r.host._openLog()`);
  await wait(`return r.querySelector("dialog.log-dlg")?.open && r.querySelector("dialog.log-dlg input[data-lg-search]")`);
  await cycle("Protokoll", "dialog.log-dlg .list-search", "dialog.log-dlg input[data-lg-search]", "0");
  await ev(`r.host._closeLog()`);

  // Suche der Übersicht
  const main = await ev(`const b = r.querySelector(".searchbox .search-clear"); return !!b`);
  check(`[${tag}] Übersicht: eigener X vorhanden (bestehend)`, main);
  check(`[${tag}] keine Konsolenfehler`, errors.length === 0, errors.join(" | "));
  await p.screenshot({ path: `${outDir}/searchclear-${tag}.png` });
  await ctx.close();
}
await b.close();
console.log(ok ? "ALLE BESTANDEN" : "FEHLER");
process.exit(ok ? 0 : 1);
