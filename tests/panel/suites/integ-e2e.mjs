// Filter "Integration" (1.9.0, Wunsch des Nutzers): Chip neben "Bereich",
// Mehrfachauswahl mit Zahlen, Suche, Beschriftung des aktiven Chips, kombiniert
// mit Bereich und den übrigen Chips, Kopf folgt, pro Benutzer gespeichert,
// "Alle" hebt auf. Deutsch und Englisch, Desktop (Popover) und Handy (Blatt).
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { chip: "Integration", title: "Integrationen", many: "3 Integrationen", count: (n) => `${n} von 9 Integrationen`, all: "Alle zeigen", clear: "Filter Integration aufheben", search: "Integration suchen", zigbee: "Zigbee Home Automation" },
  en: { chip: "Integration", title: "Integrations", many: "3 integrations", count: (n) => `${n} of 9 integrations`, all: "Show all", clear: "Clear integration filter", search: "Search integrations", zigbee: "Zigbee Home Automation" },
};
// Geräte je Domain im Simulator
const BY = { bthome: "a", esphome: "f,h", hue: "g", matter: "c,i", roborock: "o", shelly: "d,k", synology_dsm: "n", zha: "b,e,l,m,p", zwave_js: "j" };
const ids = (...doms) => doms.flatMap((d) => BY[d].split(",")).sort().join();

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
    const wait = (code, timeout = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout }).then(() => true, () => false);
    const rows = () => ev(`return [...r.querySelectorAll(".dev")].map(x=>x.dataset.open).sort().join()`);
    const PICK = mobile ? "dialog.area-sheet" : ".area-pop";
    const isOpen = () => ev(mobile ? `return r.querySelector("dialog.area-sheet").open` : `return !r.querySelector(".area-pop").hidden`);
    const pickRows = () => ev(`return [...r.querySelectorAll("${PICK} .arow")].map(x=>x.querySelector(".al").textContent + ":" + x.querySelector(".an").textContent)`);
    const closePick = async () => {
      if (mobile) await tap('dialog.area-sheet .dlg-actions [data-area-done]');
      else await p.keyboard.press("Escape");
      return wait(mobile ? `return !r.querySelector("dialog.area-sheet").open` : `return r.querySelector(".area-pop").hidden`);
    };
    const openInteg = async () => { await tap(".chips [data-integ-open]"); return wait(mobile ? `return r.querySelector("dialog.area-sheet").open` : `return !r.querySelector(".area-pop").hidden`); };
    const pick = async (dom) => { await tap(`${PICK} [data-area="${dom}"]`); await wait(`return r.querySelector("${PICK} [data-area='${dom}']").getAttribute("aria-checked") !== null`); };
    await wait(`return !!r.querySelector('.chip[data-conn="thread"]')`);
    const total = await rows();

    // Chip direkt hinter "Bereich", vor den Verbindungs-Chips
    const order = await ev(`return [...r.querySelectorAll(".chips > .chip, .chips > span.chip")].slice(0, 3).map(c=>c.classList.contains("integ") ? "integ" : c.classList.contains("area") ? "area" : "other").join()`);
    check(`[${tag}] Chip "${T.chip}" steht hinter "Bereich"`, order.startsWith("area,integ,") && (await text(".chips .chip.integ")) === T.chip, order);

    // Auswahl öffnen: neun Integrationen mit Zahlen, Suche, alphabetisch
    check(`[${tag}] Auswahl öffnet`, await openInteg() && await isOpen());
    check(`[${tag}] Titel "${T.title}"`, (await text(mobile ? "dialog.area-sheet h2" : ".area-pop h4")) === T.title);
    const list = await pickRows();
    const exp = ["BTHome:1", "ESPHome:2", "Matter:2", "Philips Hue:1", "Roborock:1", "Shelly:2", "Synology DSM:1", "Z-Wave:1", `${T.zigbee}:5`];
    check(`[${tag}] neun Integrationen mit Zahl`, JSON.stringify([...list].sort()) === JSON.stringify([...exp].sort()), JSON.stringify(list));
    check(`[${tag}] alphabetisch`, await ev(`const n=[...r.querySelectorAll("${PICK} .arow .al")].map(x=>x.textContent); const s=[...n].sort((a,b)=>a.localeCompare(b, ${JSON.stringify(lang)})); return n.join("|")===s.join("|")`), list.join("|"));
    check(`[${tag}] Suchfeld ab neun Einträgen`, await ev(`return !!r.querySelector("${PICK} [data-area-search]")`) && (await ev(`return r.querySelector("${PICK} [data-area-search]").placeholder`)) === T.search);
    check(`[${tag}] keine Etagen-Zeilen`, !(await ev(`return !!r.querySelector("${PICK} .afloor")`)));
    check(`[${tag}] nur der Chip "${T.chip}" ist offen, nicht "Bereich"`, await ev(`const a=r.querySelector(".chips .chip.area:not(.integ)"); const i=r.querySelector(".chips .chip.integ"); return i.classList.contains("open") && i.getAttribute("aria-expanded")==="true" && !a.classList.contains("open") && a.getAttribute("aria-expanded")==="false"`));
    await p.screenshot({ path: `${outDir}/integ-pick-${tag.replace("/", "-")}.png` });

    // Eine Integration: Liste, Chip, Kopf
    await pick("shelly");
    check(`[${tag}] Shelly: nur d, k`, await wait(`return [...r.querySelectorAll(".dev")].map(x=>x.dataset.open).sort().join() === ${JSON.stringify(ids("shelly"))}`), await rows());
    await closePick();
    check(`[${tag}] aktiver Chip "Shelly" mit Zahl 2`, (await text(".chips .chip.integ.on .al")) === "Shelly" && (await text(".chips .chip.integ.on .n")) === "2", await text(".chips .chip.integ"));
    check(`[${tag}] "Alle" nicht mehr aktiv`, !(await ev(`return r.querySelector('.chip[data-conn="all"]').classList.contains("on")`)));
    check(`[${tag}] Kopf nur für Shelly (2 Geräte, Titel mit Zusatz)`, (await text(".ringwrap .c b")) === "1" && (await ev(`return r.querySelector(".ringwrap .c").textContent`)).includes("2") && (await ev(`return [...r.querySelectorAll(".hero .kt .k .scope")].map(x=>x.textContent).join("|")`)) === "· Shelly|· Shelly|· Shelly", await text(".ringwrap .c"));
    check(`[${tag}] Verbindungs-Chips zählen im Umfang`, (await text('.chip[data-conn="wifi"] .n')) !== "" && (await ev(`return Number(r.querySelector('.chips .chip[data-conn="all"] .n').textContent)`)) === 16);

    // Zwei, dann drei: Beschriftung
    await openInteg();
    await pick("esphome");
    await closePick();
    check(`[${tag}] zwei: "ESPHome, Shelly", 4 Geräte`, (await text(".chips .chip.integ.on .al")) === "ESPHome, Shelly" && (await rows()) === ids("esphome", "shelly"), await text(".chips .chip.integ"));
    await openInteg();
    await pick("zha");
    check(`[${tag}] Fuss/Zähler: 3 von 9`, mobile ? true : (await text(".area-pop .afoot span")) === T.count(3), await text(".area-pop .afoot"));
    await closePick();
    check(`[${tag}] drei: "${T.many}"`, (await text(".chips .chip.integ.on .al")) === T.many && (await rows()) === ids("esphome", "shelly", "zha"), await text(".chips .chip.integ"));

    // Suche im Popover
    await openInteg();
    await ev(`const i=r.querySelector("${PICK} [data-area-search]"); i.value="zig"; i.dispatchEvent(new Event("input", {bubbles:true}))`);
    check(`[${tag}] Suche "zig": nur Zigbee`, await wait(`return [...r.querySelectorAll("${PICK} .arow .al")].map(x=>x.textContent).join() === ${JSON.stringify(T.zigbee)}`), (await pickRows()).join());
    await ev(`const i=r.querySelector("${PICK} [data-area-search]"); i.value="xyz"; i.dispatchEvent(new Event("input", {bubbles:true}))`);
    check(`[${tag}] Suche ohne Treffer: Hinweis`, await wait(`return !!r.querySelector("${PICK} .anote")`));
    await closePick();
    await p.screenshot({ path: `${outDir}/integ-list-${tag.replace("/", "-")}.png` });

    // Kombination mit Bereich: Küche + (ESPHome, Shelly, Zigbee) = e, k
    await tap(".chips [data-area-open]");
    await wait(mobile ? `return r.querySelector("dialog.area-sheet").open` : `return !r.querySelector(".area-pop").hidden`);
    check(`[${tag}] Bereich-Auswahl: Titel wieder "Bereiche"`, (await text(mobile ? "dialog.area-sheet h2" : ".area-pop h4")) === (lang === "de" ? "Bereiche" : "Areas"));
    await tap(`${PICK} [data-area="kueche"]`);
    check(`[${tag}] Bereich + Integration: e, k`, await wait(`return [...r.querySelectorAll(".dev")].map(x=>x.dataset.open).sort().join() === "e,k"`), await rows());
    await closePick();
    check(`[${tag}] Kopf mit beiden: "· Küche · 3 Integrationen"`, (await ev(`return r.querySelector(".hero .kt .k .scope").textContent`)) === `· Küche · ${T.many}`, await ev(`return r.querySelector(".hero .kt .k .scope").textContent`));
    // Zahlen der Integrationsauswahl zählen den Bereich mit
    await openInteg();
    const inK = await pickRows();
    check(`[${tag}] Zahlen mit Bereich: Shelly 1, Zigbee 1, Matter 0`, inK.includes("Shelly:1") && inK.includes(`${T.zigbee}:1`) && inK.includes("Matter:0"), JSON.stringify(inK));
    // Wechsel der Auswahl: Bereich antippen schliesst diese und öffnet jene (nur Desktop; auf dem Handy deckt das Blatt die Chips ab)
    if (!mobile) {
      await tap(".chips [data-area-open]");
      check(`[${tag}] Wechsel zu "Bereiche"`, await wait(`return !r.querySelector(".area-pop").hidden && r.querySelector(".area-pop h4").textContent === ${JSON.stringify(lang === "de" ? "Bereiche" : "Areas")}`));
    }
    await closePick();

    // × des Chips hebt nur die Integration auf
    check(`[${tag}] × mit Beschriftung`, (await ev(`return r.querySelector(".chips [data-integ-clear]")?.getAttribute("aria-label")`)) === T.clear);
    await tap(".chips [data-integ-clear]");
    check(`[${tag}] × hebt nur Integration auf: Küche (e, k) bleibt`, await wait(`return !r.querySelector(".chips .chip.integ.on")`) && (await rows()) === "e,k", await rows());

    // Gespeichert pro Benutzer
    await openInteg();
    await pick("hue");
    await closePick();
    const saved = (m) => p.evaluate((k) => (JSON.parse(sessionStorage.getItem("sim_user_data") || "{}").device_panel_view?.[k]?.integs || []).join(), m);
    const kind = mobile ? "mobile" : "desktop";
    check(`[${tag}] bei HA gespeichert`, await p.waitForFunction((k) => (JSON.parse(sessionStorage.getItem("sim_user_data") || "{}").device_panel_view?.[k]?.integs || []).join() === "hue", kind, { timeout: 5000 }).then(() => true, () => false), await saved(kind));
    check(`[${tag}] Handy und Desktop getrennt`, (await saved(mobile ? "desktop" : "mobile")) === "");
    await p.reload();
    f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length >= 0`), null, { timeout: 15000 });
    check(`[${tag}] nach Neuladen: Hue und Küche (leer, da Hue in Wohnzimmer)`, await wait(`return r.querySelectorAll(".dev").length === 0 && !!r.querySelector(".chips .chip.integ.on")`), await rows());

    // "Alle" hebt Bereich und Integration auf
    await tap('.chips .chip[data-conn="all"]');
    check(`[${tag}] "Alle" hebt beide auf`, await wait(`return r.querySelectorAll(".dev").length === ${total.split(",").length} && !r.querySelector(".chips .chip.integ.on") && !r.querySelector(".chips .chip.area.on:not(.integ)")`), await rows());

    // Integration, die es nicht mehr gibt: Filter fällt weg
    await openInteg();
    await pick("hue");
    await closePick();
    await p.evaluate(() => { window.__devices = window.__devices.filter((d) => d.integration?.domain !== "hue"); });
    await ev(`r.host._fetch()`);
    check(`[${tag}] Integration verschwunden: alle Geräte, kein aktiver Chip`, await wait(`return r.querySelectorAll(".dev").length > 3 && !r.querySelector(".chips .chip.integ.on")`), await rows());

    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "OK" : "FEHLER");
process.exit(ok ? 0 : 1);
