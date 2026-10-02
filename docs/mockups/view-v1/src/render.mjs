// Mockups "Ansicht": Spalten, Sortierung, Gruppen/Liste, gespeichert pro
// Benutzer, getrennt für Desktop und Handy. Desktop nach Bild 6 (Variante C,
// entschieden), Handy in zwei Varianten. Im echten Panel (Nachbau aus
// tests/panel, erfundene Daten) mit den Stilen des Panels eingesetzt.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/view-v1/src/render.mjs
import { chromium } from "../../../../tests/panel/node_modules/playwright-core/index.mjs";
import { startServer } from "../../../../tests/panel/server.mjs";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
const tmp = fileURLToPath(new URL("./out/", import.meta.url));
mkdirSync(tmp, { recursive: true });
const server = await startServer(8953);
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const R = `document.querySelector("device-panel").shadowRoot`;

const P = {
  cols: "M16,5V18H21V5M4,18H9V5H4M10,18H15V5H10V18Z",
  sort: "M9,3L5,7H8V14H10V7H13M16,17V10H14V17H11L15,21L19,17H16Z",
  drag: "M9,3H11V5H9V3M13,3H15V5H13V3M9,7H11V9H9V7M13,7H15V9H13V7M9,11H11V13H9V11M13,11H15V13H13V11M9,15H11V17H9V15M13,15H15V17H13V15M9,19H11V21H9V19M13,19H15V21H13V19Z",
  up: "M13,20H11V8L5.5,13.5L4.08,12.08L12,4.16L19.92,12.08L18.5,13.5L13,8V20Z",
  down: "M11,4H13V16L18.5,10.5L19.92,11.92L12,19.84L4.08,11.92L5.5,10.5L11,16V4Z",
  check: "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z",
  chev: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
};
const svg = (name, size = 18, cls = "") => `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${P[name]}"/></svg>`;

const CSS = `
.mk-btn { flex: none; display: inline-flex; align-items: center; gap: 8px; height: 42px; padding: 0 16px; border-radius: 999px;
  border: 1px solid var(--dp-divider); background: var(--dp-card); color: var(--dp-text2); font: inherit; font-size: 14px; }
.mk-btn.on { background: var(--dp-primary-soft); border-color: transparent; color: var(--dp-primary); }
.mk-pop { position: fixed; z-index: 50; width: 340px; padding: 14px 8px 10px; border: 1px solid var(--dp-divider); border-radius: 18px;
  background: var(--dp-card); box-shadow: 0 12px 34px rgba(0,0,0,.22); }
.mk-pop h4 { margin: 0 10px 2px; font-size: 15px; font-weight: 600; }
.mk-sub { margin: 0 10px 10px; color: var(--dp-text2); font-size: 12px; line-height: 1.4; }
.mk-col { display: flex; align-items: center; gap: 10px; min-height: 34px; padding: 0 10px; border-radius: 10px; font-size: 14px; }
.mk-col .l { flex: 1; }
.mk-col .drag { color: var(--dp-text3); }
.mk-col .fix { margin-left: 6px; color: var(--dp-text3); font-size: 11px; }
.mk-col.lift { background: var(--dp-subtle); box-shadow: 0 3px 10px rgba(0,0,0,.18); }
.mk-col.off .l { color: var(--dp-text2); }
.mk-sep { height: 1px; margin: 6px 10px; background: var(--dp-divider); }
.mk-foot { display: flex; justify-content: space-between; padding: 8px 10px 0; color: var(--dp-text2); font-size: 12px; }
.mk-foot b { color: var(--dp-primary); font-weight: 500; }
th.mk-sorted { color: var(--dp-primary); }
th .mk-arrow { margin-left: 4px; vertical-align: -3px; color: var(--dp-primary); }
th .mk-hint { margin-left: 4px; vertical-align: -3px; color: var(--dp-text3); }
.chips .mk-view { margin-left: auto; }
.mk-sortline { display: flex; align-items: center; gap: 8px; margin: 2px 0 10px; color: var(--dp-text2); font-size: 13px; }
.mk-sortline button { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px 0 8px; border: 1px solid var(--dp-divider);
  border-radius: 999px; background: var(--dp-card); color: var(--dp-text); font: inherit; font-size: 13px; }
.mk-sortline button svg { color: var(--dp-primary); }
.mk-sortline .seg-sw { margin-left: auto; }
.mk-pills { display: flex; flex-wrap: wrap; gap: 8px; }
.mk-pill { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border: 1px solid var(--dp-divider);
  border-radius: 999px; background: var(--dp-card); font-size: 13.5px; }
.mk-pill.on { background: var(--dp-primary-soft); border-color: transparent; color: var(--dp-primary); }
.mk-row { display: flex; align-items: center; gap: 12px; min-height: 44px; border-bottom: 1px solid var(--dp-divider); font-size: 14.5px; }
.mk-row:last-child { border-bottom: none; }
.mk-row .l { flex: 1; }
.mk-row .drag { color: var(--dp-text3); }
.mk-row .ck { color: var(--dp-primary); }
.mk-row.on .l { color: var(--dp-primary); font-weight: 500; }
.mk-line { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 10px; font-size: 14px; }
.mk-note { margin-top: 6px; color: var(--dp-text2); font-size: 12px; line-height: 1.4; }
.chip.mk-sortchip { border-color: var(--dp-primary); color: var(--dp-primary); }
.chip.mk-sortchip svg { color: var(--dp-primary); }
`;

async function page(mobile, theme = "light") {
  const ctx = await b.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1400, height: 1240 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:8953/ha-sim.html?lang=de&theme=${theme}`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
  const ev = (code, arg) => f.evaluate(new Function("arg", `const r=${R};` + code), arg);
  // Abfragen anhalten: sonst baut das Panel die eingesetzten Teile neu auf.
  await ev(`r.host._fetch = () => {}; r.host._render = () => {}; const s=document.createElement("style"); s.textContent=arg; r.appendChild(s);`, CSS);
  return { ctx, p, f, ev };
}

// Zeilen in der Tabelle sortieren (innerhalb der Gruppen oder flach).
const SORT_ROWS = `
  const num = (td) => { const m = (td?.textContent || "").replace(",", ".").match(/-?\\d+(\\.\\d+)?/); return m ? Number(m[0]) : Infinity; };
  const tbody = r.querySelector("tbody");
  const rows = [...tbody.children];
  const groups = [];
  for (const tr of rows) { if (tr.classList.contains("grp")) groups.push({ head: tr, rows: [] }); else groups.at(-1).rows.push(tr); }
  const by = (a, b) => num(a.children[arg.col]) - num(b.children[arg.col]);
  tbody.innerHTML = "";
  if (arg.flat) { groups.flatMap((g) => g.rows).sort(by).forEach((tr) => tbody.appendChild(tr)); }
  else for (const g of groups) { tbody.appendChild(g.head); g.rows.sort(by).forEach((tr) => tbody.appendChild(tr)); }
  const ths = [...r.querySelectorAll("thead th")];
  ths.forEach((th, i) => { if (i === arg.col) { th.classList.add("mk-sorted"); th.insertAdjacentHTML("beforeend", arg.arrow); } });
  if (arg.hover != null) ths[arg.hover].insertAdjacentHTML("beforeend", arg.hint);
`;

const seg = (a, active) => `<span class="seg-sw mk-view" role="group">${a.map((x, i) => `<button type="button" class="${i === active ? "on" : ""}">${x}</button>`).join("")}</span>`;

async function desktop(flat) {
  const { ctx, p, ev } = await page(false);
  await ev(`
    const gear = r.querySelector(".toolbar .gear-btn");
    gear.insertAdjacentHTML("beforebegin", '<button type="button" class="mk-btn' + (arg.flat ? '' : ' on') + '">' + arg.colsIcon + 'Spalten</button>');
    r.querySelector(".chips").insertAdjacentHTML("beforeend", arg.seg);
  `, { flat, colsIcon: svg("cols", 18), seg: seg(["Gruppen", "Liste"], flat ? 1 : 0) });
  // Gruppen: nach Verfügbarkeit (Spalte 3) innerhalb der Gruppen; Liste: flach nach Batterie (Spalte 6).
  await ev(SORT_ROWS, { col: flat ? 6 : 3, flat, arrow: svg("up", 15, "mk-arrow"), hover: flat ? 1 : null, hint: svg("sort", 15, "mk-hint") });
  if (!flat) {
    const on = ["Status", "Verbindung", "Verfügbarkeit 24 Std.", "Typ", "Integration", "Batterie", "Hersteller / Modell", "Software"];
    const off = ["Bereich", "Unterbrüche 24 Std.", "Hub / Bridge"];
    const row = (label, checked, extra = "") => `<div class="mk-col${checked ? "" : " off"}${extra}">${svg("drag", 16, "drag")}<span class="l">${label}</span><label class="switch"><input type="checkbox" ${checked ? "checked" : ""}><span></span></label></div>`;
    const html = `<div class="mk-pop"><h4>Spalten</h4><div class="mk-sub">Desktop · für dich gespeichert. Das Handy hat eine eigene Auswahl.</div>
      <div class="mk-col">${svg("drag", 16, "drag")}<span class="l">Gerät<span class="fix">fest</span></span><label class="switch" style="opacity:.45"><input type="checkbox" checked disabled><span></span></label></div>
      ${on.map((l) => row(l, true, l === "Batterie" ? " lift" : "")).join("")}<div class="mk-sep"></div>${off.map((l) => row(l, false)).join("")}
      <div class="mk-foot"><span>Ziehen oder Pfeiltasten zum Verschieben</span><b>Zurücksetzen</b></div></div>`;
    await ev(`
      const btn = r.querySelector(".mk-btn").getBoundingClientRect();
      r.querySelector(".toolbar").insertAdjacentHTML("beforeend", arg);
      const pop = r.querySelector(".mk-pop");
      pop.style.top = (btn.bottom + 8) + "px";
      pop.style.left = (btn.right - 340) + "px";
    `, html);
  }
  await p.waitForTimeout(300);
  const file = `${tmp}D-${flat ? "liste" : "gruppen"}.png`;
  await p.screenshot({ path: file });
  await ctx.close();
  return file;
}

// Handy: Liste mit eingesetzten Bedienelementen, optional ein Blatt.
async function mobile(variant, sheet) {
  const { ctx, p, ev } = await page(true);
  await ev(`
    const gear = r.querySelector(".toolbar .gear-btn");
    gear.insertAdjacentHTML("beforebegin", '<button type="button" class="gear-btn" aria-label="Ansicht">' + arg.cols + '</button>');
    const chips = r.querySelector(".chips");
    if (arg.variant === "A") chips.insertAdjacentHTML("afterend", arg.line);
    else chips.insertAdjacentHTML("afterbegin", arg.chip);
    r.querySelector(".content").scrollTop = chips.offsetTop - 70;
  `, {
    variant,
    cols: svg("cols", 20),
    line: `<div class="mk-sortline"><button type="button">${svg("sort", 16)}Batterie ${svg("up", 14)}${svg("chev", 16)}</button>${seg(["Gruppen", "Liste"], 0)}</div>`,
    chip: `<button type="button" class="chip mk-sortchip">${svg("sort", 15)}<span>Batterie</span>${svg("up", 13)}${svg("chev", 15)}</button><span class="vsep"></span>`,
  });
  const keys = ["Standard (Ausfälle zuerst)", "Name", "Status", "Verfügbarkeit 24 Std.", "Batterie", "Empfang", "Integration", "Typ", "Bereich"];
  const fields = [["Verbindung", true], ["Typ", true], ["Integration", true], ["Bereich", true], ["Batterie", true], ["Verfügbarkeit 24 Std.", false], ["Hersteller / Modell", false], ["Software", false]];
  const fieldRows = fields.map(([l, on]) => `<div class="mk-row">${svg("drag", 18, "drag")}<span class="l">${l}</span><label class="switch"><input type="checkbox" ${on ? "checked" : ""}><span></span></label></div>`).join("");
  const dir = `<div class="mk-line"><span>Richtung</span>${seg([svg("up", 14) + " aufsteigend", svg("down", 14) + " absteigend"], 0).replace("mk-view", "")}</div>`;
  const view = `<div class="mk-line"><span>Darstellung</span>${seg(["Gruppen", "Liste"], 0).replace("mk-view", "")}</div><div class="mk-note">Gruppen: Ausgefallene immer zuoberst, sortiert wird innerhalb der Gruppen.</div>`;
  let body = "";
  let title = "";
  let sub = "";
  let icon = "cols";
  if (sheet === "all") {
    title = "Ansicht";
    sub = "Handy · für dich gespeichert, getrennt vom Desktop";
    body = `<h3>Sortieren nach</h3><div class="mk-pills">${keys.map((k) => `<span class="mk-pill${k === "Batterie" ? " on" : ""}">${k === "Batterie" ? svg("check", 15) : ""}${k}</span>`).join("")}</div>${dir}
      <h3>Darstellung</h3>${view.replace('<div class="mk-line"><span>Darstellung</span>', '<div class="mk-line" style="margin-top:0"><span>Gruppen oder eine Liste</span>')}
      <h3>Angaben auf der Karte</h3>${fieldRows}`;
  } else if (sheet === "sort") {
    title = "Sortieren";
    sub = "Handy · für dich gespeichert, getrennt vom Desktop";
    icon = "sort";
    body = `${keys.map((k) => `<div class="mk-row${k === "Batterie" ? " on" : ""}"><span class="l">${k}</span>${k === "Batterie" ? svg("check", 20, "ck") : ""}</div>`).join("")}${dir}${view}`;
  } else if (sheet === "fields") {
    title = "Angaben auf der Karte";
    sub = "Handy · für dich gespeichert, getrennt vom Desktop";
    body = `<div class="mk-note" style="margin:0 0 6px">Was unter dem Namen steht, in dieser Reihenfolge. Ziehen zum Verschieben.</div>${fieldRows}`;
  }
  if (sheet) {
    await ev(`
      const d = r.querySelector("dialog.stat-dlg");
      d.innerHTML = '<div class="dlg-head"><span class="dlg-avatar">' + arg.icon + '</span><div class="dlg-title"><h2>' + arg.title + '</h2><div class="dlg-sub">' + arg.sub + '</div></div></div>' +
        '<div class="dlg-body" style="padding-top:0">' + arg.body + '</div>' +
        '<div class="dlg-actions"><button class="dlg-btn">Zurücksetzen</button><button class="dlg-btn primary">Fertig</button></div>';
      if (arg.short) d.style.height = "auto";
      d.showModal();
      // Kein Fokusrahmen im Bild (showModal fokussiert den ersten Knopf).
      r.activeElement?.blur();
    `, { icon: svg(icon, 28), title, sub, body, short: sheet === "fields" });
  }
  await p.waitForTimeout(400);
  const file = `${tmp}M-${variant}-${sheet || "liste"}.png`;
  await p.screenshot({ path: file });
  await ctx.close();
  return file;
}

// Bilder nebeneinander mit Beschriftung.
async function compose(name, items, width) {
  const p = await b.newPage({ viewport: { width: 400, height: 400 } });
  const img = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
  await p.setContent(`<style>body{margin:0;padding:16px;background:#e8ebf0;font:600 15px system-ui;color:#333}
    .row{display:flex;gap:18px;align-items:flex-start}figure{margin:0}img{width:${width}px;display:block;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.15)}
    figcaption{margin:8px 2px 0;font-weight:500}</style><div class="row">${items.map(([f, cap]) => `<figure><img src="${img(f)}"><figcaption>${cap}</figcaption></figure>`).join("")}</div>`);
  await p.screenshot({ path: `${out}${name}`, fullPage: true });
  await p.close();
}

const d1 = await desktop(false);
const d2 = await desktop(true);
await compose("1-desktop-gruppen-spalten.png", [[d1, "Desktop (Bild 6): Spalten-Popover; sortiert nach Verfügbarkeit, innerhalb der Gruppen"]], 1400);
await compose("2-desktop-liste.png", [[d2, "Desktop: Ansicht \"Liste\" ohne Gruppen, sortiert nach Batterie; Sortiersymbol beim Darüberfahren (Status)"]], 1400);
const a1 = await mobile("A", null);
const a2 = await mobile("A", "all");
await compose("3-handy-A-ein-blatt.png", [[a1, "A: Zeile \"Sortiert nach\" unter den Chips"], [a2, "A: ein Blatt \"Ansicht\" für alles"]], 390);
const b1 = await mobile("B", null);
const b2 = await mobile("B", "sort");
const b3 = await mobile("B", "fields");
await compose("4-handy-B-sortier-chip.png", [[b1, "B: Sortier-Chip vorne in den Chips"], [b2, "B: Blatt \"Sortieren\""], [b3, "B: Spalten-Knopf: Angaben auf der Karte"]], 390);
await b.close();
server.close();
console.log("fertig");
