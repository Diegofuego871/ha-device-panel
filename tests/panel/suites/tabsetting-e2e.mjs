// Reiter "Routinen" und "Magic Push" im Geräte-Fenster (2.244.0): je ein globaler Schalter (Einstellungen › Routinen und Abschnitt "Magic Push") und
// (2.246.0) je ein zweiter Schalter "nur bei Geräten, die vorkommen" (Standard an): Routinen in einer Routine, Magic Push mit einer Meldung.
// Dazu der Standard-Empfänger neuer Magic-Push-Meldungen (leer = das globale Ziel).
// Der Simulator zeigt sonst bei allen Geräten beide Reiter an (window.__strictRoutineTab = wie im Betrieb). Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { secMagic: "Magic Push", std: "Standard" },
  en: { secMagic: "Magic Push", std: "Default" },
};
const TARGET = "notify.mobile_app_partner_iphone";

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
    const refetch = () => ev(`return r.host._fetch().then(() => true)`);
    const tabsOf = () => ev(`return [...r.querySelectorAll("dialog.device .sub-tabs > button")].map((x) => x.dataset.tab).join()`);
    const openDevice = async () => { await tap('.dev[data-open="d"]'); await wait(`return r.querySelector("dialog.device")?.open && !!r.querySelector("dialog.device .sub-tabs > button")`); };
    const closeDevice = async () => { await tap('dialog.device [data-dlg="close"]'); await wait(`return !r.querySelector("dialog.device").open`); };

    // --- Einstellungen: Schalter im Abschnitt "Routinen", neuer Abschnitt "Magic Push" danach
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    check(`[${tag}] Abschnitte: Routinen, dann "${T.secMagic}", dann KI`, (await ev(`return [...r.querySelectorAll(".set-sec-head")].map((h) => h.dataset.id).join(",")`)) === "devices,monitor,routines,magic,ai,updates");
    await tap('[data-set="section"][data-id="routines"]');
    check(`[${tag}] Routinen: Schalter "Reiter Routinen im Geräte-Fenster", standardmässig an`, await wait(`const i = r.querySelector('dialog.settings input[data-opt="show_tab_routines"]'); return !!i && i.checked`));
    check(`[${tag}] Routinen: zweiter Schalter "nur bei Geräten mit Routinen" unter dem Reiter-Schalter, standardmässig an`, await wait(`const a = r.querySelector('dialog.settings input[data-opt="show_tab_routines"]'), b = r.querySelector('dialog.settings input[data-opt="tab_routines_only_used"]'); return !!b && b.checked && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)`));
    await tap('[data-set="section"][data-id="routines"]');
    await tap('[data-set="section"][data-id="magic"]');
    check(`[${tag}] Magic Push: zweiter Schalter "nur bei Geräten mit Meldungen" unter dem Reiter-Schalter, standardmässig an`, await wait(`const a = r.querySelector('dialog.settings input[data-opt="show_tab_magic"]'), b = r.querySelector('dialog.settings input[data-opt="tab_magic_only_used"]'); return !!b && b.checked && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)`));
    check(`[${tag}] Magic Push: Schalter für den Reiter (an) und Empfänger-Auswahl mit "${T.std}" gewählt`, await wait(`const d = r.querySelector("dialog.settings"); const i = d.querySelector('input[data-opt="show_tab_magic"]'); const s = d.querySelector('select[data-opt="notify_service_magic"]'); return !!i && i.checked && !!s && s.value === "" && s.options[0].textContent.includes(${JSON.stringify(T.std)})`));
    check(`[${tag}] Abschnitt "${T.secMagic}" hat eine Zusammenfassung`, (await ev(`return r.querySelector('[data-id="magic"] .set-sec-sum').textContent.trim().length > 0`)));
    await tap('dialog.settings .dlg-actions [data-set="close"]');
    await wait(`return !r.querySelector("dialog.settings").open`);

    // --- Reiter: ohne Routine fehlt "Routinen", "Magic Push" ist da
    await p.evaluate(() => { window.__strictRoutineTab = true; window.__routines = { list: [], seq: 1, runs: [], tests: [] }; });
    await refetch();
    await openDevice();
    const t1 = await tabsOf();
    check(`[${tag}] Gerät ohne Routine und ohne Meldung: weder "Routinen" noch "Magic Push"`, !/magic|routine/.test(t1), t1);
    await closeDevice();
    // eine Routine für das Gerät (auch ausgeschaltet): der Reiter erscheint
    await p.evaluate(() => { window.__routines.list.push({ id: "tabtest", name: "Test", device_id: "d", enabled: false, entity_id: "switch.plug", action: "on", kind: "countdown" }); });
    await refetch();
    await openDevice();
    const t2 = await tabsOf();
    check(`[${tag}] Mit einer (ausgeschalteten) Routine für das Gerät: Reiter "Routinen", noch ohne "Magic Push"`, t2.endsWith("routine") && !t2.includes("magic"), t2);
    await closeDevice();
    // eine Meldung für das Gerät: "Magic Push" erscheint vor "Routinen"
    await p.evaluate(() => { (window.__magic ||= { rules: [], tests: [], seq: 1 }).rules.push({ id: "tabmagic", name: "Test", device_id: "d", enabled: true }); });
    await refetch();
    await openDevice();
    const t2b = await tabsOf();
    check(`[${tag}] Mit einer Meldung für das Gerät: "Magic Push" und "Routinen"`, t2b.endsWith("magic,routine"), t2b);
    await closeDevice();
    // zweite Schalter aus: beide Reiter bei jedem Gerät (hier ohne Routine und Meldung)
    await p.evaluate(() => { window.__routines.list = []; window.__magic.rules = []; window.__opts.tab_routines_only_used = false; window.__opts.tab_magic_only_used = false; });
    await refetch();
    await openDevice();
    const t2c = await tabsOf();
    check(`[${tag}] "Nur bei Geräten, die vorkommen" aus: beide Reiter auch ohne Routine und Meldung`, t2c.endsWith("magic,routine"), t2c);
    await closeDevice();
    await p.evaluate(() => { window.__opts.tab_routines_only_used = true; window.__opts.tab_magic_only_used = true; });

    // --- Schalter aus: Reiter weg; ein Sprung in den ausgeblendeten Reiter landet auf der Übersicht
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="routines"]');
    const subState = (key) => ev(`const i = r.querySelector('dialog.settings input[data-opt="${key}"]'); const o = i?.closest(".opt"); return !!i && o.classList.contains("sub") && o.classList.contains("locked") === i.disabled && i.disabled`);
    check(`[${tag}] Routinen: Unter-Schalter eingerückt (.opt.sub), frei solange der Reiter-Schalter an ist`, await ev(`const i = r.querySelector('dialog.settings input[data-opt="tab_routines_only_used"]'); return !!i && i.closest(".opt").classList.contains("sub") && !i.disabled`));
    await tap('dialog.settings input[data-opt="show_tab_routines"]');
    check(`[${tag}] Routinen: Reiter-Schalter aus → Unter-Schalter ausgegraut`, await subState("tab_routines_only_used"));
    await tap('[data-set="section"][data-id="routines"]');
    await tap('[data-set="section"][data-id="magic"]');
    await tap('dialog.settings input[data-opt="show_tab_magic"]');
    check(`[${tag}] Magic Push: Reiter-Schalter aus → Unter-Schalter ausgegraut`, await subState("tab_magic_only_used"));
    await p.screenshot({ path: `output/tabsetting-sub-${tag.replace("/", "-")}.png` });
    await tap('dialog.settings [data-set="save"]');
    await wait(`return r.querySelector("dialog.settings .set-count.saved")`);
    const saved = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_options").at(-1)?.values);
    check(`[${tag}] Speichern: set_options mit beiden Schaltern aus`, saved && saved.show_tab_routines === false && saved.show_tab_magic === false, JSON.stringify(saved));
    await tap('dialog.settings .dlg-actions [data-set="close"]');
    await wait(`return !r.querySelector("dialog.settings").open`);
    await refetch();
    await openDevice();
    const t3 = await tabsOf();
    check(`[${tag}] Beide Schalter aus: weder "Magic Push" noch "Routinen"`, !/magic|routine/.test(t3), t3);
    await closeDevice();
    await ev(`r.host._openDevice("d", "routine")`);
    check(`[${tag}] Sprung in den ausgeblendeten Reiter "Routinen" landet auf der Übersicht`, await wait(`return r.querySelector("dialog.device")?.open && r.querySelector("dialog.device .sub-tab.on")?.dataset.tab === "ov"`));
    await closeDevice();

    // --- Standard-Empfänger neuer Meldungen: leer = das globale Ziel, sonst vorgewählt
    // der Reiter braucht dafür eine Meldung am Gerät (Standard "nur bei Geräten mit Meldungen") oder den ausgeschalteten zweiten Schalter
    await p.evaluate(() => { window.__opts.show_tab_magic = true; window.__opts.tab_magic_only_used = false; window.__opts.notify_service_magic = ""; });
    await refetch();
    await openDevice();
    await tap('dialog.device [data-tab="magic"]');
    await wait(`return !!r.host._magic.data && r.host._magic.deviceId === "d"`);
    check(`[${tag}] Ohne eigenen Standard: neue Meldung ohne Ziel (folgt dem globalen Ziel)`, (await ev(`return r.host._magic.newDraft().target`)) === "");
    await closeDevice();
    await p.evaluate((t) => { window.__opts.notify_service_magic = t; }, TARGET);
    await openDevice();
    await tap('dialog.device [data-tab="magic"]');
    await wait(`return !!r.host._magic.data && r.host._magic.deviceId === "d" && r.host._magic.data.new_target`);
    check(`[${tag}] Mit eigenem Standard-Empfänger: neue Meldung hat ihn vorgewählt`, (await ev(`return r.host._magic.newDraft().target`)) === TARGET);
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
