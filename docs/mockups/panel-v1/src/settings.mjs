// Einstellungen wie in unifi_dynamic: zuklappbare Abschnitte mit
// Zusammenfassung, Etikett "geändert", Zähler der Änderungen, Speichern.
import { ic, connIcon } from "./base.mjs";
import { CSS_A } from "./variantA.mjs";

// Echtes Brand-Icon aus dem Repository.
const ICON_URL = new URL("../../../../custom_components/device_panel/brand/icon.png", import.meta.url).href;

export const CSS_S = `
.bgfake { position: absolute; inset: 0; background: var(--bg); }
.scrim2 { position: absolute; inset: 0; background: var(--scrim); }
.sdlg { position: relative; margin: 32px auto; width: 720px; background: var(--card); border-radius: 24px; box-shadow: var(--shadow); padding: 22px 22px 0; }
.shead { display: flex; gap: 14px; align-items: center; }
.shead .av { width: 52px; height: 52px; border-radius: 15px; display: grid; place-items: center; background: var(--pri-soft); color: var(--primary); }
.shead h2 { margin: 0; font-size: 21px; font-weight: 500; }
.ver { margin-top: 16px; border-radius: 18px; padding: 14px 16px; background: linear-gradient(135deg, var(--vio-soft), transparent 75%), var(--subtle); border: 1px solid color-mix(in srgb, var(--violet) 28%, transparent); }
.ver .r1 { display: flex; align-items: center; gap: 12px; }
.ver .vi { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: var(--violet); color: #fff; }
.ver .tt { font-size: 16px; font-weight: 500; display: flex; align-items: center; gap: 8px; }
.ver .vs { font-size: 12.5px; color: var(--text2); margin-top: 2px; }
.ver .vs a { color: var(--primary); }
.ver .r2 { display: flex; align-items: center; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--divider); }
.ver .r2 .lb { flex: 1; } .ver .r2 .lb div:last-child { font-size: 12px; color: var(--text2); }
.ver .note { margin-top: 10px; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: var(--card); font-size: 12.5px; }
.ver .note .btn { height: 32px; font-size: 13px; margin-left: auto; }
.acc { margin-top: 10px; border: 1px solid var(--divider); border-radius: 18px; }
.acc .ah { display: flex; align-items: center; padding: 13px 16px; gap: 10px; }
.acc .ah .tx { flex: 1; } .acc .ah b { font-weight: 500; font-size: 16px; } .acc .ah div div { font-size: 12.5px; color: var(--text2); margin-top: 2px; }
.acc .ah .ic { color: var(--text2); }
.acc .chg { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--pri-soft); color: var(--primary); margin-left: 8px; font-weight: 500; vertical-align: 2px; }
.acc .ab { border-top: 1px solid var(--divider); padding: 4px 16px 10px; }
.fr { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--divider); }
.fr:last-child { border-bottom: 0; }
.fr .lb { flex: 1; } .fr .lb > div:first-child { font-size: 14.5px; display: flex; align-items: center; gap: 6px; } .fr .lb > div:last-child { font-size: 12px; color: var(--text2); margin-top: 2px; }
.fr .lb .ic { color: var(--text3); }
.sel { min-width: 230px; height: 38px; border: 1px solid var(--divider); border-radius: 12px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; background: var(--input); font-size: 14px; }
.num { width: 120px; height: 38px; border: 1px solid var(--divider); border-radius: 12px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; background: var(--input); font-size: 14px; }
.num span { color: var(--text2); font-size: 12.5px; }
.ig { width: 100%; border-collapse: collapse; margin-top: 4px; }
.ig th { font-size: 11.5px; text-transform: uppercase; letter-spacing: .04em; color: var(--text2); font-weight: 500; padding: 8px 6px; text-align: center; border-bottom: 1px solid var(--divider); }
.ig th:first-child { text-align: left; padding-left: 0; }
.ig td { padding: 8px 6px; border-bottom: 1px solid var(--divider); text-align: center; }
.ig td:first-child { text-align: left; padding-left: 0; }
.ig tr:last-child td { border-bottom: 0; }
.ig .toggle { display: inline-block; vertical-align: middle; }
.ig .n { display: flex; align-items: center; gap: 10px; }
.ig .lg { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; font-size: 11px; font-weight: 700; color: #fff; }
.ig .n small { color: var(--text2); font-size: 12px; display: block; }
.ig tr.dim td:first-child { opacity: .55; }
.ig tr.all td { background: var(--subtle); font-size: 13px; color: var(--text2); }
.ig tr.all td:first-child { padding-left: 10px; border-radius: 10px 0 0 10px; } .ig tr.all td:last-child { border-radius: 0 10px 10px 0; }
.fg { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 28px; margin-top: 4px; }
.fg div { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; font-size: 14px; }
.pv { margin-top: 12px; background: var(--subtle); border-radius: 16px; padding: 14px; }
.pv .lbl { font-size: 12px; color: var(--text2); margin-bottom: 8px; display: flex; justify-content: space-between; }
.noti { background: var(--card); border-radius: 18px; padding: 12px 14px; box-shadow: var(--shadow-s); display: grid; grid-template-columns: 1fr 46px; gap: 4px 12px; }
.noti .ap { font-size: 11.5px; color: var(--text2); grid-column: 1 / -1; display: flex; align-items: center; gap: 6px; }
.noti .ap img { width: 14px; height: 14px; }
.noti b { font-size: 14px; } .noti p { margin: 2px 0 0; font-size: 13px; line-height: 1.4; }
.noti img.big { width: 46px; height: 46px; grid-row: 2 / 4; grid-column: 2; align-self: center; }
.noti .acts2 { grid-column: 1 / -1; display: flex; gap: 18px; margin-top: 8px; font-size: 13px; font-weight: 500; color: var(--primary); }
.sfoot { position: static; background: var(--card); display: flex; align-items: center; gap: 10px; padding: 14px 0 18px; margin-top: 16px; border-top: 1px solid var(--divider); }
.sfoot .btn { flex: 1; justify-content: center; height: 44px; }
.sfoot .cnt { font-size: 13px; color: var(--text2); white-space: nowrap; }
`;

const LG = (txt, col) => `<span class="lg" style="background:${col}">${txt}</span>`;
const INTEGS = [
  ["ZHA", "46 Geräte · Zigbee", "#e2a72e", "ZH", [1, 1, 0]],
  ["Shelly", "21 Geräte · WLAN", "#4a90d9", "SH", [1, 1, 0]],
  ["ESPHome", "17 Geräte · WLAN", "#1f2937", "ES", [1, 1, 1]],
  ["Matter", "14 Geräte · Thread, WLAN", "#6d28d9", "MA", [1, 1, 0]],
  ["BTHome", "11 Geräte · Bluetooth", "#0ea5e9", "BT", [1, 0, 0]],
  ["Hue", "8 Geräte · Zigbee über Bridge", "#f59e0b", "HU", [1, 0, 0]],
  ["Z-Wave JS", "4 Geräte · Z-Wave", "#0f766e", "ZW", [1, 1, 0]],
  ["Synology DSM", "1 Gerät · LAN", "#334155", "SY", [1, 1, 1]],
  ["Mobile App", "3 Geräte · Handys", "#64748b", "MO", [0, 0, 0]],
];

function body(mobile = false) {
  const tg = (on) => `<span class="toggle ${on ? "on" : ""}"></span>`;
  return `
  <div class="shead"><div class="av">${ic("cog", 28)}</div><div><h2>Einstellungen</h2><div class="t2" style="font-size:13px">Device Panel · gilt für alle Benutzer</div></div><div class="xbtn" style="margin-left:auto">${ic("close", 20)}</div></div>
  <div class="ver">
    <div class="r1"><div class="vi">${ic("update", 22)}</div>
      <div style="flex:1"><div class="tt">Device Panel 0.1.0b2 <span class="pill beta">Beta</span></div><div class="vs">Neu: <b>0.2.0b1</b> (Vorabversion) · <a>Release Notes</a> · geprüft vor 3 Min.</div></div>
      ${mobile ? "" : `<span class="btn round">${ic("refresh", 18)}</span>`}<span class="btn primary">${ic("download", 18)} Aktualisieren</span></div>
    <div class="r2"><div class="lb"><div>Vorabversionen anzeigen</div><div>Für die ganze Instanz. Beta-Versionen erscheinen violett.</div></div><span class="toggle on"></span></div>
    <div class="note">${ic("info", 18)}<span>HACS installiert Vorabversionen erst, wenn sie dort freigeschaltet sind.</span><span class="btn">In HACS freischalten</span></div>
  </div>
  <div class="acc"><div class="ah"><div class="tx"><b>Ausfall-Erkennung</b><div>Ausgefallen nach 2 Min. · instabil ab 3 Unterbrüchen in 24 Std. · Neustarts zählen nicht</div></div>${ic("chevDown", 22)}</div></div>
  <div class="acc"><div class="ah"><div class="tx"><b>Integrationen</b><span class="chg">geändert</span><div>9 Integrationen · 1 ausgeblendet · Push für 6</div></div>${ic("chevUp", 22)}</div>
    <div class="ab"><table class="ig"><tr><th>Integration</th><th>Anzeigen</th><th>Push</th><th>Anhaltend</th></tr>
      <tr class="all"><td>Alle umschalten</td><td>${tg(1)}</td><td>${tg(1)}</td><td>${tg(0)}</td></tr>
      ${INTEGS.map(([n, s, c, l, [a, p, h]]) => `<tr class="${a ? "" : "dim"}"><td><div class="n">${LG(l, c)}<div>${n}<small>${s}</small></div></div></td><td>${tg(a)}</td><td>${tg(p)}</td><td>${tg(h)}</td></tr>`).join("")}
    </table></div></div>
  <div class="acc"><div class="ah"><div class="tx"><b>Push-Benachrichtigung</b><span class="chg">geändert</span><div>notify.handy_familie · Ausfall, wieder online, Sammelausfall</div></div>${ic("chevUp", 22)}</div>
    <div class="ab">
      <div class="fr"><div class="lb"><div>Ziel ${ic("info", 15)}</div><div>notify-Dienst oder -Entität.</div></div><span class="sel">notify.handy_familie ${ic("chevDown", 18)}</span></div>
      <div class="fr"><div class="lb"><div>Tipp auf Meldung öffnet ${ic("info", 15)}</div><div>Wohin die Meldung führt.</div></div><span class="sel">Geräteansicht im Panel ${ic("chevDown", 18)}</span></div>
      <div class="fr"><div class="lb"><div>Erst melden nach ${ic("info", 15)}</div><div>Kurze Aussetzer lösen keine Meldung aus.</div></div><span class="num">5 <span>Min.</span></span></div>
      <div class="fr"><div class="lb"><div>Wieder online melden</div><div>Entwarnung, sobald das Gerät zurück ist.</div></div>${tg(1)}</div>
      <div class="fr"><div class="lb"><div>Sammelausfall zusammenfassen ${ic("info", 15)}</div><div>Ab 3 Geräten innert 2 Min. nur eine Meldung, mit vermuteter Ursache.</div></div>${tg(1)}</div>
      <div class="fr" style="display:block"><div class="lb"><div>Inhalt der Meldung</div><div>Welche Angaben in der Meldung stehen.</div></div>
        <div class="fg">${[["Gerätename", 1], ["Bereich", 1], ["Integration", 1], ["Verbindungsart", 1], ["Offline seit", 1], ["Empfang zuletzt", 1], ["Batterie", 1], ["Hersteller / Modell", 0]].map(([l, on]) => `<div><span>${l}</span>${tg(on)}</div>`).join("")}</div>
        <div class="pv"><div class="lbl"><span>Vorschau</span><span>Android · iOS ohne Bild</span></div>
          <div class="noti"><div class="ap"><img src="${ICON_URL}"> Home Assistant · jetzt</div>
            <div><b>Bewegungsmelder Flur ausgefallen</b><p>Flur · ZHA · Zigbee · offline seit 5 Min.<br>Empfang zuletzt LQI 38 · Batterie 8 %</p></div><img class="big" src="${ICON_URL}">
            <div class="acts2"><span>Öffnen</span><span>24 Std. stumm</span></div></div></div>
      </div>
    </div></div>
  <div class="acc"><div class="ah"><div class="tx"><b>Anhaltende Benachrichtigung</b><div>Eine Sammelmeldung, solange Geräte ausgefallen sind · Integrationen siehe oben</div></div>${ic("chevDown", 22)}</div></div>
  <div class="acc"><div class="ah"><div class="tx"><b>Anzeige</b><div>Dienst-Geräte und deaktivierte Geräte ausgeblendet</div></div>${ic("chevDown", 22)}</div></div>
  <div class="acc"><div class="ah"><div class="tx"><b>Updates</b><div>Tägliche Prüfung · neue Version unter "Reparaturen"</div></div>${ic("chevDown", 22)}</div></div>
  <div class="sfoot"><span class="cnt">3 Änderungen</span><span class="btn">Abbrechen</span><span class="btn primary">Speichern</span></div>`;
}

export const settingsDesktop = () => `<div class="bgfake"></div><div class="scrim2"></div><div class="sdlg">${body()}</div>`;

export const CSS_S_M = `
.msheet { position: absolute; left: 0; right: 0; top: 40px; background: var(--card); border-radius: 24px 24px 0 0; padding: 8px 14px 0; }
.msheet .grab { width: 40px; height: 5px; border-radius: 3px; background: var(--bar-off); margin: 0 auto 12px; }
.msheet .shead .av { width: 44px; height: 44px; } .msheet .shead h2 { font-size: 19px; }
.msheet .ver .r1 { flex-wrap: wrap; } .msheet .ver .r1 .btn.primary { width: 100%; justify-content: center; margin-top: 4px; }
.msheet .ver .note { flex-wrap: wrap; } .msheet .ver .note .btn { margin-left: 0; }
.msheet .ig th { font-size: 10.5px; padding: 8px 2px; } .msheet .ig td { padding: 8px 2px; }
.msheet .ig .n small { display: none; } .msheet .ig .lg { width: 26px; height: 26px; }
.msheet .acc .ah b { font-size: 15px; }
`;
export const settingsMobile = () => `<div class="bgfake"></div><div class="scrim2"></div><div class="msheet"><div class="grab"></div>${body(true)
  .replace(/<div class="acc"><div class="ah"><div class="tx"><b>Push-Benachrichtigung<\/b>[\s\S]*?<div class="acc"><div class="ah"><div class="tx"><b>Anhaltende/, '<div class="acc"><div class="ah"><div class="tx"><b>Push-Benachrichtigung</b><span class="chg">geändert</span><div>notify.handy_familie · Ausfall, wieder online</div></div>' + ic("chevDown", 22) + '</div></div><div class="acc"><div class="ah"><div class="tx"><b>Anhaltende')}</div>`;

const ALL = CSS_A + CSS_S;
export const SCREENS_S = [
  ["S-desktop", () => settingsDesktop(), ALL, { width: 1440, height: 2100, fixed: true }, "light"],
  ["S-mobile", () => settingsMobile(), ALL + CSS_S_M, { width: 390, height: 1505, mobile: true }, "light"],
];
