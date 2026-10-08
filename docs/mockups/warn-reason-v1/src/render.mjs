// Mockups "Warum die Warnung?" (Wunsch des Nutzers, 2026-10-08): Wer in der Kachel auf
// "Geräte mit Warnung" tippt und ein Gerät öffnet, soll oben im Popup sofort sehen, wieso
// die Warnung besteht (heute steht der Grund nur in der Statistik-Kachel weiter unten).
//   A: Hinweisfeld unter dem Kopf, eine Zeile je Grund (Empfehlung).
//   B: Kompakte Marken im Kopf, anstelle der Zeile unter dem Namen.
//   C: Wie A, dazu die betroffene Kachel in der Statistik gelb markiert.
// Im echten Panel (Nachbau aus tests/panel, erfundene Daten), Zusätze eingesetzt.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/warn-reason-v1/src/render.mjs
import { setup, svg } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8966, import.meta.url);

const CSS = `
.mk-why { margin: 0 0 4px; padding: 12px 14px; border-radius: 14px; background: color-mix(in srgb, var(--dp-warning) 14%, var(--dp-card)); border: 1px solid color-mix(in srgb, var(--dp-warning) 40%, transparent); }
.mk-why h4 { margin: 0 0 6px; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--dp-warning); display: flex; align-items: center; gap: 6px; }
.mk-why .r { display: flex; align-items: baseline; gap: 8px; padding: 5px 0; font-size: 14px; border-top: 1px solid color-mix(in srgb, var(--dp-warning) 22%, transparent); }
.mk-why .r:first-of-type { border-top: 0; }
.mk-why .r b { font-weight: 600; }
.mk-why .r span { color: var(--dp-text2); font-size: 13px; }
.mk-why .r .go { margin-left: auto; color: var(--dp-text3); display: inline-flex; align-self: center; }
.mk-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.mk-tags button { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--dp-warning) 45%, transparent); background: color-mix(in srgb, var(--dp-warning) 14%, transparent); color: var(--dp-text); font: inherit; font-size: 13px; }
.mk-tags svg { color: var(--dp-warning); }
.mk-hl { box-shadow: 0 0 0 1.5px var(--dp-warning) inset; background: color-mix(in srgb, var(--dp-warning) 10%, var(--dp-card)) !important; }
.mk-hl .warnlbl { color: var(--dp-warning) !important; }
`;
const ALERT = "M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z";
const WHY = [["Instabil", "5 Unterbrüche in 24 Std. (ab 3)"], ["Schwacher Empfang", "LQI 61, unter der Schwelle 62"]];
const chev = svg("chevron", 16);
const A = `<div class="mk-why"><h4><svg width="15" height="15" viewBox="0 0 24 24"><path fill="currentColor" d="${ALERT}"/></svg>Warum die Warnung?</h4>${
  WHY.map(([t, s]) => `<div class="r"><b>${t}</b><span>${s}</span><i class="go">${chev}</i></div>`).join("")}</div>`;
const B = `<div class="mk-tags">${WHY.map(([t, s]) => `<button><svg width="15" height="15" viewBox="0 0 24 24"><path fill="currentColor" d="${ALERT}"/></svg>${t} · ${s.split(",")[0]}</button>`).join("")}</div>`;

async function shotVariant(name, fn) {
  const { ctx, p, ev } = await page(true, { css: CSS, width: 402, height: 874 });
  await ev(`r.querySelector('.dev[data-open="e"]').click()`);
  await p.waitForTimeout(500);
  await ev(`const d=r.querySelector("dialog.device"); ${fn(A, B)}`);
  await p.waitForTimeout(300);
  const f = await shot(p, true, name);
  await ctx.close();
  return f;
}
const a = await shotVariant("A", (A) => `d.querySelector(".dlg-quick").insertAdjacentHTML("beforebegin", ${JSON.stringify(A)}); d.querySelector(".dlg-quick").style.marginTop="10px"`);
const b = await shotVariant("B", (A, B) => `d.querySelector(".dlg-sub").insertAdjacentHTML("afterend", ${JSON.stringify(B)}); d.querySelector(".dlg-sub span:not(.pill)").remove()`);
const c = await shotVariant("C", (A) => `d.querySelector(".dlg-quick").insertAdjacentHTML("beforebegin", ${JSON.stringify(A)}); d.querySelector(".dlg-quick").style.marginTop="10px"; const t=[...d.querySelectorAll(".st-tile")]; for (const x of t) if (/Verfügbarkeit|Empfang/.test(x.textContent)) x.classList.add("mk-hl")`);
await compose("1-Varianten.png", [[a, "A (Empfehlung): Hinweisfeld unter dem Kopf, eine Zeile je Grund mit Wert und Schwelle", 380], [b, "B: Marken im Kopf, ersetzen die Zeile unter dem Namen", 380], [c, "C: wie A, dazu die betroffenen Kacheln gelb markiert", 380]]);
await close();
console.log("fertig");
