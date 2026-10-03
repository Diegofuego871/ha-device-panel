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
    taskDefault: "Standard von Home Assistant", button: "Mit KI einschätzen", head: "Einschätzung", title: "Wahrscheinlich Empfang", by: "Erstellt von \"OpenAI\"",
    again: "Neu erstellen", note: "Gesendet werden Name, Bereich und Werte dieses Geräts, keine Schlüssel oder Zugangsdaten.", retry: "Erneut versuchen",
    errNo: "Keine KI-Aufgabe verfügbar", errTimeout: "nicht rechtzeitig", errFailed: "Fehler gemeldet", noTasks: "Keine KI-Aufgabe gefunden", working: "wertet",
    byLocal: "Erstellt von \"Lokales Modell\"",
  },
  en: {
    sec: "AI assessment", sumOff: "Off", sumOn: "On · OpenAI", sumDefault: "On · Home Assistant default", opt: "Show the button \"Assess with AI\"", task: "AI task",
    taskDefault: "Default of Home Assistant", button: "Assess with AI", head: "Assessment", title: "Probably reception", by: "Created by \"OpenAI\"",
    again: "Create again", note: "Name, area and values of this device are sent, no keys or credentials.", retry: "Try again",
    errNo: "No AI task available", errTimeout: "did not answer in time", errFailed: "reported an error", noTasks: "No AI task found", working: "analysing",
    byLocal: "Created by \"Lokales Modell\"",
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
    check(`[${tag}] Karte mit Überschrift, Text, Quelle und "${T.again}"`, await wait(`return !!r.querySelector(".ai-title") && !!r.querySelector(".ai-foot")`) && (await text(".ai-title")) === T.title && (await text(".ai-text")).length > 20 && (await text(".ai-foot")).startsWith(T.by) && (await text(".ai-foot .linkbtn")) === T.again, await text(".ai-foot"));
    const call = (await calls("device_panel/ai_assess")).at(-1);
    check(`[${tag}] ein Aufruf mit Gerät und Sprache`, (await calls("device_panel/ai_assess")).length === 1 && call.device_id === "b" && call.language === lang, JSON.stringify(call));
    await p.screenshot({ path: `${outDir}/ai-answer-${tag.replace("/", "-")}.png` });
    const fit = await ev(`const d=r.querySelector("dialog.device"); const c=r.querySelector(".ai-card").getBoundingClientRect(); return [d.scrollWidth <= d.clientWidth, c.right <= d.getBoundingClientRect().right + 1]`);
    check(`[${tag}] Karte ohne seitlichen Überlauf`, fit.every(Boolean), JSON.stringify(fit));
    // Antwort bleibt beim Schliessen und Öffnen (Speicher), Neu erstellen ruft erneut
    await close();
    await open("b");
    check(`[${tag}] Antwort bleibt im Speicher`, (await text(".ai-title")) === T.title && (await calls("device_panel/ai_assess")).length === 1);
    await p.evaluate(() => { window.__aiMode = "ok"; });
    await tap(".ai-foot .linkbtn");
    await wait(`return (window.__wsCalls || []).length >= 0`);
    check(`[${tag}] "${T.again}" ruft erneut auf`, await p.waitForFunction(() => window.__wsCalls.filter((m) => m.type === "device_panel/ai_assess").length === 2, null, { timeout: 5000 }).then(() => true, () => false));
    // Anderes Gerät hat noch keine Antwort
    await close();
    await open("c");
    check(`[${tag}] anderes Gerät: wieder der Knopf`, (await text(".ai-btn")) === T.button && !(await ev(`return !!r.querySelector(".ai-card")`)));
    // Gewählte KI-Aufgabe als Quelle
    await p.evaluate(() => { window.__opts.ai_task_entity = "ai_task.lokal"; });
    await tap(".ai-btn");
    check(`[${tag}] Quelle folgt der gewählten Aufgabe`, await wait(`return r.querySelector(".ai-foot")?.textContent.includes("Lokales Modell")`), await text(".ai-foot"));
    await close();

    // Fehler
    for (const [mode, expect] of [["no_ai_task", T.errNo], ["timeout", T.errTimeout], ["failed", T.errFailed]]) {
      await p.evaluate((m) => { window.__aiMode = m; }, mode);
      await open("d");
      await tap(".ai-btn");
      check(`[${tag}] Fehler ${mode}: Erklärung`, await wait(`return !!r.querySelector(".ai-box .opt-error")`) && (await text(".ai-box .opt-error")).includes(expect), await text(".ai-box .opt-error"));
      check(`[${tag}] Fehler ${mode}: "${T.retry}"`, (await text(".ai-btn")) === T.retry);
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
