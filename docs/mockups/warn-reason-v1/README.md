# Mockups Warum die Warnung? (2026-10-08)

Wunsch des Nutzers: Wer in der Kachel auf "Geräte mit Warnung" tippt und ein Gerät öffnet,
soll oben im Popup sofort sehen, wieso die Warnung besteht. Heute steht der Grund nur
weiter unten (Statistik-Kachel "Empfang", "Batterie", Pille "Instabil").
Gründe einer Warnung: instabil, Batterie niedrig, schwacher Empfang, keine Daten.
Im echten Panel (Nachbau aus `tests/panel`, erfundene Daten), iPhone 17.

| Bild | Inhalt |
| --- | --- |
| `1-Varianten.png` | **A (Empfehlung):** Hinweisfeld unter dem Kopf, je Grund eine Zeile mit Wert und Schwelle (Tipp scrollt zur Kachel). B: Marken im Kopf. C: wie A, dazu die betroffenen Kacheln gelb markiert. |

Empfehlung A: klar lesbar auch bei mehreren Gründen, nennt Wert und Schwelle; B wird bei
langen Gründen unruhig; C ist ein Zusatz zu A.

Neu rendern: `CHROMIUM_PATH=... node docs/mockups/warn-reason-v1/src/render.mjs`
