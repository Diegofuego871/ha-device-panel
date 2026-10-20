// Mockups "Empfangsfenster übersichtlicher" (Wunsch des Nutzers, 2026-10-20): statisches HTML, erfundene Daten. Aufruf:
// CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/signal-layout-v1/src/render.mjs
import { chromium } from "../../../../tests/panel/node_modules/playwright-core/index.mjs";
const dir = new URL("./", import.meta.url).pathname;
const out = new URL("../", import.meta.url).pathname;
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const p = await b.newPage({ viewport: { width: 1800, height: 900 }, deviceScaleFactor: 1.3 });
await p.goto(`file://${dir}1.html`);
const box = await p.evaluate(() => { const r = document.querySelector(".row").getBoundingClientRect(); return { w: Math.ceil(r.right + 24), h: Math.ceil(r.bottom + 24) }; });
await p.setViewportSize({ width: box.w, height: box.h });
await p.screenshot({ path: `${out}1-varianten.png`, fullPage: true });
await b.close();
