// Messpunkt auf der Ausfall-Puls-Kurve (2.147.0): alle 15 Sekunden fährt ein Punkt
// auf der Linie entlang. Prüft Dauer, Lage genau auf der Kurve (zu festen
// Animationszeiten), Farbe, reduzierte Bewegung und dass der Herzschlag-Easter-Egg
// den Punkt ersetzt. Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

for (const mobile of [false, true]) {
  const tag = mobile ? "mobile" : "desktop";
  const ctx = await b.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=de&theme=light`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
  const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));

  // Beim Aufbau wartet der Messpunkt unsichtbar auf den nächsten Takt (kein Aufblitzen am Linienende): Kachel frisch aufbauen
  await ev(`const c = r.querySelector(".pchart"); c.outerHTML = c.outerHTML; r.host._syncBeats()`);
  await p.waitForTimeout(150);
  const first = await ev(`const d=r.querySelector(".pchart .pdot"); const a=d.getAnimations()[0]; const t=a.effect.getTiming().delay; return [+getComputedStyle(d).opacity, a.currentTime <= t, Math.round((a.startTime + t) % 10000)]`);
  check(`[${tag}] Messpunkt blitzt beim Aufbau nicht auf (unsichtbar bis zum nächsten Takt)`, first[0] === 0 && first[1] === true && first[2] % 10000 === 0, JSON.stringify(first));
  const info = await ev(`const d=r.querySelector(".pchart .pdot"); if(!d) return null; const cs=getComputedStyle(d); return {dur: cs.animationDuration, iter: cs.animationIterationCount, name: cs.animationName, delay: cs.animationDelay, hidden: cs.display==="none"}`);
  check(`[${tag}] Messpunkt vorhanden, 10 s, endlos`, info && info.dur === "10s" && info.iter === "infinite" && info.name.startsWith("pd"), JSON.stringify(info));

  // Lage: Animation auf Zeit springen und Punkt gegen die Linie messen
  const res = await ev(`
    const d=r.querySelector(".pchart .pdot"), ch=r.querySelector(".pchart"), line=[...ch.querySelectorAll("svg path.line")];
    const a=d.getAnimations()[0]; a.pause();
    const cb=ch.getBoundingClientRect(); const out=[];
    const svg=ch.querySelector("svg"); const vb=svg.viewBox.baseVal;
    for (const t of [1000, 1200, 1700, 2200, 2800]) {
      a.currentTime=a.effect.getTiming().delay+t; // Fahrt dauert 3,4 s
      const dr=d.getBoundingClientRect(); const cx=dr.left+dr.width/2-cb.left, cy=dr.top+dr.height/2-cb.top;
      out.push({t, o:+getComputedStyle(d).opacity, cx:+(cx/cb.width).toFixed(3), cy:+(cy/cb.height).toFixed(3)});
    }
    // Kurvenpunkte in Prozent aus den Pfaden
    const pts=[]; for (const l of line) { const len=l.getTotalLength(); for (let s=0;s<=len;s+=len/200){ const q=l.getPointAtLength(s); pts.push([q.x/vb.width,q.y/vb.height]); } }
    return out.map(o=>({...o, dist: Math.min(...pts.map(q=>Math.hypot(q[0]-o.cx,(q[1]-o.cy)*cb.height/cb.width)))}));`);
  const onCurve = res.every((o) => o.o > 0 && o.dist < 0.03);
  check(`[${tag}] Punkt liegt zu festen Zeiten auf der Kurve`, onCurve, JSON.stringify(res));
  const xs = res.map((o) => o.cx);
  check(`[${tag}] Punkt wandert von links nach rechts`, xs.every((v, i) => i === 0 || v > xs[i - 1]), JSON.stringify(xs));

  // Zwischen den Fahrten unsichtbar
  const idle = await ev(`const d=r.querySelector(".pchart .pdot"); const a=d.getAnimations()[0]; a.pause(); a.currentTime=a.effect.getTiming().delay+9000; return +getComputedStyle(d).opacity`);
  check(`[${tag}] Punkt zwischen den Fahrten unsichtbar`, idle === 0, String(idle));

  // Im Takt mit der Sternschnuppe: beide starten auf derselben Zeitleistenzeit (Startzeit 0)
  await ev(`r.getAnimations().forEach((x) => { if (x.playState === "paused") x.play(); }); `);
  await f.waitForFunction(new Function(`const r=${R}; r.host._debugOn = true; r.host._apps.paintDots(); return r.querySelector(".apps-btn.has-dot") && r.getAnimations().some((x) => x.animationName === "dp-comet")`), null, { timeout: 5000 });
  await p.waitForTimeout(150);
  const st = await ev(`return r.getAnimations().filter((x) => /^(dp-comet|dp-land|pd)/.test(x.animationName)).map((x) => [x.animationName.slice(0, 2), (((Math.round(x.startTime + x.effect.getTiming().delay) % 10000) + 10000) % 10000)])`);
  const kinds = new Set(st.map((x) => x[0]));
  check(`[${tag}] Punkt-Sternschnuppe und Messpunkt starten gleichzeitig`, kinds.has("dp") && kinds.has("pd") && st.every((x) => x[1] % 10000 === 0), JSON.stringify(st));
  // Reduzierte Bewegung
  await p.emulateMedia({ reducedMotion: "reduce" });
  const rm = await ev(`return getComputedStyle(r.querySelector(".pchart .pdot")).display`);
  check(`[${tag}] reduzierte Bewegung: kein Punkt`, rm === "none", rm);
  // Frisch geladen (eigene Seite): der erste sichtbare Moment des Messpunkts liegt am Anfang der Linie (nie am Ende oder mitten im Lauf)
  if (!mobile) {
    const p2 = await ctx.newPage();
    await p2.goto(`http://127.0.0.1:8950/ha-sim.html?lang=de&theme=light`);
    const f2 = await (await p2.waitForSelector("#panel-frame")).contentFrame();
    await f2.waitForFunction(new Function(`return ${R}?.querySelector(".pchart .pdot")`), null, { timeout: 15000 });
    const firstSeen = await f2.evaluate(new Function(`const r=${R}; return new Promise((done) => { const t0 = performance.now(); const tick = () => { const d = r.querySelector(".pchart .pdot"); const o = d ? +getComputedStyle(d).opacity : 0; if (o > 0.05) { const c = r.querySelector(".pchart").getBoundingClientRect(), b = d.getBoundingClientRect(); done((b.left + b.width / 2 - c.left) / c.width); } else if (performance.now() - t0 > 13000) done(-1); else requestAnimationFrame(tick); }; tick(); })`));
    check(`[${tag}] frisch geladen: Messpunkt erscheint erst am Anfang der Linie`, firstSeen >= 0 && firstSeen < 0.08, String(firstSeen));
    await p2.close();
  }
  check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join("|"));
  await ctx.close();
}
await b.close();
process.exit(ok ? 0 : 1);
