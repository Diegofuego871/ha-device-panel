# Mockups Timer: Helligkeit und Farbe (2026-10-15)

Wunsch des Nutzers: Beim Einschalten eines Lichts im Timer soll sich einstellen lassen, wie es leuchtet
(Helligkeit, Farbe), und es muss **einfach bleiben**. Idee des Nutzers: oben auf die Karte tippen, einstellen,
und die Vorschau zeigt gleich, wie das Licht leuchtet (100 %, Farbe). Die Karte der Lampe in Schritt 1 des
Assistenten wird zum Bedienelement; die Lampe darin ist die Vorschau (es wird nichts geschaltet, das tut weiter
"Jetzt ausführen"). Ohne Einstellung bleibt alles wie heute ("wie zuletzt"). Es erscheint nur, was die Lampe
kann (aus den Eigenschaften der Entität: Farbmodi, Kelvin-Bereich). Im echten Panel (Nachbau aus `tests/panel`,
erfundene Daten), Handy.

| Bild | Inhalt |
| --- | --- |
| `1-Variante-A.png` | **A (Empfehlung):** 1 Standard mit Hinweis "Einstellen: Helligkeit und Farbe" in der Karte; 2 angetippt, Lampe nur mit Weiss: grosse Vorschau, Helligkeit, Farbtemperatur; 3 Farblampe: Helligkeit und Farben; 4 zugeklappt, die Lampe leuchtet in der Karte, Satz und Ergebnis nennen die Einstellung. |
| `2-Variante-B.png` | B: Karte bleibt schlank, nur die kleine Lampe links leuchtet als Vorschau, Regler direkt darunter; zugeklappt eine Zeile "40 % · warmweiss". |

Empfehlung A: Die grosse Vorschau zeigt Helligkeit und Farbe auf einen Blick, auch auf dem Handy mit dem Daumen
am Regler; B ist kompakter, die kleine Lampe ist aber schwer zu beurteilen.

Neu rendern: `CHROMIUM_PATH=... node docs/mockups/timer-light-v1/src/render.mjs`
