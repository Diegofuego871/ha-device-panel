# Mockups Filter-Chips (2026-10-02)

Wunsch des Nutzers: Die Chips der Verbindungsart (Zigbee, WLAN, Thread …)
einzeln ausblenden können, damit es übersichtlicher wird. Standardmässig
sind alle sichtbar; "Alle", "Nur Probleme" und die Hinweise (Batterie,
Empfang, Updates, eigene Einstellung) bleiben immer. Ergänzt die Mockups
`docs/mockups/view-v1/` (Spalten und Sortierung). Erstellt im echten Panel
(Nachbau aus `tests/panel`, erfundene Daten); im Beispiel sind Thread,
Bluetooth und Unbekannt ausgeblendet.

| Bild | Inhalt |
| --- | --- |
| `1-A-ansicht.png` | **A (Empfehlung):** pro Benutzer, getrennt PC/Handy, im Popover "Ansicht" (Reiter "Spalten" und "Filter-Chips"; der Knopf "Spalten" aus Bild 6 heisst dann "Ansicht"); auf dem Handy ein Abschnitt im Blatt "Ansicht" (view-v1, Variante A) |
| `2-B-knopf-bei-den-chips.png` | B: pro Benutzer, Knopf "Chips" am Ende der Verbindungs-Chips mit eigenem Popover (Handy: Blatt) |
| `3-C-einstellungen-global.png` | C: global für alle Benutzer, in den Einstellungen unter "Anzeige" |

## Verhalten

- Ein ausgeblendeter Chip, dessen Filter gerade aktiv ist, setzt den Filter
  auf "Alle" zurück.
- Kommt eine neue Verbindungsart dazu, ist ihr Chip sichtbar.

## Empfehlung: A

Ein Ort für alles, was die eigene Ansicht betrifft (Spalten, Sortierung,
Chips), gespeichert wie Spalten und Sortierung pro Benutzer und getrennt
für PC und Handy. B fügt der Chip-Leiste ein weiteres Element hinzu; C gilt
für alle Benutzer, obwohl es um die eigene Übersicht geht.

Neu rendern:

```bash
cd tests/panel && npm ci && cd ../..
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/view-v2/src/render.mjs
```
