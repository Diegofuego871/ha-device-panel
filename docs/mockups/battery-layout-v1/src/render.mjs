// Mockups "Batterie-Reiter gliedern" (Wunsch des Nutzers, 2026-10-10): Im Reiter "Batterie" steht der Block
// "Abweichungen" (Warnschwelle pro Integration/Gerät) hinter dem neuen Abschnitt "Laden" und wirkt, als gehöre
// er zum Laden. Varianten, alle im echten Panel (Nachbau aus tests/panel, erfundene Daten):
//  1-A-B.png: A Abweichungen nach oben zur Warnschwelle; B Abschnitte als Karten mit Titel.
//  2-C-D.png: C Unterreiter "Warnung | Laden" im Reiter; D eigener Reiter "Laden" (siebter Reiter).
// Aufruf: CHROMIUM_PATH=... node docs/mockups/battery-layout-v1/src/render.mjs
import { setup } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8970, import.meta.url);

const CSS = `
.mk-card { margin: 14px 0; padding: 2px 14px 12px; border: 1px solid var(--dp-divider); border-radius: 14px; background: var(--dp-subtle) }
.mk-card > .mk-ct { display:flex; align-items:center; gap:8px; margin: 12px 0 4px; font-size:15px; font-weight:600; color: var(--dp-text) }
.mk-card > .mk-ct i { width:8px; height:8px; border-radius:50%; background: var(--dp-primary) }
.mk-card .mon-grp { margin-top: 14px }
.mk-sub { margin: 4px 0 }
.mk-note { margin: 8px 0 0; padding: 8px 10px; border-radius: 10px; background: var(--dp-primary-soft); color: var(--dp-text); font-size: 12.5px }
.mk-hl { box-shadow: -4px 0 0 var(--dp-primary) }
`;

// Gemeinsame Vorbereitung: Batterie-Reiter mit eingeschalteter Lademeldung und Beispielabweichungen.
async function open(script, { tabs = false } = {}) {
  const { ctx, p, ev } = await page(true, { css: CSS, width: 402, height: 2300, freeze: false });
  await p.evaluate(() => { window.__opts.battery_low_integrations = { hue: 5 }; window.__devSettings.battery = { a: 5 }; });
  await ev(`r.querySelector(".gear-btn").click()`); await p.waitForTimeout(400);
  await ev(`r.querySelector('[data-set="section"][data-id="monitor"]').click()`); await p.waitForTimeout(300);
  await ev(`r.querySelector('.mon-tab[data-key="battery"]').click()`); await p.waitForTimeout(300);
  await ev(`r.querySelector('input[data-opt="notify_charge"]').click()`); await p.waitForTimeout(300);
  await ev(`r.host._fetch = () => {};`);
  // Teile des Reiters nach Überschrift: warn (Zeitstrahl bis Anmerkung), meldung, laden, abw
  await ev(`
    const body = r.querySelector(".mon-body");
    const kids = [...body.children];
    const at = (t) => kids.findIndex((e) => e.classList.contains("mon-grp") && e.textContent.trim() === t);
    const [iM, iL, iA] = [at("Meldung"), at("Laden"), at("Abweichungen")];
    window.__parts = { head: kids.slice(0, iM), meldung: kids.slice(iM, iL), laden: kids.slice(iL, iA), abw: kids.slice(iA) };
    window.__body = body;
    const stub = r.querySelectorAll(".srch-rows .ex-row"); // Liste der Integrationen auf 3 Zeilen kürzen
    [...stub].slice(3).forEach((e) => e.remove());
  `);
  await ev(script);
  await p.waitForTimeout(300);
  await ev(`const d=r.querySelector("dialog.settings .dlg-body")||r.querySelector("dialog.settings"); const t=r.querySelector(".mon-tabs"); if (t) t.scrollIntoView({block:"start"});`);
  return { ctx, p, ev };
}
const shotOf = async (script, name, opts) => { const o = await open(script, opts); const f = await shot(o.p, true, name); await o.ctx.close(); return f; };

// A: Abweichungen direkt hinter die Warnschwelle, Titel sagt, wovon; Laden bleibt am Schluss.
const A = `
const { head, meldung, laden, abw } = window.__parts;
abw[0].textContent = "Abweichungen von \\"Schwach ab\\"";
const body = window.__body;
[...head, ...abw, ...meldung, ...laden].forEach((e) => body.appendChild(e));
`;
// B: drei Karten mit Titel: Warnung (mit Abweichungen), Meldung, Laden.
const B = `
const { head, meldung, laden, abw } = window.__parts;
const body = window.__body;
const card = (title, nodes) => { const c = document.createElement("div"); c.className = "mk-card"; c.innerHTML = '<div class="mk-ct"><i></i>' + title + '</div>'; nodes.forEach((n) => c.appendChild(n)); body.appendChild(c); };
card("Batterie-Warnung", [...head, ...abw]);
meldung[0].remove();
card("Meldung bei schwacher Batterie", meldung.slice(1));
laden[0].remove();
card("Lademeldung", laden.slice(1));
`;
// C: Unterreiter "Warnung | Laden" im Reiter; C1 zeigt Warnung (mit Abweichungen), C2 Laden.
const sub = (on) => `<div class="sub-tabs mk-sub"><button class="sub-tab ${on === 0 ? "on" : ""}">Warnung</button><button class="sub-tab ${on === 1 ? "on" : ""}">Laden</button></div>`;
const C1 = `
const { head, meldung, laden, abw } = window.__parts; const body = window.__body;
head[0].insertAdjacentHTML("beforebegin", ${JSON.stringify(sub(0))});
[...head, ...meldung, ...abw].forEach((e) => body.appendChild(e));
const sb = body.querySelector(".sub-tabs"); body.prepend(sb);
laden.forEach((e) => e.remove());
`;
const C2 = `
const { head, meldung, laden, abw } = window.__parts; const body = window.__body;
[...head, ...meldung, ...abw].forEach((e) => e.remove());
body.insertAdjacentHTML("afterbegin", ${JSON.stringify(sub(1))});
laden[0].remove();
laden.slice(1).forEach((e) => body.appendChild(e));
`;
// D: eigener Reiter "Laden" in der Reiterleiste (siebter Reiter, Leiste scrollt).
const D = `
const { head, meldung, laden, abw } = window.__parts; const body = window.__body;
[...head, ...meldung, ...abw].forEach((e) => e.remove());
laden[0].remove();
laden.slice(1).forEach((e) => body.appendChild(e));
const tabs = r.querySelector(".mon-tabs");
tabs.style.overflowX = "auto"; tabs.style.scrollbarWidth = "none";
const bat = tabs.querySelector('[data-key="battery"]'); bat.classList.remove("on");
const nu = tabs.querySelector('[data-key="new"]');
nu.insertAdjacentHTML("beforebegin", '<button type="button" class="mon-tab on">Laden</button>');
tabs.querySelectorAll(".mon-tab").forEach((b) => (b.style.flex = "0 0 auto", b.style.padding = "7px 10px"));
`;

const fA = await shotOf(A, "A");
const fB = await shotOf(B, "B");
const fC1 = await shotOf(C1, "C1");
const fC2 = await shotOf(C2, "C2");
const fD = await shotOf(D, "D");
await compose("1-A-B.png", [
  [fA, "A: \"Abweichungen\" direkt unter die Warnschwelle, Titel nennt den Bezug (\"von Schwach ab\"); Laden bleibt am Schluss", 380],
  [fB, "B: drei Karten mit Titel: Batterie-Warnung (mit Abweichungen), Meldung, Lademeldung", 380],
]);
await compose("2-C-D.png", [
  [fC1, "C1: Unterreiter \"Warnung | Laden\" im Reiter Batterie: Warnung mit Meldung und Abweichungen", 330],
  [fC2, "C2: Unterreiter \"Laden\"", 330],
  [fD, "D: eigener Reiter \"Laden\" (siebter Reiter, Leiste scrollt)", 330],
]);
await close();
