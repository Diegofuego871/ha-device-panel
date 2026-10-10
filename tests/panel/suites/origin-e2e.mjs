// Herkunft jeder Einstellung im Geräte-Popup und "Ausgefallen nach" pro Gerät
// (0.31.0, docs/mockups/backlog-v1, Punkt 7 A): Etikett Standard / Integration /
// Gerät mit dem Standardwert, Auswahl "Wie Integration" / "Eigene Zeit" /
// "Nicht überwachen", Zurücksetzen in den Einstellungen. DE/EN, Desktop/Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir, ensureDevTab } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

const TEXT = {
  de: {
    label: "Ausgefallen nach", glob: "Globaler Wert (2 Min.)", integ: "Wie Integration (1 Std.)", own: "Eigene Zeit", none: "Nicht überwachen",
    std: "Standard", dev: "Gerät", integOrigin: "Integration Zigbee Home Automation", would: "Standard wäre 2 Min.",
    notifyOn: "Push aus · Anhaltend aus", notifyInteg: "Wie Integration", min: "Min.", range: "Erlaubt: 1 bis 1440", pill: "Nicht überwacht",
    resetTitle: "Eigenes \"Ausgefallen nach\" auf Geräten", batInteg: "Wie Integration (30 %)", batWould: "Standard wäre 15 %",
  },
  en: {
    label: "Offline after", glob: "Global value (2 min)", integ: "Same as integration (1 h)", own: "Own time", none: "Don't monitor",
    std: "Default", dev: "Device", integOrigin: "Integration Zigbee Home Automation", would: "Default would be 2 min",
    notifyOn: "Push off · Persistent off", notifyInteg: "Same as integration", min: "min", range: "Allowed: 1 to 1440", pill: "Not monitored",
    resetTitle: "Own \"Offline after\" on devices", batInteg: "Same as integration (30 %)", batWould: "Default would be 15 %",
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
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
    const ev = async (c) => { await ensureDevTab(f, R, c); return f.evaluate(new Function(`const r=${R};` + c)); };
    const handle = async (sel) => { await ensureDevTab(f, R, sel); return (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement(); };
    const tap = async (sel) => {
      const h = await handle(sel);
      if (!h) throw new Error("fehlt: " + sel);
      await h.scrollIntoViewIfNeeded();
      if (mobile) await h.tap(); else await h.click();
    };
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wait = async (code) => { await ensureDevTab(f, R, code); return f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false); };
    const calls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_device_settings").map(({ type, ...rest }) => rest));
    const row = (name) => `r.querySelector('select[data-dlg="${name}"]').closest(".opt")`;
    const origin = (name) => ev(`const o=${row(name)}.querySelector(".opt-origin"); return [o.querySelector(".origin").textContent.trim(), o.querySelector(".origin").className.replace("origin ",""), o.textContent.replace(o.querySelector(".origin").textContent,"").trim()]`);
    const openDev = async (id) => {
      await ev(`r.host._openDevice(${JSON.stringify(id)})`);
      await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device [data-tab=\"set\"]')`); await tap('dialog.device [data-tab="set"]'); await wait(`return r.querySelector('select[data-dlg="dev-off"]')`);
    };

    // Zigbee-Gerät "e" (Fensterkontakt Küche): Standard
    await openDev("e");
    check(`[${tag}] Zeile "${T.label}" zuerst im Abschnitt`, (await ev(`return r.querySelector(".dev-set .opt .opt-label").textContent`)) === T.label);
    const sel0 = await ev(`const s=r.querySelector('select[data-dlg="dev-off"]'); return s.value + "|" + s.options[s.selectedIndex].textContent + "|" + [...s.options].map(o=>o.textContent).join(",")`);
    check(`[${tag}] globaler Wert, drei Wahlmöglichkeiten`, sel0 === `default|${T.glob}|${T.glob},${T.own},${T.none}`, sel0);
    const o0 = await origin("dev-off");
    check(`[${tag}] Herkunft "${T.std}"`, o0[0] === T.std && o0[1] === "std" && o0[2] === "", JSON.stringify(o0));
    check(`[${tag}] Herkunft Batterie: Standard`, (await origin("dev-bat"))[1] === "std");
    const no = await origin("dev-notify");
    check(`[${tag}] Meldungen: Herkunft und Zustand`, no[1] === "std" && no[2] === T.notifyOn, JSON.stringify(no));
    await p.screenshot({ path: `${outDir}/origin-std-${tag.replace("/", "-")}.png` });

    // Eigene Zeit: beginnt beim geltenden Wert, Herkunft "Gerät" mit Standardwert
    await (await handle('select[data-dlg="dev-off"]')).selectOption("own");
    check(`[${tag}] eigene Zeit beginnt bei 2 Min., gesendet`, await wait(`return r.querySelector('input[data-dlg="dev-off-min"]')?.value === "2"`) && JSON.stringify((await calls()).at(-1)) === JSON.stringify({ device_id: "e", offline: 2 }), JSON.stringify((await calls()).at(-1)));
    const o1 = await origin("dev-off");
    check(`[${tag}] Herkunft "${T.dev}" mit "${T.would}"`, o1[0] === T.dev && o1[1] === "own" && o1[2] === T.would, JSON.stringify(o1));
    check(`[${tag}] Einheit`, (await text(".opt-sub .unit")) === T.min);
    const inp = await handle('input[data-dlg="dev-off-min"]');
    if (mobile) await inp.tap(); else await inp.click();
    await ev(`const i=r.querySelector('input[data-dlg="dev-off-min"]'); i.select()`);
    await p.keyboard.type("0");
    await p.keyboard.press("Tab");
    check(`[${tag}] ungültig: Bereich genannt, nichts gesendet`, await wait(`return !!r.querySelector("[data-dev-range]")`) && (await text("[data-dev-range]")) === T.range && (await calls()).at(-1).offline === 2, await text("[data-dev-range]"));
    await ev(`const i=r.querySelector('input[data-dlg="dev-off-min"]'); i.focus(); i.select()`);
    await p.keyboard.type("90");
    await p.keyboard.press("Tab");
    check(`[${tag}] 90 Min. gesendet`, await wait(`return r.querySelector('input[data-dlg="dev-off-min"]')?.value === "90"`) && (await calls()).at(-1).offline === 90, JSON.stringify((await calls()).at(-1)));
    check(`[${tag}] Gerät in der Liste: eigene Zeit`, await wait(`return r.host._devices.find((d) => d.id === "e").offline_after === 90`));
    // Nicht überwachen
    await (await handle('select[data-dlg="dev-off"]')).selectOption("off");
    check(`[${tag}] "${T.none}" gesendet, Gerät ohne Status`, await wait(`const d=r.host._devices.find((x) => x.id === "e"); return d.unmonitored === true && d.online == null`) && (await calls()).at(-1).offline === "off");
    // Der Status kommt mit der nächsten Abfrage; nach einer Berührung wartet das Popup kurz (siehe _dlgBusy).
    await wait(`return (r.querySelector("dialog.device .dlg-title .pill, dialog.device .dlg-head .pill")?.textContent || "").includes(${JSON.stringify(T.pill)})`);
    check(`[${tag}] Popup: Status "${T.pill}"`, (await text("dialog.device .dlg-title .pill, dialog.device .dlg-head .pill")).includes(T.pill), await text("dialog.device .dlg-head"));
    await p.screenshot({ path: `${outDir}/origin-own-${tag.replace("/", "-")}.png` });
    // Zurück: Standard
    await (await handle('select[data-dlg="dev-off"]')).selectOption("default");
    check(`[${tag}] zurück auf Standard, null gesendet`, await wait(`return r.host._devices.find((d) => d.id === "e").offline_setting === null`) && (await calls()).at(-1).offline === null);
    await tap('dialog.device [data-dlg="close"]');
    await wait(`return !r.querySelector("dialog.device").open`);

    // Integration mit eigener Zeit (Zigbee 1 Std., Batterie 30 %): Herkunft "Integration"
    await p.evaluate(() => { window.__opts.offline_after_integrations = { zha: 60 }; window.__opts.battery_low_integrations = { zha: 30 }; });
    await ev(`r.host._fetch(true)`);
    await wait(`return r.host._devices.find((d) => d.id === "e").offline_default.integration === "zha"`);
    await openDev("e");
    const si = await ev(`const s=r.querySelector('select[data-dlg="dev-off"]'); return s.options[s.selectedIndex].textContent`);
    const oi = await origin("dev-off");
    check(`[${tag}] "${T.integ}", Herkunft Integration mit Standardwert`, si === T.integ && oi[1] === "integ" && oi[0] === T.integOrigin && oi[2] === T.would, `${si} ${JSON.stringify(oi)}`);
    const ob = await origin("dev-bat");
    const sb = await ev(`const s=r.querySelector('select[data-dlg="dev-bat"]'); return s.options[s.selectedIndex].textContent`);
    check(`[${tag}] Batterie: "${T.batInteg}", "${T.batWould}"`, sb === T.batInteg && ob[1] === "integ" && ob[2] === T.batWould, `${sb} ${JSON.stringify(ob)}`);
    const nsel = await ev(`const s=r.querySelector('select[data-dlg="dev-notify"]'); return s.options[s.selectedIndex].textContent`);
    check(`[${tag}] Meldungen: Standardtext ohne Integration`, nsel !== T.notifyInteg);
    // Push-Ausnahme der Integration: "Wie Integration"
    await tap('dialog.device [data-dlg="close"]');
    await p.evaluate(() => { window.__opts.notify_service = "notify.familie"; window.__opts.notify_outage = true; window.__opts.notify_exclude_integrations = ["zha"]; });
    await ev(`r.host._fetch(true)`);
    await wait(`return r.host._devices.find((d) => d.id === "e").notify_default.integration === "zha"`);
    await openDev("e");
    const ns = await ev(`const s=r.querySelector('select[data-dlg="dev-notify"]'); return s.options[s.selectedIndex].textContent`);
    const on = await origin("dev-notify");
    check(`[${tag}] Meldungen: "${T.notifyInteg}", Integration, Push aus`, ns === T.notifyInteg && on[1] === "integ", `${ns} ${JSON.stringify(on)}`);
    await p.screenshot({ path: `${outDir}/origin-integ-${tag.replace("/", "-")}.png` });
    // Tooltip trägt die Erklärung
    check(`[${tag}] Tooltip am Etikett`, (await ev(`return ${row("dev-off")}.querySelector(".origin").title.length`)) > 40);
    // Einzeiliges Etikett, kein Überlauf
    const fit = await ev(`const d=r.querySelector("dialog.device"); return [d.scrollWidth <= d.clientWidth, ...[...d.querySelectorAll(".opt-origin")].map(o=>o.getBoundingClientRect().right <= d.getBoundingClientRect().right + 1)]`);
    check(`[${tag}] Herkunftszeilen ohne seitlichen Überlauf`, fit.every(Boolean), JSON.stringify(fit));
    await tap('dialog.device [data-dlg="close"]');
    await wait(`return !r.querySelector("dialog.device").open`);

    // Symbol am Gerät und Chip "Eigene Einstellung"
    await p.evaluate(() => { window.__devSettings.offline = { e: 30, l: "off" }; });
    await ev(`r.host._fetch(true)`);
    await wait(`return r.host._devices.find((d) => d.id === "e").offline_setting === 30`);
    const tips = await ev(`return [...r.querySelectorAll('.dev[data-open="e"] .ovr')].map(x=>x.getAttribute("title")).join("|")`);
    check(`[${tag}] Symbol beim Namen: eigene Zeit`, tips.includes("30") && tips.length > 5, tips);

    // Einstellungen: Liste "Eigenes Ausgefallen nach auf Geräten" mit Zurücksetzen
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    // Seit 0.34.0 im Reiter "Ausfall" von "Überwachung und Meldungen".
    await tap('[data-set="section"][data-id="monitor"]');
    await tap('[data-set="tab"][data-key="outage"]');
    await wait(`return !!r.querySelector(".ovr-opt")`);
    check(`[${tag}] Liste "${T.resetTitle}" mit 2 Geräten`, (await text(".ovr-opt .opt-label")) === T.resetTitle && (await ev(`return r.querySelectorAll(".ovr-opt .ovr-row").length`)) === 2, await text(".ovr-opt"));
    await tap('.ovr-opt [data-set="ovr-all"]');
    check(`[${tag}] Entwurf: 2 Änderungen`, /^2 /.test(await text(".set-count")), await text(".set-count"));
    await p.evaluate(() => { window.__wsCalls.length = 0; });
    await tap('dialog.settings [data-set="save"]');
    await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`);
    const reset = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/reset_device_settings").at(-1));
    check(`[${tag}] reset_device_settings mit offline`, JSON.stringify([...(reset?.offline || [])].sort()) === JSON.stringify(["e", "l"]), JSON.stringify(reset));
    check(`[${tag}] danach keine eigene Zeit`, await wait(`return r.host._devices.filter((d) => d.offline_setting != null).length === 0`));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
