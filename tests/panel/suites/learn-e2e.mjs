// Lernseite "Mehr erfahren" (2.223.0, ab 2.224.0 mit sechs Themen, docs/mockups/learn-v4, Variante A2): Einstieg in Einstellungen › Panel (Kapitel unter dem Einrichtungsassistenten),
// Einstieg nach dem Assistenten mit dem Kopf "Einrichtung abgeschlossen" (ohne Zusatz "freiwillig"), sechs Kacheln mit Skizze, Artikel mit Reitern (gleitende
// Kapsel), Weiter und Zurück, "Fertig" am Ende, Schliessen mit Kreuz, Esc und Tipp daneben, Handy als Vollbild, kein Überlauf, keine unaufgelösten Texte.
// Deutsch und Englisch, Desktop und Handy, echte Klicks und Tipps.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: {
    ttl: "Mehr erfahren", btn: "Themen ansehen", wiz: "Einrichtungsassistent", done: "Einrichtung abgeschlossen", doneText: "Alles ist gespeichert. Du kannst jetzt loslegen.",
    pauseWord: "Pausieren bis online", pausedPill: "Pausiert bis", pausedChip: "Pausiert", more: "Möchtest du mehr erfahren?", later: "Du findest das später unter Einstellungen › Panel › Mehr erfahren.", finish: "Fertig", close: "Schliessen", overview: "Übersicht",
    names: ["Ausgefallene Geräte", "Batterie-Warnungen", "Magic Push", "Routinen", "Dashboard-Karten", "App-Launcher"], tabs: ["Ausfälle", "Batterie", "Magic Push", "Routinen", "Karten", "Launcher"],
    titles: ["Wenn ein Gerät fehlt", "Bevor die Batterie leer ist", "Meldungen nach Mass", "Schalten nach Plan", "Dein Dashboard, live", "Alles in einem Knopf"], of: (i) => `Thema ${i} von 6 · 2 Min.`, read: "2 Min. · Lesen",
  },
  en: {
    ttl: "Learn more", btn: "View topics", wiz: "Setup wizard", done: "Setup complete", doneText: "Everything is saved. You can get started now.",
    pauseWord: "Pause until online", pausedPill: "Paused until", pausedChip: "Paused", more: "Would you like to learn more?", later: "You can find this later under Settings › Panel › Learn more.", finish: "Done", close: "Close", overview: "Overview",
    names: ["Offline devices", "Battery warnings", "Magic Push", "Routines", "Dashboard cards", "App launcher"], tabs: ["Outages", "Battery", "Magic Push", "Routines", "Cards", "Launcher"],
    titles: ["When a device goes missing", "Before the battery runs out", "Notifications made to measure", "Switching on a schedule", "Your dashboard, live", "Everything in one button"], of: (i) => `Topic ${i} of 6 · 2 min`, read: "2 min · Read",
  },
};
// Skizze im Artikel je Thema (grosse Fassung): Klasse des zweiten Teils
const SK = ["lrn-push", "lrn-push", "lrn-push", "lrn-push", "lrn-dc2", "lrn-kopf"];

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
    const tap = async (sel) => {
      for (let n = 1; ; n++) {
        const h = await handle(sel);
        if (!h) throw new Error("fehlt: " + sel);
        try { await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); return; } catch (err) { if (n >= 3 || !/not attached|not stable/.test(String(err))) throw err; await p.waitForTimeout(200); }
      }
    };
    const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
    const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.innerText || "").replace(/\\s+/g," ").trim()`);
    const D = "dialog.learn-dlg";
    const isOpen = () => ev(`return !!r.querySelector("${D}")?.open`);
    const view = () => ev(`return r.host._learn.s?.view || ""`);
    const shot = async (name) => { await p.waitForTimeout(900); return p.screenshot({ path: `${outDir}/learn-${name}-${lang}-${mobile ? "mobile" : "desktop"}.png` }); };
    const topicTap = async (i) => { await tap(`${D} .lrn-card[data-i="${i}"]`); await wait(`return r.host._learn.s?.view === "article" && r.host._learn.s.i === ${i}`); };

    // --- Einstieg 1: Einstellungen › Panel › Allgemein, Kapitel unter dem Einrichtungsassistenten
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="updates"]');
    await tap('[data-set="subtab"][data-group="panel"][data-key="pstart"]');
    await wait(`return !!r.querySelector('[data-set="learn-open"]')`);
    const titles = await ev(`return [...r.querySelectorAll("dialog.settings .set-sec-body .set-title")].map(x => x.textContent.trim())`);
    const iw = titles.indexOf(L.wiz);
    check(`[${tag}] Kapitel "${L.ttl}" ganz unten, direkt unter "${L.wiz}"`, iw >= 0 && titles[iw + 1] === L.ttl && titles[titles.length - 1] === L.ttl, JSON.stringify(titles));
    check(`[${tag}] Knopf "${L.btn}"`, (await text('[data-set="learn-open"]')) === L.btn);
    check(`[${tag}] Lernseite zu, bevor man sie öffnet`, !(await isOpen()));
    // Eine ungespeicherte Änderung sperrt den Knopf nicht (die Seite ändert nichts)
    await ev(`r.host._settings.draft.battery_low = 21; r.host._renderSettings()`);
    check(`[${tag}] mit ungespeicherter Änderung nicht gesperrt`, await ev(`return !r.querySelector('[data-set="learn-open"]').disabled`));
    await ev(`r.host._settings.draft.battery_low = r.host._settings.data.values.battery_low; r.host._renderSettings()`);
    await wait(`return !!r.querySelector('[data-set="learn-open"]')`);
    await tap('[data-set="learn-open"]');
    check(`[${tag}] öffnet über den Einstellungen, Übersicht`, (await wait(`return r.querySelector("${D}")?.open`)) && (await view()) === "overview" && (await ev(`return r.querySelector("dialog.settings").open`)));
    check(`[${tag}] Titel "${L.ttl}", kein Kopf "${L.done}"`, (await text(`${D} .dlg-title h2`)) === L.ttl && !(await ev(`return !!r.querySelector("${D} .lrn-done")`)));
    check(`[${tag}] sechs Kacheln mit Name, Skizze und "${L.read}"`, await ev(`const c=[...r.querySelectorAll("${D} .lrn-card")]; return c.length===6 && c.every((x,i)=>x.querySelector(".lrn-tx b").textContent===${JSON.stringify(L.names)}[i] && x.querySelector(".lrn-sketch").children.length>0 && x.querySelector(".lrn-meta").textContent.replace(/\\s+/g," ").trim()===${JSON.stringify(L.read)} && x.querySelector(".cbtn svg"))`));
    const box = await ev(`const d = r.querySelector("${D}").getBoundingClientRect(); return [Math.round(d.left), Math.round(d.top), Math.round(d.width), Math.round(d.height), innerWidth, innerHeight]`);
    if (mobile) check(`[${tag}] Handy: Vollbild`, box[0] === 0 && box[1] === 0 && box[2] === box[4] && box[3] === box[5], JSON.stringify(box));
    else check(`[${tag}] Desktop: Popup in der Mitte, höchstens 900 px breit`, box[2] <= 900 && box[2] > 640 && Math.abs(box[0] + box[2] / 2 - box[4] / 2) < 4, JSON.stringify(box));
    const cols = await ev(`return new Set([...r.querySelectorAll("${D} .lrn-card")].map(c => Math.round(c.getBoundingClientRect().left))).size`);
    check(`[${tag}] ${mobile ? "Handy: eine Spalte" : "Desktop: zwei Spalten"}`, cols === (mobile ? 1 : 2), String(cols));
    check(`[${tag}] Fussleiste: "${L.close}"`, (await text(`${D} .dlg-actions`)) === L.close);
    await shot("1-overview");

    // --- Artikel: Kopf, Reiter mit Kapsel, Text mit Schritten, Skizze, Navigation
    await topicTap(0);
    check(`[${tag}] Reihenfolge: Ausfälle und Batterie stehen vor Magic Push, Routinen, Karten und Launcher`, await ev(`return [...r.querySelectorAll("${D} .lrn-tabs .sub-tab")].map(x => x.dataset.i).join()==="0,1,2,3,4,5" && r.host._learn.s.i===0`));
    check(`[${tag}] Artikel 1: Name "${L.names[0]}", "${L.of(1)}", Titel "${L.titles[0]}"`, (await text(`${D} .dlg-title h2`)) === L.names[0] && (await text(`${D} .dlg-sub`)) === L.of(1) && (await text(`${D} .lrn-txt h2`)) === L.titles[0]);
    check(`[${tag}] Reiter: sechs, der erste gewählt, mit gleitender Kapsel`, await ev(`const t=[...r.querySelectorAll("${D} .lrn-tabs .sub-tab")]; return t.length===6 && t.map(x=>x.innerText.trim()).join("|")===${JSON.stringify(L.tabs)}.join("|") && t[0].classList.contains("on") && t.filter(x=>x.classList.contains("on")).length===1 && !!r.querySelector("${D} .lrn-tabs .seg-pill") && t.every(x => { const s = x.querySelector("span"); return s.scrollWidth <= s.clientWidth + 1; })`));
    check(`[${tag}] Reiter nur Symbole und Schrift der Reiterleiste (.sub-tab), keine eigene Leiste`, await ev(`return r.querySelector("${D} .lrn-tabs").classList.contains("sub-tabs") && [...r.querySelectorAll("${D} .lrn-tabs .sub-tab svg")].length===6`));
    check(`[${tag}] Schritte als Zeitleiste (mindestens drei) und Hinweis "Gut zu wissen"`, await ev(`return r.querySelectorAll("${D} .lt-st").length >= 3 && !!r.querySelector("${D} .lrn-tip b")`));
    check(`[${tag}] Skizze im Artikel: ausgefallenes und pausiertes Gerät, dazu die Meldung`, await ev(`return !!r.querySelector("${D} .lrn-hero .lrn-dev .ld-dot.off") && !!r.querySelector("${D} .lrn-hero .lrn-dev .ld-pill") && r.querySelectorAll("${D} .lrn-hero .lrn-push .lp-ac u").length === 3`));
    check(`[${tag}] Ausfälle erklären die Pause (Pille, Chip, Filter) und die Push-Aktion "${L.pauseWord}"`, await ev(`const t = r.querySelector("${D} .lrn-txt").innerText; return t.includes(${JSON.stringify(L.pauseWord)}) && t.includes(${JSON.stringify(L.pausedPill)}) && t.includes(${JSON.stringify(L.pausedChip)})`));
    const aside = await ev(`const a=r.querySelector("${D} .lrn-art aside").getBoundingClientRect(), t=r.querySelector("${D} .lrn-txt").getBoundingClientRect(); return [Math.round(a.left), Math.round(a.top), Math.round(t.left), Math.round(t.top)]`);
    check(`[${tag}] ${mobile ? "Handy: Skizze über dem Text" : "Desktop: Skizze rechts neben dem Text"}`, mobile ? aside[1] < aside[3] || aside[1] === aside[3] - 0 : aside[0] > aside[2], JSON.stringify(aside));
    check(`[${tag}] Fussleiste: "${L.overview}" und "${L.names[1]}"`, await ev(`const b=[...r.querySelectorAll("${D} .dlg-actions .dlg-btn")]; return b.length===2 && b[0].innerText.trim()===${JSON.stringify(L.overview)} && b[1].innerText.trim()===${JSON.stringify(L.names[1])} && b[1].classList.contains("primary")`));
    await shot("2-article");

    // Reiter wechseln das Thema, Weiter geht zum nächsten, Zurück zum vorigen
    await tap(`${D} .lrn-tabs .sub-tab[data-i="4"]`);
    await wait(`return r.host._learn.s.i === 4`);
    check(`[${tag}] Reiter "${L.tabs[4]}": Artikel 5, Skizze mit zweiter Karte, Reiter gewählt`, (await text(`${D} .lrn-txt h2`)) === L.titles[4] && (await ev(`return !!r.querySelector("${D} .lrn-hero .lrn-dc2")`)) && (await ev(`return r.querySelector('${D} .lrn-tabs .sub-tab[data-i="4"]').classList.contains("on")`)));
    await tap(`${D} .dlg-actions .dlg-btn.primary`);
    await wait(`return r.host._learn.s.i === 5`);
    check(`[${tag}] Weiter: Artikel 6 "${L.names[5]}", Fussleiste "${L.finish}"`, (await text(`${D} .dlg-title h2`)) === L.names[5] && (await text(`${D} .dlg-actions .dlg-btn.primary`)) === L.finish);
    await tap(`${D} .dlg-actions .dlg-btn:not(.primary)`);
    await wait(`return r.host._learn.s.i === 4`);
    check(`[${tag}] Zurück: Artikel 5`, (await text(`${D} .dlg-title h2`)) === L.names[4]);
    await tap(`${D} .lrn-back`);
    check(`[${tag}] Pfeil oben links: zurück zur Übersicht`, await wait(`return r.host._learn.s?.view === "overview" && !!r.querySelector("${D} .lrn-card")`));

    // Alle sechs Artikel: Skizzen, kein Überlauf, keine unaufgelösten Texte
    for (let i = 0; i < 6; i++) {
      await topicTap(i);
      const m = await ev(`const b=r.querySelector("${D} .lrn-body"), t=r.querySelector("${D} .lrn-tabs"), d=r.querySelector("${D}"); const txt=b.innerText; return {x: b.scrollWidth - b.clientWidth, tabs: t.scrollWidth - t.clientWidth, dlg: d.scrollWidth - d.clientWidth, bad: /undefined|\\[object|NaN|\\*\\*/.test(txt), sk: !!b.querySelector(".lrn-hero .lrn-sketch ." + ${JSON.stringify(SK[i])}), len: txt.length}`);
      check(`[${tag}] Artikel ${i + 1}: kein Überlauf, Skizze, keine unaufgelösten Texte, Länge`, m.x <= 1 && m.tabs <= 1 && m.dlg <= 1 && !m.bad && m.sk && m.len > 600, JSON.stringify(m));
      await tap(`${D} .lrn-back`);
      await wait(`return r.host._learn.s?.view === "overview"`);
    }

    // Batterie: Schwelle mit Strich, Prognose und Warnung ohne Schaltflächen (die Batterie-Meldung trägt keine)
    await topicTap(1);
    check(`[${tag}] Batterie: Stand mit Schwelle (Strich), Prognose, Warnung ohne Schaltflächen`, await ev(`return !!r.querySelector("${D} .lrn-hero .lrn-bat .lb-bar u") && /%/.test(r.querySelector("${D} .lrn-hero .lrn-bat .lb-s").innerText) && !!r.querySelector("${D} .lrn-hero .lrn-push") && !r.querySelector("${D} .lrn-hero .lrn-push .lp-ac")`));
    check(`[${tag}] Batterie erklärt Schwelle, einmal pro Gerät, Prognose`, await ev(`const t = r.querySelector("${D} .lrn-txt").innerText; return t.includes("15 %") && t.includes("50 %") && t.includes("5 ")`));
    await shot("5-article-bat");
    await tap(`${D} .lrn-back`);
    await wait(`return r.host._learn.s?.view === "overview"`);

    // Reiterleiste: sechs Reiter, am Handy 3 x 2, am Desktop eine Zeile; kein Reiter beschnitten
    await topicTap(0);
    const rows = await ev(`const t=[...r.querySelectorAll("${D} .lrn-tabs .sub-tab")]; return {rows: new Set(t.map(x => Math.round(x.getBoundingClientRect().top))).size, cols: new Set(t.map(x => Math.round(x.getBoundingClientRect().left))).size, cut: t.some(x => { const s = x.querySelector("span"); return s.scrollWidth > s.clientWidth + 1; })}`);
    check(`[${tag}] ${mobile ? "Handy: Reiter in 2 Zeilen zu 3 Spalten" : "Desktop: Reiter in einer Zeile"}, keiner beschnitten`, mobile ? rows.rows === 2 && rows.cols === 3 && !rows.cut : rows.rows === 1 && rows.cols === 6 && !rows.cut, JSON.stringify(rows));
    await shot("4-article-out");
    await tap(`${D} .lrn-back`);
    await wait(`return r.host._learn.s?.view === "overview"`);

    // "Fertig" am Ende schliesst nur die Lernseite; die Einstellungen bleiben
    await topicTap(5);
    await tap(`${D} .dlg-actions .dlg-btn.primary`);
    check(`[${tag}] "${L.finish}" im letzten Artikel: Lernseite zu, Einstellungen noch offen`, (await wait(`return !r.querySelector("${D}").open`)) && (await ev(`return r.querySelector("dialog.settings").open`)));

    // Wieder öffnen beginnt in der Übersicht; Schliessen mit dem Kreuz
    await tap('[data-set="learn-open"]');
    await wait(`return r.querySelector("${D}")?.open`);
    check(`[${tag}] neu geöffnet: wieder die Übersicht`, (await view()) === "overview");
    await tap(`${D} .dlg-head .dlg-close`);
    check(`[${tag}] Kreuz schliesst`, await wait(`return !r.querySelector("${D}").open`));
    // Esc
    await tap('[data-set="learn-open"]');
    await wait(`return r.querySelector("${D}")?.open`);
    await topicTap(1);
    await p.keyboard.press("Escape");
    check(`[${tag}] Esc schliesst`, await wait(`return !r.querySelector("${D}").open`));
    await tap('[data-set="learn-open"]');
    await wait(`return r.querySelector("${D}")?.open`);
    check(`[${tag}] nach Esc wieder die Übersicht`, (await view()) === "overview");
    // Tipp auf den Hintergrund (nur Desktop: am Handy gibt es keinen)
    if (!mobile) {
      const fb = await (await p.$("#panel-frame")).boundingBox();
      await p.mouse.click(fb.x + 8, fb.y + 8);
      check(`[${tag}] Tipp neben das Fenster schliesst`, await wait(`return !r.querySelector("${D}").open`));
    } else {
      await tap(`${D} .dlg-head .dlg-close`);
      await wait(`return !r.querySelector("${D}").open`);
    }
    // Tastatur: Kachel mit Eingabe öffnen
    await tap('[data-set="learn-open"]');
    await wait(`return r.querySelector("${D}")?.open`);
    await ev(`r.querySelector("${D} .lrn-card[data-i='1']").focus()`);
    await p.keyboard.press("Enter");
    check(`[${tag}] Kachel per Tastatur (Eingabe) öffnet Artikel 2`, await wait(`return r.host._learn.s?.view === "article" && r.host._learn.s.i === 1`));
    await tap(`${D} .dlg-head .dlg-close`);
    await wait(`return !r.querySelector("${D}").open`);

    // --- Einstieg 2: nach dem Assistenten, mit dem Kopf "Einrichtung abgeschlossen"
    await ev(`r.host._learn.open("wizard")`);
    await wait(`return r.querySelector("${D}")?.open`);
    check(`[${tag}] Assistent: Kopf "${L.done}" mit rundem Haken, Satz, Trennzeile "${L.more}"`, (await text(`${D} .lrn-done h2`)) === L.done && (await text(`${D} .lrn-done p`)) === L.doneText && (await ev(`return !!r.querySelector("${D} .lrn-ck path")`)) && (await text(`${D} .lrn-sect`)) === L.more);
    check(`[${tag}] ohne Zusatz "freiwillig" / "optional"`, !/freiwillig|optional|voluntary/i.test(await text(D)));
    check(`[${tag}] Hinweis "${L.later}"`, (await text(`${D} .lrn-hint`)) === L.later);
    check(`[${tag}] Assistent: nur das Kreuz im Kopf (kein Titel), Fussleiste "${L.finish}"`, (await ev(`return !r.querySelector("${D} .dlg-head h2") && !!r.querySelector("${D} .dlg-head .dlg-close")`)) && (await text(`${D} .dlg-actions`)) === L.finish);
    const gap = await ev(`const c=r.querySelector("${D} .lrn-ck").getBoundingClientRect(), s=r.querySelector("${D} .lrn-sect").getBoundingClientRect(), k=r.querySelector("${D} .lrn-card").getBoundingClientRect(); return [Math.round(c.top - r.querySelector("${D}").getBoundingClientRect().top), Math.round(k.top - s.bottom)]`);
    check(`[${tag}] Leerraum über dem Zeichen und zwischen Trennzeile und Kacheln`, gap[0] >= 50 && gap[1] >= 8, JSON.stringify(gap));
    await shot("3-done");
    await topicTap(0);
    await tap(`${D} .lrn-back`);
    check(`[${tag}] Assistent: Zurück zur Übersicht zeigt den Kopf wieder`, await wait(`return !!r.querySelector("${D} .lrn-done")`));
    await tap(`${D} .dlg-actions .dlg-btn.primary`);
    check(`[${tag}] "${L.finish}" schliesst`, await wait(`return !r.querySelector("${D}").open`));
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
