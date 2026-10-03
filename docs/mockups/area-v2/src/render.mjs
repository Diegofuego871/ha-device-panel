// Mockups "Bereiche" v2 (Wunsch des Nutzers, 2026-10-03): Bereiche
// sortieren und gewählte Bereiche separat einblenden. Baut auf area-v1 A
// (Chip "Bereich" mit Auswahl) auf und ergänzt die Gruppierung nach Bereich.
// A: "Gruppen | Bereiche | Liste"; Reihenfolge per Griff im Chip "Bereich"
//    (pro Benutzer), Start mit der Reihenfolge aus Home Assistant.
// B: Reihenfolge und Auswahl im Popover "Spalten" bzw. Blatt "Ansicht".
// C: Reihenfolge nur aus Home Assistant (Einstellungen → Bereiche), im
//    Panel nur die Auswahl.
// Im echten Panel (Nachbau aus tests/panel, erfundene Daten und Etagen).
// Aufruf: CHROMIUM_PATH=... node docs/mockups/area-v2/src/render.mjs
import { setup, svg } from "../../_lib/mock.mjs";

const { page, shot, compose, close } = await setup(8965, import.meta.url);

// Etagen und Bereiche (erfunden), Reihenfolge wie in HA gesetzt.
const FLOORS = [
  ["Erdgeschoss", ["Küche", "Wohnzimmer", "Flur", "Eingang"]],
  ["Obergeschoss", ["Bad", "Büro", "Kinderzimmer"]],
  ["Untergeschoss", ["Keller"]],
  ["Aussen", ["Terrasse"]],
];
const ORDER = FLOORS.flatMap(([, a]) => a);
const PICKED = new Set(["Küche", "Wohnzimmer", "Flur", "Eingang", "Keller"]);

const CSS = `
.chip.mk-on { background: var(--dp-primary-soft); border-color: transparent; color: var(--dp-primary); }
.chip.mk-on svg { color: var(--dp-primary); }
.mk-x { display: inline-grid; place-items: center; width: 18px; height: 18px; margin-right: -4px; border-radius: 50%; background: color-mix(in srgb, var(--dp-primary) 18%, transparent); }
.mk-pop { position: fixed; z-index: 50; width: 340px; max-height: 600px; overflow: auto; padding: 12px 8px 10px; border: 1px solid var(--dp-divider);
  border-radius: 18px; background: var(--dp-card); color: var(--dp-text); box-shadow: 0 12px 34px rgba(0,0,0,.22); }
.mk-pop h4, .mk-sheet h4 { margin: 0 10px 2px; font-size: 15px; font-weight: 600; }
.mk-sub { margin: 0 10px 8px; color: var(--dp-text2); font-size: 12px; line-height: 1.4; }
.mk-floor { display: flex; align-items: center; gap: 10px; min-height: 32px; padding: 6px 10px 2px; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--dp-text2); }
.mk-floor .l { flex: 1; }
.mk-area { display: flex; align-items: center; gap: 10px; min-height: 36px; padding: 0 6px 0 22px; font-size: 14px; border-radius: 10px; background: var(--dp-card); }
.mk-area .l { flex: 1; }
.mk-area .n { color: var(--dp-text3); font-size: 12px; min-width: 14px; text-align: right; }
.mk-area .h { display: flex; color: var(--dp-text3); }
.mk-area.lift { position: relative; z-index: 2; box-shadow: 0 4px 16px rgba(0,0,0,.22); }
.mk-ck { width: 18px; height: 18px; border-radius: 5px; border: 2px solid var(--dp-text3); display: grid; place-items: center; flex: none; }
.mk-ck.on { border-color: var(--dp-primary); background: var(--dp-primary); }
.mk-ck.part { border-color: var(--dp-primary); background: linear-gradient(var(--dp-primary), var(--dp-primary)) center/8px 2px no-repeat; }
.mk-ck.on::after { content: ""; width: 9px; height: 5px; border: 2px solid #fff; border-top: 0; border-right: 0; transform: rotate(-45deg) translate(1px,-1px); }
.mk-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding: 8px 10px 0; border-top: 1px solid var(--dp-divider); font-size: 12px; color: var(--dp-text2); }
.mk-foot b { color: var(--dp-primary); font-weight: 500; }
.mk-hanote { margin: 6px 10px 2px; padding: 8px 10px; border-radius: 10px; background: var(--dp-subtle); font-size: 12px; color: var(--dp-text2); line-height: 1.4; }
.mk-hanote b { color: var(--dp-primary); font-weight: 500; }
.mk-sec { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--dp-divider); }
.gl small.mk-bad, .gh .mk-bad { color: var(--dp-error); font-weight: 500; margin-left: 6px; }
`;

const ck = (state) => `<span class="mk-ck ${state}"></span>`;
// Liste der Bereiche nach Etage: Haken (Auswahl), Zahl, Griff (Reihenfolge).
function listHtml(counts, { handles = true, lift = "Flur" } = {}) {
  return FLOORS.map(([floor, areas]) => {
    const n = areas.filter((a) => PICKED.has(a)).length;
    const state = n === areas.length ? "on" : n ? "part" : "";
    return `<div class="mk-floor">${ck(state)}<span class="l">${floor}</span></div>` +
      areas.map((a) => `<div class="mk-area${handles && a === lift ? " lift" : ""}">${ck(PICKED.has(a) ? "on" : "")}<span class="l">${a}</span><span class="n">${counts[a] || 0}</span>${handles ? `<span class="h">${svg("dragH", 20)}</span>` : ""}</div>`).join("");
  }).join("");
}

// Liste nach Bereich gruppiert: Gruppen in der Reihenfolge, nur die
// gewählten Bereiche, darin Ausfälle zuerst.
const GROUPS = `
  const order = arg.order, picked = new Set(arg.picked);
  r.host._groups = (rows) => order.filter((a) => picked.has(a)).map((a) => {
    const list = rows.filter((d) => d.area === a).sort((x, y) => (x.online === false) - (y.online === false) ? (y.online === false) - (x.online === false) : x.name.localeCompare(y.name));
    const off = list.filter((d) => d.online === false).length;
    return ["", a, off ? off + " ausgefallen" : "", list];
  }).filter((g) => g[3].length);
  r.host._render();
  r.host._render = () => {};
  // Segment mit "Bereiche"
  const seg = r.querySelector("[data-flat]")?.parentElement;
  if (seg) { for (const b of seg.querySelectorAll("button")) b.classList.remove("on"); seg.querySelector('[data-flat="0"]').insertAdjacentHTML("afterend", '<button type="button" class="on">Bereiche</button>'); }
  // Ausgefallene in der Gruppenzeile rot
  for (const s of r.querySelectorAll("tr.grp .gl small")) s.classList.add("mk-bad");
`;

async function base(mobile) {
  const pg = await page(mobile, { css: CSS });
  const counts = await pg.ev(`const c = {}; for (const d of r.host._devices) if (d.area) c[d.area] = (c[d.area] || 0) + 1; return c;`);
  return { ...pg, counts };
}

async function variantA(mobile) {
  const { ctx, p, ev, counts } = await base(mobile);
  await ev(GROUPS, { order: ORDER, picked: [...PICKED] });
  const chip = `<button type="button" class="chip mk-on">${svg("home", 15)}<span>5 Bereiche</span><span class="mk-x">${svg("close", 12)}</span></button>`;
  await ev(`r.querySelector(".chips [data-problems]").insertAdjacentHTML("beforebegin", arg);`, chip);
  const body = listHtml(counts);
  if (!mobile) {
    await ev(`const c=r.querySelector(".chip.mk-on").getBoundingClientRect(); r.querySelector(".toolbar").insertAdjacentHTML("beforeend", '<div class="mk-pop" style="top:' + (c.bottom + 8) + 'px;left:' + Math.max(8, c.left - 120) + 'px"><h4>Bereiche</h4><div class="mk-sub">Haken: nur diese zeigen. Griff: Reihenfolge der Gruppen "Bereiche". Für dich gespeichert; zuerst wie in Home Assistant.</div>' + arg + '<div class="mk-foot"><span>5 von 9 Bereichen</span><b>Alle zeigen</b></div></div>')`, body);
    const file = await shot(p, mobile, "A-desktop");
    await ctx.close();
    return [file];
  }
  await ev(`r.querySelector(".content").scrollTop = r.querySelector(".chips").offsetTop - 80; const ch=r.querySelector(".chips"); ch.scrollLeft = r.querySelector(".chip.mk-on").offsetLeft - 160;`);
  const list = await shot(p, mobile, "A-mobile-list");
  await ev(`const d=r.querySelector("dialog.stat-dlg"); d.innerHTML='<div class="dlg-head"><span class="dlg-avatar">' + arg.icon + '</span><div class="dlg-title"><h2>Bereiche</h2><div class="dlg-sub">Für dich gespeichert · Handy und Desktop getrennt</div></div></div><div class="dlg-body" style="padding-top:0"><div class="mk-sub" style="margin:0 0 8px">Haken: nur diese zeigen. Griff: Reihenfolge der Gruppen.</div>' + arg.body + '</div><div class="dlg-actions"><button class="dlg-btn">Alle zeigen</button><button class="dlg-btn primary">Fertig</button></div>'; d.showModal(); r.activeElement?.blur();`, { icon: svg("home", 28), body });
  const sheet = await shot(p, mobile, "A-mobile-sheet");
  await ctx.close();
  return [list, sheet];
}

async function variantB(mobile) {
  const { ctx, p, ev, counts } = await base(mobile);
  await ev(GROUPS, { order: ORDER, picked: [...PICKED] });
  const sec = `<div class="mk-sec"><h4>Bereiche</h4><div class="mk-sub">Haken: nur diese zeigen. Griff: Reihenfolge der Gruppen.</div>${listHtml(counts)}</div>`;
  await ev(`r.querySelector(".view-btn").click()`);
  await p.waitForTimeout(300);
  if (!mobile) {
    await ev(`r.host._renderCols = () => {}; const pop=r.querySelector(".cols-pop"); pop.querySelector(".vfoot").insertAdjacentHTML("afterend", arg); pop.style.maxHeight = "680px"; pop.scrollTop = 360;`, sec);
  } else {
    await ev(`r.host._renderViewSheet = () => {}; const d=r.querySelector("dialog.view"); d.querySelector(".dlg-body").insertAdjacentHTML("afterbegin", arg.replace('mk-sec','mk-sec" style="border-top:0;margin-top:0')); d.scrollTop = 0; r.activeElement?.blur();`, sec.replace("<h4>Bereiche</h4>", "<h3>Bereiche</h3>"));
  }
  const file = await shot(p, mobile, `B-${mobile ? "mobile" : "desktop"}`);
  await ctx.close();
  return file;
}

async function variantC(mobile) {
  const { ctx, p, ev, counts } = await base(mobile);
  await ev(GROUPS, { order: ORDER, picked: [...PICKED] });
  const chip = `<button type="button" class="chip mk-on">${svg("home", 15)}<span>5 Bereiche</span><span class="mk-x">${svg("close", 12)}</span></button>`;
  await ev(`r.querySelector(".chips [data-problems]").insertAdjacentHTML("beforebegin", arg);`, chip);
  const note = `<div class="mk-hanote">Reihenfolge wie in Home Assistant (Einstellungen → Bereiche, Etagen und Zonen). <b>In HA sortieren</b></div>`;
  const body = listHtml(counts, { handles: false });
  if (!mobile) {
    await ev(`const c=r.querySelector(".chip.mk-on").getBoundingClientRect(); r.querySelector(".toolbar").insertAdjacentHTML("beforeend", '<div class="mk-pop" style="top:' + (c.bottom + 8) + 'px;left:' + Math.max(8, c.left - 120) + 'px"><h4>Bereiche</h4><div class="mk-sub">Haken: nur diese zeigen. Für dich gespeichert.</div>' + arg.body + arg.note + '<div class="mk-foot"><span>5 von 9 Bereichen</span><b>Alle zeigen</b></div></div>')`, { body, note });
  } else {
    await ev(`const d=r.querySelector("dialog.stat-dlg"); d.innerHTML='<div class="dlg-head"><span class="dlg-avatar">' + arg.icon + '</span><div class="dlg-title"><h2>Bereiche</h2><div class="dlg-sub">Für dich gespeichert · Handy und Desktop getrennt</div></div></div><div class="dlg-body" style="padding-top:0">' + arg.body + arg.note + '</div><div class="dlg-actions"><button class="dlg-btn">Alle zeigen</button><button class="dlg-btn primary">Fertig</button></div>'; d.showModal(); r.activeElement?.blur();`, { icon: svg("home", 28), body, note });
  }
  const file = await shot(p, mobile, `C-${mobile ? "mobile" : "desktop"}`);
  await ctx.close();
  return file;
}

const [aD] = await variantA(false);
const [aML, aMS] = await variantA(true);
await compose("1-A-gruppen-und-chip.png", [
  [aD, "A (Empfehlung): \"Gruppen | Bereiche | Liste\"; Chip \"Bereich\" wählt Bereiche (Haken) und ordnet sie (Griff)", 900],
  [aML, "A auf dem Handy: nach Bereich gruppiert", 300],
  [aMS, "A: Blatt \"Bereiche\"", 300],
]);
const bD = await variantB(false);
const bM = await variantB(true);
await compose("2-B-in-ansicht.png", [[bD, "B: Auswahl und Reihenfolge im Popover \"Spalten\"", 900], [bM, "B: im Blatt \"Ansicht\" (Handy)", 360]]);
const cD = await variantC(false);
const cM = await variantC(true);
await compose("3-C-reihenfolge-aus-ha.png", [[cD, "C: Reihenfolge nur aus Home Assistant, im Panel nur die Auswahl", 900], [cM, "C auf dem Handy", 360]]);
await close();
console.log("fertig");
