// Mockups signal-via-v1 (Wunsch des Nutzers, 2026-10-14): Im Fenster "Empfang" eines Bluetooth-Geräts zeigen, über welchen Empfänger (Adapter
// oder Bluetooth-Proxy) es verbunden ist und war. Nur Bluetooth (Entscheid des Nutzers), für alle Zeiträume (24 Std., 7 Tage, 30 Tage).
// Echtes Panel im Nachbau, erfundene Daten; die Abschnitte unter dem Diagramm sind eingesetzt. Der frühere Weg ist nur aus der eigenen
// Aufzeichnung bekannt: das Panel merkt ihn sich pro 5-Minuten-Block erst ab dem Update (HA speichert ihn nirgends).
//   A: Zeitleiste unter dem Diagramm (farbige Abschnitte je Empfänger) mit Legende (Anteil, Ø Empfang)
//   B: Liste "Verbunden über" (Abschnitte mit Zeit, Dauer, Ø Empfang), ohne Zeitleiste
//   C (Empfehlung): Zeitleiste und Legende wie A, dazu die letzten Wechsel als Liste
// Aufruf: CHROMIUM_PATH=... node docs/mockups/signal-via-v1/src/render.mjs
import { setup } from "../../_lib/mock.mjs";
const { page, compose, close } = await setup(8996, import.meta.url);
const tmp = new URL("./out/", import.meta.url).pathname;

const CSS = `
.sv { margin: 14px 2px 4px; }
.sv h3 { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: var(--dp-text); }
.sv-bar { display: flex; height: 14px; border-radius: 7px; overflow: hidden; background: color-mix(in srgb, var(--dp-text) 8%, transparent); }
.sv-bar i { display: block; height: 100%; }
.sv-bar i.gap { background: repeating-linear-gradient(135deg, transparent 0 4px, color-mix(in srgb, var(--dp-text) 14%, transparent) 4px 5px); }
.sv-axis { display: flex; justify-content: space-between; margin-top: 3px; color: var(--dp-text2); font-size: 11px; }
.sv-leg { display: grid; gap: 6px; margin-top: 10px; }
.sv-leg div { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.sv-leg b { font-weight: 500; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sv-leg span { color: var(--dp-text2); font-size: 12px; white-space: nowrap; }
.sv-dot { flex: none; width: 10px; height: 10px; border-radius: 50%; }
.sv-list { display: grid; margin-top: 2px; }
.sv-row { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; gap: 4px 10px; align-items: center; padding: 9px 0; border-top: 1px solid var(--dp-divider); font-size: 13px; }
.sv-row:first-child { border-top: 0; }
.sv-row b { font-weight: 500; }
.sv-row small { grid-column: 2 / 4; color: var(--dp-text2); font-size: 12px; margin-top: -2px; }
.sv-row em { font-style: normal; color: var(--dp-text2); font-size: 12px; }
.sv-now { margin-left: 6px; padding: 0 7px; border-radius: 999px; background: var(--dp-primary-soft); color: var(--dp-primary); font-size: 11px; font-weight: 600; }
.sv-note { margin: 8px 0 0; color: var(--dp-text2); font-size: 12px; line-height: 1.4; }
.sv-chg { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--dp-divider); }
.sv-chg h4 { margin: 0 0 6px; font-size: 12px; font-weight: 600; color: var(--dp-text2); letter-spacing: .04em; text-transform: uppercase; }
.sv-chg p { margin: 0; padding: 5px 0; font-size: 13px; display: flex; gap: 8px; align-items: baseline; }
.sv-chg p span { flex: none; width: 74px; color: var(--dp-text2); font-size: 12px; }
`;

const COL = ["#3B82F6", "#F59E0B", "#10B981", "#8B5CF6"];
const RX = ["Storen Büro", "Proxy Garage", "Küche", "Bluetooth-Adapter (HA)"];
// Abschnitte (Anteil in %, Empfänger, Ø dBm); Lücke = ausgefallen oder nicht empfangen
const SEG = { "24h": [[22, 0], [8, 1], [38, 0], [4, null], [28, 2]], "7d": [[40, 0], [6, 1], [18, 2], [3, null], [26, 0], [7, 3]], "30d": [[55, 0], [12, 2], [4, null], [20, 0], [9, 3]] };
const AX = { "24h": ["vor 24 Std.", "12 Std.", "jetzt"], "7d": ["vor 7 Tagen", "3,5 Tage", "jetzt"], "30d": ["vor 30 Tagen", "15 Tage", "jetzt"] };
const SHARE = { "24h": [[0, 60, -74], [1, 8, -82], [2, 28, -78]], "7d": [[0, 66, -73], [1, 6, -83], [2, 18, -77], [3, 7, -88]], "30d": [[0, 75, -74], [2, 12, -77], [3, 9, -88]] };

const bar = (r) => `<div class="sv-bar">${SEG[r].map(([w, k]) => `<i class="${k == null ? "gap" : ""}" style="width:${w}%;${k == null ? "" : `background:${COL[k]}`}"></i>`).join("")}</div><div class="sv-axis">${AX[r].map((a) => `<span>${a}</span>`).join("")}</div>`;
const legend = (r) => `<div class="sv-leg">${SHARE[r].map(([k, p, d]) => `<div><i class="sv-dot" style="background:${COL[k]}"></i><b>${RX[k]}</b><span>${p} % · Ø ${d} dBm</span></div>`).join("")}</div>`;
const NOTE = `<p class="sv-note">Aufgezeichnet vom Panel, seit dem Update. Der frühere Weg lässt sich nicht nachträglich herstellen. Lücken: Gerät nicht empfangen.</p>`;
const rows = [["jetzt", 0, "seit 06:10", "5 Std. 20 Min. · Ø -74 dBm"], ["", 2, "02:40 bis 06:10", "3 Std. 30 Min. · Ø -78 dBm"], ["", 0, "gestern 22:05 bis 02:40", "4 Std. 35 Min. · Ø -73 dBm"], ["", 1, "gestern 21:15 bis 22:05", "50 Min. · Ø -82 dBm"]];
const list = `<div class="sv-list">${rows.map(([n, k, t, d]) => `<div class="sv-row"><i class="sv-dot" style="background:${COL[k]}"></i><b>${RX[k]}${n ? `<span class="sv-now">${n}</span>` : ""}</b><em>${t}</em><small>${d}</small></div>`).join("")}</div>`;
const changes = `<div class="sv-chg"><h4>Wechsel</h4>
  <p><span>06:10</span><b>Küche → Storen Büro</b></p><p><span>02:40</span><b>Storen Büro → Küche</b></p><p><span>gestern 22:05</span><b>Proxy Garage → Storen Büro</b></p></div>`;

const VARIANTS = {
  A: (r) => `<div class="sv"><h3>Verbunden über</h3>${bar(r)}${legend(r)}${NOTE}</div>`,
  B: () => `<div class="sv"><h3>Verbunden über</h3>${list}${NOTE}</div>`,
  C: (r) => `<div class="sv"><h3>Verbunden über</h3>${bar(r)}${legend(r)}${changes}${NOTE}</div>`,
};

async function shot(mobile, variant, range, name) {
  const { ctx, p, ev } = await page(mobile, { css: CSS, freeze: true, height: 1300 });
  await ev(`const d = window.parent.__devices?.find?.((x) => x.id === "a"); r.host._detailId = "a";`);
  await p.evaluate(() => { const d = window.__devices.find((x) => x.id === "a"); d.online = true; d.offline_since = null; d.flaky = false; });
  await ev(`r.host._openStat(${JSON.stringify(range)}, "signal");`);
  await p.waitForTimeout(900);
  await ev(`const body = r.querySelector("dialog.stat-dlg .dlg-body"); if (!body) throw new Error("kein Fenster"); body.insertAdjacentHTML("beforeend", arg);`, VARIANTS[variant](range));
  await p.waitForTimeout(300);
  const file = `${tmp}${name}.png`;
  const box = await ev(`const r2 = r.querySelector("dialog.stat-dlg").getBoundingClientRect(); return { x: r2.x, y: r2.y, w: r2.width, h: r2.height }`);
  const off = await p.evaluate(() => { const r = document.querySelector("#panel-frame").getBoundingClientRect(); return { x: r.x, y: r.y }; });
  const vp = p.viewportSize();
  const x = Math.max(0, off.x + box.x), y = Math.max(0, off.y + box.y);
  await p.screenshot({ path: file, clip: { x, y, width: Math.min(box.w, vp.width - x), height: Math.min(box.h, vp.height - y) } });
  await ctx.close();
  return file;
}

const out = {};
for (const v of ["A", "B", "C"]) out[v] = await shot(true, v, "24h", `${v}-24h`);
out.C7 = await shot(true, "C", "7d", "C-7d");
await compose("1-Varianten-A-B-C.png", [[out.A, "A: Zeitleiste und Legende", 300], [out.B, "B: Liste der Abschnitte", 300], [out.C, "C (Empfehlung): Zeitleiste, Legende, Wechsel", 300]]);
await compose("2-Variante-C-7-Tage.png", [[out.C, "C, 24 Std.", 330], [out.C7, "C, 7 Tage (gleicher Aufbau, Legende mit vier Empfängern)", 330]]);
await close();
