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
const SHORT = [["Instabil", "5× in 24 Std."], ["Empfang schwach", "LQI 61"]];
const chips = SHORT.map(([t, v]) => `<button><svg width="15" height="15" viewBox="0 0 24 24"><path fill="currentColor" d="${ALERT}"/></svg><b>${t}</b> · ${v}</button>`).join("");
const HL = `for (const x of [...d.querySelectorAll(".st-tile")]) if (/Verfügbarkeit|Empfang/.test(x.textContent)) x.classList.add("mk-hl")`;
// K1: Marken im Kopf (B), betroffene Kacheln markiert (C); die Pille "Instabil" entfällt, da die Marke sie ersetzt
const k1 = await shotVariant("K1", () => `d.querySelector(".dlg-sub .pill.warn").remove(); d.querySelector(".dlg-sub span").remove(); d.querySelector(".dlg-sub").insertAdjacentHTML("afterend", '<div class="mk-tags">' + ${JSON.stringify(chips)} + '</div>'); ${HL}`);
// K2: wie K1, Marken zusätzlich mit Tipp-Hinweis und gelbem Punkt an der Kachel (Marke und Kachel gehören sichtbar zusammen)
const k2 = await shotVariant("K2", () => `d.querySelector(".dlg-sub .pill.warn").remove(); d.querySelector(".dlg-sub span").remove(); d.querySelector(".dlg-sub").insertAdjacentHTML("afterend", '<div class="mk-tags">' + ${JSON.stringify(chips)} + '</div>'); ${HL}; for (const x of d.querySelectorAll(".mk-hl")) x.insertAdjacentHTML("afterbegin", '<span style="position:absolute;top:8px;right:10px;width:9px;height:9px;border-radius:50%;background:var(--dp-warning)"></span>'); for (const x of d.querySelectorAll(".st-tile")) x.style.position="relative"`);
await compose("2-Kombination.png", [[k1, "K1: Marken im Kopf (B) und betroffene Kacheln gelb umrandet (C)", 380], [k2, "K2: wie K1, dazu gelber Punkt in der Kachel, der zur Marke gehört", 380]]);
await close();
console.log("fertig");
