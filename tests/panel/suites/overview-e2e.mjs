// Kleine Übersicht je Reiter von "Überwachung und Meldungen" (2.96.0; bis 2.95.1 stand sie gesammelt im Reiter "Übersicht"):
// Karte mit Kapitel, Zeitstrahl und Pillen in Ausfall, Batterie, Laden, Neu und Updates; der Reiter "Allgemein" hat keine.
// Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { general: "Allgemein", lanes: { outage: ["Ausfall", "Push|Anhaltend|Wieder online|Sammelausfall"], battery: ["Batterie schwach", "Push|Anhaltend"], charge: ["Laden", "Push"], new: ["Neue Geräte", "Push|Anhaltend"], updates: ["Updates", "Push"] } },
  en: { general: "General", lanes: { outage: ["Outage", "Push|Persistent|Back online|Group outage"], battery: ["Low battery", "Push|Persistent"], charge: ["Charging", "Push"], new: ["New devices", "Push|Persistent"], updates: ["Updates", "Push"] } },
};
const PUSH_KEY = { outage: "notify_outage", battery: "battery_push", charge: "notify_charge", new: "notify_new", updates: "notify_updates" };
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

  await tap(".gear-btn");
  await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
  await tap('[data-set="section"][data-id="monitor"]');
  await wait(`return !!r.querySelector('.mon-tab[data-key="overview"]')`);
  check(`[${tag}] Reiter "${T_.general}" ohne Übersichtskarten`, (await text('.mon-tab[data-key="overview"]')) === T_.general && (await ev(`return r.querySelectorAll(".lane").length`)) === 0);
  check(`[${tag}] keine "Ändern"-Knöpfe und keine Abweichungs-Zeilen mehr`, await ev(`return !r.querySelector(".lane-diff") && !r.querySelector(".lane .lnk")`));

  for (const [tab, [title, chips]] of Object.entries(T_.lanes)) {
    await tap(`.mon-tab[data-key="${tab}"]`);
    await wait(`return !!r.querySelector('.lane[data-lane="${tab}"]')`);
    check(`[${tag}] ${tab}: genau eine Karte, Kapitel "${title}", Zeitstrahl`, (await ev(`return r.querySelectorAll(".lane").length`)) === 1 && (await text(`.lane[data-lane="${tab}"] .lane-t`)) === title && (await ev(`return !!r.querySelector('.lane[data-lane="${tab}"] .mtl, .lane[data-lane="${tab}"] .ptl')`)));
    check(`[${tag}] ${tab}: Pillen "${chips}", Karte ohne Knöpfe ausser Pillen`, (await ev(`return [...r.querySelectorAll('.lane[data-lane="${tab}"] .mon-chip')].map(c=>c.textContent.trim()).join("|")`)) === chips);
  }

  // Pille "Push" im Reiter Laden schaltet die Lademeldung, die Zeile darunter folgt; Punkt am Reiter
  await tap('.mon-tab[data-key="charge"]');
  await wait(`return !!r.querySelector('.lane[data-lane="charge"]')`);
  check(`[${tag}] Laden: Pille aus, Zeitstrahl "kein Push"`, (await ev(`return r.querySelector('.lane[data-lane="charge"] .mon-chip').getAttribute("aria-pressed")`)) === "false" && (await ev(`return !!r.querySelector('.lane[data-lane="charge"] .mk-off')`)));
  await tap('.lane[data-lane="charge"] .mon-chip');
  check(`[${tag}] Pille "Push" schaltet die Lademeldung ein, Zeile folgt, Reiter markiert`, await wait(`return r.querySelector('.lane[data-lane="charge"] .mon-chip').getAttribute("aria-pressed") === "true" && r.querySelector('input[data-opt="notify_charge"]').checked && r.host._settings.draft.notify_charge === true && r.querySelector('.mon-tab[data-key="charge"]').classList.contains("chg")`));
  // Pille in einem anderen Reiter ändert den Entwurf der Zeile dort (Updates)
  await tap('.mon-tab[data-key="updates"]');
  await wait(`return !!r.querySelector('.lane[data-lane="updates"]')`);
  await tap('.lane[data-lane="updates"] .mon-chip');
  check(`[${tag}] Pille bei Updates schaltet die Update-Meldung`, await wait(`return r.host._settings.draft.notify_updates === true && r.querySelector('input[data-opt="notify_updates"]').checked`));
  // Allgemein: Ziel und Ruhezeit bleiben
  await tap('.mon-tab[data-key="overview"]');
  check(`[${tag}] Allgemein: "Ziel der Meldungen" und "Ruhezeit"`, await wait(`const g = [...r.querySelectorAll(".mon-body > .mon-grp")].length; return g === 2 && !!r.querySelector('select[data-opt="notify_service"]') && !!r.querySelector('input[data-opt="quiet_enabled"]')`));
  await p.screenshot({ path: `${outDir}/overview-${tag.replace("/", "-")}.png` });
  check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
  check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
