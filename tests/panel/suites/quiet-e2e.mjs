// Ruhezeit (2.95.0): Reiter in "Überwachung und Meldungen" mit Schalter, Zeiten je Wochentag, Modus und Meldungsarten.
// Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = { de: { tab: "Ruhezeit", mon: "Montag" }, en: { tab: "Quiet time", mon: "Monday" } };

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const T = TEXT[lang];
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=light`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);

    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    check(`[${tag}] Reiter "${T.tab}"`, await wait(`return r.querySelector('.mon-tab[data-key="quiet"]')?.textContent.trim() === ${JSON.stringify(T.tab)}`));
    await tap('.mon-tab[data-key="quiet"]');
    await wait(`return !!r.querySelector('input[data-opt="quiet_enabled"]')`);
    check(`[${tag}] aus: nur der Schalter`, await ev(`return !r.querySelector('[data-qday]') && !r.querySelector('[data-qtopic]')`));
    await tap('input[data-opt="quiet_enabled"]');
    check(`[${tag}] ein: sieben Tage, zehn Arten`, await wait(`return r.querySelectorAll('[data-qday-on]').length === 7 && r.querySelectorAll('[data-qtopic]').length === 10`));
    check(`[${tag}] Wochentag "${T.mon}"`, await ev(`return r.querySelector('.qd-row .qd-name').textContent.trim() === ${JSON.stringify(T.mon)}`));
    check(`[${tag}] Standard: 22:00 bis 07:00, alle Arten ausser Status`, await ev(`const q = r.host._settings.draft; return q.quiet_days.every((x) => x.on && x.from === "22:00" && x.to === "07:00") && !q.quiet_topics.includes("status") && q.quiet_topics.length === 9`));
    // Montag 23:30 bis 06:15
    const setTime = async (sel, val) => { const h = await handle(sel); await h.scrollIntoViewIfNeeded(); await h.fill(val); };
    await setTime('[data-qday="0"][data-qfield="from"]', "23:30");
    await setTime('[data-qday="0"][data-qfield="to"]', "06:15");
    check(`[${tag}] Montag im Entwurf`, await wait(`const d = r.host._settings.draft.quiet_days[0]; return d.from === "23:30" && d.to === "06:15"`));
    check(`[${tag}] Dienstag unverändert`, await ev(`const d = r.host._settings.draft.quiet_days[1]; return d.from === "22:00" && d.to === "07:00"`));
    // Freitag ausschalten: Zeiten gesperrt
    await tap('[data-qday-on="4"]');
    check(`[${tag}] Freitag aus: Zeitfelder gesperrt`, await wait(`return r.querySelector('[data-qday="4"][data-qfield="from"]').disabled && !r.host._settings.draft.quiet_days[4].on`));
    // Zeiten von Montag für alle
    await tap('[data-set="quiet-all"]');
    check(`[${tag}] Montags-Zeiten für alle, Freitag bleibt aus`, await wait(`const q = r.host._settings.draft.quiet_days; return q.every((x) => x.from === "23:30" && x.to === "06:15") && q[4].on === false && q.filter((x) => x.on).length === 6`));
    // Modus und Arten
    await ev(`const s = r.querySelector('select[data-opt="quiet_mode"]'); s.value = "single"; s.dispatchEvent(new Event("change", { bubbles: true }))`);
    check(`[${tag}] Modus einzeln`, await wait(`return r.host._settings.draft.quiet_mode === "single"`));
    await tap('[data-qtopic="status"]');
    await tap('[data-qtopic="battery"]');
    check(`[${tag}] Status an, Batterie aus`, await wait(`const t = r.host._settings.draft.quiet_topics; return t.includes("status") && !t.includes("battery") && t.length === 9`));
    check(`[${tag}] Punkt am Reiter`, await ev(`return r.querySelector('.mon-tab[data-key="quiet"]').classList.contains("chg")`));
    // Ungültige Zeit: Fehler, Speichern gesperrt
    await setTime('[data-qday="1"][data-qfield="from"]', "");
    check(`[${tag}] leere Zeit: Fehler`, await wait(`return !!r.host._settingsErrors().quiet_days`));
    await setTime('[data-qday="1"][data-qfield="from"]', "23:30");
    check(`[${tag}] gültig: kein Fehler`, await wait(`return !r.host._settingsErrors().quiet_days`));
    await tap('dialog.settings [data-set="save"]');
    await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`);
    const so = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_options").at(-1)?.values);
    check(`[${tag}] gespeichert`, so?.quiet_enabled === true && so.quiet_mode === "single" && so.quiet_days?.[0]?.from === "23:30" && so.quiet_days[4].on === false && so.quiet_topics?.includes("status") && !so.quiet_topics.includes("battery"), JSON.stringify(so));
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
