// Mockups "Timer: Helligkeit und Farbe" (Wunsch des Nutzers, 2026-10-15): Beim Einschalten eines Lichts soll sich einstellen
// lassen, wie es leuchtet (Helligkeit, Farbtemperatur oder Farbe), einfach und mit Vorschau. Die Karte oben im Assistenten
// (Schritt 1) wird zum Bedienelement: antippen klappt die Einstellung auf, die Lampe in der Karte zeigt als Vorschau, wie es
// leuchten wird (nichts wird geschaltet). Ohne Einstellung bleibt es wie bisher ("wie zuletzt").
//   A (Empfehlung): grosse Vorschau-Lampe in der aufgeklappten Karte.
//   B: schlanke Karte, die Lampe links wird farbig, Regler direkt darunter.
// Im echten Panel (Nachbau aus tests/panel, erfundene Daten), Handy.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/timer-light-v1/src/render.mjs
import { setup, svg } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8971, import.meta.url);

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


const fixPills = `
  r.querySelectorAll(".sub-tabs").forEach((bar) => { const on = bar.querySelector(".sub-tab.on"), pill = bar.querySelector(".seg-pill"); if (!on || !pill) return;
    pill.style.width = on.offsetWidth + "px"; pill.style.height = on.offsetHeight + "px"; pill.style.transform = "translate(" + on.offsetLeft + "px," + on.offsetTop + "px)"; });`;


async function wizard(name, html) {
  const { ctx, p, ev } = await page(true, { css: CSS, width: 390, height: 844, freeze: false });
  await ev(`r.host._fetch = () => {}; const d = r.querySelector("dialog.magic-dlg"); d.innerHTML = arg; if (!d.open) d.showModal(); r.activeElement?.blur(); d.querySelector("button")?.blur();` + fixPills, html);
  const f = await shot(p, true, name);
  await ctx.close();
  return f;
}


// ---- Licht-Vorschau ---------------------------------------------------------------------------------------------
const LT_CSS = `
.lt-card { margin-top: 8px; border-radius: 16px; background: var(--dp-subtle); overflow: hidden; }
.lt-card.sel { box-shadow: inset 0 0 0 1.5px var(--dp-primary); }
.lt-top { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
.lt-bulb { flex: none; position: relative; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: color-mix(in srgb, var(--dp-text) 8%, var(--dp-card)); font-size: 22px; }
.lt-bulb::before { content: ""; position: absolute; inset: -9px; border-radius: 50%; background: radial-gradient(circle, var(--lt-c, transparent) 0%, transparent 68%); opacity: var(--lt-o, 0); }
.lt-bulb span { position: relative; filter: grayscale(var(--lt-g, 1)) brightness(var(--lt-b, .8)); }
.lt-bulb.on { background: color-mix(in srgb, var(--lt-c) 28%, var(--dp-card)); }
.lt-t { flex: 1; min-width: 0; }
.lt-t b { display: block; font-size: 15px; font-weight: 600; }
.lt-t small { display: block; margin-top: 2px; color: var(--dp-text2); font-size: 12.5px; line-height: 1.3; }
.lt-t .hint { color: var(--dp-primary); font-weight: 500; }
.lt-st { color: var(--dp-text2); font-size: 14px; font-weight: 600; }
.lt-radio { flex: none; width: 24px; height: 24px; border-radius: 50%; box-sizing: border-box; border: 2px solid var(--dp-text3); }
.lt-radio.on { border: 7px solid var(--dp-primary); }
.lt-set { padding: 4px 14px 14px; border-top: 1px solid var(--dp-divider); }
.lt-k { margin: 12px 0 6px; color: var(--dp-text2); font-size: 12.5px; display: flex; justify-content: space-between; }
.lt-k b { color: var(--dp-text); font-weight: 600; }
.lt-sl { position: relative; height: 34px; }
.lt-sl i.track { position: absolute; left: 0; right: 0; top: 13px; height: 8px; border-radius: 4px; background: color-mix(in srgb, var(--dp-text) 14%, transparent); }
.lt-sl i.fill { position: absolute; left: 0; top: 13px; height: 8px; border-radius: 4px; background: var(--dp-primary); }
.lt-sl i.kel { position: absolute; left: 0; right: 0; top: 13px; height: 8px; border-radius: 4px; background: linear-gradient(90deg, #ff8f2e, #ffd9a6 45%, #ffffff 65%, #bcd8ff); }
.lt-sl i.thumb { position: absolute; top: 5px; width: 24px; height: 24px; margin-left: -12px; border-radius: 50%; background: #fff; box-shadow: 0 1px 5px rgba(0,0,0,.45), 0 0 0 3px color-mix(in srgb, var(--dp-primary) 40%, transparent); }
.lt-ends { display: flex; justify-content: space-between; margin-top: -2px; color: var(--dp-text3); font-size: 11.5px; }
.lt-sw { display: flex; flex-wrap: wrap; gap: 9px; }
.lt-sw i { width: 34px; height: 34px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(255,255,255,.18); }
.lt-sw i.on { box-shadow: 0 0 0 2px var(--dp-card), 0 0 0 4px var(--dp-primary); }
.lt-sw i.more { display: grid; place-items: center; background: conic-gradient(#f44, #fd4, #4d4, #4df, #94f, #f44); position: relative; }
.lt-prev { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 0 6px; }
.lt-prev .big { position: relative; display: grid; place-items: center; width: 92px; height: 92px; border-radius: 50%; background: color-mix(in srgb, var(--lt-c) 22%, var(--dp-card)); font-size: 44px; }
.lt-prev .big::before { content: ""; position: absolute; inset: -22px; border-radius: 50%; background: radial-gradient(circle, var(--lt-c) 0%, transparent 66%); opacity: var(--lt-o); }
.lt-prev .big span { position: relative; filter: brightness(var(--lt-b)); }
.lt-prev b { font-size: 22px; font-weight: 600; margin-top: 8px; }
.lt-prev small { color: var(--dp-text2); font-size: 13px; }
.lt-note { margin: 10px 0 0; color: var(--dp-text2); font-size: 12px; line-height: 1.4; text-align: center; }
.lt-done { display: block; width: 100%; margin-top: 12px; padding: 11px; border: 0; border-radius: 12px; background: var(--dp-primary-soft); color: var(--dp-primary); font: inherit; font-weight: 600; text-align: center; box-sizing: border-box; }
.lt-chev { color: var(--dp-text3); font-size: 20px; }
`;
const WARM = ["#ffb45a", 0.45], NEUT = ["#ffe6c2", 0.5], COLD = ["#cfe3ff", 0.5];
const bulb = (c, o, b, on) => `<span class="lt-bulb${on ? " on" : ""}" style="--lt-c:${c};--lt-o:${o};--lt-g:${on ? 0 : 1};--lt-b:${b}"><span>💡</span></span>`;
const slider = (pct, kel) => `<div class="lt-sl">${kel ? `<i class="kel"></i>` : `<i class="track"></i><i class="fill" style="width:${pct}%"></i>`}<i class="thumb" style="left:${pct}%"></i></div>`;
const NAME = "Nachtisch Sandra Schlafzimmer", ID = "light.hue_ambiance_luster_1";
const dots = (cols, on) => `<div class="lt-sw">${cols.map((c, i) => `<i class="${i === on ? "on" : ""}" style="background:${c}"></i>`).join("")}<i class="more"></i></div>`;
const TABS = (items, on) => seg(items, on);

// A: zu, noch nichts eingestellt ("wie zuletzt")
const A_CLOSED = `<div class="lt-card sel"><div class="lt-top">${bulb("#ffb45a", 0, .8, false)}<div class="lt-t"><b>${NAME}</b><small>${ID}</small><small class="hint">Einstellen: Helligkeit und Farbe ›</small></div><span class="lt-st">aus</span><span class="lt-radio on"></span></div></div>`;
// A: aufgeklappt, Lampe nur mit Weiss (Hue Ambiance): Helligkeit und Farbtemperatur
const A_WHITE = `<div class="lt-card sel"><div class="lt-top">${bulb("#ffb45a", .55, 1, true)}<div class="lt-t"><b>${NAME}</b><small>${ID}</small></div><span class="lt-st">aus</span><span class="lt-radio on"></span></div>
  <div class="lt-set"><div class="lt-prev"><div class="big" style="--lt-c:#ffb45a;--lt-o:.55;--lt-b:1"><span>💡</span></div><b>40 %</b><small>warmweiss · 2700 K</small></div>
  <div class="lt-k">Helligkeit<b>40 %</b></div>${slider(40)}
  ${TABS(["Wie zuletzt", "25 %", "50 %", "100 %"], "")}
  <div class="lt-k">Farbtemperatur<b>2700 K</b></div>${slider(18, true)}<div class="lt-ends"><span>warm</span><span>kalt</span></div>
  <p class="lt-note">Vorschau: Es wird nichts geschaltet. Prüfen mit "Jetzt ausführen".</p><span class="lt-done">Fertig</span></div></div>`;
// A: aufgeklappt, Farblampe
const A_COLOUR = `<div class="lt-card sel"><div class="lt-top">${bulb("#4d8dff", .6, 1, true)}<div class="lt-t"><b>Sofalicht Wohnzimmer</b><small>light.hue_color_sofa</small></div><span class="lt-st">aus</span><span class="lt-radio on"></span></div>
  <div class="lt-set"><div class="lt-prev"><div class="big" style="--lt-c:#4d8dff;--lt-o:.6;--lt-b:.9"><span>💡</span></div><b>75 %</b><small>Blau</small></div>
  <div class="lt-k">Helligkeit<b>75 %</b></div>${slider(75)}
  <div class="lt-k">Farbe</div>${dots(["#ffb45a", "#ffe6c2", "#cfe3ff", "#ff4d4d", "#ff9a3c", "#3ddc84", "#4d8dff", "#a56bff"], 6)}
  <p class="lt-note">Vorschau: Es wird nichts geschaltet. Prüfen mit "Jetzt ausführen".</p><span class="lt-done">Fertig</span></div></div>`;
// A: zugeklappt mit Einstellung
const A_SUMMARY = `<div class="lt-card sel"><div class="lt-top">${bulb("#ffb45a", .5, 1, true)}<div class="lt-t"><b>${NAME}</b><small>${ID}</small><small class="hint">einschalten: 40 % · warmweiss (2700 K) ›</small></div><span class="lt-st">aus</span><span class="lt-radio on"></span></div></div>`;

// B: schlanke Karte, Lampe links wird farbig, Regler direkt darunter
const B_WHITE = `<div class="lt-card sel"><div class="lt-top">${bulb("#ffb45a", .55, 1, true)}<div class="lt-t"><b>${NAME}</b><small>40 % · warmweiss (2700 K)</small></div><span class="lt-st">aus</span><span class="lt-radio on"></span></div>
  <div class="lt-set"><div class="lt-k">Helligkeit<b>40 %</b></div>${slider(40)}<div class="lt-k">Farbtemperatur<b>2700 K</b></div>${slider(18, true)}<div class="lt-ends"><span>warm</span><span>kalt</span></div></div></div>`;
const B_COLOUR = `<div class="lt-card sel"><div class="lt-top">${bulb("#4d8dff", .6, .9, true)}<div class="lt-t"><b>Sofalicht Wohnzimmer</b><small>75 % · Blau</small></div><span class="lt-st">aus</span><span class="lt-radio on"></span></div>
  <div class="lt-set"><div class="lt-k">Helligkeit<b>75 %</b></div>${slider(75)}<div class="lt-k">Farbe</div>${dots(["#ffb45a", "#ffe6c2", "#cfe3ff", "#ff4d4d", "#ff9a3c", "#3ddc84", "#4d8dff", "#a56bff"], 6)}</div></div>`;
const B_SUMMARY = `<div class="lt-card sel"><div class="lt-top">${bulb("#ffb45a", .5, 1, true)}<div class="lt-t"><b>${NAME}</b><small>40 % · warmweiss (2700 K)</small></div><span class="lt-st">aus</span><span class="lt-radio on"></span></div></div>`;

const RES = (txt) => `<div class="mg-k">Aktion</div>${seg(["Einschalten", "Ausschalten", "Umschalten"], "Einschalten")}
  <div class="mg-k">Danach wieder zurückschalten (optional)</div>${seg(["Nie", "10 Min.", "30 Min.", "1 Std."], "30 Min.")}
  <div class="mg-own"><span>oder eigene Zeit</span><span class="mg-pill num mg-ownin">–</span><span class="mg-pill">Min. ▾</span></div>
  <div class="mg-note">Ergebnis: ${txt}</div><div class="mg-testrow"><button type="button" class="dlg-btn tm-try">Jetzt ausführen</button></div>`;
const STEP = (card, txt, withActions = true, sub = NAME) => wiz(1, "Was schalten", `<div class="mg-big">Was soll geschaltet werden?</div>${withActions ? `<p class="mg-note">Es werden nur schaltbare Entitäten dieses Geräts gezeigt.</p>` : ""}${card}${withActions ? RES(txt) : ""}`, { sub });

const f = {};
const shotStep = async (name, html) => {
  const { ctx, p, ev } = await page(true, { css: CSS + LT_CSS, width: 390, height: 844, freeze: false });
  await ev(`r.host._fetch = () => {}; const d = r.querySelector("dialog.magic-dlg"); d.innerHTML = arg; if (!d.open) d.showModal(); r.activeElement?.blur(); d.querySelector("button")?.blur();` + fixPills, html);
  const file = await shot(p, true, name);
  await ctx.close();
  return file;
};
f.a1 = await shotStep("a1", STEP(A_CLOSED, "Nachtisch Sandra Schlafzimmer einschalten, nach 30 Min. wieder ausschalten."));
f.a2 = await shotStep("a2", STEP(A_WHITE, "", false));
f.a3 = await shotStep("a3", STEP(A_COLOUR, "", false, "Sofalicht Wohnzimmer"));
f.a4 = await shotStep("a4", STEP(A_SUMMARY, "Nachtisch Sandra Schlafzimmer einschalten (40 %, warmweiss), nach 30 Min. wieder ausschalten."));
f.b2 = await shotStep("b2", STEP(B_WHITE, "", false));
f.b3 = await shotStep("b3", STEP(B_COLOUR, "", false, "Sofalicht Wohnzimmer"));
f.b4 = await shotStep("b4", STEP(B_SUMMARY, "Nachtisch Sandra Schlafzimmer einschalten (40 %, warmweiss), nach 30 Min. wieder ausschalten."));
await compose("1-Variante-A.png", [[f.a1, "1: Standard, nichts eingestellt: \"Einstellen: Helligkeit und Farbe\" in der Karte", 270], [f.a2, "2: Karte angetippt (Lampe nur mit Weiss): grosse Vorschau, Helligkeit, Farbtemperatur", 270], [f.a3, "3: Farblampe: Helligkeit und Farben", 270], [f.a4, "4: Zugeklappt: die Lampe leuchtet in der Karte, Satz und Ergebnis nennen die Einstellung", 270]]);
await compose("2-Variante-B.png", [[f.b2, "B: Lampe weiss, Karte bleibt schlank, die Lampe links leuchtet", 270], [f.b3, "B: Farblampe", 270], [f.b4, "B: Zugeklappt", 270]]);
await close();
console.log("fertig");
