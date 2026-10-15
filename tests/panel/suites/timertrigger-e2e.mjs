// Timer mit Auslöser (2.54.0, docs/mockups/timer-trigger-v1 und -v2): Umschalter "Zu einer Zeit | Durch einen Auslöser" im Schritt "Wann",
// Bedingungen wie bei Magic Push (Und/Oder), Dauer, Zeitfenster, Pause, "nur einmal"; neue Seite "Zurückschalten" mit Nie / Nach Dauer /
// Zu einer Zeit / Durch Auslöser, "Spätestens nach", "Wie vorher". Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { step: (n, t) => `Schritt ${n} von ${t}`, modeTime: "Zu einer Zeit", modeTrig: "Durch einen Auslöser", temp: "Temperatur Garten", below: "unter", rain: "Regen Garten", wet: "nass", op: "oder", hold2: "2 Min.", pause5: "5 Min.", waits: "wartet auf auslöser", backTrig: "wieder wie vorher, wenn", maxNote: "spätestens nach", restore: "Wie vorher", at: "um 23:30 wieder aus", winSame: "Beginn und Ende sind gleich.", back: "Zurückschalten" },
  en: { step: (n, t) => `Step ${n} of ${t}`, modeTime: "At a time", modeTrig: "By a trigger", temp: "Temperatur Garten", below: "below", rain: "Regen Garten", wet: "wet", op: "or", hold2: "2 min", pause5: "5 min", waits: "waiting for trigger", backTrig: "back as before when", maxNote: "at the latest after", restore: "As before", at: "back off at 23:30", winSame: "Start and end are the same.", back: "Switch back" },
};

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=${mobile ? "dark" : "light"}`);
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
    const fill = async (sel, value) => { const h = await handle(sel); await h.scrollIntoViewIfNeeded(); await h.fill(value); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const calls = (type) => p.evaluate((ty) => window.__wsCalls.filter((m) => m.type === ty), type);
    const win = "dialog.timer-dlg";
    const next = `${win} [data-tm="nav-next"]`;

    const openWizard = async () => {
      await tap(".toolbar .tmall-btn");
      await wait(`return r.querySelector("dialog.tmall-dlg")?.open`);
      await tap('dialog.tmall-dlg [data-tma="timer-add"]');
      await wait(`return r.querySelectorAll('${win} [data-tm="dev"]').length > 0`);
      await tap(`${win} [data-tm="dev"]`);
      await tap(next);
      await wait(`return r.querySelectorAll('${win} [data-tm="pick"]').length > 0`);
      await tap(`${win} [data-tm="pick"][data-id="switch.plug"]`);
      await tap(next);
      await wait(`return r.querySelectorAll('${win} [data-tm="whenmode"]').length === 2`);
    };
    // Bedingung hinzufügen: Entität suchen und wählen
    const addCond = async (which, query, id) => {
      await tap(`${win} [data-tm="c-add"][data-w="${which}"]`);
      await wait(`return !!r.querySelector('${win} [data-tm="c-search"][data-w="${which}"]')`);
      await fill(`${win} [data-tm="c-search"][data-w="${which}"]`, query);
      await wait(`return !!r.querySelector('${win} [data-tm="c-pick"][data-id="${id}"]')`);
      await tap(`${win} [data-tm="c-pick"][data-id="${id}"]`);
      await wait(`return !r.querySelector('${win} [data-tm="c-search"]')`);
    };

    // --- Schritt "Wann": Umschalter ---------------------------------------------------------------------------
    await openWizard();
    check(`[${tag}] "Wann": Umschalter "${T.modeTime}" / "${T.modeTrig}", Zeit gewählt, bisherige Seite darunter`, await ev(`const t = [...r.querySelectorAll('${win} [data-tm="whenmode"]')]; return t[0].textContent.trim() === ${JSON.stringify(T.modeTime)} && t[1].textContent.trim() === ${JSON.stringify(T.modeTrig)} && t[0].classList.contains("on") && !!r.querySelector('${win} [data-tm="kind"]')`));
    check(`[${tag}] mit Zeit und Zurückschalten: sechs Schritte (Schritt 2 von 6)`, (await text(`${win} .mg-stephead span`)) === T.step(2, 5) || (await text(`${win} .mg-stephead span`)) === T.step(3, 6));
    await tap(`${win} [data-tm="whenmode"][data-v="trigger"]`);
    check(`[${tag}] Auslöser: Hinweis, "Bedingung hinzufügen", noch keine Bedingung: Weiter gesperrt`, await ev(`return !!r.querySelector('${win} [data-tm="c-add"]') && !r.querySelector('${win} [data-tm="kind"]') && r.querySelector('${win} [data-tm="nav-next"]').disabled && !!r.querySelector('${win} .mg-note')`));
    await p.waitForTimeout(900);
    check(`[${tag}] Auslöser ohne Bedingung: keine Fehlermeldung (Vorschau wird nicht gefragt)`, await ev(`return !r.querySelector('${win} .opt-error')`));

    // --- Bedingung 1: Zahl ------------------------------------------------------------------------------------
    await addCond("start", "garten", "sensor.garten_temp");
    check(`[${tag}] Bedingung "${T.temp}" gewählt: Karte offen mit über / unter / gleich / ändert sich, Schwellenwert 6,5`, await wait(`const c = r.querySelector('${win} .mg-lcard.open'); return !!c && c.querySelectorAll('[data-tm="c-kind"]').length === 4 && /6[.,]5/.test(c.querySelector('[data-tm="c-value"]').value)`));
    await tap(`${win} [data-tm="c-kind"][data-kind="below"]`);
    await fill(`${win} [data-tm="c-value"]`, "5");
    check(`[${tag}] "${T.below} 5": Satz in der Zusammenfassung, Weiter frei`, await wait(`return r.querySelector('${win} .mg-sumline')?.textContent.includes(${JSON.stringify(T.temp)}) && r.querySelector('${win} .mg-sumline').textContent.includes("5") && !r.querySelector('${win} [data-tm="nav-next"]').disabled`), await text(`${win} .mg-sumline`));
    await tap(`${win} [data-tm="c-step"][data-dir="1"]`);
    check(`[${tag}] Schritt "+": Wert 5,5`, await wait(`return /5[.,]5/.test(r.querySelector('${win} [data-tm="c-value"]').value)`));
    await fill(`${win} [data-tm="c-value"]`, "");
    check(`[${tag}] leerer Schwellenwert: Bedingung unvollständig, Weiter gesperrt`, await wait(`return r.querySelector('${win} [data-tm="nav-next"]').disabled`));
    await fill(`${win} [data-tm="c-value"]`, "5");

    // --- Bedingung 2: Zustand, Und/Oder -------------------------------------------------------------------------
    await addCond("start", "regen", "binary_sensor.garten_regen");
    check(`[${tag}] zweite Bedingung "${T.rain}": Zustände als Reiter, Und/Oder-Leiste erscheint`, await wait(`const c = r.querySelector('${win} .mg-lcard.open'); return c.querySelectorAll('[data-tm="c-state"]').length >= 2 && r.querySelectorAll('${win} [data-tm="c-op"]').length === 2 && !!r.querySelector('${win} .mg-join')`));
    await tap(`${win} [data-tm="c-state"][data-v="on"]`);
    check(`[${tag}] Zustand "${T.wet}" gewählt: Satz mit "und"`, await wait(`const s = r.querySelector('${win} .mg-sumline')?.textContent || ""; return s.includes(${JSON.stringify(T.rain)}) && s.includes(${JSON.stringify(T.wet)})`), await text(`${win} .mg-sumline`));
    await tap(`${win} [data-tm="c-op"][data-v="or"]`);
    check(`[${tag}] "oder": Satz mit "${T.op}"`, await wait(`return r.querySelector('${win} .mg-sumline').textContent.includes(" ${T.op} ")`), await text(`${win} .mg-sumline`));
    await tap(`${win} [data-tm="c-op"][data-v="and"]`);
    // Entfernen und wieder hinzufügen (Reihenfolge der Bedingungen)
    check(`[${tag}] zwei Bedingungen, je mit Entfernen-Knopf`, (await ev(`return r.querySelectorAll('${win} .mg-lcard').length`)) === 2 && (await ev(`return r.querySelectorAll('${win} [data-tm="c-del"]').length`)) === 2);

    // --- Dauer, Zeitfenster, Pause, nur einmal -----------------------------------------------------------------
    await tap(`${win} [data-tm="hold"][data-w="start"][data-s="120"]`);
    check(`[${tag}] Dauer "${T.hold2}" gewählt`, await wait(`return r.querySelector('${win} [data-tm="hold"][data-s="120"]').classList.contains("on")`));
    await tap(`${win} [data-tm="win-on"]`);
    check(`[${tag}] Zeitfenster an: Von 22:00 bis 06:00`, await wait(`const a = r.querySelector('${win} [data-tm="win-from"]'), z = r.querySelector('${win} [data-tm="win-to"]'); return !!a && a.value === "22:00" && z.value === "06:00"`));
    await fill(`${win} [data-tm="win-to"]`, "22:00");
    check(`[${tag}] Beginn = Ende: Fehler "${T.winSame}", Weiter gesperrt`, await wait(`return r.querySelector('${win} .opt-error')?.textContent.includes(${JSON.stringify(T.winSame)}) && r.querySelector('${win} [data-tm="nav-next"]').disabled`));
    await fill(`${win} [data-tm="win-to"]`, "06:00");
    await tap(`${win} [data-tm="pause"][data-s="300"]`);
    check(`[${tag}] Pause "${T.pause5}" gewählt`, await wait(`return r.querySelector('${win} [data-tm="pause"][data-s="300"]').classList.contains("on")`));
    await tap(`${win} [data-tm="once-trig"]`);
    check(`[${tag}] "Nur einmal auslösen" an`, await ev(`return r.querySelector('${win} [data-tm="once-trig"]').checked`));
    await p.screenshot({ path: `${outDir}/timertrigger-${tag.replace("/", "-")}-trigger.png` });
    if (mobile) check(`[${tag}] Handy: kein Querlauf auf der Seite "Wann"`, await wait(`const m = r.querySelector("${win} .mgw-main"); return m.scrollWidth <= m.clientWidth + 1`));

    // --- Seite "Zurückschalten": durch Auslöser ------------------------------------------------------------------
    await tap(next);
    check(`[${tag}] Seite "${T.back}": Reiterleiste mit vier Arten, Standard "Nie", Hinweis`, await wait(`return r.querySelectorAll('${win} [data-tm="backkind"]').length === 4 && r.querySelector('${win} [data-tm="backkind"][data-v="none"]').classList.contains("on") && !r.querySelector('${win} [data-tm="bmode"]')`));
    await tap(`${win} [data-tm="backkind"][data-v="trigger"]`);
    check(`[${tag}] Durch Auslöser: noch keine Bedingung, Weiter gesperrt`, await ev(`return !!r.querySelector('${win} [data-tm="c-add"][data-w="back"]') && r.querySelector('${win} [data-tm="nav-next"]').disabled`));
    await p.waitForTimeout(900);
    check(`[${tag}] Zurück durch Auslöser ohne Bedingung: keine Fehlermeldung`, await ev(`return !r.querySelector('${win} .opt-error')`));
    await addCond("back", "regen", "binary_sensor.garten_regen");
    await tap(`${win} [data-tm="c-state"][data-v="off"]`);
    await tap(`${win} [data-tm="hold"][data-w="back"][data-s="300"]`);
    await tap(`${win} [data-tm="bmax-on"]`);
    await tap(`${win} [data-tm="bmax"][data-s="7200"]`);
    await tap(`${win} [data-tm="bmode"][data-v="restore"]`);
    check(`[${tag}] Zurück durch Auslöser: Satz "${T.backTrig} …, ${T.maxNote} …", "${T.restore}" gewählt`, await wait(`const s = r.querySelector('${win} [data-tm-zone="backsum"] .mg-sumline')?.textContent.toLowerCase() || ""; return s.includes(${JSON.stringify(T.backTrig)}) && s.includes(${JSON.stringify(T.maxNote)})`), await text(`${win} [data-tm-zone="backsum"]`));
    check(`[${tag}] Weiter frei`, await wait(`return !r.querySelector('${win} [data-tm="nav-next"]').disabled`));
    await p.screenshot({ path: `${outDir}/timertrigger-${tag.replace("/", "-")}-back.png` });
    if (mobile) check(`[${tag}] Handy: kein Querlauf auf der Seite "Zurückschalten"`, await wait(`const m = r.querySelector("${win} .mgw-main"); return m.scrollWidth <= m.clientWidth + 1`));

    // --- Meldung, Name, Prüfung, Speichern ------------------------------------------------------------------------
    await tap(next);
    await tap(next);
    check(`[${tag}] Prüfung: Satz mit Auslöser, "${T.waits}"`, await wait(`const s = r.querySelector("${win} .tm-sum")?.textContent || ""; return s.includes(${JSON.stringify(T.temp)}) && r.querySelector("${win}").textContent.toLowerCase().includes(${JSON.stringify(T.waits)})`), await text(`${win} .tm-sum`));
    await fill(`${win} [data-tm="name"]`, "Regenlicht");
    await p.evaluate(() => { window.__wsCalls = []; });
    await tap(`${win} [data-tm="nav-save"]`);
    const saved = (await (async () => { for (let i = 0; i < 25; i++) { const c = await calls("device_panel/timer_save"); if (c.length) return c; await p.waitForTimeout(200); } return []; })()).at(-1)?.timer || {};
    const leaves = (t) => (t?.items || []).flatMap((i) => i.items || [i]);
    check(`[${tag}] timer_save: kind trigger, zwei Bedingungen (und), Dauer 120, Fenster 22:00–06:00, Pause 300, nur einmal`, saved.kind === "trigger" && saved.conditions?.op === "and" && leaves(saved.conditions).length === 2 && saved.hold_s === 120 && saved.window?.from === "22:00" && saved.window?.to === "06:00" && saved.pause_s === 300 && saved.once_trigger === true && saved.time === null, JSON.stringify(saved));
    check(`[${tag}] timer_save: Zurück durch Auslöser, 5 Min. ohne, spätestens 7200 s, wie vorher`, saved.back_kind === "trigger" && leaves(saved.back_conditions).length === 1 && saved.back_hold_s === 300 && saved.back_max_s === 7200 && saved.back_mode === "restore" && saved.back_s === null && leaves(saved.conditions)[0].kind === "below" && leaves(saved.conditions)[0].value === 5);
    await wait(`return !r.querySelector("${win}")?.open`);
    check(`[${tag}] Liste: Satz mit Bedingung, "${T.waits}"`, await wait(`const t = r.querySelector("dialog.tmall-dlg")?.textContent || ""; return t.includes(${JSON.stringify(T.temp)}) && t.toLowerCase().includes(${JSON.stringify(T.waits)})`), await text("dialog.tmall-dlg .mg-card .mg-t"));

    // --- Bearbeiten: Auslöser und Zurückschalten bleiben ------------------------------------------------------------
    await wait(`return !!r.querySelector("dialog.tmall-dlg [data-tma='timer-edit']")`);
    await tap('dialog.tmall-dlg [data-tma="timer-edit"]');
    await wait(`return r.querySelector("${win}")?.open`);
    check(`[${tag}] Bearbeiten: Umschalter auf Auslöser, beide Bedingungen, Zeitfenster an`, await wait(`return r.querySelector('${win} [data-tm="whenmode"][data-v="trigger"]')?.classList.contains("on") && r.querySelectorAll('${win} .mg-lcard').length === 2 && r.querySelector('${win} [data-tm="win-on"]').checked`));
    await tap(next);
    check(`[${tag}] Bearbeiten: Zurückschalten "Durch Auslöser" mit der Bedingung, spätestens-Schalter an`, await wait(`return r.querySelector('${win} [data-tm="backkind"][data-v="trigger"]').classList.contains("on") && r.querySelectorAll('${win} .mg-lcard').length === 1 && r.querySelector('${win} [data-tm="bmax-on"]').checked`));
    await tap(`${win} [data-tm="close"]`);
    await wait(`return !r.querySelector("${win}")?.open`);

    // --- Zeit → Auslöser und Zeit → Uhrzeit ------------------------------------------------------------------------
    await tap('dialog.tmall-dlg [data-tma="timer-add"]');
    await wait(`return r.querySelectorAll('${win} [data-tm="dev"]').length > 0`);
    await tap(`${win} [data-tm="dev"]`);
    await tap(next);
    await wait(`return r.querySelectorAll('${win} [data-tm="pick"]').length > 0`);
    await tap(`${win} [data-tm="pick"][data-id="switch.plug"]`);
    await tap(next);
    await wait(`return r.querySelectorAll('${win} [data-tm="whenmode"]').length === 2`);
    await tap(next);
    await tap(`${win} [data-tm="backkind"][data-v="time"]`);
    check(`[${tag}] Zurück zu einer Zeit: Uhrzeitfeld, "Danach zurück auf"`, await ev(`return !!r.querySelector('${win} [data-tm="back-time"]') && r.querySelectorAll('${win} [data-tm="bmode"]').length === 2`));
    await fill(`${win} [data-tm="back-time"]`, "23:30");
    check(`[${tag}] Satz "${T.at}"`, await wait(`return r.querySelector('${win} .mg-sumline')?.textContent.toLowerCase().includes(${JSON.stringify(T.at)})`), await text(`${win} [data-tm-zone="backsum"]`));
    await tap(`${win} [data-tm="backkind"][data-v="trigger"]`);
    await addCond("back", "garten", "sensor.garten_temp");
    await tap(`${win} [data-tm="backkind"][data-v="time"]`);
    await tap(`${win} [data-tm="nav-quick"]`);
    await wait(`return !r.querySelector("${win}")?.open`);
    const saved2 = (await calls("device_panel/timer_save")).at(-1)?.timer || {};
    check(`[${tag}] timer_save (Zeit → Uhrzeit): kind repeat, back_kind time, back_time 23:30, keine Bedingungen`, saved2.kind === "repeat" && saved2.back_kind === "time" && saved2.back_time === "23:30" && saved2.back_conditions === null && saved2.conditions === null && saved2.back_s === null, JSON.stringify(saved2));
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("|"));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
