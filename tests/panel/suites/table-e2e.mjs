// Tabelle: Laden, Zähler, Filter, Suche, Sortierung (ausgefallene zuoberst),
// Desktop und Handy, Deutsch und Englisch.
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
    total: "29 Geräte", offline: "3 ausgefallen", statusOffline: "Ausgefallen",
    head: ["Gerät", "Bereich", "Integration", "Hersteller / Modell", "Software", "Status"],
    search: "In allen Spalten suchen…",
  },
  en: {
    total: "29 devices", offline: "3 offline", statusOffline: "Offline",
    head: ["Device", "Area", "Integration", "Manufacturer / model", "Software", "Status"],
    search: "Search all columns…",
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
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll("tbody tr td:nth-child(6)").length > 1`));
    const ev = (code) => f.evaluate(new Function(`const r=${R};` + code));
    const rows = () => ev(`return [...r.querySelectorAll("tbody tr")].map(tr=>[...tr.children].map(td=>td.innerText.trim()))`);

    let all = await rows();
    check(`[${tag}] Dienst-Geräte ausgeblendet: 29 Zeilen`, all.length === 29, String(all.length));
    check(`[${tag}] Ausgefallene zuoberst`, all.slice(0, 3).every((r) => r[5] === T.statusOffline) && all[3][5] !== T.statusOffline, JSON.stringify(all.slice(0, 4).map((r) => r[5])));
    const stats = await ev(`return r.querySelector(".stats").innerText.replace(/\\s+/g," ")`);
    check(`[${tag}] Zähler`, stats.includes(T.total) && stats.includes(T.offline), stats);
    check(`[${tag}] Softwarestand sichtbar`, all.some((r) => r[4].startsWith("1.")));

    // textContent statt innerText: Die Kopfzeile ist per CSS in Grossbuchstaben.
    const head = await ev(`return [...r.querySelectorAll("thead th")].map(th=>th.textContent.trim())`);
    check(`[${tag}] Spaltenköpfe`, JSON.stringify(head) === JSON.stringify(T.head), JSON.stringify(head));
    const placeholder = await ev(`return r.querySelector(".search").placeholder`);
    check(`[${tag}] Suchfeld`, placeholder === T.search, placeholder);
    // Fehlt ein Schlüssel in einer Sprache, landet "undefined" im Panel.
    const undef = await ev(`return r.innerHTML.includes("undefined")`);
    check(`[${tag}] kein fehlender Text`, !undef);
    await p.screenshot({ path: `${outDir}/table-${lang}-${mobile ? "mobile" : "desktop"}.png` });

    await ev(`r.querySelector('[data-filter="offline"]').click()`);
    all = await rows();
    check(`[${tag}] Filter ausgefallen`, all.length === 3 && all.every((r) => r[5] === T.statusOffline));
    await ev(`r.querySelector('[data-filter="all"]').click()`);

    await ev(`const s=r.querySelector(".search"); s.value="küche"; s.dispatchEvent(new Event("input"))`);
    all = await rows();
    check(`[${tag}] Suche nach Bereich`, all.length > 0 && all.every((r) => r[1] === "Küche"), String(all.length));

    const over = await ev(`return document.documentElement.scrollWidth - innerWidth`);
    check(`[${tag}] kein Überlauf der Seite`, over <= 1, String(over));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
