// Mockups "Profi-Modus der KI-Einschätzung" (Rückfrage des Nutzers, 2026-10-04): statisches HTML, erfundene Daten.
// CHROMIUM_PATH=... node docs/mockups/ai-v1/src/render.mjs
import { chromium } from "../../../../tests/panel/node_modules/playwright-core/index.mjs";
const dir = new URL("./", import.meta.url).pathname;
const out = new URL("../", import.meta.url).pathname;
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const [src, name] of [["1", "1-abschnitt"], ["2", "2-fenster"]]) {
  const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5 });
  await p.goto(`file://${dir}${src}.html`);
  const box = await p.evaluate(() => { const r = document.querySelector(".row").getBoundingClientRect(); return { w: Math.ceil(r.right + 24), h: Math.ceil(r.bottom + 24) }; });
  await p.setViewportSize({ width: Math.max(box.w, 600), height: box.h });
  await p.screenshot({ path: `${out}${name}.png`, fullPage: true });
  await p.close();
}
await b.close();
