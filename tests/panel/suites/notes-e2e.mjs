// Fenster "Release Notes" (2.3.0): "Release Notes" in den Einstellungen öffnet ein Fenster mit den Versionen nach
// der installierten bis zur neuesten (Markdown als Überschriften, Listen, fett, Code, Link, Codeblock), HTML aus dem
// Text wird nicht ausgeführt; Fehler mit "Erneut versuchen"; Hinweis, wenn es die Sprache nicht gibt. Deutsch und
// Englisch, Desktop und Handy, echte Klicks/Taps.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 1000 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=${mobile ? "dark" : "light"}`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return (document.querySelector("device-panel")?.shadowRoot?.querySelectorAll(".dev").length || 0) > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const has = (sel) => ev(`return !!r.querySelector(${JSON.stringify(sel)})`);
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    // Die Versionszeile wird beim Prüfen neu gezeichnet: Element neu suchen, wenn es ersetzt wurde.
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

    // Kein Update da: "Release Notes" gibt es trotzdem, für die installierte Version (2.4.0)
    await p.evaluate(() => { window.__version = { installed: "0.4.0", latest: "0.4.0" }; window.__wsCalls = []; });
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .ver-slot")`);
    check(`[${tag}] aktuell: Knopf "Release Notes" neben "${lang === "de" ? "Nach Updates suchen" : "Check for updates"}"`, await wait(`return !!r.querySelector('.ver.ok [data-ver="notes"]') && !!r.querySelector('.ver.ok [data-ver="check"]')`));
    await tap('.ver.ok [data-ver="notes"]');
    await wait(`return !!r.querySelector("dialog.notes-dlg .rn")`);
    const cur = await ev(`const d=r.querySelector("dialog.notes-dlg"); return { sub: d.querySelector(".dlg-sub").textContent, vers: [...d.querySelectorAll(".rn-ver span")].map(x=>x.textContent).join(), github: d.querySelector(".rn-gh")?.href }`);
    const curCall = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/release_notes"));
    check(`[${tag}] installierte Version: Abfrage ohne "installed", nur diese Version`, curCall.length === 1 && curCall[0].installed == null && curCall[0].latest === "0.4.0" && cur.vers === "0.4.0", JSON.stringify([curCall, cur]));
    check(`[${tag}] Kopf "${lang === "de" ? "Installierte Version 0.4.0" : "Installed version 0.4.0"}", Link auf diese Version`, cur.sub === (lang === "de" ? "Installierte Version 0.4.0" : "Installed version 0.4.0") && cur.github.endsWith("/releases/tag/v0.4.0"), JSON.stringify(cur));
    await tap('dialog.notes-dlg [data-notes="close"].primary');
    await wait(`return !r.querySelector("dialog.notes-dlg").open`);
    // HACS meldet die neue Version mit Tag ("v0.5.0"): das Panel schickt die Nummer ohne "v" (Fehler in 2.6.0)
    await p.evaluate(() => { window.__version = { installed: "0.4.0", latest: "v0.5.0" }; });
    await tap('[data-ver="check"]');
    check(`[${tag}] Update gefunden: Knopf "Release Notes"`, await wait(`return !!r.querySelector('[data-ver="notes"]')`));
  await p.evaluate(() => { window.__notesDelay = 300; window.__wsCalls = []; });
  await tap('[data-ver="notes"]');
  check(`[${tag}] Fenster öffnet, zeigt Laden`, await wait(`const d=r.querySelector("dialog.notes-dlg"); return d.open && d.textContent.includes(${JSON.stringify(lang === "de" ? "Lade Release Notes" : "Loading release notes")})`));
  await p.waitForTimeout(500);
  const call = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/release_notes"));
  check(`[${tag}] Abfrage: installierte und neueste Version, Sprache`, call.length === 1 && call[0].installed === "0.4.0" && call[0].latest === "0.5.0" && call[0].language === lang, JSON.stringify(call));
  const notes = await ev(`const d=r.querySelector("dialog.notes-dlg"); return { sub: d.querySelector(".dlg-sub").textContent, title: d.querySelector("h2").textContent, vers: [...d.querySelectorAll(".rn-ver span")].map(x=>x.textContent).join(), dates: [...d.querySelectorAll(".rn-ver small")].length, h4: [...d.querySelectorAll(".rn h4")].map(x=>x.textContent).join("|"), items: d.querySelectorAll(".rn li").length, bold: d.querySelector(".rn li b")?.textContent, code: d.querySelector(".rn li code")?.textContent, link: d.querySelector(".rn li a")?.getAttribute("href"), rel: d.querySelector(".rn li a")?.getAttribute("rel"), pre: d.querySelector(".rn pre")?.textContent, p: d.querySelector(".rn p")?.textContent, script: d.querySelectorAll("script").length, xss: window.__xss ?? null, literal: d.textContent.includes("<script>"), cont: d.querySelector(".rn li")?.textContent, github: d.querySelector(".rn-gh")?.href }`);
  check(`[${tag}] Kopf: Titel und "0.4.0 → 0.5.0"`, notes.sub === "0.4.0 → 0.5.0" && notes.title === (lang === "de" ? "Release Notes" : "Release notes"), JSON.stringify([notes.title, notes.sub]));
  check(`[${tag}] Versionen neueste zuerst mit Datum`, notes.vers === "0.5.0,0.4.5" && notes.dates === 2, JSON.stringify([notes.vers, notes.dates]));
  check(`[${tag}] Markdown: Überschriften, Listen, fett, Code, Link, Codeblock, Absatz`, notes.h4 === (lang === "de" ? "Hinzugefügt|Behoben|Hinzugefügt|Behoben" : "Added|Fixed|Added|Fixed") && notes.items === 6 && notes.bold === (lang === "de" ? "fette" : "bold") && notes.code === "code" && notes.link === "https://github.com/Diegofuego871/ha-device-panel" && notes.rel === "noopener" && notes.pre === "release = 1" && !!notes.p, JSON.stringify(notes));
  check(`[${tag}] Fortsetzungszeile gehört zum Listenpunkt`, notes.cont.includes(lang === "de" ? "die auf der nächsten Zeile weitergeht" : "which continues on the next line"), notes.cont);
  check(`[${tag}] HTML aus dem Text wird nicht ausgeführt, sondern angezeigt`, notes.script === 0 && notes.xss === null && notes.literal);
  check(`[${tag}] Knopf "${lang === "de" ? "Auf GitHub" : "On GitHub"}" mit Link, kein Hinweis zur Sprache`, notes.github.endsWith("/releases/tag/v0.5.0") && !(await has("dialog.notes-dlg .nf-note")));
  await p.screenshot({ path: `${outDir}/notes-${tag.replace("/", "-")}.png` });
  // Englisch, wenn es die Sprache nicht gibt: Hinweis (nur im deutschen Panel)
  await tap('dialog.notes-dlg [data-notes="close"].primary');
  check(`[${tag}] Schliessen`, await wait(`return !r.querySelector("dialog.notes-dlg").open`));
  await p.evaluate(() => { window.__notesEnglish = true; window.__notesDelay = 20; });
  await tap('[data-ver="notes"]');
  await wait(`return !!r.querySelector("dialog.notes-dlg .rn")`);
  check(`[${tag}] nur Englisch: ${lang === "de" ? "Hinweis" : "kein Hinweis"}`, (await has("dialog.notes-dlg .nf-note")) === (lang === "de"));
  await tap('dialog.notes-dlg .dlg-close');
  // Fehler: Meldung, "Erneut versuchen" holt neu
  await p.evaluate(() => { window.__notesFail = "HTTP 404"; window.__wsCalls = []; });
  await tap('[data-ver="notes"]');
  check(`[${tag}] Fehler: Meldung und Knopf "Erneut versuchen"`, await wait(`const d=r.querySelector("dialog.notes-dlg"); return d.textContent.includes("HTTP 404") && !!d.querySelector('[data-notes="retry"]') && !d.querySelector(".rn")`));
  await p.evaluate(() => { window.__notesFail = null; });
  await tap('dialog.notes-dlg [data-notes="retry"]');
  check(`[${tag}] erneut versuchen: Notes erscheinen, zweite Abfrage mit force`, await wait(`return r.querySelectorAll("dialog.notes-dlg .rn-entry").length === 2`) && (await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/release_notes").map((m) => !!m.force))).join() === "false,true");
  // Verbindungsfehler
  await tap('dialog.notes-dlg .dlg-close');
  await p.evaluate(() => { window.__notesThrows = "boom"; });
  await tap('[data-ver="notes"]');
  check(`[${tag}] Verbindungsfehler: Meldung`, await wait(`return r.querySelector("dialog.notes-dlg").textContent.includes("boom")`));
  await tap('dialog.notes-dlg .dlg-close');
  await p.evaluate(() => { window.__notesThrows = null; window.__notesEnglish = false; });
  // Schliesst man die Einstellungen nicht, bleiben sie hinter dem Fenster offen
  check(`[${tag}] Einstellungen bleiben offen`, await ev(`return r.querySelector("dialog.settings").open`));

    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
