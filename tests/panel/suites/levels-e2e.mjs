// Gleiche Reiter auf allen Ebenen (1.42.0): Einstellungen (Laden als eigener Reiter), Detail einer Integration
// (Ausfall | Batterie | Laden | Neu | Empfang | Geräte, je mit Grafik) und Geräte-Popup (Ausfall | Batterie | Laden |
// Empfang, Reiter ohne Inhalt entfallen). Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { integ: "Ausfall|Batterie|Laden|Neu|Empfang|Geräte", dev: "Ausfall|Batterie|Laden|Empfang", noBat: "Dieses Gerät meldet keinen Batteriestand.", noBatInteg: "Diese Integration hat keine Geräte mit Batterie.", glob: "Allgemein|Ausfall|Batterie|Laden|Neu|Updates|Empfang|Integrationen" },
  en: { integ: "Outage|Battery|Charging|New|Signal|Devices", dev: "Outage|Battery|Charging|Signal", noBat: "This device does not report a battery level.", noBatInteg: "This integration has no devices with a battery.", glob: "General|Outage|Battery|Charging|New|Updates|Signal|Integrations" },
};
for (const lang of ["de", "en"]) for (const mobile of [false, true]) {
  const T_ = T[lang];
  const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
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
  const tabsOf = (sel) => ev(`return [...r.querySelectorAll(${JSON.stringify(sel)})].map(x => x.textContent.trim()).join("|")`);

  // --- Einstellungen: Laden ist ein eigener Reiter
  await tap(".gear-btn");
  await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
  await tap('[data-set="section"][data-id="monitor"]');
  check(`[${tag}] Einstellungen: Reiter ${T_.glob}`, (await tabsOf("dialog.settings .mon-tab")) === T_.glob, await tabsOf("dialog.settings .mon-tab"));
  await tap('.mon-tab[data-key="charge"]');
  check(`[${tag}] Einstellungen: Reiter "Laden" zeigt die Lademeldung ohne Unterreiter`, await wait(`return !!r.querySelector('input[data-opt="notify_charge"]') && !r.querySelector('.sub-tab[data-group="battery"]')`));
  // Bei Platzmangel (Handy) brechen die Reiter auf eine zweite Zeile um, nichts scrollt oder wird abgeschnitten
  if (mobile) check(`[${tag}] Handy: Reiter in zwei Zeilen, keine seitliche Verschiebung`, await ev(`const bar=r.querySelector(".mon-tabs"); const tops = new Set([...bar.children].map(x => Math.round(x.getBoundingClientRect().top))); const inside = [...bar.children].every(x => x.getBoundingClientRect().right <= bar.getBoundingClientRect().right + 1); return bar.scrollWidth <= bar.clientWidth + 1 && tops.size >= 2 && inside`));

  // --- Integration (Matter: hat Batteriegeräte)
  await tap('.mon-tab[data-key="integ"]');
  await wait(`return !!r.querySelector('.ilist-row[data-key="matter"]')`);
  await tap('.ilist-row[data-key="matter"]');
  await wait(`return !!r.querySelector('.lvl-tabs')`);
  check(`[${tag}] Integration: Reiter ${T_.integ}`, (await tabsOf(".lvl-tabs .sub-tab")) === T_.integ, await tabsOf(".lvl-tabs .sub-tab"));
  check(`[${tag}] Integration: zuerst "Ausfall" mit Grafik`, await ev(`return r.querySelector('.lvl-tabs .sub-tab.on').dataset.key === "out" && !!r.querySelector(".lvl-body .ptl") && !!r.querySelector('input[data-imon="matter"]')`));
  for (const [key, graph, row] of [["bat", ".mtl", 'select[data-bat-mode="matter"]'], ["chg", ".mtl", 'input[data-cinteg="matter"]'], ["new", ".ptl", 'input[data-list="new_exclude_integrations"]']]) {
    await tap(`[data-set="isub"][data-key="${key}"]`);
    check(`[${tag}] Integration › ${key}: Grafik und Einstellung`, await wait(`return !!r.querySelector(".lvl-body ${graph}") && !!r.querySelector(${JSON.stringify(row)}) && r.querySelector('.lvl-tabs .sub-tab.on').dataset.key === "${key}"`));
  }
  // Eigene Einstellung: Punkt am Reiter "Laden"
  check(`[${tag}] Integration: ohne eigene Einstellung kein Punkt am Reiter "Laden"`, await ev(`return !r.querySelector('.lvl-tabs .sub-tab[data-key="chg"]').classList.contains("chg")`));
  await tap(`[data-set="isub"][data-key="chg"]`);
  await tap('input[data-cinteg="matter"]');
  check(`[${tag}] Integration: Lademeldung an, Punkt am Reiter "Laden", Werte-Zeilen da`, await wait(`return r.querySelector('.lvl-tabs .sub-tab[data-key="chg"]').classList.contains("chg") && !!r.querySelector('select[data-cfull-integ="matter"]') && !!r.querySelector('select[data-cstall-integ="matter"]')`));
  await tap(`[data-set="isub"][data-key="sig"]`);
  await tap(`[data-set="isub"][data-key="dev"]`);
  check(`[${tag}] Integration: Reiter "Geräte" ohne Eintrag zeigt einen Hinweis`, await wait(`return r.querySelector('.lvl-tabs .sub-tab.on').dataset.key === "dev" && !!r.querySelector(".lvl-body .mon-empty, .lvl-body .ovr-list")`));
  check(`[${tag}] Integration: "Alles auf Standard" bleibt unter allen Reitern`, await ev(`return !!r.querySelector('[data-set="integ-reset"]')`));
  // Wechsel zu einer anderen Integration beginnt wieder bei "Ausfall"
  await tap(".iback");
  await wait(`return !!r.querySelector('.ilist-row[data-key="zha"]')`);
  await tap('.ilist-row[data-key="zha"]');
  check(`[${tag}] Integration: eine andere Integration öffnet wieder "Ausfall"`, await wait(`return r.querySelector('.lvl-tabs .sub-tab.on')?.dataset.key === "out"`));
  // Integration ohne Batteriegeräte: Hinweis statt Zeilen
  const noBatDom = await ev(`const i = r.host._integItems(r.host._settings.draft).find(x => !x.batDevices && !x.own); return i ? i.domain : null`);
  if (noBatDom) {
    await tap(".iback");
    await wait(`return !!r.querySelector('.ilist-row[data-key="${noBatDom}"]')`);
    await tap(`.ilist-row[data-key="${noBatDom}"]`);
    await tap(`[data-set="isub"][data-key="bat"]`);
    check(`[${tag}] Integration ohne Batteriegeräte: Hinweis "${T_.noBatInteg}"`, await wait(`return r.querySelector(".lvl-body .mon-empty")?.textContent.trim() === ${JSON.stringify(T_.noBatInteg)}`));
  }
  await ev(`const d=r.querySelector("dialog.settings"); if (d?.open) d.close(); return 1`);

  // --- Geräte-Popup
  await tap('.dev[data-open="c"]');
  await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device [data-tab="set"]')`);
  await tap('dialog.device [data-tab="set"]');
  // Gerät "c" hat Batterie, aber keinen Empfang: der Reiter "Empfang" entfällt
  const devTabs = T_.dev.split("|").slice(0, 3).join("|");
  check(`[${tag}] Popup mit Reiterleiste: kein Titel`, await ev(`return !r.querySelector("dialog.device .lvl-title")`));
  check(`[${tag}] Popup: Reiter ${devTabs} (ohne Empfang kein Reiter "Empfang")`, (await tabsOf("dialog.device .lvl-tabs .sub-tab")) === devTabs, await tabsOf("dialog.device .lvl-tabs .sub-tab"));
  check(`[${tag}] Popup: zuerst "Ausfall" mit Grafik und Zeile "Ausgefallen nach"`, await ev(`return r.querySelector('dialog.device .lvl-tabs .sub-tab.on').dataset.stab === "out" && !!r.querySelector("dialog.device .lvl-body .ptl") && !!r.querySelector('select[data-dlg="dev-off"]')`));
  for (const [key, graph, row] of [["bat", ".mtl", "dev-bat"], ["chg", ".mtl", "dev-charge"]]) {
    await tap(`dialog.device [data-stab="${key}"]`);
    check(`[${tag}] Popup › ${key}: Grafik und Zeile`, await wait(`return !!r.querySelector("dialog.device .lvl-body ${graph}") && !!r.querySelector('select[data-dlg="${row}"]')`));
  }
  // Eigene Einstellung: Punkt am Reiter
  await tap('dialog.device [data-stab="bat"]');
  await (await handle('select[data-dlg="dev-bat"]')).selectOption("own");
  check(`[${tag}] Popup: eigene Schwelle, Punkt am Reiter "Batterie"`, await wait(`return r.querySelector('dialog.device [data-stab="bat"]').classList.contains("chg") && !r.querySelector('dialog.device [data-stab="chg"]').classList.contains("chg")`));
  await (await handle('select[data-dlg="dev-bat"]')).selectOption("default");
  await tap('dialog.device [data-dlg="close"]');
  // Der Reiter beginnt beim nächsten Öffnen wieder bei "Ausfall"
  await tap('.dev[data-open="c"]');
  await wait(`return r.querySelector("dialog.device")?.open`);
  await tap('dialog.device [data-tab="set"]');
  check(`[${tag}] Popup: beim erneuten Öffnen wieder "Ausfall"`, await ev(`return r.querySelector('dialog.device .lvl-tabs .sub-tab.on').dataset.stab === "out"`));
  await tap('dialog.device [data-dlg="close"]');
  // Gerät ohne Batterie: die Reiter "Batterie" und "Laden" entfallen (seit 2.46.0), Ausfall bleibt
  const noBat = await ev(`const d = r.host._devices.find((x) => !x.has_battery && x.battery?.level == null && x.signal?.value == null && x.online !== false && !x.disabled); return d ? d.id : null`);
  check(`[${tag}] Simulator hat ein Gerät ohne Batterie und Empfang`, Boolean(noBat));
  if (noBat) {
    await tap(`.dev[data-open="${noBat}"]`);
    await wait(`return r.querySelector("dialog.device")?.open`);
    await tap('dialog.device [data-tab="set"]');
    check(`[${tag}] Popup ohne Batterie: keine Reiter "Batterie" und "Laden"`, await wait(`return !r.querySelector('dialog.device [data-stab="bat"]') && !r.querySelector('dialog.device [data-stab="chg"]') && !!r.querySelector('dialog.device .dev-set .lvl-body .ptl')`));
    check(`[${tag}] Popup ohne Reiterleiste: Titel "${T_.dev.split("|")[0]}" statt Leiste`, await ev(`return !r.querySelector("dialog.device .lvl-tabs") && r.querySelector("dialog.device .lvl-title")?.textContent.trim() === ${JSON.stringify(T_.dev.split("|")[0])}`));
    check(`[${tag}] Popup ohne Batterie: kein Hinweis "${T_.noBat}"`, await ev(`return !r.querySelector("dialog.device .mon-empty")`));
    await tap('dialog.device [data-dlg="close"]');
  }
  await p.screenshot({ path: `${outDir}/levels-${tag.replace("/", "-")}.png` });
  check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
  check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
