// Gemeinsame Hilfen für Mockups im echten Panel (Nachbau aus tests/panel,
// erfundene Daten): Seite öffnen, eigene Stile einhängen, Bilder
// nebeneinander zusammensetzen. Nur für docs/mockups/*/src/render.mjs.
import { chromium } from "../../../tests/panel/node_modules/playwright-core/index.mjs";
import { startServer } from "../../../tests/panel/server.mjs";
import { mkdirSync, readFileSync } from "node:fs";

export const R = `document.querySelector("device-panel").shadowRoot`;

// Symbole (Material Design Icons), die das Panel nicht selbst hat.
export const P = {
  eye: "M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z",
  eyeOff:
    "M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.08L19.73,22L21,20.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C21.07,15.5 22.27,13.86 23,12C21.27,7.61 17,4.5 12,4.5C10.6,4.5 9.26,4.75 8,5.2L10.17,7.35C10.74,7.13 11.35,7 12,7Z",
  dragH: "M21,11H3V9H21V11M21,13H3V15H21V13Z",
  home: "M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z",
  close: "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
  search:
    "M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z",
  chevron: "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z",
  chevDown: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  pulse: "M3,13H5.79L10.1,4.79L11.28,13.75L14.5,9.66L17.83,13H21V15H17L14.67,12.67L10.72,17.71L9.84,11.25L7.21,16H3V13Z",
  undo: "M12.5,8C9.85,8 7.45,9 5.6,10.6L2,7V16H11L7.38,12.38C8.77,11.22 10.54,10.5 12.5,10.5C16.04,10.5 19.05,12.81 20.1,16L22.47,15.22C21.08,11.03 17.15,8 12.5,8Z",
  check: "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z",
};
export const svg = (n, s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${P[n]}"/></svg>`;

export async function setup(port, outUrl) {
  const out = new URL("../", outUrl).pathname;
  const tmp = new URL("./out/", outUrl).pathname;
  mkdirSync(tmp, { recursive: true });
  const server = await startServer(port);
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

  // Seite im Nachbau; css wird in den Shadow-Root gehängt. freeze: keine
  // Abfragen und kein Neuaufbau mehr (das Mockup bleibt stehen).
  async function page(mobile, { css = "", freeze = true, lang = "de" } = {}) {
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1.5 });
    const p = await ctx.newPage();
    await p.goto(`http://127.0.0.1:${port}/ha-sim.html?lang=${lang}&theme=${mobile ? "dark" : "light"}`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
    const ev = (code, arg) => f.evaluate(new Function("arg", `const r=${R};` + code), arg);
    await ev(`const s=document.createElement("style"); s.textContent=arg; r.appendChild(s);`, css);
    if (freeze) await ev(`r.host._fetch = () => {};`);
    return { ctx, p, f, ev };
  }

  async function shot(p, mobile, name, { full = false } = {}) {
    const file = `${tmp}${name}.png`;
    await p.waitForTimeout(300);
    if (mobile || full) await p.screenshot({ path: file });
    else await p.screenshot({ path: file, clip: { x: 0, y: 40, width: 1400, height: 900 } });
    return file;
  }

  async function compose(name, items) {
    const p = await b.newPage({ viewport: { width: 400, height: 400 } });
    const img = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
    await p.setContent(`<style>body{margin:0;padding:16px;background:#e8ebf0;font:600 15px system-ui;color:#333}
      .row{display:flex;gap:18px;align-items:flex-start}figure{margin:0}img{display:block;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.15)}
      figcaption{margin:8px 2px 0;font-weight:500;line-height:1.35}</style><div class="row">${items
        .map(([f, cap, w]) => `<figure style="max-width:${w}px"><img src="${img(f)}" style="width:${w}px"><figcaption>${cap}</figcaption></figure>`)
        .join("")}</div>`);
    await p.screenshot({ path: `${out}${name}`, fullPage: true });
    await p.close();
  }

  async function close() {
    await b.close();
    server.close();
  }

  return { page, shot, compose, close };
}
