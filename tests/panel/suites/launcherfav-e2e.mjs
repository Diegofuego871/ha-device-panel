// Favicon für eigene Apps mit externem Link (2.33.0): Reiterleiste "Symbol | Favicon" im Formular, Knopf "Favicon laden" nur bei externem Link
// mit gültiger Adresse, Fehlermeldungen, Speichern in den Benutzerdaten, Anzeige statt des Symbols (Launcher, Liste, Kopfzeile, Vorschau),
// Zurück zum Symbol. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const TEXT = {
  de: { fetch: "Favicon laden", again: "Favicon neu laden", tabs: ["Symbol", "Favicon"], need: "Zuerst eine gültige Adresse eingeben (https:// oder http://).", done: "Favicon geladen. Es ersetzt das Symbol.", none: "Die Seite hat kein Favicon.", big: "Das Favicon ist zu gross (höchstens 100 KB).", down: "Die Seite ist von Home Assistant aus nicht erreichbar.", needLoad: "Bitte zuerst das Favicon laden oder ein Symbol wählen." },
  en: { fetch: "Load favicon", again: "Reload favicon", tabs: ["Icon", "Favicon"], need: "Enter a valid address first (https:// or http://).", done: "Favicon loaded. It replaces the icon.", none: "The site has no favicon.", big: "The favicon is too large (100 KB at most).", down: "The site cannot be reached from Home Assistant.", needLoad: "Please load the favicon first or choose an icon." },
};

// Reine Funktionen: nur geprüfte Bilder in den Benutzerdaten
{
  const { isFavicon, sanitizeApps } = await import("../../../custom_components/device_panel/panel/apps.js");
  check("Favicon: nur Bilder als base64-Data-URI", isFavicon(PNG) && isFavicon("data:image/svg+xml;base64,PHN2Zy8+") && isFavicon("data:image/x-icon;base64,AAABAA=="));
  check("Favicon: kein Skript, kein HTML, keine Adresse, nichts Übergrosses", !isFavicon("data:text/html;base64,PGI+") && !isFavicon("javascript:alert(1)") && !isFavicon("https://x.example/a.png") && !isFavicon("data:image/png;base64,AAAA\"onerror=\"x") && !isFavicon(`data:image/png;base64,${"A".repeat(140000)}`) && !isFavicon(null));
  const s = sanitizeApps({
    custom: [
      { id: "a", name: "Mit", icon: "web", url: "https://x.example", ext: true, favicon: PNG },
      { id: "b", name: "Intern", icon: "web", url: "/lovelace/k", ext: false, favicon: PNG },
      { id: "c", name: "Böse", icon: "web", url: "https://y.example", ext: true, favicon: "data:text/html;base64,PGI+" },
    ],
  });
  check("Bereinigen: Favicon nur bei externem Link und gültigem Bild", s.custom[0].favicon === PNG && !("favicon" in s.custom[1]) && !("favicon" in s.custom[2]));
}

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
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
    const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.innerText || "").replace(/\\s+/g," ").trim()`);
    const data = async () => JSON.parse(await ev(`return JSON.stringify(r.host._apps.data)`));
    const calls = (type) => p.evaluate((ty) => window.__wsCalls.filter((m) => m.type === ty), type);
    const D = "dialog.apps-dlg";
    const F = "dialog.app-dlg";
    const shot = (name) => p.screenshot({ path: `${outDir}/launcherfav-${name}-${lang}-${mobile ? "mobile" : "desktop"}.png` });

    await tap(".apps-btn");
    await wait(`return r.querySelector("${D}")?.open`);
    await tap(`${D} [data-ap="edit"]`);
    await tap(`${D} [data-ap="add"]`);
    await wait(`return r.querySelector("${F}")?.open`);

    // Reiterleiste Symbol | Favicon gibt es nur beim externen Link (seit 2.116.0): bei Seite und Aktion fehlt sie, es bleiben die Symbole
    check(`[${tag}] Art "Seite": keine Wahl Symbol/Favicon, nur die Symbole`, await ev(`return r.querySelector('${F} [data-f-srctabs]').hidden && r.querySelector('${F} [data-f-srctabs]').offsetHeight === 0 && r.querySelector('${F} [data-f-pane="icon"]').offsetHeight > 0 && r.querySelector('${F} [data-f-pane="favicon"]').offsetHeight === 0`));
    await tap(`${F} [data-set="fkind"][data-v="act"]`);
    check(`[${tag}] Art "Aktion": ebenfalls keine Wahl Symbol/Favicon`, await ev(`return r.querySelector('${F} [data-f-srctabs]').hidden && r.querySelector('${F} [data-f-pane="icon"]').offsetHeight > 0`));
    await tap(`${F} [data-set="fkind"][data-v="ext"]`);
    // Reiterleiste Symbol | Favicon beim externen Link
    check(`[${tag}] Art "Externer Link": Reiterleiste ${JSON.stringify(T.tabs)} mit Kapsel, "${T.tabs[0]}" gewählt, Favicon frei`, (await wait(`return !!r.querySelector("${F} .sub-tabs .seg-pill") && !r.querySelector('${F} [data-f-srctabs]').hidden`)) && JSON.stringify(await ev(`return [...r.querySelectorAll('${F} [data-set="fsrc"]')].map((e) => e.textContent)`)) === JSON.stringify(T.tabs) && (await ev(`const t = [...r.querySelectorAll('${F} [data-set="fsrc"]')]; return t[0].classList.contains("on") && !t[1].disabled && !t[1].classList.contains("on")`)));
    check(`[${tag}] Symbole sichtbar, Favicon-Bereich verborgen`, await ev(`return r.querySelector('${F} [data-f-pane="icon"]').offsetHeight > 0 && r.querySelector('${F} [data-f-pane="favicon"]').offsetHeight === 0`));
    await (await handle(`${F} [data-f="name"]`)).fill("Mein NAS");
    check(`[${tag}] externer Link an: Reiter "Favicon" frei`, await ev(`return !r.querySelector('${F} [data-set="fsrc"][data-v="favicon"]').disabled`));
    await tap(`${F} [data-set="fsrc"][data-v="favicon"]`);
    check(`[${tag}] Reiter "Favicon": Bereich mit Knopf "${T.fetch}", Symbole verborgen`, await ev(`return r.querySelector('${F} [data-f-pane="favicon"]').offsetHeight > 0 && r.querySelector('${F} [data-f-pane="icon"]').offsetHeight === 0 && r.querySelector("${F} [data-f-fetch]").textContent === ${JSON.stringify(T.fetch)}`));
    // ohne gültige Adresse: Knopf gesperrt, Hinweis nennt den Grund
    check(`[${tag}] ohne Adresse: Knopf gesperrt, Hinweis "${T.need}"`, (await ev(`return r.querySelector("${F} [data-f-fetch]").disabled`)) && (await text(`${F} [data-f-favmsg]`)) === T.need);
    await (await handle(`${F} [data-f="url"]`)).fill("javascript:alert(1)");
    check(`[${tag}] ungültige Adresse (javascript:): Knopf bleibt gesperrt`, await ev(`return r.querySelector("${F} [data-f-fetch]").disabled`));
    await (await handle(`${F} [data-f="url"]`)).fill("/config/devices");
    check(`[${tag}] Seite in HA statt Adresse: Knopf bleibt gesperrt`, await ev(`return r.querySelector("${F} [data-f-fetch]").disabled`));
    // Speichern ohne geladenes Favicon im Reiter Favicon: Hinweis
    await (await handle(`${F} [data-f="url"]`)).fill("https://nas.example/web");
    check(`[${tag}] gültige Adresse: Knopf frei`, await ev(`return !r.querySelector("${F} [data-f-fetch]").disabled`));
    await tap(`${F} [data-ap="fsave"]`);
    check(`[${tag}] Speichern ohne Favicon im Reiter "Favicon": "${T.needLoad}"`, (await text(`${F} [data-f-err]`)) === T.needLoad && (await data()).custom.length === 0);

    // Fehler: kein Favicon, zu gross, nicht erreichbar
    for (const [code, msg] of [["not_found", T.none], ["too_large", T.big], ["unreachable", T.down]]) {
      await p.evaluate((c) => { window.__faviconFail = c; }, code);
      await tap(`${F} [data-f-fetch]`);
      check(`[${tag}] Fehler ${code}: "${msg}", Knopf wieder frei, kein Favicon`, (await wait(`return !r.querySelector("${F} [data-f-fetch]").disabled && r.querySelector("${F} [data-f-favmsg]").textContent === ${JSON.stringify(msg)}`)) && (await ev(`return !r.querySelector("${F} [data-f-favimg] img")`)));
    }
    await p.evaluate(() => { window.__faviconFail = null; window.__faviconDelay = 400; window.__wsCalls = []; });
    await tap(`${F} [data-f-fetch]`);
    check(`[${tag}] beim Laden: Knopf gesperrt ("Lade …")`, await wait(`const x = r.querySelector("${F} [data-f-fetch]"); return x.disabled && /…/.test(x.textContent)`));
    check(`[${tag}] Favicon geladen: Bild im Bereich, Hinweis "${T.done}", Knopf "${T.again}", Vorschau zeigt das Bild`, (await wait(`return !!r.querySelector("${F} [data-f-favimg] img") && r.querySelector("${F} [data-f-favmsg]").textContent === ${JSON.stringify(T.done)}`)) && (await text(`${F} [data-f-fetch]`)) === T.again && (await ev(`return !!r.querySelector("${F} [data-f-prev] .ap-fi")`)));
    const fetched = (await calls("device_panel/fetch_favicon")).at(-1);
    check(`[${tag}] fetch_favicon mit der Adresse gesendet`, fetched?.url === "https://nas.example/web", JSON.stringify(fetched));
    await shot("1-formular");

    // Reiter Symbol: Vorschau zeigt wieder das Symbol, das Favicon bleibt gemerkt
    await tap(`${F} [data-set="fsrc"][data-v="icon"]`);
    check(`[${tag}] zurück zu "${T.tabs[0]}": Vorschau mit Symbol statt Bild`, await ev(`return !r.querySelector("${F} [data-f-prev] .ap-fi") && !!r.querySelector("${F} [data-f-prev] svg")`));
    await tap(`${F} [data-set="fsrc"][data-v="favicon"]`);
    check(`[${tag}] wieder "${T.tabs[1]}": das geladene Bild ist noch da`, await ev(`return !!r.querySelector("${F} [data-f-favimg] img") && !!r.querySelector("${F} [data-f-prev] .ap-fi")`));
    // Externer Link aus (Art "Seite"): Favicon-Reiter gesperrt, zurück zum Symbol
    await tap(`${F} [data-set="fkind"][data-v="page"]`);
    check(`[${tag}] externer Link aus: Wahl Symbol/Favicon weg, wieder die Symbole ("${T.tabs[0]}")`, await ev(`const t = [...r.querySelectorAll('${F} [data-set="fsrc"]')]; return r.querySelector('${F} [data-f-srctabs]').hidden && t[0].classList.contains("on") && r.querySelector('${F} [data-f-pane="icon"]').offsetHeight > 0`));
    await tap(`${F} [data-set="fkind"][data-v="ext"]`);
    await tap(`${F} [data-set="fsrc"][data-v="favicon"]`);

    // Speichern: Favicon in den Benutzerdaten, statt des Symbols
    await (await handle(`${F} [data-f="url"]`)).fill("https://nas.example/web");
    await tap(`${F} [data-ap="fsave"]`);
    let d = await data();
    check(`[${tag}] gespeichert: externer Link mit Favicon in den Benutzerdaten`, (await wait(`return !r.querySelector("${F}").open`)) && d.custom.length === 1 && d.custom[0].ext === true && d.custom[0].favicon === PNG, JSON.stringify(d.custom).slice(0, 160));
    const id = d.custom[0].id;
    check(`[${tag}] Bearbeiten-Modus: Zeile zeigt das Favicon statt des Symbols`, await ev(`const row = r.querySelector('${D} [data-ap-box="own"] .ap-erow[data-id="${id}"]'); return !!row?.querySelector(".ap-fi") && !row.querySelector(".ap-ico svg:not(.ap-fi)")`));
    await tap(`${D} [data-ap="done"]`);
    check(`[${tag}] Launcher (Kachel): Favicon statt Symbol`, await ev(`const t = r.querySelector('${D} .ap-grid [data-id="${id}"]'); return !!t?.querySelector(".ap-ico img.ap-fi") && !t.querySelector(".ap-ico svg")`));
    // Originalfarben: kein blauer Kreis hinter dem Favicon, weisse Fläche, keine Färbung durch Filter oder Deckkraft
    check(`[${tag}] Favicon in Originalfarben: Kreis ohne Hintergrund, Bild auf weisser Fläche, ohne Filter und Transparenz`, await ev(`const t = r.querySelector('${D} .ap-grid [data-id="${id}"]'); const ico = t.querySelector(".ap-ico"), img = ico.querySelector("img.ap-fi"); const a = getComputedStyle(ico), b = getComputedStyle(img); return a.backgroundColor === "rgba(0, 0, 0, 0)" && a.backgroundImage === "none" && b.backgroundColor === "rgb(255, 255, 255)" && b.filter === "none" && b.opacity === "1" && b.mixBlendMode === "normal"`));
    await shot("2-launcher");
    // Favicon wird mit gespeichert (HA)
    await p.waitForTimeout(700);
    const sc = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "frontend/set_user_data" && m.key === "device_panel_apps"));
    check(`[${tag}] bei HA gespeichert samt Favicon`, sc.length > 0 && sc.at(-1).value.custom[0].favicon === PNG);

    // Als Favorit: Kopfzeile zeigt das Favicon
    await tap(`${D} [data-ap="edit"]`);
    await tap(`${D} [data-ap-box="own"] [data-ap="fav"][data-id="${id}"]`);
    if (mobile) await tap(`${D} [data-ap-box="fav"] [data-ap-drag][data-id="${id}"]`).catch(() => {});
    check(`[${tag}] Favorit: in der Kopfzeile (${mobile ? "am Handy nur der erste, hier später" : "Desktop"}) als Verweis mit Favicon`, mobile ? (await data()).fav.includes(id) : await ev(`const a = r.querySelector('.toolbar a.app-pin'); return !!a?.querySelector("img.ap-fi") && a.target === "_blank"`));
    await tap(`${D} [data-ap="done"]`);
    // Die einzige eigene App ist Favorit und steht nur bei den Favoriten: der Abschnitt "Eigene" fehlt ganz, ein Plus gibt es nicht (2.34.0)
    const OWN = lang === "de" ? "Eigene" : "Custom";
    check(`[${tag}] einzige eigene App ist Favorit: kein Abschnitt "${OWN}", kein Plus`, await ev(`return ![...r.querySelectorAll("${D} .ap-h")].some((h) => h.textContent.includes(${JSON.stringify(OWN)})) && !r.querySelector('${D} [data-ap="add"]')`));

    // Ändern: Reiter "Favicon" ist vorgewählt, Bild da; zurück zum Symbol entfernt das Favicon
    await tap(`${D} [data-ap="edit"]`);
    await tap(`${D} [data-ap-box="${(await data()).fav.includes(id) ? "fav" : "own"}"] [data-ap="edit-app"][data-id="${id}"]`);
    await wait(`return r.querySelector("${F}")?.open`);
    check(`[${tag}] Ändern: Reiter "${T.tabs[1]}" vorgewählt, Bild da, Knopf "${T.again}"`, await ev(`return r.querySelector('${F} [data-set="fsrc"][data-v="favicon"]').classList.contains("on") && !!r.querySelector("${F} [data-f-favimg] img") && r.querySelector("${F} [data-f-fetch]").textContent === ${JSON.stringify(T.again)}`));
    await tap(`${F} [data-set="fsrc"][data-v="icon"]`);
    await tap(`${F} [data-ap="ficon"][data-icon="camera"]`);
    await tap(`${F} [data-ap="fsave"]`);
    d = await data();
    check(`[${tag}] zurück zum Symbol: Favicon entfernt, Symbol "camera"`, (await wait(`return !r.querySelector("${F}").open`)) && !("favicon" in d.custom[0]) && d.custom[0].icon === "camera", JSON.stringify(d.custom[0]));
    check(`[${tag}] Zeile zeigt wieder das Symbol`, await ev(`const row = r.querySelector('${D} .ap-erow[data-id="${id}"]'); return !!row && !row.querySelector(".ap-fi") && !!row.querySelector(".ap-ico svg")`));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
