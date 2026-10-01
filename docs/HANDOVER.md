# Übergabe: Stand und nächste Schritte

Einstieg für jede neue Claude-Code-Session. Zuerst diese Datei lesen, dann
`CLAUDE.md`, `docs/CONCEPT.md`, `docs/LEARNINGS.md`, `docs/DESIGN.md`.

## Stand (0.1.0, Projektstart)

- Repository `Diegofuego871/ha-device-panel`, Branch `main`.
- Grundgerüst lauffähig: Integration `device_panel` (Config-Flow, eine
  Instanz), iframe-Panel in der Seitenleiste, WebSocket
  `device_panel/list_devices`, Tabelle mit allen Geräten (ausgefallene
  zuoberst), Suche, Zähler.
- CI: Hassfest grün, Panel-Tests (Playwright) grün, Python-Tests
  (pytest-homeassistant-custom-component) eingerichtet.
- HACS-Prüfung noch rot:
  - Beschreibung und Topics im Repo fehlen → setzt der Nutzer unter "About"
    (`home-assistant`, `hacs`, `integration`, `home-assistant-custom`).
  - Brand-Icon fehlt → `custom_components/device_panel/brand/icon.png` und
    `logo.png` (256 × 256 bzw. ≥ 256 Höhe, PNG, transparent). Erst
    Entwürfe als Mockup, Nutzer wählt.
- Noch kein Release-Tag. Erst nach grüner CI `v0.1.0` erstellen.

## Nächste Schritte (Reihenfolge)

1. Icon: 3–4 Entwürfe (hell/dunkel), Nutzer wählt, committen, CI grün.
2. Release `v0.1.0`, Repo in HACS als benutzerdefiniertes Repository testen.
3. Offene Entscheide aus `docs/CONCEPT.md` klären (Definition
   "ausgefallen", Schwelle, ausgeblendete Geräte, Recorder-Nachfüllen).
4. Pflicht-Übernahmen aus unifi_dynamic umsetzen (`docs/CONCEPT.md`,
   Abschnitt "Pflicht"): Einstellungen im Panel, Update-Bereich mit Beta
   und HACS-Freischalten, Speicher-Konzept Spalten/Handy-Ansicht.
   Vorlagen liegen in `docs/reference/`.
5. Verfügbarkeitsprotokoll und Geräteansicht mit Statistik.

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
in `translations/` und `strings.js`, `strings.json` = `en.json`, kein Eszett.
Panel-Tests prüfen wichtige Ansichten in beiden Sprachen. Neue Texte immer
in beiden Sprachen im selben Commit.

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
