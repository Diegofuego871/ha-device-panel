// "Ausgefallen nach" pro Integration (0.30.0, docs/mockups/backlog-v1, Punkt 5 B;
// seit 0.34.0 in "Überwachung und Meldungen" › "Integrationen", je
// Integration: Auswahl Standard/feste Zeiten, "Überwachen" als Schalter),
// Entwurf mit Markierung, Speichern, Gruppe "Nicht überwacht" in der Liste
// ohne Status und ohne Zählung im Kopf. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

const TEXT = {
  de: { def: "Standard (2 Min.)", last: "24 Std.", diff30: "Ausfall nach 30 Min.", unmon: "Nicht überwacht", own: "Eigene", would: "Standard wäre 2 Min.", group: "Nicht überwacht", pill: "Nicht überwacht" },
  en: { def: "Default (2 min)", last: "24 h", diff30: "Offline after 30 min", unmon: "Not monitored", own: "Own", would: "Default would be 2 min", group: "Not monitored", pill: "Not monitored" },
};

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
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => {
      const h = await handle(sel);
      if (!h) throw new Error("fehlt: " + sel);
      await h.scrollIntoViewIfNeeded();
      if (mobile) await h.tap(); else await h.click();
    };
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const calls = (type) => p.evaluate((t) => window.__wsCalls.filter((m) => m.type === t), type);
    const pick = async (dom, value) => {
      const sel = `select[data-off-mode="${dom}"]`;
      await ev(`const s=r.querySelector(${JSON.stringify(sel)}); s.value=${JSON.stringify(value)}; s.dispatchEvent(new Event("change",{bubbles:true,composed:true}))`);
    };
    const modes = () => ev(`return [...r.querySelectorAll("select[data-off-mode]")].map(s=>s.dataset.offMode+":"+s.value).join()`);

    const integ = async (dom) => { await tap(`[data-set="integ"][data-key="${dom}"]`); await wait(`return !!r.querySelector('[data-imon="${dom}"]')`); };
    const back = async () => { await tap('[data-set="integ"][data-key=""]'); await wait(`return !!r.querySelector(".ilist")`); };
    const diff = (dom) => text(`.ilist-row[data-key="${dom}"] .ilist-diff`);

    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await tap('[data-set="tab"][data-key="integ"]');
    await wait(`return !!r.querySelector(".ilist")`);
    await integ("zha");
    const sel = await ev(`const s=r.querySelector('select[data-off-mode="zha"]'); return [s.value, s.options[0].textContent, s.options[s.options.length-1].textContent, s.options.length]`);
    check(`[${tag}] Auswahl: "${T.def}" zuerst, feste Zeiten bis "${T.last}"`, sel[0] === "default" && sel[1] === T.def && sel[2] === T.last && sel[3] === 12, JSON.stringify(sel));
    const geo = await ev(`const d=r.querySelector("dialog.settings"); const s=r.querySelector('select[data-off-mode="zha"]').getBoundingClientRect(), o=r.querySelector('select[data-off-mode="zha"]').closest(".opt").getBoundingClientRect(); return [s.right <= o.right + 1, d.scrollWidth <= d.clientWidth]`);
    check(`[${tag}] Auswahl in der Zeile, kein seitlicher Überlauf`, geo.every(Boolean), JSON.stringify(geo));
    await back();
    await integ("bthome");
    await pick("bthome", "30");
    check(`[${tag}] eigene Zeit: Etikett und Standardwert, Markierung`, await wait(`return r.querySelector('select[data-off-mode="bthome"]')?.value === "30"`) && (await text('.opt:has(select[data-off-mode="bthome"]) .opt-origin')) === `${T.own}${T.would}` && await ev(`return r.querySelector('select[data-off-mode="bthome"]').closest(".opt").classList.contains("changed")`), await text('.opt:has(select[data-off-mode="bthome"]) .opt-origin'));
    await back();
    await integ("matter");
    await tap('input[data-imon="matter"]');
    check(`[${tag}] nicht überwachen: Auswahl gesperrt`, await wait(`return r.querySelector('select[data-off-mode="matter"]')?.disabled`));
    await back();
    check(`[${tag}] Entwurf: Liste, Zähler`, (await diff("bthome")) === T.diff30 && (await diff("matter")) === T.unmon && /^1 /.test(await text(".set-count")), `${await diff("bthome")} / ${await diff("matter")} / ${await text(".set-count")}`);
    check(`[${tag}] noch nichts gespeichert`, (await calls("device_panel/set_options")).length === 0);
    await p.screenshot({ path: `${outDir}/offline-integ-${tag.replace("/", "-")}.png` });
    await tap('dialog.settings [data-set="save"]');
    await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`);
    const so = (await calls("device_panel/set_options")).at(-1);
    check(`[${tag}] gespeichert: Minuten und "off"`, JSON.stringify(so?.values) === JSON.stringify({ offline_after_integrations: { bthome: 30, matter: "off" } }), JSON.stringify(so?.values));

    // "Anzeigen" aus (Abschnitt "Integrationen"): fehlt in der Liste
    await tap('[data-set="section"][data-id="integrations"]');
    await tap('input[data-list="exclude_integrations"][data-value="zha"]');
    await tap('[data-set="tab"][data-key="integ"]');
    check(`[${tag}] ausgeblendete Integration fehlt in der Liste`, await wait(`return !!r.querySelector(".ilist") && !r.querySelector('.ilist-row[data-key="zha"]')`));
    await tap('input[data-list="exclude_integrations"][data-value="zha"]');
    // Zurück auf Standard
    await integ("bthome");
    await pick("bthome", "default");
    check(`[${tag}] Standard entfernt den Eintrag`, await wait(`return r.querySelector('select[data-off-mode="bthome"]')?.value === "default"`) && (await ev(`return JSON.stringify(r.host._settings.draft.offline_after_integrations)`)) === JSON.stringify({ matter: "off" }));
    await pick("bthome", "30");

    // Liste: Matter-Geräte unter "Nicht überwacht"
    await tap('dialog.settings [data-set="close"]');
    await wait(`return !r.querySelector("dialog.settings").open`);
    await wait(`return r.host._devices.some((d) => d.unmonitored)`);
    const groups = await ev(`return [...r.querySelectorAll(".grp, .ghead, [data-group]")].map(e=>e.textContent.replace(/\\s+/g," ").trim()).join("|")`);
    const list = await ev(`return r.host._devices.filter((d) => d.unmonitored).map((d) => d.id + ":" + d.online).sort().join()`);
    check(`[${tag}] Matter-Geräte unmonitored, ohne Status`, list === "c:null,i:null", list);
    const html = await ev(`return r.querySelector(".content")?.textContent || ""`);
    check(`[${tag}] Gruppe "${T.group}" und Status "${T.pill}" in der Liste`, html.includes(T.group) && html.includes(T.pill), groups);
    // Kopf zählt sie nicht: c war ausgefallen (Thermostat Bad), jetzt nicht mehr
    const offline = await ev(`return r.host._devices.filter((d) => d.online === false).map((d) => d.id).sort().join()`);
    check(`[${tag}] nicht überwachte Geräte zählen nicht als ausgefallen`, !offline.includes("c"), offline);
    await p.screenshot({ path: `${outDir}/offline-list-${tag.replace("/", "-")}.png` });
    // Popup: Status "Nicht überwacht"
    await tap('.dev[data-open="c"]');
    await wait(`return r.querySelector("dialog.device")?.open`);
    check(`[${tag}] Popup zeigt "${T.pill}"`, (await text("dialog.device .pill")).includes(T.pill), await text("dialog.device .pill"));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
