// Filter "Bereich" (0.23.0, docs/mockups/area-v1, A): Chip am Anfang der
// Chip-Zeile, Auswahl nach Etage (Reihenfolge aus HA), mehrere Bereiche,
// "Ohne Bereich", Suche, kombinierbar mit den übrigen Chips, Kopf für das
// ganze Haus, pro Benutzer gespeichert. Deutsch und Englisch, Desktop
// (Popover) und Handy (Blatt), echte Klicks/Taps.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { chip: "Bereich", title: "Bereiche", noFloor: "Ohne Etage", none: "Ohne Bereich", count: "1 von 10 Bereichen", all: "Alle zeigen", many: "5 Bereiche", clear: "Filter Bereich aufheben", search: "Bereich suchen" },
  en: { chip: "Area", title: "Areas", noFloor: "No floor", none: "No area", count: "1 of 10 areas", all: "Show all", many: "5 areas", clear: "Clear area filter", search: "Search areas" },
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
    const url = `http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=${mobile ? "dark" : "light"}`;
    await p.goto(url);
    let f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wait = (code, timeout = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout }).then(() => true, () => false);
    const rows = () => ev(`return [...r.querySelectorAll(".dev")].map(x=>x.dataset.open).sort().join()`);
    const PICK = mobile ? "dialog.area-sheet" : ".area-pop";
    const isOpen = () => ev(mobile ? `return r.querySelector("dialog.area-sheet").open` : `return !r.querySelector(".area-pop").hidden`);
    const pickRows = () => ev(`return [...r.querySelectorAll("${PICK} .afloor, ${PICK} .arow")].map(x=>(x.classList.contains("afloor") ? "#" : "") + x.querySelector(".al").textContent + (x.querySelector(".an") ? ":" + x.querySelector(".an").textContent : "")).join("|")`);
    const checked = (sel) => ev(`return r.querySelector(${JSON.stringify(sel)})?.getAttribute("aria-checked")`);
    const closePick = async () => {
      if (mobile) await tap('dialog.area-sheet .dlg-actions [data-area-done]');
      else await p.keyboard.press("Escape");
      return wait(mobile ? `return !r.querySelector("dialog.area-sheet").open` : `return r.querySelector(".area-pop").hidden`);
    };
    await wait(`return !!r.querySelector('.chip[data-conn="thread"]')`);
    const total = await rows();
    const ring = await text(".ringwrap .c b");

    // Chip am Anfang der Zeile
    check(`[${tag}] Chip "${T.chip}" zuerst`, (await ev(`return r.querySelector(".chips").firstElementChild?.matches(".chip.area")`)) && (await text(".chips .chip.area")) === T.chip);
    await tap(".chips [data-area-open]");
    check(`[${tag}] Auswahl offen`, await wait(mobile ? `return r.querySelector("dialog.area-sheet").open` : `return !r.querySelector(".area-pop").hidden`));
    check(`[${tag}] Titel`, (await text(mobile ? "dialog.area-sheet h2" : ".area-pop h4")) === T.title);
    // Reihenfolge aus HA: Etagen, darunter ihre Bereiche; ohne Etage, ohne Bereich zuletzt;
    // Bereiche ohne Geräte (Garage, Estrich mit nur deaktiviertem Gerät) fehlen.
    const expected = `#Erdgeschoss|Küche:2|Wohnzimmer:2|Flur:2|Eingang:1|#Obergeschoss|Bad:1|Büro:2|Kinderzimmer:1|#Untergeschoss|Keller:3|#${T.noFloor}|Terrasse:1|${T.none}:1`;
    check(`[${tag}] Etagen und Bereiche in HA-Reihenfolge mit Zahl`, (await pickRows()) === expected, await pickRows());
    check(`[${tag}] Suche ab 9 Bereichen`, !!(await handle(`${PICK} [data-area-search]`)) && (await ev(`return r.querySelector("${PICK} [data-area-search]").placeholder`)) === T.search);
    if (!mobile) {
      const pos = await ev(`const c=r.querySelector(".chips .chip.area").getBoundingClientRect(), q=r.querySelector(".area-pop").getBoundingClientRect(); return [Math.round(q.left-c.left), Math.round(q.top-c.bottom)]`);
      check(`[${tag}] Popover unter dem Chip`, pos[0] === 0 && pos[1] === 8, JSON.stringify(pos));
    }

    // Ein Bereich: nur seine Geräte, Etage halb gewählt, Chip mit Name und Zahl
    await tap(`${PICK} [data-area="kueche"]`);
    check(`[${tag}] Küche: nur ihre Geräte`, await wait(`return [...r.querySelectorAll(".dev")].map(x=>x.dataset.open).sort().join() === "e,k"`), await rows());
    check(`[${tag}] Haken und Etage halb`, (await checked(`${PICK} [data-area="kueche"]`)) === "true" && (await checked(`${PICK} [data-area-group="f:eg"]`)) === "mixed");
    check(`[${tag}] Chip zeigt Bereich und Zahl`, (await text(".chips .chip.area .al")) === "Küche" && (await text(".chips .chip.area .n")) === "2", await text(".chips .chip.area"));
    if (!mobile) check(`[${tag}] Fusszeile zählt`, (await text(".area-pop .afoot span")) === T.count, await text(".area-pop .afoot span"));
    check(`[${tag}] Kopf zeigt weiter das ganze Haus`, (await text(".ringwrap .c b")) === ring);
    await p.screenshot({ path: `${outDir}/area-pick-${tag.replace("/", "-")}.png` });
    check(`[${tag}] schliessen`, await closePick());

    // Mit den Chips kombinieren: Zahlen und Liste innerhalb des Bereichs
    check(`[${tag}] "Alle" zählt im Bereich`, (await text('.chip[data-conn="all"] .n')) === "2" && (await text('.chip[data-conn="wifi"] .n')) === "1");
    await tap('.chip[data-conn="wifi"]');
    check(`[${tag}] Bereich + WLAN`, await wait(`return [...r.querySelectorAll(".dev")].map(x=>x.dataset.open).join() === "k"`), await rows());
    check(`[${tag}] Chip "${T.chip}" zählt mit`, (await text(".chips .chip.area .n")) === "1");
    if (mobile) await ev(`r.querySelector(".content").scrollTop = r.querySelector(".chips").offsetTop - 80`);
    await p.screenshot({ path: `${outDir}/area-list-${tag.replace("/", "-")}.png` });
    await tap('.chip[data-conn="wifi"]');
    await wait(`return r.querySelectorAll(".dev").length === 2`);

    // Etage wählt alle ihre Bereiche; Chip mit Name der Etage
    await tap(".chips [data-area-open]");
    await wait(mobile ? `return r.querySelector("dialog.area-sheet").open` : `return !r.querySelector(".area-pop").hidden`);
    await tap(`${PICK} [data-area-group="f:eg"]`);
    check(`[${tag}] Erdgeschoss: alle vier Bereiche`, await wait(`return [...r.querySelectorAll(".dev")].map(x=>x.dataset.open).sort().join() === "b,e,g,i,k,m,o"`), await rows());
    check(`[${tag}] Etage gewählt, Chip "Erdgeschoss"`, (await checked(`${PICK} [data-area-group="f:eg"]`)) === "true" && (await text(".chips .chip.area .al")) === "Erdgeschoss");
    await tap(`${PICK} [data-area="bad"]`);
    check(`[${tag}] mehr als zwei: Zahl der Bereiche`, await wait(`return r.querySelector(".chips .chip.area .al")?.textContent === ${JSON.stringify(T.many)}`), await text(".chips .chip.area .al"));
    await tap(`${PICK} [data-area-group="f:eg"]`);
    check(`[${tag}] Etage nochmals: abgewählt`, await wait(`return [...r.querySelectorAll(".dev")].map(x=>x.dataset.open).join() === "c"`), await rows());
    check(`[${tag}] ein Bereich: Name`, (await text(".chips .chip.area .al")) === "Bad");

    // Suche: Bereich oder Etage
    await tap(`${PICK} [data-area-search]`);
    await p.keyboard.type("kell");
    check(`[${tag}] Suche nach Bereich`, await wait(`return [...r.querySelectorAll("${PICK} .arow")].map(x=>x.dataset.area).join() === "keller"`), await pickRows());
    await p.keyboard.press("Control+A");
    await p.keyboard.type("ober");
    check(`[${tag}] Suche nach Etage zeigt ihre Bereiche`, await wait(`return [...r.querySelectorAll("${PICK} .arow")].map(x=>x.dataset.area).join() === "bad,buero,kinderzimmer"`), await pickRows());
    check(`[${tag}] Fokus bleibt im Suchfeld`, await ev(`return r.activeElement?.matches?.("[data-area-search]")`));
    await p.keyboard.press("Control+A");
    await p.keyboard.press("Backspace");

    // Ohne Bereich
    await tap(`${PICK} [data-area="bad"]`);
    await tap(`${PICK} [data-area="#none"]`);
    check(`[${tag}] "${T.none}"`, await wait(`return [...r.querySelectorAll(".dev")].map(x=>x.dataset.open).join() === "p"`), await rows());
    // Alle zeigen
    await tap(mobile ? 'dialog.area-sheet .dlg-actions [data-area-clear]' : ".area-pop .afoot [data-area-clear]");
    check(`[${tag}] "${T.all}" hebt auf`, await wait(`return [...r.querySelectorAll(".dev")].map(x=>x.dataset.open).sort().join() === ${JSON.stringify(total)}`) && (await text(".chips .chip.area")) === T.chip);
    if (!mobile) {
      // Klick ausserhalb schliesst und öffnet kein Gerät
      await tap('.dev[data-open="g"]');
      check(`[${tag}] Klick ausserhalb schliesst nur`, (await wait(`return r.querySelector(".area-pop").hidden`)) && !(await ev(`return r.querySelector("dialog.device").open`)));
    } else {
      await tap('dialog.area-sheet .dlg-actions [data-area-done]');
      await wait(`return !r.querySelector("dialog.area-sheet").open`);
    }

    // × auf dem Chip
    await tap(".chips [data-area-open]");
    await wait(mobile ? `return r.querySelector("dialog.area-sheet").open` : `return !r.querySelector(".area-pop").hidden`);
    await tap(`${PICK} [data-area="keller"]`);
    await closePick();
    check(`[${tag}] × mit Beschriftung`, (await ev(`return r.querySelector(".chips [data-area-clear]")?.getAttribute("aria-label")`)) === T.clear);

    // Pro Benutzer gespeichert: nach dem Neuladen wieder da
    const saved = (m) => p.evaluate((k) => (JSON.parse(sessionStorage.getItem("sim_user_data") || "{}").device_panel_view?.[k]?.areas || []).join(), m);
    const kind = mobile ? "mobile" : "desktop";
    check(`[${tag}] bei HA gespeichert`, await p.waitForFunction((k) => (JSON.parse(sessionStorage.getItem("sim_user_data") || "{}").device_panel_view?.[k]?.areas || []).join() === "keller", kind, { timeout: 5000 }).then(() => true, () => false), await saved(kind));
    check(`[${tag}] Handy und Desktop getrennt`, (await saved(mobile ? "desktop" : "mobile")) === "");
    await p.reload();
    f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    check(`[${tag}] nach Neuladen: Keller`, await wait(`return [...r.querySelectorAll(".dev")].map(x=>x.dataset.open).sort().join() === "a,h,n"`), await rows());

    // Bereich in HA gelöscht: Filter fällt weg statt leerer Liste
    await p.evaluate(() => (window.__areas = window.__areas.filter((a) => a.id !== "keller")));
    await ev(`r.host._fetch()`);
    check(`[${tag}] gelöschter Bereich: alle Geräte`, await wait(`return r.querySelectorAll(".dev").length > 3`) && (await text(".chips .chip.area")) === T.chip, await rows());
    await tap(".chips [data-area-clear], .chips [data-area-open]");

    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
