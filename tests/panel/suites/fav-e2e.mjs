// Favoriten (2.22.0, Wunsch des Nutzers): Herz im Kopf des Geräte-Popups und ein Chip, der nur ein rotes Herz zeigt
// (ohne Text und Zahl), standardmässig gleich nach "Alle", nicht angeheftet, in den Einstellungen ausblendbar.
// Die Favoriten gehören dem Benutzer (frontend/set_user_data). Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { chip: "Favoriten", add: "Als Favorit markieren", remove: "Favorit entfernen", chipsTitle: "Filter-Chips" },
  en: { chip: "Favorites", add: "Mark as favorite", remove: "Remove from favorites", chipsTitle: "Filter chips" },
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
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const chipKeys = () => ev(`return [...r.querySelectorAll(".chips > *, .chips .chip-pin > *")].map(x => x.dataset?.hint || x.dataset?.conn || "").filter(Boolean)`);
    const total = await ev(`return r.querySelectorAll(".dev").length`);

    // Chip: gleich nach "Alle", nur Herz, nicht angeheftet
    const order = await ev(`return [...r.querySelectorAll(".chips .chip")].map(x => x.dataset.conn || x.dataset.hint || "x")`);
    check(`[${tag}] Chip "Favoriten" steht als zweiter, gleich nach "Alle"`, order[0] === "all" && order[1] === "favorites", JSON.stringify(order));
    const chipInfo = await ev(`const c = r.querySelector('.chips [data-hint="favorites"]'); const s = getComputedStyle(c); return { text: c.textContent.trim(), label: c.getAttribute("aria-label"), w: Math.round(c.getBoundingClientRect().width), css: getComputedStyle(c).flexShrink, red: getComputedStyle(c.querySelector("svg")).color, pinned: !!c.closest(".chip-pin"), on: c.getAttribute("aria-pressed") }`);
    check(`[${tag}] nur ein Herz: kein Text, keine Zahl`, chipInfo.text === "" && chipInfo.label === T.chip, JSON.stringify(chipInfo));
    check(`[${tag}] schmal (40 bis 48 px, nicht gestaucht) und rot`, chipInfo.w >= 40 && chipInfo.w <= 48 && /rgb\(2[0-5]\d, \d+, \d+\)|rgb\(\d{3}, \d{2}, \d{2}\)/.test(chipInfo.red), JSON.stringify(chipInfo));
    check(`[${tag}] nicht festgepinnt, nur "Alle" ist es`, !chipInfo.pinned && (await ev(`return [...r.querySelectorAll(".chips .chip-pin .chip")].map(x => x.dataset.conn).join()`)) === "all");

    // Ohne Favoriten zeigt der Filter nichts
    await tap('.chips [data-hint="favorites"]');
    check(`[${tag}] Filter ohne Favoriten: keine Geräte`, await wait(`return r.querySelectorAll(".dev").length === 0`));
    await tap('.chips [data-hint="favorites"]');
    check(`[${tag}] zweites Tippen hebt den Filter auf`, await wait(`return r.querySelectorAll(".dev").length === ${total}`));

    // Herz im Popup
    await tap(mobile ? '.mc[data-open="b"]' : 'tr[data-open="b"]');
    check(`[${tag}] Popup: Herz neben dem Kreuz, leer`, await wait(`const h = r.querySelector('dialog.device .dlg-head .dlg-fav'); return !!h && !h.classList.contains("on") && h.getAttribute("aria-label") === ${JSON.stringify(T.add)} && h.nextElementSibling === r.querySelector("dialog.device .dlg-close")`));
    check(`[${tag}] Abstand Herz zum Kreuz 22 px (gleich wie Protokoll- und Blitz-Knopf)`, (await ev(`const a = r.querySelector("dialog.device .dlg-fav").getBoundingClientRect(), b = r.querySelector("dialog.device .dlg-close").getBoundingClientRect(); return Math.round(b.left - a.right)`)) === 22);
    await tap('dialog.device .dlg-fav');
    check(`[${tag}] Herz antippen: Favorit, Beschriftung wechselt`, await wait(`const h = r.querySelector('dialog.device .dlg-fav'); return h.classList.contains("on") && h.getAttribute("aria-pressed") === "true" && h.getAttribute("aria-label") === ${JSON.stringify(T.remove)}`));
    check(`[${tag}] Popup bleibt offen, nichts im Entwurf`, await ev(`return r.querySelector("dialog.device").open && !r.querySelector('dialog.device [data-dlg="save"]')`));
    // gespeichert als Benutzerdaten
    const saved = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "frontend/set_user_data" && m.key === "device_panel_favorites").at(-1)?.value);
    check(`[${tag}] gespeichert in den Benutzerdaten`, await wait(`return true`) && saved === undefined ? await (async () => { await new Promise((r) => setTimeout(r, 700)); return !!(await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "frontend/set_user_data" && m.key === "device_panel_favorites").at(-1)?.value?.ids?.includes("b"))); })() : !!saved?.ids?.includes("b"), JSON.stringify(saved));
    await tap('dialog.device [data-dlg="close"]');
    await wait(`return !r.querySelector("dialog.device").open`);

    // Filter zeigt genau das Favoriten-Gerät
    await tap('.chips [data-hint="favorites"]');
    check(`[${tag}] Filter "Favoriten": nur das markierte Gerät`, await wait(`return r.querySelectorAll(".dev").length === 1 && r.querySelector(".dev").dataset.open === "b"`));
    check(`[${tag}] Chip aktiv, immer noch ohne Text`, await ev(`const c = r.querySelector('.chips [data-hint="favorites"]'); return c.getAttribute("aria-pressed") === "true" && c.textContent.trim() === ""`));
    await p.screenshot({ path: `${outDir}/fav-${tag.replace("/", "-")}.png` });
    // "Alle" hebt ihn auf
    await tap('.chips [data-conn="all"]');
    check(`[${tag}] "Alle" hebt den Filter auf`, await wait(`return r.querySelectorAll(".dev").length === ${total}`));

    // Neu laden: Favorit bleibt (Benutzerdaten)
    await p.reload();
    const f2 = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f2.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    await f2.evaluate(new Function(`const r=${R}; r.querySelector('.chips [data-hint="favorites"]').click()`));
    check(`[${tag}] nach dem Neuladen noch Favorit`, await f2.waitForFunction(new Function(`const r=${R}; return r.querySelectorAll(".dev").length === 1`), null, { timeout: 5000 }).then(() => true, () => false));
    await f2.evaluate(new Function(`const r=${R}; r.querySelector('.chips [data-hint="favorites"]').click()`));

    // Herz wieder entfernen (Popup)
    await f2.evaluate(new Function(`const r=${R}; r.querySelector('${mobile ? '.mc[data-open="b"]' : 'tr[data-open="b"]'}').click()`));
    await f2.waitForFunction(new Function(`const r=${R}; return r.querySelector('dialog.device .dlg-fav.on')`), null, { timeout: 5000 });
    await f2.evaluate(new Function(`const r=${R}; r.querySelector('dialog.device .dlg-fav').click()`));
    check(`[${tag}] Herz erneut: kein Favorit mehr`, await f2.waitForFunction(new Function(`const r=${R}; return !r.querySelector('dialog.device .dlg-fav.on')`), null, { timeout: 5000 }).then(() => true, () => false));

    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
