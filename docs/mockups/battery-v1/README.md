# Mockups Batterie-Schwelle pro Integration (2026-10-01)

Wunsch des Nutzers: die Schwelle "Schwach ab" auch pro Integration
einstellen. Erstellt im echten Panel (Nachbau aus `tests/panel`, erfundene
Daten); die Varianten werden mit den Stilen des Panels in die Einstellungen
eingesetzt.

| Bild | Inhalt |
| --- | --- |
| `A-batterie-abschnitt.png` | A (Empfehlung): Liste der Integrationen mit Batteriegeräten im Abschnitt "Batterie", leer = Standard |
| `B-integrationen-spalte.png` | B: Spalte "Batterie ab" in der Tabelle "Integrationen" |

Neu rendern (Bilder landen hier, Einzelbilder in `src/out/`, nicht im
Repository):

```bash
cd tests/panel && npm ci && cd ../..
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/battery-v1/src/render.mjs
```
