// "Voll ab" (1.38.0): Stufen 100, 95, 90, 80 und "Eigener Wert" (Zahl, 50 bis 100) im Geräte-Popup, global (Batterie › Laden)
// und pro Integration. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = { de: { own: "Eigener Wert", range: "Erlaubt: 50 bis 100" }, en: { own: "Own value", range: "Allowed: 50 to 100" } };
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

  // Global: Einstellungen › Batterie › Laden
  await tap(".gear-btn");
  await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
  await tap('[data-set="section"][data-id="monitor"]');
  await tap('.mon-tab[data-key="battery"]');
  await tap('.sub-tab[data-key="bat_charge"]');
  await wait(`return !!r.querySelector('select[data-cfull]')`);
  check(`[${tag}] global: Stufen 100, 95, 90, 80 und "${T_.own}"`, JSON.stringify(await opts("select[data-cfull]")) === JSON.stringify(["100|100 %", "95|95 %", "90|90 %", "80|80 %", `own|${T_.own}`]), JSON.stringify(await opts("select[data-cfull]")));
  check(`[${tag}] global: ohne eigenen Wert kein Zahlenfeld`, !(await ev(`return !!r.querySelector('input[data-opt="charge_full"]')`)));
  await (await handle("select[data-cfull]")).selectOption("own");
  check(`[${tag}] global: "${T_.own}" zeigt ein Zahlenfeld mit 85`, (await wait(`return r.querySelector('input[data-opt="charge_full"]')?.value === "85"`)) && (await ev(`return r.querySelector("select[data-cfull]").value`)) === "own");
  await (await handle('input[data-opt="charge_full"]')).fill("70");
  await ev(`r.querySelector('input[data-opt="charge_full"]').dispatchEvent(new Event("change", { bubbles: true }))`);
  check(`[${tag}] global: 70 im Entwurf`, await wait(`return r.host._settings.draft.charge_full === 70`));
  await (await handle('input[data-opt="charge_full"]')).fill("40");
  await ev(`r.querySelector('input[data-opt="charge_full"]').dispatchEvent(new Event("input", { bubbles: true }))`);
  check(`[${tag}] global: 40 abgelehnt (${T_.range})`, await wait(`return (r.querySelector('[data-tl-error*="charge_full"]')?.textContent || "").includes(${JSON.stringify(T_.range)})`), await ev(`return r.querySelector('[data-tl-error*="charge_full"]')?.textContent`));
  await (await handle("select[data-cfull]")).selectOption("80");
  check(`[${tag}] global: Stufe 80, Zahlenfeld weg`, (await wait(`return r.host._settings.draft.charge_full === 80 && !r.querySelector('input[data-opt="charge_full"]')`)));
  await ev(`r.host._closeSettings?.(); const d=r.querySelector("dialog.settings"); if (d.open) d.close();`);

  // Geräte-Popup: Lademeldung "Ein", dann "Voll ab"
  await tap('.dev[data-open="b"]');
  await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device [data-tab="set"]')`);
  await tap('dialog.device [data-tab="set"]');
  await wait(`return !!r.querySelector('select[data-dlg="dev-charge"]')`);
  await (await handle('select[data-dlg="dev-charge"]')).selectOption("on");
  await wait(`return !!r.querySelector('select[data-dlg="dev-charge-full"]')`);
  const o = await opts('select[data-dlg="dev-charge-full"]');
  check(`[${tag}] Popup: Standard, 100, 95, 90, 80, "${T_.own}"`, o.length === 6 && o[0].startsWith("default|") && JSON.stringify(o.slice(1)) === JSON.stringify(["100|100 %", "95|95 %", "90|90 %", "80|80 %", `own|${T_.own}`]), JSON.stringify(o));
  await (await handle('select[data-dlg="dev-charge-full"]')).selectOption("80");
  check(`[${tag}] Popup: Stufe 80 gespeichert`, (await wait(`return r.host._devices.find((d) => d.id === "b").charge_full_setting === 80`)) && !(await ev(`return !!r.querySelector('input[data-dlg="dev-charge-full-val"]')`)));
  await (await handle('select[data-dlg="dev-charge-full"]')).selectOption("own");
  check(`[${tag}] Popup: "${T_.own}" gespeichert (85) und Zahlenfeld`, (await wait(`return r.host._devices.find((d) => d.id === "b").charge_full_setting === 85 && r.querySelector('input[data-dlg="dev-charge-full-val"]')?.value === "85"`)) && (await ev(`return r.querySelector('select[data-dlg="dev-charge-full"]').value`)) === "own");
  await (await handle('input[data-dlg="dev-charge-full-val"]')).fill("40");
  await p.keyboard.press("Tab");
  const n0 = (await devCalls()).length;
  check(`[${tag}] Popup: 40 abgelehnt, nichts gesendet`, (await wait(`return (r.querySelector("dialog.device [data-dev-range]")?.textContent || "") === ${JSON.stringify(T_.range)}`)) && (await devCalls()).length === n0);
  await (await handle('input[data-dlg="dev-charge-full-val"]')).fill("72");
  await p.keyboard.press("Tab");
  check(`[${tag}] Popup: 72 gespeichert`, (await wait(`return r.host._devices.find((d) => d.id === "b").charge_full_setting === 72`)) && JSON.stringify((await devCalls()).at(-1)) === JSON.stringify({ device_id: "b", charge_full: 72 }), JSON.stringify((await devCalls()).at(-1)));
  check(`[${tag}] Popup: 72 zeigt "${T_.own}"`, (await ev(`return r.querySelector('select[data-dlg="dev-charge-full"]').value`)) === "own");
  await (await handle('select[data-dlg="dev-charge-full"]')).selectOption("default");
  check(`[${tag}] Popup: zurück auf Standard`, await wait(`return r.host._devices.find((d) => d.id === "b").charge_full_setting == null && !r.querySelector('input[data-dlg="dev-charge-full-val"]')`));
  await tap('dialog.device [data-dlg="close"]');
  check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
