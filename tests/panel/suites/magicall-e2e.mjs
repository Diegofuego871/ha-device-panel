// Magic Push als eigene App mit eigenem Fenster (2.75.0, vorher Reiter in den Einstellungen): zeigt alle Meldungen aller
// Geräte, nach Gerät gruppiert; ein- und ausschalten, bearbeiten (öffnet das Fenster des Assistenten) und löschen mit
// Rückfrage, neue Meldungen kommen seit 2.102.0 über das Plus (Suite magicadd). Dazu: in den Einstellungen gibt es den Reiter nicht mehr (acht Reiter). Deutsch und
// Englisch, Desktop und Handy, echte Klicks und Taps.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { tab: "Magic Push", intro: "Alle Meldungen von Magic Push", count: "3 Meldungen auf 2 Geräten", count2: "2 Meldungen auf 2 Geräten", count1: "1 Meldung auf 1 Gerät", empty: "Noch keine Meldungen", deleteAsk: "löschen?", deleted: "Gelöscht.", q1: "Was soll überwacht werden?", q1b: "Welche Bedingungen?", err: "konnten nicht geladen werden", off: "ausgeschaltet", mon: "Überwachung und Meldungen" },
  en: { tab: "Magic Push", intro: "All Magic Push messages", count: "3 messages on 2 devices", count2: "2 messages on 2 devices", count1: "1 message on 1 device", empty: "No messages yet", deleteAsk: "Delete", deleted: "Deleted.", q1: "What should be watched?", q1b: "Which conditions?", err: "could not be loaded", off: "turned off", mon: "Monitoring and notifications" },
};
const RULE = (id, device, name, entity, extra = {}) => ({ id, device_id: device, entity_id: entity, name, kind: "below", value: 12, for_s: 600, message: "Meldung {value}", body: "", recover: false, recover_message: "", recover_body: "", repeat_s: 0, target: null, enabled: true, critical: false, critical_volume: 10, reset_value: null, ...extra });

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
    const tap = async (sel) => {
      for (let i = 0; ; i++) {
        try {
          const h = await handle(sel);
          if (!h) throw new Error("fehlt: " + sel);
          await h.scrollIntoViewIfNeeded();
          if (mobile) await h.tap(); else await h.click();
          return;
        } catch (err) {
          if (i >= 3 || !/not attached|detached/.test(String(err))) throw err;
          await new Promise((r) => setTimeout(r, 150));
        }
      }
    };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const calls = (type) => p.evaluate((t) => window.__wsCalls.filter((m) => m.type === `device_panel/${t}`), type);
    const body = "dialog.mgall-dlg [data-mga-body]";
    const cards = () => ev(`return r.querySelectorAll('${body} .mg-card').length`);

    await p.evaluate((rules) => {
      window.__opts.notify_service = "notify.mobile_app_dani_iphone";
      window.__magic = { rules, tests: [], seq: 10 };
    }, [
      RULE("r00000000001", "d", "Keller kalt", "sensor.temp"),
      RULE("r00000000002", "d", "Feuchte hoch", "sensor.abs_humidity", { kind: "above", value: 10 }),
      RULE("r00000000003", "h", "Fenster offen", "binary_sensor.window", { kind: "is", value: "on", for_s: 2700, reset_value: "off", enabled: false }),
    ]);

    // Einstellungen: der Reiter "Magic Push" ist weg (es sind keine Einstellungen), die übrigen acht bleiben
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await wait(`return !!r.querySelector("dialog.settings .mon-tabs")`);
    const tabs = await ev(`return [...r.querySelectorAll("dialog.settings .mon-tabs .mon-tab")].map(b => b.dataset.key).join()`);
    check(`[${tag}] Einstellungen: neun Reiter, kein "Magic Push"`, tabs === "overview,outage,battery,charge,new,updates,sig,integ,labels", tabs);
    const cols = await ev(`return getComputedStyle(r.querySelector("dialog.settings .mon-tabs")).gridTemplateColumns.split(" ").length`);
    check(`[${tag}] Reiterleiste: fünf Spalten am Desktop, drei am Handy (neun Reiter)`, cols === (mobile ? 3 : 5), String(cols));
    check(`[${tag}] kein Reiter abgeschnitten`, await ev(`return [...r.querySelectorAll("dialog.settings .mon-tab")].every(b => b.scrollWidth <= b.clientWidth + 1)`));
    check(`[${tag}] Einstellungen: keine Magic-Push-Übersicht mehr`, !(await ev(`return !!r.querySelector('dialog.settings [data-mg-all-zone], dialog.settings [data-set^="magic-"]')`)));
    await tap('dialog.settings .dlg-actions [data-set="close"]');
    await wait(`return !r.querySelector("dialog.settings").open`);
    await p.waitForTimeout(400);

    // Die App öffnet das eigene Fenster (über den Launcher: launcher-e2e)
    await ev(`r.host._openMagicAll()`);
    check(`[${tag}] Fenster "Magic Push" mit Titel und Untertitel`, await wait(`const d=r.querySelector("dialog.mgall-dlg"); return d?.open && d.querySelector("h2")?.textContent.trim() === "Magic Push" && !!d.querySelector(".dlg-sub")`));
    check(`[${tag}] Fenster mit Knopf "Neue Meldung" unten ( seit 2.102.0; der Ablauf steht in magicadd-e2e)`, !!(await ev(`return !!r.querySelector('dialog.mgall-dlg .dlg-addbar .mg-add[data-mga="magic-add"]')`)));

    check(`[${tag}] Reiter zeigt Hinweis und Zahl`, await wait(`const t=r.querySelector('${body}')?.textContent || ""; return t.includes(${JSON.stringify(T.intro)}) && t.includes(${JSON.stringify(T.count)})`), await text(body));
    const heads = await ev(`return [...r.querySelectorAll('${body} .mg-dhead .mg-t b')].map(x => x.textContent.trim()).join("|")`);
    check(`[${tag}] nach Gerät gruppiert: Steckdose Terrasse, Stromzähler`, heads === "Steckdose Terrasse|Stromzähler", heads);
    check(`[${tag}] Gerätekopf nennt Bereich und Integration`, (await text(`${body} .mg-dhead small`)).includes("Terrasse"));
    check(`[${tag}] drei Karten, die ausgeschaltete ist abgesetzt`, (await cards()) === 3 && (await ev(`return r.querySelectorAll('${body} .mg-card.off').length`)) === 1);
    check(`[${tag}] Satz: Entität, Bedingung, Dauer`, (await ev(`return [...r.querySelectorAll('${body} .mg-card .mg-t small:first-of-type')].map(x => x.textContent).join(" | ")`)).includes("12") && (await ev(`return [...r.querySelectorAll('${body} .mg-card .mg-t small:first-of-type')].some(x => x.textContent.includes("Absolute Feuchte berechnet"))`)));
    check(`[${tag}] freie Entität ist gekennzeichnet`, (await ev(`return [...r.querySelectorAll('${body} .mg-card')].filter(c => c.querySelector(".mg-freetag")).map(c => c.querySelector("b").textContent).join()`)) === "Feuchte hoch");
    check(`[${tag}] Rücksetzwert im Satz`, (await ev(`return [...r.querySelectorAll('${body} .mg-card')].some(c => c.textContent.includes("Fenster offen") && /(zurück bei|back at)/.test(c.textContent))`)));
    check(`[${tag}] keine Möglichkeit, hier eine neue Meldung anzulegen`, !(await ev(`return !!r.querySelector('${body} [data-mg="add"]') || !![...r.querySelectorAll('${body} button')].some(b => /Neue Meldung|New message/.test(b.textContent))`)));
    check(`[${tag}] ohne Querscrollen`, (await ev(`const d=r.querySelector("dialog.mgall-dlg .dlg-body"); return d.scrollWidth - d.clientWidth`)) <= 0);
    await p.screenshot({ path: `${outDir}/magicall-${tag.replace("/", "-")}.png` });

    // Ein- und Ausschalten
    await tap(`${body} input[data-mga="magic-toggle"][data-id="r00000000001"]`);
    check(`[${tag}] Ausschalten: Server und Karte`, await wait(`return r.querySelectorAll('${body} .mg-card.off').length === 2`) && (await calls("magic_enable")).at(-1)?.enabled === false);
    await tap(`${body} input[data-mga="magic-toggle"][data-id="r00000000003"]`);
    check(`[${tag}] Einschalten`, await wait(`return r.querySelectorAll('${body} .mg-card.off').length === 1`) && (await calls("magic_enable")).at(-1)?.enabled === true);

    // Löschen mit Rückfrage
    await tap(`${body} [data-mga="magic-delete"][data-id="r00000000001"]`);
    check(`[${tag}] Löschen fragt nach`, await wait(`return r.querySelector('${body} .mg-confirm b')?.textContent.includes(${JSON.stringify(T.deleteAsk)})`));
    await tap(`${body} [data-mga="magic-delete-no"]`);
    check(`[${tag}] Abbrechen löscht nichts`, (await cards()) === 3 && (await calls("magic_delete")).length === 0);
    await tap(`${body} [data-mga="magic-delete"][data-id="r00000000001"]`);
    await tap(`${body} [data-mga="magic-delete-yes"]`);
    check(`[${tag}] gelöscht: Karte weg, Zahl nachgeführt, Hinweis`, await wait(`const t=r.querySelector('${body}').textContent; return r.querySelectorAll('${body} .mg-card').length === 2 && t.includes(${JSON.stringify(T.count2)}) && t.includes(${JSON.stringify(T.deleted)})`) && (await calls("magic_delete")).length === 1);

    // Bearbeiten (seit 2.11.0): direkt das Fenster des Assistenten, ohne das Popup des Geräts dahinter
    const W = "dialog.magic-dlg";
    await tap(`${body} [data-mga="magic-edit"][data-id="r00000000002"]`);
    check(`[${tag}] Bearbeiten öffnet das Fenster des Assistenten, kein Geräte-Popup, Fenster Magic Push dahinter offen`, await wait(`return r.querySelector("${W}")?.open && !r.querySelector("dialog.device").open && r.querySelector("dialog.mgall-dlg").open && r.querySelector('${W} .mgw-t')?.textContent.includes("Steckdose Terrasse")`));
    check(`[${tag}] Assistent mit dieser Meldung (freie Entität gewählt)`, await wait(`return r.querySelector('${W} .mg-big')?.textContent.trim() === ${JSON.stringify(T.q1b)} && (r.querySelector('${W} .mg-lcard.open')?.textContent || "").includes("Absolute Feuchte berechnet")`));
    // Schliessen ohne Änderung: sofort zu, Einstellungen bleiben
    await tap(`${W} [data-mg="close"]`);
    check(`[${tag}] Schliessen ohne Änderung: Fenster zu, Magic Push offen, Zustand zurückgesetzt`, await wait(`return !r.querySelector("${W}").open && r.querySelector("dialog.mgall-dlg").open && r.host._magic.deviceId === null`));
    await tap(`${body} [data-mga="magic-edit"][data-id="r00000000002"]`);
    await wait(`return r.querySelector("${W}")?.open && !!r.querySelector('${W} .mg-lcard.open')`);
    await tap(`${W} button.mg-stp[data-step="5"]`);
    await wait(`return !!r.querySelector('${W} input[data-mg="name"]')`);
    const fill = async (sel, value) => { const h = await handle(sel); await h.fill(value); };
    await p.evaluate(() => { window.__wsCalls = []; });
    await fill(`${W} input[data-mg="name"]`, "Feuchte zu hoch");
    await tap(`${W} [data-mg="save"]`);
    const saved = (await calls("magic_save")).at(-1)?.rule;
    check(`[${tag}] Änderung gespeichert (dieselbe Meldung)`, saved?.id === "r00000000002" && saved.name === "Feuchte zu hoch", JSON.stringify(saved));
    check(`[${tag}] Gespeichert: Fenster zu, Übersicht lädt neu und zeigt den neuen Namen, Fenster offen`, await wait(`return !r.querySelector("${W}").open && r.querySelector('${body}')?.textContent.includes("Feuchte zu hoch") && r.querySelector("dialog.mgall-dlg").open`) && (await calls("magic_list")).length >= 1);
    // Laden der Meldungen des Geräts schlägt fehl: Fehler in der Übersicht, kein leeres Fenster
    await p.evaluate(() => { window.__magicLoadFails = "Verbindung weg"; });
    await tap(`${body} [data-mga="magic-edit"][data-id="r00000000002"]`);
    check(`[${tag}] Laden fehlgeschlagen: Fehler in der Übersicht, kein Fenster`, await wait(`return !r.querySelector("${W}").open && r.querySelector('${body} .dlg-error')?.textContent.includes("Verbindung weg")`));
    await p.evaluate(() => { window.__magicLoadFails = null; });

    // Gerätekopf: Popup mit der Liste des Geräts
    await tap(`${body} [data-mga="magic-device"][data-device="h"]`);
    check(`[${tag}] Gerätekopf öffnet das Popup im Reiter Magic Push (Liste, kein Assistent)`, await wait(`const d=r.querySelector("dialog.device"); return d?.open && !!r.querySelector('.mg-root .mg-card') && !r.querySelector('.mg-root .mg-stephead')`));
    await ev(`r.host._closeDevice()`);

    // Struktur, Suche und Filter (2.13.0, docs/mockups/magic-overview-v1, Variante B)
    // Das "close" des eben geschlossenen Popups nimmt auf dem Handy den Fokus (_blurOnTouch): erst abwarten, dann tippen
    await p.waitForTimeout(500);
    const reload = async (rules) => {
      await p.evaluate((r) => { window.__magic.rules = r; }, rules);
      await ev(`r.host._closeMagicAll(); r.host._openMagicAll()`);
      await wait(`return r.querySelectorAll('${body} .mg-dhead').length > 0`);
    };
    const nOf = (n, total) => (lang === "de" ? `${n} von ${total}` : `${n} of ${total}`);
    const base = [
      RULE("r00000000001", "d", "Keller kalt", "sensor.temp", { __active: true }),
      RULE("r00000000002", "d", "Feuchte hoch", "sensor.abs_humidity", { kind: "above", value: 10, critical: true, critical_volume: 7 }),
      RULE("r00000000003", "h", "Fenster offen", "binary_sensor.window", { kind: "is", value: "on", for_s: 2700, reset_value: "off", enabled: false }),
    ];
    await reload(base);
    const input = `${body} input[data-lsearch="magic"]`;
    // Tippen mit Wiederholung: der Neuaufbau der Einstellungen kann das Feld zwischen Greifen und Tippen ersetzen
    const type = async (sel, value) => {
      for (let i = 0; ; i++) {
        try { const h = await handle(sel); await h.fill(value); return; }
        catch (err) { if (i >= 3 || !/not attached|detached/.test(String(err))) throw err; await new Promise((r) => setTimeout(r, 150)); }
      }
    };
    const waitNames = (names) => wait(`return [...r.querySelectorAll('${body} .mg-card .mg-t b')].map(b => b.textContent.trim()).sort().join("|") === ${JSON.stringify(names)}`);
    const cardNames = () => ev(`return [...r.querySelectorAll('${body} .mg-card .mg-t b')].map(b => b.textContent.trim()).sort().join("|")`);
    check(`[${tag}] Suchfeld und vier Filter mit Zahlen (Alle 3, An 2, Aus 1, Ausgelöst 1)`, !!(await handle(input)) && (await ev(`return [...r.querySelectorAll('${body} .mg-filter .sub-tab .tab-s')].map(x => x.textContent.trim()).join()`)) === "3,2,1,1" && (await ev(`return r.querySelectorAll('${body} .mg-filter .sub-tab').length`)) === 4);
    check(`[${tag}] Filter ist eine Reiterleiste mit Kapsel, "Alle" gewählt`, await wait(`return !!r.querySelector('${body} .mg-filter > .seg-pill') && r.querySelector('${body} .mg-filter .sub-tab.on')?.dataset.v === "all"`));
    check(`[${tag}] Gerätekarten: pro Gerät ein Kopf mit Zahl der Meldungen`, (await ev(`return [...r.querySelectorAll('${body} .mg-dhead')].map(h => h.dataset.device + ":" + h.querySelector(".mg-badge").textContent).join()`)) === "d:2,h:1");
    // Suche: Name, Gerät, Satz; mehrere Wörter; Fokus bleibt, Zahl "n von m", X
    await type(input, "feuchte");
    check(`[${tag}] Suche "feuchte": eine Meldung, "${nOf(1, 3)}", Fokus bleibt im Feld`, await wait(`return r.querySelectorAll('${body} .mg-card').length === 1 && r.querySelector('${body} .list-search .n').textContent.trim() === ${JSON.stringify(nOf(1, 3))} && r.activeElement === r.querySelector('${input}')`), await ev(`return [r.querySelectorAll('${body} .mg-card').length, r.querySelector('${body} .list-search .n').textContent, String(r.activeElement?.tagName), [...r.querySelectorAll("dialog[open]")].map(d => d.className).join("+"), String(document.activeElement?.tagName)].join(" / ")`));
    await type(input, "stromzähler");
    check(`[${tag}] Suche nach dem Gerät findet dessen Meldung`, await waitNames("Fenster offen"), await cardNames());
    await type(input, lang === "de" ? "kritisch" : "critical");
    check(`[${tag}] Suche im Satz ("kritisch")`, await waitNames("Feuchte hoch"), await cardNames());
    await type(input, "temperatur 12");
    check(`[${tag}] mehrere Wörter müssen alle vorkommen`, await waitNames("Keller kalt"), await cardNames());
    await type(input, "xyzxyz");
    check(`[${tag}] ohne Treffer: Hinweis, keine Karte, "${nOf(0, 3)}"`, await wait(`return r.querySelectorAll('${body} .mg-dcard').length === 0 && !!r.querySelector('${body} .mg-none') && r.querySelector('${body} .list-search .n').textContent.trim() === ${JSON.stringify(nOf(0, 3))}`));
    await tap(`${body} [data-mga-clear]`);
    check(`[${tag}] X leert die Suche: alle drei wieder da`, await wait(`return r.querySelectorAll('${body} .mg-card').length === 3 && r.querySelector('${input}').value === ""`));
    // Filter
    await tap(`${body} .mg-filter [data-v="off"]`);
    check(`[${tag}] Filter "Aus": nur die ausgeschaltete`, await waitNames("Fenster offen"), await cardNames());
    await tap(`${body} .mg-filter [data-v="fired"]`);
    check(`[${tag}] Filter "Ausgelöst": nur die, deren Bedingung gerade gilt`, await waitNames("Keller kalt"), await cardNames());
    await tap(`${body} .mg-filter [data-v="on"]`);
    check(`[${tag}] Filter "An": zwei`, await wait(`return r.querySelectorAll('${body} .mg-card').length === 2`));
    check(`[${tag}] Zahlen im Filter bleiben, auch wenn gefiltert wird`, (await ev(`return [...r.querySelectorAll('${body} .mg-filter .sub-tab .tab-s')].map(x => x.textContent.trim()).join()`)) === "3,2,1,1");
    await tap(`${body} .mg-filter [data-v="all"]`);
    await wait(`return r.querySelectorAll('${body} .mg-card').length === 3`);
    // Karten ein- und ausklappen
    await tap(`${body} .mg-dhead[data-device="d"]`);
    check(`[${tag}] Kopf antippen klappt die Karte zu: Kurzfassung statt Meldungen`, await wait(`const h=r.querySelector('${body} .mg-dhead[data-device="d"]'); return h.getAttribute("aria-expanded") === "false" && r.querySelectorAll('${body} .mg-card').length === 1 && /(2 Meldungen|2 messages)/.test(h.textContent) && /(ausgelöst|triggered)/.test(h.textContent)`));
    await tap(`${body} .mg-dhead[data-device="d"]`);
    check(`[${tag}] nochmals antippen klappt auf`, await wait(`return r.querySelector('${body} .mg-dhead[data-device="d"]').getAttribute("aria-expanded") === "true" && r.querySelectorAll('${body} .mg-card').length === 3`));
    await tap(`${body} [data-mga="magic-fold-all"]`);
    check(`[${tag}] "Alle einklappen": alle zu, Knopf heisst nun "Alle ausklappen"`, await wait(`return [...r.querySelectorAll('${body} .mg-dhead')].every(h => h.getAttribute("aria-expanded") === "false") && /(Alle ausklappen|Expand all)/.test(r.querySelector('${body} [data-mga="magic-fold-all"]').textContent)`));
    // Suche klappt Treffer auf, auch wenn die Karte zu war; ohne Suche ist sie wieder zu
    await type(input, "feuchte");
    check(`[${tag}] Suche klappt die Treffer auf`, await wait(`return r.querySelector('${body} .mg-dhead[data-device="d"]').getAttribute("aria-expanded") === "true" && r.querySelectorAll('${body} .mg-card').length === 1`));
    await tap(`${body} [data-mga-clear]`);
    check(`[${tag}] ohne Suche ist die Karte wieder zu (Zustand gemerkt)`, await wait(`return [...r.querySelectorAll('${body} .mg-dhead')].every(h => h.getAttribute("aria-expanded") === "false")`));
    await tap(`${body} [data-mga="magic-fold-all"]`);
    await wait(`return r.querySelectorAll('${body} .mg-card').length === 3`);
    // Mehr als drei Geräte: zu Beginn alle zu (Überblick), Kurzfassung zeigt "aus" und "ausgelöst"
    const others = await ev(`return r.host._devices.map(d => d.id).filter(id => id !== "d" && id !== "h").slice(0, 4)`);
    await reload([...base, ...others.map((id, i) => RULE(`r0000000001${i}`, id, ["Alpha", "Beta", "Gamma", "Delta"][i], "sensor.temp"))]);
    check(`[${tag}] mehr als drei Geräte: alle Karten zu, Karten gezählt`, (await ev(`return [...r.querySelectorAll('${body} .mg-dhead')].every(h => h.getAttribute("aria-expanded") === "false") && r.querySelectorAll('${body} .mg-card').length === 0`)) && (await ev(`return r.querySelectorAll('${body} .mg-dhead').length`)) === 2 + others.length);
    check(`[${tag}] zu: Kurzfassung mit "aus" und "ausgelöst"`, await ev(`const h=r.querySelector('${body} .mg-dhead[data-device="h"]'); const d=r.querySelector('${body} .mg-dhead[data-device="d"]'); return /(1 aus|1 off)/.test(h.textContent) && /(1 ausgelöst|1 triggered)/.test(d.textContent)`));
    await type(input, "gamma");
    check(`[${tag}] Suche in zugeklappten Karten: Treffer aufgeklappt`, (await waitNames("Gamma")) && (await ev(`return r.querySelectorAll('${body} .mg-dhead').length`)) === 1, await cardNames());
    // Suche getippt, Fenster geschlossen und neu geöffnet: Suche ist leer, die Liste vollständig (nicht die alte Trefferliste)
    await tap('dialog.mgall-dlg [data-mga-close]');
    await wait(`return !r.querySelector("dialog.mgall-dlg").open`);
    await p.waitForTimeout(400);
    await ev(`r.host._openMagicAll()`);
    await wait(`return !!r.querySelector('${input}')`);
    check(`[${tag}] Fenster neu geöffnet nach einer Suche: Feld leer, alle Karten wieder da`, await wait(`return r.querySelector('${input}').value === "" && r.querySelectorAll('${body} .mg-dhead').length > 1`), await ev(`return r.querySelector('${input}').value + "|" + r.querySelectorAll('${body} .mg-dhead').length`));
    // "Gerät öffnen" in der aufgeklappten Karte
    await tap(`${body} .mg-dhead[data-device="h"]`);
    await tap(`${body} [data-mga="magic-device"][data-device="h"]`);
    check(`[${tag}] "Gerät öffnen" zeigt das Popup im Reiter Magic Push`, await wait(`return r.querySelector("dialog.device")?.open && !!r.querySelector('.sub-tab[data-tab="magic"].on')`));
    await ev(`r.host._closeDevice()`);
    check(`[${tag}] Übersicht ohne Querscrollen (viele Karten)`, (await ev(`const d=r.querySelector("dialog.mgall-dlg .dlg-body"); return d.scrollWidth - d.clientWidth`)) <= 0);
    await p.screenshot({ path: `${outDir}/magicall-${tag.replace("/", "-")}-many.png` });

    // Mehrere Bedingungen (2.15.0): die Übersicht nennt den ganzen Satz mit Gruppe in Klammern
    const multi = RULE("r00000000099", "d", "Zwei Bedingungen", "sensor.temp", { conditions: { op: "and", items: [
      { entity_id: "sensor.temp", kind: "below", value: 12, reset_value: null },
      { op: "or", items: [{ entity_id: "binary_sensor.window", kind: "is", value: "on", reset_value: null }, { entity_id: "sensor.humidity", kind: "above", value: 60, reset_value: null }] },
    ] } });
    await reload([multi]);
    const sentence = await text(`${body} .mg-card .mg-t small`);
    check(`[${tag}] Übersicht: Satz mit allen Bedingungen und Klammer um die Gruppe`, /Temperatur .*12.* (und|and) \(.*Fenster.* (oder|or) Luftfeuchtigkeit.*60.*\)/.test(sentence), sentence);

    // Leer, Fehler
    await p.evaluate(() => { window.__magic.rules = []; });
    await ev(`r.host._closeMagicAll(); r.host._openMagicAll()`);
    check(`[${tag}] ohne Meldungen: Hinweis, wo man sie anlegt`, await wait(`return r.querySelector('${body}')?.textContent.includes(${JSON.stringify(T.empty)})`));
    await p.evaluate(() => { window.__magicListFails = "Verbindung weg"; });
    await ev(`r.host._closeMagicAll(); r.host._openMagicAll()`);
    check(`[${tag}] Laden schlägt fehl: Fehler und Wiederholen`, await wait(`return r.querySelector('${body} .dlg-error')?.textContent.includes(${JSON.stringify(T.err)}) && !!r.querySelector('${body} [data-mga="magic-reload"]')`));
    await p.evaluate(() => { window.__magicListFails = null; });
    await tap(`${body} [data-mga="magic-reload"]`);
    check(`[${tag}] Wiederholen klappt`, await wait(`return r.querySelector('${body}')?.textContent.includes(${JSON.stringify(T.empty)}) && !r.querySelector('${body} .dlg-error')`));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
