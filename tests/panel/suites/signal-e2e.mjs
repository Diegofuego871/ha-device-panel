// Empfang-Warnung pro Gerät (0.21.0, Variante A, docs/mockups/signal-v1):
// globaler Wert / eigene Schwelle "schwach unter" / aus im Geräte-Popup,
// sofort gespeichert; Markierung, Chip "Schwacher Empfang", "Nur Probleme",
// Symbol beim Namen, Chip "Eigene Einstellung", Zurücksetzen in den
// Einstellungen (Abschnitt "Verbindungsart"). dBm und LQI. Deutsch und
// Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: {
    label: "Empfang-Warnung", def: "Globaler Wert (unter -80 dBm)", defLqi: "Globaler Wert (unter LQI 61)", modes: "Globaler Wert (unter -80 dBm)|Eigene Warnschwelle|Aus",
    short: "Heute -84 dBm.", low: "Schwach unter", range: "Erlaubt: -110 bis -40", tipOwn: "Eigene Empfang-Warnschwelle: schwach unter -89 dBm",
    tipOff: "Empfang-Warnung aus (nur dieses Gerät)", title: "Empfang-Warnung auf Geräten", vOff: "Aus", vLqi: "unter LQI 28", sec: "Einstellungen für dieses Gerät",
  },
  en: {
    label: "Weak signal warning", def: "Global value (below -80 dBm)", defLqi: "Global value (below LQI 61)", modes: "Global value (below -80 dBm)|Own warning threshold|Off",
    short: "Now -84 dBm.", low: "Weak below", range: "Allowed: -110 to -40", tipOwn: "Own signal warning threshold: weak below -89 dBm",
    tipOff: "Weak signal warning off (this device only)", title: "Signal warning on devices", vOff: "Off", vLqi: "below LQI 28", sec: "Settings for this device",
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
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const calls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_device_settings").map(({ type, id, ...rest }) => rest));
    const weak = () => ev(`return r.querySelector('.chip.hint[data-hint="signal"] .n')?.textContent || "0"`);
    const open = async (id) => {
      await tap(`.dev[data-open="${id}"]`);
      await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device [data-tab=\"set\"]')`); await tap('dialog.device [data-tab="set"]'); await wait(`return r.querySelector(".dev-set")`);
    };
    const close = async () => { await tap('dialog.device [data-dlg="close"]'); await wait(`return !r.querySelector("dialog.device").open`); };
    const sel = () => ev(`const s=r.querySelector('select[data-dlg="dev-sig"]'); return s ? s.value + "|" + s.options[s.selectedIndex].textContent : ""`);
    const typeVal = async (value) => {
      const inp = await handle('input[data-dlg="dev-sig-val"]');
      await inp.scrollIntoViewIfNeeded();
      if (mobile) await inp.tap(); else await inp.click();
      await inp.fill(value);
      await inp.press("Tab");
    };

    check(`[${tag}] Ausgangslage: 3 mit schwachem Empfang`, (await weak()) === "3");
    // Ohne Empfangswert keine Zeile (Thermostat Bad)
    await open("c");
    check(`[${tag}] ohne Empfang keine Empfang-Warnung`, !(await ev(`return !!r.querySelector('select[data-dlg="dev-sig"]')`)) && (await ev(`return [...r.querySelectorAll("dialog.device h3")].map(h=>h.textContent.trim())`)).includes(T.sec));
    await close();

    // Steckdose Terrasse (-84 dBm, schwach): eigene Schwelle
    await open("d");
    check(`[${tag}] Zeile mit globalem Wert`, (await sel()) === `default|${T.def}` && (await ev(`return [...r.querySelector('select[data-dlg="dev-sig"]').options].map(o=>o.textContent).join("|")`)) === T.modes, await sel());
    check(`[${tag}] Kurzzeile mit heutigem Wert`, (await ev(`return r.querySelector('select[data-dlg="dev-sig"]').closest(".opt").querySelector(".origin").title`)).startsWith(T.short));
    await (await handle('select[data-dlg="dev-sig"]')).selectOption("own");
    check(`[${tag}] Vorschlag 5 dBm unter heute`, await wait(`return r.querySelector('input[data-dlg="dev-sig-val"]')?.value === "-89"`) && JSON.stringify((await calls()).at(-1)) === JSON.stringify({ device_id: "d", signal: -89 }), JSON.stringify((await calls()).at(-1)));
    check(`[${tag}] Feld mit Einheit und Beschriftung`, (await text('.opt-sub:has(input[data-dlg="dev-sig-val"]) .unit')) === "dBm" && (await text('.opt-sub:has(input[data-dlg="dev-sig-val"]) .opt-label')) === T.low);
    check(`[${tag}] nicht mehr schwach: Chip 2`, await wait(`return r.querySelector('.chip.hint[data-hint="signal"] .n')?.textContent === "2"`), await weak());
    await tap('dialog.device [data-tab="ov"]');
    check(`[${tag}] Kachel "Empfang" nicht mehr rot`, await ev(`const t=[...r.querySelectorAll("dialog.device .st-tile, dialog.device .tile")].find(x=>/dBm/.test(x.textContent)); return !!t && !t.querySelector('rect[fill="var(--dp-tier1)"]')`));
    await tap('dialog.device [data-tab="set"]');
    await ev(`r.querySelector(".dev-set").scrollIntoView({ block: "center" })`);
    await p.screenshot({ path: `${outDir}/signal-${tag.replace("/", "-")}.png` });
    // Ausserhalb des Bereichs: nichts gesendet
    const n = (await calls()).length;
    await typeVal("-120");
    check(`[${tag}] -120 abgelehnt`, await wait(`return r.querySelector("dialog.device [data-dev-range]")?.textContent === ${JSON.stringify(T.range)}`) && (await calls()).length === n, await text("dialog.device [data-dev-range]"));
    await typeVal("-82");
    check(`[${tag}] -82 gespeichert: wieder schwach`, await wait(`return !r.querySelector("[data-dev-range]")`) && JSON.stringify((await calls()).at(-1)) === JSON.stringify({ device_id: "d", signal: -82 }) && await wait(`return r.querySelector('.chip.hint[data-hint="signal"] .n')?.textContent === "3"`), JSON.stringify((await calls()).at(-1)));
    await typeVal("-89");
    await wait(`return r.querySelector('.chip.hint[data-hint="signal"] .n')?.textContent === "2"`);
    await close();
    check(`[${tag}] Symbol beim Namen mit Schwelle`, await wait(`return r.querySelector('.dev[data-open="d"] .ovr')?.title === ${JSON.stringify(T.tipOwn)}`), await ev(`return r.querySelector('.dev[data-open="d"] .ovr')?.title || "fehlt"`));

    // Bewegungsmelder Flur (LQI 38): eigene Schwelle in LQI
    await open("b");
    check(`[${tag}] LQI: globaler Wert in LQI`, (await sel()) === `default|${T.defLqi}`, await sel());
    await (await handle('select[data-dlg="dev-sig"]')).selectOption("own");
    check(`[${tag}] LQI: Vorschlag 10 unter heute`, await wait(`return r.querySelector('input[data-dlg="dev-sig-val"]')?.value === "28"`) && (await text('.opt-sub:has(input[data-dlg="dev-sig-val"]) .unit')) === "LQI" && JSON.stringify((await calls()).at(-1)) === JSON.stringify({ device_id: "b", signal: 28 }));
    check(`[${tag}] nur noch 1 schwach`, await wait(`return r.querySelector('.chip.hint[data-hint="signal"] .n')?.textContent === "1"`), await weak());
    await close();
    // Steckdose: aus
    await open("d");
    await (await handle('select[data-dlg="dev-sig"]')).selectOption("off");
    check(`[${tag}] aus gespeichert, Feld weg`, await wait(`return r.querySelector('select[data-dlg="dev-sig"]')?.value === "off" && !r.querySelector('input[data-dlg="dev-sig-val"]')`) && JSON.stringify((await calls()).at(-1)) === JSON.stringify({ device_id: "d", signal: "off" }));
    await close();
    check(`[${tag}] Symbol "aus"`, await wait(`return r.querySelector('.dev[data-open="d"] .ovr')?.title === ${JSON.stringify(T.tipOff)}`));
    // Chip "Eigene Einstellung": beide Geräte
    await tap('.chip.hint[data-hint="override"]');
    const ids = await ev(`return [...r.querySelectorAll(".dev")].map(x=>x.dataset.open).sort().join()`);
    check(`[${tag}] Chip "Eigene Einstellung" zeigt sie`, ids === "b,d", ids);
    await tap('.chip.hint[data-hint="override"]');

    // Einstellungen: zurücksetzen (Abschnitt "Verbindungsart")
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="look"]');
    const rows = await ev(`const o=[...r.querySelectorAll(".ovr-opt")].find(x=>x.querySelector(".opt-label").textContent===${JSON.stringify(T.title)}); return o ? [...o.querySelectorAll(".ovr-row")].map(x=>x.querySelector(".ovr-name").childNodes[0].textContent.trim()+":"+x.querySelector(".ovr-val").textContent.trim()).join("|") : ""`);
    check(`[${tag}] Liste "Empfang-Warnung auf Geräten"`, rows === `Bewegungsmelder Flur:${T.vLqi}|Steckdose Terrasse:${T.vOff}`, rows);
    await tap('[data-set="ovr-all"][data-key="signal"]');
    await tap('dialog.settings [data-set="save"]');
    const reset = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/reset_device_settings").at(-1));
    check(`[${tag}] zurückgesetzt beim Speichern`, await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`) && JSON.stringify(reset?.signal) === JSON.stringify(["b", "d"]), JSON.stringify(reset));
    await tap('dialog.settings .dlg-actions [data-set="close"]');
    check(`[${tag}] wieder 3 schwach, keine Symbole`, await wait(`return r.querySelector('.chip.hint[data-hint="signal"] .n')?.textContent === "3" && !r.querySelector('.dev[data-open="d"] .ovr')`), await weak());

    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
