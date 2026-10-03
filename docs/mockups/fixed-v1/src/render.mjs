// Mockups "Kopf fixieren auf dem Handy" (Wunsch des Nutzers, 2026-10-03: nur
// die Liste soll scrollen). Im echten Panel (Nachbau aus tests/panel, erfundene
// Daten), gescrollter Zustand.
// A: alles fixiert (Kacheln, Chips, Sortierung), nur die Liste scrollt.
// B: Kacheln scrollen weg, Chips und Sortierung bleiben oben.
// C: Kacheln schrumpfen beim Scrollen zu einer Zeile, Chips und Sortierung bleiben.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/fixed-v1/src/render.mjs
import { setup } from "../../_lib/mock.mjs";

const { page, shot, compose, close } = await setup(8972, import.meta.url);

const BASE = `
.viewline { display: block; }
`;
const A = `
.content { display: flex; flex-direction: column; overflow: hidden; padding-bottom: 0; }
.hero, .chips, .viewline { flex: none; }
.list { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; }
.foot { display: none; }
`;
const B = `
.chips { position: sticky; top: var(--mk-top, 0px); z-index: 5; margin: 0 -12px; padding: 10px 12px 4px; background: var(--dp-bg, var(--primary-background-color)); }
.viewline { position: sticky; top: var(--mk-top2, 0px); z-index: 5; margin: 0 -12px; padding: 0 12px 8px; background: var(--dp-bg, var(--primary-background-color)); }
`;
const C = B + `
.mk-strip { position: sticky; top: 0; z-index: 6; display: flex; align-items: center; gap: 12px; margin: 0 -12px; padding: 10px 14px; background: var(--dp-card); border-bottom: 1px solid var(--dp-divider); font-size: 14px; }
.mk-strip b { font-size: 17px; }
.mk-strip .e { color: var(--dp-error); font-weight: 600; }
.mk-strip .p { margin-left: auto; color: var(--dp-text2); font-size: 12px; }
.hero { display: none; }
`;

async function shotVariant(name, css, scrolled, prep) {
  const { ctx, p, ev } = await page(true, { css: BASE + css });
  if (prep) await ev(prep);
  await ev(`const st=r.querySelector(".mk-strip"); const top=st ? st.offsetHeight : 0; const c=r.querySelector(".chips"), v=r.querySelector(".viewline"); const host=r.host; host.style.setProperty("--mk-top", top+"px"); host.style.setProperty("--mk-top2", (top + c.offsetHeight)+"px");`);
  await ev(scrolled);
  await ev(`r.activeElement?.blur()`);
  const f = await shot(p, true, name);
  await ctx.close();
  return f;
}

const files = [];
files.push(await shotVariant("A", A, `r.querySelector(".list").scrollTop = 330`));
files.push(await shotVariant("B", B, `r.querySelector(".content").scrollTop = r.querySelector(".hero") && getComputedStyle(r.querySelector(".hero")).display !== "none" ? r.querySelector(".hero").offsetHeight + 90 : 120`));
files.push(
  await shotVariant("C", C, `r.querySelector(".content").scrollTop = r.querySelector(".hero") && getComputedStyle(r.querySelector(".hero")).display !== "none" ? r.querySelector(".hero").offsetHeight + 90 : 120`,
    `const s=document.createElement("div"); s.className="mk-strip"; s.innerHTML='<b>11</b><span>von 16 online</span><span class="e">● 4 ausgefallen</span><span class="p">Puls ›</span>'; r.querySelector(".content").prepend(s);`),
);
const caps = [
  "A: alles fixiert. Nur die Liste scrollt, aber sie hat nur rund die halbe Höhe",
  "B: Kacheln scrollen weg, Chips und Sortierung bleiben oben",
  "C (Empfehlung): Kacheln werden zu einer Zeile, Chips und Sortierung bleiben",
];
await compose("1-fixieren-A-B-C.png", files.map((f, i) => [f, caps[i], 330]));
await close();
