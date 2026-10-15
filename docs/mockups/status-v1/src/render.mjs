// Mockups App "Status" (2026-10-15, Wunsch des Nutzers): neue Panel-App im Launcher, die zeigt, ob die Teile der Integration laufen (Herzschlag),
// mit kleinem Config-Teil oben (Meldung bei Stillstand: Standard "wie die anderen Meldungen", umstellbar). Bei einer Störung: roter Punkt am
// Status-Knopf in der Kopfzeile (wie der Neustart-Hinweis am Zahnrad) und Pille "Störung" im Launcher (wie "Debug"). Im echten Panel
// (Nachbau aus tests/panel, erfundene Daten), Handy 402 x 874 und Desktop.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/status-v1/src/render.mjs
import { setup, svg } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8977, import.meta.url);

const CSS = `
.mk-sec { margin: 18px 0 8px; font-size: 13px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--dp-text2); }
.mk-sec:first-child { margin-top: 0; }
.mk-card { border-radius: 18px; background: var(--dp-subtle); overflow: hidden; }
.mk-line { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-top: 1px solid var(--dp-divider); }
.mk-line:first-child { border-top: 0; }
.mk-line .t { flex: 1; min-width: 0; }
.mk-line b { display: block; font-size: 14.5px; font-weight: 600; }
.mk-line small { display: block; margin-top: 2px; color: var(--dp-text2); font-size: 12.5px; line-height: 1.35; }
.mk-cfg { padding: 12px 14px; border-top: 1px solid var(--dp-divider); }
.mk-cfg .sub-tabs { margin-top: 8px; }
.mk-banner { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 18px; margin-bottom: 4px; }
.mk-banner.ok { background: var(--dp-success-soft); color: var(--dp-success); }
.mk-banner.bad { background: var(--dp-error-soft); color: var(--dp-error); }
.mk-banner .ic { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: color-mix(in srgb, currentColor 16%, transparent); }
.mk-banner b { display: block; font-size: 15px; font-weight: 600; }
.mk-banner small { display: block; margin-top: 2px; font-size: 12.5px; opacity: .9; }
.mk-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.mk-tile { padding: 12px; border-radius: 16px; background: var(--dp-subtle); display: flex; flex-direction: column; gap: 6px; }
.mk-tile.bad { background: var(--dp-error-soft); }
.mk-tile.warn { background: var(--dp-warning-soft); }
.mk-tile b { font-size: 14px; font-weight: 600; }
.mk-tile small { color: var(--dp-text2); font-size: 12px; line-height: 1.3; }
.mk-start { margin: 12px 2px 0; color: var(--dp-text2); font-size: 12.5px; line-height: 1.4; }
/* Kopfzeile: Status-Knopf mit rotem Punkt (wie am Zahnrad) */
.mk-dot { position: relative; }
.mk-dot::after { content: ""; position: absolute; top: 3px; right: 3px; width: 10px; height: 10px; box-sizing: border-box; border-radius: 50%; background: var(--dp-error); border: 2px solid var(--dp-bg); }
.ap-badge.bad { background: var(--dp-error-soft); color: var(--dp-error); }
`;

const PILL = { ok: ["on", "läuft"], late: ["warn", "verspätet"], down: ["off", "steht"] };
const pill = (k) => `<span class="pill ${PILL[k][0]}"><span class="pd"></span>${PILL[k][1]}</span>`;

const PARTS = (bad) => [
  { n: "Routinen", s: "Letzter Takt vor 8 s · 14 geladen, nächste um 06:30", k: bad ? "down" : "ok", why: "Seit 18 Min. kein Takt (erwartet alle 1 Min.)" },
  { n: "Magic Push", s: "Letzte Prüfung vor 3 s · 6 Regeln", k: "ok" },
  { n: "Ausfall-Überwachung", s: "Letzte Auswertung vor 41 s", k: bad ? "late" : "ok", why: "Letzte Auswertung vor 7 Min. (erwartet alle 1 Min.)" },
  { n: "Batterie", s: "Letzte Prüfung vor 12 Min.", k: "ok" },
  { n: "Laden", s: "Letzter Takt vor 22 s", k: "ok" },
  { n: "Neue Geräte", s: "Wartet auf neue Geräte", k: "ok" },
  { n: "Updates", s: "Letzte Prüfung heute 05:48", k: "ok" },
];

const cfg = (own) => `
  <div class="mk-sec">Meldung bei Stillstand</div>
  <div class="mk-card">
    <div class="mk-line"><span class="t"><b>Bei Stillstand melden</b><small>Ein Push, sobald ein Teil nicht mehr läuft, und eine Entwarnung danach.</small></span><label class="switch"><input type="checkbox" checked><span></span></label></div>
    <div class="mk-cfg"><b style="font-size:13.5px">Empfänger</b>
      <div class="sub-tabs" role="tablist" data-set="status-target">
        <button type="button" class="sub-tab${own ? "" : " on"}" role="tab">Wie die anderen Meldungen</button>
        <button type="button" class="sub-tab${own ? " on" : ""}" role="tab">Eigenes Ziel</button>
      </div>
      <small style="display:block;margin-top:8px;color:var(--dp-text2);font-size:12.5px">${own ? "notify.mobile_app_dani_iphone" : "Standard aus den Einstellungen: notify.mobile_app_dani_iphone"}</small>
    </div>
  </div>`;

const banner = (bad) => bad
  ? `<div class="mk-banner bad"><span class="ic">${svg("pulse", 22)}</span><span><b>Störung: 2 Teile</b><small>Routinen stehen, die Ausfall-Überwachung ist verspätet. Push gesendet um 06:41.</small></span></div>`
  : `<div class="mk-banner ok"><span class="ic">${svg("check", 22)}</span><span><b>Alles läuft</b><small>Alle 7 Teile melden sich im erwarteten Takt.</small></span></div>`;
const START = `<p class="mk-start">Letzter Start der Integration: heute 06:12 · 14 Routinen geladen · 0 verpasst</p>`;

const listA = (bad) => `<div class="mk-sec">Zustand</div>${banner(bad)}<div class="mk-card" style="margin-top:8px">${PARTS(bad).map((p) => `<div class="mk-line"><span class="t"><b>${p.n}</b><small>${p.k !== "ok" ? p.why : p.s}</small></span>${pill(p.k)}</div>`).join("")}</div>${START}`;
const tilesB = (bad) => `<div class="mk-sec">Zustand</div>${banner(bad)}<div class="mk-grid" style="margin-top:8px">${PARTS(bad).map((p) => `<div class="mk-tile${p.k === "down" ? " bad" : p.k === "late" ? " warn" : ""}"><span style="display:flex;justify-content:space-between;align-items:center;gap:6px"><b>${p.n}</b>${pill(p.k)}</span><small>${p.k !== "ok" ? p.why : p.s}</small></div>`).join("")}</div>${START}`;

async function window_(mobile, body, { own = false, lang = "de" } = {}) {
  const o = await page(mobile, { css: CSS, width: 402, height: 874, lang });
  await o.ev(`r.querySelector(".toolbar .rtall-btn").click()`);
  await o.p.waitForTimeout(900);
  await o.ev(`
    const d = r.querySelector("dialog.rtall-dlg");
    d.querySelector(".dlg-title h2").textContent = "Status";
    d.querySelector(".dlg-sub").textContent = "Läuft das Panel?";
    d.querySelector(".dlg-add")?.remove();
    d.querySelector("[data-rta-body]").innerHTML = ${JSON.stringify(cfg(own) + body)};
    r.host._initSeg?.(r);
  `);
  return o;
}

const files = {};
for (const [name, mobile, body, own] of [
  ["A-ok", true, listA(false), false],
  ["A-bad", true, listA(true), false],
  ["B-bad", true, tilesB(true), true],
  ["A-bad-desktop", false, listA(true), false],
]) {
  const o = await window_(mobile, body, { own });
  files[name] = await shot(o.p, mobile, `status-${name}`);
  await o.ctx.close();
}

// Kopfzeile und Launcher bei Störung
const h = await page(true, { css: CSS, width: 402, height: 874 });
await h.ev(`
  const b = r.querySelector(".toolbar .rtall-btn");
  const c = b.cloneNode(true);
  c.classList.add("mk-dot");
  c.setAttribute("aria-label", "Status");
  c.innerHTML = ${JSON.stringify(svg("pulse", 22))};
  b.after(c);
`);
await h.p.waitForTimeout(300);
files.header = await shot(h.p, true, "status-header");
await h.ev(`r.querySelector(".apps-btn").click()`);
await h.p.waitForTimeout(900);
await h.ev(`
  const d = r.querySelector("dialog.apps-dlg");
  const log = [...d.querySelectorAll(".ap-tile, .ap-row")].find((x) => x.querySelector('[data-id="log"]'));
  if (log) {
    const c = log.cloneNode(true);
    const m = c.querySelector("[data-id]"); m.dataset.id = "status";
    const nm = c.querySelector(".ap-nm, .ap-t b"); if (nm) nm.textContent = "Status";
    c.querySelector(".ap-badge")?.remove();
    const bd = document.createElement("span"); bd.className = "ap-badge bad"; bd.textContent = "Störung";
    if (c.querySelector(".ap-t b")) c.querySelector(".ap-t b").appendChild(bd); else c.appendChild(bd);
    const ic = c.querySelector(".ap-ico"); if (ic) ic.innerHTML = ${JSON.stringify(svg("pulse", 22))};
    log.after(c);
  }
`);
await h.p.waitForTimeout(300);
files.launcher = await shot(h.p, true, "status-launcher");
await h.ctx.close();

await compose("1-Status-Handy.png", [
  [files["A-ok"], "A (Empfehlung): Liste, Zustand ok", 360],
  [files["A-bad"], "A: Störung (Routinen stehen, Überwachung verspätet), Empfänger \"wie die anderen\"", 360],
  [files["B-bad"], "B: Kacheln in zwei Spalten, Störung, eigenes Ziel gewählt", 360],
]);
await compose("2-Status-Desktop.png", [[files["A-bad-desktop"], "A: Desktop, Störung", 1000]]);
await compose("3-Kopfzeile-Launcher.png", [
  [files.header, "Kopfzeile: Status-Knopf mit rotem Punkt (wie das Zahnrad bei einem Neustart-Hinweis)", 360],
  [files.launcher, "Launcher: Pille \"Störung\" an der App (wie \"Debug\" am Protokoll)", 360],
]);
await close();
