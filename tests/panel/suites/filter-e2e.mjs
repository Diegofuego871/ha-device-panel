// Filter oben in der Liste: Chip-Zahlen zählen mit Suche und übrigen Filtern
// (Zahl = Zeilen nach dem Antippen), aktiver Chip abwählbar, X im Suchfeld,
// Chip "Batterie" mit Sortierung nach Stand, Kopf-Kacheln gleich hoch,
// Prozent erst ab 1 Std. Daten. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { clear: "Suche löschen", batteries: "Batterie", pctWait: "Prozent ab 1 Std. Daten" },
  en: { clear: "Clear search", batteries: "Battery", pctWait: "Percent after 1 h of data" },
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
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const rows = () => ev(`return r.querySelectorAll(".dev").length`);
    const chipN = (sel) => ev(`return Number(r.querySelector(${JSON.stringify(sel)})?.querySelector(".n")?.textContent)`);
    const onChips = () => ev(`return [...r.querySelectorAll(".chip.on")].map(c=>c.dataset.conn || c.dataset.hint || "problems").join()`);
    // Matter-Geräte werden nach dem Laden zu Thread; erst dann zählen.
    await wait(`return !!r.querySelector('.chip[data-conn="thread"]')`);
    const total = await rows();

    // Kopf-Kacheln gleich hoch
    const heights = await ev(`return [...r.querySelectorAll(".hero .kt")].map(k=>Math.round(k.getBoundingClientRect().height))`);
    // Handy (seit 1.26.0): "Verfügbarkeit" und "Gerade ausgefallen" gleich hoch, der Puls ist eine schlanke Zeile
    const same = mobile ? heights.slice(0, 2) : heights;
    check(`[${tag}] Kopf-Kacheln gleich hoch`, heights.length === 3 && Math.max(...same) - Math.min(...same) <= 1 && (!mobile || heights[2] <= 80), JSON.stringify(heights));
    await p.screenshot({ path: `${outDir}/filter-hero-${tag.replace("/", "-")}.png` });

    // X im Suchfeld: erst mit Eingabe sichtbar
    check(`[${tag}] X ohne Eingabe verborgen`, await ev(`return r.querySelector(".search-clear").hidden`));
    await tap(".search");
    await p.keyboard.type("Flur");
    check(`[${tag}] Suche filtert`, await wait(`return r.querySelectorAll(".dev").length === 2`), String(await rows()));
    check(`[${tag}] X sichtbar mit Bezeichnung`, await ev(`const x=r.querySelector(".search-clear"); return !x.hidden && x.getAttribute("aria-label") === ${JSON.stringify(T.clear)}`));

    // Zahlen auf den Chips folgen der Suche: Zahl = Zeilen nach dem Antippen,
    // erneutes Antippen hebt den Filter auf.
    check(`[${tag}] Alle zählt die Treffer`, (await chipN('.chip[data-conn="all"]')) === 2, String(await chipN('.chip[data-conn="all"]')));
    check(`[${tag}] Chip ohne Treffer gedämpft`, await ev(`return r.querySelector('.chip[data-conn="wifi"]').classList.contains("zero") && r.querySelector('.chip[data-conn="wifi"] .n').textContent === "0"`));
    const sels = await ev(`return [...r.querySelectorAll('.chip[data-conn]:not([data-conn="all"]), .chip[data-hint]')].map(c=>c.dataset.conn ? '.chip[data-conn="'+c.dataset.conn+'"]' : '.chip[data-hint="'+c.dataset.hint+'"]')`);
    const wrong = [];
    for (const sel of sels) {
      const n = await chipN(sel);
      await tap(sel);
      await wait(`return r.querySelector(${JSON.stringify(sel)}).classList.contains("on")`);
      if ((await rows()) !== n) wrong.push(`${sel}: Chip ${n}, Zeilen ${await rows()}`);
      await tap(sel);
      if (!(await wait(`return !r.querySelector(${JSON.stringify(sel)}).classList.contains("on")`))) wrong.push(`${sel}: bleibt aktiv`);
    }
    check(`[${tag}] ${sels.length} Chips: Zahl = Zeilen, zweiter Tipp wählt ab`, wrong.length === 0 && sels.length >= 6, wrong.join("; "));
    check(`[${tag}] danach wieder Alle`, (await onChips()) === "all", await onChips());

    // Mit aktivem Chip zählen die Hinweise nur noch dessen Geräte
    await tap('.chip[data-conn="zigbee"]');
    await wait(`return r.querySelector('.chip[data-conn="zigbee"]').classList.contains("on")`);
    const zb = await chipN('.chip[data-hint="batteries"]');
    await tap('.chip[data-conn="zigbee"]');
    check(`[${tag}] Hinweis zählt mit Verbindungsfilter`, zb === 2, String(zb));

    // X löscht die Eingabe
    await tap(".search-clear");
    check(`[${tag}] X löscht die Suche`, await wait(`return r.querySelector(".search").value === "" && r.querySelector(".search-clear").hidden && r.querySelectorAll(".dev").length === ${total}`), String(await rows()));
    check(`[${tag}] Zahlen wieder für alle`, (await chipN('.chip[data-conn="all"]')) === total);

    // Chip "Batterie": alle Batteriegeräte, je Gruppe nach Stand
    check(`[${tag}] Chip Batterie`, (await ev(`return r.querySelector('.chip[data-hint="batteries"] span:not(.n)').textContent`)) === T.batteries);
    await tap('.chip[data-hint="batteries"]');
    check(`[${tag}] nur Batteriegeräte`, await wait(`return r.querySelectorAll(".dev").length === 7`), String(await rows()));
    const groups = await ev(`
      const out = []; let cur = null;
      for (const el of r.querySelectorAll(${JSON.stringify(mobile ? ".gh, .dev" : "tr.grp, tr.dev")})) {
        if (!el.classList.contains("dev")) { cur = []; out.push(cur); continue; }
        const t = el.querySelector(".bat")?.textContent || "";
        cur.push(Number((t.match(/(\\d+) %/) || [])[1]));
      }
      return out;`);
    const sorted = groups.every((g) => g.every((v, i) => !Number.isNaN(v) && (i === 0 || g[i - 1] <= v)));
    check(`[${tag}] Stand bei jedem Gerät, je Gruppe aufsteigend`, sorted && groups.flat().length === 7, JSON.stringify(groups));
    await p.screenshot({ path: `${outDir}/filter-battery-${tag.replace("/", "-")}.png` });
    await tap('.chip[data-hint="batteries"]');
    check(`[${tag}] Batterie abgewählt`, await wait(`return r.querySelectorAll(".dev").length === ${total}`));

    // Prozent erst ab 1 Std. Daten (Gerät k: 40 Min. im Protokoll)
    if (!mobile) {
      const cell = await ev(`const c=r.querySelector('tr[data-open="k"]').children[3]; return c.textContent.trim() + "|" + (c.querySelector("[title]")?.title || "")`);
      check(`[${tag}] Liste: – statt Prozent`, cell === `–|${T.pctWait}`, cell);
    }
    await tap(mobile ? '.mrow[data-open="k"]' : 'tr[data-open="k"]');
    await wait(`return !!r.querySelector('dialog.device .st-tile[data-range="24h"]')`);
    const tile = await ev(`const t=r.querySelector('dialog.device .st-tile[data-range="24h"]'); return t.querySelector(".st-v").textContent.trim() + "|" + t.querySelector(".st-sub").textContent.trim()`);
    check(`[${tag}] Popup: – mit Hinweis`, tile === `–|${T.pctWait}`, tile);
    await tap('dialog.device .st-tile[data-range="24h"]');
    await wait(`return !!r.querySelector("dialog.stat-dlg .avail-pct")`);
    const stat = await ev(`return r.querySelector("dialog.stat-dlg .avail-pct").textContent.trim() + "|" + r.querySelector("dialog.stat-dlg .avail-facts").textContent`);
    check(`[${tag}] Statistik: – mit Hinweis`, stat.startsWith("–|") && stat.includes(T.pctWait), stat);

    check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
