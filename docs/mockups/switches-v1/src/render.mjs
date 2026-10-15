// Mockups Reiter "Schalter" im Geräte-Popup (2026-10-15, Wunsch des Nutzers): zweiter Reiter, zeigt alle schaltbaren Entitäten des Geräts mit
// Symbol und Beschriftung; ein Tipp öffnet die Bedienung von Home Assistant (wie die Entität im Reiter "Entitäten"). Dazu Emoji-Vorschläge für die
// Reiter "Schalter" und "Routinen" auf dem Handy. Im echten Panel (Nachbau aus tests/panel, erfundene Daten), Handy 402 x 874.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/switches-v1/src/render.mjs
import { readFileSync } from "node:fs";
import { setup, svg } from "../../_lib/mock.mjs";
const { page, shot, close } = await setup(8976, import.meta.url);

const CSS = `
.mk-sec { margin: 16px 0 8px; font-size: 13px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--dp-text2); }
/* A: Kacheln im Raster */
.mk-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.mk-tile { display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 18px; background: var(--dp-subtle); text-align: left; border: 0; color: inherit; font: inherit; }
.mk-tile .ic { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: color-mix(in srgb, var(--dp-text) 8%, var(--dp-card)); font-size: 22px; }
.mk-tile b { display: block; font-size: 14.5px; font-weight: 600; line-height: 1.25; }
.mk-tile small { display: block; margin-top: 2px; color: var(--dp-text2); font-size: 12.5px; }
.mk-tile.on { background: var(--dp-primary-soft); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dp-primary) 45%, transparent); }
.mk-tile.on .ic { background: var(--dp-primary); }
.mk-tile.on small { color: var(--dp-primary); font-weight: 500; }
.mk-tile.off .ic { filter: grayscale(.6); opacity: .85; }
/* B: Liste */
.mk-rows { border-radius: 18px; background: var(--dp-subtle); overflow: hidden; }
.mk-row { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-top: 1px solid var(--dp-divider); }
.mk-row:first-child { border-top: 0; }
.mk-row .ic { flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: color-mix(in srgb, var(--dp-text) 8%, var(--dp-card)); font-size: 20px; }
.mk-row.on .ic { background: var(--dp-primary); }
.mk-row .t { flex: 1; min-width: 0; }
.mk-row b { display: block; font-size: 14.5px; font-weight: 600; }
.mk-row small { display: block; margin-top: 1px; color: var(--dp-text2); font-size: 12.5px; }
.mk-row.on small { color: var(--dp-primary); font-weight: 500; }
.mk-row .chev { flex: none; color: var(--dp-text3); }
/* C: kompakte Kacheln, drei Spalten */
.mk-comp { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.mk-cell { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 6px 10px; border-radius: 16px; background: var(--dp-subtle); text-align: center; }
.mk-cell .ic { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; background: color-mix(in srgb, var(--dp-text) 8%, var(--dp-card)); font-size: 21px; }
.mk-cell.on { background: var(--dp-primary-soft); }
.mk-cell.on .ic { background: var(--dp-primary); }
.mk-cell b { font-size: 12.5px; font-weight: 600; line-height: 1.2; }
.mk-cell small { color: var(--dp-text2); font-size: 11.5px; }
.mk-cell.on small { color: var(--dp-primary); font-weight: 500; }
.mk-hint { margin: 14px 2px 0; color: var(--dp-text3); font-size: 12.5px; line-height: 1.4; }
`;

// Erfundenes Gerät mit mehreren schaltbaren Entitäten
const ENT = [
  { e: "🔌", n: "Steckdose 1", s: "Ein", on: true },
  { e: "🔌", n: "Steckdose 2", s: "Aus" },
  { e: "💡", n: "LED-Streifen", s: "Ein · 60 %", on: true },
  { e: "🌀", n: "Ventilator", s: "Aus" },
  { e: "🪟", n: "Rollladen Fenster", s: "Offen · 100 %", on: true },
  { e: "🔒", n: "Schloss Büro", s: "Abgeschlossen" },
];

const tileA = (x) => `<button type="button" class="mk-tile${x.on ? " on" : " off"}"><span class="ic">${x.e}</span><span><b>${x.n}</b><small>${x.s}</small></span></button>`;
const rowB = (x) => `<div class="mk-row${x.on ? " on" : ""}"><span class="ic">${x.e}</span><span class="t"><b>${x.n}</b><small>${x.s}</small></span><span class="chev">${svg("chevron", 20)}</span></div>`;
const cellC = (x) => `<div class="mk-cell${x.on ? " on" : ""}"><span class="ic">${x.e}</span><b>${x.n}</b><small>${x.s}</small></div>`;
const HINT = `<p class="mk-hint">Ein Tipp öffnet die Bedienung von Home Assistant, wie bei der Entität im Reiter "Entitäten".</p>`;
const BODY = {
  A: `<div class="mk-sec">Schalter · 6</div><div class="mk-grid">${ENT.map(tileA).join("")}</div>${HINT}`,
  B: `<div class="mk-sec">Schalter · 6</div><div class="mk-rows">${ENT.map(rowB).join("")}</div>${HINT}`,
  C: `<div class="mk-sec">Schalter · 6</div><div class="mk-comp">${ENT.map(cellC).join("")}</div>${HINT}`,
};

// Emoji-Vorschläge: Schalter / Routinen
const SETS = {
  A: { sw: "🎛️", rt: "🔁", note: "Regler / Schleife" },
  B: { sw: "🔌", rt: "⏰", note: "Stecker / Wecker" },
  C: { sw: "🕹️", rt: "⚡", note: "Joystick / Blitz" },
  D: { sw: "💡", rt: "🗓️", note: "Glühbirne / Kalender" },
};
const TABS = (on) => [["ov", "Übersicht"], ["sw", "Schalter"], ["set", "Einstellungen"], ["ent", "Entitäten · 6"], ["magic", "Magic Push"], ["routine", "Routinen"]]
  .map(([id, label]) => `<button type="button" role="tab" class="sub-tab${id === on ? " on" : ""}" data-dlg="tab" data-tab="${id}" aria-selected="${id === on}">${label}</button>`)
  .join("");
const emojiCss = (set) => `@media (max-width: 600px) { .dev-tabs .sub-tab[data-tab="sw"]::before { content: "${set.sw}"; } .dev-tabs .sub-tab[data-tab="routine"]::before { content: "${set.rt}"; } }`;

async function popup(variant, on = "sw") {
  const o = await page(true, { css: CSS + emojiCss(SETS.A), width: 402, height: 874 });
  await o.ev(`r.querySelector(".dev").click()`);
  await o.p.waitForTimeout(900);
  await o.ev(`
    const d = r.querySelector("dialog.device");
    d.querySelector(".dlg-title h2 > span").textContent = "Steckdosenleiste Büro";
    d.querySelector(".dev-tabs .sub-tabs").innerHTML = ${JSON.stringify(TABS(on))};
    d.querySelector(".dlg-body").innerHTML = ${JSON.stringify(BODY[variant])};
    r.host._initSeg(r);
  `);
  return o;
}

const files = [];
for (const v of ["A", "B", "C"]) {
  const o = await popup(v);
  files.push(await shot(o.p, true, `popup-${v}`));
  await o.ctx.close();
}

// Reiterleisten mit den Emoji-Sätzen, je mit gewähltem "Schalter" und gewählten "Routinen"
const bars = {};
for (const [k, set] of Object.entries(SETS)) {
  for (const on of ["sw", "routine"]) {
    const o = await popup("A", on);
    await o.ev(`const s = document.createElement("style"); s.textContent = ${JSON.stringify(emojiCss(set))}; r.appendChild(s); r.host._initSeg(r);`);
    await o.p.waitForTimeout(300);
    const el = await (await o.f.evaluateHandle(new Function(`return ${"document.querySelector('device-panel').shadowRoot"}.querySelector('dialog.device .dev-tabs')`))).asElement();
    const file = new URL(`../src/out/bar-${k}-${on}.png`, import.meta.url).pathname;
    await el.screenshot({ path: file });
    bars[`${k}-${on}`] = file;
    await o.ctx.close();
  }
}

// Zusammenstellen: Bilder nebeneinander (Varianten) und ein Blatt mit den Emoji-Sätzen
const o2 = await page(true, { width: 400, height: 400, freeze: false });
const img = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
const outDir = new URL("../", import.meta.url).pathname;
const sheetPage = await o2.ctx.newPage();
await sheetPage.setContent(`<style>body{margin:0;padding:16px;background:#e8ebf0;font:600 15px system-ui;color:#333}.row{display:flex;gap:18px;align-items:flex-start}figure{margin:0;max-width:360px}
  img{display:block;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.15);width:360px}figcaption{margin:8px 2px 0;font-weight:500;line-height:1.35}</style>
  <div class="row">${[["A", "A (Empfehlung): Kacheln im Raster, Symbol und Beschriftung, Zustand darunter, \"an\" farbig"], ["B", "B: Liste, Symbol links, Zustand unter dem Namen, Pfeil rechts"], ["C", "C: kompakte Kacheln in drei Spalten, kleinere Schrift"]]
    .map(([v, cap], i) => `<figure><img src="${img(files[i])}"><figcaption>${cap}</figcaption></figure>`).join("")}</div>`);
await sheetPage.setViewportSize({ width: 1240, height: 400 });
await sheetPage.screenshot({ path: `${outDir}1-Schalter-Handy.png`, fullPage: true });

const barsHtml = (on) => Object.entries(SETS)
  .map(([k, s]) => `<figure><img src="${img(bars[`${k}-${on}`])}"><figcaption>${k}: ${s.sw} Schalter · ${s.rt} Routinen<br><small>${s.note}</small></figcaption></figure>`)
  .join("");
await sheetPage.setContent(`<style>body{margin:0;padding:16px;background:#e8ebf0;font:600 15px system-ui;color:#333}h4{margin:4px 0 10px;font-size:15px}.row{display:grid;grid-template-columns:repeat(2,360px);gap:14px 22px;margin-bottom:22px}
  figure{margin:0}img{display:block;width:360px;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,.15)}figcaption{margin:6px 2px 0;font-weight:500;line-height:1.35}small{color:#666;font-weight:400}</style>
  <h4>Reiter "Schalter" gewählt</h4><div class="row">${barsHtml("sw")}</div><h4>Reiter "Routinen" gewählt</h4><div class="row">${barsHtml("routine")}</div>`);
await sheetPage.setViewportSize({ width: 800, height: 400 });
await sheetPage.screenshot({ path: `${outDir}2-Emoji-Reiterleiste.png`, fullPage: true });

await o2.ctx.close();
await close();
