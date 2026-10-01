// Deep-Link aus einer Meldung: /device-panel?device=<id> öffnet das Popup des
// Geräts, beim Laden und wenn HA bei offenem Panel nur die Adresse ändert.
// Der Parameter verschwindet danach. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { gone: "Dieses Gerät gibt es nicht mehr oder es wird nicht mehr überwacht." },
  en: { gone: "This device no longer exists or is no longer monitored." },
};

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&device=c`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const text = (sel) => f.evaluate(new Function(`return (${R}.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`));

    check(`[${tag}] Popup beim Laden geöffnet`, await wait(`return r.querySelector("dialog.device")?.open && r.querySelector("dialog.device h2")?.textContent === "Thermostat Bad"`), await text("dialog.device h2"));
    const search = await p.evaluate(() => location.search);
    check(`[${tag}] Parameter entfernt`, search === `?lang=${lang}`, search);
    await f.evaluate(new Function(`${R}.querySelector('dialog.device [data-dlg="close"]').click()`));
    check(`[${tag}] geschlossen`, await wait(`return !r.querySelector("dialog.device").open`));

    // HA ändert bei offenem Panel nur die Adresse (Tipp auf eine Meldung).
    await p.evaluate((l) => { history.pushState(null, "", `?lang=${l}&device=e`); window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } })); }, lang);
    check(`[${tag}] Popup nach Adresswechsel`, await wait(`return r.querySelector("dialog.device")?.open && r.querySelector("dialog.device h2")?.textContent === "Fensterkontakt Küche"`), await text("dialog.device h2"));
    check(`[${tag}] Parameter wieder entfernt`, (await p.evaluate(() => location.search)) === `?lang=${lang}`);
    await f.evaluate(new Function(`${R}.querySelector('dialog.device [data-dlg="close"]').click()`));
    await wait(`return !r.querySelector("dialog.device").open`);

    // Unbekanntes Gerät (gelöscht, ausgeblendet): Hinweis statt Fehler
    await p.evaluate((l) => { history.pushState(null, "", `?lang=${l}&device=gibtsnicht`); window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } })); }, lang);
    check(`[${tag}] unbekanntes Gerät: Hinweis`, await wait(`return r.querySelector("dialog.device")?.open && (r.querySelector("dialog.device .dlg-note")?.textContent || "") === ${JSON.stringify(TEXT[lang].gone)}`), await text("dialog.device .dlg-note"));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
