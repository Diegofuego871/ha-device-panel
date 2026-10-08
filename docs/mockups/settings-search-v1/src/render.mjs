// Mockups "Suchfeld in den Einstellungen" (Wunsch des Nutzers, 2026-10-09): lange Listen
// (Integrationen, Typen, Geräte, Verbindungsart pro Integration, Ausnahmen auf Geräten)
// sollen sich filtern lassen.
//   A: Suchfeld oben in jeder langen Liste (ab 8 Einträgen), mit Treffer-Zahl (Empfehlung).
//   B: wie A, das Feld klebt beim Scrollen unter dem Reiter.
//   C: ein Suchfeld im Kopf der Einstellungen, es filtert über alle Abschnitte.
// Im echten Panel (Nachbau aus tests/panel, erfundene Daten), Zusätze eingesetzt.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/settings-search-v1/src/render.mjs
import { setup, svg } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8967, import.meta.url);
const CSS = `
.mk-s { display: flex; align-items: center; gap: 8px; height: 42px; margin: 8px 0 6px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--dp-divider); background: var(--dp-card); color: var(--dp-text2); }
.mk-s input { flex: 1; min-width: 0; border: 0; background: none; color: var(--dp-text); font: inherit; font-size: 15px; outline: none; }
.mk-s .n { font-size: 12.5px; color: var(--dp-text2); white-space: nowrap; }
.mk-s .x { display: inline-flex; color: var(--dp-text3); }
.mk-sticky { position: sticky; top: 0; z-index: 3; padding: 4px 0; background: var(--dp-card); }
.mk-top { margin: 0 12px 6px; }
`;
const field = (val, n, total, cls = "") => `<label class="mk-s ${cls}">${svg("search", 18)}<input value="${val}" placeholder="Integration suchen …"><span class="n">${val ? `${n} von ${total}` : ""}</span>${val ? `<span class="x">${svg("close", 16)}</span>` : ""}</label>`;
async function run(name, fn, scroll = 0) {
  const { ctx, p, ev } = await page(true, { css: CSS, width: 402, height: 874 });
  await ev(`r.querySelector(".gear-btn").click()`);
  await p.waitForTimeout(500);
  await ev(`r.querySelector('[data-set="section"][data-id="devices"]').click()`);
  await p.waitForTimeout(400);
  await ev(fn());
  await ev(`const e=r.querySelector(".mk-s")||r.querySelector(".ex-all"); e.scrollIntoView({ block: "start" }); ${scroll ? `e.scrollIntoView({ block: "center" })` : ""}`);
  await p.waitForTimeout(300);
  const f = await shot(p, true, name);
  await ctx.close();
  return f;
}
const hide = (q) => `const q=${JSON.stringify(q)}; for (const row of r.querySelectorAll("dialog.settings .ex-row:not(.ex-all)")) { const t=row.textContent.toLowerCase(); if (!t.includes(q)) row.style.display="none"; }`;
const before = `const h=r.querySelector("dialog.settings .ex-intro"); `;
const a = await run("A", () => `${before} h.insertAdjacentHTML("afterend", ${JSON.stringify(field("shelly", 1, 18))}); ${hide("shelly")}`);
const b = await run("B", () => `${before} h.insertAdjacentHTML("afterend", ${JSON.stringify(field("z", 4, 18, "mk-sticky"))}); ${hide("z")}`, 60);
const c = await run("C", () => `const hd=r.querySelector("dialog.settings .dlg-head"); hd.insertAdjacentHTML("afterend", '<div class="mk-top">' + ${JSON.stringify(field("shelly", 3, 61).replace("Integration suchen …", "In allen Einstellungen suchen …"))} + '</div>'); ${hide("shelly")}`);
await compose("1-Varianten.png", [[a, "A (Empfehlung): Suchfeld oben in der Liste, Trefferzahl; nur in langen Listen (ab 8 Einträgen)", 380], [b, "B: wie A, das Feld bleibt beim Scrollen stehen", 380], [c, "C: ein Suchfeld im Kopf, filtert über alle Abschnitte (Treffer klappen Abschnitte auf)", 380]]);
await close();
console.log("fertig");
