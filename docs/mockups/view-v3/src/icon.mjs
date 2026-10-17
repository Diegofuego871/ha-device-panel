// Mockup Symbol der Zeile "Sortierung & Ansicht" (Handy): Zahnrad mit Auge statt der Sortierpfeile.
// A: Zahnrad mit Auge in der Mitte, B: Auge mit Zahnrad-Abzeichen, C: heute (Sortierpfeile).
// Aufruf: CHROMIUM_PATH=... node docs/mockups/view-v3/src/icon.mjs
import { chromium } from "../../../../tests/panel/node_modules/playwright-core/index.mjs";
import { startServer } from "../../../../tests/panel/server.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
const src = readFileSync(new URL("../../../../custom_components/device_panel/panel/device-panel.js", import.meta.url), "utf8");
const path = (k) => src.match(new RegExp(`^  ${k}:\\s*\\n?\\s*"([^"]+)"`, "m"))[1];
const GEAR = path("gear"), EYE = path("eye"), SORT = path("sort");
const svg = (inner, s = 22) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
const ICONS = {
  "A-Zahnrad-mit-Auge": svg(`<path fill="currentColor" d="${GEAR}"/><path fill="currentColor" transform="translate(12 12) scale(.36) translate(-12 -12)" d="${EYE}"/>`),
  "B-Auge-mit-Zahnrad": svg(`<path fill="currentColor" transform="translate(-1.5 -2.5) scale(.9)" d="${EYE}"/><g transform="translate(13.2 12.8) scale(.45)"><circle cx="12" cy="12" r="15" fill="var(--dp-bg, #1c1c1c)"/><path fill="currentColor" d="${GEAR}"/></g>`),
  "C-heute-Sortierpfeile": svg(`<path fill="currentColor" d="${SORT}"/>`, 16),
};
const server = await startServer(8960);
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const theme of ["dark", "light"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:8960/ha-sim.html?lang=de&theme=${theme}`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  const R = `document.querySelector("device-panel").shadowRoot`;
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
  // Alle drei Varianten untereinander: die Zeile dreimal, jede mit eigenem Symbol
  await f.evaluate(new Function("icons", `const r=${R}; const line = r.querySelector("[data-view-open]"); const host = document.createElement("div"); host.className = "mk-icons";
    line.before(host); line.style.display = "none";
    for (const [name, html] of Object.entries(icons)) { const wrap = document.createElement("div"); wrap.style.cssText = "padding:6px 0 2px";
      const cap = document.createElement("div"); cap.textContent = name.replace(/-/g, " "); cap.style.cssText = "font-size:11px;opacity:.55;padding:0 2px 2px"; wrap.appendChild(cap);
      const c = line.cloneNode(true); c.style.display = ""; c.querySelector("svg").outerHTML = html; wrap.appendChild(c); host.appendChild(wrap); }
    host.scrollIntoView({ block: "center" });`), ICONS);
  await p.waitForTimeout(500);
  const el = (await f.evaluateHandle(new Function(`return ${R}.querySelector(".mk-icons")`))).asElement();
  await el.screenshot({ path: `${out}7-Symbol-${theme}.png` });
}
await b.close();
server.close?.();
