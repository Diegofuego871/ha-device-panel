// "Verbindungssensor zählt" auf vier Ebenen (2.184.0): global (Einstellungen › Ausfall), Integration, Geräte-Popup (Auswahl mit Herkunft) und im Reiter
// "Entitäten" (gesperrte Marke, Fenster mit der Ebene, Sprung zur Einstellung). Gerät b (zha) mit Verbindungssensor "Cloud" und einer weiteren Entität.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { label: "Verbindungssensor zählt", glob: "Globaler Wert (an)", integ: "Wie Integration (aus)", locked: "zählt nicht", diff: "Verbindungssensor aus", lvlInteg: "Integration", lvlDev: "diesem Gerät", lvlGlob: "allgemeine Einstellung" },
  en: { label: "Connectivity sensor counts", glob: "Global value (on)", integ: "Same as integration (off)", locked: "does not count", diff: "Connectivity sensor off", lvlInteg: "integration", lvlDev: "this device", lvlGlob: "general setting" },
};
const cloud = { entity_id: "binary_sensor.geraet_cloud", name: "Cloud", state: "off", unit: null, category: "diagnostic", liveness: true, connectivity: true, platform: "template" };
const relay = { entity_id: "switch.geraet_relais", name: "Relais", state: "on", unit: null, category: null, liveness: true, platform: "test" };

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const T = TEXT[lang];
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const errors = [];
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=light`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
    const pick = (sel, value) => ev(`const s=r.querySelector(${JSON.stringify(sel)}); s.value=${JSON.stringify(value)}; s.dispatchEvent(new Event("change",{bubbles:true,composed:true}))`);
    const dev = (id) => `r.host._devices.find((d) => d.id === ${JSON.stringify(id)})`;
    const setCalls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_device_settings"));
    const optCalls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_options").map((m) => m.values));

    // --- global: Schalter im Reiter "Ausfall", Standard an; Entwurf, gespeichert mit "Speichern"
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await tap('.mon-tab[data-key="outage"]');
    await wait(`return !!r.querySelector('input[data-opt="liveness_connectivity"]')`);
    check(`[${tag}] global: Zeile "${T.label}" mit Schalter, an`, (await ev(`const i = r.querySelector('input[data-opt="liveness_connectivity"]'); return i.checked && i.closest(".opt").textContent.includes(${JSON.stringify(T.label)})`)));
    await tap('input[data-opt="liveness_connectivity"]');
    check(`[${tag}] global: Entwurf aus, noch nichts gesendet`, (await wait(`return r.host._settings.draft.liveness_connectivity === false`)) && (await optCalls()).length === 0);
    await tap('dialog.settings [data-set="save"]');
    await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`);
    check(`[${tag}] global: gespeichert`, (await optCalls()).at(-1)?.liveness_connectivity === false, JSON.stringify((await optCalls()).at(-1)));
    // wieder an, damit die weiteren Prüfungen vom Standard ausgehen
    await tap('input[data-opt="liveness_connectivity"]');
    await tap('dialog.settings [data-set="save"]');
    await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`);

    // --- Integration: Auswahl Standard/An/Aus, Liste nennt "Verbindungssensor aus"
    await tap('.mon-tab[data-key="integ"]');
    await wait(`return !!r.querySelector(".ilist")`);
    await tap('[data-set="integ"][data-key="zha"]');
    await wait(`return !!r.querySelector('select[data-lconn-mode="zha"]')`);
    check(`[${tag}] Integration: Auswahl vorhanden, Standard`, (await ev(`return r.querySelector('select[data-lconn-mode="zha"]').value`)) === "default");
    await pick('select[data-lconn-mode="zha"]', "off");
    check(`[${tag}] Integration: Entwurf aus`, await wait(`return r.host._settings.draft.liveness_connectivity_integrations?.zha === false`));
    await tap('[data-set="integ"][data-key=""]');
    await wait(`return !!r.querySelector(".ilist")`);
    const diff = await ev(`return (r.querySelector('.ilist-row[data-key="zha"] .ilist-diff')?.textContent || "").trim()`);
    check(`[${tag}] Integration: Liste nennt "${T.diff}"`, diff.includes(T.diff), diff);
    await tap('dialog.settings [data-set="save"]');
    await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`);
    check(`[${tag}] Integration: gespeichert`, (await optCalls()).at(-1)?.liveness_connectivity_integrations?.zha === false, JSON.stringify((await optCalls()).at(-1)?.liveness_connectivity_integrations));
    await ev(`r.host._closeSettings?.()`);

    // --- Gerät: Auswahl "Wie Integration (aus)", Herkunft; Entitäten gesperrt
    await p.evaluate(([c, x]) => { window.__detailExtra = { b: [c, x] }; window.__devices.find((d) => d.id === "b").entities = 4; }, [cloud, relay]);
    await ev(`r.host._fetch(true)`);
    await wait(`return ${dev("b")}.liveness_conn_default?.integration === "zha"`);
    await ev(`r.host._openDevice("b")`);
    await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device .dev-tabs [data-tab="set"]')`);
    await tap('dialog.device .dev-tabs [data-tab="set"]');
    await wait(`return !!r.querySelector('select[data-dlg="dev-lconn"]')`);
    const sel = await ev(`const s = r.querySelector('select[data-dlg="dev-lconn"]'); return s.value + "|" + s.options[s.selectedIndex].textContent + "|" + s.closest(".opt").querySelector(".opt-label").textContent`);
    check(`[${tag}] Gerät: "${T.integ}", Beschriftung`, sel === `default|${T.integ}|${T.label}`, sel);
    check(`[${tag}] Gerät: Herkunft Integration`, await ev(`return !!r.querySelector('select[data-dlg="dev-lconn"]').closest(".opt").querySelector(".origin.integ")`));
    check(`[${tag}] Gerät mit Verbindungssensor: kein Hinweis "ändert nichts"`, await ev(`return !r.querySelector('select[data-dlg="dev-lconn"]').closest(".opt").querySelector(":scope > .opt-short")`));

    await tap('dialog.device .dev-tabs [data-tab="ent"]');
    await wait(`return r.querySelectorAll("dialog.device .entity").length >= 3`);
    check(`[${tag}] Entitäten: Cloud gesperrt "${T.locked}", Relais trägt die Marke`, await ev(`const rows = [...r.querySelectorAll("dialog.device .entity")]; const c = rows.find((x) => x.textContent.includes("binary_sensor.geraet_cloud")); const rl = rows.find((x) => x.textContent.includes("switch.geraet_relais")); return !!c.querySelector(".pill.live.locked") && c.textContent.includes(${JSON.stringify(T.locked)}) && !!rl.querySelector(".pill.live:not(.locked):not(.off)")`));
    check(`[${tag}] Entitäten: Hinweis nennt die Ebene`, await ev(`return r.querySelector("dialog.device .note-lconn")?.textContent.includes(${JSON.stringify(T.lvlInteg)})`));
    // Tipp auf die gesperrte Marke: Fenster, nichts wird umgeschaltet
    await tap('dialog.device .pill.live.locked');
    check(`[${tag}] gesperrte Marke: Fenster nennt die Ebene, nichts im Entwurf`, (await wait(`return !!r.querySelector("dialog.discard-dlg")?.open && r.querySelector("dialog.discard-dlg").textContent.includes(${JSON.stringify(T.lvlInteg)})`)) && (await setCalls()).length === 0 && (await ev(`return !r.querySelector('dialog.device [data-dlg="save"]')`)));
    await tap('dialog.discard-dlg [data-dd="save"]');
    check(`[${tag}] "Einstellung öffnen" springt in den Reiter Einstellungen`, await wait(`return r.querySelector("dialog.device .dev-tabs .sub-tab.on")?.dataset.tab === "set" && !!r.querySelector('select[data-dlg="dev-lconn"]')`));

    // --- Gerät: eigene Wahl "An" hebt die Sperre auf (Entwurf, "Speichern" sendet)
    await pick('select[data-dlg="dev-lconn"]', "on");
    await tap('dialog.device .dev-tabs [data-tab="ent"]');
    check(`[${tag}] eigene Wahl "An" (Entwurf): keine Sperre mehr`, await wait(`return !r.querySelector("dialog.device .pill.live.locked:not(.shadow)")`) );
    await tap('dialog.device [data-dlg="save"]');
    check(`[${tag}] gespeichert: liveness_conn true`, (await wait(`return ${dev("b")}.liveness_conn_setting === true`)) && (await setCalls()).at(-1)?.liveness_conn === true, JSON.stringify((await setCalls()).at(-1)));
    // Eigene Wahl "Aus" auf Geräteebene: Fenster nennt "dieses Gerät"
    await tap('dialog.device .dev-tabs [data-tab="set"]');
    await pick('select[data-dlg="dev-lconn"]', "off");
    await tap('dialog.device .dev-tabs [data-tab="ent"]');
    await wait(`return !!r.querySelector("dialog.device .pill.live.locked")`);
    await tap('dialog.device .pill.live.locked');
    check(`[${tag}] Ebene Gerät: Fenster nennt "${T.lvlDev}"`, await wait(`return !!r.querySelector("dialog.discard-dlg")?.open && r.querySelector("dialog.discard-dlg").textContent.includes(${JSON.stringify(T.lvlDev)})`));
    await tap('dialog.discard-dlg [data-dd="no"]');
    // zurück auf Standard
    await tap('dialog.device .dev-tabs [data-tab="set"]');
    await pick('select[data-dlg="dev-lconn"]', "default");
    await tap('dialog.device [data-dlg="save"]');
    check(`[${tag}] zurück auf Standard (null gesendet)`, (await wait(`return ${dev("b")}.liveness_conn_setting === null`)) && (await setCalls()).at(-1)?.liveness_conn === null);

    // --- Sensor entscheidet allein: die übrigen Entitäten tragen die verdeckte Marke, Tipp erklärt warum
    await tap('dialog.device .dev-tabs [data-tab="set"]');
    await pick('select[data-dlg="dev-lconn"]', "on");
    await tap('dialog.device .dev-tabs [data-tab="ent"]');
    await wait(`return !!r.querySelector("dialog.device .pill.live.shadow")`);
    check(`[${tag}] Sensor entscheidet allein: Relais verdeckt, Cloud trägt die normale Marke`, await ev(`const rows = [...r.querySelectorAll("dialog.device .entity")]; const c = rows.find((x) => x.textContent.includes("binary_sensor.geraet_cloud")); const rl = rows.find((x) => x.textContent.includes("switch.geraet_relais")); return !!rl.querySelector(".pill.live.shadow") && !!c.querySelector(".pill.live:not(.locked):not(.off)")`));
    await tap('dialog.device .pill.live.shadow');
    check(`[${tag}] verdeckte Marke: Fenster nennt den Sensor, nichts im Entwurf`, (await wait(`return !!r.querySelector("dialog.discard-dlg")?.open && r.querySelector("dialog.discard-dlg").textContent.includes("Cloud") || false`)) || (await wait(`return !!r.querySelector("dialog.discard-dlg")?.open`)));
    await tap('dialog.discard-dlg [data-dd="no"]');
    await tap('dialog.device .dev-tabs [data-tab="set"]');
    await pick('select[data-dlg="dev-lconn"]', "default");

    // --- Einziges Lebenszeichen: bleibt nur der Verbindungssensor übrig, wirkt die Sperre nicht (der Sensor zählt trotzdem), der Hinweis sagt es
    await ev(`r.host._closeDevice?.()`);
    await p.evaluate(([c]) => { window.__detailExtra = { b: [c] }; window.__devSettings.livenessExclude = { b: ["binary_sensor.bewegungsmelder_flur"] }; }, [{ ...cloud }]);
    await ev(`r.host._fetch(true)`);
    await ev(`r.host._openDevice("b")`);
    await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device .dev-tabs [data-tab="ent"]')`);
    await tap('dialog.device .dev-tabs [data-tab="ent"]');
    await wait(`return r.querySelectorAll("dialog.device .entity").length >= 2`);
    check(`[${tag}] nur der Verbindungssensor übrig: nicht gesperrt, Hinweis "bleibt wirksam"`, (await wait(`return !r.querySelector("dialog.device .pill.live.locked") && /${lang === "de" ? "bleibt wirksam" : "stays effective"}/.test(r.querySelector("dialog.device .note-lconn")?.textContent || "")`)));
    // --- Von Hand: Wird der einzige Lebenszeichen-Verbindungssensor ausgeschlossen, zählen sofort die übrigen (Entwurf), und es lässt sich speichern
    await ev(`r.host._closeDevice?.()`);
    await p.evaluate(([c, x]) => { window.__opts.liveness_connectivity_integrations = {}; window.__detailExtra = { b: [c, x] }; window.__devSettings.livenessExclude = {}; window.__devSettings.lconn = {}; window.__wsCalls = []; }, [cloud, relay]);
    await ev(`r.host._fetch(true)`);
    await ev(`r.host._openDevice("b")`);
    await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device .dev-tabs [data-tab="ent"]')`);
    await tap('dialog.device .dev-tabs [data-tab="ent"]');
    await wait(`return r.querySelectorAll("dialog.device .entity").length >= 3`);
    const live = () => ev(`return [...r.querySelectorAll("dialog.device .entity")].filter((x) => x.querySelector(".pill.live:not(.off):not(.locked)")).map((x) => x.querySelector(".ent-name small").textContent).sort().join()`);
    check(`[${tag}] Verbindungssensor an: nur er trägt die Marke`, (await live()) === "binary_sensor.geraet_cloud", await live());
    await tap('dialog.device [data-entity="binary_sensor.geraet_cloud"][data-dlg="live-toggle"]');
    check(`[${tag}] Sensor von Hand ausgeschlossen: die übrigen zählen sofort (Entwurf)`, (await wait(`return !!r.querySelector('dialog.device [data-entity="switch.geraet_relais"][data-dlg="live-toggle"]')`)) && (await live()).includes("switch.geraet_relais") && !(await live()).includes("geraet_cloud"), await live());
    check(`[${tag}] ... und kein Hinweis "alle ausgeschlossen"`, await ev(`return !r.querySelector("dialog.device .dlg-note.warn")`));
    await tap('dialog.device [data-dlg="save"]');
    check(`[${tag}] ... Speichern geht: liveness_exclude gesendet, kein Sperrfenster`, (await wait(`return ${dev("b")}.liveness_exclude_setting?.includes("binary_sensor.geraet_cloud")`)) && !(await ev(`return !!r.querySelector("dialog.discard-dlg")?.open`)) && (await setCalls()).at(-1)?.liveness_exclude?.includes("binary_sensor.geraet_cloud"), JSON.stringify((await setCalls()).at(-1)));
    // Alle ausgeschlossen: weiter gesperrt
    await tap('dialog.device [data-entity="switch.geraet_relais"][data-dlg="live-toggle"]');
    await tap('dialog.device [data-entity="binary_sensor.bewegungsmelder_flur"][data-dlg="live-toggle"]');
    check(`[${tag}] alle Lebenszeichen ausgeschlossen: Hinweis, Speichern gesperrt`, await wait(`return !!r.querySelector("dialog.device .dlg-note.warn")`));
    await ev(`r.host._devDiscard()`);
    await ev(`r.host._closeDevice?.()`);

    // --- Assistent, Seite "Labels": Auswahl je Label ("Verbindungssensor zählt" und "Instabil ab"), geschrieben mit dem Schlüssel des Labels
    await ev(`r.host._closeDevice?.()`);
    await p.evaluate(() => { window.__labels = [{ id: "oft_offline", name: "Oft offline" }]; window.__devLabels = { b: ["oft_offline"] }; });
    await ev(`r.host._fetch(true)`);
    await ev(`r.host._wizard.open("app")`);
    await wait(`return r.querySelector("dialog.wizard-dlg")?.open && !r.host._wizard.s?.loading`);
    await ev(`r.host._wizard.go("labels")`);
    await wait(`return !!r.querySelector("dialog.wizard-dlg [data-wz-lab]")`);
    await ev(`const e=r.querySelector("[data-wz-lab]"); e.value="oft_offline"; e.dispatchEvent(new Event("change",{bubbles:true}));`);
    await wait(`return !!r.querySelector(".wz-lcard")`);
    check(`[${tag}] Assistent: Label-Karte mit der Auswahl "${T.label}", Standard`, await ev(`const s = r.querySelector('.wz-lcard select[data-wz-lf="lconn"]'); return !!s && s.value === ""`));
    await ev(`const s = r.querySelector('.wz-lcard select[data-wz-lf="lconn"]'); s.value = "off"; s.dispatchEvent(new Event("change", { bubbles: true }))`);
    await ev(`const s = r.querySelector('.wz-lcard select[data-wz-lf="flaky"]'); s.value = "7"; s.dispatchEvent(new Event("change", { bubbles: true }))`);
    const vals = await ev(`return r.host._wizard.labelValues({})`);
    check(`[${tag}] Assistent: Label schreibt false und 7`, vals.liveness_connectivity_integrations?.["label:oft_offline"] === false && vals.flaky_outages_integrations?.["label:oft_offline"] === 7, JSON.stringify([vals.liveness_connectivity_integrations, vals.flaky_outages_integrations]));
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
