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
    // Handy: Kachel in den Blick scrollen und warten, bis das Einrasten (scroll-snap) fertig ist;
    // sonst wandert die Kachel unter dem Finger weg und der Tipp geht daneben (seltener Fehlschlag).
    const toPulseTile = async () => {
      await ev(`r.querySelector(".hero").scrollLeft = r.querySelector(".hero .kt.pul").offsetLeft - 12`);
      await f.evaluate(new Function(`const r=${R}; const t=r.querySelector(".hero .kt.pul"); return new Promise((done) => { let last = null, same = 0; const tick = () => { const x = Math.round(t.getBoundingClientRect().left); same = x === last ? same + 1 : 0; last = x; if (same >= 6) done(); else requestAnimationFrame(tick); }; tick(); })`));
    };
    const rows = () => ev(`return [...r.querySelectorAll("dialog.pulse-dlg [data-pulse-dev]")].map(x=>x.dataset.pulseDev).join()`);
    // Erwartung aus den Daten: Geräte mit Unterbrüchen, meiste zuerst
    const expected = await ev(`return r.host._devices.filter(d=>!d.disabled && d.avail24?.outages).sort((a,b)=>b.avail24.outages-a.avail24.outages || (b.avail24.offline||0)-(a.avail24.offline||0) || a.name.localeCompare(b.name)).map(d=>d.id).join()`);

    // Regression (0.33.1): Die Achse hing an der Sekunde der Abfrage; alle 10 s änderte sich der Text,
    // setHtml ersetzte die Kachelreihe, und ein Tipp genau dabei ging verloren.
    const stable = await ev(`const h=r.host; const p=[0,1,2,3,0,1,0,2]; const base=Math.floor(Date.now()/1000/60)*60+5; const html=(t)=>{h._serverNow=t; return h._pulseChartHtml(p, [{at: base-3600}])}; const a=html(base), b=html(base+10), c=html(base+50), d=html(base+65); return [a===b, a===c, a!==d]`);
    check(`[${tag}] Achse der Puls-Kachel bleibt innerhalb einer Minute gleich (Kachelreihe wird nicht ersetzt)`, JSON.stringify(stable) === "[true,true,true]", JSON.stringify(stable));

    // Kachel ist antippbar
    const tile = await ev(`const t=r.querySelector(".hero .kt.pul"); return t ? [t.classList.contains("tap"), t.getAttribute("role"), t.getAttribute("aria-label"), !!t.querySelector(".kchev")] : null`);
    check(`[${tag}] Puls-Kachel antippbar`, JSON.stringify(tile) === JSON.stringify([true, "button", T.open, true]), JSON.stringify(tile));
    if (mobile) await toPulseTile();
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
    if (mobile) await toPulseTile();
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

    // Farbe (0.34.0): rot, solange ein Gerät ausgefallen ist; sind alle wieder
    // da, wird der Puls grün, die Höcker der Unterbrüche bleiben sichtbar.
    const look = () => ev(`const c=r.querySelector(".hero .kt.pul .pchart"); return [c.classList.contains("calm"), getComputedStyle(c.querySelector(".line")).stroke, c.querySelector(".line").getAttribute("d").split("L").some((pt)=>Number(pt.split(",")[1])<70)]`);
    const ok_ = await ev(`return getComputedStyle(r.host).getPropertyValue("--dp-success").trim()`);
    const red = await look();
    check(`[${tag}] Puls rot, solange Geräte ausgefallen sind`, red[0] === false && red[2] && await ev(`return r.host._devices.some(d=>!d.disabled && d.online===false)`), JSON.stringify(red));
    await ev(`for (const d of r.host._devices) if (d.online === false) { d.online = true; d.offline_since = null; } r.host._render()`);
    const green = await look();
    const want = await ev(`const s=document.createElement("span"); s.style.color=${JSON.stringify(ok_)}; r.appendChild(s); const c=getComputedStyle(s).color; s.remove(); return c`);
    check(`[${tag}] Puls grün, sobald alle wieder online sind, Höcker bleiben`, green[0] === true && green[1] === want && green[2], `${JSON.stringify(green)} / ${want}`);
    if (mobile) await toPulseTile();
    await tap(".hero .kt.pul");
    check(`[${tag}] Puls im Fenster ebenfalls grün`, await wait(`return r.querySelector("dialog.pulse-dlg")?.open && r.querySelector("dialog.pulse-dlg .pchart").classList.contains("calm")`));
    await ev(`r.activeElement?.blur()`);
    await p.screenshot({ path: `${outDir}/pulse-calm-${tag.replace("/", "-")}.png` });
    await tap('dialog.pulse-dlg .dlg-actions [data-pulse-close]');

    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
