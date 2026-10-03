// Neue Geräte (0.21.0): die ersten 3 Tage nach dem Anlegen in HA markiert
// ("Neu" beim Namen mit Datum im Tooltip), Chip "Neu" als Filter, Kachel
// "Hinzugefügt" im Popup. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { chip: "Neu", tag: "Neu", tip: "Neu: in Home Assistant hinzugefügt ", added: "Hinzugefügt" },
  en: { chip: "New", tag: "New", tip: "New: added to Home Assistant ", added: "Added" },
};

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
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);

    const tagged = await ev(`return [...r.querySelectorAll(".dev")].filter(x=>x.querySelector(".new-tag")).map(x=>x.dataset.open).sort().join()`);
    check(`[${tag}] "Neu" nur bei neuen Geräten`, tagged === "k,o", tagged);
    const t = await ev(`const e=r.querySelector('.dev[data-open="k"] .new-tag'); return [e.textContent, e.title]`);
    check(`[${tag}] Text und Tooltip mit Datum`, t[0] === T.tag && t[1].startsWith(T.tip) && t[1].length > T.tip.length, JSON.stringify(t));
    check(`[${tag}] Chip "Neu" mit Zahl`, (await text('.chip.hint[data-hint="new"] span:not(.n)')) === T.chip && (await text('.chip.hint[data-hint="new"] .n')) === "2");
    await tap('.chip.hint[data-hint="new"]');
    const shown = await ev(`return [...r.querySelectorAll(".dev")].map(x=>x.dataset.open).sort().join()`);
    check(`[${tag}] Filter zeigt nur neue`, shown === "k,o", shown);
    if (mobile) await ev(`r.querySelector(".content").scrollTop = r.querySelector(".chips").offsetTop - 80`);
    await p.screenshot({ path: `${outDir}/new-${tag.replace("/", "-")}.png` });
    await tap('.chip.hint[data-hint="new"]');
    check(`[${tag}] zweiter Tipp hebt auf`, await wait(`return r.querySelectorAll(".dev").length > 2`));
    // Popup: Kachel "Hinzugefügt"
    await tap('.dev[data-open="k"]');
    await wait(`return r.querySelector("dialog.device")?.open`);
    const tile = await ev(`const t=[...r.querySelectorAll("dialog.device .tile")].find(x=>x.querySelector(".tile-k")?.textContent.trim()===${JSON.stringify(T.added)}); return t ? t.querySelector(".tile-v").textContent.trim() : ""`);
    check(`[${tag}] Kachel "${T.added}" mit Datum und Neu`, tile.length > 4 && tile.endsWith(T.tag), tile);
    await tap('dialog.device [data-dlg="close"]');
    await tap('.dev[data-open="g"]');
    await wait(`return r.querySelector("dialog.device")?.open`);
    const old = await ev(`const t=[...r.querySelectorAll("dialog.device .tile")].find(x=>x.querySelector(".tile-k")?.textContent.trim()===${JSON.stringify(T.added)}); return t ? t.querySelector(".tile-v").textContent.trim() : ""`);
    check(`[${tag}] ältere Geräte: Datum ohne Neu`, old.length > 4 && !old.endsWith(T.tag), old);
    // Genaues Datum mit Jahr (seit 0.28.0, Wunsch des Nutzers)
    const year = await ev(`return String(new Date(r.host._devices.find(d=>d.id==="g").created_at).getFullYear())`);
    check(`[${tag}] Kachel "${T.added}" zeigt das Jahr ${year}`, old.includes(year) && tile.includes(String(new Date().getFullYear())), `${old} | ${tile}`);

    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
