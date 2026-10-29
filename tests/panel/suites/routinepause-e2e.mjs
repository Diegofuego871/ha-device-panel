// Globale Pause der Routinen (2.175.0, "Pausieren bis" als Fenster seit 2.176.0, docs/mockups/routine-pause-v1, A):
// Hinweis im Reiter "Routinen" des Geräts; im Fenster Routinen eine Zeile mit Schalter und Chip "bis …", der das Fenster öffnet;
// in den Einstellungen "Pausiert bis" mit "Ändern" (gleiches Fenster, Entwurf). Deutsch und Englisch, Desktop und Handy.
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
    const dlg = "dialog.pause-dlg";
    const setField = (v) => ev(`const i = r.querySelector('${dlg} [data-pu-field]'); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true }))`);
    const localIn = (days, hm) => ev(`const d = new Date(Date.now() + ${days} * 864e5); const p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T${hm}"`);
    const epoch = (local) => ev(`return Math.floor(new Date(${JSON.stringify(local)}).getTime() / 1000)`);

    // Ohne Pause: kein Hinweis im Reiter des Geräts
    await ev(`r.host._openDevice("d", "routine")`);
    await wait(`return !!r.querySelector("${root} .rt-rowcard, ${root} .rt-clock")`);
    check(`[${tag}] ohne Pause: kein Hinweis im Reiter`, !(await noteText()));
    await ev(`r.host._closeDevice?.()`);

    // Fenster Routinen: Schalter pausiert sofort unbefristet, eine Zeile mit Chip "ohne Ende"
    await tap(".rtall-btn");
    const body = "dialog.rtall-dlg [data-rta-body]";
    await wait(`return !!r.querySelector("${body} .rt-pause")`);
    await tap(`${body} input[data-rta="routines-pause"]`);
    check(`[${tag}] Schalter: Pause sofort, Chip "ohne Ende", keine Warnzeile`, await wait(`const f = r.querySelector("${body} .rt-pause"); return f.querySelector("input").checked && !!f.querySelector(".pu-chip") && !f.querySelector(".opt-warn")`));
    // Chip öffnet das Fenster; Schnellwahl "Morgen früh" ist vorgewählt
    await tap(`${body} .pu-chip`);
    check(`[${tag}] Chip öffnet das Fenster "Pausieren bis": nichts gewählt, Feld leer, "Pausieren" möglich (Zeit ist optional)`, await wait(`const d = r.querySelector("${dlg}"); return d.open && !d.querySelector(".sub-tab.on") && d.querySelector("[data-pu-field]").value === "" && !d.querySelector('[data-pu="apply"]').disabled && d.querySelector('[data-pu="none"]').disabled`));
    // Ohne Zeit bestätigen: Pause ohne Ende
    await tap(`${dlg} [data-pu="apply"]`);
    await wait(`return !r.querySelector("${dlg}").open`);
    check(`[${tag}] "Pausieren" ohne Zeit: Pause bleibt, Zeitpunkt 0`, (await calls("device_panel/set_options")).at(-1)?.values?.routines_pause_until === 0);
    await tap(`${body} .pu-chip`);
    await wait(`return r.querySelector("${dlg}").open`);
    // Schnellwahl antippen und wieder abwählen
    await tap(`${dlg} [data-v="hour"]`);
    check(`[${tag}] Schnellwahl "1 Std." setzt eine Zeit`, await ev(`const d = r.querySelector("${dlg}"); return d.querySelector(".sub-tab.on")?.dataset.v === "hour" && !!d.querySelector("[data-pu-field]").value`));
    await tap(`${dlg} [data-v="hour"]`);
    check(`[${tag}] zweiter Tipp nimmt die Schnellwahl zurück: wieder ohne Zeit`, await wait(`const d = r.querySelector("${dlg}"); return !d.querySelector(".sub-tab.on") && d.querySelector("[data-pu-field]").value === ""`));
    await p.screenshot({ path: `${process.env.OUT || "output"}/routine-pause-dlg-${tag.replace("/", "-")}.png` });
    // Eigene Zeit in der Vergangenheit: Fehler, "Pausieren" gesperrt
    await setField("2020-01-01T08:00");
    check(`[${tag}] Zeit in der Vergangenheit: Fehler, "Pausieren" gesperrt, keine Schnellwahl gewählt`, await wait(`const d = r.querySelector("${dlg}"); return !!d.querySelector(".pu-res.bad") && d.querySelector('[data-pu="apply"]').disabled && !d.querySelector(".sub-tab.on")`));
    // Schnellwahl "1 Woche"
    await tap(`${dlg} [data-v="week"]`);
    check(`[${tag}] "1 Woche": Zeit rund 7 Tage später`, await ev(`const d = r.querySelector("${dlg}"); const t = new Date(d.querySelector("[data-pu-field]").value).getTime() - Date.now(); return d.querySelector(".sub-tab.on")?.dataset.v === "week" && t > 6.99 * 864e5 && t < 7.01 * 864e5 && !d.querySelector('[data-pu="apply"]').disabled`));
    // Eigene Zeit
    const target = await localIn(2, "07:30");
    await setField(target);
    const want = await epoch(target);
    await tap(`${dlg} [data-pu="apply"]`);
    await wait(`return !r.querySelector("${dlg}").open`);
    const so = (await calls("device_panel/set_options")).at(-1)?.values;
    check(`[${tag}] "Pausieren": sofort gespeichert mit Zeitpunkt`, so && so.routines_pause === true && so.routines_pause_until === want, JSON.stringify(so));
    check(`[${tag}] Chip zeigt "bis …" mit Datum`, await wait(`const c = r.querySelector("${body} .pu-chip"); return !!c && /(bis|until)/.test(c.textContent) && /\\d/.test(c.textContent)`));
    // Abbrechen ändert nichts
    await tap(`${body} .pu-chip`);
    await wait(`return r.querySelector("${dlg}").open`);
    check(`[${tag}] Fenster zeigt den gespeicherten Zeitpunkt`, await ev(`return r.querySelector("${dlg} [data-pu-field]").value === ${JSON.stringify(target)}`));
    const before = (await calls("device_panel/set_options")).length;
    await tap(`${dlg} [data-pu="cancel"]`);
    check(`[${tag}] "Abbrechen": nichts gespeichert`, (await wait(`return !r.querySelector("${dlg}").open`)) && (await calls("device_panel/set_options")).length === before);
    // "Ohne Ende"
    await tap(`${body} .pu-chip`);
    await wait(`return r.querySelector("${dlg}").open`);
    await tap(`${dlg} [data-pu="none"]`);
    check(`[${tag}] "Ohne Ende": Feld leer, Text "ohne Ende"`, await wait(`const d = r.querySelector("${dlg}"); return d.querySelector("[data-pu-field]").value === "" && !d.querySelector(".pu-res.bad")`));
    await tap(`${dlg} [data-pu="apply"]`);
    await wait(`return !r.querySelector("${dlg}").open`);
    check(`[${tag}] gespeichert: Pause bleibt, Zeitpunkt 0`, (await calls("device_panel/set_options")).at(-1)?.values?.routines_pause_until === 0);
    // Zeitpunkt wieder setzen für den Reiter des Geräts
    await tap(`${body} .pu-chip`);
    await wait(`return r.querySelector("${dlg}").open`);
    await setField(target);
    await tap(`${dlg} [data-pu="apply"]`);
    await wait(`return !r.querySelector("${dlg}").open`);
    await ev(`r.host._closeRtAll()`);

    // Reiter des Geräts: Hinweis mit Zeitpunkt
    await ev(`r.host._openDevice("d", "routine")`);
    check(`[${tag}] Reiter des Geräts: Hinweis "pausiert bis" mit Datum`, await wait(`return !!r.querySelector("${root} .rt-paused-note")`) && /(bis|until)/i.test(await noteText()) && /\d/.test(await noteText()), await noteText());
    await ev(`r.host._closeDevice?.()`);

    // Einstellungen: Zeile "Pausiert bis" mit "Ändern", gleiches Fenster, Entwurf
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="routines"]');
    await wait(`return !!r.querySelector('dialog.settings [data-set="pause-until"]')`);
    check(`[${tag}] Einstellungen: Zeile "Pausiert bis" mit Zeitpunkt, kein Datumsfeld im Formular`, await ev(`const o = r.querySelector('dialog.settings [data-set="pause-until"]').closest(".opt"); return /\\d/.test(o.querySelector(".pu-val").textContent) && !r.querySelector('dialog.settings input[type="datetime-local"]')`));
    const nSet = (await calls("device_panel/set_options")).length;
    await tap('dialog.settings [data-set="pause-until"]');
    await wait(`return r.querySelector("${dlg}").open`);
    await tap(`${dlg} [data-pu="none"]`);
    await tap(`${dlg} [data-pu="apply"]`);
    check(`[${tag}] "Ändern" > "Ohne Ende": nur Entwurf (noch nichts gespeichert), Änderung gezählt`, (await wait(`return !r.querySelector("${dlg}").open && !r.querySelector('dialog.settings [data-set="save"]').disabled && /(Ohne Ende|No end)/.test(r.querySelector('dialog.settings .pu-val').textContent)`)) && (await calls("device_panel/set_options")).length === nSet);
    await tap('dialog.settings [data-set="save"]');
    await wait(`return r.querySelector("dialog.settings .set-count.saved")`);
    check(`[${tag}] gespeichert: Zeitpunkt 0`, (await calls("device_panel/set_options")).at(-1)?.values?.routines_pause_until === 0);
    // Pause aus: "Ändern" gesperrt
    await tap('dialog.settings input[data-opt="routines_pause"]');
    check(`[${tag}] Pause aus: "Ändern" gesperrt`, await wait(`return r.querySelector('dialog.settings [data-set="pause-until"]').disabled`));
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
