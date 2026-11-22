// HealthCheck-Dienste (2.236.0): Kapitel "HealthCheck-Dienste" in den Einstellungen (Überwachung und Meldungen, oberhalb der Systemmeldungen) mit Zusammenfassung und
// zwei Knöpfen, Formular (Erkennung bekannter Dienste, ein Fehler-Zusatz, sechs Kästchen für Fehlerfälle, davon ausgegraut, wenn die Meldung aus ist; Prüfung der Eingaben, Abstand),
// Liste (Suche, Sortierung, Testknöpfe "Fehler senden" und "OK", Protokoll-Knopf, Entfernen mit Rückfrage), höchstens fünf Dienste, Aufklappen "Was sind HealthCheck-Dienste?".
// Deutsch und Englisch, Desktop und Handy, echte Klicks und Tipps. Nur erfundene Adressen.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const CR = "https://cronitor.link/p/0123456789abcdef/haus?hc=sample";
const HC = "https://hc-ping.com/00000000-1111-2222-3333-444444444444";
const T = {
  de: { grp: "HealthCheck-Dienste", sys: "Systemmeldungen", none: "Keine Dienste eingerichtet", add: "Dienst hinzufügen", show: "Dienste anzeigen", one: "1 von 5 Diensten", allOk: "Alles in Ordnung", known: "Erkannt: Cronitor", dashChap: "Dashboard", case_off: "Gerät ausgefallen", case_bak: "Backup fehlgeschlagen", case_cpu: "Hohe Auslastung: CPU", case_stall: "Systemstillstand", offTxt: "Die Meldung bei Ausfall ist aus.", okAll: "Kein Lebenszeichen gescheitert", about: "Was sind HealthCheck-Dienste?", nameErr: "Ein Name ist nötig.", sufErr: "Für die Fehlerfälle braucht es den Zusatz.", title: "HealthCheck-Dienste", addTitle: "Dienst hinzufügen", delTitle: "Dienst entfernen?" },
  en: { grp: "HealthCheck services", sys: "System alerts", none: "No services set up", add: "Add service", show: "Show services", one: "1 of 5 services", allOk: "All good", known: "Recognised: Cronitor", dashChap: "Dashboard", case_off: "Device offline", case_bak: "Backup failed", case_cpu: "High load: CPU", case_stall: "System stall", offTxt: "The outage notification is off.", okAll: "No heartbeat failed", about: "What are HealthCheck services?", nameErr: "A name is required.", sufErr: "The error cases need the suffix.", title: "HealthCheck services", addTitle: "Add service", delTitle: "Remove service?" },
};

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
    const type = async (sel, value) => { const h = await handle(sel); await h.scrollIntoViewIfNeeded(); await h.fill(value); };
    const FORM = "dialog.hc-form-dlg";
    const LIST = "dialog.hc-dlg";
    await p.evaluate(() => { window.__hc = []; window.__hcPing = []; });

    // --- Kapitel in den Einstellungen
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    check(`[${tag}] Kapitel "${L.grp}" steht vor "${L.sys}" (nach der Ruhezeit)`, await wait(`return !!r.querySelector('[data-set="hc-open"]')`) && await ev(`const g = [...r.querySelectorAll(".mon-body > .mon-grp")].map((x) => x.textContent.trim()); const i = g.indexOf(${JSON.stringify(L.grp)}); return i > 0 && g[i + 1] === ${JSON.stringify(L.sys)}`), await ev(`return [...r.querySelectorAll(".mon-body > .mon-grp")].map((x) => x.textContent.trim()).join(" | ")`));
    check(`[${tag}] ohne Dienste: "${L.none}", Knöpfe "${L.add}" und "${L.show}"`, (await text(".hc-sum")).includes(L.none) && (await text('[data-set="hc-add"]')).includes(L.add) && (await text('[data-set="hc-open"]')).includes(L.show));
    check(`[${tag}] beide Knöpfe nebeneinander (eine Zeile), ohne Pfeil und ohne Kasten um das Kapitel`, await ev(`const a = r.querySelector('[data-set="hc-add"]').getBoundingClientRect(); const b = r.querySelector('[data-set="hc-open"]').getBoundingClientRect(); const c = getComputedStyle(r.querySelector(".hc-sum")); return Math.abs(a.top - b.top) < 2 && b.left > a.right - 1 && !r.querySelector('[data-set="hc-open"] .cbtn') && c.borderTopWidth === "0px" && c.backgroundImage === "none" && c.backgroundColor === "rgba(0, 0, 0, 0)"`));
    check(`[${tag}] Zusammenfassung ohne Dienste: Kachel mit Herz, Hinweis ohne Ampelpunkt`, await ev(`return !!r.querySelector(".hc-sum .hc-tile svg") && !r.querySelector(".hc-sum .hc-sdot") && r.querySelector(".hc-sum .hc-sum-st")?.textContent.trim().length > 0`));
    check(`[${tag}] beide Kapitel-Knöpfe zeigen ihr Symbol (auch auf dem Handy) und der Text ist nicht abgeschnitten`, await ev(`return ["hc-add", "hc-open"].every((k) => { const b = r.querySelector('[data-set="' + k + '"]'); const i = b.querySelector("svg"); const t = b.querySelector("span"); return i && i.getBoundingClientRect().width > 10 && t.scrollWidth <= t.clientWidth + 1 && t.getBoundingClientRect().left > i.getBoundingClientRect().right; })`));
    check(`[${tag}] Strich nach dem Kapitel wie bei den anderen Kapiteln (Linie unten, kein Kasten)`, await ev(`const c = getComputedStyle(r.querySelector(".hc-sum")); const o = getComputedStyle(r.querySelector(".opt:not(.hc-sum)")); return c.borderBottomWidth === "1px" && c.borderBottomColor === o.borderBottomColor && c.borderTopWidth === "0px" && c.borderLeftWidth === "0px"`));
    await ev(`r.querySelector(".hc-sum").scrollIntoView({ block: "center" })`);
    await p.screenshot({ path: `${outDir}/hc-chapter-${tag.replace("/", "-")}.png` });

    // --- Formular: Erkennung, Fehler-Zusatz, Fehlerfälle zum Ankreuzen
    await tap('[data-set="hc-add"]');
    if (mobile) check(`[${tag}] Schliessen-Knopf des Formulars am selben Ort wie in den Einstellungen`, await ev(`const a = r.querySelector('dialog.settings .dlg-head .dlg-close').getBoundingClientRect(); const c = r.querySelector('${FORM} .dlg-head .dlg-close').getBoundingClientRect(); return Math.abs(a.top - c.top) < 1 && Math.abs(a.right - c.right) < 1 && Math.abs(a.width - c.width) < 0.6`));
    check(`[${tag}] Schliessen-Kreuz des Formulars wie in den Einstellungen: gleiche Grösse und gleicher Abstand zur oberen rechten Ecke des Fensters`, await ev(`const off = (sel) => { const d = r.querySelector(sel).getBoundingClientRect(); const c = r.querySelector(sel + ' .dlg-head .dlg-close').getBoundingClientRect(); return [c.width, c.height, c.top - d.top, d.right - c.right].map((n) => Math.round(n * 10) / 10).join(","); }; return off('dialog.settings') === off('${FORM}')`));
    check(`[${tag}] Formular "${L.addTitle}" öffnet`, await wait(`return r.querySelector('${FORM}')?.open`) && (await text(`${FORM} h2`)) === L.addTitle);
    check(`[${tag}] sechs Kästchen in fester Reihenfolge, keines angekreuzt`, (await ev(`return [...r.querySelectorAll('${FORM} .hc-chk input')].map((i) => i.dataset.kind + (i.checked ? "+" : "")).join(",")`)) === "offline,backup,cpu,ram,disk,stall");
    check(`[${tag}] Beschriftungen "${L.case_off}", "${L.case_cpu}", "${L.case_stall}"`, (await text(`${FORM} .hc-chk:nth-child(1) b`)) === L.case_off && (await text(`${FORM} .hc-chk:nth-child(3) b`)) === L.case_cpu && (await text(`${FORM} .hc-chk:nth-child(6) b`)) === L.case_stall);
    check(`[${tag}] nur ein Zusatzfeld (kein Feld je Fall), keine Zeilen zum Verschieben`, (await ev(`return r.querySelectorAll('${FORM} [data-hc="f-suffix"]').length`)) === 1 && !(await ev(`return !!r.querySelector('${FORM} [data-hc="f-up"], ${FORM} [data-hc="f-pick"]')`)));
    await type(`${FORM} [data-hc="f-name"]`, "Haus");
    await type(`${FORM} [data-hc="f-url"]`, "https://example.org/ping/abc");
    check(`[${tag}] Unbekannter Dienst: das Feld "Link zum Dashboard" bleibt leer, ohne Vorschlag`, await ev(`return r.querySelector('${FORM} [data-hc="f-dash"]').value === "" && !r.querySelector('${FORM} [data-hc="f-take-dash"]')`));
    await type(`${FORM} [data-hc="f-url"]`, CR);
    check(`[${tag}] Cronitor erkannt: "${L.known}"`, await wait(`return r.querySelector('${FORM} [data-hcp="known"]')?.textContent.includes(${JSON.stringify(L.known)})`));
    check(`[${tag}] Fehler-Zusatz vorgeschlagen (unberührt) und Vorschau des Aufrufs`, await wait(`return r.querySelector('${FORM} [data-hc="f-suffix"]').value === "?state=fail&message=Device+Panel+error" && r.querySelector('${FORM} .hc-prev')?.textContent.includes("state=fail")`));
    // eigener Zusatz: der Nutzer hat das letzte Wort, danach steht der Vorschlag mit "Übernehmen" daneben
    await type(`${FORM} [data-hc="f-suffix"]`, "?state=down");
    check(`[${tag}] eigener Zusatz bleibt, Vorschlag mit "Übernehmen"`, await wait(`return !!r.querySelector('${FORM} [data-hc="f-take"]')`) && await ev(`return r.querySelector('${FORM} [data-hc="f-suffix"]').value`) === "?state=down");
    await tap(`${FORM} [data-hc="f-take"]`);
    check(`[${tag}] "Übernehmen" setzt den Vorschlag`, await ev(`return r.querySelector('${FORM} [data-hc="f-suffix"]').value`) === "?state=fail&message=Device+Panel+error");
    check(`[${tag}] Dashboard: eigenes Kapitel nach den Fehlerfällen und vor dem Abstand, Feld mit dem Vorschlag der Startseite des erkannten Dienstes`, await ev(`const t = [...r.querySelectorAll('${FORM} .set-title')].map((x) => x.textContent); const i = t.indexOf(${JSON.stringify(L.dashChap)}); return i > 0 && i === t.length - 2 && r.querySelector('${FORM} [data-hc="f-dash"]').value === "https://cronitor.io/app" && !r.querySelector('${FORM} [data-hc="f-take-dash"]')`));
    await type(`${FORM} [data-hc="f-dash"]`, "https://example.org/mein-dashboard");
    check(`[${tag}] Eigener Link bleibt stehen, der Vorschlag steht mit "Übernehmen" daneben`, await wait(`return !!r.querySelector('${FORM} [data-hc="f-take-dash"]')`) && await ev(`return r.querySelector('${FORM} [data-hc="f-dash"]').value`) === "https://example.org/mein-dashboard");
    await tap(`${FORM} [data-hc="f-take-dash"]`);
    check(`[${tag}] "Übernehmen" setzt den Vorschlag des Dashboards`, await ev(`return r.querySelector('${FORM} [data-hc="f-dash"]').value`) === "https://cronitor.io/app");
    await type(`${FORM} [data-hc="f-dash"]`, "kein link");
    check(`[${tag}] Ungültiger Link: Fehler`, await wait(`return !!r.querySelector('${FORM} [data-hcp="err-dash"] .hc-err')`));
    await type(`${FORM} [data-hc="f-dash"]`, "https://cronitor.io/app");
    check(`[${tag}] Gültiger Link: Fehler weg`, await wait(`return !r.querySelector('${FORM} [data-hcp="err-dash"] .hc-err')`));
    // Kästchen
    await tap(`${FORM} .hc-chk input[data-kind="offline"]`);
    await tap(`${FORM} .hc-chk input[data-kind="stall"]`);
    check(`[${tag}] zwei Kästchen angekreuzt: Gerät ausgefallen, Systemstillstand`, (await ev(`return [...r.querySelectorAll('${FORM} .hc-chk input:checked')].map((i) => i.dataset.kind).join(",")`)) === "offline,stall");

    // --- Ausgegraut, wenn die Meldung dafür aus ist
    await p.evaluate(() => { window.__hcAvail = { backup: false, cpu: false }; });
    await ev(`r.host._hc.load()`);
    await ev(`r.host._hc.renderForm(true)`);
    check(`[${tag}] Meldung aus: "${L.case_bak}" und "${L.case_cpu}" ausgegraut (nicht wählbar) mit Grund darunter`, await wait(`const d = (k) => r.querySelector('${FORM} .hc-chk input[data-kind="' + k + '"]'); return d("backup")?.disabled && d("cpu")?.disabled && !d("offline").disabled && r.querySelector('${FORM} .hc-chk.off small')`) || false);
    await ev(`r.host._hc.renderForm(true)`);
    check(`[${tag}] Grund steht da ("${L.offTxt}" für Backup nicht, für Ausfall ist die Meldung an)`, (await ev(`return r.querySelectorAll('${FORM} .hc-chk.off').length`)) === 2 && (await ev(`return r.querySelector('${FORM} .hc-chk.off small').textContent.length > 10`)));
    check(`[${tag}] ausgegraut: Klick ändert nichts`, await (async () => { await ev(`r.querySelector('${FORM} .hc-chk.off input').click()`); return (await ev(`return r.querySelector('${FORM} .hc-chk.off input').checked`)) === false; })());
    await ev(`r.querySelector('${FORM} .hc-chk-head').scrollIntoView({ block: "start" })`);
    await p.screenshot({ path: `${outDir}/hc-checks-${tag.replace("/", "-")}.png` });
    await p.evaluate(() => { window.__hcAvail = {}; });
    await ev(`r.host._hc.load()`);
    await wait(`return !r.querySelector('${FORM} .hc-chk.off')`);
    await ev(`r.host._hc.renderForm(true)`);

    // --- Prüfung der Eingaben
    await type(`${FORM} [data-hc="f-name"]`, "");
    await type(`${FORM} [data-hc="f-suffix"]`, "");
    await tap(`${FORM} button[type="submit"]`);
    check(`[${tag}] leerer Name und Fehlerfälle ohne Zusatz: Fehler, nichts gespeichert`, await wait(`return r.querySelector('${FORM} [data-hcp="err-name"]')?.textContent.includes(${JSON.stringify(L.nameErr)}) && r.querySelector('${FORM} [data-hcp="err-suffix"]')?.textContent.includes(${JSON.stringify(L.sufErr)})`) && (await p.evaluate(() => window.__hc.length)) === 0);
    await type(`${FORM} [data-hc="f-name"]`, "Haus");
    await type(`${FORM} [data-hc="f-suffix"]`, "falsch");
    check(`[${tag}] Zusatz ohne "/", "?" oder "&": Fehler`, await wait(`return !!r.querySelector('${FORM} [data-hcp="err-suffix"] .hc-err')`));
    await type(`${FORM} [data-hc="f-suffix"]`, "?state=fail&message=Battery+low");
    await type(`${FORM} [data-hc="f-value"]`, "0");
    check(`[${tag}] Abstand 0: Fehler`, await wait(`return !!r.querySelector('${FORM} [data-hcp="err-interval"] .hc-err')`));
    await tap(`${FORM} [data-hc="f-preset"][data-sec="900"]`);
    check(`[${tag}] Schnellwahl 15 Minuten setzt Zahl und Einheit`, (await ev(`return r.querySelector('${FORM} [data-hc="f-value"]').value`)) === "15" && (await ev(`return r.querySelector('${FORM} [data-hc="f-unit"]').value`)) === "min" && await ev(`return r.querySelector('${FORM} .hc-presets .sub-tab.on')?.dataset.sec`) === "900");
    check(`[${tag}] Schnellwahl ist eine Reiterleiste mit gleitender Kapsel`, await wait(`return !!r.querySelector('${FORM} .hc-presets .seg-pill')`));
    await p.screenshot({ path: `${outDir}/hc-form-${tag.replace("/", "-")}.png` });
    await tap(`${FORM} button[type="submit"]`);
    check(`[${tag}] Fussknöpfe des Formulars gleich breit`, await ev(`const w = [...r.querySelectorAll('${FORM} .dlg-actions .dlg-btn')].map((b) => b.getBoundingClientRect().width); return w.length === 2 && Math.abs(w[0] - w[1]) < 1`));
    check(`[${tag}] Speichern: Formular zu, Dienst beim Server mit Zusatz, zwei Fehlerfällen und 900 s`, await wait(`return !r.querySelector('${FORM}')?.open`) && await p.evaluate(() => { const i = window.__hc[0]; return window.__hc.length === 1 && i.name === "Haus" && i.url.includes("cronitor.link") && i.interval === 900 && i.fail_suffix === "?state=fail&message=Battery+low" && i.dashboard === "https://cronitor.io/app" && i.cases.join() === "offline,stall"; }));
    check(`[${tag}] Kapitel zeigt "${L.one}"`, await wait(`return r.querySelector(".hc-sum")?.textContent.includes(${JSON.stringify(L.one)})`) && (await text(".hc-sum")).includes(L.allOk));
    await ev(`r.querySelector(".hc-sum").scrollIntoView({ block: "center" })`);
    await p.screenshot({ path: `${outDir}/hc-chapter-ok-${tag.replace("/", "-")}.png` });
    await ev(`r.host._hc.openList()`);
    await wait(`return r.querySelectorAll('${LIST} .hc-row').length >= 1`);
    check(`[${tag}] Schliessen-Kreuz der Liste wie in den Einstellungen: gleiche Grösse und gleicher Abstand zur oberen rechten Ecke des Fensters`, await ev(`const off = (sel) => { const d = r.querySelector(sel).getBoundingClientRect(); const c = r.querySelector(sel + ' .dlg-head .dlg-close').getBoundingClientRect(); return [c.width, c.height, c.top - d.top, d.right - c.right].map((n) => Math.round(n * 10) / 10).join(","); }; return off('dialog.settings') === off('${LIST}')`));
    check(`[${tag}] Fussknöpfe der Liste gleich breit`, await ev(`const w = [...r.querySelectorAll('${LIST} .dlg-actions .dlg-btn')].map((b) => b.getBoundingClientRect().width); return w.length === 2 && Math.abs(w[0] - w[1]) < 1`));
    await ev(`r.host._hc.closeList?.()`);

    // --- Liste
    await tap('[data-set="hc-open"]');
    check(`[${tag}] Liste "${L.title}" mit einer Zeile, Name, URL und zwei Fall-Marken`, await wait(`return r.querySelector('${LIST}')?.open && r.querySelectorAll('${LIST} .hc-row').length === 1`) && (await text(`${LIST} .hc-name`)) === "Haus" && (await text(`${LIST} .hc-addr`)).includes("cronitor.link") && (await ev(`return r.querySelectorAll('${LIST} .hc-case-chip').length`)) === 2);
    check(`[${tag}] Zeile: Cronitor als Marke, Zustand "kein Lebenszeichen" (neutral)`, (await text(`${LIST} .hc-tag`)) === "Cronitor" && await ev(`return r.querySelector('${LIST} .hc-state').classList.contains("none")`));
    check(`[${tag}] Alle Symbole in den runden Knöpfen sind genau so gross wie das Kreuz-Symbol (18 px, wie bei Alarmageddon)`, await ev(`const sz = (svg) => svg.getBoundingClientRect().width + "x" + svg.getBoundingClientRect().height; const x = sz(r.querySelector('${LIST} .dlg-head .dlg-close svg')); const bs = [...r.querySelectorAll('${LIST} .hc-row .hc-btns .hc-ib svg')].map(sz); return bs.length >= 4 && x === "18x18" && bs.every((v) => v === x)`));
    check(`[${tag}] Knöpfe der Dienste stehen rechtsbündig in der Karte`, await ev(`const row = r.querySelector('${LIST} .hc-row'); const rr = row.getBoundingClientRect(); const bs = [...row.querySelectorAll('.hc-btns .hc-ib')]; const last = bs[bs.length - 1].getBoundingClientRect(); const cs = getComputedStyle(row); return Math.abs((rr.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth)) - last.right) < 1.5`));
    check(`[${tag}] Runde Knöpfe der Liste wie in Alarmageddon: 44 px, Ring in Textfarbe (1 px); das Kreuz ist etwas kleiner (höchstens 44 px)`, await ev(`const c = r.querySelector('${LIST} .dlg-head .dlg-close').getBoundingClientRect(); const bs = [...r.querySelectorAll('${LIST} .hc-row .hc-ib')]; return bs.length >= 4 && c.width <= 44 && bs.every((b) => { const q = b.getBoundingClientRect(); const cs = getComputedStyle(b); return Math.abs(q.width - 44) < 0.6 && Math.abs(q.height - 44) < 0.6 && cs.borderTopWidth === "1px"; })`));
    check(`[${tag}] Knöpfe: Protokoll, Fehler senden, OK, Bearbeiten, Entfernen (je rund, ein Fehler-Test statt eines je Fall)`, (await ev(`return r.querySelectorAll('${LIST} .hc-row[data-hc-row="${"a1"}"] .hc-ib').length >= 0 && r.querySelector('${LIST} .hc-row .hc-btns').querySelectorAll(".hc-ib").length`)) === 5);
    await tap(`${LIST} .hc-ib[data-hc="test"][data-kind="error"]`);
    check(`[${tag}] Testknopf "Fehler senden": der Server bekommt "error", Zustand orange`, await wait(`return r.querySelector('${LIST} .hc-state')?.classList.contains("warn")`) && (await p.evaluate(() => JSON.stringify(window.__hcPing.map((x) => x.kind)))) === JSON.stringify(["error"]));
    await tap(`${LIST} .hc-ib[data-hc="test"][data-kind="ok"]`);
    check(`[${tag}] Testknopf OK: Zustand wieder grün`, await wait(`return r.querySelector('${LIST} .hc-state')?.classList.contains("ok")`));
    check(`[${tag}] Zusammenfassung wie in Alarmageddon: Kachel mit Herz, "${L.one}", grüner Punkt mit "${L.allOk}" (positiv formuliert)`, await wait(`const st = r.querySelector(".hc-sum .hc-sum-st"); return !!r.querySelector(".hc-sum .hc-tile svg") && r.querySelector(".hc-sum .hc-sum-tx b")?.textContent.trim() === ${JSON.stringify(L.one)} && st?.textContent.trim() === ${JSON.stringify(L.allOk)} && !st.classList.contains("bad") && getComputedStyle(st.querySelector(".hc-sdot")).backgroundColor !== getComputedStyle(st).color`));
    await p.evaluate(() => { window.__hcFail = { [window.__hc[0].id]: true }; });
    await tap(`${LIST} .hc-ib[data-hc="test"][data-kind="error"]`);
    check(`[${tag}] gescheiterter Test: Zustand rot mit HTTP 503`, await wait(`return r.querySelector('${LIST} .hc-state')?.classList.contains("err") && r.querySelector('${LIST} .hc-state').textContent.includes("503")`));
    check(`[${tag}] Kapitel dahinter nachgeführt: roter Punkt, Name und Grund der Meldung ("HTTP 503") gleich in der Zusammenfassung`, await ev(`const st = r.querySelector(".hc-sum .hc-sum-st"); const dot = st?.querySelector(".hc-sdot"); const name = r.host._hc.items[0].name; return !!st && st.classList.contains("bad") && st.textContent.includes(name) && st.textContent.includes("HTTP 503") && getComputedStyle(dot).backgroundColor === getComputedStyle(st).color`));
    await p.evaluate(() => { window.__hcFail = {}; });
    // Suche und Sortierung
    await p.evaluate(() => window.__hc.push({ id: "second", name: "Zweiter", url: "https://hc-ping.com/00000000-1111-2222-3333-444444444444", interval: 300, cases: [], fail_suffix: "", status: null, log: null }));
    await ev(`r.host._hc.load()`);
    check(`[${tag}] zwei Dienste in der Liste, Zähler`, await wait(`return r.querySelectorAll('${LIST} .hc-row').length === 2`) && (await text(`${LIST} .hc-listhead`)).includes(lang === "de" ? "2 von 5 Diensten" : "2 of 5 services"));
    await type(`${LIST} input[data-hc="search"]`, "zweit");
    check(`[${tag}] Suche "zweit": nur "Zweiter", Zähler zeigt die Treffer`, await wait(`return r.querySelectorAll('${LIST} .hc-row').length === 1 && r.querySelector('${LIST} .hc-name').textContent === "Zweiter"`) && (await text(`${LIST} .hc-listhead`)).includes(lang === "de" ? "1 von 2 Diensten" : "1 of 2 services"));
    check(`[${tag}] Suchfeld nach der Regel (list-search, Lupe, X nur mit Text)`, await ev(`const l = r.querySelector('${LIST} label.list-search'); return !!l && !!l.querySelector('input[type="search"]') && !l.querySelector("[data-fc]").hidden`));
    await tap(`${LIST} [data-fc]`);
    check(`[${tag}] X leert die Suche, beide Zeilen wieder da`, await wait(`return r.querySelectorAll('${LIST} .hc-row').length === 2 && r.querySelector('${LIST} input[data-hc="search"]').value === ""`));
    await ev(`const s = r.querySelector('${LIST} select[data-hc="sort"]'); s.value = "interval"; s.dispatchEvent(new Event("change", { bubbles: true }))`);
    check(`[${tag}] Sortierung nach Intervall aufsteigend: "Zweiter" (5 min) vor "Haus" (15 min)`, await wait(`return r.querySelector('${LIST} .hc-name').textContent === "Zweiter"`));
    await tap(`${LIST} [data-hc="sort-dir"]`);
    check(`[${tag}] Richtung umkehren`, await wait(`return r.querySelector('${LIST} .hc-name').textContent === "Haus"`));
    // Aufklappen
    await tap(`${LIST} .hc-about summary`);
    check(`[${tag}] "${L.about}" klappt auf, bleibt beim Neuzeichnen offen`, await wait(`return r.querySelector('${LIST} .hc-about').open`) && await (async () => { await ev(`r.host._hc.renderList()`); return ev(`return r.querySelector('${LIST} .hc-about').open`); })());
    await p.screenshot({ path: `${outDir}/hc-list-${tag.replace("/", "-")}.png` });
    // Entfernen mit Rückfrage
    await tap(`${LIST} .hc-row[data-hc-row="second"] .hc-ib.bad`);
    check(`[${tag}] Entfernen fragt nach ("${L.delTitle}"), Abbrechen lässt den Dienst stehen`, await wait(`return r.querySelector("dialog.discard-dlg")?.open && r.querySelector("dialog.discard-dlg b")?.textContent === ${JSON.stringify(L.delTitle)}`));
    await tap('dialog.discard-dlg [data-dd="no"]');
    check(`[${tag}] nach "Abbrechen" beide Dienste da`, (await p.evaluate(() => window.__hc.length)) === 2);
    await tap(`${LIST} .hc-row[data-hc-row="second"] .hc-ib.bad`);
    await wait(`return r.querySelector("dialog.discard-dlg")?.open`);
    await tap('dialog.discard-dlg [data-dd="yes"]');
    check(`[${tag}] Entfernen: weg beim Server und in der Liste`, await wait(`return r.querySelectorAll('${LIST} .hc-row').length === 1`) && (await p.evaluate(() => window.__hc.length)) === 1);
    // Bearbeiten
    await tap(`${LIST} .hc-ib[data-hc="edit"]`);
    check(`[${tag}] Bearbeiten: Formular mit den Werten (Name, Zusatz, zwei angekreuzte Fehlerfälle, 15 Minuten)`, await wait(`return r.querySelector('${FORM}')?.open && r.querySelector('${FORM} [data-hc="f-name"]').value === "Haus"`) && (await ev(`return r.querySelectorAll('${FORM} .hc-chk input:checked').length`)) === 2 && (await ev(`return r.querySelector('${FORM} [data-hc="f-value"]').value`)) === "15");
    await tap(`${FORM} [data-hc="f-cancel"]`);
    check(`[${tag}] Abbrechen schliesst das Formular ohne zu speichern`, await wait(`return !r.querySelector('${FORM}')?.open`));

    // --- Höchstens fünf
    await p.evaluate(() => { for (let n = window.__hc.length; n < 5; n++) window.__hc.push({ id: `x${n}`, name: `Dienst ${n}`, url: "https://hc-ping.com/00000000-1111-2222-3333-44444444444" + n, interval: 300, cases: [], fail_suffix: "", status: null, log: null }); });
    await ev(`r.host._hc.load()`);
    await wait(`return r.querySelectorAll('${LIST} .hc-row').length === 5`);
    check(`[${tag}] fünf Dienste: "${L.add}" gesperrt (Fuss und Kapitel)`, await ev(`return r.querySelector('${LIST} [data-hc-foot] [data-hc="add"]').disabled && r.querySelector('[data-set="hc-add"]').disabled`));
    await tap(`${LIST} [data-hc="close"]`);
    check(`[${tag}] "Schliessen" schliesst die Liste`, await wait(`return !r.querySelector('${LIST}')?.open`));
    check(`[${tag}] keine Fehler in der Konsole`, errors.length === 0, errors.join(" | ").slice(0, 200));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
