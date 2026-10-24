// Mockups "Einrichtungsassistent" (Wunsch des Nutzers, 2026-10-24): statisches HTML, erfundene Daten. Aufruf:
// (cd docs/mockups/wizard-v1/src && python3 build.py) && CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/wizard-v1/src/render.mjs
import { chromium } from "../../../../tests/panel/node_modules/playwright-core/index.mjs";
const dir = new URL("./", import.meta.url).pathname;
const out = new URL("../", import.meta.url).pathname;
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const p = await b.newPage({ viewport: { width: 2400, height: 900 }, deviceScaleFactor: 1.2 });
for (const [n, name] of [[1, "1-ablauf-handy-a"], [2, "2-ablauf-handy-b"], [3, "3-desktop"], [4, "4-einstiege-und-zustaende"]]) {
  await p.goto(`file://${dir}${n}.html`);
  const box = await p.evaluate(() => { const r = document.querySelector(".row").getBoundingClientRect(); return { w: Math.ceil(r.right + 24), h: Math.ceil(r.bottom + 24) }; });
  await p.setViewportSize({ width: box.w, height: box.h });
  await p.screenshot({ path: `${out}${name}.png`, fullPage: true });
}
await b.close();
