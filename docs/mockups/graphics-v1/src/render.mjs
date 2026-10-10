// Mockups (Wunsch des Nutzers, 2026-10-10): Alle Zeitstrahl-Grafiken einheitlich. Linien und Balken enden bei etwa
// 80 % der Breite, der Wert steht am Endpunkt. Im echten Panel (Nachbau, erfundene Daten): Die Varianten
// ersetzen im Nachbau _tlHtml und _ptlHtml und hängen Stile an; die echten Daten und Texte bleiben.
//   Ist: heutiger Stand (Balken bis zum Rand, Wert am rechten Rand beziehungsweise bei etwa 78 % auf der Linie)
//   A: Wert unter dem Endpunkt (Ring, darunter Wert und Beschreibung, mittig am Endpunkt)
//   B: Wert über dem Endpunkt (Wert und Beschreibung über dem Ring, mittig am Endpunkt)
// Aufruf: CHROMIUM_PATH=... node docs/mockups/graphics-v1/src/render.mjs
import { setup, R } from "../../_lib/mock.mjs";
import { chromium } from "../../../../tests/panel/node_modules/playwright-core/index.mjs";
import { readFileSync, mkdirSync } from "node:fs";

const { page, close } = await setup(8973, import.meta.url);
const OUT = new URL("../", import.meta.url).pathname;
const TMP = new URL("./out/", import.meta.url).pathname;
mkdirSync(TMP, { recursive: true });

// Gemeinsam: letzte Marke bei 80 %, Balken höchstens 80 % (Skript im Nachbau, Texte und Daten bleiben).
const JS = `
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const X = (at) => (at > 50 ? 80 : at);
r.host._tlHtml = function (marks, kind = "") {
  return '<div class="mtl' + (kind ? " " + kind : "") + '"><div class="mtl-bar"></div>' + marks.map((m) =>
    '<div class="mtl-mk' + (m.cls ? " " + m.cls : "") + '" style="left:' + X(m.at) + '%;--x:' + X(m.at) + '%"><i></i><b>' + esc(m.title) + '</b>' + (m.html || (m.sub ? '<span>' + esc(m.sub) + '</span>' : "")) + '</div>').join("") + '</div>';
};
r.host._ptlHtml = function (rows, edit = false, zero = "tlGone") {
  const t = (k, ...a) => this._t(k, ...a);
  return '<div class="mtl ptl' + (edit ? " ptl-e" : "") + '"><div class="ptl-zero"><b>0</b><span>' + esc(t(zero)) + '</span></div>' + rows.map((r) =>
    '<div class="ptl-row' + (r.cls ? " " + r.cls : "") + '" style="--w:' + r.w + '%"' + (r.key ? ' data-ptl="' + r.key + '"' : "") + '><div class="ptl-track"><i></i>' +
    (r.ghost != null ? '<em style="left:calc(' + r.ghost * 0.8 + '% - 6px)"></em>' : "") +
    '<div class="mtl-mk ptl-txt"><b>' + esc(r.title) + '</b>' + (r.html || (r.sub ? '<span>' + esc(r.sub) + '</span>' : "")) + '</div></div></div>').join("") + '</div>';
};
`;

const BASE = `
.dlg-actions { display: none !important; }
.mtl-bar { right: 20%; }
.ptl-track::before { width: calc(var(--w) * .8); }
.ptl-track i { left: calc(var(--w) * .8 - 14px); }
.ptl-txt i { display: none; }
.ptl-txt { width: 150px; }
`;
const CSS = {
  Ist: ".dlg-actions { display: none !important; }",
  A: `${BASE}
.ptl-row { padding-bottom: 38px; margin-bottom: 2px; }
.ptl-e .ptl-row { padding-bottom: 68px; }
.ptl-txt { top: 19px; left: max(calc(var(--w) * .8 - 7px), 75px); }
`,
  B: `${BASE}
.mtl { height: 66px; }
.mtl.mtl-e { height: 96px; }
.mtl-bar { top: auto; bottom: 5px; }
.mtl-mk { top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: flex-end; }
.mtl-mk b { order: 1; }
.mtl-mk > span, .mtl-mk .opt-select, .mtl-mk .opt-input.mtl-in { order: 2; }
.mtl-mk i { order: 3; margin: 5px auto 0; flex: none; }
.mtl-mk .opt-select { align-self: center; }
.ptl-row { padding-top: 40px; margin-bottom: 4px; }
.ptl-e .ptl-row { padding-top: 70px; }
.ptl-txt { top: auto; bottom: 19px; left: max(calc(var(--w) * .8 - 7px), 75px); display: flex; flex-direction: column; justify-content: flex-end; }
.ptl-txt .opt-input.mtl-in { align-self: center; margin-bottom: 3px; }
`,
};

const shots = {};
for (const v of Object.keys(CSS)) {
  const { ctx, p, f, ev } = await page(true, { css: CSS[v], width: 390, height: 844, freeze: false });
  if (v !== "Ist") await ev(JS);
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
  const tab = async (key) => {
    await ev(`r.querySelector('.mon-tab[data-key="${key}"]').click()`);
    await p.waitForTimeout(350);
  };
  // Übersicht: Streifen (Ansicht)
  for (const k of ["outage", "battery", "charge", "new", "updates"]) await el(`.lane[data-lane="${k}"] .mtl`, `u-${k}`, `Übersicht: ${k}`);
  // Bearbeiten
  await tab("outage");
  await el(`.mon-body .mtl`, "e-outage", "Ausfall (Bearbeiten)");
  await tab("battery");
  await el(`.mon-body .mtl`, "e-battery", "Batterie (Bearbeiten)");
  await tab("charge");
  await el(`.mon-body .mtl`, "e-charge", "Laden (Bearbeiten)");
  await tab("new");
  await el(`.mon-body .mtl`, "e-new", "Neu (Bearbeiten)");
  if (v === "Ist") {
    const m = await ev(`const i = r.querySelector('.mon-body .mtl .opt-input.mtl-in'); const b = i && i.getBoundingClientRect(); const c = r.querySelector('.mon-body').getBoundingClientRect(); return {inputW: b && Math.round(b.width), bodyW: Math.round(c.width), rest20: Math.round(c.width * 0.2)};`);
    console.log("Mass:", JSON.stringify(m));
  }
  shots[v] = files;
  await ctx.close();
}

// Spalten zusammensetzen: je Variante eine Spalte, oben Übersicht, unten Bearbeiten
const br = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const img = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
const TITLES = {
  Ist: "Ist: Balken bis zum Rand, Wert mal rechts, mal bei etwa 78 %",
  A: "A: Ende bei 80 %, Wert unter dem Endpunkt",
  B: "B: Ende bei 80 %, Wert über dem Endpunkt",
};
async function sheet(name, pick, vars) {
  const p = await br.newPage({ viewport: { width: 1250, height: 400 }, deviceScaleFactor: 2 });
  const col = (v) =>
    `<div class="col"><h2>${TITLES[v]}</h2>${shots[v].filter(([f]) => pick(f)).map(([f, l]) => `<figure><figcaption>${l}</figcaption><img src="${img(f)}"></figure>`).join("")}</div>`;
  await p.setContent(`<style>body{margin:0;padding:16px;background:#e8ebf0;font:500 13px system-ui;color:#333}
    .row{display:flex;gap:18px;align-items:flex-start}.col{width:370px}h2{margin:0 0 10px;font-size:14px;line-height:1.3;min-height:36px}
    figure{margin:0 0 12px}figcaption{margin:0 2px 4px;color:#666;font-size:11.5px}img{display:block;width:100%;border-radius:8px;box-shadow:0 1px 6px rgba(0,0,0,.18)}</style>
    <div class="row">${vars.map(col).join("")}</div>`);
  await p.screenshot({ path: `${OUT}${name}`, fullPage: true });
  await p.close();
}
await sheet("1-Uebersicht.png", (f) => /-u-/.test(f), ["Ist", "A", "B"]);
await sheet("2-Bearbeiten.png", (f) => /-e-/.test(f), ["Ist", "A", "B"]);
await br.close();
await close();
console.log("fertig");
