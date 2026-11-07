// "Ladungen aufzeichnen" am Gerät (2.207.0): Auswahl automatisch / ein / aus im Reiter Laden (auch bei einem Gerät, das nicht als ladefähig gilt),
// Speichern (true / false / null), die Kachel "Ladungen" folgt der Wahl (ein: auch ohne Ladefähigkeit; aus: nie; automatisch: nur ladefähig).
// Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, savePending } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { tile: "Ladungen", opts: ["Automatisch: aus (nicht ladefähig)", "Ein", "Aus"], optsRech: "Automatisch: ein (ladefähig)", label: "Ladungen aufzeichnen", diff: "Ladungen aus" },
  en: { tile: "Charges", opts: ["Automatic: off (not rechargeable)", "On", "Off"], optsRech: "Automatic: on (rechargeable)", label: "Record charges", diff: "charges off" },
};
const now = Math.floor(Date.now() / 1000);
const CH = { start: now - 86400, end: now - 82000, minutes: 60, from: 20, to: 70, pts: [[0, 20], [1800, 45], [3600, 70]], watts: null, avg_w: null, peak_w: null };
for (const lang of ["de", "en"]) {
  const L = T[lang];
  for (const mobile of [false, true]) {
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
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
    const calls = async () => { await savePending(f, R); return p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_device_settings").map(({ type, id, ...rest }) => rest)); };
    const D = "dialog.device";
    const S = `${D} select[data-dlg="dev-charge-rec"]`;
    const tile = `${D} .st-tile[data-dlg="charges"]`;
    const opts = () => ev(`return [...r.querySelectorAll(${JSON.stringify(S + " option")})].map((o) => o.textContent.trim())`);
    const reopen = async () => {
      await ev(`r.host._fetch(true)`);
      await ev(`r.host._closeDevice?.()`);
      await ev(`r.host._openDevice("e")`);
      await wait(`return r.querySelector('${D} [data-tab="set"]')`);
    };

    // Gerät e: nicht ladefähig, eine aufgezeichnete Ladung (aus früherer Zeit)
    await p.evaluate((c) => { window.__rechargeable = []; window.__charges = { e: [c] }; }, CH);
    await ev(`r.host._fetch(true)`);
    await wait(`return r.host._devices.find((d) => d.id === "e")?.charges_count === 1`);
    await ev(`r.host._openDevice("e")`);
    await wait(`return r.querySelector('${D} .st-tiles')`);
    check(`[${tag}] automatisch, nicht ladefähig: keine Kachel "${L.tile}"`, !(await ev(`return !!r.querySelector(${JSON.stringify(tile)})`)));
    await tap(`${D} [data-tab="set"]`);
    await tap(`${D} [data-stab="chg"]`);
    check(`[${tag}] Auswahl "${L.label}" auch ohne Ladefähigkeit: ${L.opts.join(" / ")}`, (await wait(`return !!r.querySelector(${JSON.stringify(S)})`)) && JSON.stringify(await opts()) === JSON.stringify(L.opts), JSON.stringify(await opts()));

    // Ein: Kachel erscheint
    await (await handle(S)).selectOption("on");
    check(`[${tag}] "Ein": true gespeichert`, (await calls()).some((x) => x.charge_rec === true), JSON.stringify(await calls()));
    await tap(`${D} [data-tab="ov"]`);
    check(`[${tag}] "Ein": Kachel "${L.tile}" erscheint`, await wait(`return !!r.querySelector(${JSON.stringify(tile)})`));

    // Aus bei einem ladefähigen Gerät: keine Kachel
    await p.evaluate(() => { window.__rechargeable = ["e"]; });
    await tap(`${D} [data-tab="set"]`);
    await tap(`${D} [data-stab="chg"]`);
    await (await handle(S)).selectOption("off");
    check(`[${tag}] "Aus": false gespeichert`, (await calls()).some((x) => x.charge_rec === false));
    await reopen();
    check(`[${tag}] "Aus" bei ladefähigem Gerät: keine Kachel "${L.tile}"`, !(await wait(`return !!r.querySelector(${JSON.stringify(tile)})`, 1500)));

    // Automatisch: ladefähig, Kachel da; Text der Wahl nennt "ladefähig"
    await tap(`${D} [data-tab="set"]`);
    await tap(`${D} [data-stab="chg"]`);
    await (await handle(S)).selectOption("default");
    check(`[${tag}] "Automatisch": null gesendet`, (await calls()).some((x) => x.charge_rec === null));
    await reopen();
    check(`[${tag}] automatisch, ladefähig: Kachel "${L.tile}" da, Auswahl nennt "${L.optsRech}"`, (await wait(`return !!r.querySelector(${JSON.stringify(tile)})`)) && (await (async () => { await tap(`${D} [data-tab="set"]`); await tap(`${D} [data-stab="chg"]`); await wait(`return !!r.querySelector(${JSON.stringify(S)})`); return (await opts())[0] === L.optsRech; })()));
    check(`[${tag}] keine Fehler`, errors.length === 0, errors.join("|"));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
