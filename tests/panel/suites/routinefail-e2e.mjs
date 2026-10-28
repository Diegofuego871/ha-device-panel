// Fehlgeschlagene Routine (2.172.0): Sternschnuppe am Launcher-Knopf (oder dem angehefteten Knopf), die App "Routinen" wackelt und trägt den Chip
// "Fehler"; im Routinen-Fenster kreist sie um den Protokoll-Knopf, im Geräte-Popup um den des betroffenen Geräts. Das Protokoll öffnet mit dem
// Filter "Fehlgeschlagen"; das Öffnen quittiert (Server vermerkt es, 24 Stunden hält der Server die Meldung ohnehin). Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = { de: { chip: "Fehler" }, en: { chip: "Error" } };

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
    const load = async (query) => {
      await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark${query}`);
      const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
      await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
      return f;
    };
    let f = await load("");
    let ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    let handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    let tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    let wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const calls = (type) => p.evaluate((ty) => window.__wsCalls.filter((m) => m.type === ty), type);
    const rebind = () => {
      ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
      handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
      tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
      wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    };

    // Ohne Fehlschlag: nichts
    const PIN = '.app-pins [data-app-pin="routine"]';
    check(`[${tag}] ohne Fehlschlag: kein Punkt an der Kopfzeile`, await ev(`return !r.querySelector(".apps-btn").classList.contains("has-dot") && !r.querySelector(${JSON.stringify(PIN)})?.classList.contains("has-dot")`));

    // Mit Fehlschlag am Gerät "d"
    f = await load("&rtfail=1");
    rebind();
    // Die Routinen sind standardmässig in der Kopfzeile angeheftet: der Punkt sitzt am eigenen Knopf (sonst am Launcher-Knopf)
    check(`[${tag}] angeheftete Routinen: roter Punkt, Symbol wackelt`, await wait(`const b = r.querySelector(${JSON.stringify(PIN)}) || r.querySelector(".apps-btn"); return b.classList.contains("has-dot") && b.classList.contains("dot-bad") && (b.classList.contains("rtf") || b.classList.contains("apps-btn"))`));
    await tap(".apps-btn");
    await wait(`return !!r.querySelector('dialog.apps-dlg [data-id="routine"]')`);
    check(`[${tag}] Launcher: App "Routinen" mit Chip "${L.chip}"`, await ev(`const t = r.querySelector('dialog.apps-dlg .ap-tile:has([data-id="routine"])'); return !!t?.querySelector(".ap-badge.bad") && t.querySelector(".ap-badge.bad").textContent.trim() === ${JSON.stringify(L.chip)}`));
    check(`[${tag}] Launcher: Symbol der Routinen wackelt`, await ev(`const s = r.querySelector('dialog.apps-dlg .ap-tile:has([data-id="routine"]) .ap-ico.rtf svg'); return !!s && getComputedStyle(s).animationName === "wz-rocket"`));
    await ev(`r.querySelector("dialog.apps-dlg").close()`);

    // Routinen-Fenster: Sternschnuppe am Protokoll-Knopf, Protokoll mit Filter "Fehlgeschlagen", Öffnen quittiert
    await ev(`r.host._openRtAll()`);
    await wait(`return !!r.querySelector('dialog.rtall-dlg .dlg-act[data-proto="routine"]')`);
    check(`[${tag}] Routinen-Fenster: Protokoll-Knopf mit Punkt`, await ev(`const x = r.querySelector('dialog.rtall-dlg .dlg-act[data-proto="routine"]'); return x.classList.contains("has-dot") && getComputedStyle(x, "::before").animationName === "dp-comet"`));
    await p.evaluate(() => { window.__wsCalls = []; });
    await tap('dialog.rtall-dlg .dlg-act[data-proto="routine"]');
    check(`[${tag}] Protokoll öffnet auf "Routinen" mit gewähltem Filter "Fehlgeschlagen"`, await wait(`const d = r.querySelector("dialog.proto-dlg"); const c = d?.querySelector('[data-pr="filter"][data-v="failed"]'); return !!d?.open && !!c && c.classList.contains("on")`));
    const ack = await calls("device_panel/routine_ack");
    check(`[${tag}] routine_ack für alle Geräte gesendet`, ack.length === 1 && !("device_id" in ack[0]), JSON.stringify(ack));
    await ev(`r.querySelector("dialog.proto-dlg").close()`);
    check(`[${tag}] danach: Punkt am Protokoll-Knopf und am Launcher weg`, await wait(`return !r.querySelector('dialog.rtall-dlg .dlg-act[data-proto="routine"]').classList.contains("has-dot") && !r.querySelector(${JSON.stringify(PIN)})?.classList.contains("has-dot")`));
    await ev(`r.host._closeRtAll()`);

    // Geräte-Popup: Sternschnuppe am Protokoll-Knopf des betroffenen Geräts, nicht an anderen
    f = await load("&rtfail=1");
    rebind();
    await ev(`r.host._openDevice("a")`);
    await wait(`return !!r.querySelector("dialog.device .dlg-head-log")`);
    check(`[${tag}] anderes Gerät: kein Punkt am Protokoll-Knopf`, await ev(`return !r.querySelector("dialog.device .dlg-head-log").classList.contains("has-dot")`));
    await ev(`r.host._closeDevice?.()`);
    await ev(`r.host._openDevice("d")`);
    await wait(`return !!r.querySelector("dialog.device .dlg-head-log")`);
    check(`[${tag}] betroffenes Gerät: Protokoll-Knopf mit Punkt`, await ev(`const x = r.querySelector("dialog.device .dlg-head-log"); return x.classList.contains("has-dot") && getComputedStyle(x, "::before").animationName === "dp-comet"`));
    await p.evaluate(() => { window.__wsCalls = []; });
    await tap("dialog.device .dlg-head-log");
    check(`[${tag}] Geräte-Protokoll öffnet auf "Routinen" mit Filter "Fehlgeschlagen"`, await wait(`const d = r.querySelector("dialog.proto-dlg"); const c = d?.querySelector('[data-pr="filter"][data-v="failed"]'); return !!d?.open && !!c && c.classList.contains("on")`));
    const ack2 = await calls("device_panel/routine_ack");
    check(`[${tag}] routine_ack für das Gerät gesendet`, ack2.length === 1 && ack2[0].device_id === "d", JSON.stringify(ack2));
    await ev(`r.querySelector("dialog.proto-dlg").close()`);
    check(`[${tag}] danach: kein Punkt mehr am Gerät und am Launcher`, await wait(`return !r.querySelector("dialog.device .dlg-head-log").classList.contains("has-dot") && !r.querySelector(${JSON.stringify(PIN)})?.classList.contains("has-dot")`));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
