// Variante B "Cockpit": Kennzahlen-Kopf mit Ring, Ausfall-Tafel und
// Ausfall-Puls, Verbindungs-Chips, gruppierte Tabelle mit Gesundheit,
// Geräteansicht als Seitenleiste mit Tabs.
import { DEVICES, INTEG, KPI, CONN_COUNTS, CONN, ic, connIcon, bars, sigLevel, sigText, batHtml, stripSvg, ring, LOGO } from "./base.mjs";
import { CSS_A } from "./variantA.mjs";

export const CSS_B = `
.app { padding: 16px 20px; }
.tb { display: flex; align-items: center; gap: 12px; }
.tb h1 { margin: 0 6px 0 2px; font-size: 20px; font-weight: 500; }
.hero { display: grid; grid-template-columns: 300px 380px 1fr; gap: 12px; margin-top: 14px; }
.kt { background: var(--card); border-radius: 20px; padding: 16px 18px; border: 1px solid var(--divider); position: relative; overflow: hidden; }
.kt .k { font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: var(--text2); font-weight: 500; display: flex; align-items: center; gap: 8px; }
.kt.ring-t { display: grid; grid-template-columns: 112px 1fr; gap: 16px; align-items: center; }
.kt .ringwrap { position: relative; width: 112px; height: 112px; }
.kt .ringwrap .c { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; }
.kt .ringwrap .c b { font-size: 24px; font-weight: 600; display: block; letter-spacing: -.02em; }
.kt .ringwrap .c span { font-size: 11px; color: var(--text2); }
.kt .lines div { display: flex; align-items: center; gap: 8px; font-size: 13.5px; padding: 3px 0; }
.kt .lines i { width: 9px; height: 9px; border-radius: 3px; display: inline-block; }
.kt.err { border-color: var(--err-line); background: radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--error) 16%, transparent), transparent 60%), var(--card); box-shadow: 0 0 0 1px var(--err-line), 0 8px 30px -12px color-mix(in srgb, var(--error) 55%, transparent); }
.kt.err .top .num { font-size: 44px; padding-bottom: 0; color: var(--error); font-weight: 600; color: var(--error); line-height: 1; letter-spacing: -.03em; }
.kt.err .top { display: flex; align-items: flex-end; gap: 12px; margin: 8px 0 10px; }
.kt.err .top span { font-size: 13px; color: var(--text2); padding-bottom: 5px; }
.ol2 div { display: grid; grid-template-columns: 20px 1fr auto; align-items: center; gap: 8px; padding: 5px 0; font-size: 13.5px; border-top: 1px solid var(--divider); }
.ol2 div span:first-child { color: var(--error); }
.ol2 b { color: var(--error); font-weight: 600; font-variant-numeric: tabular-nums; }
.chart { position: relative; }
.chart svg { display: block; }
.callout { position: absolute; background: var(--card); border: 1px solid var(--divider); box-shadow: var(--shadow); border-radius: 12px; padding: 8px 11px; font-size: 12.5px; width: 230px; }
.callout b { display: block; font-size: 13px; margin-bottom: 2px; }
.chips { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
.chips .sp { flex: 1; }
.chips .chip .ic, .chips .chip svg { color: var(--text2); }
.vsep { width: 1px; height: 22px; background: var(--divider); margin: 0 2px; }
.tcard { margin-top: 12px; background: var(--card); border-radius: 20px; border: 1px solid var(--divider); overflow: hidden; }
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th { text-align: left; font-size: 12px; font-weight: 500; letter-spacing: .03em; text-transform: uppercase; color: var(--text2); padding: 14px 12px 10px; border-bottom: 1px solid var(--divider); white-space: nowrap; }
td { padding: 9px 12px; border-bottom: 1px solid var(--divider); vertical-align: middle; white-space: nowrap; }
td:first-child, th:first-child { padding-left: 18px; }
tr.grp td { background: var(--subtle); padding: 8px 18px; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--text2); }
tr.grp.e td { color: var(--error); background: var(--err-soft); }
tr.grp.w td { color: #b45309; background: var(--warn-soft); }
.dark tr.grp.w td { color: #fbbf24; }
tr.grp small { font-weight: 400; text-transform: none; letter-spacing: 0; margin-left: 8px; color: var(--text2); }
.nc { display: flex; align-items: center; gap: 12px; }
.av { position: relative; width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; background: var(--subtle); color: var(--text2); flex: none; }
.av.off { background: var(--err-soft); color: var(--error); } .av.flaky { background: var(--warn-soft); color: var(--warning); }
.av .st { position: absolute; right: -3px; bottom: -3px; width: 12px; height: 12px; border-radius: 50%; border: 2.5px solid var(--card); background: var(--success); }
.av.off .st { background: var(--error); box-shadow: 0 0 8px var(--error); } .av.flaky .st { background: var(--warning); }
.dur { font-size: 15px; font-weight: 600; color: var(--error); font-variant-numeric: tabular-nums; }
.durs { font-size: 12px; color: var(--text2); }
.emp { display: flex; flex-direction: column; gap: 2px; }
.emp .t2 { font-size: 11.5px; }
.hc { display: flex; align-items: center; gap: 8px; }
.a24 { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text2); }
/* Seitenleiste */
.scrim { position: fixed; inset: 0; background: var(--scrim); }
.drawer { position: fixed; top: 0; right: 0; bottom: 0; width: 580px; background: var(--card); box-shadow: -20px 0 50px rgba(0,0,0,.18); border-radius: 24px 0 0 24px; overflow: hidden; }
.dhero { padding: 20px 22px 0; background: radial-gradient(120% 100% at 0% 0%, color-mix(in srgb, var(--error) 18%, transparent), transparent 65%); }
.dhead { display: flex; gap: 14px; align-items: center; }
.dhead .av { width: 56px; height: 56px; border-radius: 17px; }
.dhead h2 { margin: 0 0 6px; font-size: 22px; font-weight: 500; }
.xbtn { margin-left: auto; width: 36px; height: 36px; border-radius: 50%; background: var(--subtle); display: grid; place-items: center; color: var(--text2); flex: none; align-self: flex-start; }
.qa { display: flex; gap: 8px; margin: 14px 0 0; }
.qa .btn { height: 34px; font-size: 13px; padding: 0 13px; }
.tabs { display: flex; gap: 4px; margin-top: 16px; border-bottom: 1px solid var(--divider); }
.tabs span { padding: 10px 12px; font-size: 14px; color: var(--text2); border-bottom: 2.5px solid transparent; margin-bottom: -1px; }
.tabs span.on { color: var(--primary); border-color: var(--primary); font-weight: 500; }
.dbody { padding: 16px 22px; }
.kg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.kg .t { background: var(--subtle); border-radius: 16px; padding: 12px 14px; }
.kg .t .k { font-size: 12px; color: var(--text2); }
.kg .t .v { font-size: 22px; font-weight: 600; margin-top: 4px; letter-spacing: -.01em; }
.kg .t.e .v { color: var(--error); }
.insight { margin-top: 12px; border-radius: 16px; padding: 13px 14px; display: grid; grid-template-columns: 34px 1fr; gap: 12px; background: linear-gradient(135deg, var(--vio-soft), transparent 80%), var(--subtle); border: 1px solid color-mix(in srgb, var(--violet) 25%, transparent); }
.insight .iv { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; background: var(--violet); color: #fff; }
.insight b { display: block; font-size: 14px; margin-bottom: 3px; }
.insight span { font-size: 13px; color: var(--text2); line-height: 1.4; }
.path { margin-top: 12px; background: var(--subtle); border-radius: 16px; padding: 14px 16px; }
.path .lbl { font-size: 12px; color: var(--text2); text-transform: uppercase; letter-spacing: .04em; font-weight: 500; margin-bottom: 10px; display: flex; justify-content: space-between; }
.nodes { display: grid; grid-template-columns: 1fr 110px 1fr 110px 1fr; align-items: center; }
.node { text-align: center; }
.node .nb { width: 46px; height: 46px; border-radius: 50%; margin: 0 auto 6px; display: grid; place-items: center; background: var(--card); box-shadow: var(--shadow-s); }
.node.e .nb { color: var(--error); box-shadow: 0 0 0 3px var(--err-soft), 0 0 16px color-mix(in srgb, var(--error) 40%, transparent); }
.node.g .nb { color: var(--success); } .node.p .nb { color: var(--primary); }
.node div:last-child { font-size: 12px; } .node small { display: block; color: var(--text2); font-size: 11px; }
.link { position: relative; height: 26px; }
.link::before { content: ""; position: absolute; left: 0; right: 0; top: 12px; border-top: 2.5px dashed var(--error); }
.link.g::before { border-top: 2.5px solid var(--t5); }
.link span { position: absolute; left: 50%; top: -6px; transform: translateX(-50%); font-size: 11px; background: var(--subtle); padding: 0 6px; color: var(--text2); white-space: nowrap; }
.link.e span { color: var(--error); font-weight: 500; }
.spark { margin-top: 12px; background: var(--subtle); border-radius: 16px; padding: 12px 14px 8px; }
.kv { margin-top: 12px; background: var(--subtle); border-radius: 16px; }
.kv div { display: flex; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--divider); font-size: 13.5px; }
.kv div:last-child { border-bottom: 0; }
.kv span:first-child { color: var(--text2); }
`;

export const statusB = (d) =>
  d.status === "off"
    ? `<div class="dur">${d.since}</div><div class="durs">offline</div>`
    : d.status === "flaky"
    ? `<span class="pill flaky">Instabil</span><div class="durs">${d.out}× in 24 Std.</div>`
    : `<span class="pill on"><span class="dot"></span>Online</span>`;

export const empB = (d) => {
  const lvl = sigLevel(d.sig);
  if (!lvl) return d.via ? `<div class="emp"><span class="t3">–</span><span class="t2">über ${d.via}</span></div>` : `<span class="t3">–</span>`;
  return `<div class="emp"><span class="sig">${bars(lvl, d.status === "off")} ${sigText(d.sig)}</span>${d.via ? `<span class="t2">über ${d.via}</span>` : ""}</div>`;
};

const rowB = (d) => `<tr>
  <td><div class="nc"><div class="av ${d.status === "on" ? "" : d.status}">${connIcon(d.conn, 18)}<span class="st"></span></div><div>${d.name}<div class="t2" style="font-size:12px">${d.area}</div></div></div></td>
  <td>${statusB(d)}</td>
  <td><span class="sig">${connIcon(d.conn, 16)} ${CONN[d.conn]}</span></td>
  <td>${empB(d)}</td>
  <td><div class="hc">${ring(d.health, 30, 3.5, null, d.health)}</div></td>
  <td><div class="a24">${stripSvg(d, 120, 16)}<span>${String(d.avail).replace(".", ",")} %</span></div></td>
  <td>${batHtml(d.bat)}</td>
  <td>${INTEG[d.integ]}</td>
  <td>${d.sw}${d.upd ? ` <span class="pill upd" style="height:19px;font-size:11px">Update</span>` : ""}</td>
</tr>`;

// Ausfall-Puls: Zahl ausgefallener Geräte über 24 Std. (30-Min.-Schritte).
const PULSE = [1,1,1,1,1,2,1,1,1,1,1,2,1,1,1,1,1,2,1,1,1,1,1,1,7,1,1,1,1,1,1,2,1,1,1,1,2,1,1,1,1,1,2,2,2,2,3,3,4];
export function pulseChart(w, h) {
  const max = 8, n = PULSE.length - 1, pad = 18;
  const x = (i) => (i / n) * (w - 4) + 2, y = (v) => h - pad - (v / max) * (h - pad - 6);
  const pts = PULSE.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const line = "M" + pts.join(" L");
  const area = `${line} L${x(n).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z`;
  const grid = [0, 2, 4, 6, 8].map((v) => `<line x1="0" x2="${w}" y1="${y(v)}" y2="${y(v)}" stroke="var(--divider)"/><text x="${w - 2}" y="${y(v) - 3}" text-anchor="end" font-size="10" fill="var(--text3)">${v}</text>`).join("");
  const labels = ["15:00", "18:00", "21:00", "00:00", "03:00", "06:00", "09:00", "12:00", "jetzt"].map((t, i, a) => `<text x="${(i / (a.length - 1)) * (w - 20) + 10}" y="${h - 3}" text-anchor="middle" font-size="10.5" fill="var(--text2)">${t}</text>`).join("");
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--error)" stop-opacity=".35"/><stop offset="1" stop-color="var(--error)" stop-opacity="0"/></linearGradient></defs>
    ${grid}<path d="${area}" fill="url(#pg)"/><path d="${line}" fill="none" stroke="var(--error)" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="${x(24)}" cy="${y(7)}" r="5" fill="var(--card)" stroke="var(--error)" stroke-width="2.5"/>
    <circle cx="${x(n)}" cy="${y(4)}" r="5" fill="var(--error)"/><circle cx="${x(n)}" cy="${y(4)}" r="10" fill="var(--error)" opacity=".2"/>
    ${labels}</svg>`;
}

export const toolbarB = () => `<div class="tb">${LOGO(32)}<h1>Geräte</h1>
  <div class="search">${ic("search", 20)} In allen Spalten suchen…</div>
  <span class="btn">${ic("columns", 18)} Spalten</span><span class="btn round">${ic("cog", 20)}</span></div>`;

export const heroB = (chartW = 610) => `<div class="hero">
  <div class="kt ring-t"><div class="ringwrap">${ring(96.9, 112, 11, "var(--success)")}<div class="c"><div><b>124</b><span>von 128 online</span></div></div></div>
    <div><div class="k">Verfügbarkeit</div><div style="font-size:26px;font-weight:600;margin:6px 0 8px;letter-spacing:-.02em">98,6 %<span class="t2" style="font-size:12px;font-weight:400"> Ø 24 Std.</span></div>
    <div class="lines"><div><i style="background:var(--success)"></i>122 stabil</div><div><i style="background:var(--warning)"></i>2 instabil</div><div><i style="background:var(--error)"></i>4 ausgefallen</div></div></div></div>
  <div class="kt err"><div class="k"><span class="pulse-dot"></span>Gerade ausgefallen</div>
    <div class="top"><span class="num">4</span><span>längster seit ${KPI.longest}</span></div>
    <div class="ol2">${DEVICES.filter((d) => d.status === "off").map((d) => `<div><span>${connIcon(d.conn, 16)}</span><span>${d.name}</span><b>${d.sinceShort}</b></div>`).join("")}</div></div>
  <div class="kt"><div class="k">${ic("pulse", 16)} Ausfall-Puls · 24 Std.<span style="margin-left:auto" class="seg"><span class="on">24 Std.</span><span>7 Tage</span></span></div>
    <div class="chart" style="margin-top:6px">${pulseChart(chartW, 168)}
      <div class="callout" style="left:${chartW * 0.5 + 16}px;top:4px"><b>03:12 · Sammelausfall</b>6 Zigbee-Geräte gleichzeitig, 3 Min. Vermutlich der Koordinator.</div></div></div>
</div>`;

export const chipsB = () => `<div class="chips"><span class="chip on"><b>Alle</b> <span class="n">${KPI.total}</span></span>
  ${CONN_COUNTS.map(([k, n]) => `<span class="chip">${connIcon(k, 15)} ${CONN[k]} <span class="n">${n}</span></span>`).join("")}
  <span class="vsep"></span><span class="chip">${ic("alert", 15)} Nur Probleme</span><span class="sp"></span>
  <span class="seg"><span class="on">Gruppiert</span><span>Liste</span></span></div>`;

const HEADB = `<tr><th>Gerät</th><th>Status</th><th>Verbindung</th><th>Empfang</th><th>Gesundheit</th><th>Verfügbarkeit 24 Std.</th><th>Batterie</th><th>Integration</th><th>Software</th></tr>`;
const tableB = (limitOn = 9) => `<div class="tcard"><table>${HEADB}
  <tr class="grp e"><td colspan="9">Ausgefallen · 4 <small>längste Dauer zuerst</small></td></tr>${DEVICES.filter((d) => d.status === "off").map(rowB).join("")}
  <tr class="grp w"><td colspan="9">Instabil · 2 <small>3 oder mehr Unterbrüche in 24 Std.</small></td></tr>${DEVICES.filter((d) => d.status === "flaky").map(rowB).join("")}
  <tr class="grp"><td colspan="9">Online · 122</td></tr>${DEVICES.filter((d) => d.status === "on").slice(0, limitOn).map(rowB).join("")}
</table></div>`;

export function mainB() {
  return `<div class="app">${toolbarB()}${heroB()}${chipsB()}${tableB()}</div>`;
}

// LQI-Verlauf 7 Tage, fallend.
export function sparkLqi(w, h) {
  const v = [148, 151, 139, 132, 120, 118, 104, 96, 88, 79, 71, 64, 52, 45, 38];
  const x = (i) => (i / (v.length - 1)) * (w - 8) + 4, y = (q) => h - 16 - ((q - 20) / 160) * (h - 24);
  const line = "M" + v.map((q, i) => `${x(i).toFixed(1)},${y(q).toFixed(1)}`).join(" L");
  return `<svg width="${w}" height="${h}"><defs><linearGradient id="sg" x1="0" x2="1"><stop offset="0" stop-color="var(--t5)"/><stop offset=".55" stop-color="var(--t3)"/><stop offset="1" stop-color="var(--t1)"/></linearGradient></defs>
  <line x1="0" x2="${w}" y1="${y(60)}" y2="${y(60)}" stroke="var(--divider)" stroke-dasharray="4 4"/><text x="${w - 4}" y="${y(60) - 4}" font-size="10" text-anchor="end" fill="var(--text3)">schwach</text>
  <path d="${line}" fill="none" stroke="url(#sg)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${x(v.length - 1)}" cy="${y(38)}" r="4.5" fill="var(--t1)"/>
  ${["Do", "Fr", "Sa", "So", "Mo", "Di", "heute"].map((t, i, a) => `<text x="${(i / (a.length - 1)) * (w - 30) + 14}" y="${h - 2}" font-size="10.5" text-anchor="middle" fill="var(--text2)">${t}</text>`).join("")}</svg>`;
}

export const drawerContent = (narrow = false) => {
  const d = DEVICES[1];
  return `<div class="dhero"><div class="dhead"><div class="av off">${connIcon("zigbee", 28)}<span class="st"></span></div>
      <div><h2>${d.name}</h2><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="pill off"><span class="dot"></span>Offline</span><span class="t2" style="font-size:13px">Flur · ZHA · Zigbee</span></div></div>
      <div class="xbtn">${ic("close", 20)}</div></div>
    <div class="qa"><span class="btn">${ic("open", 16)} ${narrow ? "HA-Gerät" : "HA-Geräteseite"}</span><span class="btn">${ic("bellOff", 16)} ${narrow ? "Stumm" : "Stumm für 24 Std."}</span><span class="btn">${ic("eyeOff", 16)}${narrow ? "" : " Ausblenden"}</span></div>
    <div class="tabs"><span class="on">Übersicht</span><span>Verlauf</span><span>Verbindung</span><span>Entitäten</span>${narrow ? "" : "<span>Einstellungen</span>"}</div></div>
  <div class="dbody">
    <div class="kg"><div class="t e"><div class="k">Offline seit</div><div class="v">2:14 Std.</div></div>
      <div class="t"><div class="k">24 Std.</div><div class="v">90,7 %</div></div>
      <div class="t" style="display:flex;align-items:center;gap:10px"><div>${ring(31, 44, 5, null, 31)}</div><div><div class="k">Gesundheit</div><div style="font-size:13px;color:var(--error);font-weight:500">schwach</div></div></div></div>
    <div class="insight"><div class="iv">${ic("lightning", 18)}</div><div><b>Wahrscheinliche Ursache: Batterie</b><span>Batterie 8 % und der Empfang sinkt seit Tagen (LQI 148 → 38). Batterie tauschen; danach meldet sich das Gerät meist von selbst.</span></div></div>
    <div class="path"><div class="lbl"><span>Funkweg</span><span style="text-transform:none;letter-spacing:0">zuletzt 12:01</span></div>
      <div class="nodes">
        <div class="node e"><div class="nb">${connIcon("zigbee", 22)}</div><div>Bewegungsmelder<small>Endgerät</small></div></div>
        <div class="link e"><span>LQI 38</span></div>
        <div class="node g"><div class="nb">${ic("lightning", 20)}</div><div>Steckdose Flur<small>Router</small></div></div>
        <div class="link g"><span>LQI 201</span></div>
        <div class="node p"><div class="nb">${connIcon("zigbee", 22)}</div><div>Koordinator<small>ZHA</small></div></div>
      </div></div>
    <div class="spark"><div class="path" style="padding:0;margin:0;background:none"><div class="lbl"><span>Empfang · 7 Tage</span><span style="text-transform:none;letter-spacing:0;color:var(--error)">fallend</span></div></div>${sparkLqi(narrow ? 330 : 500, 92)}</div>
    <div class="kv"><div><span>Hersteller / Modell</span><span>${d.maker} ${d.model}</span></div><div><span>Software</span><span>2.1.4 <span class="pill upd" style="height:19px;font-size:11px">2.2.0 verfügbar</span></span></div><div><span>Batterie</span><span class="bat low">${ic("battery", 14)} 8 %</span></div><div><span>IEEE</span><span class="mono">00:15:8d:00:0a:41:7c:22</span></div></div>
  </div>`;
};

export function deviceB() {
  return `<div class="app">${toolbarB()}${heroB()}${chipsB()}${tableB()}</div><div class="scrim"></div><div class="drawer">${drawerContent()}</div>`;
}

// --- Handy ------------------------------------------------------------------
export const CSS_B_M = `
.m { padding: 10px 12px 0; }
.m .tb { gap: 8px; } .m .tb h1 { font-size: 18px; }
.car { display: flex; gap: 10px; margin-top: 12px; overflow: hidden; }
.car .kt { min-width: 300px; }
.car .kt.ring-t { grid-template-columns: 84px 1fr; min-width: 270px; }
.car .ringwrap { width: 84px; height: 84px; } .car .ringwrap .c b { font-size: 19px; }
.dots { display: flex; justify-content: center; gap: 5px; margin-top: 8px; } .dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--bar-off); } .dots i.on { width: 16px; border-radius: 3px; background: var(--primary); }
.m .chips { overflow: hidden; margin-top: 10px; }
.gh { margin: 14px 4px 6px; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; font-weight: 600; color: var(--text2); }
.gh.e { color: var(--error); } .gh.w { color: #b45309; }
.mc { background: var(--card); border-radius: 16px; border: 1px solid var(--divider); padding: 11px 12px; display: grid; grid-template-columns: 38px 1fr auto; gap: 2px 12px; align-items: center; margin-bottom: 8px; position: relative; overflow: hidden; }
.mc.e { border-color: var(--err-line); background: linear-gradient(90deg, var(--err-soft), transparent 70%), var(--card); }
.mc .av { width: 38px; height: 38px; }
.mc .nm { font-weight: 500; font-size: 14.5px; }
.mc .sb { font-size: 12px; color: var(--text2); display: flex; align-items: center; gap: 6px; }
.mc .rt { text-align: right; }
.mc .stripw { grid-column: 2 / -1; margin-top: 6px; }
.mrow { display: grid; grid-template-columns: 34px 1fr auto; gap: 12px; align-items: center; padding: 9px 12px; background: var(--card); border-bottom: 1px solid var(--divider); }
.mlist { border-radius: 16px; overflow: hidden; border: 1px solid var(--divider); }
.sheet { position: absolute; left: 0; right: 0; bottom: 0; height: 90%; background: var(--card); border-radius: 24px 24px 0 0; box-shadow: var(--shadow); overflow: hidden; }
.grab { width: 40px; height: 5px; border-radius: 3px; background: var(--bar-off); margin: 8px auto 0; position: relative; z-index: 2; }
.sheet .dhero { padding: 12px 14px 0; } .sheet .dbody { padding: 12px 14px; }
.sheet .dhead .av { width: 46px; height: 46px; } .sheet .dhead h2 { font-size: 19px; }
.sheet .kg { grid-template-columns: 1fr 1fr; } .sheet .kg .t:last-child { grid-column: 1 / -1; }
.sheet .nodes { grid-template-columns: 1fr 58px 1fr 58px 1fr; }
.sheet .node div:last-child { font-size: 11px; }
.sheet .tabs { overflow: hidden; } .sheet .tabs span { padding: 10px 9px; font-size: 13.5px; }
`;

export const mcard = (d) => `<div class="mc ${d.status === "off" ? "e" : ""}"><div class="av ${d.status === "on" ? "" : d.status}">${connIcon(d.conn, 18)}<span class="st"></span></div>
  <div><div class="nm">${d.name}</div><div class="sb">${connIcon(d.conn, 13)} ${CONN[d.conn]}${sigLevel(d.sig) ? ` ${bars(sigLevel(d.sig), d.status === "off")} ${sigText(d.sig)}` : ""}</div></div>
  <div class="rt">${d.status === "off" ? `<div class="dur">${d.sinceShort}</div><div class="durs">offline</div>` : `<span class="pill flaky">${d.out}× / 24 Std.</span>`}</div>
  <div class="stripw">${stripSvg(d, 300, 7)}</div></div>`;

export function mobileB() {
  return `<div class="m">
    <div class="tb">${LOGO(28)}<h1>Geräte</h1><span style="flex:1"></span><span class="btn round">${ic("search", 19)}</span><span class="btn round">${ic("columns", 18)}</span><span class="btn round">${ic("cog", 20)}</span></div>
    <div class="car">
      <div class="kt ring-t"><div class="ringwrap">${ring(96.9, 84, 9, "var(--success)")}<div class="c"><div><b>124</b><span>von 128</span></div></div></div>
        <div><div class="k">Verfügbarkeit</div><div style="font-size:22px;font-weight:600;margin:4px 0">98,6 %</div><div class="lines"><div><i style="background:var(--warning)"></i>2 instabil</div><div><i style="background:var(--error)"></i>4 ausgefallen</div></div></div></div>
      <div class="kt err"><div class="k"><span class="pulse-dot"></span>Ausgefallen</div><div class="top"><span class="num">4</span><span>längster ${KPI.longest}</span></div></div>
    </div>
    <div class="dots"><i class="on"></i><i></i><i></i></div>
    <div class="chips"><span class="chip on"><b>Alle</b> <span class="n">128</span></span>${CONN_COUNTS.slice(0, 4).map(([k, n]) => `<span class="chip">${connIcon(k, 15)} ${CONN[k]} <span class="n">${n}</span></span>`).join("")}</div>
    <div class="gh e">Ausgefallen · 4</div>${DEVICES.filter((d) => d.status === "off").map(mcard).join("")}
    <div class="gh w">Instabil · 2</div>${DEVICES.filter((d) => d.status === "flaky").map(mcard).join("")}
    <div class="gh">Online · 122</div><div class="mlist">${DEVICES.filter((d) => d.status === "on").slice(0, 4).map((d) => `<div class="mrow"><div class="av">${connIcon(d.conn, 16)}<span class="st"></span></div><div>${d.name}<div class="t2" style="font-size:12px">${CONN[d.conn]} · ${d.area}</div></div><div>${ring(d.health, 28, 3.5, null, d.health)}</div></div>`).join("")}</div>
  </div>`;
}

export function mobileDeviceB() {
  return `<div style="filter:brightness(.55)">${mobileB()}</div><div class="sheet"><div class="grab"></div>${drawerContent(true)}</div>`;
}

const ALL = CSS_A + CSS_B;
export const SCREENS_B = [
  ["B-desktop", () => mainB(), ALL, { width: 1440, height: 1000 }, "light"],
  ["B-desktop-dark", () => mainB(), ALL, { width: 1440, height: 1000 }, "dark"],
  ["B-device", () => deviceB(), ALL, { width: 1440, height: 1060, fixed: true }, "dark"],
  ["B-mobile", () => mobileB(), ALL + CSS_B_M, { width: 390, height: 844, mobile: true }, "light"],
  ["B-mobile-device", () => mobileDeviceB(), ALL + CSS_B_M, { width: 390, height: 844, mobile: true }, "light"],
];
