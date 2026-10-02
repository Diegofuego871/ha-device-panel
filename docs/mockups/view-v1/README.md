# Mockups Ansicht (2026-10-02)

Wunsch des Nutzers: Spalten sortieren, gespeichert pro Benutzer, getrennt
für Handy und PC (Fahrplan-Schritt 2, `docs/CONCEPT.md`). Der Desktop folgt
dem Entscheid Variante C (Bild 6 in `docs/mockups/panel-v1/`): Knopf
"Spalten" mit Popover, Sortierpfeil im Spaltenkopf, Umschalter "Gruppen |
Liste". Offen war das Handy (Karten statt Tabelle). Erstellt im echten
Panel (Nachbau aus `tests/panel`, erfundene Daten).

| Bild | Inhalt |
| --- | --- |
| `1-desktop-gruppen-spalten.png` | Desktop: Spalten-Popover (ein-/ausblenden, ziehen), sortiert nach Verfügbarkeit innerhalb der Gruppen |
| `2-desktop-liste.png` | Desktop: Ansicht "Liste" ohne Gruppen, sortiert nach Batterie |
| `3-handy-A-ein-blatt.png` | **Handy A (Empfehlung):** Zeile "Sortiert nach" unter den Chips; ein Blatt "Ansicht" mit Sortierung, Darstellung und Angaben auf der Karte |
| `4-handy-B-sortier-chip.png` | Handy B: Sortier-Chip vorne in den Chips mit eigenem Blatt; der Spalten-Knopf wählt die Angaben auf der Karte |

## Verhalten (für beide Handy-Varianten gleich)

- Sortieren per Klick auf den Spaltenkopf: aufsteigend, absteigend, dann
  wieder Standard (Ausfälle zuerst, längste Dauer zuoberst).
- "Gruppen": Ausgefallene, Instabile usw. bleiben getrennt und oben,
  sortiert wird innerhalb der Gruppen. "Liste": eine Liste ohne Gruppen.
- Gespeichert pro Benutzer in Home Assistant (wie unifi_dynamic, auf allen
  Geräten gleich), getrennt für PC und Handy (schmal = bis 600 px):
  Sortierung, Richtung, Gruppen/Liste, Spalten bzw. Angaben auf der Karte
  mit Reihenfolge, Filter-Chips (Verbindung, "Nur Probleme", Hinweise).
  Nicht gespeichert: Suchtext.
- Neue, standardmässig ausgeblendete Spalten: Bereich, Unterbrüche 24 Std.,
  Hub / Bridge. "Gerät" bleibt fest vorne.

## Empfehlung: Handy A

Ein Ort für alles, was die Ansicht betrifft, wie das Popover am Desktop;
die Zeile unter den Chips zeigt jederzeit, wonach sortiert ist, und öffnet
dasselbe Blatt. B braucht zwei Blätter und einen weiteren Chip in der
ohnehin seitlich scrollenden Chip-Leiste.

Neu rendern:

```bash
cd tests/panel && npm ci && cd ../..
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/view-v1/src/render.mjs
```
