// App "Updates" (2.188.0): auch Apps, HACS, Home Assistant Core, Betriebssystem und Supervisor; Chips nach Art, Updates mit Neustart nie vorgewählt und nur
// eines je Start, Hinweise in der Rückfrage, Zeile ohne Gerät öffnet den Dialog von Home Assistant, Zahl am Launcher vom Server. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { all: "Alle", ha: "Home Assistant", apps: "Apps", hacs: "Marketplace", app: "App", restartCore: "Startet Home Assistant neu", restartOs: "Startet den Rechner neu", cCore: "Home Assistant startet am Schluss neu", cApps: "Während eines App-Updates meldet das Panel keinen Ausfall", start: (n) => `${n} Updates starten` },
  en: { all: "All", ha: "Home Assistant", apps: "Apps", hacs: "Marketplace", app: "App", restartCore: "Restarts Home Assistant", restartOs: "Restarts the machine", cCore: "Home Assistant restarts at the end", cApps: "During an app update the panel does not report outages", start: (n) => `Start ${n} updates` },
};
const dev = (id, platform, device, title) => ({ entity_id: `update.${id}`, device_id: device, platform, kind: "devices", restart: false, features: 13, installed: "1.0", latest: "1.1", title });
const LIST = [
  dev("s1", "shelly", "s1", "Licht Bad/Dusche"), dev("s2", "shelly", "s2", "Wandschalter Flur"),
  { entity_id: "update.esphome_device_builder_update", device_id: null, platform: "hassio", kind: "addons", restart: false, features: 29, installed: "2026.10.1", latest: "2026.10.2", title: "ESPHome Device Builder" },
  { entity_id: "update.beispiel_karte_update", device_id: "hacs-dienst", platform: "hacs", kind: "hacs", restart: false, features: 17, installed: "2.0", latest: "2.1", title: "Beispiel-Karte" },
  { entity_id: "update.home_assistant_supervisor_update", device_id: null, platform: "hassio", kind: "core", restart: false, features: 29, installed: "2026.10.0", latest: "2026.10.1", title: "Supervisor" },
  { entity_id: "update.home_assistant_core_update", device_id: null, platform: "hassio", kind: "core", restart: true, features: 29, installed: "2026.10.3", latest: "2026.11.0", title: "Home Assistant Core" },
  { entity_id: "update.home_assistant_operating_system_update", device_id: null, platform: "hassio", kind: "core", restart: true, features: 29, installed: "16.2", latest: "16.3", title: "Home Assistant Betriebssystem" },
];
const CORE = "update.home_assistant_core_update";
const OS = "update.home_assistant_operating_system_update";

for (const lang of ["de", "en"]) {
  const L = T[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const errors = [];
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark&updapp=1`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
    const checked = () => ev(`return [...r.querySelectorAll("dialog.updapp-dlg [data-ua-sel]:checked")].map((x) => x.dataset.uaSel).sort()`);
    const D = "dialog.updapp-dlg";

    await p.evaluate((l) => { window.__appUpdates = l; }, LIST);
    await ev(`r.host._fetch(true)`);
    check(`[${tag}] Launcher: Zahl 7 (vom Server, auch Apps und Home Assistant)`, await wait(`return r.host._updCount === 7 && r.host._apps.updCount() === 7`));
    await ev(`r.host._updApp.open()`);
    check(`[${tag}] Fenster: 7 Zeilen, Updates mit Neustart nicht vorgewählt (5 gewählt)`, (await wait(`return r.querySelectorAll("${D} .ua-row").length === 7`)) && JSON.stringify(await checked()) === JSON.stringify(LIST.filter((u) => !u.restart).map((u) => u.entity_id).sort()));
    check(`[${tag}] Knopf "${L.start(5)}"`, await ev(`return r.querySelector("${D} [data-ua='next']").innerText.trim() === ${JSON.stringify(L.start(5))}`));
    check(`[${tag}] Chips: ${L.all} 7, ${L.ha} 3, ${L.apps} 1, ${L.hacs} 1, Shelly 2`, await ev(`const c = [...r.querySelectorAll("${D} .ua-chips .chip")].map((x) => x.innerText.replace(/\\s+/g," ").trim()); return JSON.stringify(c) === ${JSON.stringify(JSON.stringify([`${L.all} 7`, `${L.ha} 3`, `${L.apps} 1`, `${L.hacs} 1`, "Shelly 2"]))}`));
    check(`[${tag}] Zeile Apps: Art "${L.app}", Version; Core und Betriebssystem tragen den Neustart-Hinweis`, await ev(`const rows = [...r.querySelectorAll("${D} .ua-row")]; const t = (id) => rows.find((x) => x.querySelector('[data-entity="' + id + '"]'))?.innerText.replace(/\\s+/g, " ") || ""; return t("update.esphome_device_builder_update").includes(${JSON.stringify(L.app)}) && t("update.esphome_device_builder_update").includes("2026.10.1") && t(${JSON.stringify(CORE)}).includes(${JSON.stringify(L.restartCore)}) && t(${JSON.stringify(OS)}).includes(${JSON.stringify(L.restartOs)}) && !t("update.s1").includes(${JSON.stringify(L.restartCore)})`));
    await p.screenshot({ path: `${process.env.OUT || "output"}/updappall-list-${tag.replace("/", "-")}.png` });

    // Nur eines mit Neustart je Start: das zweite nimmt das erste heraus
    await tap(`${D} [data-ua-sel="${CORE}"]`);
    check(`[${tag}] Core angehakt: 6 gewählt`, await wait(`return r.querySelectorAll("${D} [data-ua-sel]:checked").length === 6 && r.querySelector('${D} [data-ua-sel="${CORE}"]').checked`));
    await tap(`${D} [data-ua-sel="${OS}"]`);
    check(`[${tag}] Betriebssystem angehakt: Core wieder ab, weiter 6 gewählt`, await wait(`return r.querySelectorAll("${D} [data-ua-sel]:checked").length === 6 && r.querySelector('${D} [data-ua-sel="${OS}"]').checked && !r.querySelector('${D} [data-ua-sel="${CORE}"]').checked`));
    // Chip "Home Assistant": seine Einträge, mit höchstens einem Neustart-Update
    await ev(`const c = [...r.querySelectorAll("${D} .ua-chips .chip")].find((x) => x.innerText.includes(${JSON.stringify(L.ha)})); c.click()`);
    check(`[${tag}] Chip "${L.ha}": Supervisor und ein Neustart-Update`, await wait(`const s = [...r.querySelectorAll("${D} [data-ua-sel]:checked")].map((x) => x.dataset.uaSel); return s.length === 2 && s.includes("update.home_assistant_supervisor_update") && s.some((x) => x === ${JSON.stringify(CORE)} || x === ${JSON.stringify(OS)})`));
    // Rückfrage: Hinweis zum Neustart; mit einer App zusätzlich der Hinweis zu den Meldungen
    await ev(`const i = r.querySelector('${D} [data-ua-sel="${OS}"]'); if (i.checked) i.click()`);
    await wait(`return !r.querySelector('${D} [data-ua-sel="${OS}"]').checked`);
    await ev(`const i = r.querySelector('${D} [data-ua-sel="${CORE}"]'); if (!i.checked) i.click()`);
    await wait(`return r.querySelector('${D} [data-ua-sel="${CORE}"]').checked`);
    await ev(`const i = r.querySelector('${D} [data-ua-sel="update.esphome_device_builder_update"]'); if (!i.checked) i.click()`);
    await wait(`return r.querySelector('${D} [data-ua-sel="update.esphome_device_builder_update"]').checked`);
    await tap(`${D} [data-ua="next"]`);
    check(`[${tag}] Rückfrage: Hinweis "${L.cCore}" und Hinweis zu App-Updates`, await wait(`const t = r.querySelector("${D} .nf-note")?.innerText || ""; return t.includes(${JSON.stringify(L.cCore)}) && t.includes(${JSON.stringify(L.cApps)})`));
    await tap(`${D} [data-ua="back"]`);
    // Zeile ohne Gerät im Panel (HACS: Dienst-Gerät, das das Panel nicht zeigt): Dialog von Home Assistant, nicht das Geräte-Popup
    await p.evaluate(() => { window.__moreInfo.length = 0; });
    await tap(`${D} [data-ua="info"][data-entity="update.beispiel_karte_update"]`);
    check(`[${tag}] Pfeil einer Zeile ohne Gerät im Panel öffnet den Dialog von Home Assistant (more-info) statt nichts zu tun`, await p.evaluate(() => window.__moreInfo.includes("update.beispiel_karte_update")) && await ev(`return !r.querySelector("dialog.upd-dlg")?.open`));
    // Start: alle gewählten gehen an den Server
    await p.evaluate(() => { window.__uqCalls = []; });
    await tap(`${D} [data-ua="next"]`);
    await tap(`${D} [data-ua="go"]`);
    check(`[${tag}] Start sendet die Auswahl mit dem Core-Update`, await wait(`return true`) && (await p.evaluate(() => (window.__uqCalls || []).at(-1)?.entity_ids || [])).includes(CORE));
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
