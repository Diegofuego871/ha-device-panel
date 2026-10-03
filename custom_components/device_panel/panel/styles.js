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
.gear-btn { flex: none; display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; border: 1px solid var(--dp-divider);
  background: var(--dp-card); color: var(--dp-text2); cursor: pointer; }
.gear-btn:hover { background: var(--dp-hover); color: var(--dp-text); }
.content { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 0 20px 16px; }
/* Kopf, Chips und Fusszeile bleiben beim seitlichen Scrollen der Tabelle stehen. */
.hero, .chips, .foot { position: sticky; left: 0; }

/* Kopf */
.hero { display: grid; grid-template-columns: minmax(260px, 300px) minmax(300px, 380px) minmax(280px, 1fr); gap: 12px; }
.kt { background: var(--dp-card); border-radius: 20px; padding: 16px 18px; border: 1px solid var(--dp-divider); position: relative; overflow: hidden; min-width: 0; }
.kt .k { font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: var(--dp-text2); font-weight: 500; display: flex; align-items: center; gap: 8px; }
.kt.ring { display: grid; grid-template-columns: 108px 1fr; gap: 16px; align-items: center; }
.ringwrap { position: relative; width: 108px; height: 108px; }
.ringwrap .c { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; }
.ringwrap .c b { display: block; font-size: 24px; font-weight: 600; letter-spacing: -.02em; }
.ringwrap .c span { display: block; font-size: 11px; line-height: 1.2; color: var(--dp-text2); max-width: 76px; margin: 0 auto; }
.kt .pct { font-size: 26px; font-weight: 600; margin: 6px 0 8px; letter-spacing: -.02em; white-space: nowrap; }
.kt .pct small { font-size: 12px; font-weight: 400; color: var(--dp-text2); letter-spacing: 0; margin-left: 4px; }
.lines div { display: flex; align-items: center; gap: 8px; font-size: 13.5px; padding: 2px 0; }
.lines i { width: 9px; height: 9px; border-radius: 3px; display: inline-block; }
.pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--dp-error); flex: none;
  box-shadow: 0 0 0 4px var(--dp-error-soft), 0 0 12px var(--dp-error); }
.kt.err { border-color: var(--dp-error-line);
  background: radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--dp-error) 16%, transparent), transparent 60%), var(--dp-card);
  box-shadow: 0 0 0 1px var(--dp-error-line), 0 8px 30px -12px color-mix(in srgb, var(--dp-error) 55%, transparent); }
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

/* Ausfall-Puls: Zahl der Geräte mit Unterbruch über 24 Std. */
.kt.pul .k svg { color: var(--dp-text2); }
.pchart { position: relative; height: 84px; margin-top: 12px; }
.pchart svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.pchart .base { stroke: var(--dp-divider); stroke-width: 1; }
.pchart .area { fill: var(--dp-error-soft); }
.pchart .line { fill: none; stroke: var(--dp-error); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.pchart.quiet .line { stroke: var(--dp-success); }
.pchart.quiet .area { fill: none; }
.pchart .imark { position: absolute; top: -4px; bottom: 0; width: 0; border-left: 1.5px dashed var(--dp-error); }
.pchart .imark::before { content: ""; position: absolute; top: -3px; left: -5px; width: 8px; height: 8px; border-radius: 50%;
  background: var(--dp-error); box-shadow: 0 0 0 3px var(--dp-error-soft); }
.pticks { position: relative; height: 16px; margin-top: 4px; color: var(--dp-text3); font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.pticks span { position: absolute; transform: translateX(-50%); }
.pticks .now-label { right: 0; transform: none; }
.inc { margin-top: 8px; padding: 8px 10px; border-radius: 12px; background: var(--dp-error-soft); font-size: 12.5px; line-height: 1.35; }
.inc b { display: block; color: var(--dp-error); font-weight: 600; margin-bottom: 1px; }
.pnote { margin-top: 8px; font-size: 12.5px; color: var(--dp-text2); }
.pnote.ok { color: var(--dp-success); }

/* Chips */
.chips { display: flex; align-items: center; gap: 8px; margin: 14px 0 12px; flex-wrap: wrap; }
.chip { display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 12px; border-radius: 999px; background: var(--dp-card);
  border: 1px solid var(--dp-divider); font-size: 13px; white-space: nowrap; cursor: pointer; }
.chip .n { color: var(--dp-text2); }
.chip svg { color: var(--dp-text2); }
.chip.hint.b svg { color: var(--dp-error); }
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
.cols-pop { position: fixed; z-index: 20; width: 340px; max-height: calc(100vh - 90px); overflow: auto; padding: 14px 8px 10px;
  border: 1px solid var(--dp-divider); border-radius: 18px; background: var(--dp-card); color: var(--dp-text); box-shadow: 0 12px 34px rgba(0,0,0,.22); }
.cols-pop[hidden] { display: none; }
.cols-pop h4 { margin: 0 10px 2px; font-size: 15px; font-weight: 600; }
.vsub { margin: 0 10px 8px; color: var(--dp-text2); font-size: 12px; line-height: 1.4; }
.vrow { display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 10px 0 4px; border-radius: 10px; background: var(--dp-card); font-size: 14px; }
.vrow .vl { flex: 1; min-width: 0; }
.vrow .vl small { margin-left: 6px; color: var(--dp-text3); font-size: 11px; }
.vrow.off .vl { color: var(--dp-text2); }
.vrow.fixed .drag-h { cursor: default; opacity: .35; }
.vrow.fixed .switch { opacity: .45; }
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
.chips .vseg { margin-left: auto; }
.viewline { display: none; }
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
th { position: sticky; top: 0; z-index: 2; background: var(--dp-card); text-align: left; white-space: nowrap; padding: 14px 12px 10px;
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
dialog.device, dialog.stat-dlg, dialog.settings, dialog.view, dialog.area-sheet { padding: 0; border: none; border-radius: 22px; background: var(--dp-card); color: var(--dp-text);
  box-shadow: var(--dp-shadow); overflow: auto; overscroll-behavior: contain; max-height: calc(100% - 48px); }
dialog.device, dialog.settings, dialog.view { width: min(640px, calc(100vw - 32px)); }
dialog.area-sheet { width: min(420px, calc(100vw - 32px)); }
dialog.stat-dlg { width: min(560px, calc(100vw - 32px)); }
dialog.device::backdrop, dialog.settings::backdrop, dialog.view::backdrop, dialog.area-sheet::backdrop { background: rgba(0,0,0,0.5); }
/* Dialog dahinter stark gedimmt und unscharf, sein X ausgeblendet: so ist
   klar, welches Fenster gerade gilt. */
dialog.stat-dlg::backdrop { background: rgba(0,0,0,0.7); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); }
:host([stat-open]) dialog.device .dlg-head .dlg-close { visibility: hidden; }
.dlg-head { position: sticky; top: 0; z-index: 2; display: flex; align-items: flex-start; gap: 14px; padding: 20px 16px 14px 22px; background: var(--dp-card); }
.dlg-avatar { flex: none; display: grid; place-items: center; width: 52px; height: 52px; border-radius: 15px; background: var(--dp-primary-soft); color: var(--dp-primary); }
.dlg-avatar.off { background: var(--dp-error-soft); color: var(--dp-error); }
.dlg-avatar.warn { background: var(--dp-warning-soft); color: var(--dp-warning); }
.dlg-avatar.none { background: var(--dp-subtle); color: var(--dp-text2); }
.dlg-title { flex: 1 1 auto; min-width: 0; }
.dlg-title h2 { margin: 2px 0 6px; font-size: 21px; font-weight: 500; overflow-wrap: anywhere; }
.dlg-sub { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; color: var(--dp-text2); font-size: 13px; }
.dlg-close { flex: none; display: grid; place-items: center; width: 36px; height: 36px; border: none; border-radius: 50%;
  background: var(--dp-subtle); color: var(--dp-text2); cursor: pointer; }
.dlg-close:hover { background: var(--dp-hover); color: var(--dp-text); }
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
.dlg-actions { position: sticky; bottom: 0; z-index: 2; display: flex; gap: 8px; padding: 14px 22px calc(16px + env(safe-area-inset-bottom, 0px));
  background: var(--dp-card); border-top: 1px solid var(--dp-divider); }
.dlg-btn { flex: 1 1 auto; display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 42px; padding: 0 18px;
  border-radius: 12px; border: 1px solid var(--dp-divider); background: none; font-size: 14px; cursor: pointer; }
.dlg-btn:hover { background: var(--dp-hover); }
.dlg-btn.primary { border-color: var(--dp-primary); background: var(--dp-primary); color: #fff; font-weight: 500; }
.dlg-btn.primary:hover { background: color-mix(in srgb, var(--dp-primary) 88%, #000); }
.dlg-btn:disabled { opacity: .45; cursor: default; }
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
.set-sec.open .opt-info, .set-sec.open .ex-row.ex-all, .set-sec.open .ibadge.type { background: var(--dp-sec-head); }
.opt { padding: 10px 0; border-bottom: 1px solid var(--dp-divider); }
.opt:last-child { border-bottom: none; }
.opt-line { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 36px; }
.opt-label { display: inline-flex; align-items: center; gap: 2px; min-width: 0; }
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
.ex-row.ex-all { padding: 6px 10px; margin: 0 -8px 2px; border: none; border-radius: 10px; background: var(--dp-subtle); color: var(--dp-text2); min-height: 40px; }
.ex-name { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
/* Integrationen mit "Anzeigen", "Push", "Anhaltend" (Bild 5) */
.ex-col { flex: none; display: flex; justify-content: center; width: 72px; }
.ex-head.multi { justify-content: flex-start; }
.ex-head.multi > span:first-child { flex: 1; }
.ex-head.multi .ex-col { text-align: center; }
.ex-row .switch input:disabled + span { opacity: .35; }
/* Inhalt der Meldung und Vorschau */
.nf-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 24px; margin-top: 8px; }
.nf-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 36px; font-size: 14px; }
.pv { margin-top: 12px; padding: 12px; border-radius: 14px; background: var(--dp-subtle); }
.pv-k { margin-bottom: 8px; color: var(--dp-text2); font-size: 12px; }
.pv-card { padding: 10px 12px 8px; border-radius: 12px; background: var(--dp-card); box-shadow: 0 1px 4px rgba(0,0,0,.12); font-size: 13px; }
.pv-app { display: flex; align-items: center; gap: 6px; color: var(--dp-text2); font-size: 11.5px; }
.pv-title { margin-top: 4px; font-weight: 600; }
.pv-text { color: var(--dp-text); line-height: 1.35; }
.pv-actions { display: flex; gap: 18px; margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--dp-divider); color: var(--dp-primary); font-weight: 500; }
.pv .opt-short { margin-top: 8px; }
.ex-name small { display: block; color: var(--dp-text2); font-size: 12px; }
.ex-row.off .ex-name, .ex-row.off .ibadge { opacity: .55; }
.ibadge { flex: none; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 8px; color: #fff; font-size: 11.5px; font-weight: 600;
  background: hsl(var(--h, 200) 55% 45%); }
.ibadge.type { background: var(--dp-subtle); color: var(--dp-text2); }
/* Typ im Geräte-Popup wählbar */
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
.dlg-actions.two .dlg-btn { flex: 1 1 0; }
.hide-btn svg { color: var(--dp-text2); }

/* Statistik-Kacheln: Tipp öffnet das Statistik-Fenster */
.st-tiles { display: grid; grid-template-columns: repeat(var(--n, 4), minmax(0, 1fr)); gap: 8px; }
.st-tile { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; min-width: 0; padding: 10px 11px;
  border: 1px solid var(--dp-divider); border-radius: 14px; background: var(--dp-subtle); text-align: left; cursor: pointer; }
.st-tile:hover { border-color: color-mix(in srgb, var(--dp-primary) 50%, transparent); }
.st-tile.static { cursor: default; }
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
.ent-state.bad { color: var(--dp-error); }

/* Statistik-Fenster */
.stat-head { align-items: center; }
.stat-head .dlg-avatar { width: 44px; height: 44px; border-radius: 13px; }
.stat-range { display: flex; margin: 0 0 12px; }
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
.bh-thr-l { position: absolute; left: 6px; margin-bottom: 2px; color: var(--dp-error); font-size: 11.5px; }
.bh-chg-l { position: absolute; top: -2px; margin-left: 5px; color: var(--dp-text2); font-size: 11.5px; }
.bh-dot { position: absolute; right: -5px; width: 10px; height: 10px; border-radius: 50%; transform: translateY(-50%); background: var(--dp-primary);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--dp-primary) 25%, transparent); }
.bh-ticks { margin-left: 44px; }
.bh .avail-list { margin-top: 10px; }
.bh .avail-list .d { color: var(--dp-text2); }
.bh-src { margin: 10px 2px 0; }
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
  .ex-head.multi { font-size: 10px; letter-spacing: .02em; }
  .nf-grid { grid-template-columns: minmax(0, 1fr); }
  .toolbar { padding: 10px 12px 8px; gap: 8px; }
  .toolbar h1 { font-size: 18px; }
  .content { padding: 0 12px 12px; }
  .hero { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: 10px; margin: 0 -12px; padding: 0 12px; scrollbar-width: none; }
  .hero::-webkit-scrollbar { display: none; }
  .hero .kt { min-width: 280px; scroll-snap-align: start; }
  .hero .kt.pul { min-width: 300px; }
  .pchart { height: 64px; }
  .kt.ring { grid-template-columns: 84px 1fr; }
  .ringwrap { width: 84px; height: 84px; }
  .ringwrap svg { width: 84px; height: 84px; }
  .ringwrap .c b { font-size: 19px; }
  .ringwrap .c span { font-size: 10px; max-width: 60px; }
  .pticks .minor, .avail-ticks .minor { display: none; }
  .chips { flex-wrap: nowrap; overflow-x: auto; margin: 12px -12px 4px; padding: 0 12px; scrollbar-width: none; }
  .chips::-webkit-scrollbar { display: none; }
  .foot .tap { display: none; }
  dialog.device, dialog.stat-dlg, dialog.settings, dialog.view, dialog.area-sheet { width: 100%; max-width: 100%; margin: auto 0 0; border-radius: 22px 22px 0 0; }
  dialog.view, dialog.area-sheet { max-height: 92%; }
  .view-btn { width: 38px; height: 38px; padding: 0; justify-content: center; border-radius: 50%; }
  .view-btn span { display: none; }
  .viewline { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; }
  .sort-btn { display: inline-flex; align-items: center; gap: 6px; min-width: 0; height: 32px; padding: 0 10px 0 8px; border: 1px solid var(--dp-divider);
    border-radius: 999px; background: var(--dp-card); color: var(--dp-text); font: inherit; font-size: 13px; cursor: pointer; }
  .sort-btn span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .sort-btn svg { flex: none; color: var(--dp-primary); }
  .sort-btn svg:last-child { color: var(--dp-text2); }
  .viewline .vseg { flex: none; margin-left: auto; }
  dialog.device { max-height: 92%; }
  /* Feste Höhe: sonst springt das Blatt bei jeder Änderung des Inhalts
     (Prüfung, Abschnitt auf/zu) und gibt kurz den Hintergrund frei. */
  dialog.settings { height: 92%; max-height: 92%; }
  dialog.settings[open] { display: flex; flex-direction: column; }
  dialog.settings[open] > * { flex-shrink: 0; }
  dialog.settings[open] > .dlg-body { flex-grow: 1; }
  .toolbar .gear-btn { width: 38px; height: 38px; }
  dialog.stat-dlg { height: 86%; max-height: 86%; }
  .dlg-head { padding: 18px 12px 12px 16px; }
  .dlg-quick { padding: 0 16px 6px; }
  .dlg-body { padding: 4px 16px 16px; }
  .dlg-actions { padding-left: 16px; padding-right: 16px; }
  .st-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;
