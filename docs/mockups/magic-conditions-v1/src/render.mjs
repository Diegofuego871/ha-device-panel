// Mockups magic-conditions-v1 (Wunsch des Nutzers, 2026-10-11): neue Seite im Magic-Push-Assistenten nach "Wann":
// weitere Bedingungen mit Und/Oder, mehrere möglich, die Seite lässt sich überspringen. Im echten Panel (Nachbau,
// erfundene Daten), Fenster wie in magic-push-dialog-v1. Schritt 3 von 6 "Bedingungen".
//   A: Bedingungskarten; "Bedingung hinzufügen" öffnet die Auswahl wie Schritt 1, danach die Bedingung (Reiterleiste, Wert)  <- Empfehlung
//   B: Karten mit eingebautem Editor; die Entität wählt man in der Karte aus einer Liste
//   C: Satz-Baukasten: die Meldung als Satz mit Bausteinen
//   M1-M3: Vorschlag des Nutzers (2026-10-11): alle Bedingungen auf der ersten Seite (Wert + Wann + Bedingungen in einem), danach "Wie lange?" mit Rückblick; 5 Schritte
//   AG / CG: gemischtes Und/Oder mit einer Ebene Gruppen (Klammern): A mit Gruppen-Kasten, C mit Klammern im Satz
// Aufruf: CHROMIUM_PATH=... node docs/mockups/magic-conditions-v1/src/render.mjs
import { setup } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8992, import.meta.url);

const CSS = `
.mgd { position: fixed; inset: 0; width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; background: transparent; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; color: var(--dp-text); }
.mgd::backdrop { background: rgba(0,0,0,.5); }
.mgd :focus, .mgd :focus-visible { outline: none; }
.mgd-win { position: relative; display: flex; flex-direction: column; min-height: 0; height: 100%; background: var(--dp-card); color: var(--dp-text); overflow: hidden; }
.mgd-head { flex: none; display: flex; align-items: center; gap: 10px; padding: 14px 12px 6px 16px; }
.mgd-head .t { flex: 1; min-width: 0; }
.mgd-head .t b { display: block; font-size: 17px; font-weight: 500; }
.mgd-head .t small { display: block; margin-top: 1px; color: var(--dp-text2); font-size: 12.5px; }
.mgd-x { flex: none; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; background: color-mix(in srgb, var(--dp-text) 8%, var(--dp-card)); font-size: 20px; line-height: 1; }
.mgd-prog { flex: none; padding: 0 16px 4px; }
.mgd-body { flex: 1 1 auto; min-height: 0; overflow: hidden; padding: 2px 16px 12px; }
.mgd-foot { flex: none; padding: 10px 16px 14px; border-top: 1px solid var(--dp-divider); background: var(--dp-card); }
.mgd-foot .mg-btns { margin-top: 0; }
.mgd-foot .skip { flex: 0 0 auto; padding: 0 14px; }
.mc-intro { margin: 2px 0 8px; color: var(--dp-text2); font-size: 13px; line-height: 1.4; }
.mc-seg { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 2px; padding: 3px; border-radius: 12px; background: color-mix(in srgb, var(--dp-text) 7%, var(--dp-card)); margin: 6px 0; }
.mc-seg span { display: grid; place-items: center; min-height: 36px; padding: 2px 6px; border-radius: 9px; color: color-mix(in srgb, var(--dp-text) 72%, transparent); font-size: 13px; text-align: center; line-height: 1.2; }
.mc-seg span.on { background: var(--dp-bg); color: var(--dp-primary); font-weight: 500; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dp-text) 7%, transparent); }
.mc-sum { margin: 10px 0 4px; padding: 10px 12px; border-radius: 12px; background: var(--dp-primary-soft); font-size: 13.5px; line-height: 1.45; }
.mc-sum b { font-weight: 600; } .mc-sum .op { color: var(--dp-primary); font-weight: 700; text-transform: uppercase; font-size: 12px; letter-spacing: .03em; }
.mc-card { margin-top: 8px; border-radius: 14px; background: var(--dp-subtle); overflow: hidden; }
.mc-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
.mc-ic { flex: none; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; background: var(--dp-primary-soft); font-size: 19px; }
.mc-t { flex: 1; min-width: 0; } .mc-t b { display: block; font-size: 14px; font-weight: 600; } .mc-t small { display: block; margin-top: 2px; color: var(--dp-text2); font-size: 12.5px; }
.mc-lock { color: var(--dp-text2); font-size: 11.5px; }
.mc-act { flex: none; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; color: var(--dp-text2); font-size: 16px; }
.mc-act.del { color: var(--dp-error); }
.mc-join { display: flex; align-items: center; gap: 8px; margin: 6px 0 -2px 18px; color: var(--dp-primary); font-size: 11.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.mc-join::before { content: ""; width: 2px; height: 14px; background: color-mix(in srgb, var(--dp-primary) 55%, transparent); border-radius: 1px; margin-right: 6px; }
.mc-add { display: flex; align-items: center; justify-content: center; gap: 8px; height: 46px; margin-top: 12px; border: 1.5px dashed color-mix(in srgb, var(--dp-primary) 55%, transparent); border-radius: 14px; color: var(--dp-primary); font-size: 14px; font-weight: 500; }
.mc-edit { padding: 2px 14px 14px; border-top: 1px solid var(--dp-divider); }
.mc-k { margin: 10px 0 2px; color: var(--dp-text2); font-size: 12px; }
.mc-step { display: grid; grid-template-columns: 1fr 1.6fr 1fr; align-items: center; height: 44px; border-radius: 12px; background: var(--dp-input, var(--dp-card)); text-align: center; font-size: 17px; font-weight: 600; margin-top: 4px; }
.mc-step span:first-child, .mc-step span:last-child { color: var(--dp-text2); font-weight: 400; }
.mc-val { margin-left: auto; text-align: right; font-size: 15px; font-weight: 600; white-space: nowrap; }
.mc-val small { display: block; color: var(--dp-text2); font-size: 11.5px; font-weight: 400; }
.mc-radio { flex: none; width: 22px; height: 22px; border: 2px solid var(--dp-divider); border-radius: 50%; }
.mc-radio.on { border: 7px solid var(--dp-primary); }
.mc-sel { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; padding: 0 12px; border: 1px solid var(--dp-divider); border-radius: 12px; background: var(--dp-input, var(--dp-card)); font-size: 14px; }
.mc-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 10px 0; }
.mc-chip { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 12px; border-radius: 99px; background: var(--dp-subtle); font-size: 13.5px; }
.mc-chip.sel { box-shadow: inset 0 0 0 1.5px var(--dp-primary); }
.mc-chip.op { background: var(--dp-primary-soft); color: var(--dp-primary); font-weight: 700; text-transform: uppercase; font-size: 12px; }
.mc-chip.add { background: none; border: 1.5px dashed color-mix(in srgb, var(--dp-primary) 55%, transparent); color: var(--dp-primary); }
.mc-note { margin: 8px 2px 0; color: var(--dp-text2); font-size: 12.5px; line-height: 1.4; }
.mc-group { margin-top: 8px; padding: 8px 8px 10px; border: 1.5px dashed color-mix(in srgb, var(--dp-primary) 50%, transparent); border-radius: 16px; }
.mc-ghead { display: flex; align-items: center; gap: 8px; padding: 0 4px 2px; color: var(--dp-text2); font-size: 12px; }
.mc-ghead > span:first-child { flex: 1; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; }
.mc-mini { display: grid; grid-auto-flow: column; gap: 2px; padding: 2px; border-radius: 9px; background: color-mix(in srgb, var(--dp-text) 7%, var(--dp-card)); }
.mc-mini span { padding: 4px 10px; border-radius: 7px; font-size: 12px; } .mc-mini span.on { background: var(--dp-bg); color: var(--dp-primary); font-weight: 500; }
.mc-addin { margin-top: 8px; text-align: center; color: var(--dp-primary); font-size: 13px; font-weight: 500; }
.mc-adds { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.mc-chip.par { background: none; font-size: 22px; padding: 0 2px; color: var(--dp-text2); min-height: 40px; }
.mc-tlr { display: grid; grid-template-columns: 104px 1fr; align-items: center; gap: 8px; margin: 6px 0; font-size: 12px; color: var(--dp-text2); }
.mc-tlr.tot { padding-top: 6px; border-top: 1px solid var(--dp-divider); color: var(--dp-text); }
.mc-tl { position: relative; height: 14px; border-radius: 5px; background: color-mix(in srgb, var(--dp-text) 10%, transparent); overflow: hidden; }
.mc-tl i { position: absolute; top: 0; bottom: 0; background: var(--dp-error); opacity: .75; }
.mc-scale { display: flex; justify-content: space-between; margin: 2px 0 0 112px; font-size: 11px; color: var(--dp-text2); }
.mc-big { margin: 4px 0 8px; font-size: 20px; font-weight: 600; line-height: 1.25; }
`;

const bars = (n, of = 6) => `<div class="mg-steps">${Array.from({ length: of }, (_, i) => `<span class="mg-stp${i < n ? " on" : ""}"></span>`).join("")}</div>`;
const head = (n, where, of = 6) => `<div class="mgd-head"><div class="t"><b>Neue Meldung</b><small>Klimasensor Keller</small></div><span class="mgd-x">×</span></div>
  <div class="mgd-prog"><div class="mg-stephead"><span>Schritt ${n} von ${of}</span><span>${where}</span></div>${bars(n, of)}</div>`;
const win = (n, where, body, foot, of = 6) => `<dialog class="mgd"><div class="mgd-win">${head(n, where, of)}<div class="mgd-body">${body}</div><div class="mgd-foot">${foot}</div></div></dialog>`;
const nav = (next, skip = false) => `<div class="mg-btns"><span class="dlg-btn">Zurück</span>${skip ? '<span class="dlg-btn skip">Überspringen</span>' : ""}<span class="dlg-btn primary">${next}</span></div>`;
const seg = (items, on) => `<div class="mc-seg">${items.map((l, i) => `<span class="${i === on ? "on" : ""}">${l}</span>`).join("")}</div>`;
const logic = (on = 0) => seg(["Alle müssen zutreffen (und)", "Eine genügt (oder)"], on);
const sum = (parts, op, tail = "für mindestens 10 Min.") => `<div class="mc-sum"><b>Melden, wenn</b> ${parts.join(` <span class="op">${op}</span> `)} <span style="opacity:.75">· ${tail}</span></div>`;
const first = `<div class="mc-card"><div class="mc-row"><span class="mc-ic">🌡️</span><div class="mc-t"><b>Temperatur</b><small>unter 12 °C</small></div><span class="mc-lock">aus Schritt 2</span></div></div>`;
const cond = (e, n, s, { open = false, edit = "" } = {}) => `<div class="mc-card"><div class="mc-row"><span class="mc-ic">${e}</span><div class="mc-t"><b>${n}</b><small>${s}</small></div><span class="mc-act">✎</span><span class="mc-act del">✕</span></div>${open ? `<div class="mc-edit">${edit}</div>` : ""}</div>`;
const join = (op) => `<div class="mc-join">${op}</div>`;
const ENT = [["🌡️", "Temperatur", "14,2 °C", "Sensor"], ["💧", "Luftfeuchtigkeit", "71 %", "Sensor"], ["🪟", "Fenster", "geschlossen", "Kontakt"], ["🔋", "Batterie", "86 %", "Diagnose"], ["📶", "Signal", "−72 dBm", "Diagnose"]];
const pick = (sel) => ENT.map(([e, n, v, k], i) => `<div class="mc-card"><div class="mc-row"><span class="mc-ic">${e}</span><div class="mc-t"><b>${n}</b><small>${k}</small></div><span class="mc-val">${v}</span><span class="mc-radio${i === sel ? " on" : ""}"></span></div></div>`).join("") + `<div class="mc-card" style="border:1.5px dashed color-mix(in srgb, var(--dp-primary) 45%, transparent);background:none"><div class="mc-row"><span class="mc-ic">🔎</span><div class="mc-t"><b>Freie Entität wählen</b><small>Eine beliebige Entität aus Home Assistant</small></div><span>▾</span></div></div>`;
const stateEdit = seg(["ist offen", "ist geschlossen"], 0);
const numEdit = `${seg(["über", "unter", "ist gleich"], 0)}<div class="mc-k">Schwelle · Einheit: %</div><div class="mc-step"><span>−</span><span>60</span><span>+</span></div>`;

const SCREENS = {
  // A: Karten, Auswahl wie Schritt 1
  "A1": win(3, "🌡️ Temperatur · Bedingungen", `<div class="mc-big">Soll noch etwas dazukommen?</div>
    <p class="mc-intro">Die Meldung kommt nur, wenn alle Bedingungen zutreffen (und) oder wenn eine genügt (oder). Diese Seite kannst du überspringen.</p>
    ${logic(0)}${sum(["🌡️ Temperatur unter 12 °C", "🪟 Fenster ist offen"], "und")}
    ${first}${join("und")}${cond("🪟", "Fenster", "ist offen · jetzt: geschlossen")}${join("und")}${cond("💧", "Luftfeuchtigkeit", "über 60 % · jetzt: 71 %")}
    <div class="mc-add">+ Bedingung hinzufügen</div>`, nav("Weiter")),
  "A2": win(3, "🌡️ Temperatur · Bedingungen", `<div class="mc-big">Welche Entität?</div>
    <p class="mc-intro">Wie in Schritt 1: ein Wert dieses Geräts oder eine freie Entität.</p>${pick(2)}`, `<div class="mg-btns"><span class="dlg-btn">Abbrechen</span><span class="dlg-btn primary">Weiter</span></div>`),
  "A3": win(3, "🌡️ Temperatur · Bedingungen", `<div class="mc-big">Wann gilt "Fenster"?</div>${stateEdit}
    <div class="mc-card"><div class="mc-row"><span class="mc-ic">🪟</span><div class="mc-t"><b>Fenster</b><small>jetzt: geschlossen</small></div></div></div>
    <p class="mc-note">Die Dauer ("für mindestens") gilt für alle Bedingungen zusammen und steht in Schritt 2.</p>`, `<div class="mg-btns"><span class="dlg-btn">Abbrechen</span><span class="dlg-btn primary">Übernehmen</span></div>`),
  "A0": win(3, "🌡️ Temperatur · Bedingungen", `<div class="mc-big">Soll noch etwas dazukommen?</div>
    <p class="mc-intro">Die Meldung kommt nur, wenn alle Bedingungen zutreffen (und) oder wenn eine genügt (oder). Diese Seite kannst du überspringen.</p>
    ${first}<div class="mc-add">+ Bedingung hinzufügen</div>`, nav("Überspringen")),
  // B: Karten mit eingebautem Editor
  "B1": win(3, "🌡️ Temperatur · Bedingungen", `<div class="mc-big">Soll noch etwas dazukommen?</div>${logic(1)}
    ${sum(["🌡️ Temperatur unter 12 °C", "🪟 Fenster ist offen"], "oder")}
    ${first}${join("oder")}${cond("🪟", "Fenster", "ist offen", { open: true, edit: `<div class="mc-k">Entität</div><div class="mc-sel"><span>🪟 Fenster</span><span>▾</span></div><div class="mc-k">Bedingung</div>${stateEdit}` })}${join("oder")}${cond("💧", "Luftfeuchtigkeit", "über 60 %")}
    <div class="mc-add">+ Weitere Bedingung</div>`, nav("Weiter")),
  // C: Satz-Baukasten
  "C1": win(3, "🌡️ Temperatur · Bedingungen", `<div class="mc-big">Soll noch etwas dazukommen?</div>
    <p class="mc-intro">Tippe auf einen Baustein, um ihn zu ändern.</p>
    <div class="mc-note" style="margin:0 0 4px">Melden, wenn</div>
    <div class="mc-chips"><span class="mc-chip">🌡️ Temperatur unter 12 °C</span><span class="mc-chip op">und ▾</span><span class="mc-chip sel">🪟 Fenster ist offen ✕</span><span class="mc-chip op">und ▾</span><span class="mc-chip">💧 Luftfeuchtigkeit über 60 % ✕</span><span class="mc-chip add">+ Bedingung</span></div>
    <div class="mc-card"><div class="mc-row" style="padding-bottom:4px"><span class="mc-ic">🪟</span><div class="mc-t"><b>Fenster bearbeiten</b><small>Entität wählen · Bedingung</small></div></div><div class="mc-edit" style="border-top:0">${stateEdit}</div></div>
    <p class="mc-note">"und/oder" gilt für alle Bausteine; ein Tipp wechselt.</p>`, nav("Weiter")),
  // Gemischtes Und/Oder: oben Und, darin eine Gruppe mit Oder (Temperatur UND (Fenster ODER Feuchte))
  "AG": win(3, "🌡️ Temperatur · Bedingungen", `<div class="mc-big">Soll noch etwas dazukommen?</div>
    ${seg(["Alle Teile müssen zutreffen (und)", "Ein Teil genügt (oder)"], 0)}
    <div class="mc-sum"><b>Melden, wenn</b> 🌡️ Temperatur unter 12 °C <span class="op">und</span> ( 🪟 Fenster ist offen <span class="op">oder</span> 💧 Luftfeuchtigkeit über 60 % ) <span style="opacity:.75">· für mindestens 10 Min.</span></div>
    ${first}${join("und")}
    <div class="mc-group"><div class="mc-ghead"><span>Gruppe</span><div class="mc-mini"><span>alle</span><span class="on">eine genügt</span></div><span class="mc-act del">✕</span></div>
      ${cond("🪟", "Fenster", "ist offen")}${join("oder")}${cond("💧", "Luftfeuchtigkeit", "über 60 %")}
      <div class="mc-addin">+ Bedingung in der Gruppe</div></div>
    <div class="mc-adds"><div class="mc-add" style="margin:0">+ Bedingung</div><div class="mc-add" style="margin:0">+ Gruppe</div></div>`, nav("Weiter")),
  "CG": win(3, "🌡️ Temperatur · Bedingungen", `<div class="mc-big">Soll noch etwas dazukommen?</div>
    <p class="mc-intro">Tippe auf einen Baustein, um ihn zu ändern. Klammern bilden Gruppen.</p>
    <div class="mc-note" style="margin:0 0 4px">Melden, wenn</div>
    <div class="mc-chips"><span class="mc-chip">🌡️ Temperatur unter 12 °C</span><span class="mc-chip op">und ▾</span><span class="mc-chip par">(</span><span class="mc-chip sel">🪟 Fenster ist offen ✕</span><span class="mc-chip op">oder ▾</span><span class="mc-chip">💧 Luftfeuchtigkeit über 60 % ✕</span><span class="mc-chip par">)</span><span class="mc-chip add">+ Bedingung</span><span class="mc-chip add">+ ( )</span></div>
    <div class="mc-card"><div class="mc-row" style="padding-bottom:4px"><span class="mc-ic">🪟</span><div class="mc-t"><b>Fenster bearbeiten</b><small>Entität wählen · Bedingung</small></div></div><div class="mc-edit" style="border-top:0">${stateEdit}</div></div>
    <p class="mc-note">"und" und "oder" sind je Verbindung wählbar; ohne Klammer gilt "und" vor "oder".</p>`, nav("Weiter")),
  // M: alle Bedingungen auf der ersten Seite, 5 Schritte (Bedingungen · Wie lange · Versand · Text · Name)
  "M0": win(1, "Bedingungen", `<div class="mc-big">Was soll überwacht werden?</div>
    <p class="mc-intro">Wähle den ersten Wert. Weitere Bedingungen (und/oder) kannst du danach hinzufügen.</p>${pick(0)}`, `<div class="mg-btns"><span class="dlg-btn">Abbrechen</span><span class="dlg-btn primary">Weiter</span></div>`, 5),
  "M1": win(1, "Bedingungen", `<div class="mc-big">Welche Bedingungen?</div>
    ${seg(["Alle Teile müssen zutreffen (und)", "Ein Teil genügt (oder)"], 0)}
    <div class="mc-sum"><b>Melden, wenn</b> 🌡️ Temperatur unter 12 °C <span class="op">und</span> ( 🪟 Fenster ist offen <span class="op">oder</span> 💧 Luftfeuchtigkeit über 60 % )</div>
    <div class="mc-card"><div class="mc-row"><span class="mc-ic">🌡️</span><div class="mc-t"><b>Temperatur</b><small>unter 12 °C · jetzt: 14,2 °C</small></div><span class="mc-act">▴</span></div>
      <div class="mc-edit">${seg(["über", "unter", "ist gleich", "ändert sich"], 1)}
      <svg viewBox="0 0 320 60" style="width:100%;height:60px;margin-top:6px" preserveAspectRatio="none"><path d="M0,18 C40,8 80,10 120,26 S180,50 210,46 S280,14 320,12" fill="none" stroke="var(--dp-primary)" stroke-width="2"/><line x1="0" x2="320" y1="40" y2="40" stroke="var(--dp-error)" stroke-width="1.5" stroke-dasharray="5 4"/></svg>
      <div class="mc-k">Schwelle · Einheit: °C</div><div class="mc-step"><span>−</span><span>12</span><span>+</span></div>
      <div class="mc-k">Zurücksetzen</div>${seg(["Automatisch", "Eigener Wert"], 0)}</div></div>
    ${join("und")}
    <div class="mc-group"><div class="mc-ghead"><span>Gruppe</span><div class="mc-mini"><span>alle</span><span class="on">eine genügt</span></div><span class="mc-act del">✕</span></div>
      ${cond("🪟", "Fenster", "ist offen")}${join("oder")}${cond("💧", "Luftfeuchtigkeit", "über 60 %")}
      <div class="mc-addin">+ Bedingung in der Gruppe</div></div>
    <div class="mc-adds"><div class="mc-add" style="margin:0">+ Bedingung</div><div class="mc-add" style="margin:0">+ Gruppe</div></div>`, nav("Weiter"), 5),
  "M2": win(2, "Wie lange", `<div class="mc-big">Wie lange muss das zutreffen?</div>
    ${seg(["Sofort", "1 Min.", "5 Min.", "10 Min.", "30 Min."], 3)}
    <div class="mc-k">Rückblick 24 Std.</div>
    <div class="mc-card" style="padding:10px 12px">
      <div class="mc-tlr"><span>🌡️ unter 12 °C</span><div class="mc-tl"><i style="left:30%;width:12%"></i><i style="left:62%;width:6%"></i></div></div>
      <div class="mc-tlr"><span>🪟 Fenster offen</span><div class="mc-tl"><i style="left:28%;width:16%"></i><i style="left:80%;width:10%"></i></div></div>
      <div class="mc-tlr"><span>💧 über 60 %</span><div class="mc-tl"><i style="left:5%;width:40%"></i><i style="left:55%;width:30%"></i></div></div>
      <div class="mc-tlr tot"><span><b>Zusammen</b></span><div class="mc-tl"><i style="left:30%;width:12%;background:var(--dp-primary)"></i><i style="left:62%;width:6%;background:var(--dp-primary);opacity:.4"></i></div></div>
      <div class="mc-scale"><span>vor 24 Std.</span><span>jetzt</span></div></div>
    <div class="mc-sum"><b>Rückblick</b> · wäre <b>1-mal</b> gekommen<br><span style="opacity:.8">gestern 04:12 · 38 Min. · Temperatur und Fenster zugleich</span></div>`, nav("Weiter"), 5),
};

const out = [];
async function one(name, html) {
  const { ctx, p, ev } = await page(true, { css: CSS, width: 390, height: 844, freeze: false });
  await ev(`const w = document.createElement("div"); w.innerHTML = arg; const d = w.firstElementChild; r.appendChild(d); d.showModal(); d.querySelector("button")?.blur();`, html);
  const f = await shot(p, true, name);
  await ctx.close();
  return f;
}
const f = {};
for (const [k, html] of Object.entries(SCREENS)) f[k] = await one(k, html);
await compose("1-Varianten.png", [[f.A1, "A: Karten, Hinzufügen wie Schritt 1 (Empfehlung)", 300], [f.B1, "B: Karten mit eingebautem Editor", 300], [f.C1, "C: Satz-Baukasten", 300]]);
await compose("2-A-Ablauf.png", [[f.A0, "A: leere Seite, \"Überspringen\"", 300], [f.A2, "A: Hinzufügen, Entität wählen", 300], [f.A3, "A: Bedingung festlegen", 300]]);
await compose("3-Kombinieren.png", [[f.AG, "A mit Gruppen: Temperatur UND (Fenster ODER Feuchte)", 330], [f.CG, "C mit Klammern im Satz", 330]]);
await compose("4-Eine-Seite.png", [[f.M0, "1 · ohne Bedingung: Auswahl wie bisher", 300], [f.M1, "1 · Bedingungen: alles auf einer Seite", 300], [f.M2, "2 · Wie lange, Rückblick je Bedingung und zusammen", 300]]);
await close();
console.log("fertig");
