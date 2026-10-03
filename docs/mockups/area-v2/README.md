# Mockups Bereiche v2: sortieren und gewählte zeigen (2026-10-03)

Wunsch des Nutzers: "Bereichsfunktion, mit der man Bereiche sortieren kann
oder gewisse Bereiche separat einblenden kann." Baut auf `area-v1` A auf
(Chip "Bereich" mit Auswahl nach Etage) und ergänzt die Liste nach Bereich
gruppiert. Erstellt im echten Panel (Nachbau aus `tests/panel`, erfundene
Daten und Etagen); gewählt sind Erdgeschoss und Keller.

| Bild | Inhalt |
| --- | --- |
| `1-A-gruppen-und-chip.png` | **A (Empfehlung):** "Gruppen \| Bereiche \| Liste": "Bereiche" gruppiert die Liste nach Bereich (Kopf mit Zahl und "1 ausgefallen"), Ausfälle in jeder Gruppe zuerst. Chip "Bereich": Haken wählt die Bereiche, Griff ordnet die Gruppen; zuerst in der Reihenfolge aus Home Assistant, eigene Reihenfolge pro Benutzer |
| `2-B-in-ansicht.png` | B: Auswahl und Reihenfolge im Popover "Spalten" bzw. im Blatt "Ansicht" |
| `3-C-reihenfolge-aus-ha.png` | C: Reihenfolge nur aus Home Assistant (Einstellungen → Bereiche, Etagen und Zonen; HA 2025+ sortiert dort per Ziehen), im Panel nur die Auswahl |

## Verhalten (alle Varianten)

- Pro Benutzer, Desktop und Handy getrennt, wie die übrigen Filter (0.19.0).
- Geräte ohne Bereich als Gruppe "Ohne Bereich" am Ende.
- Kopf (Ring, Ausfälle, Puls) zeigt immer das ganze Haus; die Liste ist
  gefiltert (offen aus `area-v1`).

## Empfehlung: A

Auswahl und Reihenfolge an einem Ort, direkt am Filter; die Gruppierung
nach Bereich ist ein dritter Weg neben "Gruppen" und "Liste". B versteckt
einen oft genutzten Filter. C ist am einfachsten (keine zweite
Reihenfolge), verlangt aber den Weg in die HA-Einstellungen.

Offene Fragen:

1. "Separat einblenden" verstanden als: nur die gewählten Bereiche zeigen.
   Gemeint ist eventuell etwas anderes (z. B. gewählte Bereiche als eigene
   Blöcke über der übrigen Liste)?
2. Reihenfolge: eigene im Panel (A, B) oder die aus Home Assistant (C)?

Neu rendern:

```bash
cd tests/panel && npm ci && cd ../..
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/area-v2/src/render.mjs
```
