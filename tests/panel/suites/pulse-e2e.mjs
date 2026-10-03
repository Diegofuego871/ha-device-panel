// Puls-Fenster (0.26.0, docs/mockups/pulse-v1, A): Tipp auf die Puls-Kachel
// öffnet "Unterbrüche in 24 Std." mit dem Puls gross und den Geräten (meiste
// Unterbrüche zuerst); Tipp auf einen Zeitpunkt zeigt nur die Geräte, die dann
// weg waren; Tipp auf ein Gerät öffnet sein Popup; mit Filter "Bereich" nur
// dessen Geräte. Deutsch und Englisch, Desktop und Handy, echte Klicks/Taps.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { title: "Unterbrüche in 24 Std.", sub: /^\d+ Unterbrüche bei \d+ Geräten · zusammen .+/, list: "Geräte · meiste Unterbrüche zuerst", offline: "ausgefallen", open: "Geräte mit Unterbrüchen zeigen", total: "zusammen ", kitchen: "· Küche" },
  en: { title: "Outages in 24 h", sub: /^\d+ outages on \d+ devices · .+ in total/, list: "Devices · most outages first", offline: "offline", open: "Show devices with outages", total: " in total", kitchen: "· Küche" },
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
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const rows = () => ev(`return [...r.querySelectorAll("dialog.pulse-dlg [data-pulse-dev]")].map(x=>x.dataset.pulseDev).join()`);
    // Erwartung aus den Daten: Geräte mit Unterbrüchen, meiste zuerst
    const expected = await ev(`return r.host._devices.filter(d=>!d.disabled && d.avail24?.outages).sort((a,b)=>b.avail24.outages-a.avail24.outages || (b.avail24.offline||0)-(a.avail24.offline||0) || a.name.localeCompare(b.name)).map(d=>d.id).join()`);

    // Kachel ist antippbar
    const tile = await ev(`const t=r.querySelector(".hero .kt.pul"); return t ? [t.classList.contains("tap"), t.getAttribute("role"), t.getAttribute("aria-label"), !!t.querySelector(".kchev")] : null`);
    check(`[${tag}] Puls-Kachel antippbar`, JSON.stringify(tile) === JSON.stringify([true, "button", T.open, true]), JSON.stringify(tile));
    if (mobile) await ev(`r.querySelector(".hero").scrollLeft = r.querySelector(".hero .kt.pul").offsetLeft - 12`);
    await tap(".hero .kt.pul");
    check(`[${tag}] Fenster offen`, await wait(`return r.querySelector("dialog.pulse-dlg")?.open && !!r.querySelector("dialog.pulse-dlg .plist")`));
    check(`[${tag}] Titel und Zusammenfassung`, (await text("dialog.pulse-dlg h2")) === T.title && T.sub.test(await text("dialog.pulse-dlg .dlg-sub")), await text("dialog.pulse-dlg .dlg-sub"));
    check(`[${tag}] Liste: meiste Unterbrüche zuerst`, (await rows()) === expected && expected.length > 0, `${await rows()} / ${expected}`);
    check(`[${tag}] Überschrift der Liste`, (await text("dialog.pulse-dlg h3")) === T.list);
    const first = await ev(`const row=r.querySelector("dialog.pulse-dlg .prow"); return [row.querySelector(".pval b").textContent, row.querySelector(".pval small").textContent, !!row.querySelector("svg.strip")]`);
    check(`[${tag}] Zeile mit Zahl, Dauer, Streifen`, /^\d+×$/.test(first[0]) && first[1].includes(T.total.trim()) && first[2], JSON.stringify(first));
    check(`[${tag}] ausgefallene markiert`, await ev(`return [...r.querySelectorAll("dialog.pulse-dlg .prow")].some(x=>x.querySelector(".pill.off")?.textContent === ${JSON.stringify(T.offline)})`));
    check(`[${tag}] Puls gross mit Zeitpunkten`, await ev(`return r.querySelector("dialog.pulse-dlg .pchart").getBoundingClientRect().height >= ${mobile ? 90 : 120} && r.querySelectorAll("dialog.pulse-dlg [data-pulse-at]").length > 0`));
    await ev(`r.activeElement?.blur()`);
    await p.screenshot({ path: `${outDir}/pulse-window-${tag.replace("/", "-")}.png` });

    // Zeitpunkt: nur die Geräte, die dann weg waren
    const pick = await ev(`const hits=[...r.querySelectorAll("dialog.pulse-dlg [data-pulse-at]")]; const h=hits[Math.floor(hits.length/2)]; return Number(h.dataset.pulseAt)`);
    const atIds = await ev(`return r.host._devices.filter(d=>!d.disabled && d.avail24?.strip?.[${pick}]===1).map(d=>d.id).sort().join()`);
    // Abschnitt antippen: Mitte des Rechtecks (SVG im Fenster)
    const box = await ev(`const e=r.querySelector('dialog.pulse-dlg [data-pulse-at="${pick}"]').getBoundingClientRect(); return [e.x + e.width / 2, e.y + e.height / 2]`);
    const fr = await (await p.$("#panel-frame")).boundingBox();
    if (mobile) await p.touchscreen.tap(fr.x + box[0], fr.y + box[1]); else await p.mouse.click(fr.x + box[0], fr.y + box[1]);
    check(`[${tag}] Zeitpunkt filtert die Liste`, await wait(`return [...r.querySelectorAll("dialog.pulse-dlg [data-pulse-dev]")].map(x=>x.dataset.pulseDev).sort().join() === ${JSON.stringify(atIds)} && !!r.querySelector("dialog.pulse-dlg .ppick")`), `${await rows()} / ${atIds}`);
    check(`[${tag}] Abschnitt markiert`, await ev(`return r.querySelector('dialog.pulse-dlg [data-pulse-at="${pick}"]').classList.contains("sel")`));
    await tap("dialog.pulse-dlg [data-pulse-clear]");
    check(`[${tag}] Zeitpunkt aufgehoben`, await wait(`return [...r.querySelectorAll("dialog.pulse-dlg [data-pulse-dev]")].map(x=>x.dataset.pulseDev).join() === ${JSON.stringify(expected)} && !r.querySelector("dialog.pulse-dlg .ppick")`));

    // Gerät antippen: Popup des Geräts
    const firstId = expected.split(",")[0];
    await tap(`dialog.pulse-dlg [data-pulse-dev="${firstId}"]`);
    check(`[${tag}] Gerät öffnet sein Popup`, await wait(`return !r.querySelector("dialog.pulse-dlg").open && r.querySelector("dialog.device").open && r.host._detailId === ${JSON.stringify(firstId)}`));
    await tap('dialog.device [data-dlg="close"]');
    await wait(`return !r.querySelector("dialog.device").open`);

    // Mit Filter "Bereich" (Küche): nur deren Geräte
    await ev(`r.host._setAreas(["kueche"])`);
    const kitchen = await ev(`return r.host._devices.filter(d=>d.area_id==="kueche" && !d.disabled && d.avail24?.outages).map(d=>d.id).join()`);
    if (mobile) await ev(`r.querySelector(".hero").scrollLeft = r.querySelector(".hero .kt.pul").offsetLeft - 12`);
    await tap(".hero .kt.pul");
    check(`[${tag}] Bereich: nur dessen Geräte`, await wait(`return r.querySelector("dialog.pulse-dlg")?.open`) && (await rows()) === kitchen && (await text("dialog.pulse-dlg .dlg-sub")).endsWith(T.kitchen), `${await rows()} / ${kitchen} / ${await text("dialog.pulse-dlg .dlg-sub")}`);
    await tap('dialog.pulse-dlg .dlg-actions [data-pulse-close]');
    check(`[${tag}] Schliessen`, await wait(`return !r.querySelector("dialog.pulse-dlg").open`));
    await ev(`r.host._setAreas([])`);
    // Tastatur (Desktop): Enter auf der Kachel
    if (!mobile) {
      await ev(`r.querySelector(".hero .kt.pul").focus()`);
      await p.keyboard.press("Enter");
      check(`[${tag}] Enter öffnet`, await wait(`return r.querySelector("dialog.pulse-dlg").open`));
      await p.keyboard.press("Escape");
      check(`[${tag}] Escape schliesst`, await wait(`return !r.querySelector("dialog.pulse-dlg").open`));
    }

    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
