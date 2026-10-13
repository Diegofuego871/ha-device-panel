// Symbole und Farben des App-Launchers wie in den Einstellungen von Home Assistant (2.35.0): jede App von HA trägt Symbol und Farbe
// ihrer Seite (aus dem Frontend von HA), die Apps des Panels ihre Farbe, eigene Apps die Hauptfarbe, ein Favicon bleibt ohne Kreis.
// Die Kopfzeile zeigt dasselbe Symbol, aber ohne Farbe. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
// Farbe und Anfang des Symbolpfads je App (HA: iconColor und iconPath der jeweiligen Seite)
const HA = {
  auto: ["#518C43", "M12,2A2,2 0 0,1 14,4C14,4.74"],
  scene: ["#518C43", "M17.5,12A1.5,1.5 0 0,1 16,10.5"],
  script: ["#518C43", "M17.8,20C17.4,21.2 16.3,22"],
  helper: ["#4D2EA4", "M21.71 20.29L20.29 21.71A1 1 0"],
  dev: ["#2D338F", "M3 6H21V4H3C1.9 4 1 4.9 1 6V18"],
  ent: ["#2D338F", "M11,13.5V21.5H3V13.5H11"],
  integ: ["#2D338F", "M20.5,11H19V7C19,5.89 18.1,5 17,5H13V3.5"],
  area: ["#2D338F", "M12.5 7C12.5 5.89 13.39 5 14.5 5H18"],
  tools: ["#7A5AA6", "M2 19.63L13.43 8.2L12.72 7.5"],
  backup: ["#0D47A1", "M12,3A9,9 0 0,0 3,12H0L4,16L8,12H5"],
};
const PANEL = { timer: "#00838F", magic: "#8E24AA", log: "#4A5963" };
const SEED = JSON.stringify({
  device_panel_apps: {
    fav: ["timer", "auto", "c1"], hidden: [], order: {}, layout: {}, updated: 1,
    custom: [
      { id: "c1", name: "Mein Link", icon: "web", url: "/lovelace/x", ext: false },
      { id: "c2", name: "NAS", icon: "web", url: "https://nas.example", ext: true, favicon: PNG },
    ],
  },
});

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.addInitScript((v) => { if (!sessionStorage.getItem("sim_user_data")) sessionStorage.setItem("sim_user_data", v); }, SEED);
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=${mobile ? "dark" : "light"}`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => {
      for (let n = 1; ; n++) {
        const h = await handle(sel);
        if (!h) throw new Error("fehlt: " + sel);
        try { await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); return; } catch (err) { if (n >= 3 || !/not attached|not stable/.test(String(err))) throw err; await p.waitForTimeout(200); }
      }
    };
    const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
    const D = "dialog.apps-dlg";

    check(`[${tag}] Benutzerdaten angekommen (Favorit "Mein Link")`, await wait(`return r.host._apps?.data?.custom?.length === 2`));
    await tap(".apps-btn");
    await wait(`return r.querySelector("${D}")?.open`);
    if (await ev(`return !!r.querySelector('${D} [data-ap="all"]')`)) await tap(`${D} [data-ap="all"]`);
    // Farbe und Symbol je App: Kreis in der Farbe, weisses Symbol
    const look = (id) => ev(`const ico = r.querySelector('${D} [data-id="${id}"] .ap-ico'); if (!ico) return null; const cs = getComputedStyle(ico); return { bg: cs.backgroundColor, fg: cs.color, d: ico.querySelector("svg path")?.getAttribute("d") || "", fi: !!ico.querySelector(".ap-fi"), own: ico.classList.contains("own") }`);
    for (const [id, [col, path]] of Object.entries(HA)) {
      const l = await look(id);
      check(`[${tag}] ${id}: Kreis ${col}, weisses Symbol, Symbol von HA`, !!l && l.bg === rgb(col) && l.fg === "rgb(255, 255, 255)" && l.d.startsWith(path), JSON.stringify(l && { ...l, d: l.d.slice(0, 30) }));
    }
    for (const [id, col] of Object.entries(PANEL)) {
      const l = await look(id);
      check(`[${tag}] ${id} (Panel): Kreis ${col}, weisses Symbol`, !!l && l.bg === rgb(col) && l.fg === "rgb(255, 255, 255)" && !!l.d, JSON.stringify(l && { ...l, d: l.d.slice(0, 20) }));
    }
    const own = await look("c1");
    const primary = await ev(`const e = document.createElement("div"); e.style.background = "var(--dp-primary)"; r.appendChild(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c`);
    check(`[${tag}] eigene App: Kreis in der Hauptfarbe, weisses Symbol`, !!own && own.own && own.bg === primary && own.fg === "rgb(255, 255, 255)", JSON.stringify(own));
    const fav = await look("c2");
    check(`[${tag}] eigene App mit Favicon: kein Kreis, Bild da`, !!fav && fav.fi && fav.bg === "rgba(0, 0, 0, 0)" && !fav.own, JSON.stringify(fav));

    // Kopfzeile: dasselbe Symbol (HA), aber ohne Farbe
    await ev(`r.querySelector("${D}").close()`);
    const pin = await ev(`const a = r.querySelector('.toolbar .app-pin[data-app-pin="${mobile ? "timer" : "auto"}"]'); if (!a) return null; return { d: a.querySelector("svg path")?.getAttribute("d") || "", bg: getComputedStyle(a).backgroundColor }`);
    const wantPin = mobile ? null : HA.auto;
    check(`[${tag}] Kopfzeile: ${mobile ? "Timer als erster Favorit" : "Automationen mit Symbol von HA"}, ohne Farbkreis`, !!pin && (mobile || pin.d.startsWith(wantPin[1])) && pin.bg !== rgb(HA.auto[0]) && pin.bg !== rgb(PANEL.timer), JSON.stringify(pin && { ...pin, d: pin.d.slice(0, 20) }));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
