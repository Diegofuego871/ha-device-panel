# Mockups KI-Bereich abgrenzen (2026-10-15)

Wunsch des Nutzers: Einschätzung, Rückfragen und Chat laufen optisch in die Abschnitte darunter
(Verbindung, Gerät) über. Man sieht nicht auf den ersten Blick, was zur KI gehört und was nicht;
zu wenig Kontrast, zu wenig Abgrenzung. Im echten Panel (Nachbau aus `tests/panel`, erfundene Daten), iPhone-Breite, dunkel.

| Bild | Inhalt |
| --- | --- |
| `1-Varianten.png` | Kopf des KI-Bereichs. **A (Empfehlung):** der ganze Bereich in einem Rahmen mit Kopfzeile "KI-Einschätzung" und Quelle, Einschätzung und Rückfragen innen durch eine gestrichelte Linie getrennt. B: Akzentleiste links über den ganzen Bereich, getönter Grund, Marke "KI". C: zwei Karten (Einschätzung, Rückfragen), KI-Marke an der Überschrift. |
| `2-Unterkante.png` | Derselbe Bereich weiter unten: wie er endet und "Verbindung" beginnt. |

Empfehlung A: Der Rahmen schliesst Einschätzung und Chat sichtbar ein, die Kopfzeile sagt, dass es die KI ist
und von welcher Aufgabe, und nach dem Rahmen beginnt eindeutig etwas anderes. B grenzt nur an einer Seite ab und
wird auf hellem Grund schwächer. C trennt zwar Einschätzung und Chat, lässt aber den Chat wieder wie einen
normalen Abschnitt aussehen.

Neu rendern: `CHROMIUM_PATH=... node docs/mockups/ai-frame-v1/src/render.mjs`
