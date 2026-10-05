// Reihenfolge aller Filter-Chips per Ziehen (1.13.0): Einstellungen,
// Abschnitt "Darstellung" › Reiter "Filter-Chips", Liste "Weitere Chips" mit
// Griff; "Verbindungsarten" ist ein fester Block. Die Leiste folgt der
// Reihenfolge, Trenner stehen nur um den Block, ausgeblendete Chips fehlen,
// die Standardfolge wird als leer gespeichert. Deutsch und Englisch, Desktop
// und Handy, echte Maus- und Touch-Ereignisse.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const DEFAULT = "area,integration,connections,problems,batteries,battery,signal,update,override,new";
const TEXT = {
  de: { one: "1 Änderung", order: "Chips in eigener Reihenfolge", reset: "Standardreihenfolge", fixed: "Verbindungsarten" },
  en: { one: "1 change", order: "chips in own order", reset: "Default order", fixed: "Connection types" },
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
    const lastSet = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_options").at(-1)?.values);
    // Leiste als Folge: Chips mit Schlüssel, Verbindungs-Chips als "connections", Trenner als "|".
    const bar = () => ev(`const out = []; for (const c of r.querySelectorAll(".chips > *")) {
      const k = c.classList.contains("vsep") ? "|" : c.dataset.hint || (c.hasAttribute("data-problems") ? "problems" : c.classList.contains("integ") ? "integration" : c.classList.contains("area") ? "area" : c.dataset.conn ? "connections" : "?");
      if (out.at(-1) !== k) out.push(k);
    } return out.join()`);
    const rowOrder = () => ev(`return [...r.querySelectorAll('.drag-list[data-drag-list="chip_order"] [data-set="drag"]')].map(b=>b.dataset.key).join()`);
    const sel = (key) => `.drag-list[data-drag-list="chip_order"] [data-key="${key}"]`;
    const openChips = async () => {
      await tap(".gear-btn");
      await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
      await tap('[data-set="section"][data-id="look"]');
      await tap('[data-set="subtab"][data-key="chips"]');
      await wait(`return !!r.querySelector('.drag-list[data-drag-list="chip_order"]')`);
    };
    const save = async () => {
      await tap('dialog.settings [data-set="save"]');
      if (!(await wait(`return r.querySelector("dialog.settings").open && r.querySelector(".set-count")?.classList.contains("saved")`))) return false;
      await tap('dialog.settings .dlg-actions [data-set="close"]');
      return wait(`return !r.querySelector("dialog.settings").open`);
    };
    const center = async (s) => {
      const box = await f.evaluate(new Function(`const b=${R}.querySelector(${JSON.stringify(s)}).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }`));
      const fr = await (await p.$("#panel-frame")).boundingBox();
      return { x: box.x + fr.x, y: box.y + fr.y };
    };
    const drag = async (fromSel, toSel) => {
      await ev(`r.querySelector('.drag-list[data-drag-list="chip_order"]').scrollIntoView({ block: "center" })`);
      await p.waitForTimeout(200);
      const a = await center(fromSel);
      const bEnd = await center(toSel);
      const to = { x: bEnd.x, y: bEnd.y - 12 };
      if (!mobile) {
        await p.mouse.move(a.x, a.y);
        await p.mouse.down();
        for (let i = 1; i <= 8; i++) await p.mouse.move(a.x, a.y + ((to.y - a.y) * i) / 8);
        await p.mouse.up();
      } else {
        const cdp = await ctx.newCDPSession(p);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y }] });
        for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a.x, y: a.y + ((to.y - a.y) * i) / 8 }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await cdp.detach();
        await p.waitForTimeout(1500);
      }
      await p.waitForTimeout(500);
    };

    const start = await bar();
    check(`[${tag}] Leiste wie bisher`, /^area,integration,\|,connections,\|,problems,/.test(start), start);
    await openChips();
    check(`[${tag}] Liste in Standardfolge, Block als Zeile`, (await rowOrder()) === DEFAULT, await rowOrder());
    check(`[${tag}] Block "${T.fixed}": Schalter fest an`, await ev(`const i=r.querySelector(${JSON.stringify(sel("connections"))}).closest(".ex-row").querySelector("input[type=checkbox]"); return i.checked && i.disabled`));
    check(`[${tag}] kein Zurücksetzen in der Standardfolge`, !(await ev(`return !!r.querySelector('[data-set="drag-reset"][data-key="chip_order"]')`)));

    // Batterie ganz nach oben ziehen
    await drag(sel("batteries"), sel("area"));
    const moved = "batteries,area,integration,connections,problems,battery,signal,update,override,new";
    check(`[${tag}] Batterie nach oben gezogen`, await wait(`return [...r.querySelectorAll('.drag-list[data-drag-list="chip_order"] [data-set="drag"]')].map(b=>b.dataset.key).join() === ${JSON.stringify(moved)}`), await rowOrder());
    check(`[${tag}] als Änderung, Zusammenfassung`, (await text(".set-count")) === T.one && (await text('[data-id="look"] .set-sec-sum')).endsWith(T.order), `${await text(".set-count")} / ${await text('[data-id="look"] .set-sec-sum')}`);
    check(`[${tag}] Knopf "${T.reset}" erscheint`, (await text('[data-set="drag-reset"][data-key="chip_order"]')) === T.reset);
    if (!mobile) {
      // Pfeiltaste: "Neu" bleibt am Ende, "Update" eins nach unten
      await (await handle(sel("update"))).focus();
      await p.keyboard.press("ArrowDown");
      check(`[${tag}] Pfeiltaste verschiebt, Fokus bleibt`, (await wait(`return [...r.querySelectorAll('.drag-list[data-drag-list="chip_order"] [data-set="drag"]')].map(b=>b.dataset.key).join() === "batteries,area,integration,connections,problems,battery,signal,override,update,new"`)) && (await ev(`return r.activeElement?.dataset.key === "update"`)), await rowOrder());
      await p.keyboard.press("ArrowUp");
      await wait(`return [...r.querySelectorAll('.drag-list[data-drag-list="chip_order"] [data-set="drag"]')].map(b=>b.dataset.key).join() === ${JSON.stringify(moved)}`);
    }
    await ev(`r.querySelector('.drag-list[data-drag-list="chip_order"]').scrollIntoView({ block: "start" })`);
    await p.screenshot({ path: `${outDir}/chiporder-settings-${tag.replace("/", "-")}.png` });
    check(`[${tag}] gespeichert (volle Folge)`, (await save()) && JSON.stringify(await lastSet()) === JSON.stringify({ chip_order: moved.split(",") }), JSON.stringify(await lastSet()));
    const after = await bar();
    check(`[${tag}] Leiste: Batterie zuerst, Trenner nur um den Block`, /^batteries,area,integration,\|,connections,\|,problems,/.test(after) && !after.includes("|,batteries"), after);
    await p.screenshot({ path: `${outDir}/chiporder-bar-${tag.replace("/", "-")}.png` });

    // Block nach vorn, Batterie ausgeblendet: kein Trenner am Anfang, kein Rest vom ausgeblendeten Chip
    await openChips();
    await tap('input[data-list="hide_chips"][data-value="batteries"]');
    await drag(sel("connections"), sel("batteries"));
    check(`[${tag}] Block nach oben gezogen`, await wait(`return [...r.querySelectorAll('.drag-list[data-drag-list="chip_order"] [data-set="drag"]')].map(b=>b.dataset.key).join() === "connections,batteries,area,integration,problems,battery,signal,update,override,new"`), await rowOrder());
    const both = (await save()) && (await lastSet());
    check(`[${tag}] Folge und Ausblenden zusammen gespeichert`, both && both.hide_chips?.join() === "batteries" && both.chip_order?.join() === "connections,batteries,area,integration,problems,battery,signal,update,override,new", JSON.stringify(both));
    const front = await bar();
    check(`[${tag}] Leiste: Block zuerst, ohne Trenner am Anfang`, /^connections,\|,area,integration,problems,/.test(front) && !front.startsWith("|") && !front.includes("batteries"), front);

    // Zurücksetzen: Standardfolge, als leer gespeichert
    await openChips();
    await tap('input[data-list="hide_chips"][data-value="batteries"]');
    await tap('[data-set="drag-reset"][data-key="chip_order"]');
    check(`[${tag}] Standardreihenfolge`, (await rowOrder()) === DEFAULT && !(await ev(`return !!r.querySelector('[data-set="drag-reset"][data-key="chip_order"]')`)), await rowOrder());
    const reset = (await save()) && (await lastSet());
    check(`[${tag}] leer gespeichert`, reset && reset.chip_order?.length === 0 && reset.hide_chips?.length === 0, JSON.stringify(reset));
    check(`[${tag}] Leiste wieder wie bisher`, /^area,integration,\|,connections,\|,problems,/.test(await bar()), await bar());

    // Gespeicherte, unvollständige Folge wird in den Einstellungen ergänzt
    await p.evaluate(() => { window.__opts.chip_order = ["connections"]; });
    await openChips();
    check(`[${tag}] unvollständige Folge wird ergänzt`, (await rowOrder()) === "connections,area,integration,problems,batteries,battery,signal,update,override,new", await rowOrder());
    await tap('dialog.settings .dlg-actions [data-set="close"]');

    check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
