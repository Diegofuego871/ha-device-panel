// Variante A "Klar": nah an unifi_dynamic. Werkzeugleiste mit Zähler-Segment,
// darunter ein Ausfall-Band mit Live-Dauer, dann die Tabelle als Karte.
import { DEVICES, INTEG, KPI, ic, connIcon, CONN, connHtml, batHtml, stripSvg, LOGO, bars, sigLevel, sigText } from "./base.mjs";

export const CSS_A = `
.app { padding: 16px 20px; }
.tb { display: flex; align-items: center; gap: 12px; }
.counter { display: inline-flex; align-items: center; gap: 4px; padding: 4px; border-radius: 14px; background: var(--card); border: 1px solid var(--divider); }
.counter span { display: inline-flex; align-items: center; gap: 7px; padding: 6px 12px; border-radius: 10px; font-size: 13.5px; color: var(--text2); white-space: nowrap; }
.counter b { color: var(--text); font-weight: 600; }
.counter .on { background: var(--pri-soft); color: var(--primary); } .counter .on b { color: var(--primary); }
.counter .d { width: 8px; height: 8px; border-radius: 50%; }
.band { margin-top: 14px; border-radius: 18px; padding: 14px; background: linear-gradient(135deg, var(--err-soft), transparent 70%), var(--card); border: 1px solid var(--err-line); }
.band-h { display: flex; align-items: center; gap: 10px; margin: 0 2px 12px; }
.band-h h3 { margin: 0; font-size: 15px; font-weight: 600; }
.band-h .sp { flex: 1; }
.band-h a { color: var(--primary); font-size: 13px; text-decoration: none; }
.cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.oc { background: var(--card); border-radius: 14px; padding: 12px 14px; border: 1px solid var(--divider); display: grid; grid-template-columns: 36px 1fr; gap: 4px 12px; position: relative; overflow: hidden; }
.oc::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--error); }
.av { width: 36px; height: 36px; border-radius: 11px; display: grid; place-items: center; background: var(--subtle); color: var(--text2); }
.av.off { background: var(--err-soft); color: var(--error); }
.av.flaky { background: var(--warn-soft); color: var(--warning); }
.oc .nm { font-weight: 500; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.oc .sub { font-size: 12px; color: var(--text2); }
.oc .dur { grid-column: 1 / -1; display: flex; align-items: baseline; gap: 8px; margin-top: 8px; }
.oc .dur b { font-size: 22px; font-weight: 600; color: var(--error); letter-spacing: -.01em; }
.oc .dur span { font-size: 12px; color: var(--text2); }
.oc .meta { grid-column: 1 / -1; display: flex; align-items: center; gap: 10px; margin-top: 6px; font-size: 12px; color: var(--text2); }
.tcard { margin-top: 14px; background: var(--card); border-radius: 18px; border: 1px solid var(--divider); overflow: hidden; }
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th { text-align: left; font-size: 12px; font-weight: 500; letter-spacing: .03em; text-transform: uppercase; color: var(--text2); padding: 14px 12px 10px; border-bottom: 1px solid var(--divider); white-space: nowrap; }
th .ic { color: var(--primary); }
td { padding: 10px 12px; border-bottom: 1px solid var(--divider); vertical-align: middle; white-space: nowrap; }
tr:last-child td { border-bottom: 0; }
td:first-child, th:first-child { padding-left: 18px; }
.namecell { display: flex; align-items: center; gap: 12px; }
.namecell .av { width: 32px; height: 32px; border-radius: 10px; }
tr.off td { background: var(--err-soft); }
tr.off td:first-child { box-shadow: inset 4px 0 0 var(--error); }
tr.flaky td:first-child { box-shadow: inset 4px 0 0 var(--warning); }
.st { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }
.st small { font-size: 12px; color: var(--text2); }
tr.off .st small { color: var(--error); font-weight: 500; }
.av24 { display: flex; align-items: center; gap: 8px; }
.av24 span { font-size: 12.5px; color: var(--text2); width: 46px; text-align: right; }
.mm { color: var(--text3); }
.foot { display: flex; justify-content: space-between; padding: 10px 6px; font-size: 12px; color: var(--text2); }
.upd-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--primary); margin-left: 6px; vertical-align: 2px; }
/* Spalten-Popover */
.pop { position: absolute; width: 330px; background: var(--card); border-radius: 18px; box-shadow: var(--shadow); border: 1px solid var(--divider); padding: 14px; z-index: 10; }
.pop h4 { margin: 2px 4px 2px; font-size: 15px; } .pop .ps { margin: 0 4px 10px; font-size: 12px; color: var(--text2); }
.pop .row { display: flex; align-items: center; gap: 10px; padding: 7px 6px; border-radius: 10px; font-size: 14px; }
.pop .row .ic.dr { color: var(--text3); }
.pop .row .lbl { flex: 1; } .pop .row.fixed .lbl::after { content: "fest"; margin-left: 8px; font-size: 11px; color: var(--text3); }
.pop .row.drag { background: var(--hover); box-shadow: var(--shadow-s); }
.pop hr { border: 0; border-top: 1px solid var(--divider); margin: 8px 4px; }
.pop .pf { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding: 0 4px; font-size: 13px; }
.pop .pf a { color: var(--primary); }
/* Dialog */
.scrim { position: fixed; inset: 0; background: var(--scrim); }
.dlg { position: absolute; left: 50%; transform: translateX(-50%); top: 40px; width: 680px; background: var(--card); border-radius: 22px; box-shadow: var(--shadow); padding: 22px 22px 0; }
.dh { display: flex; gap: 14px; align-items: flex-start; }
.dh .av { width: 52px; height: 52px; border-radius: 15px; }
.dh h2 { margin: 2px 0 6px; font-size: 21px; font-weight: 500; }
.dh .pills { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.xbtn { margin-left: auto; width: 36px; height: 36px; border-radius: 50%; background: var(--subtle); display: grid; place-items: center; color: var(--text2); flex: none; }
.acts { display: flex; gap: 8px; margin: 16px 0 6px; flex-wrap: wrap; }
.acts .btn { height: 34px; font-size: 13px; padding: 0 14px; }
.sec { margin-top: 18px; }
.sech { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.box { background: var(--subtle); border-radius: 16px; padding: 14px 16px; }
.big { font-size: 22px; font-weight: 500; } .big small { font-size: 13px; color: var(--text2); }
.tl { position: relative; height: 22px; border-radius: 8px; background: var(--success-strip); margin: 12px 0 6px; overflow: hidden; }
.tl i { position: absolute; top: 0; bottom: 0; background: var(--warning); border-radius: 4px; }
.tl i.run { background: repeating-linear-gradient(135deg, var(--error) 0 6px, color-mix(in srgb, var(--error) 70%, #fff) 6px 12px); }
.axis { display: flex; justify-content: space-between; font-size: 11px; color: var(--text2); padding: 0 2px; }
.ol { margin-top: 10px; border-top: 1px solid var(--divider); padding-top: 8px; }
.ol div { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
.ol .r { color: var(--error); font-weight: 500; } .ol .o { color: var(--warning); }
.tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.tile { background: var(--subtle); border-radius: 14px; padding: 11px 13px; min-height: 64px; }
.tile .k { font-size: 12px; color: var(--text2); margin-bottom: 5px; }
.tile .v { font-size: 14.5px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.tile .s { font-size: 12px; color: var(--text2); margin-top: 2px; }
.tile.warn { background: var(--err-soft); } .tile.warn .v { color: var(--error); font-weight: 500; }
.ents { background: var(--subtle); border-radius: 16px; }
.ent { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--divider); font-size: 14px; }
.ent:last-child { border-bottom: 0; }
.ent .eid { font-size: 11.5px; color: var(--text2); }
.ent .val { margin-left: auto; color: var(--error); font-size: 13px; }
.ent .val.t2 { color: var(--text2); }
.setrow { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-bottom: 1px solid var(--divider); }
.setrow:last-child { border-bottom: 0; }
.setrow .lb { flex: 1; } .setrow .lb div:last-child { font-size: 12px; color: var(--text2); }
.later { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--pri-soft); color: var(--primary); margin-left: 8px; text-transform: none; letter-spacing: 0; }
.dfoot { position: sticky; bottom: 0; background: var(--card); display: flex; gap: 10px; padding: 14px 0 18px; margin-top: 18px; border-top: 1px solid var(--divider); }
.dfoot .btn { flex: 1; justify-content: center; height: 42px; }
`;

const statusCell = (d) =>
  d.status === "off"
    ? `<div class="st"><span class="pill off"><span class="dot"></span>Offline</span><small>seit ${d.since}</small></div>`
    : d.status === "flaky"
    ? `<div class="st"><span class="pill flaky">Instabil</span><small>${d.out} Unterbrüche / 24 Std.</small></div>`
    : `<div class="st"><span class="pill on"><span class="dot"></span>Online</span></div>`;

const row = (d) => `<tr class="${d.status}">
  <td><div class="namecell"><div class="av ${d.status === "on" ? "" : d.status}">${connIcon(d.conn, 18)}</div><div>${d.name}<div class="t2" style="font-size:12px">${d.area}</div></div></div></td>
  <td>${statusCell(d)}</td>
  <td>${connHtml(d, { showVia: true })}</td>
  <td>${INTEG[d.integ]}</td>
  <td>${d.maker}<div class="t2" style="font-size:12px">${d.model}</div></td>
  <td>${d.sw}${d.upd ? `<span class="upd-dot" title="Update verfügbar"></span>` : ""}</td>
  <td>${batHtml(d.bat)}</td>
  <td><div class="av24">${stripSvg(d, 110, 14)}<span>${d.avail.toString().replace(".", ",")} %</span></div></td>
  <td class="mm">⋮</td>
</tr>`;

const toolbar = (pressCols = false) => `<div class="tb">
  ${LOGO(32)}
  <div class="search">${ic("search", 20)} In allen Spalten suchen…</div>
  <div class="counter">
    <span class="on"><b>${KPI.total}</b> Geräte</span>
    <span><i class="d" style="background:var(--success)"></i><b>${KPI.online}</b> online</span>
    <span><i class="d" style="background:var(--error)"></i><b style="color:var(--error)">${KPI.offline}</b> offline</span>
    <span><i class="d" style="background:var(--warning)"></i><b>${KPI.flaky}</b> instabil</span>
  </div>
  <span class="btn">${ic("filter", 18)} Filter</span>
  <span class="btn" style="${pressCols ? "background:var(--pri-soft);color:var(--primary);border-color:transparent" : ""}">${ic("columns", 18)} Spalten</span>
  <span class="btn round">${ic("cog", 20)}</span>
</div>`;

const band = (n = 4, compact = false) => `<div class="band">
  <div class="band-h"><span class="pulse-dot"></span><h3>${KPI.offline} Geräte ausgefallen</h3>${compact ? "" : `<span class="t2" style="font-size:13px">· längster seit ${KPI.longest} · 2 seit heute</span>`}<span class="sp"></span><a>${compact ? "Nur diese" : "Nur ausgefallene zeigen"}</a></div>
  <div class="cards">${DEVICES.filter((d) => d.status === "off").slice(0, n).map((d) => `<div class="oc">
    <div class="av off">${connIcon(d.conn, 18)}</div>
    <div style="min-width:0"><div class="nm">${d.name}</div><div class="sub">${d.area} · ${INTEG[d.integ]}</div></div>
    <div class="dur"><b>${d.since}</b><span>offline</span></div>
    <div class="meta">${stripSvg(d, 96, 8)}${d.bat != null && d.bat <= 25 ? `<span class="bat low">${ic("battery", 13)} ${d.bat} %</span>` : d.sig ? `<span>${sigText(d.sig)}</span>` : ""}</div>
  </div>`).join("")}</div>
</div>`;

const HEAD = `<tr><th>Gerät</th><th>Status ${ic("sort", 14)}</th><th>Verbindung</th><th>Integration</th><th>Hersteller / Modell</th><th>Software</th><th>Batterie</th><th>Verfügbarkeit 24 Std.</th><th></th></tr>`;

export function mainA({ popover = true } = {}) {
  const pop = popover ? `<div class="pop" style="top:66px;right:68px">
    <h4>Spalten</h4><div class="ps">Desktop · für dich gespeichert, auf allen Geräten gleich</div>
    ${[["Gerät", true, 1, "fixed"], ["Status", true], ["Verbindung", true], ["Integration", true], ["Hersteller / Modell", true, 0, "drag"], ["Software", true], ["Batterie", true], ["Verfügbarkeit 24 Std.", true]]
      .map(([l, on, _x, cls]) => `<div class="row ${cls || ""}">${ic("drag", 18, "dr")}<span class="lbl">${l}</span><span class="toggle ${on ? "on" : ""}"></span></div>`).join("")}
    <hr>
    ${["Bereich", "Unterbrüche 7 Tage", "Zuletzt geändert", "Empfang (Wert)", "Hub / Bridge", "IP-Adresse"].map((l) => `<div class="row">${ic("drag", 18, "dr")}<span class="lbl t2">${l}</span><span class="toggle"></span></div>`).join("")}
    <div class="pf"><span class="t2">Ziehen zum Sortieren</span><a>Zurücksetzen</a></div>
  </div>` : "";
  return `<div class="app" style="position:relative">${toolbar(popover)}${band()}
    <div class="tcard"><table>${HEAD}${DEVICES.map(row).join("")}</table></div>
    <div class="foot"><span>15 von ${KPI.total} Geräten · Stand 14:16</span><span>Zeile antippen für Details</span></div>${pop}</div>`;
}

// Geräteansicht als Dialog (wie unifi_dynamic).
export function deviceA() {
  const d = DEVICES[1];
  return `<div class="app" style="position:relative;height:100%">${toolbar()}${band()}<div class="tcard"><table>${HEAD}${DEVICES.slice(0, 9).map(row).join("")}</table></div></div>
  <div class="scrim"></div>
  <div class="dlg">
    <div class="dh"><div class="av off">${connIcon("zigbee", 28)}</div>
      <div><h2>${d.name}</h2><div class="pills"><span class="pill off"><span class="dot"></span>Offline seit ${d.since}</span><span class="pill none">${connIcon("zigbee", 13)} Zigbee</span><span class="t2" style="font-size:13px">Flur · ZHA</span></div></div>
      <div class="xbtn">${ic("close", 20)}</div></div>
    <div class="acts"><span class="btn">${ic("open", 16)} HA-Geräteseite öffnen</span><span class="btn">${ic("bellOff", 16)} Meldungen stummschalten</span><span class="btn">${ic("eyeOff", 16)} Ausblenden</span></div>
    <div class="sec"><div class="sech"><span class="label">Verfügbarkeit</span><span class="seg"><span class="on">24 Std.</span><span>7 Tage</span><span>30 Tage</span></span></div>
      <div class="box"><div class="big">90,7 <small>%</small> <small style="color:var(--error)">&nbsp;2 Unterbrüche</small><small> · zusammen 2 Std. 17 Min. · läuft</small></div>
        <div class="tl"><i style="left:50.8%;width:1%"></i><i class="run" style="left:90.6%;width:9.4%"></i></div>
        <div class="axis"><span>15:00</span><span>18:00</span><span>21:00</span><span>00:00</span><span>03:00</span><span>06:00</span><span>09:00</span><span>12:00</span><span>jetzt</span></div>
        <div class="ol"><div><span>12:02 – jetzt</span><span class="r">läuft · 2 Std. 14 Min.</span></div><div><span>03:12 – 03:15 <span class="t2">· Sammelausfall: 6 Zigbee-Geräte</span></span><span class="o">3 Min.</span></div></div></div></div>
    <div class="sec"><div class="sech"><span class="label">Verbindung</span></div><div class="tiles">
      <div class="tile"><div class="k">Verbindungsart</div><div class="v">${connIcon("zigbee", 16)} Zigbee</div><div class="s">Endgerät, schläft</div></div>
      <div class="tile warn"><div class="k">Empfang (zuletzt)</div><div class="v">${bars(1)} LQI 38 · −86 dBm</div><div class="s">schwach</div></div>
      <div class="tile"><div class="k">Route</div><div class="v">über Steckdose Flur</div><div class="s">Router · dann Koordinator</div></div>
      <div class="tile"><div class="k">Zuletzt gesehen</div><div class="v">12:01:47</div><div class="s">vor 2 Std. 14 Min.</div></div>
      <div class="tile"><div class="k">IEEE</div><div class="v mono">00:15:8d:00:0a:41:7c:22</div></div>
      <div class="tile"><div class="k">Integration</div><div class="v">ZHA</div><div class="s">Zigbee Home Automation</div></div>
    </div></div>
    <div class="sec"><div class="sech"><span class="label">Gerät</span></div><div class="tiles">
      <div class="tile"><div class="k">Hersteller / Modell</div><div class="v">${d.maker} ${d.model}</div></div>
      <div class="tile"><div class="k">Software</div><div class="v">2.1.4 <span class="pill upd">2.2.0 verfügbar</span></div></div>
      <div class="tile warn"><div class="k">Batterie</div><div class="v">${ic("battery", 16)} 8 %</div><div class="s" style="color:var(--error)">vermutlich Ursache des Ausfalls</div></div>
    </div></div>
    <div class="sec"><div class="sech"><span class="label">Entitäten · 4</span></div><div class="ents">
      ${[["Bewegung", "binary_sensor.bewegungsmelder_flur"], ["Beleuchtungsstärke", "sensor.bewegungsmelder_flur_illuminance"], ["Batterie", "sensor.bewegungsmelder_flur_battery"]].map(([n, e]) => `<div class="ent"><span class="av" style="width:30px;height:30px;border-radius:9px">${ic("pulse", 16)}</span><div>${n}<div class="eid">${e}</div></div><span class="val">nicht verfügbar</span></div>`).join("")}
      <div class="ent"><span class="av" style="width:30px;height:30px;border-radius:9px">${ic("pulse", 16)}</span><div>LQI<div class="eid">sensor.bewegungsmelder_flur_lqi · Diagnose</div></div><span class="val t2">deaktiviert</span></div>
    </div></div>
    <div class="sec"><div class="sech"><span class="label">Einstellungen für dieses Gerät <span class="later">später</span></span></div><div class="ents">
      <div class="setrow"><div class="lb"><div>Push bei Ausfall</div><div>Standard der Integration ZHA: an</div></div><span class="toggle on"></span></div>
      <div class="setrow"><div class="lb"><div>Eigene Schwelle</div><div>Erst nach 10 Min. als ausgefallen werten (schläft oft)</div></div><span class="toggle"></span></div>
    </div></div>
    <div class="dfoot"><span class="btn">Schliessen</span></div>
  </div>`;
}

// --- Handy ------------------------------------------------------------------
export const CSS_A_M = `
.m { padding: 10px 12px; }
.m .tb { gap: 8px; } .m .search { height: 40px; font-size: 14px; }
.m .counter { margin-top: 10px; width: 100%; overflow: hidden; }
.m .counter span { padding: 6px 9px; font-size: 13px; }
.m .band { padding: 12px; border-radius: 16px; }
.m .cards { display: flex; overflow: hidden; gap: 8px; }
.m .oc { min-width: 220px; }
.m .tcard { border-radius: 16px; overflow: hidden; }
.m td, .m th { padding: 9px 10px; }
.m td:first-child, .m th:first-child { padding-left: 12px; position: sticky; left: 0; background: var(--card); }
.m tr.off td:first-child { background: color-mix(in srgb, var(--error) 9%, var(--card)); }
.sheet { position: absolute; left: 0; right: 0; bottom: 0; height: 88%; background: var(--card); border-radius: 22px 22px 0 0; box-shadow: var(--shadow); padding: 8px 14px 0; overflow: hidden; }
.grab { width: 40px; height: 5px; border-radius: 3px; background: var(--bar-off); margin: 0 auto 12px; }
.sheet .tiles { grid-template-columns: repeat(2, 1fr); }
.sheet .dh .av { width: 44px; height: 44px; border-radius: 13px; }
.sheet .dh h2 { font-size: 19px; }
`;

export function mobileA() {
  return `<div class="m">
    <div class="tb">${LOGO(28)}<div class="search">${ic("search", 18)} Suchen…</div><span class="btn round">${ic("columns", 18)}</span><span class="btn round">${ic("cog", 20)}</span></div>
    <div class="counter"><span class="on"><b>${KPI.total}</b> Geräte</span><span><i class="d" style="background:var(--success)"></i><b>${KPI.online}</b> online</span><span><i class="d" style="background:var(--error)"></i><b style="color:var(--error)">${KPI.offline}</b> offline</span></div>
    <div style="margin-top:10px">${band(4, true)}</div>
    <div class="tcard" style="margin-top:10px"><table><tr><th>Gerät</th><th>Status</th><th>Verbindung</th></tr>${DEVICES.slice(0, 10).map((d) => `<tr class="${d.status}">
      <td><div class="namecell"><div class="av ${d.status === "on" ? "" : d.status}">${connIcon(d.conn, 16)}</div><div style="max-width:120px;white-space:normal;line-height:1.25">${d.name}</div></div></td>
      <td>${statusCell(d).replace(" / 24 Std.", "")}</td><td>${connHtml(d)}</td></tr>`).join("")}</table></div>
  </div>`;
}

export function mobileDeviceA() {
  const d = DEVICES[1];
  return `<div class="m" style="filter:brightness(.6)">${mobileA()}</div><div class="scrim" style="background:transparent"></div>
  <div class="sheet"><div class="grab"></div>
    <div class="dh"><div class="av off">${connIcon("zigbee", 24)}</div><div><h2>${d.name}</h2><div class="pills"><span class="pill off"><span class="dot"></span>Offline seit ${d.since}</span></div></div><div class="xbtn">${ic("close", 18)}</div></div>
    <div class="acts"><span class="btn">${ic("open", 16)} HA-Gerät</span><span class="btn">${ic("bellOff", 16)} Stumm</span><span class="btn">${ic("eyeOff", 16)}</span></div>
    <div class="sec"><div class="sech"><span class="label">Verfügbarkeit</span><span class="seg"><span class="on">24 Std.</span><span>7 T.</span><span>30 T.</span></span></div>
      <div class="box"><div class="big">90,7 <small>%</small> <small style="color:var(--error)">2 Unterbrüche</small></div>
      <div class="tl"><i style="left:50.8%;width:1.5%"></i><i class="run" style="left:90.6%;width:9.4%"></i></div>
      <div class="axis"><span>15:00</span><span>21:00</span><span>03:00</span><span>09:00</span><span>jetzt</span></div></div></div>
    <div class="sec"><div class="sech"><span class="label">Verbindung</span></div><div class="tiles">
      <div class="tile"><div class="k">Verbindungsart</div><div class="v">${connIcon("zigbee", 16)} Zigbee</div><div class="s">Endgerät</div></div>
      <div class="tile warn"><div class="k">Empfang</div><div class="v">${bars(1)} LQI 38</div><div class="s">schwach</div></div>
      <div class="tile"><div class="k">Route</div><div class="v">Steckdose Flur</div><div class="s">dann Koordinator</div></div>
      <div class="tile warn"><div class="k">Batterie</div><div class="v">${ic("battery", 16)} 8 %</div></div>
    </div></div>
  </div>`;
}
