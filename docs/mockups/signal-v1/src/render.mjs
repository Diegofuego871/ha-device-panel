// Mockups "Schwachen Empfang pro Gerät akzeptieren": Geräte, die immer
// schwachen Empfang haben, sollen nicht dauernd als "schwach" erscheinen.
// A: Auswahl "Empfang-Warnung" wie die Batterie-Warnung (Standard / Eigene
// Schwelle / Aus). B: Schalter "Schwachen Empfang akzeptieren" (Schwelle
// automatisch etwas unter dem heutigen Wert). C: Knopf "Akzeptieren" in der
// Kachel "Empfang".
// Im echten Panel (Nachbau aus tests/panel, erfundene Daten): Präsenzsensor
// Büro mit -88 dBm.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/signal-v1/src/render.mjs
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
const CHEV = `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/></svg>`;
const BARS = (level, color) =>
  `<svg class="ic" width="17" height="12" viewBox="0 0 17 12" aria-hidden="true">${[0, 1, 2, 3]
    .map((i) => `<rect x="${i * 4.4}" y="${11 - (i + 1) * 2.7}" width="3" height="${(i + 1) * 2.7}" rx="1" fill="${i < level ? color : "var(--dp-bar-off)"}"/>`)
    .join("")}</svg>`;

const CSS = `
.mk-acc { display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; height: 26px; padding: 0 10px; border: 1px solid var(--dp-divider);
  border-radius: 99px; background: var(--dp-card); color: var(--dp-primary); font: inherit; font-size: 12px; font-weight: 500; }
.mk-ok { color: var(--dp-text2); }
.mk-note { color: var(--dp-text2); font-size: 12px; }
`;

const sel = (opts, value) =>
  `<span class="opt-select"><select>${opts.map(([v, t]) => `<option${v === value ? " selected" : ""}>${t}</option>`).join("")}</select>${CHEV}</span>`;
const sw = (on) => `<label class="switch"><input type="checkbox" ${on ? "checked" : ""}><span></span></label>`;

const VARIANTS = {
  A: {
    row: `<div class="opt changed"><div class="opt-line"><span class="opt-label">Empfang-Warnung</span>${sel(
      [["std", "Standard (schwach unter -80 dBm)"], ["own", "Eigene Schwelle"], ["off", "Aus"]],
      "own"
    )}</div><div class="opt-line opt-sub"><span class="opt-label">Schwach unter</span><span class="opt-input"><input type="text" value="-93"><span class="unit">dBm</span></span></div>
      <div class="opt-short">Heute -88 dBm. Für Geräte, die immer schwachen Empfang haben: eine eigene Schwelle (vorgeschlagen etwas unter dem heutigen Wert) oder "Aus". Markierung und Filter "Schwacher Empfang" folgen.</div></div>`,
  },
  B: {
    row: `<div class="opt changed"><div class="opt-line"><span class="opt-label">Schwachen Empfang akzeptieren</span>${sw(true)}</div>
      <div class="opt-short">Akzeptiert bei -88 dBm. Wird der Empfang schlechter als -93 dBm, gilt er wieder als schwach.</div></div>`,
  },
  C: { row: "" },
};

async function variant(key, mobile) {
  const ctx = await b.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1400, height: 1100 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:8959/ha-sim.html?lang=de&theme=${mobile ? "dark" : "light"}`);
  await p.evaluate(() => { window.__devices.find((d) => d.id === "f").signal = { kind: "dbm", value: -88 }; });
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
  const ev = (code, arg) => f.evaluate(new Function("arg", `const r=${R};` + code), arg);
  await ev(`const s=document.createElement("style"); s.textContent=arg; r.appendChild(s); return r.host._fetch()`, CSS);
  await ev(`r.host._fetch = () => {}; r.host._openDevice("f")`);
  await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.device .dev-set")`));
  await p.waitForTimeout(600);
  await ev(`r.host._renderDevice = () => {}; r.activeElement?.blur();`);
  if (key === "C") {
    // Kachel "Empfang": Knopf statt Untertitel.
    await ev(`const t=[...r.querySelectorAll("dialog.device .st-tile.static")].find(x=>x.textContent.includes("Empfang"));
      t.querySelector(".st-sub").innerHTML = 'schwach<br><button type="button" class="mk-acc">Akzeptieren</button>';`);
  } else {
    await ev(`r.querySelector("dialog.device .dev-set").insertAdjacentHTML("afterbegin", arg)`, VARIANTS[key].row);
  }
  const target = key === "C" ? ".st-tiles" : ".dev-set";
  await ev(`const d=r.querySelector("dialog.device"); const el=r.querySelector("dialog.device ${target}");
    const sc=[d, d.querySelector(".dlg-body")].find(x=>x && x.scrollHeight > x.clientHeight) || d;
    sc.scrollTop = el.getBoundingClientRect().top - sc.getBoundingClientRect().top - (arg ? 160 : 220);`, mobile);
  await p.waitForTimeout(300);
  const file = `${tmp}${key}-${mobile ? "mobile" : "desktop"}.png`;
  if (mobile) await p.screenshot({ path: file });
  else {
    const d = await f.evaluate(new Function(`const d=${R}.querySelector("dialog.device").getBoundingClientRect(); return {x:d.x,y:d.y,width:d.width,height:d.height}`));
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
  A: ["1-A-auswahl.png", "A (Empfehlung): \"Empfang-Warnung\" wie die Batterie-Warnung: Standard, eigene Schwelle (vorgeschlagen unter dem heutigen Wert) oder aus"],
  B: ["2-B-schalter.png", "B: Schalter \"Schwachen Empfang akzeptieren\"; Schwelle automatisch 5 dBm unter dem heutigen Wert"],
  C: ["3-C-kachel.png", "C: Knopf \"Akzeptieren\" direkt in der Kachel \"Empfang\" (wie B, ohne eigene Zeile)"],
};
for (const key of ["A", "B", "C"]) {
  const d = await variant(key, false);
  const m = await variant(key, true);
  await compose(caps[key][0], [[d, caps[key][1], 620], [m, `${key} auf dem Handy`, 390]]);
}
await b.close();
server.close();
console.log("fertig");
