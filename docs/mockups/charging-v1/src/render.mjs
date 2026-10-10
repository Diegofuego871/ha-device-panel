// Mockups "Lademeldung" und "Update-Erinnerung" (Wünsche des Nutzers, 2026-10-10).
//  1-Laden-Einstellungen.png: Batterie-Reiter (Abschnitt "Laden") und Geräte-Popup (Zeile "Laden melden").
//  2-Laden-Erkennung.png: wie das Laden erkannt wird (Verlauf mit Regeln), zwei Fälle.
//  3-Updates.png: neuer Reiter "Updates" unter Überwachung und Meldungen, mit Vorschau.
// Im echten Panel (Nachbau aus tests/panel, erfundene Daten), Zusätze eingesetzt.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/charging-v1/src/render.mjs
import { setup } from "../../_lib/mock.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
const { page, shot, compose, close } = await setup(8968, import.meta.url);
const tmp = new URL("./out/", import.meta.url).pathname;

const sw = (on) => `<label class="switch"><input type="checkbox" ${on ? "checked" : ""}><span></span></label>`;
const sel = (opts, v) => `<span class="opt-select"><select>${opts.map((o) => `<option ${o === v ? "selected" : ""}>${o}</option>`).join("")}</select></span>`;
const row = (label, ctl, short) => `<div class="opt"><div class="opt-line"><span class="opt-label">${label}</span>${ctl}</div>${short ? `<div class="opt-short">${short}</div>` : ""}</div>`;
const card = (title, text, app = "Device Panel") => `<div class="pv"><div class="pv-k">Vorschau</div><div class="pv-card"><div class="pv-app">${app}</div><div class="pv-title">${title}</div><div class="pv-text">${text}</div></div></div>`;
const CSS = `.mk-ir { display:flex; align-items:center; gap:10px; padding:9px 0; border-top:1px solid var(--dp-divider); font-size:14px } .mk-ir small { display:block; color:var(--dp-text2); font-size:12px } .mk-ir .nm { flex:1 }
.mk-tag { display:inline-block; margin-left:8px; padding:1px 8px; border-radius:999px; background:var(--dp-primary-soft); color:var(--dp-primary); font-size:11px; font-weight:500; vertical-align:middle }`;

async function open(fn, { settings = true, scroll = ".mk-here" } = {}) {
  const { ctx, p, ev } = await page(true, { css: CSS, width: 402, height: 874 });
  if (settings) {
    await ev(`r.querySelector(".gear-btn").click()`); await p.waitForTimeout(400);
    await ev(`r.querySelector('[data-set="section"][data-id="monitor"]').click()`); await p.waitForTimeout(300);
  }
  await ev(fn);
  await p.waitForTimeout(300);
  await ev(`const e=r.querySelector(${JSON.stringify(scroll)}); if (e) e.scrollIntoView({ block: "start" })`);
  return { ctx, p, ev };
}
const integ = (name, on, sub) => `<div class="mk-ir"><span class="nm">${name}<small>${sub}</small></span>${sw(on)}</div>`;

// 1a: Batterie-Reiter, Abschnitt "Laden"
const BAT = `
r.querySelector('.mon-tab[data-key="battery"]').click();
const body = r.querySelector(".mon-body");
body.insertAdjacentHTML("beforeend", ${JSON.stringify(`
<div class="mon-grp mk-here">Laden</div>
${row("Lademeldung", sw(false), "Meldet, sobald ein Gerät voll geladen ist. Standardmässig aus; einschalten pro Gerät (Geräte-Popup) oder pro Integration.")}
${row("Voll ab", sel(["95 %", "98 %", "100 %"], "100 %"), "Manche Geräte melden nie 100 %.")}
${row("Laden erkannt bei Anstieg um", `<span class="opt-input"><input type="number" value="20"><span class="unit">Punkte</span></span>`, "Gemessen vom tiefsten Stand seit dem letzten Entladen.")}
<div class="opt-short" style="margin-top:6px"><b>Pro Integration</b> (Aus ist der Standard)</div>
${integ("Xiaomi BLE", true, "3 Geräte mit Batterie · Meldung: bei ≥ 100 %")}
${integ("Oral-B", true, "1 Gerät mit Batterie")}
${integ("Philips Hue", false, "19 Geräte mit Batterie")}
${integ("Matter", false, "21 Geräte mit Batterie")}
${card("Aloe Vera ist geladen", "100 % · in 1 Std. 40 Min. von 22 % · Büro")}`)});`;
// 1b: Geräte-Popup
const POP = `r.querySelector('.dev[data-open="e"]').click();`;
const a = await open(BAT);
const f1 = await shot(a.p, true, "laden-batterie"); await a.ctx.close();
const b = await open(`${POP}`, { settings: false });
await b.p.waitForTimeout(500);
await b.ev(`const d=r.querySelector("dialog.device"); const body=d.querySelector(".dev-set")||d.querySelector(".dlg-body"); body.insertAdjacentHTML("beforeend", ${JSON.stringify(`<div class="mk-here"></div>${row("Laden melden<span class=\"mk-tag\">Eigene</span>", sel(["Wie Integration: aus", "Ein", "Aus"], "Ein"), "Meldung, sobald dieses Gerät voll geladen ist (ab 100 %). Gilt nur für dieses Gerät.")}`)}); body.querySelector(".mk-here").scrollIntoView({ block: "center" });`);
await b.p.waitForTimeout(300);
const f2 = await shot(b.p, true, "laden-popup"); await b.ctx.close();
await compose("1-Laden-Einstellungen.png", [[f1, "Einstellungen › Überwachung und Meldungen › Batterie: neuer Abschnitt \"Laden\"", 380], [f2, "Geräte-Popup: Zeile \"Laden melden\" (Wie Integration / Ein / Aus)", 380]]);

// 2: Erkennung (Verlauf mit Regeln)
const W = 760, H = 330;
const fig = (title, pts, marks, note) => `<div style="background:#1c1c1e;color:#eee;border-radius:14px;padding:16px;width:${W}px;font:14px system-ui">
<b style="font-size:15px">${title}</b>
<svg viewBox="0 0 ${W - 32} 230" width="${W - 32}" height="230" style="display:block;margin-top:8px">
 <line x1="40" y1="20" x2="${W - 40}" y2="20" stroke="#555" stroke-dasharray="4 4"/><text x="4" y="24" fill="#aaa" font-size="12">100 %</text>
 <line x1="40" y1="${20 + 210 * 0.1}" x2="${W - 40}" y2="${20 + 210 * 0.1}" stroke="#333"/>
 <polyline fill="none" stroke="#4cd964" stroke-width="3" points="${pts}"/>
 ${marks}
</svg><div style="color:#bbb;font-size:13px;line-height:1.4">${note}</div></div>`;
const dot = (x, y, c, t, dx = 8, dy = -8) => `<circle cx="${x}" cy="${y}" r="6" fill="${c}"/><text x="${x + dx}" y="${y + dy}" fill="${c}" font-size="13">${t}</text>`;
const A = fig("A: Gerät meldet oft (Handy, Saugroboter): Anstieg + Ziel",
  "40,150 120,170 200,185 240,160 300,140 360,110 420,80 480,50 540,25 600,22 700,22",
  dot(200, 185, "#aaa", "Tiefster Stand 22 %", -20, 22) + dot(420, 80, "#ffc400", "Anstieg ≥ 20 Punkte: Laden erkannt", -230, -12) + dot(540, 25, "#4cd964", "≥ 100 %: Push", -40, -12),
  "Laden erkannt, sobald der Stand 20 Punkte über das Minimum steigt; Push bei \"Voll ab\". Wieder scharf, wenn der Stand unter \"Voll ab\" minus 10 fällt.");
const B = fig("B: Gerät meldet selten (Bluetooth, Zigbee): nur ein Sprung",
  "40,160 200,160 205,60 215,22 700,22",
  dot(200, 160, "#aaa", "38 %", -10, 22) + dot(215, 22, "#4cd964", "Sprung 38 → 100 %: Push (Ersatzregel: unter 90 auf ≥ Voll ab)", 14, 70),
  "Seltene Meldungen zeigen keinen Verlauf. Dann gilt die Ersatzregel: Wechsel von unter 90 % auf den Zielwert löst die Meldung aus. Das gilt gleich für einen Batteriewechsel (neue Batterie: 100 %), darum Standard aus.");
mkdirSync(tmp, { recursive: true });
const pg = await (await import("../../_lib/mock.mjs")).setup;
const { chromium } = await import("../../../../tests/panel/node_modules/playwright-core/index.mjs");
const br = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const pp = await br.newPage({ viewport: { width: W + 32, height: 760 }, deviceScaleFactor: 1.5 });
await pp.setContent(`<body style="margin:0;padding:16px;background:#e8ebf0"><div style="display:grid;gap:14px">${A}${B}</div></body>`);
await pp.screenshot({ path: new URL("../2-Laden-Erkennung.png", import.meta.url).pathname, fullPage: true });
await br.close();

// 3: Updates-Reiter
const UPD = `
const tabs = r.querySelector(".mon-tabs");
for (const t of tabs.querySelectorAll(".mon-tab")) { t.classList.remove("on"); t.setAttribute("aria-selected", "false"); }
tabs.insertAdjacentHTML("beforeend", '<button type="button" role="tab" class="mon-tab on" aria-selected="true">Updates</button>');
r.querySelector(".mon-body").innerHTML = ${JSON.stringify(`
<div class="opt-short" style="margin:4px 0 6px">Ersetzt die Automation "Anzahl Updates → Pushmeldung": Das Panel schaut selbst auf die Update-Entitäten von Home Assistant.</div>
<div class="mon-grp">Meldung</div>
${row("Update-Erinnerung", sw(true), "Push an das gewählte Ziel, wenn ein neues Update erscheint. Standardmässig aus.")}
${row("Zeitpunkt", sel(["Sofort", "Täglich um 09:00", "Wöchentlich (Mo 09:00)"], "Sofort"), "Sofort: nach dem Sammelfenster. Täglich: eine Zusammenfassung, wenn etwas offen ist.")}
${row("Sammeln während", `<span class="opt-input"><input type="number" value="5"><span class="unit">Min.</span></span>`, "Mehrere Updates kurz hintereinander kommen in einer Meldung.")}
<div class="mon-grp">Welche Updates</div>
${row("Home Assistant (Core, OS, Supervisor)", sw(true))}
${row("Add-ons", sw(true))}
${row("Integrationen und Karten (HACS)", sw(true))}
${row("Geräte-Firmware (Shelly, Zigbee …)", sw(false), "Nur Updates, die du nicht übersprungen hast.")}
${row("Erinnerung wiederholen", sel(["Nie", "Nach 3 Tagen", "Nach 7 Tagen"], "Nach 7 Tagen"), "Wenn ein Update offen bleibt.")}
${card("Home Assistant Update", "3 verfügbar:<br>• Home Assistant Core 2026.10.2 → 2026.10.3<br>• Mosquitto broker 6.5.0 → 6.5.1<br>• HACS Device Panel 1.27.0 → 1.28.0")}`)};`;
const u = await open(UPD, { scroll: ".mon-tabs" });
await u.ev(`r.querySelector("dialog.settings").scrollTop = r.querySelector(".mon-tabs").offsetTop - 120; r.querySelector(".mon-tabs").scrollIntoView({ block: "center" })`);
const f3 = await shot(u.p, true, "updates"); 
await u.ev(`r.querySelector(".pv").scrollIntoView({ block: "center" })`);
const f4 = await shot(u.p, true, "updates-vorschau"); await u.ctx.close();
await compose("3-Updates.png", [[f3, "Neuer Reiter \"Updates\" unter Überwachung und Meldungen (Aufbau wie \"Neu\")", 380], [f4, "Vorschau der Meldung (ein Update-Sammelmeldung, wie die Automation heute)", 380]]);
await close();
console.log("fertig");
