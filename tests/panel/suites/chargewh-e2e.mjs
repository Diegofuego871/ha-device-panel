// Akku-Kapazität in Wh pro Gerät (2.203.0): Feld im Reiter Batterie nur bei einem Gerät, das geladen werden kann; Speichern (Punkt oder Komma), Fehler, leer = zurück;
// kleine Kachel "Akku-Kapazität" vorne; geschätzte Leistung in der Kachel "Lädt". Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, savePending } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { tile: "Akku-Kapazität", pow: /^≈ 43[,.]1 W ins Akku \(geschätzt\)$/, err: "Eine Zahl von 0,1 bis 5000 Wh", none: "nicht angegeben", diff: "Akku 59,9 Wh" },
  en: { tile: "Battery capacity", pow: /^≈ 43\.1 W into the battery \(estimated\)$/, err: "A number from 0.1 to 5000 Wh", none: "not set", diff: "battery 59.9 Wh" },
};
for (const lang of ["de", "en"]) {
  const L = T[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
    const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.innerText || "").replace(/\\s+/g," ").trim()`);
    const calls = async () => { await savePending(f, R); return p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_device_settings").map(({ type, id, ...rest }) => rest)); };
    const D = "dialog.device";
    const F = `${D} input[data-dlg="dev-charge-wh"]`;

    // Gerät e ohne Lademöglichkeit: kein Feld
    await ev(`r.host._openDevice("e")`);
    await wait(`return r.querySelector('${D} [data-tab="set"]')`);
    await tap(`${D} [data-tab="set"]`);
    await tap(`${D} [data-stab="bat"]`);
    check(`[${tag}] Gerät ohne Ladeerkennung: kein Feld für die Akku-Kapazität`, !(await ev(`return !!r.querySelector('${F}')`)));
    await ev(`r.host._closeDevice?.()`);
    // Gerät kann geladen werden
    await p.evaluate(() => { window.__rechargeable = ["e"]; });
    await ev(`r.host._fetch(true)`);
    await wait(`return r.host._devices.find((d) => d.id === "e")?.rechargeable === true`);
    await ev(`r.host._openDevice("e")`);
    await wait(`return r.querySelector('${D} [data-tab="set"]')`);
    await tap(`${D} [data-tab="set"]`);
    await tap(`${D} [data-stab="bat"]`);
    check(`[${tag}] Gerät mit Ladeerkennung: Feld "Wh" im Reiter Batterie (Einstellungen › Batterie), Herkunft "${L.none}"`, (await wait(`return !!r.querySelector('${F}')`)) && (await text(`${D} .opt:has(${"input[data-dlg=dev-charge-wh]"}) .opt-origin`)).includes(L.none));
    // Eingabe mit Komma
    await (await handle(F)).fill("59,94");
    await (await handle(F)).press("Tab");
    const c1 = await calls();
    check(`[${tag}] "59,94" gespeichert als 59.9 (eine Nachkommastelle)`, c1.some((x) => x.charge_wh === 59.9), JSON.stringify(c1));
    check(`[${tag}] Feld zeigt den gespeicherten Wert, Reiter zählt die eigene Einstellung`, await wait(`return r.querySelector('${F}').value.replace(",", ".") === "59.9"`));
    // Fehler
    await (await handle(F)).fill("0");
    await (await handle(F)).press("Tab");
    check(`[${tag}] ungültig (0): Fehler "${L.err}", nichts gespeichert`, (await wait(`return (r.querySelector("${D} [data-dev-range]")?.textContent || "").includes(${JSON.stringify(L.err)})`)) && (await calls()).filter((x) => "charge_wh" in x).length === 1);
    // Vorne die kleine Kachel
    await tap(`${D} [data-tab="ov"]`);
    check(`[${tag}] Übersicht: kleine Kachel "${L.tile}" mit 59,9 Wh`, await wait(`const t = [...r.querySelectorAll("${D} .tiles .tile")].find((x) => x.querySelector(".tile-k")?.textContent === ${JSON.stringify(L.tile)}); return !!t && /59[.,]9\\s*Wh/.test(t.textContent)`));
    // Leistung in der Kachel "Lädt": 1,2 %/Min. × 59,9 Wh × 60 / 100 = 43,1 W
    await p.evaluate(() => { window.__charging = { e: { level: 64, from: 15, ago: 2400, eta_min: 24, rate: 1.2 } }; });
    await ev(`r.host._fetch(true)`);
    await wait(`return !!r.querySelector("${D} .chg-tile .chg-pow")`);
    check(`[${tag}] Kachel "Lädt": geschätzte Leistung "≈ 43,1 W ins Akku (geschätzt)"`, L.pow.test(await text(`${D} .chg-tile .chg-pow`)), await text(`${D} .chg-tile .chg-pow`));
    // Leer: zurück
    await tap(`${D} [data-tab="set"]`);
    await tap(`${D} [data-stab="bat"]`);
    await (await handle(F)).fill("");
    await (await handle(F)).press("Tab");
    check(`[${tag}] leeres Feld: Wert zurückgesetzt (null gesendet), Leistung und Kachel entfallen`, (await calls()).some((x) => x.charge_wh === null) && (await wait(`return !r.querySelector("${D} .chg-pow")`)));
    check(`[${tag}] keine Fehler`, errors.length === 0, errors.join("|"));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
