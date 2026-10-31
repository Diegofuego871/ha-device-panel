// "Instabil ab" auf allen vier Ebenen (2.182.0): Gerät > Label > Integration > global.
// Geräte-Popup (Standard/Eigener Wert, Herkunft, Wirkung auf "instabil"), Integrationsdetail, Label, Übersicht und Zurücksetzen.
// Simulator: Gerät e (zha, 5 Unterbrüche in 24 Std.), Gerät f (3). DE/EN, Desktop/Handy.
import { chromium } from "playwright-core";
import { launchOptions, ensureDevTab, savePending } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

const TEXT = {
  de: { glob: "Globaler Wert (3 Unterbrüche)", integ: "Unterbrüche)", label: "Instabil ab", own: "Eigener Wert" },
  en: { glob: "Global value (3 outages)", integ: "outages)", label: "Unstable from", own: "Own value" },
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
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=light`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
    const ev = async (c) => { await ensureDevTab(f, R, c); return f.evaluate(new Function(`const r=${R};` + c)); };
    const handle = async (sel) => { await ensureDevTab(f, R, sel); return (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement(); };
    const wait = async (code) => { await ensureDevTab(f, R, code); return f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false); };
    const calls = async () => { await savePending(f, R); return p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_device_settings").map(({ type, ...rest }) => rest)); };
    const dev = (id) => `r.host._devices.find((d) => d.id === ${JSON.stringify(id)})`;
    const openDev = async (id) => {
      await ev(`r.host._openDevice(${JSON.stringify(id)})`);
      await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device [data-tab="set"]')`);
      await (await handle('dialog.device [data-tab="set"]')).click();
      await wait(`return r.querySelector('select[data-dlg="dev-flaky"]')`);
    };
    const closeDev = async () => { await (await handle('dialog.device [data-dlg="close"]')).click(); await wait(`return !r.querySelector("dialog.device").open`); };
    const refetch = async () => { await ev(`r.host._fetch(true)`); await wait(`return !!${dev("e")}`); };
    const optText = () => ev(`const s=r.querySelector('select[data-dlg="dev-flaky"]'); return s.value + "|" + s.options[s.selectedIndex].textContent`);

    // --- global
    check(`[${tag}] e ist instabil (5 Unterbrüche, global 3)`, await ev(`return ${dev("e")}.flaky === true`));
    await openDev("e");
    check(`[${tag}] Standard: globaler Wert`, (await optText()) === `default|${T.glob}`, await optText());
    check(`[${tag}] Beschriftung "${T.label}"`, (await ev(`return r.querySelector('select[data-dlg="dev-flaky"]').closest(".opt").querySelector(".opt-label").textContent`)) === T.label);

    // --- Gerät: eigener Wert startet beim geltenden Wert, wirkt sofort
    await (await handle('select[data-dlg="dev-flaky"]')).selectOption("own");
    check(`[${tag}] eigener Wert beginnt bei 3, gesendet`, await wait(`return r.querySelector('input[data-dlg="dev-flaky-count"]')?.value === "3"`) && (await calls()).at(-1).flaky === 3, JSON.stringify((await calls()).at(-1)));
    await ev(`const i=r.querySelector('input[data-dlg="dev-flaky-count"]'); i.focus(); i.select()`);
    await p.keyboard.type("6");
    await p.keyboard.press("Tab");
    check(`[${tag}] 6 gesendet, e nicht mehr instabil`, await wait(`return ${dev("e")}.flaky_setting === 6`) && (await calls()).at(-1).flaky === 6 && await wait(`return ${dev("e")}.flaky === false && ${dev("e")}.flaky_outages === 6`), JSON.stringify((await calls()).at(-1)));
    check(`[${tag}] Herkunft "Eigene" mit Standard-Hinweis`, await ev(`const o=r.querySelector('select[data-dlg="dev-flaky"]').closest(".opt"); return !!o.querySelector(".origin.own")`));
    // Ausserhalb 2..50: Fehler am Feld, nichts gesendet
    const n0 = (await calls()).length;
    await ev(`const i=r.querySelector('input[data-dlg="dev-flaky-count"]'); i.focus(); i.select()`);
    await p.keyboard.type("1");
    await p.keyboard.press("Tab");
    check(`[${tag}] 1 ist zu klein: Fehler am Feld, nicht gesendet`, await wait(`return !!r.querySelector("[data-dev-range]")`) && (await calls()).length === n0);
    await ev(`const i=r.querySelector('input[data-dlg="dev-flaky-count"]'); i.focus(); i.select()`);
    await p.keyboard.type("6");
    await p.keyboard.press("Tab");
    await closeDev();

    // --- Übersicht der eigenen Werte (Einstellungen) und Zurücksetzen
    const ov = await ev(`return JSON.stringify(r.host._devices.filter((d) => d.flaky_setting != null).map((d) => d.id))`);
    check(`[${tag}] nur e hat einen eigenen Wert`, ov === '["e"]', ov);

    // zurück auf Standard
    await openDev("e");
    await (await handle('select[data-dlg="dev-flaky"]')).selectOption("default");
    await savePending(f, R);
    check(`[${tag}] zurück auf Standard, e wieder instabil`, await wait(`return ${dev("e")}.flaky_setting === null && ${dev("e")}.flaky === true`));
    await closeDev();

    // --- Integration: zha = 6 → e "Wie Integration", nicht instabil
    await p.evaluate(() => { window.__opts.flaky_outages_integrations = { zha: 6 }; });
    await refetch();
    await wait(`return ${dev("e")}.flaky_default.integration === "zha"`);
    check(`[${tag}] Integration zha = 6: e nicht instabil`, await ev(`return ${dev("e")}.flaky === false && ${dev("e")}.flaky_outages === 6`));
    await openDev("e");
    const s1 = await optText();
    check(`[${tag}] Popup: "Wie Integration (6 ${T.integ}"`, s1.startsWith("default|") && s1.includes("6") && s1.endsWith(T.integ), s1);
    await closeDev();

    // --- Label geht vor Integration: garage = 4 (e trägt garage)
    await p.evaluate(() => {
      window.__labels = [{ id: "garage", name: "Garage" }];
      window.__devLabels = { e: ["garage"] };
      window.__opts.labels = ["garage"];
      window.__opts.flaky_outages_integrations = { zha: 6, "label:garage": 4 };
    });
    await refetch();
    await wait(`return ${dev("e")}.flaky_default.integration === "label:garage"`);
    check(`[${tag}] Label garage = 4 geht vor Integration 6: e instabil, Quelle Label`, await ev(`return ${dev("e")}.flaky === true && ${dev("e")}.flaky_outages === 4`));
    // Gerät geht vor Label
    await p.evaluate(() => { window.__devSettings.flaky.e = 6; });
    await refetch();
    check(`[${tag}] Gerät 6 geht vor Label 4: e nicht instabil`, await ev(`return ${dev("e")}.flaky === false && ${dev("e")}.flaky_outages === 6`));
    await p.evaluate(() => { window.__devSettings.flaky = {}; window.__opts.flaky_outages_integrations = {}; window.__devLabels = {}; window.__opts.labels = []; });
    await refetch();

    // --- Integrationsdetail: Auswahl, Entwurf, Speichern, Übersicht
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await tap('[data-set="tab"][data-key="integ"]');
    await wait(`return !!r.querySelector(".ilist")`);
    await tap('[data-set="integ"][data-key="zha"]');
    await wait(`return !!r.querySelector('select[data-flaky-mode="zha"]')`);
    check(`[${tag}] Integration: Auswahl vorhanden, Standard`, (await ev(`return r.querySelector('select[data-flaky-mode="zha"]').value`)) === "default");
    await ev(`const s=r.querySelector('select[data-flaky-mode="zha"]'); s.value="10"; s.dispatchEvent(new Event("change",{bubbles:true,composed:true}))`);
    check(`[${tag}] Entwurf 10`, await wait(`return r.host._settings.draft.flaky_outages_integrations?.zha === 10`));
    await tap('[data-set="integ"][data-key=""]');
    await wait(`return !!r.querySelector(".ilist")`);
    const diff = await ev(`return (r.querySelector('.ilist-row[data-key="zha"] .ilist-diff')?.textContent || "").trim()`);
    check(`[${tag}] Liste nennt "${lang === "de" ? "Instabil ab 10" : "Unstable from 10"}"`, diff.includes(lang === "de" ? "Instabil ab 10" : "Unstable from 10"), diff);
    await tap('dialog.settings [data-set="save"]');
    await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`);
    const so = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_options").at(-1)?.values);
    check(`[${tag}] gespeichert`, so?.flaky_outages_integrations?.zha === 10, JSON.stringify(so?.flaky_outages_integrations));
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
