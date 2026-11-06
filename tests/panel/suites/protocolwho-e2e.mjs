// Protokoll über alle Geräte (2.201.1): in den Reitern "Routinen" und "Magic Push" steht unter der Aktion bzw. dem Titel der Name der Routine oder Meldung und das
// Gerät; ist eine einzelne gewählt, fehlt der Name; im Protokoll eines Geräts fehlt das Gerät.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
for (const mobile of [false, true]) {
  const tag = mobile ? "mobile" : "desktop";
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:8950/ha-sim.html?lang=de&theme=dark");
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
  const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
  const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
  const now = Math.round(Date.now() / 1000);
  await p.evaluate((n) => {
    const rt = { id: "aaaaaaaaaaa1", device_id: "d", entity_id: "switch.plug", name: "Bewässerung", action: "on", back_s: 14400, kind: "repeat", delay_s: null, date: null, time: "06:30", repeat: "daily", weekdays: null, mday: null, enabled: true, push: false };
    const rt2 = { ...rt, id: "aaaaaaaaaaa2", device_id: "h", name: "Licht Abend" };
    (window.__routines ||= { list: [], seq: 1, runs: [], tests: [] }).list.push(rt, rt2);
    window.__protocol = { aaaaaaaaaaa1: [{ at: n - 3600, k: "run", src: "time", ok: true, act: "on", ent: "switch.plug", late: 1, trace: [] }], aaaaaaaaaaa2: [{ at: n - 7200, k: "run", src: "time", ok: true, act: "on", ent: "switch.plug", late: 1, trace: [] }] };
  }, now);
  await ev(`r.host._protocol.open({ kind: "routine" })`);
  await wait(`return r.querySelectorAll("dialog.proto-dlg .pr-row[data-pr='trace']").length > 0`);
  const rows = JSON.parse(await ev(`return JSON.stringify([...r.querySelectorAll("dialog.proto-dlg .pr-row[data-pr='trace'] .c-main")].map((x) => ({ act: x.querySelector("b")?.textContent || "", who: x.querySelector("small")?.textContent || "" })))`));
  const items = JSON.parse(await ev(`return JSON.stringify(r.host._protocol.s.items.map((i) => ({ id: i.id, name: i.name, device_id: i.device_id })))`));
  check(`[${tag}] Routinen über alle Geräte: Zeilen vorhanden`, rows.length > 0, JSON.stringify(rows.slice(0, 2)));
  const names = new Set(items.map((i) => i.name));
  check(`[${tag}] jede Zeile nennt unter der Aktion den Namen der Routine`, rows.every((x) => [...names].some((n) => x.who.includes(n))), JSON.stringify(rows.slice(0, 3)));
  const devNames = JSON.parse(await ev(`return JSON.stringify(r.host._devices.map((d) => d.name))`));
  check(`[${tag}] und das Gerät (Name des Geräts steht in der Zeile)`, rows.every((x) => devNames.some((n) => x.who.includes(n))), JSON.stringify(rows.slice(0, 3)));
  check(`[${tag}] keine Fehler`, errors.length === 0, errors.join("|"));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
