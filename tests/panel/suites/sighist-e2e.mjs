// Empfangsverlauf und Batteriefarben (0.24.0): Kachel "Empfang" öffnet das
// Fenster mit 24 Std., 7 und 30 Tagen; Zigbee/Bluetooth aus der eigenen
// Aufzeichnung (Median, Spanne, Lücken), WLAN aus dem Recorder (Treppe,
// 30 Tage Statistik); Schwelle der Empfang-Warnung; leere Fälle. Batterie:
// Symbol mit Füllstand in vier Farben. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: {
    title: "Empfang", ranges: ["24 Std.", "7 Tage", "30 Tage"], weak: "Schwach unter LQI 60", weakOwn: "Schwach unter -85 dBm", log: "Vom Panel aufgezeichnet, seit ",
    notRec: "Der Recorder zeichnet den Sensor nicht auf (in seiner Konfiguration ausgeschlossen), deshalb zeichnet ihn das Panel selbst auf.", soon: "Erste Werte nach wenigen Minuten.", steady: "Wert unverändert seit ",
    hist: "Aus dem Verlauf des Recorders (Sensor des Geräts).", stats: "Aus dem Recorder (Langzeitstatistik", empty: "Das Panel zeichnet den Empfang", none: "Für den Empfang dieses Geräts",
    facts: /^Median LQI \d+ · schlechtester LQI \d+ · bester LQI \d+$/, legend: "Median|Spanne schlechtester bis bester Wert", noData: "Keine Daten für diesen Zeitraum.",
  },
  en: {
    title: "Signal", ranges: ["24 h", "7 days", "30 days"], weak: "Weak below LQI 60", weakOwn: "Weak below -85 dBm", log: "Recorded by the panel since ",
    notRec: "The recorder does not record the sensor (excluded in its configuration), so the panel records it itself.", soon: "First values after a few minutes.", steady: "Value unchanged since ",
    hist: "From the recorder history (sensor of the device).", stats: "From the recorder (long-term statistics", empty: "The panel records the signal", none: "There is no history for the signal",
    facts: /^Median LQI \d+ · worst LQI \d+ · best LQI \d+$/, legend: "Median|Range from worst to best value", noData: "No data for this period.",
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
    const calls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/signal_history").map(({ device_id, range }) => `${device_id}:${range || "24h"}`));
    const range = async (r) => { await tap(`dialog.stat-dlg [data-stat="range"][data-range="${r}"]`); return wait(`return r.querySelector('dialog.stat-dlg [data-range="${r}"]')?.classList.contains("on") && !r.querySelector("dialog.stat-dlg .avail .dlg-note")?.textContent.includes("…")`); };
    const openSignal = async (id) => {
      if (await ev(`return r.querySelector("dialog.stat-dlg").open`)) await tap('dialog.stat-dlg [data-stat="close"]');
      if (await ev(`return r.querySelector("dialog.device").open`)) await tap('dialog.device [data-dlg="close"]');
      await tap(`.dev[data-open="${id}"]`);
      await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device .st-tile[data-kind="signal"]')`);
      await tap('dialog.device .st-tile[data-kind="signal"]');
      return wait(`return r.querySelector("dialog.stat-dlg")?.open && (!!r.querySelector("dialog.stat-dlg .bh-svg") || !!r.querySelector("dialog.stat-dlg .bh-src"))`);
    };

    // Batteriefarben in der Liste: Stände 64/45/25/10 % (10 % ist schwach,
    // Schwelle 15 %). Handy: Chip "Batterie" zeigt den Stand auf den Karten.
    await p.evaluate(() => {
      const set = (id, level) => { window.__devices.find((x) => x.id === id).battery.level = level; };
      set("i", 45); set("j", 25); set("m", 10);
    });
    await ev(`r.host._fetch(true)`);
    if (mobile) await tap('.chip.hint[data-hint="batteries"]');
    await wait(`return r.querySelector('.dev[data-open="i"] .bat-ic.t3')`);
    const tiers = await ev(`return ["e","i","j","m"].map(id => { const s=r.querySelector('.dev[data-open="'+id+'"] .bat-ic'); return s ? [...s.classList].find(c=>/^t\\d$/.test(c)) : "-"; }).join()`);
    check(`[${tag}] Batterie 64/45/25/10 %: grün, gelbgrün, orange, rot (schwach)`, tiers === "t4,t3,t2,t1", tiers);
    const fill = await ev(`const s=r.querySelector('.dev[data-open="e"] .bat-ic rect'); return s ? Number(s.getAttribute("height")) : 0`);
    check(`[${tag}] Füllstand nach Prozent`, Math.abs(fill - 14 * 0.64) < 0.01, String(fill));
    const colors = await ev(`return ["e","i","j","m"].map(id => getComputedStyle(r.querySelector('.dev[data-open="'+id+'"] .bat-ic')).color)`);
    check(`[${tag}] vier verschiedene Farben`, new Set(colors).size === 4, colors.join(" / "));
    if (mobile) await ev(`r.querySelector(".content").scrollTop = r.querySelector(".chips").offsetTop - 80`);
    await p.screenshot({ path: `${outDir}/batcolor-${tag.replace("/", "-")}.png` });
    if (mobile) await tap('.chip.hint[data-hint="batteries"]');

    // Zigbee (wie ZHA): eigene Aufzeichnung
    check(`[${tag}] Kachel "Empfang" antippbar`, (await openSignal("e")) && (await text("dialog.stat-dlg h2")) === T.title && (await calls()).at(-1) === "e:24h", (await calls()).join());
    const tile = await ev(`const t=r.querySelector('dialog.device .st-tile[data-kind="signal"]'); return [t.tagName, !!t.querySelector(".chev")]`);
    check(`[${tag}] Kachel ist Knopf mit Pfeil`, tile[0] === "BUTTON" && tile[1], JSON.stringify(tile));
    const ranges = await ev(`return [...r.querySelectorAll('dialog.stat-dlg [data-stat="range"]')].map(x=>x.textContent)`);
    check(`[${tag}] drei Zeiträume`, JSON.stringify(ranges) === JSON.stringify(T.ranges), JSON.stringify(ranges));
    check(`[${tag}] aktueller Wert mit Balken`, (await text("dialog.stat-dlg .sg-cur")) === "LQI 61" && (await ev(`return !!r.querySelector("dialog.stat-dlg .sg-cur svg")`)));
    check(`[${tag}] Median, schlechtester, bester`, T.facts.test(await text("dialog.stat-dlg .avail-facts")), await text("dialog.stat-dlg .avail-facts"));
    check(`[${tag}] Spanne als Fläche, Legende`, (await ev(`return !!r.querySelector("dialog.stat-dlg path.sg-band")`)) && (await ev(`return [...r.querySelectorAll("dialog.stat-dlg .avail-legend span")].map(x=>x.textContent).join("|")`)) === T.legend);
    check(`[${tag}] Lücke vor 6 Std. unterbricht die Linie`, (await ev(`return (r.querySelector("dialog.stat-dlg path.bh-line").getAttribute("d").match(/M/g) || []).length`)) === 2);
    check(`[${tag}] Schwelle Standard`, (await text("dialog.stat-dlg .bh-thr-l")) === T.weak && (await ev(`return [...r.querySelectorAll("dialog.stat-dlg .bh-y")].map(x=>x.textContent).join("|")`)) === "255|128|0");
    check(`[${tag}] Quelle: Aufzeichnung seit`, (await text("dialog.stat-dlg .bh-src")).startsWith(T.log), await text("dialog.stat-dlg .bh-src"));
    await p.screenshot({ path: `${outDir}/sighist-log-${tag.replace("/", "-")}.png` });
    check(`[${tag}] 7 Tage`, (await range("7d")) && (await calls()).at(-1) === "e:7d" && (await ev(`return !!r.querySelector("dialog.stat-dlg path.sg-band")`)));

    // WLAN: Recorder; eigene Schwelle des Geräts
    await p.evaluate(() => { window.__devSettings.signal.f = -85; });
    await ev(`r.host._fetch(true)`);
    await wait(`return r.host._devices.find(d=>d.id==="f")?.signal_setting === -85`);
    check(`[${tag}] WLAN-Gerät öffnet`, await openSignal("f"));
    check(`[${tag}] Verlauf als Treppe, ohne Spanne`, (await ev(`return / H/.test(r.querySelector("dialog.stat-dlg path.bh-line").getAttribute("d")) && !r.querySelector("dialog.stat-dlg path.sg-band") && !r.querySelector("dialog.stat-dlg .avail-legend")`)));
    check(`[${tag}] Achse dBm, eigene Schwelle`, (await ev(`return [...r.querySelectorAll("dialog.stat-dlg .bh-y")].map(x=>x.textContent).join("|")`)).endsWith("|-100") && (await text("dialog.stat-dlg .bh-thr-l")) === T.weakOwn, await text("dialog.stat-dlg .bh-thr-l"));
    check(`[${tag}] Quelle: Verlauf des Recorders`, (await text("dialog.stat-dlg .bh-src")) === T.hist, await text("dialog.stat-dlg .bh-src"));
    await range("30d");
    check(`[${tag}] 30 Tage: Langzeitstatistik`, (await text("dialog.stat-dlg .bh-src")).startsWith(T.stats), await text("dialog.stat-dlg .bh-src"));
    if (!mobile) await p.screenshot({ path: `${outDir}/sighist-wifi-${tag.replace("/", "-")}.png` });

    // Ausgefallenes Zigbee-Gerät: kein Punkt "jetzt", Linie endet beim Ausfall
    check(`[${tag}] ausgefallenes Gerät öffnet`, await openSignal("b"));
    check(`[${tag}] ausgefallen: kein Punkt "jetzt"`, !(await ev(`return !!r.querySelector("dialog.stat-dlg .bh-dot")`)));

    // Leere Fälle
    await p.evaluate(() => { window.__sigSource = "log-empty"; });
    await range("7d");
    check(`[${tag}] Aufzeichnung beginnt: Hinweis`, (await text("dialog.stat-dlg .avail .dlg-note")) === T.noData && (await text("dialog.stat-dlg .bh-src")).startsWith(T.empty), await text("dialog.stat-dlg .bh-src"));
    await p.evaluate(() => { window.__sigSource = "none"; });
    await range("24h");
    check(`[${tag}] ohne Verlauf: Hinweis`, (await text("dialog.stat-dlg .bh-src")).startsWith(T.none), await text("dialog.stat-dlg .bh-src"));
    // Seit 0.27.0 (Fehlerbericht des Nutzers: nur ein Punkt "jetzt"): Sensor, den
    // der Recorder nicht aufzeichnet, und Wert, der sich lange nicht geändert hat
    await p.evaluate(() => { window.__sigSource = "not-recorded-empty"; });
    await range("7d");
    check(`[${tag}] Recorder ohne Sensor: Hinweis, warum`, (await text("dialog.stat-dlg .bh-src")) === `${T.notRec} ${T.soon}`, await text("dialog.stat-dlg .bh-src"));
    await p.evaluate(() => { window.__sigSource = "not-recorded"; });
    await range("24h");
    check(`[${tag}] Recorder ohne Sensor: eigene Aufzeichnung`, (await text("dialog.stat-dlg .bh-src")).startsWith(T.log) && (await text("dialog.stat-dlg .bh-src")).endsWith(T.notRec), await text("dialog.stat-dlg .bh-src"));
    await p.evaluate(() => { window.__sigSource = "steady"; });
    await range("7d");
    const steady = await ev(`return [r.querySelector("dialog.stat-dlg .bh-line")?.getAttribute("d") || "", r.querySelector("dialog.stat-dlg .bh-src")?.textContent || ""]`);
    // 7 Tage, unverändert seit 3 Tagen: Linie ab 4/7 der Breite bis jetzt
    check(`[${tag}] Wert unverändert: Linie ab der letzten Änderung, Hinweis`, steady[0].startsWith("M571.4,") && steady[0].includes("H1000.0") && steady[1].startsWith(`${T.hist} ${T.steady}`), JSON.stringify(steady));
    if (mobile && lang === "de") await p.screenshot({ path: `${outDir}/sighist-steady-${tag.replace("/", "-")}.png` });
    await p.evaluate(() => { window.__sigSource = null; });
    await tap('dialog.stat-dlg [data-stat="close"]');
    check(`[${tag}] X schliesst nur das Fenster`, await wait(`return !r.querySelector("dialog.stat-dlg").open && r.querySelector("dialog.device").open`));
    // Batterie-Kachel im Popup mit farbigem Symbol
    check(`[${tag}] Batterie-Kachel mit Symbol (8 %, schwach)`, await ev(`return !!r.querySelector('dialog.device .st-tile[data-kind="battery"] .bat-ic.t1')`));

    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
