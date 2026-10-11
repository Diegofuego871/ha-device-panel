# Mockups magic-push-v2: Reiter "Magic Push" (endgültig)

Entscheid des Nutzers zu magic-push-v1 (2026-10-11): Variante C (Assistent), dazu:

1. Zeit: neben den Vorschlägen (Sofort, 1 Min., 5 Min., 10 Min., 30 Min., 1 Std.) immer auch eine freie Zeit.
2. Wiederholung und "wieder normal melden" einstellbar (Schritt 4).
3. Empfänger wählbar (Dienste, Gruppen, Entitäten wie in "Überwachung und Meldungen"); Standard ist das Ziel aus den Einstellungen.
4. Rückblick (letzte 24 Stunden: wie oft wäre die Meldung gekommen) in der ersten Version.
5. Nicht erreichbare Entitäten (unavailable, unknown) melden nichts; dafür gibt es den Ausfall-Push.

- `1-Zahl-Teil1.png`: Liste der Meldungen, Schritt 1 (Wert wählen), Schritt 2 (Wann, freie Zeit, Rückblick mit Diagramm)
- `2-Zahl-Teil2.png`: Schritt 3 (Text, Variablen passend zur Zahl), Schritt 4 (Versand, Vorschau auch für "wieder normal"), Empfänger-Auswahl
- `3-Zustand.png`: dasselbe für einen Zustand (Fenster offen): eigene Zeit, Rückblick als Zeitleiste, Variablen ohne Schwelle und Einheit

Variablen je Art der Entität:
- Zahl mit Einheit (Temperatur, Feuchte, Batterie, Signal, Leistung): `{value}` `{unit}` `{threshold}` `{duration}` `{since}` `{time}`
- Zustand (Fenster, Bewegung, Schloss, Nässe, Schalter): `{value}` als Wort der Entität (offen/zu, Bewegung/ruhig, nass/trocken) statt on/off, ohne `{threshold}` und `{unit}`
- "ändert sich": zusätzlich `{old}` und `{new}`
- immer: `{device}` `{area}` `{entity}` `{integration}`

Neu erzeugen: `CHROMIUM_PATH=... node docs/mockups/magic-push-v2/src/render.mjs`
