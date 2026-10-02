// Mockups "Filter-Chips": Chips der Verbindungsart einzeln ausblenden
// (Standard alle sichtbar; "Alle" und die hinteren Chips bleiben immer).
// A: pro Benutzer in "Ansicht" (Desktop: Popover mit Reitern Spalten und
// Filter-Chips; Handy: Abschnitt im Blatt "Ansicht", Variante A aus view-v1).
// B: pro Benutzer über einen Knopf am Ende der Chips. C: global in den
// Einstellungen, Abschnitt "Anzeige". Im echten Panel (Nachbau aus
// tests/panel, erfundene Daten) mit den Stilen des Panels eingesetzt.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/view-v2/src/render.mjs
import { chromium } from "../../../../tests/panel/node_modules/playwright-core/index.mjs";
import { startServer } from "../../../../tests/panel/server.mjs";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
const tmp = fileURLToPath(new URL("./out/", import.meta.url));
mkdirSync(tmp, { recursive: true });
const server = await startServer(8956);
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const R = `document.querySelector("device-panel").shadowRoot`;

const P = {
  cols: "M16,5V18H21V5M4,18H9V5H4M10,18H15V5H10V18Z",
  sort: "M9,3L5,7H8V14H10V7H13M16,17V10H14V17H11L15,21L19,17H16Z",
  up: "M13,20H11V8L5.5,13.5L4.08,12.08L12,4.16L19.92,12.08L18.5,13.5L13,8V20Z",
  chev: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  pencil: "M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z",
  check: "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z",
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
.mk-tabs { margin: 0 10px 8px; }
.mk-col { display: flex; align-items: center; gap: 10px; min-height: 34px; padding: 0 10px; border-radius: 10px; font-size: 14px; }
.mk-col .l { flex: 1; display: inline-flex; align-items: center; gap: 8px; }
.mk-col .l svg { color: var(--dp-text2); }
.mk-col .n { color: var(--dp-text2); font-size: 12.5px; }
.mk-col.off .l { color: var(--dp-text2); }
.mk-col.fix .l { color: var(--dp-text2); }
.mk-sep { height: 1px; margin: 6px 10px; background: var(--dp-divider); }
.mk-foot { display: flex; justify-content: space-between; padding: 8px 10px 0; color: var(--dp-text2); font-size: 12px; }
.mk-foot b { color: var(--dp-primary); font-weight: 500; }
.mk-edit { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border: 1px dashed var(--dp-divider); border-radius: 999px;
  background: none; color: var(--dp-text2); font: inherit; font-size: 13px; }
.mk-edit.on { border-style: solid; border-color: var(--dp-primary); color: var(--dp-primary); }
.mk-row { display: flex; align-items: center; gap: 12px; min-height: 44px; border-bottom: 1px solid var(--dp-divider); font-size: 14.5px; }
.mk-row:last-child { border-bottom: none; }
.mk-row .l { flex: 1; display: inline-flex; align-items: center; gap: 10px; }
.mk-row .l svg { color: var(--dp-text2); }
.mk-row .n { color: var(--dp-text2); font-size: 13px; }
.mk-note { margin: 6px 0 4px; color: var(--dp-text2); font-size: 12px; line-height: 1.4; }
.mk-sortline { display: flex; align-items: center; gap: 8px; margin: 2px 0 10px; color: var(--dp-text2); font-size: 13px; }
.mk-sortline button { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px 0 8px; border: 1px solid var(--dp-divider);
  border-radius: 999px; background: var(--dp-card); color: var(--dp-text); font: inherit; font-size: 13px; }
.mk-sortline button svg { color: var(--dp-primary); }
.mk-sortline .seg-sw { margin-left: auto; }
`;

// Ausgeblendet im Beispiel: Thread, Bluetooth, Unbekannt.
const HIDE = ["thread", "ble", "unknown"];

async function page(mobile, theme = "light", height = 980) {
  const ctx = await b.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1400, height }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:8956/ha-sim.html?lang=de&theme=${theme}`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
  const ev = (code, arg) => f.evaluate(new Function("arg", `const r=${R};` + code), arg);
  await ev(`r.host._fetch = () => {}; r.host._render = () => {}; const s=document.createElement("style"); s.textContent=arg; r.appendChild(s);`, CSS);
  return { ctx, p, f, ev };
}

// Chips der Verbindungsart mit Symbol und Zahl aus der echten Leiste.
const CHIPS = `return [...r.querySelectorAll(".chip[data-conn]")].filter(c=>c.dataset.conn!=="all").map(c=>({ key: c.dataset.conn, icon: c.querySelector("svg").outerHTML, label: c.querySelector("span").textContent, n: c.querySelector(".n").textContent }))`;
const hideChips = `for (const k of arg) r.querySelector('.chip[data-conn="' + k + '"]')?.remove();`;

function chipRows(chips, cls = "mk-col") {
  const sw = (on) => `<label class="switch"><input type="checkbox" ${on ? "checked" : ""}><span></span></label>`;
  return `<div class="${cls}${cls === "mk-col" ? " fix" : ""}"><span class="l">Alle<span class="n">fest</span></span>${sw(true).replace("<input", '<input disabled').replace('class="switch"', 'class="switch" style="opacity:.45"')}</div>` +
    chips.map((c) => `<div class="${cls}${HIDE.includes(c.key) ? " off" : ""}"><span class="l">${c.icon}${c.label} <span class="n">${c.n}</span></span>${sw(!HIDE.includes(c.key))}</div>`).join("");
}

async function clip(p, f, sel, file, extra = {}) {
  const d = await f.evaluate(new Function(`const d=${R}.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return {x:d.x,y:d.y,width:d.width,height:d.height}`));
  const fr = await (await p.$("#panel-frame")).boundingBox();
  await p.screenshot({ path: file, clip: { x: d.x + fr.x, y: d.y + fr.y, width: d.width, height: d.height, ...extra } });
}

async function desktopA() {
  const { ctx, p, ev } = await page(false);
  const chips = await ev(CHIPS);
  await ev(hideChips, HIDE);
  await ev(`r.querySelector(".toolbar .gear-btn").insertAdjacentHTML("beforebegin", '<button type="button" class="mk-btn on">' + arg + 'Ansicht</button>');`, svg("cols", 18));
  const html = `<div class="mk-pop"><h4>Ansicht</h4><div class="mk-sub">Desktop · für dich gespeichert. Das Handy hat eine eigene Auswahl.</div>
    <div class="mk-tabs"><span class="seg-sw"><button type="button">Spalten</button><button type="button" class="on">Filter-Chips</button></span></div>
    ${chipRows(chips)}<div class="mk-sep"></div>
    <div class="mk-sub" style="margin:4px 10px 0">"Nur Probleme" und die Hinweise (Batterie, Empfang, Updates, eigene Einstellung) bleiben immer.</div>
    <div class="mk-foot"><span></span><b>Zurücksetzen</b></div></div>`;
  await ev(`
    const btn = r.querySelector(".mk-btn").getBoundingClientRect();
    r.querySelector(".toolbar").insertAdjacentHTML("beforeend", arg);
    const pop = r.querySelector(".mk-pop");
    pop.style.top = (btn.bottom + 8) + "px";
    pop.style.left = (btn.right - 340) + "px";
  `, html);
  await p.waitForTimeout(300);
  const file = `${tmp}A-desktop.png`;
  await p.screenshot({ path: file, clip: { x: 0, y: 0, width: 1400, height: 820 } });
  await ctx.close();
  return file;
}

async function mobileA() {
  const { ctx, p, ev } = await page(true);
  const chips = await ev(CHIPS);
  await ev(hideChips, HIDE);
  await ev(`
    const gear = r.querySelector(".toolbar .gear-btn");
    gear.insertAdjacentHTML("beforebegin", '<button type="button" class="gear-btn">' + arg.cols + '</button>');
    r.querySelector(".chips").insertAdjacentHTML("afterend", arg.line);
    const d = r.querySelector("dialog.stat-dlg");
    d.innerHTML = '<div class="dlg-head"><span class="dlg-avatar">' + arg.cols28 + '</span><div class="dlg-title"><h2>Ansicht</h2><div class="dlg-sub">Handy · für dich gespeichert, getrennt vom Desktop</div></div></div>' +
      '<div class="dlg-body" style="padding-top:0"><h3>Sortieren nach</h3><div class="mk-note">… (wie view-v1, Variante A)</div><h3>Darstellung</h3><div class="mk-note">…</div><h3>Angaben auf der Karte</h3><div class="mk-note">…</div><h3>Filter-Chips</h3>' + arg.rows +
      '<div class="mk-note">"Nur Probleme" und die Hinweise bleiben immer.</div></div>' +
      '<div class="dlg-actions"><button class="dlg-btn">Zurücksetzen</button><button class="dlg-btn primary">Fertig</button></div>';
    d.showModal();
    r.activeElement?.blur();
    d.querySelector(".dlg-body").scrollTop = 9999;
  `, {
    cols: svg("cols", 20), cols28: svg("cols", 28), rows: chipRows(chips, "mk-row"),
    line: `<div class="mk-sortline"><button type="button">${svg("sort", 16)}Standard${svg("chev", 16)}</button><span class="seg-sw"><button type="button" class="on">Gruppen</button><button type="button">Liste</button></span></div>`,
  });
  await p.waitForTimeout(400);
  const file = `${tmp}A-mobile.png`;
  await p.screenshot({ path: file });
  await ctx.close();
  return file;
}

async function desktopB() {
  const { ctx, p, ev } = await page(false);
  const chips = await ev(CHIPS);
  await ev(hideChips, HIDE);
  await ev(`r.querySelector(".chip[data-problems]").previousElementSibling.insertAdjacentHTML("beforebegin", '<button type="button" class="mk-edit on">' + arg + 'Chips</button>');`, svg("pencil", 14));
  const html = `<div class="mk-pop"><h4>Filter-Chips</h4><div class="mk-sub">Desktop · für dich gespeichert. Das Handy hat eine eigene Auswahl.</div>
    ${chipRows(chips)}<div class="mk-sep"></div>
    <div class="mk-sub" style="margin:4px 10px 0">"Nur Probleme" und die Hinweise bleiben immer.</div>
    <div class="mk-foot"><span></span><b>Zurücksetzen</b></div></div>`;
  await ev(`
    const btn = r.querySelector(".mk-edit").getBoundingClientRect();
    r.querySelector(".content").insertAdjacentHTML("beforeend", arg);
    const pop = r.querySelector(".mk-pop");
    pop.style.top = (btn.bottom + 8) + "px";
    pop.style.left = Math.max(16, btn.left - 40) + "px";
  `, html);
  await p.waitForTimeout(300);
  const file = `${tmp}B-desktop.png`;
  await p.screenshot({ path: file, clip: { x: 0, y: 0, width: 1400, height: 980 } });
  await ctx.close();
  return file;
}

async function settingsC() {
  const { ctx, p, f, ev } = await page(false, "light", 1300);
  const chips = await ev(CHIPS);
  await ev(`r.host._render = () => {}; r.querySelector(".gear-btn").click()`);
  await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.settings .set-sec")`));
  await ev(`r.querySelector('[data-set="section"][data-id="display"]').click()`);
  await p.waitForTimeout(300);
  await ev(`r.host._renderSettings = () => {};`);
  const rows = chips.map((c) => `<div class="ex-row${HIDE.includes(c.key) ? " off" : ""}"><span class="ibadge type">${c.icon}</span><div class="ex-name">${c.label}<small>${c.n} ${c.n === "1" ? "Gerät" : "Geräte"}</small></div><label class="switch"><input type="checkbox" ${HIDE.includes(c.key) ? "" : "checked"}><span></span></label></div>`).join("");
  await ev(`
    const body = r.querySelector('[data-id="display"]').closest(".set-sec").querySelector(".set-sec-body");
    body.insertAdjacentHTML("beforeend", '<div class="opt" style="border-bottom:none"><div class="opt-line"><span class="opt-label">Filter-Chips der Verbindungsart</span></div><div class="opt-short">Gilt für alle Benutzer. "Alle", "Nur Probleme" und die Hinweise bleiben immer.</div></div><div class="ex-head"><span></span><span>Anzeigen</span></div>' + arg);
    body.closest(".set-sec").scrollIntoView({ block: "start" });
  `, rows);
  await p.waitForTimeout(300);
  const file = `${tmp}C-settings.png`;
  await clip(p, f, "dialog.settings", file);
  await ctx.close();
  return file;
}

async function compose(name, items) {
  const p = await b.newPage({ viewport: { width: 400, height: 400 } });
  const img = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
  await p.setContent(`<style>body{margin:0;padding:16px;background:#e8ebf0;font:600 15px system-ui;color:#333}
    .row{display:flex;gap:18px;align-items:flex-start}figure{margin:0}img{display:block;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.15)}
    figcaption{margin:8px 2px 0;font-weight:500}</style><div class="row">${items
      .map(([f, cap, w]) => `<figure style="max-width:${w}px"><img src="${img(f)}" style="width:${w}px"><figcaption>${cap}</figcaption></figure>`)
      .join("")}</div>`);
  await p.screenshot({ path: `${out}${name}`, fullPage: true });
  await p.close();
}

const ad = await desktopA();
const am = await mobileA();
await compose("1-A-ansicht.png", [[ad, "A (Empfehlung): pro Benutzer im Popover \"Ansicht\" (Reiter Spalten | Filter-Chips); Thread, Bluetooth und Unbekannt ausgeblendet", 1000], [am, "A auf dem Handy: Abschnitt \"Filter-Chips\" im Blatt \"Ansicht\"", 390]]);
const bd = await desktopB();
await compose("2-B-knopf-bei-den-chips.png", [[bd, "B: pro Benutzer über einen Knopf \"Chips\" am Ende der Verbindungs-Chips (Handy: gleiches Blatt)", 1200]]);
const cs = await settingsC();
await compose("3-C-einstellungen-global.png", [[cs, "C: global für alle Benutzer in den Einstellungen, Abschnitt \"Anzeige\"", 640]]);
await b.close();
server.close();
console.log("fertig");
