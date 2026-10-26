// Ohne Online-Status (2.156.0, docs/mockups/nostatus-v1): ein Gerät bleibt überwacht (Batterie, Laden, Empfang), hat aber keinen Online-Status, keine
// Ausfälle und keine Ausfall-Meldungen. Ring statt Punkt, Zeile unter den Kacheln, Filter-Chip, Schalter "Online-Status beobachten" in Integration, Label
// und Geräte-Popup, Auswahl im Einrichtungsassistenten. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir, savePending } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { line: /ohne Online-Status/, chip: "Ohne Online-Status", sw: "Online-Status beobachten", label: "Oft offline" },
  en: { line: /without online status/i, chip: "No online status", sw: "Watch online status", label: "Often offline" },
};

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const L = T[lang];
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const errors = [];
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark&wizard=open`);
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
    const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
    const refetch = async () => { await ev(`return r.host._fetch(true).then(()=>true)`); };
    const calls = (type) => p.evaluate((t) => window.__wsCalls.filter((m) => m.type === t), type);

    // --- ohne Einstellung: keine Zeile, kein Chip
    check(`[${tag}] ohne Einstellung: keine Zeile in der Kachel`, !(await ev(`return !!r.querySelector(".lines i.ring")`)));
    check(`[${tag}] ohne Einstellung: kein Chip`, !(await ev(`return !!r.querySelector('.chips [data-hint="nostatus"]')`)));

    // --- Zigbee ohne Online-Status
    await p.evaluate(() => { window.__opts.offline_after_integrations = { zha: "nostatus" }; });
    await refetch();
    const ns = await ev(`return r.host._devices.filter((d) => d.no_status).map((d) => d.id).sort().join()`);
    check(`[${tag}] Backend-Feld: Zigbee-Geräte ohne Online-Status`, ns.length > 0 && !ns.includes("a"), ns);
    check(`[${tag}] ohne Status: online und Ausfallzeit leer`, await ev(`return r.host._devices.filter((d) => d.no_status).every((d) => d.online == null && d.offline_after == null && d.avail24 == null)`));
    const count = await ev(`return r.host._devices.filter((d) => d.no_status && !d.disabled && !d.unmonitored).length`);
    const nsRow = `r.querySelector(".lines i.ring")?.parentElement?.innerText || ""`;
    check(`[${tag}] Kachel Verfügbarkeit: Zeile mit Anzahl und Ring`, await wait(`return (${nsRow}).includes(String(${count}))`) && L.line.test(await ev(`return ${nsRow}`)), await ev(`return ${nsRow}`));
    check(`[${tag}] keine eigene Zeile unter den Kacheln mehr`, !(await ev(`return !!r.querySelector(".nsline")`)));
    check(`[${tag}] Chip "${L.chip}" in der Chip-Leiste`, await ev(`return !!r.querySelector('.chips [data-hint="nostatus"]')`));
    check(`[${tag}] Kachel zählt Geräte ohne Status nicht als online`, await ev(`const n=r.host._devices.filter((d)=>!d.no_status && !d.disabled && !d.unmonitored).length; return r.querySelector(".ringwrap .c")?.innerText.replace(/\\s+/g," ").includes(String(r.host._devices.filter((d)=>d.online===true).length))`));
    check(`[${tag}] Kachel: Ring, kein Ausfall`, await ev(`const d=r.querySelector('.dev[data-open="b"]'); return !!d && !!(d.querySelector(".pd.ring, .av.ns")) && !d.querySelector(".pd.off")`));

    // --- Chip filtert
    await tap('.chips [data-hint="nostatus"]');
    check(`[${tag}] Filter zeigt nur Geräte ohne Online-Status`, await wait(`const ids=[...r.querySelectorAll(".dev")].map((x) => x.dataset.open); return ids.length > 0 && ids.every((id) => r.host._devices.find((d) => d.id === id).no_status)`));
    await tap('.chips [data-hint="nostatus"]');
    await wait(`return r.querySelectorAll(".dev").length > ${count}`);

    // --- Popup: Auswahl und Status
    await ev(`r.host._openDevice("b")`);
    await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device [data-tab="set"]')`);
    check(`[${tag}] Popup zeigt "${L.chip}"`, (await ev(`return r.querySelector("dialog.device").innerText`)).includes(L.chip));
    await tap('dialog.device [data-tab="set"]');
    await wait(`return r.querySelector('select[data-dlg="dev-off"]')`);
    const mode = await ev(`const s=r.querySelector('select[data-dlg="dev-off"]'); return s.value + "|" + s.options[s.selectedIndex].textContent`);
    check(`[${tag}] Popup: Auswahl "${L.chip}", Herkunft Integration`, mode.endsWith(`(${L.chip})`), mode);
    await ev(`const s=r.querySelector('select[data-dlg="dev-off"]'); s.value="own"; s.dispatchEvent(new Event("change",{bubbles:true}));`);
    await savePending(f, R);
    const last = (await calls("device_panel/set_device_settings")).at(-1);
    check(`[${tag}] eigene Zeit am Gerät schaltet den Status wieder ein`, last?.device_id === "b" && Number.isInteger(last.offline), JSON.stringify(last));
    await ev(`const s=r.querySelector('select[data-dlg="dev-off"]'); s.value="nostatus"; s.dispatchEvent(new Event("change",{bubbles:true}));`);
    await savePending(f, R);
    check(`[${tag}] Gerät auf "${L.chip}" gesendet`, (await calls("device_panel/set_device_settings")).at(-1)?.offline === "nostatus");
    await ev(`r.querySelector("dialog.device").close()`);

    // --- Integration: Schalter
    await p.evaluate(() => { window.__opts.offline_after_integrations = {}; delete window.__devSettings.offline.b; });
    await refetch();
    check(`[${tag}] Einstellung zurück: Zeile weg`, await wait(`return !r.querySelector(".lines i.ring")`));
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await tap('[data-set="tab"][data-key="integ"]');
    await wait(`return !!r.querySelector(".ilist")`);
    await tap('[data-set="integ"][data-key="hue"]');
    await wait(`return !!r.querySelector('[data-istatus="hue"]')`);
    check(`[${tag}] Integration: Schalter "${L.sw}" an`, await ev(`return r.querySelector('[data-istatus="hue"]').checked === true`));
    await tap('input[data-istatus="hue"]');
    await tap('dialog.settings [data-set="save"]');
    await wait(`return true`);
    await p.waitForTimeout(300);
    const saved = (await calls("device_panel/set_options")).at(-1);
    check(`[${tag}] Integration: "nostatus" gespeichert`, saved?.values?.offline_after_integrations?.hue === "nostatus", JSON.stringify(saved?.values?.offline_after_integrations));
    await p.screenshot({ path: `${outDir}/nostatus-integ-${tag.replace("/", "-")}.png` });
    check(`[${tag}] Zeile erscheint nach dem Speichern`, await wait(`return !!r.querySelector(".lines i.ring")`));

    // --- Assistent: Label-Karte und Drill-Down
    await p.evaluate((name) => {
      window.__labels = [{ id: "oft_offline", name }];
      window.__devLabels = { b: ["oft_offline"], e: ["oft_offline"] };
    }, L.label);
    await refetch();
    await ev(`r.host._wizard.open("app")`);
    await wait(`return r.querySelector("dialog.wizard-dlg")?.open && !r.host._wizard.s?.loading`);
    await ev(`r.host._wizard.go("labels")`);
    await wait(`return !!r.querySelector("dialog.wizard-dlg [data-wz-lab]")`);
    await ev(`const e=r.querySelector("[data-wz-lab]"); e.value="oft_offline"; e.dispatchEvent(new Event("change",{bubbles:true}));`);
    await wait(`return !!r.querySelector(".wz-lcard")`);
    check(`[${tag}] Assistent: Label-Karte mit "${L.sw}"`, await ev(`return !!r.querySelector('.wz-lcard input[data-wz-lf="status"]')`));
    await ev(`r.querySelector('.wz-lcard input[data-wz-lf="status"]').click()`);
    check(`[${tag}] Assistent: Ausfall-Wahl gesperrt, wenn aus`, await wait(`const c=r.querySelector('.wz-lcard'); return c.querySelector('[data-wz-lf="after"]').disabled && c.querySelector('[data-wz-lf="push"]').disabled`));
    const vals = await ev(`return r.host._wizard.labelValues({})`);
    check(`[${tag}] Assistent: Label schreibt "nostatus"`, vals.offline_after_integrations?.["label:oft_offline"] === "nostatus", JSON.stringify(vals.offline_after_integrations));
    await p.screenshot({ path: `${outDir}/nostatus-wizard-${tag.replace("/", "-")}.png` });

    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
