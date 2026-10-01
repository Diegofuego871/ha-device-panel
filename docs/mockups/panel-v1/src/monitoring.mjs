// Überwachung flexibel einstellen: drei Ebenen (Standard, pro Integration,
// Regeln) plus Ausnahme pro Gerät. Regeln: Bedingungen (UND) und Wirkungen,
// von oben nach unten, je Einstellung gewinnt die oberste passende Regel.
import { ic, connIcon } from "./base.mjs";
import { CSS_A } from "./variantA.mjs";
import { CSS_B } from "./variantB.mjs";
import { CSS_S } from "./settings.mjs";

export const CSS_M = `
.wrap { display: grid; grid-template-columns: 720px 600px; gap: 28px; justify-content: center; padding: 28px; position: relative; }
.panel { position: relative; background: var(--card); border-radius: 24px; box-shadow: var(--shadow); padding: 22px; }
.levels { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0 6px; }
.lv { border-radius: 14px; padding: 10px 12px; background: var(--subtle); font-size: 12.5px; color: var(--text2); position: relative; }
.lv b { display: block; color: var(--text); font-size: 13.5px; font-weight: 500; margin-bottom: 2px; }
.lv.on { background: var(--pri-soft); } .lv.on b { color: var(--primary); }
.lv i { position: absolute; right: -7px; top: 50%; transform: translateY(-50%); color: var(--text3); font-style: normal; z-index: 1; }
.hint { font-size: 12px; color: var(--text2); margin: 4px 2px 12px; }
.rule { display: grid; grid-template-columns: 22px 1fr auto; gap: 6px 12px; align-items: start; padding: 12px 14px; border: 1px solid var(--divider); border-radius: 16px; margin-bottom: 8px; background: var(--card); }
.rule.picked { border-color: var(--primary); box-shadow: 0 0 0 3px var(--pri-soft); }
.rule .ic.dr { color: var(--text3); margin-top: 2px; }
.rule .nm { font-weight: 500; font-size: 14.5px; }
.rule .cnt { font-size: 12px; color: var(--primary); background: var(--pri-soft); border-radius: 999px; padding: 2px 9px; white-space: nowrap; }
.rule .rr { display: flex; align-items: center; gap: 10px; }
.cl { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 7px; align-items: center; }
.cond, .eff { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px; border-radius: 8px; font-size: 12px; white-space: nowrap; }
.cond { background: var(--subtle); color: var(--text); } .cond span { color: var(--text2); }
.eff { background: var(--ok-soft); color: var(--success); } .eff.off { background: var(--err-soft); color: var(--error); } .eff.p { background: var(--vio-soft); color: var(--violet); }
.arrow { color: var(--text3); font-size: 13px; }
.addr { display: flex; align-items: center; justify-content: center; gap: 8px; height: 42px; border: 1.5px dashed var(--divider); border-radius: 14px; color: var(--primary); font-size: 14px; font-weight: 500; }
.ed h3 { margin: 0; font-size: 19px; font-weight: 500; }
.ed .sub { font-size: 12.5px; color: var(--text2); margin-top: 2px; }
.blk { margin-top: 16px; }
.blk .label { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.crow { display: grid; grid-template-columns: 150px 70px 1fr 28px; gap: 8px; align-items: center; margin-bottom: 6px; }
.crow .f { height: 36px; border: 1px solid var(--divider); border-radius: 10px; display: flex; align-items: center; justify-content: space-between; padding: 0 10px; font-size: 13.5px; background: var(--input); }
.crow .op { color: var(--text2); font-size: 13px; text-align: center; }
.crow .x { color: var(--text3); display: grid; place-items: center; }
.add { color: var(--primary); font-size: 13.5px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; margin-top: 4px; }
.erow { display: flex; align-items: center; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--divider); font-size: 14px; }
.erow:last-child { border-bottom: 0; }
.erow .lb { flex: 1; } .erow .lb div:last-child { font-size: 12px; color: var(--text2); }
.erow .keep { font-size: 12px; color: var(--text3); }
.segx { display: inline-flex; padding: 3px; border-radius: 10px; background: var(--subtle); }
.segx span { padding: 5px 10px; font-size: 12.5px; border-radius: 8px; color: var(--text2); }
.segx span.on { background: var(--card); color: var(--text); box-shadow: var(--shadow-s); font-weight: 500; }
.prev { margin-top: 14px; background: var(--subtle); border-radius: 14px; padding: 12px 14px; font-size: 13px; }
.prev b { font-weight: 500; } .prev .names { color: var(--text2); margin-top: 4px; line-height: 1.5; }
.prev .warn { margin-top: 8px; display: flex; gap: 8px; align-items: flex-start; color: #b45309; font-size: 12.5px; }
.efoot { display: flex; gap: 10px; margin-top: 16px; } .efoot .btn { flex: 1; justify-content: center; height: 42px; }
.why { margin-top: 18px; border-radius: 18px; border: 1px solid var(--divider); padding: 14px 16px; }
.why h4 { margin: 0 0 8px; font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 8px; }
.why .ln { display: grid; grid-template-columns: 150px 1fr; gap: 8px; font-size: 13px; padding: 5px 0; border-top: 1px solid var(--divider); }
.why .ln span:first-child { color: var(--text2); }
.why .src { font-size: 11.5px; color: var(--text3); margin-left: 6px; }
`;

const RULES = [
  { n: "Handys ausblenden", c: [["Integration", "Mobile App"]], e: [["Nicht anzeigen", "off"]], cnt: 3 },
  { n: "Kritische Geräte sofort melden", c: [["Label", "kritisch"]], e: [["Ausgefallen nach 1 Min."], ["Push sofort", "p"], ["Anhaltend", "p"]], cnt: 7 },
  { n: "Zigbee-Batteriegeräte geduldiger", c: [["Integration", "ZHA"], ["Stromversorgung", "Batterie"]], e: [["Ausgefallen nach 2 Std."]], cnt: 23, sel: true },
  { n: "Shelly: nur Schalter zählen", c: [["Integration", "Shelly"]], e: [["Lebenszeichen: Schalter, Licht"]], cnt: 21 },
  { n: "Garten nachts ruhig", c: [["Bereich", "Garten"]], e: [["Push 22–07 Uhr aus", "off"]], cnt: 6 },
  { n: "Wetter-Cloud nicht überwachen", c: [["Verbindungsart", "Cloud"], ["Entitätstyp", "Wetter"]], e: [["Nicht überwachen", "off"]], cnt: 2 },
];

const ruleCard = (r) => `<div class="rule ${r.sel ? "picked" : ""}">${ic("drag", 18, "dr")}
  <div><div class="nm">${r.n}</div>
    <div class="cl">${r.c.map(([k, v]) => `<span class="cond"><span>${k}</span> ${v}</span>`).join(`<span class="arrow">und</span>`)}<span class="arrow">→</span>${r.e.map(([t, cls]) => `<span class="eff ${cls || ""}">${t}</span>`).join("")}</div></div>
  <div class="rr"><span class="cnt">${r.cnt} Geräte</span><span class="toggle on"></span></div></div>`;

export function monitoring() {
  const left = `<div class="panel">
    <div class="shead"><div class="av">${ic("cog", 28)}</div><div><h2>Einstellungen</h2><div class="t2" style="font-size:13px">Device Panel · Abschnitt "Überwachung"</div></div></div>
    <div class="acc" style="margin-top:16px"><div class="ah"><div class="tx"><b>Überwachung</b><span class="chg">geändert</span><div>128 Geräte · 6 Regeln · 2 Ausnahmen pro Gerät</div></div>${ic("chevUp", 22)}</div>
      <div class="ab">
        <div class="levels">
          <div class="lv"><b>1 · Standard</b>Ausgefallen nach 2 Min., alle Geräte<i>›</i></div>
          <div class="lv"><b>2 · Integration</b>Tabelle wie bisher<i>›</i></div>
          <div class="lv on"><b>3 · Regeln</b>Bedingungen frei kombinierbar<i>›</i></div>
          <div class="lv"><b>4 · Gerät</b>Ausnahme in der Geräteansicht</div>
        </div>
        <div class="hint">Je Einstellung gilt die genaueste Angabe: Gerät vor Regel vor Integration vor Standard. Unter den Regeln gewinnt die obere.</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin:4px 0 10px"><span class="segx"><span>Integrationen</span><span class="on">Regeln</span></span><span class="t2" style="font-size:12px">Ziehen ändert die Reihenfolge</span></div>
        ${RULES.map(ruleCard).join("")}
        <div class="addr">${ic("lightning", 16)} Regel hinzufügen</div>
      </div></div></div>`;

  const right = `<div>
    <div class="panel ed">
      <h3>Regel bearbeiten</h3><div class="sub">Zigbee-Batteriegeräte geduldiger</div>
      <div class="blk"><div class="label">Wenn <span class="t3" style="text-transform:none;letter-spacing:0">(alle Bedingungen)</span></div>
        <div class="crow"><span class="f">Integration ${ic("chevDown", 16)}</span><span class="op">ist</span><span class="f">ZHA ${ic("chevDown", 16)}</span><span class="x">${ic("close", 16)}</span></div>
        <div class="crow"><span class="f">Stromversorgung ${ic("chevDown", 16)}</span><span class="op">ist</span><span class="f">Batterie ${ic("chevDown", 16)}</span><span class="x">${ic("close", 16)}</span></div>
        <span class="add">+ Bedingung</span> <span class="t3" style="font-size:12px;margin-left:8px">Integration, Bereich, Label, Entitätstyp, Verbindungsart, Hersteller, Modell, Stromversorgung, Gerät</span>
      </div>
      <div class="blk"><div class="label">Dann</div>
        <div class="erow"><div class="lb"><div>Ausgefallen nach</div><div>Batteriegeräte melden sich selten.</div></div><span class="num">2 <span>Std.</span></span></div>
        <div class="erow"><div class="lb"><div>Anzeigen</div></div><span class="keep">unverändert</span></div>
        <div class="erow"><div class="lb"><div>Push bei Ausfall</div></div><span class="segx"><span class="on">unverändert</span><span>an</span><span>aus</span></span></div>
        <div class="erow"><div class="lb"><div>Lebenszeichen</div><div>Welche Entitäten zeigen, dass das Gerät lebt.</div></div><span class="sel" style="min-width:200px">Alle ausser Diagnose ${ic("chevDown", 18)}</span></div>
      </div>
      <div class="prev"><b>Trifft auf 23 Geräte zu</b><div class="names">Bewegungsmelder Flur, Fensterkontakt Küche, Rauchmelder Flur, Temperatur Bad, Türkontakt Keller … und 18 weitere</div>
        <div class="warn">${ic("info", 16)}<span>2 dieser Geräte haben eine eigene Ausnahme; dort gilt die Ausnahme.</span></div></div>
      <div class="efoot"><span class="btn">Abbrechen</span><span class="btn primary">Übernehmen</span></div>
    </div>
    <div class="panel why">
      <h4>${connIcon("zigbee", 18)} Bewegungsmelder Flur · Tab "Einstellungen"</h4>
      <div class="ln"><span>Ausgefallen nach</span><span>2 Std.<span class="src">Regel "Zigbee-Batteriegeräte geduldiger"</span></span></div>
      <div class="ln"><span>Push bei Ausfall</span><span>an<span class="src">Integration ZHA</span></span></div>
      <div class="ln"><span>Anhaltend</span><span>aus<span class="src">Standard</span></span></div>
      <div class="ln"><span>Lebenszeichen</span><span>Bewegung, Beleuchtungsstärke<span class="src">Standard: alle ausser Diagnose</span></span></div>
      <div style="margin-top:10px"><span class="btn" style="height:34px;font-size:13px">Ausnahme für dieses Gerät</span></div>
    </div>
  </div>`;
  return `<div class="wrap">${left}${right}</div>`;
}

const ALL = CSS_A + CSS_B + CSS_S + CSS_M;
export const SCREENS_M = [["M-ueberwachung", () => monitoring(), ALL, { width: 1440, height: 980, fixed: true }, "light"]];
