
# Mockups "Ruhezeit" (2026-10-18)

Wunsch des Nutzers: Push-Meldungen sollen sich in einem Nachtzeitfenster merken und danach als Zusammenfassung (oder einzeln) kommen.
Entscheide des Nutzers: eine globale Ruhezeit (nicht pro Benutzer), Zusammenfassung wählbar (Standard) oder einzeln, kritische
Meldungen kommen sofort. Statisches HTML in der Optik des Panels, erfundene Daten.

| Bild | Inhalt |
| --- | --- |
| `1-ort.png` | Wo steht die Einstellung: A Reiter "Ruhezeit", B eigener Abschnitt, C Zeile über den Reitern |
| `2-einstellung.png` | Die Einstellung selbst: Schalter, Von/Bis, Danach (Zusammenfassung oder einzeln), zurückgehaltene Meldungsarten |
| `3-meldung-danach.png` | Die Meldung nach der Ruhezeit: Zusammenfassung oder alle einzeln |

Neu rendern:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/quiet-v1/src/render.mjs
```
