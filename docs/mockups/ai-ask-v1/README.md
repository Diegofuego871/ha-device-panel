# Mockups Rückfrage zur KI-Einschätzung (2026-10-15)

Wunsch des Nutzers (Punkt 5 der KI-Vorschläge): Nach einer Einschätzung soll man der KI eine
Rückfrage zum selben Gerät stellen können ("Warum nachts?", "Ist es die Batterie?"), ohne die
Einschätzung neu zu starten. Die KI bekommt dieselben Fakten, die letzte Einschätzung und die Frage.
Im echten Panel (Nachbau aus `tests/panel`, erfundene Daten), iPhone-Breite.

| Bild | Inhalt |
| --- | --- |
| `1-Varianten.png` | **A (Empfehlung):** Fragen als Chips unter der Einschätzung, dazu "Eigene Frage …" (öffnet ein Textfeld). B: freies Textfeld wie ein Chat, Verlauf aus Frage und Antwort. C: Knopf "Nachfragen …", der ein eigenes Fenster mit Verlauf und Eingabe öffnet (im Bild nur der Knopf). |

Empfehlung A: ein Tipp genügt (kein Tippen auf dem Handy), die Chips zeigen, was sinnvoll zu fragen ist,
und "Eigene Frage" deckt den Rest ab. B ist flexibler, aber auf dem Handy mühsam und lädt zu langen
Gesprächen ein; C braucht ein zusätzliches Fenster für wenig Gewinn.

Offene Punkte für die Umsetzung (Vorschlag): höchstens 3 Rückfragen je Einschätzung (jede ist ein Aufruf
der KI-Aufgabe), Antworten kurz (2 bis 3 Sätze), eigene Frage auf 200 Zeichen begrenzt und wie alle
Fakten als Daten behandelt (nicht als Anweisung), Rückfragen im Protokoll vermerkt.

Neu rendern: `CHROMIUM_PATH=... node docs/mockups/ai-ask-v1/src/render.mjs`
