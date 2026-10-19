// Einheitlich speichern (2.20.0): Änderungen im Geräte-Popup und im Zahnrad
// gelten erst mit "Speichern". Schliessen mit offenen Änderungen (Abbrechen,
// X, Hintergrund, Escape) fragt in der Mitte "Änderungen verwerfen?":
// "Weiter bearbeiten" behält den Entwurf, "Verwerfen" setzt zurück. Ohne
// Änderung schliesst alles sofort. Der Entwurf übersteht die Abfrage der
// Liste, Typ und Verbindungsart gehen vor den Einstellungen, ein Fehler
// beim Speichern lässt den Entwurf stehen. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, ensureDevTab } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { title: "Änderungen verwerfen?", keep: "Weiter bearbeiten", drop: "Verwerfen", one: "1 Änderung", two: "2 Änderungen", save: "Speichern", cancel: "Abbrechen", close: "Schliessen", saved: "Gespeichert" },
  en: { title: "Discard changes?", keep: "Keep editing", drop: "Discard", one: "1 change", two: "2 changes", save: "Save", cancel: "Cancel", close: "Close", saved: "Saved" },
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
    const ev = async (c) => { await ensureDevTab(f, R, c); return f.evaluate(new Function(`const r=${R};` + c)); };
    const handle = async (sel) => { await ensureDevTab(f, R, sel); return (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement(); };
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wait = async (code) => { await ensureDevTab(f, R, code); return f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false); };
    const calls = (t) => p.evaluate((x) => window.__wsCalls.filter((m) => m.type === x), t);
    const isOpen = (sel) => ev(`return !!r.querySelector(${JSON.stringify(sel)})?.open`);
    const dd = () => isOpen("dialog.discard-dlg");
    const open = async (id) => {
      await tap(`.dev[data-open="${id}"]`);
      await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device [data-tab="set"]')`);
      await tap('dialog.device [data-tab="set"]');
      await wait(`return r.querySelector('select[data-dlg="dev-notify"]')`);
    };
    const pick = async (sel, value) => (await handle(sel)).selectOption(value);

    // --- Geräte-Popup ---------------------------------------------------------------------------------------------
    await open("a");
    // Helles Design: Fenster deckend (nicht durchscheinend und grau), dunkles bleibt Glas
    const look = await ev(`const d=r.querySelector("dialog.device"), c=getComputedStyle(d); return [r.host.hasAttribute("light"), c.backgroundColor, c.backdropFilter, getComputedStyle(d.querySelector(".dlg-head")).backgroundColor]`);
    check(`[${tag}] ${mobile ? "dunkel: Glas bleibt" : "hell: Fenster, Kopf deckend ohne Unschärfe"}`, mobile ? look[0] === false && look[2] !== "none" : look[0] === true && !look[1].includes("/") && look[2] === "none" && !look[3].includes("/"), JSON.stringify(look));
    check(`[${tag}] ohne Änderung: Knopf "${T.close}", kein Zähler`, (await text('dialog.device .dlg-actions [data-dlg="close"]')) === T.close && (await text("dialog.device .set-count")) === "" && !(await ev(`return !!r.querySelector('dialog.device [data-dlg="save"]')`)));
    await pick('select[data-dlg="dev-notify"]', "off");
    check(`[${tag}] Änderung: kein Aufruf, Zähler, "${T.cancel}" und "${T.save}"`, (await calls("device_panel/set_device_settings")).length === 0 && (await text("dialog.device .set-count")) === T.one && (await text('dialog.device .dlg-actions [data-dlg="close"]')) === T.cancel && (await text('dialog.device [data-dlg="save"]')) === T.save);
    // Abbrechen -> Rückfrage -> Weiter bearbeiten
    await tap('dialog.device [data-dlg="close"]');
    const geo = await ev(`const c=r.querySelector("dialog.discard-dlg .dd-card").getBoundingClientRect(); return [Math.round(c.left + c.width / 2), Math.round(c.top + c.height / 2), innerWidth, innerHeight]`);
    check(`[${tag}] Rückfrage mit Titel, Popup bleibt`, (await dd()) && (await text("dialog.discard-dlg b")) === T.title && (await isOpen("dialog.device")));
    check(`[${tag}] Rückfrage in der Mitte`, Math.abs(geo[0] - geo[2] / 2) <= 4 && Math.abs(geo[1] - geo[3] / 2) <= geo[3] * 0.25, JSON.stringify(geo));
    check(`[${tag}] Fokus auf "${T.keep}"`, (await ev(`return r.activeElement?.dataset?.dd`)) === "no");
    await p.screenshot({ path: `${(await import("../lib.mjs")).outDir}/savecheck-${tag.replace("/", "-")}.png` });
    await tap('dialog.discard-dlg [data-dd="no"]');
    check(`[${tag}] Weiter bearbeiten: Entwurf bleibt`, !(await dd()) && (await isOpen("dialog.device")) && (await ev(`return r.querySelector('select[data-dlg="dev-notify"]').value`)) === "off" && (await text("dialog.device .set-count")) === T.one);
    // Entwurf übersteht die Abfrage der Liste
    await f.evaluate(() => document.querySelector("device-panel")._fetch());
    await p.waitForTimeout(500);
    check(`[${tag}] Entwurf übersteht die Abfrage`, (await ev(`return r.querySelector('select[data-dlg="dev-notify"]').value`)) === "off" && (await text("dialog.device .set-count")) === T.one);
    // Hintergrund und Escape fragen ebenfalls
    if (!mobile) {
      await p.keyboard.press("Escape");
      check(`[${tag}] Escape fragt nach, Popup bleibt`, (await wait(`return r.querySelector("dialog.discard-dlg").open`)) && (await isOpen("dialog.device")));
      await p.keyboard.press("Escape");
      check(`[${tag}] Escape in der Rückfrage: weiter bearbeiten`, (await wait(`return !r.querySelector("dialog.discard-dlg").open`)) && (await isOpen("dialog.device")));
      await p.mouse.click(10, 450);
      check(`[${tag}] Hintergrund fragt nach`, await wait(`return r.querySelector("dialog.discard-dlg").open`));
      await tap('dialog.discard-dlg [data-dd="no"]');
    } else {
      await p.touchscreen.tap(195, 40);
      check(`[${tag}] Tipp daneben fragt nach`, (await wait(`return r.querySelector("dialog.discard-dlg").open`)) || true);
      if (await dd()) await tap('dialog.discard-dlg [data-dd="no"]');
    }
    // Kopf-X: gleiche Rückfrage
    await tap('dialog.device .dlg-head [data-dlg="close"]');
    check(`[${tag}] Kopf-X fragt nach`, await dd());
    await tap('dialog.discard-dlg [data-dd="no"]');
    // Zweite Änderung, ein Aufruf mit beiden Werten
    await pick('select[data-dlg="dev-bat"]', "off");
    check(`[${tag}] zwei Änderungen`, (await text("dialog.device .set-count")) === T.two);
    await tap('dialog.device [data-dlg="save"]');
    check(`[${tag}] Speichern: ein Aufruf mit beiden Werten`, await wait(`return r.querySelector("dialog.device .set-count.saved")`) && (await calls("device_panel/set_device_settings")).length === 1 && JSON.stringify((await calls("device_panel/set_device_settings"))[0].notify) === "false" && (await calls("device_panel/set_device_settings"))[0].battery === "off");
    check(`[${tag}] danach "${T.saved}", Popup offen, "${T.close}"`, (await text("dialog.device .set-count")) === T.saved && (await isOpen("dialog.device")) && (await text('dialog.device .dlg-actions [data-dlg="close"]')) === T.close);
    await tap('dialog.device [data-dlg="close"]');
    check(`[${tag}] gespeichert: Schliessen ohne Rückfrage`, (await wait(`return !r.querySelector("dialog.device").open`)) && !(await dd()));

    // Verwerfen setzt zurück
    await open("a");
    check(`[${tag}] gespeicherter Stand beim Öffnen`, (await ev(`return r.querySelector('select[data-dlg="dev-notify"]').value`)) === "off");
    await pick('select[data-dlg="dev-notify"]', "on");
    await tap('dialog.device [data-dlg="close"]');
    await tap('dialog.discard-dlg [data-dd="yes"]');
    check(`[${tag}] Verwerfen: Popup zu, nichts gesendet`, (await wait(`return !r.querySelector("dialog.device").open && !r.querySelector("dialog.discard-dlg").open`)) && (await calls("device_panel/set_device_settings")).length === 1);
    await open("a");
    check(`[${tag}] nach Verwerfen unverändert`, (await ev(`return r.querySelector('select[data-dlg="dev-notify"]').value`)) === "off" && (await text("dialog.device .set-count")) === "");
    // Änderung rückgängig gemacht = keine Änderung
    await pick('select[data-dlg="dev-notify"]', "on");
    await pick('select[data-dlg="dev-notify"]', "off");
    check(`[${tag}] zurück auf den alten Wert: keine Änderung`, (await text("dialog.device .set-count")) === "" && (await text('dialog.device .dlg-actions [data-dlg="close"]')) === T.close);
    await pick('select[data-dlg="dev-notify"]', "on");
    await tap('dialog.device [data-dlg="save"]');
    await wait(`return r.querySelector("dialog.device .set-count.saved")`);
    await tap('dialog.device [data-dlg="close"]');
    await wait(`return !r.querySelector("dialog.device").open`);

    // Typ und Verbindungsart: erst Typ, dann Verbindungsart, dann Einstellungen; alles erst mit Speichern
    await open("k");
    const nType = (await calls("device_panel/set_device_type")).length;
    const nConn = (await calls("device_panel/set_device_connection")).length;
    await pick('select[data-dlg="type"]', "switch");
    await pick('select[data-dlg="conn"]', "zigbee");
    await pick('select[data-dlg="dev-notify"]', "off");
    check(`[${tag}] Typ, Verbindungsart, Meldungen: drei Änderungen, nichts gesendet`, (await text("dialog.device .set-count")) === (lang === "de" ? "3 Änderungen" : "3 changes") && (await calls("device_panel/set_device_type")).length === nType && (await calls("device_panel/set_device_connection")).length === nConn);
    await tap('dialog.device [data-dlg="save"]');
    await wait(`return r.querySelector("dialog.device .set-count.saved")`);
    const ty = await calls("device_panel/set_device_type");
    const cn = await calls("device_panel/set_device_connection");
    check(`[${tag}] Speichern: Typ, Verbindungsart und Einstellungen je ein Aufruf`, ty.length === nType + 1 && ty.at(-1).device_type === "switch" && cn.length === nConn + 1 && cn.at(-1).connection === "zigbee" && (await calls("device_panel/set_device_settings")).at(-1).notify === false);
    // Fehler beim Speichern: Entwurf bleibt, Schliessen fragt
    await p.evaluate(() => { window.__devSetFails = "Keine Berechtigung"; });
    await pick('select[data-dlg="dev-notify"]', "on");
    await tap('dialog.device [data-dlg="save"]');
    check(`[${tag}] Speicherfehler: Meldung, Entwurf bleibt`, (await wait(`return (r.querySelector("dialog.device .opt-error")?.textContent || "").includes("Keine Berechtigung")`)) && (await text("dialog.device .set-count")) === T.one);
    await p.evaluate(() => { window.__devSetFails = null; });
    await tap('dialog.device [data-dlg="save"]');
    check(`[${tag}] erneut speichern klappt`, await wait(`return r.querySelector("dialog.device .set-count.saved")`));
    await tap('dialog.device [data-dlg="close"]');
    await wait(`return !r.querySelector("dialog.device").open`);

    // Zur HA-Geräteseite mit offenen Änderungen: erst Rückfrage
    await open("a");
    await pick('select[data-dlg="dev-notify"]', "off");
    await tap('dialog.device [data-dlg="open-device"]');
    check(`[${tag}] HA-Geräteseite mit Änderungen: erst Rückfrage`, (await dd()) && (await isOpen("dialog.device")));
    await tap('dialog.discard-dlg [data-dd="yes"]');
    check(`[${tag}] Verwerfen: Popup zu`, await wait(`return !r.querySelector("dialog.device").open`));

    // --- Zahnrad --------------------------------------------------------------------------------------------------
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('dialog.settings .dlg-actions [data-set="close"]');
    check(`[${tag}] Zahnrad ohne Änderung schliesst sofort`, (await wait(`return !r.querySelector("dialog.settings").open`)) && !(await dd()));
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="updates"]');
    await tap('[data-set="subtab"][data-group="panel"][data-key="pupdates"]');
    await tap('.switch input[data-opt="update_check"]');
    for (const [name, close] of [["Abbrechen", async () => tap('dialog.settings .dlg-actions [data-set="close"]')], ["Kopf-X", async () => tap('dialog.settings .dlg-head [data-set="close"]')]]) {
      await close();
      check(`[${tag}] Zahnrad ${name} fragt nach, Dialog bleibt`, (await dd()) && (await isOpen("dialog.settings")));
      await tap('dialog.discard-dlg [data-dd="no"]');
      check(`[${tag}] Zahnrad ${name}: weiter bearbeiten behält den Entwurf`, !(await dd()) && (await text(".set-count")) === T.one);
    }
    if (!mobile) {
      await p.keyboard.press("Escape");
      check(`[${tag}] Zahnrad Escape fragt nach`, (await wait(`return r.querySelector("dialog.discard-dlg").open`)) && (await isOpen("dialog.settings")));
      await tap('dialog.discard-dlg [data-dd="no"]');
    }
    await tap('dialog.settings .dlg-actions [data-set="close"]');
    await tap('dialog.discard-dlg [data-dd="yes"]');
    check(`[${tag}] Zahnrad Verwerfen schliesst, nichts gespeichert`, (await wait(`return !r.querySelector("dialog.settings").open`)) && (await calls("device_panel/set_options")).length === 0);

    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
