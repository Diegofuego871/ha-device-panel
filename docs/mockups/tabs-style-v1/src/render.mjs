// Mockups (Wunsch des Nutzers, 2026-10-10): Reiter überall klarer als Reiter zeigen und bei Platzmangel auf eine
// zweite Zeile umbrechen (Einstellungen, Detail einer Integration, Geräte-Popup). Im echten Panel (Nachbau,
// erfundene Daten): die Varianten hängen nur Stile an die echten Reiter-Klassen.
//   A: Karteikarten (aktiver Reiter hängt am Inhalt, Akzentkante oben)
//   B: unterstrichen wie in Home Assistant (aktiv: Akzentfarbe und dicker Strich), jede Zeile mit eigener Linie
//   C: Tasten mit Rahmen in gleich breiten Spalten, aktiv gefüllt
// Aufruf: CHROMIUM_PATH=... node docs/mockups/tabs-style-v1/src/render.mjs
import { setup } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8977, import.meta.url);

const BASE = `
.mon-tabs, .sub-tabs { flex-wrap: wrap; overflow: visible; margin: 12px 0 14px; }
.mon-tab, .sub-tab { flex: 1 0 auto; position: relative; white-space: nowrap; font-size: 14px; }
`;
const VARIANTS = {
  A: `${BASE}
.mon-tabs, .sub-tabs { gap: 6px 4px; padding: 0; background: none; border-radius: 0; }
.mon-tab, .sub-tab { padding: 10px 14px 9px; border: 1px solid var(--dp-divider); border-bottom-color: var(--dp-divider); border-radius: 11px 11px 0 0; background: var(--dp-subtle); color: var(--dp-text2); box-shadow: none; }
.mon-tab.on, .sub-tab.on { background: var(--dp-card); color: var(--dp-text); font-weight: 700; border-color: var(--dp-primary); border-top: 3px solid var(--dp-primary); border-bottom-color: var(--dp-card); margin-bottom: -1px; box-shadow: none; z-index: 1; }
.mon-tabs, .sub-tabs { border-bottom: 1px solid var(--dp-primary); padding-bottom: 0; }
`,
  B: `${BASE}
.mon-tabs, .sub-tabs { gap: 0; padding: 0; background: none; border-radius: 0; }
.mon-tab, .sub-tab { padding: 12px 14px 10px; border: 0; border-radius: 0; background: none; color: var(--dp-text2); box-shadow: inset 0 -1px 0 var(--dp-divider); border-bottom: 3px solid transparent; }
.mon-tab.on, .sub-tab.on { background: none; color: var(--dp-primary); font-weight: 700; border-bottom-color: var(--dp-primary); box-shadow: inset 0 -1px 0 var(--dp-divider); }
`,
  C: `${BASE}
.mon-tabs, .sub-tabs { display: grid; grid-template-columns: repeat(auto-fit, minmax(92px, 1fr)); gap: 6px; padding: 0; background: none; border-radius: 0; }
.mon-tab, .sub-tab { padding: 10px 6px; border: 1.5px solid var(--dp-divider); border-radius: 10px; background: var(--dp-card); color: var(--dp-text2); box-shadow: none; text-align: center; }
.mon-tab.on, .sub-tab.on { background: var(--dp-primary); border-color: var(--dp-primary); color: #fff; font-weight: 700; box-shadow: none; }
.mon-tab.chg::after, .sub-tab.chg::after { background: var(--dp-warning); top: 4px; right: 4px; }
.mon-tab.on.chg::after, .sub-tab.on.chg::after { background: #fff; }
`,
};

async function shots(variant) {
  const css = VARIANTS[variant];
  const files = [];
  // 1. Einstellungen › Überwachung und Meldungen (sieben Reiter)
  {
    const { ctx, p, ev } = await page(true, { css, width: 390, height: 844, freeze: false });
    await ev(`r.querySelector(".gear-btn").click()`); await p.waitForTimeout(500);
    await ev(`r.querySelector('[data-set="section"][data-id="monitor"]').click()`); await p.waitForTimeout(300);
    await ev(`r.querySelector('.mon-tab[data-key="battery"]').click()`); await p.waitForTimeout(300);
    await ev(`r.host._fetch = () => {}`);
    await ev(`r.querySelector('.mon-tabs').scrollIntoView({block:"center"})`);
    files.push(await shot(p, true, `${variant}-1`));
    // 2. Detail einer Integration (sechs Reiter)
    await ev(`r.querySelector('.mon-tab[data-key="integ"]').click()`); await p.waitForTimeout(300);
    await ev(`r.querySelector('.ilist-row[data-key="matter"]').click()`); await p.waitForTimeout(300);
    await ev(`r.querySelector('[data-set="isub"][data-key="chg"]').click()`); await p.waitForTimeout(300);
    await ev(`r.querySelector('.iback').scrollIntoView({block:"center"})`);
    files.push(await shot(p, true, `${variant}-2`));
    await ctx.close();
  }
  // 3. Geräte-Popup, Einstellungen (drei Reiter plus vier Unterreiter)
  {
    const { ctx, p, ev } = await page(true, { css, width: 390, height: 844, freeze: false });
    await ev(`r.querySelector('.dev[data-open="c"]').click()`); await p.waitForTimeout(500);
    await ev(`r.querySelector('dialog.device [data-tab="set"]').click()`); await p.waitForTimeout(300);
    await ev(`r.host._fetch = () => {}`);
    await ev(`r.querySelector('dialog.device [data-stab="chg"]').click()`); await p.waitForTimeout(300);
    await ev(`r.querySelector('dialog.device .dev-set').scrollIntoView({block:"center"})`);
    files.push(await shot(p, true, `${variant}-3`));
    await ctx.close();
  }
  return files;
}

const out = {};
for (const v of ["A", "B", "C"]) out[v] = await shots(v);
const cap = {
  A: "A: Karteikarten. Der aktive Reiter hängt am Inhalt (Akzentkante oben), der Rest ist abgesetzt; bei Platzmangel zweite Zeile.",
  B: "B (Empfehlung): unterstrichen wie in Home Assistant. Aktiv: Akzentfarbe, fett, dicker Strich; jede Zeile hat ihre Linie.",
  C: "C: Tasten mit Rahmen in gleich breiten Spalten, der aktive ist gefüllt; bei Platzmangel zweite Zeile.",
};
for (const v of ["A", "B", "C"]) {
  await compose(`${v === "A" ? "1" : v === "B" ? "2" : "3"}-Reiter-${v}.png`, [
    [out[v][0], `${cap[v]} Einstellungen (7 Reiter)`, 330],
    [out[v][1], "Detail einer Integration (6 Reiter)", 330],
    [out[v][2], "Geräte-Popup (3 + 4 Reiter)", 330],
  ]);
}
await close();
console.log("fertig");
