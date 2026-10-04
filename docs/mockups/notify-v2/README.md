# Mockups "Meldungen an einem Ort" (2026-10-04)

Wunsch des Nutzers: Push, Ausfall und Batterie sind auf drei bis fünf
Abschnitte verteilt ("Batterie", "Integrationen", "Push-Benachrichtigung",
"Anhaltende Benachrichtigung"). Alles soll an einem Ort stehen, damit sofort
klar ist, wann welche Meldung kommt; Push pro Integration aus "Integrationen"
heraus, dafür pro Integration auch für die Batterie; Vorschau der
Batterie-Meldung, fest oder anpassbar. Statisches HTML in der Optik des
Panels, Handy-Breite, erfundene Daten.

| Bild | Inhalt |
| --- | --- |
| `1-struktur.png` | Heute (Meldungen an fünf Orten) und die Aufteilung nach A und B |
| `2-variante-a.png` | **A (Empfehlung):** Abschnitt "Meldungen" mit Ziel, je Meldung einer Karte (was, wann in einem Satz, Push/Anhaltend), aufgeklappt mit Zeitstrahl, Zeit, Inhalt und Vorschau; darunter "Pro Integration" mit Ausfall, Batterie, Anhaltend. Schwellen bleiben in "Ausfall-Erkennung" und "Batterie" |
| `3-variante-b.png` | B: Abschnitt "Meldungen" mit Reitern Ausfall, Batterie, Ziel; jeder Reiter vollständig, Integrationen je Reiter |
| `4-batterie-meldung.png` | Batterie-Meldung fest mit Vorschau oder anpassbar wie die Ausfall-Meldung (Empfehlung) |

Darin auch Aufgabe "Erst melden nach nicht kürzer als Ausgefallen nach"
(Fehler am Feld, A2).

Neu rendern:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/notify-v2/src/render.mjs
```
