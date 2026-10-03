// Popup "Einstellungen für dieses Gerät" (bis 0.20.0 "Meldungen für dieses Gerät"; Variante A, docs/mockups/notify-v1):
// Batterie-Warnung globaler Wert / eigene Schwelle / aus, Ausfall- und
// Online-Meldungen aus, sofort gespeichert; Eingabe übersteht das Abfragen.
// Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: {
    sec: "Einstellungen für dieses Gerät", def: "Globaler Wert (15 %)", own: "Eigene Schwelle", short: "Globaler Wert: 15 %.", notifyOn: "Globale Einstellung",
    range: "Erlaubt: 5 bis 50", notifyOff: "Aus für dieses Gerät", saveErr: "Konnte nicht gespeichert werden:",
  },
  en: {
    sec: "Settings for this device", def: "Global value (15 %)", own: "Own threshold", short: "Global value: 15 %.", notifyOn: "Global setting",
    range: "Allowed: 5 to 50", notifyOff: "Off for this device", saveErr: "Could not be saved:",
  },
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
    const calls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_device_settings").map(({ type, id, ...rest }) => rest));
    const lowChip = () => ev(`return r.querySelector('.chip.hint[data-hint="battery"] .n')?.textContent || "0"`);
    const open = async (id) => {
      await tap(`.dev[data-open="${id}"]`);
      await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('select[data-dlg="dev-notify"]')`);
    };
    const close = async () => { await tap('dialog.device [data-dlg="close"]'); await wait(`return !r.querySelector("dialog.device").open`); };

    check(`[${tag}] Ausgangslage: 2 schwache Batterien`, (await lowChip()) === "2");
    // Thermostat Bad (Matter, 22 %): eigene Schwelle 30 %
    await open("c");
    check(`[${tag}] Abschnitt im Popup`, (await ev(`return [...r.querySelectorAll("dialog.device h3")].map(h=>h.textContent.trim())`)).includes(T.sec));
    check(`[${tag}] Batterie globaler Wert`, (await ev(`const s=r.querySelector('select[data-dlg="dev-bat"]'); return s.value + "|" + s.options[s.selectedIndex].textContent`)) === `default|${T.def}`);
    check(`[${tag}] Meldungen: globale Einstellung`, (await ev(`const s=r.querySelector('select[data-dlg="dev-notify"]'); return s.value + "|" + s.options[s.selectedIndex].textContent`)) === `on|${T.notifyOn}`);
    check(`[${tag}] kein "wie eingestellt" mehr`, !(await ev(`return /wie eingestellt|as configured/i.test(r.querySelector("dialog.device").textContent)`)));
    check(`[${tag}] Kurzzeile`, (await text('select[data-dlg="dev-bat"]').then(() => ev(`return r.querySelector('select[data-dlg="dev-bat"]').closest(".opt").querySelector(".opt-short").textContent`))).startsWith(T.short));
    await (await handle('select[data-dlg="dev-bat"]')).selectOption("own");
    check(`[${tag}] eigene Schwelle beginnt beim geltenden Wert`, await wait(`return r.querySelector('input[data-dlg="dev-bat-pct"]')?.value === "15"`) && JSON.stringify((await calls()).at(-1)) === JSON.stringify({ device_id: "c", battery: 15 }), JSON.stringify((await calls()).at(-1)));
    const inp = await handle('input[data-dlg="dev-bat-pct"]');
    if (mobile) await inp.tap(); else await inp.click();
    await inp.fill("");
    await inp.type("3");
    // Abfrage während der Eingabe: der angefangene Wert bleibt stehen
    await f.evaluate(() => document.querySelector("device-panel")._fetch());
    await p.waitForTimeout(400);
    check(`[${tag}] Eingabe übersteht das Abfragen`, (await ev(`return r.querySelector('input[data-dlg="dev-bat-pct"]').value`)) === "3");
    await inp.type("0");
    await inp.press("Tab");
    check(`[${tag}] 30 % gespeichert`, await wait(`return true`) && JSON.stringify((await calls()).at(-1)) === JSON.stringify({ device_id: "c", battery: 30 }), JSON.stringify((await calls()).at(-1)));
    check(`[${tag}] Liste: jetzt 3 schwache`, await wait(`return r.querySelector('.chip.hint[data-hint="battery"] .n')?.textContent === "3"`), await lowChip());
    // Ungültig: nichts gespeichert, Hinweis
    const n = (await calls()).length;
    const inp2 = await handle('input[data-dlg="dev-bat-pct"]');
    if (mobile) await inp2.tap(); else await inp2.click();
    await inp2.fill("60");
    await inp2.press("Tab");
    check(`[${tag}] 60 abgelehnt: Hinweis unter dem Feld, nichts gesendet`, await wait(`return r.querySelector("dialog.device [data-dev-range]")?.textContent === ${JSON.stringify(T.range)}`) && (await calls()).length === n && !(await text("dialog.device .dev-set .opt-error")).startsWith(T.saveErr), await text("dialog.device .dev-set .opt-error"));
    const redBorder = await ev(`const i=r.querySelector('input[data-dlg="dev-bat-pct"]').closest(".opt-input"); return [getComputedStyle(i).borderTopColor, getComputedStyle(r.querySelector(".dev-set .opt-error")).color]`);
    check(`[${tag}] Eingabe bleibt stehen, Feld rot`, (await ev(`const i=r.querySelector('input[data-dlg="dev-bat-pct"]'); return i.value + "|" + i.closest(".opt-input").classList.contains("bad")`)) === "60|true" && redBorder[0] === redBorder[1], JSON.stringify(redBorder));
    await f.evaluate(() => document.querySelector("device-panel")._fetch());
    await p.waitForTimeout(400);
    check(`[${tag}] Hinweis übersteht das Abfragen`, (await ev(`return r.querySelector('input[data-dlg="dev-bat-pct"]').value + "|" + !!r.querySelector("[data-dev-range]")`)) === "60|true");
    await ev(`r.querySelector(".dev-set").scrollIntoView({ block: "center" })`);
    await p.screenshot({ path: `${outDir}/devset-${tag.replace("/", "-")}.png` });
    const inp3 = await handle('input[data-dlg="dev-bat-pct"]');
    if (mobile) await inp3.tap(); else await inp3.click();
    await inp3.fill("30");
    await inp3.press("Tab");
    check(`[${tag}] gültiger Wert: Hinweis weg, gespeichert`, await wait(`return !r.querySelector("[data-dev-range]") && !r.querySelector('input[data-dlg="dev-bat-pct"]').closest(".opt-input").classList.contains("bad")`) && JSON.stringify((await calls()).at(-1)) === JSON.stringify({ device_id: "c", battery: 30 }) && (await calls()).length === n + 1, JSON.stringify((await calls()).at(-1)));
    await close();

    // Temperatur Keller (BTHome, 0 %): Warnung aus
    await open("a");
    await (await handle('select[data-dlg="dev-bat"]')).selectOption("off");
    check(`[${tag}] Batterie aus gespeichert`, await wait(`return r.querySelector('select[data-dlg="dev-bat"]')?.value === "off"`) && JSON.stringify((await calls()).at(-1)) === JSON.stringify({ device_id: "a", battery: "off" }));
    check(`[${tag}] Liste: wieder 2 schwache`, await wait(`return r.querySelector('.chip.hint[data-hint="battery"] .n')?.textContent === "2"`), await lowChip());
    // Meldungen aus
    // Wie ein Benutzer: Auswahl hat den Fokus, dann neue Wahl
    const notifySel = await handle('select[data-dlg="dev-notify"]');
    await notifySel.focus();
    await notifySel.selectOption("off");
    check(`[${tag}] Meldungen aus gespeichert`, await wait(`return r.querySelector('select[data-dlg="dev-notify"]')?.value === "off"`) && JSON.stringify((await calls()).at(-1)) === JSON.stringify({ device_id: "a", notify: false }));
    // Nach dem Neuaufbau (Speichern und Abfrage): auf dem Handy keine fokussierte
    // Auswahl, sonst öffnet iOS sie sofort wieder; am Desktop bleibt der Fokus.
    await f.evaluate(() => document.querySelector("device-panel")._fetch());
    await p.waitForTimeout(400);
    const focused = await ev(`const a=r.activeElement; return a ? a.tagName + ":" + (a.dataset.dlg || "") : "none"`);
    check(`[${tag}] Fokus nach Änderung`, mobile ? !focused.startsWith("SELECT") : focused === "SELECT:dev-notify", focused);
    check(`[${tag}] als geändert markiert`, await ev(`return r.querySelector('select[data-dlg="dev-notify"]').closest(".opt").classList.contains("changed")`));
    await close();
    await open("a");
    check(`[${tag}] nach erneutem Öffnen`, (await ev(`return r.querySelector('select[data-dlg="dev-bat"]').value + "|" + r.querySelector('select[data-dlg="dev-notify"]').value`)) === "off|off");
    // Zurück
    await (await handle('select[data-dlg="dev-bat"]')).selectOption("default");
    await wait(`return r.querySelector('select[data-dlg="dev-bat"]')?.value === "default"`);
    await (await handle('select[data-dlg="dev-notify"]')).selectOption("on");
    check(`[${tag}] zurückgestellt`, await wait(`return r.querySelector('select[data-dlg="dev-notify"]')?.value === "on"`) && JSON.stringify((await calls()).slice(-2)) === JSON.stringify([{ device_id: "a", battery: null }, { device_id: "a", notify: true }]));
    await close();

    // Gerät ohne Batterie: nur die Meldungen
    await open("d");
    check(`[${tag}] ohne Batterie keine Batterie-Zeile`, !(await ev(`return !!r.querySelector('select[data-dlg="dev-bat"]')`)));
    // Fehler beim Speichern
    await p.evaluate(() => { window.__devSetFails = "Keine Berechtigung"; });
    await (await handle('select[data-dlg="dev-notify"]')).selectOption("off");
    check(`[${tag}] Speicherfehler angezeigt`, await wait(`return (r.querySelector("dialog.device .dev-set .opt-error")?.textContent || "").includes("Keine Berechtigung")`) && (await text("dialog.device .dev-set .opt-error")).startsWith(T.saveErr));
    await p.evaluate(() => { window.__devSetFails = null; });
    await close();
    // Matter zurück auf den globalen Wert
    await open("c");
    await (await handle('select[data-dlg="dev-bat"]')).selectOption("default");
    check(`[${tag}] Matter zurück`, await wait(`return r.querySelector('.chip.hint[data-hint="battery"] .n')?.textContent === "2"`));
    await close();

    check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
