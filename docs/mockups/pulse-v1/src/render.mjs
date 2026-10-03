// Mockups "Puls: welche Geräte?": Die Puls-Kachel nennt "4 Unterbrüche bei
// 4 Geräten", aber nicht welche (Wunsch des Nutzers, 2026-10-03).
// A: Tipp auf die Kachel öffnet ein Fenster mit Puls und Geräteliste.
// B: Kachel klappt auf und zeigt die Geräte darin.
// C: Tipp setzt einen Filter-Chip, die Liste zeigt nur diese Geräte.
// Im echten Panel (Nachbau aus tests/panel, erfundene Daten).
// Aufruf: CHROMIUM_PATH=... node docs/mockups/pulse-v1/src/render.mjs
import { setup, svg } from "../../_lib/mock.mjs";

const { page, shot, compose, close } = await setup(8962, import.meta.url);

const CSS = `
.pnote.mk-link { display: flex; align-items: center; gap: 2px; color: var(--dp-primary); font-weight: 500; cursor: pointer; }
.mk-sum { display: flex; gap: 14px; flex-wrap: wrap; margin: 2px 0 12px; font-size: 13px; color: var(--dp-text2); }
.mk-sum b { color: var(--dp-text); font-weight: 600; }
.mk-chart { padding: 12px 14px 8px; border-radius: 16px; background: var(--dp-subtle); }
.mk-chart .pchart { height: 86px; }
.mk-list { margin-top: 4px; }
.mk-row { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 10px 2px; border-top: 1px solid var(--dp-divider); }
.mk-row:first-child { border-top: 0; }
.mk-row .nm { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mk-row .sb { font-size: 12px; color: var(--dp-text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mk-row .rt { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.mk-row .cnt { color: var(--dp-error); font-weight: 600; font-size: 13px; white-space: nowrap; }
.mk-row .cnt small { color: var(--dp-text2); font-weight: 400; margin-left: 6px; }
.mk-row .chev { color: var(--dp-text3); display: flex; }
.mk-row.sel { background: var(--dp-primary-soft); border-radius: 12px; }
.mk-tag { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 999px; background: var(--dp-error-soft); color: var(--dp-error); font-size: 11px; font-weight: 500; }
.mk-inline { margin-top: 10px; border-top: 1px solid var(--dp-divider); }
.mk-inline .mk-row { padding: 7px 0; }
.mk-more { margin-top: 6px; font-size: 12.5px; color: var(--dp-primary); font-weight: 500; }
.chip.mk-on { background: var(--dp-primary-soft); border-color: transparent; color: var(--dp-primary); }
.mk-x { display: inline-grid; place-items: center; width: 18px; height: 18px; margin-right: -4px; border-radius: 50%; background: color-mix(in srgb, var(--dp-primary) 18%, transparent); }
.mk-hint { margin: 10px 0 0; font-size: 12px; color: var(--dp-text2); }
.mk-bucket { position: absolute; top: 0; bottom: 0; background: color-mix(in srgb, var(--dp-primary) 18%, transparent); border-left: 2px solid var(--dp-primary); border-right: 2px solid var(--dp-primary); }
`;

// Geräte mit Unterbrüchen in 24 Std., meiste zuerst; Zeilen aus den
// Bausteinen des Panels (Symbol, Streifen, Dauer).
const ROWS = `
  const list = r.host._devices.filter((d) => d.avail24?.outages).sort((a, b) => b.avail24.outages - a.avail24.outages || b.avail24.offline - a.avail24.offline);
  const row = (d, i) => '<div class="mk-row' + (arg?.sel && i === 1 ? ' sel' : '') + '">' + r.host._avatar(d) +
    '<div style="min-width:0"><div class="nm">' + d.name + (d.online === false ? '<span class="mk-tag">ausgefallen</span>' : '') + '</div><div class="sb">' + [d.area, r.host._integName(d)].filter(Boolean).join(" · ") + '</div></div>' +
    '<div class="rt"><span class="cnt">' + d.avail24.outages + '×<small>zusammen ' + r.host._fmtSeconds(d.avail24.offline) + '</small></span>' + r.host._availHtml(d) + '</div></div>';
`;

async function base(mobile) {
  const pg = await page(mobile, { css: CSS });
  // Ohne Sammelausfall: die Kachel zeigt die Zahl wie im Screenshot des Nutzers.
  await pg.ev(`r.host._incidents = []; r.host._render();`);
  return pg;
}

async function variantA(mobile) {
  const { ctx, p, ev } = await base(mobile);
  await ev(`const n=r.querySelector(".kt.pul .pnote"); n.classList.add("mk-link"); n.insertAdjacentHTML("beforeend", arg);`, svg("chevron", 16));
  if (mobile) await ev(`r.querySelector(".hero").scrollLeft = r.querySelector(".kt.pul").offsetLeft - 12;`);
  const card = await shot(p, mobile, `A-${mobile ? "mobile" : "desktop"}-card`);
  await ev(`r.host._render = () => {};
    ${ROWS}
    const chart = r.querySelector(".kt.pul .pchart").outerHTML + r.querySelector(".kt.pul .pticks").outerHTML;
    const total = list.reduce((a, d) => a + d.avail24.offline, 0);
    const outages = list.reduce((a, d) => a + d.avail24.outages, 0);
    const d = r.querySelector("dialog.stat-dlg");
    d.innerHTML = '<div class="dlg-head"><span class="dlg-avatar">' + arg.icon + '</span><div class="dlg-title"><h2>Unterbrüche in 24 Std.</h2><div class="dlg-sub">' + outages + ' Unterbrüche bei ' + list.length + ' Geräten · zusammen ' + r.host._fmtSeconds(total) + '</div></div><button type="button" class="dlg-close">' + arg.close + '</button></div>' +
      '<div class="dlg-body"><div class="mk-chart">' + chart + '</div><p class="mk-hint">Tipp auf einen Zeitpunkt im Puls zeigt nur die Geräte, die dann weg waren.</p>' +
      '<h3>Geräte · meiste Unterbrüche zuerst</h3><div class="mk-list">' + list.map(row).join("") + '</div></div>' +
      '<div class="dlg-actions"><button type="button" class="dlg-btn">Schliessen</button></div>';
    d.showModal(); r.activeElement?.blur();`, { icon: svg("pulse", 28), close: svg("close", 18) });
  const dlg = await shot(p, mobile, `A-${mobile ? "mobile" : "desktop"}`);
  await ctx.close();
  return [card, dlg];
}

async function variantB(mobile) {
  const { ctx, p, ev } = await base(mobile);
  await ev(`r.host._render = () => {};
    ${ROWS}
    const card = r.querySelector(".kt.pul");
    card.querySelector(".pnote").classList.add("mk-link");
    card.insertAdjacentHTML("beforeend", '<div class="mk-inline">' + list.slice(0, 4).map(row).join("") + '</div>' + (list.length > 4 ? '<div class="mk-more">' + (list.length - 4) + ' weitere · Weniger</div>' : '<div class="mk-more">Weniger</div>'));
    if (${mobile}) r.querySelector(".hero").scrollLeft = card.offsetLeft - 12;`);
  const file = await shot(p, mobile, `B-${mobile ? "mobile" : "desktop"}`);
  await ctx.close();
  return file;
}

async function variantC(mobile) {
  const { ctx, p, ev } = await base(mobile);
  // Kopf bleibt für alle Geräte; nur die Liste ist gefiltert.
  await ev(`const hero = r.querySelector(".hero").innerHTML;
    const keep = r.host._devices.filter((d) => d.avail24?.outages);
    r.host._devices = keep; r.host._render(); r.host._render = () => {};
    r.querySelector(".hero").innerHTML = hero;
    const chip = '<button type="button" class="chip mk-on">' + arg.pulse + '<span>Unterbrüche 24 Std.</span> <span class="n">' + keep.length + '</span><span class="mk-x">' + arg.close + '</span></button>';
    r.querySelector(".chips").insertAdjacentHTML("afterbegin", chip);
    const all = r.querySelector('.chips [data-conn="all"]'); if (all) all.classList.remove("on");
    if (${mobile}) r.querySelector(".content").scrollTop = r.querySelector(".chips").offsetTop - 80;`, { pulse: svg("pulse", 15), close: svg("close", 12) });
  const file = await shot(p, mobile, `C-${mobile ? "mobile" : "desktop"}`);
  await ctx.close();
  return file;
}

const [aCardD, aD] = await variantA(false);
const [aCardM, aM] = await variantA(true);
await compose("1-A-fenster.png", [
  [aD, "A (Empfehlung): Tipp auf die Kachel öffnet \"Unterbrüche in 24 Std.\": Puls gross, Geräte mit Zahl, Dauer und Streifen; Tipp auf ein Gerät öffnet es", 900],
  [aCardM, "A auf dem Handy: Zeile in der Kachel als Link", 300],
  [aM, "A: Fenster als Blatt", 300],
]);
const bD = await variantB(false);
const bM = await variantB(true);
await compose("2-B-aufklappen.png", [[bD, "B: Kachel klappt auf, die Geräte stehen darin (höchstens 4, dann \"weitere\")", 900], [bM, "B auf dem Handy", 360]]);
const cD = await variantC(false);
const cM = await variantC(true);
await compose("3-C-filter.png", [[cD, "C: Tipp setzt den Chip \"Unterbrüche 24 Std.\", die Liste zeigt nur diese Geräte", 900], [cM, "C auf dem Handy", 360]]);
await close();
console.log("fertig");
