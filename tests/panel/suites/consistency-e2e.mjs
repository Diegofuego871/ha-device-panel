// Konsistenz (2.94.0, Gegenstück zu tests/test_consistency.py): jede Art "eigene Einstellung pro Gerät", die das Backend in
// get_options.overrides liefert, ist im Panel an allen Stellen verdrahtet: Zurücksetzen vorgemerkt (st.resets), in den
// Änderungen (_settingsResetChanges), in der Speichernachricht, mit eigener Liste (_overridesHtml) und als Marke am Gerät.
// Eine neue Art ohne Verdrahtung lässt diese Suite fehlschlagen.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto("http://127.0.0.1:8950/ha-sim.html?lang=de&theme=light");
const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));

// Eigene Einstellungen für Geräte, damit die Übersicht jeder Art gefüllt ist
await p.evaluate(() => {
  window.__devSettings.battery = { e: 20 };
  window.__devSettings.signal = { e: -90 };
  window.__devSettings.offline = { e: 30 };
  window.__devSettings.notifyDelay = { e: 40 };
  window.__devSettings.notifyOff = new Set(["e"]);
});
await ev(`r.host._openSettings?.(); return 1`).catch(() => {});
await ev(`r.querySelector(".gear-btn")?.click()`);
await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.settings")?.open && ${R}.host._settings?.data?.overrides`), null, { timeout: 8000 });

const kinds = await ev(`return Object.keys(r.host._settings.data.overrides)`);
check("Das Backend (Simulator) liefert die sieben Arten", kinds.length === 7, kinds.join());
for (const kind of kinds) {
  check(`Art "${kind}": st.resets hat eine Menge`, await ev(`return r.host._settings.resets?.[${JSON.stringify(kind)}] instanceof Set`));
  check(`Art "${kind}": Zurücksetzen erscheint als Änderung "reset_${kind}"`, await ev(`const st = r.host._settings; st.resets[${JSON.stringify(kind)}].add("x"); const c = r.host._settingsResetChanges(); st.resets[${JSON.stringify(kind)}].delete("x"); return c.includes("reset_${kind}")`));
  check(`Art "${kind}": eigene Liste (_overridesHtml) vorhanden`, await ev(`return String(r.host._overridesHtml(${JSON.stringify(kind)}) || "").length > 20`));
  await p.evaluate(() => { window.__wsCalls.length = 0; });
  await ev(`const st = r.host._settings; st.resets[${JSON.stringify(kind)}].add("x"); r.host._saveSettings()`);
  check(`Art "${kind}": Speichern schickt reset_device_settings mit "${kind}"`, await f.waitForFunction(new Function(`return window.parent.__wsCalls?.some?.((m) => m.type === "device_panel/reset_device_settings" && Array.isArray(m[${JSON.stringify(kind)}]) && m[${JSON.stringify(kind)}].includes("x"))`), null, { timeout: 4000 }).then(() => true, () => false));
  await f.waitForFunction(new Function(`return !${R}.host._settings.saving`), null, { timeout: 4000 }).catch(() => {});
}
// Marke am Gerät: die Geräte-Zeile zeigt eine Marke, sobald irgendeine eigene Einstellung gilt
check("Marke am Gerät mit eigener Einstellung", await ev(`const d = r.host._devices.find((x) => x.id === "e"); return !!d && (d.offline_setting != null || d.notify_delay_setting != null || d.battery_setting != null || d.signal_setting != null || d.notify_off)`));
check("keine Seitenfehler", errors.length === 0, errors.join("; "));
await b.close();
process.exit(ok ? 0 : 1);
