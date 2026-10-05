// Mockups "Anheften" (Wunsch des Nutzers): Alles oberhalb eines Markers in der
// Chip-Liste bleibt beim seitlichen Scrollen der Leiste links stehen. Die
// Leiste scrollt nur auf schmalen Bildschirmen (Handy, bis 600 px); auf dem
// Desktop bricht sie um, dort ändert sich nichts. Beispiel: "Alle" ist
// angeheftet. A: Marker als eigene Zeile (Anheft-Zeile) mit getönten Zeilen
// darüber, Vorschau mit Beschriftung "angeheftet | scrollt". B: schlanke Linie
// mit Pin-Etikett, Vorschau nur mit Haftkante. Im echten Panel (Nachbau aus
// tests/panel, erfundene Daten), die Zusätze eingesetzt.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/chip-pin-v1/src/render.mjs
import { chromium } from "../../../../tests/panel/node_modules/playwright-core/index.mjs";
import { startServer } from "../../../../tests/panel/server.mjs";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
const tmp = fileURLToPath(new URL("./out/", import.meta.url));
mkdirSync(tmp, { recursive: true });
const server = await startServer(8962);
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const R = `document.querySelector("device-panel").shadowRoot`;

const PIN = "M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z";
const pinIc = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${PIN}"/></svg>`;

const CSS = `
/* Vorschau als Leiste des Handys: eine Zeile, seitlich scrollbar, Angeheftetes klebt links */
.mk-strip { display: flex; align-items: center; gap: 8px; overflow-x: auto; scrollbar-width: none; margin: 0 -12px; padding: 6px 12px 8px; }
.mk-strip::-webkit-scrollbar { display: none; }
.mk-strip .chip { flex: none; height: 28px; padding: 0 10px; font-size: 12.5px; pointer-events: none; }
.mk-pinned { position: sticky; left: -12px; z-index: 2; flex: none; display: flex; align-items: center; gap: 8px; margin-left: -12px; padding: 4px 12px 4px 12px;
  background: var(--dp-bg); }
.mk-pinned::after { content: ""; position: absolute; right: -14px; top: 0; bottom: 0; width: 14px; background: linear-gradient(90deg, rgba(0,0,0,.28), transparent); pointer-events: none; }
.mk-labels { display: flex; margin: 0 -12px; padding: 0 12px; font-size: 10.5px; line-height: 1.2; color: var(--dp-text2); }
.mk-labels .l1 { flex: none; color: var(--dp-primary); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
.mk-labels .l2 { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; }
.mk-edge-pin { position: absolute; z-index: 3; width: 22px; height: 22px; border-radius: 999px; display: grid; place-items: center;
  background: var(--dp-primary); color: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.35); }
/* A: Anheft-Zeile */
.ex-row.mk-pinrow { margin: 8px -8px; padding: 10px 10px; border: 1px dashed var(--dp-primary); border-radius: 12px; background: var(--dp-primary-soft); }
.drag-list .ex-row.mk-pinrow:last-child { border-bottom: 1px dashed var(--dp-primary); }
.mk-pinrow .ibadge { background: var(--dp-primary); color: #fff; }
.mk-count { flex: none; display: inline-flex; align-items: center; height: 24px; padding: 0 9px; border-radius: 999px; background: var(--dp-card); border: 1px solid var(--dp-divider);
  color: var(--dp-text2); font-size: 11.5px; font-weight: 500; }
.ex-row.mk-above { background: color-mix(in srgb, var(--dp-primary) 9%, transparent); box-shadow: inset 3px 0 0 var(--dp-primary); border-radius: 8px; }
.ex-row.mk-above .drag-h { margin-left: 4px; }
/* B: schlanke Linie */
.ex-row.mk-line { display: block; position: relative; min-height: 0; height: 34px; padding: 0; margin: 2px 0; border: none; }
.mk-line::before { content: ""; position: absolute; left: 0; right: 0; top: 50%; border-top: 2px dashed var(--dp-primary); }
.mk-tab { position: absolute; left: 0; top: 50%; transform: translateY(-50%); display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px 0 4px;
  border-radius: 999px; background: var(--dp-primary); color: #fff; font-size: 12.5px; font-weight: 600; }
.mk-tab .drag-h { color: rgba(255,255,255,.85); width: 24px; height: 28px; margin: 0; background: none; }
.mk-tab .drag-h svg { color: inherit; }
`;

async function page(mobile, height) {
  const ctx = await b.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1400, height }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:8962/ha-sim.html?lang=de&theme=dark`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
  const ev = (code, arg) => f.evaluate(new Function("arg", `const r=${R};` + code), arg);
  // Wie beim Nutzer: "Alle" zuerst, Bereich ausgeblendet.
  await p.evaluate(() => {
    window.__opts.chip_order = ["all", "batteries", "area", "integration", "zigbee", "wifi", "thread", "zwave", "ble", "network", "cloud", "unknown", "matter", "ethernet", "problems", "battery", "signal", "update", "override", "new"];
    window.__opts.hide_chips = ["area"];
  });
  await ev(`r.host._fetch()`);
  await p.waitForTimeout(400);
  await ev(`r.querySelector(".gear-btn").click()`);
  await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.settings .set-sec")`));
  await ev(`r.querySelector('[data-set="section"][data-id="look"]').click()`);
  await ev(`r.querySelector('[data-set="subtab"][data-key="chips"]').click()`);
  await f.waitForFunction(new Function(`return ${R}.querySelector('.drag-list[data-drag-list="chip_order"]')`));
  await p.waitForTimeout(300);
  await ev(`const s=document.createElement("style"); s.textContent=arg; r.appendChild(s); r.host._renderSettings = () => {};`, CSS);
  return { ctx, p, f, ev };
}

// Vorschau: eine scrollbare Zeile, die ersten n Chips angeheftet, seitlich gescrollt
const stripJs = `
  const box = r.querySelector(".chip-prev-pills");
  const kids = [...box.children].filter((x) => !x.classList.contains("vsep"));
  const pinned = kids.slice(0, arg.n), rest = kids.slice(arg.n);
  const strip = document.createElement("div");
  strip.className = "mk-strip";
  const grp = document.createElement("div");
  grp.className = "mk-pinned";
  pinned.forEach((x) => grp.appendChild(x));
  strip.appendChild(grp);
  rest.forEach((x) => strip.appendChild(x));
  box.replaceChildren(strip);
  if (arg.labels) box.insertAdjacentHTML("afterend", '<div class="mk-labels"><span class="l1">' + arg.pin + 'angeheftet</span><span class="l2">scrollt seitlich ›</span></div>');
  r.querySelector(".chip-prev-t").textContent = arg.title;
  requestAnimationFrame(() => { strip.scrollLeft = arg.scroll; });
`;

// A: Anheft-Zeile nach der Zeile "Alle", Zeilen darüber getönt
const rowJs = `
  const list = r.querySelector('.drag-list[data-drag-list="chip_order"]');
  const rows = [...list.children];
  const i = rows.findIndex((x) => x.querySelector('[data-key="' + arg.after + '"]'));
  rows.slice(0, i + 1).forEach((x) => x.classList.add("mk-above"));
  const drag = rows[0].querySelector(".drag-h").outerHTML.replace(/data-key="[^"]*"/, 'data-key="pin"');
  const el = document.createElement("div");
  el.className = "ex-row mk-pinrow";
  el.innerHTML = drag + '<span class="ibadge">' + arg.pin + '</span><div class="ex-name">Anheften<small>Alles darüber bleibt beim seitlichen Scrollen links stehen</small></div><span class="mk-count">' + (i + 1) + ' angeheftet</span>';
  rows[i].after(el);
`;

// B: schlanke Linie mit Pin-Etikett
const lineJs = `
  const list = r.querySelector('.drag-list[data-drag-list="chip_order"]');
  const rows = [...list.children];
  const i = rows.findIndex((x) => x.querySelector('[data-key="' + arg.after + '"]'));
  const drag = rows[0].querySelector(".drag-h").outerHTML.replace(/data-key="[^"]*"/, 'data-key="pin"');
  const el = document.createElement("div");
  el.className = "ex-row mk-line";
  el.innerHTML = '<span class="mk-tab">' + drag + arg.pin + '<span>angeheftet bis hier</span></span>';
  rows[i].after(el);
`;

async function shot(p, f, ev, name, mobile) {
  await ev(`const e = r.querySelector(".chip-prev"); e.scrollIntoView({ block: "start" });
    let c = e.parentElement; while (c && c.scrollHeight <= c.clientHeight) c = c.parentElement;
    if (c) c.scrollTop -= arg;`, mobile ? 150 : 110);
  await p.waitForTimeout(300);
  const file = `${tmp}${name}-${mobile ? "mobile" : "desktop"}.png`;
  if (mobile) await p.screenshot({ path: file });
  else {
    const d = await f.evaluate(new Function(`const d=${R}.querySelector("dialog.settings").getBoundingClientRect(); return {x:d.x,y:d.y,width:d.width,height:d.height}`));
    const fr = await (await p.$("#panel-frame")).boundingBox();
    await p.screenshot({ path: file, clip: { x: d.x + fr.x, y: d.y + fr.y, width: d.width, height: d.height } });
  }
  return file;
}

async function variant(name, kind) {
  const files = [];
  for (const mobile of [false, true]) {
    const { ctx, p, f, ev } = await page(mobile, 1000);
    if (kind === "A") {
      await ev(stripJs, { n: 1, scroll: 130, labels: true, pin: pinIc(11), title: "So sieht die Leiste auf dem Handy aus" });
      await ev(rowJs, { after: "all", pin: pinIc(16) });
    } else {
      await ev(stripJs, { n: 1, scroll: 130, labels: false, pin: pinIc(11), title: "So sieht die Leiste auf dem Handy aus" });
      await ev(lineJs, { after: "all", pin: pinIc(14) });
    }
    files.push(await shot(p, f, ev, name, mobile));
    await ctx.close();
  }
  return files;
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

const [ad, am] = await variant("A", "A");
await compose("1-A-anheft-zeile.png", [[am, "A (Handy): Anheft-Zeile mit Pin; die Zeilen darüber sind getönt; Vorschau mit \"angeheftet | scrollt seitlich\"", 390], [ad, "A (Desktop): gleiche Liste; die Leiste bricht dort um, das Anheften wirkt nur auf schmalen Bildschirmen", 620]]);
const [bd, bm] = await variant("B", "B");
await compose("2-B-schlanke-linie.png", [[bm, "B (Handy): schlanke Linie mit Pin-Etikett und Griff; Vorschau nur mit Haftkante", 390], [bd, "B (Desktop)", 620]]);
await b.close();
server.close();
console.log("fertig");
