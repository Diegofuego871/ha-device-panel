# Mockups magic-push-v1: Reiter "Magic Push" im Geräte-Popup

Wunsch des Nutzers (2026-10-11): Ein vierter Reiter im Geräte-Popup, in dem man ohne Automation Push-Meldungen für
Werte oder Veränderungen des Geräts anlegt: Entität wählen, Bedingung (Wert wird über- oder unterschritten), Dauer,
Freitext mit Variablen der Entität, immer mit Vorschau.

Im echten Panel (Nachbau, erfundene Daten): Popup eines Geräts "Klimasensor Keller" mit dem neuen Reiter.

- `A.png` Satz-Baukasten: Meldungen als Sätze in einer Liste, Editor als ein Satz mit Auswahlfeldern, Entität aus einer Liste.
- `B.png` Entitäten-Karten (Empfehlung): alle Entitäten mit aktuellem Wert, antippen öffnet Vorschläge, Schwelle mit Regler,
  Dauer, Text mit Variablen, Vorschau; Zustände (Fenster offen) mit eigenen Vorschlägen.
- `C.png` Assistent in drei Schritten: Wert wählen, Bedingung mit Diagramm (Rückblick), Text mit Vorschau.

Variablen (Vorschlag): `{device}` `{area}` `{entity}` `{value}` `{unit}` `{threshold}` `{duration}` `{since}`; bei "ändert
sich" zusätzlich `{old}` und `{new}`. Nur Ersetzen, keine Vorlagen-Sprache (nichts ausführbar).

Neu erzeugen: `CHROMIUM_PATH=... node docs/mockups/magic-push-v1/src/render.mjs`
