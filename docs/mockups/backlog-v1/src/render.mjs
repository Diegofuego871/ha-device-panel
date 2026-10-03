// Mockups Backlog 4, 5, 7, 10 (Nutzer, 2026-10-03): statisches HTML mit der
// Optik des Panels, erfundene Daten. Aufruf:
// CHROMIUM_PATH=... node docs/mockups/backlog-v1/src/render.mjs
import { chromium } from "../../../../tests/panel/node_modules/playwright-core/index.mjs";
const dir = new URL("./", import.meta.url).pathname;
const out = new URL("../", import.meta.url).pathname;
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const [src, name] of [["p5", "1-punkt5-ausgefallen-nach"], ["p7", "2-punkt7-herkunft"], ["p10", "3-punkt10-ki"], ["p4", "4-punkt4-matter"]]) {
  const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5 });
  await p.goto(`file://${dir}${src}.html`);
  const box = await p.evaluate(() => { const r = document.querySelector(".row").getBoundingClientRect(); return { w: Math.ceil(r.right + 24), h: Math.ceil(r.bottom + 24) }; });
  await p.setViewportSize({ width: Math.max(box.w, 600), height: box.h });
  await p.screenshot({ path: `${out}${name}.png`, fullPage: true });
  await p.close();
}
await b.close();
