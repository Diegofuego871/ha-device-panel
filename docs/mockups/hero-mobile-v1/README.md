# Mockups Info-Kacheln oben auf dem Handy (2026-10-07)

Wunsch des Nutzers: Die Kacheln oben ("Verfügbarkeit", "Gerade ausgefallen") sollen auf
einem Handy, z. B. dem iPhone 17 (402 × 874 pt), sauber zwei nebeneinander Platz haben.
Heute sind es drei Kacheln à 280 px zum seitlichen Wischen; nebeneinander passt nur eine
ganze, die zweite ist angeschnitten (`0-heute.png`).

Erstellt im echten Panel (Nachbau aus `tests/panel`, erfundene Daten), die Änderungen als
CSS eingesetzt. Jede Variante in zwei Zuständen (mit Ausfällen / alles online).

| Bild | Inhalt |
| --- | --- |
| `0-heute.png` | Ausgangslage im iPhone-17-Fenster (wie das Bildschirmfoto des Nutzers). |
| `1-V1-puls-darunter.png` | **V1:** zwei kompakte Kacheln nebeneinander, die Puls-Kachel in voller Breite darunter. |
| `2-V2-puls-als-zeile.png` | **V2 (Empfehlung):** zwei kompakte Kacheln, der Puls als schlanke Zeile darunter (Titel, "Sammelausfall"-Zeile, kleine Kurve). |
| `3-V3-wischen.png` | V3: zwei kompakte Kacheln, der Puls als zweite Seite zum Wischen (Punkte unter den Kacheln). |

## Gemeinsam in V1 bis V3: die zwei kompakten Kacheln

Bei 402 pt sind es zwei Kacheln à 185 px (12 px Rand, 8 px Abstand). Dafür:

- **Verfügbarkeit:** kleinerer Ring (62 px, nur die Zahl, "von N online" entfällt, die Zeile
  "N stabil" sagt dasselbe) mit dem Prozentwert daneben ("jetzt" darunter); darunter "Ø 24 Std."
  und die Zeilen stabil / instabil / ausgefallen / ohne Daten.
- **Gerade ausgefallen:** Zahl etwas kleiner (38 statt 44 px); bei Ausfällen die zwei längsten
  Geräte und "+ N weitere" statt vier Zeilen; der Satz "Kein Gerät ist gerade ausgefallen."
  entfällt (die Zahl 0 und "Alles online" sagen es). Die Warnzeile ist kurz: "3 Warnungen"
  statt "3 Geräte mit Warnung".
- Gilt nur bis 600 px Breite; Tablet und Desktop bleiben unverändert.
- Gegengeprüft bei 375 pt (iPhone SE/mini): hält, nur "Gerade ausgefallen" bricht in zwei Zeilen.

## Die drei Varianten im Vergleich

Beginn der Geräteliste, gemessen vom oberen Fensterrand im 874 px hohen Fenster:

| Variante | Liste beginnt bei | Puls sichtbar | Wischen nötig |
| --- | --- | --- | --- |
| Heute | 503 bis 517 px | nur Kachel 3 (wischen) | ja, für Kachel 2 und 3 |
| V1 | 686 px (+170 px) | ja, voll mit Kurve und Sammelausfall-Text | nein |
| **V2** | 540 px (+25 bis 35 px) | ja, als Zeile mit Kurve und Titel des Sammelausfalls | nein |
| V3 | 494 px (−10 bis −25 px) | erst nach dem Wischen | ja, für den Puls |

## Empfehlung: V2

Alle drei Angaben bleiben ohne Wischen sichtbar, und die Liste beginnt kaum tiefer als heute
(V1 kostet fast zwei Geräte-Zeilen). Der Puls bleibt antippbar und öffnet wie heute das Fenster
"Unterbrüche in 24 Std.". V3 spart am meisten Höhe, versteckt den Puls aber hinter einer Wischgeste.

Zu V2 gehört: Der Text des Sammelausfalls ("3 Geräte gleichzeitig, alle über …") passt nicht in
die Zeile; in der Zeile bleibt nur die Titelzeile ("06:58 · Sammelausfall"). Der volle Text würde
ins Puls-Fenster umziehen (dort markiert ihn heute nur ein Punkt in der Kurve, auf dem Handy ohne
Tooltip). Das wäre eine kleine Ergänzung bei der Umsetzung.

Neu rendern:
`CHROMIUM_PATH=... node docs/mockups/hero-mobile-v1/src/render.mjs`
(`MOCK_W=375 MOCK_H=667` zum Gegenprüfen anderer Fenster; diese Bilder nicht einchecken.)
