// Globale Pause der Routinen (2.175.0): Hinweis im Reiter "Routinen" des Geräts, "Pausieren bis" in den Einstellungen (Datum und Uhrzeit),
// Warntext mit Zeitpunkt, Ausschalten setzt "bis" zurück. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const SEED = (id, device, name) => ({ id, device_id: device, entity_id: "switch.plug", name, action: "on", back_s: null, kind: "repeat", delay_s: null, date: null, time: "06:30", repeat: "daily", weekdays: null, mday: null, enabled: true, push: false, target: null, created: Date.now() / 1000 });

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1400, height: 900 } });
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
    await p.evaluate((rts) => { (window.__routines ||= { list: [], seq: 1, runs: [], tests: [] }).list.push(...rts); }, [SEED("aaaaaaaaaaa1", "d", "Bewässerung")]);
    const root = ".rt-root";
    const noteText = () => ev(`return r.querySelector("${root} .rt-paused-note")?.textContent.trim() || ""`);

    // Ohne Pause: kein Hinweis im Reiter des Geräts
    await ev(`r.host._openDevice("d", "routine")`);
    await wait(`return !!r.querySelector("${root} .rt-rowcard, ${root} .rt-clock")`);
    check(`[${tag}] ohne Pause: kein Hinweis im Reiter`, !(await noteText()));
    await ev(`r.host._closeDevice?.()`);

    // Einstellungen: Pause einschalten, "Pausieren bis" wird bedienbar
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="routines"]');
    await wait(`return !!r.querySelector('dialog.settings input[data-opt="routines_pause_until"]')`);
    const until = 'dialog.settings input[data-opt="routines_pause_until"]';
    check(`[${tag}] "Pausieren bis" gesperrt, solange nicht pausiert`, await ev(`return r.querySelector('${until}').disabled && r.querySelector('dialog.settings [data-set="pause-until-clear"]').disabled`));
    await tap('dialog.settings input[data-opt="routines_pause"]');
    check(`[${tag}] Pause an: Feld bedienbar`, await wait(`return !r.querySelector('${until}').disabled`));
    // Zeit in der Vergangenheit: Fehler, Speichern gesperrt
    await ev(`const i = r.querySelector('${until}'); i.value = "2020-01-01T08:00"; i.dispatchEvent(new Event("input", { bubbles: true }))`);
    check(`[${tag}] Zeit in der Vergangenheit: Fehler, Speichern gesperrt`, await wait(`return !!r.querySelector('${until}').closest(".opt").querySelector(".opt-error") && r.querySelector('dialog.settings [data-set="save"]').disabled`));
    // Zeit in 2 Tagen um 07:30 (Browserzeit)
    const target = await ev(`const d = new Date(Date.now() + 2 * 864e5); d.setHours(7, 30, 0, 0); const p = (n) => String(n).padStart(2, "0"); const i = r.querySelector('${until}'); i.value = d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T07:30"; i.dispatchEvent(new Event("input", { bubbles: true })); return Math.floor(d.getTime() / 1000)`);
    check(`[${tag}] gültige Zeit: kein Fehler, Speichern möglich`, await wait(`return !r.querySelector('${until}').closest(".opt").querySelector(".opt-error") && !r.querySelector('dialog.settings [data-set="save"]').disabled`));
    await tap('dialog.settings [data-set="save"]');
    await wait(`return r.querySelector("dialog.settings .set-count.saved")`);
    const so = (await calls("device_panel/set_options")).at(-1)?.values;
    check(`[${tag}] gespeichert: Pause und Zeitpunkt`, so && so.routines_pause === true && so.routines_pause_until === target, JSON.stringify(so));
    check(`[${tag}] Zusammenfassung nennt den Zeitpunkt`, /(bis|until)/.test(await ev(`return r.querySelector('[data-id="routines"] .set-sec-sum').textContent`)));
    await tap('dialog.settings .dlg-actions [data-set="close"]');

    // Reiter des Geräts: Hinweis mit Zeitpunkt
    await ev(`r.host._openDevice("d", "routine")`);
    check(`[${tag}] Reiter des Geräts: Hinweis "pausiert bis" mit Datum`, await wait(`return !!r.querySelector("${root} .rt-paused-note")`) && /(bis|until)/i.test(await noteText()) && /\d/.test(await noteText()), await noteText());
    await p.screenshot({ path: `${process.env.OUT || "output"}/routine-pause-${tag.replace("/", "-")}.png` });
    await ev(`r.host._closeDevice?.()`);

    // Pause ohne Ende (Knopf): Hinweis ohne Datum
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="routines"]');
    await wait(`return !!r.querySelector('${until}')`);
    check(`[${tag}] Einstellungen zeigen den gespeicherten Zeitpunkt`, await ev(`return r.querySelector('${until}').value.endsWith("T07:30")`));
    // Wie auf dem Handy: das Feld wurde getippt (Wert gesetzt), "Ohne Ende" muss es trotzdem leeren
    await ev(`const i = r.querySelector('${until}'); i.value = "2031-01-01T08:00"; i.dispatchEvent(new Event("input", { bubbles: true }))`);
    await tap('dialog.settings [data-set="pause-until-clear"]');
    check(`[${tag}] "Ohne Ende": Feld leer, Änderung gezählt`, await wait(`return r.querySelector('${until}').value === "" && !r.querySelector('dialog.settings [data-set="save"]').disabled`));
    await tap('dialog.settings [data-set="save"]');
    await wait(`return r.querySelector("dialog.settings .set-count.saved")`);
    check(`[${tag}] gespeichert: Pause bleibt, Zeitpunkt 0`, await (async () => { const v = (await calls("device_panel/set_options")).at(-1)?.values; return v?.routines_pause_until === 0; })());
    // Ausschalten: "bis" wird zurückgesetzt, Feld gesperrt
    await tap('dialog.settings input[data-opt="routines_pause"]');
    check(`[${tag}] Pause aus: Feld wieder gesperrt`, await wait(`return r.querySelector('${until}').disabled`));
    await tap('dialog.settings [data-set="save"]');
    await wait(`return r.querySelector("dialog.settings .set-count.saved")`);
    await tap('dialog.settings .dlg-actions [data-set="close"]');
    await ev(`r.host._openDevice("d", "routine")`);
    await wait(`return !!r.querySelector("${root} .rt-rowcard, ${root} .rt-clock")`);
    check(`[${tag}] nach dem Ausschalten: Hinweis weg`, !(await noteText()));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(";"));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
