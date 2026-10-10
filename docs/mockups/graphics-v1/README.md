# Mockups graphics-v1: einheitliche Zeitstrahl-Grafiken

Wunsch des Nutzers (2026-10-10): Die Grafiken in Übersicht, Ausfall, Batterie, Laden, Neu und Updates (sowie in
Integration und Geräte-Popup, dieselben Funktionen) sollen einheitlich enden: bei etwa 80 % der Breite, dort steht
auch der Wert. Heute enden die parallelen Balken (Ausfall, Neu) am Rand, der Wert steht rechts im Kopf; die
Linien mit Punkten (Batterie, Laden, Updates) haben den zweiten Wert bei etwa 78 %.

Im echten Panel (Nachbau, erfundene Daten). Die Varianten ersetzen im Nachbau `_tlHtml` und `_ptlHtml` und hängen
Stile an; Texte und Daten bleiben.

- `1-Uebersicht.png`: Streifen in der Übersicht (Ansicht)
- `2-Bearbeiten.png`: Reiter Ausfall, Batterie, Laden, Neu (mit Eingabefeldern)

Varianten: Ist, A (Wert unter dem Endpunkt), B (Wert über dem Endpunkt).

Gemessen: Auf dem Handy (390 px) sind die letzten 20 % der Breite etwa 66 px breit, ein Zahlenfeld ist 77 px
breit. "Wert rechts neben dem Endpunkt" passt deshalb nicht.

Neu erzeugen: `CHROMIUM_PATH=... node docs/mockups/graphics-v1/src/render.mjs`
