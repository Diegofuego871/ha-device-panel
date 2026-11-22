// Protokoll der HealthCheck-Dienste (2.236.0): Fenster über den Knopf "Protokoll" der Liste; Kopf mit Name als Auswahl, Zustand, runden Testknöpfen je Fall und OK;
// drei Reiter (Verlauf, Antwortzeit, Dienst); Zeitraum (sieben Stufen) mit Grafik je Stufe (Herzschlag, Stundenraster (7 und 30 Tage), Monatsraster), Kennzahlen, Legende;
// Liste mit "Ereignisse" und "Alle Aufrufe" (Zahl am Reiter, Suche, Sortierung); Ladeanzeige nach der Regel für Grafiken; leerer Zustand; Reiter "Dienst" mit
// Kopierknöpfen. Deutsch und Englisch, Desktop und Handy, echte Klicks und Tipps. Nur erfundene Adressen.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { tabs: ["Verlauf", "Antwortzeit", "Dienst"], ranges: ["3 Std.", "12 Std.", "24 Std.", "7 Tage", "30 Tage", "6 Monate", "1 Jahr"], events: "Ereignisse", calls: "Alle Aufrufe", noData: "Noch keine Aufrufe aufgezeichnet.", rate: "Erfolgsquote", tab_mean: "Ø Antwortzeit", testCase: "Fehler senden", copied: "Kopiert", callsDay: "Einzelne Aufrufe gibt es nur für die letzten 24 Stunden", report: "Fall gemeldet: Gerät ausgefallen", okSince: "In Ordnung seit" },
  en: { tabs: ["History", "Response time", "Service"], ranges: ["3 h", "12 h", "24 h", "7 days", "30 days", "6 months", "1 year"], events: "Events", calls: "All calls", noData: "No calls recorded yet.", rate: "Success rate", tab_mean: "Avg. response", testCase: "Send error", copied: "Copied", callsDay: "Single calls exist only for the last 24 hours", report: "Case reported: Device offline", okSince: "OK since" },
};
const ITEMS = () => [
  { id: "a1", name: "Haus", url: "https://cronitor.link/p/0123456789abcdef/haus?hc=sample", interval: 300, fail_suffix: "?state=fail&message=Device+Panel+error", cases: ["offline", "stall"], status: { at: new Date().toISOString(), sent: "ok", result: "ok", code: 200, test: false }, log: { state: "ok", since: new Date(Date.now() - 3600000).toISOString() } },
  { id: "b2", name: "Zweiter", url: "https://hc-ping.com/00000000-1111-2222-3333-444444444444", interval: 3600, cases: [], fail_suffix: "", status: null, log: null },
];

for (const lang of ["de", "en"]) {
  const L = T[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
    const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.innerText || "").replace(/\\s+/g," ").trim()`);
    const LIST = "dialog.hc-dlg";
    const LOG = "dialog.hl-dlg";
    await p.evaluate((items) => { window.__hc = items; window.__hcPing = []; window.__hcLog = {}; }, ITEMS());

    await ev(`r.host._hc.openList()`);
    await wait(`return r.querySelectorAll('${LIST} .hc-row').length === 2`);
    await tap(`${LIST} .hc-row[data-hc-row="a1"] .hc-ib[data-hc="log"]`);
    check(`[${tag}] Fenster "Protokoll" öffnet über der Liste, Kopf mit Name "Haus"`, await wait(`return r.querySelector('${LOG}')?.open && r.querySelector('${LOG} .hl-pick b')?.textContent === "Haus"`));
    check(`[${tag}] Zustand "${L.okSince}" im Kopf`, await wait(`return r.querySelector('${LOG} .hl-pill')?.textContent.includes(${JSON.stringify(L.okSince.split(" ")[0])})`));
    check(`[${tag}] drei Reiter ${L.tabs.join(", ")} als Reiterleiste mit Kapsel`, (await ev(`return [...r.querySelectorAll('${LOG} .hl-tabs .sub-tab .hl-tx small')].map((x) => x.textContent).join("|")`)) === L.tabs.join("|") && await wait(`return !!r.querySelector('${LOG} .hl-tabs .seg-pill')`));
    check(`[${tag}] Oberer Bereich wie in Alarmageddon: Reiter mit Symbol, Antwortzeit-Reiter mit Wert, sichtbarer Text je Reiter`, await ev(`const t = [...r.querySelectorAll('${LOG} .hl-tabs .hl-tab')]; const vis = (e) => e && getComputedStyle(e).display !== "none" && e.textContent.trim() !== ""; return t.length === 3 && t.every((b) => b.querySelector(".hl-ti svg")) && vis(t[1].querySelector("b")) && /ms|–|-/.test(t[1].querySelector("b").textContent) && (${mobile} ? !vis(t[0].querySelector("b")) && !vis(t[2].querySelector("b")) && vis(t[0].querySelector("small")) && vis(t[2].querySelector("small")) && !vis(t[1].querySelector("small")) : vis(t[0].querySelector("b")) && vis(t[0].querySelector("small")))`));
    check(`[${tag}] Zeiträume klein in einer Zeile (alle sieben auf gleicher Höhe, höchstens 40 px hoch)`, await ev(`const b = [...r.querySelectorAll('${LOG} .hl-range .sub-tab')].map((x) => x.getBoundingClientRect()); return b.length === 7 && b.every((q) => Math.abs(q.top - b[0].top) < 1 && q.height <= 40)`));
    check(`[${tag}] Zeiträume: jeder Text passt in sein Feld (nichts überlappt oder wird abgeschnitten)`, await ev(`const b = [...r.querySelectorAll('${LOG} .hl-range .sub-tab')]; return b.every((x) => x.scrollWidth <= x.clientWidth + 1)`));
    check(`[${tag}] Kennzahlen ohne Kachel, nebeneinander (kein Rand, kein Grund)`, await ev(`const k = [...r.querySelectorAll('${LOG} .hl-kpi')]; return k.length >= 3 && k.every((e) => { const c = getComputedStyle(e); return c.borderTopWidth === "0px" && c.backgroundColor === "rgba(0, 0, 0, 0)"; }) && k.every((e) => Math.abs(e.getBoundingClientRect().top - k[0].getBoundingClientRect().top) < 1)`));
    check(`[${tag}] Zeitraum: sieben Stufen, 24 Std. gewählt`, (await ev(`return [...r.querySelectorAll('${LOG} .hl-range .sub-tab')].map((x) => x.textContent).join("|")`)) === L.ranges.join("|") && (await ev(`return r.querySelector('${LOG} .hl-range .sub-tab.on').dataset.hours`)) === "24");
    check(`[${tag}] Kennzahlen mit "${L.rate}", Grafik "Herzschlag" mit Balken`, await wait(`return !!r.querySelector('${LOG} .hl-kpi') && r.querySelectorAll('${LOG} .hl-b').length > 20`) && (await text(`${LOG} .hl-kpis`)).includes(L.rate));
    check(`[${tag}] Kopf: Testknopf "Fehler senden", OK und der Stift`, (await ev(`return r.querySelectorAll('${LOG} .hl-acts .hc-ib').length`)) === 3 && (await ev(`return r.querySelector('${LOG} .hl-acts .hc-ib.warn')?.getAttribute("title")`)) === L.testCase);
    check(`[${tag}] Schliessen-Kreuz des Protokolls wie in der Liste darunter (und damit wie in den Einstellungen, siehe hc-e2e): gleiche Grösse und gleicher Abstand zur oberen rechten Ecke des Fensters`, await ev(`const off = (sel) => { const d = r.querySelector(sel).getBoundingClientRect(); const c = r.querySelector(sel + ' .dlg-head .dlg-close').getBoundingClientRect(); return [c.width, c.height, c.top - d.top, d.right - c.right].map((n) => Math.round(n * 10) / 10).join(","); }; return off('${LIST}') === off('${LOG}')`));
    check(`[${tag}] Kopf: Symbole der Knöpfe sind genau so gross wie das Kreuz-Symbol (18 px, wie bei Alarmageddon)`, await ev(`const sz = (svg) => svg.getBoundingClientRect().width + "x" + svg.getBoundingClientRect().height; const x = sz(r.querySelector('${LOG} .hl-head .dlg-close svg')); const bs = [...r.querySelectorAll('${LOG} .hl-acts .hc-ib svg')].map(sz); return bs.length === 3 && x === "18x18" && bs.every((v) => v === x)`));
    check(`[${tag}] Kopf: Testknöpfe und Stift 44 px wie in Alarmageddon; ${mobile ? "rechts unter dem Kreuz" : "links neben dem Kreuz"}`, await ev(`const c = r.querySelector('${LOG} .hl-head .dlg-close').getBoundingClientRect(); return [...r.querySelectorAll('${LOG} .hl-acts .hc-ib')].every((b) => { const q = b.getBoundingClientRect(); const same = Math.abs(q.width - 44) < 0.6 && Math.abs(q.height - 44) < 0.6; return same && (${mobile} ? q.top >= c.bottom - 1 && q.right <= c.right + 1 : q.right <= c.left && Math.abs((q.top + q.height / 2) - (c.top + c.height / 2)) < 2); }) && (!${mobile} || Math.abs(r.querySelector('${LOG} .hl-acts .hc-ib:last-child').getBoundingClientRect().right - c.right) < 2)`));
    check(`[${tag}] Liste: Reiter "${L.events}" und "${L.calls}" mit Zahlen`, (await ev(`return [...r.querySelectorAll('${LOG} .hl-lbar .sub-tab')].map((x) => x.firstChild.textContent).join("|")`)) === [L.events, L.calls].join("|") && (await ev(`return Number(r.querySelector('${LOG} .hl-lbar .sub-tab.on .hl-n').textContent)`)) === 4);
    check(`[${tag}] Ereignisse: gescheitert, Fall gemeldet, Test, wieder in Ordnung`, (await ev(`return r.querySelectorAll('${LOG} .hl-table tbody tr[data-kind]').length`)) === 4 && (await text(`${LOG} .hl-rows`)).includes(L.report));
    await p.screenshot({ path: `${outDir}/hclog-24h-${tag.replace("/", "-")}.png` });

    // Zeiträume: je Stufe die passende Grafik
    const charts = { 3: ".hl-b", 12: ".hl-b", 168: ".hl-cell", 720: ".hl-cell", 4320: "[data-day]", 8760: "[data-day]" };
    for (const [hours, sel] of Object.entries(charts)) {
      await tap(`${LOG} .hl-range [data-hours="${hours}"]`);
      check(`[${tag}] ${hours} Std.: Grafik passt zum Zeitraum (${sel})`, await wait(`return r.querySelector('${LOG} .hl-range .sub-tab.on')?.dataset.hours === "${hours}" && r.querySelectorAll('${LOG} .hl-chart ${sel}').length > 3 && !r.querySelector('${LOG} .pl-ld')`));
      if (hours === "168") await p.screenshot({ path: `${outDir}/hclog-7d-${tag.replace("/", "-")}.png` });
      if (hours === "168")
      check(`[${tag}] 7 Tage: Stundenraster wie bei 30 Tagen, sieben Zeilen mit je 24 quadratischen Zellen und Beschriftung jedes Tages`, await wait(`const c = [...r.querySelectorAll('${LOG} .hl-svg rect.hl-cell, ${LOG} .hl-svg rect.hl-track, ${LOG} .hl-svg rect.hl-b')]; const w = c.filter((x) => Math.abs(Number(x.getAttribute("width")) - Number(x.getAttribute("height"))) < 1.5); return c.length === 7 * 24 && w.length === c.length && r.querySelectorAll('${LOG} .hl-svg text').length >= 7 + 3`, 3000));
    }
    check(`[${tag}] Jahr: Monatsraster mit Tageszelle und Zusammenfassung der Tage`, await ev(`return !!r.querySelector('${LOG} .hl-sum') && r.querySelectorAll('${LOG} [data-kind="fail"]').length > 0`));
    check(`[${tag}] Liste folgt dem Zeitraum: Hinweis zu den einzelnen Aufrufen`, (await ev(`return r.querySelector('${LOG} .hl-lbar .sub-tab[data-pane="calls"]')?.click(), 1`)) && (await wait(`return r.querySelector('${LOG} .hl-note')?.textContent.includes(${JSON.stringify(L.callsDay)})`)));
    await p.screenshot({ path: `${outDir}/hclog-year-${tag.replace("/", "-")}.png` });
    // Das Fenster scrollt (Inhalt höher als das Fenster) und das Neuzeichnen hängt sich nie auf (kein Beobachter je Zeichnen dazu)
    check(`[${tag}] Fenster scrollt: Inhalt höher als der sichtbare Teil, scrollTop lässt sich setzen`, await ev(`const b = r.querySelector('${LOG} .dlg-body'); b.scrollTop = 150; return b.scrollHeight > b.clientHeight && b.scrollTop > 0 && getComputedStyle(b).overflowY === "auto"`));
    check(`[${tag}] 40 Mal neu zeichnen bleibt schnell (kein Hängen durch angehäufte Beobachter)`, await ev(`r.host._hl.pane = "events"; r.host._hl.render(); const t = performance.now(); for (let i = 0; i < 40; i++) r.host._hl.render(); return performance.now() - t < 2500`));
    await ev(`r.querySelector('${LOG} .dlg-body').scrollTop = 0`);
    await tap(`${LOG} .hl-range [data-hours="24"]`);
    await wait(`return r.querySelector('${LOG} .hl-range .sub-tab.on')?.dataset.hours === "24"`);

    // Antwortzeit
    await tap(`${LOG} .hl-tabs [data-tab="latency"]`);
    check(`[${tag}] Reiterwechsel: die Kapsel gleitet (Klasse go), sie springt nicht`, await wait(`return !!r.querySelector('${LOG} .hl-tabs .seg-pill.go')`, 500));
    check(`[${tag}] Reiter "${L.tabs[1]}": Linie, Fläche, Zonen und Kennzahl "${L.tab_mean}"`, await wait(`return !!r.querySelector('${LOG} .hl-line') && !!r.querySelector('${LOG} .hl-area') && r.querySelectorAll('${LOG} .hl-zone').length === 3 && !!r.querySelector('${LOG} .hl-failmark')`) && (await text(`${LOG} .hl-kpis`)).includes(L.tab_mean));
    await p.screenshot({ path: `${outDir}/hclog-latency-${tag.replace("/", "-")}.png` });
    await tap(`${LOG} .hl-tabs [data-tab="history"]`);

    // Suche und Sortierung in der Liste
    await tap(`${LOG} .hl-lbar .sub-tab[data-pane="events"]`);
    const input = await handle(`${LOG} input[data-hl="lq"]`);
    await input.fill("test");
    check(`[${tag}] Suche "test": nur der Test bleibt`, await wait(`return r.querySelectorAll('${LOG} .hl-table tbody tr[data-kind]').length === 1 && r.querySelector('${LOG} .hl-table tbody tr[data-kind]').dataset.kind === "test"`));
    await input.fill("");
    await wait(`return r.querySelectorAll('${LOG} .hl-table tbody tr[data-kind]').length === 4`);
    const first = () => ev(`return r.querySelector('${LOG} .hl-table tbody tr[data-kind]').dataset.kind`);
    const before = await first();
    await tap(`${LOG} .hl-sort[data-key="time"]`);
    check(`[${tag}] Sortierung nach Zeit kehrt die Reihenfolge um`, await wait(`return r.querySelector('${LOG} .hl-table tbody tr[data-kind]').dataset.kind !== ${JSON.stringify(before)}`));
    await tap(`${LOG} .hl-lbar .sub-tab[data-pane="calls"]`);
    check(`[${tag}] "${L.calls}": viele Zeilen (24 Stunden), Zahl am Reiter gleich der Zeilenzahl`, await wait(`return r.querySelectorAll('${LOG} .hl-table tbody tr[data-kind]').length > 100`) && (await ev(`return Number(r.querySelector('${LOG} .hl-lbar .sub-tab.on .hl-n').textContent) === r.querySelectorAll('${LOG} .hl-table tbody tr[data-kind]').length`)));

    // Wechsel des Dienstes, Testknopf aus dem Kopf
    await tap(`${LOG} [data-hl="menu"]`);
    check(`[${tag}] Auswahl im Kopf: beide Dienste, der gewählte mit Haken`, await wait(`return !r.querySelector('${LOG} .hl-menu').hidden && r.querySelectorAll('${LOG} .hl-mi').length === 2 && r.querySelector('${LOG} .hl-mi.on')`));
    check(`[${tag}] Auswahl im Kopf: die Einträge liegen sichtbar obenauf (Treffer-Test an echten Punkten, nicht verdeckt)`, await ev(`const ok = [...r.querySelectorAll('${LOG} .hl-mi')].every((m) => { const q = m.getBoundingClientRect(); const e = r.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return q.height > 20 && e && m.contains(e); }); return ok`));
    await p.screenshot({ path: `${outDir}/hclog-menu-${tag.replace("/", "-")}.png` });
    await tap(`${LOG} .hl-mi[data-id="b2"]`);
    check(`[${tag}] Wechsel zu "Zweiter": Kopf und Daten neu`, await wait(`return r.querySelector('${LOG} .hl-pick b')?.textContent === "Zweiter" && r.querySelectorAll('${LOG} .hl-b').length > 20`) && (await ev(`return r.querySelectorAll('${LOG} .hl-acts .hc-ib').length`)) === 2);
    await tap(`${LOG} [data-hl="menu"]`);
    await tap(`${LOG} .hl-mi[data-id="a1"]`);
    await wait(`return r.querySelector('${LOG} .hl-pick b')?.textContent === "Haus"`);
    check(`[${tag}] Zwei Dienste: Name mit Pfeil und Auswahl`, await ev(`return !!r.querySelector('${LOG} button.hl-pick[data-hl="menu"]') && !!r.querySelector('${LOG} .hl-menu')`));
    await tap(`${LOG} .hl-acts .hc-ib[data-kind="error"]`);
    check(`[${tag}] Testknopf im Kopf: der Server bekommt "error", das Protokoll lädt neu`, await wait(`return true`) && (await p.evaluate(() => window.__hcPing.map((x) => x.kind).join())) === "error");

    // Reiter "Dienst"
    await tap(`${LOG} .hl-tabs [data-tab="service"]`);
    check(`[${tag}] Reiter "${L.tabs[2]}": URL ganz, Fehler-Zusatz und Aufruf, Kopierknöpfe`, await wait(`return r.querySelectorAll('${LOG} .hl-drow').length >= 7`) && (await text(`${LOG} .hl-device`)).includes("cronitor.link/p/0123456789abcdef/haus") && (await ev(`return r.querySelectorAll('${LOG} .hl-drow [data-hl="copy"]').length`)) >= 4);
    check(`[${tag}] Kopierknöpfe stehen immer ganz rechts in ihrer Zeile`, await ev(`const rows = [...r.querySelectorAll('${LOG} .hl-drow')].filter((x) => x.querySelector('[data-hl="copy"]')); const edge = rows.map((x) => x.querySelector('[data-hl="copy"]').getBoundingClientRect().right); return rows.length >= 3 && Math.max(...edge) - Math.min(...edge) < 1.5`));
    check(`[${tag}] Reiter "Dienst" ohne Zeitraum und ohne Grafik`, await ev(`return !r.querySelector('${LOG} .hl-range') && !r.querySelector('${LOG} .hl-svg')`));
    const keep = await ev(`const h = r.host._hc; window.__keepItems = h.items; h.items = h.items.slice(0, 1); r.host._hl.render(); return true`);
    check(`[${tag}] Nur ein Dienst: Name ohne Pfeil, keine Auswahl`, await ev(`return !r.querySelector('${LOG} button.hl-pick') && !r.querySelector('${LOG} .hl-menu') && r.querySelector('${LOG} b.hl-pick.one')?.textContent === "Haus"`));
    await ev(`r.host._hc.items = window.__keepItems; r.host._hl.render()`);
    await p.screenshot({ path: `${outDir}/hclog-service-${tag.replace("/", "-")}.png` });
    await tap(`${LOG} .hl-tabs [data-tab="history"]`);

    // Bearbeiten aus dem Kopf
    await tap(`${LOG} [data-hl="edit"]`);
    check(`[${tag}] Stift öffnet das Formular über dem Protokoll`, await wait(`return r.querySelector('dialog.hc-form-dlg')?.open && r.querySelector('dialog.hc-form-dlg [data-hc="f-name"]').value === "Haus"`));
    await tap(`dialog.hc-form-dlg [data-hc="f-cancel"]`);

    // Leerer Zustand und Ladeanzeige
    await p.evaluate(() => { window.__hcLog = { empty: true }; });
    await ev(`r.host._hl.cache.clear()`);
    await tap(`${LOG} .hl-range [data-hours="168"]`);
    check(`[${tag}] ohne Aufrufe: "${L.noData}"`, await wait(`return r.querySelector('${LOG} .dlg-note')?.textContent.includes(${JSON.stringify(L.noData)})`));
    await p.evaluate(() => { window.__hcLog = {}; window.__wsDelay = { "device_panel/healthcheck_history": 700 }; });
    await ev(`r.host._hl.cache.clear()`);
    await tap(`${LOG} .hl-range [data-hours="720"]`);
    check(`[${tag}] Wechsel des Zeitraums: Reiter sofort, alte Grafik gedimmt mit drei Punkten darüber`, await wait(`return r.querySelector('${LOG} .hl-range .sub-tab.on')?.dataset.hours === "720" && !!r.querySelector('${LOG} .hl-chart .pl-ldwrap .pl-ld')`, 3000));
    check(`[${tag}] danach die Grafik des neuen Zeitraums ohne Ladeanzeige`, await wait(`return !r.querySelector('${LOG} .pl-ld') && r.querySelectorAll('${LOG} .hl-cell').length > 3`));
    await p.evaluate(() => { window.__wsDelay = {}; });

    // Schliessen
    await tap(`${LOG} .dlg-actions [data-hl="close"]`);
    check(`[${tag}] "Schliessen": Protokoll zu, Liste darunter bleibt offen`, await wait(`return !r.querySelector('${LOG}')?.open && r.querySelector('${LIST}')?.open`));
    check(`[${tag}] keine Fehler in der Konsole`, errors.length === 0, errors.join(" | ").slice(0, 200));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
