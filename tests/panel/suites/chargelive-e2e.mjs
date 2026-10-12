// Live-Aktivität beim Laden (2.19.0): global im Reiter "Laden" (unabhängig von der Lademeldung), pro Integration
// (Einstellungen › Integrationen › Laden) und pro Gerät (Popup, Gruppe "Laden"); Gerät vor Integration vor global.
// Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { grp: "Live-Aktivität", sw: "Live-Aktivität beim Laden", devOpts: ["default|Globaler Wert: aus", "on|Ein", "off|Aus"], intOpts: ["default|Standard (ein)", "on|Ein", "off|Aus"], diffLive: "Live ein", own: "1 eigene", noTarget: "Ohne Ziel kommt kein Push" },
  en: { grp: "Live activity", sw: "Live activity while charging", devOpts: ["default|Global value: off", "on|On", "off|Off"], intOpts: ["default|Default (on)", "on|On", "off|Off"], diffLive: "Live on", own: "1 custom", noTarget: "Without a target no push is sent" },
};
for (const lang of ["de", "en"]) for (const mobile of [false, true]) {
  const T_ = T[lang];
  const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
  const ctx = await b.newContext(mobile ? { viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
  const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
  const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
  const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
  const wait = (c) => f.waitForFunction(new Function(`const r=${R};` + c), null, { timeout: 5000 }).then(() => true, () => false);
  const opts = (sel) => ev(`return [...r.querySelector(${JSON.stringify(sel)}).options].map(o => o.value + "|" + o.textContent.trim())`);
  const devCalls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_device_settings").map(({ type, id, ...rest }) => rest));
  const optCalls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_options").map((m) => m.values));
  const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.innerText || "").replace(/\\s+/g," ").trim()`);

  // --- Geräte-Popup ---
  await tap('.dev[data-open="b"]');
  await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device [data-tab="set"]')`);
  await tap('dialog.device [data-tab="set"]');
  await tap('dialog.device [data-stab="chg"]');
  await wait(`return !!r.querySelector('select[data-dlg="dev-charge-live"]')`);
  check(`[${tag}] Popup: Live-Aktivität: Standard (global aus), Ein, Aus`, JSON.stringify(await opts('select[data-dlg="dev-charge-live"]')) === JSON.stringify(T_.devOpts), JSON.stringify(await opts('select[data-dlg="dev-charge-live"]')));
  check(`[${tag}] Popup: ohne Meldung und Live-Aktivität weder "Voll ab" noch Anstieg`, await ev(`return !r.querySelector('select[data-dlg="dev-charge-full"]') && !r.querySelector('select[data-dlg="dev-charge-rise"]')`));
  await (await handle('select[data-dlg="dev-charge-live"]')).selectOption("on");
  check(`[${tag}] Popup: Ein gesendet (true), "Voll ab" und Anstieg erscheinen (das Ziel), Push bei beendeter Ladung nicht`, (await wait(`return r.host._devices.find((d) => d.id === "b").charge_live_setting === true && !!r.querySelector('select[data-dlg="dev-charge-full"]') && !!r.querySelector('select[data-dlg="dev-charge-rise"]')`)) && JSON.stringify((await devCalls()).at(-1)) === JSON.stringify({ device_id: "b", charge_live: true }) && (await ev(`return !r.querySelector('select[data-dlg="dev-charge-stop"]')`)));
  await ev(`r.querySelector('select[data-dlg="dev-charge-live"]').closest(".opt").scrollIntoView({ block: "start" })`);
  await p.screenshot({ path: `${outDir}/chargelive-popup-${tag.replace("/", "-")}.png` });
  check(`[${tag}] Popup: Reiter zählt die eigene Einstellung (${T_.own})`, (await text('dialog.device [data-tab="set"]')).includes(T_.own), await text('dialog.device [data-tab="set"]'));
  await (await handle('select[data-dlg="dev-charge"]')).selectOption("on");
  check(`[${tag}] Popup: mit Lademeldung kommt der Push bei beendeter Ladung dazu`, await wait(`return !!r.querySelector('select[data-dlg="dev-charge-stop"]')`));
  await (await handle('select[data-dlg="dev-charge-live"]')).selectOption("off");
  check(`[${tag}] Popup: Aus gesendet (false)`, (await wait(`return r.host._devices.find((d) => d.id === "b").charge_live_setting === false`)) && JSON.stringify((await devCalls()).at(-1)) === JSON.stringify({ device_id: "b", charge_live: false }));
  await (await handle('select[data-dlg="dev-charge-live"]')).selectOption("default");
  check(`[${tag}] Popup: zurück auf Standard (null)`, (await wait(`return r.host._devices.find((d) => d.id === "b").charge_live_setting == null`)) && JSON.stringify((await devCalls()).at(-1)) === JSON.stringify({ device_id: "b", charge_live: null }));
  await (await handle('select[data-dlg="dev-charge"]')).selectOption("default");
  await tap('dialog.device [data-dlg="close"]');
  await wait(`return !r.querySelector("dialog.device").open`);

  // --- Reiter "Laden": global, unabhängig von der Lademeldung ---
  await tap(".gear-btn");
  await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
  await tap('[data-set="section"][data-id="monitor"]');
  await tap('.mon-tab[data-key="charge"]');
  await wait(`return !!r.querySelector('input[data-opt="notify_charge"]')`);
  check(`[${tag}] Laden: Gruppe "${T_.grp}" mit Schalter "${T_.sw}", aus, auch bei ausgeschalteter Lademeldung`, await ev(`return [...r.querySelectorAll(".mon-grp")].some((g) => g.textContent.trim() === ${JSON.stringify(T_.grp)}) && r.querySelector('input[data-opt="charge_live"]') && !r.querySelector('input[data-opt="charge_live"]').checked && !r.querySelector('input[data-opt="notify_charge"]').checked`));
  await tap('input[data-opt="charge_live"]');
  await ev(`r.querySelector('input[data-opt="charge_live"]').closest(".opt").scrollIntoView({ block: "center" })`);
  await p.screenshot({ path: `${outDir}/chargelive-tab-${tag.replace("/", "-")}.png` });
  check(`[${tag}] Laden: eingeschaltet, ohne Ziel der Hinweis`, (await wait(`return r.host._settings.draft.charge_live === true`)) && (await text(".mon-body")).includes(T_.noTarget));
  check(`[${tag}] Laden: der Reiter trägt den Punkt für geändert`, await wait(`return r.querySelector('.mon-tab[data-key="charge"]').classList.contains("chg")`));

  // --- Einstellungen pro Integration ---
  await tap('.mon-tab[data-key="integ"]');
  await wait(`return !!r.querySelector('.ilist-row[data-key="matter"]')`);
  await tap('.ilist-row[data-key="matter"]');
  await tap('[data-set="isub"][data-key="chg"]');
  await wait(`return !!r.querySelector('select[data-clive-integ="matter"]')`);
  check(`[${tag}] Integration: Live-Aktivität: Standard (global ein), Ein, Aus`, JSON.stringify(await opts('select[data-clive-integ="matter"]')) === JSON.stringify(T_.intOpts), JSON.stringify(await opts('select[data-clive-integ="matter"]')));
  check(`[${tag}] Integration: ohne Lademeldung der Integration, aber mit eingeschalteter Live-Aktivität (global): Ladeziel und Anstieg, kein Push bei beendeter Ladung`, await ev(`return !!r.querySelector('select[data-cfull-integ="matter"]') && !r.querySelector('select[data-cstop-integ="matter"]')`));
  await (await handle('select[data-clive-integ="matter"]')).selectOption("off");
  await ev(`r.querySelector('select[data-clive-integ="matter"]').closest(".opt").scrollIntoView({ block: "center" })`);
  await p.screenshot({ path: `${outDir}/chargelive-integ-${tag.replace("/", "-")}.png` });
  check(`[${tag}] Integration: Aus: Entwurf {"matter": false}, die Zeilen für das Ziel verschwinden`, (await ev(`return JSON.stringify(r.host._settings.draft.charge_live_integrations)`)) === '{"matter":false}' && (await wait(`return !r.querySelector('select[data-cfull-integ="matter"]')`)));
  await (await handle('select[data-clive-integ="matter"]')).selectOption("on");
  check(`[${tag}] Integration: Ein: Entwurf {"matter": true}`, (await ev(`return JSON.stringify(r.host._settings.draft.charge_live_integrations)`)) === '{"matter":true}');
  await tap('.iback');
  await wait(`return !!r.querySelector('.ilist-row[data-key="matter"]')`);
  const diff = await text('.ilist-row[data-key="matter"] .ilist-diff');
  check(`[${tag}] Liste der Integrationen nennt "${T_.diffLive}"`, diff.includes(T_.diffLive), diff);
  await tap('.ilist-row[data-key="matter"]');
  await tap('[data-set="isub"][data-key="chg"]');
  await wait(`return !!r.querySelector('select[data-clive-integ="matter"]')`);
  await tap('[data-set="integ-reset"]');
  check(`[${tag}] Zurücksetzen: die Wahl der Integration ist weg`, await wait(`return JSON.stringify(r.host._settings.draft.charge_live_integrations) === "{}"`));
  await (await handle('select[data-clive-integ="matter"]')).selectOption("on");

  // --- Speichern ---
  await tap('dialog.settings [data-set="save"]');
  check(`[${tag}] gespeichert: global ein, Integration "matter" ein`, (await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`)) && (await optCalls()).some((v) => v.charge_live === true && JSON.stringify(v.charge_live_integrations) === '{"matter":true}'), JSON.stringify((await optCalls()).at(-1)));
  check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
