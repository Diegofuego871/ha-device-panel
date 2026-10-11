// Mockups (Wunsch des Nutzers, 2026-10-11, Bildschirmaufnahme der UniFi-App): Reiter als iOS-Segmentschalter. Eine
// abgerundete Fläche mit gleich breiten Feldern, das gewählte Feld ist eine dunklere Kapsel mit Akzentschrift, die beim
// Wechsel gleitet. Im echten Panel (Nachbau, erfundene Daten) als Stile an die echten Reiter-Klassen; das Gleiten
// zeigt der bewegliche Prototyp (prototype.html), hier steht der Endzustand.
//   Ist: 2.0.3 (Rahmen, keine Fläche)
//   Neu: Segmentschalter wie in der Aufnahme; bis 4 Reiter eine Zeile, ab 5 vier Spalten (7 Reiter: 4 + 3)
// Aufruf: CHROMIUM_PATH=... node docs/mockups/segmented-v1/src/render.mjs
import { setup } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8985, import.meta.url);

const SEG = `
.mon-tabs, .sub-tabs, dialog.device .mon-tabs, dialog.device .sub-tabs, dialog.settings .mon-tabs, dialog.settings .sub-tabs { display: grid !important; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 2px !important; padding: 3px !important; border-radius: 14px !important; background: color-mix(in srgb, var(--dp-text) 7%, var(--dp-card)) !important; }
.mon-tabs:has(> :nth-child(5)), .sub-tabs:has(> :nth-child(5)), dialog.settings .mon-tabs:has(> :nth-child(5)), dialog.settings .sub-tabs:has(> :nth-child(5)), dialog.device .sub-tabs:has(> :nth-child(5)) { grid-auto-flow: row !important; grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
.mon-tab, .sub-tab, dialog.device .mon-tab, dialog.device .sub-tab, dialog.settings .mon-tab, dialog.settings .sub-tab { min-height: 40px; padding: 0 2px !important; border-radius: 11px !important; box-shadow: none !important; background: none !important; color: color-mix(in srgb, var(--dp-text) 72%, transparent) !important; font-size: 13.5px !important; font-weight: 400 !important; display: flex; align-items: center; justify-content: center; text-align: center; }
.mon-tab.on, .sub-tab.on, dialog.device .mon-tab.on, dialog.device .sub-tab.on, dialog.settings .mon-tab.on, dialog.settings .sub-tab.on { background: var(--dp-bg) !important; color: var(--dp-primary) !important; font-weight: 500 !important; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dp-text) 7%, transparent) !important; }
`;
const CSS = { Ist: `
.mon-tabs, .sub-tabs, dialog.device .mon-tabs, dialog.device .sub-tabs, dialog.settings .mon-tabs, dialog.settings .sub-tabs { background: none !important; padding: 0 !important; border-radius: 0 !important; gap: 6px !important; }
.mon-tab, .sub-tab { min-height: 44px; padding: 0 14px !important; font-size: 14px !important; flex: 0 0 auto !important; display: flex; align-items: center; }`, Neu: SEG };

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
    if (v === "Neu") console.log("Überlauf (scrollWidth > clientWidth):", await ev(`return [...r.querySelectorAll(".mon-tab")].map(t => t.textContent.trim() + ":" + (t.scrollWidth > t.clientWidth)).join(" ")`));
    await ev(`r.querySelector('.mon-tab[data-key="integ"]').click()`); await p.waitForTimeout(300);
    await ev(`r.querySelector('.ilist-row[data-key="matter"]').click()`); await p.waitForTimeout(300);
    await ev(`r.querySelector('[data-set="isub"][data-key="chg"]').click()`); await p.waitForTimeout(300);
    await ev(`r.querySelector('.iback').scrollIntoView({block:"center"})`);
    files.push(await shot(p, true, `${v}-3`));
    await ctx.close();
  }
  return files;
}
const out = { Ist: await shots("Ist"), Neu: await shots("Neu") };
const cap = { Ist: "Ist (2.0.3): Rahmen, keine Fläche", Neu: "Neu: Segmentschalter wie in der UniFi-Aufnahme" };
for (const [i, name] of [[0, "1-Geraete-Popup.png"], [1, "2-Einstellungen.png"], [2, "3-Integration.png"]]) {
  await compose(name, ["Ist", "Neu"].map((v) => [out[v][i], cap[v], 330]));
}
await close();
console.log("fertig");
