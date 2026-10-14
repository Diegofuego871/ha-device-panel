// Zeichen für aktives Auto-Update (2.37.0, Wunsch des Nutzers, docs/mockups/autoupdate-v1: Variante A mit Ring aus C, nur in den Einstellungen):
// In der Versionsleiste der Einstellungen trägt das Symbol bei "Aktuell" ein Abzeichen (kreisende Pfeile) und einen langsam kreisenden
// Ring, im Untertitel steht "automatisch". Es erscheint nur, wenn das Auto-Update wirklich arbeitet (Schalter an und tägliche Prüfung an,
// gespeicherter Stand). Bei "weniger Bewegung" steht der Ring still. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { sub: "Aktuell · automatisch", tip: "Updates werden automatisch installiert" },
  en: { sub: "Up to date · automatic", tip: "Updates are installed automatically" },
};

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    for (const mode of ["aus", "an", "ohne-pruefung", "weniger-bewegung"]) {
      const tag = `${lang}/${mobile ? "mobile" : "desktop"}/${mode}`;
      const ctx = await b.newContext({ ...(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1400, height: 1000 } }), reducedMotion: mode === "weniger-bewegung" ? "reduce" : "no-preference" });
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
      const st = await ev(`const v = r.querySelector("dialog.settings .ver-slot .ver"); const ring = v.querySelector(".ver-ring"), badge = v.querySelector(".ver-auto"); return { cls: v.className, sub: v.querySelector(".ver-t small").textContent.replace(/\\s+/g, " "), ring: !!ring, badge: !!badge, tip: badge?.getAttribute("aria-label") || null, title: badge?.getAttribute("title") || null, anim: ring ? getComputedStyle(ring).animationName : null, bw: badge ? badge.getBoundingClientRect().width : 0, inIc: !!v.querySelector(".ver-ic .ver-auto") }`);
      if (mode === "an" || mode === "weniger-bewegung") {
        check(`[${tag}] Zeile "Aktuell" mit Abzeichen und Ring auf dem Symbol`, /\bok\b/.test(st.cls) && /\bauto\b/.test(st.cls) && st.badge && st.ring && st.inIc && st.bw >= 16, JSON.stringify(st));
        check(`[${tag}] Untertitel "${T.sub}", Abzeichen mit Text "${T.tip}"`, st.sub.startsWith(T.sub) && st.tip === T.tip && st.title === T.tip, st.sub);
        check(`[${tag}] ${mode === "an" ? "Ring dreht sich (Animation)" : "bei weniger Bewegung steht der Ring still"}`, mode === "an" ? st.anim === "ver-ring-spin" : st.anim === "none", String(st.anim));
      } else {
        check(`[${tag}] ${mode === "aus" ? "Auto-Update aus" : "tägliche Prüfung aus"}: kein Abzeichen, kein Ring, kein "automatisch"`, !st.badge && !st.ring && !/auto/.test(st.cls) && !/automati/.test(st.sub), JSON.stringify(st));
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
