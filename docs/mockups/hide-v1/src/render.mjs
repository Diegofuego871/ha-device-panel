// Mockups "Einzelne Geräte ausblenden" (Wunsch des Nutzers, 2026-10-03):
// ausgeblendete Geräte erscheinen in den Einstellungen, wo man sie wieder
// einblendet.
// A: Knopf "Ausblenden" im Geräte-Popup, Rückgängig im Hinweis.
// B: Auswahl "In der Liste" bei den Einstellungen für dieses Gerät.
// C: Mehrere auswählen in der Liste, dann "Ausblenden".
// Für alle: Abschnitt "Ausgeblendete Geräte" in den Einstellungen.
// Im echten Panel (Nachbau aus tests/panel, erfundene Daten).
// Aufruf: CHROMIUM_PATH=... node docs/mockups/hide-v1/src/render.mjs
import { setup, svg } from "../../_lib/mock.mjs";

const { page, shot, compose, close } = await setup(8963, import.meta.url);

const CSS = `
.dlg-actions.mk-two { display: flex; gap: 10px; }
.dlg-actions.mk-two .dlg-btn { flex: 1; }
.dlg-btn.mk-hide { display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
.toast.mk-toast { display: flex; align-items: center; gap: 16px; }
.toast.mk-toast b { color: var(--dp-primary-on-dark, #8ecbff); font-weight: 600; }
.mk-check { width: 20px; height: 20px; border-radius: 6px; border: 2px solid var(--dp-text3); display: grid; place-items: center; flex: none; }
.mk-check.on { border-color: var(--dp-primary); background: var(--dp-primary); color: #fff; }
.mk-bar { position: fixed; left: 50%; bottom: 120px; transform: translateX(-50%); z-index: 30; display: flex; align-items: center; gap: 14px; padding: 10px 12px 10px 18px;
  border-radius: 16px; background: var(--dp-card); border: 1px solid var(--dp-divider); box-shadow: 0 10px 30px rgba(0,0,0,.25); font-size: 14px; white-space: nowrap; }
.mk-bar .dlg-btn { display: inline-flex; align-items: center; gap: 8px; }
tr.dev.mk-sel td, .mc.mk-sel { background: var(--dp-primary-soft) !important; }
.mk-selbtn { border-color: var(--dp-primary) !important; color: var(--dp-primary) !important; }
.mk-hrow .ex-name small { display: block; }
.mk-empty { padding: 10px 2px 2px; font-size: 12.5px; color: var(--dp-text2); }
`;

async function popup(ev, p, id) {
  await ev(`r.querySelector('.dev[data-open="${id}"]').click()`);
  await p.waitForTimeout(500);
}

async function variantA(mobile) {
  const { ctx, p, ev } = await page(mobile, { css: CSS });
  await popup(ev, p, "e");
  await ev(`r.host._render = () => {}; r.host._renderDetail = () => {};
    const a = r.querySelector("dialog.device .dlg-actions"); a.classList.add("mk-two");
    a.insertAdjacentHTML("afterbegin", '<button type="button" class="dlg-btn mk-hide">' + arg + 'Ausblenden</button>');
    r.activeElement?.blur();`, svg("eyeOff", 18));
  const pop = await shot(p, mobile, `A-${mobile ? "mobile" : "desktop"}`, { full: true });
  // Nach dem Tipp: Popup zu, Hinweis mit Rückgängig
  await ev(`r.querySelector("dialog.device").close(); const t = r.querySelector(".toast");
    t.classList.add("mk-toast"); t.innerHTML = '<span>Fensterkontakt Küche ausgeblendet</span><b>Rückgängig</b>'; t.hidden = false;
    const row = r.querySelector('.dev[data-open="e"]'); if (row) row.remove();`);
  const toast = await shot(p, mobile, `A-${mobile ? "mobile" : "desktop"}-toast`);
  await ctx.close();
  return [pop, toast];
}

async function variantB(mobile) {
  const { ctx, p, ev } = await page(mobile, { css: CSS });
  await popup(ev, p, "e");
  await ev(`r.host._render = () => {}; r.host._renderDetail = () => {};
    const set = r.querySelector("dialog.device .dev-set");
    const h = set.previousElementSibling; if (h && h.tagName === "H3") h.textContent = "Einstellungen für dieses Gerät";
    set.insertAdjacentHTML("beforeend", '<div class="opt"><div class="opt-line"><span class="opt-label">In der Liste</span><span class="opt-select"><select><option>Anzeigen</option><option selected>Ausblenden</option></select>' + arg + '</span></div><div class="opt-short">Ausgeblendet: nicht in der Liste und nicht überwacht. Wieder einblenden unter Einstellungen → Ausgeblendete Geräte.</div></div>');
    set.scrollIntoView({ block: "center" }); r.activeElement?.blur();`, svg("chevDown", 18));
  const file = await shot(p, mobile, `B-${mobile ? "mobile" : "desktop"}`);
  await ctx.close();
  return file;
}

async function variantC(mobile) {
  const { ctx, p, ev } = await page(mobile, { css: CSS });
  await ev(`r.host._render = () => {};
    const pick = new Set(["e", "f", "k"]);
    for (const row of r.querySelectorAll(".dev")) {
      const on = pick.has(row.dataset.open);
      if (on) row.classList.add("mk-sel");
      const box = '<span class="mk-check' + (on ? ' on' : '') + '">' + (on ? arg.check : '') + '</span>';
      const av = row.querySelector(".av");
      if (row.querySelector("td")) {
        av.insertAdjacentHTML("beforebegin", box);
        row.querySelector(".mk-check").style.cssText = "display:inline-grid;vertical-align:middle;margin-right:10px";
      } else {
        // Handy: das Kästchen ersetzt im Auswahlmodus das Symbol.
        av.innerHTML = box; av.style.background = "transparent";
      }
    }
    for (const td of r.querySelectorAll("tr.dev td:first-child")) { td.style.whiteSpace = "nowrap"; const inner = td.firstElementChild; if (inner) inner.style.display = "inline-flex"; }
    const btn = r.querySelector(".view-btn");
    btn.insertAdjacentHTML("beforebegin", '<button type="button" class="view-btn mk-selbtn" style="padding:0 14px">' + arg.check + (${mobile} ? '' : ' Auswählen') + '</button>');
    r.querySelector(".content").insertAdjacentHTML("beforeend", '<div class="mk-bar"><span>3 ausgewählt</span><button type="button" class="dlg-btn">Abbrechen</button><button type="button" class="dlg-btn primary">' + arg.eyeOff + 'Ausblenden</button></div>');
    if (${mobile}) r.querySelector(".content").scrollTop = r.querySelector(".chips").offsetTop + 120;`, { check: svg("check", 16), eyeOff: svg("eyeOff", 18) });
  if (mobile) await ev(`r.querySelector(".mk-bar").style.bottom = "18px";`);
  const file = await shot(p, mobile, `C-${mobile ? "mobile" : "desktop"}`);
  await ctx.close();
  return file;
}

// Einstellungen: eigener Abschnitt mit Schalter "Anzeigen" pro Gerät (wie
// Integrationen und Gerätetypen), gilt mit "Speichern".
async function settings(mobile) {
  const { ctx, p, ev } = await page(mobile, { css: CSS });
  await ev(`r.querySelector(".gear-btn").click()`);
  await p.waitForTimeout(700);
  await ev(`r.host._renderSettings = () => {};
    const sec = r.querySelector('.set-sec-head[data-id="display"]').closest(".set-sec");
    const rows = [["Fensterkontakt Küche", "Küche · Zigbee Home Automation", arg.icons.contact, true], ["Präsenzsensor Büro", "Büro · ESPHome", arg.icons.motion, false], ["Steckdose Kaffeemaschine", "Küche · Shelly", arg.icons.outlet, false]];
    const row = ([n, s, ic, on]) => '<div class="ex-row mk-hrow' + (on ? '' : ' off') + '"><span class="ibadge type">' + ic + '</span><div class="ex-name">' + n + '<small>' + s + '</small></div><label class="switch"><input type="checkbox" ' + (on ? 'checked' : '') + '><span></span></label></div>';
    sec.insertAdjacentHTML("afterend", '<section class="set-sec open"><button type="button" class="set-sec-head" aria-expanded="true"><span><span class="set-sec-title">Ausgeblendete Geräte<span class="set-badge">geändert</span></span><span class="set-sec-sum">2 Geräte ausgeblendet</span></span>' + arg.chev + '</button>' +
      '<div class="set-sec-body"><div class="opt-short ex-intro">Ausgeblendete Geräte stehen nicht in der Liste und werden nicht überwacht (keine Meldungen). Ausblenden im Geräte-Popup.</div>' +
      '<div class="ex-head"><span></span><span>Anzeigen</span></div><div class="ex-row ex-all"><div class="ex-name">Alle einblenden</div><label class="switch"><input type="checkbox"><span></span></label></div>' + rows.map(row).join("") + '</div></section>');
    sec.nextElementSibling.scrollIntoView({ block: "start" });
    r.querySelector(".set-count").textContent = "1 Änderung";
    r.activeElement?.blur();`, { chev: svg("chevDown", 20), icons: { contact: "", motion: "", outlet: "" } });
  // Symbole aus dem Panel
  await ev(`for (const [i, b] of [...r.querySelectorAll(".mk-hrow .ibadge")].entries()) b.innerHTML = r.querySelector('.dev[data-open="' + ["e","f","k"][i] + '"] .av')?.innerHTML.replace(/<span class="dot"><\\/span>/, "") || "";`);
  const file = await shot(p, mobile, `S-${mobile ? "mobile" : "desktop"}`);
  await ctx.close();
  return file;
}

const [aD, aDt] = await variantA(false);
const [aM, aMt] = await variantA(true);
await compose("1-A-knopf-im-popup.png", [
  [aD, "A (Empfehlung): Knopf \"Ausblenden\" unten im Geräte-Popup", 760],
  [aMt, "A: danach Hinweis mit \"Rückgängig\" (Handy)", 300],
  [aM, "A auf dem Handy", 300],
]);
const bD = await variantB(false);
const bM = await variantB(true);
await compose("2-B-auswahl.png", [[bD, "B: Auswahl \"In der Liste\" bei den Einstellungen für dieses Gerät", 900], [bM, "B auf dem Handy", 360]]);
const cD = await variantC(false);
const cM = await variantC(true);
await compose("3-C-mehrere.png", [[cD, "C: \"Auswählen\" in der Werkzeugleiste, mehrere Geräte, dann \"Ausblenden\"", 900], [cM, "C auf dem Handy", 360]]);
const sD = await settings(false);
const sM = await settings(true);
await compose("4-einstellungen.png", [[sD, "Alle Varianten: Abschnitt \"Ausgeblendete Geräte\" mit Schalter \"Anzeigen\", gilt mit \"Speichern\"", 900], [sM, "auf dem Handy", 360]]);
await close();
console.log("fertig");
