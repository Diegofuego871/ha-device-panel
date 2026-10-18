// "Erst melden nach" pro Gerät und Integration (2.91.0): Geräte-Popup (Auswahl Standard/Eigene Zeit,
// nie kürzer als "Ausgefallen nach"), Integrationsdetail, Zurücksetzen. DE/EN, Desktop/Handy.
import { chromium } from "playwright-core";
import { launchOptions, ensureDevTab, savePending } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

const TEXT = {
  de: { glob: "Globaler Wert (2 Min.)", integ: "Wie Integration (10 Min.)", own: "Eigene Zeit", label: "Erst melden nach" },
  en: { glob: "Global value (2 min)", integ: "Same as integration (10 min)", own: "Own time", label: "Report only after" },
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
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=light`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
    const ev = async (c) => { await ensureDevTab(f, R, c); return f.evaluate(new Function(`const r=${R};` + c)); };
    const handle = async (sel) => { await ensureDevTab(f, R, sel); return (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement(); };
    const wait = async (code) => { await ensureDevTab(f, R, code); return f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false); };
    const calls = async () => { await savePending(f, R); return p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_device_settings").map(({ type, ...rest }) => rest)); };
    const openDev = async (id) => {
      await ev(`r.host._openDevice(${JSON.stringify(id)})`);
      await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('dialog.device [data-tab="set"]')`);
      await (await handle('dialog.device [data-tab="set"]')).click();
      await wait(`return r.querySelector('select[data-dlg="dev-delay"]')`);
    };

    await openDev("e");
    const s0 = await ev(`const s=r.querySelector('select[data-dlg="dev-delay"]'); return s.value + "|" + s.options[s.selectedIndex].textContent`);
    check(`[${tag}] Standard: globaler Wert`, s0 === `default|${T.glob}`, s0);
    check(`[${tag}] Beschriftung`, (await ev(`return r.querySelector('select[data-dlg="dev-delay"]').closest(".opt").querySelector(".opt-label").textContent`)) === T.label);

    // Eigene Zeit startet beim geltenden Wert
    await (await handle('select[data-dlg="dev-delay"]')).selectOption("own");
    check(`[${tag}] eigene Zeit beginnt bei 2, gesendet`, await wait(`return r.querySelector('input[data-dlg="dev-delay-min"]')?.value === "2"`) && (await calls()).at(-1).notify_delay === 2, JSON.stringify((await calls()).at(-1)));
    await ev(`const i=r.querySelector('input[data-dlg="dev-delay-min"]'); i.focus(); i.select()`);
    await p.keyboard.type("15");
    await p.keyboard.press("Tab");
    check(`[${tag}] 15 Min. gesendet`, await wait(`return r.host._devices.find((d) => d.id === "e").notify_delay_setting === 15`) && (await calls()).at(-1).notify_delay === 15, JSON.stringify((await calls()).at(-1)));

    // Grafik im Reiter: zwei Balken, "Ausgefallen nach" und "Erst melden nach" (2.93.0); ohne Push nur einer mit Grund
    const rowsOf = () => ev(`return [...r.querySelectorAll("dialog.device .ptl .ptl-row")].map((x) => x.className.replace("ptl-row","").trim() + ":" + x.querySelector("b").textContent.trim()).join("|")`);
    await p.evaluate(() => { window.__opts.notify_service = "notify.familie"; window.__opts.notify_outage = true; });
    await ev(`r.host._fetch(true)`);
    await wait(`return r.host._devices.find((d) => d.id === "e").notify_default?.push === true`);
    await (await handle('dialog.device [data-tab="ov"]')).click();
    await (await handle('dialog.device [data-tab="set"]')).click();
    await wait(`return r.querySelector('select[data-dlg="dev-delay"]')`);
    const un = lang === "de" ? "Min." : "min";
    check(`[${tag}] Grafik: Balken "Ausgefallen nach" und Push-Balken`, await wait(`return r.querySelectorAll("dialog.device .ptl .ptl-row").length === 2`), await rowsOf());
    const r0 = await rowsOf();
    check(`[${tag}] Push-Balken zeigt die eigene Meldezeit (15 ${un})`, r0.split("|")[1]?.includes("15"), r0);
    // Kürzer als "Ausgefallen nach" (Gerät: 30 Min.) wird abgelehnt
    await (await handle('select[data-dlg="dev-off"]')).selectOption("own");
    await ev(`const i=r.querySelector('input[data-dlg="dev-off-min"]'); i.focus(); i.select()`);
    await p.keyboard.type("30");
    await p.keyboard.press("Tab");
    await savePending(f, R);
    check(`[${tag}] "Ausgefallen nach" 30 bei eigener Meldezeit 15: Fehler, nicht gespeichert`,
      await wait(`return !!r.host._devSetError`) && (await p.evaluate(() => window.__devSettings.offline.e)) !== 30,
      await ev(`return String(r.host._devSetError)`));
    await (await handle('select[data-dlg="dev-off"]')).selectOption("default");
    await savePending(f, R);

    // Zurück auf Standard
    await (await handle('select[data-dlg="dev-delay"]')).selectOption("default");
    await savePending(f, R);
    check(`[${tag}] zurück auf Standard`, await wait(`return r.host._devices.find((d) => d.id === "e").notify_delay_setting === null`));
    await (await handle('dialog.device [data-dlg="close"]')).click();
    await wait(`return !r.querySelector("dialog.device").open`);

    // Integration mit eigener Zeit: Gerät zeigt "Wie Integration"
    await p.evaluate(() => { window.__opts.notify_delay_integrations = { zha: 10 }; window.__devSettings.offline = {}; });
    await ev(`r.host._fetch(true)`);
    await wait(`return r.host._devices.find((d) => d.id === "e").notify_delay_default.integration === "zha"`);
    await openDev("e");
    const s1 = await ev(`const s=r.querySelector('select[data-dlg="dev-delay"]'); return s.options[s.selectedIndex].textContent`);
    check(`[${tag}] "${T.integ}"`, s1 === T.integ, s1);
    await (await handle('dialog.device [data-dlg="close"]')).click();

    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
