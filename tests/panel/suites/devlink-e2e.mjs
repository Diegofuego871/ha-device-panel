// Reiter "Entitäten" im Geräte-Popup: am Ende "Link zu diesem Gerät" (2.82.0) mit "Link kopieren" (Adresse des Browsers + /device-panel?device=<id>)
// und "App-Link kopieren" (homeassistant://navigate/...). Der kopierte Link öffnet über den Deep-Link wieder dasselbe Gerät. Deutsch und Englisch.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { sec: "Link zu diesem Gerät", web: "Link kopieren", app: "App-Link kopieren" },
  en: { sec: "Link to this device", web: "Copy link", app: "Copy app link" },
};
for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:8950" }).catch(() => {});
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=${mobile ? "dark" : "light"}`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 6000 }).then(() => true, () => false);

    await ev(`[...r.querySelectorAll(".dev")].find((e) => e.textContent.includes("Deckenlicht Wohnzimmer")).click()`);
    await wait(`return r.querySelector("dialog.device")?.open && !!r.querySelector("dialog.device .dev-tabs .sub-tab")`);
    await p.waitForTimeout(500);
    check(`[${tag}] Reiter Übersicht: kein Link-Abschnitt`, await ev(`return !r.querySelector("dialog.device .dl-list")`));
    await tap(`dialog.device [data-tab="ent"]`);
    check(`[${tag}] Entitäten: Abschnitt "${T.sec}" nach der Liste`, await wait(`const d = r.querySelector("dialog.device"); const h = [...d.querySelectorAll("h3")].map((e) => e.textContent); const ul = d.querySelector(".dl-list"); const list = d.querySelector("ul.entities:not(.dl-list)"); return h.at(-1) === ${JSON.stringify(T.sec)} && !!ul && (!list || list.compareDocumentPosition(ul) & Node.DOCUMENT_POSITION_FOLLOWING)`));
    const rows = await ev(`return [...r.querySelectorAll("dialog.device .dl-row")].map((e) => [e.querySelector(".ent-name").firstChild.textContent, e.querySelector("small").textContent])`);
    const id = await ev(`return document.querySelector("device-panel")._detailId`);
    const origin = await p.evaluate(() => location.origin);
    check(`[${tag}] zwei Zeilen "${T.web}" und "${T.app}"`, rows.length === 2 && rows[0][0] === T.web && rows[1][0] === T.app, JSON.stringify(rows));
    check(`[${tag}] Link: Adresse des Browsers + /device-panel?device=<id>`, rows[0][1] === `${origin}/device-panel?device=${id}`, rows[0][1]);
    check(`[${tag}] App-Link: homeassistant://navigate/device-panel?device=<id>`, rows[1][1] === `homeassistant://navigate/device-panel?device=${id}`, rows[1][1]);
    check(`[${tag}] Zeilen innerhalb des Fensters, kein Querlauf`, await ev(`const b = r.querySelector("dialog.device .dlg-body"); return b.scrollWidth <= b.clientWidth + 1`));
    await tap(`dialog.device .dl-row[data-kind="web"]`);
    check(`[${tag}] Tipp: Häkchen als Rückmeldung`, await wait(`return r.querySelector('dialog.device .dl-row[data-kind="web"] .dl-ic').classList.contains("done")`));
    const clip = await f.evaluate(() => navigator.clipboard.readText().catch(() => null));
    if (clip != null) check(`[${tag}] Zwischenablage enthält den Link`, clip === rows[0][1], clip);
    await tap(`dialog.device .dl-row[data-kind="app"]`);
    const clip2 = await f.evaluate(() => navigator.clipboard.readText().catch(() => null));
    if (clip2 != null) check(`[${tag}] Zwischenablage enthält den App-Link`, clip2 === rows[1][1], clip2);
    check(`[${tag}] Tastatur: Enter auf der Zeile kopiert`, await (async () => {
      await ev(`r.querySelector('dialog.device .dl-row[data-kind="web"]').focus()`);
      await p.keyboard.press("Enter");
      return wait(`return r.querySelector('dialog.device .dl-row[data-kind="web"] .dl-ic').classList.contains("done")`);
    })());
    check(`[${tag}] nichts Fremdes gesendet (kein Dienstaufruf)`, await p.evaluate(() => !window.__wsCalls.some((m) => m.type === "call_service")));
    await p.screenshot({ path: new URL(`../output/devlink-${tag.replace("/", "-")}.png`, import.meta.url).pathname });

    // Der kopierte Link führt zurück: Deep-Link öffnet dasselbe Gerät
    const p2 = await ctx.newPage();
    await p2.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&device=${id}`);
    const f2 = await (await p2.waitForSelector("#panel-frame")).contentFrame();
    check(`[${tag}] Deep-Link mit dieser ID öffnet das Popup des Geräts`, await f2.waitForFunction(new Function(`return ${R}?.querySelector("dialog.device")?.open && document.querySelector("device-panel")._detailId === ${JSON.stringify(id)}`), null, { timeout: 8000 }).then(() => true, () => false));
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("|"));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
