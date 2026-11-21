// HealthCheck-Dienste (2.236.0): Kapitel "HealthCheck-Dienste" in den Einstellungen (Überwachung und Meldungen, oberhalb der Systemmeldungen) mit Zusammenfassung und
// zwei Knöpfen, Formular (Erkennung bekannter Dienste, Fälle als Zeilen mit eigenem Zusatz, Reihenfolge, Prüfung der Eingaben, Abstand), Liste (Suche, Sortierung,
// Testknöpfe je Fall und "OK", Protokoll-Knopf, Entfernen mit Rückfrage), höchstens fünf Dienste, Aufklappen "Was sind HealthCheck-Dienste?".
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
  de: { grp: "HealthCheck-Dienste", sys: "Systemmeldungen", none: "Keine Dienste eingerichtet", add: "Dienst hinzufügen", show: "Dienste anzeigen", one: "1 von 5 Diensten", known: "Erkannt: Cronitor", case_off: "Gerät ausgefallen", case_bat: "Batterie schwach", case_bak: "Backup fehlgeschlagen", okAll: "Kein Lebenszeichen gescheitert", about: "Was sind HealthCheck-Dienste?", nameErr: "Ein Name ist nötig.", sufErr: "Zusatz eintragen oder die Zeile entfernen.", title: "HealthCheck-Dienste", addTitle: "Dienst hinzufügen", delTitle: "Dienst entfernen?" },
  en: { grp: "HealthCheck services", sys: "System alerts", none: "No services set up", add: "Add service", show: "Show services", one: "1 of 5 services", known: "Recognised: Cronitor", case_off: "Device offline", case_bat: "Battery low", case_bak: "Backup failed", okAll: "No heartbeat failed", about: "What are HealthCheck services?", nameErr: "A name is required.", sufErr: "Enter a suffix or remove the row.", title: "HealthCheck services", addTitle: "Add service", delTitle: "Remove service?" },
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
    await ev(`r.querySelector(".hc-sum").scrollIntoView({ block: "center" })`);
    await p.screenshot({ path: `${outDir}/hc-chapter-${tag.replace("/", "-")}.png` });

    // --- Formular: Erkennung, Fälle
    await tap('[data-set="hc-add"]');
    check(`[${tag}] Formular "${L.addTitle}" öffnet`, await wait(`return r.querySelector('${FORM}')?.open`) && (await text(`${FORM} h2`)) === L.addTitle);
    await tap(`${FORM} [data-hc="f-addcase"]`);
    check(`[${tag}] Fall hinzufügen: erste freie Art "${L.case_off}" als Zeile`, (await text(`${FORM} .hc-case b`)) === L.case_off && (await ev(`return r.querySelectorAll('${FORM} .hc-case').length`)) === 1);
    await type(`${FORM} [data-hc="f-name"]`, "Haus");
    await type(`${FORM} [data-hc="f-url"]`, CR);
    check(`[${tag}] Cronitor erkannt: "${L.known}"`, await wait(`return r.querySelector('${FORM} [data-hcp="known"]')?.textContent.includes(${JSON.stringify(L.known)})`));
    check(`[${tag}] Zusatz des Falls vorgeschlagen (unberührt)`, await ev(`return r.querySelector('${FORM} [data-hc="f-case"]').value`) === "?state=fail&message=Device+offline");
    check(`[${tag}] Vorschau des Aufrufs mit den Parametern`, (await text(`${FORM} .hc-prev`)).includes("state=fail"));
    // eigener Zusatz: der Nutzer hat das letzte Wort, danach steht der Vorschlag mit "Übernehmen" daneben
    await type(`${FORM} [data-hc="f-case"]`, "?state=down");
    check(`[${tag}] eigener Zusatz bleibt, Vorschlag mit "Übernehmen"`, await wait(`return !!r.querySelector('${FORM} [data-hc="f-take"]')`) && await ev(`return r.querySelector('${FORM} [data-hc="f-case"]').value`) === "?state=down");
    await tap(`${FORM} [data-hc="f-take"]`);
    check(`[${tag}] "Übernehmen" setzt den Vorschlag`, await ev(`return r.querySelector('${FORM} [data-hc="f-case"]').value`) === "?state=fail&message=Device+offline");
    // zweiter und dritter Fall, Reihenfolge
    await ev(`const s = r.querySelector('${FORM} [data-hc="f-pick"]'); s.value = "backup"; s.dispatchEvent(new Event("change", { bubbles: true }))`);
    await tap(`${FORM} [data-hc="f-addcase"]`);
    await tap(`${FORM} [data-hc="f-addcase"]`);
    check(`[${tag}] drei Fälle, keine Auswahl mehr zum Hinzufügen`, (await ev(`return r.querySelectorAll('${FORM} .hc-case').length`)) === 3 && !(await ev(`return !!r.querySelector('${FORM} [data-hc="f-addcase"]')`)));
    check(`[${tag}] Reihenfolge: Gerät ausgefallen, Backup fehlgeschlagen, Batterie schwach`, (await ev(`return [...r.querySelectorAll('${FORM} .hc-case b')].map((x) => x.textContent).join("|")`)) === [L.case_off, L.case_bak, L.case_bat].join("|"));
    await tap(`${FORM} [data-hc="f-down"][data-i="1"]`);
    check(`[${tag}] "Nach unten" tauscht die Zeilen`, (await ev(`return [...r.querySelectorAll('${FORM} .hc-case b')].map((x) => x.textContent).join("|")`)) === [L.case_off, L.case_bat, L.case_bak].join("|"));
    await tap(`${FORM} [data-hc="f-del"][data-i="2"]`);
    check(`[${tag}] Zeile entfernen: zwei Fälle, die Auswahl bietet "${L.case_bak}" wieder an`, (await ev(`return r.querySelectorAll('${FORM} .hc-case').length`)) === 2 && (await ev(`return [...r.querySelectorAll('${FORM} [data-hc="f-pick"] option')].map((o) => o.textContent).join("|")`)) === L.case_bak);

    // --- Prüfung der Eingaben
    await type(`${FORM} [data-hc="f-name"]`, "");
    await type(`${FORM} [data-hc="f-case"][data-i="1"]`, "");
    await tap(`${FORM} button[type="submit"]`);
    check(`[${tag}] leerer Name und leerer Zusatz: Fehler, nichts gespeichert`, await wait(`return r.querySelector('${FORM} [data-hcp="err-name"]')?.textContent.includes(${JSON.stringify(L.nameErr)}) && r.querySelector('${FORM} [data-hcp="case1"]')?.textContent.includes(${JSON.stringify(L.sufErr)})`) && (await p.evaluate(() => window.__hc.length)) === 0);
    await type(`${FORM} [data-hc="f-name"]`, "Haus");
    await type(`${FORM} [data-hc="f-case"][data-i="1"]`, "falsch");
    check(`[${tag}] Zusatz ohne "/", "?" oder "&": Fehler`, await wait(`return !!r.querySelector('${FORM} [data-hcp="case1"] .hc-err')`));
    await type(`${FORM} [data-hc="f-case"][data-i="1"]`, "?state=fail&message=Battery+low");
    await type(`${FORM} [data-hc="f-value"]`, "0");
    check(`[${tag}] Abstand 0: Fehler`, await wait(`return !!r.querySelector('${FORM} [data-hcp="err-interval"] .hc-err')`));
    await tap(`${FORM} [data-hc="f-preset"][data-sec="900"]`);
    check(`[${tag}] Schnellwahl 15 Minuten setzt Zahl und Einheit`, (await ev(`return r.querySelector('${FORM} [data-hc="f-value"]').value`)) === "15" && (await ev(`return r.querySelector('${FORM} [data-hc="f-unit"]').value`)) === "min" && await ev(`return r.querySelector('${FORM} .hc-presets .sub-tab.on')?.dataset.sec`) === "900");
    check(`[${tag}] Schnellwahl ist eine Reiterleiste mit gleitender Kapsel`, await wait(`return !!r.querySelector('${FORM} .hc-presets .seg-pill')`));
    await p.screenshot({ path: `${outDir}/hc-form-${tag.replace("/", "-")}.png` });
    await tap(`${FORM} button[type="submit"]`);
    check(`[${tag}] Speichern: Formular zu, Dienst beim Server mit zwei Fällen und 900 s`, await wait(`return !r.querySelector('${FORM}')?.open`) && await p.evaluate(() => { const i = window.__hc[0]; return window.__hc.length === 1 && i.name === "Haus" && i.url.includes("cronitor.link") && i.interval === 900 && i.cases.length === 2 && i.cases[0].kind === "offline" && i.cases[1].kind === "battery"; }));
    check(`[${tag}] Kapitel zeigt "${L.one}"`, await wait(`return r.querySelector(".hc-sum")?.textContent.includes(${JSON.stringify(L.one)})`) && (await text(".hc-sum")).includes(L.okAll));

    // --- Liste
    await tap('[data-set="hc-open"]');
    check(`[${tag}] Liste "${L.title}" mit einer Zeile, Name, URL und zwei Fall-Marken`, await wait(`return r.querySelector('${LIST}')?.open && r.querySelectorAll('${LIST} .hc-row').length === 1`) && (await text(`${LIST} .hc-name`)) === "Haus" && (await text(`${LIST} .hc-addr`)).includes("cronitor.link") && (await ev(`return r.querySelectorAll('${LIST} .hc-case-chip').length`)) === 2);
    check(`[${tag}] Zeile: Cronitor als Marke, Zustand "kein Lebenszeichen" (neutral)`, (await text(`${LIST} .hc-tag`)) === "Cronitor" && await ev(`return r.querySelector('${LIST} .hc-state').classList.contains("none")`));
    check(`[${tag}] Knöpfe: Protokoll, zwei Fälle, OK, Bearbeiten, Entfernen (je rund)`, (await ev(`return r.querySelectorAll('${LIST} .hc-row .hc-ib').length`)) === 6);
    await tap(`${LIST} .hc-ib[data-hc="test"][data-kind="battery"]`);
    check(`[${tag}] Testknopf "${L.case_bat}": der Server bekommt genau diese Art`, await wait(`return r.querySelector('${LIST} .hc-state')?.classList.contains("warn")`) && (await p.evaluate(() => JSON.stringify(window.__hcPing))) === JSON.stringify([{ id: await p.evaluate(() => window.__hc[0].id), kind: "battery" }]));
    await tap(`${LIST} .hc-ib[data-hc="test"][data-kind="ok"]`);
    check(`[${tag}] Testknopf OK: Zustand wieder grün`, await wait(`return r.querySelector('${LIST} .hc-state')?.classList.contains("ok")`));
    await p.evaluate(() => { window.__hcFail = { [window.__hc[0].id]: true }; });
    await tap(`${LIST} .hc-ib[data-hc="test"][data-kind="offline"]`);
    check(`[${tag}] gescheiterter Test: Zustand rot mit HTTP 503`, await wait(`return r.querySelector('${LIST} .hc-state')?.classList.contains("err") && r.querySelector('${LIST} .hc-state').textContent.includes("503")`));
    check(`[${tag}] Kapitel dahinter nachgeführt: "1 Lebenszeichen gescheitert"`, (await text(".hc-sum")).includes(lang === "de" ? "1 Lebenszeichen gescheitert" : "1 heartbeat failed"));
    await p.evaluate(() => { window.__hcFail = {}; });
    // Suche und Sortierung
    await p.evaluate(() => window.__hc.push({ id: "second", name: "Zweiter", url: "https://hc-ping.com/00000000-1111-2222-3333-444444444444", interval: 300, cases: [], status: null, log: null }));
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
    check(`[${tag}] Bearbeiten: Formular mit den Werten (Name, zwei Fälle, 15 Minuten)`, await wait(`return r.querySelector('${FORM}')?.open && r.querySelector('${FORM} [data-hc="f-name"]').value === "Haus"`) && (await ev(`return r.querySelectorAll('${FORM} .hc-case').length`)) === 2 && (await ev(`return r.querySelector('${FORM} [data-hc="f-value"]').value`)) === "15");
    await tap(`${FORM} [data-hc="f-cancel"]`);
    check(`[${tag}] Abbrechen schliesst das Formular ohne zu speichern`, await wait(`return !r.querySelector('${FORM}')?.open`));

    // --- Höchstens fünf
    await p.evaluate(() => { for (let n = window.__hc.length; n < 5; n++) window.__hc.push({ id: `x${n}`, name: `Dienst ${n}`, url: "https://hc-ping.com/00000000-1111-2222-3333-44444444444" + n, interval: 300, cases: [], status: null, log: null }); });
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
