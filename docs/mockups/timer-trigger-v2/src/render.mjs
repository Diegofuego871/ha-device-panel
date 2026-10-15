// Mockups Timer mit Auslöser, Teil 2 (2026-10-15): Zurückschalten auch durch Zeit oder Auslöser; beliebig kombinierbar.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/timer-trigger-v2/src/render.mjs
import { setup, svg } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8973, import.meta.url);

const CSS = `
.tg-note { margin: 8px 0 0; color: var(--dp-text2); font-size: 12.5px; line-height: 1.4; }
.tg-sec { margin: 18px 0 2px; font-size: 14px; font-weight: 600; }
.tg-sec small { display: block; margin-top: 2px; color: var(--dp-text2); font-size: 12.5px; font-weight: 400; line-height: 1.35; }
.tg-range { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
.tg-range .mg-input { width: 120px; }
.tg-range span { color: var(--dp-text2); font-size: 13px; }
.tg-lock { display: inline-flex; align-items: center; gap: 4px; margin-left: 6px; padding: 1px 8px; border-radius: 99px; background: var(--dp-subtle); color: var(--dp-text2); font-size: 11.5px; }
.tg-card { margin-top: 8px; padding: 14px; border-radius: 16px; background: var(--dp-subtle); display: flex; align-items: center; gap: 12px; }
.tg-card.on { box-shadow: inset 0 0 0 1.5px var(--dp-primary); background: var(--dp-primary-soft); }
.tg-card .ic { flex: none; display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; background: color-mix(in srgb, var(--dp-text) 8%, var(--dp-card)); font-size: 20px; }
.tg-card b { display: block; font-size: 15px; font-weight: 600; }
.tg-card small { display: block; margin-top: 2px; color: var(--dp-text2); font-size: 12.5px; }
.tg-radio { margin-left: auto; flex: none; width: 24px; height: 24px; border-radius: 50%; box-sizing: border-box; border: 2px solid var(--dp-text3); }
.tg-radio.on { border: 7px solid var(--dp-primary); }
.tg-list { margin-top: 8px; border-radius: 16px; background: var(--dp-subtle); padding: 12px 14px; }
.tg-list b { font-size: 15px; font-weight: 600; }
.tg-list small { display: block; margin-top: 3px; color: var(--dp-text2); font-size: 12.5px; line-height: 1.4; }
.tg-list .st { color: var(--dp-primary); font-weight: 500; }
.tg-fold { display: flex; align-items: center; gap: 10px; margin-top: 16px; padding: 12px 14px; border-radius: 14px; background: var(--dp-subtle); }
.tg-fold b { font-size: 14px; font-weight: 600; } .tg-fold small { display: block; margin-top: 2px; color: var(--dp-text2); font-size: 12.5px; }
.tg-fold .chev { margin-left: auto; color: var(--dp-text2); }
`;

const STEPS = 6;
const wiz = (step, label, body, { next = "Weiter", back = "Zurück", sub = "Badwanne links", q = "Wann soll geschaltet werden?", quick = true } = {}) => `<div class="mgw-head"><div class="mgw-t"><b>Neuer Timer</b><small>${sub}</small></div>
  <button type="button" class="dlg-close" aria-label="Schliessen">${svg("close", 18)}</button></div>
  <div class="mgw-prog"><div class="mg-stephead"><span>Schritt ${step} von ${STEPS}</span><span>${label}</span></div>
  <div class="mg-steps">${Array.from({ length: STEPS }, (_, i) => `<span class="mg-stp${i + 1 <= step ? " on" : ""}"></span>`).join("")}</div></div>
  <div class="mgw-body"><div class="mgw-main"><div class="mg-big">${q}</div>${body}</div></div>
  <div class="mgw-foot"><div class="mg-btns"><button type="button" class="dlg-btn">${back}</button>${quick ? '<button type="button" class="dlg-btn quick">Speichern</button>' : ""}<button type="button" class="dlg-btn primary">${next}</button></div></div>`;
const seg = (items, on, cls = "", group = "") => `<div class="sub-tabs mg-tabs ${cls}" role="radiogroup">${items.map((l) => `<button type="button" role="radio" class="sub-tab${l === on ? " on" : ""}" aria-checked="${l === on}" data-group="${group}">${l}</button>`).join("")}<i class="seg-pill" aria-hidden="true"></i></div>`;
const sw = (on, label, note = "") => `<div class="mg-optrow"><div>${label}${note ? `<small>${note}</small>` : ""}</div><label class="switch"><input type="checkbox"${on ? " checked" : ""}><span></span></label></div>`;
const chev = `<span class="mg-lchev" aria-hidden="true">${svg("chevDown", 24)}</span>`;
const leaf = (emoji, name, sub, open = false, editor = "") => `<div class="mg-lcard${open ? " open" : ""}"><div class="mg-lhead"><button type="button" class="mg-lmain"><span class="mg-ic" aria-hidden="true">${emoji}</span><span class="mg-t"><b>${name}</b><small>${sub}</small></span>${chev}</button><button type="button" class="mg-xbtn" aria-label="Entfernen">${svg("close", 22)}</button></div>${editor}</div>`;
const join = (w) => `<div class="mg-join">${w}</div>`;
const add = `<div class="mg-adds"><button type="button" class="mg-add">＋ Bedingung hinzufügen</button></div>`;
const timeRange = (from, to) => `<div class="tg-range"><input class="mg-input tm-timein" type="time" value="${from}"><span>bis</span><input class="mg-input tm-timein" type="time" value="${to}"></div>`;

const MOTION = leaf("🏃", "Bewegung Bad", "ist Bewegung erkannt · jetzt: keine Bewegung");
const LUX = leaf("☀️", "Helligkeit Bad", "unter 20 lx · jetzt: 12 lx");
const EQ = `Wenn <b>Bewegung Bad</b> Bewegung erkannt hat`;


const MOTION_OFF = leaf("🏃", "Bewegung Bad", "ist keine Bewegung · jetzt: keine Bewegung");
const DOOR = leaf("🚪", "Terrassentür", "ist offen · jetzt: zu");
const DAUER = (v) => `<div class="mg-k">Mindestens so lange erfüllt (optional)</div>${seg(["Sofort", "30 Sek.", "2 Min.", "5 Min."], v, "", "dauer")}`;
const MAXH = (on, v = "2 Std.") => `<div class="tg-sec">Spätestens nach<small>Sicherung: Kommt der Auslöser nie, wird trotzdem zurückgeschaltet.</small></div>${sw(on, "Spätestens zurückschalten")}${on ? seg(["30 Min.", "1 Std.", "2 Std.", "6 Std."], v, "", "max") : ""}`;
const MODE = (v) => `<div class="mg-k">Danach zurück auf</div>${seg(["Ausschalten", "Wie vorher"], v, "", "mode")}`;
const BACK = (kind, extra = "") => seg(["Nie", "Nach Dauer", "Zu einer Zeit", "Durch Auslöser"], kind, "mg-four", "zurueck") + extra;

// Neue Seite "Zurückschalten" (Schritt 4 von 7)
const wizB = (body, o = {}) => wiz(4, "Zurückschalten", body, { q: "Soll wieder zurückgeschaltet werden?", ...o }).replaceAll("von 6", "von 7").replace(/<span class="mg-stp"><\/span><\/div>/, '<span class="mg-stp"></span><span class="mg-stp"></span></div>');
const pageNie = () => wizB(BACK("Nie", `<p class="mg-note">Der Timer schaltet nur ein und lässt es so.</p>`));
const pageDauer = () => wizB(BACK("Nach Dauer", `<div class="mg-k">Nach</div>${seg(["10 Min.", "30 Min.", "1 Std.", "3 Std."], "30 Min.", "", "dauer2")}<div class="mg-own"><span>oder eigene Zeit</span><span class="mg-pill num mg-ownin">–</span><span class="mg-pill">Min. ▾</span></div>${MODE("Wie vorher")}<div class="mg-sumline">Nach <b>30 Min.</b> wieder <b>wie vorher</b>.</div>`));
const pageZeit = () => wizB(BACK("Zu einer Zeit", `<div class="mg-k">Uhrzeit</div><input class="mg-input tm-timein" type="time" value="23:30"><p class="mg-hint">Die nächste Uhrzeit nach dem Einschalten: Schaltet der Timer um 20:00 ein, ist es heute 23:30; um 23:45 morgen 23:30.</p>${MODE("Ausschalten")}<div class="mg-sumline">Um <b>23:30</b> wieder <b>ausgeschaltet</b>.</div>`));
const pageAusl = () => wizB(BACK("Durch Auslöser", `<p class="mg-note">Zurückgeschaltet wird, sobald die Bedingung neu eintritt. Ist sie beim Einschalten schon erfüllt, wartet der Timer auf das nächste Eintreten. Das Zeitfenster gilt nur für das Einschalten, nicht für das Zurückschalten.</p>
  <div class="tg-sec">Zurück, wenn …</div>${MOTION_OFF}${add}${DAUER("5 Min.")}<div class="mg-sumline">Wenn <b>Bewegung Bad</b> keine Bewegung meldet, mindestens <b>5 Min.</b> lang.</div>${MAXH(true)}${MODE("Wie vorher")}`));
const pageCombo = () => wizB(BACK("Durch Auslöser", `<p class="mg-note">Eingeschaltet wurde zu einer Uhrzeit (20:00). Zurückgeschaltet wird durch eine Entität.</p>
  <div class="tg-sec">Zurück, wenn …</div>${DOOR}${add}<div class="mg-sumline">Wenn <b>Terrassentür</b> offen ist.</div>${MAXH(true, "6 Std.")}${MODE("Ausschalten")}`));

// B: Rückstellung bleibt in Schritt 1 (Was schalten), unter der Aktion
const pageStep1 = () => wiz(1, "Was schalten", `<p class="mg-note">Es werden nur schaltbare Entitäten dieses Geräts gezeigt.</p>
  <button type="button" class="mg-card mg-pick" role="radio" aria-checked="true"><span class="mg-row"><span class="mg-ic">💡</span><span class="mg-t"><b>Badwanne links</b><small>light.badwanne_links</small></span><span class="mg-val">aus</span><span class="mg-radio on"></span></span></button>
  <div class="mg-k">Aktion</div>${seg(["Einschalten", "Ausschalten", "Umschalten"], "Einschalten", "", "akt")}
  <div class="mg-k">Danach zurückschalten</div>${seg(["Nie", "Dauer", "Zeit", "Auslöser"], "Auslöser", "", "zurueck")}
  <div class="tg-sec">Zurück, wenn …</div>${MOTION_OFF}${add}${DAUER("5 Min.")}${MAXH(true)}${MODE("Wie vorher")}`, { q: "Was soll geschaltet werden?" }).replaceAll("von 6", "von 6");

// Satz in der Prüfung und Liste
const SUM = wiz(6, "Name und Prüfung", `<label class="mg-k">Name</label><input class="mg-input" type="text" value="Licht bei Bewegung">
  <div class="tm-sum"><b>Bei Bewegung (nachts)</b>: Badwanne links einschalten (40 %, warmweiss); aus, wenn Bewegung Bad 5 Min. keine Bewegung meldet (spätestens nach 2 Std.), danach wie vorher.<br><small>Einschalten: Bewegung Bad erkannt und Helligkeit Bad unter 20 lx, zwischen 22:00 und 06:00. Pause 5 Min.</small></div>
  <div class="mg-k">Zustand</div><div class="tm-next"><div><span>Wartet auf den Auslöser</span><span>noch nicht eingeschaltet</span></div></div>`, { next: "Speichern", q: "Name und Prüfung", quick: false }).replaceAll("von 6", "von 7");
const LIST = `<div class="mg-root"><h3>Timer</h3>
  <div class="tg-list"><b>Licht bei Bewegung</b><small>Bei Bewegung · 22:00 bis 06:00 · Badwanne links einschalten (40 %, warmweiss), aus nach 5 Min. ohne Bewegung (spätestens 2 Std.), wie vorher</small><small><span class="st">ist eingeschaltet · wartet auf: keine Bewegung (seit 4 Min.)</span> · spätestens 00:41</small></div>
  <div class="tg-list"><b>Terrasse abends</b><small>Täglich um 20:00 · Steckdose einschalten, aus wenn Terrassentür offen (spätestens nach 6 Std.)</small><small>nächster Lauf: <span class="st">heute 20:00</span></small></div></div>`;

const fixPills = `
  r.querySelectorAll(".sub-tabs").forEach((bar) => { const on = bar.querySelector(".sub-tab.on"), pill = bar.querySelector(".seg-pill"); if (!on || !pill) return;
    pill.style.width = on.offsetWidth + "px"; pill.style.height = on.offsetHeight + "px"; pill.style.transform = "translate(" + on.offsetLeft + "px," + on.offsetTop + "px)"; });`;
const shotStep = async (name, html, scroll = 0) => {
  const { ctx, p, ev } = await page(true, { css: CSS + ".mg-four { grid-template-columns: repeat(2, minmax(0, 1fr)); }", width: 390, height: 844, freeze: false });
  await ev(`r.host._fetch = () => {}; const d = r.querySelector("dialog.magic-dlg"); d.innerHTML = arg; if (!d.open) d.showModal(); r.activeElement?.blur(); d.querySelector("button")?.blur(); for (const m of d.querySelectorAll(".mgw-body, .mgw-main")) m.scrollTop = ${scroll};` + fixPills, html);
  const file = await shot(p, true, name);
  await ctx.close();
  return file;
};
const listShot = async (name) => {
  const { ctx, p, ev } = await page(true, { css: CSS, width: 390, height: 844, freeze: false });
  await ev(`r.host._fetch = () => {}; const d = r.querySelector("dialog.magic-dlg"); d.innerHTML = '<div class="mgw-head"><div class="mgw-t"><b>Timer</b><small>Badwanne links</small></div></div><div class="mgw-body"><div class="mgw-main">' + arg + '</div></div>'; if (!d.open) d.showModal(); r.activeElement?.blur();` + fixPills, LIST);
  const file = await shot(p, true, name);
  await ctx.close();
  return file;
};
const f = {};
f.a1 = await shotStep("a1", pageNie());
f.a2 = await shotStep("a2", pageDauer());
f.a3 = await shotStep("a3", pageZeit());
f.a4 = await shotStep("a4", pageAusl());
f.a5 = await shotStep("a5", pageAusl(), 600);
f.a6 = await shotStep("a6", pageCombo());
f.a7 = await shotStep("a7", SUM);
f.a8 = await listShot("a8");
f.b1 = await shotStep("b1", pageStep1());
f.b2 = await shotStep("b2", pageStep1(), 700);
await compose("1-Seite-Zurueckschalten.png", [[f.a1, "A, Schritt 4: \"Nie\" (Standard)", 270], [f.a2, "A: nach Dauer, mit \"Wie vorher\"", 270], [f.a3, "A: zu einer Zeit (nächste Uhrzeit nach dem Einschalten)", 270], [f.a4, "A: durch Auslöser (Bewegung Bad: keine Bewegung, 5 Min.)", 270]]);
await compose("2-Auslöser-Kombinationen.png", [[f.a5, "A: Auslöser weiter unten: \"Spätestens nach\", Zurück auf", 270], [f.a6, "A: Zeit \u2192 Auslöser: 20:00 ein, aus wenn die Terrassentür offen ist", 270], [f.a7, "A: Name und Prüfung mit Satz", 270], [f.a8, "A: Liste: \"ist eingeschaltet · wartet auf\"", 270]]);
await compose("3-Variante-B.png", [[f.b1, "B: wie bisher in Schritt 1, Reiterleiste \"Nie / Dauer / Zeit / Auslöser\"", 270], [f.b2, "B: dieselbe Seite weiter unten (lang)", 270]]);
await close();
console.log("fertig");
