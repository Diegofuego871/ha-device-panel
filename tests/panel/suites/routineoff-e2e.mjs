// Ausgeschaltete Routine (2.210.0): die Zeile zeigt "Aus" fett und dahinter, wann sie laufen würde ("nächster Lauf wäre ..."), zugeklappt im Geräte-Popup
// und in der Liste über alle Geräte. Eine eingeschaltete zeigt weiter "nächster Lauf" ohne "Aus". Countdown und Auslöser zeigen keinen Termin.
// Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = { de: { off: "Aus", would: "nächster Lauf wäre", next: "nächster Lauf" }, en: { off: "Off", would: "next run would be", next: "next run" } };
const SEED = (id, name, enabled, extra = {}) => ({ id, device_id: "d", entity_id: "switch.plug", name, action: "on", back_s: null, kind: "repeat", delay_s: null, date: null, time: "06:30", repeat: "daily", weekdays: null, mday: null, enabled, push: false, target: null, created: Date.now() / 1000, ...extra });

for (const lang of ["de", "en"]) {
  const L = T[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    await p.evaluate((rts) => { (window.__routines ||= { list: [], seq: 1, runs: [], tests: [] }).list.push(...rts); }, [SEED("aaaaaaaaaaa1", "Velo", false), SEED("aaaaaaaaaaa2", "Nachtlicht", true, { __due: Date.now() / 1000 + 3600 }), SEED("aaaaaaaaaaa3", "Timer", false, { kind: "countdown", delay_s: 600, time: null, repeat: null })]);
    await ev(`r.host._openDevice("d", "routine")`);
    await wait(`return r.querySelectorAll(".rt-root .rt-rowcard").length === 3`);
    const sum = (name) => ev(`const c = [...r.querySelectorAll(".rt-root .rt-rowcard")].find((x) => x.querySelector(".mg-t b").textContent.includes(${JSON.stringify(name)})); return { text: c.querySelector(".mg-dsum").textContent.replace(/\\s+/g, " ").trim(), bold: c.querySelector(".mg-dsum .rt-offword")?.textContent || "", off: c.classList.contains("off") }`);
    const a = await sum("Velo");
    check(`[${tag}] ausgeschaltet, zugeklappt: "${L.off}" und "${L.would} ..." mit Zeit`, a.bold === L.off && a.text.startsWith(L.off) && a.text.includes(L.would) && /06:30/.test(a.text) && a.off, a.text);
    const n = await sum("Nachtlicht");
    check(`[${tag}] eingeschaltet: "${L.next}", ohne "${L.off}"`, n.text.includes(L.next) && !n.bold && !n.text.includes(L.would), n.text);
    const c = await sum("Timer");
    check(`[${tag}] Countdown ausgeschaltet: nur "${L.off}", kein Termin`, c.bold === L.off && !c.text.includes(L.would), c.text);
    check(`[${tag}] keine Fehler`, errors.length === 0, errors.join("|"));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
