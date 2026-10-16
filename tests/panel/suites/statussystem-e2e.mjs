// Status-App, Abschnitt "System" (2.68.0): CPU und Arbeitsspeicher als Kurve über 24 Std., die Festplatte mit Zeitraum (24 Std., 30 Tage,
// 6 Monate, 1 Jahr); Quelle der Werte automatisch oder eigener Sensor; ohne Sensor ein Hinweis. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { title: "System", cpu: "Prozessor (CPU)", ram: "Arbeitsspeicher (RAM)", disk: "Festplatte", host: "Host", ago24: "vor 24 Std.", ago30: "vor 30 Tagen", ago6: "vor 6 Monaten", ago1y: "vor 1 Jahr", now: "jetzt", r: ["24 Std.", "30 Tage", "6 Monate", "1 Jahr"], noStats: "keine Langzeitstatistik", none: "Kein Sensor gefunden", src: "Quelle der Werte", auto: "Automatisch (Prozessornutzung)", size: "{u} von {t} GiB belegt · {f} GiB frei", sizeHint: "Belegter Massenspeicher" },
  en: { title: "System", cpu: "Processor (CPU)", ram: "Memory (RAM)", disk: "Disk", host: "Host", ago24: "24 h ago", ago30: "30 days ago", ago6: "6 months ago", ago1y: "1 year ago", now: "now", r: ["24 h", "30 days", "6 months", "1 year"], noStats: "no long-term statistics", none: "No sensor found", src: "Source of the values", auto: "Automatic (Prozessornutzung)", size: "{u} of {t} GiB used · {f} GiB free", sizeHint: "Disk use" },
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
    check(`[${tag}] Karte ${T.cpu}: Wert 17 %, "${T.host}", Kurve, "${T.ago24}" bis "${T.now}", Ø und Spitze`, await ev(`const c = r.querySelector('${card("cpu")}'); return c.querySelector(".st-sys-val").textContent.replace(/\\s/g, "") === "17%" && c.querySelector(".st-sys-t small").textContent.trim() === ${JSON.stringify(T.host)} && !!c.querySelector(".st-sys-plot path.bh-line") && c.querySelector(".st-sys-foot").textContent.includes(${JSON.stringify(T.ago24)}) && c.querySelector(".st-sys-foot").textContent.includes(${JSON.stringify(T.now)}) && /\\d+ % · .*\\d+ %/.test(c.querySelector(".st-sys-foot .mid").textContent)`));
    check(`[${tag}] CPU und RAM ohne Zeitraumleiste, die Festplatte mit vier Knöpfen und gleitender Kapsel`, await wait(`const d = r.querySelector("${win}"); return !d.querySelector('${card("cpu")} .sub-tabs') && !d.querySelector('${card("ram")} .sub-tabs') && JSON.stringify([...d.querySelectorAll('${card("disk")} .sub-tab')].map((x) => x.textContent.trim())) === ${JSON.stringify(JSON.stringify(T.r))} && !!d.querySelector('${card("disk")} .sub-tabs > .seg-pill')`));
    // Festplatte in Gigabyte: "318,4 von 530,7 GiB belegt · 212,3 GiB frei" (Zahlenformat der HA-Sprache), nur bei der Festplatte
    check(`[${tag}] Festplatte zeigt Prozent und Grösse: ${T.size}`, await ev(`const t = r.querySelector('${card("disk")} [data-st-size]')?.textContent.trim(); const n = (v) => v.toLocaleString(r.host._locale?.() || undefined, { maximumFractionDigits: 1 }); return t === ${JSON.stringify(T.size)}.replace("{u}", n(318.4)).replace("{t}", n(530.7)).replace("{f}", n(212.3)) && r.querySelector('${card("disk")} .st-sys-val').textContent.replace(/\\s/g, "") === "60%" && !r.querySelector('${card("cpu")} [data-st-size]') && !r.querySelector('${card("ram")} [data-st-size]')`));
    await p.evaluate(() => { window.__systemNoSize = true; });
    await ev(`r.host._status.loadSystem()`);
    check(`[${tag}] ohne Grössen-Sensoren: nur Prozent, Hinweis auf die Sensoren von System Monitor`, await wait(`const c = r.querySelector('${card("disk")}'); return !c.querySelector("[data-st-size]") && c.querySelector(".st-sys-note")?.textContent.includes(${JSON.stringify(T.sizeHint)}) && c.querySelector(".st-sys-val").textContent.replace(/\\s/g, "") === "60%"`));
    await p.evaluate(() => { window.__systemNoSize = false; });
    await ev(`r.host._status.loadSystem()`);
    await wait(`return !!r.querySelector('${card("disk")} [data-st-size]')`);
    await ev(`r.querySelector('${win} .st-sys').scrollIntoView({ block: "start" })`);
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${outDir}/statussystem-${tag.replace("/", "-")}-0.png` });

    // Zeitraum der Festplatte: nur sie wechselt, CPU bleibt bei 24 Std.
    await p.evaluate(() => { window.__wsCalls = []; });
    await tap(`${card("disk")} [data-st-range="30d"]`);
    check(`[${tag}] "30 Tage": status_system mit range 30d, Festplatte "${T.ago30}", CPU weiter "${T.ago24}", Knopf gewählt`, await wait(`const d = r.querySelector("${win}"); return d.querySelector('${card("disk")} .st-sys-foot').textContent.includes(${JSON.stringify(T.ago30)}) && d.querySelector('${card("cpu")} .st-sys-foot').textContent.includes(${JSON.stringify(T.ago24)}) && d.querySelector('${card("disk")} [data-st-range="30d"]').classList.contains("on")`) && (await calls("device_panel/status_system")).some((m) => m.range === "30d"));
    await tap(`${card("disk")} [data-st-range="1y"]`);
    check(`[${tag}] "1 Jahr": "${T.ago1y}", ohne Hinweis zur Statistik`, await wait(`const c = r.querySelector('${card("disk")}'); return c.querySelector(".st-sys-foot").textContent.includes(${JSON.stringify(T.ago1y)}) && !c.querySelector(".st-sys-note")`));
    // Ohne Langzeitstatistik (nur Verlauf): Hinweis bei langen Zeiträumen
    await p.evaluate(() => { window.__systemNoStats = true; });
    await tap(`${card("disk")} [data-st-range="6m"]`);
    check(`[${tag}] "6 Monate" ohne Langzeitstatistik: Hinweis "${T.noStats}"`, await wait(`const c = r.querySelector('${card("disk")}'); return c.querySelector(".st-sys-foot").textContent.includes(${JSON.stringify(T.ago6)}) && c.querySelector(".st-sys-note")?.textContent.includes(${JSON.stringify(T.noStats)})`));
    await p.evaluate(() => { window.__systemNoStats = false; });
    await tap(`${card("disk")} [data-st-range="24h"]`);
    check(`[${tag}] zurück auf "24 Std.": "${T.ago24}", kein Hinweis`, await wait(`const c = r.querySelector('${card("disk")}'); return c.querySelector(".st-sys-foot").textContent.includes(${JSON.stringify(T.ago24)}) && !c.querySelector(".st-sys-note")`));

    // Quelle: automatisch, eigener Sensor wählen
    check(`[${tag}] "${T.src}": drei Auswahllisten, Voreinstellung "${T.auto}"`, await ev(`const s = [...r.querySelectorAll('${win} select[data-st-metric]')]; return s.length === 3 && s[0].selectedOptions[0].textContent.trim() === ${JSON.stringify(T.auto)} && s[0].options.length === 3`));
    await p.evaluate(() => { window.__wsCalls = []; });
    await ev(`const s = r.querySelector('${win} select[data-st-metric="cpu"]'); s.value = "sensor.mein_server_cpu"; s.dispatchEvent(new Event("change", { bubbles: true }))`);
    const sawBoth = await (async () => { for (let i = 0; i < 25; i++) { const o = (await calls("device_panel/set_options")).at(-1); if (o && (await calls("device_panel/status_system")).length > 0) return o.values.status_cpu_entity === "sensor.mein_server_cpu"; await p.waitForTimeout(200); } return false; })();
    check(`[${tag}] eigener Sensor: set_options mit status_cpu_entity, danach neue Abfrage der Werte`, sawBoth);
    check(`[${tag}] Karte ${T.cpu} nennt jetzt den eigenen Sensor`, await wait(`return r.querySelector('${card("cpu")} .st-sys-t small').textContent.trim() === "Prozessornutzung" && r.querySelector('${win} select[data-st-metric="cpu"]').value === "sensor.mein_server_cpu"`));

    // Nichts gefunden: Hinweis statt Kurve
    await p.evaluate(() => { window.__systemNone = true; });
    await ev(`r.host._status.loadSystem()`);
    check(`[${tag}] ohne Sensor: Hinweis "${T.none}" auf jeder Karte, keine Kurve`, await wait(`const c = [...r.querySelectorAll("${win} .st-sys")]; return c.length === 3 && c.every((x) => x.querySelector(".st-sys-note")?.textContent.includes(${JSON.stringify(T.none)}) && !x.querySelector(".st-sys-plot"))`));
    await p.evaluate(() => { window.__systemNone = false; });

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
