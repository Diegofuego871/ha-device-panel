// Rendert die Mockups als PNG (Desktop 1440 px, Handy 390 x 844 @2x) nach out/.
// Aufruf: node render.mjs [Namensanfang …], z. B. node render.mjs B-
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { page } from "./base.mjs";
import * as A from "./variantA.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const out = `${here}out/`;
mkdirSync(out, { recursive: true });
const only = process.argv.slice(2);

const SCREENS = [
  ["A-desktop", () => A.mainA(), A.CSS_A, { width: 1440, height: 1000 }, "light"],
  ["A-desktop-dark", () => A.mainA({ popover: false }), A.CSS_A, { width: 1440, height: 1000 }, "dark"],
  ["A-device", () => A.deviceA(), A.CSS_A, { width: 1440, height: 1200 }, "light"],
  ["A-mobile", () => A.mobileA(), A.CSS_A + A.CSS_A_M, { width: 390, height: 844, mobile: true }, "light"],
  ["A-mobile-device", () => A.mobileDeviceA(), A.CSS_A + A.CSS_A_M, { width: 390, height: 844, mobile: true }, "light"],
];

let extra = [];
try { extra = (await import("./variantB.mjs")).SCREENS_B || []; } catch {}
try { extra = extra.concat((await import("./settings.mjs")).SCREENS_S || []); } catch {}
try { extra = extra.concat((await import("./variantC.mjs")).SCREENS_C || []); } catch (e) { console.error(e); }
try { extra = extra.concat((await import("./monitoring.mjs")).SCREENS_M || []); } catch (e) { console.error(e); }

// Chromium: eigener Pfad über CHROMIUM_PATH, sonst der von playwright-core installierte.
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const [name, body, css, vp, theme] of [...SCREENS, ...extra]) {
  if (only.length && !only.some((o) => name.startsWith(o))) continue;
  const p = await b.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.mobile ? 2 : 1 });
  writeFileSync(`${out}${name}.html`, page(body(), { theme, extraCss: css }));
  await p.goto(`file://${out}${name}.html`);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `${out}${name}.png`, fullPage: !vp.mobile && !vp.fixed });
  await p.close();
  console.log("ok", name);
}
await b.close();
