// Mockups launcher-v3 (Wunsch des Nutzers, 2026-10-13): Symbole im Launcher in den Farben der Einstellungen von Home Assistant.
// Die Farben sind aus einem Screenshot der HA-Einstellungen gemessen (Geräte & Dienste #0D47A1, Automationen & Szenen #518C43,
// Bereiche #E48629, Companion-App #8E24AA, Konnektivität #00838F, Sprachassistenten #3263C3, System #301ABE, Werkzeuge #7A5AA6,
// Über #4A5963, Dashboards #B1345C). Alles im echten Panel (Nachbau, erfundene Daten), Farben per Stil nach App-Schlüssel.
//   1: Variante A (Empfehlung): Kreis in der HA-Farbe, weisses Symbol, wie in den Einstellungen von HA; Desktop und Handy
//   2: Variante B: helle Fläche in der HA-Farbe, Symbol in der HA-Farbe (ruhiger)
//   3: Vorher (jetzt: alles blau) und Nachher (A) in der Liste, Handy
// Aufruf: CHROMIUM_PATH=... node docs/mockups/launcher-v3/src/render.mjs
import { setup } from "../../_lib/mock.mjs";
const { page, compose, close } = await setup(8998, import.meta.url);
const tmp = new URL("./out/", import.meta.url).pathname;

// App-Schlüssel -> HA-Farbe (Zuordnung wie in den Einstellungen von HA; Panel-Apps und Verlauf/Logbuch haben dort keine Entsprechung)
const COL = {
  timer: "#00838F", magic: "#8E24AA", log: "#4A5963",
  auto: "#518C43", scene: "#518C43", script: "#518C43",
  helper: "#0D47A1", dev: "#0D47A1", ent: "#0D47A1", integ: "#0D47A1",
  area: "#E48629", tools: "#7A5AA6", backup: "#301ABE", hist: "#B1345C", book: "#3263C3",
};
const A = Object.entries(COL).map(([k, c]) => `.ap-ico:is([data-id="${k}"] *), [data-id="${k}"] .ap-ico { background: ${c}; color: #fff; }`).join("\n");
const B = Object.entries(COL).map(([k, c]) => `[data-id="${k}"] .ap-ico { background: color-mix(in srgb, ${c} 18%, transparent); color: ${c}; }`).join("\n");
const CSS_A = Object.entries(COL).map(([k, c]) => `[data-id="${k}"] .ap-ico { background: ${c}; color: #fff; }`).join("\n");
void A;

async function shotOf(mobile, css, name, { list = false } = {}) {
  const { ctx, p, ev } = await page(mobile, { css });
  if (list) await ev(`localStorage.setItem("device_panel_apps", JSON.stringify({ layout: { desktop: "list", phone: "list" } }))`);
  await ev(`r.querySelector(".apps-btn").click();`);
  await p.waitForTimeout(500);
  const file = `${tmp}${name}.png`;
  await p.screenshot({ path: file, ...(mobile ? {} : { clip: { x: 700, y: 40, width: 700, height: 760 } }) });
  await ctx.close();
  return file;
}

await compose("1-Variante-A.png", [
  [await shotOf(false, CSS_A, "1d"), "A (Empfehlung), Desktop: Kreis in der HA-Farbe, weisses Symbol wie in den Einstellungen von HA", 560],
  [await shotOf(true, CSS_A, "1m"), "A, Handy", 300],
]);
await compose("2-Variante-B.png", [
  [await shotOf(false, B, "2d"), "B, Desktop: helle Fläche, Symbol in der HA-Farbe (ruhiger)", 560],
  [await shotOf(true, B, "2m"), "B, Handy", 300],
]);
await compose("3-Vorher-Nachher.png", [
  [await shotOf(true, "", "3v", { list: true }), "Vorher (jetzt): alle Symbole blau", 300],
  [await shotOf(true, CSS_A, "3n", { list: true }), "Nachher (A): Liste mit HA-Farben", 300],
]);
await close();
