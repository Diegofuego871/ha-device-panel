// Live-Zeile im Fenster "Empfang" (2.109.0): "Gerade gehört von: Shelly Garage -76 dBm (vor 8 s), Storen Küche -97 dBm (vor 3 s)". Der Empfänger,
// dessen Wert zählt, ist fett; die Zeile läuft alle 5 Sekunden weiter (Alter wächst), ohne das Fenster neu aufzubauen; Zigbee und Geräte ohne
// Einzelsicht zeigen nichts davon. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { head: "Gerade gehört von:", ago: (s) => `vor ${s} s`, agoMin: "vor 2 Min." },
  en: { head: "Currently heard by:", ago: (s) => `${s} s ago`, agoMin: "2 min ago" },
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
    const tap = async (sel) => {
      for (let i = 0; ; i++) {
        const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel);
        try { await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); return; }
        catch (e) { if (i >= 3 || !/not attached|not stable|intercepts/.test(e.message)) throw e; await new Promise((r) => setTimeout(r, 200)); }
      }
    };
    const wait = (code, timeout = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout }).then(() => true, () => false);
    const openSignal = async (id) => {
      if (await ev(`return r.querySelector("dialog.stat-dlg").open`)) await tap('dialog.stat-dlg [data-stat="close"]');
      if (await ev(`return r.querySelector("dialog.device").open`)) await tap('dialog.device [data-dlg="close"]');
      await tap(`.dev[data-open="${id}"]`);
      await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device .st-tile[data-kind="signal"]')`);
      await tap('dialog.device .st-tile[data-kind="signal"]');
      return wait(`return r.querySelector("dialog.stat-dlg")?.open && (!!r.querySelector("dialog.stat-dlg .bh-svg") || !!r.querySelector("dialog.stat-dlg .bh-src"))`);
    };
    const live = () => ev(`const l=r.querySelector("dialog.stat-dlg [data-sig-live]"); if(!l) return null; return { text: l.textContent.replace(/\\s+/g," ").trim(), used: [...l.querySelectorAll(".used")].map(x=>x.textContent.replace(/\\s+/g," ").trim()), title: l.title,
      weight: [...l.querySelectorAll("span")].map(x=>getComputedStyle(x).fontWeight) }`);

    check(`[${tag}] Fenster "Empfang" des Bluetooth-Geräts öffnet`, await openSignal("a"));
    let l = await live();
    check(`[${tag}] Live-Zeile mit beiden Empfängern, stärkster zuerst`, l && l.text === `${T.head} Shelly Garage -76 dBm (${T.ago(8)}), Storen Küche -97 dBm (${T.ago(3)})`, JSON.stringify(l?.text));
    check(`[${tag}] gezählter Empfänger fett, der andere nicht`, l && l.used.length === 1 && l.used[0].startsWith("Shelly Garage") && Number(l.weight[0]) >= 600 && Number(l.weight[1]) < 600, JSON.stringify([l?.used, l?.weight]));
    check(`[${tag}] Erklärung als Hinweis`, l && l.title.length > 20, l?.title);
    check(`[${tag}] Zeile steht unter dem Verlauf`, await ev(`const d=r.querySelector("dialog.stat-dlg"); const a=d.querySelector(".bh-src"), s=d.querySelector("[data-sig-live]"); return !!a && !!s && !!(a.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING)`));
    check(`[${tag}] nichts läuft über den Rand`, await ev(`const d=r.querySelector("dialog.stat-dlg .dlg-body"); return d.scrollWidth <= d.clientWidth + 1`));
    await p.screenshot({ path: `${outDir}/signallive-${tag.replace("/", "-")}.png` });

    // Läuft weiter: nach einem Takt (5 s) ist das Alter um 5 Sekunden gewachsen
    check(`[${tag}] Alter läuft weiter (alle 5 s neu geholt)`, await wait(`return r.querySelector("dialog.stat-dlg [data-sig-live]")?.textContent.includes(${JSON.stringify(T.ago(13))})`, 9000));

    // Über eine Minute: in Minuten
    await p.evaluate(() => { window.__listeners = [{ name: "Shelly Garage", rssi: -76, age: 118, used: true }]; });
    check(`[${tag}] ab 60 s in Minuten`, await wait(`return r.querySelector("dialog.stat-dlg [data-sig-live]")?.textContent.includes(${JSON.stringify(T.agoMin)})`, 12000));

    // Niemand hört das Gerät (Einzelsicht fehlt): keine Zeile
    await p.evaluate(() => { window.__listeners = []; });
    check(`[${tag}] ohne Empfänger verschwindet die Zeile`, await wait(`return !r.querySelector("dialog.stat-dlg [data-sig-live]")`, 12000));
    await p.evaluate(() => { delete window.__listeners; });

    // Zigbee: keine Live-Zeile
    check(`[${tag}] Zigbee-Gerät öffnet`, await openSignal("e"));
    check(`[${tag}] Zigbee: keine Live-Zeile`, (await live()) === null);

    // Fenster zu: der Takt hört auf
    await tap('dialog.stat-dlg [data-stat="close"]');
    check(`[${tag}] Fenster zu: Takt gestoppt`, await ev(`return r.host._liveTimer === null`));

    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
