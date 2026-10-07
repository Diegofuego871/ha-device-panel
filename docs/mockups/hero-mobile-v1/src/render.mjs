// Mockups "Info-Kacheln oben auf dem Handy" (Wunsch des Nutzers, 2026-10-07):
// Auf einem iPhone 17 (402 x 874 pt) sollen die Kacheln "Verfügbarkeit" und
// "Gerade ausgefallen" sauber nebeneinander stehen. Heute sind es drei Kacheln
// à 280 px zum seitlichen Wischen, nebeneinander passt nur eine ganze.
// Alle Varianten: zwei kompakte Kacheln (je 185 px) nebeneinander; sie
// unterscheiden sich nur darin, wo die dritte Kachel (Ausfall-Puls) bleibt.
//   V1: Puls-Kachel volle Breite unter den zwei Kacheln.
//   V2: Puls als schlanke Zeile (Zusammenfassung + kleine Kurve) unter den zwei.
//   V3: Puls als zweite Seite: seitlich wischen, mit Punkten unter den Kacheln.
// Jede Variante in zwei Zuständen (mit Ausfällen / alles online). Im echten
// Panel (Nachbau aus tests/panel, erfundene Daten), die Änderungen als CSS
// eingesetzt.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/hero-mobile-v1/src/render.mjs
import { setup } from "../../_lib/mock.mjs";

const { page, shot, compose, close } = await setup(8965, import.meta.url);
// iPhone 17: 402 x 874. MOCK_W/MOCK_H zum Gegenprüfen anderer Geräte (z. B. 375 x 667); die Bilder
// bekommen dann einen Zusatz im Namen und gehören nicht ins Repository.
const W = Number(process.env.MOCK_W || 402), H = Number(process.env.MOCK_H || 874);
const SUF = W === 402 ? "" : `-${W}`;

// Gemeinsam für V1 bis V3: kompakte Kacheln, je zwei pro Zeile.
const BASE = `
.hero { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; padding: 0; overflow: visible; }
.hero .kt { min-width: 0; padding: 12px; border-radius: 16px; }
.hero .kt .k { font-size: 11px; letter-spacing: .03em; gap: 6px; }
/* Verfügbarkeit: Ring und Prozent nebeneinander, darunter Durchschnitt und Zeilen */
.kt.ring { display: grid; grid-template-columns: 62px minmax(0, 1fr); gap: 0 10px; align-content: start; align-items: center; }
.kt.ring > div:last-child { display: contents; }
.kt.ring .k { grid-column: 1 / -1; margin-bottom: 8px; }
.kt.ring .ringwrap { grid-column: 1; grid-row: 2; width: 62px; height: 62px; }
.kt.ring .ringwrap svg { width: 62px; height: 62px; }
.kt.ring .ringwrap .c b { font-size: 17px; }
.kt.ring .ringwrap .c span { display: none; }
.kt.ring .pct { grid-column: 2; grid-row: 2; margin: 0; font-size: 23px; line-height: 1.1; }
.kt.ring .pct small { display: block; margin: 2px 0 0; }
.kt.ring .pavg { grid-column: 1 / -1; margin: 10px 0 2px; font-size: 12.5px; }
.kt.ring .lines { grid-column: 1 / -1; margin-top: 2px; }
.kt.ring .lines div { font-size: 12.5px; }
/* Gerade ausgefallen: kleinere Zahl, Liste mit zwei Zeilen, kurze Warnzeile */
.kt.offl .top { margin: 2px 0 8px; gap: 8px; }
.kt.offl .top .num { font-size: 38px; }
.kt.offl .top .lbl { font-size: 12px; padding-bottom: 3px; line-height: 1.25; }
.kt.offl .durs { display: none; }
.kt.offl .olist { margin-bottom: 12px; }
.kt.offl .olist button { grid-template-columns: 16px minmax(0, 1fr) auto; gap: 6px; padding: 5px 0; font-size: 12.5px; }
.kt.offl .olist button:nth-child(n+3) { display: none; }
.kt.offl .olist .more { font-size: 12px; }
.kwarn { margin: auto -12px -12px; padding: 9px 12px; font-size: 12.5px; }
`;

// Texte der Kacheln auf dem schmalen Handy: kurze Warnzeile, Rest "weitere".
const TWEAK = `
  const w = r.querySelector(".kwarn span:nth-child(2)");
  if (w) { const n = w.querySelector("b")?.textContent; if (n) w.innerHTML = "<b>" + n + "</b> " + (n === "1" ? "Warnung" : "Warnungen"); }
  const list = r.querySelector(".kt.offl .olist");
  if (list) {
    const rows = list.querySelectorAll("button").length;
    const more = list.querySelector(".more");
    const rest = rows - 2 + (more ? Number((more.textContent.match(/\\d+/) || [0])[0]) : 0);
    if (rest > 0) { if (more) more.textContent = "+ " + rest + " weitere"; else list.insertAdjacentHTML("beforeend", '<div class="more">+ ' + rest + " weitere</div>"); }
  }
`;

const V1 = `${BASE}
.hero .kt.pul { grid-column: 1 / -1; }
.pchart { height: 56px; }
`;

const V2 = `${BASE}
.hero .kt.pul { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 1fr) 112px; column-gap: 12px; align-items: center; padding: 10px 12px; }
.hero .kt.pul .k { grid-column: 1; grid-row: 1; }
.hero .kt.pul .pnote { grid-column: 1; grid-row: 2; margin-top: 4px; }
.hero .kt.pul .pchart { grid-column: 2; grid-row: 1 / span 2; height: 38px; margin: 0; }
.hero .kt.pul .pticks { display: none; }
/* Sammelausfall: nur die Titelzeile, der Text steht im Puls-Fenster */
.hero .kt.pul .inc { grid-column: 1; grid-row: 2; margin: 4px 0 0; padding: 0; background: none; font-size: 0; }
.hero .kt.pul .inc b { display: inline; margin: 0; font-size: 12.5px; }
`;

const V3 = `${BASE}
.hero { display: flex; overflow-x: auto; scroll-snap-type: none; gap: 12px; margin: 0 -12px; padding: 0 12px; scrollbar-width: none; }
.hero::-webkit-scrollbar { display: none; }
.mk-page { flex: 0 0 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; scroll-snap-align: start; }
.hero .kt.pul { flex: 0 0 100%; scroll-snap-align: start; }
.pchart { height: 64px; }
.mk-dots { display: flex; justify-content: center; gap: 6px; margin: 8px 0 2px; }
.mk-dots i { width: 6px; height: 6px; border-radius: 3px; background: var(--dp-text3); opacity: .6; }
.mk-dots i.on { width: 16px; background: var(--dp-primary); opacity: 1; }
`;

async function render(name, css, { off, tweak = true, v3 = false, second = false }) {
  const { ctx, p, ev } = await page(true, { css, width: W, height: H });
  if (!off) {
    // Zustand des Nutzers: alles online
    await ev(`const h = r.host; for (const d of h._devices) if (d.online === false) { d.online = true; d.offline_since = null; } h._render();`);
  }
  if (tweak) await ev(TWEAK);
  if (v3) {
    await ev(`
      const hero = r.querySelector(".hero");
      const [a, b] = hero.children;
      const wrap = document.createElement("div");
      wrap.className = "mk-page";
      hero.prepend(wrap);
      wrap.append(a, b);
      hero.insertAdjacentHTML("afterend", '<div class="mk-dots"><i class="on"></i><i></i></div>');
    `);
    // Der Nachbau hat vor dem Umbau auf die erste Kachel eingerastet (12 px): zurück auf den Anfang.
    await ev(`const hero = r.querySelector(".hero"); hero.style.scrollBehavior = "auto"; hero.scrollLeft = 0; r.querySelector(".content").scrollTop = 0;`);
    if (second) {
      await ev(`const hero = r.querySelector(".hero"); hero.style.scrollBehavior = "auto"; hero.scrollLeft = hero.scrollWidth; const d = r.querySelectorAll(".mk-dots i"); d[0].classList.remove("on"); d[1].classList.add("on");`);
    }
  }
  // Beginn der Geräteliste (Abstand vom oberen Fensterrand), für den Vergleich im README
  const top = await ev(`return Math.round(r.querySelector(".list").getBoundingClientRect().top + document.defaultView.frameElement.getBoundingClientRect().top)`);
  console.log(`${name} ${off ? "mit Ausfällen" : "alles online"}${second ? " (Seite 2)" : ""}: Liste beginnt bei ${top} px von ${H}`);
  const file = await shot(p, true, `${name}${SUF}-${off ? "aus" : "ok"}${second ? "-2" : ""}`);
  await ctx.close();
  return file;
}

// Heute: dieselbe Seite ohne Änderung, nur im iPhone-17-Fenster.
const heute = [await render("heute", "", { off: true, tweak: false }), await render("heute", "", { off: false, tweak: false })];
await compose(`0-heute${SUF}.png`, [
  [heute[0], "Heute, iPhone 17 (402 pt): mit Ausfällen. Die zweite Kachel ist angeschnitten, die dritte nur durch Wischen erreichbar.", 380],
  [heute[1], "Heute: alles online (wie im Bildschirmfoto des Nutzers)", 380],
]);

const a = [await render("V1", V1, { off: true }), await render("V1", V1, { off: false })];
await compose(`1-V1-puls-darunter${SUF}.png`, [
  [a[0], "V1: zwei Kacheln nebeneinander, Puls volle Breite darunter. Mit Ausfällen.", 380],
  [a[1], "V1: alles online", 380],
]);

const b2 = [await render("V2", V2, { off: true }), await render("V2", V2, { off: false })];
await compose(`2-V2-puls-als-zeile${SUF}.png`, [
  [b2[0], "V2: zwei Kacheln, Puls als schlanke Zeile (Zusammenfassung und kleine Kurve). Mit Ausfällen.", 380],
  [b2[1], "V2: alles online", 380],
]);

const c = [await render("V3", V3, { off: true, v3: true }), await render("V3", V3, { off: true, v3: true, second: true })];
await compose(`3-V3-wischen${SUF}.png`, [
  [c[0], "V3, Seite 1: zwei Kacheln nebeneinander, Punkte zeigen die zweite Seite an.", 380],
  [c[1], "V3, Seite 2 (nach Wischen): Ausfall-Puls in voller Breite.", 380],
]);

await close();
console.log("fertig");
