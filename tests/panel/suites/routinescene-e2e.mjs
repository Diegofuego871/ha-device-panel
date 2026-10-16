// Szenen und Gruppen in Routinen (2.61.0): "Routine hinzufügen" im Fenster aller Routinen zeigt am Ende der Liste "Gruppen" und "Szenen"
// (Entitäten ohne Gerät). Szene: nur "Aktivieren", kein Zurückschalten, keine Optionen. Gruppe: wie eine einzelne Lampe.
// Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { all: "Alle", film: "filmabend", q0: "Gerät, Gruppe oder Szene?", scenes: "Szenen", groups: "Gruppen", act: "Aktivieren", kindScene: "Szene", kindGroup: "Gruppe", grp: "leuchten", noBack: "Eine Szene lässt sich nur aktivieren, nicht zurückschalten.", scene: "Abendlicht", count: "2 Szenen", sentence: "Abendlicht aktivieren", step: (n, t) => `Schritt ${n} von ${t}` },
  en: { all: "All", film: "movie night", q0: "Device, group or scene?", scenes: "Scenes", groups: "Groups", act: "Activate", kindScene: "Scene", kindGroup: "Group", grp: "living room", noBack: "A scene can only be activated, not switched back.", scene: "Abendlicht", count: "2 scenes", sentence: "Abendlicht activate", step: (n, t) => `Step ${n} of ${t}` },
};

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=${mobile ? "dark" : "light"}`);
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
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const calls = (type) => p.evaluate((ty) => window.__wsCalls.filter((m) => m.type === ty), type);
    const win = "dialog.routine-dlg";
    const stepsOf = () => ev(`return r.querySelectorAll("${win} .mg-stp").length`);

    await tap(".toolbar .rtall-btn");
    await wait(`return r.querySelector("dialog.rtall-dlg")?.open`);
    await tap('dialog.rtall-dlg [data-rta="routine-add"]');
    check(`[${tag}] Titel "${T.q0}"`, await wait(`return r.querySelector("${win} .mg-big")?.textContent === ${JSON.stringify(T.q0)}`));
    // Jede Szene und Gruppe als eigene Zeile mit Pille; Geräte zuerst, dann Gruppen, dann Szenen
    const kinds = await ev(`return [...r.querySelectorAll('${win} [data-rt="dev"]')].map((x) => x.querySelector(".mg-kind")?.textContent.trim() || "")`);
    const firstKind = kinds.findIndex((k) => k);
    check(`[${tag}] Geräte ohne Pille zuerst, dann Gruppe "${T.kindGroup}", dann Szenen "${T.kindScene}" mit Pille`, firstKind > 0 && kinds.slice(0, firstKind).every((k) => !k) && kinds[firstKind] === T.kindGroup && kinds.at(-1) === T.kindScene && kinds.filter((k) => k === T.kindScene).length === 2, JSON.stringify(kinds));
    check(`[${tag}] Filter oben: Alle, Geräte, "${T.groups}", "${T.scenes}" mit Zahlen`, await ev(`const t = [...r.querySelectorAll('${win} [data-rt="dev-kind"]')].map((x) => x.querySelector(".tab-l").textContent.trim() + ":" + x.querySelector(".tab-s").textContent.trim()); return t.length === 4 && t[0].startsWith(${JSON.stringify(T.all)}) && t[2] === ${JSON.stringify(T.groups + ":1")} && t[3] === ${JSON.stringify(T.scenes + ":2")}`));
    await tap(`${win} [data-rt="dev-kind"][data-v="scene"]`);
    check(`[${tag}] Filter "${T.scenes}": nur die zwei Szenen`, await wait(`const rows = [...r.querySelectorAll('${win} [data-rt="dev"]')]; return rows.length === 2 && rows.every((x) => x.dataset.id === "@scenes")`));
    await p.screenshot({ path: `${outDir}/routinescene-${tag.replace("/", "-")}-0b.png` });
    await tap(`${win} [data-rt="dev-kind"][data-v="group"]`);
    check(`[${tag}] Filter "${T.groups}": nur die Gruppe`, await wait(`const rows = [...r.querySelectorAll('${win} [data-rt="dev"]')]; return rows.length === 1 && rows[0].dataset.ent === "light.wohnzimmer"`));
    await tap(`${win} [data-rt="dev-kind"][data-v="device"]`);
    check(`[${tag}] Filter "Geräte": keine Pille`, await wait(`const rows = [...r.querySelectorAll('${win} [data-rt="dev"]')]; return rows.length > 1 && rows.every((x) => !x.querySelector(".mg-kind"))`));
    await tap(`${win} [data-rt="dev-kind"][data-v="all"]`);
    await p.screenshot({ path: `${outDir}/routinescene-${tag.replace("/", "-")}-0.png` });

    // Suche findet eine Szene über ihren Namen (auch wenn "Szenen" selbst anders heisst)
    await ev(`const i = r.querySelector('${win} input[data-rt="dev-search"]'); i.focus(); i.value = ${JSON.stringify(T.film)}; i.dispatchEvent(new Event("input", { bubbles: true }))`);
    check(`[${tag}] Suche "${T.film}" zeigt die Szene selbst als eigene Zeile (mit Art "${T.kindScene}"), nicht nur "${T.scenes}"`, await wait(`const rows = [...r.querySelectorAll('${win} [data-rt="dev"]')]; return rows.length === 1 && rows[0].dataset.id === "@scenes" && rows[0].dataset.ent === "scene.film" && rows[0].querySelector(".mg-kind").textContent.trim() === ${JSON.stringify(T.kindScene)} && rows[0].querySelector("b").textContent.trim().toLowerCase() === ${JSON.stringify(T.film)}`));
    // Antippen und "Weiter": die Szene ist auf der Seite "Was" schon gewählt, die Aktion gesetzt
    await tap(`${win} [data-rt="dev"][data-ent="scene.film"]`);
    await tap(`${win} [data-rt="nav-next"]`);
    check(`[${tag}] Szene aus der Suche: auf "Was" vorgewählt, Aktion "${T.act}", Weiter ohne weiteren Tipp möglich`, await wait(`const d = r.querySelector("${win}"); return d.querySelector('.mg-pick[data-id="scene.film"][aria-checked="true"]') && d.querySelector('[data-rt="action"]')?.textContent.trim() === ${JSON.stringify(T.act)} && !d.querySelector('[data-rt="nav-next"]').disabled`));
    await tap(`${win} [data-rt="nav-back"]`);
    await wait(`return r.querySelector('${win} input[data-rt="dev-search"]')`);
    // Gruppe über ihren Namen: eigene Zeile mit Art "${T.kindGroup}"
    await ev(`const i = r.querySelector('${win} input[data-rt="dev-search"]'); i.value = ${JSON.stringify(T.grp)}; i.dispatchEvent(new Event("input", { bubbles: true }))`);
    check(`[${tag}] Suche "${T.grp}" zeigt die Gruppe als eigene Zeile (Art "${T.kindGroup}")`, await wait(`const g = r.querySelector('${win} [data-rt="dev"][data-ent="light.wohnzimmer"]'); return g && g.dataset.id === "@groups" && g.querySelector(".mg-kind").textContent.trim() === ${JSON.stringify(T.kindGroup)}`));
    await ev(`const i = r.querySelector('${win} input[data-rt="dev-search"]'); i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true }))`);
    await wait(`return r.querySelectorAll('${win} [data-rt="dev"]').length > 3`);

    // Szene
    await tap(`${win} [data-rt="dev"][data-ent="scene.abendlicht"]`);
    await tap(`${win} [data-rt="nav-next"]`);
    await wait(`return r.querySelectorAll("${win} .mg-pick").length === 2`);
    check(`[${tag}] Schritt 2: nur die Szenen, Kopf nennt "${T.scenes}"`, await ev(`const d = r.querySelector("${win}"); return d.querySelectorAll(".mg-pick").length === 2 && d.querySelector(".mgw-t small")?.textContent.trim() === ${JSON.stringify(T.scenes)}`));
    await tap(`${win} .mg-pick[data-id="scene.abendlicht"]`);
    check(`[${tag}] Aktion: nur "${T.act}", Hinweis "kein Zurückschalten", Satz "${T.sentence}"`, await wait(`const d = r.querySelector("${win}"); const a = [...d.querySelectorAll('[data-rt="action"]')]; return a.length === 1 && a[0].textContent.trim() === ${JSON.stringify(T.act)} && d.querySelector(".mg-hint")?.textContent.trim() === ${JSON.stringify(T.noBack)} && d.querySelector(".rt-result")?.textContent.includes(${JSON.stringify(T.sentence)})`));
    check(`[${tag}] Szene: fünf Schritte (kein Optionen-, kein Zurückschalten-Schritt)`, (await stepsOf()) === 5, String(await stepsOf()));
    await p.screenshot({ path: `${outDir}/routinescene-${tag.replace("/", "-")}-1.png` });
    await tap(`${win} [data-rt="nav-quick"]`);
    const saved = (await (async () => { for (let i = 0; i < 25; i++) { const c = await calls("device_panel/routine_save"); if (c.length) return c; await p.waitForTimeout(200); } return []; })()).at(-1)?.routine;
    check(`[${tag}] gespeichert: Sammelstelle "@scenes", Aktion "activate", ohne Zurückschalten`, saved && saved.device_id === "@scenes" && saved.entity_id === "scene.abendlicht" && saved.action === "activate" && !saved.back_s, JSON.stringify(saved));
    check(`[${tag}] Übersicht: Gruppe "${T.scenes}" mit der Routine, ohne "Gerät öffnen"`, await wait(`const d = r.querySelector("dialog.rtall-dlg"); const h = [...d.querySelectorAll(".mg-dhead")].find((x) => x.querySelector("b").textContent.trim() === ${JSON.stringify(T.scenes)}); return !!h && !h.closest(".mg-dcard").querySelector('[data-rta="routine-device"]') && (h.getAttribute("aria-expanded") === "true" || (h.click(), true))`));
    await wait(`const d = r.querySelector("dialog.rtall-dlg"); return d.textContent.includes("Abendlicht")`);
    check(`[${tag}] Übersicht zeigt Szenen-Symbol und Satz`, await ev(`const d = r.querySelector("dialog.rtall-dlg"); return d.textContent.includes("🎬") && d.textContent.includes(${JSON.stringify(T.sentence)})`));
    // Bearbeiten lädt über die Sammelstelle
    await p.evaluate(() => { window.__wsCalls = []; });
    await tap('dialog.rtall-dlg [data-rta="routine-edit"]');
    check(`[${tag}] Bearbeiten: routine_get mit "@scenes", Assistent offen`, await wait(`return r.querySelector("${win}")?.open`) && (await calls("device_panel/routine_get")).some((c) => c.device_id === "@scenes"));
    await tap(`${win} [data-rt="close"]`);
    await wait(`return !r.querySelector("${win}")?.open`);

    // Viele Szenen: auf der Seite "Was" gibt es eine Suche
    await p.evaluate(() => { window.__manyScenes = true; });
    await tap('dialog.rtall-dlg [data-rta="routine-add"]');
    await wait(`return r.querySelector("${win} [data-rt='dev'][data-ent='scene.film']")`);
    await tap(`${win} [data-rt="dev"][data-ent="scene.film"]`);
    await tap(`${win} [data-rt="nav-next"]`);
    await wait(`return r.querySelectorAll("${win} .mg-pick").length === 14`);
    check(`[${tag}] 14 Szenen: Suchfeld auf der Seite "Was"; "büro szene 1" zeigt 4 (1, 10, 11, 12), die Wahl bleibt beim Filtern`, await ev(`return !!r.querySelector('${win} input[data-rt="ent-search"]')`));
    await tap(`${win} .mg-pick[data-id="scene.film"]`);
    await ev(`const i = r.querySelector('${win} input[data-rt="ent-search"]'); i.focus(); i.value = "büro szene 1"; i.dispatchEvent(new Event("input", { bubbles: true }))`);
    check(`[${tag}] Suche: vier Treffer plus die gewählte Szene, Fokus bleibt im Feld`, await wait(`const ids = [...r.querySelectorAll('${win} .mg-pick')].map((x) => x.dataset.id); return ids.length === 5 && ids.includes("scene.film") && r.activeElement?.matches('input[data-rt="ent-search"]')`));
    await ev(`const i = r.querySelector('${win} input[data-rt="ent-search"]'); i.value = "zzz"; i.dispatchEvent(new Event("input", { bubbles: true }))`);
    check(`[${tag}] Suche ohne Treffer: nur die gewählte bleibt, sonst nichts`, await wait(`return r.querySelectorAll('${win} .mg-pick').length === 1`));
    await p.evaluate(() => { window.__manyScenes = false; });
    await ev(`r.host._routines.closeWizard()`); // mit Änderung gäbe es sonst die Rückfrage "verwerfen?"
    await wait(`return !r.querySelector("${win}")?.open`);
    // Gruppe
    await tap('dialog.rtall-dlg [data-rta="routine-add"]');
    await wait(`return r.querySelector("${win} [data-rt='dev'][data-ent='light.wohnzimmer']")`);
    await tap(`${win} [data-rt="dev"][data-ent="light.wohnzimmer"]`);
    await tap(`${win} [data-rt="nav-next"]`);
    await wait(`return r.querySelector("${win} .mg-pick")`);
    await tap(`${win} .mg-pick[data-id="light.wohnzimmer"]`);
    check(`[${tag}] Gruppe: Ein/Aus/Umschalten, sieben Schritte (mit Optionen und Zurückschalten)`, await wait(`return r.querySelectorAll('${win} [data-rt="action"]').length === 3`) && (await stepsOf()) === 7, String(await stepsOf()));
    check(`[${tag}] keine Konsolenfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALLE BESTANDEN" : "FEHLER");
process.exit(ok ? 0 : 1);
