// Mockups magic-overview-v1 (Wunsch des Nutzers, 2026-10-11): die Übersicht "Magic Push" in den Einstellungen braucht mehr
// Struktur (was gehört zusammen) und ein Suchfeld, wie es die langen Listen der Einstellungen haben (Suchfeld A, 1.28.0).
// Alles im echten Panel (Nachbau, erfundene Daten): Einstellungen, Überwachung und Meldungen, Reiter "Magic Push".
//   A: Gerätekarten: pro Gerät eine Karte mit Kopf (Symbol, Name, Bereich · Integration, Zahl), die Meldungen darin
//   B: wie A, aber einklappbar (Kopf mit Pfeil und Kurzfassung); Suche klappt die Treffer auf  <- Empfehlung
//   C: Gruppierte Liste: Gerät als kleine Überschrift über einer Gruppe, Meldungen als Zeilen darin
// Alle: Suchfeld mit "n von m", darunter Filter Alle / An / Aus / Ausgelöst.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/magic-overview-v1/src/render.mjs
import { setup, svg } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8991, import.meta.url);

const CSS = `
.mv-intro { margin: 0 0 4px; color: var(--dp-text2); font-size: 12.5px; line-height: 1.4; }
.mv-seg { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 2px; padding: 3px; border-radius: 12px; background: color-mix(in srgb, var(--dp-text) 7%, var(--dp-card)); margin: 2px 0 8px; }
.mv-seg span { display: grid; place-items: center; height: 36px; border-radius: 9px; color: color-mix(in srgb, var(--dp-text) 72%, transparent); font-size: 13px; text-align: center; white-space: nowrap; }
.mv-seg span.on { background: var(--dp-bg); color: var(--dp-primary); font-weight: 500; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dp-text) 7%, transparent); }
.mv-seg small { margin-left: 4px; color: var(--dp-text2); font-size: 11.5px; font-weight: 400; }
.mv-count { display: flex; justify-content: space-between; align-items: center; margin: 2px 2px 8px; color: var(--dp-text2); font-size: 12.5px; }
.mv-count a { color: var(--dp-primary); }
.mv-ic { flex: none; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: var(--dp-primary-soft); font-size: 17px; }
.mv-devic { flex: none; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: var(--dp-subtle); color: var(--dp-text2); }
.mv-devic.off { background: var(--dp-error-soft); color: var(--dp-error); }
.mv-t { flex: 1; min-width: 0; }
.mv-t b { display: block; font-size: 14.5px; font-weight: 600; }
.mv-t small { display: block; margin-top: 2px; color: var(--dp-text2); font-size: 12.5px; line-height: 1.35; }
.mv-t small.st { margin-top: 3px; }
.mv-t .on { color: var(--dp-primary); font-weight: 500; }
.mv-t .warn { color: var(--dp-warning); font-weight: 500; }
.mv-t .free { color: var(--dp-text3, var(--dp-text2)); }
.mv-sw { flex: none; width: 46px; height: 28px; border-radius: 99px; background: var(--dp-primary); position: relative; }
.mv-sw::after { content: ""; position: absolute; top: 3px; right: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; }
.mv-sw.off { background: color-mix(in srgb, var(--dp-text) 25%, transparent); }
.mv-sw.off::after { right: auto; left: 3px; }
.mv-acts { display: flex; gap: 18px; margin: 8px 0 0 46px; font-size: 13px; color: var(--dp-primary); }
.mv-acts .del { color: var(--dp-error); }
.mv-badge { flex: none; min-width: 22px; height: 22px; padding: 0 7px; box-sizing: border-box; display: grid; place-items: center; border-radius: 99px; background: var(--dp-primary-soft); color: var(--dp-primary); font-size: 12px; font-weight: 600; }
.mv-offtag { flex: none; padding: 1px 8px; border-radius: 99px; background: var(--dp-error-soft); color: var(--dp-error); font-size: 11.5px; font-weight: 500; }
.mv-chev { flex: none; color: var(--dp-text2); display: grid; place-items: center; }

/* A, B: Gerätekarte */
.mv-card { margin-top: 10px; border-radius: 16px; background: var(--dp-subtle); overflow: hidden; }
.mv-head { display: flex; align-items: center; gap: 10px; padding: 11px 12px; background: color-mix(in srgb, var(--dp-text) 5%, var(--dp-subtle)); }
.mv-head .mv-t b { font-size: 15px; }
.mv-row { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px 12px 12px; border-top: 1px solid var(--dp-divider); position: relative; }
.mv-row::before { content: ""; position: absolute; left: 29px; top: 0; bottom: 0; width: 0; }
.mv-row.off { opacity: .7; }
.mv-row .mv-sw { margin-top: 2px; }
.mv-card.closed .mv-row { display: none; }
.mv-sum { margin-top: 2px; color: var(--dp-text2); font-size: 12.5px; }
.mv-sum .on { color: var(--dp-primary); font-weight: 500; }
.mv-sum .warn { color: var(--dp-warning); font-weight: 500; }

/* C: gruppierte Liste */
.mv-sec { margin: 16px 4px 6px; display: flex; align-items: center; gap: 8px; color: var(--dp-text2); font-size: 12px; letter-spacing: .03em; text-transform: uppercase; }
.mv-sec b { color: var(--dp-text); font-weight: 600; letter-spacing: 0; text-transform: none; font-size: 13.5px; }
.mv-sec .grow { flex: 1; }
.mv-grp { border-radius: 14px; background: var(--dp-subtle); overflow: hidden; }
.mv-grp .mv-row:first-child { border-top: 0; }
.mv-note { margin: 10px 2px 0; color: var(--dp-text2); font-size: 12.5px; }
`;

const logo = "";
const icon = (kind) => ({ sensor: svg("pulse", 16), win: svg("home", 16), plug: svg("pulse", 16) })[kind] || svg("pulse", 16);
// erfundene Daten
const DEVICES = [
  { name: "Klimasensor Keller", sub: "Keller · Zigbee", ic: "sensor", rules: [
    { e: "🌡️", n: "Keller kalt", s: "Temperatur unter 12 °C · für 10 Min. · einmal · mit \"wieder normal\" · zurück ab 14 °C · an Familie", st: "noch nie ausgelöst", on: true },
    { e: "💧", n: "Feuchte hoch", s: "Absolute Feuchte über 10 g/m³ · für 30 Min. · alle 6 Std. · kritisch (Lautstärke 7)", st: "zuletzt vor 2 Tagen", free: "sensor.abs_humidity", on: true },
  ] },
  { name: "Heizkörper Wohnzimmer", sub: "Wohnzimmer · Shelly", ic: "sensor", rules: [
    { e: "🌡️", n: "Zu warm", s: "Temperatur über 26 °C · für 1 Std. · einmal · an Dani iPhone", st: "ausgelöst, seit 12 Min.", fired: true, on: true },
  ] },
  { name: "Steckdose Terrasse", sub: "Terrasse · Shelly", ic: "plug", offline: true, rules: [
    { e: "⚡", n: "Leistung hoch", s: "Leistung über 2000 W · für 5 Min. · alle 1 Std. · kritisch (Lautstärke 3)", st: "nicht erreichbar · zuletzt vor 3 Tagen", warn: true, on: true },
    { e: "🔌", n: "Ausgeschaltet", s: "Schalter ist aus · für 2 Std. · einmal", st: "aus · noch nie ausgelöst", on: false },
  ] },
  { name: "Fenster Bad", sub: "Bad · Zigbee", ic: "win", rules: [
    { e: "🪟", n: "Fenster offen", s: "Fenster ist offen · für 45 Min. · einmal · mit \"wieder normal\"", st: "aus · noch nie ausgelöst", on: false },
  ] },
  { name: "Bewegungsmelder Keller", sub: "Keller · Zigbee", ic: "sensor", rules: [
    { e: "🚶", n: "Bewegung nachts", s: "Bewegung ist Bewegung · sofort · alle 30 Min.", st: "zuletzt vor 5 Std.", on: true },
  ] },
];
const total = DEVICES.reduce((n, d) => n + d.rules.length, 0);
const search = (q = "", n = "") => `<label class="list-search">${svg("search", 18)}<input type="search" value="${q}" placeholder="Suchen …"><span class="n">${n}</span></label>`;
const seg = (on, counts) => `<div class="mv-seg">${["Alle", "An", "Aus", "Ausgelöst"].map((l, i) => `<span class="${l === on ? "on" : ""}">${l}<small>${counts[i]}</small></span>`).join("")}</div>`;
const sw = (on) => `<span class="mv-sw${on ? "" : " off"}"></span>`;
const statusHtml = (r) => `<small class="st">${r.fired ? `<span class="on">${r.st}</span>` : r.warn ? `<span class="warn">${r.st.split(" · ")[0]}</span> · ${r.st.split(" · ").slice(1).join(" · ")}` : r.st}${r.free ? ` · <span class="free">${r.free}</span>` : ""}</small>`;
const rowHtml = (r, { acts = true } = {}) => `<div class="mv-row${r.on ? "" : " off"}"><span class="mv-ic">${r.e}</span><div class="mv-t"><b>${r.n}</b><small>${r.s}</small>${statusHtml(r)}${acts ? `<div class="mv-acts" style="margin-left:0"><span>Bearbeiten</span><span class="del">Löschen</span></div>` : ""}</div>${sw(r.on)}</div>`;
const chev = (open) => `<span class="mv-chev">${svg(open ? "chevDown" : "chevron", 20)}</span>`;
const devHead = (d, { collapsible = false, open = true } = {}) => {
  const on = d.rules.filter((r) => r.on).length, fired = d.rules.filter((r) => r.fired).length;
  const sum = collapsible && !open ? `<div class="mv-sum">${d.rules.length} ${d.rules.length === 1 ? "Meldung" : "Meldungen"}${on < d.rules.length ? ` · ${d.rules.length - on} aus` : ""}${fired ? ` · <span class="on">${fired} ausgelöst</span>` : ""}${d.offline ? ' · <span class="warn">nicht erreichbar</span>' : ""}</div>` : `<small>${d.sub}</small>`;
  return `<div class="mv-head"><span class="mv-devic${d.offline ? " off" : ""}">${icon(d.ic)}</span><div class="mv-t"><b>${d.name}</b>${sum}</div>${d.offline && !(collapsible && !open) ? '<span class="mv-offtag">Offline</span>' : ""}<span class="mv-badge">${d.rules.length}</span>${collapsible ? chev(open) : ""}</div>`;
};
const counts = [total, DEVICES.flatMap((d) => d.rules).filter((r) => r.on).length, DEVICES.flatMap((d) => d.rules).filter((r) => !r.on).length, DEVICES.flatMap((d) => d.rules).filter((r) => r.fired).length];
const intro = `<p class="mv-intro">Alle Meldungen von Magic Push, nach Gerät. Neue legst du im Popup des Geräts an, im Reiter Magic Push.</p>`;
const top = (q = "", n = "") => `${intro}${search(q, n)}${seg("Alle", counts)}`;

const VAR = {
  A: () => `${top()}${DEVICES.map((d) => `<div class="mv-card">${devHead(d)}${d.rules.map((r) => rowHtml(r)).join("")}</div>`).join("")}`,
  B: () => `${top()}<div class="mv-count"><span>${total} Meldungen auf ${DEVICES.length} Geräten</span><a>Alle einklappen</a></div>${DEVICES.map((d, i) => {
    const open = i === 0 || i === 2;
    return `<div class="mv-card${open ? "" : " closed"}">${devHead(d, { collapsible: true, open })}${d.rules.map((r) => rowHtml(r)).join("")}</div>`;
  }).join("")}`,
  C: () => `${top()}${DEVICES.map((d) => `<div class="mv-sec"><b>${d.name}</b><span>${d.sub}</span>${d.offline ? '<span class="mv-offtag">Offline</span>' : ""}<span class="grow"></span><span class="mv-badge">${d.rules.length}</span></div><div class="mv-grp">${d.rules.map((r) => rowHtml(r)).join("")}</div>`).join("")}`,
  // Suche "kritisch" bei B: Treffer klappen auf
  Bsearch: () => {
    const hit = DEVICES.map((d) => ({ ...d, rules: d.rules.filter((r) => /kritisch/i.test(r.s)) })).filter((d) => d.rules.length);
    const n = hit.reduce((a, d) => a + d.rules.length, 0);
    return `${intro}${search("kritisch", `${n} von ${total}`)}${seg("Alle", counts)}<div class="mv-count"><span>${n} Meldungen auf ${hit.length} Geräten</span><a>Alle einklappen</a></div>${hit.map((d) => `<div class="mv-card">${devHead(d, { collapsible: true, open: true })}${d.rules.map((r) => rowHtml(r)).join("")}</div>`).join("")}`;
  },
  Bnone: () => `${intro}${search("garage", `0 von ${total}`)}${seg("Alle", counts)}<p class="mv-note">Keine Treffer.</p>`,
};

async function shot1(name, html, mobile) {
  const { ctx, p, ev } = await page(mobile, { css: CSS, width: 390, height: mobile ? 1250 : 900, freeze: false, lang: "de" });
  await ev(`r.querySelector(".gear-btn").click()`); await p.waitForTimeout(500);
  await ev(`r.querySelector('[data-set="section"][data-id="monitor"]').click()`); await p.waitForTimeout(400);
  await ev(`r.host._fetch = () => {}`);
  await ev(`const t = r.querySelector('dialog.settings [data-set="tab"][data-key="magic"]'); if (t) t.click();`); await p.waitForTimeout(500);
  await ev(`r.host._renderSettings = () => {}; r.host._loadMagicAll = () => {};
    const b = r.querySelector("dialog.settings .mon-body"); b.innerHTML = arg;
    const d = r.querySelector("dialog.settings"); d.scrollTop = r.querySelector("dialog.settings .mon-tabs").offsetTop - 90;`, html);
  const f = await shot(p, mobile, name);
  await ctx.close();
  return f;
}
const out = new URL("../src/out/", import.meta.url).pathname;
const f = {};
for (const k of ["A", "B", "C", "Bsearch"]) f[k] = await shot1(`m-${k}`, VAR[k](), true);
f.Bnone = await shot1("m-Bnone", VAR.Bnone(), true);
f.dB = await shot1("d-B", VAR.B(), false);
f.dC = await shot1("d-C", VAR.C(), false);

await compose("1-Varianten-Handy.png", [[f.A, "A: Gerätekarten, immer offen", 330], [f.B, "B: einklappbar, Suche klappt Treffer auf (Empfehlung)", 330], [f.C, "C: gruppierte Liste, Gerät als Überschrift", 330]]);
await compose("2-Suche-Handy.png", [[f.Bsearch, "B: Suche \"kritisch\" (2 von 7), Treffer aufgeklappt", 330], [f.Bnone, "B: Suche ohne Treffer", 330]]);
await compose("3-Desktop.png", [[f.dB, "B auf dem Desktop", 620], [f.dC, "C auf dem Desktop", 620]]);
await close();
console.log("fertig");
