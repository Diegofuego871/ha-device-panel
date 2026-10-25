/**
 * Styles (Shadow DOM), Design C (docs/mockups/panel-v1, Bilder 6–8). Farben
 * aus den Theme-Variablen von Home Assistant, eigene mit --dp- (docs/DESIGN.md).
 * Geräte-Popup und Statistik-Fenster wie in unifi_dynamic.
 */
export const PANEL_CSS = `
:host {
  /* iOS vergrössert sonst die Schrift einzelner Textblöcke je nach Inhalt (Routinen-Fenster: Einleitung grösser, wenn die Liste leer ist) */
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  --dp-bg: var(--primary-background-color, #f4f6f9);
  --dp-card: var(--card-background-color, #fff);
  --dp-text: var(--primary-text-color, #212121);
  --dp-text2: var(--secondary-text-color, #727272);
  --dp-text3: var(--disabled-text-color, #9e9e9e);
  --dp-divider: var(--divider-color, rgba(0,0,0,0.12));
  --dp-primary: var(--primary-color, #03a9f4);
  --dp-on-primary: #fff;
  --dp-success: var(--success-color, #43a047);
  --dp-warning: var(--warning-color, #ff9800);
  --dp-error: var(--error-color, #db4437);
  --dp-hover: color-mix(in srgb, var(--dp-text) 5%, var(--dp-card));
  --dp-subtle: color-mix(in srgb, var(--dp-text) 4%, var(--dp-card));
  /* Aufgeklappter Abschnitt der Einstellungen: Inhalt leicht, Kopf deutlich getönt. */
  --dp-sec-open: color-mix(in srgb, var(--dp-text) 4.5%, var(--dp-card));
  --dp-sec-head: color-mix(in srgb, var(--dp-text) 9.5%, var(--dp-card));
  --dp-primary-soft: color-mix(in srgb, var(--dp-primary) 14%, transparent);
  --dp-success-soft: color-mix(in srgb, var(--dp-success) 16%, transparent);
  --dp-warning-soft: color-mix(in srgb, var(--dp-warning) 16%, transparent);
  --dp-error-soft: color-mix(in srgb, var(--dp-error) 10%, transparent);
  --dp-error-line: color-mix(in srgb, var(--dp-error) 40%, transparent);
  /* Deckend (mit der Kartenfarbe gemischt): die fixierte erste Spalte darf
     beim seitlichen Scrollen nichts durchscheinen lassen. */
  --dp-error-row: color-mix(in srgb, var(--dp-error) 9%, var(--dp-card));
  --dp-warning-row: color-mix(in srgb, var(--dp-warning) 11%, var(--dp-card));
  --dp-bar-off: color-mix(in srgb, var(--dp-text) 14%, transparent);
  --dp-input: var(--dp-card);
  --dp-shadow: 0 10px 30px rgba(0,0,0,0.18);
  --dp-shadow-s: 0 1px 2px rgba(0,0,0,0.08);
  /* Stufen (gut -> schlecht), wie Ping/WLAN in unifi_dynamic */
  --dp-tier4: #4caf50;
  --dp-tier3: #8bc34a;
  --dp-tier2: #eba43f;
  --dp-tier1: #e5625f;
  /* Vorabversionen (Beta), wie unifi_dynamic */
  --dp-beta: #a37fe0;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--dp-bg);
  color: var(--dp-text);
  font-family: var(--ha-font-family-body, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
  font-size: 14px;
}
* { box-sizing: border-box; }
svg.ic { flex: none; vertical-align: middle; }
button { font: inherit; color: inherit; }

/* Werkzeugleiste: bleibt stehen, nur .content scrollt (siehe LEARNINGS),
   in beide Richtungen, weil die Tabelle breiter werden kann als das Panel. */
.toolbar { display: flex; align-items: center; gap: 12px; padding: 14px 20px 12px; }
.toolbar h1 { margin: 0 6px 0 0; font-size: 20px; font-weight: 500; white-space: nowrap; }
/* Logo, Titel und Suchfeld bilden eine Gruppe. Schmal und am Handy ohne eigene Wirkung (display: contents); auf breiten Fenstern (ab 1101 px,
   dort hat der Kopf drei Spalten) endet das Suchfeld mit der Kachel "Gerade ausgefallen", damit das X nicht am äussersten Rand sitzt.
   Fehlt der Platz (viele Favoriten), gibt die Gruppe nach: das Suchfeld wird schmaler. */
.tb-main { display: contents; }
@media (min-width: 1101px) {
  .tb-main { display: flex; align-items: center; gap: 12px; flex: 0 1 calc(var(--hero-c1) + 12px + var(--hero-c2)); min-width: 0; }
  .tb-main + .view-btn { margin-left: auto; }
}
.searchbox { flex: 1; display: flex; align-items: center; gap: 10px; height: 42px; padding: 0 14px; border-radius: 14px;
  background: var(--dp-input); border: 1px solid var(--dp-divider); color: var(--dp-text2); min-width: 0; }
.search { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--dp-text); font: inherit; height: 100%; }
/* Eigenes X statt des Browser-Knopfs: den zeigt nicht jeder Browser (iOS). */
.search::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; display: none; }
.search-clear { flex: none; display: grid; place-items: center; width: 32px; height: 32px; margin-right: -8px; padding: 0; border: 0; border-radius: 50%;
  background: none; color: var(--dp-text2); cursor: pointer; }
.search-clear:hover { background: var(--dp-hover); color: var(--dp-text); }
.search-clear[hidden] { display: none; }
.gear-btn, .rtall-btn, .apps-btn { flex: none; display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; border: 1px solid var(--dp-divider);
  background: var(--dp-card); color: var(--dp-text2); cursor: pointer; }
.rtall-btn, .apps-btn { margin: 0 -2px; text-decoration: none; } /* Favoriten und Launcher-Knopf rücken enger zusammen (8 px), links vom ersten und rechts vom letzten 10 px */
.app-pins { display: contents; }
.gear-btn { position: relative; }
.toolbar .apps-btn:last-child { margin-right: 0; } /* seit 2.88.0 steht der Launcher-Knopf ganz rechts (das Zahnrad ist ein Favorit): bündig mit dem Rand wie vorher das Zahnrad, auch am Handy */
/* Roter Punkt: Update installiert, Neustart steht aus (seit 2.25.0) */
.gear-btn.has-dot::after { content: ""; position: absolute; top: 3px; right: 3px; width: 10px; height: 10px; box-sizing: border-box; border-radius: 50%; background: var(--dp-error); border: 2px solid var(--dp-bg); }
/* Punkt am Launcher-Knopf und an angehefteten Apps (seit 2.62.0): rot = Störung des Status, orange = Debug-Modus */
.apps-btn, .app-pin { position: relative; }
.apps-btn.has-dot::after, .app-pin.has-dot::after { content: ""; position: absolute; top: 3px; right: 3px; width: 10px; height: 10px; box-sizing: border-box; border-radius: 50%; background: var(--dp-error); border: 2px solid var(--dp-bg); }
.apps-btn.dot-warn::after, .app-pin.dot-warn::after { background: var(--dp-warning); }
.gear-btn:hover, .rtall-btn:hover, .apps-btn:hover { background: var(--dp-hover); color: var(--dp-text); }
.apps-btn.on { background: var(--dp-primary-soft); border-color: transparent; color: var(--dp-primary); }
.content { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 0 20px 16px; }
/* Kopf, Chips und Fusszeile bleiben beim seitlichen Scrollen der Tabelle stehen. */
.hero, .chips, .foot { position: sticky; left: 0; }

/* Kopf */
/* Breite der ersten zwei Kacheln (Verfügbarkeit, Gerade ausgefallen): auch das Suchfeld endet dort (seit 2.36.0, siehe .tb-main) */
:host { --hero-c1: 300px; --hero-c2: 380px; }
/* Kopf, Chips und Fuss bleiben beim seitlichen Verschieben der breiten Tabelle stehen (iPad): nur die Tabelle wandert */
.hero { display: grid; grid-template-columns: minmax(260px, var(--hero-c1)) minmax(300px, var(--hero-c2)) minmax(280px, 1fr); gap: 12px; position: sticky; left: 0; }
.kt { background: var(--dp-card); border-radius: 20px; padding: 16px 18px; border: 1px solid var(--dp-divider); position: relative; overflow: hidden; min-width: 0; }
.kt .k { font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: var(--dp-text2); font-weight: 500; display: flex; align-items: center; gap: 8px; }
.kt.ring { display: grid; grid-template-columns: 108px minmax(0, 1fr); gap: 16px; align-items: center; }
.ringwrap { position: relative; width: 108px; height: 108px; }
.ringwrap .c { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; }
.ringwrap .c b { display: block; font-size: 24px; font-weight: 600; letter-spacing: -.02em; }
.ringwrap .c span { display: block; font-size: 11px; line-height: 1.2; color: var(--dp-text2); max-width: 76px; margin: 0 auto; }
.kt .pct { font-size: 26px; font-weight: 600; margin: 6px 0 8px; letter-spacing: -.02em; white-space: nowrap; }
.kt .pct small { font-size: 12px; font-weight: 400; color: var(--dp-text2); letter-spacing: 0; margin-left: 4px; }
.kt .pct.with-avg { margin-bottom: 2px; }
.kt .pavg { font-size: 13px; color: var(--dp-text2); margin-bottom: 8px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.kt .pavg b { color: var(--dp-text); font-weight: 600; }
.lines div { display: flex; align-items: center; gap: 8px; font-size: 13.5px; padding: 2px 0; }
.lines i { width: 9px; height: 9px; border-radius: 3px; display: inline-block; }
.pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--dp-error); flex: none;
  box-shadow: 0 0 0 4px var(--dp-error-soft), 0 0 12px var(--dp-error); }
.kt.err { border-color: var(--dp-error-line);
  background: radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--dp-error) 16%, transparent), transparent 60%), var(--dp-card);
  box-shadow: 0 0 0 1px var(--dp-error-line), 0 8px 30px -12px color-mix(in srgb, var(--dp-error) 55%, transparent); }
/* Zeile "Geräte mit Warnung" unten in der Kachel "Gerade ausgefallen" (seit 1.16.0) */
.kt.offl { display: flex; flex-direction: column; }
.kt.offl .durs, .kt.offl .olist { margin-bottom: 14px; }
.kwarn { display: flex; align-items: center; gap: 8px; width: auto; margin: auto -18px -16px; padding: 11px 18px; border: none; border-top: 1px solid var(--dp-divider); background: none;
  color: var(--dp-text); font: inherit; font-size: 13.5px; text-align: left; }
button.kwarn { cursor: pointer; }
button.kwarn:hover { background: var(--dp-subtle); }
button.kwarn:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: -2px; }
.kwarn .w-ic { display: inline-flex; color: var(--dp-warning); }
.kwarn b { font-weight: 600; font-variant-numeric: tabular-nums; }
.kwarn .w-go { margin-left: auto; display: inline-flex; }
.kwarn.none { color: var(--dp-text2); }
.kwarn.none .w-ic { color: var(--dp-success); }
.kt .top { display: flex; align-items: flex-end; gap: 12px; margin: 6px 0 8px; }
.kt .top .num { font-size: 44px; font-weight: 600; line-height: 1; letter-spacing: -.03em; color: var(--dp-error); }
.kt .top .num.ok { color: var(--dp-success); }
.kt .top .lbl { font-size: 13px; color: var(--dp-text2); padding-bottom: 5px; }
.olist button { width: 100%; display: grid; grid-template-columns: 20px 1fr auto; align-items: center; gap: 8px; padding: 5px 0;
  font-size: 13.5px; border: 0; border-top: 1px solid var(--dp-divider); background: none; text-align: left; cursor: pointer; }
.olist button:hover .name { text-decoration: underline; }
.olist button > span:first-child { color: var(--dp-error); display: flex; }
.olist b { color: var(--dp-error); font-weight: 600; font-variant-numeric: tabular-nums; }
.olist .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.olist .more { color: var(--dp-text2); font-size: 12.5px; padding-top: 6px; border-top: 1px solid var(--dp-divider); }
/* Kurzfassungen für das Handy (seit 1.26.0): nur dort sichtbar, siehe @media (max-width: 600px) */
.olist .more-short, .kwarn .w-short { display: none; }

/* Ausfall-Puls: Zahl der Geräte mit Unterbruch über 24 Std. */
.kt.pul .k svg { color: var(--dp-text2); }
.pchart { position: relative; height: 84px; margin-top: 12px; }
.pchart svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.pchart .base { stroke: var(--dp-divider); stroke-width: 1; }
.pchart .area { fill: var(--dp-error-soft); }
.pchart .line { fill: none; stroke: var(--dp-error); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
/* Grün nur, wo die Kurve auf 0 liegt (seit 0.34.1). */
.pchart .line.ok { stroke: var(--dp-success); }
/* Easter Egg (seit 2.89.0): Herzschlag über dem Puls-Diagramm; das Diagramm tritt kurz zurück, die Linie wird von links aufgedeckt, dreimal */
.pchart.ee .line, .pchart.ee .area { opacity: .25; }
.ee-ecg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; animation: ee-reveal 1.85s linear 4 both, ee-fade 7.4s linear both; animation-delay: var(--ee-delay, 0s), var(--ee-delay, 0s); }
.ee-ecg path { fill: none; stroke: var(--dp-primary); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; filter: drop-shadow(0 0 4px color-mix(in srgb, var(--dp-primary) 55%, transparent)); }
.kt.ee .k svg { color: var(--dp-error); transform-origin: center; animation: ee-thump .85s ease-in-out infinite; }
/* Einrichtung (seit 2.140.1): die Rakete bebt leicht und hebt kurz ab, mit Pause dazwischen; ohne Bewegung bei reduzierter Animation */
@keyframes wz-rocket { 0%, 55%, 100% { transform: translate(0, 0) rotate(0); } 60% { transform: translate(-0.7px, 0.5px) rotate(-3deg); } 65% { transform: translate(0.7px, -0.5px) rotate(3deg); } 70% { transform: translate(-0.6px, -1px) rotate(-2deg); } 75% { transform: translate(0.6px, -1.6px) rotate(2deg); } 82% { transform: translate(0, -1.8px) rotate(0); } 90% { transform: translate(0, -0.6px) rotate(0); } }
.ap-ico.wiz svg { animation: wz-rocket 3.2s ease-in-out infinite; transform-origin: 50% 70%; }
@media (prefers-reduced-motion: reduce) { .ap-ico.wiz svg { animation: none; } }
@keyframes ee-reveal { from { clip-path: inset(-12px 100% -12px 0); } to { clip-path: inset(-12px 0 -12px 0); } }
@keyframes ee-fade { 0%, 88% { opacity: 1; } 100% { opacity: 0; } }
@keyframes ee-thump { 0%, 100% { transform: scale(1); } 15% { transform: scale(1.3); } 30% { transform: scale(1); } 45% { transform: scale(1.18); } }
/* Das Logo oben links als blaues Herz (seit 2.92.0): schlägt im Takt der Linie, drei Schläge je Durchlauf (bei 20, 53 und 86 % der 1,85 s) */
.tb-main > svg.ee-heart { overflow: visible; transform-origin: center; animation: ee-beat 1.85s ease-in-out 4 both; filter: drop-shadow(0 0 5px color-mix(in srgb, var(--dp-primary) 60%, transparent)); }
@keyframes ee-beat { 0%, 14% { transform: scale(1); } 20% { transform: scale(1.32); } 26% { transform: scale(1); } 30% { transform: scale(1.16); } 36%, 47% { transform: scale(1); } 53% { transform: scale(1.32); } 59% { transform: scale(1); } 63% { transform: scale(1.16); } 69%, 80% { transform: scale(1); } 86% { transform: scale(1.32); } 92% { transform: scale(1); } 96% { transform: scale(1.16); } 100% { transform: scale(1); } }
/* Bei "Bewegung reduzieren" (Systemeinstellung, auf dem Desktop oft an) schlägt das Herz sanfter statt gar nicht (seit 2.99.1): der Nutzer löst es selbst
   mit fünf Klicks aus, es dauert wenige Sekunden. Vorher stand es dort still und die Linie wurde nicht aufgedeckt. */
@keyframes ee-beat-soft { 0%, 14% { transform: scale(1); } 20% { transform: scale(1.12); } 26% { transform: scale(1); } 30% { transform: scale(1.06); } 36%, 47% { transform: scale(1); } 53% { transform: scale(1.12); } 59% { transform: scale(1); } 63% { transform: scale(1.06); } 69%, 80% { transform: scale(1); } 86% { transform: scale(1.12); } 92% { transform: scale(1); } 96% { transform: scale(1.06); } 100% { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .tb-main > svg.ee-heart { animation-name: ee-beat-soft; } .kt.ee .k svg { animation: none; } }
.pchart .imark { position: absolute; top: -4px; bottom: 0; width: 0; border-left: 1.5px dashed var(--dp-error); }
.pchart .imark::before { content: ""; position: absolute; top: -3px; left: -5px; width: 8px; height: 8px; border-radius: 50%;
  background: var(--dp-error); box-shadow: 0 0 0 3px var(--dp-error-soft); }
.pticks { position: relative; height: 16px; margin-top: 4px; color: var(--dp-text3); font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.pticks span { position: absolute; transform: translateX(-50%); }
.pticks .now-label { right: 0; transform: none; }
.inc { margin-top: 8px; padding: 8px 10px; border-radius: 12px; background: var(--dp-error-soft); font-size: 12.5px; line-height: 1.35; }
.inc b { display: block; color: var(--dp-error); font-weight: 600; margin-bottom: 1px; }
.pnote { margin-top: 8px; font-size: 12.5px; color: var(--dp-text2); }
/* Puls-Kachel öffnet das Fenster "Unterbrüche in 24 Std." (seit 0.26.0,
   docs/mockups/pulse-v1, A): ganze Kachel, Zusammenfassung als Link. */
.kt.pul.tap { cursor: pointer; }
.kt.pul.tap:hover { border-color: color-mix(in srgb, var(--dp-primary) 45%, var(--dp-divider)); }
.kt.pul.tap:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: 2px; }
.kt .k .kchev { display: inline-flex; margin-left: auto; }
.pnote.plink { display: flex; align-items: center; gap: 2px; color: var(--dp-primary); font-weight: 500; }
.pwin { padding: 12px 14px 8px; }
.pwin .pchart { height: 130px; }
.phit { fill: transparent; cursor: pointer; }
.phit:hover, .phit.sel { fill: color-mix(in srgb, var(--dp-error) 16%, transparent); }
.ppick { margin: 6px 0 2px; }
.ppick .chip { max-width: 100%; }
.plist { border-top: 1px solid var(--dp-divider); }
.prow { display: flex; align-items: center; gap: 12px; width: 100%; padding: 9px 4px; border: 0; border-bottom: 1px solid var(--dp-divider);
  background: none; color: var(--dp-text); font: inherit; text-align: left; cursor: pointer; }
.prow:hover { background: var(--dp-hover); }
.prow:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: -2px; }
.pname { flex: 1; min-width: 0; }
.pn { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px; font-size: 14px; }
.pname small { display: block; overflow: hidden; color: var(--dp-text2); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.pval { display: flex; flex: none; flex-direction: column; align-items: flex-end; gap: 3px; color: var(--dp-text2); font-size: 12px; white-space: nowrap; }
.pval b { color: var(--dp-error); font-weight: 600; }
.pill.sm { height: 18px; padding: 0 6px; font-size: 11px; }
/* Kopf mit Filter "Bereich" (seit 0.26.0): Auswahl hinter dem Titel. */
.kt .k .scope { min-width: 0; overflow: hidden; color: var(--dp-primary); text-overflow: ellipsis; text-transform: none; letter-spacing: 0; white-space: nowrap; }
/* Ring-Kachel: schmale Textspalte, der Bereich rutscht unter den Titel statt in den Rand. */
.kt.ring .k { flex-wrap: wrap; row-gap: 2px; }
.pnote.ok { color: var(--dp-success); }

/* Chips */
.chips { display: flex; align-items: center; gap: 8px; position: sticky; top: 44px; left: -20px; z-index: 5; margin: 0 -20px; padding: 14px 20px 12px; background: var(--dp-bg); flex-wrap: wrap; }
.chip { display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 12px; border-radius: 999px; background: var(--dp-card);
  border: 1px solid var(--dp-divider); font-size: 13px; white-space: nowrap; cursor: pointer; }
.chip .n { color: var(--dp-text2); }
.chip svg { color: var(--dp-text2); }
.chip.hint.b svg { color: var(--dp-error); }
.chip.off svg { color: var(--dp-error); }
.chip.warn svg { color: var(--dp-warning); }
.chip.hint.s svg { color: var(--dp-warning); }
.chip.hint.u svg { color: var(--dp-primary); }
.chip.hint.o svg { color: var(--dp-primary); }
.chip.hint.nw svg { color: var(--dp-success); }
/* Neu (seit 0.21.0): grün wie "online", unterscheidbar von den blauen
   Symbolen der eigenen Einstellungen. */
.new-tag { display: inline-flex; align-items: center; height: 18px; margin-left: 8px; padding: 0 6px; border-radius: 6px; vertical-align: 1px;
  background: var(--dp-success-soft); color: var(--dp-success); font-size: 11px; font-weight: 600; line-height: 1; white-space: nowrap; }
.chip.zero:not(.on) { opacity: .55; }
.chip.on { background: var(--dp-primary-soft); border-color: transparent; color: var(--dp-primary); }
.chip.on svg, .chip.on .n { color: var(--dp-primary); }
.vsep { width: 1px; height: 22px; background: var(--dp-divider); margin: 0 2px; }
.chips .chip-pin { display: contents; }

/* Filter "Bereich" (seit 0.23.0, docs/mockups/area-v1, A): Chip am Anfang
   der Zeile, Auswahl als Popover (Desktop) bzw. Blatt (Handy). */
.chip.area svg:last-child { margin-right: -3px; }
.chip.area.open:not(.on) { border-color: var(--dp-primary); }
.chip.area.on { gap: 0; padding: 0 4px 0 0; }
.area-open { display: inline-flex; align-items: center; gap: 7px; height: 100%; min-width: 0; max-width: 240px; padding: 0 6px 0 12px; border: 0;
  border-radius: 999px; background: none; color: inherit; font: inherit; cursor: pointer; }
.area-open .al { overflow: hidden; text-overflow: ellipsis; }
.area-x { flex: none; display: grid; place-items: center; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 50%;
  background: color-mix(in srgb, var(--dp-primary) 18%, transparent); color: var(--dp-primary); cursor: pointer; }
.chip.area.on .area-x svg { color: var(--dp-primary); }
.area-pop { position: fixed; z-index: 20; width: 330px; max-height: min(560px, calc(100vh - 90px)); overflow: auto; padding: 12px 8px 10px;
  border: 1px solid var(--dp-divider); border-radius: 18px; background: var(--dp-card); color: var(--dp-text); box-shadow: 0 12px 34px rgba(0,0,0,.22); }
.area-pop[hidden] { display: none; }
.area-pop h4 { margin: 0 10px 2px; font-size: 15px; font-weight: 600; }
.area-search { display: flex; align-items: center; gap: 8px; height: 36px; margin: 0 6px 6px; padding: 0 10px; border: 1px solid var(--dp-divider);
  border-radius: 10px; background: var(--dp-input); color: var(--dp-text2); }
.area-search input { flex: 1; min-width: 0; border: 0; background: none; color: var(--dp-text); font: inherit; font-size: 14px; outline: none; }
.afloor, .arow { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 36px; padding: 0 10px; border: 0; border-radius: 10px;
  background: none; color: var(--dp-text); font: inherit; font-size: 14px; text-align: left; cursor: pointer; }
.afloor { min-height: 34px; margin-top: 2px; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--dp-text2); }
.arow.in { padding-left: 22px; }
.arow.zero .al, .arow.zero .an { color: var(--dp-text3); }
.afloor:hover, .arow:hover { background: var(--dp-hover); }
.afloor:focus-visible, .arow:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: -2px; }
.afloor .al, .arow .al { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.arow .an { color: var(--dp-text3); font-size: 12px; font-variant-numeric: tabular-nums; }
.abox { flex: none; display: grid; place-items: center; width: 18px; height: 18px; border: 2px solid var(--dp-text3); border-radius: 5px; color: #fff; }
.abox.on { border-color: var(--dp-primary); background: var(--dp-primary); }
.abox.part { border-color: var(--dp-primary); background: linear-gradient(var(--dp-primary), var(--dp-primary)) center / 8px 2px no-repeat; }
.anote { margin: 8px 10px; color: var(--dp-text2); font-size: 13px; }
.afoot .vlink:disabled { color: var(--dp-text3); cursor: default; }
dialog.area-sheet .area-search { margin: 0 0 8px; height: 40px; }
dialog.area-sheet .afloor, dialog.area-sheet .arow { min-height: 44px; padding-left: 4px; padding-right: 4px; }
dialog.area-sheet .arow.in { padding-left: 16px; }

/* Ansicht pro Benutzer (docs/mockups/view-v1): Knopf "Spalten", Popover,
   Sortieren im Spaltenkopf, "Gruppen | Liste", Blatt "Ansicht" (Handy). */
.view-btn { flex: none; display: inline-flex; align-items: center; gap: 8px; height: 42px; padding: 0 16px; border-radius: 999px;
  border: 1px solid var(--dp-divider); background: var(--dp-card); color: var(--dp-text2); font: inherit; font-size: 14px; cursor: pointer; }
.view-btn:hover { background: var(--dp-hover); color: var(--dp-text); }
.view-btn.on { background: var(--dp-primary-soft); border-color: transparent; color: var(--dp-primary); }
.vsub { margin: 0 10px 8px; color: var(--dp-text2); font-size: 12px; line-height: 1.4; }
.vrow { display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 10px 0 4px; border-radius: 10px; background: var(--dp-card); font-size: 14px; }
.vrow .vl { flex: 1; min-width: 0; }
.vrow .vl small { margin-left: 6px; color: var(--dp-text3); font-size: 11px; }
.vrow.off .vl { color: var(--dp-text3); }
/* Dialog "Anpassen" wie HA (seit 0.26.0, docs/mockups/customize-v1, A):
   Auge statt Schalter, ausgeblendete grau und ohne Griff. */
.drag-h.ph { visibility: hidden; }
.eye { flex: none; display: grid; place-items: center; width: 36px; height: 36px; padding: 0; border: 0; border-radius: 50%; background: none;
  color: var(--dp-text2); cursor: pointer; }
.eye:hover { background: var(--dp-hover); color: var(--dp-text); }
.eye:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: -2px; }
.vrow.off .eye { color: var(--dp-text3); }
.eye.dis { opacity: .35; cursor: default; }
.eye.dis:hover { background: none; color: var(--dp-text2); }
dialog.settings .vrow { min-height: 44px; padding-left: 0; border-bottom: 1px solid var(--dp-divider); border-radius: 0; font-size: 14.5px; }
dialog.settings .vlist .vrow:last-child { border-bottom: 0; }
dialog.settings .vrow.lift { border-radius: 10px; }
.dlg-actions.split { justify-content: space-between; }
.dlg-actions.split .dlg-btn { flex: 0 0 auto; }
.dlg-actions.split .dlg-btn.primary { min-width: 120px; }
.dlg-btn.text { padding: 0 8px; border-color: transparent; color: var(--dp-primary); font-weight: 500; }
.vrow.lift { position: relative; z-index: 2; box-shadow: 0 4px 16px rgba(0,0,0,.25); }
.vfoot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; padding: 8px 10px 0;
  border-top: 1px solid var(--dp-divider); color: var(--dp-text2); font-size: 12px; }
.vlink { padding: 4px 0; border: 0; background: none; color: var(--dp-primary); font: inherit; font-weight: 500; cursor: pointer; }
.th-sort { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: none; color: inherit; font: inherit;
  letter-spacing: inherit; text-transform: inherit; cursor: pointer; }
.th-sort svg { opacity: 0; transition: opacity .12s; }
th:hover .th-sort svg, .th-sort:focus-visible svg { opacity: .6; }
th.sorted, th.sorted .th-sort { color: var(--dp-primary); }
th.sorted .th-sort svg { opacity: 1; }
.th-sort:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: 2px; border-radius: 4px; }
.nbad { color: var(--dp-error); font-weight: 500; }
.viewline { display: none; }
/* Kopf fixieren (seit 0.28.0, docs/mockups/fixed-v1, C; Desktop ebenfalls):
   Sind die Kacheln weggescrollt, steht oben eine Zeile (44 px), darunter die
   Chips (und auf dem Handy die Sortierung); die Kopfzeile der Tabelle klebt
   darunter (--stick-th, vom Panel gemessen). Nur die Liste scrollt. */
.hstrip { display: block; position: sticky; top: 0; left: 0; height: 0; z-index: 7; margin: 0 -20px; }
.hs-in { display: none; position: absolute; top: 0; left: 0; right: 0; height: 44px; align-items: center; gap: 8px; padding: 0 20px; border: 0;
  border-bottom: 1px solid var(--dp-divider); background: var(--dp-card); color: var(--dp-text); font: inherit; font-size: 14px; text-align: left; cursor: pointer; }
.hs-in b { font-size: 17px; font-weight: 600; }
.hs-in .e { display: inline-flex; align-items: center; gap: 6px; color: var(--dp-error); font-weight: 600; }
.hs-in .e i { width: 8px; height: 8px; border-radius: 50%; background: var(--dp-error); }
.hs-in .ok { color: var(--dp-success); font-weight: 500; }
.hs-in .scope { min-width: 0; overflow: hidden; color: var(--dp-primary); text-overflow: ellipsis; white-space: nowrap; }
.hs-in .hs-up { margin-left: auto; display: inline-flex; transform: rotate(180deg); }
.content.hs-on .hs-in { display: flex; }
.vpills { display: flex; flex-wrap: wrap; gap: 8px; }
.vpill { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border: 1px solid var(--dp-divider); border-radius: 999px;
  background: var(--dp-card); color: var(--dp-text); font: inherit; font-size: 13.5px; cursor: pointer; }
.vpill.on { background: var(--dp-primary-soft); border-color: transparent; color: var(--dp-primary); }
.vline { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; font-size: 14px; }
.vline.first { margin-top: 0; }
.vline .seg-sw button { display: inline-flex; align-items: center; gap: 4px; }
.vnote { margin-top: 6px; color: var(--dp-text2); font-size: 12px; line-height: 1.4; }
.vnote.top { margin: 0 0 6px; }

/* Tabelle als Karte. Kein overflow an der Karte: sie würde zum Scroll-
   Container, und die Kopfzeile klebte nicht mehr (siehe LEARNINGS). */
.tcard { background: var(--dp-card); border-radius: 20px; border: 1px solid var(--dp-divider); width: max-content; min-width: 100%; }
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th { position: sticky; top: var(--stick-th, 0px); z-index: 2; background: var(--dp-card); text-align: left; white-space: nowrap; padding: 14px 12px 10px;
  color: var(--dp-text2); font-size: 12px; font-weight: 500; letter-spacing: .03em; text-transform: uppercase; border-bottom: 1px solid var(--dp-divider); }
th:first-child { border-top-left-radius: 20px; padding-left: 18px; }
th:last-child { border-top-right-radius: 20px; }
td { padding: 9px 12px; border-bottom: 1px solid var(--dp-divider); vertical-align: middle; white-space: nowrap; background: var(--dp-card); }
td:first-child { padding-left: 18px; }
/* Erste Spalte fixiert; left = minus Innenabstand von .content, damit sie
   am Rand klebt und die übrigen Spalten nicht daneben durchscrollen. */
th:first-child, tr.dev td:first-child { position: sticky; left: -20px; }
th:first-child { z-index: 3; }
tr.dev td:first-child { z-index: 1; }
tbody tr:last-child td { border-bottom: 0; }
tbody tr:last-child td:first-child { border-bottom-left-radius: 20px; }
tbody tr:last-child td:last-child { border-bottom-right-radius: 20px; }
tr.dev { cursor: pointer; }
tr.dev:hover td { background: var(--dp-hover); }
tr.dev:focus-visible { outline: none; }
tr.dev:focus-visible td { background: var(--dp-hover); box-shadow: inset 0 2px 0 var(--dp-primary), inset 0 -2px 0 var(--dp-primary); }
tr.grp td { background: var(--dp-subtle); padding: 8px 18px; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--dp-text2); }
tr.grp .gl { position: sticky; left: 0; display: inline-block; }
tr.grp.e td { color: var(--dp-error); background: var(--dp-error-row); }
tr.grp.w td { color: color-mix(in srgb, var(--dp-warning) 85%, var(--dp-text)); background: var(--dp-warning-row); }
tr.grp small { font-weight: 400; text-transform: none; letter-spacing: 0; margin-left: 8px; color: var(--dp-text2); }
tr.dev.off td { background: var(--dp-error-row); }
tr.dev.off:hover td { background: color-mix(in srgb, var(--dp-error) 14%, var(--dp-card)); }
tr.dev.off td:first-child { box-shadow: inset 4px 0 0 var(--dp-error); }
tr.dev.flaky td:first-child { box-shadow: inset 4px 0 0 var(--dp-warning); }
.nc { display: flex; align-items: center; gap: 12px; }
.nc .sub, .sub { display: block; font-size: 12px; color: var(--dp-text2); margin-top: 1px; }
.av { position: relative; width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; background: var(--dp-subtle); color: var(--dp-text2); flex: none; }
.av.off { background: var(--dp-error-soft); color: var(--dp-error); }
.av.warn { background: var(--dp-warning-soft); color: var(--dp-warning); }
.av img.brand { display: block; object-fit: contain; border-radius: 4px; }
.av .dot { position: absolute; right: -3px; bottom: -3px; width: 12px; height: 12px; border-radius: 50%; border: 2.5px solid var(--dp-card); background: var(--dp-success); }
.av.off .dot { background: var(--dp-error); box-shadow: 0 0 8px var(--dp-error); }
.av.warn .dot { background: var(--dp-warning); }
.av.none .dot { background: var(--dp-text3); }
.dur { font-size: 15px; font-weight: 600; color: var(--dp-error); font-variant-numeric: tabular-nums; }
.durs { font-size: 12px; color: var(--dp-text2); }
.pill { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 9px; border-radius: 999px; font-size: 12px; font-weight: 500; white-space: nowrap; }
.pill .pd { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.pill.on { color: var(--dp-success); background: var(--dp-success-soft); }
.pill.off { color: var(--dp-error); background: var(--dp-error-soft); }
.pill.warn { color: color-mix(in srgb, var(--dp-warning) 85%, var(--dp-text)); background: var(--dp-warning-soft); }
.pill.none { color: var(--dp-text2); background: var(--dp-subtle); }
.pill.upd { color: var(--dp-primary); background: var(--dp-primary-soft); height: 19px; font-size: 11px; margin-left: 6px; }
.sig { display: inline-flex; align-items: center; gap: 6px; }
.sig .val { font-size: 12px; color: var(--dp-text2); }
.bat { display: inline-flex; align-items: center; gap: 3px; }
.bat.low { color: var(--dp-error); font-weight: 500; }
.bat.chg { color: var(--dp-success); font-weight: 600; }
/* Ladende Geräte (seit 1.35.0, docs/mockups/charging-state-v1): grüne Pille, bei gewähltem Chip Streifen und Balken. */
.pill.chg { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 999px; background: var(--dp-success-soft); color: var(--dp-success); font-size: 12px; font-weight: 600; white-space: nowrap; }
.mrow.chg { box-shadow: inset 3px 0 0 var(--dp-success); }
.chg-bar { display: block; position: relative; height: 6px; margin-top: 6px; border-radius: 3px; background: var(--dp-bar-off); overflow: hidden; }
.chg-bar i { position: absolute; inset: 0 auto 0 0; border-radius: 3px; background: var(--dp-success); }
.chg-sub { display: block; margin-top: 2px; }
/* Ziel unter 100 %: Rest schraffiert, Strich und Zahl am Ziel (die Zahl steht über dem Balken, daher Platz oben) */
.chg-bar.has-goal { overflow: visible; margin-top: 15px; }
.chg-bar i { z-index: 1; }
.chg-rest { position: absolute; top: 0; bottom: 0; right: 0; border-radius: 0 3px 3px 0; background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--dp-text) 22%, transparent) 0 3px, transparent 3px 6px); }
.chg-tick { position: absolute; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; border-radius: 1px; background: var(--dp-text); z-index: 2; }
.chg-goal { position: absolute; top: -14px; transform: translateX(-50%); font-size: 10.5px; line-height: 1; color: var(--dp-text2); white-space: nowrap; }
.st-tile .chg-bar { align-self: stretch; margin-top: 4px; }
.st-tile .chg-bar.has-goal { margin-top: 15px; }
.chip.hint.ch .ic { color: var(--dp-success); }
.chip.hint.ch.on { background: var(--dp-success-soft); border-color: var(--dp-success); color: var(--dp-success); }
/* Batterie farbig nach Stand (seit 0.24.0): Stufen wie der Empfang, rot wie
   der Text bei "schwach". */
.bat-ic.t4 { color: var(--dp-tier4); }
.bat-ic.t3 { color: var(--dp-tier3); }
.bat-ic.t2 { color: var(--dp-tier2); }
.bat-ic.t1 { color: var(--dp-error); }
.typ { display: inline-flex; align-items: center; gap: 7px; }
.typ svg { color: var(--dp-text2); }
/* Verfügbarkeit 24 Std.: 48 Abschnitte à 30 Min. */
.avc { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; font-variant-numeric: tabular-nums; }
.avc.bad { color: var(--dp-error); }
svg.strip { flex: none; display: block; }
svg.strip .s0 { fill: color-mix(in srgb, var(--dp-success) 50%, var(--dp-card)); }
svg.strip .s1 { fill: var(--dp-error); }
svg.strip .s2 { fill: var(--dp-bar-off); }
.t3 { color: var(--dp-text3); }
.note { color: var(--dp-text2); padding: 28px 18px; }
.foot { display: flex; justify-content: space-between; gap: 12px; position: sticky; left: 0; padding: 10px 6px 0; font-size: 12px; color: var(--dp-text2); }

/* Handy: Karten statt Tabelle (Design C, Bild 7 / Variante B) */
.cards .gh { margin: 14px 4px 6px; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; font-weight: 600; color: var(--dp-text2); }
.cards .gh.e { color: var(--dp-error); }
.cards .gh.w { color: color-mix(in srgb, var(--dp-warning) 85%, var(--dp-text)); }
.mc { background: var(--dp-card); border-radius: 16px; border: 1px solid var(--dp-divider); padding: 11px 12px; display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto; gap: 2px 12px; align-items: center; margin-bottom: 8px; cursor: pointer; }
.mc.off { border-color: var(--dp-error-line); background: linear-gradient(90deg, var(--dp-error-soft), transparent 70%), var(--dp-card); }
.mc.flaky { border-color: color-mix(in srgb, var(--dp-warning) 45%, transparent); background: linear-gradient(90deg, var(--dp-warning-soft), transparent 70%), var(--dp-card); }
.mc .av { width: 38px; height: 38px; }
.mc .nm { font-weight: 500; font-size: 14.5px; }
/* Einstellung pro Gerät beim Namen (docs/mockups/override-v1, A): Primärfarbe
   wie "geändert" in den Einstellungen. */
.ovrs { display: inline-flex; align-items: center; gap: 4px; margin-left: 8px; vertical-align: -2px; }
.ovr { display: inline-flex; align-items: center; gap: 2px; height: 18px; padding: 0 5px; border-radius: 6px;
  background: var(--dp-primary-soft); color: var(--dp-primary); font-size: 11px; font-weight: 500; line-height: 1; white-space: nowrap; }
.mc .sb { font-size: 12px; color: var(--dp-text2); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.mc .sb2 { font-size: 12px; color: var(--dp-text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mc .rt { text-align: right; }
.mlist { border-radius: 16px; overflow: hidden; border: 1px solid var(--dp-divider); background: var(--dp-card); }
.mrow { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 9px 12px; border-bottom: 1px solid var(--dp-divider); cursor: pointer; }
.mrow .sub { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mrow:last-child { border-bottom: 0; }
.mc:focus-visible, .mrow:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: -2px; }

/* Geräte-Popup und Statistik-Fenster: natives <dialog> (showModal) -
   Hintergrund, Esc und Fokusfalle liefert der Browser. Auf dem Handy als
   Blatt von unten. Der Dialog scrollt selbst, Kopf und Aktionsleiste
   bleiben per sticky sichtbar (wie unifi_dynamic). */
dialog.device, dialog.stat-dlg, dialog.settings, dialog.area-sheet, dialog.pulse-dlg, dialog.prompt-dlg, dialog.notes-dlg { padding: 0; border: none; border-radius: 22px; background: var(--dp-card); color: var(--dp-text);
  box-shadow: var(--dp-shadow); overflow: auto; overscroll-behavior: contain; max-height: calc(100% - 48px);
  clip-path: inset(0 round 22px); /* die eigene Scrollleiste des Dialogs liegt sonst eckig über der Rundung (rechts oben/unten) */ }
/* Schmale Scrollleiste ohne Pfeile (seit 2.29.1, Wunsch des Nutzers): die klassische Leiste mit Pfeilen sass in den runden Ecken und wurde dort
   abgeschnitten. Der Abstand oben und unten (margin) hält den Griff aus den Rundungen heraus. Firefox/Safari: dünn nach Standard. */
*::-webkit-scrollbar { width: 10px; height: 10px; }
*::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
*::-webkit-scrollbar-track { background: transparent; margin: 18px 0; }
*::-webkit-scrollbar-corner { background: transparent; }
*::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--dp-text2) 40%, transparent); border-radius: 6px; border: 2px solid transparent; background-clip: padding-box; }
*::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--dp-text2) 65%, transparent); background-clip: padding-box; }
@supports not selector(::-webkit-scrollbar) { dialog { scrollbar-width: thin; } }
/* Grosse Fenster auf dem Desktop einheitlich (seit 2.28.5, Wunsch des Nutzers): Geräte-Popup, Einstellungen, Routinen und Protokoll gleich gross */
dialog.device, dialog.settings { width: min(880px, calc(100vw - 48px)); }
dialog.area-sheet { width: min(420px, calc(100vw - 32px)); }
dialog.stat-dlg, dialog.pulse-dlg, dialog.prompt-dlg, dialog.notes-dlg { width: min(560px, calc(100vw - 32px)); }
dialog.device::backdrop, dialog.settings::backdrop, dialog.area-sheet::backdrop, dialog.pulse-dlg::backdrop, dialog.prompt-dlg::backdrop, dialog.notes-dlg::backdrop { background: rgba(0,0,0,0.5); }
/* Dialog dahinter stark gedimmt und unscharf, sein X ausgeblendet: so ist
   klar, welches Fenster gerade gilt. */
dialog.stat-dlg::backdrop { background: rgba(0,0,0,0.7); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); }
:host([stat-open]) dialog.device .dlg-head .dlg-close { visibility: hidden; }
.dlg-head { position: sticky; top: 0; z-index: 4; display: flex; align-items: flex-start; gap: 14px; padding: 20px 16px 14px 22px; background: var(--dp-card); }
.dlg-avatar { flex: none; display: grid; place-items: center; width: 52px; height: 52px; border-radius: 15px; background: var(--dp-primary-soft); color: var(--dp-primary); }
.dlg-avatar.off { background: var(--dp-error-soft); color: var(--dp-error); }
.dlg-avatar.warn { background: var(--dp-warning-soft); color: var(--dp-warning); }
.dlg-avatar.none { background: var(--dp-subtle); color: var(--dp-text2); }
.dlg-title { flex: 1 1 auto; min-width: 0; }
/* Stift am Gerätenamen im Stil der Reiter (seit 2.0.6): kleiner Kreis auf der leicht getönten Fläche statt blauem Ring; auch der Tastatur-Fokus neutral */
.dlg-title h2 .dn-edit { display: inline-grid; place-items: center; width: 28px; height: 28px; margin-left: 6px; vertical-align: middle; padding: 0; border: 0; border-radius: 50%; background: color-mix(in srgb, var(--dp-text) 7%, var(--dp-card)); color: color-mix(in srgb, var(--dp-text) 72%, transparent); cursor: pointer; transition: background .2s ease, color .2s ease; }
.dlg-title h2 .dn-edit:hover { background: color-mix(in srgb, var(--dp-text) 13%, var(--dp-card)); color: var(--dp-text); }
.dlg-title h2 .dn-edit:focus-visible { outline: 2px solid color-mix(in srgb, var(--dp-text) 45%, transparent); outline-offset: 1px; }
.dn-form { display: flex; align-items: center; gap: 6px; margin: 0 0 6px; }
.dn-input { flex: 1 1 auto; min-width: 0; height: 38px; padding: 0 12px; border: 1px solid var(--dp-primary); border-radius: 10px; background: var(--dp-bg); color: var(--dp-text); font: inherit; font-size: 16px; }
.dn-btn { flex: none; display: grid; place-items: center; width: 38px; height: 38px; padding: 0; border: 1px solid var(--dp-divider); border-radius: 50%; background: transparent; color: var(--dp-text2); cursor: pointer; }
.dn-btn.ok { border-color: var(--dp-primary); background: var(--dp-primary); color: var(--dp-on-primary, #fff); }
.dn-btn:disabled, .dn-input:disabled { opacity: .55; cursor: default; }
/* Umbenennen am Handy (seit 2.133.0): eigenes Fenster oben, damit die Tastatur das Feld nicht verdeckt */
dialog.rename-dlg { padding: 0; border: none; border-radius: 22px; background: var(--dp-card); color: var(--dp-text); box-shadow: var(--dp-shadow); width: min(480px, calc(100vw - 32px)); max-height: calc(100% - 48px); overflow: auto; clip-path: inset(0 round 22px); }
dialog.rename-dlg::backdrop { background: rgba(0,0,0,0.5); }
dialog.rename-dlg[open] { display: flex; flex-direction: column; margin: 0 auto auto; margin-top: calc(24px + env(safe-area-inset-top, 0px)); }
dialog.rename-dlg .dlg-body { padding: 4px 22px 8px; }
.rn-input { display: block; width: 100%; box-sizing: border-box; height: 52px; padding: 0 14px; border: 2px solid var(--dp-primary); border-radius: 14px; background: var(--dp-bg); color: var(--dp-text); font: inherit; font-size: 18px; }
.rn-input:disabled { opacity: .55; }
dialog.rename-dlg .dn-orig { margin: 10px 2px 4px; font-size: 14px; }
.dn-orig { margin: 0 0 6px; color: var(--dp-text2); font-size: 12.5px; }
.dlg-title h2 { margin: 2px 0 6px; font-size: 21px; font-weight: 500; overflow-wrap: anywhere; }
.dlg-sub { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; color: var(--dp-text2); font-size: 13px; }
/* Status-App (seit 2.73.0): nur der Titel, ohne Zeile darunter; er steht mittig zum Symbol */
dialog.status-dlg .dlg-title { align-self: center; }
dialog.status-dlg .dlg-title h2 { margin: 0; }
/* Kreuz, Plus und Herz im Kopf der Fenster (seit 2.56.0, Wunsch des Nutzers): wie die Knöpfe der Panel-Übersicht (.gear-btn), rund mit grauem Rand,
   gleich gross (42 px, auf dem Handy 38 px) und am rechten Rand an derselben Stelle wie das Zahnrad */
.dlg-close { flex: none; display: grid; place-items: center; width: 42px; height: 42px; border: 1px solid var(--dp-divider); border-radius: 50%;
  background: var(--dp-card); color: var(--dp-text2); cursor: pointer; }
.dlg-close:hover { background: var(--dp-hover); color: var(--dp-text); }
/* Aktionen im Kopf der Einstellungen (seit 2.116.0): runde Knöpfe wie der Schliessen-Knopf, mit einem Strich vom Schliessen-Knopf getrennt */
.dlg-acts { flex: none; display: flex; align-items: center; gap: 8px; margin-left: auto; }
.dlg-acts:empty { display: none; }
.dlg-act { flex: none; display: grid; place-items: center; width: 42px; height: 42px; padding: 0; border: 1px solid var(--dp-divider); border-radius: 50%; background: var(--dp-card); color: var(--dp-primary); cursor: pointer; }
.dlg-act:hover { background: var(--dp-hover); }
.dlg-head-log { margin-right: 8px; }
.dlg-act.run-ok { background: var(--dp-success); border-color: var(--dp-success); color: #fff; }
.dlg-act.run-err { background: var(--dp-error); border-color: var(--dp-error); color: #fff; }
.dlg-act:disabled { cursor: progress; }
.dlg-sep { flex: none; width: 1px; height: 26px; margin: 0 2px; background: var(--dp-divider); }
/* Herz im Kopf des Geräte-Popups (seit 2.22.0): wie das Kreuz ein runder Knopf, rot sobald Favorit */
.dlg-fav { flex: none; display: grid; place-items: center; width: 42px; height: 42px; margin-right: 8px; border: 1px solid var(--dp-divider); border-radius: 50%;
  background: var(--dp-card); color: var(--dp-text2); cursor: pointer; transition: color .2s ease, background .2s ease; }
/* Knopf "Neue Routine"/"Neue Meldung" unten im Fenster aller Einträge: klebt am unteren Rand, auch bei langer Liste */
.dlg-addbar { position: sticky; bottom: -24px; z-index: 2; margin: 8px 0 -24px; padding: 10px 0 20px; background: var(--dp-card); background: color-mix(in srgb, var(--dp-card) 78%, transparent); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
.dlg-addbar .mg-add { margin-top: 0; }
.dlg-fav:hover { background: var(--dp-hover); color: var(--dp-error); }
.dlg-fav.on { color: var(--dp-error); }
.dlg-fav:focus-visible { outline: 2px solid var(--dp-error); outline-offset: 1px; }
/* Chip "Favoriten": nur das rote Herz, schmal (kein Text, keine Zahl) */
.chip.hint.fv.bare { flex: none; box-sizing: border-box; gap: 0; padding: 0; width: 42px; justify-content: center; }
.chip.hint.fv svg { color: var(--dp-error); }
.chip.hint.fv.on { background: var(--dp-error-soft); border-color: var(--dp-error); }
.dlg-quick { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 22px 14px; }
.qbtn { display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 14px; border-radius: 99px; border: 1px solid var(--dp-divider);
  background: none; color: var(--dp-text); font-size: 13px; cursor: pointer; }
.qbtn svg { color: var(--dp-text2); flex: none; }
.qbtn:hover { background: var(--dp-hover); }
.dlg-body { padding: 4px 22px 18px; }
.dlg-body h3 { display: flex; align-items: center; gap: 8px; margin: 18px 0 8px; font-size: 12px; font-weight: 500; color: var(--dp-text2);
  text-transform: uppercase; letter-spacing: .05em; }
.h3-count { padding: 0 7px; border-radius: 99px; background: var(--dp-subtle); letter-spacing: 0; }
.dlg-note { margin: 8px 0; color: var(--dp-text2); font-size: 14px; }
.dlg-note.small { font-size: 12px; color: var(--dp-text3); }
.dlg-error { margin: 8px 0; padding: 10px 12px; border-radius: 10px; background: var(--dp-error-soft); color: var(--dp-error); font-size: 14px; }
.dlg-actions { position: sticky; bottom: 0; z-index: 4; display: flex; gap: 8px; padding: 14px 22px calc(16px + env(safe-area-inset-bottom, 0px));
  background: var(--dp-card); border-top: 1px solid var(--dp-divider); }
.dlg-btn { flex: 1 1 auto; display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 42px; padding: 0 18px;
  border-radius: 12px; border: 1px solid var(--dp-divider); background: none; font-size: 14px; cursor: pointer; }
.dlg-btn:hover { background: var(--dp-hover); }
.dlg-btn.primary { border-color: var(--dp-primary); background: var(--dp-primary); color: var(--dp-on-primary, #fff); font-weight: 500; }
.dlg-btn.primary:hover { background: color-mix(in srgb, var(--dp-primary) 88%, #000); }
.dlg-btn:disabled { opacity: .45; cursor: default; }
/* Rückfrage "Änderungen verwerfen?" (seit 2.20.0): eigenes modales Fenster in der Mitte, über jedem anderen Fenster */
dialog.discard-dlg { padding: 0; border: none; background: transparent; overflow: visible; max-width: calc(100vw - 32px); color: var(--dp-text); }
dialog.discard-dlg::backdrop { background: rgba(0,0,0,0.55); }
.dd-card { width: min(340px, calc(100vw - 32px)); box-sizing: border-box; padding: 20px 20px 16px; border-radius: 18px; background: var(--dp-card); box-shadow: 0 10px 40px rgba(0,0,0,0.45); border: 1px solid var(--dp-divider); text-align: center; }
.dd-card b { display: block; font-size: 17px; font-weight: 600; }
.dd-card small { display: block; margin-top: 6px; color: var(--dp-text2); font-size: 13.5px; line-height: 1.45; }
.dd-btns { display: flex; gap: 8px; margin-top: 16px; }
.dd-btns .dlg-btn { flex: 1 1 0; min-width: 0; }
.set-count { align-self: center; color: var(--dp-text2); font-size: 12px; white-space: nowrap; }
.set-count:empty { display: none; }
.set-count.saved { color: var(--dp-success); font-weight: 500; }

/* Einstellungen: aufklappbare Abschnitte (wie unifi_dynamic) */
.set-sec { margin-top: 10px; border: 1px solid var(--dp-divider); border-radius: 14px; overflow: hidden; overflow: clip; scroll-margin-top: var(--set-head-h, 0px); }
/* Aufgeklappte Gruppe (seit 2.97.0): die Kopfzeile bleibt unter dem Dialog-Kopf haften, bis die Gruppe zu Ende ist und die nächste sie wegschiebt.
   "overflow: clip" rundet die Ecken wie "hidden", macht die Gruppe aber nicht zum Scroll-Behälter (sonst klebt nichts). */
.set-sec.open > .set-sec-head { position: sticky; top: var(--set-head-h, 0px); z-index: 3; }
.set-sec-head { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 14px; border: none; background: none; text-align: left; cursor: pointer; }
.set-sec-head > span:not(.cbtn) { flex: 1 1 auto; min-width: 0; }
.set-sec-head:hover { background: var(--dp-hover); }
.set-sec-head > .cbtn { transition: transform .15s; }
.set-sec.open .set-sec-head > .cbtn { transform: rotate(180deg); }
.set-sec-title { display: flex; align-items: center; gap: 8px; font-weight: 500; }
.set-sec-sum { display: block; margin-top: 1px; overflow: hidden; color: var(--dp-text2); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.set-badge { margin-left: 8px; padding: 0 8px; border-radius: 99px; background: var(--dp-primary-soft); color: var(--dp-primary); font-size: 11px; font-weight: 400; }
.set-sec-title .set-badge { margin-left: 0; }
.set-sec-body { padding: 2px 14px 10px; border-top: 1px solid var(--dp-divider); }
/* Offener Abschnitt: Sonst sieht man in langen Abschnitten kaum, wo man ist.
   Getönte Flächen im Inhalt (Info, "Alle", Typ-Symbol) eine Stufe dunkler,
   damit sie sich vom getönten Grund abheben. */
.set-sec.open { border-color: color-mix(in srgb, var(--dp-text) 26%, transparent); background: var(--dp-sec-open); }
.set-sec.open .set-sec-head { background: var(--dp-sec-head); }
.set-sec.open .set-sec-head:hover { background: color-mix(in srgb, var(--dp-text) 12.5%, var(--dp-card)); }
.set-sec.open .set-sec-title { font-weight: 600; }
.set-sec.open .set-sec-body { border-top-color: color-mix(in srgb, var(--dp-text) 16%, transparent); }
.set-sec.open .opt-info, .set-sec.open .ex-row.ex-all, .set-sec.open .ibadge.has-img { background: var(--dp-subtle); }
.ibadge img { display: block; object-fit: contain; border-radius: 4px; }
.ibadge.type { background: var(--dp-sec-head); }
.opt { padding: 10px 0; border-bottom: 1px solid var(--dp-divider); }
.opt:last-child { border-bottom: none; }
.opt-line { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 36px; }
.opt-label { display: inline-flex; align-items: center; gap: 2px; min-width: 0; }
/* KI-Einschätzung im Geräte-Popup (Punkt 10) */
.ai-box { display: flex; flex-direction: column; gap: 8px; margin-top: 18px; overflow: hidden; border: 1.5px solid color-mix(in srgb, #7c4dff 55%, var(--dp-divider)); border-radius: 18px;
  background: color-mix(in srgb, #7c4dff 7%, var(--dp-card)); }
.ai-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: color-mix(in srgb, #7c4dff 20%, var(--dp-card)); color: var(--dp-text); }
.ai-head svg { flex: none; color: #7c4dff; }
.ai-head .cbtn { border-color: #7c4dff; background: color-mix(in srgb, #7c4dff 18%, transparent); color: #7c4dff; }
.dlg-body .ai-head h3 { margin: 0; font-size: 14px; font-weight: 600; letter-spacing: 0; text-transform: none; color: inherit; }
button.ai-head { width: 100%; border: 0; font: inherit; text-align: left; cursor: pointer; }
button.ai-head:focus-visible { outline: 2px solid #7c4dff; outline-offset: -2px; }
.ai-chev { flex: none; display: grid; place-items: center; margin-left: 6px; color: var(--dp-text2); transition: transform .2s; }
.ai-head small + .ai-chev { margin-left: 8px; }
.ai-head h3 + .ai-chev { margin-left: auto; }
.ai-box:not(.fold) .ai-chev { transform: rotate(180deg); }
.ai-box.fold > .ai-head { margin-bottom: 0; }
@media (prefers-reduced-motion: reduce) { .ai-chev { transition: none; } }
.ai-head small { margin-left: auto; min-width: 0; color: var(--dp-text2); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ai-box > :not(.ai-head):not(.ai-card):not(.ai-ask) { margin-left: 14px; margin-right: 14px; }
.ai-box > .ai-btn { margin-top: 4px; }
.ai-box > :last-child:not(.ai-ask) { margin-bottom: 12px; }
.ai-btn { align-self: flex-start; }
.ai-btn svg { color: #7c4dff; }
.ai-card { padding: 4px 14px 0; border: 0; background: transparent; }
.ai-title { display: flex; align-items: center; gap: 6px; font-weight: 600; }
.ai-title svg, .ai-wait svg { flex: none; color: #7c4dff; }
.ai-text { margin-top: 6px; line-height: 1.45; white-space: pre-line; }
.ai-foot { margin-top: 8px; color: var(--dp-text2); font-size: 12px; }
.ai-wait { display: flex; align-items: center; gap: 8px; color: var(--dp-text2); animation: ai-pulse 1.4s ease-in-out infinite; }
@keyframes ai-pulse { 50% { opacity: .5; } }
/* Rückfragen (seit 2.48.0, docs/mockups/ai-ask-v1) */
.ai-ask { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 12px 14px 14px; border-top: 1px dashed color-mix(in srgb, #7c4dff 45%, var(--dp-divider)); }
.ai-ask-lbl { color: var(--dp-text2); font-size: 12px; letter-spacing: .04em; text-transform: uppercase; }
.ai-thread { display: flex; flex-direction: column; gap: 8px; }
.ai-q { align-self: flex-end; max-width: 82%; padding: 9px 13px; border-radius: 16px 16px 4px 16px; background: color-mix(in srgb, var(--dp-primary) 22%, var(--dp-card)); overflow-wrap: anywhere; }
.ai-a { align-self: flex-start; max-width: 92%; padding: 10px 13px; border-radius: 16px 16px 16px 4px; border: 1px solid color-mix(in srgb, #7c4dff 28%, var(--dp-divider)); background: color-mix(in srgb, #7c4dff 7%, var(--dp-card)); line-height: 1.45; white-space: pre-line; overflow-wrap: anywhere; }
.ai-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.ai-chip { min-height: 34px; padding: 6px 13px; border-radius: 999px; border: 1px solid color-mix(in srgb, #7c4dff 40%, var(--dp-divider)); background: color-mix(in srgb, #7c4dff 8%, transparent); color: var(--dp-text); font: inherit; font-size: 13.5px; cursor: pointer; text-align: left; }
.ai-chip:hover { background: color-mix(in srgb, #7c4dff 16%, transparent); }
.ai-in { display: flex; gap: 8px; align-items: center; }
.ai-input { flex: 1; min-width: 0; height: 42px; box-sizing: border-box; padding: 0 14px; border-radius: 999px; border: 1px solid var(--dp-divider); background: var(--dp-card); color: var(--dp-text); font: inherit; font-size: 16px; }
.ai-input:focus-visible { outline: 2px solid #7c4dff; outline-offset: 1px; }
.ai-send { flex: none; width: 42px; height: 42px; border: 0; border-radius: 50%; display: grid; place-items: center; background: #7c4dff; color: #fff; cursor: pointer; }
.ai-send:disabled, .ai-input:disabled { opacity: .5; cursor: default; }
@media (prefers-reduced-motion: reduce) { .ai-wait { animation: none; } }
.linkbtn { padding: 0; border: none; background: none; color: var(--dp-primary); font: inherit; cursor: pointer; }
.linkbtn:hover { text-decoration: underline; }
/* Herkunft einer Einstellung im Geräte-Popup (Etikett + Standardwert) */
.opt-origin { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; margin-top: 6px; color: var(--dp-text2); font-size: 12px; line-height: 1.35; }
.origin { display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 10px; font-size: 11.5px; font-weight: 500; cursor: help; }
.origin.std { background: var(--dp-subtle); color: var(--dp-text2); }
.origin.integ { background: color-mix(in srgb, #7c4dff 16%, transparent); color: color-mix(in srgb, #7c4dff 65%, var(--dp-text)); }
.origin.own { background: var(--dp-primary-soft); color: var(--dp-primary); }
.opt-short { margin-top: 3px; color: var(--dp-text2); font-size: 12px; line-height: 1.35; }
.opt-info { margin-top: 6px; padding: 8px 10px; border-radius: 8px; background: var(--dp-subtle); color: var(--dp-text2); font-size: 12px; line-height: 1.45; }
/* Zahlenfeld mit Einheit (wie unifi_dynamic); rot bei Wert ausserhalb des Bereichs. */
.opt-input { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 6px; height: 36px; padding: 0 10px;
  border: 1px solid var(--dp-divider); border-radius: 9px; background: var(--dp-input); }
.opt-input input { width: 56px; border: none; outline: none; background: none; color: var(--dp-text); font: inherit; font-size: 14px;
  font-variant-numeric: tabular-nums; text-align: right; }
.opt-input .unit { color: var(--dp-text3); font-size: 12px; white-space: nowrap; }
.opt-input:focus-within { border-color: var(--dp-primary); }
.opt.changed > .opt-line .opt-input { border-color: var(--dp-primary); box-shadow: inset 0 0 0 1px var(--dp-primary); }
.opt.invalid > .opt-line .opt-input { border-color: var(--dp-error); box-shadow: inset 0 0 0 1px var(--dp-error); }
.opt-link { margin: -2px 0 6px; }
.set-link { display: inline-flex; align-items: center; gap: 4px; padding: 4px 0; border: 0; background: none; color: var(--dp-primary); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
.set-link:hover { text-decoration: underline; }
.opt-error { margin-top: 3px; color: var(--dp-error); font-size: 12px; line-height: 1.35; }
/* Auswahl plus Uhrzeit nebeneinander (Batterie täglich um …). */
.opt-pair { display: flex; flex: 1 1 auto; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; min-width: 0; }
.opt-pair .opt-select { flex: 0 1 190px; }
.opt-input input[type="time"] { width: auto; color-scheme: light dark; text-align: left; }
/* Fehler schlägt "geändert" (sonst bliebe das Feld im Popup blau). */
.opt-input.bad, .opt.changed > .opt-line .opt-input.bad { border-color: var(--dp-error); box-shadow: inset 0 0 0 1px var(--dp-error); }
/* Popup: Meldungen für dieses Gerät, Zeilen wie in den Einstellungen. */
.dev-set { border: 1px solid var(--dp-divider); border-radius: 14px; padding: 2px 14px; }
.dev-set .opt-sub { margin-top: 6px; }
.dev-set .opt-sub .opt-label { color: var(--dp-text2); }
/* Einstellungen: Geräte mit eigenem Wert, einzeln oder alle zurücksetzen. */
.ovr-all { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border: 1px solid var(--dp-divider);
  border-radius: 99px; background: var(--dp-card); color: var(--dp-text); font: inherit; font-size: 13px; white-space: nowrap; cursor: pointer; }
.ovr-all svg { color: var(--dp-text2); }
.ovr-all:hover:not(:disabled) { background: var(--dp-hover); }
.ovr-all:disabled { opacity: .45; cursor: default; }
.ovr-list { margin-top: 8px; overflow: hidden; border: 1px solid var(--dp-divider); border-radius: 12px; background: var(--dp-card); }
.ovr-row { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 4px 6px 4px 12px; border-bottom: 1px solid var(--dp-divider); font-size: 13.5px; }
.ovr-row:last-child { border-bottom: none; }
.ovr-name { flex: 1; min-width: 0; }
.ovr-name small { display: block; overflow: hidden; color: var(--dp-text2); font-size: 11.5px; text-overflow: ellipsis; white-space: nowrap; }
.ovr-val { color: var(--dp-primary); font-weight: 500; white-space: nowrap; }
.ovr-val s { color: var(--dp-text2); font-weight: 400; }
.ovr-row.reset .ovr-name { color: var(--dp-text2); }
/* Lange Werte (Lademeldung: mehrere eigene Werte): unter Name und Knopf, über die ganze Breite, damit der Name nicht gequetscht wird */
.ovr-row.long { flex-wrap: wrap; row-gap: 0; }
.ovr-row.long .ovr-x { order: 2; }
.ovr-row.long .ovr-val { order: 3; flex: 1 1 100%; padding: 0 0 8px; white-space: normal; }
.ovr-x { flex: none; display: grid; place-items: center; width: 32px; height: 32px; border: none; border-radius: 50%; background: none; color: var(--dp-text2); cursor: pointer; }
.ovr-x:hover { background: var(--dp-hover); color: var(--dp-text); }
.ovr-x:focus-visible, .ovr-all:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: 1px; }
/* Batterie pro Integration: Zeilen wie die Ausschlüsse, rechts Auswahl und
   bei eigener Schwelle das Feld (Variante B, docs/mockups/battery-v2). */
.opt.bat-own { border-bottom: none; padding-bottom: 2px; }
.bat-ctl { display: flex; align-items: center; gap: 8px; margin-left: auto; min-width: 0; }
.bat-ctl .opt-select { flex: 0 0 190px; }
.bat-ctl .opt-input { flex: none; }
.ex-row.bat-row .opt-input input { width: 40px; }
.ex-row.bat-row.changed .opt-input, .ex-row.bat-row.changed .opt-select select { border-color: var(--dp-primary); box-shadow: inset 0 0 0 1px var(--dp-primary); }
.ex-row.bat-row.invalid .opt-input { border-color: var(--dp-error); box-shadow: inset 0 0 0 1px var(--dp-error); }
.bat-empty { padding: 4px 0 8px; }
/* Auswahl (Push-Ziel, Klickziel) wie unifi_dynamic. */
.opt-select { position: relative; flex: 0 1 260px; min-width: 0; }
.opt-select select { width: 100%; height: 36px; padding: 0 30px 0 10px; border: 1px solid var(--dp-divider); border-radius: 9px;
  background: var(--dp-input); color: var(--dp-text); font: inherit; font-size: 14px; appearance: none; -webkit-appearance: none; text-overflow: ellipsis; }
.opt-select svg { position: absolute; top: 9px; right: 7px; color: var(--dp-text2); pointer-events: none; }
.opt-select select:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: 1px; }
.opt.changed > .opt-line .opt-select select { border-color: var(--dp-primary); box-shadow: inset 0 0 0 1px var(--dp-primary); }
/* Hinweis, wenn eine Einstellung so noch nichts bewirkt (Push ohne Ziel). */
.opt-warn { display: flex; align-items: flex-start; gap: 6px; margin-top: 6px; padding: 7px 10px; border-radius: 8px;
  background: var(--dp-warning-soft); color: color-mix(in srgb, var(--dp-warning) 80%, var(--dp-text)); font-size: 12px; line-height: 1.35; }
.opt-warn svg { flex: none; margin-top: 1px; }
.info-btn { display: inline-grid; place-items: center; width: 26px; height: 26px; padding: 0; border: none; border-radius: 50%; background: none; color: var(--dp-text3); cursor: pointer; }
.info-btn:hover, .info-btn.on { color: var(--dp-primary); }
.switch { position: relative; flex: none; width: 36px; height: 20px; }
.switch input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.switch span { position: absolute; inset: 0; border-radius: 99px; background: color-mix(in srgb, var(--dp-text) 25%, transparent); pointer-events: none; transition: background .15s; }
.switch span::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: left .15s; }
.switch input:checked + span { background: var(--dp-primary); }
.switch input:checked + span::after { left: 18px; }
.switch input:focus-visible + span { outline: 2px solid var(--dp-primary); outline-offset: 2px; }
.opt.changed .switch span { box-shadow: 0 0 0 2px var(--dp-primary-soft); }
.sw-btn { position: relative; flex: none; width: 36px; height: 20px; padding: 0; border: none; border-radius: 99px; background: color-mix(in srgb, var(--dp-text) 25%, transparent); cursor: pointer; transition: background .15s; }
.sw-btn span { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: left .15s; }
.sw-btn.on { background: var(--dp-primary); }
.sw-btn.beta.on { background: var(--dp-beta); }
.sw-btn.on span { left: 18px; }
.sw-btn:disabled { opacity: .5; cursor: default; }
.sw-btn:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: 2px; }

/* Ausschlüsse: Integrationen und Gerätetypen mit Schalter "Anzeigen" */
.ex-intro { margin: 8px 0 6px; }
.ex-head { display: flex; justify-content: space-between; padding: 6px 2px 4px; color: var(--dp-text2); font-size: 11px; font-weight: 500;
  letter-spacing: .04em; text-transform: uppercase; }
.ex-row { display: flex; align-items: center; gap: 12px; min-height: 46px; padding: 6px 2px; border-bottom: 1px solid var(--dp-divider); }
.ex-row:last-child { border-bottom: none; }
/* Griff zum Verschieben (Reihenfolge der Chips); touch-action: none, sonst
   scrollt der Finger die Seite statt die Zeile zu ziehen. */
.drag-h { flex: none; display: grid; place-items: center; width: 28px; height: 40px; margin: 0 -4px 0 -6px; border: none; border-radius: 8px;
  background: none; color: var(--dp-text3); cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
.drag-h:hover { color: var(--dp-text2); }
.drag-h:active { cursor: grabbing; }
.drag-h:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: -2px; }
.drag-list .ex-row.lift { position: relative; z-index: 2; border-radius: 10px; background: var(--dp-card); box-shadow: 0 4px 16px rgba(0,0,0,.25); }
.drag-list .ex-row:last-child { border-bottom: none; }
.drag-reset { display: flex; justify-content: flex-end; padding: 8px 0 2px; }
/* Vorschau der Chip-Leiste in den Einstellungen (seit 1.14.0) */
.fix-badge { flex: none; display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 10px; border-radius: 999px; border: 1px solid var(--dp-divider);
  background: var(--dp-card); color: var(--dp-text2); font-size: 12px; font-weight: 500; }
.chip-prev { margin: 10px 0 4px; padding: 10px 12px 12px; border: 1px solid var(--dp-divider); border-radius: 14px; background: var(--dp-bg); }
.chip-prev-t { margin: 0 0 8px; color: var(--dp-text2); font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
.chip-prev-pills { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.chip-prev-pills .chip { height: 28px; padding: 0 10px; font-size: 12.5px; pointer-events: none; }
.chip-prev-t.phone { margin-top: 12px; }
.chip-prev-pin { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 999px; background: var(--dp-primary); color: var(--dp-on-primary, #fff); }
/* isolation: Die Haftgruppe (sticky, z-index 2) bleibt in der Vorschau und deckt beim Scrollen den Dialog-Kopf nicht ab. */
.chip-prev-strip { isolation: isolate; display: flex; align-items: center; gap: 8px; overflow-x: auto; scrollbar-width: none; margin: 0 -12px; padding: 4px 12px 6px; }
.chip-prev-strip::-webkit-scrollbar { display: none; }
.chip-prev-strip .chip { flex: none; height: 28px; padding: 0 10px; font-size: 12.5px; pointer-events: none; }
.chip-prev-strip .chip-pin { position: sticky; left: -12px; z-index: 2; flex: none; display: flex; align-items: center; gap: 8px; margin-left: -12px; padding: 4px 12px; background: var(--dp-bg); }
.chip-prev-strip .chip-pin::after { content: ""; position: absolute; right: -14px; top: 0; bottom: 0; width: 14px; background: linear-gradient(90deg, rgba(0,0,0,.28), transparent); pointer-events: none; }
.ex-row.pin-line { display: block; position: relative; min-height: 0; height: 34px; padding: 0; margin: 2px 0; border: none; }
.pin-line::before { content: ""; position: absolute; left: 0; right: 0; top: 50%; border-top: 2px dashed var(--dp-primary); }
.pin-tab { position: absolute; left: 0; top: 50%; transform: translateY(-50%); display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px 0 4px;
  border-radius: 999px; background: var(--dp-primary); color: var(--dp-on-primary, #fff); font-size: 12.5px; font-weight: 600; }
.pin-tab .drag-h { width: 24px; height: 28px; margin: 0; background: none; color: rgba(255,255,255,.85); }
.pin-tab .drag-h svg { color: inherit; }
.ex-row.ex-all { padding: 6px 10px; margin: 0 -8px 2px; border: none; border-radius: 10px; background: var(--dp-subtle); color: var(--dp-text2); min-height: 40px; }
.ex-name { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
/* Suchfeld in langen Listen (seit 1.28.0) */
.list-search { display: flex; align-items: center; gap: 8px; height: 42px; margin: 8px 0 6px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--dp-divider); background: var(--dp-card); color: var(--dp-text2); }
.list-search:focus-within { border-color: var(--dp-primary); }
.list-search input { flex: 1; min-width: 0; border: 0; background: none; color: var(--dp-text); font: inherit; font-size: 15px; outline: none; }
.list-search .n { font-size: 12.5px; white-space: nowrap; }
.list-search .n:empty { display: none; }
/* Eigenes X in den Suchfeldern der Listen und der Auswahl (seit 1.35.0); das des Browsers zeigt iOS nicht. */
.list-search input::-webkit-search-cancel-button, .area-search input::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; display: none; }
.field-clear { flex: none; display: grid; place-items: center; width: 28px; height: 28px; margin-right: -6px; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--dp-text2); cursor: pointer; }
.field-clear:hover { background: var(--dp-hover); color: var(--dp-text); }
.field-clear:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: 1px; }
.field-clear[hidden] { display: none; }
.srch-rows [hidden] { display: none !important; }
/* Integrationen mit "Anzeigen", "Push", "Anhaltend" (Bild 5) */
.ex-col { flex: none; display: flex; justify-content: center; width: 72px; }
.ex-head.multi { justify-content: flex-start; }
.ex-head.multi > span:first-child { flex: 1; }
.ex-head.multi .ex-col { text-align: center; }
.ex-row .switch input:disabled + span { opacity: .35; }
.opt .switch input:disabled + span { opacity: .45; cursor: not-allowed; }
/* Auswahlspalte der Integrationen ("Typ", früher "Ausgefallen nach"): breiter als die Schalter. */
.ex-col.sel { width: 176px; }
/* Zwei Auswahl-Spalten (Typ und Verbindungsart der Integrationen, seit 2.0.4): etwas schmaler */
@media (min-width: 601px) { .ex-row:has(.ex-col.sel ~ .ex-col.sel) .ex-col.sel, .ex-head:has(.ex-col.sel ~ .ex-col.sel) .ex-col.sel { width: 150px; } }
/* Lange Erkennungstexte brechen um, statt den Schalter in eine eigene Zeile zu drängen */
.ex-row:has(.ex-col.sel) .ex-name { flex: 1 1 0; }
.ex-col.sel .opt-select { flex: 1 1 auto; }
.ex-col.sel .opt-select select { height: 34px; padding-left: 8px; font-size: 13px; }
.ex-col.sel .ex-lbl { display: none; }
.ex-col.sel .opt-select.changed select { border-color: var(--dp-primary); box-shadow: inset 0 0 0 1px var(--dp-primary); }
/* Inhalt der Meldung und Vorschau */
.nf-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 24px; margin-top: 8px; }
/* Hinweis unter den Schaltern: gilt nur für die Ausfall-Meldung, nicht für die Batterie-Warnung */
.nf-note { display: flex; gap: 8px; margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: var(--dp-subtle); color: var(--dp-text2); font-size: 12px; line-height: 1.4; }
.nf-note svg { flex: none; margin-top: 1px; color: var(--dp-primary); }
.nf-note p { margin: 0; }
.nf-note p + p { margin-top: 6px; color: var(--dp-text); }
.nf-note.view-own { margin: 12px 0 14px; }
/* Sichern und wiederherstellen (seit 2.98.0) */
.bk-note { margin: 0 0 8px; }
.bk-btns { display: flex; gap: 8px; margin: 10px 0 4px; }
.bk-btns .dlg-btn { flex: 1 1 0; }
.bk-file { cursor: pointer; width: 100%; box-sizing: border-box; }
.bk-file.disabled { opacity: .45; pointer-events: none; }
.bk-paste-toggle { display: block; margin: 10px 0 4px; }
.bk-text { box-sizing: border-box; width: 100%; margin: 6px 0; padding: 10px; border: 1px solid var(--dp-divider); border-radius: 10px; background: var(--dp-bg); color: var(--dp-text); font: 12.5px/1.4 ui-monospace, Menlo, monospace; }
.bk-sum { display: flex; gap: 8px; margin: 4px 0 10px; }
.bk-tile { flex: 1 1 0; padding: 10px 4px; border-radius: 14px; background: var(--dp-subtle); text-align: center; }
.bk-tile b { display: block; font-size: 22px; }
.bk-tile span { color: var(--dp-text2); font-size: 11.5px; }
.bk-tile .ok { color: var(--dp-success); } .bk-tile .wn { color: var(--dp-warning); }
.bk-rw { display: grid; grid-template-columns: 22px 1fr auto; gap: 8px; align-items: start; padding: 9px 0; border-top: 1px solid var(--dp-divider); font-size: 14px; }
.bk-rw:first-of-type { border-top: 0; }
.bk-rw small { display: block; margin-top: 1px; color: var(--dp-text2); font-size: 12.5px; overflow-wrap: anywhere; }
.bk-dot { width: 10px; height: 10px; margin: 5px 0 0 4px; border-radius: 50%; background: var(--dp-text3); }
.bk-dot.on { background: var(--dp-success); }
.bk-ic { display: grid; place-items: center; padding-top: 1px; }
.bk-ic.w { color: var(--dp-warning); } .bk-ic.e { color: var(--dp-error); }
.bk-badge { padding: 1px 8px; border-radius: 9px; background: var(--dp-subtle); color: var(--dp-text2); font-size: 11.5px; font-weight: 500; white-space: nowrap; }
.bk-badge.g { background: var(--dp-success-soft); color: var(--dp-success); }
.bk-badge.w { background: var(--dp-warning-soft); color: var(--dp-warning); }
.bk-badge.e { background: var(--dp-error-soft); color: var(--dp-error); }
.bk-h { margin-top: 16px; font-size: 15px; }
.bk-toggle { display: inline-block; margin-top: 4px; font-size: 13px; }
.bk-tile.go { position: relative; border: 1px solid transparent; font: inherit; color: inherit; cursor: pointer; }
.bk-tile.go::after { content: "›"; position: absolute; right: 8px; top: 4px; color: var(--dp-primary); font-size: 18px; line-height: 1; }
.bk-tile.go:hover, .bk-tile.go:focus-visible { border-color: var(--dp-primary); outline: 0; }
.bk-rw.go { cursor: pointer; }
.bk-rw.go:hover, .bk-rw.go:focus-visible { background: var(--dp-subtle); outline: 0; border-radius: 10px; }
.bk-dv { padding: 8px 0; border-top: 1px solid var(--dp-divider); font-size: 14px; overflow-wrap: anywhere; }
.bk-dv small { display: block; margin-top: 1px; color: var(--dp-text2); font-size: 12.5px; }
.bk-ent { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px !important; }
.bk-diff s { color: var(--dp-text3); } .bk-diff b { color: var(--dp-primary); font-weight: 500; }
.bk-g .bk-h { margin-top: 12px; }
.bk-devs { margin-top: 6px; padding: 2px 10px; border-radius: 12px; background: var(--dp-subtle); }
.bk-dev { padding: 7px 0; border-top: 1px solid var(--dp-divider); }
.bk-dev:first-child { border-top: 0; }
.bk-dev b { font-weight: 500; font-size: 13.5px; }
.bk-dev code { font-size: 11.5px; overflow-wrap: anywhere; }
/* Ruhezeit (seit 2.95.0): eine Zeile je Wochentag mit Schalter und zwei Uhrzeiten */
.qd-list { margin-top: 8px; }
.qd-row { display: flex; align-items: center; gap: 12px; min-height: 44px; }
.qd-name { flex: 1 1 auto; min-width: 0; font-size: 14px; }
.qd-times { display: flex; align-items: center; gap: 8px; }
.qd-sep { color: var(--dp-text2); font-size: 13px; }
.qd-row.off .qd-times { opacity: .45; }
.nf-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 36px; font-size: 14px; }
.pv { margin-top: 12px; padding: 12px; border-radius: 14px; background: var(--dp-subtle); }
.pv-k { margin-bottom: 8px; color: var(--dp-text2); font-size: 12px; }
.pv-card { padding: 10px 12px 8px; border-radius: 12px; background: var(--dp-card); box-shadow: 0 1px 4px rgba(0,0,0,.12); font-size: 13px; }
.pv-app { display: flex; align-items: center; gap: 6px; color: var(--dp-text2); font-size: 11.5px; }
.pv-title { margin-top: 4px; font-weight: 600; }
.pv-text { color: var(--dp-text); line-height: 1.35; }
.pv-actions { display: flex; gap: 18px; margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--dp-divider); color: var(--dp-primary); font-weight: 500; }
.pv .opt-short { margin-top: 8px; }
/* Emoji im Titel der Push-Meldung (seit 2.2.0): ein Feld je Meldung über der Vorschau */
.emo-box { margin-top: 12px; }
.emo-row { display: flex; align-items: center; gap: 12px; min-height: 44px; margin-top: 2px; }
.emo-l { flex: 1 1 auto; min-width: 0; font-size: 14px; }
.emo-in input { width: 72px; text-align: center; font-size: 18px; }
.emo-in input::placeholder { color: var(--dp-text3); font-size: 11px; }
.emo-row.changed .emo-in { border-color: var(--dp-primary); box-shadow: inset 0 0 0 1px var(--dp-primary); }
.emo-reset { min-width: 56px; text-align: right; }
.emo-reset[disabled] { opacity: .4; cursor: default; text-decoration: none; }
.ex-name small { display: block; color: var(--dp-text2); font-size: 12px; }
.upd-dot { display: inline-block; width: 7px; height: 7px; margin-left: 6px; border-radius: 50%; background: var(--dp-warning); vertical-align: middle; }
.ex-row.off .ex-name, .ex-row.off .ibadge { opacity: .55; }
.ibadge { flex: none; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 8px; color: #fff; font-size: 11.5px; font-weight: 600;
  background: hsl(var(--h, 200) 55% 45%); }
.ibadge.type { background: var(--dp-subtle); color: var(--dp-text2); }
/* Überwachung und Meldungen (seit 0.34.0, docs/mockups/notify-v3): Reiter,
   Zeitstrahl je Meldung, Integrationen als Liste mit Detail. */
/* Reiter als Segmentschalter (seit 2.0.5, Wunsch des Nutzers nach der Aufnahme der UniFi-App, docs/mockups/segmented-v1): eine abgerundete
   Fläche mit gleich breiten Feldern; das gewählte Feld ist die dunklere Kapsel (.seg-pill, vom Panel gesetzt, gleitet beim Wechsel) mit Akzentschrift.
   Ab fünf Reitern auf dem Handy vier Spalten (bei schmalen Handys drei), auf dem Desktop eine Zeile. */
.mon-tabs, .sub-tabs { position: relative; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 2px; margin: 10px 0 4px; padding: 3px; border-radius: 14px;
  background: color-mix(in srgb, var(--dp-text) 7%, var(--dp-card)); }
.mon-tab, .sub-tab { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; min-width: 0; min-height: 36px; padding: 0 4px; white-space: nowrap; border: none; border-radius: 11px;
  background: none; color: color-mix(in srgb, var(--dp-text) 72%, transparent); font: inherit; font-size: 13.5px; text-align: center; cursor: pointer; transition: color .22s ease; }
.mon-tab:hover, .sub-tab:hover { color: var(--dp-text); }
.mon-tab.on, .sub-tab.on { color: var(--dp-primary); font-weight: 500; }
/* Reiter mit zweiter Zeile (Geräte-Popup: "Einstellungen" mit "1 eigene", seit 2.0.10): Name etwas kleiner, darunter die Zahl klein */
.sub-tab.two { flex-direction: column; gap: 1px; line-height: 1.15; }
.sub-tab.two .tab-l { font-size: 13px; }
.sub-tab.two .tab-s { font-size: 11.5px; font-weight: 400; opacity: .8; }
.mon-tab:focus-visible, .sub-tab:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: -2px; }
/* Kapsel: gleitet mit leichtem Nachschwingen, während der Fahrt etwas durchscheinend (wie in der Aufnahme); Farbe wie der Grund der Seite (dunkler als die Fläche, im hellen Theme etwas grauer) */
.seg-pill { position: absolute; z-index: 0; left: 0; top: 0; border-radius: 11px; background: var(--dp-bg); pointer-events: none;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dp-text) 7%, transparent);
  transition: transform .46s cubic-bezier(.3, 1.35, .5, 1), width .46s cubic-bezier(.3, 1.35, .5, 1), height .46s cubic-bezier(.3, 1.35, .5, 1), opacity .46s ease; }
.seg-pill.go { opacity: .8; }
@media (prefers-reduced-motion: reduce) { .seg-pill, .mon-tab, .sub-tab { transition: none; } }
.sub-tabs { margin: 12px 0 8px; }
.sub-tabs[hidden] { display: none; }
/* Speicher (2.117.0): Gesamtbalken, Belegung je Zeile, übrige Dateien */
.sto-total { background: var(--dp-input); border-radius: 14px; padding: 12px 14px; margin: 4px 0 6px; }
.sto-big { font-size: 24px; font-variant-numeric: tabular-nums; }
.sto-big small { font-size: 13px; color: var(--dp-text2); margin-left: 4px; }
.sto-seg { display: flex; gap: 2px; height: 12px; border-radius: 6px; overflow: hidden; margin: 8px 0 6px; }
.sto-seg i { display: block; height: 100%; min-width: 3px; }
.sto-leg { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--dp-text2); }
.sto-leg span::before { content: ""; display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 5px; background: var(--c); }
.sto-seg .l1, .sto-leg .l1 { --c: #37a6ee; background: var(--c); }
.sto-seg .l2, .sto-leg .l2 { --c: #7c6cf0; background: var(--c); }
.sto-seg .l3, .sto-leg .l3 { --c: #34c26b; background: var(--c); }
.sto-seg .l4, .sto-leg .l4 { --c: #f5a30b; background: var(--c); }
.sto-seg .l5, .sto-leg .l5 { --c: #8a8d93; background: var(--c); }
.sto-leg span { background: none !important; }
.sto-meter { height: 6px; border-radius: 4px; background: rgba(127, 127, 127, 0.22); overflow: hidden; margin-top: 6px; }
.sto-meter i { display: block; height: 100%; border-radius: 4px; background: var(--dp-primary); }
.sto-meter i.w { background: #f5a30b; }
.sto-batt { margin: 10px 0 0; }
.sto-rows { margin-top: 4px; }
.sto-row { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-top: 1px solid var(--dp-divider); font-size: 14px; }
.sto-row b { font-weight: 500; font-variant-numeric: tabular-nums; white-space: nowrap; }
.sub-n { margin-left: 5px; font-size: 11.5px; font-weight: 500; color: var(--dp-text3); font-variant-numeric: tabular-nums; }
.sub-n[hidden] { display: none; }
.mon-tab.chg::after, .sub-tab.chg::after, .mon-tab.err::after { content: ""; position: absolute; top: 5px; right: 5px; width: 6px; height: 6px; border-radius: 50%; background: var(--dp-primary); }
.mon-tab.err::after { background: var(--dp-error); }
.mon-body { padding-top: 4px; }
.lnk { padding: 0; border: none; background: none; color: var(--dp-primary); font: inherit; font-size: 12.5px; font-weight: 500; cursor: pointer; }
.lnk:hover { text-decoration: underline; }
.lnk:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: 2px; border-radius: 4px; }
.lane { margin: 8px 0; padding: 10px 12px 10px; border: 1px solid var(--dp-divider); border-radius: 14px; background: var(--dp-card); }
.lane-head { display: flex; align-items: center; gap: 8px; }
.lane-ic { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; }
.lane-ic.out { background: var(--dp-error-soft); color: var(--dp-error); }
.lane-ic.bat { background: var(--dp-warning-soft); color: var(--dp-warning); }
.lane-ic.new { background: var(--dp-success-soft); color: var(--dp-success); }
.lane-ic.chg { background: color-mix(in srgb, var(--dp-tier3) 18%, transparent); color: var(--dp-tier3); }
.lane-ic.upd { background: var(--dp-primary-soft); color: var(--dp-primary); }
.lane-t { flex: 1; font-weight: 600; }
.lane-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.lane-diff { margin-top: 8px; color: var(--dp-text2); font-size: 12.5px; }
.mon-chip { display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 11px; border: 1px solid var(--dp-divider); border-radius: 14px;
  background: var(--dp-card); color: var(--dp-text2); font: inherit; font-size: 12.5px; font-weight: 500; cursor: pointer; white-space: nowrap; }
.mon-chip.on { border-color: var(--dp-primary); background: var(--dp-primary); color: var(--dp-on-primary, #fff); }
.mon-chip:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: 2px; }
.mtl { position: relative; height: 84px; margin: 8px 12px 2px; }
.mtl.mtl-e { height: 102px; }
/* Linie und Balken enden bei 80 % der Breite (seit 2.0.2): der Wert steht am Endpunkt, die letzten 20 % bleiben frei */
.mtl-bar { position: absolute; top: 20px; left: 0; right: 20%; height: 4px; border-radius: 2px; background: linear-gradient(90deg, var(--dp-error-line), var(--dp-error)); }
.mtl.mtl-b .mtl-bar { background: linear-gradient(90deg, var(--dp-warning-soft), var(--dp-warning)); }
.mtl-mk { position: absolute; top: 13px; width: 112px; transform: translateX(-50%); color: var(--dp-text2); font-size: 11px; line-height: 1.3; text-align: center; }
.mtl-mk .opt-select { display: inline-block; flex: none; width: 92px; margin-bottom: 3px; }
.mtl-mk .opt-select select { height: 30px; padding: 0 22px 0 8px; font-size: 13px; }
.mtl-mk .opt-select svg { top: 6px; right: 5px; }
.mtl-mk .opt-select.chg select { border-color: var(--dp-primary); box-shadow: inset 0 0 0 1px var(--dp-primary); }
.mtl-mk.mk-off .opt-select { display: inline-block; }
.mtl-mk i { display: block; width: 14px; height: 14px; margin: 0 auto 5px; border: 2px solid var(--dp-error); border-radius: 50%; background: var(--dp-card); box-sizing: border-box; }
.mtl.mtl-b .mtl-mk i { border-color: var(--dp-warning); }
.mtl-mk.mk-p i, .mtl.mtl-b .mtl-mk.mk-p i { border-color: var(--dp-primary); background: var(--dp-primary); }
.mtl-mk.mk-both i { border-color: var(--dp-error); background: var(--dp-primary); box-shadow: inset 0 0 0 2px var(--dp-card); }
/* Meldung aus (seit 2.0.8, Wunsch des Nutzers, docs/mockups/off-marker-v1, B): grauer Ring mit Schrägstrich statt gestricheltem Ring, der wie ein Pixelfehler aussah;
   bei den Balken (Ausfall, Neu) steht er am Ende der gestrichelten Linie */
.mtl-mk.mk-off i, .mtl.mtl-b .mtl-mk.mk-off i { position: relative; border-color: var(--dp-text3); border-style: solid; }
.mtl-mk.mk-off i::before, .ptl-row.mk-off .ptl-track i::before { content: ""; position: absolute; left: 50%; top: 50%; width: 14px; height: 2px; border-radius: 1px; background: var(--dp-text3); transform: translate(-50%, -50%) rotate(-45deg); }
.mtl-mk.mk-ghost { opacity: .55; }
.mtl-mk.mk-ghost i { border-style: dashed; }
.mtl-mk b { display: block; color: var(--dp-text); font-size: 11.5px; font-weight: 600; }
.mtl-mk > span:not(.opt-input) { display: block; }
.mtl-bar + .mtl-mk { width: 72px; }
.mtl .opt-input.mtl-in { height: 30px; margin-top: 3px; padding: 0 7px; gap: 4px; }
.mtl .opt-input.mtl-in input { width: 34px; font-size: 13.5px; text-align: right; }
.mtl .opt-input.mtl-in.chg { border-color: var(--dp-primary); box-shadow: inset 0 0 0 1px var(--dp-primary); }
.mtl .opt-input.mtl-in.bad { border-color: var(--dp-error); box-shadow: inset 0 0 0 1px var(--dp-error); }
.mtl-err { margin: 2px 0 4px; }
/* Ausfall-Zeitstrahl: zwei parallele Balken ab demselben Nullpunkt (seit 1.20.0) */
.mtl.ptl { height: auto; margin: 10px 12px 6px; padding-left: 20px; }
.ptl::before { content: ""; position: absolute; left: 4px; top: 8px; bottom: 12px; border-left: 2px dashed var(--dp-text3); opacity: .6; }
.ptl-zero { position: relative; display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
.ptl-zero::before { content: ""; position: absolute; left: -20px; top: 3px; width: 10px; height: 10px; box-sizing: border-box; border-radius: 50%; background: var(--dp-text3); }
.ptl-zero b { color: var(--dp-text); font-size: 12px; font-weight: 600; }
.ptl-zero span { color: var(--dp-text2); font-size: 11.5px; }
.ptl-row { margin-bottom: 2px; padding-bottom: 38px; }
.ptl-e .ptl-row { padding-bottom: 68px; }
.ptl-track { position: relative; height: 14px; margin: 3px 0 0 -15px; }
.ptl-track::before { content: ""; position: absolute; left: 0; top: 5px; height: 4px; width: calc(var(--w) * .8); border-radius: 2px; background: linear-gradient(90deg, var(--dp-error-line), var(--dp-error)); transition: width .15s; }
.ptl-track i { position: absolute; top: 0; left: calc(var(--w) * .8 - 14px); width: 14px; height: 14px; box-sizing: border-box; border: 2px solid var(--dp-error); border-radius: 50%; background: var(--dp-card); transition: left .15s; }
.ptl-track em { position: absolute; top: 2px; width: 10px; height: 10px; box-sizing: border-box; border: 2px dashed var(--dp-text3); border-radius: 50%; background: var(--dp-card); }
/* Wert und Beschreibung unter dem Ring, mittig am Endpunkt; bei kurzen Balken nicht über den linken Rand hinaus */
.mtl-mk.ptl-txt { top: 19px; width: 150px; left: max(calc(var(--w) * .8 - 7px), 75px); }
.ptl-txt i { display: none; }
.ptl-row.mk-p .ptl-track::before { background: linear-gradient(90deg, color-mix(in srgb, var(--dp-primary) 35%, transparent), var(--dp-primary)); }
.ptl-row.mk-p .ptl-track i { border-color: var(--dp-primary); background: var(--dp-primary); box-shadow: inset 0 0 0 2px var(--dp-card); }
.ptl-row.mk-off .ptl-track::before { height: 0; border-top: 2px dashed var(--dp-text3); background: none; top: 6px; }
.ptl-row.mk-off .ptl-track i { border-color: var(--dp-text3); }
.mtl-note { display: flex; align-items: flex-start; gap: 4px; margin: 4px 0 2px; }
/* Ein Titelstil für jedes neue Thema in den Einstellungen (seit 1.43.0): gross, mit Akzentbalken */
.mon-grp, .set-title, .ex-title { display: flex; align-items: center; gap: 10px; margin: 28px 0 8px; color: var(--dp-text); font-size: 18px; font-weight: 700; line-height: 1.25; letter-spacing: 0; text-transform: none; }
.mon-grp::before, .set-title::before, .ex-title::before { content: ""; flex: none; width: 4px; height: 1.15em; border-radius: 2px; background: var(--dp-primary); }
.dlg-body > .set-title:first-child, .mon-body > .mon-grp:first-child, .lvl-body > .set-title:first-child { margin-top: 6px; }
.mon-diff .opt-line { min-height: 28px; }
.mon-intro { margin: 6px 0 8px; }
.mon-flt { display: flex; flex-wrap: wrap; gap: 6px; }
.mon-empty { margin: 12px 0; }
.mon-hint { margin: -4px 0 8px; }
.mon-dis { opacity: .5; }
.ilist { margin-top: 10px; overflow: hidden; border: 1px solid var(--dp-divider); border-radius: 14px; background: var(--dp-card); }
.ilist-row { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 56px; padding: 8px 8px 8px 10px; border: none; border-bottom: 1px solid var(--dp-divider);
  background: none; color: var(--dp-text); font: inherit; text-align: left; cursor: pointer; }
.ilist-row:last-child { border-bottom: none; }
.ilist-row:hover { background: var(--dp-hover); }
.ilist-row:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: -2px; }
.ilist-row.changed { box-shadow: inset 3px 0 0 var(--dp-primary); }
.ilist-row > .cbtn { flex: none; }
.ilist-name { flex: 1; min-width: 0; font-size: 14px; }
.ilist-name small { display: block; color: var(--dp-text2); font-size: 12px; }
.ilist-name small.ilist-diff.own { color: var(--dp-primary); }
.ilist-name small.ilist-diff.unmon { color: var(--dp-warning); }
/* Zurück zur Liste der Integrationen (seit 2.96.1): ein echter Knopf wie "Zurück" in den Dialogen, mit Pfeil */
.iback { display: inline-flex; align-items: center; gap: 8px; height: 40px; margin: 8px 0 6px; padding: 0 16px 0 12px; border: 1px solid var(--dp-divider); border-radius: 12px; background: none;
  color: var(--dp-primary); font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; }
.iback:hover { background: var(--dp-hover); }
.iback:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: 2px; }
.ihead { display: flex; align-items: center; gap: 10px; margin: 2px 0 4px; }
.ihead .ibadge { width: 38px; height: 38px; border-radius: 10px; font-size: 13px; }
.ihead b { font-size: 16px; font-weight: 600; }
.ihead small { display: block; color: var(--dp-text2); font-size: 12.5px; }
.opt.bat-row .bat-ctl { display: flex; flex: 0 1 auto; align-items: center; gap: 8px; min-width: 0; }
.opt.bat-row .bat-ctl .opt-select { flex: 0 1 180px; }
.opt.bat-row .opt-input input { width: 40px; }
/* Empfang-Schwelle pro Funkart (seit 1.17.0): Platz für "-110" */
.opt.bat-row.sig-row .opt-input input { width: 54px; }
.opt.bat-row.sig-row .bat-ctl .opt-select { flex: 0 1 250px; }
.opt.sig-row .opt-label { white-space: nowrap; }
.sig-intro { margin-bottom: 4px; }
.opt.changed > .opt-line .bat-ctl .opt-input:not(.bad), .opt.changed > .opt-line .bat-ctl .opt-select select { border-color: var(--dp-primary); box-shadow: inset 0 0 0 1px var(--dp-primary); }
.integ-reset { margin: 14px 0 4px; }
/* Profi-Modus der KI-Einschätzung (seit 1.2.0, docs/mockups/ai-v1, A) */
.aip { margin: 4px 0 8px; }
.aip-h { font-size: 12px; letter-spacing: .05em; text-transform: uppercase; color: var(--dp-text2); margin: 8px 0 6px; }
.aip-h b { color: var(--dp-text); font-weight: 600; }
.aip-box { font: 12.5px/1.45 ui-monospace, "SF Mono", Menlo, Consolas, monospace; background: var(--dp-subtle); border: 1px solid var(--dp-divider); border-radius: 10px;
  padding: 10px 12px; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 11.5em; overflow: auto; color: var(--dp-text); }
.aip-box.ro { max-height: 22em; }
.aip-box .pv, .pv { background: color-mix(in srgb, var(--dp-primary) 14%, transparent); color: var(--dp-primary); border-radius: 4px; padding: 0 3px; font-weight: 600; }
.aip-btns { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0; }
.pr-vars { display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0; }
.pr-vars .chip { font-family: ui-monospace, "SF Mono", Menlo, monospace; color: var(--dp-primary); }
.pr-text { width: 100%; box-sizing: border-box; min-height: 14em; resize: vertical; font: 12.5px/1.45 ui-monospace, "SF Mono", Menlo, Consolas, monospace; color: var(--dp-text);
  background: var(--dp-card); border: 1px solid var(--dp-divider); border-radius: 10px; padding: 10px 12px; }
.pr-text:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: 1px; }
.pr-text.bad { border-color: var(--dp-error); }
.pr-count { text-align: right; font-size: 12px; color: var(--dp-text3); margin: 4px 0; }
.prompt-dev { margin: 8px 0; }

.mon-flt .integ-all { margin-left: auto; }
.integ-goto { margin: 10px 0 2px; }
.integ-goto .lnk { font-size: 12px; }
/* Typ im Geräte-Popup wählbar */
.typ-ro { display: inline-flex; align-items: center; gap: 8px; color: var(--dp-text); }
.typ-ro > svg { color: var(--dp-text2); }
.dev-tabs { position: sticky; top: var(--dev-head-h, 0px); z-index: 3; padding: 4px 22px 8px; background: var(--dp-card); }
/* Inhalt, der unter der Reiterzeile durchläuft, wird weich ausgeblendet statt hart abgeschnitten (kein "Kleben" der Kacheln) */
.dev-tabs::after { content: ""; position: absolute; left: 0; right: 0; top: 100%; height: 12px; background: linear-gradient(var(--dp-card), transparent); pointer-events: none; }
/* Gleiche Reiter auf allen Ebenen (seit 1.42.0): Einstellungen, Integration, Gerät */
.lvl-tabs { margin: 6px 0 10px; }
.lvl-title { margin: 12px 0 2px; font-size: 16px; font-weight: 600; color: var(--dp-text); }
.lvl-body > .mtl, .lvl-body > .ptl { margin-top: 4px; }
.dev-tabs .sub-tabs { margin: 0; }
@media (max-width: 700px) { .dev-tabs { padding: 0 16px; } }
.typ-sel { position: relative; display: inline-flex; align-items: center; gap: 6px; max-width: 100%; color: var(--dp-text); }
.typ-sel > svg:first-child { color: var(--dp-text2); }
.typ-sel select { min-width: 0; max-width: 100%; height: 30px; padding: 0 26px 0 8px; border: 1px solid var(--dp-divider); border-radius: 8px;
  background: var(--dp-card); color: var(--dp-text); font: inherit; font-size: 14px; appearance: none; -webkit-appearance: none; text-overflow: ellipsis; cursor: pointer; }
.typ-sel > svg:last-child { position: absolute; right: 4px; color: var(--dp-text2); pointer-events: none; }

/* Versionszeile oben in den Einstellungen */
.ver { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 12px; padding: 11px 12px 11px 14px; border-radius: 14px; background: var(--dp-subtle); }
/* Automatisch installieren ist aktiv: Pille "Auto" hinter dem Titel, wie die Pille "Beta" (2.38.0) */
.ver-auto { display: inline-flex; align-items: center; gap: 3px; margin-left: 6px; padding: 1px 8px 1px 6px; border-radius: 999px; background: var(--dp-primary-soft); color: var(--dp-primary); font-size: 11px; font-weight: 600; vertical-align: 1px; white-space: nowrap; }
.ver-ic { display: grid; flex: none; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: var(--dp-success-soft); color: var(--dp-success); }
.ver-t { flex: 1 1 200px; min-width: 0; }
.ver-t b { font-weight: 500; }
.ver-t small { display: block; margin-top: 1px; color: var(--dp-text2); font-size: 12px; }
.ver-btns { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.ver-btn { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 13px; border: 1px solid var(--dp-divider); border-radius: 99px;
  background: var(--dp-card); font-size: 13px; white-space: nowrap; cursor: pointer; }
.ver-btn:hover:not(:disabled) { background: var(--dp-hover); }
.ver-btn:disabled { cursor: default; }
.ver-btn.icon { justify-content: center; width: 34px; padding: 0; }
.ver-btn.primary { border-color: var(--dp-primary); background: var(--dp-primary); color: var(--dp-on-primary, #fff); font-weight: 500; }
.ver-btn.warn { border-color: var(--dp-warning); background: var(--dp-warning); color: #fff; font-weight: 500; }
/* Hover darf die Farbe der Hauptknöpfe nicht durch Grau ersetzen. */
.ver-btn.primary:hover:not(:disabled) { background: color-mix(in srgb, var(--dp-primary) 88%, #000); }
.ver-btn.warn:hover:not(:disabled) { background: color-mix(in srgb, var(--dp-warning) 88%, #000); }
button.ver-link { border: none; background: none; font: inherit; font-size: 13px; cursor: pointer; }
.ver-link { display: inline-flex; align-items: center; gap: 5px; padding: 0 6px; color: var(--dp-primary); font-size: 13px; text-decoration: none; white-space: nowrap; }
.ver.upd { background: color-mix(in srgb, var(--dp-primary) 10%, var(--dp-subtle)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dp-primary) 35%, transparent); }
.ver.upd .ver-ic { background: var(--dp-primary-soft); color: var(--dp-primary); }
.ver.beta { background: color-mix(in srgb, var(--dp-beta) 10%, var(--dp-subtle)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dp-beta) 40%, transparent); }
.ver.beta .ver-ic { background: color-mix(in srgb, var(--dp-beta) 20%, transparent); color: var(--dp-beta); }
.ver.beta .ver-btn.primary { border-color: var(--dp-beta); background: var(--dp-beta); }
.ver.beta .ver-btn.primary:hover:not(:disabled) { background: color-mix(in srgb, var(--dp-beta) 88%, #000); }
.ver.beta .ver-btn.primary:disabled { opacity: .45; }
.ver-tag { display: inline-block; margin-left: 4px; padding: 0 7px; border-radius: 999px; background: color-mix(in srgb, var(--dp-beta) 20%, transparent);
  color: var(--dp-beta); font-size: 11px; font-weight: 500; vertical-align: 1px; }
.ver-hint { flex: 1 1 100%; padding: 9px 11px; border-radius: 10px; background: var(--dp-warning-soft); color: color-mix(in srgb, var(--dp-warning) 80%, var(--dp-text));
  font-size: 12.5px; line-height: 1.4; }
.ver-hint-acts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin-top: 8px; }
.ver-hint-acts .ver-btn { color: var(--dp-text); }
.ver-hint-err { margin-top: 6px; color: var(--dp-error); }
.ver-hint-link { padding: 0; border: none; background: none; color: inherit; font-weight: 500; text-decoration: underline; cursor: pointer; }
.ver-opt { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 8px; padding: 2px 4px 0 14px; }
.ver-opt-l { font-size: 14px; }
.ver-opt-d { color: var(--dp-text2); font-size: 12px; }
.ver.rst { background: color-mix(in srgb, var(--dp-warning) 12%, var(--dp-subtle)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dp-warning) 35%, transparent); }
.ver.rst .ver-ic { background: var(--dp-warning-soft); color: var(--dp-warning); }
.ver.err .ver-ic { background: var(--dp-warning-soft); color: var(--dp-warning); }
.ver-spin { flex: none; box-sizing: border-box; width: 16px; height: 16px; border: 2px solid color-mix(in srgb, currentColor 30%, transparent);
  border-top-color: currentColor; border-radius: 50%; animation: ver-spin .8s linear infinite; }
@keyframes ver-spin { to { transform: rotate(360deg); } }
.ver-prog { flex: 1 1 100%; height: 4px; overflow: hidden; border-radius: 99px; background: var(--dp-primary-soft); }
.ver-prog i { display: block; width: 35%; height: 100%; border-radius: 99px; background: var(--dp-primary); animation: ver-prog 1.4s ease-in-out infinite; }
@keyframes ver-prog { from { transform: translateX(-100%); } to { transform: translateX(300%); } }
@media (prefers-reduced-motion: reduce) { .ver-spin, .ver-prog i { animation: none; } }

/* Kurze Rückmeldung nach dem Speichern */
.toast { position: fixed; left: 50%; bottom: calc(20px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 10; padding: 10px 16px;
  border-radius: 10px; background: #323232; color: #fff; font-size: 14px; box-shadow: 0 6px 18px rgba(0,0,0,.35); }
.toast[hidden] { display: none; }
/* Hinweis mit Aktion (Rückgängig nach dem Ausblenden, seit 0.23.0). */
.toast.act { display: flex; align-items: center; gap: 14px; width: max-content; max-width: calc(100vw - 32px); padding: 6px 8px 6px 16px; }
.toast.act[hidden] { display: none; }
.toast-btn { flex: none; height: 32px; padding: 0 10px; border: 0; border-radius: 8px; background: none; color: #8ecbff; font: inherit; font-weight: 600; cursor: pointer; }
.toast-btn:hover { background: rgba(255,255,255,.1); }
/* Zwei gleich breite Knöpfe; passt der Text nicht nebeneinander (schmales
   Handy), stehen sie untereinander statt umzubrechen. */
.dlg-actions.two { flex-wrap: wrap; }
.dlg-actions.two .dlg-btn { flex: 1 1 0; min-width: max-content; padding: 0 14px; white-space: nowrap; }
.hide-btn svg { color: var(--dp-text2); }

/* Statistik-Kacheln: Tipp öffnet das Statistik-Fenster */
.st-tiles { display: grid; grid-template-columns: repeat(var(--n, 4), minmax(0, 1fr)); gap: 8px; }
.st-tile { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; min-width: 0; padding: 10px 11px;
  border: 1px solid var(--dp-divider); border-radius: 14px; background: var(--dp-subtle); text-align: left; cursor: pointer; }
.st-tile:hover { border-color: color-mix(in srgb, var(--dp-primary) 50%, transparent); }
.st-tile.static { cursor: default; }
/* Grund der Warnung (seit 1.27.0): Marken im Kopf, gelber Rahmen und Punkt an der Kachel */
.why-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.why { display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 0 11px; border-radius: 999px; font-size: 13px;
  border: 1px solid color-mix(in srgb, var(--dp-warning) 45%, transparent); background: var(--dp-warning-soft); }
.why svg { color: var(--dp-warning); flex: none; }
.why b { font-weight: 600; }
.st-tile.warned { border-color: var(--dp-warning); box-shadow: 0 0 0 1px var(--dp-warning) inset; background: color-mix(in srgb, var(--dp-warning) 10%, var(--dp-card)); }
.st-tile.warned::after { content: ""; position: absolute; top: 8px; right: 10px; width: 9px; height: 9px; border-radius: 50%; background: var(--dp-warning); }
.st-tile.static:hover { border-color: var(--dp-divider); }
.st-tile > .chev { position: absolute; right: 10px; bottom: 10px; }
.st-k { max-width: 100%; overflow: hidden; color: var(--dp-text2); font-size: 12px; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }
.st-v { display: inline-flex; align-items: center; gap: 6px; font-size: 18px; font-weight: 500; font-variant-numeric: tabular-nums; white-space: nowrap; }
.st-v small { color: var(--dp-text2); font-size: 12px; font-weight: 400; }
.st-v.bad { color: var(--dp-error); }
.st-sub { max-width: calc(100% - 14px); color: var(--dp-text3); font-size: 11.5px; line-height: 1.3; }

/* Angaben als Kacheln */
.tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.tile { min-width: 0; padding: 9px 12px 10px; border-radius: 12px; background: var(--dp-subtle); }
.tile-k { color: var(--dp-text2); font-size: 12px; min-height: 18px; }
.tile-v { margin-top: 2px; font-size: 14px; overflow-wrap: anywhere; }
.tile-v small { display: block; color: var(--dp-text3); font-size: 12px; }
.tile-v small.warn { color: var(--dp-warning); }
.tile-v small.upd { color: var(--dp-primary); }
.tile-v .sig, .tile-v .typ { gap: 6px; }

/* Entitäten */
.entities { list-style: none; margin: 0; padding: 0; border-radius: 14px; background: var(--dp-subtle); overflow: hidden; }
.entities li + li { border-top: 1px solid var(--dp-divider); }
.entities li.entity { display: flex; align-items: center; gap: 10px; padding: 10px 14px; font-size: 14px; cursor: pointer; }
.entities li.entity:hover { background: var(--dp-hover); }
.entities li.entity:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: -2px; }
.ent-name { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
.ent-name small { display: block; color: var(--dp-text3); font-size: 12px; }
.ent-name small.cat { display: inline; margin-left: 6px; }
.pill.live { height: 19px; font-size: 11px; color: var(--dp-primary); background: var(--dp-primary-soft); }
.ent-state { flex: none; max-width: 45%; text-align: right; overflow-wrap: anywhere; }
.ent-copy { flex: none; display: grid; place-items: center; width: 32px; height: 32px; margin: -4px -6px -4px 0; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--dp-text2); cursor: pointer; }
.ent-copy:hover { background: var(--dp-hover); color: var(--dp-text); }
.ent-copy:focus-visible { outline: 2px solid var(--dp-primary); }
.ent-copy.done { color: var(--dp-success); }
.dl-list { margin-bottom: 4px; }
.entities li.dl-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; font-size: 14px; cursor: pointer; }
.entities li.dl-row:hover { background: var(--dp-hover); }
.entities li.dl-row:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: -2px; }
.dl-row .ent-name small { overflow-wrap: anywhere; }
.dl-ic { flex: none; display: grid; place-items: center; width: 32px; height: 32px; margin: -4px -6px -4px 0; color: var(--dp-text2); }
.dl-ic.done { color: var(--dp-success); }
.ent-state.bad { color: var(--dp-error); }

/* Statistik-Fenster */
.stat-head { align-items: center; }
.stat-head .dlg-avatar { width: 44px; height: 44px; border-radius: 13px; }
/* Sechs Zeiträume (Batterie, seit 0.29.0) passen auf dem Handy nicht nebeneinander:
   die Auswahl scrollt seitlich, der gewählte Zeitraum wird ins Bild geholt. */
.stat-range { display: flex; margin: 0 0 12px; max-width: 100%; overflow-x: auto; scrollbar-width: none; }
.stat-range::-webkit-scrollbar { display: none; }
.stat-range .seg-sw { flex: none; }
.seg-sw { display: inline-flex; padding: 2px; border-radius: 99px; background: var(--dp-subtle); }
.seg-sw button { height: 28px; padding: 0 12px; border: none; border-radius: 99px; background: none; color: var(--dp-text2); font-size: 12.5px; white-space: nowrap; cursor: pointer; }
.seg-sw button.on { background: var(--dp-card); color: var(--dp-text); box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
.avail { padding: 12px 14px 10px; border-radius: 14px; background: var(--dp-subtle); }
.avail .dlg-note { margin: 0; }
.avail-top { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin-bottom: 12px; }
.avail-pct { font-size: 22px; font-weight: 500; font-variant-numeric: tabular-nums; }
.avail-pct small { margin-left: 2px; color: var(--dp-text2); font-size: 14px; font-weight: 400; }
.avail-facts { color: var(--dp-text2); font-size: 13px; }
.avail-facts b { color: var(--dp-error); font-weight: 500; }
.avail-barwrap { position: relative; }
.avail-bar { position: relative; height: 22px; border-radius: 6px; overflow: hidden; background: color-mix(in srgb, var(--dp-text) 12%, var(--dp-card)); }
.avail-bar .seg { position: absolute; top: 0; bottom: 0; }
.avail-bar .seg.on, .avail-legend i.on { background: color-mix(in srgb, var(--dp-success) 28%, var(--dp-card)); }
/* Über den Nachbarn, auch wenn die Mindestbreite überlappt. */
.avail-bar .seg.off { z-index: 1; min-width: 3px; background: color-mix(in srgb, var(--dp-error) 45%, var(--dp-card));
  box-shadow: inset 0 -3px 0 var(--dp-error); cursor: pointer; }
.avail-legend i.off { background: color-mix(in srgb, var(--dp-error) 45%, var(--dp-card)); box-shadow: inset 0 -2px 0 var(--dp-error); }
.avail-bar .seg.none, .avail-legend i.none { background: repeating-linear-gradient(45deg, color-mix(in srgb, var(--dp-text) 18%, var(--dp-card)) 0 4px, transparent 4px 8px); }
.avail-bar .seg.hover { background: color-mix(in srgb, var(--dp-error) 70%, var(--dp-card)); }
/* Batterie-Verlauf (seit 0.22.0): Fläche und Linie in Primärfarbe, Achse
   0–100 %, Schwelle rot gestrichelt, Wechsel als senkrechte Linie. */
.bh-plot { position: relative; height: 190px; margin: 6px 0 0 44px; }
.bh-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.bh-grid { stroke: var(--dp-divider); stroke-width: 1; }
.bh-thr { stroke: var(--dp-error); stroke-width: 1.2; stroke-dasharray: 5 4; }
.bh-chg { stroke: var(--dp-text3); stroke-width: 1; stroke-dasharray: 3 3; }
.bh-area { fill: color-mix(in srgb, var(--dp-primary) 18%, transparent); }
.bh-line { fill: none; stroke: var(--dp-primary); stroke-width: 2; stroke-linejoin: round; }
.bh-y { position: absolute; left: -44px; width: 38px; transform: translateY(-50%); text-align: right; color: var(--dp-text3); font-size: 11px; }
.bh-thr-l { position: absolute; left: 6px; margin-bottom: 2px; padding: 0 4px; border-radius: 4px; color: var(--dp-error); font-size: 11.5px;
  background: color-mix(in srgb, var(--dp-subtle) 85%, transparent); }
.bh-chg-l { position: absolute; top: -2px; margin-left: 5px; color: var(--dp-text2); font-size: 11.5px; }
.bh-dot { position: absolute; right: -5px; width: 10px; height: 10px; border-radius: 50%; transform: translateY(-50%); background: var(--dp-primary);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--dp-primary) 25%, transparent); }
.bh-ticks { margin-left: 44px; }
.bh .avail-list { margin-top: 10px; }
/* Empfang (seit 0.24.0): Spanne aus der eigenen Aufzeichnung als Fläche. */
.sg-band { fill: color-mix(in srgb, var(--dp-primary) 16%, transparent); }
.sg-cur { display: inline-flex; align-items: center; gap: 8px; }
.sg-cur svg { width: 22px; height: 16px; }
.avail-legend i.sg-med { height: 3px; border-radius: 2px; background: var(--dp-primary); vertical-align: 3px; }
.avail-legend i.sg-span { background: color-mix(in srgb, var(--dp-primary) 22%, transparent); }
.bh .avail-list .d { color: var(--dp-text2); }
.bh-src { margin: 10px 2px 0; }
.sv { margin: 12px 0 4px; padding: 12px 14px; border-radius: 14px; background: var(--dp-subtle); }
.sv h3 { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: var(--dp-text); }
.sv-bar { display: flex; height: 14px; border-radius: 7px; overflow: hidden; background: color-mix(in srgb, var(--dp-text) 8%, transparent); }
.sv-bar i { display: block; height: 100%; flex: none; }
.sv-bar i.none { background: transparent; }
.sv-bar i.gap { background: repeating-linear-gradient(135deg, transparent 0 4px, color-mix(in srgb, var(--dp-text) 14%, transparent) 4px 5px); }
/* Balken und Zeitmarken auf der Breite des Diagramms darüber ("Empfang"): links 14 (Rahmen) + 44 (Achse) - 2 (Rand von .sv), rechts 14 - 2 */
.sv-bar, .sv-ticks { margin-left: 56px; margin-right: 12px; }
/* ohne Verlauf darüber (keine Messwerte) über die ganze Breite */
.sv-full .sv-bar, .sv-full .sv-ticks { margin-left: 0; margin-right: 0; }
.sv-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 8px; }
.sv-top h3 { margin: 0; }
.sv-top small { color: var(--dp-text3); font-size: 11.5px; }
.sv-leg { margin-top: 6px; }
.sv-row { display: flex; align-items: flex-start; gap: 10px; padding: 9px 0; border-top: 1px solid var(--dp-divider); }
.sv-row:first-child { border-top: 0; }
.sv-row .sv-dot { margin-top: 5px; }
.sv-row .sv-dot.none { background: var(--dp-subtle); }
.sv-nm { flex: 1; min-width: 0; font-size: 14px; }
.sv-nm b { font-weight: 500; overflow-wrap: anywhere; }
.sv-nm small { display: block; margin-top: 1px; color: var(--dp-text2); font-size: 12.5px; font-variant-numeric: tabular-nums; }
.sv-row.off .sv-nm small { color: var(--dp-text3); }
.sv-ok, .sv-far { margin-left: 6px; font-size: 11.5px; font-weight: 500; white-space: nowrap; }
.sv-ok { color: var(--dp-success); }
.sv-far { color: var(--dp-warning); cursor: help; }
.sv-sh { flex: none; text-align: right; font-variant-numeric: tabular-nums; }
.sv-sh b { display: block; font-weight: 500; font-size: 14px; }
.sv-sh small { color: var(--dp-text2); font-size: 12px; white-space: nowrap; }
.sv-dot { flex: none; width: 10px; height: 10px; border-radius: 50%; }
.sv-chg { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--dp-divider); }
.sv-chg h4 { margin: 0 0 6px; font-size: 12px; font-weight: 600; color: var(--dp-text2); letter-spacing: 0.04em; text-transform: uppercase; }
.sv-chg p { margin: 0; padding: 5px 0; font-size: 13px; display: flex; gap: 8px; align-items: baseline; }
.sv-chg p span { flex: none; min-width: 92px; white-space: nowrap; color: var(--dp-text2); font-size: 12px; }
.sg-stats { display: grid; gap: 8px; margin-bottom: 10px; }
.sg-tile { padding: 9px 12px; border-radius: 14px; background: var(--dp-subtle); }
.sg-tile small { display: block; color: var(--dp-text2); font-size: 11.5px; white-space: nowrap; }
.sg-tile small u { text-decoration: none; color: var(--dp-text3); }
.sg-tile b { display: flex; align-items: center; gap: 6px; font-size: 18px; font-weight: 400; font-variant-numeric: tabular-nums; white-space: nowrap; }
.sg-tile.now b { font-size: 24px; font-weight: 500; }
.sg-tile.now small.lim { margin-top: 1px; }
.sg-tile.weak small.lim { color: var(--dp-warning); }
.sg-row3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.sg-info { margin-top: 2px; }
.sg-info[hidden] { display: none; }
.sg-i { margin-left: auto; border: 0; background: none; color: var(--dp-primary); font: inherit; font-size: 16px; line-height: 1; padding: 2px 4px; cursor: pointer; }
.sg-i[aria-expanded="true"] { color: var(--dp-text); }
.sv-note { margin: 8px 0 0; color: var(--dp-text2); font-size: 12px; line-height: 1.4; }
.bh-fc { margin: 12px 0 6px; padding: 12px 14px; border-radius: 12px; background: var(--dp-bg); border-left: 3px solid var(--dp-success); }
.bh-fc.muted { border-left-color: var(--dp-subtle); }
.bh-fc.warn, .bh-fc.accel { border-left-color: var(--dp-warning); }
.bh-fc-h { font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--dp-text2); }
.bh-fc-main { font-size: 20px; font-weight: 500; margin-top: 2px; }
.bh-fc-sub { margin: 2px 0 0; color: var(--dp-text2); font-size: 13px; }
.bh-fc-meta { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 8px; font-size: 13px; color: var(--dp-text2); align-items: center; }
.bh-fc-conf { padding: 1px 8px; border-radius: 999px; border: 1px solid currentColor; font-size: 12px; }
.bh-fc-conf.high { color: var(--dp-success); }
.bh-fc-conf.medium { color: var(--dp-warning); }
.bh-fc-conf.low { color: var(--dp-error); }
.bh-fc-basis { margin: 6px 0 0; font-size: 12px; color: var(--dp-text3); }
.bh-fc-warn { margin: 6px 0 0; font-size: 13px; color: var(--dp-warning); }
.bh-fc-note { margin: 6px 0 0; font-size: 11px; color: var(--dp-text3); }
.avail-now { position: absolute; top: 0; right: 0; bottom: 0; width: 2px; background: var(--dp-text); }
.avail-tip { position: absolute; bottom: calc(100% + 8px); z-index: 2; transform: translateX(-50%); padding: 7px 10px; border-radius: 8px;
  background: #323232; color: #fff; font-size: 12px; white-space: nowrap; box-shadow: 0 6px 18px rgba(0,0,0,0.35); pointer-events: none; }
.avail-tip[hidden] { display: none; }
.avail-tip b { color: #ff8a80; font-weight: 500; }
.avail-tip::after { content: ""; position: absolute; left: calc(50% + var(--arrow, 0px)); bottom: -5px; width: 10px; height: 10px;
  background: #323232; transform: translateX(-50%) rotate(45deg); }
.avail-ticks { position: relative; height: 16px; margin-top: 4px; color: var(--dp-text3); font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.avail-ticks span { position: absolute; transform: translateX(-50%); }
.avail-ticks .now-label { right: 0; transform: none; }
.avail-ticks .start-label { left: 0; transform: none; }
.avail-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 6px; color: var(--dp-text2); font-size: 12px; }
.avail-legend i { display: inline-block; width: 10px; height: 10px; margin-right: 5px; border-radius: 3px; vertical-align: -1px; }
.avail-list { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--dp-divider); font-size: 13px; }
.avail-list div { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; font-variant-numeric: tabular-nums; }
.avail-list .d { color: var(--dp-error); white-space: nowrap; }
.avail-more { margin: 4px 0 0; color: var(--dp-text3); font-size: 12px; }
/* Unterbrüche pro Tag (7 und 30 Tage) */
.days { display: flex; align-items: flex-end; gap: 3px; height: 58px; }
.days i { flex: 1; min-width: 0; border-radius: 3px 3px 1px 1px; background: color-mix(in srgb, var(--dp-success) 40%, var(--dp-card)); height: 3px; }
.days i.w { background: var(--dp-warning); }
.days i.e { background: var(--dp-error); }
.days i.none { background: var(--dp-bar-off); }
.daysx { display: flex; justify-content: space-between; font-size: 11px; color: var(--dp-text2); margin-top: 4px; }

@media (max-width: 1100px) {
  .hero { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .hero .kt.pul { grid-column: 1 / -1; }
}

@media (max-width: 600px) {
  /* Batterie pro Integration: Auswahl und Feld unter dem Namen. */
  .ex-row.bat-row { flex-wrap: wrap; }
  .bat-ctl { flex: 1 1 calc(100% - 42px); margin-left: 42px; }
  .bat-ctl .opt-select { flex: 1 1 auto; min-width: 0; }
  .ex-col { width: 52px; }
  /* Handy: die Auswahl "Ausgefallen nach" steht unter dem Namen, die Spaltenkopf-Zelle entfällt. */
  .ex-row:has(.ex-col.sel) { flex-wrap: wrap; }
  .ex-row .ex-col.sel { flex: 1 1 100%; width: auto; margin-left: 42px; justify-content: flex-end; align-items: center; gap: 10px; }
  .ex-col.sel .ex-lbl { display: block; color: var(--dp-text2); font-size: 12px; }
  .ex-col.sel .opt-select { flex: 0 0 170px; }
  .ex-head .ex-col.sel, .ex-row.ex-all .ex-col.sel { display: none; }
  .ex-head.multi { font-size: 10px; letter-spacing: .02em; }
  .nf-grid { grid-template-columns: minmax(0, 1fr); }
  /* Handy: Tippfläche mindestens 44 px hoch; ab fünf Reitern vier Spalten (7 Reiter: 4 + 3, der letzte links und gleich gross) */
  .mon-tab, .sub-tab { min-height: 44px; }
  .mon-tabs:has(> :is(.mon-tab, .sub-tab):nth-child(5)), .sub-tabs:has(> :is(.mon-tab, .sub-tab):nth-child(5)) { grid-auto-flow: row; grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .mtl { margin: 8px 6px 2px; }
  .mtl-mk { width: 100px; }
  .opt.bat-row .bat-ctl .opt-select { flex: 1 1 auto; }
  /* Empfang pro Funkart: Name oben, Auswahl und Feld darunter über die ganze Breite. */
  .opt.sig-row > .opt-line { flex-wrap: wrap; row-gap: 8px; }
  .opt.sig-row .bat-ctl { flex: 1 1 100%; margin-left: 0; }
  .opt.bat-row.sig-row .bat-ctl .opt-select { flex: 1 1 auto; }
  .toolbar { padding: 10px 12px 8px; gap: 8px; }
  .toolbar h1 { font-size: 18px; }
  .content { padding: 0 12px 12px; }
  /* Kopf auf dem Handy (seit 1.26.0, docs/mockups/hero-mobile-v1, V2): "Verfügbarkeit" und
     "Gerade ausgefallen" kompakt nebeneinander (je die halbe Breite, auf dem iPhone 17 185 px),
     der Ausfall-Puls als schlanke Zeile darunter. */
  .hero { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .hero .kt { padding: 12px; border-radius: 16px; }
  .hero .kt .k { font-size: 11px; letter-spacing: .03em; gap: 6px; }
  .pchart { height: 64px; }
  /* Verfügbarkeit: Ring und Prozentwert nebeneinander, darunter Durchschnitt und Zeilen */
  .kt.ring { grid-template-columns: 62px minmax(0, 1fr); gap: 0 10px; align-content: start; }
  .kt.ring .rtxt { display: contents; }
  .kt.ring .k { grid-column: 1 / -1; margin-bottom: 8px; }
  .ringwrap { grid-column: 1; grid-row: 2; width: 62px; height: 62px; }
  .ringwrap svg { width: 62px; height: 62px; }
  .ringwrap .c b { font-size: 17px; }
  .ringwrap .c span { display: none; }
  .kt.ring .pct { grid-column: 2; grid-row: 2; margin: 0; font-size: 23px; line-height: 1.1; }
  .kt.ring .pct small { display: block; margin: 2px 0 0; }
  .kt.ring .pavg { grid-column: 1 / -1; margin: 10px 0 2px; font-size: 12.5px; }
  .kt.ring .lines { grid-column: 1 / -1; margin-top: 2px; }
  .kt.ring .lines div { font-size: 12.5px; }
  /* Gerade ausgefallen: kleinere Zahl, die zwei längsten Geräte, kurze Warnzeile */
  .kt.offl .top { margin: 2px 0 8px; gap: 8px; }
  .kt.offl .top .num { font-size: 38px; }
  .kt.offl .top .lbl { font-size: 12px; padding-bottom: 3px; line-height: 1.25; }
  .kt.offl .durs { display: none; }
  .kt.offl .olist { margin-bottom: 12px; }
  .olist button { grid-template-columns: 16px minmax(0, 1fr) auto; gap: 6px; padding: 5px 0; font-size: 12.5px; }
  .olist button:nth-child(n+3) { display: none; }
  .olist .more-long { display: none; }
  .olist .more-short { display: block; font-size: 12px; }
  .kwarn { margin: auto -12px -12px; padding: 7px 12px; font-size: 12.5px; }
  .kwarn .w-long { display: none; }
  .kwarn .w-short { display: inline; }
  /* Ausfall-Puls: schlanke Zeile mit Titel, Zusammenfassung (oder Titel des Sammelausfalls) und Kurve */
  .hero .kt.pul { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 1fr) minmax(112px, 1fr); column-gap: 12px; align-items: center; padding: 10px 12px; }
  .hero .kt.pul .k { grid-column: 1; grid-row: 1; }
  .hero .kt.pul .pnote, .hero .kt.pul .inc { grid-column: 1; grid-row: 2; margin: 4px 0 0; }
  .hero .kt.pul .inc { padding: 0; background: none; }
  .hero .kt.pul .inc b { display: inline; margin: 0; }
  .hero .kt.pul .inc .inc-text { display: none; }
  .hero .kt.pul .pchart { grid-column: 2; grid-row: 1 / span 2; height: 38px; margin: 0; }
  .hero .kt.pul .pticks { display: none; }
  .pticks .minor, .avail-ticks .minor { display: none; }
  .hstrip { margin: 0 -12px; }
  .hs-in { padding: 0 14px; }
  .chips { position: sticky; top: 44px; z-index: 5; box-sizing: border-box; height: 48px; flex-wrap: nowrap; overflow-x: auto; margin: 0 -12px; padding: 12px 12px 4px; background: var(--dp-bg); scrollbar-width: none; }
  .chips::-webkit-scrollbar { display: none; }
  /* Angeheftete Chips (seit 1.15.0): kleben links, mit Schatten an der Haftkante, sobald gescrollt wird */
  .chips .chip-pin { position: sticky; left: -12px; z-index: 2; flex: none; display: flex; align-items: center; gap: 8px; margin-left: -12px; padding: 0 12px; background: var(--dp-bg); }
  .chips .chip-pin::after { content: ""; position: absolute; right: -14px; top: 0; bottom: 0; width: 14px; background: linear-gradient(90deg, rgba(0,0,0,.28), transparent); opacity: 0; transition: opacity .15s; pointer-events: none; }
  .chips.scrolled .chip-pin::after { opacity: 1; }
  .chips .chip-pin.too-wide { position: static; }
  .foot .tap { display: none; }
  dialog.device, dialog.stat-dlg, dialog.settings, dialog.area-sheet, dialog.pulse-dlg, dialog.prompt-dlg, dialog.notes-dlg { width: 100%; max-width: 100%; margin: auto 0 0; border-radius: 22px 22px 0 0; }
  dialog.area-sheet, dialog.pulse-dlg, dialog.prompt-dlg, dialog.notes-dlg { max-height: 92%; }
  .pwin .pchart { height: 96px; }
  /* Handy: der Knopf oben entfällt (seit 2.0.5); die Zeile "Sortierung & Ansicht" unter den Chips öffnet dasselbe Blatt */
  .view-btn { display: none; }
  .viewline { display: flex; align-items: center; gap: 8px; position: sticky; top: 92px; z-index: 5; margin: 0 -12px 6px; padding: 0 12px; background: var(--dp-bg); }
  .sort-btn { display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0; height: 44px; padding: 0 4px; border: 0; border-top: 1px solid var(--dp-divider); border-bottom: 1px solid var(--dp-divider);
    border-radius: 0; background: none; color: var(--dp-text); font: inherit; font-size: 14px; cursor: pointer; }
  .sort-btn .lbl { flex: none; color: var(--dp-text2); }
  .sort-btn .val { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-align: right; color: var(--dp-primary); font-weight: 600; }
  .sort-btn svg { flex: none; color: var(--dp-primary); }
  .sort-btn svg:last-child { color: var(--dp-text2); }
  dialog.device { max-height: 92%; }
  /* Feste Höhe: sonst springt das Blatt bei jeder Änderung des Inhalts
     (Prüfung, Abschnitt auf/zu) und gibt kurz den Hintergrund frei. */
  dialog.settings { height: 92%; max-height: 92%; }
  dialog.settings[open] { display: flex; flex-direction: column; }
  dialog.settings[open] > * { flex-shrink: 0; }
  dialog.settings[open] > .dlg-body { flex-grow: 1; }
  .toolbar .gear-btn, .toolbar .rtall-btn, .toolbar .apps-btn, .dlg-close, .dlg-act, .dlg-fav { width: 38px; height: 38px; }
  /* Handy: der Platz zwischen Suchfeld und Zahnrad bleibt wie vorher (Suchfeld nicht schmaler), nur gleichmässig geteilt: 8 + 7 px auf beiden Seiten */
  .toolbar .rtall-btn, .toolbar .apps-btn { margin: 0 3px; } /* Abstand zwischen den Knöpfen 14 px (Wunsch des Nutzers: war zu eng), das Suchfeld wird dafür schmaler */
  dialog.stat-dlg { height: 86%; max-height: 86%; }
  .dlg-head { padding: 18px 12px 12px 16px; }
  /* Geräte-Popup am Handy: Name eine Stufe kleiner (24 → 21 px), damit neben Protokoll, Herz und Kreuz mehr Platz bleibt (seit 2.121.0) */
  dialog.device .dlg-title h2 { font-size: 21px; }
  /* Vollbild-Fenster (Einstellungen, Protokoll, Routinen): das Kreuz sitzt auf gleicher Höhe wie der Zahnrad-Knopf der Übersicht (12 px vom oberen Rand) */
  dialog.settings .dlg-head .dlg-close, dialog.log-dlg .dlg-head .dlg-close, dialog.rtall-dlg .dlg-head .dlg-close, dialog.mgall-dlg .dlg-head .dlg-close, dialog.status-dlg .dlg-head .dlg-close,
  dialog.settings .dlg-head .dlg-acts, dialog.rtall-dlg .dlg-head .dlg-acts, dialog.mgall-dlg .dlg-head .dlg-acts { margin-top: -6px; }
  .dlg-quick { padding: 0 16px 14px; flex-wrap: nowrap; gap: 6px; }
  /* Handy: beide Knöpfe (Gerät, Integration) auf einer Zeile; bei sehr schmalem Fenster kürzt "…" den Text */
  .qbtn { padding: 0 12px; gap: 6px; min-width: 0; white-space: nowrap; }
  .qbtn .q-t { overflow: hidden; text-overflow: ellipsis; }
  .dlg-body { padding: 4px 16px 16px; }
  .dlg-actions { padding-left: 16px; padding-right: 16px; }
  .st-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

/* Protokoll (seit 1.38.0, docs/mockups/popup-tabs-log-v1, P1): Fenster gross auf dem Desktop, auf dem Handy vollflächig */
/* Fenster "Alle Routinen": Popup auf dem Desktop, gleich gross wie Einstellungen und Geräte-Popup (seit 2.28.3, Grösse seit 2.28.5 wie die anderen grossen Fenster), auf dem Handy (bis 700 px) vollflächig */
dialog.rtall-dlg, dialog.mgall-dlg, dialog.status-dlg { padding: 0; border: none; border-radius: 22px; background: var(--dp-card); color: var(--dp-text); box-shadow: var(--dp-shadow); overflow: hidden;
  width: min(880px, calc(100vw - 48px)); height: min(1100px, calc(100% - 48px)); max-height: none; overscroll-behavior: contain; }
dialog.rtall-dlg[open], dialog.mgall-dlg[open], dialog.status-dlg[open] { display: flex; flex-direction: column; }
dialog.rtall-dlg::backdrop, dialog.mgall-dlg::backdrop, dialog.status-dlg::backdrop { background: rgba(0,0,0,0.5); }
.rtall-dlg .dlg-head, .mgall-dlg .dlg-head, .status-dlg .dlg-head { flex: none; position: static; }
.rtall-dlg .dlg-body, .mgall-dlg .dlg-body, .status-dlg .dlg-body { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 0 22px 24px; }
.rt-all-wrap { margin: 0 auto; }
@media (max-width: 700px) {
  dialog.rtall-dlg, dialog.mgall-dlg, dialog.status-dlg { width: 100%; max-width: 100%; height: 100%; max-height: 100%; margin: 0; border-radius: 0; }
  .rtall-dlg .dlg-body, .mgall-dlg .dlg-body, .status-dlg .dlg-body { padding: 0 16px 20px; }
  .rtall-dlg .dlg-addbar, .mgall-dlg .dlg-addbar { bottom: -20px; margin-bottom: -20px; padding-bottom: 16px; }
}
dialog.log-dlg { padding: 0; border: none; border-radius: 22px; background: var(--dp-card); color: var(--dp-text); box-shadow: var(--dp-shadow); overflow: hidden;
  width: min(880px, calc(100vw - 48px)); height: min(1100px, calc(100% - 48px)); max-height: none; overscroll-behavior: contain; }
dialog.log-dlg[open] { display: flex; flex-direction: column; }
dialog.log-dlg::backdrop { background: rgba(0,0,0,0.5); }
.log-dlg .dlg-head { flex: none; position: static; }
.lg-bar { flex: none; display: flex; flex-direction: column; gap: 10px; padding: 4px 22px 10px; }
.lg-search { max-width: none; width: 100%; box-sizing: border-box; }
.lg-chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
.lg-chips::-webkit-scrollbar { display: none; }
.lg-chips .chip { height: 30px; font-size: 12.5px; flex: none; }
/* Auswahl "Meldung" / "Routine" über alle Geräte (seit 2.134.0): Chip mit Liste darunter, über die ganze Breite */
.lg-chips:has(.pr-pick-wrap) { overflow: visible; display: block; }
.pr-pick-wrap { width: 100%; }
.pr-pick-chip { display: inline-flex; align-items: center; gap: 4px; }
.pr-pick { margin: 8px 0 4px; max-height: 260px; overflow: auto; border: 1px solid var(--dp-divider); border-radius: 14px; background: var(--dp-card); }
.pr-pick-row { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 44px; padding: 6px 12px; border: 0; border-bottom: 1px solid var(--dp-divider); background: transparent; color: var(--dp-text); font: inherit; font-size: 14px; text-align: left; cursor: pointer; }
.pr-pick-row:last-child { border-bottom: 0; }
.pr-pick-row:hover { background: var(--dp-hover); }
.pr-pick-row.on { color: var(--dp-primary); }
.pr-pick-box { flex: none; display: grid; place-items: center; width: 20px; height: 20px; border: 1.5px solid var(--dp-divider); border-radius: 6px; }
.pr-pick-row.on .pr-pick-box { border-color: var(--dp-primary); }
.pr-pick-name { flex: 1; min-width: 0; }
.pr-pick-name small { display: block; color: var(--dp-text2); font-size: 12px; }
.lg-chips .chip.on { background: var(--dp-primary-soft); border-color: var(--dp-primary); color: var(--dp-primary); }
/* "Alle" bleibt beim seitlichen Scrollen stehen; deckend, damit die vorbeiziehenden Chips nicht durchscheinen (der Schatten füllt die Lücke) */
.lg-chips .chip:first-child { position: sticky; left: 0; z-index: 1; background-color: var(--dp-card); box-shadow: 6px 0 0 var(--dp-card); }
.lg-chips .chip.on:first-child { background: linear-gradient(var(--dp-primary-soft), var(--dp-primary-soft)) var(--dp-card); }
.lg-check { display: inline-flex; align-items: center; gap: 8px; align-self: flex-start; font-size: 13px; color: var(--dp-text2); cursor: pointer; }
.lg-check input { width: 18px; height: 18px; accent-color: var(--dp-primary); margin: 0; }
.lg-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; flex: none; background: var(--dp-text3); }
.lg-dot.warning { background: var(--dp-warning); }
.lg-dot.error { background: var(--dp-error); }
.lg-dot.debug { background: transparent; box-shadow: inset 0 0 0 1.5px var(--dp-text3); }
.lg-list { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0 22px 8px; }
.lg-day { position: sticky; top: 0; z-index: 1; padding: 12px 4px 6px; background: var(--dp-card); font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--dp-text2); }
.lg-row { display: grid; grid-template-columns: 70px 14px 92px 1fr; gap: 10px; align-items: start; width: 100%; box-sizing: border-box; padding: 8px 4px; margin: 0; border: 0; border-bottom: 1px solid var(--dp-divider);
  background: none; color: var(--dp-text); font: inherit; font-size: 13.5px; line-height: 1.35; text-align: left; }
button.lg-row { cursor: pointer; }
button.lg-row:hover { background: var(--dp-hover); }
.lg-row.warning { background: linear-gradient(90deg, var(--dp-warning-soft), transparent 40%); }
.lg-row.error { background: linear-gradient(90deg, var(--dp-error-soft), transparent 40%); }
.lg-row.debug { color: var(--dp-text2); }
.lg-rt { color: var(--dp-text2); font-variant-numeric: tabular-nums; font-size: 12.5px; padding-top: 1px; }
.lg-lv { padding-top: 5px; }
.lg-msg { min-width: 0; overflow-wrap: anywhere; }
.lg-msg b { font-weight: 600; }
.lg-msg small { display: block; margin-top: 2px; color: var(--dp-text3); font-size: 12px; }
.lg-pill { display: inline-flex; align-items: center; height: 22px; padding: 0 9px; border-radius: 11px; font-size: 11.5px; font-weight: 600; background: var(--dp-subtle); color: var(--dp-text2); white-space: nowrap; }
.lg-pill.charge { background: var(--dp-success-soft); color: var(--dp-success); }
.lg-pill.battery { background: var(--dp-warning-soft); color: var(--dp-warning); }
.lg-pill.outage { background: var(--dp-error-soft); color: var(--dp-error); }
.lg-pill.push { background: var(--dp-primary-soft); color: var(--dp-primary); }
.lg-none { padding: 24px 4px; }
.lg-foot { flex: none; display: flex; align-items: center; gap: 10px; padding: 10px 22px calc(12px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--dp-divider); color: var(--dp-text2); font-size: 12.5px; }
.lg-foot .sp { margin-left: auto; }
.lg-btn { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--dp-divider); background: var(--dp-card); color: var(--dp-text); font: inherit; font-size: 13.5px; cursor: pointer; }
.lg-btn:hover { background: var(--dp-hover); }
@media (max-width: 700px) {
  dialog.log-dlg { width: 100%; max-width: 100%; height: 100%; max-height: 100%; margin: 0; border-radius: 0; }
  .lg-bar { padding: 4px 16px 10px; }
  .lg-list { padding: 0 16px 8px; }
  .lg-foot { padding-left: 16px; padding-right: 16px; }
  .lg-row { grid-template-columns: 14px auto 1fr; grid-template-areas: "lv rt cat" ". msg msg"; gap: 4px 10px; padding: 10px 2px; }
  .lg-lv { grid-area: lv; } .lg-rt { grid-area: rt; font-weight: 600; color: var(--dp-text); padding-top: 0; align-self: center; } .lg-cat { grid-area: cat; } .lg-msg { grid-area: msg; font-size: 14px; }
}

/* Feste Höhe (seit 1.41.0, Wunsch des Nutzers): Fenster mit Reitern oder wechselndem Inhalt bleiben gleich hoch, egal welcher Reiter
   gewählt ist. Kopf, Reiter und Knöpfe bleiben stehen, der Inhalt füllt den Rest und scrollt, wenn er länger ist. */
dialog.area-sheet, dialog.prompt-dlg { height: min(780px, calc(100% - 48px)); }
/* Inhaltsreiche Fenster dürfen auf dem Desktop deutlich höher sein (seit 2.28.5, Wunsch des Nutzers) */
dialog.device, dialog.settings, dialog.stat-dlg, dialog.pulse-dlg, dialog.notes-dlg { height: min(1100px, calc(100% - 48px)); }
dialog.device[open], dialog.settings[open], dialog.stat-dlg[open], dialog.pulse-dlg[open], dialog.area-sheet[open], dialog.prompt-dlg[open], dialog.notes-dlg[open] { display: flex; flex-direction: column; }
dialog.device[open] > *, dialog.settings[open] > *, dialog.stat-dlg[open] > *, dialog.pulse-dlg[open] > *, dialog.area-sheet[open] > *, dialog.prompt-dlg[open] > *, dialog.notes-dlg[open] > * { flex-shrink: 0; }
dialog.device[open] > .dlg-body, dialog.settings[open] > .dlg-body, dialog.stat-dlg[open] > .dlg-body, dialog.pulse-dlg[open] > .dlg-body, dialog.area-sheet[open] > .dlg-body, dialog.prompt-dlg[open] > .dlg-body, dialog.notes-dlg[open] > .dlg-body { flex-grow: 1; }
@media (max-width: 600px) {
  dialog.device, dialog.settings, dialog.pulse-dlg, dialog.area-sheet, dialog.prompt-dlg, dialog.notes-dlg { height: 92%; max-height: 92%; }
  dialog.stat-dlg { height: 86%; max-height: 86%; }
  /* Einstellungen, Ansicht und Geräte-Popup auf dem Handy als Vollbild (seit 2.24.0, Wunsch des Nutzers) */
  dialog.settings, dialog.device { height: 100%; max-height: 100%; margin: 0; border-radius: 0; clip-path: none; }
  /* Verlaufsfenster (Batterie, Verfügbarkeit, Empfang) ebenfalls ganz oben am Rand statt als Blatt (seit 2.121.0, Wunsch des Nutzers) */
  dialog.stat-dlg { height: 100%; max-height: 100%; margin: 0; border-radius: 0; clip-path: none; }
  dialog.stat-dlg .dlg-head .dlg-close { margin-top: -6px; }
}

/* Material (seit 2.0.0b1, Wunsch des Nutzers, Variante B aus docs/mockups/apple-design-v1): Geräte-Popup, Einstellungen und Protokoll sind
   durchscheinende Blätter mit Unschärfe und heller Oberkante; Kopf und Knöpfe laufen weich aus statt mit harter Linie. Nur Stile: keine Inhalte,
   Felder oder Werte ändern sich. Farben aus den Theme-Variablen (hell und dunkel). Ohne Unterstützung für backdrop-filter oder bei
   "Transparenz reduzieren" bleiben die Blätter deckend wie bisher. */
@supports ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
  @media not (prefers-reduced-transparency: reduce) {
    dialog.device, dialog.settings, dialog.log-dlg, dialog.rtall-dlg, dialog.mgall-dlg, dialog.status-dlg { background: color-mix(in srgb, var(--dp-card) 64%, transparent);
      -webkit-backdrop-filter: blur(30px) saturate(190%); backdrop-filter: blur(30px) saturate(190%);
      box-shadow: inset 0 1.5px 0 color-mix(in srgb, var(--dp-text) 30%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--dp-text) 8%, transparent), 0 24px 70px rgba(0,0,0,0.55); }
    dialog.device::backdrop, dialog.settings::backdrop, dialog.log-dlg::backdrop, dialog.rtall-dlg::backdrop, dialog.mgall-dlg::backdrop, dialog.status-dlg::backdrop { background: rgba(0,0,0,0.5); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
    dialog.device .dlg-head, dialog.settings .dlg-head, dialog.log-dlg .dlg-head, dialog.rtall-dlg .dlg-head, dialog.mgall-dlg .dlg-head, dialog.status-dlg .dlg-head { background: color-mix(in srgb, var(--dp-card) 60%, transparent);
      -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); }
    dialog.device .dev-tabs { background: color-mix(in srgb, var(--dp-card) 60%, transparent); -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); }
    dialog.device .dev-tabs::after { display: none; }
    dialog.device .dlg-actions, dialog.settings .dlg-actions, dialog.log-dlg .dlg-actions, dialog.rtall-dlg .dlg-actions, dialog.mgall-dlg .dlg-actions, dialog.status-dlg .dlg-actions { border-top: none; padding-top: 24px;
      background: linear-gradient(to bottom, transparent, color-mix(in srgb, var(--dp-card) 85%, transparent) 42%);
      -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); }
    dialog.device .dlg-btn, dialog.settings .dlg-btn { background: color-mix(in srgb, var(--dp-text) 8%, transparent); border-color: color-mix(in srgb, var(--dp-text) 12%, transparent); }
    dialog.device .dlg-btn.primary, dialog.settings .dlg-btn.primary { background: var(--dp-primary); border-color: transparent; }
    dialog.device .tile, dialog.device .st-tile, dialog.settings .nf-note, dialog.settings .pv { background: color-mix(in srgb, var(--dp-text) 9%, transparent); border-color: color-mix(in srgb, var(--dp-text) 14%, transparent); box-shadow: inset 0 1px 0 color-mix(in srgb, var(--dp-text) 12%, transparent); }
    dialog.device .dev-set { background: color-mix(in srgb, var(--dp-text) 5%, transparent); }
  }
}
/* Helles Design am Desktop (seit 2.20.0, ab 601 px; das Handy-Blatt bleibt wie es war): Fenster, Kopf, Reiter und Fuss deckend weiss statt durchscheinend (die Unschärfe über dem
   abgedunkelten Hintergrund machte das ganze Blatt grau); Kacheln nur ganz leicht abgesetzt. Grau nur beim Darüberfahren. */
@media (min-width: 601px) {
:host([light]) dialog.device, :host([light]) dialog.settings, :host([light]) dialog.log-dlg, :host([light]) dialog.rtall-dlg, :host([light]) dialog.mgall-dlg, :host([light]) dialog.status-dlg { background: var(--dp-card); -webkit-backdrop-filter: none; backdrop-filter: none;
  box-shadow: 0 24px 70px rgba(0,0,0,0.35), 0 0 0 1px color-mix(in srgb, var(--dp-text) 8%, transparent); }
:host([light]) dialog.device::backdrop, :host([light]) dialog.settings::backdrop, :host([light]) dialog.log-dlg::backdrop, :host([light]) dialog.rtall-dlg::backdrop, :host([light]) dialog.mgall-dlg::backdrop, :host([light]) dialog.status-dlg::backdrop { -webkit-backdrop-filter: none; backdrop-filter: none; background: rgba(0,0,0,0.4); }
:host([light]) dialog.device .dlg-head, :host([light]) dialog.settings .dlg-head, :host([light]) dialog.log-dlg .dlg-head, :host([light]) dialog.rtall-dlg .dlg-head, :host([light]) dialog.mgall-dlg .dlg-head, :host([light]) dialog.status-dlg .dlg-head, :host([light]) dialog.device .dev-tabs { background: var(--dp-card); -webkit-backdrop-filter: none; backdrop-filter: none; }
:host([light]) dialog.device .dlg-actions, :host([light]) dialog.settings .dlg-actions, :host([light]) dialog.log-dlg .dlg-actions, :host([light]) dialog.rtall-dlg .dlg-actions, :host([light]) dialog.mgall-dlg .dlg-actions, :host([light]) dialog.status-dlg .dlg-actions { background: var(--dp-card); -webkit-backdrop-filter: none; backdrop-filter: none; border-top: 1px solid var(--dp-divider); padding-top: 14px; }
:host([light]) dialog.device .tile, :host([light]) dialog.device .st-tile, :host([light]) dialog.settings .nf-note, :host([light]) dialog.settings .pv { background: color-mix(in srgb, var(--dp-text) 3.5%, var(--dp-card)); border-color: color-mix(in srgb, var(--dp-text) 10%, var(--dp-card)); box-shadow: none; }
:host([light]) dialog.device .dev-set { background: color-mix(in srgb, var(--dp-text) 2.5%, var(--dp-card)); }
:host([light]) dialog.device .dlg-btn, :host([light]) dialog.settings .dlg-btn { background: var(--dp-card); border-color: color-mix(in srgb, var(--dp-text) 18%, var(--dp-card)); }
:host([light]) dialog.device .dlg-btn.primary, :host([light]) dialog.settings .dlg-btn.primary { background: var(--dp-primary); border-color: transparent; }
}
/* Liste (seit 2.0.1): grosser Titel, weiche Tiefe der Kacheln, Chip-Leiste als Material, Gruppentitel im neuen Titelstil */
.toolbar h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.03em; }
/* Handy: kein sichtbarer Titel (seit 2.25.0, nur bis 700 px Breite ab 2.25.1): die Anwendung heisst schon "Device Panel", das Suchfeld gewinnt den Platz. Der Titel bleibt für Screenreader. Auf dem Desktop bleibt er sichtbar. */
@media (max-width: 700px) {
  .toolbar h1 { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; border: 0; }
}
.hero > *, .mlist { border-radius: 22px; box-shadow: 0 8px 26px -10px rgba(0,0,0,0.45); }
.cards .gh { margin: 22px 6px 8px; font-size: 13px; font-weight: 700; letter-spacing: 0.05em; }
@supports ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
  @media not (prefers-reduced-transparency: reduce) {
    .chips { background: color-mix(in srgb, var(--dp-bg) 66%, transparent); -webkit-backdrop-filter: blur(22px) saturate(180%); backdrop-filter: blur(22px) saturate(180%); }
  }
}
/* Typografie: grosse Titel enger, kleine Beschriftung etwas weiter (Spationierung nach Grösse) */
.dlg-title { letter-spacing: -0.022em; line-height: 1.12; }
.dlg-title h2 { font-size: 24px; font-weight: 700; }
.opt-short, .opt-origin, .sub, .st-sub { letter-spacing: 0.01em; }
.st-k { letter-spacing: 0.02em; }
/* Rückmeldung beim Drücken: sofort, 3 % kleiner; mit reduzierter Bewegung entfällt es */
@media not (prefers-reduced-motion: reduce) {
  button:active, .dev:active, .chip:active, .tile:active, .st-tile:active, .sub-tab:active, .mon-tab:active { transform: scale(0.97); transition: transform 100ms ease-out; }
  /* Zeilen, die ihren Behälter ausfüllen, werden nicht kleiner: sonst blitzt am Rand der Grund des Behälters auf (dunkle Fläche links,
     Fehler in 2.0.1). Sie zeigen stattdessen die Hover-Farbe. */
  .mrow:active, .set-sec-head:active, .ilist-row:active, button.lg-row:active, .afloor:active, .arow:active, .prow:active, .olist button:active, button.kwarn:active { transform: none; }
  .mrow:active, .set-sec-head:active, .ilist-row:active, button.lg-row:active, .afloor:active, .arow:active, .prow:active { background: var(--dp-hover); }
}
/* Acht Reiter (Überwachung und Meldungen, seit 2.0.7): überall zwei Zeilen zu vier, auch auf dem Desktop (sonst wird "Integrationen" abgeschnitten) */
.mon-tabs:has(> :is(.mon-tab, .sub-tab):nth-child(8)), .sub-tabs:has(> :is(.mon-tab, .sub-tab):nth-child(8)) { grid-auto-flow: row; grid-template-columns: repeat(4, minmax(0, 1fr)); }
/* Schmale Handys (unter 390 px): ab fünf Reitern drei Spalten, damit "Integrationen" nicht abgeschnitten wird */
@media (max-width: 389px) {
  .mon-tabs:has(> :is(.mon-tab, .sub-tab):nth-child(5)), .sub-tabs:has(> :is(.mon-tab, .sub-tab):nth-child(5)) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
/* Fenster "Release Notes" (seit 2.3.0): Abschnitt je Version, Markdown als Überschriften, Listen, Code */
.rn-entry + .rn-entry { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--dp-divider); }
/* .dlg-body h3 ist sonst klein und grau (Zwischentitel): die Versionsnummer ist der Titel des Abschnitts */
.dlg-body .rn-entry .rn-ver { display: flex; align-items: baseline; gap: 10px; margin: 0 0 6px; color: var(--dp-text); font-size: 18px; font-weight: 600; text-transform: none; letter-spacing: 0; }
.dlg-body .rn-entry .rn-ver small { color: var(--dp-text2); font-size: 12.5px; font-weight: 400; }
.rn { font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }
.rn h4 { margin: 12px 0 4px; font-size: 13px; font-weight: 600; letter-spacing: .02em; color: var(--dp-text2); }
.rn p { margin: 6px 0; }
.rn ul { margin: 4px 0 8px; padding-left: 20px; }
.rn li { margin: 4px 0; }
.rn code { padding: 1px 5px; border-radius: 5px; background: var(--dp-subtle); font-size: 12.5px; }
.rn pre { margin: 8px 0; padding: 10px 12px; border-radius: 10px; background: var(--dp-subtle); overflow-x: auto; font-size: 12.5px; }
.rn a { color: var(--dp-primary); }
a.dlg-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; color: var(--dp-text); text-decoration: none; }

.lg-pill.magic { background: var(--dp-primary-soft); color: var(--dp-primary); }
/* Magic Push (seit 2.6.0, docs/mockups/magic-push-v2): Liste der Meldungen und Assistent im Geräte-Popup */
.mg-rfor { margin-top: 24px; padding-top: 4px; border-top: 1px solid var(--dp-divider); }
.mg-rfor .mg-note, .mg-rfor .opt-error { margin-top: 10px; }
.mg-note { margin: 0 0 6px; color: var(--dp-text2); font-size: 12.5px; line-height: 1.4; }
.mg-empty { margin: 12px 0 0; color: var(--dp-text2); font-size: 14px; line-height: 1.45; }
.mg-flash { margin: 8px 0; padding: 8px 12px; border-radius: 10px; background: var(--dp-success-soft); color: var(--dp-success); font-size: 13px; }
.mg-card { margin-top: 8px; padding: 12px 14px; border-radius: 14px; background: var(--dp-subtle); }
.mg-card.off { opacity: .72; }
.mg-card.sel { box-shadow: inset 0 0 0 1.5px var(--dp-primary); }
.mg-pick { display: block; width: 100%; box-sizing: border-box; border: 0; font: inherit; color: inherit; text-align: left; cursor: pointer; }
.mg-pick:hover { background: var(--dp-hover); }
.mg-pick:focus-visible, .mg-stp:focus-visible, .mg-pill:focus-visible, .mg-chips button:focus-visible, .mg-sel:focus-visible, .mg-opt-row:focus-visible, .mg-add:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: 2px; }
.mg-row { display: flex; align-items: center; gap: 12px; }
.mg-ic { flex: none; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; background: var(--dp-primary-soft); font-size: 19px; }
.mg-t { flex: 1; min-width: 0; }
.mg-t b { display: block; font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.mg-t small { display: block; margin-top: 2px; color: var(--dp-text2); font-size: 12.5px; line-height: 1.35; overflow-wrap: anywhere; }
.mg-status .mg-on { color: var(--dp-primary); font-weight: 500; }
.mg-status .mg-warn { color: var(--dp-warning); font-weight: 500; }
.mg-val { text-align: right; font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
.mg-kind { padding: 2px 9px; border-radius: 99px; background: var(--dp-primary-soft); color: var(--dp-primary); font-size: 12px; font-weight: 600; white-space: nowrap; }
.mg-kind.group { background: var(--dp-success-soft); color: var(--dp-success); }
.mg-val.off { color: var(--dp-text2); font-size: 12.5px; font-weight: 400; }
.mg-radio { flex: none; width: 22px; height: 22px; box-sizing: border-box; border: 2px solid var(--dp-divider); border-radius: 50%; }
.mg-radio.on { border: 7px solid var(--dp-primary); }
.mg-acts { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-top: 8px; padding-left: 50px; font-size: 13px; }
/* Ergebnis von "Ausführen" im Fenster mit allen Routinen (seit 2.74.0): unter den Aktionen, bündig mit ihnen */
.mg-card .rt-ran { margin: 8px 0 0 50px; }
.linkbtn.danger { color: var(--dp-error); }
/* Herz der Lieblings-Routine (seit 2.26.0): rechts von "Löschen", mit Abstand, rot wenn gesetzt (wie das Herz der Favoriten-Geräte) */
.mg-acts .linkbtn.fav { display: inline-flex; align-items: center; margin-left: 14px; color: var(--dp-text2); }
.mg-acts .linkbtn.fav.on { color: var(--dp-error); }
.mg-acts .linkbtn.fav:hover { text-decoration: none; color: var(--dp-error); }
.mg-filter .sub-tab.fav .tab-l { display: inline-flex; color: var(--dp-error); }
/* Die Filter von "Alle Routinen" bleiben eine Zeile, auch mit dem fünften Reiter (Herz): die Regeln für viele Reiter würden umbrechen */
.sub-tabs.mg-filter { grid-auto-flow: column !important; grid-template-columns: none !important; }
/* Handy: Aktionen der Karten (Bearbeiten, Löschen, Gerät öffnen) mit Fläche für den Finger (seit 2.24.0): grössere Schrift, 44 px Trefferhöhe, mehr Abstand */
@media (max-width: 700px) {
  .mg-acts { gap: 0 2px; margin-top: 2px; padding-left: 38px; font-size: 15px; }
  .mg-card .rt-ran { margin-left: 38px; }
  .mg-acts .linkbtn, .mg-dfoot .linkbtn { min-height: 44px; padding: 0 12px; }
  /* Vier Aktionen (Bearbeiten, Ausführen, Löschen, Herz; seit 2.74.0) passen auf 390 px in eine Zeile: etwas weniger Rand links und rechts */
  .mg-acts .linkbtn { padding: 0 7px; }
  .mg-acts .linkbtn.fav { margin-left: 10px; }
  .mg-dfoot { padding: 0 14px 0 44px; font-size: 15px; }
}
.dlg-btn.danger { border-color: var(--dp-error); color: var(--dp-error); }
.mg-confirm { margin-top: 10px; padding: 10px 12px; border-radius: 12px; background: var(--dp-error-soft); }
.mg-confirm b { display: block; font-size: 14px; overflow-wrap: anywhere; }
.mg-confirm small { display: block; margin-top: 2px; color: var(--dp-text2); font-size: 12.5px; }
.mg-add { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; box-sizing: border-box; height: 46px; margin-top: 12px; border: 1.5px dashed color-mix(in srgb, var(--dp-primary) 55%, transparent); border-radius: 14px; background: none; color: var(--dp-primary); font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; }
.mg-add:hover { background: var(--dp-primary-soft); }
.mg-input, .mg-text { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--dp-divider); border-radius: 12px; background: var(--dp-input); color: var(--dp-text); font: inherit; font-size: 14px; line-height: 1.45; }
.mg-input:focus-visible, .mg-text:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: -1px; }
.mg-text { display: block; resize: vertical; min-height: 64px; }
.mg-btns { display: flex; gap: 8px; margin-top: 14px; }
.mg-btns.small { margin-top: 8px; }
.mg-btns .dlg-btn.quick { border-color: var(--dp-primary); color: var(--dp-primary); }
.mg-btns.small .dlg-btn { height: 36px; }
/* Feste Höhe: ein Emoji in der Angabe rechts macht die Zeile sonst höher, und die Balken darunter rutschen von Schritt zu Schritt */
.mg-stephead { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; height: 18px; line-height: 18px; overflow: hidden; color: var(--dp-text2); font-size: 12px; }
.mg-stephead span { white-space: nowrap; }
.mg-stephead span:last-child { min-width: 0; text-align: right; overflow: hidden; text-overflow: ellipsis; }
.mg-steps { display: flex; align-items: center; gap: 6px; margin: 6px 0 12px; }
.mg-stp { position: relative; flex: 1; height: 6px; padding: 0; border: 0; border-radius: 3px; background: var(--dp-bar-off); }
.mg-stp.on { background: var(--dp-primary); }
button.mg-stp { cursor: pointer; }
button.mg-stp::after { content: ""; position: absolute; inset: -14px 0; }
.mg-big { margin: 4px 0 8px; font-size: 20px; font-weight: 600; line-height: 1.25; }
.mg-k { margin: 12px 0 4px; color: var(--dp-text2); font-size: 12px; }
.mg-k.first { margin-top: 0; }
.mg-unit { opacity: .85; }
.mg-pill { display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; height: 38px; padding: 0 13px; border: none; border-radius: 11px; background: color-mix(in srgb, var(--dp-text) 7%, var(--dp-card)); color: var(--dp-text); font: inherit; font-size: 14px; cursor: pointer; }
.mg-pill.num { min-width: 56px; font-variant-numeric: tabular-nums; font-weight: 600; text-align: center; }
input.mg-pill { cursor: text; }
.mg-own { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 8px; color: var(--dp-text2); font-size: 13px; }
.mg-own .mg-pill { height: 34px; }
.mg-ownin { width: 70px; min-width: 0; }
.mg-hist { margin-top: 10px; padding: 10px 12px; border-radius: 12px; background: var(--dp-subtle); font-size: 13px; line-height: 1.45; }
.mg-hist small { display: block; margin-top: 3px; color: var(--dp-text2); font-size: 12px; }
.mg-spark { display: block; width: 100%; height: 70px; }
.mg-scale { display: flex; justify-content: space-between; gap: 8px; margin-top: 4px; color: var(--dp-text2); font-size: 11.5px; }
.mg-bar { position: relative; height: 22px; margin: 8px 0 2px; border-radius: 6px; background: color-mix(in srgb, var(--dp-text) 10%, transparent); overflow: hidden; }
.mg-bar span { position: absolute; top: 0; bottom: 0; background: var(--dp-error); opacity: .85; }
.mg-bar span.dim { opacity: .35; }
.mg-hint { margin: 6px 0 0; color: var(--dp-text2); font-size: 12px; line-height: 1.4; }
.mg-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 0; }
.mg-chips button { padding: 5px 10px; border: 1px solid var(--dp-divider); border-radius: 99px; background: none; color: var(--dp-text2); font: inherit; font-size: 12.5px; cursor: pointer; }
.mg-chips button.sug { border-color: color-mix(in srgb, var(--dp-primary) 45%, transparent); background: var(--dp-primary-soft); color: var(--dp-primary); }
.mg-sel { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; box-sizing: border-box; min-height: 42px; padding: 6px 12px; border: 1px solid var(--dp-divider); border-radius: 12px; background: var(--dp-input); color: var(--dp-text); font: inherit; font-size: 13.5px; text-align: left; cursor: pointer; }
.mg-sel small, .mg-opt-row small { display: block; color: var(--dp-text2); font-size: 11.5px; overflow-wrap: anywhere; }
.mg-list { margin-top: 6px; border: 1px solid var(--dp-divider); border-radius: 12px; overflow: hidden; background: var(--dp-card); }
.mg-opt-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; box-sizing: border-box; padding: 10px 12px; border: 0; border-top: 1px solid var(--dp-divider); background: none; color: var(--dp-text); font: inherit; font-size: 13.5px; text-align: left; cursor: pointer; }
.mg-opt-row:first-child { border-top: 0; }
.mg-opt-row:hover { background: var(--dp-hover); }
.mg-opt-row.on { color: var(--dp-primary); font-weight: 500; }
.mg-opt-head { padding: 6px 12px; border-top: 1px solid var(--dp-divider); background: var(--dp-subtle); color: var(--dp-text2); font-size: 11.5px; letter-spacing: .03em; text-transform: uppercase; }
.mg-optrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; padding: 10px 0; border-top: 1px solid var(--dp-divider); font-size: 14px; }
.mg-pv { margin-top: 12px; padding: 12px; border-radius: 14px; background: var(--dp-subtle); }
.mg-pv .pv-card { padding: 10px 12px 8px; border-radius: 12px; background: var(--dp-card); box-shadow: 0 1px 4px rgba(0,0,0,.12); font-size: 13px; }
.mg-pv .opt-short { margin-top: 8px; }
.mg-pv .pv-text { overflow-wrap: anywhere; white-space: pre-line; }
.mg-testrow { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 12px; margin-top: 8px; font-size: 13px; font-weight: 500; }
.mg-testres { color: var(--dp-success); font-weight: 400; }
.mg-testres.bad { color: var(--dp-error); }
.mg-optrow small { display: block; margin-top: 2px; color: var(--dp-text2); font-size: 12px; line-height: 1.35; }
.mg-volrow { display: flex; align-items: center; gap: 14px; }
.mg-volrow input[type=range] { flex: 1; min-width: 0; height: 32px; accent-color: var(--dp-primary); }
.mg-volval { flex: none; min-width: 64px; text-align: right; font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
/* Auswahlgruppen im Assistenten sind Reiterleisten wie überall (.sub-tabs); der Wertwähler "− Zahl +" hat dieselbe Fläche, aber keine Kapsel */
.mg-tabs { margin: 6px 0; }
.mg-stepper { grid-template-columns: 56px minmax(0, 1fr) 56px; grid-auto-flow: column; max-width: 300px; }
.mg-stepper .sub-tab { font-size: 18px; }
.mg-valin { min-width: 0; width: 100%; box-sizing: border-box; padding: 0 6px; border: none; border-radius: 11px; background: none; color: var(--dp-text); font: inherit; font-size: 15px; font-weight: 600; text-align: center; font-variant-numeric: tabular-nums; }
.mg-valin:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: -2px; }
/* Reiter "Magic Push" in den Einstellungen (seit 2.10.0; seit 2.13.0 Gerätekarten, docs/mockups/magic-overview-v1, Variante B):
   pro Gerät eine einklappbare Karte, darin die Meldungen; darüber Suchfeld und Filter */
.mg-count { margin: 4px 0 0; color: var(--dp-text2); font-size: 12.5px; }
.mg-filter { margin: 2px 0 8px; }
.mg-allcount { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 2px 2px 2px; }
.mg-allcount .mg-count { margin: 0; }
.mg-none { margin-top: 14px; }
.mg-dcard { margin-top: 10px; border-radius: 16px; background: var(--dp-subtle); overflow: hidden; }
.mg-dhead { display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box; padding: 11px 12px; border: 0; background: color-mix(in srgb, var(--dp-text) 5%, var(--dp-subtle)); color: inherit; font: inherit; text-align: left; cursor: pointer; }
.mg-dhead:hover b { color: var(--dp-primary); }
.mg-dhead:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: -2px; }
.mg-dhead .mg-t b { font-size: 15px; }
.mg-dsum { color: var(--dp-text2); }
.mg-dsum .mg-on { color: var(--dp-primary); font-weight: 500; }
.mg-dsum .mg-warn { color: var(--dp-warning); font-weight: 500; }
.mg-badge { flex: none; min-width: 22px; height: 22px; padding: 0 7px; box-sizing: border-box; display: grid; place-items: center; border-radius: 99px; background: var(--dp-primary-soft); color: var(--dp-primary); font-size: 12px; font-weight: 600; }
.mg-dcard .mg-card { margin: 0; padding: 12px 14px 12px 12px; border-radius: 0; background: none; border-top: 1px solid var(--dp-divider); }
.mg-dfoot { padding: 8px 14px 10px 56px; border-top: 1px solid var(--dp-divider); font-size: 13px; }
.mg-dfoot { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 24px; }
.mg-devic { flex: none; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; background: var(--dp-subtle); color: var(--dp-text2); }
.mg-devic.off { background: var(--dp-error-soft); color: var(--dp-error); }
.mg-devoff { flex: none; padding: 1px 8px; border-radius: 99px; background: var(--dp-error-soft); color: var(--dp-error); font-size: 11.5px; font-weight: 500; }
.mg-freetag { color: var(--dp-text3); overflow-wrap: anywhere; }
/* Freie Entität im Assistenten (Schritt 1, ganz unten) */
.mg-freehead { margin-top: 18px; }
.mg-freebtn { border: 1.5px dashed color-mix(in srgb, var(--dp-primary) 45%, transparent); background: none; }
.mg-lchev { flex: none; display: grid; place-items: center; width: 40px; height: 40px; margin: -8px -6px -8px 0; color: var(--dp-text); transition: transform .2s ease; }
.mg-lchev.up { transform: rotate(180deg); }
@media (prefers-reduced-motion: reduce) { .mg-lchev { transition: none; } }
.mg-free { margin-top: 8px; }
/* Beim Hochscrollen unter dem Kopf und den Reitern des Popups anhalten (Kopf und Reiter bleiben stehen) */
.mg-card .mg-input { scroll-margin-top: calc(var(--dev-head-h, 100px) + 70px); }
.mgw-body .mg-input { scroll-margin-top: 8px; }

/* Bedingungen im Assistenten (seit 2.15.0, docs/mockups/magic-conditions-v1): Karten, Gruppen, Und/Oder, Rückblick je Bedingung */
.mg-sumline { margin: 8px 0 4px; padding: 10px 12px; border-radius: 12px; background: var(--dp-primary-soft); font-size: 13.5px; line-height: 1.45; overflow-wrap: anywhere; }
.mg-lcard { margin-top: 8px; border-radius: 14px; background: var(--dp-subtle); overflow: hidden; }
.mg-lcard.open { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--dp-primary) 55%, transparent); }
.mg-lhead { display: flex; align-items: center; gap: 4px; padding-right: 6px; }
.mg-lmain { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; padding: 12px 8px 12px 14px; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.mg-lmain:hover { background: var(--dp-hover); }
.mg-lmain:focus-visible, .mg-xbtn:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: -2px; }
.mg-xbtn { flex: none; display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--dp-text2); cursor: pointer; }
.mg-xbtn:hover { background: var(--dp-hover); color: var(--dp-error); }
.mg-ledit { padding: 0 14px 12px; border-top: 1px solid var(--dp-divider); }
.mg-chgent { display: block; margin: 12px 0 0; font-size: 13px; }
.mg-join { display: flex; align-items: center; gap: 8px; margin: 6px 0 -2px 18px; color: var(--dp-primary); font-size: 11.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.mg-join::before { content: ""; width: 2px; height: 14px; margin-right: 6px; border-radius: 1px; background: color-mix(in srgb, var(--dp-primary) 55%, transparent); }
.mg-group { margin-top: 8px; padding: 8px 8px 10px; border: 1.5px dashed color-mix(in srgb, var(--dp-primary) 50%, transparent); border-radius: 16px; }
.mg-ghead { display: flex; align-items: center; gap: 8px; padding: 0 2px 2px 6px; color: var(--dp-text2); font-size: 12px; }
.mg-ghead b { flex: 1; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; }
.mg-ghead .mg-tabs { margin: 0; }
.mg-mini .sub-tab { min-height: 30px; padding: 0 10px; font-size: 12px; }
.mg-addin { display: block; width: 100%; margin: 8px 0 0; text-align: center; font-size: 13px; }
.mg-adds { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.mg-adds .mg-add { margin-top: 0; }
.mg-tlr { display: grid; grid-template-columns: minmax(96px, 36%) 1fr; align-items: center; gap: 8px; margin: 6px 0; color: var(--dp-text2); font-size: 12px; }
.mg-tlr > span { overflow-wrap: anywhere; line-height: 1.25; }
.mg-tlr.tot { padding-top: 6px; border-top: 1px solid var(--dp-divider); color: var(--dp-text); }
.mg-tl { position: relative; height: 14px; border-radius: 5px; background: color-mix(in srgb, var(--dp-text) 10%, transparent); overflow: hidden; }
.mg-tl i { position: absolute; top: 0; bottom: 0; background: var(--dp-error); opacity: .75; }
.mg-tl i.all { background: var(--dp-primary); opacity: 1; }
.mg-tl i.dim { opacity: .35; }

/* Fenster des Assistenten (seit 2.11.0, docs/mockups/magic-push-dialog-v1, Variante A): Vollbild auf dem Handy, auf dem Desktop
   ein breites Fenster; Diagramm, Rückblick und Vorschau stehen dort rechts. Kopf, Fortschritt und Knöpfe bleiben stehen. */
dialog.magic-dlg { padding: 0; border: none; border-radius: 22px; background: var(--dp-card); color: var(--dp-text); box-shadow: var(--dp-shadow); overflow: hidden; overscroll-behavior: contain;
  width: min(920px, calc(100vw - 32px)); max-width: none; height: min(700px, calc(100% - 48px)); max-height: none; }
dialog.magic-dlg::backdrop { background: rgba(0,0,0,0.5); }
dialog.magic-dlg[open] { display: flex; flex-direction: column; }
dialog.magic-dlg[open] > * { flex-shrink: 0; }
.mgw-head { display: flex; align-items: center; gap: 10px; padding: 16px 14px 8px 22px; }
.mgw-t { flex: 1 1 auto; min-width: 0; }
.mgw-t b { display: block; font-size: 18px; font-weight: 500; }
.mgw-t small { display: block; margin-top: 1px; color: var(--dp-text2); font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mgw-prog { padding: 0 22px 6px; }
.mgw-prog .mg-steps { margin: 4px 0; }
dialog.magic-dlg[open] > .mgw-body { flex: 1 1 auto; flex-shrink: 1; min-height: 0; overflow: auto; padding: 2px 22px 14px; overscroll-behavior: contain; }
dialog.magic-dlg[open] > .mgw-body.two { display: flex; gap: 22px; overflow: hidden; padding: 2px 0 0 22px; }
.mgw-body.two > .mgw-main, .mgw-body.two > .mgw-side { min-height: 0; overflow: auto; overscroll-behavior: contain; padding-bottom: 14px; }
.mgw-body.two > .mgw-main { flex: 1 1 auto; min-width: 0; }
.mgw-body.two > .mgw-side { flex: 0 0 310px; box-sizing: border-box; padding: 4px 22px 14px 18px; border-left: 1px solid var(--dp-divider); background: color-mix(in srgb, var(--dp-text) 3%, var(--dp-card)); }
.mgw-side > :first-child { margin-top: 0; }
.mgw-foot { padding: 10px 22px calc(14px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--dp-divider); background: var(--dp-card); }
.mgw-foot .mg-btns { margin-top: 0; }
.mgw-ov { position: absolute; inset: 0; z-index: 5; display: flex; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box; background: rgba(0,0,0,0.55); }
.mgw-discard { width: min(340px, 100%); box-sizing: border-box; padding: 20px 20px 16px; border-radius: 18px; background: var(--dp-card); color: var(--dp-text); box-shadow: 0 10px 40px rgba(0,0,0,0.45); border: 1px solid var(--dp-divider); text-align: center; }
.mgw-discard b { display: block; font-size: 17px; font-weight: 600; }
.mgw-discard small { display: block; margin-top: 6px; color: var(--dp-text2); font-size: 13.5px; line-height: 1.45; }
.mgw-discard .mg-btns { margin-top: 16px; }
.mgw-discard .dlg-btn { flex: 1 1 0; min-width: 0; }
@media (max-width: 700px) {
  /* --mgw-top/--mgw-h: sichtbare Fläche ohne Tastatur (magic-push.js, fitWindow) */
  dialog.magic-dlg { width: 100%; max-width: 100%; height: var(--mgw-h, 100%); max-height: 100%; margin: 0; border-radius: 0; inset-block-start: var(--mgw-top, 0px); inset-block-end: auto; }
  .mgw-head { padding: 14px 12px 6px 16px; }
  .mgw-prog { padding: 0 16px 4px; }
  dialog.magic-dlg[open] > .mgw-body { padding: 2px 16px 12px; }
  .mgw-foot { padding: 10px 16px calc(14px + env(safe-area-inset-bottom, 0px)); }
}
.mg-freeval { flex: none; max-width: 40%; text-align: right; font-weight: 600; overflow-wrap: anywhere; }
.mg-opt-row b { font-weight: 500; }
/* Reiterleiste mit neun Reitern (Überwachung und Meldungen mit "Magic Push"): Desktop 5 + 4, Handy 3 × 3 */
.mon-tabs:has(> :is(.mon-tab, .sub-tab):nth-child(9)), .sub-tabs:has(> :is(.mon-tab, .sub-tab):nth-child(9)) { grid-template-columns: repeat(5, minmax(0, 1fr)); }
@media (max-width: 600px) {
  .mon-tabs:has(> :is(.mon-tab, .sub-tab):nth-child(9)), .sub-tabs:has(> :is(.mon-tab, .sub-tab):nth-child(9)) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  /* Einstellungen auf dem Handy: nur die Titel der Abschnitte, die Vorschauzeile hat kaum Platz (Wunsch des Nutzers) */
  .set-sec-sum { display: none; }
}

/* Routine (seit 2.21.0, docs/mockups/timer-v1): Wecker-Stil im Popup, Assistent mit den Stilen von Magic Push (dialog.magic-dlg) */
.rt-clock { margin-top: 8px; padding: 12px 14px; border-radius: 16px; background: var(--dp-subtle); }
.rt-clock.off { opacity: .7; }
.rt-clock .top { display: flex; align-items: center; gap: 10px; }
.rt-clock .time { font-size: 34px; font-weight: 300; letter-spacing: -.02em; line-height: 1; font-variant-numeric: tabular-nums; }
.rt-clock .time small { font-size: 14px; font-weight: 400; margin-left: 6px; color: var(--dp-text2); letter-spacing: 0; }
.rt-clock .grow { flex: 1; min-width: 0; }
/* Schalter die Routine-Karte etwas grösser als der Standard (44 × 24 statt 36 × 20 px, Wunsch des Nutzers) */
.rt-clock .switch { width: 44px; height: 24px; }
.rt-clock .switch span::after { width: 20px; height: 20px; }
.rt-clock .switch input:checked + span::after { left: 22px; }
.rt-clock .name { margin-top: 6px; font-size: 14px; font-weight: 600; }
.rt-clock .what { margin-top: 2px; color: var(--dp-text2); font-size: 12.5px; line-height: 1.35; }
.rt-days { display: flex; gap: 5px; margin-top: 9px; }
.rt-days i { flex: 1; max-width: 34px; height: 26px; display: grid; place-items: center; border-radius: 8px; font-style: normal; font-size: 11.5px; color: var(--dp-text2); background: color-mix(in srgb, var(--dp-text) 6%, transparent); }
.rt-days i.on { background: var(--dp-primary-soft); color: var(--dp-primary); font-weight: 600; }
.rt-clock .next { margin-top: 9px; padding-top: 8px; border-top: 1px solid var(--dp-divider); display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; color: var(--dp-text2); font-size: 12.5px; }
.rt-clock .next b { color: var(--dp-text); font-weight: 600; font-variant-numeric: tabular-nums; }
.rt-clock .next .acts { margin-left: auto; display: flex; flex-wrap: wrap; gap: 4px 16px; }
.rt-ring { flex: none; position: relative; width: 62px; height: 62px; }
.rt-ring svg { width: 62px; height: 62px; transform: rotate(-90deg); }
.rt-ring circle { fill: none; stroke-width: 6; }
.rt-ring .bg { stroke: color-mix(in srgb, var(--dp-text) 12%, transparent); }
.rt-ring .fg { stroke: var(--dp-primary); stroke-linecap: round; transition: stroke-dashoffset 1s linear; }
.rt-ring span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 11.5px; font-weight: 600; font-variant-numeric: tabular-nums; }
.rt-tag { display: inline-block; padding: 1px 8px; border-radius: 99px; background: var(--dp-primary-soft); color: var(--dp-primary); font-size: 11.5px; font-weight: 500; }
.rt-tag.grey { background: var(--dp-subtle); color: var(--dp-text2); }
/* Assistent */
.rt-wd { display: flex; gap: 6px; margin-top: 6px; }
.rt-wd button { flex: 1; max-width: 44px; height: 44px; border: none; border-radius: 50%; font: inherit; font-size: 13.5px; color: var(--dp-text); cursor: pointer;
  background: color-mix(in srgb, var(--dp-text) 7%, var(--dp-card)); }
.rt-wd button.on { background: var(--dp-primary); color: var(--dp-on-primary, #fff); font-weight: 600; }
.rt-wd button:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: 2px; }
.rt-timein, .rt-datein { box-sizing: border-box; height: 46px; font-size: 20px; font-variant-numeric: tabular-nums; }
.rt-timein { width: 160px; }
.rt-datein { width: 220px; max-width: 100%; }
.rt-next { margin-top: 8px; border-radius: 14px; background: var(--dp-subtle); padding: 4px 14px; }
.rt-next div { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; padding: 8px 0; font-size: 13.5px; border-top: 1px solid var(--dp-divider); }
.rt-next div:first-child { border-top: 0; }
.rt-next small { flex: 0 0 100%; margin-top: -4px; color: var(--dp-text2); font-size: 12.5px; }
.rt-next div span:last-child { color: var(--dp-text2); }
.rt-sum { margin-top: 8px; padding: 12px 14px; border-radius: 14px; background: var(--dp-primary-soft); font-size: 14.5px; line-height: 1.45; }
.rt-sum b { font-weight: 600; }
.rt-result { margin-top: 10px; }
/* Testknopf "Jetzt ausführen": echter Knopf mit Touch-Fläche (44 px), Rückmeldung daneben */
.rt-tryrow { gap: 8px 14px; margin-top: 12px; font-size: 14px; }
.rt-try { flex: 0 0 auto; height: 44px; padding: 0 22px; font-size: 15px; font-weight: 500; color: var(--dp-primary); border-color: var(--dp-primary); }
/* Auslöser und Zurückschalten (2.54.0, docs/mockups/timer-trigger-v1 und -v2) */
.sub-tabs.mg-two { grid-auto-flow: row; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.mg-k.rt-sec { margin-top: 18px; color: var(--dp-text); font-size: 14px; font-weight: 600; }
.rt-winrange { display: flex; align-items: center; gap: 10px; margin-top: 8px; color: var(--dp-text2); font-size: 13px; }
.rt-winrange .mg-input { flex: 1 1 0; min-width: 0; max-width: 170px; font-size: 18px; }
/* Zahl zum Setzen (Routine auf Zahl-Entität): Zahlenfeld neben der Einheit unter dem Regler (seit 2.80.0) */
.rt-setnum { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
.rt-setnum .mg-input { flex: 0 1 150px; min-width: 0; font-size: 18px; }
.rt-setnum span { color: var(--dp-text2); }
/* Seite "Optionen" (2.52.0, docs/mockups/timer-light-v1): Vorschau, Regler, Farben */
.to-prev { display: flex; flex-direction: column; align-items: center; gap: 4px; margin-top: 8px; padding: 14px 12px 12px; border-radius: 16px; background: var(--dp-subtle); text-align: center; }
.to-prev-n { color: var(--dp-text2); font-size: 12.5px; }
.to-prev .big { position: relative; display: grid; place-items: center; width: 92px; height: 92px; margin-top: 6px; border-radius: 50%; font-size: 44px;
  background: color-mix(in srgb, var(--pv-c, var(--dp-text)) 22%, var(--dp-card)); transition: background .2s; }
.to-prev .big::before { content: ""; position: absolute; inset: -20px; border-radius: 50%; pointer-events: none; opacity: var(--pv-o, 0); transition: opacity .2s;
  background: radial-gradient(circle, var(--pv-c, transparent) 0%, transparent 66%); }
.to-prev .big > span { position: relative; filter: brightness(var(--pv-b, 1)); }
.to-prev.off .big { background: color-mix(in srgb, var(--dp-text) 8%, var(--dp-card)); }
.to-prev.off .big > span { filter: grayscale(1) opacity(.6); }
.to-prev b { margin-top: 8px; font-size: 22px; font-weight: 600; }
.to-prev small { min-height: 1.3em; color: var(--dp-text2); font-size: 13px; }
.to-temp { font-size: 30px; font-weight: 600; font-variant-numeric: tabular-nums; }
.to-shade { position: relative; display: block; width: 58px; height: 58px; overflow: hidden; border: 3px solid var(--dp-text3); border-radius: 8px; background: color-mix(in srgb, #8ec5ff 40%, var(--dp-card)); }
.to-shade i { position: absolute; inset: 0 0 auto 0; height: var(--pv-closed, 50%); transition: height .2s;
  background: repeating-linear-gradient(180deg, color-mix(in srgb, var(--dp-text) 30%, var(--dp-card)) 0 5px, color-mix(in srgb, var(--dp-text) 15%, var(--dp-card)) 5px 7px); }
.to-k { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin: 16px 0 2px; color: var(--dp-text2); font-size: 12.5px; }
.to-k b { color: var(--dp-text); font-size: 13.5px; font-weight: 600; font-variant-numeric: tabular-nums; }
.to-range { -webkit-appearance: none; appearance: none; display: block; width: 100%; height: 34px; margin: 0; background: transparent; cursor: pointer; }
.to-range::-webkit-slider-runnable-track { height: 8px; border-radius: 4px;
  background: var(--to-track, linear-gradient(90deg, var(--dp-primary) var(--fill, 50%), color-mix(in srgb, var(--dp-text) 14%, transparent) var(--fill, 50%))); }
.to-range::-moz-range-track { height: 8px; border-radius: 4px;
  background: var(--to-track, linear-gradient(90deg, var(--dp-primary) var(--fill, 50%), color-mix(in srgb, var(--dp-text) 14%, transparent) var(--fill, 50%))); }
.to-range::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; margin-top: -8px; border: 0; border-radius: 50%; background: #fff;
  box-shadow: 0 1px 5px rgba(0, 0, 0, .45), 0 0 0 3px color-mix(in srgb, var(--dp-primary) 40%, transparent); }
.to-range::-moz-range-thumb { width: 24px; height: 24px; border: 0; border-radius: 50%; background: #fff;
  box-shadow: 0 1px 5px rgba(0, 0, 0, .45), 0 0 0 3px color-mix(in srgb, var(--dp-primary) 40%, transparent); }
.to-range.unset { --to-track: color-mix(in srgb, var(--dp-text) 14%, transparent); }
.to-range.unset::-webkit-slider-thumb { opacity: .6; }
.to-range.unset::-moz-range-thumb { opacity: .6; }
.to-range.kel { --to-track: linear-gradient(90deg, #ff8f2e, #ffd9a6 45%, #ffffff 65%, #bcd8ff); }
.to-range:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: 2px; border-radius: 6px; }
.to-ends { display: flex; justify-content: space-between; margin: -2px 0 4px; color: var(--dp-text3); font-size: 11.5px; }
.to-cols { display: flex; flex-wrap: wrap; gap: 9px; margin: 8px 0 4px; }
.to-col { position: relative; flex: none; width: 36px; height: 36px; padding: 0; border: 0; border-radius: 50%; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .18); }
.to-col.on { box-shadow: 0 0 0 2px var(--dp-card), 0 0 0 4px var(--dp-primary); }
.to-col:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: 3px; }
.to-col.none { background: color-mix(in srgb, var(--dp-text) 8%, var(--dp-card)); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--dp-text) 30%, transparent); }
.to-col.none::after { content: ""; position: absolute; left: 7px; right: 7px; top: 50%; height: 2px; border-radius: 1px; transform: rotate(-45deg); background: color-mix(in srgb, var(--dp-text) 45%, transparent); }
.to-col.none.on { box-shadow: 0 0 0 2px var(--dp-card), 0 0 0 4px var(--dp-primary); }
.to-col.more { display: block; overflow: hidden; background: conic-gradient(#f44, #fd4, #4d4, #4df, #94f, #f44); }
.to-col.more.on { overflow: visible; }
.to-col.more input { position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; border: 0; opacity: 0; cursor: pointer; }
/* Reiterleiste im Geräte-Popup (Handy: seit 2.21.0, docs/mockups/timer-v1, Entscheid zu Frage 7; Desktop: seit 2.57.0, Wunsch des Nutzers):
   jeder Reiter trägt ein Emoji. Auf dem Desktop steht es vor der Beschriftung; auf dem Handy zeigt nur der gewählte Reiter die Beschriftung. */
.dev-tabs .sub-tab::before { margin-right: 6px; font-size: 16px; line-height: 1; }
.dev-tabs .sub-tab[data-tab="ov"]::before { content: "📊"; }
.dev-tabs .sub-tab[data-tab="sw"]::before { content: "🕹️"; }
.dev-tabs .sub-tab[data-tab="set"]::before { content: "⚙️"; }
.dev-tabs .sub-tab[data-tab="ent"]::before { content: "🧩"; }
.dev-tabs .sub-tab[data-tab="magic"]::before { content: "🔔"; }
.dev-tabs .sub-tab[data-tab="routine"]::before { content: "⚡"; }
/* Zweizeilige Reiter (Name, darunter die Zahl): das Emoji steht links über beide Zeilen */
.dev-tabs .sub-tab.two { display: grid; grid-template-columns: auto auto; grid-template-rows: auto auto; justify-content: center; align-content: center; column-gap: 0; row-gap: 1px; }
.dev-tabs .sub-tab.two::before { grid-row: 1 / span 2; align-self: center; }
.dev-tabs .sub-tab.two .tab-l, .dev-tabs .sub-tab.two .tab-s { grid-column: 2; }
@media (max-width: 600px) {
  .dev-tabs .sub-tabs { display: flex; gap: 2px; }
  .dev-tabs .sub-tab { flex: 1 1 0; min-width: 0; padding: 0 4px; font-size: 0; }
  .dev-tabs .sub-tab::before { margin-right: 0; font-size: 18px; }
  .dev-tabs .sub-tab.two { display: flex; }
  .dev-tabs .sub-tab.two:not(.on) > * { display: none; }
  .dev-tabs .sub-tab.on { flex: 2.8 1 0; gap: 6px; font-size: 13.5px; }
  .dev-tabs .sub-tab.on::before { margin-right: 0; }
  .dev-tabs .sub-tab.on.two::before { display: none; }
  .dev-tabs .sub-tab.on.two .tab-l { font-size: 13px; }
}
/* Reiter "Schalter" (seit 2.58.0, docs/mockups/switches-v1, Variante C): kompakte Kacheln, drei Spalten (Handy und Desktop) */
.sw-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.sw-cell { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; padding: 12px 6px 10px; border: 0; border-radius: 16px; background: var(--dp-subtle);
  color: inherit; font: inherit; text-align: center; cursor: pointer; -webkit-touch-callout: none; }
.sw-cell:hover { background: var(--dp-hover); }
.sw-cell:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: 1px; }
.sw-ic { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; background: color-mix(in srgb, var(--dp-text) 8%, var(--dp-card)); font-size: 21px; line-height: 1; }
.sw-cell b { max-width: 100%; font-size: 12.5px; font-weight: 600; line-height: 1.2; overflow-wrap: anywhere; }
.sw-cell small { max-width: 100%; color: var(--dp-text2); font-size: 11.5px; line-height: 1.2; }
.sw-cell.on { background: var(--dp-primary-soft); }
.sw-cell.on:hover { background: var(--dp-primary-soft); filter: brightness(.97); }
.sw-cell.on .sw-ic { background: var(--dp-primary); }
.sw-cell.on small { color: var(--dp-primary); font-weight: 500; }
.sw-cell.bad { opacity: .6; }
.sw-cell.bad small { color: var(--dp-error); }
/* App-Launcher (seit 2.31.0, docs/mockups/launcher-v2): Fenster unter dem Knopf in der Kopfzeile (Desktop) oder Blatt von unten (Handy). */
dialog.apps-dlg, dialog.app-dlg { padding: 0; border: none; border-radius: 22px; background: var(--dp-card); color: var(--dp-text); box-shadow: var(--dp-shadow);
  overflow: auto; overscroll-behavior: contain; max-height: calc(100% - 48px); clip-path: inset(0 round 22px); }
dialog.apps-dlg { width: min(450px, calc(100vw - 32px)); margin: 0; inset: auto; border: 1px solid var(--dp-divider); }
dialog.app-dlg { width: min(480px, calc(100vw - 32px)); }
dialog.apps-dlg::backdrop { background: transparent; }
dialog.app-dlg::backdrop { background: rgba(0,0,0,0.5); }
.ap-head { position: sticky; top: 0; z-index: 3; display: flex; align-items: center; gap: 8px; padding: 14px 14px 6px 18px; background: var(--dp-card); }
.ap-title { flex: 1; min-width: 0; font-size: 17px; font-weight: 600; }
.ap-link { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 6px; border: 0; border-radius: 8px; background: none; color: var(--dp-primary); font: inherit; font-size: 13.5px; cursor: pointer; }
.ap-link:hover { background: var(--dp-primary-soft); }
.ap-pw { display: grid; place-items: center; flex: none; width: 32px; height: 32px; border: 0; border-radius: 50%; background: none; color: var(--dp-text2); cursor: pointer; }
.ap-pw:hover { background: var(--dp-hover); color: var(--dp-error); }
.ap-done { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 16px; border: 0; border-radius: 999px; background: var(--dp-primary); color: var(--dp-on-primary, #fff); font: inherit; font-size: 13.5px; font-weight: 500; cursor: pointer; }
.ap-x { display: none; place-items: center; flex: none; width: 36px; height: 36px; border: 1px solid var(--dp-divider); border-radius: 50%; background: var(--dp-card); color: var(--dp-text2); cursor: pointer; }
.ap-x.show { display: grid; }
.ap-body { padding: 0 14px 14px; }
.ap-search { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; border: 1px solid var(--dp-divider); border-radius: 999px; background: var(--dp-input); color: var(--dp-text2); }
.ap-q { flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; background: transparent; color: var(--dp-text); font: inherit; font-size: 14px; }
.ap-q::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; }
.ap-search .field-clear { margin-right: -6px; }
.ap-hh { display: inline-flex; margin-left: 2px; color: var(--dp-error); }
.ap-h { display: flex; align-items: center; gap: 6px; margin: 14px 4px 6px; color: var(--dp-text2); font-size: 11.5px; letter-spacing: .06em; text-transform: uppercase; }
.ap-note { margin: 6px 4px 0; color: var(--dp-text2); font-size: 12px; line-height: 1.4; }
.ap-note.first { margin-top: 0; }
.ap-note svg { vertical-align: -2px; }
.ap-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.ap-tile { position: relative; box-sizing: border-box; display: flex; min-height: 84px; border-radius: 14px; background: var(--dp-subtle); color: var(--dp-text); font: inherit; }
.ap-main { display: flex; flex: 1; min-width: 0; align-items: center; border: 0; background: none; color: inherit; font: inherit; text-decoration: none; cursor: pointer; border-radius: inherit; }
.ap-tile > .ap-main { flex-direction: column; justify-content: center; gap: 6px; padding: 18px 4px 8px; font-size: 12px; line-height: 1.2; text-align: center; }
.ap-tile > .ap-main:hover, .ap-row > .ap-main:hover { background: var(--dp-hover); }
.ap-main:focus-visible, .ap-a:focus-visible, .ap-drag:focus-visible, .ap-ic:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: -2px; }
.ap-nm { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; max-width: 100%; overflow: hidden; overflow-wrap: break-word; }
.ap-ico { display: grid; place-items: center; flex: none; width: 40px; height: 40px; border-radius: 50%; background: var(--dp-primary-soft); color: var(--dp-primary); }
.ap-ico.sm { width: 34px; height: 34px; }
/* Eigene Apps ohne Favicon: Kreis in der Hauptfarbe, weisses Symbol (Apps von HA und des Panels tragen ihre Farbe als Stil) */
.ap-ico.own { background: var(--dp-primary); color: var(--dp-on-primary, #fff); }
/* Aktion (seit 2.115.0): läuft (Pfeile drehen sich), fertig (grüner Haken, grüner Rand), fehlgeschlagen (rot) */
/* Die Pfeile des Symbols laufen im Uhrzeigersinn (seit 2.130.0 gespiegelt): die Drehung auch, in Pfeilrichtung */
.ap-spin { display: inline-flex; animation: ap-spin 0.9s linear infinite; }
@keyframes ap-spin { to { transform: rotate(360deg); } }
.ap-ico.run-ok, .rtall-btn.app-pin.run-ok { background: var(--dp-success); color: #fff; }
.ap-ico.run-err, .rtall-btn.app-pin.run-err { background: var(--dp-error); color: #fff; }
.ap-tile.run-ok, .ap-row.run-ok, .rtall-btn.app-pin.run-ok { box-shadow: inset 0 0 0 2px var(--dp-success); }
.ap-tile.run-err, .ap-row.run-err, .rtall-btn.app-pin.run-err { box-shadow: inset 0 0 0 2px var(--dp-error); }
.ap-tile.run-ok, .ap-tile.run-err, .ap-row.run-ok, .ap-row.run-err { border-radius: 14px; }
@media (prefers-reduced-motion: reduce) { .ap-spin { animation-duration: 3s; } }
.ap-a.dis { opacity: .35; cursor: default; }
/* Pille "Debug" / "Störung" an der Kachel: oben in der Mitte, über dem Symbol (das Polster oben ist dafür 18 px; bei 7 px links überlappte sie das Symbol) */
.ap-badge { position: absolute; top: 3px; left: 50%; transform: translateX(-50%); padding: 0 6px; border-radius: 99px; background: var(--dp-warning-soft); color: var(--dp-warning); font-size: 9.5px; line-height: 14px; font-weight: 600; white-space: nowrap; }
/* Status-App (seit 2.62.0, docs/mockups/status-v1) */
.st-wrap .opt { margin-top: 0; }
.st-banner { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 18px; margin: 0 0 8px; }
.st-banner.ok { background: var(--dp-success-soft); color: var(--dp-success); }
.st-banner.bad { background: var(--dp-error-soft); color: var(--dp-error); }
.st-banner .ic { flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: color-mix(in srgb, currentColor 16%, transparent); }
.st-banner b { display: block; font-size: 15px; font-weight: 600; }
.st-banner small { display: block; margin-top: 2px; font-size: 12.5px; line-height: 1.35; opacity: .9; }
.st-sys { margin: 0 0 10px; padding: 12px 14px 10px; border-radius: 18px; background: var(--dp-subtle); }
.st-sys-head { display: flex; align-items: baseline; gap: 10px; }
.st-sys-t { flex: 1; min-width: 0; }
.st-sys-t b { display: block; font-size: 14.5px; font-weight: 600; }
.st-sys-t small { display: block; margin-top: 1px; font-size: 12px; color: var(--dp-text2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-sys-val { font-size: 26px; font-weight: 500; font-variant-numeric: tabular-nums; }
.st-sys-val small { font-size: 14px; margin-left: 2px; color: var(--dp-text2); }
.st-sys-size { margin: 2px 0 0; font-size: 12.5px; color: var(--dp-text2); font-variant-numeric: tabular-nums; }
.st-sys .sub-tabs { margin: 8px 0 0; }
.st-sys-plot { position: relative; height: 84px; margin: 8px 0 0 30px; }
.st-sys-plot .bh-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.st-sys-y { position: absolute; left: -30px; width: 24px; transform: translateY(-50%); text-align: right; color: var(--dp-text3); font-size: 10.5px; }
.st-sys-ticks { margin-left: 30px; }
.bh-grid.bh-v { stroke-dasharray: 2 4; opacity: 0.7; }
.st-sys-foot { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0 0 30px; font-size: 11.5px; color: var(--dp-text3); }
.st-sys-foot .mid { color: var(--dp-text2); text-align: center; flex: 1; }
.st-ctl { display: inline-flex; align-items: center; gap: 14px; flex: none; }
/* Platz des Schalters in der Zeile Mindestdauer, damit das Feld über denen der Grenzen steht (seit 2.74.0) */
.st-ctl .st-pad { flex: none; width: 36px; height: 20px; }
.opt-line.st-min { margin-top: 8px; } /* Mindestdauer unter der Grenze: die zwei Kästchen sollen sich nicht berühren */
.st-sys-act { margin: 6px 0 0; }
.st-sys-list { margin: 4px 0 6px 18px; padding: 0; font-size: 13px; } .st-sys-list small { color: var(--dp-text2); }
.st-sys .st-confirm { margin: 8px 0 0; background: var(--dp-bg); }
.st-sys-note.ok { color: var(--dp-success); }
.st-pickbtn { display: inline-flex; align-items: center; justify-content: space-between; gap: 8px; max-width: 62%; min-width: 0; padding: 8px 12px; border: 1px solid var(--dp-divider); border-radius: 12px; background: var(--dp-card); color: inherit; font: inherit; font-size: 14px; cursor: pointer; }
.st-pickbtn span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-pickbtn:focus-visible, .st-opt:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: 2px; }
.st-pick { margin: 8px 0 4px; }
.st-pick-list { margin: 8px 0 0; max-height: 260px; overflow-y: auto; border-radius: 14px; background: var(--dp-subtle); }
.st-opt { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; padding: 10px 14px; border: 0; border-top: 1px solid var(--dp-divider); background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.st-opt:first-child { border-top: 0; }
.st-opt:hover { background: var(--dp-hover); }
.st-opt.on { color: var(--dp-primary); }
.st-opt-t { min-width: 0; }
.st-opt-t b { display: block; font-size: 14px; font-weight: 500; overflow-wrap: anywhere; }
.st-opt-t small { display: block; margin-top: 1px; font-size: 12px; color: var(--dp-text2); overflow-wrap: anywhere; }
.st-sys-note { margin: 8px 0 0; font-size: 12.5px; color: var(--dp-text2); line-height: 1.4; }
.st-sys-note.warn { color: var(--dp-warning); }
.st-card { border-radius: 18px; background: var(--dp-subtle); overflow: hidden; }
.st-line { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-top: 1px solid var(--dp-divider); }
.st-line:first-child { border-top: 0; }
.st-t { flex: 1; min-width: 0; }
.st-t b { display: block; font-size: 14.5px; font-weight: 600; }
.st-t small { display: block; margin-top: 2px; color: var(--dp-text2); font-size: 12.5px; line-height: 1.35; }
.st-acts { display: block; margin-top: 4px; }
.st-confirm { margin: 0; padding: 12px 14px; border-top: 1px solid var(--dp-divider); border-radius: 0; background: var(--dp-card); }
.st-flash { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; padding: 10px 14px; border-radius: 14px; background: var(--dp-success-soft); color: var(--dp-success); font-size: 13px; }
.st-start { margin: 12px 2px 0; color: var(--dp-text2); font-size: 12.5px; line-height: 1.4; }
.ap-badge.bad { background: var(--dp-error-soft); color: var(--dp-error); }
.ap-t b .ap-badge { position: static; margin-left: 6px; }
.ap-ext { position: absolute; right: 8px; bottom: 6px; display: inline-flex; color: var(--dp-text2); }
.ap-ext.in { position: static; margin-right: 4px; }

.ap-rows { display: block; }
.ap-row { position: relative; display: flex; align-items: center; min-height: 52px; border-radius: 0; }
.ap-row + .ap-row { border-top: 1px solid var(--dp-divider); }
.ap-row > .ap-main.row { border-radius: 0; gap: 12px; padding: 0 6px; min-height: 52px; text-align: left; }
.ap-t { flex: 1; min-width: 0; font-size: 14.5px; }
.ap-t b { display: block; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap-t small { display: block; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dp-text2); font-size: 12px; }
/* Bearbeiten-Modus */
.ap-view { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 10px; font-size: 14px; }
.ap-view small { display: block; color: var(--dp-text2); font-size: 11.5px; }
.ap-view .sub-tabs { flex: none; width: 190px; margin: 0; }
.ap-box { display: block; }
.ap-erow { position: relative; display: flex; align-items: center; gap: 6px; min-height: 48px; padding: 0 2px 0 0; border-radius: 0; background: var(--dp-card); font-size: 14.5px; }
.ap-erow + .ap-erow { border-top: 1px solid var(--dp-divider); }
.ap-erow.hid { opacity: .55; }
.ap-erow.hid .ap-t b { text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--dp-text2) 60%, transparent); }
.ap-erow.lift { z-index: 3; border-radius: 12px; margin: 2px -4px; padding: 0 6px 0 4px; border: 1px solid color-mix(in srgb, var(--dp-primary) 45%, transparent); box-shadow: 0 8px 22px rgba(0,0,0,.28); }
.ap-drag { flex: none; display: grid; place-items: center; width: 30px; height: 44px; padding: 0; border: 0; background: none; color: var(--dp-text2); cursor: grab; touch-action: none; }
.ap-drag:active { cursor: grabbing; }
.ap-a { flex: none; display: grid; place-items: center; width: 36px; height: 40px; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--dp-text2); cursor: pointer; }
.ap-a:hover:not(.dis) { background: var(--dp-hover); color: var(--dp-text); }
.ap-a.heart.on { color: var(--dp-error); }
.ap-a.del { color: var(--dp-error); }
/* Grenze der Kopfzeile am Handy: gestrichelte Linie mit Beschriftung über der dritten Zeile der Favoriten (am Handy gelten die ersten zwei) */
.ap-box.fav > .ap-erow:nth-child(3) { margin-top: 24px; }
.ap-box.fav > .ap-erow:nth-child(3)::before { content: attr(data-mark); position: absolute; left: 0; right: 0; top: -22px; display: flex; align-items: center; justify-content: center; height: 20px;
  border-top: 1.5px dashed color-mix(in srgb, var(--dp-text2) 55%, transparent); color: var(--dp-text2); font-size: 11.5px; line-height: 1; padding-top: 3px; box-sizing: border-box; }
.ap-addbtn { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 44px; padding: 0 6px; border: 0; border-radius: 12px; background: none; color: var(--dp-primary); font: inherit; font-size: 14px; cursor: pointer; }
.ap-addbtn:hover { background: var(--dp-primary-soft); }
.ap-reset { display: flex; align-items: center; gap: 8px; margin: 14px 4px 0; padding-top: 10px; border-top: 1px solid var(--dp-divider); font-size: 12px; color: var(--dp-text2); }
.ap-reset .ap-link { padding: 0; font-size: 13.5px; }
.ap-reset > span { margin-left: auto; text-align: right; }
/* Formular "Eigene App" */
.ap-f { display: block; margin: 14px 0 0; }
.ap-f > span { display: block; margin-bottom: 6px; color: var(--dp-text2); font-size: 12.5px; }
.ap-in { box-sizing: border-box; width: 100%; height: 44px; padding: 0 14px; border: 1px solid var(--dp-divider); border-radius: 12px; background: var(--dp-input); color: var(--dp-text); font: inherit; font-size: 16px; }
.ap-in:focus { outline: 2px solid var(--dp-primary); outline-offset: -1px; border-color: transparent; }
.ap-icons { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 6px; }
/* Favicon in Originalfarben (seit 2.33.1, Wunsch des Nutzers): kein blauer Kreis, kein Umfärben; auf einer hellen, abgerundeten Fläche,
   damit auch dunkle Symbole (zum Beispiel GitHub) im dunklen Design zu sehen sind */
.ap-fi { display: block; box-sizing: content-box; padding: 2px; border-radius: 7px; background: #fff; object-fit: contain;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--dp-text) 14%, transparent); }
.ap-ico:has(> .ap-fi) { background: none; }
.ap-ico > .ap-fi { width: 32px; height: 32px; }
.ap-ico.sm > .ap-fi { width: 26px; height: 26px; }
.rtall-btn .ap-fi { width: 24px; height: 24px; }
.ap-f .sub-tabs { margin: 0 0 10px; }
.sub-tab:disabled { opacity: .4; cursor: default; }
.ap-icons[hidden], .ap-favpane[hidden] { display: none; }
.ap-favrow { display: flex; align-items: center; gap: 14px; padding: 10px 12px; border-radius: 14px; background: var(--dp-subtle); }
.ap-favbox { display: grid; place-items: center; flex: none; width: 52px; height: 52px; border-radius: 14px; background: var(--dp-card); border: 1px dashed var(--dp-divider); }
.ap-favctl { flex: 1; min-width: 0; }
.ap-favctl .dlg-btn { flex: none; min-height: 42px; width: 100%; }
.ap-favctl .dlg-btn:disabled { opacity: .45; cursor: default; }
.ap-favctl .ap-hint { margin: 6px 0 0; }
.ap-ic { display: grid; place-items: center; height: 40px; padding: 0; border: 0; border-radius: 12px; background: var(--dp-subtle); color: var(--dp-text2); cursor: pointer; }
.ap-ic.on { background: var(--dp-primary-soft); color: var(--dp-primary); box-shadow: inset 0 0 0 1.5px var(--dp-primary); }
.ap-chk { display: flex; align-items: center; gap: 12px; min-height: 48px; margin-top: 10px; cursor: pointer; font-size: 14.5px; }
.ap-ta { height: auto; min-height: 84px; padding: 10px 14px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; line-height: 1.4; }
.ap-chk input { flex: none; width: 22px; height: 22px; margin: 0; accent-color: var(--dp-primary); }
.ap-chk small { display: block; color: var(--dp-text2); font-size: 12px; }
.ap-hint { margin: 6px 2px 0; color: var(--dp-text2); font-size: 12px; line-height: 1.4; }
.ap-prev { display: flex; align-items: center; gap: 12px; margin-top: 14px; padding: 10px 12px; border-radius: 14px; background: var(--dp-subtle); }
.ap-prev .ap-tile { flex: none; width: 88px; background: var(--dp-card); }
.ap-prev .ap-tile > .ap-main { cursor: default; }
.ap-prev p { margin: 0; color: var(--dp-text2); font-size: 12.5px; line-height: 1.4; }
.ap-err { margin-top: 12px; padding: 10px 12px; border-radius: 10px; background: var(--dp-error-soft); color: var(--dp-error); font-size: 14px; }
.ap-err[hidden] { display: none; }
.ap-snack { position: sticky; bottom: 10px; z-index: 5; box-sizing: border-box; display: flex; align-items: center; gap: 14px; width: max-content; max-width: calc(100% - 28px); margin: 0 auto 10px; padding: 10px 16px;
  border-radius: 12px; background: #323232; color: #fff; font-size: 14px; line-height: 1.35; box-shadow: 0 6px 20px rgba(0,0,0,.35); }
.ap-snack.act { padding: 6px 8px 6px 16px; }
.ap-snack button { flex: none; height: 32px; padding: 0 10px; border: 0; border-radius: 8px; background: none; color: #8ecbff; font: inherit; font-weight: 600; cursor: pointer; }
.ap-snack button:hover { background: rgba(255,255,255,.1); }
.ap-acts { position: sticky; bottom: 0; display: flex; gap: 10px; padding: 12px 14px 16px; background: var(--dp-card); }
@media (max-width: 600px) {
  dialog.app-dlg { width: 100%; max-width: 100%; margin: auto 0 0; inset: auto 0 0 0; border: none; border-radius: 22px 22px 0 0; max-height: 92%; }
  /* Launcher auf dem Handy vollflächig wie "Alle Routinen" (seit 2.60.0, Wunsch des Nutzers); das Kreuz sitzt wie dort (38 px, 12 px vom Rand oben und rechts) */
  dialog.apps-dlg { width: 100%; max-width: 100%; height: 100%; max-height: 100%; margin: 0; inset: 0; border: none; border-radius: 0; clip-path: none; }
  dialog.apps-dlg::backdrop { background: rgba(0,0,0,0.5); }
  .ap-head { padding: 12px 12px 8px 16px; }
  .ap-x { display: grid; width: 38px; height: 38px; }
  .ap-pw { width: 38px; height: 38px; }
  .ap-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .ap-view .sub-tabs { width: 170px; }
  .ap-ic { height: 44px; }
  .ap-a { width: 38px; height: 44px; }
}
@media (prefers-reduced-motion: no-preference) { .ap-tile, .ap-erow { transition: background .15s ease; } }
/* Protokoll einer Meldung oder Routine (seit 2.104.0, docs/mockups/protocol-v1, Variante A): Hülle wie das Aktivitätsprotokoll (log-dlg) */
.lg-bar [hidden] { display: none; }
.lg-bar[hidden] { display: none; }
.pr-dates { display: flex; gap: 12px; flex-wrap: wrap; font-size: 13px; color: var(--dp-text2); }
.pr-dates label { display: inline-flex; align-items: center; gap: 8px; }
.pr-dates input[type="date"] { height: 34px; padding: 0 10px; border: 1px solid var(--dp-divider); border-radius: 10px; background: var(--dp-input); color: var(--dp-text); font: inherit; }
.pr-body { padding-bottom: 14px; }
.pr-kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin: 4px 0 10px; }
.pr-k { background: var(--dp-subtle); border-radius: 12px; padding: 8px 10px; min-width: 0; }
.pr-k b { display: block; font-size: 18px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pr-k span { display: block; font-size: 11.5px; color: var(--dp-text2); }
.pr-chart { display: flex; align-items: flex-end; gap: 2px; height: 84px; padding: 4px 2px 0; border-bottom: 1px solid var(--dp-divider); }
.pr-bar { flex: 1 1 0; min-width: 0; height: 100%; display: flex; align-items: flex-end; justify-content: center; padding: 0; margin: 0; border: 0; background: transparent; cursor: pointer; border-radius: 3px 3px 0 0; }
.pr-bar:hover { background: var(--dp-hover); }
.pr-bar:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: -2px; }
.pr-col { display: flex; flex-direction: column; width: 100%; max-width: 22px; min-height: 3px; border-radius: 3px 3px 0 0; overflow: hidden; }
.pr-col i { display: block; min-height: 2px; }
.pr-col .ok { background: var(--dp-primary); }
.pr-col .bad { background: var(--dp-error); }
.pr-axis { display: flex; justify-content: space-between; font-size: 11px; color: var(--dp-text3); padding: 2px 2px 8px; }
.pr-table { margin-top: 4px; }
.pr-row { display: grid; grid-template-columns: 170px 120px minmax(0, 1fr) 150px 110px; gap: 10px; align-items: start; width: 100%; box-sizing: border-box; margin: 0; padding: 9px 4px; border: 0; border-bottom: 1px solid var(--dp-divider); background: transparent; color: var(--dp-text); font: inherit; font-size: 13px; text-align: left; }
button.pr-row { cursor: pointer; }
button.pr-row:disabled { cursor: default; opacity: 1; }
button.pr-row:not(:disabled):hover { background: var(--dp-hover); }
.pr-row small { display: block; color: var(--dp-text2); font-size: 12px; overflow-wrap: anywhere; }
.pr-row .pr-err { color: var(--dp-error); }
.pr-row > span { min-width: 0; }
.pr-row .c-main b { font-weight: 600; word-break: break-word; }
.pr-row .c-val { color: var(--dp-text2); }
.pr-row .pr-go { text-align: right; color: var(--dp-text3); }
/* Meldungen mit Text lassen sich aufklappen: Pfeil neben dem Wert, offen nach oben (wie in der Liste "Alles") */
.pr-row .c-val.has-arrow { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.pr-row .pr-arrow { display: grid; place-items: center; flex: none; color: var(--dp-text2); transition: transform 0.15s ease; }
.pr-item.open > .pr-row .pr-arrow { transform: rotate(180deg); color: var(--dp-primary); }
button.pr-row:hover .pr-arrow { color: var(--dp-primary); }
.pr-head { position: sticky; top: 0; z-index: 1; background: var(--dp-card); padding: 8px 4px 6px; font-size: 11.5px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--dp-text2); }
.pr-item.open > .pr-row { background: var(--dp-primary-soft); }
.pr-msg { margin: 0 4px 8px; padding: 9px 12px; border: 1px solid var(--dp-divider); border-radius: 12px; background: var(--dp-card); font-size: 13px; word-break: break-word; }
.pr-msg b { display: block; font-weight: 600; margin-bottom: 2px; }
.pr-msg span { display: block; white-space: pre-wrap; color: var(--dp-text2); }
.pr-msg small { display: block; margin-top: 4px; font-size: 12px; color: var(--dp-text2); }
/* Geräteprotokoll (2.118.0): Liste "Alles" im Protokoll-Fenster */
.al-row { grid-template-columns: 62px 86px minmax(0, 1fr); }
.al-row .lg-pill { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.lg-pill.magic, .lg-pill.routine, .lg-pill.signal { background: var(--dp-primary-soft); color: var(--dp-primary); }
.lg-pill.updates, .lg-pill.new { background: var(--dp-subtle); color: var(--dp-text2); }
button.al-row { border-bottom: 1px solid var(--dp-divider); }
.pr-list .pr-item.open > .al-row { background: var(--dp-primary-soft); }
/* Pfeil am Ende antippbarer Zeilen im Protokoll (seit 2.127.0): aufklappbar nach unten (offen: nach oben), Ablauf oder Gerät nach rechts */
.lg-row.has-chev { position: relative; padding-right: 36px; }
.lg-row .al-chev { position: absolute; right: 8px; top: 50%; display: grid; place-items: center; width: 22px; height: 22px; margin-top: -11px; color: var(--dp-text2); transition: transform 0.15s ease; }
.pr-item.open > .al-row .al-chev { transform: rotate(180deg); color: var(--dp-primary); }
button.lg-row.has-chev:hover .al-chev { color: var(--dp-primary); }
@media (max-width: 700px) { .al-row { grid-template-columns: 52px minmax(0, 1fr); grid-template-areas: "rt cat" ". msg"; gap: 4px 10px; } .al-row > .lg-rt { grid-area: rt; } .al-row > span:nth-child(2) { grid-area: cat; } .al-row > .lg-msg { grid-area: msg; } }
.pr-st { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 11.5px; font-weight: 500; background: var(--dp-subtle); color: var(--dp-text2); }
.pr-st.ok { background: var(--dp-success-soft); color: var(--dp-success); }
.pr-st.wn { background: var(--dp-warning-soft); color: color-mix(in srgb, var(--dp-warning) 70%, var(--dp-text)); }
.pr-st.er { background: var(--dp-error-soft); color: var(--dp-error); }
.pr-st.in { background: var(--dp-primary-soft); color: var(--dp-primary); }
.pr-more { margin: 10px auto 0; display: flex; }
[data-pr-foot] { flex-wrap: wrap; row-gap: 8px; }
.pr-count { margin-left: 4px; }
@media (max-width: 700px) { .pr-count { display: none; } }
[data-pr-foot] .lg-btn { white-space: nowrap; }
[data-pr-foot] .lg-btn:disabled { opacity: .45; cursor: default; }
.pr-note { margin: 12px 2px 0; font-size: 12px; color: var(--dp-text2); }
.pr-trace-head { margin: 4px 0 8px; }
.pr-trace-head b { display: block; font-size: 15px; }
.pr-trace-head small { color: var(--dp-text2); font-size: 12.5px; word-break: break-word; }
.pr-trace { border: 1px solid var(--dp-divider); border-radius: 12px; background: var(--dp-subtle); padding: 6px 10px 10px; font-size: 13px; }
.tr-line { display: grid; grid-template-columns: 22px 110px minmax(0, 1fr); gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--dp-divider); }
.tr-line:last-of-type { border-bottom: 0; }
.tr-n { color: var(--dp-text3); font-variant-numeric: tabular-nums; }
.tr-l { color: var(--dp-text2); }
.tr-t { white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12.5px; }
.tr-line.ok .tr-n { color: var(--dp-success); }
.tr-line.er .tr-t, .tr-line.er .tr-n { color: var(--dp-error); }
.tr-line.wn .tr-t, .tr-line.wn .tr-n { color: color-mix(in srgb, var(--dp-warning) 70%, var(--dp-text)); }
.tr-result { margin-top: 8px; }
@media (max-width: 700px) {
  .pr-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pr-k:last-child:nth-child(odd) { grid-column: 1 / -1; }
  .pr-head { display: none; }
  .pr-row { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "date kind" "main main" "res val"; gap: 4px 10px; padding: 10px 2px; }
  .pr-row .c-date { grid-area: date; }
  .pr-row .c-kind { grid-area: kind; text-align: right; }
  .pr-row .c-main { grid-area: main; }
  .pr-row .c-res { grid-area: res; }
  .pr-row .c-val { grid-area: val; text-align: right; }
  .pr-row .c-val.has-arrow { justify-content: flex-end; }
  .tr-line { grid-template-columns: 20px minmax(0, 1fr); grid-template-areas: "n l" ". t"; gap: 2px 8px; }
  .tr-n { grid-area: n; } .tr-l { grid-area: l; } .tr-t { grid-area: t; }
}
/* Einrichtungsassistent (seit 2.135.0, docs/mockups/wizard-v1): Popup am Desktop, Vollbild am Handy */
dialog.wizard-dlg { padding: 0; border: none; border-radius: 22px; background: var(--dp-card); color: var(--dp-text); box-shadow: var(--dp-shadow); width: min(640px, calc(100vw - 32px)); height: min(640px, calc(100% - 48px)); max-height: calc(100% - 48px); overflow: hidden; margin: auto; }
dialog.wizard-dlg::backdrop { background: rgba(0,0,0,0.5); }
dialog.wizard-dlg[open] { display: flex; flex-direction: column; }
/* Kopf wie bei den anderen Fenstern: das Standard-Kreuz (.dlg-close) ganz oben rechts, darunter der Fortschritt */
.wz-ask { position: absolute; inset: 0; z-index: 5; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(0,0,0,0.45); }
.wz-ask-c { width: min(360px, 100%); background: var(--dp-card); border-radius: 18px; padding: 20px; display: flex; flex-direction: column; gap: 8px; box-shadow: var(--dp-shadow); }
.wz-ask-c b { font-size: 17px; }
.wz-ask-c p { margin: 0 0 8px; color: var(--dp-muted, inherit); font-size: 14px; line-height: 1.4; }
.wz-ask-c .dlg-btn { flex: none; min-height: 44px; justify-content: center; }
.wz-top { padding: 20px 16px 6px 22px; flex: none; }
.wz-prog { margin-top: 8px; height: 5px; border-radius: 3px; background: var(--dp-bar-off); overflow: hidden; }
.wz-prog i { display: block; height: 100%; background: var(--dp-primary); border-radius: 3px; transition: width .25s; }
.wz-stp { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 42px; color: color-mix(in srgb, var(--dp-text) 65%, transparent); font-size: 12.5px; }
.wz-stp b { color: var(--dp-text); font-weight: 500; }
.wz-stp .dlg-close { margin-left: auto; }
.wz-bd { flex: 1; min-height: 0; overflow-y: auto; padding: 6px 20px 12px; }
.wz-ft { display: flex; gap: 10px; padding: 12px 20px 16px; border-top: 1px solid var(--dp-divider); flex: none; padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px)); }
.wz-ft .dlg-btn { flex: 1; justify-content: center; }
.wz-welcome-ft { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.wz-welcome-ft .dlg-btn { flex: none; min-height: 44px; justify-content: center; }
/* Zweitknöpfe: zwei gleich breite nebeneinander, "Entwurf verwerfen" (falls da) darunter über die ganze Breite, alle im selben Stil mit Symbol */
.wz-ft2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.wz-ft2 .dlg-btn { flex: none; min-height: 44px; padding: 0 10px; justify-content: center; background: transparent; }
.wz-ft2 .dlg-btn:hover { background: var(--dp-hover); }
.wz-ft2 .wz-reset { grid-column: 1 / -1; }
.wz-hero { width: 76px; height: 76px; border-radius: 22px; background: var(--dp-primary-soft); color: var(--dp-primary); display: grid; place-items: center; margin: 20px 0 6px; }
.wz-h { font-size: 23px; font-weight: 500; margin: 12px 0 6px; }
.wz-h2 { font-size: 20px; font-weight: 500; margin: 12px 0 6px; }
.wz-p { color: color-mix(in srgb, var(--dp-text) 70%, transparent); font-size: 14px; margin: 0 0 10px; }
.wz-p.small { font-size: 12.5px; }
.wz-pts { display: flex; flex-direction: column; gap: 10px; margin: 14px 0; }
.wz-pts > div { display: flex; gap: 12px; align-items: flex-start; font-size: 14.5px; }
.wz-pts u { text-decoration: none; flex: none; width: 30px; height: 30px; border-radius: 9px; background: var(--dp-subtle); display: grid; place-items: center; color: var(--dp-primary); font-size: 14px; }
.wz-pts small { display: block; color: color-mix(in srgb, var(--dp-text) 65%, transparent); font-size: 12.5px; }
.wz-li { display: flex; align-items: center; gap: 12px; padding: 10px 2px; border-top: 1px solid var(--dp-divider); }
[data-wz-list] > .wz-li:first-child, .wz-sum > .wz-li:first-child { border-top: 0; }
.wz-ic { display: inline-grid; place-items: center; flex: none; width: 34px; height: 34px; border-radius: 10px; background: var(--dp-subtle); color: var(--dp-text); }
.wz-nm { flex: 1; min-width: 0; font-size: 15px; }
.wz-nm small { display: block; color: color-mix(in srgb, var(--dp-text) 65%, transparent); font-size: 12.5px; }
.wz-tag { font-size: 11px; border-radius: 999px; padding: 1px 8px; border: 1px solid color-mix(in srgb, var(--dp-warning) 55%, transparent); color: var(--dp-warning); margin-left: 6px; white-space: nowrap; }
.wz-tip { background: var(--dp-primary-soft); border-radius: 12px; padding: 9px 12px; font-size: 12.5px; margin: 8px 0; }
.wz-grp { display: flex; align-items: center; gap: 10px; border-top: 1px solid var(--dp-divider); padding-right: 2px; }
.wz-gh { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; padding: 9px 2px; border: 0; background: transparent; color: inherit; font: inherit; font-size: 14.5px; text-align: left; cursor: pointer; }
.wz-chev { display: inline-grid; color: color-mix(in srgb, var(--dp-text) 55%, transparent); transition: transform .15s; }
.wz-chev.open { transform: rotate(90deg); }
.wz-mx .wz-chev, .wz-gh .wz-chev { display: inline-grid; place-items: center; width: 24px; height: 24px; border: 1px solid var(--dp-primary); border-radius: 50%; background: var(--dp-primary-soft); color: var(--dp-primary); }
.wz-mx .wz-chev svg, .wz-gh .wz-chev svg { width: 16px; height: 16px; fill: currentColor; }
.wz-mx:hover .wz-chev { background: color-mix(in srgb, var(--dp-primary) 26%, transparent); }
/* Pfeil-Knopf (Regel "Pfeile", seit 2.144.0): jeder Pfeil, der eine Zeile, Kachel oder einen Abschnitt öffnet oder weiterspringt; immer 24 px, rund, blauer Rand (KI-Zeile violett). Nicht für Dropdowns und Auswahlfelder und nicht für lange Listen (Protokoll). */
.cbtn { display: inline-grid; place-items: center; flex: none; width: 24px; height: 24px; border: 1px solid var(--dp-primary); border-radius: 50%; background: var(--dp-primary-soft); color: var(--dp-primary); vertical-align: middle; }
.cbtn svg { width: 16px; height: 16px; fill: currentColor; }
.wz-gn { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wz-cn { color: color-mix(in srgb, var(--dp-text) 65%, transparent); font-size: 12.5px; margin-right: 6px; white-space: nowrap; }
.wz-li .ibadge.has-img, .wz-gh .ibadge.has-img { background: var(--dp-subtle); }
.wz-mx { flex: none; display: inline-grid; place-items: center; width: 24px; height: 24px; margin-right: 2px; padding: 0; border: 0; background: transparent; cursor: pointer; }
.wz-msub { margin: 0 0 6px 46px; }
.wz-dsub { margin-left: 34px; }
.wz-down { display: inline-flex; align-items: center; gap: 5px; font-style: normal; font-weight: 600; color: var(--dp-error); }
.wz-down::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.wz-li.dim { opacity: .5; }
.wz-msub > .wz-p { margin: 4px 0; }
.wz-sub { margin-left: 26px; border-left: 2px solid var(--dp-divider); padding-left: 10px; }
.wz-sub .wz-li { padding: 7px 2px; }
.wz-sub .wz-nm { font-size: 14px; }
.switch.part span { background: color-mix(in srgb, var(--dp-primary) 55%, transparent); }
.wz-lab { font-size: 12px; letter-spacing: .07em; text-transform: uppercase; color: color-mix(in srgb, var(--dp-text) 65%, transparent); margin: 14px 2px 4px; }
.wz-sel { position: relative; display: flex; align-items: center; border: 1px solid var(--dp-divider); border-radius: 12px; margin: 4px 0 10px; }
.wz-sel select { appearance: none; flex: 1; min-width: 0; border: 0; background: transparent; color: inherit; font: inherit; font-size: 14.5px; padding: 12px 40px 12px 12px; cursor: pointer; }
.wz-sel svg { position: absolute; right: 10px; pointer-events: none; }
.wz-testrow { display: flex; flex-direction: column; align-items: stretch; gap: 6px; margin-bottom: 6px; }
.wz-testrow .dlg-btn { width: 100%; }
.wz-testres { font-size: 12.5px; text-align: center; min-height: 1em; }
.wz-testres.ok { color: var(--dp-success); }
.wz-testres.fail { color: var(--dp-error); }
.wz-msg { border-top: 1px solid var(--dp-divider); padding: 2px 0 8px; }
.wz-msg .wz-li { border-top: 0; }
/* Werte der Meldungen: keine Umrandung, die Zahl gross in einem ruhigen Feld */
.st-tile.stale .st-v { opacity: .6; }
.bat.stale { opacity: .6; }
.accent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 8px; margin: 6px 0 4px; }
.accent-sw { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 12px; border: 1px solid var(--dp-divider); border-radius: 12px; background: var(--dp-card); color: var(--dp-text); font: inherit; font-size: 13.5px; cursor: pointer; text-align: left; }
.accent-sw i { flex: none; width: 16px; height: 16px; border-radius: 50%; background: var(--a); }
.accent-sw:hover { background: var(--dp-hover); }
.accent-sw.on { border-color: var(--a); box-shadow: inset 0 0 0 1px var(--a); font-weight: 600; }
.accent-sw:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: 2px; }
.wz-h2b { margin-top: 26px; }
.wz-vals { display: flex; flex-direction: column; gap: 4px; margin: 0 0 4px 46px; }
.wz-msg:not(.on) .wz-vals { opacity: .55; }
.wz-v { display: flex; align-items: center; gap: 8px; font-size: 14px; padding: 2px 0; }
.wz-v span { flex: 1; min-width: 0; }
.wz-v input { width: 76px; border: 0; border-radius: 10px; background: var(--dp-subtle); color: var(--dp-text); font: inherit; font-size: 18px; font-weight: 500; text-align: right; padding: 8px 12px; }
.wz-v input[type="time"] { width: auto; text-align: center; }
.wz-v input:focus { outline: 2px solid var(--dp-primary); outline-offset: 0; }
.wz-v em { font-style: normal; color: color-mix(in srgb, var(--dp-text) 65%, transparent); font-size: 13px; min-width: 30px; }
.wz-err:empty { display: none; }
.wz-times { display: flex; gap: 12px; margin: 10px 0 0 2px; }
.wz-times label { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; flex: 1; }
.wz-times input { border: 1px solid var(--dp-divider); border-radius: 10px; background: transparent; color: inherit; font: inherit; font-size: 15px; padding: 8px 10px; }
.wz-check { width: 62px; height: 62px; border-radius: 50%; background: var(--dp-success-soft); color: var(--dp-success); display: grid; place-items: center; margin: 14px 0 4px; }
.wz-sum { background: var(--dp-subtle); border-radius: 16px; padding: 4px 14px; margin: 8px 0; }
.wz-sum .wz-li { padding: 11px 0; }
.wz-val { color: var(--dp-primary); font-weight: 500; font-size: 14px; text-align: right; max-width: 60%; }
@media (max-width: 600px) {
  dialog.wizard-dlg { width: 100%; height: 100%; max-width: 100%; max-height: 100%; margin: 0; border-radius: 0; }
  /* Ohne safe-area-inset-top: das Panel liegt unter der Kopfzeile von Home Assistant, der Rand ist dort schon berücksichtigt (wie bei den anderen Vollbild-Fenstern) */
  .wz-top { padding: 12px 12px 6px 16px; }
  .wz-stp { min-height: 38px; }
}
`;
