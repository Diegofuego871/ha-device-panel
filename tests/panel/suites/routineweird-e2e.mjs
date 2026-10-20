// Regler mit unsinnigen Werten der Entität (2.101.1): Text statt Zahl, vertauschte Grenzen, Schritt 0 und ein Schritt mit
// Anführungszeichen und Skript. Der Assistent darf nicht abstürzen, nichts darf ausgeführt werden, die Regler brauchen Zahlen.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const EVIL = '1" autofocus onfocus="window.__xss=1" data-x="';
const ENTS = [
  { entity_id: "climate.weird", name: "Heater", domain: "climate", state: "off", available: true, actions: ["on", "off", "toggle"], options: [{ key: "temperature", type: "temperature", unit: "°C", step: EVIL, min: "abc", max: null }, { key: "hvac_mode", type: "choice", values: ["heat", "cool", 5, null] }] },
  { entity_id: "climate.swapped", name: "Swapped", domain: "climate", state: "off", available: true, actions: ["on", "off", "toggle"], options: [{ key: "temperature", type: "temperature", unit: "°C", step: 0, min: 30, max: 10 }] },
  { entity_id: "light.weird", name: "Hue Lamp", domain: "light", state: "off", available: true, actions: ["on", "off", "toggle"], options: [{ key: "brightness_pct", type: "percent", min: "x", max: 1e999 }, { key: "color_temp_kelvin", type: "kelvin", min: 6500, max: 2000 }] },
];

for (const mobile of [false, true]) {
  const tag = mobile ? "mobile" : "desktop";
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:8950/ha-sim.html?lang=de&theme=light");
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
  const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
  const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
  const tap = async (sel) => {
    for (let n = 1; ; n++) {
      const h = await handle(sel);
      if (!h) throw new Error("fehlt: " + sel);
      try { await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); return; } catch (err) { if (n >= 3 || !/not attached|not stable/.test(String(err))) throw err; await p.waitForTimeout(200); }
    }
  };
  const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
  const win = "dialog.routine-dlg";
  await p.evaluate((ents) => { window.__routineEntities = Object.fromEntries(window.__devices.map((d) => [d.id, ents])); }, ENTS);

  await tap(".toolbar .rtall-btn");
  await wait(`return r.querySelector("dialog.rtall-dlg")?.open`);
  await tap('dialog.rtall-dlg [data-rta="routine-add"]');
  await wait(`return r.querySelectorAll('${win} [data-rt="dev"]').length > 0`);
  await tap(`${win} [data-rt="dev"]`);
  await tap(`${win} [data-rt="nav-next"]`);
  await wait(`return r.querySelectorAll('${win} [data-rt="pick"]').length === ${ENTS.length}`);

  const rangeOk = (key) => ev(`const x = r.querySelector('${win} [data-rt="opt"][data-k="${key}"]'); if (!x) return "fehlt"; const [a, c, s, v] = [x.min, x.max, x.step, x.value].map(Number); return [a, c, s, v].every(Number.isFinite) && a < c && s > 0 && v >= a && v <= c ? "ok" : [x.min, x.max, x.step, x.value].join("|")`);
  for (const [id, keys] of [["climate.weird", ["temperature"]], ["climate.swapped", ["temperature"]], ["light.weird", ["brightness_pct", "color_temp_kelvin"]]]) {
    await tap(`${win} [data-rt="pick"][data-id="${id}"]`);
    await tap(`${win} [data-rt="nav-next"]`);
    check(`[${tag}] ${id}: Seite Optionen öffnet`, await wait(`return r.querySelectorAll('${win} [data-rt="opt"]').length === ${keys.length}`));
    for (const k of keys) check(`[${tag}] ${id}/${k}: Regler mit endlichen Zahlen, min < max, Schritt > 0`, (await rangeOk(k)) === "ok", await rangeOk(k));
    check(`[${tag}] ${id}: kein eingeschleustes Attribut (onfocus, autofocus, data-x)`, await ev(`return !r.querySelector('${win} [onfocus], ${win} [autofocus], ${win} [data-x]') && window.__xss === undefined && top.__xss === undefined`));
    await tap(`${win} [data-rt="nav-back"]`);
    await wait(`return r.querySelectorAll('${win} [data-rt="pick"]').length === ${ENTS.length}`);
  }
  check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
  await ctx.close();
}
await b.close();
process.exit(ok ? 0 : 1);
