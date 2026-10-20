// Karte "Empfänger" im Fenster "Empfang" (2.112.0, Mockup signal-layout-v1 A): je Empfänger Name, Marke "zählt", Stand jetzt (RSSI und Alter, alle 5 s neu),
// Anteil und Ø im Zeitraum; Kacheln Jetzt/Median/Schlechtester/Bester; Hinweise hinter dem Info-Knopf. Zigbee zeigt keine Karte. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { median: "Median der letzten 5 Minuten", now: (v, a) => `gerade ${v} · ${a}`, ago: (s) => `vor ${s} s`, agoMin: "vor 2 Min.", used: "✓ zählt", idle: "gerade nicht gehört", only: "Shelly Neu" },
  en: { median: "median of the last 5 minutes", now: (v, a) => `now ${v} · ${a}`, ago: (s) => `${s} s ago`, agoMin: "2 min ago", used: "✓ counts", idle: "not heard right now", only: "Shelly Neu" },
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

    await openSignal("a");
    // Online, damit das Diagramm mit Verlauf da ist (Kacheln, Hinweise); offline gibt es keinen aktuellen Wert
    await p.evaluate(() => { const d = window.__devices.find((x) => x.id === "a"); d.online = true; d.offline_since = null; d.since_at_least = false; });
    check(`[${tag}] Fenster "Empfang" des Bluetooth-Geräts öffnet, mit Diagramm`, await openSignal("a") && await wait(`return !!r.querySelector("dialog.stat-dlg .bh-plot")`));
    const row = (name) => ev(`const x = [...r.querySelectorAll("dialog.stat-dlg .sv-row")].find((e) => e.querySelector(".sv-nm b").textContent === ${JSON.stringify(name)}); if (!x) return null; return { sub: x.querySelector(".sv-nm small").textContent, ok: x.querySelector(".sv-ok")?.textContent || "", far: x.querySelector(".sv-far")?.textContent || "", off: x.classList.contains("off") }`);
    let a = await row("Storen Büro"), c = await row("Küche");
    check(`[${tag}] Empfänger-Zeile mit Stand jetzt: Wert und Alter`, a?.sub === T.now("-76 dBm", T.ago(8)) && c?.sub === T.now("-97 dBm", T.ago(3)), JSON.stringify([a?.sub, c?.sub]));
    check(`[${tag}] gezählter Empfänger trägt die Marke, der andere nicht`, a?.ok === T.used && c?.ok === "", JSON.stringify([a?.ok, c?.ok]));
    check(`[${tag}] Empfänger ohne frische Meldung: "${T.idle}", abgeblendet`, (await row("Proxy Garage"))?.sub === T.idle && (await row("Proxy Garage")).off === true);
    check(`[${tag}] Hinweis zur Marke (Tooltip)`, await ev(`return (r.querySelector("dialog.stat-dlg .sv-ok")?.title || "").length > 20`));
    check(`[${tag}] Karte steht unter dem Diagramm`, await ev(`const d=r.querySelector("dialog.stat-dlg"); const a=d.querySelector(".bh-plot"), s=d.querySelector(".sv"); return !!a && !!s && !!(a.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING)`));
    check(`[${tag}] nichts läuft über den Rand`, await ev(`const d=r.querySelector("dialog.stat-dlg .dlg-body"); return d.scrollWidth <= d.clientWidth + 1`));
    await p.screenshot({ path: `${outDir}/signallive-${tag.replace("/", "-")}.png` });

    // Hinweise einmal hinter dem Info-Knopf, eingeklappt
    check(`[${tag}] Hinweise eingeklappt`, await ev(`const i = r.querySelector("dialog.stat-dlg [data-sig-info]"); return !!i && i.hidden && r.querySelector('dialog.stat-dlg [data-stat="sig-info"]').getAttribute("aria-expanded") === "false"`));
    await tap('dialog.stat-dlg [data-stat="sig-info"]');
    check(`[${tag}] Info-Knopf klappt die Hinweise auf (Quelle, Lücken, früherer Weg)`, await ev(`const i = r.querySelector("dialog.stat-dlg [data-sig-info]"); return !i.hidden && i.querySelectorAll("p").length >= 2 && !!i.querySelector(".sv-note") && r.querySelector('dialog.stat-dlg [data-stat="sig-info"]').getAttribute("aria-expanded") === "true"`));
    await tap('dialog.stat-dlg [data-stat="sig-info"]');
    check(`[${tag}] und wieder zu`, await ev(`return r.querySelector("dialog.stat-dlg [data-sig-info]").hidden`));

    check(`[${tag}] Kacheln: Jetzt (mit Schwelle), Median, Schlechtester, Bester`, await ev(`const d=r.querySelector("dialog.stat-dlg"); return !!d.querySelector(".sg-tile.now .sg-cur svg") && !!d.querySelector(".sg-tile.now .lim") && d.querySelectorAll(".sg-row3 .sg-tile").length === 3`));
    check(`[${tag}] Median-Hinweis steht in den Hinweisen`, await ev(`return [...r.querySelectorAll("dialog.stat-dlg [data-sig-info] .bh-src")].some((n) => n.textContent.includes(${JSON.stringify(T.median)}))`));
    check(`[${tag}] "Ø 5 Min." an der Kachel "Jetzt"`, await ev(`return !!r.querySelector("dialog.stat-dlg .sg-tile.now small u")`));

    // Läuft weiter: nach einem Takt (5 s) ist das Alter um 5 Sekunden gewachsen
    check(`[${tag}] Alter läuft weiter (alle 5 s neu geholt)`, await wait(`return [...r.querySelectorAll("dialog.stat-dlg .sv-row")].some((e) => e.textContent.includes(${JSON.stringify(T.ago(13))}))`, 9000));

    // Über eine Minute: in Minuten; ein Empfänger, der nur live gehört wird (nicht im Weg), steht grau am Ende
    await p.evaluate(() => { window.__listeners = [{ name: "Storen Büro", rssi: -76, age: 118, used: true }, { name: "Shelly Neu", rssi: -90, age: 4, used: false }]; });
    check(`[${tag}] ab 60 s in Minuten`, await wait(`return [...r.querySelectorAll("dialog.stat-dlg .sv-row")].some((e) => e.textContent.includes(${JSON.stringify(T.agoMin)}))`, 12000));
    check(`[${tag}] nur live gehörter Empfänger: graue Zeile am Ende ohne Anteil`, await ev(`const rows=[...r.querySelectorAll("dialog.stat-dlg .sv-row")]; const l=rows[rows.length-1]; return l.querySelector(".sv-nm b").textContent === ${JSON.stringify(T.only)} && l.querySelector(".sv-dot.none") && l.querySelector(".sv-sh b").textContent === "–"`));

    // Niemand hört das Gerät gerade: die Zeilen bleiben (Weg im Zeitraum), ohne Stand jetzt und ohne Marke
    await p.evaluate(() => { window.__listeners = []; });
    check(`[${tag}] ohne Empfänger: alle Zeilen "${T.idle}", keine Marke`, await wait(`const rows=[...r.querySelectorAll("dialog.stat-dlg .sv-row")]; return rows.length === 3 && rows.every((e) => e.querySelector(".sv-nm small").textContent === ${JSON.stringify(T.idle)}) && !r.querySelector("dialog.stat-dlg .sv-ok")`, 12000));
    await p.evaluate(() => { delete window.__listeners; });

    // Zigbee: keine Live-Zeile
    check(`[${tag}] Zigbee-Gerät öffnet`, await openSignal("e"));
    check(`[${tag}] Zigbee: keine Empfänger-Karte`, await ev(`return !r.querySelector("dialog.stat-dlg .sv")`));
    check(`[${tag}] Zigbee ohne Glättung: kein Hinweis auf den Median`, await ev(`return ![...r.querySelectorAll("dialog.stat-dlg .bh-src")].some((n) => n.textContent.includes(${JSON.stringify(T.median)}))`));

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
