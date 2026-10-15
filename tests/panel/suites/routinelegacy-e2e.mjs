// Umbenennung Timer → Routine (2.55.0): was ein Benutzer vorher gespeichert hat, bleibt erhalten. Lieblings-Routinen (Benutzerdaten
// "device_panel_timer_stars") wandern unter den neuen Namen, der alte Eintrag wird geleert; die App "timer" des Launchers
// (Favorit, Ausgeblendetes, Reihenfolge) heisst jetzt "routine".
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.addInitScript(() => {
  if (sessionStorage.getItem("sim_user_data")) return;
  sessionStorage.setItem("sim_user_data", JSON.stringify({
    device_panel_timer_stars: { ids: ["aaaaaaaaaaa2"], updated: 5 },
    device_panel_apps: { fav: ["timer", "magic"], hidden: [], order: { panel: ["log", "timer"] }, custom: [], layout: {}, updated: 5 },
  }));
});
await p.goto("http://127.0.0.1:8950/ha-sim.html?lang=de&theme=light");
const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
const sets = (key) => p.evaluate((k) => window.__wsCalls.filter((m) => m.type === "frontend/set_user_data" && m.key === k), key);
const waitFor = async (fn) => { for (let i = 0; i < 40; i++) { const v = await fn(); if (v) return v; await p.waitForTimeout(200); } return null; };

const moved = await waitFor(async () => { const s = await sets("device_panel_routine_stars"); return s.length ? s : null; });
check("Lieblings-Routinen: unter dem neuen Namen gespeichert, mit derselben ID", !!moved && JSON.stringify(moved.at(-1).value.ids) === JSON.stringify(["aaaaaaaaaaa2"]), JSON.stringify(moved));
const cleared = await waitFor(async () => { const s = await sets("device_panel_timer_stars"); return s.length ? s : null; });
check("alter Eintrag geleert", !!cleared && cleared.at(-1).value === null, JSON.stringify(cleared));
check("Lieblings-Routinen: danach auch im Speicher des Browsers unter dem neuen Namen", await p.evaluate(() => {
  const raw = sessionStorage.getItem("sim_user_data");
  const d = JSON.parse(raw || "{}");
  return Array.isArray(d.device_panel_routine_stars?.ids) && d.device_panel_timer_stars === null;
}));
const pinOk = await waitFor(() => ev(`return !!r.querySelector('.toolbar .app-pin[data-app-pin="routine"]') && !r.querySelector('.toolbar .app-pin[data-app-pin="timer"]')`));
check("App des Launchers: der Favorit heisst jetzt \"routine\"", pinOk, await ev(`return [...r.querySelectorAll(".toolbar .app-pin")].map((e) => e.dataset.appPin).join()`));
check("keine Fehler in der Seite", errors.length === 0, errors.join(" | "));
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
