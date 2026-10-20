# Mockups "Protokoll je Magic-Push-Meldung und Routine" (2026-10-20)

Wunsch des Nutzers: pro Magic-Push-Meldung und pro Routine ein Protokoll mit allen Ausführungen (Datum, bei Magic Push der Inhalt der
Meldung), mit Diagramm und Datumsfilter, mindestens 6, besser 12 Monate zurück; dasselbe im Geräte-Popup; bei Routinen zusätzlich ein
kopierbarer Trace je Eintrag. Statisches HTML in der Optik des Panels, erfundene Daten.

| Bild | Inhalt |
| --- | --- |
| `1-magic-protokoll.png` | Wo "Protokoll" steht (neben Bearbeiten/Löschen) und das Protokoll einer Meldung, Variante A (Diagramm + Tabelle + Zeitraum) |
| `2-varianten.png` | B (Zeitachse statt Tabelle, Handy) und C (Jahreskalender statt Balken) |
| `3-routine-trace.png` | Protokoll einer Routine und das Trace-Fenster mit "Trace kopieren" |
| `4-geraet.png` | Geräte-Popup: "Protokoll" je Karte und "Protokoll des Geräts" |

Offen (Entscheid des Nutzers): Variante, Aufbewahrung (Vorschlag 12 Monate, höchstens 2000 Einträge je Meldung/Routine), Umfang des Trace.

Neu rendern:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/protocol-v1/src/render.mjs
```
