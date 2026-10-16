// Status-App, Reiter "Zustand" und "Einstellungen" (2.72.0): die Einstellungen (Meldung bei Stillstand, Meldung bei hoher Auslastung,
// Quelle der Werte) stehen im zweiten Reiter und gelten erst nach "Speichern"; Entwurf, Zähler, Verwerfen, Rückfrage beim Schliessen.
// Deutsch und Englisch, Desktop und Handy, mit echten Klicks und Taps.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { tabs: ["Zustand", "Einstellungen"], titles: ["Meldung bei Stillstand", "Meldung bei hoher Auslastung", "Quelle der Werte"], one: "1 Änderung", two: "2 Änderungen", saved: "Gespeichert", close: "Schliessen", discard: "Verwerfen", keep: "Weiter bearbeiten" },
  en: { tabs: ["State", "Settings"], titles: ["Alert when something stops", "Alert at high load", "Source of the values"], one: "1 change", two: "2 changes", saved: "Saved", close: "Close", discard: "Discard", keep: "Keep editing" },
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
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const calls = (type) => p.evaluate((ty) => window.__wsCalls.filter((m) => m.type === ty), type);
    const win = "dialog.status-dlg";
    const count = () => ev(`return (r.querySelector("${win} [data-st-count]")?.textContent || "").trim()`);
    const change = (sel, set) => ev(`const i = r.querySelector(${JSON.stringify(sel)}); ${set}; i.dispatchEvent(new Event("change", { bubbles: true }))`);

    await ev(`r.host._status.open()`);
    await wait(`return r.querySelectorAll("${win} .st-line").length === 8`);
    check(`[${tag}] zwei Reiter "${T.tabs.join('", "')}", der erste gewählt, gleitende Kapsel, Zustand zu sehen`, await wait(`const d = r.querySelector("${win}"); const t = [...d.querySelectorAll(".sub-tabs [data-st-tab]")]; return t.length === 2 && t.map((x) => x.textContent.trim()).join("|") === ${JSON.stringify(T.tabs.join("|"))} && t[0].classList.contains("on") && !!d.querySelector(".sub-tabs .seg-pill") && !!d.querySelector(".st-banner")`));
    check(`[${tag}] Reiter "${T.tabs[0]}": keine Einstellungen (Schalter, Empfänger, Grenzen, Quelle), keine Leiste mit Speichern`, await ev(`const d = r.querySelector("${win}"); return !d.querySelector("[data-st-notify], [data-st-target], [data-st-limit], [data-st-pick]") && !d.querySelector("[data-st-foot] .dlg-actions")`));

    await tap(`${win} [data-st-tab="settings"]`);
    check(`[${tag}] Reiter "${T.tabs[1]}": die drei Abschnitte "${T.titles.join('", "')}" in dieser Folge, kein Zustand`, await wait(`const d = r.querySelector("${win}"); const t = [...d.querySelectorAll(".set-title")].map((x) => x.textContent.trim()); return JSON.stringify(t) === ${JSON.stringify(JSON.stringify(T.titles))} && !d.querySelector(".st-banner, .st-line, .st-sys") && d.querySelector('[data-st-tab="settings"]').classList.contains("on")`));
    check(`[${tag}] ohne Änderung: Knopf "${T.close}", "Speichern" gesperrt, kein Zähler`, await ev(`const d = r.querySelector("${win}"); const btns = [...d.querySelectorAll("[data-st-foot] .dlg-btn")]; return d.querySelector("[data-st-save]").disabled && btns.length === 2 && btns[1].textContent.trim() === ${JSON.stringify(T.close)} && !d.querySelector("[data-st-count]").textContent.trim()`));
    await p.screenshot({ path: `${outDir}/statustabs-${tag.replace("/", "-")}-0.png` });

    // Entwurf: nichts wird geschickt, bis "Speichern" gedrückt ist
    await p.evaluate(() => { window.__wsCalls = []; });
    await change(`${win} [data-st-notify]`, "i.checked = false");
    await p.waitForTimeout(300);
    check(`[${tag}] Schalter "Bei Stillstand melden" aus: Zähler "${T.one}", "Speichern" aktiv, Knopf "${T.discard}", nichts geschickt`, (await count()) === T.one && await ev(`const d = r.querySelector("${win}"); const btns = [...d.querySelectorAll("[data-st-foot] .dlg-btn")]; return !d.querySelector("[data-st-save]").disabled && btns[1].textContent.trim() === ${JSON.stringify(T.discard)}`) && (await calls("device_panel/set_options")).length === 0);

    // Reiter wechseln behält den Entwurf; der Reiter "Einstellungen" trägt einen Punkt
    await tap(`${win} [data-st-tab="state"]`);
    check(`[${tag}] Reiter "${T.tabs[0]}": Punkt am Reiter "${T.tabs[1]}" (ungespeichert), keine Leiste unten`, await wait(`const d = r.querySelector("${win}"); return d.querySelector('[data-st-tab="settings"]').classList.contains("chg") && !!d.querySelector(".st-banner") && !d.querySelector("[data-st-foot] .dlg-actions")`));
    await tap(`${win} [data-st-tab="settings"]`);
    check(`[${tag}] zurück: Schalter noch aus, Zähler "${T.one}", Punkt weg`, await wait(`const d = r.querySelector("${win}"); return d.querySelector("[data-st-notify]").checked === false && d.querySelector("[data-st-count]").textContent.trim() === ${JSON.stringify(T.one)} && !d.querySelector('[data-st-tab="settings"]').classList.contains("chg")`));

    // Gleicher Wert wie gespeichert ist keine Änderung mehr
    await change(`${win} [data-st-notify]`, "i.checked = true");
    check(`[${tag}] Schalter wieder an: keine Änderung mehr, Zähler leer`, await wait(`const d = r.querySelector("${win}"); return d.querySelector("[data-st-save]").disabled && !d.querySelector("[data-st-count]").textContent.trim()`));

    // Verwerfen
    await change(`${win} [data-st-limit="cpu"]`, "i.value = '80'");
    await change(`${win} [data-st-alert="ram"]`, "i.checked = false");
    check(`[${tag}] Grenze und Schalter geändert: Zähler "${T.two}"`, await wait(`return r.querySelector("${win} [data-st-count]").textContent.trim() === ${JSON.stringify(T.two)}`));
    await tap(`${win} [data-st-discard]`);
    check(`[${tag}] "${T.discard}": alles zurück (Grenze 99, Schalter an), Zähler leer, nichts geschickt`, await wait(`const d = r.querySelector("${win}"); return d.querySelector('[data-st-limit="cpu"]').value === "99" && d.querySelector('[data-st-alert="ram"]').checked && !d.querySelector("[data-st-count]").textContent.trim() && d.querySelector("[data-st-save]").disabled`) && (await calls("device_panel/set_options")).length === 0);

    // Schliessen mit Änderungen: Rückfrage
    await change(`${win} [data-st-limit="disk"]`, "i.value = '90'");
    await tap(`${win} .dlg-head [data-st-close]`);
    check(`[${tag}] Schliessen mit Änderung: Rückfrage "${T.keep}" / "${T.discard}", das Status-Fenster bleibt offen`, await wait(`const q = r.querySelector("dialog.discard-dlg"); return q?.open && q.textContent.includes(${JSON.stringify(T.keep)}) && r.querySelector("${win}").open`));
    await tap(`dialog.discard-dlg [data-dd="no"]`);
    check(`[${tag}] "${T.keep}": Fenster offen, Entwurf (Grenze 90) noch da`, await wait(`const d = r.querySelector("${win}"); return d.open && !r.querySelector("dialog.discard-dlg").open && d.querySelector('[data-st-limit="disk"]').value === "90"`));
    await p.keyboard.press("Escape");
    check(`[${tag}] Esc mit Änderung: ebenfalls die Rückfrage, Fenster bleibt offen`, await wait(`return r.querySelector("dialog.discard-dlg")?.open && r.querySelector("${win}").open`));
    await tap(`dialog.discard-dlg [data-dd="no"]`);
    await tap(`${win} .dlg-head [data-st-close]`);
    await tap(`dialog.discard-dlg [data-dd="yes"]`);
    check(`[${tag}] "${T.discard}": Fenster zu, nichts geschickt`, await wait(`return !r.querySelector("${win}").open`) && (await calls("device_panel/set_options")).length === 0);
    await ev(`r.host._status.open()`);
    check(`[${tag}] erneut geöffnet: Reiter "${T.tabs[0]}", Entwurf weg (Grenze 99)`, await wait(`const d = r.querySelector("${win}"); return d.open && d.querySelector('[data-st-tab="state"]').classList.contains("on") && !!d.querySelector(".st-banner")`) && (await ev(`return r.querySelector("${win}").open`)));
    await tap(`${win} [data-st-tab="settings"]`);
    check(`[${tag}] Grenze Festplatte wieder 99`, await wait(`return r.querySelector('${win} [data-st-limit="disk"]').value === "99"`));

    // Speichern: alles in einem Aufruf
    await p.evaluate(() => { window.__wsCalls = []; });
    await change(`${win} [data-st-limit="disk"]`, "i.value = '85'");
    await change(`${win} [data-st-alert="cpu"]`, "i.checked = false");
    await tap(`${win} [data-st-save]`);
    await p.waitForTimeout(600);
    const sets = await calls("device_panel/set_options");
    check(`[${tag}] Speichern: ein set_options mit genau den zwei Änderungen (status_disk_limit 85, status_cpu_alert false)`, sets.length === 1 && JSON.stringify(Object.keys(sets[0].values).sort()) === JSON.stringify(["status_cpu_alert", "status_disk_limit"]) && sets[0].values.status_disk_limit === 85 && sets[0].values.status_cpu_alert === false, JSON.stringify(sets));
    check(`[${tag}] danach: Fenster offen, "${T.saved}" statt Zähler, Knopf "${T.close}", Werte bleiben stehen`, await wait(`const d = r.querySelector("${win}"); return d.open && d.querySelector("[data-st-count]").textContent.trim() === ${JSON.stringify(T.saved)} && d.querySelector("[data-st-count]").classList.contains("saved") && d.querySelector("[data-st-save]").disabled && d.querySelectorAll("[data-st-foot] .dlg-btn")[1].textContent.trim() === ${JSON.stringify(T.close)} && d.querySelector('[data-st-limit="disk"]').value === "85" && !d.querySelector('[data-st-alert="cpu"]').checked`));
    await change(`${win} [data-st-limit="ram"]`, "i.value = '70'");
    check(`[${tag}] nächste Änderung: "${T.saved}" weicht dem Zähler "${T.one}"`, await wait(`return r.querySelector("${win} [data-st-count]").textContent.trim() === ${JSON.stringify(T.one)}`));
    await p.screenshot({ path: `${outDir}/statustabs-${tag.replace("/", "-")}-1.png` });
    await tap(`${win} [data-st-discard]`);
    await tap(`${win} .dlg-head [data-st-close]`);
    check(`[${tag}] Schliessen ohne Änderung: gleich zu, keine Rückfrage`, await wait(`return !r.querySelector("${win}").open && !r.querySelector("dialog.discard-dlg").open`));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
