// Fenster "Alle Timer" (2.22.0, Wunsch des Nutzers): Stoppuhr in der Kopfzeile, Vollbild, alle Timer aller Geräte nach Gerät,
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

    check(`[${tag}] Stoppuhr in der Kopfzeile mit Beschriftung "${T.btn}"`, await ev(`const b = r.querySelector(".toolbar .tmall-btn"); return !!b && b.getAttribute("aria-label") === ${JSON.stringify(T.btn)} && !!b.querySelector("svg")`));
    // Abstand Stoppuhr zum Zahnrad = Abstand Herz zum Kreuz im Geräte-Popup (22 px)
    check(`[${tag}] Stoppuhr genau mittig: links zum Nachbarn = rechts zum Zahnrad (Handy 15 px, Desktop 22 px)`, await ev(`const a = r.querySelector(".toolbar .tmall-btn").getBoundingClientRect(), b = r.querySelector(".toolbar .gear-btn").getBoundingClientRect(), s = [...r.querySelectorAll(".toolbar > *")].slice(0, [...r.querySelectorAll(".toolbar > *")].indexOf(r.querySelector(".toolbar .tmall-btn"))).reverse().find((e) => e.getBoundingClientRect().width > 0).getBoundingClientRect(); const l = Math.round(a.left - s.right), rr = Math.round(b.left - a.right); return l === rr && rr === ${mobile ? 15 : 22}`));
    check(`[${tag}] Abstand Stoppuhr zum Zahnrad (Handy 15 px, Desktop 22 px)`, (await ev(`const a = r.querySelector(".toolbar .tmall-btn").getBoundingClientRect(), b = r.querySelector(".toolbar .gear-btn").getBoundingClientRect(); return Math.round(b.left - a.right)`)) === (mobile ? 15 : 22));
    await tap(".tmall-btn");
    check(`[${tag}] Fenster offen, Titel "${T.title}" · "${T.sub}"`, await wait(`const d = r.querySelector("dialog.tmall-dlg"); return d?.open && d.querySelector("h2").textContent === ${JSON.stringify(T.title)} && d.querySelector(".dlg-sub").textContent === ${JSON.stringify(T.sub)}`));
    check(`[${tag}] ${mobile ? "Vollbild auf dem Handy" : "Popup auf dem Desktop (nicht vollflächig, mittig, mit Rundung und Rand um das Fenster)"}`, await ev(`const el = r.querySelector("dialog.tmall-dlg"), d = el.getBoundingClientRect(); const full = Math.abs(d.width - window.innerWidth) <= 1 && Math.abs(d.height - window.innerHeight) <= 1; const centred = Math.abs((d.left + d.width / 2) - window.innerWidth / 2) <= 2; return ${mobile ? "full" : "!full && d.width <= 862 && d.height <= window.innerHeight - 40 && centred && parseFloat(getComputedStyle(el).borderTopLeftRadius) >= 20"}`));
    if (!mobile) {
      // Gleiche Grösse wie das Einstellungs-Fenster (Wunsch des Nutzers): beide nacheinander öffnen und die Masse vergleichen
      const tm = await ev(`const d = r.querySelector("dialog.tmall-dlg").getBoundingClientRect(); return JSON.stringify([Math.round(d.width), Math.round(d.height)])`);
      await ev(`r.querySelector("dialog.settings").showModal();`);
      const st = await ev(`const d = r.querySelector("dialog.settings").getBoundingClientRect(); return JSON.stringify([Math.round(d.width), Math.round(d.height)])`);
      await ev(`r.querySelector("dialog.settings").close();`);
      check(`[${tag}] Timer-Fenster gleich gross wie Einstellungen`, tm === st, `${tm} gegen ${st}`);
    }
    check(`[${tag}] zwei Geräte, je eine Karte mit Gerätename`, await wait(`return r.querySelectorAll("dialog.tmall-dlg .mg-dcard").length === 2 && [...r.querySelectorAll("dialog.tmall-dlg .mg-dhead b")].map((e) => e.textContent).length === 2`), await ev(`return [...r.querySelectorAll("dialog.tmall-dlg .mg-dhead b")].map((e) => e.textContent).join("|")`));
    await tap('dialog.tmall-dlg [data-tma="timer-fold-all"]');
    check(`[${tag}] ausgeklappt: beide Timer, Gerät klar erkennbar`, await wait(`return r.querySelectorAll("dialog.tmall-dlg .mg-card").length === 2 && r.querySelectorAll("dialog.tmall-dlg .mg-dcard").length === 2`));
    check(`[${tag}] Bearbeiten, Ein/Aus und Löschen: kein Neu, kein Ausführen`, await ev(`const d = r.querySelector("dialog.tmall-dlg"); return !d.querySelector('[data-tm="add"], .mg-add') && !d.querySelector('[data-tma="timer-run"]') && d.querySelectorAll('[data-tma="timer-delete"]').length === 2 && d.querySelectorAll('[data-tma="timer-edit"]').length === 2 && d.querySelectorAll('input[data-tma="timer-toggle"]').length === 2`));
    check(`[${tag}] Aktionen ${mobile ? "mit 44 px Trefferhöhe" : "unverändert"}`, await ev(`const hs = [...r.querySelectorAll("dialog.tmall-dlg .mg-acts .linkbtn, dialog.tmall-dlg .mg-dfoot .linkbtn")].map((e) => e.getBoundingClientRect().height); return hs.length > 0 && hs.every((h) => ${mobile ? "h >= 43.5" : "h < 40"})`));
    await p.screenshot({ path: `${outDir}/timerall-${tag.replace("/", "-")}.png` });

    // Die Reiterleiste bleibt auf derselben Höhe, die Schrift der Einleitung gleich gross, egal was die Liste zeigt (2.26.0)
    const geo = () => ev(`const d = r.querySelector("dialog.tmall-dlg"); return JSON.stringify([Math.round(d.querySelector(".mg-filter").getBoundingClientRect().top), getComputedStyle(d.querySelector(".mg-note")).fontSize, Math.round(d.querySelector(".mg-note").getBoundingClientRect().height)])`);
    const geoAll = await geo();
    await tap('dialog.tmall-dlg [data-tma="timer-filter"][data-v="running"]');
    await wait(`return r.querySelector("dialog.tmall-dlg .mg-none")`);
    const geoNone = await geo();
    check(`[${tag}] Reiterleiste gleich hoch und Einleitung gleich gross, auch bei leerer Liste`, geoAll === geoNone, `${geoAll} / ${geoNone}`);
    check(`[${tag}] text-size-adjust 100 %`, await ev(`const c = getComputedStyle(r.host); return (c.webkitTextSizeAdjust || c.textSizeAdjust) === "100%"`));
    await tap('dialog.tmall-dlg [data-tma="timer-filter"][data-v="all"]');
    await wait(`return r.querySelectorAll("dialog.tmall-dlg .mg-dcard").length > 0`);

    // Wartet ein Timer auf das Zurückschalten, zählt er zu "Läuft" (2.26.0), mit Angabe, wann
    await p.evaluate(() => { window.__timers.list[0].__revert = Date.now() / 1000 + 3 * 3600; });
    await ev(`r.host._loadTmAll()`);
    check(`[${tag}] Zurückschalten steht aus: Reiter "Läuft" zählt 1`, await wait(`return r.querySelector('dialog.tmall-dlg .mg-filter .sub-tab[data-v="running"] .tab-s')?.textContent === "1"`));
    await tap('dialog.tmall-dlg [data-tma="timer-filter"][data-v="running"]');
    check(`[${tag}] Reiter "Läuft": der Timer steht dort, mit "wieder aus: …"`, await wait(`const c = r.querySelectorAll("dialog.tmall-dlg .mg-card"); return c.length === 1 && /(wieder aus|back off|wieder ein|back on)/.test(c[0].querySelector(".mg-status").textContent) && c[0].querySelector(".mg-status").textContent.includes(":")`), await ev(`return r.querySelector("dialog.tmall-dlg .mg-status")?.textContent || ""`));
    await p.evaluate(() => { delete window.__timers.list[0].__revert; });
    await ev(`r.host._loadTmAll()`);
    check(`[${tag}] Zurückgeschaltet: Reiter "Läuft" leer`, await wait(`return r.querySelector('dialog.tmall-dlg .mg-filter .sub-tab[data-v="running"] .tab-s')?.textContent === "0"`));
    await tap('dialog.tmall-dlg [data-tma="timer-filter"][data-v="all"]');
    await wait(`return r.querySelectorAll("dialog.tmall-dlg .mg-card").length === 2`);

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

    // Lieblings-Timer (2.26.0): Herz rechts von "Löschen"; ab dem ersten ein Reiter mit Herz, das Fenster öffnet darauf, alles aufgeklappt
    const tabsText = () => ev(`return [...r.querySelectorAll("dialog.tmall-dlg .mg-filter .sub-tab")].map((e) => e.dataset.v).join(",")`);
    const lastId = await ev(`const h = [...r.querySelectorAll("dialog.tmall-dlg .mg-dcard")].at(-1); return h.querySelector('[data-tma="timer-star"]').dataset.id`);
    check(`[${tag}] Herz: neben "Löschen" (rechts davon), nicht gesetzt; noch kein Reiter mit Herz`, await ev(`const c = r.querySelector('dialog.tmall-dlg .mg-acts'); const [e, d, s] = [...c.querySelectorAll(".linkbtn")].filter((x) => x.dataset.tma !== "timer-restart"); return e.dataset.tma === "timer-edit" && d.dataset.tma === "timer-delete" && s.dataset.tma === "timer-star" && s.classList.contains("fav") && !s.classList.contains("on") && s.getBoundingClientRect().left - d.getBoundingClientRect().right >= 12`) && (await tabsText()) === "all,on,off,running");
    check(`[${tag}] Herz: Fläche ${mobile ? "mindestens 44 px" : "klein"} und Beschriftung`, await ev(`const s = r.querySelector('dialog.tmall-dlg [data-tma="timer-star"]'); return s.getAttribute("aria-label").length > 5 && ${mobile ? "s.getBoundingClientRect().height >= 43.5" : "true"}`));
    await tap(`dialog.tmall-dlg [data-tma="timer-star"][data-id="${lastId}"]`);
    check(`[${tag}] Herz gesetzt: Reiter mit Herz erscheint (Zahl 1), Ansicht bleibt "Alle"`, await wait(`const f = r.querySelector('dialog.tmall-dlg .mg-filter .sub-tab[data-v="fav"]'); return !!f && f.querySelector(".tab-s").textContent === "1" && !!f.querySelector("svg") && f.getAttribute("aria-label").length > 3 && r.querySelector('dialog.tmall-dlg .mg-filter .sub-tab.on').dataset.v === "all" && r.querySelectorAll("dialog.tmall-dlg .mg-card").length === 2`));
    const saved = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "frontend/set_user_data" && m.key === "device_panel_timer_stars"));
    let st = [];
    for (let i = 0; i < 30 && !st.length; i++) { await p.waitForTimeout(200); st = await saved(); }
    check(`[${tag}] Herz gespeichert: Benutzerdaten mit der Timer-ID`, st.length > 0 && JSON.stringify(st.at(-1).value.ids) === JSON.stringify([lastId]), JSON.stringify(st.at(-1)));
    // Fenster neu öffnen: öffnet auf dem Reiter mit Herz, nur der Lieblings-Timer, sein Gerät aufgeklappt
    await tap("dialog.tmall-dlg [data-tma-close]");
    await wait(`return !r.querySelector("dialog.tmall-dlg").open`);
    await tap(".toolbar .tmall-btn");
    check(`[${tag}] erneut geöffnet: Reiter mit Herz gewählt, nur der Lieblings-Timer, Gerät aufgeklappt`, await wait(`const d = r.querySelector("dialog.tmall-dlg"); return d.open && d.querySelector('.mg-filter .sub-tab.on')?.dataset.v === "fav" && d.querySelectorAll(".mg-card").length === 1 && !!d.querySelector(".mg-dcard:not(.closed)") && d.querySelector('[data-tma="timer-star"]').dataset.id === ${JSON.stringify(lastId)}`));
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${outDir}/timerall-fav-${tag.replace("/", "-")}.png` });
    await tap(`dialog.tmall-dlg [data-tma="timer-star"][data-id="${lastId}"]`);
    check(`[${tag}] Herz entfernt (letzter Lieblings-Timer): Reiter weg, zurück auf "Alle" mit beiden Timern`, await wait(`const d = r.querySelector("dialog.tmall-dlg"); return !d.querySelector('.mg-filter .sub-tab[data-v="fav"]') && d.querySelector('.mg-filter .sub-tab.on').dataset.v === "all" && d.querySelectorAll(".mg-dcard").length === 2`));
    // "Alle" ist nach dem Neuöffnen eingeklappt: wieder ausklappen für die folgenden Prüfungen
    await tap('dialog.tmall-dlg [data-tma="timer-fold-all"]');
    await wait(`return r.querySelectorAll("dialog.tmall-dlg .mg-card").length === 2`);


    // Löschen mit Rückfrage (2.24.1): erst Nein, dann Ja
    await tap('dialog.tmall-dlg [data-tma="timer-delete"][data-id="aaaaaaaaaaa2"]');
    check(`[${tag}] Löschen: Rückfrage in der Karte, noch nichts gelöscht`, await wait(`return !!r.querySelector('dialog.tmall-dlg [data-tma="timer-delete-yes"][data-id="aaaaaaaaaaa2"]')`) && (await calls("device_panel/timer_delete")).length === 0);
    await tap('dialog.tmall-dlg [data-tma="timer-delete-no"]');
    check(`[${tag}] Nein: Rückfrage weg, beide Timer da`, await wait(`return !r.querySelector('dialog.tmall-dlg [data-tma="timer-delete-yes"]') && r.querySelectorAll("dialog.tmall-dlg .mg-card").length === 2`));
    await tap('dialog.tmall-dlg [data-tma="timer-delete"][data-id="aaaaaaaaaaa2"]');
    await tap('dialog.tmall-dlg [data-tma="timer-delete-yes"][data-id="aaaaaaaaaaa2"]');
    check(`[${tag}] Ja: timer_delete gesendet, Timer aus der Liste`, await wait(`return r.querySelectorAll("dialog.tmall-dlg .mg-card").length === 1`) && (await calls("device_panel/timer_delete")).at(-1)?.timer_id === "aaaaaaaaaaa2");

    await tap("dialog.tmall-dlg [data-tma-close]");
    check(`[${tag}] Schliessen`, await wait(`return !r.querySelector("dialog.tmall-dlg").open`));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
