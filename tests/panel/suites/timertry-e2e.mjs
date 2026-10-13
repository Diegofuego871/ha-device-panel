// Testknopf "Jetzt ausführen" im Timer-Assistenten (2.28.0): schaltet die gewählte Kombination sofort, ohne Rückschaltung.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { off: "aus", btn: "Jetzt ausführen", done: "Ausgeführt.", fail: "Nicht ausgeführt: Das Gerät ist nicht erreichbar." },
  en: { off: "off", btn: "Run now", done: "Done.", fail: "Not run: The device is unreachable." },
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
    const win = "dialog.timer-dlg";

    const tries = () => p.evaluate(() => window.__timers?.tries || []);
    await tap(".toolbar .tmall-btn");
    await wait(`return r.querySelector("dialog.tmall-dlg")?.open`);
    await tap('dialog.tmall-dlg [data-tma="timer-add"]');
    await wait(`return r.querySelectorAll('${win} [data-tm="dev"]').length > 0`);
    await tap(`${win} [data-tm="dev"]`);
    await tap(`${win} [data-tm="nav-next"]`);
    await wait(`return r.querySelectorAll('${win} [data-tm="pick"]').length > 0`);
    await tap(`${win} [data-tm="pick"]`);
    await wait(`return !!r.querySelector('${win} [data-tm="try"]')`);
    check(`[${tag}] Schritt "Was schalten": Knopf "${T.btn}" unter dem Ergebnis`, await ev(`const d = r.querySelector("${win}"); const b = d.querySelector('[data-tm="try"]'); const e = d.querySelector(".tm-result"); return b.textContent.trim() === ${JSON.stringify(T.btn)} && b.getBoundingClientRect().top >= e.getBoundingClientRect().bottom - 1`));
    await tap(`${win} [data-tm="action"][data-v="off"]`);
    const before = await ev(`return r.querySelector('${win} [data-tm="pick"][aria-checked="true"] .mg-val')?.textContent.trim()`);
    await tap(`${win} [data-tm="try"]`);
    check(`[${tag}] Tippen: timer_try mit Entität und Aktion, Rückmeldung "${T.done}", kein Timer gespeichert`, await wait(`return r.querySelector('${win} .mg-testrow .opt-short')?.textContent === ${JSON.stringify(T.done)}`) && (await tries()).length === 1 && !!(await tries())[0].entity_id && !!(await tries())[0].action && (await calls("device_panel/timer_save")).length === 0);
    check(`[${tag}] Zustand der Karte aktualisiert sich ("${T.off}", vorher "${before}")`, before !== T.off && await wait(`return r.querySelector('${win} [data-tm="pick"][aria-checked="true"] .mg-val')?.textContent.trim() === ${JSON.stringify(T.off)}`));
    await p.screenshot({ path: `${outDir}/timertry-${tag.replace("/", "-")}.png` });
    await p.evaluate(() => { window.__timerTryFail = "unavailable"; });
    await tap(`${win} [data-tm="try"]`);
    check(`[${tag}] Fehler: Meldung "${T.fail}"`, await wait(`return r.querySelector('${win} .mg-testrow .opt-error')?.textContent === ${JSON.stringify(T.fail)}`));
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("|"));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
