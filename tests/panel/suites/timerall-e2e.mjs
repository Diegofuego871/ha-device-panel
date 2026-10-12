// Fenster "Alle Timer" (2.22.0, Wunsch des Nutzers): Glocke in der Kopfzeile, Vollbild, alle Timer aller Geräte nach Gerät,
// bearbeiten sowie ein-/ausschalten, aber nichts Neues anlegen (und weder löschen noch ausführen). Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { btn: "Alle Timer", title: "Timer", sub: "Alle Geräte", edit: "Bearbeiten", hit: "1 von 2", q1: "Was soll geschaltet werden?" },
  en: { btn: "All timers", title: "Timers", sub: "All devices", edit: "Edit", hit: "1 of 2", q1: "What should be switched?" },
};
const SEED = (id, device, name, enabled) => ({ id, device_id: device, entity_id: "switch.plug", name, action: "on", back_s: null, kind: "repeat", delay_s: null, date: null, time: "06:30", repeat: "daily", weekdays: null, mday: null, enabled, push: false, target: null, created: Date.now() / 1000 });

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=${mobile ? "dark" : "light"}`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const calls = (type) => p.evaluate((ty) => window.__wsCalls.filter((m) => m.type === ty), type);
    // zwei Timer an zwei Geräten (einer aus)
    await p.evaluate(([a, c]) => { (window.__timers ||= { list: [], seq: 1, runs: [], tests: [] }).list.push(a, c); }, [SEED("aaaaaaaaaaa1", "d", "Bewässerung", true), SEED("aaaaaaaaaaa2", "a", "Nachtlicht", false)]);

    check(`[${tag}] Glocke in der Kopfzeile mit Beschriftung "${T.btn}"`, await ev(`const b = r.querySelector(".toolbar .tmall-btn"); return !!b && b.getAttribute("aria-label") === ${JSON.stringify(T.btn)} && !!b.querySelector("svg")`));
    await tap(".tmall-btn");
    check(`[${tag}] Fenster offen, Titel "${T.title}" · "${T.sub}"`, await wait(`const d = r.querySelector("dialog.tmall-dlg"); return d?.open && d.querySelector("h2").textContent === ${JSON.stringify(T.title)} && d.querySelector(".dlg-sub").textContent === ${JSON.stringify(T.sub)}`));
    check(`[${tag}] Vollbild (auch auf dem Desktop)`, await ev(`const d = r.querySelector("dialog.tmall-dlg").getBoundingClientRect(); return Math.abs(d.width - window.innerWidth) <= 1 && Math.abs(d.height - window.innerHeight) <= 1`));
    check(`[${tag}] zwei Geräte, je eine Karte mit Gerätename`, await wait(`return r.querySelectorAll("dialog.tmall-dlg .mg-dcard").length === 2 && [...r.querySelectorAll("dialog.tmall-dlg .mg-dhead b")].map((e) => e.textContent).length === 2`), await ev(`return [...r.querySelectorAll("dialog.tmall-dlg .mg-dhead b")].map((e) => e.textContent).join("|")`));
    await tap('dialog.tmall-dlg [data-tma="timer-fold-all"]');
    check(`[${tag}] ausgeklappt: beide Timer, Gerät klar erkennbar`, await wait(`return r.querySelectorAll("dialog.tmall-dlg .mg-card").length === 2 && r.querySelectorAll("dialog.tmall-dlg .mg-dcard").length === 2`));
    check(`[${tag}] nur Bearbeiten und Ein/Aus: kein Neu, kein Löschen, kein Ausführen`, await ev(`const d = r.querySelector("dialog.tmall-dlg"); return !d.querySelector('[data-tm="add"], .mg-add') && !d.querySelector('[data-tma="timer-delete"], [data-tma="timer-run"]') && d.querySelectorAll('[data-tma="timer-edit"]').length === 2 && d.querySelectorAll('input[data-tma="timer-toggle"]').length === 2`));
    await p.screenshot({ path: `${outDir}/timerall-${tag.replace("/", "-")}.png` });

    // Suche und Filter
    await ev(`r.querySelector('dialog.tmall-dlg input[data-lsearch="timers"]').focus()`);
    await p.keyboard.type("nacht");
    check(`[${tag}] Suche "nacht": ${T.hit}`, await wait(`return r.querySelectorAll("dialog.tmall-dlg .mg-card").length === 1 && r.querySelector("dialog.tmall-dlg .list-search .n").textContent.includes("1")`), await ev(`return r.querySelector("dialog.tmall-dlg .list-search .n").textContent`));
    check(`[${tag}] Fokus bleibt im Suchfeld`, await ev(`return r.activeElement?.matches('input[data-lsearch="timers"]')`));
    await tap('dialog.tmall-dlg [data-tma-clear]');
    check(`[${tag}] X leert die Suche`, await wait(`return r.querySelectorAll("dialog.tmall-dlg .mg-dcard").length === 2`));
    await tap('dialog.tmall-dlg [data-tma="timer-filter"][data-v="off"]');
    check(`[${tag}] Filter "Aus": nur der ausgeschaltete`, await wait(`return r.querySelectorAll("dialog.tmall-dlg .mg-card").length === 1 && r.querySelector("dialog.tmall-dlg .mg-card b").textContent === "Nachtlicht"`));
    await tap('dialog.tmall-dlg [data-tma="timer-filter"][data-v="all"]');
    await wait(`return r.querySelectorAll("dialog.tmall-dlg .mg-card").length === 2`);

    // Einschalten
    const before = (await calls("device_panel/timer_enable")).length;
    await ev(`const i = r.querySelector('dialog.tmall-dlg input[data-id="aaaaaaaaaaa2"]'); i.click()`);
    check(`[${tag}] Einschalten: timer_enable gesendet, Karte aktiv`, await wait(`return !r.querySelector('dialog.tmall-dlg input[data-id="aaaaaaaaaaa2"]').closest(".mg-card").classList.contains("off")`) && (await calls("device_panel/timer_enable")).length === before + 1 && (await calls("device_panel/timer_enable")).at(-1).enabled === true);

    // Bearbeiten: Assistent im eigenen Fenster (darüber)
    await tap('dialog.tmall-dlg [data-tma="timer-edit"][data-id="aaaaaaaaaaa1"]');
    check(`[${tag}] Bearbeiten öffnet den Assistenten`, await wait(`return r.querySelector("dialog.timer-dlg")?.open && !!r.querySelector("dialog.timer-dlg .mg-big")`) && !(await ev(`return r.querySelector("dialog.device").open`)));
    await tap('dialog.timer-dlg [data-tm="close"]');
    await wait(`return !r.querySelector("dialog.timer-dlg").open`);
    check(`[${tag}] danach wieder das Fenster mit allen Timern`, await ev(`return r.querySelector("dialog.tmall-dlg").open && r.querySelectorAll("dialog.tmall-dlg .mg-dcard").length === 2`));

    await tap("dialog.tmall-dlg [data-tma-close]");
    check(`[${tag}] Schliessen`, await wait(`return !r.querySelector("dialog.tmall-dlg").open`));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
