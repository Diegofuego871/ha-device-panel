// Mockup "Symbol für Ausfall": rendert index.html zu tab-icon-outage-v1.png (erfundene Daten, kein Panel nötig).
import { chromium } from "../../../tests/panel/node_modules/playwright-core/index.mjs";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await p.goto("file://" + new URL("./index.html", import.meta.url).pathname);
await p.screenshot({ path: new URL("./tab-icon-outage-v1.png", import.meta.url).pathname, fullPage: true });
await b.close();
