// Status-App, Meldung bei hoher Auslastung (2.71.0): je CPU, Arbeitsspeicher und Festplatte ein Schalter (Standard an) und eine Grenze in
// Prozent (Standard 99); ungültige Grenze zeigt einen Fehler und wird nicht gespeichert. Seit 2.72.0 im Reiter "Einstellungen": die Werte
// sind ein Entwurf und gelten erst nach "Speichern". Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { title: "Meldung bei hoher Auslastung", names: ["Prozessor (CPU)", "Arbeitsspeicher (RAM)", "Festplatte"], range: "zwischen 1 und 100", noPercent: "keinen Prozentwert", minLabel: "Mindestdauer", minRange: "zwischen 1 und 60", hint: "bei 3 Prüfungen in Folge", hint5: "bei 5 Prüfungen in Folge" },
  en: { title: "Alert at high load", names: ["Processor (CPU)", "Memory (RAM)", "Disk"], range: "between 1 and 100", noPercent: "no percentage", minLabel: "Minimum duration", minRange: "between 1 and 60", hint: "at 3 checks in a row", hint5: "at 5 checks in a row" },
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
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const calls = (type) => p.evaluate((ty) => window.__wsCalls.filter((m) => m.type === ty), type);
    const win = "dialog.status-dlg";
    const setField = (sel, value) => ev(`const i = r.querySelector(${JSON.stringify(sel)}); i.focus(); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new Event("change", { bubbles: true }))`);
    const save = async () => { await ev(`const b = r.querySelector("${win} [data-st-save]"); if (!b.disabled) b.click()`); };
    const lastOpts = async () => { for (let i = 0; i < 25; i++) { const o = (await calls("device_panel/set_options")).at(-1); if (o) return o.values; await p.waitForTimeout(200); } return null; };

    await ev(`r.host._status.open()`);
    await wait(`return !!r.querySelector('${win} [data-st-tab="settings"]')`);
    await ev(`r.querySelector('${win} [data-st-tab="settings"]').click()`);
    await wait(`return r.querySelectorAll("${win} [data-st-limit]").length === 3`);
    check(`[${tag}] Abschnitt "${T.title}": drei Zeilen (${T.names.join(", ")}), alle an, Grenze 99 %`, await ev(`const d = r.querySelector("${win}"); const rows = [...d.querySelectorAll("[data-st-limit]")]; const names = rows.map((x) => x.closest(".opt-line").querySelector(".opt-label").textContent.trim()); return [...d.querySelectorAll(".set-title")].some((x) => x.textContent.trim() === ${JSON.stringify(T.title)}) && JSON.stringify(names) === ${JSON.stringify(JSON.stringify(T.names))} && rows.every((x) => x.value === "99") && [...d.querySelectorAll("[data-st-alert]")].every((x) => x.checked)`));
    await ev(`r.querySelector('${win} [data-st-limit="cpu"]').scrollIntoView({ block: "center" })`);
    await p.waitForTimeout(250);
    await p.screenshot({ path: `${outDir}/statusload-${tag.replace("/", "-")}-0.png` });

    // Grenze ändern: gespeichert als Zahl
    await p.evaluate(() => { window.__wsCalls = []; });
    await setField(`${win} [data-st-limit="cpu"]`, "85");
    await p.waitForTimeout(300);
    check(`[${tag}] Grenze Prozessor 85 getippt: noch nichts gespeichert, "Speichern" aktiv`, (await calls("device_panel/set_options")).length === 0 && await ev(`return !r.querySelector("${win} [data-st-save]").disabled`));
    await save();
    const v1 = await lastOpts();
    check(`[${tag}] Speichern: set_options mit status_cpu_limit 85 (Zahl)`, v1 && v1.status_cpu_limit === 85 && Number.isInteger(v1.status_cpu_limit));
    await wait(`return r.querySelector('${win} [data-st-limit="cpu"]').value === "85"`);

    // Ungültig: Fehler am Feld, nichts gespeichert, der eingetippte Wert bleibt stehen
    await p.evaluate(() => { window.__wsCalls = []; });
    await setField(`${win} [data-st-limit="ram"]`, "150");
    check(`[${tag}] Grenze 150: Fehler "${T.range}" am Feld, rote Umrandung, nichts gespeichert`, await wait(`const d = r.querySelector("${win}"); const row = d.querySelector('[data-st-limit="ram"]').closest(".opt"); return row.classList.contains("invalid") && !!row.querySelector(".opt-input.bad") && row.querySelector('[role="alert"]').textContent.includes(${JSON.stringify(T.range)}) && d.querySelector('[data-st-limit="ram"]').value === "150"`) && (await calls("device_panel/set_options")).length === 0);
    check(`[${tag}] ungültige Grenze: "Speichern" gesperrt, ein Klick darauf schickt nichts`, await ev(`return r.querySelector("${win} [data-st-save]").disabled`) && await (async () => { await ev(`r.querySelector("${win} [data-st-save]").click()`); await p.waitForTimeout(300); return (await calls("device_panel/set_options")).length === 0; })());
    await setField(`${win} [data-st-limit="ram"]`, "0");
    check(`[${tag}] Grenze 0 und leer und Dezimalzahl: ebenfalls abgelehnt`, await wait(`return !!r.querySelector('${win} [data-st-limit="ram"]').closest(".opt.invalid")`) && await (async () => { for (const bad of ["", "9.5", "abc"]) { await setField(`${win} [data-st-limit="ram"]`, bad); await p.waitForTimeout(150); } return (await calls("device_panel/set_options")).length === 0; })());
    await setField(`${win} [data-st-limit="ram"]`, "90");
    await wait(`return !r.querySelector("${win} [data-st-save]").disabled`);
    await save();
    const v2 = await lastOpts();
    check(`[${tag}] gültige Grenze 90 danach: gespeichert, Fehler weg`, v2 && v2.status_ram_limit === 90 && await wait(`return !r.querySelector("${win} .opt.invalid")`));

    // Schalter
    await p.evaluate(() => { window.__wsCalls = []; });
    await ev(`const i = r.querySelector('${win} [data-st-alert="disk"]'); i.checked = false; i.dispatchEvent(new Event("change", { bubbles: true }))`);
    await save();
    const v3 = await lastOpts();
    check(`[${tag}] Schalter Festplatte aus: set_options mit status_disk_alert false`, v3 && v3.status_disk_alert === false && await wait(`return !r.querySelector('${win} [data-st-alert="disk"]').checked && r.querySelector('${win} [data-st-alert="cpu"]').checked`));

    // Mindestdauer (2.74.0): wie viele Prüfungen in Folge über der Grenze, bevor gemeldet wird; Standard 3, 1 bis 60
    const mSel = `${win} [data-st-minutes]`;
    check(`[${tag}] Zeile "${T.minLabel}" nach den drei Arten: Standard 3 Min., Hinweis "${T.hint}", Kästchen rechtsbündig mit denen der Grenzen`, await ev(`const d = r.querySelector("${win}"); const m = d.querySelector("[data-st-minutes]"); const l = d.querySelector('[data-st-limit="cpu"]'); const rows = [...d.querySelectorAll(".opt")]; return !!m && m.value === "3" && m.closest(".opt").querySelector(".opt-label").textContent.trim() === ${JSON.stringify(T.minLabel)} && rows.indexOf(m.closest(".opt")) > rows.indexOf(d.querySelector('[data-st-limit="disk"]').closest(".opt")) && Math.abs(m.closest(".opt-input").getBoundingClientRect().right - l.closest(".opt-input").getBoundingClientRect().right) <= 1 && d.textContent.includes(${JSON.stringify(T.hint)})`));
    await p.evaluate(() => { window.__wsCalls = []; });
    for (const bad of ["0", "61", "", "2.5", "abc"]) await setField(mSel, bad);
    check(`[${tag}] Mindestdauer 0, 61, leer, Dezimalzahl, Text: Fehler "${T.minRange}", "Speichern" gesperrt, nichts geschickt`, await wait(`const d = r.querySelector("${win}"); const o = d.querySelector("[data-st-minutes]").closest(".opt"); return o.classList.contains("invalid") && o.querySelector('[role="alert"]').textContent.includes(${JSON.stringify(T.minRange)}) && d.querySelector("[data-st-save]").disabled`) && (await calls("device_panel/set_options")).length === 0);
    await setField(mSel, "5");
    check(`[${tag}] Mindestdauer 5: Hinweis nennt "${T.hint5}", Fehler weg, "Speichern" aktiv`, await wait(`const d = r.querySelector("${win}"); return d.textContent.includes(${JSON.stringify(T.hint5)}) && !d.querySelector("[data-st-minutes]").closest(".opt").classList.contains("invalid") && !d.querySelector("[data-st-save]").disabled`));
    await save();
    const vm = await lastOpts();
    check(`[${tag}] Speichern: set_options mit status_load_minutes 5 (Zahl), sonst nichts`, vm && vm.status_load_minutes === 5 && Number.isInteger(vm.status_load_minutes) && Object.keys(vm).length === 1, JSON.stringify(vm));
    await setField(mSel, "3");
    await save();
    await lastOpts();

    // Sensor ohne Prozentwert (Gigabyte): Hinweis, dass es keine Meldung gibt
    await ev(`r.activeElement?.blur()`);
    await p.evaluate(() => { window.__systemAbsolute = true; });
    await ev(`const i = r.querySelector('${win} [data-st-alert="disk"]'); i.checked = true; i.dispatchEvent(new Event("change", { bubbles: true }))`);
    await ev(`r.host._status.loadSystem()`);
    check(`[${tag}] Festplatte nur in Gigabyte: Hinweis "${T.noPercent}" an der Zeile`, await wait(`const row = r.querySelector('${win} [data-st-limit="disk"]').closest(".opt"); return row.textContent.includes(${JSON.stringify(T.noPercent)}) && !r.querySelector('${win} [data-st-limit="cpu"]').closest(".opt").textContent.includes(${JSON.stringify(T.noPercent)})`));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
