// Kopf auf dem Handy (1.26.0, docs/mockups/hero-mobile-v1, V2): "Verfügbarkeit" und
// "Gerade ausgefallen" stehen kompakt nebeneinander (je die halbe Breite), der
// Ausfall-Puls ist eine schlanke Zeile darunter; kein seitliches Wischen, nichts
// ragt aus den Kacheln. Auf dem Handy zwei Geräte in der Liste und eine kurze
// Warnzeile, der Text des Sammelausfalls steht im Puls-Fenster. Ab 601 px
// (Tablet, Desktop) bleibt alles wie vorher. Deutsch und Englisch, iPhone 17
// (402 x 874), kleines Handy (375 x 667), Desktop, Tablet und die Grenze 600/601 px.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: {
    warnShort: /^\d+ Warnung(en)?$/, warnLong: /^\d+ Geräte? mit Warnung$/, more2: "+ 2 weitere", allOnline: "Alles online", durs: "Kein Gerät ist gerade ausgefallen.",
    incTitle: /^\d\d:\d\d · Sammelausfall$/, incText: /gleichzeitig/, ofTotal: /^von \d+ online$/, avg: "Ø 24 Std.",
  },
  en: {
    warnShort: /^\d+ warnings?$/, warnLong: /^\d+ devices? with a warning$/, more2: "+ 2 more", allOnline: "Everything online", durs: "No device is offline right now.",
    incTitle: /^\d\d:\d\d( [AP]M)? · Group outage$/, incText: /at once/, ofTotal: /^of \d+ online$/, avg: "avg. 24 h",
  },
};
const PHONES = [
  { name: "iPhone 17", width: 402, height: 874 },
  { name: "kleines Handy", width: 375, height: 667 },
];

async function open(lang, opts) {
  const ctx = await b.newContext(opts.mobile
    ? { viewport: { width: opts.width, height: opts.height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: opts.width, height: opts.height } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
  const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
  await ev(`r.host._fetch = () => {};`);
  const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
  const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (opts.mobile) await h.tap(); else await h.click(); };
  const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
  // Sichtbarer Text (innerText folgt display: none), ohne Mehrfach-Leerzeichen
  const vis = (sel) => ev(`const e=r.querySelector(${JSON.stringify(sel)}); return e ? e.innerText.replace(/\\s+/g," ").trim() : null`);
  const rect = (sel) => ev(`const e=r.querySelector(${JSON.stringify(sel)}); if (!e) return null; const q=e.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height, r: q.right, b: q.bottom }`);
  const shown = (sel) => ev(`const e=r.querySelector(${JSON.stringify(sel)}); return !!e && getComputedStyle(e).display !== "none"`);
  // Alles online: wie beim Nutzer, ohne Ausfälle
  const allOnline = async () => {
    await ev(`const h = r.host; for (const d of h._devices) if (d.online === false) { d.online = true; d.offline_since = null; } h._render();`);
    await wait(`return !r.querySelector(".kt.err")`);
  };
  return { ctx, p, f, ev, tap, wait, vis, rect, shown, allOnline, errors };
}

// Nichts ragt aus einer Kachel: weder Elemente (rechts/links) noch Text, der seitlich überläuft
const OVERFLOW = `const out = [];
  for (const t of r.querySelectorAll(".hero .kt")) {
    const tb = t.getBoundingClientRect();
    if (t.scrollWidth > t.clientWidth + 1) out.push("Kachel scrollt: " + t.className);
    for (const e of t.querySelectorAll("*")) {
      if (e.closest("svg") && e.tagName !== "svg") continue;
      if (getComputedStyle(e).display === "none") continue;
      const q = e.getBoundingClientRect();
      if (!q.width || !q.height) continue;
      if (q.right > tb.right + 0.5 || q.left < tb.left - 0.5) out.push(e.tagName + "." + e.className + " " + Math.round(q.right - tb.right));
    }
  }
  return out;`;

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];

  // --- Handy: zwei Kacheln nebeneinander, Puls als Zeile ------------------------------------
  for (const ph of PHONES) {
    for (const state of ["aus", "ok"]) {
      const tag = `${lang}/${ph.name}/${state === "aus" ? "mit Ausfällen" : "alles online"}`;
      const s = await open(lang, { mobile: true, width: ph.width, height: ph.height });
      if (state === "ok") await s.allOnline();
      const ring = await s.rect(".hero .kt.ring"), offl = await s.rect(".hero .kt.offl"), pul = await s.rect(".hero .kt.pul");
      const side = ring && offl && Math.abs(ring.y - offl.y) <= 1 && ring.r <= offl.x && Math.abs(ring.w - offl.w) <= 1;
      const half = (ph.width - 24 - 8) / 2;
      check(`[${tag}] zwei Kacheln nebeneinander, je die halbe Breite (${half} px)`, side && Math.abs(ring.w - half) <= 1.5, JSON.stringify({ ring, offl }));
      check(`[${tag}] gleich hoch`, Math.abs(ring.h - offl.h) <= 1, `${ring.h} / ${offl.h}`);
      check(`[${tag}] Puls: volle Breite, schlanke Zeile unter den zwei Kacheln`,
        pul && Math.abs(pul.w - (ph.width - 24)) <= 1 && pul.y >= Math.max(ring.b, offl.b) && pul.h <= 80 && pul.h >= 40, JSON.stringify(pul));
      const hero = await s.ev(`const h=r.querySelector(".hero"); return [h.scrollWidth, h.clientWidth, getComputedStyle(h).display]`);
      check(`[${tag}] kein seitliches Wischen`, hero[0] <= hero[1] + 1 && hero[2] === "grid", JSON.stringify(hero));
      const out = await s.ev(OVERFLOW);
      check(`[${tag}] nichts ragt aus den Kacheln`, out.length === 0, out.join(" | "));
      const pageOver = await s.ev(`const c=r.querySelector(".content"); return c.scrollWidth - c.clientWidth`);
      check(`[${tag}] Seite ohne seitlichen Überlauf`, pageOver <= 1, String(pageOver));

      // Verfügbarkeit: Ring nur mit Zahl, Prozentwert daneben, Durchschnitt und Zeilen darunter
      const ringBox = await s.rect(".ringwrap"), pct = await s.rect(".kt.ring .pct"), avg = await s.rect(".kt.ring .pavg"), lines = await s.rect(".kt.ring .lines");
      check(`[${tag}] Ring ${ringBox.w} px, Prozentwert daneben, Durchschnitt und Zeilen darunter`,
        Math.round(ringBox.w) === 62 && pct.x >= ringBox.r && Math.abs((pct.y + pct.h / 2) - (ringBox.y + ringBox.h / 2)) <= 12 && avg.y >= ringBox.b - 1 && lines.y >= avg.b - 1,
        JSON.stringify({ ringBox, pct, avg, lines }));
      check(`[${tag}] "von N online" im Ring entfällt (nur die Zahl)`, !(await s.shown(".ringwrap .c span")) && /^\d+$/.test(await s.vis(".ringwrap .c b")));
      check(`[${tag}] Durchschnitt 24 Std. bleibt`, (await s.vis(".kt.ring .pavg")).startsWith(T.avg), await s.vis(".kt.ring .pavg"));

      // Gerade ausgefallen
      const warn = await s.vis(".kt.offl .kwarn");
      check(`[${tag}] kurze Warnzeile`, T.warnShort.test(warn) && !(await s.shown(".kwarn .w-long")), warn);
      const warnBox = await s.rect(".kt.offl .kwarn");
      check(`[${tag}] Warnzeile in einer Zeile, unten in der Kachel`, warnBox.h <= 40 && Math.abs(warnBox.b - (offl.b - 1)) <= 2, JSON.stringify({ warnBox, bottom: offl.b }));
      if (state === "aus") {
        const rows = await s.ev(`return [...r.querySelectorAll(".kt.offl .olist button")].filter(x=>getComputedStyle(x).display !== "none").length`);
        check(`[${tag}] zwei Geräte in der Liste, "${T.more2}"`, rows === 2 && (await s.vis(".kt.offl .olist .more-short")) === T.more2 && !(await s.shown(".kt.offl .olist .more-long")), `${rows} / ${await s.vis(".kt.offl .olist .more-short")}`);
        const num = await s.vis(".kt.offl .top .num");
        check(`[${tag}] Zahl der Ausfälle`, num === "4", num);
        // Sammelausfall: nur die Titelzeile in der schlanken Zeile
        const inc = await s.vis(".kt.pul .inc");
        check(`[${tag}] Puls: nur die Titelzeile des Sammelausfalls`, T.incTitle.test(inc), inc);
        const incBox = await s.rect(".kt.pul .inc");
        check(`[${tag}] Titelzeile in einer Zeile`, incBox.h <= 20, JSON.stringify(incBox));
      } else {
        check(`[${tag}] "${T.allOnline}", der Satz darunter entfällt`, (await s.vis(".kt.offl .top")).includes(T.allOnline) && !(await s.shown(".kt.offl .durs")), await s.vis(".kt.offl .top"));
        const pn = await s.vis(".kt.pul .pnote, .kt.pul .inc");
        check(`[${tag}] Puls-Zeile mit Hinweis`, !!pn, String(pn));
      }
      check(`[${tag}] Ticks der Zeitachse im Puls weg`, !(await s.shown(".kt.pul .pticks")));
      const chart = await s.rect(".kt.pul .pchart");
      check(`[${tag}] Kurve rechts in der Zeile`, chart.h >= 30 && chart.h <= 44 && chart.w >= 100 && chart.r <= pul.r - 8, JSON.stringify(chart));

      if (ph.width === 402) await s.p.screenshot({ path: `${outDir}/hero-mobile-${lang}-${state}.png` });

      // Tipp auf die schlanke Zeile öffnet das Fenster; dort steht der volle Text des Sammelausfalls
      if (state === "aus") {
        await s.tap(".hero .kt.pul");
        check(`[${tag}] Tipp auf die Zeile öffnet das Puls-Fenster`, await s.wait(`return r.querySelector("dialog.pulse-dlg")?.open && !!r.querySelector("dialog.pulse-dlg .plist")`));
        const full = await s.vis("dialog.pulse-dlg .pwin .inc");
        check(`[${tag}] Fenster: Sammelausfall mit vollem Text`, !!full && T.incTitle.test((await s.ev(`return r.querySelector("dialog.pulse-dlg .pwin .inc b").textContent`))) && T.incText.test(full), String(full));
        await s.tap("dialog.pulse-dlg [data-pulse-close]");
        await s.wait(`return !r.querySelector("dialog.pulse-dlg").open`);
        // Tipp auf die Warnzeile setzt weiter den Filter (wie vorher)
        await s.tap(".kt.offl .kwarn");
        check(`[${tag}] Tipp auf die Warnzeile setzt den Filter "Warnungen"`, await s.wait(`return !!r.querySelector(".chip.on[data-problems]")`));
      }
      check(`[${tag}] kein fehlender Text`, !(await s.ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
      check(`[${tag}] keine JS-Fehler`, s.errors.length === 0, s.errors.join("; "));
      await s.ctx.close();
    }
  }

  // --- Ab 601 px unverändert; 600 px ist noch Handy ------------------------------------------
  for (const [name, width, height, compact] of [["Desktop", 1400, 900, false], ["Tablet", 800, 1000, false], ["601 px", 601, 900, false], ["600 px", 600, 900, true]]) {
    const tag = `${lang}/${name}`;
    const s = await open(lang, { mobile: false, width, height });
    const rows = await s.ev(`return [...r.querySelectorAll(".kt.offl .olist button")].filter(x=>getComputedStyle(x).display !== "none").length`);
    check(`[${tag}] ${compact ? "zwei" : "vier"} Geräte in der Liste`, rows === (compact ? 2 : 4), String(rows));
    const warn = await s.vis(".kt.offl .kwarn");
    check(`[${tag}] ${compact ? "kurze" : "lange"} Warnzeile`, (compact ? T.warnShort : T.warnLong).test(warn), warn);
    check(`[${tag}] "von N online" im Ring ${compact ? "weg" : "sichtbar"}`, (await s.shown(".ringwrap .c span")) === !compact);
    const pticks = await s.shown(".kt.pul .pticks");
    check(`[${tag}] Zeitachse im Puls ${compact ? "weg" : "sichtbar"}`, pticks === !compact);
    if (!compact) {
      const inc = await s.vis(".kt.pul .inc");
      check(`[${tag}] Sammelausfall mit vollem Text in der Kachel`, T.incTitle.test(await s.ev(`return r.querySelector(".kt.pul .inc b").textContent`)) && T.incText.test(inc), inc);
      const ring = await s.rect(".ringwrap");
      check(`[${tag}] Ring ${Math.round(ring.w)} px (108 px)`, Math.round(ring.w) === 108, JSON.stringify(ring));
      const chart = await s.rect(".kt.pul .pchart");
      check(`[${tag}] Kurve hoch (${Math.round(chart.h)} px)`, chart.h >= 60, JSON.stringify(chart));
      const rects = await Promise.all([".hero .kt.ring", ".hero .kt.offl", ".hero .kt.pul"].map((q) => s.rect(q)));
      if (width >= 1100) check(`[${tag}] drei Kacheln in einer Zeile`, rects.every((r) => Math.abs(r.y - rects[0].y) <= 1), JSON.stringify(rects.map((r) => Math.round(r.y))));
      else check(`[${tag}] zwei Kacheln, Puls darunter über die ganze Breite`, Math.abs(rects[0].y - rects[1].y) <= 1 && rects[2].y >= rects[0].b && rects[2].w >= rects[0].w + rects[1].w, JSON.stringify(rects.map((r) => Math.round(r.y))));
    }
    check(`[${tag}] keine JS-Fehler`, s.errors.length === 0, s.errors.join("; "));
    await s.ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
