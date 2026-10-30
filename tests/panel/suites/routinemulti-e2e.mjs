// Routine mit mehreren Geräten (2.181.0): "+ Gerät hinzufügen" unter der letzten Seite eines Ziels, die Seiten wiederholen sich für das neue Gerät,
// "Danach" je Gerät auf der Seite "Zurückschalten", Anzeige bei jedem beteiligten Gerät (zugeklappt wie bisher, aufgeklappt mit den Zielen),
// Ziel entfernen. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const ENTS = {
  d: [
    { entity_id: "switch.lampe", name: "Lampe Küche", domain: "switch", state: "off", available: true, actions: ["on", "off", "toggle"] },
    { entity_id: "switch.steck", name: "Steckdose Flur", domain: "switch", state: "off", available: true, actions: ["on", "off", "toggle"] },
  ],
  e: [{ entity_id: "switch.bad", name: "Steckdose Bad", domain: "switch", state: "off", available: true, actions: ["on", "off", "toggle"] }],
};

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
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
    const W = "dialog.routine-dlg";
    await p.evaluate((e) => { window.__routineEntities = e; }, ENTS);
    // Eine zweite Routine am Gerät "e": mit zwei Routinen sind die Zeilen zugeklappt
    await p.evaluate((rt) => { (window.__routines ||= { list: [], seq: 1, runs: [], tests: [] }).list.push(rt); }, { id: "bbbbbbbbbbb1", device_id: "e", entity_id: "switch.bad", name: "Zeitschaltuhr Bad", action: "on", back_s: null, kind: "repeat", delay_s: null, date: null, time: "07:00", repeat: "daily", weekdays: null, mday: null, enabled: true, push: false, target: null, created: Date.now() / 1000 });

    // Neue Routine im Reiter des Geräts "d": Ziel 1 = Lampe
    await ev(`r.host._openDevice("d", "routine")`);
    await wait(`return !!r.querySelector('.rt-root [data-rt="add"]')`);
    await tap(`.rt-root [data-rt="add"]`);
    await wait(`return !!r.querySelector('${W} [data-rt="pick"]')`);
    check(`[${tag}] Seite "Was schalten": ohne gewähltes Ziel noch kein Knopf "+ Gerät hinzufügen"`, await ev(`return !r.querySelector('${W} [data-rt="tg-add"]')`));
    await tap(`${W} [data-rt="pick"][data-id="switch.lampe"]`);
    check(`[${tag}] Lampe gewählt: Knopf "+ Gerät hinzufügen" ist frei und steht unter dem Inhalt`, await ev(`const a = r.querySelector('${W} [data-rt="tg-add"]'); const res = r.querySelector('${W} [data-rt-zone="result"]'); return !!a && !a.disabled && !!(res.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING)`));

    // Ziel 2: wieder erste Seite (Gerät wählen), "Zurück" verwirft das Ziel
    await tap(`${W} [data-rt="tg-add"]`);
    await wait(`return !!r.querySelector('${W} [data-rt="dev"]')`);
    check(`[${tag}] Nach dem Knopf: Seite zur Geräte-Wahl, das erste Ziel steht oben als Zeile`, await ev(`const c = r.querySelectorAll('${W} .rt-card'); return c.length === 2 && !c[0].classList.contains("open") && /1 · Lampe Küche/.test(c[0].textContent) && c[1].classList.contains("open") && /2 ·/.test(c[1].querySelector(".rt-card-head").textContent)`));
    check(`[${tag}] "Zurück" heisst jetzt "Ziel verwerfen"`, await ev(`const x = r.querySelector('${W} .mgw-foot [data-rt="target-drop"]'); return !!x && x.textContent.trim() === ${JSON.stringify(lang === "de" ? "Ziel verwerfen" : "Discard target")}`));
    await tap(`${W} [data-rt="target-drop"]`);
    check(`[${tag}] Ziel verworfen: zurück bei Ziel 1, keine Zeilen mehr`, (await wait(`return !!r.querySelector('${W} [data-rt="pick"]') && r.querySelectorAll('${W} .rt-card').length === 0`)) && (await ev(`return r.querySelector('${W} [data-rt="pick"][aria-checked="true"]')?.dataset.id === "switch.lampe"`)));
    await tap(`${W} [data-rt="tg-add"]`);
    await wait(`return !!r.querySelector('${W} [data-rt="dev"]')`);
    // Dasselbe Gerät nochmals: die Lampe ist schon vergeben, die Steckdose Flur wird Ziel 2
    await tap(`${W} [data-rt="dev"][data-id="d"]`);
    await tap(`${W} [data-rt="nav-next"]`);
    await wait(`return !!r.querySelector('${W} [data-rt="pick"][data-id="switch.steck"]')`);
    check(`[${tag}] Entität schon in einem anderen Ziel: gesperrt`, await ev(`const x = r.querySelector('${W} [data-rt="pick"][data-id="switch.lampe"]'); return !!x && x.disabled`));
    await tap(`${W} [data-rt="pick"][data-id="switch.steck"]`);
    await p.screenshot({ path: `${process.env.OUT || "output"}/panel-routine-multi-${tag.replace("/", "-")}.png` });
    // Ziel 3 auf einem anderen Gerät: genau eine Entität, schon gewählt
    await tap(`${W} [data-rt="tg-add"]`);
    await wait(`return !!r.querySelector('${W} [data-rt="dev"][data-id="e"]')`);
    await tap(`${W} [data-rt="dev"][data-id="e"]`);
    await tap(`${W} [data-rt="nav-next"]`);
    check(`[${tag}] Gerät mit einer Entität: gleich gewählt, zwei Zeilen oben, Kopf "Ziel 3 von 3"`, await wait(`return r.querySelector('${W} [data-rt="pick"][data-id="switch.bad"]')?.getAttribute("aria-checked") === "true" && r.querySelectorAll('${W} .rt-card:not(.open)').length === 2 && /3 ·/.test(r.querySelector('${W} .rt-card.open .rt-card-head').textContent)`));

    // Weiter bis "Zurückschalten": nach Dauer, "Danach" je Gerät
    const stepTo = async (sel) => { for (let i = 0; i < 8 && !(await ev(`return !!r.querySelector('${sel}')`)); i++) { await tap(`${W} [data-rt="nav-next"]`); await wait(`return true`); } };
    await stepTo(`[data-rt="backkind"]`);
    await tap(`${W} [data-rt="backkind"][data-v="duration"]`);
    await tap(`${W} [data-rt="bdur"]`);
    check(`[${tag}] Seite "Zurückschalten": je Ziel eine Zeile mit Wahl "Danach"`, await ev(`return r.querySelectorAll('${W} .rt-bm').length === 3 && r.querySelectorAll('${W} .rt-bm .sub-tab').length === 6`));
    await tap(`${W} [data-rt="bmode-t"][data-i="1"][data-v="restore"]`);
    check(`[${tag}] "Wie vorher" für das zweite Ziel gewählt`, await ev(`return r.querySelector('${W} [data-rt="bmode-t"][data-i="1"][data-v="restore"]').getAttribute("aria-checked") === "true" && r.querySelector('${W} [data-rt="bmode-t"][data-i="0"][data-v="opposite"]').getAttribute("aria-checked") === "true"`));
    await stepTo(`[data-rt="ha-switch"]`);
    check(`[${tag}] Letzte Seite: Name wie "Lampe Küche +2", ein Satz je Ziel`, await ev(`const n = r.querySelector('${W} #rt-name'); return n.placeholder.endsWith("+2") && r.querySelectorAll('${W} .rt-sumlist li').length === 3`));
    await tap(`${W} [data-rt="nav-save"]`);
    await wait(`return !r.querySelector('${W} [data-rt="ha-switch"]')`);
    const saved = (await calls("device_panel/routine_save")).at(-1)?.routine;
    check(`[${tag}] Gespeichert: erstes Ziel in den Feldern, zwei weitere in "more", "Danach" je Ziel`, saved && saved.entity_id === "switch.lampe" && saved.more?.length === 2 && saved.more[0].entity_id === "switch.steck" && saved.more[0].back_mode === "restore" && saved.more[1].device_id === "e" && saved.more[1].back_mode === "opposite" && saved.back_mode === "opposite", JSON.stringify(saved && { more: saved.more, back_mode: saved.back_mode }));

    // Anzeige: dieselbe Routine im Reiter des Geräts "e"; zugeklappt wie bisher, aufgeklappt mit allen Zielen
    await ev(`r.host._openDevice("e", "routine")`);
    check(`[${tag}] Das Gerät zeigt die Routine (neben seiner eigenen)`, await wait(`return r.querySelectorAll(".rt-root .rt-rowcard").length === 2`));
    check(`[${tag}] Zugeklappt: wie bisher (Name, keine Zielliste, kein Chip)`, await ev(`const c = [...r.querySelectorAll(".rt-root .rt-rowcard")].find((x) => /Lampe Küche \\+2/.test(x.textContent)); return !!c && !c.querySelector(".rt-tgts") && !c.querySelector(".pill")`));
    await ev(`[...r.querySelectorAll(".rt-root .rt-rowcard")].find((x) => /Lampe Küche \\+2/.test(x.textContent)).querySelector(".mg-dhead").click()`);
    await wait(`return !!r.querySelector(".rt-root .rt-clock")`);
    check(`[${tag}] Aufgeklappt: "${lang === "de" ? "Schaltet 3 Geräte" : "Switches 3 devices"}" mit drei Zeilen, das eigene Gerät markiert`, await ev(`const t = r.querySelector(".rt-root .rt-tgts"); return !!t && t.querySelectorAll(".rt-tgt-row").length === 3 && t.querySelectorAll(".rt-tgt-row.here").length === 1 && /${lang === "de" ? "Schaltet 3 Geräte" : "Switches 3 devices"}/.test(t.textContent)`));
    check(`[${tag}] Die Aktionen (Bearbeiten, Ausführen …) stehen über der Liste der Geräte, nicht darunter`, await ev(`const c = r.querySelector(".rt-root .rt-clock"); const acts = c.querySelector(".acts"); const list = c.querySelector(".rt-tgts"); return !!acts && !!list && !!(acts.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING)`));
    await ev(`r.host._openDevice("d", "routine")`);
    check(`[${tag}] Auch das Gerät "d" zeigt sie (ein Eintrag, nicht doppelt)`, await wait(`return r.querySelectorAll(".rt-root .rt-rowcard, .rt-root .rt-clock").length === 1`));

    // Bearbeiten: ein Ziel entfernen, nur noch zwei
    await ev(`const c = r.querySelector(".rt-root .rt-rowcard"); if (c) c.querySelector(".mg-dhead").click()`);
    await wait(`return !!r.querySelector(".rt-root .rt-clock [data-rt='edit']")`);
    await tap(`.rt-root .rt-clock [data-rt='edit']`);
    await wait(`return !!r.querySelector('${W} [data-rt="goto"]')`);
    await tap(`${W} [data-rt="goto"][data-step="1"]`);
    await wait(`return r.querySelectorAll('${W} .rt-card').length === 3`);
    // Reihenfolge fest: ein Tipp auf eine zugeklappte Karte öffnet sie, die Titel bleiben in derselben Reihenfolge
    const titles = () => ev(`return [...r.querySelectorAll('${W} .rt-card .rt-card-main b')].map((x) => x.textContent.trim()).join("|")`);
    const before = await titles();
    await tap(`${W} .rt-card:not(.open) .rt-card-main`);
    await wait(`return r.querySelector('${W} .rt-card.open .rt-card-main b').textContent.startsWith("2")`);
    check(`[${tag}] Karte angetippt: sie ist offen, die Reihenfolge der Karten bleibt`, (await titles()) === before && (await ev(`return r.querySelectorAll('${W} .rt-card.open').length === 1 && r.querySelector('${W} .rt-card.open .rt-card-main b').textContent.startsWith("2")`)), `${before} / ${await titles()}`);
    await tap(`${W} .rt-card:not(.open) [data-rt="tg-del"]`);
    check(`[${tag}] Ziel entfernt: eine Karte weniger`, await wait(`return r.querySelectorAll('${W} .rt-card').length === 2`));
    await tap(`${W} [data-rt="nav-quick"]`);
    await wait(`return !r.querySelector('${W} [data-rt="goto"]')`);
    const again = (await calls("device_panel/routine_save")).at(-1)?.routine;
    check(`[${tag}] Gespeichert mit zwei Zielen (eines in "more")`, again && again.more?.length === 1 && Boolean(again.id) && !saved.id, JSON.stringify(again && again.more));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(";"));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
