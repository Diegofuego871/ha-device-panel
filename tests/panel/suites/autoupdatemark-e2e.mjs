// Zeichen für aktives Auto-Update (Wunsch des Nutzers, docs/mockups/autoupdate-v1): In der Versionsleiste der Einstellungen steht bei "Aktuell"
// hinter dem Titel die Pille "Auto" (Variante B, wie die Pille "Beta"); das Symbol bleibt unverändert (der grüne Kreis vollständig, kein
// Abzeichen, kein Ring). Es erscheint nur, wenn das Auto-Update wirklich arbeitet (Schalter an und tägliche Prüfung an, gespeicherter Stand).
// 2.37.0 hatte zuerst ein Abzeichen mit kreisendem Ring (Variante A mit Ring); das war dem Nutzer zu unruhig. Deutsch und Englisch, Desktop
// und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { tag: "Auto", tip: "Updates werden automatisch installiert" },
  en: { tag: "Auto", tip: "Updates are installed automatically" },
};

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    for (const mode of ["aus", "an", "ohne-pruefung"]) {
      const tag = `${lang}/${mobile ? "mobile" : "desktop"}/${mode}`;
      const ctx = await b.newContext({ ...(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1400, height: 1000 } }) });
      const p = await ctx.newPage();
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}`);
      const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
      await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
      const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
      const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
      // Zustand im Nachbau von HA: Auto-Update an, tägliche Prüfung an oder aus (die Einstellungen kommen beim Öffnen)
      await p.evaluate((m) => { window.__panelSettings.auto_update = m !== "aus"; if (m === "ohne-pruefung") window.__opts.update_check = false; }, mode);
      await ev(`r.querySelector(".gear-btn").click()`);
      await wait(`return !!r.querySelector("dialog.settings .ver-slot .ver")`);
      await p.waitForTimeout(400);
      const st = await ev(`const v = r.querySelector("dialog.settings .ver-slot .ver"); const tag = v.querySelector(".ver-t b .ver-auto"); const ic = v.querySelector(".ver-ic"); return { cls: v.className, title: v.querySelector(".ver-t b").textContent.replace(/\\s+/g, " ").trim(), sub: v.querySelector(".ver-t small").textContent.replace(/\\s+/g, " "), tag: !!tag, tagText: tag?.textContent.trim() || null, tip: tag?.getAttribute("aria-label") || null, titleAttr: tag?.getAttribute("title") || null, svg: !!tag?.querySelector("svg"), icKids: ic.children.length, ring: !!v.querySelector(".ver-ring"), badge: !!v.querySelector(".ver-ic .ver-auto"), anim: tag ? getComputedStyle(tag).animationName : null, h: tag ? tag.getBoundingClientRect().height : 0 }`);
      if (mode === "an") {
        check(`[${tag}] Zeile "Aktuell": Pille "${T.tag}" hinter dem Titel, mit Symbol, Text "${T.tip}"`, /\bok\b/.test(st.cls) && st.tag && st.tagText === T.tag && st.svg && st.tip === T.tip && st.titleAttr === T.tip && st.h >= 14, JSON.stringify(st));
        check(`[${tag}] das Symbol bleibt unverändert: nur das Häkchen, kein Abzeichen, kein Ring, nichts dreht sich`, st.icKids === 1 && !st.ring && !st.badge && st.anim === "none", JSON.stringify(st));
        check(`[${tag}] Untertitel ohne "automatisch" (die Pille sagt es)`, !/automati/i.test(st.sub), st.sub);
      } else {
        check(`[${tag}] ${mode === "aus" ? "Auto-Update aus" : "tägliche Prüfung aus"}: keine Pille, kein Abzeichen, kein Ring`, !st.tag && !st.ring && !st.badge && !/\bauto\b/.test(st.cls) && st.icKids === 1, JSON.stringify(st));
      }
      check(`[${tag}] Zeile läuft nicht über (Symbol, Titel, Knöpfe sichtbar)`, await ev(`const v = r.querySelector("dialog.settings .ver-slot .ver").getBoundingClientRect(), d = r.querySelector("dialog.settings").getBoundingClientRect(); return v.right <= d.right + 1 && v.height > 30 && v.height < 140`));
      check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
