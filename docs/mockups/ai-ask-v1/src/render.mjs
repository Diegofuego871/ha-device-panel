// Mockups "Rückfrage zur KI-Einschätzung" (Wunsch des Nutzers, 2026-10-15): Nach einer Einschätzung soll man der
// KI eine Rückfrage zum selben Gerät stellen können, ohne die Einschätzung neu zu starten.
//   A: Fragen als Chips unter der Einschätzung, dazu "Eigene Frage" (Empfehlung).
//   B: Freies Textfeld wie ein Chat, Frage und Antwort als Verlauf.
//   C: Ein Knopf "Nachfragen" öffnet ein eigenes Fenster mit Verlauf und Eingabe.
// Im echten Panel (Nachbau aus tests/panel, erfundene Daten), Zusätze eingesetzt.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/ai-ask-v1/src/render.mjs
import { setup, svg } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8967, import.meta.url);

const SEND = "M2,21L23,12L2,3V10L17,12L2,14V21Z";
const CHAT = "M20,2H4A2,2 0 0,0 2,4V22L6,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2Z";
const CSS = `
.mk-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 2px; }
.mk-chips button { height: 34px; padding: 0 13px; border-radius: 999px; border: 1px solid color-mix(in srgb, #7c4dff 40%, var(--dp-divider)); background: color-mix(in srgb, #7c4dff 8%, transparent); color: var(--dp-text); font: inherit; font-size: 13.5px; }
.mk-chips button.own { border-style: dashed; color: var(--dp-text2); }
.mk-lbl { margin: 6px 0 -2px; color: var(--dp-text2); font-size: 12px; letter-spacing: .04em; text-transform: uppercase; }
.mk-in { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
.mk-in .f { flex: 1; height: 42px; display: flex; align-items: center; padding: 0 14px; border-radius: 999px; border: 1px solid var(--dp-divider); background: var(--dp-card); color: var(--dp-text3); font-size: 14.5px; }
.mk-in .s { width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; background: #7c4dff; color: #fff; }
.mk-q { align-self: flex-end; max-width: 82%; padding: 9px 13px; border-radius: 16px 16px 4px 16px; background: color-mix(in srgb, var(--dp-primary) 22%, var(--dp-card)); font-size: 14px; }
.mk-a { align-self: flex-start; max-width: 92%; padding: 10px 13px; border-radius: 16px 16px 16px 4px; border: 1px solid color-mix(in srgb, #7c4dff 28%, var(--dp-divider)); background: color-mix(in srgb, #7c4dff 7%, var(--dp-card)); font-size: 14px; line-height: 1.45; }
.mk-thread { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
.mk-left { margin-top: 6px; color: var(--dp-text2); font-size: 12px; }
.mk-go { align-self: flex-start; }
`;
const chip = (t, cls = "") => `<button class="${cls}">${t}</button>`;
const A = `<div class="mk-lbl">Nachfragen</div><div class="mk-chips">${chip("Was zuerst prüfen?")}${chip("Ist es die Batterie?")}${chip("Warum nachts?")}${chip("Eigene Frage …", "own")}</div><div class="mk-left">Noch 3 Fragen zu dieser Einschätzung</div>`;
const B = `<div class="mk-thread"><div class="mk-q">Warum fällt es immer nachts aus?</div><div class="mk-a">Die Ausfälle liegen alle zwischen 02:50 und 03:10 Uhr. Das spricht für einen nächtlichen Vorgang im Netz, nicht für das Gerät: Router-Neustart oder Update des Zigbee-Koordinators. Prüfe, ob der Router um 03:00 neu startet.</div></div><div class="mk-in"><span class="f">Frage stellen …</span><span class="s">${svg2(SEND)}</span></div><div class="mk-left">Noch 2 Fragen zu dieser Einschätzung</div>`;
function svg2(p) { return `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="${p}"/></svg>`; }
const C = `<button type="button" class="qbtn ai-btn mk-go">${svg2(CHAT)}Nachfragen …</button>`;

const TEXT = "Router oder Funkstrecke prüfen\n\nDas Gerät fiel in 24 Stunden fünfmal kurz aus, immer nachts. Der Empfang ist mit -91 dBm schwach, die Batterie ist leer.\n\n– Batterie wechseln\n– Position des Empfängers prüfen\n\nSicherheit: mittel";
async function shotVariant(name, html, extra = 0) {
  const { ctx, p, ev } = await page(true, { css: CSS, width: 402, height: 874 });
  await ev(`r.host._aiOn = true; r.host._ai.set("a", { state: "done", title: "Router oder Funkstrecke prüfen", text: ${JSON.stringify(TEXT.split("\n\n").slice(1).join("\n\n"))}, source: "Google AI Task", at: new Date().toISOString() }); r.querySelector('.dev[data-open="a"]').click()`);
  await p.waitForTimeout(600);
  await ev(`const d=r.querySelector("dialog.device"); r.host._ai.set("a", r.host._ai.get("a")); const box=d.querySelector(".ai-box"); for (const n of box.querySelectorAll(".opt-short")) n.remove(); box.parentElement.querySelectorAll(".ai-box ~ *").forEach(()=>{}); if (box) { box.insertAdjacentHTML("beforeend", ${JSON.stringify(html)}); const sc=[d,d.querySelector(".dlg-body")].find((x)=>x && x.scrollHeight>x.clientHeight+5) || d; const h=box.previousElementSibling.getBoundingClientRect().top; sc.scrollTop += h - 262 + ${extra}; }`);
  await p.waitForTimeout(300);
  const f = await shot(p, true, name);
  await ctx.close();
  return f;
}
const a = await shotVariant("A", A);
const b = await shotVariant("B", B, 150);
const c = await shotVariant("C", C);
await compose("1-Varianten.png", [[a, "A (Empfehlung): Fragen als Chips, dazu \"Eigene Frage\"", 330], [b, "B: freies Textfeld wie ein Chat, Verlauf", 330], [c, "C: Knopf \"Nachfragen\", Fenster mit Verlauf", 330]]);
await close();
console.log("fertig");
