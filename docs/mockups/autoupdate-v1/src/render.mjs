// Mockups autoupdate-v1 (Wunsch des Nutzers, 2026-10-14): ein "cooles Symbol", sobald das automatische Installieren von Updates aktiv ist.
// Gezeigt in der Versionsleiste der Einstellungen (echtes Panel im Nachbau, erfundene Daten). "Aktiv" heisst: Schalter "Automatisch
// installieren" an und tägliche Prüfung an (so, wie das Panel es selbst wertet, _autoActive).
//   Vorher: Auto-Update aus
//   A: kleines Abzeichen mit kreisenden Pfeilen auf dem grünen Symbol, "automatisch" im Untertitel
//   B: Pille "Auto" hinter dem Titel (wie die Pille "Beta"), Symbol bleibt
//   C: lebendiges Symbol: ein Ring dreht sich langsam um das Häkchen (bei "weniger Bewegung" steht er still)
// Aufruf: CHROMIUM_PATH=... node docs/mockups/autoupdate-v1/src/render.mjs
import { setup } from "../../_lib/mock.mjs";
const { page, compose, close } = await setup(8999, import.meta.url);
const tmp = new URL("./out/", import.meta.url).pathname;

const P = {"refreshAuto": "M12.68 6H11.32L7 16H9L9.73 14H14.27L15 16H17L12.68 6M10.3 12.5L12 8L13.7 12.5H10.3M17.4 20.4L19 22H14V17L16 19C18.39 17.61 20 14.95 20 12C20 7.59 16.41 4 12 4S4 7.59 4 12C4 14.95 5.61 17.53 8 18.92V21.16C4.47 19.61 2 16.1 2 12C2 6.5 6.5 2 12 2S22 6.5 22 12C22 15.53 20.17 18.62 17.4 20.4Z", "autorenew": "M12,6V9L16,5L12,1V4A8,8 0 0,0 4,12C4,13.57 4.46,15.03 5.24,16.26L6.7,14.8C6.25,13.97 6,13 6,12A6,6 0 0,1 12,6M18.76,7.74L17.3,9.2C17.74,10.04 18,11 18,12A6,6 0 0,1 12,18V15L8,19L12,23V20A8,8 0 0,0 20,12C20,10.43 19.54,8.97 18.76,7.74Z"};
const ic = (k, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${P[k]}"/></svg>`;

const CSS = `
.ver-ic { position: relative; }
.au-badge { position: absolute; right: -5px; bottom: -5px; display: grid; place-items: center; width: 17px; height: 17px; border-radius: 50%;
  background: var(--dp-primary); color: #fff; box-shadow: 0 0 0 2px var(--dp-card); }
.au-pill { display: inline-flex; align-items: center; gap: 3px; margin-left: 6px; padding: 1px 8px 1px 6px; border-radius: 999px; font-size: 11px; font-weight: 600;
  background: var(--dp-primary-soft); color: var(--dp-primary); vertical-align: 1px; }
.au-ring { position: absolute; inset: -4px; display: grid; place-items: center; color: var(--dp-success); animation: au-spin 6s linear infinite; }
.au-ring svg { width: 100%; height: 100%; }
@keyframes au-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .au-ring { animation: none; } }
`;

async function shot(mobile, mode, name) {
  const { ctx, p, ev } = await page(mobile, { css: CSS, freeze: true });
  await ev(`r.querySelector(".gear-btn").click();`);
  await p.waitForTimeout(700);
  await ev(`
    const row = r.querySelector("dialog.settings .ver");
    if (!row) throw new Error("keine Versionsleiste im Nachbau");
    const ico = row.querySelector(".ver-ic"), title = row.querySelector(".ver-t b"), sub = row.querySelector(".ver-t small");
    if (arg.mode === "A") { ico.insertAdjacentHTML("beforeend", '<span class="au-badge">' + arg.badge + '</span>'); sub.textContent = sub.textContent.replace("Aktuell", "Aktuell · automatisch"); }
    if (arg.mode === "B") { title.insertAdjacentHTML("beforeend", '<span class="au-pill">' + arg.pill + 'Auto</span>'); sub.textContent = sub.textContent.replace("Aktuell", "Aktuell · Updates automatisch"); }
    if (arg.mode === "C") { ico.insertAdjacentHTML("beforeend", '<span class="au-ring">' + arg.ring + '</span>'); sub.textContent = sub.textContent.replace("Aktuell", "Aktuell · automatisch"); }
  `, { mode, badge: ic("refreshAuto", 11), pill: ic("autorenew", 11), ring: `<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="46 14" stroke-linecap="round" opacity=".85"/></svg>` });
  const file = `${tmp}${name}.png`;
  await p.waitForTimeout(300);
  const box = await ev(`const r2 = r.querySelector("dialog.settings .ver").getBoundingClientRect(); return { x: r2.x, y: r2.y, width: r2.width, height: r2.height }`);
  // Die Koordinaten gelten im Rahmen des Panels: den Versatz des Rahmens in der Seite dazurechnen
  const off = await p.evaluate(() => { const r = document.querySelector("#panel-frame").getBoundingClientRect(); return { x: r.x, y: r.y }; });
  const vp = p.viewportSize();
  const x = Math.max(0, off.x + box.x - 24), y = Math.max(0, off.y + box.y - 24);
  await p.screenshot({ path: file, clip: { x, y, width: Math.min(box.width + 48, vp.width - x, mobile ? 390 : 760), height: Math.min(box.height + 48, vp.height - y) } });
  await ctx.close();
  return file;
}

const out = [];
for (const [mobile, w] of [[false, 560], [true, 330]]) {
  const tag = mobile ? "Handy (dunkel)" : "Desktop (hell)";
  const items = [];
  for (const [mode, cap] of [["none", "Vorher: Auto-Update aus"], ["A", "A: Abzeichen auf dem Symbol"], ["B", "B: Pille \"Auto\""], ["C", "C: Ring dreht sich"]]) items.push([await shot(mobile, mode, `${mobile ? "m" : "d"}-${mode}`), `${tag} · ${cap}`, w]);
  out.push(items);
}
await compose("1-Varianten-Desktop.png", out[0].slice(0, 2));
await compose("2-Varianten-Desktop-2.png", out[0].slice(2));
await compose("3-Varianten-Handy.png", out[1]);
await close();
