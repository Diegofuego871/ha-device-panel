// Routinen-Schaltoptionen (2.52.0): eigene Seite "Optionen" nach "Was schalten", nur wenn die Entität etwas einstellen lässt; Vorschau,
// Regler, Farben, "Jetzt ausführen" mit Optionen, Rückstellung "Aus" oder "Wie vorher". Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { step: (n, t) => `Schritt ${n} von ${t}`, name: "Optionen", q: "Was soll eingestellt werden?", keep: "Wie zuletzt", warm: "warmweiss", blue: "Blau", restore: "Wie vorher", off: "Ausschalten", nothing: "Nichts eingestellt: wie zuletzt", cover: "teilweise offen", heat: "Heizen", sentRestore: "wieder wie vorher", pos: "auf 50 % fahren" },
  en: { step: (n, t) => `Step ${n} of ${t}`, name: "Options", q: "What should be set?", keep: "As last used", warm: "warm white", blue: "Blue", restore: "As before", off: "Turn off", nothing: "Nothing set: as last used", cover: "partly open", heat: "Heat", sentRestore: "back as before", pos: "move to 50 %" },
};
const ENTS = [
  { entity_id: "switch.plug", name: "Plug", domain: "switch", state: "on", available: true, actions: ["on", "off", "toggle"], options: [] },
  { entity_id: "light.hue", name: "Hue Lamp", domain: "light", state: "off", available: true, actions: ["on", "off", "toggle"], options: [{ key: "brightness_pct", type: "percent", min: 1, max: 100 }, { key: "color_temp_kelvin", type: "kelvin", min: 2000, max: 6500 }, { key: "rgb_color", type: "colour" }] },
  { entity_id: "cover.rollo", name: "Rollo", domain: "cover", state: "closed", available: true, actions: ["on", "off", "toggle"], options: [{ key: "position", type: "percent", min: 0, max: 100 }] },
  { entity_id: "climate.heater", name: "Heater", domain: "climate", state: "off", available: true, actions: ["on", "off", "toggle"], options: [{ key: "temperature", type: "temperature", unit: "°C", step: 0.5, min: 16, max: 28 }, { key: "hvac_mode", type: "choice", values: ["heat", "cool"] }] },
  { entity_id: "media_player.radio", name: "Radio", domain: "media_player", state: "off", available: true, actions: ["on", "off", "toggle"], options: [{ key: "volume_pct", type: "percent", min: 0, max: 100 }] },
  { entity_id: "fan.vent", name: "Vent", domain: "fan", state: "off", available: true, actions: ["on", "off", "toggle"], options: [{ key: "percentage", type: "percent", min: 1, max: 100 }] },
];

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
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
    const calls = (type) => p.evaluate((ty) => window.__wsCalls.filter((m) => m.type === ty), type);
    const win = "dialog.routine-dlg";
    const text = (sel) => ev(`return r.querySelector(${JSON.stringify(sel)})?.textContent.trim() ?? null`);
    // Erst im Wizard klicken, wenn die Entitäten mit Optionen da sind: der Simulator liefert sie für jedes Gerät
    await p.evaluate((ents) => { window.__routineEntities = Object.fromEntries(window.__devices.map((d) => [d.id, ents])); }, ENTS);

    const openWizard = async () => {
      await tap(".toolbar .rtall-btn");
      await wait(`return r.querySelector("dialog.rtall-dlg")?.open`);
      await tap('dialog.rtall-dlg [data-rta="routine-add"]');
      await wait(`return r.querySelectorAll('${win} [data-rt="dev"]').length > 0`);
      await tap(`${win} [data-rt="dev"]`);
      await tap(`${win} [data-rt="nav-next"]`);
      await wait(`return r.querySelectorAll('${win} [data-rt="pick"]').length === ${ENTS.length}`);
    };
    const pickEntity = async (id) => { await tap(`${win} [data-rt="pick"][data-id="${id}"]`); };
    const stepText = () => text(`${win} .mg-stephead span`);

    await openWizard();
    // Entität ohne Optionen: vier Schritte (plus Gerät)
    await pickEntity("switch.plug");
    check(`[${tag}] Steckdose ohne Optionen: Schritt 2 von 6, keine Seite "Optionen"`, (await stepText()) === T.step(2, 6));
    await tap(`${win} [data-rt="nav-next"]`);
    check(`[${tag}] Weiter führt direkt zu "Wann" (Schritt 3 von 6)`, await wait(`return r.querySelector('${win} .mg-stephead span').textContent === ${JSON.stringify(T.step(3, 6))}`));
    await tap(`${win} [data-rt="nav-back"]`);

    // Licht: eine Seite mehr
    await pickEntity("light.hue");
    check(`[${tag}] Licht: sieben Schritte (Schritt 2 von 7)`, (await stepText()) === T.step(2, 7) && (await ev(`return r.querySelectorAll('${win} .mg-stp').length`)) === 7);
    check(`[${tag}] Schritt "Was schalten" zeigt keine Regler`, await ev(`return !r.querySelector('${win} .to-range, ${win} .to-prev')`));
    // Aktion Ausschalten: keine Optionen mehr
    await tap(`${win} [data-rt="action"][data-v="off"]`);
    check(`[${tag}] Aktion "Ausschalten": die Seite entfällt (Schritt 2 von 6)`, (await stepText()) === T.step(2, 6));
    await tap(`${win} [data-rt="action"][data-v="on"]`);
    check(`[${tag}] Aktion "Einschalten": die Seite ist wieder da (Schritt 2 von 7)`, (await stepText()) === T.step(2, 7));

    await tap(`${win} [data-rt="nav-next"]`);
    check(`[${tag}] Weiter: Seite "${T.name}" als Schritt 3 von 7 mit der Frage "${T.q}"`, await wait(`const d = r.querySelector("${win}"); return d.querySelector(".mg-stephead").textContent.includes(${JSON.stringify(T.step(3, 7))}) && d.querySelector(".mg-stephead").textContent.includes(${JSON.stringify(T.name)}) && d.querySelector(".mg-big").textContent === ${JSON.stringify(T.q)}`));
    check(`[${tag}] Vorschau-Lampe aus mit Hinweis "${T.nothing}", drei Regler (Helligkeit, Farbtemperatur, Farbe)`, await ev(`const d = r.querySelector("${win}"); return d.querySelector(".to-prev.off small").textContent === ${JSON.stringify(T.nothing)} && d.querySelectorAll(".to-range").length === 2 && d.querySelectorAll(".to-cols").length === 1`));
    check(`[${tag}] Wert neben der Überschrift: "${T.keep}"`, (await text(`${win} [data-rt-val="brightness_pct"]`)) === T.keep);
    check(`[${tag}] Reiterleiste "${T.keep}" gewählt, Kapsel vorhanden`, await ev(`const bar = r.querySelector('${win} [data-k="brightness_pct"][data-rt="optq"]').closest(".sub-tabs"); return bar.querySelector(".sub-tab.on")?.dataset.v === "" && !!bar.querySelector(".seg-pill")`));

    // Regler mit der Maus/dem Finger auf etwa 70 %
    const range = await handle(`${win} [data-rt="opt"][data-k="brightness_pct"]`);
    await range.scrollIntoViewIfNeeded();
    const box = await range.boundingBox();
    const x = box.x + box.width * 0.7;
    const y = box.y + box.height / 2;
    if (mobile) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y);
    await wait(`return r.querySelector('${win} [data-rt="opt"][data-k="brightness_pct"]').value !== "50"`);
    const bright = Number(await ev(`return r.querySelector('${win} [data-rt="opt"][data-k="brightness_pct"]').value`));
    check(`[${tag}] Regler angetippt: Wert um 70 (${bright}), Anzeige und Vorschau zeigen "${bright} %", Lampe leuchtet`, bright >= 60 && bright <= 80 && (await text(`${win} [data-rt-val="brightness_pct"]`)) === `${bright} %` && (await text(`${win} .to-prev b`)) === `${bright} %` && (await ev(`return !r.querySelector('${win} .to-prev').classList.contains("off") && parseFloat(getComputedStyle(r.querySelector('${win} .to-prev .big'), "::before").opacity) > 0.2`)));
    await tap(`${win} [data-rt="optq"][data-k="brightness_pct"][data-v="50"]`);
    check(`[${tag}] Schnellwahl "50 %": Regler 50, Reiter gewählt, Vorschau "50 %"`, await wait(`const d = r.querySelector("${win}"); return d.querySelector('[data-rt="opt"][data-k="brightness_pct"]').value === "50" && d.querySelector('[data-rt="optq"][data-k="brightness_pct"].on')?.dataset.v === "50" && d.querySelector(".to-prev b").textContent === "50 %"`));
    await tap(`${win} [data-rt="optq"][data-k="color_temp_kelvin"][data-v="2700"]`);
    check(`[${tag}] Schnellwahl "Warm": 2700 K, Vorschau nennt "${T.warm}"`, await wait(`const d = r.querySelector("${win}"); return d.querySelector('[data-rt-val="color_temp_kelvin"]').textContent === "2700 K" && d.querySelector(".to-prev small").textContent.includes(${JSON.stringify(T.warm)})`));
    await tap(`${win} [data-rt="optcol"][aria-label="${T.blue}"]`);
    check(`[${tag}] Farbe "${T.blue}": Wert, Vorschau; die Farbtemperatur ist gelöscht ("–")`, await wait(`const d = r.querySelector("${win}"); return d.querySelector('[data-rt-val="rgb_color"]').textContent === ${JSON.stringify(T.blue)} && d.querySelector('[data-rt-val="color_temp_kelvin"]').textContent === "–" && d.querySelector(".to-prev small").textContent === ${JSON.stringify(T.blue)}`));
    await tap(`${win} [data-rt="optcol"][data-v=""]`);
    check(`[${tag}] "${T.keep}" bei den Farben löscht Farbe und Farbtemperatur`, await wait(`const d = r.querySelector("${win}"); return d.querySelector('[data-rt-val="rgb_color"]').textContent === ${JSON.stringify(T.keep)} && d.querySelector('[data-rt-val="color_temp_kelvin"]').textContent === ${JSON.stringify(T.keep)}`));
    await tap(`${win} [data-rt="optq"][data-k="color_temp_kelvin"][data-v="2700"]`);
    await p.screenshot({ path: `${outDir}/routineopts-${tag.replace("/", "-")}-light.png` });

    // Jetzt ausführen mit den Optionen
    await tap(`${win} [data-rt="try"]`);
    await wait(`return r.querySelector('${win} .mg-testrow .opt-short')`);
    const tries = await p.evaluate(() => window.__routines?.tries || []);
    check(`[${tag}] "Jetzt ausführen" schickt die Optionen mit (50 %, 2700 K)`, tries.length === 1 && tries[0].action === "on" && JSON.stringify(tries[0].options) === JSON.stringify({ brightness_pct: 50, color_temp_kelvin: 2700 }), JSON.stringify(tries));
    check(`[${tag}] Ergebnis-Satz nennt die Einstellung`, (await text(`${win} .rt-result`)).includes("50 %") && (await text(`${win} .rt-result`)).includes(T.warm));

    // Weiter zur Seite "Zurückschalten" (Optionen → Wann → Zurückschalten): Rückstellung wählbar
    await tap(`${win} [data-rt="nav-next"]`);
    await tap(`${win} [data-rt="nav-next"]`);
    await wait(`return r.querySelectorAll('${win} [data-rt="backkind"]').length === 4`);
    check(`[${tag}] Ohne Zurückschalten gibt es die Wahl der Rückstellung nicht`, await ev(`return !r.querySelector('${win} [data-rt="bmode"]')`));
    await tap(`${win} [data-rt="backkind"][data-v="duration"]`);
    await tap(`${win} [data-rt="bdur"][data-s="600"]`);
    check(`[${tag}] Mit Zurückschalten: Reiter "${T.off}" und "${T.restore}", Standard "${T.off}"`, await ev(`const tabs = [...r.querySelectorAll('${win} [data-rt="bmode"]')]; return tabs.length === 2 && tabs[0].textContent.trim() === ${JSON.stringify(T.off)} && tabs[0].classList.contains("on") && tabs[1].textContent.trim() === ${JSON.stringify(T.restore)}`));
    await tap(`${win} [data-rt="bmode"][data-v="restore"]`);
    check(`[${tag}] "${T.restore}": Satz nennt "${T.sentRestore}"`, await wait(`return r.querySelector('${win} .mg-sumline').textContent.toLowerCase().includes(${JSON.stringify(T.sentRestore.toLowerCase())})`));
    await tap(`${win} [data-rt="nav-quick"]`);
    await wait(`return !r.querySelector("${win}")?.open`);
    const saves = await calls("device_panel/routine_save");
    const sent = saves.at(-1)?.routine || {};
    check(`[${tag}] Speichern: options, back_mode "restore" und back_s im Entwurf`, saves.length === 1 && JSON.stringify(sent.options) === JSON.stringify({ brightness_pct: 50, color_temp_kelvin: 2700 }) && sent.back_mode === "restore" && sent.back_s === 600 && sent.entity_id === "light.hue", JSON.stringify(sent));
    await wait(`return r.querySelector("dialog.rtall-dlg [data-rta='routine-edit']")`);
    check(`[${tag}] Liste nennt Einstellung und Rückstellung`, await ev(`const t = r.querySelector("dialog.rtall-dlg .mg-card .mg-t small").textContent; return t.includes("50 %") && t.includes(${JSON.stringify(T.sentRestore)})`), await text("dialog.rtall-dlg .mg-card .mg-t small"));

    // Bearbeiten: Werte bleiben, "Zurück" von "Wann" führt zur Seite Optionen
    await tap('dialog.rtall-dlg [data-rta="routine-edit"]');
    await wait(`return r.querySelector("${win}")?.open`);
    await tap(`${win} [data-rt="nav-back"]`);
    check(`[${tag}] Bearbeiten, Zurück von "Wann": Seite "${T.name}" mit den gespeicherten Werten`, await wait(`const d = r.querySelector("${win}"); return d.querySelector('[data-rt="opt"][data-k="brightness_pct"]')?.value === "50" && d.querySelector('[data-rt-val="color_temp_kelvin"]').textContent === "2700 K"`));
    await tap(`${win} [data-rt="close"]`);
    await wait(`return !r.querySelector("${win}")?.open`);

    // Weitere Arten: Rollladen, Klima, Medien, Ventilator
    await tap('dialog.rtall-dlg [data-rta="routine-add"]');
    await wait(`return r.querySelectorAll('${win} [data-rt="dev"]').length > 0`);
    await tap(`${win} [data-rt="dev"]`);
    await tap(`${win} [data-rt="nav-next"]`);
    await wait(`return r.querySelectorAll('${win} [data-rt="pick"]').length === ${ENTS.length}`);
    await pickEntity("cover.rollo");
    await tap(`${win} [data-rt="nav-next"]`);
    await wait(`return r.querySelector('${win} .to-prev')`);
    await tap(`${win} [data-rt="optq"][data-k="position"][data-v="50"]`);
    check(`[${tag}] Rollladen: Position 50 %, Vorschau "${T.cover}"`, await wait(`const d = r.querySelector("${win}"); return d.querySelector(".to-prev b").textContent === "50 %" && d.querySelector(".to-prev small").textContent === ${JSON.stringify(T.cover)} && !!d.querySelector(".to-shade")`));
    check(`[${tag}] Rollladen: Ergebnis "${T.pos}"`, (await text(`${win} .rt-result`)).includes(T.pos), await text(`${win} .rt-result`));
    await tap(`${win} [data-rt="nav-back"]`);
    await pickEntity("climate.heater");
    await tap(`${win} [data-rt="nav-next"]`);
    await wait(`return r.querySelector('${win} .to-prev .to-temp')`);
    const tempTabs = await ev(`return [...r.querySelectorAll('${win} [data-rt="optq"][data-k="temperature"]')].map((x) => x.dataset.v).join(",")`);
    check(`[${tag}] Klima: Temperatur-Schnellwahl innerhalb 16 bis 28 (${tempTabs})`, tempTabs.split(",").length === 4 && tempTabs.split(",").slice(1).every((v) => Number(v) >= 16 && Number(v) <= 28));
    await tap(`${win} [data-rt="optq"][data-k="hvac_mode"][data-v="heat"]`);
    await tap(`${win} [data-rt="optq"][data-k="temperature"]:nth-child(3)`);
    check(`[${tag}] Klima: Modus "${T.heat}" und Temperatur gewählt, Vorschau zeigt die Temperatur gross`, await wait(`const d = r.querySelector("${win}"); return d.querySelector('[data-rt-val="hvac_mode"]').textContent === ${JSON.stringify(T.heat)} && /°$/.test(d.querySelector(".to-temp").textContent) && d.querySelector(".to-prev small").textContent === ${JSON.stringify(T.heat)}`));
    await tap(`${win} [data-rt="nav-back"]`);
    for (const [id, key] of [["media_player.radio", "volume_pct"], ["fan.vent", "percentage"]]) {
      await pickEntity(id);
      await tap(`${win} [data-rt="nav-next"]`);
      await wait(`return r.querySelector('${win} [data-rt="opt"][data-k="${key}"]')`);
      await tap(`${win} [data-rt="optq"][data-k="${key}"][data-v="50"]`);
      check(`[${tag}] ${id}: Regler und Vorschau "50 %"`, await wait(`const d = r.querySelector("${win}"); return d.querySelector(".to-prev b").textContent === "50 %" && d.querySelector('[data-rt="opt"][data-k="${key}"]').value === "50"`));
      await tap(`${win} [data-rt="nav-back"]`);
    }
    // Wechsel der Entität löscht die Optionen
    await pickEntity("light.hue");
    await tap(`${win} [data-rt="nav-next"]`);
    check(`[${tag}] Andere Entität gewählt: Optionen leer ("${T.nothing}")`, await wait(`return r.querySelector('${win} .to-prev.off small')?.textContent === ${JSON.stringify(T.nothing)}`));
    if (mobile) {
      check(`[${tag}] Handy: kein Querlauf, Farbkreise mind. 36 px, Regler mind. 34 px hoch`, await ev(`const d = r.querySelector("${win} .mgw-main"); const dot = r.querySelector("${win} .to-col").getBoundingClientRect(); const rg = r.querySelector("${win} .to-range").getBoundingClientRect(); return d.scrollWidth <= d.clientWidth + 1 && dot.width >= 36 && dot.height >= 36 && rg.height >= 34`));
    }
    await p.screenshot({ path: `${outDir}/routineopts-${tag.replace("/", "-")}-empty.png` });
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("|"));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
