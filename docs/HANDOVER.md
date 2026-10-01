# Übergabe: Stand und nächste Schritte

Einstieg für jede neue Claude-Code-Session. Zuerst diese Datei lesen, dann
`CLAUDE.md`, `docs/CONCEPT.md`, `docs/LEARNINGS.md`, `docs/DESIGN.md`.

## Stand (0.2.0b1, Vorabversion der neuen Geräteliste)

- Repository `Diegofuego871/ha-device-panel`, nur Branch `main` (siehe
  `CLAUDE.md`, "Git und Releases").
- Integration `device_panel` (Config-Flow, eine Instanz), iframe-Panel in
  der Seitenleiste, WebSocket `device_panel/list_devices` (Daten aus
  `devices.py`: Status nach dem Standard der Überwachung, Verbindungsart,
  Empfang, Hub, Batterie, Update).
- Panel in Design C (Fahrplan-Schritt 1): Kopf mit Ring, Ausfall-Tafel und
  Hinweisen, Chips nach Verbindungsart, Gruppen, Handy als Karten. Matter-
  Funkart holt das Panel selbst über `matter/node_diagnostics`.
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
  mit `0.2.0`.

## Nächste Schritte (Reihenfolge)

1. Entschieden (Nutzer, 2026-10-01): Design Variante C mit allen Ideen
   (`docs/mockups/panel-v1/`, Bilder 5–8), Überwachung mit vier Ebenen
   (Bild 9, `docs/CONCEPT.md`, "Überwachung einstellen"), ohne HACS nur
   Hinweis wie unifi_dynamic. Offen: Recorder-Nachfüllen (mit Schritt 6).
2. Fahrplan-Schritt 1 erledigt (`0.2.0b1`). Weiter mit Schritt 2: Spalten,
   Sortierung und Filter pro Benutzer, getrennt Desktop/Handy
   (`docs/CONCEPT.md`, "Pflicht", Abschnitt 3; Vorlagen in
   `docs/reference/`).
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
und vergleichen die Texte ausgeschrieben (`tests/panel/suites/table-e2e.mjs`).
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
- Nur auf `main` pushen, andere Branches löschen.
- Jede funktionale Änderung: Version, `PANEL_VERSION`, CHANGELOG DE/EN,
  README DE/EN, Prüfungen, Tests; nach dem Push die Release-Angaben mit
  genauer Version ausgeben (Nutzer legt Tag und Release an).
- Veröffentlichte Tags nie ändern.
- Keine Tokens/Keys im Panel; andere Integrationen nur per Knopfdruck ändern.
