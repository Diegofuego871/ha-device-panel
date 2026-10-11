// Mockups (Wunsch des Nutzers, 2026-10-11): Reiter ohne Fläche dahinter (A aus tabs-frame-v1), auf dem Handy grösser
// zum Bedienen mit dem Finger (Höhe mindestens 44 px) und der Reiter in der letzten Zeile ("Integrationen") nicht mehr über
// die ganze Breite, sondern gleich gross wie die anderen und links. Im echten Panel (Nachbau, erfundene Daten); die
// Varianten hängen nur Stile an die echten Reiter-Klassen.
//   Heute: 2.0.2 plus A (ohne Fläche), Reiter füllen die Zeile
//   1: Raster, gleich breite Spalten: bei mehr als vier Reitern drei pro Zeile (7 Reiter: 3 + 3 + 1), sonst eine Zeile
//   2: natürliche Breite, linksbündig, Umbruch nach Platz (Zeilen nicht bündig am rechten Rand)
//   3: Raster mit vier Spalten (7 Reiter: 4 + 3), Schrift 13 px; zeigt, ob "Integrationen" noch passt
// Aufruf: CHROMIUM_PATH=... node docs/mockups/tabs-touch-v1/src/render.mjs
import { setup } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8981, import.meta.url);

const FLAT = `
.mon-tabs, .sub-tabs, dialog.device .mon-tabs, dialog.device .sub-tabs, dialog.settings .mon-tabs, dialog.settings .sub-tabs { background: none !important; padding: 0 !important; border-radius: 0 !important; gap: 6px !important; }
`;
const BIG = `
.mon-tab, .sub-tab { min-height: 44px; padding: 0 10px !important; font-size: 14px !important; border-radius: 11px !important; display: flex; align-items: center; justify-content: center; }
`;
const CSS = {
  Heute: FLAT,
  1: `${FLAT}${BIG}
.mon-tabs, .sub-tabs { display: grid !important; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); }
.mon-tabs:has(> :nth-child(5)), .sub-tabs:has(> :nth-child(5)) { grid-auto-flow: row; grid-template-columns: repeat(3, minmax(0, 1fr)); }
`,
  2: `${FLAT}${BIG}
.mon-tabs, .sub-tabs { justify-content: flex-start; }
.mon-tab, .sub-tab { flex: 0 0 auto !important; padding: 0 14px !important; }
`,
  3: `${FLAT}${BIG}
.mon-tab, .sub-tab { font-size: 13px !important; padding: 0 4px !important; }
.mon-tabs, .sub-tabs { display: grid !important; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); }
.mon-tabs:has(> :nth-child(5)), .sub-tabs:has(> :nth-child(5)) { grid-auto-flow: row; grid-template-columns: repeat(4, minmax(0, 1fr)); }
`,
};

async function shots(v) {
  const css = CSS[v];
  const files = [];
  {
    const { ctx, p, ev } = await page(true, { css, width: 390, height: 844, freeze: false });
    await ev(`r.querySelector('.dev[data-open="c"]').click()`); await p.waitForTimeout(500);
    await ev(`r.querySelector('dialog.device [data-tab="set"]').click()`); await p.waitForTimeout(300);
    await ev(`r.host._fetch = () => {}`);
    await ev(`r.querySelector('dialog.device [data-stab="out"]').click()`); await p.waitForTimeout(300);
    files.push(await shot(p, true, `${v}-1`));
    await ctx.close();
  }
  {
    const { ctx, p, ev } = await page(true, { css, width: 390, height: 844, freeze: false });
    await ev(`r.querySelector(".gear-btn").click()`); await p.waitForTimeout(500);
    await ev(`r.querySelector('[data-set="section"][data-id="monitor"]').click()`); await p.waitForTimeout(300);
    await ev(`r.querySelector('.mon-tab[data-key="battery"]').click()`); await p.waitForTimeout(300);
    await ev(`r.host._fetch = () => {}`);
    await ev(`r.querySelector('.mon-tabs').scrollIntoView({block:"center"})`);
    files.push(await shot(p, true, `${v}-2`));
    if (v === 3) console.log("Variante 3, Überlauf (scrollWidth > clientWidth):", await ev(`return [...r.querySelectorAll(".mon-tab")].map(t => t.textContent.trim() + ":" + (t.scrollWidth > t.clientWidth)).join(" ")`));
    await ev(`r.querySelector('.mon-tab[data-key="integ"]').click()`); await p.waitForTimeout(300);
    await ev(`r.querySelector('.ilist-row[data-key="matter"]').click()`); await p.waitForTimeout(300);
    await ev(`r.querySelector('[data-set="isub"][data-key="chg"]').click()`); await p.waitForTimeout(300);
    await ev(`r.querySelector('.iback').scrollIntoView({block:"center"})`);
    files.push(await shot(p, true, `${v}-3`));
    await ctx.close();
  }
  return files;
}
const V = ["Heute", 1, 2, 3];
const out = {};
for (const v of V) out[v] = await shots(v);
const cap = {
  Heute: "Heute (2.0.2 mit A): Reiter füllen die Zeile, klein",
  1: "1: Raster, gleich breit, 3 pro Zeile (7 Reiter: 3 + 3 + 1), 44 px hoch",
  2: "2: natürliche Breite, linksbündig, 44 px hoch",
  3: "3: Raster, 4 Spalten (7 Reiter: 4 + 3), Schrift 13 px",
};
for (const [i, name] of [[0, "1-Geraete-Popup.png"], [1, "2-Einstellungen.png"], [2, "3-Integration.png"]]) {
  await compose(name, V.map((v) => [out[v][i], cap[v], 260]));
}
await close();
console.log("fertig");
