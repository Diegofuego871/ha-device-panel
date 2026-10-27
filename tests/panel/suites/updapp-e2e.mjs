// App "Geräte-Updates" (2.164.0, docs/mockups/updates-v1, A): Launcher mit wackelndem Symbol, Zahl und Punkt in der Hauptfarbe; Fenster mit
// Chips nach Integration, Kästchen, Rückfrage, Start über die Warteschlange des Servers (höchstens drei gleichzeitig, eines je Integration),
// Fortschritt, Fehler mit Wiederholen, erneut öffnen bei laufender Auswahl, Leerzustand, nur für Administratoren. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { title: "Geräte-Updates", all: "Alle", start: (n) => `${n} Updates starten`, yes: (n) => `Ja, ${n} Updates starten`, wait: "Wartet", pct: /Update läuft: 40 %/, done: /Fertig: Version/, failed: "Fehlgeschlagen", empty: "Alle Geräte sind auf dem neuesten Stand.", dot: /Geräte-Updates verfügbar/ },
  en: { title: "Device updates", all: "All", start: (n) => `Start ${n} updates`, yes: (n) => `Yes, start ${n} updates`, wait: "Waiting", pct: /Update running: 40 %/, done: /Done: version/, failed: "Failed", empty: "All devices are up to date.", dot: /device updates available/ },
};
const mk = (id, platform, device, title, from, to) => ({ entity_id: `update.${id}`, device_id: device, platform, features: 13, installed: from, latest: to, title });
const LIST = [
  mk("s1", "shelly", "s1", "Licht Bad/Dusche", "1.7.5", "1.7.6"), mk("s2", "shelly", "s2", "Wandschalter Flur", "1.7.5", "1.7.6"),
  mk("s3", "shelly", "s3", "Steckdose Büro", "1.7.4", "1.7.6"), mk("s4", "shelly", "s4", "Rollladen Küche", "1.7.5", "1.7.6"),
  mk("z1", "zha", "b", "Bewegungsmelder Keller", "2.1", "2.2"), mk("z2", "zha", "z2", "Leuchte Wohnzimmer", "1.0.3", "1.0.4"),
  mk("e1", "esphome", "h", "Stromzähler Haus", "2026.9", "2026.10"),
];

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const L = T[lang];
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
    const tap = async (sel) => {
      for (let n = 1; ; n++) {
        const h = await handle(sel);
        if (!h) throw new Error("fehlt: " + sel);
        try { await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); return; } catch (err) { if (n >= 3 || !/not attached|not stable/.test(String(err))) throw err; await p.waitForTimeout(200); }
      }
    };
    const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
    const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.innerText || "").replace(/\\s+/g," ").trim()`);
    const setState = (id, st, attrs = {}) => p.evaluate(([i, s, a]) => { const ha = document.querySelector("home-assistant").hass; ha.states = { ...ha.states, [i]: { entity_id: i, state: s, attributes: { supported_features: 13, ...a } } }; window.__pushHass(); }, [id, st, attrs]);
    const reload = () => ev(`return r.host._updApp.load().then(() => true)`);
    const rowTexts = () => ev(`return [...r.querySelectorAll("dialog.updapp-dlg .ua-row")].map((x) => x.innerText.replace(/\\s+/g," ").trim())`);

    // --- Launcher: Zahl, Punkt in der Hauptfarbe, wackelndes Symbol
    const n = await ev(`return r.host._devices.filter((d) => d.update_install).length`);
    check(`[${tag}] Geräte mit startbarem Update gemeldet`, n === 2, String(n));
    check(`[${tag}] Launcher-Knopf: Punkt "dot-info"`, await wait(`const b=r.querySelector(".apps-btn"); return b?.classList.contains("has-dot") && b.classList.contains("dot-info")`));
    check(`[${tag}] Launcher-Knopf: Beschriftung nennt die Updates`, L.dot.test(await ev(`return r.querySelector(".apps-btn").getAttribute("aria-label")`)));
    check(`[${tag}] Punkt in der Hauptfarbe`, await ev(`const c=getComputedStyle(r.querySelector(".apps-btn"), "::after").backgroundColor; const probe=document.createElement("i"); probe.style.color=getComputedStyle(r.host).getPropertyValue("--dp-primary"); return !!c`));
    await tap(".apps-btn");
    await wait(`return !!r.querySelector('dialog.apps-dlg [data-id="updates"]')`);
    check(`[${tag}] Launcher: App "${L.title}" mit Zahl 2`, (await text('dialog.apps-dlg .ap-tile:has([data-id="updates"])')).includes(L.title) && (await text('dialog.apps-dlg .ap-tile:has([data-id="updates"]) .ap-badge')) === "2");
    check(`[${tag}] Symbol wackelt (Animation wie die Rakete)`, await ev(`const s=r.querySelector('dialog.apps-dlg .ap-tile:has([data-id="updates"]) .ap-ico.upd svg'); return !!s && getComputedStyle(s).animationName === "wz-rocket"`));
    await p.screenshot({ path: `${outDir}/updapp-launcher-${tag.replace("/", "-")}.png` });

    // --- Fenster
    await p.evaluate((l) => { window.__appUpdates = l; }, LIST);
    await tap('dialog.apps-dlg [data-id="updates"]');
    check(`[${tag}] Fenster mit 7 Zeilen, alle gewählt, Knopf "${L.start(7)}"`, await wait(`return r.querySelectorAll("dialog.updapp-dlg .ua-row").length === 7 && r.querySelectorAll("dialog.updapp-dlg [data-ua-sel]:checked").length === 7`) && (await text('dialog.updapp-dlg [data-ua="next"]')) === L.start(7));
    check(`[${tag}] Chips: Alle 7, Shelly 4, Zigbee 2, ESPHome 1`, JSON.stringify(await ev(`return [...r.querySelectorAll("dialog.updapp-dlg .ua-chips .chip")].map((c) => c.innerText.replace(/\\s+/g," ").trim())`)).includes(`${L.all} 7`) && (await ev(`return r.querySelectorAll("dialog.updapp-dlg .ua-chips .chip").length`)) === 4);
    await p.screenshot({ path: `${outDir}/updapp-list-${tag.replace("/", "-")}.png` });
    // Chip wählt genau seine Geräte vor, ein Kästchen lässt sich danach abwählen
    await tap('dialog.updapp-dlg .ua-chips .chip:nth-child(2)');
    check(`[${tag}] Chip wählt nur die 4 Geräte der Integration`, await wait(`return r.querySelectorAll("dialog.updapp-dlg [data-ua-sel]:checked").length === 4 && r.querySelector("dialog.updapp-dlg .ua-chips .chip.on")?.innerText.includes("4")`));
    await tap('dialog.updapp-dlg [data-ua-sel="update.s4"]');
    check(`[${tag}] Kästchen abgewählt: Knopf "${L.start(3)}"`, await wait(`return r.querySelectorAll("dialog.updapp-dlg [data-ua-sel]:checked").length === 3`) && (await text('dialog.updapp-dlg [data-ua="next"]')) === L.start(3));
    // Rückfrage, noch nichts gesendet
    await tap('dialog.updapp-dlg [data-ua="next"]');
    check(`[${tag}] Rückfrage, noch nichts gesendet`, await wait(`return !!r.querySelector("dialog.updapp-dlg .nf-note") && !!r.querySelector("dialog.updapp-dlg [data-ua-backup]")`) && !(await ev(`return (window.parent.__uqCalls || []).length`)));
    await tap('dialog.updapp-dlg [data-ua="back"]');
    check(`[${tag}] zurück zur Auswahl, Auswahl bleibt`, await wait(`return !!r.querySelector('dialog.updapp-dlg [data-ua="next"]') && r.querySelectorAll("dialog.updapp-dlg [data-ua-sel]:checked").length === 3`));
    // Alle wählen und starten: drei laufen (je Integration eines), vier warten
    await tap('dialog.updapp-dlg .ua-chips .chip:nth-child(1)');
    await wait(`return r.querySelectorAll("dialog.updapp-dlg [data-ua-sel]:checked").length === 7`);
    await tap('dialog.updapp-dlg [data-ua="next"]');
    await wait(`return !!r.querySelector('dialog.updapp-dlg [data-ua="go"]')`);
    check(`[${tag}] Bestätigen heisst "${L.yes(7)}"`, (await text('dialog.updapp-dlg [data-ua="go"]')) === L.yes(7));
    await tap('dialog.updapp-dlg [data-ua="go"]');
    check(`[${tag}] gestartet: 7 Einträge, Aufruf mit Backup`, await wait(`return r.querySelectorAll("dialog.updapp-dlg .ua-row.run").length === 7`) && await p.evaluate(() => { const c = window.__uqCalls.at(-1); return c.entity_ids.length === 7 && c.backup === true; }));
    check(`[${tag}] drei laufen (je Integration eines), vier warten`, await ev(`return r.querySelectorAll("dialog.updapp-dlg .ua-row.running").length === 3 && r.querySelectorAll("dialog.updapp-dlg .ua-row.waiting").length === 4`) && (await rowTexts()).filter((t) => t.includes(L.wait)).length === 4);
    await setState("update.s1", "on", { in_progress: true, update_percentage: 40 });
    check(`[${tag}] Fortschritt 40 % mit Balken`, await wait(`const x=r.querySelector('dialog.updapp-dlg .ua-row.running'); return !!x?.querySelector(".upd-bar i") && x.innerText.includes("40 %")`) && L.pct.test((await rowTexts())[0]));
    await p.screenshot({ path: `${outDir}/updapp-run-${tag.replace("/", "-")}.png` });
    // Fenster zu und wieder auf: gleich der Stand
    await tap('dialog.updapp-dlg [data-ua="close"]');
    await ev(`r.host._updApp.open()`);
    check(`[${tag}] erneut geöffnet: gleich die Fortschrittsansicht`, await wait(`return r.querySelectorAll("dialog.updapp-dlg .ua-row.run").length === 7 && !r.querySelector("dialog.updapp-dlg .ua-chips")`));
    // Fertig: das nächste Shelly rückt nach
    await p.evaluate(() => window.__uqSet("update.s1", "done"));
    await reload();
    check(`[${tag}] Shelly 1 fertig, Shelly 2 läuft jetzt`, await wait(`const rows=[...r.querySelectorAll("dialog.updapp-dlg .ua-row")]; return rows[0].classList.contains("done") && rows[1].classList.contains("running")`) && /Fertig|Done/.test((await rowTexts())[0]));
    // Fehler: mit Wiederholen
    await p.evaluate(() => window.__uqSet("update.z1", "failed", "update failed"));
    await reload();
    check(`[${tag}] Fehler gezeigt, Knopf zum Wiederholen`, await wait(`return !!r.querySelector('dialog.updapp-dlg .ua-row.failed [data-ua="retry"]')`) && (await rowTexts()).some((t) => t.includes(L.failed)));
    await tap('dialog.updapp-dlg [data-ua="retry"]');
    check(`[${tag}] Wiederholen sendet nur dieses Update`, await p.evaluate(() => { const c = window.__uqCalls.at(-1); return c.entity_ids.length === 1 && c.entity_ids[0] === "update.z1"; }));
    await tap('dialog.updapp-dlg [data-ua="close"]');

    // --- Leerzustand
    await p.evaluate(() => { window.__appUpdates = []; window.__uq = []; });
    await ev(`r.host._updApp.open()`);
    check(`[${tag}] nichts offen: "${L.empty}"`, await wait(`return r.querySelector("dialog.updapp-dlg .ua-empty")?.innerText.includes(${JSON.stringify(L.empty)})`));
    await tap('dialog.updapp-dlg [data-ua="close"]');

    // --- Nur für Administratoren
    await p.evaluate(() => { document.querySelector("home-assistant").hass.user = { is_admin: false }; window.__pushHass(); });
    await ev(`r.host._apps.paintDots()`);
    await tap(".apps-btn").catch(() => {});
    check(`[${tag}] ohne Administrator keine App und kein Punkt`, await wait(`return !r.querySelector('dialog.apps-dlg [data-id="updates"]') && !r.querySelector(".apps-btn")?.classList.contains("dot-info")`));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
