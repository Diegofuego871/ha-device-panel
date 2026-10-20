// Magic Push, neue Meldung aus dem Fenster aller Meldungen (2.102.0): das Knopf unten öffnet den Assistenten mit einem Schritt "Gerät"
// davor (Schritt 1 von 6). Gerät suchen und wählen, "Weiter" lädt die Entitäten des Geräts, "Zurück" kehrt zur Gerätewahl zurück
// (die Wahl bleibt), ein anderes Gerät beginnt den Entwurf von vorn, "Abbrechen" schliesst ohne Rückfrage. Dazu der ganze Weg
// bis "Speichern": die Meldung gehört zum gewählten Gerät und steht danach in der Übersicht. Deutsch und Englisch, Desktop
// und Handy, echte Klicks und Taps.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { step: (n, t) => `Schritt ${n} von ${t}`, dev: "Gerät", cond: "Bedingungen", q0: "Zu welchem Gerät gehört die Meldung?", none: "Keine Treffer" },
  en: { step: (n, t) => `Step ${n} of ${t}`, dev: "Device", cond: "Conditions", q0: "Which device does the message belong to?", none: "No matches" },
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
    const tap = async (sel) => {
      for (let i = 0; ; i++) {
        try {
          const h = await handle(sel);
          if (!h) throw new Error("fehlt: " + sel);
          await h.scrollIntoViewIfNeeded();
          if (mobile) await h.tap(); else await h.click();
          return;
        } catch (err) {
          if (i >= 3 || !/not attached|detached|not stable/.test(String(err))) throw err;
          await new Promise((r) => setTimeout(r, 150));
        }
      }
    };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const calls = (t) => p.evaluate((x) => window.__wsCalls.filter((m) => m.type === `device_panel/${x}`), t);
    const W = "dialog.magic-dlg";
    const stepText = () => text(`${W} .mg-stephead span`);
    const fill = async (sel, value) => { await ev(`const i = r.querySelector(${JSON.stringify(sel)}); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new Event("input", { bubbles: true }))`); };

    await p.evaluate(() => {
      window.__opts.notify_service = "notify.mobile_app_dani_iphone";
      window.__magic = { rules: [], tests: [], seq: 10 };
    });
    await ev(`r.host._openMagicAll()`);
    await wait(`return r.querySelector("dialog.mgall-dlg")?.open`);

    // Der Knopf unten klebt: bei langer Liste bleibt er am unteren Rand des Fensters sichtbar, oben wie nach dem Scrollen
    await p.evaluate(() => {
      window.__magic = { rules: Array.from({ length: 40 }, (_, i) => ({ id: `r${String(i).padStart(11, "0")}`, device_id: i % 2 ? "d" : "h", entity_id: "sensor.temp", name: `Meldung ${i}`, kind: "below", value: 12, for_s: 600, message: "m {value}", body: "", recover: false, recover_message: "", recover_body: "", repeat_s: 0, target: null, enabled: true, critical: false, critical_volume: 10, reset_value: null, reset_for_s: 0, conditions: null, created: 1 })), tests: [], seq: 100 };
    });
    await ev(`r.host._closeMagicAll(); r.host._openMagicAll()`);
    await wait(`return r.querySelectorAll('dialog.mgall-dlg [data-mga-body] .mg-card').length > 10`);
    const barVisible = () => ev(`const d = r.querySelector("dialog.mgall-dlg").getBoundingClientRect(); const x = r.querySelector('dialog.mgall-dlg .dlg-addbar .mg-add').getBoundingClientRect(); return x.height > 20 && x.top >= d.top && x.bottom <= d.bottom + 1`);
    check(`[${tag}] Knopf unten sichtbar (Liste ungescrollt)`, await barVisible());
    await ev(`for (const el of [r.querySelector("dialog.mgall-dlg"), r.querySelector("dialog.mgall-dlg .dlg-body")]) if (el) el.scrollTop = el.scrollHeight`);
    await p.waitForTimeout(150);
    check(`[${tag}] Knopf unten sichtbar (ganz nach unten gescrollt)`, await barVisible());
    await ev(`for (const el of [r.querySelector("dialog.mgall-dlg"), r.querySelector("dialog.mgall-dlg .dlg-body")]) if (el) el.scrollTop = Math.round(el.scrollHeight / 2)`);
    await p.waitForTimeout(150);
    check(`[${tag}] Knopf unten sichtbar (mitten in der Liste)`, await barVisible());
    check(`[${tag}] kein Plus mehr im Kopf`, !(await ev(`return !!r.querySelector("dialog.mgall-dlg .dlg-head .dlg-add")`)));
    await ev(`r.host._closeMagicAll()`);
    await p.evaluate(() => { window.__magic = { rules: [], tests: [], seq: 10 }; });
    await ev(`r.host._openMagicAll()`);
    await wait(`return r.querySelector("dialog.mgall-dlg")?.open`);

    // Knopf → Schritt "Gerät"
    await tap('dialog.mgall-dlg [data-mga="magic-add"]');
    check(`[${tag}] Knopf unten öffnet den Assistenten, Schritt 1 von 6 "${T.dev}" mit der Frage`, await wait(`return r.querySelector("${W}")?.open && r.querySelector("${W} .mg-stephead span")?.textContent === ${JSON.stringify(T.step(1, 6))} && r.querySelector("${W} .mg-big")?.textContent.trim() === ${JSON.stringify(T.q0)}`), await stepText());
    check(`[${tag}] Schrittleiste: sechs Balken, nur der erste an, Kopf ohne Gerätename`, (await ev(`return r.querySelectorAll('${W} .mg-stp').length`)) === 6 && (await ev(`return r.querySelectorAll('${W} .mg-stp.on').length`)) === 1 && !(await ev(`return !!r.querySelector('${W} .mgw-t small')`)));
    const n = await ev(`return r.querySelectorAll('${W} [data-mg="dev"]').length`);
    check(`[${tag}] Geräteliste (${n}), "Weiter" gesperrt, Knopf "Abbrechen"`, n > 3 && (await ev(`return r.querySelector('${W} [data-mg="next"]').disabled`)) === true && !!(await handle(`${W} [data-mg="cancel"]`)));
    // Suche
    await fill('input[data-mg="dev-search"]', "zzzz");
    check(`[${tag}] Suche ohne Treffer: "${T.none}"`, await wait(`return r.querySelectorAll('${W} [data-mg="dev"]').length === 0 && r.querySelector('${W} [data-mg-zone="devs"]').textContent.includes(${JSON.stringify(T.none)})`));
    await fill('input[data-mg="dev-search"]', "");
    check(`[${tag}] Suche leer: alle wieder da`, await wait(`return r.querySelectorAll('${W} [data-mg="dev"]').length === ${n}`));
    await fill('input[data-mg="dev-search"]', "Steckdose");
    await wait(`return r.querySelectorAll('${W} [data-mg="dev"]').length < ${n}`);
    // Gerät wählen
    await tap(`${W} [data-mg="dev"][data-id="d"]`);
    check(`[${tag}] Gerät gewählt: Radio an, "Weiter" frei`, await wait(`return r.querySelector('${W} [data-mg="dev"][data-id="d"]').getAttribute("aria-checked") === "true" && r.querySelector('${W} [data-mg="next"]').disabled === false`));
    await tap(`${W} [data-mg="next"]`);
    check(`[${tag}] Weiter: Schritt 2 von 6 "${T.cond}", die Entitäten des Geräts, Kopf nennt das Gerät`, await wait(`return r.querySelector("${W} .mg-stephead span")?.textContent === ${JSON.stringify(T.step(2, 6))} && r.querySelectorAll('${W} .mg-pick[data-id]').length === 5 && r.querySelector("${W} .mgw-t small")?.textContent.includes("Steckdose")`), await stepText());
    check(`[${tag}] magic_get für das Gerät geholt`, (await calls("magic_get")).some((m) => m.device_id === "d"));
    check(`[${tag}] Knopf "Zurück" (nicht "Abbrechen") und Balken 1 anklickbar`, !!(await handle(`${W} [data-mg="back"]`)) && !(await handle(`${W} [data-mg="cancel"]`)) && (await ev(`return r.querySelectorAll('${W} button.mg-stp').length`)) === 1);
    // Entität wählen, zurück, Wahl bleibt
    await tap(`${W} .mg-pick[data-id="sensor.temp"]`);
    await wait(`return r.querySelectorAll('${W} .mg-lcard').length === 1`);
    await tap(`${W} [data-mg="back"]`);
    check(`[${tag}] Zurück: wieder Schritt 1 von 6, das Gerät ist noch gewählt`, await wait(`return r.querySelector("${W} .mg-stephead span")?.textContent === ${JSON.stringify(T.step(1, 6))} && r.querySelector('${W} [data-mg="dev"][data-id="d"]')?.getAttribute("aria-checked") === "true"`), await stepText());
    await tap(`${W} [data-mg="next"]`);
    check(`[${tag}] Dasselbe Gerät noch einmal: die gewählte Bedingung ist noch da, kein neuer Abruf`, await wait(`return r.querySelectorAll('${W} .mg-lcard').length === 1`) && (await calls("magic_get")).length === 1);
    // Anderes Gerät: Entwurf von vorn
    await tap(`${W} [data-mg="back"]`);
    await fill('input[data-mg="dev-search"]', "");
    await wait(`return r.querySelectorAll('${W} [data-mg="dev"]').length === ${n}`);
    const other = await ev(`return [...r.querySelectorAll('${W} [data-mg="dev"]')].map((x) => x.dataset.id).find((x) => x !== "d")`);
    await tap(`${W} [data-mg="dev"][data-id="${other}"]`);
    await tap(`${W} [data-mg="next"]`);
    check(`[${tag}] Anderes Gerät: Entwurf von vorn (keine Bedingung), neuer Abruf`, await wait(`return r.querySelectorAll('${W} .mg-pick[data-id]').length === 5 && r.querySelectorAll('${W} .mg-lcard').length === 0`) && (await calls("magic_get")).some((m) => m.device_id === other));
    await tap(`${W} [data-mg="back"]`);
    await tap(`${W} [data-mg="cancel"]`);
    check(`[${tag}] Abbrechen im Schritt "${T.dev}": Fenster zu ohne Rückfrage, Übersicht bleibt offen`, await wait(`return !r.querySelector("${W}").open && r.querySelector("dialog.mgall-dlg").open`));

    // Der ganze Weg bis Speichern
    await tap('dialog.mgall-dlg [data-mga="magic-add"]');
    await wait(`return r.querySelector("${W} .mg-stephead span")?.textContent === ${JSON.stringify(T.step(1, 6))}`);
    check(`[${tag}] Zweiter Start: Auswahl und Suche sind leer`, (await ev(`return r.querySelector('${W} [data-mg="next"]').disabled`)) === true && (await ev(`return r.querySelector('${W} input[data-mg="dev-search"]').value`)) === "");
    await tap(`${W} [data-mg="dev"][data-id="d"]`);
    await tap(`${W} [data-mg="next"]`);
    await wait(`return r.querySelectorAll('${W} .mg-pick[data-id]').length === 5`);
    await tap(`${W} .mg-pick[data-id="sensor.temp"]`);
    await wait(`return r.querySelector('${W} [data-mg="next"]').disabled === false`);
    for (let i = 3; i <= 6; i += 1) {
      await tap(`${W} [data-mg="next"]`);
      check(`[${tag}] Weiter: ${T.step(i, 6)}`, await wait(`return r.querySelector("${W} .mg-stephead span")?.textContent === ${JSON.stringify(T.step(i, 6))}`), await stepText());
    }
    check(`[${tag}] Letzter Schritt: Name vorgeschlagen, "Speichern" frei`, await wait(`return r.querySelector('${W} input[data-mg="name"]').value.length > 0 && r.querySelector('${W} [data-mg="save"]').disabled === false`));
    await tap(`${W} [data-mg="save"]`);
    check(`[${tag}] Gespeichert: Fenster zu, Übersicht zeigt die Meldung beim gewählten Gerät`, await wait(`return !r.querySelector("${W}").open && /^1 /.test(r.querySelector('dialog.mgall-dlg .mg-count')?.textContent.trim() || "")`));
    const saved = (await calls("magic_save")).at(-1)?.rule;
    check(`[${tag}] magic_save mit dem gewählten Gerät und der Entität`, saved?.device_id === "d" && saved?.entity_id === "sensor.temp" && !saved?.id, JSON.stringify(saved)?.slice(0, 200));
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
