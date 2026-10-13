// App-Launcher (2.31.0, docs/mockups/launcher-v2): Knopf in der Kopfzeile, Favoriten (höchstens fünf, am Handy nur der erste in der
// Kopfzeile), Raster und Liste (getrennt für Desktop und Handy), Bearbeiten-Modus (Auge, Herz, Ziehen), eigene Apps (Seite in HA
// oder externer Link in neuem Tab), Protokoll nur hier, Rückgängig, Rechte (Nicht-Administratoren), Speichern pro Benutzer.
// Deutsch und Englisch, Desktop und Handy, echte Klicks und Tipps.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: {
    title: "Apps", edit: "Bearbeiten", editTitle: "Apps bearbeiten", groups: ["Favoriten", "Device Panel", "Home Assistant", "Eigene"],
    max: "Höchstens 5 Favoriten. Nimm zuerst einen anderen heraus.", none: "Keine Treffer.", auto: "Automationen", timerPin: "Timer",
    errName: "Bitte einen Namen eingeben.", errPage: 'Die Seite muss mit "/" beginnen, zum Beispiel /config/automation/dashboard.',
    errExt: "Die Adresse muss mit https:// oder http:// beginnen.", labelPage: "Seite in Home Assistant", labelAddr: "Adresse",
    formNew: "Eigene App", formEdit: "Eigene App ändern", resetDone: "Auf Standard zurückgesetzt.", undo: "Rückgängig", removed: "Kamera Eingang gelöscht.",
    grid: "Raster", list: "Liste",
  },
  en: {
    title: "Apps", edit: "Edit", editTitle: "Edit apps", groups: ["Favorites", "Device Panel", "Home Assistant", "Custom"],
    max: "At most 5 favorites. Remove another one first.", none: "No matches.", auto: "Automations", timerPin: "Timers",
    errName: "Please enter a name.", errPage: 'The page must start with "/", for example /config/automation/dashboard.',
    errExt: "The address must start with https:// or http://.", labelPage: "Page in Home Assistant", labelAddr: "Address",
    formNew: "Custom app", formEdit: "Edit custom app", resetDone: "Reset to default.", undo: "Undo", removed: "Kamera Eingang deleted.",
    grid: "Grid", list: "List",
  },
};

// Reine Funktionen: Ziel prüfen und gespeicherten Stand bereinigen (kein Browser nötig)
{
  const { checkTarget, sanitizeApps, MAX_FAV } = await import("../../../custom_components/device_panel/panel/apps.js");
  check("Ziel intern: /config/x gültig, ohne Schrägstrich, //host und Leerzeichen ungültig",
    checkTarget("/config/x", false) === "/config/x" && !checkTarget("config/x", false) && !checkTarget("//evil.example", false) && !checkTarget("/a b", false) && !checkTarget("/a\\b", false));
  check("Ziel extern: nur https:// und http:// mit Host",
    checkTarget("https://a.example/x?y=1", true) === "https://a.example/x?y=1" && checkTarget("http://router.local", true) === "http://router.local"
    && !checkTarget("javascript:alert(1)", true) && !checkTarget("data:text/html,x", true) && !checkTarget("ftp://a.example", true) && !checkTarget("/config", true) && !checkTarget("https://", true));
  const s = sanitizeApps({
    fav: ["a", "b", "c", "d", "e", "f", "g", 5], hidden: ["x", 3], order: { ha: ["q", "q", "r"], evil: ["z"] }, layout: { desktop: "list", phone: "zzz" },
    custom: [{ id: "c1", name: " Kamera ", icon: "nope", url: "/lovelace/k", ext: false }, { id: "c2", name: "Böse", icon: "web", url: "javascript:alert(1)", ext: true }, { id: "", name: "x", url: "/a" }, null],
  });
  check(`Bereinigen: höchstens ${MAX_FAV} Favoriten, nur Texte, keine Doppelten`, s.fav.length === MAX_FAV && s.fav.every((x) => typeof x === "string") && JSON.stringify(s.order.ha) === '["q","r"]' && !("evil" in s.order) && JSON.stringify(s.hidden) === '["x"]');
  check("Bereinigen: Darstellung, unbekanntes Symbol, ungültige und leere eigene Apps",
    s.layout.desktop === "list" && s.layout.phone === "grid" && s.custom.length === 1 && s.custom[0].name === "Kamera" && s.custom[0].icon === "web");
  check("Bereinigen: ohne Angaben der Standard (Timer ist Favorit)", JSON.stringify(sanitizeApps(null).fav) === '["timer"]' && sanitizeApps("x").custom.length === 0);
}

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    await ctx.route("https://example.org/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>extern</title>" }));
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
    const pins = () => ev(`return [...r.querySelectorAll(".toolbar .app-pin")].map((e) => e.dataset.appPin)`);
    const setCalls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "frontend/set_user_data" && m.key === "device_panel_apps"));
    const D = "dialog.apps-dlg";
    const open = async () => { await tap(".apps-btn"); await wait(`return r.querySelector("${D}")?.open`); };
    const shot = (name) => p.screenshot({ path: `${outDir}/launcher-${name}-${lang}-${mobile ? "mobile" : "desktop"}.png` });
    const closeLauncher = async () => { await ev(`r.host._apps.close()`); await wait(`return !r.querySelector("${D}").open`); };

    // --- Kopfzeile: Timer als Favorit, Launcher-Knopf, Zahnrad ganz rechts
    check(`[${tag}] Kopfzeile: Timer-Favorit, Launcher-Knopf, Zahnrad zuletzt`, await ev(`const t = [...r.querySelectorAll(".toolbar .app-pin, .toolbar .apps-btn, .toolbar .gear-btn")]; return t.length === 3 && t[0].dataset.appPin === "timer" && t[1].classList.contains("apps-btn") && t[2].classList.contains("gear-btn") && r.querySelector(".toolbar").lastElementChild === t[2]`));
    check(`[${tag}] Timer-Knopf mit Beschriftung "${T.timerPin}", Launcher-Knopf mit "${T.title}"`, await ev(`return r.querySelector(".toolbar .app-pin").getAttribute("aria-label") === ${JSON.stringify(T.timerPin)} && r.querySelector(".apps-btn").getAttribute("aria-label") === ${JSON.stringify(T.title)}`));
    check(`[${tag}] Knöpfe mindestens ${mobile ? 38 : 42} px gross`, await ev(`return [...r.querySelectorAll(".toolbar .app-pin, .toolbar .apps-btn, .toolbar .gear-btn")].every((e) => { const b = e.getBoundingClientRect(); return b.width >= ${mobile ? 38 : 42} && b.height >= ${mobile ? 38 : 42}; })`));

    // --- Launcher öffnen
    await open();
    check(`[${tag}] Launcher offen: Knopf aktiv, aria-expanded`, await ev(`const b = r.querySelector(".apps-btn"); return b.classList.contains("on") && b.getAttribute("aria-expanded") === "true"`));
    // ohne eigene Apps fehlt der Abschnitt "Eigene" (2.34.0)
    check(`[${tag}] Titel "${T.title}", Gruppen ${JSON.stringify(T.groups.slice(0, 3))}`, (await text(`${D} .ap-title`)) === T.title && JSON.stringify(await ev(`return [...r.querySelectorAll("${D} .ap-h")].map((h) => h.firstChild.textContent.trim())`)) === JSON.stringify(T.groups.slice(0, 3)));
    check(`[${tag}] Device Panel: Magic Push, Protokoll (Timer steht schon bei den Favoriten); Home Assistant: ${mobile ? 6 : 8} Kacheln, "Alle 12"`, await ev(`const g = [...r.querySelectorAll("${D} .ap-grid")]; return g[1].children.length === 2 && g[2].children.length === ${mobile ? 6 : 8} && /12/.test(r.querySelector("${D} .ap-more").textContent)`));
    const geo = await ev(`const d = r.querySelector("${D}").getBoundingClientRect(), a = r.querySelector(".apps-btn").getBoundingClientRect(); return [Math.round(d.left), Math.round(d.width), Math.round(d.top), Math.round(d.bottom), Math.round(a.bottom), Math.round(a.right), innerWidth, innerHeight]`);
    if (mobile) check(`[${tag}] Handy: Blatt über die ganze Breite, unten`, geo[0] === 0 && geo[1] === geo[6] && geo[3] === geo[7], JSON.stringify(geo));
    else check(`[${tag}] Desktop: Fenster unter dem Knopf, nicht über den Rand`, geo[2] >= geo[4] && geo[0] + geo[1] <= geo[6] - 8 && geo[0] >= 8 && geo[1] <= 450, JSON.stringify(geo));
    check(`[${tag}] Favoriten: nur Timer; in der normalen Ansicht keine Herzen an den Apps, ein einziges Herz hinter "${T.groups[0]}"`, await ev(`return r.querySelectorAll("${D} .ap-grid")[0].children.length === 1 && r.querySelector("${D} .ap-grid .ap-tile").classList.contains("pin") && r.querySelectorAll('${D} [data-ap="fav"]').length === 0 && r.querySelectorAll("${D} .ap-h .ap-hh svg").length === 1 && r.querySelector("${D} .ap-h").lastElementChild.classList.contains("ap-hh")`));
    await shot("1-launcher");

    // --- Favoriten (nur im Bearbeiten-Modus): Herz, Kopfzeile, Handy nur der erste, Speichern bei HA
    await tap(`${D} [data-ap="edit"]`);
    const heartOf = (id) => `${D} [data-ap-box="ha"] [data-ap="fav"][data-id="${id}"]`;
    await tap(heartOf("auto"));
    check(`[${tag}] Herz an "${T.auto}": zweiter Favorit, ${mobile ? "Kopfzeile am Handy bleibt bei einem Knopf" : "zwei Knöpfe in der Kopfzeile"}`, JSON.stringify(await pins()) === JSON.stringify(mobile ? ["timer"] : ["timer", "auto"]), JSON.stringify(await pins()));
    await p.waitForTimeout(700);
    const sc = await setCalls();
    check(`[${tag}] bei HA gespeichert (Benutzerdaten, Favoriten in Reihenfolge)`, sc.length >= 1 && JSON.stringify(sc.at(-1).value.fav) === '["timer","auto"]', JSON.stringify(sc.at(-1)?.value?.fav));
    for (const id of ["scene", "script", "helper"]) await tap(heartOf(id));
    check(`[${tag}] fünf Favoriten: ${mobile ? "Kopfzeile am Handy nur der erste" : "fünf Knöpfe in der Kopfzeile, Zahnrad bleibt rechts"}`, JSON.stringify(await pins()) === JSON.stringify(mobile ? ["timer"] : ["timer", "auto", "scene", "script", "helper"]) && (await ev(`return r.querySelector(".toolbar").lastElementChild.classList.contains("gear-btn")`)), JSON.stringify(await pins()));
    check(`[${tag}] fünf Favoriten: Herz an den übrigen Apps gesperrt`, await ev(`return r.querySelector('${heartOf("dev")}').classList.contains("dis")`));
    // aria-disabled: Playwright tippt nicht darauf, ein Benutzer schon (Hinweis erscheint)
    await (await handle(heartOf("dev"))).click({ force: true });
    check(`[${tag}] sechster Favorit: Hinweis "${T.max}", Favoriten unverändert`, (await text(`${D} .ap-snack`)) === T.max && (await data()).fav.length === 5, await text(`${D} .ap-snack`));
    await tap(`${D} [data-ap="done"]`);
    check(`[${tag}] Normale Ansicht: kein Strich, kein Hinweis zur Kopfzeile am Handy, keine Herzen; fünf Favoriten als Kacheln`, await ev(`return !r.querySelector("${D} .ap-vl, ${D} .ap-hline, ${D} .ap-fav, ${D} .ap-note") && r.querySelectorAll('${D} [data-ap="fav"]').length === 0 && r.querySelectorAll("${D} .ap-grid")[0].children.length === 5`));
    check(`[${tag}] Favoriten stehen nur bei den Favoriten, nicht noch einmal in ihrer Gruppe`, await ev(`return ["timer", "auto", "scene", "script", "helper"].every((id) => r.querySelectorAll('${D} [data-ap="open"][data-id="' + id + '"]').length === 1) && r.querySelectorAll("${D} .ap-grid")[1].children.length === 2`));
    await shot("2-fuenf-favoriten");

    // --- Suche
    const h0 = await ev(`return r.querySelector("${D}").getBoundingClientRect().height`);
    await ev(`r.querySelector("${D} .ap-q").focus()`);
    await (await handle(`${D} .ap-q`)).fill(lang === "de" ? "automat" : "automat");
    check(`[${tag}] Suche "automat": nur Automationen, ohne Favoriten-Abschnitt`, await ev(`const t = [...r.querySelectorAll("${D} .ap-tile .ap-nm")].map((e) => e.textContent); return t.length === 1 && t[0] === ${JSON.stringify(T.auto)} && r.querySelectorAll("${D} .ap-h").length === 1`));
    await (await handle(`${D} .ap-q`)).fill("zzzz");
    check(`[${tag}] Suche ohne Treffer: "${T.none}", das Fenster wird dabei nicht kleiner`, (await text(`${D} .ap-note`)) === T.none && (await ev(`return r.querySelector("${D}").getBoundingClientRect().height`)) >= h0 - 1, `${h0} -> ${await ev(`return r.querySelector("${D}").getBoundingClientRect().height`)}`);
    await (await handle(`${D} .ap-q`)).fill("");
    check(`[${tag}] Suche leer: wieder alle Gruppen`, await ev(`return r.querySelectorAll("${D} .ap-h").length === 3`));

    // --- Öffnen: HA-Seite (Navigation), Protokoll, Magic Push, Timer
    await tap(`${D} .ap-grid [data-ap="open"][data-id="auto"]`);
    check(`[${tag}] Tipp auf "${T.auto}": Seite von HA, Launcher zu`, (await wait(`return !r.querySelector("${D}").open`)) && new URL(p.url()).pathname === "/config/automation/dashboard", p.url());
    await open();
    await tap(`${D} .ap-grid [data-ap="open"][data-id="log"]`);
    check(`[${tag}] Protokoll öffnet (nur über den Launcher), Launcher zu`, (await wait(`return r.querySelector("dialog.log-dlg")?.open`)) && !(await ev(`return r.querySelector("${D}").open`)));
    await tap("dialog.log-dlg [data-lg-close]");
    await wait(`return !r.querySelector("dialog.log-dlg").open`);
    await open();
    await tap(`${D} .ap-grid [data-ap="open"][data-id="magic"]`);
    check(`[${tag}] Magic Push: Einstellungen öffnen beim Reiter Magic Push`, await wait(`const s = r.querySelector("dialog.settings"); return s?.open && !!s.querySelector('[data-set="tab"][data-key="magic"].on')`));
    await p.waitForTimeout(800);
    await tap('dialog.settings [data-set="close"]');
    await wait(`return !r.querySelector("dialog.settings").open`);
    await tap(".toolbar .app-pin[data-app-pin=\"timer\"]");
    check(`[${tag}] Timer-Knopf in der Kopfzeile öffnet "Alle Timer"`, await wait(`return r.querySelector("dialog.tmall-dlg")?.open`));
    await ev(`r.querySelector("dialog.tmall-dlg").close()`);

    // --- Bearbeiten-Modus
    await open();
    await tap(`${D} [data-ap="edit"]`);
    check(`[${tag}] Bearbeiten: Titel "${T.editTitle}", Fertig, Darstellung Raster | Liste mit Kapsel`, (await text(`${D} .ap-title`)) === T.editTitle && !!(await handle(`${D} [data-ap="done"]`))
      && (await wait(`return !!r.querySelector("${D} .ap-view .sub-tabs .seg-pill")`)) && JSON.stringify(await ev(`return [...r.querySelectorAll("${D} .ap-view .sub-tab")].map((e) => e.textContent)`)) === JSON.stringify([T.grid, T.list]));
    check(`[${tag}] Bearbeiten: Strich vor dem zweiten Favoriten, Ziehgriff, Auge, Herz je Zeile; Protokoll mit Schloss statt Auge`, await ev(`const box = r.querySelector('${D} [data-ap-box="fav"]'); const row = r.querySelector('${D} [data-ap-box="panel"] .ap-erow[data-id="log"]'); return box.children.length === 5 && !!box.children[1].dataset.mark && [...r.querySelectorAll("${D} .ap-erow")].every((e) => e.querySelector("[data-ap-drag]") && e.querySelector('[data-ap="fav"]')) && !row.querySelector('[data-ap="hide"]') && !!row.querySelector(".ap-a.dis")`));
    await shot("3-bearbeiten");
    await tap(`${D} [data-set="layout"][data-v="list"]`);
    const lay = (await data()).layout;
    check(`[${tag}] Darstellung "${T.list}" gilt nur für ${mobile ? "das Handy" : "den Desktop"} (das andere bleibt Raster)`, mobile ? lay.phone === "list" && lay.desktop === "grid" : lay.desktop === "list" && lay.phone === "grid", JSON.stringify(lay));
    // Auge: Szenen ausblenden, kein Favorit mehr, Knopf weg
    await tap(`${D} [data-ap-box="fav"] [data-ap="hide"][data-id="scene"]`);
    let d = await data();
    check(`[${tag}] Auge: Szenen ausgeblendet und kein Favorit mehr, Knopf weg`, d.hidden.includes("scene") && !d.fav.includes("scene") && !(await pins()).includes("scene") && (await ev(`return r.querySelector('${D} [data-ap-box="ha"] .ap-erow[data-id="scene"]').classList.contains("hid")`)));
    await tap(`${D} [data-ap-box="ha"] [data-ap="hide"][data-id="scene"]`);
    d = await data();
    check(`[${tag}] Auge wieder: eingeblendet, aber kein Favorit`, !d.hidden.includes("scene") && !d.fav.includes("scene"));
    // Tastatur: "Automationen" mit Pfeil nach oben auf Platz 1
    const handleBtn = await handle(`${D} [data-ap-box="fav"] [data-ap-drag][data-id="auto"]`);
    await handleBtn.focus();
    await p.keyboard.press("ArrowUp");
    d = await data();
    check(`[${tag}] Pfeiltaste am Griff: Automationen auf Platz 1`, d.fav[0] === "auto" && d.fav[1] === "timer", JSON.stringify(d.fav));
    check(`[${tag}] ${mobile ? "Handy: in der Kopfzeile steht jetzt nur Automationen" : "Desktop: Kopfzeile folgt der Reihenfolge"}`, JSON.stringify(await pins()) === JSON.stringify(mobile ? ["auto"] : ["auto", "timer", "script", "helper"]), JSON.stringify(await pins()));
    check(`[${tag}] Fokus bleibt am Griff`, await ev(`return r.activeElement?.dataset?.id === "auto" && r.activeElement.hasAttribute("data-ap-drag")`));
    if (!mobile) {
      // Ziehen mit der Maus: "helper" über "auto"
      const from = await (await handle(`${D} [data-ap-box="fav"] [data-ap-drag][data-id="helper"]`)).boundingBox();
      const to = await (await handle(`${D} [data-ap-box="fav"] .ap-erow[data-id="auto"]`)).boundingBox();
      await p.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await p.mouse.down();
      await p.mouse.move(from.x + from.width / 2, (from.y + to.y) / 2, { steps: 6 });
      await p.mouse.move(from.x + from.width / 2, to.y + 4, { steps: 6 });
      await p.mouse.up();
      d = await data();
      check(`[${tag}] Ziehen mit der Maus: "helper" an Platz 1`, d.fav[0] === "helper", JSON.stringify(d.fav));
    }
    // Zurück: Fertig, Liste statt Raster
    await tap(`${D} [data-ap="done"]`);
    check(`[${tag}] Fertig: Liste nur mit Titeln (keine Pfade), ohne Strich`, await ev(`return !!r.querySelector("${D} .ap-rows .ap-row") && !r.querySelector("${D} .ap-rows .ap-t small") && [...r.querySelectorAll("${D} .ap-rows .ap-t")].every((e) => !e.textContent.includes("/config") && !e.textContent.includes("http")) && !r.querySelector("${D} .ap-hline") && !r.querySelector("${D} .ap-grid .ap-tile.ap-add") `));
    await shot("4-liste");

    // --- Eigene Apps (2.34.0: nur im Bearbeiten-Modus anlegen; in der normalen Ansicht weder Plus-Kachel noch leerer Abschnitt "Eigene")
    check(`[${tag}] normale Ansicht ohne eigene Apps: kein Plus (keine Kachel "Eigene App"), kein Abschnitt "${T.groups[3]}"`, await ev(`return !r.querySelector('${D} [data-ap="add"]') && !r.querySelector("${D} .ap-add, ${D} .ap-add-row") && ![...r.querySelectorAll("${D} .ap-h")].some((h) => h.textContent.includes(${JSON.stringify(T.groups[3])}))`));
    await tap(`${D} [data-ap="edit"]`);
    await tap(`${D} [data-ap="add"]`);
    const F = "dialog.app-dlg";
    check(`[${tag}] Formular "${T.formNew}": Kontrollkästchen aus, Beschriftung "${T.labelPage}"`, (await wait(`return r.querySelector("${F}")?.open`)) && (await text(`${F} .ap-title`)) === T.formNew && !(await ev(`return r.querySelector('${F} [data-f="ext"]').checked`)) && (await text(`${F} [data-f-label]`)) === T.labelPage);
    await tap(`${F} [data-ap="fsave"]`);
    check(`[${tag}] ohne Name: "${T.errName}"`, (await text(`${F} [data-f-err]`)) === T.errName);
    await (await handle(`${F} [data-f="name"]`)).fill("Kamera Eingang");
    await (await handle(`${F} [data-f="url"]`)).fill("lovelace/kameras");
    await tap(`${F} [data-ap="fsave"]`);
    check(`[${tag}] Seite ohne "/": "${T.errPage}"`, (await text(`${F} [data-f-err]`)) === T.errPage, await text(`${F} [data-f-err]`));
    await tap(`${F} [data-ap="ficon"][data-icon="camera"]`);
    check(`[${tag}] Symbol gewählt, Vorschau mit Namen`, await ev(`return r.querySelector('${F} [data-ap="ficon"][data-icon="camera"]').classList.contains("on") && r.querySelector("${F} [data-f-prev] .ap-nm").textContent === "Kamera Eingang"`));
    await (await handle(`${F} [data-f="url"]`)).fill("/lovelace/kameras");
    await tap(`${F} [data-ap="fsave"]`);
    d = await data();
    check(`[${tag}] interne App gespeichert (Seite in HA, kein externer Link)`, (await wait(`return !r.querySelector("${F}").open`)) && d.custom.length === 1 && d.custom[0].url === "/lovelace/kameras" && d.custom[0].ext === false && d.custom[0].icon === "camera", JSON.stringify(d.custom));
    const camId = d.custom[0].id;
    // Externer Link
    await tap(`${D} [data-ap="add"]`);
    await wait(`return r.querySelector("${F}")?.open`);
    await (await handle(`${F} [data-f="name"]`)).fill("Beispiel");
    await tap(`${F} [data-f="ext"]`);
    check(`[${tag}] Kontrollkästchen ein: Beschriftung "${T.labelAddr}", Hinweis auf neuen Tab, Marke in der Vorschau`, (await text(`${F} [data-f-label]`)) === T.labelAddr && (await text(`${F} [data-f-hint]`)).includes("https://") && (await ev(`return !!r.querySelector("${F} [data-f-prev] .ap-ext")`)));
    await (await handle(`${F} [data-f="url"]`)).fill("javascript:alert(1)");
    await tap(`${F} [data-ap="fsave"]`);
    check(`[${tag}] javascript: wird abgelehnt: "${T.errExt}"`, (await text(`${F} [data-f-err]`)) === T.errExt && (await data()).custom.length === 1);
    await (await handle(`${F} [data-f="url"]`)).fill("/config/devices");
    await tap(`${F} [data-ap="fsave"]`);
    check(`[${tag}] externer Link ohne https://: abgelehnt`, (await text(`${F} [data-f-err]`)) === T.errExt && (await data()).custom.length === 1);
    await (await handle(`${F} [data-f="url"]`)).fill("https://example.org/start");
    await shot("5-eigene-app");
    await tap(`${F} [data-ap="fsave"]`);
    d = await data();
    check(`[${tag}] externe App gespeichert`, d.custom.length === 2 && d.custom[1].ext === true && d.custom[1].url === "https://example.org/start", JSON.stringify(d.custom));
    await wait(`return !r.querySelector("${F}").open`);
    await tap(`${D} [data-ap="done"]`);
    check(`[${tag}] normale Ansicht mit eigenen Apps: Abschnitt "${T.groups[3]}" da, weiterhin kein Plus`, await ev(`return [...r.querySelectorAll("${D} .ap-h")].some((h) => h.textContent.includes(${JSON.stringify(T.groups[3])})) && !r.querySelector('${D} [data-ap="add"]')`));
    check(`[${tag}] externer Link ist ein Verweis: neuer Tab, noopener noreferrer, Marke`, await ev(`const a = r.querySelector('${D} a[data-ap="ext"]'); return !!a && a.target === "_blank" && /noopener/.test(a.rel) && /noreferrer/.test(a.rel) && a.href === "https://example.org/start" && !!a.querySelector(".ap-ext")`));
    const popup = ctx.waitForEvent("page", { timeout: 8000 });
    await tap(`${D} a[data-ap="ext"]`);
    const np = await popup.catch(() => null);
    check(`[${tag}] Tipp öffnet einen neuen Tab (Adresse stimmt), Home Assistant bleibt offen`, !!np && np.url().startsWith("https://example.org/start") && !p.isClosed(), np ? np.url() : "kein Tab");
    if (np) await np.close();
    check(`[${tag}] Launcher schliesst nach dem Öffnen eines externen Links`, await wait(`return !r.querySelector("${D}").open`));
    await open();
    await tap(`${D} [data-ap="open"][data-id="${camId}"]`);
    check(`[${tag}] interne App öffnet die Seite in HA`, (await wait(`return !r.querySelector("${D}").open`)) && new URL(p.url()).pathname === "/lovelace/kameras", p.url());
    // Externe App als Favorit: Kopfzeile zeigt einen Verweis
    await open();
    await tap(`${D} [data-ap="edit"]`);
    // vier Favoriten (timer, auto, script, helper): einer ist frei
    await tap(`${D} [data-ap-box="own"] [data-ap="fav"][data-id="${d.custom[1].id}"]`);
    d = await data();
    check(`[${tag}] externe App als Favorit (fünfter)`, d.fav.length === 5 && d.fav.includes(d.custom[1].id));
    if (!mobile) check(`[${tag}] Desktop: Kopfzeile zeigt sie als Verweis in neuem Tab`, await ev(`const a = r.querySelector('.toolbar a.app-pin'); return !!a && a.target === "_blank" && /noopener/.test(a.rel) && a.href === "https://example.org/start"`));
    // Ändern
    await tap(`${D} [data-ap-box="own"] [data-ap="edit-app"][data-id="${camId}"]`);
    await wait(`return r.querySelector("${F}")?.open`);
    check(`[${tag}] Ändern: Formular "${T.formEdit}" mit den bisherigen Werten`, (await text(`${F} .ap-title`)) === T.formEdit && (await ev(`return r.querySelector('${F} [data-f="name"]').value`)) === "Kamera Eingang" && (await ev(`return r.querySelector('${F} [data-f="url"]').value`)) === "/lovelace/kameras");
    await (await handle(`${F} [data-f="name"]`)).fill("Kamera Garten");
    await tap(`${F} [data-ap="fsave"]`);
    await wait(`return !r.querySelector("${F}").open`);
    check(`[${tag}] Name geändert`, (await data()).custom.find((c) => c.id === camId)?.name === "Kamera Garten");
    // Löschen mit Rückgängig
    await tap(`${D} [data-ap-box="own"] [data-ap="del"][data-id="${camId}"]`);
    check(`[${tag}] Löschen: App weg, Hinweis mit "${T.undo}"`, (await data()).custom.length === 1 && (await text(`${D} .ap-snack`)).includes(lang === "de" ? "Kamera Garten gelöscht." : "Kamera Garten deleted."));
    await tap(`${D} .ap-snack [data-ap="snack"]`);
    check(`[${tag}] Rückgängig: App wieder da`, (await data()).custom.length === 2);

    // --- Auf Standard zurücksetzen (mit Rückgängig), eigene Apps bleiben
    const before = await data();
    await tap(`${D} [data-ap="reset"]`);
    d = await data();
    check(`[${tag}] Zurücksetzen: Favorit nur Timer, nichts ausgeblendet, eigene Apps und Darstellung bleiben`, JSON.stringify(d.fav) === '["timer"]' && d.hidden.length === 0 && d.custom.length === 2 && d.layout.desktop === before.layout.desktop && d.layout.phone === before.layout.phone && (await text(`${D} .ap-snack`)).startsWith(T.resetDone));
    await tap(`${D} .ap-snack [data-ap="snack"]`);
    check(`[${tag}] Rückgängig stellt die Favoriten wieder her`, JSON.stringify((await data()).fav) === JSON.stringify(before.fav));
    await tap(`${D} [data-ap="reset"]`);
    await tap(`${D} [data-ap="done"]`);
    await shot("6-standard");

    // --- Rechte: Nicht-Administratoren sehen keine Verwaltungsseiten
    await closeLauncher();
    await p.evaluate(() => { document.querySelector("home-assistant").hass.user = { is_admin: false }; window.__pushHass(); });
    await open();
    check(`[${tag}] Nicht-Administrator: Home Assistant-Gruppe hat genau Verlauf und Logbuch`, JSON.stringify(await ev(`const rows = [...r.querySelectorAll("${D} [data-ap='open'][data-id]")].map((e) => e.dataset.id); return rows.filter((i) => ["hist","book","auto","scene","tools","backup"].includes(i)).sort()`)) === '["book","hist"]');
    await closeLauncher();
    await p.evaluate(() => { document.querySelector("home-assistant").hass.user = { is_admin: true }; window.__pushHass(); });

    // --- Schliessen: Escape und Tipp neben das Fenster
    // Escape gibt es nur mit Tastatur (Desktop); am Handy zählt der Tipp neben das Fenster
    if (!mobile) {
      await open();
      await p.keyboard.press("Escape");
      check(`[${tag}] Escape schliesst, Knopf nicht mehr aktiv`, await wait(`const b = r.querySelector(".apps-btn"); return !r.querySelector("${D}").open && !b.classList.contains("on") && b.getAttribute("aria-expanded") === "false"`));
    }
    await open();
    const fb = await (await p.$("#panel-frame")).boundingBox();
    if (mobile) await p.touchscreen.tap(fb.x + 195, fb.y + 20);
    else await p.mouse.click(60, 400);
    check(`[${tag}] Tipp neben das Fenster schliesst`, await wait(`return !r.querySelector("${D}").open`));

    // --- Stand bleibt nach dem Neuladen (Benutzerdaten von HA und lokale Kopie)
    const saved = await data();
    await p.waitForTimeout(700);
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=${mobile ? "dark" : "light"}`);
    const f2 = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f2.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    await f2.waitForFunction(new Function(`return ${R}.host._apps.loaded`), null, { timeout: 5000 }).catch(() => {});
    const after = JSON.parse(await f2.evaluate(new Function(`return JSON.stringify(${R}.host._apps.data)`)));
    check(`[${tag}] nach dem Neuladen derselbe Stand (Favoriten, eigene Apps, Darstellung)`, JSON.stringify(after.fav) === JSON.stringify(saved.fav) && after.custom.length === saved.custom.length && JSON.stringify(after.layout) === JSON.stringify(saved.layout), JSON.stringify(after));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
