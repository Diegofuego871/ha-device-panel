// Abweichungen am Ende der Reiter (2.78.0): "Laden" und "Empfang" enden wie Ausfall und Batterie mit "Abweichungen" (Kasten "N Integrationen
// weichen ab", darunter die Geräte mit eigenen Werten, einzeln oder alle zurücksetzen, beim Speichern). Auch unter "Geräte im Panel" ›
// Geräte-Einstellungen. Deutsch und Englisch, Desktop und Handy, echte Klicks und Taps.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { grp: "Abweichungen", integ: "1 Integration weicht ab", title: "Eigene Werte der Lademeldung auf Geräten", empty: "Keine. Eigene Werte setzt man im Geräte-Popup.", vals: "Laden an · voll ab 90 % · Anstieg 15 %", live: "Live ein", toInteg: "→ Integration", diffCharge: "Laden an", none: "Alle Integrationen wie hier eingestellt." },
  en: { grp: "Exceptions", integ: "1 integration differs", title: "Own charging values on devices", empty: "None. Own values are set in the device pop-up.", vals: "Charging on · full from 90 % · rise 15 %", live: "Live on", toInteg: "→ integration", diffCharge: "Charging on", none: "All integrations as set here." },
};

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
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
    const calls = (type) => p.evaluate((t) => window.__wsCalls.filter((m) => m.type === `device_panel/${t}`), type);

    // Zwei Geräte mit eigenen Werten der Lademeldung, Shelly mit Laden an (Integration), Lademeldung global an
    const names = await p.evaluate(() => {
      const ids = ["b", "c"];
      const s = window.__devSettings;
      s.charge[ids[0]] = true; s.chargeFull[ids[0]] = 90; s.chargeRise[ids[0]] = 15;
      s.chargeLive[ids[1]] = true;
      window.__opts.notify_charge = true;
      window.__opts.charge_integrations = ["shelly"];
      return ids;
    });
    const devName = (id) => ev(`return r.host._devices.find((d) => d.id === ${JSON.stringify(id)}).name`);
    const nameB = await devName(names[0]);
    const nameC = await devName(names[1]);

    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await tap('.mon-tab[data-key="charge"]');
    await wait(`return !!r.querySelector('select[data-cfull]')`);

    // Laden: der Abschnitt steht ganz am Ende, nach der Liste der Integrationen
    check(`[${tag}] Laden: letzter Abschnitt heisst "${T.grp}", nach der Liste der Integrationen`, await ev(`const g = [...r.querySelectorAll(".mon-body .mon-grp")]; const last = g[g.length - 1]; const list = r.querySelector('[data-srch="charge"]'); return last.textContent.trim() === ${JSON.stringify(T.grp)} && !!(list.compareDocumentPosition(last) & Node.DOCUMENT_POSITION_FOLLOWING)`));
    check(`[${tag}] Laden: Kasten "${T.integ}" mit Shelly und "${T.diffCharge}"`, await ev(`const d = r.querySelector(".mon-diff"); return d.querySelector(".opt-label").textContent.trim() === ${JSON.stringify(T.integ)} && d.textContent.includes("Shelly") && d.textContent.includes(${JSON.stringify(T.diffCharge)})`));
    check(`[${tag}] Laden: Liste "${T.title}" mit beiden Geräten`, await ev(`const o = r.querySelector(".ovr-opt"); const rows = [...o.querySelectorAll(".ovr-row")]; return o.querySelector(".opt-label").textContent.trim() === ${JSON.stringify(T.title)} && rows.length === 2 && rows.some((x) => x.querySelector(".ovr-name").textContent.includes(${JSON.stringify(nameB)})) && rows.some((x) => x.querySelector(".ovr-name").textContent.includes(${JSON.stringify(nameC)}))`));
    check(`[${tag}] Laden: Werte "${T.vals}" und "${T.live}" in den Zeilen`, await ev(`const t = [...r.querySelectorAll(".ovr-opt .ovr-row")].map((x) => x.querySelector(".ovr-val").textContent.replace(/\\s+/g, " ").trim()); return t.includes(${JSON.stringify(T.vals)}) && t.includes(${JSON.stringify(T.live)})`), await ev(`return [...r.querySelectorAll(".ovr-opt .ovr-row .ovr-val")].map((x) => x.textContent.trim()).join(" | ")`));
    check(`[${tag}] Laden: ohne Querscrollen`, (await ev(`const d = r.querySelector("dialog.settings"); return d.scrollWidth - d.clientWidth`)) <= 0);
    await ev(`r.querySelector(".ovr-opt").scrollIntoView({ block: "center" })`);
    await p.waitForTimeout(250);
    await p.screenshot({ path: `${outDir}/chargediff-${tag.replace("/", "-")}.png` });

    // Einzeln zurücksetzen: Zeile durchgestrichen mit "→ Integration", Zähler am Reiter, erst beim Speichern
    await p.evaluate(() => { window.__wsCalls = []; });
    const rowB = `.ovr-opt .ovr-row:has(.ovr-name)`;
    await ev(`const row = [...r.querySelectorAll(".ovr-opt .ovr-row")].find((x) => x.querySelector(".ovr-name").textContent.includes(${JSON.stringify(nameB)})); row.querySelector(".ovr-x").scrollIntoView({ block: "center" })`);
    await ev(`[...r.querySelectorAll(".ovr-opt .ovr-row")].find((x) => x.querySelector(".ovr-name").textContent.includes(${JSON.stringify(nameB)})).querySelector(".ovr-x").click()`);
    check(`[${tag}] Zurücksetzen markiert die Zeile (durchgestrichen, "${T.toInteg}"), noch nichts gesendet`, await wait(`const row = [...r.querySelectorAll(".ovr-opt .ovr-row")].find((x) => x.querySelector(".ovr-name").textContent.includes(${JSON.stringify(nameB)})); return row.classList.contains("reset") && !!row.querySelector(".ovr-val s") && row.querySelector(".ovr-val").textContent.includes(${JSON.stringify(T.toInteg)})`) && (await calls("reset_device_settings")).length === 0);
    check(`[${tag}] Laden: Reiter zeigt den Punkt "geändert"`, await ev(`return r.querySelector('.mon-tab[data-key="charge"]').classList.contains("chg")`));
    await ev(`r.querySelector('dialog.settings [data-set="save"]').click()`);
    await wait(`return r.host._settings && !r.host._settings.saving && r.host._settings.resets.charge.size === 0`);
    const reset = (await calls("reset_device_settings")).at(-1);
    check(`[${tag}] Speichern: reset_device_settings mit charge = [Gerät b], sonst leer`, reset && JSON.stringify(reset.charge) === JSON.stringify([names[0]]) && !reset.battery.length && !reset.notify.length, JSON.stringify(reset));
    check(`[${tag}] Danach nur noch ein Gerät in der Liste, Werte des Geräts weg`, await wait(`const rows = [...r.querySelectorAll(".ovr-opt .ovr-row")]; return rows.length === 1 && rows[0].querySelector(".ovr-name").textContent.includes(${JSON.stringify(nameC)})`) && await p.evaluate((id) => !(id in window.__devSettings.charge) && !(id in window.__devSettings.chargeFull) && !(id in window.__devSettings.chargeRise), names[0]));

    // Alle zurücksetzen: Liste leer mit Hinweis
    await ev(`r.querySelector('.ovr-opt .ovr-all').click()`);
    await ev(`r.querySelector('dialog.settings [data-set="save"]').click()`);
    check(`[${tag}] Alle zurücksetzen und speichern: "${T.empty}"`, await wait(`const o = r.querySelector(".ovr-opt"); return !!o && !o.querySelector(".ovr-row") && o.textContent.includes(${JSON.stringify(T.empty)})`));

    // Empfang: der Kasten der Integrationen steht vor den Geräten
    await tap('.mon-tab[data-key="sig"]');
    await wait(`return !!r.querySelector(".ovr-opt")`);
    check(`[${tag}] Empfang: "${T.grp}" mit dem Kasten der Integrationen vor der Liste der Geräte`, await ev(`const g = [...r.querySelectorAll(".mon-body .mon-grp")].pop(); const box = r.querySelector(".mon-diff"); const list = r.querySelector(".ovr-opt"); return g.textContent.trim() === ${JSON.stringify(T.grp)} && !!box && !!(box.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING) && !!(g.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING)`));

    // Geräte-Einstellungen unter "Geräte im Panel": auch die Lade-Werte
    await p.evaluate(() => { window.__devSettings.chargeStall.b = 30; });
    await ev(`r.host._closeSettings?.(); const d = r.querySelector("dialog.settings"); if (d.open) d.close();`);
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="devices"]');
    await tap('[data-set="subtab"][data-key="devset"]');
    check(`[${tag}] Geräte-Einstellungen: Liste "${T.title}" mit dem Gerät`, await wait(`const o = [...r.querySelectorAll(".ovr-opt")].find((x) => x.querySelector(".opt-label").textContent.trim() === ${JSON.stringify(T.title)}); return !!o && o.querySelectorAll(".ovr-row").length >= 1`), await ev(`return [...r.querySelectorAll(".ovr-opt .opt-label")].map((x) => x.textContent.trim()).join(" | ")`));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
