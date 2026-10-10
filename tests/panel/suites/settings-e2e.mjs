// Einstellungen (Zahnrad): Kopf, Versionszeile, Abschnitt "Updates" mit
// Info, Entwurf mit Etikett und Zähler, Speichern über set_options und
// set_panel, Abbrechen verwirft, Fehler beim Laden und Speichern, Escape,
// Hintergrund. Batterie (Zeitpunkt, Uhrzeit, Tagesmeldung, pro Integration)
// und Push (Ziel, Ausfall, wieder online, Sammelausfall); aufgeklappter
// Abschnitt abgesetzt. Deutsch und Englisch, Desktop und Handy (Blatt).
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

const TEXT = {
  de: {
    gear: "Einstellungen", title: "Einstellungen", sub: "Device Panel · gilt für alle Benutzer", sec: "Panel-Version",
    sumOn: "Tägliche Prüfung · neue Version unter \"Reparaturen\"", sumOff: "Keine automatische Prüfung",
    opt: "Täglich nach Updates suchen", short: "Meldet eine neue Version unter Einstellungen → Reparaturen.", info: "Fragt einmal täglich",
    changed: "geändert", one: "1 Änderung", two: "2 Änderungen", save: "Speichern", cancel: "Abbrechen", savedShort: "Gespeichert", closeBtn: "Schliessen",
    pre: "Vorabversionen anzeigen", loadErr: "Einstellungen konnten nicht geladen werden:", saveErr: "Speichern fehlgeschlagen:", ver: "Device Panel 0.4.0",
    secInt: "Integrationen", secDev: "Geräte im Panel", tabTypes: "Typen", sumInt1: "1 Integration ausgeblendet", show: "Anzeigen", all: "Alle umschalten",
    zha: "Zigbee Home Automation", zhaSub: "5 Geräte", outlet: "Steckdose", sumTypes1: "1 Integration, 1 Typ ausgeblendet", sumTypesAll: "1 Integration, 11 Typen ausgeblendet",
   
    offLabel: "Ausgefallen nach", unit: "Min.", range: "Erlaubt: 1 bis 60",
    sumDisp: "Dienst-Geräte und deaktivierte Geräte ausgeblendet", sumDispDis: "Dienst-Geräte ausgeblendet · deaktivierte angezeigt",
    sumDispBoth: "Dienst-Geräte und deaktivierte Geräte angezeigt", grpDis: "Deaktiviert", ofTotal: "von 17", four: "4 Änderungen", five: "5 Änderungen",
   
    noTarget: "Ohne Ziel kommt kein Push. Ziel wählen: Reiter \"Übersicht\".",
    notifyNone: "Kein Ziel (keine Push-Meldungen)", entity: "notify.fernseher (Entität)",
    rangeBat: "Erlaubt: 5 bis 50",
   
    batDef: (p) => `Standard (${p} %)`, batModes: "Standard (15 %)|Eigene|Aus", popDefOff: "Wie Integration (aus)",
    shortInstant: "Sobald ein Gerät unter die Warnschwelle fällt.", shortDaily: (t) => `Eine Sammelmeldung um ${t}; Ausfall-Meldungen betrifft das nicht.`, timeErr: "Uhrzeit HH:MM",
    dailyAll: "Alle schwachen Geräte",
   
    outageShort: "Sobald \"Erst melden nach\" um ist, an das Ziel im Reiter \"Übersicht\".", eight: "8 Änderungen",
    secMon: "Überwachung und Meldungen",
    sumMon: (m, d = null, bat = 15, push = null) => `Ausfall nach ${m} Min.${d ? `, Push nach ${d} Min.` : ", ohne Push"} · Batterie schwach ab ${bat} %${push ? `, Push ${push}` : ", ohne Push"}`,
    instant: "sofort",
    daily: (t) => `täglich ${t}`,
    delayShort: (m) => `"Erst melden nach" muss mindestens ${m} Min. sein ("Ausgefallen nach"). Vorher gilt ein Gerät nicht als ausgefallen.`,
    tlLow: (p) => `bis ${p} %`,
    tlInstant: "sofort",
    tlDaily: (t) => `täglich ${t}`,
    tlDailyAll: "Push, alle schwachen",
    zhaBat: "5 Geräte · 3 mit Batterie",
    own: "Eigene",
    diffBat25: "Batterie 25 %",
    diffBatOff: "Batterie-Warnung aus",
    filterOwn2: "Abweichend 2", filterOwn0: "Abweichend 0",
  },
  en: {
    gear: "Settings", title: "Settings", sub: "Device Panel · applies to all users", sec: "Panel version",
    sumOn: "Daily check · new version under \"Repairs\"", sumOff: "No automatic check",
    opt: "Check for updates daily", short: "Reports a new version under Settings → Repairs.", info: "Queries the published releases",
    changed: "changed", one: "1 change", two: "2 changes", save: "Save", cancel: "Cancel", savedShort: "Saved", closeBtn: "Close",
    pre: "Show pre-releases", loadErr: "Could not load the settings:", saveErr: "Saving failed:", ver: "Device Panel 0.4.0",
    secInt: "Integrations", secDev: "Devices in the panel", tabTypes: "Types", sumInt1: "1 integration hidden", show: "Show", all: "Toggle all",
    zha: "Zigbee Home Automation", zhaSub: "5 devices", outlet: "Outlet", sumTypes1: "1 integration, 1 type hidden", sumTypesAll: "1 integration, 11 types hidden",
   
    offLabel: "Offline after", unit: "min", range: "Allowed: 1 to 60",
    sumDisp: "Service devices and disabled devices hidden", sumDispDis: "Service devices hidden · disabled shown",
    sumDispBoth: "Service devices and disabled devices shown", grpDis: "Disabled", ofTotal: "of 17", four: "4 changes", five: "5 changes",
   
    noTarget: "Without a target no push is sent. Choose a target: tab \"Overview\".",
    notifyNone: "No target (no push notifications)", entity: "notify.fernseher (entity)",
    rangeBat: "Allowed: 5 to 50",
   
    batDef: (p) => `Default (${p} %)`, batModes: "Default (15 %)|Own|Off", popDefOff: "Same as integration (off)",
    shortInstant: "As soon as a device drops below the warning threshold.", shortDaily: (t) => `One summary at ${t}; outage notifications are not affected.`, timeErr: "Time HH:MM",
    dailyAll: "All devices with a low battery",
   
    outageShort: "Once \"Report only after\" has passed, to the target in the tab \"Overview\".", eight: "8 changes",
    secMon: "Monitoring and notifications",
    sumMon: (m, d = null, bat = 15, push = null) => `Offline after ${m} min${d ? `, push after ${d} min` : ", no push"} · Battery low from ${bat} %${push ? `, push ${push}` : ", no push"}`,
    instant: "right away",
    daily: (t) => `daily at ${t}`,
    delayShort: (m) => `"Report only after" must be at least ${m} min ("Offline after"). Before that a device does not count as offline.`,
    tlLow: (p) => `up to ${p} %`,
    tlInstant: "right away",
    tlDaily: (t) => `daily ${t}`,
    tlDailyAll: "push, all low ones",
    zhaBat: "5 devices · 3 with battery",
    own: "Own",
    diffBat25: "Battery 25 %",
    diffBatOff: "Battery warning off",
    filterOwn2: "Differs 2", filterOwn0: "Differs 0",
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
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const tap = async (sel) => {
      const h = (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
      if (!h) throw new Error("fehlt: " + sel);
      if (mobile) await h.tap(); else await h.click();
    };
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const isOpen = () => ev(`return r.querySelector("dialog.settings").open`);
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const calls = (type) => p.evaluate((t) => window.__wsCalls.filter((m) => m.type === t), type);
    // Nach dem Speichern bleibt der Dialog offen und zeigt "Gespeichert".
    const savedOpen = () => wait(`return r.querySelector("dialog.settings").open && r.querySelector(".set-count")?.classList.contains("saved")`);
    const closeSettings = async () => { await tap('dialog.settings .dlg-actions [data-set="close"]'); return wait(`return !r.querySelector("dialog.settings").open`); };
    const savedThenClose = async () => (await savedOpen()) && (await closeSettings());

    // Zahnrad in der Werkzeugleiste
    check(`[${tag}] Zahnrad mit Beschriftung`, (await ev(`return r.querySelector(".gear-btn").getAttribute("aria-label")`)) === T.gear);
    const over = await ev(`const t=r.querySelector(".toolbar"); return t.scrollWidth - t.clientWidth`);
    check(`[${tag}] Werkzeugleiste ohne Überlauf`, over <= 1, String(over));
    await tap(".gear-btn");
    check(`[${tag}] Dialog offen`, await isOpen());
    check(`[${tag}] Kopf`, (await text("dialog.settings h2")) === T.title && (await text("dialog.settings .dlg-sub")) === T.sub);
    check(`[${tag}] geladen`, await wait(`return !!r.querySelector("dialog.settings .set-sec")`));
    check(`[${tag}] Optionen per WebSocket`, (await calls("device_panel/get_options")).length === 1 && (await calls("device_panel/version")).length >= 1);
    check(`[${tag}] Versionszeile`, (await text("dialog.settings .ver-slot")).includes(T.ver));
    check(`[${tag}] Schalter Vorabversionen`, (await text("dialog.settings .ver-opt-l")) === T.pre && (await ev(`return r.querySelector('[data-ver="prerelease"]').getAttribute("aria-checked")`)) === "false");
    check(`[${tag}] Abschnitt mit Zusammenfassung`, (await text('[data-id="updates"] .set-sec-title')) === T.sec && (await text('[data-id="updates"] .set-sec-sum')) === T.sumOn, await text('[data-id="updates"] .set-sec-sum'));
    check(`[${tag}] Speichern gesperrt ohne Änderung, Knopf "Schliessen"`, await ev(`return r.querySelector('[data-set="save"]').disabled`) && (await text(".set-count")) === "" && (await text('dialog.settings .dlg-actions [data-set="close"]')) === T.closeBtn);
    if (mobile) {
      const geo = await ev(`const d=r.querySelector("dialog.settings").getBoundingClientRect(); return [Math.round(d.left), Math.round(d.width), Math.round(d.bottom), innerWidth, innerHeight]`);
      check(`[${tag}] Blatt von unten über die ganze Breite`, geo[0] === 0 && geo[1] === geo[3] && Math.abs(geo[2] - geo[4]) <= 1, JSON.stringify(geo));
    }

    // Abschnitt aufklappen, Info, Schalter
    await tap('[data-set="section"][data-id="updates"]');
    check(`[${tag}] aufgeklappt`, (await text(".set-sec-body .opt-label")) === T.opt && (await text(".set-sec-body .opt-short")) === T.short);
    // Offener Abschnitt sichtbar abgesetzt: Kopf getönt und fett, Rand kräftiger
    const look = await ev(`const cs=(el)=>getComputedStyle(el); const o=r.querySelector(".set-sec.open"), c=r.querySelector(".set-sec:not(.open)");
      return [cs(o.querySelector(".set-sec-head")).backgroundColor, cs(c.querySelector(".set-sec-head")).backgroundColor, cs(o).borderTopColor, cs(c).borderTopColor, cs(o.querySelector(".set-sec-title")).fontWeight, cs(o).backgroundColor, cs(c).backgroundColor]`);
    check(`[${tag}] offener Abschnitt abgesetzt`, look[0] !== look[1] && look[0] !== "rgba(0, 0, 0, 0)" && look[2] !== look[3] && look[4] === "600" && look[5] !== look[6], JSON.stringify(look));
    await tap('[data-set="info"][data-key="update_check"]');
    check(`[${tag}] Info aufgeklappt`, (await text(".opt-info")).startsWith(T.info));
    await tap('.switch input[data-opt="update_check"]');
    check(`[${tag}] Entwurf: Etikett, Zähler, Zusammenfassung, Knopf "Abbrechen"`, (await text('[data-id="updates"] .set-sec-title .set-badge')) === T.changed && (await text(".set-count")) === T.one && (await text('[data-id="updates"] .set-sec-sum')) === T.sumOff && (await text('dialog.settings .dlg-actions [data-set="close"]')) === T.cancel);
    await tap('[data-ver="prerelease"]');
    check(`[${tag}] Vorabversionen im Entwurf`, (await text(".set-count")) === T.two && (await text(".ver-opt-l .set-badge")) === T.changed && (await ev(`return r.querySelector('[data-ver="prerelease"]').getAttribute("aria-checked")`)) === "true");
    check(`[${tag}] noch nichts gespeichert`, (await calls("device_panel/set_options")).length === 0 && (await calls("device_panel/set_panel")).length === 0);
    await p.screenshot({ path: `${outDir}/settings-${lang}-${mobile ? "mobile" : "desktop"}.png` });

    // Abbrechen verwirft
    await tap('dialog.settings .dlg-actions [data-set="close"]');
    check(`[${tag}] Abbrechen schliesst ohne Speichern`, !(await isOpen()) && (await calls("device_panel/set_options")).length === 0 && (await calls("device_panel/set_panel")).length === 0);
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    check(`[${tag}] nach Abbrechen unverändert`, (await text('[data-id="updates"] .set-sec-sum')) === T.sumOn && (await text(".set-count")) === "");

    // Speichern
    await tap('[data-set="section"][data-id="updates"]');
    await tap('.switch input[data-opt="update_check"]');
    await tap('[data-ver="prerelease"]');
    await tap('dialog.settings [data-set="save"]');
    // Dialog bleibt offen: "Gespeichert", Knopf "Schliessen", Abschnitt weiter offen, neuer Stand
    check(`[${tag}] gespeichert, Dialog bleibt offen`, (await savedOpen()) && (await text(".set-count")) === T.savedShort && (await text('dialog.settings .dlg-actions [data-set="close"]')) === T.closeBtn && await ev(`return r.querySelector('[data-set="save"]').disabled`), `${await text(".set-count")} / ${await text('dialog.settings .dlg-actions [data-set="close"]')}`);
    await p.screenshot({ path: `${outDir}/settings-saved-${tag.replace("/", "-")}.png` });
    check(`[${tag}] nach dem Speichern: Abschnitt offen, Stand neu, kein "geändert"`, (await ev(`return r.querySelector('[data-set="section"][data-id="updates"]').getAttribute("aria-expanded")`)) === "true" && (await text('[data-id="updates"] .set-sec-sum')) === T.sumOff && !(await ev(`return !!r.querySelector("dialog.settings .set-badge")`)) && (await ev(`return r.querySelector('[data-ver="prerelease"]').getAttribute("aria-checked")`)) === "true" && (await calls("device_panel/get_options")).length === 3);
    const so = await calls("device_panel/set_options");
    const sp = await calls("device_panel/set_panel");
    check(`[${tag}] set_options nur mit der Änderung`, so.length === 1 && JSON.stringify(so[0].values) === JSON.stringify({ update_check: false }), JSON.stringify(so));
    check(`[${tag}] set_panel mit Vorabversionen`, sp.length === 1 && sp[0].prerelease === true, JSON.stringify(sp));
    // Erneut ändern: Zähler statt "Gespeichert", Knopf wieder "Abbrechen"; zurück: weder noch
    await tap('.switch input[data-opt="update_check"]');
    check(`[${tag}] erneut geändert`, (await text(".set-count")) === T.one && (await text('dialog.settings .dlg-actions [data-set="close"]')) === T.cancel);
    await tap('.switch input[data-opt="update_check"]');
    check(`[${tag}] zurück: kein Zähler, kein "Gespeichert"`, (await text(".set-count")) === "" && (await text('dialog.settings .dlg-actions [data-set="close"]')) === T.closeBtn);
    check(`[${tag}] "Schliessen" schliesst`, await closeSettings());
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    check(`[${tag}] neuer Stand nach erneutem Öffnen`, (await text('[data-id="updates"] .set-sec-sum')) === T.sumOff && (await ev(`return r.querySelector('[data-ver="prerelease"]').getAttribute("aria-checked")`)) === "true");

    // Escape schliesst (nur Tastatur auf dem Desktop), Hintergrund ebenso
    if (!mobile) {
      await p.keyboard.press("Escape");
      check(`[${tag}] Escape schliesst`, await wait(`return !r.querySelector("dialog.settings").open`));
      await tap(".gear-btn");
      await p.mouse.click(20, 500);
      check(`[${tag}] Hintergrund schliesst`, await wait(`return !r.querySelector("dialog.settings").open`));
    } else {
      await p.touchscreen.tap(195, 130);
      check(`[${tag}] Tipp über dem Blatt schliesst`, await wait(`return !r.querySelector("dialog.settings").open`));
    }

    // Ausschlüsse: Integration ausblenden, Liste ohne ihre Geräte. Seit
    // 0.34.0 nur noch "Anzeigen" (alles Weitere in "Überwachung und Meldungen").
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    check(`[${tag}] Abschnitt Geräte im Panel`, (await text('[data-id="devices"] .set-sec-title')) === T.secDev && (await text('[data-id="devices"] .set-sec-sum')) === T.sumDisp, await text('[data-id="devices"] .set-sec-sum'));
    await tap('[data-set="section"][data-id="devices"]');
    check(`[${tag}] erster Reiter: Integrationen`, (await ev(`return r.querySelector(".sub-tab.on").firstChild.textContent`)) === T.secInt);
    const zhaRow = await ev(`const i=r.querySelector('input[data-list="exclude_integrations"][data-value="zha"]'); return i ? i.closest(".ex-row").textContent.replace(/\\s+/g," ").trim() : ""`);
    check(`[${tag}] Zeile mit Name und Zahl der Geräte`, zhaRow.includes(T.zha) && zhaRow.includes(T.zhaSub), zhaRow);
    check(`[${tag}] nur Spalte "${T.show}" (und "Typ") und "${T.all}"`, (await text('[data-id="devices"] ~ .set-sec-body .ex-head span:nth-child(2)')) === T.show && (await text('[data-id="devices"] ~ .set-sec-body .ex-head span:last-child')) === (lang === "de" ? "Typ" : "Type") && (await text(".ex-all .ex-name")) === T.all && (await ev(`return [...r.querySelectorAll(".ex-all input[data-list-all]")].map(i=>i.dataset.listAll).join()`)) === "exclude_integrations" && !(await ev(`return !!r.querySelector('input[data-list="notify_exclude_integrations"], select[data-off-mode]')`)));
    await tap('input[data-list="exclude_integrations"][data-value="zha"]');
    check(`[${tag}] Integration im Entwurf ausgeblendet`, (await text('[data-id="devices"] .set-sec-sum')) === `${T.sumInt1} · ${T.sumDisp}` && (await text(".sub-tab.on .sub-n")) === "1" && (await text(".set-count")) === T.one && await ev(`return r.querySelector('input[data-value="zha"]').closest(".ex-row").classList.contains("off")`));
    await p.screenshot({ path: `${outDir}/settings-exclude-${lang}-${mobile ? "mobile" : "desktop"}.png` });
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] gespeichert`, await savedThenClose());
    check(`[${tag}] set_options mit Ausschluss`, JSON.stringify((await calls("device_panel/set_options")).at(-1)?.values) === JSON.stringify({ exclude_integrations: ["zha"] }));
    check(`[${tag}] Liste ohne Zigbee-Geräte`, await wait(`return r.querySelectorAll(".dev").length === 11`), String(await ev(`return r.querySelectorAll(".dev").length`)));

    // Gerätetypen: einzeln und "Alle umschalten", dann Abbrechen
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="devices"]');
    await tap('[data-set="subtab"][data-key="types"]');
    check(`[${tag}] Reiter Typen`, (await ev(`return r.querySelector(".sub-tab.on").firstChild.textContent`)) === T.tabTypes);
    await tap('input[data-list="exclude_types"][data-value="outlet"]');
    check(`[${tag}] Typ ausgeblendet`, (await text('[data-id="devices"] .set-sec-sum')) === `${T.sumTypes1} · ${T.sumDisp}`, await text('[data-id="devices"] .set-sec-sum'));
    check(`[${tag}] Reiter Typen: Zähler 1 und Punkt für die Änderung`, (await text(".sub-tab.on .sub-n")) === "1" && await ev(`return r.querySelector(".sub-tab.on").classList.contains("chg") && !r.querySelector('.sub-tab[data-key="devs"]').classList.contains("chg")`));
    // Nicht alle an: "Alle umschalten" ist aus und zeigt beim Antippen alle.
    await tap('input[data-list-all="exclude_types"]');
    check(`[${tag}] Alle umschalten zeigt alle`, (await text('[data-id="devices"] .set-sec-sum')) === `${T.sumInt1} · ${T.sumDisp}` && await ev(`return [...r.querySelectorAll('input[data-list="exclude_types"]')].every(i=>i.checked)`), await text('[data-id="devices"] .set-sec-sum'));
    await tap('input[data-list-all="exclude_types"]');
    check(`[${tag}] nochmals: alle ausgeblendet`, (await text('[data-id="devices"] .set-sec-sum')) === `${T.sumTypesAll} · ${T.sumDisp}` && await ev(`return [...r.querySelectorAll('input[data-list="exclude_types"]')].every(i=>!i.checked)`), await text('[data-id="devices"] .set-sec-sum'));
    await tap('dialog.settings .dlg-actions [data-set="close"]');
    // Integration wieder einblenden
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="devices"]');
    await tap('input[data-list="exclude_integrations"][data-value="zha"]');
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] gespeichert, Dialog offen, dann geschlossen`, await savedThenClose());
    check(`[${tag}] wieder eingeblendet`, await wait(`return r.querySelectorAll(".dev").length === 16`));

    // Überwachung und Meldungen (seit 0.34.0): Reiter "Ausfall" mit Zeitstrahl
    const tab = async (key) => { await tap(`[data-set="tab"][data-key="${key}"]`); await wait(`return r.querySelector('.mon-tab.on')?.dataset.key === "${key}"`); };
    const typeIn = async (sel, val) => {
      const h = (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
      if (mobile) await h.tap(); else await h.click();
      await h.fill("");
      if (val !== "") await h.type(val);
    };
    const sorted = (o) => JSON.stringify(Object.fromEntries(Object.entries(o || {}).sort()));
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    const order = await ev(`return [...r.querySelectorAll(".set-sec-head")].map(h=>h.dataset.id).join(",")`);
    check(`[${tag}] Abschnitte (notify-v3)`, order === "devices,monitor,look,ai,updates", order);
    check(`[${tag}] Überwachung und Meldungen zusammengefasst`, (await text('[data-id="monitor"] .set-sec-title')) === T.secMon && (await text('[data-id="monitor"] .set-sec-sum')) === T.sumMon(2), await text('[data-id="monitor"] .set-sec-sum'));
    await tap('[data-set="section"][data-id="monitor"]');
    check(`[${tag}] Reiter "Übersicht" zuerst`, await wait(`return r.querySelector('.mon-tab.on')?.dataset.key === "overview" && r.querySelectorAll(".lane").length === 5`));
    await tab("outage");
    check(`[${tag}] vier Zahlenfelder, zwei im Zeitstrahl`, (await ev(`return r.querySelectorAll('.set-sec-body input[type="number"]').length`)) === 4 && (await ev(`return [...r.querySelectorAll('.mtl input[type="number"]')].map(i=>i.dataset.opt).join()`)) === "offline_after,notify_delay");
    check(`[${tag}] Feld im Zeitstrahl mit Titel und Einheit`, (await text('.ptl-row:has(input[data-opt="offline_after"]) .ptl-head > b')) === T.offLabel && (await text('.ptl-row:has(input[data-opt="offline_after"]) .unit')) === T.unit);
    await typeIn('input[data-opt="offline_after"]', "0");
    check(`[${tag}] 0 ist ungültig`, await ev(`return r.querySelector('input[data-opt="offline_after"]').closest(".opt-input").classList.contains("bad")`) && (await text("[data-tl-error]")) === T.range, await text("[data-tl-error]"));
    check(`[${tag}] Speichern gesperrt bei Fehler, Reiter rot`, await ev(`return r.querySelector('[data-set="save"]').disabled && r.querySelector('.mon-tab[data-key="outage"]').classList.contains("err")`));
    check(`[${tag}] Zusammenfassung behält gespeicherten Wert`, (await text('[data-id="monitor"] .set-sec-sum')) === T.sumMon(2));
    await typeIn('input[data-opt="offline_after"]', "1");
    await (await f.evaluateHandle(new Function(`return ${R}.querySelector('input[data-opt="offline_after"]')`))).asElement().type("0");
    check(`[${tag}] Eingabe ohne Sprung: Fokus bleibt im Feld`, await ev(`return r.activeElement === r.querySelector('input[data-opt="offline_after"]') && r.activeElement.value === "10"`));
    // "Erst melden nach" (2) jetzt kürzer: Fehler an beiden Feldern (Aufgabe des Nutzers)
    check(`[${tag}] "Erst melden nach" kürzer: Fehler an beiden Feldern`, (await text("[data-tl-error]")) === T.delayShort(10) && await ev(`return ["offline_after","notify_delay"].every(k=>r.querySelector('.mtl input[data-opt="'+k+'"]').closest(".opt-input").classList.contains("bad")) && r.querySelector('[data-set="save"]').disabled`), await text("[data-tl-error]"));
    await typeIn('input[data-opt="notify_delay"]', "10");
    check(`[${tag}] gleich lang: gültig, beide geändert`, await ev(`return r.querySelector("[data-tl-error]").hidden && ["offline_after","notify_delay"].every(k=>{const b=r.querySelector('.mtl input[data-opt="'+k+'"]').closest(".opt-input"); return b.classList.contains("chg") && !b.classList.contains("bad")})`));
    check(`[${tag}] Zusammenfassung, Etikett, Zähler live`, (await text('[data-id="monitor"] .set-sec-sum')) === T.sumMon(10) && (await text('[data-id="monitor"] .set-badge')) === T.changed && (await text(".set-count")) === T.two && !(await ev(`return r.querySelector('[data-set="save"]').disabled`)) && await ev(`return r.querySelector('.mon-tab[data-key="outage"]').classList.contains("chg")`), await text('[data-id="monitor"] .set-sec-sum'));
    // Instabil ab 50: die instabilen Geräte fallen aus der Gruppe
    const flakyBefore = await ev(`return r.querySelectorAll(".dev.flaky").length`);
    const flakyWant = await p.evaluate(() => window.__devices.filter((d) => !d.disabled && !d.service && d.entities > 0 && d.online && d.avail24 && d.avail24.outages >= 50).length);
    await typeIn('input[data-opt="flaky_outages"]', "50");
    await p.screenshot({ path: `${outDir}/settings-outage-${tag.replace("/", "-")}.png` });
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] gespeichert als Zahlen`, await savedThenClose() && sorted((await calls("device_panel/set_options")).at(-1).values) === sorted({ offline_after: 10, flaky_outages: 50, notify_delay: 10 }), JSON.stringify((await calls("device_panel/set_options")).at(-1)?.values));
    check(`[${tag}] Liste neu: instabil ab 50`, await wait(`return r.querySelectorAll(".dev.flaky").length === ${flakyWant}`) && flakyBefore > 0 && flakyWant === 0, `${flakyBefore} → ${await ev(`return r.querySelectorAll(".dev.flaky").length`)}, erwartet ${flakyWant}`);

    // Anzeige: deaktivierte Geräte als eigene Gruppe am Ende
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    check(`[${tag}] Erkennung nach Speichern`, (await text('[data-id="monitor"] .set-sec-sum')) === T.sumMon(10));
    check(`[${tag}] Anzeige zusammengefasst`, (await text('[data-id="devices"] .set-sec-title')) === T.secDev && (await text('[data-id="devices"] .set-sec-sum')) === T.sumDisp);
    await tap('[data-set="section"][data-id="devices"]');
    await tap('.switch input[data-opt="show_disabled_devices"]');
    check(`[${tag}] Anzeige live`, (await text('[data-id="devices"] .set-sec-sum')) === T.sumDispDis);
    await tap('.switch input[data-opt="show_service_devices"]');
    check(`[${tag}] Anzeige live, beide`, (await text('[data-id="devices"] .set-sec-sum')) === T.sumDispBoth);
    await p.screenshot({ path: `${outDir}/settings-detection-${tag.replace("/", "-")}.png` });
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] gespeichert, Dialog offen, dann geschlossen`, await savedThenClose());
    check(`[${tag}] Gruppe Deaktiviert`, await wait(`return [...r.querySelectorAll(".dev")].some(e=>e.textContent.includes("Alte Lampe"))`) && (await ev(`const g=[...r.querySelectorAll("tr.grp, .gh")].pop(); return g.className.includes(" d") && g.textContent.includes(${JSON.stringify(T.grpDis)})`)), await ev(`return [...r.querySelectorAll("tr.grp, .gh")].map(g=>g.className+":"+g.textContent.trim()).join(" | ")`));
    check(`[${tag}] Status Deaktiviert`, (await ev(`const e=[...r.querySelectorAll(".dev")].find(e=>e.textContent.includes("Alte Lampe")); return e.querySelector(".pill.none")?.textContent`)) === T.grpDis);
    // Popup des deaktivierten Geräts: Status und deaktivierte Entitäten
    const dis = await p.evaluate(() => window.__devices.find((d) => d.disabled).id);
    await tap(`.dev[data-open="${dis}"]`);
    check(`[${tag}] Popup deaktiviert`, await wait(`return r.querySelector("dialog.device")?.open && r.querySelector("dialog.device .dlg-sub .pill.none")?.textContent === ${JSON.stringify(T.grpDis)}`), await text("dialog.device .dlg-sub"));
    await tap('dialog.device [data-dlg="close"]');
    await wait(`return !r.querySelector("dialog.device").open`);
    check(`[${tag}] Dienst-Gerät gezeigt`, await ev(`return [...r.querySelectorAll(".dev")].some(e=>e.textContent.includes("Wetterdienst"))`));
    // 16 + Dienst-Gerät; das deaktivierte zählt im Kopf nicht.
    check(`[${tag}] Kopf zählt Deaktivierte nicht`, (await text(".ring .c span")).includes(T.ofTotal), await text(".ring .c span"));
    await tap("[data-problems]");
    check(`[${tag}] Warnungen ohne Deaktivierte`, !(await ev(`return [...r.querySelectorAll(".dev")].some(e=>e.textContent.includes("Alte Lampe"))`)));
    await tap("[data-problems]");
    await ev(`[...r.querySelectorAll(".dev")].find(e=>e.textContent.includes("Alte Lampe")).scrollIntoView({ block: "center" })`);
    await p.screenshot({ path: `${outDir}/list-disabled-${tag.replace("/", "-")}.png` });

    // Zurück auf die Standards (erst "Erst melden nach", dann "Ausgefallen nach")
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await tab("outage");
    for (const [key, val] of [["offline_after", "2"], ["notify_delay", "2"], ["flaky_outages", "3"]]) await typeIn(`input[data-opt="${key}"]`, val);
    await tap('[data-set="section"][data-id="devices"]');
    await tap('.switch input[data-opt="show_disabled_devices"]');
    await tap('.switch input[data-opt="show_service_devices"]');
    check(`[${tag}] fünf Änderungen`, (await text(".set-count")) === T.five, await text(".set-count"));
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] gespeichert, Dialog offen, dann geschlossen`, await savedThenClose());
    check(`[${tag}] Standards wieder`, await wait(`return r.querySelectorAll(".dev").length === 16`) && JSON.stringify(await p.evaluate(() => [window.__opts.offline_after, window.__opts.notify_delay, window.__opts.flaky_outages, window.__opts.show_disabled_devices, window.__opts.show_service_devices])) === "[2,2,3,false,false]");

    // Batterie und Ziel: Reiter "Batterie" und "Übersicht"
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await tab("battery");
    await tap('.switch input[data-opt="battery_push"]');
    check(`[${tag}] Hinweis: Push braucht ein Ziel`, (await text(".opt-warn")) === T.noTarget, await text(".opt-warn"));
    await tap('.switch input[data-opt="battery_persistent"]');
    await typeIn('input[data-opt="battery_low"]', "25");
    check(`[${tag}] Batterie live (ohne Ziel kein Push)`, (await text('[data-id="monitor"] .set-sec-sum')) === T.sumMon(2, null, 25), await text('[data-id="monitor"] .set-sec-sum'));
    await tab("overview");
    const opts = await ev(`return [...r.querySelectorAll('select[data-opt="notify_service"] option')].map(o=>o.textContent)`);
    check(`[${tag}] Push-Ziele mit Beschriftung`, opts.length === 4 && opts[0] === T.notifyNone && opts[3] === T.entity, JSON.stringify(opts));
    check(`[${tag}] Übersicht: Hinweis ohne Ziel`, (await text(".opt-warn")) === T.noTarget, await text(".opt-warn"));
    const sel = (await f.evaluateHandle(new Function(`return ${R}.querySelector('select[data-opt="notify_service"]')`))).asElement();
    await sel.selectOption("notify.mobile_app_testhandy");
    check(`[${tag}] Ziel gewählt: Hinweis weg, Zusammenfassung`, await wait(`return !r.querySelector(".opt-warn")`) && (await text('[data-id="monitor"] .set-sec-sum')) === T.sumMon(2, null, 25, T.instant), await text('[data-id="monitor"] .set-sec-sum'));
    check(`[${tag}] Übersicht: Batterie-Zeitstrahl "bis 25 %", Push sofort`, (await text('[data-lane="battery"] .mtl-bar + .mtl-mk b')) === T.tlLow(25) && (await text('[data-lane="battery"] .mk-p b')) === T.tlInstant, await text('[data-lane="battery"] .mtl'));
    const click = (await f.evaluateHandle(new Function(`return ${R}.querySelector('select[data-opt="notify_click_target"]')`))).asElement();
    await click.selectOption("device");
    check(`[${tag}] fünf Änderungen`, (await text(".set-count")) === T.five, await text(".set-count"));
    await p.screenshot({ path: `${outDir}/settings-battery-${tag.replace("/", "-")}.png` });
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] Batterie und Push gespeichert`, await savedThenClose() && sorted((await calls("device_panel/set_options")).at(-1).values) === sorted({ battery_low: 25, battery_push: true, battery_persistent: true, notify_service: "notify.mobile_app_testhandy", notify_click_target: "device" }), JSON.stringify((await calls("device_panel/set_options")).at(-1)?.values));
    check(`[${tag}] Liste mit neuer Schwelle`, await wait(`return r.querySelector('.chip.hint[data-hint="battery"] .n')?.textContent === "3"`), await text('.chip.hint[data-hint="battery"] .n'));
    // Zurück
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await tab("battery");
    await typeIn('input[data-opt="battery_low"]', "15");
    await tap('.switch input[data-opt="battery_push"]');
    await tap('.switch input[data-opt="battery_persistent"]');
    await tab("overview");
    await (await f.evaluateHandle(new Function(`return ${R}.querySelector('select[data-opt="notify_service"]')`))).asElement().selectOption("none");
    await (await f.evaluateHandle(new Function(`return ${R}.querySelector('select[data-opt="notify_click_target"]')`))).asElement().selectOption("panel");
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] Batterie und Push zurück`, await savedThenClose() && JSON.stringify(await p.evaluate(() => [window.__opts.battery_low, window.__opts.battery_push, window.__opts.battery_persistent, window.__opts.notify_service, window.__opts.notify_click_target])) === JSON.stringify([15, false, false, "none", "panel"]) && await wait(`return r.querySelector('.chip.hint[data-hint="battery"] .n')?.textContent === "2"`));

    // Batterie: Zeitpunkt (sofort/täglich), Uhrzeit, Inhalt der Tagesmeldung;
    // Ausfall: Push, wieder online, Sammelausfall
    const pick = async (sel, value) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement().selectOption(value);
    const timeIn = async (val) => {
      const h = (await f.evaluateHandle(new Function(`return ${R}.querySelector('input[type="time"][data-opt="battery_push_time"]')`))).asElement();
      if (mobile) await h.tap(); else await h.click();
      await h.fill(val);
    };
    const short = (key) => ev(`const o=r.querySelector('[data-opt="${key}"]').closest(".opt").querySelector("[data-short]"); return o.className + "|" + o.textContent`);
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await tab("battery");
    check(`[${tag}] Zeitpunkt erst mit Push`, !(await ev(`return !!r.querySelector('select[data-opt="battery_push_mode"]')`)));
    await tap('.switch input[data-opt="battery_push"]');
    check(`[${tag}] Zeitpunkt sofort`, await wait(`return r.querySelector('select[data-opt="battery_push_mode"]')?.value === "instant"`) && !(await ev(`return !!r.querySelector('input[type="time"]') || !!r.querySelector('select[data-opt="battery_push_daily"]')`)) && (await short("battery_push_mode")) === `opt-short|${T.shortInstant}`, await short("battery_push_mode"));
    const modeSel = (await f.evaluateHandle(new Function(`return ${R}.querySelector('select[data-opt="battery_push_mode"]')`))).asElement();
    await modeSel.focus();
    await modeSel.selectOption("daily");
    await wait(`return !!r.querySelector('input[type="time"]')`);
    // Neuaufbau nach der Wahl: auf dem Handy keine fokussierte Auswahl (iOS
    // öffnete sie sofort wieder), am Desktop bleibt der Fokus.
    const focused = await ev(`const a=r.activeElement; return a ? a.tagName + ":" + (a.dataset.opt || "") : "none"`);
    check(`[${tag}] Fokus nach Wahl`, mobile ? !focused.startsWith("SELECT") : focused === "SELECT:battery_push_mode", focused);
    check(`[${tag}] täglich: Uhrzeit 08:00, Inhalt neu`, await wait(`return r.querySelector('input[type="time"][data-opt="battery_push_time"]')?.value === "08:00" && r.querySelector('select[data-opt="battery_push_daily"]')?.value === "new"`) && (await short("battery_push_mode")) === `opt-short|${T.shortDaily("08:00")}`, await short("battery_push_mode"));
    if (!mobile) {
      // Breit genug für "08:00 AM" (Format des Browsers) und neben der Auswahl
      const tops = await ev(`return [r.querySelector('select[data-opt="battery_push_mode"]'), r.querySelector('input[type="time"]')].map(e=>Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2))`);
      check(`[${tag}] Auswahl und Uhrzeit in einer Zeile`, Math.abs(tops[0] - tops[1]) <= 3, JSON.stringify(tops));
    }
    await timeIn("");
    check(`[${tag}] leere Uhrzeit: Fehler, Speichern gesperrt`, (await short("battery_push_mode")) === `opt-error|${T.timeErr}` && await ev(`const o=r.querySelector('select[data-opt="battery_push_mode"]').closest(".opt"); return o.classList.contains("invalid") && r.querySelector('[data-set="save"]').disabled`), await short("battery_push_mode"));
    await timeIn("06:45");
    check(`[${tag}] Uhrzeit gültig: Kurzzeile, Fokus bleibt`, (await short("battery_push_mode")) === `opt-short|${T.shortDaily("06:45")}` && await ev(`return r.activeElement === r.querySelector('input[type="time"]') && r.querySelector('select[data-opt="battery_push_mode"]').closest(".opt").classList.contains("changed")`), await short("battery_push_mode"));
    await pick('select[data-opt="battery_push_daily"]', "all");
    check(`[${tag}] Inhalt alle`, await wait(`return r.querySelector('select[data-opt="battery_push_daily"]')?.value === "all"`) && (await ev(`const s=r.querySelector('select[data-opt="battery_push_daily"]'); return s.options[s.selectedIndex].textContent`)) === T.dailyAll && (await ev(`return r.querySelector('input[type="time"]').value`)) === "06:45");
    await tab("overview");
    await pick('select[data-opt="notify_service"]', "notify.mobile_app_testhandy");
    check(`[${tag}] Zusammenfassung: Batterie täglich, Ausfall ohne Push`, await wait(`return r.querySelector('[data-id="monitor"] .set-sec-sum')?.textContent === ${JSON.stringify(T.sumMon(2, null, 15, T.daily("06:45")))}`), await text('[data-id="monitor"] .set-sec-sum'));
    check(`[${tag}] Übersicht: Batterie täglich 06:45, alle schwachen`, (await text('[data-lane="battery"] .mk-p b')) === T.tlDaily("06:45") && (await text('[data-lane="battery"] .mk-p span')) === T.tlDailyAll, await text('[data-lane="battery"] .mtl'));
    await tab("outage");
    check(`[${tag}] Ausfall: Kurzzeile`, (await short("notify_outage")) === `opt-short|${T.outageShort}`, await short("notify_outage"));
    check(`[${tag}] Standard: Ausfall und Online aus, Sammelausfall an`, (await ev(`return ["notify_outage","notify_online","notify_group"].map(k=>r.querySelector('input[data-opt="'+k+'"]').checked).join()`)) === "false,false,true");
    await tap('.switch input[data-opt="notify_outage"]');
    await tap('.switch input[data-opt="notify_online"]');
    await tap('.switch input[data-opt="notify_group"]');
    check(`[${tag}] Push: Zusammenfassung mit Ausfall, acht Änderungen`, (await text('[data-id="monitor"] .set-sec-sum')) === T.sumMon(2, 2, 15, T.daily("06:45")) && (await text(".set-count")) === T.eight, `${await text('[data-id="monitor"] .set-sec-sum')} / ${await text(".set-count")}`);
    await p.screenshot({ path: `${outDir}/settings-notify-${tag.replace("/", "-")}.png` });
    await tap('dialog.settings [data-set="save"]');
    const expect = { battery_push: true, battery_push_daily: "all", battery_push_mode: "daily", battery_push_time: "06:45", notify_group: false, notify_online: true, notify_outage: true, notify_service: "notify.mobile_app_testhandy" };
    check(`[${tag}] Zeitpunkt und Meldungen gespeichert`, await savedThenClose() && sorted((await calls("device_panel/set_options")).at(-1).values) === sorted(expect), JSON.stringify((await calls("device_panel/set_options")).at(-1)?.values));
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    check(`[${tag}] nach Speichern: Zusammenfassung`, (await text('[data-id="monitor"] .set-sec-sum')) === T.sumMon(2, 2, 15, T.daily("06:45")), await text('[data-id="monitor"] .set-sec-sum'));
    // Zurück: Uhrzeit, Inhalt, sofort, Push aus, Meldungen wie vorher
    await tap('[data-set="section"][data-id="monitor"]');
    await tab("battery");
    await timeIn("08:00");
    await pick('select[data-opt="battery_push_daily"]', "new");
    await wait(`return r.querySelector('select[data-opt="battery_push_daily"]')?.value === "new"`);
    await pick('select[data-opt="battery_push_mode"]', "instant");
    check(`[${tag}] sofort: Uhrzeit und Inhalt weg`, await wait(`return !r.querySelector('input[type="time"]') && !r.querySelector('select[data-opt="battery_push_daily"]')`) && (await text('[data-id="monitor"] .set-sec-sum')) === T.sumMon(2, 2, 15, T.instant), await text('[data-id="monitor"] .set-sec-sum'));
    await tap('.switch input[data-opt="battery_push"]');
    await tab("outage");
    await tap('.switch input[data-opt="notify_outage"]');
    await tap('.switch input[data-opt="notify_online"]');
    check(`[${tag}] ohne Arten`, (await text('[data-id="monitor"] .set-sec-sum')) === T.sumMon(2), await text('[data-id="monitor"] .set-sec-sum'));
    await tap('.switch input[data-opt="notify_group"]');
    await tab("overview");
    await pick('select[data-opt="notify_service"]', "none");
    await wait(`return r.querySelector('select[data-opt="notify_service"]')?.value === "none"`);
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] Zeitpunkt und Meldungen zurück`, await savedThenClose() && JSON.stringify(await p.evaluate(() => ["battery_push", "battery_push_mode", "battery_push_time", "battery_push_daily", "notify_service", "notify_outage", "notify_online", "notify_group"].map((k) => window.__opts[k]))) === JSON.stringify([false, "instant", "08:00", "new", "none", false, false, true]), JSON.stringify(await p.evaluate(() => window.__opts)));

    // Batterie pro Integration: im Reiter "Integrationen", je Integration
    // (seit 0.34.0; Auswahl wie im Geräte-Popup, Variante B aus battery-v2)
    const mode = async (dom, value) => {
      const h = (await f.evaluateHandle(new Function(`return ${R}.querySelector('select[data-bat-mode="${dom}"]')`))).asElement();
      await h.scrollIntoViewIfNeeded();
      if (mobile) await h.tap(); else await h.click();
      await h.selectOption(value);
      await wait(`return r.querySelector('select[data-bat-mode="${dom}"]')?.value === ${JSON.stringify(value)}`);
    };
    const integ = async (dom) => { await tap(`[data-set="integ"][data-key="${dom}"]`); await wait(`return !!r.querySelector('[data-imon="${dom}"]')`); };
    const back = async () => { await tap('[data-set="integ"][data-key=""]'); await wait(`return !!r.querySelector(".ilist")`); };
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await tab("integ");
    check(`[${tag}] Liste: ZHA mit Batterie`, (await text('.ilist-row[data-key="zha"] .ilist-name small')) === T.zhaBat, await text('.ilist-row[data-key="zha"] .ilist-name small'));
    await integ("matter");
    check(`[${tag}] Auswahl wie im Geräte-Popup, kein Feld`, (await ev(`return [...r.querySelector('select[data-bat-mode="matter"]').options].map(o=>o.textContent).join("|")`)) === T.batModes && !(await ev(`return !!r.querySelector("input[data-bat]")`)));
    // Eigene Schwelle: Feld erscheint mit dem globalen Wert
    await mode("matter", "own");
    check(`[${tag}] eigene Schwelle: Feld mit globalem Wert`, (await ev(`return r.querySelector('input[data-bat="matter"]')?.value`)) === "15" && (await text(".set-count")) === T.one);
    await typeIn('input[data-bat="matter"]', "60");
    check(`[${tag}] 60 ist ungültig`, await ev(`return r.querySelector('input[data-bat="matter"]').closest(".opt").classList.contains("invalid")`) && (await text("[data-bat-error]")) === T.rangeBat && await ev(`return r.querySelector('[data-set="save"]').disabled && r.querySelector('.mon-tab[data-key="integ"]').classList.contains("err")`));
    await typeIn('input[data-bat="matter"]', "");
    check(`[${tag}] leer ist ungültig`, await ev(`return r.querySelector('input[data-bat="matter"]').closest(".opt").classList.contains("invalid") && r.querySelector('[data-set="save"]').disabled`));
    await typeIn('input[data-bat="matter"]', "25");
    check(`[${tag}] gültig: Zähler, Fokus bleibt`, (await text(".set-count")) === T.one && await ev(`return r.querySelector("[data-bat-error]").hidden && r.activeElement === r.querySelector('input[data-bat="matter"]')`), await text(".set-count"));
    if (mobile) {
      const lay = await ev(`const d=r.querySelector("dialog.settings"); const row=r.querySelector('select[data-bat-mode="matter"]').closest(".opt").getBoundingClientRect(); const i=r.querySelector('input[data-bat="matter"]').closest(".opt-input").getBoundingClientRect(); return [d.scrollWidth <= d.clientWidth, i.right <= row.right + 1]`);
      check(`[${tag}] Handy: Auswahl und Feld ohne Überlauf`, lay.every(Boolean), JSON.stringify(lay));
    }
    await back();
    // BTHome aus
    await integ("bthome");
    await mode("bthome", "off");
    check(`[${tag}] aus: kein Feld, Etikett eigen`, !(await ev(`return !!r.querySelector('input[data-bat="bthome"]')`)) && (await ev(`return r.querySelector('select[data-bat-mode="bthome"]').closest(".opt").querySelector(".origin").textContent`)) === T.own && (await text(".set-count")) === T.one);
    await p.screenshot({ path: `${outDir}/settings-battery-own-${tag.replace("/", "-")}.png` });
    await back();
    check(`[${tag}] Liste: Matter 25 %, BTHome aus`, (await text('.ilist-row[data-key="matter"] .ilist-diff')) === T.diffBat25 && (await text('.ilist-row[data-key="bthome"] .ilist-diff')) === T.diffBatOff, `${await text('.ilist-row[data-key="matter"] .ilist-diff')} / ${await text('.ilist-row[data-key="bthome"] .ilist-diff')}`);
    // Globaler Wert folgt in der Auswahl
    await tab("battery");
    await typeIn('input[data-opt="battery_low"]', "20");
    await tab("integ");
    await integ("zha");
    check(`[${tag}] globaler Wert folgt`, (await ev(`return r.querySelector('select[data-bat-mode="zha"] option[value="default"]').textContent`)) === T.batDef(20));
    await back();
    await tab("battery");
    await typeIn('input[data-opt="battery_low"]', "15");
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] eigene Schwelle und aus gespeichert`, await savedThenClose() && JSON.stringify((await calls("device_panel/set_options")).at(-1).values) === JSON.stringify({ battery_low_integrations: { matter: 25, bthome: "off" } }), JSON.stringify((await calls("device_panel/set_options")).at(-1)?.values));
    // Matter-Gerät mit 22 % jetzt schwach, BTHome-Gerät (0 %) nicht mehr
    const lowIds = () => ev(`return r.host._devices.filter((d) => d.battery?.low).map((d) => d.id).sort().join()`);
    check(`[${tag}] Liste: schwach sind jetzt Matter (22 %) und Zigbee (8 %), nicht BTHome (0 %)`, await wait(`return r.host._devices.filter((d) => d.battery?.low).map((d) => d.id).sort().join() === "b,c"`), await lowIds());
    // Geräte-Popup des BTHome-Geräts: globaler Wert ist "aus"
    await tap('.dev[data-open="a"]');
    await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device [data-tab="set"]')`);
    await tap('dialog.device [data-tab="set"]');
    await wait(`return r.querySelector('select[data-dlg="dev-bat"]')`);
    check(`[${tag}] Popup: globaler Wert aus`, (await ev(`return r.querySelector('select[data-dlg="dev-bat"] option[value="default"]').textContent`)) === T.popDefOff);
    await tap('dialog.device [data-dlg="close"]');
    await wait(`return !r.querySelector("dialog.device").open`);
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await tab("integ");
    check(`[${tag}] nach Speichern: Filter "Abweichend 2"`, (await text('[data-set="ifilter"][data-key="own"]')) === T.filterOwn2);
    // Zurück auf den globalen Wert: "Alles auf Standard" und Auswahl
    await integ("matter");
    check(`[${tag}] Werte stehen`, (await ev(`return r.querySelector('select[data-bat-mode="matter"]').value + ":" + r.querySelector('input[data-bat="matter"]').value`)) === "own:25");
    await back();
    // "Alle zurücksetzen" (1.0.0): alle Abweichungen der Integrationen auf einmal
    check(`[${tag}] Alle zurücksetzen aktiv`, await ev(`return !r.querySelector('[data-set="integ-reset-all"]').disabled`));
    await tap('[data-set="integ-reset-all"]');
    check(`[${tag}] Alle zurücksetzen: Entwurf leer, Knopf gesperrt, Filter "Abweichend 0"`, (await text('[data-set="ifilter"][data-key="own"]')) === T.filterOwn0 && await ev(`const d=r.host._settings.draft; return Object.keys(d.battery_low_integrations).length===0 && r.querySelector('[data-set="integ-reset-all"]').disabled`));
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] globaler Wert, gespeichert`, await savedThenClose() && JSON.stringify((await calls("device_panel/set_options")).at(-1).values) === JSON.stringify({ battery_low_integrations: {} }) && await wait(`return r.host._devices.filter((d) => d.battery?.low).map((d) => d.id).sort().join() === "a,b"`), await lowIds());

    // Fehler beim Speichern: Meldung, Dialog bleibt
    await p.evaluate(() => { window.__setOptsFails = "Keine Berechtigung"; });
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="updates"]');
    await tap('.switch input[data-opt="update_check"]');
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] Speicherfehler angezeigt`, await wait(`return (r.querySelector("dialog.settings .dlg-error")?.textContent || "").includes("Keine Berechtigung")`) && (await text("dialog.settings .dlg-error")).startsWith(T.saveErr) && await isOpen());
    await p.evaluate(() => { window.__setOptsFails = null; });
    await tap('dialog.settings .dlg-head [data-set="close"]');

    // Fehler beim Laden
    await p.evaluate(() => { window.__getOptsFails = true; });
    await tap(".gear-btn");
    check(`[${tag}] Ladefehler angezeigt`, await wait(`return (r.querySelector("dialog.settings .dlg-error")?.textContent || "").startsWith(${JSON.stringify(T.loadErr)})`));
    check(`[${tag}] Speichern bei Ladefehler gesperrt`, await ev(`return r.querySelector('[data-set="save"]').disabled`));
    await p.evaluate(() => { window.__getOptsFails = false; });
    await tap('dialog.settings .dlg-head [data-set="close"]');

    check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
    const page = await ev(`return document.documentElement.scrollWidth - innerWidth`);
    check(`[${tag}] kein Überlauf der Seite`, page <= 1, String(page));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
