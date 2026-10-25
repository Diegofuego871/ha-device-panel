// Sternschnuppe am Knopf mit Punkt (2.147.0): Launcher-Knopf mit Punkt bekommt den Schweif (Animation dp-comet) und der Punkt selbst fliegt (dp-land: weg, beim Ankommen gross);
// ohne Punkt nichts; bei "Bewegung reduzieren" keine Animation. Farbe folgt dem Punkt (orange bei Debug, rot bei Neustart).
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

for (const reduce of [false, true]) {
  for (const mobile of [false, true]) {
    const tag = `${reduce ? "reduziert" : "normal"}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: reduce ? "reduce" : "no-preference" }
      : { viewport: { width: 1400, height: 900 }, reducedMotion: reduce ? "reduce" : "no-preference" });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=de&theme=dark`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const anim = () => ev(`const b = r.querySelector(".apps-btn"); const s = (pseudo) => getComputedStyle(b, pseudo).animationName; return [b.classList.contains("has-dot"), s("::before"), s("::after"), getComputedStyle(b).getPropertyValue("--cm").trim()]`);
    let a = await anim();
    check(`[${tag}] ohne Punkt keine Sternschnuppe`, !a[0] && a[1] === "none", JSON.stringify(a));
    // Debug-Modus an: orange Punkt am Launcher-Knopf
    await ev(`r.host._debugOn = true; r.host._apps.paintDots()`);
    await f.waitForFunction(new Function(`return ${R}.querySelector(".apps-btn").classList.contains("has-dot")`), null, { timeout: 5000 });
    a = await anim();
    if (reduce) check(`[${tag}] "Bewegung reduzieren": keine Animation, Punkt bleibt`, a[0] && a[1] === "none" && a[2] === "none", JSON.stringify(a));
    else {
      check(`[${tag}] Punkt da: Schweif (dp-comet) und atmender Punkt (dp-land)`, a[0] && a[1] === "dp-comet" && a[2] === "dp-land", JSON.stringify(a));
      check(`[${tag}] orange bei Debug`, /warning/.test(await ev(`return r.querySelector(".apps-btn").classList.contains("dot-warn") + " " + (getComputedStyle(r.querySelector(".apps-btn")).getPropertyValue("--cm") || "")`)) || (await ev(`return r.querySelector(".apps-btn").classList.contains("dot-warn")`)) === true);
      // Mitten im Lauf ist der Schweif sichtbar
      await ev(`r.getAnimations().filter((x) => x.animationName === "dp-comet").forEach((x) => { x.pause(); x.currentTime = 1000 + 700; })`);
      const op = await ev(`return getComputedStyle(r.querySelector(".apps-btn"), "::before").opacity`);
      check(`[${tag}] mitten im Lauf sichtbar (Deckkraft 1)`, Number(op) === 1, op);
      // Der Punkt ist die Sternschnuppe (2.149.0): im Flug unsichtbar, beim Ankommen gross, dann wieder normal
      const dotAt = (t) => ev(`r.getAnimations().filter((x) => x.animationName === "dp-land").forEach((x) => { x.pause(); x.currentTime = ${t}; }); const cs = getComputedStyle(r.querySelector(".apps-btn"), "::after"); return [+cs.opacity, new DOMMatrix(cs.transform).a]`);
      const fly = await dotAt(1000 + 0.08 * 8000), land = await dotAt(1000 + 0.15 * 8000), rest = await dotAt(1000 + 0.6 * 8000);
      check(`[${tag}] im Flug ist der Punkt weg (leuchtet nicht zugleich)`, fly[0] === 0, JSON.stringify(fly));
      check(`[${tag}] beim Ankommen kurz grösser`, land[0] === 1 && land[1] > 1.5, JSON.stringify(land));
      check(`[${tag}] danach wieder normal gross und sichtbar`, rest[0] === 1 && rest[1] === 1, JSON.stringify(rest));
      await ev(`r.getAnimations().filter((x) => x.animationName === "dp-comet").forEach((x) => { x.currentTime = 1000 + 0.12 * 8000; })`);
      await dotAt(1000 + 0.12 * 8000);
      await p.screenshot({ path: `${outDir}/comet-${mobile ? "mobile" : "desktop"}.png` });
    }
    // Punkt aus: Schweif weg
    await ev(`r.host._debugOn = false; r.host._apps.paintDots()`);
    await f.waitForFunction(new Function(`return !${R}.querySelector(".apps-btn").classList.contains("has-dot")`), null, { timeout: 5000 });
    a = await anim();
    check(`[${tag}] Punkt weg: Schweif weg`, !a[0] && a[1] === "none", JSON.stringify(a));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join("|"));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
