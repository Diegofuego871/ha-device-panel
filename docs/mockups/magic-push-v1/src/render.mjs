// Mockups magic-push-v1 (Wunsch des Nutzers, 2026-10-11): neuer Reiter "Magic Push" im Geräte-Popup. Pro Gerät Meldungen nach
// Mass: Entität wählen, Bedingung (über, unter, ist, ändert sich), Dauer, Freitext mit Variablen, immer mit Vorschau.
// Im echten Panel (Nachbau, erfundene Daten): Popup eines Geräts, der vierte Reiter und sein Inhalt sind eingesetzt.
//   A: Satz-Baukasten (Regeln als Sätze, Editor mit Auswahlfeldern in einem Satz)
//   B: Entitäten-Karten (alle Entitäten mit aktuellem Wert; antippen, Vorschlag wählen, fertig)  <- Empfehlung
//   C: Assistent in drei Schritten (Entität, Bedingung mit Diagramm, Text)
// Aufruf: CHROMIUM_PATH=... node docs/mockups/magic-push-v1/src/render.mjs
import { setup, svg } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8987, import.meta.url);

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

const SCREENS = {
  A: [
    // A1: Regeln als Sätze
    () => `<h3>Meine Meldungen</h3>${intro}
      <div class="mg-card"><div class="mg-row"><span class="mg-ic">❄️</span><div class="mg-t"><b>Temperatur unter 12 °C</b><small>für mindestens 10 Min. · "Keller ist kalt: {value}"</small></div>${sw()}</div></div>
      <div class="mg-card"><div class="mg-row"><span class="mg-ic">💧</span><div class="mg-t"><b>Luftfeuchtigkeit über 75 %</b><small>für mindestens 30 Min. · "Feucht im Keller, bitte lüften"</small></div>${sw()}</div></div>
      <div class="mg-card"><div class="mg-row"><span class="mg-ic">🪟</span><div class="mg-t"><b>Fenster ist offen</b><small>für mindestens 5 Min. · "Kellerfenster offen seit {duration}"</small></div>${sw(true)}</div></div>
      <div class="mg-add">${svg("check", 0)}+ Neue Meldung</div>
      ${preview("❄️ Keller ist kalt: 11,8 °C", "Klimasensor Keller · seit 10 Min. unter 12 °C", "Vorschau der oben gewählten Meldung mit dem jetzigen Wert.")}`,
    // A2: Editor als Satz
    () => `<h3>Neue Meldung</h3>
      <div class="mg-k">Wenn</div><div class="mg-pills"><span class="mg-pill on">🌡️ Temperatur ▾</span></div>
      <div class="mg-pills"><span class="mg-pill">unter ▾</span><span class="mg-pill num">12</span><span class="mg-w">°C</span></div>
      <div class="mg-k">für mindestens</div><div class="mg-pills"><span class="mg-pill">10 Min. ▾</span></div>
      <div class="mg-k">dann melden</div><div class="mg-msg">Keller ist kalt: ${v("{value}")} ${v("{unit}")} · ${v("{device}")}</div>
      <div class="mg-chips"><span>{device}</span><span>{entity}</span><span>{value}</span><span>{unit}</span><span>{threshold}</span><span>{duration}</span><span>{area}</span></div>
      ${preview("Keller ist kalt: 11,8 °C · Klimasensor Keller", "Tippt man auf die Meldung, öffnet sich dieses Gerät.")}
      <div class="mg-test">Test senden</div>
      <div class="mg-btns"><span class="mg-btn">Abbrechen</span><span class="mg-btn p">Speichern</span></div>`,
    // A3: Entität wählen
    () => `<h3>Neue Meldung</h3>
      <div class="mg-k">Wenn</div><div class="mg-pills"><span class="mg-pill on">Entität wählen ▴</span></div>
      ${ENT.map(([ic, n, val, k], i) => `<div class="mg-card${i === 0 ? " sel" : ""}"><div class="mg-row"><span class="mg-ic">${ic}</span><div class="mg-t"><b>${n}</b><small>${k}</small></div><div class="mg-val">${val}<small>jetzt</small></div></div></div>`).join("")}`,
  ],
  B: [
    // B1: alle Entitäten als Karten
    () => `<h3>Meldungen nach Mass</h3><p class="mg-note">Tippe auf einen Wert, bei dem du informiert werden willst.</p>
      <div class="mg-card sel"><div class="mg-row"><span class="mg-ic">🌡️</span><div class="mg-t"><b>Temperatur<span class="mg-chip-n">1 Meldung</span></b><small>unter 12 °C für 10 Min.</small></div><div class="mg-val">14,2 °C<small>jetzt</small></div></div></div>
      <div class="mg-card"><div class="mg-row"><span class="mg-ic">💧</span><div class="mg-t"><b>Luftfeuchtigkeit<span class="mg-chip-n">1 Meldung</span></b><small>über 75 % für 30 Min.</small></div><div class="mg-val">71 %<small>jetzt</small></div></div></div>
      <div class="mg-card"><div class="mg-row"><span class="mg-ic">🪟</span><div class="mg-t"><b>Fenster</b><small>+ Meldung hinzufügen</small></div><div class="mg-val">Zu<small>jetzt</small></div></div></div>
      <div class="mg-card"><div class="mg-row"><span class="mg-ic">🔋</span><div class="mg-t"><b>Batterie</b><small>+ Meldung hinzufügen</small></div><div class="mg-val">86 %<small>jetzt</small></div></div></div>
      <div class="mg-card"><div class="mg-row"><span class="mg-ic">📶</span><div class="mg-t"><b>Signal</b><small>+ Meldung hinzufügen</small></div><div class="mg-val">-72 dBm<small>jetzt</small></div></div></div>`,
    // B2: Karte aufgeklappt, Vorschläge, Schwelle, Dauer, Text
    () => `<h3>Meldungen nach Mass</h3>
      <div class="mg-card sel"><div class="mg-row"><span class="mg-ic">🌡️</span><div class="mg-t"><b>Temperatur</b><small>Neue Meldung</small></div><div class="mg-val">14,2 °C<small>jetzt</small></div></div>
        <div class="mg-k">Vorschläge</div><div class="mg-chips" style="margin-top:0"><span class="sug on">Zu kalt</span><span class="sug">Zu warm</span><span>Ändert sich</span><span>Eigene</span></div>
        <div class="mg-k">Melden, wenn der Wert <b>unter</b> diese Schwelle fällt</div>
        <div class="mg-seg"><span class="on">unter</span><span>über</span></div>
        <div class="mg-track"><span class="zone" style="left:0;width:38%"></span><i style="left:62%"></i><em style="left:38%"></em></div><div class="mg-scale"><span>9 °C</span><span>jetzt 14,2</span><span>22 °C</span></div>
        <div class="mg-pills"><span class="mg-pill num">12</span><span class="mg-w">°C</span></div>
        <div class="mg-k">für mindestens</div><div class="mg-seg"><span>Sofort</span><span>5 Min.</span><span class="on">10 Min.</span><span>30 Min.</span><span>1 Std.</span></div>
        <div class="mg-k">Text der Meldung</div><div class="mg-msg">Keller ist kalt: ${v("{value}")} ${v("{unit}")}</div>
        <div class="mg-chips"><span>{device}</span><span>{value}</span><span>{unit}</span><span>{threshold}</span><span>{duration}</span><span>{area}</span></div>
        ${preview("Keller ist kalt: 11,8 °C", "Klimasensor Keller · seit 10 Min. unter 12 °C")}
        <div class="mg-btns"><span class="mg-btn">Test senden</span><span class="mg-btn p">Speichern</span></div></div>`,
    // B3: Zustand (Fenster)
    () => `<h3>Meldungen nach Mass</h3>
      <div class="mg-card sel"><div class="mg-row"><span class="mg-ic">🪟</span><div class="mg-t"><b>Fenster</b><small>Neue Meldung</small></div><div class="mg-val">Zu<small>jetzt</small></div></div>
        <div class="mg-k">Vorschläge</div><div class="mg-chips" style="margin-top:0"><span class="sug on">Offen gelassen</span><span class="sug">Wird geöffnet</span><span>Eigene</span></div>
        <div class="mg-k">Melden, wenn das Fenster</div><div class="mg-seg"><span class="on">offen ist</span><span>zu ist</span><span>sich ändert</span></div>
        <div class="mg-k">für mindestens</div><div class="mg-seg"><span>Sofort</span><span class="on">5 Min.</span><span>10 Min.</span><span>30 Min.</span><span>1 Std.</span></div>
        <div class="mg-k">Text der Meldung</div><div class="mg-msg">Kellerfenster offen seit ${v("{duration}")}</div>
        <div class="mg-chips"><span>{device}</span><span>{value}</span><span>{duration}</span><span>{since}</span><span>{area}</span></div>
        ${preview("Kellerfenster offen seit 5 Min.", "Klimasensor Keller", 'Vorschau mit dem Beispiel "5 Min."; echte Werte erscheinen bei der Meldung.')}
        <div class="mg-k">Danach</div><div class="mg-seg"><span class="on">Einmal melden</span><span>Alle 30 Min.</span></div>
        <div class="mg-btns"><span class="mg-btn">Test senden</span><span class="mg-btn p">Speichern</span></div></div>`,
  ],
  C: [
    // C1: Schritt 1
    () => `<h3>Neue Meldung</h3><div class="mg-stephead"><span>Schritt 1 von 3</span><span>Wert wählen</span></div><div class="mg-steps"><span class="on"></span><span></span><span></span></div>
      <div class="mg-big">Was soll überwacht werden?</div>
      ${ENT.map(([ic, n, val, k], i) => `<div class="mg-card${i === 0 ? " sel" : ""}"><div class="mg-row"><span class="mg-ic">${ic}</span><div class="mg-t"><b>${n}</b><small>${k}</small></div><div class="mg-val">${val}</div><span class="mg-radio${i === 0 ? " on" : ""}"></span></div></div>`).join("")}
      <div class="mg-btns"><span class="mg-btn">Abbrechen</span><span class="mg-btn p">Weiter</span></div>`,
    // C2: Schritt 2 mit Diagramm
    () => `<h3>Neue Meldung</h3><div class="mg-stephead"><span>Schritt 2 von 3</span><span>🌡️ Temperatur</span></div><div class="mg-steps"><span class="on"></span><span class="on"></span><span></span></div>
      <div class="mg-big">Wann soll gemeldet werden?</div>
      <div class="mg-seg"><span>über</span><span class="on">unter</span><span>ist gleich</span><span>ändert sich</span></div>
      <div class="mg-card">${spark(T, 12)}<div class="mg-scale"><span>vor 24 Std.</span><span>Schwelle 12 °C</span><span>jetzt</span></div></div>
      <div class="mg-pills"><span class="mg-pill num">−</span><span class="mg-pill num">12 °C</span><span class="mg-pill num">+</span></div>
      <div class="mg-k">für mindestens</div><div class="mg-seg"><span>Sofort</span><span>5 Min.</span><span class="on">10 Min.</span><span>30 Min.</span><span>1 Std.</span></div>
      <p class="mg-note" style="margin-top:10px">In den letzten 24 Stunden wäre die Meldung 0-mal gekommen.</p>
      <div class="mg-btns"><span class="mg-btn">Zurück</span><span class="mg-btn p">Weiter</span></div>`,
    // C3: Schritt 3 mit Vorschau
    () => `<h3>Neue Meldung</h3><div class="mg-stephead"><span>Schritt 3 von 3</span><span>Text</span></div><div class="mg-steps"><span class="on"></span><span class="on"></span><span class="on"></span></div>
      <div class="mg-big">Was soll in der Meldung stehen?</div>
      <div class="mg-msg">Keller ist kalt: ${v("{value}")} ${v("{unit}")}</div>
      <div class="mg-chips"><span>{device}</span><span>{entity}</span><span>{value}</span><span>{unit}</span><span>{threshold}</span><span>{duration}</span><span>{area}</span></div>
      ${preview("Keller ist kalt: 11,8 °C", "Klimasensor Keller · seit 10 Min. unter 12 °C")}
      <div class="mg-test">Test senden</div>
      <div class="mg-btns"><span class="mg-btn">Zurück</span><span class="mg-btn p">Speichern</span></div>`,
  ],
};

async function shots(variant) {
  const files = [];
  for (const [i, build] of SCREENS[variant].entries()) {
    const { ctx, p, ev } = await page(true, { css: CSS, width: 390, height: 1100, freeze: false });
    await ev(`r.host._openDevice("h")`); await p.waitForTimeout(600);
    await ev(`r.host._fetch = () => {}`);
    // Reiterleiste und Inhalt des Popups ersetzen (der vierte Reiter "Magic Push" ist neu), Name erfunden
    await ev(`const dlg = r.querySelector("dialog.device");
      dlg.querySelector(".dev-tabs").innerHTML = arg.tabs; dlg.querySelector(".dlg-body").innerHTML = arg.body;
      for (const el of dlg.querySelectorAll(".dlg-title *")) if (el.children.length === 0 && el.textContent.trim() === "Stromzähler") el.textContent = "Klimasensor Keller";`, { tabs: tabs("3 aktiv"), body: build() });
    files.push(await shot(p, true, `${variant}-${i + 1}`));
    await ctx.close();
  }
  return files;
}
const caps = {
  A: ["A1 · Meine Meldungen als Sätze", "A2 · Neue Meldung als ein Satz", "A3 · Entität aus der Liste wählen"],
  B: ["B1 · Alle Entitäten als Karten", "B2 · Wert antippen: Vorschlag, Schwelle, Dauer, Text", "B3 · Zustand (Fenster offen)"],
  C: ["C1 · Schritt 1: Wert wählen", "C2 · Schritt 2: Bedingung mit Diagramm", "C3 · Schritt 3: Text und Vorschau"],
};
for (const variant of ["A", "B", "C"]) {
  const files = await shots(variant);
  await compose(`${variant}.png`, files.map((f, i) => [f, caps[variant][i], 300]));
}
await close();
console.log("fertig");
