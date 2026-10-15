// Mockups "Timer mit Auslöser" (Wunsch des Nutzers, 2026-10-15): Ein Timer soll statt zu einer Uhrzeit auch durch eine beliebige
// Entität ausgelöst werden können, wie bei Magic Push (Bedingungen mit Und/Oder), mit Zeitfenster, Mindestpause und Schutz vor
// Schleifen. Der Schritt "Wann" bekommt einen Umschalter "Zeit | Auslöser". Im echten Panel (Nachbau aus tests/panel, erfundene
// Daten), Handy; Gerät "Badwanne links" (Licht) mit Optionen, deshalb Schritt 3 von 6.
//   A (Empfehlung): Reiterleiste oben im Schritt "Wann"; Auslöser: Bedingungen, Zeitfenster und Pause als Abschnitte untereinander.
//   B: wie A, aber Zeitfenster und Pause eingeklappt unter "Einschränkungen" (kürzere Seite, aber verdeckt).
//   C: zwei grosse Karten statt Reiterleiste ("Zu einer Uhrzeit" / "Wenn etwas passiert").
// Aufruf: CHROMIUM_PATH=... node docs/mockups/timer-trigger-v1/src/render.mjs
import { setup, svg } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8972, import.meta.url);

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

// Auslöser-Inhalt (A)
const triggerA = (n) => {
  let s = `<p class="mg-note">Der Timer schaltet, sobald die Bedingung neu eintritt. Ist sie schon erfüllt, wenn du speicherst oder das Zeitfenster beginnt, passiert nichts.</p>`;
  s += `<div class="tg-sec">Wenn …</div>`;
  if (n === 1) {
    s += MOTION + add;
    s += `<div class="mg-sumline">${EQ}, wird <b>Badwanne links eingeschaltet (40 %, warmweiss)</b>.</div>`;
    s += `<div class="tg-sec">Nur in einem Zeitfenster<small>Ausserhalb passiert nichts. Wird die Bedingung ausserhalb erfüllt, wartet der Timer nicht auf später.</small></div>${sw(false, "Zeitfenster")}`;
    s += `<div class="tg-sec">Pause danach<small>So lange schaltet der Timer nach einem Auslösen nicht erneut.</small></div>${seg(["1 Min.", "5 Min.", "15 Min.", "1 Std."], "1 Min.", "", "pause")}`;
  } else {
    s += seg(["Alle (und)", "Eine davon (oder)"], "Alle (und)", "", "op") + `<div class="mg-sumline"><b>Wenn</b> Bewegung Bad Bewegung erkannt hat <b>und</b> Helligkeit Bad unter 20 lx ist.</div>`;
    s += MOTION + join("und") + LUX + add;
    s += `<div class="mg-k">Mindestens so lange erfüllt (optional)</div>${seg(["Sofort", "30 Sek.", "2 Min.", "10 Min."], "Sofort", "", "dauer")}`;
    s += `<div class="tg-sec">Nur in einem Zeitfenster<small>Auch über Mitternacht: 22:00 bis 06:00 gilt für die Nacht.</small></div>${sw(true, "Zeitfenster")}${timeRange("22:00", "06:00")}`;
    s += `<div class="tg-sec">Pause danach</div>${seg(["1 Min.", "5 Min.", "15 Min.", "1 Std."], "5 Min.", "", "pause")}`;
  }
  return s;
};
const stepA = (kind, n = 1) => wiz(3, "Wann", `${seg(["Zu einer Zeit", "Durch einen Auslöser"], kind === "time" ? "Zu einer Zeit" : "Durch einen Auslöser", "", "wann")}${kind === "time" ? TIME_BODY : triggerA(n)}`);

const TIME_BODY = `${seg(["Einmal in …", "Einmal", "Wiederholt"], "Wiederholt", "", "kind")}
  <div class="mg-k">Uhrzeit</div><input class="mg-input tm-timein" type="time" value="20:00">
  <div class="mg-k">Wiederholung</div>${seg(["Täglich", "Wöchentlich", "Monatlich"], "Täglich", "", "rep")}
  <p class="mg-hint">Die Uhrzeit gilt in der Zeitzone von Home Assistant.</p>`;

// B: Einschränkungen eingeklappt
const foldB = (open) => `<div class="tg-fold"><div><b>Einschränkungen</b><small>${open ? "Zeitfenster und Pause" : "Zeitfenster aus · Pause 1 Min."}</small></div><span class="chev">${svg(open ? "chevDown" : "chevron", 22)}</span></div>`;
const stepB = (open) => wiz(3, "Wann", `${seg(["Zu einer Zeit", "Durch einen Auslöser"], "Durch einen Auslöser", "", "wann")}
  <p class="mg-note">Der Timer schaltet, sobald die Bedingung neu eintritt, nicht wenn sie schon erfüllt ist.</p>
  <div class="tg-sec">Wenn …</div>${MOTION}${join("und")}${LUX}${add}
  <div class="mg-sumline"><b>Wenn</b> Bewegung Bad Bewegung erkannt hat <b>und</b> Helligkeit Bad unter 20 lx ist${open ? ", zwischen 22:00 und 06:00" : ""}.</div>
  ${foldB(open)}${open ? `<div style="padding:0 2px">${sw(true, "Nur in einem Zeitfenster")}${timeRange("22:00", "06:00")}<div class="mg-k">Pause danach</div>${seg(["1 Min.", "5 Min.", "15 Min.", "1 Std."], "5 Min.", "", "pause")}</div>` : ""}`);

// C: grosse Karten
const stepC = (kind) => wiz(3, "Wann", `
  <div class="tg-card${kind === "time" ? " on" : ""}"><span class="ic">⏰</span><div><b>Zu einer Uhrzeit</b><small>einmal, in X Minuten oder wiederholt</small></div><span class="tg-radio${kind === "time" ? " on" : ""}"></span></div>
  <div class="tg-card${kind === "trig" ? " on" : ""}"><span class="ic">⚡</span><div><b>Wenn etwas passiert</b><small>eine Entität erreicht einen Zustand</small></div><span class="tg-radio${kind === "trig" ? " on" : ""}"></span></div>
  ${kind === "time" ? `<div class="tg-sec">Wann</div>${TIME_BODY}` : `${triggerA(2).replace(/<p class="mg-note">.*?<\/p>/, "")}`}`);

// Übrige Schritte für A: Zusammenfassung und Liste
const SUM = wiz(5, "Name und Prüfung", `<label class="mg-k">Name</label><input class="mg-input" type="text" placeholder="Badwanne links" value="Licht bei Bewegung">
  <p class="mg-hint">Leer lassen, dann heisst der Timer wie die Entität.</p>
  <div class="tm-sum"><b>Bei Bewegung (nachts)</b>: Badwanne links einschalten (40 %, warmweiss), nach 10 Min. wieder wie vorher.<br><small>Wenn Bewegung Bad Bewegung erkannt hat und Helligkeit Bad unter 20 lx ist, zwischen 22:00 und 06:00. Pause 5 Min.</small></div>
  <div class="mg-k">Nächste Ausführung</div><div class="tm-next"><div><span>Wartet auf den Auslöser</span><span>Pause: keine</span></div></div>
  ${sw(true, "Timer eingeschaltet", "Schaltet, sobald der Auslöser eintritt.")}`, { next: "Speichern", q: "Name und Prüfung", quick: false });
const LIST = `<div class="mg-root"><h3>Timer</h3>
  <div class="tg-list"><b>Licht bei Bewegung</b><small>Bei Bewegung · 22:00 bis 06:00 · Badwanne links einschalten (40 %, warmweiss), nach 10 Min. wieder wie vorher</small><small>🔔 Push an Dani iPhone</small><small><span class="st">wartet auf Auslöser</span> · zuletzt ausgelöst: gestern 23:41</small></div>
  <div class="tg-list"><b>Gartenlicht</b><small>Täglich um 20:00 · Steckdose einschalten, nach 3 Std. 30 Min. wieder aus</small><small>nächster Lauf: <span class="st">heute 20:00</span></small></div></div>`;

const fixPills = `
  r.querySelectorAll(".sub-tabs").forEach((bar) => { const on = bar.querySelector(".sub-tab.on"), pill = bar.querySelector(".seg-pill"); if (!on || !pill) return;
    pill.style.width = on.offsetWidth + "px"; pill.style.height = on.offsetHeight + "px"; pill.style.transform = "translate(" + on.offsetLeft + "px," + on.offsetTop + "px)"; });`;
const shotStep = async (name, html, scroll = 0) => {
  const { ctx, p, ev } = await page(true, { css: CSS, width: 390, height: 844, freeze: false });
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
f.a1 = await shotStep("a1", stepA("time"));
f.a2 = await shotStep("a2", stepA("trig", 1));
f.a3 = await shotStep("a3", stepA("trig", 2));
f.a4 = await shotStep("a4", stepA("trig", 2), 700);
f.a5 = await shotStep("a5", SUM);
f.a6 = await listShot("a6");
f.b1 = await shotStep("b1", stepB(false));
f.b2 = await shotStep("b2", stepB(true), 400);
f.c1 = await shotStep("c1", stepC("time"));
f.c2 = await shotStep("c2", stepC("trig"));
await compose("1-Variante-A.png", [[f.a1, "1: Schritt \"Wann\", Umschalter auf \"Zu einer Zeit\": wie bisher", 270], [f.a2, "2: \"Durch einen Auslöser\", eine Bedingung, Zeitfenster aus", 270], [f.a3, "3: zwei Bedingungen (und), oben", 270], [f.a4, "4: dieselbe Seite weiter unten: Dauer, Zeitfenster, Pause", 270]]);
await compose("2-Variante-A-Ende.png", [[f.a5, "5: Name und Prüfung mit Satz und \"Wartet auf den Auslöser\"", 270], [f.a6, "6: Liste: Zeile \"Bei Bewegung · 22:00 bis 06:00\", \"wartet auf Auslöser\"", 270]]);
await compose("3-Variante-B-C.png", [[f.b1, "B: Zeitfenster und Pause eingeklappt (\"Einschränkungen\")", 270], [f.b2, "B: aufgeklappt", 270], [f.c1, "C: zwei grosse Karten statt Reiterleiste: Zeit", 270], [f.c2, "C: Auslöser", 270]]);
await close();
console.log("fertig");
