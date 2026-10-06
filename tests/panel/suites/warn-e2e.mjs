// Warnung statt Problem (1.16.0, docs/mockups/chip-warn-v1, V1): Zeile "N Geräte
// mit Warnung" unten in der Kachel "Gerade ausgefallen" (antippbar), Chips
// "Ausgefallen" und "Warnungen" mit Zahl, nur sichtbar, wenn sie zutreffen;
// "Warnungen" ohne Ausfälle, beide zusammen = beides, "Alle" hebt beide auf;
// ausgeblendeter Chip hebt seinen Filter auf. Deutsch und Englisch, Desktop
// und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { line: /^3 Geräte mit Warnung$/, none: "Keine Warnungen", off: "Ausgefallen", warn: "Warnungen" },
  en: { line: /^3 devices with a warning$/, none: "No warnings", off: "Offline", warn: "Warnings" },
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
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const rows = () => ev(`return r.querySelectorAll(".dev[data-open]").length`);
    const click = (sel) => ev(`r.querySelector(${JSON.stringify(sel)}).click()`);
    const chip = (sel) => ev(`const c=r.querySelector(${JSON.stringify(sel)}); return c ? { text: c.textContent.replace(/\\s+/g," ").trim(), on: c.classList.contains("on") } : null`);
    const total = await rows();

    // 1. Zeile unten in der Kachel
    const line = await ev(`const k=r.querySelector(".hero .kt.offl .kwarn"); if (!k) return null; const t=k.closest(".kt").getBoundingClientRect(), a=k.getBoundingClientRect(); return { text: k.textContent.replace(/\\s+/g," ").trim(), tag: k.tagName, gap: Math.round(t.bottom - a.bottom) }`);
    check(`[${tag}] Kachel: Zeile "3 ... mit Warnung" als Knopf`, line && line.tag === "BUTTON" && T.line.test(line.text), JSON.stringify(line));
    check(`[${tag}] Zeile sitzt unten in der Kachel`, line && Math.abs(line.gap) <= 17, JSON.stringify(line));
    // 2. Chips mit Zahl
    const co = await chip("[data-offline]");
    const cw = await chip("[data-problems]");
    check(`[${tag}] Chip "${T.off}" mit Zahl 4`, co && co.text === `${T.off} 4`, JSON.stringify(co));
    check(`[${tag}] Chip "${T.warn}" mit Zahl 3`, cw && cw.text === `${T.warn} 3`, JSON.stringify(cw));
    // 3. Zeile antippen: nur Warnungen
    await click("[data-warn-open]");
    check(`[${tag}] Zeile antippen: Filter "${T.warn}", 3 Geräte`, (await wait(`return r.querySelectorAll(".dev[data-open]").length === 3`)) && (await chip("[data-problems]")).on && !(await chip("[data-offline]")).on, String(await rows()));
    // 4. "Ausgefallen" dazu = beides (wie früher "Nur Probleme"), nur "Ausgefallen"
    await click("[data-offline]");
    check(`[${tag}] beide aktiv: 7 Geräte`, await wait(`return r.querySelectorAll(".dev[data-open]").length === 7`), String(await rows()));
    await click("[data-problems]");
    check(`[${tag}] nur "${T.off}": 4 Geräte`, await wait(`return r.querySelectorAll(".dev[data-open]").length === 4`), String(await rows()));
    // 5. "Alle" hebt beide auf
    await click("[data-problems]");
    await click('[data-conn="all"]');
    check(`[${tag}] "Alle": beide Filter aus, alle Geräte`, (await wait(`return r.querySelectorAll(".dev[data-open]").length === ${total}`)) && !(await chip("[data-problems]")).on && !(await chip("[data-offline]")).on, String(await rows()));
    // 6. Ausgeblendeter Chip hebt seinen Filter auf
    await ev(`const h=r.host; h._offlineOnly = true; h._problems = true; h._saveView();`);
    await p.evaluate(() => { window.__opts.hide_chips = ["offline", "problems"]; });
    await ev(`return r.host._fetch(true)`);
    check(`[${tag}] ausgeblendet: beide Chips weg, Filter aufgehoben`, await wait(`const h=r.host; return !r.querySelector("[data-offline]") && !r.querySelector("[data-problems]") && h._offlineOnly === false && h._problems === false`), JSON.stringify([await chip("[data-offline]"), await chip("[data-problems]")]));

    await p.evaluate(() => { window.__opts.hide_chips = []; });
    await ev(`return r.host._fetch(true)`);
    await wait(`return !!r.querySelector("[data-problems]")`);

    // 7. Ohne Ausfälle: Chip "Ausgefallen" fehlt, Kachel meldet "Alles online"
    await ev(`const h=r.host; for (const d of h._devices) if (d.online === false) { d.online = true; d.offline_since = null; } h._fetch = () => {}; h._render();`);
    check(`[${tag}] ohne Ausfälle: kein Chip "${T.off}", Zeile bleibt`, (await wait(`return !r.querySelector("[data-offline]") && !!r.querySelector(".hero .kt.offl .kwarn")`)), JSON.stringify(await chip("[data-offline]")));
    // 8. Ohne Warnungen: "Keine Warnungen" (kein Knopf)
    const none = await ev(`const h=r.host; const healthy = h._devices.map((d) => ({ ...d, online: true, flaky: false, battery: null, signal: null, signal_setting: null })); const html = h._heroHtml(healthy, []); const m = html.match(/<div class="kwarn none">(.*?)<\\/div>/); return { html: !!m, text: m ? m[1].replace(/<[^>]+>/g, "").trim() : "", button: html.includes("data-warn-open") }`);
    check(`[${tag}] ohne Warnungen: "${T.none}", kein Knopf`, none.html && none.text === T.none && !none.button, JSON.stringify(none));
    check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
