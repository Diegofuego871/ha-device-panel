// Thread (2.230.0, docs/mockups/thread-v1, Variante A): Rolle im Thread-Netz als zweite Zeile unter der Verbindungsart ("Thread"), "Verbunden über"
// mit dem Router, im Fenster "Empfang" bei einem Endgerät die Karte "Verbunden über" (Router mit Anteil, Wechsel) und bei einem Router die Karte
// "Nachbarn" (jetziger Stand, ohne Anteil). Der Simulator liefert die Thread-Daten mit ?thread=1. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { sleepy: "Schlafendes Endgerät", router: "Router", via: "Verbunden über", neighbours: "Nachbarn", used: "zählt", child: "hängt an diesem Gerät", now: "gerade -64 dBm · LQI 3", end: "Endgerät", strongest: "Stärkster Nachbar", nbOf: "Nachbar", colVia: "Verbunden über" },
  en: { sleepy: "Sleepy end device", router: "Router", via: "Connected via", neighbours: "Neighbours", used: "counts", child: "attached to this device", now: "now -64 dBm · LQI 3", end: "End device", strongest: "Strongest neighbour", nbOf: "neighbour", colVia: "Connected via" },
};

for (const lang of ["de", "en"]) {
  const L = T[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark&thread=1`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => {
      for (let i = 0; ; i++) {
        const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel);
        try { await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); return; }
        catch (e) { if (i >= 3 || !/not attached|not stable|intercepts/.test(e.message)) throw e; await new Promise((r) => setTimeout(r, 200)); }
      }
    };
    const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const shot = async (name) => { await p.waitForTimeout(700); return p.screenshot({ path: `${outDir}/thread-${name}-${tag.replace("/", "-")}.png` }); };
    const tiles = () => ev(`return [...r.querySelectorAll("dialog.device .tile")].map(t=>[t.querySelector(".tile-k").textContent.trim(), t.querySelector(".tile-v").textContent.replace(/\\s+/g," ").trim()])`);
    const closeAll = async () => {
      if (await ev(`return r.querySelector("dialog.stat-dlg").open`)) await tap('dialog.stat-dlg [data-stat="close"]');
      if (await ev(`return r.querySelector("dialog.device").open`)) await tap('dialog.device [data-dlg="close"]');
    };
    const openDevice = async (id) => {
      await closeAll();
      await tap(`.dev[data-open="${id}"]`);
      await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device .st-tile[data-kind="signal"]')`);
    };
    const openSignal = async () => {
      await tap('dialog.device .st-tile[data-kind="signal"]');
      return wait(`return r.querySelector("dialog.stat-dlg")?.open && !!r.querySelector("dialog.stat-dlg .sv")`);
    };

    // --- Türschloss: schlafendes Endgerät, hängt an einem Router
    await openDevice("i");
    const conn = (await tiles()).find(([k]) => /Verbindungsart|Connection type/.test(k));
    check(`[${tag}] Verbindungsart "Thread"-Kachel`, conn && /Matter|Thread/.test(conn[1]), JSON.stringify(conn));
    check(`[${tag}] Rolle als zweite Zeile unter der Verbindungsart: ${L.sleepy}`, (await text("dialog.device .tile .thr-role")) === L.sleepy, await text("dialog.device .tile .thr-role"));
    check(`[${tag}] Rolle mit Symbol`, (await ev(`return !!r.querySelector("dialog.device .thr-role svg")`)));
    check(`[${tag}] keine eigene Kachel "Thread-Rolle" mehr`, !(await tiles()).some(([k]) => /Thread-Rolle|Thread role/.test(k)), JSON.stringify((await tiles()).map(([k]) => k)));
    const via = (await tiles()).find(([k]) => k === L.via);
    check(`[${tag}] "${L.via}": Steckdose Küche`, via && via[1] === "Steckdose Küche", JSON.stringify(via));
    // Der Router ist ein Gerät, das das Panel zeigt (im Simulator "k"): die Kachel ist ein Knopf mit rundem Pfeil und führt dorthin
    check(`[${tag}] Kachel "${L.via}" ist ein Link mit Pfeil-Knopf`, await ev(`const t=r.querySelector('dialog.device button.tile-link[data-dlg="open-via"]'); return !!t && !!t.querySelector(".cbtn") && t.dataset.id==="k"`));
    await shot("popup");
    await tap('dialog.device button.tile-link[data-dlg="open-via"]');
    check(`[${tag}] Tipp öffnet das Gerät des Routers`, await wait(`return r.querySelector("dialog.device")?.open && r.host._detailId === "k" && r.querySelector("dialog.device .dlg-title h2, dialog.device h2")?.textContent.includes("Steckdose Kaffeemaschine")`));
    check(`[${tag}] das neue Popup hat keine Link-Kachel (kein Thread-Gerät)`, await ev(`return !r.querySelector("dialog.device button.tile-link")`));
    await openDevice("i");

    // --- Fenster "Empfang": Karte "Verbunden über"
    check(`[${tag}] Fenster Empfang öffnet`, await openSignal());
    check(`[${tag}] Karte heisst "${L.via}"`, (await text("dialog.stat-dlg .sv h3")) === L.via, await text("dialog.stat-dlg .sv h3"));
    check(`[${tag}] Balken und Wechsel wie bei Bluetooth`, (await ev(`return !!r.querySelector("dialog.stat-dlg .sv-bar") && r.querySelectorAll("dialog.stat-dlg .sv-chg p").length > 0`)));
    const rowText = await text("dialog.stat-dlg .sv-row");
    check(`[${tag}] erste Zeile: Name, "${L.used}", Router mit RSSI und LQI`, rowText.includes("Steckdose Küche") && rowText.includes(`✓ ${L.used}`) && rowText.includes(`${L.router} · ${L.now}`), rowText);
    check(`[${tag}] mit Anteil in Prozent`, (await ev(`return !!r.querySelector("dialog.stat-dlg .sv-row .sv-sh b")`)));
    check(`[${tag}] Hinweis zur Thread-Quelle`, /Matter/.test(await text("dialog.stat-dlg .sg-info, dialog.stat-dlg .dlg-note")) || (await ev(`return r.querySelectorAll("dialog.stat-dlg .bh-src").length`)) > 0);
    await shot("parent");
    await tap('dialog.stat-dlg [data-stat="close"]');

    // --- Bluetooth (2.232.0): gleicher Link, wenn der Proxy ein Gerät des Panels ist (Simulator: Gerät "a", Proxy "k")
    await closeAll();
    await openDevice("a");
    check(`[${tag}] Bluetooth: Kachel "${L.via}" mit dem Namen des Proxys ist ein Link mit Pfeil-Knopf`, await ev(`const t=r.querySelector('dialog.device button.tile-link[data-dlg="open-via"]'); return !!t && !!t.querySelector(".cbtn") && t.dataset.id==="k" && t.textContent.includes("Proxy Garage")`));
    await tap('dialog.device button.tile-link[data-dlg="open-via"]');
    check(`[${tag}] Bluetooth: Tipp öffnet das Gerät des Proxys`, await wait(`return r.querySelector("dialog.device")?.open && r.host._detailId === "k"`));

    // --- Liste: ein Thread-Router zeigt seinen stärksten Nachbarn, wo andere Geräte ihr "Verbunden über" haben (2.234.0)
    await closeAll();
    const listRow = await ev(`const el=r.querySelector('${mobile ? ".mc" : "tr"}[data-open="c"]'); return (el?.textContent||"").replace(/\\s+/g," ")`);
    // Die Tabelle zeigt es; die Karten am Handy zeigen kein "über …" (auch bei anderen Geräten nicht)
    if (!mobile) check(`[${tag}] Liste: Router "Thermostat Bad" nennt den Nachbarn (${L.nbOf})`, listRow.includes(`${L.nbOf} Steckdose Kaffeemaschine`), listRow.slice(0, 160));
    const colHead = await ev(`return r.host._t("colVia")`);
    check(`[${tag}] Spalte heisst "${L.colVia}"`, colHead === L.colVia, colHead);

    // --- Thermostat: Router mit Nachbarn
    await closeAll();
    await openDevice("c");
    check(`[${tag}] Router: Rolle ${L.router}`, (await text("dialog.device .tile .thr-role")) === L.router, await text("dialog.device .tile .thr-role"));
    check(`[${tag}] Router: kein "${L.via}" (er hängt an keinem Router)`, !(await tiles()).some(([k]) => k === L.via));
    // Ein Router hat keinen Elternteil: die Kachel heisst "Stärkster Nachbar" und verlinkt, wenn der Nachbar ein Gerät des Panels ist
    const strongest = (await tiles()).find(([k]) => k === L.strongest);
    check(`[${tag}] Router: Kachel "${L.strongest}": Steckdose Kaffeemaschine`, strongest && strongest[1] === "Steckdose Kaffeemaschine", JSON.stringify(strongest));
    check(`[${tag}] Router: Kachel "${L.strongest}" ist ein Link mit Pfeil-Knopf`, await ev(`const t=r.querySelector('dialog.device button.tile-link[data-dlg="open-via"]'); return !!t && !!t.querySelector(".cbtn") && t.dataset.id==="k"`));
    check(`[${tag}] Fenster Empfang (Router) öffnet`, await openSignal());
    check(`[${tag}] Karte heisst "${L.neighbours}"`, (await text("dialog.stat-dlg .sv h3")) === L.neighbours, await text("dialog.stat-dlg .sv h3"));
    check(`[${tag}] vier Nachbarn`, (await ev(`return r.querySelectorAll("dialog.stat-dlg .sv-row").length`)) === 4);
    check(`[${tag}] ohne Balken, ohne Anteil, ohne Wechsel`, (await ev(`return !r.querySelector("dialog.stat-dlg .sv-bar") && !r.querySelector("dialog.stat-dlg .sv-row .sv-sh") && !r.querySelector("dialog.stat-dlg .sv-chg")`)));
    const rows = await ev(`return [...r.querySelectorAll("dialog.stat-dlg .sv-row")].map(x=>x.textContent.replace(/\\s+/g," ").trim())`);
    check(`[${tag}] der stärkste zuerst und "${L.used}"`, rows[0].includes("Google Nest Hub") && rows[0].includes(`✓ ${L.used}`) && rows.slice(1).every((x) => !x.includes("✓")), rows[0]);
    check(`[${tag}] angehängtes Gerät: "${L.sleepy} · ${L.child}"`, rows[1].includes("Türschloss Haustür") && rows[1].includes(`${L.sleepy} · ${L.child} · ${L.now}`), rows[1]);
    check(`[${tag}] unbekannter Router: "Router …A1B2"`, rows[3].includes("Router …A1B2"), rows[3]);
    await shot("neighbours");
    check(`[${tag}] kein Überlauf`, (await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)));
    await closeAll();
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
