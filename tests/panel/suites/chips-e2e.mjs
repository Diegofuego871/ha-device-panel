// Filter-Chips der Verbindungsart ausblenden (docs/mockups/view-v2, C):
// Einstellungen, Abschnitt "Darstellung" › Reiter "Filter-Chips", gilt für alle Benutzer. Ausgeblendete
// Chips fehlen in der Leiste, ein aktiver Filter geht auf "Alle" zurück,
// "Alle umschalten", Zusammenfassung, ausgeblendete Art ohne Geräte bleibt
// in der Liste. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: {
    title: "Filter-Chips", sumBase: "Automatisch erkannt", two: "2 Filter-Chips ausgeblendet",
    one: "1 Änderung", order: "Chips in eigener Reihenfolge", thread: "Thread", threadSub: "2 Geräte", lan: "LAN", empty: "ohne Geräte", all: "Alle",
  },
  en: {
    title: "Filter chips", sumBase: "Detected automatically", two: "2 filter chips hidden",
    one: "1 change", order: "chips in own order", thread: "Thread", threadSub: "2 devices", lan: "LAN", empty: "no devices", all: "All",
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
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const chips = () => ev(`return [...r.querySelectorAll(".chip[data-conn]")].map(c=>c.dataset.conn).join()`);
    const lastSet = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_options").at(-1)?.values);
    const openDisplay = async () => {
      await tap(".gear-btn");
      await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
      await tap('[data-set="section"][data-id="look"]');
      await tap('[data-set="subtab"][data-key="chips"]');
    };
    // Speichern: Dialog bleibt offen ("Gespeichert"), danach schliessen.
    const save = async () => {
      await tap('dialog.settings [data-set="save"]');
      if (!(await wait(`return r.querySelector("dialog.settings").open && r.querySelector(".set-count")?.classList.contains("saved")`))) return false;
      await tap('dialog.settings .dlg-actions [data-set="close"]');
      return wait(`return !r.querySelector("dialog.settings").open`);
    };

    const before = await chips();
    check(`[${tag}] Ausgangslage: alle Chips`, before === "all,thread,wifi,ble,zigbee,cloud,network,unknown,zwave", before);
    // Thread-Filter aktiv, dann Thread ausblenden: Filter geht auf "Alle"
    await tap('.chip[data-conn="thread"]');
    check(`[${tag}] Thread-Filter aktiv`, await wait(`return r.querySelectorAll(".dev[data-open]").length === 2`));
    await openDisplay();
    check(`[${tag}] Reiter mit Titel`, (await ev(`return r.querySelector(".sub-tab.on").firstChild.textContent`)) === T.title);
    const rows = await ev(`return [...r.querySelectorAll('input[data-list="hide_connections"]')].map(i=>i.dataset.value + (i.checked ? "+" : "-")).join()`);
    check(`[${tag}] alle Arten angezeigt, auch ohne Geräte (Matter, LAN)`, rows === "thread+,wifi+,ble+,zigbee+,ethernet+,cloud+,matter+,network+,unknown+,zwave+", rows);
    check(`[${tag}] Zeile mit Zahl`, (await ev(`const row=r.querySelector('input[data-list="hide_connections"][data-value="thread"]').closest(".ex-row"); return row.querySelector(".ex-name").firstChild.textContent + "|" + row.querySelector("small").textContent`)) === `${T.thread}|${T.threadSub}`);
    await tap('input[data-list="hide_connections"][data-value="thread"]');
    await tap('input[data-list="hide_connections"][data-value="ble"]');
    check(`[${tag}] Zusammenfassung und Zähler`, (await text('[data-id="look"] .set-sec-sum')) === `${T.sumBase} · ${T.two}` && (await text(".set-count")) === T.one, `${await text('[data-id="look"] .set-sec-sum')} / ${await text(".set-count")}`);
    await ev(`r.querySelector('input[data-list="hide_connections"]').closest(".set-sec-body").scrollIntoView({ block: "end" })`);
    await p.screenshot({ path: `${outDir}/chips-settings-${tag.replace("/", "-")}.png` });
    check(`[${tag}] gespeichert`, (await save()) && JSON.stringify(await lastSet()) === JSON.stringify({ hide_connections: ["ble", "thread"] }), JSON.stringify(await lastSet()));
    check(`[${tag}] Chips ohne Thread und Bluetooth`, await wait(`return ![...r.querySelectorAll(".chip[data-conn]")].some(c=>["thread","ble"].includes(c.dataset.conn))`), await chips());
    check(`[${tag}] Filter zurück auf Alle`, await wait(`return r.querySelector('.chip[data-conn="all"]').classList.contains("on") && r.querySelectorAll(".dev[data-open]").length === 16`));
    check(`[${tag}] hintere Chips bleiben`, await ev(`return !!r.querySelector(".chip[data-problems]") && !!r.querySelector('.chip.hint[data-hint="battery"]')`));
    check(`[${tag}] Geräte bleiben sichtbar`, await ev(`return !!r.querySelector('.dev[data-open="c"]')`));
    await p.screenshot({ path: `${outDir}/chips-list-${tag.replace("/", "-")}.png` });

    // Alle umschalten: bei gemischtem Stand zuerst alle an, dann alle aus
    await openDisplay();
    await tap('input[data-list-all="chips"]');
    check(`[${tag}] gemischt: zuerst alle an`, (await ev(`return [...r.querySelectorAll('input[data-list="hide_connections"]')].every(i=>i.checked)`)));
    await tap('input[data-list-all="chips"]');
    check(`[${tag}] alle aus`, (await ev(`return [...r.querySelectorAll('input[data-list="hide_connections"]')].every(i=>!i.checked)`)));
    await save();
    check(`[${tag}] nur noch "Alle"`, await wait(`return [...r.querySelectorAll(".chip[data-conn]")].map(c=>c.dataset.conn).join() === "all"`), await chips());
    await openDisplay();
    await tap('input[data-list-all="chips"]');
    await save();
    check(`[${tag}] alle wieder da`, await wait(`return [...r.querySelectorAll(".chip[data-conn]")].length === 9`) && (await lastSet()).hide_connections?.length === 0, await chips());

    // Ausgeblendete Art ohne Geräte bleibt in der Liste (zum Wieder-Einblenden)
    await p.evaluate(() => { window.__opts.hide_connections = ["ethernet"]; });
    await openDisplay();
    check(`[${tag}] ohne Geräte, aber ausgeblendet`, (await ev(`const i=r.querySelector('input[data-list="hide_connections"][data-value="ethernet"]'); return i && !i.checked ? i.closest(".ex-row").querySelector(".ex-name").firstChild.textContent + "|" + i.closest(".ex-row").querySelector("small").textContent : ""`)) === `${T.lan}|${T.empty}`);
    await tap('dialog.settings .dlg-actions [data-set="close"]');

    check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
