// Printscreens für die README (docs/screenshots/{de,en}/): aus dem HA-Nachbau
// mit erfundenen Daten, Desktop hell, Handy dunkel. Aufruf: node readme-shots.mjs
// Zum Ausprobieren: SHOTS_OUT=/pfad SHOTS_LANGS=de SHOTS_MOBILE=0 SHOTS_ONLY=settings-,routine- node readme-shots.mjs.
// Das Skript erzeugt mehr Bilder, als die README zeigt: nach dem Lauf nur die dort verwendeten Dateien nach docs/screenshots/{de,en}/
// übernehmen (README.md und README.de.md nennen sie; verlustfrei auf 256 Farben gebracht, das spart etwa 60 % Platz). Port 8950 muss frei sein.
// Die Grafiken zum Meldungsprinzip stehen unter docs/graphics/ (node docs/graphics/render.mjs).
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { launchOptions } from "./lib.mjs";
import { startServer } from "./server.mjs";

// SHOTS_OUT: anderer Zielordner (zum Ausprobieren), SHOTS_LANGS: "de" oder "en", SHOTS_ONLY: Namen, durch Komma getrennt
const root = process.env.SHOTS_OUT ? `${process.env.SHOTS_OUT}/` : fileURLToPath(new URL("../../docs/screenshots/", import.meta.url));
const langs = (process.env.SHOTS_LANGS || "de,en").split(",");
const only = process.env.SHOTS_ONLY ? new Set(process.env.SHOTS_ONLY.split(",")) : null;
const modes = process.env.SHOTS_MOBILE === "1" ? [true] : process.env.SHOTS_MOBILE === "0" ? [false] : [false, true];
const server = await startServer(8950);
const b = await chromium.launch(launchOptions);
const R = `document.querySelector("device-panel").shadowRoot`;

for (const lang of langs) {
  mkdirSync(`${root}${lang}`, { recursive: true });
  for (const mobile of modes) {
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1.5 });
    const p = await ctx.newPage();
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=${mobile ? "dark" : "light"}&nobrands=1`);
    const frameEl = await p.waitForSelector("#panel-frame");
    const f = await frameEl.contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 8000 }).then(() => true, () => false);
    const m = mobile ? "-mobile" : "";
    const shot = async (name) => { if (only && ![...only].some((n) => name.startsWith(n))) return; await p.waitForTimeout(500); await frameEl.screenshot({ path: `${root}${lang}/${name}${m}.png` }); };
    // Nur das geöffnete Fenster (ohne Hintergrund) als Bild
    const shotDlg = async (name, sel) => {
      if (only && ![...only].some((n) => name.startsWith(n))) return;
      await p.waitForTimeout(500);
      const h = await handle(sel);
      if (!h) throw new Error("fehlt: " + sel);
      await h.screenshot({ path: `${root}${lang}/${name}${m}.png` });
    };
    const closeDialogs = async () => {
      await ev(`r.querySelectorAll("dialog[open]").forEach((d) => d.close())`);
      await wait(`return ![...r.querySelectorAll("dialog")].some(d=>d.open)`);
    };
    const open = async (id) => { await tap(`.dev[data-open="${id}"]`); await wait(`return r.querySelector("dialog.device")?.open`); };

    await shot("overview");
    if (mobile) { await ev(`window.scrollTo(0, 0)`); }

    // Pop-up eines instabilen Geräts mit Batterie
    await open("e");
    await shotDlg("popup", "dialog.device");
    // Batterie-Verlauf mit Prognose (3 Monate)
    await tap('dialog.device .st-tile[data-kind="battery"]');
    await wait(`return r.querySelector("dialog.stat-dlg")?.open && !!r.querySelector("dialog.stat-dlg .bh-svg")`);
    await tap('dialog.stat-dlg [data-stat="range"][data-range="90d"]');
    await wait(`return r.querySelector('dialog.stat-dlg [data-range="90d"]')?.classList.contains("on") && !!r.querySelector("dialog.stat-dlg .bh-fc")`);
    await shotDlg("battery", "dialog.stat-dlg");
    await closeDialogs();

    // Verfügbarkeit: Statistik 7 Tage (Gerät a, ausgefallen)
    await open("a");
    await tap('dialog.device [data-dlg="stat"][data-range="7d"][data-kind="avail"]');
    await wait(`return r.querySelector("dialog.stat-dlg")?.open && !!r.querySelector("dialog.stat-dlg .avail-bar")`);
    await shotDlg("availability", "dialog.stat-dlg");
    await closeDialogs();

    // Empfang (Gerät mit Empfang: d = Zigbee im Simulator falls vorhanden)
    for (const id of ["b", "c", "d", "e", "a"]) {
      await open(id);
      if (await ev(`return !!r.querySelector('dialog.device .st-tile[data-kind="signal"]')`)) {
        await tap('dialog.device .st-tile[data-kind="signal"]');
        if (await wait(`return r.querySelector("dialog.stat-dlg")?.open && !!r.querySelector("dialog.stat-dlg .bh-svg")`)) { await shotDlg("signal", "dialog.stat-dlg"); await closeDialogs(); break; }
      }
      await closeDialogs();
    }

    // Einstellungen für dieses Gerät: eigene Zeit, eigene Batterie-Schwelle, Meldungen aus
    await open("e");
    await tap('dialog.device [data-tab="set"]');
    const sub = async (tab) => { await ev(`const b = r.querySelector('dialog.device [data-stab="${tab}"]'); if (b && !b.classList.contains("on")) b.click()`); await p.waitForTimeout(250); };
    await sub("out");
    await (await handle('select[data-dlg="dev-off"]')).selectOption("own");
    await wait(`return r.querySelector('input[data-dlg="dev-off-min"]')?.value === "2"`);
    await (await handle('input[data-dlg="dev-off-min"]')).fill("90");
    await p.keyboard.press("Tab");
    await wait(`return r.host._devices.find((d) => d.id === "e").offline_after === 90`);
    await sub("bat");
    await (await handle('select[data-dlg="dev-bat"]')).selectOption("own");
    await wait(`return r.querySelector('input[data-dlg="dev-bat-pct"]')?.value === "15"`);
    await (await handle('input[data-dlg="dev-bat-pct"]')).fill("30");
    await p.keyboard.press("Tab");
    await wait(`return r.host._devices.find((d) => d.id === "e").battery_setting === 30`);
    await sub("out");
    await (await handle('select[data-dlg="dev-notify"]')).selectOption("off");
    await wait(`return r.querySelector('select[data-dlg="dev-notify"]')?.value === "off"`);
    await ev(`r.querySelector(".dev-set").scrollIntoView({ block: "center" })`);
    await shotDlg("device-settings", "dialog.device");
    await closeDialogs();

    // Puls-Fenster
    await tap(".hero [data-pulse], .pulse-card, [data-pulse-open]").catch(() => {});
    if (await wait(`return r.querySelector("dialog.pulse-dlg")?.open`)) { await shotDlg("pulse", "dialog.pulse-dlg"); await closeDialogs(); }

    // KI-Einschätzung: einschalten, Antwort im Pop-up
    await ev(`r.host._aiOn = true; r.host._renderDevice && 0`);
    await p.evaluate(() => { window.__version = { installed: "2.41.2", latest: "2.41.2" }; window.__opts.notify_service = "notify.mobile_app_iphone"; });
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await wait(`return !!r.querySelector(".mon-tab")`);
    await ev(`r.querySelector("dialog.settings .mon-tabs").scrollIntoView({ block: "start" })`);
    await shotDlg("settings-monitor", "dialog.settings");
    await tap('.mon-tab[data-key="integ"]');
    await wait(`return !!r.querySelector(".ilist-row")`);
    await ev(`r.querySelector("dialog.settings .mon-tabs").scrollIntoView({ block: "start" })`);
    await shotDlg("settings-integrations", "dialog.settings");
    await tap('[data-set="section"][data-id="monitor"]');
    await tap('[data-set="section"][data-id="ai"]');
    await tap('.switch input[data-opt="ai_assessment"]');
    await ev(`const a=r.querySelector('input[data-opt="ai_expert"], input[data-set="expert"]'); if (a && !a.checked) a.click()`);
    await ev(`(r.querySelector(".aip-box") || r.querySelector('[data-id="ai"]')).scrollIntoView({ block: "center" })`);
    await shotDlg("settings-ai", "dialog.settings");
    await tap('dialog.settings [data-set="save"]');
    await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`);
    await tap('dialog.settings [data-set="close"]');
    await wait(`return !r.querySelector("dialog.settings").open`);
    await wait(`return r.host._aiOn === true`);
    await open("b");
    if (await wait(`return !!r.querySelector(".ai-btn")`)) {
      await tap(".ai-btn");
      await wait(`return !!r.querySelector(".ai-title") && !!r.querySelector(".ai-foot")`);
      await shotDlg("ai", "dialog.device");
    }
    await closeDialogs();

    // --- Weitere Bilder (2.41.2, README neu) ---------------------------------------------------------------------
    const step = async (name, fn) => {
      if (only && ![...only].some((n) => n.startsWith(name) || name.startsWith(n))) return;
      try { await fn(); } catch (err) { console.log("FEHLT", lang, mobile ? "mobile" : "desktop", name, String(err.message).split("\n")[0]); }
      await closeDialogs().catch(() => {});
    };
    const settingsOpen = async (section, tab) => {
      await tap(".gear-btn");
      await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
      if (!(await ev(`return r.querySelector('[data-set="section"][data-id="${section}"]')?.getAttribute("aria-expanded") === "true"`))) await tap(`[data-set="section"][data-id="${section}"]`);
      if (tab) { await wait(`return !!r.querySelector(".mon-tab")`); await tap(`.mon-tab[data-key="${tab}"]`); await ev(`r.querySelector("dialog.settings .mon-tabs").scrollIntoView({ block: "start" })`); }
      await p.waitForTimeout(300);
    };
    // Erfundene Daten: Routine, Magic-Push-Meldungen, Ladevorgänge
    await p.evaluate(() => {
      const routine = (id, device, name, extra = {}) => ({ id, device_id: device, entity_id: "switch.plug", name, action: "on", back_s: null, kind: "repeat", delay_s: null, date: null, time: "06:30", repeat: "daily", weekdays: null, mday: null, enabled: true, push: false, target: null, created: Date.now() / 1000, ...extra });
      (window.__routines ||= { list: [], seq: 1, runs: [], tests: [] }).list.push(
        routine("aaaaaaaaaaa1", "d", "Bewässerung Morgen", { time: "06:30", back_s: 900 }),
        routine("aaaaaaaaaaa2", "a", "Nachtlicht", { action: "off", time: "23:00", repeat: "weekly", weekdays: [0, 1, 2, 3, 4] }),
      );
      const rule = (id, device, name, entity, extra = {}) => ({ id, device_id: device, entity_id: entity, name, kind: "below", value: 12, for_s: 600, message: "Meldung {value}", body: "", recover: false, recover_message: "", recover_body: "", repeat_s: 0, target: null, enabled: true, critical: false, critical_volume: 10, reset_value: null, ...extra });
      window.__opts.notify_service = "notify.mobile_app_iphone";
      window.__magic = { tests: [], seq: 10, rules: [
        rule("r00000000001", "d", "Keller zu kalt", "sensor.temp", { value: 8, for_s: 1800, recover: true, recover_message: "Keller wieder warm" }),
        rule("r00000000002", "d", "Luft zu feucht", "sensor.abs_humidity", { kind: "above", value: 65 }),
        rule("r00000000003", "h", "Fenster zu lange offen", "binary_sensor.window", { kind: "is", value: "on", for_s: 2700, reset_value: "off" }),
      ] };
    });

    await step("settings-", async () => {
      for (const tabKey of ["outage", "battery", "charge", "new", "updates", "sig"]) {
        await settingsOpen("monitor", tabKey);
        await shotDlg(`settings-${tabKey}`, "dialog.settings");
        await closeDialogs();
      }
    });
    await step("settings-section-", async () => {
      for (const id of ["devices", "look", "routines", "updates"]) {
        await settingsOpen(id);
        await ev(`r.querySelector('[data-set="section"][data-id="${id}"]').scrollIntoView({ block: "start" })`);
        await shotDlg(`settings-section-${id}`, "dialog.settings");
        await closeDialogs();
      }
    });

    await step("launcher", async () => {
      await tap(".apps-btn");
      await wait(`return r.querySelector("dialog.apps-dlg")?.open`);
      await shotDlg("launcher", "dialog.apps-dlg");
    });
    await step("log", async () => {
      await tap(".apps-btn");
      await wait(`return r.querySelector("dialog.apps-dlg")?.open`);
      await tap('dialog.apps-dlg [data-ap="open"][data-id="log"]');
      await wait(`return r.querySelector("dialog.log-dlg")?.open`);
      await shotDlg("log", "dialog.log-dlg");
    });
    await step("routines-all", async () => {
      await tap('.toolbar .app-pin[data-app-pin="routine"]');
      await wait(`return r.querySelector("dialog.rtall-dlg")?.open`);
      await tap('dialog.rtall-dlg [data-rta="routine-fold-all"]');
      await wait(`return r.querySelectorAll("dialog.rtall-dlg .mg-card").length >= 2`);
      await shotDlg("routines-all", "dialog.rtall-dlg");
    });
    await step("magic-all", async () => {
      await ev(`r.host._openMagicAll()`);
      await wait(`return r.querySelectorAll("dialog.mgall-dlg .mg-dhead").length >= 2`);
      await shotDlg("magic-all", "dialog.mgall-dlg");
    });
    await step("routine-", async () => {
      await open("d");
      await tap('dialog.device [data-tab="routine"]');
      await wait(`return !!r.querySelector(".rt-root .mg-card")`);
      await shotDlg("routine-tab", "dialog.device");
      await tap('.rt-root [data-rt="add"]');
      await wait(`return r.querySelector("dialog.routine-dlg")?.open`);
      await tap('dialog.routine-dlg .mg-pick');
      await tap('dialog.routine-dlg [data-rt="nav-next"]');
      await p.waitForTimeout(400);
      await shotDlg("routine-wizard", "dialog.routine-dlg");
    });
    await step("magic-", async () => {
      await open("d");
      await tap('dialog.device [data-tab="magic"]');
      await wait(`return !!r.querySelector("dialog.device .mg-card")`);
      await shotDlg("magic-tab", "dialog.device");
      await tap('dialog.device [data-mg="add"]');
      await wait(`return r.querySelector("dialog.magic-dlg, dialog.mg-dlg")?.open`);
      await p.waitForTimeout(400);
      await shotDlg("magic-wizard", await ev(`return r.querySelector("dialog.magic-dlg") ? "dialog.magic-dlg" : "dialog.mg-dlg"`));
    });
    await step("columns", async () => {
      await tap(".view-btn");
      await wait(`return r.querySelector("dialog.cols-dlg")?.open`);
      await shotDlg("columns", "dialog.cols-dlg");
    });
    // Das Bluetooth-Gerät wird als erreichbar gezeigt (im Simulator ist es ausgefallen), damit der Weg im Bild nicht leer wirkt
    await step("signal-via", async () => {
      const saved = await p.evaluate(() => JSON.stringify(window.__devices.find((x) => x.id === "a")));
      await p.evaluate(() => { Object.assign(window.__devices.find((x) => x.id === "a"), { online: true, offline_since: null, since_at_least: false, signal: { kind: "dbm", value: -74 }, via: "Storen Büro" }); });
      await ev(`r.host._fetch(true)`);
      await open("a");
      await tap('dialog.device .st-tile[data-kind="signal"]');
      await wait(`return !!r.querySelector("dialog.stat-dlg .sv")`);
      await ev(`r.querySelector("dialog.stat-dlg .sv").scrollIntoView({ block: "center" })`);
      await shotDlg("signal-via", "dialog.stat-dlg");
      await closeDialogs();
      await p.evaluate((js) => { Object.assign(window.__devices.find((x) => x.id === "a"), JSON.parse(js)); }, saved);
      await ev(`r.host._fetch(true)`);
    });
    await step("charging", async () => {
      await p.evaluate(() => { window.__charging = { e: { level: 62, from: 30, ago: 1800 }, i: { level: 41, from: 20, ago: 900 } }; });
      await ev(`r.host._fetch(true)`);
      await wait(`return !!r.querySelector('.chip.hint[data-hint="charging"]')`);
      await tap('.chip.hint[data-hint="charging"]');
      await p.waitForTimeout(400);
      await shot("charging");
      await tap('.chip.hint[data-hint="charging"]');
    });
    await step("new", async () => {
      await tap('.chip.hint[data-hint="new"]');
      await p.waitForTimeout(400);
      await shot("new");
      await tap('.chip.hint[data-hint="new"]');
    });
    await step("integ-detail", async () => {
      await settingsOpen("monitor", "integ");
      await wait(`return !!r.querySelector(".ilist-row")`);
      await tap(".ilist-row");
      await wait(`return !!r.querySelector('[data-set="isub"]')`);
      await ev(`r.querySelector("dialog.settings .mon-tabs").scrollIntoView({ block: "start" })`);
      await shotDlg("integ-detail", "dialog.settings");
    });
    await step("warnings", async () => {
      await tap('.chip[data-problems]');
      await p.waitForTimeout(400);
      await shot("warnings");
      await tap('.chip[data-problems]');
    });
    await step("batteries", async () => {
      await tap('.chip.hint[data-hint="batteries"]');
      await p.waitForTimeout(400);
      await shot("batteries");
      await tap('.chip.hint[data-hint="batteries"]');
    });
    await step("area", async () => {
      await tap("[data-area-open]");
      await p.waitForTimeout(500);
      await shot("area");
    });
    await ctx.close();
  }
}
await b.close();
server.close();
console.log("fertig", root);
