# Mockups "Geräte im Panel" (2026-10-04)

Rückfrage des Nutzers: Die Einstellungen haben zu viele Abschnitte.
"Integrationen" soll zuoberst stehen; "Integrationen" und "Gerätetypen"
tun dasselbe (Geräte ganz aus dem Panel nehmen) und gehören zusammen.
Geprüft in `devices._shown`: Integration, Typ, einzelnes Gerät und
"Dienst-Geräte anzeigen" wirken gleich (nicht in der Liste, nicht
überwacht, keine Meldungen); deaktivierte Geräte werden nie überwacht.
Statisches HTML in der Optik des Panels, Handy-Breite, erfundene Daten.

| Bild | Inhalt |
| --- | --- |
| `1-struktur.png` | Heute acht Abschnitte; neu fünf: A (Empfehlung) mit Reitern, B nur Ausnahmen |
| `2-variante-a.png` | **Empfehlung A:** Übersicht; "Geräte im Panel" mit Grundschaltern und Reitern Integrationen, Typen, Geräte |
| `3-darstellung.png` | A: "Darstellung" mit Reitern Verbindungsart und Filter-Chips |
| `4-variante-b.png` | Alternative B: nur ausgeblendete Einträge, Knopf "Ausblenden …" mit Auswahl |

Neu rendern:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/content-v1/src/render.mjs
```
