// Assistent, Erklärungen (2.187.0, docs/mockups/wizard-info-v1, B): ⓘ hinter jeder Position der Schritte "Meldungen" und "Labels" öffnet ein Fenster in
// einfachen Worten, bei drei Zahlen mit kleiner Grafik. Es nimmt keinen Platz in der Seite und ändert nichts im Entwurf. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const D = "dialog.wizard-dlg";
const DD = "dialog.discard-dlg:not(.pause-dlg)";
const T = {
  de: { close: "Verstanden", titles: { target: "Ziel der Meldungen", outage: "Ausgefallene Geräte", delay: "Erst melden nach", bat: "Schwach ab", lconn: "Verbindungssensor zählt" } },
  en: { close: "Got it", titles: { target: "Where notifications go", outage: "Failed devices", delay: "Notify only after", bat: "Low from", lconn: "Connectivity sensor counts" } },
};
const STEP4 = ["target", "outage", "battery", "charge", "new", "updates"];
const STEP5 = ["mon", "status", "after", "delay", "flaky", "lconn", "outage", "bat", "battery", "charge", "new", "updates"];

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
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);

    await p.evaluate(() => { window.__labels = [{ id: "oft_offline", name: "Oft offline" }]; window.__devLabels = { b: ["oft_offline"] }; });
    await ev(`r.host._fetch(true)`);
    await ev(`r.host._wizard.open("app")`);
    await wait(`return r.querySelector("${D}")?.open && !r.host._wizard.s?.loading`);
    const before = await ev(`return JSON.stringify(r.host._wizard.serialize(r.host._wizard.s.d))`);

    // --- Schritt "Meldungen"
    await ev(`r.host._wizard.go("messages")`);
    await wait(`return r.host._wizard.s.step === "messages"`);
    check(`[${tag}] Meldungen: ${STEP4.length} Info-Knöpfe, je hinter dem Namen (in der Namenszeile, nicht darunter)`, await ev(`const b = [...r.querySelectorAll("${D} [data-wz-info]")]; return b.length === ${STEP4.length} && JSON.stringify(b.map((x) => x.dataset.wzInfo)) === ${JSON.stringify(JSON.stringify(STEP4))} && b.every((x) => x.closest(".wz-nm, .wz-lab"))`));
    await tap(`${D} [data-wz-info="outage"]`);
    check(`[${tag}] "${L.titles.outage}": Fenster mit Titel, Beispiel, ohne Grafik`, await wait(`const d = r.querySelector("${DD}"); return d?.open && d.querySelector("b").textContent === ${JSON.stringify(L.titles.outage)} && !!d.querySelector(".dd-ex") && !d.querySelector(".dd-fig")`));
    check(`[${tag}] Fenster linksbündig (Klasse dd-info), Knopf "${L.close}"`, await ev(`const d = r.querySelector("${DD}"); return d.querySelector(".dd-card").classList.contains("dd-info") && d.querySelector('[data-dd="no"]').textContent.trim() === ${JSON.stringify(L.close)}`));
    await p.screenshot({ path: `${process.env.OUT || "output"}/wizardinfo-outage-${tag.replace("/", "-")}.png` });
    await tap(`${DD} [data-dd="no"]`);
    check(`[${tag}] "${L.close}": Fenster zu, Assistent offen, Entwurf unverändert`, (await wait(`return !r.querySelector("${DD}").open`)) && await ev(`return r.querySelector("${D}").open && JSON.stringify(r.host._wizard.serialize(r.host._wizard.s.d)) === ${JSON.stringify(before)}`));
    // Jeder Eintrag hat einen Text in beiden Sprachen (nie ein Schlüsselname)
    let bad = [];
    for (const id of STEP4) {
      await tap(`${D} [data-wz-info="${id}"]`);
      await wait(`return r.querySelector("${DD}")?.open`);
      const txt = await ev(`const d = r.querySelector("${DD}"); return d.querySelector("b").textContent + "|" + d.querySelector("small").textContent`);
      if (/wzI_|undefined/.test(txt) || txt.split("|")[1].length < 30) bad.push(id);
      await tap(`${DD} [data-dd="no"]`);
      await wait(`return !r.querySelector("${DD}").open`);
    }
    check(`[${tag}] Meldungen: alle Erklärungen vorhanden`, bad.length === 0, bad.join(","));

    // --- Schritt "Labels"
    await ev(`r.host._wizard.go("labels")`);
    await wait(`return !!r.querySelector("${D} [data-wz-lab]")`);
    await ev(`const e=r.querySelector("[data-wz-lab]"); e.value="oft_offline"; e.dispatchEvent(new Event("change",{bubbles:true}));`);
    await wait(`return !!r.querySelector(".wz-lcard")`);
    check(`[${tag}] Labels: ${STEP5.length} Info-Knöpfe in der Label-Karte`, await ev(`const b = [...r.querySelectorAll(".wz-lcard [data-wz-info]")]; return JSON.stringify(b.map((x) => x.dataset.wzInfo)) === ${JSON.stringify(JSON.stringify(STEP5))}`));
    bad = [];
    for (const id of STEP5) {
      await tap(`.wz-lcard [data-wz-info="${id}"]`);
      await wait(`return r.querySelector("${DD}")?.open`);
      const txt = await ev(`const d = r.querySelector("${DD}"); return d.querySelector("b").textContent + "|" + d.querySelector("small").textContent`);
      if (/wzI_|undefined/.test(txt) || txt.split("|")[1].length < 30) bad.push(id);
      await tap(`${DD} [data-dd="no"]`);
      await wait(`return !r.querySelector("${DD}").open`);
    }
    check(`[${tag}] Labels: alle Erklärungen vorhanden`, bad.length === 0, bad.join(","));
    // Grafik nur bei drei Zahlen
    const figs = {};
    for (const id of STEP5) {
      await tap(`.wz-lcard [data-wz-info="${id}"]`);
      await wait(`return r.querySelector("${DD}")?.open`);
      figs[id] = await ev(`const d = r.querySelector("${DD}"); return d.querySelector(".dd-tl") ? "tl" : d.querySelector(".dd-bat") ? "bat" : ""`);
      if (id === "delay" || id === "bat") await p.screenshot({ path: `${process.env.OUT || "output"}/wizardinfo-${id}-${tag.replace("/", "-")}.png` });
      await tap(`${DD} [data-dd="no"]`);
      await wait(`return !r.querySelector("${DD}").open`);
    }
    check(`[${tag}] Grafik nur bei "Erst melden nach" und "Instabil ab" (Zeitstrahl) und "Schwach ab" (Batterie)`, JSON.stringify(Object.entries(figs).filter(([, v]) => v)) === JSON.stringify([["delay", "tl"], ["flaky", "tl"], ["bat", "bat"]]), JSON.stringify(figs));
    check(`[${tag}] Grafik "Erst melden nach": beschriftet, rote und grüne Punkte`, await (async () => { await tap(`.wz-lcard [data-wz-info="delay"]`); await wait(`return r.querySelector("${DD}")?.open`); const ok2 = await ev(`const d = r.querySelector("${DD}"); return d.querySelectorAll(".dd-tl .dot").length === 3 && d.querySelectorAll(".dd-tl span").length === 4 && d.querySelector(".dd-tl .dot.ok")`); await tap(`${DD} [data-dd="no"]`); return ok2; })());
    // Esc schliesst das Fenster, nicht den Assistenten
    await tap(`.wz-lcard [data-wz-info="lconn"]`);
    await wait(`return r.querySelector("${DD}")?.open`);
    await p.keyboard.press("Escape");
    check(`[${tag}] Esc: nur das Fenster zu, der Assistent bleibt`, (await wait(`return !r.querySelector("${DD}").open`)) && await ev(`return r.querySelector("${D}").open`));
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
