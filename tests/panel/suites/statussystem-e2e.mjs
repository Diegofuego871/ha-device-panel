// Status-App, Abschnitt "System" (2.68.0): CPU und Arbeitsspeicher als Kurve über 24 Std., die Festplatte mit Zeitraum (24 Std., 30 Tage,
// 6 Monate, 1 Jahr); Quelle der Werte automatisch oder eigener Sensor; ohne Sensor ein Hinweis. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { title: "System", cpu: "Prozessor (CPU)", ram: "Arbeitsspeicher (RAM)", disk: "Festplatte", host: "Host", ago24: "vor 24 Std.", ago30: "vor 30 Tagen", ago6: "vor 6 Monaten", ago1y: "vor 1 Jahr", now: "jetzt", r: ["24 Std.", "30 Tage", "6 Monate", "1 Jahr"], noStats: "keine Langzeitstatistik", none: "Kein Sensor gefunden", src: "Quelle der Werte", auto: "Automatisch (Prozessornutzung)", enable: "Sensoren einschalten", undo: "Rückgängig", pending: "lädt die Integration gerade neu", enabled: "Eingeschaltet", add: "System Monitor hinzufügen", optional: "nicht zwingend", size: "{u} von {t} GiB belegt · {f} GiB frei", sizeHint: "Belegter Massenspeicher" },
  en: { title: "System", cpu: "Processor (CPU)", ram: "Memory (RAM)", disk: "Disk", host: "Host", ago24: "24 h ago", ago30: "30 days ago", ago6: "6 months ago", ago1y: "1 year ago", now: "now", r: ["24 h", "30 days", "6 months", "1 year"], noStats: "no long-term statistics", none: "No sensor found", src: "Source of the values", auto: "Automatic (Prozessornutzung)", enable: "Switch on sensors", undo: "To undo", pending: "is reloading the integration", enabled: "Switched on", add: "Add System Monitor", optional: "not required", size: "{u} of {t} GiB used · {f} GiB free", sizeHint: "Belegter Massenspeicher" },
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
    const tap = async (sel) => {
      for (let n = 1; ; n++) {
        const h = await handle(sel);
        if (!h) throw new Error("fehlt: " + sel);
        try { await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); return; } catch (err) { if (n >= 3 || !/not attached|not stable/.test(String(err))) throw err; await p.waitForTimeout(200); }
      }
    };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const calls = (type) => p.evaluate((ty) => window.__wsCalls.filter((m) => m.type === ty), type);
    const win = "dialog.status-dlg";
    const card = (id) => `${win} [data-st-metric-card="${id}"]`;
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g, " ").trim()`);

    await ev(`r.host._status.open()`);
    await wait(`return r.querySelectorAll("${win} .st-sys").length === 3`);
    check(`[${tag}] Abschnitt "${T.title}" mit drei Karten: ${T.cpu}, ${T.ram}, ${T.disk}`, await ev(`const d = r.querySelector("${win}"); const t = [...d.querySelectorAll(".st-sys .st-sys-t b")].map((x) => x.textContent.trim()); return JSON.stringify(t) === ${JSON.stringify(JSON.stringify([T.cpu, T.ram, T.disk]))} && [...d.querySelectorAll(".set-title")].some((x) => x.textContent.trim() === ${JSON.stringify(T.title)})`));
    check(`[${tag}] Karte ${T.cpu}: Wert 17 %, "${T.host}", Kurve, "${T.ago24}" bis "${T.now}", Ø und Spitze`, await ev(`const c = r.querySelector('${card("cpu")}'); return c.querySelector(".st-sys-val").textContent.replace(/\\s/g, "") === "17%" && c.querySelector(".st-sys-t small").textContent.trim() === ${JSON.stringify(T.host)} && !!c.querySelector(".st-sys-plot path.bh-line") && c.querySelector(".st-sys-foot").textContent.includes(${JSON.stringify(T.ago24)}) && c.querySelector("[data-st-ticks] .now-label").textContent.trim() === ${JSON.stringify(T.now)} && /\\d+ % · .*\\d+ %/.test(c.querySelector(".st-sys-foot .mid").textContent)`));
    check(`[${tag}] CPU und RAM ohne Zeitraumleiste, die Festplatte mit vier Knöpfen und gleitender Kapsel`, await wait(`const d = r.querySelector("${win}"); return !d.querySelector('${card("cpu")} .sub-tabs') && !d.querySelector('${card("ram")} .sub-tabs') && JSON.stringify([...d.querySelectorAll('${card("disk")} .sub-tab')].map((x) => x.textContent.trim())) === ${JSON.stringify(JSON.stringify(T.r))} && !!d.querySelector('${card("disk")} .sub-tabs > .seg-pill')`));
    // Festplatte in Gigabyte: "318,4 von 530,7 GiB belegt · 212,3 GiB frei" (Zahlenformat der HA-Sprache), nur bei der Festplatte
    check(`[${tag}] Festplatte zeigt Prozent und Grösse: ${T.size}`, await ev(`const t = r.querySelector('${card("disk")} [data-st-size]')?.textContent.trim(); const n = (v) => v.toLocaleString(r.host._locale?.() || undefined, { maximumFractionDigits: 1 }); return t === ${JSON.stringify(T.size)}.replace("{u}", n(318.4)).replace("{t}", n(530.7)).replace("{f}", n(212.3)) && r.querySelector('${card("disk")} .st-sys-val').textContent.replace(/\\s/g, "") === "60%" && !r.querySelector('${card("cpu")} [data-st-size]') && !r.querySelector('${card("ram")} [data-st-size]')`));
    await p.evaluate(() => { window.__systemNoSize = true; });
    await ev(`r.host._status.loadSystem()`);
    check(`[${tag}] ohne Grössen-Sensoren: nur Prozent, Hinweis auf die Sensoren von System Monitor`, await wait(`const c = r.querySelector('${card("disk")}'); return !c.querySelector("[data-st-size]") && c.textContent.includes(${JSON.stringify(T.sizeHint)}) && !!c.querySelector("[data-st-enable-ask]") && c.querySelector(".st-sys-val").textContent.replace(/\\s/g, "") === "60%"`));
    await p.evaluate(() => { window.__systemNoSize = false; });
    await ev(`r.host._status.loadSystem()`);
    await wait(`return !!r.querySelector('${card("disk")} [data-st-size]')`);
    await ev(`r.querySelector('${win} .st-sys').scrollIntoView({ block: "start" })`);
    await p.waitForTimeout(300);
    check(`[${tag}] Zeitstrahl 24 Std.: Uhrzeiten (HH:00) unter der Kurve, dazu "${T.now}" rechts; senkrechte Hilfslinien`, await ev(`const c = r.querySelector('${card("cpu")}'); const t = [...c.querySelectorAll("[data-st-ticks] span:not(.now-label)")].map((x) => x.textContent.trim()); return t.length >= 3 && t.every((x) => /^\\d\\d:00$/.test(x)) && c.querySelectorAll("svg .bh-v").length === c.querySelectorAll("[data-st-ticks] span:not(.now-label)").length`));
    await p.screenshot({ path: `${outDir}/statussystem-${tag.replace("/", "-")}-0.png` });

    // Zeitraum der Festplatte: nur sie wechselt, CPU bleibt bei 24 Std.
    await p.evaluate(() => { window.__wsCalls = []; });
    await tap(`${card("disk")} [data-st-range="30d"]`);
    check(`[${tag}] "30 Tage": status_system mit range 30d, Festplatte "${T.ago30}", CPU weiter "${T.ago24}", Knopf gewählt`, await wait(`const d = r.querySelector("${win}"); return d.querySelector('${card("disk")} .st-sys-foot').textContent.includes(${JSON.stringify(T.ago30)}) && d.querySelector('${card("cpu")} .st-sys-foot').textContent.includes(${JSON.stringify(T.ago24)}) && d.querySelector('${card("disk")} [data-st-range="30d"]').classList.contains("on")`) && (await calls("device_panel/status_system")).some((m) => m.range === "30d"));
    check(`[${tag}] Zeitstrahl 30 Tage: Daten statt Uhrzeiten`, await ev(`const t = [...r.querySelectorAll('${card("disk")} [data-st-ticks] span:not(.now-label)')].map((x) => x.textContent.trim()); return t.length >= 2 && t.every((x) => !/:/.test(x) && /\\d/.test(x))`));
    await tap(`${card("disk")} [data-st-range="1y"]`);
    check(`[${tag}] "1 Jahr": "${T.ago1y}", ohne Hinweis zur Statistik`, await wait(`const c = r.querySelector('${card("disk")}'); return c.querySelector(".st-sys-foot").textContent.includes(${JSON.stringify(T.ago1y)}) && !c.querySelector(".st-sys-note")`));
    // Ohne Langzeitstatistik (nur Verlauf): Hinweis bei langen Zeiträumen
    await p.evaluate(() => { window.__systemNoStats = true; });
    await tap(`${card("disk")} [data-st-range="6m"]`);
    check(`[${tag}] "6 Monate" ohne Langzeitstatistik: Hinweis "${T.noStats}"`, await wait(`const c = r.querySelector('${card("disk")}'); return c.querySelector(".st-sys-foot").textContent.includes(${JSON.stringify(T.ago6)}) && c.querySelector(".st-sys-note")?.textContent.includes(${JSON.stringify(T.noStats)})`));
    await p.evaluate(() => { window.__systemNoStats = false; });
    await tap(`${card("disk")} [data-st-range="24h"]`);
    check(`[${tag}] zurück auf "24 Std.": "${T.ago24}", kein Hinweis`, await wait(`const c = r.querySelector('${card("disk")}'); return c.querySelector(".st-sys-foot").textContent.includes(${JSON.stringify(T.ago24)}) && !c.querySelector(".st-sys-note")`));

    // Quelle: automatisch oder ein eigener Sensor; Auswahl mit Suchfeld (Entitäten, nicht Geräte)
    check(`[${tag}] "${T.src}": drei Auswahlknöpfe, Voreinstellung "${T.auto}"`, await ev(`const b = [...r.querySelectorAll('${win} .st-pickbtn')]; return b.length === 3 && b[0].textContent.trim() === ${JSON.stringify(T.auto)} && !r.querySelector('${win} select[data-st-metric]')`));
    await tap(`${win} [data-st-pick="ram"]`);
    check(`[${tag}] Auswahl RAM: Suchfeld mit Lupe im Feld, "Automatisch" oben, höchstens 60 Einträge mit Hinweis auf weitere`, await wait(`const d = r.querySelector("${win}"); const rows = [...d.querySelectorAll(".st-pick-list .st-opt")]; return !!d.querySelector('.st-pick label.list-search input[type="search"][data-st-pickq]') && rows.length === 60 + 1 && rows[0].dataset.stChoose === "" && /^(Weitere|\\d+ more)/.test(d.querySelector(".st-pick-list .st-sys-note")?.textContent.trim() || "")`));
    check(`[${tag}] Einträge zeigen Name und Entität (sensor.…); Sensoren, die passen (Prozent), stehen vor den anderen`, await ev(`const rows = [...r.querySelectorAll('${win} .st-pick-list .st-opt')].slice(1); return rows.every((x) => x.querySelector("small")?.textContent.startsWith("sensor.")) && !rows.slice(0, 5).some((x) => x.dataset.stChoose === "sensor.wohnzimmer_temperatur")`));
    // Die Sensoren des Nutzers: Name enthält "Arbeitsspeicherauslastung"
    await ev(`const i = r.querySelector('${win} [data-st-pickq]'); i.value = "arbeitsspeicherausl"; i.dispatchEvent(new Event("input", { bubbles: true }))`);
    check(`[${tag}] Suche "arbeitsspeicherausl": genau ein Treffer sensor.system_monitor_arbeitsspeicherauslastung, Fokus bleibt im Feld, X sichtbar`, await wait(`const d = r.querySelector("${win}"); const rows = [...d.querySelectorAll(".st-pick-list .st-opt")]; return rows.length === 1 && rows[0].dataset.stChoose === "sensor.system_monitor_arbeitsspeicherauslastung" && r.activeElement?.matches("[data-st-pickq]") && !d.querySelector(".st-pick [data-fc]").hidden`));
    await tap(`${win} .st-pick [data-fc]`);
    check(`[${tag}] X im Suchfeld leert es, die ganze Liste kommt zurück (gleiche Regel wie überall)`, await wait(`const d = r.querySelector("${win}"); return d.querySelector("[data-st-pickq]").value === "" && d.querySelectorAll(".st-pick-list .st-opt").length === 61`));
    await p.evaluate(() => { window.__wsCalls = []; });
    await ev(`const i = r.querySelector('${win} [data-st-pickq]'); i.value = "arbeitsspeicherausl"; i.dispatchEvent(new Event("input", { bubbles: true }))`);
    await wait(`return r.querySelectorAll("${win} .st-pick-list .st-opt").length === 1`);
    await tap(`${win} .st-pick-list .st-opt`);
    const sawRam = await (async () => { for (let i = 0; i < 25; i++) { const o = (await calls("device_panel/set_options")).at(-1); if (o && (await calls("device_panel/status_system")).length > 0) return o.values.status_ram_entity === "sensor.system_monitor_arbeitsspeicherauslastung"; await p.waitForTimeout(200); } return false; })();
    check(`[${tag}] Wahl speichert status_ram_entity und lädt die Werte neu; Auswahl geschlossen, Knopf nennt den Sensor`, sawRam && await wait(`const d = r.querySelector("${win}"); return !d.querySelector(".st-pick") && d.querySelector('[data-st-pick="ram"]').textContent.includes("System Monitor Arbeitsspeicherauslastung")`));

    // CPU: eigener Sensor
    await tap(`${win} [data-st-pick="cpu"]`);
    await ev(`const i = r.querySelector('${win} [data-st-pickq]'); i.value = "server"; i.dispatchEvent(new Event("input", { bubbles: true }))`);
    await wait(`return r.querySelectorAll("${win} .st-pick-list .st-opt").length === 1`);
    await p.evaluate(() => { window.__wsCalls = []; });
    await tap(`${win} .st-pick-list .st-opt`);
    const sawBoth = await (async () => { for (let i = 0; i < 25; i++) { const o = (await calls("device_panel/set_options")).at(-1); if (o && (await calls("device_panel/status_system")).length > 0) return o.values.status_cpu_entity === "sensor.mein_server_cpu"; await p.waitForTimeout(200); } return false; })();
    check(`[${tag}] eigener Sensor: set_options mit status_cpu_entity, danach neue Abfrage der Werte`, sawBoth);
    check(`[${tag}] Karte ${T.cpu} nennt jetzt den eigenen Sensor`, await wait(`return r.querySelector('${card("cpu")} .st-sys-t small').textContent.trim() === "Prozessornutzung" && r.querySelector('${win} [data-st-pick="cpu"]').textContent.includes("Mein Server CPU")`));

    // Festplatte: nur "belegt" in Gigabyte (so liegt es bei dir): die Karte zeigt Gigabyte, nicht Prozent
    await tap(`${win} [data-st-pick="disk"]`);
    await ev(`const i = r.querySelector('${win} [data-st-pickq]'); i.value = "massenspeicher"; i.dispatchEvent(new Event("input", { bubbles: true }))`);
    check(`[${tag}] Festplatte: Suche "massenspeicher" findet den Sensor in GiB (belegter Massenspeicher)`, await wait(`const rows = [...r.querySelectorAll("${win} .st-pick-list .st-opt")]; return rows.length === 1 && rows[0].dataset.stChoose === "sensor.system_monitor_belegter_massenspeicher"`));
    await tap(`${win} .st-pick-list .st-opt`);
    check(`[${tag}] Festplatte in Gigabyte: Wert "318,4 GiB" statt Prozent, Achse bis 500, Ø und Spitze in GiB`, await wait(`const c = r.querySelector('${card("disk")}'); const n = (v) => v.toLocaleString(r.host._locale?.() || undefined, { maximumFractionDigits: 1 }); return c.querySelector(".st-sys-val").textContent.replace(/\\s/g, "") === n(318.4) + "GiB" && [...c.querySelectorAll(".st-sys-y")].map((x) => x.textContent).join("|") === [n(500), n(250), "0"].join("|") && /GiB.*GiB/.test(c.querySelector(".st-sys-foot .mid").textContent) && !c.querySelector("[data-st-size]")`));
    check(`[${tag}] fehlt "frei": Hinweis mit dem Namen des ausgeschalteten Sensors und Knopf "Sensoren einschalten"`, await ev(`const c = r.querySelector('${card("disk")}'); return c.textContent.includes("Freier Massenspeicher") && !!c.querySelector("[data-st-enable-ask]")`));
    await p.evaluate(() => { window.__wsCalls = []; });
    // Rückfrage: nennt die Sensoren mit Entität und was geschieht; "Abbrechen" ändert nichts
    await tap(`${card("disk")} [data-st-enable-ask]`);
    check(`[${tag}] Knopf fragt zuerst: Liste der Sensoren (Name und sensor.…), Hinweis was geschieht und wie man es rückgängig macht`, await wait(`const c = r.querySelector('${card("disk")} [data-st-enable-confirm]'); return !!c && c.querySelectorAll("li").length >= 1 && /sensor\\./.test(c.textContent) && c.textContent.includes(${JSON.stringify(T.undo)})`) && (await calls("device_panel/status_system_enable")).length === 0);
    await tap(`${card("disk")} [data-st-enable-no]`);
    check(`[${tag}] Abbrechen: nichts geschickt, Knopf wieder da`, await wait(`return !r.querySelector('${card("disk")} [data-st-enable-confirm]') && !!r.querySelector('${card("disk")} [data-st-enable-ask]')`) && (await calls("device_panel/status_system_enable")).length === 0);
    await tap(`${card("disk")} [data-st-enable-ask]`);
    await tap(`${card("disk")} [data-st-enable]`);
    check(`[${tag}] Knopf: status_system_enable mit kind disk, danach Hinweis "Home Assistant lädt die Integration neu"`, await wait(`return r.querySelector('${card("disk")} .st-sys-note.ok')?.textContent.includes(${JSON.stringify(T.enabled)})`) && (await calls("device_panel/status_system_enable")).some((m) => m.kind === "disk"));
    // zurück auf automatisch (Festplatte, CPU, RAM) für den Rest
    for (const k of ["disk", "cpu", "ram"]) { await tap(`${win} [data-st-pick="${k}"]`); await tap(`${win} .st-pick-list .st-opt`); await p.waitForTimeout(250); }

    // Sensoren ausgeschaltet gefunden: Hinweis mit Namen und Knopf zum Einschalten
    await p.evaluate(() => { window.__systemOff = true; window.__wsCalls = []; });
    await ev(`r.host._status.loadSystem()`);
    check(`[${tag}] Sensoren nur ausgeschaltet: jede Karte nennt sie und hat den Knopf "${T.enable}"`, await wait(`const c = [...r.querySelectorAll("${win} .st-sys")]; return c.length === 3 && c.every((x) => x.querySelector("[data-st-enable-ask]")?.textContent.trim() === ${JSON.stringify(T.enable)} && x.textContent.includes("System Monitor"))`));
    await tap(`${card("cpu")} [data-st-enable-ask]`);
    await tap(`${card("cpu")} [data-st-enable]`);
    check(`[${tag}] Einschalten: status_system_enable mit kind cpu, der Hinweis "${T.enabled}" folgt`, await wait(`return r.querySelector('${card("cpu")} .st-sys-note.ok')?.textContent.includes(${JSON.stringify(T.enabled)})`) && (await calls("device_panel/status_system_enable")).some((m) => m.kind === "cpu"));
    await p.evaluate(() => { window.__systemOff = false; });

    // Nichts gefunden: Hinweis statt Kurve
    await p.evaluate(() => { window.__systemNone = true; });
    await ev(`r.host._status.loadSystem()`);
    check(`[${tag}] ohne Sensor: Hinweis "${T.none}" auf jeder Karte, keine Kurve`, await wait(`const c = [...r.querySelectorAll("${win} .st-sys")]; return c.length === 3 && c.every((x) => x.querySelector(".st-sys-note")?.textContent.includes(${JSON.stringify(T.none)}) && !x.querySelector(".st-sys-plot"))`));
    // "System Monitor" nicht eingerichtet: Hinweis, dass es nicht zwingend ist, und Knopf zur Seite "Integration hinzufügen"
    await p.evaluate(() => { window.__systemNoInteg = true; });
    await ev(`r.host._status.loadSystem()`);
    check(`[${tag}] "System Monitor" nicht eingerichtet: Hinweis "nicht zwingend" und Knopf "${T.add}"`, await wait(`const c = r.querySelector('${card("disk")}'); return /${T.optional}/.test(c.textContent) && c.querySelector("[data-st-add]")?.textContent.trim() === ${JSON.stringify(T.add)}`));
    await tap(`${card("disk")} [data-st-add]`);
    check(`[${tag}] Knopf öffnet in Home Assistant die Seite "Integration hinzufügen" für System Monitor (Fenster schliesst)`, await wait(`return !r.querySelector("${win}").open`) && (await p.evaluate(() => location.pathname + location.search)) === "/config/integrations/dashboard/add?domain=systemmonitor");
    await p.evaluate(() => { window.__systemNone = false; window.__systemNoInteg = false; });
    await ev(`r.host._status.open()`);
    await wait(`return r.querySelectorAll("${win} .st-sys").length === 3 && r.querySelector('${card("cpu")} .st-sys-plot')`);

    // Eben eingeschaltet, Integration lädt noch neu: kein Fehler, sondern ein ruhiger Hinweis
    await p.evaluate(() => { window.__systemPending = true; });
    await ev(`r.host._status.loadSystem()`);
    check(`[${tag}] Sensor eben eingeschaltet: Hinweis "${T.pending}" statt "existiert nicht mehr"`, await wait(`const c = r.querySelector('${card("disk")}'); return c.querySelector(".st-sys-note")?.textContent.includes(${JSON.stringify(T.pending)}) && !c.querySelector(".st-sys-note.warn")`));
    await p.evaluate(() => { window.__systemPending = false; });
    await ev(`r.host._status.loadSystem()`);

    // Fehler beim Lesen: Meldung, die Karten bleiben
    await p.evaluate(() => { window.__systemFails = "boom"; });
    await ev(`r.host._status.loadSystem()`);
    check(`[${tag}] Fehler beim Lesen: Meldung "boom"`, await wait(`return !!r.querySelector("${win} .dlg-error") && r.querySelector("${win} .dlg-error").textContent.includes("boom") && r.querySelectorAll("${win} .st-sys").length === 3`));
    await p.evaluate(() => { window.__systemFails = null; });
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
