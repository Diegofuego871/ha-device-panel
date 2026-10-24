# Mockups "Einrichtungsassistent" (2026-10-24)

Wunsch des Nutzers: Nach der Installation führt ein Assistent einmalig durch die Grundkonfiguration (Vollbild am Handy, Popup am Desktop): kurze Erklärung, Integrationen, Gerätetypen, Geräte, Meldungen. Nur, was ohne Einstellung nicht funktioniert oder nicht sinnvoll vorbelegt ist. Neu starten im Kapitel "Einrichtungsassistent" (Einstellungen › Panel); bis zum ersten Abschluss eine Kachel samt orangem Punkt im Launcher. Statisches HTML, erfundene Daten.

| Bild | Inhalt |
| --- | --- |
| `1-ablauf-handy-a.png` | Willkommen, Integrationen, Gerätetypen, Geräte nach Integration gruppiert (A, Empfehlung) |
| `2-ablauf-handy-b.png` | Geräte als flache Liste (B), Meldungen, Ruhezeit, Fertig |
| `3-desktop.png` | Dasselbe als Popup am Desktop |
| `4-einstiege-und-zustaende.png` | Launcher mit Kachel und Punkt, Kapitel in den Einstellungen, Zustände |

Offen (Entscheid des Nutzers): Variante der Geräteliste (A/B), "Jetzt nicht" allein oder dazu "Nicht mehr zeigen", Umfang der Schritte.

Neu rendern: `(cd docs/mockups/wizard-v1/src && python3 build.py) && CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/wizard-v1/src/render.mjs`
