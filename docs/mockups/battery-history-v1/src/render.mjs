// Mockups "Batterie-Verlauf": Tipp auf die Kachel "Batterie" im Geräte-Popup
// öffnet ein Fenster wie die Verfügbarkeit, mit Zeitraum 24 Std., 7 Tage,
// 30 Tage und 3 Monate und einem Verlauf "wie ein Aktienkurs".
// A: Linie mit Fläche, Schwelle gestrichelt, Batteriewechsel markiert.
// B: wie A, dazu eine Prognose bis zur Schwelle rechts von "jetzt".
// C: Säulen pro Tag (tiefster bis höchster Wert) statt Linie.
// Im echten Panel (Nachbau aus tests/panel, erfundene Daten): Fensterkontakt
// Küche, Batterie vor 74 Tagen gewechselt, heute 64 %.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/battery-history-v1/src/render.mjs
import { chromium } from "../../../../tests/panel/node_modules/playwright-core/index.mjs";
import { startServer } from "../../../../tests/panel/server.mjs";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
const tmp = fileURLToPath(new URL("./out/", import.meta.url));
mkdirSync(tmp, { recursive: true });
const server = await startServer(8960);
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const R = `document.querySelector("device-panel").shadowRoot`;

// Erfundener Verlauf: Tageswerte (Min, Mittel, Max) über 90 Tage, Stunden für 7 Tage.
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const DAYS = 90;
const CHANGE = 74; // vor so vielen Tagen gewechselt
const daily = [];
for (let i = DAYS; i >= 0; i--) {
  const base = i > CHANGE ? 18 - (DAYS - i) * 0.4 : 100 - (CHANGE - i) * 0.49;
  const mean = base + (rnd() - 0.5) * 1.6;
  daily.push({ ago: i, min: Math.round(mean - 1 - rnd() * 1.5), mean, max: Math.round(mean + 1 + rnd() * 1.5) });
}
daily[daily.length - 1].mean = 64;
const hourly = [];
for (let h = 7 * 24; h >= 0; h--) {
  const v = 64 + h * 0.02 + Math.sin(((h % 24) / 24) * Math.PI * 2) * 0.9 + (rnd() - 0.5) * 0.6;
  hourly.push({ ago: h / 24, mean: Math.round(v * 2) / 2 });
}

const W = 600;
const H = 190;
const y = (v) => (H - (v / 100) * H).toFixed(1);

function chart(range, variant) {
  const days = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 }[range];
  const pts = range === "24h" || range === "7d" ? hourly.filter((p) => p.ago <= days) : daily.filter((p) => p.ago <= days);
  const future = variant === "B" ? days * 0.28 : 0;
  const span = days + future;
  const x = (ago) => (((days - ago) / span) * W).toFixed(1);
  let svg = "";
  // Rasterlinien 0/50/100 %
  for (const v of [0, 50, 100]) svg += `<line x1="0" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--dp-divider)" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  if (future) svg += `<rect x="${x(0)}" y="0" width="${W - x(0)}" height="${H}" fill="var(--dp-subtle)"/>`;
  if (variant === "C") {
    const bw = Math.max(1.5, (W / span) * 0.62);
    for (const p of pts) {
      const color = p.min <= 15 ? "var(--dp-error)" : "var(--dp-primary)";
      svg += `<rect x="${(x(p.ago) - bw / 2).toFixed(1)}" y="${y(p.max)}" width="${bw.toFixed(1)}" height="${Math.max(2, ((p.max - p.min) / 100) * H).toFixed(1)}" rx="1" fill="${color}" opacity=".75"/>`;
    }
  } else {
    // Linie mit Fläche; der Wechsel trennt die Linie (Sprung nach oben).
    const segs = [];
    let cur = [];
    for (const p of pts) {
      if (cur.length && p.mean - cur[cur.length - 1].mean > 30) { segs.push(cur); cur = []; }
      cur.push(p);
    }
    segs.push(cur);
    for (const s of segs) {
      const line = `M${s.map((p) => `${x(p.ago)},${y(p.mean)}`).join(" L")}`;
      svg += `<path d="${line} L${x(s[s.length - 1].ago)},${H} L${x(s[0].ago)},${H} Z" fill="color-mix(in srgb, var(--dp-primary) 16%, transparent)"/>`;
      svg += `<path d="${line}" fill="none" stroke="var(--dp-primary)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
    }
    if (future) {
      // Prognose: gleicher Verbrauch wie in den letzten 30 Tagen.
      const end = 64 - future * 0.49;
      svg += `<path d="M${x(0)},${y(64)} L${W},${y(end)}" fill="none" stroke="var(--dp-primary)" stroke-width="2" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>`;
    }
  }
  // Schwelle 15 %
  svg += `<line x1="0" x2="${W}" y1="${y(15)}" y2="${y(15)}" stroke="var(--dp-error)" stroke-width="1.2" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>`;
  const changeAt = days >= CHANGE ? x(CHANGE) : null;
  const marks = changeAt
    ? `<span class="mk-change" style="left:${((changeAt / W) * 100).toFixed(2)}%"><span>Wechsel</span></span>`
    : "";
  const nowDot = `<span class="mk-dot" style="left:${((x(0) / W) * 100).toFixed(2)}%;top:${((y(64) / H) * 100).toFixed(2)}%"></span>`;
  const labels = { "24h": ["18:00", "00:00", "06:00", "12:00"], "7d": ["Sa", "So", "Mo", "Di", "Mi", "Do"], "30d": ["5.9.", "12.9.", "19.9.", "26.9."], "90d": ["Juli", "August", "September"] }[range];
  const ticks = labels.map((l, i) => `<span style="left:${(((i + 0.8) / (labels.length + 0.6)) * (days / span) * 100).toFixed(1)}%">${l}</span>`).join("");
  const futureLabel = future ? `<span class="mk-future" style="left:${((x(0) / W) * 100 + 1).toFixed(1)}%">Prognose</span>` : "";
  return `<div class="mk-chart"><div class="mk-y"><span style="top:0">100 %</span><span style="top:50%">50 %</span><span style="top:100%">0 %</span></div>
      <div class="mk-plot"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${svg}</svg>${marks}${nowDot}${futureLabel}
      <span class="mk-thr" style="top:${((y(15) / H) * 100).toFixed(1)}%">Schwach ab 15 %</span></div></div>
    <div class="avail-ticks mk-ticks">${ticks}<span class="now-label" style="${future ? `right:auto;left:${((x(0) / W) * 100).toFixed(1)}%;transform:translateX(-50%)` : ""}">jetzt</span></div>`;
}

const CSS = `
.mk-chart { position: relative; display: grid; grid-template-columns: 40px 1fr; gap: 6px; height: 190px; margin-top: 4px; }
.mk-y { position: relative; }
.mk-y span { position: absolute; right: 0; transform: translateY(-50%); color: var(--dp-text3); font-size: 11px; white-space: nowrap; }
.mk-plot { position: relative; }
.mk-plot svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.mk-thr { position: absolute; left: 6px; transform: translateY(-120%); color: var(--dp-error); font-size: 11px; }
.mk-dot { position: absolute; width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 50%; background: var(--dp-primary);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--dp-primary) 25%, transparent); }
.mk-change { position: absolute; top: -4px; bottom: 0; border-left: 1.5px dashed var(--dp-text3); }
.mk-change span { position: absolute; top: -2px; left: 5px; color: var(--dp-text2); font-size: 11px; white-space: nowrap; }
.mk-future { position: absolute; top: 4px; color: var(--dp-text3); font-size: 11px; }
.mk-ticks { margin-left: 46px; }
.mk-list { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--dp-divider); font-size: 13px; }
.mk-list div { display: flex; justify-content: space-between; padding: 3px 0; }
.mk-list .d { color: var(--dp-text2); }
`;

const FACTS = {
  A: "−36 % seit dem Wechsel am 20.7. · etwa 0,5 % pro Tag",
  B: "−36 % seit dem Wechsel am 20.7. · <b class=\"mk-b\">schwach etwa ab 6. Januar</b> (Schätzung)",
  C: "−36 % seit dem Wechsel am 20.7. · Tag für Tag tiefster bis höchster Wert",
};

function dialogHtml(range, variant) {
  const names = { "24h": "24 Std.", "7d": "7 Tage", "30d": "30 Tage", "90d": "3 Monate" };
  const sw = `<div class="stat-range"><span class="seg-sw" role="group">${Object.entries(names)
    .map(([k, l]) => `<button type="button" class="${k === range ? "on" : ""}">${l}</button>`)
    .join("")}</span></div>`;
  const facts = range === "24h" || range === "7d" ? "Tiefster 63 % · höchster 65 % · schwankt mit der Temperatur" : FACTS[variant];
  const list = range === "90d" || range === "30d"
    ? `<div class="mk-list"><div><span>Batterie gewechselt</span><span class="d">Mo., 20.7. · 12 % → 100 %</span></div></div>`
    : "";
  return `<div class="dlg-head stat-head"><span class="dlg-avatar">BATICON</span>
      <div class="dlg-title"><h2>Batterie</h2><div class="dlg-sub">Fensterkontakt Küche</div></div>
      <button type="button" class="dlg-close" aria-label="Schliessen">CLOSE</button></div>
    <div class="dlg-body">${sw}<div class="avail"><div class="avail-top"><span class="avail-pct">64<small>%</small></span><span class="avail-facts">${facts}</span></div>
      ${chart(range, variant)}${list}</div>
      <p class="dlg-note" style="margin-top:10px">Aus dem Recorder (Langzeitstatistik: Stundenwerte, auch über 10 Tage hinaus).</p></div>`;
}

async function variant(key, range, mobile) {
  const ctx = await b.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:8960/ha-sim.html?lang=de&theme=${mobile ? "dark" : "light"}`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
  const ev = (code, arg) => f.evaluate(new Function("arg", `const r=${R};` + code), arg);
  await ev(`r.host._fetch = () => {}; const s=document.createElement("style"); s.textContent=arg; r.appendChild(s); r.host._openDevice("e")`, CSS);
  await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.device .st-tiles")`));
  await p.waitForTimeout(500);
  await ev(`
    const icon = (name) => r.querySelector('.chip[data-hint="batteries"] svg')?.outerHTML || "";
    const close = r.querySelector("dialog.device .dlg-close svg").outerHTML;
    const big = icon().replace(/width="15" height="15"/, 'width="24" height="24"');
    const d = r.querySelector("dialog.stat-dlg");
    d.innerHTML = arg.replace("BATICON", big).replace("CLOSE", close);
    d.showModal();
    r.activeElement?.blur();`, dialogHtml(range, key));
  await p.waitForTimeout(400);
  const file = `${tmp}${key}-${range}-${mobile ? "mobile" : "desktop"}.png`;
  if (mobile) await p.screenshot({ path: file });
  else {
    const d = await f.evaluate(new Function(`const d=${R}.querySelector("dialog.stat-dlg").getBoundingClientRect(); return {x:d.x,y:d.y,width:d.width,height:d.height}`));
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
  A: ["1-A-linie.png", "A (Empfehlung): Linie mit Fläche wie ein Aktienkurs, Schwelle gestrichelt, Batteriewechsel markiert; 3 Monate"],
  B: ["2-B-prognose.png", "B: wie A, dazu eine Prognose rechts von \"jetzt\" und das geschätzte Datum, ab dem die Batterie schwach ist"],
  C: ["3-C-saeulen.png", "C: Säulen pro Tag (tiefster bis höchster Wert) statt Linie"],
};
for (const key of ["A", "B", "C"]) {
  const d = await variant(key, "90d", false);
  const m = await variant(key, "90d", true);
  await compose(caps[key][0], [[d, caps[key][1], 640], [m, `${key} auf dem Handy`, 390]]);
}
const d24 = await variant("A", "24h", false);
const m7 = await variant("A", "7d", true);
await compose("4-A-kurz.png", [[d24, "A mit 24 Std.: Stundenwerte, schwankt mit der Temperatur", 640], [m7, "A mit 7 Tagen auf dem Handy", 390]]);
await b.close();
server.close();
console.log("fertig");
