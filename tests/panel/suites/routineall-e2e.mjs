// Fenster "Alle Routinen" (2.22.0, Wunsch des Nutzers): Blitz in der Kopfzeile, Vollbild, alle Routinen aller Geräte nach Gerät,
// bearbeiten, ein-/ausschalten, löschen und (seit 2.74.0) ausführen. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { pause: "Alle Routinen pausieren", note: "Pausiert: Es schaltet nichts", short: "Nichts schaltet, bis du wieder einschaltest", btn: "Routinen", title: "Routinen", sub: "Alle Geräte", edit: "Bearbeiten", hit: "1 von 2", q1: "Was soll geschaltet werden?", run: "Ausführen", done: "Ausgeführt.", fail: "Konnte nicht schalten" },
  en: { pause: "Pause all routines", note: "Paused: nothing switches", short: "Nothing switches until you turn it on again", btn: "Routines", title: "Routines", sub: "All devices", edit: "Edit", hit: "1 of 2", q1: "What should be switched?", run: "Run", done: "Done.", fail: "Could not switch" },
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
    // zwei Routine an zwei Geräten (einer aus)
    await p.evaluate(([a, c]) => { (window.__routines ||= { list: [], seq: 1, runs: [], tests: [] }).list.push(a, c); }, [SEED("aaaaaaaaaaa1", "d", "Bewässerung", true), SEED("aaaaaaaaaaa2", "a", "Nachtlicht", false)]);

    check(`[${tag}] Blitz (Favorit Routine) in der Kopfzeile mit Beschriftung "${T.btn}"`, await ev(`const b = r.querySelector(".toolbar .rtall-btn"); return !!b && b.getAttribute("aria-label") === ${JSON.stringify(T.btn)} && !!b.querySelector("svg")`));
    // Seit 2.31.0 sitzen Favoriten und Launcher-Knopf zwischen Suchfeld und Zahnrad: links und rechts derselbe Abstand
    check(`[${tag}] Knöpfe genau mittig: Suchfeld bis Blitz = Launcher-Knopf bis Zahnrad`, await ev(`const q = (s) => r.querySelector(s).getBoundingClientRect(); const all = [...r.querySelectorAll(".toolbar > *, .toolbar .searchbox, .toolbar .app-pins > *")], first = r.querySelector(".toolbar .rtall-btn"), prev = all.slice(0, all.indexOf(first)).reverse().find((e) => e.getBoundingClientRect().width > 0).getBoundingClientRect(); const l = Math.round(q(".toolbar .rtall-btn").left - prev.right), rr = Math.round(q(".toolbar .gear-btn").left - q(".toolbar .apps-btn").right); return l === rr && l >= 6`));
    await tap(".rtall-btn");
    check(`[${tag}] Fenster offen, Titel "${T.title}" · "${T.sub}"`, await wait(`const d = r.querySelector("dialog.rtall-dlg"); return d?.open && d.querySelector("h2").textContent === ${JSON.stringify(T.title)} && d.querySelector(".dlg-sub").textContent === ${JSON.stringify(T.sub)}`));
    // "Alle Routinen pausieren" ganz oben (2.79.0): Spiegel der Einstellung, gilt sofort ohne "Speichern"
    const body = "dialog.rtall-dlg [data-rta-body]";
    const pauseSw = `${body} input[data-rta="routines-pause"]`;
    check(`[${tag}] Pause: "${T.pause}" ganz oben (vor dem Hinweis), aus, mit dem Satz "${T.short}"`, await wait(`const b = r.querySelector("${body}"); const first = b.firstElementChild; return !!first && first.classList.contains("rt-pause") && first.querySelector(".opt-label").textContent.trim() === ${JSON.stringify(T.pause)} && !first.querySelector("input").checked && first.textContent.includes(${JSON.stringify(T.short)}) && !!(first.compareDocumentPosition(b.querySelector(".mg-note")) & Node.DOCUMENT_POSITION_FOLLOWING)`));
    await p.screenshot({ path: `${outDir}/routineall-pause-off-${tag.replace("/", "-")}.png` });
    await p.evaluate(() => { window.__wsCalls = []; });
    await tap(pauseSw);
    check(`[${tag}] Pause einschalten: sofort set_options routines_pause true, Schalter an, Warnung "${T.note}"`, await wait(`const f = r.querySelector("${body} .rt-pause"); return f.querySelector("input").checked && f.classList.contains("on") && !!f.querySelector(".opt-warn") && f.textContent.includes(${JSON.stringify(T.note)})`) && JSON.stringify((await calls("device_panel/set_options")).at(-1)?.values) === '{"routines_pause":true}' && await p.evaluate(() => window.__opts.routines_pause === true));
    await p.screenshot({ path: `${outDir}/routineall-pause-${tag.replace("/", "-")}.png` });
    // Das Fenster neu öffnen: der Stand bleibt (kommt aus dem Server)
    await ev(`r.host._closeRtAll(); r.host._openRtAll()`);
    check(`[${tag}] Pause: nach Neuöffnen noch an`, await wait(`const f = r.querySelector("${body} .rt-pause"); return !!f && f.querySelector("input").checked`));
    await tap(pauseSw);
    check(`[${tag}] Pause ausschalten: set_options routines_pause false, Warnung weg`, await wait(`const f = r.querySelector("${body} .rt-pause"); return !f.querySelector("input").checked && !f.querySelector(".opt-warn")`) && JSON.stringify((await calls("device_panel/set_options")).at(-1)?.values) === '{"routines_pause":false}');
    // Speichern schlägt fehl: Fehler im Fenster, der Schalter bleibt aus
    await p.evaluate(() => { window.__setOptsFails = "Verbindung weg"; });
    await tap(pauseSw);
    check(`[${tag}] Pause: Speichern fehlgeschlagen, Fehlermeldung, Schalter bleibt aus`, await wait(`const b = r.querySelector("${body}"); return (b.querySelector(".dlg-error")?.textContent || "").includes("Verbindung weg") && !b.querySelector(".rt-pause input").checked`));
    await p.evaluate(() => { window.__setOptsFails = null; });
    check(`[${tag}] ${mobile ? "Vollbild auf dem Handy" : "Popup auf dem Desktop (nicht vollflächig, mittig, mit Rundung und Rand um das Fenster)"}`, await ev(`const el = r.querySelector("dialog.rtall-dlg"), d = el.getBoundingClientRect(); const full = Math.abs(d.width - window.innerWidth) <= 1 && Math.abs(d.height - window.innerHeight) <= 1; const centred = Math.abs((d.left + d.width / 2) - window.innerWidth / 2) <= 2; return ${mobile ? "full" : "!full && d.width <= 882 && d.height <= window.innerHeight - 40 && centred && parseFloat(getComputedStyle(el).borderTopLeftRadius) >= 20"}`));
    if (!mobile) {
      // Gleiche Grösse wie Einstellungen, Geräte-Popup und Protokoll (Wunsch des Nutzers): nacheinander öffnen und die Masse vergleichen
      const size = (sel) => ev(`const d = r.querySelector("${sel}").getBoundingClientRect(); return JSON.stringify([Math.round(d.width), Math.round(d.height)])`);
      const rt = await size("dialog.rtall-dlg");
      const others = {};
      for (const sel of ["dialog.settings", "dialog.device", "dialog.log-dlg"]) {
        await ev(`r.querySelector("${sel}").showModal();`);
        others[sel] = await size(sel);
        await ev(`r.querySelector("${sel}").close();`);
      }
      check(`[${tag}] Routinen-Fenster gleich gross wie Einstellungen, Geräte-Popup und Protokoll`, Object.values(others).every((v) => v === rt), `${rt} gegen ${JSON.stringify(others)}`);
      check(`[${tag}] grosse Fenster: höher als 780 px, wenn der Bildschirm es zulässt`, await ev(`const d = r.querySelector("dialog.rtall-dlg").getBoundingClientRect(); return d.height > 780 || window.innerHeight - 48 <= 780`));
    }
    check(`[${tag}] zwei Geräte, je eine Karte mit Gerätename`, await wait(`return r.querySelectorAll("dialog.rtall-dlg .mg-dcard").length === 2 && [...r.querySelectorAll("dialog.rtall-dlg .mg-dhead b")].map((e) => e.textContent).length === 2`), await ev(`return [...r.querySelectorAll("dialog.rtall-dlg .mg-dhead b")].map((e) => e.textContent).join("|")`));
    await tap('dialog.rtall-dlg [data-rta="routine-fold-all"]');
    check(`[${tag}] ausgeklappt: beide Routinen, Gerät klar erkennbar`, await wait(`return r.querySelectorAll("dialog.rtall-dlg .mg-card").length === 2 && r.querySelectorAll("dialog.rtall-dlg .mg-dcard").length === 2`));
    check(`[${tag}] Bearbeiten, Ausführen, Ein/Aus und Löschen, kein Neu in der Liste`, await ev(`const d = r.querySelector("dialog.rtall-dlg"); return !d.querySelector('[data-rt="add"], .mg-add') && d.querySelectorAll('[data-rta="routine-run"]').length === 2 && [...d.querySelectorAll('[data-rta="routine-run"]')].every((b) => b.textContent.trim() === ${JSON.stringify(T.run)}) && d.querySelectorAll('[data-rta="routine-delete"]').length === 2 && d.querySelectorAll('[data-rta="routine-edit"]').length === 2 && d.querySelectorAll('input[data-rta="routine-toggle"]').length === 2`));
    check(`[${tag}] Aktionen ${mobile ? "mit 44 px Trefferhöhe" : "unverändert"}`, await ev(`const hs = [...r.querySelectorAll("dialog.rtall-dlg .mg-acts .linkbtn, dialog.rtall-dlg .mg-dfoot .linkbtn")].map((e) => e.getBoundingClientRect().height); return hs.length > 0 && hs.every((h) => ${mobile ? "h >= 43.5" : "h < 40"})`));
    await p.screenshot({ path: `${outDir}/routineall-${tag.replace("/", "-")}.png` });

    // Ausführen (seit 2.74.0): sofort, ohne Rückfrage; das Ergebnis steht in der Karte der Routine, die anderen bleiben ohne
    await p.evaluate(() => { window.__wsCalls = []; window.__routines.runs = []; });
    await tap('dialog.rtall-dlg [data-rta="routine-run"][data-id="aaaaaaaaaaa2"]');
    check(`[${tag}] "${T.run}": routine_run mit der Routine (auch wenn sie aus ist), "${T.done}" in ihrer Karte`, await wait(`const n = r.querySelector('dialog.rtall-dlg [data-rta="routine-run"][data-id="aaaaaaaaaaa2"]').closest(".mg-card").querySelector("[data-rt-ran]"); return n?.textContent.trim() === ${JSON.stringify(T.done)} && n.classList.contains("mg-flash") && r.querySelectorAll("dialog.rtall-dlg [data-rt-ran]").length === 1`) && JSON.stringify(await p.evaluate(() => window.__routines.runs)) === '["aaaaaaaaaaa2"]' && (await calls("device_panel/routine_run")).length === 1);
    check(`[${tag}] Rückmeldung bündig mit den Aktionen, Karte bleibt im Fenster sichtbar`, await ev(`const n = r.querySelector("dialog.rtall-dlg [data-rt-ran]"); const a = n.closest(".mg-card").querySelector(".mg-acts .linkbtn"); return Math.abs(n.getBoundingClientRect().left - a.getBoundingClientRect().left) <= 2`));
    await p.screenshot({ path: `${outDir}/routineall-${tag.replace("/", "-")}-run.png` });
    // Fehler (Gerät nicht erreichbar): rote Meldung in der Karte
    await p.evaluate(() => { window.__routineRunFails = true; });
    await tap('dialog.rtall-dlg [data-rta="routine-run"][data-id="aaaaaaaaaaa1"]');
    check(`[${tag}] Ausführen schlägt fehl: "${T.fail} …" rot in der Karte dieser Routine, die alte Meldung ist weg`, await wait(`const n = r.querySelector('dialog.rtall-dlg [data-rta="routine-run"][data-id="aaaaaaaaaaa1"]').closest(".mg-card").querySelector("[data-rt-ran]"); return !!n && n.classList.contains("dlg-error") && n.textContent.includes(${JSON.stringify(T.fail)}) && r.querySelectorAll("dialog.rtall-dlg [data-rt-ran]").length === 1`));
    await p.evaluate(() => { window.__routineRunFails = false; });
    // Eine andere Aktion (Reiter "Alle") räumt die Meldung weg
    await tap('dialog.rtall-dlg [data-rta="routine-filter"][data-v="all"]');
    check(`[${tag}] nächste Aktion: Meldung weg`, await wait(`return !r.querySelector("dialog.rtall-dlg [data-rt-ran]")`));
    await ev(`r.querySelector("dialog.rtall-dlg .dlg-body").scrollTop = 0`);

    // Die Reiterleiste bleibt auf derselben Höhe, die Schrift der Einleitung gleich gross, egal was die Liste zeigt (2.26.0)
    const geo = () => ev(`const d = r.querySelector("dialog.rtall-dlg"); return JSON.stringify([Math.round(d.querySelector(".mg-filter").getBoundingClientRect().top), getComputedStyle(d.querySelector(".mg-note")).fontSize, Math.round(d.querySelector(".mg-note").getBoundingClientRect().height)])`);
    const geoAll = await geo();
    await tap('dialog.rtall-dlg [data-rta="routine-filter"][data-v="running"]');
    await wait(`return r.querySelector("dialog.rtall-dlg .mg-none")`);
    const geoNone = await geo();
    check(`[${tag}] Reiterleiste gleich hoch und Einleitung gleich gross, auch bei leerer Liste`, geoAll === geoNone, `${geoAll} / ${geoNone}`);
    check(`[${tag}] text-size-adjust 100 %`, await ev(`const c = getComputedStyle(r.host); return (c.webkitTextSizeAdjust || c.textSizeAdjust) === "100%"`));
    await tap('dialog.rtall-dlg [data-rta="routine-filter"][data-v="all"]');
    await wait(`return r.querySelectorAll("dialog.rtall-dlg .mg-dcard").length > 0`);

    // Wartet eine Routine auf das Zurückschalten, zählt er zu "Läuft" (2.26.0), mit Angabe, wann
    await p.evaluate(() => { window.__routines.list[0].__revert = Date.now() / 1000 + 3 * 3600; });
    await ev(`r.host._loadRtAll()`);
    check(`[${tag}] Zurückschalten steht aus: Reiter "Läuft" zählt 1`, await wait(`return r.querySelector('dialog.rtall-dlg .mg-filter .sub-tab[data-v="running"] .tab-s')?.textContent === "1"`));
    await tap('dialog.rtall-dlg [data-rta="routine-filter"][data-v="running"]');
    check(`[${tag}] Reiter "Läuft": die Routine steht dort, mit "wieder aus: …"`, await wait(`const c = r.querySelectorAll("dialog.rtall-dlg .mg-card"); return c.length === 1 && /(wieder aus|back off|wieder ein|back on)/.test(c[0].querySelector(".mg-status").textContent) && c[0].querySelector(".mg-status").textContent.includes(":")`), await ev(`return r.querySelector("dialog.rtall-dlg .mg-status")?.textContent || ""`));
    await p.evaluate(() => { delete window.__routines.list[0].__revert; });
    await ev(`r.host._loadRtAll()`);
    check(`[${tag}] Zurückgeschaltet: Reiter "Läuft" leer`, await wait(`return r.querySelector('dialog.rtall-dlg .mg-filter .sub-tab[data-v="running"] .tab-s')?.textContent === "0"`));
    await tap('dialog.rtall-dlg [data-rta="routine-filter"][data-v="all"]');
    await wait(`return r.querySelectorAll("dialog.rtall-dlg .mg-card").length === 2`);

    // Suche und Filter
    await ev(`r.querySelector('dialog.rtall-dlg input[data-lsearch="routines"]').focus()`);
    await p.keyboard.type("nacht");
    check(`[${tag}] Suche "nacht": ${T.hit}`, await wait(`return r.querySelectorAll("dialog.rtall-dlg .mg-card").length === 1 && r.querySelector("dialog.rtall-dlg .list-search .n").textContent.includes("1")`), await ev(`return r.querySelector("dialog.rtall-dlg .list-search .n").textContent`));
    check(`[${tag}] Fokus bleibt im Suchfeld`, await ev(`return r.activeElement?.matches('input[data-lsearch="routines"]')`));
    await tap('dialog.rtall-dlg [data-rta-clear]');
    check(`[${tag}] X leert die Suche`, await wait(`return r.querySelectorAll("dialog.rtall-dlg .mg-dcard").length === 2`));
    await tap('dialog.rtall-dlg [data-rta="routine-filter"][data-v="off"]');
    check(`[${tag}] Filter "Aus": nur der ausgeschaltete`, await wait(`return r.querySelectorAll("dialog.rtall-dlg .mg-card").length === 1 && r.querySelector("dialog.rtall-dlg .mg-card b").textContent === "Nachtlicht"`));
    await tap('dialog.rtall-dlg [data-rta="routine-filter"][data-v="all"]');
    await wait(`return r.querySelectorAll("dialog.rtall-dlg .mg-card").length === 2`);

    // Einschalten
    const before = (await calls("device_panel/routine_enable")).length;
    await ev(`const i = r.querySelector('dialog.rtall-dlg input[data-id="aaaaaaaaaaa2"]'); i.click()`);
    check(`[${tag}] Einschalten: routine_enable gesendet, Karte aktiv`, await wait(`return !r.querySelector('dialog.rtall-dlg input[data-id="aaaaaaaaaaa2"]').closest(".mg-card").classList.contains("off")`) && (await calls("device_panel/routine_enable")).length === before + 1 && (await calls("device_panel/routine_enable")).at(-1).enabled === true);

    // Bearbeiten: Assistent im eigenen Fenster (darüber)
    await tap('dialog.rtall-dlg [data-rta="routine-edit"][data-id="aaaaaaaaaaa1"]');
    check(`[${tag}] Bearbeiten öffnet den Assistenten`, await wait(`return r.querySelector("dialog.routine-dlg")?.open && !!r.querySelector("dialog.routine-dlg .mg-big")`) && !(await ev(`return r.querySelector("dialog.device").open`)));
    await tap('dialog.routine-dlg [data-rt="close"]');
    await wait(`return !r.querySelector("dialog.routine-dlg").open`);
    check(`[${tag}] danach wieder das Fenster mit allen Routinen`, await ev(`return r.querySelector("dialog.rtall-dlg").open && r.querySelectorAll("dialog.rtall-dlg .mg-dcard").length === 2`));

    // Lieblings-Routine (2.26.0): Herz rechts von "Löschen"; ab dem ersten ein Reiter mit Herz, das Fenster öffnet darauf, alles aufgeklappt
    const tabsText = () => ev(`return [...r.querySelectorAll("dialog.rtall-dlg .mg-filter .sub-tab")].map((e) => e.dataset.v).join(",")`);
    const lastId = await ev(`const h = [...r.querySelectorAll("dialog.rtall-dlg .mg-dcard")].at(-1); return h.querySelector('[data-rta="routine-star"]').dataset.id`);
    check(`[${tag}] Herz: neben "Löschen" (rechts davon), nicht gesetzt; noch kein Reiter mit Herz`, await ev(`const c = r.querySelector('dialog.rtall-dlg .mg-acts'); const [e, x, d, s] = [...c.querySelectorAll(".linkbtn")]; return e.dataset.rta === "routine-edit" && x.dataset.rta === "routine-run" && d.dataset.rta === "routine-delete" && s.dataset.rta === "routine-star" && s.classList.contains("fav") && !s.classList.contains("on") && s.getBoundingClientRect().left - d.getBoundingClientRect().right >= 12`) && (await tabsText()) === "all,on,off,running");
    check(`[${tag}] Herz: Fläche ${mobile ? "mindestens 44 px" : "klein"} und Beschriftung`, await ev(`const s = r.querySelector('dialog.rtall-dlg [data-rta="routine-star"]'); return s.getAttribute("aria-label").length > 5 && ${mobile ? "s.getBoundingClientRect().height >= 43.5" : "true"}`));
    await tap(`dialog.rtall-dlg [data-rta="routine-star"][data-id="${lastId}"]`);
    check(`[${tag}] Herz gesetzt: Reiter mit Herz erscheint (Zahl 1), Ansicht bleibt "Alle"`, await wait(`const f = r.querySelector('dialog.rtall-dlg .mg-filter .sub-tab[data-v="fav"]'); return !!f && f.querySelector(".tab-s").textContent === "1" && !!f.querySelector("svg") && f.getAttribute("aria-label").length > 3 && r.querySelector('dialog.rtall-dlg .mg-filter .sub-tab.on').dataset.v === "all" && r.querySelectorAll("dialog.rtall-dlg .mg-card").length === 2`));
    const saved = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "frontend/set_user_data" && m.key === "device_panel_routine_stars"));
    let st = [];
    for (let i = 0; i < 30 && !st.length; i++) { await p.waitForTimeout(200); st = await saved(); }
    check(`[${tag}] Herz gespeichert: Benutzerdaten mit die Routine-ID`, st.length > 0 && JSON.stringify(st.at(-1).value.ids) === JSON.stringify([lastId]), JSON.stringify(st.at(-1)));
    // Fenster neu öffnen: öffnet auf dem Reiter mit Herz, nur die Lieblings-Routine, ihr Gerät aufgeklappt
    await tap("dialog.rtall-dlg [data-rta-close]");
    await wait(`return !r.querySelector("dialog.rtall-dlg").open`);
    await tap(".toolbar .rtall-btn");
    check(`[${tag}] erneut geöffnet: Reiter mit Herz gewählt, nur der Lieblings-Routine, Gerät aufgeklappt`, await wait(`const d = r.querySelector("dialog.rtall-dlg"); return d.open && d.querySelector('.mg-filter .sub-tab.on')?.dataset.v === "fav" && d.querySelectorAll(".mg-card").length === 1 && !!d.querySelector(".mg-dcard:not(.closed)") && d.querySelector('[data-rta="routine-star"]').dataset.id === ${JSON.stringify(lastId)}`));
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${outDir}/routineall-fav-${tag.replace("/", "-")}.png` });
    await tap(`dialog.rtall-dlg [data-rta="routine-star"][data-id="${lastId}"]`);
    check(`[${tag}] Herz entfernt (letzter Lieblings-Routine): Reiter weg, zurück auf "Alle" mit beiden Routinen`, await wait(`const d = r.querySelector("dialog.rtall-dlg"); return !d.querySelector('.mg-filter .sub-tab[data-v="fav"]') && d.querySelector('.mg-filter .sub-tab.on').dataset.v === "all" && d.querySelectorAll(".mg-dcard").length === 2`));
    // "Alle" ist nach dem Neuöffnen eingeklappt: wieder ausklappen für die folgenden Prüfungen
    await tap('dialog.rtall-dlg [data-rta="routine-fold-all"]');
    await wait(`return r.querySelectorAll("dialog.rtall-dlg .mg-card").length === 2`);


    // Löschen mit Rückfrage (2.24.1): erst Nein, dann Ja
    await tap('dialog.rtall-dlg [data-rta="routine-delete"][data-id="aaaaaaaaaaa2"]');
    check(`[${tag}] Löschen: Rückfrage in der Karte, noch nichts gelöscht`, await wait(`return !!r.querySelector('dialog.rtall-dlg [data-rta="routine-delete-yes"][data-id="aaaaaaaaaaa2"]')`) && (await calls("device_panel/routine_delete")).length === 0);
    await tap('dialog.rtall-dlg [data-rta="routine-delete-no"]');
    check(`[${tag}] Nein: Rückfrage weg, beide Routinen da`, await wait(`return !r.querySelector('dialog.rtall-dlg [data-rta="routine-delete-yes"]') && r.querySelectorAll("dialog.rtall-dlg .mg-card").length === 2`));
    await tap('dialog.rtall-dlg [data-rta="routine-delete"][data-id="aaaaaaaaaaa2"]');
    await tap('dialog.rtall-dlg [data-rta="routine-delete-yes"][data-id="aaaaaaaaaaa2"]');
    check(`[${tag}] Ja: routine_delete gesendet, Routine aus der Liste`, await wait(`return r.querySelectorAll("dialog.rtall-dlg .mg-card").length === 1`) && (await calls("device_panel/routine_delete")).at(-1)?.routine_id === "aaaaaaaaaaa2");

    await tap("dialog.rtall-dlg [data-rta-close]");
    check(`[${tag}] Schliessen`, await wait(`return !r.querySelector("dialog.rtall-dlg").open`));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
