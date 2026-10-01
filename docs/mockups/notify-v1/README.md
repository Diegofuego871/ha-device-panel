# Mockups Meldungen (2026-10-01)

Wünsche des Nutzers: Batterie-Warnung pro Gerät (aus oder eigene Schwelle),
Zeitpunkt der Batterie-Push-Meldung (sofort oder einmal täglich mit
Uhrzeit), Push bei Ausfall (sofort) und bei "wieder online", einstellbar.
Erstellt im echten Panel (Nachbau aus `tests/panel`, erfundene Daten).

| Bild | Inhalt |
| --- | --- |
| `A-geraet-im-popup.png` | A (Empfehlung): Abschnitt "Meldungen für dieses Gerät" im Geräte-Popup |
| `B-eigenes-fenster.png` | B: Knopf im Popup öffnet ein eigenes Fenster "Meldungen" |
| `C-einstellungen.png` | C: neue Zeilen in den Einstellungen (Batterie-Zeitpunkt; Ausfall, wieder online, Sammelausfall nach Bild 5) |

Neu rendern:

```bash
cd tests/panel && npm ci && cd ../..
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/notify-v1/src/render.mjs
```
