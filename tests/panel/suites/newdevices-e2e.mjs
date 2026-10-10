// Push bei neuen Geräten (1.24.0): Reiter "Neu" in "Überwachung und Meldungen" nach dem Muster von
// Ausfall und Batterie: Zeile in der Übersicht mit Balken und Chips, Zeitstrahl mit Sammelfenster,
// Schalter, anhaltende Benachrichtigung, Inhalt der Meldung mit Vorschau, Abweichungen und Override
// pro Integration (Schalter im Detail, Liste, "Alles auf Standard"). Deutsch und Englisch,
// Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir, ensureIntegTab } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: {
    tab: "Neu", lane: "Neue Geräte", zero: "Gerät gefunden", push: "Push", pers: "Anhaltend", noTarget: "kein Ziel gewählt", noPush: "Kein Push", newPush: "Push \"Neues Gerät\"",
    window: "Sammeln während", optNotify: "Neue Geräte melden", fields: "Inhalt der Meldung", pvTitle: (n) => `✨ Neues Gerät: ${n}`, noNew: "Neue Geräte ohne Push", range: "Erlaubt: 1 bis 60",
    grp: "Neue Geräte", diffTitle: "1 Integration weicht ab", gOff: "Die Meldung bei neuen Geräten ist global ausgeschaltet oder ohne Ziel (Reiter \"Neu\"); diese Einstellung gilt, sobald sie eingeschaltet ist.",
  },
  en: {
    tab: "New", lane: "New devices", zero: "device found", push: "Push", pers: "Persistent", noTarget: "no target chosen", noPush: "No push", newPush: "push \"New device\"",
    window: "Collect for", optNotify: "Report new devices", fields: "Content of the notification", pvTitle: (n) => `✨ New device: ${n}`, noNew: "New devices without push", range: "Allowed: 1 to 60",
    grp: "New devices", diffTitle: "1 integration differs", gOff: "The notification for new devices is switched off globally or has no target (tab \"New\"); this setting applies as soon as it is on.",
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
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = async (c) => { await ensureIntegTab(f, R, c); return f.evaluate(new Function(`const r=${R};` + c)); };
    const handle = async (sel) => { await ensureIntegTab(f, R, sel); return (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement(); };
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wait = async (code) => { await ensureIntegTab(f, R, code); return f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false); };
    const setCalls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_options").map((m) => m.values));
    const tab = async (key) => { await tap(`[data-set="tab"][data-key="${key}"]`); await wait(`return r.querySelector('.mon-tab.on')?.dataset.key === "${key}"`); };
    const save = async () => { await tap('dialog.settings [data-set="save"]'); return wait(`return r.querySelector(".set-count")?.classList.contains("saved")`); };

    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await wait(`return !!r.querySelector(".lane")`);

    // Übersicht: dritte Zeile "Neue Geräte" mit einem Balken, ohne Ziel "Kein Push"
    check(`[${tag}] Übersicht: fünf Zeilen, "${T.lane}" mit Null "${T.zero}" und "${T.noPush}"`, (await ev(`return r.querySelectorAll(".lane").length`)) === 5 && (await text('[data-lane="new"] .lane-t')) === T.lane && (await text('[data-lane="new"] .ptl-zero span')) === T.zero && (await text('[data-lane="new"] .mk-off b')) === T.noPush && (await text('[data-lane="new"] .mk-off span')) === T.noTarget, await text('[data-lane="new"]'));
    check(`[${tag}] Chips Push und Anhaltend aus`, (await ev(`return [...r.querySelectorAll('[data-lane="new"] .mon-chip')].map(c=>c.textContent.trim()+":"+c.getAttribute("aria-pressed")).join()`)) === `${T.push}:false,${T.pers}:false`);
    check(`[${tag}] Reiter mit "${T.tab}" vor "Integrationen"`, (await ev(`return [...r.querySelectorAll(".mon-tab")].map(t=>t.dataset.key).join()`)) === "overview,outage,battery,charge,new,updates,integ");

    // Reiter "Neu"
    await tap('[data-lane="new"] [data-set="tab"][data-key="new"]');
    await wait(`return r.querySelector('.mon-tab.on')?.dataset.key === "new"`);
    check(`[${tag}] Zeitstrahl: Null "${T.zero}", Feld "${T.window}" mit 5 Min.`, (await text(".ptl-zero span")) === T.zero && (await text(".ptl-row b")) === T.window && (await ev(`return r.querySelector('input[data-opt="new_window"]').value`)) === "5");
    check(`[${tag}] Schalter "${T.optNotify}" aus, Inhalt "${T.fields}" ohne Vorschau`, !(await ev(`return r.querySelector('input[data-opt="notify_new"]').checked`)) && !(await ev(`return !!r.querySelector(".pv")`)) && (await ev(`return [...r.querySelectorAll(".opt-label")].some(x=>x.textContent.trim()===${JSON.stringify(T.fields)})`)));
    check(`[${tag}] Inhalt: vier Schalter, Standard Bereich und Integration`, (await ev(`return [...r.querySelectorAll('input[data-newfield]')].map(i=>i.dataset.newfield+(i.checked?"+":"-")).join()`)) === "area+,integration+,connection-,model-");

    // Einschalten: Warnung ohne Ziel, Vorschau erscheint
    await tap('input[data-opt="notify_new"]');
    check(`[${tag}] eingeschaltet ohne Ziel: Vorschau "${T.pvTitle("…")}"`, await wait(`return !!r.querySelector(".pv")`) && (await text(".pv-title")).startsWith(T.pvTitle("").trim()), await text(".pv"));
    // Fenster ausserhalb: Fehler und Speichern gesperrt
    const win = await handle('input[data-opt="new_window"]');
    await win.scrollIntoViewIfNeeded();
    await win.fill("0");
    check(`[${tag}] 0 Min.: Fehler "${T.range}", Speichern gesperrt`, await wait(`return !r.querySelector("[data-tl-error]").hidden && r.querySelector('[data-set="save"]').disabled`) && (await text("[data-tl-error]")) === T.range, await text("[data-tl-error]"));
    await win.fill("10");
    // Inhalt: Verbindungsart und Hersteller dazu, Bereich weg: Vorschau folgt
    await tap('input[data-newfield="connection"]');
    await tap('input[data-newfield="area"]');
    check(`[${tag}] Inhalt geändert: Vorschau ohne Bereich, mit Verbindungsart`, await wait(`return !!r.querySelector(".pv-text")`) && !(await ev(`return r.querySelector('input[data-newfield="area"]').checked`)) && (await ev(`return r.querySelector('input[data-newfield="connection"]').checked`)), await text(".pv-text"));
    await tap('input[data-opt="new_persistent"]');
    if (mobile) check(`[${tag}] Handy ohne Überlauf`, (await ev(`const d=r.querySelector("dialog.settings"); return d.scrollWidth - d.clientWidth`)) <= 1);
    await ev(`r.querySelector(".pv").scrollIntoView({ block: "center" })`);
    await p.screenshot({ path: `${outDir}/newdevices-${tag.replace("/", "-")}.png` });
    check(`[${tag}] gespeichert: Optionen`, (await save()) && JSON.stringify((await setCalls()).at(-1)) === JSON.stringify({ notify_new: true, new_window: 10, new_persistent: true, new_fields: ["integration", "connection"] }), JSON.stringify((await setCalls()).at(-1)));
    check(`[${tag}] Punkt am Reiter weg, Tab-Zusammenfassung`, !(await ev(`return r.querySelector('.mon-tab[data-key="new"]').classList.contains("chg")`)));

    // Übersicht: mit Ziel nach Wahl eines Ziels: Balken "10 Min." mit Push
    await tab("overview");
    const target = await ev(`return [...r.querySelector('select[data-opt="notify_service"]').options].map(o=>o.value).find(v=>v.startsWith("notify.")) || ""`);
    await (await handle('select[data-opt="notify_service"]')).selectOption(target);
    check(`[${tag}] Übersicht mit Ziel: Balken 10 Min., "${T.newPush}", Chips an`, await wait(`return r.querySelector('[data-lane="new"] .mk-p b')?.textContent === ${JSON.stringify(lang === "de" ? "10 Min." : "10 min")}`) && (await text('[data-lane="new"] .mk-p span')) === T.newPush && (await ev(`return [...r.querySelectorAll('[data-lane="new"] .mon-chip')].every(c=>c.getAttribute("aria-pressed")==="true")`)), await text('[data-lane="new"]'));

    // Override pro Integration: Schalter im Detail
    await tab("integ");
    await wait(`return !!r.querySelector(".ilist")`);
    await tap('[data-set="integ"][data-key="shelly"]');
    await wait(`return !!r.querySelector('[data-imon="shelly"]')`);
    check(`[${tag}] Detail: Abschnitt "${T.grp}" mit Schalter "${T.optNotify}", an`, (await ev(`return !!r.querySelector('input[data-list="new_exclude_integrations"]')`)) && (await ev(`return [...r.querySelectorAll(".lvl-tabs .sub-tab.on")].map(x=>x.dataset.key).join() === "new"`)) && (await ev(`return r.querySelector('input[data-list="new_exclude_integrations"][data-value="shelly"]').checked`)));
    check(`[${tag}] Ziel und Schalter an: kein Hinweis`, !(await ev(`return [...r.querySelectorAll(".mon-hint")].some(x=>x.textContent.trim()===${JSON.stringify(T.gOff)})`)));
    await tap('input[data-list="new_exclude_integrations"][data-value="shelly"]');
    check(`[${tag}] ausgeschaltet: Zeile geändert, "Eigene"`, await wait(`const i=r.querySelector('input[data-list="new_exclude_integrations"][data-value="shelly"]'); return !i.checked && i.closest(".opt").classList.contains("changed")`) && (await ev(`return r.querySelector('input[data-list="new_exclude_integrations"][data-value="shelly"]').closest(".opt").querySelector(".origin").textContent`)) === (lang === "de" ? "Eigene" : "Own"));
    // Auch bei "Nicht überwachen" bedienbar
    await tap('input[data-imon="shelly"]');
    check(`[${tag}] nicht überwacht: Schalter bleibt bedienbar`, !(await ev(`return r.querySelector('input[data-list="new_exclude_integrations"][data-value="shelly"]').disabled`)));
    await tap('input[data-imon="shelly"]');
    await tap('[data-set="integ"][data-key=""]');
    await wait(`return !!r.querySelector(".ilist")`);
    check(`[${tag}] Liste: Shelly "${T.noNew}"`, (await text('.ilist-row[data-key="shelly"] .ilist-diff')) === T.noNew, await text('.ilist-row[data-key="shelly"] .ilist-diff'));
    // Reiter "Neu": Abweichungen
    await tab("new");
    check(`[${tag}] Abweichungen: "${T.diffTitle}", Shelly "${T.noNew}"`, (await text(".mon-diff .opt-label")) === T.diffTitle && (await text(".mon-diff .opt-short")).includes(T.noNew), await text(".mon-diff"));
    check(`[${tag}] gespeichert: Ausschluss`, (await save()) && JSON.stringify((await setCalls()).at(-1)).includes('"new_exclude_integrations":["shelly"]'), JSON.stringify((await setCalls()).at(-1)));
    // "Alles auf Standard" der Integration nimmt den Ausschluss weg
    await tab("integ");
    await tap('[data-set="integ"][data-key="shelly"]');
    await wait(`return !!r.querySelector('[data-set="integ-reset"]')`);
    await tap('[data-set="integ-reset"][data-key="shelly"]');
    check(`[${tag}] "Alles auf Standard": Schalter wieder an`, await wait(`return r.querySelector('input[data-list="new_exclude_integrations"][data-value="shelly"]').checked`));
    check(`[${tag}] gespeichert: Ausschluss leer`, (await save()) && JSON.stringify((await setCalls()).at(-1)).includes('"new_exclude_integrations":[]'), JSON.stringify((await setCalls()).at(-1)));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
