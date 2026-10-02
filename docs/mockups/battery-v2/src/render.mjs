// Mockups "Batterie-Warnung pro Integration aus": in der Liste "Eigene
// Schwelle pro Integration" (Einstellungen, Abschnitt "Batterie") die Warnung
// für eine ganze Integration ausschalten. A: Schalter "Warnung" je Zeile.
// B: Auswahl je Zeile wie im Geräte-Popup. C: Knopf "Aus" neben dem Feld.
// Im echten Panel (Nachbau aus tests/panel, erfundene Daten); Beispiel:
// Zigbee mit eigener Schwelle 25 %, BTHome aus.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/battery-v2/src/render.mjs
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
const CHEV = `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/></svg>`;

const CSS = `
.mk-head { display: grid; grid-template-columns: 1fr 86px 52px; gap: 12px; padding: 6px 2px 4px; color: var(--dp-text2); font-size: 11px;
  font-weight: 500; letter-spacing: .04em; text-transform: uppercase; }
.mk-head span:not(:first-child) { text-align: center; }
.mk-off-in input::placeholder { color: var(--dp-text2); }
.mk-off-in { opacity: .55; }
.ex-row.mk-dim .ex-name { color: var(--dp-text2); }
.mk-ctl { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.mk-ctl .opt-select { flex: 0 0 190px; }
.mk-pill { height: 34px; padding: 0 12px; border: 1px solid var(--dp-divider); border-radius: 999px; background: var(--dp-card);
  color: var(--dp-text2); font: inherit; font-size: 13px; }
.mk-pill.on { border-color: transparent; background: var(--dp-error-soft, rgba(219,68,55,.12)); color: var(--dp-error); font-weight: 500; }
@media (max-width: 600px) {
  .mk-b .ex-row { flex-wrap: wrap; }
  .mk-b .mk-ctl { flex: 1 1 calc(100% - 44px); min-width: 0; margin-left: 44px; }
  .mk-b .mk-ctl .opt-select { flex: 1 1 auto; min-width: 0; }
  .mk-b .mk-ctl .opt-input { flex: none; }
}
`;

async function page(mobile) {
  const ctx = await b.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1400, height: 1300 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:8958/ha-sim.html?lang=de&theme=${mobile ? "dark" : "light"}`);
  await p.evaluate(() => { window.__opts.battery_low_integrations = { zha: 25 }; });
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
  const ev = (code, arg) => f.evaluate(new Function("arg", `const r=${R};` + code), arg);
  await ev(`r.host._fetch = () => {}; const s=document.createElement("style"); s.textContent=arg; r.appendChild(s); r.querySelector(".gear-btn").click()`, CSS);
  await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.settings .set-sec")`));
  await ev(`r.querySelector('[data-set="section"][data-id="battery"]').click()`);
  await p.waitForTimeout(300);
  await ev(`r.host._renderSettings = () => {}; r.host._updateSettingsMeta = () => {}; r.activeElement?.blur();`);
  return { ctx, p, f, ev };
}

// Zeilen der echten Liste: Kennzeichen, Name, Kurzzeile, Wert.
const ROWS = `return [...r.querySelectorAll(".bat-row")].map((row) => ({ badge: row.querySelector(".ibadge").outerHTML,
  name: row.querySelector(".ex-name").firstChild.textContent, small: row.querySelector("small").textContent,
  domain: row.querySelector("input").dataset.bat, value: row.querySelector("input").value }))`;

const sw = (on) => `<label class="switch"><input type="checkbox" ${on ? "checked" : ""}><span></span></label>`;
const input = (value, extra = "") => `<span class="opt-input${extra}"><input type="text" inputmode="numeric" value="${value}" placeholder="15"><span class="unit">%</span></span>`;
const offInput = `<span class="opt-input mk-off-in"><input type="text" value="" placeholder="aus" disabled><span class="unit"></span></span>`;
const name = (x) => `${x.badge}<div class="ex-name">${x.name}<small>${x.small}</small></div>`;
const OFF = "bthome";

const VARIANTS = {
  A: {
    short: 'Leer = globaler Wert (15 %). Schalter aus: keine Batterie-Warnung für Geräte dieser Integration (Markierung, Push, anhaltende Benachrichtigung); eine eigene Schwelle am Gerät geht vor.',
    head: `<div class="mk-head"><span>Integration</span><span>Schwach ab</span><span>Warnung</span></div>`,
    row: (x) => `<div class="ex-row bat-row${x.domain === OFF ? " mk-dim changed" : ""}">${name(x)}${x.domain === OFF ? offInput : input(x.value, x.value ? " " : "")}${sw(x.domain !== OFF)}</div>`,
  },
  B: {
    short: 'Wie im Geräte-Popup: globaler Wert, eigene Schwelle oder aus. Eine eigene Schwelle am Gerät geht vor.',
    head: `<div class="ex-head"><span>Integration</span><span>Warnung</span></div>`,
    row: (x) => {
      const mode = x.domain === OFF ? "off" : x.value ? "own" : "default";
      const opts = [["default", "Globaler Wert (15 %)"], ["own", "Eigene Schwelle"], ["off", "Aus"]]
        .map(([v, t]) => `<option${v === mode ? " selected" : ""}>${t}</option>`).join("");
      return `<div class="ex-row bat-row${mode === "off" ? " mk-dim" : ""}">${name(x)}<span class="mk-ctl"><span class="opt-select"><select>${opts}</select>${CHEV}</span>${mode === "own" ? input(x.value) : ""}</span></div>`;
    },
  },
  C: {
    short: 'Leer = globaler Wert (15 %). "Aus": keine Batterie-Warnung für Geräte dieser Integration; eine eigene Schwelle am Gerät geht vor.',
    head: `<div class="ex-head"><span>Integration</span><span>Schwach ab</span></div>`,
    row: (x) => `<div class="ex-row bat-row${x.domain === OFF ? " mk-dim" : ""}">${name(x)}<span class="mk-ctl">${x.domain === OFF ? offInput : input(x.value)}<button type="button" class="mk-pill${x.domain === OFF ? " on" : ""}">Aus</button></span></div>`,
  },
};

async function variant(key, mobile) {
  const { ctx, p, f, ev } = await page(mobile);
  const rows = await ev(ROWS);
  const v = VARIANTS[key];
  await ev(`
    const own = r.querySelector(".opt.bat-own");
    own.querySelector("[data-bat-short]").textContent = arg.short;
    let n = own.nextElementSibling;
    while (n && !n.matches("[data-bat-error]")) { const next = n.nextElementSibling; n.remove(); n = next; }
    own.insertAdjacentHTML("afterend", '<div class="mk-' + arg.key.toLowerCase() + '">' + arg.html + '</div>');
    const box = own.closest(".set-sec");
    const d = r.querySelector("dialog.settings");
    d.scrollTop = 0;
    const scroller = [d, d.querySelector(".dlg-body")].find((x) => x && x.scrollHeight > x.clientHeight) || d;
    scroller.scrollTop = own.getBoundingClientRect().top - scroller.getBoundingClientRect().top - (arg.mobile ? 150 : 260);
  `, { key, mobile, short: v.short, html: v.head + rows.map(v.row).join("") });
  await p.waitForTimeout(300);
  const file = `${tmp}${key}-${mobile ? "mobile" : "desktop"}.png`;
  if (mobile) await p.screenshot({ path: file });
  else {
    const d = await f.evaluate(new Function(`const d=${R}.querySelector("dialog.settings").getBoundingClientRect(); return {x:d.x,y:d.y,width:d.width,height:d.height}`));
    const fr = await (await p.$("#panel-frame")).boundingBox();
    await p.screenshot({ path: file, clip: { x: d.x + fr.x, y: d.y + fr.y, width: d.width, height: Math.min(d.height, 900) } });
  }
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

const caps = {
  A: ["1-A-schalter.png", "A (Empfehlung): Schalter \"Warnung\" je Zeile, wie \"Anzeigen\" bei Integrationen und Gerätetypen; aus = Feld gesperrt"],
  B: ["2-B-auswahl.png", "B: Auswahl je Zeile wie im Geräte-Popup (Globaler Wert / Eigene Schwelle / Aus); Feld nur bei eigener Schwelle"],
  C: ["3-C-knopf-aus.png", "C: Knopf \"Aus\" neben dem Feld"],
};
for (const key of ["A", "B", "C"]) {
  const d = await variant(key, false);
  const m = await variant(key, true);
  await compose(caps[key][0], [[d, caps[key][1], 640], [m, `${key} auf dem Handy`, 390]]);
}
await b.close();
server.close();
console.log("fertig");
