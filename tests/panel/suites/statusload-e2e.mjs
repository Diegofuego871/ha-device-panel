// Status-App, Meldung bei hoher Auslastung (2.71.0): je CPU, Arbeitsspeicher und Festplatte ein Schalter (Standard an) und eine Grenze in
// Prozent (Standard 99); ungültige Grenze zeigt einen Fehler und wird nicht gespeichert. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { title: "Meldung bei hoher Auslastung", names: ["Prozessor (CPU)", "Arbeitsspeicher (RAM)", "Festplatte"], range: "zwischen 1 und 100", noPercent: "keinen Prozentwert" },
  en: { title: "Alert at high load", names: ["Processor (CPU)", "Memory (RAM)", "Disk"], range: "between 1 and 100", noPercent: "no percentage" },
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
    const lastOpts = async () => { for (let i = 0; i < 25; i++) { const o = (await calls("device_panel/set_options")).at(-1); if (o) return o.values; await p.waitForTimeout(200); } return null; };

    await ev(`r.host._status.open()`);
    await wait(`return r.querySelectorAll("${win} [data-st-limit]").length === 3`);
    check(`[${tag}] Abschnitt "${T.title}": drei Zeilen (${T.names.join(", ")}), alle an, Grenze 99 %`, await ev(`const d = r.querySelector("${win}"); const rows = [...d.querySelectorAll("[data-st-limit]")]; const names = rows.map((x) => x.closest(".opt-line").querySelector(".opt-label").textContent.trim()); return [...d.querySelectorAll(".set-title")].some((x) => x.textContent.trim() === ${JSON.stringify(T.title)}) && JSON.stringify(names) === ${JSON.stringify(JSON.stringify(T.names))} && rows.every((x) => x.value === "99") && [...d.querySelectorAll("[data-st-alert]")].every((x) => x.checked)`));
    await ev(`r.querySelector('${win} [data-st-limit="cpu"]').scrollIntoView({ block: "center" })`);
    await p.waitForTimeout(250);
    await p.screenshot({ path: `${outDir}/statusload-${tag.replace("/", "-")}-0.png` });

    // Grenze ändern: gespeichert als Zahl
    await p.evaluate(() => { window.__wsCalls = []; });
    await setField(`${win} [data-st-limit="cpu"]`, "85");
    const v1 = await lastOpts();
    check(`[${tag}] Grenze Prozessor 85: set_options mit status_cpu_limit 85 (Zahl)`, v1 && v1.status_cpu_limit === 85 && Number.isInteger(v1.status_cpu_limit));
    await wait(`return r.querySelector('${win} [data-st-limit="cpu"]').value === "85"`);

    // Ungültig: Fehler am Feld, nichts gespeichert, der eingetippte Wert bleibt stehen
    await p.evaluate(() => { window.__wsCalls = []; });
    await setField(`${win} [data-st-limit="ram"]`, "150");
    check(`[${tag}] Grenze 150: Fehler "${T.range}" am Feld, rote Umrandung, nichts gespeichert`, await wait(`const d = r.querySelector("${win}"); const row = d.querySelector('[data-st-limit="ram"]').closest(".opt"); return row.classList.contains("invalid") && !!row.querySelector(".opt-input.bad") && row.querySelector('[role="alert"]').textContent.includes(${JSON.stringify(T.range)}) && d.querySelector('[data-st-limit="ram"]').value === "150"`) && (await calls("device_panel/set_options")).length === 0);
    await setField(`${win} [data-st-limit="ram"]`, "0");
    check(`[${tag}] Grenze 0 und leer und Dezimalzahl: ebenfalls abgelehnt`, await wait(`return !!r.querySelector('${win} [data-st-limit="ram"]').closest(".opt.invalid")`) && await (async () => { for (const bad of ["", "9.5", "abc"]) { await setField(`${win} [data-st-limit="ram"]`, bad); await p.waitForTimeout(150); } return (await calls("device_panel/set_options")).length === 0; })());
    await setField(`${win} [data-st-limit="ram"]`, "90");
    const v2 = await lastOpts();
    check(`[${tag}] gültige Grenze 90 danach: gespeichert, Fehler weg`, v2 && v2.status_ram_limit === 90 && await wait(`return !r.querySelector("${win} .opt.invalid")`));

    // Schalter
    await p.evaluate(() => { window.__wsCalls = []; });
    await ev(`const i = r.querySelector('${win} [data-st-alert="disk"]'); i.checked = false; i.dispatchEvent(new Event("change", { bubbles: true }))`);
    const v3 = await lastOpts();
    check(`[${tag}] Schalter Festplatte aus: set_options mit status_disk_alert false`, v3 && v3.status_disk_alert === false && await wait(`return !r.querySelector('${win} [data-st-alert="disk"]').checked && r.querySelector('${win} [data-st-alert="cpu"]').checked`));

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
