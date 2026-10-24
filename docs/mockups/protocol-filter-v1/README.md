# Mockups "Filter im Protokoll einer Routine oder Meldung" (2026-10-24)

Wunsch des Nutzers: Wer vom "Protokoll" einer einzelnen Routine oder Meldung kommt, sieht den Filter heute nur in der Unterzeile. Er soll sichtbar sein, sich aufheben und wechseln lassen. Statisches HTML, erfundene Daten.

| Bild | Inhalt |
| --- | --- |
| `1-am-geraet.png` | Von der Karte am Gerät: 0 Heute, A Chips immer da, gewählte markiert (Empfehlung), B nur der gewählte Chip mit Kreuz, C Auswahlfeld |
| `2-ueber-alle-geraete.png` | Über alle Geräte (Übersicht): 0 Heute, A Chip "Routine" mit Auswahlfenster wie "Integration" (Empfehlung) mit Fenster, B Chip-Reihe mit Überlauf zur Seite |

Offen (Entscheid des Nutzers): Variante je Bild. Gilt gleich für Magic Push.

Neu rendern: `CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/protocol-filter-v1/src/render.mjs`
