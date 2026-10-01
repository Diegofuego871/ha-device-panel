// Mockups "Batterie-Schwelle pro Integration" im echten Panel (Nachbau aus
// tests/panel, erfundene Daten): Die Varianten werden mit den Stilen des
// Panels in die Einstellungen eingesetzt und fotografiert, Desktop und Handy.
// Aufruf: node docs/mockups/battery-v1/src/render.mjs (nach npm ci in tests/panel)
import { chromium } from "../../../../tests/panel/node_modules/playwright-core/index.mjs";
import { startServer } from "../../../../tests/panel/server.mjs";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
const tmp = fileURLToPath(new URL("./out/", import.meta.url));
mkdirSync(tmp, { recursive: true });
const server = await startServer(8951);
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const R = `document.querySelector("device-panel").shadowRoot`;

// Integrationen mit Batteriegeräten im Nachbau (erfunden): Name, Zahl, schwächste.
const BAT = [
  ["zha", "Zigbee Home Automation", 3, 8, 25],
  ["matter", "Matter", 2, 22, null],
  ["bthome", "BTHome", 1, 0, null],
  ["zwave_js", "Z-Wave", 1, 67, null],
];

async function shot(variant, mobile) {
  const ctx = await b.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:8951/ha-sim.html?lang=de&theme=${mobile ? "dark" : "light"}`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
  const ev = (code, arg) => f.evaluate(new Function("arg", `const r=${R};` + code), arg);
  await ev(`r.querySelector(".gear-btn").click()`);
  await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.settings .set-sec")`));
  // Abzeichen der Integrationen aus dem echten Abschnitt holen
  await ev(`r.querySelector('[data-set="section"][data-id="integrations"]').click()`);
  const badges = await ev(`return Object.fromEntries([...r.querySelectorAll('input[data-list="exclude_integrations"]')].map(i=>[i.dataset.value, i.closest(".ex-row").querySelector(".ibadge").outerHTML]))`);
  if (variant === "A") {
    await ev(`r.querySelector('[data-set="section"][data-id="integrations"]').click()`);
    await ev(`r.querySelector('[data-set="section"][data-id="battery"]').click()`);
    await ev(`const s=r.querySelector('.switch input[data-opt="battery_push"]'); s.click()`);
    await ev(`
      const body = r.querySelector('[data-id="battery"]').closest(".set-sec").querySelector(".set-sec-body");
      const rows = arg.bat.map(([d, name, n, min, own]) => '<div class="ex-row">' + arg.badges[d] + '<div class="ex-name">' + name + '<small>' + n + (n === 1 ? ' Gerät' : ' Geräte') + ' mit Batterie · schwächste ' + min + ' %</small></div>' +
        '<span class="opt-input" style="' + (own ? 'border-color:var(--dp-primary);box-shadow:inset 0 0 0 1px var(--dp-primary)' : '') + '"><input type="number" placeholder="15" value="' + (own ?? '') + '" style="width:40px"><span class="unit">%</span></span></div>').join("");
      body.insertAdjacentHTML("beforeend", '<div class="opt changed" style="border-bottom:none"><div class="opt-line"><span class="opt-label">Eigene Schwelle pro Integration</span></div>' +
        '<div class="opt-short">Leer = Standard (15 %). Nur Integrationen mit Batteriegeräten; gilt für Markierung, Push und anhaltende Benachrichtigung.</div></div>' +
        '<div class="ex-head"><span>Integration</span><span>Schwach ab</span></div>' + rows);
      const head = r.querySelector('[data-id="battery"]');
      head.querySelector(".set-sec-sum").textContent = "Schwach ab 15 %, Zigbee 25 % · nur Push";
      head.querySelector(".set-sec-title").insertAdjacentHTML("beforeend", '<span class="set-badge">geändert</span>');
      r.querySelector(".set-count").textContent = "2 Änderungen";
      head.scrollIntoView({ block: "start" });
    `, { bat: BAT, badges });
  } else {
    await ev(`
      const sec = r.querySelector('[data-id="integrations"]').closest(".set-sec");
      sec.querySelector(".ex-head").innerHTML = '<span>Integration</span><span style="display:flex;gap:28px"><span>Batterie ab</span><span>Anzeigen</span></span>';
      const bat = Object.fromEntries(arg.bat.map((x) => [x[0], x]));
      for (const input of sec.querySelectorAll('input[data-list="exclude_integrations"]')) {
        const row = input.closest(".ex-row"); const x = bat[input.dataset.value];
        const cell = x ? '<span class="opt-input" style="height:32px;' + (x[4] ? 'border-color:var(--dp-primary);box-shadow:inset 0 0 0 1px var(--dp-primary)' : '') + '"><input type="number" placeholder="15" value="' + (x[4] ?? '') + '" style="width:34px"><span class="unit">%</span></span>'
          : '<span style="width:84px;text-align:center;color:var(--dp-text3)">–</span>';
        row.querySelector(".switch").insertAdjacentHTML("beforebegin", cell);
      }
      const all = sec.querySelector(".ex-all .switch");
      all.insertAdjacentHTML("beforebegin", '<span style="width:84px"></span>');
      sec.querySelector(".set-sec-sum").textContent = "9 Integrationen · alle angezeigt · Batterie: Zigbee 25 %";
      sec.querySelector(".set-sec-title").insertAdjacentHTML("beforeend", '<span class="set-badge">geändert</span>');
      r.querySelector(".set-count").textContent = "1 Änderung";
      sec.scrollIntoView({ block: "start" });
    `, { bat: BAT });
  }
  await p.waitForTimeout(300);
  const file = `${tmp}${variant}-${mobile ? "mobile" : "desktop"}.png`;
  if (mobile) {
    await p.screenshot({ path: file });
  } else {
    // Nur der Dialog: Lage im iframe plus Lage des iframes auf der Seite.
    const d = await f.evaluate(new Function(`const d=${R}.querySelector("dialog.settings").getBoundingClientRect(); return {x:d.x,y:d.y,width:d.width,height:d.height}`));
    const fr = await (await p.$("#panel-frame")).boundingBox();
    await p.screenshot({ path: file, clip: { x: d.x + fr.x, y: d.y + fr.y, width: d.width, height: d.height } });
  }
  await ctx.close();
  return file;
}

// Desktop und Handy nebeneinander, mit Titel und Empfehlung. Bilder als
// Daten-URI: eine leere Seite darf keine file://-Bilder laden.
const uri = (file) => `data:image/png;base64,${readFileSync(file).toString("base64")}`;
async function compose(name, title, note, desk, mob) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(`<html><body style="margin:0;padding:24px;background:#e8eaed;font:15px system-ui,sans-serif;color:#202124">
    <h2 style="margin:0 0 4px">${title}</h2><p style="margin:0 0 16px;max-width:1300px;color:#444">${note}</p>
    <div style="display:flex;gap:28px;align-items:flex-start">
      <figure style="margin:0"><img src="${uri(desk)}" style="width:820px;border-radius:12px;box-shadow:0 4px 18px #0002"><figcaption style="text-align:center;margin-top:6px">Desktop</figcaption></figure>
      <figure style="margin:0"><img src="${uri(mob)}" style="width:390px;border-radius:12px;box-shadow:0 4px 18px #0002"><figcaption style="text-align:center;margin-top:6px">Handy</figcaption></figure>
    </div></body></html>`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}${name}`, fullPage: true });
  await ctx.close();
}

const aD = await shot("A", false), aM = await shot("A", true);
const bD = await shot("B", false), bM = await shot("B", true);
await compose("A-batterie-abschnitt.png", "A (Empfehlung): eigene Schwelle im Abschnitt \"Batterie\"",
  "Unter der allgemeinen Schwelle eine Liste nur der Integrationen mit Batteriegeräten, mit Zahl und schwächster Batterie. Leer = Standard. Alles zur Batterie an einem Ort; die Tabelle \"Integrationen\" bleibt frei für Push und Anhaltend aus Bild 5.", aD, aM);
await compose("B-integrationen-spalte.png", "B: Spalte \"Batterie ab\" in der Tabelle \"Integrationen\"",
  "Eine weitere Spalte neben \"Anzeigen\"; Integrationen ohne Batteriegeräte zeigen \"–\". Alles pro Integration in einer Tabelle, aber auf dem Handy wird es eng, sobald Push und Anhaltend (Bild 5) dazukommen.", bD, bM);
await b.close();
server.close();
console.log("fertig");
