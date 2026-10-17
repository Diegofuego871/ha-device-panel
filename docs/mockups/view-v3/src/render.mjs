// Mockups "Ansicht an einem Ort" (2.83.0, Wunsch des Nutzers): Der Dialog "Spalten" (Handy: Blatt "Ansicht") bekommt zwei Reiter,
// "Spalten" und "Filter-Chips"; der Abschnitt "Ansicht" aus den zentralen Einstellungen entfällt. Der Abschnitt "Panel-Version" heisst
// "Panel" und hat zwei Unterreiter, "Standardseite" und "Updates". Im echten Panel (Nachbau aus tests/panel, erfundene Daten);
// die Inhalte der Reiter sind die echten Blöcke des heutigen Panels, nur umgesetzt.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/view-v3/src/render.mjs
import { chromium } from "../../../../tests/panel/node_modules/playwright-core/index.mjs";
import { startServer } from "../../../../tests/panel/server.mjs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../", import.meta.url));
const server = await startServer(8959);
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const R = `document.querySelector("device-panel").shadowRoot`;

const CSS = `
.mk-tabs { margin: 4px 20px 6px; }
.mk-tabs .sub-tab { white-space: nowrap; }
.mk-pane-note { margin: 2px 0 10px; padding: 8px 12px; border-radius: 10px; background: var(--dp-primary-soft); color: var(--dp-text); font-size: 12.5px; line-height: 1.45; }
.mk-sec-tabs { margin: 10px 0 4px; }
.mk-badge { display: inline-block; margin-left: 8px; padding: 1px 8px; border-radius: 99px; background: var(--dp-primary-soft); color: var(--dp-primary); font-size: 11px; font-weight: 400; vertical-align: middle; }
`;

async function page(mobile) {
  const ctx = await b.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  await p.goto("http://127.0.0.1:8959/ha-sim.html?lang=de&theme=light");
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
  const ev = (code, arg) => f.evaluate(new Function("arg", `const r=${R};` + code), arg);
  await ev(`const s=document.createElement("style"); s.textContent=arg; r.appendChild(s);`, CSS);
  return { ctx, p, ev };
}

// Echte Blöcke aus den Einstellungen holen: Startseite, Filter-Chips, Updates, Kopfzeilen der Abschnitte
async function parts(ev) {
  await ev(`r.host._openSettings()`);
  await new Promise((r) => setTimeout(r, 700));
  await ev(`for (const id of ["look","updates"]) r.querySelector('[data-set="section"][data-id="'+id+'"]')?.click()`);
  await new Promise((r) => setTimeout(r, 500));
  const data = await ev(`
    const dlg = r.querySelector("dialog.settings");
    const secs = [...dlg.querySelectorAll("section.set-sec")];
    const by = (id) => secs.find((s) => s.querySelector('[data-id="' + id + '"]'));
    const look = by("look").querySelector(".set-sec-body");
    const kids = [...look.children];
    const i = kids.findIndex((e) => e.classList.contains("ex-title"));
    const start = kids.slice(0, i).map((e) => e.outerHTML).join("");
    const chips = kids.slice(i).map((e) => e.outerHTML).join("");
    const top = [...dlg.querySelector(".dlg-body").children].filter((e) => !e.matches("section.set-sec")).map((e) => e.outerHTML).join("");
    const upd = by("updates");
    const closed = (id) => { const c = by(id).cloneNode(true); c.classList.remove("open"); c.querySelector(".set-sec-body")?.remove(); return c.outerHTML; };
    return { start, chips, top, updBody: upd.querySelector(".set-sec-body").innerHTML, updHead: upd.querySelector(".set-sec-head").outerHTML,
      closed: ["devices", "monitor", "routines", "ai"].map(closed), head: dlg.querySelector(".dlg-head").outerHTML, actions: dlg.querySelector(".dlg-actions").outerHTML };`);
  await ev(`r.querySelector("dialog.settings").close()`);
  return data;
}

const tabs = (labels, on, key) => `<div class="sub-tabs mk-tabs" role="tablist">${labels.map((l, i) => `<button type="button" role="tab" class="sub-tab${i === on ? " on" : ""}" data-set="${key}" aria-selected="${i === on}">${l}</button>`).join("")}</div>`;

// 1 + 2: Dialog "Ansicht" (Desktop) mit den Reitern "Spalten" und "Filter-Chips"
async function viewDialog(P, which) {
  const { ev, p } = await page(false);
  await ev(`r.host._toggleCols(true)`);
  await p.waitForTimeout(500);
  await ev(`
    const dlg = r.querySelector("dialog.cols-dlg");
    dlg.style.width = "min(700px, calc(100vw - 32px))";
    dlg.querySelector(".dlg-title h2").textContent = "Ansicht";
    dlg.querySelector(".dlg-sub").textContent = "Sortierung, Spalten und Filter-Chips";
    const body = dlg.querySelector(".dlg-body");
    const tabsHtml = arg.tabs;
    if (arg.which === 2) {
      body.innerHTML = '<div class="mk-pane-note">Gilt für alle Benutzer · wird sofort gespeichert · nur Administratoren sehen diesen Reiter</div>' + arg.chips;
      dlg.querySelector(".dlg-actions").innerHTML = '<button type="button" class="dlg-btn text">Standard wiederherstellen</button><button type="button" class="dlg-btn primary" data-vdone>Fertig</button>';
    } else {
      body.insertAdjacentHTML("afterbegin", '<div class="mk-pane-note">Gilt nur für dich · getrennt für PC und Handy</div>');
    }
    body.insertAdjacentHTML("beforebegin", tabsHtml);
  `, { tabs: tabs(["Spalten", "Filter-Chips"], which - 1, "mkview"), which, chips: P.chips });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}${which}-${which === 1 ? "Ansicht-Spalten" : "Ansicht-Filter-Chips"}.png` });
}

// 3 + 4: Einstellungen mit "Panel" (Unterreiter "Standardseite" und "Updates"), ohne den Abschnitt "Ansicht"
async function settingsDialog(P, which) {
  const { ev, p } = await page(false);
  await ev(`r.host._openSettings()`);
  await p.waitForTimeout(700);
  await ev(`
    const dlg = r.querySelector("dialog.settings");
    const upd = arg.updHead.replace(/Panel-Version/, 'Panel');
    const sum = arg.which === 1 ? "Standardseite: aus · Device Panel 0.4.0, aktuell" : "Device Panel 0.4.0, aktuell · Updates automatisch";
    const head = upd.replace(/<span class="set-sec-sum">[^<]*<\\/span>/, '<span class="set-sec-sum">' + sum + '</span>');
    const pane = arg.which === 1
      ? '<div class="mk-pane-note">Gilt nur für dich, nicht für andere Benutzer.</div>' + arg.start
      : arg.top + arg.updBody;
    const panel = '<section class="set-sec open">' + head + '<div class="set-sec-body">' + arg.tabs + pane + '</div></section>';
    dlg.querySelector(".dlg-body").innerHTML = arg.closed.join("") + panel;
    dlg.querySelector(".set-sec-head[data-id='updates']")?.setAttribute("aria-expanded", "true");
    dlg.scrollTop = 0;
  `, { ...P, which, tabs: tabs(["Standardseite", "Updates"], which - 1, "mkpanel") });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}${which + 2}-Einstellungen-Panel-${which === 1 ? "Standardseite" : "Updates"}.png` });
}

// 5: Handy, Blatt "Ansicht" mit Reitern
async function phone(P) {
  const { ev, p } = await page(true);
  await ev(`r.host._openViewSheet()`);
  await p.waitForTimeout(600);
  await ev(`
    const dlg = r.querySelector("dialog.view");
    dlg.querySelector(".dlg-sub").textContent = "Sortierung, Angaben und Filter-Chips";
    dlg.querySelector(".dlg-body").insertAdjacentHTML("beforebegin", arg.tabs);
  `, { tabs: tabs(["Sortierung & Angaben", "Filter-Chips"], 0, "mkview") });
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${out}5-Handy-Ansicht.png` });
  await ev(`
    const dlg = r.querySelector("dialog.view");
    dlg.querySelector(".dlg-body").innerHTML = '<div class="mk-pane-note">Gilt für alle Benutzer · sofort gespeichert · nur für Administratoren</div>' + arg.chips;
    dlg.querySelectorAll(".sub-tab").forEach((e, i) => { e.classList.toggle("on", i === 1); e.setAttribute("aria-selected", String(i === 1)); });
  `, { chips: P.chips });
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${out}6-Handy-Filter-Chips.png` });
}

const { ev, ctx } = await page(false);
const P = await parts(ev);
await ctx.close();
await viewDialog(P, 1);
await viewDialog(P, 2);
await settingsDialog(P, 1);
await settingsDialog(P, 2);
await phone(P);
await b.close();
server.close?.();
