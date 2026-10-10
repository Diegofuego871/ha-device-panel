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
  de: { title: "Unterbrüche in 24 Std.", sub: /^\d+ Unterbrüche bei \d+ Geräten · zusammen .+/, list: "Geräte · meiste Unterbrüche zuerst", offline: "ausgefallen", open: "Geräte mit Unterbrüchen zeigen", total: "zusammen ", kitchen: "· Küche", now: "jetzt", avg: "Ø 24 Std.", full: "100 %" },
  en: { title: "Outages in 24 h", sub: /^\d+ outages on \d+ devices · .+ in total/, list: "Devices · most outages first", offline: "offline", open: "Show devices with outages", total: " in total", kitchen: "· Küche", now: "now", avg: "avg. 24 h", full: "100 %" },
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
    // Der Neuaufbau der Kachelreihe (Abfrage alle 10 s) kann einen Tipp verschlucken: bis zu drei Versuche.
    let opened = false;
    for (let versuch = 1; versuch <= 3 && !opened; versuch++) {
      if (mobile) await toPulseTile();
      try { await tap(".hero .kt.pul"); } catch (err) { if (!/not attached|not stable/.test(String(err))) throw err; }
      opened = await wait(`return r.querySelector("dialog.pulse-dlg")?.open && !!r.querySelector("dialog.pulse-dlg .plist")`);
    }
    check(`[${tag}] Fenster offen`, opened);
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

    // Farbe (0.34.1, Wunsch des Nutzers): abschnittweise; rot, solange die
    // Kurve über 0 liegt (auch An- und Abstieg), grün nur, wo sie auf 0 liegt.
    const colorOf = (v) => `const s=document.createElement("span"); s.style.color="var(${v})"; r.appendChild(s); const c=getComputedStyle(s).color; s.remove(); return c`;
    const RED = await ev(colorOf("--dp-error"));
    const GREEN = await ev(colorOf("--dp-success"));
    // Feste Werte: 2,2,1,1,0,0,0 ergibt einen roten Lauf (bis zum ersten
    // Nullpunkt) und einen grünen; Fläche nur unter dem roten.
    const fixed = await ev(`const d=document.createElement("div"); d.innerHTML=r.host._pulseChartHtml([2,2,1,1,0,0,0], []); r.appendChild(d); const ls=[...d.querySelectorAll("path.line")]; const out={runs: ls.map(l=>l.classList.contains("off")?"off":"ok"), pts: ls.map(l=>l.getAttribute("d").split("L").length), colors: ls.map(l=>getComputedStyle(l).stroke), areas: d.querySelectorAll("path.area").length}; d.remove(); return out`);
    check(`[${tag}] Puls: rot über 0, grün auf 0`, JSON.stringify(fixed.runs) === '["off","ok"]' && JSON.stringify(fixed.pts) === "[5,3]" && JSON.stringify(fixed.colors) === JSON.stringify([RED, GREEN]) && fixed.areas === 1, JSON.stringify(fixed));
    const flat = await ev(`const d=document.createElement("div"); d.innerHTML=r.host._pulseChartHtml([0,0,0,0], []); r.appendChild(d); const out=[[...d.querySelectorAll("path.line")].map(l=>l.classList.contains("ok")).join(), d.querySelectorAll("path.area").length, d.querySelector(".pchart").classList.contains("quiet")]; d.remove(); return out`);
    check(`[${tag}] Puls ohne Unterbrüche: ganz grün, ohne Fläche`, JSON.stringify(flat) === '["true",0,true]', JSON.stringify(flat));
    // Echte Kurve in Kachel und Fenster: grüne Läufe liegen ganz auf 0, rote
    // haben einen Punkt darüber; gerade fehlen Geräte, also endet sie rot.
    const shape = (sel) => ev(`const c=r.querySelector(${JSON.stringify(sel)}); const base=c.querySelector("line.base"); const zero=(84-3).toFixed(1); return [...c.querySelectorAll("path.line")].map(l=>{const ys=l.getAttribute("d").replace("M","").split(" L").map(q=>q.split(",")[1]); return [l.classList.contains("off")?"off":"ok", ys.every(v=>v===zero), getComputedStyle(l).stroke]})`);
    // In der Simulation fehlt den ganzen Tag mindestens ein Gerät: die Kurve
    // erreicht 0 nie, also ein roter Lauf (gemischt: Test mit festen Werten).
    const okShape = (runs) => runs.length >= 1 && runs.every(([k, z, c]) => (k === "ok" ? z && c === GREEN : !z && c === RED)) && runs.at(-1)[0] === "off";
    const tileRuns = await shape(".hero .kt.pul .pchart");
    check(`[${tag}] Kachel: Farbe folgt der Kurve, endet rot (Geräte fehlen)`, okShape(tileRuns), JSON.stringify(tileRuns));
    if (mobile) await toPulseTile();
    await tap(".hero .kt.pul");
    await wait(`return r.querySelector("dialog.pulse-dlg")?.open`);
    const winRuns = await shape("dialog.pulse-dlg .pchart");
    check(`[${tag}] Fenster: gleiche Farben wie die Kachel`, okShape(winRuns) && JSON.stringify(winRuns.map((x) => x[0])) === JSON.stringify(tileRuns.map((x) => x[0])), JSON.stringify(winRuns));
    await ev(`r.activeElement?.blur()`);
    await p.screenshot({ path: `${outDir}/pulse-colors-${tag.replace("/", "-")}.png` });
    await tap('dialog.pulse-dlg .dlg-actions [data-pulse-close]');

    // Kachel "Verfügbarkeit" (0.34.0, Variante B): Sind alle online, steht
    // gross 100 % wie der volle Ring; der Durchschnitt 24 Std. darunter
    // bleibt unter 100 %, weil es Unterbrüche gab.
    await ev(`for (const d of r.host._devices) if (d.online !== true) { d.online = true; d.offline_since = null; } r.host._render()`);
    const kpi = await ev(`return [r.querySelector(".hero .kt .pct").textContent, r.querySelector(".hero .kt .pavg")?.textContent || "", r.querySelector(".ringwrap .c").textContent.replace(/\\s+/g," ").trim()]`);
    check(`[${tag}] alle online: gross 100 % jetzt, darunter Ø 24 Std. unter 100 %`, kpi[0] === T.full + T.now && kpi[1].startsWith(T.avg + ": ") && !kpi[1].includes("100") && ((m) => m && m[1] === m[2])(kpi[2].match(/^(\d+)\D+(\d+)/)), JSON.stringify(kpi));
    // Nie 100 % zeigen, solange ein Gerät fehlt (Rundung bei vielen Geräten)
    const many = await ev(`const devs = Array.from({length: 2000}, (_, i) => ({ id: "x" + i, name: "x", online: i > 0 })); const html = r.host._heroHtml(devs, devs.filter(d => !d.online)); return html.match(/class="pct[^"]*">([^<]*)/)[1]`);
    check(`[${tag}] 1999 von 2000: nicht 100 %`, many.startsWith("99") && many.includes("9 %"), many);
    await ev(`r.querySelector(".hero").scrollLeft = 0`);
    await p.screenshot({ path: `${outDir}/hero-kpi-${tag.replace("/", "-")}.png` });

    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
