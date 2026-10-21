// Versionszeile in den Einstellungen (wie unifi_dynamic): Prüfen, Update
// über HACS (update.install), Fortschritt, Neustart, Abgleich mit HACS,
// Fehler, Vorabversionen mit "In HACS freischalten". Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const HACS_ID = "update.device_panel_update";

for (const mobile of [false, true]) {
  const tag = mobile ? "mobile" : "desktop";
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1400, height: 1000 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("dialog", (d) => d.accept());
  await p.goto("http://127.0.0.1:8950/ha-sim.html?lang=de");
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
  const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
  const panel = `document.querySelector("device-panel")`;
  // Die Update-Zeile wird bei Änderungen an HACS und beim Prüfen neu gezeichnet: wurde das Element
  // zwischen Suchen und Tippen ersetzt, das Element neu suchen (selten, unter Last).
  const tap = async (sel) => {
    for (let versuch = 1; ; versuch++) {
      const h = (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
      if (!h) throw new Error("fehlt: " + sel);
      try {
        if (mobile) await h.tap(); else await h.click();
        return;
      } catch (err) {
        if (versuch >= 3 || !/not attached|not stable/.test(String(err))) throw err;
        await p.waitForTimeout(200);
      }
    }
  };
  const verText = () => ev(`return r.querySelector("dialog.settings .ver-slot")?.innerText.replace(/\\s+/g," ") || ""`);
  const open = async () => {
    await ev(`if (r.querySelector("dialog.settings").open) r.querySelector('dialog.settings [data-set="close"]').click()`);
    await tap(".gear-btn");
    await p.waitForTimeout(250);
  };
  const setHacs = (attrs) => p.evaluate(({ attrs, id }) => {
    const ha = document.querySelector("home-assistant").hass;
    if (attrs) {
      ha.entities[id] = { entity_id: id, platform: "hacs", device_id: "hacs-dev-1" };
      ha.states[id] = { entity_id: id, state: attrs.latest_version !== attrs.installed_version ? "on" : "off",
        attributes: { title: "Device Panel", release_url: `https://github.com/Diegofuego871/ha-device-panel/releases/v${attrs.latest_version}`, in_progress: false, ...attrs } };
    } else { delete ha.entities[id]; delete ha.states[id]; }
  }, { attrs, id: HACS_ID });
  const pushHass = () => p.evaluate(() => window.__pushHass());
  const services = () => p.evaluate(() => window.__services);
  const has = (sel) => ev(`return !!r.querySelector(${JSON.stringify(sel)})`);
  const wait = (code, ms = 8000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);

  // 0. Beim Öffnen der Einstellungen immer frisch bei GitHub nachsehen (2.64.0), nicht erst nach 6 Stunden und ohne HACS von sich aus neu zu laden
  await p.evaluate(() => { window.__wsCalls = []; window.__services = []; });
  await open();
  await p.waitForTimeout(300);
  const openCalls = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/version"));
  check(`[${tag}] Einstellungen öffnen: Prüfung frisch (force), mit Vorabversion`, openCalls.length >= 1 && openCalls[0].force === true && openCalls[0].prerelease === true, JSON.stringify(openCalls));
  check(`[${tag}] Einstellungen öffnen: HACS wird nicht von sich aus neu geladen`, !(await services()).some((s) => s.service === "update_entity"));
  check(`[${tag}] Einstellungen öffnen: die Anzeige zeigt "geprüft" ohne Fehler`, !/nicht erreichbar|not reachable|failed/i.test(await verText()), await verText());

  // 1. Ohne HACS, aktuell
  await open();
  let t = await verText();
  check(`[${tag}] ohne HACS aktuell: Version und Suchen-Knopf`, t.includes("Device Panel 0.4.0") && t.includes("Aktuell") && t.includes("zuletzt geprüft") && t.includes("Nach Updates suchen"), t);
  check(`[${tag}] Versionszeile zuoberst`, await ev(`return r.querySelector("dialog.settings .dlg-body").firstElementChild.classList.contains("ver-slot")`));

  // 2. Prüfen -> neue Version auf GitHub; ohne HACS kein Knopf
  await p.evaluate(() => { window.__version = { installed: "0.4.0", latest: "0.5.0" }; window.__versionDelay = 1500; });
  const geo = () => ev(`const d=r.querySelector("dialog.settings").getBoundingClientRect(), v=r.querySelector("dialog.settings .ver").getBoundingClientRect(), bt=r.querySelector('[data-ver="check"]').getBoundingClientRect(); return {top:d.top, h:d.height, verH:v.height, btnW:bt.width}`);
  const before = await geo();
  await tap('[data-ver="check"]');
  await p.waitForTimeout(100);
  // Alles in einem Aufruf lesen: ein Fenster von einer Sekunde kann sonst zwischen zwei Aufrufen unter Last verstreichen
  const run = await ev(`const v = r.querySelector("dialog.settings .ver-slot"); return { t: (v?.innerText || "").replace(/\\s+/g, " ").trim(), spin: !!r.querySelector(".ver-spin"), busy: r.querySelector('[data-ver="check"]').getAttribute("aria-busy") === "true", geo: (() => { const d = r.querySelector("dialog.settings").getBoundingClientRect(), vv = r.querySelector("dialog.settings .ver").getBoundingClientRect(), bt = r.querySelector('[data-ver="check"]').getBoundingClientRect(); return { top: d.top, h: d.height, verH: vv.height, btnW: bt.width }; })() }`);
  t = run.t;
  const during = run.geo;
  check(`[${tag}] Prüfung läuft: Spinner, gleiche Beschriftung`, t.includes("Suche nach Updates") && run.spin && run.busy, t);
  check(`[${tag}] Dialog und Zeile springen nicht`, before.top === during.top && before.h === during.h && before.verH === during.verH && Math.abs(before.btnW - during.btnW) < 1, JSON.stringify([before, during]));
  await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.settings .ver-slot")?.innerText.includes("0.5.0")`), null, { timeout: 15000 }).catch(() => {});
  t = await verText();
  check(`[${tag}] ohne HACS Update gefunden: Hinweis, Release Notes, kein Knopf`, t.includes("Version 0.5.0 verfügbar") && t.includes("Installation über HACS oder manuell") && t.includes("Release Notes") && !(await has('[data-ver="install"]')), t);
  // Release Notes im Fenster statt Link (seit 2.3.0, Einzelheiten in notes-e2e)
  check(`[${tag}] "Release Notes" ist ein Knopf (kein Link nach aussen)`, await ev(`const b=r.querySelector(".ver-link"); return b.tagName==="BUTTON" && b.dataset.ver==="notes" && !b.getAttribute("href")`));
  await p.evaluate(() => { window.__versionDelay = 20; });

  // 3. Mit HACS: Aktualisieren, Fortschritt, Neustart
  await setHacs({ installed_version: "0.4.0", latest_version: "0.5.0" });
  await pushHass();
  t = await verText();
  check(`[${tag}] mit HACS: Aktualisieren-Knopf`, t.includes("über HACS") && await has('[data-ver="install"]'), t);
  await p.screenshot({ path: `${outDir}/version-${tag}-update.png` });
  await p.evaluate(() => { window.__services = []; });
  await tap('[data-ver="install"]');
  await p.waitForTimeout(50);
  let svc = await services();
  check(`[${tag}] update.install mit Entität, ohne Version`, svc.length === 1 && svc[0].domain === "update" && svc[0].service === "install" && svc[0].data.entity_id === HACS_ID && !("version" in svc[0].data), JSON.stringify(svc));
  await setHacs({ installed_version: "0.4.0", latest_version: "0.5.0", in_progress: true });
  await pushHass();
  t = await verText();
  check(`[${tag}] Installation läuft: Balken`, t.includes("Wird aktualisiert auf 0.5.0") && await has(".ver-prog"), t);
  await setHacs({ installed_version: "0.5.0", latest_version: "0.5.0" });
  await pushHass();
  t = await verText();
  check(`[${tag}] Neustart nötig`, t.includes("0.5.0 installiert – Neustart nötig") && await has('[data-ver="restart"]'), t);
  await p.screenshot({ path: `${outDir}/version-${tag}-restart.png` });
  await p.evaluate(() => { window.__services = []; });
  await tap('[data-ver="restart"]');
  await p.waitForTimeout(50);
  svc = await services();
  check(`[${tag}] Neustart mit Rückfrage ausgelöst`, svc.length === 1 && svc[0].domain === "homeassistant" && svc[0].service === "restart", JSON.stringify(svc));
  check(`[${tag}] Anzeige "startet neu"`, (await verText()).includes("Home Assistant startet neu"));

  // 3b. Home Assistant ist wieder da, die Seite blieb offen (kein Neuladen):
  // die neue Version läuft, "startet neu" darf nicht stehen bleiben.
  await p.evaluate(() => { window.__version = { installed: "0.5.0", latest: "0.5.0" }; });
  await open();
  await p.waitForTimeout(400);
  t = await verText();
  check(`[${tag}] nach dem Neustart: neue Version läuft, kein "startet neu"`, t.includes("Device Panel 0.5.0") && !t.includes("startet neu") && !(await has('[data-ver="restart"]')), t);
  // Auch bei geöffnetem Fenster: Verbindung kommt zurück, ohne erneutes Öffnen.
  await ev(`${panel}._version = null`);
  await p.evaluate(() => { window.__version = { installed: "0.4.0", latest: "0.5.0" }; });
  await setHacs({ installed_version: "0.5.0", latest_version: "0.5.0" });
  await open();
  await p.waitForTimeout(400);
  await p.evaluate(() => { window.__services = []; });
  await tap('[data-ver="restart"]');
  await p.waitForTimeout(100);
  check(`[${tag}] erneut: Anzeige "startet neu"`, (await verText()).includes("Home Assistant startet neu"));
  await p.evaluate(() => { window.__version = { installed: "0.5.0", latest: "0.5.0" }; });
  await ev(`${panel}._fetch()`);
  check(`[${tag}] Verbindung zurück, Fenster offen: neue Version läuft`, await f.waitForFunction(new Function(`const x=${R}.querySelector("dialog.settings .ver-slot"); return !!x && x.innerText.includes("Device Panel 0.5.0") && !x.innerText.includes("startet neu")`), null, { timeout: 5000 }).then(() => true, () => false), await verText());

  // 3c. Neustart abgelehnt (z. B. ungültige Konfiguration): Fehler in der Zeile, Knopf bleibt
  await ev(`${panel}._version = null`);
  await p.evaluate(() => { window.__version = { installed: "0.4.0", latest: "0.5.0" }; window.__serviceFails = "Die Konfiguration ist ungültig"; });
  await open();
  await p.waitForTimeout(400);
  await tap('[data-ver="restart"]');
  await p.waitForTimeout(200);
  t = await verText();
  check(`[${tag}] Neustart abgelehnt: Fehler in der Zeile, Knopf bleibt`, t.includes("Neustart fehlgeschlagen") && t.includes("Die Konfiguration ist ungültig") && !t.includes("startet neu") && await has('[data-ver="restart"]'), t);
  await p.evaluate(() => { window.__serviceFails = null; });

  // 3d. Neustart ohne Fehler, aber nichts passiert (nach 5 Minuten): Knopf wieder da
  await tap('[data-ver="restart"]');
  await p.waitForTimeout(100);
  check(`[${tag}] erneut ausgelöst: "startet neu"`, (await verText()).includes("Home Assistant startet neu"));
  await ev(`${panel}._version.restartAt = Date.now() - 6 * 60 * 1000`);
  await open();
  await p.waitForTimeout(400);
  t = await verText();
  check(`[${tag}] nach 5 Minuten ohne Neustart: Knopf wieder da`, !t.includes("startet neu") && await has('[data-ver="restart"]'), t);

  // 4. HACS kennt die neue Version noch nicht: automatisch nachladen, Hinweis
  await ev(`${panel}._version = null`);
  await setHacs({ installed_version: "0.4.0", latest_version: "0.4.0" });
  await p.evaluate(() => { window.__version = { installed: "0.4.0", latest: "0.5.0" }; window.__services = []; window.__wsCalls = []; window.__hacsKnowsAfterRefresh = null; window.__hacsRefreshDelay = 1500; });
  await open();
  await p.waitForTimeout(400);
  t = await verText();
  check(`[${tag}] während Abgleich: "Wird mit HACS abgeglichen", Knopf gesperrt`, t.includes("Wird mit HACS abgeglichen") && !t.includes("HACS kennt diese Version noch nicht") && await ev(`const b=r.querySelector('[data-ver="check"]'); return !!b && b.disabled && !!b.querySelector(".ver-spin")`), t);
  await p.screenshot({ path: `${outDir}/version-${tag}-syncing.png` });
  await p.evaluate(() => { window.__hacsRefreshDelay = 0; });
  await p.waitForTimeout(5500);
  t = await verText();
  check(`[${tag}] HACS veraltet: kein Aktualisieren, Hinweis und Suchen`, t.includes("Version 0.5.0 verfügbar") && t.includes("HACS kennt diese Version noch nicht") && !(await has('[data-ver="install"]')) && await has('[data-ver="check"]'), t);
  // Seit 2.113.0 nur noch der öffentliche Dienst: die Update-Entität wird neu geladen, die internen Befehle von HACS bleiben unberührt
  const hacsCalls = await p.evaluate(() => ({ ws: window.__wsCalls.filter((m) => String(m.type).startsWith("hacs/")).length, update: window.__services.filter((s) => s.domain === "homeassistant" && s.service === "update_entity").length }));
  check(`[${tag}] HACS: Update-Entität neu geladen, keine internen HACS-Befehle`, hacsCalls.ws === 0 && hacsCalls.update >= 1, JSON.stringify(hacsCalls));

  // 4b. Abgleich bringt die Version: direkt "Aktualisieren", nie der Hinweis
  await ev(`${panel}._version = null`);
  await setHacs({ installed_version: "0.4.0", latest_version: "0.4.0" });
  await p.evaluate(() => { window.__hacsKnowsAfterRefresh = "0.5.0"; window.__hacsRefreshDelay = 800; window.__seenPending = false; });
  await open();
  for (let i = 0; i < 30; i++) {
    if ((await verText()).includes("HACS kennt diese Version noch nicht")) await p.evaluate(() => { window.__seenPending = true; });
    await p.waitForTimeout(100);
  }
  check(`[${tag}] Abgleich erfolgreich: kein Hinweis, Aktualisieren da`, !(await p.evaluate(() => window.__seenPending)) && await has('[data-ver="install"]'), await verText());
  await p.evaluate(() => { window.__hacsRefreshDelay = 0; window.__hacsKnowsAfterRefresh = null; });

  // 5. Fehler beim Installieren: in der Zeile, Knopf bleibt
  await p.evaluate(() => { window.__serviceFails = "The version 0.5.0 for this integration can not be used with HACS."; });
  await tap('[data-ver="install"]');
  await p.waitForTimeout(100);
  t = await verText();
  check(`[${tag}] Installfehler in der Zeile`, t.includes("Aktualisieren fehlgeschlagen") && t.includes("can not be used with HACS") && await has('[data-ver="install"]'), t);
  await p.evaluate(() => { window.__serviceFails = null; });
  await p.evaluate(() => { window.__version = { installed: "0.4.0", latest: "0.5.1" }; });
  await setHacs({ installed_version: "0.4.0", latest_version: "0.5.1" });
  await tap('.ver [data-ver="check"]');
  await p.waitForTimeout(300);
  t = await verText();
  check(`[${tag}] erneut geprüft: Fehler weg, neueste Version`, !t.includes("fehlgeschlagen") && t.includes("Version 0.5.1 verfügbar") && await has('[data-ver="install"]'), t);
  check(`[${tag}] Update-Zeile ohne Überlauf`, await ev(`const v=r.querySelector("dialog.settings .ver"); return v.scrollWidth<=v.clientWidth+1`));

  // 6. Prüfen mit HACS fragt HACS neu ab
  await ev(`${panel}._version = null`);
  await setHacs({ installed_version: "0.4.0", latest_version: "0.4.0" });
  await p.evaluate(() => { window.__version = { installed: "0.4.0", latest: "0.4.0" }; window.__services = []; });
  await open();
  await tap('[data-ver="check"]');
  await p.waitForTimeout(600);
  svc = await services();
  check(`[${tag}] Prüfen fragt HACS neu ab`, svc.some((s) => s.domain === "homeassistant" && s.service === "update_entity" && s.data.entity_id === HACS_ID), JSON.stringify(svc));

  // 7. Fehler bei der Prüfung
  await setHacs(null);
  await p.evaluate(() => { window.__versionFails = true; });
  await tap('[data-ver="check"]');
  await p.waitForTimeout(600);
  t = await verText();
  check(`[${tag}] Prüffehler angezeigt`, t.includes("Prüfung fehlgeschlagen") && t.includes("GitHub nicht erreichbar"), t);
  check(`[${tag}] Prüffehler mit Warnsymbol statt Häkchen`, await has(".ver.err") && !(await has(".ver.ok")));
  await p.evaluate(() => { window.__versionFails = false; });
  // Abfragelimit von GitHub: verständlicher Text statt "HTTP 403"
  await p.evaluate(() => { window.__version = { installed: "0.4.0", latest: null }; window.__versionError = "rate_limit"; });
  await tap('[data-ver="check"]');
  await p.waitForTimeout(600);
  t = await verText();
  check(`[${tag}] Abfragelimit verständlich`, t.includes("GitHub-Abfragelimit") && !t.includes("rate_limit"), t);
  await p.evaluate(() => { window.__versionError = null; });

  // 8. Vorabversion: violett, gesperrt, bis der Benutzer "Pre-release" im HACS-Gerät selbst einschaltet. Seit 2.99.3 ändert das Panel
  // die Entitäten von HACS nie (kein Aktivieren in der Registry, kein Ein- oder Ausschalten); es zeigt nur den Weg zum HACS-Gerät.
  await ev(`${panel}._version = null`);
  await p.evaluate(() => {
    window.__version = { installed: "0.4.0", latest: "0.4.0" };
    window.__pre = "0.5.0b1";
    window.__panelSettings = { prerelease: true };
    window.__entReg = [{ entity_id: "switch.device_panel_pre_release", platform: "hacs", device_id: "hacs-dev-1", disabled_by: "integration", translation_key: "pre-release" }];
    window.__services = [];
    window.__wsCalls = [];
    window.__nav = [];
  });
  await setHacs({ installed_version: "0.4.0", latest_version: "0.4.0" });
  await pushHass();
  await open();
  await p.waitForTimeout(5000);
  t = await verText();
  check(`[${tag}] Beta angeboten, violett mit Etikett`, t.includes("Version 0.5.0b1 verfügbar") && t.includes("Beta") && await has(".ver.beta .ver-tag"), t);
  check(`[${tag}] Beta gesperrt, Hinweis mit Link zum HACS-Gerät, kein Knopf "Freischalten"`, await ev(`const b=r.querySelector(".ver.beta .ver-btn.primary"); return !!b && b.disabled`) && t.includes("Pre-release") && t.includes("HACS-Gerät öffnen") && !t.includes("freischalten") && !(await has('[data-ver="hacs-enable"]')), t);
  await p.screenshot({ path: `${outDir}/version-${tag}-beta.png` });
  await tap('[data-ver="hacs-device"]');
  await p.waitForTimeout(600);
  check(`[${tag}] Link öffnet das HACS-Gerät`, (await p.evaluate(() => window.__nav)).some((u) => u.includes("/config/devices/device/hacs-dev-1")), JSON.stringify(await p.evaluate(() => window.__nav)));
  // Der Benutzer schaltet "Pre-release" in HACS ein; HACS kennt danach die Beta
  await p.evaluate(() => {
    const ha = document.querySelector("home-assistant").hass;
    ha.entities["switch.device_panel_pre_release"] = { entity_id: "switch.device_panel_pre_release", platform: "hacs", device_id: "hacs-dev-1", translation_key: "pre-release" };
    ha.states["switch.device_panel_pre_release"] = { entity_id: "switch.device_panel_pre_release", state: "on", attributes: {} };
  });
  await setHacs({ installed_version: "0.4.0", latest_version: "0.5.0b1" });
  await pushHass();
  await open();
  check(`[${tag}] mit "Pre-release" in HACS: Beta installierbar`, await wait(`const b=r.querySelector('.ver.beta [data-ver="install"]'); return !!b && !b.disabled`), await verText());

  // 9. Vorabversionen aus + Speichern: das Panel lässt den Schalter in HACS, wie er ist
  await p.evaluate(() => { window.__services = []; });
  await tap('[data-ver="prerelease"]');
  await tap('dialog.settings [data-set="save"]');
  await p.waitForTimeout(400);
  svc = await services();
  const regCalls = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "config/entity_registry/update" || m.type === "config/entity_registry/list"));
  check(`[${tag}] Vorabversionen aus: gespeichert, keine Schalter- und keine Registry-Aufrufe an HACS`, (await p.evaluate(() => window.__panelSettings.prerelease)) === false && !svc.some((s) => s.domain === "switch") && regCalls.length === 0, JSON.stringify({ svc, regCalls }));

  check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
  check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
