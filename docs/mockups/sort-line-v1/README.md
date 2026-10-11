# Mockups sort-line-v1: Sortier-Pille und Knopf oben auf dem Handy

Befund (aus dem Code geprüft): Auf dem Handy öffnen der Knopf oben (Symbol "Spalten", `.view-btn`) und die Pille unter
den Chips (`.sort-btn`) dasselbe Blatt "Ansicht" (Sortieren, Richtung, Gruppen/Liste, Angaben). Auf dem Desktop öffnet
der Knopf oben den Dialog "Anpassen" (Spalten), die Pille gibt es dort nicht.

Wunsch des Nutzers (2026-10-11): nur noch eine Stelle oder ein deutlich anderer Look als ein Chip; man soll weiterhin
direkt sehen, was gewählt ist.

Im echten Panel (Nachbau, erfundene Daten), die Varianten bauen die Zeile im Nachbau um und hängen Stile an.

- `1-Standard.png`: Sortierung "Standard (Ausfälle zuerst)"
- `2-Nach-Name.png`: Sortierung "Name", aufsteigend

Varianten: Ist, A (Textzeile, Knopf oben bleibt), C (eine Zeile statt Knopf und Pille, Suchfeld breiter).

Neu erzeugen: `CHROMIUM_PATH=... node docs/mockups/sort-line-v1/src/render.mjs`
