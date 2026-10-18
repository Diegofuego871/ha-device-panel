// 2.92.0: Reiter "Schalter" zeigt den neuen Zustand, sobald HA ihn meldet (ohne Reiterwechsel), und das Logo wird im Easter Egg zum blauen Herz.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const wait = (code, ms = 6000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);

    // Zustand ändern, ohne den Reiter zu wechseln
    await p.evaluate(() => {
      window.__detailExtra = { g: [{ entity_id: "light.deckenlicht_spot", name: "Spot", state: "off", unit: null, category: null, liveness: false }] };
    });
    await ev(`[...r.querySelectorAll(".dev")].find((e) => e.textContent.includes("Deckenlicht Wohnzimmer")).click()`);
    await wait(`return r.querySelector("dialog.device")?.open && !!r.querySelector('dialog.device [data-tab="sw"]')`);
    await ev(`r.querySelector('dialog.device [data-tab="sw"]').click()`);
    await wait(`return !!r.querySelector("dialog.device .sw-cell")`);
    const cell = () => ev(`return r.querySelector('dialog.device .sw-cell[data-entity="light.deckenlicht_spot"]')?.className || ""`);
    check(`[${tag}] Spot zuerst aus`, !(await cell()).includes("on"), await cell());
    await p.evaluate(() => {
      const hp = document.querySelector("home-assistant");
      const st = hp.hass.states["light.deckenlicht_spot"] || { entity_id: "light.deckenlicht_spot", attributes: {} };
      hp.hass = { ...hp.hass, states: { ...hp.hass.states, "light.deckenlicht_spot": { ...st, state: "on", last_updated: new Date().toISOString() } } };
      document.querySelector("#panel-frame").contentDocument.querySelector("device-panel").hass = hp.hass;
    });
    check(`[${tag}] Kachel zeigt "an" nach der HA-Meldung, ohne Reiterwechsel`, await wait(`return r.querySelector('dialog.device .sw-cell[data-entity="light.deckenlicht_spot"]')?.classList.contains("on")`), await cell());
    await ev(`r.querySelector("dialog.device .dlg-close").click()`);
    await wait(`return !r.querySelector("dialog.device").open`);

    // Easter Egg: Logo wird zum Herz, dann zurück
    const logo = () => ev(`const s = r.querySelector(".tb-main > svg"); return [s.getAttribute("viewBox"), s.classList.contains("ee-heart"), s.querySelectorAll("path").length, s.innerHTML.includes("dpgh")]`);
    const before = JSON.stringify(await logo());
    for (let i = 0; i < 5; i++) await ev(`r.querySelector(".tb-main > svg").dispatchEvent(new MouseEvent("click", { bubbles: true }))`);
    const h = await logo();
    check(`[${tag}] Logo ist ein blaues Herz (ohne D), pulsiert`, h[0] === "0 0 24 24" && h[1] && h[2] === 1 && h[3], JSON.stringify(h));
    const anim = await ev(`return getComputedStyle(r.querySelector(".tb-main > svg")).animationName`);
    check(`[${tag}] Animation "ee-beat"`, anim.includes("ee-beat"), anim);
    check(`[${tag}] Logo kommt zurück (nach ca. 7,5 s)`, await wait(`const s = r.querySelector(".tb-main > svg"); return !s.classList.contains("ee-heart")`, 12000) && JSON.stringify(await logo()) === before, JSON.stringify(await logo()));
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
