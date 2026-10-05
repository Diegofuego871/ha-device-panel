# Mockups Reihenfolge der Chips (2026-10-05)

Wunsch des Nutzers zu 1.13.0: In den Einstellungen soll man sehen, welche
Chips links vor "Alle" stehen und welche rechts danach, und das selbst
festlegen können. Heute steht "Verbindungsarten" als gewöhnliche Zeile in der
Liste; dass alles darüber links und alles darunter rechts von "Alle" steht,
sieht man nicht. Erstellt im echten Panel (Nachbau aus `tests/panel`,
erfundene Daten), Beispiel: Batterie, Bereich und Integration links, dann
"Alle" mit Zigbee, WLAN und Cloud, rechts der Rest.

| Bild | Inhalt |
| --- | --- |
| `1-A-trennband.png` | **A (Empfehlung):** "Alle + Verbindungsarten" als hervorgehobenes Band mit Mini-Chips; darüber die Beschriftung "Links von Alle" (Zahl der Chips), darunter "Rechts von Alle". Chips werden über das Band gezogen, um die Seite zu wechseln. |
| `2-B-vorschau.png` | B: Vorschau der Leiste über der Liste ("So sieht die Leiste aus", drei Zonen), geht beim Ziehen mit; die Liste bleibt wie in 1.13.0. |
| `3-C-beides.png` | C: Vorschau und Trennband zusammen. |

## Verhalten (gilt für alle Varianten)

- Gespeichert wird wie in 1.13.0 die Option `chip_order`; die Seite eines
  Chips ergibt sich aus seiner Stellung zum Block "Verbindungsarten". Kein
  neues Datenfeld.
- Steht oberhalb des Bandes kein Chip, zeigt A einen leeren Streifen "Chips
  hierher ziehen".
- Chips ohne betroffene Geräte erscheinen weiterhin nicht, egal auf welcher
  Seite.

## Empfehlung: A

Das Band steht dort, wo man zieht, und zeigt sofort, auf welcher Seite ein
Chip landet. B zeigt das Ergebnis, schiebt die Liste aber auf dem Handy um
rund 380 px nach unten; C kostet denselben Platz. Wer die Vorschau trotzdem
möchte, bekommt sie als B oder C.

Neu rendern:

```bash
cd tests/panel && npm ci && cd ../..
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/chip-order-v1/src/render.mjs
```
