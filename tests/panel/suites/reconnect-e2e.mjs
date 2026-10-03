// Verbindung zu HA weg (Handy im Ruhezustand, seit 0.27.1): kein
// "[object Object]", die Liste bleibt stehen, ein Hinweis erscheint, und das
// Panel fragt von allein wieder ab. Ein echter Fehler mit Text bleibt sichtbar.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = { de: { hint: "Verbindung zu Home Assistant unterbrochen", err: "Laden fehlgeschlagen: Speicher voll" }, en: { hint: "Connection to Home Assistant interrupted", err: "Loading failed: Speicher voll" } };

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
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wait = (code, ms = 8000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
    const rows = () => ev(`return r.querySelectorAll(".dev").length`);
    const before = await rows();

    for (const kind of ["number", "object", "empty", "hang"]) {
      // Hang wartet auf die 20 s nicht ab: Prüfung nur die Fälle mit sofortigem Fehler plus Wiederkehr
      if (kind === "hang") continue;
      await p.evaluate((k) => { window.__wsFail = k; }, kind);
      await ev(`r.host._wake()`);
      check(`[${tag}] ${kind}: Hinweis statt Fehler`, await wait(`return r.host._offline === true && r.querySelector(".foot .offline-note")`) && (await text(".foot .offline-note")).startsWith(T.hint), await text(".foot"));
      check(`[${tag}] ${kind}: Liste bleibt, kein [object Object]`, (await rows()) === before && !(await ev(`return r.textContent.includes("[object Object]")`)));
      await p.evaluate(() => { window.__wsFail = null; });
      check(`[${tag}] ${kind}: holt sich von allein zurück`, await wait(`return r.host._offline === false && !r.querySelector(".foot .offline-note")`, 9000));
    }

    // Echter Fehler mit Text bleibt ein Fehler
    await p.evaluate(() => { window.__wsFail = "text"; });
    await ev(`r.host._wake()`);
    check(`[${tag}] Fehler mit Text bleibt sichtbar`, (await wait(`return !!r.querySelector(".list .note")?.textContent.includes("Speicher voll")`)) && (await text(".list .note")) === T.err, await text(".list .note"));
    await p.evaluate(() => { window.__wsFail = null; });
    await ev(`r.host._wake()`);
    check(`[${tag}] danach wieder die Liste`, await wait(`return r.querySelectorAll(".dev").length > 1`));

    // Erster Abruf ohne Verbindung: "wird geladen" mit Hinweis, dann die Liste
    await p.addInitScript(() => { window.__wsFail = "number"; });
    await p.reload();
    const f2 = await (await p.waitForSelector("#panel-frame")).contentFrame();
    const ev2 = (c) => f2.evaluate(new Function(`const r=${R};` + c));
    await f2.waitForFunction(new Function(`return !!${R}?.querySelector(".list .note")`), null, { timeout: 15000 }).catch(() => {});
    check(`[${tag}] erster Abruf offline: Hinweis, kein Fehler`, (await ev2(`return (r.querySelector(".list .note")?.textContent || "")`)).includes(T.hint), await ev2(`return r.querySelector(".list .note")?.textContent`));
    await p.evaluate(() => { window.__wsFail = null; });
    check(`[${tag}] erster Abruf: Liste kommt von allein`, await f2.waitForFunction(new Function(`return ${R}.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 }).then(() => true, () => false));

    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
