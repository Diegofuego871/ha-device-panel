// Printscreens für die README (docs/screenshots/{de,en}/): aus dem HA-Nachbau
// mit erfundenen Daten, Desktop hell, Handy dunkel. Aufruf: node readme-shots.mjs
// Zum Ausprobieren: SHOTS_OUT=/pfad SHOTS_LANGS=de SHOTS_MOBILE=0 SHOTS_ONLY=settings-,routine- node readme-shots.mjs.
// Das Skript erzeugt mehr Bilder, als die README zeigt: nach dem Lauf nur die dort verwendeten Dateien nach docs/screenshots/{de,en}/
// übernehmen (README.md und README.de.md nennen sie; verlustfrei auf 256 Farben gebracht, das spart etwa 60 % Platz). Port 8950 muss frei sein.
// Die Grafiken zum Meldungsprinzip stehen unter docs/graphics/ (node docs/graphics/render.mjs).
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
// Reiterleiste direkt unter die angeheftete Kopfzeile der aufgeklappten Gruppe scrollen (seit 2.97.0 klebt sie unter dem Dialog-Kopf)
const SCROLL_TABS = `const d = r.querySelector("dialog.settings"); const t = d.querySelector(".mon-tabs"); const hb = d.querySelector(".dlg-head").getBoundingClientRect().bottom; const sh = d.querySelector(".set-sec.open > .set-sec-head")?.getBoundingClientRect().height || 0; d.scrollTop += t.getBoundingClientRect().top - hb - sh - 8;`;

for (const lang of langs) {
  mkdirSync(`${root}${lang}`, { recursive: true });
  for (const mobile of modes) {
    // Sprache des Browsers wie die des Panels: Uhrzeitfelder zeigen sonst "10:00 PM" statt "22:00"
    const locale = lang === "de" ? "de-CH" : "en-GB";
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale }
      : { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1.5, locale });
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
    await ev(`r.querySelector('[data-dlg="dev-mon"]').closest(".opt").scrollIntoView({ block: "center" })`);
    await shotDlg("device-settings", "dialog.device");
    await closeDialogs();

    // Puls-Fenster
    await tap(".hero [data-pulse], .pulse-card, [data-pulse-open]").catch(() => {});
    if (await wait(`return r.querySelector("dialog.pulse-dlg")?.open`)) { await shotDlg("pulse", "dialog.pulse-dlg"); await closeDialogs(); }

    // KI-Einschätzung: einschalten, Antwort im Pop-up
    await ev(`r.host._aiOn = true; r.host._renderDevice && 0`);
    await p.evaluate(() => { window.__version = { installed: "2.41.2", latest: "2.41.2" }; window.__opts.notify_service = "notify.mobile_app_iphone"; window.__opts.quiet_enabled = true; });
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await wait(`return !!r.querySelector(".mon-tab")`);
    // Reiter "Allgemein": der Abschnitt "Ziel der Meldungen" steht unter der angehefteten Kopfzeile, darum mittig
    await ev(`r.querySelector(".mon-body > .mon-grp").scrollIntoView({ block: "center" })`);
    // Reiter "Allgemein" (seit 2.96.0): Ziel der Meldungen und Ruhezeit mit den Zeiten je Wochentag
    await shotDlg("settings-general", "dialog.settings");
    await tap('.mon-tab[data-key="integ"]');
    await wait(`return !!r.querySelector(".ilist-row")`);
    await ev(SCROLL_TABS);
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
      if (tab) { await wait(`return !!r.querySelector(".mon-tab")`); await tap(`.mon-tab[data-key="${tab}"]`); await ev(SCROLL_TABS); }
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
      for (const id of ["devices", "routines", "updates"]) {
        await settingsOpen(id);
        // Abschnitt "Panel": der Unterreiter "Updates" (tägliche Prüfung, Zeit, automatisch installieren, Erinnerung)
        if (id === "updates" && (await handle('[data-set="subtab"][data-key="pupdates"]'))) await tap('[data-set="subtab"][data-key="pupdates"]');
        await ev(`r.querySelector('[data-set="section"][data-id="${id}"]').scrollIntoView({ block: "start" })`);
        await shotDlg(`settings-section-${id}`, "dialog.settings");
        await closeDialogs();
      }
    });

    // Sichern und wiederherstellen (seit 2.98.0): das Kapitel unter "Startseite" und die Vorschau der Wiederherstellung
    await step("settings-backup", async () => {
      await settingsOpen("updates");
      await tap('[data-set="subtab"][data-group="panel"][data-key="pstart"]');
      await wait(`return !!r.querySelector('[data-set="bk-export"]')`);
      await ev(`r.querySelector('[data-set="section"][data-id="updates"]').scrollIntoView({ block: "start" })`);
      await shotDlg("settings-panel", "dialog.settings");
      // Das Kapitel selbst: unter Startseite, Sprache, Akzentfarbe und Animationen
      await ev(`r.querySelector('[data-set="bk-export"]').scrollIntoView({ block: "center" })`);
      await shotDlg("settings-backup", "dialog.settings");
    });
    await step("backup-restore", async () => {
      await settingsOpen("updates");
      await tap('[data-set="subtab"][data-group="panel"][data-key="pstart"]');
      await wait(`return !!r.querySelector('[data-set="bk-import"]')`);
      // Eine Sicherung mit Änderungen, einem fehlenden Push-Ziel und einer unbekannten Einstellung (erfundene Daten)
      const file = JSON.parse(await f.evaluate(async () => JSON.stringify((await document.querySelector("device-panel").shadowRoot.host._hass.callWS({ type: "device_panel/backup_export", sections: ["monitor", "display", "devices", "ai"] })).file)));
      file.sections.monitor.options.battery_low = 25;
      file.sections.monitor.options.notify_group_min = 5;
      file.sections.monitor.options.notify_service = "notify.mobile_app_altes_handy";
      file.sections.monitor.options.charge_boost = true;
      file.sections.devices.settings = { "dev-a": { battery: 30 }, "dev-zz": { battery: 10 } };
      const path = `${tmpdir()}/device-panel-backup-shot.json`;
      writeFileSync(path, JSON.stringify(file));
      await tap('[data-set="bk-import"]');
      await wait(`return !!r.querySelector("dialog.backup-dlg input[data-bk-file]")`);
      await (await handle("dialog.backup-dlg input[data-bk-file]")).setInputFiles(path);
      await wait(`return !!r.querySelector("dialog.backup-dlg .bk-sum")`);
      await shotDlg("backup-restore", "dialog.backup-dlg");
      await ev(`r.querySelector('dialog.backup-dlg [data-bk="close"]').click()`);
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
      await wait(`return r.querySelector("dialog.proto-dlg")?.open`);
      await tap('dialog.proto-dlg [data-pr="kind"][data-v="system"]');
      await wait(`return r.querySelectorAll("dialog.proto-dlg .pr-list .lg-row").length > 0`);
      await shotDlg("log", "dialog.proto-dlg");
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
    // Protokoll des Geräts (2.118.0): erfundene Ereignisse, Meldungen und Läufe für das Gerät "d" (Reiter "Alles" und die Auswertung von Magic Push)
    const seedDeviceLog = () => p.evaluate(() => {
      const now = Date.now() / 1000;
      const H = 3600;
      const D = 86400;
      const dev = (extra) => ({ dev: "d", dname: "Klimasensor Keller", ...extra });
      window.__devlog = [
        dev({ at: now - 2400, source: "avail", cat: "outage", k: "online", dur: 540 }),
        dev({ at: now - 2400 - 540, source: "avail", cat: "outage", k: "offline" }),
        dev({ at: now - 3 * H, source: "event", cat: "signal", level: "warning", title: "Steckdose Terrasse", text: window.__lang === "en" ? "reception weak: -86 dBm" : "Empfang schwach: -86 dBm", detail: window.__lang === "en" ? "threshold -80 dBm" : "Schwelle -80 dBm" }),
        dev({ at: now - 1 * D - 6 * H, source: "event", cat: "signal", level: "info", title: "Steckdose Terrasse", text: window.__lang === "en" ? "reception back to normal: -74 dBm" : "Empfang wieder in Ordnung: -74 dBm", detail: window.__lang === "en" ? "threshold -80 dBm" : "Schwelle -80 dBm" }),
        dev({ at: now - 2 * D - 2 * H, source: "avail", cat: "outage", k: "online", dur: 3 * H }),
        dev({ at: now - 2 * D - 2 * H - 3 * H, source: "avail", cat: "outage", k: "offline" }),
        dev({ at: now - 4 * D, source: "event", cat: "updates", level: "info", title: "Steckdose Terrasse", text: window.__lang === "en" ? "firmware 2.1.3 available" : "Firmware 2.1.3 verfügbar", detail: window.__lang === "en" ? "reminder sent" : "Erinnerung gesendet" }),
      ];
      const call = (state) => ({ s: "call", v: { ent: "switch.plug", svc: ["switch.turn_on"], ms: 300, state } });
      window.__protocol = {
        r00000000001: [
          { at: now - 7 * H, k: "recovered", res: "sent", title: window.__lang === "en" ? "Basement warm again: 12.6 °C" : "Keller wieder warm: 12,6 °C", body: "", value: "12,6 °C", dur: 5400, target: "notify.mobile_app_iphone" },
          { at: now - 9 * H, k: "fired", res: "sent", title: window.__lang === "en" ? "Basement is cold: 7.5 °C" : "Keller ist kalt: 7,5 °C", body: "Klimasensor Keller", value: "7,5 °C", target: "notify.mobile_app_iphone" },
          { at: now - 3 * D, k: "fired", res: "held", title: window.__lang === "en" ? "Basement is cold: 7.9 °C" : "Keller ist kalt: 7,9 °C", body: "", value: "7,9 °C", target: "notify.mobile_app_iphone" },
          { at: now - 9 * D, k: "fired", res: "sent", title: window.__lang === "en" ? "Basement is cold: 6.8 °C" : "Keller ist kalt: 6,8 °C", body: "", value: "6,8 °C", target: "notify.mobile_app_iphone" },
        ],
        r00000000002: [{ at: now - 1 * D - 1 * H, k: "fired", res: "sent", title: window.__lang === "en" ? "Air too humid: 66 %" : "Luft zu feucht: 66 %", body: "", value: "66 %", target: "notify.mobile_app_iphone" }],
        aaaaaaaaaaa1: [
          { at: now - 20 * H, k: "run", src: "time", ok: true, act: "on", ent: "switch.plug", late: 1.4, trace: [{ s: "trigger", v: { src: "time", due: now - 20 * H - 1.4, late: 1.4, grace: 900 } }, { s: "snapshot", v: { state: "off" } }, call("on"), { s: "result", v: { what: "run" } }] },
          { at: now - 19 * H - 900, k: "revert", src: "revert", ok: true, act: "off", ent: "switch.plug", trace: [{ s: "trigger", v: { src: "revert", due: now - 19 * H - 900, kind: "duration" } }, call("off"), { s: "result", v: { what: "revert" } }] },
          { at: now - 1 * D - 20 * H, k: "run", src: "time", ok: true, act: "on", ent: "switch.plug", late: 0.9, trace: [{ s: "trigger", v: { src: "time", due: now - D - 20 * H, late: 0.9, grace: 900 } }, call("on"), { s: "result", v: { what: "run" } }] },
        ],
      };
    });
    await step("devicelog", async () => {
      await p.evaluate((l) => { window.__lang = l; }, lang);
      await seedDeviceLog();
      await open("d");
      await tap('dialog.device .dlg-head [data-proto="all"]');
      await wait(`return r.querySelector("dialog.proto-dlg")?.open && r.querySelectorAll("dialog.proto-dlg .al-row").length >= 6`);
      await shotDlg("devicelog", "dialog.proto-dlg");
      // Die Auswertung von Magic Push im selben Fenster
      await tap('dialog.proto-dlg [data-pr-kinds] .sub-tab[data-v="magic"]');
      await wait(`return !!r.querySelector("dialog.proto-dlg .pr-chart")`);
      await shotDlg("devicelog-magic", "dialog.proto-dlg");
    });
    // Speicher (2.117.0): drittes Reiter im Abschnitt "Panel"; erfundene Belegung
    await step("settings-storage", async () => {
      await p.evaluate(() => { const MB = 1048576; window.__usage = { protocol: { bytes: 3.1 * MB, entries: 640, items: 6, max_item: 212 }, log: { bytes: 2.6 * MB, entries: 603 } }; });
      await settingsOpen("updates");
      await tap('[data-set="subtab"][data-group="panel"][data-key="pstorage"]');
      await wait(`return !!r.querySelector("dialog.settings .sto-big")`);
      // Summe und Geräteverläufe sichtbar: unter dem angehefteten Kopf (Dialog-Kopf und Abschnitt) beginnen
      await ev(`const d = r.querySelector("dialog.settings"); r.querySelector(".sto-total").scrollIntoView({ block: "start" }); d.scrollTop -= d.querySelector(".dlg-head").offsetHeight + 50`);
      await shotDlg("settings-storage", "dialog.settings");
    });
    await step("columns", async () => {
      // Seit 2.87.0: Dialog "Ansicht" (Reiter Spalten bzw. Sortierung) in den Einstellungen im Ansichtsmodus
      // Am Handy gibt es den Knopf der Werkzeugleiste nicht, dort öffnet die Zeile "Sortierung & Ansicht" den Dialog
      await tap(mobile ? "[data-view-open]" : ".view-btn");
      await wait(`return r.querySelector("dialog.settings")?.open`);
      // Die Reiter ("Spalten", "Filter-Chips") erscheinen, sobald die Optionen geladen sind
      await wait(`return r.querySelectorAll('dialog.settings [data-set="vtab"]').length >= 2`);
      await ev(`const d = r.querySelector("dialog.settings"); d.scrollTop = 0; d.querySelectorAll("*").forEach((e) => { if (e.scrollTop) e.scrollTop = 0; })`);
      await shotDlg("columns", "dialog.settings");
      await closeDialogs();
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
      await ev(SCROLL_TABS);
      // Die Zeilen "Überwachen", "Online-Status beobachten" und "Ausgefallen nach" (seit 2.156.0) unter die Reiter holen
      await ev(`const o = r.querySelector("[data-imon]").closest(".opt"); o.scrollIntoView({ block: "center" }); let sc = o.parentElement; while (sc && sc.scrollHeight <= sc.clientHeight) sc = sc.parentElement; if (sc) sc.scrollTop -= 90;`);
      await shotDlg("integ-detail", "dialog.settings");
    });
    // Ohne Online-Status (seit 2.156.0): Geräte mit Ring, Zeile in der Kachel "Verfügbarkeit", Chip
    await step("nostatus", async () => {
      await p.evaluate(() => { window.__opts.offline_after_integrations = { esphome: "nostatus", bthome: "nostatus" }; });
      await ev(`return r.host._fetch(true).then(() => true)`);
      await wait(`return !!r.querySelector(".lines i.ring")`);
      await shot("nostatus");
      await p.evaluate(() => { window.__opts.offline_after_integrations = {}; });
      await ev(`return r.host._fetch(true).then(() => true)`);
    });
    // Labels (seit 2.155.0): Reiter in "Überwachung und Meldungen" mit einem Label, das ohne Online-Status ist
    await step("settings-labels", async () => {
      await p.evaluate((LANGNAME) => {
        window.__labels = [{ id: "oft_offline", name: LANGNAME }];
        window.__devLabels = { b: ["oft_offline"], e: ["oft_offline"] };
        window.__opts.labels = ["oft_offline"];
        window.__opts.offline_after_integrations = { "label:oft_offline": "nostatus" };
      }, lang === "de" ? "Oft offline" : "Often offline");
      await ev(`return r.host._fetch(true).then(() => true)`);
      await settingsOpen("monitor", "labels");
      await wait(`return !!r.querySelector(".ilist-row")`);
      await tap(".ilist-row");
      await wait(`return !!r.querySelector('[data-istatus]')`);
      await ev(SCROLL_TABS);
      await ev(`const o = r.querySelector("[data-imon]").closest(".opt"); o.scrollIntoView({ block: "center" }); let sc = o.parentElement; while (sc && sc.scrollHeight <= sc.clientHeight) sc = sc.parentElement; if (sc) sc.scrollTop -= 90;`);
      await shotDlg("settings-labels", "dialog.settings");
      await p.evaluate(() => { window.__opts.labels = []; window.__opts.offline_after_integrations = {}; window.__labels = []; window.__devLabels = {}; });
      await ev(`return r.host._fetch(true).then(() => true)`);
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
