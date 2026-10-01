// Geräteliste (Design C): Kopf mit Kennzahlen, Chips, Gruppen, Filter, Suche,
// Funkart von Matter, Desktop (Tabelle) und Handy (Karten), Deutsch und Englisch.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

// Erwartete Texte bewusst ausgeschrieben statt aus strings.js gelesen:
// So fällt auch ein falscher oder fehlender Text auf.
const TEXT = {
  de: {
    title: "Geräte", search: "In allen Spalten suchen…", ofTotal: "von 16 online", offlineNow: "Gerade ausgefallen",
    longest: "längster seit 3 T. 4 Std.", hints: ["Batterie niedrig", "Schwacher Empfang", "Update verfügbar"],
    groups: ["Ausgefallen · 4", "Keine Daten · 1", "Online · 11"], statusOffline: "ausgefallen", wifi: "WLAN", thread: "Thread",
    head: ["Gerät", "Status", "Verbindung", "Batterie", "Integration", "Hersteller / Modell", "Software"],
    problems: "Nur Probleme", footer: "16 von 16 Geräten", via: "über Steckdose Flur",
  },
  en: {
    title: "Devices", search: "Search all columns…", ofTotal: "of 16 online", offlineNow: "Offline right now",
    longest: "longest for 3 d 4 h", hints: ["Low battery", "Weak signal", "Update available"],
    groups: ["Offline · 4", "No data · 1", "Online · 11"], statusOffline: "offline", wifi: "Wi-Fi", thread: "Thread",
    head: ["Device", "Status", "Connection", "Battery", "Integration", "Manufacturer / model", "Software"],
    problems: "Problems only", footer: "16 of 16 devices", via: "via Steckdose Flur",
  },
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
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
    const ev = (code) => f.evaluate(new Function(`const r=${R};` + code));
    const tap = async (sel) => {
      const el = await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`));
      if (mobile) await el.asElement().tap(); else await el.asElement().click();
    };
    const count = () => ev(`return r.querySelectorAll(".dev").length`);

    // Kopf
    check(`[${tag}] Titel`, (await ev(`return r.querySelector(".toolbar h1").textContent`)) === T.title);
    check(`[${tag}] Suchfeld`, (await ev(`return r.querySelector(".search").placeholder`)) === T.search);
    const hero = await ev(`return r.querySelector(".hero").textContent.replace(/\\s+/g," ")`);
    check(`[${tag}] Ring 11 ${T.ofTotal}`, hero.includes("11") && hero.includes(T.ofTotal), hero.slice(0, 120));
    check(`[${tag}] Ausfall-Tafel`, hero.includes(T.offlineNow) && hero.includes(T.longest), hero);
    check(`[${tag}] Ausfall vor Neustart als "mindestens"`, await ev(`return [...r.querySelectorAll(".olist b")][0].textContent.startsWith("≥")`));
    const hints = await ev(`return [...r.querySelectorAll(".hintlist button")].map(b=>[...b.children].map(c=>c.textContent.trim()).filter(Boolean).join(" "))`);
    check(`[${tag}] Hinweise 2/3/2`, JSON.stringify(hints) === JSON.stringify([`${T.hints[0]} 2`, `${T.hints[1]} 3`, `${T.hints[2]} 2`]), JSON.stringify(hints));

    // Gruppen und Reihenfolge
    const groups = await ev(`return [...r.querySelectorAll("${mobile ? ".gh" : "tr.grp"}")].map(g=>g.textContent.replace(/\\s+/g," ").trim())`);
    check(`[${tag}] Gruppen`, T.groups.every((g, i) => groups[i]?.startsWith(g)), JSON.stringify(groups));
    const names = await ev(`return [...r.querySelectorAll(".dev")].map(d=>d.textContent)`);
    check(`[${tag}] längster Ausfall zuerst`, names[0].includes("Temperatur Keller") && names[3].includes("Steckdose Terrasse"), names[0]);
    check(`[${tag}] 16 Geräte (Dienst und ohne Entitäten ausgeblendet)`, (await count()) === 16, String(await count()));
    if (!mobile) {
      const head = await ev(`return [...r.querySelectorAll("thead th")].map(th=>th.textContent.trim())`);
      check(`[${tag}] Spaltenköpfe`, JSON.stringify(head) === JSON.stringify(T.head), JSON.stringify(head));
      check(`[${tag}] ausgefallene Zeilen rot`, await ev(`return [...r.querySelectorAll("tr.dev")].slice(0,4).every(t=>t.classList.contains("off"))`));
      const row2 = await ev(`return r.querySelectorAll("tr.dev")[1].textContent.replace(/\\s+/g," ")`);
      check(`[${tag}] Zeile mit Dauer, Empfang, Hub, Update`, row2.includes(T.statusOffline) && row2.includes("LQI 38") && row2.includes(T.via) && row2.includes("Update"), row2);
    } else {
      check(`[${tag}] Karten für ausgefallene`, (await ev(`return r.querySelectorAll(".mc.off").length`)) === 4);
    }

    // Matter: Funkart aus matter/node_diagnostics
    await f.waitForFunction(new Function(`return ${R}.textContent.includes("${T.thread}")`), null, { timeout: 5000 }).catch(() => {});
    const matterCalls = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "matter/node_diagnostics").length);
    check(`[${tag}] Matter-Geräte als Thread`, matterCalls === 2 && (await ev(`return r.querySelector(".chips").textContent.includes("${T.thread}")`)), String(matterCalls));
    await p.screenshot({ path: `${outDir}/list-${lang}-${mobile ? "mobile" : "desktop"}.png` });

    // Chips, Hinweise, Nur Probleme, Suche
    await tap('[data-conn="zigbee"]');
    check(`[${tag}] Chip Zigbee`, (await count()) === 5, String(await count()));
    await tap('[data-conn="wifi"]');
    check(`[${tag}] Chip ${T.wifi}`, (await count()) === 4 && (await ev(`return r.querySelector('[data-conn="wifi"]').textContent.includes("${T.wifi}")`)));
    await tap('[data-conn="all"]');
    await tap('[data-hint="battery"]');
    check(`[${tag}] Hinweis Batterie filtert`, (await count()) === 2 && (await ev(`return !!r.querySelector("[data-clear]")`)));
    await tap("[data-clear]");
    check(`[${tag}] Filter aufgehoben`, (await count()) === 16);
    await tap("[data-problems]");
    check(`[${tag}] ${T.problems}`, (await count()) === 5, String(await count()));
    await tap("[data-problems]");
    await ev(`const s=r.querySelector(".search"); s.value="küche"; s.dispatchEvent(new Event("input"))`);
    check(`[${tag}] Suche nach Bereich`, (await count()) === 2, String(await count()));
    await ev(`const s=r.querySelector(".search"); s.value=""; s.dispatchEvent(new Event("input"))`);
    check(`[${tag}] Fusszeile`, (await ev(`return r.querySelector(".foot").textContent`)).startsWith(T.footer));

    check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
    const over = await ev(`return document.documentElement.scrollWidth - innerWidth`);
    check(`[${tag}] kein Überlauf der Seite`, over <= 1, String(over));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
