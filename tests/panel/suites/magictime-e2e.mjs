// Magic Push, Zeit-Bedingung (2.193.0): Im Schritt "Bedingungen" gibt es neben den Entitäten die Karte "Uhrzeit". Sie öffnet eine
// Bedingung mit "Uhrzeit" oder "Von bis", den Uhrzeiten und den Wochentagen. Allein ist sie eine ganze Regel (ohne Entität), die
// Regel wird mit Name, Satz und Standardtext gespeichert. Deutsch und Englisch, Desktop und Handy, echte Klicks und Taps.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { card: "Uhrzeit", sub: "12:30", sat: "Sa", needs: "Gerätebedingung", q1: "Welche Bedingungen", name: "Uhrzeit 12:30, Sa, So" },
  en: { card: "Time of day", sub: "12:30", sat: "Sat", needs: "device condition", q1: "Which conditions", name: "Time 12:30, Sat, Sun" },
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
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const W = "dialog.magic-dlg";
    await p.evaluate(() => { window.__opts.notify_service = "notify.mobile_app_dani_iphone"; });
    await tap('.dev[data-open="d"]');
    await wait(`return r.querySelector("dialog.device")?.open && r.querySelector(".sub-tabs")`);
    await tap('.sub-tab[data-tab="magic"]');
    await wait(`return !!r.querySelector('[data-mg="add"]')`);
    await tap('[data-mg="add"]');

    check(`[${tag}] Schritt 1: Karte "${T.card}" vor den Entitäten`, await wait(`const c = r.querySelector('${W} [data-mg="pick-time"]'); return !!c && c.textContent.includes(${JSON.stringify(T.card)}) && !!r.querySelector('${W} [data-mg="pick"]')`));
    await tap(`${W} [data-mg="pick-time"]`);
    check(`[${tag}] Zeit-Bedingung offen: "Uhrzeit", 10:00, keine Wochentage gewählt, Weiter frei`, await wait(`const i = r.querySelector('${W} input[data-mg="tfrom"]'); return i?.value === "10:00" && !r.querySelector('${W} input[data-mg="tto"]') && r.querySelectorAll('${W} .mg-day').length === 7 && !r.querySelector('${W} .mg-day.on') && r.querySelector('${W} [data-mg="next"]').disabled === false`));
    await ev(`const i = r.querySelector('${W} input[data-mg="tfrom"]'); i.value = "12:30"; i.dispatchEvent(new Event("change", { bubbles: true }))`);
    check(`[${tag}] Uhrzeit 12:30: Kopf der Karte nennt "${T.sub}"`, await wait(`return r.querySelector('${W} .mg-lhead small').textContent.includes(${JSON.stringify(T.sub)})`));
    await tap(`${W} [data-mg="tday"][data-d="5"]`);
    await tap(`${W} [data-mg="tday"][data-d="6"]`);
    check(`[${tag}] Wochentage Sa und So gewählt, Kopf nennt "${T.sat}"`, await wait(`return r.querySelectorAll('${W} .mg-day.on').length === 2 && r.querySelector('${W} .mg-lhead small').textContent.includes(${JSON.stringify(T.sat)})`));
    await tap(`${W} [data-mg="tmode"][data-v="between"]`);
    check(`[${tag}] "Von bis": zweites Zeitfeld mit Ende eine Stunde später`, await wait(`return r.querySelector('${W} input[data-mg="tto"]')?.value === "13:30"`));
    check(`[${tag}] "Von bis" allein: Hinweis "${T.needs}" steht schon da, "Weiter" bleibt anklickbar`, await wait(`return !!r.querySelector('${W} .opt-error') && r.querySelector('${W} .opt-error').textContent.includes(${JSON.stringify(T.needs)}) && r.querySelector('${W} [data-mg="next"]').disabled === false && !r.querySelector('${W} .mg-timewarn')`));
    await tap(`${W} [data-mg="next"]`);
    check(`[${tag}] "Weiter" mit Zeitfenster allein: bleibt in Schritt 1 und zeigt die Warnung`, await wait(`return !!r.querySelector('${W} .mg-timewarn') && r.querySelector('${W} .mg-big').textContent.includes(${JSON.stringify(T.q1)}) && !!r.querySelector('${W} input[data-mg="tto"]')`));
    await f.evaluate(() => document.querySelector("device-panel")._magic.save());
    check(`[${tag}] Speichern mit Zeitfenster allein: kein magic_save, die Warnung bleibt`, (await p.evaluate(() => window.__wsCalls.filter((m) => m.type.endsWith("magic_save")).length)) === 0 && (await wait(`return !!r.querySelector('${W} .mg-timewarn')`)));
    await ev(`const i = r.querySelector('${W} input[data-mg="tto"]'); i.value = "12:30"; i.dispatchEvent(new Event("input", { bubbles: true }))`);
    check(`[${tag}] Ende gleich Beginn: "Weiter" gesperrt`, await wait(`return r.querySelector('${W} [data-mg="next"]').disabled === true`));
    await tap(`${W} [data-mg="tmode"][data-v="from"]`);
    check(`[${tag}] zurück auf "Uhrzeit": Warnung weg, Ende weg, "Weiter" frei`, await wait(`return !r.querySelector('${W} input[data-mg="tto"]') && r.querySelector('${W} [data-mg="next"]').disabled === false`));

    // durch alle Schritte bis Speichern
    for (let i = 0; i < 5; i++) {
      const nextBtn = await handle(`${W} [data-mg="next"]`);
      if (!nextBtn) break;
      await tap(`${W} [data-mg="next"]`);
      await p.waitForTimeout(150);
    }
    await tap(`${W} [data-mg="save"]`);
    await wait(`return !r.querySelector("${W}")?.open`);
    const saved = await p.evaluate(() => window.__wsCalls.filter((m) => m.type.endsWith("magic_save")).pop()?.rule);
    check(`[${tag}] gespeichert: Art "time", keine Entität, Bedingung mit 12:30, Sa und So`, saved && saved.kind === "time" && saved.entity_id === "" && saved.conditions?.items?.length === 1 && saved.conditions.items[0].from === "12:30" && saved.conditions.items[0].to === "" && JSON.stringify(saved.conditions.items[0].days) === "[5,6]", JSON.stringify(saved));
    check(`[${tag}] Name "${T.name}" aus der Bedingung`, saved?.name === T.name, saved?.name);
    check(`[${tag}] Standardtext mit {device} und {time}`, saved?.message.includes("{time}") && saved.message.includes("{device}"), saved?.message);
    check(`[${tag}] Liste zeigt die Meldung mit der Bedingung als Satz`, await wait(`return r.querySelector('.mg-card, .mg-list-card, [data-mg-rule]') !== null && r.textContent.includes(${JSON.stringify(T.sub)})`));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
