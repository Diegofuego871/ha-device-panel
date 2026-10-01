# Mockups Panel, Version 1 (2026-10-01)

Entwürfe für Geräteliste, Geräteansicht und Einstellungen, mit erfundenen
Daten. Entscheid des Nutzers steht aus (siehe `docs/HANDOVER.md`).

| Bild | Inhalt |
| --- | --- |
| `1a-variante-A-liste.png` | Variante A: Liste mit Ausfall-Band und Spalten-Popover |
| `1b-variante-A-geraet.png` | Variante A: Geräteansicht als Dialog |
| `2a-variante-B-liste.png` | Variante B: Kennzahlen, Ausfall-Puls, Verbindungs-Chips, gruppierte Liste |
| `2b-variante-B-geraet-dunkel.png` | Variante B: Geräteansicht als Seitenleiste mit Tabs (dunkel) |
| `3-handy-A-und-B.png` | Handy (390 × 844): Liste und Geräteansicht beider Varianten |
| `4-dunkel-A-und-B.png` | Dunkles Design beider Varianten |
| `5-einstellungen.png` | Einstellungen (für beide Varianten gleich), Desktop und Handy |

Neu rendern (Ergebnis in `src/out/`, nicht im Repository):

```bash
cd docs/mockups/panel-v1/src
npm install
node render.mjs            # alle Ansichten
node render.mjs B-         # nur Variante B
```

`CHROMIUM_PATH` setzt einen eigenen Chromium-Pfad; ohne die Variable nutzt
playwright-core seinen eigenen Browser (`npx playwright-core install chromium`).
