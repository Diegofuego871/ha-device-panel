// Mockups (Wunsch des Nutzers, 2026-10-10): Wenn "Voll ab" unter 100 % liegt (zum Beispiel 80 %), zeigt der
// Ladebalken das Ziel. Im echten Panel (Nachbau, erfundene Daten), Zusätze per Skript eingesetzt.
//   A: Strich beim Ziel, dazu "Ziel 80 %" in der Zeile
//   B: Rest hinter dem Ziel aufgegraut und schraffiert
//   C: Rest aufgegraut mit Strich und Zahl am Strich (Empfehlung)
// Aufruf: CHROMIUM_PATH=... node docs/mockups/charge-target-v1/src/render.mjs
import { setup } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8975, import.meta.url);

const CSS = `
.chg-bar { overflow: visible !important; }
.chg-bar i { z-index: 1; }
.mk-rest { position:absolute; top:0; bottom:0; right:0; border-radius: 0 3px 3px 0; background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--dp-text) 22%, transparent) 0 3px, transparent 3px 6px); opacity: .9; z-index: 0 }
.mk-tick { position:absolute; top:-3px; bottom:-3px; width:2px; margin-left:-1px; border-radius:1px; background: var(--dp-text); z-index: 2 }
.mk-num { position:absolute; top:-19px; transform: translateX(-50%); font-size: 10.5px; line-height: 1; color: var(--dp-text2); white-space: nowrap }
.mk-goal { color: var(--dp-text2) }
`;
// Geräte, die laden (erfunden): id, Stand, Startstand, Ziel ("Voll ab")
const CH = [["i", 74, 38, 80], ["j", 67, 22, 100], ["e", 64, 15, 90]];

async function variant(name, deco) {
  const { ctx, p, ev } = await page(true, { css: CSS, width: 402, height: 874, freeze: false });
  await p.evaluate(() => {
    window.__charging = { i: { level: 74, from: 38, ago: 4800 }, j: { level: 67, from: 22, ago: 7500 }, e: { level: 64, from: 15, ago: 2400 } };
    window.__devSettings.chargeFull = { i: 80, e: 90 };
  });
  await ev(`r.host._fetch()`);
  await p.waitForTimeout(800);
  await ev(`r.querySelector('.chip[data-hint="charging"]').click()`);
  await p.waitForTimeout(500);
  await ev(`r.host._fetch = () => {};`);
  await ev(`
    const T = ${JSON.stringify(Object.fromEntries(CH.map(([id, , , t]) => [id, t])))};
    for (const row of r.querySelectorAll(".mrow.dev, .dev")) {
      const id = row.dataset.open; const bar = row.querySelector(".chg-bar"); if (!bar || !(id in T)) continue;
      const t = T[id]; if (t >= 100) continue;
      ${deco}
    }
  `);
  const f = await shot(p, true, name);
  await ctx.close();
  return f;
}
const A = `bar.insertAdjacentHTML("beforeend", '<b class="mk-tick" style="left:'+t+'%"></b>'); const s = row.querySelector(".chg-sub"); s.innerHTML = s.innerHTML.replace(/ · seit/, ' · <span class="mk-goal">Ziel '+t+' %</span> · seit');`;
const B = `bar.insertAdjacentHTML("beforeend", '<b class="mk-rest" style="left:'+t+'%"></b>');`;
const C = `bar.insertAdjacentHTML("beforeend", '<b class="mk-rest" style="left:'+t+'%"></b><b class="mk-tick" style="left:'+t+'%"></b><span class="mk-num" style="left:'+t+'%">'+t+'</span>');`;
const [a, b, c] = [await variant("A", A), await variant("B", B), await variant("C", C)];
await compose("1-Ladebalken.png", [
  [a, "A: Strich beim Ziel (80 bzw. 90 %), dazu \"Ziel 80 %\" in der Zeile", 330],
  [b, "B: Rest hinter dem Ziel aufgegraut und schraffiert", 330],
  [c, "C (Empfehlung): Rest schraffiert, Strich und kleine Zahl am Ziel", 330],
]);
await close();
console.log("fertig");
