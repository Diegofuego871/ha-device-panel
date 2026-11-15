// Interaktive Tour (2.227.0, docs/tour): dieselbe Lernseite wie im Panel als eigene Seite (GitHub Pages). Der Testserver liefert das Repository wie
// Pages unter /ha-device-panel/. Geprüft: Seite lädt ohne Fehler, neun Kacheln, Thema öffnen, Weiter und Zurück, Adresse (#bat) folgt dem Thema und
// öffnet es beim Laden, Sprache und Darstellung umschalten (Kapsel gleitet), kein Schliessen-Knopf, kein Überlauf, keine unaufgelösten Texte,
// Deutsch und Englisch, Desktop und Handy, echte Klicks und Tipps.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const URL0 = "http://127.0.0.1:8950/ha-device-panel/docs/tour/";
const R = `document.getElementById("tour").shadowRoot`;
const IDS = ["out", "bat", "wiz", "sys", "bkp", "view", "push", "rt", "cards", "lau"];
const T = {
  de: { title: "Device Panel kennenlernen", name1: "Ausgefallene Geräte", name2: "Batterie-Warnungen", sub: "Zehn Themen, je etwa 2 Minuten", wiz: "Einrichtungsassistent", wizKey: "Nichts passiert, bis du fertig bist", other: "English" },
  en: { title: "Get to know Device Panel", name1: "Offline devices", name2: "Battery warnings", sub: "Ten topics, about 2 minutes each", wiz: "Setup wizard", wizKey: "Nothing happens until you are done", other: "Deutsch" },
};

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    const L = T[lang];
    await p.goto(`${URL0}?lang=${lang}&theme=dark`);
    await p.waitForFunction(new Function(`return !!${R}?.querySelector(".lrn-card")`), null, { timeout: 15000 });
    const ev = (c) => p.evaluate(new Function(`const r=${R};` + c));
    const wait = (code, ms = 5000) => p.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
    const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.innerText || "").replace(/\\s+/g," ").trim()`);
    const tap = async (sel) => {
      const h = (await p.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
      if (!h) throw new Error("fehlt: " + sel);
      await h.scrollIntoViewIfNeeded();
      if (mobile) await h.tap(); else await h.click();
    };
    const shot = async (name) => { await p.waitForTimeout(900); return p.screenshot({ path: `${outDir}/tour-${name}-${lang}-${mobile ? "mobile" : "desktop"}.png` }); };

    // --- Übersicht
    check(`${tag}: Seitentitel ${L.title}`, (await p.title()) === L.title, await p.title());
    check(`${tag}: Seitensprache`, (await p.evaluate(() => document.documentElement.lang)) === lang);
    check(`${tag}: zehn Kacheln`, (await ev(`return r.querySelectorAll(".lrn-card").length`)) === 10);
    check(`${tag}: dritte Kachel ist der Assistent mit Skizze`, (await text('.lrn-card[data-i="2"]')).includes(L.wiz) && (await ev(`return !!r.querySelector('.lrn-card[data-i="2"] .lrn-wz')`)));
    check(`${tag}: Kopf mit Titel und Untertitel`, (await text(".lrn-body, .dlg-head")).includes(L.sub) || (await text(".dlg-head")).includes(L.sub), await text(".dlg-head"));
    check(`${tag}: erste Kachel ${L.name1}, zweite ${L.name2}`, (await text('.lrn-card[data-i="0"]')).includes(L.name1) && (await text('.lrn-card[data-i="1"]')).includes(L.name2));
    check(`${tag}: kein Schliessen-Knopf`, (await ev(`return r.querySelectorAll('[data-lrn="close"]').length`)) === 0);
    check(`${tag}: Fenster liegt in der Seite (kein Modal)`, (await ev(`const d=r.querySelector("dialog.learn-dlg"); return d.open && !d.matches(":modal")`)) === true);
    check(`${tag}: Kapsel an der Sprachleiste`, (await ev(`return r.querySelectorAll(".tour-bar .sub-tabs .seg-pill").length`)) === 2);
    check(`${tag}: Seite scrollt nicht`, (await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)));
    await shot("overview");

    // --- Thema öffnen, Adresse folgt
    await tap('.lrn-card[data-i="1"]');
    check(`${tag}: Thema Batterie geöffnet`, await wait(`return r.querySelector(".lrn-art") && r.querySelector('.lrn-tabs .sub-tab.on')?.dataset.i === "1"`));
    check(`${tag}: Adresse #bat`, (await p.evaluate(() => location.hash)) === "#bat", await p.evaluate(() => location.hash));
    check(`${tag}: Kapsel an den Themenreitern`, await wait(`return r.querySelectorAll(".lrn-tabs .seg-pill").length === 1`));
    check(`${tag}: letzte Fusszeile ohne Fertig/Schliessen`, (await ev(`return r.querySelectorAll('[data-lrn="close"]').length`)) === 0);
    check(`${tag}: keine unaufgelösten Texte`, !/undefined|\[object|\{\w+\}|NaN/.test(await text(".lrn-art")), (await text(".lrn-art")).slice(0, 80));
    await shot("article");

    // --- Weiter, Zurück
    await tap('.dlg-actions [data-lrn="topic"].primary');
    check(`${tag}: Weiter zum dritten Thema (Assistent)`, await wait(`return r.querySelector('.lrn-tabs .sub-tab.on')?.dataset.i === "2"`) && (await p.evaluate(() => location.hash)) === "#wiz");
    check(`${tag}: Assistent-Artikel mit Text, Skizze und sieben Schritten`, (await text(".lrn-art")).includes(L.wizKey) && (await ev(`return !!r.querySelector(".lrn-art aside .lrn-wz") && r.querySelectorAll(".lrn-art .lt-st").length === 7`)));
    check(`${tag}: Assistent-Skizze zeigt Schrittleiste mit sieben Balken`, (await ev(`return r.querySelectorAll(".lrn-art aside .wz-bars i").length`)) === 7);
    await shot("wizard");
    await p.goBack();
    check(`${tag}: Browser-Zurück führt zu Batterie`, await wait(`return r.querySelector('.lrn-tabs .sub-tab.on')?.dataset.i === "1"`));
    await tap('.dlg-head [data-lrn="overview"]');
    check(`${tag}: Zurück zur Übersicht, Adresse ohne Thema`, await wait(`return !!r.querySelector(".lrn-card")`) && (await p.evaluate(() => location.hash)) === "");

    // --- Letztes Thema: Knopf führt zur Übersicht
    await tap('.lrn-card[data-i="9"]');
    await wait(`return r.querySelector('.lrn-tabs .sub-tab.on')?.dataset.i === "9"`);
    check(`${tag}: letztes Thema, Knopf "Zurück zur Übersicht"`, (await ev(`return r.querySelectorAll('.dlg-actions .primary[data-lrn="overview"]').length`)) === 1);
    await tap('.dlg-actions .primary[data-lrn="overview"]');
    check(`${tag}: Übersicht wieder da`, await wait(`return !!r.querySelector(".lrn-card")`));

    // --- Sprache und Darstellung umschalten
    await tap('.tour-bar [data-set="tour-lang"]:not(.on)');
    const nl = lang === "de" ? "en" : "de";
    check(`${tag}: Sprache wechselt zu ${nl}`, await wait(`return r.querySelector(".tour-bar h1")?.textContent === ${JSON.stringify(T[nl].title)}`) && (await p.title()) === T[nl].title && (await text('.lrn-card[data-i="0"]')).includes(T[nl].name1));
    await tap('.tour-bar [data-set="tour-theme"]:not(.on)');
    check(`${tag}: Darstellung wird hell`, await wait(`return document.getElementById("tour").hasAttribute("light")`));
    check(`${tag}: Fenster in der hellen Farbe`, (await ev(`return getComputedStyle(r.querySelector("dialog.learn-dlg")).backgroundColor`)) === "rgb(255, 255, 255)");
    await shot("light");
    await tap('.tour-bar [data-set="tour-lang"]:not(.on)');
    await wait(`return r.querySelector(".tour-bar h1")?.textContent === ${JSON.stringify(L.title)}`);

    // --- Direktlink auf ein Thema
    await p.goto(`${URL0}?lang=${lang}&theme=dark#rt`);
    check(`${tag}: Direktlink #rt öffnet Routinen`, await wait(`return r.querySelector('.lrn-tabs .sub-tab.on')?.dataset.i === "7"`, 15000));
    await p.goto(`${URL0}?lang=${lang}&theme=dark#wiz`);
    check(`${tag}: Direktlink #wiz öffnet den Assistenten`, await wait(`return r.querySelector('.lrn-tabs .sub-tab.on')?.dataset.i === "2"`, 15000));

    check(`${tag}: keine Fehler in der Konsole`, errors.length === 0, errors.join(" | ").slice(0, 200));
    await ctx.close();
  }
}

// Unbekannter Anker: Übersicht; Sprache aus dem Browser (ohne ?lang)
{
  const ctx = await b.newContext({ viewport: { width: 1200, height: 800 }, locale: "de-CH", colorScheme: "light" });
  const p = await ctx.newPage();
  await p.goto(`${URL0}#gibtsnicht`);
  await p.waitForFunction(new Function(`return !!${R}?.querySelector(".lrn-card")`), null, { timeout: 15000 });
  check("Unbekannter Anker zeigt die Übersicht", (await p.evaluate(new Function(`return ${R}.querySelectorAll(".lrn-card").length`))) === 10);
  check("Sprache aus dem Browser (de-CH): Deutsch", (await p.title()) === T.de.title);
  check("Darstellung aus dem Browser (hell)", await p.evaluate(() => document.getElementById("tour").hasAttribute("light")));
  await ctx.close();
}
// Verzeichnis der Themen in der Seite und in learn.js gleich
{
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  await p.goto(`${URL0}?lang=en`);
  await p.waitForFunction(new Function(`return !!${R}?.querySelector(".lrn-card")`), null, { timeout: 15000 });
  const n = await p.evaluate(new Function(`return ${R}.querySelectorAll(".lrn-card").length`));
  check(`Zehn Themen: ${IDS.join(", ")}`, n === IDS.length);
  await ctx.close();
}

await b.close();
process.exit(ok ? 0 : 1);
