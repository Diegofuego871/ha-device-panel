# Mockups "Einstellungen sichern und wiederherstellen" (2026-10-18)

Wunsch des Nutzers: Export und Import aller Einstellungen, im Reiter Panel › Allgemein als eigenes Kapitel unter "Startseite".
Entscheide des Nutzers: ohne Zugangsdaten und Tokens, Vorschau mit Bestätigung, Routinen und Magic Push als eigene Auswahl
(standardmässig aus), ein fehlendes Push-Ziel wird übernommen und mit Warnung gemeldet. Statisches HTML in der Optik des Panels,
erfundene Daten.

| Bild | Inhalt |
| --- | --- |
| `1-ort.png` | Das Kapitel unter "Startseite": A zwei Knöpfe, B zwei Zeilen, C zwei Karten |
| `2-sichern.png` | Das Fenster "Sichern": welche Bereiche in die Datei kommen |
| `3-wiederherstellen.png` | Die Vorschau: A nach Bereich, B als flache Liste; dazu die Meldung nach dem Übernehmen |

Neu rendern:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/backup-v1/src/render.mjs
```
