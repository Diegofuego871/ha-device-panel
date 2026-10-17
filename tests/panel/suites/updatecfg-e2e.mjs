// Panel-Updates (2.25.0, Wunsch des Nutzers): Uhrzeit der täglichen Prüfung, Push bei gefundenem oder installiertem Update mit
// Empfänger, und ein roter Punkt am Zahnrad, solange ein Neustart nach einem Update aussteht. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const HACS_ID = "update.device_panel_update";
const TEXT = {
  de: { time: "Uhrzeit der Prüfung", auto: "Automatisch", notify: "Per Push melden", recipient: "Empfänger", std: "Standard", need: "Nur möglich mit eingeschalteter täglicher Prüfung.", dot: "Neustart steht aus", pill: "Neustart" },
  en: { time: "Time of the check", auto: "Automatic", notify: "Notify by push", recipient: "Recipient", std: "Default", need: "Only possible with the daily check turned on.", dot: "restart pending", pill: "Restart" },
};

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1400, height: 1000 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
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
    const optCalls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_options"));
    const openUpdates = async () => {
      if (!(await ev(`return r.querySelector("dialog.settings")?.open`))) { await tap(".gear-btn"); await wait(`return !!r.querySelector("dialog.settings .set-sec")`); }
      if ((await ev(`return r.querySelector('[data-set="section"][data-id="updates"]').getAttribute("aria-expanded")`)) !== "true") await tap('[data-set="section"][data-id="updates"]');
      return wait(`return !!r.querySelector('input[data-opt="update_check_time"]')`);
    };

    await openUpdates();
    // Uhrzeit der Prüfung
    check(`[${tag}] Zeile "${T.time}": leer (automatisch), "${T.auto}" gesperrt`, await ev(`const i = r.querySelector('input[data-opt="update_check_time"]'); const b = r.querySelector('[data-set="check-time-auto"]'); return i.value === "" && !i.disabled && b.disabled && b.textContent.trim() === ${JSON.stringify(T.auto)} && i.getAttribute("aria-label") === ${JSON.stringify(T.time)}`));
    check(`[${tag}] Zeile steht zwischen tägliche Prüfung und automatisch installieren`, await ev(`const k = [...r.querySelectorAll('[data-id="updates"] ~ * .opt, dialog.settings .opt')].map((e) => e.querySelector("[data-opt],[data-auto-update]")?.getAttribute("data-opt") || (e.querySelector("[data-auto-update]") ? "auto" : "")); return k.indexOf("update_check") < k.indexOf("update_check_time") && k.indexOf("update_check_time") < k.indexOf("auto")`));
    const timeIn = await f.waitForSelector(`${"input[data-opt=update_check_time]"}`, { state: "attached" }).catch(() => null);
    await ev(`const i = r.querySelector('input[data-opt="update_check_time"]'); i.value = "05:30"; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true }))`);
    check(`[${tag}] Zeit 05:30 gewählt: Zeile "geändert"`, await wait(`const o = r.querySelector('input[data-opt="update_check_time"]').closest(".opt"); return o.classList.contains("changed")`));
    // Push
    check(`[${tag}] "${T.notify}" aus, noch kein Empfänger`, await ev(`const s = r.querySelector('input[data-opt="update_notify"]'); return !s.checked && !s.disabled && !r.querySelector('select[data-opt="notify_service_panelupdate"]')`));
    await tap('input[data-opt="update_notify"]');
    check(`[${tag}] an: Zeile "${T.recipient}" direkt darunter, Standard gewählt, kein "Kein Ziel"`, await wait(`const s = r.querySelector('select[data-opt="notify_service_panelupdate"]'); return !!s && s.value === "" && s.options[0].textContent.startsWith(${JSON.stringify(T.std)}) && ![...s.options].some((o) => o.value === "none") && s.closest(".opt").previousElementSibling.querySelector('input[data-opt="update_notify"]')`));
    await ev(`const s = r.querySelector('select[data-opt="notify_service_panelupdate"]'); s.value = "notify.familie"; s.dispatchEvent(new Event("change", { bubbles: true }))`);
    check(`[${tag}] Empfänger "notify.familie": drei Änderungen`, await wait(`return r.querySelector('dialog.settings .set-count')?.textContent.includes("3")`));
    await tap('dialog.settings [data-set="save"]');
    await wait(`return r.querySelector("dialog.settings .set-count.saved")`);
    const so = (await optCalls()).at(-1)?.values;
    check(`[${tag}] gespeichert: update_check_time, update_notify, notify_service_panelupdate`, so && so.update_check_time === "05:30" && so.update_notify === true && so.notify_service_panelupdate === "notify.familie", JSON.stringify(so));

    // "Automatisch" setzt die Uhrzeit zurück
    await tap('[data-set="check-time-auto"]');
    check(`[${tag}] "${T.auto}": Uhrzeit leer, Knopf wieder gesperrt`, await wait(`return r.querySelector('input[data-opt="update_check_time"]').value === "" && r.querySelector('[data-set="check-time-auto"]').disabled`));
    // Ungültig kann es nicht werden, ohne tägliche Prüfung gesperrt
    await tap('input[data-opt="update_check"]');
    check(`[${tag}] tägliche Prüfung aus: Uhrzeit und Push gesperrt, Hinweis "${T.need}"`, await wait(`const t = r.querySelector('input[data-opt="update_check_time"]'), n = r.querySelector('input[data-opt="update_notify"]'); return t.disabled && n.disabled && !n.checked && !r.querySelector('select[data-opt="notify_service_panelupdate"]') && r.querySelector('input[data-opt="update_check_time"]').closest(".opt").textContent.includes(${JSON.stringify(T.need)})`));
    await tap('dialog.settings .dlg-actions [data-set="close"]');
    await wait(`return !r.querySelector("dialog.settings").open`);
    await p.waitForTimeout(500);
    await tap('dialog.discard-dlg [data-dd="yes"]').catch(() => {});
    await wait(`return !r.querySelector("dialog.settings").open`);

    // Roter Punkt am Zahnrad
    check(`[${tag}] ohne ausstehenden Neustart: kein Punkt`, await ev(`return !r.querySelector(".gear-btn").classList.contains("has-dot")`));
    await p.evaluate(() => { window.__version = { installed: "0.4.0", latest: "0.5.0" }; });
    await setHacs({ installed_version: "0.5.0", latest_version: "0.5.0" });
    await p.evaluate(() => window.__pushHass());
    check(`[${tag}] HACS hat 0.5.0 installiert, 0.4.0 läuft: roter Punkt, Beschriftung "${T.dot}"`, await wait(`const b = r.querySelector(".gear-btn"); return b.classList.contains("has-dot") && b.getAttribute("aria-label").includes(${JSON.stringify(T.dot)}) && b.title.includes(${JSON.stringify(T.dot)})`) || (await (async () => { await p.waitForTimeout(5200); await p.evaluate(() => window.__pushHass()); return wait(`return r.querySelector(".gear-btn").classList.contains("has-dot")`); })()));
    check(`[${tag}] Punkt sitzt oben rechts am Zahnrad (rot)`, await ev(`const b = r.querySelector(".gear-btn"); const s = getComputedStyle(b, "::after"); return s.position === "absolute" && s.width === "10px" && s.backgroundColor !== "rgba(0, 0, 0, 0)" && s.content !== "none"`));
    await p.screenshot({ path: `/tmp/updatecfg-${tag.replace("/", "-")}.png` }).catch(() => {});
    // Launcher (2.85.0): die Karte "Einstellungen" trägt die rote Pille, der Launcher-Knopf bekommt keinen Punkt dafür
    await tap(".apps-btn");
    check(`[${tag}] Launcher: Karte Einstellungen mit roter Pille "${T.pill}", Launcher-Knopf ohne Punkt`, (await wait(`return r.querySelector('dialog.apps-dlg [data-ap="open"][data-id="settings"]')?.parentElement.querySelector(".ap-badge.bad")?.textContent === ${JSON.stringify(T.pill)}`)) && (await ev(`return !r.querySelector(".apps-btn").classList.contains("has-dot")`)));
    await p.keyboard.press("Escape");
    await wait(`return !r.querySelector("dialog.apps-dlg").open`);
    // Neustart erledigt (neue Version läuft): Punkt weg
    await p.evaluate(() => { window.__version = { installed: "0.5.0", latest: "0.5.0" }; });
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    check(`[${tag}] neue Version läuft: Punkt weg`, await wait(`return !r.querySelector(".gear-btn").classList.contains("has-dot")`));
    await ev(`r.querySelector("dialog.settings").close()`);
    await tap(".apps-btn");
    check(`[${tag}] Launcher: Pille weg, sobald der Punkt weg ist`, await wait(`const b = r.querySelector('dialog.apps-dlg [data-ap="open"][data-id="settings"]'); return !!b && !b.parentElement.querySelector(".ap-badge")`));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
