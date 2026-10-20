# Mockups "Empfangsfenster übersichtlicher" (2026-10-20)

Wunsch des Nutzers: Das Fenster "Empfang" (Bluetooth) hat sehr viel Text und wirkt unübersichtlich; es soll besser dargestellt werden, ohne dass
wichtige Angaben verloren gehen. Statisches HTML in der Optik des Panels (dunkel, Handy 390 px), erfundene Daten.

| Bild | Inhalt |
| --- | --- |
| `1-varianten.png` | 0 Heute, A Karten mit eingeklappten Hinweisen (Empfehlung), B zwei Reiter, C eine Tabelle für alle Empfänger |

Angaben, die in jeder Variante erhalten bleiben: aktueller Wert mit Stufe, Median/Schlechtester/Bester, Diagramm mit Spanne und Warnschwelle,
Zeitraum, Quelle der Aufzeichnung, Hinweis zum Median, Live-Werte je Empfänger mit Alter, Weg-Balken mit Anteil und Ø je Empfänger,
Hinweis auf deutlich schwächeren Empfänger, letzte Wechsel, Lücken-Erklärung.

Offen (Entscheid des Nutzers): Variante.

Neu rendern: `CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/signal-layout-v1/src/render.mjs`
