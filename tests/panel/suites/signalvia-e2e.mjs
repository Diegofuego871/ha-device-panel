// Weg des Bluetooth-Empfangs im Fenster "Empfang" (2.40.0, Variante C): Balken mit Abschnitten je Empfänger (Lücke schraffiert), Legende mit
// Anteil und mittlerem Empfang, Liste der Wechsel, Hinweis. Für alle drei Zeiträume; Geräte ohne Weg (Zigbee) zeigen nichts davon.
// Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: {
    title: "Verbunden über", changes: "Wechsel", axis: { "24h": "vor 24 Std.|12 Std.|jetzt", "7d": "vor 7 Tagen|3,5 Tage|jetzt", "30d": "vor 30 Tagen|15 Tage|jetzt" },
    share: /^\d+ % · Ø -\d+ dBm$/, note: "Vom Panel aufgezeichnet, seit ", noteEnd: "Lücken (schraffiert): Gerät nicht empfangen.",
  },
  en: {
    title: "Connected via", changes: "Changes", axis: { "24h": "24 h ago|12 h|now", "7d": "7 days ago|3.5 days|now", "30d": "30 days ago|15 days|now" },
    share: /^\d+% · avg -\d+ dBm$/, note: "Recorded by the panel since ", noteEnd: "Gaps (hatched): device not received.",
  },
};
const COUNT = { "24h": 3, "7d": 4, "30d": 3 };

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
    const range = async (r) => { await tap(`dialog.stat-dlg [data-stat="range"][data-range="${r}"]`); return wait(`return r.querySelector('dialog.stat-dlg [data-range="${r}"]')?.classList.contains("on") && !r.querySelector("dialog.stat-dlg .avail .dlg-note")?.textContent.includes("…")`); };
    const openSignal = async (id) => {
      if (await ev(`return r.querySelector("dialog.stat-dlg").open`)) await tap('dialog.stat-dlg [data-stat="close"]');
      if (await ev(`return r.querySelector("dialog.device").open`)) await tap('dialog.device [data-dlg="close"]');
      await tap(`.dev[data-open="${id}"]`);
      await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device .st-tile[data-kind="signal"]')`);
      await tap('dialog.device .st-tile[data-kind="signal"]');
      return wait(`return r.querySelector("dialog.stat-dlg")?.open && (!!r.querySelector("dialog.stat-dlg .bh-svg") || !!r.querySelector("dialog.stat-dlg .bh-src"))`);
    };
    const via = () => ev(`const v=r.querySelector("dialog.stat-dlg .sv"); if(!v) return null; const segs=[...v.querySelectorAll(".sv-bar i")]; return {
      title: v.querySelector("h3").textContent, segs: segs.length, gaps: segs.filter(i=>i.classList.contains("gap")).length,
      width: segs.reduce((a,i)=>a+parseFloat(i.style.width),0), colors: new Set(segs.filter(i=>!i.classList.contains("gap")).map(i=>i.style.background)).size,
      axis: [...v.querySelectorAll(".sv-axis span")].map(x=>x.textContent).join("|"), legend: [...v.querySelectorAll(".sv-leg div")].map(d=>[d.querySelector("b").textContent, d.querySelector("span").textContent]),
      dots: [...v.querySelectorAll(".sv-dot")].map(d=>d.style.background).join(), changes: v.querySelector(".sv-chg h4")?.textContent || null, rows: [...v.querySelectorAll(".sv-chg p")].map(x=>x.textContent.replace(/\\s+/g," ")), note: v.querySelector(".sv-note").textContent };`);

    // Bluetooth-Gerät: Weg im Fenster "Empfang"
    check(`[${tag}] Fenster "Empfang" des Bluetooth-Geräts öffnet`, await openSignal("a"));
    let v = await via();
    check(`[${tag}] 24 Std.: Abschnitt "${T.title}" da`, v && v.title === T.title, JSON.stringify(v?.title));
    check(`[${tag}] 24 Std.: 5 Abschnitte, davon eine Lücke, zusammen 100 %`, v?.segs === 5 && v.gaps === 1 && Math.abs(v.width - 100) < 0.1, `${v?.segs}/${v?.gaps}/${v?.width}`);
    check(`[${tag}] 24 Std.: drei Empfänger, drei Farben`, v?.legend.length === COUNT["24h"] && v.colors === 3, JSON.stringify(v?.legend));
    check(`[${tag}] Legende: Name, Anteil und Ø dBm`, v?.legend.every(([n, s]) => n && T.share.test(s)) && v.legend[0][0] === "Storen Büro", JSON.stringify(v?.legend));
    check(`[${tag}] Anteile ergeben 100`, v?.legend.reduce((a, [, s]) => a + parseInt(s), 0) === 100);
    check(`[${tag}] Punkte der Legende haben die Farben des Balkens`, v?.dots.split("),").length === 3);
    check(`[${tag}] Achse`, v?.axis === T.axis["24h"], v?.axis);
    check(`[${tag}] Wechsel: Titel und Zeilen "A → B"`, v?.changes === T.changes && v.rows.length >= 1 && v.rows.every((x) => x.includes(" → ")), JSON.stringify(v?.rows));
    check(`[${tag}] Hinweis: Aufzeichnung seit, Lücken`, v?.note.startsWith(T.note) && v.note.endsWith(T.noteEnd), v?.note);
    check(`[${tag}] Weg steht unter dem Verlauf`, await ev(`const d=r.querySelector("dialog.stat-dlg"); const a=d.querySelector(".bh-src"), s=d.querySelector(".sv"); return !!a && !!s && !!(a.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING)`));
    check(`[${tag}] nichts läuft über den Rand`, await ev(`const d=r.querySelector("dialog.stat-dlg .dlg-body"); return d.scrollWidth <= d.clientWidth + 1`));
    await p.screenshot({ path: `${outDir}/signalvia-24h-${tag.replace("/", "-")}.png` });
    for (const rg of ["7d", "30d"]) {
      check(`[${tag}] ${rg} lädt`, await range(rg));
      v = await via();
      check(`[${tag}] ${rg}: ${COUNT[rg]} Empfänger, Achse, Anteile 100`, v?.legend.length === COUNT[rg] && v.axis === T.axis[rg] && v.legend.reduce((a, [, s]) => a + parseInt(s), 0) === 100, JSON.stringify([v?.legend.length, v?.axis]));
      check(`[${tag}] ${rg}: Balken zusammen 100 %`, Math.abs(v.width - 100) < 0.1, String(v?.width));
      if (rg === "7d") await p.screenshot({ path: `${outDir}/signalvia-7d-${tag.replace("/", "-")}.png` });
    }

    // Ohne Weg (Zigbee): nichts davon
    check(`[${tag}] Zigbee-Gerät öffnet`, await openSignal("e"));
    check(`[${tag}] Zigbee: kein Abschnitt "${T.title}"`, (await via()) === null);

    // Bluetooth ohne aufgezeichneten Weg (zum Beispiel direkt nach dem Update): kein leerer Kasten
    await p.evaluate(() => { window.__viaOff = true; });
    check(`[${tag}] Bluetooth ohne Weg öffnet`, await openSignal("a"));
    check(`[${tag}] ohne Weg: kein Abschnitt`, (await via()) === null);
    await p.evaluate(() => { window.__viaOff = false; });

    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
