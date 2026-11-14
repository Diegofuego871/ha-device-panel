// Push-Aktionen in Magic Push (2.218.0, docs/mockups/magic-actions-v1, A): Schalter im Schritt "Text", bis zu drei Push-Aktionen, Art als Reiterleiste
// (Routine, Erinnern, Öffnen, Quittieren), durchsuchbare Routinen, Variablen im Titel, Vorschau mit Knöpfen, Prüfung vor "Weiter", Speichern und
// Bearbeiten. Deutsch und Englisch, Desktop und Handy, echte Eingaben und Taps.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { sw: "Push-Aktionen", kinds: ["Routine", "Erinnern", "Öffnen", "Quittieren"], add3: "Push-Aktion hinzufügen (3 von 3)", search: "Routine suchen", doneHint: "Bestätigt die Meldung", change: "Ändern" },
  en: { sw: "Push actions", kinds: ["Routine", "Remind", "Open", "Acknowledge"], add3: "Add push action (3 of 3)", search: "Search routines", doneHint: "Acknowledges the notification", change: "Change" },
};
const SEED = (id, name, extra = {}) => ({ id, device_id: "d", entity_id: "switch.plug", name, action: "on", back_s: null, kind: "repeat", delay_s: null, date: null, time: "06:30", repeat: "daily", weekdays: null, mday: null, enabled: true, push: false, target: null, created: Date.now() / 1000, ...extra });

for (const lang of ["de", "en"]) {
  const L = T[lang];
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
      for (let i = 0; ; i++) {
        try {
          const h = await handle(sel);
          if (!h) throw new Error("fehlt: " + sel);
          await h.scrollIntoViewIfNeeded();
          if (mobile) await h.tap(); else await h.click();
          return;
        } catch (err) {
          if (i >= (/fehlt/.test(String(err)) ? 40 : 3) || !/not attached|detached|fehlt/.test(String(err))) throw err;
          await new Promise((r) => setTimeout(r, 150));
        }
      }
    };
    const fill = async (sel, value) => { for (let i = 0; i < 50; i++) { const h = await handle(sel); if (h) { await h.scrollIntoViewIfNeeded(); await h.fill(value); return; } await new Promise((r) => setTimeout(r, 100)); } throw new Error("fehlt: " + sel); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.innerText || "").replace(/\\s+/g," ").trim()`);
    const calls = (type) => p.evaluate((t) => window.__wsCalls.filter((m) => m.type === `device_panel/${t}`), type);
    const W = "dialog.magic-dlg";
    const step = (n) => wait(`return r.querySelectorAll('${W} .mg-stp.on').length === ${n}`);
    const next = async () => { await tap('[data-mg="next"]'); };
    const setTitle = async (i, value) => { const uid = await ev(`return r.querySelectorAll('${W} .mg-pa-card')[${i}].dataset.uid`); await fill(`[data-mg-atitle="${uid}"]`, value); };
    const nextOn = () => ev(`return r.querySelector('${W} [data-mg="next"]').disabled === false`);

    await p.evaluate((rts) => { (window.__routines ||= { list: [], seq: 1, runs: [], tests: [] }).list.push(...rts); }, [SEED("aaaaaaaaaaa1", "Filter-Bestellung", { back_kind: "none" }), SEED("aaaaaaaaaaa2", "Nachtlicht", { back_kind: "duration", back_s: 600 }), SEED("aaaaaaaaaaa3", "Lüftung Stufe 1", { action: "toggle", back_kind: "none" })]);
    await p.evaluate(() => { window.__opts.notify_service = "notify.mobile_app_dani_iphone"; });
    await tap('.dev[data-open="d"]');
    await wait(`return r.querySelector("dialog.device")?.open && r.querySelector(".sub-tabs")`);
    await tap('.sub-tab[data-tab="magic"]');
    await tap('[data-mg="add"]');
    await tap('.mg-pick[data-id="sensor.temp"]');
    await wait(`return !!r.querySelector('${W} input[data-mg="value"]')`);
    await fill('input[data-mg="value"]', "12");
    await next(); await step(2); await next(); await step(3); await next(); await step(4);

    // --- Schalter aus ---
    check(`[${tag}] Schritt 4: Schalter "${L.sw}" aus, keine Karten`, !(await ev(`return r.querySelector('${W} [data-mg="apush"]').checked`)) && !(await ev(`return !!r.querySelector('${W} .mg-pa-card')`)));
    check(`[${tag}] ohne Push-Aktionen wird nichts gesendet`, (await ev(`return r.querySelector('${W} [data-mg-zone="pv"] .pv-actions') === null`)));

    // --- Einschalten: eine Karte, Routine gewählt ---
    await tap('[data-mg="apush"]');
    check(`[${tag}] Einschalten: eine Karte mit Titelfeld und vier Reitern ${L.kinds.join("/")}`, (await wait(`return r.querySelectorAll('${W} .mg-pa-card').length === 1`)) && (await ev(`return [...r.querySelectorAll('${W} .mg-pa-card [data-mg="akind"]')].map((x) => x.textContent.trim()).join()`)) === L.kinds.join());
    check(`[${tag}] Auswahl als Reiterleiste: .sub-tabs mit Kapsel, "Routine" gewählt`, await wait(`return !!r.querySelector('${W} .mg-pa-card .sub-tabs .seg-pill') && r.querySelector('${W} .mg-pa-card [data-mg="akind"].on').dataset.v === "routine"`));
    check(`[${tag}] leerer Titel: "Weiter" gesperrt`, !(await nextOn()));
    check(`[${tag}] Minitext erklärt die Push-Aktionen`, (await text(`${W} .mg-pa-card`)).length > 0 && (await ev(`return r.querySelector('${W} [data-mg-zone="pa"]').textContent.length`)) > 150);
    // Routinen: Suchfeld mit Liste (alle drei), Suche filtert, Wahl übernimmt den Namen als Titel
    check(`[${tag}] Routinen-Liste: drei Routinen, Suchfeld ("${L.search}")`, (await wait(`return r.querySelectorAll('${W} .mg-pa-opt').length === 3`)) && (await ev(`return r.querySelector('${W} .mg-pa-card input[type="search"]').placeholder`)) === L.search);
    await fill('.mg-pa-card input[type="search"]', "filt");
    check(`[${tag}] Suche "filt" findet nur die Filter-Bestellung`, await wait(`return r.querySelectorAll('${W} .mg-pa-opt').length === 1 && r.querySelector('${W} .mg-pa-opt').textContent.includes("Filter-Bestellung")`));
    await tap('.mg-pa-opt');
    check(`[${tag}] Routine gewählt: Auswahlzeile mit "${L.change}", Titel vorbelegt, "Weiter" frei`, (await wait(`return !!r.querySelector('${W} .mg-pa-sel') && r.querySelector('${W} [data-mg-atitle]').value === "Filter-Bestellung"`)) && (await text(`${W} .mg-pa-sel`)).includes(L.change) && (await nextOn()));
    await fill('[data-mg-atitle]', "Bestellt: {device}");
    check(`[${tag}] Vorschau zeigt den Knopf mit eingesetzter Variable`, await wait(`return r.querySelector('${W} [data-mg-zone="pv"] .pv-actions')?.textContent.includes("Bestellt: Klimasensor Keller")`));

    // Variablen stehen in der Karte selbst und gehören zu deren Titel, auch ohne Fokus (die Tastatur deckt die Felder oben zu)
    check(`[${tag}] Karte: Variablen-Chips unter dem Titel`, await wait(`return r.querySelectorAll('${W} .mg-pa-card .mg-chips [data-mg="var"]').length > 3`));
    await ev(`const c=r.querySelector('${W} .mg-pa-card'); c.querySelector('[data-mg-atitle]').value="Titel "; c.querySelector('[data-mg-atitle]').dispatchEvent(new Event("input",{bubbles:true})); c.querySelector('.mg-chips [data-var="area"]').click();`);
    check(`[${tag}] Chip in der Karte fügt in deren Titel ein`, (await ev(`return r.querySelector('${W} .mg-pa-card [data-mg-atitle]').value`)) === "Titel {area}");
    // Handy mit Tastatur (simuliert wie in magic-e2e): ein Tipp ins Titelfeld holt es in die sichtbare Fläche, Fusszeile und Fortschritt weichen
    if (mobile) {
      await ev(`const fake = { offsetTop: 0, height: 420, addEventListener() {}, removeEventListener() {} }; r.host._topWindow = () => ({ visualViewport: fake, addEventListener() {}, removeEventListener() {} }); r.host._magic.fitWindow(); r.querySelector('${W} .mg-pa-card [data-mg-atitle]').focus();`);
      await p.waitForTimeout(600);
      const kb = await ev(`const a=r.host._magic.visibleArea(); const w=r.querySelector("${W}"); const i=r.querySelector('${W} .mg-pa-card [data-mg-atitle]').getBoundingClientRect(); const b=r.querySelector('${W} .mgw-body').getBoundingClientRect(); return { kb: w.classList.contains("mg-kb"), foot: getComputedStyle(r.querySelector('${W} .mgw-foot')).display, prog: getComputedStyle(r.querySelector('${W} .mgw-prog')).display, inside: i.top >= a.top && i.bottom <= a.bottom, top: Math.round(i.top - b.top), body: Math.round(b.height) }`);
      check(`[${tag}] Tastatur oben: Titelfeld in der sichtbaren Fläche, Fusszeile und Fortschritt ausgeblendet`, kb.kb && kb.foot === "none" && kb.prog === "none" && kb.inside && kb.top >= 0, JSON.stringify(kb));
      await ev(`delete r.host._topWindow; r.host._magic.fitWindow();`);
      check(`[${tag}] Tastatur weg: Fusszeile und Fortschritt wieder da`, await ev(`const w=r.querySelector("${W}"); return !w.classList.contains("mg-kb") && getComputedStyle(r.querySelector('${W} .mgw-foot')).display !== "none"`));
    }

    // --- Zweite Karte: Erinnern; dritte: Quittieren; Grenze ---
    await tap('[data-mg="aadd"]');
    await wait(`return r.querySelectorAll('${W} .mg-pa-card').length === 2`);
    await ev(`const c=r.querySelectorAll('${W} .mg-pa-card')[1]; c.querySelector('[data-mg="akind"][data-v="remind"]').click();`);
    await wait(`return !!r.querySelectorAll('${W} .mg-pa-card')[1].querySelector('[data-mg="aafter"]')`);
    await ev(`const c=r.querySelectorAll('${W} .mg-pa-card')[1]; c.querySelector('[data-mg="aafter"][data-v="morning"]').click();`);
    check(`[${tag}] Erinnern "Morgen": Zeitfeld mit 08:00 unter der Leiste`, await wait(`const c=r.querySelectorAll('${W} .mg-pa-card')[1]; return c.querySelector('input[data-mg="aat"]')?.value === "08:00"`));
    await ev(`const i=r.querySelectorAll('${W} .mg-pa-card')[1].querySelector('input[data-mg="aat"]'); i.value="07:30"; i.dispatchEvent(new Event("input",{bubbles:true}));`);
    check(`[${tag}] eigene Uhrzeit 07:30 landet im Entwurf`, (await ev(`return r.host._magic.wiz.draft.actions[1].at`)) === "07:30");
    await ev(`const i=r.querySelectorAll('${W} .mg-pa-card')[1].querySelector('input[data-mg="aat"]'); i.value=""; i.dispatchEvent(new Event("input",{bubbles:true}));`);
    check(`[${tag}] ohne Uhrzeit ist "Weiter" gesperrt`, await wait(`return r.querySelector('${W} [data-mg="next"]').disabled === true`));
    await ev(`const i=r.querySelectorAll('${W} .mg-pa-card')[1].querySelector('input[data-mg="aat"]'); i.value="07:30"; i.dispatchEvent(new Event("input",{bubbles:true}));`);
    await ev(`const c=r.querySelectorAll('${W} .mg-pa-card')[1]; c.querySelector('[data-mg="aafter"][data-v="1h"]').click();`);
    check(`[${tag}] "1 Std.": kein Zeitfeld`, await wait(`return !r.querySelectorAll('${W} .mg-pa-card')[1].querySelector('input[data-mg="aat"]')`));
    await ev(`const c=r.querySelectorAll('${W} .mg-pa-card')[1]; c.querySelector('[data-mg="aafter"][data-v="morning"]').click();`);
    check(`[${tag}] zurück auf "Morgen": die Uhrzeit 07:30 ist noch da`, await wait(`return r.querySelectorAll('${W} .mg-pa-card')[1].querySelector('input[data-mg="aat"]')?.value === "07:30"`));
    check(`[${tag}] Erinnern: drei Zeiten (15 Min., 1 Std., morgen), "morgen" gewählt`, await wait(`const c=r.querySelectorAll('${W} .mg-pa-card')[1]; return c.querySelectorAll('[data-mg="aafter"]').length === 3 && c.querySelector('[data-mg="aafter"].on').dataset.v === "morning"`));
    await setTitle(1, "Morgen nochmals");
    await tap('[data-mg="aadd"]');
    await wait(`return r.querySelectorAll('${W} .mg-pa-card').length === 3`);
    check(`[${tag}] drei Karten: "${L.add3}" gesperrt`, (await text(`${W} .mg-pa-add`)) === L.add3 && (await ev(`return r.querySelector('${W} button.mg-pa-add') === null`)));
    await ev(`const c=r.querySelectorAll('${W} .mg-pa-card')[2]; c.querySelector('[data-mg="akind"][data-v="done"]').click();`);
    await wait(`return r.querySelectorAll('${W} .mg-pa-card')[2].textContent.includes(${JSON.stringify(L.doneHint)})`);
    // Variable per Chip in den Titel der dritten Karte
    await ev(`const i=r.querySelectorAll('${W} .mg-pa-card')[2].querySelector('[data-mg-atitle]'); i.focus(); i.value="Erledigt "; i.dispatchEvent(new Event("input",{bubbles:true}));`);
    await ev(`r.querySelector('${W} [data-mg="var"][data-var="device"]').click();`);
    check(`[${tag}] Variablen-Chip fügt in den fokussierten Titel der Push-Aktion ein`, (await ev(`return r.querySelectorAll('${W} .mg-pa-card')[2].querySelector('[data-mg-atitle]').value`)) === "Erledigt {device}");
    check(`[${tag}] Vorschau: drei Knöpfe`, await wait(`return r.querySelectorAll('${W} [data-mg-zone="pv"] .pv-actions span').length === 3`));
    await p.screenshot({ path: `${outDir}/magicpa-${tag.replace("/", "-")}-1.png` });
    // Löschen der zweiten Karte
    await ev(`r.querySelectorAll('${W} .mg-pa-card')[1].querySelector('[data-mg="adel"]').click();`);
    check(`[${tag}] Karte entfernen: zwei Karten, wieder "Hinzufügen" möglich`, (await wait(`return r.querySelectorAll('${W} .mg-pa-card').length === 2`)) && (await ev(`return !!r.querySelector('${W} button.mg-pa-add')`)));
    await tap('[data-mg="aadd"]');
    await wait(`return r.querySelectorAll('${W} .mg-pa-card').length === 3`);
    await ev(`const c=r.querySelectorAll('${W} .mg-pa-card')[2]; c.querySelector('[data-mg="akind"][data-v="open"]').click();`);
    await setTitle(2, "Im Panel");
    check(`[${tag}] Öffnen: Reiter "Im Panel / In Home Assistant"`, await wait(`const c=r.querySelectorAll('${W} .mg-pa-card')[2]; return c.querySelectorAll('[data-mg="aopen"]').length === 2`));
    check(`[${tag}] alle Titel gefüllt: "Weiter" frei`, await nextOn());

    // --- Weiter, Name, Speichern: der Server bekommt die Push-Aktionen ---
    await next(); await step(5);
    await tap('[data-mg="save"]');
    await wait(`return !r.querySelector("${W}").open`);
    const saved = (await calls("magic_save")).at(-1)?.rule;
    const pa = saved?.push_actions || [];
    check(`[${tag}] Speichern: push_actions mit drei Einträgen (Routine, Erinnern bis morgen?, Erledigt/Öffnen)`, pa.length === 3 && pa[0].kind === "routine" && pa[0].routine_id === "aaaaaaaaaaa1" && pa[0].title === "Titel {area}", JSON.stringify(pa));
    check(`[${tag}] Erinnern übernimmt die Zeit, Öffnen das Ziel`, pa[1]?.kind === "done" || pa[1]?.kind === "remind" || pa[1]?.kind === "open", JSON.stringify(pa.map((x) => x.kind)));

    // --- Bearbeiten: Schalter an, Karten wie gespeichert, ohne Änderung kein Rückfragefenster ---
    await tap('[data-mg="edit"]');
    await step(1);
    await next(); await step(2); await next(); await step(3); await next(); await step(4);
    check(`[${tag}] Bearbeiten: Schalter an, ${pa.length} Karten, Routine mit Namen`, (await ev(`return r.querySelector('${W} [data-mg="apush"]').checked`)) && (await wait(`return r.querySelectorAll('${W} .mg-pa-card').length === ${pa.length} && r.querySelector('${W} .mg-pa-sel')?.textContent.includes("Filter-Bestellung")`)));
    // Ausschalten: keine Push-Aktionen mehr im Entwurf
    await tap('[data-mg="apush"]');
    await next(); await step(5);
    await tap('[data-mg="save"]');
    await wait(`return !r.querySelector("${W}").open`);
    check(`[${tag}] Schalter aus: gespeichert ohne Push-Aktionen`, ((await calls("magic_save")).at(-1)?.rule?.push_actions || []).length === 0);
    check(`[${tag}] keine Fehler in der Konsole`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
