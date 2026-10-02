// Filter-Chips der Verbindungsart ausblenden (docs/mockups/view-v2, C):
// Einstellungen, Abschnitt "Anzeige", gilt für alle Benutzer. Ausgeblendete
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
    title: "Filter-Chips der Verbindungsart", sumBase: "Dienst-Geräte und deaktivierte Geräte ausgeblendet", two: "2 Filter-Chips ausgeblendet",
    one: "1 Änderung", order: "Chips in eigener Reihenfolge", thread: "Thread", threadSub: "2 Geräte", lan: "LAN", empty: "ohne Geräte", all: "Alle",
  },
  en: {
    title: "Filter chips of the connection type", sumBase: "Service devices and disabled devices hidden", two: "2 filter chips hidden",
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
      await tap('[data-set="section"][data-id="display"]');
    };
    const save = async () => { await tap('dialog.settings [data-set="save"]'); return wait(`return !r.querySelector("dialog.settings").open`); };

    const before = await chips();
    check(`[${tag}] Ausgangslage: alle Chips`, before === "all,zigbee,wifi,thread,ble,zwave,network,cloud,unknown", before);
    // Thread-Filter aktiv, dann Thread ausblenden: Filter geht auf "Alle"
    await tap('.chip[data-conn="thread"]');
    check(`[${tag}] Thread-Filter aktiv`, await wait(`return r.querySelectorAll(".dev[data-open]").length === 2`));
    await openDisplay();
    check(`[${tag}] Abschnitt mit Titel`, (await ev(`return [...r.querySelectorAll(".set-sec-body .opt-label")].map(e=>e.textContent)`)).includes(T.title));
    const rows = await ev(`return [...r.querySelectorAll('input[data-list="hide_connections"]')].map(i=>i.dataset.value + (i.checked ? "+" : "-")).join()`);
    check(`[${tag}] alle Arten angezeigt`, rows === "zigbee+,wifi+,thread+,ble+,zwave+,network+,cloud+,unknown+", rows);
    check(`[${tag}] Zeile mit Zahl`, (await ev(`const row=r.querySelector('input[data-list="hide_connections"][data-value="thread"]').closest(".ex-row"); return row.querySelector(".ex-name").firstChild.textContent + "|" + row.querySelector("small").textContent`)) === `${T.thread}|${T.threadSub}`);
    await tap('input[data-list="hide_connections"][data-value="thread"]');
    await tap('input[data-list="hide_connections"][data-value="ble"]');
    check(`[${tag}] Zusammenfassung und Zähler`, (await text('[data-id="display"] .set-sec-sum')) === `${T.sumBase} · ${T.two}` && (await text(".set-count")) === T.one, `${await text('[data-id="display"] .set-sec-sum')} / ${await text(".set-count")}`);
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
    await tap('input[data-list-all="hide_connections"]');
    check(`[${tag}] gemischt: zuerst alle an`, (await ev(`return [...r.querySelectorAll('input[data-list="hide_connections"]')].every(i=>i.checked)`)));
    await tap('input[data-list-all="hide_connections"]');
    check(`[${tag}] alle aus`, (await ev(`return [...r.querySelectorAll('input[data-list="hide_connections"]')].every(i=>!i.checked)`)));
    await save();
    check(`[${tag}] nur noch "Alle"`, await wait(`return [...r.querySelectorAll(".chip[data-conn]")].map(c=>c.dataset.conn).join() === "all"`), await chips());
    await openDisplay();
    await tap('input[data-list-all="hide_connections"]');
    await save();
    check(`[${tag}] alle wieder da`, await wait(`return [...r.querySelectorAll(".chip[data-conn]")].length === 9`) && JSON.stringify(await lastSet()) === JSON.stringify({ hide_connections: [] }), await chips());

    // Reihenfolge per Griff: Cloud nach oben ziehen (Maus bzw. Finger)
    const rowOrder = () => ev(`return [...r.querySelectorAll('.drag-list [data-set="drag"]')].map(b=>b.dataset.key).join()`);
    // Mittelpunkt auf der Seite, ohne zu scrollen (sonst verschöbe das Messen
    // des Ziels den schon gemessenen Start).
    const center = async (sel) => {
      const box = await f.evaluate(new Function(`const b=${R}.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }`));
      const fr = await (await p.$("#panel-frame")).boundingBox();
      return { x: box.x + fr.x, y: box.y + fr.y };
    };
    const drag = async (fromSel, toSel) => {
      await ev(`r.querySelector(".drag-list").scrollIntoView({ block: "center" })`);
      await p.waitForTimeout(200);
      const a = await center(fromSel);
      const bEnd = await center(toSel);
      const to = { x: bEnd.x, y: bEnd.y - 12 };
      if (!mobile) {
        await p.mouse.move(a.x, a.y);
        await p.mouse.down();
        for (let i = 1; i <= 8; i++) await p.mouse.move(a.x, a.y + ((to.y - a.y) * i) / 8);
        await p.mouse.up();
      } else {
        // Echte Touch-Ereignisse: Chromium macht daraus Pointer-Ereignisse vom Typ "touch".
        const cdp = await ctx.newCDPSession(p);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y }] });
        for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a.x, y: a.y + ((to.y - a.y) * i) / 8 }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await cdp.detach();
        // Chrome 153 (CI) verschluckt bis knapp 1 s nach einer Touch-Folge per
        // CDP den Klick des nächsten Tipps (pointerdown/up kommen, click nicht).
        await p.waitForTimeout(1500);
      }
      // Nach dem Loslassen rendert der Dialog neu; erst dann weiter
      await p.waitForTimeout(500);
    };
    await openDisplay();
    check(`[${tag}] Griff in jeder Zeile`, (await rowOrder()) === "zigbee,wifi,thread,ble,zwave,network,cloud,unknown", await rowOrder());
    await drag('.drag-list [data-key="cloud"]', '.drag-list [data-key="zigbee"]');
    check(`[${tag}] Cloud nach oben gezogen`, await wait(`return [...r.querySelectorAll('.drag-list [data-set="drag"]')].map(b=>b.dataset.key).join() === "cloud,zigbee,wifi,thread,ble,zwave,network,unknown"`), await rowOrder());
    check(`[${tag}] Reihenfolge als Änderung`, (await text(".set-count")) === T.one && (await text('[data-id="display"] .set-sec-sum')).endsWith(T.order), `${await text(".set-count")} / ${await text('[data-id="display"] .set-sec-sum')}`);
    if (!mobile) {
      // Pfeiltasten am Griff: Zigbee eins nach unten, der Fokus bleibt am Griff
      await (await handle('.drag-list [data-key="zigbee"]')).focus();
      await p.keyboard.press("ArrowDown");
      check(`[${tag}] Pfeiltaste verschiebt`, await wait(`return [...r.querySelectorAll('.drag-list [data-set="drag"]')].map(b=>b.dataset.key).join() === "cloud,wifi,zigbee,thread,ble,zwave,network,unknown"`) && await ev(`return r.activeElement?.dataset.key === "zigbee"`), await rowOrder());
    }
    await p.screenshot({ path: `${outDir}/chips-order-${tag.replace("/", "-")}.png` });
    const expected = mobile ? ["cloud", "zigbee", "wifi", "thread", "ble", "zwave", "network", "unknown"] : ["cloud", "wifi", "zigbee", "thread", "ble", "zwave", "network", "unknown"];
    check(`[${tag}] Reihenfolge gespeichert`, (await save()) && JSON.stringify(await lastSet()) === JSON.stringify({ connection_order: expected }), JSON.stringify(await lastSet()));
    check(`[${tag}] Chips in dieser Reihenfolge`, await wait(`return [...r.querySelectorAll(".chip[data-conn]")].map(c=>c.dataset.conn).join() === ${JSON.stringify(["all", ...expected].join())}`), await chips());
    // Zurück nach Anzahl
    await openDisplay();
    await tap('[data-set="drag-reset"]');
    check(`[${tag}] nach Anzahl`, (await rowOrder()) === "zigbee,wifi,thread,ble,zwave,network,cloud,unknown" && !(await ev(`return !!r.querySelector('[data-set="drag-reset"]')`)), await rowOrder());
    check(`[${tag}] zurück gespeichert`, (await save()) && JSON.stringify(await lastSet()) === JSON.stringify({ connection_order: [] }) && (await chips()) === before, await chips());

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
