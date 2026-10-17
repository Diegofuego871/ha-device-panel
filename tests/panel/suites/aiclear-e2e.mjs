// KI-Einschätzung entfernen (2.86.0): Knopf "Entfernen" in der Fusszeile der Karte; löscht sie im Pop-up und im Speicher (ai_clear), sie kommt
// beim Öffnen nicht wieder, der Knopf "Mit KI einschätzen" steht wieder da. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

const TEXT = {
  de: { clear: "Entfernen", button: "Mit KI einschätzen" },
  en: { clear: "Remove", button: "Assess with AI" },
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
    await p.evaluate(() => { window.__aiNoNext = true; window.__opts.ai_assessment = true; });
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const calls = (type) => p.evaluate((t) => window.__wsCalls.filter((m) => m.type === t), type);
    const open = async (id) => { await ev(`r.host._openDevice(${JSON.stringify(id)})`); await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('select[data-dlg="conn"]')`); };
    const close = async () => { await ev(`r.querySelector("dialog.device").close()`); await wait(`return !r.querySelector("dialog.device").open`); };

    await ev(`r.host._aiOn = true`);
    await open("b");
    check(`[${tag}] ohne Einschätzung kein Knopf "${T.clear}"`, !(await ev(`return !!r.querySelector('[data-dlg="ai-clear"]')`)));
    await tap(".ai-btn");
    await wait(`return !!r.querySelector(".ai-title")`);
    check(`[${tag}] Einschätzung da: Fusszeile mit "Neu erstellen" und "${T.clear}"`, (await text(".ai-foot")).includes(T.clear) && (await ev(`return r.querySelectorAll(".ai-foot .linkbtn").length`)) === 2);
    await p.screenshot({ path: `${outDir}/aiclear-${tag.replace("/", "-")}.png` });
    await tap('[data-dlg="ai-clear"]');
    check(`[${tag}] "${T.clear}": Karte weg, Knopf "${T.button}" wieder da`, (await wait(`return !r.querySelector(".ai-card") && !!r.querySelector(".ai-btn")`)) && (await text(".ai-btn")) === T.button);
    check(`[${tag}] ai_clear genau einmal mit dem Gerät aufgerufen`, await p.waitForFunction(() => window.__wsCalls.filter((m) => m.type === "device_panel/ai_clear" && m.device_id === "b").length === 1, null, { timeout: 4000 }).then(() => true, () => false));
    // Schliessen und Öffnen: bleibt weg (auch der Server liefert nichts mehr), keine neue KI-Anfrage
    await close();
    await ev(`r.host._ai.clear(); r.host._aiLastTried.clear()`);
    await open("b");
    check(`[${tag}] nach erneutem Öffnen bleibt sie weg, keine neue Anfrage an die KI`, (await wait(`return !!r.querySelector(".ai-btn")`)) && !(await ev(`return !!r.querySelector(".ai-card")`)) && (await calls("device_panel/ai_assess")).length === 1);
    // Neu erstellen geht weiter
    await tap(".ai-btn");
    check(`[${tag}] danach lässt sie sich neu erstellen`, await wait(`return !!r.querySelector(".ai-title") && r.querySelectorAll(".ai-foot .linkbtn").length === 2`));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
