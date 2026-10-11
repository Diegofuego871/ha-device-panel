# Mockups segmented-v1: Reiter als Segmentschalter (nach der UniFi-Aufnahme)

Wunsch des Nutzers (2026-10-11): Die Reiter sollen genau so aussehen und sich so verhalten wie in einer
Bildschirmaufnahme der UniFi-App (iOS-Segmentschalter): eine abgerundete Fläche mit gleich breiten Feldern, das
gewählte Feld ist eine dunklere Kapsel mit Akzentschrift (blau), nicht gewählte Felder ohne Rahmen; beim Wechsel
gleitet die Kapsel mit leichtem Nachschwingen (etwa 0,45 s), dabei wird sie kurz durchscheinend, die Schrift wechselt
weich die Farbe.

Aus der Aufnahme gemessen/abgelesen: Fläche heller als der Grund, Kapsel dunkler als die Fläche, Kapsel mit
minimalem Rand, Schrift der nicht gewählten Felder hellgrau, gewählt blau, drei gleich breite Felder in einer Zeile.

- `1-Geraete-Popup.png`, `2-Einstellungen.png`, `3-Integration.png`: Ist (2.0.3) gegen Neu, im echten Panel (Nachbau,
  erfundene Daten), Endzustand ohne Gleiten.
- `prototype.html`: beweglicher Prototyp (Gleiten, Nachschwingen, Hell/Dunkel).

Neu erzeugen: `CHROMIUM_PATH=... node docs/mockups/segmented-v1/src/render.mjs`
