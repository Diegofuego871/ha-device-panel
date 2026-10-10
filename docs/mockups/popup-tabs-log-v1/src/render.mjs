// Mockups (Wunsch des Nutzers, 2026-10-10):
//  1. Reiter im Geräte-Popup, "Variante A": alle Einstellungen eines Geräts in einem Reiter "Einstellungen".
//  2. Protokoll: eigener Knopf im Panel (nicht in den Einstellungen), Fenster gross auf dem Desktop, auf dem
//     Handy vollflächig, mit Filter und Suche.
// Im echten Panel (Nachbau, erfundene Daten). Zusätze werden per Skript eingesetzt.
//   0-Knopf.png: Knopf "Protokoll" in der Kopfzeile (Handy und Desktop)
//   1-Reiter-Handy.png / 2-Reiter-Desktop.png: Popup mit Reitern, Varianten R1 bis R3
//   3-Protokoll-Desktop.png / 4-Protokoll-Handy.png: Protokoll-Fenster, Varianten P1 und P2
// Aufruf: CHROMIUM_PATH=... node docs/mockups/popup-tabs-log-v1/src/render.mjs
import { setup } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8974, import.meta.url);

const ICON_LOG = "M4,4H20A2,2 0 0,1 22,6V18A2,2 0 0,1 20,20H4A2,2 0 0,1 2,18V6A2,2 0 0,1 4,4M4,6V18H20V6H4M6,8H18V10H6V8M6,11H18V13H6V11M6,14H14V16H6V14Z";
const ICON_FILTER = "M14,12V19.88C14.04,20.18 13.94,20.5 13.71,20.71C13.32,21.1 12.69,21.1 12.3,20.71L10.29,18.7C10.06,18.47 9.96,18.16 10,17.87V12H9.97L4.21,4.62C3.87,4.19 3.95,3.56 4.38,3.22C4.57,3.08 4.78,3 5,3V3H19V3C19.22,3 19.43,3.08 19.62,3.22C20.05,3.56 20.13,4.19 19.79,4.62L14.03,12H14Z";
const ICON_SEARCH = "M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z";
const ICON_CLOSE = "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z";
const ICON_DL = "M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z";
const svgp = (d, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;

const CSS = `
.mk-logbtn { position: relative }
.mk-tabs-note { display:none }
/* Protokoll-Fenster */
dialog.mk-log { padding:0; border:none; border-radius:22px; background: var(--dp-card); color: var(--dp-text); width: min(1040px, calc(100vw - 48px)); height: min(780px, calc(100vh - 56px)); max-height:none; overflow:hidden; box-shadow: var(--dp-shadow); }
dialog.mk-log[open] { display:flex; flex-direction:column; }
dialog.mk-log::backdrop { background: rgba(0,0,0,.5) }
@media (max-width: 700px) { dialog.mk-log { width:100%; max-width:100%; height:100%; max-height:100%; margin:0; border-radius:0 } }
.mk-log .dlg-head { flex:none }
.mk-bar2 { flex:none; display:flex; flex-direction:column; gap:10px; padding:4px 22px 10px }
@media (max-width: 700px) { .mk-bar2 { padding:4px 16px 10px } }
.mk-field { display:flex; align-items:center; gap:8px; height:40px; padding:0 12px; border-radius:12px; background: var(--dp-input); border:1px solid var(--dp-divider); color: var(--dp-text2); font-size:14px; flex:1; min-width:0 }
.mk-field span { color: var(--dp-text3) }
.mk-row-tools { display:flex; gap:8px; align-items:center }
.mk-ibtn { display:inline-flex; align-items:center; justify-content:center; gap:6px; height:40px; min-width:40px; padding:0 12px; border-radius:12px; border:1px solid var(--dp-divider); background: var(--dp-card); color: var(--dp-text); font-size:13.5px }
.mk-ibtn b { display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; border-radius:9px; background: var(--dp-primary); color:#fff; font-size:11px; padding:0 5px }
.mk-chips { display:flex; gap:6px; overflow:hidden; flex-wrap:nowrap }
.mk-chips .chip { height:30px; font-size:12.5px; flex:none }
.mk-chips .chip.on { background: var(--dp-primary-soft); border-color: var(--dp-primary); color: var(--dp-primary) }
.mk-lv { display:inline-block; width:9px; height:9px; border-radius:50%; flex:none }
.mk-lv.i { background: var(--dp-text3) } .mk-lv.w { background: var(--dp-warning) } .mk-lv.e { background: var(--dp-error) }
.mk-cat { display:inline-flex; align-items:center; height:22px; padding:0 9px; border-radius:11px; font-size:11.5px; font-weight:600; background: var(--dp-subtle); color: var(--dp-text2); white-space:nowrap }
.mk-cat.laden { background: var(--dp-success-soft); color: var(--dp-success) }
.mk-cat.batterie { background: var(--dp-warning-soft); color: var(--dp-warning) }
.mk-cat.ausfall { background: var(--dp-error-soft); color: var(--dp-error) }
.mk-cat.push { background: var(--dp-primary-soft); color: var(--dp-primary) }
.mk-list { flex:1; overflow:hidden; padding:0 22px; min-height:0 }
@media (max-width: 700px) { .mk-list { padding:0 16px } }
.mk-hdr, .mk-ln { display:grid; grid-template-columns: 62px 18px 94px 1fr; gap:10px; align-items:start; padding:8px 4px }
.mk-hdr { font-size:11px; letter-spacing:.04em; text-transform:uppercase; color: var(--dp-text3); border-bottom:1px solid var(--dp-divider); position:sticky; top:0 }
.mk-ln { border-bottom:1px solid var(--dp-divider); font-size:13.5px; line-height:1.35 }
.mk-ln .tm { color: var(--dp-text2); font-variant-numeric: tabular-nums; font-size:12.5px; padding-top:1px }
.mk-ln .lv { padding-top:5px }
.mk-ln .msg b { font-weight:600 }
.mk-ln .msg small { display:block; color: var(--dp-text3); font-size:12px; margin-top:2px }
.mk-ln.w { background: linear-gradient(90deg, var(--dp-warning-soft), transparent 40%) }
.mk-ln.e { background: linear-gradient(90deg, var(--dp-error-soft), transparent 40%) }
/* Handy: zweizeilig */
.mk-m { display:grid; grid-template-columns: 14px 1fr; gap:4px 10px; padding:10px 2px; border-bottom:1px solid var(--dp-divider) }
.mk-m .lv { padding-top:5px }
.mk-m .t { display:flex; gap:8px; align-items:center; font-size:12px; color: var(--dp-text2); flex-wrap:wrap }
.mk-m .t b { color: var(--dp-text); font-weight:600 }
.mk-m .msg { grid-column: 2; font-size:14px; line-height:1.35 }
.mk-m .msg small { display:block; color: var(--dp-text3); font-size:12px; margin-top:2px }
.mk-m.w { background: linear-gradient(90deg, var(--dp-warning-soft), transparent 55%) }
.mk-m.e { background: linear-gradient(90deg, var(--dp-error-soft), transparent 55%) }
.mk-day { padding:12px 4px 6px; font-size:12px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; color: var(--dp-text2) }
/* P2: Desktop mit Seitenleiste */
.mk-split { flex:1; display:flex; min-height:0 }
.mk-side { width:230px; flex:none; padding:4px 14px 14px 22px; border-right:1px solid var(--dp-divider); overflow:hidden }
.mk-side h4 { margin:14px 0 6px; font-size:11px; letter-spacing:.04em; text-transform:uppercase; color: var(--dp-text3); font-weight:600 }
.mk-opt { display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:10px; font-size:13.5px }
.mk-opt .n { margin-left:auto; color: var(--dp-text3); font-size:12px }
.mk-opt.on { background: var(--dp-primary-soft); color: var(--dp-primary); font-weight:600 }
.mk-main { flex:1; min-width:0; display:flex; flex-direction:column }
.mk-foot { flex:none; display:flex; align-items:center; gap:10px; padding:10px 22px; border-top:1px solid var(--dp-divider); color: var(--dp-text2); font-size:12.5px }
@media (max-width: 700px) { .mk-foot { padding:10px 16px } }
.mk-foot .sp { margin-left:auto }
/* Filter-Sheet (Handy P2) */
.mk-sheet { position:absolute; left:0; right:0; bottom:0; background: var(--dp-card); border-radius:22px 22px 0 0; box-shadow: 0 -8px 30px rgba(0,0,0,.45); padding:14px 16px 18px; z-index:5 }
.mk-sheet h3 { margin:10px 0 8px; font-size:12px; font-weight:500; color: var(--dp-text2) }
.mk-sheet .mk-chips { flex-wrap:wrap }
.mk-scrim { position:absolute; inset:0; background: rgba(0,0,0,.45); z-index:4 }
/* Reiter im Popup */
.mk-tabsrow { padding: 0 22px }
@media (max-width: 700px) { .mk-tabsrow { padding: 0 16px } }
.mk-tabsrow .sub-tabs { margin: 4px 0 0 }
.mk-hint { margin: 14px 0 0; padding: 10px 12px; border-radius:12px; background: var(--dp-subtle); color: var(--dp-text2); font-size:12.5px }
`;

// Erfundene Einträge: Zeit, Stufe (i/w/e), Bereich, Titel (fett), Text, Detail
const LOG = [
  ["13:58", "i", "Laden", "Aqua10 Roller", "lädt seit 12 Min., Stand 23 %", "Quelle: Ladeanzeige des Geräts"],
  ["13:41", "i", "Push", "notify.mobile_app_lea", "gesendet: \"Geladen: Handy Lea\"", "100 % · in 1 Std. 40 Min. von 22 %"],
  ["13:41", "i", "Laden", "Handy Lea", "voll geladen bei 100 % (Voll ab 100 %)", "Anstieg 20 %: erkannt, Meldung eingeschaltet (Gerät)"],
  ["13:12", "w", "Batterie", "Türsensor Keller", "Batterie 9 % unter der Schwelle 10 %", "Meldung gesendet an notify.mobile_app_lea"],
  ["12:47", "i", "Ausfall", "Zigbee-Lampe Flur", "wieder online nach 6 Min.", ""],
  ["12:41", "w", "Ausfall", "Zigbee-Lampe Flur", "ausgefallen seit 12:41", "Ausgefallen nach 5 Min. (global)"],
  ["12:03", "i", "Laden", "Tablet Küche", "Stand 96 %, Voll ab 98 %: noch nicht voll", "Tiefpunkt 41 %, Anstieg 55 Punkte"],
  ["11:30", "e", "Push", "notify.altes_handy", "Ziel nicht gefunden, Meldung verworfen", "Meldung: \"Batterie schwach: Rauchmelder Estrich\""],
  ["10:12", "i", "Neu", "Bewegungsmelder Garage", "neues Gerät erkannt, Meldung gesendet", ""],
  ["09:00", "i", "Updates", "Home Assistant", "2 Updates verfügbar, Erinnerung gesendet", "Core 2026.10.1, Matter Server 8.1"],
  ["08:14", "i", "System", "Device Panel", "gestartet (Version 1.37.0), 157 Geräte überwacht", ""],
  ["08:14", "i", "Laden", "Device Panel", "41 Geräte mit Batterie werden beobachtet", ""],
];
const CATS = [["Alle", 148], ["Laden", 31], ["Ausfall", 22], ["Batterie", 14], ["Push", 29], ["Updates", 6], ["Neu", 3], ["System", 43]];

const chips = (on, items) => items.map(([n, c]) => `<button type="button" class="chip${n === on ? " on" : ""}"><span>${n}</span><span class="n">${c}</span></button>`).join("");
const levelChips = (on) => `<div class="mk-chips"><button class="chip${on === "Alle" ? " on" : ""}"><span>Alle</span></button><button class="chip"><span class="mk-lv i"></span><span>Info</span></button><button class="chip${on === "W" ? " on" : ""}"><span class="mk-lv w"></span><span>Warnung</span><span class="n">3</span></button><button class="chip"><span class="mk-lv e"></span><span>Fehler</span><span class="n">1</span></button></div>`;
const catCls = (c) => `mk-cat ${c.toLowerCase()}`;
const lines = (rows) => rows.map(([tm, lv, cat, title, text, det]) => `<div class="mk-ln ${lv}"><span class="tm">${tm}</span><span class="lv"><span class="mk-lv ${lv}"></span></span><span><span class="${catCls(cat)}">${cat}</span></span><span class="msg"><b>${title}</b> · ${text}${det ? `<small>${det}</small>` : ""}</span></div>`).join("");
const mlines = (rows) => rows.map(([tm, lv, cat, title, text, det]) => `<div class="mk-m ${lv}"><span class="lv"><span class="mk-lv ${lv}"></span></span><span class="t"><b>${tm}</b><span class="${catCls(cat)}">${cat}</span></span><span class="msg"><b>${title}</b> · ${text}${det ? `<small>${det}</small>` : ""}</span></div>`).join("");
const head = (sub) => `<div class="dlg-head"><span class="dlg-avatar">${svgp(ICON_LOG, 28)}</span><div class="dlg-title"><h2>Protokoll</h2><div class="dlg-sub">${sub}</div></div><button type="button" class="dlg-close" title="Schliessen">${svgp(ICON_CLOSE, 18)}</button></div>`;
const footer = `<div class="mk-foot"><span>148 Einträge, 12 gezeigt</span><span class="sp"></span><button class="mk-ibtn">${svgp(ICON_DL, 16)}Kopieren</button><button class="mk-ibtn">Leeren</button></div>`;

// P1 (Empfehlung): Filterzeile oben (Stufe, Bereich, Suche), einfache Liste
const P1 = (mobile) => `${head("Letzte 500 Einträge seit 08:14 · nur im Arbeitsspeicher")}
  <div class="mk-bar2"><div class="mk-row-tools"><div class="mk-field">${svgp(ICON_SEARCH, 18)}<span>Im Protokoll suchen…</span></div></div>
    ${levelChips("Alle")}<div class="mk-chips">${chips("Alle", CATS)}</div></div>
  <div class="mk-list">${mobile ? `<div class="mk-day">Heute</div>${mlines(LOG.slice(0, 8))}` : `<div class="mk-hdr"><span>Zeit</span><span></span><span>Bereich</span><span>Meldung</span></div>${lines(LOG)}`}</div>${footer}`;

// P2: Desktop mit Seitenleiste für Filter; Handy: nur Suche und Knopf "Filter" (Sheet)
const side = `<div class="mk-side"><h4>Stufe</h4><div class="mk-opt on">Alle<span class="n">148</span></div><div class="mk-opt"><span class="mk-lv i"></span>Info<span class="n">144</span></div><div class="mk-opt"><span class="mk-lv w"></span>Warnung<span class="n">3</span></div><div class="mk-opt"><span class="mk-lv e"></span>Fehler<span class="n">1</span></div>
  <h4>Bereich</h4>${CATS.map(([n, c], i) => `<div class="mk-opt${i === 0 ? " on" : ""}">${n}<span class="n">${c}</span></div>`).join("")}<h4>Zeitraum</h4><div class="mk-opt on">Seit Start</div><div class="mk-opt">Letzte Stunde</div><div class="mk-opt">Heute</div></div>`;
const P2d = `${head("Letzte 500 Einträge seit 08:14 · nur im Arbeitsspeicher")}
  <div class="mk-split">${side}<div class="mk-main"><div class="mk-bar2"><div class="mk-row-tools"><div class="mk-field">${svgp(ICON_SEARCH, 18)}<span>Im Protokoll suchen…</span></div></div></div>
  <div class="mk-list"><div class="mk-hdr"><span>Zeit</span><span></span><span>Bereich</span><span>Meldung</span></div>${lines(LOG)}</div>${footer}</div></div>`;
const P2m = (sheet) => `${head("Seit 08:14 · 148 Einträge")}
  <div class="mk-bar2"><div class="mk-row-tools"><div class="mk-field">${svgp(ICON_SEARCH, 18)}<span>Suchen…</span></div><button class="mk-ibtn">${svgp(ICON_FILTER, 18)}Filter${sheet ? "<b>2</b>" : ""}</button></div>
  ${sheet ? `<div class="mk-chips"><button class="chip on"><span class="mk-lv w"></span><span>Warnung</span></button><button class="chip on"><span>Laden</span></button></div>` : ""}</div>
  <div class="mk-list"><div class="mk-day">Heute</div>${mlines(sheet ? LOG.filter((r) => r[1] === "w" || r[2] === "Laden").slice(0, 6) : LOG.slice(0, 8))}</div>${footer}
  ${sheet ? `<div class="mk-scrim"></div><div class="mk-sheet"><h3>Stufe</h3><div class="mk-chips"><button class="chip"><span>Alle</span></button><button class="chip"><span class="mk-lv i"></span><span>Info</span></button><button class="chip on"><span class="mk-lv w"></span><span>Warnung</span></button><button class="chip"><span class="mk-lv e"></span><span>Fehler</span></button></div>
   <h3>Bereich (mehrere möglich)</h3><div class="mk-chips">${CATS.slice(1).map(([n, c]) => `<button class="chip${n === "Laden" ? " on" : ""}"><span>${n}</span><span class="n">${c}</span></button>`).join("")}</div>
   <h3>Zeitraum</h3><div class="mk-chips"><button class="chip on"><span>Seit Start</span></button><button class="chip"><span>Heute</span></button><button class="chip"><span>Letzte Stunde</span></button></div>
   <div style="display:flex;gap:8px;margin-top:16px"><button class="mk-ibtn" style="flex:1">Zurücksetzen</button><button class="mk-ibtn" style="flex:1;background:var(--dp-primary);color:#fff;border-color:var(--dp-primary)">12 Einträge zeigen</button></div></div>` : ""}`;

async function withLog(mobile, html, name) {
  const o = await page(mobile, { css: CSS, width: 402, height: 874 });
  await o.ev(`
    const dlg = document.createElement("dialog"); dlg.className = "device mk-log"; dlg.innerHTML = ${JSON.stringify(html)};
    r.appendChild(dlg); dlg.showModal();
  `);
  const f = await shot(o.p, mobile, name);
  await o.ctx.close();
  return f;
}

// 0: Knopf in der Kopfzeile
async function withButton(mobile, name) {
  const o = await page(mobile, { css: CSS, width: 402, height: 874 });
  await o.ev(`
    const gear = r.querySelector(".gear-btn");
    const b = gear.cloneNode(true); b.classList.add("mk-logbtn"); b.title = "Protokoll"; b.setAttribute("aria-label", "Protokoll");
    b.innerHTML = ${JSON.stringify(svgp(ICON_LOG, 22))};
    gear.before(b);
    window.__b = b;
  `);
  const f = await shot(o.p, mobile, name);
  await o.ctx.close();
  return f;
}

// Reiter im Geräte-Popup
// mode: "t1" (Übersicht | Einstellungen | Entitäten), "t2" (Übersicht | Einstellungen, Entitäten unten), "t3" (wie t1, Zähler eigener Abweichungen)
async function popupTabs(mobile, mode, active, name) {
  const o = await page(mobile, { css: CSS, width: 402, height: 874 });
  await o.ev(`r.querySelector('.dev[data-open="e"]').click()`);
  await o.p.waitForTimeout(600);
  await o.ev(
    `
    const dlg = r.querySelector("dialog.device"); const body = dlg.querySelector(".dlg-body");
    // Abschnitte nach den Überschriften (h3) einteilen
    const groups = []; let cur = null;
    for (const n of [...body.children]) { if (n.tagName === "H3") { cur = { h: n, nodes: [n] }; groups.push(cur); } else if (cur) cur.nodes.push(n); }
    const g = (re) => groups.find((x) => re.test(x.h.textContent));
    const stats = g(/Statistik/), conn = g(/Verbindung/), dev = g(/^Gerät/), notif = g(/Einstellungen für dieses Gerät/), ents = g(/Entitäten/);
    // Typ und Verbindungsart (Auswahlfelder) wandern in den Reiter "Einstellungen"
    const tiles = (grp) => [...grp.nodes[1].querySelectorAll(".tile")];
    const typeTile = tiles(dev).find((t) => t.querySelector('[data-dlg="type"]'));
    const connTile = tiles(conn).find((t) => t.querySelector('[data-dlg="conn"]'));
    const settingsHead = document.createElement("h3"); settingsHead.textContent = "Typ und Verbindung";
    const settingsTiles = document.createElement("div"); settingsTiles.className = "tiles";
    settingsTiles.append(typeTile.cloneNode(true), connTile.cloneNode(true));
    const ro = (tile, txt) => { const v = tile.querySelector("select"); tile.querySelector(".typ-sel, label")?.replaceWith(Object.assign(document.createElement("span"), { textContent: txt })); };
    ro(typeTile, "Sensor"); ro(connTile, "Bluetooth");
    const overview = [...stats.nodes, ...conn.nodes, ...dev.nodes];
    const settings = [settingsHead, settingsTiles, ...notif.nodes];
    const entNodes = ents.nodes;
    const all = [...overview, ...settings, ...entNodes];
    const tabsRow = document.createElement("div"); tabsRow.className = "mk-tabsrow";
    const mode = ${JSON.stringify(mode)}, active = ${JSON.stringify(active)};
    const items = mode === "t2" ? [["ov", "Übersicht"], ["set", "Einstellungen"]] : [["ov", "Übersicht"], ["set", mode === "t3" ? "Einstellungen · 2 eigene" : "Einstellungen"], ["ent", "Entitäten · 5"]];
    tabsRow.innerHTML = '<div class="sub-tabs" role="tablist">' + items.map(([id, t]) => '<button type="button" role="tab" class="sub-tab' + (id === active ? " on" : "") + (mode === "t3" && id === "set" ? " chg" : "") + '" aria-selected="' + (id === active) + '">' + t + '</button>').join("") + '</div>';
    dlg.querySelector(".dlg-quick").after(tabsRow);
    for (const n of all) n.remove();
    const show = active === "ov" ? (mode === "t2" ? [...overview, ...entNodes] : overview) : active === "set" ? settings : entNodes;
    body.append(...show);
    if (active === "set") { const h = document.createElement("div"); h.className = "mk-hint"; h.textContent = "Alle Einstellungen dieses Geräts an einem Ort. Was vom Standard abweicht, trägt die Herkunft (Gerät, Integration, Standard)."; body.append(h); }
  `
  );
  await o.p.waitForTimeout(300);
  const f = await shot(o.p, mobile, name);
  await o.ctx.close();
  return f;
}

// 0: Knopf
await compose("0-Knopf.png", [
  [await withButton(true, "btnM"), "Handy: Knopf \"Protokoll\" links vom Zahnrad in der Kopfzeile (nur für Administratoren sichtbar)", 330],
  [await withButton(false, "btnD"), "Desktop: gleicher Knopf, links vom Zahnrad", 760],
]);

// 1/2: Reiter
const r1o = await popupTabs(true, "t1", "ov", "R1ov");
const r1s = await popupTabs(true, "t1", "set", "R1set");
const r2o = await popupTabs(true, "t2", "ov", "R2ov");
const r3s = await popupTabs(true, "t3", "set", "R3set");
await compose("1-Reiter-Handy.png", [
  [r1o, "R1: Reiter \"Übersicht | Einstellungen | Entitäten\"; Übersicht nur zum Lesen (Typ und Verbindungsart sind jetzt Text)", 300],
  [r1s, "R1: Reiter \"Einstellungen\": Typ, Verbindungsart und alle Meldungen an einem Ort (Empfehlung)", 300],
  [r2o, "R2: nur zwei Reiter; Entitäten bleiben unten in der Übersicht", 300],
  [r3s, "R3: wie R1, der Reiter zeigt die Zahl der eigenen Abweichungen (gelber Punkt)", 300],
]);
await compose("2-Reiter-Desktop.png", [
  [await popupTabs(false, "t1", "ov", "R1ovD"), "R1 Desktop: Übersicht", 640],
  [await popupTabs(false, "t1", "set", "R1setD"), "R1 Desktop: Einstellungen", 640],
]);

// 3/4: Protokoll
await compose("3-Protokoll-Desktop.png", [
  [await withLog(false, P1(false), "P1d"), "P1 (Empfehlung): Filterzeile oben (Stufe, Bereich, Suche), eine Liste", 640],
  [await withLog(false, P2d, "P2d"), "P2: Seitenleiste für Filter, Liste und Suche rechts", 640],
]);
await compose("4-Protokoll-Handy.png", [
  [await withLog(true, P1(true), "P1m"), "P1: Handy vollflächig; Suche, Stufe und Bereich als Chips oben", 300],
  [await withLog(true, P2m(false), "P2m"), "P2: Handy: nur Suche und Knopf \"Filter\"", 300],
  [await withLog(true, P2m(true), "P2s"), "P2: Filter-Fenster mit Auswahl (2 Filter aktiv)", 300],
]);
await close();
console.log("fertig");
