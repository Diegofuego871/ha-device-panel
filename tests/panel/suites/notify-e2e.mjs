// Ausfall-Meldungen nach Bild 5 (0.20.0): Spalten "Push" und "Anhaltend"
// pro Integration, "Erst melden nach", Inhalt der Meldung mit Vorschau,
// Abschnitt "Anhaltende Benachrichtigung", Stumm im Geräte-Popup.
// Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

const TEXT = {
  de: {
    persOff: "Aus", persOn: (n) => `Bei Ausfällen · ${n} Integrationen`, int: "9 Integrationen · alle angezeigt", intPush: (n) => `9 Integrationen · alle angezeigt · Push für ${n}`,
    fields: "Bereich|Integration|Verbindungsart|Offline seit|Empfang zuletzt|Batterie|Hersteller / Modell", title: "Ausgefallen: Temperatur Keller",
    since: /^seit \d\d:\d\d$/, battery: "Batterie 0 %", actions: "Öffnen|24 Std. stumm", invented: "-72 dBm|64 %", exampleNote: "Kursiv: Beispielwert", range: "Erlaubt: 0 bis 60", outage5: "Sobald ein Gerät 5 Min. ausgefallen ist (siehe \"Erst melden nach\").", muted: /^Stumm bis /, notifyOn: "Globale Einstellung",
  },
  en: {
    persOff: "Off", persOn: (n) => `For outages · ${n} integrations`, int: "9 integrations · all shown", intPush: (n) => `9 integrations · all shown · push for ${n}`,
    fields: "Area|Integration|Connection type|Offline since|Last signal|Battery|Manufacturer / model", title: "Offline: Temperatur Keller",
    since: /^since \d\d:\d\d( [AP]M)?$/, battery: "battery 0 %", actions: "Open|Mute 24 h", invented: "-72 dBm|64 %", exampleNote: "Italic: example value", range: "Allowed: 0 to 60", outage5: "As soon as a device has been offline for 5 min (see \"Report only after\").", muted: /^Muted until /, notifyOn: "Global setting",
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
    const calls = (type) => p.evaluate((t) => window.__wsCalls.filter((m) => m.type === t), type);
    const pick = async (sel, value) => { const h = await handle(sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); await h.selectOption(value); };
    const sum = (id) => text(`[data-id="${id}"] .set-sec-sum`);
    const pvText = () => text(".pv-text");
    const sw = (list, dom) => `input[data-list="${list}"][data-value="${dom}"]`;

    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    check(`[${tag}] Abschnitt "Anhaltende Benachrichtigung": aus`, (await sum("persistent")) === T.persOff, await sum("persistent"));
    check(`[${tag}] Integrationen ohne Push-Ziel: kein "Push für"`, (await sum("integrations")) === T.int, await sum("integrations"));

    // Integrationen: drei Spalten; ausgeblendet sperrt Push und Anhaltend
    await tap('[data-set="section"][data-id="integrations"]');
    check(`[${tag}] Push und Anhaltend standardmässig an`, await ev(`return [...r.querySelectorAll('input[data-list="notify_exclude_integrations"], input[data-list="persistent_exclude_integrations"]')].every(i=>i.checked && !i.disabled)`));
    await tap(sw("exclude_integrations", "zha"));
    check(`[${tag}] ausgeblendet: Push und Anhaltend gesperrt`, await wait(`return r.querySelector('${sw("notify_exclude_integrations", "zha")}').disabled && r.querySelector('${sw("persistent_exclude_integrations", "zha")}').disabled`));
    await tap(sw("exclude_integrations", "zha"));
    check(`[${tag}] wieder angezeigt: frei`, await wait(`return !r.querySelector('${sw("notify_exclude_integrations", "zha")}').disabled`) && (await text(".set-count")) === "");
    await tap('input[data-list-all="notify_exclude_integrations"]');
    check(`[${tag}] "Alle umschalten" der Spalte Push`, await wait(`return [...r.querySelectorAll('input[data-list="notify_exclude_integrations"]')].every(i=>!i.checked)`) && await ev(`return [...r.querySelectorAll('input[data-list="exclude_integrations"]')].every(i=>i.checked)`));
    await tap('input[data-list-all="notify_exclude_integrations"]');
    await wait(`return [...r.querySelectorAll('input[data-list="notify_exclude_integrations"]')].every(i=>i.checked)`);
    await tap(sw("notify_exclude_integrations", "bthome"));
    await tap(sw("persistent_exclude_integrations", "zha"));
    check(`[${tag}] Push BTHome aus, Anhaltend ZHA aus`, await wait(`return !r.querySelector('${sw("notify_exclude_integrations", "bthome")}').checked && !r.querySelector('${sw("persistent_exclude_integrations", "zha")}').checked`) && (await text(".set-count")).startsWith("2"));
    await p.screenshot({ path: `${outDir}/notify-integrations-${tag.replace("/", "-")}.png` });

    // Push: Ziel und Ausfall, dann "Push für 8"
    await tap('[data-set="section"][data-id="push"]');
    check(`[${tag}] Inhalt: 7 Schalter in fester Reihenfolge`, (await ev(`return [...r.querySelectorAll(".nf-item > span:first-child")].map(s=>s.textContent).join("|")`)) === T.fields);
    check(`[${tag}] Standard: Bereich, Integration, Offline seit`, (await ev(`return [...r.querySelectorAll("input[data-nfield]:checked")].map(i=>i.dataset.nfield).join()`)) === "area,integration,since");
    check(`[${tag}] Vorschau erst mit "Bei Ausfall"`, !(await ev(`return !!r.querySelector(".pv")`)));
    await pick('select[data-opt="notify_service"]', "notify.mobile_app_testhandy");
    await tap('.switch input[data-opt="notify_outage"]');
    check(`[${tag}] Vorschau mit ausgefallenem Gerät`, await wait(`return !!r.querySelector(".pv-card")`) && (await text(".pv-title")) === T.title && (await ev(`return [...r.querySelectorAll(".pv-actions span")].map(s=>s.textContent).join("|")`)) === T.actions, await text(".pv-title"));
    const parts = (await pvText()).split(" · ");
    check(`[${tag}] Vorschau: Bereich · Integration · seit`, parts.length === 3 && parts[0] === "Keller" && parts[1] === "BTHome" && T.since.test(parts[2]), await pvText());
    check(`[${tag}] Integrationen: Push für 8`, (await sum("integrations")) === T.intPush(8), await sum("integrations"));
    // Reihenfolge fest, nicht nach Antippen
    await tap('input[data-nfield="battery"]');
    await tap('input[data-nfield="area"]');
    const parts2 = (await pvText()).split(" · ");
    check(`[${tag}] Vorschau folgt dem Inhalt`, parts2.length === 3 && parts2[0] === "BTHome" && T.since.test(parts2[1]) && parts2[2] === T.battery, await pvText());
    // Hat das Beispielgerät keine Batterie und keinen Empfang: Beispielwerte in Kursiv, mit Hinweis
    // (seit 0.29.1, Rückmeldung des Nutzers: "Batterie" änderte die Vorschau nicht)
    await ev(`r.host._devices.forEach((d) => { d.battery = null; d.signal = null; })`);
    await tap('input[data-nfield="signal"]');
    const inv = await ev(`return [[...r.querySelectorAll(".pv-text i")].map(x=>x.textContent).join("|"), r.querySelector(".pv .opt-short").textContent.includes(${JSON.stringify(T.exampleNote)})]`);
    check(`[${tag}] Vorschau: fehlende Angaben als Beispielwert in Kursiv, mit Hinweis`, inv[0] === T.invented && inv[1], JSON.stringify(inv));
    await tap('input[data-nfield="signal"]');
    check(`[${tag}] Inhalt als geändert markiert`, await ev(`return r.querySelector('input[data-nfield="area"]').closest(".opt").classList.contains("changed")`));
    // Erst melden nach: 0 bis 60
    const delay = await handle('input[data-opt="notify_delay"]');
    await delay.scrollIntoViewIfNeeded();
    if (mobile) await delay.tap(); else await delay.click();
    await delay.fill("");
    await delay.type("61");
    check(`[${tag}] 61 Min. ungültig`, (await text('.opt:has(input[data-opt="notify_delay"]) .opt-error')) === T.range && await ev(`return r.querySelector('[data-set="save"]').disabled`), await text('.opt:has(input[data-opt="notify_delay"]) .opt-error'));
    await delay.fill("");
    await delay.type("5");
    check(`[${tag}] 5 Min. gültig`, await wait(`return !r.querySelector('[data-set="save"]').disabled`));
    check(`[${tag}] "Ausfall melden" nennt 5 Min. (live)`, (await text('.opt:has(input[data-opt="notify_outage"]) .opt-short')) === T.outage5, await text('.opt:has(input[data-opt="notify_outage"]) .opt-short'));
    await ev(`r.querySelector(".nf-grid").scrollIntoView({ block: "start" })`);
    await p.screenshot({ path: `${outDir}/notify-preview-${tag.replace("/", "-")}.png` });
    await ev(`r.querySelector('[data-id="push"]').scrollIntoView({ block: "start" })`);
    await p.screenshot({ path: `${outDir}/notify-push-${tag.replace("/", "-")}.png` });

    // Anhaltende Benachrichtigung: Integrationen ohne Ausschluss
    await tap('[data-set="section"][data-id="persistent"]');
    await tap('.switch input[data-opt="outage_persistent"]');
    check(`[${tag}] anhaltend: 8 Integrationen`, (await sum("persistent")) === T.persOn(8), await sum("persistent"));

    await tap('dialog.settings [data-set="save"]');
    const sorted = (o) => JSON.stringify(Object.fromEntries(Object.entries(o || {}).sort()));
    const expect = {
      notify_delay: 5, notify_exclude_integrations: ["bthome"], notify_fields: ["integration", "since", "battery"], notify_outage: true,
      notify_service: "notify.mobile_app_testhandy", outage_persistent: true, persistent_exclude_integrations: ["zha"],
    };
    const saved = await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`);
    check(`[${tag}] gespeichert`, saved && sorted((await calls("device_panel/set_options")).at(-1)?.values) === sorted(expect), JSON.stringify((await calls("device_panel/set_options")).at(-1)?.values));
    await tap('dialog.settings .dlg-actions [data-set="close"]');
    await wait(`return !r.querySelector("dialog.settings").open`);

    // Popup: "24 Std. stumm" aus der Meldung als eigene Option
    await p.evaluate(() => { window.__devSettings.mute.d = new Date(Date.now() + 20 * 3600000).toISOString(); });
    await f.evaluate(() => document.querySelector("device-panel")._fetch());
    await tap('.dev[data-open="d"]');
    await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('select[data-dlg="dev-notify"]')`);
    const sel = await ev(`const s=r.querySelector('select[data-dlg="dev-notify"]'); return [s.value, s.options[s.selectedIndex].textContent, s.options.length, s.closest(".opt").classList.contains("changed")]`);
    check(`[${tag}] Popup: stumm bis …, markiert`, sel[0] === "mute" && T.muted.test(sel[1]) && sel[2] === 3 && sel[3] === true, JSON.stringify(sel));
    await ev(`r.querySelector('select[data-dlg="dev-notify"]').scrollIntoView({ block: "center" })`);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${outDir}/notify-popup-${tag.replace("/", "-")}.png` });
    await pick('select[data-dlg="dev-notify"]', "on");
    check(`[${tag}] "Globale Einstellung" hebt stumm auf`, await wait(`const s=r.querySelector('select[data-dlg="dev-notify"]'); return s && s.value === "on" && s.options.length === 2`) && JSON.stringify((await calls("device_panel/set_device_settings")).at(-1)) .includes('"notify":true'), JSON.stringify((await calls("device_panel/set_device_settings")).at(-1)));
    check(`[${tag}] Option "${T.notifyOn}"`, (await ev(`const s=r.querySelector('select[data-dlg="dev-notify"]'); return s.options[s.selectedIndex].textContent`)) === T.notifyOn);

    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
