// Aufgeklappte Gruppe der Einstellungen (2.97.0): die Kopfzeile bleibt unter dem Dialog-Kopf haften, bis die nächste Gruppe sie wegschiebt;
// geschlossene Gruppen kleben nicht; ein Tipp auf die angeheftete Kopfzeile schliesst die Gruppe und holt sie an den oberen Rand.
// Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

for (const mobile of [false, true]) {
  const tag = mobile ? "mobile" : "desktop";
  const ctx = await b.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:8950/ha-sim.html?lang=de&theme=light");
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
  const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
  const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
  const tap = async (sel) => { const h = (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement(); if (!h) throw new Error("fehlt: " + sel); if (mobile) await h.tap(); else await h.click(); };

  await tap(".gear-btn");
  await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
  for (const id of ["devices", "monitor", "routines", "ai", "updates"]) await tap(`[data-set="section"][data-id="${id}"]`);
  await wait(`return r.querySelectorAll(".set-sec.open").length === 5`);
  // Geometrie: Oberkante der Kopfzeile minus Unterkante des Dialog-Kopfes
  const geo = (id) => ev(`const d = r.querySelector("dialog.settings"); const hb = d.querySelector(".dlg-head").getBoundingClientRect().bottom; const s = r.querySelector('.set-sec-head[data-id="${id}"]').closest(".set-sec"); const h = s.querySelector(".set-sec-head").getBoundingClientRect(); const sb = s.getBoundingClientRect(); return { d: h.top - hb, secTop: sb.top - hb, secBottom: sb.bottom - hb, headBottom: h.bottom - hb, cs: getComputedStyle(s.querySelector(".set-sec-head")).position, h: sb.height }`);
  // Gruppe id so scrollen, dass ihre Oberkante dy unter (positiv) oder über (negativ) dem Dialog-Kopf liegt
  const place = async (id, dy) => { await ev(`const d = r.querySelector("dialog.settings"); const hb = d.querySelector(".dlg-head").getBoundingClientRect().bottom; const s = r.querySelector('.set-sec-head[data-id="${id}"]').closest(".set-sec"); d.scrollTop += s.getBoundingClientRect().top - hb - (${dy});`); await p.waitForTimeout(150); };

  check(`[${tag}] aufgeklappt: Kopfzeile ist sticky`, (await geo("devices")).cs === "sticky");
  const H = (await geo("devices")).h;
  check(`[${tag}] Gruppe "Geräte im Panel" ist lang genug für den Test`, H > 600, String(H));
  await ev(`r.querySelector("dialog.settings").scrollTop = 0`);
  await place("devices", -Math.round(H * 0.4));
  let g = await geo("devices");
  check(`[${tag}] mitten in der Gruppe: Kopfzeile unter dem Dialog-Kopf angeheftet`, Math.abs(g.d) <= 1.5 && g.secTop < -100, JSON.stringify(g));
  const gm = await geo("monitor");
  check(`[${tag}] die nächste Gruppe liegt darunter und klebt noch nicht`, gm.d > 50, JSON.stringify(gm));
  // Ende der Gruppe: die nächste Gruppe schiebt die Kopfzeile weg
  await place("devices", -(H - 10));
  g = await geo("devices");
  check(`[${tag}] am Ende der Gruppe: Kopfzeile wird mit weggeschoben`, g.headBottom <= g.secBottom + 1 && g.d < 0, JSON.stringify(g));
  // In die nächste Gruppe: deren Kopfzeile klebt, die vorige ist weg
  const H2 = (await geo("monitor")).h;
  await place("monitor", -Math.round(H2 * 0.3));
  g = await geo("monitor");
  const g1 = await geo("devices");
  check(`[${tag}] nächste Gruppe: Kopfzeile angeheftet, die vorige weg`, Math.abs(g.d) <= 1.5 && g1.secBottom < 2, JSON.stringify([g, g1]));
  // Kopfzeile antippen: schliesst, Gruppe oben am Rand
  await tap('.set-sec-head[data-id="monitor"]');
  await wait(`return !r.querySelector('.set-sec-head[data-id="monitor"]').closest(".set-sec").classList.contains("open")`);
  await p.waitForTimeout(250);
  g = await geo("monitor");
  check(`[${tag}] geschlossen: Gruppe sichtbar am oberen Rand`, Math.abs(g.secTop) <= 2 && g.cs === "static", JSON.stringify(g));
  check(`[${tag}] zugeklappte Gruppe: nicht sticky`, (await ev(`return getComputedStyle(r.querySelector('.set-sec-head[data-id="monitor"]')).position`)) === "static");
  check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
  await ctx.close();
}
await b.close();
process.exit(ok ? 0 : 1);
