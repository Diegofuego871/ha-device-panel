# Mockups "Profi-Modus der KI-Einschätzung" (2026-10-04)

Wunsch des Nutzers: Im Abschnitt "KI-Einschätzung" soll ein Profi-Modus den
Prompt mit Variablen zeigen, den das Panel an die KI schickt; man kann ihn
kopieren und anpassen. Heute ist der Prompt fest in
`ai_assessment.build_instructions`. Statisches HTML, erfundene Daten.

| Bild | Inhalt |
| --- | --- |
| `1-abschnitt.png` | Heute und Vorschlag: Schalter "Profi-Modus" im Abschnitt, Prompt mit Variablen `{language}` und `{facts}`, Knöpfe Bearbeiten, Kopieren, Standard |
| `2-fenster.png` | Fenster "Prompt bearbeiten": Reiter Bearbeiten (Variablen-Chips, Zeichenzähler, Hinweis zur Überschrift), Vorschau (echter Text mit den Fakten eines Geräts), Fehlerfall ohne `{facts}` |

Neu rendern: `CHROMIUM_PATH=... node docs/mockups/ai-v1/src/render.mjs`
