// Timer (2.21.0): fünfter Reiter im Geräte-Popup (auf dem Handy Symbole), Liste im Wecker-Stil (Zähler im Reiter),
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
  de: { plug: "Steckdose", look: "Darstellung", tab: "Timer", add: "Neuer Timer", q1: "Was soll geschaltet werden?", q2: "Wann soll geschaltet werden?", q3: "Soll eine Push-Meldung kommen?", q4: "Name und Prüfung", step1: "Schritt 1 von 4", step4: "Schritt 4 von 4",
    empty: "Noch keine Timer", noEnt: "keine Entität, die ein Timer schalten kann", daily: "Täglich", weekly: "Wöchentlich", monthly: "Monatlich", def: "Standard aus den Einstellungen", pushTitle: "⏱️ Timer: Bewässerung",
    one: "1 aktiv", delAsk: "Timer \"Bewässerung\" löschen?", discard: "Änderungen verwerfen?", sec: "Timer", pauseLabel: "Alle Timer pausieren", saved: "Timer gespeichert.", running: "läuft", hit: "1 von 2" },
  en: { plug: "Plug", look: "Appearance", tab: "Timer", add: "New timer", q1: "What should be switched?", q2: "When should it switch?", q3: "Should a push notification come?", q4: "Name and check", step1: "Step 1 of 4", step4: "Step 4 of 4",
    empty: "No timers yet", noEnt: "no entity a timer can switch", daily: "Daily", weekly: "Weekly", monthly: "Monthly", def: "Default from the settings", pushTitle: "⏱️ Timer: Bewässerung",
    one: "1 on", delAsk: "Delete timer \"Bewässerung\"?", discard: "Discard changes?", sec: "Timers", pauseLabel: "Pause all timers", saved: "Timer saved.", running: "running", hit: "1 of 2" },
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
    const win = 'dialog.timer-dlg';
    const nextBtn = `${win} [data-tm="nav-next"]`;
    const disabled = (sel) => ev(`return !!r.querySelector(${JSON.stringify(sel)})?.disabled`);
    const cardsText = () => text(".tm-root");

    // --- Reiter ------------------------------------------------------------------------------------------------
    await tap('.dev[data-open="d"]');
    await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device [data-tab="timer"]')`);
    const tabs = await ev(`return [...r.querySelectorAll("dialog.device .sub-tabs > button")].map((b) => b.dataset.tab).join()`);
    check(`[${tag}] fünf Reiter, Timer als letzter`, tabs === "ov,set,ent,magic,timer", tabs);
    const fit = await ev(`const bar = r.querySelector("dialog.device .sub-tabs"); return [bar.scrollWidth <= bar.clientWidth + 1, [...bar.querySelectorAll("button")].every((b) => b.getBoundingClientRect().top === bar.querySelector("button").getBoundingClientRect().top)]`);
    check(`[${tag}] alle Reiter in einer Zeile ohne Überlauf`, fit[0] && fit[1], JSON.stringify(fit));
    await tap('dialog.device [data-tab="timer"]');
    check(`[${tag}] Reiter "${T.tab}": Kopf und Hinweis`, await wait(`return r.querySelector(".tm-root h3")?.textContent === ${JSON.stringify(T.tab)} && r.querySelector(".tm-root .mg-add")`));
    check(`[${tag}] leer: "${T.empty}"`, (await cardsText()).includes(T.empty));
    if (mobile) {
      const lab = await ev(`const on = r.querySelector('dialog.device .sub-tab.on'); const other = r.querySelector('dialog.device .sub-tab[data-tab="ent"]'); return [on.textContent.trim(), getComputedStyle(other).fontSize, getComputedStyle(on, "::before").content]`);
      check(`[${tag}] Handy: gewählter Reiter mit Beschriftung, die anderen nur Symbol`, lab[0] === T.tab && lab[1] === "0px", JSON.stringify(lab));
    }

    // --- Assistent: Schritt 1 ------------------------------------------------------------------------------------
    await tap('.tm-root [data-tm="add"]');
    check(`[${tag}] Fenster offen, Schritt 1`, await wait(`return r.querySelector("dialog.timer-dlg")?.open && r.querySelector("dialog.timer-dlg .mg-big")?.textContent === ${JSON.stringify(T.q1)}`) && (await text(`${win} .mg-stephead span`)) === T.step1);
    check(`[${tag}] zwei schaltbare Entitäten, Weiter gesperrt`, (await ev(`return r.querySelectorAll("dialog.timer-dlg .mg-pick").length`)) === 2 && await disabled(nextBtn));
    await tap(`${win} .mg-pick[data-id="switch.plug"]`);
    check(`[${tag}] Steckdose gewählt, Aktion und Zurückschalten sichtbar`, await wait(`return !r.querySelector('dialog.timer-dlg [data-tm="nav-next"]').disabled && r.querySelectorAll('dialog.timer-dlg [data-tm="action"]').length === 3 && r.querySelectorAll('dialog.timer-dlg [data-tm="bdur"]').length === 4`));
    await tap(`${win} [data-tm="bdur"][data-s="1800"]`);
    await fill(`${win} [data-tm="back-own"]`, "20");
    check(`[${tag}] eigene Zeit 20 Min.: Satz mit "wieder aus"`, await wait(`return /20 (Min\\.|min)/.test(r.querySelector("dialog.timer-dlg .tm-result")?.textContent || "") && !r.querySelector('dialog.timer-dlg [data-tm="bdur"].on, dialog.timer-dlg [data-tm="bdur"][aria-checked="true"]')`), await text(`${win} .tm-result`));
    await fill(`${win} [data-tm="back-own"]`, "0.01");
    check(`[${tag}] zu kurze Zeit: Fehler am Feld, Weiter gesperrt`, await wait(`return !!r.querySelector('dialog.timer-dlg [data-tm-err="back"]:not([hidden])')`) && await disabled(nextBtn));
    await fill(`${win} [data-tm="back-own"]`, "20");
    await tap(`${win} [data-tm="action"][data-v="toggle"]`);
    check(`[${tag}] Umschalten: kein Zurückschalten`, await wait(`return !r.querySelector('dialog.timer-dlg [data-tm="bdur"]') && !!r.querySelector("dialog.timer-dlg .mg-hint")`));
    await tap(`${win} [data-tm="action"][data-v="on"]`);
    await tap(`${win} [data-tm="bdur"][data-s="1800"]`);
    await tap(`${win} [data-tm="bdur"][data-s="0"]`);
    await fill(`${win} [data-tm="back-own"]`, "20");
    await p.screenshot({ path: `${outDir}/timer-w1-${tag.replace("/", "-")}.png` });
    await tap(nextBtn);

    // --- Schritt 2: Wann -----------------------------------------------------------------------------------------
    check(`[${tag}] Schritt 2: "${T.q2}", Wiederholt täglich 06:30, Vorschau mit drei Läufen`, await wait(`return r.querySelector("dialog.timer-dlg .mg-big")?.textContent === ${JSON.stringify(T.q2)} && r.querySelector('dialog.timer-dlg [data-tm="time"]').value === "06:30" && r.querySelectorAll("dialog.timer-dlg .tm-next div").length === 3`));
    await tap(`${win} [data-tm="repeat"][data-v="weekly"]`);
    check(`[${tag}] wöchentlich: Wochentage Mo bis Fr, Vorschau nur an diesen Tagen`, await wait(`return r.querySelectorAll('dialog.timer-dlg [data-tm="wd"].on').length === 5 && r.querySelectorAll("dialog.timer-dlg .tm-next div").length === 3`));
    await tap(`${win} [data-tm="wd"][data-d="1"]`);
    await tap(`${win} [data-tm="wd"][data-d="3"]`);
    check(`[${tag}] Di und Do abgewählt: Mo, Mi, Fr`, await wait(`return [...r.querySelectorAll('dialog.timer-dlg [data-tm="wd"].on')].map((b) => b.dataset.d).join() === "0,2,4"`));
    for (const d of [0, 2, 4]) await tap(`${win} [data-tm="wd"][data-d="${d}"]`);
    check(`[${tag}] kein Wochentag: Weiter gesperrt`, await wait(`return r.querySelector('dialog.timer-dlg [data-tm="nav-next"]').disabled`));
    for (const d of [0, 2, 4]) await tap(`${win} [data-tm="wd"][data-d="${d}"]`);
    await tap(`${win} [data-tm="repeat"][data-v="monthly"]`);
    check(`[${tag}] monatlich: Tag des Monats (1. gewählt), Vorschau am 1.`, await wait(`return r.querySelector('dialog.timer-dlg [data-tm="mday"][data-v="1"]').classList.contains("on") && [...r.querySelectorAll("dialog.timer-dlg .tm-next div span:first-child")].every((s) => /\\b1\\b/.test(s.textContent))`), await text(`${win} .tm-next`));
    await tap(`${win} [data-tm="mday"][data-v="last"]`);
    check(`[${tag}] letzter Tag des Monats`, await wait(`return r.querySelector('dialog.timer-dlg [data-tm="mday"][data-v="last"]').classList.contains("on")`));
    await tap(`${win} [data-tm="mday"][data-v="own"]`);
    await fill(`${win} [data-tm="mday-own"]`, "31");
    check(`[${tag}] anderer Tag: 31.`, await wait(`return r.querySelector('dialog.timer-dlg [data-tm="mday-own"]').value === "31" && !r.querySelector('dialog.timer-dlg [data-tm="nav-next"]').disabled`));
    await tap(`${win} [data-tm="kind"][data-v="countdown"]`);
    check(`[${tag}] In …: Voreinstellungen, "Läuft ab" eine Zeile`, await wait(`return r.querySelectorAll('dialog.timer-dlg [data-tm="delay"]').length === 4 && r.querySelectorAll("dialog.timer-dlg .tm-next div").length === 1`));
    await fill(`${win} [data-tm="delay-own"]`, "0.01");
    check(`[${tag}] zu kurze Dauer: Fehler, Weiter gesperrt`, await wait(`return !!r.querySelector('dialog.timer-dlg [data-tm-err="delay"]:not([hidden])') && r.querySelector('dialog.timer-dlg [data-tm="nav-next"]').disabled`));
    await tap(`${win} [data-tm="delay"][data-s="1800"]`);
    await tap(`${win} [data-tm="kind"][data-v="once"]`);
    check(`[${tag}] Einmal: Datum morgen, eine Vorschau`, await wait(`return !!r.querySelector('dialog.timer-dlg [data-tm="date"]').value && r.querySelectorAll("dialog.timer-dlg .tm-next div").length === 1`));
    await ev(`const i = r.querySelector('dialog.timer-dlg [data-tm="date"]'); i.value = "2020-01-01"; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true }));`);
    check(`[${tag}] Datum in der Vergangenheit: Fehler vom Server, Weiter gesperrt`, await wait(`return !!r.querySelector("dialog.timer-dlg .opt-error") && r.querySelector('dialog.timer-dlg [data-tm="nav-next"]').disabled`));
    await tap(`${win} [data-tm="kind"][data-v="repeat"]`);
    await tap(`${win} [data-tm="repeat"][data-v="weekly"]`);
    await p.screenshot({ path: `${outDir}/timer-w2-${tag.replace("/", "-")}.png` });
    await tap(nextBtn);

    // --- Schritt 3: Meldung --------------------------------------------------------------------------------------
    check(`[${tag}] Schritt 3: Meldung aus, kein Empfänger`, await wait(`return r.querySelector("dialog.timer-dlg .mg-big")?.textContent === ${JSON.stringify(T.q3)} && !r.querySelector('dialog.timer-dlg [data-tm="push"]').checked && !r.querySelector('dialog.timer-dlg [data-tm="target-toggle"]')`));
    await tap(`${win} [data-tm="push"]`);
    check(`[${tag}] Push an: Empfänger "${T.def}", Vorschau mit festem Text`, await wait(`return r.querySelector('dialog.timer-dlg [data-tm="target-toggle"] span')?.textContent.startsWith(${JSON.stringify(T.def)}) && r.querySelector("dialog.timer-dlg .pv-title")?.textContent === ${JSON.stringify("⏱️ Timer: " + T.plug)} && /Steckdose|Plug/.test(r.querySelector("dialog.timer-dlg .pv-text")?.textContent || "")`), await text(`${win} .pv-card`));
    await tap(`${win} [data-tm="target-toggle"]`);
    check(`[${tag}] Liste: Standard, Gruppen, Dienste, Entitäten`, await wait(`return r.querySelectorAll('dialog.timer-dlg [data-tm="target"]').length === 5 && !!r.querySelector("dialog.timer-dlg .mg-opt-head")`));
    await tap(`${win} [data-tm="target"][data-v="notify.familie"]`);
    check(`[${tag}] Gruppe "Familie" gewählt`, await wait(`return r.querySelector('dialog.timer-dlg [data-tm="target-toggle"] span')?.textContent.startsWith("Familie")`));
    await tap(`${win} [data-tm="test"]`);
    check(`[${tag}] Test senden: Aufruf mit dem Entwurf, Rückmeldung`, await wait(`return /Familie/.test(r.querySelector("dialog.timer-dlg .mg-testrow")?.textContent || "")`) && (await calls("device_panel/timer_test")).at(-1)?.timer.target === "notify.familie");
    await p.screenshot({ path: `${outDir}/timer-w3-${tag.replace("/", "-")}.png` });
    await tap(nextBtn);

    // --- Schritt 4: Name und Prüfung -----------------------------------------------------------------------------
    check(`[${tag}] Schritt 4: Satz mit Wochentagen, Push-Zeile, nächste Ausführung`, await wait(`return r.querySelector("dialog.timer-dlg .mg-big")?.textContent === ${JSON.stringify(T.q4)} && !!r.querySelector("dialog.timer-dlg .tm-sum") && /Familie/.test(r.querySelector("dialog.timer-dlg .tm-sum").textContent) && !!r.querySelector("dialog.timer-dlg .tm-next div")`), await text(`${win} .tm-sum`));
    await fill(`${win} [data-tm="name"]`, "Bewässerung");
    await p.screenshot({ path: `${outDir}/timer-w4-${tag.replace("/", "-")}.png` });
    await tap(`${win} [data-tm="nav-save"]`);
    check(`[${tag}] gespeichert: Fenster zu, Karte in der Liste`, await wait(`return !r.querySelector("dialog.timer-dlg").open && r.querySelectorAll(".tm-root .tm-clock").length === 1`));
    const saved = (await calls("device_panel/timer_save")).at(-1)?.timer;
    check(`[${tag}] timer_save: Entität, Aktion, 20 Min. zurück, wöchentlich Mo, Mi, Fr 06:30, Push an Familie`, saved && saved.entity_id === "switch.plug" && saved.action === "on" && saved.back_s === 1200 && saved.kind === "repeat" && saved.repeat === "weekly" && JSON.stringify(saved.weekdays) === "[0,2,4]" && saved.time === "06:30" && saved.push === true && saved.target === "notify.familie" && saved.name === "Bewässerung", JSON.stringify(saved));
    check(`[${tag}] Meldung "${T.saved}"`, (await cardsText()).includes(T.saved));
    check(`[${tag}] Karte: Uhrzeit, Name, Wochentage, nächster Lauf, Glocke`, await ev(`const c = r.querySelector(".tm-root .tm-clock"); return c.querySelector(".time").textContent.startsWith("06:30") && c.querySelector(".name").textContent.includes("Bewässerung") && c.querySelectorAll(".tm-days i.on").length === 3 && !!c.querySelector(".next b") && c.textContent.includes("🔔")`));
    check(`[${tag}] Reiter zeigt die Zahl (${T.one})`, (await text('dialog.device [data-tab="timer"]')).includes(T.one), await text('dialog.device [data-tab="timer"]'));
    await p.screenshot({ path: `${outDir}/timer-list-${tag.replace("/", "-")}.png` });

    // --- Liste: Aktionen -----------------------------------------------------------------------------------------
    const id = await ev(`return r.querySelector('.tm-root [data-tm="edit"]').dataset.id`);
    await tap('.tm-root [data-tm="toggle"]');
    check(`[${tag}] ausschalten: timer_enable false, Karte gedimmt, Reiter ohne Zahl`, await wait(`return r.querySelector(".tm-root .tm-clock").classList.contains("off")`) && (await calls("device_panel/timer_enable")).at(-1)?.enabled === false && await wait(`return !r.querySelector('dialog.device [data-tab="timer"]').textContent.includes(${JSON.stringify(T.one)})`), await text('dialog.device [data-tab="timer"]') + " / " + (await ev(`return r.querySelector(".tm-root .tm-clock").className`)));
    await tap('.tm-root [data-tm="toggle"]');
    check(`[${tag}] wieder ein`, await wait(`return !r.querySelector(".tm-root .tm-clock").classList.contains("off")`) && (await calls("device_panel/timer_enable")).at(-1)?.enabled === true);
    await tap('.tm-root [data-tm="run"]');
    check(`[${tag}] Ausführen: timer_run, zuletzt geschaltet`, await wait(`return /(zuletzt geschaltet|last switched)/.test(r.querySelector(".tm-root .tm-clock").textContent)`) && (await calls("device_panel/timer_run")).at(-1)?.timer_id === id);
    // Bearbeiten, ändern, schliessen: Rückfrage
    await tap('.tm-root [data-tm="edit"]');
    check(`[${tag}] Bearbeiten: Assistent bei Schritt 2 mit den Werten`, await wait(`return r.querySelector("dialog.timer-dlg")?.open && r.querySelector("dialog.timer-dlg .mg-big")?.textContent === ${JSON.stringify(T.q2)} && r.querySelectorAll('dialog.timer-dlg [data-tm="wd"].on').length === 3`));
    await tap(`${win} [data-tm="wd"][data-d="4"]`);
    await tap(`${win} [data-tm="close"]`);
    check(`[${tag}] Schliessen mit Änderung: Rückfrage "${T.discard}", Fenster bleibt`, (await wait(`return r.querySelector("dialog.discard-dlg").open`)) && (await ev(`return r.querySelector("dialog.timer-dlg").open`)));
    await tap('dialog.discard-dlg [data-dd="no"]');
    check(`[${tag}] Weiter bearbeiten: Entwurf bleibt`, await ev(`return r.querySelector("dialog.timer-dlg").open && r.querySelectorAll('dialog.timer-dlg [data-tm="wd"].on').length === 2`));
    await tap(`${win} [data-tm="close"]`);
    await tap('dialog.discard-dlg [data-dd="yes"]');
    check(`[${tag}] Verwerfen: zu, nichts gesendet`, await wait(`return !r.querySelector("dialog.timer-dlg").open`) && (await calls("device_panel/timer_save")).length === 1);
    // Ohne Änderung schliesst sofort
    await tap('.tm-root [data-tm="edit"]');
    await wait(`return r.querySelector("dialog.timer-dlg").open`);
    await tap(`${win} [data-tm="close"]`);
    check(`[${tag}] ohne Änderung ohne Rückfrage`, await wait(`return !r.querySelector("dialog.timer-dlg").open && !r.querySelector("dialog.discard-dlg").open`));

    // Zweiter Timer: Countdown läuft
    await tap('.tm-root [data-tm="add"]');
    await tap(`${win} .mg-pick[data-id="light.led"]`);
    await tap(nextBtn);
    await tap(`${win} [data-tm="kind"][data-v="countdown"]`);
    await tap(`${win} [data-tm="delay"][data-s="900"]`);
    await tap(nextBtn);
    await tap(nextBtn);
    await tap(`${win} [data-tm="nav-save"]`);
    check(`[${tag}] Countdown gespeichert: läuft mit Ring und Restzeit`, await wait(`return r.querySelectorAll(".tm-root .tm-clock").length === 2 && !!r.querySelector(".tm-root .tm-ring [data-tm-left]") && /\\d{2}:\\d{2}/.test(r.querySelector(".tm-root .tm-ring").textContent)`));
    const left1 = await text(".tm-root [data-tm-left]");
    await p.waitForTimeout(2200);
    const left2 = await text(".tm-root [data-tm-left]");
    check(`[${tag}] Restzeit zählt herunter`, left1 !== left2, `${left1} → ${left2}`);

    // Löschen mit Bestätigung
    await tap('.tm-root .tm-clock:has([data-tm-left]) [data-tm="delete"]');
    check(`[${tag}] Löschen fragt nach`, (await wait(`return !!r.querySelector(".tm-root .mg-confirm")`)) && (await text(".tm-root .mg-confirm b")) === T.delAsk.replace("Bewässerung", "LED-Ring"));
    await tap('.tm-root [data-tm="delete-no"]');
    check(`[${tag}] Nein: bleibt`, await ev(`return r.querySelectorAll(".tm-root .tm-clock").length === 2`));
    await tap('.tm-root .tm-clock:has([data-tm-left]) [data-tm="delete"]');
    await tap('.tm-root [data-tm="delete-yes"]');
    check(`[${tag}] Ja: gelöscht`, await wait(`return r.querySelectorAll(".tm-root .tm-clock").length === 1`) && (await calls("device_panel/timer_delete")).length === 1);

    // Fehler beim Ausführen
    await p.evaluate(() => { window.__timerRunFails = true; });
    await tap('.tm-root [data-tm="run"]');
    check(`[${tag}] Ausführen schlägt fehl: Meldung`, await wait(`return !!r.querySelector(".tm-root .dlg-error")`));
    await p.evaluate(() => { window.__timerRunFails = false; });

    // --- Übersicht in den Einstellungen --------------------------------------------------------------------------
    await tap('dialog.device [data-dlg="close"]');
    await wait(`return !r.querySelector("dialog.device").open`);
    // zweiter Timer an einem anderen Gerät
    await tap('.dev[data-open="a"]');
    await wait(`return r.querySelector("dialog.device")?.open`);
    await tap('dialog.device [data-tab="timer"]');
    await wait(`return r.querySelector(".tm-root .mg-add")`);
    await tap('.tm-root [data-tm="add"]');
    await tap(`${win} .mg-pick[data-id="switch.plug"]`);
    await tap(nextBtn);
    await tap(`${win} [data-tm="repeat"][data-v="daily"]`);
    await tap(nextBtn);
    await tap(nextBtn);
    await fill(`${win} [data-tm="name"]`, "Nachtlicht");
    await tap(`${win} [data-tm="nav-save"]`);
    await wait(`return r.querySelectorAll(".tm-root .tm-clock").length === 1`);
    await tap('dialog.device [data-dlg="close"]');
    await wait(`return !r.querySelector("dialog.device").open`);
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    const titles = await ev(`return [...r.querySelectorAll("dialog.settings .set-sec-title")].map((e) => e.firstChild.textContent.trim()).join("|")`);
    check(`[${tag}] Abschnitt "${T.sec}" zwischen Überwachung und Darstellung`, titles.includes(`${T.sec}|`) && titles.indexOf(T.sec) > titles.indexOf(lang === "de" ? "Überwachung" : "Monitoring") && titles.indexOf(T.sec) < titles.indexOf(T.look), titles);
    await tap('[data-set="section"][data-id="timers"]');
    check(`[${tag}] aufgeklappt: zwei Geräte, eingeklappt mit Kurzfassung`, await wait(`return r.querySelectorAll("dialog.settings .mg-dcard").length === 2 && r.querySelectorAll("dialog.settings .mg-card").length === 0 && r.querySelectorAll("dialog.settings .mg-dsum").length === 2`));
    await tap('dialog.settings [data-set="timer-fold-all"]');
    check(`[${tag}] Alle ausklappen: 2 Timer`, await wait(`return r.querySelectorAll("dialog.settings .mg-card").length === 2`));
    check(`[${tag}] Filter mit Zahlen`, (await ev(`return [...r.querySelectorAll('dialog.settings [data-set="timer-filter"] .tab-s')].map((e) => e.textContent).join()`)) === "2,2,0,0");
    await ev(`const i = r.querySelector('dialog.settings input[data-lsearch="timers"]'); i.focus();`);
    await p.keyboard.type("nacht");
    check(`[${tag}] Suche "nacht": ${T.hit}`, await wait(`return r.querySelectorAll("dialog.settings .mg-card").length === 1 && r.querySelector('dialog.settings .list-search .n').textContent.includes("1")`), await text("dialog.settings .list-search .n"));
    await tap('dialog.settings [data-lclear="timers"]');
    check(`[${tag}] X leert die Suche (Geräte bleiben wie vor der Suche)`, await wait(`return r.querySelectorAll("dialog.settings .mg-dcard").length === 2`));
    await tap('dialog.settings [data-set="timer-filter"][data-v="running"]');
    check(`[${tag}] Filter "Läuft": keine Treffer`, await wait(`return !!r.querySelector("dialog.settings .mg-none")`));
    await tap('dialog.settings [data-set="timer-filter"][data-v="all"]');
    await wait(`return r.querySelectorAll("dialog.settings .mg-dcard").length === 2`);
    if (!(await ev(`return r.querySelectorAll("dialog.settings .mg-card").length === 2`))) await tap('dialog.settings [data-set="timer-fold-all"]');
    check(`[${tag}] wieder alle offen`, await wait(`return r.querySelectorAll("dialog.settings .mg-card").length === 2`));
    await p.screenshot({ path: `${outDir}/timer-settings-${tag.replace("/", "-")}.png` });
    // Ein-/Ausschalten in der Übersicht
    await tap('dialog.settings input[data-set="timer-toggle"]');
    check(`[${tag}] Übersicht: ausschalten ruft timer_enable`, await wait(`return r.querySelectorAll("dialog.settings .mg-card.off").length === 1`) && (await calls("device_panel/timer_enable")).at(-1)?.enabled === false);
    // Löschen mit Bestätigung
    await tap('dialog.settings [data-set="timer-delete"]');
    check(`[${tag}] Übersicht: Löschen fragt nach`, await wait(`return !!r.querySelector("dialog.settings .mg-confirm")`));
    await tap('dialog.settings [data-set="timer-delete-no"]');
    // Bearbeiten öffnet den Assistenten ohne Popup
    await tap('dialog.settings [data-set="timer-edit"]');
    check(`[${tag}] Übersicht: Bearbeiten öffnet den Assistenten, kein Popup dahinter`, await wait(`return r.querySelector("dialog.timer-dlg")?.open`) && !(await ev(`return r.querySelector("dialog.device").open`)));
    await tap(`${win} [data-tm="close"]`);
    await wait(`return !r.querySelector("dialog.timer-dlg").open`);
    // Allgemein: Pause und Nachholen
    check(`[${tag}] Allgemein: Pause aus, Nachholen 10 Min., Fehlermeldung an`, await ev(`return !r.querySelector('dialog.settings input[data-opt="timers_pause"]').checked && r.querySelector('dialog.settings input[data-opt="timers_catch_up"]').value === "10" && r.querySelector('dialog.settings input[data-opt="timers_notify_error"]').checked`));
    await tap('dialog.settings input[data-opt="timers_pause"]');
    await fill('dialog.settings input[data-opt="timers_catch_up"]', "30");
    check(`[${tag}] Entwurf: zwei Änderungen, Abschnitt markiert`, await wait(`return r.querySelector('dialog.settings .set-count')?.textContent.includes("2")`));
    await tap('dialog.settings [data-set="save"]');
    await wait(`return r.querySelector("dialog.settings .set-count.saved")`);
    const so = (await calls("device_panel/set_options")).at(-1)?.values;
    check(`[${tag}] gespeichert: set_options mit Pause und 30 Min.`, so && so.timers_pause === true && so.timers_catch_up === 30, JSON.stringify(so));
    check(`[${tag}] Zusammenfassung zeigt "pausiert"`, /(pausiert|paused)/.test(await text('[data-id="timers"] .set-sec-sum')), await text('[data-id="timers"] .set-sec-sum'));
    await tap('dialog.settings .dlg-actions [data-set="close"]');

    // --- Gerät ohne schaltbare Entität -----------------------------------------------------------------------------
    await p.evaluate(() => { window.__timerEntities = { c: [] }; });
    await tap('.dev[data-open="c"]');
    await wait(`return r.querySelector("dialog.device")?.open`);
    await tap('dialog.device [data-tab="timer"]');
    check(`[${tag}] ohne schaltbare Entität: Hinweis, kein "${T.add}"`, await wait(`return !r.querySelector(".tm-root .mg-add") && r.querySelector(".tm-root .mg-empty")?.textContent.includes(${JSON.stringify(T.noEnt)})`), await cardsText());
    await tap('dialog.device [data-dlg="close"]');

    check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
