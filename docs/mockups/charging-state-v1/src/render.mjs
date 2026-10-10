// Mockups "Geräte, die gerade laden" (Wunsch des Nutzers, 2026-10-10): Filter-Chip "Lädt", Markierung in der
// Liste und was sich bei gewähltem Chip in der Ansicht ändert. Im echten Panel (Nachbau, erfundene Daten).
//  1-Liste.png: Markierung in der normalen Liste, Varianten A bis C.
//  2-Chip.png: Chip "Lädt" gewählt (gefilterte Liste, nach Stand), Varianten A bis C.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/charging-state-v1/src/render.mjs
import { setup } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8973, import.meta.url);

const BOLT = `<svg class="mk-bolt" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11,20V14.5H9L13,7V12.5H15M16.67,4H15V2H9V4H7.33A1.33,1.33 0 0,0 6,5.33V20.67C6,21.4 6.6,22 7.33,22H16.67A1.33,1.33 0 0,0 18,20.67V5.33C18,4.6 17.4,4 16.67,4Z"/></svg>`;
const CSS = `
.mk-chg { display:inline-flex; align-items:center; gap:4px; color: var(--dp-success); font-weight:600; font-size:12.5px }
.mk-chg .mk-bolt { color: var(--dp-success) }
.mk-pill { display:inline-flex; align-items:center; gap:4px; padding:2px 9px; border-radius:999px; background: var(--dp-success-soft); color: var(--dp-success); font-size:12px; font-weight:600 }
.mk-row-c { box-shadow: inset 3px 0 0 var(--dp-success) }
.mk-bar { position:relative; height:6px; margin-top:6px; border-radius:3px; background: var(--dp-bar-off); overflow:hidden }
.mk-bar i { position:absolute; inset:0 auto 0 0; background: var(--dp-success); border-radius:3px }
.mk-sub2 { display:block; color: var(--dp-text2); font-size:12px; margin-top:2px }
.mk-sub2 b { color: var(--dp-success); font-weight:600 }
.chip.mk-chip { color: var(--dp-success) }
.chip.mk-chip.on { background: var(--dp-success-soft); border-color: var(--dp-success); color: var(--dp-success) }
`;
// Geräte, die laden (erfunden): id, Stand, Startstand, Dauer
const CH = [["i", 81, 38, "1 Std. 20 Min."], ["j", 67, 22, "2 Std. 5 Min."], ["e", 64, 15, "40 Min."]];

async function open(script) {
  const { ctx, p, ev } = await page(true, { css: CSS, width: 402, height: 874 });
  await ev(`
    // Chip "Lädt" nach "Batterie"
    const bat = r.querySelector('.chip[data-hint="batteries"]');
    const c = bat.cloneNode(true);
    c.dataset.hint = "charging"; c.classList.add("mk-chip");
    c.querySelector("svg path").setAttribute("d", ${JSON.stringify(BOLT.match(/d="([^"]+)"/)[1])});
    c.querySelector("span").textContent = "Lädt";
    c.querySelector(".n").textContent = "3";
    bat.after(c);
    window.__chip = c;
    window.__CH = ${JSON.stringify(CH)};
  `);
  await ev(script);
  await p.waitForTimeout(300);
  await ev(`const ch = r.querySelector(".chips"); if (ch) { const c = window.__chip; ch.scrollLeft = Math.max(0, c.offsetLeft - ch.clientWidth + c.offsetWidth + 24); }`);
  return { ctx, p, ev };
}
const shotOf = async (script, name, scrollSel) => {
  const o = await open(script);
  if (scrollSel) await o.ev(`const e=r.querySelector(${JSON.stringify(scrollSel)}); if (e) e.scrollIntoView({block:"center"})`);
  const f = await shot(o.p, true, name); await o.ctx.close(); return f;
};

// Zustand 1: normale Liste, die drei Geräte sind markiert
const L = {
  A: `for (const [id, lvl] of window.__CH) { const dv = r.querySelector('.dev[data-open="'+id+'"]'); const row = dv.querySelector(".sub") || dv.querySelector(".sb2"); row.insertAdjacentHTML("beforeend", ' · <span class="mk-chg">${BOLT.replace(/'/g, "\\'")} '+lvl+' % lädt</span>'); }`,
  B: `for (const [id] of window.__CH) { const row = r.querySelector('.dev[data-open="'+id+'"]'); row.lastElementChild.innerHTML = '<span class="mk-pill">${BOLT.replace(/'/g, "\\'")} lädt</span>'; }`,
  C: `for (const [id, lvl] of window.__CH) { const row = r.querySelector('.dev[data-open="'+id+'"]'); row.classList.add("mk-row-c"); row.lastElementChild.innerHTML = '<span class="mk-chg">${BOLT.replace(/'/g, "\\'")} '+lvl+' %</span>'; }`,
};
// Zustand 2: Chip gewählt: gefilterte Liste nach Stand, Ansicht ändert sich
const rows = (inner) => `
  const list = r.querySelector(".list");
  r.querySelectorAll(".chip.on").forEach((x) => { x.classList.remove("on"); x.setAttribute("aria-pressed", "false"); });
  window.__chip.classList.add("on"); window.__chip.setAttribute("aria-pressed", "true");
  const src = [...window.__CH].sort((a, b) => b[1] - a[1]).map(([id, lvl, from, dur]) => { const e = r.querySelector('.dev[data-open="'+id+'"]').cloneNode(true); return [e, lvl, from, dur]; });
  list.innerHTML = '<div class="cards"><div class="gh">Lädt · 3</div><div class="mlist"></div></div>';
  const ml = list.querySelector(".mlist");
  for (const [e, lvl, from, dur] of src) { ${inner} ml.appendChild(e); }
  r.querySelector(".foot").textContent = "3 von 16 Geräten";
`;
const C = {
  A: rows(`const box = e.firstElementChild.nextElementSibling; box.insertAdjacentHTML("beforeend", '<span class="mk-sub2"><span class="mk-chg">${BOLT.replace(/'/g, "\\'")} '+lvl+' % lädt</span> · seit '+dur+'</span>');`),
  B: rows(`e.lastElementChild.innerHTML = '<span class="mk-pill">${BOLT.replace(/'/g, "\\'")} '+lvl+' %</span>'; e.firstElementChild.nextElementSibling.insertAdjacentHTML("beforeend", '<span class="mk-sub2">von '+from+' % · seit <b>'+dur+'</b></span>');`),
  C: rows(`e.classList.add("mk-row-c"); const box = e.firstElementChild.nextElementSibling; box.insertAdjacentHTML("beforeend", '<div class="mk-bar"><i style="width:'+lvl+'%"></i></div><span class="mk-sub2">'+lvl+' % · von '+from+' % · seit <b>'+dur+'</b></span>'); e.lastElementChild.innerHTML = '<span class="mk-chg">${BOLT.replace(/'/g, "\\'")}</span>';`),
};
const scroll = '.dev[data-open="i"]';
const l = {}; const c = {};
for (const k of ["A", "B", "C"]) { l[k] = await shotOf(L[k], `L${k}`, scroll); c[k] = await shotOf(C[k], `C${k}`, ".chips"); }
await compose("1-Liste.png", [
  [l.A, "A: Text in der Zeile \"⚡ 81 % lädt\" (grün, hinter Typ und Bereich)", 330],
  [l.B, "B: grüne Pille \"⚡ lädt\" rechts in der Zeile", 330],
  [l.C, "C: grüner Streifen links, Blitz mit Stand rechts", 330],
]);
await compose("2-Chip.png", [
  [c.A, "A (Chip gewählt): nach Stand sortiert, Zeile zeigt \"⚡ 81 % · seit 1 Std. 20 Min.\"", 330],
  [c.B, "B (Chip gewählt): Pille mit Stand, zweite Zeile \"von 38 % · seit 1 Std. 20 Min.\"", 330],
  [c.C, "C (Chip gewählt): Streifen, grüner Füllstandsbalken und \"81 % · von 38 % · seit …\"", 330],
]);
await close();
