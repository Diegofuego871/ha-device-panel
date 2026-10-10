// Reihenfolge aller Filter-Chips per Ziehen (1.13.0, seit 1.14.0 eine Liste,
// docs/mockups/chip-order-v3, D2): Einstellungen, Abschnitt "Darstellung" ›
// Reiter "Filter-Chips". "Alle" ist eine feste Zeile ohne Schalter, jede
// Verbindungsart und jeder übrige Chip eine Zeile mit Griff. Die Leiste folgt
// der Reihenfolge, feine Trenner stehen zwischen Chips verschiedener Art
// (Auswahlfenster | "Alle" und Verbindungsarten | "Nur Probleme" und Hinweise),
// die Vorschau zeigt dieselbe Leiste, die Standardfolge wird als leer
// gespeichert. Deutsch und Englisch, Desktop und Handy, echte Maus- und
// Touch-Ereignisse.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
// Standardfolge der Liste (seit 1.18.0 fest: "Alle" angeheftet, alle Verbindungsarten, auch
// ohne Geräte) und der Leiste (nur, was zutrifft).
const DEFAULT = "all,pin,integration,new,offline,problems,battery,batteries,charging,area,thread,wifi,ble,zigbee,ethernet,cloud,matter,network,unknown,zwave,signal,update,override";
const BAR = "all,integration,|,new,offline,problems,battery,batteries,|,area,|,thread,wifi,ble,zigbee,cloud,network,unknown,zwave,|,signal,update";
// Vorschau und Leiste vergleichen ohne das Pin-Zeichen (leerer Eintrag) der Vorschau.
const norm = (t) => t.split("#").filter(Boolean).join("#");
const TEXT = {
  de: { one: "1 Änderung", order: "Chips in eigener Reihenfolge", reset: "Standardreihenfolge", prev: "So sieht die Leiste aus", fixed: "Alle", lock: "fest", pin: "angeheftet bis hier", phone: "Auf dem Handy, seitlich gescrollt" },
  en: { one: "1 change", order: "chips in own order", reset: "Default order", prev: "How the bar looks", fixed: "All", lock: "fixed", pin: "pinned up to here", phone: "On the phone, scrolled sideways" },
};

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 1000 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1400, height: 1700 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=${mobile ? "dark" : "light"}`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const lastSet = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_options").at(-1)?.values);
    // Leiste als Folge: Schlüssel der Chips, Trenner als "|".
    const bar = () => ev(`return [...r.querySelectorAll(".chips .chip, .chips .vsep")].map((c) => c.classList.contains("vsep") ? "|" : c.dataset.conn || c.dataset.hint || (c.hasAttribute("data-problems") ? "problems" : c.hasAttribute("data-offline") ? "offline" : c.classList.contains("integ") ? "integration" : c.classList.contains("area") ? "area" : "?")).join()`);
    const barTexts = () => ev(`return [...r.querySelectorAll(".chips .chip, .chips .vsep")].map((c) => c.classList.contains("vsep") ? "|" : c.textContent.replace(/\\s+/g," ").trim()).join("#")`);
    const prevTexts = () => ev(`return [...r.querySelectorAll(".chip-prev-pills > *")].map((c) => c.classList.contains("vsep") ? "|" : c.textContent.replace(/\\s+/g," ").trim()).join("#")`);
    const rowOrder = () => ev(`return [...r.querySelectorAll('.drag-list[data-drag-list="chip_order"] [data-set="drag"]')].map(b=>b.dataset.key).join()`);
    const sel = (key) => `.drag-list[data-drag-list="chip_order"] [data-key="${key}"]`;
    const openChips = async () => {
      await ev(`if (r.querySelector("dialog.settings")?.open) r.querySelector('dialog.settings [data-set="close"]').click()`);
      await tap(".gear-btn");
      await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
      await tap('[data-set="section"][data-id="look"]');
      await tap('[data-set="subtab"][data-key="chips"]');
      await wait(`return !!r.querySelector('.drag-list[data-drag-list="chip_order"]')`);
    };
    const save = async () => {
      await tap('dialog.settings [data-set="save"]');
      if (!(await wait(`return r.querySelector("dialog.settings").open && r.querySelector(".set-count")?.classList.contains("saved")`))) return false;
      await tap('dialog.settings .dlg-actions [data-set="close"]');
      return wait(`return !r.querySelector("dialog.settings").open`);
    };
    const center = async (s) => {
      const box = await f.evaluate(new Function(`const b=${R}.querySelector(${JSON.stringify(s)}).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }`));
      const fr = await (await p.$("#panel-frame")).boundingBox();
      return { x: box.x + fr.x, y: box.y + fr.y };
    };
    const drag = async (fromSel, toSel) => {
      // Die Zeile in der Mitte zwischen Start und Ziel in die Mitte scrollen, damit
      // beide im Fenster liegen (weite Wege).
      await ev(`const keys=[...r.querySelectorAll('.drag-list[data-drag-list="chip_order"] [data-set="drag"]')]; const a=keys.findIndex((k)=>k.matches(${JSON.stringify(fromSel)})); const z=keys.findIndex((k)=>k.matches(${JSON.stringify(toSel)})); keys[Math.round((a+z)/2)].scrollIntoView({ block: "center" })`);
      await p.waitForTimeout(200);
      const a = await center(fromSel);
      const bEnd = await center(toSel);
      const to = { x: bEnd.x, y: bEnd.y - 12 };
      if (!mobile) {
        await p.mouse.move(a.x, a.y);
        await p.mouse.down();
        for (let i = 1; i <= 8; i++) await p.mouse.move(a.x, a.y + ((to.y - a.y) * i) / 8);
        await p.mouse.up();
      } else {
        const cdp = await ctx.newCDPSession(p);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y }] });
        for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a.x, y: a.y + ((to.y - a.y) * i) / 8 }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await cdp.detach();
        // Chrome verschluckt bis knapp 1 s nach einer Touch-Folge per CDP den Klick des nächsten Tipps.
        await p.waitForTimeout(1500);
      }
      await p.waitForTimeout(500);
    };

    // 1. Ausgangslage: Standardfolge wie bisher, Trenner zwischen den Arten
    const start = await bar();
    check(`[${tag}] Leiste in Standardfolge, Trenner zwischen den Arten`, start === BAR, start);
    await openChips();
    check(`[${tag}] eine Liste: alle Chips, Verbindungsarten einzeln`, (await rowOrder()) === DEFAULT, await rowOrder());
    check(`[${tag}] "${T.fixed}": Schloss "${T.lock}" statt Schalter`, await ev(`const row=r.querySelector(${JSON.stringify(sel("all"))}).closest(".ex-row"); return !row.querySelector("input") && row.querySelector(".fix-badge")?.textContent.trim() === ${JSON.stringify(T.lock)}`));
    check(`[${tag}] Verbindungsart schaltet hide_connections, Chip schaltet hide_chips`, await ev(`return r.querySelector(${JSON.stringify(sel("zigbee"))}).closest(".ex-row").querySelector("input").dataset.list === "hide_connections" && r.querySelector(${JSON.stringify(sel("battery"))}).closest(".ex-row").querySelector("input").dataset.list === "hide_chips"`));
    check(`[${tag}] kein Zurücksetzen in der Standardfolge`, !(await ev(`return !!r.querySelector('[data-set="drag-reset"]')`)));
    check(`[${tag}] Vorschau "${T.prev}" wie die Leiste`, (await text(".chip-prev-t")) === T.prev && norm(await prevTexts()) === norm(await barTexts()), `${await prevTexts()} / ${await barTexts()}`);

    // 1b. Die Haftgruppe der Handy-Vorschau (sticky, z-index) deckt beim Scrollen den Kopf des Dialogs
    // nicht ab (Fehler bis 1.17.0): Sie liegt unter dem Kopf, an ihrer Stelle muss der Kopf zu sehen sein.
    const over = await ev(`const d=r.querySelector("dialog.settings"), head=d.querySelector(".dlg-head"), pin=d.querySelector(".chip-prev-strip .chip-pin"); const hb=head.getBoundingClientRect(); d.scrollTop += pin.getBoundingClientRect().top - (hb.top + hb.height / 2); const q=pin.getBoundingClientRect(), y=q.top + q.height / 2, hit=r.elementFromPoint(q.left + q.width / 2, y); return { overlap: y < hb.bottom && y > hb.top, inHead: !!hit?.closest(".dlg-head"), hit: hit?.className || "" }`);
    check(`[${tag}] Haftgruppe der Vorschau liegt beim Scrollen hinter dem Dialog-Kopf`, over.overlap && over.inHead, JSON.stringify(over));
    await ev(`r.querySelector("dialog.settings").scrollTop = 0`);

    // 2. "Alle" hinter die Hinweise ziehen: Trenner zwischen den Arten
    await drag(sel("all"), sel("area"));
    const m1 = "pin,integration,new,offline,problems,battery,batteries,charging,all,area,thread,wifi,ble,zigbee,ethernet,cloud,matter,network,unknown,zwave,signal,update,override";
    check(`[${tag}] "Alle" nach hinten gezogen`, await wait(`return [...r.querySelectorAll('.drag-list[data-drag-list="chip_order"] [data-set="drag"]')].map(b=>b.dataset.key).join() === ${JSON.stringify(m1)}`), await rowOrder());
    check(`[${tag}] als Änderung, Zusammenfassung, Knopf "${T.reset}"`, (await text(".set-count")) === T.one && (await text('[data-id="look"] .set-sec-sum')).endsWith(T.order) && (await text('[data-set="drag-reset"]')) === T.reset, `${await text(".set-count")} / ${await text('[data-id="look"] .set-sec-sum')}`);
    check(`[${tag}] Vorschau folgt der Folge: "${T.fixed}" hinter den Hinweisen`, await wait(`return [...r.querySelectorAll(".chip-prev-pills > *")].map((c) => c.classList.contains("vsep") ? "|" : c.textContent.replace(/\\s+/g," ").trim()).join("#").includes(${JSON.stringify(`#|#${T.fixed} 16#|#`)})`), await prevTexts());
    if (!mobile) {
      // Pfeiltaste: "Update" eins nach unten, der Fokus bleibt am Griff
      await (await handle(sel("update"))).focus();
      await p.keyboard.press("ArrowDown");
      check(`[${tag}] Pfeiltaste verschiebt, Fokus bleibt`, (await wait(`return [...r.querySelectorAll('.drag-list[data-drag-list="chip_order"] [data-set="drag"]')].map(b=>b.dataset.key).join() === "pin,integration,new,offline,problems,battery,batteries,charging,all,area,thread,wifi,ble,zigbee,ethernet,cloud,matter,network,unknown,zwave,signal,override,update"`)) && (await ev(`return r.activeElement?.dataset.key === "update"`)), await rowOrder());
      await p.keyboard.press("ArrowUp");
      await wait(`return [...r.querySelectorAll('.drag-list[data-drag-list="chip_order"] [data-set="drag"]')].map(b=>b.dataset.key).join() === ${JSON.stringify(m1)}`);
    }
    await ev(`r.querySelector(".chip-prev").scrollIntoView({ block: "start" })`);
    await p.screenshot({ path: `${outDir}/chiporder-settings-${tag.replace("/", "-")}.png` });
    check(`[${tag}] gespeichert: volle Folge in chip_order`, (await save()) && JSON.stringify((await lastSet())?.chip_order) === JSON.stringify(m1.split(",")), JSON.stringify(await lastSet()));
    const b1 = await bar();
    check(`[${tag}] Leiste: "Alle" hinter den Hinweisen, nichts angeheftet, Trenner zwischen den Arten`, b1 === "integration,|,new,offline,problems,battery,batteries,|,all,|,area,|,thread,wifi,ble,zigbee,cloud,network,unknown,zwave,|,signal,update" && !(await ev(`return !!r.querySelector(".chips .chip-pin")`)), b1);
    await p.screenshot({ path: `${outDir}/chiporder-bar-${tag.replace("/", "-")}.png` });

    // 3. Weite Wege (nur Desktop, hohes Fenster): Batterie ganz nach vorn, Zigbee hinter die Verbindungsarten
    if (!mobile) {
      await openChips();
      await drag(sel("batteries"), sel("integration"));
      await drag(sel("zigbee"), sel("signal"));
      const m2 = "pin,batteries,integration,new,offline,problems,battery,charging,all,area,thread,wifi,ble,ethernet,cloud,matter,network,unknown,zwave,zigbee,signal,update,override";
      check(`[${tag}] Batterie ganz vorn, Zigbee hinter den Verbindungsarten`, await wait(`return [...r.querySelectorAll('.drag-list[data-drag-list="chip_order"] [data-set="drag"]')].map(b=>b.dataset.key).join() === ${JSON.stringify(m2)}`), await rowOrder());
      check(`[${tag}] gespeichert`, (await save()) && JSON.stringify((await lastSet())?.chip_order) === JSON.stringify(m2.split(",")), JSON.stringify(await lastSet()));
      const b2 = await bar();
      check(`[${tag}] Leiste: Batterie zuerst, Zigbee am Ende der Verbindungsarten`, b2.startsWith("batteries,|,integration,|,new") && b2.includes("zwave,zigbee,|,signal"), b2);
    }

    // 4. Verbindungsart ausblenden: fehlt in Leiste und Vorschau, kein Trenner-Rest
    await openChips();
    await tap('input[data-list="hide_connections"][data-value="zigbee"]');
    check(`[${tag}] Vorschau ohne die ausgeblendete Art`, await wait(`return ![...r.querySelectorAll(".chip-prev-pills .chip")].some((c) => c.textContent.includes("Zigbee"))`), await prevTexts());
    check(`[${tag}] gespeichert`, (await save()) && (await lastSet())?.hide_connections?.join() === "zigbee", JSON.stringify(await lastSet()));
    const b3 = await bar();
    check(`[${tag}] Leiste ohne Zigbee, ohne hängenden Trenner`, !b3.includes("zigbee") && !b3.includes("|,|") && !b3.endsWith("|") && !b3.startsWith("|") && b3.includes("zwave,|,signal"), b3);

    // 5. Zurücksetzen: Standardfolge, als leer gespeichert
    await openChips();
    await tap('input[data-list="hide_connections"][data-value="zigbee"]');
    await tap('[data-set="drag-reset"]');
    check(`[${tag}] Standardreihenfolge`, (await rowOrder()) === DEFAULT && !(await ev(`return !!r.querySelector('[data-set="drag-reset"]')`)), await rowOrder());
    const reset = (await save()) && (await lastSet());
    check(`[${tag}] leer gespeichert`, reset && reset.chip_order?.length === 0 && reset.hide_connections?.length === 0, JSON.stringify(reset));
    check(`[${tag}] Leiste wieder in Standardfolge`, (await bar()) === BAR, await bar());

    // 5b. Anheften (1.15.0, Variante B; seit 1.18.0 ist ab Werk "Alle" angeheftet): Marker "pin" als
    // Linie in der Liste; die sichtbaren Chips davor kleben auf dem Handy links, die Vorschau zeigt die Haftkante
    await openChips();
    check(`[${tag}] Anheft-Linie hinter "${T.fixed}", nur "${T.fixed}" angeheftet`, (await ev(`return !!r.querySelector('.pin-line .pin-tab [data-key="pin"]')`)) && (await ev(`return [...r.querySelectorAll(".chips .chip-pin .chip")].map((c) => c.dataset.conn).join()`)) === "all" && (await ev(`return !!r.querySelector(".chip-prev-strip .chip-pin")`)) && (await rowOrder()).startsWith("all,pin,integration"), await rowOrder());
    check(`[${tag}] Linie ohne Schalter, mit Etikett`, await ev(`const row=r.querySelector(".pin-line"); return !row.querySelector("input") && row.querySelector(".pin-tab span:last-child").textContent.trim() === ${JSON.stringify(T.pin)}`));
    await (await handle(sel("pin"))).focus();
    await p.keyboard.press("ArrowDown");
    check(`[${tag}] Linie eins nach unten (Pfeiltaste, hinter Integration)`, (await wait(`return [...r.querySelectorAll('.drag-list[data-drag-list="chip_order"] [data-set="drag"]')].map(b=>b.dataset.key).join() === "all,integration,pin,new,offline,problems,battery,batteries,charging,area,thread,wifi,ble,zigbee,ethernet,cloud,matter,network,unknown,zwave,signal,update,override"`)) && (await ev(`return r.activeElement?.dataset.key === "pin"`)), await rowOrder());
    // Alle, Integration, Neu und Ausgefallen anheften: Linie noch zwei nach unten
    await p.keyboard.press("ArrowDown");
    await p.keyboard.press("ArrowDown");
    await wait(`return [...r.querySelectorAll('.drag-list[data-drag-list="chip_order"] [data-set="drag"]')].map(b=>b.dataset.key).join() === "all,integration,new,offline,pin,problems,battery,batteries,charging,area,thread,wifi,ble,zigbee,ethernet,cloud,matter,network,unknown,zwave,signal,update,override"`);
    check(`[${tag}] Vorschau: Pin-Zeichen an der Kante, Handy-Leiste mit Haftgruppe`, (await ev(`return !!r.querySelector(".chip-prev-pills .chip-prev-pin") && !!r.querySelector(".chip-prev-strip .chip-pin")`)) && (await text(".chip-prev-t.phone")) === T.phone, await text(".chip-prev-t.phone"));
    check(`[${tag}] gespeichert mit Marker`, (await save()) && JSON.stringify((await lastSet())?.chip_order?.slice(0, 6)) === JSON.stringify(["all", "integration", "new", "offline", "pin", "problems"]), JSON.stringify(await lastSet()));
    const grp = () => ev(`const g=r.querySelector(".chips .chip-pin"); if (!g) return null; return { n: g.querySelectorAll(".chip").length, vsep: g.querySelectorAll(".vsep").length, next: g.nextElementSibling?.className || "", w: g.offsetWidth, wide: g.classList.contains("too-wide"), cls: g.parentElement.className }`);
    const g1 = await grp();
    check(`[${tag}] Leiste: vier Chips in der Haftgruppe (Alle, Integration, Neu, Ausgefallen), keine Linie an der Kante`, g1 && g1.n === 4 && !g1.next.includes("vsep") && !(await ev(`return !!r.querySelector(".chips .chip-pin + .vsep")`)), JSON.stringify(g1));
    if (mobile) {
      check(`[${tag}] Handy: vier Chips sind mehr als 60 % der Leiste, die Haftgruppe scrollt mit (Grenze)`, g1.wide === true, JSON.stringify(g1));
      // Nur "Alle" angeheftet (Standard): Marker wieder hinter "Alle" (Pfeiltaste hoch)
      await openChips();
      await (await handle(sel("pin"))).focus();
      for (let i = 0; i < 3; i++) await p.keyboard.press("ArrowUp");
      await wait(`return [...r.querySelectorAll('.drag-list[data-drag-list="chip_order"] [data-set="drag"]')].map(b=>b.dataset.key).join() === ${JSON.stringify(DEFAULT)}`);
      check(`[${tag}] Marker wieder hinter "Alle": Standardfolge, leer im Entwurf`, (await rowOrder()) === DEFAULT && (await ev(`return r.host._settings.draft.chip_order.length === 0`)), await rowOrder());
      check(`[${tag}] gespeichert`, await save());
      const g2 = await grp();
      check(`[${tag}] Handy: nur "Alle" in der Haftgruppe, unter 60 %`, g2 && g2.n === 1 && g2.wide === false, JSON.stringify(g2));
      // Seitlich scrollen: die Haftgruppe bleibt am linken Rand, die übrigen Chips ziehen unten durch
      await ev(`const b=r.querySelector(".chips"); b.scrollLeft = 160`);
      await p.waitForTimeout(250);
      const stick = await ev(`const b=r.querySelector(".chips"), g=r.querySelector(".chips .chip-pin"), a=g.getBoundingClientRect(), c=b.getBoundingClientRect(); return { scrolled: b.scrollLeft, dx: Math.round(a.left - c.left), cls: b.classList.contains("scrolled") }`);
      check(`[${tag}] Handy: beim Scrollen bleibt "Alle" links stehen (Abstand ${stick.dx} px), Schatten an`, stick.scrolled > 100 && Math.abs(stick.dx) <= 1 && stick.cls, JSON.stringify(stick));
      await p.screenshot({ path: `${outDir}/chiporder-pin-${tag.replace("/", "-")}.png` });
      await ev(`r.querySelector(".chips").scrollLeft = 0`);
    } else {
      check(`[${tag}] Desktop: die Chips brechen wie bisher um (Haftgruppe ohne eigene Box)`, g1.w === 0, JSON.stringify(g1));
      // Wieder zurück auf die Standardfolge (Marker hinter "Alle")
      await openChips();
      await tap('[data-set="drag-reset"]');
      check(`[${tag}] Standardfolge: Marker wieder hinter "Alle"`, (await rowOrder()) === DEFAULT && (await save()) && (await lastSet())?.chip_order?.length === 0, await rowOrder());
    }

    // 6. Zurück auf die Standardfolge von Hand: gilt als leer (nur Desktop, Pfeiltasten)
    if (!mobile) {
      await openChips();
      await drag(sel("area"), sel("integration"));
      await (await handle(sel("area"))).focus();
      for (let i = 0; i < 7; i++) await p.keyboard.press("ArrowDown");
      check(`[${tag}] von Hand zurück: Standardfolge, kein Zurücksetzen-Knopf, leer im Entwurf`, (await rowOrder()) === DEFAULT && !(await ev(`return !!r.querySelector('[data-set="drag-reset"]')`)) && (await ev(`return r.host._settings.draft.chip_order.length === 0`)), await rowOrder());
      await tap('dialog.settings .dlg-actions [data-set="close"]');
    }

    // 7. Gespeicherte Folge ohne Verbindungsarten (aus 1.13.0): sie kommen hinter "Alle"
    await p.evaluate(() => { window.__opts.chip_order = ["batteries", "area", "integration", "all", "problems", "battery", "signal", "update", "override", "new"]; });
    await openChips();
    check(`[${tag}] ältere Folge ohne Verbindungsarten: sie folgen "Alle" nach Anzahl`, (await rowOrder()) === "pin,batteries,area,integration,all,zigbee,wifi,thread,zwave,ble,network,cloud,unknown,matter,ethernet,offline,problems,battery,signal,update,override,new,charging", await rowOrder());
    await tap('dialog.settings .dlg-actions [data-set="close"]');

    check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
