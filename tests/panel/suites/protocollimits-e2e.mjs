// Einstellungen der Protokolle (2.105.0), seit 2.117.0 im dritten Reiter "Speicher" von Panel (vorher Allgemein): Grösse in MB und Einträge,
// je für Meldungen/Routinen und für das Panel-Protokoll, mit der Belegung; dazu Aufbewahrung (Tage) und Grösse der Verläufe von Verfügbarkeit
// und Empfang, der Gesamtbalken und die übrigen Dateien. Zahlen ausserhalb des Bereichs
// sperren "Speichern"; eine tiefere Grenze als die Belegung fragt vor dem Speichern (Kürzen ist endgültig). Dazu im Protokoll-Fenster der
// Zeitraum "Alle" (ab dem ältesten Eintrag, auch über 12 Monate). Deutsch und Englisch, Desktop und Handy, echte Klicks und Taps.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { chapter: "Protokolle und Log", tab: "Speicher", hist: "Geräteverläufe", push: "Gesendete Meldungen", other: "Weitere Daten", range: "Wert muss", cutYes: "Kürzen und speichern", cutNo: "Abbrechen", used: "Belegt", all: "Alle" },
  en: { chapter: "Histories and log", tab: "Storage", hist: "Device histories", push: "Sent notifications", other: "Other data", range: "Value must", cutYes: "Cut and save", cutNo: "Cancel", used: "Used", all: "All" },
};
const KEYS = ["protocol_max_mb", "protocol_max_entries", "log_max_mb", "log_max_entries"];
const HIST = ["availability_keep_days", "availability_max_mb", "signal_keep_days", "signal_max_mb", "push_keep_days", "push_max_mb"];
const DAY = 86400;

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
    const fill = async (sel, value) => { const h = await handle(sel); await h.scrollIntoViewIfNeeded(); await h.fill(String(value)); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 6000 }).then(() => true, () => false);
    const calls = (type) => p.evaluate((t) => window.__wsCalls.filter((m) => m.type === t), type);
    const S = "dialog.settings";

    // Belegung: Meldungen/Routinen 4 MB und 12 Einträge im grössten Protokoll; Panel-Protokoll 2 MB, 300 Einträge
    await p.evaluate(() => { window.__usage = { protocol: { bytes: 4 * 1048576, entries: 40, items: 3, max_item: 12 }, log: { bytes: 2 * 1048576, entries: 300 } }; });
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("${S} .set-sec")`);
    await tap('[data-set="section"][data-id="updates"]');
    await wait(`return !!r.querySelector('${S} .sub-tab[data-key="pstorage"]')`);
    check(`[${tag}] Panel hat drei Reiter: Allgemein, Updates, ${T.tab}`, await ev(`const t = [...r.querySelectorAll('${S} .sub-tab[data-group="panel"]')].map((e) => e.dataset.key); return t.join() === "pstart,pupdates,pstorage"`));
    check(`[${tag}] unter Allgemein steht das Kapitel "${T.chapter}" nicht mehr`, await ev(`return ![...r.querySelectorAll("${S} .set-title")].some((e) => e.textContent.trim() === ${JSON.stringify(T.chapter)}) && !r.querySelector('${S} input[data-opt="protocol_max_mb"]')`));
    await tap(`${S} .sub-tab[data-key="pstorage"]`);
    await wait(`return !!r.querySelector('${S} input[data-opt="protocol_max_mb"]')`);
    check(`[${tag}] Reiter "${T.tab}": Kapitel "${T.hist}", "${T.push}", "${T.chapter}" und "${T.other}" mit zehn Feldern`, await ev(`const t = [...r.querySelectorAll("${S} .set-title")].map((e) => e.textContent.trim()); return t.join("|") === ${JSON.stringify([T.hist, T.push, T.chapter, T.other].join("|"))} && ${JSON.stringify([...KEYS, ...HIST])}.every((k) => !!r.querySelector('${S} input[data-opt="' + k + '"]'))`));
    check(`[${tag}] Gesamtbalken: rund 13 MB (4 + 2,5 + 4 + 2 + 0,5 + 0,1 + 0,1)`, await ev(`const b = r.querySelector("${S} .sto-big"); const seg = r.querySelectorAll("${S} .sto-seg i").length; return !!b && /1[34][,.]\\d|1[34] MB/.test(b.textContent) && seg === 5 && r.querySelectorAll("${S} .sto-leg span").length === 5`), await ev(`return r.querySelector("${S} .sto-big")?.textContent`));
    check(`[${tag}] Balken je Zeile (Verfügbarkeit 20 %, Empfang 5 %, Meldungen 4 %, Protokoll 13 %, Log 20 %)`, await ev(`const w = [...r.querySelectorAll("${S} .sto-meter i")].map((i) => parseInt(i.style.width)); return w.length === 5 && w.join() === "20,5,4,13,20"`), await ev(`return [...r.querySelectorAll("${S} .sto-meter i")].map((i) => i.style.width).join()`));
    check(`[${tag}] Verläufe und Meldungen: 365 Tage / 20 MB, 365 Tage / 50 MB, 365 Tage / 10 MB (Standard 1 Jahr), Einheit Tage`, await ev(`return ${JSON.stringify(HIST)}.map((k) => r.querySelector('${S} input[data-opt="' + k + '"]').value).join() === "365,20,365,50,365,10" && /Tage|days/.test(r.querySelector('${S} input[data-opt="availability_keep_days"]').parentElement.querySelector(".unit").textContent)`));
    check(`[${tag}] Weitere Daten: drei Zeilen, Batterie-Hinweis`, await ev(`return r.querySelectorAll("${S} .sto-row").length === 3 && r.querySelectorAll("${S} .sto-batt").length === 2`));
    check(`[${tag}] Standard: 30 MB, 5000 Einträge, 10 MB, 4000 Einträge`, await ev(`return ${JSON.stringify(KEYS)}.map((k) => r.querySelector('${S} input[data-opt="' + k + '"]').value).join() === "30,5000,10,4000"`));
    check(`[${tag}] Einheiten MB und Einträge am Feld`, await ev(`const u = [...r.querySelectorAll('${S} input[data-opt="protocol_max_mb"], ${S} input[data-opt="protocol_max_entries"]')].map((i) => i.parentElement.querySelector(".unit").textContent); return u[0] === "MB" && /Einträge|entries/.test(u[1])`));
    check(`[${tag}] Belegung steht in den Zeilen (4 MB / 40 Einträge, 2 MB / 300 Einträge, grösstes Protokoll 12)`, await wait(`const t = r.querySelector("${S} .set-sec-body").textContent; return t.includes("4") && t.includes("40") && t.includes("12") && t.includes("2") && t.includes("300") && t.includes(${JSON.stringify(T.used)})`));
    await (await handle(`${S} input[data-opt="log_max_entries"]`)).scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${outDir}/protocollimits-${tag.replace("/", "-")}.png` });

    // Bereich: ausserhalb sperrt "Speichern"
    await fill(`${S} input[data-opt="protocol_max_mb"]`, "500");
    check(`[${tag}] 500 MB: Fehlermeldung, "Speichern" gesperrt`, await wait(`return r.querySelector('${S} .opt.invalid') && r.querySelector('${S} [data-set="save"]').disabled === true`));
    await fill(`${S} input[data-opt="protocol_max_mb"]`, "30");

    // Höhere Werte: speichert ohne Rückfrage
    await fill(`${S} input[data-opt="protocol_max_mb"]`, "50");
    await fill(`${S} input[data-opt="log_max_entries"]`, "8000");
    await tap(`${S} [data-set="save"]`);
    await wait(`return r.querySelector("${S} .set-count.saved")`);
    const so = (await calls("device_panel/set_options")).at(-1)?.values;
    check(`[${tag}] höher: ohne Rückfrage gespeichert (set_options mit 50 MB und 8000)`, so && so.protocol_max_mb === 50 && so.log_max_entries === 8000 && !(await ev(`return !!r.querySelector("${S} .cut-ask")`)), JSON.stringify(so));

    // Tiefer als die Belegung: Rückfrage
    await fill(`${S} input[data-opt="log_max_entries"]`, "100");
    await tap(`${S} [data-set="save"]`);
    check(`[${tag}] tiefer als belegt (100 < 300): Rückfrage "${T.cutYes}", nichts gespeichert`, await wait(`const a = r.querySelector("${S} .cut-ask"); return !!a && !!r.querySelector('${S} [data-set="cut-yes"]')`) && (await calls("device_panel/set_options")).length === 1);
    await tap(`${S} [data-set="cut-no"]`);
    check(`[${tag}] "${T.cutNo}": Rückfrage weg, Entwurf bleibt (100), noch nichts gespeichert`, await wait(`return !r.querySelector("${S} .cut-ask") && r.querySelector('${S} input[data-opt="log_max_entries"]').value === "100"`) && (await calls("device_panel/set_options")).length === 1);
    await tap(`${S} [data-set="save"]`);
    await wait(`return !!r.querySelector("${S} .cut-ask")`);
    await tap(`${S} [data-set="cut-yes"]`);
    await wait(`return r.querySelector("${S} .set-count.saved")`);
    const cut = (await calls("device_panel/set_options")).at(-1)?.values;
    check(`[${tag}] "${T.cutYes}": gespeichert (log_max_entries 100)`, cut && cut.log_max_entries === 100, JSON.stringify(cut));
    // Verfügbarkeit: 7 Tage sind tiefer als die 31 Tage Verlauf (belegt): Rückfrage nennt "Verfügbarkeit", dann gespeichert
    await fill(`${S} input[data-opt="availability_keep_days"]`, "7");
    await tap(`${S} [data-set="save"]`);
    check(`[${tag}] 7 Tage < 31 Tage Verlauf (belegt): Rückfrage nennt die Verfügbarkeit`, await wait(`const a = r.querySelector("${S} .cut-ask"); return !!a && /Verfügbarkeit|Availability/.test(a.textContent)`));
    await tap(`${S} [data-set="cut-yes"]`);
    await wait(`return r.querySelector("${S} .set-count.saved")`);
    const keep = (await calls("device_panel/set_options")).at(-1)?.values;
    check(`[${tag}] gespeichert: availability_keep_days 7`, keep && keep.availability_keep_days === 7, JSON.stringify(keep));
    await fill(`${S} input[data-opt="signal_keep_days"]`, "400");
    check(`[${tag}] 400 Tage: ausserhalb 7 bis 365, "Speichern" gesperrt`, await wait(`return r.querySelector('${S} .opt.invalid') && r.querySelector('${S} [data-set="save"]').disabled === true`));
    await fill(`${S} input[data-opt="signal_keep_days"]`, "365");
    await tap(`${S} .dlg-actions [data-set="close"]`);
    await wait(`return !r.querySelector("${S}").open`);

    // Protokoll-Fenster: "Alle" geht über 12 Monate zurück
    await p.evaluate(([now]) => {
      window.__magic = { rules: [{ id: "r00000000001", device_id: "d", entity_id: "sensor.temp", name: "Keller kalt", kind: "below", value: 12, for_s: 600, message: "x", body: "", recover: false, recover_message: "", recover_body: "", repeat_s: 0, target: null, enabled: true, critical: false, critical_volume: 10, reset_value: null }], tests: [], seq: 10 };
      window.__protocol = { r00000000001: [
        { at: now - 3 * 86400, k: "fired", res: "sent", title: "neu", body: "", value: "1" },
        { at: now - 500 * 86400, k: "fired", res: "sent", title: "vor 500 Tagen", body: "", value: "2" },
        { at: now - 900 * 86400, k: "fired", res: "failed", title: "vor 900 Tagen", body: "", value: "3", err: "no_target" },
      ] };
      window.__protocolCalls = [];
    }, [Date.now() / 1000]);
    await ev(`r.host._protocol.open({ kind: "magic", itemId: "r00000000001", name: "Keller kalt" })`);
    await wait(`return r.querySelectorAll("dialog.proto-dlg .pr-item").length === 1`);
    check(`[${tag}] Zeitraum-Leiste: sechs Reiter, "${T.all}" dabei, Kapsel auf "30 T."`, await ev(`const bar = r.querySelector("dialog.proto-dlg [data-pr-ranges] .sub-tabs"); return bar.querySelectorAll(".sub-tab").length === 6 && !!bar.querySelector('[data-v="all"]') && bar.querySelector(".sub-tab.on").dataset.v === "30d" && !!bar.querySelector(".seg-pill")`));
    await tap('dialog.proto-dlg [data-pr-ranges] .sub-tab[data-v="12m"]');
    check(`[${tag}] 12 Mt.: nur der neue Eintrag`, await wait(`return r.querySelectorAll("dialog.proto-dlg .pr-item").length === 1`));
    await tap('dialog.proto-dlg [data-pr-ranges] .sub-tab[data-v="all"]');
    check(`[${tag}] "${T.all}": alle drei Einträge, auch die von vor 900 Tagen; Abfrage ohne "since"`, (await wait(`return r.querySelectorAll("dialog.proto-dlg .pr-item").length === 3`)) && (await p.evaluate(() => window.__protocolCalls.at(-1))).since === undefined);
    check(`[${tag}] "${T.all}": Diagramm je Woche über den ganzen Zeitraum`, await ev(`const bars = r.querySelectorAll("dialog.proto-dlg .pr-bar"); return bars.length > 100 && bars.length <= 400 && bars[0].dataset.step === "week" && [...bars].filter((x) => x.querySelector(".pr-col")).length === 3`));
    check(`[${tag}] Hinweis nennt Grösse und Zahl der Grenzen (50 MB, 5000) ohne Zeitgrenze`, await ev(`const n = r.querySelector("dialog.proto-dlg .pr-note").textContent; return n.includes("50") && n.includes("5") && !/366|12 Monate|12 months/.test(n)`), await ev(`return r.querySelector("dialog.proto-dlg .pr-note").textContent`));
    await tap('dialog.proto-dlg [data-pr-ranges] .sub-tab[data-v="own"]');
    check(`[${tag}] "Eigener" nach "${T.all}": Datum von = ältester Eintrag, alle drei Zeilen`, await wait(`const f = r.querySelector('dialog.proto-dlg input[data-pr-date="from"]'); return !!f && new Date(f.value).getTime() < Date.now() - 800 * 86400000 && r.querySelectorAll("dialog.proto-dlg .pr-item").length === 3`));
    await tap('dialog.proto-dlg [data-pr="close"]');
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
