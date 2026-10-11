// Mockups magic-push-v2 (Wunsch des Nutzers, 2026-10-11): neuer Reiter "Magic Push" im Geräte-Popup. Pro Gerät Meldungen nach
// Mass: Entität wählen, Bedingung (über, unter, ist, ändert sich), Dauer, Freitext mit Variablen, immer mit Vorschau.
// Im echten Panel (Nachbau, erfundene Daten): Popup eines Geräts, der vierte Reiter und sein Inhalt sind eingesetzt.
//   A: Satz-Baukasten (Regeln als Sätze, Editor mit Auswahlfeldern in einem Satz)
//   B: Entitäten-Karten (alle Entitäten mit aktuellem Wert; antippen, Vorschlag wählen, fertig)  <- Empfehlung
//   C: Assistent in drei Schritten (Entität, Bedingung mit Diagramm, Text)
// Aufruf: CHROMIUM_PATH=... node docs/mockups/magic-push-v2/src/render.mjs
import { setup, svg } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8988, import.meta.url);

const CSS = `
.mg-note { margin: 0 0 6px; color: var(--dp-text2); font-size: 12.5px; line-height: 1.4; }
.mg-card { margin-top: 8px; padding: 12px 14px; border-radius: 14px; background: var(--dp-subtle); }
.mg-card.sel { box-shadow: inset 0 0 0 1.5px var(--dp-primary); }
.mg-row { display: flex; align-items: center; gap: 12px; }
.mg-ic { flex: none; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; background: var(--dp-primary-soft); font-size: 19px; }
.mg-t { flex: 1; min-width: 0; }
.mg-t b { display: block; font-size: 14px; font-weight: 600; }
.mg-t small { display: block; margin-top: 2px; color: var(--dp-text2); font-size: 12.5px; line-height: 1.35; }
.mg-val { text-align: right; font-size: 17px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
.mg-val small { display: block; color: var(--dp-text2); font-size: 11.5px; font-weight: 400; }
.mg-add { display: flex; align-items: center; justify-content: center; gap: 8px; height: 46px; margin-top: 12px; border: 1.5px dashed color-mix(in srgb, var(--dp-primary) 55%, transparent); border-radius: 14px; color: var(--dp-primary); font-size: 14px; font-weight: 500; }
.mg-sw { flex: none; width: 46px; height: 28px; border-radius: 99px; background: var(--dp-primary); position: relative; }
.mg-sw::after { content: ""; position: absolute; top: 3px; right: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; }
.mg-sw.off { background: color-mix(in srgb, var(--dp-text) 25%, transparent); }
.mg-sw.off::after { right: auto; left: 3px; }
.mg-pills { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 8px 0; }
.mg-w { color: var(--dp-text2); font-size: 14px; }
.mg-pill { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 13px; border: 1px solid var(--dp-divider); border-radius: 99px; background: var(--dp-input); font-size: 14px; }
.mg-pill.on { border-color: var(--dp-primary); box-shadow: inset 0 0 0 1px var(--dp-primary); color: var(--dp-primary); }
.mg-pill.num { min-width: 70px; justify-content: center; font-variant-numeric: tabular-nums; font-weight: 600; }
.mg-seg { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 2px; padding: 3px; border-radius: 12px; background: color-mix(in srgb, var(--dp-text) 7%, var(--dp-card)); margin: 6px 0; }
.mg-seg span { display: grid; place-items: center; height: 36px; border-radius: 9px; color: color-mix(in srgb, var(--dp-text) 72%, transparent); font-size: 13px; text-align: center; }
.mg-seg span.on { background: var(--dp-bg); color: var(--dp-primary); font-weight: 500; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dp-text) 7%, transparent); }
.mg-k { margin: 12px 0 4px; color: var(--dp-text2); font-size: 12px; }
.mg-msg { padding: 10px 12px; border: 1px solid var(--dp-divider); border-radius: 12px; background: var(--dp-input); font-size: 14px; line-height: 1.5; }
.mg-var { display: inline-block; padding: 0 7px; border-radius: 7px; background: var(--dp-primary-soft); color: var(--dp-primary); font-size: 13px; }
.mg-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 0; }
.mg-chips span { padding: 5px 10px; border: 1px solid var(--dp-divider); border-radius: 99px; color: var(--dp-text2); font-size: 12.5px; }
.mg-chips span.sug { border-color: color-mix(in srgb, var(--dp-primary) 45%, transparent); color: var(--dp-primary); background: var(--dp-primary-soft); }
.mg-chips span.on { border-color: var(--dp-primary); box-shadow: inset 0 0 0 1px var(--dp-primary); color: var(--dp-primary); }
.mg-btns { display: flex; gap: 8px; margin-top: 14px; }
.mg-btn { display: grid; place-items: center; flex: 1; height: 42px; border: 1px solid var(--dp-divider); border-radius: 99px; font-size: 14px; }
.mg-btn.p { border-color: var(--dp-primary); background: var(--dp-primary); color: #fff; font-weight: 500; }
.mg-track { position: relative; height: 34px; margin: 10px 4px 2px; }
.mg-track::before { content: ""; position: absolute; left: 0; right: 0; top: 15px; height: 4px; border-radius: 2px; background: color-mix(in srgb, var(--dp-text) 14%, transparent); }
.mg-track i { position: absolute; top: 9px; width: 2px; height: 16px; background: var(--dp-text2); }
.mg-track em { position: absolute; top: 4px; width: 26px; height: 26px; margin-left: -13px; border: 3px solid var(--dp-primary); border-radius: 50%; background: var(--dp-bg); }
.mg-track .zone { position: absolute; top: 15px; height: 4px; border-radius: 2px; background: var(--dp-primary); }
.mg-scale { display: flex; justify-content: space-between; margin: 0 4px; color: var(--dp-text2); font-size: 11.5px; }
.mg-steps { display: flex; gap: 6px; margin: 4px 0 12px; }
.mg-steps span { flex: 1; height: 4px; border-radius: 2px; background: color-mix(in srgb, var(--dp-text) 14%, transparent); }
.mg-steps span.on { background: var(--dp-primary); }
.mg-stephead { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; color: var(--dp-text2); }
.mg-big { margin: 4px 0 8px; font-size: 20px; font-weight: 600; }
.mg-spark { display: block; width: 100%; height: 70px; margin-top: 6px; }
.mg-radio { flex: none; width: 22px; height: 22px; border: 2px solid var(--dp-divider); border-radius: 50%; }
.mg-radio.on { border: 7px solid var(--dp-primary); }
.mg-chip-n { display: inline-block; margin-left: 6px; padding: 1px 8px; border-radius: 99px; background: var(--dp-primary-soft); color: var(--dp-primary); font-size: 11.5px; font-weight: 600; }
.mg-test { margin-top: 8px; color: var(--dp-primary); font-size: 13px; font-weight: 500; }
`;

// Vorschau der Meldung wie in den Einstellungen (Karte), mit eingesetzten Werten
const logo = `<svg width="16" height="16" viewBox="0 0 24 24" style="color:var(--dp-primary)"><path fill="currentColor" d="M3,13H5.79L10.1,4.79L11.28,13.75L14.5,9.66L17.83,13H21V15H17L14.67,12.67L10.72,17.71L9.84,11.25L7.21,16H3V13Z"/></svg>`;
const preview = (title, text, note = "Vorschau mit dem aktuellen Wert; so kommt die Meldung an.") => `<div class="pv"><div class="pv-k">Vorschau</div><div class="pv-card"><div class="pv-app">${logo}Home Assistant · jetzt</div>
  <div class="pv-title">${title}</div><div class="pv-text">${text}</div></div><div class="opt-short">${note}</div></div>`;
const v = (x) => `<span class="mg-var">${x}</span>`;
const sw = (off) => `<span class="mg-sw${off ? " off" : ""}"></span>`;
const ENT = [
  ["🌡️", "Temperatur", "14,2 °C", "Sensor"],
  ["💧", "Luftfeuchtigkeit", "71 %", "Sensor"],
  ["🪟", "Fenster", "Geschlossen", "Kontakt"],
  ["🔋", "Batterie", "86 %", "Diagnose"],
  ["📶", "Signal", "-72 dBm", "Diagnose"],
];
const spark = (pts, line) => {
  const w = 320, h = 70, max = Math.max(...pts), min = Math.min(...pts, line ?? Infinity);
  const x = (i) => (i / (pts.length - 1)) * w, y = (n) => h - 8 - ((n - min) / (max - min || 1)) * (h - 16);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join("");
  return `<svg class="mg-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="var(--dp-primary)" stroke-width="2"/>${line != null ? `<line x1="0" x2="${w}" y1="${y(line)}" y2="${y(line)}" stroke="var(--dp-error)" stroke-width="1.5" stroke-dasharray="5 4"/>` : ""}</svg>`;
};
const T = [15.8, 15.5, 15.1, 14.9, 14.7, 14.4, 14.2, 14.3, 14.0, 13.6, 13.3, 12.9, 13.1, 13.4, 13.8, 14.1, 14.2];

const tabs = (n) => `<div class="sub-tabs" role="tablist">${["Übersicht", "Einstellungen", "Entitäten · 5"].map((l) => `<button class="sub-tab" role="tab">${l}</button>`).join("")}<button class="sub-tab two on" role="tab"><span class="tab-l">Magic Push</span> <span class="tab-s">${n}</span></button></div>`;

const intro = `<p class="mg-note">Eine Meldung, wenn ein Wert dieses Geräts über- oder unterschritten wird oder sich ändert. Sie geht an das Push-Ziel unter Einstellungen › Überwachung.</p>`;


const CSS2 = CSS + `
.mg-sel { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 42px; padding: 0 12px; border: 1px solid var(--dp-divider); border-radius: 12px; background: var(--dp-input); font-size: 13.5px; }
.mg-sel small { display: block; color: var(--dp-text2); font-size: 11.5px; }
.mg-own { display: flex; align-items: center; gap: 8px; margin-top: 8px; color: var(--dp-text2); font-size: 13px; }
.mg-own .mg-pill { height: 34px; }
.mg-own .mg-pill.on { color: var(--dp-text); }
.mg-hist { margin-top: 8px; padding: 10px 12px; border-radius: 12px; background: var(--dp-subtle); font-size: 13px; line-height: 1.45; }
.mg-hist b { font-weight: 600; }
.mg-hist small { display: block; margin-top: 3px; color: var(--dp-text2); font-size: 12px; }
.mg-bar { position: relative; height: 22px; margin: 8px 0 2px; border-radius: 6px; background: color-mix(in srgb, var(--dp-text) 10%, transparent); overflow: hidden; }
.mg-bar span { position: absolute; top: 0; bottom: 0; background: var(--dp-error); opacity: .85; }
.mg-opt { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px solid var(--dp-divider); font-size: 14px; }
.mg-opt small { display: block; margin-top: 2px; color: var(--dp-text2); font-size: 12px; line-height: 1.35; }
.mg-list { margin-top: 6px; border: 1px solid var(--dp-divider); border-radius: 12px; overflow: hidden; background: var(--dp-card); }
.mg-list div { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--dp-divider); font-size: 13.5px; }
.mg-list div:first-child { border-top: none; }
.mg-list div.hd { padding: 6px 12px; background: var(--dp-subtle); color: var(--dp-text2); font-size: 11.5px; letter-spacing: .03em; }
.mg-list div.on { color: var(--dp-primary); font-weight: 500; }
.mg-list small { color: var(--dp-text2); font-size: 11.5px; }
.mg-hint { margin: 6px 0 0; color: var(--dp-text2); font-size: 12px; line-height: 1.4; }
.mg-sw.sm { width: 40px; height: 24px; }
.mg-sw.sm::after { width: 18px; height: 18px; }
`;
const own = (txt, on) => `<div class="mg-own">oder eigene Zeit <span class="mg-pill num${on ? " on" : ""}">${txt}</span><span class="mg-pill">Min. ▾</span></div>`;
const steps = (n, label, what) => `<div class="mg-stephead"><span>Schritt ${n} von 4</span><span>${what}</span></div><div class="mg-steps">${[1, 2, 3, 4].map((i) => `<span${i <= n ? ' class="on"' : ""}></span>`).join("")}</div><div class="mg-big">${label}</div>`;
const nav = (back, next) => `<div class="mg-btns"><span class="mg-btn">${back}</span><span class="mg-btn p">${next}</span></div>`;
const hist = (txt, sub) => `<div class="mg-hist"><b>Rückblick 24 Std.</b> · ${txt}<small>${sub}</small></div>`;
const numChips = ["{device}", "{area}", "{entity}", "{value}", "{unit}", "{threshold}", "{duration}", "{since}"];
const stateChips = ["{device}", "{area}", "{entity}", "{value}", "{duration}", "{since}", "{time}"];
const chips = (list) => `<div class="mg-chips">${list.map((c) => `<span>${c}</span>`).join("")}</div>`;
const durChips = (on) => `<div class="mg-seg">${["Sofort", "1 Min.", "5 Min.", "10 Min.", "30 Min.", "1 Std."].map((x) => `<span${x === on ? ' class="on"' : ""}>${x}</span>`).join("")}</div>`;

const SCREENS = {
  // Ablauf mit einem Zahlenwert (Temperatur)
  Z: [
    // Z1: Liste der Meldungen
    () => `<h3>Magic Push</h3>${intro}
      <div class="mg-card"><div class="mg-row"><span class="mg-ic">❄️</span><div class="mg-t"><b>Temperatur unter 12 °C</b><small>für 10 Min. · einmal · zuletzt vor 2 Tagen</small></div>${sw()}</div></div>
      <div class="mg-card"><div class="mg-row"><span class="mg-ic">💧</span><div class="mg-t"><b>Luftfeuchtigkeit über 75 %</b><small>für 30 Min. · alle 6 Std. · noch nie ausgelöst</small></div>${sw()}</div></div>
      <div class="mg-card"><div class="mg-row"><span class="mg-ic">🪟</span><div class="mg-t"><b>Fenster ist offen</b><small>für 45 Min. · einmal · mit "wieder normal"</small></div>${sw(true)}</div></div>
      <div class="mg-add">+ Neue Meldung</div>
      <p class="mg-hint">Empfänger: Standard aus den Einstellungen, pro Meldung änderbar.</p>`,
    // Z2: Schritt 1
    () => `<h3>Neue Meldung</h3>${steps(1, "Was soll überwacht werden?", "Wert wählen")}
      ${ENT.map(([ic, n, val, k], i) => `<div class="mg-card${i === 0 ? " sel" : ""}"><div class="mg-row"><span class="mg-ic">${ic}</span><div class="mg-t"><b>${n}</b><small>${k}</small></div><div class="mg-val">${val}</div><span class="mg-radio${i === 0 ? " on" : ""}"></span></div></div>`).join("")}
      ${nav("Abbrechen", "Weiter")}`,
    // Z3: Schritt 2 mit freier Zeit und Rückblick
    () => `<h3>Neue Meldung</h3>${steps(2, "Wann soll gemeldet werden?", "🌡️ Temperatur")}
      <div class="mg-seg"><span>über</span><span class="on">unter</span><span>ist gleich</span><span>ändert sich</span></div>
      <div class="mg-card">${spark(T, 12)}<div class="mg-scale"><span>vor 24 Std.</span><span>Schwelle 12 °C</span><span>jetzt</span></div></div>
      <div class="mg-pills"><span class="mg-pill num">−</span><span class="mg-pill num">12 °C</span><span class="mg-pill num">+</span></div>
      <div class="mg-k">für mindestens</div>${durChips("10 Min.")}${own("–", false)}
      ${hist("wäre <b>1-mal</b> gekommen", "gestern 04:12 · tiefster Wert 11,6 °C · 38 Min. unter 12 °C")}
      ${nav("Zurück", "Weiter")}`,
    // Z4: Schritt 3 Text
    () => `<h3>Neue Meldung</h3>${steps(3, "Was soll in der Meldung stehen?", "Text")}
      <div class="mg-msg">Keller ist kalt: ${v("{value}")} ${v("{unit}")} (unter ${v("{threshold}")})</div>
      <div class="mg-k">Passend zu "Temperatur" (Zahl mit Einheit)</div>${chips(numChips)}
      <p class="mg-hint">{value} zeigt die Zahl wie am Gerät (14,2), {unit} die Einheit (°C), {threshold} deine Schwelle.</p>
      ${preview("Keller ist kalt: 11,8 °C (unter 12 °C)", "Klimasensor Keller · seit 10 Min.")}
      ${nav("Zurück", "Weiter")}`,
    // Z5: Schritt 4 Versand
    () => `<h3>Neue Meldung</h3>${steps(4, "Wohin und wie oft?", "Versand")}
      <div class="mg-k">Empfänger</div><div class="mg-sel"><div>Standard aus den Einstellungen<small>notify.mobile_app_dani_iphone</small></div>▾</div>
      <div class="mg-k">Wiederholen, solange der Wert so bleibt</div>
      <div class="mg-seg"><span class="on">Nur einmal</span><span>30 Min.</span><span>1 Std.</span><span>Täglich</span></div>
      <div class="mg-own">oder alle <span class="mg-pill num">3</span><span class="mg-pill">Std. ▾</span></div>
      <p class="mg-hint">Einmal: erneut erst, wenn der Wert zwischendurch wieder normal war.</p>
      <div class="mg-opt"><div>Auch melden, wenn wieder normal<small>Text: "Keller wieder warm: {value} {unit}"</small></div><span class="mg-sw sm"></span></div>
      ${preview("Keller ist kalt: 11,8 °C (unter 12 °C)", "Klimasensor Keller · seit 10 Min.")}
      ${preview("Keller wieder warm: 12,4 °C", "Klimasensor Keller · nach 38 Min.", 'Vorschau der Meldung "wieder normal".')}
      <div class="mg-test">Test senden</div>
      ${nav("Zurück", "Speichern")}`,
    // Z6: Empfänger-Auswahl offen
    () => `<h3>Neue Meldung</h3>${steps(4, "Wohin und wie oft?", "Versand")}
      <div class="mg-k">Empfänger</div><div class="mg-sel"><div>Standard aus den Einstellungen<small>notify.mobile_app_dani_iphone</small></div>▴</div>
      <div class="mg-list">
        <div class="on"><span>Standard aus den Einstellungen<br><small>notify.mobile_app_dani_iphone</small></span><span>✓</span></div>
        <div class="hd"><span>GRUPPEN</span></div>
        <div><span>Familie<br><small>notify.familie · 3 Empfänger</small></span></div>
        <div><span>Eltern<br><small>notify.eltern · 2 Empfänger</small></span></div>
        <div class="hd"><span>DIENSTE</span></div>
        <div><span>Dani iPhone<br><small>notify.mobile_app_dani_iphone</small></span></div>
        <div><span>Partner iPhone<br><small>notify.mobile_app_partner_iphone</small></span></div>
        <div class="hd"><span>ENTITÄTEN</span></div>
        <div><span>Küchen-Display<br><small>notify.kuechen_display</small></span></div>
      </div>
      <p class="mg-hint">Wie in "Überwachung und Meldungen": Dienste, Gruppen und Entitäten. Ändert sich das Standard-Ziel in den Einstellungen, folgen alle Meldungen mit "Standard".</p>`,
  ],
  // Ablauf mit einem Zustand (Fenster)
  S: [
    // S1: Schritt 1 Auswahl Fenster
    () => `<h3>Neue Meldung</h3>${steps(1, "Was soll überwacht werden?", "Wert wählen")}
      ${ENT.map(([ic, n, val, k], i) => `<div class="mg-card${i === 2 ? " sel" : ""}"><div class="mg-row"><span class="mg-ic">${ic}</span><div class="mg-t"><b>${n}</b><small>${k}</small></div><div class="mg-val">${val}</div><span class="mg-radio${i === 2 ? " on" : ""}"></span></div></div>`).join("")}
      ${nav("Abbrechen", "Weiter")}`,
    // S2: Schritt 2 Zustand, freie Zeit gewählt, Rückblick als Zeitleiste
    () => `<h3>Neue Meldung</h3>${steps(2, "Wann soll gemeldet werden?", "🪟 Fenster")}
      <div class="mg-seg"><span class="on">ist offen</span><span>ist zu</span><span>ändert sich</span></div>
      <div class="mg-card"><div class="mg-k" style="margin-top:0">Letzte 24 Stunden: offen</div><div class="mg-bar"><span style="left:30%;width:1%"></span><span style="left:71%;width:12%"></span></div><div class="mg-scale"><span>vor 24 Std.</span><span>jetzt</span></div></div>
      <div class="mg-k">für mindestens</div>${durChips("")}${own("45", true)}
      ${hist("wäre <b>1-mal</b> gekommen", "gestern 18:05 · 3 Std. 12 Min. offen. Der kurze Moment heute 07:40 (12 Min.) bleibt unter 45 Min.")}
      ${nav("Zurück", "Weiter")}`,
    // S3: Schritt 3 Text mit Zustands-Variablen
    () => `<h3>Neue Meldung</h3>${steps(3, "Was soll in der Meldung stehen?", "Text")}
      <div class="mg-msg">${v("{entity}")} ist seit ${v("{duration}")} ${v("{value}")}</div>
      <div class="mg-k">Passend zu "Fenster" (Zustand)</div>${chips(stateChips)}
      <p class="mg-hint">Ohne {threshold} und {unit}: {value} zeigt hier "offen" oder "zu" (die Wörter der Entität), nicht "on"/"off".</p>
      ${preview("Fenster ist seit 45 Min. offen", "Klimasensor Keller")}
      ${nav("Zurück", "Weiter")}`,
  ],
};

async function shots(variant) {
  const files = [];
  for (const [i, build] of SCREENS[variant].entries()) {
    const { ctx, p, ev } = await page(true, { css: CSS2, width: 390, height: 1250, freeze: false });
    await ev(`r.host._openDevice("h")`); await p.waitForTimeout(600);
    await ev(`r.host._fetch = () => {}`);
    await ev(`const dlg = r.querySelector("dialog.device");
      dlg.querySelector(".dev-tabs").innerHTML = arg.tabs; dlg.querySelector(".dlg-body").innerHTML = arg.body;
      for (const el of dlg.querySelectorAll(".dlg-title *")) if (el.children.length === 0 && el.textContent.trim() === "Stromzähler") el.textContent = "Klimasensor Keller";`, { tabs: tabs("3 aktiv"), body: build() });
    files.push(await shot(p, true, `${variant}-${i + 1}`));
    await ctx.close();
  }
  return files;
}
const caps = {
  Z: ["1 · Magic Push: Liste der Meldungen", "2 · Schritt 1: Wert wählen", "3 · Schritt 2: Wann (freie Zeit, Rückblick)", "4 · Schritt 3: Text, Variablen passend zur Zahl", "5 · Schritt 4: Empfänger, Wiederholung, wieder normal", "6 · Empfänger: Dienste, Gruppen, Entitäten"],
  S: ["7 · Zustand: Fenster wählen", "8 · Schritt 2: ist offen, eigene Zeit, Zeitleiste", "9 · Schritt 3: Variablen passend zum Zustand"],
};
const z = await shots("Z");
await compose("1-Zahl-Teil1.png", z.slice(0, 3).map((f, i) => [f, caps.Z[i], 330]));
await compose("2-Zahl-Teil2.png", z.slice(3).map((f, i) => [f, caps.Z[i + 3], 330]));
const s = await shots("S");
await compose("3-Zustand.png", s.map((f, i) => [f, caps.S[i], 330]));
await close();
console.log("fertig");
