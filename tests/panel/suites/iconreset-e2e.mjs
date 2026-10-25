// Symbol "reset" (App-Logo und alle Zurücksetzen-Knöpfe, 2.147.0): Ring mit Pfeilspitze oben und nur einem kurzen Unterbruch direkt hinter der Spitze.
// Geprüft wird der Pfad im Panel und seine Wiedergabe: Ring sonst durchgehend, auch unten (kein Schnitt unten), Lücke rechts oben hinter der Spitze.
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const src = readFileSync(new URL("../../../custom_components/device_panel/panel/device-panel.js", import.meta.url), "utf8");
const d = (src.match(/^ {2}reset: "([^"]+)"/m) || [])[1] || "";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
check("Pfad gefunden: Ringstück und Pfeilspitze (zwei Teile)", d && (d.match(/M/g) || []).length === 2, d);
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
  // Punkte auf dem Ring (Mitte 12/12, Radius 7, Skala 10), Winkel im Uhrzeigersinn ab oben: von 75 bis 345 Grad alle 15 Grad gefüllt (auch unten),
  // bei 45 Grad (hinter der Pfeilspitze) leer
  const at = (a) => {
    const x = Math.round((12 + 7 * Math.sin((a * Math.PI) / 180)) * 10);
    const y = Math.round((12 - 7 * Math.cos((a * Math.PI) / 180)) * 10);
    return g.getImageData(x, y, 1, 1).data[3];
  };
  const miss = [];
  for (let a = 75; a <= 345; a += 15) if (at(a) < 200) miss.push(a);
  return { miss, gap: at(45) };
});
check("Ring durchgehend von 75 bis 345 Grad, auch unten (kein Schnitt unten)", res.miss.length === 0, res.miss.join());
check("Ringmitte genau bei (12,12): der Ring dreht um die eigene Achse, ohne zu eiern (seit 2.154.1)", /^M18\.93,8\.00A8,8 0 1 1 12,4L12,6A6,6 0 1 0 17\.20,9\.00Z/.test(d), d);
check("kurzer Unterbruch direkt hinter der Pfeilspitze (bei 45 Grad leer)", res.gap < 50, String(res.gap));
await b.close();
process.exit(ok ? 0 : 1);
