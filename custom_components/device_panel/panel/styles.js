/**
 * Styles (Shadow DOM), Design C (docs/mockups/panel-v1, Bilder 6–8). Farben
 * aus den Theme-Variablen von Home Assistant, eigene mit --dp- (docs/DESIGN.md).
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
  --dp-primary-soft: color-mix(in srgb, var(--dp-primary) 14%, transparent);
  --dp-success-soft: color-mix(in srgb, var(--dp-success) 16%, transparent);
  --dp-warning-soft: color-mix(in srgb, var(--dp-warning) 16%, transparent);
  --dp-error-soft: color-mix(in srgb, var(--dp-error) 10%, transparent);
  --dp-error-line: color-mix(in srgb, var(--dp-error) 40%, transparent);
  --dp-bar-off: color-mix(in srgb, var(--dp-text) 14%, transparent);
  --dp-input: var(--dp-card);
  --dp-shadow: 0 10px 30px rgba(0,0,0,0.18);
  --dp-shadow-s: 0 1px 2px rgba(0,0,0,0.08);
  /* Stufen (gut -> schlecht), wie Ping/WLAN in unifi_dynamic */
  --dp-tier4: #4caf50;
  --dp-tier3: #8bc34a;
  --dp-tier2: #eba43f;
  --dp-tier1: #e5625f;
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

/* Werkzeugleiste: bleibt stehen, nur .content scrollt (siehe LEARNINGS). */
.toolbar { display: flex; align-items: center; gap: 12px; padding: 14px 20px 12px; }
.toolbar h1 { margin: 0 6px 0 0; font-size: 20px; font-weight: 500; white-space: nowrap; }
.searchbox { flex: 1; display: flex; align-items: center; gap: 10px; height: 42px; padding: 0 14px; border-radius: 14px;
  background: var(--dp-input); border: 1px solid var(--dp-divider); color: var(--dp-text2); min-width: 0; }
.search { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--dp-text); font: inherit; height: 100%; }
.content { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 0 20px 16px; }

/* Kopf */
.hero { display: grid; grid-template-columns: minmax(260px, 300px) minmax(300px, 380px) minmax(260px, 1fr); gap: 12px; }
.kt { background: var(--dp-card); border-radius: 20px; padding: 16px 18px; border: 1px solid var(--dp-divider); position: relative; overflow: hidden; }
.kt .k { font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: var(--dp-text2); font-weight: 500; display: flex; align-items: center; gap: 8px; }
.kt.ring { display: grid; grid-template-columns: 108px 1fr; gap: 16px; align-items: center; }
.ringwrap { position: relative; width: 108px; height: 108px; }
.ringwrap .c { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; }
.ringwrap .c b { display: block; font-size: 24px; font-weight: 600; letter-spacing: -.02em; }
.ringwrap .c span { display: block; font-size: 11px; line-height: 1.2; color: var(--dp-text2); max-width: 76px; margin: 0 auto; }
.kt .pct { font-size: 26px; font-weight: 600; margin: 6px 0 8px; letter-spacing: -.02em; }
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
.olist button > span:first-child { color: var(--dp-error); display: flex; }
.olist b { color: var(--dp-error); font-weight: 600; font-variant-numeric: tabular-nums; }
.olist .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.olist .more { color: var(--dp-text2); font-size: 12.5px; padding-top: 6px; border-top: 1px solid var(--dp-divider); }
.hintlist button { width: 100%; display: grid; grid-template-columns: 30px 1fr auto; gap: 10px; align-items: center; padding: 7px 0;
  border: 0; border-top: 1px solid var(--dp-divider); background: none; text-align: left; cursor: pointer; font-size: 14px; }
.hintlist button:first-child { border-top: 0; }
.hintlist button.on { color: var(--dp-primary); }
.hintlist .hi { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; background: var(--dp-subtle); color: var(--dp-text2); }
.hintlist .hi.b { background: var(--dp-error-soft); color: var(--dp-error); }
.hintlist .hi.s { background: var(--dp-warning-soft); color: var(--dp-warning); }
.hintlist .hi.u { background: var(--dp-primary-soft); color: var(--dp-primary); }
.hintlist b { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; }
.hintlist button[disabled] { cursor: default; color: var(--dp-text3); }
.hintlist button[disabled] b { color: var(--dp-text3); }

/* Chips */
.chips { display: flex; align-items: center; gap: 8px; margin: 14px 0 12px; flex-wrap: wrap; }
.chip { display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 12px; border-radius: 999px; background: var(--dp-card);
  border: 1px solid var(--dp-divider); font-size: 13px; white-space: nowrap; cursor: pointer; }
.chip .n { color: var(--dp-text2); }
.chip svg { color: var(--dp-text2); }
.chip.on { background: var(--dp-primary-soft); border-color: transparent; color: var(--dp-primary); }
.chip.on svg, .chip.on .n { color: var(--dp-primary); }
.vsep { width: 1px; height: 22px; background: var(--dp-divider); margin: 0 2px; }

/* Tabelle als Karte, Kopfzeile bleibt beim Scrollen stehen */
.tcard { background: var(--dp-card); border-radius: 20px; border: 1px solid var(--dp-divider); }
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th { position: sticky; top: 0; z-index: 2; background: var(--dp-card); text-align: left; white-space: nowrap; padding: 14px 12px 10px;
  color: var(--dp-text2); font-size: 12px; font-weight: 500; letter-spacing: .03em; text-transform: uppercase; border-bottom: 1px solid var(--dp-divider); }
th:first-child { border-top-left-radius: 20px; padding-left: 18px; }
th:last-child { border-top-right-radius: 20px; }
td { padding: 9px 12px; border-bottom: 1px solid var(--dp-divider); vertical-align: middle; white-space: nowrap; }
td:first-child { padding-left: 18px; }
tbody tr:last-child td { border-bottom: 0; }
tbody tr:last-child td:first-child { border-bottom-left-radius: 20px; }
tbody tr:last-child td:last-child { border-bottom-right-radius: 20px; }
tr.dev:hover td { background: var(--dp-hover); }
tr.grp td { background: var(--dp-subtle); padding: 8px 18px; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--dp-text2); }
tr.grp.e td { color: var(--dp-error); background: var(--dp-error-soft); }
tr.grp small { font-weight: 400; text-transform: none; letter-spacing: 0; margin-left: 8px; color: var(--dp-text2); }
tr.dev.off td { background: var(--dp-error-soft); }
tr.dev.off td:first-child { box-shadow: inset 4px 0 0 var(--dp-error); }
.nc { display: flex; align-items: center; gap: 12px; }
.nc .sub, .sub { display: block; font-size: 12px; color: var(--dp-text2); margin-top: 1px; }
.av { position: relative; width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; background: var(--dp-subtle); color: var(--dp-text2); flex: none; }
.av.off { background: var(--dp-error-soft); color: var(--dp-error); }
.av .dot { position: absolute; right: -3px; bottom: -3px; width: 12px; height: 12px; border-radius: 50%; border: 2.5px solid var(--dp-card); background: var(--dp-success); }
.av.off .dot { background: var(--dp-error); box-shadow: 0 0 8px var(--dp-error); }
.av.none .dot { background: var(--dp-text3); }
.dur { font-size: 15px; font-weight: 600; color: var(--dp-error); font-variant-numeric: tabular-nums; }
.durs { font-size: 12px; color: var(--dp-text2); }
.pill { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 9px; border-radius: 999px; font-size: 12px; font-weight: 500; white-space: nowrap; }
.pill .pd { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.pill.on { color: var(--dp-success); background: var(--dp-success-soft); }
.pill.none { color: var(--dp-text2); background: var(--dp-subtle); }
.pill.upd { color: var(--dp-primary); background: var(--dp-primary-soft); height: 19px; font-size: 11px; margin-left: 6px; }
.sig { display: inline-flex; align-items: center; gap: 6px; }
.sig .val { font-size: 12px; color: var(--dp-text2); }
.bat { display: inline-flex; align-items: center; gap: 3px; }
.bat.low { color: var(--dp-error); font-weight: 500; }
.t3 { color: var(--dp-text3); }
.note { color: var(--dp-text2); padding: 28px 18px; }
.foot { display: flex; justify-content: space-between; padding: 10px 6px 0; font-size: 12px; color: var(--dp-text2); }

/* Handy: Karten statt Tabelle (Design C, Bild 7 / Variante B) */
.cards .gh { margin: 14px 4px 6px; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; font-weight: 600; color: var(--dp-text2); }
.cards .gh.e { color: var(--dp-error); }
.mc { background: var(--dp-card); border-radius: 16px; border: 1px solid var(--dp-divider); padding: 11px 12px; display: grid;
  grid-template-columns: 38px 1fr auto; gap: 2px 12px; align-items: center; margin-bottom: 8px; }
.mc.off { border-color: var(--dp-error-line); background: linear-gradient(90deg, var(--dp-error-soft), transparent 70%), var(--dp-card); }
.mc .av { width: 38px; height: 38px; }
.mc .nm { font-weight: 500; font-size: 14.5px; }
.mc .sb { font-size: 12px; color: var(--dp-text2); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.mc .rt { text-align: right; }
.mlist { border-radius: 16px; overflow: hidden; border: 1px solid var(--dp-divider); background: var(--dp-card); }
.mrow { display: grid; grid-template-columns: 34px 1fr auto; gap: 12px; align-items: center; padding: 9px 12px; border-bottom: 1px solid var(--dp-divider); }
.mrow:last-child { border-bottom: 0; }

@media (max-width: 600px) {
  .toolbar { padding: 10px 12px 8px; gap: 8px; }
  .toolbar h1 { font-size: 18px; }
  .content { padding: 0 12px 12px; }
  .hero { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: 10px; margin: 0 -12px; padding: 0 12px; scrollbar-width: none; }
  .hero::-webkit-scrollbar { display: none; }
  .hero .kt { min-width: 280px; scroll-snap-align: start; }
  .kt.ring { grid-template-columns: 84px 1fr; }
  .ringwrap { width: 84px; height: 84px; }
  .ringwrap svg { width: 84px; height: 84px; }
  .ringwrap .c b { font-size: 19px; }
  .ringwrap .c span { font-size: 10px; max-width: 60px; }
  .chips { flex-wrap: nowrap; overflow-x: auto; margin: 12px -12px 4px; padding: 0 12px; scrollbar-width: none; }
  .chips::-webkit-scrollbar { display: none; }
}
`;
