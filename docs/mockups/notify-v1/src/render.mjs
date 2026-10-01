// Mockups "Meldungen": Einstellungen pro Gerät (A im Popup, B eigenes
// Fenster) und neue Zeilen in den Einstellungen (C: Batterie-Zeitpunkt,
// Ausfall- und Online-Meldung). Im echten Panel (Nachbau aus tests/panel,
// erfundene Daten) mit den Stilen des Panels eingesetzt.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/notify-v1/src/render.mjs
import { chromium } from "../../../../tests/panel/node_modules/playwright-core/index.mjs";
import { startServer } from "../../../../tests/panel/server.mjs";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
const tmp = fileURLToPath(new URL("./out/", import.meta.url));
mkdirSync(tmp, { recursive: true });
const server = await startServer(8952);
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const R = `document.querySelector("device-panel").shadowRoot`;

// Zeilen "Meldungen für dieses Gerät" (Bewegungsmelder Flur, Zigbee, 8 %).
const deviceRows = (chev) => `
  <div class="opt changed"><div class="opt-line"><span class="opt-label">Batterie-Warnung</span>
    <span class="opt-select"><select><option>Eigene Schwelle</option></select>${chev}</span></div>
    <div class="opt-line" style="margin-top:6px"><span class="opt-label" style="color:var(--dp-text2)">Schwach ab</span>
    <span class="opt-input"><input type="number" value="30" style="width:40px"><span class="unit">%</span></span></div>
    <div class="opt-short">Sonst gilt 25 % (eigene Schwelle von Zigbee Home Automation). "Aus" schaltet Markierung, Push und anhaltende Benachrichtigung für dieses Gerät ab.</div></div>
  <div class="opt"><div class="opt-line"><span class="opt-label">Ausfall- und Online-Meldungen</span>
    <span class="opt-select"><select><option>Wie eingestellt</option></select>${chev}</span></div>
    <div class="opt-short">"Aus" für Geräte, die oft absichtlich offline sind (z. B. ein Ladegerät). Das Gerät wird weiter überwacht.</div></div>`;

async function page(mobile, tall = false) {
  const ctx = await b.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1100, height: tall ? 1500 : 1000 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:8952/ha-sim.html?lang=de&theme=${mobile ? "dark" : "light"}`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
  const ev = (code, arg) => f.evaluate(new Function("arg", `const r=${R};` + code), arg);
  return { ctx, p, f, ev };
}

async function clip(p, f, sel, file) {
  const d = await f.evaluate(new Function(`const d=${R}.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return {x:d.x,y:d.y,width:d.width,height:d.height}`));
  const fr = await (await p.$("#panel-frame")).boundingBox();
  await p.screenshot({ path: file, clip: { x: d.x + fr.x, y: d.y + fr.y, width: d.width, height: d.height } });
}

async function shotA(mobile) {
  const { ctx, p, f, ev } = await page(mobile);
  await ev(`r.querySelector('[data-open="b"].dev').click()`);
  await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.device h2")`));
  await p.waitForTimeout(600);
  await ev(`
    const chev = r.querySelector(".typ-sel > svg:last-of-type").outerHTML;
    const hs = [...r.querySelectorAll("dialog.device .dlg-body h3")];
    const ent = hs[hs.length - 1];
    ent.insertAdjacentHTML("beforebegin", '<h3>Meldungen für dieses Gerät</h3><div style="border:1px solid var(--dp-divider);border-radius:14px;padding:2px 14px">' + arg.rows(chev) + '</div>');
    ent.previousElementSibling.scrollIntoView({ block: "start" });
    r.querySelector("dialog.device .dlg-body").scrollTop -= 40;
  `.replace("arg.rows(chev)", "(" + deviceRows.toString() + ")(chev)"));
  const file = `${tmp}A-${mobile ? "mobile" : "desktop"}.png`;
  if (mobile) await p.screenshot({ path: file }); else await clip(p, f, "dialog.device", file);
  await ctx.close();
  return file;
}

async function shotB(mobile) {
  const { ctx, p, f, ev } = await page(mobile);
  await ev(`r.querySelector('[data-open="b"].dev').click()`);
  await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.device h2")`));
  await p.waitForTimeout(600);
  await ev(`
    const chev = r.querySelector(".typ-sel > svg:last-of-type").outerHTML;
    const gear = r.querySelector(".gear-btn svg").outerHTML.replace(/width="\\d+"/, 'width="17"').replace(/height="\\d+"/, 'height="17"');
    r.querySelector("dialog.device .dlg-quick").insertAdjacentHTML("beforeend", '<button type="button" class="qbtn" style="border-color:var(--dp-primary);color:var(--dp-primary)">' + gear + 'Meldungen · eigene Einstellung</button>');
    const d = r.querySelector("dialog.stat-dlg");
    d.innerHTML = '<div class="dlg-head"><span class="dlg-avatar">' + gear.replace(/17/g, "28") + '</span><div class="dlg-title"><h2>Meldungen</h2><div class="dlg-sub">Bewegungsmelder Flur · nur dieses Gerät</div></div></div>' +
      '<div class="dlg-body" style="padding-top:0">' + (${deviceRows.toString()})(chev) + '</div>' +
      '<div class="dlg-actions"><button class="dlg-btn">Abbrechen</button><button class="dlg-btn primary">Speichern</button></div>';
    d.showModal();
  `);
  await p.waitForTimeout(400);
  const file = `${tmp}B-${mobile ? "mobile" : "desktop"}.png`;
  if (mobile) await p.screenshot({ path: file });
  else await p.screenshot({ path: file, clip: { x: 0, y: 0, width: 1100, height: 1000 } });
  await ctx.close();
  return file;
}

async function shotC(mobile, part) {
  const { ctx, p, f, ev } = await page(mobile, true);
  await ev(`r.querySelector(".gear-btn").click()`);
  await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.settings .set-sec")`));
  if (part === "battery") {
    await ev(`r.querySelector('[data-set="section"][data-id="battery"]').click()`);
    await ev(`r.querySelector('.switch input[data-opt="battery_push"]').click()`);
    await ev(`
      const chev = r.querySelector("dialog.settings .set-sec-head svg").outerHTML;
      const push = r.querySelector('.switch input[data-opt="battery_push"]').closest(".opt");
      push.querySelector(".opt-warn")?.remove();
      push.insertAdjacentHTML("afterend", '<div class="opt changed"><div class="opt-line"><span class="opt-label">Zeitpunkt der Push-Meldung</span>' +
        '<span style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><span class="opt-select" style="flex:0 0 170px"><select><option>Einmal täglich um</option></select>' + chev + '</span>' +
        '<span class="opt-input"><input type="time" value="08:00" style="width:78px;color-scheme:light dark"></span></span></div>' +
        '<div class="opt-short">Eine Sammelmeldung mit allen Geräten, die seit der letzten Meldung schwach geworden sind. Ausfälle kommen immer sofort.</div></div>');
      const head = r.querySelector('[data-id="battery"]');
      head.querySelector(".set-sec-sum").textContent = "Schwach ab 15 % · Push täglich um 08:00";
      head.scrollIntoView({ block: "start" });
    `);
  } else {
    await ev(`r.querySelector('[data-set="section"][data-id="push"]').click()`);
    await ev(`const s=r.querySelector('select[data-opt="notify_service"]'); s.value="notify.mobile_app_testhandy"; s.dispatchEvent(new Event("change",{bubbles:true}))`);
    await ev(`
      const sw = (on) => '<label class="switch"><input type="checkbox" ' + (on ? "checked" : "") + '><span></span></label>';
      const row = (label, short, on, changed) => '<div class="opt' + (changed ? " changed" : "") + '"><div class="opt-line"><span class="opt-label">' + label + '</span>' + sw(on) + '</div><div class="opt-short">' + short + '</div></div>';
      const click = r.querySelector('select[data-opt="notify_click_target"]').closest(".opt");
      click.insertAdjacentHTML("afterend",
        row("Ausfall melden", "Sofort, sobald ein Gerät als ausgefallen gilt (nach 2 Min. ohne Lebenszeichen, siehe Ausfall-Erkennung).", true, true) +
        row("Wieder online melden", "Entwarnung, sobald das Gerät zurück ist, mit Dauer des Ausfalls.", true, true) +
        row("Sammelausfall zusammenfassen", "Ab 3 Geräten innert 2 Min. eine Meldung mit vermuteter Ursache statt vieler.", true, true));
      const head = r.querySelector('[data-id="push"]');
      head.querySelector(".set-sec-sum").textContent = "notify.mobile_app_testhandy · Ausfall, wieder online, Sammelausfall";
      head.scrollIntoView({ block: "start" });
    `);
  }
  await p.waitForTimeout(300);
  const file = `${tmp}C-${part}-${mobile ? "mobile" : "desktop"}.png`;
  if (mobile) await p.screenshot({ path: file }); else await clip(p, f, "dialog.settings", file);
  await ctx.close();
  return file;
}

const uri = (file) => `data:image/png;base64,${readFileSync(file).toString("base64")}`;
async function compose(name, title, note, items) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(`<html><body style="margin:0;padding:24px;background:#e8eaed;font:15px system-ui,sans-serif;color:#202124">
    <h2 style="margin:0 0 4px">${title}</h2><p style="margin:0 0 16px;max-width:1400px;color:#444">${note}</p>
    <div style="display:flex;gap:24px;align-items:flex-start">${items.map(([file, label, w]) => `<figure style="margin:0"><img src="${uri(file)}" style="width:${w}px;border-radius:12px;box-shadow:0 4px 18px #0002"><figcaption style="text-align:center;margin-top:6px">${label}</figcaption></figure>`).join("")}</div></body></html>`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}${name}`, fullPage: true });
  await ctx.close();
}

await compose("A-geraet-im-popup.png", "A (Empfehlung): \"Meldungen für dieses Gerät\" direkt im Popup",
  "Neuer Abschnitt im Geräte-Popup, vor den Entitäten. Batterie-Warnung: wie Integration bzw. allgemein, eigene Schwelle oder aus. Ausfall- und Online-Meldungen: wie eingestellt oder aus (Gerät wird weiter überwacht). Gilt sofort, wie der Typ von Hand.",
  [[await shotA(false), "Desktop", 760], [await shotA(true), "Handy", 390]]);
await compose("B-eigenes-fenster.png", "B: Knopf im Popup öffnet ein eigenes Fenster \"Meldungen\"",
  "Das Popup bleibt kurz; der Knopf zeigt an, ob das Gerät eine eigene Einstellung hat. Änderungen gelten mit \"Speichern\". Ein Klick mehr.",
  [[await shotB(false), "Desktop", 860], [await shotB(true), "Handy", 390]]);
await compose("C-einstellungen.png", "C: neue Zeilen in den Einstellungen (Inhalt, keine Variante)",
  "Batterie: Zeitpunkt der Push-Meldung \"sofort\" oder \"einmal täglich um\" (Sammelmeldung). Push-Benachrichtigung (nach Bild 5): Ausfall melden (sofort), Wieder online melden, Sammelausfall zusammenfassen; jedes einzeln schaltbar.",
  [[await shotC(false, "battery"), "Batterie (Desktop)", 560], [await shotC(false, "push"), "Push-Benachrichtigung (Desktop)", 560], [await shotC(true, "push"), "Handy", 300]]);
await b.close();
server.close();
console.log("fertig");
