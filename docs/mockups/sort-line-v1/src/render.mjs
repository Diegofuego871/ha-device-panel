// Mockups (Wunsch des Nutzers, 2026-10-11): Auf dem Handy öffnen der Knopf oben (Symbol "Spalten") und die Pille
// "Sortiert nach" unter den Chips dasselbe Blatt "Ansicht". Die Pille sieht wie ein Chip aus. Gesucht: nur noch eine
// Stelle oder ein deutlich anderer Look, bei dem man weiterhin direkt sieht, was gewählt ist. Im echten Panel (Nachbau,
// erfundene Daten); die Varianten bauen die Zeile im Nachbau um und hängen Stile an.
//   Ist: Pille unter den Chips, Knopf oben
//   A: Pille wird zur Textzeile ("Sortiert nach  Standard"), ohne Rahmen, Knopf oben bleibt
//   C (Empfehlung): eine Zeile unter den Chips ("Sortierung", Wert rechts in Akzentfarbe, Pfeil), der Knopf oben entfällt,
//      das Suchfeld wird breiter
// Aufruf: CHROMIUM_PATH=... node docs/mockups/sort-line-v1/src/render.mjs
import { setup } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8983, import.meta.url);

const CSS = {
  Ist: "",
  A: `
@media (max-width: 600px) {
  .viewline { padding-bottom: 2px !important; }
  .sort-btn { height: 28px !important; padding: 0 !important; border: 0 !important; background: none !important; font-size: 12.5px !important; gap: 7px !important; }
  .sort-btn .lbl { color: var(--dp-text2); }
  .sort-btn .val { color: var(--dp-text); font-weight: 600; }
  .sort-btn svg, .sort-btn svg:last-child { color: var(--dp-primary) !important; }
}`,
  C: `
@media (max-width: 600px) {
  .view-btn { display: none !important; }
  .viewline { margin: 0 -12px 6px !important; padding: 0 12px !important; }
  .sort-btn { width: 100%; height: 44px !important; padding: 0 4px !important; border: 0 !important; border-top: 1px solid var(--dp-divider) !important; border-bottom: 1px solid var(--dp-divider) !important; border-radius: 0 !important; background: none !important; font-size: 14px !important; gap: 10px !important; }
  .sort-btn .lbl { color: var(--dp-text2); }
  .sort-btn .val { flex: 1; text-align: right; color: var(--dp-primary); font-weight: 600; }
  .sort-btn svg:last-child { color: var(--dp-text2) !important; }
}`,
};
const EDIT = {
  Ist: "",
  A: `const b = r.querySelector(".sort-btn"); const s = [...b.querySelectorAll("svg")]; const val = b.querySelector("span").textContent;
      b.innerHTML = s[0].outerHTML + '<span class="lbl">Sortiert nach</span><span class="val">' + val + '</span>' + (s.length > 2 ? s[1].outerHTML : "");`,
  C: `const b = r.querySelector(".sort-btn"); const s = [...b.querySelectorAll("svg")]; const val = b.querySelector("span").textContent;
      b.innerHTML = s[0].outerHTML + '<span class="lbl">Sortierung</span><span class="val">' + val + '</span>' + (s.length > 2 ? s[1].outerHTML : "") + s.at(-1).outerHTML;`,
};

async function shots(v, sorted) {
  const { ctx, p, ev } = await page(true, { css: CSS[v], width: 402, height: 874, freeze: false });
  if (sorted) await ev(`r.host._setView({ sort: "name", dir: "asc" })`);
  await p.waitForTimeout(400);
  await ev(`r.host._fetch = () => {}`);
  if (EDIT[v]) await ev(EDIT[v]);
  await ev(`const c = r.querySelector(".chips"); c.scrollIntoView({ block: "start" })`);
  await p.waitForTimeout(300);
  const f = await shot(p, true, `${v}-${sorted ? "s" : "d"}`);
  await ctx.close();
  return f;
}
const cap = {
  Ist: "Ist (2.0.3): Pille wie ein Chip, dazu der Knopf oben",
  A: "A: Textzeile statt Pille, Knopf oben bleibt",
  C: "C: eine Zeile statt Knopf und Pille, Suchfeld breiter",
};
const V = ["Ist", "A", "C"];
for (const [sorted, name] of [[false, "1-Standard.png"], [true, "2-Nach-Name.png"]]) {
  const files = [];
  for (const v of V) files.push(await shots(v, sorted));
  await compose(name, V.map((v, i) => [files[i], cap[v], 300]));
}
await close();
console.log("fertig");
