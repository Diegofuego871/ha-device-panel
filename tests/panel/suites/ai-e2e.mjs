// KI-Einschätzung (0.33.0, docs/mockups/backlog-v1, Punkt 10 A): Einstellung
// (aus, bis eingeschaltet; KI-Aufgabe wählbar), Knopf im Geräte-Popup nur
// mit eingeschalteter Option, Antwort als Karte mit Quelle und "Neu
// erstellen", Fehler mit Erklärung, kein Aufruf ohne Knopfdruck. DE/EN,
// Desktop/Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

const TEXT = {
  de: {
    sec: "KI-Einschätzung", sumOff: "Aus", sumOn: "Ein · OpenAI", sumDefault: "Ein · Standard von Home Assistant", opt: "Knopf \"Mit KI einschätzen\" zeigen", task: "KI-Aufgabe",
    taskDefault: "Standard von Home Assistant", button: "Mit KI einschätzen", head: "KI-Einschätzung", title: "Wahrscheinlich Empfang", by: "Erstellt ",
    again: "Neu erstellen", note: "Gesendet werden Name, Bereich und Werte dieses Geräts sowie Name und Werte von Geräten im selben Bereich, am selben Hub, vom selben Modell und weiterer ausgefallener Geräte derselben Integration, keine Schlüssel oder Zugangsdaten.", retry: "Erneut versuchen",
    errNo: "Keine KI-Aufgabe verfügbar", errTimeout: "nicht rechtzeitig", errFailed: "Fehler gemeldet", errEmpty: "zweimal eine leere Antwort", detail: "Meldung der KI-Aufgabe: Error talking to OpenAI: 429 quota exceeded", noTasks: "Keine KI-Aufgabe gefunden", working: "wertet",
    byLocal: "Erstellt von \"Lokales Modell\"",
    ask: "Nachfragen", ph: "Eigene Frage …", q1: "Was soll ich zuerst prüfen?", q2: "Ist es die Batterie?", answer: (q) => `Antwort auf: ${q}`, left3: "Noch 3 Fragen zu dieser Einschätzung", left2: "Noch 2 Fragen", left1: "Noch 1 Frage", done: "keine Rückfragen mehr möglich", errPre: "Einschätzung fehlgeschlagen:",
  },
  en: {
    sec: "AI assessment", sumOff: "Off", sumOn: "On · OpenAI", sumDefault: "On · Home Assistant default", opt: "Show the button \"Assess with AI\"", task: "AI task",
    taskDefault: "Default of Home Assistant", button: "Assess with AI", head: "AI assessment", title: "Probably reception", by: "Created ",
    again: "Create again", note: "Name, area and values of this device and name and values of devices in the same area, on the same hub, of the same model and other offline devices of the same integration are sent, no keys or credentials.", retry: "Try again",
    errNo: "No AI task available", errTimeout: "did not answer in time", errFailed: "reported an error", errEmpty: "empty answer twice", detail: "Message of the AI task: Error talking to OpenAI: 429 quota exceeded", noTasks: "No AI task found", working: "analysing",
    byLocal: "Created by \"Lokales Modell\"",
    ask: "Ask a follow-up", ph: "Your own question …", q1: "What should I check first?", q2: "Is it the battery?", answer: (q) => `Answer to: ${q}`, left3: "3 questions left for this assessment", left2: "2 questions left", left1: "1 question left", done: "No more follow-up questions", errPre: "Assessment failed:",
  },
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
    // Zuerst ohne Vorschläge der KI: dann gelten die festen Pillen (Rückfall); die der KI folgen weiter unten
    await p.evaluate(() => { window.__aiNoNext = true; });
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => {
      const h = await handle(sel);
      if (!h) throw new Error("fehlt: " + sel);
      await h.scrollIntoViewIfNeeded();
      if (mobile) await h.tap(); else await h.click();
    };
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const calls = (type) => p.evaluate((t) => window.__wsCalls.filter((m) => m.type === t), type);
    const open = async (id) => {
      await ev(`r.host._openDevice(${JSON.stringify(id)})`);
      await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('select[data-dlg="conn"]')`);
    };
    const close = async () => {
      await ev(`r.querySelector("dialog.device").close()`);
      await wait(`return !r.querySelector("dialog.device").open`);
    };

    // Aus (Standard): kein Knopf, nie ein Aufruf
    await open("b");
    check(`[${tag}] ohne Option kein Knopf`, !(await ev(`return !!r.querySelector('[data-dlg="ai"]')`)) && (await calls("device_panel/ai_assess")).length === 0);
    await close();

    // Einstellungen: Abschnitt, Schalter, KI-Aufgabe erst bei "ein"
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    check(`[${tag}] Abschnitt "${T.sec}": aus`, (await text('[data-id="ai"] .set-sec-title')) === T.sec && (await text('[data-id="ai"] .set-sec-sum')) === T.sumOff, await text('[data-id="ai"] .set-sec-sum'));
    await tap('[data-set="section"][data-id="ai"]');
    check(`[${tag}] nur der Schalter, noch keine KI-Aufgabe`, (await text(".set-sec-body .opt-label")) === T.opt && !(await ev(`return !!r.querySelector('select[data-opt="ai_task_entity"]')`)));
    await tap('.switch input[data-opt="ai_assessment"]');
    const opts = await ev(`const s=r.querySelector('select[data-opt="ai_task_entity"]'); return [s.value, [...s.options].map(o=>o.textContent).join("|")]`);
    check(`[${tag}] KI-Aufgabe: Standard von HA und die Aufgaben von HA`, opts[0] === "" && opts[1] === `${T.taskDefault}|OpenAI|Lokales Modell`, JSON.stringify(opts));
    check(`[${tag}] Zusammenfassung "${T.sumDefault}"`, (await text('[data-id="ai"] .set-sec-sum')) === T.sumDefault, await text('[data-id="ai"] .set-sec-sum'));
    await (await handle('select[data-opt="ai_task_entity"]')).selectOption("ai_task.openai");
    check(`[${tag}] Zusammenfassung "${T.sumOn}", 2 Änderungen`, (await text('[data-id="ai"] .set-sec-sum')) === T.sumOn && /^2 /.test(await text(".set-count")), await text(".set-count"));
    await p.screenshot({ path: `${outDir}/ai-settings-${tag.replace("/", "-")}.png` });
    await tap('dialog.settings [data-set="save"]');
    await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`);
    const so = (await calls("device_panel/set_options")).at(-1);
    check(`[${tag}] gespeichert`, so?.values?.ai_assessment === true && so?.values?.ai_task_entity === "ai_task.openai", JSON.stringify(so?.values));
    await tap('dialog.settings [data-set="close"]');
    await wait(`return !r.querySelector("dialog.settings").open`);
    await wait(`return r.host._aiOn === true`);

    // Popup: Knopf, Hinweis, noch kein Aufruf
    await open("b");
    check(`[${tag}] Abschnitt "${T.head}" mit Knopf "${T.button}"`, (await text('.ai-btn')) === T.button && (await ev(`return [...r.querySelectorAll("dialog.device h3")].map(h=>h.textContent.trim())`)).includes(T.head));
    check(`[${tag}] Hinweis: nur Name, Bereich, Werte`, (await text(".ai-box .opt-short")).startsWith(T.note), await text(".ai-box .opt-short"));
    check(`[${tag}] noch kein Aufruf ohne Knopfdruck`, (await calls("device_panel/ai_assess")).length === 0);
    // Reihenfolge: nach der Statistik, vor der Verbindung
    const order = await ev(`return [...r.querySelectorAll("dialog.device h3")].map(h=>h.textContent.trim())`);
    check(`[${tag}] Einschätzung steht unter der Statistik`, order.indexOf(T.head) === 1, order.join(","));
    await p.screenshot({ path: `${outDir}/ai-button-${tag.replace("/", "-")}.png` });

    // Antwort (langsam: Wartezustand)
    await p.evaluate(() => { window.__aiMode = "slow"; });
    await tap(".ai-btn");
    check(`[${tag}] Wartezustand`, await wait(`return !!r.querySelector('.ai-card[aria-busy="true"]')`) && (await text(".ai-wait")).includes(T.working));
    check(`[${tag}] Karte mit Überschrift, Text, Quelle und "${T.again}"`, await wait(`return !!r.querySelector(".ai-title") && !!r.querySelector(".ai-foot")`) && (await text(".ai-title")) === T.title && (await text(".ai-text")).length > 20 && (await text(".ai-foot")).startsWith(T.by) && (await text(".ai-head small")) === "OpenAI" && (await text(".ai-foot .linkbtn")) === T.again, await text(".ai-foot"));
    const call = (await calls("device_panel/ai_assess")).at(-1);
    check(`[${tag}] ein Aufruf mit Gerät und Sprache`, (await calls("device_panel/ai_assess")).length === 1 && call.device_id === "b" && call.language === lang, JSON.stringify(call));
    // Zuklappen (2.90.0): die Kopfzeile klappt die Einschätzung zu, der Stand gehört dem Benutzer (Datensatz der Favoriten)
    check(`[${tag}] Kopfzeile ist ein Knopf, aufgeklappt (aria-expanded)`, await ev(`const h = r.querySelector(".ai-box > button.ai-head"); return !!h && h.getAttribute("aria-expanded") === "true" && !!r.querySelector(".ai-card")`));
    await tap(".ai-head");
    check(`[${tag}] zugeklappt: nur die Kopfzeile bleibt, aria-expanded false`, await wait(`const b = r.querySelector(".ai-box"); return b.classList.contains("fold") && !r.querySelector(".ai-card") && !r.querySelector(".ai-box .opt-short") && r.querySelector(".ai-head").getAttribute("aria-expanded") === "false"`));
    check(`[${tag}] gespeichert beim Benutzer (aiFold, lokal und bei HA)`, (await wait(`return JSON.parse(localStorage.getItem("device_panel_favorites") || "{}").aiFold === true`)) && (await p.evaluate(async () => { for (let i = 0; i < 20; i++) { const v = JSON.parse(sessionStorage.getItem("sim_user_data") || "{}").device_panel_favorites; if (v?.aiFold === true) return true; await new Promise((r) => setTimeout(r, 100)); } return false; })));
    await ev(`r.host._renderDevice(true)`);
    check(`[${tag}] bleibt zugeklappt (auch nach Neuaufbau und in einem anderen Gerät)`, await ev(`return r.querySelector(".ai-box").classList.contains("fold")`));
    await tap(".ai-head");
    check(`[${tag}] wieder aufgeklappt: Einschätzung da`, await wait(`return !r.querySelector(".ai-box").classList.contains("fold") && !!r.querySelector(".ai-card")`));
    await p.screenshot({ path: `${outDir}/ai-answer-${tag.replace("/", "-")}.png` });
    const fit = await ev(`const d=r.querySelector("dialog.device"); const c=r.querySelector(".ai-card").getBoundingClientRect(); return [d.scrollWidth <= d.clientWidth, c.right <= d.getBoundingClientRect().right + 1]`);
    check(`[${tag}] Karte ohne seitlichen Überlauf`, fit.every(Boolean), JSON.stringify(fit));
    // Antwort bleibt beim Schliessen und Öffnen (Speicher), Neu erstellen ruft erneut
    await close();
    await open("b");
    check(`[${tag}] Antwort bleibt im Speicher`, (await text(".ai-title")) === T.title && (await calls("device_panel/ai_assess")).length === 1);
    // Nach einem Neustart (Speicher des Panels leer) kommt die letzte Antwort vom Server (ai_last, seit 2.45.0), ohne die KI zu fragen
    await close();
    await ev(`r.host._ai.clear(); r.host._aiLastTried.clear()`);
    await open("b");
    check(`[${tag}] gemerkte Antwort kommt vom Server, ohne neuen Aufruf der KI`, await wait(`return !!r.querySelector(".ai-title")`) && (await text(".ai-title")) === T.title && (await calls("device_panel/ai_last")).length >= 1 && (await calls("device_panel/ai_assess")).length === 1);
    await p.evaluate(() => { window.__aiMode = "ok"; });
    await tap(".ai-foot .linkbtn");
    await wait(`return (window.__wsCalls || []).length >= 0`);
    check(`[${tag}] "${T.again}" ruft erneut auf`, await p.waitForFunction(() => window.__wsCalls.filter((m) => m.type === "device_panel/ai_assess").length === 2, null, { timeout: 5000 }).then(() => true, () => false));
    // Rückfragen (2.48.0): Pillen darüber, Textfeld darunter, höchstens drei, Antworten als Verlauf
    check(`[${tag}] Rückfragen: Titel "${T.ask}", Pillen, Textfeld, Zähler`, (await text(".ai-ask-lbl")) === T.ask && (await ev(`return r.querySelectorAll(".ai-chip").length`)) >= 3 && (await ev(`return r.querySelector(".ai-input")?.placeholder`)) === T.ph && (await text(".ai-ask .opt-short")).startsWith(T.left3), await text(".ai-ask .opt-short"));
    const order2 = await ev(`const a=r.querySelector(".ai-chips").getBoundingClientRect().top, b=r.querySelector(".ai-in").getBoundingClientRect().top; return a < b`);
    check(`[${tag}] Rückfragen: Pillen stehen über dem Textfeld`, order2);
    check(`[${tag}] Rückfragen: Pille "Ist es die Batterie?" nur bei Gerät mit Batterie, erste Pille da`, (await ev(`return [...r.querySelectorAll(".ai-chip")].map(x=>x.textContent.trim())`)).includes(T.q1) && (await ev(`return [...r.querySelectorAll(".ai-chip")].some(x=>x.textContent.trim()===${JSON.stringify(T.q2)})`)) === (await ev(`return !!r.host._devices.find(x=>x.id==="b")?.has_battery`)));
    await p.screenshot({ path: `${outDir}/ai-ask-${tag.replace("/", "-")}.png` });
    await p.evaluate(() => { window.__aiMode = "slow"; });
    await tap(".ai-chip");
    check(`[${tag}] Rückfrage per Pille: Frage erscheint, Wartezustand, Eingabe gesperrt`, await wait(`return r.querySelectorAll(".ai-thread .ai-q").length === 1 && !!r.querySelector(".ai-thread .ai-a.ai-wait") && r.querySelector(".ai-input").disabled`));
    await p.evaluate(() => { window.__aiMode = "ok"; });
    check(`[${tag}] Rückfrage: Antwort im Verlauf`, await wait(`return r.querySelectorAll(".ai-thread .ai-a").length === 1 && !r.querySelector(".ai-wait.ai-a") && r.querySelector(".ai-thread .ai-a").textContent.trim() === ${JSON.stringify(T.answer(T.q1))}`), await text(".ai-thread"));
    const askCall = (await calls("device_panel/ai_ask")).at(-1);
    check(`[${tag}] Rückfrage: Aufruf mit Gerät, Frage, Sprache, leerem Verlauf`, askCall?.device_id === "b" && askCall.question === T.q1 && askCall.language === lang && askCall.history.length === 0, JSON.stringify(askCall));
    check(`[${tag}] Rückfrage: gestellte Pille entfällt, Zähler "${T.left2}"`, !(await ev(`return [...r.querySelectorAll(".ai-chip")].some(x=>x.textContent.trim()===${JSON.stringify(T.q1)})`)) && (await text(".ai-ask .opt-short")).startsWith(T.left2), await text(".ai-ask .opt-short"));
    // Eigene Frage tippen: bleibt beim Neuaufbau (Abfrage alle 10 s) stehen, Enter sendet
    await tap(".ai-input");
    await p.keyboard.type("Warum nachts?");
    await ev(`r.host._renderDevice(true)`);
    check(`[${tag}] getippte Frage übersteht einen Neuaufbau`, (await ev(`return r.querySelector(".ai-input").value`)) === "Warum nachts?");
    await p.keyboard.press("Enter");
    check(`[${tag}] Enter sendet, Feld leer, Verlauf mit der Frage`, await wait(`return r.querySelectorAll(".ai-thread .ai-q").length === 2 && r.querySelector(".ai-input").value === ""`));
    const own = (await calls("device_panel/ai_ask")).at(-1);
    check(`[${tag}] eigene Frage: Aufruf mit Verlauf der ersten`, own.question === "Warum nachts?" && own.history.length === 1 && own.history[0].q === T.q1 && own.history[0].a === T.answer(T.q1), JSON.stringify(own));
    // Fehler: die Frage kommt ins Feld zurück
    await p.evaluate(() => { window.__aiMode = "timeout"; });
    await tap(".ai-input");
    await p.keyboard.type("Noch eine");
    await tap(".ai-send");
    check(`[${tag}] Fehler bei der Rückfrage: Meldung, Frage zurück im Feld, Verlauf unverändert`, await wait(`return !!r.querySelector(".ai-ask .opt-error") && r.querySelector(".ai-input").value === "Noch eine" && r.querySelectorAll(".ai-thread .ai-q").length === 2`), await text(".ai-ask .opt-error"));
    await p.evaluate(() => { window.__aiMode = "ok"; });
    await tap(".ai-send");
    check(`[${tag}] dritte Frage: danach keine Pillen, kein Feld, Hinweis "${T.done}"`, await wait(`return r.querySelectorAll(".ai-thread .ai-q").length === 3 && !r.querySelector(".ai-input") && !r.querySelector(".ai-chip")`) && (await text(".ai-ask .opt-short")).includes(T.done), await text(".ai-ask .opt-short"));
    check(`[${tag}] Rückfragen: höchstens drei Aufrufe`, (await calls("device_panel/ai_ask")).filter((m) => m.device_id === "b").length === 4 /* davon einer mit Fehler */);
    await p.screenshot({ path: `${outDir}/ai-ask-full-${tag.replace("/", "-")}.png` });
    const fit2 = await ev(`const d=r.querySelector("dialog.device"); return d.scrollWidth <= d.clientWidth`);
    check(`[${tag}] Verlauf ohne seitlichen Überlauf`, fit2);
    // "Neu erstellen" beginnt von vorn
    await tap(".ai-foot .linkbtn");
    check(`[${tag}] "${T.again}": Rückfragen beginnen wieder bei drei`, await wait(`return !!r.querySelector(".ai-title") && !r.querySelector(".ai-thread") && !!r.querySelector(".ai-input")`) && (await text(".ai-ask .opt-short")).startsWith(T.left3));
    // Vorschläge der KI (seit 2.51.0): statt der festen Pillen, nach jeder Antwort neue, gestellte fallen weg, bleiben über einen Neustart
    await p.evaluate(() => { window.__aiNoNext = false; });
    await tap(".ai-foot .linkbtn");
    const NEXT1 = lang === "de" ? ["Läuft der Router nachts neu?", "Wie alt ist die Batterie?", "Was heisst Median?"] : ["Does the router restart at night?", "How old is the battery?", "What does median mean?"];
    const chipTexts = () => ev(`return [...r.querySelectorAll(".ai-chip")].map(x=>x.textContent.trim())`);
    check(`[${tag}] Vorschläge der KI statt der festen Pillen`, await wait(`return r.querySelectorAll(".ai-chip").length === 3 && r.querySelector(".ai-chip").textContent.trim() === ${JSON.stringify(NEXT1[0])}`) && JSON.stringify(await chipTexts()) === JSON.stringify(NEXT1), JSON.stringify(await chipTexts()));
    await p.screenshot({ path: `${outDir}/ai-next-${tag.replace("/", "-")}.png` });
    await tap(".ai-chip");
    const follow = lang === "de" ? ["Folgefrage 1a?", "Folgefrage 1b?"] : ["Follow-up 1a?", "Follow-up 1b?"];
    check(`[${tag}] Pille gewählt: Frage gesendet, danach neue Vorschläge zur Antwort, die gestellte fehlt`, await wait(`return r.querySelectorAll(".ai-thread .ai-a").length === 1 && !r.querySelector(".ai-wait.ai-a") && r.querySelectorAll(".ai-chip").length === 2`) && (await calls("device_panel/ai_ask")).at(-1).question === NEXT1[0] && JSON.stringify(await chipTexts()) === JSON.stringify(follow), JSON.stringify(await chipTexts()));
    // Nach einem Neustart (Speicher des Panels leer) kommen die gemerkten Vorschläge mit der Einschätzung
    await close();
    await ev(`r.host._ai.clear(); r.host._aiLastTried.clear()`);
    await open("b");
    check(`[${tag}] Vorschläge bleiben mit der gemerkten Einschätzung erhalten`, await wait(`return r.querySelectorAll(".ai-chip").length === 3`) && JSON.stringify(await chipTexts()) === JSON.stringify(NEXT1), JSON.stringify(await chipTexts()));
    await p.evaluate(() => { window.__aiNoNext = true; });
    // Anderes Gerät hat noch keine Antwort
    await close();
    await open("c");
    check(`[${tag}] anderes Gerät: wieder der Knopf`, (await text(".ai-btn")) === T.button && !(await ev(`return !!r.querySelector(".ai-card")`)));
    // Gewählte KI-Aufgabe als Quelle
    await p.evaluate(() => { window.__opts.ai_task_entity = "ai_task.lokal"; });
    await tap(".ai-btn");
    check(`[${tag}] Quelle folgt der gewählten Aufgabe`, await wait(`return r.querySelector(".ai-head small")?.textContent === "Lokales Modell"`), await text(".ai-head"));
    await close();

    // Fehler
    for (const [mode, expect] of [["no_ai_task", T.errNo], ["timeout", T.errTimeout], ["failed", T.errFailed], ["empty", T.errEmpty]]) {
      await p.evaluate((m) => { window.__aiMode = m; }, mode);
      await open("d");
      await tap(".ai-btn");
      check(`[${tag}] Fehler ${mode}: Erklärung`, await wait(`return !!r.querySelector(".ai-box .opt-error")`) && (await text(".ai-box .opt-error")).includes(expect), await text(".ai-box .opt-error"));
      check(`[${tag}] Fehler ${mode}: "${T.retry}"`, (await text(".ai-btn")) === T.retry);
      // Der Grund der KI-Aufgabe steht dabei (2.42.0), nur bei "failed"
      check(`[${tag}] Fehler ${mode}: Grund der KI-Aufgabe ${mode === "failed" ? "sichtbar" : "nicht angezeigt"}`, mode === "failed" ? (await text(".ai-box .ai-detail")) === T.detail : !(await ev(`return !!r.querySelector(".ai-box .ai-detail")`)), await text(".ai-box"));
      await close();
      await ev(`r.host._ai.clear()`);
    }
    // Fehler ohne Text (Verbindung): kein "[object Object]"
    await p.evaluate(() => { window.__aiMode = "object"; });
    await open("d");
    await tap(".ai-btn");
    await wait(`return !!r.querySelector(".ai-box .opt-error")`);
    check(`[${tag}] Fehler ohne Text: kein "[object Object]"`, !(await text(".ai-box .opt-error")).includes("[object Object]"), await text(".ai-box .opt-error"));
    await close();

    // Ausgeschaltet: Knopf weg
    await p.evaluate(() => { window.__opts.ai_assessment = false; });
    await ev(`r.host._fetch(true)`);
    await wait(`return r.host._aiOn === false`);
    await open("b");
    check(`[${tag}] wieder aus: kein Knopf, keine Karte`, !(await ev(`return !!r.querySelector('[data-dlg="ai"]') || !!r.querySelector(".ai-card")`)));
    await close();

    // Keine KI-Aufgabe in HA: Hinweis in den Einstellungen
    await p.evaluate(() => { window.__aiTasks = []; window.__opts.ai_assessment = true; });
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="ai"]');
    check(`[${tag}] keine KI-Aufgabe: Hinweis`, (await text(".set-sec-body")).includes(T.noTasks), await text(".set-sec-body"));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
