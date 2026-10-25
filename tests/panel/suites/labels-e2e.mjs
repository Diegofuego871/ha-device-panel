// Labels (2.155.0, docs/mockups/labels-v1): Abschnitt "Labels" in den Einstellungen (Plus wählt ein Label aus Home Assistant, Detail mit den
// Einstellungen einer Integration, Reihenfolge, Entfernen), Herkunft im Geräte-Popup ("Wie Label"), Filter-Chip "Label" (nur mit Labels, ein-/
// ausblendbar, in der Chip-Liste der Ansicht) und die Wizard-Seite "Labels" vor "Ruhezeit und System". Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { section: "Labels", chip: "Label", add: "Label hinzufügen", back: "Alle Labels", viaLabel: "Wie Label", originLabel: "Label Oft offline", none: "Ohne Label", wzStep: "Labels", labelsTab: "Typ" },
  en: { section: "Labels", chip: "Label", add: "Add label", back: "All labels", viaLabel: "Same as label", originLabel: "Label Often offline", none: "No label", wzStep: "Labels", labelsTab: "Type" },
};
const select_ = async (s, sel, value) => { await s.ev(`const e=r.querySelector(${JSON.stringify(sel)}); e.value=${JSON.stringify(value)}; e.dispatchEvent(new Event("change",{bubbles:true}));`); };
const NAMES = { de: "Oft offline", en: "Often offline" };

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const L = T[lang];
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const errors = [];
    const session = async (query = "") => {
      const p = await ctx.newPage();
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark${query}`);
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
      const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
      const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.innerText || "").replace(/\\s+/g," ").trim()`);
      const select = async (sel, value) => { await ev(`const s=r.querySelector(${JSON.stringify(sel)}); s.value=${JSON.stringify(value)}; s.dispatchEvent(new Event("change",{bubbles:true}));`); };
      const refetch = async () => { await ev(`return r.host._fetch(true).then(()=>true)`); };
      const rows = () => ev(`return [...r.querySelectorAll(".dev")].map(x=>x.dataset.open).sort().join()`);
      return { p, f, ev, tap, wait, text, select, refetch, rows, handle };
    };

    // --- ohne Labels: kein Chip, leerer Abschnitt
    {
      const s = await session();
      check(`[${tag}] ohne Label kein Chip "${L.chip}"`, !(await s.ev(`return !!r.querySelector(".chips [data-label-open]")`)));
      await s.tap(".gear-btn");
      await s.wait(`return !!r.querySelector("dialog.settings .set-sec")`);
      check(`[${tag}] Register "${L.section}" steht hinter "Integrationen", kein eigener Abschnitt`, await s.ev(`const t=[...r.querySelectorAll("dialog.settings .set-sec-head")].map(x=>x.dataset.id); return t.join() === "devices,monitor,routines,ai,updates"`), await s.ev(`return [...r.querySelectorAll("dialog.settings .set-sec-head")].map(x=>x.dataset.id).join()`));
      await s.tap('[data-set="section"][data-id="monitor"]');
      await s.tap('.mon-tab[data-key="labels"]');
      check(`[${tag}] leer: Hinweis und "${L.add}"`, await s.wait(`return !!r.querySelector(".label-add") && r.querySelector(".mon-empty")`) && (await s.text(".label-add")) === L.add);
      await s.tap(".label-add");
      check(`[${tag}] ohne Labels in HA: Hinweis statt Liste`, await s.wait(`return !!r.querySelector(".label-pick .mon-empty")`));
      await s.p.close();
    }

    // --- mit Labels
    const s = await session();
    const { p, ev, tap, wait, text, select } = s;
    await p.evaluate(() => {
      window.__labels = [{ id: "oft_offline", name: window.__lang === "en" ? "Often offline" : "Oft offline" }, { id: "garage", name: "Garage" }, { id: "leer", name: "Ohne Geräte" }];
      // Geräte im Simulator: b, e (zha), d (shelly)
      window.__devLabels = { b: ["oft_offline"], e: ["oft_offline", "garage"], d: ["garage"] };
    });
    await p.evaluate((name) => { window.__labels[0].name = name; }, NAMES[lang]);
    await s.refetch();
    check(`[${tag}] Chip "${L.chip}" erscheint, sobald ein Gerät ein Label trägt`, await wait(`return !!r.querySelector(".chips [data-label-open]")`));

    // Filter: Auswahl mit Zahlen, nur Labels mit Geräten
    await tap(".chips [data-label-open]");
    const PICK = mobile ? "dialog.area-sheet" : ".area-pop";
    await wait(mobile ? `return r.querySelector("dialog.area-sheet").open` : `return !r.querySelector(".area-pop").hidden`);
    const list = await ev(`return [...r.querySelectorAll("${PICK} .arow")].map(x=>x.querySelector(".al").textContent + ":" + x.querySelector(".an").textContent)`);
    check(`[${tag}] Auswahl: Labels mit Geräten und "${L.none}"`, list.length === 3 && list.includes(`${NAMES[lang]}:2`) && list.includes("Garage:2") && list.some((x) => x.startsWith(`${L.none}:`)), JSON.stringify(list));
    check(`[${tag}] Auswahl: kein Label ohne Geräte`, !list.some((x) => x.startsWith("Ohne Geräte")));
    await tap(`${PICK} [data-area="garage"]`);
    check(`[${tag}] Garage: nur d, e`, await wait(`return [...r.querySelectorAll(".dev")].map(x=>x.dataset.open).sort().join() === "d,e"`), await s.rows());
    check(`[${tag}] Chip zeigt den Namen und die Zahl`, (await text(".chips .chip.lab")).startsWith("Garage") && (await text(".chips .chip.lab .n")) === "2", await text(".chips .chip.lab"));
    await tap(`${PICK} [data-area="oft_offline"]`);
    check(`[${tag}] zwei Labels: "oder" (b, d, e)`, await wait(`return [...r.querySelectorAll(".dev")].map(x=>x.dataset.open).sort().join() === "b,d,e"`), await s.rows());
    if (mobile) await tap('dialog.area-sheet .dlg-actions [data-area-done]'); else await p.keyboard.press("Escape");
    await tap(".chips [data-label-clear]");
    check(`[${tag}] Filter aufheben: alle Geräte`, await wait(`return r.querySelectorAll(".dev").length > 10 && !r.querySelector(".chips .chip.lab.on")`));
    // "Ohne Label"
    await tap(".chips [data-label-open]");
    await tap(`${PICK} [data-area="#none"]`);
    check(`[${tag}] "${L.none}": ohne b, d, e`, await wait(`const ids=[...r.querySelectorAll(".dev")].map(x=>x.dataset.open); return ids.length > 5 && !ids.includes("b") && !ids.includes("d") && !ids.includes("e")`));
    await tap(`${PICK} [data-area="#none"]`);
    if (mobile) await tap('dialog.area-sheet .dlg-actions [data-area-done]'); else await p.keyboard.press("Escape");
    await wait(`return !r.querySelector(".chips .chip.lab.on")`);

    // --- Einstellungen: Label hinzufügen
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await tap('.mon-tab[data-key="labels"]');
    await tap(".label-add");
    const picks = await ev(`return [...r.querySelectorAll(".label-pick .ilist-row .ilist-name")].map(x=>x.firstChild.textContent).join()`);
    check(`[${tag}] Plus: Labels mit Geräten zur Wahl, ohne Geräte nicht`, picks.includes(NAMES[lang]) && picks.includes("Garage") && !picks.includes("Ohne Geräte"), picks);
    await tap(`.label-pick [data-key="oft_offline"]`);
    check(`[${tag}] Wahl öffnet das Label (Reiter wie bei einer Integration)`, await wait(`return !!r.querySelector(".lvl-tabs") && r.querySelector(".ihead b").textContent === ${JSON.stringify(NAMES[lang])}`));
    const tabs = await ev(`return [...r.querySelectorAll(".lvl-tabs .sub-tab")].map(x=>x.dataset.key).join()`);
    check(`[${tag}] Reiter Ausfall, Batterie, Laden, Neu, Updates, Empfang, Typ`, tabs === "out,bat,chg,new,upd,sig,kind", tabs);
    // Ausgefallen nach: 30 Minuten für das Label
    await select('select[data-off-mode="label:oft_offline"]', "30");
    check(`[${tag}] Entwurf: Label-Schlüssel in der Zuordnung`, await ev(`return JSON.stringify(r.host._settings.draft.offline_after_integrations) === '{"label:oft_offline":30}' && JSON.stringify(r.host._settings.draft.labels) === '["oft_offline"]'`));
    // Typ und Verbindungsart
    await tap('[data-set="isub"][data-key="kind"]');
    check(`[${tag}] Reiter ${L.labelsTab}: Typ und Verbindungsart wählbar`, await wait(`return !!r.querySelector('select[data-type-integ="label:oft_offline"]') && !!r.querySelector('select[data-conn-integ="label:oft_offline"]')`));
    await select('select[data-type-integ="label:oft_offline"]', "sensor");
    check(`[${tag}] Typ des Labels im Entwurf`, await ev(`return r.host._settings.draft.type_integrations["label:oft_offline"] === "sensor"`));
    await p.screenshot({ path: `${outDir}/labels-detail-${tag.replace("/", "-")}.png` });
    // Zweites Label und Reihenfolge
    await tap(`[data-set="label"][data-key=""]`);
    await tap(".label-add");
    await tap('.label-pick [data-key="garage"]');
    await select('select[data-off-mode="label:garage"]', "60");
    await tap('[data-set="label-move"][data-dir="-1"]');
    check(`[${tag}] nach oben: Reihenfolge der Labels im Entwurf`, await ev(`return JSON.stringify(r.host._settings.draft.labels) === '["garage","oft_offline"]'`));
    // Speichern
    await tap('[data-set="save"]');
    check(`[${tag}] gespeichert (Label-Schlüssel, Reihenfolge)`, await p.evaluate(() => {
      const last = (window.__setOptsLog || []).at(-1) || {};
      return JSON.stringify(last.labels) === '["garage","oft_offline"]' && last.offline_after_integrations?.["label:garage"] === 60 && last.offline_after_integrations?.["label:oft_offline"] === 30 && last.type_integrations?.["label:oft_offline"] === "sensor";
    }));
    // Kein Label in der Integrationsliste und kein Label im Typ-Abschnitt
    await tap('.mon-tab[data-key="integ"]');
    await wait(`return !!r.querySelector('.ilist-row[data-key="zha"]')`);
    check(`[${tag}] Liste der Integrationen ohne Label-Zeilen`, await ev(`return ![...r.querySelectorAll(".ilist-row")].some(x=>String(x.dataset.key).startsWith("label:"))`));
    await tap('dialog.settings [data-set="close"]');
    await wait(`return !r.querySelector("dialog.settings").open`);

    // --- Popup: Herkunft "Label"
    await s.refetch();
    await tap('.dev[data-open="b"]');
    await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device [data-tab="set"]')`);
    await tap('dialog.device [data-tab="set"]');
    await wait(`return r.querySelector('select[data-dlg="dev-off"]')`);
    const offline = await ev(`const s=r.querySelector('dialog.device select[data-dlg="dev-off"]'); return s ? s.options[0].textContent : ""`);
    check(`[${tag}] Popup b: "Ausgefallen nach" zeigt "${L.viaLabel}"`, offline.includes(L.viaLabel) && offline.includes("30"), offline);
    const origin = await ev(`return [...r.querySelectorAll("dialog.device .origin")].map(x=>x.textContent).join("|")`);
    check(`[${tag}] Popup b: Herkunft "${L.originLabel}"`, origin.includes(L.originLabel), origin);
    await p.keyboard.press("Escape");
    await wait(`return !r.querySelector("dialog.device").open`);
    // Gerät e trägt beide Labels: das strengste (60 Min.) gilt
    await tap('.dev[data-open="e"]');
    await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device [data-tab="set"]')`);
    await tap('dialog.device [data-tab="set"]');
    await wait(`return r.querySelector('select[data-dlg="dev-off"]')`);
    const offE = await ev(`const s=r.querySelector('dialog.device select[data-dlg="dev-off"]'); return s ? s.options[0].textContent : ""`);
    check(`[${tag}] Popup e (zwei Labels): die längere Zeit (60) gilt`, /1 (Std|h)/.test(offE), offE);
    await p.keyboard.press("Escape");
    await wait(`return !r.querySelector("dialog.device").open`);

    // --- Chip in der Ansicht: in der Liste der Chips, ausblendbar
    await tap(mobile ? "[data-view-open]" : ".view-btn");
    await wait(`return !!r.querySelector("dialog.settings .sub-tab")`);
    await tap('[data-set="vtab"][data-key="chips"]');
    await wait(`return !!r.querySelector('.drag-list[data-drag-list="chip_order"]')`);
    const chipRow = await ev(`return !![...r.querySelectorAll("dialog.settings [data-set='drag']")].find(x=>x.dataset.key==="label")`);
    check(`[${tag}] Ansicht: "${L.chip}" steht in der Chip-Liste`, chipRow);
    check(`[${tag}] Ansicht: "${L.chip}" steht hinter "Integration"`, await ev(`const k=[...r.querySelectorAll("dialog.settings [data-set='drag']")].map(x=>x.dataset.key); return k.indexOf("label") === k.indexOf("integration") + 1`));
    await p.screenshot({ path: `${outDir}/labels-view-${tag.replace("/", "-")}.png` });
    await p.close();

    // --- Assistent: Seite "Labels" vor "Ruhezeit und System", nur mit Labels
    {
      const w = await session("&wizard=open");
      await w.p.evaluate((name) => {
        window.__labels = [{ id: "oft_offline", name }, { id: "garage", name: "Garage" }];
        window.__devLabels = { b: ["oft_offline"], e: ["oft_offline", "garage"], d: ["garage"] };
        window.__opts.notify_service = "notify.handy";
      }, NAMES[lang]);
      await w.ev(`r.host._wizard.open("app")`);
      await w.wait(`return r.querySelector("dialog.wizard-dlg")?.open && !r.host._wizard.s?.loading`);
      const steps = await w.ev(`return r.host._wizard.steps().join()`);
      check(`[${tag}] Assistent: Schritte mit "labels" vor "quiet"`, steps === "integrations,types,devices,messages,labels,quiet,done", steps);
      await w.ev(`r.host._wizard.go("labels")`);
      await w.wait(`return !!r.querySelector("dialog.wizard-dlg [data-wz-lab]")`);
      await select_(w, "[data-wz-lab]", "oft_offline");
      check(`[${tag}] Assistent: Wahl richtet das Label ein und zeigt seine Karte`, await w.wait(`return !!r.querySelector(".wz-lcard") && JSON.stringify(r.host._wizard.s.d.lab.ids) === '["oft_offline"]'`));
      await w.ev(`const c=r.querySelector('.wz-lcard input[data-wz-lf="mon"]'); c.click(); return true`);
      check(`[${tag}] Assistent: "Überwachen" aus im Entwurf`, await w.ev(`return r.host._wizard.s.d.lab.cfg.oft_offline.mon === false`));
      await w.p.screenshot({ path: `${outDir}/labels-wizard-${tag.replace("/", "-")}.png` });
      const values = await w.ev(`return r.host._wizard.labelValues({})`);
      check(`[${tag}] Assistent: Werte mit Label-Schlüssel`, values.labels.join() === "oft_offline" && values.offline_after_integrations["label:oft_offline"] === "off", JSON.stringify(values));
      await w.p.close();
    }
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
