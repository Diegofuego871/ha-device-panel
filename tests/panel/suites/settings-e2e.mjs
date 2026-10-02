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
    gear: "Einstellungen", title: "Einstellungen", sub: "Device Panel · gilt für alle Benutzer", sec: "Updates",
    sumOn: "Tägliche Prüfung · neue Version unter \"Reparaturen\"", sumOff: "Keine automatische Prüfung",
    opt: "Täglich nach Updates suchen", short: "Meldet eine neue Version unter Einstellungen → Reparaturen.", info: "Fragt einmal täglich",
    changed: "geändert", one: "1 Änderung", two: "2 Änderungen", save: "Speichern", cancel: "Abbrechen", saved: "Einstellungen gespeichert.",
    pre: "Vorabversionen anzeigen", loadErr: "Einstellungen konnten nicht geladen werden:", saveErr: "Speichern fehlgeschlagen:", ver: "Device Panel 0.4.0",
    secInt: "Integrationen", sumInt: "9 Integrationen · alle angezeigt", sumInt1: "9 Integrationen · 1 ausgeblendet", show: "Anzeigen", all: "Alle umschalten",
    zha: "Zigbee Home Automation", zhaSub: "5 Geräte", secTypes: "Gerätetypen", outlet: "Steckdose", sumTypes1: "11 Typen · 1 ausgeblendet", sumTypesNone: "11 Typen · alle angezeigt", sumTypesAll: "11 Typen · 11 ausgeblendet",
    secDet: "Ausfall-Erkennung", sumDet: (m, n) => `Ausgefallen nach ${m} Min. · instabil ab ${n} Unterbrüchen in 24 Std. · Anlaufphase 5 Min.`,
    offLabel: "Ausgefallen nach", offShort: "Minuten ohne Lebenszeichen. Kürzere Aussetzer zählen nicht.", unit: "Min.", range: "Erlaubt: 1 bis 60",
    secDisp: "Anzeige", sumDisp: "Dienst-Geräte und deaktivierte Geräte ausgeblendet", sumDispDis: "Dienst-Geräte ausgeblendet · deaktivierte angezeigt",
    sumDispBoth: "Dienst-Geräte und deaktivierte Geräte angezeigt", grpDis: "Deaktiviert", ofTotal: "von 17", four: "4 Änderungen", five: "5 Änderungen",
    sumBatOff: "Schwach ab 15 % · keine Meldung", sumBatBoth: "Schwach ab 25 % · Push und anhaltende Benachrichtigung",
    noTarget: "Zuerst unter \"Push-Benachrichtigung\" ein Ziel wählen.", sumPushNone: "Kein Ziel gewählt",
    sumPush: "notify.mobile_app_testhandy · meldet schwache Batterie", notifyNone: "Kein Ziel (keine Push-Meldungen)", entity: "notify.fernseher (Entität)",
    batTitle: "Eigene Schwelle pro Integration", batZha: "3 Geräte mit Batterie · schwächste 8\u00a0%", rangeBat: "Erlaubt: 5 bis 50",
    sumBatOwn: "Schwach ab 15 %, Matter 25 % · keine Meldung", batLowShort: "Bis zu diesem Stand rot markiert und unter \"Nur Probleme\".",
    shortInstant: "Sobald ein Gerät unter die Schwelle fällt.", shortDaily: (t) => `Eine Sammelmeldung um ${t}. Ausfälle kommen immer sofort.`, timeErr: "Uhrzeit HH:MM",
    sumBatDaily: (t) => `Schwach ab 15 % · nur Push (täglich ${t})`, sumBatInstant: "Schwach ab 15 % · nur Push", dailyAll: "Alle schwachen Geräte",
    sumPushAll: "notify.mobile_app_testhandy · meldet Ausfall, wieder online, schwache Batterie", sumPushNoKind: "notify.mobile_app_testhandy · keine Meldung eingeschaltet",
    outageShort: "Sofort, sobald ein Gerät als ausgefallen gilt (nach 2 Min. ohne Lebenszeichen).", eight: "8 Änderungen",
  },
  en: {
    gear: "Settings", title: "Settings", sub: "Device Panel · applies to all users", sec: "Updates",
    sumOn: "Daily check · new version under \"Repairs\"", sumOff: "No automatic check",
    opt: "Check for updates daily", short: "Reports a new version under Settings → Repairs.", info: "Queries the published releases",
    changed: "changed", one: "1 change", two: "2 changes", save: "Save", cancel: "Cancel", saved: "Settings saved.",
    pre: "Show pre-releases", loadErr: "Could not load the settings:", saveErr: "Saving failed:", ver: "Device Panel 0.4.0",
    secInt: "Integrations", sumInt: "9 integrations · all shown", sumInt1: "9 integrations · 1 hidden", show: "Show", all: "Toggle all",
    zha: "Zigbee Home Automation", zhaSub: "5 devices", secTypes: "Device types", outlet: "Outlet", sumTypes1: "11 types · 1 hidden", sumTypesNone: "11 types · all shown", sumTypesAll: "11 types · 11 hidden",
    secDet: "Outage detection", sumDet: (m, n) => `Offline after ${m} min · unstable from ${n} outages in 24 h · grace period 5 min`,
    offLabel: "Offline after", offShort: "Minutes without a sign of life. Shorter dropouts are not counted.", unit: "min", range: "Allowed: 1 to 60",
    secDisp: "Display", sumDisp: "Service devices and disabled devices hidden", sumDispDis: "Service devices hidden · disabled shown",
    sumDispBoth: "Service devices and disabled devices shown", grpDis: "Disabled", ofTotal: "of 17", four: "4 changes", five: "5 changes",
    sumBatOff: "Low from 15 % · no notification", sumBatBoth: "Low from 25 % · push and persistent notification",
    noTarget: "First choose a target under \"Push notification\".", sumPushNone: "No target chosen",
    sumPush: "notify.mobile_app_testhandy · notifies on low battery", notifyNone: "No target (no push notifications)", entity: "notify.fernseher (entity)",
    batTitle: "Own threshold per integration", batZha: "3 devices with battery · weakest 8\u00a0%", rangeBat: "Allowed: 5 to 50",
    sumBatOwn: "Low from 15 %, Matter 25 % · no notification", batLowShort: "Up to this level marked red and listed under \"Problems only\".",
    shortInstant: "As soon as a device drops below the threshold.", shortDaily: (t) => `One summary at ${t}. Outages are always reported immediately.`, timeErr: "Time HH:MM",
    sumBatDaily: (t) => `Low from 15 % · push only (daily ${t})`, sumBatInstant: "Low from 15 % · push only", dailyAll: "All devices with a low battery",
    sumPushAll: "notify.mobile_app_testhandy · notifies on outage, back online, low battery", sumPushNoKind: "notify.mobile_app_testhandy · no notification switched on",
    outageShort: "Immediately as soon as a device counts as offline (after 2 min without a sign of life).", eight: "8 changes",
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
    check(`[${tag}] Speichern gesperrt ohne Änderung`, await ev(`return r.querySelector('[data-set="save"]').disabled`) && (await text(".set-count")) === "");
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
    check(`[${tag}] Entwurf: Etikett, Zähler, Zusammenfassung`, (await text('[data-id="updates"] .set-sec-title .set-badge')) === T.changed && (await text(".set-count")) === T.one && (await text('[data-id="updates"] .set-sec-sum')) === T.sumOff);
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
    check(`[${tag}] gespeichert und geschlossen`, await wait(`return !r.querySelector("dialog.settings").open`));
    const so = await calls("device_panel/set_options");
    const sp = await calls("device_panel/set_panel");
    check(`[${tag}] set_options nur mit der Änderung`, so.length === 1 && JSON.stringify(so[0].values) === JSON.stringify({ update_check: false }), JSON.stringify(so));
    check(`[${tag}] set_panel mit Vorabversionen`, sp.length === 1 && sp[0].prerelease === true, JSON.stringify(sp));
    check(`[${tag}] Rückmeldung`, (await ev(`const t=r.querySelector(".toast"); return t.hidden ? "" : t.textContent`)) === T.saved);
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

    // Ausschlüsse: Integration ausblenden, Liste ohne ihre Geräte
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    check(`[${tag}] Abschnitt Integrationen`, (await text('[data-id="integrations"] .set-sec-title')) === T.secInt && (await text('[data-id="integrations"] .set-sec-sum')) === T.sumInt, await text('[data-id="integrations"] .set-sec-sum'));
    await tap('[data-set="section"][data-id="integrations"]');
    const zhaRow = await ev(`const i=r.querySelector('input[data-list="exclude_integrations"][data-value="zha"]'); return i ? i.closest(".ex-row").textContent.replace(/\\s+/g," ").trim() : ""`);
    check(`[${tag}] Zeile mit Name und Zahl der Geräte`, zhaRow.includes(T.zha) && zhaRow.includes(T.zhaSub), zhaRow);
    check(`[${tag}] Spalte "${T.show}" und "${T.all}"`, (await text(".ex-head")) === T.show && (await text(".ex-all .ex-name")) === T.all);
    await tap('input[data-list="exclude_integrations"][data-value="zha"]');
    check(`[${tag}] Integration im Entwurf ausgeblendet`, (await text('[data-id="integrations"] .set-sec-sum')) === T.sumInt1 && (await text(".set-count")) === T.one && await ev(`return r.querySelector('input[data-value="zha"]').closest(".ex-row").classList.contains("off")`));
    await p.screenshot({ path: `${outDir}/settings-exclude-${lang}-${mobile ? "mobile" : "desktop"}.png` });
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] gespeichert`, await wait(`return !r.querySelector("dialog.settings").open`));
    check(`[${tag}] set_options mit Ausschluss`, JSON.stringify((await calls("device_panel/set_options")).at(-1)?.values) === JSON.stringify({ exclude_integrations: ["zha"] }));
    check(`[${tag}] Liste ohne Zigbee-Geräte`, await wait(`return r.querySelectorAll(".dev").length === 11`), String(await ev(`return r.querySelectorAll(".dev").length`)));

    // Gerätetypen: einzeln und "Alle umschalten", dann Abbrechen
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="types"]');
    check(`[${tag}] Abschnitt Gerätetypen`, (await text('[data-id="types"] .set-sec-title')) === T.secTypes);
    await tap('input[data-list="exclude_types"][data-value="outlet"]');
    check(`[${tag}] Typ ausgeblendet`, (await text('[data-id="types"] .set-sec-sum')) === T.sumTypes1, await text('[data-id="types"] .set-sec-sum'));
    // Nicht alle an: "Alle umschalten" ist aus und zeigt beim Antippen alle.
    await tap('input[data-list-all="exclude_types"]');
    check(`[${tag}] Alle umschalten zeigt alle`, (await text('[data-id="types"] .set-sec-sum')) === T.sumTypesNone && await ev(`return [...r.querySelectorAll('input[data-list="exclude_types"]')].every(i=>i.checked)`), await text('[data-id="types"] .set-sec-sum'));
    await tap('input[data-list-all="exclude_types"]');
    check(`[${tag}] nochmals: alle ausgeblendet`, (await text('[data-id="types"] .set-sec-sum')) === T.sumTypesAll && await ev(`return [...r.querySelectorAll('input[data-list="exclude_types"]')].every(i=>!i.checked)`), await text('[data-id="types"] .set-sec-sum'));
    await tap('dialog.settings .dlg-actions [data-set="close"]');
    // Integration wieder einblenden
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="integrations"]');
    await tap('input[data-list="exclude_integrations"][data-value="zha"]');
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] wieder eingeblendet`, await wait(`return r.querySelectorAll(".dev").length === 16`));

    // Ausfall-Erkennung: Zahlenfelder mit Prüfung, Zusammenfassung, Speichern
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    const order = await ev(`return [...r.querySelectorAll(".set-sec-head")].map(h=>h.dataset.id).join(",")`);
    check(`[${tag}] Abschnitte wie Bild 5`, order === "detection,battery,integrations,types,push,display,updates", order);
    check(`[${tag}] Ausfall-Erkennung zusammengefasst`, (await text('[data-id="detection"] .set-sec-title')) === T.secDet && (await text('[data-id="detection"] .set-sec-sum')) === T.sumDet(2, 3), await text('[data-id="detection"] .set-sec-sum'));
    await tap('[data-set="section"][data-id="detection"]');
    check(`[${tag}] drei Zahlenfelder`, (await ev(`return r.querySelectorAll('.set-sec-body input[type="number"]').length`)) === 3);
    check(`[${tag}] Feld mit Einheit und Kurzzeile`, (await text('.opt:has(input[data-opt="offline_after"]) .opt-label')) === T.offLabel && (await text('.opt:has(input[data-opt="offline_after"]) .unit')) === T.unit && (await text('.opt:has(input[data-opt="offline_after"]) .opt-short')) === T.offShort);
    const num = (await f.evaluateHandle(new Function(`return ${R}.querySelector('input[data-opt="offline_after"]')`))).asElement();
    if (mobile) await num.tap(); else await num.click();
    await num.fill("");
    await num.type("0");
    check(`[${tag}] 0 ist ungültig`, await ev(`return r.querySelector('input[data-opt="offline_after"]').closest(".opt").classList.contains("invalid")`) && (await text('.opt:has(input[data-opt="offline_after"]) .opt-error')) === T.range, await text('.opt:has(input[data-opt="offline_after"]) .opt-error'));
    check(`[${tag}] Speichern gesperrt bei Fehler`, await ev(`return r.querySelector('[data-set="save"]').disabled`));
    check(`[${tag}] Zusammenfassung behält gespeicherten Wert`, (await text('[data-id="detection"] .set-sec-sum')) === T.sumDet(2, 3));
    await num.fill("");
    await num.type("1");
    await num.type("0");
    check(`[${tag}] Eingabe ohne Sprung: Fokus bleibt im Feld`, await ev(`return r.activeElement === r.querySelector('input[data-opt="offline_after"]') && r.activeElement.value === "10"`));
    check(`[${tag}] gültig: Kurzzeile zurück, geändert`, (await text('.opt:has(input[data-opt="offline_after"]) .opt-short')) === T.offShort && await ev(`const o=r.querySelector('input[data-opt="offline_after"]').closest(".opt"); return o.classList.contains("changed") && !o.classList.contains("invalid")`));
    check(`[${tag}] Zusammenfassung, Etikett, Zähler live`, (await text('[data-id="detection"] .set-sec-sum')) === T.sumDet(10, 3) && (await text('[data-id="detection"] .set-badge')) === T.changed && (await text(".set-count")) === T.one && !(await ev(`return r.querySelector('[data-set="save"]').disabled`)));
    // Instabil ab 50: die instabilen Geräte fallen aus der Gruppe
    const flakyBefore = await ev(`return r.querySelectorAll(".dev.flaky").length`);
    const flakyWant = await p.evaluate(() => window.__devices.filter((d) => !d.disabled && !d.service && d.entities > 0 && d.online && d.avail24 && d.avail24.outages >= 50).length);
    const flaky = (await f.evaluateHandle(new Function(`return ${R}.querySelector('input[data-opt="flaky_outages"]')`))).asElement();
    if (mobile) await flaky.tap(); else await flaky.click();
    await flaky.fill("");
    await flaky.type("50");
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] gespeichert als Zahlen`, await wait(`return !r.querySelector("dialog.settings").open`) && JSON.stringify((await calls("device_panel/set_options")).at(-1).values) === JSON.stringify({ offline_after: 10, flaky_outages: 50 }), JSON.stringify((await calls("device_panel/set_options")).at(-1)?.values));
    check(`[${tag}] Liste neu: instabil ab 50`, await wait(`return r.querySelectorAll(".dev.flaky").length === ${flakyWant}`) && flakyBefore > 0 && flakyWant === 0, `${flakyBefore} → ${await ev(`return r.querySelectorAll(".dev.flaky").length`)}, erwartet ${flakyWant}`);

    // Anzeige: deaktivierte Geräte als eigene Gruppe am Ende
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    check(`[${tag}] Erkennung nach Speichern`, (await text('[data-id="detection"] .set-sec-sum')) === T.sumDet(10, 50));
    check(`[${tag}] Anzeige zusammengefasst`, (await text('[data-id="display"] .set-sec-title')) === T.secDisp && (await text('[data-id="display"] .set-sec-sum')) === T.sumDisp);
    await tap('[data-set="section"][data-id="display"]');
    await tap('.switch input[data-opt="show_disabled_devices"]');
    check(`[${tag}] Anzeige live`, (await text('[data-id="display"] .set-sec-sum')) === T.sumDispDis);
    await tap('.switch input[data-opt="show_service_devices"]');
    check(`[${tag}] Anzeige live, beide`, (await text('[data-id="display"] .set-sec-sum')) === T.sumDispBoth);
    await p.screenshot({ path: `${outDir}/settings-detection-${tag.replace("/", "-")}.png` });
    await tap('dialog.settings [data-set="save"]');
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
    check(`[${tag}] Nur Probleme ohne Deaktivierte`, !(await ev(`return [...r.querySelectorAll(".dev")].some(e=>e.textContent.includes("Alte Lampe"))`)));
    await tap("[data-problems]");
    await ev(`[...r.querySelectorAll(".dev")].find(e=>e.textContent.includes("Alte Lampe")).scrollIntoView({ block: "center" })`);
    await p.screenshot({ path: `${outDir}/list-disabled-${tag.replace("/", "-")}.png` });

    // Zurück auf die Standards
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="detection"]');
    for (const [key, val] of [["offline_after", "2"], ["flaky_outages", "3"]]) {
      const h = (await f.evaluateHandle(new Function(`return ${R}.querySelector('input[data-opt="${key}"]')`))).asElement();
      if (mobile) await h.tap(); else await h.click();
      await h.fill("");
      await h.type(val);
    }
    await tap('[data-set="section"][data-id="display"]');
    await tap('.switch input[data-opt="show_disabled_devices"]');
    await tap('.switch input[data-opt="show_service_devices"]');
    check(`[${tag}] vier Änderungen`, (await text(".set-count")) === T.four);
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] Standards wieder`, await wait(`return r.querySelectorAll(".dev").length === 16`) && JSON.stringify(await p.evaluate(() => [window.__opts.offline_after, window.__opts.flaky_outages, window.__opts.show_disabled_devices, window.__opts.show_service_devices])) === "[2,3,false,false]");

    // Batterie und Push-Benachrichtigung
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    check(`[${tag}] Batterie zusammengefasst`, (await text('[data-id="battery"] .set-sec-sum')) === T.sumBatOff, await text('[data-id="battery"] .set-sec-sum'));
    check(`[${tag}] Push ohne Ziel`, (await text('[data-id="push"] .set-sec-sum')) === T.sumPushNone, await text('[data-id="push"] .set-sec-sum'));
    await tap('[data-set="section"][data-id="battery"]');
    await tap('.switch input[data-opt="battery_push"]');
    check(`[${tag}] Hinweis: Push braucht ein Ziel`, (await text(".opt-warn")) === T.noTarget, await text(".opt-warn"));
    await tap('.switch input[data-opt="battery_persistent"]');
    const bat = (await f.evaluateHandle(new Function(`return ${R}.querySelector('input[data-opt="battery_low"]')`))).asElement();
    if (mobile) await bat.tap(); else await bat.click();
    await bat.fill("");
    await bat.type("25");
    check(`[${tag}] Batterie live`, (await text('[data-id="battery"] .set-sec-sum')) === T.sumBatBoth, await text('[data-id="battery"] .set-sec-sum'));
    await tap('[data-set="section"][data-id="push"]');
    const opts = await ev(`return [...r.querySelectorAll('select[data-opt="notify_service"] option')].map(o=>o.textContent)`);
    check(`[${tag}] Push-Ziele mit Beschriftung`, opts.length === 4 && opts[0] === T.notifyNone && opts[3] === T.entity, JSON.stringify(opts));
    const sel = (await f.evaluateHandle(new Function(`return ${R}.querySelector('select[data-opt="notify_service"]')`))).asElement();
    await sel.selectOption("notify.mobile_app_testhandy");
    check(`[${tag}] Ziel gewählt: Hinweis weg, Zusammenfassung`, await wait(`return !r.querySelector(".opt-warn")`) && (await text('[data-id="push"] .set-sec-sum')) === T.sumPush, await text('[data-id="push"] .set-sec-sum'));
    const click = (await f.evaluateHandle(new Function(`return ${R}.querySelector('select[data-opt="notify_click_target"]')`))).asElement();
    await click.selectOption("device");
    check(`[${tag}] fünf Änderungen`, (await text(".set-count")) === T.five, await text(".set-count"));
    await p.screenshot({ path: `${outDir}/settings-battery-${tag.replace("/", "-")}.png` });
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] Batterie und Push gespeichert`, await wait(`return !r.querySelector("dialog.settings").open`) && JSON.stringify((await calls("device_panel/set_options")).at(-1).values) === JSON.stringify({ battery_low: 25, battery_push: true, battery_persistent: true, notify_service: "notify.mobile_app_testhandy", notify_click_target: "device" }), JSON.stringify((await calls("device_panel/set_options")).at(-1)?.values));
    check(`[${tag}] Liste mit neuer Schwelle`, await wait(`return r.querySelector('.chip.hint[data-hint="battery"] .n')?.textContent === "3"`), await text('.chip.hint[data-hint="battery"] .n'));
    // Zurück
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="battery"]');
    const bat2 = (await f.evaluateHandle(new Function(`return ${R}.querySelector('input[data-opt="battery_low"]')`))).asElement();
    if (mobile) await bat2.tap(); else await bat2.click();
    await bat2.fill("");
    await bat2.type("15");
    await tap('.switch input[data-opt="battery_push"]');
    await tap('.switch input[data-opt="battery_persistent"]');
    await tap('[data-set="section"][data-id="push"]');
    await (await f.evaluateHandle(new Function(`return ${R}.querySelector('select[data-opt="notify_service"]')`))).asElement().selectOption("none");
    await (await f.evaluateHandle(new Function(`return ${R}.querySelector('select[data-opt="notify_click_target"]')`))).asElement().selectOption("panel");
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] Batterie und Push zurück`, await wait(`return !r.querySelector("dialog.settings").open`) && JSON.stringify(await p.evaluate(() => [window.__opts.battery_low, window.__opts.battery_push, window.__opts.battery_persistent, window.__opts.notify_service, window.__opts.notify_click_target])) === JSON.stringify([15, false, false, "none", "panel"]) && await wait(`return r.querySelector('.chip.hint[data-hint="battery"] .n')?.textContent === "2"`));

    // Batterie: Zeitpunkt (sofort/täglich), Uhrzeit, Inhalt der Tagesmeldung;
    // Push: Ausfall, wieder online, Sammelausfall
    const pick = async (sel, value) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement().selectOption(value);
    const timeIn = async (val) => {
      const h = (await f.evaluateHandle(new Function(`return ${R}.querySelector('input[type="time"][data-opt="battery_push_time"]')`))).asElement();
      if (mobile) await h.tap(); else await h.click();
      await h.fill(val);
    };
    const short = (key) => ev(`const o=r.querySelector('[data-opt="${key}"]').closest(".opt").querySelector("[data-short]"); return o.className + "|" + o.textContent`);
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="battery"]');
    check(`[${tag}] Zeitpunkt erst mit Push`, !(await ev(`return !!r.querySelector('select[data-opt="battery_push_mode"]')`)));
    await tap('.switch input[data-opt="battery_push"]');
    check(`[${tag}] Zeitpunkt sofort`, await wait(`return r.querySelector('select[data-opt="battery_push_mode"]')?.value === "instant"`) && !(await ev(`return !!r.querySelector('input[type="time"]') || !!r.querySelector('select[data-opt="battery_push_daily"]')`)) && (await short("battery_push_mode")) === `opt-short|${T.shortInstant}`, await short("battery_push_mode"));
    await pick('select[data-opt="battery_push_mode"]', "daily");
    check(`[${tag}] täglich: Uhrzeit 08:00, Inhalt neu`, await wait(`return r.querySelector('input[type="time"][data-opt="battery_push_time"]')?.value === "08:00" && r.querySelector('select[data-opt="battery_push_daily"]')?.value === "new"`) && (await short("battery_push_mode")) === `opt-short|${T.shortDaily("08:00")}`, await short("battery_push_mode"));
    if (!mobile) {
      // Breit genug für "08:00 AM" (Format des Browsers) und neben der Auswahl
      const tops = await ev(`return [r.querySelector('select[data-opt="battery_push_mode"]'), r.querySelector('input[type="time"]')].map(e=>Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2))`);
      check(`[${tag}] Auswahl und Uhrzeit in einer Zeile`, Math.abs(tops[0] - tops[1]) <= 3, JSON.stringify(tops));
    }
    await timeIn("");
    check(`[${tag}] leere Uhrzeit: Fehler, Speichern gesperrt`, (await short("battery_push_mode")) === `opt-error|${T.timeErr}` && await ev(`const o=r.querySelector('select[data-opt="battery_push_mode"]').closest(".opt"); return o.classList.contains("invalid") && r.querySelector('[data-set="save"]').disabled`), await short("battery_push_mode"));
    await timeIn("06:45");
    check(`[${tag}] Uhrzeit gültig: Kurzzeile, Zusammenfassung, Fokus bleibt`, (await short("battery_push_mode")) === `opt-short|${T.shortDaily("06:45")}` && (await text('[data-id="battery"] .set-sec-sum')) === T.sumBatDaily("06:45") && await ev(`return r.activeElement === r.querySelector('input[type="time"]') && r.querySelector('select[data-opt="battery_push_mode"]').closest(".opt").classList.contains("changed")`), await text('[data-id="battery"] .set-sec-sum'));
    await pick('select[data-opt="battery_push_daily"]', "all");
    check(`[${tag}] Inhalt alle`, await wait(`return r.querySelector('select[data-opt="battery_push_daily"]')?.value === "all"`) && (await ev(`const s=r.querySelector('select[data-opt="battery_push_daily"]'); return s.options[s.selectedIndex].textContent`)) === T.dailyAll && (await ev(`return r.querySelector('input[type="time"]').value`)) === "06:45");
    await tap('[data-set="section"][data-id="push"]');
    await pick('select[data-opt="notify_service"]', "notify.mobile_app_testhandy");
    check(`[${tag}] Push: nur Batterie gemeldet`, await wait(`return r.querySelector('[data-id="push"] .set-sec-sum')?.textContent === ${JSON.stringify(T.sumPush)}`), await text('[data-id="push"] .set-sec-sum'));
    check(`[${tag}] Ausfall: Kurzzeile mit Minuten`, (await short("notify_outage")) === `opt-short|${T.outageShort}`, await short("notify_outage"));
    check(`[${tag}] Standard: Ausfall und Online aus, Sammelausfall an`, (await ev(`return ["notify_outage","notify_online","notify_group"].map(k=>r.querySelector('input[data-opt="'+k+'"]').checked).join()`)) === "false,false,true");
    await tap('.switch input[data-opt="notify_outage"]');
    await tap('.switch input[data-opt="notify_online"]');
    await tap('.switch input[data-opt="notify_group"]');
    check(`[${tag}] Push: alle Arten`, (await text('[data-id="push"] .set-sec-sum')) === T.sumPushAll && (await text(".set-count")) === T.eight, `${await text('[data-id="push"] .set-sec-sum')} / ${await text(".set-count")}`);
    await ev(`r.querySelector('[data-id="push"]').scrollIntoView({ block: "start" })`);
    await p.screenshot({ path: `${outDir}/settings-notify-${tag.replace("/", "-")}.png` });
    await tap('dialog.settings [data-set="save"]');
    const sorted = (o) => JSON.stringify(Object.fromEntries(Object.entries(o || {}).sort()));
    const expect = { battery_push: true, battery_push_daily: "all", battery_push_mode: "daily", battery_push_time: "06:45", notify_group: false, notify_online: true, notify_outage: true, notify_service: "notify.mobile_app_testhandy" };
    check(`[${tag}] Zeitpunkt und Meldungen gespeichert`, await wait(`return !r.querySelector("dialog.settings").open`) && sorted((await calls("device_panel/set_options")).at(-1).values) === sorted(expect), JSON.stringify((await calls("device_panel/set_options")).at(-1)?.values));
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    check(`[${tag}] nach Speichern: Zusammenfassungen`, (await text('[data-id="battery"] .set-sec-sum')) === T.sumBatDaily("06:45") && (await text('[data-id="push"] .set-sec-sum')) === T.sumPushAll, `${await text('[data-id="battery"] .set-sec-sum')} / ${await text('[data-id="push"] .set-sec-sum')}`);
    // Zurück: Uhrzeit, Inhalt, sofort, Push aus, Meldungen wie vorher
    await tap('[data-set="section"][data-id="battery"]');
    await timeIn("08:00");
    await pick('select[data-opt="battery_push_daily"]', "new");
    await wait(`return r.querySelector('select[data-opt="battery_push_daily"]')?.value === "new"`);
    await pick('select[data-opt="battery_push_mode"]', "instant");
    check(`[${tag}] sofort: Uhrzeit und Inhalt weg`, await wait(`return !r.querySelector('input[type="time"]') && !r.querySelector('select[data-opt="battery_push_daily"]')`) && (await text('[data-id="battery"] .set-sec-sum')) === T.sumBatInstant, await text('[data-id="battery"] .set-sec-sum'));
    await tap('.switch input[data-opt="battery_push"]');
    await tap('[data-set="section"][data-id="push"]');
    await tap('.switch input[data-opt="notify_outage"]');
    await tap('.switch input[data-opt="notify_online"]');
    check(`[${tag}] ohne Arten`, (await text('[data-id="push"] .set-sec-sum')) === T.sumPushNoKind, await text('[data-id="push"] .set-sec-sum'));
    await tap('.switch input[data-opt="notify_group"]');
    await pick('select[data-opt="notify_service"]', "none");
    await wait(`return r.querySelector('select[data-opt="notify_service"]')?.value === "none"`);
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] Zeitpunkt und Meldungen zurück`, await wait(`return !r.querySelector("dialog.settings").open`) && JSON.stringify(await p.evaluate(() => ["battery_push", "battery_push_mode", "battery_push_time", "battery_push_daily", "notify_service", "notify_outage", "notify_online", "notify_group"].map((k) => window.__opts[k]))) === JSON.stringify([false, "instant", "08:00", "new", "none", false, false, true]), JSON.stringify(await p.evaluate(() => window.__opts)));

    // Batterie: eigene Schwelle pro Integration (Variante A)
    const typeIn = async (sel, val) => {
      const h = (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
      if (mobile) await h.tap(); else await h.click();
      await h.fill("");
      if (val !== "") await h.type(val);
    };
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="battery"]');
    check(`[${tag}] Liste pro Integration`, (await text(".bat-own .opt-label")) === T.batTitle);
    const batRows = await ev(`return [...r.querySelectorAll("input[data-bat]")].map(i=>i.dataset.bat+":"+i.placeholder+":"+i.value).join(",")`);
    check(`[${tag}] nur Integrationen mit Batterie, globaler Wert als Platzhalter`, batRows === "zha:15:,matter:15:,bthome:15:,zwave_js:15:", batRows);
    check(`[${tag}] Zahl und schwächste Batterie`, (await ev(`return r.querySelector('input[data-bat="zha"]').closest(".ex-row").querySelector("small").textContent`)) === T.batZha);
    await typeIn('input[data-bat="matter"]', "60");
    check(`[${tag}] 60 ist ungültig`, await ev(`return r.querySelector('input[data-bat="matter"]').closest(".ex-row").classList.contains("invalid")`) && (await text("[data-bat-error]")) === T.rangeBat && await ev(`return r.querySelector('[data-set="save"]').disabled`));
    await typeIn('input[data-bat="matter"]', "25");
    check(`[${tag}] gültig: Zusammenfassung, Zähler`, (await text('[data-id="battery"] .set-sec-sum')) === T.sumBatOwn && (await text(".set-count")) === T.one && await ev(`return r.querySelector("[data-bat-error]").hidden && r.activeElement === r.querySelector('input[data-bat="matter"]')`), await text('[data-id="battery"] .set-sec-sum'));
    // Globalen Wert ändern: die Platzhalter folgen
    await typeIn('input[data-opt="battery_low"]', "20");
    check(`[${tag}] Platzhalter folgt der Schwelle`, (await ev(`return r.querySelector('input[data-bat="zha"]').placeholder`)) === "20");
    await typeIn('input[data-opt="battery_low"]', "15");
    // Kurzzeile mit Anführungszeichen bleibt nach der Eingabe ganz (escape
    // maskierte " nicht, das Attribut brach ab).
    const shortAfter = await ev(`const o=r.querySelector('input[data-opt="battery_low"]').closest(".opt").querySelector("[data-short]"); return [o.textContent, o.dataset.short]`);
    check(`[${tag}] Kurzzeile mit Anführungszeichen vollständig`, shortAfter[0] === T.batLowShort && shortAfter[1] === T.batLowShort, JSON.stringify(shortAfter));
    await ev(`r.querySelector(".bat-own").scrollIntoView({ block: "start" })`);
    await p.screenshot({ path: `${outDir}/settings-battery-own-${tag.replace("/", "-")}.png` });
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] eigene Schwelle gespeichert`, await wait(`return !r.querySelector("dialog.settings").open`) && JSON.stringify((await calls("device_panel/set_options")).at(-1).values) === JSON.stringify({ battery_low_integrations: { matter: 25 } }), JSON.stringify((await calls("device_panel/set_options")).at(-1)?.values));
    check(`[${tag}] Liste: Matter-Gerät mit 22 % jetzt schwach`, await wait(`return r.querySelector('.chip.hint[data-hint="battery"] .n')?.textContent === "3"`), await text('.chip.hint[data-hint="battery"] .n'));
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    check(`[${tag}] nach Speichern: Wert steht, Zusammenfassung`, (await text('[data-id="battery"] .set-sec-sum')) === T.sumBatOwn);
    await tap('[data-set="section"][data-id="battery"]');
    check(`[${tag}] Wert im Feld`, (await ev(`return r.querySelector('input[data-bat="matter"]').value`)) === "25");
    await typeIn('input[data-bat="matter"]', "");
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] leer = globaler Wert, gespeichert`, await wait(`return !r.querySelector("dialog.settings").open`) && JSON.stringify((await calls("device_panel/set_options")).at(-1).values) === JSON.stringify({ battery_low_integrations: {} }) && await wait(`return r.querySelector('.chip.hint[data-hint="battery"] .n')?.textContent === "2"`));

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
