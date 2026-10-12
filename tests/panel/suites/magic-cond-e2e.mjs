// Magic Push (2.15.0): mehrere verknüpfte Bedingungen (Und/Oder, eine Ebene Gruppen) auf der ersten Seite des Assistenten:
// Bedingung hinzufügen (Auswahl wie am Anfang, Abbrechen), Karten auf- und zuklappen, Entität ändern, entfernen, Und/Oder,
// Gruppen mit eigenem Schalter, "ändert sich" nur allein, Obergrenze, Rückblick je Bedingung und zusammen (Schritt 2),
// Speichern mit Bedingungsbaum, Bearbeiten, Satz in der Liste und in der Vorschau. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { and: "und", or: "oder", q1b: "Welche Bedingungen?", q2: "Wie lange muss das zutreffen?", together: "Zusammen", limit: "Höchstens 10 Bedingungen", add: "Bedingung", wait: "Abbrechen" },
  en: { and: "and", or: "or", q1b: "Which conditions?", q2: "How long must this hold?", together: "Together", limit: "At most 10 conditions", add: "Condition", wait: "Cancel" },
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
          if (i >= 3 || !/not attached|detached/.test(String(err))) throw err;
          await new Promise((r) => setTimeout(r, 150));
        }
      }
    };
    const fill = async (sel, value) => { const h = await handle(sel); await h.scrollIntoViewIfNeeded(); await h.fill(value); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const calls = (type) => p.evaluate((t) => window.__wsCalls.filter((m) => m.type === `device_panel/${t}`), type);
    const root = ".mg-root";
    const W = "dialog.magic-dlg";
    const next = async () => { await tap('[data-mg="next"]'); };
    const leaves = () => ev(`return r.querySelectorAll('${W} .mg-lcard').length`);
    const names = () => ev(`return [...r.querySelectorAll('${W} .mg-lcard .mg-lmain b')].map(b => b.textContent.trim()).join("|")`);
    const pick = async (id) => { await tap(`.mg-pick[data-id="${id}"]`); await wait(`return !!r.querySelector('${W} .mg-lcard.open')`); };

    await p.evaluate(() => { window.__opts.notify_service = "notify.mobile_app_dani_iphone"; });
    await tap('.dev[data-open="d"]');
    await wait(`return r.querySelector("dialog.device")?.open && r.querySelector(".sub-tabs")`);
    await tap('.sub-tab[data-tab="magic"]');
    await wait(`return !!r.querySelector('${root} [data-mg="add"]')`);
    await tap('[data-mg="add"]');

    // --- erste Bedingung, dann Hinzufügen ---
    await pick("sensor.temp");
    await fill('input[data-mg="value"]', "12");
    await tap('[data-mg="add-cond"]');
    check(`[${tag}] Hinzufügen öffnet die Auswahl mit Hinweis; "Weiter" gesperrt, die erste Bedingung bleibt`, await wait(`return r.querySelectorAll('${W} .mg-pick[data-id]').length === 5 && r.querySelector('${W} [data-mg="next"]').disabled === true && !!r.querySelector('${W} .mg-note')`) && (await ev(`return r.querySelector('${W} .mg-big').textContent.trim()`)).length > 0);
    await tap('[data-mg="cancel"]');
    check(`[${tag}] Abbrechen beim Hinzufügen geht zurück zur Liste (Fenster bleibt, eine Bedingung)`, await wait(`return r.querySelector("${W}").open && r.querySelectorAll('${W} .mg-lcard').length === 1 && r.querySelector('${W} .mg-big').textContent.trim() === ${JSON.stringify(T.q1b)}`));
    await tap('[data-mg="add-cond"]');
    await pick("binary_sensor.window");
    check(`[${tag}] zweite Bedingung (Fenster) offen, die erste zu; nur noch eine Karte offen`, (await leaves()) === 2 && (await ev(`return r.querySelectorAll('${W} .mg-lcard.open').length`)) === 1 && (await text(`${W} .mg-lcard.open .mg-lmain b`)) === "Fenster");
    check(`[${tag}] ab zwei Bedingungen: Und/Oder, Satz "Melden, wenn …", UND zwischen den Karten`, await wait(`return r.querySelectorAll('${W} [data-mg="op"]').length === 2 && r.querySelector('${W} [data-mg="op"][data-v="and"]').classList.contains("on") && r.querySelector('${W} .mg-join')?.textContent.trim() === ${JSON.stringify(T.and)} && r.querySelector('${W} .mg-sumline').textContent.includes("Temperatur") && r.querySelector('${W} .mg-sumline').textContent.includes("Fenster")`), await text(`${W} .mg-sumline`));
    check(`[${tag}] Fenster: nur "ist" (kein "ändert sich" mit mehreren Bedingungen)`, (await ev(`return [...r.querySelectorAll('${W} .mg-lcard.open [data-mg="kind"]')].map(b => b.dataset.kind).join()`)) === "is");
    await tap('[data-mg="state"][data-v="on"]');
    await tap('[data-mg="leaf-open"][data-uid]:not([aria-expanded="true"])');
    check(`[${tag}] Temperatur offen: über, unter, ist gleich (kein "ändert sich"), "unter 12"`, (await ev(`return [...r.querySelectorAll('${W} .mg-lcard.open [data-mg="kind"]')].map(b => b.dataset.kind).join()`)) === "above,below,is" && (await ev(`return r.querySelector('${W} .mg-lcard.open input[data-mg="value"]').value`)) === "12");
    await tap('[data-mg="op"][data-v="or"]');
    check(`[${tag}] "Oder" gewählt: Satz und Verbindungswort ändern sich`, await wait(`return r.querySelector('${W} .mg-join')?.textContent.trim() === ${JSON.stringify(T.or)} && r.querySelector('${W} .mg-sumline').textContent.includes(${JSON.stringify(` ${T.or} `)})`));
    await tap('[data-mg="op"][data-v="and"]');

    // --- Gruppe ---
    await tap('[data-mg="add-group"]');
    await pick("sensor.humidity");
    check(`[${tag}] Gruppe mit der Bedingung, Gruppen-Schalter "alle / eine genügt" (Vorgabe: eine genügt)`, await wait(`return r.querySelectorAll('${W} .mg-group').length === 1 && r.querySelectorAll('${W} .mg-group [data-mg="gop"]').length === 2 && r.querySelector('${W} .mg-group [data-mg="gop"][data-v="or"]').classList.contains("on")`));
    await tap('[data-mg="add-in"]');
    await pick("sensor.battery");
    check(`[${tag}] zweite Bedingung in der Gruppe, ODER dazwischen, Satz mit Klammer`, await wait(`const g=r.querySelector('${W} .mg-group'); return g.querySelectorAll('.mg-lcard').length === 2 && g.querySelector('.mg-join')?.textContent.trim() === ${JSON.stringify(T.or)} && /\\(.+\\)/.test(r.querySelector('${W} .mg-sumline').textContent)`), await text(`${W} .mg-sumline`));
    await tap('[data-mg="gop"][data-v="and"]');
    check(`[${tag}] Gruppe auf "alle": UND in der Gruppe`, await wait(`return r.querySelector('${W} .mg-group .mg-join')?.textContent.trim() === ${JSON.stringify(T.and)}`));
    check(`[${tag}] Kapsel der Gruppen-Leiste liegt unter dem gewählten Knopf`, await (async () => { await p.waitForTimeout(700); return (await ev(`const b=r.querySelector('${W} .mg-group .sub-tabs'); const p=b?.querySelector(":scope > .seg-pill"); const on=b?.querySelector(".sub-tab.on"); if(!p||!on) return "none"; const m=new DOMMatrix(getComputedStyle(p).transform); return [Math.round(m.m41-on.offsetLeft), Math.round(m.m42-on.offsetTop)].join()`)) === "0,0"; })());
    check(`[${tag}] Schritt 1 ohne Querscrollen`, (await ev(`const d=r.querySelector("${W}"); return d.scrollWidth - d.clientWidth`)) <= 0);
    check(`[${tag}] Touch-Ziele: Entfernen-Knopf (x) mindestens 44 px, Pfeil mindestens 40 px und sichtbar`, await ev(`const x=[...r.querySelectorAll('${W} .mg-lcard [data-mg="leaf-del"], ${W} [data-mg="group-del"]')]; const c=[...r.querySelectorAll('${W} .mg-lchev')]; return x.length > 0 && c.length > 0 && x.every((b) => { const q=b.getBoundingClientRect(); return q.width >= 44 && q.height >= 44; }) && c.every((b) => { const q=b.getBoundingClientRect(); return q.width >= 40 && q.height >= 40 && !!b.querySelector('svg'); })`));
    await p.screenshot({ path: `${outDir}/magic-cond-${tag.replace("/", "-")}-1.png` });

    // --- Entität ändern, entfernen ---
    await tap('[data-mg="leaf-open"][aria-expanded="false"] >> nth=0').catch(() => {});
    await ev(`r.querySelector('${W} [data-mg="leaf-open"]').click()`);
    await wait(`return !!r.querySelector('${W} .mg-lcard.open')`);
    await tap('[data-mg="leaf-entity"]');
    check(`[${tag}] "Entität ändern" öffnet die Auswahl, die Anzahl bleibt`, await wait(`return r.querySelectorAll('${W} .mg-pick[data-id]').length === 5`) && (await ev(`return r.querySelectorAll('${W} [data-mg="leaf-del"]').length`)) === 0);
    await tap('.mg-pick[data-id="sensor.humidity"]');
    await wait(`return !!r.querySelector('${W} .mg-lcard.open')`);
    check(`[${tag}] erste Bedingung ist jetzt die Luftfeuchtigkeit (Reihenfolge bleibt, vier Bedingungen)`, (await leaves()) === 4 && (await names()).startsWith("Luftfeuchtigkeit|") && (await ev(`return r.querySelector('${W} .mg-lcard.open input[data-mg="value"]').value`)) === "71");
    await tap('.mg-lcard [data-mg="leaf-del"] >> nth=0').catch(() => {});
    await ev(`r.querySelector('${W} .mg-group [data-mg="leaf-del"]').click()`);
    check(`[${tag}] Bedingung in der Gruppe entfernt: Gruppe bleibt mit einer`, await wait(`return r.querySelectorAll('${W} .mg-group .mg-lcard').length === 1 && r.querySelectorAll('${W} .mg-lcard').length === 3`));
    await ev(`r.querySelector('${W} [data-mg="group-del"]').click()`);
    check(`[${tag}] Gruppe entfernt: zwei Bedingungen, keine Gruppe`, await wait(`return r.querySelectorAll('${W} .mg-group').length === 0 && r.querySelectorAll('${W} .mg-lcard').length === 2`));
    // Entfernen bis zu einer: kein Und/Oder mehr, "ändert sich" wieder möglich
    await ev(`r.querySelectorAll('${W} [data-mg="leaf-del"]')[1].click()`);
    check(`[${tag}] eine Bedingung übrig: kein Und/Oder, die Karte ist offen, "ändert sich" wieder wählbar`, await wait(`return r.querySelectorAll('${W} .mg-lcard').length === 1 && !r.querySelector('${W} [data-mg="op"]') && !!r.querySelector('${W} .mg-lcard.open [data-mg="kind"][data-kind="change"]')`));
    // Obergrenze: zehn Bedingungen
    for (let i = 0; i < 9; i++) {
      await tap('[data-mg="add-cond"]');
      await pick("sensor.battery");
    }
    check(`[${tag}] zehn Bedingungen: Knöpfe zum Hinzufügen weg, Hinweis "${T.limit}"`, await wait(`return r.querySelectorAll('${W} .mg-lcard').length === 10 && !r.querySelector('${W} [data-mg="add-cond"]') && r.querySelector('${W} .mg-limit')?.textContent.includes(${JSON.stringify(T.limit)})`));
    for (let i = 0; i < 8; i++) {
      await ev(`const x=[...r.querySelectorAll('${W} [data-mg="leaf-del"]')]; x[x.length - 1].click()`);
      await wait(`return r.querySelectorAll('${W} .mg-lcard').length === ${9 - i}`);
    }

    // --- Rückblick (Schritt 2), Reset je Bedingung, Speichern ---
    await ev(`r.querySelectorAll('${W} [data-mg="leaf-open"]')[1].click()`);
    await wait(`return r.querySelector('${W} .mg-lcard.open .mg-lmain b')`);
    check(`[${tag}] die zweite Bedingung (Batterie) ist offen, mit eigenem "Zurücksetzen"`, !!(await handle(`${W} .mg-lcard.open [data-mg="reset-mode"]`)));
    await tap('[data-mg="kind"][data-kind="above"]');
    await fill('input[data-mg="value"]', "50");
    await tap('[data-mg="reset-mode"][data-own="1"]');
    await fill('input[data-mg="reset-value"]', "40");
    check(`[${tag}] Rücksetzwert der zweiten Bedingung wird je Bedingung geprüft: 40 unter der Schwelle 50 gilt für "über"`, await wait(`return !r.querySelector('${W} [data-mg-zone="resethint"] .opt-error')`));
    await fill('input[data-mg="reset-value"]', "60");
    check(`[${tag}] Rücksetzwert 60 über der Schwelle (über): Fehler, "Weiter" gesperrt`, await wait(`return !!r.querySelector('${W} [data-mg-zone="resethint"] .opt-error') && r.querySelector('${W} [data-mg="next"]').disabled === true`));
    await fill('input[data-mg="reset-value"]', "40");
    await wait(`return r.querySelector('${W} [data-mg="next"]').disabled === false`);
    await next();
    await wait(`return r.querySelectorAll('${W} .mg-stp.on').length === 2`);
    check(`[${tag}] Schritt 2 mit zwei Bedingungen: eine Zeile je Bedingung und "${T.together}"`, await wait(`return r.querySelectorAll('${W} .mg-tlr').length === 3 && r.querySelector('${W} .mg-tlr.tot')?.textContent.includes(${JSON.stringify(T.together)})`));
    await fill('input[data-mg="for-own"]', "30");
    await p.waitForTimeout(700);
    const hist = (await calls("magic_history")).at(-1);
    check(`[${tag}] Rückblick bekommt den Bedingungsbaum mit Und, beiden Bedingungen und der Dauer`, hist?.conditions?.op === "and" && hist.conditions.items.length === 2 && hist.conditions.items[1].kind === "above" && hist.conditions.items[1].value === 50 && hist.conditions.items[1].reset_value === 40 && !JSON.stringify(hist.conditions).includes("uid") && hist.for_s === 1800, JSON.stringify(hist));
    check(`[${tag}] Rückblick-Text vorhanden`, await wait(`return !!r.querySelector('${W} .mg-hist')?.textContent.includes("1")`));
    await next();
    await next();
    await fill('[data-mg-text="message"]', "Alles zugleich: {conditions}");
    check(`[${tag}] Vorschau: {conditions} nennt beide Bedingungen`, await wait(`const t=r.querySelector('${W} .mg-pv .pv-title')?.textContent || ""; return t.startsWith("Alles zugleich: ") && t.includes("Luftfeuchtigkeit") && t.includes("Batterie")`), await text(`${W} .mg-pv .pv-title`));
    await next();
    await fill('input[data-mg="name"]', "Feucht und leer");
    await tap('[data-mg="save"]');
    await wait(`return r.querySelectorAll('${root} .mg-card').length >= 1 && !r.querySelector("${W}").open`);
    const saved = (await calls("magic_save")).at(-1)?.rule;
    check(`[${tag}] Speichern: Bedingungsbaum mit Zahlen und Rücksetzwert, erste Bedingung auch in den alten Feldern`, saved?.conditions?.op === "and" && saved.conditions.items.length === 2 && saved.entity_id === "sensor.humidity" && saved.kind === "below" && saved.conditions.items[1].entity_id === "sensor.battery" && saved.conditions.items[1].kind === "above" && saved.conditions.items[1].value === 50 && saved.conditions.items[1].reset_value === 40 && !JSON.stringify(saved).includes("uid") && saved.for_s === 1800, JSON.stringify(saved));
    check(`[${tag}] Liste: der Satz nennt beide Bedingungen mit "${T.and}"`, await wait(`const t=[...r.querySelectorAll('${root} .mg-card')].find(c => c.textContent.includes("Feucht und leer"))?.textContent || ""; return t.includes("Luftfeuchtigkeit") && t.includes("Batterie") && t.includes(${JSON.stringify(` ${T.and} `)})`));

    // --- Bearbeiten: der Baum kommt zurück ---
    await ev(`[...r.querySelectorAll('${root} .mg-card')].find(c => c.textContent.includes("Feucht und leer")).querySelector('[data-mg="edit"]').click()`);
    await wait(`return r.querySelector("${W}").open && r.querySelectorAll('${W} .mg-lcard').length === 2`);
    check(`[${tag}] Bearbeiten: zwei Bedingungen, Und, keine Karte offen, Satz`, (await ev(`return r.querySelectorAll('${W} .mg-lcard.open').length`)) === 0 && (await ev(`return r.querySelector('${W} [data-mg="op"][data-v="and"]').classList.contains("on")`)) && (await text(`${W} .mg-sumline`)).includes("Batterie"));
    await ev(`r.querySelectorAll('${W} [data-mg="leaf-open"]')[1].click()`);
    check(`[${tag}] Bearbeiten: Rücksetzwert 40 der zweiten Bedingung ist da`, await wait(`return r.querySelector('${W} input[data-mg="reset-value"]')?.value === "40" && r.querySelector('${W} [data-mg="reset-mode"][data-own="1"]').classList.contains("on")`));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ev(`r.host._magic.closeWizard()`);
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
