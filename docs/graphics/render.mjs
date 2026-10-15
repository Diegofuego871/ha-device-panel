// Grafiken für die README (docs/graphics/{de,en}/): das Prinzip der Meldungen und Einstellungen, erklärt als Bild.
// HTML wird mit Chromium als PNG gerendert, alles mit erfundenen Beispielwerten. Aufruf: node docs/graphics/render.mjs
// (CHROMIUM_PATH setzen, falls Playwright den Browser nicht selbst findet). Texte stehen unten je Sprache.
import { chromium } from "../../tests/panel/node_modules/playwright-core/index.mjs";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("./", import.meta.url));
const launch = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

const TEXT = {
  de: {
    // Grafik 1: Ebenen
    lvTitle: "Einmal einstellen, wo nötig überschreiben",
    lvSub: "Jede Einstellung hat drei Ebenen. Das Genauere gewinnt: Gerät vor Integration vor Allgemein.",
    levels: [
      { n: "1", name: "Allgemein", where: "Einstellungen › Überwachung und Meldungen", what: "Die Vorgabe für alle Geräte.", chips: ["Ausgefallen nach 2 Min.", "Batterie schwach ab 15 %", "Empfang schwach unter -80 dBm", "Push-Ziel"] },
      { n: "2", name: "Integration", where: "Einstellungen › Überwachung und Meldungen › Integrationen", what: "Für alle Geräte einer Integration, zum Beispiel Zigbee oder Shelly.", chips: ["Ausgefallen nach 10 Min.", "Batterie schwach ab 25 %", "Kein Push für diese Integration"] },
      { n: "3", name: "Gerät", where: "Geräte-Popup › Einstellungen", what: "Nur für dieses eine Gerät.", chips: ["Eigene Zeit oder nicht überwachen", "Batterie schwach ab 30 % oder aus", "Meldungen aus oder 24 Std. stumm"] },
    ],
    override: "überschreibt",
    exTitle: "Beispiel: Batterie-Warnung",
    exHead: ["Gerät", "Allgemein", "Integration", "Gerät", "Es gilt"],
    exRows: [
      ["Wetterstation (Shelly)", "15 %", "–", "–", "15 %", "Allgemein"],
      ["Bewegungsmelder (Zigbee)", "15 %", "25 %", "–", "25 %", "Integration"],
      ["Türkontakt Keller (Zigbee)", "15 %", "25 %", "30 %", "30 %", "Gerät"],
      ["Fernbedienung (Zigbee)", "15 %", "25 %", "Aus", "keine Warnung", "Gerät"],
    ],
    exNote: "Jede Zeile im Panel nennt die Herkunft: Gerät, Integration oder Standard.",
    mxTitle: "Was sich wo einstellen lässt",
    mxHead: ["", "Allgemein", "Integration", "Gerät"],
    mxRows: [
      ["Überwachung und \"Ausgefallen nach\"", 1, 1, 1],
      ["\"Erst melden nach\"", 1, 0, 0],
      ["Meldungen bei Ausfall und Rückkehr (Push, anhaltend)", 1, 1, 1],
      ["Batterie-Warnung", 1, 1, 1],
      ["Empfang-Warnung", 1, 1, 1],
      ["Laden melden", 1, 1, 1],
      ["Neue Geräte melden", 1, 1, 0],
      ["Update-Erinnerung", 1, 1, 0],
      ["Empfänger (Push-Ziel)", 1, 0, 0],
    ],
    mxNote: "Der Empfänger hat zusätzlich je Reiter ein eigenes Ziel (siehe Grafik \"Wohin die Meldung geht\").",
    // Grafik 2: Ablauf
    flTitle: "Von Ausfall bis Meldung",
    flSub: "Beispiel Ausfall: Wer entscheidet in welchem Schritt?",
    flSteps: [
      { t: "Das Gerät meldet sich nicht mehr", d: "Das Panel sieht es an den Entitäten des Geräts in Home Assistant.", by: "" },
      { t: "Ausgefallen nach 2 Min.", d: "Danach zeigt das Panel das Gerät als ausgefallen, mit Dauer und Statistik.", by: "Gerät › Integration › Allgemein" },
      { t: "Erst melden nach 2 Min.", d: "Erst dann wird gemeldet. Die Zeiten laufen ab Beginn des Ausfalls und werden nicht addiert.", by: "Allgemein" },
      { t: "Darf gemeldet werden?", d: "Nicht, wenn das Gerät auf \"aus\" oder \"stumm\" steht oder die Integration kein Push hat.", by: "Gerät › Integration › Allgemein" },
      { t: "Meldung geht an das Ziel", d: "Ab 3 Geräten gleichzeitig als eine Sammelmeldung mit vermuteter Ursache. Optional zusätzlich anhaltend in Home Assistant.", by: "Ziel des Reiters Ausfall" },
      { t: "Gerät kommt zurück", d: "\"Wieder online\" mit der Dauer ersetzt die Ausfall-Meldung.", by: "Gerät › Integration › Allgemein" },
    ],
    flBy: "entscheidet",
    flTl: ["Gerät weg", "Ausgefallen nach: im Panel ausgefallen", "Erst melden nach: Push kommt", "Zurück: wieder online"],
    // Grafik 3: Ziele
    rtTitle: "Wohin die Meldung geht",
    rtSub: "Ein Push-Ziel für alles, bei Bedarf ein eigenes je Reiter. Magic Push und Routinen wählen selbst.",
    rtGlobal: "Push-Ziel", rtGlobalSub: "Einstellungen › Überwachung und Meldungen › Übersicht", rtGlobalEx: "z. B. notify.mobile_app_iphone",
    rtTabs: [["Ausfall", ""], ["Batterie", "eigenes Ziel"], ["Laden", ""], ["Neu", ""], ["Updates", ""], ["Routinen", "eigenes Ziel"]],
    rtFollow: "folgt dem Push-Ziel", rtOwn: "eigenes Ziel",
    rtOwnTitle: "Wählen ihren Empfänger selbst",
    rtOwn1: ["Magic Push", "je Meldung eines Geräts"],
    rtOwn2: ["Routinen", "je Routine, sonst das Ziel des Reiters Routinen"],
  },
  en: {
    lvTitle: "Set it once, override where needed",
    lvSub: "Every setting has three levels. The more specific one wins: device before integration before general.",
    levels: [
      { n: "1", name: "General", where: "Settings › Monitoring and notifications", what: "The default for all devices.", chips: ["Offline after 2 min.", "Battery low from 15 %", "Weak signal below -80 dBm", "Push target"] },
      { n: "2", name: "Integration", where: "Settings › Monitoring and notifications › Integrations", what: "For all devices of one integration, for example Zigbee or Shelly.", chips: ["Offline after 10 min.", "Battery low from 25 %", "No push for this integration"] },
      { n: "3", name: "Device", where: "Device pop-up › Settings", what: "Only this one device.", chips: ["Own time or do not monitor", "Battery low from 30 % or off", "Notifications off or muted for 24 h"] },
    ],
    override: "overrides",
    exTitle: "Example: battery warning",
    exHead: ["Device", "General", "Integration", "Device", "Applies"],
    exRows: [
      ["Weather station (Shelly)", "15 %", "–", "–", "15 %", "General"],
      ["Motion sensor (Zigbee)", "15 %", "25 %", "–", "25 %", "Integration"],
      ["Cellar contact (Zigbee)", "15 %", "25 %", "30 %", "30 %", "Device"],
      ["Remote (Zigbee)", "15 %", "25 %", "Off", "no warning", "Device"],
    ],
    exNote: "Every row in the panel names its origin: device, integration or default.",
    mxTitle: "What can be set where",
    mxHead: ["", "General", "Integration", "Device"],
    mxRows: [
      ["Monitoring and \"Offline after\"", 1, 1, 1],
      ["\"Report only after\"", 1, 0, 0],
      ["Notifications for outage and return (push, persistent)", 1, 1, 1],
      ["Battery warning", 1, 1, 1],
      ["Signal warning", 1, 1, 1],
      ["Report charging", 1, 1, 1],
      ["Report new devices", 1, 1, 0],
      ["Update reminder", 1, 1, 0],
      ["Recipient (push target)", 1, 0, 0],
    ],
    mxNote: "The recipient also has its own target per tab (see the graphic \"Where the notification goes\").",
    flTitle: "From outage to notification",
    flSub: "Example outage: who decides in which step?",
    flSteps: [
      { t: "The device stops reporting", d: "The panel sees it from the entities of the device in Home Assistant.", by: "" },
      { t: "Offline after 2 min.", d: "Then the panel shows the device as offline, with duration and statistics.", by: "Device › Integration › General" },
      { t: "Report only after 2 min.", d: "Only then it is reported. The times run from the start of the outage and are not added.", by: "General" },
      { t: "May it be reported?", d: "Not if the device is set to \"off\" or \"muted\", or the integration has no push.", by: "Device › Integration › General" },
      { t: "Notification goes to the target", d: "From 3 devices at once as one group message with a likely cause. Optionally also persistent in Home Assistant.", by: "Target of the Outage tab" },
      { t: "The device comes back", d: "\"Back online\" with the duration replaces the outage message.", by: "Device › Integration › General" },
    ],
    flBy: "decides",
    flTl: ["Device gone", "Offline after: offline in the panel", "Report only after: push arrives", "Back: online again"],
    rtTitle: "Where the notification goes",
    rtSub: "One push target for everything, an own one per tab if needed. Magic Push and routines choose themselves.",
    rtGlobal: "Push target", rtGlobalSub: "Settings › Monitoring and notifications › Overview", rtGlobalEx: "e.g. notify.mobile_app_iphone",
    rtTabs: [["Outage", ""], ["Battery", "own target"], ["Charging", ""], ["New", ""], ["Updates", ""], ["Routines", "own target"]],
    rtFollow: "follows the push target", rtOwn: "own target",
    rtOwnTitle: "Choose their recipient themselves",
    rtOwn1: ["Magic Push", "per message of a device"],
    rtOwn2: ["Routines", "per routine, otherwise the target of the Routines tab"],
  },
};

const CSS = `
* { box-sizing: border-box; }
body { margin: 0; width: 1200px; padding: 36px 40px 40px; background: #f4f6f9; color: #212121; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
h1 { margin: 0; font-size: 30px; font-weight: 700; letter-spacing: -0.01em; }
.sub { margin: 6px 0 24px; font-size: 16px; color: #5f6b76; }
.card { background: #fff; border-radius: 16px; box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 4px 14px rgba(0,0,0,.05); }
.lv { display: grid; grid-template-columns: 1fr 104px 1fr 104px 1fr; align-items: stretch; }
.lvc { padding: 20px 22px 22px; border-top: 6px solid var(--c); }
.lvc .no { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: var(--c); color: #fff; font-weight: 700; font-size: 16px; margin-right: 10px; }
.lvc h2 { display: flex; align-items: center; margin: 0 0 4px; font-size: 22px; }
.lvc .where { font-size: 13px; color: #5f6b76; margin-bottom: 10px; }
.lvc .what { font-size: 15px; margin-bottom: 14px; line-height: 1.35; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { padding: 5px 11px; border-radius: 999px; font-size: 13px; background: color-mix(in srgb, var(--c) 12%, #fff); border: 1px solid color-mix(in srgb, var(--c) 40%, #fff); color: #222; }
.arrow { display: flex; flex-direction: column; align-items: center; justify-content: center; color: #5f6b76; font-size: 12px; gap: 2px; text-align: center; }
.arrow svg { width: 48px; height: 22px; }
.sec { margin-top: 26px; }
.sec h3 { margin: 0 0 10px; font-size: 18px; }
table { width: 100%; border-collapse: collapse; font-size: 15px; }
th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #e5e8ec; }
th { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #5f6b76; font-weight: 600; }
tr:last-child td { border-bottom: 0; }
td.c, th.c { text-align: center; }
.pill { display: inline-block; white-space: nowrap; padding: 3px 12px; border-radius: 999px; font-weight: 600; font-size: 14px; color: #fff; background: var(--c); }
.dim { color: #9aa5b0; }
.win { font-weight: 700; }
.cell-win { background: color-mix(in srgb, var(--c) 14%, #fff); font-weight: 700; border-radius: 8px; }
.note { margin: 10px 4px 0; font-size: 13px; color: #5f6b76; }
.yes { color: #2e9d57; font-weight: 700; font-size: 18px; }
.no0 { color: #c3cad1; font-size: 18px; }
.two { display: grid; grid-template-columns: 1.15fr 1fr; gap: 24px; align-items: start; }
.flow { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0; position: relative; }
.st { padding: 0 8px; position: relative; }
.st .dot { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; background: #03a9f4; color: #fff; font-weight: 700; font-size: 17px; margin-bottom: 12px; position: relative; z-index: 1; }
.st .bar { position: absolute; top: 18px; left: 46px; right: -8px; height: 3px; background: #b3e5fc; }
.st:last-child .bar { display: none; }
.st h4 { margin: 0 0 6px; font-size: 16px; line-height: 1.25; }
.st p { margin: 0 0 10px; font-size: 13.5px; line-height: 1.4; color: #3c4750; }
.by { display: inline-block; font-size: 12px; padding: 3px 9px; border-radius: 8px; background: #eef2f6; color: #3c4750; }
.by b { color: #03a9f4; font-weight: 700; }
.tl { margin-top: 26px; padding: 22px 26px 18px; }
.tlbar { position: relative; height: 10px; border-radius: 5px; background: linear-gradient(90deg, #cfd8dc 0 15%, #ef9a9a 15% 45%, #d32f2f 45% 85%, #a5d6a7 85% 100%); margin: 64px 60px 12px; }
.tlm { position: absolute; top: -34px; transform: translateX(-50%); font-size: 13px; text-align: center; white-space: nowrap; font-weight: 600; }
.tlm::after { content: ""; position: absolute; left: 50%; top: 22px; width: 2px; height: 20px; background: #263238; }
.tlm.hi { top: -62px; }
.tlm.hi::after { height: 48px; }
.tlm.hi i { top: 68px; }
.tlm i { position: absolute; left: 50%; top: 40px; width: 14px; height: 14px; border-radius: 50%; border: 3px solid #263238; background: #fff; transform: translateX(-50%); }
.rt { display: grid; grid-template-columns: 1fr 1.6fr; gap: 28px; align-items: center; }
.rg { padding: 22px 24px; border-top: 6px solid #03a9f4; }
.rg h2 { margin: 0 0 6px; font-size: 22px; }
.rg p { margin: 0 0 8px; font-size: 14px; color: #5f6b76; }
.rg code { display: inline-block; padding: 4px 10px; border-radius: 8px; background: #eef2f6; font-family: ui-monospace, Menlo, monospace; font-size: 13px; }
.tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.tab { padding: 14px 16px; border-radius: 12px; background: #fff; border: 2px solid #cfe9f7; font-size: 16px; font-weight: 600; }
.tab small { display: block; margin-top: 4px; font-weight: 400; font-size: 12.5px; color: #5f6b76; }
.tab.own { border-color: #f59e0b; background: #fff8e8; }
.tab.own small { color: #b26a00; font-weight: 600; }
.own2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
.own2 .tab { border-color: #b39ddb; background: #f5f0ff; }
.hd { font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: #5f6b76; margin: 16px 0 8px; font-weight: 600; }
`;

const COL = ["#607d8b", "#03a9f4", "#f59e0b"];
const arrow = (label) => `<div class="arrow"><svg viewBox="0 0 48 22"><path d="M2 11h38M32 3l9 8-9 8" fill="none" stroke="#9aa5b0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>${label}</div>`;

function levels(T) {
  const cards = T.levels.map((l, i) => `<div class="card lvc" style="--c:${COL[i]}"><h2><span class="no">${l.n}</span>${l.name}</h2><div class="where">${l.where}</div><div class="what">${l.what}</div><div class="chips">${l.chips.map((c) => `<span class="chip">${c}</span>`).join("")}</div></div>`);
  const ex = T.exRows.map((r) => {
    const idx = [T.levels[0].name, T.levels[1].name, T.levels[2].name].indexOf(r[5]);
    const cells = [r[1], r[2], r[3]].map((v, k) => `<td class="c ${v === "–" ? "dim" : ""} ${k === idx ? "cell-win" : ""}" style="--c:${COL[k]}">${v}</td>`).join("");
    return `<tr><td>${r[0]}</td>${cells}<td class="c"><span class="pill" style="--c:${COL[idx]}">${r[4]}</span></td></tr>`;
  }).join("");
  const mx = T.mxRows.map((r) => `<tr><td>${r[0]}</td>${[1, 2, 3].map((k) => `<td class="c">${r[k] ? '<span class="yes">✓</span>' : '<span class="no0">–</span>'}</td>`).join("")}</tr>`).join("");
  return `<h1>${T.lvTitle}</h1><p class="sub">${T.lvSub}</p>
  <div class="lv">${cards[0]}${arrow(T.override)}${cards[1]}${arrow(T.override)}${cards[2]}</div>
  <div class="two sec"><div><h3>${T.exTitle}</h3><div class="card"><table><tr>${T.exHead.map((h, i) => `<th class="${i ? "c" : ""}">${h}</th>`).join("")}</tr>${ex}</table></div><p class="note">${T.exNote}</p></div>
  <div><h3>${T.mxTitle}</h3><div class="card"><table><tr>${T.mxHead.map((h, i) => `<th class="${i ? "c" : ""}">${h}</th>`).join("")}</tr>${mx}</table></div><p class="note">${T.mxNote}</p></div></div>`;
}

function flow(T) {
  const steps = T.flSteps.map((s, i) => `<div class="st"><div class="dot">${i + 1}</div><div class="bar"></div><h4>${s.t}</h4><p>${s.d}</p>${s.by ? `<span class="by"><b>${T.flBy}:</b> ${s.by}</span>` : ""}</div>`).join("");
  const tl = T.flTl.map((x, i) => `<div class="tlm${i % 2 ? " hi" : ""}" style="left:${[1, 15, 45, 85][i]}%">${x}<i></i></div>`).join("");
  return `<h1>${T.flTitle}</h1><p class="sub">${T.flSub}</p><div class="card" style="padding:26px 18px 22px"><div class="flow">${steps}</div></div>
  <div class="card tl"><div class="tlbar">${tl}</div></div>`;
}

function routes(T) {
  const tabs = T.rtTabs.map(([n, o]) => `<div class="tab${o ? " own" : ""}">${n}<small>${o || T.rtFollow}</small></div>`).join("");
  return `<h1>${T.rtTitle}</h1><p class="sub">${T.rtSub}</p>
  <div class="rt"><div class="card rg"><h2>${T.rtGlobal}</h2><p>${T.rtGlobalSub}</p><code>${T.rtGlobalEx}</code></div>
  <div><div class="tabs">${tabs}</div><div class="hd">${T.rtOwnTitle}</div><div class="own2"><div class="tab">${T.rtOwn1[0]}<small>${T.rtOwn1[1]}</small></div><div class="tab">${T.rtOwn2[0]}<small>${T.rtOwn2[1]}</small></div></div></div></div>`;
}

const b = await chromium.launch(launch);
for (const lang of Object.keys(TEXT)) {
  mkdirSync(`${out}${lang}`, { recursive: true });
  for (const [name, html] of [["notification-levels", levels], ["notification-flow", flow], ["notification-targets", routes]]) {
    const p = await b.newPage({ viewport: { width: 1200, height: 100 }, deviceScaleFactor: 2 });
    await p.setContent(`<!doctype html><meta charset="utf-8"><style>${CSS}</style><body>${html(TEXT[lang])}</body>`);
    await p.screenshot({ path: `${out}${lang}/${name}.png`, fullPage: true });
    await p.close();
  }
}
await b.close();
console.log("fertig", out);
