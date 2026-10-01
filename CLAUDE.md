# CLAUDE.md – HA Device Panel

Anweisungen für Claude Code in diesem Repository. Zuerst `docs/HANDOVER.md`
(Stand, nächste Schritte, Zweisprachigkeit), dann vor jeder Arbeit lesen,
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
- README in zwei Sprachen: `README.md` (Englisch) und `README.de.md`
  (Deutsch), gleicher Aufbau, gegenseitig verlinkt, immer beide im selben
  Commit.
- CHANGELOG in zwei Sprachen: `CHANGELOG.md` (Englisch) und
  `CHANGELOG.de.md` (Deutsch), gleicher Aufbau nach Keep a Changelog
  (Added/Hinzugefügt, Changed/Geändert, Deprecated/Veraltet,
  Removed/Entfernt, Fixed/Behoben, Security/Sicherheit), immer beide im
  selben Commit. `tests/test_translations.py` prüft den gleichen Aufbau von
  README und CHANGELOG.
- Release Notes auf Englisch.
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

## Git und Releases

- Nur auf `main` pushen, keine weiteren Branches. Gilt auch, wenn die
  Session einen anderen Branch vorgibt. Liegt Arbeit auf einem anderen
  Branch, nach `main` bringen und den Branch löschen. Lehnt GitHub den Push
  auf `main` ab, über einen PR mergen und den Branch danach löschen.
- Tags und Releases legt der Nutzer selbst an (Sessions können keine Tags
  pushen). Nach jedem Push mit neuer Version liefert Claude die
  Release-Angaben als Text:
  - Version (wie in `manifest.json`), Tag und Titel `vX.Y.Z`
  - Ziel: `main` mit Commit-Hash
  - Vorabversion ja (Nummer mit a/b/rc) oder nein
  - Release Notes (Englisch) als Markdown-Codeblock, beginnend mit
    `## X.Y.Z (JJJJ-MM-TT)`, Inhalt = Abschnitt aus `CHANGELOG.md`
    (`python3 .github/scripts/changelog_section.py X.Y.Z`).
- Veröffentlichte Tags nie ändern: Ist ein Release falsch, neue Version.

## Bei jeder funktionalen Änderung

1. Version in `manifest.json` erhöhen (SemVer: Patch für Fehler, Minor für
   Funktionen oder Verhaltensänderungen).
2. `PANEL_VERSION` in `const.py` erhöhen, sobald sich Dateien unter
   `panel/` ändern (Cache-Buster).
3. CHANGELOG-Eintrag in `CHANGELOG.md` und `CHANGELOG.de.md` inkl.
   Link-Fussnote.
4. README DE und EN nachführen.
5. Prüfungen (siehe unten) und Tests laufen lassen.
6. `.pyc`/`__pycache__` nie committen.
7. Nach dem Push die Release-Angaben ausgeben (siehe "Git und Releases").
8. Veröffentlichte Tags nie ändern: existiert der Tag schon, neue
   Patch-Version.

## Prüfungen vor jedem Commit

- Python: `python -m pyflakes custom_components/device_panel/*.py`
- JSON gültig, `strings.json` identisch mit `translations/en.json`
- `node --check` für alle Panel-Dateien
- kein "ß" in Code, Texten, README, CHANGELOG
- README und CHANGELOG DE/EN gleich aufgebaut (Test)
- `python -m pytest` (Python 3.13, `pip install pytest-homeassistant-custom-component`)
- `cd tests/panel && npm ci && npx playwright-core install chromium && node run.mjs`
- Realistische Tests auf Desktop und Handy (390 × 844), echte Klicks/Taps.

## Commit-Nachrichten

Kurze Betreffzeile mit Version ("1.2.0: …"), Liste der Änderungen, am Ende
die vom System vorgegebenen Co-Author-/Session-Zeilen.
