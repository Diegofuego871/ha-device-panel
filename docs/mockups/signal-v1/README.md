# Mockups Empfang pro Gerät akzeptieren (2026-10-02)

Wunsch des Nutzers: Geräte, die immer schwachen Empfang haben, per eigener
Einstellung akzeptieren oder den Wert von Hand überschreiben, nach demselben
Konzept wie die übrigen Einstellungen pro Gerät (Symbol beim Namen, Chip
"Eigene Einstellung", Zurücksetzen in den Einstellungen). Erstellt im echten
Panel (Nachbau aus `tests/panel`, erfundene Daten); im Beispiel hat der
Präsenzsensor Büro -88 dBm (Standard: schwach unter -80 dBm, LQI unter 60).

| Bild | Inhalt |
| --- | --- |
| `1-A-auswahl.png` | **A (Empfehlung):** Zeile "Empfang-Warnung" wie die Batterie-Warnung: Standard, eigene Schwelle (vorgeschlagen 5 dBm bzw. 10 LQI unter dem heutigen Wert) oder aus |
| `2-B-schalter.png` | B: Schalter "Schwachen Empfang akzeptieren"; Schwelle automatisch unter dem heutigen Wert, nicht änderbar |
| `3-C-kachel.png` | C: Knopf "Akzeptieren" direkt in der Kachel "Empfang"; wirkt wie B |

## Verhalten (alle Varianten)

- Gilt sofort, wie die übrigen Einstellungen im Geräte-Popup; gespeichert in
  `.storage/device_panel.devices`.
- Wirkt auf Markierung (Balken, Stufe "schwach"), Chip "Schwacher Empfang"
  und "Nur Probleme". Push-Meldungen für schwachen Empfang gibt es nicht.
- Zählt als "Eigene Einstellung": Symbol beim Namen (Tooltip mit Schwelle),
  Chip, Liste zum Zurücksetzen in den Einstellungen im Abschnitt
  "Verbindungsart".
- Mit A und B heisst der Abschnitt im Popup besser "Einstellungen für
  dieses Gerät" statt "Meldungen für dieses Gerät".

## Empfehlung: A

Dieselbe Bedienung wie die Batterie-Warnung (Auswahl, Zahlenfeld nur bei
eigener Schwelle), deckt beides ab: "Aus" akzeptiert dauerhaft, die eigene
Schwelle überschreibt den Wert von Hand und warnt wieder, wenn es schlechter
wird. B und C sind mit einem Tipp schneller, lassen die Schwelle aber nicht
ändern; C versteckt die Einstellung in einer Kachel, die sonst nur anzeigt.

Neu rendern:

```bash
cd tests/panel && npm ci && cd ../..
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/signal-v1/src/render.mjs
```
