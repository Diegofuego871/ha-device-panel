// Verbindungsart von Hand im Popup (wie der Typ): Auswahl mit "Automatisch:
// <erkannt>" und allen Arten ausser "unbekannt", gilt sofort, Liste und
// Chips folgen, zurück auf die Erkennung, Matter mit verfeinerter Erkennung,
// Speicherfehler, kein Fokus auf der Auswahl am Handy. Deutsch und Englisch,
// Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { auto: "Automatisch: Unbekannt", autoThread: "Automatisch: Thread", manual: "von Hand gesetzt", zigbee: "Zigbee", err: "Verbindungsart konnte nicht gespeichert werden:" },
  en: { auto: "Automatic: Unknown", autoThread: "Automatic: Thread", manual: "set by hand", zigbee: "Zigbee", err: "Could not save the connection type:" },
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
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const calls = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_device_connection").map(({ device_id, connection }) => ({ device_id, connection })));
    const chip = (k) => ev(`return r.querySelector('.chip[data-conn="${k}"] .n')?.textContent || ""`);
    const open = async (id) => { await tap(`.dev[data-open="${id}"]`); await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('select[data-dlg="conn"]')`); };
    const close = async () => { await tap('dialog.device [data-dlg="close"]'); await wait(`return !r.querySelector("dialog.device").open`); };
    const sel = () => ev(`const s=r.querySelector('select[data-dlg="conn"]'); return s.value + "|" + s.options[s.selectedIndex].textContent`);

    check(`[${tag}] Ausgangslage`, (await chip("unknown")) === "1" && (await chip("zigbee")) === "5");
    await open("p");
    check(`[${tag}] erkannt: unbekannt`, (await sel()) === `|${T.auto}`, await sel());
    const values = await ev(`return [...r.querySelectorAll('select[data-dlg="conn"] option')].map(o=>o.value).join()`);
    check(`[${tag}] alle Arten ausser unbekannt`, values === ",zigbee,thread,zwave,matter,ble,wifi,ethernet,network,cloud", values);
    // Wie ein Benutzer: Auswahl hat den Fokus, dann Zigbee
    const s = await handle('select[data-dlg="conn"]');
    await s.focus();
    await s.selectOption("zigbee");
    check(`[${tag}] gespeichert`, await wait(`return r.querySelector('select[data-dlg="conn"]')?.value === "zigbee"`) && JSON.stringify((await calls()).at(-1)) === JSON.stringify({ device_id: "p", connection: "zigbee" }));
    check(`[${tag}] von Hand vermerkt`, await wait(`return (r.querySelector('select[data-dlg="conn"]').closest(".tile").textContent || "").includes(${JSON.stringify(T.manual)})`));
    await f.evaluate(() => document.querySelector("device-panel")._fetch());
    await p.waitForTimeout(400);
    const focused = await ev(`const a=r.activeElement; return a ? a.tagName + ":" + (a.dataset.dlg || "") : "none"`);
    check(`[${tag}] Fokus nach Wahl`, mobile ? !focused.startsWith("SELECT") : focused === "SELECT:conn", focused);
    check(`[${tag}] Chips folgen`, await wait(`return !r.querySelector('.chip[data-conn="unknown"]') && r.querySelector('.chip[data-conn="zigbee"] .n')?.textContent === "6"`), `${await chip("unknown")}/${await chip("zigbee")}`);
    await ev(`r.querySelector(".dev-set") && r.querySelector('select[data-dlg="conn"]').closest(".tiles").scrollIntoView({ block: "center" })`);
    await p.screenshot({ path: `${outDir}/conn-${tag.replace("/", "-")}.png` });
    await close();
    check(`[${tag}] Liste zeigt Zigbee`, (await ev(`return r.querySelector('.dev[data-open="p"]').textContent`)).includes(T.zigbee));
    // Wieder öffnen, zurück auf die Erkennung
    await open("p");
    check(`[${tag}] nach erneutem Öffnen`, (await sel()).startsWith("zigbee|"));
    await (await handle('select[data-dlg="conn"]')).selectOption("");
    check(`[${tag}] zurück auf Erkennung`, await wait(`return r.querySelector('.chip[data-conn="unknown"] .n')?.textContent === "1"`) && JSON.stringify((await calls()).at(-1)) === JSON.stringify({ device_id: "p", connection: null }));
    // Speicherfehler
    await p.evaluate(() => { window.__connFails = "Keine Berechtigung"; });
    await (await handle('select[data-dlg="conn"]')).selectOption("cloud");
    check(`[${tag}] Speicherfehler angezeigt`, await wait(`return (r.querySelector('select[data-dlg="conn"]').closest(".tile").querySelector(".warn")?.textContent || "").startsWith(${JSON.stringify(T.err)})`));
    await p.evaluate(() => { window.__connFails = null; });
    await close();
    // Matter: "Automatisch" zeigt die verfeinerte Erkennung
    await open("c");
    check(`[${tag}] Matter erkannt als Thread`, (await sel()) === `|${T.autoThread}`, await sel());
    await close();

    check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
