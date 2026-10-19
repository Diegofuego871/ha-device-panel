# Mockups "Wiederherstellen: Kacheln anklickbar, Detailfenster" (2026-10-19)

Wunsch des Nutzers: die Kacheln oben in der Vorschau (werden geändert, unverändert, nicht übernommen) sollen anklickbar sein und in
einem weiteren Fenster zeigen, was dahintersteckt (vor allem: welches Gerät warum nicht gefunden wird). Statisches HTML in der Optik
des Panels, erfundene Daten.

| Bild | Inhalt |
| --- | --- |
| `1-detailfenster.png` | Heute, Variante A (Kachel öffnet ein eigenes Fenster) und das Fenster "Nicht übernommen" |
| `2-alternativen.png` | B (Kachel filtert im selben Fenster), C (ein Fenster "Details" mit Reiterleiste, zwei Reiter gezeigt) |

Neu rendern:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/backup-v2/src/render.mjs
```
