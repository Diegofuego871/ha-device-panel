// Launcher, Gruppe "Device Panel": die Apps "Ansicht" (Auge mit Zahnrad, blau) und "Einstellungen" (2.85.0): da, in Farbe, öffnen das Richtige,
// ausblendbar (kein Schloss), standardmässig sichtbar. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { view: "Ansicht", settings: "Einstellungen", settingsTitle: "Einstellungen" },
  en: { view: "View", settings: "Settings", settingsTitle: "Settings" },
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
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
    const D = "dialog.apps-dlg";
    const open = async () => { await tap(".apps-btn"); await wait(`return r.querySelector("${D}")?.open`); };
    const tile = (id) => `${D} [data-ap="open"][data-id="${id}"]`;

    await open();
    check(`[${tag}] Gruppe Device Panel: Apps "${T.view}" und "${T.settings}" sind da`, await ev(`const t = (id) => r.querySelector('${tile("view")}'.replace("view", id)); return !!t("view") && !!t("settings") && t("view").textContent.includes(${JSON.stringify(T.view)}) && t("settings").textContent.includes(${JSON.stringify(T.settings)})`));
    check(`[${tag}] Symbole in Farbe (Kreis blau und braungrau), "Ansicht" mit zusammengesetztem Symbol (Maske, Zahnrad)`, await ev(`const c = (id) => getComputedStyle(r.querySelector('${D} [data-id="' + id + '"] .ap-ico')).backgroundColor; return c("view") === "rgb(30, 136, 229)" && c("settings") === "rgb(141, 110, 99)" && !!r.querySelector('${D} [data-id="view"] svg mask') && r.querySelector('${D} [data-id="view"] svg').querySelectorAll("path").length === 2`));
    await p.screenshot({ path: `${outDir}/launcherview-${lang}-${mobile ? "mobile" : "desktop"}.png` });

    // Ansicht: der Dialog "Ansicht" (Einstellungen im Modus Ansicht, Handy Vollbild); der Launcher schliesst
    await tap(tile("view"));
    check(`[${tag}] "${T.view}" öffnet den Dialog Ansicht, Launcher zu`, (await wait(`return r.querySelector("dialog.settings")?.open && !r.querySelector("${D}").open`)));
    await ev(`const d = r.querySelector("dialog.settings"); d.querySelector('.dlg-actions [data-set="close"]').click()`);
    await wait(`return !r.querySelector("dialog.settings").open`);

    // Einstellungen
    await open();
    await tap(tile("settings"));
    check(`[${tag}] "${T.settings}" öffnet die Einstellungen`, await wait(`return r.querySelector("dialog.settings")?.open && !r.querySelector("${D}").open`));
    await ev(`r.querySelector("dialog.settings").close()`);

    // Beide ausblendbar (kein Schloss), standardmässig sichtbar; ausgeblendet fehlen sie im Launcher und erscheinen im Bearbeiten-Modus abgeblendet
    await open();
    await tap(`${D} [data-ap="edit"]`);
    check(`[${tag}] Bearbeiten: beide mit Auge (nicht gesperrt)`, await ev(`return ["view", "settings"].every((id) => { const row = r.querySelector('${D} .ap-row [data-ap="hide"][data-id="' + id + '"]') || r.querySelector('${D} [data-ap="hide"][data-id="' + id + '"]'); return !!row && !row.disabled; })`));
    await tap(`${D} [data-ap="hide"][data-id="view"]`);
    await tap(`${D} [data-ap="hide"][data-id="settings"]`);
    await tap(`${D} [data-ap="done"]`);
    check(`[${tag}] ausgeblendet: beide fehlen im Launcher, die Knöpfe in der Kopfzeile bleiben`, (await wait(`return !r.querySelector('${tile("view")}') && !r.querySelector('${tile("settings")}')`)) && (await ev(`return !!r.querySelector(".gear-btn") && !!r.querySelector(".view-btn, [data-view-open]")`)));
    check(`[${tag}] gespeichert (Benutzerdaten)`, await ev(`const h = r.host._apps.data.hidden || []; return h.includes("view") && h.includes("settings")`));
    check(`[${tag}] kein fehlender Text, keine JS-Fehler`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)) && errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
