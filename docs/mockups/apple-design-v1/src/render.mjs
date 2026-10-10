// Mockups (Wunsch des Nutzers, 2026-10-10): Wie änderte sich das Design nach dem Skill "apple-design"
// (Emil Kowalski, aus Apples WWDC-Vorträgen: Materialien und Tiefe, Typografie, Kanten statt Trennlinien,
// Rückmeldung beim Drücken, Gruppierung). Im echten Panel (Nachbau, erfundene Daten): die Varianten hängen nur Stile
// an die echten Klassen. Bewegung (Federn, Ziehen mit Schwung) lässt sich in Bildern nicht zeigen, siehe README.
//   Heute: unverändert
//   A "Dezent":   Typografie (Spationierung nach Grösse), Kanten statt harter Trennlinien, Druck-Rückmeldung
//   B "Material": A + durchscheinende Blatt-Oberflächen mit Unschärfe, abgedunkelter Hintergrund, tiefere Schatten
//   C "Gruppiert": B + iOS-Gruppen (eingerückte Zeilen in einer Karte), grosse Titel, Tasten als Tönung
// Aufruf: CHROMIUM_PATH=... node docs/mockups/apple-design-v1/src/render.mjs
import { setup } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8978, import.meta.url);

const A = `
:host { -webkit-font-smoothing: antialiased; }
/* Typografie: grosse Titel enger, kleine Beschriftung etwas weiter; Leading nach Grösse */
.dlg-title, .dlg-title h2 { letter-spacing: -0.022em; line-height: 1.12; }
.dlg-title h2 { font-size: 26px; font-weight: 700; }
.dlg-sub { letter-spacing: 0; }
.mon-grp, .set-title { letter-spacing: -0.012em; }
.opt-short, .opt-origin, .sub, small { letter-spacing: 0.01em; }
.st-k, .tile-k { letter-spacing: 0.02em; }
/* Kanten statt harter Trennlinien: unter dem Kopf und über den Knöpfen läuft der Inhalt weich aus */
.dlg-actions { border-top: none !important; background: linear-gradient(to bottom, transparent, var(--dp-card) 38%) !important; padding-top: 26px; }
.dlg-head { border-bottom: none !important; }
.opt { border-bottom-color: color-mix(in srgb, var(--dp-divider) 55%, transparent) !important; }
.toolbar h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.025em; }
.mrow .sub, .tile .sub { letter-spacing: 0.01em; }
/* Rückmeldung beim Drücken: sofort, 3 % kleiner */
button:active, .dev:active, .mrow:active, .chip:active, .tile:active, .st-tile:active, .sub-tab:active, .mon-tab:active { transform: scale(0.97); transition: transform 100ms ease-out; }
`;
const B = `${A}
/* Material: durchscheinende Blätter, Unschärfe, hellere Oberkante (Licht auf dem Material), tiefer Schatten */
dialog.device, dialog.settings, dialog.log-dlg, dialog.stat-dlg {
  background: color-mix(in srgb, var(--dp-card) 78%, transparent) !important;
  -webkit-backdrop-filter: blur(30px) saturate(180%); backdrop-filter: blur(30px) saturate(180%);
  border-top: 1px solid rgba(255,255,255,.16); box-shadow: 0 -12px 48px rgba(0,0,0,.55) !important; border-radius: 26px 26px 0 0 !important; }
dialog::backdrop { background: rgba(0,0,0,.42) !important; -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
.dlg-head, .dev-tabs { background: transparent !important; -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); }
.dev-tabs::after { display: none; }
.dlg-actions { background: linear-gradient(to bottom, transparent, color-mix(in srgb, var(--dp-card) 82%, transparent) 40%) !important; -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); }
/* Liste: die Chip-Leiste klebt als Material über der Liste (Inhalt läuft darunter durch), grosse Flächen tiefer */
.chips { background: color-mix(in srgb, var(--dp-bg) 62%, transparent) !important; -webkit-backdrop-filter: blur(22px) saturate(180%); backdrop-filter: blur(22px) saturate(180%); }
.hero > *, .mlist { border-radius: 22px !important; box-shadow: 0 8px 28px rgba(0,0,0,.35); }
.dlg-head { background: color-mix(in srgb, var(--dp-card) 55%, transparent) !important; }
/* Material-Gewicht: grosse Flächen dicker als kleine, Knöpfe heller als der Grund */
.dlg-btn { background: rgba(255,255,255,.08) !important; border-color: rgba(255,255,255,.12) !important; }
.dlg-btn.primary { background: var(--dp-primary) !important; }
.tile, .st-tile { background: rgba(255,255,255,.06) !important; border-color: rgba(255,255,255,.08) !important; }
.mon-tabs, .sub-tabs { background: rgba(255,255,255,.07) !important; }
.mon-tab.on, .sub-tab.on { background: rgba(255,255,255,.16) !important; box-shadow: 0 1px 6px rgba(0,0,0,.35); }
`;
const C = `${B}
.toolbar h1 { font-size: 30px; font-weight: 800; letter-spacing: -0.03em; }
.mrow.dev { padding-top: 12px; padding-bottom: 12px; }
/* iOS-Gruppen: Zeilen einer Gruppe stehen in einer Karte, Trenner beginnen eingerückt; grosse Titel */
.dlg-title h2 { font-size: 30px; font-weight: 800; letter-spacing: -0.03em; }
.dlg-title { letter-spacing: -0.03em; }
.dev-set, .set-sec-body, .mon-body > .lane { background: rgba(255,255,255,.055) !important; border: none !important; border-radius: 16px !important; padding: 4px 16px 8px !important; }
.opt { border-bottom: none !important; position: relative; }
.opt + .opt::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: rgba(255,255,255,.09); }
.mon-grp, .set-title, .dlg-body h3 { font-size: 13px !important; font-weight: 600 !important; letter-spacing: 0.04em !important; text-transform: uppercase !important; color: var(--dp-text2) !important; margin: 26px 8px 8px !important; }
.mon-grp::before, .set-title::before, .ex-title::before { display: none !important; }
.dlg-btn { border-radius: 14px !important; background: color-mix(in srgb, var(--dp-primary) 22%, transparent) !important; border-color: transparent !important; color: color-mix(in srgb, var(--dp-primary) 80%, white) !important; font-weight: 600; }
.dlg-btn.primary { background: var(--dp-primary) !important; color: #fff !important; }
`;
const VAR = { heute: "", A, B, C };

async function open(css, what) {
  const { ctx, p, ev } = await page(true, { css, width: 390, height: 844, freeze: false });
  await p.evaluate(() => { window.__charging = { c: { level: 64, from: 30, ago: 2000 } }; });
  await ev(`r.host._fetch()`); await p.waitForTimeout(600);
  await ev(`r.host._fetch = () => {}`);
  if (what === "list") { await p.waitForTimeout(200); }
  if (what === "device") {
    await ev(`r.querySelector('.dev[data-open="c"]').click()`); await p.waitForTimeout(600);
  }
  if (what === "settings") {
    await ev(`r.querySelector(".gear-btn").click()`); await p.waitForTimeout(500);
    await ev(`r.querySelector('[data-set="section"][data-id="monitor"]').click()`); await p.waitForTimeout(300);
    await ev(`r.querySelector('.mon-tab[data-key="battery"]').click()`); await p.waitForTimeout(300);
    await ev(`r.querySelector('.mon-tabs').scrollIntoView({block:"center"})`);
  }
  return { ctx, p };
}

const files = { list: [], device: [], settings: [] };
for (const what of ["list", "device", "settings"]) {
  for (const [name, css] of Object.entries(VAR)) {
    const { ctx, p } = await open(css, what);
    files[what].push([await shot(p, true, `${what}-${name}`), name]);
    await ctx.close();
  }
}
const cap = { heute: "Heute", A: "A Dezent: Typografie, Kanten, Druck-Rückmeldung", B: "B Material: durchscheinende Blätter, Unschärfe, Tiefe", C: "C Gruppiert: iOS-Gruppen, grosse Titel, getönte Tasten" };
const title = { list: "1-Liste.png", device: "2-Geraete-Popup.png", settings: "3-Einstellungen.png" };
for (const what of Object.keys(files)) {
  await compose(title[what], files[what].map(([f, n]) => [f, cap[n], 300]));
}
await close();
console.log("fertig");
