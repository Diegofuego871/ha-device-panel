// Gerät im Popup umbenennen (1.21.0): Stift neben dem Namen, Feld mit Speichern und
// Abbrechen (Enter, Escape), "Originalname" mit "Zurücksetzen", Name gilt sofort in
// Popup und Liste, Fehler im Popup, leer = Name der Integration. Deutsch und
// Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { edit: "Gerät umbenennen", save: "Name speichern", orig: "Originalname: Steckdose Terrasse", reset: "Zurücksetzen", err: "Umbenennen fehlgeschlagen:" },
  en: { edit: "Rename device", save: "Save name", orig: "Original name: Steckdose Terrasse", reset: "Reset", err: "Could not rename:" },
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
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const calls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/rename_device").map(({ device_id, name }) => ({ device_id, name })));
    const title = () => text("dialog.device .dlg-title h2");
    const rowName = () => ev(`return r.querySelector('.dev[data-open="d"] .name, .dev[data-open="d"]')?.textContent.replace(/\\s+/g," ").trim()`);

    await tap('.dev[data-open="d"]');
    await wait(`return r.querySelector("dialog.device")?.open && r.querySelector(".dev-set")`);
    check(`[${tag}] Name mit Stift`, (await title()) === "Steckdose Terrasse" && (await ev(`return r.querySelector('.dn-edit').getAttribute("aria-label")`)) === T.edit);
    check(`[${tag}] ohne eigenen Namen kein "Zurücksetzen"`, (await ev(`return !r.querySelector(".dn-orig")`)));

    // Stift: Feld mit dem Namen, Fokus, Speichern und Abbrechen
    await tap(".dn-edit");
    check(`[${tag}] Feld mit Namen, Fokus`, await wait(`const i=r.querySelector('input[data-dlg="rename-input"]'); return !!i && i.value === "Steckdose Terrasse" && r.activeElement === i`));
    // Abbrechen (Escape) lässt das Fenster offen
    await p.keyboard.press("Escape");
    check(`[${tag}] Escape verwirft, Fenster bleibt offen`, await wait(`return !r.querySelector('input[data-dlg="rename-input"]') && r.querySelector("dialog.device").open`) && (await title()) === "Steckdose Terrasse");

    // Umbenennen mit Enter
    await tap(".dn-edit");
    await wait(`return !!r.querySelector('input[data-dlg="rename-input"]')`);
    await p.keyboard.press("Control+a");
    await p.keyboard.type("Terrassenlicht");
    // Der Hintergrund-Abruf (alle 10 s) setzt die Eingabe nicht zurück
    await ev(`r.host._renderDevice()`);
    check(`[${tag}] Eingabe übersteht einen Neuaufbau`, (await ev(`return r.querySelector('input[data-dlg="rename-input"]').value`)) === "Terrassenlicht");
    await p.keyboard.press("Enter");
    check(`[${tag}] gespeichert: Name im Popup`, await wait(`return r.querySelector("dialog.device .dlg-title h2")?.textContent.trim() === "Terrassenlicht"`) && JSON.stringify(await calls()) === JSON.stringify([{ device_id: "d", name: "Terrassenlicht" }]), JSON.stringify(await calls()));
    check(`[${tag}] Liste zeigt den neuen Namen`, await wait(`return r.querySelector('.dev[data-open="d"]').textContent.includes("Terrassenlicht")`));

    // Originalname und Zurücksetzen
    await tap(".dn-edit");
    await wait(`return !!r.querySelector(".dn-orig")`);
    check(`[${tag}] Originalname mit "${T.reset}"`, (await text(".dn-orig")) === `${T.orig} ${T.reset}`, await text(".dn-orig"));
    await ev(`r.querySelector(".dev-set") && r.querySelector("dialog.device").scrollTo(0, 0)`);
    await p.screenshot({ path: `${outDir}/rename-${tag.replace("/", "-")}.png` });
    await tap('[data-dlg="rename-reset"]');
    check(`[${tag}] Zurücksetzen: Name der Integration`, await wait(`return r.querySelector("dialog.device .dlg-title h2")?.textContent.trim() === "Steckdose Terrasse" && !r.querySelector(".dn-input")`) && (await calls()).at(-1).name === "", JSON.stringify(await calls()));

    // Unverändert oder leer ohne eigenen Namen: nichts gesendet
    const n = (await calls()).length;
    await tap(".dn-edit");
    await wait(`return !!r.querySelector('input[data-dlg="rename-input"]')`);
    await tap('[data-dlg="rename-save"]');
    check(`[${tag}] unverändert: nichts gesendet, Feld zu`, await wait(`return !r.querySelector(".dn-input")`) && (await calls()).length === n);

    // Fehler vom Server: im Popup, Eingabe bleibt
    await p.evaluate(() => { window.__renameFails = "boom"; });
    await tap(".dn-edit");
    await wait(`return !!r.querySelector('input[data-dlg="rename-input"]')`);
    await p.keyboard.press("Control+a");
    await p.keyboard.type("Neu");
    await tap('[data-dlg="rename-save"]');
    check(`[${tag}] Fehler im Popup, Eingabe bleibt`, await wait(`return !!r.querySelector(".dn-form + .opt-error") && r.querySelector('input[data-dlg="rename-input"]').value === "Neu"`) && (await text(".dn-form + .opt-error")).startsWith(T.err), await text(".dn-form + .opt-error"));
    await p.evaluate(() => { window.__renameFails = null; });
    await tap('[data-dlg="rename-cancel"]');
    check(`[${tag}] abgebrochen: alter Name`, await wait(`return !r.querySelector(".dn-input")`) && (await title()) === "Steckdose Terrasse");

    // Schliessen verwirft ein offenes Feld
    await tap(".dn-edit");
    await tap('dialog.device [data-dlg="close"]');
    await wait(`return !r.querySelector("dialog.device").open`);
    await tap('.dev[data-open="d"]');
    await wait(`return r.querySelector("dialog.device")?.open && r.querySelector(".dn-edit")`);
    check(`[${tag}] Fenster neu geöffnet: kein offenes Feld`, !(await ev(`return !!r.querySelector(".dn-input")`)));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
