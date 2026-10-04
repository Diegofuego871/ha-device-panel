// Überwachung und Meldungen (seit 0.34.0, docs/mockups/notify-v3): Sprung aus
// "Integrationen", Reiter "Integrationen" (Liste, Filter, je Integration
// Überwachen, Push, Anhaltend, Batterie-Push, alles auf Standard), Chips der
// Übersicht, Inhalt der Ausfall- und der Batterie-Meldung mit Vorschau,
// "Erst melden nach" im Zeitstrahl, Herkunft im Geräte-Popup, Stumm im Popup.
// Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

const TEXT = {
  de: {
    sum0: "Ausfall nach 2 Min., ohne Push · Batterie schwach ab 15 %, ohne Push",
    sumPush: "Ausfall nach 2 Min., Push nach 5 Min. · Batterie schwach ab 15 %, Push sofort",
    int: "9 Integrationen · alle angezeigt", gotoLink: "Überwachung und Meldungen › Integrationen",
    tabs: "Übersicht|Ausfall|Batterie|Integrationen", filterAll: "Alle 9", filterOwn: (n) => `Abweichend ${n}`, std: "Standard", own: "Eigene",
    zhaSub: "5 Geräte · 3 mit Batterie", noPush: "Ausfall ohne Push", noPers: "Ausfall ohne Anhaltend · Batterie ohne Push", unmon: "Nicht überwacht",
    diffInteg: "2 Integrationen", noPushMark: "Kein Push", noTarget: "kein Ziel gewählt", pushMark: "ausgefallen und Push",
    fields: "Bereich|Integration|Verbindungsart|Offline seit|Empfang zuletzt|Batterie zuletzt|Hersteller / Modell", title: "Ausgefallen: Temperatur Keller", fieldsLabel: "Inhalt der Ausfall-Meldung", noteBattery: "eigenen Inhalt im Reiter \"Batterie\"",
    since: /^seit \d\d:\d\d$/, battery: "Batterie 0 %", actions: "Öffnen|24 Std. stumm", invented: "-72 dBm|64 %", exampleNote: "Kursiv: Beispielwert", range: "Erlaubt: 1 bis 60",
    outageShort: "Sobald \"Erst melden nach\" um ist, an das Ziel im Reiter \"Übersicht\".",
    bFields: "Stand|Bereich|Integration|Hersteller / Modell", bTitle: "Batterie schwach: Temperatur Keller", bText: "0 % · Keller", bTextInteg: "0 % · Keller · BTHome",
    popBatPushOff: "Push für die Integration aus", muted: /^Stumm bis /, notifyOn: "Globale Einstellung",
  },
  en: {
    sum0: "Offline after 2 min, no push · Battery low from 15 %, no push",
    sumPush: "Offline after 2 min, push after 5 min · Battery low from 15 %, push right away",
    int: "9 integrations · all shown", gotoLink: "Monitoring and notifications › Integrations",
    tabs: "Overview|Outage|Battery|Integrations", filterAll: "All 9", filterOwn: (n) => `Differs ${n}`, std: "Default", own: "Own",
    zhaSub: "5 devices · 3 with battery", noPush: "Outage: no push", noPers: "Outage: no persistent · Battery: no push", unmon: "Not monitored",
    diffInteg: "2 integrations", noPushMark: "No push", noTarget: "no target chosen", pushMark: "offline and push",
    fields: "Area|Integration|Connection type|Offline since|Last signal|Last battery level|Manufacturer / model", title: "Offline: Temperatur Keller", fieldsLabel: "Content of the outage notification", noteBattery: "own content in the tab \"Battery\"",
    since: /^since \d\d:\d\d( [AP]M)?$/, battery: "battery 0 %", actions: "Open|Mute 24 h", invented: "-72 dBm|64 %", exampleNote: "Italic: example value", range: "Allowed: 1 to 60",
    outageShort: "Once \"Report only after\" has passed, to the target in the tab \"Overview\".",
    bFields: "Level|Area|Integration|Manufacturer / model", bTitle: "Low battery: Temperatur Keller", bText: "0 % · Keller", bTextInteg: "0 % · Keller · BTHome",
    popBatPushOff: "Push off for the integration", muted: /^Muted until /, notifyOn: "Global setting",
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
    const tab = async (key) => { await tap(`[data-set="tab"][data-key="${key}"]`); await wait(`return r.querySelector('.mon-tab.on')?.dataset.key === "${key}"`); };
    const integ = async (dom) => { await tap(`[data-set="integ"][data-key="${dom}"]`); await wait(`return !!r.querySelector('.ihead') && !!r.querySelector('[data-imon="${dom}"]')`); };
    const back = async () => { await tap('[data-set="integ"][data-key=""]'); await wait(`return !!r.querySelector(".ilist")`); };
    const row = (dom) => ev(`const b=r.querySelector('.ilist-row[data-key="${dom}"]'); return b ? [b.querySelector(".ilist-diff").textContent, b.querySelector(".ilist-diff").className, b.classList.contains("changed")] : null`);
    const origin = (sel) => ev(`return r.querySelector(${JSON.stringify(sel)})?.closest(".opt")?.querySelector(".origin")?.textContent || ""`);
    const sw = (list, dom) => `input[data-list="${list}"][data-value="${dom}"]`;

    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    check(`[${tag}] Abschnitt "Überwachung und Meldungen" zuerst, Zusammenfassung`, (await ev(`return r.querySelector(".set-sec-head").dataset.id`)) === "monitor" && (await sum("monitor")) === T.sum0, await sum("monitor"));
    check(`[${tag}] Integrationen: nur noch Anzeigen`, (await sum("integrations")) === T.int, await sum("integrations"));

    // Abschnitt "Integrationen": Verweis springt in den Reiter "Integrationen"
    await tap('[data-set="section"][data-id="integrations"]');
    check(`[${tag}] Verweis im Abschnitt "Integrationen"`, (await text('.integ-goto [data-set="goto"]')) === T.gotoLink, await text(".integ-goto"));
    await tap('.integ-goto [data-set="goto"]');
    check(`[${tag}] Sprung: Abschnitt offen, Reiter "Integrationen", Liste`, await wait(`return r.querySelector('[data-set="section"][data-id="monitor"]').getAttribute("aria-expanded") === "true" && r.querySelector('.mon-tab.on')?.dataset.key === "integ" && !!r.querySelector(".ilist")`));
    check(`[${tag}] vier Reiter`, (await ev(`return [...r.querySelectorAll(".mon-tab")].map(t=>t.textContent).join("|")`)) === T.tabs);
    check(`[${tag}] Filter "${T.filterAll}" und "${T.filterOwn(0)}"`, (await ev(`return [...r.querySelectorAll('[data-set="ifilter"]')].map(c=>c.textContent).join("|")`)) === `${T.filterAll}|${T.filterOwn(0)}`);
    const zha = await row("zha");
    check(`[${tag}] Zeile ZHA: Geräte mit Batterie, Standard`, zha && (await text('.ilist-row[data-key="zha"] .ilist-name small')) === T.zhaSub && zha[0] === T.std, JSON.stringify(zha));

    // BTHome: Push bei Ausfall aus
    await integ("bthome");
    check(`[${tag}] BTHome: alles Standard, mit Batterie`, (await ev(`return [...r.querySelectorAll(".mon-body .origin")].map(o=>o.textContent).every(t=>t===${JSON.stringify(T.std)})`)) && !!(await handle('select[data-bat-mode="bthome"]')) && await ev(`return r.querySelector('[data-imon="bthome"]').checked && r.querySelector('${sw("notify_exclude_integrations", "bthome")}').checked`));
    await tap(sw("notify_exclude_integrations", "bthome"));
    check(`[${tag}] Push aus: Etikett "${T.own}", geändert`, await wait(`return !r.querySelector('${sw("notify_exclude_integrations", "bthome")}').checked`) && (await origin(sw("notify_exclude_integrations", "bthome"))) === T.own && await ev(`return r.querySelector('${sw("notify_exclude_integrations", "bthome")}').closest(".opt").classList.contains("changed")`) && /^1 /.test(await text(".set-count")));
    check(`[${tag}] Reiter mit Punkt (Änderung)`, await ev(`return r.querySelector('.mon-tab[data-key="integ"]').classList.contains("chg")`));
    await back();
    const bt = await row("bthome");
    check(`[${tag}] Liste: BTHome "${T.noPush}", markiert`, bt && bt[0] === T.noPush && bt[1].includes("own") && bt[2], JSON.stringify(bt));
    // ZHA: Anhaltend und Batterie-Push aus
    await integ("zha");
    await tap(sw("persistent_exclude_integrations", "zha"));
    await tap(sw("battery_push_exclude_integrations", "zha"));
    await back();
    const z2 = await row("zha");
    check(`[${tag}] Liste: ZHA "${T.noPers}"`, z2 && z2[0] === T.noPers, JSON.stringify(z2));
    await tap('[data-set="ifilter"][data-key="own"]');
    check(`[${tag}] Filter "${T.filterOwn(2)}": nur abweichende`, await wait(`return r.querySelectorAll(".ilist-row").length === 2`) && (await ev(`return [...r.querySelectorAll(".ilist-row")].map(b=>b.dataset.key).join()`)) === "zha,bthome" && (await text('[data-set="ifilter"][data-key="own"]')) === T.filterOwn(2));
    await tap('[data-set="ifilter"][data-key="all"]');
    // Shelly: Überwachen aus sperrt den Rest; "Alles auf Standard"
    await integ("shelly");
    await tap('input[data-imon="shelly"]');
    check(`[${tag}] nicht überwacht: Hinweis, Rest gesperrt`, await wait(`return !r.querySelector('input[data-imon="shelly"]').checked && !!r.querySelector(".mon-body .nf-note") && r.querySelector('select[data-off-mode="shelly"]').disabled && r.querySelector('${sw("notify_exclude_integrations", "shelly")}').disabled`));
    await back();
    const sh = await row("shelly");
    check(`[${tag}] Liste: Shelly "${T.unmon}"`, sh && sh[0] === T.unmon && sh[1].includes("unmon"), JSON.stringify(sh));
    await integ("shelly");
    await tap('[data-set="integ-reset"][data-key="shelly"]');
    check(`[${tag}] "Alles auf Standard": wieder überwacht, Knopf gesperrt`, await wait(`return r.querySelector('input[data-imon="shelly"]').checked && r.querySelector('[data-set="integ-reset"]').disabled`));
    await p.screenshot({ path: `${outDir}/notify-integ-${tag.replace("/", "-")}.png` });
    await back();

    // Übersicht: Chips schalten, Zeitstrahl zeigt, was kommt
    await tab("overview");
    check(`[${tag}] Übersicht: ohne Ziel "${T.noPushMark}", Abweichungen`, (await text('[data-lane="outage"] .mk-off b')) === T.noPushMark && (await text('[data-lane="outage"] .mk-off span')) === T.noTarget && (await text('[data-lane="outage"] .lane-diff [data-filter="own"]')) === T.diffInteg, await text('[data-lane="outage"] .lane-diff'));
    await tap('[data-set="chip"][data-key="notify_outage"]');
    check(`[${tag}] Chip "Push" an`, await wait(`return r.querySelector('[data-set="chip"][data-key="notify_outage"]').getAttribute("aria-pressed") === "true"`));
    await pick('select[data-opt="notify_service"]', "notify.mobile_app_testhandy");
    // Gleich lang (2 Min.): eine gemeinsame Marke "ausgefallen und Push".
    check(`[${tag}] mit Ziel: gemeinsame Marke im Zeitstrahl`, await wait(`return r.querySelector('[data-lane="outage"] .mk-both span')?.textContent === ${JSON.stringify(T.pushMark)}`), await text('[data-lane="outage"] .mtl'));

    // Ausfall: Inhalt, Vorschau, Erst melden nach
    await tab("outage");
    const nfNote = await text(".nf-note");
    check(`[${tag}] Name und Hinweis: nur Ausfall-Meldung`, (await text(".opt:has(.nf-grid) .opt-label")) === T.fieldsLabel && nfNote.includes(T.noteBattery), nfNote);
    check(`[${tag}] Inhalt: 7 Schalter in fester Reihenfolge`, (await ev(`return [...r.querySelectorAll(".nf-item > span:first-child")].map(s=>s.textContent).join("|")`)) === T.fields);
    check(`[${tag}] Standard: Bereich, Integration, Offline seit`, (await ev(`return [...r.querySelectorAll("input[data-nfield]:checked")].map(i=>i.dataset.nfield).join()`)) === "area,integration,since");
    check(`[${tag}] Kurzzeile "Ausfall melden" (Anführungszeichen im Attribut ganz)`, (await ev(`const o=r.querySelector('input[data-opt="notify_outage"]').closest(".opt").querySelector("[data-short]"); return o.textContent === ${JSON.stringify(T.outageShort)} && o.dataset.short === ${JSON.stringify(T.outageShort)}`)));
    check(`[${tag}] Vorschau mit ausgefallenem Gerät`, await wait(`return !!r.querySelector(".pv-card")`) && (await text(".pv-title")) === T.title && (await ev(`return [...r.querySelectorAll(".pv-actions span")].map(s=>s.textContent).join("|")`)) === T.actions, await text(".pv-title"));
    const parts = (await pvText()).split(" · ");
    check(`[${tag}] Vorschau: Bereich · Integration · seit`, parts.length === 3 && parts[0] === "Keller" && parts[1] === "BTHome" && T.since.test(parts[2]), await pvText());
    await tap('input[data-nfield="battery"]');
    await tap('input[data-nfield="area"]');
    const parts2 = (await pvText()).split(" · ");
    check(`[${tag}] Vorschau folgt dem Inhalt, Reihenfolge fest`, parts2.length === 3 && parts2[0] === "BTHome" && T.since.test(parts2[1]) && parts2[2] === T.battery, await pvText());
    const saveBat = await ev(`return JSON.stringify(r.host._devices.map((d) => [d.battery, d.signal]))`);
    await ev(`r.host._devices.forEach((d) => { d.battery = null; d.signal = null; })`);
    await tap('input[data-nfield="signal"]');
    const inv = await ev(`return [[...r.querySelectorAll(".pv-text i")].map(x=>x.textContent).join("|"), r.querySelector(".pv .opt-short").textContent.includes(${JSON.stringify(T.exampleNote)})]`);
    check(`[${tag}] Vorschau: fehlende Angaben als Beispielwert in Kursiv, mit Hinweis`, inv[0] === T.invented && inv[1], JSON.stringify(inv));
    await tap('input[data-nfield="signal"]');
    await ev(`const s=${saveBat}; r.host._devices.forEach((d, i) => { d.battery = s[i][0]; d.signal = s[i][1]; })`);
    const delay = await handle('.mtl input[data-opt="notify_delay"]');
    await delay.scrollIntoViewIfNeeded();
    if (mobile) await delay.tap(); else await delay.click();
    await delay.fill("");
    await delay.type("61");
    check(`[${tag}] 61 Min. ungültig: Fehler unter dem Zeitstrahl`, (await text("[data-tl-error]")) === T.range && await ev(`return r.querySelector('[data-set="save"]').disabled && r.querySelector('.mtl input[data-opt="notify_delay"]').closest(".opt-input").classList.contains("bad")`), await text("[data-tl-error]"));
    await delay.fill("");
    await delay.type("5");
    check(`[${tag}] 5 Min. gültig`, await wait(`return !r.querySelector('[data-set="save"]').disabled && r.querySelector("[data-tl-error]").hidden`));
    await tap('.switch input[data-opt="outage_persistent"]');
    await ev(`r.querySelector(".nf-grid").scrollIntoView({ block: "start" })`);
    await p.screenshot({ path: `${outDir}/notify-preview-${tag.replace("/", "-")}.png` });

    // Batterie: Inhalt der Meldung mit Vorschau (seit 0.34.0 anpassbar)
    await tab("battery");
    check(`[${tag}] Batterie: 4 Schalter, Standard Stand und Bereich`, (await ev(`return [...r.querySelectorAll('input[data-bfield]')].map(i=>i.closest(".nf-item").firstElementChild.textContent).join("|")`)) === T.bFields && (await ev(`return [...r.querySelectorAll("input[data-bfield]:checked")].map(i=>i.dataset.bfield).join()`)) === "battery,area");
    check(`[${tag}] Vorschau erst mit Push`, !(await ev(`return !!r.querySelector(".pv")`)));
    await tap('.switch input[data-opt="battery_push"]');
    check(`[${tag}] Vorschau: schwächstes Gerät, Stand · Bereich`, await wait(`return !!r.querySelector(".pv-card")`) && (await text(".pv-title")) === T.bTitle && (await pvText()) === T.bText, `${await text(".pv-title")} / ${await pvText()}`);
    await tap('input[data-bfield="integration"]');
    check(`[${tag}] Vorschau mit Integration`, (await pvText()) === T.bTextInteg, await pvText());
    await tap('input[data-bfield="battery"]');
    await tap('input[data-bfield="area"]');
    await tap('input[data-bfield="integration"]');
    check(`[${tag}] nichts gewählt: der Stand`, (await pvText()) === "0 %", await pvText());
    await tap('input[data-bfield="model"]');
    await tap('input[data-bfield="battery"]');
    check(`[${tag}] feste Reihenfolge: Stand vor Modell`, (await ev(`return [...r.querySelectorAll("input[data-bfield]:checked")].map(i=>i.dataset.bfield).join()`)) === "battery,model");
    check(`[${tag}] Zusammenfassung mit Push`, (await sum("monitor")) === T.sumPush, await sum("monitor"));
    await p.screenshot({ path: `${outDir}/notify-battery-${tag.replace("/", "-")}.png` });

    await tap('dialog.settings [data-set="save"]');
    const sorted = (o) => JSON.stringify(Object.fromEntries(Object.entries(o || {}).sort()));
    const expect = {
      battery_fields: ["battery", "model"], battery_push: true, battery_push_exclude_integrations: ["zha"],
      notify_delay: 5, notify_exclude_integrations: ["bthome"], notify_fields: ["integration", "since", "battery"], notify_outage: true,
      notify_service: "notify.mobile_app_testhandy", outage_persistent: true, persistent_exclude_integrations: ["zha"],
    };
    const saved = await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`);
    check(`[${tag}] gespeichert`, saved && sorted((await calls("device_panel/set_options")).at(-1)?.values) === sorted(expect), JSON.stringify((await calls("device_panel/set_options")).at(-1)?.values));
    await tap('dialog.settings .dlg-actions [data-set="close"]');
    await wait(`return !r.querySelector("dialog.settings").open`);

    // Popup eines ZHA-Geräts: Batterie-Push für die Integration aus
    await tap('.dev[data-open="b"]');
    await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('select[data-dlg="dev-bat"]')`);
    const batOrigin = await ev(`return r.querySelector('select[data-dlg="dev-bat"]').closest(".opt").querySelector(".opt-origin").textContent`);
    check(`[${tag}] Popup: "${T.popBatPushOff}"`, batOrigin.includes(T.popBatPushOff), batOrigin);
    await tap('dialog.device [data-dlg="close"]');
    await wait(`return !r.querySelector("dialog.device").open`);

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

    check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
