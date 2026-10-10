// Lademeldung (1.30.0, docs/mockups/charging-v1): im Reiter "Batterie" der Abschnitt "Laden" mit
// Schalter (aus, sonst nichts), "Voll ab" (Standard 100 %), Anstieg (Standard 20), Liste der
// Integrationen mit Schaltern und Vorschau; im Geräte-Popup die Zeile "Laden melden"
// (Standard = Integration, Ein, Aus). Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { grp: "Laden", subWarn: "Warnung", diff: "Abweichungen von \"Schwach ab\"", title: "Geladen: ", from: "in 1 Std. 40 Min. von 22 %", row: "Laden melden", def: "Wie Integration: aus", on: "Ein", off: "Aus", none: "Ohne Ziel kommt kein Push", one: "1 Änderung" },
  en: { grp: "Charging", subWarn: "Warning", diff: "Exceptions to \"Low from\"", title: "Charged: ", from: "in 1 h 40 min from 22 %", row: "Report charging", def: "Same as integration: off", on: "On", off: "Off", none: "Without a target no push", one: "1 change" },
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
  const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.innerText || "").replace(/\\s+/g," ").trim()`);
  const optCalls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_options").map((m) => m.values));
  const devCalls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_device_settings").map(({ type, id, ...rest }) => rest));

  await tap(".gear-btn");
  await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
  await tap('[data-set="section"][data-id="monitor"]');
  await tap('.mon-tab[data-key="battery"]');
  // Unterreiter "Warnung | Laden" (1.31.1, docs/mockups/battery-layout-v1, C): zuerst die Warnung mit ihren Abweichungen
  await wait(`return !!r.querySelector('.sub-tab[data-key="bat_warn"]')`);
  const subs = await ev(`return [...r.querySelectorAll('.sub-tab[data-group="battery"]')].map(b => b.textContent.trim() + (b.classList.contains("on") ? "*" : ""))`);
  check(`[${tag}] Unterreiter "${T_.subWarn}*" und "${T_.grp}"`, JSON.stringify(subs) === JSON.stringify([T_.subWarn + "*", T_.grp]), JSON.stringify(subs));
  check(`[${tag}] Warnung: Abweichungen mit Bezug "${T_.diff}", ohne Laden`, await ev(`return [...r.querySelectorAll(".mon-grp")].some(g => g.textContent.trim() === ${JSON.stringify(T_.diff)}) && !r.querySelector('input[data-opt="notify_charge"]')`));
  await tap('.sub-tab[data-key="bat_charge"]');
  await wait(`return !!r.querySelector('input[data-opt="notify_charge"]')`);
  check(`[${tag}] Laden: ohne Abweichungen und Warnschwelle`, await ev(`return ![...r.querySelectorAll(".mon-grp")].some(g => g.textContent.trim() === ${JSON.stringify(T_.diff)}) && !r.querySelector('.mtl')`));
  check(`[${tag}] Lademeldung: Schalter aus, sonst nichts`, !(await ev(`return r.querySelector('input[data-opt="notify_charge"]').checked`)) && !(await ev(`return !!r.querySelector("select[data-cfull], input[data-opt='charge_rise'], input[data-cinteg]")`)));
  await tap('input[data-opt="notify_charge"]');
  await wait(`return !!r.querySelector('select[data-cfull]')`);
  const base = await ev(`return [r.querySelector("select[data-cfull]").value, r.querySelector('input[data-opt="charge_rise"]').value, r.querySelectorAll("input[data-cinteg]").length, [...r.querySelectorAll("input[data-cinteg]")].some(i=>i.checked)]`);
  check(`[${tag}] Standard: voll ab 100, Anstieg 20, Integrationen alle aus`, base[0] === "100" && base[1] === "20" && base[2] >= 3 && base[3] === false, JSON.stringify(base));
  check(`[${tag}] Vorschau`, (await text(".pv-title")).includes(T_.title) && (await ev(`return [...r.querySelectorAll(".pv-text")].some(e=>e.innerText.includes("100 %") && e.innerText.includes(${JSON.stringify(T_.from)}))`)), await ev(`return [...r.querySelectorAll(".pv-text")].map(e=>e.innerText).join(" | ")`));
  check(`[${tag}] ohne Ziel: Hinweis`, (await ev(`return [...r.querySelectorAll(".opt-warn")].some(e=>e.innerText.includes(${JSON.stringify(T_.none)}))`)));
  // Suchfeld erst ab 8 Einträgen: in den Testdaten weniger
  check(`[${tag}] wenige Integrationen: kein Suchfeld`, await ev(`return !r.querySelector('input[data-lsearch="charge"]')`));

  // Voll ab 95, Anstieg 30, zha einschalten
  await (await handle("select[data-cfull]")).selectOption("95");
  await (await handle('input[data-opt="charge_rise"]')).fill("30");
  await tap('input[data-cinteg="zha"]');
  check(`[${tag}] Vorschau folgt "Voll ab"`, await ev(`return [...r.querySelectorAll(".pv-text")].some(e=>e.innerText.startsWith("95 %"))`));
  await (await handle('input[data-opt="charge_rise"]')).fill("2");
  check(`[${tag}] Anstieg 2: Fehler, Speichern gesperrt`, await wait(`return r.querySelector('[data-set="save"]').disabled`));
  await (await handle('input[data-opt="charge_rise"]')).fill("30");
  await p.screenshot({ path: `${outDir}/charge-${tag.replace("/", "-")}.png` });
  await tap('dialog.settings [data-set="save"]');
  await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`);
  const last = (await optCalls()).at(-1) || {};
  check(`[${tag}] gespeichert`, last.notify_charge === true && last.charge_full === 95 && last.charge_rise === 30 && JSON.stringify(last.charge_integrations) === JSON.stringify(["zha"]), JSON.stringify(last));
  await tap('dialog.settings [data-set="close"]').catch(() => {});
  await ev(`const d=r.querySelector("dialog.settings"); if (d?.open) d.close(); return 1`);

  // Popup: Thermostat Bad (Matter, 22 %), ZHA-Gerät Bewegungsmelder (Integration ein)
  await tap('.dev[data-open="c"]');
  await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('select[data-dlg="dev-charge"]')`);
  check(`[${tag}] Popup "${T_.row}": Standard "${T_.def}"`, (await ev(`const s=r.querySelector('select[data-dlg="dev-charge"]'); return s.value + "|" + s.options[s.selectedIndex].textContent`)) === `default|${T_.def}`);
  await (await handle('select[data-dlg="dev-charge"]')).selectOption("on");
  await wait(`return r.querySelector('select[data-dlg="dev-charge"]')?.value === "on"`);
  check(`[${tag}] Ein gesendet`, JSON.stringify((await devCalls()).at(-1)) === JSON.stringify({ device_id: "c", charge: true }), JSON.stringify((await devCalls()).at(-1)));
  await (await handle('select[data-dlg="dev-charge"]')).selectOption("off");
  await wait(`return r.querySelector('select[data-dlg="dev-charge"]')?.value === "off"`);
  check(`[${tag}] Aus gesendet`, JSON.stringify((await devCalls()).at(-1)) === JSON.stringify({ device_id: "c", charge: false }));
  await (await handle('select[data-dlg="dev-charge"]')).selectOption("default");
  await wait(`return r.querySelector('select[data-dlg="dev-charge"]')?.value === "default"`);
  check(`[${tag}] zurück auf Integration (null)`, JSON.stringify((await devCalls()).at(-1)) === JSON.stringify({ device_id: "c", charge: null }));
  await tap('dialog.device [data-dlg="close"]');
  await wait(`return !r.querySelector("dialog.device").open`);
  // Gerät ohne Batterie: keine Zeile
  const noBat = await ev(`const e=[...r.querySelectorAll(".dev")].find(x=>!x.querySelector(".bat, [data-bat-level]")); return e ? e.dataset.open : null`);
  if (noBat) {
    const hasLevel = await p.evaluate((id) => window.__devices.find((d) => d.id === id)?.battery?.level != null, noBat).catch(() => null);
    if (hasLevel === false) {
      await tap(`.dev[data-open="${noBat}"]`);
      await wait(`return r.querySelector("dialog.device")?.open`);
      check(`[${tag}] Gerät ohne Batterie: keine Zeile "${T_.row}"`, await ev(`return !r.querySelector('select[data-dlg="dev-charge"]')`));
      await tap('dialog.device [data-dlg="close"]');
    }
  }
  check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
  check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
