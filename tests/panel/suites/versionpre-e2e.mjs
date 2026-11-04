// Pille "Vorabversion" in der Versionszeile der Einstellungen (2.190.2): erscheint nur, wenn das Panel meldet, dass die installierte
// Version bei GitHub als Pre-release markiert ist (installed_prerelease === true); bei false oder unbekannt (null) steht keine Pille.
// Die Pille ist violett wie "Beta". Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = { de: { tag: "Vorabversion" }, en: { tag: "pre-release" } };

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    for (const mode of [true, false, null]) {
      const tag = `${lang}/${mobile ? "mobile" : "desktop"}/${mode}`;
      const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1400, height: 1000 } });
      const p = await ctx.newPage();
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}`);
      const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
      await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
      const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
      const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
      await p.evaluate((m) => { window.__installedPre = m; }, mode);
      await ev(`r.querySelector(".gear-btn").click()`);
      await wait(`return !!r.querySelector("dialog.settings .ver-slot .ver")`);
      await p.waitForTimeout(400);
      const st = await ev(`const e = r.querySelector("dialog.settings .ver-slot .ver .ver-t b .ver-pre"); return e ? { text: e.textContent.trim(), color: getComputedStyle(e).color, title: e.getAttribute("title") } : null`);
      if (mode === true) {
        check(`[${tag}] Pille "${T.tag}" hinter dem Titel, violett, mit Erklärung`, st && st.text === T.tag && st.color === "rgb(163, 127, 224)" && st.title.length > 20, JSON.stringify(st));
      } else {
        check(`[${tag}] ${mode === false ? "offizielles Release" : "unbekannt"}: keine Pille`, st === null);
      }
      check(`[${tag}] Zeile läuft nicht über`, await ev(`const v = r.querySelector("dialog.settings .ver-slot .ver").getBoundingClientRect(), d = r.querySelector("dialog.settings").getBoundingClientRect(); return v.right <= d.right + 1 && v.left >= d.left - 1`));
      check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
