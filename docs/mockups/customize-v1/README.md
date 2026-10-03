# Mockups Spalten wie HA "Anpassen" (2026-10-03)

Wunsch des Nutzers (mit Screenshot des HA-Dialogs "Anpassen"): Spalten so
anpassen, wie Home Assistant es selbst macht: Auge zum Ein- und
Ausblenden, Griff zum Sortieren, "Standard wiederherstellen" und
"Fertig". Erstellt im echten Panel (Nachbau aus `tests/panel`, erfundene
Daten).

| Bild | Inhalt |
| --- | --- |
| `1-A-dialog-anpassen.png` | **A (Empfehlung):** eigener Dialog "Anpassen" wie in HA: Griff links, Name, Auge rechts; ausgeblendete Spalten grau ohne Griff; "Gerät" immer sichtbar; unten "Standard wiederherstellen" und "Fertig". Handy: das Blatt "Ansicht" zeigt die Angaben auf der Karte gleich |
| `2-B-popover.png` | B: das heutige Popover unter "Spalten" mit Augen statt Schaltern und denselben Knöpfen |

## Verhalten (beide Varianten)

- Gilt sofort (wie heute), gespeichert pro Benutzer, Desktop und Handy
  getrennt (0.19.0). "Fertig" schliesst nur; "Standard wiederherstellen"
  setzt Spalten und Reihenfolge zurück.
- Ziehen mit Maus und Finger, Pfeiltasten am Griff.

## Empfehlung: A

So kennt man es aus Home Assistant; ein Dialog hat Platz für alle Spalten
ohne Scrollen und schliesst bewusst mit "Fertig". B bleibt näher an der
Liste, ist aber kleiner und schliesst bei einem Klick daneben.

Neu rendern:

```bash
cd tests/panel && npm ci && cd ../..
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/customize-v1/src/render.mjs
```
