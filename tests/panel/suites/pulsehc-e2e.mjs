// HealthCheck in der Übersicht (2.241.0, docs/mockups/hc-overview-v2): läuft alles, steht von den Diensten nichts in der Puls-Kachel; ist ein Dienst
// gescheitert, steht unter dem Puls eine rote Zeile (ein Dienst mit Name und Grund, mehrere mit der Zahl), die Kachel öffnet das Fenster, und dort steht
// unter den Geräten der Abschnitt "Dienste" mit Zeilen, die das Protokoll öffnen. Ein Dienst, der wieder läuft, steht nur im Fenster.
// Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { one: "Dienst Haus: Gescheitert · HTTP 503", many: "2 Dienste mit Fehler", sec: "Dienste · Lebenszeichen gescheitert", failed: "gescheitert", back: "wieder in Ordnung", in24: "in 24 Std.", subSvc: "Kein Gerät ausgefallen, aber ein Dienst hat einen Fehler" },
  en: { one: "Service Haus: Failed · HTTP 503", many: "2 services with an error", sec: "Services · heartbeat failed", failed: "failed", back: "back to normal", in24: "in 24 h", subSvc: "No device is down, but a service has an error" },
};
const ITEM = () => ({ id: "a1", name: "Haus", url: "https://cronitor.link/p/0123456789abcdef/haus", interval: 300, fail_suffix: "", cases: [], status: { at: new Date().toISOString(), sent: "ok", result: "http", code: 503, test: false }, log: { state: "fail", since: new Date(Date.now() - 3600000).toISOString() } });
const BAD = (extra = {}) => ({ id: "a1", name: "Haus", failing: true, fails24: 3, since: new Date(Date.now() - 3600000).toISOString(), status: { at: new Date().toISOString(), sent: "ok", result: "http", code: 503, test: false }, ...extra });

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
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const setHealth = async (health) => { await p.evaluate((h) => { window.__health = h; }, health); await ev(`return r.host._fetch().then(() => true)`); };
    const toTile = async () => { if (mobile) { await ev(`r.querySelector(".hero").scrollLeft = r.querySelector(".hero .kt.pul").offsetLeft - 12`); await p.waitForTimeout(500); } };
    await p.evaluate((i) => { window.__hc = [i]; window.__hcPing = []; window.__hcLog = {}; }, ITEM());

    // Alles in Ordnung: nichts von den Diensten in der Kachel
    await setHealth([]);
    check(`[${tag}] Läuft alles: keine rote Zeile in der Puls-Kachel`, await ev(`return !!r.querySelector(".hero .kt.pul") && !r.querySelector(".hero .kt.pul .pwarn")`));

    // Ein Dienst gescheitert
    await setHealth([BAD()]);
    check(`[${tag}] Ein Dienst gescheitert: rote Zeile "${T.one}" mit rotem Punkt`, await wait(`const w = r.querySelector(".hero .kt.pul .pwarn"); return !!w && w.textContent.trim() === ${JSON.stringify(T.one)} && getComputedStyle(w.querySelector(".pdot")).backgroundColor === getComputedStyle(w).color`));
    check(`[${tag}] Kachel antippbar (Pfeil-Knopf), auch wenn kein Gerät ausgefallen wäre`, await ev(`const t = r.querySelector(".hero .kt.pul"); return t.classList.contains("tap") && !!t.querySelector(".kchev .cbtn")`));
    await toTile();
    await p.screenshot({ path: `${outDir}/pulsehc-tile-${tag.replace("/", "-")}.png` });

    // Mehrere Dienste
    await setHealth([BAD(), BAD({ id: "b2", name: "Zweiter" })]);
    check(`[${tag}] Zwei Dienste gescheitert: "${T.many}"`, await wait(`return r.querySelector(".hero .kt.pul .pwarn")?.textContent.trim() === ${JSON.stringify(T.many)}`));

    // Fenster
    await setHealth([BAD()]);
    await toTile();
    for (let n = 1; n <= 3; n++) { try { await tap(".hero .kt.pul"); } catch (err) { if (!/not attached|not stable/.test(String(err))) throw err; } if (await wait(`return r.querySelector("dialog.pulse-dlg")?.open`)) break; }
    check(`[${tag}] Tipp auf die Kachel öffnet das Fenster`, await wait(`return r.querySelector("dialog.pulse-dlg")?.open && !!r.querySelector("dialog.pulse-dlg .plist")`));
    check(`[${tag}] Abschnitt "${T.sec}" unter den Geräten, Zeile mit Pille "${T.failed}", Grund und "3× ${T.in24}"`, await ev(`const h = [...r.querySelectorAll("dialog.pulse-dlg h3")].map((x) => x.textContent.trim()); const row = r.querySelector("dialog.pulse-dlg [data-pulse-svc='a1']"); const devRow = r.querySelector("dialog.pulse-dlg [data-pulse-dev]"); return h.at(-1) === ${JSON.stringify(T.sec)} && !!row && row.querySelector(".pill.off")?.textContent === ${JSON.stringify(T.failed)} && row.textContent.includes("HTTP 503") && row.querySelector(".pval b").textContent === "3×" && row.querySelector(".pval small").textContent.includes(${JSON.stringify(T.in24)}) && (!devRow || (devRow.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0)`));
    check(`[${tag}] Die Summe der Geräte im Kopf zählt keine Dienste mit`, await ev(`return !/Dienst|service/i.test(r.querySelector("dialog.pulse-dlg .dlg-sub").textContent)`));
    await ev(`r.activeElement?.blur()`);
    await p.screenshot({ path: `${outDir}/pulsehc-window-${tag.replace("/", "-")}.png` });

    // Dienst wieder in Ordnung: nur noch im Fenster, ohne Pille und ohne rote Zeile
    await setHealth([BAD({ failing: false })]);
    check(`[${tag}] Wieder in Ordnung: keine rote Zeile mehr, im Fenster "${T.back}" ohne Pille`, await wait(`const row = r.querySelector("dialog.pulse-dlg [data-pulse-svc='a1']"); return !r.querySelector(".hero .kt.pul .pwarn") && !!row && !row.querySelector(".pill") && row.textContent.includes(${JSON.stringify(T.back)})`));

    // Tipp auf die Zeile: das Protokoll des Dienstes öffnet, das Fenster schliesst
    await tap("dialog.pulse-dlg [data-pulse-svc='a1']");
    check(`[${tag}] Tipp auf die Zeile: Protokoll des Dienstes "Haus" öffnet, das Fenster der Unterbrüche ist zu`, await wait(`return r.querySelector("dialog.hl-dlg")?.open && r.querySelector("dialog.hl-dlg .hl-pick")?.textContent.trim() === "Haus" && !r.querySelector("dialog.pulse-dlg").open`));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
