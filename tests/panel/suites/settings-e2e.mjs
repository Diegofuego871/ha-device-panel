// Einstellungen (Zahnrad): Kopf, Versionszeile, Abschnitt "Updates" mit
// Info, Entwurf mit Etikett und Zähler, Speichern über set_options und
// set_panel, Abbrechen verwirft, Fehler beim Laden und Speichern, Escape,
// Hintergrund. Deutsch und Englisch, Desktop und Handy (Blatt).
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
    sumDispBoth: "Dienst-Geräte und deaktivierte Geräte angezeigt", grpDis: "Deaktiviert", ofTotal: "von 17", four: "4 Änderungen",
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
    sumDispBoth: "Service devices and disabled devices shown", grpDis: "Disabled", ofTotal: "of 17", four: "4 changes",
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
    check(`[${tag}] Abschnitte wie Bild 5`, order === "detection,integrations,types,display,updates", order);
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
