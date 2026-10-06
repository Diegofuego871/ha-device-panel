// Weitere Filter-Chips ausblenden (1.11.0, Wunsch des Nutzers): Einstellungen,
// Darstellung › Filter-Chips, Tabelle "Weitere Chips" (Bereich, Integration,
// Nur Probleme, Batterie, Batterie niedrig, Schwacher Empfang, Update,
// Eigene Einstellung, Neu), gilt für alle Benutzer; ein ausgeblendeter Chip
// hebt seinen Filter auf. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const KEYS = ["area", "integration", "offline", "problems", "batteries", "battery", "signal", "update", "override", "new"];
const TEXT = {
  de: {
    title: "Filter-Chips", conn: "Verbindungsart", area: "Bereich", integ: "Integration", problems: "Warnungen", signal: "Schwacher Empfang", neu: "Neu", overrideLabel: "Eigene Einstellung",
    labels: ["Bereich", "Integration", "Ausgefallen", "Warnungen", "Batterie", "Batterie niedrig", "Schwacher Empfang", "Update verfügbar", "Eigene Einstellung", "Neu"],
    sumTwo: "2 Filter-Chips ausgeblendet", sumAll: "20 Filter-Chips ausgeblendet", intro: /^Alle Chips über der Liste, auch "Alle" und die Verbindungsarten\. Von oben nach unten ist von links nach rechts; am Griff ziehen\./,
  },
  en: {
    title: "Filter chips", conn: "Connection type", area: "Area", integ: "Integration", problems: "Warnings", signal: "Weak signal", neu: "New", overrideLabel: "Own setting",
    labels: ["Area", "Integration", "Offline", "Warnings", "Battery", "Low battery", "Weak signal", "Update available", "Own setting", "New"],
    sumTwo: "2 filter chips hidden", sumAll: "20 filter chips hidden", intro: /^All chips above the list, including "All" and the connection types\. Top to bottom is left to right; drag by the handle\./,
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
    let f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const lastSet = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_options").at(-1)?.values);
    const present = () => ev(`const c=r.querySelector(".chips"); return { area: !!c.querySelector(".chip.area:not(.integ)"), integration: !!c.querySelector(".chip.integ"), problems: !!c.querySelector("[data-problems]"), hints: [...c.querySelectorAll("[data-hint]")].map(x=>x.dataset.hint).join() }`);
    const openChips = async () => {
      if (!(await ev(`return r.querySelector("dialog.settings")?.open`))) {
        await tap(".gear-btn");
        await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
      }
      if ((await ev(`return r.querySelector('[data-set="section"][data-id="look"]').getAttribute("aria-expanded")`)) !== "true") await tap('[data-set="section"][data-id="look"]');
      await tap('[data-set="subtab"][data-key="chips"]');
      return wait(`return !!r.querySelector('input[data-list="hide_chips"]')`);
    };
    const save = async () => {
      await tap('dialog.settings [data-set="save"]');
      if (!(await wait(`return r.querySelector("dialog.settings").open && r.querySelector(".set-count")?.classList.contains("saved")`))) return false;
      await tap('dialog.settings .dlg-actions [data-set="close"]');
      return wait(`return !r.querySelector("dialog.settings").open`);
    };
    const total = await ev(`return r.querySelectorAll(".dev").length`);

    // Ausgangslage: alle Chips da
    const start = await present();
    check(`[${tag}] Ausgangslage: Bereich, Integration, Warnungen und Hinweise da`, start.area && start.integration && start.problems && start.hints === "batteries,battery,signal,update,new", JSON.stringify(start));

    // Tabelle "Weitere Chips"
    check(`[${tag}] Reiter öffnet`, await openChips());
    const heads = await ev(`return [...r.querySelectorAll(".set-sec-body .ex-title")].map(x=>x.textContent)`);
    check(`[${tag}] eine Überschrift "${T.title}" (seit 1.14.0 eine Liste)`, JSON.stringify(heads) === JSON.stringify([T.title]), JSON.stringify(heads));
    const rows = await ev(`return [...r.querySelectorAll('input[data-list="hide_chips"]')].map(i=>i.dataset.value + (i.checked ? "+" : "-")).join()`);
    check(`[${tag}] zehn Zeilen in fester Reihenfolge, alle an`, rows === KEYS.map((k) => `${k}+`).join(), rows);
    const labels = await ev(`return [...r.querySelectorAll('input[data-list="hide_chips"]')].map(i=>i.closest(".ex-row").querySelector(".ex-name").firstChild.textContent)`);
    check(`[${tag}] Beschriftungen`, JSON.stringify(labels) === JSON.stringify(T.labels), JSON.stringify(labels));
    check(`[${tag}] Hinweistext`, T.intro.test(await ev(`return r.querySelector('input[data-list="hide_chips"]').closest(".set-sec-body").querySelector(".ex-intro").textContent`)));

    // Filter aktiv machen: Probleme, Hinweis "Schwacher Empfang", Bereich Küche, Integration Zigbee
    await ev(`const h=r.host; h._problems = true; h._hint = "signal"; h._view.areas = ["kueche"]; h._view.integs = ["zha"]; h._saveView(); h._render()`);
    check(`[${tag}] Filter aktiv: Liste gekürzt`, (await ev(`return r.querySelectorAll(".dev").length`)) < total);

    // Bereich, Integration, Warnungen und "Schwacher Empfang" ausblenden
    await tap('input[data-list="hide_chips"][data-value="area"]');
    await tap('input[data-list="hide_chips"][data-value="integration"]');
    check(`[${tag}] Zusammenfassung "${T.sumTwo}"`, (await text('[data-id="look"] .set-sec-sum')).includes(T.sumTwo), await text('[data-id="look"] .set-sec-sum'));
    await tap('input[data-list="hide_chips"][data-value="problems"]');
    await tap('input[data-list="hide_chips"][data-value="signal"]');
    await ev(`r.querySelector('input[data-list="hide_chips"]').scrollIntoView({ block: "center" })`);
    await p.screenshot({ path: `${outDir}/hidechips-settings-${tag.replace("/", "-")}.png` });
    check(`[${tag}] gespeichert (feste Reihenfolge)`, (await save()) && JSON.stringify(await lastSet()) === JSON.stringify({ hide_chips: ["area", "integration", "problems", "signal"] }), JSON.stringify(await lastSet()));
    const after = await wait(`const c=r.querySelector(".chips"); return !c.querySelector(".chip.area") && !c.querySelector("[data-problems]") && ![...c.querySelectorAll("[data-hint]")].some(x=>x.dataset.hint==="signal")`) && await present();
    check(`[${tag}] Chips weg: Bereich, Integration, Warnungen, Schwacher Empfang`, after && !after.area && !after.integration && !after.problems && after.hints === "batteries,battery,update,new", JSON.stringify(after));
    check(`[${tag}] Filter aufgehoben: alle Geräte, "Alle" aktiv`, await wait(`return r.querySelectorAll(".dev").length === ${total} && r.querySelector('.chip[data-conn="all"]').classList.contains("on")`), String(await ev(`return r.querySelectorAll(".dev").length`)));
    check(`[${tag}] Zustand zurückgesetzt (Probleme, Hinweis, Bereich, Integration)`, await ev(`const h=r.host; return h._problems === false && h._hint === null && !(h._view.areas||[]).length && !(h._view.integs||[]).length`));
    check(`[${tag}] Kopf wieder für alle Geräte`, !(await ev(`return !!r.querySelector(".hero .kt .k .scope")`)));
    check(`[${tag}] kein hängender Trenner`, await ev(`const c=r.querySelector(".chips"); const k=[...c.children]; return k.every((x,i)=>!x.classList.contains("vsep") || (i>0 && i<k.length-1 && !k[i-1].classList.contains("vsep") && !k[i+1].classList.contains("vsep") && !k[i+1].classList.contains("seg-sw")))`));
    await p.screenshot({ path: `${outDir}/hidechips-list-${tag.replace("/", "-")}.png` });

    // Bleibt nach dem erneuten Abruf (gilt für alle, beim Backend gespeichert)
    await ev(`r.host._fetch(true)`);
    await wait(`return true`);
    const reloaded = await present();
    check(`[${tag}] nach erneutem Abruf weiter ausgeblendet`, !reloaded.area && !reloaded.integration && !reloaded.problems && !reloaded.hints.includes("signal"), JSON.stringify(reloaded));

    // "Alle umschalten": gemischt → alle an → alle aus; dann nur "Alle" und die Verbindungsart
    await openChips();
    await tap('input[data-list-all="chips"]');
    check(`[${tag}] gemischt: zuerst alle an`, await ev(`return [...r.querySelectorAll('input[data-list="hide_chips"]')].every(i=>i.checked)`));
    await tap('input[data-list-all="chips"]');
    check(`[${tag}] alle aus`, await ev(`return [...r.querySelectorAll('input[data-list="hide_chips"]')].every(i=>!i.checked)`));
    check(`[${tag}] Zusammenfassung "${T.sumAll}" (plus Verbindungsart)`, (await text('[data-id="look"] .set-sec-sum')).includes(T.sumAll), await text('[data-id="look"] .set-sec-sum'));
    const savedAll = (await save()) && (await lastSet());
    check(`[${tag}] alle zehn Chips und alle zehn Verbindungsarten gespeichert`, savedAll && savedAll.hide_chips?.join() === KEYS.join() && savedAll.hide_connections?.length === 10, JSON.stringify(savedAll));
    const none = await wait(`const c=r.querySelector(".chips"); return !c.querySelector("[data-hint]") && !c.querySelector("[data-problems]")`) && await present();
    check(`[${tag}] nur "Alle" bleibt`, none && !none.area && !none.integration && !none.problems && none.hints === "", JSON.stringify(none));
    check(`[${tag}] nur "Alle" da, kein Trenner`, await ev(`const c=r.querySelector(".chips"); return c.querySelectorAll(".chip").length === 1 && !!c.querySelector('[data-conn="all"]') && !c.querySelector(".vsep")`));
    check(`[${tag}] Geräte bleiben sichtbar`, (await ev(`return r.querySelectorAll(".dev").length`)) === total);

    // Wieder einblenden
    await openChips();
    await tap('input[data-list-all="chips"]');
    const savedBack = (await save()) && (await lastSet());
    check(`[${tag}] alle wieder an`, savedBack && savedBack.hide_chips?.length === 0 && savedBack.hide_connections?.length === 0, JSON.stringify(savedBack));
    const back = await wait(`return !!r.querySelector(".chips .chip.integ") && !!r.querySelector(".chips [data-problems]")`) && await present();
    check(`[${tag}] Chips zurück (ohne alten Filter)`, back && back.area && back.integration && back.problems && back.hints === "batteries,battery,signal,update,new" && (await ev(`return r.querySelectorAll(".dev").length`)) === total, JSON.stringify(back));

    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "OK" : "FEHLER");
process.exit(ok ? 0 : 1);
