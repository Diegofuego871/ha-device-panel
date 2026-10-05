# Mockups Chips anheften (2026-10-05)

Wunsch des Nutzers (Handy, `chip_order` aus 1.14.0): In der Chip-Liste soll es
einen Anheft-Marker geben; alles darüber bleibt beim seitlichen Scrollen der
Leiste links stehen (im Beispiel "Alle", im Screenshot des Nutzers scrollt
"Alle" sonst aus dem Bild). Die Leiste scrollt nur auf schmalen Bildschirmen
(Handy, bis 600 px Breite); auf dem Desktop bricht sie um, dort ändert sich
nichts. Erstellt im echten Panel (Nachbau aus `tests/panel`, erfundene Daten),
die Zusätze eingesetzt. Beide Varianten haben denselben Aufbau: Der Marker ist
ein verschiebbarer Eintrag der Folge, ganz oben bedeutet "nichts angeheftet".

| Bild | Inhalt |
| --- | --- |
| `1-A-anheft-zeile.png` | **A (Empfehlung):** Marker als eigene Zeile "Anheften" mit Pin, Griff und Zähler "1 angeheftet"; die Zeilen darüber sind getönt. Die Vorschau zeigt die Leiste des Handys (eine Zeile, seitlich gescrollt) mit "angeheftet" und "scrollt seitlich". |
| `2-B-schlanke-linie.png` | B: Marker als schlanke gestrichelte Linie mit Pin-Etikett "angeheftet bis hier" und Griff; Zeilen unverändert. Die Vorschau zeigt nur die Haftkante. |

## Verhalten (gilt für beide)

- Angeheftet sind die sichtbaren Chips oberhalb des Markers; ausgeblendete und
  nicht zutreffende zählen nicht.
- Gilt für alle Benutzer wie die übrigen Chip-Einstellungen.
- Wenige Chips anheften (eins bis zwei): Sonst bleibt auf dem Handy wenig Platz
  zum Scrollen.

## Entscheid des Nutzers: B (2026-10-05)

Umgesetzt in 1.15.0; die Vorschau zeigt dort zusätzlich zur Reihe mit Pin-Zeichen die
Handy-Leiste, sobald etwas angeheftet ist. Die Grenze von 60 % der Breite ist eingebaut.

## Empfehlung: A

Die getönten Zeilen zeigen auf einen Blick, was angeheftet ist, und die Zeile ist
auf dem Handy gross genug zum Ziehen. B braucht weniger Platz, die Linie ist aber
dünner und fällt in der langen Liste weniger auf.

Neu rendern:

```bash
cd tests/panel && npm ci && cd ../..
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/chip-pin-v1/src/render.mjs
```
