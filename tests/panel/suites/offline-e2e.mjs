// "Ausgefallen nach" pro Integration (0.30.0, docs/mockups/backlog-v1, Punkt 5 B):
// Spalte in der Tabelle "Integrationen" (Standard, feste Zeiten, "Nicht
// überwachen"), Entwurf mit Markierung, Speichern, Gruppe "Nicht überwacht"
// in der Liste ohne Status und ohne Zählung im Kopf. Deutsch und Englisch,
// Desktop und Handy (Auswahl unter dem Namen).
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

const TEXT = {
  de: { head: "Ausgefallen nach", def: "Standard", none: "Nicht überwachen", min30: "30 Min.", hour1: "1 Std.", sum: "9 Integrationen · alle angezeigt · 2 mit eigener Zeit", group: "Nicht überwacht", pill: "Nicht überwacht" },
  en: { head: "Offline after", def: "Default", none: "Don't monitor", min30: "30 min", hour1: "1 h", sum: "9 integrations · all shown · 2 with own time", group: "Not monitored", pill: "Not monitored" },
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

    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="integrations"]');
    check(`[${tag}] Spalte "${T.head}"`, (await ev(`return [...r.querySelectorAll(".ex-head .ex-col")].pop().textContent`)) === T.head);
    const sel = await ev(`const s=r.querySelector('select[data-off-mode="zha"]'); return [s.value, s.options[0].textContent, s.options[s.options.length-1].textContent, s.options.length]`);
    check(`[${tag}] Auswahl: Standard zuerst, "${T.none}" zuletzt`, sel[0] === "default" && sel[1] === T.def && sel[2] === T.none && sel[3] === 13, JSON.stringify(sel));
    // Handy: Auswahl unter dem Namen, nicht über den Rand; Desktop: in derselben Zeile
    const geo = await ev(`const s=r.querySelector('select[data-off-mode="zha"]'); const row=s.closest(".ex-row"), name=row.querySelector(".ex-name"); const a=s.getBoundingClientRect(), n=name.getBoundingClientRect(), w=row.getBoundingClientRect(); return [a.top >= n.bottom - 1, a.right <= w.right + 1, a.left >= w.left - 1, r.querySelector("dialog.settings").scrollWidth <= r.querySelector("dialog.settings").clientWidth]`);
    check(`[${tag}] Auswahl liegt in der Zeile${mobile ? " unter dem Namen" : ""}, kein seitlicher Überlauf`, (mobile ? geo[0] : true) && geo[1] && geo[2] && geo[3], JSON.stringify(geo));

    await pick("bthome", "30");
    await pick("matter", "off");
    check(`[${tag}] Entwurf: Zusammenfassung, Zähler, Markierung`, (await text('[data-id="integrations"] .set-sec-sum')) === T.sum && /^1 /.test(await text(".set-count")) && (await ev(`return r.querySelector('select[data-off-mode="bthome"]').closest(".opt-select").classList.contains("changed")`)), await text('[data-id="integrations"] .set-sec-sum'));
    check(`[${tag}] noch nichts gespeichert`, (await calls("device_panel/set_options")).length === 0);
    await ev(`r.querySelector('select[data-off-mode="bthome"]').closest(".ex-row").scrollIntoView({ block: "center" })`);
    await p.screenshot({ path: `${outDir}/offline-column-${tag.replace("/", "-")}.png` });
    await tap('dialog.settings [data-set="save"]');
    await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`);
    const so = (await calls("device_panel/set_options")).at(-1);
    check(`[${tag}] gespeichert: Minuten und "off"`, JSON.stringify(so?.values) === JSON.stringify({ offline_after_integrations: { bthome: 30, matter: "off" } }), JSON.stringify(so?.values));

    // "Anzeigen" aus: Auswahl gesperrt
    await tap('input[data-list="exclude_integrations"][data-value="zha"]');
    check(`[${tag}] Integration ausgeblendet: Auswahl gesperrt`, await ev(`return r.querySelector('select[data-off-mode="zha"]').disabled`));
    await tap('input[data-list="exclude_integrations"][data-value="zha"]');
    // Zurück auf Standard
    await pick("bthome", "default");
    check(`[${tag}] Standard entfernt den Eintrag`, !(await modes()).includes("bthome:30") && (await ev(`return r.querySelector('select[data-off-mode="bthome"]').value`)) === "default");
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
