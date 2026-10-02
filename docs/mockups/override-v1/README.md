# Mockups Einstellungen pro Gerät (2026-10-02)

Wunsch des Nutzers: Einstellungen pro Gerät (Batterie-Warnung, Ausfall- und
Online-Meldungen) in der Liste erkennbar machen, alle anzeigen können
(Filter) und in den globalen Einstellungen zurücksetzen, getrennt für
Batterie und Meldungen. Erstellt im echten Panel (Nachbau aus
`tests/panel`, erfundene Daten).

| Bild | Inhalt |
| --- | --- |
| `1-liste-A-symbole.png` | **Liste A (Empfehlung):** Symbole je Art hinter dem Namen: Batterie mit eigener Schwelle ("30 %"), Batterie-Warnung aus, Meldungen aus; Chip "Eigene Einstellung" |
| `2-liste-filter.png` | Chip "Eigene Einstellung" aktiv: nur Geräte mit Einstellung pro Gerät (A und B gleich) |
| `3-liste-B-ein-symbol.png` | Liste B: ein Symbol "angepasst", Einzelheiten im Tooltip |
| `4-handy-A.png` | Liste A auf dem Handy (Karten), Chip am Ende der Leiste |
| `5-einstellungen-A-liste.png` | **Einstellungen A (Empfehlung):** in "Batterie" und "Push-Benachrichtigung" je eine Liste der Geräte mit eigenem Wert, einzeln (×) oder "Alle zurücksetzen" |
| `6-einstellungen-B-kompakt.png` | Einstellungen B: nur Anzahl und "Alle zurücksetzen" |

## Verhalten

- Zurücksetzen gilt wie alle Einstellungen erst mit "Speichern"
  ("Abbrechen" verwirft); Zähler und Etikett "geändert" wie bisher.
- Batterie und Meldungen getrennt; der Typ von Hand zählt nicht dazu.
- Die Liste in den Einstellungen zeigt auch Geräte, die gerade ausgeblendet
  sind (ausgeschlossene Integration oder Typ): ihr Wert bleibt gespeichert.
- Symbole in Primärfarbe wie "geändert" in den Einstellungen; Tooltip mit
  dem Wert und dem globalen Wert.

## Empfehlung: Liste A, Einstellungen A

A zeigt ohne Klick, was abweicht (Batterie oder Meldungen, welcher Wert).
Die Liste in den Einstellungen zeigt vor dem Zurücksetzen, was betroffen
ist, und erlaubt es einzeln, im selben Aufbau wie "Eigene Schwelle pro
Integration".

Neu rendern:

```bash
cd tests/panel && npm ci && cd ../..
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/override-v1/src/render.mjs
```
