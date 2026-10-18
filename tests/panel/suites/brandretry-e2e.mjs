// Logos der Integrationen kommen nach einem Fehler von selbst wieder (2.35.0, Fehler vom Nutzer gemeldet: nach dem Öffnen der
// Companion-App fehlten alle Integrations-Logos, bis die App neu gestartet wurde). Ursachen: (1) scheiterte die erste Abfrage des
// Tokens (brands/access_token, zum Beispiel Verbindung verloren), wurde sie nie wiederholt; (2) ein einmal gescheitertes Bild
// blieb für die ganze Sitzung als "kein Logo" vermerkt; (3) nach dem Aufwachen wurde das Token nicht erneuert. Jetzt: Wiederholung
// mit wachsendem Abstand, gescheiterte Bilder werden nach einer Weile neu versucht, beim Aufwachen wird ein altes Token erneuert.
// Eine ältere HA ohne den Befehl ("unknown_command") wird nicht dauernd gefragt.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

async function open(query, { mobile = false, route } = {}) {
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  if (route) await route(p);
  await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=de&theme=light${query}`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
  const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
  const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
  const logo = (id) => `!!r.querySelector('.dev[data-open="${id}"] .av img.brand')`;
  const tokenCalls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "brands/access_token").length);
  return { ctx, p, f, ev, wait, logo, errors, tokenCalls };
}

for (const mobile of [false, true]) {
  const tag = mobile ? "mobile" : "desktop";

  // 1. Die ersten Abfragen des Tokens scheitern (Verbindung verloren): sie werden wiederholt, danach erscheint das Logo von selbst
  {
    const { ctx, ev, wait, logo, errors, tokenCalls } = await open("&brandsfail=2", { mobile });
    check(`[${tag}] zwei Token-Abfragen scheitern, die dritte klappt: Logo erscheint von selbst`, await wait(`return ${logo("d")}`, 20000) && (await tokenCalls()) === 3, `Abfragen: ${await tokenCalls()}`);
    // Das Element ist da, das Bild lädt noch (unter Last dauert es): darauf warten, nicht sofort prüfen
    check(`[${tag}] Bild geladen`, await wait(`const i = r.querySelector('.dev[data-open="d"] .av img.brand'); return !!i && i.complete && i.naturalWidth > 0`, 15000));
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  // 2. Ein Bild scheitert einmal (Netz weg): nach der Wartezeit wird es neu versucht und erscheint
  {
    let hits = 0;
    const route = (p) => p.route("**/api/brands/integration/shelly/**", (r) => (hits++ < 2 ? r.abort() : r.continue()));
    const { ctx, p, ev, wait, logo, errors } = await open("", { mobile, route });
    check(`[${tag}] Bild scheitert einmal: Verbindungs-Icon statt Logo`, !(await ev(`return ${logo("d")}`)));
    await ev(`r.host._brandFailMs = 400`);
    await p.waitForTimeout(600);
    await ev(`r.host._render(true)`);
    check(`[${tag}] nach der Wartezeit neu versucht: Logo da`, await wait(`r.host._render(true); return ${logo("d")}`, 8000), `Treffer: ${hits}`);
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  // 3. Aufwachen (Companion-App kommt aus dem Hintergrund): ein altes Token wird erneuert, ein frisches nicht
  {
    const { ctx, p, f, ev, wait, errors, tokenCalls } = await open("", { mobile });
    await p.waitForTimeout(500);
    const before = await tokenCalls();
    await ev(`window.dispatchEvent(new Event("pageshow"))`);
    await p.waitForTimeout(500);
    check(`[${tag}] Aufwachen mit frischem Token: keine neue Abfrage`, (await tokenCalls()) === before, `${before} -> ${await tokenCalls()}`);
    await ev(`r.host._brandAt = Date.now() - 6 * 60 * 1000`);
    await ev(`window.dispatchEvent(new Event("pageshow"))`);
    check(`[${tag}] Aufwachen mit altem Token: neue Abfrage`, await (async () => { for (let i = 0; i < 25; i++) { if ((await tokenCalls()) > before) return true; await p.waitForTimeout(200); } return false; })(), `${before} -> ${await tokenCalls()}`);
    void f; void wait;
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  // 4. Ältere HA ohne den Befehl: keine Wiederholung, auch nicht beim Aufwachen
  {
    const { ctx, p, ev, errors, tokenCalls } = await open("&nobrands=1", { mobile });
    await p.waitForTimeout(4500);
    await ev(`window.dispatchEvent(new Event("pageshow"))`);
    await p.waitForTimeout(500);
    check(`[${tag}] ohne Dienst (unknown_command): genau eine Abfrage, keine Wiederholung`, (await tokenCalls()) === 1, `Abfragen: ${await tokenCalls()}`);
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
