// Mockups (Wunsch des Nutzers, 2026-10-11): Die Reiter bleiben umrandet, aber die Fläche, die alle Reiter umfasst,
// entfällt (kein grauer Grund hinter der Reihe, derselbe Grund wie das Popup). Im echten Panel (Nachbau, erfundene
// Daten); die Varianten hängen nur Stile an die echten Reiter-Klassen.
//   Ist: 2.0.2 (Reihe auf grauer Fläche, nicht gewählte leicht umrandet)
//   A: wie gewünscht: gleiche Reiter, ohne Fläche dahinter
//   B: wie A, dazu der gewählte Reiter mit Akzentrand und leichter Akzentfläche (ohne Grund fällt "gewählt" sonst weniger auf)
// Aufruf: CHROMIUM_PATH=... node docs/mockups/tabs-frame-v1/src/render.mjs
import { setup } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8979, import.meta.url);

const FLAT = `
.mon-tabs, .sub-tabs, dialog.device .mon-tabs, dialog.device .sub-tabs, dialog.settings .mon-tabs, dialog.settings .sub-tabs { background: none !important; padding: 0 !important; border-radius: 0 !important; gap: 6px !important; }
`;
const CSS = {
  Ist: "",
  A: FLAT,
  B: `${FLAT}
.mon-tab:not(.on), .sub-tab:not(.on) { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dp-text) 22%, transparent) !important; }
.mon-tab.on, .sub-tab.on, dialog.device .mon-tab.on, dialog.device .sub-tab.on, dialog.settings .mon-tab.on, dialog.settings .sub-tab.on { background: color-mix(in srgb, var(--dp-primary) 18%, transparent) !important; color: var(--dp-text); box-shadow: inset 0 0 0 1.5px var(--dp-primary) !important; }
`,
};

async function shots(v) {
  const css = CSS[v];
  const files = [];
  {
    // Geräte-Popup, Einstellungen (3 + 4 Reiter)
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
    await ev(`r.querySelector('.mon-tab[data-key="integ"]').click()`); await p.waitForTimeout(300);
    await ev(`r.querySelector('.ilist-row[data-key="matter"]').click()`); await p.waitForTimeout(300);
    await ev(`r.querySelector('[data-set="isub"][data-key="chg"]').click()`); await p.waitForTimeout(300);
    await ev(`r.querySelector('.iback').scrollIntoView({block:"center"})`);
    files.push(await shot(p, true, `${v}-3`));
    await ctx.close();
  }
  return files;
}
const out = {};
for (const v of ["Ist", "A", "B"]) out[v] = await shots(v);
const cap = {
  Ist: "Ist (2.0.2): Reihe auf grauer Fläche",
  A: "A: ohne Fläche, Reiter wie bisher umrandet",
  B: "B: wie A, gewählter Reiter mit Akzentrand",
};
for (const [i, name] of [[0, "1-Geraete-Popup.png"], [1, "2-Einstellungen.png"], [2, "3-Integration.png"]]) {
  await compose(name, ["Ist", "A", "B"].map((v) => [out[v][i], cap[v], 300]));
}
await close();
console.log("fertig");
