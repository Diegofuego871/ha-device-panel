// Meldung bei Backup-Fehler (2.185.0): Einstellungen der Status-App (Schalter, "Sofort" / "Einmal täglich", Uhrzeit) und Assistent
// (ganz oben im Schritt "Backup, Ruhezeit und System"). Entwurf, Speichern, Zusammenfassung. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const win = "dialog.status-dlg";
const D = "dialog.wizard-dlg";
const TEXT = {
  de: { title: "Meldung bei Backup-Fehler", now: "Sofort", from: "Einmal täglich", wz: "Backup", sum: "Backup-Fehler", sumNow: "sofort", link: "Systemmeldungen öffnen", sys: "Systemmeldungen", sumFrom: "täglich um 06:30", off: "aus" },
  en: { title: "Alert when a backup fails", now: "At once", from: "Once a day", wz: "Backup", sum: "Backup failure", sumNow: "at once", link: "Open system alerts", sys: "System alerts", sumFrom: "daily at 06:30", off: "off" },
};

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const calls = (type) => p.evaluate((ty) => window.__wsCalls.filter((m) => m.type === ty), type);
    const setField = (sel, value) => ev(`const i = r.querySelector(${JSON.stringify(sel)}); i.focus(); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new Event("change", { bubbles: true }))`);
    const lastOpts = async () => { for (let i = 0; i < 25; i++) { const o = (await calls("device_panel/set_options")).at(-1); if (o) return o.values; await p.waitForTimeout(200); } return null; };

    // --- Einstellungen der Status-App
    await ev(`r.host._status.open()`);
    await wait(`return !!r.querySelector('${win} [data-st-tab="settings"]')`);
    await tap(`${win} [data-st-tab="settings"]`);
    await wait(`return !!r.querySelector("${win} [data-st-bkon]")`);
    check(`[${tag}] Abschnitt "${T.title}" steht, Schalter an, "${T.now}" gewählt, keine Uhrzeit`, await ev(`const d = r.querySelector("${win}"); return d.textContent.includes(${JSON.stringify(T.title)}) && d.querySelector("[data-st-bkon]").checked && d.querySelector('[data-st-bk="now"]').classList.contains("on") && !d.querySelector("[data-st-bktime]")`));
    check(`[${tag}] Zeitpunkt ist eine Reiterleiste (.sub-tabs) mit Kapsel`, await wait(`return !!r.querySelector('${win} .sub-tabs [data-st-bk="now"]') && !!r.querySelector('${win} [data-st-bk="now"]').closest(".sub-tabs").querySelector(".seg-pill")`));
    // "Einmal täglich": Feld mit 09:00, Entwurf, noch nichts gespeichert
    await p.evaluate(() => { window.__wsCalls = []; });
    await tap(`${win} [data-st-bk="time"]`);
    check(`[${tag}] "${T.from}": Uhrzeitfeld mit 09:00, noch nichts gespeichert`, (await wait(`return r.querySelector("${win} [data-st-bktime]")?.value === "09:00"`)) && (await calls("device_panel/set_options")).length === 0);
    await setField(`${win} [data-st-bktime]`, "06:30");
    await tap(`${win} [data-st-save]`);
    const v1 = await lastOpts();
    check(`[${tag}] Speichern: status_backup_time 06:30`, v1 && v1.status_backup_time === "06:30" && !("status_backup_alert" in v1));
    await wait(`return r.querySelector("${win} [data-st-bktime]")?.value === "06:30"`);
    // Leeres Feld: Wert bleibt
    await setField(`${win} [data-st-bktime]`, "");
    check(`[${tag}] Uhrzeit gelöscht: das Feld zeigt wieder 06:30, keine Änderung`, (await wait(`return r.querySelector("${win} [data-st-bktime]")?.value === "06:30"`)) && await ev(`return r.querySelector("${win} [data-st-save]").disabled`));
    // Zurück auf "Sofort": leere Uhrzeit
    await p.evaluate(() => { window.__wsCalls = []; });
    await tap(`${win} [data-st-bk="now"]`);
    await tap(`${win} [data-st-save]`);
    const v2 = await lastOpts();
    check(`[${tag}] "${T.now}": status_backup_time leer gespeichert`, v2 && v2.status_backup_time === "");
    // Längste Dauer: Standard 180, Bereich 10 bis 1440, ungültig sperrt das Speichern
    check(`[${tag}] Längste Dauer: Feld mit 180`, await ev(`return r.querySelector("${win} [data-st-bkmin]")?.value === "180"`));
    await setField(`${win} [data-st-bkmin]`, "5");
    check(`[${tag}] Längste Dauer 5: Fehler am Feld, Speichern gesperrt`, (await wait(`return !!r.querySelector('${win} [data-st-bkmin]').closest(".opt.invalid")`)) && await ev(`return r.querySelector("${win} [data-st-save]").disabled`));
    await p.evaluate(() => { window.__wsCalls = []; });
    await setField(`${win} [data-st-bkmin]`, "360");
    await tap(`${win} [data-st-save]`);
    const v4 = await lastOpts();
    check(`[${tag}] Längste Dauer 360: als Zahl gespeichert`, v4 && v4.status_backup_minutes === 360 && Number.isInteger(v4.status_backup_minutes));
    await wait(`return r.querySelector("${win} [data-st-bkmin]")?.value === "360" && r.querySelector("${win} [data-st-save]").disabled`);
    await setField(`${win} [data-st-bkmin]`, "180");
    await tap(`${win} [data-st-save]`);
    // Ausschalten
    await p.evaluate(() => { window.__wsCalls = []; });
    await tap(`${win} [data-st-bkon]`);
    check(`[${tag}] ausgeschaltet: Zeitpunkt verschwindet`, await wait(`return !r.querySelector("${win} [data-st-bk]")`));
    await tap(`${win} [data-st-save]`);
    const v3 = await lastOpts();
    check(`[${tag}] Speichern: status_backup_alert false`, v3 && v3.status_backup_alert === false);
    await ev(`r.querySelector("${win} [data-st-bkon]").scrollIntoView({ block: "center" })`);
    await p.screenshot({ path: `${process.env.OUT || "output"}/backupalert-settings-${tag.replace("/", "-")}.png` });
    // wieder an (Standard), damit der Assistent von diesem Stand ausgeht
    await tap(`${win} [data-st-bkon]`);
    await tap(`${win} [data-st-save]`);
    await wait(`return r.querySelector("${win} [data-st-bkon]")?.checked && r.querySelector("${win} [data-st-save]")?.disabled`);
    await ev(`r.host._status.close()`);

    // --- Verweis in den Einstellungen des Panels
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await wait(`return !!r.querySelector('[data-set="status-open"]')`);
    check(`[${tag}] Einstellungen: eigener Abschnitt "${T.sys}" (mit Strich) nach der Ruhezeit, Knopf "${T.link}" mit Pfeil`, await ev(`const b = r.querySelector('[data-set="status-open"]'); const g = [...r.querySelectorAll(".mon-body > .mon-grp")]; return !!b && b.textContent.includes(${JSON.stringify(T.link)}) && !!b.querySelector(".cbtn") && g.at(-1).textContent.trim() === ${JSON.stringify(T.sys)} && getComputedStyle(g.at(-1), "::before").width === "4px" && b.getBoundingClientRect().width > 200`));
    await ev(`r.querySelector('[data-set="status-open"]').scrollIntoView({ block: "center" })`);
    await p.screenshot({ path: `${process.env.OUT || "output"}/backupalert-link-${tag.replace("/", "-")}.png` });
    await tap(`[data-set="status-open"]`);
    check(`[${tag}] Verweis: Status-App öffnet im Reiter "Einstellungen"`, await wait(`return r.querySelector("${win}")?.open && !!r.querySelector("${win} [data-st-bkon]")`));
    await ev(`r.host._status.close()`);
    await ev(`r.querySelector("dialog.settings")?.close?.()`);

    // --- Assistent
    await ev(`r.host._wizard.open()`);
    await wait(`return r.querySelector("${D}")?.open && !r.host._wizard.s?.loading`);
    await ev(`const w = r.host._wizard; w.s.d.target = "notify.handy"; w.go("quiet")`);
    await wait(`return r.host._wizard.s.step === "quiet"`);
    check(`[${tag}] Schritt: "${T.wz}" steht ganz oben (vor der Ruhezeit), Schalter an (Standard)`, await ev(`const d = r.querySelector("${D}"); const h = [...d.querySelectorAll("h2.wz-h2")].map((x) => x.textContent); return h[0] === ${JSON.stringify(T.wz)} && d.querySelector("[data-wz-bkon]").checked`));
    check(`[${tag}] "${T.now}" gewählt, kein Uhrzeitfeld, Ziel nicht wählbar (kein Zielfeld im Schritt)`, await ev(`const d = r.querySelector("${D}"); return d.querySelector('[data-wz-bk="now"]').classList.contains("on") && !d.querySelector("[data-wz-bktime]") && !d.querySelector("select[data-wz-target]")`));
    await tap(`${D} [data-wz-bk="time"]`);
    check(`[${tag}] "${T.from}": Uhrzeitfeld mit 09:00`, await wait(`return r.querySelector("${D} [data-wz-bktime]")?.value === "09:00"`));
    await setField(`${D} [data-wz-bktime]`, "06:30");
    await p.screenshot({ path: `${process.env.OUT || "output"}/backupalert-wizard-${tag.replace("/", "-")}.png` });
    await tap(`${D} [data-wz="next"]`);
    await wait(`return r.host._wizard.s.step === "done"`);
    check(`[${tag}] Zusammenfassung: ${T.sum} "${T.sumFrom}"`, await ev(`return r.querySelector("${D}").textContent.includes(${JSON.stringify(T.sum)}) && r.querySelector("${D}").textContent.includes(${JSON.stringify(T.sumFrom)})`));
    check(`[${tag}] Werte für das Speichern: status_backup_alert true, status_backup_time 06:30`, await ev(`const v = r.host._wizard.values(); return v.status_backup_alert === true && v.status_backup_time === "06:30"`));
    // ausgeschaltet im Assistenten: kein Uhrzeitfeld, Aus
    await ev(`r.host._wizard.go("quiet")`);
    await wait(`return r.host._wizard.s.step === "quiet"`);
    await tap(`${D} [data-wz-bkon]`);
    check(`[${tag}] Schalter aus: Zeitpunkt verschwindet`, await wait(`return !r.querySelector("${D} [data-wz-bk]")`));
    await ev(`r.host._wizard.go("done")`);
    await wait(`return r.host._wizard.s.step === "done"`);
    check(`[${tag}] Zusammenfassung: ${T.sum} "${T.off}"`, await ev(`const t = r.querySelector("${D}").textContent; return t.includes(${JSON.stringify(T.sum + T.off)})`));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
