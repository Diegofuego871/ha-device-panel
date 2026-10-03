// Verbindungsart von Hand im Popup (wie der Typ): Auswahl mit "Automatisch:
// <erkannt>" und allen Arten ausser "unbekannt", gilt sofort, Liste und
// Chips folgen, zurück auf die Erkennung, Matter mit verfeinerter Erkennung,
// Speicherfehler, kein Fokus auf der Auswahl am Handy. Deutsch und Englisch,
// Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { auto: "Automatisch: Unbekannt", autoThread: "Automatisch: Thread", manual: "von Hand gesetzt", zigbee: "Zigbee", err: "Verbindungsart konnte nicht gespeichert werden:",
    sumAuto: "Automatisch erkannt", sumOne: "1 Integration festgelegt", title: "Verbindungsart pro Integration", shelly: "2 Geräte · erkannt: 2 WLAN", autoOpt: "Automatisch",
    one: "1 Änderung", integ: "Wie Integration: LAN", byInteg: "für die ganze Integration festgelegt", lan: "LAN",
    ovrTip: "Verbindungsart von Hand: Zigbee (sonst Unbekannt)", ovrTitle: "Verbindungsart von Hand auf Geräten", ovrBack: "Zigbee → automatisch" },
  en: { auto: "Automatic: Unknown", autoThread: "Automatic: Thread", manual: "set by hand", zigbee: "Zigbee", err: "Could not save the connection type:",
    sumAuto: "Detected automatically", sumOne: "1 integration set", title: "Connection type per integration", shelly: "2 devices · detected: 2 Wi-Fi", autoOpt: "Automatic",
    one: "1 change", integ: "Same as integration: LAN", byInteg: "set for the whole integration", lan: "LAN",
    ovrTip: "Connection type set by hand: Zigbee (otherwise Unknown)", ovrTitle: "Connection type set by hand on devices", ovrBack: "Zigbee → automatic" },
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
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const calls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_device_connection").map(({ device_id, connection }) => ({ device_id, connection })));
    const chip = (k) => ev(`return r.querySelector('.chip[data-conn="${k}"] .n')?.textContent || ""`);
    const open = async (id) => { await tap(`.dev[data-open="${id}"]`); await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('select[data-dlg="conn"]')`); };
    const close = async () => { await tap('dialog.device [data-dlg="close"]'); await wait(`return !r.querySelector("dialog.device").open`); };
    const sel = () => ev(`const s=r.querySelector('select[data-dlg="conn"]'); return s.value + "|" + s.options[s.selectedIndex].textContent`);

    check(`[${tag}] Ausgangslage`, (await chip("unknown")) === "1" && (await chip("zigbee")) === "5");
    await open("p");
    check(`[${tag}] erkannt: unbekannt`, (await sel()) === `|${T.auto}`, await sel());
    const values = await ev(`return [...r.querySelectorAll('select[data-dlg="conn"] option')].map(o=>o.value).join()`);
    check(`[${tag}] alle Arten ausser unbekannt`, values === ",zigbee,thread,zwave,matter,ble,wifi,ethernet,network,cloud", values);
    // Wie ein Benutzer: Auswahl hat den Fokus, dann Zigbee
    const s = await handle('select[data-dlg="conn"]');
    await s.focus();
    await s.selectOption("zigbee");
    check(`[${tag}] gespeichert`, await wait(`return r.querySelector('select[data-dlg="conn"]')?.value === "zigbee"`) && JSON.stringify((await calls()).at(-1)) === JSON.stringify({ device_id: "p", connection: "zigbee" }));
    check(`[${tag}] von Hand vermerkt`, await wait(`return (r.querySelector('select[data-dlg="conn"]').closest(".tile").textContent || "").includes(${JSON.stringify(T.manual)})`));
    await f.evaluate(() => document.querySelector("device-panel")._fetch());
    await p.waitForTimeout(400);
    const focused = await ev(`const a=r.activeElement; return a ? a.tagName + ":" + (a.dataset.dlg || "") : "none"`);
    check(`[${tag}] Fokus nach Wahl`, mobile ? !focused.startsWith("SELECT") : focused === "SELECT:conn", focused);
    check(`[${tag}] Chips folgen`, await wait(`return !r.querySelector('.chip[data-conn="unknown"]') && r.querySelector('.chip[data-conn="zigbee"] .n')?.textContent === "6"`), `${await chip("unknown")}/${await chip("zigbee")}`);
    await ev(`r.querySelector(".dev-set") && r.querySelector('select[data-dlg="conn"]').closest(".tiles").scrollIntoView({ block: "center" })`);
    await p.screenshot({ path: `${outDir}/conn-${tag.replace("/", "-")}.png` });
    await close();
    check(`[${tag}] Liste zeigt Zigbee`, (await ev(`return r.querySelector('.dev[data-open="p"]').textContent`)).includes(T.zigbee));
    // Wieder öffnen, zurück auf die Erkennung
    await open("p");
    check(`[${tag}] nach erneutem Öffnen`, (await sel()).startsWith("zigbee|"));
    await (await handle('select[data-dlg="conn"]')).selectOption("");
    check(`[${tag}] zurück auf Erkennung`, await wait(`return r.querySelector('.chip[data-conn="unknown"] .n')?.textContent === "1"`) && JSON.stringify((await calls()).at(-1)) === JSON.stringify({ device_id: "p", connection: null }));
    // Speicherfehler
    await p.evaluate(() => { window.__connFails = "Keine Berechtigung"; });
    await (await handle('select[data-dlg="conn"]')).selectOption("cloud");
    check(`[${tag}] Speicherfehler angezeigt`, await wait(`return (r.querySelector('select[data-dlg="conn"]').closest(".tile").querySelector(".warn")?.textContent || "").startsWith(${JSON.stringify(T.err)})`));
    await p.evaluate(() => { window.__connFails = null; });
    await close();
    // Wettlauf (Fehlerbericht): eine Abfrage, die vor der Wahl begonnen hat,
    // bringt den alten Stand; er darf die Wahl nicht überdecken.
    await open("e");
    await p.evaluate(() => { window.__listDelay = 1200; });
    await f.evaluate(() => { document.querySelector("device-panel")._fetch(); });
    await p.waitForTimeout(100);
    await (await handle('select[data-dlg="conn"]')).selectOption("thread");
    await wait(`return r.querySelector('select[data-dlg="conn"]')?.value === "thread"`);
    const seen = [];
    for (let i = 0; i < 25; i += 1) {
      seen.push(await ev(`return r.querySelector('select[data-dlg="conn"]')?.value + "/" + (r.querySelector('.chip[data-conn="thread"] .n')?.textContent || "0")`));
      await p.waitForTimeout(100);
    }
    await p.evaluate(() => { window.__listDelay = 0; });
    check(`[${tag}] alter Stand überdeckt die Wahl nicht`, seen.every((v) => v.startsWith("thread/")) && new Set(seen.map((v) => v.split("/")[1])).size === 1, seen.join(" "));
    await (await handle('select[data-dlg="conn"]')).selectOption("");
    await wait(`return r.querySelector('select[data-dlg="conn"]')?.value === ""`);
    await close();
    // Matter: "Automatisch" zeigt die verfeinerte Erkennung
    await open("c");
    check(`[${tag}] Matter erkannt als Thread`, (await sel()) === `|${T.autoThread}`, await sel());
    await close();

    // Verbindungsart pro Integration (Variante B): gilt für alle ihre Geräte,
    // von Hand am Gerät geht vor
    const setCalls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_options").map((m) => m.values));
    const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wifiBefore = Number(await chip("wifi"));
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    check(`[${tag}] Abschnitt Verbindungsart`, (await text('[data-id="connections"] .set-sec-sum')) === T.sumAuto, await text('[data-id="connections"] .set-sec-sum'));
    await tap('[data-set="section"][data-id="connections"]');
    const shellyRow = await ev(`const s=r.querySelector('select[data-conn-integ="shelly"]'); return s ? [s.closest(".ex-row").querySelector("small").textContent, s.value, s.options[0].textContent, s.options.length] : null`);
    check(`[${tag}] Zeile mit Erkennung und Auswahl`, (await text(".bat-own .opt-label")) === T.title && JSON.stringify(shellyRow) === JSON.stringify([T.shelly, "", T.autoOpt, 10]), JSON.stringify(shellyRow));
    const sh = await handle('select[data-conn-integ="shelly"]');
    await sh.scrollIntoViewIfNeeded();
    await sh.selectOption("ethernet");
    check(`[${tag}] Entwurf`, await wait(`return r.querySelector('select[data-conn-integ="shelly"]')?.value === "ethernet"`) && (await text(".set-count")) === T.one && (await text('[data-id="connections"] .set-sec-sum')) === T.sumOne && await ev(`return r.querySelector('select[data-conn-integ="shelly"]').closest(".ex-row").classList.contains("changed")`));
    if (mobile) {
      const over = await ev(`const d=r.querySelector("dialog.settings"); return d.scrollWidth - d.clientWidth`);
      check(`[${tag}] Handy ohne Überlauf`, over <= 1, String(over));
    }
    await ev(`r.querySelector('select[data-conn-integ="shelly"]').closest(".ex-row").scrollIntoView({ block: "center" })`);
    await p.screenshot({ path: `${outDir}/conn-integ-${tag.replace("/", "-")}.png` });
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] gespeichert`, await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`) && JSON.stringify((await setCalls()).at(-1)) === JSON.stringify({ connection_integrations: { shelly: "ethernet" } }), JSON.stringify((await setCalls()).at(-1)));
    await tap('dialog.settings .dlg-actions [data-set="close"]');
    check(`[${tag}] Chips folgen`, await wait(`return r.querySelector('.chip[data-conn="ethernet"] .n')?.textContent === "2" && r.querySelector('.chip[data-conn="wifi"] .n')?.textContent === ${JSON.stringify(String(wifiBefore - 2))}`), `${await chip("ethernet")}/${await chip("wifi")}`);
    check(`[${tag}] Liste zeigt LAN`, (await ev(`return r.querySelector('.dev[data-open="d"]').textContent`)).includes(T.lan));
    // Popup: "Wie Integration: LAN"; von Hand geht vor, zurück folgt wieder der Integration
    await open("d");
    check(`[${tag}] Popup: wie Integration`, (await sel()) === `|${T.integ}` && (await ev(`return r.querySelector('select[data-dlg="conn"]').closest(".tile").textContent`)).includes(T.byInteg), await sel());
    await (await handle('select[data-dlg="conn"]')).selectOption("wifi");
    check(`[${tag}] von Hand vor Integration`, await wait(`return r.querySelector('.chip[data-conn="ethernet"] .n')?.textContent === "1"`), await chip("ethernet"));
    await (await handle('select[data-dlg="conn"]')).selectOption("");
    check(`[${tag}] zurück: wieder wie Integration`, await wait(`return r.querySelector('.chip[data-conn="ethernet"] .n')?.textContent === "2"`), await chip("ethernet"));
    await close();
    // Integration zurück auf Automatisch
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="connections"]');
    const sh2 = await handle('select[data-conn-integ="shelly"]');
    await sh2.scrollIntoViewIfNeeded();
    await sh2.selectOption("");
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] zurück auf Erkennung`, await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`) && JSON.stringify((await setCalls()).at(-1)) === JSON.stringify({ connection_integrations: {} }));
    await tap('dialog.settings .dlg-actions [data-set="close"]');
    // Eigene Einstellung (seit 0.17.0): Symbol, Chip, gesammelt zurücksetzen
    await open("p");
    await (await handle('select[data-dlg="conn"]')).selectOption("zigbee");
    await wait(`return r.querySelector('select[data-dlg="conn"]')?.value === "zigbee"`);
    await close();
    check(`[${tag}] Symbol in der Liste`, await wait(`return r.querySelector('.dev[data-open="p"] .ovr.conn')?.title === ${JSON.stringify(T.ovrTip)}`), await ev(`return r.querySelector('.dev[data-open="p"] .ovr.conn')?.title || "fehlt"`));
    check(`[${tag}] Chip "Eigene Einstellung" zählt mit`, await wait(`return !!r.querySelector('.chip.hint[data-hint="override"]')`));
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="connections"]');
    check(`[${tag}] Übersicht in "Verbindungsart"`, (await text('[data-key="connection:p"]') === "" || true) && (await ev(`return [...r.querySelectorAll(".ovr-opt .opt-label")].map(e=>e.textContent).includes(${JSON.stringify(T.ovrTitle)}) && !!r.querySelector('[data-key="connection:p"]')`)));
    await tap('[data-key="connection:p"]');
    check(`[${tag}] zum Zurücksetzen markiert`, (await ev(`return r.querySelector('[data-key="connection:p"]').closest(".ovr-row").querySelector(".ovr-val").textContent.replace(/\\s+/g," ").trim()`)) === T.ovrBack && (await text(".set-count")) === T.one);
    await tap('dialog.settings [data-set="save"]');
    const resetCalls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/reset_device_settings").map(({ battery, notify, connection }) => ({ battery, notify, connection })));
    check(`[${tag}] zurückgesetzt`, await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`) && JSON.stringify((await resetCalls()).at(-1)) === JSON.stringify({ battery: [], notify: [], connection: ["p"] }), JSON.stringify((await resetCalls()).at(-1)));
    await tap('dialog.settings .dlg-actions [data-set="close"]');
    check(`[${tag}] Symbol weg`, await wait(`return !r.querySelector('.dev[data-open="p"] .ovr.conn')`));

    check(`[${tag}] Chips wie vorher`, await wait(`return !r.querySelector('.chip[data-conn="ethernet"]') && r.querySelector('.chip[data-conn="wifi"] .n')?.textContent === ${JSON.stringify(String(wifiBefore))}`), `${await chip("wifi")}`);

    check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
