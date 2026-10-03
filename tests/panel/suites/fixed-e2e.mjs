// Kopf fixieren auf dem Handy (seit 0.28.0, docs/mockups/fixed-v1, C): Beim
// Scrollen schrumpfen die Kacheln zu einer Zeile (online, ausgefallen), Chips
// und Sortierung bleiben darunter stehen, nur die Liste scrollt. Tipp auf die
// Zeile scrollt zurück. Auf dem Desktop ändert sich nichts.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = { de: { of: "von 16 online", off: "4 ausgefallen", back: "Zurück zu den Kacheln", scope: "· Küche" }, en: { of: "of 16 online", off: "4 offline", back: "Back to the tiles", scope: "· Küche" } };

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [true, false]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 600 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=${mobile ? "dark" : "light"}`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const rect = (sel) => ev(`const e=r.querySelector(${JSON.stringify(sel)}); if(!e) return null; const b=e.getBoundingClientRect(); return {top: Math.round(b.top), bottom: Math.round(b.bottom), height: Math.round(b.height), visible: getComputedStyle(e).display !== "none" && b.height > 0}`);
    const top = () => ev(`return Math.round(r.querySelector(".content").getBoundingClientRect().top)`);
    const scrollTo = (y) => ev(`r.querySelector(".content").scrollTop = ${y}`);

    if (!mobile) {
      await scrollTo(400);
      check(`[${tag}] Desktop: keine Zeile, Chips scrollen mit`, !(await ev(`return getComputedStyle(r.querySelector(".hstrip")).display !== "none"`)) && (await ev(`return getComputedStyle(r.querySelector(".chips")).position`)) === "sticky");
      check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
      await ctx.close();
      continue;
    }

    const content0 = await top();
    // Oben: Kacheln sichtbar, keine Zeile
    check(`[${tag}] oben: Kacheln da, Zeile aus`, (await rect(".hero")).visible && !(await rect(".hs-in")).visible);
    // Scrollen: Kacheln weg, Zeile da
    await scrollTo(1000);
    check(`[${tag}] gescrollt: Zeile oben sichtbar`, await wait(`return getComputedStyle(r.querySelector(".hs-in")).display === "flex"`));
    const strip = await rect(".hs-in"), chips = await rect(".chips"), line = await rect(".viewline");
    check(`[${tag}] Zeile ganz oben (44 px)`, strip.top === content0 && strip.height === 44, JSON.stringify(strip));
    check(`[${tag}] Chips direkt darunter`, chips.top === strip.bottom && chips.height === 48, JSON.stringify(chips));
    check(`[${tag}] Sortierung direkt darunter`, line.top === chips.bottom, JSON.stringify([chips, line]));
    check(`[${tag}] Zeile zeigt online und ausgefallen`, JSON.stringify(await ev(`return [...r.querySelectorAll(".hs-in > b, .hs-in > span:not(.hs-up)")].map(x=>x.textContent.trim())`)) === JSON.stringify(["11", T.of, T.off]), await ev(`return r.querySelector(".hs-in").textContent`));
    check(`[${tag}] Liste läuft unter dem Kopf`, await ev(`const l=r.querySelector(".list .dev, .list .card, .list [data-open]"); const h=r.querySelector(".viewline").getBoundingClientRect().bottom; const rows=[...r.querySelectorAll(".list [data-open]")].map(x=>x.getBoundingClientRect()); return rows.some(x=>x.top < h && x.bottom > h) || rows.every(x=>x.bottom <= h || x.top >= h)`));
    await ev(`r.activeElement?.blur()`);
    await p.screenshot({ path: `${outDir}/fixed-${tag.replace("/", "-")}.png` });

    // Chips bedienbar unter der Zeile: Tipp auf einen Chip filtert
    const chip = await f.evaluateHandle(new Function(`return ${R}.querySelector('.chip[data-conn="wifi"]')`));
    await chip.asElement().tap();
    check(`[${tag}] Chip im fixierten Kopf bedienbar`, await wait(`return r.querySelector('.chip[data-conn="wifi"]').classList.contains("on")`));
    await ev(`r.querySelector('.chip[data-conn="all"]').click()`);

    // Tipp auf die Zeile: zurück zu den Kacheln
    await scrollTo(1000);
    await wait(`return getComputedStyle(r.querySelector(".hs-in")).display === "flex"`);
    const btn = await f.evaluateHandle(new Function(`return ${R}.querySelector(".hs-in")`));
    check(`[${tag}] Zeile hat Beschriftung`, (await btn.asElement().getAttribute("aria-label")) === T.back);
    await btn.asElement().tap();
    check(`[${tag}] Tipp scrollt nach oben`, await wait(`return r.querySelector(".content").scrollTop === 0 && getComputedStyle(r.querySelector(".hs-in")).display === "none"`));

    // Mit Bereich: Name in der Zeile
    await ev(`r.host._setAreas(["kueche"])`);
    await scrollTo(1000);
    check(`[${tag}] Bereich in der Zeile`, await wait(`return r.querySelector(".hs-in .scope")?.textContent === ${JSON.stringify(T.scope)}`) || (await ev(`return r.querySelector(".hs-in .scope")?.textContent`)) === T.scope, await ev(`return r.querySelector(".hs-in")?.textContent`));
    await ev(`r.host._setAreas([])`);
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
