// Reiterkapsel springt nicht zurück, wenn gleich nach dem Tipp neu gezeichnet wird (2.80.0, Video des Nutzers: Status-App, Daten treffen
// während der Fahrt ein). Die Kapsel fährt monoton vom alten zum neuen Reiter, auch wenn mitten drin neu gezeichnet wird.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto("http://127.0.0.1:8950/ha-sim.html?lang=de&theme=dark");
const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
const R = `document.querySelector("device-panel")`;
await f.waitForFunction(new Function(`return ${R}?.shadowRoot?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
await f.evaluate(new Function(`${R}._status.open()`));
await f.waitForFunction(new Function(`return !!${R}.shadowRoot.querySelector("dialog.status-dlg .sub-tabs .seg-pill")`), null, { timeout: 5000 });
await p.waitForTimeout(600);
for (const [from, to, again] of [["services", "settings", 90], ["settings", "services", 160], ["services", "system", 40]]) {
  const out = await f.evaluate(new Function(`const from = ${JSON.stringify(from)}, to = ${JSON.stringify(to)}, again = ${again}; return new Promise((res) => {
    const host = ${R}; const r = host.shadowRoot;
    const tab = (k) => r.querySelector('dialog.status-dlg [data-st-tab="' + k + '"]');
    const left = () => { const q = r.querySelector("dialog.status-dlg .sub-tabs > .seg-pill"); return q ? q.getBoundingClientRect().left : null; };
    const start = left(); const goal = tab(to).getBoundingClientRect().left;
    const xs = []; const t0 = performance.now();
    tab(to).click();
    setTimeout(() => host._status.render(true), again);
    const tick = () => { const x = left(); if (x != null) xs.push(x); if (performance.now() - t0 < 700) requestAnimationFrame(tick); else res({ xs, start, goal }); };
    tick();
  })`));
  const dir = Math.sign(out.goal - out.start);
  let back = 0;
  for (let i = 1; i < out.xs.length; i++) if ((out.xs[i] - out.xs[i - 1]) * dir < -1) back++;
  check(`${from} → ${to}, Neuzeichnen nach ${again} ms: Kapsel fährt ohne Rücksprung`, back === 0 && Math.abs(out.xs.at(-1) - out.goal) < 1.5, `Rückschritte ${back}, Ende ${out.xs.at(-1)} Ziel ${out.goal}`);
  await p.waitForTimeout(500);
}
check("keine Seitenfehler", errors.length === 0, errors.join("|"));
await b.close();
process.exit(ok ? 0 : 1);
