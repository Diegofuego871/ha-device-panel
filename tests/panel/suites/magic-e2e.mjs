// Magic Push (2.6.0): vierter Reiter im Geräte-Popup. Liste (Zähler im Reiter), Assistent in fünf Schritten
// (Wert · Wann · Versand · Text · Name) für Zahl und Zustand, freie Zeit, Rückblick (auch leer und ohne
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
  de: { tab: "Magic Push", add: "Neue Meldung", q1: "Was soll überwacht werden?", q2: "Wie lange muss das zutreffen?", q1b: "Welche Bedingungen?", step1: "Bedingungen", step2: "Wie lange", q5: "Wie soll die Meldung heissen?", once: "wäre 1-mal gekommen", none: "Kein Verlauf vorhanden", norec: "der Recorder ist nicht aktiv", saved: "Gespeichert.", testSent: "Test gesendet an", unreachable: "nicht erreichbar", delAsk: 'löschen?', rename: "Umbenennen", del: "Löschen", active1: "1 aktiv", pvNote: "Vorschau mit dem aktuellen Wert", saveErr: "Speichern nicht möglich:", hint: "Höchstens", never: "noch nie ausgelöst", discard: "Änderungen verwerfen?", dismissed: "Verwerfen" },
  en: { tab: "Magic Push", add: "New message", q1: "What should be watched?", q2: "How long must this hold?", q1b: "Which conditions?", step1: "Conditions", step2: "How long", q5: "What should the message be called?", once: "would have fired once", none: "No history available", norec: "the recorder is not active", saved: "Saved.", testSent: "Test sent to", unreachable: "unreachable", delAsk: "Delete", rename: "Rename", del: "Delete", active1: "1 active", pvNote: "Preview with the current value", saveErr: "Could not save:", hint: "At most", never: "never triggered", discard: "Discard changes?", dismissed: "Discard" },
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
    // Der Assistent hat seit 2.11.0 ein eigenes Fenster; die Liste bleibt im Reiter des Popups (.mg-root)
    const W = "dialog.magic-dlg";
    const step = (n) => wait(`return r.querySelectorAll('${W} .mg-stp.on').length === ${n}`);
    const next = async () => { await tap('[data-mg="next"]'); };
    const overflow = () => ev(`const d=r.querySelector("dialog.magic-dlg[open]") || r.querySelector("dialog.device"); return d.scrollWidth - d.clientWidth`);
    const headingOk = (q) => wait(`return r.querySelector('${W} .mg-big')?.textContent.trim() === ${JSON.stringify(q)}`);

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
    // Eigenes Fenster (2.11.0, Variante A): Popup bleibt dahinter offen, die Liste im Reiter zeigt keinen Assistenten
    check(`[${tag}] Assistent im eigenen Fenster, Popup dahinter offen, Reiter ohne Assistent`, await wait(`return r.querySelector("${W}").open && r.querySelector("dialog.device").open && !r.querySelector('${root} .mg-big') && !r.querySelector('${root} .mg-steps')`));
    const geo = await ev(`const w=r.querySelector("${W}").getBoundingClientRect(); const f=r.querySelector('${W} .mgw-foot').getBoundingClientRect(); const h=r.querySelector('${W} .mgw-head').getBoundingClientRect(); return [Math.round(w.width), Math.round(w.height), Math.round(f.bottom - w.bottom), Math.round(h.top - w.top), innerWidth, innerHeight]`);
    if (mobile) check(`[${tag}] Handy: Vollbild`, geo[0] === geo[4] && geo[1] === geo[5] && Math.abs(geo[2]) <= 1, JSON.stringify(geo));
    else check(`[${tag}] Desktop: breites Fenster (920 px), Fusszeile am unteren Rand`, geo[0] === 920 && Math.abs(geo[2]) <= 1, JSON.stringify(geo));
    check(`[${tag}] Kopf nennt "${T.add}" und das Gerät`, (await text(`${W} .mgw-t`)).includes(T.add) && (await text(`${W} .mgw-t`)).includes("Steckdose Terrasse"), await text(`${W} .mgw-t`));
    await p.keyboard.press("Escape");
    check(`[${tag}] Escape ohne Änderung schliesst das Fenster sofort, Popup bleibt`, await wait(`return !r.querySelector("${W}").open && r.querySelector("dialog.device").open && !!r.querySelector('${root} [data-mg="add"]')`));
    await tap('[data-mg="add"]');
    await headingOk(T.q1);
    check(`[${tag}] Schritt 1: fünf Entitäten, "Weiter" gesperrt`, (await ev(`return r.querySelectorAll('${W} .mg-pick[data-id]').length`)) === 5 && (await ev(`return r.querySelector('${W} [data-mg="next"]').disabled`)) === true);
    check(`[${tag}] nicht erreichbare Entität benannt`, (await text(`${W} .mg-pick[data-id="sensor.rssi"]`)).includes(T.unreachable));
    check(`[${tag}] Schrittleiste: nur der erste Balken an`, (await ev(`return r.querySelectorAll('${W} .mg-stp.on').length`)) === 1 && (await ev(`return r.querySelectorAll('${W} button.mg-stp').length`)) === 0);
    check(`[${tag}] Schritt 1 heisst "${T.step1}", Schritt 2 "${T.step2}"`, (await text(`${W} .mg-stephead`)).includes(T.step1));
    // Alle Bedingungen auf der ersten Seite (2.15.0): Wahl der Entität, dann ihre Bedingung
    await tap('.mg-pick[data-id="sensor.temp"]');
    await headingOk(T.q1b);
    check(`[${tag}] Temperatur gewählt: Karte offen mit drei Bedingungen, "unter" und dem Wert der Entität, "Weiter" frei`, await wait(`return r.querySelectorAll('${W} .mg-lcard').length === 1 && r.querySelector('${W} .mg-lcard.open') && r.querySelectorAll('${W} .sub-tabs [data-mg="kind"]').length === 4 && r.querySelector('${W} [data-mg="next"]').disabled === false`) && (await ev(`return r.querySelector('${W} .sub-tabs [data-mg="kind"].on').dataset.kind`)) === "below" && (await ev(`return r.querySelector('${W} input[data-mg="value"]').value`)) === "14.2");
    check(`[${tag}] eine Bedingung: kein Und/Oder, aber "Bedingung" und "Gruppe" zum Hinzufügen`, !(await ev(`return !!r.querySelector('${W} [data-mg="op"]')`)) && !!(await handle(`${W} [data-mg="add-cond"]`)) && !!(await handle(`${W} [data-mg="add-group"]`)));
    // Auswahlknöpfe sind Reiterleisten wie die Reiter oben: .sub-tabs mit gleitender Kapsel, gleiche Schrift und Fläche
    const pillAt = (bar) => ev(`const b=r.querySelector(${JSON.stringify(bar)}); const p=b?.querySelector(":scope > .seg-pill"); const on=b?.querySelector(".sub-tab.on"); if(!p||!on) return null; const m=new DOMMatrix(getComputedStyle(p).transform); return [Math.round(m.m41-on.offsetLeft), Math.round(m.m42-on.offsetTop), Math.round(p.offsetWidth-on.offsetWidth)]`);
    const same = (await ev(`const a=getComputedStyle(r.querySelector('dialog.device .dev-tabs .sub-tab')), b=getComputedStyle(r.querySelector('${W} [data-mg="kind"]')), bar=getComputedStyle(r.querySelector('dialog.device .dev-tabs .sub-tabs')), bar2=getComputedStyle(r.querySelector('${W} .sub-tabs.mg-tabs')); return [a.borderRadius===b.borderRadius, a.fontFamily===b.fontFamily, bar.backgroundColor===bar2.backgroundColor, bar.borderRadius===bar2.borderRadius]`));
    check(`[${tag}] Auswahlknöpfe wie die Reiter: gleiche Form, Schrift und Fläche`, same.every(Boolean), JSON.stringify(same));
    await p.waitForTimeout(700);
    check(`[${tag}] Bedingung: Kapsel liegt unter dem gewählten Knopf`, JSON.stringify(await pillAt(`${W} .sub-tabs:has([data-mg="kind"])`)) === "[0,0,0]", JSON.stringify(await pillAt(`${W} .sub-tabs:has([data-mg="kind"])`)));
    await tap('[data-mg="kind"][data-kind="above"]');
    await p.waitForTimeout(80);
    const moving = await pillAt(`${W} .sub-tabs:has([data-mg="kind"])`);
    check(`[${tag}] Kapsel gleitet (noch unterwegs kurz nach dem Wechsel)`, moving && (moving[0] !== 0 || moving[2] !== 0 || (await ev(`return r.querySelector('${W} .sub-tabs:has([data-mg="kind"]) .seg-pill').classList.contains("go")`))), JSON.stringify(moving));
    await p.waitForTimeout(700);
    check(`[${tag}] Kapsel kommt am neuen Knopf an`, JSON.stringify(await pillAt(`${W} .sub-tabs:has([data-mg="kind"])`)) === "[0,0,0]");
    await tap('[data-mg="kind"][data-kind="below"]');
    await p.waitForTimeout(700);
    // Wert tippen: das Diagramm der Bedingung erscheint
    await fill('input[data-mg="value"]', "12");
    check(`[${tag}] Diagramm mit Schwelle in der Karte`, await wait(`return !!r.querySelector('${W} .mg-lcard svg.mg-spark line')`));
    // Minus/Plus
    await tap('[data-mg="step"][data-dir="1"]');
    check(`[${tag}] Plus erhöht um 1`, (await ev(`return r.querySelector('${W} input[data-mg="value"]').value`)) === "13");
    await tap('[data-mg="step"][data-dir="-1"]');
    // Rücksetzwert (2.8.0, seit 2.15.0 je Bedingung): automatisch oder eigener Wert, mit Hinweis, Prüfung, Linie im Diagramm
    check(`[${tag}] Zurücksetzen: Reiterleiste "Automatisch / Eigener Wert", zuerst automatisch`, (await ev(`return [...r.querySelectorAll('${W} [data-mg="reset-mode"]')].map(b => b.classList.contains("on")).join()`)) === "true,false" && !(await ev(`return !!r.querySelector('${W} input[data-mg="reset-value"]')`)));
    await tap('[data-mg="reset-mode"][data-own="1"]');
    check(`[${tag}] eigener Wert: Zahlenwähler mit Vorschlag über der Schwelle, Hinweis nennt beide Werte`, await wait(`const v=r.querySelector('${W} input[data-mg="reset-value"]'); return !!v && Number(v.value) > 12 && r.querySelector('${W} [data-mg-zone="resethint"]').textContent.includes("12") && r.querySelector('${W} [data-mg-zone="resethint"]').textContent.includes(v.value.replace(".", ${JSON.stringify(lang === "de" ? "," : ".")}))`), await text(`${W} [data-mg-zone="resethint"]`));
    await fill('input[data-mg="reset-value"]', "10");
    check(`[${tag}] Rücksetzwert unter der Schwelle: Fehler, "Weiter" gesperrt`, await wait(`return !!r.querySelector('${W} [data-mg-zone="resethint"] .opt-error') && r.querySelector('${W} [data-mg="next"]').disabled === true`));
    await fill('input[data-mg="reset-value"]', "14");
    check(`[${tag}] Rücksetzwert 14: Hinweis, "Weiter" frei`, await wait(`return !r.querySelector('${W} [data-mg-zone="resethint"] .opt-error') && r.querySelector('${W} [data-mg-zone="resethint"]').textContent.includes("14") && r.querySelector('${W} [data-mg="next"]').disabled === false`));
    await tap('[data-mg="reset-step"][data-dir="1"]');
    check(`[${tag}] Plus am Rücksetzwert`, (await ev(`return r.querySelector('${W} input[data-mg="reset-value"]').value`)) === "15");
    await tap('[data-mg="reset-step"][data-dir="-1"]');
    check(`[${tag}] Diagramm: zweite Linie für den Rücksetzwert`, await wait(`return r.querySelectorAll('${W} svg.mg-spark line').length === 2`));
    await p.waitForTimeout(700);
    const leafCall = (await calls("magic_history")).at(-1);
    check(`[${tag}] Verlauf der Bedingung bekommt den Rücksetzwert, ohne Dauer`, leafCall?.reset_value === 14 && leafCall.for_s === 0 && !("conditions" in leafCall), JSON.stringify(leafCall));
    check(`[${tag}] Kapsel der Rücksetz-Leiste liegt unter "Eigener Wert"`, JSON.stringify(await pillAt(`${W} .sub-tabs:has([data-mg="reset-mode"])`)) === "[0,0,0]");
    check(`[${tag}] Schritt 1 ohne Querscrollen`, (await overflow()) <= 0, String(await overflow()));
    await p.screenshot({ path: `${outDir}/magic-${tag.replace("/", "-")}-1.png` });
    await next();
    await headingOk(T.q2);
    await step(2);
    check(`[${tag}] Schritt 2: Rückblick ${mobile ? "im Fluss des Formulars" : "in der Seitenspalte rechts"}`, (await ev(`return !!r.querySelector('${W} .mgw-side [data-mg-zone="hist"]')`)) === !mobile);
    // Die Knöpfe bleiben stehen, auch wenn der Inhalt ganz nach unten gescrollt ist
    await ev(`const sc = r.querySelector('${W} .mgw-body.two > .mgw-main') || r.querySelector('${W} .mgw-body'); sc.scrollTop = 99999;`);
    check(`[${tag}] Knöpfe unten bleiben sichtbar (fest)`, (await ev(`const n=r.querySelector('${W} [data-mg="next"]').getBoundingClientRect(); const w=r.querySelector("${W}").getBoundingClientRect(); return n.top >= w.top && n.bottom <= w.bottom + 1`)) === true);
    await ev(`const sc = r.querySelector('${W} .mgw-body.two > .mgw-main') || r.querySelector('${W} .mgw-body'); sc.scrollTop = 0;`);
    // Dauer: Vorschlag, dann freie Zeit (Schritt 2)
    await tap('[data-mg="for"][data-s="600"]');
    check(`[${tag}] Dauer 10 Min. gewählt`, await wait(`return r.querySelector('${W} [data-mg="for"].on')?.dataset.s === "600"`));
    await fill('input[data-mg="for-own"]', "45");
    await ev(`const s=r.querySelector('${W} select[data-mg="for-unit"]'); s.value="60"; s.dispatchEvent(new Event("change",{bubbles:true}));`);
    check(`[${tag}] freie Zeit: keine Kapsel bleibt auf einem Vorschlag stehen`, await wait(`return !r.querySelector('${W} .sub-tabs:has([data-mg="for"]) .seg-pill')`));
    check(`[${tag}] freie Zeit 45 Min. ersetzt den Vorschlag`, await wait(`return !r.querySelector('${W} [data-mg="for"].on') && r.querySelector('${W} input[data-mg="for-own"]').value === "45"`));
    // zu lang: 8 Tage
    await ev(`const s=r.querySelector('${W} select[data-mg="for-unit"]'); s.value="86400"; s.dispatchEvent(new Event("change",{bubbles:true}));`);
    await fill('input[data-mg="for-own"]', "8");
    check(`[${tag}] zu lange Zeit: Hinweis und "Weiter" gesperrt`, await wait(`return r.querySelector('${W} [data-mg-zone="forhint"]')?.textContent.includes(${JSON.stringify(T.hint)}) && r.querySelector('${W} [data-mg="next"]').disabled === true`));
    await fill('input[data-mg="for-own"]', "45");
    await ev(`const s=r.querySelector('${W} select[data-mg="for-unit"]'); s.value="60"; s.dispatchEvent(new Event("change",{bubbles:true}));`);
    check(`[${tag}] wieder gültig: "Weiter" frei`, await wait(`return r.querySelector('${W} [data-mg="next"]').disabled === false`));
    check(`[${tag}] Rückblick: "${T.once}"`, await wait(`return r.querySelector('${W} .mg-hist')?.textContent.includes(${JSON.stringify(T.once)})`), await text(`${W} .mg-hist`));
    check(`[${tag}] Rückblick-Diagramm mit Schwelle (eine Bedingung)`, await wait(`return !!r.querySelector('${W} svg.mg-spark line')`));
    await p.waitForTimeout(700);
    const histCall = (await calls("magic_history")).at(-1);
    check(`[${tag}] Rückblick bekommt Dauer, Schwelle und Rücksetzwert, ohne Bedingungsbaum`, histCall?.for_s === 2700 && histCall.value === 12 && histCall.reset_value === 14 && !("conditions" in histCall), JSON.stringify(histCall));
    check(`[${tag}] Schritt 2 ohne Querscrollen`, (await overflow()) <= 0, String(await overflow()));
    await p.screenshot({ path: `${outDir}/magic-${tag.replace("/", "-")}-2.png` });
    await next();

    // --- Schritt 3: Versand (Empfänger, kritisch, Wiederholung) ---
    await step(3);
    check(`[${tag}] Schritt 3: Empfänger = Standard`, (await text(`${W} .mg-sel`)).includes("notify.mobile_app_dani_iphone"));
    await tap('[data-mg="target-toggle"]');
    const groups = await ev(`return [...r.querySelectorAll('${W} .mg-opt-head')].map(h => h.textContent.trim().toLowerCase()).join()`);
    check(`[${tag}] Empfänger-Liste: Gruppen, Dienste, Entitäten`, groups.split(",").length === 3, groups);
    await tap('.mg-opt-row[data-v="notify.familie"]');
    check(`[${tag}] Gruppe gewählt, Liste zu`, (await text(`${W} .mg-sel`)).includes("notify.familie") && !(await ev(`return !!r.querySelector('${W} .mg-list')`)));
    // Kritische Mitteilung: Schalter, dann Lautstärke 1 bis 10
    check(`[${tag}] kritisch zuerst aus, kein Regler`, (await ev(`return !r.querySelector('${W} input[data-mg="critical"]').checked && !r.querySelector('${W} input[data-mg="volume"]')`)));
    await tap('input[data-mg="critical"]');
    check(`[${tag}] kritisch an: Regler 1 bis 10, Vorgabe 10`, await wait(`const v=r.querySelector('${W} input[data-mg="volume"]'); return !!v && v.min === "1" && v.max === "10" && v.step === "1" && v.value === "10" && r.querySelector('${W} .mg-volval').textContent.trim() === ${JSON.stringify(lang === "de" ? "10 von 10" : "10 of 10")}`));
    await ev(`const v=r.querySelector('${W} input[data-mg="volume"]'); v.value="7"; v.dispatchEvent(new Event("input",{bubbles:true}))`);
    check(`[${tag}] Lautstärke 7: Anzeige folgt`, (await text(`${W} .mg-volval`)) === (lang === "de" ? "7 von 10" : "7 of 10"));
    check(`[${tag}] Schritt 3 mit Regler ohne Querscrollen`, (await overflow()) <= 0);
    await p.screenshot({ path: `${outDir}/magic-${tag.replace("/", "-")}-3.png` });
    // Wiederholung: eigene Zeit 3 Std.
    await fill('input[data-mg="repeat-own"]', "3");
    await ev(`const s=r.querySelector('${W} select[data-mg="repeat-unit"]'); s.value="3600"; s.dispatchEvent(new Event("change",{bubbles:true}));`);
    check(`[${tag}] Wiederholung frei: keine Voreinstellung leuchtet`, await wait(`return !r.querySelector('${W} [data-mg="repeat"].on')`));
    await tap('[data-mg="repeat"][data-s="1800"]');
    check(`[${tag}] Voreinstellung 30 Min. ersetzt die freie Zeit`, await wait(`return r.querySelector('${W} [data-mg="repeat"].on')?.dataset.s === "1800" && r.querySelector('${W} input[data-mg="repeat-own"]').value === ""`));
    await fill('input[data-mg="repeat-own"]', "3");
    await ev(`const s=r.querySelector('${W} select[data-mg="repeat-unit"]'); s.value="3600"; s.dispatchEvent(new Event("change",{bubbles:true}));`);
    await next();

    // --- Schritt 4: Text und "wieder normal" ---
    await step(4);
    check(`[${tag}] Schritt 4: Standardtext zur Art, Variablen der Zahl`, (await ev(`return r.querySelector('${W} [data-mg-text="message"]').value`)).includes("{entity}") && (await ev(`return [...r.querySelectorAll('${W} .mg-chips button.sug')].map(b => b.dataset.var).join()`)) === "value,unit,threshold");
    await fill('[data-mg-text="message"]', "Keller kalt: ");
    await tap('[data-mg="var"][data-var="value"]');
    await tap('[data-mg="var"][data-var="unit"]');
    check(`[${tag}] Variablen werden an den Cursor eingefügt`, (await ev(`return r.querySelector('${W} [data-mg-text="message"]').value`)) === "Keller kalt: {value}{unit}");
    await fill('[data-mg-text="message"]', "Keller kalt: {value} {unit} (unter {threshold})");
    // Inhalt getrennt vom Titel (2.7.0)
    check(`[${tag}] Titel ist ein Einzeilenfeld, Inhalt ein Textfeld mit Vorgabe`, (await ev(`return r.querySelector('${W} [data-mg-text="message"]').tagName === "INPUT" && r.querySelector('${W} [data-mg-text="body"]').tagName === "TEXTAREA"`)) && (await ev(`return r.querySelector('${W} [data-mg-text="body"]').value`)).includes("{device}"));
    await fill('[data-mg-text="body"]', "Aktuell {value} {unit}\nSchwelle {threshold} {unit}");
    const wantBody = `Aktuell ${lang === "de" ? "14,2" : "14.2"} °C\nSchwelle 12 °C`;
    check(`[${tag}] Vorschau: Titel und Inhalt getrennt, Inhalt mit eingesetzten Werten und Zeilenumbruch`, await wait(`const t=r.querySelector('${W} .mg-pv .pv-title')?.textContent, b=r.querySelector('${W} .mg-pv .pv-text')?.textContent; return !!t && t.startsWith("Keller kalt: ") && b === ${JSON.stringify(wantBody)}`), await text(`${W} .mg-pv .pv-text`));
    // Variable geht in das zuletzt gewählte Feld
    await ev(`r.querySelector('${W} [data-mg-text="body"]').focus()`);
    await tap('[data-mg="var"][data-group="main"][data-var="since"]');
    check(`[${tag}] Variable landet im Inhalt, wenn dieser zuletzt gewählt war`, (await ev(`return r.querySelector('${W} [data-mg-text="body"]').value`)).endsWith("{since}") && !(await ev(`return r.querySelector('${W} [data-mg-text="message"]').value`)).includes("{since}"));
    await ev(`r.querySelector('${W} [data-mg-text="message"]').focus()`);
    await tap('[data-mg="var"][data-group="main"][data-var="area"]');
    check(`[${tag}] danach im Titel, wenn dieser zuletzt gewählt war`, (await ev(`return r.querySelector('${W} [data-mg-text="message"]').value`)).endsWith("{area}") && !(await ev(`return r.querySelector('${W} [data-mg-text="body"]').value`)).includes("{area}"));
    await fill('[data-mg-text="message"]', "Keller kalt: {value} {unit} (unter {threshold})");
    await fill('[data-mg-text="body"]', "");
    check(`[${tag}] leerer Inhalt: automatische Zeile in der Vorschau`, await wait(`return r.querySelector('${W} .mg-pv .pv-text')?.textContent === "Klimasensor Keller · seit 10 Min."`), await text(`${W} .mg-pv .pv-text`));
    await fill('[data-mg-text="body"]', "Aktuell {value} {unit}\nSchwelle {threshold} {unit}");
    check(`[${tag}] Vorschau mit eingesetzten Werten`, await wait(`return r.querySelector('${W} .mg-pv .pv-title')?.textContent.startsWith("Keller kalt: ") && !r.querySelector('${W} .mg-pv .pv-title').textContent.includes("{")`), await text(`${W} .mg-pv .pv-title`));
    check(`[${tag}] Vorschau-Hinweis`, (await text(`${W} .mg-pv .opt-short`)).includes(T.pvNote));
    check(`[${tag}] Schritt 4: Vorschau mit "Test senden" steht direkt unter Titel und Inhalt, vor "wieder normal"`, await ev(`const q=(x)=>r.querySelector('${W} '+x); const pv=q('[data-mg-zone="pv"]'), body=q('[data-mg-text="body"]'), rec=q('input[data-mg="recover"]'); const F=Node.DOCUMENT_POSITION_FOLLOWING; return !!pv && !!(body.compareDocumentPosition(pv) & F) && !!(pv.compareDocumentPosition(rec) & F) && pv.querySelectorAll('.mg-pv').length === 1 && !!pv.querySelector('[data-mg="test"][data-which="main"]') && !q('[data-mg-zone="pvr"]')`));
    check(`[${tag}] kritisch (aus Schritt 3): Vorschau trägt den Vermerk`, await wait(`return r.querySelector('${W} .mg-pv .pv-app')?.textContent.includes(${JSON.stringify(lang === "de" ? "kritisch" : "critical")})`));
    // Der Neuaufbau des Popups (Abfrage alle 10 s) lässt den Assistenten in Ruhe
    await fill('[data-mg-text="message"]', "Keller kalt: {value} {unit} (unter {threshold}) ✔");
    await ev(`r.host._renderDevice(true)`);
    await ev(`r.host._devForce = true; r.host._renderDevice()`);
    check(`[${tag}] Text übersteht den Neuaufbau des Popups`, (await ev(`return r.querySelector('${W} [data-mg-text="message"]')?.value`)) === "Keller kalt: {value} {unit} (unter {threshold}) ✔");
    // "wieder normal" mit eigenem Text
    check(`[${tag}] "wieder normal" zuerst aus`, (await ev(`return r.querySelector('${W} [data-mg-text="recover_message"]')`)) === null);
    await tap('input[data-mg="recover"]');
    check(`[${tag}] "wieder normal": eigenes Textfeld mit Standardtext`, await wait(`return (r.querySelector('${W} [data-mg-text="recover_message"]')?.value || "").includes("{entity}")`));
    await fill('[data-mg-text="recover_message"]', "Keller wieder warm: {value} {unit}");
    check(`[${tag}] "wieder normal": eigener Inhalt mit Vorgabe`, (await ev(`return r.querySelector('${W} [data-mg-text="recover_body"]').value`)).includes("{duration}"));
    await fill('[data-mg-text="recover_body"]', "Wieder {value} {unit} nach {duration}");
    check(`[${tag}] zweite Vorschau: Inhalt aus dem eigenen Text`, await wait(`const b=[...r.querySelectorAll('${W} .mg-pv .pv-text')].map(x=>x.textContent); return b.length === 2 && b[1].startsWith("Wieder ") && b[1].includes("nach 10 Min.")`), await ev(`return [...r.querySelectorAll('${W} .mg-pv .pv-text')].map(x=>x.textContent).join(" | ")`));
    check(`[${tag}] zweite Vorschau mit dem freien Text`, await wait(`const t=[...r.querySelectorAll('${W} .mg-pv .pv-title')].map(x=>x.textContent); return t.length === 2 && t[1].startsWith("Keller wieder warm: ")`), await ev(`return [...r.querySelectorAll('${W} .mg-pv .pv-title')].map(x=>x.textContent).join(" | ")`));
    check(`[${tag}] zweite Vorschau steht unter Titel und Inhalt von "wieder normal", mit eigenem Test`, await ev(`const q=(x)=>r.querySelector('${W} '+x); const pvr=q('[data-mg-zone="pvr"]'), rb=q('[data-mg-text="recover_body"]'), pv=q('[data-mg-zone="pv"]'); const F=Node.DOCUMENT_POSITION_FOLLOWING; return !!pvr && !!(rb.compareDocumentPosition(pvr) & F) && pv.querySelectorAll('.mg-pv').length === 1 && pvr.querySelectorAll('.mg-pv').length === 1 && !!pvr.querySelector('[data-mg="test"][data-which="recover"]') && !pv.querySelector('[data-which="recover"]')`));
    // Test senden
    await tap('[data-mg="test"][data-which="recover"]');
    check(`[${tag}] Test senden: Rückmeldung`, await wait(`return r.querySelector('${W} .mg-testres')?.textContent.includes(${JSON.stringify(T.testSent)})`));
    const test = (await calls("magic_test")).at(-1);
    check(`[${tag}] Test geht mit "wieder normal" und dem Entwurf an den Server`, test?.which === "recover" && test.rule.critical === true && test.rule.critical_volume === 7 && test.rule.recover_message === "Keller wieder warm: {value} {unit}" && test.rule.target === "notify.familie", JSON.stringify(test));
    await next();

    // --- Schritt 5: Name ---
    await headingOk(T.q5);
    await step(5);
    const suggestion = await ev(`return r.querySelector('${W} input[data-mg="name"]').value`);
    check(`[${tag}] Namensvorschlag aus Entität und Bedingung`, /Temperatur/.test(suggestion) && suggestion.includes("12"), suggestion);
    await fill('input[data-mg="name"]', "");
    check(`[${tag}] ohne Namen kein Speichern`, await wait(`return r.querySelector('${W} [data-mg="save"]').disabled === true`));
    await fill('input[data-mg="name"]', "Keller kalt");
    check(`[${tag}] Zusammenfassung zeigt den Namen`, await wait(`return r.querySelector('${W} .mg-card .mg-t b')?.textContent === "Keller kalt"`));
    await tap('[data-mg="save"]');
    check(`[${tag}] gespeichert: Liste mit Hinweis`, await wait(`return r.querySelector('${root} .mg-flash')?.textContent.trim() === ${JSON.stringify(T.saved)} && r.querySelectorAll('${root} .mg-card').length === 1`));
    const saved = (await calls("magic_save")).at(-1)?.rule;
    check(`[${tag}] Server bekommt alle Felder`, saved && saved.entity_id === "sensor.temp" && saved.kind === "below" && saved.value === 12 && saved.for_s === 2700 && saved.repeat_s === 10800 && saved.recover === true && saved.recover_message === "Keller wieder warm: {value} {unit}" && saved.message === "Keller kalt: {value} {unit} (unter {threshold}) ✔" && saved.target === "notify.familie" && saved.reset_value === 14 && saved.critical === true && saved.critical_volume === 7 && saved.body === "Aktuell {value} {unit}\nSchwelle {threshold} {unit}" && saved.recover_body === "Wieder {value} {unit} nach {duration}" && saved.name === "Keller kalt" && saved.device_id === "d", JSON.stringify(saved));
    check(`[${tag}] Reiter zeigt "${T.active1}"`, await wait(`return r.querySelector('.sub-tab[data-tab="magic"] .tab-s')?.textContent.trim() === ${JSON.stringify(T.active1)}`));
    check(`[${tag}] Karte: Name, Satz, noch nie ausgelöst`, (await text(`${root} .mg-card .mg-t b`)) === "Keller kalt" && (await text(`${root} .mg-card .mg-t small`)).includes("12") && (await text(`${root} .mg-status`)).includes(T.never));
    check(`[${tag}] Karte nennt den Rücksetzwert`, (await text(`${root} .mg-card .mg-t small`)).includes(lang === "de" ? "zurück ab 14 °C" : "back from 14 °C"), await text(`${root} .mg-card .mg-t small`));
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
    await headingOk(T.q1b);
    check(`[${tag}] Bearbeiten: Schrittleiste antippbar, Bedingung "Temperatur" offen`, (await ev(`return r.querySelectorAll('${W} button.mg-stp').length`)) === 5 && (await text(`${W} .mg-lcard.open .mg-t b`)) === "Temperatur");
    check(`[${tag}] Bearbeiten: eigener Rücksetzwert 14 ist da`, await wait(`return r.querySelector('${W} [data-mg="reset-mode"][data-own="1"]')?.classList.contains("on") && r.querySelector('${W} input[data-mg="reset-value"]').value === "14"`));
    await tap('button.mg-stp[data-step="2"]');
    check(`[${tag}] Bearbeiten: Schritt 2 hat die Dauer 45 Min.`, await wait(`return r.querySelector('${W} input[data-mg="for-own"]').value === "45"`));
    await tap('button.mg-stp[data-step="5"]');
    await headingOk(T.q5);
    check(`[${tag}] Sprung zu Schritt 5: Name, Text und Empfänger übernommen`, (await ev(`return r.querySelector('${W} input[data-mg="name"]').value`)) === "Kellertemperatur");
    await tap('button.mg-stp[data-step="3"]');
    check(`[${tag}] Schritt 3 übernimmt Gruppe, Wiederholung und kritische Mitteilung`, (await text(`${W} .mg-sel`)).includes("notify.familie") && (await ev(`return r.querySelector('${W} input[data-mg="repeat-own"]').value`)) === "3" && (await ev(`return r.querySelector('${W} input[data-mg="critical"]').checked && r.querySelector('${W} input[data-mg="volume"]').value === "7"`)));
    await tap('button.mg-stp[data-step="4"]');
    check(`[${tag}] Schritt 4 übernimmt Titel, Inhalt und den "wieder normal"-Text`, (await ev(`return r.querySelector('${W} [data-mg-text="recover_message"]').value`)) === "Keller wieder warm: {value} {unit}" && (await ev(`return r.querySelector('${W} [data-mg-text="message"]').value.length > 0`)));
    await tap('button.mg-stp[data-step="5"]');
    await fill('input[data-mg="name"]', "Keller zu kalt");
    await tap('[data-mg="save"]');
    await wait(`return r.querySelector('${root} .mg-card .mg-t b')?.textContent === "Keller zu kalt"`);
    check(`[${tag}] Bearbeiten speichert dieselbe Meldung (id), keine zweite`, (await ev(`return r.querySelectorAll('${root} .mg-card').length`)) === 1 && (await calls("magic_save")).at(-1)?.rule.id === renamed.id);

    // --- Assistent, Zustand (Fenster) ---
    await tap('[data-mg="add"]');
    await tap('.mg-pick[data-id="binary_sensor.window"]');
    await headingOk(T.q1b);
    const kinds = await ev(`return [...r.querySelectorAll('${W} .sub-tabs [data-mg="kind"]')].map(b => b.dataset.kind).join()`);
    check(`[${tag}] Zustand: nur "ist" und "ändert sich" (allein), Wörter der Entität`, kinds === "is,change" && (await ev(`return [...r.querySelectorAll('${W} [data-mg="state"]')].map(b => b.textContent.trim()).join()`)) === (lang === "de" ? "offen,geschlossen" : "open,closed"));
    check(`[${tag}] Zustand: Balken statt Linie`, await wait(`return !!r.querySelector('${W} .mg-lcard .mg-bar span') && !r.querySelector('${W} svg.mg-spark')`));
    await tap('[data-mg="state"][data-v="on"]');
    await tap('[data-mg="reset-mode"][data-own="1"]');
    check(`[${tag}] Zustand: Rücksetzzustand zur Wahl, Vorschlag ist der andere Zustand`, await wait(`return [...r.querySelectorAll('${W} [data-mg="reset-state"]')].length === 2 && r.querySelector('${W} [data-mg="reset-state"].on')?.dataset.v === "off"`));
    check(`[${tag}] Zustand: Hinweis nennt das Wort`, (await text(`${W} [data-mg-zone="resethint"]`)).includes(lang === "de" ? "geschlossen" : "closed"), await text(`${W} [data-mg-zone="resethint"]`));
    await next();
    await fill('input[data-mg="for-own"]', "45");
    await next();
    await next();
    check(`[${tag}] Zustand: Variablen nur {value}`, await wait(`return [...r.querySelectorAll('${W} .mg-chips button.sug')].map(b => b.dataset.var).join() === "value"`));
    // Kein Verlauf: leer und ohne Recorder (der Rückblick steht in Schritt 2)
    await tap('[data-mg="back"]');
    await tap('[data-mg="back"]');
    await p.evaluate(() => { window.__magicHist = "empty"; });
    await tap('[data-mg="for"][data-s="300"]');
    check(`[${tag}] Rückblick darf leer sein: "${T.none}"`, await wait(`return r.querySelector('${W} .mg-hist')?.textContent.includes(${JSON.stringify(T.none)})`));
    await p.evaluate(() => { window.__magicHist = "norecorder"; });
    await tap('[data-mg="for"][data-s="600"]');
    check(`[${tag}] ohne Recorder: Hinweis, kein Fehler`, await wait(`return r.querySelector('${W} .mg-hist')?.textContent.includes(${JSON.stringify(T.norec)})`));
    await p.evaluate(() => { window.__magicHist = null; });
    // "ändert sich": keine Wiederholung, kein "wieder normal", kein Rücksetzwert (nur als einzige Bedingung)
    await tap('[data-mg="back"]');
    await tap('[data-mg="kind"][data-kind="change"]');
    check(`[${tag}] ändert sich: kein Abschnitt "Zurücksetzen", keine Knöpfe zum Hinzufügen`, !(await ev(`return !!r.querySelector('${W} [data-mg="reset-mode"]') || !!r.querySelector('${W} [data-mg="add-cond"]')`)));
    await next();
    await next();
    check(`[${tag}] ändert sich: keine Wiederholung (Schritt 3)`, (await ev(`return !r.querySelector('${W} [data-mg="repeat"]')`)));
    await next();
    check(`[${tag}] ändert sich: Variablen old/new, kein "wieder normal" (Schritt 4)`, await wait(`return [...r.querySelectorAll('${W} .mg-chips button.sug')].map(b => b.dataset.var).join() === "value,unit,old,new" && !r.querySelector('${W} input[data-mg="recover"]')`));
    await next();
    // Speichern schlägt fehl: Fehler im Assistenten, nichts geht verloren
    await p.evaluate(() => { window.__magicSaveFails = "Dienst nicht erreichbar"; });
    await tap('[data-mg="save"]');
    check(`[${tag}] Fehler beim Speichern bleibt im Assistenten`, await wait(`return r.querySelector('${W} .dlg-error')?.textContent.includes(${JSON.stringify(T.saveErr)}) && r.querySelector('${W} input[data-mg="name"]')`));
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

    // --- Freie Entität (2.10.0): ganz unten in Schritt 1, jede Entität, die Meldung bleibt am Gerät ---
    await tap('[data-mg="add"]');
    check(`[${tag}] Schritt 1: "Freie Entität" ganz unten, zu`, (await ev(`const k=[...r.querySelectorAll('${W} .mg-pick')]; return k.at(-1)?.dataset.mg === "free-open" && !r.querySelector('${W} .mg-free')`)));
    await tap('[data-mg="free-open"]');
    check(`[${tag}] Suche öffnet mit Treffern aller Entitäten (auch fremder Geräte)`, await wait(`return r.querySelectorAll('${W} [data-mg="free-pick"]').length >= 6`));
    // Das Suchfeld scrollt nach oben, damit die Tastatur es nicht zudeckt (oben im Inhalt des Fensters, unter Kopf und Fortschritt)
    await p.waitForTimeout(900);
    const pos = await ev(`const i=r.querySelector('${W} input[data-mg="free-query"]').getBoundingClientRect(); const t=r.querySelector('${W} .mgw-body').getBoundingClientRect(); return [Math.round(i.top - t.top), r.activeElement === r.querySelector('${W} input[data-mg="free-query"]'), Math.round(t.height)]`);
    check(`[${tag}] Suchfeld: hat den Fokus und liegt in der oberen Hälfte des Inhalts`, pos[1] === true && pos[0] >= -2 && pos[0] <= pos[2] * 0.5, JSON.stringify(pos));
    // Handy mit Tastatur (simuliert über das visualViewport des obersten Fensters): das Fenster folgt der sichtbaren Fläche
    // und das Suchfeld liegt darin, auch wenn das Handy die Seite hochgeschoben hat (gemeldet 2026-10-11: zu weit gescrollt)
    if (mobile) {
      for (const [label, offset] of [["Tastatur unten", 0], ["Seite hochgeschoben", 260]]) {
        await ev(`const fake = { offsetTop: ${offset}, height: 480, addEventListener() {}, removeEventListener() {} }; r.host._topWindow = () => ({ visualViewport: fake, addEventListener() {}, removeEventListener() {} }); r.host._magic.fitWindow(); r.host._magic.revealField(r.querySelector('${W} input[data-mg="free-query"]'));`);
        await p.waitForTimeout(500);
        const kb = await ev(`const a=r.host._magic.visibleArea(); const d=r.querySelector("${W}").getBoundingClientRect(); const i=r.querySelector('${W} input[data-mg="free-query"]').getBoundingClientRect(); const n=r.querySelector('${W} .mgw-foot').getBoundingClientRect(); return { fit: Math.abs(d.top - a.top) <= 1 && Math.abs(d.bottom - a.bottom) <= 1, foot: n.bottom <= a.bottom + 1, input: i.top >= a.top && i.bottom <= a.bottom, small: a.bottom - a.top < innerHeight - 60, a, d: [d.top, d.bottom], i: [i.top, i.bottom] }`);
        check(`[${tag}] ${label}: Fenster passt in die sichtbare Fläche, Fusszeile und Suchfeld darin`, kb.fit && kb.foot && kb.input && kb.small, JSON.stringify(kb));
      }
      await ev(`delete r.host._topWindow; r.host._magic.fitWindow();`);
      check(`[${tag}] ohne Tastatur wieder volle Höhe`, (await ev(`return r.querySelector("${W}").style.getPropertyValue("--mgw-h") === "" && Math.round(r.querySelector("${W}").getBoundingClientRect().height) === innerHeight`)) === true);
    }
    await fill('input[data-mg="free-query"]', "garten regen");
    check(`[${tag}] Suche nach mehreren Wörtern (Gerät und Name)`, await wait(`const l=[...r.querySelectorAll('${W} [data-mg="free-pick"]')].map(b=>b.dataset.id); return l.length === 1 && l[0] === "binary_sensor.garten_regen"`));
    check(`[${tag}] Treffer nennt Entitäts-ID und Gerät`, (await text(`${W} [data-mg="free-pick"]`)).includes("binary_sensor.garten_regen") && (await text(`${W} [data-mg="free-pick"]`)).includes("Wetterstation Garten"));
    await fill('input[data-mg="free-query"]', "ohne treffer xyz");
    check(`[${tag}] ohne Treffer: Hinweis`, await wait(`return !!r.querySelector('${W} [data-mg-zone="freelist"] .mg-hint')`));
    await fill('input[data-mg="free-query"]', "absolut");
    await wait(`return r.querySelectorAll('${W} [data-mg="free-pick"]').length === 1`);
    await tap('[data-mg="free-pick"][data-id="sensor.abs_humidity"]');
    check(`[${tag}] gewählt: Bedingung der freien Entität offen, Suche zu, "Weiter" frei`, await wait(`const c=r.querySelector('${W} .mg-lcard.open'); return c?.textContent.includes("Absolute Feuchte berechnet") && !r.querySelector('${W} .mg-free') && r.querySelector('${W} [data-mg="next"]').disabled === false`));
    check(`[${tag}] Bedingung nimmt Art, Einheit und Wert der freien Entität`, (await text(`${W} .mg-unit`)).includes("g/m³") && (await ev(`return r.querySelector('${W} input[data-mg="value"]').value`)) === "9.2");
    await tap('[data-mg="kind"][data-kind="above"]');
    await fill('input[data-mg="value"]', "10");
    await next();
    await next();
    await next();
    check(`[${tag}] Titel-Vorgabe nutzt den Namen der freien Entität`, await wait(`return r.querySelector('${W} [data-mg-text="message"]').value.includes("{entity}")`));
    await fill('[data-mg-text="message"]', "{device}: {entity} {value} {unit}");
    check(`[${tag}] Vorschau: {device} bleibt das Gerät, {entity} und Wert kommen von der freien Entität`, await wait(`const t=r.querySelector('${W} .mg-pv .pv-title')?.textContent; return t?.startsWith("Klimasensor Keller: Absolute Feuchte berechnet") && t.endsWith("g/m³")`), await text(`${W} .mg-pv .pv-title`));
    await next();
    await fill('input[data-mg="name"]', "Feuchte hoch");
    await tap('[data-mg="save"]');
    await wait(`return r.querySelectorAll('${root} .mg-card').length === 2`);
    const freeSaved = (await calls("magic_save")).at(-1)?.rule;
    check(`[${tag}] gespeichert: Entität der freien Wahl, Gerät bleibt dasselbe`, freeSaved.entity_id === "sensor.abs_humidity" && freeSaved.device_id === "d" && freeSaved.kind === "above", JSON.stringify(freeSaved));
    check(`[${tag}] Karte nennt die Entität (frei)`, await wait(`return [...r.querySelectorAll('${root} .mg-card')].some(c => c.textContent.includes("Feuchte hoch") && c.querySelector(".mg-freetag")?.textContent.includes("sensor.abs_humidity"))`));
    await tap('.mg-card:has(.mg-freetag) [data-mg="edit"]');
    check(`[${tag}] Bearbeiten: Bedingung der freien Entität ist offen`, await wait(`return (r.querySelector('${W} .mg-lcard.open .mg-t b')?.textContent || "") === "Absolute Feuchte berechnet"`));
    // Zustand als freie Entität (Regen): Entität der Bedingung ändern, Wörter der Entität, "ist"
    await tap('[data-mg="leaf-entity"]');
    await tap('[data-mg="free-open"]');
    await fill('input[data-mg="free-query"]', "regen");
    await wait(`return r.querySelectorAll('${W} [data-mg="free-pick"]').length === 1`);
    await tap('[data-mg="free-pick"][data-id="binary_sensor.garten_regen"]');
    check(`[${tag}] freier Zustand: "ist" und "ändert sich", Wörter der Entität`, (await ev(`return [...r.querySelectorAll('${W} .sub-tabs [data-mg="kind"]')].map(b => b.dataset.kind).join()`)) === "is,change" && (await ev(`return [...r.querySelectorAll('${W} [data-mg="state"]')].map(b => b.textContent.trim()).join()`)) === (lang === "de" ? "nass,trocken" : "wet,dry"));
    check(`[${tag}] Schritt 1 mit Bedingung ohne Querscrollen`, (await overflow()) <= 0);
    await tap('[data-mg="cancel"]');
    check(`[${tag}] Abbrechen mit Änderungen fragt nach "${T.discard}"`, await wait(`return r.querySelector('${W} .mgw-discard b')?.textContent.trim() === ${JSON.stringify(T.discard)} && !r.querySelector('${W} [data-mg="next"]')`));
    await tap('[data-mg="discard-no"]');
    check(`[${tag}] "Weiter bearbeiten": Fenster und Stand bleiben`, await wait(`return !r.querySelector('${W} .mgw-discard') && r.querySelector("${W}").open && !!r.querySelector('${W} .mg-lcard.open')`));
    await p.keyboard.press("Escape");
    check(`[${tag}] Escape fragt ebenfalls nach, schliesst das Fenster nicht`, await wait(`return !!r.querySelector('${W} .mgw-discard') && r.querySelector("${W}").open`));
    await p.keyboard.press("Escape");
    check(`[${tag}] Escape bei der Rückfrage geht zurück ins Bearbeiten`, await wait(`return !r.querySelector('${W} .mgw-discard') && r.querySelector("${W}").open`));
    await tap('[data-mg="close"]');
    await tap('[data-mg="discard-yes"]');
    check(`[${tag}] "Verwerfen" schliesst das Fenster, Popup bleibt offen, Liste unverändert`, await wait(`return !r.querySelector("${W}").open && r.querySelector("dialog.device").open && !!r.querySelector('${root} [data-mg="add"]')`) && (await ev(`return r.querySelectorAll('${root} .mg-card').length`)) === 2);
    await tap('.mg-card:has(.mg-freetag) [data-mg="delete"]');
    await tap('[data-mg="delete-yes"]');
    await wait(`return r.querySelectorAll('${root} .mg-card').length === 1`);

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
