/**
 * Styles (Shadow DOM), Design C (docs/mockups/panel-v1, Bilder 6–8). Farben
 * aus den Theme-Variablen von Home Assistant, eigene mit --dp- (docs/DESIGN.md).
 * Geräte-Popup und Statistik-Fenster wie in unifi_dynamic.
 */
export const PANEL_CSS = `
:host {
  --dp-bg: var(--primary-background-color, #f4f6f9);
  --dp-card: var(--card-background-color, #fff);
  --dp-text: var(--primary-text-color, #212121);
  --dp-text2: var(--secondary-text-color, #727272);
  --dp-text3: var(--disabled-text-color, #9e9e9e);
  --dp-divider: var(--divider-color, rgba(0,0,0,0.12));
  --dp-primary: var(--primary-color, #03a9f4);
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
.searchbox { flex: 1; display: flex; align-items: center; gap: 10px; height: 42px; padding: 0 14px; border-radius: 14px;
  background: var(--dp-input); border: 1px solid var(--dp-divider); color: var(--dp-text2); min-width: 0; }
.search { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--dp-text); font: inherit; height: 100%; }
/* Eigenes X statt des Browser-Knopfs: den zeigt nicht jeder Browser (iOS). */
.search::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; display: none; }
.search-clear { flex: none; display: grid; place-items: center; width: 32px; height: 32px; margin-right: -8px; padding: 0; border: 0; border-radius: 50%;
  background: none; color: var(--dp-text2); cursor: pointer; }
.search-clear:hover { background: var(--dp-hover); color: var(--dp-text); }
.search-clear[hidden] { display: none; }
.gear-btn, .tmall-btn { flex: none; display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; border: 1px solid var(--dp-divider);
  background: var(--dp-card); color: var(--dp-text2); cursor: pointer; }
.tmall-btn { margin: 0 10px; } /* gleicher Abstand links (Suchfeld) und rechts (Zahnrad): genau mittig, skaliert mit der Breite */
.gear-btn { position: relative; }
/* Roter Punkt: Update installiert, Neustart steht aus (seit 2.25.0) */
.gear-btn.has-dot::after { content: ""; position: absolute; top: 3px; right: 3px; width: 10px; height: 10px; box-sizing: border-box; border-radius: 50%; background: var(--dp-error); border: 2px solid var(--dp-bg); }
.gear-btn:hover, .tmall-btn:hover { background: var(--dp-hover); color: var(--dp-text); }
.content { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 0 20px 16px; }
/* Kopf, Chips und Fusszeile bleiben beim seitlichen Scrollen der Tabelle stehen. */
.hero, .chips, .foot { position: sticky; left: 0; }

/* Kopf */
.hero { display: grid; grid-template-columns: minmax(260px, 300px) minmax(300px, 380px) minmax(280px, 1fr); gap: 12px; }
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
.kwarn .w-go { margin-left: auto; display: inline-flex; color: var(--dp-text3); }
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
.kt .k .kchev { display: inline-flex; margin-left: auto; color: var(--dp-text3); }
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
.chips { display: flex; align-items: center; gap: 8px; position: sticky; top: 44px; z-index: 5; margin: 0 -20px; padding: 14px 20px 12px; background: var(--dp-bg); flex-wrap: wrap; }
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
dialog.cols-dlg .vrow { min-height: 44px; padding-left: 0; border-bottom: 1px solid var(--dp-divider); border-radius: 0; font-size: 14.5px; }
dialog.cols-dlg .vlist .vrow:last-child { border-bottom: 0; }
dialog.cols-dlg .vrow.lift { border-radius: 10px; }
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
.hs-in .hs-up { margin-left: auto; display: inline-flex; color: var(--dp-text2); transform: rotate(180deg); }
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
dialog.view .vrow { min-height: 46px; padding-left: 0; border-bottom: 1px solid var(--dp-divider); border-radius: 0; font-size: 14.5px; }
dialog.view .vrow:last-child { border-bottom: 0; }
dialog.view .vrow.lift { border-radius: 10px; }

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
.foot { display: flex; justify-content: space-between; gap: 12px; padding: 10px 6px 0; font-size: 12px; color: var(--dp-text2); }

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
dialog.device, dialog.stat-dlg, dialog.settings, dialog.view, dialog.area-sheet, dialog.pulse-dlg, dialog.cols-dlg, dialog.prompt-dlg, dialog.notes-dlg { padding: 0; border: none; border-radius: 22px; background: var(--dp-card); color: var(--dp-text);
  box-shadow: var(--dp-shadow); overflow: auto; overscroll-behavior: contain; max-height: calc(100% - 48px); }
dialog.device, dialog.settings, dialog.view { width: min(640px, calc(100vw - 32px)); }
dialog.area-sheet, dialog.cols-dlg { width: min(420px, calc(100vw - 32px)); }
dialog.stat-dlg, dialog.pulse-dlg, dialog.prompt-dlg, dialog.notes-dlg { width: min(560px, calc(100vw - 32px)); }
dialog.device::backdrop, dialog.settings::backdrop, dialog.view::backdrop, dialog.area-sheet::backdrop, dialog.pulse-dlg::backdrop, dialog.cols-dlg::backdrop, dialog.prompt-dlg::backdrop, dialog.notes-dlg::backdrop { background: rgba(0,0,0,0.5); }
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
.dn-btn.ok { border-color: var(--dp-primary); background: var(--dp-primary); color: #fff; }
.dn-btn:disabled, .dn-input:disabled { opacity: .55; cursor: default; }
.dn-orig { margin: 0 0 6px; color: var(--dp-text2); font-size: 12.5px; }
.dlg-title h2 { margin: 2px 0 6px; font-size: 21px; font-weight: 500; overflow-wrap: anywhere; }
.dlg-sub { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; color: var(--dp-text2); font-size: 13px; }
.dlg-close { flex: none; display: grid; place-items: center; width: 36px; height: 36px; border: none; border-radius: 50%;
  background: var(--dp-subtle); color: var(--dp-text2); cursor: pointer; }
.dlg-close:hover { background: var(--dp-hover); color: var(--dp-text); }
/* Herz im Kopf des Geräte-Popups (seit 2.22.0): wie das Kreuz ein runder Knopf, rot sobald Favorit */
.dlg-fav { flex: none; display: grid; place-items: center; width: 36px; height: 36px; margin-right: 8px; border: none; border-radius: 50%;
  background: var(--dp-subtle); color: var(--dp-text2); cursor: pointer; transition: color .2s ease, background .2s ease; }
.dlg-log { margin-right: 8px; }
.dlg-fav:hover { background: var(--dp-hover); color: var(--dp-error); }
.dlg-fav.on { color: var(--dp-error); }
.dlg-fav:focus-visible { outline: 2px solid var(--dp-error); outline-offset: 1px; }
/* Chip "Favoriten": nur das rote Herz, schmal (kein Text, keine Zahl) */
.chip.hint.fv.bare { flex: none; box-sizing: border-box; gap: 0; padding: 0; width: 42px; justify-content: center; }
.chip.hint.fv svg { color: var(--dp-error); }
.chip.hint.fv.on { background: var(--dp-error-soft); border-color: var(--dp-error); }
.dlg-quick { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 22px 6px; }
.qbtn { display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 14px; border-radius: 99px; border: 1px solid var(--dp-divider);
  background: none; color: var(--dp-text); font-size: 13px; cursor: pointer; }
.qbtn svg { color: var(--dp-text2); }
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
.dlg-btn.primary { border-color: var(--dp-primary); background: var(--dp-primary); color: #fff; font-weight: 500; }
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
.set-sec { margin-top: 10px; border: 1px solid var(--dp-divider); border-radius: 14px; overflow: hidden; }
.set-sec-head { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 14px; border: none; background: none; text-align: left; cursor: pointer; }
.set-sec-head > span { flex: 1 1 auto; min-width: 0; }
.set-sec-head:hover { background: var(--dp-hover); }
.set-sec-head > svg { color: var(--dp-text2); transition: transform .15s; }
.set-sec.open .set-sec-head > svg { transform: rotate(180deg); }
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
.ai-box { display: flex; flex-direction: column; gap: 8px; }
.ai-btn { align-self: flex-start; }
.ai-btn svg { color: #7c4dff; }
.ai-card { padding: 12px 14px; border: 1px solid color-mix(in srgb, #7c4dff 28%, var(--dp-divider)); border-radius: 14px;
  background: linear-gradient(135deg, color-mix(in srgb, #7c4dff 9%, var(--dp-card)), color-mix(in srgb, var(--dp-primary) 7%, var(--dp-card))); }
.ai-title { display: flex; align-items: center; gap: 6px; font-weight: 600; }
.ai-title svg, .ai-wait svg { flex: none; color: #7c4dff; }
.ai-text { margin-top: 6px; line-height: 1.45; white-space: pre-line; }
.ai-foot { margin-top: 8px; color: var(--dp-text2); font-size: 12px; }
.ai-wait { display: flex; align-items: center; gap: 8px; color: var(--dp-text2); animation: ai-pulse 1.4s ease-in-out infinite; }
@keyframes ai-pulse { 50% { opacity: .5; } }
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
.chip-prev-pin { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 999px; background: var(--dp-primary); color: #fff; }
/* isolation: Die Haftgruppe (sticky, z-index 2) bleibt in der Vorschau und deckt beim Scrollen den Dialog-Kopf nicht ab. */
.chip-prev-strip { isolation: isolate; display: flex; align-items: center; gap: 8px; overflow-x: auto; scrollbar-width: none; margin: 0 -12px; padding: 4px 12px 6px; }
.chip-prev-strip::-webkit-scrollbar { display: none; }
.chip-prev-strip .chip { flex: none; height: 28px; padding: 0 10px; font-size: 12.5px; pointer-events: none; }
.chip-prev-strip .chip-pin { position: sticky; left: -12px; z-index: 2; flex: none; display: flex; align-items: center; gap: 8px; margin-left: -12px; padding: 4px 12px; background: var(--dp-bg); }
.chip-prev-strip .chip-pin::after { content: ""; position: absolute; right: -14px; top: 0; bottom: 0; width: 14px; background: linear-gradient(90deg, rgba(0,0,0,.28), transparent); pointer-events: none; }
.ex-row.pin-line { display: block; position: relative; min-height: 0; height: 34px; padding: 0; margin: 2px 0; border: none; }
.pin-line::before { content: ""; position: absolute; left: 0; right: 0; top: 50%; border-top: 2px dashed var(--dp-primary); }
.pin-tab { position: absolute; left: 0; top: 50%; transform: translateY(-50%); display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px 0 4px;
  border-radius: 999px; background: var(--dp-primary); color: #fff; font-size: 12.5px; font-weight: 600; }
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
.lane-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
.lane-diff { margin-top: 8px; color: var(--dp-text2); font-size: 12.5px; }
.mon-chip { display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 11px; border: 1px solid var(--dp-divider); border-radius: 14px;
  background: var(--dp-card); color: var(--dp-text2); font: inherit; font-size: 12.5px; font-weight: 500; cursor: pointer; white-space: nowrap; }
.mon-chip.on { border-color: var(--dp-primary); background: var(--dp-primary); color: #fff; }
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
.ilist-row > svg { flex: none; color: var(--dp-text3); }
.ilist-name { flex: 1; min-width: 0; font-size: 14px; }
.ilist-name small { display: block; color: var(--dp-text2); font-size: 12px; }
.ilist-name small.ilist-diff.own { color: var(--dp-primary); }
.ilist-name small.ilist-diff.unmon { color: var(--dp-warning); }
.iback { display: inline-flex; align-items: center; gap: 2px; margin: 6px 0 4px -4px; padding: 4px 6px 4px 0; border: none; background: none; color: var(--dp-primary);
  font: inherit; font-size: 13.5px; font-weight: 500; cursor: pointer; }
.iback svg { transform: rotate(180deg); }
.iback:focus-visible { outline: 2px solid var(--dp-primary); border-radius: 6px; }
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
.ver-btn.primary { border-color: var(--dp-primary); background: var(--dp-primary); color: #fff; font-weight: 500; }
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
.st-tile > .chev { position: absolute; right: 6px; bottom: 7px; color: var(--dp-text3); }
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
  .kwarn { margin: auto -12px -12px; padding: 9px 12px; font-size: 12.5px; }
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
  dialog.device, dialog.stat-dlg, dialog.settings, dialog.view, dialog.area-sheet, dialog.pulse-dlg, dialog.prompt-dlg, dialog.notes-dlg { width: 100%; max-width: 100%; margin: auto 0 0; border-radius: 22px 22px 0 0; }
  dialog.view, dialog.area-sheet, dialog.pulse-dlg, dialog.prompt-dlg, dialog.notes-dlg { max-height: 92%; }
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
  .toolbar .gear-btn, .toolbar .tmall-btn { width: 38px; height: 38px; }
  /* Handy: der Platz zwischen Suchfeld und Zahnrad bleibt wie vorher (Suchfeld nicht schmaler), nur gleichmässig geteilt: 8 + 7 px auf beiden Seiten */
  .toolbar .tmall-btn { margin: 0 7px; }
  dialog.stat-dlg { height: 86%; max-height: 86%; }
  .dlg-head { padding: 18px 12px 12px 16px; }
  .dlg-quick { padding: 0 16px 6px; }
  .dlg-body { padding: 4px 16px 16px; }
  .dlg-actions { padding-left: 16px; padding-right: 16px; }
  .st-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

/* Protokoll (seit 1.38.0, docs/mockups/popup-tabs-log-v1, P1): Fenster gross auf dem Desktop, auf dem Handy vollflächig */
/* Fenster "Alle Timer" (seit 2.22.0): immer Vollbild, Inhalt in lesbarer Breite */
dialog.tmall-dlg { padding: 0; border: none; border-radius: 0; background: var(--dp-card); color: var(--dp-text); overflow: hidden; width: 100%; max-width: 100%; height: 100%; max-height: 100%; margin: 0; overscroll-behavior: contain; }
dialog.tmall-dlg[open] { display: flex; flex-direction: column; }
dialog.tmall-dlg::backdrop { background: rgba(0,0,0,0.5); }
.tmall-dlg .dlg-head { flex: none; position: static; padding-left: max(22px, calc((100% - 860px) / 2)); padding-right: max(16px, calc((100% - 860px) / 2)); }
.tmall-dlg .dlg-body { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 0 22px 24px; }
.tm-all-wrap { max-width: 860px; margin: 0 auto; }
@media (max-width: 700px) { .tmall-dlg .dlg-body { padding: 0 16px 20px; } }
dialog.log-dlg { padding: 0; border: none; border-radius: 22px; background: var(--dp-card); color: var(--dp-text); box-shadow: var(--dp-shadow); overflow: hidden;
  width: min(1040px, calc(100vw - 48px)); height: min(780px, calc(100% - 48px)); max-height: none; overscroll-behavior: contain; }
dialog.log-dlg[open] { display: flex; flex-direction: column; }
dialog.log-dlg::backdrop { background: rgba(0,0,0,0.5); }
.log-dlg .dlg-head { flex: none; position: static; }
.lg-bar { flex: none; display: flex; flex-direction: column; gap: 10px; padding: 4px 22px 10px; }
.lg-search { max-width: none; width: 100%; box-sizing: border-box; }
.lg-chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
.lg-chips::-webkit-scrollbar { display: none; }
.lg-chips .chip { height: 30px; font-size: 12.5px; flex: none; }
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
.lg-tm { color: var(--dp-text2); font-variant-numeric: tabular-nums; font-size: 12.5px; padding-top: 1px; }
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
  .lg-row { grid-template-columns: 14px auto 1fr; grid-template-areas: "lv tm cat" ". msg msg"; gap: 4px 10px; padding: 10px 2px; }
  .lg-lv { grid-area: lv; } .lg-tm { grid-area: tm; font-weight: 600; color: var(--dp-text); padding-top: 0; align-self: center; } .lg-cat { grid-area: cat; } .lg-msg { grid-area: msg; font-size: 14px; }
}

/* Feste Höhe (seit 1.41.0, Wunsch des Nutzers): Fenster mit Reitern oder wechselndem Inhalt bleiben gleich hoch, egal welcher Reiter
   gewählt ist. Kopf, Reiter und Knöpfe bleiben stehen, der Inhalt füllt den Rest und scrollt, wenn er länger ist. */
dialog.device, dialog.settings, dialog.stat-dlg, dialog.pulse-dlg, dialog.area-sheet, dialog.prompt-dlg, dialog.notes-dlg { height: min(780px, calc(100% - 48px)); }
dialog.device[open], dialog.settings[open], dialog.stat-dlg[open], dialog.pulse-dlg[open], dialog.area-sheet[open], dialog.prompt-dlg[open], dialog.notes-dlg[open] { display: flex; flex-direction: column; }
dialog.device[open] > *, dialog.settings[open] > *, dialog.stat-dlg[open] > *, dialog.pulse-dlg[open] > *, dialog.area-sheet[open] > *, dialog.prompt-dlg[open] > *, dialog.notes-dlg[open] > * { flex-shrink: 0; }
dialog.device[open] > .dlg-body, dialog.settings[open] > .dlg-body, dialog.stat-dlg[open] > .dlg-body, dialog.pulse-dlg[open] > .dlg-body, dialog.area-sheet[open] > .dlg-body, dialog.prompt-dlg[open] > .dlg-body, dialog.notes-dlg[open] > .dlg-body { flex-grow: 1; }
@media (max-width: 600px) {
  dialog.device, dialog.settings, dialog.pulse-dlg, dialog.area-sheet, dialog.prompt-dlg, dialog.notes-dlg { height: 92%; max-height: 92%; }
  dialog.stat-dlg { height: 86%; max-height: 86%; }
  /* Einstellungen, Ansicht und Geräte-Popup auf dem Handy als Vollbild (seit 2.24.0, Wunsch des Nutzers) */
  dialog.settings, dialog.view, dialog.device { height: 100%; max-height: 100%; margin: 0; border-radius: 0; }
  dialog.view[open] { display: flex; flex-direction: column; }
  dialog.view[open] > * { flex-shrink: 0; }
  dialog.view[open] > .dlg-body { flex-grow: 1; }
}

/* Material (seit 2.0.0b1, Wunsch des Nutzers, Variante B aus docs/mockups/apple-design-v1): Geräte-Popup, Einstellungen und Protokoll sind
   durchscheinende Blätter mit Unschärfe und heller Oberkante; Kopf und Knöpfe laufen weich aus statt mit harter Linie. Nur Stile: keine Inhalte,
   Felder oder Werte ändern sich. Farben aus den Theme-Variablen (hell und dunkel). Ohne Unterstützung für backdrop-filter oder bei
   "Transparenz reduzieren" bleiben die Blätter deckend wie bisher. */
@supports ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
  @media not (prefers-reduced-transparency: reduce) {
    dialog.device, dialog.settings, dialog.log-dlg { background: color-mix(in srgb, var(--dp-card) 64%, transparent);
      -webkit-backdrop-filter: blur(30px) saturate(190%); backdrop-filter: blur(30px) saturate(190%);
      box-shadow: inset 0 1.5px 0 color-mix(in srgb, var(--dp-text) 30%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--dp-text) 8%, transparent), 0 24px 70px rgba(0,0,0,0.55); }
    dialog.device::backdrop, dialog.settings::backdrop, dialog.log-dlg::backdrop { background: rgba(0,0,0,0.5); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
    dialog.device .dlg-head, dialog.settings .dlg-head, dialog.log-dlg .dlg-head { background: color-mix(in srgb, var(--dp-card) 60%, transparent);
      -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); }
    dialog.device .dev-tabs { background: color-mix(in srgb, var(--dp-card) 60%, transparent); -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); }
    dialog.device .dev-tabs::after { display: none; }
    dialog.device .dlg-actions, dialog.settings .dlg-actions, dialog.log-dlg .dlg-actions { border-top: none; padding-top: 24px;
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
:host([light]) dialog.device, :host([light]) dialog.settings, :host([light]) dialog.log-dlg { background: var(--dp-card); -webkit-backdrop-filter: none; backdrop-filter: none;
  box-shadow: 0 24px 70px rgba(0,0,0,0.35), 0 0 0 1px color-mix(in srgb, var(--dp-text) 8%, transparent); }
:host([light]) dialog.device::backdrop, :host([light]) dialog.settings::backdrop, :host([light]) dialog.log-dlg::backdrop { -webkit-backdrop-filter: none; backdrop-filter: none; background: rgba(0,0,0,0.4); }
:host([light]) dialog.device .dlg-head, :host([light]) dialog.settings .dlg-head, :host([light]) dialog.log-dlg .dlg-head, :host([light]) dialog.device .dev-tabs { background: var(--dp-card); -webkit-backdrop-filter: none; backdrop-filter: none; }
:host([light]) dialog.device .dlg-actions, :host([light]) dialog.settings .dlg-actions, :host([light]) dialog.log-dlg .dlg-actions { background: var(--dp-card); -webkit-backdrop-filter: none; backdrop-filter: none; border-top: 1px solid var(--dp-divider); padding-top: 14px; }
:host([light]) dialog.device .tile, :host([light]) dialog.device .st-tile, :host([light]) dialog.settings .nf-note, :host([light]) dialog.settings .pv { background: color-mix(in srgb, var(--dp-text) 3.5%, var(--dp-card)); border-color: color-mix(in srgb, var(--dp-text) 10%, var(--dp-card)); box-shadow: none; }
:host([light]) dialog.device .dev-set { background: color-mix(in srgb, var(--dp-text) 2.5%, var(--dp-card)); }
:host([light]) dialog.device .dlg-btn, :host([light]) dialog.settings .dlg-btn { background: var(--dp-card); border-color: color-mix(in srgb, var(--dp-text) 18%, var(--dp-card)); }
:host([light]) dialog.device .dlg-btn.primary, :host([light]) dialog.settings .dlg-btn.primary { background: var(--dp-primary); border-color: transparent; }
}
/* Liste (seit 2.0.1): grosser Titel, weiche Tiefe der Kacheln, Chip-Leiste als Material, Gruppentitel im neuen Titelstil */
.toolbar h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.03em; }
/* Kein sichtbarer Titel mehr (seit 2.25.0): die Anwendung heisst schon "Device Panel", das Suchfeld gewinnt den Platz. Der Titel bleibt für Screenreader. */
.toolbar h1 { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; border: 0; }
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
.mg-val.off { color: var(--dp-text2); font-size: 12.5px; font-weight: 400; }
.mg-radio { flex: none; width: 22px; height: 22px; box-sizing: border-box; border: 2px solid var(--dp-divider); border-radius: 50%; }
.mg-radio.on { border: 7px solid var(--dp-primary); }
.mg-acts { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-top: 8px; padding-left: 50px; font-size: 13px; }
.linkbtn.danger { color: var(--dp-error); }
/* Handy: Aktionen der Karten (Bearbeiten, Löschen, Gerät öffnen) mit Fläche für den Finger (seit 2.24.0): grössere Schrift, 44 px Trefferhöhe, mehr Abstand */
@media (max-width: 700px) {
  .mg-acts { gap: 0 4px; margin-top: 2px; padding-left: 38px; font-size: 15px; }
  .mg-acts .linkbtn, .mg-dfoot .linkbtn { min-height: 44px; padding: 0 12px; }
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

/* Timer (seit 2.21.0, docs/mockups/timer-v1): Wecker-Stil im Popup, Assistent mit den Stilen von Magic Push (dialog.magic-dlg) */
.tm-clock { margin-top: 8px; padding: 12px 14px; border-radius: 16px; background: var(--dp-subtle); }
.tm-clock.off { opacity: .7; }
.tm-clock .top { display: flex; align-items: center; gap: 10px; }
.tm-clock .time { font-size: 34px; font-weight: 300; letter-spacing: -.02em; line-height: 1; font-variant-numeric: tabular-nums; }
.tm-clock .time small { font-size: 14px; font-weight: 400; margin-left: 6px; color: var(--dp-text2); letter-spacing: 0; }
.tm-clock .grow { flex: 1; min-width: 0; }
/* Schalter der Timer-Karte etwas grösser als der Standard (44 × 24 statt 36 × 20 px, Wunsch des Nutzers) */
.tm-clock .switch { width: 44px; height: 24px; }
.tm-clock .switch span::after { width: 20px; height: 20px; }
.tm-clock .switch input:checked + span::after { left: 22px; }
.tm-clock .name { margin-top: 6px; font-size: 14px; font-weight: 600; }
.tm-clock .what { margin-top: 2px; color: var(--dp-text2); font-size: 12.5px; line-height: 1.35; }
.tm-days { display: flex; gap: 5px; margin-top: 9px; }
.tm-days i { flex: 1; max-width: 34px; height: 26px; display: grid; place-items: center; border-radius: 8px; font-style: normal; font-size: 11.5px; color: var(--dp-text2); background: color-mix(in srgb, var(--dp-text) 6%, transparent); }
.tm-days i.on { background: var(--dp-primary-soft); color: var(--dp-primary); font-weight: 600; }
.tm-clock .next { margin-top: 9px; padding-top: 8px; border-top: 1px solid var(--dp-divider); display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; color: var(--dp-text2); font-size: 12.5px; }
.tm-clock .next b { color: var(--dp-text); font-weight: 600; font-variant-numeric: tabular-nums; }
.tm-clock .next .acts { margin-left: auto; display: flex; flex-wrap: wrap; gap: 4px 16px; }
.tm-ring { flex: none; position: relative; width: 62px; height: 62px; }
.tm-ring svg { width: 62px; height: 62px; transform: rotate(-90deg); }
.tm-ring circle { fill: none; stroke-width: 6; }
.tm-ring .bg { stroke: color-mix(in srgb, var(--dp-text) 12%, transparent); }
.tm-ring .fg { stroke: var(--dp-primary); stroke-linecap: round; transition: stroke-dashoffset 1s linear; }
.tm-ring span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 11.5px; font-weight: 600; font-variant-numeric: tabular-nums; }
.tm-tag { display: inline-block; padding: 1px 8px; border-radius: 99px; background: var(--dp-primary-soft); color: var(--dp-primary); font-size: 11.5px; font-weight: 500; }
.tm-tag.grey { background: var(--dp-subtle); color: var(--dp-text2); }
/* Assistent */
.tm-wd { display: flex; gap: 6px; margin-top: 6px; }
.tm-wd button { flex: 1; max-width: 44px; height: 44px; border: none; border-radius: 50%; font: inherit; font-size: 13.5px; color: var(--dp-text); cursor: pointer;
  background: color-mix(in srgb, var(--dp-text) 7%, var(--dp-card)); }
.tm-wd button.on { background: var(--dp-primary); color: #fff; font-weight: 600; }
.tm-wd button:focus-visible { outline: 2px solid var(--dp-primary); outline-offset: 2px; }
.tm-timein, .tm-datein { box-sizing: border-box; height: 46px; font-size: 20px; font-variant-numeric: tabular-nums; }
.tm-timein { width: 160px; }
.tm-datein { width: 220px; max-width: 100%; }
.tm-next { margin-top: 8px; border-radius: 14px; background: var(--dp-subtle); padding: 4px 14px; }
.tm-next div { display: flex; justify-content: space-between; gap: 10px; padding: 8px 0; font-size: 13.5px; border-top: 1px solid var(--dp-divider); }
.tm-next div:first-child { border-top: 0; }
.tm-next div span:last-child { color: var(--dp-text2); }
.tm-sum { margin-top: 8px; padding: 12px 14px; border-radius: 14px; background: var(--dp-primary-soft); font-size: 14.5px; line-height: 1.45; }
.tm-sum b { font-weight: 600; }
.tm-result { margin-top: 10px; }
/* Reiterleiste im Geräte-Popup mit fünf Reitern: auf dem Handy Symbole, die Beschriftung nur am gewählten Reiter (Entscheid zu Frage 7 in docs/mockups/timer-v1) */
@media (max-width: 600px) {
  .dev-tabs .sub-tabs { display: flex; gap: 2px; }
  .dev-tabs .sub-tab { flex: 1 1 0; min-width: 0; padding: 0 4px; font-size: 0; }
  .dev-tabs .sub-tab::before { font-size: 18px; line-height: 1; }
  .dev-tabs .sub-tab[data-tab="ov"]::before { content: "📊"; }
  .dev-tabs .sub-tab[data-tab="set"]::before { content: "⚙️"; }
  .dev-tabs .sub-tab[data-tab="ent"]::before { content: "🧩"; }
  .dev-tabs .sub-tab[data-tab="magic"]::before { content: "🔔"; }
  .dev-tabs .sub-tab[data-tab="timer"]::before { content: "⏱️"; }
  .dev-tabs .sub-tab.two:not(.on) > * { display: none; }
  .dev-tabs .sub-tab.on { flex: 2.8 1 0; gap: 6px; font-size: 13.5px; }
  .dev-tabs .sub-tab.on.two::before { display: none; }
  .dev-tabs .sub-tab.on.two .tab-l { font-size: 13px; }
}
`;
