// Automatisch installieren (2.22.0, Wunsch des Nutzers): Schalter in Einstellungen › Panel, nur zusammen mit der
// täglichen Prüfung; wer von Hand nach Updates sucht und eines findet, muss nicht ein zweites Mal "Aktualisieren"
// drücken. Der Neustart bleibt Sache des Benutzers. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const HACS_ID = "update.device_panel_update";
const TEXT = {
  de: { label: "Updates automatisch installieren", need: "Nur möglich mit eingeschalteter täglicher Prüfung.", sumAuto: "Tägliche Prüfung · installiert automatisch", sumOn: "Tägliche Prüfung · neue Version unter \"Reparaturen\"", restart: "0.5.0 installiert – Neustart nötig" },
  en: { label: "Install updates automatically", need: "Only possible with the daily check turned on.", sumAuto: "Daily check · installs automatically", sumOn: "Daily check · new version under \"Repairs\"", restart: "0.5.0 installed – restart required" },
};

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1400, height: 1000 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("dialog", (d) => d.accept());
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const tap = async (sel) => {
      for (let n = 1; ; n++) {
        const h = (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
        if (!h) throw new Error("fehlt: " + sel);
        try { await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); return; } catch (err) { if (n >= 3 || !/not attached|not stable/.test(String(err))) throw err; await p.waitForTimeout(200); }
      }
    };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const setHacs = (attrs) => p.evaluate(({ attrs, id }) => {
      const ha = document.querySelector("home-assistant").hass;
      ha.entities[id] = { entity_id: id, platform: "hacs", device_id: "hacs-dev-1" };
      ha.states[id] = { entity_id: id, state: attrs.latest_version !== attrs.installed_version ? "on" : "off",
        attributes: { title: "Device Panel", release_url: `https://github.com/Diegofuego871/ha-device-panel/releases/v${attrs.latest_version}`, in_progress: false, ...attrs } };
    }, { attrs, id: HACS_ID });
    const services = () => p.evaluate(() => window.__services);
    const verText = () => ev(`return r.querySelector("dialog.settings .ver-slot")?.innerText.replace(/\\s+/g," ") || ""`);
    const setCalls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_panel"));
    const openUpdates = async () => {
      if (!(await ev(`return r.querySelector("dialog.settings")?.open`))) { await tap(".gear-btn"); await wait(`return !!r.querySelector("dialog.settings .set-sec")`); }
      if ((await ev(`return r.querySelector('[data-set="section"][data-id="updates"]').getAttribute("aria-expanded")`)) !== "true") await tap('[data-set="section"][data-id="updates"]');
      return wait(`return !!r.querySelector('input[data-auto-update]')`);
    };

    await openUpdates();
    check(`[${tag}] Zeile "${T.label}" unter Prüfung und Uhrzeit, aus`, await ev(`const i = r.querySelector('input[data-auto-update]'); return !i.checked && !i.disabled && i.getAttribute("aria-label") === ${JSON.stringify(T.label)} && i.closest(".opt").previousElementSibling?.querySelector('input[data-opt="update_check_time"]') && i.closest(".opt").previousElementSibling.previousElementSibling?.querySelector('input[data-opt="update_check"]')`));
    check(`[${tag}] Zusammenfassung ohne automatisch`, (await ev(`return r.querySelector('[data-id="updates"] .set-sec-sum').textContent.trim()`)) === T.sumOn);

    // Ohne tägliche Prüfung gesperrt und aus
    await tap('input[data-opt="update_check"]');
    check(`[${tag}] tägliche Prüfung aus: Schalter gesperrt, Hinweis "${T.need}"`, await wait(`const i = r.querySelector('input[data-auto-update]'); return i.disabled && !i.checked && r.querySelector('input[data-auto-update]').closest(".opt").textContent.includes(${JSON.stringify(T.need)})`));
    await tap('input[data-opt="update_check"]');
    check(`[${tag}] tägliche Prüfung wieder an: Schalter frei`, await wait(`return !r.querySelector('input[data-auto-update]').disabled`));

    // Einschalten gilt erst mit Speichern, als Panel-Einstellung
    await tap('input[data-auto-update]');
    check(`[${tag}] eingeschaltet: Etikett "geändert", Zusammenfassung`, await wait(`return r.querySelector('input[data-auto-update]').checked && r.querySelector('input[data-auto-update]').closest(".opt").classList.contains("changed") && r.querySelector('[data-id="updates"] .set-sec-sum').textContent.trim() === ${JSON.stringify(T.sumAuto)}`));
    check(`[${tag}] vor "Speichern" nichts gesendet`, (await setCalls()).length === 0);
    await tap('dialog.settings [data-set="save"]');
    check(`[${tag}] gespeichert: set_panel mit auto_update`, await f.waitForFunction(() => true).then(() => true) && await (async () => { for (let i = 0; i < 25; i++) { const c = await setCalls(); if (c.length) return c.at(-1).auto_update === true && !("prerelease" in c.at(-1)); await p.waitForTimeout(100); } return false; })(), JSON.stringify(await setCalls()));
    await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`);
    await tap('dialog.settings .dlg-actions [data-set="close"]');
    await wait(`return !r.querySelector("dialog.settings").open`);

    // Von Hand suchen und ein Update finden: wird sofort installiert, ohne zweiten Knopfdruck
    await p.evaluate(() => { window.__version = { installed: "0.4.0", latest: "0.5.0" }; window.__services = []; });
    await setHacs({ installed_version: "0.4.0", latest_version: "0.5.0" });
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .ver-slot .ver")`);
    // Seit 2.23.0 installiert schon das Öffnen (die Erkennung), und zwar genau einmal je Version und Sitzung
    check(`[${tag}] Öffnen erkennt 0.5.0 und installiert sofort, genau einmal`, await (async () => { for (let i = 0; i < 40; i++) { const s = (await services()).filter((x) => x.service === "install"); if (s.length) { await p.waitForTimeout(500); const n = (await services()).filter((x) => x.service === "install"); return n.length === 1 && n[0].data.entity_id === HACS_ID; } await p.waitForTimeout(100); } return false; })(), JSON.stringify(await services()));
    await p.evaluate(() => { window.__services = []; });
    await tap('[data-ver="check"]');
    check(`[${tag}] "Nach Updates suchen" findet 0.5.0 und installiert sofort`, await (async () => { for (let i = 0; i < 40; i++) { const s = (await services()).filter((x) => x.service === "install"); if (s.length) return s.length === 1 && s[0].domain === "update" && s[0].data.entity_id === HACS_ID; await p.waitForTimeout(100); } return false; })(), JSON.stringify(await services()));
    // HACS hat geladen: Neustart bleibt Sache des Benutzers
    await setHacs({ installed_version: "0.5.0", latest_version: "0.5.0" });
    await p.evaluate(() => window.__pushHass());
    const t = await verText();
    check(`[${tag}] danach: "${T.restart}", Neustart-Knopf, kein automatischer Neustart`, t.includes(T.restart) && await ev(`return !!r.querySelector('[data-ver="restart"]')`) && !(await services()).some((s) => s.service === "restart"), t);

    // Auto aus: weder Öffnen noch Suchen installiert
    await p.evaluate(() => { window.__panelSettings.auto_update = false; window.__services = []; window.__version = { installed: "0.4.0", latest: "0.6.0" }; });
    await setHacs({ installed_version: "0.4.0", latest_version: "0.6.0" });
    await ev(`r.host._applyPanelSettings({ prerelease: false, auto_update: false })`);
    await p.evaluate(() => window.__pushHass());
    await wait(`return !!r.querySelector('[data-ver="check"]')`);
    await tap('[data-ver="check"]');
    await p.waitForTimeout(800);
    check(`[${tag}] Auto aus: Suchen installiert nicht, Knopf "Aktualisieren" bleibt`, (await services()).filter((s) => s.service === "install").length === 0 && await ev(`return !!r.querySelector('[data-ver="install"]')`));

    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
