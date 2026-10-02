// Mockups "Filter nach Bereich": jeder filtert nach seinen Bereichen,
// gespeichert pro Benutzer mit der Ansicht (0.19.0).
// A: Chip "Bereich" mit Auswahl (mehrere Bereiche, nach Etage gruppiert).
// B: eigene Chip-Zeile mit einem Chip pro Bereich.
// C: Auswahl im Popover "Spalten" bzw. im Blatt "Ansicht".
// Im echten Panel (Nachbau aus tests/panel, erfundene Daten).
// Aufruf: CHROMIUM_PATH=... node docs/mockups/area-v1/src/render.mjs
import { chromium } from "../../../../tests/panel/node_modules/playwright-core/index.mjs";
import { startServer } from "../../../../tests/panel/server.mjs";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
const tmp = fileURLToPath(new URL("./out/", import.meta.url));
mkdirSync(tmp, { recursive: true });
const server = await startServer(8961);
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const R = `document.querySelector("device-panel").shadowRoot`;

const P = {
  home: "M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z",
  chev: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  close: "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
  search: "M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z",
};
const svg = (n, s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${P[n]}"/></svg>`;

// Etagen und Bereiche (erfunden) mit Zahl der Geräte aus dem Nachbau.
const FLOORS = [
  ["Erdgeschoss", [["Küche", 2], ["Wohnzimmer", 2], ["Flur", 2], ["Eingang", 1]]],
  ["Obergeschoss", [["Bad", 1], ["Büro", 2], ["Kinderzimmer", 1]]],
  ["Untergeschoss", [["Keller", 3]]],
  ["Aussen", [["Terrasse", 1]]],
  ["Ohne Etage", [["Ohne Bereich", 2]]],
];
const PICKED = new Set(["Küche", "Wohnzimmer", "Flur", "Eingang"]);

const CSS = `
.mk-chip-area { border-color: var(--dp-primary); }
.chip.mk-on { background: var(--dp-primary-soft); border-color: transparent; color: var(--dp-primary); }
.chip.mk-on svg { color: var(--dp-primary); }
.mk-x { display: inline-grid; place-items: center; width: 18px; height: 18px; margin-right: -4px; border-radius: 50%; background: color-mix(in srgb, var(--dp-primary) 18%, transparent); }
.mk-pop { position: fixed; z-index: 50; width: 330px; max-height: 560px; overflow: auto; padding: 12px 8px 10px; border: 1px solid var(--dp-divider);
  border-radius: 18px; background: var(--dp-card); color: var(--dp-text); box-shadow: 0 12px 34px rgba(0,0,0,.22); }
.mk-pop h4 { margin: 0 10px 2px; font-size: 15px; font-weight: 600; }
.mk-sub { margin: 0 10px 8px; color: var(--dp-text2); font-size: 12px; line-height: 1.4; }
.mk-search { display: flex; align-items: center; gap: 8px; height: 34px; margin: 0 6px 6px; padding: 0 10px; border: 1px solid var(--dp-divider);
  border-radius: 10px; background: var(--dp-input); color: var(--dp-text2); font-size: 13px; }
.mk-floor { display: flex; align-items: center; gap: 10px; min-height: 34px; padding: 6px 10px 2px; font-size: 12px; font-weight: 600;
  letter-spacing: .04em; text-transform: uppercase; color: var(--dp-text2); }
.mk-floor .l { flex: 1; }
.mk-area { display: flex; align-items: center; gap: 10px; min-height: 34px; padding: 0 10px 0 22px; font-size: 14px; }
.mk-area .l { flex: 1; }
.mk-area .n { color: var(--dp-text3); font-size: 12px; }
.mk-ck { width: 18px; height: 18px; border-radius: 5px; border: 2px solid var(--dp-text3); display: grid; place-items: center; }
.mk-ck.on { border-color: var(--dp-primary); background: var(--dp-primary); }
.mk-ck.part { border-color: var(--dp-primary); background: linear-gradient(var(--dp-primary), var(--dp-primary)) center/8px 2px no-repeat; }
.mk-ck.on::after { content: ""; width: 9px; height: 5px; border: 2px solid #fff; border-top: 0; border-right: 0; transform: rotate(-45deg) translate(1px,-1px); }
.mk-foot { display: flex; justify-content: space-between; margin-top: 6px; padding: 8px 10px 0; border-top: 1px solid var(--dp-divider); font-size: 12px; color: var(--dp-text2); }
.mk-foot b { color: var(--dp-primary); font-weight: 500; }
.mk-row2 { display: flex; gap: 8px; flex-wrap: wrap; margin: -4px 0 12px; }
.mk-sec { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--dp-divider); }
`;

const ck = (state) => `<span class="mk-ck ${state}"></span>`;
const listHtml = () => FLOORS.map(([floor, areas]) => {
  const n = areas.filter(([a]) => PICKED.has(a)).length;
  const state = n === areas.length ? "on" : n ? "part" : "";
  return `<div class="mk-floor">${ck(state)}<span class="l">${floor}</span></div>` +
    areas.map(([a, c]) => `<div class="mk-area">${ck(PICKED.has(a) ? "on" : "")}<span class="l">${a}</span><span class="n">${c}</span></div>`).join("");
}).join("");

async function page(mobile) {
  const ctx = await b.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:8961/ha-sim.html?lang=de&theme=${mobile ? "dark" : "light"}`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
  const ev = (code, arg) => f.evaluate(new Function("arg", `const r=${R};` + code), arg);
  // Liste wie gefiltert: nur Geräte im Erdgeschoss.
  await ev(`r.host._fetch = () => {}; const s=document.createElement("style"); s.textContent=arg; r.appendChild(s);
    r.host._devices = r.host._devices.filter(d => ["Küche","Wohnzimmer","Flur","Eingang"].includes(d.area)); r.host._render(); r.host._render = () => {};`, CSS);
  return { ctx, p, f, ev };
}

async function shot(p, f, mobile, file, sel) {
  if (mobile || !sel) return p.screenshot({ path: file });
  return p.screenshot({ path: file, clip: { x: 0, y: 40, width: 1400, height: 900 } });
}

async function variantA(mobile) {
  const { ctx, p, f, ev } = await page(mobile);
  const chip = `<button type="button" class="chip mk-on">${svg("home", 15)}<span>Erdgeschoss</span> <span class="n">7</span><span class="mk-x">${svg("close", 12)}</span></button>`;
  await ev(`const ps=r.querySelector(".chips [data-problems]"); ps.insertAdjacentHTML("beforebegin", arg);`, chip);
  const body = `<div class="mk-search">${svg("search", 16)}Bereich suchen</div>${listHtml()}`;
  if (!mobile) {
    await ev(`const c=r.querySelector(".chip.mk-on").getBoundingClientRect(); r.querySelector(".toolbar").insertAdjacentHTML("beforeend", '<div class="mk-pop" style="top:' + (c.bottom + 8) + 'px;left:' + c.left + 'px"><h4>Bereiche</h4><div class="mk-sub">Für dich gespeichert. Eine Etage wählt alle ihre Bereiche.</div>' + arg + '<div class="mk-foot"><span>4 von 10 Bereichen</span><b>Alle zeigen</b></div></div>')`, body);
  } else {
    await ev(`r.querySelector(".content").scrollTop = r.querySelector(".chips").offsetTop - 80; const ch=r.querySelector(".chips"); ch.scrollLeft = r.querySelector(".chip.mk-on").offsetLeft - 120;`);
    await p.screenshot({ path: `${tmp}A-mobile-list.png` });
    await ev(`const d=r.querySelector("dialog.stat-dlg"); d.innerHTML='<div class="dlg-head"><span class="dlg-avatar">' + arg.icon + '</span><div class="dlg-title"><h2>Bereiche</h2><div class="dlg-sub">Für dich gespeichert · Handy und Desktop getrennt</div></div></div><div class="dlg-body" style="padding-top:0">' + arg.body + '</div><div class="dlg-actions"><button class="dlg-btn">Alle zeigen</button><button class="dlg-btn primary">Fertig</button></div>'; d.showModal(); r.activeElement?.blur();`, { icon: svg("home", 28), body });
  }
  await p.waitForTimeout(300);
  const file = `${tmp}A-${mobile ? "mobile" : "desktop"}.png`;
  await shot(p, f, mobile, file, true);
  await ctx.close();
  return file;
}

async function variantB(mobile) {
  const { ctx, p, f, ev } = await page(mobile);
  const areas = FLOORS.flatMap(([, a]) => a);
  const row = `<div class="chips mk-row2">${`<button type="button" class="chip">${svg("home", 15)}<span>Alle Bereiche</span></button>`}${areas
    .map(([a, n]) => `<button type="button" class="chip ${PICKED.has(a) ? "mk-on" : ""}"><span>${a}</span> <span class="n">${n}</span></button>`).join("")}</div>`;
  await ev(`r.querySelector(".chips").insertAdjacentHTML("afterend", arg); if (${mobile}) r.querySelector(".content").scrollTop = r.querySelector(".chips").offsetTop - 80;`, row);
  await p.waitForTimeout(300);
  const file = `${tmp}B-${mobile ? "mobile" : "desktop"}.png`;
  await shot(p, f, mobile, file, true);
  await ctx.close();
  return file;
}

async function variantC(mobile) {
  const { ctx, p, f, ev } = await page(mobile);
  const sec = `<div class="mk-sec"><h4>Bereiche</h4><div class="mk-sub">Nur Geräte in diesen Bereichen zeigen.</div>${listHtml()}</div>`;
  if (!mobile) {
    await ev(`r.querySelector(".view-btn").click()`);
    await p.waitForTimeout(200);
    await ev(`r.host._renderCols = () => {}; const pop=r.querySelector(".cols-pop"); pop.querySelector(".vfoot").insertAdjacentHTML("afterend", arg); pop.style.maxHeight = "620px"; pop.scrollTop = 330;`, sec);
  } else {
    await ev(`r.querySelector(".view-btn").click()`);
    await p.waitForTimeout(300);
    await ev(`r.host._renderViewSheet = () => {}; const d=r.querySelector("dialog.view"); d.querySelector(".dlg-body").insertAdjacentHTML("afterbegin", arg.replace('mk-sec','mk-sec" style="border-top:0;margin-top:0')); d.scrollTop = 0; r.activeElement?.blur();`, sec.replace("<h4>Bereiche</h4>", "<h3>Bereiche</h3>"));
  }
  await p.waitForTimeout(300);
  const file = `${tmp}C-${mobile ? "mobile" : "desktop"}.png`;
  await shot(p, f, mobile, file, true);
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

const aD = await variantA(false);
const aM = await variantA(true);
await compose("1-A-chip-auswahl.png", [[aD, "A (Empfehlung): Chip \"Bereich\" mit Auswahl, nach Etage gruppiert; aktiv mit Name und ×", 900], [`${tmp}A-mobile-list.png`, "A auf dem Handy: Chip in der Zeile", 300], [aM, "A: Blatt \"Bereiche\"", 300]]);
const bD = await variantB(false);
const bM = await variantB(true);
await compose("2-B-chip-zeile.png", [[bD, "B: eigene Chip-Zeile, ein Chip pro Bereich (mehrere wählbar)", 900], [bM, "B auf dem Handy", 360]]);
const cD = await variantC(false);
const cM = await variantC(true);
await compose("3-C-in-ansicht.png", [[cD, "C: im Popover \"Spalten\" (Desktop)", 900], [cM, "C: im Blatt \"Ansicht\" (Handy)", 360]]);
await b.close();
server.close();
console.log("fertig");
