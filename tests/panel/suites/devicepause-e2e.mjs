// Überwachung eines Geräts pausieren (2.214.0, Issue 4, docs/mockups/pause-v1, A): Chip "Pausieren …" in der Zeile "Überwachen" (keine zusätzliche Zeile),
// Fenster mit "Bis wieder online" und "Bis Datum" (Schnellwahl, eigenes Datum, Vergangenheit gesperrt), Entwurf und Speichern, Chip orange mit dem Ende,
// Reiter darunter ruhen, Pille in der Geräteliste, "Pause beenden". Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir, savePending } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const T = {
  de: { chip: "Pausieren …", title: "Überwachung pausieren", online: "Bis wieder online", date: "Bis Datum", chipOnline: "Pausiert bis wieder online", pill: "Pausiert bis online", end: "Pause beenden", apply: "Pausieren", past: "liegt in der Vergangenheit", pickDate: "Wähle ein Datum", april: "1. April" },
  en: { chip: "Pause …", title: "Pause monitoring", online: "Until online again", date: "Until date", chipOnline: "Paused until online again", pill: "Paused until online", end: "End pause", apply: "Pause", past: "past", pickDate: "Pick a date", april: "1 April" },
};
for (const lang of ["de", "en"]) {
  const L = T[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
    const text = (s) => ev(`return (r.querySelector(${JSON.stringify(s)})?.innerText || "").replace(/\\s+/g," ").trim()`);
    const calls = async () => { await savePending(f, R); return p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_device_settings" && "monitor_pause" in m).map(({ type, id, ...rest }) => rest)); };
    const D = "dialog.device";
    const Z = "dialog.dpz-dlg";
    const chip = `${D} .dpz-chip`;

    await ev(`r.host._openDevice("e")`);
    await wait(`return r.querySelector('${D} [data-tab="set"]')`);
    await tap(`${D} [data-tab="set"]`);
    check(`[${tag}] Chip "${L.chip}" in der Herkunftszeile der Zeile "Überwachen" (keine zusätzliche Zeile)`, (await wait(`return !!r.querySelector('${chip}')`)) && (await text(chip)) === L.chip && (await ev(`const c = r.querySelector('${chip}'); return !!c.closest(".opt-origin") && c.closest(".opt").querySelector(".switch") !== null`)));
    await p.screenshot({ path: `${outDir}/devicepause-${tag.replace("/", "-")}-1.png` });
    await tap(chip);
    check(`[${tag}] Fenster "${L.title}": zwei Reiter "${L.online}" und "${L.date}", "${L.online}" gewählt`, (await wait(`return r.querySelector('${Z}')?.open`)) && (await text(`${Z} #dpz-t`)) === L.title && (await ev(`const t = [...r.querySelectorAll('${Z} [data-dlg="dpz-mode"]')]; return t.length === 2 && t[0].textContent.trim() === ${JSON.stringify(L.online)} && t[0].classList.contains("on") && t[1].textContent.trim() === ${JSON.stringify(L.date)}`)));
    check(`[${tag}] noch keine Pause: kein Knopf "${L.end}"`, await ev(`return !r.querySelector('${Z} [data-dpz="end"]')`));

    // Bis wieder online
    await p.screenshot({ path: `${outDir}/devicepause-${tag.replace("/", "-")}-2.png` });
    await tap(`${Z} [data-dpz="apply"]`);
    check(`[${tag}] "Bis wieder online" übernommen: Chip orange "${L.chipOnline}", Reiter darunter ruhen`, (await wait(`return r.querySelector('${chip}')?.classList.contains("on")`)) && (await text(chip)) === L.chipOnline && (await ev(`return !r.querySelector('${D} .lvl-body') && !!r.querySelector('${D} .dpz-note')`)));
    await p.screenshot({ path: `${outDir}/devicepause-${tag.replace("/", "-")}-3.png` });
    check(`[${tag}] Kopf zeigt schon im Entwurf die Pille "${L.pill}" statt "Online"`, await ev(`const h = r.querySelector('${D} .dlg-head'); return h.textContent.includes(${JSON.stringify(L.pill)}) && !h.querySelector(".pill.on")`));
    check(`[${tag}] gespeichert: monitor_pause {mode: online}`, (await calls()).some((x) => x.monitor_pause?.mode === "online"), JSON.stringify(await calls()));
    check(`[${tag}] Pille in der Geräteliste "${L.pill}"`, await ev(`const d = r.host._devices.find((x) => x.id === "e"); return d.unmonitored === true && r.host._statusHtml(d).includes("pz") && r.host._statusHtml(d).includes(${JSON.stringify(L.pill)})`));
    const fits = await ev(`const b = r.querySelector('${D} .dlg-body'); return b.scrollWidth <= b.clientWidth + 1`);
    check(`[${tag}] kein seitliches Scrollen`, fits);

    // Pause beenden
    await tap(chip);
    await p.screenshot({ path: `${outDir}/devicepause-${tag.replace("/", "-")}-4.png` }).catch(() => {});
    check(`[${tag}] Fenster bei aktiver Pause: Knopf "${L.end}", "${L.online}" gewählt`, (await wait(`return r.querySelector('${Z}')?.open && !!r.querySelector('${Z} [data-dpz="end"]')`)) && (await ev(`return r.querySelector('${Z} [data-dlg="dpz-mode"].on').dataset.v === "online"`)));
    check(`[${tag}] "${L.end}" ist ein deutlich sichtbarer Knopf (volle Breite, Rand, gleiche Höhe wie die anderen)`, await ev(`const e = r.querySelector('${Z} [data-dpz="end"]'); const a = r.querySelector('${Z} [data-dpz="apply"]'); const c = r.querySelector('${Z} .pu-card'); return e.classList.contains("dlg-btn") && e.getBoundingClientRect().width > c.getBoundingClientRect().width * 0.8 && Math.abs(e.getBoundingClientRect().height - a.getBoundingClientRect().height) < 4 && parseFloat(getComputedStyle(e).borderTopWidth) >= 1`));
    await tap(`${Z} [data-dpz="end"]`);
    check(`[${tag}] "${L.end}": Chip wieder "${L.chip}", Reiter wieder da`, (await wait(`return !r.querySelector('${chip}')?.classList.contains("on")`)) && (await text(chip)) === L.chip && (await wait(`return !!r.querySelector('${D} .lvl-body')`)));
    check(`[${tag}] gespeichert: monitor_pause null`, (await calls()).some((x) => x.monitor_pause === null), JSON.stringify(await calls()));

    // Bis Datum
    await tap(chip);
    await wait(`return r.querySelector('${Z}')?.open`);
    await tap(`${Z} [data-dlg="dpz-mode"][data-v="date"]`);
    check(`[${tag}] "${L.date}": Schnellwahl (1 Monat, 3 Monate, ${L.april}) und eigenes Datum, "${L.apply}" gesperrt bis ein Datum gewählt ist`, (await wait(`return r.querySelectorAll('${Z} [data-dlg="dpz-q"]').length === 3`)) && (await ev(`return !!r.querySelector('${Z} input[type=date]') && r.querySelector('${Z} [data-dpz="apply"]').disabled`)) && (await text(`${Z} [data-dpz-res]`)).includes(L.pickDate));
    await tap(`${Z} [data-dlg="dpz-q"][data-v="spring"]`);
    check(`[${tag}] "${L.april}": Datum eingesetzt, Ergebnis mit "00:00", "${L.apply}" frei`, (await wait(`return !r.querySelector('${Z} [data-dpz="apply"]').disabled`)) && (await text(`${Z} [data-dpz-res]`)).includes("00:00") && (await ev(`const v = r.querySelector('${Z} input[type=date]').value; const t = new Date(v + "T00:00:00").getTime(); return /^\\d{4}-04-01$/.test(v) && t > Date.now()`)));
    // Vergangenheit sperrt
    await ev(`const i = r.querySelector('${Z} input[type=date]'); const d = new Date(Date.now() - 2 * 86400000); const p = (n) => String(n).padStart(2, "0"); i.value = d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true }));`);
    check(`[${tag}] Datum in der Vergangenheit: Fehler, "${L.apply}" gesperrt`, (await wait(`return r.querySelector('${Z} [data-dpz="apply"]').disabled && r.querySelector('${Z} .pu-res.bad')`)) && (await text(`${Z} [data-dpz-res]`)).length > 0);
    await tap(`${Z} [data-dlg="dpz-q"][data-v="month"]`);
    await tap(`${Z} [data-dpz="apply"]`);
    check(`[${tag}] "1 Monat" übernommen: Chip orange mit Datum`, (await wait(`return r.querySelector('${chip}')?.classList.contains("on")`)) && /\d{4}/.test(await text(chip)), await text(chip));
    const sent = (await calls()).filter((x) => x.monitor_pause?.mode === "date");
    check(`[${tag}] gespeichert: monitor_pause {mode: date, until} in der Zukunft`, sent.length > 0 && sent.at(-1).monitor_pause.until * 1000 > Date.now() + 25 * 86400000 && sent.at(-1).monitor_pause.until * 1000 < Date.now() + 40 * 86400000, JSON.stringify(sent));
    // Ausgefallenes Gerät (2.214.1): Knopf "Pausieren" gleich im Kopf, gilt ohne "Speichern"
    await tap(`${D} .dlg-close`);
    await wait(`return !r.querySelector('${D}')?.open`);
    const down = await ev(`return r.host._devices.find((x) => x.online === false && !x.disabled && !x.unmonitored)?.id || ""`);
    check(`[${tag}] ein ausgefallenes Gerät im Simulator gefunden`, !!down);
    await ev(`r.host._openDevice(${JSON.stringify(down)})`);
    await wait(`return r.querySelector('${D}')?.open`);
    check(`[${tag}] ausgefallenes Gerät: Knopf "${L.apply}" im Kopf neben dem Status`, await wait(`return !!r.querySelector('${D} .dlg-sub .dpz-head')`) && (await text(`${D} .dlg-sub .dpz-head`)) === L.apply);
    await ev(`r.host._openDevice("e")`);
    await wait(`return r.querySelector('${D}')?.open`);
    check(`[${tag}] Gerät online: kein Knopf im Kopf`, await ev(`return !r.querySelector('${D} .dlg-sub .dpz-head')`));
    await ev(`r.host._openDevice(${JSON.stringify(down)})`);
    await wait(`return !!r.querySelector('${D} .dlg-sub .dpz-head')`);
    const before = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_device_settings" && "monitor_pause" in m).length);
    await tap(`${D} .dlg-sub .dpz-head`);
    check(`[${tag}] Knopf im Kopf öffnet das Fenster mit "${L.online}"`, (await wait(`return r.querySelector('${Z}')?.open`)) && (await ev(`return r.querySelector('${Z} [data-dlg="dpz-mode"].on').dataset.v === "online"`)));
    await tap(`${Z} [data-dpz="apply"]`);
    check(`[${tag}] gilt gleich ohne "Speichern": monitor_pause {mode: online} gesendet`, await p.waitForFunction((n) => window.__wsCalls.filter((m) => m.type === "device_panel/set_device_settings" && "monitor_pause" in m).length > n, before, { timeout: 4000 }).then(() => true, () => false));
    check(`[${tag}] danach Pille im Kopf, Knopf weg`, (await wait(`return !!r.querySelector('${D} .dlg-sub .pill.pz') && !r.querySelector('${D} .dlg-sub .dpz-head')`)));
    await tap(`${D} .dlg-close`);
    check(`[${tag}] keine Fehler`, errors.length === 0, errors.join("|"));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
