// Dashboard-Karten (2.216.0, card.js): Verfügbarkeit, Gerade ausgefallen und Übersicht mit Ausfall-Puls. Nachbau eines Dashboards (sim/card-sim.html),
// Deutsch und Englisch, hell und dunkel, Desktop und Handy: Zahlen aus dem Sensor, ausgefallene Geräte mit Dauer, Pausiert und Warnungen,
// Pfeil und Tippen nur für Administratoren, fehlender Sensor, keine Fehler in der Konsole.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const T = {
  de: { avail: "Verfügbarkeit", offline: "Gerade ausgefallen", pulse: "Ausfall-Puls", allOnline: "Alles online", paused: "1 Gerät pausiert", noStatus: "4 ohne Online-Status", none: "Keine Unterbrüche", missing: "nicht gefunden" },
  en: { avail: "Availability", offline: "Offline right now", pulse: "Outage pulse", allOnline: "Everything online", paused: "1 device paused", noStatus: "4 without online status", none: "No outages", missing: "was not found" },
};
for (const lang of ["de", "en"]) {
  const L = T[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1200, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    const open = async (query) => {
      await p.goto(`http://127.0.0.1:8950/card-sim.html?lang=${lang}&${query}`);
      await p.waitForFunction(() => window.__ready || window.__err, null, { timeout: 15000 });
      if (await p.evaluate(() => window.__err)) throw new Error(await p.evaluate(() => window.__err));
    };
    const txt = (id) => p.evaluate((i) => (document.getElementById(i).shadowRoot.querySelector(".body").innerText || "").replace(/\s+/g, " ").trim(), id);
    const has = (id, sel) => p.evaluate(([i, s]) => !!document.getElementById(i).shadowRoot.querySelector(s), [id, sel]);

    // Alles online (dunkel)
    await open("theme=dark&state=ok");
    check(`[${tag}] Verfügbarkeit: 100 %, 169 stabil, ${L.noStatus}`, /100 %/.test(await txt("a")) && /169/.test(await txt("a")) && (await txt("a")).includes(L.noStatus));
    check(`[${tag}] Gerade ausgefallen: 0, "${L.allOnline}", "${L.paused}"`, (await txt("o")).includes(L.allOnline) && (await txt("o")).includes(L.paused));
    check(`[${tag}] Übersicht: alle drei Kacheln, Puls ohne Unterbrüche ("${L.none}")`, (await has("all", ".kt.ring")) && (await has("all", ".kt.offl")) && (await has("all", ".kt.pul")) && (await txt("all")).includes(L.none));
    await p.screenshot({ path: `${outDir}/card-${tag.replace("/", "-")}-ok.png`, fullPage: true });

    // Ausfälle (hell)
    await open("theme=light&state=offline");
    const o = await txt("o");
    check(`[${tag}] Ausfälle: Zahl 3, Namen der Geräte mit Dauer, "≥" bei unklarem Beginn`, /\b3\b/.test(o) && o.includes("Beispiel Lampe") && /3 (Std|h)/.test(o) && /≥ 7/.test(o));
    check(`[${tag}] Ausfälle: Warnungen "2", Verfügbarkeit 98,2 bzw. 98.2 %`, /\b2\b/.test(o) && /98[.,]2 %/.test(await txt("a")));
    check(`[${tag}] Puls: Kurve gezeichnet, rote Linie`, await has("all", ".pchart .line.off"));
    await p.screenshot({ path: `${outDir}/card-${tag.replace("/", "-")}-offline.png`, fullPage: true });

    // Pfeil und Tippen nur für Administratoren
    check(`[${tag}] Administrator: Pfeil an den Kacheln`, await has("o", ".kchev .cbtn"));
    await p.evaluate(() => document.getElementById("o").shadowRoot.querySelector(".kt").click());
    check(`[${tag}] Administrator: Tippen öffnet das Panel`, (await p.evaluate(() => window.__nav)).includes("/device-panel"));
    await open("state=offline&admin=0");
    check(`[${tag}] Kein Administrator: kein Pfeil, Tippen tut nichts`, !(await has("o", ".kchev")) && !(await has("a", ".kt.tap")));
    await p.evaluate(() => document.getElementById("o").shadowRoot.querySelector(".kt").click());
    check(`[${tag}] Kein Administrator: Panel wird nicht geöffnet`, (await p.evaluate(() => window.__nav)).length === 0);

    // Vergiftete Attribute: Namen und Zahlen werden nie zu HTML
    await open("state=offline&xss=1");
    await p.waitForTimeout(300);
    check(`[${tag}] vergiftete Namen und Zahlen laufen nicht als HTML`, !(await p.evaluate(() => window.__xss)) && !(await has("o", "img")) && !(await has("all", "img")));

    // Dunkles Design von Home Assistant: Kacheln dunkel, helles Design: Kacheln hell, auch wenn das Thema keine Farben setzt (vars=0, Ersatzwerte)
    const lum = () => p.evaluate(() => {
      const el = getComputedStyle(document.getElementById("all").shadowRoot.querySelector(".kt")).backgroundColor;
      const [r, g, b] = el.match(/[\d.]+/g).map(Number);
      return (r + g + b) / 3;
    });
    for (const vars of ["1", "0"]) {
      await open(`theme=dark&state=offline&vars=${vars}`);
      const dark = await lum();
      check(`[${tag}] Dunkles Design (Thema ${vars === "1" ? "mit" : "ohne"} Farben): Kacheln dunkel`, dark < 80, String(dark));
      check(`[${tag}] Dunkles Design: Attribut "dark" am Element`, await p.evaluate(() => document.getElementById("all").hasAttribute("dark") && !document.getElementById("all").hasAttribute("light")));
      await open(`theme=light&state=offline&vars=${vars}`);
      const light = await lum();
      check(`[${tag}] Helles Design (Thema ${vars === "1" ? "mit" : "ohne"} Farben): Kacheln hell`, light > 200, String(light));
    }
    // Wechsel zur Laufzeit (HA ruft hass mit neuem Thema auf): ohne Neuladen der Karte
    await open("theme=light&state=offline");
    await p.evaluate(() => { const el = document.getElementById("all"); el.hass = { ...el._hass, themes: { darkMode: true } }; });
    check(`[${tag}] Wechsel zur Laufzeit auf dunkel: Attribut "dark" gesetzt`, await p.evaluate(() => document.getElementById("all").hasAttribute("dark")));
    await p.screenshot({ path: `${outDir}/card-${tag.replace("/", "-")}-dark-novars.png`, fullPage: true });

    // Messpunkt des Pulses ("Sternschnuppe"): da und animiert; bleibt bei einer Neuzeichnung ohne Änderung dieselbe Kachel; aus bei "Animationen aus"
    await open("state=offline");
    check(`[${tag}] Puls: Messpunkt vorhanden, Animation läuft`, await p.evaluate(() => { const d = document.getElementById("all").shadowRoot.querySelector(".pchart .pdot"); return !!d && getComputedStyle(d).animationName.startsWith("pd") && getComputedStyle(d).animationDuration === "10s"; }));
    const same = await p.evaluate(() => { const el = document.getElementById("all"); const before = el.shadowRoot.querySelector(".pchart .pdot"); el._draw(); return el.shadowRoot.querySelector(".pchart .pdot") === before; });
    check(`[${tag}] Neuzeichnung ohne Änderung lässt den Messpunkt (und seine Animation) unberührt`, same);
    await open("state=offline&anim=off");
    await p.waitForTimeout(200);
    check(`[${tag}] Einstellung "Animationen" aus: kein Messpunkt`, await p.evaluate(() => { const d = document.getElementById("all").shadowRoot.querySelector(".pchart .pdot"); return getComputedStyle(d).display === "none"; }));

    // Sensor fehlt
    await open("state=missing");
    check(`[${tag}] Sensor fehlt: Hinweis statt Fehler`, (await txt("all")).includes(L.missing) && (await txt("a")).includes(L.missing));
    check(`[${tag}] keine Fehler in der Konsole`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
