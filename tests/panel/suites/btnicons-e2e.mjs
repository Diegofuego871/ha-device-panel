// 2.92.0: jeder Knopf im Stil "dlg-btn" trägt ein Symbol (Zurück, Weiter, Schliessen, Abbrechen, Löschen, Verwerfen ...), auch in den
// Fenstern von Routinen, Magic Push, Status, Einstellungen, Geräte-Popup und in der Rückfrage "Änderungen verwerfen?".
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

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
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    // Knöpfe ohne Symbol in sichtbaren (offenen) Fenstern
    const bare = () => ev(`return [...r.querySelectorAll("dialog[open] .dlg-btn, .dd-card .dlg-btn")].filter((x) => !x.querySelector("svg")).map((x) => x.textContent.trim() || x.className).join("|")`);
    const count = () => ev(`return r.querySelectorAll("dialog[open] .dlg-btn, .dd-card .dlg-btn").length`);

    // Geräte-Popup (Übersicht, Einstellungen, mit Änderung)
    await ev(`r.host._openDevice("e")`);
    await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device [data-tab="set"]')`);
    check(`[${tag}] Popup: alle Knöpfe mit Symbol`, (await count()) >= 2 && (await bare()) === "", await bare());
    await ev(`r.querySelector('dialog.device [data-tab="set"]').click()`);
    await wait(`return r.querySelector('select[data-dlg="dev-off"]')`);
    await ev(`const s=r.querySelector('select[data-dlg="dev-delay"]'); s.value="own"; s.dispatchEvent(new Event("change",{bubbles:true,composed:true}))`);
    await wait(`return r.querySelector('dialog.device [data-dlg="save"]')`);
    check(`[${tag}] Popup mit Änderung: "Abbrechen" und "Speichern" mit Symbol`, (await bare()) === "" && await ev(`return !!r.querySelector('dialog.device [data-dlg="close"] svg') && !!r.querySelector('dialog.device [data-dlg="save"] svg')`), await bare());
    // Rückfrage "Änderungen verwerfen?"
    await ev(`r.querySelector('dialog.device [data-dlg="close"]').click()`);
    check(`[${tag}] Rückfrage "Verwerfen": beide Knöpfe mit Symbol`, await wait(`return !!r.querySelector(".dd-card")`) && (await bare()) === "", await bare());
    await ev(`r.querySelector('.dd-card [data-dd="yes"]').click()`);
    await wait(`return !r.querySelector("dialog.device").open`);

    // Einstellungen
    await ev(`r.querySelector(".gear-btn").click()`);
    await wait(`return r.querySelector("dialog.settings")?.open`);
    check(`[${tag}] Einstellungen: Knöpfe mit Symbol`, (await count()) >= 1 && (await bare()) === "", await bare());
    await ev(`r.querySelector('dialog.settings [data-set="close"]').click()`);
    await wait(`return !r.querySelector("dialog.settings").open`);

    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
