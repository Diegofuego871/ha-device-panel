// Einrichtungsassistent (2.135.0, docs/mockups/wizard-v1): Zustand (new/later/open/done/off), Fenster von selbst bei "new", Kachel und Punkt im
// Launcher, Schritte mit Entwurf (gespeichert wird erst mit "Fertigstellen"), Meldungswerte mit Prüfung, Testmeldung, "Jetzt nicht" und
// "Nicht mehr zeigen", Neustart aus den Einstellungen. Deutsch und Englisch, Desktop und Handy, echte Klicks und Tipps.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { down: "gerade ausgefallen", sysTitle: "Systemauslastung", sumSystem: "Systemauslastung", sysNow: (n) => `jetzt ${n} %`, start: "Los geht's", later: "Jetzt nicht", never: "Nicht mehr zeigen", next: "Weiter", back: "Zurück", finish: "Fertigstellen", tile: "Einrichtung", pill: "Offen", step2: "Schritt 2 von 5", ttl: "Einrichtungsassistent", startBtn: "Assistent starten", errDelay: "Melden nach darf nicht kürzer sein als \"Ausgefallen nach\" (jetzt 2 Min., einstellbar unter Einstellungen).", testOk: "Gesendet. Prüfe dein Gerät.", testFail: "Nicht gesendet. Prüfe das Ziel.", reset: "Entwurf verwerfen", snack: "Einrichtung gespeichert." },
  en: { down: "currently down", sysTitle: "System load", sumSystem: "System load", sysNow: (n) => `now ${n} %`, start: "Let's go", later: "Not now", never: "Don't show again", next: "Next", back: "Back", finish: "Finish", tile: "Setup", pill: "Open", step2: "Step 2 of 5", ttl: "Setup wizard", startBtn: "Start wizard", errDelay: "Notify after must not be shorter than \"Failed after\" (now 2 min, adjustable in the settings).", testOk: "Sent. Check your device.", testFail: "Not sent. Check the target.", reset: "Discard draft", snack: "Setup saved." },
};

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const L = T[lang];
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const errors = [];
    const session = async (initial) => {
      const p = await ctx.newPage();
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=light&wizard=${initial}`);
      const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
      await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
      const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
      const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
      const tap = async (sel) => {
        for (let n = 1; ; n++) {
          const h = await handle(sel);
          if (!h) throw new Error("fehlt: " + sel);
          try { await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); return; } catch (err) { if (n >= 3 || !/not attached|not stable/.test(String(err))) throw err; await p.waitForTimeout(200); }
        }
      };
      const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
      const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.innerText || "").replace(/\\s+/g," ").trim()`);
      const D = "dialog.wizard-dlg";
      const step = () => ev(`return r.host._wizard.s?.step || ""`);
      const opened = () => wait(`return r.querySelector("${D}")?.open && !r.host._wizard.s?.loading`);
      const closed = () => wait(`return !r.querySelector("${D}").open`);
      // set_options des Assistenten selbst; reine Zustandswechsel (nur wizard_*) zählen nicht
      const calls = () => p.evaluate(() => (window.__setOptsLog || []).filter((c) => Object.keys(c).some((k) => !k.startsWith("wizard_"))));
      const state = () => p.evaluate(() => window.__opts.wizard_state);
      const tileShown = async () => { await ev(`r.host._apps.open ? 0 : 0`); return ev(`return r.host._apps.app("wizard") !== null`); };
      const launcherDot = () => ev(`return r.querySelector(".apps-btn").classList.contains("dot-warn")`);
      const shot = (name) => p.screenshot({ path: `${outDir}/wizard-${name}-${lang}-${mobile ? "mobile" : "desktop"}.png` });
      return { p, f, ev, tap, wait, text, D, step, opened, closed, calls, state, tileShown, launcherDot, shot, handle };
    };

    // --- Frische Installation: das Fenster öffnet sich von selbst, Kachel und Punkt sind da
    {
      const s = await session("new");
      check(`[${tag}] "new": Fenster öffnet sich von selbst`, await s.opened());
      check(`[${tag}] Willkommen: Los geht's, ${L.later}, ${L.never}`, (await s.text(`${s.D} .wz-welcome-ft`)).includes(L.start) && (await s.text(`${s.D} .wz-ft2`)).includes(L.later) && (await s.text(`${s.D} .wz-ft2`)).includes(L.never));
      const box = await s.ev(`const d = r.querySelector("${s.D}").getBoundingClientRect(); return [Math.round(d.left), Math.round(d.top), Math.round(d.width), Math.round(d.height), innerWidth, innerHeight]`);
      if (mobile) check(`[${tag}] Handy: Vollbild`, box[0] === 0 && box[1] === 0 && box[2] === box[4] && box[3] === box[5], JSON.stringify(box));
      else check(`[${tag}] Desktop: Popup in der Mitte, so gross wie die Einstellungen (höchstens 880 px breit)`, box[2] <= 880 && box[2] > 640 && Math.abs(box[0] + box[2] / 2 - box[4] / 2) < 4, JSON.stringify(box));
      check(`[${tag}] Willkommen: die Rakete wackelt wie in der Kachel (wz-rocket)`, (await s.ev(`return getComputedStyle(r.querySelector("${s.D} .wz-hero svg")).animationName`)) === "wz-rocket");
      await s.shot("1-welcome");
      check(`[${tag}] Kachel "${L.tile}" im Launcher und oranger Punkt am Knopf`, (await s.tileShown()) && (await s.launcherDot()));

      // Schritt 1: Integrationen; Entwurf ändert nichts im Backend
      await s.tap(`${s.D} [data-wz="start"]`);
      await s.wait(`return r.host._wizard.s.step === "integrations"`);
      check(`[${tag}] Schritt 1 "Integrationen" mit Schritt-Anzeige (ohne Ziel fünf Schritte)`, (await s.text(`${s.D} .wz-stp`)).startsWith(lang === "de" ? "Schritt 1 von 5" : "Step 1 of 5"), await s.text(`${s.D} .wz-stp`));
      const integ = await s.ev(`return [...r.querySelectorAll("${s.D} [data-wz-integ]")].map((i) => i.dataset.wzInteg)`);
      check(`[${tag}] Integrationen als Liste mit Schaltern, alle an`, integ.length >= 3 && (await s.ev(`return [...r.querySelectorAll("${s.D} [data-wz-integ]")].every((i) => i.checked)`)), integ.join());
      const off = integ[integ.length - 1];
      await s.tap(`${s.D} [data-wz-integ="${off}"]`);
      check(`[${tag}] Integration abgewählt (Entwurf), im Backend nichts geändert`, (await s.ev(`return r.host._wizard.s.d.exI.has(${JSON.stringify(off)})`)) && (await s.calls()).length === 0);
      await s.shot("2-integrations");

      // Schritt 2: Typen; die Zahl richtet sich nach Schritt 1
      await s.tap(`${s.D} [data-wz="next"]`);
      await s.wait(`return r.host._wizard.s.step === "types"`);
      check(`[${tag}] Schritt 2 "Gerätetypen" (${L.step2})`, (await s.text(`${s.D} .wz-stp`)).startsWith(L.step2), await s.text(`${s.D} .wz-stp`));
      const types = await s.ev(`return [...r.querySelectorAll("${s.D} [data-wz-type]")].map((i) => i.dataset.wzType)`);
      check(`[${tag}] Typen aus den übrigen Geräten, mindestens zwei`, types.length >= 2, types.join());
      await s.tap(`${s.D} [data-wz-type="${types[0]}"]`);
      check(`[${tag}] Typ abgewählt`, await s.ev(`return r.host._wizard.s.d.exT.has(${JSON.stringify(types[0])})`));

      // Schritt 3: Geräte, nach Integration gruppiert, aufklappbar
      await s.tap(`${s.D} [data-wz="next"]`);
      await s.wait(`return r.host._wizard.s.step === "devices"`);
      await s.shot("3-devices");
      const groups = await s.ev(`return [...r.querySelectorAll("${s.D} [data-wz-group]")].map((i) => i.dataset.wzGroup)`);
      check(`[${tag}] Geräte nach Integration gruppiert, die abgewählte fehlt`, groups.length >= 2 && !groups.includes(off), groups.join());
      check(`[${tag}] Gruppen zu, keine Geräteschalter sichtbar`, (await s.ev(`return r.querySelectorAll("${s.D} [data-wz-dev]").length`)) === 0);
      await s.tap(`${s.D} [data-wz-open="${groups[0]}"]`);
      const devs = await s.ev(`return [...r.querySelectorAll("${s.D} [data-wz-dev]")].map((i) => i.dataset.wzDev)`);
      check(`[${tag}] Gruppe aufgeklappt: Geräte mit Schaltern`, devs.length >= 1, String(devs.length));
      await s.tap(`${s.D} [data-wz-dev="${devs[0]}"]`);
      check(`[${tag}] Gerät abgewählt: Gruppenschalter "teils"`, (await s.ev(`return r.host._wizard.s.d.exD.has(${JSON.stringify(devs[0])})`)) && (devs.length < 2 || (await s.ev(`return r.querySelector('${s.D} [data-wz-group="${groups[0]}"]').closest(".wz-grp").querySelector(".switch").classList.contains("part")`))));
      await s.shot("4-devices");

      // Schritt 4: Meldungen; ohne Ziel gesperrt
      await s.tap(`${s.D} [data-wz="next"]`);
      await s.wait(`return r.host._wizard.s.step === "messages"`);
      check(`[${tag}] Meldungen: ohne Ziel sind Schalter und Werte gesperrt, kein Ruhezeit-Schritt`, (await s.ev(`return [...r.querySelectorAll("${s.D} [data-wz-msg], ${s.D} [data-wz-v]")].every((i) => i.disabled)`)) && (await s.ev(`return r.host._wizard.steps().length`)) === 5);
      check(`[${tag}] Zeilen: Ausgefallene Geräte, Batterie, Neue Geräte, Voll geladen, Updates`, (await s.ev(`return r.querySelectorAll("${s.D} .wz-msg").length`)) === 5);
      check(`[${tag}] Werte vorausgefüllt mit den jetzigen Einstellungen`, JSON.stringify(await s.ev(`return [...r.querySelectorAll("${s.D} [data-wz-v]")].map((i) => i.dataset.wzV + "=" + i.value)`)) === JSON.stringify(["notify_delay=2", "battery_low=15", "charge_full=100", "new_window=5", "updates_time=09:00"]));
      await s.ev(`const sel = r.querySelector("${s.D} [data-wz-target]"); sel.value = "notify.fernseher"; sel.dispatchEvent(new Event("change", { bubbles: true }))`);
      check(`[${tag}] Ziel gewählt: Werte frei, Testmeldung da, Ruhezeit-Schritt kommt dazu`, (await s.ev(`return [...r.querySelectorAll("${s.D} [data-wz-v]")].every((i) => !i.disabled)`)) && (await s.ev(`return r.host._wizard.steps().length`)) === 6 && !!(await s.handle(`${s.D} [data-wz="test"]`)));
      await s.tap(`${s.D} [data-wz="test"]`);
      check(`[${tag}] Testmeldung nicht gesendet: "${L.testFail}"`, await s.wait(`return r.querySelector("${s.D} [data-wz-testres]").textContent.trim() === ${JSON.stringify(L.testFail)}`));
      await s.ev(`const sel = r.querySelector("${s.D} [data-wz-target]"); sel.value = "notify.mobile_app_testhandy"; sel.dispatchEvent(new Event("change", { bubbles: true }))`);
      await s.tap(`${s.D} [data-wz="test"]`);
      check(`[${tag}] Testmeldung gesendet: "${L.testOk}"`, (await s.wait(`return r.querySelector("${s.D} [data-wz-testres]").textContent.trim() === ${JSON.stringify(L.testOk)}`)) && (await s.p.evaluate(() => window.__wizardTests)).join() === "notify.fernseher,notify.mobile_app_testhandy");
      await s.tap(`${s.D} [data-wz-msg="outage"]`);
      await s.tap(`${s.D} [data-wz-msg="battery"]`);
      check(`[${tag}] "Voll geladen" ist standardmässig aus, ohne Hinweis`, (await s.ev(`return r.host._wizard.s.d.on.charge === false && !r.querySelector("${s.D} .wz-hint")`)));
      await s.tap(`${s.D} [data-wz-msg="charge"]`);
      check(`[${tag}] "Voll geladen" an, ohne gewählte Integrationen: Hinweis "je Integration einschalten"`, await s.ev(`return !!r.querySelector("${s.D} .wz-hint")`));
      await s.tap(`${s.D} [data-wz-msg="charge"]`);
      // Je Meldungsart nach Integration einstellen (Pfeil), ohne Geräte-Ebene
      check(`[${tag}] Pfeil an jeder der fünf Zeilen, alle zu`, (await s.ev(`return r.querySelectorAll("${s.D} button[data-wz-mopen]").length`)) === 5 && (await s.ev(`return r.querySelectorAll("${s.D} .wz-msub").length`)) === 0);
      // Updates: Integrationen (Plattformen) und darunter die einzelnen Updates
      await s.tap(`${s.D} [data-wz-mopen="updates"]`);
      const updList = await s.ev(`return [...r.querySelectorAll('${s.D} [data-wz-int="updates"]')].map((i) => i.dataset.wzDom + ":" + i.closest(".switch").classList.contains("part") + ":" + i.checked)`);
      check(`[${tag}] Updates aufgeklappt: Integrationen mit Update-Einträgen (Home Assistant "teils" nicht, HACS an, Geräte-Firmware aus)`, updList.length >= 4 && updList.includes("hassio:false:true") && updList.includes("hacs:false:true") && updList.includes("shelly:false:false") && updList.includes("hue:false:false"), updList.join());
      await s.tap(`${s.D} [data-wz-int="updates"][data-wz-dom="shelly"]`);
      await s.tap(`${s.D} [data-wz-iopen="updates:hassio"]`);
      await s.tap(`${s.D} [data-wz-md="updates"][data-wz-id="update.mosquitto_update"]`);
      check(`[${tag}] Shelly an, ein Add-on aus: Home Assistant "teils"`, await s.ev(`return r.host._wizard.integState("updates", "shelly") === "on" && r.host._wizard.integState("updates", "hassio") === "part" && !r.host._wizard.s.d.updOn.has("update.mosquitto_update")`));
      await s.tap(`${s.D} [data-wz-mopen="updates"]`);
      // Alle Pfeile nacheinander auf und zu: der Assistent bleibt bedienbar
      for (const id of ["outage", "battery", "new", "charge"]) {
        await s.tap(`${s.D} [data-wz-mopen="${id}"]`);
        check(`[${tag}] Pfeil "${id}" klappt auf`, await s.ev(`return !!r.querySelector('${s.D} [data-wz-int="${id}"]')`));
      }
      for (const id of ["new", "battery"]) await s.tap(`${s.D} [data-wz-mopen="${id}"]`);
      check(`[${tag}] nach dem Auf- und Zuklappen reagiert die Seite weiter`, await s.ev(`return !r.querySelector('${s.D} [data-wz-int="new"]') && !r.querySelector('${s.D} [data-wz-int="battery"]') && !!r.querySelector('${s.D} [data-wz-int="charge"]')`));
      await s.tap(`${s.D} [data-wz-mopen="outage"]`);
      await s.tap(`${s.D} [data-wz-mopen="charge"]`);
      await s.tap(`${s.D} [data-wz-mopen="charge"]`);
      const chargeList = await s.ev(`return [...r.querySelectorAll('${s.D} [data-wz-int="charge"]')].map((i) => i.dataset.wzDom + ":" + i.checked)`);
      check(`[${tag}] Voll geladen aufgeklappt: nur Integrationen mit Batteriegeräten, alle aus`, chargeList.length >= 1 && chargeList.every((x) => x.endsWith(":false")), chargeList.join());
      const chargeDom = chargeList[0].split(":")[0];
      await s.tap(`${s.D} [data-wz-int="charge"][data-wz-dom="${chargeDom}"]`);
      check(`[${tag}] Integration einschalten schaltet die Meldung mit ein, Hinweis weg`, await s.ev(`const d = r.host._wizard.s.d; return r.host._wizard.integState("charge", ${JSON.stringify(chargeDom)}) === "on" && d.on.charge && !r.querySelector("${s.D} .wz-hint")`));
      await s.tap(`${s.D} [data-wz-mopen="outage"]`);
      const outList = await s.ev(`return [...r.querySelectorAll('${s.D} [data-wz-int="outage"]')].map((i) => i.dataset.wzDom + ":" + i.checked)`);
      check(`[${tag}] Ausgefallene Geräte aufgeklappt: alle Integrationen der Auswahl, alle an`, outList.length >= 2 && outList.every((x) => x.endsWith(":true")), outList.join());
      const outDom = outList[0].split(":")[0];
      await s.tap(`${s.D} [data-wz-int="outage"][data-wz-dom="${outDom}"]`);
      check(`[${tag}] Integration abgewählt, die Zeile bleibt offen`, (await s.ev(`return r.host._wizard.s.d.ex.outage.has(${JSON.stringify(outDom)}) && !!r.querySelector('${s.D} [data-wz-int="outage"]')`)));
      // Eine Ebene tiefer: die Geräte einer Integration (Ausfall, Batterie, Laden), ein Schalter je Gerät
      check(`[${tag}] "Neue Geräte" hat keine Geräte-Ebene`, !(await s.ev(`return !!r.querySelector('${s.D} [data-wz-iopen^="new:"]')`)));
      await s.tap(`${s.D} [data-wz-iopen="outage:${outDom}"]`);
      check(`[${tag}] Geräte einer abgeschalteten Integration sind ausgegraut`, await s.ev(`const l = [...r.querySelectorAll('${s.D} [data-wz-md="outage"]')]; return l.length >= 1 && l.every((i) => i.disabled)`));
      await s.tap(`${s.D} [data-wz-iopen="outage:${outDom}"]`);
      const outDom2 = outList[1].split(":")[0];
      await s.tap(`${s.D} [data-wz-iopen="outage:${outDom2}"]`);
      const outDevs = await s.ev(`return [...r.querySelectorAll('${s.D} [data-wz-md="outage"]')].map((i) => i.dataset.wzId + ":" + i.checked)`);
      check(`[${tag}] Ausgefallene Geräte, Integration aufgeklappt: Geräte mit Schalter, alle an`, outDevs.length >= 1 && outDevs.every((x) => x.endsWith(":true")), outDevs.join());
      // Gerade ausgefallene Geräte tragen einen kleinen roten Punkt mit Text, nur in der Zeile "Ausfall"; Name und Bereich bleiben
      const downIds = await s.ev(`return r.host._wizard.s.data.devices.filter((x) => x.down && x.domain === ${JSON.stringify(outDom2)}).map((x) => x.id)`);
      const shownDown = await s.ev(`return [...r.querySelectorAll('${s.D} .wz-dsub .wz-down')].map((e) => e.closest(".wz-li").querySelector("[data-wz-md]").dataset.wzId)`);
      check(`[${tag}] "${L.down}": nur ausgefallene Geräte tragen die Marke, Name und Bereich bleiben`, JSON.stringify([...shownDown].sort()) === JSON.stringify([...downIds].sort()) && (await s.ev(`return [...r.querySelectorAll('${s.D} .wz-dsub .wz-li')].every((li) => li.querySelector(".wz-nm").firstChild.textContent.trim().length > 0)`)), JSON.stringify({ shownDown, downIds, dom: outDom2 }));
      await s.shot("4-outage-down");
      // Batteriestand klein hinter dem Bereich: nur in den Zeilen Batterie und Laden, ohne dass die Zeile höher wird
      const batLvl = await s.ev(`return r.host._wizard.s.data.devices.filter((x) => typeof x.battery_level === "number" && x.battery).map((x) => x.id)`);
      check(`[${tag}] Ausfall-Zeile zeigt keinen Batteriestand`, !(await s.ev(`return !!r.querySelector('${s.D} .wz-dsub .wz-bl')`)));
      check(`[${tag}] Daten: Batteriegeräte tragen battery_level`, batLvl.length >= 1);
      const muteId = outDevs[0].split(":")[0];
      await s.tap(`${s.D} [data-wz-md="outage"][data-wz-id="${muteId}"]`);
      check(`[${tag}] Gerät ausgeschaltet (Entwurf), noch nichts gespeichert`, (await s.ev(`return r.host._wizard.s.d.devOff.outage.has(${JSON.stringify(muteId)})`)) && (await s.p.evaluate(() => (window.__wsCalls || []).filter((m) => m.type === "device_panel/set_device_settings").length)) === 0);
      await s.tap(`${s.D} [data-wz-iopen="outage:${outDom2}"]`);
      await s.tap(`${s.D} [data-wz-iopen="charge:${chargeDom}"]`);
      const chDevs = await s.ev(`return [...r.querySelectorAll('${s.D} [data-wz-md="charge"]')].map((i) => i.dataset.wzId + ":" + i.checked)`);
      check(`[${tag}] Voll geladen, Integration aufgeklappt: nur Geräte mit Batterie, alle an`, chDevs.length >= 1 && chDevs.every((x) => x.endsWith(":true")), chDevs.join());
      // Batteriestand klein hinter dem Bereich ("Küche · 64 %"): in einer Zeile, die Zeile wird nicht höher als ohne Stand
      const lvl = await s.ev(`const l = [...r.querySelectorAll('${s.D} .wz-dsub .wz-li')].map((li) => ({ id: li.querySelector("[data-wz-md]").dataset.wzId, sub: li.querySelector(".wz-nm small")?.innerText.replace(/\\s+/g, " ").trim() || "", h: li.getBoundingClientRect().height })); return l`);
      const wantLvl = await s.ev(`const m = new Map(r.host._wizard.s.data.devices.map((x) => [x.id, x.battery_level])); return [...r.querySelectorAll('${s.D} [data-wz-md="charge"]')].map((i) => m.get(i.dataset.wzId))`);
      check(`[${tag}] Zeilen Voll geladen: Batteriestand hinter dem Bereich, eine Zeile`, lvl.length >= 1 && lvl.every((x, i) => (typeof wantLvl[i] === "number" ? x.sub.endsWith(wantLvl[i] + " %") : !/ %$/.test(x.sub)) && x.h < 70), JSON.stringify(lvl));
      await s.shot("4b-battery-level");
      const chargeOffId = chDevs.length >= 2 ? chDevs[0].split(":")[0] : null;
      if (chargeOffId) {
        await s.tap(`${s.D} [data-wz-md="charge"][data-wz-id="${chargeOffId}"]`);
        check(`[${tag}] ein Gerät aus: Schalter der Integration "teils"`, await s.ev(`return r.host._wizard.integState("charge", ${JSON.stringify(chargeDom)}) === "part" && r.querySelector('${s.D} [data-wz-int="charge"][data-wz-dom="${chargeDom}"]').closest(".switch").classList.contains("part")`));
      }
      await s.tap(`${s.D} [data-wz-iopen="charge:${chargeDom}"]`);
      await s.tap(`${s.D} [data-wz-mopen="charge"]`);
      await s.tap(`${s.D} [data-wz-mopen="outage"]`);
      check(`[${tag}] Eine Update-Integration einzuschalten schaltet die Meldung mit ein`, await s.ev(`return r.host._wizard.s.d.on.updates === true`));
      await s.ev(`const i = r.querySelector('${s.D} [data-wz-v="updates_time"]'); i.value = "07:30"; i.dispatchEvent(new Event("input", { bubbles: true }))`);
      check(`[${tag}] Ausgefallene Geräte und Batterie an`, await s.ev(`const d = r.host._wizard.s.d; return d.on.outage && d.on.battery && !d.on.new && d.on.charge`));
      // Prüfung: Melden nach < Ausgefallen nach, Bereich
      const setVal = (k, v) => s.ev(`const i = r.querySelector('${s.D} [data-wz-v="${k}"]'); i.value = ${JSON.stringify(String(v))}; i.dispatchEvent(new Event("input", { bubbles: true }))`);
      await setVal("notify_delay", 1);
      check(`[${tag}] Melden nach unter "Ausgefallen nach": Fehlertext mit dem jetzigen Wert, Weiter gesperrt`, ((await s.text(`${s.D} [data-wz-err]`)) === L.errDelay) && (await s.ev(`return r.querySelector('${s.D} .wz-ft [data-wz="next"]').disabled`)));
      await setVal("notify_delay", 6);
      check(`[${tag}] gültig: Fehler weg, Weiter frei`, ((await s.text(`${s.D} [data-wz-err]`)) === "") && !(await s.ev(`return r.querySelector('${s.D} .wz-ft [data-wz="next"]').disabled`)));
      await setVal("battery_low", 80);
      check(`[${tag}] Batterie 80 % ausserhalb 1 bis 50: Weiter gesperrt`, (await s.text(`${s.D} [data-wz-err]`)).includes("50") && (await s.ev(`return r.querySelector('${s.D} .wz-ft [data-wz="next"]').disabled`)));
      await setVal("battery_low", 20);
      await s.shot("5-messages");

      // Schritt 5: Ruhezeit
      await s.tap(`${s.D} [data-wz="next"]`);
      await s.wait(`return r.host._wizard.s.step === "quiet"`);
      await s.tap(`${s.D} [data-wz-quiet]`);
      await s.ev(`const i = r.querySelector('${s.D} [data-wz-time="from"]'); i.value = "23:00"; i.dispatchEvent(new Event("change", { bubbles: true }))`);
      check(`[${tag}] Ruhezeit an, Von 23:00`, await s.ev(`const q = r.host._wizard.s.d.quiet; return q.on && q.from === "23:00" && q.to === "07:00"`));

      // Systemauslastung unter der Ruhezeit: drei Arten mit aktuellem Wert, Standardwerte der Status-App; kein Empfänger, kein Stillstand
      check(`[${tag}] System: drei Zeilen mit aktuellem Wert (${L.sysNow(23)}), ohne Empfänger und Stillstand`, (await s.ev(`return r.querySelectorAll("${s.D} [data-wz-syson]").length`)) === 3 && (await s.text(`${s.D} .wz-h2b`)) === L.sysTitle && (await s.ev(`return r.querySelector("${s.D} [data-wz-syson=cpu]").closest(".wz-msg").innerText`)).includes(L.sysNow(23)) && !(await s.ev(`return !!r.querySelector("${s.D} select, ${s.D} [data-wz-target]")`)));
      check(`[${tag}] System: Standardwerte (Grenze 99, Mindestdauer 3) und alle an`, await s.ev(`const y = r.host._wizard.s.d.sys; return ["cpu","ram","disk"].every((k) => y[k].on && y[k].limit === "99" && y[k].min === "3")`));
      await s.shot("5b-system");
      await s.ev(`const i = r.querySelector('${s.D} [data-wz-sys="cpu"][data-wz-part="limit"]'); i.value = "80"; i.dispatchEvent(new Event("input", { bubbles: true }))`);
      await s.ev(`const i = r.querySelector('${s.D} [data-wz-sys="disk"][data-wz-part="min"]'); i.value = "99"; i.dispatchEvent(new Event("input", { bubbles: true }))`);
      check(`[${tag}] System: Mindestdauer 99 ist ungültig, Weiter gesperrt, Fehlertext da`, (await s.ev(`return r.querySelector('${s.D} .wz-ft [data-wz="next"]').disabled`)) && (await s.text(`${s.D} [data-wz-err]`)).length > 0);
      await s.ev(`const i = r.querySelector('${s.D} [data-wz-sys="disk"][data-wz-part="min"]'); i.value = "30"; i.dispatchEvent(new Event("input", { bubbles: true }))`);
      await s.tap(`${s.D} [data-wz-syson="ram"]`);
      check(`[${tag}] System: Arbeitsspeicher aus (Werte gesperrt), Weiter wieder frei`, (await s.ev(`return r.host._wizard.s.d.sys.ram.on === false && r.querySelector('${s.D} [data-wz-sys="ram"][data-wz-part="limit"]').disabled && !r.querySelector('${s.D} .wz-ft [data-wz="next"]').disabled`)));

      // Schritt 6: Zusammenfassung; erst jetzt wird gespeichert
      await s.tap(`${s.D} [data-wz="next"]`);
      await s.wait(`return r.host._wizard.s.step === "done"`);
      check(`[${tag}] Zusammenfassung zeigt Systemauslastung`, (await s.text(`${s.D} .wz-sum`)).includes(L.sumSystem));
      check(`[${tag}] Zusammenfassung mit Ziel und Meldungen`, (await s.text(`${s.D} .wz-sum`)).includes("notify.mobile_app_testhandy"));
      check(`[${tag}] bis hierher nichts gespeichert (Zustand weiter "new")`, (await s.calls()).length === 0 && (await s.state()) === "new");
      await s.shot("6-done");
      await s.tap(`${s.D} [data-wz="finish"]`);
      check(`[${tag}] Fertigstellen: Fenster zu`, await s.closed());
      const saved = (await s.calls())[0] || {};
      check(`[${tag}] ein einziges set_options mit Auswahl, Ziel, Meldungen, Werten`, (await s.calls()).length === 1 && saved.exclude_integrations?.join() === off && saved.exclude_types?.join() === types[0] && saved.exclude_devices?.join() === devs[0] && saved.notify_service === "notify.mobile_app_testhandy" && saved.notify_outage === true && saved.notify_online === true && saved.battery_push === true && saved.notify_new === false && saved.notify_updates === true && saved.updates_integrations_on?.join() === "shelly" && saved.updates_exclude?.join() === "update.mosquitto_update" && saved.updates_include?.join() === "" && saved.updates_integrations_off?.join() === "" && JSON.stringify(saved.charge_integrations) === JSON.stringify([chargeDom]) && saved.notify_exclude_integrations?.join() === outDom && saved.updates_time === "07:30" && !("offline_after" in saved) && saved.notify_delay === 6 && saved.battery_low === 20, JSON.stringify(saved));
      check(`[${tag}] System gespeichert: CPU 80 %/3 Min., RAM aus, Festplatte 99 %/30 Min.`, saved.status_cpu_alert === true && saved.status_cpu_limit === 80 && saved.status_cpu_minutes === 3 && saved.status_ram_alert === false && !("status_ram_limit" in saved) && saved.status_disk_alert === true && saved.status_disk_limit === 99 && saved.status_disk_minutes === 30 && !("status_notify" in saved) && !("notify_service_status" in saved));
      check(`[${tag}] Ruhezeit gespeichert (sieben Tage 23:00 bis 07:00)`, saved.quiet_enabled === true && saved.quiet_days?.length === 7 && saved.quiet_days.every((d) => d.on && d.from === "23:00" && d.to === "07:00"));
      const devCalls = await s.p.evaluate(() => (window.__wsCalls || []).filter((m) => m.type === "device_panel/set_device_settings"));
      check(`[${tag}] Geräte: stumm bei Ausfall${chargeOffId ? " und Lademeldung aus am Gerät" : ""} als set_device_settings, vor dem Abschluss`, devCalls.some((c) => c.device_id === muteId && c.notify === false) && (!chargeOffId || devCalls.some((c) => c.device_id === chargeOffId && c.charge === false)) && devCalls.length === (chargeOffId ? 2 : 1) - (chargeOffId === muteId ? 1 : 0), JSON.stringify(devCalls));
      check(`[${tag}] Fertigstellen löscht den Zwischenstand`, saved.wizard_draft === null && (await s.p.evaluate(() => window.__opts.wizard_draft)) === null);
      check(`[${tag}] Zustand "done" mit Zeitpunkt`, saved.wizard_state === "done" && saved.wizard_done_at > 1_600_000_000 && (await s.state()) === "done");
      check(`[${tag}] Kachel und Punkt weg`, !(await s.tileShown()) && !(await s.launcherDot()));
      await s.p.close();
    }

    // --- "Jetzt nicht": Kachel und Punkt bleiben, kein Fenster von selbst
    {
      const s = await session("new");
      await s.opened();
      await s.tap(`${s.D} [data-wz="later"]`);
      check(`[${tag}] "${L.later}": Fenster zu, Zustand "later"`, (await s.closed()) && (await s.wait(`return r.host._wizardState === "later"`)) && (await s.state()) === "later");
      check(`[${tag}] "later": Kachel und Punkt bleiben`, (await s.tileShown()) && (await s.launcherDot()));
      // Kachel öffnet den Assistenten
      await s.tap(".apps-btn");
      await s.wait(`return r.querySelector("dialog.apps-dlg")?.open`);
      check(`[${tag}] Launcher: Kachel "${L.tile}" zuoberst in der Gruppe Device Panel`, (await s.ev(`const b = r.querySelector('dialog.apps-dlg [data-ap="open"][data-id="wizard"]'); const g = b?.closest(".ap-grid, .ap-list"); return g?.querySelector("[data-id]")?.dataset.id === "wizard" && g.previousElementSibling?.textContent.includes("Device Panel")`)));
      check(`[${tag}] Kachel trägt die orange Pille "${L.pill}"`, (await s.ev(`return r.querySelector('dialog.apps-dlg [data-ap="open"][data-id="wizard"]').closest(".ap-tile, .ap-row")?.querySelector(".ap-badge")?.textContent.trim()`)) === L.pill);
      await s.tap('dialog.apps-dlg [data-ap="open"][data-id="wizard"]');
      check(`[${tag}] Kachel öffnet den Assistenten`, await s.opened());
      // Zwischenstand (2.136.0): Schritt und Entwurf bleiben beim Schliessen, ohne Rückfrage und ohne etwas anzuwenden
      await s.tap(`${s.D} [data-wz="start"]`);
      await s.wait(`return r.host._wizard.s.step === "integrations"`);
      const first = await s.ev(`return r.querySelector("${s.D} [data-wz-integ]").dataset.wzInteg`);
      await s.tap(`${s.D} [data-wz-integ="${first}"]`);
      await s.tap(`${s.D} [data-wz="next"]`);
      await s.wait(`return r.host._wizard.s.step === "types"`);
      check(`[${tag}] nach dem Schritt ist der Zwischenstand gespeichert (Schritt "types")`, await s.wait(`return true`) && (await s.p.waitForFunction(() => window.__opts.wizard_draft?.step === "types", null, { timeout: 5000 }).then(() => true, () => false)));
      const typ = await s.ev(`return r.querySelector("${s.D} [data-wz-type]").dataset.wzType`);
      await s.tap(`${s.D} [data-wz-type="${typ}"]`);
      await s.tap(`${s.D} [data-wz="close"]`);
      check(`[${tag}] Kreuz ab Schritt 1: Rückfrage mit "${L.later}" und "${L.never}", Fenster bleibt offen`, !(await s.closed()) && (await s.ev(`return !!r.querySelector("${s.D} .wz-ask [data-wz='later']") && !!r.querySelector("${s.D} .wz-ask [data-wz='never']")`)));
      await s.p.keyboard.press("Escape");
      check(`[${tag}] Escape schliesst nur die Rückfrage`, !(await s.closed()) && !(await s.ev(`return !!r.querySelector("${s.D} .wz-ask")`)));
      await s.tap(`${s.D} [data-wz="close"]`);
      await s.tap(`${s.D} .wz-ask [data-wz="later"]`);
      check(`[${tag}] "${L.later}": ohne weitere Rückfrage, nichts angewendet, Zustand bleibt "later"`, (await s.closed()) && !(await s.ev(`return r.querySelector("dialog.discard-dlg").open`)) && (await s.calls()).length === 0 && (await s.state()) === "later");
      const draft = await s.p.evaluate(() => window.__opts.wizard_draft);
      check(`[${tag}] Zwischenstand enthält Schritt, Integration und Typ`, draft?.step === "types" && draft.d.exI.includes(first) && draft.d.exT.includes(typ), JSON.stringify(draft));
      await s.tap(".apps-btn");
      await s.wait(`return r.querySelector("dialog.apps-dlg")?.open`);
      await s.tap('dialog.apps-dlg [data-ap="open"][data-id="wizard"]');
      check(`[${tag}] erneut gestartet: gleich im Schritt "types", Auswahl noch da`, (await s.opened()) && (await s.step()) === "types" && (await s.ev(`const d = r.host._wizard.s.d; return d.exI.has(${JSON.stringify(first)}) && d.exT.has(${JSON.stringify(typ)})`)) && !(await s.ev(`return r.querySelector('${s.D} [data-wz-type="${typ}"]').checked`)));
      await s.tap(`${s.D} [data-wz="back"]`);
      await s.tap(`${s.D} [data-wz="back"]`);
      await s.wait(`return r.host._wizard.s.step === "welcome"`);
      check(`[${tag}] Willkommen zeigt "${L.reset}"`, (await s.text(`${s.D} [data-wz="reset"]`)) === L.reset);
      await s.tap(`${s.D} [data-wz="reset"]`);
      check(`[${tag}] Entwurf verwerfen: Auswahl zurück auf den Stand, Zwischenstand gelöscht`, (await s.ev(`const d = r.host._wizard.s.d; return d.exI.size === 0 && d.exT.size === 0 && !r.querySelector('${s.D} [data-wz="reset"]')`)) && (await s.p.waitForFunction(() => window.__opts.wizard_draft === null, null, { timeout: 5000 }).then(() => true, () => false)));
      await s.tap(`${s.D} [data-wz="close"]`);
      check(`[${tag}] zu, nichts angewendet, Zustand bleibt "later"`, (await s.closed()) && (await s.calls()).length === 0 && (await s.state()) === "later");
      await s.p.close();
    }

    // --- Kreuz ab Schritt 1 -> Rückfrage -> "Nicht mehr zeigen": Zustand "off", Zwischenstand gelöscht
    {
      const s = await session("new");
      await s.opened();
      await s.tap(`${s.D} [data-wz="start"]`);
      await s.wait(`return r.host._wizard.s.step === "integrations"`);
      await s.tap(`${s.D} [data-wz="close"]`);
      await s.tap(`${s.D} .wz-ask [data-wz="never"]`);
      check(`[${tag}] Rückfrage "${L.never}": zu, Zustand "off", kein Zwischenstand`, (await s.closed()) && (await s.wait(`return r.host._wizardState === "off"`)) && (await s.state()) === "off" && (await s.p.evaluate(() => window.__opts.wizard_draft ?? null)) === null);
      await s.p.close();
    }

    // --- "Nicht mehr zeigen": keine Kachel, kein Punkt
    {
      const s = await session("new");
      await s.opened();
      await s.tap(`${s.D} [data-wz="never"]`);
      check(`[${tag}] "${L.never}": Fenster zu, Zustand "off"`, (await s.closed()) && (await s.wait(`return r.host._wizardState === "off"`)) && (await s.state()) === "off");
      check(`[${tag}] "off": weder Kachel noch Punkt`, !(await s.tileShown()) && !(await s.launcherDot()));
      await s.p.close();
    }

    // --- Bestehende Installation ("done"): kein Fenster, keine Kachel; Neustart über die Einstellungen
    {
      const s = await session("done");
      await s.p.waitForTimeout(400);
      check(`[${tag}] "done": kein Fenster, keine Kachel, kein Punkt`, !(await s.ev(`return r.querySelector("${s.D}").open`)) && !(await s.tileShown()) && !(await s.launcherDot()));
      await s.p.evaluate(() => { window.__opts.wizard_done_at = 1_700_000_000; });
      await s.tap(".gear-btn");
      await s.wait(`return !!r.querySelector("dialog.settings .set-sec")`);
      await s.tap('[data-set="section"][data-id="updates"]');
      await s.tap('[data-set="subtab"][data-group="panel"][data-key="pstart"]');
      await s.wait(`return !!r.querySelector('[data-set="wizard-start"]')`);
      const titles = await s.ev(`return [...r.querySelectorAll("dialog.settings .set-sec-body .set-title")].map(x => x.textContent.trim())`);
      check(`[${tag}] Kapitel "${L.ttl}" unter Panel › Allgemein`, titles.includes(L.ttl), JSON.stringify(titles));
      check(`[${tag}] Knopf "${L.startBtn}", Datum des letzten Abschlusses`, ((await s.text('[data-set="wizard-start"]')) === L.startBtn) && /2023/.test(await s.text("dialog.settings .set-sec-body")));
      await s.ev(`r.host._settings.draft.battery_low = 21; r.host._renderSettings()`);
      check(`[${tag}] mit ungespeicherter Änderung gesperrt`, await s.wait(`return r.querySelector('[data-set="wizard-start"]').disabled`));
      await s.ev(`r.host._settings.draft.battery_low = r.host._settings.data.values.battery_low; r.host._renderSettings()`);
      await s.wait(`return !r.querySelector('[data-set="wizard-start"]').disabled`);
      await s.tap('[data-set="wizard-start"]');
      check(`[${tag}] Neustart: Einstellungen zu, Assistent offen, Zustand "open"`, (await s.opened()) && !(await s.ev(`return r.querySelector("dialog.settings").open`)) && (await s.wait(`return r.host._wizardState === "open"`)) && (await s.state()) === "open");
      check(`[${tag}] "open": Kachel und Punkt kommen zurück`, (await s.tileShown()) && (await s.launcherDot()));
      // Felder zeigen den jetzigen Stand
      await s.tap(`${s.D} [data-wz="start"]`);
      await s.wait(`return r.host._wizard.s.step === "integrations"`);
      check(`[${tag}] Felder zeigen den jetzigen Stand (alles an, nichts zurückgesetzt)`, await s.ev(`return [...r.querySelectorAll("${s.D} [data-wz-integ]")].every((i) => i.checked) && r.host._wizard.s.d.target === "none"`));
      // Beenden macht daraus "done"
      for (let n = 0; n < 4; n++) { await s.tap(`${s.D} [data-wz="next"]`); await s.p.waitForTimeout(80); }
      await s.wait(`return r.host._wizard.s.step === "done"`);
      await s.tap(`${s.D} [data-wz="finish"]`);
      check(`[${tag}] Fertigstellen: Zustand "done", Kachel und Punkt wieder weg, Rückmeldung "${L.snack}"`, (await s.closed()) && (await s.state()) === "done" && !(await s.tileShown()) && !(await s.launcherDot()));
      await s.p.close();
    }
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
