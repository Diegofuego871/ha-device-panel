// App-Launcher, Art "Aktion" (2.113.0): eine eigene App ruft einen Dienst von Home Assistant auf (Dienst "bereich.dienst", Daten als JSON, Rückfrage
// einstellbar). Formular (Reiter Seite/Externer Link/Aktion), Prüfung, Speichern, Ausführen mit Rückmeldung (Erfolg und Fehler), Rückfrage,
// Marke und Untertitel. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { errSvc: 'Ein Dienst braucht die Form "bereich.dienst" (homeassistant.update_entity), ein Befehl die Form "bereich/befehl" (hacs/repository/refresh).', errData: 'Die Daten müssen ein JSON-Objekt sein, zum Beispiel {"entity_id": "light.kueche"} (höchstens 2000 Zeichen; bei einem Befehl ohne "type" und "id").',
    done: '"Updates prüfen" ausgeführt', fail: '"Updates prüfen" fehlgeschlagen: Speicher voll', askTitle: '"Updates prüfen" ausführen?', askNote: "Ruft den Dienst homeassistant.update_entity auf.", cmdNote: "Führt den Befehl hacs/repository/refresh aus.", yes: "Ausführen", no: "Abbrechen", tabs: ["Seite", "Externer Link", "Aktion"] },
  en: { errSvc: 'A service needs the form "domain.service" (homeassistant.update_entity), a command the form "area/command" (hacs/repository/refresh).', errData: 'The data must be a JSON object, for example {"entity_id": "light.kitchen"} (at most 2000 characters; for a command without "type" and "id").',
    done: '"Updates prüfen" done', fail: '"Updates prüfen" failed: Speicher voll', askTitle: 'Run "Updates prüfen"?', askNote: "Calls the service homeassistant.update_entity.", cmdNote: "Runs the command hacs/repository/refresh.", yes: "Run", no: "Cancel", tabs: ["Page", "External link", "Action"] },
};

// Reine Funktionen: Aktion prüfen und gespeicherten Stand bereinigen
{
  const { checkAction, sanitizeApps } = await import("../../../custom_components/device_panel/panel/apps.js");
  check("Aktion: Dienst in der Form bereich.dienst, Daten ein Objekt, Rückfrage nur bei true",
    JSON.stringify(checkAction({ service: "homeassistant.update_entity", data: { entity_id: "update.x" }, confirm: true })) === '{"service":"homeassistant.update_entity","data":{"entity_id":"update.x"},"confirm":true}'
    && JSON.stringify(checkAction({ service: "light.turn_on" })) === '{"service":"light.turn_on","data":{},"confirm":false}');
  check("Aktion: ungültiger Dienst, Daten kein Objekt oder zu gross werden abgelehnt",
    !checkAction({ service: "kein dienst" }) && !checkAction({ service: "a.b.c" }) && !checkAction({ service: "Light.Turn_on" }) && !checkAction({ service: "a.b", data: [1] }) && !checkAction({ service: "a.b", data: "x" })
    && !checkAction({ service: "a.b", data: { x: "y".repeat(2100) } }) && !checkAction(null) && !checkAction("a.b"));
  check("Aktion: Befehl der Oberfläche bereich/befehl, Daten ohne type und id",
    JSON.stringify(checkAction({ service: "hacs/repository/refresh", data: { repository: "123" } })) === '{"service":"hacs/repository/refresh","data":{"repository":"123"},"confirm":false}'
    && !checkAction({ service: "hacs/repository/refresh", data: { type: "x" } }) && !checkAction({ service: "hacs/repository/refresh", data: { id: 5 } }) && !checkAction({ service: "hacs//refresh" }) && !checkAction({ service: "/hacs" }) && !checkAction({ service: "Hacs/Refresh" }));
  const s = sanitizeApps({ custom: [
    { id: "a1", name: "Neu laden", icon: "nope", url: "javascript:alert(1)", ext: true, svc: { service: "homeassistant.update_entity", data: { entity_id: "update.x" }, confirm: true } },
    { id: "a2", name: "Kaputt", icon: "bolt", svc: { service: "x" } }, { id: "a3", name: "Ohne", icon: "bolt", svc: "x" }] });
  check("Bereinigen: Aktion bleibt ohne Ziel und ohne Favicon (Symbol unbekannt: bolt), ungültige Aktionen entfallen",
    s.custom.length === 1 && s.custom[0].url === "" && s.custom[0].ext === false && s.custom[0].icon === "bolt" && s.custom[0].svc.confirm === true && !("favicon" in s.custom[0]));
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
    const services = () => p.evaluate(() => window.__services.slice());
    const D = "dialog.apps-dlg";
    const F = "dialog.app-dlg";
    const snack = () => text(`${D} .ap-snack`);

    await tap(".apps-btn");
    await wait(`return r.querySelector("${D}")?.open`);
    await tap(`${D} [data-ap="edit"]`);
    await tap(`${D} [data-ap="add"]`);
    check(`[${tag}] Formular: Reiter ${JSON.stringify(T.tabs)}, "${T.tabs[0]}" gewählt, kein Feld für Dienst`, (await wait(`return r.querySelector("${F}")?.open`)) && JSON.stringify(await ev(`return [...r.querySelectorAll('${F} [data-set="fkind"]')].map((x) => x.textContent.trim())`)) === JSON.stringify(T.tabs)
      && (await ev(`return r.querySelector('${F} [data-set="fkind"][data-v="page"]').classList.contains("on") && r.querySelector('${F} [data-f-sec="act"]').hidden && !r.querySelector('${F} [data-f-sec="url"]').hidden`)));
    await (await handle(`${F} [data-f="name"]`)).fill("Updates prüfen");
    await tap(`${F} [data-set="fkind"][data-v="act"]`);
    check(`[${tag}] Art "${T.tabs[2]}": Felder Dienst und Daten statt Adresse, Symbol "Blitz" vorgeschlagen, Marke in der Vorschau`, await ev(`return !r.querySelector('${F} [data-f-sec="act"]').hidden && r.querySelector('${F} [data-f-sec="url"]').hidden && r.querySelector('${F} [data-ap="ficon"][data-icon="bolt"]').classList.contains("on") && !!r.querySelector("${F} [data-f-prev] .ap-ext")`));
    await tap(`${F} [data-ap="fsave"]`);
    check(`[${tag}] ohne Dienst: "${T.errSvc}"`, (await text(`${F} [data-f-err]`)) === T.errSvc, await text(`${F} [data-f-err]`));
    await (await handle(`${F} [data-f="svc"]`)).fill("homeassistant.update_entity");
    await (await handle(`${F} [data-f="data"]`)).fill("{kaputt");
    await tap(`${F} [data-ap="fsave"]`);
    check(`[${tag}] ungültiges JSON: "${T.errData}"`, (await text(`${F} [data-f-err]`)) === T.errData, await text(`${F} [data-f-err]`));
    await (await handle(`${F} [data-f="data"]`)).fill("[1, 2]");
    await tap(`${F} [data-ap="fsave"]`);
    check(`[${tag}] JSON kein Objekt (Liste): abgelehnt, nichts gespeichert`, (await text(`${F} [data-f-err]`)) === T.errData && (await data()).custom.length === 0);
    await (await handle(`${F} [data-f="data"]`)).fill('{"entity_id": "update.device_panel_update"}');
    await shot();
    await tap(`${F} [data-ap="fsave"]`);
    let d = await data();
    check(`[${tag}] gespeichert: Dienst und Daten, ohne Ziel, ohne Rückfrage`, (await wait(`return !r.querySelector("${F}").open`)) && d.custom.length === 1 && JSON.stringify(d.custom[0].svc) === '{"service":"homeassistant.update_entity","data":{"entity_id":"update.device_panel_update"},"confirm":false}' && d.custom[0].url === "" && d.custom[0].ext === false && d.custom[0].icon === "bolt", JSON.stringify(d.custom));
    check(`[${tag}] Bearbeiten-Liste: Untertitel ist der Dienst, Marke am Namen`, await ev(`const row = r.querySelector("${D} .ap-erow:has([data-ap=\\"edit-app\\"])"); return !!row && row.querySelector(".ap-t small").textContent === "homeassistant.update_entity" && !!row.querySelector(".ap-t .ap-ext")`));
    const appId = d.custom[0].id;

    // Ausführen: Tipp auf die Kachel ruft den Dienst auf, das Fenster bleibt offen und meldet es
    await tap(`${D} [data-ap="done"]`);
    check(`[${tag}] Kachel mit Marke "Aktion" in der normalen Ansicht`, await wait(`return !!r.querySelector('${D} .ap-tile:has([data-id="${appId}"]) .ap-ext')`));
    await p.evaluate(() => { window.__services.length = 0; window.__launcherLog = []; window.__serviceDelay = 1500; });
    await tap(`${D} [data-ap="open"][data-id="${appId}"]`);
    // Während der Ausführung: Kreis mit Pfeilen, der sich dreht
    check(`[${tag}] läuft: Kreis mit drehenden Pfeilen statt des Symbols`, await wait(`return !!r.querySelector('${D} .ap-tile.run-running:has([data-id="${appId}"]) .ap-spin svg')`, 1200));
    check(`[${tag}] läuft: die Drehung ist eine Animation (kein Standbild)`, await ev(`const e = r.querySelector('${D} .ap-tile.run-running .ap-spin'); return !!e && getComputedStyle(e).animationName.includes("ap-spin")`));
    await shot("running");
    // Danach: grüner Haken und grüner Rand
    check(`[${tag}] fertig: grüner Haken und grüner Rand an der Kachel`, await wait(`const t = r.querySelector('${D} .ap-tile.run-ok:has([data-id="${appId}"])'); return !!t && !t.querySelector(".ap-spin") && !!t.querySelector(".ap-ico.run-ok svg") && getComputedStyle(t).boxShadow !== "none"`, 4000));
    await shot("ok-state");
    check(`[${tag}] nach wenigen Sekunden wieder das gewohnte Symbol`, await wait(`return !r.querySelector('${D} .ap-tile[class*="run-"]') && !!r.querySelector('${D} .ap-tile:has([data-id="${appId}"]) .ap-ico:not([class*="run-"])')`, 5000));
    await p.evaluate(() => { window.__serviceDelay = 0; });
    const logged = await p.evaluate(() => window.__launcherLog);
    check(`[${tag}] Ergebnis im Log des Panels festgehalten (Name, Dienst, ok)`, logged.length === 1 && logged[0].name === "Updates prüfen" && logged[0].target === "homeassistant.update_entity" && logged[0].ok === true && logged[0].error === "", JSON.stringify(logged));
    const calls = await services();
    check(`[${tag}] Tipp ruft den Dienst auf (homeassistant.update_entity mit den Daten), Fenster bleibt offen`, calls.length === 1 && calls[0].domain === "homeassistant" && calls[0].service === "update_entity" && JSON.stringify(calls[0].data) === '{"entity_id":"update.device_panel_update"}' && (await ev(`return r.querySelector("${D}").open`)), JSON.stringify(calls));
    check(`[${tag}] Rückmeldung unten im Fenster: ${T.done}`, (await wait(`return !!r.querySelector("${D} .ap-snack")`)) && (await snack()) === T.done, await snack());
    await shot("run");

    // Fehler des Dienstes: Rückmeldung mit dem Grund
    await p.evaluate(() => { window.__serviceFails = "Speicher voll"; });
    await tap(`${D} [data-ap="open"][data-id="${appId}"]`);
    check(`[${tag}] Fehler: roter Rand und rotes Kreuz, im Log als fehlgeschlagen mit Grund`, (await wait(`return !!r.querySelector('${D} .ap-tile.run-err:has([data-id="${appId}"]) .ap-ico.run-err')`, 3000)) && (await p.evaluate(() => window.__launcherLog.at(-1))).ok === false && (await p.evaluate(() => window.__launcherLog.at(-1))).error === "Speicher voll");
    check(`[${tag}] Fehler: ${T.fail}`, (await wait(`return (r.querySelector("${D} .ap-snack")?.textContent || "").includes("Speicher voll")`)) && (await snack()) === T.fail, await snack());
    await p.evaluate(() => { window.__serviceFails = ""; });

    // Rückfrage einschalten: erst "Abbrechen" (kein Aufruf), dann "Ausführen"
    await tap(`${D} [data-ap="edit"]`);
    await tap(`${D} [data-ap="edit-app"][data-id="${appId}"]`);
    check(`[${tag}] Ändern: Reiter "${T.tabs[2]}" gewählt, Dienst, Daten (schön gesetzt) und Rückfrage aus wie gespeichert`, (await wait(`return r.querySelector("${F}")?.open`)) && (await ev(`return r.querySelector('${F} [data-set="fkind"][data-v="act"]').classList.contains("on") && r.querySelector('${F} [data-f="svc"]').value === "homeassistant.update_entity" && JSON.parse(r.querySelector('${F} [data-f="data"]').value).entity_id === "update.device_panel_update" && !r.querySelector('${F} [data-f="confirm"]').checked`)));
    await tap(`${F} [data-f="confirm"]`);
    await tap(`${F} [data-ap="fsave"]`);
    check(`[${tag}] Rückfrage gespeichert`, (await wait(`return !r.querySelector("${F}").open`)) && (await data()).custom[0].svc.confirm === true);
    await tap(`${D} [data-ap="done"]`);
    await p.evaluate(() => { window.__services.length = 0; });
    await tap(`${D} [data-ap="open"][data-id="${appId}"]`);
    const dd = "dialog.discard-dlg";
    check(`[${tag}] Rückfrage: "${T.askTitle}", ${T.askNote}`, (await wait(`return r.querySelector("${dd}")?.open`)) && (await text(`${dd} b`)) === T.askTitle && (await text(`${dd} small`)) === T.askNote && (await services()).length === 0, `${await text(`${dd} b`)} | ${await text(`${dd} small`)}`);
    await tap(`${dd} [data-dd="no"]`);
    check(`[${tag}] "${T.no}": kein Aufruf`, (await services()).length === 0);
    await tap(`${D} [data-ap="open"][data-id="${appId}"]`);
    await wait(`return r.querySelector("${dd}")?.open`);
    await tap(`${dd} [data-dd="yes"]`);
    check(`[${tag}] "${T.yes}": der Dienst wird aufgerufen`, await (async () => { await p.waitForTimeout(300); return (await services()).length === 1; })());

    // Favorit in der Kopfzeile (am Handy stehen dort nur die ersten zwei Favoriten, darum nur am Desktop)
    if (!mobile) {
      await ev(`r.host._apps.toggleFav("${appId}")`);
      await ev(`r.host._apps.close()`);
      await wait(`return !r.querySelector("${D}").open`);
      await p.evaluate(() => { window.__services.length = 0; });
      check(`[${tag}] Favorit in der Kopfzeile: Knopf mit dem Namen`, await wait(`return !!r.querySelector('.toolbar [data-app-pin="${appId}"]')`));
      await tap(`.toolbar [data-app-pin="${appId}"]`);
      await wait(`return r.querySelector("dialog.discard-dlg")?.open`);
      await tap(`dialog.discard-dlg [data-dd="yes"]`);
      await p.waitForTimeout(400);
      check(`[${tag}] aus der Kopfzeile: Dienst aufgerufen, Launcher bleibt zu`, (await services()).length === 1 && !(await ev(`return r.querySelector("${D}").open`)));

    }

    // Befehl der Oberfläche (WebSocket) statt Dienst: Feld "Dienst oder Befehl" mit Schrägstrich, Daten werden die Felder der Nachricht
    await ev(`if (!r.querySelector("${D}").open) r.host._apps.openLauncher()`);
    await wait(`return r.querySelector("${D}")?.open`);
    await ev(`if (!r.host._apps.ui.edit) r.host._apps.ui.edit = false`);
    await tap(`${D} [data-ap="edit"]`);
    await tap(`${D} [data-ap="add"]`);
    await wait(`return r.querySelector("${F}")?.open`);
    await (await handle(`${F} [data-f="name"]`)).fill("HACS prüfen");
    await tap(`${F} [data-set="fkind"][data-v="act"]`);
    await (await handle(`${F} [data-f="svc"]`)).fill("hacs/repository/refresh");
    await (await handle(`${F} [data-f="data"]`)).fill('{"type": "boese", "repository": "987654"}');
    await tap(`${F} [data-ap="fsave"]`);
    check(`[${tag}] Befehl mit "type" in den Daten: abgelehnt`, (await text(`${F} [data-f-err]`)) === T.errData, await text(`${F} [data-f-err]`));
    await (await handle(`${F} [data-f="data"]`)).fill('{"repository": "987654"}');
    await tap(`${F} [data-f="confirm"]`);
    await tap(`${F} [data-ap="fsave"]`);
    d = await data();
    const cmd = d.custom.find((c) => c.name === "HACS prüfen");
    check(`[${tag}] Befehl gespeichert (Dienst-Feld mit Schrägstrich), Rückfrage an`, !!cmd && cmd.svc.service === "hacs/repository/refresh" && cmd.svc.confirm === true && cmd.svc.data.repository === "987654");
    await tap(`${D} [data-ap="done"]`);
    await p.evaluate(() => { window.__services.length = 0; window.__wsCalls.length = 0; });
    await tap(`${D} [data-ap="open"][data-id="${cmd.id}"]`);
    await wait(`return r.querySelector("dialog.discard-dlg")?.open`);
    check(`[${tag}] Rückfrage nennt den Befehl: ${T.cmdNote}`, (await text(`dialog.discard-dlg small`)) === T.cmdNote, await text(`dialog.discard-dlg small`));
    await tap(`dialog.discard-dlg [data-dd="yes"]`);
    await p.waitForTimeout(400);
    const ws = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "hacs/repository/refresh"));
    check(`[${tag}] Befehl als WebSocket-Nachricht (type und Felder), kein Dienstaufruf`, ws.length === 1 && ws[0].repository === "987654" && (await services()).length === 0, JSON.stringify([ws, await services()]));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
    async function shot(name = "form") { await p.screenshot({ path: `${outDir}/launcheract-${name}-${tag.replace("/", "-")}.png` }); }
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
