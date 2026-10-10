// Mockups (Wunsch des Nutzers, 2026-10-10): Das Detail einer Integration (Einstellungen › Überwachung und Meldungen
// › Integrationen › Matter) in Reiter gliedern statt eine lange Seite. Im echten Panel (Nachbau, erfundene Daten),
// die Reiter-Inhalte sind mit den echten Klassen nachgebaut.
//   A (Empfehlung): Unterreiter Ausfall | Batterie | Laden | Neu | Empfang | Geräte
//   B: wie die globale Struktur: Ausfall | Batterie (mit Unterreitern Warnung und Laden) | Neu | Empfang | Geräte
//   C: aufklappbare Abschnitte statt Reiter
// Aufruf: CHROMIUM_PATH=... node docs/mockups/integ-tabs-v1/src/render.mjs
import { setup, svg } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8976, import.meta.url);

const CSS = `
.mk-scroll { display:flex; overflow-x:auto; scrollbar-width:none }
.mk-scroll::-webkit-scrollbar { display:none }
.mk-scroll .sub-tab { flex: 1 0 auto; padding: 0 9px }
.mk-acc { border:1px solid var(--dp-divider); border-radius:14px; margin:10px 0; overflow:hidden }
.mk-acc > button { display:flex; align-items:center; gap:8px; width:100%; padding:12px 14px; background:none; border:0; color:var(--dp-text); font:inherit; font-size:14px; font-weight:600; text-align:left }
.mk-acc > button small { margin-left:auto; color:var(--dp-text2); font-weight:400; font-size:12px }
.mk-acc .mk-body { padding:0 14px 6px }
.mk-acc.closed .mk-body { display:none }
.mk-dot { width:7px; height:7px; border-radius:50%; background: var(--dp-primary) }
`;
const chev = svg("chevDown", 18);
const row = (label, control, origin, own = false, extra = "") => `<div class="opt${own ? " changed" : ""}"><div class="opt-line"><span class="opt-label">${label}</span>${control}</div>${extra}<div class="opt-origin"><span class="origin ${own ? "own" : "std"}">${own ? "Eigene" : "Standard"}</span>${origin ? `<span>${origin}</span>` : ""}</div></div>`;
const sel = (text) => `<span class="opt-select"><select><option>${text}</option></select>${chev}</span>`;
const sw = (on = true) => `<label class="switch"><input type="checkbox" ${on ? "checked" : ""}><span></span></label>`;
const note = (t) => `<div class="opt-short mon-hint">${t}</div>`;

const PANES = {
  outage: () => `__TL__${row("Überwachen", sw(), "")}${row("Ausgefallen nach", sel("Standard (5 Min.)"), "")}${row("Push bei Ausfall", sw(), "")}`,
  battery: () => `${row("Schwach ab", sel("Eigene Schwelle: 15 %"), "Standard wäre 10 %", true)}${row("Push bei schwacher Batterie", sw(), "")}`,
  charge: () => `${row("Laden melden", sw(), "")}${row("Voll ab", sel("80 %"), "Standard wäre 100 %", true)}${row("Ladung erkannt bei Anstieg", sel("Standard (20 %)"), "")}${row("Ladung beendet nach", sel("Standard (15 Min.)"), "")}${row("Push bei beendeter Ladung", sel("Standard (aus)"), "")}`,
  newdev: () => `${row("Neue Geräte melden", sw(), "")}${note("Meldet neue Geräte dieser Integration, sobald sie in Home Assistant erscheinen.")}`,
  signal: () => `<div class="opt-short sig-intro">Schwach unter diesem Wert gilt der Empfang als schlecht.</div>${row("Thread", sel("Standard (LQI 61)"), "")}${row("Zigbee", sel("Standard (LQI 61)"), "")}`,
  devices: () => `<div class="opt-short">Geräte dieser Integration mit eigenen Einstellungen:</div><div class="ovr-list"><div class="opt-short" style="padding:10px 0">Thermostat Bad · eigene Schwelle 15 %</div><div class="opt-short" style="padding:10px 0">Türsensor Keller · Lademeldung aus</div></div>`,
};
const TABS = [["outage", "Ausfall", false], ["battery", "Batterie", true], ["charge", "Laden", true], ["newdev", "Neu", false], ["signal", "Empfang", false], ["devices", "Geräte", true]];
const subTabs = (items, on) => `<div class="sub-tabs mk-scroll" role="tablist">${items.map(([id, label, chg]) => `<button type="button" role="tab" class="sub-tab${id === on ? " on" : ""}${chg ? " chg" : ""}">${label}</button>`).join("")}</div>`;
const reset = `<div class="integ-reset"><button type="button" class="ovr-all">Alles auf Standard</button></div>`;

async function shotOf(name, build) {
  const { ctx, p, ev } = await page(true, { css: CSS, width: 402, height: 874, freeze: false });
  await p.evaluate(() => { Object.assign(window.__opts, { notify_service: "notify.handy", notify_charge: true, charge_integrations: ["matter"], battery_push: true, notify_new: true }); });
  await ev(`r.host._fetch()`);
  await ev(`r.querySelector(".gear-btn").click()`);
  await p.waitForTimeout(600);
  await ev(`r.querySelector('[data-set="section"][data-id="monitor"]').click()`);
  await p.waitForTimeout(300);
  await ev(`r.querySelector('.mon-tab[data-key="integ"]').click()`);
  await p.waitForTimeout(300);
  await ev(`r.querySelector('.ilist-row[data-key="matter"]').click()`);
  await p.waitForTimeout(500);
  await ev(`r.host._fetch = () => {}`);
  await ev(
    `
    const back = r.querySelector(".iback"); const root = back.parentElement;
    const tl = root.querySelector(".mtl.ptl").outerHTML;
    // alles nach dem Kopf entfernen
    const head = root.querySelector(".ihead");
    while (head.nextSibling) head.nextSibling.remove();
    head.insertAdjacentHTML("afterend", ${JSON.stringify(build())}.replace("__TL__", tl));
    back.scrollIntoView({ block: "start" });
  `
  );
  const f = await shot(p, true, name);
  await ctx.close();
  return f;
}
const pane = (id) => PANES[id]();
const A = (on) => () => subTabs(TABS, on) + `<div class="mk-pane">${pane(on)}</div>` + reset;
const B = (on, sub) => () => {
  const tabs = [["outage", "Ausfall", false], ["battery", "Batterie", true], ["newdev", "Neu", false], ["signal", "Empfang", false], ["devices", "Geräte", true]];
  const inner = on === "battery" ? subTabs([["battery", "Warnung", true], ["charge", "Laden", true]], sub) + `<div class="mk-pane">${pane(sub)}</div>` : `<div class="mk-pane">${pane(on)}</div>`;
  return subTabs(tabs, on) + inner + reset;
};
const C = () => {
  const acc = (id, title, summary, open, chg) => `<div class="mk-acc${open ? "" : " closed"}"><button type="button">${title}${chg ? '<i class="mk-dot"></i>' : ""}<small>${summary}</small>${chev}</button><div class="mk-body">${pane(id)}</div></div>`;
  return acc("outage", "Ausfall", "5 Min., Push an", false, false) + acc("battery", "Batterie", "eigene Schwelle 15 %", false, true) + acc("charge", "Laden", "voll ab 80 %", true, true) + acc("newdev", "Neue Geräte", "Meldung an", false, false) + acc("signal", "Empfang", "Standard", false, false) + reset;
};
const files = [
  await shotOf("A1", A("outage")), await shotOf("A2", A("charge")),
  await shotOf("B1", B("battery", "charge")), await shotOf("C1", C),
];
await compose("1-Reiter-Integration.png", [
  [files[0], "A: Reiter Ausfall | Batterie | Laden | Neu | Empfang | Geräte; Punkt = eigene Einstellung (Ausfall gewählt, mit Zeitleiste)", 300],
  [files[1], "A: Reiter \"Laden\" gewählt: alle Lade-Zeilen auf einer kurzen Seite (Empfehlung)", 300],
  [files[2], "B: wie global: Batterie mit Unterreitern \"Warnung | Laden\"", 300],
  [files[3], "C: aufklappbare Abschnitte mit Zusammenfassung statt Reiter", 300],
]);
await close();
console.log("fertig");
