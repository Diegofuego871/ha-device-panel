// Mockups magic-push-dialog-v1 (Wunsch des Nutzers, 2026-10-11): der Assistent für Magic Push bekommt ein eigenes Fenster
// im Geräte-Popup, damit er mehr Platz hat. Der Inhalt ist der echte Assistent aus dem Nachbau (erfundene Daten), nur die
// Hülle ist neu:
//   Ist: Assistent im Reiter des Geräte-Popups (Kopf und Reiterleiste bleiben stehen)
//   A: Vollbild-Fenster, feste Kopfleiste mit Schrittanzeige, feste Fusszeile mit Zurück/Weiter  <- Empfehlung Handy
//   B: Blatt von unten (fast volle Höhe), Rand des Geräte-Popups bleibt sichtbar
//   C: Desktop: breites Fenster, Formular links, Vorschau und Rückblick rechts  <- Empfehlung Desktop
// Aufruf: CHROMIUM_PATH=... node docs/mockups/magic-push-dialog-v1/src/render.mjs
import { setup } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8989, import.meta.url);

const CSS = `
.mgd { position: fixed; inset: 0; width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; background: transparent; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; color: var(--dp-text); }
.mgd::backdrop { background: rgba(0,0,0,.5); }
.mgd.kbdonly::backdrop { background: transparent; }
.mgd-win { position: relative; display: flex; flex-direction: column; min-height: 0; background: var(--dp-card); color: var(--dp-text); overflow: hidden; }
.mgd-win.full { height: 100%; border-radius: 0; }
.mgd-win.sheet { height: calc(100% - 44px); border-radius: 22px 22px 0 0; box-shadow: 0 -6px 30px rgba(0,0,0,.35); }
.mgd-win.wide { width: 920px; height: 640px; margin: auto; border-radius: 22px; box-shadow: var(--dp-shadow); }
.mgd.center { justify-content: center; align-items: center; }
.mgd-grab { flex: none; width: 38px; height: 5px; margin: 8px auto 0; border-radius: 3px; background: color-mix(in srgb, var(--dp-text) 28%, transparent); }
.mgd-head { flex: none; display: flex; align-items: center; gap: 10px; padding: 14px 12px 8px 16px; }
.mgd-head .t { flex: 1; min-width: 0; }
.mgd-head .t b { display: block; font-size: 17px; font-weight: 500; }
.mgd-head .t small { display: block; margin-top: 1px; color: var(--dp-text2); font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mgd-x { flex: none; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; background: color-mix(in srgb, var(--dp-text) 8%, var(--dp-card)); font-size: 20px; line-height: 1; }
.mgd-prog { flex: none; padding: 0 16px 6px; }
.mgd-prog .mg-stephead { margin-top: 0; }
.mgd-prog .mg-steps { margin: 4px 0 4px; }
.mgd-body { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 2px 16px 12px; }
.mgd-foot { flex: none; padding: 10px 16px calc(14px + env(safe-area-inset-bottom)); border-top: 1px solid var(--dp-divider); background: var(--dp-card); }
.mgd-foot .mg-btns { margin-top: 0; }
.mgd-back { position: absolute; inset: 0; }
.mgd :focus, .mgd :focus-visible { outline: none; }
.mgd-cols .mgd-body .mg-card:has(svg.mg-spark), .mgd-cols .mgd-body .mg-hist { display: none; }
.kbd { position: absolute; left: 0; right: 0; bottom: 0; height: 336px; z-index: 60; background: #cfd3da; border-radius: 12px 12px 0 0; display: grid; place-items: center; color: #555; font-size: 15px; }
.kbd i { font-style: normal; opacity: .8; }
.hint-line { position: absolute; left: 0; right: 0; z-index: 61; border-top: 2px dashed #e5484d; color: #e5484d; font-size: 11px; font-weight: 600; padding: 2px 6px; text-align: right; background: linear-gradient(#e5484d22, transparent); }
.mgd-cols { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 320px; }
.mgd-cols .mgd-body { padding: 4px 22px 14px; }
.mgd-side { overflow: auto; padding: 12px 18px; border-left: 1px solid var(--dp-divider); background: color-mix(in srgb, var(--dp-text) 3%, var(--dp-card)); }
.mgd-side h4 { margin: 4px 0 8px; color: var(--dp-text2); font-size: 12px; font-weight: 500; }
.mgd-side .mg-hist { margin-top: 10px; }
`;

// Teile des echten Assistenten aus dem Nachbau holen (Kopf, Schritte, Frage, Inhalt, Knöpfe)
const GRAB = `
  const root = r.querySelector(".mg-root");
  const kids = [...root.children];
  const pick = (sel) => kids.find((k) => k.matches(sel))?.outerHTML || "";
  const big = kids.find((k) => k.classList.contains("mg-big"));
  const btns = kids.find((k) => k.classList.contains("mg-btns"));
  const body = kids.slice(kids.indexOf(big) + 1, kids.indexOf(btns)).map((k) => k.outerHTML).join("");
  return { head: pick(".mg-stephead"), steps: pick(".mg-steps"), big: big.outerHTML, bigText: big.textContent.trim(), body, btns: btns.outerHTML,
    title: r.querySelector("dialog.device .dlg-title h2")?.textContent.trim() };
`;

async function openWizard(p, ev, tapSel, step) {
  const clickSel = async (sel) => ev(`r.querySelector(${JSON.stringify(sel)}).click()`);
  await ev(`r.querySelector('.dev[data-open="d"]').click()`);
  await p.waitForTimeout(700);
  await ev(`r.host._fetch = () => {}`);
  await clickSel('.sub-tab[data-tab="magic"]');
  await p.waitForTimeout(500);
  await clickSel('[data-mg="add"]');
  await p.waitForTimeout(400);
  if (step >= 2) { await clickSel('.mg-pick[data-id="sensor.temp"]'); await p.waitForTimeout(200); await clickSel('[data-mg="next"]'); await p.waitForTimeout(500); }
  if (step >= 2) {
    await ev(`const i=r.querySelector('input[data-mg="value"]'); i.value="12"; i.dispatchEvent(new Event("input",{bubbles:true}))`);
    await p.waitForTimeout(700);
  }
  if (step === 1.5) { await clickSel('[data-mg="free-open"]'); await p.waitForTimeout(500); }
}

// Hülle um den echten Inhalt
const shell = (kind, g, { keyboard = false, side = "" } = {}) => {
  const head = (small) => `<div class="mgd-head"><div class="t"><b>Neue Meldung</b><small>${small}</small></div><span class="mgd-x">×</span></div>`;
  const prog = `<div class="mgd-prog">${g.head}${g.steps}</div>`;
  const foot = `<div class="mgd-foot">${g.btns}</div>`;
  if (kind === "wide") {
    return `<dialog class="mgd center"><div class="mgd-win wide">${head(g.title)}${prog}
      <div class="mgd-cols"><div class="mgd-body">${g.big}${g.body}</div><div class="mgd-side">${side}</div></div>${foot}</div></dialog>`;
  }
  return `<dialog class="mgd"><div class="mgd-win ${kind}">${kind === "sheet" ? '<div class="mgd-grab"></div>' : ""}${head(g.title)}${prog}
    <div class="mgd-body">${g.big}${g.body}</div>${foot}</div>${keyboard ? '<div class="kbd"><i>Tastatur (336 px)</i></div>' : ""}</dialog>`;
};

async function build(mobile, step, kind, opts = {}) {
  const { ctx, p, ev } = await page(mobile, { css: CSS, width: 390, height: 844, freeze: false });
  await openWizard(p, ev, null, step);
  if (kind === "ist") {
    if (opts.keyboard) await ev(`const k=document.createElement("dialog"); k.className="mgd kbdonly"; k.style.pointerEvents="none"; k.innerHTML='<div class="kbd"><i>Tastatur (336 px)</i></div>'; r.appendChild(k); k.showModal(); k.style.setProperty("--x","0");`);
    return { ctx, p };
  }
  const g = await ev(GRAB);
  const side = opts.side ? await ev(`return (r.querySelector(".mg-root .mg-card:has(svg.mg-spark)")?.outerHTML || "") + (r.querySelector(".mg-root .mg-hist")?.outerHTML || "")`) : "";
  await ev(`const wrap = document.createElement("div"); wrap.innerHTML = arg; const d = wrap.firstElementChild; r.appendChild(d); d.showModal(); d.querySelector("button")?.blur(); d.querySelector(".mg-free")?.scrollIntoView({ block: "start" });`, shell(kind, g, { keyboard: opts.keyboard, side }));
  return { ctx, p };
}

const out = [];
async function one(name, mobile, step, kind, opts) {
  const { ctx, p } = await build(mobile, step, kind, opts);
  if (mobile) out.push(await shot(p, true, name));
  else { await p.waitForTimeout(300); await p.screenshot({ path: `${new URL("./out/", import.meta.url).pathname}${name}.png`, clip: { x: 220, y: 40, width: 960, height: 900 } }); }
  await ctx.close();
}

// Handy: Schritt 2 (viel Inhalt)
await one("m-ist-2", true, 2, "ist");
await one("m-a-2", true, 2, "full");
await one("m-b-2", true, 2, "sheet");
// Handy: Schritt 1 mit freier Entität und Tastatur (der Auslöser)
await one("m-ist-kbd", true, 1.5, "ist", { keyboard: true });
await one("m-a-kbd", true, 1.5, "full", { keyboard: true });
// Desktop
await one("d-ist-2", false, 2, "ist");
await one("d-c-2", false, 2, "wide", { side: true });

await compose("1-Handy-Schritt2.png", [
  ["m-ist-2", "Ist: im Reiter des Geräte-Popups. Kopf, Reiterleiste und Knöpfe scrollen mit", 300],
  ["m-a-2", "A: Vollbild, feste Kopfleiste und feste Fusszeile", 300],
  ["m-b-2", "B: Blatt von unten, Rand des Popups bleibt sichtbar", 300],
].map(([n, c, w]) => [`${new URL("../src/out/", import.meta.url).pathname}${n}.png`, c, w]));
await compose("2-Handy-Tastatur.png", [
  ["m-ist-kbd", "Ist: freie Entität, Tastatur offen. Wenig Platz über der Tastatur", 330],
  ["m-a-kbd", "A: gleiche Lage. Kopf ist schmal, Suchfeld und Liste haben die Höhe", 330],
].map(([n, c, w]) => [`${new URL("../src/out/", import.meta.url).pathname}${n}.png`, c, w]));
await compose("3-Desktop.png", [
  ["d-ist-2", "Ist: Assistent im Reiter, schmale Spalte", 600],
  ["d-c-2", "C: breites Fenster, Vorschau und Rückblick rechts", 600],
].map(([n, c, w]) => [`${new URL("../src/out/", import.meta.url).pathname}${n}.png`, c, w]));
await close();
console.log("fertig");
