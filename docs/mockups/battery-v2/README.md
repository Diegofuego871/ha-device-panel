# Mockups Batterie-Warnung pro Integration aus (2026-10-02)

Wunsch des Nutzers: In der Liste "Eigene Schwelle pro Integration"
(Einstellungen, Abschnitt "Batterie") die Batterie-Warnung für eine ganze
Integration ausschalten können. Erstellt im echten Panel (Nachbau aus
`tests/panel`, erfundene Daten); im Beispiel hat Zigbee Home Automation eine
eigene Schwelle von 25 %, BTHome ist aus.

| Bild | Inhalt |
| --- | --- |
| `1-A-schalter.png` | **A (Empfehlung):** Schalter "Warnung" je Zeile, wie "Anzeigen" bei Integrationen und Gerätetypen; aus = Feld gesperrt ("aus") |
| `2-B-auswahl.png` | B: Auswahl je Zeile wie im Geräte-Popup (Globaler Wert / Eigene Schwelle / Aus), Feld nur bei eigener Schwelle |
| `3-C-knopf-aus.png` | C: Knopf "Aus" neben dem Feld |

## Verhalten (alle Varianten)

- Aus heisst: keine Markierung "schwach", kein Push, kein Eintrag in der
  anhaltenden Benachrichtigung für Geräte dieser Integration (primäre
  Integration des Geräts). Der Batteriestand bleibt sichtbar.
- Eine eigene Schwelle am Gerät (Geräte-Popup) geht vor: Reihenfolge Gerät,
  Integration, globaler Wert.
- Gilt mit "Speichern", wie alle Einstellungen. Im Optionsdialog der
  Integration als `zha: off`.

## Empfehlung: A

Ein Tipp, kompakt auch auf dem Handy, und dieselbe Bedienung wie die
Schalter "Anzeigen" bei Integrationen und Gerätetypen; das Zahlenfeld bleibt
direkt beschreibbar. B ist gleich bedient wie das Geräte-Popup, braucht aber
für eine eigene Schwelle zwei Schritte und auf dem Handy doppelt so hohe
Zeilen. C bringt ein neues Bedienelement (Knopf als Umschalter), das es im
Panel sonst nicht gibt.

Neu rendern:

```bash
cd tests/panel && npm ci && cd ../..
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/battery-v2/src/render.mjs
```
