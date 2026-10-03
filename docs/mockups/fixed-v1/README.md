# Mockups: Kopf auf dem Handy fixieren (2026-10-03)

Wunsch des Nutzers: Der obere Teil (Kacheln, Chips, Sortierung) soll
fixiert sein, nur die Liste scrollt. Im echten Panel (Nachbau aus
`tests/panel`, erfundene Daten), gescrollter Zustand.

| Variante | Inhalt |
| --- | --- |
| A | alles fixiert (Kacheln, Chips, Sortierung); die Liste hat nur rund die halbe Höhe |
| B | Kacheln scrollen weg, Chips und Sortierung bleiben oben |
| C (Empfehlung) | Kacheln werden beim Scrollen zu einer Zeile (online, ausgefallen, Puls), Chips und Sortierung bleiben |

Neu rendern: `CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/fixed-v1/src/render.mjs`
