// Mockups "Reihenfolge der Chips", Runde 3 (Wunsch des Nutzers): nur noch eine
// Liste. "Alle" und jede Verbindungsart sind Zeilen wie die übrigen Chips, alle
// frei verschiebbar; "Alle" ist fest (Schloss statt Schalter). Keine
// Beschriftung "links/rechts von Alle": von oben nach unten ist von links nach
// rechts. D1: nur die Liste. D2: Liste mit Vorschau der Leiste. Im echten
// Panel (Nachbau aus tests/panel, erfundene Daten), die Liste aus den echten
// Zeilen der beiden bisherigen Listen zusammengesetzt.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/chip-order-v3/src/render.mjs
import { chromium } from "../../../../tests/panel/node_modules/playwright-core/index.mjs";
import { startServer } from "../../../../tests/panel/server.mjs";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
const tmp = fileURLToPath(new URL("./out/", import.meta.url));
mkdirSync(tmp, { recursive: true });
const server = await startServer(8959);
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const R = `document.querySelector("device-panel").shadowRoot`;

const CSS = `
.mk-fix { flex: none; display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 10px; border-radius: 999px;
  background: var(--dp-card); border: 1px solid var(--dp-divider); color: var(--dp-text2); font-size: 12px; font-weight: 500; }
.mk-prev { margin: 10px 0 4px; padding: 10px 12px 12px; border: 1px solid var(--dp-divider); border-radius: 14px; background: var(--dp-bg); }
.mk-prev-t { margin: 0 0 8px; color: var(--dp-text2); font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
.mk-pills { display: flex; flex-wrap: wrap; gap: 6px; }
.mk-pills .chip { height: 28px; padding: 0 10px; font-size: 12.5px; pointer-events: none; }
`;

// Reihenfolge im Beispiel (von oben nach unten = von links nach rechts):
// Batterie zuerst, dann Bereich und Integration, "Alle" mit den Verbindungsarten
// mittendrin, dahinter der Rest. Ausgeblendet: Thread, Bluetooth, Z-Wave,
// Netzwerk, Unbekannt (Matter und LAN haben im Beispiel keine Geräte).
const ORDER = ["batteries", "area", "integration", "all", "zigbee", "wifi", "cloud", "thread", "ble", "zwave", "network", "unknown", "problems", "battery", "signal", "update", "override", "new"];
const HIDE = ["thread", "ble", "zwave", "network", "unknown", "ethernet", "matter"];

async function page(mobile, height) {
  const ctx = await b.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1400, height }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:8959/ha-sim.html?lang=de&theme=${mobile ? "dark" : "light"}`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
  const ev = (code, arg) => f.evaluate(new Function("arg", `const r=${R};` + code), arg);
  await p.evaluate((hide) => {
    window.__opts.chip_order = ["batteries", "area", "integration", "connections", "problems", "battery", "signal", "update", "override", "new"];
    window.__opts.hide_connections = hide;
  }, HIDE);
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

const LOCK = "M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z";

// Eine Liste: Zeilen aus beiden bisherigen Listen in der Beispielfolge.
const mergeJs = `
  const list = r.querySelector('.drag-list[data-drag-list="chip_order"]');
  const conn = r.querySelector('.drag-list[data-drag-list="connection_order"]');
  const body = list.closest(".set-sec-body");
  const rowOf = (key) => [...list.children, ...conn.children].find((x) => x.querySelector('[data-key="' + key + '"]'));
  // "Alle": die Zeile "Verbindungsarten" umgebaut, fest statt Schalter
  const all = rowOf("connections");
  all.querySelector('[data-key="connections"]').dataset.key = "all";
  all.querySelector(".ex-name").firstChild.textContent = "Alle";
  all.querySelector(".ex-name small").textContent = "Alle Geräte, ohne Filter";
  all.querySelector("label.switch").outerHTML = '<span class="mk-fix"><svg width="13" height="13" viewBox="0 0 24 24"><path fill="currentColor" d="' + arg.lock + '"/></svg>fest</span>';
  const rows = arg.order.map((k) => (k === "all" ? all : rowOf(k))).filter(Boolean);
  list.replaceChildren(...rows);
  // zweiten Abschnitt "Verbindungsart" entfernen, nur der Knopf "Standardreihenfolge" bleibt
  const reset = body.querySelector('[data-set="drag-reset"][data-key="chip_order"]')?.closest(".drag-reset");
  let n = list.nextElementSibling;
  while (n) { const next = n.nextElementSibling; if (n !== reset) n.remove(); n = next; }
  const heads = body.querySelectorAll("h4.ex-title");
  heads[0].textContent = "Filter-Chips";
  body.querySelector(".ex-intro").textContent = "Alle Chips über der Liste, einschliesslich \\"Alle\\" und der Verbindungsarten. Von oben nach unten ist von links nach rechts; am Griff ziehen. Ein Chip erscheint nur, wenn er auf Geräte zutrifft. Ein ausgeblendeter Chip hebt seinen Filter auf, die Geräte bleiben sichtbar. Gilt für alle Benutzer.";
`;

// Vorschau der Leiste aus den echten Chips, in der Beispielfolge
const prevJs = `
  const pick = (k) => k === "area" ? r.querySelector(".chips .chip.area:not(.integ)") : k === "integration" ? r.querySelector(".chips .chip.integ")
    : k === "all" ? r.querySelector('.chips [data-conn="all"]') : k === "problems" ? r.querySelector(".chips [data-problems]")
    : r.querySelector('.chips [data-conn="' + k + '"]') || r.querySelector('.chips [data-hint="' + k + '"]');
  const hide = new Set(arg.hide);
  const pills = arg.order.filter((k) => !hide.has(k)).map(pick).filter(Boolean).map((x) => x.outerHTML).join("");
  const box = '<div class="mk-prev"><div class="mk-prev-t">So sieht die Leiste aus</div><div class="mk-pills">' + pills + '</div></div>';
  r.querySelector(".ex-intro").insertAdjacentHTML("afterend", box);
`;

async function shot(p, f, ev, name, mobile) {
  await ev(`const e = r.querySelector(".mk-prev") || r.querySelector(".ex-title"); e.scrollIntoView({ block: "start" });
    let c = e.parentElement; while (c && c.scrollHeight <= c.clientHeight) c = c.parentElement;
    if (c) c.scrollTop -= arg;`, mobile ? 190 : 120);
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

async function variant(name, withPrev) {
  const files = [];
  for (const mobile of [false, true]) {
    const { ctx, p, f, ev } = await page(mobile, 1500);
    if (withPrev) await ev(`const list = r.querySelector('.drag-list[data-drag-list="chip_order"]');`); // Platzhalter, Leiste bleibt unberührt
    // Vorschau zuerst aus der echten Leiste lesen, dann die Liste umbauen
    if (withPrev) await ev(`r.querySelector(".ex-intro")`);
    if (withPrev) await ev(prevJs, { order: ORDER, hide: HIDE });
    await ev(mergeJs, { order: ORDER, lock: LOCK });
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

const [ad, am] = await variant("D1", false);
await compose("1-D1-eine-liste.png", [[ad, "D1: eine Liste für alle Chips, auch \"Alle\" (fest, nur verschiebbar) und jede Verbindungsart; von oben nach unten = von links nach rechts", 620], [am, "D1 auf dem Handy", 390]]);
const [bd, bm] = await variant("D2", true);
await compose("2-D2-eine-liste-mit-vorschau.png", [[bd, "D2: dieselbe Liste, dazu die Vorschau der Leiste", 620], [bm, "D2 auf dem Handy", 390]]);
await b.close();
server.close();
console.log("fertig");
