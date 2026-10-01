// Variante C: Kombination aus A und B (Wunsch des Nutzers: alle Ansätze).
// Kopf, Chips und Gruppen aus B; rote Zeilen und Spalten-Popover aus A; alle
// Spalten wählbar; Geräteansicht mit Tabs, Inhalte aus A und B.
import { DEVICES, INTEG, KPI, ic, connIcon, connHtml, batHtml, stripSvg, ring, LOGO } from "./base.mjs";
import { CSS_A } from "./variantA.mjs";
import { CSS_B, CSS_B_M, statusB, heroB, chipsB, drawerContent, mcard, mobileB } from "./variantB.mjs";

export const CSS_C = `
tr.off td { background: var(--err-soft); }
tr.off td:first-child { box-shadow: inset 4px 0 0 var(--error); }
tr.flaky td:first-child { box-shadow: inset 4px 0 0 var(--warning); }
.mm { color: var(--text3); }
.days { display: flex; align-items: flex-end; gap: 3px; height: 54px; margin-top: 10px; }
.days i { flex: 1; border-radius: 3px 3px 1px 1px; background: var(--success-strip); min-height: 3px; }
.days i.w { background: var(--warning); } .days i.e { background: var(--error); }
.daysx { display: flex; justify-content: space-between; font-size: 11px; color: var(--text2); margin-top: 4px; }
.vsec { margin-top: 14px; }
.vsec .label { margin-bottom: 8px; display: block; }
`;

const HEAD = `<tr><th>Gerät</th><th>Status ${ic("sort", 14)}</th><th>Verbindung</th><th>Gesundheit</th><th>Verfügbarkeit 24 Std.</th><th>Batterie</th><th>Integration</th><th>Hersteller / Modell</th><th>Software</th><th></th></tr>`;

const rowC = (d) => `<tr class="${d.status}">
  <td><div class="nc"><div class="av ${d.status === "on" ? "" : d.status}">${connIcon(d.conn, 18)}<span class="st"></span></div><div>${d.name}<div class="t2" style="font-size:12px">${d.area}</div></div></div></td>
  <td>${statusB(d)}</td>
  <td>${connHtml(d, { showVia: true })}</td>
  <td>${ring(d.health, 30, 3.5, null, d.health)}</td>
  <td><div class="a24">${stripSvg(d, 110, 16)}<span>${String(d.avail).replace(".", ",")} %</span></div></td>
  <td>${batHtml(d.bat)}</td>
  <td>${INTEG[d.integ]}</td>
  <td>${d.maker}<div class="t2" style="font-size:12px">${d.model}</div></td>
  <td>${d.sw}${d.upd ? ` <span class="pill upd" style="height:19px;font-size:11px">Update</span>` : ""}</td>
  <td class="mm">⋮</td>
</tr>`;

const toolbarC = (pressCols) => `<div class="tb">${LOGO(32)}<h1>Geräte</h1>
  <div class="search">${ic("search", 20)} In allen Spalten suchen…</div>
  <span class="btn">${ic("filter", 18)} Filter</span>
  <span class="btn" style="${pressCols ? "background:var(--pri-soft);color:var(--primary);border-color:transparent" : ""}">${ic("columns", 18)} Spalten</span>
  <span class="btn round">${ic("cog", 20)}</span></div>`;

const popover = () => `<div class="pop" style="top:66px;right:68px">
  <h4>Spalten</h4><div class="ps">Desktop · für dich gespeichert. Das Handy hat eine eigene Auswahl.</div>
  ${[["Gerät", 1, "fixed"], ["Status", 1], ["Verbindung", 1], ["Gesundheit", 1, "drag"], ["Verfügbarkeit 24 Std.", 1], ["Batterie", 1], ["Integration", 1], ["Hersteller / Modell", 1], ["Software", 1]]
    .map(([l, on, cls]) => `<div class="row ${cls || ""}">${ic("drag", 18, "dr")}<span class="lbl">${l}</span><span class="toggle ${on ? "on" : ""}"></span></div>`).join("")}
  <hr>
  ${["Bereich", "Empfang (Wert)", "Unterbrüche 7 Tage", "Zuletzt geändert", "Hub / Bridge", "IP-Adresse"].map((l) => `<div class="row">${ic("drag", 18, "dr")}<span class="lbl t2">${l}</span><span class="toggle"></span></div>`).join("")}
  <div class="pf"><span class="t2">Ziehen zum Sortieren</span><a>Zurücksetzen</a></div>
</div>`;

const table = (onLimit = 9) => `<div class="tcard"><table>${HEAD}
  <tr class="grp e"><td colspan="10">Ausgefallen · 4 <small>längste Dauer zuerst</small></td></tr>${DEVICES.filter((d) => d.status === "off").map(rowC).join("")}
  <tr class="grp w"><td colspan="10">Instabil · 2 <small>3 oder mehr Unterbrüche in 24 Std.</small></td></tr>${DEVICES.filter((d) => d.status === "flaky").map(rowC).join("")}
  <tr class="grp"><td colspan="10">Online · 122</td></tr>${DEVICES.filter((d) => d.status === "on").slice(0, onLimit).map(rowC).join("")}
</table></div>`;

export function mainC({ pop = true } = {}) {
  return `<div class="app" style="position:relative">${toolbarC(pop)}${heroB(630)}${chipsB()}${table()}
    <div class="foot" style="display:flex;justify-content:space-between;padding:10px 6px;font-size:12px;color:var(--text2)"><span>15 von ${KPI.total} Geräten · Stand 14:16</span><span>Zeile antippen für Details</span></div>${pop ? popover() : ""}</div>`;
}

// Geräteansicht: Kopf aus B, Tab "Verlauf" mit den Inhalten aus A.
const TABS = ["Übersicht", "Verlauf", "Verbindung", "Entitäten", "Einstellungen"];
function drawer(tab, narrow = false) {
  const full = drawerContent(narrow);
  const [rawHead, rest] = full.split('<div class="dbody">');
  const head = rawHead.trimEnd();
  const tabsHtml = `<div class="tabs">${TABS.filter((t) => !narrow || t !== "Einstellungen").map((t) => `<span class="${t === tab ? "on" : ""}">${t}</span>`).join("")}</div>`;
  const headC = head.replace(/<div class="tabs">[\s\S]*?<\/div><\/div>$/, tabsHtml + "</div>");
  if (tab === "Übersicht") return headC + '<div class="dbody">' + rest;
  const days = [0,0,1,0,0,0,0,0,2,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1,3,1,2];
  return `${headC}<div class="dbody">
    <div class="sech" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span class="label">Verfügbarkeit</span><span class="seg"><span class="on">24 Std.</span><span>7 Tage</span><span>30 Tage</span></span></div>
    <div class="box" style="background:var(--subtle);border-radius:16px;padding:14px 16px"><div class="big">90,7 <small>%</small> <small style="color:var(--error)">&nbsp;2 Unterbrüche</small><small> · zusammen 2 Std. 17 Min. · läuft</small></div>
      <div class="tl"><i style="left:50.8%;width:1%"></i><i class="run" style="left:90.6%;width:9.4%"></i></div>
      <div class="axis"><span>15:00</span><span>21:00</span><span>03:00</span><span>09:00</span><span>jetzt</span></div>
      <div class="ol"><div><span>12:02 – jetzt</span><span class="r">läuft · 2 Std. 14 Min.</span></div><div><span>03:12 – 03:15 <span class="t2">· Sammelausfall: 6 Zigbee-Geräte</span></span><span class="o">3 Min.</span></div></div></div>
    <div class="vsec"><span class="label">Unterbrüche pro Tag · 30 Tage</span>
      <div class="box" style="background:var(--subtle);border-radius:16px;padding:12px 16px">
        <div class="days">${days.map((n) => `<i class="${n >= 2 ? "e" : n === 1 ? "w" : ""}" style="height:${n ? 14 + n * 12 : 3}px"></i>`).join("")}</div>
        <div class="daysx"><span>2. Sep.</span><span>16. Sep.</span><span>heute</span></div>
        <div class="t2" style="font-size:12.5px;margin-top:8px">12 Unterbrüche in 30 Tagen, 8 davon in der letzten Woche: Das Gerät wird unzuverlässiger.</div></div></div>
  </div>`;
}

export function deviceC(tab) {
  return `<div class="app">${toolbarC(false)}${heroB(630)}${chipsB()}${table()}</div><div class="scrim"></div><div class="drawer">${drawer(tab)}</div>`;
}

export function mobileDeviceC(tab) {
  return `<div style="filter:brightness(.55)">${mobileB()}</div><div class="sheet"><div class="grab"></div>${drawer(tab, true)}</div>`;
}

const ALL = CSS_A + CSS_B + CSS_C;
export const SCREENS_C = [
  ["C-desktop", () => mainC(), ALL, { width: 1440, height: 1000 }, "light"],
  ["C-desktop-dark", () => mainC({ pop: false }), ALL, { width: 1440, height: 1000 }, "dark"],
  ["C-device-uebersicht", () => deviceC("Übersicht"), ALL, { width: 1440, height: 1060, fixed: true }, "light"],
  ["C-device-verlauf", () => deviceC("Verlauf"), ALL, { width: 1440, height: 1060, fixed: true }, "light"],
  ["C-mobile", () => mobileB(), ALL + CSS_B_M, { width: 390, height: 844, mobile: true }, "light"],
  ["C-mobile-verlauf", () => mobileDeviceC("Verlauf"), ALL + CSS_B_M, { width: 390, height: 844, mobile: true }, "light"],
];
