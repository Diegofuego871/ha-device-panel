# Übergabe: Stand und nächste Schritte

Einstieg für jede neue Claude-Code-Session. Zuerst diese Datei lesen, dann
`CLAUDE.md`, `docs/CONCEPT.md`, `docs/LEARNINGS.md`, `docs/DESIGN.md`.

## Stand (0.1.0b1, erste Vorabversion)

- Repository `Diegofuego871/ha-device-panel`. Die Arbeit seit dem
  Projektstart liegt auf dem Branch `claude/kind-feynman-dut32g`; `main` ist
  noch auf dem Stand des Projektstarts (ohne Icon).
- Grundgerüst lauffähig: Integration `device_panel` (Config-Flow, eine
  Instanz), iframe-Panel in der Seitenleiste, WebSocket
  `device_panel/list_devices`, Tabelle mit allen Geräten (ausgefallene
  zuoberst), Suche, Zähler.
- Icon und Logo: Variante "D mit Puls" (vom Nutzer gewählt). PNGs in
  `custom_components/device_panel/brand/` (Masse wie unifi_dynamic), Quellen
  in `docs/brand/` (siehe `docs/DESIGN.md`, Abschnitt "Icon und Logo").
- Push-Meldungen vorbereitet: `brand/` wird ohne Anmeldung unter
  `/device_panel/` ausgeliefert, `hass.data[DATA_PUSH_IMAGE]` enthält
  `/device_panel/icon.png` (für `icon_url`). Der Versand selbst fehlt noch,
  siehe `docs/CONCEPT.md`, Abschnitt "Push-Meldungen".
- CI: Python-Tests, Panel-Tests (DE/EN) und Hassfest grün. HACS-Prüfung nur
  noch rot, solange die Topics fehlen → setzt der Nutzer unter "About"
  (`home-assistant`, `hacs`, `integration`, `home-assistant-custom`).
- Releases über `.github/workflows/release.yml`: Notes aus dem
  CHANGELOG-Abschnitt der Version in `manifest.json`, Nummer mit a/b/rc →
  Vorabversion. Start per "Run workflow" auf `main` (Claude: Werkzeug
  `actions_run_trigger`, Workflow `release.yml`, Ref `main`) oder durch
  einen Tag `vX.Y.Z`. Claude-Code-Sessions können keine Tags pushen (403).
  Gibt es das Release schon, ändert der Lauf nichts.
- Version `0.1.0b1` ist vorbereitet, aber noch nicht veröffentlicht: Der
  Workflow braucht den Stand auf `main`.

## Nächste Schritte (Reihenfolge)

1. Branch nach `main` bringen (PR), damit HACS ohne eingeschaltete
   Vorabversionen denselben Stand bekommt. Danach `0.1.0` als stabile
   Version, Repo in HACS als benutzerdefiniertes Repository testen.
2. Offene Entscheide aus `docs/CONCEPT.md` klären (Definition
   "ausgefallen", Schwelle, ausgeblendete Geräte, Recorder-Nachfüllen).
3. Pflicht-Übernahmen aus unifi_dynamic umsetzen (`docs/CONCEPT.md`,
   Abschnitt "Pflicht"): Einstellungen im Panel, Update-Bereich mit Beta
   und HACS-Freischalten, Speicher-Konzept Spalten/Handy-Ansicht.
   Vorlagen liegen in `docs/reference/`.
4. Verfügbarkeitsprotokoll und Geräteansicht mit Statistik.
5. Push-Meldungen bei Ausfall (Bild bereits bereitgestellt).

## Zweisprachigkeit DE/EN (verbindlich)

Alles, was der Nutzer sieht, gibt es auf Deutsch und Englisch. Kein Text
ist fest im Code.

| Bereich | Ort | Regel |
| --- | --- | --- |
| Panel | `panel/strings.js` | `STRINGS.de` und `STRINGS.en` mit identischen Schlüsseln; Sprache aus `hass.locale.language` (`de`/`de-*` → Deutsch, sonst Englisch) |
| HA-Oberfläche (Config-Flow, Optionen, Entitäten, Dienste, Reparaturen) | `strings.json`, `translations/en.json`, `translations/de.json` | `strings.json` identisch mit `en.json`; `de.json` mit denselben Schlüsseln |
| Serverseitige Texte (Push, Reparaturen mit Platzhaltern, Optionslisten) | Python | `hass.config.language`, `de`/`de-*` → Deutsch, sonst Englisch |
| README | `README.md` (EN), `README.de.md` (DE) | immer beide gleich nachführen, gegenseitig verlinkt |
| CHANGELOG, Release Notes | `CHANGELOG.md` | nur Englisch |
| Code-Kommentare | Python, JS | Deutsch |
| Kommunikation mit dem Nutzer | Chat | Deutsch, Schweizer Rechtschreibung (kein Eszett), Anführungszeichen "" |

Absicherung durch Tests (`tests/test_translations.py`): gleiche Schlüssel DE/EN
in `translations/` und `strings.js`, `strings.json` = `en.json`, kein Eszett,
Sprachwahl `pickLang` (`de`/`de-*` → Deutsch, sonst Englisch).
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
- Jede funktionale Änderung: Version, `PANEL_VERSION`, CHANGELOG, README DE/EN,
  Prüfungen, Tests; nach dem Push Release Notes (EN) als Codeblock ausgeben.
- Veröffentlichte Tags nie ändern.
- Keine Tokens/Keys im Panel; andere Integrationen nur per Knopfdruck ändern.
