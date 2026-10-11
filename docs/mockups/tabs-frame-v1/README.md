# Mockups tabs-frame-v1: Reiter ohne Fläche dahinter

Wunsch des Nutzers (2026-10-11): Die Reiter bleiben umrandet, aber die Fläche, die alle Reiter umfasst, soll
entfallen (derselbe Grund wie das übrige Popup).

Im echten Panel (Nachbau, erfundene Daten), die Varianten hängen nur Stile an die echten Reiter-Klassen.

- `1-Geraete-Popup.png`: Geräte-Popup, Einstellungen (3 + 4 Reiter)
- `2-Einstellungen.png`: Überwachung und Meldungen (Reiter auf zwei Zeilen)
- `3-Integration.png`: Detail einer Integration

Varianten: Ist (2.0.2), A (ohne Fläche), B (wie A, gewählter Reiter mit Akzentrand).

Neu erzeugen: `CHROMIUM_PATH=... node docs/mockups/tabs-frame-v1/src/render.mjs`
