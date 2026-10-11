# Mockups off-marker-v1: Zeichen für "Meldung aus" in den Grafiken

Wunsch des Nutzers (2026-10-11): Der gestrichelte Ring am Ende einer ausgeschalteten Meldung ("Kein Push") sieht wie ein
Pixelfehler aus; gesucht ist ein klares Zeichen, zum Beispiel ein rotes X, in allen Grafiken.

Im echten Panel (Nachbau, erfundene Daten), die Varianten hängen nur Stile an die Klasse `.mk-off`.

- `1-Vergleich.png`: Übersicht (Ausfall, Batterie, Laden, Neu), Reiter Laden, Geräte-Popup Laden

Varianten: Ist (gestrichelter Ring; bei Balken ohne Zeichen), A (roter Ring mit X), B (grauer Ring mit Schrägstrich),
C (rotes X ohne Ring).

Neu erzeugen: `CHROMIUM_PATH=... node docs/mockups/off-marker-v1/src/render.mjs`
