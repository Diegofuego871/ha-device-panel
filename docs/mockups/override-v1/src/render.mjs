// Mockups "Overrides": Einstellungen pro Gerät in der Liste sichtbar machen
// (A: Symbole je Art, B: ein Symbol), Filter-Chip "Eigene Einstellung" und
// Zurücksetzen in den Einstellungen (A: Liste mit Geräten, B: nur Anzahl).
// Im echten Panel (Nachbau aus tests/panel, erfundene Daten) mit den Stilen
// des Panels eingesetzt.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/override-v1/src/render.mjs
import { chromium } from "../../../../tests/panel/node_modules/playwright-core/index.mjs";
import { startServer } from "../../../../tests/panel/server.mjs";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
const tmp = fileURLToPath(new URL("./out/", import.meta.url));
mkdirSync(tmp, { recursive: true });
const server = await startServer(8955);
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const R = `document.querySelector("device-panel").shadowRoot`;

const P = {
  bellOff: "M20.84,22.73L18.11,20H3V19L5,17V11C5,9.86 5.29,8.73 5.83,7.72L1.11,3L2.39,1.73L22.11,21.46L20.84,22.73M19,15.8V11C19,7.9 16.97,5.17 14,4.29C14,4.19 14,4.1 14,4A2,2 0 0,0 12,2A2,2 0 0,0 10,4C10,4.1 10,4.19 10,4.29C9.39,4.47 8.8,4.74 8.26,5.09L19,15.8M12,23A2,2 0 0,0 14,21H10A2,2 0 0,0 12,23Z",
  batOff: "M22.11 21.46L2.39 1.73L1.11 3L6 7.89V20.67C6 21.4 6.6 22 7.33 22H16.67C17.4 22 18 21.4 18 20.67V19.89L20.84 22.73L22.11 21.46M16 18H8V9.89L16 17.89V18M8.2 4H9V2H15V4H16.67C17.4 4 18 4.6 18 5.33V15.8L16 13.8V6H10.2L8.2 4Z",
  bat: "M16,20H8V6H16M16.67,4H15V2H9V4H7.33A1.33,1.33 0 0,0 6,5.33V20.67C6,21.4 6.6,22 7.33,22H16.67A1.33,1.33 0 0,0 18,20.67V5.33C18,4.6 17.4,4 16.67,4Z",
  tune: "M8 13C6.14 13 4.59 14.28 4.14 16H2V18H4.14C4.59 19.72 6.14 21 8 21S11.41 19.72 11.86 18H22V16H11.86C11.41 14.28 9.86 13 8 13M8 19C6.9 19 6 18.1 6 17C6 15.9 6.9 15 8 15S10 15.9 10 17C10 18.1 9.1 19 8 19M19.86 6C19.41 4.28 17.86 3 16 3S12.59 4.28 12.14 6H2V8H12.14C12.59 9.72 14.14 11 16 11S19.41 9.72 19.86 8H22V6H19.86M16 9C14.9 9 14 8.1 14 7C14 5.9 14.9 5 16 5S18 5.9 18 7C18 8.1 17.1 9 16 9Z",
  reset: "M12,4C14.1,4 16.1,4.8 17.6,6.3C20.7,9.4 20.7,14.5 17.6,17.6C15.8,19.5 13.3,20.2 10.9,19.9L11.4,17.9C13.1,18.1 14.9,17.5 16.2,16.2C18.5,13.9 18.5,10.1 16.2,7.7C15.1,6.6 13.5,6 12,6V10.6L7,5.6L12,0.6V4M6.3,17.6C3.7,15 3.3,11 5.1,7.9L6.6,9.4C5.5,11.6 5.9,14.4 7.8,16.2C8.3,16.7 8.9,17.1 9.6,17.4L9,19.4C8,19 7.1,18.4 6.3,17.6Z",
  close: "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
};
const svg = (name, size = 16, cls = "") => `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${P[name]}"/></svg>`;

// Erfundene Einstellungen pro Gerät.
const BAT = { a: "off", c: 30, e: 25 };
const MUTE = ["d", "f"];

const CSS = `
.mk-ovs { display: inline-flex; align-items: center; gap: 4px; margin-left: 8px; vertical-align: -2px; }
.mk-ov { display: inline-flex; align-items: center; gap: 2px; height: 18px; padding: 0 5px; border-radius: 6px;
  background: var(--dp-primary-soft); color: var(--dp-primary); font-size: 11px; font-weight: 500; }
.mk-tip { position: absolute; z-index: 20; padding: 8px 10px; border-radius: 8px; background: #303030; color: #fff; font-size: 12px; line-height: 1.5; white-space: nowrap;
  box-shadow: 0 4px 14px rgba(0,0,0,.25); }
.mk-reset { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border: 1px solid var(--dp-divider); border-radius: 99px;
  background: var(--dp-card); color: var(--dp-text); font: inherit; font-size: 13px; white-space: nowrap; }
.mk-reset svg { color: var(--dp-text2); }
.mk-list { margin-top: 8px; border: 1px solid var(--dp-divider); border-radius: 12px; overflow: hidden; background: var(--dp-card); }
.mk-li { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 4px 6px 4px 12px; border-bottom: 1px solid var(--dp-divider); font-size: 13.5px; }
.mk-li:last-child { border-bottom: none; }
.mk-li .n { flex: 1; min-width: 0; }
.mk-li .n small { display: block; color: var(--dp-text2); font-size: 11.5px; }
.mk-li .v { color: var(--dp-primary); font-weight: 500; white-space: nowrap; }
.mk-x { display: grid; place-items: center; width: 30px; height: 30px; border: none; border-radius: 50%; background: none; color: var(--dp-text2); }
.mk-count { color: var(--dp-text2); font-size: 13px; white-space: nowrap; }
`;

async function page(mobile, theme = "light", height = 1000) {
  const ctx = await b.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1400, height }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:8955/ha-sim.html?lang=de&theme=${theme}`);
  await p.evaluate(({ bat, mute }) => {
    window.__devSettings.battery = bat;
    for (const id of mute) window.__devSettings.notifyOff.add(id);
  }, { bat: BAT, mute: MUTE });
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
  const ev = (code, arg) => f.evaluate(new Function("arg", `const r=${R};` + code), arg);
  return { ctx, p, f, ev };
}

// Abfragen anhalten, Stile dazu: das Panel baut sonst die eingesetzten Teile neu auf.
const FREEZE = `r.host._fetch = () => {}; r.host._render = () => {}; const s=document.createElement("style"); s.textContent=arg; r.appendChild(s);`;

// Symbole beim Namen (A: je Art, B: eines) und Chip "Eigene Einstellung".
async function markList(ev, variant, filter) {
  await ev(FREEZE, CSS);
  await ev(`
    const icons = (id) => {
      const out = [];
      const bat = arg.bat[id];
      if (arg.variant === "A") {
        if (bat === "off") out.push('<span class="mk-ov" title="Batterie-Warnung aus">' + arg.i.batOff + '</span>');
        else if (bat != null) out.push('<span class="mk-ov" title="Eigene Batterie-Schwelle">' + arg.i.bat + bat + ' %</span>');
        if (arg.mute.includes(id)) out.push('<span class="mk-ov" title="Ausfall- und Online-Meldungen aus">' + arg.i.bellOff + '</span>');
      } else if (bat != null || arg.mute.includes(id)) out.push('<span class="mk-ov">' + arg.i.tune + '</span>');
      return out.length ? '<span class="mk-ovs">' + out.join("") + '</span>' : "";
    };
    for (const row of r.querySelectorAll(".dev[data-open]")) {
      const html = icons(row.dataset.open);
      if (!html) continue;
      const name = row.querySelector(".nm") || row.querySelector(".nc > div:not(.av)") || row.querySelector(":scope > div:not(.av)");
      const sub = name.querySelector(".sub");
      if (sub) sub.insertAdjacentHTML("beforebegin", html); else name.insertAdjacentHTML("beforeend", html);
    }
    const n = new Set([...Object.keys(arg.bat), ...arg.mute]).size;
    const chips = r.querySelector(".chips");
    chips.insertAdjacentHTML("beforeend", '<button type="button" class="chip' + (arg.filter ? " on" : "") + '">' + arg.i.tuneChip + '<span>Eigene Einstellung</span> <span class="n">' + n + '</span></button>');
    if (arg.filter) {
      const keep = new Set([...Object.keys(arg.bat), ...arg.mute]);
      for (const row of r.querySelectorAll(".dev[data-open]")) if (!keep.has(row.dataset.open)) row.remove();
      // Leere Gruppen weg, Zahlen nachführen
      for (const g of r.querySelectorAll("tr.grp")) {
        let n2 = 0; let x = g.nextElementSibling;
        while (x && !x.classList.contains("grp")) { n2++; x = x.nextElementSibling; }
        if (!n2) g.remove(); else g.querySelector(".gl").firstChild.textContent = g.querySelector(".gl").firstChild.textContent.replace(/\\d+/, n2);
      }
      for (const c of r.querySelectorAll(".chip")) if (!c.textContent.includes("Eigene Einstellung")) c.classList.remove("on");
    }
  `, { variant, filter, bat: BAT, mute: MUTE, i: { bat: svg("bat", 12), batOff: svg("batOff", 13), bellOff: svg("bellOff", 13), tune: svg("tune", 13), tuneChip: svg("tune", 15) } });
}

async function clip(p, f, sel, file, extra = {}) {
  const d = await f.evaluate(new Function(`const d=${R}.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return {x:d.x,y:d.y,width:d.width,height:d.height}`));
  const fr = await (await p.$("#panel-frame")).boundingBox();
  const c = { x: d.x + fr.x, y: d.y + fr.y, width: d.width, height: d.height, ...extra };
  await p.screenshot({ path: file, clip: c });
}

async function listShot(variant, filter, tip) {
  const { ctx, p, f, ev } = await page(false, "light", 1240);
  await markList(ev, variant, filter);
  if (tip) {
    await ev(`
      const row = r.querySelector('.dev[data-open="c"]');
      const ic = row.querySelector(".mk-ov").getBoundingClientRect();
      r.querySelector(".content").insertAdjacentHTML("beforeend", '<div class="mk-tip" style="left:' + (ic.left - 8) + 'px;top:' + (ic.bottom + 6) + 'px;position:fixed">Eigene Einstellung:<br>Batterie-Warnung ab 30 % (global 15 %)</div>');
    `);
  }
  await p.waitForTimeout(300);
  const file = `${tmp}L-${variant}${filter ? "-filter" : ""}.png`;
  await clip(p, f, ".content", file, { height: filter ? 700 : 1030 });
  await ctx.close();
  return file;
}

async function mobileShot() {
  const { ctx, p, ev } = await page(true, "dark");
  await markList(ev, "A", false);
  await ev(`const chips = r.querySelector(".chips"); chips.scrollLeft = 9999; r.querySelector(".content").scrollTop = chips.offsetTop - 70;`);
  await p.waitForTimeout(300);
  const file = `${tmp}M-A.png`;
  await p.screenshot({ path: file });
  await ctx.close();
  return file;
}

// Einstellungen: Abschnitte Batterie und Push mit Zurücksetzen.
async function settingsShot(variant, section) {
  const { ctx, p, f, ev } = await page(false, "light", 1500);
  await ev(`r.querySelector(".gear-btn").click()`);
  await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.settings .set-sec")`));
  await ev(`r.querySelector('[data-set="section"][data-id="${section}"]').click()`);
  await p.waitForTimeout(300);
  await ev(FREEZE, CSS);
  await ev(`r.host._renderSettings = () => {};`);
  const batItems = [["Temperatur Keller", "Keller · BTHome", "Aus"], ["Thermostat Bad", "Bad · Matter", "30 %"], ["Fensterkontakt Küche", "Küche · Zigbee Home Automation", "25 %"]];
  const muteItems = [["Steckdose Terrasse", "Terrasse · Shelly", "Aus"], ["Präsenzsensor Büro", "Büro · ESPHome", "Aus"]];
  const list = (items) => `<div class="mk-list">${items.map(([n, s, v]) => `<div class="mk-li"><span class="n">${n}<small>${s}</small></span><span class="v">${v}</span><button class="mk-x" title="Zurücksetzen">${svg("close", 16)}</button></div>`).join("")}</div>`;
  const resetBtn = `<button class="mk-reset">${svg("reset", 15)}Alle zurücksetzen</button>`;
  const block = (label, items, shortA, shortB) => variant === "A"
    ? `<div class="opt"><div class="opt-line"><span class="opt-label">${label}</span>${resetBtn}</div><div class="opt-short">${shortA}</div>${list(items)}</div>`
    : `<div class="opt"><div class="opt-line"><span class="opt-label">${label}</span><span style="display:flex;align-items:center;gap:10px"><span class="mk-count">${items.length} Geräte</span>${resetBtn}</span></div><div class="opt-short">${shortB}</div></div>`;
  const html = section === "battery"
    ? block("Eigene Werte auf Geräten", batItems,
        "Diese Geräte weichen vom globalen Wert ab (eingestellt im Geräte-Popup). Zurückgesetzt wird beim Speichern.",
        "Setzt die Batterie-Warnung aller Geräte auf den globalen Wert zurück, beim Speichern. Welche Geräte: Filter \"Eigene Einstellung\" in der Liste.")
    : block("Meldungen auf Geräten ausgeschaltet", muteItems,
        "Für diese Geräte sind Ausfall- und Online-Meldungen aus (eingestellt im Geräte-Popup). Zurückgesetzt wird beim Speichern.",
        "Schaltet Ausfall- und Online-Meldungen für alle Geräte wieder auf die globale Einstellung, beim Speichern. Welche Geräte: Filter \"Eigene Einstellung\".");
  await ev(`
    const body = r.querySelector('[data-id="${section}"]').closest(".set-sec").querySelector(".set-sec-body");
    body.insertAdjacentHTML("beforeend", arg);
    body.lastElementChild.scrollIntoView({ block: "end" });
    r.querySelector("dialog.settings .dlg-body").scrollTop += 40;
  `, html);
  await p.waitForTimeout(300);
  const file = `${tmp}S-${variant}-${section}.png`;
  await clip(p, f, "dialog.settings", file);
  await ctx.close();
  return file;
}

async function compose(name, items, width) {
  const p = await b.newPage({ viewport: { width: 400, height: 400 } });
  const img = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
  await p.setContent(`<style>body{margin:0;padding:16px;background:#e8ebf0;font:600 15px system-ui;color:#333}
    .row{display:flex;gap:18px;align-items:flex-start}figure{margin:0}img{display:block;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.15)}
    figcaption{margin:8px 2px 0;font-weight:500;max-width:${width}px}</style><div class="row">${items
      .map(([f, cap, w]) => `<figure><img src="${img(f)}" style="width:${w || width}px"><figcaption>${cap}</figcaption></figure>`)
      .join("")}</div>`);
  await p.screenshot({ path: `${out}${name}`, fullPage: true });
  await p.close();
}

const la = await listShot("A", false, false);
await compose("1-liste-A-symbole.png", [[la, "A (Empfehlung): Symbole je Art beim Namen (Batterie mit eigener Schwelle, Batterie-Warnung aus, Meldungen aus) und Chip \"Eigene Einstellung\""]], 1300);
const lf = await listShot("A", true, false);
await compose("2-liste-filter.png", [[lf, "Filter \"Eigene Einstellung\": nur Geräte mit Einstellung pro Gerät (für A und B gleich)"]], 1300);
const lb = await listShot("B", false, true);
await compose("3-liste-B-ein-symbol.png", [[lb, "B: ein Symbol \"angepasst\", Einzelheiten im Tooltip (auf dem Handy erst im Popup)"]], 1300);
const m = await mobileShot();
await compose("4-handy-A.png", [[m, "A auf dem Handy: Symbole hinter dem Namen, Chip am Ende der Leiste"]], 390);
const sa1 = await settingsShot("A", "battery");
const sa2 = await settingsShot("A", "push");
await compose("5-einstellungen-A-liste.png", [[sa1, "A (Empfehlung): Batterie, Liste der Geräte mit eigenem Wert, einzeln oder alle zurücksetzen", 620], [sa2, "A: Push-Benachrichtigung, Geräte mit ausgeschalteten Meldungen", 620]], 620);
const sb1 = await settingsShot("B", "battery");
const sb2 = await settingsShot("B", "push");
await compose("6-einstellungen-B-kompakt.png", [[sb1, "B: nur Anzahl und \"Alle zurücksetzen\" (Batterie)", 620], [sb2, "B: dasselbe für die Meldungen", 620]], 620);
await b.close();
server.close();
console.log("fertig");
