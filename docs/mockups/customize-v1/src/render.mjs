// Mockups "Spalten wie HA 'Anpassen'" (Wunsch des Nutzers, 2026-10-03, mit
// Screenshot des HA-Dialogs): Auge zum Ein- und Ausblenden, Griff zum
// Sortieren, "Standard wiederherstellen" und "Fertig".
// A: eigener Dialog "Anpassen" wie in HA (Desktop mittig, Handy als Blatt).
// B: Popover unter "Spalten" bleibt, mit Augen und denselben Knöpfen.
// Im echten Panel (Nachbau aus tests/panel, erfundene Daten).
// Aufruf: CHROMIUM_PATH=... node docs/mockups/customize-v1/src/render.mjs
import { setup, svg } from "../../_lib/mock.mjs";

const { page, shot, compose, close } = await setup(8964, import.meta.url);

const CSS = `
dialog.stat-dlg.mk-cust { width: min(460px, calc(100vw - 32px)); }
.mk-clist { padding: 0 8px 4px; }
.mk-crow { display: flex; align-items: center; gap: 14px; min-height: 48px; padding: 0 4px 0 14px; border-radius: 10px; background: var(--dp-card); }
.mk-crow + .mk-crow { margin-top: 2px; }
.mk-crow .h { display: flex; color: var(--dp-text2); cursor: grab; }
.mk-crow .l { flex: 1; min-width: 0; font-size: 15px; }
.mk-crow .l small { margin-left: 8px; color: var(--dp-text3); font-size: 12px; }
.mk-crow .e { width: 40px; height: 40px; border: 0; border-radius: 50%; background: transparent; display: grid; place-items: center; color: var(--dp-text2); }
.mk-crow .e:hover { background: var(--dp-subtle); }
.mk-crow.off .l, .mk-crow.off .e { color: var(--dp-text3); }
.mk-crow.off .h, .mk-crow.fixed .h { visibility: hidden; }
.mk-crow.fixed .e { opacity: .35; }
.mk-crow.lift { position: relative; z-index: 2; box-shadow: 0 4px 16px rgba(0,0,0,.22); }
.mk-note { margin: 0 22px 10px; color: var(--dp-text2); font-size: 12.5px; }
.dlg-actions.mk-acts { display: flex; justify-content: space-between; gap: 10px; }
.dlg-actions.mk-acts .dlg-btn { flex: none; min-width: 120px; }
.dlg-actions.mk-acts .dlg-btn.mk-text { border-color: transparent; background: transparent; color: var(--dp-primary); padding: 0 6px; min-width: 0; }
.vrow .mk-eye { width: 36px; height: 36px; border: 0; border-radius: 50%; background: transparent; display: grid; place-items: center; color: var(--dp-text2); }
.vrow.off .mk-eye { color: var(--dp-text3); }
.vrow.off .drag-h { visibility: hidden; }
.mk-pfoot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; padding: 10px 6px 0; border-top: 1px solid var(--dp-divider); }
.mk-pfoot .dlg-btn { height: 34px; font-size: 13px; }
.mk-pfoot .mk-text { border-color: transparent; background: transparent; color: var(--dp-primary); padding: 0 4px; }
`;

// Zeilen des heutigen Popovers bzw. Blatts lesen: Schlüssel, Name, an/aus.
const READ = `[...r.querySelectorAll(arg + " .vrow")].map((v) => [v.dataset.key || "", v.querySelector(".vl").childNodes[0].textContent.trim(), !v.classList.contains("off"), v.classList.contains("fixed")])`;

function rowsHtml(rows, icons) {
  return rows
    .map(([key, label, on, fixed], i) =>
      `<div class="mk-crow${on ? "" : " off"}${fixed ? " fixed" : ""}${i === 3 ? " lift" : ""}"><span class="h">${icons.drag}</span><span class="l">${label}${fixed ? "<small>immer sichtbar</small>" : ""}</span><button type="button" class="e" aria-label="${label}">${on ? icons.eye : icons.eyeOff}</button></div>`)
    .join("");
}

const ICONS = { drag: svg("dragH", 22), eye: svg("eye", 22), eyeOff: svg("eyeOff", 22) };

async function variantA(mobile) {
  const { ctx, p, ev } = await page(mobile, { css: CSS });
  let rows;
  if (!mobile) {
    await ev(`r.host._toggleCols(true)`);
    rows = await ev(`return ${READ}`, ".cols-pop");
    // Zwei Spalten ausgeblendet, damit Auge zu sehen ist.
    rows = rows.map((x) => (["area", "hub"].includes(x[0]) ? [x[0], x[1], false, x[3]] : x));
    await ev(`r.host._toggleCols(false); r.host._render = () => {};
      const d = r.querySelector("dialog.stat-dlg"); d.classList.add("mk-cust");
      d.innerHTML = '<div class="dlg-head"><span class="dlg-avatar">' + arg.icon + '</span><div class="dlg-title"><h2>Anpassen</h2><div class="dlg-sub">Spalten der Liste · für dich gespeichert</div></div><button type="button" class="dlg-close">' + arg.close + '</button></div>' +
        '<p class="mk-note">Auge: ein- oder ausblenden. Griff: in eine andere Reihenfolge ziehen.</p><div class="mk-clist">' + arg.rows + '</div>' +
        '<div class="dlg-actions mk-acts"><button type="button" class="dlg-btn mk-text">Standard wiederherstellen</button><button type="button" class="dlg-btn primary">Fertig</button></div>';
      d.showModal(); r.activeElement?.blur();`, { icon: await ev(`return r.querySelector(".view-btn svg").outerHTML.replace(/width="\\d+"/, 'width="28"').replace(/height="\\d+"/, 'height="28"')`), close: svg("close", 18), rows: rowsHtml(rows, ICONS) });
  } else {
    await ev(`r.host._openViewSheet()`);
    await p.waitForTimeout(300);
    rows = await ev(`return ${READ}`, 'dialog.view [data-vlist="fields"]');
    rows = rows.map((x, i) => (i === 4 ? [x[0], x[1], false, x[3]] : x));
    await ev(`r.host._renderViewSheet = () => {}; r.host._render = () => {};
      const d = r.querySelector("dialog.view");
      d.querySelector('[data-vlist="fields"]').outerHTML = '<div class="mk-clist" style="padding:0">' + arg.rows + '</div>';
      const acts = d.querySelector(".dlg-actions"); acts.classList.add("mk-acts");
      acts.innerHTML = '<button type="button" class="dlg-btn mk-text">Standard wiederherstellen</button><button type="button" class="dlg-btn primary">Fertig</button>';
      d.querySelector(".mk-clist").scrollIntoView({ block: "center" }); r.activeElement?.blur();`, { rows: rowsHtml(rows, ICONS) });
  }
  const file = await shot(p, mobile, `A-${mobile ? "mobile" : "desktop"}`, { full: !mobile });
  await ctx.close();
  return file;
}

async function variantB(mobile) {
  const { ctx, p, ev } = await page(mobile, { css: CSS });
  await ev(`r.host._toggleCols(true); r.host._renderCols = () => {}; r.host._render = () => {};
    const pop = r.querySelector(".cols-pop");
    for (const v of pop.querySelectorAll(".vrow")) {
      if (["area", "hub"].includes(v.dataset.key)) v.classList.add("off");
      const on = !v.classList.contains("off");
      v.querySelector(".switch").outerHTML = '<button type="button" class="mk-eye">' + (on ? arg.eye : arg.eyeOff) + '</button>';
    }
    pop.querySelector(".vfoot").outerHTML = '<div class="mk-pfoot"><button type="button" class="dlg-btn mk-text">Standard wiederherstellen</button><button type="button" class="dlg-btn primary">Fertig</button></div>';`, { eye: svg("eye", 20), eyeOff: svg("eyeOff", 20) });
  const file = await shot(p, mobile, `B-${mobile ? "mobile" : "desktop"}`);
  await ctx.close();
  return file;
}

const aD = await variantA(false);
const aM = await variantA(true);
await compose("1-A-dialog-anpassen.png", [
  [aD, "A (Empfehlung): Dialog \"Anpassen\" wie in HA: Griff links, Auge rechts, ausgeblendet grau; \"Standard wiederherstellen\" und \"Fertig\"", 900],
  [aM, "A auf dem Handy: Angaben auf der Karte im Blatt \"Ansicht\" gleich", 360],
]);
const bD = await variantB(false);
await compose("2-B-popover.png", [[bD, "B: Popover unter \"Spalten\" bleibt, mit Augen und denselben Knöpfen (Handy wie A)", 900]]);
await close();
console.log("fertig");
