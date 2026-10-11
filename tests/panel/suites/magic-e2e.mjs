// Magic Push (2.6.0): vierter Reiter im Geräte-Popup. Liste (Zähler im Reiter), Assistent in fünf Schritten
// (Wert · Wann · Text · Versand · Name) für Zahl und Zustand, freie Zeit, Rückblick (auch leer und ohne
// Recorder), Variablen einfügen, Vorschau, Empfänger-Auswahl, Wiederholung, eigener Text für "wieder normal",
// Kritische Mitteilung mit Lautstärke, Test senden, Speichern, Umbenennen, Ein-/Ausschalten, Löschen mit Bestätigung, Bearbeiten, Fehler beim
// Speichern, Assistent übersteht den Neuaufbau des Popups. Deutsch und Englisch, Desktop und Handy,
// echte Eingaben und Taps.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { tab: "Magic Push", add: "Neue Meldung", q1: "Was soll überwacht werden?", q2: "Wann soll gemeldet werden?", q5: "Wie soll die Meldung heissen?", once: "wäre 1-mal gekommen", none: "Kein Verlauf vorhanden", norec: "der Recorder ist nicht aktiv", saved: "Gespeichert.", testSent: "Test gesendet an", unreachable: "nicht erreichbar", delAsk: 'löschen?', rename: "Umbenennen", del: "Löschen", active1: "1 aktiv", pvNote: "Vorschau mit dem aktuellen Wert", saveErr: "Speichern nicht möglich:", hint: "Höchstens", never: "noch nie ausgelöst" },
  en: { tab: "Magic Push", add: "New message", q1: "What should be watched?", q2: "When should it notify?", q5: "What should the message be called?", once: "would have fired once", none: "No history available", norec: "the recorder is not active", saved: "Saved.", testSent: "Test sent to", unreachable: "unreachable", delAsk: "Delete", rename: "Rename", del: "Delete", active1: "1 active", pvNote: "Preview with the current value", saveErr: "Could not save:", hint: "At most", never: "never triggered" },
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
        try {
          const h = await handle(sel);
          if (!h) throw new Error("fehlt: " + sel);
          await h.scrollIntoViewIfNeeded();
          if (mobile) await h.tap(); else await h.click();
          return;
        } catch (err) {
          if (i >= 3 || !/not attached|detached/.test(String(err))) throw err;
          await new Promise((r) => setTimeout(r, 150));
        }
      }
    };
    const fill = async (sel, value) => { const h = await handle(sel); await h.scrollIntoViewIfNeeded(); await h.fill(value); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const calls = (type) => p.evaluate((t) => window.__wsCalls.filter((m) => m.type === `device_panel/${t}`), type);
    const root = ".mg-root";
    const step = (n) => wait(`return r.querySelectorAll('${root} .mg-stp.on').length === ${n}`);
    const next = async () => { await tap('[data-mg="next"]'); };
    const overflow = () => ev(`const d=r.querySelector("dialog.device"); return d.scrollWidth - d.clientWidth`);
    const headingOk = (q) => wait(`return r.querySelector('${root} .mg-big')?.textContent.trim() === ${JSON.stringify(q)}`);

    await p.evaluate(() => { window.__opts.notify_service = "notify.mobile_app_dani_iphone"; });
    await tap('.dev[data-open="d"]');
    await wait(`return r.querySelector("dialog.device")?.open && r.querySelector(".sub-tabs")`);
    check(`[${tag}] vier Reiter, vierter "Magic Push"`, (await ev(`return [...r.querySelectorAll("dialog.device .dev-tabs .sub-tab")].map(b => b.dataset.tab).join()`)) === "ov,set,ent,magic");
    check(`[${tag}] ohne Meldung keine Zahl im Reiter`, (await ev(`return r.querySelector('.sub-tab[data-tab="magic"]').classList.contains("two")`)) === false);

    // --- Liste leer ---
    await tap('.sub-tab[data-tab="magic"]');
    check(`[${tag}] Liste leer: Hinweis und "${T.add}"`, await wait(`return !!r.querySelector('${root} .mg-empty') && r.querySelector('${root} [data-mg="add"]')?.textContent.includes(${JSON.stringify(T.add)})`));

    // --- Assistent, Zahl ---
    await tap('[data-mg="add"]');
    await headingOk(T.q1);
    check(`[${tag}] Schritt 1: fünf Entitäten, "Weiter" gesperrt`, (await ev(`return r.querySelectorAll('${root} .mg-pick').length`)) === 5 && (await ev(`return r.querySelector('${root} [data-mg="next"]').disabled`)) === true);
    check(`[${tag}] nicht erreichbare Entität benannt`, (await text(`${root} .mg-pick[data-id="sensor.rssi"]`)).includes(T.unreachable));
    check(`[${tag}] Schrittleiste: nur der erste Balken an`, (await ev(`return r.querySelectorAll('${root} .mg-stp.on').length`)) === 1 && (await ev(`return r.querySelectorAll('${root} button.mg-stp').length`)) === 0);
    await tap('.mg-pick[data-id="sensor.temp"]');
    check(`[${tag}] Temperatur gewählt, "Weiter" frei`, await wait(`return r.querySelector('${root} .mg-pick.sel')?.dataset.id === "sensor.temp" && r.querySelector('${root} [data-mg="next"]').disabled === false`));
    await next();
    await headingOk(T.q2);
    await step(2);
    check(`[${tag}] Schritt 2: vier Bedingungen, "unter" gewählt, Wert aus der Entität`, (await ev(`return r.querySelectorAll('${root} .sub-tabs [data-mg="kind"]').length`)) === 4 && (await ev(`return r.querySelector('${root} .sub-tabs [data-mg="kind"].on').dataset.kind`)) === "below" && (await ev(`return r.querySelector('${root} input[data-mg="value"]').value`)) === "14.2");
    // Auswahlknöpfe sind Reiterleisten wie die Reiter oben: .sub-tabs mit gleitender Kapsel, gleiche Schrift und Fläche
    const pillAt = (bar) => ev(`const b=r.querySelector(${JSON.stringify(bar)}); const p=b?.querySelector(":scope > .seg-pill"); const on=b?.querySelector(".sub-tab.on"); if(!p||!on) return null; const m=new DOMMatrix(getComputedStyle(p).transform); return [Math.round(m.m41-on.offsetLeft), Math.round(m.m42-on.offsetTop), Math.round(p.offsetWidth-on.offsetWidth)]`);
    const same = (await ev(`const a=getComputedStyle(r.querySelector('dialog.device .dev-tabs .sub-tab')), b=getComputedStyle(r.querySelector('${root} [data-mg="kind"]')), bar=getComputedStyle(r.querySelector('dialog.device .dev-tabs .sub-tabs')), bar2=getComputedStyle(r.querySelector('${root} .sub-tabs.mg-tabs')); return [a.borderRadius===b.borderRadius, a.fontFamily===b.fontFamily, bar.backgroundColor===bar2.backgroundColor, bar.borderRadius===bar2.borderRadius]`));
    check(`[${tag}] Auswahlknöpfe wie die Reiter: gleiche Form, Schrift und Fläche`, same.every(Boolean), JSON.stringify(same));
    await p.waitForTimeout(700);
    check(`[${tag}] Bedingung: Kapsel liegt unter dem gewählten Knopf`, JSON.stringify(await pillAt(`${root} .sub-tabs:has([data-mg="kind"])`)) === "[0,0,0]", JSON.stringify(await pillAt(`${root} .sub-tabs:has([data-mg="kind"])`)));
    await tap('[data-mg="kind"][data-kind="above"]');
    await p.waitForTimeout(80);
    const moving = await pillAt(`${root} .sub-tabs:has([data-mg="kind"])`);
    check(`[${tag}] Kapsel gleitet (noch unterwegs kurz nach dem Wechsel)`, moving && (moving[0] !== 0 || moving[2] !== 0 || (await ev(`return r.querySelector('${root} .sub-tabs:has([data-mg="kind"]) .seg-pill').classList.contains("go")`))), JSON.stringify(moving));
    await p.waitForTimeout(700);
    check(`[${tag}] Kapsel kommt am neuen Knopf an`, JSON.stringify(await pillAt(`${root} .sub-tabs:has([data-mg="kind"])`)) === "[0,0,0]");
    await tap('[data-mg="kind"][data-kind="below"]');
    await p.waitForTimeout(700);
    // Wert tippen, Rückblick und Diagramm erscheinen
    await fill('input[data-mg="value"]', "12");
    check(`[${tag}] Rückblick: "${T.once}"`, await wait(`return r.querySelector('${root} .mg-hist')?.textContent.includes(${JSON.stringify(T.once)})`), await text(`${root} .mg-hist`));
    check(`[${tag}] Diagramm mit Schwelle`, await wait(`return !!r.querySelector('${root} svg.mg-spark line')`));
    // Minus/Plus
    await tap('[data-mg="step"][data-dir="1"]');
    check(`[${tag}] Plus erhöht um 1`, (await ev(`return r.querySelector('${root} input[data-mg="value"]').value`)) === "13");
    await tap('[data-mg="step"][data-dir="-1"]');
    // Dauer: Vorschlag, dann freie Zeit
    await tap('[data-mg="for"][data-s="600"]');
    check(`[${tag}] Dauer 10 Min. gewählt`, await wait(`return r.querySelector('${root} [data-mg="for"].on')?.dataset.s === "600"`));
    await fill('input[data-mg="for-own"]', "45");
    await ev(`const s=r.querySelector('${root} select[data-mg="for-unit"]'); s.value="60"; s.dispatchEvent(new Event("change",{bubbles:true}));`);
    check(`[${tag}] freie Zeit: keine Kapsel bleibt auf einem Vorschlag stehen`, await wait(`return !r.querySelector('${root} .sub-tabs:has([data-mg="for"]) .seg-pill')`));
    check(`[${tag}] freie Zeit 45 Min. ersetzt den Vorschlag`, await wait(`return !r.querySelector('${root} [data-mg="for"].on') && r.querySelector('${root} input[data-mg="for-own"]').value === "45"`));
    // zu lang: 8 Tage
    await ev(`const s=r.querySelector('${root} select[data-mg="for-unit"]'); s.value="86400"; s.dispatchEvent(new Event("change",{bubbles:true}));`);
    await fill('input[data-mg="for-own"]', "8");
    check(`[${tag}] zu lange Zeit: Hinweis und "Weiter" gesperrt`, await wait(`return r.querySelector('${root} [data-mg-zone="forhint"]')?.textContent.includes(${JSON.stringify(T.hint)}) && r.querySelector('${root} [data-mg="next"]').disabled === true`));
    await fill('input[data-mg="for-own"]', "45");
    await ev(`const s=r.querySelector('${root} select[data-mg="for-unit"]'); s.value="60"; s.dispatchEvent(new Event("change",{bubbles:true}));`);
    check(`[${tag}] wieder gültig: "Weiter" frei`, await wait(`return r.querySelector('${root} [data-mg="next"]').disabled === false`));
    check(`[${tag}] Schritt 2 ohne Querscrollen`, (await overflow()) <= 0, String(await overflow()));
    await p.screenshot({ path: `${outDir}/magic-${tag.replace("/", "-")}-2.png` });
    await next();

    // --- Schritt 3: Text ---
    await step(3);
    check(`[${tag}] Schritt 3: Standardtext zur Art, Variablen der Zahl`, (await ev(`return r.querySelector('${root} [data-mg-text="message"]').value`)).includes("{entity}") && (await ev(`return [...r.querySelectorAll('${root} .mg-chips button.sug')].map(b => b.dataset.var).join()`)) === "value,unit,threshold");
    await fill('[data-mg-text="message"]', "Keller kalt: ");
    await tap('[data-mg="var"][data-var="value"]');
    await tap('[data-mg="var"][data-var="unit"]');
    check(`[${tag}] Variablen werden an den Cursor eingefügt`, (await ev(`return r.querySelector('${root} [data-mg-text="message"]').value`)) === "Keller kalt: {value}{unit}");
    await fill('[data-mg-text="message"]', "Keller kalt: {value} {unit} (unter {threshold})");
    // Inhalt getrennt vom Titel (2.7.0)
    check(`[${tag}] Titel ist ein Einzeilenfeld, Inhalt ein Textfeld mit Vorgabe`, (await ev(`return r.querySelector('${root} [data-mg-text="message"]').tagName === "INPUT" && r.querySelector('${root} [data-mg-text="body"]').tagName === "TEXTAREA"`)) && (await ev(`return r.querySelector('${root} [data-mg-text="body"]').value`)).includes("{device}"));
    await fill('[data-mg-text="body"]', "Aktuell {value} {unit}\nSchwelle {threshold} {unit}");
    const wantBody = `Aktuell ${lang === "de" ? "14,2" : "14.2"} °C\nSchwelle 12 °C`;
    check(`[${tag}] Vorschau: Titel und Inhalt getrennt, Inhalt mit eingesetzten Werten und Zeilenumbruch`, await wait(`const t=r.querySelector('${root} .mg-pv .pv-title')?.textContent, b=r.querySelector('${root} .mg-pv .pv-text')?.textContent; return !!t && t.startsWith("Keller kalt: ") && b === ${JSON.stringify(wantBody)}`), await text(`${root} .mg-pv .pv-text`));
    // Variable geht in das zuletzt gewählte Feld
    await ev(`r.querySelector('${root} [data-mg-text="body"]').focus()`);
    await tap('[data-mg="var"][data-group="main"][data-var="since"]');
    check(`[${tag}] Variable landet im Inhalt, wenn dieser zuletzt gewählt war`, (await ev(`return r.querySelector('${root} [data-mg-text="body"]').value`)).endsWith("{since}") && !(await ev(`return r.querySelector('${root} [data-mg-text="message"]').value`)).includes("{since}"));
    await ev(`r.querySelector('${root} [data-mg-text="message"]').focus()`);
    await tap('[data-mg="var"][data-group="main"][data-var="area"]');
    check(`[${tag}] danach im Titel, wenn dieser zuletzt gewählt war`, (await ev(`return r.querySelector('${root} [data-mg-text="message"]').value`)).endsWith("{area}") && !(await ev(`return r.querySelector('${root} [data-mg-text="body"]').value`)).includes("{area}"));
    await fill('[data-mg-text="message"]', "Keller kalt: {value} {unit} (unter {threshold})");
    await fill('[data-mg-text="body"]', "");
    check(`[${tag}] leerer Inhalt: automatische Zeile in der Vorschau`, await wait(`return r.querySelector('${root} .mg-pv .pv-text')?.textContent === "Klimasensor Keller · seit 10 Min."`), await text(`${root} .mg-pv .pv-text`));
    await fill('[data-mg-text="body"]', "Aktuell {value} {unit}\nSchwelle {threshold} {unit}");
    check(`[${tag}] Vorschau mit eingesetzten Werten`, await wait(`return r.querySelector('${root} .mg-pv .pv-title')?.textContent.startsWith("Keller kalt: ") && !r.querySelector('${root} .mg-pv .pv-title').textContent.includes("{")`), await text(`${root} .mg-pv .pv-title`));
    check(`[${tag}] Vorschau-Hinweis`, (await text(`${root} .mg-pv .opt-short`)).includes(T.pvNote));
    // Der Neuaufbau des Popups (Abfrage alle 10 s) lässt den Assistenten in Ruhe
    await fill('[data-mg-text="message"]', "Keller kalt: {value} {unit} (unter {threshold}) ✔");
    await ev(`r.host._renderDevice(true)`);
    await ev(`r.host._devForce = true; r.host._renderDevice()`);
    check(`[${tag}] Text übersteht den Neuaufbau des Popups`, (await ev(`return r.querySelector('${root} [data-mg-text="message"]')?.value`)) === "Keller kalt: {value} {unit} (unter {threshold}) ✔");
    await next();

    // --- Schritt 4: Versand ---
    await step(4);
    check(`[${tag}] Schritt 4: Empfänger = Standard`, (await text(`${root} .mg-sel`)).includes("notify.mobile_app_dani_iphone"));
    await tap('[data-mg="target-toggle"]');
    const groups = await ev(`return [...r.querySelectorAll('${root} .mg-opt-head')].map(h => h.textContent.trim().toLowerCase()).join()`);
    check(`[${tag}] Empfänger-Liste: Gruppen, Dienste, Entitäten`, groups.split(",").length === 3, groups);
    await tap('.mg-opt-row[data-v="notify.familie"]');
    check(`[${tag}] Gruppe gewählt, Liste zu`, (await text(`${root} .mg-sel`)).includes("notify.familie") && !(await ev(`return !!r.querySelector('${root} .mg-list')`)));
    // Kritische Mitteilung: Schalter, dann Lautstärke 1 bis 10
    check(`[${tag}] kritisch zuerst aus, kein Regler`, (await ev(`return !r.querySelector('${root} input[data-mg="critical"]').checked && !r.querySelector('${root} input[data-mg="volume"]')`)));
    await tap('input[data-mg="critical"]');
    check(`[${tag}] kritisch an: Regler 1 bis 10, Vorgabe 10`, await wait(`const v=r.querySelector('${root} input[data-mg="volume"]'); return !!v && v.min === "1" && v.max === "10" && v.step === "1" && v.value === "10" && r.querySelector('${root} .mg-volval').textContent.trim() === ${JSON.stringify(lang === "de" ? "10 von 10" : "10 of 10")}`));
    check(`[${tag}] kritisch: Vorschau trägt den Vermerk`, await wait(`return r.querySelector('${root} .mg-pv .pv-app')?.textContent.includes(${JSON.stringify(lang === "de" ? "kritisch" : "critical")})`));
    await ev(`const v=r.querySelector('${root} input[data-mg="volume"]'); v.value="7"; v.dispatchEvent(new Event("input",{bubbles:true}))`);
    check(`[${tag}] Lautstärke 7: Anzeige folgt`, (await text(`${root} .mg-volval`)) === (lang === "de" ? "7 von 10" : "7 of 10"));
    check(`[${tag}] Schritt 4 mit Regler ohne Querscrollen`, (await overflow()) <= 0);
    await p.screenshot({ path: `${outDir}/magic-${tag.replace("/", "-")}-4.png` });
    // Wiederholung: eigene Zeit 3 Std.
    await fill('input[data-mg="repeat-own"]', "3");
    await ev(`const s=r.querySelector('${root} select[data-mg="repeat-unit"]'); s.value="3600"; s.dispatchEvent(new Event("change",{bubbles:true}));`);
    check(`[${tag}] Wiederholung frei: keine Voreinstellung leuchtet`, await wait(`return !r.querySelector('${root} [data-mg="repeat"].on')`));
    await tap('[data-mg="repeat"][data-s="1800"]');
    check(`[${tag}] Voreinstellung 30 Min. ersetzt die freie Zeit`, await wait(`return r.querySelector('${root} [data-mg="repeat"].on')?.dataset.s === "1800" && r.querySelector('${root} input[data-mg="repeat-own"]').value === ""`));
    await fill('input[data-mg="repeat-own"]', "3");
    await ev(`const s=r.querySelector('${root} select[data-mg="repeat-unit"]'); s.value="3600"; s.dispatchEvent(new Event("change",{bubbles:true}));`);
    // "wieder normal" mit eigenem Text
    check(`[${tag}] "wieder normal" zuerst aus`, (await ev(`return r.querySelector('${root} [data-mg-text="recover_message"]')`)) === null);
    await tap('input[data-mg="recover"]');
    check(`[${tag}] "wieder normal": eigenes Textfeld mit Standardtext`, await wait(`return (r.querySelector('${root} [data-mg-text="recover_message"]')?.value || "").includes("{entity}")`));
    await fill('[data-mg-text="recover_message"]', "Keller wieder warm: {value} {unit}");
    check(`[${tag}] "wieder normal": eigener Inhalt mit Vorgabe`, (await ev(`return r.querySelector('${root} [data-mg-text="recover_body"]').value`)).includes("{duration}"));
    await fill('[data-mg-text="recover_body"]', "Wieder {value} {unit} nach {duration}");
    check(`[${tag}] zweite Vorschau: Inhalt aus dem eigenen Text`, await wait(`const b=[...r.querySelectorAll('${root} .mg-pv .pv-text')].map(x=>x.textContent); return b.length === 2 && b[1].startsWith("Wieder ") && b[1].includes("nach 10 Min.")`), await ev(`return [...r.querySelectorAll('${root} .mg-pv .pv-text')].map(x=>x.textContent).join(" | ")`));
    check(`[${tag}] zweite Vorschau mit dem freien Text`, await wait(`const t=[...r.querySelectorAll('${root} .mg-pv .pv-title')].map(x=>x.textContent); return t.length === 2 && t[1].startsWith("Keller wieder warm: ")`), await ev(`return [...r.querySelectorAll('${root} .mg-pv .pv-title')].map(x=>x.textContent).join(" | ")`));
    // Test senden
    await tap('[data-mg="test"][data-which="recover"]');
    check(`[${tag}] Test senden: Rückmeldung`, await wait(`return r.querySelector('${root} .mg-testres')?.textContent.includes(${JSON.stringify(T.testSent)})`));
    const test = (await calls("magic_test")).at(-1);
    check(`[${tag}] Test geht mit "wieder normal" und dem Entwurf an den Server`, test?.which === "recover" && test.rule.critical === true && test.rule.critical_volume === 7 && test.rule.recover_message === "Keller wieder warm: {value} {unit}" && test.rule.target === "notify.familie", JSON.stringify(test));
    await next();

    // --- Schritt 5: Name ---
    await headingOk(T.q5);
    await step(5);
    const suggestion = await ev(`return r.querySelector('${root} input[data-mg="name"]').value`);
    check(`[${tag}] Namensvorschlag aus Entität und Bedingung`, /Temperatur/.test(suggestion) && suggestion.includes("12"), suggestion);
    await fill('input[data-mg="name"]', "");
    check(`[${tag}] ohne Namen kein Speichern`, await wait(`return r.querySelector('${root} [data-mg="save"]').disabled === true`));
    await fill('input[data-mg="name"]', "Keller kalt");
    check(`[${tag}] Zusammenfassung zeigt den Namen`, await wait(`return r.querySelector('${root} .mg-card .mg-t b')?.textContent === "Keller kalt"`));
    await tap('[data-mg="save"]');
    check(`[${tag}] gespeichert: Liste mit Hinweis`, await wait(`return r.querySelector('${root} .mg-flash')?.textContent.trim() === ${JSON.stringify(T.saved)} && r.querySelectorAll('${root} .mg-card').length === 1`));
    const saved = (await calls("magic_save")).at(-1)?.rule;
    check(`[${tag}] Server bekommt alle Felder`, saved && saved.entity_id === "sensor.temp" && saved.kind === "below" && saved.value === 12 && saved.for_s === 2700 && saved.repeat_s === 10800 && saved.recover === true && saved.recover_message === "Keller wieder warm: {value} {unit}" && saved.message === "Keller kalt: {value} {unit} (unter {threshold}) ✔" && saved.target === "notify.familie" && saved.critical === true && saved.critical_volume === 7 && saved.body === "Aktuell {value} {unit}\nSchwelle {threshold} {unit}" && saved.recover_body === "Wieder {value} {unit} nach {duration}" && saved.name === "Keller kalt" && saved.device_id === "d", JSON.stringify(saved));
    check(`[${tag}] Reiter zeigt "${T.active1}"`, await wait(`return r.querySelector('.sub-tab[data-tab="magic"] .tab-s')?.textContent.trim() === ${JSON.stringify(T.active1)}`));
    check(`[${tag}] Karte: Name, Satz, noch nie ausgelöst`, (await text(`${root} .mg-card .mg-t b`)) === "Keller kalt" && (await text(`${root} .mg-card .mg-t small`)).includes("12") && (await text(`${root} .mg-status`)).includes(T.never));
    check(`[${tag}] Karte nennt "kritisch" und die Lautstärke`, (await text(`${root} .mg-card .mg-t small`)).includes(lang === "de" ? "kritisch (Lautstärke 7)" : "critical (volume 7)"), await text(`${root} .mg-card .mg-t small`));
    check(`[${tag}] Liste ohne Querscrollen`, (await overflow()) <= 0);
    await p.screenshot({ path: `${outDir}/magic-${tag.replace("/", "-")}-list.png` });

    // --- Umbenennen ---
    await tap('[data-mg="rename"]');
    check(`[${tag}] Umbenennen: Feld mit Namen, Fokus`, await wait(`const i=r.querySelector('${root} input[data-mg="rename-input"]'); return !!i && i.value === "Keller kalt" && r.activeElement === i`));
    await p.keyboard.press("Escape");
    check(`[${tag}] Escape bricht ab, Popup bleibt offen`, await wait(`return !r.querySelector('${root} input[data-mg="rename-input"]') && r.querySelector("dialog.device").open`));
    await tap('[data-mg="rename"]');
    await wait(`return !!r.querySelector('${root} input[data-mg="rename-input"]')`);
    await p.keyboard.press("Control+a");
    await p.keyboard.type("Kellertemperatur");
    await p.keyboard.press("Enter");
    check(`[${tag}] umbenannt: neuer Name in der Liste`, await wait(`return r.querySelector('${root} .mg-card .mg-t b')?.textContent === "Kellertemperatur"`));
    const renamed = (await calls("magic_save")).at(-1)?.rule;
    check(`[${tag}] Umbenennen ändert nur den Namen`, renamed.name === "Kellertemperatur" && renamed.id && renamed.for_s === 2700 && renamed.recover === true && !("active" in renamed) && !("last_fired" in renamed), JSON.stringify(Object.keys(renamed)));

    // --- Ausschalten ---
    await tap('input[data-mg="toggle"]');
    check(`[${tag}] Ausschalten: Server und Karte`, await wait(`return r.querySelector('${root} .mg-card.off') && !r.querySelector('.sub-tab[data-tab="magic"] .tab-s')`) && (await calls("magic_enable")).at(-1)?.enabled === false);
    await tap('input[data-mg="toggle"]');
    await wait(`return !r.querySelector('${root} .mg-card.off')`);

    // --- Bearbeiten ---
    await tap('[data-mg="edit"]');
    await headingOk(T.q1);
    check(`[${tag}] Bearbeiten: Schrittleiste antippbar, Entität gewählt`, (await ev(`return r.querySelectorAll('${root} button.mg-stp').length`)) === 5 && (await ev(`return r.querySelector('${root} .mg-pick.sel')?.dataset.id`)) === "sensor.temp");
    await tap('button.mg-stp[data-step="5"]');
    await headingOk(T.q5);
    check(`[${tag}] Sprung zu Schritt 5: Name, Text und Empfänger übernommen`, (await ev(`return r.querySelector('${root} input[data-mg="name"]').value`)) === "Kellertemperatur");
    await tap('button.mg-stp[data-step="4"]');
    check(`[${tag}] Schritt 4 übernimmt Gruppe, Wiederholung und "wieder normal"-Text`, (await text(`${root} .mg-sel`)).includes("notify.familie") && (await ev(`return r.querySelector('${root} input[data-mg="repeat-own"]').value`)) === "3" && (await ev(`return r.querySelector('${root} [data-mg-text="recover_message"]').value`)) === "Keller wieder warm: {value} {unit}" && (await ev(`return r.querySelector('${root} input[data-mg="critical"]').checked && r.querySelector('${root} input[data-mg="volume"]').value === "7"`)));
    await tap('button.mg-stp[data-step="5"]');
    await fill('input[data-mg="name"]', "Keller zu kalt");
    await tap('[data-mg="save"]');
    await wait(`return r.querySelector('${root} .mg-card .mg-t b')?.textContent === "Keller zu kalt"`);
    check(`[${tag}] Bearbeiten speichert dieselbe Meldung (id), keine zweite`, (await ev(`return r.querySelectorAll('${root} .mg-card').length`)) === 1 && (await calls("magic_save")).at(-1)?.rule.id === renamed.id);

    // --- Assistent, Zustand (Fenster) ---
    await tap('[data-mg="add"]');
    await tap('.mg-pick[data-id="binary_sensor.window"]');
    await next();
    await step(2);
    const kinds = await ev(`return [...r.querySelectorAll('${root} .sub-tabs [data-mg="kind"]')].map(b => b.dataset.kind).join()`);
    check(`[${tag}] Zustand: nur "ist" und "ändert sich", Wörter der Entität`, kinds === "is,change" && (await ev(`return [...r.querySelectorAll('${root} [data-mg="state"]')].map(b => b.textContent.trim()).join()`)) === (lang === "de" ? "offen,geschlossen" : "open,closed"));
    check(`[${tag}] Zustand: Balken statt Linie`, await wait(`return !!r.querySelector('${root} .mg-bar span') && !r.querySelector('${root} svg.mg-spark')`));
    await tap('[data-mg="state"][data-v="on"]');
    await fill('input[data-mg="for-own"]', "45");
    await next();
    check(`[${tag}] Zustand: Variablen nur {value}`, await wait(`return [...r.querySelectorAll('${root} .mg-chips button.sug')].map(b => b.dataset.var).join() === "value"`));
    // Kein Verlauf: leer und ohne Recorder
    await tap('[data-mg="back"]');
    await p.evaluate(() => { window.__magicHist = "empty"; });
    await tap('[data-mg="kind"][data-kind="change"]');
    check(`[${tag}] Rückblick darf leer sein: "${T.none}"`, await wait(`return r.querySelector('${root} .mg-hist')?.textContent.includes(${JSON.stringify(T.none)})`));
    await p.evaluate(() => { window.__magicHist = "norecorder"; });
    await tap('[data-mg="kind"][data-kind="is"]');
    check(`[${tag}] ohne Recorder: Hinweis, kein Fehler`, await wait(`return r.querySelector('${root} .mg-hist')?.textContent.includes(${JSON.stringify(T.norec)})`));
    await p.evaluate(() => { window.__magicHist = null; });
    // "ändert sich": keine Wiederholung, kein "wieder normal"
    await tap('[data-mg="kind"][data-kind="change"]');
    await next();
    check(`[${tag}] ändert sich: Variablen old/new`, await wait(`return [...r.querySelectorAll('${root} .mg-chips button.sug')].map(b => b.dataset.var).join() === "value,unit,old,new"`));
    await next();
    check(`[${tag}] ändert sich: keine Wiederholung, kein "wieder normal"`, (await ev(`return !r.querySelector('${root} [data-mg="repeat"]') && !r.querySelector('${root} input[data-mg="recover"]')`)));
    await next();
    // Speichern schlägt fehl: Fehler im Assistenten, nichts geht verloren
    await p.evaluate(() => { window.__magicSaveFails = "Dienst nicht erreichbar"; });
    await tap('[data-mg="save"]');
    check(`[${tag}] Fehler beim Speichern bleibt im Assistenten`, await wait(`return r.querySelector('${root} .dlg-error')?.textContent.includes(${JSON.stringify(T.saveErr)}) && r.querySelector('${root} input[data-mg="name"]')`));
    await p.evaluate(() => { window.__magicSaveFails = null; });
    await tap('[data-mg="save"]');
    check(`[${tag}] danach klappt es: zwei Meldungen`, await wait(`return r.querySelectorAll('${root} .mg-card').length === 2`));

    // --- Löschen mit Bestätigung ---
    await tap('[data-mg="delete"]');
    check(`[${tag}] Löschen fragt nach (mit Namen)`, await wait(`return r.querySelector('${root} .mg-confirm b')?.textContent.includes(${JSON.stringify(T.delAsk)})`));
    await tap('[data-mg="delete-no"]');
    check(`[${tag}] Abbrechen löscht nichts`, (await ev(`return r.querySelectorAll('${root} .mg-card').length`)) === 2 && !(await ev(`return !!r.querySelector('${root} .mg-confirm')`)) && (await calls("magic_delete")).length === 0);
    await tap('[data-mg="delete"]');
    await tap('[data-mg="delete-yes"]');
    check(`[${tag}] Löschen: Karte weg, Server weiss es`, await wait(`return r.querySelectorAll('${root} .mg-card').length === 1`) && (await calls("magic_delete")).length === 1);

    // --- Laden schlägt fehl: Wiederholen ---
    await ev(`r.host._closeDevice()`);
    await p.evaluate(() => { window.__magicLoadFails = "Verbindung weg"; });
    await tap('.dev[data-open="d"]');
    await wait(`return r.querySelector("dialog.device")?.open`);
    await tap('.sub-tab[data-tab="magic"]');
    check(`[${tag}] Laden schlägt fehl: Fehler und Wiederholen`, await wait(`return !!r.querySelector('${root} .dlg-error') && !!r.querySelector('${root} [data-mg="reload"]')`));
    await p.evaluate(() => { window.__magicLoadFails = null; });
    await tap('[data-mg="reload"]');
    check(`[${tag}] Wiederholen lädt die Liste`, await wait(`return r.querySelectorAll('${root} .mg-card').length === 1`));
    // Popup geschlossen: Stand weg, Assistent nicht mehr offen
    await ev(`r.host._closeDevice()`);
    check(`[${tag}] Popup zu: Assistent und Stand zurückgesetzt`, (await ev(`return r.host._magic.deviceId === null && !r.host._magic.wizardOpen()`)));

    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
