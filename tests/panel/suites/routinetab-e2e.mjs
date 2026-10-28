// Reiter "Routinen" im Geräte-Popup (2.174.0, docs/mockups/routine-devtab-v1, B): Suche und Filter (Alle, Aktiv, Aus, Läuft; ohne Herz) immer da; bei mehr als
// einer Routine sind alle zugeklappt (Uhrzeit, Name, Schalter im Kopf, Pfeil), bei genau einer offen; aufgeklappt die Wecker-Karte mit allen Aktionen.
// Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const SEED = (id, device, name, enabled) => ({ id, device_id: device, entity_id: "switch.plug", name, action: "on", back_s: null, kind: "repeat", delay_s: null, date: null, time: "06:30", repeat: "daily", weekdays: null, mday: null, enabled, push: false, target: null, created: Date.now() / 1000 });

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const calls = (type) => p.evaluate((ty) => window.__wsCalls.filter((m) => m.type === ty), type);
    await p.evaluate((rts) => { (window.__routines ||= { list: [], seq: 1, runs: [], tests: [] }).list.push(...rts); }, [SEED("aaaaaaaaaaa1", "d", "Bewässerung", true), SEED("aaaaaaaaaaa2", "d", "Nachtlicht", true), SEED("aaaaaaaaaaa3", "d", "Morgenlicht", false), SEED("aaaaaaaaaaa4", "a", "Einzeln", true)]);
    const root = ".rt-root";
    const state = () => ev(`return { rows: r.querySelectorAll("${root} .rt-rowcard").length, clocks: r.querySelectorAll("${root} .rt-clock").length }`);

    await ev(`r.host._openDevice("d", "routine")`);
    await wait(`return r.querySelectorAll("${root} .rt-rowcard, ${root} .rt-clock").length === 3`);
    check(`[${tag}] Suchfeld und Filter Alle/Aktiv/Aus/Läuft mit Zahlen, kein Herz`, await ev(`const s = r.querySelector("${root} .list-search input[data-rt='list-search']"); const t = [...r.querySelectorAll("${root} .mg-filter .sub-tab")].map((x) => x.querySelector(".tab-s").textContent.trim()).join(); return !!s && t === "3,2,1,0" && !r.querySelector("${root} .mg-filter .sub-tab.fav") && !r.querySelector("${root} .linkbtn.fav")`));
    const s0 = await state();
    check(`[${tag}] drei Routinen: alle zugeklappt, je mit Schalter im Kopf und Pfeil`, s0.rows === 3 && s0.clocks === 0 && (await ev(`return [...r.querySelectorAll("${root} .rt-rowcard")].every((c) => !!c.querySelector(".mg-dsw input") && !!c.querySelector(".mg-lchev"))`)), JSON.stringify(s0));
    check(`[${tag}] Zeile zeigt Uhrzeit und Namen`, await ev(`const c = r.querySelector("${root} .rt-rowcard"); return /\\d{2}:\\d{2}/.test(c.querySelector(".rt-rtime").textContent) && c.querySelector(".mg-t b").textContent.trim().length > 0`));
    check(`[${tag}] Schalter im Kopf: genug Abstand zum Pfeil`, await ev(`const w = r.querySelector("${root} .mg-dwrap"); const s = w.querySelector(".mg-dsw").getBoundingClientRect(); const c = w.querySelector(".mg-lchev .cbtn").getBoundingClientRect(); return c.left - s.right >= 24`));

    // Schalten ohne Aufklappen
    const before = (await calls("device_panel/routine_enable")).length;
    await tap(`${root} .rt-rowcard .mg-dsw input`);
    check(`[${tag}] Schalter in der Zeile: routine_enable gesendet, bleibt zu`, (await wait(`return true`)) && (await calls("device_panel/routine_enable")).length === before + 1 && (await state()).clocks === 0);

    // Aufklappen und Zuklappen
    await tap(`${root} .rt-rowcard .mg-dhead`);
    check(`[${tag}] Zeile antippen: Wecker-Karte mit Aktionen und Pfeil zum Zuklappen, die anderen bleiben zu`, await wait(`return r.querySelectorAll("${root} .rt-clock").length === 1 && r.querySelectorAll("${root} .rt-rowcard").length === 2 && !!r.querySelector("${root} .rt-clock .rt-fold") && !!r.querySelector("${root} .rt-clock .acts [data-rt='edit']")`));
    await tap(`${root} .rt-clock .rt-fold`);
    check(`[${tag}] Pfeil: wieder zu`, await wait(`return r.querySelectorAll("${root} .rt-clock").length === 0 && r.querySelectorAll("${root} .rt-rowcard").length === 3`));

    // Suche und Filter: ein Treffer ist offen, mehrere zu
    await tap(`${root} input[data-rt='list-search']`);
    await p.keyboard.type("nacht");
    check(`[${tag}] Suche mit einem Treffer: offen, Zahl "1 von 3"`, await wait(`return r.querySelectorAll("${root} .rt-clock").length === 1 && r.querySelectorAll("${root} .rt-rowcard").length === 0 && /1/.test(r.querySelector("${root} .list-search .n").textContent) && /3/.test(r.querySelector("${root} .list-search .n").textContent)`));
    check(`[${tag}] Suchfeld behält Fokus beim Tippen`, await ev(`return r.activeElement === r.querySelector("${root} input[data-rt='list-search']")`));
    await ev(`const i = r.querySelector("${root} input[data-rt='list-search']"); i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true }))`);
    await wait(`return r.querySelectorAll("${root} .rt-rowcard").length === 3`);
    await tap(`${root} .mg-filter [data-v="on"]`);
    // Der Schalter oben hat die erste Routine ausgeschaltet: aktiv bleibt eine, aus sind zwei
    check(`[${tag}] Filter "Aktiv": eine Routine, offen`, await wait(`return r.querySelectorAll("${root} .rt-clock").length === 1 && r.querySelectorAll("${root} .rt-rowcard").length === 0 && r.querySelector("${root} .mg-filter .sub-tab.on")?.dataset.v === "on"`));
    await tap(`${root} .mg-filter [data-v="off"]`);
    check(`[${tag}] Filter "Aus": zwei Routinen, beide zu`, await wait(`return r.querySelectorAll("${root} .rt-rowcard").length === 2 && r.querySelectorAll("${root} .rt-clock").length === 0`));
    await tap(`${root} .mg-filter [data-v="running"]`);
    check(`[${tag}] Filter "Läuft" ohne Treffer: Hinweis`, await wait(`return !!r.querySelector("${root} .mg-none")`));

    // Gerät mit genau einer Routine: offen, ohne Pfeil zum Zuklappen
    await ev(`r.host._closeDevice?.()`);
    await ev(`r.host._openDevice("a", "routine")`);
    check(`[${tag}] genau eine Routine: offen, ohne Pfeil zum Zuklappen, Suche und Filter da`, await wait(`return r.querySelectorAll("${root} .rt-clock").length === 1 && !r.querySelector("${root} .rt-clock .rt-fold") && !!r.querySelector("${root} input[data-rt='list-search']") && r.querySelectorAll("${root} .mg-filter .sub-tab").length === 4`));
    check(`[${tag}] Zustand des anderen Geräts nicht übernommen (Filter "Alle", Suche leer)`, await ev(`return r.querySelector("${root} .mg-filter .sub-tab.on")?.dataset.v === "all" && r.querySelector("${root} input[data-rt='list-search']").value === ""`));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
