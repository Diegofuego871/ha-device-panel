// "Ladung beendet nach" und Push bei beendeter Ladung (1.41.0): Übersteuerung pro Gerät (Popup) und pro Integration
// (Einstellungen), Gerät vor Integration vor global. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { stall: ["default|Globaler Wert (15 Min.)", "own|Eigene Zeit"], stop: ["default|Globaler Wert: aus", "on|Ein", "off|Aus"], range: "Erlaubt: 5 bis 120", diff: "beendet nach 30 Min.", diffStop: "Push bei Ende ein", intStall: "default|Standard (15 Min.)", intStop: "default|Standard (aus)" },
  en: { stall: ["default|Global value (15 min)", "own|Own time"], stop: ["default|Global value: off", "on|On", "off|Off"], range: "Allowed: 5 to 120", diff: "stopped after 30 min", diffStop: "push at end on", intStall: "default|Default (15 min)", intStop: "default|Default (off)" },
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
  const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.innerText || "").replace(/\\s+/g," ").trim()`);

  // --- Geräte-Popup ---
  await tap('.dev[data-open="b"]');
  await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device [data-tab="set"]')`);
  await tap('dialog.device [data-tab="set"]');
  await wait(`return !!r.querySelector('select[data-dlg="dev-charge"]')`);
  await (await handle('select[data-dlg="dev-charge"]')).selectOption("on");
  await wait(`return !!r.querySelector('select[data-dlg="dev-charge-stall"]')`);
  check(`[${tag}] Popup: "Ladung beendet nach": Standard und Eigene Zeit`, JSON.stringify(await opts('select[data-dlg="dev-charge-stall"]')) === JSON.stringify(T_.stall), JSON.stringify(await opts('select[data-dlg="dev-charge-stall"]')));
  check(`[${tag}] Popup: Push bei beendeter Ladung: Standard, Ein, Aus`, JSON.stringify(await opts('select[data-dlg="dev-charge-stop"]')) === JSON.stringify(T_.stop), JSON.stringify(await opts('select[data-dlg="dev-charge-stop"]')));
  await (await handle('select[data-dlg="dev-charge-stall"]')).selectOption("own");
  check(`[${tag}] Popup: "Eigene Zeit" beginnt bei 15 Min., Zahlenfeld`, (await wait(`return r.querySelector('input[data-dlg="dev-charge-stall-val"]')?.value === "15" && r.host._devices.find((d) => d.id === "b").charge_stall_setting === 15`)));
  await (await handle('input[data-dlg="dev-charge-stall-val"]')).fill("3");
  await p.keyboard.press("Tab");
  const n0 = (await devCalls()).length;
  check(`[${tag}] Popup: 3 abgelehnt, nichts gesendet`, (await wait(`return (r.querySelector("dialog.device [data-dev-range]")?.textContent || "") === ${JSON.stringify(T_.range)}`)) && (await devCalls()).length === n0);
  await (await handle('input[data-dlg="dev-charge-stall-val"]')).fill("25");
  await p.keyboard.press("Tab");
  check(`[${tag}] Popup: 25 gesendet und gespeichert`, (await wait(`return r.host._devices.find((d) => d.id === "b").charge_stall_setting === 25`)) && JSON.stringify((await devCalls()).at(-1)) === JSON.stringify({ device_id: "b", charge_stall: 25 }), JSON.stringify((await devCalls()).at(-1)));
  await (await handle('select[data-dlg="dev-charge-stop"]')).selectOption("on");
  check(`[${tag}] Popup: Push Ein gesendet (true)`, (await wait(`return r.host._devices.find((d) => d.id === "b").charge_stop_setting === true`)) && JSON.stringify((await devCalls()).at(-1)) === JSON.stringify({ device_id: "b", charge_stop: true }));
  await (await handle('select[data-dlg="dev-charge-stop"]')).selectOption("off");
  check(`[${tag}] Popup: Push Aus gesendet (false)`, (await wait(`return r.host._devices.find((d) => d.id === "b").charge_stop_setting === false`)) && JSON.stringify((await devCalls()).at(-1)) === JSON.stringify({ device_id: "b", charge_stop: false }));
  check(`[${tag}] Popup: Reiter zählt die eigenen Einstellungen (Lademeldung, Zeit, Push = 3)`, (await text('dialog.device [data-tab="set"]')).includes(lang === "de" ? "3 eigene" : "3 custom"), await text('dialog.device [data-tab="set"]'));
  await (await handle('select[data-dlg="dev-charge-stall"]')).selectOption("default");
  await (await handle('select[data-dlg="dev-charge-stop"]')).selectOption("default");
  check(`[${tag}] Popup: zurück auf Standard (null)`, (await wait(`const d=r.host._devices.find((x) => x.id === "b"); return d.charge_stall_setting == null && d.charge_stop_setting == null && !r.querySelector('input[data-dlg="dev-charge-stall-val"]')`)) && JSON.stringify((await devCalls()).slice(-2)) === JSON.stringify([{ device_id: "b", charge_stall: null }, { device_id: "b", charge_stop: null }]), JSON.stringify((await devCalls()).slice(-2)));
  await tap('dialog.device [data-dlg="close"]');
  await wait(`return !r.querySelector("dialog.device").open`);

  // --- Einstellungen pro Integration ---
  await tap(".gear-btn");
  await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
  await tap('[data-set="section"][data-id="monitor"]');
  await tap('.mon-tab[data-key="battery"]');
  await tap('.sub-tab[data-key="bat_charge"]');
  await wait(`return !!r.querySelector('input[data-opt="notify_charge"]')`);
  await tap('input[data-opt="notify_charge"]');
  await tap('.mon-tab[data-key="integ"]');
  await wait(`return !!r.querySelector('.ilist-row[data-key="matter"]')`);
  await tap('.ilist-row[data-key="matter"]');
  await wait(`return !!r.querySelector('input[data-cinteg="matter"]')`);
  await tap('input[data-cinteg="matter"]');
  await wait(`return !!r.querySelector('select[data-cstall-integ="matter"]')`);
  check(`[${tag}] Integration: "Ladung beendet nach" und Push mit Standard`, (await ev(`return r.querySelector('select[data-cstall-integ="matter"]').options[0].value + "|" + r.querySelector('select[data-cstall-integ="matter"]').options[0].textContent.trim()`)) === T_.intStall && (await ev(`return r.querySelector('select[data-cstop-integ="matter"]').options[0].value + "|" + r.querySelector('select[data-cstop-integ="matter"]').options[0].textContent.trim()`)) === T_.intStop);
  await (await handle('select[data-cstall-integ="matter"]')).selectOption("30");
  await (await handle('select[data-cstop-integ="matter"]')).selectOption("on");
  check(`[${tag}] Integration: Entwurf 30 Min. und Push ein`, await ev(`const d=r.host._settings.draft; return JSON.stringify(d.charge_stall_integrations) === '{"matter":30}' && JSON.stringify(d.charge_stop_integrations) === '{"matter":true}'`));
  await tap('.iback');
  await wait(`return !!r.querySelector('.ilist-row[data-key="matter"]')`);
  const diff = await text('.ilist-row[data-key="matter"] .ilist-diff');
  check(`[${tag}] Liste der Integrationen nennt beide Werte`, diff.includes(T_.diff) && diff.includes(T_.diffStop), diff);
  await tap('.ilist-row[data-key="matter"]');
  await wait(`return !!r.querySelector('select[data-cstall-integ="matter"]')`);
  await tap('[data-set="integ-reset"]');
  check(`[${tag}] Zurücksetzen: beide Werte weg`, await wait(`const d=r.host._settings.draft; return JSON.stringify(d.charge_stall_integrations) === "{}" && JSON.stringify(d.charge_stop_integrations) === "{}"`));
  check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
