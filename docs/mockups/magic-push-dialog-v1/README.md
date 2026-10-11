# Mockups magic-push-dialog-v1: eigenes Fenster für den Magic-Push-Assistenten

Wunsch des Nutzers (2026-10-11): Der Assistent steckt heute im Reiter des Geräte-Popups. Kopf, Typ-Zeile und Reiterleiste
nehmen auf dem Handy rund ein Drittel der Höhe, die Tastatur noch einmal einen Drittel. Der Assistent soll in ein
eigenes Fenster im Popup. Der Inhalt in den Bildern ist der echte Assistent aus dem Nachbau (erfundene Daten), nur die
Hülle ist neu.

- `1-Handy-Schritt2.png`: Ist, A (Vollbild), B (Blatt von unten), Schritt 2 (Wann)
- `2-Handy-Tastatur.png`: Ist und A bei "Freie Entität wählen" mit offener Tastatur (336 px)
- `3-Desktop.png`: Ist und C (breites Fenster mit Vorschau rechts)

Varianten:

- **A, Handy (Empfehlung):** Vollbild. Schmale Kopfleiste (Titel, Gerät, Schliessen) mit Schrittanzeige, Inhalt scrollt,
  Zurück/Weiter in fester Fusszeile. Gewinn: rund 270 px mehr Inhalt, die Knöpfe bleiben immer erreichbar, der Rand des
  Popups lenkt nicht ab.
- **B, Handy:** Blatt von unten bis fast oben, der Rand des Geräte-Popups bleibt sichtbar (wie die übrigen Blätter).
  Vertraut, aber rund 44 px weniger Platz als A.
- **C, Desktop (Empfehlung):** 920 px breit. Formular links, rechts fest Diagramm, Rückblick und Vorschau; Fusszeile fest.
  Auf dem Handy gibt es C nicht, dort gilt A.

Das Verhalten wäre in allen Varianten gleich:

- Der Reiter "Magic Push" im Popup zeigt nur noch die Liste der Meldungen mit "Neue Meldung" und "Bearbeiten".
- Der Assistent öffnet als eigenes Fenster darüber. Schliessen mit offenem Entwurf fragt "Verwerfen?".
- "Bearbeiten" in den Einstellungen (Übersicht) öffnet direkt das Assistenten-Fenster. Das ist eine Verhaltensänderung
  (heute öffnet es das Geräte-Popup mit dem Assistenten).
- Die Tastatur-Hilfen (`revealField`, Abstand unter der Reiterleiste) werden einfacher, weil kein Kopf mehr darüber steht.

Neu erzeugen: `CHROMIUM_PATH=... node docs/mockups/magic-push-dialog-v1/src/render.mjs`
