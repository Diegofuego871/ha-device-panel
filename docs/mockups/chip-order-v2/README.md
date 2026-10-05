# Mockups Reihenfolge der Chips, Runde 2 (2026-10-05)

Entscheid des Nutzers zu `docs/mockups/chip-order-v1/`: Variante C (Vorschau
der Leiste und Trennband), aber "Alle" als festes Element, das man
verschieben, aber nicht ein- und ausschalten kann. Steht "Alle" ganz oben,
ist es der erste Chip, und alles andere steht rechts davon. Erstellt im
echten Panel (Nachbau aus `tests/panel`, erfundene Daten).

| Bild | Inhalt |
| --- | --- |
| `1-C-alle-in-der-mitte.png` | "Alle" in der Mitte: links Batterie, Bereich, Integration, rechts der Rest. Desktop und Handy. |
| `2-C-alle-ganz-vorn.png` | "Alle" ganz oben: nichts links, alles andere rechts von "Alle". Desktop und Handy. |

## Was sich gegenüber Runde 1 ändert

- Die Zeile heisst "Alle" (vorher "Verbindungsarten"). Statt des
  abgeblendeten Schalters steht ein Schloss mit "fest".
- Die Chips der Verbindungsart (Zigbee, WLAN …) bleiben direkt hinter "Alle"
  und wandern mit. Ihre eigene Reihenfolge und das Ausblenden bleiben unten im
  Abschnitt "Verbindungsart".
- Links von "Alle" kann nichts stehen: Die Vorschau zeigt dann "leer", die
  Liste "Nichts links: Alle steht ganz vorn".
- Die Beschriftungen "Links von Alle" und "Rechts von Alle" nennen die Zahl
  der Chips und wandern beim Ziehen mit dem Band.

Neu rendern:

```bash
cd tests/panel && npm ci && cd ../..
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/chip-order-v2/src/render.mjs
```
