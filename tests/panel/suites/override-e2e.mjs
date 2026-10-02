// Einstellungen pro Gerät (docs/mockups/override-v1, A): Symbole beim Namen,
// Chip "Eigene Einstellung" als Filter, in den Einstellungen die Geräte mit
// eigenem Wert einzeln oder alle zurücksetzen (gilt mit "Speichern"),
// "Abbrechen" verwirft, Fehler beim Speichern. Deutsch und Englisch,
// Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: {
    chip: "Eigene Einstellung", batOff: "Batterie-Warnung aus (nur dieses Gerät)", batOwn: "Eigene Batterie-Schwelle: 30 % (global 15 %)",
    mute: "Ausfall- und Online-Meldungen aus (nur dieses Gerät)", batTitle: "Eigene Werte auf Geräten", notifyTitle: "Meldungen auf Geräten ausgeschaltet",
    off: "Aus", resetAll: "Alle zurücksetzen", one: "1 Änderung", three: "3 Änderungen", four: "4 Änderungen", changed: "geändert",
    batEmpty: "Keine. Eigene Werte setzt man im Geräte-Popup.", hiddenSub: "Estrich · Philips Hue · ausgeblendet", eSub: "Küche · Zigbee Home Automation",
    saveErr: "Speichern fehlgeschlagen:",
  },
  en: {
    chip: "Own setting", batOff: "Battery warning off (this device only)", batOwn: "Own battery threshold: 30 % (global 15 %)",
    mute: "Outage and online notifications off (this device only)", batTitle: "Own values on devices", notifyTitle: "Notifications switched off on devices",
    off: "Off", resetAll: "Reset all", one: "1 change", three: "3 changes", four: "4 changes", changed: "changed",
    batEmpty: "None. Own values are set in the device pop-up.", hiddenSub: "Estrich · Philips Hue · hidden", eSub: "Küche · Zigbee Home Automation",
    saveErr: "Saving failed:",
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
    // Erfunden: Batterie aus (a), eigene Schwelle (c, e), Meldungen aus (d, f)
    // und auf einem ausgeblendeten (deaktivierten) Gerät (s).
    await p.evaluate(() => {
      window.__devSettings.battery = { a: "off", c: 30, e: 25 };
      for (const id of ["d", "f", "s"]) window.__devSettings.notifyOff.add(id);
    });
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const resets = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/reset_device_settings").map(({ battery, notify, connection }) => ({ battery: [...battery].sort(), notify: [...notify].sort(), connection: [...(connection || [])].sort() })));
    const icons = (id) => ev(`return [...r.querySelectorAll('.dev[data-open="${id}"] .ovr')].map(o => o.className.replace("ovr ", "") + "|" + o.textContent.trim() + "|" + o.getAttribute("title"))`);
    const openSettings = async () => { await tap(".gear-btn"); await wait(`return !!r.querySelector("dialog.settings .set-sec")`); };

    // Liste: Symbole je Art
    check(`[${tag}] Batterie aus`, JSON.stringify(await icons("a")) === JSON.stringify([`bat-off||${T.batOff}`]), JSON.stringify(await icons("a")));
    check(`[${tag}] eigene Schwelle mit Wert`, JSON.stringify(await icons("c")) === JSON.stringify([`bat|30 %|${T.batOwn}`]), JSON.stringify(await icons("c")));
    check(`[${tag}] Meldungen aus`, JSON.stringify(await icons("d")) === JSON.stringify([`mute||${T.mute}`]));
    check(`[${tag}] ohne eigene Einstellung kein Symbol`, (await icons("b")).length === 0 && (await icons("k")).length === 0);
    check(`[${tag}] Symbol beim Namen`, await ev(`const n=r.querySelector('.dev[data-open="c"] .ovrs').parentElement; return n.textContent.startsWith("Thermostat Bad")`));
    // Chip als Filter
    check(`[${tag}] Chip mit Zahl`, (await text('.chip.hint[data-hint="override"]')) === `${T.chip} 5`, await text('.chip.hint[data-hint="override"]'));
    await tap('.chip.hint[data-hint="override"]');
    const shown = await ev(`return [...r.querySelectorAll(".dev[data-open]")].map(e=>e.dataset.open).sort().join()`);
    check(`[${tag}] Filter: nur Geräte mit eigener Einstellung`, shown === "a,c,d,e,f", shown);
    await p.screenshot({ path: `${outDir}/override-list-${tag.replace("/", "-")}.png` });
    await tap('.chip.hint[data-hint="override"]');
    check(`[${tag}] Filter aus`, await wait(`return r.querySelectorAll(".dev[data-open]").length === 16`));

    // Einstellungen: Liste, einzeln, rückgängig, alle
    await openSettings();
    await tap('[data-set="section"][data-id="battery"]');
    const batRows = await ev(`return [...r.querySelectorAll('[data-key^="battery:"]')].map(b=>{const row=b.closest(".ovr-row"); return row.querySelector(".ovr-name").firstChild.textContent + "=" + row.querySelector(".ovr-val").textContent;}).join(";")`);
    check(`[${tag}] Batterie-Liste nach Name`, batRows === `Fensterkontakt Küche=25 %;Temperatur Keller=${T.off};Thermostat Bad=30 %`, batRows);
    check(`[${tag}] Titel und Bereich · Integration`, (await ev(`return r.querySelector('[data-key="battery:e"]').closest(".ovr-opt").querySelector(".opt-label").textContent`)) === T.batTitle && (await ev(`return r.querySelector('[data-key="battery:e"]').closest(".ovr-row").querySelector("small").textContent`)) === T.eSub);
    await tap('[data-key="battery:c"]');
    check(`[${tag}] einzeln markiert`, await ev(`const row=r.querySelector('[data-key="battery:c"]').closest(".ovr-row"); return row.classList.contains("reset") && row.querySelector("s").textContent === "30 %"`) && (await text(".set-count")) === T.one && (await text('[data-id="battery"] .set-badge')) === T.changed);
    check(`[${tag}] Fokus bleibt auf dem Knopf`, await ev(`return r.activeElement === r.querySelector('[data-key="battery:c"]')`));
    await tap('[data-key="battery:c"]');
    check(`[${tag}] rückgängig`, (await text(".set-count")) === "" && !(await ev(`return !!r.querySelector(".ovr-row.reset")`)) && await ev(`return r.querySelector('[data-set="save"]').disabled`));
    await tap('[data-set="ovr-all"][data-key="battery"]');
    check(`[${tag}] alle markiert, Knopf gesperrt`, (await text(".set-count")) === T.three && await ev(`return r.querySelectorAll(".ovr-row.reset").length === 3 && r.querySelector('[data-set="ovr-all"][data-key="battery"]').disabled`));
    await tap('[data-set="section"][data-id="push"]');
    const pushRows = await ev(`return [...r.querySelectorAll('[data-key^="notify:"]')].map(b=>b.closest(".ovr-row").querySelector(".ovr-name").firstChild.textContent).join(";")`);
    check(`[${tag}] Meldungen-Liste mit ausgeblendetem Gerät`, pushRows === "Alte Lampe;Präsenzsensor Büro;Steckdose Terrasse" && (await ev(`return r.querySelector('[data-key="notify:s"]').closest(".ovr-row").querySelector("small").textContent`)) === T.hiddenSub, pushRows);
    check(`[${tag}] Titel Meldungen`, (await ev(`return r.querySelector('[data-key="notify:d"]').closest(".ovr-opt").querySelector(".opt-label").textContent`)) === T.notifyTitle);
    await tap('[data-key="notify:d"]');
    check(`[${tag}] vier Änderungen`, (await text(".set-count")) === T.four && (await text('[data-id="push"] .set-badge')) === T.changed);
    check(`[${tag}] noch nichts zurückgesetzt`, (await resets()).length === 0);
    await ev(`r.querySelector('[data-key="notify:d"]').closest(".ovr-opt").scrollIntoView({ block: "center" })`);
    await p.screenshot({ path: `${outDir}/override-settings-${tag.replace("/", "-")}.png` });
    // Fehler beim Speichern: Dialog bleibt
    await p.evaluate(() => { window.__resetFails = "Keine Berechtigung"; });
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] Speicherfehler`, await wait(`return (r.querySelector("dialog.settings .dlg-error")?.textContent || "").includes("Keine Berechtigung")`) && (await text("dialog.settings .dlg-error")).startsWith(T.saveErr) && await ev(`return r.querySelector("dialog.settings").open`));
    await p.evaluate(() => { window.__resetFails = null; });
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] gespeichert, Dialog offen, dann geschlossen`, await wait(`return r.querySelector("dialog.settings").open && r.querySelector(".set-count")?.classList.contains("saved") && !r.querySelector(".ovr-row")?.classList.contains("reset")`) && await (async () => { await tap('dialog.settings .dlg-actions [data-set="close"]'); return wait(`return !r.querySelector("dialog.settings").open`); })());
    check(`[${tag}] nur die markierten`, JSON.stringify((await resets()).at(-1)) === JSON.stringify({ battery: ["a", "c", "e"], notify: ["d"], connection: [] }), JSON.stringify(await resets()));
    check(`[${tag}] Liste ohne die Symbole`, await wait(`return !r.querySelector('.dev[data-open="a"] .ovr') && !r.querySelector('.dev[data-open="c"] .ovr') && !r.querySelector('.dev[data-open="d"] .ovr')`) && (await icons("f")).length === 1);
    check(`[${tag}] Chip zählt nach`, (await text('.chip.hint[data-hint="override"]')) === `${T.chip} 1`, await text('.chip.hint[data-hint="override"]'));

    // Wieder öffnen: Batterie leer, Abbrechen verwirft
    await openSettings();
    await tap('[data-set="section"][data-id="battery"]');
    check(`[${tag}] Batterie: keine mehr`, !(await ev(`return !!r.querySelector('[data-set="ovr-all"][data-key="battery"]')`)) && (await ev(`return [...r.querySelectorAll(".ovr-opt .opt-short")].map(e=>e.textContent)`)).includes(T.batEmpty));
    await tap('[data-set="section"][data-id="push"]');
    await tap('[data-key="notify:f"]');
    await tap('dialog.settings .dlg-actions [data-set="close"]');
    const n = (await resets()).length;
    await openSettings();
    await tap('[data-set="section"][data-id="push"]');
    check(`[${tag}] Abbrechen verwirft`, (await resets()).length === n && !!(await handle('[data-key="notify:f"]')) && !(await ev(`return !!r.querySelector(".ovr-row.reset")`)));
    await tap('dialog.settings .dlg-actions [data-set="close"]');

    check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
