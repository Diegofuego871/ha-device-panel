// Logo der Integration statt Verbindungs-Icon im Avatar (1.22.0): vom Brand-Dienst von HA
// (/api/brands/integration/<Domain>/icon.png, mit Token aus brands/access_token), im dunklen
// Design zuerst dark_icon.png, ohne Logo (404) oder ohne Dienst (ältere HA) bleibt das
// Verbindungs-Icon. Statuspunkt bleibt. Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

for (const mobile of [false, true]) {
  for (const mode of ["light", "dark", "nobrands"]) {
    const tag = `${mobile ? "mobile" : "desktop"}/${mode}`;
    const ctx = await b.newContext({
      ...(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } }),
      colorScheme: mode === "dark" ? "dark" : "light",
    });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=de&theme=${mode === "dark" ? "dark" : "light"}${mode === "nobrands" ? "&nobrands=1" : ""}`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    // Avatar eines Geräts: Bild (Adresse) oder Icon
    const av = (id) => ev(`const a=r.querySelector('.dev[data-open="${id}"] .av'); return a ? { img: a.querySelector("img.brand")?.getAttribute("src") || null, svg: !!a.querySelector("svg"), dot: !!a.querySelector(".dot") } : null`);

    if (mode === "nobrands") {
      await p.waitForTimeout(500);
      const d = await av("d");
      check(`[${tag}] ohne Dienst: Verbindungs-Icon, kein Bild`, d && !d.img && d.svg && d.dot, JSON.stringify(d));
    } else {
      check(`[${tag}] Shelly: Logo statt Icon, Statuspunkt bleibt`, await wait(`return !!r.querySelector('.dev[data-open="d"] .av img.brand')`) && (await av("d")).dot && !(await av("d")).svg, JSON.stringify(await av("d")));
      const shelly = (await av("d")).img;
      check(`[${tag}] Adresse: lokaler Brand-Dienst mit Token`, shelly === "/api/brands/integration/shelly/icon.png?token=sim-token", shelly);
      // Matter hat kein Logo (404): Verbindungs-Icon bleibt
      await p.waitForTimeout(400);
      const c = await av("c");
      check(`[${tag}] Matter ohne Logo: Icon bleibt`, c && !c.img && c.svg, JSON.stringify(c));
      // ZHA: im dunklen Design dark_icon.png, sonst icon.png; Shelly hat nur icon.png (dark_icon 404 -> Ersatz)
      const zha = (await av("b")).img;
      check(`[${tag}] ZHA: ${mode === "dark" ? "dark_icon.png" : "icon.png"}`, zha === `/api/brands/integration/zha/${mode === "dark" ? "dark_icon" : "icon"}.png?token=sim-token`, zha);
      check(`[${tag}] Bilder laden wirklich`, await ev(`return [...r.querySelectorAll(".dev .av img.brand")].every((i) => i.complete && i.naturalWidth > 0)`));
      await p.screenshot({ path: `${outDir}/brand-${tag.replace("/", "-")}.png` });
    }
    // Einstellungen: Logos auch bei den Integrationen (Anzeige und Überwachung), sonst Anfangsbuchstaben
    await ev(`r.querySelector(".gear-btn").click()`);
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await ev(`r.querySelector('[data-set="section"][data-id="devices"]').click()`);
    await wait(`return !!r.querySelector('input[data-list="exclude_integrations"]')`);
    const badge = (dom) => ev(`const i=r.querySelector('input[data-list="exclude_integrations"][data-value="${dom}"]'); const b=i?.closest(".ex-row")?.querySelector(".ibadge"); return b ? { img: b.querySelector("img")?.getAttribute("src") || null, text: b.textContent.trim() } : null`);
    if (mode === "nobrands") {
      const sb = await badge("shelly");
      check(`[${tag}] Einstellungen ohne Dienst: Anfangsbuchstaben`, sb && !sb.img && sb.text === "SH", JSON.stringify(sb));
    } else {
      const sb = await badge("shelly");
      const mb = await badge("matter");
      check(`[${tag}] Einstellungen: Shelly mit Logo, Matter (404) mit Buchstaben`, sb && sb.img === "/api/brands/integration/shelly/icon.png?token=sim-token" && mb && !mb.img && mb.text === "MA", JSON.stringify([sb, mb]));
      check(`[${tag}] Logos in den Einstellungen laden`, await ev(`return [...r.querySelectorAll("dialog.settings .ibadge img")].every((i) => i.complete && i.naturalWidth > 0)`));
      await ev(`r.querySelector('[data-set="section"][data-id="monitor"]').click()`);
      await ev(`r.querySelector('[data-set="tab"][data-key="integ"]').click()`);
      await wait(`return !!r.querySelector(".ilist")`);
      check(`[${tag}] Liste der Integrationen (Überwachung) mit Logo`, await ev(`return !!r.querySelector('.ilist-row[data-key="shelly"] .ibadge img')`));
      await p.screenshot({ path: `${outDir}/brand-settings-${tag.replace("/", "-")}.png` });
    }
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
