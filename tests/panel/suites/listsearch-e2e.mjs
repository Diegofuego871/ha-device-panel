// Suchfeld in langen Listen der Einstellungen (1.28.0, docs/mockups/settings-search-v1, A): ab 8
// Einträgen über der Liste (Integrationen, Typen, Überwachung › Integrationen, Verbindungsart),
// filtert sofort mit Trefferzahl, "Keine Treffer.", bleibt nach einem Neuaufbau erhalten.
// Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = { de: { of: "1 von 9", none: "Keine Treffer.", ph: "Suchen …" }, en: { of: "1 of 9", none: "No matches.", ph: "Search …" } };
for (const lang of ["de", "en"]) for (const mobile of [false, true]) {
  const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
  const ctx = await b.newContext(mobile ? { viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
  const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
  const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
  const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
  const wait = (c) => f.waitForFunction(new Function(`const r=${R};` + c), null, { timeout: 5000 }).then(() => true, () => false);
  const type = async (key, text) => { const h = await handle(`input[data-lsearch="${key}"]`); await h.scrollIntoViewIfNeeded(); await h.fill(text); };
  const visible = (key) => ev(`const w=r.querySelector('.srch-rows[data-srch="${key}"]'); return [...w.children].filter(e=>e.matches(".ex-row, .ilist-row, .ovr-row") && !e.hidden).length`);
  const count = (key) => ev(`return r.querySelector('.list-search[data-for="${key}"] .n').textContent`);
  await tap(".gear-btn");
  await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
  await tap('[data-set="section"][data-id="devices"]');

  // Integrationen
  check(`[${tag}] Suchfeld über der Liste der Integrationen`, await ev(`const i=r.querySelector('input[data-lsearch="exclude_integrations"]'); return !!i && i.placeholder === ${JSON.stringify(T[lang].ph)}`));
  await type("exclude_integrations", "shelly");
  check(`[${tag}] filtert: eine Zeile, Trefferzahl`, (await visible("exclude_integrations")) === 1 && (await count("exclude_integrations")) === T[lang].of, `${await visible("exclude_integrations")} / ${await count("exclude_integrations")}`);
  await ev(`r.querySelector('.srch-rows[data-srch="exclude_integrations"] input[type=checkbox]:not([hidden])') ; 0`);
  // Neuaufbau (Schalter umlegen): Filter bleibt
  await tap('input[data-list="exclude_integrations"][data-value="shelly"]');
  check(`[${tag}] nach Neuaufbau noch gefiltert`, (await visible("exclude_integrations")) === 1 && await ev(`return r.querySelector('input[data-lsearch="exclude_integrations"]').value === "shelly"`));
  await tap('input[data-list="exclude_integrations"][data-value="shelly"]');
  await type("exclude_integrations", "gibtesnicht");
  check(`[${tag}] keine Treffer`, (await visible("exclude_integrations")) === 0 && (await ev(`return r.querySelector('.srch-rows[data-srch="exclude_integrations"] .srch-none').hidden`)) === false && (await ev(`return r.querySelector('.srch-rows[data-srch="exclude_integrations"] .srch-none').textContent`)) === T[lang].none);
  await p.screenshot({ path: `${outDir}/listsearch-${tag.replace("/", "-")}.png` });
  // X im Suchfeld (1.35.0): sichtbar mit Eingabe, leert und blendet sich aus
  check(`[${tag}] Suchfeld mit Eingabe: X sichtbar`, await ev(`const x=r.querySelector('[data-lclear="exclude_integrations"]'); return !!x && !x.hidden`));
  await tap('[data-lclear="exclude_integrations"]');
  check(`[${tag}] X leert: alles sichtbar, Zähler weg, X weg`, (await visible("exclude_integrations")) === 9 && (await count("exclude_integrations")) === "" && (await ev(`return r.querySelector('input[data-lsearch="exclude_integrations"]').value === "" && r.querySelector('[data-lclear="exclude_integrations"]').hidden`)));
  await type("exclude_integrations", "zig");
  await type("exclude_integrations", "");
  check(`[${tag}] von Hand geleert: X weg`, await ev(`return r.querySelector('[data-lclear="exclude_integrations"]').hidden`));
  await type("exclude_integrations", "");
  check(`[${tag}] leeren zeigt alles, Zähler weg`, (await visible("exclude_integrations")) === 9 && (await count("exclude_integrations")) === "");

  // Typen
  await tap('[data-set="subtab"][data-key="types"]');
  await type("exclude_types", lang === "de" ? "steck" : "outlet");
  check(`[${tag}] Typen: Steckdose gefunden`, (await visible("exclude_types")) >= 1 && (await visible("exclude_types")) <= 2, String(await visible("exclude_types")));

  // Geräte (leer): kein Feld
  await tap('[data-set="subtab"][data-key="devs"]');
  check(`[${tag}] ohne Liste kein Suchfeld`, await ev(`return !r.querySelector('input[data-lsearch="exclude_devices"]')`));

  // Überwachung › Integrationen
  await tap('[data-set="section"][data-id="monitor"]');
  await tap('.mon-tab[data-key="integ"]');
  await wait(`return !!r.querySelector('input[data-lsearch="integ"]')`);
  await type("integ", "hue");
  check(`[${tag}] Überwachung › Integrationen filtert`, (await visible("integ")) === 1, String(await visible("integ")));

  // Darstellung › Verbindungsart
  await tap('[data-set="section"][data-id="look"]');
  await wait(`return !!r.querySelector('input[data-lsearch="conn"]')`);
  await type("conn", "esphome");
  check(`[${tag}] Verbindungsart pro Integration filtert`, (await visible("conn")) === 1, String(await visible("conn")));
  check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
  check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
