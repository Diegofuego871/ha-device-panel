// Routine (2.21.0): fünfter Reiter im Geräte-Popup (auf dem Handy Symbole), Liste im Wecker-Stil (Zähler im Reiter),
// Assistent in vier Schritten (Was · Wann · Meldung · Name und Prüfung) für Countdown, Einmal und Wiederholt
// (täglich, wöchentlich, monatlich), Zurückschalten, eigene Zeit, Fehler im Bereich, Push mit Empfänger und Vorschau,
// Test senden, Speichern, Ein-/Ausschalten, Ausführen, Löschen mit Bestätigung, Bearbeiten mit Rückfrage beim
// Schliessen, keine schaltbare Entität, Übersicht in den Einstellungen (Suche, Filter, Einklappen, Bearbeiten,
// Optionen). Deutsch und Englisch, Desktop und Handy, echte Eingaben und Taps.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { infoFail1: "keine anhaltende Benachrichtigung", infoFail2: "dreimal versucht", infoFail3: "Push-Ziel", dateSwitch: "Bestimmtes Datum", onceNoDate: "Ohne Datum schaltet die Routine beim nächsten Eintreffen der Uhrzeit", plug: "Steckdose", look: "Ansicht", tab: "Routinen", add: "Neue Routine", q1: "Was soll geschaltet werden?", q2: "Wann soll geschaltet werden?", q3: "Soll eine Push-Meldung kommen?", q4: "Name und Prüfung", step1: "Schritt 1 von 5", step4: "Schritt 5 von 5",
    empty: "Noch keine Routinen", noEnt: "keine Entität, die eine Routine schalten kann", daily: "Täglich", weekly: "Wöchentlich", monthly: "Monatlich", def: "Standard aus den Einstellungen", pushTitle: "⏱️ Routine: Bewässerung",
    one: "1 aktiv", delAsk: "Routine \"Bewässerung\" löschen?", discard: "Änderungen verwerfen?", sec: "Routinen", pauseLabel: "Alle Routinen pausieren", saved: "Routine gespeichert.", running: "läuft", hit: "1 von 2" },
  en: { infoFail1: "not a persistent notification", infoFail2: "tried three times", infoFail3: "push target", dateSwitch: "Specific date", onceNoDate: "Without a date the routine switches the next time the clock reaches this time", plug: "Plug", look: "View", tab: "Routines", add: "New routine", q1: "What should be switched?", q2: "When should it switch?", q3: "Should a push notification come?", q4: "Name and check", step1: "Step 1 of 5", step4: "Step 5 of 5",
    empty: "No routines yet", noEnt: "no entity a routine can switch", daily: "Daily", weekly: "Weekly", monthly: "Monthly", def: "Default from the settings", pushTitle: "⏱️ Routine: Bewässerung",
    one: "1 on", delAsk: "Delete routine \"Bewässerung\"?", discard: "Discard changes?", sec: "Routines", pauseLabel: "Pause all routines", saved: "Routine saved.", running: "running", hit: "1 of 2" },
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
    const ev = (c, arg) => f.evaluate(new Function("arg", `const r=${R};` + c), arg);
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
    const calls = (type) => p.evaluate((t) => window.__wsCalls.filter((m) => m.type === t), type);
    const win = 'dialog.routine-dlg';
    const nextBtn = `${win} [data-rt="nav-next"]`;
    const disabled = (sel) => ev(`return !!r.querySelector(${JSON.stringify(sel)})?.disabled`);
    const cardsText = () => text(".rt-root");

    // --- Reiter ------------------------------------------------------------------------------------------------
    await tap('.dev[data-open="d"]');
    await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device [data-tab="routine"]')`);
    const tabs = await ev(`return [...r.querySelectorAll("dialog.device .sub-tabs > button")].map((b) => b.dataset.tab).join()`);
    check(`[${tag}] fünf Reiter, Routine als letzter`, tabs === "ov,set,ent,magic,routine", tabs);
    const fit = await ev(`const bar = r.querySelector("dialog.device .sub-tabs"); return [bar.scrollWidth <= bar.clientWidth + 1, [...bar.querySelectorAll("button")].every((b) => b.getBoundingClientRect().top === bar.querySelector("button").getBoundingClientRect().top)]`);
    check(`[${tag}] alle Reiter in einer Zeile ohne Überlauf`, fit[0] && fit[1], JSON.stringify(fit));
    await tap('dialog.device [data-tab="routine"]');
    check(`[${tag}] Reiter "${T.tab}": Kopf und Hinweis`, await wait(`return r.querySelector(".rt-root h3")?.textContent === ${JSON.stringify(T.tab)} && r.querySelector(".rt-root .mg-add")`));
    check(`[${tag}] leer: "${T.empty}"`, (await cardsText()).includes(T.empty));
    if (mobile) {
      const lab = await ev(`const on = r.querySelector('dialog.device .sub-tab.on'); const other = r.querySelector('dialog.device .sub-tab[data-tab="ent"]'); return [on.textContent.trim(), getComputedStyle(other).fontSize, getComputedStyle(on, "::before").content]`);
      check(`[${tag}] Handy: gewählter Reiter mit Beschriftung, die anderen nur Symbol`, lab[0] === T.tab && lab[1] === "0px", JSON.stringify(lab));
    }

    // --- Assistent: Schritt 1 ------------------------------------------------------------------------------------
    await tap('.rt-root [data-rt="add"]');
    check(`[${tag}] Fenster offen, Schritt 1`, await wait(`return r.querySelector("dialog.routine-dlg")?.open && r.querySelector("dialog.routine-dlg .mg-big")?.textContent === ${JSON.stringify(T.q1)}`) && (await text(`${win} .mg-stephead span`)) === T.step1);
    check(`[${tag}] zwei schaltbare Entitäten, Weiter gesperrt`, (await ev(`return r.querySelectorAll("dialog.routine-dlg .mg-pick").length`)) === 2 && await disabled(nextBtn));
    await tap(`${win} .mg-pick[data-id="switch.plug"]`);
    check(`[${tag}] Steckdose gewählt, Aktion sichtbar, das Zurückschalten steht nicht mehr hier`, await wait(`return !r.querySelector('dialog.routine-dlg [data-rt="nav-next"]').disabled && r.querySelectorAll('dialog.routine-dlg [data-rt="action"]').length === 3 && !r.querySelector('dialog.routine-dlg [data-rt="bdur"]')`));
    await tap(`${win} [data-rt="action"][data-v="toggle"]`);
    check(`[${tag}] Umschalten: kein Zurückschalten, eine Seite weniger (Schritt 1 von 4)`, await wait(`return !!r.querySelector("dialog.routine-dlg .mg-hint") && r.querySelector("dialog.routine-dlg .mg-stephead span")?.textContent.includes(${JSON.stringify(lang === "de" ? "von 4" : "of 4")})`));
    await tap(`${win} [data-rt="action"][data-v="on"]`);
    check(`[${tag}] Einschalten: wieder fünf Schritte`, await wait(`return r.querySelector("dialog.routine-dlg .mg-stephead span")?.textContent === ${JSON.stringify(T.step1)}`));
    await p.screenshot({ path: `${outDir}/routine-w1-${tag.replace("/", "-")}.png` });
    await tap(nextBtn);

    // --- Schritt 2: Wann -----------------------------------------------------------------------------------------
    check(`[${tag}] Schritt 2: "${T.q2}", Wiederholt täglich 06:30, Vorschau mit drei Läufen`, await wait(`return r.querySelector("dialog.routine-dlg .mg-big")?.textContent === ${JSON.stringify(T.q2)} && r.querySelector('dialog.routine-dlg [data-rt="time"]').value === "06:30" && r.querySelectorAll("dialog.routine-dlg .rt-next div").length === 3`));
    await tap(`${win} [data-rt="repeat"][data-v="weekly"]`);
    check(`[${tag}] wöchentlich: Wochentage Mo bis Fr, Vorschau nur an diesen Tagen`, await wait(`return r.querySelectorAll('dialog.routine-dlg [data-rt="wd"].on').length === 5 && r.querySelectorAll("dialog.routine-dlg .rt-next div").length === 3`));
    await tap(`${win} [data-rt="wd"][data-d="1"]`);
    await tap(`${win} [data-rt="wd"][data-d="3"]`);
    check(`[${tag}] Di und Do abgewählt: Mo, Mi, Fr`, await wait(`return [...r.querySelectorAll('dialog.routine-dlg [data-rt="wd"].on')].map((b) => b.dataset.d).join() === "0,2,4"`));
    for (const d of [0, 2, 4]) await tap(`${win} [data-rt="wd"][data-d="${d}"]`);
    check(`[${tag}] kein Wochentag: Weiter gesperrt`, await wait(`return r.querySelector('dialog.routine-dlg [data-rt="nav-next"]').disabled`));
    for (const d of [0, 2, 4]) await tap(`${win} [data-rt="wd"][data-d="${d}"]`);
    await tap(`${win} [data-rt="repeat"][data-v="monthly"]`);
    check(`[${tag}] monatlich: Tag des Monats (1. gewählt), Vorschau am 1.`, await wait(`return r.querySelector('dialog.routine-dlg [data-rt="mday"][data-v="1"]').classList.contains("on") && [...r.querySelectorAll("dialog.routine-dlg .rt-next div span:first-child")].every((s) => /\\b1\\b/.test(s.textContent))`), await text(`${win} .rt-next`));
    await tap(`${win} [data-rt="mday"][data-v="last"]`);
    check(`[${tag}] letzter Tag des Monats`, await wait(`return r.querySelector('dialog.routine-dlg [data-rt="mday"][data-v="last"]').classList.contains("on")`));
    await tap(`${win} [data-rt="mday"][data-v="own"]`);
    await fill(`${win} [data-rt="mday-own"]`, "31");
    check(`[${tag}] anderer Tag: 31.`, await wait(`return r.querySelector('dialog.routine-dlg [data-rt="mday-own"]').value === "31" && !r.querySelector('dialog.routine-dlg [data-rt="nav-next"]').disabled`));
    await tap(`${win} [data-rt="kind"][data-v="countdown"]`);
    check(`[${tag}] In …: Voreinstellungen, "Läuft ab" eine Zeile`, await wait(`return r.querySelectorAll('dialog.routine-dlg [data-rt="delay"]').length === 4 && r.querySelectorAll("dialog.routine-dlg .rt-next div").length === 1`));
    await fill(`${win} [data-rt="delay-own"]`, "0.01");
    check(`[${tag}] zu kurze Dauer: Fehler, Weiter gesperrt`, await wait(`return !!r.querySelector('dialog.routine-dlg [data-rt-err="delay"]:not([hidden])') && r.querySelector('dialog.routine-dlg [data-rt="nav-next"]').disabled`));
    await tap(`${win} [data-rt="delay"][data-s="1800"]`);
    await tap(`${win} [data-rt="kind"][data-v="once"]`);
    // Seit 2.22.0 gilt ohne Datum das nächste Eintreffen der Uhrzeit (Standard); der Schalter "Bestimmtes Datum" setzt zuerst morgen ein
    check(`[${tag}] Einmal: Schalter "${T.dateSwitch}" aus, kein Datumsfeld, Hinweis ohne Datum, eine Vorschau, Weiter frei`, await wait(`const s = r.querySelector('dialog.routine-dlg [data-rt="date-on"]'); return !!s && !s.checked && !r.querySelector('dialog.routine-dlg [data-rt="date"]') && r.querySelectorAll("dialog.routine-dlg .rt-next div").length === 1 && !r.querySelector('dialog.routine-dlg [data-rt="nav-next"]').disabled && r.querySelector("dialog.routine-dlg .mg-hint").textContent.includes(${JSON.stringify(T.onceNoDate)})`), await text(`${win} .mg-hint`));
    check(`[${tag}] Vorschau: nächstes Mal um 06:30`, await wait(`return (r.querySelector("dialog.routine-dlg .rt-next")?.textContent || "").includes("06:30")`), await text(`${win} .rt-next`));
    await tap(`${win} [data-rt="date-on"]`);
    check(`[${tag}] Schalter an: Datumsfeld mit dem morgigen Datum, Vorschau morgen`, await wait(`const d = r.querySelector('dialog.routine-dlg [data-rt="date"]'); const rt = new Date(Date.parse(${JSON.stringify("")} || (r.host._routines.data?.today || "") + "T00:00:00Z") + 86400000).toISOString().slice(0, 10); return !!d && d.value === rt && r.querySelector('dialog.routine-dlg [data-rt="date-on"]').checked && !r.querySelector('dialog.routine-dlg [data-rt="nav-next"]').disabled`));
    await ev(`const i = r.querySelector('dialog.routine-dlg [data-rt="date"]'); i.value = "2020-01-01"; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true }));`);
    check(`[${tag}] Datum in der Vergangenheit: Fehler vom Server, Weiter gesperrt`, await wait(`return !!r.querySelector("dialog.routine-dlg .opt-error") && r.querySelector('dialog.routine-dlg [data-rt="nav-next"]').disabled`));
    await tap(`${win} [data-rt="date-on"]`);
    check(`[${tag}] Schalter aus: Datumsfeld weg, Fehler weg, Weiter frei`, await wait(`return !r.querySelector('dialog.routine-dlg [data-rt="date"]') && !r.querySelector("dialog.routine-dlg .opt-error") && !r.querySelector('dialog.routine-dlg [data-rt="nav-next"]').disabled`));
    await tap(`${win} [data-rt="kind"][data-v="repeat"]`);
    await tap(`${win} [data-rt="repeat"][data-v="weekly"]`);
    await p.screenshot({ path: `${outDir}/routine-w2-${tag.replace("/", "-")}.png` });
    await tap(nextBtn);

    // --- Schritt 3 (Zurückschalten, seit 2.54.0 eine eigene Seite) -------------------------------------------------
    check(`[${tag}] Seite Zurückschalten: Reiterleiste Nie / Nach Dauer / Zu einer Zeit / Durch Auslöser, Standard Nie`, await wait(`return r.querySelectorAll('dialog.routine-dlg [data-rt="backkind"]').length === 4 && r.querySelector('dialog.routine-dlg [data-rt="backkind"][data-v="none"]').classList.contains("on")`));
    await tap(`${win} [data-rt="backkind"][data-v="duration"]`);
    check(`[${tag}] Nach Dauer: vier Voreinstellungen, "Danach zurück auf" Ausschalten/Wie vorher`, await wait(`return r.querySelectorAll('dialog.routine-dlg [data-rt="bdur"]').length === 4 && r.querySelectorAll('dialog.routine-dlg [data-rt="bmode"]').length === 2`));
    await tap(`${win} [data-rt="bdur"][data-s="1800"]`);
    await fill(`${win} [data-rt="back-own"]`, "20");
    check(`[${tag}] eigene Zeit 20 Min.: Satz mit "wieder aus"`, await wait(`return /20 (Min\\.|min)/.test(r.querySelector("dialog.routine-dlg .mg-sumline")?.textContent || "") && !r.querySelector('dialog.routine-dlg [data-rt="bdur"].on, dialog.routine-dlg [data-rt="bdur"][aria-checked="true"]')`), await text(`${win} .mg-sumline`));
    // Dauer auf die Minute genau (2.26.0): 690 Min. = 11 Std. 30 Min., nicht "11 Std."
    await fill(`${win} [data-rt="back-own"]`, "690");
    check(`[${tag}] 690 Min.: Satz zeigt "11 ${lang === "de" ? "Std." : "h"} 30 ${lang === "de" ? "Min." : "min"}"`, await wait(`return (r.querySelector("dialog.routine-dlg .mg-sumline")?.textContent || "").includes(${JSON.stringify(lang === "de" ? "11 Std. 30 Min." : "11 h 30 min")})`), await text(`${win} .mg-sumline`));
    await fill(`${win} [data-rt="back-own"]`, "1.5");
    check(`[${tag}] 1,5 Min.: "1 ${lang === "de" ? "Min. 30 Sek." : "min 30 s"}"`, await wait(`return (r.querySelector("dialog.routine-dlg .mg-sumline")?.textContent || "").includes(${JSON.stringify(lang === "de" ? "1 Min. 30 Sek." : "1 min 30 s")})`), await text(`${win} .mg-sumline`));
    await fill(`${win} [data-rt="back-own"]`, "0.01");
    check(`[${tag}] zu kurze Zeit: Fehler am Feld, Weiter gesperrt`, await wait(`return !!r.querySelector('dialog.routine-dlg [data-rt-err="back"]:not([hidden])')`) && await disabled(nextBtn));
    await fill(`${win} [data-rt="back-own"]`, "20");
    await p.screenshot({ path: `${outDir}/routine-w2b-${tag.replace("/", "-")}.png` });
    await tap(nextBtn);

    // --- Schritt 3: Meldung --------------------------------------------------------------------------------------
    check(`[${tag}] Schritt 3: Meldung aus, kein Empfänger`, await wait(`return r.querySelector("dialog.routine-dlg .mg-big")?.textContent === ${JSON.stringify(T.q3)} && !r.querySelector('dialog.routine-dlg [data-rt="push"]').checked && !r.querySelector('dialog.routine-dlg [data-rt="target-toggle"]')`));
    await tap(`${win} [data-rt="push"]`);
    check(`[${tag}] Push an: Empfänger "${T.def}", Vorschau mit festem Text`, await wait(`return r.querySelector('dialog.routine-dlg [data-rt="target-toggle"] span')?.textContent.startsWith(${JSON.stringify(T.def)}) && r.querySelector("dialog.routine-dlg .pv-title")?.textContent === ${JSON.stringify("⏱️ Routine: " + T.plug)} && /Steckdose|Plug/.test(r.querySelector("dialog.routine-dlg .pv-text")?.textContent || "")`), await text(`${win} .pv-card`));
    await tap(`${win} [data-rt="target-toggle"]`);
    check(`[${tag}] Liste: Standard, Gruppen, Dienste, Entitäten`, await wait(`return r.querySelectorAll('dialog.routine-dlg [data-rt="target"]').length === 5 && !!r.querySelector("dialog.routine-dlg .mg-opt-head")`));
    await tap(`${win} [data-rt="target"][data-v="notify.familie"]`);
    check(`[${tag}] Gruppe "Familie" gewählt`, await wait(`return r.querySelector('dialog.routine-dlg [data-rt="target-toggle"] span')?.textContent.startsWith("Familie")`));
    await tap(`${win} [data-rt="test"]`);
    check(`[${tag}] Test senden: Aufruf mit dem Entwurf, Rückmeldung`, await wait(`return /Familie/.test(r.querySelector("dialog.routine-dlg .mg-testrow")?.textContent || "")`) && (await calls("device_panel/routine_test")).at(-1)?.routine.target === "notify.familie");
    await p.screenshot({ path: `${outDir}/routine-w3-${tag.replace("/", "-")}.png` });
    await tap(nextBtn);

    // --- Schritt 4: Name und Prüfung -----------------------------------------------------------------------------
    check(`[${tag}] Schritt 4: Satz mit Wochentagen, Push-Zeile, nächste Ausführung`, await wait(`return r.querySelector("dialog.routine-dlg .mg-big")?.textContent === ${JSON.stringify(T.q4)} && !!r.querySelector("dialog.routine-dlg .rt-sum") && /Familie/.test(r.querySelector("dialog.routine-dlg .rt-sum").textContent) && !!r.querySelector("dialog.routine-dlg .rt-next div")`), await text(`${win} .rt-sum`));
    check(`[${tag}] Schritt 4: zu jeder Ausführung steht, wann es wieder ${lang === "de" ? "aus" : "off"} geht (06:30 + 20 Min. = 06:50)`, await wait(`const s = [...r.querySelectorAll("dialog.routine-dlg .rt-next small")]; return s.length === 1 && s[0].textContent.includes("06:50") && s[0].textContent.startsWith(${JSON.stringify(lang === "de" ? "wieder aus" : "back off")})`), await text(`${win} .rt-next`));
    await fill(`${win} [data-rt="name"]`, "Bewässerung");
    await p.screenshot({ path: `${outDir}/routine-w4-${tag.replace("/", "-")}.png` });
    await tap(`${win} [data-rt="nav-save"]`);
    check(`[${tag}] gespeichert: Fenster zu, Karte in der Liste`, await wait(`return !r.querySelector("dialog.routine-dlg").open && r.querySelectorAll(".rt-root .rt-clock").length === 1`));
    const saved = (await calls("device_panel/routine_save")).at(-1)?.routine;
    check(`[${tag}] routine_save: Entität, Aktion, 20 Min. zurück, wöchentlich Mo, Mi, Fr 06:30, Push an Familie`, saved && saved.entity_id === "switch.plug" && saved.action === "on" && saved.back_s === 1200 && saved.kind === "repeat" && saved.repeat === "weekly" && JSON.stringify(saved.weekdays) === "[0,2,4]" && saved.time === "06:30" && saved.push === true && saved.target === "notify.familie" && saved.name === "Bewässerung", JSON.stringify(saved));
    check(`[${tag}] Meldung "${T.saved}"`, (await cardsText()).includes(T.saved));
    check(`[${tag}] Karte: Uhrzeit, Name, Wochentage, nächster Lauf, Glocke`, await ev(`const c = r.querySelector(".rt-root .rt-clock"); return c.querySelector(".time").textContent.startsWith("06:30") && c.querySelector(".name").textContent.includes("Bewässerung") && c.querySelectorAll(".rt-days i.on").length === 3 && !!c.querySelector(".next b") && c.textContent.includes("🔔")`));
    check(`[${tag}] Reiter zeigt die Zahl (${T.one})`, (await text('dialog.device [data-tab="routine"]')).includes(T.one), await text('dialog.device [data-tab="routine"]'));
    await p.screenshot({ path: `${outDir}/routine-list-${tag.replace("/", "-")}.png` });

    // --- Liste: Aktionen -----------------------------------------------------------------------------------------
    const id = await ev(`return r.querySelector('.rt-root [data-rt="edit"]').dataset.id`);
    await tap('.rt-root [data-rt="toggle"]');
    check(`[${tag}] ausschalten: routine_enable false, Karte gedimmt, Reiter ohne Zahl`, await wait(`return r.querySelector(".rt-root .rt-clock").classList.contains("off")`) && (await calls("device_panel/routine_enable")).at(-1)?.enabled === false && await wait(`return !r.querySelector('dialog.device [data-tab="routine"]').textContent.includes(${JSON.stringify(T.one)})`), await text('dialog.device [data-tab="routine"]') + " / " + (await ev(`return r.querySelector(".rt-root .rt-clock").className`)));
    await tap('.rt-root [data-rt="toggle"]');
    check(`[${tag}] wieder ein`, await wait(`return !r.querySelector(".rt-root .rt-clock").classList.contains("off")`) && (await calls("device_panel/routine_enable")).at(-1)?.enabled === true);
    await tap('.rt-root [data-rt="run"]');
    check(`[${tag}] Ausführen: routine_run, zuletzt geschaltet`, await wait(`return /(zuletzt geschaltet|last switched)/.test(r.querySelector(".rt-root .rt-clock").textContent)`) && (await calls("device_panel/routine_run")).at(-1)?.routine_id === id);
    // Bearbeiten, ändern, schliessen: Rückfrage
    await tap('.rt-root [data-rt="edit"]');
    check(`[${tag}] Bearbeiten: Assistent bei Schritt 2 mit den Werten`, await wait(`return r.querySelector("dialog.routine-dlg")?.open && r.querySelector("dialog.routine-dlg .mg-big")?.textContent === ${JSON.stringify(T.q2)} && r.querySelectorAll('dialog.routine-dlg [data-rt="wd"].on').length === 3`));
    await tap(`${win} [data-rt="wd"][data-d="4"]`);
    await tap(`${win} [data-rt="close"]`);
    check(`[${tag}] Schliessen mit Änderung: Rückfrage "${T.discard}", Fenster bleibt`, (await wait(`return r.querySelector("dialog.discard-dlg").open`)) && (await ev(`return r.querySelector("dialog.routine-dlg").open`)));
    await tap('dialog.discard-dlg [data-dd="no"]');
    check(`[${tag}] Weiter bearbeiten: Entwurf bleibt`, await ev(`return r.querySelector("dialog.routine-dlg").open && r.querySelectorAll('dialog.routine-dlg [data-rt="wd"].on').length === 2`));
    await tap(`${win} [data-rt="close"]`);
    await tap('dialog.discard-dlg [data-dd="yes"]');
    check(`[${tag}] Verwerfen: zu, nichts gesendet`, await wait(`return !r.querySelector("dialog.routine-dlg").open`) && (await calls("device_panel/routine_save")).length === 1);
    // Ohne Änderung schliesst sofort
    await tap('.rt-root [data-rt="edit"]');
    await wait(`return r.querySelector("dialog.routine-dlg").open`);
    await tap(`${win} [data-rt="close"]`);
    check(`[${tag}] ohne Änderung ohne Rückfrage`, await wait(`return !r.querySelector("dialog.routine-dlg").open && !r.querySelector("dialog.discard-dlg").open`));
    // Speichern auf jeder Seite (2.24.0): ohne Durchklicken speichern und schliessen
    const nSave = (await calls("device_panel/routine_save")).length;
    await tap('.rt-root [data-rt="edit"]');
    await wait(`return r.querySelector("dialog.routine-dlg").open`);
    check(`[${tag}] Schritt 2: Knopf "Speichern" neben "Weiter", freigegeben`, await ev(`const q = r.querySelector('dialog.routine-dlg [data-rt="nav-quick"]'); return !!q && !q.disabled && !!r.querySelector('dialog.routine-dlg [data-rt="nav-next"]') && q.textContent.trim().length > 0`));
    await tap(`${win} [data-rt="wd"][data-d="4"]`);
    await tap(`${win} [data-rt="wd"][data-d="2"]`);
    await tap(`${win} [data-rt="wd"][data-d="0"]`);
    check(`[${tag}] ungültig (kein Wochentag): "Speichern" gesperrt`, await wait(`return r.querySelector('dialog.routine-dlg [data-rt="nav-quick"]').disabled`));
    await tap(`${win} [data-rt="wd"][data-d="1"]`);
    await tap(`${win} [data-rt="nav-quick"]`);
    check(`[${tag}] Speichern ohne Durchklicken: routine_save gesendet, Fenster zu`, await wait(`return !r.querySelector("dialog.routine-dlg").open`) && (await calls("device_panel/routine_save")).length === nSave + 1);

    // Zweiter Routine: Countdown läuft
    await tap('.rt-root [data-rt="add"]');
    await tap(`${win} .mg-pick[data-id="light.led"]`);
    await tap(nextBtn);
    await tap(`${win} [data-rt="kind"][data-v="countdown"]`);
    await tap(`${win} [data-rt="delay"][data-s="900"]`);
    await tap(nextBtn);
    await tap(nextBtn);
    await tap(nextBtn);
    await tap(`${win} [data-rt="nav-save"]`);
    check(`[${tag}] Countdown gespeichert: läuft mit Ring und Restzeit`, await wait(`return r.querySelectorAll(".rt-root .rt-clock").length === 2 && !!r.querySelector(".rt-root .rt-ring [data-rt-left]") && /\\d{2}:\\d{2}/.test(r.querySelector(".rt-root .rt-ring").textContent)`));
    const left1 = await text(".rt-root [data-rt-left]");
    await p.waitForTimeout(2200);
    const left2 = await text(".rt-root [data-rt-left]");
    check(`[${tag}] Restzeit zählt herunter`, left1 !== left2, `${left1} → ${left2}`);

    // Löschen mit Bestätigung
    await tap('.rt-root .rt-clock:has([data-rt-left]) [data-rt="delete"]');
    check(`[${tag}] Löschen fragt nach`, (await wait(`return !!r.querySelector(".rt-root .mg-confirm")`)) && (await text(".rt-root .mg-confirm b")) === T.delAsk.replace("Bewässerung", "LED-Ring"));
    await tap('.rt-root [data-rt="delete-no"]');
    check(`[${tag}] Nein: bleibt`, await ev(`return r.querySelectorAll(".rt-root .rt-clock").length === 2`));
    await tap('.rt-root .rt-clock:has([data-rt-left]) [data-rt="delete"]');
    await tap('.rt-root [data-rt="delete-yes"]');
    check(`[${tag}] Ja: gelöscht`, await wait(`return r.querySelectorAll(".rt-root .rt-clock").length === 1`) && (await calls("device_panel/routine_delete")).length === 1);

    // Fehler beim Ausführen
    await p.evaluate(() => { window.__routineRunFails = true; });
    await tap('.rt-root [data-rt="run"]');
    check(`[${tag}] Ausführen schlägt fehl: Meldung`, await wait(`return !!r.querySelector(".rt-root .dlg-error")`));
    await p.evaluate(() => { window.__routineRunFails = false; });

    // --- Übersicht in den Einstellungen --------------------------------------------------------------------------
    await tap('dialog.device [data-dlg="close"]');
    await wait(`return !r.querySelector("dialog.device").open`);
    // zweite Routine an einem anderen Gerät
    await tap('.dev[data-open="a"]');
    await wait(`return r.querySelector("dialog.device")?.open`);
    await tap('dialog.device [data-tab="routine"]');
    await wait(`return r.querySelector(".rt-root .mg-add")`);
    await tap('.rt-root [data-rt="add"]');
    await tap(`${win} .mg-pick[data-id="switch.plug"]`);
    await tap(nextBtn);
    await tap(`${win} [data-rt="repeat"][data-v="daily"]`);
    await tap(nextBtn);
    await tap(nextBtn);
    await tap(nextBtn);
    await fill(`${win} [data-rt="name"]`, "Nachtlicht");
    await tap(`${win} [data-rt="nav-save"]`);
    await wait(`return r.querySelectorAll(".rt-root .rt-clock").length === 1`);
    await tap('dialog.device [data-dlg="close"]');
    await wait(`return !r.querySelector("dialog.device").open`);
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    const titles = await ev(`return [...r.querySelectorAll("dialog.settings .set-sec-title")].map((e) => e.firstChild.textContent.trim()).join("|")`);
    check(`[${tag}] Abschnitt "${T.sec}" zwischen Überwachung und Ansicht`, titles.includes(`${T.sec}|`) && titles.indexOf(T.sec) > titles.indexOf(lang === "de" ? "Überwachung" : "Monitoring") && titles.indexOf(T.sec) < titles.indexOf(T.look), titles);
    await tap('[data-set="section"][data-id="routines"]');
    // Seit 2.23.1 steht die Sammlung aller Routinen im Fenster der Kopfzeile (Stoppuhr, Suite routineall); hier nur noch die Optionen
    check(`[${tag}] Abschnitt "${T.sec}": nur Optionen, keine Sammlung aller Routinen mehr`, await wait(`const d = r.querySelector("dialog.settings"); return !!d.querySelector('input[data-opt="routines_pause"]') && !d.querySelector(".mg-dcard, .mg-card, [data-lsearch], [data-rt-all-zone]") && ![...d.querySelectorAll("[data-set]")].some((e) => e.dataset.set.startsWith("routine-"))`));
    await p.screenshot({ path: `${outDir}/routine-settings-${tag.replace("/", "-")}.png` });
    // Meldung bei Fehler: genau beschrieben (Info-Knopf)
    await tap('dialog.settings [data-set="info"][data-key="routines_notify_error"]');
    check(`[${tag}] "Bei Fehler benachrichtigen": Info nennt Art, Zeitpunkt und Ziel der Meldung`, await wait(`const x = r.querySelector("dialog.settings .opt-info")?.textContent || ""; return x.includes(${JSON.stringify(T.infoFail1)}) && x.includes(${JSON.stringify(T.infoFail2)}) && x.includes(${JSON.stringify(T.infoFail3)})`), await text("dialog.settings .opt-info"));
    // Allgemein: Pause und Nachholen
    check(`[${tag}] Allgemein: Pause aus, Nachholen 10 Min., Fehlermeldung an`, await ev(`return !r.querySelector('dialog.settings input[data-opt="routines_pause"]').checked && r.querySelector('dialog.settings input[data-opt="routines_catch_up"]').value === "10" && r.querySelector('dialog.settings input[data-opt="routines_notify_error"]').checked`));
    check(`[${tag}] Empfänger die Routine: Auswahl vor der Fehlermeldung, Standard gewählt, "Kein Ziel" nicht wählbar`, await ev(`const s = r.querySelector('dialog.settings select[data-opt="notify_service_routines"]'); const n = r.querySelector('dialog.settings input[data-opt="routines_notify_error"]'); return !!s && s.value === "" && ![...s.options].some((o) => o.value === "none") && s.closest(".opt").compareDocumentPosition(n.closest(".opt")) & Node.DOCUMENT_POSITION_FOLLOWING`));
    { const h = await handle('dialog.settings select[data-opt="notify_service_routines"]'); await h.scrollIntoViewIfNeeded(); await h.selectOption("notify.familie"); }
    await tap('dialog.settings input[data-opt="routines_pause"]');
    await fill('dialog.settings input[data-opt="routines_catch_up"]', "30");
    check(`[${tag}] Entwurf: drei Änderungen, Abschnitt markiert`, await wait(`return r.querySelector('dialog.settings .set-count')?.textContent.includes("3")`));
    await tap('dialog.settings [data-set="save"]');
    await wait(`return r.querySelector("dialog.settings .set-count.saved")`);
    const so = (await calls("device_panel/set_options")).at(-1)?.values;
    check(`[${tag}] gespeichert: set_options mit Pause und 30 Min.`, so && so.routines_pause === true && so.routines_catch_up === 30 && so.notify_service_routines === "notify.familie", JSON.stringify(so));
    check(`[${tag}] Zusammenfassung zeigt "pausiert"`, /(pausiert|paused)/.test(await text('[data-id="routines"] .set-sec-sum')), await text('[data-id="routines"] .set-sec-sum'));
    await tap('dialog.settings .dlg-actions [data-set="close"]');

    // --- Gerät ohne schaltbare Entität -----------------------------------------------------------------------------
    await p.evaluate(() => { window.__routineEntities = { c: [] }; });
    await tap('.dev[data-open="c"]');
    await wait(`return r.querySelector("dialog.device")?.open`);
    await tap('dialog.device [data-tab="routine"]');
    check(`[${tag}] ohne schaltbare Entität: Hinweis, kein "${T.add}"`, await wait(`return !r.querySelector(".rt-root .mg-add") && r.querySelector(".rt-root .mg-empty")?.textContent.includes(${JSON.stringify(T.noEnt)})`), await cardsText());
    await tap('dialog.device [data-dlg="close"]');

    check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
