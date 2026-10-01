# Übergabe: Stand und nächste Schritte

Einstieg für jede neue Claude-Code-Session. Zuerst diese Datei lesen, dann
`CLAUDE.md`, `docs/CONCEPT.md`, `docs/LEARNINGS.md`, `docs/DESIGN.md`.

## Stand (0.8.0, Batterie-Schwelle auch pro Integration)

- Repository `Diegofuego871/ha-device-panel`, nur Branch `main` (siehe
  `CLAUDE.md`, "Git und Releases").
- Integration `device_panel` (Config-Flow, eine Instanz), iframe-Panel in
  der Seitenleiste. WebSocket: `device_panel/list_devices` (Daten aus
  `devices.py`: Status nach dem Standard der Überwachung, Verbindungsart,
  Empfang, Hub, Batterie, Update, Typ, Integration mit Eintrag,
  Verfügbarkeit 24 Std., Puls, Sammelausfälle), `device_panel/device`
  (Popup), `device_panel/availability` (Statistik-Fenster) und
  `device_panel/set_device_type` (Typ von Hand im Popup, Datei
  `.storage/device_panel.devices`).
- Einstellungen im Panel (Zahnrad), Reihenfolge nach Bild 5:
  Versionskasten mit Update über HACS, Vorabversionen, "In HACS
  freischalten"; "Ausfall-Erkennung" (Zahlenfelder `offline_after`,
  `flaky_outages`, `startup_grace` mit Bereichen aus `const.INT_RANGES`,
  Prüfung im Panel und im Backend); "Batterie" (`battery_low`,
  `battery_low_integrations` {Domain: %} nach Mockup A in
  `docs/mockups/battery-v1/`, `battery_push`, `battery_persistent`;
  Überwachung in `battery.py`);
  "Integrationen" und "Gerätetypen" (Schalter "Anzeigen"; ausgeblendete
  Geräte werden nicht überwacht); "Push-Benachrichtigung"
  (`notify_service`, `notify_click_target`; Versand in `push.py`);
  "Anzeige" (`show_service_devices`, `show_disabled_devices`: deaktivierte
  Geräte in eigener Gruppe, nicht überwacht); "Updates" (tägliche Prüfung
  mit Meldung unter "Reparaturen"). Backend `update_check.py`,
  `options_api.py` (`effective(hass)` liefert die wirksamen Werte),
  Optionsdialog in `config_flow.py` mit denselben Feldern in derselben
  Reihenfolge; WebSocket `device_panel/version`, `set_panel`, `get_options`
  (mit Katalog aller Integrationen und Typen sowie `limits`),
  `set_options`. Welche Geräte gezeigt werden, entscheidet nur das Backend
  (`devices.listed_devices`, Protokoll `monitored_devices`).
- Verfügbarkeitsprotokoll (`availability.py`, `.storage/device_panel.availability`,
  31 Tage), siehe `docs/CONCEPT.md`, "Verfügbarkeitsprotokoll".
- Panel in Design C: Kopf mit Ring (Ø 24 Std.), Ausfall-Tafel und
  Ausfall-Puls; Chips nach Verbindungsart, "Nur Probleme" und Hinweisen;
  Gruppen ausgefallen, instabil, keine Daten, online; erste Spalte fixiert;
  Handy als Karten. Jede Zeile öffnet ein Popup wie unifi_dynamic, die
  Statistik-Kacheln ein zweites Fenster. Matter-Funkart holt das Panel
  selbst über `matter/node_diagnostics`.
- Geprüft im echten HA 2026.2.3 mit der Demo-Integration (Anleitung siehe
  `docs/LEARNINGS.md`, "Prüfung im echten Home Assistant").
- Icon und Logo: Variante "D mit Puls" (vom Nutzer gewählt). PNGs in
  `custom_components/device_panel/brand/` (Masse wie unifi_dynamic), Quellen
  in `docs/brand/` (siehe `docs/DESIGN.md`, Abschnitt "Icon und Logo").
- Push-Meldungen vorbereitet: `brand/` wird ohne Anmeldung unter
  `/device_panel/` ausgeliefert, `hass.data[DATA_PUSH_IMAGE]` enthält
  `/device_panel/icon.png` (für `icon_url`). Der Versand selbst fehlt noch,
  siehe `docs/CONCEPT.md`, Abschnitt "Push-Meldungen".
- CI: Python-Tests, Panel-Tests (DE/EN), Hassfest und HACS-Prüfung grün
  (Beschreibung und Topics sind gesetzt).
- Releases legt der Nutzer an; Claude liefert die Release-Angaben (siehe
  `CLAUDE.md`, "Git und Releases").
- `v0.1.0b1` (Vorabversion) zeigt versehentlich auf `8944f3b`, den Stand vor
  Icon und Sprachtests (Manifest 0.1.0). Der Tag bleibt (veröffentlichte Tags
  nie ändern); `0.1.0b2` ersetzt ihn. `0.1.0` (Commit `ea170ca`) wurde auf
  Wunsch des Nutzers nicht veröffentlicht; die erste stabile Version kommt
  mit `0.2.0`. Geändert (Nutzer, 2026-10-01): Die erste stabile Version ist
  `0.4.0`. `0.4.0b1` hatte keinen Tag und wurde direkt zu `0.4.0`. Grund: Ohne
  stabiles Release und ohne eingeschalteten Schalter "Pre-release" bietet HACS
  den neuesten Commit von `main` als Update an (bei jedem Push neu).

## Nächste Schritte (Reihenfolge)

1. Entschieden (Nutzer, 2026-10-01): Design Variante C mit allen Ideen
   (`docs/mockups/panel-v1/`, Bilder 5–8), Überwachung mit vier Ebenen
   (Bild 9, `docs/CONCEPT.md`, "Überwachung einstellen"), ohne HACS nur
   Hinweis wie unifi_dynamic. Offen: Recorder-Nachfüllen (mit Schritt 6).
2. Fahrplan-Schritte 1, 4, 5 und 6 erledigt (`0.2.0b1` bis `0.4.0`),
   Schritt 3 als Grundgerüst. Ausschlüsse nach Integration und Gerätetyp
   mit `0.5.0` erledigt (Nutzer, 2026-10-01: ein Typ pro Gerät, vier neue
   Typen, Typ im Popup änderbar). Ausfall-Erkennung und Anzeige mit `0.6.0`.
   Batterie-Warnung (Wunsch des Nutzers, 2026-10-01: Schwelle wählbar,
   Push und anhaltende Benachrichtigung getrennt wählbar) mit `0.7.0`,
   dabei die Push-Grundlage (Ziel, Klickziel, Versand, Deep-Link
   `?device=`). Schwelle pro Integration (Nutzer, 2026-10-01: Variante A)
   mit `0.8.0`. Releases: `0.6.0` und `0.7.0` ohne Release, in `0.8.0`
   enthalten. Weiter mit Schritt 2 (Spalten pro Benutzer) und Schritt 7
   (Push bei Ausfällen: übrige Felder des Abschnitts "Push-Benachrichtigung",
   Abschnitt "Anhaltende Benachrichtigung", Spalten Push/Anhaltend bei den
   Integrationen nach Bild 5);
   `docs/CONCEPT.md`, "Pflicht"; Vorlagen in `docs/reference/`. Offene Frage an den Nutzer: Prozentwerte erst ab
   einer Mindestdauer an Daten zeigen?
3. Umsetzung nach dem Fahrplan in `docs/CONCEPT.md` (Abschnitt "Fahrplan"),
   der Reihe nach: Geräteliste mit Statistik, Spalten pro Benutzer,
   Einstellungsmenü, Update-Bereich, Geräteansicht, Verfügbarkeitsprotokoll,
   Push-Meldungen, Ideen. Vorlagen liegen in `docs/reference/`.

## Zweisprachigkeit DE/EN (verbindlich)

Alles, was der Nutzer sieht, gibt es auf Deutsch und Englisch. Kein Text
ist fest im Code.

| Bereich | Ort | Regel |
| --- | --- | --- |
| Panel | `panel/strings.js` | `STRINGS.de` und `STRINGS.en` mit identischen Schlüsseln; Sprache aus `hass.locale.language` (`de`/`de-*` → Deutsch, sonst Englisch) |
| HA-Oberfläche (Config-Flow, Optionen, Entitäten, Dienste, Reparaturen) | `strings.json`, `translations/en.json`, `translations/de.json` | `strings.json` identisch mit `en.json`; `de.json` mit denselben Schlüsseln |
| Serverseitige Texte (Push, Reparaturen mit Platzhaltern, Optionslisten) | Python | `hass.config.language`, `de`/`de-*` → Deutsch, sonst Englisch |
| README | `README.md` (EN), `README.de.md` (DE) | gleicher Aufbau, gegenseitig verlinkt, immer beide im selben Commit |
| CHANGELOG | `CHANGELOG.md` (EN), `CHANGELOG.de.md` (DE) | gleicher Aufbau (Keep a Changelog), gegenseitig verlinkt, immer beide im selben Commit |
| Release Notes | Text für den Nutzer | Englisch, aus `CHANGELOG.md` |
| Code-Kommentare | Python, JS | Deutsch |
| Kommunikation mit dem Nutzer | Chat | Deutsch, Schweizer Rechtschreibung (kein Eszett), Anführungszeichen "" |

Absicherung durch Tests (`tests/test_translations.py`): gleiche Schlüssel DE/EN
in `translations/` und `strings.js`, `strings.json` = `en.json`, kein Eszett,
Sprachwahl `pickLang` (`de`/`de-*` → Deutsch, sonst Englisch), gleicher
Aufbau von README und CHANGELOG in beiden Sprachen (Überschriften,
Listenpunkte, Versionen, Link-Fussnoten).
Panel-Tests prüfen die Ansichten in beiden Sprachen: Der HA-Nachbau nimmt die
Sprache aus `?lang=de|en`, die Suiten laufen je Sprache auf Desktop und Handy
und vergleichen die Texte ausgeschrieben (`tests/panel/suites/table-e2e.mjs`,
`popup-e2e.mjs`, `settings-e2e.mjs`; `version-e2e.mjs` nur Deutsch wie in
unifi_dynamic). Der Nachbau rechnet Liste, Popup und Verlauf aus einem
erfundenen Verlauf je Gerät (`HIST` in `sim/ha-sim.html`) und simuliert HACS
(Update-Entität, Schalter "Pre-release", Repository-Befehle).
Neue Suiten genauso aufbauen. Neue Texte immer in beiden Sprachen im selben
Commit.

Begriffe einheitlich halten (Beispiele):

| Deutsch | Englisch |
| --- | --- |
| ausgefallen | offline |
| Verfügbarkeit | availability |
| Unterbruch | outage |
| Softwarestand | software version |
| Einstellungen | Settings |
| Vorabversionen | pre-releases |
| Speichern / Abbrechen | Save / Cancel |

## Arbeitsweise mit dem Nutzer (Kurzfassung)

- Vor UI-Änderungen Mockups (erfundene Daten, Desktop und Handy, Varianten
  mit Empfehlung); der Nutzer entscheidet visuell.
- Bei Verhaltensänderungen nachfragen, mit Auswirkung und Empfehlung.
- Nur auf `main` pushen, andere Branches löschen. Pushen ist jederzeit
  erlaubt; der Nutzer legt Tag und Release mit Ziel `main` an. Übersprungene
  Versionen: Release Notes fassen alles seit dem letzten Release zusammen
  (`CLAUDE.md`, "Git und Releases").
- Jede funktionale Änderung: Version, `PANEL_VERSION`, CHANGELOG DE/EN,
  README DE/EN, Prüfungen, Tests; nach dem Push die Release-Angaben mit
  genauer Version ausgeben (Nutzer legt Tag und Release an).
- Veröffentlichte Tags nie ändern.
- Keine Tokens/Keys im Panel; andere Integrationen nur per Knopfdruck ändern.
