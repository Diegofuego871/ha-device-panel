# CLAUDE.md – HA Device Panel

Anweisungen für Claude Code in diesem Repository. Vor jeder Arbeit lesen,
zusammen mit `docs/CONCEPT.md`, `docs/LEARNINGS.md` und `docs/DESIGN.md`.

## Projekt

Home-Assistant-Integration (HACS, Domain `device_panel`) mit einem Panel, das
alle Geräte von Home Assistant zeigt: wer gerade ausgefallen ist, wie oft und
wie lange Geräte ausfallen, dazu Angaben wie Softwarestand, Hersteller und
Bereich. Vorbild in Aufbau, Arbeitsweise und Design ist die Integration
"UniFi Dynamic Clients" (Diegofuego871/unifi_dynamic).

## Sprache und Stil

- Kommunikation mit dem Nutzer: Deutsch, Schweizer Rechtschreibung (nie "ß",
  immer "ss"), präzise, ohne Füllwörter. Anführungszeichen: "".
- Code-Kommentare und Docstrings auf Deutsch. Kommentare erklären das Warum,
  nicht das Was.
- CHANGELOG und Release Notes auf Englisch (Keep a Changelog).
- README in zwei Sprachen: `README.md` (Englisch) und `README.de.md`
  (Deutsch), immer beide gleich halten.
- Panel-Texte in `panel/strings.js`, Deutsch und Englisch mit denselben
  Schlüsseln; HA-Texte in `strings.json` = `translations/en.json` und
  `translations/de.json`.

## Arbeitsweise

- Vor grösseren UI-Änderungen Mockups bauen (HTML, gerendert als Bild,
  mehrere Varianten mit Empfehlung). Der Nutzer entscheidet visuell.
- Bei Entscheidungen mit Verhaltensänderung oder Risiko nachfragen, mit
  Auswirkungen und Empfehlung. Kleine, klare Fehler direkt beheben.
- Nichts annehmen, was sich prüfen lässt: Code, HA-Quellcode, Tests.
- Screenshots, Mockups und Testdaten nur mit erfundenen Daten.
- Sicherheitsrelevantes (Tokens, Keys) nie im Panel anzeigen.
- Andere Integrationen nie ohne ausdrücklichen Knopfdruck des Nutzers ändern.

## Bei jeder funktionalen Änderung

1. Version in `manifest.json` erhöhen (SemVer: Patch für Fehler, Minor für
   Funktionen oder Verhaltensänderungen).
2. `PANEL_VERSION` in `const.py` erhöhen, sobald sich Dateien unter
   `panel/` ändern (Cache-Buster).
3. CHANGELOG-Eintrag (Englisch) inkl. Link-Fussnote.
4. README DE und EN nachführen.
5. Prüfungen (siehe unten) und Tests laufen lassen.
6. `.pyc`/`__pycache__` nie committen.
7. Nach dem Push die Release Notes (Englisch) als Markdown-Codeblock
   ausgeben.
8. Veröffentlichte Tags nie ändern: existiert der Tag schon, neue
   Patch-Version.

## Prüfungen vor jedem Commit

- Python: `python -m pyflakes custom_components/device_panel/*.py`
- JSON gültig, `strings.json` identisch mit `translations/en.json`
- `node --check` für alle Panel-Dateien
- kein "ß" in Code, Texten, README, CHANGELOG
- `python -m pytest` (Python 3.13, `pip install pytest-homeassistant-custom-component`)
- `cd tests/panel && npm ci && npx playwright-core install chromium && node run.mjs`
- Realistische Tests auf Desktop und Handy (390 × 844), echte Klicks/Taps.

## Commit-Nachrichten

Kurze Betreffzeile mit Version ("1.2.0: …"), Liste der Änderungen, am Ende
die vom System vorgegebenen Co-Author-/Session-Zeilen.
