# Mockups Panel, Version 1 (2026-10-01)

Entwürfe für Geräteliste, Geräteansicht und Einstellungen, mit erfundenen
Daten. **Entscheid des Nutzers: Variante C**, die Kombination aus A und B
(Bilder 6–8), dazu die Einstellungen (Bild 5). A und B bleiben als Herkunft
der Bausteine.

| Bild | Inhalt |
| --- | --- |
| `1a-variante-A-liste.png` | Variante A: Liste mit Ausfall-Band und Spalten-Popover |
| `1b-variante-A-geraet.png` | Variante A: Geräteansicht als Dialog |
| `2a-variante-B-liste.png` | Variante B: Kennzahlen, Ausfall-Puls, Verbindungs-Chips, gruppierte Liste |
| `2b-variante-B-geraet-dunkel.png` | Variante B: Geräteansicht als Seitenleiste mit Tabs (dunkel) |
| `3-handy-A-und-B.png` | Handy (390 × 844): Liste und Geräteansicht beider Varianten |
| `4-dunkel-A-und-B.png` | Dunkles Design beider Varianten |
| `5-einstellungen.png` | Einstellungen (für alle Varianten gleich), Desktop und Handy |
| `6-variante-C-liste.png` | **C (gewählt):** Kopf, Chips und Gruppen aus B, rote Zeilen und Spalten-Popover aus A |
| `7-variante-C-geraeteansicht.png` | **C:** Geräteansicht mit Tabs (Übersicht aus B, Verlauf aus A), Handy |
| `8-variante-C-dunkel.png` | **C:** dunkles Design |
| `9-ueberwachung-regeln.png` | Vorschlag: Überwachung mit Ebenen und Regeln, Regel-Editor, Herkunft der Einstellungen pro Gerät |

Neu rendern (Ergebnis in `src/out/`, nicht im Repository):

```bash
cd docs/mockups/panel-v1/src
npm install
node render.mjs            # alle Ansichten
node render.mjs C-         # nur Variante C
```

`CHROMIUM_PATH` setzt einen eigenen Chromium-Pfad; ohne die Variable nutzt
playwright-core seinen eigenen Browser (`npx playwright-core install chromium`).
