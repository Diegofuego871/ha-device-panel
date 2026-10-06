// Mockups "Warnung statt Problem" (Wunsch des Nutzers, Entscheid A): Stufen
// "Ausfall" (offline) und "Warnung" (instabil, Batterie niedrig, schwacher
// Empfang, keine Daten). In der Kachel "Gerade ausgefallen" kommt unten eine
// Zeile mit der Zahl der Geräte mit Warnung dazu (antippbar, setzt den Filter),
// dazu zwei Chips: "Ausgefallen" und "Nur Warnungen" (vorher "Nur Probleme").
// V1: eine schlanke Zeile. V2: Zeile mit Aufschlüsselung (instabil, Batterie,
// Empfang). Jede Variante in zwei Zuständen (alles online / mit Ausfällen), auf
// dem Desktop und dem Handy. Im echten Panel (Nachbau aus tests/panel,
// erfundene Daten), die Zusätze eingesetzt.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/chip-warn-v1/src/render.mjs
import { chromium } from "../../../../tests/panel/node_modules/playwright-core/index.mjs";
import { startServer } from "../../../../tests/panel/server.mjs";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
const tmp = fileURLToPath(new URL("./out/", import.meta.url));
mkdirSync(tmp, { recursive: true });
const server = await startServer(8964);
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const R = `document.querySelector("device-panel").shadowRoot`;

const ALERT = "M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z";
const CLOSE = "M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z";
const CHEV = "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,17.58Z";
const ic = (d, s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;

const CSS = `
.hero .kt:nth-child(2) { display: flex; flex-direction: column; }
.mk-warn { display: flex; align-items: center; gap: 8px; margin: auto -18px -16px; padding: 11px 18px; border-top: 1px solid var(--dp-divider); font-size: 13.5px; cursor: pointer; }
.mk-warn .w-ic { display: inline-flex; color: var(--dp-warning); }
.mk-warn b { font-weight: 600; font-variant-numeric: tabular-nums; }
.mk-warn .w-go { margin-left: auto; display: inline-flex; color: var(--dp-text3); }
.kt .durs + .mk-warn, .kt .olist + .mk-warn, .kt .durs + .mk-warn2, .kt .olist + .mk-warn2 { margin-top: 14px; }
.mk-warn.none { color: var(--dp-text2); }
.mk-warn.none .w-ic { color: var(--dp-success); }
.mk-warn2 { margin: auto -18px -16px; padding: 11px 18px 13px; border-top: 1px solid var(--dp-divider); }
.mk-warn2 .head { display: flex; align-items: center; gap: 8px; font-size: 13.5px; }
.mk-warn2 .head .w-ic { display: inline-flex; color: var(--dp-warning); }
.mk-warn2 .head .w-go { margin-left: auto; display: inline-flex; color: var(--dp-text3); }
.mk-warn2 .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.mk-warn2 .tags span { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 9px; border-radius: 999px; background: var(--dp-subtle); font-size: 12px; color: var(--dp-text2); }
.mk-warn2 .tags i { width: 7px; height: 7px; border-radius: 50%; background: var(--dp-warning); }
.mk-warn2 .tags b { color: var(--dp-text); font-weight: 600; }
.chip.mk-off svg { color: var(--dp-error); }
`;

async function page(mobile, withOffline) {
  const ctx = await b.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:8964/ha-sim.html?lang=de&theme=dark`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
  const ev = (code, arg) => f.evaluate(new Function("arg", `const r=${R};` + code), arg);
  if (!withOffline) {
    // Zustand des Nutzers: alles online
    await ev(`const h = r.host; for (const d of h._devices) if (d.online === false) { d.online = true; d.offline_since = null; } h._fetch = () => {}; h._render();`);
  } else await ev(`r.host._fetch = () => {};`);
  await ev(`const s=document.createElement("style"); s.textContent=arg; r.appendChild(s);`, CSS);
  await p.waitForTimeout(300);
  return { ctx, p, f, ev };
}

// Zahl und Aufschlüsselung der Warnungen aus den Geräten (wie die künftige Regel)
const COUNT = `
  const h = r.host;
  const weak = (d) => { const n = h._devices.filter(() => false); return false; };
  const pass = (d) => !d.disabled && !d.unmonitored && d.online !== false && (d.online !== true || d.flaky || d.battery?.low || (d.signal && d.signal.level === 1));
  h._problems = true; const rows = h._devices.filter((d) => h._problemPass(d) && d.online !== false); h._problems = false;
  const flaky = rows.filter((d) => d.flaky).length, bat = rows.filter((d) => d.battery?.low).length;
  return { n: rows.length, flaky, bat, sig: rows.filter((d) => !d.flaky && !d.battery?.low && d.online === true).length + rows.filter((d) => d.flaky && d.battery?.low).length * 0 };
`;

const v1 = (c) => `<div class="mk-warn ${c.n ? "" : "none"}"><span class="w-ic">${ic(ALERT, 16)}</span><span>${c.n ? `<b>${c.n}</b> Geräte mit Warnung` : "Keine Warnungen"}</span>${c.n ? `<span class="w-go">${ic(CHEV, 18)}</span>` : ""}</div>`;
const v2 = (c) => `<div class="mk-warn2"><div class="head"><span class="w-ic">${ic(ALERT, 16)}</span><span><b>${c.n}</b> Geräte mit Warnung</span><span class="w-go">${ic(CHEV, 18)}</span></div>
  <div class="tags"><span><i></i><b>${c.flaky}</b> instabil</span><span><i></i><b>${c.bat}</b> Batterie</span><span><i></i><b>${c.sig}</b> Empfang</span></div></div>`;

async function tileShot(p, f, file) {
  await f.evaluate(new Function(`const t=${R}.querySelectorAll(".hero .kt")[1]; let c=t.parentElement; while (c && c.scrollWidth <= c.clientWidth) c=c.parentElement; if (c) c.scrollLeft = t.offsetLeft - 12;`));
  await p.waitForTimeout(200);
  const d = await f.evaluate(new Function(`const t=${R}.querySelectorAll(".hero .kt")[1].getBoundingClientRect(); return {x:t.x,y:t.y,width:t.width,height:t.height}`));
  const fr = await (await p.$("#panel-frame")).boundingBox();
  await p.screenshot({ path: file, clip: { x: d.x + fr.x - 6, y: d.y + fr.y - 6, width: d.width + 12, height: d.height + 12 } });
}

async function variant(name, html) {
  const files = [];
  for (const mobile of [false, true]) {
    for (const off of [false, true]) {
      const { ctx, p, f, ev } = await page(mobile, off);
      const c = await ev(COUNT);
      // Aufschlüsselung im Beispiel fest (erfundene Zahlen, wie im Panel-Nachbau: 2 instabil, 2 Batterie, 3 Empfang)
      const counts = { n: 7, flaky: 2, bat: 2, sig: 3 };
      await ev(`const t = r.querySelectorAll(".hero .kt")[1]; t.insertAdjacentHTML("beforeend", arg);`, html(counts));
      await p.waitForTimeout(250);
      const file = `${tmp}${name}-${mobile ? "m" : "d"}-${off ? "aus" : "ok"}.png`;
      await tileShot(p, f, file);
      files.push(file);
      await ctx.close();
    }
  }
  return files;
}

// Chip-Leiste mit den neuen Chips: "Ausgefallen" und "Nur Warnungen"
async function chips() {
  const files = [];
  for (const mobile of [false, true]) {
    const { ctx, p, f, ev } = await page(mobile, true);
    await ev(`
      const bar = r.querySelector(".chips");
      const prob = bar.querySelector("[data-problems]");
      prob.querySelector("span").textContent = "Nur Warnungen";
      prob.insertAdjacentHTML("beforebegin", '<button type="button" class="chip mk-off"><svg width="15" height="15" viewBox="0 0 24 24"><path fill="currentColor" d="' + arg.close + '"/></svg><span>Ausgefallen</span> <span class="n">4</span></button>');
      prob.insertAdjacentHTML("beforeend", ' <span class="n">7</span>');
    `, { close: CLOSE });
    await ev(`const bar = r.querySelector(".chips"); const c = bar.querySelector(".mk-off"); bar.scrollLeft = ${mobile ? "Math.max(0, c.offsetLeft - 24)" : "0"};`);
    await p.waitForTimeout(250);
    const d = await f.evaluate(new Function(`const t=${R}.querySelector(".chips").getBoundingClientRect(); return {x:t.x,y:t.y,width:t.width,height:t.height}`));
    const fr = await (await p.$("#panel-frame")).boundingBox();
    const file = `${tmp}chips-${mobile ? "m" : "d"}.png`;
    await p.screenshot({ path: file, clip: { x: d.x + fr.x, y: d.y + fr.y - 4, width: d.width, height: d.height + 8 } });
    files.push(file);
    await ctx.close();
  }
  return files;
}

async function compose(name, items) {
  const p = await b.newPage({ viewport: { width: 400, height: 400 } });
  const img = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
  await p.setContent(`<style>body{margin:0;padding:16px;background:#e8ebf0;font:600 14px system-ui;color:#333}
    .grid{display:grid;grid-template-columns:repeat(2,auto);gap:14px 18px;justify-content:start;align-items:start}figure{margin:0}img{display:block;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.15);max-width:560px}
    figcaption{margin:6px 2px 0;font-weight:500}</style><div class="grid">${items
      .map(([f, cap, w, full]) => `<figure style="${full ? "grid-column:1 / -1" : ""}"><img src="${img(f)}" style="width:${w}px;max-width:none"><figcaption>${cap}</figcaption></figure>`)
      .join("")}</div>`);
  await p.screenshot({ path: `${out}${name}`, fullPage: true });
  await p.close();
}

const a = await variant("V1", v1);
await compose("1-V1-schlanke-zeile.png", [[a[0], "V1, Desktop: alles online, 7 Geräte mit Warnung", 440], [a[1], "V1, Desktop: mit Ausfällen", 440], [a[2], "V1, Handy: alles online", 380], [a[3], "V1, Handy: mit Ausfällen", 380]]);
const c = await variant("V2", v2);
await compose("2-V2-mit-aufschluesselung.png", [[c[0], "V2, Desktop: alles online, mit Aufschlüsselung", 440], [c[1], "V2, Desktop: mit Ausfällen", 440], [c[2], "V2, Handy: alles online", 380], [c[3], "V2, Handy: mit Ausfällen", 380]]);
const k = await chips();
await compose("3-chips.png", [[k[0], "Chip-Leiste Desktop: neu \"Ausgefallen\" und \"Nur Warnungen\" (vorher \"Nur Probleme\"), je mit Zahl", 1100, true], [k[1], "Handy (seitlich auf die neuen Chips gescrollt)", 390, true]]);
await b.close();
server.close();
console.log("fertig");
