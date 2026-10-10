// Empfang-Warnschwelle pro Funkart (1.17.0): global im Reiter Verbindungsart
// (Darstellung), pro Integration im Detail (Überwachung und Meldungen ›
// Integrationen), je "Standard / Eigene / Aus". Reihenfolge der Geltung:
// Gerät vor Integration vor global vor festem Standard. Wirkung auf Chip
// "Schwacher Empfang" und Popup, Prüfung des Bereichs, Zurücksetzen.
// Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: {
    title: "Empfang: Warnschwelle pro Funkart", wifi: "WLAN", zigbee: "Zigbee", ble: "Bluetooth", zwave: "Z-Wave",
    defWifi: "Standard (unter -80 dBm)", defZigbee: "Standard (unter LQI 61)", own: "Eigene", off: "Aus",
    infoWifi: "4 Geräte mit Empfangswert in dBm", infoZigbee: "4 Geräte mit Empfangswert in LQI", infoBle: "1 Gerät mit Empfangswert in dBm",
    would: "Standard wäre -80 dBm", range: "Erlaubt: -110 bis -40", rangeLqi: "Erlaubt: 1 bis 200",
    one: "1 Änderung", sum: "Empfang: 1 Funkart angepasst", sum3: "Empfang: 3 Funkarten angepasst", popIntegOff: "Wie Integration (aus)",
    popGlobal: (v) => `Globaler Wert (unter ${v})`, popGlobalOff: "Globaler Wert (aus)", popInteg: (v) => `Wie Integration (unter ${v})`,
    integGlobal: "Globaler Wert (unter -85 dBm)", grp: "Empfang", diff: "Empfang (1 Funkart)", integOrigin: "Integration Shelly",
    secLook: "Darstellung", own2: "Eigene Warnschwelle", wouldInteg: "Standard wäre -85 dBm",
  },
  en: {
    title: "Signal: warning threshold per connection type", wifi: "Wi-Fi", zigbee: "Zigbee", ble: "Bluetooth", zwave: "Z-Wave",
    defWifi: "Default (below -80 dBm)", defZigbee: "Default (below LQI 61)", own: "Own", off: "Off",
    infoWifi: "4 devices with a signal value in dBm", infoZigbee: "4 devices with a signal value in LQI", infoBle: "1 device with a signal value in dBm",
    would: "Default would be -80 dBm", range: "Allowed: -110 to -40", rangeLqi: "Allowed: 1 to 200",
    one: "1 change", sum: "Signal: 1 connection type adjusted", sum3: "Signal: 3 connection types adjusted", popIntegOff: "Like integration (off)",
    popGlobal: (v) => `Global value (below ${v})`, popGlobalOff: "Global value (off)", popInteg: (v) => `Like integration (below ${v})`,
    integGlobal: "Global value (below -85 dBm)", grp: "Signal", diff: "Signal (1 connection type)", integOrigin: "Integration Shelly",
    secLook: "Display", own2: "Own warning threshold", wouldInteg: "Default would be -85 dBm",
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
    const wait = (code, timeout = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout }).then(() => true, () => false);
    const setCalls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_options").map((m) => m.values));
    const weak = () => ev(`return r.querySelector('.chip.hint[data-hint="signal"] .n')?.textContent || "0"`);
    const weakIs = (n) => wait(`return (r.querySelector('.chip.hint[data-hint="signal"] .n')?.textContent || "0") === "${n}"`);
    const sel = (id) => ev(`const s=r.querySelector('select[data-sig-mode="${id}"]'); return s ? s.value + "|" + s.options[s.selectedIndex].textContent : ""`);
    const pick = async (id, value) => { const h = await handle(`select[data-sig-mode="${id}"]`); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); await h.selectOption(value); };
    const typeVal = async (id, value) => {
      const inp = await handle(`input[data-sig="${id}"]`);
      await inp.scrollIntoViewIfNeeded();
      if (mobile) await inp.tap(); else await inp.click();
      await inp.fill(value);
      await inp.press("Tab");
    };
    const save = async () => {
      await tap('dialog.settings [data-set="save"]');
      return wait(`return r.querySelector(".set-count")?.classList.contains("saved")`);
    };
    const row = (id) => ev(`const s=r.querySelector('select[data-sig-mode="${id}"]'); const o=s?.closest(".opt"); return o ? { label: o.querySelector(".opt-label").textContent.trim(), info: o.querySelector(".opt-short").textContent.trim(), origin: o.querySelector(".origin").textContent.trim(), would: o.querySelector(".opt-origin span:nth-child(2)")?.textContent || "", changed: o.classList.contains("changed"), invalid: o.classList.contains("invalid"), err: o.querySelector("[data-sig-error]").hidden ? "" : o.querySelector("[data-sig-error]").textContent, unit: o.querySelector(".unit")?.textContent || "", val: o.querySelector("input")?.value ?? null } : null`);
    const sec = (id) => text(`[data-id="${id}"] .set-sec-sum`);
    const open = async (id) => {
      await tap(`.dev[data-open="${id}"]`);
      await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device [data-tab=\"set\"]')`); await tap('dialog.device [data-tab="set"]'); await wait(`return r.querySelector(".dev-set")`);
    };
    const close = async () => { await tap('dialog.device [data-dlg="close"]'); await wait(`return !r.querySelector("dialog.device").open`); };
    const popSel = () => ev(`const s=r.querySelector('select[data-dlg="dev-sig"]'); return s ? s.value + "|" + s.options[s.selectedIndex].textContent : ""`);
    const popOrigin = () => ev(`return r.querySelector('select[data-dlg="dev-sig"]')?.closest(".opt")?.querySelector(".origin")?.textContent || ""`);
    const overflow = () => ev(`const d=r.querySelector("dialog.settings"); return d.scrollWidth - d.clientWidth`);

    check(`[${tag}] Ausgangslage: 3 mit schwachem Empfang`, (await weak()) === "3");

    // --- Global: Reiter Verbindungsart --------------------------------------
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="look"]');
    await wait(`return !!r.querySelector('select[data-sig-mode="|wifi"]')`);
    check(`[${tag}] Block "${T.title}" im Reiter Verbindungsart`, (await ev(`return [...r.querySelectorAll(".opt-label")].some(x=>x.textContent.trim()===${JSON.stringify(T.title)})`)));
    check(`[${tag}] Zeilen: WLAN, Zigbee, Bluetooth, Z-Wave (nur mit Empfangswert)`, (await ev(`return [...r.querySelectorAll("select[data-sig-mode]")].map(s=>s.dataset.sigMode).join()`)) === "|wifi,|zigbee,|ble,|zwave");
    const w0 = await row("|wifi");
    check(`[${tag}] WLAN: Standard in dBm mit Zahl der Geräte`, w0 && w0.label === T.wifi && (await sel("|wifi")) === `default|${T.defWifi}` && w0.info === T.infoWifi && w0.origin === (lang === "de" ? "Standard" : "Default") && !w0.changed, JSON.stringify(w0));
    const z0 = await row("|zigbee");
    check(`[${tag}] Zigbee: Standard in LQI`, z0 && z0.label === T.zigbee && (await sel("|zigbee")) === `default|${T.defZigbee}` && z0.info === T.infoZigbee, JSON.stringify(z0));
    check(`[${tag}] Bluetooth: ein Gerät`, (await row("|ble")).info === T.infoBle);
    check(`[${tag}] Optionen Standard|Eigene|Aus`, (await ev(`return [...r.querySelector('select[data-sig-mode="|wifi"]').options].map(o=>o.textContent).join("|")`)) === `${T.defWifi}|${T.own}|${T.off}`);
    check(`[${tag}] Abschnitt: noch nichts angepasst`, !(await sec("look")).includes(lang === "de" ? "Empfang" : "Signal"), await sec("look"));

    // WLAN: Eigene, Start mit dem Standard; -120 ungültig; -85 gültig
    await pick("|wifi", "own");
    const w1 = await row("|wifi");
    check(`[${tag}] WLAN Eigene: Feld mit -80 dBm, Zeile geändert, "${T.would}"`, await wait(`return r.querySelector('input[data-sig="|wifi"]')?.value === "-80"`) && w1.unit === "dBm" && (await row("|wifi")).changed && (await row("|wifi")).origin === T.own && (await row("|wifi")).would === T.would, JSON.stringify(await row("|wifi")));
    check(`[${tag}] Zähler und Zusammenfassung`, (await text(".set-count")) === T.one && (await sec("look")).includes(T.sum), `${await text(".set-count")} / ${await sec("look")}`);
    await typeVal("|wifi", "-120");
    const bad = await row("|wifi");
    check(`[${tag}] -120: Fehler "${T.range}", Speichern gesperrt`, bad.invalid && bad.err === T.range && (await ev(`return r.querySelector('[data-set="save"]').disabled`)), JSON.stringify(bad));
    await typeVal("|wifi", "-85");
    check(`[${tag}] -85: Fehler weg, Speichern frei`, await wait(`return !r.querySelector('select[data-sig-mode="|wifi"]').closest(".opt").classList.contains("invalid") && !r.querySelector('[data-set="save"]').disabled`));
    // Zigbee: Zahl in LQI, Bereich 1 bis 200
    await pick("|zigbee", "own");
    check(`[${tag}] Zigbee Eigene: Start mit LQI 61`, await wait(`return r.querySelector('input[data-sig="|zigbee"]')?.value === "61"`) && (await row("|zigbee")).unit === "LQI");
    await typeVal("|zigbee", "250");
    check(`[${tag}] Zigbee 250: Fehler "${T.rangeLqi}"`, (await row("|zigbee")).err === T.rangeLqi && (await ev(`return r.querySelector('[data-set="save"]').disabled`)), JSON.stringify(await row("|zigbee")));
    await typeVal("|zigbee", "30");
    await pick("|ble", "off");
    check(`[${tag}] Bluetooth Aus: kein Feld`, (await sel("|ble")).startsWith("off|") && !(await ev(`return !!r.querySelector('input[data-sig="|ble"]')`)) && (await text(".set-count")) === T.one, await text(".set-count"));
    if (mobile) check(`[${tag}] Handy ohne Überlauf`, (await overflow()) <= 1, String(await overflow()));
    await ev(`r.querySelector('select[data-sig-mode="|wifi"]').closest(".opt").scrollIntoView({ block: "center" })`);
    await p.screenshot({ path: `${outDir}/sigtype-global-${tag.replace("/", "-")}.png` });
    check(`[${tag}] gespeichert (sortierte Zuordnung)`, await save() && JSON.stringify((await setCalls()).at(-1)) === JSON.stringify({ signal_low: { ble: "off", wifi: -85, zigbee: 30 } }), JSON.stringify((await setCalls()).at(-1)));
    check(`[${tag}] Zusammenfassung "${T.sum3}"`, (await sec("look")).includes(T.sum3), await sec("look"));
    check(`[${tag}] Wirkung: nichts mehr schwach (WLAN -85, Zigbee 30, Bluetooth aus)`, await weakIs(0), await weak());
    await tap('dialog.settings .dlg-actions [data-set="close"]');

    // Popup: Wert der Funkart als "Globaler Wert"
    await open("d");
    check(`[${tag}] Popup Steckdose (WLAN): "${T.popGlobal("-85 dBm")}"`, (await popSel()) === `default|${T.popGlobal("-85 dBm")}`, await popSel());
    await close();
    await open("b");
    check(`[${tag}] Popup Zigbee: "${T.popGlobal("LQI 30")}"`, (await popSel()) === `default|${T.popGlobal("LQI 30")}`, await popSel());
    await close();
    await open("a");
    check(`[${tag}] Popup Bluetooth: "${T.popGlobalOff}"`, (await popSel()) === `default|${T.popGlobalOff}`, await popSel());
    await close();

    // --- Pro Integration: Shelly -------------------------------------------
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await tap('[data-set="tab"][data-key="integ"]');
    await wait(`return !!r.querySelector(".ilist")`);
    await tap('[data-set="integ"][data-key="shelly"]');
    await wait(`return !!r.querySelector('[data-imon="shelly"]')`);
    check(`[${tag}] Abschnitt "${T.grp}" mit WLAN (2 Geräte)`, (await ev(`return [...r.querySelectorAll(".mon-grp")].map(x=>x.textContent.trim()).includes(${JSON.stringify(T.grp)})`)) && (await ev(`return [...r.querySelectorAll("select[data-sig-mode]")].map(s=>s.dataset.sigMode).join()`)) === "shelly|wifi", await ev(`return [...r.querySelectorAll("select[data-sig-mode]")].map(s=>s.dataset.sigMode).join()`));
    const s0 = await row("shelly|wifi");
    check(`[${tag}] Zeile: "${T.integGlobal}", Standard, 2 Geräte`, (await sel("shelly|wifi")) === `default|${T.integGlobal}` && s0.info === (lang === "de" ? "2 Geräte mit Empfangswert in dBm" : "2 devices with a signal value in dBm") && s0.label === T.wifi, JSON.stringify(s0));
    // Strenger als global: -80 macht die Steckdose (-84) wieder schwach
    await pick("shelly|wifi", "own");
    check(`[${tag}] Eigene: Start mit dem globalen Wert -85`, await wait(`return r.querySelector('input[data-sig="shelly|wifi"]')?.value === "-85"`) && (await row("shelly|wifi")).would === T.wouldInteg, JSON.stringify(await row("shelly|wifi")));
    await typeVal("shelly|wifi", "-80");
    if (mobile) check(`[${tag}] Handy ohne Überlauf (Integration)`, (await overflow()) <= 1, String(await overflow()));
    await ev(`r.querySelector('select[data-sig-mode="shelly|wifi"]').closest(".opt").scrollIntoView({ block: "center" })`);
    await p.screenshot({ path: `${outDir}/sigtype-integ-${tag.replace("/", "-")}.png` });
    check(`[${tag}] gespeichert`, await save() && JSON.stringify((await setCalls()).at(-1)) === JSON.stringify({ signal_low_integrations: { shelly: { wifi: -80 } } }), JSON.stringify((await setCalls()).at(-1)));
    check(`[${tag}] Wirkung: Steckdose Terrasse (-84) wieder schwach`, await weakIs(1), await weak());
    await tap('[data-set="integ"][data-key=""]');
    await wait(`return !!r.querySelector(".ilist")`);
    check(`[${tag}] Liste: Shelly "${T.diff}", Filter "abweichend"`, (await ev(`return r.querySelector('.ilist-row[data-key="shelly"] .ilist-diff').textContent`)) === T.diff && (await ev(`return r.querySelector('.ilist-row[data-key="shelly"] .ilist-diff').className.includes("own")`)), await ev(`return r.querySelector('.ilist-row[data-key="shelly"] .ilist-diff').textContent`));
    await tap('dialog.settings .dlg-actions [data-set="close"]');

    // Popup: Wert der Integration, Herkunft "Integration Shelly"
    await open("d");
    check(`[${tag}] Popup Steckdose: "${T.popInteg("-80 dBm")}"`, (await popSel()) === `default|${T.popInteg("-80 dBm")}`, await popSel());
    check(`[${tag}] Popup: Herkunft "${T.integOrigin}"`, (await popOrigin()) === T.integOrigin, await popOrigin());
    // Eigene am Gerät geht vor beiden
    await (await handle('select[data-dlg="dev-sig"]')).selectOption("own");
    await wait(`return r.querySelector('input[data-dlg="dev-sig-val"]')?.value === "-89"`);
    check(`[${tag}] eigene am Gerät (-89): nicht mehr schwach`, await weakIs(0), await weak());
    check(`[${tag}] Popup: "Standard wäre -80 dBm" (Wert der Integration)`, (await ev(`return r.querySelector('select[data-dlg="dev-sig"]').closest(".opt").querySelector(".opt-origin span:nth-child(2)").textContent`)) === T.would, await ev(`return r.querySelector('select[data-dlg="dev-sig"]').closest(".opt").querySelector(".opt-origin").textContent`));
    await (await handle('select[data-dlg="dev-sig"]')).selectOption("default");
    await wait(`return r.querySelector('select[data-dlg="dev-sig"]')?.value === "default"`);
    check(`[${tag}] zurück auf Standard: wieder Wert der Integration, schwach`, await weakIs(1) && (await popSel()) === `default|${T.popInteg("-80 dBm")}`, await weak());
    await close();

    // "Alles auf Standard" der Integration nimmt auch die Empfang-Schwellen weg
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await tap('[data-set="tab"][data-key="integ"]');
    await tap('[data-set="integ"][data-key="shelly"]');
    await wait(`return !!r.querySelector('[data-imon="shelly"]')`);
    check(`[${tag}] Zeile zeigt die gespeicherte Eigene (-80)`, (await sel("shelly|wifi")).startsWith("own|") && (await row("shelly|wifi")).val === "-80", JSON.stringify(await row("shelly|wifi")));
    check(`[${tag}] "Alles auf Standard" freigegeben`, !(await ev(`return r.querySelector('[data-set="integ-reset"]').disabled`)));
    await tap('[data-set="integ-reset"][data-key="shelly"]');
    check(`[${tag}] zurück: Standard, Zeile geändert`, await wait(`return r.querySelector('select[data-sig-mode="shelly|wifi"]')?.value === "default"`) && (await row("shelly|wifi")).changed && (await ev(`return r.querySelector('[data-set="integ-reset"]').disabled`)));
    check(`[${tag}] gespeichert: Zuordnung leer`, await save() && JSON.stringify((await setCalls()).at(-1)) === JSON.stringify({ signal_low_integrations: {} }), JSON.stringify((await setCalls()).at(-1)));
    check(`[${tag}] Wirkung: wieder WLAN global (-85), nichts schwach`, await weakIs(0), await weak());
    // Integration "Aus": auch bei einer strengen Funkart nie schwach
    await pick("shelly|wifi", "off");
    await save();
    check(`[${tag}] Integration Aus: gespeichert`, JSON.stringify((await setCalls()).at(-1)) === JSON.stringify({ signal_low_integrations: { shelly: { wifi: "off" } } }), JSON.stringify((await setCalls()).at(-1)));
    await tap('dialog.settings .dlg-actions [data-set="close"]');
    await open("d");
    check(`[${tag}] Popup bei Integration Aus: "${T.popIntegOff}"`, (await popSel()) === `default|${T.popIntegOff}`, await popSel());
    await close();

    // Globale Werte zurücksetzen: Auswahl "Standard" nimmt den Eintrag weg
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="look"]');
    await wait(`return !!r.querySelector('select[data-sig-mode="|wifi"]')`);
    check(`[${tag}] gespeicherte Werte wieder da`, (await sel("|wifi")).startsWith("own|") && (await row("|wifi")).val === "-85" && (await row("|zigbee")).val === "30" && (await sel("|ble")).startsWith("off|"));
    await pick("|wifi", "default");
    await pick("|zigbee", "default");
    await pick("|ble", "default");
    // Der Zähler zählt Optionen, nicht Funkarten: alle drei Schwellen sind eine Änderung.
    check(`[${tag}] alles zurück: eine Änderung`, (await text(".set-count")) === T.one, await text(".set-count"));
    check(`[${tag}] gespeichert: leere Zuordnung`, await save() && JSON.stringify((await setCalls()).at(-1)) === JSON.stringify({ signal_low: {} }), JSON.stringify((await setCalls()).at(-1)));
    await tap('dialog.settings .dlg-actions [data-set="close"]');
    check(`[${tag}] Wirkung: Integration Aus gilt weiter für Shelly, Rest wieder Standard (Bluetooth und Zigbee schwach)`, await weakIs(2), await weak());
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join("|"));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALLE BESTANDEN" : "FEHLER");
process.exit(ok ? 0 : 1);
