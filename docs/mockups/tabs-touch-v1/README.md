# Mockups tabs-touch-v1: grössere Reiter auf dem Handy, letzte Zeile gleich gross und links

Wunsch des Nutzers (2026-10-11): Reiter ohne Fläche dahinter (Variante A aus `tabs-frame-v1`), auf dem Handy etwas
grösser zum Bedienen mit dem Finger, und der Reiter "Integrationen" in der letzten Zeile nicht mehr über die ganze
Breite, sondern gleich gross wie die anderen und links.

Im echten Panel (Nachbau, erfundene Daten), die Varianten hängen nur Stile an die echten Reiter-Klassen.

- `1-Geraete-Popup.png`, `2-Einstellungen.png`, `3-Integration.png`

Varianten: Heute (2.0.2 mit A), 1 (Raster, gleich breit, drei pro Zeile), 2 (natürliche Breite, linksbündig),
3 (Raster mit vier Spalten, Schrift 13 px). Alle 44 px hoch.

Neu erzeugen: `CHROMIUM_PATH=... node docs/mockups/tabs-touch-v1/src/render.mjs`
