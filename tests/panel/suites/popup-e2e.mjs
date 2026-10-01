// Geräte-Popup und Statistik-Fenster (wie unifi_dynamic): Öffnen per Klick
// und Tipp, Kopf, Statistik-Kacheln, Verbindung, Gerät, Entitäten, HA-Seite,
// Entitäts-Dialog; Statistik-Fenster mit Zeitraum, Zeitstrahl, Tooltip,
// Liste und Säulen pro Tag; Schliessen per X, Escape und Hintergrund.
// Desktop und Handy, Deutsch und Englisch.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

// Erwartete Texte ausgeschrieben (nicht aus strings.js), siehe table-e2e.
const TEXT = {
  de: {
    pill: "Ausgefallen seit 2 Std. 14 Min.", sub: "Bewegung / Präsenz · Flur", open: "HA-Geräteseite öffnen",
    secs: ["Statistik", "Verbindung", "Gerät", "Entitäten · 3"],
    tile24: ["Verfügbarkeit 24 Std.", "90,2%", "2 Unterbrüche · längster 2 Std. 14 Min."],
    tile7: ["Unterbrüche 7 Tage", "3", "zusammen 2 Std. 41 Min."], signal: ["Empfang", "LQI 38", "schwach"], battery: ["Batterie", "8%", "niedrig"],
    update: "Update auf 2.2.0 verfügbar", live: "Lebenszeichen", unavailable: "nicht verfügbar", liveHint: "Markierte Entitäten zeigen, ob das Gerät lebt.",
    statTitle: "Verfügbarkeit", ranges: ["24 Std.", "7 Tage", "30 Tage"], pct24: "90,2%",
    facts24: ["2 Unterbrüche", "zusammen 2 Std. 21 Min.", "längster 2 Std. 14 Min."], ongoing: "läuft", dur: "2 Std. 14 Min.", now: "jetzt",
    legend: ["Online", "Ausgefallen"], tip: "Ausgefallen", days: "Unterbrüche pro Tag", today: "heute", out30: "4 Unterbrüche",
    retry: "wartet auf neuen Versuch", pillA: "Ausgefallen seit ≥ 3 T. 4 Std.", always: "keine Unterbrüche", since: "Daten seit", none: "Keine Daten",
    gone: "Dieses Gerät gibt es nicht mehr oder es wird nicht mehr überwacht.", close: "Schliessen",
  },
  en: {
    pill: "Offline for 2 h 14 min", sub: "Motion / presence · Flur", open: "Open device page",
    secs: ["Statistics", "Connection", "Device", "Entities · 3"],
    tile24: ["Availability 24 h", "90.2%", "2 outages · longest 2 h 14 min"],
    tile7: ["Outages 7 days", "3", "2 h 41 min in total"], signal: ["Signal", "LQI 38", "weak"], battery: ["Battery", "8%", "low"],
    update: "Update to 2.2.0 available", live: "Sign of life", unavailable: "unavailable", liveHint: "Marked entities show whether the device is alive.",
    statTitle: "Availability", ranges: ["24 h", "7 days", "30 days"], pct24: "90.2%",
    facts24: ["2 outages", "2 h 21 min in total", "longest 2 h 14 min"], ongoing: "ongoing", dur: "2 h 14 min", now: "now",
    legend: ["Online", "Offline"], tip: "Offline", days: "Outages per day", today: "today", out30: "4 outages",
    retry: "waiting to retry", pillA: "Offline for ≥ 3 d 4 h", always: "no outages", since: "data since", none: "No data",
    gone: "This device no longer exists or is no longer monitored.", close: "Close",
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
    const el = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => {
      const h = await el(sel);
      if (mobile) await h.tap(); else await h.click();
    };
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const texts = (sel) => ev(`return [...r.querySelectorAll(${JSON.stringify(sel)})].map(e=>e.textContent.replace(/\\s+/g," ").trim())`);
    const isOpen = (cls) => ev(`return r.querySelector("dialog.${cls}").open`);
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const calls = (type) => p.evaluate((t) => window.__wsCalls.filter((m) => m.type === t), type);

    // --- Popup öffnen (Zeile bzw. Karte) ---
    await tap(mobile ? '.mc[data-open="b"]' : 'tr[data-open="b"]');
    check(`[${tag}] Popup offen`, await isOpen("device"));
    check(`[${tag}] Name`, (await text("dialog.device h2")) === "Bewegungsmelder Flur");
    check(`[${tag}] Status-Pille`, (await text("dialog.device .dlg-sub .pill.off")) === T.pill, await text("dialog.device .dlg-sub"));
    check(`[${tag}] Typ und Bereich`, (await text("dialog.device .dlg-sub")).endsWith(T.sub), await text("dialog.device .dlg-sub"));
    check(`[${tag}] Knopf HA-Geräteseite`, (await text('[data-dlg="open-device"]')) === T.open);
    check(`[${tag}] Abschnitte`, await wait(`return [...r.querySelectorAll("dialog.device h3")].map(h=>h.textContent.trim()).join("|") === ${JSON.stringify(T.secs.join("|"))}`),
      JSON.stringify(await texts("dialog.device h3")));
    const devCalls = await calls("device_panel/device");
    check(`[${tag}] Details per WebSocket`, devCalls.length >= 1 && devCalls[0].device_id === "b", JSON.stringify(devCalls));

    // Statistik-Kacheln
    const tiles = await ev(`return [...r.querySelectorAll("dialog.device .st-tile")].map(t=>[...t.querySelectorAll(".st-k,.st-v,.st-sub")].map(e=>e.textContent.replace(/\\s+/g," ").trim()))`);
    check(`[${tag}] Kachel Verfügbarkeit 24 Std.`, JSON.stringify(tiles[0]) === JSON.stringify(T.tile24), JSON.stringify(tiles[0]));
    check(`[${tag}] Kachel Unterbrüche 7 Tage`, JSON.stringify(tiles[1]) === JSON.stringify(T.tile7), JSON.stringify(tiles[1]));
    check(`[${tag}] Kachel Empfang`, JSON.stringify(tiles[2]) === JSON.stringify(T.signal), JSON.stringify(tiles[2]));
    check(`[${tag}] Kachel Batterie rot`, JSON.stringify(tiles[3]) === JSON.stringify(T.battery) && (await ev(`return !!r.querySelector("dialog.device .st-tile.static .st-v.bad")`)), JSON.stringify(tiles[3]));
    check(`[${tag}] nur Statistik-Kacheln tippbar`, (await ev(`return r.querySelectorAll('dialog.device button.st-tile[data-dlg="stat"]').length`)) === 2);

    // Verbindung, Gerät, Entitäten
    const conn = (await texts("dialog.device .tiles"))[0];
    check(`[${tag}] Verbindung`, ["Zigbee", "Steckdose Flur", "Zigbee Home Automation", "Funkstick Erdgeschoss"].every((s) => conn.includes(s)), conn);
    const device = (await texts("dialog.device .tiles"))[1];
    check(`[${tag}] Gerät`, ["Beispiel AG", "Modell B", "1.0.1", T.update, "Flur"].every((s) => device.includes(s)), device);
    const ents = await texts("dialog.device li.entity");
    check(`[${tag}] drei Entitäten`, ents.length === 3, JSON.stringify(ents));
    check(`[${tag}] Lebenszeichen markiert`, ents[0].includes(T.live) && !ents[1].includes(T.live), JSON.stringify(ents));
    check(`[${tag}] nicht verfügbar rot`, (await texts("dialog.device .ent-state.bad")).every((s) => s === T.unavailable) && (await texts("dialog.device .ent-state.bad")).length === 2);
    check(`[${tag}] Hinweis Lebenszeichen`, (await text("dialog.device .dlg-note.small")) === T.liveHint);
    check(`[${tag}] Aktion Schliessen`, (await text('.dlg-actions [data-dlg="close"]')) === T.close);
    if (mobile) {
      const geo = await ev(`const d=r.querySelector("dialog.device").getBoundingClientRect(); return [Math.round(d.left), Math.round(d.width), Math.round(d.bottom), innerWidth, innerHeight]`);
      check(`[${tag}] Popup als Blatt von unten`, geo[0] === 0 && geo[1] === geo[3] && Math.abs(geo[2] - geo[4]) <= 1, JSON.stringify(geo));
    }
    await p.screenshot({ path: `${outDir}/popup-${lang}-${mobile ? "mobile" : "desktop"}.png` });

    // Entität antippen: HAs Entitäts-Dialog
    await tap('dialog.device li.entity[data-entity="binary_sensor.bewegungsmelder_flur"]');
    check(`[${tag}] Entitäts-Dialog von HA`, (await p.evaluate(() => window.__moreInfo)).includes("binary_sensor.bewegungsmelder_flur"));

    // --- Statistik-Fenster 24 Std. ---
    await tap('dialog.device [data-dlg="stat"][data-range="24h"]');
    check(`[${tag}] Statistik-Fenster offen, Popup bleibt`, (await isOpen("stat-dlg")) && (await isOpen("device")));
    check(`[${tag}] X des Popups ausgeblendet`, (await ev(`return getComputedStyle(r.querySelector('dialog.device .dlg-close')).visibility`)) === "hidden");
    check(`[${tag}] Titel und Gerät`, (await text("dialog.stat-dlg h2")) === T.statTitle && (await text("dialog.stat-dlg .dlg-sub")) === "Bewegungsmelder Flur");
    check(`[${tag}] Zeitraum-Schalter`, JSON.stringify(await texts('[data-stat="range"]')) === JSON.stringify(T.ranges) && (await text('[data-stat="range"].on')) === T.ranges[0]);
    check(`[${tag}] Verlauf geladen`, await wait(`return !!r.querySelector("dialog.stat-dlg .avail-pct")`));
    const hist = await calls("device_panel/availability");
    check(`[${tag}] Verlauf per WebSocket`, hist.at(-1)?.device_id === "b" && hist.at(-1)?.range === "24h", JSON.stringify(hist));
    check(`[${tag}] Prozent`, (await text("dialog.stat-dlg .avail-pct")) === T.pct24, await text("dialog.stat-dlg .avail-pct"));
    const facts = await text("dialog.stat-dlg .avail-facts");
    check(`[${tag}] Fakten`, T.facts24.every((s) => facts.includes(s)), facts);
    check(`[${tag}] zwei Unterbrüche im Zeitstrahl`, (await ev(`return r.querySelectorAll("dialog.stat-dlg .avail-bar .seg.off").length`)) === 2);
    const list = await texts("dialog.stat-dlg .avail-list div");
    check(`[${tag}] Liste neueste zuerst`, list.length === 2 && list[0].includes(T.ongoing) && list[0].endsWith(T.dur) && list[1].endsWith(lang === "de" ? "7 Min." : "7 min"), JSON.stringify(list));
    check(`[${tag}] Achse mit "${T.now}"`, (await text("dialog.stat-dlg .avail-ticks .now-label")) === T.now && (await ev(`return r.querySelectorAll("dialog.stat-dlg .avail-ticks span").length`)) >= 3);
    check(`[${tag}] Legende`, JSON.stringify(await texts("dialog.stat-dlg .avail-legend span")) === JSON.stringify(T.legend));
    check(`[${tag}] 24 Std. ohne Säulen pro Tag`, (await ev(`return r.querySelectorAll("dialog.stat-dlg .days i").length`)) === 0);

    // Tooltip über dem laufenden Unterbruch (Maus: überfahren, Touch: antippen)
    const seg = await f.evaluateHandle(new Function(`const s=${R}.querySelectorAll("dialog.stat-dlg .seg.off"); return s[s.length-1]`));
    if (mobile) await seg.asElement().tap(); else await seg.asElement().hover();
    const tip = await ev(`const t=r.querySelector("dialog.stat-dlg .avail-tip"); return t.hidden ? "" : t.textContent`);
    check(`[${tag}] Tooltip am Unterbruch`, tip.startsWith(T.tip) && tip.includes(T.ongoing) && tip.includes(T.dur), tip);
    await p.screenshot({ path: `${outDir}/stat-24h-${lang}-${mobile ? "mobile" : "desktop"}.png` });

    // 7 und 30 Tage
    await tap('[data-stat="range"][data-range="7d"]');
    check(`[${tag}] 7 Tage geladen`, await wait(`return r.querySelectorAll("dialog.stat-dlg .days i").length === 7`));
    check(`[${tag}] 7 Tage: Abfrage`, (await calls("device_panel/availability")).at(-1)?.range === "7d");
    check(`[${tag}] 7 Tage: Säulen pro Tag`, (await text("dialog.stat-dlg h3")) === T.days && (await texts("dialog.stat-dlg .daysx span")).at(-1) === T.today);
    check(`[${tag}] 7 Tage: drei Unterbrüche`, (await texts("dialog.stat-dlg .avail-list div")).length === 3);
    check(`[${tag}] 7 Tage: heute rot (2 Unterbrüche)`, await ev(`const d=r.querySelectorAll("dialog.stat-dlg .days i"); return d[d.length-1].classList.contains("e")`));
    await p.screenshot({ path: `${outDir}/stat-7d-${lang}-${mobile ? "mobile" : "desktop"}.png` });
    await tap('[data-stat="range"][data-range="30d"]');
    check(`[${tag}] 30 Tage: 30 Säulen`, await wait(`return r.querySelectorAll("dialog.stat-dlg .days i").length === 30`));
    check(`[${tag}] 30 Tage: vier Unterbrüche`, (await text("dialog.stat-dlg .avail-facts")).includes(T.out30), await text("dialog.stat-dlg .avail-facts"));

    // X schliesst nur das Statistik-Fenster
    await tap('dialog.stat-dlg [data-stat="close"]');
    check(`[${tag}] X schliesst nur die Statistik`, !(await isOpen("stat-dlg")) && (await isOpen("device")));
    check(`[${tag}] X des Popups wieder sichtbar`, (await ev(`return getComputedStyle(r.querySelector('dialog.device .dlg-close')).visibility`)) === "visible");

    if (!mobile) {
      // Escape: zuerst die Statistik, dann das Popup
      await tap('dialog.device [data-dlg="stat"][data-range="7d"]');
      await p.keyboard.press("Escape");
      // Das close-Ereignis des Dialogs kommt asynchron.
      check(`[${tag}] Escape schliesst die Statistik`, await wait(`return !r.querySelector("dialog.stat-dlg").open && r.querySelector("dialog.device").open && !document.querySelector("device-panel").hasAttribute("stat-open")`));
      await p.keyboard.press("Escape");
      check(`[${tag}] Escape schliesst das Popup`, !(await isOpen("device")));
      // Tastatur: Zeile fokussieren und Enter
      await ev(`r.querySelector('tr[data-open="g"]').focus()`);
      await p.keyboard.press("Enter");
      check(`[${tag}] Enter auf Zeile öffnet`, (await isOpen("device")) && (await text("dialog.device h2")) === "Deckenlicht Wohnzimmer");
      // Klick auf den Hintergrund schliesst
      await p.mouse.click(30, 450);
      check(`[${tag}] Hintergrund schliesst`, !(await isOpen("device")));
    } else {
      await tap('dialog.device [data-dlg="close"]');
      check(`[${tag}] Schliessen`, !(await isOpen("device")));
      await tap('.mrow[data-open="g"]');
      check(`[${tag}] Zeile im Online-Block öffnet`, (await isOpen("device")) && (await text("dialog.device h2")) === "Deckenlicht Wohnzimmer");
      await p.touchscreen.tap(195, 125);
      check(`[${tag}] Tipp auf den Hintergrund schliesst`, !(await isOpen("device")));
    }

    // Ausfall vor dem Neustart und Integrationseintrag mit Problem
    await tap(mobile ? '.mc[data-open="a"]' : 'tr[data-open="a"]');
    check(`[${tag}] Gerät a: "mindestens"`, (await text("dialog.device .pill.off")) === T.pillA, await text("dialog.device .pill.off"));
    check(`[${tag}] Gerät a: Eintrag wartet`, await wait(`return r.querySelector("dialog.device .tile-v small.warn")?.textContent === ${JSON.stringify(T.retry)}`));
    await tap('dialog.device [data-dlg="close"]');

    // Kaum Daten: Zeitstrahl beginnt beim ersten Datenpunkt
    await tap(mobile ? '.mrow[data-open="o"]' : 'tr[data-open="o"]');
    await tap('dialog.device [data-dlg="stat"][data-range="24h"]');
    check(`[${tag}] Zoom bei kurzem Protokoll`, await wait(`return !!r.querySelector("dialog.stat-dlg .avail-ticks .start-label")`));
    const zf = await text("dialog.stat-dlg .avail-facts");
    check(`[${tag}] keine Unterbrüche, Daten seit`, zf.includes(T.always) && zf.includes(T.since), zf);
    await tap('dialog.stat-dlg [data-stat="close"]');
    await tap('dialog.device [data-dlg="close"]');

    // Lücke ohne Daten (HA lief nicht)
    await tap(mobile ? '.mc[data-open="c"]' : 'tr[data-open="c"]');
    await tap('dialog.device [data-dlg="stat"][data-range="7d"]');
    check(`[${tag}] Lücke: schraffiert und in der Legende`, await wait(`return !!r.querySelector("dialog.stat-dlg .seg.none") && r.querySelector("dialog.stat-dlg .avail-legend").textContent.includes(${JSON.stringify(T.none)})`));
    await tap('dialog.stat-dlg [data-stat="close"]');
    await tap('dialog.device [data-dlg="close"]');

    // Gerät verschwindet, während das Popup offen ist
    await tap(mobile ? '.mrow[data-open="n"]' : 'tr[data-open="n"]');
    await p.evaluate(() => { window.__devices = window.__devices.filter((d) => d.id !== "n"); });
    await f.evaluate(() => document.querySelector("device-panel")._fetch());
    check(`[${tag}] Gerät weg: Hinweis`, await wait(`return r.querySelector("dialog.device .dlg-note")?.textContent === ${JSON.stringify(T.gone)}`));
    await tap('dialog.device [data-dlg="close"]');

    // HA-Geräteseite öffnen: Navigation im Elternfenster, Popup zu
    await tap(mobile ? '.mc[data-open="b"]' : 'tr[data-open="b"]');
    await tap('[data-dlg="open-device"]');
    check(`[${tag}] HA-Geräteseite`, (await p.evaluate(() => window.__nav.at(-1))) === "/config/devices/device/b" && !(await isOpen("device")));

    check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
    const over = await ev(`return document.documentElement.scrollWidth - innerWidth`);
    check(`[${tag}] kein Überlauf der Seite`, over <= 1, String(over));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
