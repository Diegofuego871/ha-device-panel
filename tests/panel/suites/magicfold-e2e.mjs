// Fenster "Magic Push" (alle Meldungen), zugeklappte Karten (2.173.0, gleiches Prinzip wie bei den Routinen, docs/mockups/routine-fav-v2, C): bei mehr als einem sichtbaren Gerät sind alle zu, auch bei einer Suche;
// bei genau einem offen. Zugeklappt sitzt bei einer Routine der Schalter im Kopf (statt der Zahl), bei mehreren folgt je Routine eine Zeile mit Schalter.
// "Gerät öffnen" steht aufgeklappt in der Zeile unter dem Namen, die Fusszeile entfällt. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = { de: { open: "Gerät öffnen" }, en: { open: "Open device" } };
const RULE = (id, device, name, enabled) => ({ id, device_id: device, entity_id: "sensor.temp", name, kind: "below", value: 12, for_s: 600, message: "Meldung {value}", body: "", recover: false, recover_message: "", recover_body: "", repeat_s: 0, target: null, enabled, critical: false, critical_volume: 10, reset_value: null });

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
    await p.evaluate((rules) => { window.__magic = { rules, tests: [], seq: 10 }; }, [RULE("r00000000001", "d", "Keller kalt", true), RULE("r00000000002", "a", "Feuchte hoch", true), RULE("r00000000003", "a", "Fenster offen", false)]);
    await ev(`r.host._openMagicAll()`);
    const dlg = "dialog.mgall-dlg";
    await wait(`return !!r.querySelector("${dlg} .mg-dcard")`);
    const cards = () => ev(`return [...r.querySelectorAll("${dlg} .mg-dcard")].map((c) => ({ closed: c.classList.contains("closed"), sw: !!c.querySelector(".mg-dsw input"), badge: !!c.querySelector(".mg-badge"), lines: c.querySelectorAll(".mg-rline").length, cards: c.querySelectorAll(".mg-card").length }))`);

    // Zwei Geräte: beide zu. Gerät mit einer Routine: Schalter im Kopf, keine Zahl. Gerät mit zwei: Zeilen mit Schalter, keine Karten
    const c0 = await cards();
    check(`[${tag}] zwei Geräte: beide zugeklappt`, c0.length === 2 && c0.every((c) => c.closed && c.cards === 0), JSON.stringify(c0));
    const one = c0.find((c) => c.lines === 0), many = c0.find((c) => c.lines > 0);
    check(`[${tag}] eine Routine: Schalter im Kopf, keine Zahl`, !!one && one.sw && !one.badge, JSON.stringify(one));
    check(`[${tag}] zwei Routinen: eine Zeile je Routine mit Schalter, kein Schalter im Kopf`, !!many && many.lines === 2 && !many.sw && !many.badge && (await ev(`return [...r.querySelectorAll("${dlg} .mg-rline")].every((l) => !!l.querySelector("input[data-mga='magic-toggle']"))`)), JSON.stringify(many));
    check(`[${tag}] Schalter im Kopf liegt neben dem Pfeil, nicht über dem Namen`, await ev(`const w = r.querySelector("${dlg} .mg-dwrap"); const s = w.querySelector(".mg-dsw").getBoundingClientRect(); const c = w.querySelector(".mg-lchev").getBoundingClientRect(); const n = w.querySelector(".mg-t b").getBoundingClientRect(); const h = w.getBoundingClientRect(); return s.right <= c.left + 2 && s.left >= n.left && Math.abs((s.top + s.bottom) / 2 - (h.top + h.bottom) / 2) < 3`));

    // Schalten ohne Aufklappen
    const before = (await calls("device_panel/magic_enable")).length;
    await tap(`${dlg} .mg-dsw input`);
    check(`[${tag}] Schalter im Kopf: magic_enable gesendet, Karte bleibt zu`, await wait(`return !r.querySelector("${dlg} .mg-dsw input").checked`) && (await calls("device_panel/magic_enable")).length === before + 1 && (await cards()).every((c) => c.closed));
    await tap(`${dlg} .mg-dsw input`);
    await wait(`return r.querySelector("${dlg} .mg-dsw input").checked`);
    const before2 = (await calls("device_panel/magic_enable")).length;
    const was = await ev(`return r.querySelector("${dlg} .mg-rline input").checked`);
    await tap(`${dlg} .mg-rline input`);
    check(`[${tag}] Schalter in der Zeile: magic_enable gesendet, Karte bleibt zu`, (await wait(`return r.querySelector("${dlg} .mg-rline input").checked === ${!was}`)) && (await calls("device_panel/magic_enable")).length === before2 + 1 && (await cards()).every((c) => c.closed));

    // Aufklappen: Karte wie bisher, "Gerät öffnen" in der Zeile unter dem Namen, keine Fusszeile
    await tap(`${dlg} .mg-dcard:has(.mg-dsw) .mg-dhead`);
    check(`[${tag}] aufgeklappt: Karte mit Aktionen, Zahl im Kopf, Schalter im Kopf weg`, await wait(`const c = r.querySelector("${dlg} .mg-dcard:not(.closed)"); return !!c && !!c.querySelector(".mg-card .mg-acts") && !!c.querySelector(".mg-badge") && !c.querySelector(".mg-dsw")`));
    check(`[${tag}] aufgeklappt: "${L.open} ›" unter dem Namen, keine Fusszeile`, await ev(`const c = r.querySelector("${dlg} .mg-dcard:not(.closed)"); const l = c.querySelector(".mg-dhead .mg-t small .mg-dopen"); return !!l && l.textContent.includes(${JSON.stringify(L.open)}) && !c.querySelector(".mg-dfoot")`));
    await p.evaluate(() => { window.__wsCalls = []; });
    await tap(`${dlg} .mg-dopen`);
    check(`[${tag}] "${L.open}" öffnet das Gerät im Reiter Magic Push`, await wait(`return !!r.querySelector("dialog.device")?.open && !!r.querySelector('.sub-tab[data-tab="magic"].on')`));
    await ev(`r.host._closeDevice?.()`);
    await ev(`r.host._closeMagicAll(); r.host._openMagicAll()`);
    await wait(`return !!r.querySelector("${dlg} .mg-dcard")`);

    // Suche: bei zwei Treffer-Geräten zu, bei einem offen
    await tap(`${dlg} input[data-lsearch]`);
    await p.keyboard.type("kalt");
    check(`[${tag}] Suche mit Treffern an einem Gerät: offen`, await wait(`const c = [...r.querySelectorAll("${dlg} .mg-dcard")]; return c.length === 1 && !c[0].classList.contains("closed")`));
    await ev(`const i = r.querySelector("${dlg} input[data-lsearch]"); i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true }))`);
    await p.keyboard.type("");
    check(`[${tag}] Suche geleert: wieder beide zu`, await wait(`const c = [...r.querySelectorAll("${dlg} .mg-dcard")]; return c.length === 2 && c.every((x) => x.classList.contains("closed"))`));
    await ev(`const i = r.querySelector("${dlg} input[data-lsearch]"); i.value = "e"; i.dispatchEvent(new Event("input", { bubbles: true }))`);
    check(`[${tag}] Suche mit Treffern an zwei Geräten: beide zu`, await wait(`const c = [...r.querySelectorAll("${dlg} .mg-dcard")]; return c.length === 2 && c.every((x) => x.classList.contains("closed"))`));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
