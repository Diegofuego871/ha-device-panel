// Geräteprotokoll (2.118.0, docs/mockups/storage-devlog-v1, Variante A): Knopf "Protokoll" in der Schnellzeile des Geräte-Popups, Liste "Alles" nach
// Tagen mit Chips (nur Kategorien mit Einträgen), Suche, Magic-Push-Zeile klappt den Inhalt auf, Routine-Zeile öffnet den Trace, die Reiter
// "Magic Push" und "Routinen" behalten ihre Auswertung; dasselbe Fenster öffnet aus den Gesamtübersichten (Knopf im Kopf) über alle Geräte.
// Deutsch und Englisch, Desktop und Handy, echte Klicks und Taps.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXTS_OLD = {
  de: { title: "Protokoll", device: "Protokoll des Geräts", all: "Alle Meldungen", allR: "Alle Routinen", recovered: "Wieder normal", copied: "Kopiert", err: "konnte nicht geladen werden", traceCopy: "Trace kopieren", of: (n, m) => `${n} von ${m} Einträgen`, back: "Zurück" },
  en: { title: "History", device: "History of the device", all: "All messages", allR: "All routines", recovered: "Back to normal", copied: "Copied", err: "could not be loaded", traceCopy: "Copy trace", of: (n, m) => `${n} of ${m} entries`, back: "Back" },
};
const TEXT = {
  de: { title: "Protokoll", all: "Alles", devices: "Alle Geräte", outage: "Ausfall", battery: "Batterie", updates: "Updates", back: "Zurück" },
  en: { title: "History", all: "All", devices: "All devices", outage: "Outage", battery: "Battery", updates: "Updates", back: "Back" },
};
const RULE = (id, device, name, entity, extra = {}) => ({ id, device_id: device, entity_id: entity, name, kind: "below", value: 12, for_s: 600, message: "Meldung {value}", body: "", recover: false, recover_message: "", recover_body: "", repeat_s: 0, target: null, enabled: true, critical: false, critical_volume: 10, reset_value: null, ...extra });
const SEED = (id, device, name) => ({ id, device_id: device, entity_id: "switch.plug", name, action: "on", back_s: 14400, kind: "repeat", delay_s: null, date: null, time: "06:30", repeat: "daily", weekdays: null, mday: null, enabled: true, push: false, target: null, created: Date.now() / 1000 });
const DAY = 86400;

// Erfundene Einträge, relativ zu jetzt
const entries = (now) => ({
  r00000000001: [
    { at: now - 3 * DAY, k: "fired", res: "sent", title: "Keller ist kalt: 11,5 °C", body: "Klimasensor Keller · seit 10 Min", value: "11,5 °C", target: "notify.mobile_app_dani_iphone" },
    { at: now - 2 * DAY, k: "recovered", res: "sent", title: "Keller wieder warm: 12,6 °C", body: "nach 1 Std.", value: "12,6 °C", dur: 3600, target: "notify.mobile_app_dani_iphone" },
    { at: now - 40 * DAY, k: "fired", res: "held", title: "Keller ist kalt: 11,0 °C", body: "Ruhezeit", value: "11,0 °C", target: "notify.mobile_app_dani_iphone" },
    { at: now - 100 * DAY, k: "fired", res: "failed", title: "Keller ist kalt: 10,2 °C", body: "", value: "10,2 °C", err: "no_target" },
    { at: now - 250 * DAY, k: "test", res: "sent", title: "Test", body: "von Hand", value: "", target: "notify.mobile_app_dani_iphone" },
  ],
  r00000000002: [{ at: now - 1 * DAY, k: "fired", res: "sent", title: "Feuchte hoch: 14,2 g/m³", body: "Keller", value: "14,2 g/m³", target: "notify.familie" }],
  aaaaaaaaaaa1: [
    { at: now - 1 * DAY, k: "run", src: "time", ok: true, act: "on", ent: "switch.plug", late: 2.1, trace: [
      { s: "trigger", v: { src: "time", due: now - DAY - 2.1, late: 2.1, grace: 900 } },
      { s: "snapshot", v: { state: "off" } },
      { s: "call", v: { ent: "switch.plug", svc: ["switch.turn_on"], ms: 300, state: "on" } },
      { s: "revert_plan", v: { kind: "duration", due: now - DAY + 14400, back: "off" } },
      { s: "notify", v: { res: "off" } },
      { s: "result", v: { what: "run" } },
    ] },
    { at: now - 1 * DAY + 14400, k: "revert", src: "revert", ok: true, act: "off", ent: "switch.plug", trace: [
      { s: "trigger", v: { src: "revert", due: now - DAY + 14400, kind: "duration" } },
      { s: "call", v: { ent: "switch.plug", svc: ["switch.turn_off"], ms: 200, state: "off" } },
      { s: "result", v: { what: "revert" } },
    ] },
    { at: now - 9 * DAY, k: "failed", src: "time", ok: false, act: "on", ent: "switch.plug", err: "unavailable", late: 1, trace: [
      { s: "trigger", v: { src: "time", due: now - 9 * DAY, late: 1, grace: 900 } },
      { s: "call", v: { ent: "switch.plug", state: "unavailable", err: "unavailable" } },
      { s: "result", v: { what: "failed" } },
    ] },
    { at: now - 16 * DAY, k: "run", src: "manual", ok: true, act: "on", ent: "switch.plug", trace: [{ s: "trigger", v: { src: "manual" } }, { s: "result", v: { what: "run" } }] },
  ],
});


// Einträge von Ereignissen und Verfügbarkeit (Gerät "d"; ein Eintrag eines anderen Geräts "h")
const devlog = (now) => [
  { at: now - 3600, source: "avail", cat: "outage", dev: "d", dname: "Klimasensor Keller", k: "offline" },
  { at: now - 3000, source: "avail", cat: "outage", dev: "d", dname: "Klimasensor Keller", k: "online", dur: 600 },
  { at: now - 7200, source: "event", cat: "battery", dev: "d", dname: "Klimasensor Keller", level: "info", title: "Klimasensor Keller", text: "Batterie 14 %, unter 15 %", detail: "Warnung gesendet" },
  { at: now - 2 * DAY, source: "event", cat: "charge", dev: "d", dname: "Klimasensor Keller", level: "info", title: "Klimasensor Keller", text: "Laden begonnen", detail: "" },
  { at: now - 5400, source: "event", cat: "battery", dev: "h", dname: "Fenstersensor", level: "warning", title: "Fenstersensor", text: "Batterie 9 %", detail: "" },
];

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
          if (i >= 3 || !/not attached|detached|not stable/.test(String(err))) throw err;
          await new Promise((r) => setTimeout(r, 150));
        }
      }
    };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 6000 }).then(() => true, () => false);
    const P = "dialog.proto-dlg";
    const items = () => ev(`return r.querySelectorAll('${P} .pr-item').length`);
    const chips = () => ev(`return [...r.querySelectorAll('${P} [data-pr-filters] .chip')].map((c) => c.dataset.v).join()`);
    const closeProto = async () => { await tap(`${P} [data-pr="close"]`); await wait(`return !r.querySelector('${P}').open`); };

    await p.evaluate(([rules, rt, prot, log]) => {
      window.__opts.notify_service = "notify.mobile_app_dani_iphone";
      window.__magic = { rules, tests: [], seq: 10 };
      (window.__routines ||= { list: [], seq: 1, runs: [], tests: [] }).list.push(rt);
      window.__protocol = prot;
      window.__devlog = log;
    }, [
      [RULE("r00000000001", "d", "Keller kalt", "sensor.temp"), RULE("r00000000002", "d", "Feuchte hoch", "sensor.abs_humidity", { kind: "above", value: 10 }), RULE("r00000000003", "h", "Fenster offen", "binary_sensor.window", { kind: "is", value: "on" })],
      SEED("aaaaaaaaaaa1", "d", "Bewässerung"),
      entries(Date.now() / 1000),
      devlog(Date.now() / 1000),
    ]);
    await ev(`r.host._copyText = async (t) => { window.__copied = t; return true; }`);

    // --- Geräte-Popup: Knopf in der Schnellzeile ---
    await ev(`r.host._openDevice("d")`);
    await wait(`return !!r.querySelector('dialog.device .dlg-quick')`);
    check(`[${tag}] Schnellzeile: dritter Knopf "${T.title}" nach "Gerät in HA" und "Integration"`, await ev(`const q = [...r.querySelectorAll("dialog.device .dlg-quick .qbtn")]; const l = q.at(-1); return q.length >= 2 && l.dataset.proto === "all" && l.dataset.device === "d" && l.textContent.trim() === ${JSON.stringify(T.title)} && !!l.querySelector("svg")`));
    await tap('dialog.device .dlg-quick [data-proto="all"]');
    check(`[${tag}] Fenster öffnet auf "${T.all}", Titel "${T.title}", Unterzeile = Gerät`, await wait(`const d = r.querySelector('${P}'); const t = [...d.querySelectorAll("[data-pr-kinds] .sub-tab")]; return d.open && d.querySelector("h2").textContent === ${JSON.stringify(T.title)} && t.length === 3 && t[0].dataset.v === "all" && t[0].classList.contains("on") && d.querySelector("[data-pr-sub]").textContent === r.host._devices.find((x) => x.id === "d").name && d.querySelectorAll(".pr-item").length > 0`));
    // 30 Tage: Ausfall 2, Batterie 1, Laden 1 (vor 2 Tagen), Magic Push 3 (zwei von Meldung 1, eine von Meldung 2), Routinen 4 (vor 1, 1, 9 und 16 Tagen); ohne Updates und ohne Neu
    check(`[${tag}] Chips nur mit Einträgen: Alle, Ausfall, Batterie, Laden, Magic Push, Routine (kein "${T.updates}")`, (await wait(`return r.querySelectorAll('${P} [data-pr-filters] .chip').length === 6`)) && (await chips()) === "all,outage,battery,charge,magic,routine");
    check(`[${tag}] Zahl am Chip (Ausfall 2, Batterie 1) und Gerät "h" ist nicht dabei`, await ev(`const c = (v) => r.querySelector('${P} [data-pr-filters] .chip[data-v="' + v + '"]').textContent.replace(/\\s+/g, " ").trim(); return /2$/.test(c("outage")) && /1$/.test(c("battery")) && !r.querySelector('${P} [data-pr-body]').textContent.includes("Fenstersensor")`));
    check(`[${tag}] Tage: Kopf "Heute" und "Gestern"`, await ev(`const d = [...r.querySelectorAll('${P} .lg-day')].map((x) => x.textContent.trim()); return d.length >= 3 && d[0] === r.host._t("logToday") && d.includes(r.host._t("logYesterday"))`));
    check(`[${tag}] neueste zuerst: oberste Zeile ist die Rückkehr (vor 50 Min.), "${T.outage}"-Pille`, await ev(`const row = r.querySelector('${P} .pr-item .al-row'); return !!row.querySelector(".lg-pill.outage") && row.textContent.includes("10")`));
    await p.screenshot({ path: `${outDir}/devicelog-${tag.replace("/", "-")}.png` });

    // --- Auswahl und Suche ---
    await tap(`${P} [data-pr-filters] .chip[data-v="battery"]`);
    check(`[${tag}] Chip Batterie: eine Zeile mit Text und Zeile darunter`, (await wait(`return r.querySelectorAll('${P} .pr-item').length === 1`)) && (await ev(`const t = r.querySelector('${P} .pr-item').textContent; return t.includes("14") && t.includes(${JSON.stringify(lang === "de" ? "Warnung gesendet" : "Warnung gesendet")})`)));
    await tap(`${P} [data-pr-filters] .chip[data-v="all"]`);
    await wait(`return r.querySelectorAll('${P} .pr-item').length > 3`);
    await ev(`const i = r.querySelector('${P} [data-pr-search]'); i.value = "feuchte"; i.dispatchEvent(new Event("input", { bubbles: true }))`);
    check(`[${tag}] Suche "feuchte": nur die Magic-Push-Zeile`, await wait(`return r.querySelectorAll('${P} .pr-item').length === 1 && r.querySelector('${P} .pr-item .lg-pill.magic') !== null`));
    await ev(`const i = r.querySelector('${P} [data-pr-search]'); i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true }))`);
    await wait(`return r.querySelectorAll('${P} .pr-item').length > 3`);

    // --- Magic Push: Zeile klappt den Inhalt auf ---
    await tap(`${P} [data-pr-filters] .chip[data-v="magic"]`);
    await wait(`return r.querySelectorAll('${P} .pr-item').length === 3`);
    await tap(`${P} .pr-item .al-row[data-pr="row"]`);
    check(`[${tag}] Magic-Push-Zeile aufgeklappt: Titel und Text der Meldung`, await wait(`const m = r.querySelector('${P} .pr-msg'); return !!m && m.textContent.includes("Feuchte hoch") && m.textContent.includes("Keller")`));

    // --- Routine: Zeile öffnet den Trace, zurück zur Liste ---
    await tap(`${P} [data-pr-filters] .chip[data-v="routine"]`);
    await wait(`return r.querySelectorAll('${P} .pr-item').length === 4`);
    await tap(`${P} .pr-item .al-row[data-pr="trace"]`);
    check(`[${tag}] Routine-Zeile: Trace der Routine "Bewässerung", ohne Vor/Zurück`, await wait(`const b = r.querySelector('${P} [data-pr-body]'); return !!b.querySelector(".pr-trace") && b.textContent.includes("Bewässerung") && !r.querySelector('${P} [data-pr="newer"]') && !!r.querySelector('${P} [data-pr="copy-trace"]')`));
    await tap(`${P} [data-pr="back"]`);
    check(`[${tag}] Zurück: Liste "${T.all}" mit Chip Routine`, await wait(`return r.querySelectorAll('${P} .pr-item').length === 4 && r.querySelector('${P} [data-pr-filters] .chip.on').dataset.v === "routine"`));

    // --- Reiter Magic Push und Routinen behalten ihre Auswertung ---
    await tap(`${P} [data-pr-kinds] .sub-tab[data-v="magic"]`);
    check(`[${tag}] Reiter Magic Push: Kennzahlen und Diagramm wie bisher`, await wait(`return r.querySelectorAll('${P} .pr-k').length === 5 && !!r.querySelector('${P} .pr-chart')`));
    await tap(`${P} [data-pr-kinds] .sub-tab[data-v="all"]`);
    check(`[${tag}] zurück auf "${T.all}": wieder die Liste (Chip Alle)`, await wait(`return !!r.querySelector('${P} .lg-day') && r.querySelector('${P} [data-pr-filters] .chip.on').dataset.v === "all"`));
    await closeProto();
    await ev(`r.host._closeDevice()`);

    // --- Gesamtübersichten: Knopf "Protokoll" im Kopf, über alle Geräte ---
    await ev(`r.host._openMagicAll()`);
    await wait(`return r.querySelectorAll('dialog.mgall-dlg .mg-card').length >= 2`);
    check(`[${tag}] Magic Push (Übersicht): Knopf "${T.title}" im Kopf links vom Schliessen-Knopf, mit Strich`, await ev(`const h = r.querySelector('dialog.mgall-dlg .dlg-head'); const a = h.querySelector('.dlg-acts .dlg-act[data-proto="magic"]'); const c = h.querySelector(".dlg-close"); return !!a && !!h.querySelector(".dlg-acts .dlg-sep") && a.getBoundingClientRect().right <= c.getBoundingClientRect().left && a.getAttribute("aria-label") === ${JSON.stringify(T.title)} && a.dataset.device === "" && Math.abs((a.getBoundingClientRect().top + a.getBoundingClientRect().bottom) / 2 - (c.getBoundingClientRect().top + c.getBoundingClientRect().bottom) / 2) < 0.6`));
    await tap('dialog.mgall-dlg .dlg-act[data-proto="magic"]');
    check(`[${tag}] öffnet auf "Magic Push", Unterzeile "${T.devices}", Einträge aller Meldungen (3 im Zeitraum)`, await wait(`const d = r.querySelector('${P}'); const t = [...d.querySelectorAll("[data-pr-kinds] .sub-tab")]; return d.open && t[1].classList.contains("on") && d.querySelector("[data-pr-sub]").textContent === ${JSON.stringify(T.devices)} && d.querySelectorAll(".pr-item").length === 3`));
    await tap(`${P} [data-pr-kinds] .sub-tab[data-v="all"]`);
    check(`[${tag}] Reiter "${T.all}" ohne Gerät: Zeilen mit dem Namen des Geräts, auch das zweite Gerät`, await wait(`const t = r.querySelector('${P} [data-pr-body]').textContent; return t.includes("Fenstersensor") && t.includes("Klimasensor Keller") && r.querySelectorAll('${P} .al-row').length > 6`));
    await closeProto();
    await ev(`r.host._closeMagicAll?.()`);
    await ev(`const d = r.querySelector("dialog.mgall-dlg"); if (d?.open) d.close()`);
    await ev(`r.host._openRtAll()`);
    await wait(`return !!r.querySelector('dialog.rtall-dlg .dlg-head')`);
    await tap('dialog.rtall-dlg .dlg-act[data-proto="routine"]');
    check(`[${tag}] Routinen (Übersicht): Knopf öffnet auf "Routinen" über alle Geräte (4 Läufe)`, await wait(`const d = r.querySelector('${P}'); const t = [...d.querySelectorAll("[data-pr-kinds] .sub-tab")]; return d.open && t[2].classList.contains("on") && d.querySelectorAll(".pr-item").length === 4`));
    await closeProto();
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
