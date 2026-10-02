// Geräteliste (Design C): Kopf mit Kennzahlen und Ausfall-Puls, Chips,
// Gruppen, Spalten Typ/Integration/Verfügbarkeit, Filter, Suche, Funkart von
// Matter, fixierte erste Spalte; Desktop (Tabelle) und Handy (Karten),
// Deutsch und Englisch.
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
    longest: "längster seit ≥ 3 T. 4 Std.", atLeast: "Mindestens seit ", since: "Ausgefallen seit ", lines: ["9 stabil", "2 instabil", "4 ausgefallen", "1 ohne Daten"], avg: "Ø 24 Std.",
    pulse: "Ausfall-Puls · 24 Std.", incident: "Sammelausfall", incidentText: "3 Geräte gleichzeitig, alle über Zigbee Home Automation.",
    hints: ["Batterie niedrig 2", "Schwacher Empfang 3", "Update verfügbar 2"],
    groups: ["Ausgefallen · 4", "Instabil · 2", "Keine Daten · 1", "Online · 9"], statusOffline: "ausgefallen", wifi: "WLAN", thread: "Thread",
    head: ["Gerät", "Status", "Verbindung", "Verfügbarkeit 24 Std.", "Typ", "Integration", "Batterie", "Hersteller / Modell", "Software"],
    problems: "Nur Probleme", footer: "16 von 16 Geräten", tap: "Antippen für Details", via: "über Steckdose Flur",
    type: "Bewegung / Präsenz", flaky: "Instabil", flakyCount: "5× in 24 Std.", climate: "klima",
  },
  en: {
    title: "Devices", search: "Search all columns…", ofTotal: "of 16 online", offlineNow: "Offline right now",
    longest: "longest for ≥ 3 d 4 h", atLeast: "At least since ", since: "Offline since ", lines: ["9 stable", "2 unstable", "4 offline", "1 without data"], avg: "avg. 24 h",
    pulse: "Outage pulse · 24 h", incident: "Group outage", incidentText: "3 devices at once, all via Zigbee Home Automation.",
    hints: ["Low battery 2", "Weak signal 3", "Update available 2"],
    groups: ["Offline · 4", "Unstable · 2", "No data · 1", "Online · 9"], statusOffline: "offline", wifi: "Wi-Fi", thread: "Thread",
    head: ["Device", "Status", "Connection", "Availability 24 h", "Type", "Integration", "Battery", "Manufacturer / model", "Software"],
    problems: "Problems only", footer: "16 of 16 devices", tap: "Tap for details", via: "via Steckdose Flur",
    type: "Motion / presence", flaky: "Unstable", flakyCount: "5× in 24 h", climate: "climate",
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
    const search = (text) => ev(`const s=r.querySelector(".search"); s.value=${JSON.stringify(text)}; s.dispatchEvent(new Event("input"))`);

    // Kopf
    check(`[${tag}] Titel`, (await ev(`return r.querySelector(".toolbar h1").textContent`)) === T.title);
    check(`[${tag}] Suchfeld`, (await ev(`return r.querySelector(".search").placeholder`)) === T.search);
    const hero = await ev(`return r.querySelector(".hero").textContent.replace(/\\s+/g," ")`);
    check(`[${tag}] Ring 11 ${T.ofTotal}`, hero.includes("11") && hero.includes(T.ofTotal), hero.slice(0, 120));
    const lines = await ev(`return [...r.querySelectorAll(".lines div")].map(d=>d.textContent.trim())`);
    check(`[${tag}] Zeilen stabil/instabil/ausgefallen/ohne Daten`, JSON.stringify(lines) === JSON.stringify(T.lines), JSON.stringify(lines));
    check(`[${tag}] Kennzahl Ø 24 Std.`, (await ev(`return r.querySelector(".kt .pct").textContent`)).includes(T.avg));
    check(`[${tag}] Ausfall-Tafel`, hero.includes(T.offlineNow) && hero.includes(T.longest), hero);
    check(`[${tag}] Ausfall vor Neustart als "mindestens"`, await ev(`return [...r.querySelectorAll(".olist b")][0].textContent.startsWith("≥")`));
    // Tooltip mit dem Beginn: "mindestens" mit Grund, sonst der Zeitpunkt
    const tips = await ev(`return [...r.querySelectorAll(".olist b > span")].map(s=>s.title)`);
    check(`[${tag}] Tooltip mit Beginn`, tips.length === 4 && tips[0].startsWith(T.atLeast) && tips[0].includes("Home Assistant") && tips.slice(1).every((x) => x.startsWith(T.since) && /\d/.test(x)), JSON.stringify(tips));
    const pulse = await ev(`return r.querySelector(".kt.pul")?.textContent.replace(/\\s+/g," ") || ""`);
    check(`[${tag}] Ausfall-Puls mit Sammelausfall`, pulse.includes(T.pulse) && pulse.includes(T.incident) && pulse.includes(T.incidentText), pulse);
    check(`[${tag}] Puls-Kurve und Marke`, await ev(`return !!r.querySelector(".pchart path.line") && r.querySelectorAll(".pchart .imark").length === 1`));

    // Hinweise als Chips
    const hints = await ev(`return [...r.querySelectorAll(".chip.hint")].map(b=>b.textContent.replace(/\\s+/g," ").trim())`);
    check(`[${tag}] Hinweis-Chips 2/3/2`, JSON.stringify(hints) === JSON.stringify(T.hints), JSON.stringify(hints));

    // Gruppen und Reihenfolge
    const groups = await ev(`return [...r.querySelectorAll("${mobile ? ".gh" : "tr.grp"}")].map(g=>g.textContent.replace(/\\s+/g," ").trim())`);
    check(`[${tag}] Gruppen`, T.groups.length === groups.length && T.groups.every((g, i) => groups[i]?.startsWith(g)), JSON.stringify(groups));
    const names = await ev(`return [...r.querySelectorAll(".dev")].map(d=>d.textContent)`);
    check(`[${tag}] längster Ausfall zuerst`, names[0].includes("Temperatur Keller") && names[3].includes("Steckdose Terrasse"), names[0]);
    check(`[${tag}] Instabil: meiste Unterbrüche zuerst`, names[4].includes("Fensterkontakt Küche") && names[5].includes("Präsenzsensor Büro"), names[4]);
    check(`[${tag}] 16 Geräte (Dienst und ohne Entitäten ausgeblendet)`, (await count()) === 16, String(await count()));
    if (!mobile) {
      const head = await ev(`return [...r.querySelectorAll("thead th")].map(th=>th.textContent.trim())`);
      check(`[${tag}] Spaltenköpfe`, JSON.stringify(head) === JSON.stringify(T.head), JSON.stringify(head));
      check(`[${tag}] ausgefallene Zeilen rot`, await ev(`return [...r.querySelectorAll("tr.dev")].slice(0,4).every(t=>t.classList.contains("off"))`));
      const row2 = await ev(`return r.querySelectorAll("tr.dev")[1].textContent.replace(/\\s+/g," ")`);
      check(`[${tag}] Zeile mit Dauer, Empfang, Hub, Update`, row2.includes(T.statusOffline) && row2.includes("LQI 38") && row2.includes(T.via) && row2.includes("Update"), row2);
      check(`[${tag}] Zeile mit Typ, Integration und Eintrag`, row2.includes(T.type) && row2.includes("Zigbee Home Automation") && row2.includes("Funkstick Erdgeschoss"), row2);
      check(`[${tag}] Verfügbarkeit 24 Std. mit Streifen`, /90[.,]2 %/.test(row2) && (await ev(`return r.querySelectorAll("tr.dev")[1].querySelectorAll("svg.strip rect").length`)) === 48, row2);
      check(`[${tag}] Eintragstitel gleich Name ausgeblendet (Matter)`, (await ev(`return r.querySelectorAll("tr.dev")[2].children[5].textContent.trim()`)) === "Matter");
      const flaky = await ev(`return [...r.querySelectorAll("tr.dev.flaky")].map(t=>t.textContent.replace(/\\s+/g," "))`);
      check(`[${tag}] instabile Zeilen`, flaky.length === 2 && flaky[0].includes(T.flaky) && flaky[0].includes(T.flakyCount), JSON.stringify(flaky));
    } else {
      check(`[${tag}] Karten für ausgefallene`, (await ev(`return r.querySelectorAll(".mc.off").length`)) === 4);
      check(`[${tag}] Karten für instabile`, (await ev(`return r.querySelectorAll(".mc.flaky").length`)) === 2);
      const meta = await ev(`return r.querySelectorAll(".mc .sb2")[1].textContent`);
      check(`[${tag}] Karte mit Typ und Integration`, meta.includes(T.type) && meta.includes("Zigbee Home Automation"), meta);
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
    check(`[${tag}] Hinweis Batterie filtert`, (await count()) === 2 && (await ev(`return r.querySelector('[data-hint="battery"]').classList.contains("on")`)));
    await tap('[data-hint="battery"]');
    check(`[${tag}] Hinweis wieder aus`, (await count()) === 16);
    await tap("[data-problems]");
    check(`[${tag}] ${T.problems} (inkl. instabil)`, (await count()) === 7, String(await count()));
    await tap("[data-problems]");
    await search("küche");
    check(`[${tag}] Suche nach Bereich`, (await count()) === 2, String(await count()));
    await search("funkstick");
    check(`[${tag}] Suche nach Integrationseintrag`, (await count()) === 5, String(await count()));
    await search(T.climate);
    check(`[${tag}] Suche nach Typ`, (await count()) === 2, String(await count()));
    await search("");
    const foot = await ev(`return r.querySelector(".foot").textContent`);
    check(`[${tag}] Fusszeile`, foot.startsWith(T.footer) && foot.includes(T.tap), foot);

    // Breite Tabelle: seitlich scrollen, erste Spalte und Kopf bleiben stehen
    if (!mobile) {
      await p.setViewportSize({ width: 900, height: 900 });
      await p.waitForTimeout(150);
      const before = await ev(`return [r.querySelector(".hero").getBoundingClientRect().left, r.querySelector("tr.dev td").getBoundingClientRect().left]`);
      const wide = await ev(`const c=r.querySelector(".content"); return c.scrollWidth > c.clientWidth`);
      await ev(`r.querySelector(".content").scrollLeft = 300`);
      await p.waitForTimeout(100);
      const after = await ev(`return [r.querySelector(".hero").getBoundingClientRect().left, r.querySelector("tr.dev td").getBoundingClientRect().left, r.querySelector("tr.dev td:nth-child(2)").getBoundingClientRect().left]`);
      check(`[${tag}] Tabelle breiter als Panel`, wide);
      check(`[${tag}] Kopf bleibt beim seitlichen Scrollen`, Math.abs(after[0] - before[0]) < 1, JSON.stringify([before, after]));
      check(`[${tag}] erste Spalte fixiert`, after[1] <= 1 && after[1] > -2 && after[2] < before[1] + 200, JSON.stringify([before, after]));
      await ev(`r.querySelector(".content").scrollLeft = 0`);
      await p.setViewportSize({ width: 1400, height: 900 });
    }

    check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
    const over = await ev(`return document.documentElement.scrollWidth - innerWidth`);
    check(`[${tag}] kein Überlauf der Seite`, over <= 1, String(over));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
