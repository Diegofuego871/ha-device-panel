// Einstellungen als Favorit (2.88.0, Wunsch des Nutzers): Das Zahnrad steht nicht mehr fest in der Kopfzeile, sondern nur noch, wenn der
// Benutzer die App "Einstellungen" anheftet (Herz); standardmässig ist sie ein Favorit (zusammen mit den Routinen). Am Handy stehen jetzt zwei
// angeheftete Knöpfe in der Kopfzeile, der Launcher-Knopf ist ganz rechts. Der rote Punkt "Neustart steht aus" sitzt am angehefteten Knopf der
// Einstellungen, sonst am Launcher-Knopf; die Karte "Einstellungen" im Launcher zeigt in jedem Fall die Pille. Die App "Einstellungen" lässt
// sich nicht ausblenden. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { restart: "Neustart steht aus", pill: "Neustart", settings: "Einstellungen", launcher: "Apps" },
  en: { restart: "restart pending", pill: "Restart", settings: "Settings", launcher: "Apps" },
};
const D = "dialog.apps-dlg";

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1400, height: 1000 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const bar = () => ev(`return [...r.querySelectorAll(".toolbar .app-pin, .toolbar .apps-btn")].map((e) => e.dataset.appPin || "launcher").join()`);
    const openLauncher = async () => { await tap(".apps-btn"); await wait(`return r.querySelector("${D}")?.open`); };
    const closeLauncher = async () => { await ev(`r.host._apps.close()`); await wait(`return !r.querySelector("${D}").open`); };

    // Standard: Routinen und Einstellungen angeheftet, Launcher ganz rechts, kein fester Zahnrad-Knopf
    check(`[${tag}] Kopfzeile: Routinen, Einstellungen, Launcher-Knopf ganz rechts`, (await bar()) === "routine,settings,launcher" && (await ev(`return r.querySelector(".toolbar").lastElementChild.classList.contains("apps-btn")`)));
    check(`[${tag}] der Knopf der Einstellungen ist der angeheftete (Klasse gear-btn, Beschriftung "${T.settings}"), nur einer`, await ev(`const g = r.querySelectorAll(".toolbar .gear-btn"); return g.length === 1 && g[0].dataset.appPin === "settings" && g[0].getAttribute("aria-label") === ${JSON.stringify(T.settings)}`));
    await tap(".gear-btn");
    check(`[${tag}] Tipp auf den angehefteten Knopf öffnet die Einstellungen`, await wait(`return r.querySelector("dialog.settings")?.open`));
    await ev(`r.host._closeSettings()`);

    // Roter Punkt, Einstellungen angeheftet: am Knopf der Einstellungen, nicht am Launcher; die Karte im Launcher trägt die Pille
    await ev(`r.host._versionState = () => ({ restart: true }); r.host._gearDot(true)`);
    check(`[${tag}] Neustart steht aus, angeheftet: Punkt am Knopf der Einstellungen (Beschriftung nennt "${T.restart}"), keiner am Launcher`, await ev(`const g = r.querySelector(".gear-btn"), a = r.querySelector(".apps-btn"); return g.classList.contains("has-dot") && g.getAttribute("aria-label").includes(${JSON.stringify(T.restart)}) && !a.classList.contains("has-dot")`));
    await openLauncher();
    check(`[${tag}] Launcher: die Karte "${T.settings}" trägt die Pille "${T.pill}"`, await ev(`const t = r.querySelector('${D} [data-ap="open"][data-id="settings"]'); return !!t && t.parentElement.textContent.includes(${JSON.stringify(T.pill)})`));
    await closeLauncher();

    // Einstellungen lösen (Bearbeiten, Herz): kein Zahnrad mehr in der Kopfzeile, der Punkt wandert an den Launcher-Knopf
    await openLauncher();
    await tap(`${D} [data-ap="edit"]`);
    check(`[${tag}] Bearbeiten: "Einstellungen" ist gesperrt (Schloss), nicht ausblendbar`, await ev(`return !r.querySelector('${D} [data-ap="hide"][data-id="settings"]') && !!r.querySelector('${D} .ap-erow[data-id="settings"] .ap-a.dis svg')`));
    await tap(`${D} [data-ap="fav"][data-id="settings"]`);
    await tap(`${D} [data-ap="done"]`);
    await closeLauncher();
    check(`[${tag}] gelöst: nur Routinen und Launcher in der Kopfzeile, kein Zahnrad-Knopf`, (await bar()) === "routine,launcher" && (await ev(`return !r.querySelector(".gear-btn")`)));
    check(`[${tag}] gelöst und Neustart steht aus: Punkt am Launcher-Knopf, Beschriftung "${T.restart}"`, await ev(`const a = r.querySelector(".apps-btn"); return a.classList.contains("has-dot") && a.classList.contains("dot-bad") && a.getAttribute("aria-label").includes(${JSON.stringify(T.restart)})`));
    await openLauncher();
    check(`[${tag}] Launcher: die Karte "${T.settings}" trägt weiter die Pille, die App ist nicht ausgeblendet`, await ev(`const t = r.querySelector('${D} [data-ap="open"][data-id="settings"]'); return !!t && t.parentElement.textContent.includes(${JSON.stringify(T.pill)})`));
    await tap(`${D} [data-ap="open"][data-id="settings"]`);
    check(`[${tag}] die App öffnet die Einstellungen (auch ohne Knopf in der Kopfzeile)`, await wait(`return r.querySelector("dialog.settings")?.open && !r.querySelector("${D}").open`));
    await ev(`r.host._closeSettings()`);

    // Punkt weg, wenn nichts mehr aussteht
    await ev(`r.host._versionState = () => ({ restart: false }); r.host._gearDot(true)`);
    check(`[${tag}] nichts mehr offen: kein Punkt am Launcher-Knopf`, await ev(`return !r.querySelector(".apps-btn").classList.contains("has-dot")`));

    // Wieder anheften (Herz): zurück in der Kopfzeile; Handy: höchstens zwei angeheftete Knöpfe
    await openLauncher();
    await tap(`${D} [data-ap="edit"]`);
    await tap(`${D} [data-ap="fav"][data-id="settings"]`);
    await tap(`${D} [data-ap="done"]`);
    await closeLauncher();
    check(`[${tag}] wieder angeheftet: Routinen, Einstellungen, Launcher`, (await bar()) === "routine,settings,launcher");
    await openLauncher();
    await tap(`${D} [data-ap="edit"]`);
    await tap(`${D} [data-ap="fav"][data-id="magic"]`);
    await tap(`${D} [data-ap="done"]`);
    await closeLauncher();
    check(`[${tag}] dritter Favorit (Magic Push): ${mobile ? "am Handy bleiben es zwei angeheftete Knöpfe" : "am Desktop drei angeheftete Knöpfe"}`, (await bar()) === (mobile ? "routine,settings,launcher" : "routine,settings,magic,launcher"), await bar());
    if (mobile) {
      await openLauncher();
      await tap(`${D} [data-ap="edit"]`);
      check(`[${tag}] Handy: die gestrichelte Linie liegt unter dem zweiten Favoriten (Beschriftung "zwei")`, await ev(`const rows = [...r.querySelectorAll('${D} [data-ap-box="fav"] .ap-erow')]; return rows.length >= 3 && getComputedStyle(rows[2], "::before").borderTopStyle === "dashed" && getComputedStyle(rows[1], "::before").borderTopStyle !== "dashed" && /${lang === "de" ? "zwei" : "two"}/.test(rows[2].dataset.mark)`));
      await tap(`${D} [data-ap="done"]`);
      await closeLauncher();
    }
    check(`[${tag}] kein fehlender Text, keine JS-Fehler`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)) && errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
