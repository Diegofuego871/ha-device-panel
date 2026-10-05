# Mockups Reihenfolge der Chips, Runde 3 (2026-10-05)

Wunsch des Nutzers zu `docs/mockups/chip-order-v2/`: Die Beschriftung "Links
von / Rechts von Alle" ist überflüssig (Alle ist selbst ein Element), und es
soll nur noch eine Ansicht geben, in der sich alle Chips frei ordnen lassen,
auch "Alle". Erstellt im echten Panel (Nachbau aus `tests/panel`, erfundene
Daten); die Liste ist aus den echten Zeilen der beiden bisherigen Listen
zusammengesetzt.

| Bild | Inhalt |
| --- | --- |
| `1-D1-eine-liste.png` | D1: eine Liste für alle Chips. "Alle" ist eine feste Zeile (Schloss statt Schalter, nur verschiebbar), jede Verbindungsart eine eigene Zeile mit Schalter, dazu Batterie, Bereich, Nur Probleme usw. Von oben nach unten ist von links nach rechts. |
| `2-D2-eine-liste-mit-vorschau.png` | D2: dieselbe Liste, dazu "So sieht die Leiste aus" mit den echten Chips in der eingestellten Folge. |

## Verhalten

- Ein Abschnitt "Filter-Chips" statt zwei: Die Liste "Verbindungsart" und der
  Knopf "Nach Anzahl sortieren" entfallen; ein Knopf "Standardreihenfolge"
  setzt alles zurück (Standard: Bereich, Integration, Alle, Verbindungsarten
  nach Anzahl, dann Nur Probleme und die Hinweise).
- Die Schalter der Verbindungsarten blenden wie bisher ihren Chip aus
  (`hide_connections`), die der übrigen Chips wie in 1.11.0 (`hide_chips`).
  "Alle" lässt sich nicht ausblenden.
- Im Beispiel haben Matter und LAN keine Geräte und fehlen deshalb; in der
  echten Liste stehen alle Verbindungsarten, auch ohne Geräte (zum Ausblenden
  und Einordnen im Voraus).
- Chips ohne betroffene Geräte erscheinen weiterhin nicht, egal wo sie stehen.
- Bestehende Einstellungen bleiben erhalten (`chip_order` aus 1.13.0 und
  `connection_order` werden zu einer Folge zusammengeführt).

Neu rendern:

```bash
cd tests/panel && npm ci && cd ../..
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/chip-order-v3/src/render.mjs
```
