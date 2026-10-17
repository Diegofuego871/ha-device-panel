// Launcher: Knopf "Home Assistant neu starten" (2.81.0): nur für Administratoren, immer mit Rückfrage (sichere Antwort hat den Fokus),
// "Abbrechen" schickt nichts, "Neu starten" ruft homeassistant.restart, ein Fehler von HA erscheint im Fenster, ein Verbindungsabbruch nicht.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { title: "Home Assistant neu starten?", no: "Abbrechen", yes: "Neu starten", starting: "Home Assistant startet neu", fail: "Neustart fehlgeschlagen:" },
  en: { title: "Restart Home Assistant?", no: "Cancel", yes: "Restart", starting: "Home Assistant is restarting", fail: "Restart failed:" },
};
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
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const restarts = () => p.evaluate(() => window.__services.filter((s) => s.domain === "homeassistant" && s.service === "restart").length);
    await f.evaluate(new Function(`document.querySelector("device-panel")._apps.openLauncher()`));
    check(`[${tag}] Knopf in der Kopfzeile des Launchers (Administrator)`, await wait(`return !!r.querySelector("dialog.apps-dlg[open] .ap-head .ap-pw")`));
    check(`[${tag}] Beschriftung "${lang === "de" ? "Home Assistant neu starten" : "Restart Home Assistant"}"`, (await ev(`return r.querySelector(".ap-pw").getAttribute("aria-label")`)) === (lang === "de" ? "Home Assistant neu starten" : "Restart Home Assistant"));
    check(`[${tag}] Knopf liegt links neben "Bearbeiten", nicht neben dem Kreuz`, await ev(`const q = (s) => r.querySelector(s).getBoundingClientRect(); return q(".ap-pw").right <= q('[data-ap="edit"]').left + 1 && (!q('[data-ap="close"]').width || q(".ap-pw").right < q('[data-ap="close"]').left - 20)`));
    check(`[${tag}] Fingergrösse (mind. 32 px)`, await ev(`const q = r.querySelector(".ap-pw").getBoundingClientRect(); return q.width >= 32 && q.height >= 32`));

    // Rückfrage
    await tap(".ap-pw");
    check(`[${tag}] Rückfrage "${T.title}" erscheint, noch nichts gesendet`, (await wait(`return r.querySelector("dialog.discard-dlg")?.open && r.querySelector("#dd-t")?.textContent === ${JSON.stringify(T.title)}`)) && (await restarts()) === 0);
    check(`[${tag}] Knöpfe "${T.no}" und "${T.yes}", Fokus auf "${T.no}"`, await ev(`const d = r.querySelector("dialog.discard-dlg"); return d.querySelector('[data-dd="no"]').textContent === ${JSON.stringify(T.no)} && d.querySelector('[data-dd="yes"]').textContent === ${JSON.stringify(T.yes)} && r.activeElement === d.querySelector('[data-dd="no"]')`));
    await tap('dialog.discard-dlg [data-dd="no"]');
    check(`[${tag}] Abbrechen: Rückfrage zu, kein Neustart, Launcher bleibt offen`, (await wait(`return !r.querySelector("dialog.discard-dlg").open`)) && (await restarts()) === 0 && (await ev(`return r.querySelector("dialog.apps-dlg").open`)));
    // Escape = Abbrechen
    await tap(".ap-pw");
    await wait(`return r.querySelector("dialog.discard-dlg").open`);
    await p.keyboard.press("Escape");
    check(`[${tag}] Escape bricht ab`, (await wait(`return !r.querySelector("dialog.discard-dlg").open`)) && (await restarts()) === 0);

    // Bestätigen
    await tap(".ap-pw");
    await wait(`return r.querySelector("dialog.discard-dlg").open`);
    await tap('dialog.discard-dlg [data-dd="yes"]');
    check(`[${tag}] "${T.yes}": homeassistant.restart genau einmal aufgerufen`, (await wait(`return true`)) && (await p.waitForFunction(() => window.__services.some((s) => s.service === "restart"), null, { timeout: 4000 }).then(() => true, () => false)) && (await restarts()) === 1);
    check(`[${tag}] Hinweis "${T.starting}" im Launcher`, await wait(`return (r.querySelector(".ap-snack")?.textContent || "").includes(${JSON.stringify(T.starting)})`));
    await p.screenshot({ path: new URL(`../output/restart-${tag.replace("/", "-")}.png`, import.meta.url).pathname });

    // HA lehnt ab (zum Beispiel ungültige Konfiguration): Fehler sichtbar
    await p.evaluate(() => { window.__serviceFails = "Konfiguration ungültig"; });
    await p.waitForTimeout(3700);
    await tap(".ap-pw");
    await wait(`return r.querySelector("dialog.discard-dlg").open`);
    await tap('dialog.discard-dlg [data-dd="yes"]');
    check(`[${tag}] Ablehnung von HA erscheint als Hinweis`, await wait(`return (r.querySelector(".ap-snack")?.textContent || "").includes(${JSON.stringify(T.fail)}) && r.querySelector(".ap-snack").textContent.includes("Konfiguration ungültig")`));
    // Verbindungsabbruch ist kein Fehler
    await p.evaluate(() => { window.__serviceFails = "connection closed"; });
    await p.waitForTimeout(3700);
    await tap(".ap-pw");
    await wait(`return r.querySelector("dialog.discard-dlg").open`);
    await tap('dialog.discard-dlg [data-dd="yes"]');
    check(`[${tag}] Verbindungsabbruch beim Neustart zeigt keinen Fehler`, (await wait(`return (r.querySelector(".ap-snack")?.textContent || "").includes(${JSON.stringify(T.starting)})`)) && !(await ev(`return (r.querySelector(".ap-snack")?.textContent || "").includes(${JSON.stringify(T.fail)})`)));

    // Bearbeiten-Modus: kein Knopf; Nicht-Administrator: nie
    await p.waitForTimeout(3700);
    await tap('[data-ap="edit"]');
    check(`[${tag}] im Bearbeiten-Modus kein Neustart-Knopf`, await wait(`return !r.querySelector(".ap-pw")`));
    await tap('[data-ap="done"]');
    await p.evaluate(() => { document.querySelector("home-assistant").hass.user = { is_admin: false }; window.__pushHass(); });
    await f.evaluate(new Function(`document.querySelector("device-panel")._apps.render()`));
    check(`[${tag}] Nicht-Administrator: kein Neustart-Knopf`, await wait(`return !!r.querySelector("dialog.apps-dlg .ap-head") && !r.querySelector(".ap-pw")`));
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("|"));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
