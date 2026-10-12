// Mockups timer-v1 (Wunsch des Nutzers, 2026-10-12): Timer. Ein Timer schaltet eine schaltbare Entität eines Geräts
// einmalig (in X Minuten oder an einem Datum) oder geplant (täglich, wöchentlich, monatlich). Alles im echten Panel
// (Nachbau, erfundene Daten): Geräte-Popup mit neuem Reiter "Timer", Assistent im Magic-Push-Stil, Einstellungen mit
// eigenem aufklappbarem Abschnitt "Timer" (Suche, Filter, aktivieren/deaktivieren).
//   1: Reiter "Timer" im Geräte-Popup: A Karten wie Magic Push, B Wecker-Stil (Empfehlung)
//   2: Assistent (4 Schritte): Was, Wann (Wiederholt), Meldung (Push, Empfänger, Vorschau), Name und Prüfung
//   3: Schritt "Wann": In X Minuten, Einmal am Datum, Wiederholt monatlich
//   4: Einstellungen: Abschnitt "Timer" (Suche, Filter, nach Gerät einklappbar), Handy und Desktop
//   5: Zustände: läuft, erledigt, Fehler, Neustart; Hinweis in der Geräteliste
// Aufruf: CHROMIUM_PATH=... node docs/mockups/timer-v1/src/render.mjs
import { setup, svg } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8994, import.meta.url);

const CSS = `
/* Gemeinsame Bausteine */
.tm-seg { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 2px; padding: 3px; border-radius: 12px; background: color-mix(in srgb, var(--dp-text) 7%, var(--dp-card)); margin: 2px 0 8px; }
.tm-seg span { display: grid; place-items: center; height: 36px; border-radius: 9px; color: color-mix(in srgb, var(--dp-text) 72%, transparent); font-size: 13px; text-align: center; white-space: nowrap; }
.tm-seg span.on { background: var(--dp-bg); color: var(--dp-primary); font-weight: 500; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dp-text) 7%, transparent); }
.tm-seg small { margin-left: 4px; color: var(--dp-text2); font-size: 11.5px; font-weight: 400; }
.tm-sw { flex: none; width: 46px; height: 28px; border-radius: 99px; background: var(--dp-primary); position: relative; }
.tm-sw::after { content: ""; position: absolute; top: 3px; right: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; }
.tm-sw.off { background: color-mix(in srgb, var(--dp-text) 25%, transparent); }
.tm-sw.off::after { right: auto; left: 3px; }
.tm-t { flex: 1; min-width: 0; }
.tm-t b { display: block; font-size: 14.5px; font-weight: 600; }
.tm-t small { display: block; margin-top: 2px; color: var(--dp-text2); font-size: 12.5px; line-height: 1.35; }
.tm-t .on { color: var(--dp-primary); font-weight: 500; }
.tm-t .warn { color: var(--dp-warning); font-weight: 500; }
.tm-t .err { color: var(--dp-error); font-weight: 500; }
.tm-acts { display: flex; gap: 18px; margin-top: 8px; font-size: 13px; color: var(--dp-primary); }
.tm-acts .del { color: var(--dp-error); }
.tm-ic { flex: none; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; background: var(--dp-primary-soft); font-size: 19px; }
.tm-ic.off { background: var(--dp-subtle); filter: grayscale(1); opacity: .7; }
.tm-intro { margin: 0 0 6px; color: var(--dp-text2); font-size: 12.5px; line-height: 1.4; }
.tm-add { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; box-sizing: border-box; height: 46px; margin-top: 12px; border: 1.5px dashed color-mix(in srgb, var(--dp-primary) 55%, transparent); border-radius: 14px; color: var(--dp-primary); font-size: 14.5px; font-weight: 500; }
.tm-tag { display: inline-block; padding: 1px 8px; border-radius: 99px; background: var(--dp-primary-soft); color: var(--dp-primary); font-size: 11.5px; font-weight: 500; }
.tm-tag.grey { background: var(--dp-subtle); color: var(--dp-text2); }
.tm-tag.err { background: var(--dp-error-soft); color: var(--dp-error); }
.tm-tag.warn { background: color-mix(in srgb, var(--dp-warning) 18%, transparent); color: var(--dp-warning); }

/* A: Karten wie Magic Push */
.tm-card { margin-top: 8px; padding: 12px 14px 12px 12px; border-radius: 14px; background: var(--dp-subtle); }
.tm-card.off { opacity: .72; }
.tm-card .row { display: flex; align-items: flex-start; gap: 10px; }
.tm-card .row .tm-sw { margin-top: 2px; }

/* B: Wecker-Stil */
.tm-clock { margin-top: 8px; padding: 12px 14px; border-radius: 16px; background: var(--dp-subtle); }
.tm-clock.off { opacity: .7; }
.tm-clock .top { display: flex; align-items: center; gap: 10px; }
.tm-clock .time { font-size: 34px; font-weight: 300; letter-spacing: -.02em; line-height: 1; font-variant-numeric: tabular-nums; }
.tm-clock .time small { font-size: 14px; font-weight: 400; margin-left: 6px; color: var(--dp-text2); letter-spacing: 0; }
.tm-clock .grow { flex: 1; min-width: 0; }
.tm-clock .name { margin-top: 6px; font-size: 14px; font-weight: 600; }
.tm-clock .what { margin-top: 2px; color: var(--dp-text2); font-size: 12.5px; line-height: 1.35; }
.tm-days { display: flex; gap: 5px; margin-top: 9px; }
.tm-days i { flex: 1; max-width: 34px; height: 26px; display: grid; place-items: center; border-radius: 8px; font-style: normal; font-size: 11.5px; color: var(--dp-text2); background: color-mix(in srgb, var(--dp-text) 6%, transparent); }
.tm-days i.on { background: var(--dp-primary-soft); color: var(--dp-primary); font-weight: 600; }
.tm-clock .next { margin-top: 9px; padding-top: 8px; border-top: 1px solid var(--dp-divider); display: flex; gap: 14px; align-items: center; color: var(--dp-text2); font-size: 12.5px; }
.tm-clock .next b { color: var(--dp-text); font-weight: 600; }
.tm-clock .next .acts { margin: 0 0 0 auto; display: flex; gap: 16px; color: var(--dp-primary); }
.tm-clock .next .acts .del { color: var(--dp-error); }
.tm-ring { flex: none; position: relative; width: 62px; height: 62px; }
.tm-ring svg { width: 62px; height: 62px; transform: rotate(-90deg); }
.tm-ring circle { fill: none; stroke-width: 6; }
.tm-ring .bg { stroke: color-mix(in srgb, var(--dp-text) 12%, transparent); }
.tm-ring .fg { stroke: var(--dp-primary); stroke-linecap: round; }
.tm-ring span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 11.5px; font-weight: 600; font-variant-numeric: tabular-nums; }

/* Assistent */
.tm-pick { margin-top: 8px; }
.tm-chiprow { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.tm-chip { display: inline-flex; align-items: center; height: 38px; padding: 0 14px; border-radius: 11px; background: color-mix(in srgb, var(--dp-text) 7%, var(--dp-card)); font-size: 14px; }
.tm-chip.on { background: var(--dp-primary-soft); color: var(--dp-primary); font-weight: 600; box-shadow: inset 0 0 0 1.5px var(--dp-primary); }
.tm-wd { display: flex; gap: 6px; margin-top: 6px; }
.tm-wd i { flex: 1; height: 44px; display: grid; place-items: center; border-radius: 50%; max-width: 44px; font-style: normal; font-size: 13.5px; background: color-mix(in srgb, var(--dp-text) 7%, var(--dp-card)); }
.tm-wd i.on { background: var(--dp-primary); color: #fff; font-weight: 600; }
.tm-time { display: inline-flex; align-items: baseline; gap: 4px; height: 58px; padding: 0 20px; border-radius: 14px; background: color-mix(in srgb, var(--dp-text) 7%, var(--dp-card)); font-size: 34px; font-weight: 300; font-variant-numeric: tabular-nums; align-items: center; }
.tm-time small { font-size: 14px; color: var(--dp-text2); font-weight: 400; margin-left: 4px; }
.tm-field { display: flex; align-items: center; height: 46px; padding: 0 14px; border-radius: 12px; background: color-mix(in srgb, var(--dp-text) 7%, var(--dp-card)); font-size: 15px; }
.tm-next { margin-top: 8px; border-radius: 14px; background: var(--dp-subtle); padding: 4px 14px; }
.tm-next div { display: flex; justify-content: space-between; gap: 10px; padding: 8px 0; font-size: 13.5px; border-top: 1px solid var(--dp-divider); }
.tm-next div:first-child { border-top: 0; }
.tm-next div span:last-child { color: var(--dp-text2); }
.tm-sum { margin-top: 8px; padding: 12px 14px; border-radius: 14px; background: var(--dp-primary-soft); font-size: 14.5px; line-height: 1.45; }
.tm-sum b { font-weight: 600; }
.tm-test { display: flex; align-items: center; justify-content: center; gap: 8px; height: 42px; margin-top: 10px; border-radius: 12px; background: color-mix(in srgb, var(--dp-text) 7%, var(--dp-card)); color: var(--dp-primary); font-size: 14px; font-weight: 500; }
.tm-onrow { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding: 10px 14px; border-radius: 14px; background: var(--dp-subtle); }

/* Einstellungen */
.tm-count { display: flex; justify-content: space-between; align-items: center; margin: 2px 2px 8px; color: var(--dp-text2); font-size: 12.5px; }
.tm-count a { color: var(--dp-primary); }
.tm-gen { margin-top: 10px; border-radius: 14px; background: var(--dp-subtle); }
.tm-gen > div { display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-top: 1px solid var(--dp-divider); }
.tm-gen > div:first-child { border-top: 0; }
.tm-sel { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border-radius: 10px; background: color-mix(in srgb, var(--dp-text) 7%, var(--dp-card)); font-size: 13.5px; }
.tm-dc { margin-top: 10px; border-radius: 16px; background: var(--dp-subtle); overflow: hidden; }
.tm-dh { display: flex; align-items: center; gap: 10px; padding: 11px 12px; background: color-mix(in srgb, var(--dp-text) 5%, var(--dp-subtle)); }
.tm-dh .dv { flex: none; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: var(--dp-subtle); color: var(--dp-text2); }
.tm-dh .tm-t b { font-size: 15px; }
.tm-badge { flex: none; min-width: 22px; height: 22px; padding: 0 7px; box-sizing: border-box; display: grid; place-items: center; border-radius: 99px; background: var(--dp-primary-soft); color: var(--dp-primary); font-size: 12px; font-weight: 600; }
.tm-chev { flex: none; color: var(--dp-text2); display: grid; place-items: center; }
.tm-line { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px 12px 12px; border-top: 1px solid var(--dp-divider); }
.tm-line.off { opacity: .7; }
.tm-line .tm-sw { margin-top: 2px; }
.tm-dc.closed .tm-line { display: none; }
.tm-sum2 { margin-top: 2px; color: var(--dp-text2); font-size: 12.5px; }
.tm-sum2 .on { color: var(--dp-primary); font-weight: 500; }
.tm-note { margin: 10px 2px 0; color: var(--dp-text2); font-size: 12.5px; }
.tm-big { margin: 14px 0 6px; font-size: 13px; color: var(--dp-text2); }

/* Zustände */
.tm-st { margin-top: 10px; padding: 12px 14px; border-radius: 16px; background: var(--dp-subtle); }
.tm-st .top { display: flex; align-items: center; gap: 12px; }
.tm-st .btns { display: flex; gap: 8px; margin-top: 10px; }
.tm-st .btns span { flex: 1; display: grid; place-items: center; height: 38px; border-radius: 11px; background: color-mix(in srgb, var(--dp-text) 7%, var(--dp-card)); font-size: 13.5px; font-weight: 500; }
.tm-st .btns span.pri { background: var(--dp-primary); color: #fff; }
.tm-st .btns span.dng { color: var(--dp-error); }
.tm-st.err { background: var(--dp-error-soft); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dp-error) 35%, transparent); }
.tm-st.done { opacity: .85; }
.tm-lab { margin: 14px 2px 2px; color: var(--dp-text2); font-size: 11.5px; letter-spacing: .04em; text-transform: uppercase; }
.tm-rowhint { display: inline-flex; align-items: center; gap: 4px; margin-left: 6px; padding: 1px 7px; border-radius: 99px; background: var(--dp-primary-soft); color: var(--dp-primary); font-size: 11.5px; font-weight: 600; vertical-align: 1px; }
`;

// erfundene Daten: Gerät "Steckdose Terrasse" (Terrasse · Shelly)
const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const days = (on) => `<div class="tm-days">${WD.map((d, i) => `<i class="${on.includes(i) ? "on" : ""}">${d}</i>`).join("")}</div>`;
const T = {
  garden: { e: "💡", n: "Gartenlicht", time: "20:00", rep: "täglich", days: [0, 1, 2, 3, 4, 5, 6], act: "Steckdose einschalten", back: "nach 3 Std. 30 Min. wieder aus", next: "heute 20:00", on: true, push: "Familie" },
  pump: { e: "🚿", n: "Bewässerung", time: "06:30", rep: "wöchentlich", days: [0, 2, 4], act: "Steckdose einschalten", back: "nach 20 Min. wieder aus", next: "Mi., 06:30", on: true, push: "Dani iPhone" },
  off30: { e: "⏱️", n: "Abschalten", time: "12:34", rep: "einmalig", act: "Steckdose ausschalten", back: "", next: "läuft, in 12 Min. 34 Sek.", run: true, on: true },
  filter: { e: "🧽", n: "Filter spülen", time: "09:00", rep: "monatlich", mday: "1.", act: "Steckdose einschalten", back: "nach 10 Min. wieder aus", next: "1.11., 09:00", on: true },
  xmas: { e: "🎄", n: "Weihnachtsbeleuchtung", time: "17:00", rep: "einmalig", date: "24.12.2026", act: "Steckdose einschalten", back: "", next: "24.12.2026, 17:00", on: false },
};
const sentence = (t) => t.run ? `Einmalig · in 12 Min. 34 Sek. · ${t.act}` : t.rep === "einmalig" ? `Einmalig · ${t.date} um ${t.time} · ${t.act}${t.back ? `, ${t.back}` : ""}` : t.rep === "täglich" ? `Täglich um ${t.time} · ${t.act}${t.back ? `, ${t.back}` : ""}` : t.rep === "wöchentlich" ? `Mo, Mi, Fr um ${t.time} · ${t.act}${t.back ? `, ${t.back}` : ""}` : `Monatlich am ${t.mday} um ${t.time} · ${t.act}${t.back ? `, ${t.back}` : ""}`;
const sw = (on) => `<span class="tm-sw${on ? "" : " off"}"></span>`;

// A: Karte wie Magic Push
const cardA = (t) => `<div class="tm-card${t.on ? "" : " off"}"><div class="row"><span class="tm-ic${t.on ? "" : " off"}">${t.e}</span><div class="tm-t"><b>${t.n}</b><small>${sentence(t)}</small>${t.push ? `<small>🔔 Push an ${t.push}</small>` : ""}<small>${t.run ? `<span class="on">läuft</span>` : t.on ? `nächster Lauf: <span class="on">${t.next}</span>` : `aus · ${t.next}`}</small><div class="tm-acts"><span>Bearbeiten</span><span>Ausführen</span><span class="del">Löschen</span></div></div>${sw(t.on)}</div></div>`;
// B: Wecker-Stil
const clockB = (t) => {
  const left = t.run ? `<div class="tm-ring"><svg viewBox="0 0 62 62"><circle class="bg" cx="31" cy="31" r="26"/><circle class="fg" cx="31" cy="31" r="26" stroke-dasharray="${(2 * Math.PI * 26).toFixed(1)}" stroke-dashoffset="${(2 * Math.PI * 26 * 0.58).toFixed(1)}"/></svg><span>12:34</span></div>` : `<div class="time">${t.time}<small>${t.rep === "einmalig" ? t.date || "" : t.rep === "monatlich" ? `am ${t.mday} jedes Monats` : ""}</small></div>`;
  return `<div class="tm-clock${t.on ? "" : " off"}"><div class="top">${left}<span class="grow"></span>${sw(t.on)}</div><div class="name">${t.e} ${t.n}</div><div class="what">${t.act}${t.back ? ` · ${t.back}` : ""}${t.run ? " · einmalig" : ""}${t.push ? ` · 🔔 ${t.push}` : ""}</div>${t.rep === "täglich" || t.rep === "wöchentlich" ? days(t.days) : ""}<div class="next"><span>${t.run ? "noch" : "nächster Lauf"} <b>${t.run ? "12 Min. 34 Sek." : t.next}</b></span><span class="acts"><span>Bearbeiten</span><span class="del">Löschen</span></span></div></div>`;
};
const tabBody = (variant) => {
  const list = [T.garden, T.pump, T.off30, T.filter, T.xmas];
  return `<div class="mg-root"><h3>Timer</h3><p class="tm-intro">Schaltet eine Entität dieses Geräts zu einer bestimmten Zeit: einmalig oder wiederholt. Alle Timer findest du auch in den Einstellungen.</p>${list.map(variant === "A" ? cardA : clockB).join("")}<div class="tm-add">＋ Neuer Timer</div></div>`;
};

// Assistent: Hülle wie Magic Push (mgw-*)
const wiz = (step, label, body, { next = "Weiter", back = "Zurück", sub = "Steckdose Terrasse" } = {}) => `<div class="mgw-head"><div class="mgw-t"><b>Neuer Timer</b><small>${sub}</small></div>
  <button type="button" class="dlg-close" aria-label="Schliessen">${svg("close", 18)}</button></div>
  <div class="mgw-prog"><div class="mg-stephead"><span>Schritt ${step} von 4</span><span>${label}</span></div>
  <div class="mg-steps">${[1, 2, 3, 4].map((i) => `<span class="mg-stp${i <= step ? " on" : ""}"></span>`).join("")}</div></div>
  <div class="mgw-body"><div class="mgw-main">${body}</div></div>
  <div class="mgw-foot"><div class="mg-btns"><button type="button" class="dlg-btn">${back}</button><button type="button" class="dlg-btn primary">${next}</button></div></div>`;
const seg = (items, on, cls = "") => `<div class="sub-tabs mg-tabs ${cls}" role="radiogroup">${items.map((l) => `<button type="button" role="radio" class="sub-tab${l === on ? " on" : ""}" aria-checked="${l === on}">${l}</button>`).join("")}<i class="seg-pill" aria-hidden="true"></i></div>`;
const entity = (e, n, st, on, sub = "") => `<button type="button" class="mg-card mg-pick" role="radio" aria-checked="${on}"><span class="mg-row"><span class="mg-ic">${e}</span><span class="mg-t"><b>${n}</b>${sub ? `<small>${sub}</small>` : ""}</span><span class="mg-val">${st}</span><span class="mg-radio${on ? " on" : ""}"></span></span></button>`;

const STEP1 = wiz(1, "Was schalten", `<div class="mg-big">Was soll geschaltet werden?</div>
  <p class="mg-note">Es werden nur schaltbare Entitäten dieses Geräts gezeigt.</p>
  ${entity("🔌", "Steckdose", "ein", true, "switch · Steckdose Terrasse")}${entity("💡", "LED-Ring", "aus", false, "light · Steckdose Terrasse")}
  <div class="mg-k">Aktion</div>${seg(["Einschalten", "Ausschalten", "Umschalten"], "Einschalten")}
  <div class="mg-k">Danach wieder zurückschalten (optional)</div>${seg(["Nie", "10 Min.", "30 Min.", "1 Std."], "30 Min.")}
  <div class="mg-own"><span>oder eigene Zeit</span><span class="mg-pill num mg-ownin">–</span><span class="mg-pill">Min. ▾</span></div>
  <div class="mg-note">Ergebnis: Steckdose einschalten, nach 30 Min. wieder ausschalten.</div>`);

const dayChips = (on) => `<div class="tm-wd">${WD.map((d, i) => `<i class="${on.includes(i) ? "on" : ""}">${d}</i>`).join("")}</div>`;
const STEP2_REP = wiz(2, "Wann", `<div class="mg-big">Wann soll geschaltet werden?</div>
  ${seg(["In …", "Einmal", "Wiederholt"], "Wiederholt")}
  <div class="mg-k">Uhrzeit</div><div class="tm-time">06<small>:</small>30<small>Uhr</small></div>
  <div class="mg-k">Wiederholen</div>${seg(["Täglich", "Wöchentlich", "Monatlich"], "Wöchentlich")}
  <div class="mg-k">An diesen Tagen</div>${dayChips([0, 2, 4])}
  <div class="mg-note">Zeit nach der Zeitzone von Home Assistant (Europe/Zurich), Sommerzeit wird beachtet.</div>
  <div class="mg-k">Nächste Ausführungen</div><div class="tm-next"><div><span>Mi., 14.10.2026</span><span>06:30</span></div><div><span>Fr., 16.10.2026</span><span>06:30</span></div><div><span>Mo., 19.10.2026</span><span>06:30</span></div></div>`);


// Schritt 3: Meldung (Push)
const pv = (title, text, app = "Home Assistant · jetzt") => `<div class="mg-pv"><div class="pv-k">Vorschau</div><div class="pv-card"><div class="pv-app">${svg("pulse", 14)}${app}</div><div class="pv-title">${title}</div><div class="pv-text">${text}</div></div><div class="opt-short">So kommt die Meldung an. Der Text ist fest und gleich bei allen Timern.</div><div class="mg-testrow"><button type="button" class="linkbtn">Test senden</button></div></div>`;
const optrow = (t, sub, on) => `<div class="mg-optrow"><div>${t}${sub ? `<small>${sub}</small>` : ""}</div><label class="switch"><input type="checkbox" ${on ? "checked" : ""}><span></span></label></div>`;
const targetSel = (txt, sub, open = false) => `<button type="button" class="mg-sel" aria-expanded="${open}"><span>${txt}<small>${sub}</small></span><span class="mg-lchev${open ? " up" : ""}" aria-hidden="true">${svg("chevDown", 20)}</span></button>`;
const MSG_OFF = wiz(3, "Meldung", `<div class="mg-big">Soll eine Push-Meldung kommen?</div>
  <p class="mg-note">Eine Erinnerung auf dein Handy, wenn der Timer schaltet. Der Inhalt ist fest vorgegeben.</p>
  ${optrow("Per Push melden", "", false)}
  <div class="mg-note" style="margin-top:12px">Ausgeschaltet kommt keine Meldung. Schlägt das Schalten fehl, meldet dich Home Assistant trotzdem, wenn "Bei Fehler benachrichtigen" in den Einstellungen an ist.</div>`);
const MSG_ON = wiz(3, "Meldung", `<div class="mg-big">Soll eine Push-Meldung kommen?</div>
  <p class="mg-note">Eine Erinnerung auf dein Handy, wenn der Timer schaltet. Der Inhalt ist fest vorgegeben.</p>
  ${optrow("Per Push melden", "", true)}
  <div class="mg-k">Empfänger</div>${targetSel("Standard aus den Einstellungen", "notify.familie (Gruppe Familie)")}
  <p class="mg-hint">Wie in "Überwachung und Meldungen": Dienste, Gruppen und Entitäten. Ändert sich das Standard-Ziel in den Einstellungen, folgt dieser Timer.</p>
  ${pv("Timer: Bewässerung", "Steckdose Terrasse ist jetzt ein · 06:30")}`);
const MSG_TARGET = wiz(3, "Meldung", `<div class="mg-big">Soll eine Push-Meldung kommen?</div>
  ${optrow("Per Push melden", "", true)}
  <div class="mg-k">Empfänger</div>${targetSel("Familie", "notify.familie", true)}
  <div class="mg-list" role="listbox"><button type="button" class="mg-opt-row" role="option"><span>Standard aus den Einstellungen<br><small>notify.familie (Gruppe Familie)</small></span></button>
  <div class="mg-opt-head">Gruppen</div><button type="button" class="mg-opt-row on" role="option"><span>Familie<br><small>notify.familie</small></span><span>✓</span></button>
  <div class="mg-opt-head">Dienste</div><button type="button" class="mg-opt-row" role="option"><span>Dani iPhone<br><small>notify.mobile_app_dani_iphone</small></span></button><button type="button" class="mg-opt-row" role="option"><span>Partner iPhone<br><small>notify.mobile_app_partner_iphone</small></span></button>
  <div class="mg-opt-head">Entitäten</div><button type="button" class="mg-opt-row" role="option"><span>Küchen-Display<br><small>notify.kuechen_display</small></span></button></div>
  <p class="mg-hint">Gewählt: nur dieser Timer geht an "Familie". Wer "Standard" lässt, folgt immer dem Ziel aus den Einstellungen.</p>`);
const STEP4 = wiz(4, "Name und Prüfung", `<div class="mg-big">Name und Prüfung</div>
  <div class="mg-k">Name</div><div class="tm-field">Bewässerung</div>
  <div class="tm-sum"><b>Mo, Mi, Fr um 06:30</b>: Steckdose Terrasse einschalten, nach 20 Min. wieder ausschalten.<br>🔔 Push an <b>Familie</b>, wenn der Timer schaltet.</div>
  <div class="mg-k">Nächste Ausführung</div><div class="tm-next"><div><span>Mittwoch, 14.10.2026 um 06:30</span><span>in 1 Tag</span></div></div>
  <div class="tm-onrow"><div class="tm-t"><b>Timer aktiv</b><small>Ausgeschaltet bleibt er gespeichert, schaltet aber nicht.</small></div>${sw(true)}</div>
  <div class="tm-test">▶ Jetzt testen (schaltet die Steckdose wirklich)</div>`, { next: "Speichern" });

const STEP2_IN = wiz(2, "Wann", `<div class="mg-big">Wann soll geschaltet werden?</div>
  ${seg(["In …", "Einmal", "Wiederholt"], "In …")}
  <div class="mg-k">in</div>${seg(["5 Min.", "15 Min.", "30 Min.", "1 Std."], "30 Min.")}
  <div class="mg-own"><span>oder eigene Zeit</span><span class="mg-pill num mg-ownin">–</span><span class="mg-pill">Min. ▾</span></div>
  <div class="mg-note">Der Timer läuft einmal ab und ist danach automatisch aus (bleibt als "erledigt" in der Liste, du kannst ihn erneut starten).</div>
  <div class="mg-k">Läuft ab</div><div class="tm-next"><div><span>heute um 13:12</span><span>in 30 Min.</span></div></div>`);
const STEP2_ONCE = wiz(2, "Wann", `<div class="mg-big">Wann soll geschaltet werden?</div>
  ${seg(["In …", "Einmal", "Wiederholt"], "Einmal")}
  <div class="mg-k">Datum</div><div class="tm-field">Do., 24.12.2026 ▾</div>
  <div class="mg-k">Uhrzeit</div><div class="tm-time">17<small>:</small>00<small>Uhr</small></div>
  <div class="mg-note">Nach der Ausführung wird der Timer automatisch deaktiviert.</div>
  <div class="mg-k">Läuft ab</div><div class="tm-next"><div><span>Donnerstag, 24.12.2026 um 17:00</span><span>in 73 Tagen</span></div></div>`);
const STEP2_MONTH = wiz(2, "Wann", `<div class="mg-big">Wann soll geschaltet werden?</div>
  ${seg(["In …", "Einmal", "Wiederholt"], "Wiederholt")}
  <div class="mg-k">Uhrzeit</div><div class="tm-time">09<small>:</small>00<small>Uhr</small></div>
  <div class="mg-k">Wiederholen</div>${seg(["Täglich", "Wöchentlich", "Monatlich"], "Monatlich")}
  <div class="mg-k">Am Tag des Monats</div>${seg(["1.", "15.", "Letzter Tag", "Anderer"], "1.")}
  <div class="mg-note">"Letzter Tag" gilt auch für Monate mit 28, 29 oder 30 Tagen. Ein Tag wie der 31. wird in kurzen Monaten auf den letzten Tag gelegt.</div>
  <div class="mg-k">Nächste Ausführungen</div><div class="tm-next"><div><span>So., 01.11.2026</span><span>09:00</span></div><div><span>Di., 01.12.2026</span><span>09:00</span></div><div><span>Fr., 01.01.2027</span><span>09:00</span></div></div>`);

// Einstellungen: Abschnitt "Timer"
const D = [
  { name: "Steckdose Terrasse", sub: "Terrasse · Shelly", timers: [T.garden, T.pump, T.off30, T.xmas], open: true },
  { name: "Kaffeemaschine Küche", sub: "Küche · Shelly", timers: [{ e: "☕", n: "Morgens", rep: "wöchentlich", act: "Kaffeemaschine einschalten", back: "nach 45 Min. wieder aus", time: "06:30", next: "morgen 06:30", on: true, wd: "Mo–Fr" }], open: false },
  { name: "Lampe Flur", sub: "Flur · Hue", timers: [{ e: "🌙", n: "Nachtlicht", rep: "täglich", act: "Lampe einschalten", back: "nach 8 Std. wieder aus", time: "22:00", next: "heute 22:00", on: true }, { e: "🪔", n: "Weihnachtsbaum", rep: "einmalig", act: "Lampe einschalten", back: "", time: "17:00", date: "24.12.2026", next: "24.12.2026, 17:00", on: false }], open: false },
];
const total = D.reduce((n, d) => n + d.timers.length, 0);
const act = D.flatMap((d) => d.timers).filter((t) => t.on).length;
const search = (q = "", n = "") => `<label class="list-search">${svg("search", 18)}<input type="search" value="${q}" placeholder="Suchen …"><span class="n">${n}</span></label>`;
const segCounts = (on, c) => `<div class="tm-seg">${["Alle", "Aktiv", "Aus", "Läuft"].map((l, i) => `<span class="${l === on ? "on" : ""}">${l}<small>${c[i]}</small></span>`).join("")}</div>`;
const line2 = (t) => {
  const s = t.run ? `${t.act} · in 12 Min. 34 Sek.` : t.rep === "einmalig" ? `Einmalig · ${t.date} ${t.time} · ${t.act}${t.back ? `, ${t.back}` : ""}` : t.rep === "täglich" ? `Täglich ${t.time} · ${t.act}${t.back ? `, ${t.back}` : ""}` : t.rep === "monatlich" ? `Monatlich am ${t.mday} ${t.time} · ${t.act}${t.back ? `, ${t.back}` : ""}` : `${t.wd || "Mo, Mi, Fr"} ${t.time} · ${t.act}${t.back ? `, ${t.back}` : ""}`;
  return `<div class="tm-line${t.on ? "" : " off"}"><span class="tm-ic${t.on ? "" : " off"}">${t.e}</span><div class="tm-t"><b>${t.n}</b><small>${s}</small><small>${t.run ? `<span class="on">läuft</span>` : t.on ? `nächster Lauf: <span class="on">${t.next}</span>` : `aus`}</small><div class="tm-acts"><span>Bearbeiten</span><span>Ausführen</span><span class="del">Löschen</span></div></div>${sw(t.on)}</div>`;
};
const devCard = (d, open) => `<div class="tm-dc${open ? "" : " closed"}"><div class="tm-dh"><span class="dv">${svg("pulse", 16)}</span><div class="tm-t"><b>${d.name}</b>${open ? "" : `<div class="tm-sum2">${d.timers.length} ${d.timers.length === 1 ? "Timer" : "Timer"}${d.timers.some((t) => !t.on) ? ` · ${d.timers.filter((t) => !t.on).length} aus` : ""} · <span class="on">nächster ${d.timers.find((t) => t.on)?.next || ""}</span></div>`}${open ? `<small>${d.sub}</small>` : ""}</div><span class="tm-badge">${d.timers.length}</span><span class="tm-chev">${svg(open ? "chevDown" : "chevron", 20)}</span></div>${d.timers.map(line2).join("")}</div>`;
const general = `<div class="tm-gen"><div><div class="tm-t"><b>Alle Timer pausieren</b><small>Nichts schaltet, bis du wieder einschaltest (zum Beispiel in den Ferien).</small></div>${sw(false)}</div>
  <div><div class="tm-t"><b>Verpasste Timer nachholen</b><small>Wenn Home Assistant zur Zeit nicht lief.</small></div><span class="tm-sel">bis 10 Min. ▾</span></div>
  <div><div class="tm-t"><b>Bei Fehler benachrichtigen</b><small>Wenn eine Entität nicht schalten konnte. Ziel wie "Meldungen".</small></div>${sw(true)}</div></div>`;
const settingsBody = (open = [true, false, false], { q = "", n = "", only = null } = {}) => `<p class="tm-intro">Alle Timer, nach Gerät. Neue legst du im Popup des Geräts an, im Reiter Timer.</p>${search(q, n)}${segCounts("Alle", [total, act, total - act, 1])}
  <div class="tm-count"><span>${only ? only.length : total} Timer auf ${only ? only.length : D.length} Geräten</span><a>Alle einklappen</a></div>
  ${(only || D).map((d, i) => devCard(d, only ? true : open[i])).join("")}${general}`;

// Seitenaufbau im Nachbau
const fixPills = `
  r.querySelectorAll(".sub-tabs").forEach((bar) => { const on = bar.querySelector(".sub-tab.on"), pill = bar.querySelector(".seg-pill"); if (!on || !pill) return;
    pill.style.width = on.offsetWidth + "px"; pill.style.height = on.offsetHeight + "px"; pill.style.transform = "translate(" + on.offsetLeft + "px," + on.offsetTop + "px)"; });`;

async function popupTab(name, variant, mobile) {
  const { ctx, p, ev } = await page(mobile, { css: CSS, width: 390, height: mobile ? 1450 : 900, freeze: false });
  await ev(`r.querySelector('.dev[data-open="d"]').click()`); await p.waitForTimeout(700);
  await ev(`r.host._fetch = () => {}; r.host._renderDevice = () => {};`);
  // fünften Reiter "Timer" einhängen und wählen
  await ev(`const bar = r.querySelector("dialog.device .sub-tabs"); bar.querySelectorAll(".sub-tab").forEach((b) => { b.classList.remove("on"); b.setAttribute("aria-selected", "false"); });
    const t = document.createElement("button"); t.type = "button"; t.className = "sub-tab on"; t.setAttribute("role", "tab"); t.textContent = "Timer"; bar.insertBefore(t, bar.querySelector(".seg-pill"));
    r.querySelector("dialog.device .dlg-body").innerHTML = arg;` + fixPills, tabBody(variant));
  await ev(`const d=r.querySelector("dialog.device"); d.style.height = "auto"; d.style.maxHeight = "none"; d.scrollTop = 0;`);
  const f = await shot(p, mobile, name);
  await ctx.close();
  return f;
}

async function wizard(name, html) {
  const { ctx, p, ev } = await page(true, { css: CSS, width: 390, height: 844, freeze: false });
  await ev(`r.host._fetch = () => {}; const d = r.querySelector("dialog.magic-dlg"); d.innerHTML = arg; if (!d.open) d.showModal(); r.activeElement?.blur(); d.querySelector("button")?.blur();` + fixPills, html);
  const f = await shot(p, true, name);
  await ctx.close();
  return f;
}

async function settings(name, html, mobile, { tall = 1500 } = {}) {
  const { ctx, p, ev } = await page(mobile, { css: CSS, width: 390, height: mobile ? tall : 900, freeze: false });
  await ev(`r.querySelector(".gear-btn").click()`); await p.waitForTimeout(500);
  await ev(`r.host._fetch = () => {}; r.host._renderSettings = () => {};`);
  await ev(`const d = r.querySelector("dialog.settings"); d.style.height = "auto"; d.style.maxHeight = "none";
    const sec = r.querySelector('[data-set="section"][data-id="monitor"]').closest(".set-sec"); const clone = sec.cloneNode(true); clone.classList.add("open");
    const head = clone.querySelector(".set-sec-head"); head.setAttribute("aria-expanded", "true");
    clone.querySelector(".set-sec-title").textContent = "Timer"; const sum = clone.querySelector(".set-sec-sum"); if (sum) sum.textContent = arg.sum;
    const body = clone.querySelector(".set-sec-body") || Object.assign(document.createElement("div"), { className: "set-sec-body" }); body.innerHTML = arg.html;
    if (!arg.open) { clone.classList.remove("open"); head.setAttribute("aria-expanded", "false"); if (body.parentNode) body.remove(); }
    else if (!body.parentNode) clone.appendChild(body);
    sec.parentNode.insertBefore(clone, sec.nextSibling);
    ${"" /* im geöffneten Fall die anderen Abschnitte zuklappen */}
    [...r.querySelectorAll("dialog.settings .set-sec")].forEach((s) => { if (s !== clone) { s.classList.remove("open"); s.querySelector(".set-sec-body")?.remove(); } });`, { html, open: html !== "", sum: `${total} Timer auf ${D.length} Geräten · ${act} aktiv · nächster: heute 20:00` });
  await p.waitForTimeout(300);
  const f = await shot(p, mobile, name);
  await ctx.close();
  return f;
}

// Zustände (Handy): Karten ausserhalb der Reiter
const states = `<div class="tm-lab">Läuft (Countdown, einmalig)</div>
  <div class="tm-st"><div class="top"><div class="tm-ring"><svg viewBox="0 0 62 62"><circle class="bg" cx="31" cy="31" r="26"/><circle class="fg" cx="31" cy="31" r="26" stroke-dasharray="163.4" stroke-dashoffset="94.8"/></svg><span>12:34</span></div><div class="tm-t"><b>⏱️ Abschalten</b><small>Steckdose ausschalten · noch 12 Min. 34 Sek.</small></div>${sw(true)}</div><div class="btns"><span>+ 5 Min.</span><span>Jetzt ausführen</span><span class="dng">Abbrechen</span></div></div>
  <div class="tm-lab">Erledigt (einmalig, automatisch deaktiviert)</div>
  <div class="tm-st done"><div class="top"><span class="tm-ic off">🌅</span><div class="tm-t"><b>Test früh</b><small>Heute um 07:00 · Steckdose einschalten</small><small><span class="tm-tag grey">erledigt</span> · automatisch ausgeschaltet</small></div>${sw(false)}</div><div class="btns"><span class="pri">Erneut starten</span><span>Bearbeiten</span><span class="dng">Löschen</span></div></div>
  <div class="tm-lab">Fehler (Gerät nicht erreichbar)</div>
  <div class="tm-st err"><div class="top"><span class="tm-ic">🚿</span><div class="tm-t"><b>Bewässerung</b><small>Mo, Mi, Fr 06:30 · Steckdose einschalten</small><small><span class="err">Konnte nicht schalten</span>: Steckdose Terrasse war nicht erreichbar.</small><small>Neuer Versuch 06:35, 06:40, dann Meldung an Familie</small></div>${sw(true)}</div><div class="btns"><span class="pri">Jetzt erneut versuchen</span><span>Protokoll</span></div></div>
  <div class="tm-lab">Nach einem Neustart von Home Assistant</div>
  <div class="tm-st"><div class="top"><span class="tm-ic">🚿</span><div class="tm-t"><b>Bewässerung</b><small>Geplant 06:30 · Home Assistant lief nicht</small><small><span class="warn">Nachgeholt um 06:41</span> (innerhalb von 10 Min. nach dem Start). Später als 10 Min. wird übersprungen und im Protokoll vermerkt.</small></div></div></div>
  <div class="tm-lab">Geräteliste: Hinweis bei Geräten mit Timer</div>
  <div class="tm-st"><div class="top"><span class="tm-ic" style="background:var(--dp-subtle)">${svg("pulse", 16)}</span><div class="tm-t"><b>Steckdose Terrasse <span class="tm-rowhint">⏱ 4</span></b><small>Terrasse · online</small></div></div></div>
  <div class="tm-note">Optional: ein Chip "Mit Timer" in der Chip-Leiste (wie "Eigene Einstellung") und die kleine Marke "⏱ 4" beim Gerätenamen.</div>`;
async function statesShot(name) {
  const { ctx, p, ev } = await page(true, { css: CSS, width: 390, height: 1750, freeze: false });
  await ev(`r.querySelector('.dev[data-open="d"]').click()`); await p.waitForTimeout(700);
  await ev(`r.host._fetch = () => {}; r.host._renderDevice = () => {};
    const bar = r.querySelector("dialog.device .sub-tabs"); bar.querySelectorAll(".sub-tab").forEach((b) => { b.classList.remove("on"); b.setAttribute("aria-selected", "false"); });
    const t = document.createElement("button"); t.type = "button"; t.className = "sub-tab on"; t.setAttribute("role", "tab"); t.textContent = "Timer"; bar.insertBefore(t, bar.querySelector(".seg-pill"));
    r.querySelector("dialog.device .dlg-body").innerHTML = '<div class="mg-root"><h3>Timer: Zustände</h3>' + arg + '</div>';` + fixPills, states);
  await ev(`const d=r.querySelector("dialog.device"); d.style.height = "auto"; d.style.maxHeight = "none"; d.scrollTop = 0;`);
  const f = await shot(p, true, name);
  await ctx.close();
  return f;
}

// Reiterleiste mit fünf Reitern auf dem Handy
const TABS = ["Übersicht", "Einstellungen", "Entitäten · 2", "Magic Push", "Timer"];
const ICONS = ["📊", "⚙️", "🧩", "✨", "⏱️"];
async function tabsShot(name, mode) {
  const { ctx, p, ev } = await page(true, { css: CSS + `
    .tmx-scroll { display: flex; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; position: relative; -webkit-mask-image: linear-gradient(90deg, #000 86%, transparent); mask-image: linear-gradient(90deg, #000 86%, transparent); }
    .tmx-scroll .sub-tab { flex: none; padding: 0 16px; }
    .tmx-ico { display: flex; gap: 2px; }
    .tmx-ico .sub-tab { flex: 1 1 0; min-width: 0; padding: 0 6px; display: flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; }
    .tmx-ico .sub-tab.on { flex: 2.2 1 0; }
    .tmx-ico .sub-tab span { font-size: 17px; }
    .tmx-note { margin: 8px 16px 0; color: var(--dp-text2); font-size: 12.5px; }`, width: 390, height: 560, freeze: false });
  await ev(`r.querySelector('.dev[data-open="d"]').click()`); await p.waitForTimeout(700);
  await ev(`r.host._fetch = () => {}; r.host._renderDevice = () => {};
    const bar = r.querySelector("dialog.device .sub-tabs"); bar.querySelectorAll(".sub-tab").forEach((b) => b.remove()); bar.querySelector(".seg-pill")?.remove();
    const mode = arg.mode, tabs = arg.tabs, icons = arg.icons;
    bar.classList.toggle("tmx-scroll", mode === "scroll"); bar.classList.toggle("tmx-ico", mode === "icons");
    tabs.forEach((l, i) => { const b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "tab"); const on = i === (mode === "scroll" ? 2 : 4);
      b.className = "sub-tab" + (on ? " on" : "");
      b.innerHTML = mode === "icons" ? "<span>" + icons[i] + "</span>" + (on ? l.replace(" · 2", "") : "") : l; bar.appendChild(b); });
    const pill = document.createElement("i"); pill.className = "seg-pill"; bar.appendChild(pill);
    ${"" /* Kapsel unter den gewählten Reiter */}
    const on = bar.querySelector(".sub-tab.on"); pill.style.width = on.offsetWidth + "px"; pill.style.height = on.offsetHeight + "px"; pill.style.transform = "translate(" + on.offsetLeft + "px," + on.offsetTop + "px)";
    if (mode === "scroll") bar.scrollLeft = 0;
    r.querySelector("dialog.device .dlg-body").innerHTML = '<p class="tmx-note">' + arg.note + '</p>';`, { mode, tabs: TABS, icons: ICONS, note: { wrap: "Heute: der fünfte Reiter rutscht in eine zweite Zeile.", scroll: "Seitlich wischbar, rechts ein Auslauf; der gewählte Reiter scrollt ins Bild.", icons: "Symbol bei jedem Reiter, Beschriftung nur beim gewählten (nur auf dem Handy; Desktop bleibt Text)." }[mode] });
  if (mode === "wrap") await ev(`const bar = r.querySelector("dialog.device .sub-tabs"); const pill = bar.querySelector(".seg-pill"); const on = bar.querySelector(".sub-tab.on"); pill.style.width = on.offsetWidth + "px"; pill.style.height = on.offsetHeight + "px"; pill.style.transform = "translate(" + on.offsetLeft + "px," + on.offsetTop + "px)";`);
  const f = await shot(p, true, name);
  await ctx.close();
  return f;
}

const f = {};
f.A = await popupTab("m-A", "A", true);
f.B = await popupTab("m-B", "B", true);
f.dB = await popupTab("d-B", "B", false);
f.w1 = await wizard("m-w1", STEP1);
f.w2 = await wizard("m-w2", STEP2_REP);
f.w3 = await wizard("m-w3", STEP4);
f.mOff = await wizard("m-mOff", MSG_OFF);
f.mOn = await wizard("m-mOn", MSG_ON);
f.mTarget = await wizard("m-mTarget", MSG_TARGET);
f.wIn = await wizard("m-wIn", STEP2_IN);
f.wOnce = await wizard("m-wOnce", STEP2_ONCE);
f.wMon = await wizard("m-wMon", STEP2_MONTH);
f.sClosed = await settings("m-sClosed", "", true, { tall: 900 });
f.sOpen = await settings("m-sOpen", settingsBody(), true, { tall: 1900 });
f.sHit = await settings("m-sHit", `<p class="tm-intro">Alle Timer, nach Gerät. Neue legst du im Popup des Geräts an, im Reiter Timer.</p>${search("licht", `2 von ${total}`)}${segCounts("Alle", [total, act, total - act, 1])}<div class="tm-count"><span>2 Timer auf 2 Geräten</span><a>Alle einklappen</a></div>${devCard({ ...D[0], timers: [T.garden] }, true)}${devCard({ ...D[2], timers: [D[2].timers[0]] }, true)}`, true, { tall: 1500 });
f.sDesk = await settings("d-s", settingsBody(), false);
f.st = await statesShot("m-st");
f.t1 = await tabsShot("m-t1", "wrap");
f.t2 = await tabsShot("m-t2", "scroll");
f.t3 = await tabsShot("m-t3", "icons");

await compose("1-Reiter-Timer.png", [[f.A, "A: Karten wie Magic Push", 330], [f.B, "B: Wecker-Stil, Uhrzeit gross, Tage als Zeile (Empfehlung)", 330]]);
await compose("1b-Reiter-Desktop.png", [[f.dB, "B auf dem Desktop (Geräte-Popup, Reiter Timer): fünf Reiter passen in einer Zeile", 900]]);
await compose("7-Push.png", [[f.mOff, "Schritt 3: Meldung aus (Standard)", 300], [f.mOn, "Meldung an: Empfänger (Standard) und Vorschau", 300], [f.mTarget, "Empfänger wählen (Standard oder Gruppe, Dienst, Entität)", 300]]);
await compose("2-Assistent.png", [[f.w1, "Schritt 1: Was schalten (nur schaltbare Entitäten) und Aktion", 300], [f.w2, "Schritt 2: Wann, Wiederholt wöchentlich", 300], [f.w3, "Schritt 4: Name, Satz, Test, aktiv", 300]]);
await compose("3-Wann.png", [[f.wIn, "In 30 Min. (Countdown)", 300], [f.wOnce, "Einmal am Datum", 300], [f.wMon, "Wiederholt monatlich", 300]]);
await compose("4-Einstellungen-Handy.png", [[f.sClosed, "Neuer Abschnitt \"Timer\" (zu)", 300], [f.sOpen, "Aufgeklappt: Suche, Filter, nach Gerät", 300], [f.sHit, "Suche \"licht\" (2 von 7, Treffer aufgeklappt)", 300]]);
await compose("4b-Einstellungen-Desktop.png", [[f.sDesk, "Einstellungen auf dem Desktop", 1000]]);
await compose("5-Zustaende.png", [[f.st, "Läuft, erledigt, Fehler, Neustart, Geräteliste", 360]]);
await compose("6-Reiterleiste.png", [[f.t1, "1: Heute bei fünf Reitern: zwei Zeilen", 300], [f.t2, "2: Wischen mit Auslauf", 300], [f.t3, "3: Symbole, Beschriftung nur beim gewählten (Empfehlung Handy)", 300]]);
await close();
console.log("fertig");
