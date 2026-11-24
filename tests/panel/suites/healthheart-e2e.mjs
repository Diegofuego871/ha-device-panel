// Herz in der Ecke der Kachel "Verfügbarkeit" (2.245.0): nur mit mindestens einem HealthCheck-Dienst; grün, wenn alle Dienste in Ordnung sind, sonst rot und
// pulsierend (mit "Animationen aus" ohne Puls). Tipp: ein Dienst in Ordnung oder genau ein Dienst mit Fehler öffnet sein Protokoll, sonst die Übersicht der
// Dienste (mehrere in Ordnung, mehrere mit Fehler). Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const svc = (id, name, fail = false) => ({ id, name, url: `https://hc-ping.com/00000000-1111-2222-3333-4444444444${id.length}${id}`, interval: 300, cases: [], fail_suffix: "", status: { at: new Date().toISOString(), sent: "ok", result: fail ? "http" : "ok", code: fail ? 503 : 200, test: false }, log: { state: fail ? "fail" : "ok", since: new Date(Date.now() - 3600000).toISOString() } });

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=${mobile ? "dark" : "light"}`);
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
    const setSvc = async (items) => { await p.evaluate((i) => { window.__hc = i; window.__hcPing = []; window.__hcLog = {}; }, items); await ev(`return r.host._fetch().then(() => true)`); await ev(`r.host._hc.loaded = false; return true`); };
    const closeAll = async () => { await ev(`for (const d of r.querySelectorAll("dialog[open]")) d.close(); return true`); };
    const heart = `.hero .kt.ring .hc-heart`;

    // Ohne Dienst: kein Herz
    await setSvc([]);
    check(`[${tag}] Ohne HealthCheck-Dienst: kein Herz`, await wait(`return !!r.querySelector(".hero .kt.ring") && !r.querySelector(".hc-heart")`));

    // Ein Dienst in Ordnung: grünes Herz in der Ecke der Kachel, Tipp öffnet das Protokoll des Dienstes
    await setSvc([svc("a", "Haus")]);
    check(`[${tag}] Ein Dienst in Ordnung: grünes Herz`, await wait(`const h = r.querySelector("${heart}"); return !!h && h.classList.contains("ok") && !h.classList.contains("bad") && !!h.querySelector("svg") && getComputedStyle(h).animationName === "none"`));
    check(`[${tag}] Herz sitzt oben rechts in der Kachel "Verfügbarkeit", ohne die Beschriftung zu überdecken`, await ev(`const h = r.querySelector("${heart}").getBoundingClientRect(), t = r.querySelector(".hero .kt.ring").getBoundingClientRect(), kel = r.querySelector(".hero .kt.ring .k"), rg = document.createRange(); rg.selectNodeContents(kel); const k = rg.getBoundingClientRect(); return h.right <= t.right - 4 && t.right - h.right <= 16 && h.top >= t.top + 4 && h.top - t.top <= 16 && (h.left >= k.right + 2 || h.bottom <= k.top + 1 || h.top >= k.bottom - 1)`));
    await p.screenshot({ path: `${outDir}/healthheart-ok-${tag.replace("/", "-")}.png` });
    await tap(heart);
    check(`[${tag}] Ein Dienst, alles in Ordnung: das Protokoll von "Haus" öffnet direkt`, await wait(`return r.querySelector("dialog.hl-dlg")?.open && r.querySelector("dialog.hl-dlg .hl-pick")?.textContent.trim() === "Haus"`));
    await closeAll();

    // Zwei Dienste in Ordnung: Übersicht der Dienste
    await setSvc([svc("a", "Haus"), svc("bb", "Zweiter")]);
    await wait(`return !!r.querySelector("${heart}")`);
    await tap(heart);
    check(`[${tag}] Mehrere Dienste in Ordnung: die Übersicht der Dienste öffnet`, await wait(`return r.querySelector("dialog.hc-dlg")?.open && !r.querySelector("dialog.hl-dlg")?.open && r.querySelectorAll("dialog.hc-dlg .hc-row").length === 2`));
    await closeAll();

    // Ein Dienst mit Fehler (von zwei): rotes, pulsierendes Herz, Tipp öffnet das Protokoll des Dienstes mit Fehler
    await setSvc([svc("a", "Haus"), svc("bb", "Zweiter", true)]);
    check(`[${tag}] Ein Dienst mit Fehler: rotes Herz, pulsiert`, await wait(`const h = r.querySelector("${heart}"); return !!h && h.classList.contains("bad") && getComputedStyle(h).animationName === "hc-heart-pulse"`));
    await p.screenshot({ path: `${outDir}/healthheart-bad-${tag.replace("/", "-")}.png` });
    check(`[${tag}] Mit "Animationen aus" pulsiert es nicht`, await ev(`r.host.setAttribute("data-anim", "off"); const a = getComputedStyle(r.querySelector("${heart}")).animationName; r.host.removeAttribute("data-anim"); return a === "none"`));
    await ev(`r.querySelector("${heart}").click(); return true`); // das pulsierende Herz ist nie "ruhig": Playwright würde auf Stabilität warten
    check(`[${tag}] Genau ein Dienst mit Fehler: sein Protokoll öffnet ("Zweiter")`, await wait(`return r.querySelector("dialog.hl-dlg")?.open && r.querySelector("dialog.hl-dlg .hl-pick")?.textContent.trim() === "Zweiter" || (r.querySelector("dialog.hl-dlg")?.open && r.querySelector("dialog.hl-dlg .hl-pick b")?.textContent.trim() === "Zweiter")`));
    await closeAll();

    // Mehrere Dienste mit Fehler gleichzeitig: Übersicht
    await setSvc([svc("a", "Haus", true), svc("bb", "Zweiter", true)]);
    await wait(`return r.querySelector("${heart}")?.classList.contains("bad")`);
    await ev(`r.querySelector("${heart}").click(); return true`);
    check(`[${tag}] Mehrere Dienste mit Fehler: die Übersicht der Dienste öffnet`, await wait(`return r.querySelector("dialog.hc-dlg")?.open && !r.querySelector("dialog.hl-dlg")?.open`));
    await closeAll();
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
