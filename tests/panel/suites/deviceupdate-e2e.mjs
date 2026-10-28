// Update eines Geräts aus dem Popup starten (2.161.0): Knopf in der Software-Kachel (nur Administratoren, nur installierbar), Dialog mit
// Release Notes, Backup-Wahl nur mit Unterstützung, Sicherheitsabfrage, Fortschritt, Fertig und Fehler. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { start: "Update starten", yes: "Ja, Update starten", back: "Zurück", running: /Update läuft: 40 %/, reboot: "Das Gerät startet neu", done: /Fertig: Version 2\.2 ist installiert/, backup: "Vorher ein Backup erstellen", finishing: "Update wird abgeschlossen", failed: /fehlgeschlagen/ },
  en: { start: "Start update", yes: "Yes, start update", back: "Back", running: /Update running: 40 %/, reboot: "The device is restarting", done: /Done: version 2\.2 is installed/, backup: "Create a backup first", finishing: "Finishing the update", failed: /failed/ },
};
const ENT = "update.bewegungsmelder_firmware";
const state = (st, attrs = {}) => ({ entity_id: ENT, state: st, attributes: { supported_features: 29, installed_version: "2.1", latest_version: "2.2", release_summary: "Behebt Verbindungsabbrüche", release_url: "https://example.org/r/2.2", in_progress: false, ...attrs } });

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const L = T[lang];
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
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
    const setState = (o) => p.evaluate((st) => { const ha = document.querySelector("home-assistant").hass; ha.states = { ...ha.states, [st.entity_id]: st }; window.__pushHass(); }, o);
    const calls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/update_install"));

    await p.evaluate((e) => { window.__updates = { b: [{ entity_id: e, features: 29 }] }; window.__updNotes = "## 2.2\n\n- Behebt Verbindungsabbrüche\n- Neue Funktion"; }, ENT);
    await setState(state("on"));
    const open = async () => {
      await ev(`r.host._openDevice("b")`);
      await wait(`return r.querySelector("dialog.device")?.open && !!r.querySelector("dialog.device [data-tab='ov'], dialog.device .tiles")`);
    };
    await open();
    check(`[${tag}] Knopf mit Pfeil in der Software-Kachel`, await wait(`return !!r.querySelector('dialog.device button.upd-btn[data-dlg="update-open"] .cbtn')`));
    check(`[${tag}] Kachel "Software" mit Akzentrand, solange ein Update da ist`, await ev(`const t=r.querySelector('dialog.device .tile:has(button.upd-btn)'); return !!t && t.classList.contains("has-upd") && getComputedStyle(t).boxShadow !== "none"`));

    await tap('button.upd-btn[data-dlg="update-open"]');
    check(`[${tag}] Dialog: Versionen, Zusammenfassung, Release Notes`, await wait(`const d=r.querySelector("dialog.upd-dlg"); return d?.open && d.innerText.includes("2.1 → 2.2") && d.innerText.includes("Behebt Verbindungsabbrüche") && !!d.querySelector(".upd-notes li")`));
    check(`[${tag}] Backup-Wahl, weil die Entität es kann`, (await text("dialog.upd-dlg .upd-backup")).includes(L.backup));
    await p.screenshot({ path: `${outDir}/deviceupdate-info-${tag.replace("/", "-")}.png` });

    // Sicherheitsabfrage, Zurück, wieder vor
    await tap('dialog.upd-dlg [data-upd="next"]');
    check(`[${tag}] Sicherheitsabfrage, noch nichts gesendet`, (await text("dialog.upd-dlg .nf-note")).length > 20 && (await calls()).length === 0);
    await tap('dialog.upd-dlg [data-upd="back"]');
    check(`[${tag}] zurück zur Auswahl`, await wait(`return !!r.querySelector('dialog.upd-dlg [data-upd="next"]')`));
    await ev(`r.querySelector("dialog.upd-dlg [data-upd-backup]").click()`);
    await tap('dialog.upd-dlg [data-upd="next"]');
    await tap('dialog.upd-dlg [data-upd="go"]');
    check(`[${tag}] gestartet: Befehl mit Gerät, Entität und Backup`, await wait(`return !!r.querySelector("dialog.upd-dlg .upd-state")`) && JSON.stringify((await calls()).at(-1)) === JSON.stringify({ type: "device_panel/update_install", device_id: "b", entity_id: ENT, backup: true }), JSON.stringify((await calls()).at(-1)));

    // Fortschritt, Neustart, fertig
    await setState(state("on", { in_progress: true, update_percentage: 40 }));
    check(`[${tag}] Fortschritt 40 %`, await wait(`return !!r.querySelector("dialog.upd-dlg .upd-bar i")`) && L.running.test(await text("dialog.upd-dlg .upd-state")) && (await ev(`return r.querySelector("dialog.upd-dlg .upd-bar i").style.width`)) === "40%");
    await p.screenshot({ path: `${outDir}/deviceupdate-run-${tag.replace("/", "-")}.png` });
    // Fenster schliessen: die Kachel zeigt den Fortschritt, ein Tipp darauf öffnet das Fenster wieder bei der Fortschrittsanzeige
    await tap('dialog.upd-dlg [data-upd="close"]');
    check(`[${tag}] Kachel zeigt laufendes Update mit Prozent`, await wait(`const b=r.querySelector('dialog.device button.upd-btn'); return !!b && b.classList.contains("busy") && b.innerText.includes("40 %")`));
    await tap('button.upd-btn[data-dlg="update-open"]');
    check(`[${tag}] erneut geöffnet: gleich der Fortschritt, 40 %`, await wait(`const d=r.querySelector("dialog.upd-dlg"); return d?.open && !d.querySelector('[data-upd="next"]') && d.querySelector(".upd-bar i")?.style.width === "40%"`));
    await setState(state("unavailable"));
    check(`[${tag}] Gerät startet neu`, await wait(`return r.querySelector("dialog.upd-dlg .upd-state")?.innerText.includes(${JSON.stringify(L.reboot)})`));
    await setState(state("off", { installed_version: "2.2", latest_version: "2.2" }));
    check(`[${tag}] fertig: neue Version`, await wait(`return !!r.querySelector("dialog.upd-dlg .upd-state.ok")`) && L.done.test(await text("dialog.upd-dlg .upd-state")));
    await tap('dialog.upd-dlg [data-upd="close"]');
    check(`[${tag}] Dialog zu`, await wait(`return !r.querySelector("dialog.upd-dlg").open`));

    // Fehlschlag: lief, steht wieder auf "Update verfügbar"
    await setState(state("on"));
    await tap('button.upd-btn[data-dlg="update-open"]');
    await wait(`return r.querySelector("dialog.upd-dlg")?.open`);
    await tap('dialog.upd-dlg [data-upd="next"]');
    await tap('dialog.upd-dlg [data-upd="go"]');
    await setState(state("on", { in_progress: true }));
    await wait(`return !!r.querySelector("dialog.upd-dlg .ver-prog")`);
    await setState(state("on"));
    // Nicht sofort: die Entität steht oft noch eine Weile auf "verfügbar", das Fenster sagt "wird abgeschlossen" (Frist 5 Minuten)
    check(`[${tag}] zurück auf "verfügbar": noch kein Fehler, "${L.finishing}"`, await wait(`return (r.querySelector("dialog.upd-dlg .upd-state")?.innerText || "").includes(${JSON.stringify(L.finishing)}) && !r.querySelector("dialog.upd-dlg .dlg-error")`));
    await ev(`r.host._upd.backAt = Date.now() - 6 * 60 * 1000; r.host._renderUpdate()`);
    check(`[${tag}] fehlgeschlagen wird gesagt`, await wait(`return !!r.querySelector("dialog.upd-dlg .dlg-error")`) && L.failed.test(await text("dialog.upd-dlg .dlg-error")));
    await tap('dialog.upd-dlg [data-upd="close"]');

    // Fehler beim Start: zurück zur Auswahl mit Meldung (im Dialog bleibt sie sichtbar)
    await p.evaluate(() => { window.__updFails = "no installable update"; });
    await tap('button.upd-btn[data-dlg="update-open"]');
    await wait(`return r.querySelector("dialog.upd-dlg")?.open`);
    await tap('dialog.upd-dlg [data-upd="next"]');
    await tap('dialog.upd-dlg [data-upd="go"]');
    check(`[${tag}] Startfehler wird gezeigt`, await wait(`return r.querySelector("dialog.upd-dlg")?.innerText.includes("no installable update")`) || (await text("dialog.upd-dlg")).length > 0);
    await tap('dialog.upd-dlg [data-upd="close"]');
    await p.evaluate(() => { window.__updFails = null; });

    // Ohne Backup-Unterstützung keine Wahl, nur für Administratoren
    await setState(state("on", { supported_features: 5 }));
    await p.evaluate((e) => { window.__updates = { b: [{ entity_id: e, features: 5 }] }; }, ENT);
    await tap('button.upd-btn[data-dlg="update-open"]');
    await wait(`return r.querySelector("dialog.upd-dlg")?.open`);
    check(`[${tag}] ohne Backup-Merkmal keine Backup-Wahl`, !(await handle("dialog.upd-dlg .upd-backup")));
    await tap('dialog.upd-dlg [data-upd="close"]');
    await ev(`r.querySelector("dialog.device").close()`);
    await p.evaluate(() => { document.querySelector("home-assistant").hass.user = { is_admin: false }; window.__pushHass(); });
    await open();
    check(`[${tag}] kein Knopf ohne Administrator`, !(await handle("dialog.device button.upd-btn")) && (await text("dialog.device small.upd")).length > 0);
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
