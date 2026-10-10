// Übersicht von "Überwachung und Meldungen" (1.34.0): fünf Zeilen (Ausfall, Batterie, Laden, Neue Geräte, Updates),
// je mit Zeitstrahl, Chip und Abweichungen; "Ändern" öffnet den richtigen (Unter-)Reiter.
// Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { charge: "Laden", upd: "Updates", noPush: "Kein Push", noTarget: "kein Ziel gewählt", none: "Aus (Standard); einschaltbar pro Integration oder Gerät", rise: "Anstieg ≥ 30 %", full: "ab 95 %", on: "Eingeschaltet für: 2 Integrationen · 1 Gerät", updTime: "montags 07:30", kinds: "Arten: Home Assistant, Apps (Add-ons), Integrationen und Karten (HACS) · 1 Ausnahme", sub: "Laden", subWarn: "Warnung" },
  en: { charge: "Charging", upd: "Updates", noPush: "No push", noTarget: "no target chosen", none: "Off (default); can be switched on per integration or device", rise: "rise ≥ 30 %", full: "from 95 %", on: "Switched on for: 2 integrations · 1 device", updTime: "Mondays 07:30", kinds: "Kinds: Home Assistant, Apps (add-ons), Integrations and cards (HACS) · 1 exception", sub: "Charging", subWarn: "Warning" },
};
for (const lang of ["de", "en"]) for (const mobile of [false, true]) {
  const T_ = T[lang];
  const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
  const ctx = await b.newContext(mobile ? { viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
  const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
  const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
  const tap = async (sel) => {
    for (let versuch = 1; ; versuch++) {
      const h = await handle(sel);
      if (!h) throw new Error("fehlt: " + sel);
      try { await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); return; } catch (err) { if (versuch >= 3 || !/not attached|not stable/.test(String(err))) throw err; }
    }
  };
  const wait = (c) => f.waitForFunction(new Function(`const r=${R};` + c), null, { timeout: 5000 }).then(() => true, () => false);
  const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.innerText || "").replace(/\\s+/g," ").trim()`);
  const open = async () => {
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await wait(`return !!r.querySelector('[data-lane="outage"]')`);
  };

  // Standard: ohne Ziel, Laden und Updates aus
  await open();
  const lanes = await ev(`return [...r.querySelectorAll(".lane")].map(l=>l.dataset.lane).join()`);
  check(`[${tag}] fünf Zeilen in der Reihenfolge`, lanes === "outage,battery,charge,new,updates", lanes);
  check(`[${tag}] Laden: Titel, "${T_.noPush}", Grund, Chip aus`, (await text('[data-lane="charge"] .lane-t')) === T_.charge && (await text('[data-lane="charge"] .mk-off b')) === T_.noPush && (await text('[data-lane="charge"] .mk-off span')) === T_.noTarget && (await ev(`return r.querySelector('[data-lane="charge"] .mon-chip').getAttribute("aria-pressed")`)) === "false", await text('[data-lane="charge"]'));
  check(`[${tag}] Laden: Abweichungen "${T_.none}"`, (await text('[data-lane="charge"] .lane-diff')) === T_.none, await text('[data-lane="charge"] .lane-diff'));
  check(`[${tag}] Updates: Titel, kein Push, Chip aus`, (await text('[data-lane="updates"] .lane-t')) === T_.upd && (await text('[data-lane="updates"] .mk-off b')) === T_.noPush && (await ev(`return r.querySelector('[data-lane="updates"] .mon-chip').getAttribute("aria-pressed")`)) === "false");
  // Chip schaltet den Hauptschalter
  await tap('[data-lane="charge"] .mon-chip');
  await wait(`return r.querySelector('[data-lane="charge"] .mon-chip').getAttribute("aria-pressed") === "true"`);
  check(`[${tag}] Chip "Push" der Zeile Laden schaltet die Lademeldung ein`, await ev(`return r.querySelector('[data-lane="charge"] .mon-chip').getAttribute("aria-pressed") === "true" && r.querySelector(".mon-tab.on, .mon-tab.chg") !== null`));
  // "Ändern": richtiger Unterreiter
  await tap('[data-lane="charge"] [data-set="tab"]');
  await wait(`return !!r.querySelector('.sub-tab[data-key="bat_charge"].on')`);
  check(`[${tag}] "Ändern" bei Laden öffnet Batterie › ${T_.sub}`, await ev(`return !!r.querySelector('.sub-tab[data-key="bat_charge"].on')`));
  await tap('.mon-tab[data-key="overview"]');
  await wait(`return !!r.querySelector('[data-lane="battery"]')`);
  await tap('[data-lane="battery"] [data-set="tab"]');
  await wait(`return !!r.querySelector('.sub-tab[data-key="bat_warn"].on')`);
  check(`[${tag}] "Ändern" bei Batterie öffnet Batterie › ${T_.subWarn}`, await ev(`return !!r.querySelector('.sub-tab[data-key="bat_warn"].on')`));
  await tap('.mon-tab[data-key="overview"]');
  await wait(`return !!r.querySelector('[data-lane="updates"]')`);
  await tap('[data-lane="updates"] [data-set="tab"]');
  await wait(`return !!r.querySelector('input[data-opt="notify_updates"]')`);
  check(`[${tag}] "Ändern" bei Updates öffnet den Reiter Updates`, await ev(`return r.querySelector(".mon-tab.on").dataset.key === "updates"`));
  await ctx.close();

  // Mit Ziel und eigenen Werten
  const ctx2 = await b.newContext(mobile ? { viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
  const p2 = await ctx2.newPage();
  p2.on("pageerror", (e) => errors.push(e.message));
  await p2.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
  const f2 = await (await p2.waitForSelector("#panel-frame")).contentFrame();
  await f2.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
  await p2.evaluate(() => {
    Object.assign(window.__opts, { notify_service: "notify.handy", notify_charge: true, charge_full: 95, charge_rise: 30, charge_integrations: ["zha", "hue"], notify_updates: true, updates_mode: "weekly", updates_time: "07:30", updates_exclude: ["update.mariadb_update"] });
    window.__devSettings.charge = { a: true };
  });
  const ev2 = (c) => f2.evaluate(new Function(`const r=${R};` + c));
  const text2 = (s) => ev2(`return (r.querySelector(${JSON.stringify(s)})?.innerText || "").replace(/\\s+/g," ").trim()`);
  const tap2 = async (sel) => {
    for (let versuch = 1; ; versuch++) {
      const h = (await f2.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
      if (!h) throw new Error("fehlt: " + sel);
      try { await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); return; } catch (err) { if (versuch >= 3 || !/not attached|not stable/.test(String(err))) throw err; }
    }
  };
  await f2.waitForFunction(new Function(`const r=${R}; return r.host._devices.some(d=>d.charge_setting===true)`), null, { timeout: 8000 }).catch(() => {});
  await tap2(".gear-btn");
  await f2.waitForSelector("dialog.settings .set-sec", { state: "attached" }).catch(() => {});
  await tap2('[data-set="section"][data-id="monitor"]');
  await f2.waitForFunction(new Function(`const r=${R}; return !!r.querySelector('[data-lane="charge"] .mk-p')`), null, { timeout: 5000 }).catch(() => {});
  check(`[${tag}] Laden mit Ziel: "${T_.rise}" und "${T_.full}"`, (await text2('[data-lane="charge"] .mtl-bar + .mtl-mk b')) === T_.rise && (await text2('[data-lane="charge"] .mk-p b')) === T_.full, await text2('[data-lane="charge"] .mtl'));
  check(`[${tag}] Laden: Chip an, "${T_.on}"`, (await ev2(`return r.querySelector('[data-lane="charge"] .mon-chip').getAttribute("aria-pressed")`)) === "true" && (await text2('[data-lane="charge"] .lane-diff')) === T_.on, await text2('[data-lane="charge"] .lane-diff'));
  check(`[${tag}] Updates mit Ziel: "${T_.updTime}", Arten, Ausnahme`, (await text2('[data-lane="updates"] .mk-p b')) === T_.updTime && (await text2('[data-lane="updates"] .lane-diff')) === T_.kinds, await text2('[data-lane="updates"]'));
  await p2.screenshot({ path: `${outDir}/overview-${tag.replace("/", "-")}.png` });
  check(`[${tag}] kein fehlender Text`, !(await ev2(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
  check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
  await ctx2.close();
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
