// Popup und Protokoll bauen sich beim Nachfragen nicht neu auf, solange der Benutzer das Fenster berührt, wischt
// oder eine Auswahl offen hat (iPhone: sonst bricht die Wischbewegung ab, die Seite scrollt mit und löst das Neuladen aus).
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
for (const mobile of [false, true]) {
  const tag = mobile ? "mobile" : "desktop";
  const ctx = await b.newContext(mobile ? { viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:8950/ha-sim.html?lang=de&theme=dark");
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
  const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
  const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
  const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
  const wait = (c, ms = 8000) => f.waitForFunction(new Function(`const r=${R};` + c), null, { timeout: ms }).then(() => true, () => false);
  const bat = () => ev(`return (r.querySelector('dialog.device .st-tile[data-kind="battery"] .st-v')?.textContent || "").replace(/\\s+/g, "")`);
  const fire = (sel, type) => ev(`r.querySelector(${JSON.stringify(sel)}).dispatchEvent(new Event(${JSON.stringify(type)}, { bubbles: false }))`);

  // Popup: Batteriestand ändert sich im Hintergrund, während der Benutzer das Fenster berührt
  await tap('.dev[data-open="b"]');
  await wait(`return r.querySelector("dialog.device")?.open && !!r.querySelector('dialog.device .st-tile[data-kind="battery"]')`);
  check(`[${tag}] Popup zeigt 8 %`, (await bat()) === "8%", await bat());
  await ev(`r.querySelector("dialog.device").dispatchEvent(new Event("touchstart", { bubbles: true }))`);
  await p.evaluate(() => { window.__devices.find((d) => d.id === "b").battery.level = 55; });
  await ev(`r.host._fetch()`);
  await p.waitForTimeout(1500);
  check(`[${tag}] Berührung: Popup bleibt unverändert (8 %)`, (await bat()) === "8%", await bat());
  await ev(`r.querySelector("dialog.device").dispatchEvent(new Event("touchend", { bubbles: true }))`);
  check(`[${tag}] nach der Berührung baut sich das Popup neu auf (55 %)`, await wait(`return (r.querySelector('dialog.device .st-tile[data-kind="battery"] .st-v')?.textContent || "").replace(/\\s+/g, "") === "55%"`, 6000), await bat());

  // Wischen (scroll-Ereignis im Popup)
  await ev(`r.querySelector("dialog.device").dispatchEvent(new Event("scroll"))`);
  await p.evaluate(() => { window.__devices.find((d) => d.id === "b").battery.level = 42; });
  await ev(`r.host._fetch()`);
  await p.waitForTimeout(500);
  check(`[${tag}] Wischen: Popup bleibt unverändert (55 %)`, (await bat()) === "55%", await bat());
  check(`[${tag}] danach aktuell (42 %)`, await wait(`return (r.querySelector('dialog.device .st-tile[data-kind="battery"] .st-v')?.textContent || "").replace(/\\s+/g, "") === "42%"`, 6000), await bat());

  // Aktionen des Benutzers bauen sofort neu auf (Reiter wechseln trotz kürzlicher Berührung)
  await ev(`r.querySelector("dialog.device").dispatchEvent(new Event("touchend", { bubbles: true }))`);
  await tap('dialog.device [data-tab="set"]');
  check(`[${tag}] Reiterwechsel sofort`, await wait(`return !!r.querySelector('dialog.device select[data-dlg="type"]')`, 1000));
  await tap('dialog.device [data-dlg="close"]');

  // Protokoll: neuer Eintrag kommt nicht mitten in einer Wischbewegung der Liste
  await tap(".log-btn");
  await wait(`return r.querySelector("dialog.log-dlg")?.open && r.querySelectorAll("dialog.log-dlg .lg-row").length > 0`);
  const rows = () => ev(`return r.querySelectorAll("dialog.log-dlg .lg-row").length`);
  const n = await rows();
  await ev(`r.querySelector('dialog.log-dlg [data-lg="list"]').dispatchEvent(new Event("scroll"))`);
  await p.evaluate(() => { window.__log.entries.push({ at: Date.now() / 1000, level: "info", cat: "system", title: "Neu", text: "neuer Eintrag", detail: "", device_id: null }); });
  await ev(`r.host._fetchLog()`);
  await p.waitForTimeout(500);
  check(`[${tag}] Protokoll: während des Wischens unverändert`, (await rows()) === n, `${n} -> ${await rows()}`);
  check(`[${tag}] Protokoll: danach mit dem neuen Eintrag`, await wait(`return r.querySelectorAll("dialog.log-dlg .lg-row").length === ${n + 1}`, 6000), String(await rows()));
  await tap("dialog.log-dlg [data-lg-close]");
  check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
