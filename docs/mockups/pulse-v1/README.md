# Mockups Puls: welche Geräte? (2026-10-03)

Wunsch des Nutzers: Die Puls-Kachel nennt "4 Unterbrüche bei 4 Geräten",
aber nicht welche; ein Popup soll sie zeigen. Erstellt im echten Panel
(Nachbau aus `tests/panel`, erfundene Daten).

| Bild | Inhalt |
| --- | --- |
| `1-A-fenster.png` | **A (Empfehlung):** Zeile in der Kachel als Link; Tipp öffnet das Fenster "Unterbrüche in 24 Std.": Puls gross, darunter die Geräte (meiste Unterbrüche zuerst) mit Zahl, Dauer zusammen, Streifen 24 Std. und Prozent; Tipp auf ein Gerät öffnet sein Popup. Handy als Blatt |
| `2-B-aufklappen.png` | B: Kachel klappt auf, höchstens 4 Geräte, dann "weitere" |
| `3-C-filter.png` | C: Tipp setzt den Filter-Chip "Unterbrüche 24 Std.", die Liste zeigt nur diese Geräte (Kopf bleibt für alle) |

## Verhalten (alle Varianten)

- Zahlen wie in der Kachel und in der Liste: Unterbrüche über Neustarts als
  einer (seit 0.20.0).
- Nur überwachte Geräte (Ausschlüsse, Anzeige); Geräte ohne Unterbruch
  fehlen.

## Empfehlung: A

Ein eigenes Fenster hat Platz für den Puls in gross und für alle Geräte,
auch bei vielen. Zusatz in A: Tipp auf einen Zeitpunkt im Puls zeigt nur
die Geräte, die dann weg waren. B macht die Kachel unterschiedlich hoch und
die Kopfzeile unruhig. C ist schnell, vermischt aber eine Übersicht mit den
Filtern der Liste.

Neu rendern:

```bash
cd tests/panel && npm ci && cd ../..
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/pulse-v1/src/render.mjs
```
