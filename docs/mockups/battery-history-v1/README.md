# Mockups Batterie-Verlauf (2026-10-02)

Wunsch des Nutzers: Ein Tipp auf die Kachel "Batterie" im Geräte-Popup
öffnet ein Fenster wie die Verfügbarkeit, mit Zeitraum 24 Std., 7 Tage,
30 Tage und zusätzlich 3 Monate, und zeigt den Batteriestand als Grafik,
"wie ein Aktienkurs, der leicht nach unten geht". Erstellt im echten Panel
(Nachbau aus `tests/panel`, erfundene Daten): Fensterkontakt Küche, Batterie
vor 74 Tagen gewechselt, heute 64 %.

| Bild | Inhalt |
| --- | --- |
| `1-A-linie.png` | **A (Empfehlung):** Linie mit Fläche, Schwelle gestrichelt, Batteriewechsel markiert und unten aufgeführt; Kennzahlen oben (Stand, Veränderung seit dem Wechsel, Verbrauch pro Tag) |
| `2-B-prognose.png` | B: wie A, dazu eine Prognose rechts von "jetzt" und das geschätzte Datum, ab dem die Batterie schwach ist |
| `3-C-saeulen.png` | C: Säulen pro Tag (tiefster bis höchster Wert) statt Linie |
| `4-A-kurz.png` | A mit 24 Std. (Desktop) und 7 Tagen (Handy) |

## Daten

- Quelle ist der Recorder, kein eigenes Protokoll: Für 3 Monate die
  Langzeitstatistik (Stundenwerte Mittel/Min/Max, bleibt über die 10 Tage
  des Recorders hinaus), für 24 Std. und 7 Tage der Verlauf. Neue
  WebSocket-Abfrage `device_panel/battery_history`.
- Voraussetzung für 30 Tage und 3 Monate: Der Batterie-Sensor führt eine
  Statistik (`state_class: measurement`, bei den meisten Integrationen so).
  Ohne Statistik reicht der Verlauf so weit wie der Recorder (Standard
  10 Tage); das Fenster sagt das.
- Nur Batterien mit Prozent. Geräte mit "schwach ja/nein" (Binärsensor)
  zeigen weiter nur die Kachel, ohne Fenster.
- Batteriewechsel: Sprung um mindestens 30 Prozentpunkte nach oben.

## Offene Frage zur Achse

Die Bilder zeigen die Achse immer von 0 bis 100 %: Die Schwelle bleibt
sichtbar, Zeiträume sind vergleichbar. Über 24 Std. ist die Linie damit fast
flach. Ein Aktienkurs skaliert die Achse automatisch (z. B. 60–70 %) und
zeigt kleine Bewegungen deutlich, übertreibt sie aber. Empfehlung: 0–100 %
für alle Zeiträume, die Kennzahlen oben nennen tiefsten und höchsten Wert.

## Empfehlung: A

Liest sich wie gewünscht als Kurs, zeigt den Wechsel und die Schwelle, und
bleibt ehrlich. B ist verlockend, aber die Prognose ist bei wenig Daten oder
temperaturabhängigen Batterien oft daneben; sie liesse sich später als
Kennzahl ergänzen ("schwach etwa ab …"), sobald mindestens 30 Tage Daten
vorliegen. C zeigt Schwankungen, ist aber unruhiger und auf dem Handy bei
3 Monaten sehr fein.

Neu rendern:

```bash
cd tests/panel && npm ci && cd ../..
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/battery-history-v1/src/render.mjs
```
