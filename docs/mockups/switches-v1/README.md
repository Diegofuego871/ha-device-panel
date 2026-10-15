# Mockups Reiter "Schalter" (2026-10-15)

Wunsch des Nutzers: ein zusätzlicher Reiter im Geräte-Popup, an zweiter Stelle (nach "Übersicht"). Er zeigt alle schaltbaren Entitäten des Geräts mit Symbol und
Beschriftung. Ein Tipp öffnet die Bedienung von Home Assistant, genau wie heute die Entität im Reiter "Entitäten" (`data-dlg="more-info"`). Im echten Panel
(Nachbau aus `tests/panel`, erfundene Daten), Handy 402 × 874. Die Namen der Entitäten sind erfunden.

| Bild | Inhalt |
| --- | --- |
| `1-Schalter-Handy.png` | **A (Empfehlung):** Kacheln im Raster (zwei Spalten), Symbol, Name, Zustand darunter, "an" farbig. B: Liste mit Pfeil. C: kompakte Kacheln in drei Spalten. |
| `2-Emoji-Reiterleiste.png` | Vier Emoji-Sätze für die Reiterleiste auf dem Handy (dort steht nur das Symbol, am gewählten Reiter dazu die Beschriftung): Schalter und Routinen, je mit gewähltem Reiter. |

Vorschlag (noch nichts umgesetzt, der Nutzer entscheidet):

- Welche Entitäten: dieselbe Auswahl wie bei den Routinen (Schalter, Licht, Ventilator, Rollladen, Ventil, Schloss, Sirene, Luftbefeuchter, Klima, Mediaplayer); ausgeblendete zählen mit, deaktivierte nicht.
- Tippen öffnet die Bedienung von HA; kein Schalten per Tipp auf der Kachel (ein Schloss oder Rollladen soll nie aus Versehen reagieren).
- Nicht erreichbare Entitäten: Kachel gedimmt, Zustand "Nicht erreichbar".
- Hat ein Gerät keine schaltbare Entität, entfällt der Reiter (die Leiste bleibt kürzer, keine leere Seite).
- Emoji (Handy): Empfehlung A, 🎛️ Schalter und 🔁 Routinen. Die anderen Sätze: B 🔌 / ⏰, C 🕹️ / ⚡, D 💡 / 🗓️.

Neu rendern: `CHROMIUM_PATH=... node docs/mockups/switches-v1/src/render.mjs`
