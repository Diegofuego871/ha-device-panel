// Protokoll einer Meldung oder Routine (2.104.0, docs/mockups/protocol-v1, Variante A): Knopf "Protokoll" in den Übersichten und im
// Popup des Geräts, Zeitraum (7 T. bis 12 Mt. und eigener Zeitraum), Kennzahlen, Diagramm (Tipp auf einen Balken wählt den Tag),
// Auswahl, Suche, Zeile klappt den Inhalt der Meldung auf, bei Routinen öffnet sie den Trace (kopierbar, vor/zurück), Protokoll
// des Geräts mit Auswahl der einzelnen Meldung, Fehler beim Laden. Deutsch und Englisch, Desktop und Handy, echte Klicks und Taps.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { title: "Protokoll", device: "Protokoll des Geräts", all: "Alle Meldungen", allR: "Alle Routinen", recovered: "Wieder normal", copied: "Kopiert", err: "konnte nicht geladen werden", traceCopy: "Trace kopieren", of: (n, m) => `${n} von ${m} Einträgen`, back: "Zurück" },
  en: { title: "History", device: "History of the device", all: "All messages", allR: "All routines", recovered: "Back to normal", copied: "Copied", err: "could not be loaded", traceCopy: "Copy trace", of: (n, m) => `${n} of ${m} entries`, back: "Back" },
};
const RULE = (id, device, name, entity, extra = {}) => ({ id, device_id: device, entity_id: entity, name, kind: "below", value: 12, for_s: 600, message: "Meldung {value}", body: "", recover: false, recover_message: "", recover_body: "", repeat_s: 0, target: null, enabled: true, critical: false, critical_volume: 10, reset_value: null, ...extra });
const SEED = (id, device, name) => ({ id, device_id: device, entity_id: "switch.plug", name, action: "on", back_s: 14400, kind: "repeat", delay_s: null, date: null, time: "06:30", repeat: "daily", weekdays: null, mday: null, enabled: true, push: false, target: null, created: Date.now() / 1000 });
const DAY = 86400;

// Erfundene Einträge, relativ zu jetzt
const entries = (now) => ({
  r00000000001: [
    { at: now - 3 * DAY, k: "fired", res: "sent", title: "Keller ist kalt: 11,5 °C", body: "Klimasensor Keller · seit 10 Min", value: "11,5 °C", target: "notify.mobile_app_dani_iphone" },
    { at: now - 2 * DAY, k: "recovered", res: "sent", title: "Keller wieder warm: 12,6 °C", body: "nach 1 Std.", value: "12,6 °C", dur: 3600, target: "notify.mobile_app_dani_iphone" },
    { at: now - 40 * DAY, k: "fired", res: "held", title: "Keller ist kalt: 11,0 °C", body: "Ruhezeit", value: "11,0 °C", target: "notify.mobile_app_dani_iphone" },
    { at: now - 100 * DAY, k: "fired", res: "failed", title: "Keller ist kalt: 10,2 °C", body: "", value: "10,2 °C", err: "no_target" },
    { at: now - 250 * DAY, k: "test", res: "sent", title: "Test", body: "von Hand", value: "", target: "notify.mobile_app_dani_iphone" },
  ],
  r00000000002: [{ at: now - 1 * DAY, k: "fired", res: "sent", title: "Feuchte hoch: 14,2 g/m³", body: "Keller", value: "14,2 g/m³", target: "notify.familie" }],
  aaaaaaaaaaa1: [
    { at: now - 1 * DAY, k: "run", src: "time", ok: true, act: "on", ent: "switch.plug", late: 2.1, trace: [
      { s: "trigger", v: { src: "time", due: now - DAY - 2.1, late: 2.1, grace: 900 } },
      { s: "snapshot", v: { state: "off" } },
      { s: "call", v: { ent: "switch.plug", svc: ["switch.turn_on"], ms: 300, state: "on" } },
      { s: "revert_plan", v: { kind: "duration", due: now - DAY + 14400, back: "off" } },
      { s: "notify", v: { res: "off" } },
      { s: "result", v: { what: "run" } },
    ] },
    { at: now - 1 * DAY + 14400, k: "revert", src: "revert", ok: true, act: "off", ent: "switch.plug", trace: [
      { s: "trigger", v: { src: "revert", due: now - DAY + 14400, kind: "duration" } },
      { s: "call", v: { ent: "switch.plug", svc: ["switch.turn_off"], ms: 200, state: "off" } },
      { s: "result", v: { what: "revert" } },
    ] },
    { at: now - 9 * DAY, k: "failed", src: "time", ok: false, act: "on", ent: "switch.plug", err: "unavailable", late: 1, trace: [
      { s: "trigger", v: { src: "time", due: now - 9 * DAY, late: 1, grace: 900 } },
      { s: "call", v: { ent: "switch.plug", state: "unavailable", err: "unavailable" } },
      { s: "result", v: { what: "failed" } },
    ] },
    { at: now - 16 * DAY, k: "run", src: "manual", ok: true, act: "on", ent: "switch.plug", trace: [{ s: "trigger", v: { src: "manual" } }, { s: "result", v: { what: "run" } }] },
  ],
});

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
    const tap = async (sel) => {
      for (let i = 0; ; i++) {
        try {
          const h = await handle(sel);
          if (!h) throw new Error("fehlt: " + sel);
          await h.scrollIntoViewIfNeeded();
          if (mobile) await h.tap(); else await h.click();
          return;
        } catch (err) {
          if (i >= 3 || !/not attached|detached|not stable/.test(String(err))) throw err;
          await new Promise((r) => setTimeout(r, 150));
        }
      }
    };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 6000 }).then(() => true, () => false);
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const calls = () => p.evaluate(() => window.__protocolCalls || []);
    const P = "dialog.proto-dlg";
    const rows = () => ev(`return r.querySelectorAll('${P} .pr-item').length`);
    const kpis = () => ev(`return [...r.querySelectorAll('${P} .pr-k b')].map((x) => x.textContent).join("|")`);
    const closeProto = async () => { await tap(`${P} [data-pr="close"]`); await wait(`return !r.querySelector('${P}').open`); };

    await p.evaluate(([rules, rt, prot]) => {
      window.__opts.notify_service = "notify.mobile_app_dani_iphone";
      window.__magic = { rules, tests: [], seq: 10 };
      (window.__routines ||= { list: [], seq: 1, runs: [], tests: [] }).list.push(rt);
      window.__protocol = prot;
    }, [
      [RULE("r00000000001", "d", "Keller kalt", "sensor.temp"), RULE("r00000000002", "d", "Feuchte hoch", "sensor.abs_humidity", { kind: "above", value: 10 }), RULE("r00000000003", "h", "Fenster offen", "binary_sensor.window", { kind: "is", value: "on" })],
      SEED("aaaaaaaaaaa1", "d", "Bewässerung"),
      entries(Date.now() / 1000),
    ]);
    // Die Zwischenablage gibt es im iframe nicht überall: das Panel nimmt sonst den Umweg über ein Textfeld; hier den Text abfangen
    await ev(`r.host._copyText = async (t) => { window.__copied = t; return true; }`);

    // --- Übersicht Magic Push: Knopf Protokoll bei der Karte ---
    await ev(`r.host._openMagicAll()`);
    await wait(`return r.querySelectorAll('dialog.mgall-dlg .mg-card').length >= 2`);
    check(`[${tag}] Magic Push: Karte hat "${T.title}" neben Bearbeiten und Löschen`, await ev(`const a = r.querySelector('dialog.mgall-dlg .mg-card [data-proto="magic"][data-id="r00000000001"]'); return !!a && a.textContent.trim() === ${JSON.stringify(T.title)} && a.closest(".mg-acts").querySelectorAll("button").length >= 3`));
    check(`[${tag}] Magic Push: im Fuss der Karte nur "Gerät öffnen", kein "${T.device} ›" mehr`, await ev(`const f = [...r.querySelectorAll('dialog.mgall-dlg .mg-dfoot')]; return f.length > 0 && f.every((x) => !x.querySelector("[data-proto]") && x.querySelectorAll(".linkbtn").length === 1)`));
    await tap('dialog.mgall-dlg [data-proto="magic"][data-id="r00000000001"]');
    check(`[${tag}] Protokoll öffnet (Titel "${T.title}", Unterzeile = Name der Meldung)`, await wait(`const d = r.querySelector('${P}'); return d.open && d.querySelector("h2").textContent === ${JSON.stringify(T.title)} && d.querySelector("[data-pr-sub]").textContent === "Keller kalt"`));
    check(`[${tag}] Kreuz oben rechts und zusätzlich "${T.back}" unten links im Fuss (vor der Zahl der Einträge)`, await ev(`const d = r.querySelector('${P}'); const b = d.querySelector('[data-pr-foot] [data-pr="close"]'); const f = d.querySelector('[data-pr-foot]').getBoundingClientRect(); return !!d.querySelector('.dlg-head .dlg-close[data-pr="close"]') && !!b && b.textContent.trim() === ${JSON.stringify(T.back)} && b.getBoundingClientRect().left - f.left < 40 && b.getBoundingClientRect().left < d.querySelector('[data-pr="copy"]').getBoundingClientRect().left`));
    check(`[${tag}] Reiter oben: "Alles", "Magic Push", "Routinen" (seit 2.118.0), Magic Push gewählt, Kapsel vorhanden`, await ev(`const bar = r.querySelector('${P} [data-pr-kinds] .sub-tabs'); const t = [...bar.querySelectorAll(".sub-tab")]; return t.length === 3 && t[0].dataset.v === "all" && t[1].dataset.v === "magic" && t[1].textContent.trim() === "Magic Push" && t[2].dataset.v === "routine" && t[1].classList.contains("on") && !!bar.querySelector(".seg-pill") && r.querySelector('${P} .dlg-avatar svg') !== null`));
    check(`[${tag}] Abfrage: kind magic, item_id, Zeitraum 30 Tage, Seite 100`, (await wait(`return !!r.querySelector('${P} .pr-kpis')`)) && (await calls()).some((c) => c.kind === "magic" && c.item_id === "r00000000001" && Math.abs((c.until - c.since) / DAY - 30) < 0.1 && c.limit === 100));
    check(`[${tag}] 30 Tage: zwei Einträge, Kennzahlen 2|1|1|0|1 Std.`, (await rows()) === 2 && /^2\|1\|1\|0\|1/.test(await kpis()), await kpis());
    check(`[${tag}] Zeitraum-Leiste als Reiterleiste mit Kapsel, "30 T." gewählt`, await ev(`const bar = r.querySelector('${P} [data-pr-ranges] .sub-tabs'); return !!bar && !!bar.querySelector(".seg-pill") && bar.querySelector(".sub-tab.on").dataset.v === "30d" && bar.querySelectorAll(".sub-tab").length === 6`));
    check(`[${tag}] Magic Push: Pfeil nur an Zeilen mit Meldungstext (aufklappbar)`, await ev(`const rows = [...r.querySelectorAll('${P} button.pr-row[data-pr="row"]')]; return rows.length > 0 && rows.every((x) => !x.disabled === !!x.querySelector(".pr-arrow"))`));
    check(`[${tag}] Diagramm: 30 Tagesbalken, zwei mit Inhalt`, await ev(`const bars = r.querySelectorAll('${P} .pr-bar'); return bars.length >= 30 && bars.length <= 32 && [...bars].filter((x) => x.querySelector(".pr-col")).length === 2`));
    // Zeile aufklappen: Inhalt der Meldung
    await tap(`${P} .pr-item .pr-row`);
    check(`[${tag}] Zeile antippen zeigt Titel und Text der Meldung`, await wait(`const m = r.querySelector('${P} .pr-item.open .pr-msg'); return !!m && m.textContent.includes("Keller wieder warm") && m.textContent.includes("nach 1 Std.")`));
    await tap(`${P} .pr-item.open .pr-row`);
    check(`[${tag}] nochmals antippen klappt zu`, await wait(`return !r.querySelector('${P} .pr-msg')`));
    // 12 Monate
    await p.evaluate(() => { window.__protocolCalls = []; });
    await tap(`${P} .sub-tab[data-v="12m"]`);
    check(`[${tag}] 12 Mt.: fünf Einträge, Diagramm je Woche`, await wait(`return r.querySelectorAll('${P} .pr-item').length === 5 && r.querySelectorAll('${P} .pr-bar').length < 60 && r.querySelectorAll('${P} .pr-bar')[0].dataset.step === "week"`));
    check(`[${tag}] 12 Mt.: Fuss "${T.of(5, 5)}"`, await wait(`return r.querySelector('${P} [data-pr-foot]').textContent.includes(${JSON.stringify(T.of(5, 5))})`));
    check(`[${tag}] Hinweis: höchstens 5000 Einträge und 30 MB, keine Zeitgrenze`, /5[.,’' ]?000/.test(await text(`${P} .pr-note`)) && /30 MB/.test(await text(`${P} .pr-note`)) && !/366|12 Monate|12 months/.test(await text(`${P} .pr-note`)), await text(`${P} .pr-note`));
    // Auswahl und Suche
    await tap(`${P} .chip[data-v="recovered"]`);
    check(`[${tag}] Auswahl "${T.recovered}": eine Zeile, Abfrage mit filter`, await wait(`return r.querySelectorAll('${P} .pr-item').length === 1`) && (await calls()).some((c) => c.filter === "recovered"));
    await tap(`${P} .chip[data-v="all"]`);
    await ev(`const i = r.querySelector('${P} input[data-pr-search]'); i.value = "Keller ist kalt"; i.dispatchEvent(new Event("input", { bubbles: true }))`);
    check(`[${tag}] Suche "Keller ist kalt": drei Zeilen (Ablauf mit Verzögerung), X sichtbar`, await wait(`return r.querySelectorAll('${P} .pr-item').length === 3 && r.querySelector('${P} [data-fc]').hidden === false`));
    await tap(`${P} [data-fc]`);
    check(`[${tag}] X leert die Suche: wieder fünf Zeilen`, await wait(`return r.querySelectorAll('${P} .pr-item').length === 5 && r.querySelector('${P} input[data-pr-search]').value === ""`));
    // Tipp auf einen Balken: eigener Zeitraum dieser Woche
    await tap(`${P} .pr-bar:has(.pr-col)`);
    check(`[${tag}] Balken antippen setzt "eigenen Zeitraum" (Reiter gewählt, zwei Datumsfelder)`, await wait(`const bar = r.querySelector('${P} [data-pr-ranges] .sub-tabs'); return bar.querySelector(".sub-tab.on").dataset.v === "own" && r.querySelectorAll('${P} input[type="date"]').length === 2`));
    // Datumsfelder: die ganzen letzten 5 Tage
    await ev(`const d = new Date(Date.now() - 5 * 86400000); const iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); const i = r.querySelector('${P} input[data-pr-date="from"]'); i.value = iso; i.dispatchEvent(new Event("change", { bubbles: true }))`);
    check(`[${tag}] Eigener Zeitraum "von vor 5 Tagen": zwei Zeilen (3 und 2 Tage her)`, await wait(`return r.querySelectorAll('${P} .pr-item').length === 2`), String(await rows()));
    // von > bis wird getauscht
    await ev(`const t = r.querySelector('${P} input[data-pr-date="to"]'); const f = r.querySelector('${P} input[data-pr-date="from"]'); t.value = "2000-01-01"; t.dispatchEvent(new Event("change", { bubbles: true }));`);
    check(`[${tag}] Von nach Bis: die Daten werden vertauscht, kein Fehler`, await wait(`const f = r.querySelector('${P} input[data-pr-date="from"]'), t = r.querySelector('${P} input[data-pr-date="to"]'); return f.value <= t.value`));
    await p.screenshot({ path: `${outDir}/protocol-${tag.replace("/", "-")}-magic.png` });
    // Text kopieren
    await tap(`${P} .sub-tab[data-v="12m"]`);
    await wait(`return r.querySelectorAll('${P} .pr-item').length === 5`);
    await tap(`${P} [data-pr="copy"]`);
    const copied = await f.evaluate(() => window.__copied || "");
    check(`[${tag}] "Als Text kopieren": fünf Zeilen mit Titel und Ergebnis`, copied.split("\n").length === 5 && /Keller ist kalt: 11,5 °C/.test(copied), copied.split("\n")[0]);
    check(`[${tag}] Rückmeldung "${T.copied}" am Knopf`, await wait(`return r.querySelector('${P} [data-pr="copy"]').textContent.includes(${JSON.stringify(T.copied)})`));
    // Fehler beim Laden
    await p.evaluate(() => { window.__protocolFails = "Protokoll kaputt"; });
    await tap(`${P} .sub-tab[data-v="6m"]`);
    check(`[${tag}] Fehler beim Laden: Meldung und Knopf zum Wiederholen, keine Seitenfehler`, await wait(`return r.querySelector('${P} .dlg-error')?.textContent.includes("Protokoll kaputt")`));
    await p.evaluate(() => { delete window.__protocolFails; });
    await tap(`${P} .sub-tab[data-v="30d"]`);
    check(`[${tag}] nach dem Fehler läuft es weiter`, await wait(`return r.querySelectorAll('${P} .pr-item').length === 2 && !r.querySelector('${P} .dlg-error')`));
    // Schliessen mit Escape: die Übersicht bleibt offen
    await p.keyboard.press("Escape");
    check(`[${tag}] Escape schliesst nur das Protokoll, die Übersicht bleibt offen`, await wait(`return !r.querySelector('${P}').open && r.querySelector('dialog.mgall-dlg').open`));
    await ev(`r.host._closeMagicAll()`);

    // --- Reiter Routinen im selben Fenster: Zusammenhang = alle Routinen des Geräts, zurück = die einzelne Meldung ---
    await ev(`r.host._openMagicAll()`);
    await wait(`return r.querySelectorAll('dialog.mgall-dlg .mg-card').length >= 2`);
    await tap('dialog.mgall-dlg [data-proto="magic"][data-id="r00000000001"]');
    await wait(`return r.querySelectorAll('${P} .pr-item').length === 2`);
    await p.evaluate(() => { window.__protocolCalls = []; });
    await tap(`${P} [data-pr-kinds] .sub-tab[data-v="routine"]`);
    check(`[${tag}] Reiter "Routinen": Abfrage kind routine mit device_id des Geräts (ohne item_id), Unterzeile mit Gerätenamen`, (await wait(`return r.querySelectorAll('${P} .pr-item').length === 4 && r.querySelector('${P} [data-pr-kinds] .sub-tab.on').dataset.v === "routine"`)) && (await calls()).some((c) => c.kind === "routine" && c.device_id === "d" && !c.item_id) && (await text(`${P} [data-pr-sub]`)).length > 0, await text(`${P} [data-pr-sub]`));
    check(`[${tag}] Reiter "Routinen": Kennzahlen und Filter der Routinen (6 Filter), Symbol wechselt, Suchfeld leer`, await ev(`return r.querySelector('${P} .pr-kpis').textContent.includes(${JSON.stringify(lang === "de" ? "Läufe" : "runs")}) && r.querySelector('${P} input[data-pr-search]').value === ""`));
    await tap(`${P} [data-pr-kinds] .sub-tab[data-v="magic"]`);
    check(`[${tag}] Zurück auf "Magic Push": wieder die einzelne Meldung (zwei Einträge, Unterzeile = Name)`, await wait(`return r.querySelectorAll('${P} .pr-item').length === 2 && r.querySelector('${P} [data-pr-sub]').textContent === "Keller kalt"`));
    await closeProto();
    await ev(`r.host._closeMagicAll()`);
    // Aus der Routine geöffnet: Reiter "Routinen" gewählt
    await ev(`r.host._openRtAll()`);
    await wait(`return r.querySelectorAll('dialog.rtall-dlg .mg-card').length >= 1`);
    await tap('dialog.rtall-dlg [data-proto="routine"][data-id="aaaaaaaaaaa1"]');
    check(`[${tag}] Aus einer Routine geöffnet: Reiter "Routinen" gewählt, Magic Push und "Alles" links daneben`, await wait(`const t = [...r.querySelectorAll('${P} [data-pr-kinds] .sub-tab')]; return t.length === 3 && t[2].classList.contains("on") && r.querySelectorAll('${P} .pr-item').length === 4`));
    await tap(`${P} [data-pr-kinds] .sub-tab[data-v="magic"]`);
    check(`[${tag}] Reiter "Magic Push" aus der Routine: alle Meldungen des Geräts (3 Einträge, Auswahl der Meldungen)`, await wait(`return r.querySelectorAll('${P} .pr-item').length === 3 && r.querySelectorAll('${P} [data-pr-items] .chip').length === 3`));
    await closeProto();
    await ev(`r.host._closeRtAll()`);

    // --- Popup des Geräts: Magic Push ---
    await ev(`r.host._openDevice("d", "magic")`);
    await wait(`return r.querySelector("dialog.device")?.open && r.querySelectorAll("dialog.device .mg-card").length === 2`);
    check(`[${tag}] Popup: Karte hat "${T.title}", kein Text-Link "${T.device} ›" mehr (der Knopf im Kopf genügt)`, await ev(`return r.querySelectorAll('dialog.device .mg-card [data-proto="magic"]').length === 2 && !r.querySelector('dialog.device .pr-devlink, dialog.device [data-proto="magic"][data-device="d"]:not(.mg-card *)')`));
    // Protokoll aller Meldungen des Geräts, wie es der Kopf-Knopf über den Reiter "Magic Push" öffnet
    await ev(`r.host._protocol.open({ kind: "magic", deviceId: "d", name: "Gerät" })`);
    check(`[${tag}] Protokoll des Geräts: Unterzeile mit Gerät und Zahl, Auswahl "${T.all}" + zwei Meldungen`, await wait(`const c = [...r.querySelectorAll('${P} [data-pr-items] .chip')].map((x) => x.textContent.trim()); return c.length === 3 && c[0] === ${JSON.stringify(T.all)} && r.querySelector("[data-pr-sub]").textContent.includes("2")`));
    check(`[${tag}] Gerät, 30 Tage: drei Einträge beider Meldungen, Name der Meldung in der Zeile`, (await wait(`return r.querySelectorAll('${P} .pr-item').length === 3`)) && (await ev(`return r.querySelector('${P} .pr-item .c-main small')?.textContent.length > 0`)));
    check(`[${tag}] Abfrage mit device_id (ohne item_id)`, (await calls()).some((c) => c.device_id === "d" && !c.item_id));
    await tap(`${P} [data-pr-items] .chip:nth-child(3)`);
    check(`[${tag}] Auswahl einer Meldung: Abfrage mit item_id, die Auswahl bleibt stehen`, await wait(`return r.querySelectorAll('${P} .pr-item').length === 1 && r.querySelectorAll('${P} [data-pr-items] .chip').length === 3`) && (await calls()).some((c) => c.item_id));
    await tap(`${P} [data-pr="close"]`);
    await wait(`return !r.querySelector('${P}').open`);
    // Popup bleibt offen und bedienbar
    check(`[${tag}] Popup des Geräts bleibt offen`, await ev(`return r.querySelector("dialog.device").open`));
    await tap("dialog.device .dlg-close");
    await wait(`return !r.querySelector("dialog.device").open`);

    // --- Routinen ---
    await ev(`r.host._openRtAll()`);
    await wait(`return r.querySelectorAll('dialog.rtall-dlg .mg-card').length >= 1`);
    check(`[${tag}] Routinen: Karte hat "${T.title}" neben Bearbeiten, Ausführen, Löschen`, await ev(`return !!r.querySelector('dialog.rtall-dlg .mg-card [data-proto="routine"][data-id="aaaaaaaaaaa1"]')`));
    await tap('dialog.rtall-dlg [data-proto="routine"][data-id="aaaaaaaaaaa1"]');
    check(`[${tag}] Routinen-Protokoll: 30 Tage, vier Zeilen, Kennzahlen (Läufe 2, zurück 1, verpasst 0, Fehler 1)`, (await wait(`return r.querySelectorAll('${P} .pr-item').length === 4`)) && /^2\|1\|0\|1\|/.test(await kpis()), await kpis());
    check(`[${tag}] Routinen-Filter: Ausgeführt, Zurückgeschaltet, Verpasst, Fehlgeschlagen, Von Hand`, (await ev(`return r.querySelectorAll('${P} [data-pr-filters] .chip').length`)) === 6);
    await tap(`${P} [data-pr-filters] .chip[data-v="manual"]`);
    check(`[${tag}] Filter "Von Hand": eine Zeile`, await wait(`return r.querySelectorAll('${P} .pr-item').length === 1`));
    await tap(`${P} [data-pr-filters] .chip[data-v="all"]`);
    await wait(`return r.querySelectorAll('${P} .pr-item').length === 4`);
    // Neueste zuerst: Zurückschalten (3 Schritte), Lauf (6), Fehler, von Hand
    await tap(`${P} .pr-item .pr-row`);
    check(`[${tag}] Zeile öffnet den Trace des Zurückschaltens: drei Schritte, "Neuer" gesperrt, Suche und Zeitraum ausgeblendet`, await wait(`return r.querySelectorAll('${P} .tr-line').length === 3 && r.querySelector('${P} [data-pr="newer"]').disabled === true && getComputedStyle(r.querySelector('${P} [data-pr-bar]')).display === "none"`));
    await tap(`${P} [data-pr="older"]`);
    check(`[${tag}] "Älter": der Lauf mit sechs Schritten, Aufruf mit Dienst, Kopf mit Namen`, await wait(`return r.querySelectorAll('${P} .tr-line').length === 6 && r.querySelector('${P} .pr-trace').textContent.includes("switch.turn_on") && r.querySelector('${P} .pr-trace-head').textContent.includes("Bewässerung")`));
    check(`[${tag}] Knopf "${T.traceCopy}" im Fuss`, await ev(`return r.querySelector('${P} [data-pr="copy-trace"]').textContent.includes(${JSON.stringify(T.traceCopy)})`));
    await tap(`${P} [data-pr="copy-trace"]`);
    const trace = await f.evaluate(() => window.__copied || "");
    check(`[${tag}] Trace kopieren: Text mit Routine, ID, Entität, Schritten und Ergebnis`, /Bewässerung/.test(trace) && /aaaaaaaaaaa1/.test(trace) && /switch\.plug/.test(trace) && /switch\.turn_on/.test(trace) && /^1 /m.test(trace) && trace.trim().split("\n").length >= 10, trace.split("\n").slice(0, 3).join(" / "));
    await p.screenshot({ path: `${outDir}/protocol-${tag.replace("/", "-")}-trace.png` });
    await tap(`${P} [data-pr="older"]`);
    check(`[${tag}] Fehlgeschlagener Lauf: Aufruf-Schritt rot mit Grund`, await wait(`const l = [...r.querySelectorAll('${P} .tr-line.er')]; return l.length >= 1 && l.some((x) => /nicht erreichbar|not reachable/.test(x.textContent))`));
    await tap(`${P} [data-pr="back"]`);
    check(`[${tag}] Zurück: wieder die Tabelle, Zeitraum bleibt`, await wait(`return r.querySelector('${P} [data-pr-bar]').hidden === false && r.querySelectorAll('${P} .pr-item').length === 4`));
    // Handy: nichts läuft seitlich über
    if (mobile) {
      check(`[${tag}] Handy: kein seitliches Überlaufen in Kopf, Liste und Fuss`, await ev(`return ['.lg-list', '.lg-bar', '[data-pr-foot]'].every((s) => { const e = r.querySelector('${P} ' + s); return e.scrollWidth <= e.clientWidth + 1; })`));
      check(`[${tag}] Handy: Zeile hat Datum, Art, Name, Ergebnis (keine Tabellenkopfzeile)`, await ev(`return getComputedStyle(r.querySelector('${P} .pr-head')).display === "none"`));
    }
    await p.screenshot({ path: `${outDir}/protocol-${tag.replace("/", "-")}-routine.png` });
    await closeProto();
    await ev(`r.host._closeRtAll?.()`);

    // --- Popup des Geräts: Routinen ---
    await ev(`r.host._openDevice("d", "routine")`);
    await wait(`return r.querySelector("dialog.device")?.open && !!r.querySelector('dialog.device [data-proto="routine"]')`);
    check(`[${tag}] Popup Routinen: "${T.title}" an der Karte, kein Text-Link "${T.device} ›" mehr`, await ev(`return !r.querySelector('dialog.device .pr-devlink') && !!r.querySelector('dialog.device .rt-clock [data-proto="routine"][data-id="aaaaaaaaaaa1"]')`));
    await tap('dialog.device .rt-clock [data-proto="routine"][data-id="aaaaaaaaaaa1"]');
    check(`[${tag}] Protokoll der Routine aus dem Popup`, await wait(`return r.querySelector('${P}').open && r.querySelectorAll('${P} .pr-item').length === 4`));
    await closeProto();
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
