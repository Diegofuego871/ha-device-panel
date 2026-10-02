# Mockups Filter nach Bereich (2026-10-02)

Wunsch des Nutzers (To-do seit 2026-10-02): Jeder soll nach seinen Bereichen
filtern können; Form offen. Erstellt im echten Panel (Nachbau aus
`tests/panel`, erfundene Daten und Etagen); im Beispiel ist das
Erdgeschoss gewählt (Küche, Wohnzimmer, Flur, Eingang).

| Bild | Inhalt |
| --- | --- |
| `1-A-chip-auswahl.png` | **A (Empfehlung):** Chip "Bereich" in der Chip-Zeile; Auswahl mit Suche, nach Etage gruppiert (eine Etage wählt alle ihre Bereiche), mehrere Bereiche; aktiv zeigt der Chip die Auswahl ("Erdgeschoss" bzw. "Küche, Bad" oder "3 Bereiche") mit × zum Aufheben. Desktop als Popover, Handy als Blatt |
| `2-B-chip-zeile.png` | B: eigene Chip-Zeile mit einem Chip pro Bereich (mehrere wählbar) |
| `3-C-in-ansicht.png` | C: Auswahl im Popover "Spalten" (Desktop) bzw. im Blatt "Ansicht" (Handy) |

## Verhalten (alle Varianten)

- Gehört zur Ansicht pro Benutzer (0.19.0): gespeichert in Home Assistant,
  getrennt für Desktop und Handy, wie die übrigen Filter-Chips.
- Etagen aus Home Assistant (Etagen-Registry); Bereiche ohne Etage unter
  "Ohne Etage", Geräte ohne Bereich als "Ohne Bereich".
- Die Zahl je Bereich zählt mit Suche und übrigen Filtern (wie die Chips).
- Kopf (Ring, Ausfälle, Puls) bleibt für alle Geräte; nur die Liste ist
  gefiltert. Alternative: Kopf ebenfalls nur für die gewählten Bereiche.

## Empfehlung: A

Ein Chip, der wenig Platz braucht und auch mit vielen Bereichen bedienbar
bleibt (Suche, Etagen). B ist mit einem Tipp am schnellsten, wird aber mit
mehr als etwa zehn Bereichen zu lang, vor allem auf dem Handy. C versteckt
einen Filter, den man oft wechselt, in einer Einstellung.

Offene Frage: Soll der Kopf (Ring, "Gerade ausgefallen", Puls) dem Filter
folgen? Empfehlung: nein, er zeigt immer das ganze Haus; die Liste ist
gefiltert.

Neu rendern:

```bash
cd tests/panel && npm ci && cd ../..
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/area-v1/src/render.mjs
```
