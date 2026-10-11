// Mockups (Wunsch des Nutzers, 2026-10-11): Der Endpunkt einer ausgeschalteten Meldung ("Kein Push", gestrichelter Ring) sieht
// wie ein Pixelfehler aus. Gesucht: ein klares Zeichen für "aus", in allen Grafiken (Übersicht, Reiter, Integration, Geräte-Popup).
// Im echten Panel (Nachbau, erfundene Daten); die Varianten hängen nur Stile an die echten Klassen (.mk-off).
//   Ist: gestrichelter grauer Ring (bei Balken ohne Ring)
//   A: roter Ring mit rotem X (Wunsch des Nutzers), auch bei den Balken am Ende der gestrichelten Linie
//   B: grauer Ring mit Schrägstrich ("verboten"), neutral
//   C: rotes X ohne Ring
// Aufruf: CHROMIUM_PATH=... node docs/mockups/off-marker-v1/src/render.mjs
import { setup, R } from "../../_lib/mock.mjs";
import { chromium } from "../../../../tests/panel/node_modules/playwright-core/index.mjs";
import { readFileSync, mkdirSync } from "node:fs";

const { page, close } = await setup(8987, import.meta.url);
const OUT = new URL("../", import.meta.url).pathname;
const TMP = new URL("./out/", import.meta.url).pathname;
mkdirSync(TMP, { recursive: true });

const BASE = `.dlg-actions { display: none !important; }
.ptl-row.mk-off .ptl-track i { display: block; }`;
const CROSS = (len, th, col) => `
.mtl-mk.mk-off i::before, .mtl-mk.mk-off i::after, .ptl-row.mk-off .ptl-track i::before, .ptl-row.mk-off .ptl-track i::after { content: ""; position: absolute; left: 50%; top: 50%; width: ${len}px; height: ${th}px; border-radius: 1px; background: ${col}; transform: translate(-50%, -50%) rotate(45deg); }
.mtl-mk.mk-off i::after, .ptl-row.mk-off .ptl-track i::after { transform: translate(-50%, -50%) rotate(-45deg); }`;
const CSS = {
  Ist: ".dlg-actions { display: none !important; }",
  A: `${BASE}${CROSS(7, 1.8, "var(--dp-error)")}
.mtl-mk.mk-off i, .mtl.mtl-b .mtl-mk.mk-off i, .ptl-row.mk-off .ptl-track i { position: relative; width: 16px; height: 16px; border: 2px solid var(--dp-error); border-style: solid; background: color-mix(in srgb, var(--dp-error) 14%, var(--dp-card)); margin-bottom: 3px; }
.ptl-row.mk-off .ptl-track i { position: absolute; margin: 0; top: -1px; left: calc(var(--w) * .8 - 15px); }`,
  B: `${BASE}
.mtl-mk.mk-off i, .mtl.mtl-b .mtl-mk.mk-off i, .ptl-row.mk-off .ptl-track i { position: relative; border: 2px solid var(--dp-text3); border-style: solid; background: var(--dp-card); }
.mtl-mk.mk-off i::before, .ptl-row.mk-off .ptl-track i::before { content: ""; position: absolute; left: 50%; top: 50%; width: 14px; height: 2px; border-radius: 1px; background: var(--dp-text3); transform: translate(-50%, -50%) rotate(-45deg); }`,
  C: `${BASE}${CROSS(11, 2.4, "var(--dp-error)")}
.mtl-mk.mk-off i, .mtl.mtl-b .mtl-mk.mk-off i, .ptl-row.mk-off .ptl-track i { position: relative; border: 0; background: none; }`,
};
// Die Balkenzeile (ptl) hat die Marke am Linienende; Anpassung nur für Ist (Marke bleibt dort aus).
const shots = {};
for (const v of Object.keys(CSS)) {
  const { ctx, p, f, ev } = await page(true, { css: CSS[v], width: 390, height: 844, freeze: false });
  await ev(`r.querySelector(".gear-btn").click()`);
  await p.waitForTimeout(500);
  await ev(`r.querySelector('[data-set="section"][data-id="monitor"]').click()`);
  await p.waitForTimeout(400);
  await ev(`r.host._fetch = () => {}`);
  const files = [];
  const el = async (sel, name, label) => {
    const h = (await f.evaluateHandle(new Function("sel", `return ${R}.querySelector(sel)`), sel)).asElement();
    await h.scrollIntoViewIfNeeded();
    await p.waitForTimeout(150);
    const file = `${TMP}${v}-${name}.png`;
    await h.screenshot({ path: file });
    files.push([file, label]);
  };
  for (const k of ["outage", "battery", "charge", "new"]) await el(`.lane[data-lane="${k}"] .mtl`, `u-${k}`, `Übersicht: ${k}`);
  await ev(`r.querySelector('.mon-tab[data-key="charge"]').click()`);
  await p.waitForTimeout(400);
  await el(`.mon-body .mtl`, "e-charge", "Reiter Laden");
  await ctx.close();
  const d = await page(true, { css: CSS[v], width: 390, height: 844, freeze: false });
  await d.ev(`r.querySelector('.dev[data-open="c"]').click()`);
  await d.p.waitForTimeout(500);
  await d.ev(`r.querySelector('dialog.device [data-tab="set"]').click()`);
  await d.p.waitForTimeout(300);
  await d.ev(`r.host._fetch = () => {}`);
  await d.ev(`r.querySelector('dialog.device [data-stab="chg"]').click()`);
  await d.p.waitForTimeout(400);
  const h = (await d.f.evaluateHandle(new Function(`return ${R}.querySelector("dialog.device .mtl")`))).asElement();
  await h.scrollIntoViewIfNeeded();
  const file = `${TMP}${v}-dev-charge.png`;
  await h.screenshot({ path: file });
  files.push([file, "Geräte-Popup Laden"]);
  await d.ctx.close();
  shots[v] = files;
}

const br = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const img = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
const TITLES = {
  Ist: "Ist: gestrichelter Ring, bei Balken kein Zeichen",
  A: "A: roter Ring mit X (Empfehlung)",
  B: "B: grauer Ring mit Schrägstrich",
  C: "C: rotes X ohne Ring",
};
const p = await br.newPage({ viewport: { width: 1500, height: 400 }, deviceScaleFactor: 2 });
const col = (v) => `<div class="col"><h2>${TITLES[v]}</h2>${shots[v].map(([f, l]) => `<figure><figcaption>${l}</figcaption><img src="${img(f)}"></figure>`).join("")}</div>`;
await p.setContent(`<style>body{margin:0;padding:16px;background:#e8ebf0;font:500 13px system-ui;color:#333}
  .row{display:flex;gap:16px;align-items:flex-start}.col{width:350px}h2{margin:0 0 10px;font-size:14px;line-height:1.3;min-height:36px}
  figure{margin:0 0 10px}figcaption{margin:0 2px 3px;color:#666;font-size:11.5px}img{display:block;width:100%;border-radius:8px;box-shadow:0 1px 6px rgba(0,0,0,.18)}</style>
  <div class="row">${["Ist", "A", "B", "C"].map(col).join("")}</div>`);
await p.screenshot({ path: `${OUT}1-Vergleich.png`, fullPage: true });
await br.close();
await close();
console.log("fertig");
