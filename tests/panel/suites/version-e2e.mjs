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
  const tap = async (sel) => {
    const h = (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    if (!h) throw new Error("fehlt: " + sel);
    if (mobile) await h.tap(); else await h.click();
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

  // 1. Ohne HACS, aktuell
  await open();
  let t = await verText();
  check(`[${tag}] ohne HACS aktuell: Version und Suchen-Knopf`, t.includes("Device Panel 0.4.0") && t.includes("Aktuell") && t.includes("zuletzt geprüft") && t.includes("Nach Updates suchen"), t);
  check(`[${tag}] Versionszeile zuoberst`, await ev(`return r.querySelector("dialog.settings .dlg-body").firstElementChild.classList.contains("ver-slot")`));

  // 2. Prüfen -> neue Version auf GitHub; ohne HACS kein Knopf
  await p.evaluate(() => { window.__version = { installed: "0.4.0", latest: "0.5.0" }; window.__versionDelay = 400; });
  const geo = () => ev(`const d=r.querySelector("dialog.settings").getBoundingClientRect(), v=r.querySelector("dialog.settings .ver").getBoundingClientRect(), bt=r.querySelector('[data-ver="check"]').getBoundingClientRect(); return {top:d.top, h:d.height, verH:v.height, btnW:bt.width}`);
  const before = await geo();
  await tap('[data-ver="check"]');
  await p.waitForTimeout(100);
  t = await verText();
  const during = await geo();
  check(`[${tag}] Prüfung läuft: Spinner, gleiche Beschriftung`, t.includes("Suche nach Updates") && await ev(`return !!r.querySelector(".ver-spin") && r.querySelector('[data-ver="check"]').getAttribute("aria-busy")==="true"`), t);
  check(`[${tag}] Dialog und Zeile springen nicht`, before.top === during.top && before.h === during.h && before.verH === during.verH && Math.abs(before.btnW - during.btnW) < 1, JSON.stringify([before, during]));
  await p.waitForTimeout(500);
  t = await verText();
  check(`[${tag}] ohne HACS Update gefunden: Hinweis, Release Notes, kein Knopf`, t.includes("Version 0.5.0 verfügbar") && t.includes("Installation über HACS oder manuell") && t.includes("Release Notes") && !(await has('[data-ver="install"]')), t);
  check(`[${tag}] Release-Link zeigt auf GitHub`, (await ev(`return r.querySelector(".ver-link").href`)).endsWith("/releases/tag/v0.5.0"));
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
  const refreshed = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "hacs/repository/refresh").map((m) => m.repository));
  check(`[${tag}] HACS automatisch nachgeladen (Repository 987654)`, refreshed.includes("987654"), JSON.stringify(refreshed));

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

  // 8. Vorabversion: violett, gesperrt bis "In HACS freischalten"
  await ev(`${panel}._version = null`);
  await p.evaluate(() => {
    window.__version = { installed: "0.4.0", latest: "0.4.0" };
    window.__pre = "0.5.0b1";
    window.__panelSettings = { prerelease: true, prerelease_hacs: null };
    window.__entReg = [{ entity_id: "switch.device_panel_pre_release", platform: "hacs", device_id: "hacs-dev-1", disabled_by: "integration", translation_key: "pre-release" }];
    window.__services = [];
    window.__reloadDelay = 1200;
  });
  await setHacs({ installed_version: "0.4.0", latest_version: "0.4.0" });
  await pushHass();
  await open();
  await p.waitForTimeout(5000);
  t = await verText();
  check(`[${tag}] Beta angeboten, violett mit Etikett`, t.includes("Version 0.5.0b1 verfügbar") && t.includes("Beta") && await has(".ver.beta .ver-tag"), t);
  check(`[${tag}] Beta gesperrt mit Hinweis und Freischalten`, await ev(`const b=r.querySelector(".ver.beta .ver-btn.primary"); return !!b && b.disabled`) && t.includes("In HACS freischalten") && t.includes("HACS-Gerät öffnen"), t);
  await p.screenshot({ path: `${outDir}/version-${tag}-beta.png` });
  await tap('[data-ver="hacs-enable"]');
  await p.waitForTimeout(300);
  check(`[${tag}] Freischalten läuft`, (await verText()).includes("Wird freigeschaltet"), await verText());
  await p.waitForTimeout(3500);
  const calls = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "config/entity_registry/update" || m.type === "device_panel/set_panel"));
  svc = await services();
  check(`[${tag}] Entität aktiviert und eingeschaltet, vermerkt`, calls.some((m) => m.type === "config/entity_registry/update" && m.disabled_by === null) && svc.some((s) => s.domain === "switch" && s.service === "turn_on") && calls.some((m) => m.type === "device_panel/set_panel" && m.prerelease_hacs === "switch.device_panel_pre_release"), JSON.stringify(calls));
  check(`[${tag}] danach Beta installierbar`, await ev(`const b=r.querySelector('.ver.beta [data-ver="install"]'); return !!b && !b.disabled`), await verText());

  // 9. Vorabversionen aus + Speichern: HACS-Schalter wieder aus
  await p.evaluate(() => { window.__services = []; });
  await tap('[data-ver="prerelease"]');
  await tap('dialog.settings [data-set="save"]');
  await p.waitForTimeout(400);
  svc = await services();
  check(`[${tag}] Vorabversionen aus: Schalter in HACS aus`, svc.some((s) => s.domain === "switch" && s.service === "turn_off" && s.data.entity_id === "switch.device_panel_pre_release") && (await p.evaluate(() => window.__panelSettings.prerelease)) === false, JSON.stringify(svc));

  check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
  check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
