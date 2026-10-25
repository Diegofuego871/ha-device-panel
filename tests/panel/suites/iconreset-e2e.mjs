// Symbol "reset" (App-Logo und alle Zurücksetzen-Knöpfe, 2.146.0): ein geschlossener Ring mit Pfeilspitze, ohne Unterbruch.
// Geprüft wird der Pfad im Panel und seine Wiedergabe: Ring durchgehend (Pixel unten, links, rechts, oben getroffen), Lücke unten rechts weg.
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const src = readFileSync(new URL("../../../custom_components/device_panel/panel/device-panel.js", import.meta.url), "utf8");
const d = (src.match(/^ {2}reset: "([^"]+)"/m) || [])[1] || "";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
check("Pfad gefunden: Ring aussen, Ring innen, Pfeilspitze (drei Teile)", d && (d.match(/M/g) || []).length === 3, d);
const page = await (await b.newContext({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 4 })).newPage();
await page.setContent(`<body style="margin:0;background:#fff"><svg id="s" width="240" height="240" viewBox="0 0 24 24"><path fill="#000" d="${d}"/></svg>`);
const res = await page.evaluate(async () => {
  const svg = document.getElementById("s");
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  await img.decode();
  const c = document.createElement("canvas");
  c.width = 240; c.height = 240;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  // Punkte auf dem Ring (Mitte 12/13, Radius 7, Skala 10) im Umlauf alle 15 Grad: jeder muss gefüllt sein
  const miss = [];
  for (let a = 0; a < 360; a += 15) {
    const x = Math.round((12 + 7 * Math.cos((a * Math.PI) / 180)) * 10);
    const y = Math.round((13 + 7 * Math.sin((a * Math.PI) / 180)) * 10);
    if (g.getImageData(x, y, 1, 1).data[3] < 200) miss.push(a);
  }
  return miss;
});
check("Ring durchgehend: alle 24 Punkte rund um den Ring sind gefüllt (auch unten rechts)", res.length === 0, res.join());
await b.close();
process.exit(ok ? 0 : 1);
