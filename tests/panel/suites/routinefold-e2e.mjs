// Fenster "Alle Routinen", zugeklappte Karten (2.171.0, seit 2.183.0 eine Karte je Routine): bei mehr als einer sichtbaren Routine sind alle zu, auch bei einer Suche;
// bei genau einer offen. Zugeklappt sitzt der Schalter im Kopf, im Kopf steht immer der Name der Routine.
// "Gerät öffnen" steht aufgeklappt in der Zeile unter dem Namen, die Fusszeile entfällt. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = { de: { open: "Gerät öffnen" }, en: { open: "Open device" } };
const SEED = (id, device, name, enabled) => ({ id, device_id: device, entity_id: "switch.plug", name, action: "on", back_s: null, kind: "repeat", delay_s: null, date: null, time: "06:30", repeat: "daily", weekdays: null, mday: null, enabled, push: false, target: null, created: Date.now() / 1000 });

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const L = T[lang];
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
    await p.evaluate(([x, y, z]) => { (window.__routines ||= { list: [], seq: 1, runs: [], tests: [] }).list.push(x, y, z); }, [SEED("aaaaaaaaaaa1", "d", "Bewässerung", true), SEED("aaaaaaaaaaa2", "a", "Nachtlicht", true), SEED("aaaaaaaaaaa3", "a", "Morgenlicht", false)]);
    await tap(".rtall-btn");
    const dlg = "dialog.rtall-dlg";
    await wait(`return !!r.querySelector("${dlg} .mg-dcard")`);
    const cards = () => ev(`return [...r.querySelectorAll("${dlg} .mg-dcard")].map((c) => ({ name: c.querySelector(".mg-dhead .mg-t b").textContent.trim(), closed: c.classList.contains("closed"), sw: !!c.querySelector(".mg-dsw input"), badge: !!c.querySelector(".mg-badge"), lines: c.querySelectorAll(".mg-rline").length, cards: c.querySelectorAll(".mg-card").length }))`);

    // Eine Karte je Routine (seit 2.183.0): im Kopf immer der Name der Routine, zugeklappt mit Schalter, keine Zeilen, keine Zahl
    const c0 = await cards();
    check(`[${tag}] drei Routinen: drei Karten, alle zugeklappt, Name im Kopf`, c0.length === 3 && c0.every((c) => c.closed && c.cards === 0) && c0.map((c) => c.name).sort().join("|") === ["Bewässerung", "Morgenlicht", "Nachtlicht"].join("|"), JSON.stringify(c0));
    check(`[${tag}] zugeklappt: Schalter im Kopf, keine Zahl, keine Zeilen`, c0.every((c) => c.sw && !c.badge && c.lines === 0), JSON.stringify(c0));
    // Abstand zwischen Schalter und rundem Pfeil mindestens 24 px (2.173.1)
    check(`[${tag}] Schalter im Kopf: genug Abstand zum runden Pfeil`, await ev(`const w = r.querySelector("${dlg} .mg-dwrap"); const s = w.querySelector(".mg-dsw").getBoundingClientRect(); const c = w.querySelector(".mg-lchev .cbtn").getBoundingClientRect(); return c.left - s.right >= 24 - 1`));

    // Schalten ohne Aufklappen
    const before = (await calls("device_panel/routine_enable")).length;
    await tap(`${dlg} .mg-dsw input`);
    check(`[${tag}] Schalter im Kopf: routine_enable gesendet, Karte bleibt zu`, await wait(`return !r.querySelector("${dlg} .mg-dsw input").checked`) && (await calls("device_panel/routine_enable")).length === before + 1 && (await cards()).every((c) => c.closed));
    await tap(`${dlg} .mg-dsw input`);
    await wait(`return r.querySelector("${dlg} .mg-dsw input").checked`);

    // Aufklappen: Name bleibt im Kopf, darunter Gerät, Bereich und "Gerät öffnen", die Karte wiederholt den Namen nicht, keine Fusszeile
    await tap(`${dlg} .mg-dcard .mg-dhead`);
    check(`[${tag}] aufgeklappt: Karte mit Aktionen, Schalter nur in der Karte, keine Zahl`, await wait(`const c = r.querySelector("${dlg} .mg-dcard:not(.closed)"); return !!c && !!c.querySelector(".mg-card .mg-acts") && !c.querySelector(".mg-badge") && !c.querySelector(".mg-dsw") && !!c.querySelector(".mg-card input[data-rta='routine-toggle']")`));
    check(`[${tag}] aufgeklappt: Gerät und "${L.open} ›" unter dem Namen, Name nicht doppelt, keine Fusszeile`, await ev(`const c = r.querySelector("${dlg} .mg-dcard:not(.closed)"); const h = c.querySelector(".mg-dhead .mg-t"); const l = h.querySelector("small .mg-dopen"); return !!l && l.textContent.includes(${JSON.stringify(L.open)}) && h.querySelector("small").textContent.trim().length > l.textContent.trim().length && !c.querySelector(".mg-card .mg-row > .mg-t > b") && !c.querySelector(".mg-dfoot")`));
    await p.evaluate(() => { window.__wsCalls = []; });
    await tap(`${dlg} .mg-dopen`);
    check(`[${tag}] "${L.open}" öffnet das Gerät, die Karte bleibt aufgeklappt`, await wait(`return !!r.querySelector("dialog.device")?.open`));
    await ev(`r.host._closeDevice?.()`);
    await ev(`r.host._closeRtAll(); r.host._openRtAll()`);
    await wait(`return !!r.querySelector("${dlg} .mg-dcard")`);

    // Suche: bei mehreren Treffern zu, bei einem offen
    await tap(`${dlg} input[data-lsearch]`);
    await p.keyboard.type("bewäss");
    check(`[${tag}] Suche mit einem Treffer: offen`, await wait(`const c = [...r.querySelectorAll("${dlg} .mg-dcard")]; return c.length === 1 && !c[0].classList.contains("closed")`));
    await ev(`const i = r.querySelector("${dlg} input[data-lsearch]"); i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true }))`);
    check(`[${tag}] Suche geleert: wieder alle zu`, await wait(`const c = [...r.querySelectorAll("${dlg} .mg-dcard")]; return c.length === 3 && c.every((x) => x.classList.contains("closed"))`));
    await ev(`const i = r.querySelector("${dlg} input[data-lsearch]"); i.value = "licht"; i.dispatchEvent(new Event("input", { bubbles: true }))`);
    check(`[${tag}] Suche mit zwei Treffern: beide zu`, await wait(`const c = [...r.querySelectorAll("${dlg} .mg-dcard")]; return c.length === 2 && c.every((x) => x.classList.contains("closed"))`));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
