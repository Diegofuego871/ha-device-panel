// Mockups "Reihenfolge der Chips", Runde 2 (Entscheid des Nutzers: C, mit
// "Alle" als festem, verschiebbarem Element ohne Schalter). Die Zeile ist
// "Alle" (die Chips der Verbindungsart folgen direkt dahinter); statt des
// Schalters steht ein Schloss mit "fest". Zwei Zustände: "Alle" in der Mitte
// und "Alle" ganz vorn (dann steht alles andere rechts davon). Im echten Panel
// (Nachbau aus tests/panel, erfundene Daten) mit den echten Stilen, die
// Zusätze eingesetzt.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/chip-order-v2/src/render.mjs
import { chromium } from "../../../../tests/panel/node_modules/playwright-core/index.mjs";
import { startServer } from "../../../../tests/panel/server.mjs";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
const tmp = fileURLToPath(new URL("./out/", import.meta.url));
mkdirSync(tmp, { recursive: true });
const server = await startServer(8958);
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const R = `document.querySelector("device-panel").shadowRoot`;

const CSS = `
/* A: Trennband und Beschriftung der Bereiche */
.mk-cap { display: flex; align-items: center; gap: 8px; margin: 12px 0 2px; color: var(--dp-text2); font-size: 11px; font-weight: 600;
  letter-spacing: .06em; text-transform: uppercase; }
.mk-cap svg { color: var(--dp-primary); flex: none; }
.mk-cap small { margin-left: auto; font-size: 11px; font-weight: 400; letter-spacing: 0; text-transform: none; }
.mk-cap::after { content: ""; flex: 1; order: 1; height: 1px; background: var(--dp-divider); }
.mk-cap small { order: 2; }
.mk-empty { margin: 4px 0; padding: 12px; border: 1px dashed var(--dp-divider); border-radius: 10px; color: var(--dp-text2); font-size: 12.5px; text-align: center; }
.ex-row.mk-band { margin: 8px -8px; padding: 10px 10px; border: 1px solid var(--dp-primary); border-radius: 12px; background: var(--dp-primary-soft); }
.drag-list .ex-row.mk-band:last-child { border-bottom: 1px solid var(--dp-primary); }
.mk-mini { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.mk-mini span { display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 999px; background: var(--dp-card);
  border: 1px solid var(--dp-divider); color: var(--dp-text2); font-size: 11px; font-weight: 500; }
.mk-mini span.all { background: var(--dp-primary); border-color: transparent; color: #fff; }
.ex-row.mk-band .ex-name small { white-space: normal; }
/* B: Vorschau der Leiste */
.mk-prev { margin: 10px 0 4px; padding: 10px 12px 12px; border: 1px solid var(--dp-divider); border-radius: 14px; background: var(--dp-bg); }
.mk-prev-t { margin: 0 0 8px; color: var(--dp-text2); font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
.mk-zones { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: flex-start; }
.mk-zone { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.mk-zl { color: var(--dp-text2); font-size: 10.5px; line-height: 1.2; }
.mk-zone.mid .mk-zl { color: var(--dp-primary); font-weight: 600; }
.mk-pills { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px; border-radius: 999px; }
.mk-zone.mid .mk-pills { padding: 6px; border-radius: 16px; background: var(--dp-primary-soft); outline: 1px solid var(--dp-primary); }
.mk-pills .chip { height: 28px; padding: 0 10px; font-size: 12.5px; pointer-events: none; }
.mk-fix { flex: none; display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 10px; border-radius: 999px;
  background: var(--dp-card); border: 1px solid var(--dp-divider); color: var(--dp-text2); font-size: 12px; font-weight: 500; }
.mk-none { display: inline-flex; align-items: center; height: 28px; padding: 0 12px; border: 1px dashed var(--dp-divider); border-radius: 999px; color: var(--dp-text2); font-size: 12px; }
.mk-note { margin: 6px 2px 0; color: var(--dp-text2); font-size: 12px; line-height: 1.4; }
`;

const MID = ["batteries", "area", "integration", "connections", "problems", "battery", "signal", "update", "override", "new"];
const FIRST = ["connections", "batteries", "area", "integration", "problems", "battery", "signal", "update", "override", "new"];

async function page(mobile, order, height = 1000) {
  const ctx = await b.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1400, height }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:8958/ha-sim.html?lang=de&theme=${mobile ? "dark" : "light"}`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
  const ev = (code, arg) => f.evaluate(new Function("arg", `const r=${R};` + code), arg);
  // Beispiel: Batterie ganz links, dann Bereich und Integration, danach
  // "Alle" mit den Verbindungsarten, dann der Rest. Einige Arten ausgeblendet.
  await p.evaluate((order) => {
    window.__opts.chip_order = order;
    window.__opts.hide_connections = ["thread", "ble", "zwave", "network", "unknown", "ethernet", "matter"];
  }, order);
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

const ARROW_L = "M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z";
const ARROW_R = "M4,11V13H16L10.5,18.5L11.92,19.92L19.84,12L11.92,4.08L10.5,5.5L16,11H4Z";
const ico = (d) => `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;

// A: Trennband und Beschriftung der Bereiche
const bandJs = `
  const list = r.querySelector('.drag-list[data-drag-list="chip_order"]');
  const rows = [...list.children];
  const i = rows.findIndex((x) => x.querySelector('[data-key="connections"]'));
  const band = rows[i];
  band.classList.add("mk-band");
  band.querySelector(".ex-name").firstChild.textContent = "Alle";
  band.querySelector(".ex-name small").textContent = "Die Chips der Verbindungsart folgen direkt dahinter";
  band.querySelector(".ex-name").insertAdjacentHTML("beforeend", '<div class="mk-mini"><span class="all">Alle</span><span>Zigbee</span><span>WLAN</span><span>Cloud</span></div>');
  band.querySelector("label.switch").outerHTML = '<span class="mk-fix">' + arg.lock + 'fest</span>';
  const before = rows.slice(0, i).length, after = rows.length - i - 1;
  list.insertAdjacentHTML("afterbegin", '<div class="mk-cap">' + arg.l + 'Links von "Alle"<small>' + before + (before === 1 ? ' Chip' : ' Chips') + ', erscheinen vor "Alle"</small></div>' + (before ? "" : '<div class="mk-empty">Nichts links: "Alle" steht ganz vorn</div>'));
  band.insertAdjacentHTML("afterend", '<div class="mk-cap">' + arg.r + 'Rechts von "Alle"<small>' + after + ' Chips, erscheinen nach "Alle"</small></div>');
`;

// B: Vorschau der Leiste aus den echten Chips (in der eingestellten Reihenfolge)
const prevJs = `
  const bar = [...r.querySelectorAll(".chips > *")].filter((x) => !x.classList.contains("vsep"));
  const isConn = (x) => x.dataset?.conn !== undefined;
  const first = bar.findIndex(isConn), last = bar.length - 1 - [...bar].reverse().findIndex(isConn);
  const html = (xs) => xs.map((x) => x.outerHTML).join("");
  const left = bar.slice(0, first), mid = bar.slice(first, last + 1), right = bar.slice(last + 1);
  const zone = (cls, label, xs) => '<div class="mk-zone ' + cls + '"><span class="mk-zl">' + label + '</span><div class="mk-pills">' + (xs.length ? html(xs) : '<span class="mk-none">leer</span>') + '</div></div>';
  const box = '<div class="mk-prev"><div class="mk-prev-t">So sieht die Leiste aus</div><div class="mk-zones">' +
    zone("", "Links von \\"Alle\\"", left) + zone("mid", "\\"Alle\\" und Verbindungsarten (fest, verschiebbar)", mid) + zone("", "Rechts von \\"Alle\\"", right) + '</div></div>';
  const intro = r.querySelector('.drag-list[data-drag-list="chip_order"]').closest(".set-sec-body").querySelector(".ex-intro");
  intro.insertAdjacentHTML("afterend", box);
`;

async function shot(p, f, ev, name, mobile) {
  const sel = mobile ? "dialog.settings" : "dialog.settings";
  // An den Anfang des Abschnitts scrollen, mit etwas Rand über dem ersten Zusatz
  // (der Kopf des Dialogs überdeckt sonst die ersten Zeilen).
  await ev(`const e = r.querySelector(".mk-prev") || r.querySelector('.drag-list[data-drag-list="chip_order"]'); e.scrollIntoView({ block: "start" });
    let c = e.parentElement; while (c && c.scrollHeight <= c.clientHeight) c = c.parentElement;
    if (c) c.scrollTop -= arg;`, mobile ? 150 : 130);
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

const LOCK = "M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z";

async function variant(name, order, withBand, withPrev) {
  const files = [];
  for (const mobile of [false, true]) {
    const { ctx, p, f, ev } = await page(mobile, order);
    if (withBand) await ev(bandJs, { l: ico(ARROW_L), r: ico(ARROW_R), lock: ico(LOCK) });
    if (withPrev) await ev(prevJs);
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

const [md, mm] = await variant("C1", MID, true, true);
await compose("1-C-alle-in-der-mitte.png", [[md, "C: \"Alle\" als feste Zeile (Schloss statt Schalter), verschiebbar; hier in der Mitte: links Batterie, Bereich, Integration", 620], [mm, "auf dem Handy", 390]]);
const [fd, fm] = await variant("C2", FIRST, true, true);
await compose("2-C-alle-ganz-vorn.png", [[fd, "C: \"Alle\" nach ganz oben gezogen: \"Alle\" ist der erste Chip, alles andere steht rechts davon", 620], [fm, "auf dem Handy", 390]]);
await b.close();
server.close();
console.log("fertig");
