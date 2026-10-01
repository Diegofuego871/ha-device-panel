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
  },
  en: {
    gear: "Settings", title: "Settings", sub: "Device Panel · applies to all users", sec: "Updates",
    sumOn: "Daily check · new version under \"Repairs\"", sumOff: "No automatic check",
    opt: "Check for updates daily", short: "Reports a new version under Settings → Repairs.", info: "Queries the published releases",
    changed: "changed", one: "1 change", two: "2 changes", save: "Save", cancel: "Cancel", saved: "Settings saved.",
    pre: "Show pre-releases", loadErr: "Could not load the settings:", saveErr: "Saving failed:", ver: "Device Panel 0.4.0",
    secInt: "Integrations", sumInt: "9 integrations · all shown", sumInt1: "9 integrations · 1 hidden", show: "Show", all: "Toggle all",
    zha: "Zigbee Home Automation", zhaSub: "5 devices", secTypes: "Device types", outlet: "Outlet", sumTypes1: "11 types · 1 hidden", sumTypesNone: "11 types · all shown", sumTypesAll: "11 types · 11 hidden",
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
